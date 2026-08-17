const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const { authRateLimiter, otpRateLimiter } = require("../middlewares/securityMiddleware");

// Signup
router.post("/signup", authRateLimiter, authController.signup);

// Login
router.post("/login", authRateLimiter, authController.login);

// Google Sign-In
router.post("/google", authRateLimiter, authController.googleLogin);

// Get current profile
router.get("/me", authMiddleware, authController.getMe);

// OTP Verification endpoints
router.post("/send-otp", otpRateLimiter, authController.sendOtp);
router.post("/verify-otp", otpRateLimiter, authController.verifyOtp);
router.post("/resend-otp", otpRateLimiter, authController.resendOtp);

module.exports = router;
