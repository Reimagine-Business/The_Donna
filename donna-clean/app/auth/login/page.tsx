import { LoginForm } from "@/components/login-form";
import { VerifyEmailAlert } from "@/components/verify-email-alert";
import { createSupabaseServerClient } from "@/utils/supabase/server";

const getConfirmedTimestamp = (user: { [key: string]: unknown } | null) => {
  if (!user) {
    return null;
  }

  return (
    (user as { email_confirmed_at?: string | null }).email_confirmed_at ??
    (user as { confirmed_at?: string | null }).confirmed_at ??
    ((user as { user_metadata?: Record<string, unknown> }).user_metadata?.[
      "confirmed_at"
    ] as string | null) ??
    null
  );
};

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;
  const shouldAlertVerifyEmail = Boolean(user && !getConfirmedTimestamp(user));

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
        <VerifyEmailAlert shouldAlert={shouldAlertVerifyEmail} />
      </div>
    </div>
  );
}
