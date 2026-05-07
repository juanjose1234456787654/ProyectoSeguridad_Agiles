require('dotenv').config();
const express = require('express');
const cors = require('cors');
const estadoGuardiaRoutes = require('./routes/estadoGuardiaRoutes');
const asignacionAlertaRoutes = require('./routes/asignacionAlertaRoutes');
const { testConnections, databaseNames } = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());

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
app.listen(PORT, () => {
  console.log(`MS-SEGURIDAD corriendo en http://localhost:${PORT}`);
});
