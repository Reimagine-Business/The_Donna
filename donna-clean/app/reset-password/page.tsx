import { ResetPasswordForm } from "@/components/reset-password-form";

export const dynamic = "force-dynamic";

/**
 * Reset Password Page
 *
 * Handles the Supabase password recovery callback.
 * Supabase redirects here with hash fragments (#access_token=...&type=recovery).
 * The client-side ResetPasswordForm listens for the PASSWORD_RECOVERY auth
 * state change event to detect a valid recovery session.
 *
 * Supabase Dashboard redirect URLs must include:
 *   https://www.thedonnaapp.co/reset-password
 *   https://thedonnaapp.co/reset-password
 *   http://localhost:3000/reset-password
 */
export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
