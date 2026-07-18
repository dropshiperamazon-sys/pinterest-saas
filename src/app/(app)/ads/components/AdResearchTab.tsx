"use client";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Search, ExternalLink, BookmarkPlus, Trash2, Tag,
  AlertCircle, CheckCircle2, Globe, Hash, Star,
  ChevronRight, Bookmark, Eye, Info, Filter, X,
} from "lucide-react";

const STORAGE_KEY = "mypinpro_saved_ads";

interface SavedAd {
  id: string;
  keyword: string;
  brand: string;
  title: string;
  description: string;
  imageUrl: string;
  adUrl: string;
  notes: string;
  savedAt: string;
  tags: string[];
}

const NICHES = [
  "Home Decor", "Fashion", "Beauty", "Food & Recipes", "Fitness",
  "Travel", "DIY & Crafts", "Weddings", "Parenting", "Finance",
  "Technology", "Gardening", "Education", "Pets", "Health",
];

const SEARCH_TIPS = [
  { icon: "🎯", tip: "Search your exact niche keyword (e.g. 'minimalist bedroom')" },
  { icon: "🔍", tip: "Look for the 'Promoted' label — that marks a paid ad" },
  { icon: "📋", tip: "Note the headline, CTA text, and image style of top ads" },
  { icon: "💡", tip: "Check which brands appear repeatedly — they're spending consistently" },
  { icon: "📅", tip: "Filter by country to see geo-targeted campaigns" },
];

function EmptyAds() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <Bookmark className="w-8 h-8 text-gray-300" />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">No saved ads yet</h3>
      <p className="text-xs text-gray-400 max-w-xs">
        Search Pinterest Ads Library above, then manually save interesting ads you find using the form below.
      </p>
    </div>
  );
}

