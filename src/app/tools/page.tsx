import Link from "next/link";
import {
  Image, FileText, Code2, Calculator, Zap, Lock, Palette,
  Type, ArrowLeftRight, Clock, Hash, AlignLeft, Binary,
  Braces, SlidersHorizontal, KeyRound, BookOpen,
} from "lucide-react";

const CATEGORIES = [
  {
    id: "image",
    title: "Image Tools",
    icon: Image,
    color: "from-pink-500 to-rose-500",
    bg: "bg-pink-50",
    iconColor: "text-pink-600",
    tools: [
      {
        href: "/tools/image-compressor",
        icon: SlidersHorizontal,
        title: "Image Compressor",
        desc: "Shrink JPG, PNG, WebP files right in your browser. No upload needed.",
        badge: "Popular",
      },
      {
        href: "/tools/image-resizer",
        icon: ArrowLeftRight,
        title: "Image Resizer",
        desc: "Resize images to exact pixel dimensions or by percentage.",
      },
    ],
  },
  {
    id: "text",
    title: "Text Tools",
    icon: FileText,
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    tools: [
      {
        href: "/tools/word-counter",
        icon: Hash,
        title: "Word & Character Counter",
        desc: "Count words, characters, sentences, paragraphs and reading time instantly.",
        badge: "Popular",
      },
      {
        href: "/tools/case-converter",
        icon: Type,
        title: "Case Converter",
        desc: "Switch between UPPER, lower, Title, camelCase, snake_case and more.",
      },
      {
        href: "/tools/reading-time",
        icon: Clock,
        title: "Reading Time Estimator",
        desc: "Paste any text and see how long it takes to read at different speeds.",
      },
      {
        href: "/tools/markdown-preview",
        icon: BookOpen,
        title: "Markdown Preview",
        desc: "Write Markdown on the left, see the rendered HTML preview on the right.",
      },
    ],
  },
  {
    id: "developer",
    title: "Developer Tools",
    icon: Code2,
    color: "from-violet-500 to-indigo-500",
    bg: "bg-violet-50",
    iconColor: "text-violet-600",
    tools: [
      {
        href: "/tools/base64",
        icon: Binary,
        title: "Base64 Encoder / Decoder",
        desc: "Encode or decode any text or URL to/from Base64 instantly.",
        badge: "Popular",
      },
      {
        href: "/tools/json-formatter",
        icon: Braces,
        title: "JSON Formatter & Validator",
        desc: "Paste messy JSON and get it beautifully formatted or minified.",
      },
      {
        href: "/tools/color-converter",
        icon: Palette,
        title: "Color Converter",
        desc: "Convert between HEX, RGB, HSL color formats with a live preview.",
      },
      {
        href: "/tools/password-generator",
        icon: KeyRound,
        title: "Password Generator",
        desc: "Generate strong, secure passwords with custom length and character sets.",
      },
    ],
  },
  {
    id: "calculator",
    title: "Calculators",
    icon: Calculator,
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-50",
    iconColor: "text-amber-600",
    tools: [
      {
        href: "/tools/age-calculator",
        icon: Calculator,
        title: "Age Calculator",
        desc: "Calculate exact age in years, months, weeks, and days from a birth date.",
      },
      {
        href: "/tools/percentage-calculator",
        icon: AlignLeft,
        title: "Percentage Calculator",
        desc: "Solve percentage problems: what is X% of Y, percentage change, and more.",
      },
    ],
  },
];

const FEATURES = [
  { icon: Lock, title: "100% Private", desc: "Nothing leaves your browser. No server uploads, ever." },
  { icon: Zap, title: "Instant Results", desc: "All tools run locally — zero latency, works offline." },
  { icon: Code2, title: "No Sign-up", desc: "Open a tool and start using it. No accounts required." },
];

export default function ToolsHomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            Free · Fast · Private
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-5 leading-tight">
            Developer &amp; Everyday <br className="hidden sm:block" />
            <span className="text-violet-200">Online Tools</span>
          </h1>
          <p className="text-lg text-indigo-100 max-w-2xl mx-auto mb-8">
            12+ powerful tools that work entirely in your browser. No uploads, no
            accounts, no ads — just tools that get the job done.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {["Image Compressor", "JSON Formatter", "Word Counter", "Password Generator", "Base64"].map(
              (t) => (
                <span
                  key={t}
                  className="bg-white/20 hover:bg-white/30 rounded-full px-4 py-1.5 text-sm font-medium cursor-default transition-colors"
                >
                  {t}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* Why DevToolKit */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200 p-6 flex gap-4 items-start shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
                <p className="text-sm text-slate-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tool Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-16">
        {CATEGORIES.map(({ id, title, icon: CatIcon, color, tools }) => (
          <div key={id} id={id}>
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm`}>
                <CatIcon className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {tools.map(({ href, icon: ToolIcon, title: toolTitle, desc, badge }) => (
                <Link
                  key={href}
                  href={href}
                  className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-violet-300 hover:shadow-md transition-all duration-200 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                      <ToolIcon className="w-5 h-5 text-white" />
                    </div>
                    {badge && (
                      <span className="text-xs font-semibold bg-violet-100 text-violet-700 rounded-full px-2.5 py-0.5">
                        {badge}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-violet-700 transition-colors">
                      {toolTitle}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                  <div className="mt-auto pt-2 text-sm font-medium text-violet-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                    Open tool <span>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
