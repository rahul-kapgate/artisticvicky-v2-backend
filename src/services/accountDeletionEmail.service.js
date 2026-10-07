import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "AV Art Academy <noreply@artisticvickey.in>";

/* =========================================================
   DELETE ACCOUNT OTP EMAIL
========================================================= */

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
          This code will expire in
          <strong>10 minutes</strong>.
        </p>

        <p>
          After successful verification,
          your account will be scheduled for
          permanent deletion after
          <strong>30 days</strong>.
        </p>

        <p>
          During those 30 days,
          you can reactivate your account.
        </p>

        <p>
          If you did not request this,
          you can safely ignore this email.
        </p>

        <br />

        <p>
          AV Art Academy
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[Email] Delete OTP email error:", error);

    throw new Error(error.message || "Failed to send account deletion OTP");
  }

  return data;
}

/* =========================================================
   DELETION SCHEDULED EMAIL
========================================================= */

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
        <h2>
          Account Deletion Scheduled
        </h2>

        <p>
          Hi ${name || "there"},
        </p>

        <p>
          Your request to delete your AV Art Academy
          account has been confirmed.
        </p>

        <p>
          Your account is scheduled for permanent
          deletion on:
        </p>

        <h3>
          ${formattedDeletionDate}
        </h3>

        <p>
          You can reactivate your account any time
          before this date.
        </p>

        <p>
          After the deletion date,
          the account recovery period will end.
        </p>

        <br />

        <p>
          AV Art Academy
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[Email] Scheduled deletion email error:", error);

    throw new Error(
      error.message || "Failed to send deletion confirmation email",
    );
  }

  return data;
}

/* =========================================================
   PERMANENT ACCOUNT DELETED EMAIL
========================================================= */

export async function sendAccountDeletedEmail({ email, name }) {
  if (!email) {
    throw new Error("Account deletion email address is missing");
  }

  console.log(`[Email] Sending permanent deletion email to ${email}`);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,

    subject: "Your AV Art Academy account has been deleted",

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
        <h2>
          Account Deleted
        </h2>

        <p>
          Hi ${name || "there"},
        </p>

        <p>
          Your AV Art Academy account has now been
          permanently deleted.
        </p>

        <p>
          Your account can no longer be recovered.
        </p>

        <p>
          If you would like to use AV Art Academy
          again in the future, you can create a
          new account.
        </p>

        <br />

        <p>
          Thank you,<br />
          AV Art Academy
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[Email] Permanent deletion email error:", error);

    throw new Error(error.message || "Failed to send account deletion email");
  }

  console.log("[Email] Permanent deletion email sent:", data);

  return data;
}
