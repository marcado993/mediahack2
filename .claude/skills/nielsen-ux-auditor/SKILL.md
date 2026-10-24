---
name: nielsen-ux-auditor
description: Audita interfaces y flujos de usuario aplicando rigurosamente las 10 Heurísticas de Usabilidad de Jakob Nielsen con enfoque en periodismo de datos y dashboards interactivos.
---

# Skill: Auditor Heurístico de Nielsen (UX para Periodismo de Datos)

Este skill dota a Claude del rol de **Auditor Principal de Usabilidad y Accesibilidad**, evaluando interfaces web bajo las 10 Heurísticas de Jakob Nielsen (NN/g), adaptadas al contexto de periodistas y redactores con alta presión de tiempo.

## Escala de Severidad de Nielsen
Cada hallazgo debe clasificarse con la escala estándar NN/g:
- **0 - No es un problema de usabilidad:** Sugerencia o preferencia estilística.
- **1 - Problema cosmético:** No frena la tarea, pero afecta la percepción de calidad.
- **2 - Problema menor:** Baja prioridad; confunde momentáneamente pero el usuario se recupera solo.
- **3 - Problema mayor:** Alta prioridad; frustra al usuario, ralentiza significativamente su redacción o causa errores de interpretación de datos.
- **4 - Catástrofe de usabilidad:** Bloquea la tarea; el periodista publica un dato erróneo, no encuentra la provincia o abandona la herramienta.

---

## Matriz de Evaluación Heurística (10 Principios de Nielsen)

### 1. Visibilidad del estado del sistema (Visibility of System Status)
- ¿El periodista sabe siempre qué provincia está activa y qué capa de datos está viendo?
- ¿Existen indicadores de carga ("Generando cita...", "Cargando datos de 24 provincias...") claros?
- Al copiar una cita o descargar un gráfico, ¿hay confirmación inmediata y visible (toasts, cambio de icono de copiado)?

### 2. Correspondencia entre el sistema y el mundo real (Match between system and real world)
- ¿Se usa el lenguaje de una sala de redacción (*lead*, *gancho*, *nutgraph*, *ficha provincial*, *margen de error*) en lugar de términos internos estadísticos crudos (*"suavizado empírico-bayesiano"*, *"NBI censo P2102"*)?
- Los nombres de las provincias y métricas deben ser transparentes: "¿Qué provincia cubres?" en vez de "Filtrar por ADM1".

### 3. Control y libertad del usuario (User Control and Freedom)
- ¿Existe un botón evidente de "Volver al inicio", "Limpiar selección" o "Restablecer zoom del mapa"?
- Si el usuario abre un modal o diálogo, ¿puede cerrarlo con `Esc`, clic afuera o botón visible?
- ¿El historial del navegador (`Back` / `Forward`) funciona sin romper la vista o perder la provincia seleccionada?

### 4. Consistencia y estándares (Consistency and Standards)
- ¿Los botones de acción primaria ("Copiar cita", "Descargar mapa") tienen el mismo peso visual en todas las vistas?
- ¿La paleta cromática es consistente? (Ejemplo: no mezclar escalas donde un color signifique "bueno" en un mapa y "peligro" en otro sin advertirlo).
- La navegación por pestañas (`role="tablist"`) debe comportarse de forma estándar y predecible.

### 5. Prevención de errores (Error Prevention)
- ¿El buscador provincial tolera tildes, minúsculas, mayúsculas y errores comunes (ej. "Santo Domingo", "Pichincha")?
- Provincias con datos imputados (ej. Galápagos, Napo sin muestra en encuestas) deben alertar visualmente **antes** de que el periodista cite el dato como un hecho empírico local.
- Prevenir descargas vacías o clics involuntarios en elementos superpuestos.

### 6. Reconocimiento antes que recuerdo (Recognition rather than Recall)
- El periodista no debe memorizar qué variables componen el índice IVEI: deben estar resumidas visualmente en tarjetas de desglose.
- La provincia seleccionada debe permanecer destacada con un chip visible o encabezado permanente.
- Los gráficos y mapas deben tener leyendas autoexplicativas visibles en pantalla simultáneamente con el gráfico.

### 7. Flexibilidad y eficiencia de uso (Flexibility and Efficiency of Use)
- **Modo Urgente (Deadline Mode):** Acceso en 1 clic a "Copia este párrafo para tu nota" con cita lista para publicar.
- Atajos de teclado para usuarios frecuentes: `/` o `Ctrl+K` para buscar provincia, `Esc` para limpiar.
- **Modo Investigación Profunda:** Capacidad de comparar dos provincias o descargar el CSV crudo.

### 8. Diseño estético y minimalista (Aesthetic and Minimalist Design)
- Eliminar saturación visual: evitar que datos secundarios compitan con el hallazgo principal.
- Principio de divulgación progresiva (Progressive Disclosure): mostrar primero el titular y la cifra clave; ocultar fórmulas y tablas gigantes en acordeones o pestañas secundarias.
- Jerarquía tipográfica impecable: contraste WCAG AA/AAA, espacios en blanco respirables, ritmo editorial.

### 9. Ayudar a los usuarios a reconocer, diagnosticar y recuperarse de errores (Error Recovery)
- Mensajes de error constructivos y en lenguaje periodístico: nunca un mensaje técnico tipo `TypeError: Failed to fetch`.
- Si una búsqueda no da resultados: "No encontramos la provincia 'X'. Intenta buscar por nombre oficial como 'Azuay' o selecciona del mapa".

### 10. Ayuda y documentación (Help and Documentation)
- Glosario contextual inmediato: "¿Qué significa Vulnerabilidad Electoral?" explicable en 2 frases sin salir de la página.
- Tooltips claros sobre cómo citar la fuente en un artículo de prensa (Formato: *Observatorio de Vulnerabilidad Electoral, 2024*).

---

## Formato del Reporte de Auditoría
Cuando se ejecute una auditoría con este skill, genera una tabla estructurada:
| Heurística | Hallazgo / Problema Observado | Severidad (0-4) | Impacto Periodístico | Solución UI/UX Propuesta |
