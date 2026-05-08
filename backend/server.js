require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');                          // ← NUEVO
const { Server } = require('socket.io');              // ← NUEVO
const mysql = require('mysql2/promise');              // ← NUEVO

const authRoutes = require('./routes/authRoutes');
const dbRoutes = require('./routes/dbRoutes');
const casosRoutes = require('./routes/casosRoutes');  // ← NUEVO (T5.2, T5.3)

const app = express();
const server = http.createServer(app);                // ← NUEVO

// ── Socket.IO (T5.4 - notificaciones en tiempo real) ──────────────────────────
const io = new Server(server, {                       // ← NUEVO
  cors: { origin: "*" }
});
app.set('io', io);                                    // ← NUEVO

// ── Pools MySQL por base de datos ─────────────────────────────────────────────
const db_inc = mysql.createPool({                     // ← NUEVO BD_INCIDENTES
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'BD_INCIDENTES',
});

const db_seg = mysql.createPool({                     // ← NUEVO BD_SEGURIDAD
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'BD_SEGURIDAD',
});

const db_est = mysql.createPool({                     // ← NUEVO BD_ESTADISTICAS
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'BD_ESTADISTICAS',
});

app.set('db_inc', db_inc);                            // ← NUEVO
app.set('db_seg', db_seg);                            // ← NUEVO
app.set('db_est', db_est);                            // ← NUEVO

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Rutas existentes ──────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/db', dbRoutes);

// ── Ruta de casos (T5.1 - T5.5) ──────────────────────────────────────────────
app.use('/api', casosRoutes);                         // ← NUEVO

// Ruta de ejemplo para probar middleware de auth y roles
app.get('/api/perfil', require('./middlewares/authMiddleware').protect, (req, res) => {
  res.json({ message: 'Acceso concedido', usuario: req.usuario });
});

// Ruta solo para administradores (ejemplo)
app.get('/api/admin-only',
  require('./middlewares/authMiddleware').protect,
  require('./middlewares/roleMiddleware').authorize('Administrador'),
  (req, res) => {
    res.json({ message: 'Solo administradores ven esto' });
  }
);

// ── Servidor ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {                           // ← CAMBIO: server en vez de app
  console.log(`Servidor backend en http://localhost:${PORT}`);
});