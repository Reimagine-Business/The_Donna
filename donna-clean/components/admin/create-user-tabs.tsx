'use client';

import { useState } from 'react';
import { CreateUserDirect } from '@/components/admin/create-user-direct';
import { GenerateSignupLink } from '@/components/admin/generate-signup-link';

export function CreateUserTabs() {
  const [tab, setTab] = useState<'link' | 'direct'>('link');

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-white/[0.06] p-1 mb-6">
        <button
          type="button"
          onClick={() => setTab('link')}
          className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'link'
              ? 'bg-[#8b5cf6] text-white'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          Generate Signup Link
        </button>
        <button
          type="button"
          onClick={() => setTab('direct')}
          className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'direct'
              ? 'bg-[#8b5cf6] text-white'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          Create Account Directly
        </button>
      </div>

      {tab === 'link' ? (
        <div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg mb-4">
            <p className="text-sm text-white/80">
              Generates a one-time link for the user to sign up themselves. They set their own
              password, business name, and username. Link expires in 24 hours.
            </p>
          </div>
          <GenerateSignupLink />
        </div>
      ) : (
        <div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg mb-4">
            <p className="text-sm text-white/80">
              Creates account instantly. Users can login immediately and change their password.
              Standard user access (no admin privileges).
            </p>
          </div>
          <CreateUserDirect />
        </div>
      )}
    </div>
  );
}
