import authService from '../../../auth/login/services/authService';
import { API_BASE_URL } from '../../../config/endpoints';

const API_BASE = API_BASE_URL;
const LIMIT_DEFAULT = 8;

const getAuthHeaders = () => ({
  headers: {
    'Content-Type': 'application/json',
    ...authService.getAuthHeader()
  }
});

const handleResponse = async (res) => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
};

export const getHistorialDetallado = async ({ q = '', page = 1, limit = LIMIT_DEFAULT, desde = '', hasta = '' } = {}) => {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (desde) query.set('desde', desde);
  if (hasta) query.set('hasta', hasta);
  query.set('page', String(page || 1));
  query.set('limit', String(limit || LIMIT_DEFAULT));

  const response = await fetch(`${API_BASE}/estadisticas/historial/detallado?${query.toString()}`, getAuthHeaders());
  return handleResponse(response);
};
