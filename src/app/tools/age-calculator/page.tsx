"use client";
import { useState } from "react";
import { Calculator, ChevronLeft, Gift } from "lucide-react";
import Link from "next/link";

function calcAge(dob: Date, from: Date) {
  let years = from.getFullYear() - dob.getFullYear();
  let months = from.getMonth() - dob.getMonth();
  let days = from.getDate() - dob.getDate();

  if (days < 0) {
    months--;
    const prev = new Date(from.getFullYear(), from.getMonth(), 0);
    days += prev.getDate();
  }
  if (months < 0) { years--; months += 12; }

  const totalDays = Math.floor((from.getTime() - dob.getTime()) / 86400000);
  const totalWeeks = Math.floor(totalDays / 7);
  const totalMonths = years * 12 + months;
  const totalHours = totalDays * 24;

  const nextBirthday = new Date(from.getFullYear(), dob.getMonth(), dob.getDate());
  if (nextBirthday <= from) nextBirthday.setFullYear(from.getFullYear() + 1);
  const daysToNextBirthday = Math.ceil((nextBirthday.getTime() - from.getTime()) / 86400000);

  return { years, months, days, totalDays, totalWeeks, totalMonths, totalHours, daysToNextBirthday, nextBirthday };
}

export default function AgeCalculatorPage() {
  const today = new Date().toISOString().split("T")[0];
  const [dob, setDob] = useState("");
  const [asOf, setAsOf] = useState(today);

  const result = dob && asOf ? (() => {
    const d = new Date(dob);
    const a = new Date(asOf);
    if (isNaN(d.getTime()) || isNaN(a.getTime()) || d >= a) return null;
    return calcAge(d, a);
  })() : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Age Calculator</h1>
      </div>
      <p className="text-slate-500 mb-8">Calculate exact age in years, months, days, weeks, and hours.</p>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
          <input
            type="date"
            max={today}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Calculate Age As Of</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
      </div>

      {result && (
        <>
          {/* Primary result */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 text-white text-center mb-6 shadow-md">
            <p className="text-amber-100 text-sm mb-2">Age</p>
            <p className="text-5xl font-extrabold mb-1">{result.years}</p>
            <p className="text-2xl font-semibold text-amber-100">
              years, {result.months} months, {result.days} days
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Days", value: result.totalDays.toLocaleString() },
              { label: "Total Weeks", value: result.totalWeeks.toLocaleString() },
              { label: "Total Months", value: result.totalMonths.toLocaleString() },
              { label: "Total Hours", value: result.totalHours.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
                <p className="text-xl font-bold text-amber-600">{value}</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Next birthday */}
          <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Gift className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                Next Birthday: {result.nextBirthday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
              <p className="text-sm text-slate-500">{result.daysToNextBirthday} days away</p>
            </div>
          </div>
        </>
      )}

      {dob && asOf && !result && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          Date of birth must be before the &quot;as of&quot; date.
        </div>
      )}
    </div>
  );
}
