require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const incidenteRoutes = require('./routes/incidenteRoutes');
const zonaRoutes = require('./routes/zonaRoutes');
const { testConnections, databaseNames } = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:4000'],
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
  console.log(`[SOCKET] cliente conectado ${socket.id} (${socket.usuario?.rol || 'sin-rol'})`);
  socket.on('disconnect', () => {
    console.log(`[SOCKET] cliente desconectado ${socket.id}`);
  });
});

app.set('io', io);

// Rutas principales
app.use('/api/incidentes', incidenteRoutes);
app.use('/api/zonas', zonaRoutes);

// Health check: verifica conexión a BD_INCIDENTES
app.get('/api/incidentes/health', async (req, res) => {
  try {
    const status = await testConnections();
    const allConnected = Object.values(status).every((item) => item.connected);
    res.status(allConnected ? 200 : 503).json({
      microservicio: 'MS-INCIDENTES',
      ok: allConnected,
      databases: databaseNames,
      status
    });
  } catch (error) {
    res.status(500).json({
      microservicio: 'MS-INCIDENTES',
      ok: false,
      message: 'No se pudo validar las conexiones',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 4002;
server.listen(PORT, () => {
  console.log(`MS-INCIDENTES corriendo en http://localhost:${PORT}`);
});
