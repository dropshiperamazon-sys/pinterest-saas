// CSV Keyword Import — admin only
//
// Expected CSV columns (header required):
//   keyword, monthly_searches, competition, avg_cpc, trend, country, language, category, subcategory, source
//
// Optional: source_reference, subcategory
//
// Example:
//   room decor,135000,high,1.20,8,US,en,Home Decor,Bedroom,Pinterest

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  upsertKeyword,
  recordImport,
  normalizeKeyword,
  type DataSource,
} from "@/lib/keyword-db";

const REQUIRED_COLUMNS = ["keyword", "country"] as const;

const VALID_COMPETITIONS = new Set(["low", "medium", "high"]);

const SOURCE_MAP: Record<string, DataSource> = {
  "google keyword planner": "GOOGLE_KEYWORD_PLANNER",
  "google": "GOOGLE_KEYWORD_PLANNER",
  "semrush": "SEMRUSH",
  "ahrefs": "AHREFS",
  "pinterest": "PINTEREST_API",
  "admin": "ADMIN_IMPORTED",
  "admin_imported": "ADMIN_IMPORTED",
  "manual": "ADMIN_IMPORTED",
};

function mapSource(raw: string): DataSource {
  return SOURCE_MAP[raw.toLowerCase().trim()] ?? "ADMIN_IMPORTED";
}

function parseSingleNum(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[$%,\s]/g, "").toLowerCase();
  if (!cleaned || cleaned === "-") return null;
  // Handle k/m suffixes: "100k" → 100000, "1.5m" → 1500000
  const match = cleaned.match(/^([\d.]+)([km]?)$/);
  if (!match) return null;
  const base = parseFloat(match[1]);
  if (isNaN(base)) return null;
  if (match[2] === "k") return Math.round(base * 1_000);
  if (match[2] === "m") return Math.round(base * 1_000_000);
  return base;
}

function parseNum(s: string): number | null {
  if (!s || s.trim() === "" || s.trim() === "-") return null;
  // Handle ranges like "1m-2m" or "100k-200k" — take the average
  const rangeParts = s.trim().split(/\s*[-–]\s*/);
  if (rangeParts.length === 2) {
    const lo = parseSingleNum(rangeParts[0]);
    const hi = parseSingleNum(rangeParts[1]);
    if (lo != null && hi != null) return Math.round((lo + hi) / 2);
    if (lo != null) return lo;
    if (hi != null) return hi;
  }
  return parseSingleNum(s.trim());
}

function parseCompetition(s: string): "low" | "medium" | "high" | null {
  const v = s.toLowerCase().trim();
  if (VALID_COMPETITIONS.has(v)) return v as "low" | "medium" | "high";
  // Numeric: 0-33 low, 34-66 medium, 67-100 high
  const n = parseFloat(v);
  if (!isNaN(n)) {
    if (n <= 33) return "low";
    if (n <= 66) return "medium";
    return "high";
  }
  return null;
}