export default function AdResearchTab() {
  const [keyword, setKeyword] = useState("");
  const [section, setSection] = useState<"search" | "saved">("search");

  // Saved ads state
  const [savedAds, setSavedAds] = useState<SavedAd[]>([]);
  const [filterKw, setFilterKw] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<SavedAd, "id" | "savedAt">>({
    keyword: "", brand: "", title: "", description: "",
    imageUrl: "", adUrl: "", notes: "", tags: [],
  });
  const [tagInput, setTagInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedAds(JSON.parse(raw));
    } catch {}
  }, []);

  function persist(ads: SavedAd[]) {
    setSavedAds(ads);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ads)); } catch {}
  }

  function openLibrary() {
    const q = keyword.trim();
    const url = q
      ? `https://www.pinterest.com/ads/library/?q=${encodeURIComponent(q)}`
      : "https://www.pinterest.com/ads/library/";
    window.open(url, "_blank", "noopener noreferrer");
  }

  function openPinterestSearch() {
    const q = keyword.trim();
    if (!q) return;
    window.open(`https://pinterest.com/search/pins/?q=${encodeURIComponent(q)}`, "_blank", "noopener noreferrer");
  }

  function resetForm() {
    setForm({ keyword: "", brand: "", title: "", description: "", imageUrl: "", adUrl: "", notes: "", tags: [] });
    setTagInput("");
    setEditingId(null);
    setShowForm(false);
  }

  function saveAd() {
    if (!form.title.trim() && !form.brand.trim()) return;
    if (editingId) {
      persist(savedAds.map(a => a.id === editingId ? { ...form, id: editingId, savedAt: a.savedAt } : a));
    } else {
      const newAd: SavedAd = { ...form, id: Date.now().toString(), savedAt: new Date().toISOString() };
      persist([newAd, ...savedAds]);
    }
    resetForm();
  }

  function deleteAd(id: string) {
    persist(savedAds.filter(a => a.id !== id));
  }

  function startEdit(ad: SavedAd) {
    setForm({ keyword: ad.keyword, brand: ad.brand, title: ad.title, description: ad.description, imageUrl: ad.imageUrl, adUrl: ad.adUrl, notes: ad.notes, tags: ad.tags });
    setEditingId(ad.id);
    setShowForm(true);
    setSection("saved");
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput("");
  }

  function removeTag(t: string) {
    setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));
  }

  const filtered = savedAds.filter(a =>
    !filterKw ||
    a.keyword.toLowerCase().includes(filterKw.toLowerCase()) ||
    a.brand.toLowerCase().includes(filterKw.toLowerCase()) ||
    a.title.toLowerCase().includes(filterKw.toLowerCase()) ||
    a.tags.some(t => t.toLowerCase().includes(filterKw.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      {/* Section switcher */}
      <div className="flex bg-gray-100 rounded-2xl p-1 w-fit gap-1">
        {([
          { key: "search", label: "Ads Library Search", icon: Search },
          { key: "saved", label: `Saved Ads${savedAds.length ? ` (${savedAds.length})` : ""}`, icon: Bookmark },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
              section === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── SEARCH SECTION ── */}
      {section === "search" && (
        <div className="space-y-5">
          {/* Legal notice */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700">
              <strong>How this works:</strong> We link directly to Pinterest&apos;s official <strong>Ads Transparency Library</strong> — a free, public tool where any advertiser&apos;s active ads can be legally viewed. Search a keyword, browse real running ads on Pinterest, then save the best ones below for reference.
            </div>
          </div>

          {/* Search card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Search Pinterest Ads Library</h3>
              <p className="text-sm text-gray-500">Enter a keyword to open Pinterest&apos;s official Ads Transparency Library with your search pre-filled.</p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && openLibrary()}
                  placeholder="e.g. home decor, minimalist bedroom, skincare..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                />
              </div>
              <button
                onClick={openLibrary}
                className="flex items-center gap-2 bg-[#e60023] text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                Open Ads Library
              </button>
              <button
                onClick={openPinterestSearch}
                disabled={!keyword.trim()}
                className="flex items-center gap-2 bg-gray-800 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors whitespace-nowrap disabled:opacity-40"
                title="Search Pinterest and look for 'Promoted' pins"
              >
                <Globe className="w-4 h-4" />
                Pinterest Search
              </button>
            </div>

            {/* Quick niche buttons */}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium">Quick niches:</p>
              <div className="flex flex-wrap gap-1.5">
                {NICHES.map(n => (
                  <button
                    key={n}
                    onClick={() => setKeyword(n)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                      keyword === n
                        ? "bg-[#e60023] text-white border-[#e60023]"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#e60023]/40 hover:text-[#e60023]"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Where to find ads */}
          <div className="grid grid-cols-2 gap-5">
            {/* Official Ads Library */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#e60023]/10 rounded-xl flex items-center justify-center">
                  <Eye className="w-4 h-4 text-[#e60023]" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Pinterest Ads Library</h4>
                  <p className="text-xs text-gray-400">Official transparency tool</p>
                </div>
                <a
                  href="https://www.pinterest.com/ads/library/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-xs text-[#e60023] font-medium hover:underline"
                >
                  Open <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ul className="space-y-2">
                {[
                  "Search by keyword or advertiser name",
                  "Filter by country",
                  "View all currently running ads",
                  "See ad creative, headline & CTA",
                  "100% legal — Pinterest's own tool",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pinterest Search */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Search className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Pinterest Search</h4>
                  <p className="text-xs text-gray-400">Find promoted pins manually</p>
                </div>
                <a
                  href="https://pinterest.com/search/pins/?q=home+decor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-xs text-gray-500 font-medium hover:underline"
                >
                  Open <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ul className="space-y-2">
                {[
                  "Search any keyword on Pinterest",
                  "Ads are marked with 'Promoted' label",
                  "See real ads shown to real users",
                  "Observe format, image style & copy",
                  "Save the ad URL to track below",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Research tips */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Competitive Research Tips
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {SEARCH_TIPS.map(({ icon, tip }) => (
                <div key={tip} className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-lg flex-shrink-0">{icon}</span>
                  <span className="text-xs text-gray-700">{tip}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-800">
                Found a great ad? Switch to <strong>Saved Ads</strong> tab and log it for future reference — track competitor copy, creative style, and CTA patterns over time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SAVED ADS SECTION ── */}
      {section === "saved" && (
        <div className="space-y-5">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={filterKw}
                onChange={e => setFilterKw(e.target.value)}
                placeholder="Filter by keyword, brand, or tag…"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
              />
            </div>
            <button
              onClick={() => { setShowForm(v => !v); setEditingId(null); if (!showForm) setForm({ keyword:"",brand:"",title:"",description:"",imageUrl:"",adUrl:"",notes:"",tags:[] }); }}
              className="flex items-center gap-2 bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors"
            >
              <BookmarkPlus className="w-4 h-4" />
              Save Ad
            </button>
          </div>

          {/* Add / Edit form */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-[#e60023]/20 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-gray-900">{editingId ? "Edit saved ad" : "Save a competitor ad"}</h4>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-gray-400">Copy details from the Pinterest Ads Library or a promoted pin you spotted.</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Keyword / Niche</label>
                  <input value={form.keyword} onChange={e => setForm(f => ({...f, keyword: e.target.value}))} placeholder="e.g. home decor" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Brand / Advertiser</label>
                  <input value={form.brand} onChange={e => setForm(f => ({...f, brand: e.target.value}))} placeholder="e.g. IKEA" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Ad Headline / Title</label>
                  <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="The ad's headline or pin title" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Ad Description / Copy</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} placeholder="The ad body text or description" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] resize-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Ad / Pin URL</label>
                  <input value={form.adUrl} onChange={e => setForm(f => ({...f, adUrl: e.target.value}))} placeholder="https://pinterest.com/pin/..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Image URL <span className="text-gray-400">(optional)</span></label>
                  <input value={form.imageUrl} onChange={e => setForm(f => ({...f, imageUrl: e.target.value}))} placeholder="https://i.pinimg.com/..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Notes / Observations</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} placeholder="What makes this ad effective? CTA used, image style, angle..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] resize-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Tags</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      placeholder="Type a tag and press Enter"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                    />
                    <button onClick={addTag} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 font-medium">Add</button>
                  </div>
                  {form.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.tags.map(t => (
                        <span key={t} className="flex items-center gap-1 bg-[#e60023]/10 text-[#e60023] text-xs px-2.5 py-1 rounded-full font-medium">
                          <Hash className="w-2.5 h-2.5" />{t}
                          <button onClick={() => removeTag(t)} className="ml-0.5 hover:text-red-700"><X className="w-2.5 h-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={saveAd}
                  disabled={!form.title.trim() && !form.brand.trim()}
                  className="flex items-center gap-2 bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors disabled:opacity-40"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  {editingId ? "Update Ad" : "Save Ad"}
                </button>
                <button onClick={resetForm} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 font-medium">Cancel</button>
              </div>
            </div>
          )}

          {/* Saved ads grid */}
          {savedAds.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <EmptyAds />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 text-center">
              <p className="text-sm text-gray-400">No ads match your filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map(ad => (
                <div key={ad.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group">
                  <div className="flex gap-0">
                    {/* Image */}
                    <div className="w-24 flex-shrink-0 bg-gray-100 relative">
                      {ad.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" style={{ minHeight: "120px" }} />
                      ) : (
                        <div className="flex items-center justify-center h-full min-h-[120px] bg-gradient-to-br from-gray-100 to-gray-200">
                          <Tag className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-white/90 text-[#e60023] text-[9px] font-bold px-1.5 py-0.5 rounded">
                        AD
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0">
                          {ad.brand && <p className="text-[10px] font-bold text-[#e60023] uppercase tracking-wide truncate">{ad.brand}</p>}
                          <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{ad.title || <span className="text-gray-400 italic">No title</span>}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {ad.adUrl && (
                            <a href={ad.adUrl} target="_blank" rel="noopener noreferrer" title="Open ad on Pinterest" className="p-1 text-gray-300 hover:text-[#e60023] transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button onClick={() => startEdit(ad)} className="p-1 text-gray-300 hover:text-blue-500 transition-colors" title="Edit">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteAd(ad.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {ad.description && (
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{ad.description}</p>
                      )}

                      {ad.notes && (
                        <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-2.5 py-1.5 mb-2">
                          <p className="text-xs text-yellow-800 line-clamp-2">{ad.notes}</p>
                        </div>
                      )}

                      <div className="flex items-center flex-wrap gap-1.5">
                        {ad.keyword && (
                          <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            <Search className="w-2.5 h-2.5" />{ad.keyword}
                          </span>
                        )}
                        {ad.tags.map(t => (
                          <span key={t} className="flex items-center gap-0.5 text-[10px] bg-[#e60023]/10 text-[#e60023] px-2 py-0.5 rounded-full font-medium">
                            <Hash className="w-2.5 h-2.5" />{t}
                          </span>
                        ))}
                        <span className="ml-auto text-[10px] text-gray-300 flex-shrink-0">
                          {new Date(ad.savedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {savedAds.length > 0 && (
            <p className="text-xs text-gray-400 text-center">
              {filtered.length} of {savedAds.length} saved ads · Stored locally in your browser
            </p>
          )}
        </div>
      )}
    </div>
  );
}
