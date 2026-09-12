"use client";
import { useEffect } from "react";

export default function SchedulerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Scheduler] Page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-6 py-12 bg-white rounded-2xl shadow-sm max-w-lg w-full">
        <div className="text-5xl mb-4">📌</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-gray-500 text-sm mb-4">
          The scheduler couldn&apos;t load. This is usually a temporary issue.
        </p>
        {error?.message && (
          <pre className="text-left text-xs bg-gray-100 rounded-lg p-3 mb-4 overflow-auto max-h-32 text-red-600">
            {error.message}
          </pre>
        )}
        <button
          onClick={reset}
          className="bg-[#e60023] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#c0001d] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
