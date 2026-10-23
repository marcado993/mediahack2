# Instrucciones del Proyecto para Claude (CLAUDE.md)

Este repositorio alberga el **Observatorio de Vulnerabilidad ante la Desinformación Electoral (OVADE)** en Ecuador, desplegado en Vercel:
🔗 **URL en producción:** [https://mediahack2-frontend.vercel.app/](https://mediahack2-frontend.vercel.app/)

---

## 🎯 Objetivo Principal
Optimizar la interfaz gráfica y la experiencia de usuario (UI/UX) del prototipo para que:
1. **Cumpla con rigor las 10 Heurísticas de Usabilidad de Jakob Nielsen (NN/g).**
2. **Sea intuitiva, ágil y de alto valor para periodistas y salas de redacción** bajo presión de tiempo (cobertura rápida de elecciones, reportajes territoriales y verificación de hechos).
3. **Mantenga la arquitectura ligera y sin build step (Vanilla HTML/CSS/JS)** que se sirve en Vercel.

---

## 📂 Arquitectura del Proyecto

```text
├── frontend/                  # Aplicación web estática desplegada en Vercel
│   ├── index.html            # Markup semántico, vistas y modales
│   ├── assets/
│   │   ├── app.css           # Sistema de diseño, tokens, componentes y responsive
│   │   ├── app.js            # Lógica cliente, navegación, renderizado de mapas/datos
│   │   ├── ui.js             # Componentes compartidos de certeza y presentación
│   │   ├── api.js            # Cliente fetch para el backend FastAPI
│   │   ├── tenant.js         # Personalización de marca y temas
│   │   └── ecuador_paths.json # Geometrías SVG precalculadas de las 24 provincias
│   └── public/               # Logotipos, favicons e iconos SVG
├── backend/                  # API REST en Python / FastAPI (app.main:app)
├── vercel.json               # Configuración de despliegue estático en Vercel
└── .claude/
    ├── skills/
    │   ├── nielsen-ux-auditor/       # Skill de auditoría heurística (NN/g)
    │   ├── journalism-ux-specialist/ # Skill de UX y flujos de trabajo de prensa
    │   ├── frontend-ui-refactor/     # Skill de implementación visual sin build step
    │   └── frontend-design/          # Skill de dirección de arte e identidad visual
    └── launch.json                   # Configuración para levantar frontend y backend
```

---

## 🛠️ Agentes y Skills Disponibles en `.claude/skills/`

Cuando trabajes en este repositorio, puedes invocar o adoptar los siguientes roles:

1. **`nielsen-ux-auditor`** (`.claude/skills/nielsen-ux-auditor/SKILL.md`):
   Evalúa cualquier pantalla o componente contra los 10 principios de Nielsen con escala de severidad de 0 a 4.
2. **`journalism-ux-specialist`** (`.claude/skills/journalism-ux-specialist/SKILL.md`):
   Asegura la adopción de la pirámide invertida, velocidad de redacción ("Kit de prensa en 1 clic"), citas reproducibles y advertencias de incertidumbre estadística.
3. **`frontend-ui-refactor`** (`.claude/skills/frontend-ui-refactor/SKILL.md`):
   Guía técnica para modificar `index.html`, `app.css` y `app.js` asegurando accesibilidad, rendimiento y consistencia estética.
4. **`frontend-design`** (`.claude/skills/frontend-design/SKILL.md`):
   Garantiza que la dirección visual sea deliberada, no genérica, y transmita rigor editorial y credibilidad.

---

## 📋 Lista de Verificación Heurística de Nielsen para OVADE

- [ ] **H1: Visibilidad del estado:** El usuario siempre sabe qué provincia está activa, si un dato se está cargando y recibe feedback al copiar o descargar.
- [ ] **H2: Lenguaje periodístico:** Se habla de *titulares*, *hallazgos*, *párrafos para nota* y *fuentes oficiales*, en lugar de nomenclaturas censales crudas.
- [ ] **H3: Control y libertad:** Fácil regreso al inicio, reseteo de filtros en mapas y cierre de diálogos con `Esc`.
- [ ] **H4: Consistencia:** Estilo y peso visual homogéneo en botones de acción y escalas de color predecibles.
- [ ] **H5: Prevención de errores:** Búsqueda tolerante a tildes/sinónimos y advertencias antes de citar provincias con datos imputados (ej. Galápagos, Napo).
- [ ] **H6: Reconocimiento:** Ficha provincial siempre visible sin obligar a memorizar métricas; leyendas de mapas integradas.
- [ ] **H7: Eficiencia:** Atajos de teclado (`/` para buscar provincia), botón de 1 clic para copiar texto y kits de prensa listos.
- [ ] **H8: Minimalismo:** Divulgación progresiva: primero el hallazgo principal, luego los factores desglosados y al final los datos brutos.
- [ ] **H9: Recuperación de errores:** Mensajes constructivos en lenguaje natural si falla la conexión o no hay resultados de búsqueda.
- [ ] **H10: Documentación contextual:** Glosarios cortos integrados y notas sobre cómo citar el observatorio en prensa.

---

## 🚀 Comandos Útiles

- **Levantar Frontend Localmente (puerto 5173):**
  ```powershell
  python -c "import http.server,os; os.chdir('frontend'); http.server.ThreadingHTTPServer(('0.0.0.0',5173),http.server.SimpleHTTPRequestHandler).serve_forever()"
  ```
- **Levantar Backend Localmente (puerto 8000):**
  ```powershell
  python -m uvicorn --app-dir backend app.main:app --port 8000 --reload
  ```
