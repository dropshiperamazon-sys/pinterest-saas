import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Redis } from "@upstash/redis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const PRO_PRICES = new Set([
  process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
]);

const ENTERPRISE_PRICES = new Set([
  process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
  process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID,
]);

async function updateUserPlan(email: string, plan: string, stripeData: Record<string, string>) {
  const raw = await redis.get<string>(`user:${email}`);
  if (!raw) return;
  const user = typeof raw === "string" ? JSON.parse(raw) : raw;
  Object.assign(user, { plan, ...stripeData });
  await redis.set(`user:${email}`, JSON.stringify(user));
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.metadata?.email;
    if (!email || !session.subscription) return NextResponse.json({ ok: true });

    const sub = await stripe.subscriptions.retrieve(session.subscription as string);
    const priceId = sub.items.data[0]?.price.id;
    const plan = PRO_PRICES.has(priceId) ? "pro" : ENTERPRISE_PRICES.has(priceId) ? "enterprise" : "free";

    await updateUserPlan(email, plan, {
      stripeSubscriptionId: sub.id,
      stripeStatus: sub.status,
    });
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;
    const email = customer.email;
    if (!email) return NextResponse.json({ ok: true });

    const priceId = sub.items.data[0]?.price.id;
    const plan = sub.status === "active"
      ? PRO_PRICES.has(priceId) ? "pro" : ENTERPRISE_PRICES.has(priceId) ? "enterprise" : "free"
      : "free";

    await updateUserPlan(email, plan, {
      stripeSubscriptionId: sub.id,
      stripeStatus: sub.status,
    });
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;
    const email = customer.email;
    if (!email) return NextResponse.json({ ok: true });

    await updateUserPlan(email, "free", {
      stripeSubscriptionId: "",
      stripeStatus: "canceled",
    });
  }

  return NextResponse.json({ ok: true });
}
