# Tráiler de OVADE

Video de 48 s (1920×1080, 30 fps) hecho con [Remotion](https://www.remotion.dev/) y GSAP. Usa la identidad del sitio (azul marino, Anton, rojo, sello amarillo, cajas con sombra dura) y el mapa y los puntajes reales de las 24 provincias (`src/datos.json`).

## Generar el video

```bash
cd trailer
npm install
npx remotion render src/index.ts Trailer out/ovade-trailer.mp4
```

`Trailer` es la versión para publicar: usa la música original de `public/tema-ovade.wav`, compuesta por código en `musica/tema.py` (sin muestras ni música de terceros).

Para ver y ajustar en vivo:

```bash
npx remotion studio src/index.ts
```

## Cómo se sincroniza con la música

Las animaciones son líneas de tiempo de GSAP en pausa, movidas fotograma a fotograma (`useTL` en `src/base.tsx`), así que cada render da el mismo resultado.

- **Cortes:** cada escena dura un número entero de golpes y su transición termina en un golpe. Con una canción, `elegirCortes()` pone los cortes en los acentos más fuertes.
- **Instrumentos:** `useMusica()` entrega, en tiempo local de la escena, los golpes de bombo y de caja, los platillos, las frases de la voz y el nivel del bajo. Cada familia de efectos sigue a su instrumento:

| Instrumento | Efectos |
|---|---|
| Bombo | Cortes, sellos, lupa, «VS» |
| Caja | Clics, revelaciones y «Copiado» |
| Platillos | El ritmo de la escritura |
| Voz | Cuándo empiezan los títulos |
| Bajo | Qué tan hondo entra la cámara |

## Demo privada con otra canción (no se publica)

Las canciones con derechos no se suben al repositorio (`.gitignore`). Para probar una:

```bash
npx remotion ffmpeg -i "ruta/cancion.mp3" -ac 1 -ar 22050 musica/cancion.wav
cp "ruta/cancion.mp3" musica/cancion.mp3
py -3.13 musica/analizar.py        # tempo, golpes, tramo de 48 s (INICIO=segundos para forzarlo)
py -3.13 musica/instrumentos.py    # separa bombo, caja, platillos, voz y bajo
npx remotion ffmpeg -ss <inicio> -t 48 -i musica/cancion.mp3 -ar 44100 -ac 2 public/cancion-demo.wav
npx remotion render src/index.ts TrailerCancion out/demo.mp4
```

`<inicio>` es el valor `inicio` que queda en `musica/mapa.json`. `TrailerControl` es la misma demo con una franja que marca cada evento de cada instrumento, para revisar la sincronía.

## Archivos

| Archivo | Qué contiene |
|---|---|
| `src/Trailer.tsx` | Escenas y línea de tiempo |
| `src/base.tsx` | Identidad, datos, GSAP, reloj de golpes y `useMusica` |
| `src/transiciones.tsx` | Las 11 transiciones, una por corte |
| `src/efectos.tsx` | Efectos de periodismo: marcador, censura, sello, zócalo, cinta de titulares, «EN VIVO», lupa, odómetro, objetivos |
| `musica/` | Análisis de la canción y música original |
