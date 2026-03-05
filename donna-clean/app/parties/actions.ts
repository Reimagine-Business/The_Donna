"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import type { Party, CreatePartyInput, UpdatePartyInput } from "@/lib/parties";
import * as Sentry from "@sentry/nextjs";

/**
 * Get all parties for the current user
 */
export async function getParties(): Promise<{
  success: boolean;
  parties?: Party[];
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("parties")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (error) {
      console.error("[getParties] Query error:", error);
      Sentry.captureException(error, { tags: { action: 'get-parties' } });
      return { success: false, error: "Something went wrong. Please try again." };
    }

    return { success: true, parties: data as Party[] };
  } catch (error) {
    console.error("[getParties] Unexpected error:", error);
    Sentry.captureException(error, { tags: { action: 'get-parties' } });
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

/**
 * Get a single party by ID
 */
export async function getParty(id: string): Promise<{
  success: boolean;
  party?: Party;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("parties")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("[getParty] Query error:", error);
      Sentry.captureException(error, { tags: { action: 'get-party' } });
      return { success: false, error: "Something went wrong. Please try again." };
    }

    return { success: true, party: data as Party };
  } catch (error) {
    console.error("[getParty] Unexpected error:", error);
    Sentry.captureException(error, { tags: { action: 'get-party' } });
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

/**
 * Create a new party
 */
export async function createParty(input: CreatePartyInput): Promise<{
  success: boolean;
  party?: Party;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Validate input
    if (!input.name || input.name.trim().length === 0) {
      return { success: false, error: "Party name is required" };
    }

    if (!input.party_type) {
      return { success: false, error: "Party type is required" };
    }

    const { data, error } = await supabase
      .from("parties")
      .insert({
        user_id: user.id,
        name: input.name.trim(),
        mobile: input.mobile?.trim() || null,
        party_type: input.party_type,
        opening_balance: input.opening_balance || 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating party:", error);

      // Handle duplicate name error
      if (error.code === '23505') {
        return { success: false, error: "A party with this name already exists" };
      }

      Sentry.captureException(error, { tags: { action: 'create-party' } });
      return { success: false, error: "Something went wrong. Please try again." };
    }

    // Revalidate paths that might show parties
    revalidatePath("/entries");
    revalidatePath("/parties");
    revalidatePath("/analytics/cashpulse");

    return { success: true, party: data as Party };
  } catch (error) {
    console.error("[createParty] Unexpected error:", error);
    Sentry.captureException(error, { tags: { action: 'create-party' } });
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

/**
 * Update an existing party
 */
export async function updateParty(
  id: string,
  updates: UpdatePartyInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Build update object
    const updateData: Record<string, string | number | null> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) {
      if (updates.name.trim().length === 0) {
        return { success: false, error: "Party name cannot be empty" };
      }
      updateData.name = updates.name.trim();
    }

    if (updates.mobile !== undefined) {
      updateData.mobile = updates.mobile?.trim() || null;
    }

    if (updates.party_type !== undefined) {
      updateData.party_type = updates.party_type;
    }

    if (updates.opening_balance !== undefined) {
      updateData.opening_balance = updates.opening_balance;
    }

    const { error } = await supabase
      .from("parties")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating party:", error);

      // Handle duplicate name error
      if (error.code === '23505') {
        return { success: false, error: "A party with this name already exists" };
      }

      Sentry.captureException(error, { tags: { action: 'update-party' } });
      return { success: false, error: "Something went wrong. Please try again." };
    }

    // Revalidate paths
    revalidatePath("/entries");
    revalidatePath("/parties");
    revalidatePath("/analytics/cashpulse");

    return { success: true };
  } catch (error) {
    console.error("[updateParty] Unexpected error:", error);
    Sentry.captureException(error, { tags: { action: 'update-party' } });
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

/**
 * Delete a party
 * Note: This will set party_id to NULL in all related entries (ON DELETE SET NULL)
 */
export async function deleteParty(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("parties")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[deleteParty] Delete error:", error);
      Sentry.captureException(error, { tags: { action: 'delete-party' } });
      return { success: false, error: "Something went wrong. Please try again." };
    }

    // Revalidate paths
    revalidatePath("/entries");
    revalidatePath("/parties");
    revalidatePath("/analytics/cashpulse");

    return { success: true };
  } catch (error) {
    console.error("[deleteParty] Unexpected error:", error);
    Sentry.captureException(error, { tags: { action: 'delete-party' } });
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

/**
 * Get all parties for the current user with their pending (outstanding unsettled) amount
 */
export async function getPartiesWithBalance(): Promise<{
  success: boolean;
  parties?: (Party & { pending_amount: number })[];
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: parties, error: partiesError } = await supabase
      .from("parties")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (partiesError) {
      console.error("[getPartiesWithBalance] Query error:", partiesError);
      Sentry.captureException(partiesError, { tags: { action: 'get-parties-with-balance' } });
      return { success: false, error: "Something went wrong. Please try again." };
    }

    // For each party, sum remaining_amount of unsettled entries
    const { data: entries, error: entriesError } = await supabase
      .from("entries")
      .select("party_id, remaining_amount")
      .eq("user_id", user.id)
      .eq("settled", false)
      .not("party_id", "is", null);

    if (entriesError) {
      console.error("[getPartiesWithBalance] Entries query error:", entriesError);
      Sentry.captureException(entriesError, { tags: { action: 'get-parties-with-balance' } });
      return { success: false, error: "Something went wrong. Please try again." };
    }

    // Build a map of party_id -> pending_amount
    const pendingMap: Record<string, number> = {};
    for (const entry of entries ?? []) {
      if (entry.party_id && entry.remaining_amount != null) {
        pendingMap[entry.party_id] =
          (pendingMap[entry.party_id] ?? 0) + parseFloat(entry.remaining_amount);
      }
    }

    const result = (parties as Party[]).map((p) => ({
      ...p,
      pending_amount: pendingMap[p.id] ?? 0,
    }));

    return { success: true, parties: result };
  } catch (error) {
    console.error("[getPartiesWithBalance] Unexpected error:", error);
    Sentry.captureException(error, { tags: { action: 'get-parties-with-balance' } });
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

/**
 * Get party balance (opening balance + all transactions)
 */
export async function getPartyBalance(partyId: string): Promise<{
  success: boolean;
  balance?: number;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data, error } = await supabase.rpc('get_party_balance', {
      p_party_id: partyId,
    });

    if (error) {
      console.error("[getPartyBalance] RPC error:", error);
      Sentry.captureException(error, { tags: { action: 'get-party-balance' } });
      return { success: false, error: "Something went wrong. Please try again." };
    }

    return { success: true, balance: data };
  } catch (error) {
    console.error("[getPartyBalance] Unexpected error:", error);
    Sentry.captureException(error, { tags: { action: 'get-party-balance' } });
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}
