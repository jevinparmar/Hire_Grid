const rateLimit = require("express-rate-limit");

// General api rate limiter
const apiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 300, // 300 requests per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." }
});

// Authentication rate limiter (login, signup, admin, google, reset password)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login/signup attempts. Please try again after 15 minutes." }
});

// OTP request and verification rate limiter
const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 6, // 6 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many OTP requests or verifications. Please try again in 10 minutes." }
});

// Sensitive actions rate limiter (starting exams, payments)
const sensitiveActionRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sensitive operations requested. Please try again in a minute." }
});

module.exports = {
  apiRateLimiter,
  authRateLimiter,
  otpRateLimiter,
  sensitiveActionRateLimiter
};
