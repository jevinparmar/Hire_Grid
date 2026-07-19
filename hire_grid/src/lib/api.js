const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(method, path, body = null) {
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
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  delete: (path) => request("DELETE", path),
};