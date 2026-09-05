import { NextResponse } from "next/server";

export const PINTEREST_TAXONOMY: { category: string; subcategories: string[] }[] = [
  { category: "Animals", subcategories: ["Birds", "Cats", "Dogs", "Fish & Aquariums", "Horses", "Insects & Butterflies", "Reptiles", "Wildlife", "Zoo Animals"] },
  { category: "Architecture", subcategories: ["Bridges", "Buildings", "Cabins", "Churches & Cathedrals", "Cityscapes", "Historic Architecture", "Interior Architecture", "Modern Architecture", "Skyscrapers"] },
  { category: "Art", subcategories: ["Abstract Art", "Ceramics & Pottery", "Digital Art", "Drawing", "Fine Art", "Graffiti & Street Art", "Mixed Media", "Oil Painting", "Sculpture", "Watercolor"] },
  { category: "Automotive", subcategories: ["Cars", "Classic Cars", "Electric Vehicles", "Motorcycles", "Off-Road Vehicles", "Trucks & SUVs", "Van Life"] },
  { category: "Beauty", subcategories: ["Eye Makeup", "Hair Care", "Hair Color", "Hairstyles", "Lip Color", "Nail Art", "Natural Beauty", "Perfume & Fragrance", "Skincare", "Tutorials"] },
  { category: "Books & Literature", subcategories: ["Book Clubs", "Classic Literature", "Comics & Graphic Novels", "Fantasy & Sci-Fi", "Mystery & Thriller", "Non-Fiction", "Poetry", "Romance", "Young Adult"] },
  { category: "Business & Finance", subcategories: ["Entrepreneurship", "Investing", "Marketing", "Personal Finance", "Productivity", "Side Hustles", "Small Business", "Startups"] },
  { category: "Children's Fashion", subcategories: ["Baby Clothes", "Boys Fashion", "Girls Fashion", "Kids Accessories", "School Outfits", "Toddler Style"] },
  { category: "Design", subcategories: ["Brand Identity", "Graphic Design", "Industrial Design", "Logo Design", "Motion Graphics", "Packaging Design", "Typography", "UI & UX", "Web Design"] },
  { category: "DIY & Crafts", subcategories: ["Candle Making", "Crochet", "Embroidery", "Knitting", "Macramé", "Paper Crafts", "Resin Art", "Sewing", "Upcycling", "Woodworking"] },
  { category: "Education", subcategories: ["College & University", "E-Learning", "Homeschooling", "Infographics", "Language Learning", "STEM", "Study Tips", "Teaching Resources"] },
  { category: "Entertainment", subcategories: ["Anime", "Gaming", "K-Pop", "Movies", "Music", "Podcasts", "TV Shows", "Theater"] },
  { category: "Event Planning", subcategories: ["Baby Showers", "Birthday Parties", "Bridal Showers", "Corporate Events", "Graduation", "Holiday Parties", "Table Settings", "Wedding Planning"] },
  { category: "Fashion", subcategories: ["Accessories", "Bags & Purses", "Casual Style", "Formal Wear", "Shoes", "Streetwear", "Sustainable Fashion", "Vintage & Thrift"] },
  { category: "Food & Drink", subcategories: ["Baking", "BBQ & Grilling", "Breakfast", "Cocktails & Drinks", "Desserts", "Dinner Recipes", "Healthy Eating", "Meal Prep", "Snacks", "Vegan & Vegetarian"] },
  { category: "Gardening", subcategories: ["Container Gardening", "Flower Gardening", "Herb Gardens", "Indoor Plants", "Landscape Design", "Organic Gardening", "Succulents & Cacti", "Vegetable Gardens"] },
  { category: "Health & Fitness", subcategories: ["Cardio", "Gym Workouts", "Meditation", "Mental Health", "Nutrition", "Pilates", "Running", "Strength Training", "Wellness", "Yoga"] },
  { category: "Holidays & Celebrations", subcategories: ["Christmas", "Easter", "Halloween", "Hanukkah", "New Year's", "Thanksgiving", "Valentine's Day", "4th of July"] },
  { category: "Home Decor", subcategories: ["Bathroom Decor", "Bedroom Ideas", "Bohemian Style", "Color Palettes", "Farmhouse Style", "Kitchen Decor", "Living Room Ideas", "Minimalist Design", "Outdoor Living", "Scandinavian Style"] },
  { category: "Kids & Parenting", subcategories: ["Baby Products", "Child Development", "Education Activities", "Family Activities", "Newborn Care", "Parenting Tips", "Pregnancy", "Toddler Activities"] },
  { category: "Men's Fashion", subcategories: ["Business Casual", "Formal Wear", "Grooming", "Gym & Activewear", "Shoes", "Smart Casual", "Streetwear", "Watches & Accessories"] },
  { category: "Nature", subcategories: ["Beaches", "Deserts", "Flowers", "Forests", "Mountains", "National Parks", "Seasons", "Sunsets & Sunrises", "Waterfalls"] },
  { category: "Outdoors & Adventure", subcategories: ["Camping", "Cycling", "Fishing", "Hiking", "Rock Climbing", "Skiing & Snowboarding", "Surfing", "Kayaking"] },
  { category: "People", subcategories: ["Couple Goals", "Family", "Friendship", "Influencers", "Portraits", "Self-Care", "Street Style"] },
  { category: "Pets", subcategories: ["Cat Care", "Dog Care", "Dog Training", "Exotic Pets", "Pet Accessories", "Pet Fashion", "Pet Health", "Rabbit & Small Animals"] },
  { category: "Photography", subcategories: ["Aerial Photography", "Film Photography", "Food Photography", "Landscape Photography", "Portrait Photography", "Product Photography", "Street Photography", "Wedding Photography"] },
  { category: "Quotes", subcategories: ["Funny Quotes", "Inspirational Quotes", "Life Quotes", "Love Quotes", "Motivational Quotes", "Self-Love Quotes", "Success Quotes"] },
  { category: "Science & Nature", subcategories: ["Astronomy & Space", "Biology", "Chemistry", "Earth Science", "Environment", "Ocean & Marine Life", "Physics", "Weather"] },
  { category: "Sports", subcategories: ["Baseball", "Basketball", "Football", "Golf", "Soccer", "Swimming", "Tennis", "Volleyball", "Yoga & Pilates"] },
  { category: "Technology", subcategories: ["AI & Machine Learning", "Apps & Software", "Cybersecurity", "Gadgets", "Gaming Tech", "Programming", "Smart Home", "Wearables"] },
  { category: "Travel", subcategories: ["Adventure Travel", "Beach Destinations", "Budget Travel", "City Breaks", "Europe", "Luxury Travel", "Road Trips", "Solo Travel", "Southeast Asia", "Travel Hacks"] },
  { category: "Vehicles", subcategories: ["Bikes & Cycling", "Boats & Sailing", "Classic Vehicles", "Electric Cars", "Luxury Cars", "RVs & Vans", "Trucks"] },
  { category: "Weddings", subcategories: ["Bouquets & Florals", "Bridal Fashion", "Cakes", "Destination Weddings", "Engagement Rings", "Groom Style", "Outdoor Weddings", "Wedding Decor", "Wedding Venues"] },
  { category: "Women's Fashion", subcategories: ["Activewear", "Bags & Purses", "Boho Style", "Business Fashion", "Capsule Wardrobe", "Modest Fashion", "Shoes & Heels", "Summer Outfits", "Winter Fashion"] },
];

export async function GET() {
  let id = 1;
  const interests = PINTEREST_TAXONOMY.flatMap(({ category, subcategories }) => [
    { id: String(id++), name: category, isCategory: true },
    ...subcategories.map((sub) => ({ id: String(id++), name: sub, parent: category, isCategory: false })),
  ]);
  return NextResponse.json({ interests });
}
