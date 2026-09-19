export interface CatalogProductInput {
  title: string;
  description: string;
  imageLink: string;
  link: string;
  brand: string;
  googleProductCategory: string;
  condition: string;
  availability: string;
}

export interface CatalogSeoResult {
  score: number;
  issues: string[];
}

export function computeCatalogSeoScore(p: CatalogProductInput): CatalogSeoResult {
  let score = 0;
  const issues: string[] = [];

  if (!p.title) {
    issues.push("Missing title");
  } else if (p.title.length < 20) {
    score += 10;
    issues.push("Title too short (<20 chars)");
  } else if (p.title.length > 150) {
    score += 10;
    issues.push("Title too long (>150 chars)");
  } else {
    score += 25;
  }

  if (!p.description) {
    issues.push("Missing description");
  } else if (p.description.length < 100) {
    score += 10;
    issues.push("Description too short (<100 chars)");
  } else {
    score += 25;
  }

  if (p.imageLink) score += 20; else issues.push("Missing image");
  if (p.link) score += 10; else issues.push("Missing product URL");
  if (p.brand) score += 8; else issues.push("Missing brand");
  if (p.googleProductCategory) score += 7; else issues.push("Missing Google Product Category");
  if (p.condition) score += 3;
  if (p.availability) score += 2;

  return { score, issues };
}
