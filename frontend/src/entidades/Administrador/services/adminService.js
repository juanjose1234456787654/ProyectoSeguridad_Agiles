/**
 * adminService.js
 * Llamadas al API para el panel de Administrador (HU-5)
 */

const API = 'http://localhost:4000/api';

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

// ── Contactos de confianza de un usuario (para ver desde Admin) ───────────────

export const getContactosDeUsuario = (idUsuario) =>
  fetch(`${API}/contactos?idUsuario=${encodeURIComponent(idUsuario)}`, {
    headers: authHeaders()
  }).then(handleResponse);
