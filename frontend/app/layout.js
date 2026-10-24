export const metadata = {
  title: "Observatorio de Vulnerabilidad ante la Desinformación Electoral",
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b3a5c",
};

// The app's own modules, fetched in parallel instead of one after another.
const MODULOS = [
  "mod/color", "mod/comparar", "mod/datos", "mod/descargas", "mod/escucha", "mod/efectos", "mod/estado",
  "mod/fichadoc", "mod/flags", "mod/formularios", "mod/inicio", "mod/kit", "mod/mapa", "mod/metodologia",
  "mod/nav", "mod/paginas", "mod/tooltip", "mod/util", "api", "tenant", "ui", "estados",
];

export default function RootLayout({ children }) {
  return (
    // the app adds classes to <html> (gsap, theme) before React hydrates: React must not compare them
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/assets/app.css" />
        {MODULOS.map((m) => (
          <link key={m} rel="modulepreload" href={`/assets/${m}.js`} />
        ))}
      </head>
      <body>
        {children}
        {/* GSAP first, then the app: both deferred, so they run in this order */}
        <script src="/assets/vendor/gsap.min.js" defer />
        <script type="module" src="/assets/app.js" />
      </body>
    </html>
  );
}
