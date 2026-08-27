import { generateOtp, hashOtp, verifyOtp } from "../../src/utils/otp.js";

describe("OTP utilities", () => {
  const ownerId = "8aa3c69b-158f-4be7-a475-99fc8de548d2";
  const purpose = "registration";

  it("should generate a six digit OTP", () => {
    const otp = generateOtp();

    expect(otp).toMatch(/^\d{6}$/);
  });

  it("should verify a correct OTP", () => {
    const otp = "123456";

    const hash = hashOtp({
      otp,
      ownerId,
      purpose,
    });

    const valid = verifyOtp({
      otp,
      ownerId,
      purpose,
      expectedHash: hash,
    });

    expect(valid).toBe(true);
  });

  it("should reject an incorrect OTP", () => {
    const hash = hashOtp({
      otp: "123456",
      ownerId,
      purpose,
    });

    const valid = verifyOtp({
      otp: "654321",
      ownerId,
      purpose,
      expectedHash: hash,
    });

    expect(valid).toBe(false);
  });
});
