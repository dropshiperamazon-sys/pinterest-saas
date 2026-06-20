"use client";
import { useState } from "react";
import Header from "@/components/Header";
import { MOCK_SCHEDULED_PINS } from "@/lib/pinterest-data";
import { cn } from "@/lib/utils";
import {
  Plus, Calendar, Clock, Link2, Image as ImageIcon,
  CheckCircle2, AlertCircle, Trash2, Edit2, X, ExternalLink,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface Pin {
  id: string;
  title: string;
  board: string;
  scheduledAt: string;
  status: string;
  imageUrl: string;
  description?: string;
  link?: string;
}

const BOARDS = ["Home Decor", "Food & Recipes", "Fitness", "Interior Design", "DIY & Crafts", "Fashion", "Travel", "Weddings"];
const BEST_TIMES = ["8:00 AM", "12:00 PM", "2:00 PM", "5:00 PM", "8:00 PM", "9:00 PM"];

export default function SchedulerPage() {
  const [pins, setPins] = useState<Pin[]>(MOCK_SCHEDULED_PINS);
  const [showModal, setShowModal] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<"upcoming" | "published">("upcoming");

  const [form, setForm] = useState({
    title: "",
    description: "",
    board: BOARDS[0],
    link: "",
    date: "",
    time: "",
  });

  const handleSchedule = () => {
    if (!form.title || !form.date || !form.time) return;
    const newPin: Pin = {
      id: Date.now().toString(),
      title: form.title,
      board: form.board,
      scheduledAt: `${form.date}T${form.time}:00`,
      status: "scheduled",
      imageUrl: "📌",
      description: form.description,
      link: form.link,
    };
    setPins((p) => [newPin, ...p]);
    setShowModal(false);
    setForm({ title: "", description: "", board: BOARDS[0], link: "", date: "", time: "" });
  };

  const deletePin = (id: string) => setPins((p) => p.filter((pin) => pin.id !== id));

  const filteredPins = pins.filter((p) => activeTab === "upcoming" ? p.status === "scheduled" : p.status === "published");

  return (
    <div>
      <Header title="Pin Scheduler" subtitle="Plan and schedule your Pinterest content in advance" />
      <div className="p-6 space-y-6">
        {/* Connect Account Banner */}
        {!connected && (
          <div className="bg-gradient-to-r from-[#e60023]/5 to-[#e60023]/10 border border-[#e60023]/20 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#e60023] rounded-xl flex items-center justify-center text-white text-xl font-bold">P</div>
              <div>
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  Connect your Pinterest account
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Required</span>
                </div>
                <div className="text-sm text-gray-500">Authorize PinPro to publish and schedule pins on your behalf.</div>
              </div>
            </div>
            <button
              onClick={() => setConnected(true)}
              className="bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors whitespace-nowrap flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Connect with Pinterest
            </button>
          </div>
        )}

        {connected && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <span className="text-sm font-semibold text-green-800">Pinterest connected!</span>
              <span className="text-sm text-green-600 ml-2">Your account @yourpinterest is linked and ready.</span>
            </div>
            <button onClick={() => setConnected(false)} className="ml-auto text-green-600 hover:text-green-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Schedule New Pin */}
          <div className="col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Schedule</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Pin Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Enter pin title..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What's this pin about?"
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Board</label>
                  <select
                    value={form.board}
                    onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] bg-white"
                  >
                    {BOARDS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Destination URL</label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      value={form.link}
                      onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                      placeholder="https://yourwebsite.com"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">Date *</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">Time *</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                    />
                  </div>
                </div>
                {/* Best Times */}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Best Times to Post</label>
                  <div className="flex flex-wrap gap-1.5">
                    {BEST_TIMES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setForm((f) => ({ ...f, time: t.includes("PM") ? String(parseInt(t) + 12).padStart(2, "0") + ":00" : t.replace(" AM", "").padStart(5, "0") }))}
                        className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-[#e60023]/10 hover:text-[#e60023] transition-colors font-medium"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Image Upload */}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Pin Image</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-[#e60023]/40 transition-colors cursor-pointer">
                    <ImageIcon className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                    <span className="text-xs text-gray-400">Drop image or click to upload</span>
                  </div>
                </div>
                <button
                  onClick={handleSchedule}
                  disabled={!form.title || !form.date || !form.time}
                  className="w-full bg-[#e60023] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Schedule Pin
                </button>
              </div>
            </div>
          </div>

          {/* Scheduled Pins List */}
          <div className="col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex gap-1">
                  {(["upcoming", "published"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize",
                        activeTab === tab ? "bg-[#e60023] text-white" : "text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      {tab}
                      <span className="ml-2 text-xs opacity-70">
                        {pins.filter((p) => tab === "upcoming" ? p.status === "scheduled" : p.status === "published").length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-gray-50">
                {filteredPins.length === 0 ? (
                  <div className="p-12 text-center">
                    <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No {activeTab} pins yet</p>
                  </div>
                ) : filteredPins.map((pin) => (
                  <div key={pin.id} className="p-4 hover:bg-gray-50/50 flex items-center gap-4 group">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {pin.imageUrl}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{pin.title}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{pin.board}</span>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(pin.scheduledAt), "MMM d, yyyy")}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(pin.scheduledAt), "h:mm a")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pin.status === "scheduled" ? (
                        <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full font-medium">
                          <Clock className="w-3 h-3" />
                          Scheduled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Published
                        </span>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deletePin(pin.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Analytics Hint */}
            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <strong>Pro tip:</strong> The best times to post on Pinterest are 8–11 PM on weekends and 2–4 PM on weekdays for maximum engagement.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
