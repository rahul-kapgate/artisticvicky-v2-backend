import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

import { processDueAccountDeletions } from "../services/accountDeletionScheduler.service.js";

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "AV Art Academy <noreply@artisticvickey.in>";

export async function sendDeleteAccountOtpEmail({ email, name, otp }) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Confirm your AV Art Academy account deletion",
    html: `
      <div
        style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: auto;
          padding: 24px;
          color: #222;
        "
      >
        <h2>Confirm Account Deletion</h2>

        <p>
          Hi ${name || "there"},
        </p>

        <p>
          We received a request to delete your AV Art Academy account.
        </p>

        <p>
          Enter the following verification code to continue:
        </p>

        <div
          style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            margin: 24px 0;
          "
        >
          ${otp}
        </div>

        <p>
          This code will expire in <strong>10 minutes</strong>.
        </p>

        <p>
          After successful verification, your account will be scheduled
          for permanent deletion after <strong>30 days</strong>.
        </p>

        <p>
          During those 30 days, you'll be able to reactivate your account.
        </p>

        <p>
          If you did not request this, you can safely ignore this email.
        </p>

        <br />

        <p>
          AV Art Academy
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || "Failed to send account deletion OTP");
  }

  return data;
}

export async function sendDeletionScheduledEmail({
  email,
  name,
  deletionDate,
}) {
  const formattedDeletionDate = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(deletionDate));

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Your AV Art Academy account deletion is scheduled",
    html: `
      <div
        style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: auto;
          padding: 24px;
          color: #222;
        "
      >
        <h2>Account Deletion Scheduled</h2>

        <p>
          Hi ${name || "there"},
        </p>

        <p>
          Your request to delete your AV Art Academy account
          has been confirmed.
        </p>

        <p>
          Your account is scheduled for permanent deletion on:
        </p>

        <h3>${formattedDeletionDate}</h3>

        <p>
          You can reactivate your account any time before this date.
        </p>

        <p>
          After the deletion date, the account deletion process
          will begin and recovery will no longer be available.
        </p>

        <br />

        <p>
          AV Art Academy
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(
      error.message || "Failed to send deletion confirmation email",
    );
  }

  return data;
}

export const runAccountDeletionCron = async (
  req,
  res,
) => {
  try {
    if (
      req.headers["x-cron-secret"] !==
      process.env.CRON_SECRET
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    console.log(
      "[AccountDeletionCron] Started:",
      new Date().toISOString(),
    );

    const result =
      await processDueAccountDeletions();

    console.log(
      "[AccountDeletionCron] Completed:",
      result,
    );

    return res.status(200).json({
      success: true,
      message:
        "Account deletion processing completed.",

      found: result.found,
      deleted: result.deleted,
      failed: result.failed,
    });
  } catch (error) {
    console.error(
      "[AccountDeletionCron] Error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Account deletion processing failed.",
    });
  }
};
