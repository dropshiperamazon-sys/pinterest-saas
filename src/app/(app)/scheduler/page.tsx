"use client";
import dynamic from "next/dynamic";
import SchedulerLoading from "./loading";

// Disable SSR to prevent hydration mismatches from time-based slot rendering
const SchedulerClient = dynamic(() => import("./SchedulerClient"), {
  ssr: false,
  loading: () => <SchedulerLoading />,
});

export default function SchedulerPage() {
  return <SchedulerClient />;
}
