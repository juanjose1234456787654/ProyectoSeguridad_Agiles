const { testConnections, databaseNames } = require('../config/db');

const health = async (req, res) => {
  try {
    const status = await testConnections();
    const allConnected = Object.values(status).every((item) => item.connected);

    res.status(allConnected ? 200 : 503).json({
      ok: allConnected,
      databases: databaseNames,
      status
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: 'No se pudo validar conexiones de bases de datos',
      error: error.message
    });
  }
};

module.exports = { health };
