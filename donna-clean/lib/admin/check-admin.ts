import { createSupabaseServerClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

// ONLY this email can access admin
const ADMIN_EMAIL = 'reimaginebusiness2025@gmail.com';

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/auth/login');
  }

  // CRITICAL: Check exact email match
  if (user.email !== ADMIN_EMAIL) {
    redirect('/home'); // Not the admin, redirect away
  }

  // Also verify role (belt and suspenders)
  const isAdmin = user.app_metadata?.role === 'admin';
  if (!isAdmin) {
    redirect('/home');
  }

  return user;
}

export async function isUserAdmin(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    // Check both email and role
    return user.email === ADMIN_EMAIL && user.app_metadata?.role === 'admin';
  } catch {
    return false;
  }
}
