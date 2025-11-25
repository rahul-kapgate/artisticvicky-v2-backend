import dotenv from "dotenv";
import { resend } from "../config/resendClient.js";

dotenv.config();

/**
 * Sends invoice email with attached PDF.
 *
 * @param {Object} params
 * @param {string} params.toEmail
 * @param {string} params.toName
 * @param {Buffer} params.pdfBuffer
 * @param {string} params.invoiceNumber
 * @param {string} params.courseName
 * @param {number} params.amount
 */
export async function sendInvoiceEmail({
  toEmail,
  toName,
  pdfBuffer,
  invoiceNumber,
  courseName,
  amount,
}) {
  const pdfBase64 = pdfBuffer.toString("base64");
  const displayName = toName || "Student";

  const { data, error } = await resend.emails.send({
    from: "Artistic Vickey Billing <billing@artisticvickey.in>",
    to: [toEmail],
    subject: `Invoice #${invoiceNumber} – ${courseName}`,
    html: `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; color: #0f172a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px 20px;">
          <!-- Header -->
          <div style="margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
            <div style="font-size: 18px; font-weight: 700; color: #111827;">
              Artistic Vickey
            </div>
          </div>

          <!-- Greeting -->
          <p style="margin: 0 0 8px;">Hi ${displayName},</p>

          <!-- Intro -->
          <p style="margin: 0 0 8px;">
            Thank you for enrolling in 
            <strong>${courseName}</strong> with Artistic Vickey.
          </p>

          <!-- Summary box -->
          <div style="margin: 16px 0; padding: 12px 14px; border-radius: 8px; background: #f9fafb; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 4px; font-weight: 600; font-size: 13px; color: #111827;">
              Invoice Summary
            </p>
            <p style="margin: 2px 0; font-size: 13px;">
              <strong>Invoice No:</strong> ${invoiceNumber}
            </p>
            <p style="margin: 2px 0; font-size: 13px;">
              <strong>Course:</strong> ${courseName}
            </p>
            <p style="margin: 2px 0; font-size: 13px;">
              <strong>Amount:</strong> ₹${Number(amount).toFixed(2)}
            </p>
          </div>

          <!-- Attachment note -->
          <p style="margin: 0 0 8px;">
            Your detailed invoice has been generated and is attached to this email as a PDF file. 
            Please download and keep it for your records.
          </p>

          <!-- Refund policy -->
          <p style="margin: 8px 0; font-size: 12px; color: #b91c1c;">
            <strong>Refund Policy:</strong> Fees once paid are <strong>non-refundable and non-transferable</strong> under any circumstances.
          </p>

          <!-- Help / support -->
          <p style="margin: 0 0 8px;">
            If you notice any discrepancy in the amount or course details, or if you have 
            any questions about this invoice, please reply to this email or contact us at 
            <a href="mailto:vikkitembhurne358@gmail.com" style="color: #2563eb; text-decoration: none;">
              vikkitembhurne358@gmail.com
            </a>.
          </p>

          <!-- Closing -->
          <p style="margin: 16px 0 4px;">
            Warm regards,<br/>
            <span style="font-weight: 600;">Artistic Vickey Team</span>
          </p>

          <!-- Footer -->
          <p style="margin: 12px 0 0; font-size: 11px; color: #9ca3af;">
            This is a system-generated email for your invoice. If you did not enroll in this course 
            or believe this message was sent to you in error, please contact us immediately.
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `invoice-${invoiceNumber}.pdf`,
        content: pdfBase64,
      },
    ],
  });

  if (error) {
    console.error("Resend invoice error:", error);
    throw new Error("Failed to send invoice email");
  }

  return data;
}
