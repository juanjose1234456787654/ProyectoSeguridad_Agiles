require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { protect } = require('./middlewares/authMiddleware');
const {
  identidadAuthProxy,
  identidadApiProxy,
  incidentesProxy,
  incidentesSocketProxy,
  seguridadProxy,
  estadisticasProxy
} = require('./config/proxies');

const app = express();
app.use(cors());

// Logger de peticiones entrantes
app.use((req, _res, next) => {
  console.log(`[GATEWAY] ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Proxy de Socket.IO hacia MS-INCIDENTES
app.use('/socket.io', incidentesSocketProxy);

// Verificacion de JWT en todas las rutas (excepto /api/auth/login)
app.use(protect);

// ─── Enrutamiento hacia microservicios ────────────────────────────────────────

// MS-IDENTIDAD  → login y perfil
app.use('/api/auth', identidadAuthProxy);
app.use('/api/identidad', identidadApiProxy);

// MS-INCIDENTES → incidentes y zonas
app.use('/api/incidentes', incidentesProxy);
app.use('/api/zonas', incidentesProxy);

// MS-SEGURIDAD  → guardias y alertas
app.use('/api/seguridad', seguridadProxy);

// MS-ESTADISTICAS → historial
app.use('/api/estadisticas', estadisticasProxy);

// ─── Estado general del gateway ───────────────────────────────────────────────
app.get('/api/gateway/health', (_req, res) => {
  res.json({
    microservicio: 'API-GATEWAY',
    ok: true,
    timestamp: new Date().toISOString(),
    servicios: {
      'MS-IDENTIDAD':    process.env.MS_IDENTIDAD_URL    || 'http://localhost:4001',
      'MS-INCIDENTES':   process.env.MS_INCIDENTES_URL   || 'http://localhost:4002',
      'MS-SEGURIDAD':    process.env.MS_SEGURIDAD_URL    || 'http://localhost:4003',
      'MS-ESTADISTICAS': process.env.MS_ESTADISTICAS_URL || 'http://localhost:4004'
    }
  });
});

// Ruta no encontrada
app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada en el API Gateway' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API-GATEWAY corriendo en http://localhost:${PORT}`);
  console.log(`  → /socket.io/*          MS-INCIDENTES  (:4002)`);
  console.log(`  → /api/auth/*           MS-IDENTIDAD   (:4001)`);
  console.log(`  → /api/incidentes/*     MS-INCIDENTES  (:4002)`);
  console.log(`  → /api/zonas/*          MS-INCIDENTES  (:4002)`);
  console.log(`  → /api/seguridad/*      MS-SEGURIDAD   (:4003)`);
  console.log(`  → /api/estadisticas/*   MS-ESTADISTICAS(:4004)`);
});
