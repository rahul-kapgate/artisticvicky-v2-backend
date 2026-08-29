const escapeHtml = (value = "") => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

export const registrationOtpTemplate = ({
  name,
  otp,
  expiryMinutes,
  logoUrl = null,
}) => {
  const safeName = escapeHtml(name);
  const safeOtp = escapeHtml(otp);
  const safeLogoUrl = logoUrl ? escapeHtml(logoUrl) : null;

  return {
   subject: "Verify your AV Art Academy account",

    text: `
Hi ${name},

Welcome to AV Art Academy.

Your verification code is:

${otp}

This code expires in ${expiryMinutes} minutes.

Do not share this code with anyone.

If you did not request this registration, you can safely ignore this email.

AV Art Academy
Sketch Your Success
    `.trim(),

    html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />

    <meta
      name="color-scheme"
      content="dark light"
    />

    <title>
      Verify your AV Art Academy account
    </title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #050a1c;
      font-family: Arial, Helvetica, sans-serif;
    "
  >

    <!-- OUTER BACKGROUND -->

    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="
        width: 100%;
        background-color: #050a1c;
      "
    >
      <tr>
        <td
          align="center"
          style="
            padding: 40px 16px;
          "
        >

          <!-- MAIN EMAIL CARD -->

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              width: 100%;
              max-width: 580px;
              background-color: #0b1129;
              border-radius: 20px;
              overflow: hidden;
              border: 1px solid #1d2851;
            "
          >

            <!-- GRADIENT TOP BAR -->

            <tr>
              <td
                height="5"
                style="
                  height: 5px;
                  padding: 0;
                  background:
                    linear-gradient(
                      90deg,
                      #ff3fa7 0%,
                      #7c3aed 50%,
                      #33d6ff 100%
                    );
                "
              >
              </td>
            </tr>


            <!-- HEADER -->

            <tr>
              <td
                align="center"
                style="
                  padding: 34px 32px 28px;
                  background-color: #0b1129;
                "
              >

                ${
                  safeLogoUrl
                    ? `
                      <img
                        src="${safeLogoUrl}"
                        alt="AV Art Academy"
                        width="130"
                        style="
                          display: block;
                          width: 130px;
                          max-width: 130px;
                          height: auto;
                          margin: 0 auto 15px;
                        "
                      />
                    `
                    : `
                      <div
                        style="
                          margin: 0 0 8px;
                          font-size: 27px;
                          line-height: 1.2;
                          font-weight: 800;
                          letter-spacing: 0.5px;
                          color: #ffffff;
                        "
                      >
                        AV
                        <span
                          style="
                            color: #ff4faa;
                          "
                        >
                          ART
                        </span>
                        ACADEMY
                      </div>
                    `
                }

                <div
                  style="
                    color: #8090bb;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 2.2px;
                    text-transform: uppercase;
                  "
                >
                  SKETCH YOUR SUCCESS
                </div>

              </td>
            </tr>


            <!-- HERO AREA -->

            <tr>
              <td
                style="
                  padding:
                    10px
                    40px
                    18px;
                "
              >

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                >
                  <tr>
                    <td>

                      <div
                        style="
                          margin-bottom: 12px;
                          color: #4cc3ff;
                          font-size: 11px;
                          font-weight: 700;
                          letter-spacing: 1.8px;
                          text-transform: uppercase;
                        "
                      >
                        EMAIL VERIFICATION
                      </div>


                      <h1
                        style="
                          margin:
                            0
                            0
                            18px;

                          color: #ffffff;

                          font-size: 30px;

                          line-height: 1.25;

                          font-weight: 800;
                        "
                      >
                        Verify your email
                      </h1>


                      <p
                        style="
                          margin:
                            0
                            0
                            12px;

                          color: #ffffff;

                          font-size: 16px;

                          line-height: 1.7;
                        "
                      >
                        Hi
                        <strong>
                          ${safeName}
                        </strong>,
                      </p>


                      <p
                        style="
                          margin: 0;
                          color: #b8c1db;
                          font-size: 15px;
                          line-height: 1.7;
                        "
                      >
                        Welcome to
                        <strong
                          style="
                            color: #ffffff;
                          "
                        >
                          AV Art Academy.
                        </strong>

                        Use the verification code below
                        to complete your registration.
                      </p>

                    </td>
                  </tr>
                </table>

              </td>
            </tr>


            <!-- OTP CARD -->

            <tr>
              <td
                style="
                  padding:
                    20px
                    40px
                    24px;
                "
              >

                <!-- GRADIENT BORDER -->

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    width: 100%;

                    background:
                      linear-gradient(
                        135deg,
                        #ff3fa7,
                        #7c3aed,
                        #33d6ff
                      );

                    border-radius: 16px;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding: 1px;
                      "
                    >

                      <!-- INNER OTP CARD -->

                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          width: 100%;
                          background-color: #101938;
                          border-radius: 15px;
                        "
                      >
                        <tr>
                          <td
                            align="center"
                            style="
                              padding:
                                30px
                                20px;
                            "
                          >

                            <div
                              style="
                                margin-bottom: 15px;

                                color: #8d9ac0;

                                font-size: 11px;

                                font-weight: 700;

                                letter-spacing: 1.8px;

                                text-transform: uppercase;
                              "
                            >
                              YOUR VERIFICATION CODE
                            </div>


                            <div
                              style="
                                color: #ffffff;

                                font-family:
                                  'Courier New',
                                  Courier,
                                  monospace;

                                font-size: 38px;

                                line-height: 1.2;

                                font-weight: 800;

                                letter-spacing: 10px;
                              "
                            >
                              ${safeOtp}
                            </div>


                            <div
                              style="
                                width: 60px;
                                height: 3px;

                                margin:
                                  20px
                                  auto
                                  16px;

                                border-radius: 10px;

                                background:
                                  linear-gradient(
                                    90deg,
                                    #ff3fa7,
                                    #7c3aed,
                                    #33d6ff
                                  );
                              "
                            >
                            </div>


                            <div
                              style="
                                color: #9fa9c7;

                                font-size: 13px;

                                line-height: 1.5;
                              "
                            >
                              Valid for

                              <strong
                                style="
                                  color: #4cc3ff;
                                "
                              >
                                ${expiryMinutes} minutes
                              </strong>
                            </div>

                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>
                </table>

              </td>
            </tr>


            <!-- SECURITY INFORMATION -->

            <tr>
              <td
                style="
                  padding:
                    0
                    40px
                    30px;
                "
              >

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    width: 100%;

                    background-color: #0f1735;

                    border: 1px solid #1b2850;

                    border-radius: 12px;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding:
                          17px
                          18px;
                      "
                    >

                      <table
                        role="presentation"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                      >
                        <tr>

                          <td
                            valign="top"
                            style="
                              padding-right: 12px;

                              color: #ff4faa;

                              font-size: 17px;
                            "
                          >
                            &#128274;
                          </td>

                          <td
                            style="
                              color: #9fa9c7;

                              font-size: 12px;

                              line-height: 1.65;
                            "
                          >
                            <strong
                              style="
                                display: block;

                                margin-bottom: 3px;

                                color: #ffffff;

                                font-size: 13px;
                              "
                            >
                              Keep your account secure
                            </strong>

                            AV Art Academy will never ask
                            you to share this verification
                            code with anyone.
                          </td>

                        </tr>
                      </table>

                    </td>
                  </tr>
                </table>

              </td>
            </tr>


            <!-- DIVIDER -->

            <tr>
              <td
                style="
                  padding:
                    0
                    40px;
                "
              >

                <div
                  style="
                    border-top:
                      1px solid
                      #1b2546;
                  "
                >
                </div>

              </td>
            </tr>


            <!-- IGNORE MESSAGE -->

            <tr>
              <td
                align="center"
                style="
                  padding:
                    25px
                    40px
                    32px;
                "
              >

                <p
                  style="
                    margin: 0;

                    color: #7f8bad;

                    font-size: 12px;

                    line-height: 1.7;
                  "
                >
                  Didn't create an AV Art Academy account?

                  <br />

                  No action is required.
                  You can safely ignore this email.
                </p>

              </td>
            </tr>


            <!-- FOOTER -->

            <tr>
              <td
                align="center"
                style="
                  padding:
                    28px
                    32px;

                  background-color: #070d20;

                  border-top:
                    1px solid
                    #192345;
                "
              >

                <div
                  style="
                    margin-bottom: 7px;

                    color: #ffffff;

                    font-size: 15px;

                    font-weight: 800;

                    letter-spacing: 0.5px;
                  "
                >
                  AV
                  <span
                    style="
                      color: #ff4faa;
                    "
                  >
                    ART
                  </span>
                  ACADEMY
                </div>


                <div
                  style="
                    margin-bottom: 16px;

                    color: #4cc3ff;

                    font-size: 11px;

                    font-weight: 600;

                    letter-spacing: 1.5px;

                    text-transform: uppercase;
                  "
                >
                  Sketch Your Success
                </div>


                <div
                  style="
                    color: #66749c;

                    font-size: 11px;

                    line-height: 1.7;
                  "
                >
                  This is an automated security email.

                  <br />

                  Please do not reply to this message.
                </div>

              </td>
            </tr>

          </table>


          <!-- OUTSIDE FOOTER -->

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              width: 100%;
              max-width: 580px;
            "
          >
            <tr>
              <td
                align="center"
                style="
                  padding:
                    20px
                    20px
                    0;

                  color: #536080;

                  font-size: 10px;

                  line-height: 1.6;
                "
              >
                © ${new Date().getFullYear()}
                AV Art Academy.
                All rights reserved.
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
