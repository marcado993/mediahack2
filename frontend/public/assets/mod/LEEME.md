# Módulos del sitio público

`assets/app.js` es solo el punto de entrada (arranque y eventos globales). Todo lo demás
vive aquí como módulos ES nativos: no hay build, el navegador los carga tal cual y
`index.html` los precarga con `modulepreload`.

| Módulo | Qué contiene |
|---|---|
| `estado.js` | **Todo el estado mutable** en un solo objeto `E` (`E.MAPA`, `E.capa`, `E.perfilActual`…). Se lee y se escribe siempre como `E.algo`. |
| `util.js` | `$`, `enc`, `normalize`, `provinceKey` |
| `color.js` | Escala azul, `col`, `inkFor` |
| `datos.js` | Constantes y textos: factores, perfiles, criterio editorial, glosario, preguntas por factor |
| `nav.js` | Vistas y rutas (`#perfil/Guayas`), barra de carga, avisos, copiar, errores |
| `tooltip.js` | Globo flotante del mapa |
| `mapa.js` | Vista «Mapa del país»: capas, ranking, mapa SVG, dispersión |
| `kit.js` | La ficha de provincia («Preparar mi nota») y su escucha digital |
| `fichadoc.js` | Ficha descargable (HTML) de una provincia |
| `comparar.js` | Comparación de dos territorios |
| `paginas.js` | Tabla de datos y página de metodología (texto del backend) |
| `escucha.js` | Vista «Escucha digital» |
| `metodologia.js` | Metodología, glosario y atajos de teclado |
| `formularios.js` | «Solicitar información» y «¿Te sirvió?» |
| `inicio.js` | Resumen del mapa, inicio, lista de provincias y paleta de comandos |
| `efectos.js` | Movimiento con GSAP (con respaldo CSS y `prefers-reduced-motion`) |
| `diccionario.js` | Inventario de las cinco bases (corte y solidez) y entrada por variable |
| `sensibilidad.js` | Rango de puesto con ±2 puntos de ruido y tabla de estabilidad |
| `seguimiento.js` | Provincias y temas que sigue el periodista (en su navegador) |
| `etica.js` | Compromiso de uso ético al descargar los datos |
| `descargas.js` | Ayuda por capa y descargas (SVG, PNG, CSV) |
| `flags.js` | Aplica los feature flags de cada medio |

Junto a `app.js` siguen `api.js` (cliente del backend), `tenant.js` (marca blanca),
`ui.js` (componentes de certeza) y `estados.js` (estados de carga).

## Reglas

- Una variable que cambia con el tiempo va en `estado.js`, nunca como `let` suelto en un módulo.
- Un módulo exporta lo que otro necesita; no hay variables globales en `window`.
- Después de tocar algo, abre el sitio con un backend y recorre las vistas: sin build no hay
  paso que avise de un error de importación hasta que el navegador carga la página.
