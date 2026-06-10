import axios from 'axios';
import { io } from 'socket.io-client';
import authService from '../../../auth/login/services/authService';
import { API_BASE_URL, SOCKET_INCIDENTES_URL, SOCKET_SEGURIDAD_URL } from '../../../config/endpoints';

const API_BASE = API_BASE_URL;
const SOCKET_URL = SOCKET_INCIDENTES_URL;

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
	try {
		const response = await axios.get(`${API_BASE}/incidentes/activos`, getAuthHeaders());
		return response.data;
	} catch (error) {
		const status = error?.response?.status;
		const message = String(error?.response?.data?.message || '').toLowerCase();
		const sinAlertas = message.includes('no hay alerta');

		if (status === 404 || (status === 400 && sinAlertas) || (status === 500 && sinAlertas)) {
			return [];
		}

		throw error;
	}
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

const asignarAlerta = async ({ idIncidente, idEstadoGuardia }) => {
	const response = await axios.post(
		`${API_BASE}/seguridad/alertas`,
		{ idIncidente, idEstadoGuardia },
		getAuthHeaders()
	);
	return response.data;
};

const connectGuardiaSocket = (handlers = {}) => {
	const token = getToken();
	const socketIncidentes = io(SOCKET_URL, {
		transports: ['websocket'],
		auth: { token }
	});
	const socketSeguridad = io(SOCKET_SEGURIDAD_URL, {
		transports: ['websocket'],
		auth: { token }
	});

	socketIncidentes.on('incidente:creado', (payload) => {
		if (handlers.onIncidenteChange) handlers.onIncidenteChange('incidente:creado', payload);
	});

	socketIncidentes.on('incidente:actualizado', (payload) => {
		if (handlers.onIncidenteChange) handlers.onIncidenteChange('incidente:actualizado', payload);
	});

	socketIncidentes.on('incidente:cerrado', (payload) => {
		if (handlers.onIncidenteChange) handlers.onIncidenteChange('incidente:cerrado', payload);
	});

	socketSeguridad.on('alerta:asignada', (payload) => {
		if (handlers.onAsignacionChange) handlers.onAsignacionChange('alerta:asignada', payload);
	});

	socketSeguridad.on('alerta:desasignada', (payload) => {
		if (handlers.onAsignacionChange) handlers.onAsignacionChange('alerta:desasignada', payload);
	});

	socketIncidentes.on('connect_error', (error) => {
		if (handlers.onError) handlers.onError(error);
	});

	socketSeguridad.on('connect_error', (error) => {
		if (handlers.onError) handlers.onError(error);
	});

	return {
		disconnect: () => {
			socketIncidentes.disconnect();
			socketSeguridad.disconnect();
		}
	};
};

export default {
	getAlertasActivasGuardia,
	getIncidentesActivos,
	getIncidenteDetalle,
	cerrarReporte,
	getEstadoGuardia,
	setEstadoGuardia,
	asignarAlerta,
	connectGuardiaSocket
};
