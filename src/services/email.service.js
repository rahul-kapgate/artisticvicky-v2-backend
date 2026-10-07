import { resend } from "../config/resendClient.js";
import dotenv from "dotenv";

dotenv.config();

const adminMail = process.env.ADMIN_MAIL;

/**
 * Send daily users report email
 */
export const sendDailyUsersReportEmail = async ({
  users = [],
  pendingDeletionUsers = [],
  deletedAccounts = [],
  reportFrom,
  reportTo,
}) => {
  const adminEmail = process.env.ADMIN_REPORT_EMAIL;

  if (!adminEmail) {
    throw new Error("ADMIN_REPORT_EMAIL is not configured");
  }

  const formatDateTime = (date) => {
    if (!date) return "-";

    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(date));
  };

  // ============================================
  // NEW USERS
  // ============================================

  const newUserRows =
    users.length > 0
      ? users
          .map(
            (user) => `
                <tr>
                  <td style="padding:8px;border:1px solid #ddd;">
                    ${user.id}
                  </td>

                  <td style="padding:8px;border:1px solid #ddd;">
                    ${user.user_name || "-"}
                  </td>

                  <td style="padding:8px;border:1px solid #ddd;">
                    ${user.email || "-"}
                  </td>

                  <td style="padding:8px;border:1px solid #ddd;">
                    ${user.mobile || "-"}
                  </td>

                  <td style="padding:8px;border:1px solid #ddd;">
                    ${formatDateTime(user.created_at)}
                  </td>
                </tr>
              `,
          )
          .join("")
      : `
          <tr>
            <td
              colspan="5"
              style="
                padding:12px;
                border:1px solid #ddd;
                text-align:center;
              "
            >
              No new users.
            </td>
          </tr>
        `;

  // ============================================
  // PENDING DELETION
  // ============================================

  const pendingRows =
    pendingDeletionUsers.length > 0
      ? pendingDeletionUsers
          .map(
            (user) => `
                <tr>
                  <td style="padding:8px;border:1px solid #ddd;">
                    ${user.id}
                  </td>

                  <td style="padding:8px;border:1px solid #ddd;">
                    ${user.user_name || "-"}
                  </td>

                  <td style="padding:8px;border:1px solid #ddd;">
                    ${user.email || "-"}
                  </td>

                  <td style="padding:8px;border:1px solid #ddd;">
                    ${formatDateTime(user.deletion_requested_at)}
                  </td>

                  <td style="padding:8px;border:1px solid #ddd;">
                    ${formatDateTime(user.deletion_scheduled_at)}
                  </td>
                </tr>
              `,
          )
          .join("")
      : `
          <tr>
            <td
              colspan="5"
              style="
                padding:12px;
                border:1px solid #ddd;
                text-align:center;
              "
            >
              No account deletion requests.
            </td>
          </tr>
        `;

  // ============================================
  // PERMANENTLY DELETED
  // ============================================

  const deletedRows =
    deletedAccounts.length > 0
      ? deletedAccounts
          .map(
            (account) => `
                <tr>
                  <td style="padding:8px;border:1px solid #ddd;">
                    ${account.deleted_user_id || "-"}
                  </td>

                  <td style="padding:8px;border:1px solid #ddd;">
                    ${account.email_masked || "-"}
                  </td>

                  <td style="padding:8px;border:1px solid #ddd;">
                    ${formatDateTime(account.deleted_at)}
                  </td>
                </tr>
              `,
          )
          .join("")
      : `
          <tr>
            <td
              colspan="3"
              style="
                padding:12px;
                border:1px solid #ddd;
                text-align:center;
              "
            >
              No accounts permanently deleted.
            </td>
          </tr>
        `;

  const html = `
      <div
        style="
          font-family:Arial,sans-serif;
          max-width:1000px;
          margin:auto;
          padding:24px;
          color:#222;
        "
      >

        <h2>
          AV Art Academy
          — Daily Report
        </h2>

        <p>
          ${formatDateTime(reportFrom)}
          —
          ${formatDateTime(reportTo)}
        </p>


        <!-- ============================= -->
        <!-- SUMMARY -->
        <!-- ============================= -->

        <div
          style="
            background:#f5f5f5;
            padding:18px;
            margin:20px 0;
          "
        >

          <strong>
            New Users:
          </strong>
          ${users.length}

          <br /><br />

          <strong>
            Deletion Requests:
          </strong>
          ${pendingDeletionUsers.length}

          <br /><br />

          <strong>
            Permanently Deleted:
          </strong>
          ${deletedAccounts.length}

        </div>


        <!-- ============================= -->
        <!-- NEW USERS -->
        <!-- ============================= -->

        <h3>
          New Users
        </h3>

        <table
          style="
            width:100%;
            border-collapse:collapse;
          "
        >

          <thead>
            <tr>

              <th style="padding:8px;border:1px solid #ddd;">
                ID
              </th>

              <th style="padding:8px;border:1px solid #ddd;">
                Name
              </th>

              <th style="padding:8px;border:1px solid #ddd;">
                Email
              </th>

              <th style="padding:8px;border:1px solid #ddd;">
                Mobile
              </th>

              <th style="padding:8px;border:1px solid #ddd;">
                Registered
              </th>

            </tr>
          </thead>

          <tbody>
            ${newUserRows}
          </tbody>

        </table>


        <br /><br />


        <!-- ============================= -->
        <!-- DELETION REQUESTS -->
        <!-- ============================= -->

        <h3>
          Account Deletion Requests
        </h3>

        <table
          style="
            width:100%;
            border-collapse:collapse;
          "
        >

          <thead>
            <tr>

              <th style="padding:8px;border:1px solid #ddd;">
                ID
              </th>

              <th style="padding:8px;border:1px solid #ddd;">
                Name
              </th>

              <th style="padding:8px;border:1px solid #ddd;">
                Email
              </th>

              <th style="padding:8px;border:1px solid #ddd;">
                Requested
              </th>

              <th style="padding:8px;border:1px solid #ddd;">
                Scheduled
              </th>

            </tr>
          </thead>

          <tbody>
            ${pendingRows}
          </tbody>

        </table>


        <br /><br />


        <!-- ============================= -->
        <!-- DELETED ACCOUNTS -->
        <!-- ============================= -->

        <h3>
          Permanently Deleted Accounts
        </h3>

        <table
          style="
            width:100%;
            border-collapse:collapse;
          "
        >

          <thead>
            <tr>

              <th style="padding:8px;border:1px solid #ddd;">
                Previous User ID
              </th>

              <th style="padding:8px;border:1px solid #ddd;">
                Email
              </th>

              <th style="padding:8px;border:1px solid #ddd;">
                Deleted
              </th>

            </tr>
          </thead>

          <tbody>
            ${deletedRows}
          </tbody>

        </table>


        <br />

        <p>
          AV Art Academy automated daily report.
        </p>

      </div>
    `;

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,

    to: adminEmail,

    subject: `AV Art Academy Daily Report - ${new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date())}`,

    html,
  });

  if (error) {
    throw new Error(error.message || "Failed to send daily report");
  }

  return data;
};
