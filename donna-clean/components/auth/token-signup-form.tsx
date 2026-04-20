'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, Building2, User, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { completeSignupWithToken } from '@/app/admin/users/signup-link-actions';
import { checkUsernameAvailability } from '@/app/auth/sign-up/actions';

interface TokenSignupFormProps {
  email: string;
  token: string;
}

export function TokenSignupForm({ email, token }: TokenSignupFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({ businessName: '', username: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameCheck, setUsernameCheck] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  // Debounced username check
  useEffect(() => {
    if (formData.username.trim().length < 1) {
      setUsernameCheck({ checking: false, available: null, message: '' });
      return;
    }
    const timer = setTimeout(async () => {
      setUsernameCheck({ checking: true, available: null, message: '' });
      const result = await checkUsernameAvailability(formData.username);
      setUsernameCheck({
        checking: false,
        available: result.available,
        message: result.available ? 'Username is available' : (result.error ?? 'Username is taken'),
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.username]);

  function set(field: keyof typeof formData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (usernameCheck.available === false) {
      setError('Please choose a different username');
      return;
    }

    setIsLoading(true);

    const result = await completeSignupWithToken({
      token,
      businessName: formData.businessName.trim(),
      username: formData.username.trim(),
      password: formData.password,
    });

    if (!result.success) {
      setError(result.error ?? 'Failed to create account');
      setIsLoading(false);
      return;
    }

    // Auto-login with the password the user just set
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: formData.password,
    });

    if (signInError) {
      // Account created but auto-login failed — send to login page
      router.push('/auth/login');
      return;
    }

    router.push('/home');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email (read-only) */}
      <div>
        <label className="block text-sm font-medium mb-2">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="email"
            value={email}
            readOnly
            className="w-full pl-10 pr-4 py-2 bg-white/[0.04] border border-border rounded-lg text-white/50 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Business Name */}
      <div>
        <label className="block text-sm font-medium mb-2">Business Name *</label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            value={formData.businessName}
            onChange={(e) => set('businessName', e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Your Shop Name"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm font-medium mb-2">Username *</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            value={formData.username}
            onChange={(e) => set('username', e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="myshopname"
            required
            minLength={1}
            maxLength={30}
            disabled={isLoading}
          />
          {formData.username.trim().length > 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameCheck.checking ? (
                <Loader2 className="h-4 w-4 text-white/40 animate-spin" />
              ) : usernameCheck.available === true ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : usernameCheck.available === false ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : null}
            </div>
          )}
        </div>
        {usernameCheck.message && (
          <p className={`text-xs mt-1 ${usernameCheck.available ? 'text-green-500' : 'text-red-400'}`}>
            {usernameCheck.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium mb-2">Password *</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => set('password', e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-background border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Min. 8 characters"
            required
            minLength={8}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium mb-2">Confirm Password *</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Re-enter password"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !formData.businessName.trim() || !formData.username.trim() || !formData.password}
        className="w-full py-2.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Creating account…
          </>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  );
}
