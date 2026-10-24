import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// The panel is its own app with its own build and deploy: `npm run build`
// produces dist/, which any static host can serve.
export default defineConfig({
  plugins: [svelte()],
  server: { port: 5174, strictPort: true },
});
