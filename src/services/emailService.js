import dotenv from "dotenv";
import { resend } from "../config/resendClient.js";

dotenv.config();

export const sendOtpToEmail = async (email, otp) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Artistic Vickey <no-reply@artisticvickey.in>",
      to: [email],
      subject: "Verification Code - Artistic Vickey",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Email Verification</title>
          <style>
            body {
              background-color: #f4f7fc;
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #333;
              padding: 0;
              margin: 0;
            }
            .container {
              max-width: 480px;
              margin: 30px auto;
              background: #fff;
              border-radius: 10px;
              box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
              padding: 30px;
              text-align: center;
            }
            .header {
              font-size: 22px;
              font-weight: 600;
              color: #222;
              margin-bottom: 10px;
            }
            .subtext {
              font-size: 15px;
              color: #555;
              margin-bottom: 20px;
            }
            .otp-box {
              background: #f0f4ff;
              color: #2b4eff;
              font-size: 28px;
              font-weight: bold;
              letter-spacing: 4px;
              display: inline-block;
              padding: 12px 24px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .footer {
              font-size: 13px;
              color: #777;
              margin-top: 20px;
              line-height: 1.5;
            }
            @media (prefers-color-scheme: dark) {
              body { background-color: #121212; color: #ddd; }
              .container { background: #1e1e1e; color: #ddd; }
              .otp-box { background: #222; color: #5b8cff; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">Email Verification</div>
            <div class="subtext">
              Dear User,<br/>
              Use the following One-Time Password (OTP) to verify your email:
            </div>
            <div class="otp-box">${otp}</div>
            <div class="subtext">
              This code is valid for <strong>5 minutes</strong>.<br/>
              Please do not share it with anyone for your security.
            </div>
            <div class="footer">
              —<br/>
              Best regards,<br/>
              <strong>Artistic Vicky Team</strong><br/>
              <a href="https://artisticvickey.in" style="color:#2b4eff;text-decoration:none;">artisticvickey.in</a>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("❌ Error sending email via Resend:", error);
      return false;
    }

    console.log("✅ Email sent successfully via Resend:", data?.id);
    return true;
  } catch (err) {
    console.error("❌ Error sending email via Resend:", err.message);
    return false;
  }
};
