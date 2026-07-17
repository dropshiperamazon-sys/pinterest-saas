"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";

export default function ConnectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [pinterestName, setPinterestName] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/pinterest-connection")
      .then(r => r.json())
      .then(d => {
        setConnected(d.connected);
        setPinterestName(d.pinterestName || d.pinterestUsername || "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/pinterest-oauth/disconnect", { method: "POST" });
    setConnected(false);
    setPinterestName("");
    setDisconnecting(false);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#e60023]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-[#e60023] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-bold text-2xl">P</span>
        </div>

        {connected ? (
          <>
            <div className="flex items-center justify-center gap-2 text-green-600 mb-3">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Pinterest Connected</span>
            </div>
            <p className="text-gray-600 text-sm mb-2">
              Connected as <strong>@{pinterestName}</strong>
            </p>
            <p className="text-gray-400 text-xs mb-8">
              Your Pinterest account is connected. You can now schedule pins and manage ads.
            </p>
            <div className="space-y-3">
              <a
                href="/scheduler"
                className="block w-full bg-[#e60023] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#c8001e] transition-colors"
              >
                Go to Pin Scheduler
              </a>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect Pinterest"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Connect Pinterest</h1>
            <p className="text-gray-500 text-sm mb-8">
              Connect your Pinterest Business account to schedule pins, manage ads, and access analytics.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
              {[
                "Schedule pins to any of your boards",
                "Manage and analyze your Pinterest Ads",
                "Access pin analytics and performance data",
                "Read and write pins on your behalf",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            <a
              href="/api/pinterest-oauth/start"
              className="w-full bg-[#e60023] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#c8001e] transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-lg">📌</span>
              Connect with Pinterest
            </a>

            <p className="text-xs text-gray-400 mt-4">
              We only request permissions needed to schedule and manage your pins.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
