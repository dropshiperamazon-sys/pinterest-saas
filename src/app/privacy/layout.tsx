export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center">
        <img src="/rambforce-logo.png" alt="Rambforce" className="h-8 w-auto object-contain" />
      </header>
      <main>{children}</main>
      <footer className="border-t border-gray-100 px-6 py-4 text-center text-xs text-gray-400 mt-12">
        © 2026 Rambforce. All rights reserved.
      </footer>
    </div>
  );
}
