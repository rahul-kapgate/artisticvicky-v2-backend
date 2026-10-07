import { supabase } from "../config/supabaseClient.js";

import { permanentlyDeleteAccount } from "./permanentAccountDeletion.service.js";

import { sendDeletionScheduledEmail } from "./accountDeletionEmail.service.js";

export const processDueAccountDeletions = async () => {
  const now = new Date().toISOString();

  console.log(`[AccountDeletion] Checking accounts at ${now}`);

  /*
   * Find users whose 30-day recovery period
   * has expired.
   */
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
    console.error("[AccountDeletion] Failed to find due accounts:", error);

    throw error;
  }

  if (!users?.length) {
    console.log("[AccountDeletion] No accounts due for deletion.");

    return {
      found: 0,
      deleted: 0,
      failed: 0,
    };
  }

  console.log(`[AccountDeletion] ${users.length} account(s) due for deletion.`);

  let deleted = 0;
  let failed = 0;

  const results = [];

  /*
   * Process sequentially initially.
   *
   * This is safer for external storage/database cleanup
   * and easier to debug.
   */
  for (const user of users) {
    try {
      console.log(`[AccountDeletion] Processing user ${user.id}`);

      /*
       * permanentlyDeleteAccount:
       *
       * 1. validates deadline
       * 2. deletes external files
       * 3. runs finalize_user_deletion()
       * 4. returns email/name temporarily
       */
      const result = await permanentlyDeleteAccount(user.id);

      deleted += 1;

      console.log(`[AccountDeletion] User ${user.id} permanently deleted.`);

      /*
       * Send email AFTER successful deletion.
       *
       * Email/name are only being held in Node memory.
       */
      try {
        await sendAccountDeletedEmail({
          email: result.email,
          name: result.name,
        });

        console.log(`[AccountDeletion] Final email sent for user ${user.id}`);
      } catch (emailError) {
        /*
         * Important:
         *
         * Account deletion was successful.
         * Email failure must NOT restore the account.
         */
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
