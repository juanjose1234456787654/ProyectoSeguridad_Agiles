require('dotenv').config();
const express = require('express');
const cors = require('cors');
const contactoRoutes = require('./routes/contactoRoutes');
const grupoRoutes = require('./routes/grupoRoutes');
const alertaRoutes = require('./routes/alertaRoutes');
const { testConnections, databaseNames } = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Rutas principales ────────────────────────────────────────────────────────

// Búsqueda de personas + CRUD de contactos individuales
app.use('/api/contactos', contactoRoutes);

// CRUD de grupos de confianza
app.use('/api/contactos/grupos', grupoRoutes);

// Envío simultáneo de alerta a todos los contactos
app.use('/api/contactos', alertaRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/contactos/health', async (req, res) => {
  try {
    const status = await testConnections();
    const allConnected = Object.values(status).every((item) => item.connected);
    res.status(allConnected ? 200 : 503).json({
      microservicio: 'MS-CONTACTOS',
      ok: allConnected,
      databases: databaseNames,
      status
    });
  } catch (error) {
    res.status(500).json({
      microservicio: 'MS-CONTACTOS',
      ok: false,
      message: 'No se pudo validar las conexiones',
      error: error.message
    });
  }
});

const PORT = process.env.MS_CONTACTOS_PORT || 4005;
app.listen(PORT, () => {
  console.log(`MS-CONTACTOS corriendo en http://localhost:${PORT}`);
});

module.exports = app; // Para los tests
