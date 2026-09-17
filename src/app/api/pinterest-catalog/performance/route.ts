import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";
import { getActivePinterestToken } from "@/lib/pinterest-token";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";

// ─── Rambforce Scoring Configuration ────────────────────────────────────────
// These thresholds drive only MY PIN PRO's internal "Catalog Opportunity" score.
// They are NOT Pinterest scores. NOT presented as Pinterest recommendations.
// All values are per the selected date period.
export const SCORING_CONFIG = {
  // Paid: checkouts in period to reach each tier
  checkoutsStrong: 20,
  checkoutsGood: 5,
  // Paid: add-to-cart volume
  addToCartGood: 10,
  // Paid: cart-to-checkout ratio below this signals funnel problem
  cartToCheckoutLowThreshold: 0.15,
  // Paid: outbound click-through rate (outbound/impression) % considered healthy
  paidCtrGoodPct: 0.8,
  // Organic: account-level outbound clicks to indicate good engagement
  organicOutboundGood: 200,
  // Minimum impressions before data is considered meaningful
  minMeaningfulImpressions: 500,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function pGet(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  console.log(`[catalog-perf] ${path} → ${res.status}`, text.slice(0, 200));
  if (!res.ok) return { _error: res.status, _body: text };
  try { return JSON.parse(text); } catch { return null; }
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function n(v: unknown): number | null {
  const x = Number(v);
  return isNaN(x) || x === 0 ? null : x;
}

function nz(v: unknown): number | null {
  // like n() but returns null only for NaN/undefined, keeps explicit zero
  const x = Number(v);
  return isNaN(x) ? null : x;
}

// ─── Organic metric extraction from /user_account/analytics response ─────────
function extractOrganic(data: Record<string, unknown> | null, metric: string): number | null {
  if (!data || (data as { _error?: unknown })._error) return null;
  // Shape A: { all: { summary_metrics: {METRIC: val} } }
  const sm = ((data as Record<string, Record<string, Record<string, unknown>>>).all?.summary_metrics) as Record<string, unknown> | undefined;
  if (sm && sm[metric] !== undefined) return nz(sm[metric]);
  // Shape B: array of daily rows
  if (Array.isArray(data)) {
    return (data as Record<string, unknown>[]).reduce((s, row) => {
      const m = (row.metrics ?? row) as Record<string, unknown>;
      return s + (Number(m[metric]) || 0);
    }, 0);
  }
  // Shape C: { all: { daily_metrics: [{metrics: {...}}] } }
  const daily = ((data as Record<string, Record<string, unknown[]>>).all?.daily_metrics) as Record<string, unknown>[] | undefined;
  if (Array.isArray(daily)) {
    return daily.reduce((s, row) => {
      const m = (row.metrics ?? row) as Record<string, unknown>;
      return s + (Number(m[metric]) || 0);
    }, 0);
  }
  return null;
}

// ─── Opportunity scorer (Rambforce — not a Pinterest score) ─────────────────
type OpportunityScore = "STRONG" | "GOOD" | "NEEDS_REVIEW" | "INSUFFICIENT_DATA";

function scoreCatalog(paid: {
  impressions: number | null; outboundClicks: number | null;
  checkouts: number | null; addToCart: number | null; spend: number | null;
}): { score: OpportunityScore; reasons: string[]; recommendation: string } {
  const reasons: string[] = [];
  const C = SCORING_CONFIG;

  if (paid.impressions == null && paid.checkouts == null) {
    return {
      score: "INSUFFICIENT_DATA",
      reasons: ["No paid analytics data available for this period"],
      recommendation: "Connect a Pinterest Shopping campaign targeting this catalog to see performance data.",
    };
  }

  let positives = 0;
  let negatives = 0;

  if ((paid.checkouts ?? 0) >= C.checkoutsStrong) { reasons.push("Strong checkout volume"); positives += 2; }
  else if ((paid.checkouts ?? 0) >= C.checkoutsGood) { reasons.push("Good checkout volume"); positives += 1; }
  else if (paid.checkouts !== null && paid.checkouts === 0) { reasons.push("Zero checkouts in period"); negatives += 1; }

  if ((paid.addToCart ?? 0) >= C.addToCartGood) { reasons.push("High add-to-cart volume"); positives += 1; }

  const ctr = paid.impressions && paid.outboundClicks
    ? (paid.outboundClicks / paid.impressions) * 100
    : null;
  if (ctr !== null && ctr >= C.paidCtrGoodPct) { reasons.push("Strong paid outbound CTR"); positives += 1; }
  else if (ctr !== null && ctr < 0.2 && (paid.impressions ?? 0) > C.minMeaningfulImpressions) {
    reasons.push("Low outbound CTR vs impressions"); negatives += 1;
  }

  if (paid.addToCart && paid.checkouts !== null) {
    const ratio = paid.checkouts / paid.addToCart;
    if (ratio < C.cartToCheckoutLowThreshold) { reasons.push("High cart abandonment rate"); negatives += 1; }
  }

  if (paid.spend && paid.checkouts && paid.spend > 0) {
    reasons.push("Active paid spend with conversions");
    positives += 1;
  }

  if (positives >= 3 || (positives >= 2 && negatives === 0)) {
    return {
      score: "STRONG",
      reasons,
      recommendation: "Consider increasing Shopping Ads exposure for this catalog.",
    };
  }
  if (positives >= 1 && negatives <= 1) {
    return {
      score: "GOOD",
      reasons,
      recommendation: "Consider testing this catalog/product group with Pinterest Shopping Ads.",
    };
  }
  if (negatives > positives) {
    return {
      score: "NEEDS_REVIEW",
      reasons,
      recommendation: "Review product pages, pricing, and checkout experience before increasing paid spend.",
    };
  }
  return {
    score: "INSUFFICIENT_DATA",
    reasons: reasons.length ? reasons : ["Insufficient conversion data to score"],
    recommendation: "Gather more data before making budget decisions. Consider a small test campaign.",
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const accessToken = await getActivePinterestToken(email);
  if (!accessToken) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });


  const { searchParams } = new URL(req.url);

  // Date range
  const preset = searchParams.get("range") ?? "30d";
  const customStart = searchParams.get("start");
  const customEnd = searchParams.get("end");
  let startDate: string, endDate: string;
  if (customStart && customEnd) {
    startDate = customStart;
    endDate = customEnd;
  } else {
    const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
    startDate = dateStr(days);
    endDate = dateStr(1); // yesterday (Pinterest analytics lag 1 day)
  }

  const source = (searchParams.get("source") ?? "ALL") as "ALL" | "ORGANIC" | "PAID";

  const errors: string[] = [];

  // ── Step 1: fetch catalogs (always needed) ────────────────────────────────
  const catalogsResp = await pGet("/catalogs?page_size=25", accessToken);
  const catalogs: { id: string; name: string; catalog_type: string }[] =
    catalogsResp?._error ? [] : (catalogsResp?.items ?? []);

  // ── Step 2: Organic analytics (account-level only) ────────────────────────
  // Pinterest does NOT provide organic analytics at catalog level.
  // We fetch account totals and top pins. Catalog-level organic metrics = null.
  const [organicCoreResp, organicOutboundResp, organicEngageResp, topPinsResp] =
    source !== "PAID"
      ? await Promise.all([
          pGet(`/user_account/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=IMPRESSION,PIN_CLICK,SAVE`, accessToken),
          pGet(`/user_account/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=OUTBOUND_CLICK`, accessToken),
          pGet(`/user_account/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=ENGAGEMENT`, accessToken),
          pGet(`/user_account/top_pins_analytics?start_date=${startDate}&end_date=${endDate}&sort_by=IMPRESSION&metric_types=ENGAGEMENT,IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE&num_of_pins=25`, accessToken),
        ])
      : [null, null, null, null];

  if (organicCoreResp?._error) errors.push(`Organic analytics: HTTP ${organicCoreResp._error}`);
  if (topPinsResp?._error) errors.push(`Top pins analytics: HTTP ${topPinsResp._error}`);

  const organicAccountTotals = (source !== "PAID" && !organicCoreResp?._error)
    ? {
        impressions:    extractOrganic(organicCoreResp, "IMPRESSION"),
        saves:          extractOrganic(organicCoreResp, "SAVE"),
        pinClicks:      extractOrganic(organicCoreResp, "PIN_CLICK"),
        outboundClicks: extractOrganic(organicOutboundResp, "OUTBOUND_CLICK"),
        engagement:     extractOrganic(organicEngageResp, "ENGAGEMENT"),
      }
    : null;

  // Top organic pins
  const rawTopPins = topPinsResp?._error ? [] : (topPinsResp?.pins ?? topPinsResp?.items ?? []) as Record<string, unknown>[];
  const topOrganicPins = rawTopPins.map((item) => {
    const pin = (item.pin ?? item) as Record<string, unknown>;
    const metrics = (item.metrics ?? {}) as Record<string, number>;
    const pinMedia = (pin.media as Record<string, unknown> | undefined) ?? {};
    const imgs = (pinMedia.images ?? pin.images ?? {}) as Record<string, { url?: string }>;
    return {
      id: String(pin.id ?? item.pin_id ?? ""),
      title: String(pin.title ?? pin.description ?? ""),
      imageUrl: imgs["150x150"]?.url ?? imgs["400x300"]?.url ?? "",
      link: String(pin.link ?? ""),
      impressions:    nz(metrics.IMPRESSION) ?? 0,
      saves:          nz(metrics.SAVE) ?? 0,
      pinClicks:      nz(metrics.PIN_CLICK) ?? 0,
      outboundClicks: nz(metrics.OUTBOUND_CLICK) ?? 0,
      engagement:     nz(metrics.ENGAGEMENT) ?? 0,
      checkouts:      null as null,    // Pinterest organic analytics do not include conversion metrics
      addToCart:      null as null,
      pageVisits:     null as null,
      source: "ORGANIC" as const,
    };
  });

  // ── Step 3: Paid analytics via Ad Account → Product Groups ────────────────
  let adAccountId: string | null = null;
  let adAccountName: string | null = null;
  const allAdProductGroups: Array<{
    id: string; name: string; catalogId: string | null; status: string;
  }> = [];
  const paidGroupMetrics: Record<string, {
    impressions: number | null; pinClicks: number | null; outboundClicks: number | null;
    engagement: number | null; saves: number | null; checkouts: number | null;
    addToCart: number | null; pageVisits: number | null; spend: number | null;
  }> = {};

  if (source !== "ORGANIC") {
    const adAccountsResp = await pGet("/ad_accounts?page_size=5", accessToken);
    if (!adAccountsResp?._error && adAccountsResp?.items?.length) {
      adAccountId   = String(adAccountsResp.items[0].id);
      adAccountName = String(adAccountsResp.items[0].name ?? adAccountId);

      // Fetch all product groups for this ad account
      const pgResp = await pGet(`/ad_accounts/${adAccountId}/product_groups?page_size=100`, accessToken);
      if (!pgResp?._error && Array.isArray(pgResp?.items)) {
        for (const pg of pgResp.items as Record<string, unknown>[]) {
          allAdProductGroups.push({
            id:        String(pg.id ?? ""),
            name:      String(pg.name ?? ""),
            catalogId: pg.catalog_id ? String(pg.catalog_id) : null,
            status:    String(pg.status ?? ""),
          });
        }
      } else if (pgResp?._error) {
        errors.push(`Ad product groups: HTTP ${pgResp._error}`);
      }

      // Fetch analytics for those product groups in one call
      if (allAdProductGroups.length > 0) {
        const pgIds = allAdProductGroups.map((g) => g.id).filter(Boolean).join(",");
        const pgAnalyticsResp = await pGet(
          `/ad_accounts/${adAccountId}/product_groups/analytics` +
          `?start_date=${startDate}&end_date=${endDate}` +
          `&product_group_ids=${pgIds}` +
          `&columns=SPEND_IN_DOLLAR,IMPRESSION_1,CLICK_1,TOTAL_SAVE,TOTAL_ENGAGEMENT,TOTAL_CHECKOUT,TOTAL_ADD_TO_CART,TOTAL_PAGE_VISIT` +
          `&granularity=TOTAL`,
          accessToken
        );

        if (!pgAnalyticsResp?._error) {
          const rows = Array.isArray(pgAnalyticsResp)
            ? pgAnalyticsResp as Record<string, unknown>[]
            : (pgAnalyticsResp?.data ?? pgAnalyticsResp?.items ?? []) as Record<string, unknown>[];

          for (const row of rows) {
            const pgId = String(row.PRODUCT_GROUP_ID ?? row.product_group_id ?? "");
            if (!pgId) continue;
            paidGroupMetrics[pgId] = {
              impressions:    n(row.IMPRESSION_1),
              pinClicks:      n(row.CLICK_1),
              outboundClicks: n(row.TOTAL_OUTBOUND_CLICK ?? row.OUTBOUND_CLICK),
              engagement:     n(row.TOTAL_ENGAGEMENT),
              saves:          n(row.TOTAL_SAVE),
              checkouts:      n(row.TOTAL_CHECKOUT),
              addToCart:      n(row.TOTAL_ADD_TO_CART),
              pageVisits:     n(row.TOTAL_PAGE_VISIT),
              spend:          n(row.SPEND_IN_DOLLAR),
            };
          }
        } else {
          errors.push(`Product group analytics: HTTP ${pgAnalyticsResp._error}`);
        }
      }
    } else if (adAccountsResp?._error) {
      errors.push(`Ad accounts: HTTP ${adAccountsResp._error} (paid data unavailable)`);
    } else {
      errors.push("No Pinterest ad accounts found — paid metrics unavailable");
    }
  }

  // ── Step 4: Aggregate paid metrics per catalog ────────────────────────────
  // Reliable because ad product groups have a catalog_id field.
  const paidByCatalog: Record<string, typeof paidGroupMetrics[string] & { groupCount: number }> = {};
  for (const pg of allAdProductGroups) {
    const cid = pg.catalogId;
    if (!cid) continue;
    const m = paidGroupMetrics[pg.id];
    if (!m) continue;
    if (!paidByCatalog[cid]) {
      paidByCatalog[cid] = {
        impressions: null, pinClicks: null, outboundClicks: null,
        engagement: null, saves: null, checkouts: null,
        addToCart: null, pageVisits: null, spend: null, groupCount: 0,
      };
    }
    const acc = paidByCatalog[cid];
    acc.groupCount += 1;
    // Aggregate with null-aware addition (null + n = n, null + null = null)
    function addNullable(a: number | null, b: number | null): number | null {
      if (a === null && b === null) return null;
      return (a ?? 0) + (b ?? 0);
    }
    acc.impressions    = addNullable(acc.impressions,    m.impressions);
    acc.pinClicks      = addNullable(acc.pinClicks,      m.pinClicks);
    acc.outboundClicks = addNullable(acc.outboundClicks, m.outboundClicks);
    acc.engagement     = addNullable(acc.engagement,     m.engagement);
    acc.saves          = addNullable(acc.saves,          m.saves);
    acc.checkouts      = addNullable(acc.checkouts,      m.checkouts);
    acc.addToCart      = addNullable(acc.addToCart,      m.addToCart);
    acc.pageVisits     = addNullable(acc.pageVisits,     m.pageVisits);
    acc.spend          = addNullable(acc.spend,          m.spend);
  }

  // ── Step 5: Build catalog list with scores ────────────────────────────────
  const catalogNameMap = new Map(catalogs.map((c) => [c.id, c.name]));
  const catalogOutput = catalogs.map((cat) => {
    const paid = paidByCatalog[cat.id] ?? null;
    const { score, reasons, recommendation } = scoreCatalog(
      paid ?? { impressions: null, outboundClicks: null, checkouts: null, addToCart: null, spend: null }
    );

    // Product groups for this catalog used in ads
    const catAdGroups = allAdProductGroups
      .filter((g) => g.catalogId === cat.id)
      .map((g) => ({
        id: g.id,
        name: g.name,
        status: g.status,
        ...paidGroupMetrics[g.id],
      }));

    // Best group for "Promote with Ads" = highest checkouts, then spend
    const bestGroup = catAdGroups
      .slice()
      .sort((a, b) => ((b.checkouts ?? 0) - (a.checkouts ?? 0)) || ((b.spend ?? 0) - (a.spend ?? 0)))[0] ?? null;

    return {
      id: cat.id,
      name: cat.name,
      catalogType: cat.catalog_type,
      // Organic: catalog-level metrics NOT available from Pinterest API
      organicNote: "Pinterest does not provide organic analytics at catalog level. Account-level organic totals are shown separately.",
      // Paid: aggregated from ad product groups
      paid: paid
        ? {
            impressions:    paid.impressions,
            pinClicks:      paid.pinClicks,
            outboundClicks: paid.outboundClicks,
            engagement:     paid.engagement,
            saves:          paid.saves,
            checkouts:      paid.checkouts,
            addToCart:      paid.addToCart,
            pageVisits:     paid.pageVisits,
            spend:          paid.spend,
            // ROAS: only if we have checkout value — Pinterest returns spend and conversion qty,
            // but not conversion value in product_groups/analytics in all API versions
            roas:           null as null,
            groupCount:     paid.groupCount,
          }
        : null,
      opportunityScore: score,
      opportunityReasons: reasons,
      recommendation,
      bestAdProductGroupId: bestGroup?.id ?? null,
      adAccountId,
      adProductGroups: catAdGroups,
    };
  });

  // ── Step 6: Top paid product groups ──────────────────────────────────────
  const topPaidProductGroups = allAdProductGroups
    .map((pg) => ({
      id: pg.id,
      name: pg.name,
      catalogId:   pg.catalogId,
      catalogName: pg.catalogId ? (catalogNameMap.get(pg.catalogId) ?? null) : null,
      status: pg.status,
      ...(paidGroupMetrics[pg.id] ?? {
        impressions: null, pinClicks: null, outboundClicks: null,
        engagement: null, saves: null, checkouts: null,
        addToCart: null, pageVisits: null, spend: null,
      }),
      source: "PAID" as const,
    }))
    .filter((g) => g.impressions !== null || g.checkouts !== null)
    .sort((a, b) => ((b.checkouts ?? 0) - (a.checkouts ?? 0)) || ((b.impressions ?? 0) - (a.impressions ?? 0)))
    .slice(0, 25);

  // ── Step 7: Shopping Ads Opportunities (Rambforce recommendations) ────────
  // Based solely on available data; clearly labeled as Rambforce analysis.
  const opportunities: Array<{
    type: "ORGANIC_PIN" | "PAID_CATALOG";
    id: string; name: string; imageUrl: string;
    strength: "STRONG" | "GOOD" | "POTENTIAL";
    signals: string[]; recommendation: string;
    adProductGroupId: string | null; adAccountId: string | null;
  }> = [];

  // Organic opportunity: top pins with strong outbound clicks
  for (const pin of topOrganicPins.slice(0, 10)) {
    if (pin.outboundClicks >= 50 || pin.saves >= 100) {
      const strength = pin.outboundClicks >= 200 || pin.saves >= 500 ? "STRONG"
        : pin.outboundClicks >= 50 ? "GOOD" : "POTENTIAL";
      const signals: string[] = [];
      if (pin.outboundClicks >= 50) signals.push(`${pin.outboundClicks.toLocaleString()} outbound clicks organically`);
      if (pin.saves >= 100)         signals.push(`${pin.saves.toLocaleString()} organic saves`);
      if (pin.impressions >= 10000) signals.push(`${(pin.impressions / 1000).toFixed(0)}K organic impressions`);
      opportunities.push({
        type: "ORGANIC_PIN",
        id: pin.id,
        name: pin.title || `Pin ${pin.id}`,
        imageUrl: pin.imageUrl,
        strength,
        signals,
        recommendation: strength === "STRONG"
          ? "Consider testing this product with Pinterest Shopping Ads — strong organic engagement signals."
          : "Potential opportunity for Shopping Ads. Verify product page quality before testing.",
        adProductGroupId: null,
        adAccountId,
      });
    }
  }

  // Paid opportunity: catalogs with strong scores
  for (const cat of catalogOutput) {
    if (cat.opportunityScore === "STRONG" || cat.opportunityScore === "GOOD") {
      opportunities.push({
        type: "PAID_CATALOG",
        id: cat.id,
        name: cat.name,
        imageUrl: "",
        strength: cat.opportunityScore === "STRONG" ? "STRONG" : "GOOD",
        signals: cat.opportunityReasons,
        recommendation: cat.recommendation,
        adProductGroupId: cat.bestAdProductGroupId,
        adAccountId,
      });
    }
  }

  return NextResponse.json({
    period: { startDate, endDate, range: preset },
    source,
    // Account-level organic totals (NOT catalog-level — Pinterest limitation)
    organicAccountTotals,
    organicNote: "Pinterest organic analytics are at the account level only. " +
      "Catalog-level organic breakdown is not available from the Pinterest API v5. " +
      "Shown as '—' per catalog. Use the Top Organic Pins section for pin-level detail.",
    catalogs: catalogOutput,
    topOrganicPins,
    topPaidProductGroups,
    opportunities: opportunities.slice(0, 10),
    _meta: {
      adAccountId,
      adAccountName,
      catalogsFound:        catalogs.length,
      adProductGroupsFound: allAdProductGroups.length,
      paidGroupsWithData:   Object.keys(paidGroupMetrics).length,
      errors,
    },
  });
}
