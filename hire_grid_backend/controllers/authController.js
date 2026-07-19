const { pool } = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const otpService = require("../utils/otpService");
const emailService = require("../utils/emailService");

const JWT_SECRET = process.env.JWT_SECRET || "access_secret";
const JWT_EXPIRE = process.env.JWT_EXPIRE || "7d";

const formatUserResponse = (user) => {
  if (!user) return null;
  const formatted = { ...user };
  delete formatted.password;
  
  // Map snake_case to camelCase
  if (formatted.has_full_premium !== undefined) {
    formatted.hasFullPremium = formatted.has_full_premium;
    delete formatted.has_full_premium;
  }
  if (formatted.device_id !== undefined) {
    formatted.deviceId = formatted.device_id;
    delete formatted.device_id;
  }
  if (formatted.active_plan_id !== undefined) {
    formatted.activePlanId = formatted.active_plan_id;
    delete formatted.active_plan_id;
  }
  if (formatted.plan_expiry !== undefined) {
    formatted.planExpiry = formatted.plan_expiry ? Number(formatted.plan_expiry) : null;
    delete formatted.plan_expiry;
  }
  if (formatted.purchased_companies !== undefined) {
    formatted.purchasedCompanies = formatted.purchased_companies;
    delete formatted.purchased_companies;
  }
  if (formatted.granted_company_access !== undefined) {
    formatted.grantedCompanyAccess = formatted.granted_company_access;
    delete formatted.granted_company_access;
  }
  if (formatted.granted_subject_access !== undefined) {
    formatted.grantedSubjectAccess = formatted.granted_subject_access;
    delete formatted.granted_subject_access;
  }
  if (formatted.granted_topic_access !== undefined) {
    formatted.grantedTopicAccess = formatted.granted_topic_access;
    delete formatted.granted_topic_access;
  }
  if (formatted.granted_exam_access !== undefined) {
    formatted.grantedExamAccess = formatted.granted_exam_access;
    delete formatted.granted_exam_access;
  }
  if (formatted.granted_module_access !== undefined) {
    formatted.grantedModuleAccess = formatted.granted_module_access;
    delete formatted.granted_module_access;
  }
  if (formatted.email_verified !== undefined) {
    formatted.emailVerified = formatted.email_verified;
    delete formatted.email_verified;
  }
  
  return formatted;
};

