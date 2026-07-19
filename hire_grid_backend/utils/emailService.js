const nodemailer = require("nodemailer");
require("dotenv").config();

// Create nodemailer transporter configured with Gmail SMTP details
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends a clean, responsive HTML OTP email via Nodemailer using Gmail SMTP
 * @param {string} email Target recipient
 * @param {string} otp 6-digit verification code
 * @param {string} purpose e.g., 'Verification' or 'Password Reset'
 */
const sendOtpEmail = async (email, otp, purpose = "Verification") => {
  const mailOptions = {
    from: `"Engineering Hub" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Email Verification OTP",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f5f7;
            color: #333333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #e1e4e8;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          }
          .header {
            background-color: #059669;
            padding: 24px;
            text-align: center;
            color: #ffffff;
          }
          .header h2 {
            margin: 0;
            font-size: 20px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .content {
            padding: 30px;
            text-align: center;
          }
          .otp-code {
            display: inline-block;
            font-size: 32px;
            font-weight: bold;
            color: #059669;
            background-color: #ecfdf5;
            padding: 12px 30px;
            border-radius: 6px;
            border: 1px solid #34d399;
            letter-spacing: 4px;
            margin: 20px 0;
          }
          .expiry {
            font-size: 14px;
            color: #ef4444;
            font-weight: bold;
          }
          .footer {
            background-color: #f8fafc;
            padding: 16px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Engineering Hub</h2>
          </div>
          <div class="content">
            <p>Your verification code is:</p>
            <div class="otp-code">${otp}</div>
            <p class="expiry">This OTP is valid for 5 minutes.</p>
            <p style="font-size: 12px; color: #666; margin-top: 25px;">
              If you did not request this verification, please ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Engineering Hub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Nodemailer OTP sending error:", error);
    // If SMTP fails or not set up, fall back to console print
    console.log("\n--- DEVELOPMENT OTP FALLBACK ---");
    console.log(`To: ${email}`);
    console.log(`OTP: ${otp}`);
    console.log("--------------------------------\n");
    return { success: true, fallback: true };
  }
};

module.exports = {
  sendOtpEmail,
};
