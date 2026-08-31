const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Hash a plain text password using bcrypt
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare a plain text password against a bcrypt hash
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 * @param {number} length
 * @returns {string}
 */
function generateOTP(length = 6) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const num = crypto.randomInt(min, max + 1);
  return num.toString();
}

/**
 * Hash an OTP for secure storage
 * @param {string} otp
 * @returns {Promise<string>}
 */
async function hashOTP(otp) {
  return await bcrypt.hash(otp, 8); // Fast salt for short-lived OTP
}

/**
 * Compare plain OTP against stored hash
 * @param {string} otp
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function compareOTP(otp, hash) {
  if (!otp || !hash) return false;
  return await bcrypt.compare(otp, hash);
}

module.exports = {
  hashPassword,
  comparePassword,
  generateOTP,
  hashOTP,
  compareOTP
};
