const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { initDb } = require("./config/db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(
  cors({
    origin: "*", // Adjust for specific production frontend URL if needed
    credentials: true,
  })
);

// Standard Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize Database & Seeds
initDb();

// Load Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api", require("./routes/apiRoutes"));

// Base health route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PostgreSQL Express backend is running.",
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
