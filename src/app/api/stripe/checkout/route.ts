import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { Redis } from "@upstash/redis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const PRICE_IDS: Record<string, string> = {
  "pro-monthly": process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
  "pro-annual": process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
  "enterprise-monthly": process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID!,
  "enterprise-annual": process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID!,
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan } = await req.json();
  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const email = session.user.email;
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://app.rambforce.com";

  // Retrieve or create Stripe customer
  const raw = await redis.get<string>(`user:${email}`);
  const user = typeof raw === "string" ? JSON.parse(raw) : raw;

  let customerId: string = user?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      name: user?.name,
    });
    customerId = customer.id;
    user.stripeCustomerId = customerId;
    await redis.set(`user:${email}`, JSON.stringify(user));
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    currency: "usd",
    success_url: `${baseUrl}/dashboard?upgraded=1`,
    cancel_url: `${baseUrl}/pricing`,
    metadata: { email },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
