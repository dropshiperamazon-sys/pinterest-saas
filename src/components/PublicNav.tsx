"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/pricing", label: "Pricing" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact Us" },
  ];

  return (
    <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#e60023] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">My Pin Pro</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium transition-colors ${
                pathname === href ? "text-[#e60023]" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Login</Link>
          <Link
            href="/signup"
            className="bg-[#e60023] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#ad081b] transition-colors"
          >
            Get Started Free
          </Link>
        </div>

        {/* Mobile: login + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <Link href="/login" className="text-sm text-gray-600 font-medium px-3 py-2">Login</Link>
          <Link
            href="/signup"
            className="bg-[#e60023] text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-[#ad081b] transition-colors"
          >
            Get Started
          </Link>
          <button
            onClick={() => setOpen(p => !p)}
            className="ml-1 p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                pathname === href
                  ? "bg-[#e60023]/10 text-[#e60023]"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
