# Actualizar el backend en el servidor de Oracle

Qué sube: rutas nuevas (`/api/tenant-config`, `/api/admin/*`, `/api/solicitudes`,
`/api/retroalimentacion`) y los textos en lenguaje de redacción de `ivei.py` y
`segmentadores.py`. `requirements.txt` no cambia, no hace falta `pip install`.
Se necesita una variable nueva: `ADMIN_TOKEN`.

Hazlo en este orden. Cada paso tiene su comprobación; si una falla, para.

## 0. Ubicar el servicio y la carpeta

```bash
systemctl list-units --type=service --all | grep -iE "mediahack|uvicorn"
systemctl cat NOMBRE_DEL_SERVICIO        # muestra WorkingDirectory y ExecStart
```

Anota la carpeta del repo (`REPO`) y el nombre del servicio (`SVC`).

## 1. Mirar si hay parches hechos a mano en el servidor

El commit `acbc10e` documenta que se han hecho cambios directos en el servidor.
No actualices sin ver esto:

```bash
cd REPO
git status
git diff                       # cambios sin commit
git log -1 --oneline           # anota este commit: es tu punto de regreso
```

Si hay diferencias, guárdalas antes de seguir:

```bash
git diff > ~/parches_en_vivo_$(date +%F).patch
```

## 2. Respaldo

```bash
cp -a REPO/backend/app/data ~/respaldo_data_$(date +%F)
cp REPO/backend/.env ~/respaldo_env_$(date +%F)
```

## 3. Traer el código

```bash
cd REPO
git fetch origin
git diff HEAD origin/main -- backend/requirements.txt   # debe salir vacío
git checkout main
git pull --ff-only origin main
```

Si `git pull --ff-only` se niega, hay divergencia: no fuerces. Revisa el paso 1.
Si `git checkout` se queja de cambios locales, aplica primero el parche guardado
con `git stash` o revísalo a mano.

## 4. Definir `ADMIN_TOKEN`

Solo si no existe todavía:

```bash
cd REPO/backend
grep -q '^ADMIN_TOKEN=' .env || printf '\nADMIN_TOKEN=%s\n' "$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')" >> .env
chmod 600 .env
```

El token queda solo en el `.env` del servidor. No lo pegues en chats ni en git.
Quien administre el panel lo lee ahí. Sin `ADMIN_TOKEN` el panel queda desactivado
(el resto del backend funciona igual).

## 5. Reiniciar

```bash
sudo systemctl restart SVC
sudo systemctl status SVC --no-pager | head -12
sudo journalctl -u SVC -n 40 --no-pager
```

## 6. Verificar (en el servidor y desde fuera)

```bash
curl -s localhost:8000/api/health
curl -s localhost:8000/api/tenant-config | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" localhost:8000/api/admin/tenants          # debe dar 401
curl -s localhost:8000/api/segmentadores/mapa | python3 -c "import sys,json;print([c['nombre'] for c in json.load(sys.stdin)['capas']])"
# desde tu computador:
curl -s https://mediahack-api.apiprueba.online/api/tenant-config | head -c 200
```

Esperado: `ok`, un JSON con `slug: default`, `401`, y nombres como «Nivel de
vulnerabilidad», «Sin conexión», «Saturación de redes».

Los archivos `tenants.json`, `solicitudes.json` y `retroalimentacion.json` se crean
solos en `backend/app/data/` (ya están en `.gitignore`). El usuario del servicio
debe poder escribir ahí; ya lo hace con los `*_cache.json`.

## 7. Si algo sale mal: volver atrás

```bash
cd REPO
git checkout COMMIT_ANOTADO_EN_EL_PASO_1
sudo systemctl restart SVC
```

Los archivos de datos nuevos no estorban a la versión anterior.

## Después

- Panel de medios: proyecto aparte en Vercel con raíz `admin/` y las variables
  `VITE_API_BASE` (URL del backend) y `VITE_PUBLIC_URL` (URL del sitio público).
- Hasta que el backend esté actualizado, el sitio nuevo muestra nombres técnicos en
  las capas y los formularios de solicitud y retroalimentación avisan que no hay conexión.
- Si prefieres no tocar producción primero: repite estos pasos en una copia
  (`/opt/mediahack2-staging`, puerto 8010, otro `.env` y otro `ADMIN_TOKEN`) y apunta la
  vista previa de Vercel a esa URL.
