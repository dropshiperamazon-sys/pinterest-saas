// Analyzes URL slugs across a site to discover what topics it covers

const STOP_WORDS = new Set([
  "a","an","the","and","or","of","in","on","at","to","for","is","are","was",
  "were","be","been","being","have","has","had","do","does","did","will","would",
  "could","should","may","might","can","shall","not","no","so","if","as","by",
  "it","its","from","with","this","that","these","those","we","you","he","she",
  "they","i","my","your","our","their","what","how","why","when","where","which",
  "who","all","any","each","more","most","other","some","such","than","then",
  "there","up","out","about","into","through","during","before","after","above",
  "between","into","through","own","same","too","very","just","but","now","here",
  "both","few","get","also","new","top","best","free","tips","ways","list","ideas",
  "guide","vs","vs","de","en","le","la","el","es","com","www","html","php","asp",
  "category","tag","page","post","article","blog","news","home","index","archives",
  "author","feed","rss","amp","print","share","email","search","404","2024","2025",
  "2026","2023","2022","2021","2020","01","02","03","04","05","06","07","08","09",
  "10","11","12",
]);

function slugToWords(urlPath: string): string[] {
  // Extract the meaningful path segments, skip first empty and numeric-only
  let path: string;
  try {
    path = new URL(urlPath).pathname;
  } catch {
    path = urlPath;
  }

  return path
    .split("/")
    .filter((seg) => seg.length > 0 && !/^\d{4}$/.test(seg)) // skip year-only segments
    .flatMap((seg) => seg.toLowerCase().replace(/\.(html?|php|aspx?)$/i, "").split(/[-_+]+/))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

export interface DiscoveredKeyword {
  keyword: string;
  count: number;
  sampleUrls: string[];
}

export function analyzeSlugKeywords(urls: string[], topN = 200): DiscoveredKeyword[] {
  const freq = new Map<string, { count: number; urls: string[] }>();

  for (const url of urls) {
    const words = slugToWords(url);
    const seen = new Set<string>();

    // Single words
    for (const word of words) {
      if (seen.has(word)) continue;
      seen.add(word);
      const entry = freq.get(word) ?? { count: 0, urls: [] };
      entry.count++;
      if (entry.urls.length < 3) entry.urls.push(url);
      freq.set(word, entry);
    }

    // Bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (seen.has(bigram)) continue;
      seen.add(bigram);
      const entry = freq.get(bigram) ?? { count: 0, urls: [] };
      entry.count++;
      if (entry.urls.length < 3) entry.urls.push(url);
      freq.set(bigram, entry);
    }
  }

  // Filter: must appear in at least 2 URLs, sort by count desc
  return Array.from(freq.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, topN)
    .map(([keyword, v]) => ({ keyword, count: v.count, sampleUrls: v.urls }));
}
