export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: June 2026</p>

      <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Introduction</h2>
          <p>
            Grow Pin Pro ("we", "us", or "our") operates the PinPro platform available at{" "}
            <strong>https://pin-saas-5eb4.vercel.app</strong>. This Privacy Policy explains how we
            collect, use, and protect your information when you use our service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
          <p>When you connect your Pinterest account, we access:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Your Pinterest username and profile information</li>
            <li>Your Pinterest boards and pins (read access)</li>
            <li>Ability to create pins on your behalf (write access, only when you schedule a pin)</li>
            <li>Basic ad account data if you use the Pinterest Ads feature</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To schedule and publish pins to your Pinterest boards at your requested times</li>
            <li>To display your Pinterest analytics and performance data within the app</li>
            <li>To provide keyword research and pin analysis features</li>
            <li>We do NOT sell your data to third parties</li>
            <li>We do NOT use your Pinterest data for advertising purposes</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Data Storage</h2>
          <p>
            Scheduled pin data is temporarily stored in Upstash Redis and deleted after publishing.
            We do not permanently store your Pinterest access tokens beyond your active session.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Pinterest API</strong> — to read and write your Pinterest data</li>
            <li><strong>Upstash</strong> — for scheduling queue storage</li>
            <li><strong>Vercel</strong> — for hosting the application</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Deletion</h2>
          <p>
            You can disconnect your Pinterest account at any time from the sidebar. Upon disconnection,
            we remove your access token and any pending scheduled pins. To request full data deletion,
            contact us at the email below.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Contact</h2>
          <p>
            For privacy questions or data deletion requests, contact us at:{" "}
            <a href="mailto:saiful.khank16@gmail.com" className="text-[#e60023] hover:underline">
              saiful.khank16@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
