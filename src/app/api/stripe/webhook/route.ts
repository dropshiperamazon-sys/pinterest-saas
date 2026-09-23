import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const resend = new Resend(process.env.RESEND_API_KEY!);

const PLAN_NAMES: Record<string, string> = {
  pro: "Rambforce Pro",
  enterprise: "Rambforce Enterprise",
};

async function sendSubscriptionConfirmation(
  email: string,
  userName: string,
  plan: string,
  nextPaymentDate: Date
) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://app.rambforce.com";
  const planName = PLAN_NAMES[plan] ?? plan;
  const nextDate = nextPaymentDate.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "noreply@rambforce.com",
    to: email,
    subject: `You're subscribed to ${planName}!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <img src="${baseUrl}/rambforce-logo.png" alt="Rambforce" style="height:80px;width:auto;margin-bottom:24px;display:block;" />
        <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px;">Subscription confirmed! 🎉</h2>
        <p style="color:#555;font-size:14px;margin-bottom:24px;">Hi ${userName || "there"}, thank you for subscribing. Your <strong>${planName}</strong> plan is now active.</p>

        <div style="background:#f9f9f9;border:1px solid #eee;border-radius:10px;padding:20px;margin-bottom:24px;">
          <table style="width:100%;font-size:14px;color:#333;">
            <tr>
              <td style="padding:6px 0;color:#888;">Plan</td>
              <td style="padding:6px 0;font-weight:600;text-align:right;">${planName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#888;">Next payment date</td>
              <td style="padding:6px 0;font-weight:600;text-align:right;">${nextDate}</td>
            </tr>
          </table>
        </div>

        <a href="${baseUrl}/dashboard" style="display:inline-block;background:#e60023;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;">Go to Dashboard</a>

        <p style="color:#aaa;font-size:12px;margin-top:24px;">
          You can manage or cancel your subscription anytime from your account settings.<br/>
          If you have any questions, reply to this email.
        </p>
      </div>
    `,
  });
}

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

    if (plan !== "free") {
      const raw = await redis.get<string>(`user:${email}`);
      const user = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
      // current_period_end moved in newer Stripe API versions — fall back to billing_cycle_anchor or +30 days
      const subAny = sub as Record<string, unknown>;
      const periodEnd = typeof subAny.current_period_end === "number"
        ? new Date(subAny.current_period_end * 1000)
        : typeof sub.billing_cycle_anchor === "number"
          ? new Date((sub.billing_cycle_anchor + 30 * 24 * 3600) * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sendSubscriptionConfirmation(email, user.name ?? "", plan, periodEnd);
    }
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
