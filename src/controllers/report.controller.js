import { supabase } from "../config/supabaseClient.js";

import { sendDailyUsersReportEmail } from "../services/email.service.js";

export const sendDailyReport = async (req, res) => {
  try {
    // ============================================
    // SECURITY
    // ============================================

    if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const now = new Date();

    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const from = last24Hours.toISOString();

    const to = now.toISOString();

    // ============================================
    // 1. NEW USERS
    // ============================================

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select(
        `
        id,
        email,
        user_name,
        mobile,
        created_at
      `,
      )
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", {
        ascending: false,
      });

    if (usersError) {
      throw usersError;
    }

    // ============================================
    // 2. USERS WHO REQUESTED DELETION
    // ============================================

    const { data: pendingDeletionUsers, error: pendingDeletionError } =
      await supabase
        .from("users")
        .select(
          `
        id,
        email,
        user_name,
        mobile,
        deletion_requested_at,
        deletion_scheduled_at
      `,
        )
        .eq("account_status", "pending_deletion")
        .gte("deletion_requested_at", from)
        .lte("deletion_requested_at", to)
        .order("deletion_requested_at", {
          ascending: false,
        });

    if (pendingDeletionError) {
      throw pendingDeletionError;
    }

    // ============================================
    // 3. ACCOUNTS PERMANENTLY DELETED
    // ============================================

    const { data: deletedAccounts, error: deletedAccountsError } =
      await supabase
        .from("account_deletion_audit")
        .select(
          `
        deleted_user_id,
        email_masked,
        deleted_at,
        status
      `,
        )
        .eq("status", "deleted")
        .gte("deleted_at", from)
        .lte("deleted_at", to)
        .order("deleted_at", {
          ascending: false,
        });

    if (deletedAccountsError) {
      throw deletedAccountsError;
    }

    // ============================================
    // SEND ADMIN REPORT
    // ============================================

    await sendDailyUsersReportEmail({
      users: users || [],

      pendingDeletionUsers: pendingDeletionUsers || [],

      deletedAccounts: deletedAccounts || [],

      reportFrom: from,

      reportTo: to,
    });

    return res.status(200).json({
      success: true,

      period: {
        from,
        to,
      },

      newUsers: users?.length || 0,

      pendingDeletion: pendingDeletionUsers?.length || 0,

      deletedAccounts: deletedAccounts?.length || 0,
    });
  } catch (err) {
    console.error("Daily report error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to send daily report",
    });
  }
};
