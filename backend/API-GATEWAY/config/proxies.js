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

const identidadAuthProxy = createProxyMiddleware(
  {
    ...proxyOptions(process.env.MS_IDENTIDAD_URL || 'http://localhost:4001'),
    pathRewrite: (path) => `/api/auth${path}`
  }
);

const identidadApiProxy = createProxyMiddleware(
  {
    ...proxyOptions(process.env.MS_IDENTIDAD_URL || 'http://localhost:4001'),
    pathRewrite: (path) => `/api/identidad${path}`
  }
);

const incidentesProxy = createProxyMiddleware(
  {
    ...proxyOptions(process.env.MS_INCIDENTES_URL || 'http://localhost:4002'),
    pathRewrite: (path, req) => {
      if (req.originalUrl.startsWith('/api/zonas')) {
        return `/api/zonas${path}`;
      }
      return `/api/incidentes${path}`;
    }
  }
);

const incidentesSocketProxy = createProxyMiddleware({
  target: process.env.MS_INCIDENTES_URL || 'http://localhost:4002',
  changeOrigin: true,
  ws: true,
  on: {
    error: (err, req, res) => {
      console.error(`[PROXY ERROR] ${req.method} ${req.path} (socket) → ${(process.env.MS_INCIDENTES_URL || 'http://localhost:4002')}:`, err.message);
      if (res && typeof res.status === 'function') {
        res.status(502).json({
          message: 'Servicio de socket no disponible. Intenta más tarde.',
          servicio: process.env.MS_INCIDENTES_URL || 'http://localhost:4002'
        });
      }
    }
  }
});

const seguridadProxy = createProxyMiddleware(
  {
    ...proxyOptions(process.env.MS_SEGURIDAD_URL || 'http://localhost:4003'),
    pathRewrite: (path) => `/api/seguridad${path}`
  }
);

const estadisticasProxy = createProxyMiddleware(
  {
    ...proxyOptions(process.env.MS_ESTADISTICAS_URL || 'http://localhost:4004'),
    pathRewrite: (path) => `/api/estadisticas${path}`
  }
);

module.exports = {
  identidadAuthProxy,
  identidadApiProxy,
  incidentesProxy,
  incidentesSocketProxy,
  seguridadProxy,
  estadisticasProxy
};
