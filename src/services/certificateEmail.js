import dotenv from "dotenv";
import { resend } from "../config/resendClient.js";

dotenv.config();

export async function sendCertificateEmail({
  toEmail,
  toName,
  pdfBuffer,
  certificateNumber,
  courseName,
}) {
  const pdfBase64 = pdfBuffer.toString("base64");
  const displayName = toName || "Student";

  const { data, error } = await resend.emails.send({
    from:
      process.env.RESEND_FROM_EMAIL ||
      "Artistic Vicky <certificate@artisticvickey.in>",
    to: [toEmail],
    subject: `Certificate for ${courseName}`,
    html: `
      <div style="margin:0; padding:24px; background:#f8f5ee; font-family:Arial, sans-serif;">
        <table
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          border="0"
          width="100%"
          style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #e7d9a8; border-radius:12px; overflow:hidden;"
        >
          <tr>
            <td style="background:#7f1d1d; padding:18px 24px; text-align:center;">
              <div style="color:#ffffff; font-size:24px; font-weight:700;">
                Artistic Vicky
              </div>
              <div style="color:#f1df9b; font-size:12px; margin-top:4px;">
                Certificate of Completion
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 24px; color:#334155;">
              <p style="margin:0 0 16px 0; font-size:16px;">
                Hi ${displayName},
              </p>

              <p style="margin:0 0 18px 0; font-size:15px; line-height:1.7;">
                Congratulations. Your certificate for completing
                <strong>${courseName}</strong> is attached to this email.
              </p>

              <div
                style="
                  margin:0 0 20px 0;
                  padding:14px 16px;
                  background:#fff8e6;
                  border:1px solid #d4b24c;
                  border-radius:10px;
                  color:#0f172a;
                  font-size:14px;
                "
              >
                <strong>Certificate No:</strong> ${certificateNumber}
              </div>

              <p style="margin:0 0 20px 0; font-size:14px; line-height:1.7;">
                Please find your certificate PDF attached.
              </p>

              <p style="margin:0; font-size:14px; line-height:1.7;">
                Regards,<br />
                <strong>Artistic Vicky Team</strong>
              </p>
            </td>
          </tr>
        </table>
      </div>
    `,
    attachments: [
      {
        filename: `certificate-${certificateNumber}.pdf`,
        content: pdfBase64,
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Failed to send certificate email");
  }

  return data;
}
