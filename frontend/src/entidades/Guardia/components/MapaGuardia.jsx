import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import guardiaService from '../services/guardiaService';
import alertaService from '../services/alertaService';
import MapaCampus from './MapaCampus';
import '../styles/DashboardGuardia.css';

const MapaGuardia = () => {
	const { idIncidente } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const { user, logout } = useAuth();

	const [alertas, setAlertas] = useState([]);
	const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);
	const [zonasApi, setZonasApi] = useState([]);
	const [loadingAlertas, setLoadingAlertas] = useState(true);
	const [errorAlertas, setErrorAlertas] = useState('');
	const [avisoTiempoReal, setAvisoTiempoReal] = useState('');

	const [idEstado, setIdEstado] = useState(null);
	const [enServicio, setEnServicio] = useState(false);
	const [guardandoEstado, setGuardandoEstado] = useState(false);
	const [asignando, setAsignando] = useState(null);
	const [avisoAsignacion, setAvisoAsignacion] = useState('');
	const [avisoEstado, setAvisoEstado] = useState('');

	const idUsuarioGuardia = user?.id;

	const cargarAlertas = async () => {
		if (!idUsuarioGuardia) return;

		try {
			setLoadingAlertas(true);
			setErrorAlertas('');
			const data = await guardiaService.getIncidentesActivos();
			const lista = Array.isArray(data) ? data : [];
			setAlertas(lista);

			if (!idIncidente) {
				setErrorAlertas('No se especifico una alerta para mostrar en el mapa.');
				return;
			}

			const seleccionada = lista.find((a) => String(a.id) === String(idIncidente)) || null;
			setAlertaSeleccionada(seleccionada);
			if (!seleccionada) {
				setErrorAlertas(`La alerta ${idIncidente} ya no esta activa.`);
			}
		} catch (error) {
			const message = String(error?.response?.data?.message || '').trim();
			if (message.toLowerCase().includes('no hay alerta')) {
				setAlertas([]);
				setAlertaSeleccionada(null);
				setErrorAlertas('No hay alertas activas en este momento.');
			} else {
				setErrorAlertas(message || 'No se pudo cargar alertas activas');
			}
		} finally {
			setLoadingAlertas(false);
		}
	};

	const cargarEstadoGuardia = async () => {
		if (!idUsuarioGuardia) return;

		try {
			const estados = await guardiaService.getEstadoGuardia(idUsuarioGuardia);
			const actual = Array.isArray(estados) ? estados[0] : null;

			if (actual) {
				setIdEstado(actual.id);
				const valor = String(actual.estado || '').toLowerCase();
				const esNoServicio = valor.includes('no en servicio') || valor.startsWith('no ');
				setEnServicio(!esNoServicio && (valor === 'en servicio' || valor === 'check' || valor === 'activo' || valor === 'true'));
			}
		} catch {
			// Si falla, se permite reintentar al guardar.
		}
	};

	useEffect(() => {
		cargarEstadoGuardia();
		cargarAlertas();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [idUsuarioGuardia, idIncidente]);

	useEffect(() => {
		if (!idUsuarioGuardia || !idIncidente) return undefined;

		const intervalId = window.setInterval(() => {
			cargarAlertas();
		}, 15000);

		return () => {
			window.clearInterval(intervalId);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [idUsuarioGuardia, idIncidente]);

	useEffect(() => {
		if (!user?.token) return;

		alertaService.getZonas()
			.then((data) => setZonasApi(Array.isArray(data) ? data : []))
			.catch(() => {});
	}, [user?.token]);

	useEffect(() => {
		if (!user?.token) return undefined;

		let timerId;
		const socket = guardiaService.connectGuardiaSocket({
			onIncidenteChange: (eventName, payload) => {
				if (eventName === 'incidente:creado') {
					setAvisoTiempoReal(`Nueva alerta en vivo: ${payload?.id || 'SIN-ID'} - ${payload?.motivo || 'Sin motivo'}`);
				} else if (eventName === 'incidente:actualizado') {
					setAvisoTiempoReal(`Alerta actualizada: ${payload?.id || 'SIN-ID'} - Estado ${payload?.estado || 'sin cambio'}`);
				} else if (eventName === 'incidente:cerrado') {
					setAvisoTiempoReal(`Alerta cerrada: ${payload?.id || 'SIN-ID'}`);
				}

				window.clearTimeout(timerId);
				timerId = window.setTimeout(() => setAvisoTiempoReal(''), 6000);
				cargarAlertas();
			},
			onAsignacionChange: (eventName, payload) => {
				if (eventName === 'alerta:asignada') {
					setAvisoTiempoReal(`Asignacion actualizada para alerta ${payload?.idIncidente || 'SIN-ID'}`);
				} else if (eventName === 'alerta:desasignada') {
					setAvisoTiempoReal(`Desasignacion actualizada para alerta ${payload?.idIncidente || 'SIN-ID'}`);
				}

				window.clearTimeout(timerId);
				timerId = window.setTimeout(() => setAvisoTiempoReal(''), 6000);
				cargarAlertas();
			},
			onError: () => {}
		});

		return () => {
			window.clearTimeout(timerId);
			socket.disconnect();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.token, idUsuarioGuardia, idIncidente]);

	const onCambiarServicio = async (nuevoValor) => {
		if (!idUsuarioGuardia || guardandoEstado) return;

		setAvisoEstado('');
		try {
			setGuardandoEstado(true);
			const response = await guardiaService.setEstadoGuardia({
				idEstado,
				enServicio: nuevoValor,
				idUsuario: idUsuarioGuardia
			});

			setEnServicio(nuevoValor);
			if (!idEstado && response?.id) setIdEstado(response.id);
			setAvisoEstado(`Estado guardado: ${nuevoValor ? 'En Servicio' : 'No en Servicio'}`);
			setTimeout(() => setAvisoEstado(''), 4000);
		} catch (e) {
			const msg = e?.response?.data?.message || e?.message || 'Error al guardar el estado';
			setAvisoEstado(msg);
		} finally {
			setGuardandoEstado(false);
		}
	};

	const onAsignar = async () => {
		if (!idUsuarioGuardia || !alertaSeleccionada || asignando) return;

		try {
			setAsignando(alertaSeleccionada.id);
			setAvisoAsignacion('');

			let estadoId = idEstado;
			if (!estadoId) {
				const response = await guardiaService.setEstadoGuardia({
					idEstado: null,
					enServicio: true,
					idUsuario: idUsuarioGuardia
				});
				estadoId = response?.id || null;
				if (estadoId) {
					setIdEstado(estadoId);
					setEnServicio(true);
				}
			}

			if (!estadoId) {
				setAvisoAsignacion('No se pudo obtener el estado del guardia. Intenta de nuevo.');
				return;
			}

			await guardiaService.asignarAlerta({ idIncidente: alertaSeleccionada.id, idEstadoGuardia: estadoId });
			setAvisoAsignacion(`Alerta ${alertaSeleccionada.id} asignada correctamente.`);
			setTimeout(() => setAvisoAsignacion(''), 5000);
		} catch (e) {
			setAvisoAsignacion(e?.response?.data?.message || 'Error al asignar la alerta.');
		} finally {
			setAsignando(null);
		}
	};

	const volverAlertas = () => {
		navigate('/guardia', { state: { from: 'mapa' } });
	};

	const fromAlertas = location.state?.from === 'alertas';
	const alertaAsignada = Boolean(
		String(alertaSeleccionada?.idGuardiaAsignado || '').trim().toUpperCase() === String(idUsuarioGuardia || '').trim().toUpperCase()
	);

	return (
		<div className={`dg-shell dg-shell--map-active dg-screen-enter ${fromAlertas ? 'dg-screen-enter--from-right' : 'dg-screen-enter--from-left'}`}>
			<main className="dg-main">
				<div className="dg-main__header">
					<header className="dg-main__header-row">
						<div className="dg-main__header-left">
							<button onClick={volverAlertas} className="dg-main__show-sidebar">
								Panel de Alertas
							</button>
							<h1 className="dg-main__title">Mapa de Alerta</h1>
						</div>
						<div className="dg-main__header-right">
							<div className="dg-main__service-toggle">
								<label className="dg-main__service-option">
									<input
										type="radio"
										name="estadoServicioMapa"
										value="en"
										checked={enServicio}
										onChange={() => onCambiarServicio(true)}
										disabled={guardandoEstado}
									/>
									{guardandoEstado && enServicio ? 'Guardando...' : 'En Servicio'}
								</label>
								<label className="dg-main__service-option">
									<input
										type="radio"
										name="estadoServicioMapa"
										value="no"
										checked={!enServicio}
										onChange={() => onCambiarServicio(false)}
										disabled={guardandoEstado}
									/>
									{guardandoEstado && !enServicio ? 'Guardando...' : 'No en Servicio'}
								</label>
							</div>
							<button onClick={logout} className="dg-main__logout">Salir</button>
						</div>
					</header>
					{avisoEstado && (
						<div className={`dg-main__estado ${avisoEstado.toLowerCase().startsWith('error') ? 'dg-main__estado--error' : 'dg-main__estado--ok'}`}>
							{avisoEstado}
						</div>
					)}
				</div>

				{avisoTiempoReal && <div className="dg-main__tiempo-real">{avisoTiempoReal}</div>}

				<div className="dg-map-shell">
					{loadingAlertas && (
						<div className="dg-map-placeholder">
							<h3>Cargando alerta seleccionada...</h3>
						</div>
					)}

					{!loadingAlertas && !alertaSeleccionada && (
						<div className="dg-map-placeholder">
							<h3>No se pudo abrir el mapa de esta alerta</h3>
							<p>{errorAlertas || 'Seleccione otra alerta desde el panel principal.'}</p>
							<button className="dg-map-btn dg-map-btn--back" onClick={volverAlertas}>
								Volver al Panel de Alertas
							</button>
						</div>
					)}

					{!loadingAlertas && alertaSeleccionada && (
						<div className="dg-map-view">
							<div className="dg-map-actions">
								<div className="dg-map-actions__info">
									<span className="dg-map-actions__id">{alertaSeleccionada.id}</span>
									<span>{alertaSeleccionada.motivo || 'Sin motivo'}</span>
								</div>
								<div className="dg-map-actions__buttons">
									<button onClick={volverAlertas} className="dg-map-btn dg-map-btn--back">
										Volver a alertas
									</button>
									<button type="button" disabled className="dg-map-btn dg-map-btn--assign">
										{alertaAsignada ? 'Asignado' : 'No Asignado'}
									</button>
									<Link
										to={alertaAsignada ? `/guardia/cerrar/${alertaSeleccionada.id}` : '#'}
										className="dg-map-btn-link"
										onClick={(e) => {
											if (!alertaAsignada) e.preventDefault();
										}}
										aria-disabled={!alertaAsignada}
									>
										<button className="dg-map-btn dg-map-btn--close">Cerrar</button>
									</Link>
								</div>
							</div>

							{avisoAsignacion && (
								<div className={`dg-sidebar__notice ${avisoAsignacion.includes('correctamente') ? 'dg-sidebar__notice--ok' : 'dg-sidebar__notice--error'}`} style={{ margin: '0.7rem 0.9rem 0' }}>
									{avisoAsignacion}
								</div>
							)}

							<div className="dg-map-canvas">
								<MapaCampus
									alertas={alertas}
									zonasApi={zonasApi}
									height="100%"
									alertaFoco={alertaSeleccionada}
								/>
							</div>
						</div>
					)}
				</div>
			</main>
		</div>
	);
};

export default MapaGuardia;
