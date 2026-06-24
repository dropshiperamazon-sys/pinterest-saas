export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#e60023] rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">P</span>
        </div>
        <span className="font-bold text-gray-900 text-lg">Grow Pin Pro</span>
      </header>
      <main>{children}</main>
      <footer className="border-t border-gray-100 px-6 py-4 text-center text-xs text-gray-400 mt-12">
        © 2026 Grow Pin Pro. All rights reserved.
      </footer>
    </div>
  );
}
