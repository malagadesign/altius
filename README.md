# Altius de Chamisero Referidos

Webapp para capturar participantes de un sorteo y sumar posibilidades por referidos.

## Flujo

- Un participante se inscribe desde un QR.
- Los datos solicitados son nombre, teléfono y email.
- La inscripción base suma 1 posibilidad.
- Cada referido agregado suma 1 posibilidad adicional.
- Los teléfonos se registran con prefijo chileno `+56`.
- Si un nombre, teléfono o email ya existe, el sistema bloquea el nuevo registro.
- Cada participante recibe un link personal para volver a su tablero.
- El panel interno permite revisar participantes, exportar CSV y sortear con posibilidades ponderadas.

## Configuración local

1. Copiar `.env.example` a `.env`.
2. Completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` cuando exista el proyecto en Supabase.
3. Para el panel interno en Vercel, completar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USERNAME` y `ADMIN_PASSWORD`.

Si no hay variables de Supabase, la app funciona en modo demo usando almacenamiento local del navegador.

## Supabase

Ejecutar el SQL de `supabase/schema.sql` en el SQL Editor de Supabase.

Si ya se había ejecutado una versión anterior con comuna o RUT, ejecutar primero `supabase/update-2026-09-06.sql`.

Para bloquear duplicados también desde la base, ejecutar después `supabase/update-2026-09-07-dedupe.sql`.

Para Vercel, cargar las mismas variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

El formulario público usa endpoints de servidor para validar duplicados e insertar registros en Supabase. El tablero recupera solo la información del token personal y el panel interno lee datos mediante `/api/admin-data`, protegido por `ADMIN_USERNAME`, `ADMIN_PASSWORD` y la service role key del servidor.

## URLs

- Registro desde QR / inicio del evento: `/`
- Registro desde QR anterior: `/?registro=1`
- Panel administrador: `/?admin=1`
- Tablero participante: se genera automáticamente como `/?participante=<token>`
