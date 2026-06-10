require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { testConnections, databaseNames } = require('./config/db');
const { protect } = require('./middlewares/authMiddleware');
const { authorize } = require('./middlewares/roleMiddleware');

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
  path: '/socket-identidad',
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Token no proporcionado'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.usuario = decoded;
    return next();
  } catch {
    return next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  console.log(`[SOCKET IDENTIDAD] cliente conectado ${socket.id} (${socket.usuario?.rol || 'sin-rol'})`);
  socket.on('disconnect', () => {
    console.log(`[SOCKET IDENTIDAD] cliente desconectado ${socket.id}`);
  });
});

app.set('io', io);

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de gestión de usuarios (Administrador)
app.use('/api/identidad/usuarios', adminRoutes);

// Health check: verifica conexión a BD_IDENTIDAD y BD_UTA
app.get('/api/identidad/health', async (req, res) => {
  try {
    const status = await testConnections();
    const allConnected = Object.values(status).every((item) => item.connected);
    res.status(allConnected ? 200 : 503).json({
      microservicio: 'MS-IDENTIDAD',
      ok: allConnected,
      databases: databaseNames,
      status
    });
  } catch (error) {
    res.status(500).json({
      microservicio: 'MS-IDENTIDAD',
      ok: false,
      message: 'No se pudo validar las conexiones',
      error: error.message
    });
  }
});

// Ruta de perfil protegida (requiere token válido)
app.get('/api/identidad/perfil', protect, (req, res) => {
  res.json({ message: 'Acceso concedido', usuario: req.usuario });
});

// Ruta solo para administradores (ejemplo)
app.get(
  '/api/identidad/admin-only',
  protect,
  authorize('Administrador'),
  (req, res) => {
    res.json({ message: 'Solo administradores ven esto' });
  }
);

const PORT = process.env.PORT || 4001;
server.listen(PORT, () => {
  console.log(`MS-IDENTIDAD corriendo en http://localhost:${PORT}`);
});
