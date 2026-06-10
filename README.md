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

## APK Android (Capacitor)

El proyecto ya incluye una app Android en `frontend/android`.

Pasos rapidos:

1. Configurar `frontend/.env.production` con tu dominio HTTPS publico.
2. Ejecutar en `frontend`:
	- `npm install`
	- `npm run build`
	- `npm run cap:sync`
3. Compilar APK debug en `frontend/android`:
	- `gradlew.bat assembleDebug` (Windows)

APK generado en:

- `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

Importante para sockets en movil:

- Configurar `CORS_ORIGINS` en `MS-IDENTIDAD`, `MS-INCIDENTES` y `MS-SEGURIDAD`.
- Ejemplo: `CORS_ORIGINS=https://tu-dominio-publico,capacitor://localhost,https://localhost,http://localhost`