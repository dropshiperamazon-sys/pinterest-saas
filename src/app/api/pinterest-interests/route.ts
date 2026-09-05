import { NextResponse } from "next/server";

const PINTEREST_CATEGORIES = [
  "Animals", "Architecture", "Art", "Automotive", "Beauty",
  "Books & Literature", "Business", "Children's Fashion", "Design",
  "DIY & Crafts", "Education", "Electronics", "Entertainment",
  "Event Planning", "Fashion", "Film, Music & Books", "Finance",
  "Food & Drink", "Gardening", "Health & Fitness", "History",
  "Holidays", "Home Decor", "Humor", "Illustrations & Posters",
  "Kids & Parenting", "Men's Fashion", "Nature", "Outdoors",
  "People", "Pets", "Photography", "Quotes", "Science & Nature",
  "Sports", "Technology", "Travel", "Vehicles", "Weddings",
  "Women's Fashion",
];

export async function GET() {
  const interests = PINTEREST_CATEGORIES.map((name, i) => ({ id: String(i + 1), name }));
  return NextResponse.json({ interests });
}
