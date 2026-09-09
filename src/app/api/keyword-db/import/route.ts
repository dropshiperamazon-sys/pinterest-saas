// CSV Keyword Import — admin only
//
// Expected CSV columns (header required):
//   keyword, monthly_searches, competition, avg_cpc, trend, country, language, category, source
//
// Optional: source_reference
//
// Example:
//   room decor,135000,high,1.20,8,US,en,Home Decor,Google Keyword Planner

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

function parseNum(s: string): number | null {
  if (!s || s.trim() === "" || s.trim() === "-") return null;
  // Strip %, $, commas
  const cleaned = s.replace(/[$%,]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
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
    const sourceRaw = row[idx("source")]?.trim() || "ADMIN_IMPORTED";
    const source = mapSource(sourceRaw);
    const sourceReference = row[idx("source_reference")]?.trim() || sourceRaw || null;

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
          source,
          sourceReference,
          confidence: "VERIFIED",
          lastVerifiedAt: Date.now(),
        });

        validRows++;
        if (result.action === "created") newKeywords++;
        else if (result.action === "updated") updatedKeywords++;
        else duplicateRows++;
      } catch (e) {
        errors.push(`Row ${i + 1} (${country}): ${String(e)}`);
        invalidRows++;
      }
    }
  }

  const totalRows = rows.length - 1;

  // Record import history
  await recordImport({
    filename: "csv-import",
    importedBy: session.user.email,
    source: "ADMIN_IMPORTED",
    totalRows,
    validRows,
    invalidRows,
    newKeywords,
    updatedKeywords,
    duplicateRows,
    errors: errors.slice(0, 50), // cap stored errors
  });

  return NextResponse.json({
    totalRows,
    validRows,
    invalidRows,
    newKeywords,
    updatedKeywords,
    duplicateRows,
    errors: errors.slice(0, 20),
    success: true,
  });
}
