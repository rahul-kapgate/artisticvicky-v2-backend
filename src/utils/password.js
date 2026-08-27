import argon2 from "argon2";

const ARGON_OPTIONS = {
  type: argon2.argon2id,

  memoryCost: 19456,

  timeCost: 2,

  parallelism: 1,
};

export const hashPassword = async (password) => {
  return argon2.hash(password, ARGON_OPTIONS);
};

export const verifyPassword = async (passwordHash, password) => {
  return argon2.verify(passwordHash, password);
};
