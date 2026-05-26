import axios from 'axios';
import authService from '../../../auth/login/services/authService';

const API_BASE = 'http://localhost:4000/api/contactos';

const headers = () => ({ headers: authService.getAuthHeader() });

// ─── Búsqueda de personas en BD_UTA ─────────────────────────────────────────
const buscarPersonas = async (q) => {
  const res = await axios.get(`${API_BASE}/buscar`, { params: { q }, ...headers() });
  return res.data;
};

// ─── Contactos individuales ──────────────────────────────────────────────────
const getContactos = async () => {
  const res = await axios.get(API_BASE, headers());
  return res.data;
};

const addContacto = async ({ correo, alias }) => {
  const res = await axios.post(API_BASE, { correo, alias }, headers());
  return res.data;
};

const removeContacto = async (id) => {
  const res = await axios.delete(`${API_BASE}/${id}`, headers());
  return res.data;
};

// ─── Grupos de confianza ─────────────────────────────────────────────────────
const getGrupos = async () => {
  const res = await axios.get(`${API_BASE}/grupos`, headers());
  return res.data;
};

const createGrupo = async ({ nombre, correos }) => {
  const res = await axios.post(`${API_BASE}/grupos`, { nombre, correos }, headers());
  return res.data;
};

const updateGrupo = async (id, { nombre, correos }) => {
  const res = await axios.put(`${API_BASE}/grupos/${id}`, { nombre, correos }, headers());
  return res.data;
};

const deleteGrupo = async (id) => {
  const res = await axios.delete(`${API_BASE}/grupos/${id}`, headers());
  return res.data;
};

// ─── Alerta a todos los contactos ───────────────────────────────────────────
const alertarContactos = async (mensaje = '') => {
  const res = await axios.post(`${API_BASE}/alertar`, { mensaje }, headers());
  return res.data;
};

export default {
  buscarPersonas,
  getContactos,
  addContacto,
  removeContacto,
  getGrupos,
  createGrupo,
  updateGrupo,
  deleteGrupo,
  alertarContactos
};
