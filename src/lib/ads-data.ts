// ── Mock data for Pinterest Ads platform ────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  status: "active" | "paused" | "ended" | "draft";
  dailyBudget: number;
  totalSpend: number;
  impressions: number;
  clicks: number;
  saves: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  startDate: string;
}

export interface CreativeAd {
  id: string;
  campaignId: string;
  title: string;
  format: "standard" | "video" | "carousel" | "idea";
  emoji: string;
  impressions: number;
  clicks: number;
  ctr: number;
  saves: number;
  conversions: number;
  fatigue: "none" | "low" | "medium" | "high";
  status: "active" | "paused";
}

export interface AudienceSegment {
  id: string;
  name: string;
  size: number;
  type: "interest" | "keyword" | "lookalike" | "retargeting" | "demographic";
  ctr: number;
  convRate: number;
  spend: number;
}

export interface KeywordPlan {
  keyword: string;
  volume: number;
  competition: "low" | "medium" | "high";
  suggestedBid: number;
  difficulty: number;
  type: "exact" | "phrase" | "broad";
  negative?: boolean;
}

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "c1", name: "Summer Home Collection", objective: "conversions",
    status: "active", dailyBudget: 75, totalSpend: 2340, impressions: 1240000,
    clicks: 28400, saves: 9200, conversions: 412, revenue: 18540,
    ctr: 2.29, cpc: 0.82, cpm: 1.89, roas: 7.92, startDate: "2026-05-01",
  },
  {
    id: "c2", name: "Brand Awareness Q2", objective: "awareness",
    status: "active", dailyBudget: 50, totalSpend: 1200, impressions: 2100000,
    clicks: 18900, saves: 4200, conversions: 89, revenue: 2400,
    ctr: 0.90, cpc: 0.64, cpm: 0.57, roas: 2.00, startDate: "2026-04-15",
  },
  {
    id: "c3", name: "Spring Sale Traffic Drive", objective: "traffic",
    status: "paused", dailyBudget: 30, totalSpend: 640, impressions: 380000,
    clicks: 7200, saves: 1800, conversions: 54, revenue: 1890,
    ctr: 1.89, cpc: 0.89, cpm: 1.68, roas: 2.95, startDate: "2026-03-20",
  },
  {
    id: "c4", name: "Video Views — Bedroom Guide", objective: "video_views",
    status: "active", dailyBudget: 40, totalSpend: 890, impressions: 920000,
    clicks: 11200, saves: 6800, conversions: 190, revenue: 5700,
    ctr: 1.22, cpc: 0.79, cpm: 0.97, roas: 6.40, startDate: "2026-05-10",
  },
];

export const MOCK_CREATIVES: CreativeAd[] = [
  { id: "a1", campaignId: "c1", title: "Summer Home Refresh Ideas", format: "carousel", emoji: "🏠", impressions: 480000, clicks: 12400, ctr: 2.58, saves: 4200, conversions: 180, fatigue: "none", status: "active" },
  { id: "a2", campaignId: "c1", title: "Cozy Living Room Makeover", format: "standard", emoji: "🛋️", impressions: 320000, clicks: 7800, ctr: 2.44, saves: 2800, conversions: 142, fatigue: "low", status: "active" },
  { id: "a3", campaignId: "c1", title: "Budget Home Decor Finds", format: "video", emoji: "🎬", impressions: 440000, clicks: 8200, ctr: 1.86, saves: 2200, conversions: 90, fatigue: "high", status: "active" },
  { id: "a4", campaignId: "c2", title: "Brand Story — Our Mission", format: "idea", emoji: "✨", impressions: 910000, clicks: 8400, ctr: 0.92, saves: 1900, conversions: 41, fatigue: "none", status: "active" },
  { id: "a5", campaignId: "c2", title: "Behind the Scenes", format: "video", emoji: "📸", impressions: 1190000, clicks: 10500, ctr: 0.88, saves: 2300, conversions: 48, fatigue: "medium", status: "active" },
  { id: "a6", campaignId: "c3", title: "Shop the Spring Edit", format: "carousel", emoji: "🌸", impressions: 380000, clicks: 7200, ctr: 1.89, saves: 1800, conversions: 54, fatigue: "none", status: "paused" },
];

export const MOCK_AUDIENCES: AudienceSegment[] = [
  { id: "aud1", name: "Home Decor Enthusiasts", size: 4200000, type: "interest", ctr: 2.8, convRate: 1.9, spend: 890 },
  { id: "aud2", name: "Women 25-34 USA", size: 8100000, type: "demographic", ctr: 2.1, convRate: 2.4, spend: 640 },
  { id: "aud3", name: "Website Visitors (30d)", size: 24000, type: "retargeting", ctr: 4.2, convRate: 5.8, spend: 320 },
  { id: "aud4", name: "Lookalike — Top Buyers", size: 2100000, type: "lookalike", ctr: 3.1, convRate: 3.2, spend: 480 },
  { id: "aud5", name: "Interior Design Keyword", size: 1800000, type: "keyword", ctr: 2.4, convRate: 1.7, spend: 210 },
  { id: "aud6", name: "DIY & Crafts Fans", size: 3400000, type: "interest", ctr: 1.6, convRate: 1.1, spend: 140 },
];

