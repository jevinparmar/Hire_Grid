const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

// Signup
router.post("/signup", authController.signup);

// Login
router.post("/login", authController.login);

// Google Sign-In
router.post("/google", authController.googleLogin);

// Get current profile
router.get("/me", authMiddleware, authController.getMe);

// OTP Verification endpoints
router.post("/send-otp", authController.sendOtp);
router.post("/verify-otp", authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);

module.exports = router;
