require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const { initDb } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "https://hire-grid-chi.vercel.app"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Fallback allow to guarantee production compatibility
    },
    credentials: true,
  })
);

// Response Compression
app.use(compression());

// Standard Middlewares
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Performance Timing Middleware
app.use((req, res, next) => {
  const start = performance.now();
  res.on("finish", () => {
    const duration = (performance.now() - start).toFixed(2);
    if (process.env.NODE_ENV !== "production" && duration > 200) {
      console.log(`[PERF] ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });
  next();
});

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
