'use client';

import { useState } from 'react';
import { Link2, Copy, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { generateSignupLink } from '@/app/admin/users/signup-link-actions';

export function GenerateSignupLink() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setGeneratedLink(null);

    setIsLoading(true);
    const result = await generateSignupLink(email);
    setIsLoading(false);

    if (result.success && result.link) {
      setGeneratedLink(result.link);
      setEmail('');
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Failed to generate link' });
    }
  }

  async function handleCopy() {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="space-y-4">
      {/* Generated link display */}
      {generatedLink && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-500 mb-2">Link generated! Valid for 24 hours.</p>
              <p className="text-xs font-mono break-all text-white/70 bg-black/20 p-2 rounded select-all">
                {generatedLink}
              </p>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="w-full px-3 py-2 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors flex items-center justify-center gap-2"
          >
            <Copy className="h-3 w-3" />
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <p className="text-xs text-white/40">
            Share via WhatsApp. The user will set their own password, business name, and username.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="link-email" className="block text-sm font-medium mb-2">
            Email Address *
          </label>
          <input
            type="email"
            id="link-email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setMessage(null);
            }}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="newuser@example.com"
            required
            disabled={isLoading}
          />
          <p className="text-xs text-white/40 mt-1">
            Link expires in 24 hours and can only be used once.
          </p>
        </div>

        {message && (
          <div className="p-3 rounded-lg border bg-red-500/10 border-red-500/30 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !email.trim()}
          className="w-full py-2.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Link2 className="h-5 w-5" />
              Generate Link
            </>
          )}
        </button>
      </form>
    </div>
  );
}
