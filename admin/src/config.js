// Where the public tool lives. The panel never embeds its code: it only points
// to it (preview iframe, "open" links), so the two deploy independently.
// Set VITE_PUBLIC_URL at build time for production.
export const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "");
export const PUBLIC_ORIGIN = new URL(PUBLIC_URL).origin;
