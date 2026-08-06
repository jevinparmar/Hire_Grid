/**
 * Client-side JWT authentication guard utilities.
 * Used for route protection — verifies token exists and isn't expired.
 * NOTE: This is NOT a substitute for server-side auth (authMiddleware.js handles that).
 */

/**
 * Check if the user has a valid (non-expired) JWT token in localStorage.
 * @returns {boolean}
 */
export function isAuthenticated() {
  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    // Decode the JWT payload (base64url → JSON) without verifying signature
    // Signature verification happens server-side; this is just an expiry check
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true; // No expiry claim = assume valid

    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/**
 * Get the stored user's role from localStorage.
 * @returns {string|null}
 */
export function getStoredRole() {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user.role || null;
  } catch {
    return null;
  }
}

/**
 * Clear auth state and redirect to the given path.
 * @param {string} redirectTo - Path to redirect to (default "/")
 */
export function clearAuthAndRedirect(redirectTo = "/") {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = redirectTo;
}
