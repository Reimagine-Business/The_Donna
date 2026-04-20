'use server';

import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin/check-admin';
import { checkRateLimit } from '@/lib/rate-limit';

function makeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function generateSignupLink(email: string): Promise<{
  success: boolean;
  link?: string;
  error?: string;
}> {
  try {
    const adminUser = await requireAdmin();
    await checkRateLimit(adminUser.id, 'generate-signup-link');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    const supabaseAdmin = makeAdminClient();

    // Refuse if email already has an account
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('[generateSignupLink] listUsers error:', listError);
    }
    const alreadyExists = (existingUsers?.users ?? []).some(
      (u: { email?: string }) => u.email?.toLowerCase() === trimmedEmail
    );
    if (alreadyExists) {
      return { success: false, error: 'This email already has an account' };
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from('signup_tokens')
      .insert({
        email: trimmedEmail,
        token,
        expires_at: expiresAt,
        created_by: adminUser.id,
      });

    if (insertError) {
      console.error('[generateSignupLink] Insert error — code:', insertError.code, '| message:', insertError.message, '| details:', insertError.details);
      // 42P01 = relation (table) does not exist — migration not yet applied
      if (insertError.code === '42P01') {
        return { success: false, error: 'signup_tokens table not found — run the migration in Supabase Dashboard first.' };
      }
      return { success: false, error: `DB error (${insertError.code}): ${insertError.message}` };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thedonnaapp.co';
    const link = `${baseUrl}/signup?token=${token}`;

    return { success: true, link };
  } catch (error) {
    console.error('[generateSignupLink] Unexpected error:', error);
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}

export async function validateSignupToken(token: string): Promise<{
  valid: boolean;
  email?: string;
  error?: string;
}> {
  if (!token || token.length !== 64) {
    return { valid: false, error: 'Invalid signup link' };
  }

  try {
    const supabaseAdmin = makeAdminClient();
    const { data, error } = await supabaseAdmin
      .from('signup_tokens')
      .select('email, expires_at, used')
      .eq('token', token)
      .maybeSingle();

    if (error || !data) {
      return { valid: false, error: 'Invalid signup link' };
    }
    if (data.used) {
      return { valid: false, error: 'This signup link has already been used' };
    }
    if (new Date(data.expires_at) < new Date()) {
      return { valid: false, error: 'This signup link has expired' };
    }

    return { valid: true, email: data.email };
  } catch (error) {
    console.error('[validateSignupToken] Unexpected error:', error);
    return { valid: false, error: 'Something went wrong. Please try again.' };
  }
}

interface SignupWithTokenData {
  token: string;
  businessName: string;
  username: string;
  password: string;
}

export async function completeSignupWithToken(data: SignupWithTokenData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { token, businessName, username, password } = data;

    if (!token || !businessName.trim() || !username.trim() || !password) {
      return { success: false, error: 'All fields are required' };
    }
    if (username.trim().length < 1 || username.trim().length > 30) {
      return { success: false, error: 'Username must be 1–30 characters' };
    }
    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    const supabaseAdmin = makeAdminClient();

    // Validate token (re-check inside the action to avoid TOCTOU)
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from('signup_tokens')
      .select('id, email, expires_at, used')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return { success: false, error: 'Invalid signup link' };
    }
    if (tokenRow.used) {
      return { success: false, error: 'This signup link has already been used' };
    }
    if (new Date(tokenRow.expires_at) < new Date()) {
      return { success: false, error: 'This signup link has expired' };
    }

    const email = tokenRow.email;

    // Check username uniqueness
    const { data: existingUsername } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('username', username.trim())
      .maybeSingle();

    if (existingUsername) {
      return { success: false, error: 'Username is already taken' };
    }

    // Create auth user (email pre-confirmed)
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        business_name: businessName.trim(),
        username: username.trim(),
      },
    });

    if (createError || !authData.user) {
      console.error('[completeSignupWithToken] createUser error:', createError);
      if (createError?.message.includes('already registered') || createError?.message.includes('already exists')) {
        return { success: false, error: 'This email already has an account' };
      }
      return { success: false, error: 'Failed to create account. Please try again.' };
    }

    const userId = authData.user.id;

    // Create profile row
    await supabaseAdmin.from('profiles').insert({
      id: userId,
      email,
      business_name: businessName.trim(),
      username: username.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Create business_profiles row
    await supabaseAdmin.from('business_profiles').insert({
      user_id: userId,
      business_name: businessName.trim(),
      business_context: {},
      profile_completed: false,
    });

    // Mark token as used (best-effort — don't fail signup if this errors)
    await supabaseAdmin
      .from('signup_tokens')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('id', tokenRow.id);

    return { success: true };
  } catch (error) {
    console.error('[completeSignupWithToken] Unexpected error:', error);
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}
