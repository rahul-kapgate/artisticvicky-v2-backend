import { resend } from "../config/resendClient.js";
import dotenv from "dotenv";

dotenv.config();

const adminMail = process.env.ADMIN_MAIL;

/**
 * Send daily users report email
 */
export const sendDailyUsersReportEmail = async ({ users }) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const formattedDate = yesterday.toISOString().split("T")[0];

  const html = `
    <h2>Users Registered on ${formattedDate}</h2>

    ${
      users.length === 0
        ? `<p>No users registered on this day.</p>`
        : `
    <table style="border-collapse: collapse; width: 100%; font-family: Arial;">
      <thead>
        <tr>
          <th style="border: 1px solid #ddd; padding: 8px;">Name</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Email</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Mobile</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Reg. At</th>
        </tr>
      </thead>
      <tbody>
        ${users
          .map(
            (u) => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">
                  ${u.user_name || "N/A"}
                </td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                  ${u.email}
                </td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                  ${u.mobile || "N/A"}
                </td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                  ${
                    u.created_at
                      ? new Date(u.created_at).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/A"
                  }
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `
    }
`;

  const { data, error } = await resend.emails.send({
    from: "Artistic Vickey <no-reply@artisticvickey.in>",
    to: [`${adminMail}`],
    subject: `${formattedDate} Users Registration Report (${users.length})`,
    html,
  });

  if (error) {
    console.error("Daily report email error:", error);
    throw new Error("Failed to send daily report email");
  }

  return data;
};