// Signup
exports.signup = async (req, res) => {
  const { name, email, password, role = "student", branch, semester, specialization } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  try {
    let targetTable;
    if (role === "student") {
      targetTable = "users";
    } else if (role === "content_manager") {
      targetTable = "content_managers";
    } else {
      targetTable = "admin_users";
    }

    // 1. Check if user already exists
    const checkUser = await pool.query(
      `SELECT * FROM ${targetTable} WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: "User with this email already exists." });
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    let userResult;

    if (role === "student") {
      // Create Student profile
      userResult = await pool.query(
        `INSERT INTO users (id, email, password, name, role, branch, semester, specialization, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
         RETURNING id, email, name, role, branch, semester, email_verified`,
        [userId, email.toLowerCase(), hashedPassword, name, role, branch || null, semester || null, specialization || null]
      );
    } else if (role === "content_manager") {
      // Create Content Manager profile
      userResult = await pool.query(
        `INSERT INTO content_managers (id, email, password, name, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, role`,
        [userId, email.toLowerCase(), hashedPassword, name, role]
      );
    } else {
      // Create Admin profile
      userResult = await pool.query(
        `INSERT INTO admin_users (id, email, password, name, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, role`,
        [userId, email.toLowerCase(), hashedPassword, name, role]
      );
    }

    const user = userResult.rows[0];

    // If student, require OTP verification before providing JWT
    if (role === "student") {
      const otp = otpService.generateOtp();
      await otpService.saveOtp(user.email, otp);
      await emailService.sendOtpEmail(user.email, otp, "Verification");

      return res.status(201).json({
        success: true,
        requiresVerification: true,
        email: user.email,
        message: "Registration initiated. Verification OTP has been sent to your email.",
      });
    }

    // Admins / Content managers bypass OTP
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRE,
    });

    res.status(201).json({
      success: true,
      message: "Registration successful.",
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server registration error." });
  }
};

exports.login = async (req, res) => {
  const { email, password, isAdminLogin = false } = req.body;

  if (!password || (!isAdminLogin && !email)) {
    return res.status(400).json({ error: isAdminLogin ? "Password is required." : "Email and password are required." });
  }

  try {
    let user;

    if (isAdminLogin) {
      if (!email || email.trim() === "") {
        // Password-only login (for super admin)
        const adminsResult = await pool.query(`SELECT * FROM admin_users`);
        let matchedUser = null;
        for (const row of adminsResult.rows) {
          const isMatch = await bcrypt.compare(password, row.password);
          if (isMatch) {
            matchedUser = row;
            break;
          }
        }

        if (!matchedUser) {
          return res.status(401).json({ error: "Invalid password." });
        }
        user = matchedUser;
      } else {
        // Email + Password login (e.g. for Content Managers and admins with email)
        const emailLower = email.trim().toLowerCase();
        let queryResult = await pool.query(`SELECT * FROM admin_users WHERE email = $1`, [emailLower]);
        
        if (queryResult.rows.length === 0) {
          queryResult = await pool.query(`SELECT * FROM content_managers WHERE email = $1`, [emailLower]);
        }

        if (queryResult.rows.length === 0) {
          return res.status(401).json({ error: "Invalid email or password." });
        }

        const foundUser = queryResult.rows[0];
        const isMatch = await bcrypt.compare(password, foundUser.password);
        if (!isMatch) {
          return res.status(401).json({ error: "Invalid email or password." });
        }
        user = foundUser;
      }
    } else {
      // Look strictly in users (student)
      const userResult = await pool.query(
        `SELECT * FROM users WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      user = userResult.rows[0];

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      if (!user.email_verified) {
        return res.status(400).json({
          success: false,
          requiresVerification: true,
          email: user.email,
          message: "Please verify your email first.",
        });
      }
    }

    // Generate JWT Token
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRE,
    });

    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server login error." });
  }
};

// Get current profile
exports.getMe = async (req, res) => {
  const { id, role } = req.user;
  let targetTable;
  if (role === "student") {
    targetTable = "users";
  } else if (role === "content_manager") {
    targetTable = "content_managers";
  } else {
    targetTable = "admin_users";
  }

  try {
    const userResult = await pool.query(
      `SELECT * FROM ${targetTable} WHERE id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = userResult.rows[0];

    res.json({
      success: true,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error("GetMe error:", err);
    res.status(500).json({ error: "Server fetching user error." });
  }
};

// Google Sign-In
exports.googleLogin = async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: "Google credential is required." });
  }

  try {
    // Decode the Google JWT ID token (header.payload.signature)
    // We decode the payload to get user info
    const parts = credential.split(".");
    if (parts.length !== 3) {
      return res.status(400).json({ error: "Invalid Google token format." });
    }

    // Base64url decode the payload
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    );

    const { sub: googleId, email, name, picture } = payload;

    if (!email || !googleId) {
      return res.status(400).json({ error: "Invalid Google token data." });
    }

    // Check if user already exists by google_id or email
    let userResult = await pool.query(
      `SELECT * FROM users WHERE google_id = $1 OR email = $2`,
      [googleId, email.toLowerCase()]
    );

    let user;

    if (userResult.rows.length > 0) {
      // Existing user — update google_id if missing
      user = userResult.rows[0];
      if (!user.google_id) {
        await pool.query(
          `UPDATE users SET google_id = $1, auth_provider = 'google', profile_picture = $2 WHERE id = $3`,
          [googleId, picture || null, user.id]
        );
        user.google_id = googleId;
        user.auth_provider = "google";
        user.profile_picture = picture;
      }
    } else {
      // New user — create account
      const userId = crypto.randomUUID();
      const insertResult = await pool.query(
        `INSERT INTO users (id, email, name, role, google_id, auth_provider, profile_picture)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, email.toLowerCase(), name || "Google User", "student", googleId, "google", picture || null]
      );
      user = insertResult.rows[0];
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    res.json({
      success: true,
      message: "Google login successful.",
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(500).json({ error: "Google authentication failed." });
  }
};

// Send OTP
exports.sendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  // Simple email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }

  try {
    const emailLower = email.trim().toLowerCase();
    
    // Check rate limits / cooldown
    const cooldownCheck = await otpService.checkOtpCooldown(emailLower);
    if (!cooldownCheck.allowed) {
      return res.status(429).json({ error: cooldownCheck.message });
    }

    const otp = otpService.generateOtp();
    await otpService.saveOtp(emailLower, otp);
    await emailService.sendOtpEmail(emailLower, otp, "Verification");

    res.json({
      success: true,
      message: "OTP sent successfully.",
    });
  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ error: "Failed to send OTP." });
  }
};

// Resend OTP
exports.resendOtp = async (req, res) => {
  // Enforces cooldown via same flow
  return exports.sendOtp(req, res);
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required." });
  }

  if (otp.length !== 6 || !/^\d+$/.test(otp)) {
    return res.status(400).json({ error: "OTP must be exactly 6 numeric digits." });
  }

  try {
    const emailLower = email.trim().toLowerCase();
    
    // Check if email exists in users table
    const userResult = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [emailLower]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: "Email address not registered." });
    }

    const verification = await otpService.verifyOtp(emailLower, otp);
    if (!verification.success) {
      return res.status(400).json({ error: verification.message });
    }

    // Mark email as verified in users table
    await pool.query(
      `UPDATE users SET email_verified = TRUE, verified_at = CURRENT_TIMESTAMP WHERE email = $1`,
      [emailLower]
    );

    res.json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Failed to verify OTP." });
  }
};




