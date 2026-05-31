import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import guardiaService from '../services/guardiaService';
import '../styles/DashboardGuardia.css';

const esAsignadaAlGuardia = (alerta, idGuardia) => {
	if (!alerta || !idGuardia) return false;
	return String(alerta.idGuardiaAsignado || '').trim().toUpperCase() === String(idGuardia).trim().toUpperCase();
};

const DashboardGuardia = () => {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [alertas, setAlertas] = useState([]);
	const [loadingAlertas, setLoadingAlertas] = useState(true);
	const [errorAlertas, setErrorAlertas] = useState('');
	const [avisoTiempoReal, setAvisoTiempoReal] = useState('');

	const [idEstado, setIdEstado] = useState(null);
	const [enServicio, setEnServicio] = useState(false);
	const [guardandoEstado, setGuardandoEstado] = useState(false);
	const [avisoEstado, setAvisoEstado] = useState('');

	const idUsuarioGuardia = user?.id;

	const cargarAlertas = async () => {
		if (!idUsuarioGuardia) return;

		try {
			setLoadingAlertas(true);
			setErrorAlertas('');
			const data = await guardiaService.getIncidentesActivos();
			setAlertas(Array.isArray(data) ? data : []);
		} catch (error) {
			const message = String(error?.response?.data?.message || '').trim();
			if (message.toLowerCase().includes('no hay alerta')) {
				setAlertas([]);
				setErrorAlertas('');
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
			// Si falla, mantenemos estado local en false y permitimos reintento al guardar.
		}
	};

	useEffect(() => {
		cargarEstadoGuardia();
		cargarAlertas();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [idUsuarioGuardia]);

	useEffect(() => {
		if (!user?.token) return undefined;

		let timerId;

		const socket = guardiaService.connectGuardiaSocket({
			onIncidenteChange: (eventName, payload) => {
				if (eventName === 'incidente:creado') {
					setAvisoTiempoReal(
						`Nueva alerta en vivo: ${payload?.id || 'SIN-ID'} - ${payload?.motivo || 'Sin motivo'}`
					);
				} else if (eventName === 'incidente:actualizado') {
					setAvisoTiempoReal(
						`Alerta actualizada: ${payload?.id || 'SIN-ID'} - Estado ${payload?.estado || 'sin cambio'}`
					);
				} else if (eventName === 'incidente:cerrado') {
					setAvisoTiempoReal(`Alerta cerrada: ${payload?.id || 'SIN-ID'}`);
				}

				window.clearTimeout(timerId);
				timerId = window.setTimeout(() => {
					setAvisoTiempoReal('');
				}, 6000);

				cargarAlertas();
			},
			onError: () => {
				// El panel sigue funcionando por API aunque falle el socket.
			}
		});

		return () => {
			window.clearTimeout(timerId);
			socket.disconnect();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.token, idUsuarioGuardia]);

	useEffect(() => {
		if (!idUsuarioGuardia) return undefined;

		const intervalId = window.setInterval(() => {
			cargarAlertas();
		}, 15000);

		return () => {
			window.clearInterval(intervalId);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [idUsuarioGuardia]);

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
			if (!idEstado && response?.id) {
				setIdEstado(response.id);
			}
			const etiqueta = nuevoValor ? 'En Servicio' : 'No en Servicio';
			setAvisoEstado(`Estado guardado: ${etiqueta}`);
			setTimeout(() => setAvisoEstado(''), 4000);
		} catch (e) {
			const msg = e?.response?.data?.message || e?.message || 'Error al guardar el estado';
			setAvisoEstado(msg);
		} finally {
			setGuardandoEstado(false);
		}
	};

	const resumen = useMemo(
		() => {
			return { activas: alertas.length, lista: alertas };
		},
		[alertas]
	);

	const seleccionarAlerta = (idAlerta) => {
		navigate(`/guardia/mapa/${idAlerta}`, { state: { from: 'alertas' } });
	};

	const fromMapa = location.state?.from === 'mapa';

	return (
		<div className={`dg-shell dg-screen-enter ${fromMapa ? 'dg-screen-enter--from-left' : 'dg-screen-enter--from-right'}`}>
			<section className="dg-unified-card">
				<header className="dg-unified-card__header">
					<div>
						<h1 className="dg-main__title">Panel de Guardia · Alertas de Usuario</h1>
						<p className="dg-alertas-main-panel__desc">
							Seleccione una alerta para abrir el mapa. Todo se gestiona desde este mismo contenedor.
						</p>
					</div>
					<div className="dg-main__header-right">
						<div className="dg-main__service-toggle">
							<label className="dg-main__service-option">
								<input
									type="radio"
									name="estadoServicio"
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
									name="estadoServicio"
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

				{avisoTiempoReal && (
					<div className="dg-main__tiempo-real">
						{avisoTiempoReal}
					</div>
				)}

				<div className="dg-unified-card__body">
					<p className="dg-alertas-main-panel__count">
						Alertas activas: <strong>{resumen.activas}</strong>
					</p>

					{loadingAlertas && <p className="dg-sidebar__empty">Cargando alertas...</p>}
					{errorAlertas && <p className="dg-sidebar__error">{errorAlertas}</p>}

					{!loadingAlertas && resumen.activas === 0 && (
						<p className="dg-sidebar__empty">No hay alertas activas</p>
					)}

					<div className="dg-unified-card__list">
						{resumen.lista.map((alerta) => (
							<div
								key={alerta.id}
								className="dg-alerta-card"
								onClick={() => seleccionarAlerta(alerta.id)}
								title="Seleccionar alerta para ir al mapa"
								style={{ position: 'relative' }}
							>
								{esAsignadaAlGuardia(alerta, idUsuarioGuardia) && (
									<span style={{
										position: 'absolute',
										top: '0.85rem',
										right: '0.85rem',
										padding: '0.25rem 0.6rem',
										borderRadius: '999px',
										background: '#16a34a',
										color: '#fff',
										fontSize: '0.75rem',
										fontWeight: 700,
										textTransform: 'uppercase',
										letterSpacing: '0.04em'
									}}>
										Asignado
									</span>
								)}
								<h4 className="dg-alerta-card__id">{alerta.id}</h4>
								<p className="dg-alerta-card__linea">
									<strong>Motivo:</strong> {alerta.motivo}
								</p>
								<p className="dg-alerta-card__linea">
									<strong>Reportó:</strong> {alerta.emailUsuario || alerta.idUsuario || 'Sin dato'}
								</p>
								<p className="dg-alerta-card__hint">Seleccione para abrir mapa</p>
							</div>
						))}
					</div>
				</div>

				<footer className="dg-sidebar__foot">
					<div className="dg-sidebar__foot-count">Incidentes activos en BD: {resumen.activas}</div>
				</footer>
			</section>
		</div>
	);
};

export default DashboardGuardia;
