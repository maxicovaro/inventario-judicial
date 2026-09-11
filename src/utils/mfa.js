const crypto = require("crypto");
const env = require("../config/env");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const encryptionKey = () => {
  if (env.MFA_ENCRYPTION_KEY) {
    return Buffer.from(env.MFA_ENCRYPTION_KEY, "base64");
  }
  return crypto.createHash("sha256").update(env.JWT_SECRET, "utf8").digest();
};

const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const base32Decode = (input) => {
  const normalized = String(input || "")
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/\s+/g, "");

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Secreto MFA Base32 inválido");
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

const generateMfaSecret = () => base32Encode(crypto.randomBytes(20));

const totpAt = (secret, timestampMs = Date.now()) => {
  const counter = BigInt(
    Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS),
  );
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);

  const digest = crypto
    .createHmac("sha1", base32Decode(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
};

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const verifyTotp = (secret, code, timestampMs = Date.now()) => {
  const normalized = String(code || "").trim();
  if (!/^\d{6}$/.test(normalized)) return false;

  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const candidate = totpAt(
      secret,
      timestampMs + offset * TOTP_PERIOD_SECONDS * 1000,
    );
    if (safeEqual(candidate, normalized)) return true;
  }

  return false;
};

const encryptMfaSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(secret), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
};

const decryptMfaSecret = (encrypted) => {
  const [version, ivText, tagText, ciphertextText] = String(encrypted || "").split(".");
  if (version !== "v1" || !ivText || !tagText || !ciphertextText) {
    throw new Error("Secreto MFA cifrado inválido");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

const randomRecoverySegment = (length) => {
  const bytes = crypto.randomBytes(length);
  let output = "";
  for (const byte of bytes) {
    output += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
  }
  return output;
};

const generateRecoveryCodes = (count = RECOVERY_CODE_COUNT) =>
  Array.from({ length: count }, () =>
    [
      randomRecoverySegment(4),
      randomRecoverySegment(4),
      randomRecoverySegment(4),
    ].join("-"),
  );

const normalizeRecoveryCode = (code) =>
  String(code || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const recoveryPepper = () =>
  crypto
    .createHmac("sha256", encryptionKey())
    .update("inventario-mfa-recovery-v1")
    .digest();

const hashRecoveryCode = (code) =>
  crypto
    .createHmac("sha256", recoveryPepper())
    .update(normalizeRecoveryCode(code))
    .digest("hex");

const hashRecoveryCodes = (codes) => codes.map(hashRecoveryCode);

const consumeRecoveryCode = (hashes, code) => {
  const candidate = Buffer.from(hashRecoveryCode(code), "hex");
  const current = Array.isArray(hashes) ? hashes : [];
  const index = current.findIndex((hash) => {
    try {
      const stored = Buffer.from(String(hash), "hex");
      return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
    } catch {
      return false;
    }
  });

  if (index < 0) return { matched: false, remaining: current };
  return {
    matched: true,
    remaining: current.filter((_, currentIndex) => currentIndex !== index),
  };
};

const buildOtpAuthUri = ({ email, secret }) => {
  const issuer = env.MFA_ISSUER;
  const label = `${issuer}:${email}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
};

module.exports = {
  TOTP_PERIOD_SECONDS,
  generateMfaSecret,
  totpAt,
  verifyTotp,
  encryptMfaSecret,
  decryptMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  consumeRecoveryCode,
  buildOtpAuthUri,
};
