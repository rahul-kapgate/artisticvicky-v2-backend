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


export const forgotPasswordOtpTemplate = ({
  name,
  otp,
  expiryMinutes,
}) => {
  const safeName =
    escapeHtml(name);

  const safeOtp =
    escapeHtml(otp);


  return {
    subject:
      "Reset your AV Art Academy password",

    text: `
Hi ${name},

We received a request to reset your AV Art Academy password.

Your verification code is:

${otp}

This code expires in ${expiryMinutes} minutes.

Never share this verification code with anyone.

If you did not request this password reset, you can safely ignore this email.
    `.trim(),

    html: `
<!DOCTYPE html>

<html>
<body
  style="
    margin:0;
    padding:0;
    background:#050a1c;
    font-family:Arial,Helvetica,sans-serif;
  "
>

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    padding:48px 16px;
    background:#050a1c;
  "
>

<tr>
<td align="center">

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    max-width:520px;
    background:#0b1129;
    border:1px solid #1d2851;
    border-radius:18px;
    overflow:hidden;
  "
>

<tr>
<td
  height="4"
  style="
    background:linear-gradient(
      90deg,
      #ff3fa7,
      #7c3aed,
      #33d6ff
    );
  "
></td>
</tr>


<tr>
<td
  align="center"
  style="
    padding:40px;
  "
>

<div
  style="
    color:#ffffff;
    font-size:19px;
    font-weight:800;
  "
>
  AV

  <span
    style="
      color:#ff3fa7;
    "
  >
    ART
  </span>

  ACADEMY
</div>


<h1
  style="
    margin:34px 0 12px;
    color:#ffffff;
    font-size:27px;
  "
>
  Reset your password
</h1>


<p
  style="
    margin:0 0 28px;
    color:#a9b3cf;
    font-size:15px;
    line-height:1.7;
  "
>
  Hi ${safeName}, use this code to
  verify your password reset request.
</p>


<div
  style="
    background:#101938;
    border:1px solid #26345f;
    border-radius:14px;
    padding:28px 20px;
  "
>

<div
  style="
    color:#7280a8;
    font-size:10px;
    font-weight:700;
    letter-spacing:1.5px;
    text-transform:uppercase;
    margin-bottom:12px;
  "
>
  Verification code
</div>


<div
  style="
    color:#ffffff;
    font-family:'Courier New',monospace;
    font-size:40px;
    font-weight:700;
    letter-spacing:7px;
  "
>
  ${safeOtp}
</div>


<div
  style="
    color:#7886aa;
    font-size:12px;
    margin-top:13px;
  "
>
  Expires in

  <span
    style="
      color:#33d6ff;
      font-weight:700;
    "
  >
    ${expiryMinutes} minutes
  </span>
</div>

</div>


<p
  style="
    margin:22px 0 0;
    color:#7e89aa;
    font-size:12px;
    line-height:1.6;
  "
>
  Never share this verification code
  with anyone.
</p>


<div
  style="
    margin:28px 0 20px;
    border-top:1px solid #1d2851;
  "
></div>


<p
  style="
    margin:0;
    color:#66749c;
    font-size:12px;
    line-height:1.7;
  "
>
  Didn't request this password reset?

  <br />

  You can safely ignore this email.
</p>

</td>
</tr>

</table>

</td>
</tr>

</table>

</body>
</html>
    `.trim(),
  };
};