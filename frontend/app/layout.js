export const metadata = {
  title: "Observatorio de Vulnerabilidad ante la Desinformación Electoral",
  icons: { icon: { url: "/favicon.svg?v=2", type: "image/svg+xml" } },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b3a5c",
  colorScheme: "light dark",
};

// The app's own modules, fetched in parallel instead of one after another.
const MODULOS = [
  "mod/color", "mod/comparar", "mod/datos", "mod/descargas", "mod/escucha", "mod/efectos", "mod/estado",
  "mod/fichadoc", "mod/flags", "mod/formularios", "mod/inicio", "mod/kit", "mod/mapa", "mod/metodologia",
  "mod/nav", "mod/nota", "mod/paginas", "mod/tooltip", "mod/util", "api", "tenant", "ui", "estados",
];

export default function RootLayout({ children }) {
  return (
    // the app adds classes to <html> (gsap, theme) before React hydrates: React must not compare them
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* sets the theme before the first paint, so there is no light flash on a dark choice */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var q=new URLSearchParams(location.search).get("tema");var t=(q==="oscuro"||q==="claro")?q:localStorage.getItem("ovade.tema");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"oscuro":"claro";document.documentElement.dataset.tema=t;document.documentElement.style.colorScheme=t==="oscuro"?"dark":"light"}catch(e){}})()',
          }}
        />
        {/* provisional access gate: locks before the first paint unless this browser already entered the key */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){var k="00a16e1724d577adf9f1cafa65c5beb1d5404bde8a2cca5095865fa8101a6503",v=null;try{v=localStorage.getItem("ovade.acceso")||sessionStorage.getItem("ovade.acceso")}catch(e){}if(v!==k)document.documentElement.dataset.acceso="bloqueado"})()',
          }}
        />
        <link rel="stylesheet" href="/assets/app.css" />
        <link rel="stylesheet" href="/assets/estilo-ps.css" />
        <link rel="stylesheet" href="/assets/acceso.css" />
        {MODULOS.map((m) => (
          <link key={m} rel="modulepreload" href={`/assets/${m}.js`} />
        ))}
      </head>
      <body>
        {children}
        <script src="/assets/acceso.js" defer />
        {/* GSAP first, then the app: both deferred, so they run in this order */}
        <script src="/assets/vendor/gsap.min.js" defer />
        <script type="module" src="/assets/app.js" />
      </body>
    </html>
  );
}
