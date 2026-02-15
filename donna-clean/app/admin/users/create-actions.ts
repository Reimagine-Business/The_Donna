'use server';

import { requireAdmin } from '@/lib/admin/check-admin';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

interface CreateUserData {
  email: string;
  password: string;
  businessName: string;
  username: string;
  phone?: string;
}

/**
 * Directly creates a new user account (like Supabase dashboard)
 * No email required - creates account immediately
 */
export async function createUserDirect(userData: CreateUserData) {
  try {
    // Verify admin access
    await requireAdmin();

    // Validate required fields
    if (!userData.email || !userData.password || !userData.businessName || !userData.username) {
      return {
        success: false,
        error: 'All required fields must be filled',
      };
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(userData.username)) {
      return {
        success: false,
        error: 'Username must be 3-20 characters (letters, numbers, _ or - only)',
      };
    }

    // CRITICAL: Use service role for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if username is already taken
    const { data: existingUsername } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('username', userData.username)
      .maybeSingle();

    if (existingUsername) {
      return {
        success: false,
        error: 'Username is already taken',
      };
    }

    // Create user directly using admin API
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        business_name: userData.businessName,
        username: userData.username,
        phone: userData.phone || null,
      },
    });

    if (createError) {
      console.error('User creation error:', createError);

      if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
        return {
          success: false,
          error: 'This email is already registered.',
        };
      }

      return {
        success: false,
        error: 'Something went wrong. Please try again.',
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'User creation failed - no user returned',
      };
    }

    // Create profile with extended data
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: userData.email,
        business_name: userData.businessName,
        username: userData.username,
        phone: userData.phone || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // User created but profile failed - don't fail completely
    }

    // Revalidate admin pages
    revalidatePath('/admin/users/manage');
    revalidatePath('/admin/users/monitor');

    return {
      success: true,
      message: `User ${userData.email} created successfully!`,
      user: {
        id: authData.user.id,
        email: userData.email,
        username: userData.username,
      },
    };
  } catch (error) {
    console.error('[createUserDirect] Unexpected error:', error);
    return {
      success: false,
      error: 'Something went wrong. Please try again.',
    };
  }
}

/**
 * Generate a random secure password
 * Must be async because it's exported from a server action file
 */
export async function generatePassword(): Promise<string> {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special

  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
