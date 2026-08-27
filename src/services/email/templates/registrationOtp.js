const escapeHtml = (value = "") => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

export const registrationOtpTemplate = ({ name, otp, expiryMinutes }) => {
  const safeName = escapeHtml(name);

  return {
    subject: "Verify your Artistic Vicky account",

    text: `
Hi ${name},

Your Artistic Vicky verification code is:

${otp}

This code expires in ${expiryMinutes} minutes.

If you did not request this registration, you can ignore this email.
    `.trim(),

    html: `
      <div
        style="
          font-family: Arial, sans-serif;
          max-width: 520px;
          margin: 0 auto;
          padding: 24px;
        "
      >
        <h2>Verify your email</h2>

        <p>Hi ${safeName},</p>

        <p>
          Use the following verification code
          to complete your Artistic Vicky registration.
        </p>

        <div
          style="
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 8px;
            margin: 28px 0;
          "
        >
          ${otp}
        </div>

        <p>
          This code expires in ${expiryMinutes} minutes.
        </p>

        <p>
          If you did not request this registration,
          you can safely ignore this email.
        </p>
      </div>
    `,
  };
};
