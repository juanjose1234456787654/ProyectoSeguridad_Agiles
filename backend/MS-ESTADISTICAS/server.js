require('dotenv').config();
const express = require('express');
const cors = require('cors');
const historialRoutes = require('./routes/historialRoutes');
const { testConnections, databaseNames } = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/estadisticas/historial', historialRoutes);

app.get('/api/estadisticas/health', async (req, res) => {
  try {
    const status = await testConnections();
    const allConnected = Object.values(status).every((item) => item.connected);

    res.status(allConnected ? 200 : 503).json({
      microservicio: 'MS-ESTADISTICAS',
      ok: allConnected,
      databases: databaseNames,
      status
    });
  } catch (error) {
    res.status(500).json({
      microservicio: 'MS-ESTADISTICAS',
      ok: false,
      message: 'No se pudo validar las conexiones',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => {
  console.log(`MS-ESTADISTICAS corriendo en http://localhost:${PORT}`);
});
