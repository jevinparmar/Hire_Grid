require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const helmet = require("helmet");
const { initDb } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy behind reverse proxies (Render, Nginx, Cloudflare)
app.set("trust proxy", 1);

// Security Headers using helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"],
        connectSrc: ["'self'", "https://oauth2.googleapis.com", "https://*.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Enable CORS
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "https://hire-grid-chi.vercel.app"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
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

// Centralized Express Error Handler (Blocks database error leakages in production)
app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]:", err.stack || err);
  
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === "production"
    ? "An unexpected error occurred on the server. Please try again later."
    : err.message || "Internal Server Error";
    
  res.status(status).json({
    success: false,
    error: message
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
