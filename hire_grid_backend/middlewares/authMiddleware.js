const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "access_secret";

module.exports = (req, res, next) => {
  let token;

  // Check headers for token
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Access denied. Invalid token." });
  }
};
