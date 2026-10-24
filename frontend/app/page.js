import { readFileSync } from "node:fs";
import { join } from "node:path";

// The page's markup lives in cuerpo.html and is handed to the browser as is. The app
// (public/assets/app.js, native ES modules) fills it in and owns it from there, so
// React must not diff it: it is rendered once, at build time.
const cuerpo = readFileSync(join(process.cwd(), "app", "cuerpo.html"), "utf8");

export default function Page() {
  return <div id="ovade-root" style={{ display: "contents" }} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: cuerpo }} />;
}
