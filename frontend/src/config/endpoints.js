const getEnv = (key) => {
  const value = import.meta.env?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

const normalizeBaseUrl = (raw, fallback) => {
  const input = raw || fallback;
  return String(input || '').trim().replace(/\/$/, '');
};

export const GATEWAY_URL = normalizeBaseUrl(
  getEnv('VITE_GATEWAY_URL'),
  'http://localhost:4000'
);

export const API_BASE_URL = `${GATEWAY_URL}/api`;

export const SOCKET_INCIDENTES_URL = normalizeBaseUrl(
  getEnv('VITE_SOCKET_INCIDENTES_URL'),
  GATEWAY_URL
);

export const SOCKET_SEGURIDAD_URL = normalizeBaseUrl(
  getEnv('VITE_SOCKET_SEGURIDAD_URL'),
  'http://localhost:4003'
);