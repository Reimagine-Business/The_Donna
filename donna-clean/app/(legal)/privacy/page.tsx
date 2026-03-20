import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - The Donna",
  description: "Privacy policy for The Donna financial management application",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "31st March 2026";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e] text-white px-4 py-8">
      <div className="container mx-auto max-w-4xl">
        {/* Header with back link */}
        <div className="mb-8">
          <Link href="/legal" className="text-purple-400 hover:text-purple-300 hover:underline mb-4 inline-block">
            ← Back to Privacy & Legal
          </Link>
          <h1 className="text-4xl font-bold mb-2 mt-4">Privacy Policy</h1>
          <p className="text-purple-300">Last Updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 text-purple-200 prose prose-invert max-w-none">

          {/* Preamble */}
          <section>
            <p className="text-sm text-purple-300 mb-2 font-semibold">
              THE DONNA APP — Privacy Policy<br />
              Reimagine Business (Sole Proprietorship)<br />
              Lummawbah, Shillong, Meghalaya — 793005
            </p>
            <p className="text-sm text-purple-300 mb-4">
              Effective Date: 31st March 2026 | Last Updated: 31st March 2026
            </p>
            <p className="mb-4">
              This document sets out the legal terms governing your use of The Donna App. It is written in plain language intentionally. If you have any questions, write to us at{" "}
              <a href="mailto:support@thedonnaapp.co" className="text-purple-400 hover:underline">support@thedonnaapp.co</a>.
            </p>
          </section>

          {/* The Donna Promise */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">The Donna Promise</h2>
            <p className="mb-4">Before the legal language, here is what we commit to in plain terms:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong className="text-white">You are the Boss:</strong> The Donna is a tool for your business. It is not a replacement for your own judgment or a professional accountant or CA.</li>
              <li><strong className="text-white">Your Data is Yours:</strong> We do not sell your business data or your customer feedback to anyone. We only use it to make The Donna smarter for you.</li>
              <li><strong className="text-white">Simple & Local:</strong> We operate from Shillong under Indian law. If we ever change our rules, we will tell you in plain language, not buried in fine print.</li>
              <li><strong className="text-white">Not a Bank:</strong> The Donna does not lend money, process payments, or file taxes on your behalf.</li>
            </ul>
          </section>

          {/* Privacy Policy intro */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Privacy Policy</h2>
            <p className="mb-4">
              This Privacy Policy applies to all visitors, users, and others who access or use The Donna App and/or submit any information. It is published in accordance with the Information Technology Act, 2000, the IT (Reasonable Security Practices) Rules 2011, and the Digital Personal Data Protection Act 2023 (DPDP Act).
            </p>
            <p className="mb-4">
              &ldquo;The Donna&rdquo; or &ldquo;We&rdquo; or &ldquo;Us&rdquo; refers to Reimagine Business, a sole proprietorship registered in Shillong, Meghalaya. &ldquo;You&rdquo; or &ldquo;User&rdquo; refers to the business owner using the App.
            </p>
          </section>

          {/* 1. What We Collect */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. What We Collect</h2>

            <h3 className="text-lg font-semibold text-white mb-2">1a. Account Information</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Your name, business name, and email address — to create and manage your account.</li>
              <li>Your phone number — for account security and support only.</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">1b. Business Financial Data</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Cash IN and Cash OUT entries you record in the app.</li>
              <li>Credit and Advance entries, and their settlement records.</li>
              <li>Party names (customers and vendors) that you add manually.</li>
              <li>Customer feedback responses collected via your QR card.</li>
              <li>User Bio information you provide (business type, location, team size, goals).</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">1c. Technical Data</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Basic device information (hardware model, operating system version) for security and fraud prevention. We do not collect your IMEI, serial number, or any unique hardware identifier.</li>
              <li>App usage logs (which features you use, when you log in) to help us improve the product.</li>
              <li>Cookies and local storage for session management. These are essential for the app to function.</li>
            </ul>

            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg">
              <p className="font-semibold text-white mb-2">What we do NOT collect:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>We do not collect data from other apps installed on your device.</li>
                <li>We do not collect advertising IDs or track you across other websites or apps.</li>
                <li>We do not access your device camera, microphone, or contacts unless you explicitly grant permission for a specific feature.</li>
              </ul>
            </div>
          </section>

          {/* 2. Why We Collect It */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Why We Collect It</h2>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>To provide the core service: recording entries, generating Cash Pulse and Profit Lens views, and powering Donna AI insights.</li>
              <li>To send you alerts about your business (e.g., unsettled credits, unusual spending patterns).</li>
              <li>To personalise Donna AI responses based on your User Bio and financial history.</li>
              <li>To improve the product based on how users interact with it (in aggregate, never individually identifiable).</li>
              <li>To comply with applicable Indian law if required by a government authority.</li>
            </ul>
            <p className="text-yellow-400 font-semibold">
              We do NOT use your data to show you advertisements. The Donna is ad-free.
            </p>
          </section>

          {/* 3. How Donna AI Works */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. How Donna AI Works with Your Data</h2>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong className="text-white">Purpose:</strong> To generate insights about your business — cash flow trends, receivable aging, spending patterns, and answers to your questions about the business.</li>
              <li><strong className="text-white">Mechanism:</strong> Your financial entries, User Bio, and customer feedback are processed by our AI engine (powered by Google Gemini API) to identify patterns and generate plain-language responses.</li>
              <li><strong className="text-white">Data Isolation:</strong> Your business data is processed in an isolated environment specific to your account. It is not used to train public AI models. It is not shared with or visible to other users of The Donna.</li>
              <li><strong className="text-white">Zero Data Retention with AI Provider:</strong> We use Google Gemini API under terms that prohibit Google from retaining or using your data to train their global models.</li>
              <li><strong className="text-white">AI Transparency:</strong> All insights generated by Donna AI are clearly presented as AI-generated analysis based on the data you entered. They are for your information only and do not constitute financial, tax, or legal advice.</li>
              <li><strong className="text-white">Human Review:</strong> If you believe a Donna AI insight is incorrect, you can flag it. You are always in control of your data.</li>
            </ul>
          </section>

          {/* 4. Who We Share Your Data With */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Who We Share Your Data With</h2>
            <p className="mb-4 text-yellow-400 font-semibold">We do not sell your data. Period.</p>
            <p className="mb-4">We share data only with the following service providers who are necessary to run the app:</p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm text-left border border-purple-500/30 rounded-lg overflow-hidden">
                <thead className="bg-purple-900/30 text-white">
                  <tr>
                    <th className="px-4 py-2 border-b border-purple-500/30">Provider</th>
                    <th className="px-4 py-2 border-b border-purple-500/30">Role</th>
                    <th className="px-4 py-2 border-b border-purple-500/30">What they receive</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-purple-500/20">
                    <td className="px-4 py-2">Supabase</td>
                    <td className="px-4 py-2">Database & authentication</td>
                    <td className="px-4 py-2">Encrypted data storage only</td>
                  </tr>
                  <tr className="border-b border-purple-500/20">
                    <td className="px-4 py-2">Vercel</td>
                    <td className="px-4 py-2">App hosting & deployment</td>
                    <td className="px-4 py-2">App traffic only, no financial data</td>
                  </tr>
                  <tr className="border-b border-purple-500/20">
                    <td className="px-4 py-2">Google Gemini API</td>
                    <td className="px-4 py-2">AI-powered insights</td>
                    <td className="px-4 py-2">Anonymised query context only, not stored by Google</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Sentry</td>
                    <td className="px-4 py-2">Error monitoring</td>
                    <td className="px-4 py-2">App error logs only, no financial data</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              We may disclose your information to Indian government or regulatory authorities only if required by law (e.g., a valid court order). We will notify you if legally permitted to do so.
            </p>
          </section>

          {/* 5. Data Ownership & Storage */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Data Ownership & Storage</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Ownership:</strong> You retain 100% ownership of all business data you enter into The Donna. We are the custodian, not the owner.</li>
              <li><strong className="text-white">Security:</strong> We use AES-256 encryption for data at rest and TLS 1.3 for data in transit. We conduct periodic security audits.</li>
              <li><strong className="text-white">Cloud Infrastructure:</strong> The Donna is hosted on Supabase and Vercel. Data may be processed on servers outside India as part of normal cloud operations. We ensure all providers maintain appropriate security standards.</li>
            </ul>
          </section>

          {/* 6. Data Retention & Deletion */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Data Retention & Deletion</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>We store your data for as long as your account is active.</li>
              <li>You may export your data in CSV format at any time from within the app.</li>
              <li>You may request full account deletion by contacting us at{" "}
                <a href="mailto:support@thedonnaapp.co" className="text-purple-400 hover:underline">support@thedonnaapp.co</a>.
                {" "}Upon confirmed request, all your financial records and personal identifiers will be purged from our active systems within 30 days, except where Indian law requires retention.</li>
            </ul>
          </section>

          {/* 7. Your Rights Under the DPDP Act */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Your Rights Under the DPDP Act 2023</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Access & Correction:</strong> You may review and correct any personal or business information in the app at any time.</li>
              <li><strong className="text-white">Withdrawal of Consent:</strong> You may opt out of Donna AI insights at any time via the app settings.</li>
              <li><strong className="text-white">Data Deletion:</strong> You have the right to request deletion of your account and all associated data.</li>
              <li><strong className="text-white">Right to Nominate:</strong> Under the DPDP Act 2023, you have the right to nominate a person who can manage your business data on your behalf in the event of your death or incapacity. To register a nominee, contact us at{" "}
                <a href="mailto:support@thedonnaapp.co" className="text-purple-400 hover:underline">support@thedonnaapp.co</a>.</li>
              <li><strong className="text-white">Grievance Redressal:</strong> We will acknowledge any privacy concern within 48 hours and resolve it within 30 days. Contact:{" "}
                <a href="mailto:support@thedonnaapp.co" className="text-purple-400 hover:underline">support@thedonnaapp.co</a></li>
            </ul>
          </section>

          {/* 8. Minor's Privacy */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Minor&apos;s Privacy</h2>
            <p>
              The Donna is intended for business owners aged 18 and above. We do not knowingly collect personal information from anyone under the age of 18. If you are under 18, you must have a parent or legal guardian&apos;s written permission to use the app. If we become aware that a user is under 18 without guardian consent, we will suspend the account and delete the associated data immediately.
            </p>
          </section>

          {/* 9. Changes */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy to reflect changes in our practices or regulatory requirements. We will notify you of material changes via the app or email. Continued use after notification constitutes acceptance of the updated terms.
            </p>
          </section>

          {/* Contact & Grievance */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Contact & Grievance</h2>
            <p className="mb-4">
              Reimagine Business operates as a Digital Office. All grievances and data requests are processed electronically to ensure fast and transparent resolution for our users in Shillong and across Meghalaya. There are no physical hearings required.
            </p>
            <ul className="space-y-1">
              <li><strong className="text-white">Name:</strong> Alfred (Founder, Reimagine Business)</li>
              <li><strong className="text-white">Email:</strong>{" "}
                <a href="mailto:support@thedonnaapp.co" className="text-purple-400 hover:underline">support@thedonnaapp.co</a>
              </li>
              <li><strong className="text-white">Address:</strong> Reimagine Business, Lummawbah, Shillong, Meghalaya — 793005</li>
              <li><strong className="text-white">Response Time:</strong> Acknowledgment within 48 hours. Resolution within 30 days.</li>
            </ul>
            <p className="mt-4 text-sm text-purple-300">
              Reimagine Business is a sole proprietorship. The Donna is its flagship product.
            </p>
          </section>

        </div>

        {/* Back link */}
        <div className="mt-8 pt-8 border-t border-purple-500/30">
          <Link href="/legal" className="text-purple-400 hover:text-purple-300 hover:underline">
            ← Back to Privacy & Legal
          </Link>
        </div>
      </div>
    </main>
  );
}
