/**
 * adminService.js
 * Llamadas al API para el panel de Administrador (HU-5)
 */

import { API_BASE_URL } from '../../../config/endpoints';

const API = API_BASE_URL;

const getToken = () => {
  try {
    const stored = sessionStorage.getItem('user') || localStorage.getItem('user');
    return stored ? JSON.parse(stored).token : null;
  } catch { return null; }
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`
});

const handleResponse = async (res) => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
};

// ── Estadísticas (T5.1 / T5.2) ───────────────────────────────────────────────

export const getEstadisticas = () =>
  fetch(`${API}/incidentes/estadisticas`, { headers: authHeaders() }).then(handleResponse);

const PERIODOS_VALIDOS = new Set(['dia', 'semana', 'mes', 'anio']);

const normalizarPeriodo = (periodo) => {
  const valor = String(periodo || '').trim().toLowerCase();
  return PERIODOS_VALIDOS.has(valor) ? valor : 'mes';
};

export const getHistorial = ({ periodo } = {}) => {
  const periodoNormalizado = normalizarPeriodo(periodo);
  const query = new URLSearchParams({
    periodo: periodoNormalizado,
    temporalidad: periodoNormalizado
  });

  return fetch(`${API}/estadisticas/historial?${query.toString()}`, {
    headers: authHeaders()
  }).then(handleResponse);
};

export const getEstadisticasPorPeriodo = ({ periodo } = {}) => {
  const periodoNormalizado = normalizarPeriodo(periodo);
  const query = new URLSearchParams({
    periodo: periodoNormalizado,
    temporalidad: periodoNormalizado
  });

  return fetch(`${API}/incidentes/estadisticas?${query.toString()}`, {
    headers: authHeaders()
  }).then(handleResponse);
};

// ── Gestión de usuarios ───────────────────────────────────────────────────────

export const getUsuarios = () =>
  fetch(`${API}/identidad/usuarios`, { headers: authHeaders() }).then(handleResponse);

export const updateUsuario = (id, datos) =>
  fetch(`${API}/identidad/usuarios/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(datos)
  }).then(handleResponse);

export const bloquearUsuario = (id, bloqueado) =>
  fetch(`${API}/identidad/usuarios/${id}/bloquear`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ bloqueado })
  }).then(handleResponse);

export const deleteUsuario = (id) =>
  fetch(`${API}/identidad/usuarios/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  }).then(handleResponse);

export const getGuardiasEstado = () =>
  fetch(`${API}/seguridad/guardias`, { headers: authHeaders() }).then(handleResponse);

export const getContactosDeUsuario = (idUsuario) =>
  fetch(`${API}/contactos?idUsuario=${encodeURIComponent(idUsuario)}`, {
    headers: authHeaders()
  }).then(handleResponse);
