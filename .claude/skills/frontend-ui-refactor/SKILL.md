---
name: frontend-ui-refactor
description: Guía técnica para implementar mejoras de diseño visual, CSS y componentes interactivos en el frontend de OVADE (frontend/index.html, app.css, app.js) sin romper el backend FastAPI ni requerir un build step.
---

# Skill: Refactorización Visual de Frontend (Vanilla HTML/CSS/JS)

Este skill define las pautas técnicas y arquitectónicas para refactorizar y pulir la interfaz del Observatorio de Vulnerabilidad ante la Desinformación Electoral (OVADE).

## Restricciones Técnicas del Proyecto
- **Zero-build step:** El proyecto corre en Vercel como sitio estático puro (`buildCommand: echo 'static site...'`, `outputDirectory: .`).
- **Archivos principales:**
  - `frontend/index.html`: Estructura semántica, vistas (`#v-perfil`, `#v-mapas`, `#v-comparar`, `#v-datos`, `#v-fuentes`, `#v-asistente`), diálogos y accesibilidad.
  - `frontend/assets/app.css`: Tokens CSS, variables (`--bg`, `--ink`, `--acc`, `--display`), componentes y layout responsivo.
  - `frontend/assets/app.js`: Lógica de renderizado, controladores de vistas, integración de mapas SVG (`assets/ecuador_paths.json`), gráficos de dispersión y tablas.
  - `frontend/assets/ui.js`: Componentes auxiliares de presentación (etiquetas de calidad, banderas de imputación, rangos de confianza).
  - `frontend/assets/api.js`: Llamadas `fetch` a la API de FastAPI.

---

## Directrices de Diseño y Estética Visual
1. **Paleta Cromática con Carácter Editorial:**
   - Fondo: Tono papel sobrio y profesional (`#f8fafc` o `#f1f5f9`).
   - Tinta: Casi negro con profundidad (`#0f172a` / `#1e293b`), evitando contrastes lavados.
   - Acento Periodístico: Azul institucional profundo (`#1b3a5c` o `#0f2942`) combinado con acentos cálidos para alertas y destaques (`#d97706` ámbar de advertencia, `#2563eb` azul de acción).
   - Escalas de Mapas: Monocromáticas secuenciales (azul claro a azul marino profundo para vulnerabilidad; nunca colores tipo semáforo que estigmaticen territorios).

2. **Tipografía con Voz Periodística:**
   - Display/Titulares: *Source Serif 4* o *Inter Display* con peso y tracking controlado para darle autoridad de medio de comunicación.
   - Lectura/Cuerpo: *Inter* (15px / 1.55) para máxima legibilidad en párrafos informativos.
   - Datos/Cifras: *IBM Plex Mono* o *Inter Tabular* (`font-feature-settings: "tnum"`) para alinear números, índices y márgenes de error.

3. **Componentes Clave a Mejorar para Usabilidad de Redacción:**
   - **Barra de Búsqueda y Selector Rápido:** Input prominente con selector de sugerencias en vivo y atajo visible (`/`).
   - **Ficha Provincial con Jerarquía:**
     - Header con bandera territorial, índice IVEI destacado con su margen (`±5 a ±7 pts`).
     - Alerta inmediata de imputación o muestra si aplica.
     - Caja destacada con botón "Copiar párrafo para tu nota" (con feedback visual "¡Copiado al portapapeles!").
     - 4 cuadrantes visuales de dimensiones clave (Carencias de base, Dependencia digital, Capacidad de contrastar, Clima electoral).
   - **Barra de Herramientas de Prensa:** Botones claros para exportar cita, SVG, PNG y CSV.
   - **Micro-interacciones y Estados del Sistema:**
     - Efectos hover suaves (`transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)`).
     - Toasts flotantes accesibles (`role="status"`).
     - Skeletons o loaders sutiles durante peticiones al backend.
