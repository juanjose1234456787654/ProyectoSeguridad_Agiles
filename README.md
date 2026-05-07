# ProyectoSeguridad_Agiles

## Backend con multiples bases de datos

El backend ahora soporta conexiones separadas para estas bases:

- `BD_IDENTIDAD`
- `BD_INCIDENTES`
- `BD_SEGURIDAD`
- `BD_ESTADISTICAS`
- `BD_UTA`

Variables de entorno en `backend/.env`:

- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_IDENTIDAD_NAME`
- `DB_INCIDENTES_NAME`
- `DB_SEGURIDAD_NAME`
- `DB_ESTADISTICAS_NAME`
- `DB_UTA_NAME`

Endpoint para validar conexiones:

- `GET /api/db/health`