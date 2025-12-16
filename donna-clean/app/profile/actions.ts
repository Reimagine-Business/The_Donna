"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";

type DeleteAccountResult = {
  success?: boolean;
  error?: string;
};

export async function deleteAccount(confirmText: string): Promise<DeleteAccountResult> {
  // Validate confirmation text
  if (confirmText !== "DELETE MY ACCOUNT") {
    return { error: "Invalid confirmation text" };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Delete all user data in order (respecting foreign key constraints)
    // 1. Delete settlements history
    await supabase.from("settlement_history").delete().eq("user_id", user.id);

    // 2. Delete alerts
    await supabase.from("alerts").delete().eq("user_id", user.id);

    // 3. Delete reminders
    await supabase.from("reminders").delete().eq("user_id", user.id);

    // 4. Delete entries
    await supabase.from("daily_entries").delete().eq("user_id", user.id);

    // 5. Delete parties
    await supabase.from("parties").delete().eq("user_id", user.id);

    // Finally, delete the user account from auth
    const { error: deleteError } = await supabase.rpc("delete_user");

    if (deleteError) {
      console.error("Error deleting user account:", deleteError);
      return { error: "Failed to delete account. Please contact support." };
    }

    // Sign out
    await supabase.auth.signOut();

    return { success: true };
  } catch (error) {
    console.error("Error in deleteAccount:", error);
    return { error: "An unexpected error occurred" };
  }
}
