"use client";
import { useState } from "react";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import { Map, Rocket, BarChart2, Zap } from "lucide-react";
import PlanTab from "./components/PlanTab";
import LaunchTab from "./components/LaunchTab";
import AnalyzeTab from "./components/AnalyzeTab";
import OptimizeTab from "./components/OptimizeTab";

type Tab = "plan" | "launch" | "analyze" | "optimize";

const TABS: { key: Tab; label: string; icon: React.ElementType; description: string }[] = [
  { key: "plan", label: "Plan", icon: Map, description: "Research & strategy" },
  { key: "launch", label: "Launch", icon: Rocket, description: "Build & publish campaigns" },
  { key: "analyze", label: "Analyze", icon: BarChart2, description: "Performance & insights" },
  { key: "optimize", label: "Optimize", icon: Zap, description: "Scale & automate" },
];

export default function AdsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("plan");

  return (
    <div>
      <Header
        title="Pinterest Ads"
        subtitle="Plan, launch, analyze, and optimize your Pinterest advertising"
      />

      <div className="p-6 space-y-6">
        {/* Tab bar */}
        <div className="bg-white border border-gray-200 rounded-2xl p-2 flex gap-2 shadow-sm">
          {TABS.map(({ key, label, icon: Icon, description }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  active
                    ? "bg-[#e60023] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="font-semibold">{label}</span>
                <span className={cn("text-xs", active ? "text-white/70" : "text-gray-400")}>
                  {description}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "plan" && <PlanTab />}
        {activeTab === "launch" && <LaunchTab />}
        {activeTab === "analyze" && <AnalyzeTab />}
        {activeTab === "optimize" && <OptimizeTab />}
      </div>
    </div>
  );
}
