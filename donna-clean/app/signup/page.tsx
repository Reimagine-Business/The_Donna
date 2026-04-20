import { Suspense } from 'react';
import { validateSignupToken } from '@/app/admin/users/signup-link-actions';
import { TokenSignupForm } from '@/components/auth/token-signup-form';
import { UserPlus, AlertCircle } from 'lucide-react';

interface SignupPageProps {
  searchParams: Promise<{ token?: string }>;
}

async function SignupContent({ token }: { token: string | undefined }) {
  if (!token) {
    return <InvalidLink message="No signup token found in this link." />;
  }

  const result = await validateSignupToken(token);

  if (!result.valid || !result.email) {
    return <InvalidLink message={result.error ?? 'Invalid signup link.'} />;
  }

  return (
    <div className="w-full max-w-lg space-y-6 rounded-2xl border border-border bg-slate-950/50 p-8 shadow-2xl shadow-black/30">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center">
          <UserPlus className="w-8 h-8 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Create Your Account</h1>
          <p className="text-muted-foreground text-sm">
            Complete your profile to get started with The Donna
          </p>
        </div>
      </div>

      <TokenSignupForm email={result.email} token={token} />

      <div className="text-center pt-4 border-t border-border">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <a href="/auth/login" className="text-purple-400 hover:text-purple-300 transition-colors">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

function InvalidLink({ message }: { message: string }) {
  return (
    <div className="w-full max-w-md space-y-4 rounded-2xl border border-red-500/30 bg-slate-950/50 p-8 shadow-2xl shadow-black/30 text-center">
      <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h1 className="text-xl font-semibold text-white">Link Not Valid</h1>
      <p className="text-sm text-white/60">{message}</p>
      <p className="text-xs text-white/40">
        Contact your admin for a new signup link.
      </p>
    </div>
  );
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-slate-950">
      <Suspense fallback={<div className="text-white/50 text-sm">Validating link…</div>}>
        <SignupContent token={token} />
      </Suspense>
    </main>
  );
}
