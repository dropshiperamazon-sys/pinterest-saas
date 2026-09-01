import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="border-t border-gray-100 py-10 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 mb-8">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-[#e60023] rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">P</span>
              </div>
              <span className="font-bold text-gray-900">My Pin Pro</span>
            </Link>
            <p className="text-sm text-gray-500">The all-in-one Pinterest marketing suite for creators and businesses.</p>
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm mb-3">Product</div>
            <ul className="space-y-2">
              {[["/#features", "Features"], ["/pricing", "Pricing"], ["/about", "About"]].map(([href, label]) => (
                <li key={href}><Link href={href} className="text-sm text-gray-500 hover:text-gray-800">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm mb-3">Support</div>
            <ul className="space-y-2">
              {[["/contact", "Contact Us"], ["/privacy", "Privacy Policy"]].map(([href, label]) => (
                <li key={href}><Link href={href} className="text-sm text-gray-500 hover:text-gray-800">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm mb-3">Account</div>
            <ul className="space-y-2">
              {[["/login", "Login"], ["/signup", "Sign Up Free"]].map(([href, label]) => (
                <li key={href}><Link href={href} className="text-sm text-gray-500 hover:text-gray-800">{label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-400">
          <span>© {new Date().getFullYear()} My Pin Pro. All rights reserved.</span>
          <span>contact@mypinpro.com</span>
        </div>
      </div>
    </footer>
  );
}
