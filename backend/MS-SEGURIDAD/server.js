require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const estadoGuardiaRoutes = require('./routes/estadoGuardiaRoutes');
const asignacionAlertaRoutes = require('./routes/asignacionAlertaRoutes');
const { testConnections, databaseNames } = require('./config/db');

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost'
];

const envAllowedOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = envAllowedOrigins.length ? envAllowedOrigins : defaultAllowedOrigins;

const socketCorsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error('Origen CORS no permitido'));
};

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.usuario = decoded;
    }
    return next();
  } catch {
    // Token inválido — aun así dejamos conectar (canal interno)
    return next();
  }
});

io.on('connection', (socket) => {
  console.log(`[SOCKET SEGURIDAD] cliente conectado ${socket.id} (${socket.usuario?.rol || 'sin-rol'})`);
  socket.on('disconnect', () => {
    console.log(`[SOCKET SEGURIDAD] cliente desconectado ${socket.id}`);
  });
});

// Exponer io para que los controladores puedan emitir eventos
app.set('io', io);

// Rutas principales
app.use('/api/seguridad/guardias', estadoGuardiaRoutes);
app.use('/api/seguridad/alertas', asignacionAlertaRoutes);

// Health check: verifica conexión a BD_SEGURIDAD
app.get('/api/seguridad/health', async (req, res) => {
  try {
    const status = await testConnections();
    const allConnected = Object.values(status).every((item) => item.connected);
    res.status(allConnected ? 200 : 503).json({
      microservicio: 'MS-SEGURIDAD',
      ok: allConnected,
      databases: databaseNames,
      status
    });
  } catch (error) {
    res.status(500).json({
      microservicio: 'MS-SEGURIDAD',
      ok: false,
      message: 'No se pudo validar las conexiones',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 4003;
server.listen(PORT, () => {
  console.log(`MS-SEGURIDAD corriendo en http://localhost:${PORT}`);
});