// Parse CSV text — handles quoted fields with commas
function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  return lines.map(line => {
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === "," && !inQ) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    fields.push(cur.trim());
    return fields;
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email !== adminEmail) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let csvText: string;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    csvText = await (file as Blob).text();
  } else {
    const body = await req.json() as { csv?: string; filename?: string };
    csvText = body.csv ?? "";
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
  }

  const rows = parseCsv(csvText).filter(r => r.some(f => f.trim()));
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
  }

  // Parse header
  const header = rows[0].map(h => h.toLowerCase().replace(/\s+/g, "_").trim());
  for (const col of REQUIRED_COLUMNS) {
    if (!header.includes(col)) {
      return NextResponse.json({ error: `Missing required column: ${col}` }, { status: 400 });
    }
  }

  const idx = (name: string) => header.indexOf(name);

  // Process rows
  let validRows = 0;
  let invalidRows = 0;
  let newKeywords = 0;
  let updatedKeywords = 0;
  let duplicateRows = 0;
  const errors: string[] = [];
  const newKeywordIds: string[] = [];
  const updatedKeywordIds: string[] = [];
  const importedForExpansion: { keyword: string; category: string | null; subcategory: string | null; country: string; monthlySearches: number | null; avgCpc: number | null }[] = [];
  const importedNormalized = new Set<string>();
  // Track keyword+country combos seen in THIS file to reject within-file duplicates
  const seenInFile = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(f => !f)) continue; // skip blank lines

    const keyword = row[idx("keyword")]?.trim();
    const countryRaw = row[idx("country")]?.trim().toUpperCase() ?? "";

    if (!keyword || keyword.length < 2) {
      errors.push(`Row ${i + 1}: keyword is empty or too short`);
      invalidRows++;
      continue;
    }

    // Support multiple countries separated by | e.g. "US|GB|AU"
    const countries = countryRaw.split("|").map(c => c.trim()).filter(Boolean);
    if (countries.length === 0) {
      errors.push(`Row ${i + 1}: country is required`);
      invalidRows++;
      continue;
    }
    const invalidCountries = countries.filter(c => c.length !== 2);
    if (invalidCountries.length > 0) {
      errors.push(`Row ${i + 1}: invalid country code(s): ${invalidCountries.join(", ")} — must be 2-letter ISO codes`);
      invalidRows++;
      continue;
    }

    const monthlySearches = parseNum(row[idx("monthly_searches")] ?? "");
    const avgCpc = parseNum(row[idx("avg_cpc")] ?? "");
    const trend = parseNum(row[idx("trend")] ?? "");
    const competition = parseCompetition(row[idx("competition")] ?? "");
    const language = row[idx("language")]?.trim() || "en";
    const category = row[idx("category")]?.trim() || null;
    const subcategory = row[idx("subcategory")]?.trim() || null;
    const sourceRaw = row[idx("source")]?.trim() || "ADMIN_IMPORTED";
    const source = mapSource(sourceRaw);
    const sourceReference = row[idx("source_reference")]?.trim() || sourceRaw || null;
    const norm = normalizeKeyword(keyword);

    // Check for duplicates within this file before processing
    const duplicateCountries = countries.filter(c => seenInFile.has(`${norm}:::${c}`));
    if (duplicateCountries.length > 0) {
      errors.push(`Row ${i + 1}: duplicate keyword "${keyword}" for country ${duplicateCountries.join(", ")} — already exists in this file, row rejected`);
      duplicateRows += duplicateCountries.length;
      invalidRows++;
      continue;
    }
    // Mark all countries in this row as seen
    for (const c of countries) seenInFile.add(`${norm}:::${c}`);

    for (const country of countries) {
      try {
        const result = await upsertKeyword({
          keyword,
          country,
          language,
          monthlySearches,
          competition,
          avgCpc,
          trend,
          category,
          subcategory,
          source,
          sourceReference,
          confidence: "VERIFIED",
          lastVerifiedAt: Date.now(),
        });

        if (result.action === "skipped") {
          errors.push(`Row ${i + 1} (${country}): duplicate — "${keyword}" already exists with higher-quality data, rejected`);
          duplicateRows++;
          invalidRows++;
        } else {
          validRows++;
          if (result.action === "created") {
            newKeywords++;
            newKeywordIds.push(result.id);
          } else {
            updatedKeywords++;
            updatedKeywordIds.push(result.id);
          }
        }

        // Track for pattern expansion only if actually saved (use first country only)
        if (result.action !== "skipped" && countries.indexOf(country) === 0) {
          importedForExpansion.push({ keyword, category, subcategory, country, monthlySearches, avgCpc });
          importedNormalized.add(norm);
        }
      } catch (e) {
        errors.push(`Row ${i + 1} (${country}): ${String(e)}`);
        invalidRows++;
      }
    }
  }

  const totalRows = rows.length - 1;

  // AI expansion is handled by the frontend calling /api/keyword-db/expand-suggestions
  // after this response returns, so we don't timeout here.
  const suggestionsGenerated = 0;
  const suggestionIds: string[] = [];

  // Record import history
  const importRecord = await recordImport({
    filename: "csv-import",
    importedBy: session.user.email,
    source: "ADMIN_IMPORTED",
    totalRows,
    validRows,
    invalidRows,
    newKeywords,
    updatedKeywords,
    duplicateRows,
    errors: errors.slice(0, 50),
    newKeywordIds: newKeywordIds.slice(0, 500), // cap to avoid huge payloads
    updatedKeywordIds: updatedKeywordIds.slice(0, 500),
    suggestionIds: suggestionIds.slice(0, 500),
  });

  return NextResponse.json({
    totalRows,
    validRows,
    invalidRows,
    newKeywords,
    updatedKeywords,
    duplicateRows,
    suggestionsGenerated,
    importId: importRecord.id,
    errors: errors.slice(0, 20),
    success: true,
    // Seeds for the frontend to fire AI expansion in background
    expansionSeeds: importedForExpansion,
    importedNormalizedKeywords: [...importedNormalized],
  });
}
