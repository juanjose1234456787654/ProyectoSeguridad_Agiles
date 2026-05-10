import axios from 'axios';
import { io } from 'socket.io-client';
import authService from './authService';

const API_BASE = 'http://localhost:4000/api';
const SOCKET_URL = 'http://localhost:4000';

const getToken = () => authService.getCurrentUser()?.token;

const getAuthHeaders = () => ({
  headers: authService.getAuthHeader()
});

const getAlertasActivasGuardia = async (idUsuario) => {
  const response = await axios.get(
    `${API_BASE}/seguridad/alertas/guardia/${idUsuario}/activas`,
    getAuthHeaders()
  );
  return response.data;
};

const getIncidentesActivos = async () => {
  const response = await axios.get(`${API_BASE}/incidentes/activos`, getAuthHeaders());
  return response.data;
};

const getIncidenteDetalle = async (idIncidente) => {
  const response = await axios.get(`${API_BASE}/incidentes/${idIncidente}`, getAuthHeaders());
  return response.data;
};

const cerrarReporte = async (idIncidente, acciones = '') => {
  const response = await axios.patch(
    `${API_BASE}/incidentes/${idIncidente}/cerrar`,
    { acciones },
    getAuthHeaders()
  );
  return response.data;
};

const getEstadoGuardia = async (idUsuario) => {
  const response = await axios.get(
    `${API_BASE}/seguridad/guardias/usuario/${idUsuario}`,
    getAuthHeaders()
  );
  return response.data;
};

const setEstadoGuardia = async ({ idEstado, enServicio, idUsuario }) => {
  const payload = {
    estado: enServicio ? 'En Servicio' : 'No en Servicio',
    horario: '6:00/14:00',
    idUsuario
  };

  if (idEstado) {
    const response = await axios.put(
      `${API_BASE}/seguridad/guardias/${idEstado}`,
      payload,
      getAuthHeaders()
    );
    return response.data;
  }

  const response = await axios.post(
    `${API_BASE}/seguridad/guardias`,
    payload,
    getAuthHeaders()
  );
  return response.data;
};

const connectGuardiaSocket = (handlers = {}) => {
  const token = getToken();
  const socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token }
  });

  socket.on('incidente:creado', (payload) => {
    if (handlers.onIncidenteChange) handlers.onIncidenteChange('incidente:creado', payload);
  });

  socket.on('incidente:actualizado', (payload) => {
    if (handlers.onIncidenteChange) handlers.onIncidenteChange('incidente:actualizado', payload);
  });

  socket.on('incidente:cerrado', (payload) => {
    if (handlers.onIncidenteChange) handlers.onIncidenteChange('incidente:cerrado', payload);
  });

  socket.on('connect_error', (error) => {
    if (handlers.onError) handlers.onError(error);
  });

  return socket;
};

export default {
  getAlertasActivasGuardia,
  getIncidentesActivos,
  getIncidenteDetalle,
  cerrarReporte,
  getEstadoGuardia,
  setEstadoGuardia,
  connectGuardiaSocket
};
