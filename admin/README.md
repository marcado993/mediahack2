# Panel de medios (admin)

App aparte de la herramienta pública (`../frontend`). Gestiona, por medio,
la marca blanca y los feature flags. No comparte código ni deploy con el sitio
público; se hablan solo a través de la API (`/api/admin/*`, `/api/tenant-config`).

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # dist/
```

- El servidor necesita `ADMIN_TOKEN` (ver `../backend/.env.example`).
- `VITE_PUBLIC_URL` apunta a la herramienta pública para la vista previa en vivo.
- Despliegue: proyecto propio (root directory `admin`); `vercel.json` ya está listo.
