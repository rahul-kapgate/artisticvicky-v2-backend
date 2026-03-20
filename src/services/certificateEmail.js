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
    from: process.env.RESEND_FROM_EMAIL || "Artistic Vicky <onboarding@resend.dev>",
    to: [toEmail],
    subject: `Your Certificate - ${courseName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Artistic Vicky</h2>
        <p>Hi ${displayName},</p>
        <p>Your certificate for <strong>${courseName}</strong> has been generated successfully.</p>
        <p><strong>Certificate Number:</strong> ${certificateNumber}</p>
        <p>Please find your certificate attached as a PDF.</p>
        <p>Regards,<br/>Artistic Vicky Team</p>
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