import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import MapaCampus from '../../Guardia/components/MapaCampus';
import guardiaService from '../../Guardia/services/guardiaService';
import alertaService from '../../Guardia/services/alertaService';
import '../styles/DashboardAdmin.css';

const DashboardAdmin = () => {
	const [alertasActivas, setAlertasActivas] = useState([]);
	const [zonasApi, setZonasApi] = useState([]);

	const cargarAlertas = async () => {
		try {
			const data = await guardiaService.getIncidentesActivos();
			setAlertasActivas(Array.isArray(data) ? data : []);
		} catch {
			// El mapa sigue visible aunque falle la carga de alertas
		}
	};

	useEffect(() => {
		cargarAlertas();
		alertaService.getZonas()
			.then(data => setZonasApi(Array.isArray(data) ? data : []))
			.catch(() => {});
	}, []);

	useEffect(() => {
		const socket = io('http://localhost:4000', {
			transports: ['websocket']
		});

		socket.on('incidente:creado', (payload) => {
			if (!payload) return;
			setAlertasActivas(prev => {
				const existe = prev.some(a => a.id === payload.id);
				return existe ? prev : [...prev, payload];
			});
		});

		socket.on('incidente:cerrado', (payload) => {
			if (!payload) return;
			setAlertasActivas(prev => prev.filter(a => a.id !== payload.id));
		});

		socket.on('incidente:actualizado', () => {
			cargarAlertas();
		});

		return () => socket.disconnect();
	}, []);

	return (
		<section className="dashboard-admin">
			<h1 className="dashboard-admin__title">Panel del Administrador</h1>
			<p className="dashboard-admin__text">Monitoreo en tiempo real del campus – Universidad Técnica de Ambato</p>

			{/* MAPA INTERACTIVO CON ALERTAS EN TIEMPO REAL */}
			<div
				style={{
					marginTop: '1.5rem',
					background: '#fff',
					border: '1px solid #d8deea',
					borderRadius: '14px',
					padding: '1.2rem',
					boxShadow: '0 4px 16px rgba(33,51,91,0.08)'
				}}
			>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
					<div>
						<h2 style={{ margin: 0, color: '#21335b', fontSize: '1.1rem' }}>
							🗺 Mapa del Campus – Alertas en Tiempo Real
						</h2>
						<p style={{ margin: '0.3rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
							Campus Huachi, Ambato · 4 zonas monitoreadas
						</p>
					</div>
					{alertasActivas.length > 0 && (
						<span
							style={{
								background: '#dc2626',
								color: '#fff',
								padding: '0.4rem 1rem',
								borderRadius: '20px',
								fontWeight: 700,
								fontSize: '0.9rem'
							}}
						>
							{alertasActivas.length} Alerta{alertasActivas.length !== 1 ? 's' : ''} Activa{alertasActivas.length !== 1 ? 's' : ''}
						</span>
					)}
				</div>

				<div style={{ height: '460px' }}>
					<MapaCampus alertas={alertasActivas} zonasApi={zonasApi} height="100%" />
				</div>
			</div>

			{/* RESUMEN DE ALERTAS ACTIVAS */}
			{alertasActivas.length > 0 && (
				<div
					style={{
						marginTop: '1.5rem',
						background: '#fff',
						border: '1px solid #d8deea',
						borderRadius: '14px',
						padding: '1.2rem',
						boxShadow: '0 4px 16px rgba(33,51,91,0.08)'
					}}
				>
					<h2 style={{ margin: '0 0 1rem', color: '#21335b', fontSize: '1.1rem' }}>
						Incidentes Activos ({alertasActivas.length})
					</h2>
					<div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
						{alertasActivas.map(alerta => (
							<div
								key={alerta.id}
								style={{
									padding: '1rem',
									border: '2px solid #fbbf24',
									borderRadius: '8px',
									background: '#fffbeb'
								}}
							>
								<p style={{ margin: '0 0 0.3rem', fontWeight: 700, color: '#92400e', fontSize: '0.85rem' }}>
									ID: {alerta.id}
								</p>
								<p style={{ margin: '0.2rem 0', color: '#21335b', fontSize: '0.9rem' }}>
									<strong>Motivo:</strong> {alerta.motivo}
								</p>
								{alerta.nombreZona && (
									<p style={{ margin: '0.2rem 0', color: '#4b5563', fontSize: '0.85rem' }}>
										<strong>Zona:</strong> {alerta.nombreZona}
									</p>
								)}
								{alerta.emailUsuario && (
									<p style={{ margin: '0.2rem 0', color: '#4b5563', fontSize: '0.82rem' }}>
										<strong>Usuario:</strong> {alerta.emailUsuario}
									</p>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</section>
	);
};

export default DashboardAdmin;