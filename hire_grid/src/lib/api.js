const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const inFlightRequests = new Map();

async function request(method, path, body = null) {
  if (method === "GET" && inFlightRequests.has(path)) {
    return inFlightRequests.get(path);
  }

  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const reqPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}${path}`, options);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data.error ||
          data.message ||
          `Request failed with status ${res.status}`;

        if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");

          if (
            window.location.pathname !== "/" &&
            window.location.pathname !== "/admin"
          ) {
            window.location.href = "/";
          }
        }

        throw new Error(message);
      }

      return data;
    } catch (err) {
      console.error("API Error:", err);
      throw err;
    }
  })();

  if (method === "GET") {
    inFlightRequests.set(path, reqPromise);
    reqPromise.finally(() => {
      inFlightRequests.delete(path);
    });
  }

  return reqPromise;
}

export function getDeviceId() {
  let deviceId = localStorage.getItem("hiregrid_device_id");
  if (!deviceId) {
    deviceId = "dev_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("hiregrid_device_id", deviceId);
  }
  return deviceId;
}

export function getDeviceName() {
  const ua = navigator.userAgent || "";
  let browser = "Browser";
  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Edge")) browser = "Edge";
  
  let os = "Device";
  if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh")) os = "Mac";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone")) os = "iPhone";

  return `${browser} on ${os}`;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  delete: (path) => request("DELETE", path),
};