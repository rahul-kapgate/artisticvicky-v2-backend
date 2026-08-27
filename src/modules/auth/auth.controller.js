import {
  parseRegistrationInput,
  parseVerifyRegistrationInput,
  parseResendRegistrationInput,
} from "./auth.validation.js";

import {
  startRegistration,
  verifyRegistration,
  resendRegistrationOtp,
} from "./auth.service.js";

export const register = async (req, res) => {
  const input = parseRegistrationInput(req.body);

  const result = await startRegistration(input);

  return res.status(202).json({
    success: true,

    message: "Verification code sent to your email.",

    data: result,
  });
};

export const verifyRegistrationOtp = async (req, res) => {
  const input = parseVerifyRegistrationInput(req.body);

  const user = await verifyRegistration(input);

  return res.status(201).json({
    success: true,

    message: "Registration completed successfully.",

    data: {
      user,
    },
  });
};

export const resendRegistration = async (req, res) => {
  const input = parseResendRegistrationInput(req.body);

  const result = await resendRegistrationOtp(input);

  return res.status(200).json({
    success: true,

    message: "A new verification code has been sent.",

    data: result,
  });
};
