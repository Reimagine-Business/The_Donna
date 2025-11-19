import type { AuthError, SupabaseClient, User } from "@supabase/supabase-js";

export type GetOrRefreshUserResult = {
  user: User | null;
  wasInitiallyNull: boolean;
  initialError: AuthError | null;
  refreshError: AuthError | null;
};

export async function getOrRefreshUser(
  supabase: SupabaseClient,
): Promise<GetOrRefreshUserResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (user) {
    return {
      user,
      wasInitiallyNull: false,
      initialError: error ?? null,
      refreshError: null,
    };
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  const refreshedUser = refreshData?.user ?? refreshData?.session?.user ?? null;

  return {
    user: refreshedUser,
    wasInitiallyNull: true,
    initialError: error ?? null,
    refreshError: refreshError ?? null,
  };
}
