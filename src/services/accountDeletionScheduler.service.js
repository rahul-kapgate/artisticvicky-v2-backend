import { supabase } from "../config/supabaseClient.js";

import { permanentlyDeleteAccount } from "./permanentAccountDeletion.service.js";

import { sendAccountDeletedEmail } from "./accountDeletionEmail.service.js";

export const processDueAccountDeletions = async () => {
  const now = new Date().toISOString();

  console.log(`[AccountDeletion] Checking accounts at ${now}`);

  const { data: users, error } = await supabase
    .from("users")
    .select(
      `
        id,
        email,
        user_name,
        account_status,
        deletion_scheduled_at,
        is_admin
      `,
    )
    .eq("account_status", "pending_deletion")
    .eq("is_admin", false)
    .not("deletion_scheduled_at", "is", null)
    .lte("deletion_scheduled_at", now);

  if (error) {
    throw error;
  }

  if (!users?.length) {
    console.log("[AccountDeletion] No accounts due for deletion.");

    return {
      found: 0,
      deleted: 0,
      failed: 0,
      results: [],
    };
  }

  console.log(`[AccountDeletion] ${users.length} account(s) due for deletion.`);

  let deleted = 0;
  let failed = 0;

  const results = [];

  for (const user of users) {
    try {
      /*
       * Save information BEFORE deleting the row.
       */
      const email = user.email;
      const name = user.user_name;

      console.log(`[AccountDeletion] Processing user ${user.id}`);

      await permanentlyDeleteAccount(user.id);

      deleted += 1;

      console.log(`[AccountDeletion] User ${user.id} permanently deleted.`);

      /*
       * The DB user is gone now,
       * but email/name are still in memory.
       */
      try {
        await sendAccountDeletedEmail({
          email,
          name,
        });

        console.log(`[AccountDeletion] Final email sent for user ${user.id}`);
      } catch (emailError) {
        console.error(
          `[AccountDeletion] Account deleted but final email failed for user ${user.id}:`,
          emailError,
        );
      }

      results.push({
        userId: user.id,
        success: true,
      });
    } catch (error) {
      failed += 1;

      console.error(
        `[AccountDeletion] Failed to delete user ${user.id}:`,
        error,
      );

      results.push({
        userId: user.id,
        success: false,

        error: error?.message || "Unknown deletion error",
      });
    }
  }

  return {
    found: users.length,
    deleted,
    failed,
    results,
  };
};
