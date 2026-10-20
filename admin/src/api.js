// Minimal API client for the admin panel (the public site has its own in frontend/assets/api.js).

// Set VITE_API_BASE at build time to point the panel at another backend.
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:8000" : "https://mediahack-api.apiprueba.online");

export async function api(path, opts) {
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : (body.detail || []).map((d) => d.msg.replace(/^Value error, /, "")).join(" ");
    } catch (_) {}
    const err = new Error(detail || `${path} -> ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}
export const getJSON = (path) => api(path);
export const postJSON = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
