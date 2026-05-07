const { createProxyMiddleware } = require('http-proxy-middleware');

const proxyOptions = (target) => ({
  target,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      console.error(`[PROXY ERROR] ${req.method} ${req.path} → ${target}:`, err.message);
      res.status(502).json({
        message: 'Microservicio no disponible. Intenta más tarde.',
        servicio: target
      });
    }
  }
});

const identidadProxy = createProxyMiddleware(
  proxyOptions(process.env.MS_IDENTIDAD_URL || 'http://localhost:4001')
);

const incidentesProxy = createProxyMiddleware(
  proxyOptions(process.env.MS_INCIDENTES_URL || 'http://localhost:4002')
);

const seguridadProxy = createProxyMiddleware(
  proxyOptions(process.env.MS_SEGURIDAD_URL || 'http://localhost:4003')
);

const estadisticasProxy = createProxyMiddleware(
  proxyOptions(process.env.MS_ESTADISTICAS_URL || 'http://localhost:4004')
);

module.exports = {
  identidadProxy,
  incidentesProxy,
  seguridadProxy,
  estadisticasProxy
};
