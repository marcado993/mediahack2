# Cómo probar el prototipo para periodistas

Esta rama (`prueba/prototipo-periodistas`) une, en orden, los tres bloques de trabajo
que iban a ser tres pull requests. Cada uno entró con su propio merge commit, así que
en `git log --graph` se ve qué trajo cada bloque:

| # | Rama | Qué trae |
|---|------|----------|
| 1 | `feature/ovade-periodistas` | Herramienta para periodistas, panel de marca blanca y solicitudes de información |
| 2 | `feature/ux-nielsen-periodistas` | Ficha en modo Nota rápida, escucha digital dentro de la ficha, "Sobre los datos", ayuda por capa del mapa y ajustes según las heurísticas de Nielsen |
| 3 | `feature/retroalimentacion-medios` | «¿Te sirvió?» al copiar, formulario del medio y bandeja en el panel |

Las ramas originales siguen intactas. Esta rama es solo para probar: **no se fusiona a `main`**.

---

## Opción A · Vista previa en Vercel (sin instalar nada)

Vercel publica cada push de esta rama en una URL de vista previa. Está protegida:
quien la abra necesita acceso al proyecto en Vercel, o que el dueño active un
enlace para compartir (Vercel → proyecto → Settings → Deployment Protection).

**Qué funciona ahí:** ficha de provincia, mapa, comparar, escucha digital y "Sobre los datos".
**Qué no funciona todavía:** solicitar información, retroalimentación y el panel de medios.
Usan rutas del backend que aún no están desplegadas en `mediahack-api.apiprueba.online`;
la página muestra un aviso y sigue funcionando.

## Opción B · Todo en local (prueba completa, unos 5 minutos)

Requisitos: Python 3.11+ y Node 18+.

```bash
git fetch origin
git switch prueba/prototipo-periodistas
pip install -r backend/requirements.txt
```

1. Backend (puerto 8000). Para entrar al panel, define un token de prueba en `backend/.env`:

   ```text
   ADMIN_TOKEN=elige-un-token-largo-de-prueba
   ```

   ```bash
   python -m uvicorn --app-dir backend app.main:app --port 8000
   ```

2. Sitio público (puerto 5173), en otra terminal:

   ```bash
   python -c "import http.server,os; os.chdir('frontend'); http.server.ThreadingHTTPServer(('0.0.0.0',5173),http.server.SimpleHTTPRequestHandler).serve_forever()"
   ```

3. Panel de medios (puerto 5174), en otra terminal:

   ```bash
   npm --prefix admin install
   npm --prefix admin run dev
   ```

Abre http://localhost:5173 y http://localhost:5174 (en el panel, entra con el token del paso 1).

> La escucha digital depende de la sesión de X configurada en el backend. Si está vencida,
> la ficha lo dice ("No encontramos conversación política reciente…") y el resto sigue igual.

---

## Qué revisar

### PR 1 · Herramienta para periodistas y marca blanca
- [ ] En "Preparar mi nota", tocar una provincia en el mapa abre su ficha.
- [ ] El buscador del encabezado se abre con `/` o `Ctrl+K`.
- [ ] "Solicitar información" envía y aparece en el panel → Solicitudes. *(solo opción B)*
- [ ] Panel → Medios: cambiar el color o apagar un módulo se ve en la vista previa. *(solo opción B)*

### PR 2 · UX para periodistas
- [ ] Ficha de **Napo**: titular arriba, banda ámbar "Precaución editorial", y el texto copiado incluye la advertencia.
- [ ] Ficha de **Guayas**: bloque "Qué se está diciendo" con temas y publicaciones recientes, y su enlace a Escucha digital.
- [ ] "Investigar a fondo" está plegado; si se abre, la próxima ficha también abre así.
- [ ] Encabezado con 4 pestañas; "Sobre los datos" lleva a Metodología, Datos abiertos y Fuentes.
- [ ] Mapa: el "?" de cada capa muestra qué mide, sus variables y su fuente.
- [ ] Mapa: "Copiar cita de [provincia]" y el menú "Descargar" (SVG, PNG y CSV).
- [ ] Escribir "pichinca" o "guallas" en el buscador sugiere la provincia correcta.
- [ ] `Esc` cierra la ayuda, luego limpia la búsqueda, luego la selección y finalmente sale de la ficha.
- [ ] En el móvil (375 px) no hay scroll horizontal.

### PR 3 · Retroalimentación de los medios *(solo opción B)*
- [ ] Copiar un párrafo muestra «¿Te sirvió?» abajo a la derecha.
- [ ] "No del todo" → elegir un motivo → Enviar.
- [ ] Pie de página → "Cuéntanos qué necesita tu medio" → enviar el formulario.
- [ ] Panel → Retroalimentación muestra ambas respuestas y el resumen por medio.
- [ ] Apagar "Retroalimentación del medio" en el panel oculta la pregunta y el enlace del pie.

## Cómo reportar lo que encuentres
Anota la pantalla, la provincia, qué esperabas y qué pasó. Si es posible, agrega una captura.
