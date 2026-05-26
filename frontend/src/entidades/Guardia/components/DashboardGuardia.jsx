import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import guardiaService from '../services/guardiaService';
import AlertasUsuario from './AlertasUsuario';
import ContactosConfianza from './ContactosConfianza';

const DashboardGuardia = () => {
	const { user, logout } = useAuth();
	const [alertas, setAlertas] = useState([]);
	const [loadingAlertas, setLoadingAlertas] = useState(true);
	const [errorAlertas, setErrorAlertas] = useState('');
	const [avisoTiempoReal, setAvisoTiempoReal] = useState('');
	const [sidebarAbierto, setSidebarAbierto] = useState(true);
	const [menuAbierto, setMenuAbierto] = useState(false);
	const [seccionActiva, setSeccionActiva] = useState('alertas'); // 'alertas' | 'contactos'
	const menuRef = useRef(null);

	const [idEstado, setIdEstado] = useState(null);
	const [enServicio, setEnServicio] = useState(false);
	const [guardandoEstado, setGuardandoEstado] = useState(false);
	const [asignando, setAsignando] = useState(null); // id del incidente que se está asignando
	const [avisoAsignacion, setAvisoAsignacion] = useState('');
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
			const message = error?.response?.data?.message || 'No se pudo cargar alertas activas';
			setErrorAlertas(message);
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
				setEnServicio(valor.includes('en servicio') || valor === 'check');
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

	// Cerrar menú desplegable al hacer click fuera
	useEffect(() => {
		const handler = (e) => {
			if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false);
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, []);

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
			setAvisoEstado(`✓ Estado guardado: ${etiqueta}`);
			setTimeout(() => setAvisoEstado(''), 4000);
		} catch (e) {
			const msg = e?.response?.data?.message || e?.message || 'Error al guardar el estado';
			setAvisoEstado(`✗ ${msg}`);
		} finally {
			setGuardandoEstado(false);
		}
	};

	const onAsignar = async (idIncidente) => {
		if (!idUsuarioGuardia || asignando) return;

		try {
			setAsignando(idIncidente);
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

			await guardiaService.asignarAlerta({ idIncidente, idEstadoGuardia: estadoId });
			setAvisoAsignacion(`Alerta ${idIncidente} asignada correctamente.`);
			setTimeout(() => setAvisoAsignacion(''), 5000);
		} catch (e) {
			setAvisoAsignacion(e?.response?.data?.message || 'Error al asignar la alerta.');
		} finally {
			setAsignando(null);
		}
	};

	const resumen = useMemo(
		() => {
			return { activas: alertas.length, lista: alertas };
		},
		[alertas]
	);

	return (
		<div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
			{/* SIDEBAR IZQUIERDO - ALERTAS */}
			<aside
				style={{
					width: sidebarAbierto ? '380px' : '0',
					background: '#fff',
					borderRight: '1px solid #ddd',
					overflow: 'hidden',
					transition: 'width 0.3s ease',
					display: 'flex',
					flexDirection: 'column'
				}}
			>
				<div
					style={{
						padding: '1.2rem',
						borderBottom: '1px solid #ddd',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center'
					}}
				>
						<div>
							<h2 style={{ margin: 0, fontSize: '1.1rem', color: '#21335b' }}>
								Alertas de Usuarios
							</h2>
						</div>
					<button
						onClick={() => setSidebarAbierto(false)}
						style={{
							background: 'none',
							border: 'none',
							fontSize: '1.5rem',
							cursor: 'pointer',
							color: '#666',
							padding: 0,
							width: '32px',
							height: '32px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						×
					</button>
				</div>

				<div style={{ padding: '1rem', overflow: 'auto', flex: 1 }}>
					{loadingAlertas && <p style={{ textAlign: 'center', color: '#999' }}>Cargando...</p>}
					{errorAlertas && <p style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{errorAlertas}</p>}
					{avisoAsignacion && (
						<p style={{ color: avisoAsignacion.includes('correctamente') ? '#059669' : '#b91c1c', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem' }}>
							{avisoAsignacion}
						</p>
					)}

					{!loadingAlertas && resumen.activas === 0 && (
						<p style={{ textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
							No hay alertas activas
						</p>
					)}

					{resumen.lista.map((alerta) => (
						<div
							key={alerta.id}
							style={{
								border: '1px solid #e0e0e0',
								borderRadius: '8px',
								padding: '0.9rem',
								marginBottom: '0.75rem',
								background: '#fafafa'
							}}
							onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
							onMouseLeave={(e) => (e.currentTarget.style.background = '#fafafa')}
						>
							<h4 style={{ margin: '0 0 0.5rem 0', color: '#21335b', fontSize: '0.95rem' }}>
								{alerta.id}
							</h4>
							<p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#555' }}>
								<strong>Motivo:</strong> {alerta.motivo}
							</p>
							<p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#555' }}>
								<strong>Reportó:</strong> {alerta.emailUsuario || alerta.idUsuario || 'Sin dato'}
							</p>
							<button
								onClick={() => onAsignar(alerta.id)}
								disabled={asignando === alerta.id}
								style={{
									width: '100%',
									marginTop: '0.6rem',
									padding: '0.45rem',
									background: asignando === alerta.id ? '#9ca3af' : '#059669',
									color: '#fff',
									border: 'none',
									borderRadius: '6px',
									cursor: asignando === alerta.id ? 'not-allowed' : 'pointer',
									fontSize: '0.85rem',
									fontWeight: '600'
								}}
							>
								{asignando === alerta.id ? 'Asignando...' : 'Asignarlo'}
							</button>
							<Link to={`/guardia/cerrar/${alerta.id}`} style={{ textDecoration: 'none' }}>
								<button
									style={{
										width: '100%',
										marginTop: '0.4rem',
										padding: '0.45rem',
										background: '#21335b',
										color: '#fff',
										border: 'none',
										borderRadius: '6px',
										cursor: 'pointer',
										fontSize: '0.85rem',
										fontWeight: '600'
									}}
								>
									Cerrar
								</button>
							</Link>
						</div>
					))}
				</div>

				<div style={{ padding: '1rem', borderTop: '1px solid #ddd', textAlign: 'center', fontSize: '0.85rem', color: '#999' }}>
						<div style={{ fontWeight: 'bold', color: '#21335b', marginBottom: '0.3rem' }}>
							Incidentes activos en BD: {resumen.activas}
						</div>
				</div>
			</aside>

			{/* CONTENIDO PRINCIPAL */}
			<main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
				{/* HEADER CON CONTROLES */}
				<div style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 100 }}>
					<header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
							{!sidebarAbierto && (
								<button
									onClick={() => setSidebarAbierto(true)}
									style={{
										background: '#21335b',
										color: '#fff',
										border: 'none',
										borderRadius: '6px',
										padding: '0.6rem 1rem',
										cursor: 'pointer',
										fontWeight: '600',
										fontSize: '0.9rem'
									}}
								>
									Incidentes Activos
								</button>
							)}
							<h1 style={{ margin: 0, fontSize: '1.3rem' }}>Panel de Guardia</h1>
						</div>
						<div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
							{/* Menú desplegable */}
							<div ref={menuRef} style={{ position: 'relative' }}>
								<button
									onClick={() => setMenuAbierto(v => !v)}
									style={{
										padding: '0.5rem 1rem',
										background: menuAbierto ? '#21335b' : '#f1f5f9',
										color: menuAbierto ? '#fff' : '#21335b',
										border: '1px solid #21335b',
										borderRadius: '6px',
										cursor: 'pointer',
										fontWeight: '600',
										fontSize: '0.88rem',
										display: 'flex',
										alignItems: 'center',
										gap: '0.4rem'
									}}
								>
									☰ Menú {menuAbierto ? '▲' : '▼'}
								</button>
								{menuAbierto && (
									<div style={{
										position: 'absolute',
										top: 'calc(100% + 6px)',
										right: 0,
										background: '#fff',
										border: '1px solid #e2e8f0',
										borderRadius: '8px',
										boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
										minWidth: '200px',
										zIndex: 200,
										overflow: 'hidden'
									}}>
										{[
											{ id: 'alertas', icono: '🔔', label: 'Alertas Activas' },
											{ id: 'contactos', icono: '👥', label: 'Contactos de Confianza' }
										].map(op => (
											<button
												key={op.id}
												onClick={() => { setSeccionActiva(op.id); setMenuAbierto(false); }}
												style={{
													display: 'flex',
													alignItems: 'center',
													gap: '0.6rem',
													width: '100%',
													padding: '0.7rem 1rem',
													border: 'none',
													background: seccionActiva === op.id ? '#eff6ff' : '#fff',
													color: seccionActiva === op.id ? '#1d4ed8' : '#374151',
													fontWeight: seccionActiva === op.id ? '700' : '400',
													cursor: 'pointer',
													fontSize: '0.9rem',
													textAlign: 'left',
													borderBottom: '1px solid #f1f5f9'
												}}
											>
												{op.icono} {op.label}
											</button>
										))}
									</div>
								)}
							</div>
							<div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
								<label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
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
								<label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
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
							<button onClick={logout} style={{ padding: '0.6rem 1rem', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
								Salir
							</button>
						</div>
					</header>
					{avisoEstado && (
						<div style={{
							marginTop: '0.5rem',
							fontSize: '0.82rem',
							fontWeight: 600,
							color: avisoEstado.startsWith('✓') ? '#059669' : '#b91c1c'
						}}>
							{avisoEstado}
						</div>
					)}
				</div>

				{/* NOTIFICACIÓN EN TIEMPO REAL */}
				{avisoTiempoReal && (
					<div
						style={{
							padding: '0.8rem 1.5rem',
							borderBottom: '2px solid #fde68a',
							background: '#fffbeb',
							color: '#92400e',
							fontWeight: 700,
							fontSize: '0.95rem'
						}}
					>
						{avisoTiempoReal}
					</div>
				)}

				{/* ALERTAS USUARIO COMPONENT */}
				<div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
					{seccionActiva === 'alertas' && <AlertasUsuario />}
					{seccionActiva === 'contactos' && <ContactosConfianza />}
				</div>
			</main>
		</div>
	);
};

export default DashboardGuardia;
