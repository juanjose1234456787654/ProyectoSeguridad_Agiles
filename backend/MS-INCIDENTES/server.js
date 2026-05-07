require('dotenv').config();
const express = require('express');
const cors = require('cors');
const incidenteRoutes = require('./routes/incidenteRoutes');
const zonaRoutes = require('./routes/zonaRoutes');
const { testConnections, databaseNames } = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());

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
app.listen(PORT, () => {
  console.log(`MS-INCIDENTES corriendo en http://localhost:${PORT}`);
});
