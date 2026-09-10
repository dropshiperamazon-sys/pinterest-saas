// Pattern-based keyword expander — no external AI API required.
//
// Learns patterns from imported keywords and generates new keyword suggestions
// within the same category. All suggestions are stored as AI_INFERRED with
// no fabricated metrics — they appear as Data Requests for the admin to fill.

// ── Category modifier dictionaries ───────────────────────────────────────────

const CATEGORY_MODIFIERS: Record<string, { rooms: string[]; styles: string[]; qualifiers: string[] }> = {
  "home decor": {
    rooms: ["bedroom", "living room", "dining room", "bathroom", "kitchen", "outdoor", "nursery", "home office", "entryway", "laundry room", "basement", "attic", "sunroom"],
    styles: ["modern", "rustic", "boho", "minimalist", "farmhouse", "coastal", "scandinavian", "industrial", "vintage", "luxury", "budget", "diy", "aesthetic"],
    qualifiers: ["ideas", "inspiration", "on a budget", "trends", "tips", "2024", "2025"],
  },
  "wedding": {
    rooms: ["ceremony", "reception", "table", "aisle", "arch", "centerpiece", "bouquet", "cake"],
    styles: ["boho", "rustic", "beach", "garden", "winter", "summer", "vintage", "modern", "elegant", "simple", "diy", "budget", "luxury"],
    qualifiers: ["ideas", "inspiration", "trends", "decor", "themes", "planning", "checklist"],
  },
  "fitness": {
    rooms: ["home", "gym", "outdoor", "morning", "evening", "full body", "upper body", "lower body", "core", "cardio", "strength"],
    styles: ["beginner", "advanced", "women", "men", "quick", "hiit", "yoga", "pilates", "crossfit"],
    qualifiers: ["workout", "exercises", "routine", "tips", "plan", "challenge", "for weight loss", "for beginners"],
  },
  "fashion": {
    rooms: ["summer", "winter", "spring", "fall", "casual", "work", "date night", "weekend", "vacation", "evening"],
    styles: ["boho", "minimalist", "preppy", "streetwear", "vintage", "chic", "elegant", "sporty"],
    qualifiers: ["outfits", "ideas", "inspiration", "trends", "style", "look", "aesthetic"],
  },
  "food": {
    rooms: ["breakfast", "lunch", "dinner", "snack", "dessert", "appetizer", "side dish", "meal prep"],
    styles: ["easy", "quick", "healthy", "vegan", "vegetarian", "keto", "gluten free", "budget", "family"],
    qualifiers: ["recipes", "ideas", "meals", "for beginners", "under 30 minutes", "with chicken", "with vegetables"],
  },
  "travel": {
    rooms: ["beach", "mountain", "city", "europe", "asia", "tropical", "road trip", "solo", "family", "couple"],
    styles: ["budget", "luxury", "backpacking", "weekend", "adventure", "relaxing"],
    qualifiers: ["destinations", "tips", "guide", "ideas", "itinerary", "packing list", "hacks"],
  },
  "beauty": {
    rooms: ["skin", "hair", "nail", "makeup", "eye", "lip", "face", "body"],
    styles: ["natural", "everyday", "glam", "minimal", "dewy", "matte", "bold", "subtle"],
    qualifiers: ["routine", "tips", "products", "tutorial", "ideas", "hacks", "for beginners", "diy"],
  },
  "diy": {
    rooms: ["home", "garden", "bedroom", "kitchen", "bathroom", "outdoor", "living room"],
    styles: ["easy", "beginner", "budget", "upcycled", "rustic", "modern", "farmhouse"],
    qualifiers: ["projects", "ideas", "crafts", "tutorials", "gifts", "decor", "furniture"],
  },
  "garden": {
    rooms: ["backyard", "front yard", "patio", "balcony", "indoor", "raised bed", "container", "vertical"],
    styles: ["small", "large", "low maintenance", "drought tolerant", "cottage", "modern", "zen"],
    qualifiers: ["ideas", "plants", "design", "tips", "layout", "flowers", "vegetables", "inspiration"],
  },
  "kids": {
    rooms: ["toddler", "baby", "preschool", "school age", "teen", "newborn"],
    styles: ["easy", "educational", "creative", "outdoor", "indoor", "rainy day", "summer"],
    qualifiers: ["activities", "crafts", "games", "ideas", "projects", "recipes", "toys", "decor"],
  },
};

// Fallback generic modifiers for unknown categories
const GENERIC_MODIFIERS = {
  styles: ["easy", "beginner", "diy", "budget", "modern", "simple", "creative", "best"],
  qualifiers: ["ideas", "inspiration", "tips", "guide", "trends", "tutorial"],
};

// ── Pattern extraction ────────────────────────────────────────────────────────

interface ExtractedPattern {
  coreTerms: string[];      // the non-modifier words in the keyword
  modifiers: string[];      // modifiers found in the keyword
  suffix: string | null;    // trailing qualifier like "ideas", "inspiration"
  prefix: string | null;    // leading modifier like "modern", "diy"
}

