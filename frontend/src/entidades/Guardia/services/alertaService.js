import axios from 'axios';
import { io } from 'socket.io-client';
import authService from '../../../auth/login/services/authService';
import { API_BASE_URL, SOCKET_INCIDENTES_URL } from '../../../config/endpoints';

const API_BASE = API_BASE_URL;
const SOCKET_URL = SOCKET_INCIDENTES_URL;

const getAuthHeaders = () => ({
	headers: authService.getAuthHeader()
});

const getZonas = async () => {
	const response = await axios.get(`${API_BASE}/zonas`, getAuthHeaders());
	return response.data;
};

const crearAlerta = async ({ motivo, idZona, lat, lng, idUsuario }) => {
	const response = await axios.post(
		`${API_BASE}/incidentes`,
		{ motivo, idZona, lat, lng, idUsuario },
		getAuthHeaders()
	);
	return response.data;
};

const getMisAlertas = async () => {
	const response = await axios.get(`${API_BASE}/incidentes/usuario/me`, getAuthHeaders());
	return response.data;
};

const connectAlertasSocket = (handlers = {}) => {
	const token = authService.getCurrentUser()?.token;
	const socket = io(SOCKET_URL, {
		transports: ['websocket'],
		auth: { token }
	});

	socket.on('incidente:creado', (payload) => {
		if (handlers.onIncidenteCreado) handlers.onIncidenteCreado(payload);
	});

	socket.on('incidente:cerrado', (payload) => {
		if (handlers.onIncidenteCerrado) handlers.onIncidenteCerrado(payload);
	});

	socket.on('incidente:actualizado', (payload) => {
		if (handlers.onIncidenteActualizado) handlers.onIncidenteActualizado(payload);
	});

	socket.on('connect_error', (error) => {
		if (handlers.onError) handlers.onError(error);
	});

	return socket;
};

export default {
	getZonas,
	crearAlerta,
	getMisAlertas,
	connectAlertasSocket
};
