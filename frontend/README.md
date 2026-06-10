# Frontend Web + APK (Capacitor)

Este frontend usa React + Vite y ahora esta preparado para generar APK Android con Capacitor.

## Configuracion de entorno (produccion)

Archivo: `.env.production`

Variables requeridas:

- `VITE_GATEWAY_URL=https://tu-dominio-publico`
- `VITE_SOCKET_INCIDENTES_URL=https://tu-dominio-publico`
- `VITE_SOCKET_SEGURIDAD_URL=https://tu-dominio-publico`

Notas:

- Usa siempre HTTPS para APK en produccion.
- El dominio debe apuntar al API Gateway.

## Comandos principales

- `npm install`
- `npm run build` (genera `dist/`)
- `npm run cap:sync` (sincroniza web en Android nativo)
- `npm run android` (build + sync + abre Android Studio)

## Generar APK debug

Desde `frontend/android`:

- `./gradlew assembleDebug` (Linux/Mac)
- `gradlew.bat assembleDebug` (Windows)

Salida del APK:

- `android/app/build/outputs/apk/debug/app-debug.apk`

## Build release (para distribucion)

1. Abrir Android Studio con el proyecto `frontend/android`.
2. Configurar firma (`Build > Generate Signed Bundle / APK`).
3. Generar `APK` o `AAB` firmado.

## Reglas para no romper sockets en APK

Los microservicios ya aceptan origenes configurables por `CORS_ORIGINS`.

En despliegue backend define, por ejemplo:

- `CORS_ORIGINS=https://tu-dominio-publico,capacitor://localhost,https://localhost,http://localhost`

Esto evita bloqueos de Socket.IO cuando la app corre en WebView Android.