export const KEYWORD_PLAN: KeywordPlan[] = [
  { keyword: "home decor ideas", volume: 2400000, competition: "high", suggestedBid: 1.20, difficulty: 78, type: "exact" },
  { keyword: "minimalist bedroom", volume: 1200000, competition: "medium", suggestedBid: 0.85, difficulty: 54, type: "exact" },
  { keyword: "living room decor", volume: 1800000, competition: "high", suggestedBid: 1.05, difficulty: 71, type: "phrase" },
  { keyword: "home decor on a budget", volume: 680000, competition: "low", suggestedBid: 0.45, difficulty: 32, type: "phrase" },
  { keyword: "cozy home aesthetic", volume: 420000, competition: "low", suggestedBid: 0.38, difficulty: 28, type: "broad" },
  { keyword: "room makeover ideas", volume: 890000, competition: "medium", suggestedBid: 0.72, difficulty: 48, type: "phrase" },
  { keyword: "home decor inspiration", volume: 1600000, competition: "high", suggestedBid: 0.98, difficulty: 65, type: "broad" },
  { keyword: "cheap home decor", volume: 540000, competition: "low", suggestedBid: 0.41, difficulty: 30, type: "phrase" },
  { keyword: "home decor 2024", volume: 780000, competition: "medium", suggestedBid: 0.68, difficulty: 44, type: "exact" },
  { keyword: "boho home decor", volume: 920000, competition: "medium", suggestedBid: 0.76, difficulty: 52, type: "broad" },
  { keyword: "clearance", volume: 0, competition: "low", suggestedBid: 0, difficulty: 0, type: "exact", negative: true },
  { keyword: "free", volume: 0, competition: "low", suggestedBid: 0, difficulty: 0, type: "exact", negative: true },
  { keyword: "diy tutorial only", volume: 0, competition: "low", suggestedBid: 0, difficulty: 0, type: "phrase", negative: true },
];

export const FUNNEL_DATA = [
  { stage: "Impressions", value: 4640000, icon: "👁️", color: "bg-blue-500", pct: 100 },
  { stage: "Clicks", value: 65700, icon: "🖱️", color: "bg-purple-500", pct: 1.42 },
  { stage: "Landing Page Views", value: 51200, icon: "📄", color: "bg-orange-500", pct: 77.9 },
  { stage: "Add to Cart", value: 8400, icon: "🛒", color: "bg-yellow-500", pct: 16.4 },
  { stage: "Conversions", value: 745, icon: "🎯", color: "bg-green-500", pct: 8.87 },
  { stage: "Revenue", value: 28530, icon: "💰", color: "bg-emerald-600", pct: null as unknown as number },
];

export const AI_INSIGHTS = [
  { type: "warning", icon: "⚠️", message: "CTR on Campaign 'Spring Sale Traffic Drive' is 34% below account average. Consider refreshing creatives.", action: "View Campaign" },
  { type: "success", icon: "🌟", message: "Women aged 25–34 generate 60% of conversions. Increase budget allocation for this segment.", action: "Adjust Budget" },
  { type: "info", icon: "🎬", message: "Video Pins outperform static Pins by 2.4× in your account. Launch more video ads.", action: "Create Video Ad" },
  { type: "warning", icon: "🔥", message: "Creative 'Budget Home Decor Finds' has high creative fatigue. Engagement dropped 40% in 7 days.", action: "Replace Creative" },
  { type: "success", icon: "📈", message: "ROAS on 'Summer Home Collection' is 7.9×. This campaign is ready to scale — increase daily budget.", action: "Scale Campaign" },
  { type: "info", icon: "🎯", message: "Retargeting audience (Website Visitors 30d) has a 5.8% conversion rate. Expand this with a lookalike.", action: "Create Lookalike" },
];

