const API_BASE = "/api";

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

  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.error || `Request failed with status ${res.status}`;
    if (res.status === 401) {
      // Auto logout on unauthorized
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/" && window.location.pathname !== "/admin") {
        window.location.href = "/";
      }
    }
    throw new Error(message);
  }

  return res.json();
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  delete: (path) => request("DELETE", path),
};
