import Link from "next/link";
import { Shield, FileText, Cookie, ExternalLink, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { TopNavMobile } from "@/components/navigation/top-nav-mobile";
import { BottomNav } from "@/components/navigation/bottom-nav";

export const metadata = {
  title: "Legal & Privacy | The Donna",
  description: "Learn about how we protect your data and your rights",
};

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e] text-white pb-24 md:pb-8">
      <SiteHeader />
      <TopNavMobile />

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Back Button */}
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-purple-300 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Settings</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Legal & Privacy</h1>
          <p className="text-purple-300">
            Learn about how we protect your data and your rights.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Privacy Policy Card */}
          <Link
            href="/privacy"
            className="group p-6 border border-purple-500/30 rounded-lg bg-purple-900/10 hover:border-purple-500 hover:bg-purple-900/20 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <Shield className="h-8 w-8 text-purple-400" />
              <ExternalLink className="h-4 w-4 text-purple-400/70 group-hover:text-purple-300" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Privacy Policy</h2>
            <p className="text-sm text-purple-300 mb-4">
              Learn how we collect, use, and protect your personal information.
            </p>
            <div className="text-sm text-purple-400 group-hover:text-purple-300 group-hover:underline flex items-center gap-1">
              Read Privacy Policy →
            </div>
          </Link>

          {/* Terms of Service Card */}
          <Link
            href="/terms"
            className="group p-6 border border-purple-500/30 rounded-lg bg-purple-900/10 hover:border-purple-500 hover:bg-purple-900/20 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <FileText className="h-8 w-8 text-purple-400" />
              <ExternalLink className="h-4 w-4 text-purple-400/70 group-hover:text-purple-300" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Terms of Service</h2>
            <p className="text-sm text-purple-300 mb-4">
              Understand the terms and conditions for using The Donna.
            </p>
            <div className="text-sm text-purple-400 group-hover:text-purple-300 group-hover:underline flex items-center gap-1">
              Read Terms of Service →
            </div>
          </Link>

          {/* Cookie Policy Card */}
          <div className="p-6 border border-purple-500/30 rounded-lg bg-purple-900/10">
            <div className="flex items-start mb-4">
              <Cookie className="h-8 w-8 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Cookie Policy</h2>
            <p className="text-sm text-purple-300 mb-4">
              We only use essential cookies to keep you logged in. No tracking cookies.
            </p>
            <div className="text-sm text-purple-400 flex items-center gap-1">
              Covered in Privacy Policy
            </div>
          </div>

          {/* Data Rights Card */}
          <div className="p-6 border border-purple-500/30 rounded-lg bg-purple-900/10">
            <div className="flex items-start mb-4">
              <Shield className="h-8 w-8 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Your Data Rights</h2>
            <p className="text-sm text-purple-300 mb-4">
              You have the right to access, export, and delete your data at any time.
            </p>
            <Link
              href="/settings?tab=danger"
              className="text-sm text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1"
            >
              Manage in Settings →
            </Link>
          </div>
        </div>

        {/* Data Protection Summary */}
        <div className="mt-8 p-6 border border-purple-500/30 rounded-lg bg-purple-900/10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            How We Protect Your Data
          </h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-semibold text-purple-200 mb-1">🔒 Encryption</div>
              <p className="text-purple-300">
                All data is encrypted in transit and at rest
              </p>
            </div>
            <div>
              <div className="font-semibold text-purple-200 mb-1">🛡️ Security</div>
              <p className="text-purple-300">
                Row-level security ensures data isolation
              </p>
            </div>
            <div>
              <div className="font-semibold text-purple-200 mb-1">🚫 No Selling</div>
              <p className="text-purple-300">
                We never sell your data to third parties
              </p>
            </div>
          </div>
        </div>

        {/* Last Updated Info */}
        <div className="mt-8 p-4 border border-purple-500/20 rounded-lg bg-purple-900/5">
          <p className="text-sm text-purple-300">
            <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
          <p className="text-sm text-purple-300 mt-2">
            We may update these policies from time to time. We'll notify you of any significant changes.
          </p>
        </div>

        {/* Compliance Badges */}
        <div className="mt-8 p-6 border border-purple-500/30 rounded-lg bg-purple-900/10">
          <h3 className="text-sm font-semibold text-purple-200 mb-3">Legal Compliance</h3>
          <div className="flex flex-wrap gap-3">
            <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs text-purple-200">
              🇮🇳 India IT Act 2000
            </div>
            <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs text-purple-200">
              🇪🇺 GDPR Compliant
            </div>
            <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs text-purple-200">
              🇺🇸 CCPA Compliant
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
