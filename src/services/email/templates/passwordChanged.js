const escapeHtml = (
  value = ""
) => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};


export const passwordChangedTemplate = ({
  name,
}) => {
  const safeName =
    escapeHtml(name);

  return {
    subject:
      "Your AV Art Academy password was changed",

    text: `
Hi ${name},

Your AV Art Academy password was successfully changed.

If you made this change, no further action is required.

If you did not make this change, please contact support immediately.

AV Art Academy
    `.trim(),

    html: `
<div
  style="
    font-family:Arial,Helvetica,sans-serif;
    max-width:520px;
    margin:auto;
    background:#0b1129;
    color:#ffffff;
    padding:36px;
    border-radius:16px;
  "
>

  <h2>
    Password changed
  </h2>

  <p
    style="
      color:#a9b3cf;
      line-height:1.7;
    "
  >
    Hi ${safeName},
  </p>

  <p
    style="
      color:#a9b3cf;
      line-height:1.7;
    "
  >
    Your AV Art Academy password
    was successfully changed.
  </p>

  <p
    style="
      color:#a9b3cf;
      line-height:1.7;
    "
  >
    If you did not make this change,
    please contact support immediately.
  </p>

</div>
    `.trim(),
  };
};