function detectCategory(category: string | null): string {
  if (!category) return "generic";
  const lower = category.toLowerCase();
  for (const key of Object.keys(CATEGORY_MODIFIERS)) {
    if (lower.includes(key) || key.includes(lower)) return key;
  }
  return "generic";
}

function extractPattern(keyword: string, categoryKey: string): ExtractedPattern {
  const words = keyword.toLowerCase().split(/\s+/);
  const mods = CATEGORY_MODIFIERS[categoryKey];
  const allModifiers = mods
    ? [...mods.rooms, ...mods.styles, ...mods.qualifiers]
    : [...GENERIC_MODIFIERS.styles, ...GENERIC_MODIFIERS.qualifiers];

  const modifierWords = new Set(allModifiers.flatMap(m => m.split(/\s+/)));
  const coreTerms: string[] = [];
  const foundModifiers: string[] = [];

  for (const word of words) {
    if (modifierWords.has(word)) foundModifiers.push(word);
    else coreTerms.push(word);
  }

  // Detect suffix (last word is a qualifier like "ideas")
  const qualifiers = mods?.qualifiers ?? GENERIC_MODIFIERS.qualifiers;
  const lastWord = words[words.length - 1];
  const suffix = qualifiers.some(q => keyword.endsWith(q)) ? lastWord : null;

  // Detect prefix (first word is a style/room modifier)
  const styles = mods?.styles ?? GENERIC_MODIFIERS.styles;
  const firstWord = words[0];
  const prefix = [...(mods?.rooms ?? []), ...styles].some(m => m === firstWord) ? firstWord : null;

  return { coreTerms, modifiers: foundModifiers, suffix, prefix };
}

// ── Keyword generation ────────────────────────────────────────────────────────

export interface GeneratedKeyword {
  keyword: string;
  category: string;
  basedOn: string; // the source keyword this was derived from
}

export function expandKeywords(
  importedKeywords: { keyword: string; category: string | null; country: string }[],
  existingKeywords: Set<string>, // normalized existing keywords to avoid dupes
): GeneratedKeyword[] {
  const generated: GeneratedKeyword[] = [];
  const seen = new Set<string>(existingKeywords);

  // Group by category
  const byCategory = new Map<string, typeof importedKeywords>();
  for (const kw of importedKeywords) {
    const catKey = detectCategory(kw.category);
    if (!byCategory.has(catKey)) byCategory.set(catKey, []);
    byCategory.get(catKey)!.push(kw);
  }

  for (const [catKey, keywords] of byCategory) {
    const mods = CATEGORY_MODIFIERS[catKey];
    if (!mods && catKey !== "generic") continue;

    for (const { keyword, category } of keywords) {
      const pattern = extractPattern(keyword, catKey);

      // Strategy 1: Replace room type with all other room types
      if (mods) {
        for (const room of mods.rooms) {
          // Skip if this room modifier is already in the keyword
          if (keyword.toLowerCase().includes(room)) continue;

          // Build new keyword: replace existing room with new room
          let newKw = keyword.toLowerCase();
          let replaced = false;
          for (const existingRoom of mods.rooms) {
            if (newKw.includes(existingRoom)) {
              newKw = newKw.replace(existingRoom, room);
              replaced = true;
              break;
            }
          }

          // If no room was found to replace, prepend room to core
          if (!replaced) {
            const core = pattern.coreTerms.join(" ");
            if (core) {
              newKw = pattern.suffix
                ? `${room} ${core} ${pattern.suffix}`
                : `${room} ${core}`;
            } else {
              newKw = pattern.suffix ? `${room} ${pattern.suffix}` : room;
            }
          }

          newKw = newKw.replace(/\s+/g, " ").trim();
          if (!seen.has(newKw) && newKw.length > 3) {
            seen.add(newKw);
            generated.push({ keyword: newKw, category: category ?? catKey, basedOn: keyword });
          }
        }
      }

      // Strategy 2: Add style modifiers to core keyword (if no style already present)
      const allStyles = mods?.styles ?? GENERIC_MODIFIERS.styles;
      const hasStyle = allStyles.some(s => keyword.toLowerCase().includes(s));
      if (!hasStyle) {
        const coreSample = allStyles.slice(0, 5); // top 5 styles only to avoid explosion
        for (const style of coreSample) {
          const newKw = `${style} ${keyword}`.trim();
          if (!seen.has(newKw) && newKw.length > 3) {
            seen.add(newKw);
            generated.push({ keyword: newKw, category: category ?? catKey, basedOn: keyword });
          }
        }
      }

      // Strategy 3: Add qualifier suffixes if none present
      const allQualifiers = mods?.qualifiers ?? GENERIC_MODIFIERS.qualifiers;
      const hasSuffix = allQualifiers.some(q => keyword.toLowerCase().endsWith(q));
      if (!hasSuffix) {
        for (const qual of allQualifiers.slice(0, 3)) {
          const newKw = `${keyword} ${qual}`.trim();
          if (!seen.has(newKw) && newKw.length > 3) {
            seen.add(newKw);
            generated.push({ keyword: newKw, category: category ?? catKey, basedOn: keyword });
          }
        }
      }
    }
  }

  return generated;
}
