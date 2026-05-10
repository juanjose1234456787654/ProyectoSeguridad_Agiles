require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const identidadRoutes = require('./routes/identidadRoutes');
const { testConnections, databaseNames } = require('./config/db');
const { protect } = require('./middlewares/authMiddleware');
const { authorize } = require('./middlewares/roleMiddleware');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas de autenticación y módulo identidad
app.use('/api/auth', authRoutes);
app.use('/api/identidad', identidadRoutes);

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
app.listen(PORT, () => {
  console.log(`MS-IDENTIDAD corriendo en http://localhost:${PORT}`);
});