export const OPTIMIZATION_RECOMMENDATIONS = [
  { id: "opt1", priority: "high", category: "Budget", title: "Shift 30% budget from Campaign B to Campaign A", impact: "+$2,400 est. monthly revenue", effort: "Low", details: "Campaign A (Summer Home) has 7.9× ROAS vs Campaign B's 2.0×. Reallocating $15/day would maximise returns." },
  { id: "opt2", priority: "high", category: "Creative", title: "Replace Creative #3 — high fatigue detected", impact: "+18% CTR estimate", effort: "Medium", details: "'Budget Home Decor Finds' has seen a 40% drop in engagement over 7 days. Refresh with a new image or video." },
  { id: "opt3", priority: "medium", category: "Keywords", title: "Add 8 high-intent long-tail keywords", impact: "+340 est. monthly clicks", effort: "Low", details: "Keywords like 'minimalist bedroom on a budget' and 'cozy living room ideas 2025' show low competition and growing volume." },
  { id: "opt4", priority: "medium", category: "Audience", title: "Expand retargeting with lookalike audience", impact: "+1.2M reach", effort: "Low", details: "Your top-buyer retargeting segment converts at 5.8%. A 1% lookalike from this list could reach 2.1M similar users." },
  { id: "opt5", priority: "low", category: "Bid", title: "Reduce bids on broad keywords by 12%", impact: "-$180 monthly waste", effort: "Low", details: "Broad match keywords are generating 23% of spend but only 8% of conversions. Reducing bids cuts waste." },
  { id: "opt6", priority: "medium", category: "Keywords", title: "Pause 3 underperforming keywords", impact: "-$240 wasted spend", effort: "Low", details: "'home accessories online', 'cheap room ideas diy', and 'wall art prints buy' have 0 conversions after 800 impressions each." },
];

export const AUTOMATED_RULES = [
  { id: "r1", name: "Pause low CTR ads", condition: "CTR < 0.5%", action: "Pause Ad", frequency: "Daily", status: "active" },
  { id: "r2", name: "Scale high ROAS", condition: "ROAS > 4× for 3 days", action: "Increase budget by 20%", frequency: "Daily", status: "active" },
  { id: "r3", name: "CPC spike alert", condition: "CPC rises by 20%", action: "Send alert email", frequency: "Hourly", status: "active" },
  { id: "r4", name: "No conversion pause", condition: "0 conversions after 1,000 impressions", action: "Pause Ad", frequency: "Daily", status: "paused" },
];

export const TREND_DATA = [
  { keyword: "quiet luxury home", change: 142, category: "Home Decor", peak: "Aug–Oct" },
  { keyword: "japandi bedroom", change: 98, category: "Home Decor", peak: "Year-round" },
  { keyword: "coquette aesthetic", change: 87, category: "Fashion", peak: "Spring/Summer" },
  { keyword: "cottage core decor", change: 74, category: "Gardening", peak: "Spring" },
  { keyword: "clean girl makeup", change: 68, category: "Beauty", peak: "Year-round" },
  { keyword: "dark academia outfit", change: 62, category: "Fashion", peak: "Fall/Winter" },
  { keyword: "healthy girl dinner", change: 58, category: "Food", peak: "Jan, Sep" },
  { keyword: "pilates girl aesthetic", change: 51, category: "Health", peak: "Jan, Sep" },
];

export const SEASONAL_CALENDAR = [
  { month: "Jan", opportunity: "New Year reset, fitness, organisation, healthy eating", score: 82 },
  { month: "Feb", opportunity: "Valentine's Day gifts, romantic home decor, date ideas", score: 78 },
  { month: "Mar", opportunity: "Spring decor, gardening, St Patrick's Day, Easter prep", score: 71 },
  { month: "Apr", opportunity: "Easter, spring fashion, outdoor living, travel planning", score: 74 },
  { month: "May", opportunity: "Mother's Day gifts, summer prep, outdoor entertaining", score: 80 },
  { month: "Jun", opportunity: "Summer fashion, beach decor, Father's Day, weddings", score: 76 },
  { month: "Jul", opportunity: "Summer sales, 4th of July, back-to-school early", score: 68 },
  { month: "Aug", opportunity: "Back to school, autumn preview, home office setups", score: 72 },
  { month: "Sep", opportunity: "Fall decor, cozy aesthetic, Halloween prep, fitness", score: 85 },
  { month: "Oct", opportunity: "Halloween, fall fashion, Thanksgiving prep, holiday gifting", score: 88 },
  { month: "Nov", opportunity: "Black Friday, Thanksgiving, holiday gifting, Christmas decor", score: 95 },
  { month: "Dec", opportunity: "Christmas, New Year prep, cozy winter, gift guides", score: 92 },
];

export const OPPORTUNITY_SCORE = {
  overall: 74,
  budget: 82,
  creative: 58,
  audience: 79,
  conversion: 71,
  breakdown: [
    { label: "Budget Efficiency", score: 82, status: "good" },
    { label: "Creative Performance", score: 58, status: "needs_work" },
    { label: "Audience Quality", score: 79, status: "good" },
    { label: "Keyword Coverage", score: 68, status: "fair" },
    { label: "Conversion Optimisation", score: 71, status: "fair" },
  ],
};
