const crypto = require("crypto");
const { pool } = require("../config/db");

/**
 * Generate a random 6-digit numeric OTP.
 */
const generateOtp = () => {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
};

/**
 * Check if the email is allowed to request a new OTP (60s cooldown).
 */
const checkOtpCooldown = async (email) => {
  const emailLower = email.toLowerCase();
  
  const lastOtpResult = await pool.query(
    `SELECT created_at FROM otps 
     WHERE email = $1 
     ORDER BY created_at DESC LIMIT 1`,
    [emailLower]
  );
  
  if (lastOtpResult.rows.length > 0) {
    const lastCreatedAt = new Date(lastOtpResult.rows[0].created_at).getTime();
    const timePassedSeconds = (Date.now() - lastCreatedAt) / 1000;
    if (timePassedSeconds < 60) {
      return {
        allowed: false,
        message: `Please wait ${Math.ceil(60 - timePassedSeconds)} seconds before requesting a new OTP.`,
      };
    }
  }

  return { allowed: true };
};

/**
 * Save or update the OTP for an email.
 * Ensures only one active OTP exists per email.
 */
const saveOtp = async (email, otp) => {
  const emailLower = email.toLowerCase();
  
  // Invalidate any existing active OTPs for this email first
  await pool.query(
    `DELETE FROM otps WHERE email = $1`,
    [emailLower]
  );

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  const id = crypto.randomUUID();

  await pool.query(
    `INSERT INTO otps (id, email, otp, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [id, emailLower, otp, expiresAt]
  );
};

/**
 * Verifies the OTP for an email.
 */
const verifyOtp = async (email, otpCode) => {
  const emailLower = email.toLowerCase();

  const otpResult = await pool.query(
    `SELECT * FROM otps 
     WHERE email = $1 AND is_verified = FALSE
     ORDER BY created_at DESC LIMIT 1`,
    [emailLower]
  );

  if (otpResult.rows.length === 0) {
    return {
      success: false,
      message: "No active verification code found for this email. Please request a new code.",
    };
  }

  const otpRecord = otpResult.rows[0];

  // Brute-force protection: lock after 5 failed attempts
  if (otpRecord.failed_attempts >= 5) {
    return {
      success: false,
      message: "Too many failed attempts. This OTP session is locked. Please request a new code.",
    };
  }

  // Check expiration
  if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
    await pool.query(`DELETE FROM otps WHERE id = $1`, [otpRecord.id]);
    return {
      success: false,
      message: "The verification code has expired. Please request a new code.",
    };
  }

  // Verify OTP match
  if (otpRecord.otp !== otpCode) {
    const newFailedAttempts = otpRecord.failed_attempts + 1;
    await pool.query(
      `UPDATE otps SET failed_attempts = $1, last_attempt_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newFailedAttempts, otpRecord.id]
    );

    if (newFailedAttempts >= 5) {
      await pool.query(`DELETE FROM otps WHERE id = $1`, [otpRecord.id]);
      return {
        success: false,
        message: "Incorrect code. Too many failed attempts. Verification session locked. Please request a new code.",
      };
    }

    return {
      success: false,
      message: `Incorrect verification code. ${5 - newFailedAttempts} attempts remaining.`,
    };
  }

  // Update as verified and delete/invalidate it
  await pool.query(`DELETE FROM otps WHERE id = $1`, [otpRecord.id]);

  return { success: true };
};

module.exports = {
  generateOtp,
  checkOtpCooldown,
  saveOtp,
  verifyOtp,
};
