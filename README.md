# Altius de Chamisero Referidos

Webapp para capturar participantes de un sorteo y sumar posibilidades por referidos.

## Flujo

- Un participante se inscribe desde un QR.
- Los datos solicitados son nombre, telefono y email.
- La inscripcion base suma 1 posibilidad.
- Cada referido cargado suma 1 posibilidad adicional.
- Cada participante recibe un link/QR personal para volver a su tablero.
- El panel interno permite revisar participantes, exportar CSV y sortear con posibilidades ponderadas.

## Configuracion local

1. Copiar `.env.example` a `.env`.
2. Completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` cuando exista el proyecto en Supabase.
3. Para el panel interno en Vercel, completar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USERNAME` y `ADMIN_PASSWORD`.

Si no hay variables de Supabase, la app funciona en modo demo usando almacenamiento local del navegador.

## Supabase

Ejecutar el SQL de `supabase/schema.sql` en el SQL Editor de Supabase.

Si ya se habia ejecutado una version anterior con comuna o RUT, ejecutar primero `supabase/update-2026-09-06.sql`.

Para Vercel, cargar las mismas variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

El formulario publico usa la clave anonima de Supabase solo para insertar registros. El panel interno lee datos mediante `/api/admin-data`, protegido por `ADMIN_USERNAME`, `ADMIN_PASSWORD` y la service role key del servidor. El tablero personal lee solo el registro asociado al token publico del participante mediante `/api/participant-data`.

## URLs

- Publico / QR del evento: `/`
- Panel administrador: `/?admin=1`
- Tablero participante: se genera automaticamente como `/?participante=<token>`
