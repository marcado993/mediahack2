const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function getJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export function listProvinces() {
  return getJSON("/api/provinces");
}

export function getProvince(name) {
  return getJSON(`/api/provinces/${encodeURIComponent(name)}`);
}

export function getMethodology() {
  return getJSON("/api/methodology");
}

export function searchNews(query, limit = 8) {
  return getJSON(`/api/news?query=${encodeURIComponent(query)}&limit=${limit}`);
}

export async function askAssistant(question) {
  const res = await fetch(`${BASE_URL}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`POST /api/ask -> ${res.status}`);
  return res.json();
}

export function listMedia(province) {
  const qs = province ? `?province=${encodeURIComponent(province)}` : "";
  return getJSON(`/api/media${qs}`);
}

export async function createMedia(outlet) {
  const res = await fetch(`${BASE_URL}/api/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(outlet),
  });
  if (!res.ok) throw new Error(`POST /api/media -> ${res.status}`);
  return res.json();
}

export async function deleteMedia(id) {
  const res = await fetch(`${BASE_URL}/api/media/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`DELETE /api/media/${id} -> ${res.status}`);
}
