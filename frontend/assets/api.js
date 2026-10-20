// Shared by the public site (app.js) and the admin panel (admin.js).

export const API_BASE = (() => {
  if (window.MEDIAHACK_API_BASE) return window.MEDIAHACK_API_BASE;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return "http://localhost:8000";
  // Backend is a systemd service on the Oracle Cloud box, reachable through
  // a Cloudflare Tunnel hostname - not the Vercel deploy's own domain.
  return "https://mediahack-api.apiprueba.online";
})();

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
