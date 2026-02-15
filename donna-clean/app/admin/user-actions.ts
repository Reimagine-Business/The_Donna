"use server";

import { requireAdmin } from "@/lib/admin/check-admin";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function deactivateUser(userId: string) {
  try {
    await requireAdmin();
    const supabaseAdmin = getAdminClient();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: "876600h", // ~100 years = permanent
    });

    if (error) {
      console.error("[Admin] Deactivate error:", error);
      return { success: false, error: "Something went wrong. Please try again." };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/users/manage");
    return { success: true };
  } catch (err) {
    console.error("[Admin] Deactivate error:", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

export async function reactivateUser(userId: string) {
  try {
    await requireAdmin();
    const supabaseAdmin = getAdminClient();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });

    if (error) {
      console.error("[Admin] Reactivate error:", error);
      return { success: false, error: "Something went wrong. Please try again." };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/users/manage");
    return { success: true };
  } catch (err) {
    console.error("[Admin] Reactivate error:", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

export async function resetUserPassword(email: string) {
  try {
    await requireAdmin();
    const supabaseAdmin = getAdminClient();

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://thedonnaapp.co";

    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${siteUrl}/auth/update-password`,
      },
    });

    if (error) {
      console.error("[Admin] Reset password error:", error);
      return { success: false, error: "Something went wrong. Please try again." };
    }

    return { success: true };
  } catch (err) {
    console.error("[Admin] Reset password error:", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}
