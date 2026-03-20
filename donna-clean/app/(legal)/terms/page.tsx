import Link from "next/link";

export const metadata = {
  title: "Terms of Service - The Donna",
  description: "Terms and conditions for using The Donna financial management application",
};

export default function TermsPage() {
  const lastUpdated = "31st March 2026";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e] text-white px-4 py-8">
      <div className="container mx-auto max-w-4xl">
        {/* Header with back link */}
        <div className="mb-8">
          <Link href="/legal" className="text-purple-400 hover:text-purple-300 hover:underline mb-4 inline-block">
            ← Back to Privacy & Legal
          </Link>
          <h1 className="text-4xl font-bold mb-2 mt-4">Terms of Service</h1>
          <p className="text-purple-300">Last Updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 text-purple-200 prose prose-invert max-w-none">

          {/* Preamble */}
          <section>
            <p className="text-sm text-purple-300 mb-2 font-semibold">
              THE DONNA APP — Terms of Service<br />
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

          {/* Terms of Service intro */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Terms of Service</h2>
            <p>
              These Terms of Service govern your use of The Donna App, provided by Reimagine Business (Sole Proprietorship), Lummawbah, Shillong, Meghalaya — 793005. By using the app, you agree to these terms in full.
            </p>
          </section>

          {/* 1. Nature of Service */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Nature of Service</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Non-Financial Institution:</strong> The Donna is not a bank, lender, payment aggregator, or credit bureau. We do not provide financial advice, loan disbursements, or tax filing services.</li>
              <li><strong className="text-white">Not a CA or Tax Advisor:</strong> The Donna&apos;s Profit Lens, Cash Pulse, and Donna AI insights are based solely on data you enter. Always consult a qualified CA for tax filing, GST returns, or legal compliance.</li>
              <li><strong className="text-white">AI Insights:</strong> The app uses Artificial Intelligence to analyse your transactions and provide cash flow snapshots. These insights are generated from your own data and are clearly labelled as AI-generated.</li>
            </ul>
          </section>

          {/* 2. Age Requirement */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Age Requirement</h2>
            <p>
              The Donna is for business owners aged 18 and above. If you are under 18, you must have a parent or legal guardian&apos;s permission to use the app. By creating an account, you confirm that you are 18 years of age or older, or that you have obtained the required parental or guardian consent.
            </p>
          </section>

          {/* 3. What The Donna Currently Does */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. What The Donna Currently Does</h2>
            <p className="mb-4">As of March 2026, The Donna includes:</p>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-white mb-2">Finance Pillar:</p>
                <p>Cash IN / Cash OUT entry recording, Credit and Advance management, Settlements, Party management, Cash Pulse, Profit Lens, and Donna AI financial agent.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">Customer Feedback Pillar:</p>
                <p>QR code-based feedback collection, customisable feedback categories, feedback response dashboard, and Donna AI feedback analysis.</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-purple-300">
              Features planned for future release (including Operations/Stock tracking, User Bio, NPS Scorecard, and third-party integrations) will be governed by updated terms at the time of release.
            </p>
          </section>

          {/* 4. User Responsibilities */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. User Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Accuracy of Data:</strong> You are responsible for the accuracy of all entries. The Donna is not liable for incorrect AI insights resulting from inaccurate input.</li>
              <li><strong className="text-white">Business Use Only:</strong> By creating an account, you confirm you are using The Donna for a legitimate business or professional purpose.</li>
              <li><strong className="text-white">Account Security:</strong> You are responsible for maintaining the confidentiality of your login credentials. Notify us immediately at{" "}
                <a href="mailto:support@thedonnaapp.co" className="text-purple-400 hover:underline">support@thedonnaapp.co</a>{" "}
                if you suspect unauthorised access.</li>
            </ul>
          </section>

          {/* 5. AI Usage & Transparency */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. AI Usage & Transparency</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>All AI-generated insights from Donna AI are clearly presented as AI-generated analysis based on your entered data.</li>
              <li>Your business data is processed in an isolated environment. It is not used to train AI models for other users.</li>
              <li>Donna AI communicates in plain business-owner language. It will never sound like an accountant.</li>
            </ul>
          </section>

          {/* 6. Data Portability & Account Termination */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Data Portability & Account Termination</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You may terminate your account at any time by contacting{" "}
                <a href="mailto:support@thedonnaapp.co" className="text-purple-400 hover:underline">support@thedonnaapp.co</a>.</li>
              <li>Upon termination, you have 30 days to export your data in CSV format.</li>
              <li>After the 30-day export period, all data will be permanently purged from our active systems, except where retention is required by Indian law.</li>
            </ul>
          </section>

          {/* 7. Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Limitation of Liability</h2>
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg space-y-3">
              <div>
                <p className="font-semibold text-white mb-1">Service Availability:</p>
                <p>We are not liable for business losses resulting from temporary app downtime or third-party API failures.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Cap on Liability:</p>
                <p>Our total liability shall not exceed the total fees paid by you in the 12 months preceding the claim. For users on a free plan, this cap is INR 1,000.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Indirect Damages:</p>
                <p>We are not liable for any indirect, incidental, or consequential damages, including loss of profits or business reputation.</p>
              </div>
            </div>
          </section>

          {/* 8. Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Intellectual Property</h2>
            <p>
              Reimagine Business retains all rights in relation to The Donna App, including all text, graphics, logos, and the Donna AI system. You retain full ownership of all data you enter into the app.
            </p>
          </section>

          {/* 9. Modifications */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Modifications to Terms</h2>
            <p>
              We will notify you of material changes via the app or email at least 14 days before they take effect. Continued use after the effective date constitutes acceptance of the updated Terms.
            </p>
          </section>

          {/* 10. Governing Law */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Governing Law & Dispute Resolution</h2>
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
              <p>
                These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Shillong, Meghalaya.
              </p>
            </div>
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
