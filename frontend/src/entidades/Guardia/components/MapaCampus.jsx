import { useState, useCallback } from 'react';
import { GoogleMap, useLoadScript, Polygon, Marker, InfoWindow } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Centro del campus Huachi UTA – Ambato, Ecuador.
// Coordenadas verificadas con OpenStreetMap + interpolación entre segmentos de Av. Los Atis:
//   N: Río Guayllabamba lat -1.2665 (borde sur del río, bbox -1.2665 a -1.2663)
//   S: Río Payamino     lat -1.2707
//   W: Av. Los Chasquis lng -78.6264 (N) a -78.6250 (S, diagonal)
//   E: Av. Los Atis     lng -78.6218 (interpolado entre seg. norte -78.6228 en lat -1.2644
//                        y seg. Barrio Solis -78.6207 en lat -1.2710)
const UTA_CENTER = { lat: -1.2686, lng: -78.6240 };
const MAP_ZOOM = 16;

const MAP_CONTAINER_STYLE = {
	width: '100%',
	height: '100%',
	borderRadius: '10px'
};

// 4 zonas del campus Huachi UTA – coordenadas verificadas con OpenStreetMap.
// Límites reales:
//   Norte: Río Guayllabamba (lat -1.2665)
//   Sur:   Río Payamino    (lat -1.2707)
//   Oeste: Av. Los Chasquis (lng -78.6264 norte → -78.6250 sur, diagonal)
//   Este:  Av. Los Atis    (lng -78.6218)
// División vertical: lng -78.6240 | División horizontal: lat -1.2686
export const ZONAS_CAMPUS = [
	{
		// NE – FISEI / área superior derecha
		// Límites: Río Guayllabamba (N), Av. Los Atis (E)
		id: 'Z1',
		nombre: 'Zona 1 – Noreste',
		color: '#4A90E2',
		paths: [
			{ lat: -1.2665, lng: -78.6240 },
			{ lat: -1.2665, lng: -78.6218 },
			{ lat: -1.2686, lng: -78.6218 },
			{ lat: -1.2686, lng: -78.6240 },
		],
		center: { lat: -1.2675, lng: -78.6229 }
	},
	{
		// NW – Fac. Ciencias Administrativas – área superior izquierda
		// Límites: Río Guayllabamba (N), Av. Los Chasquis diagonal (W)
		id: 'Z2',
		nombre: 'Zona 2 – Noroeste',
		color: '#9B59B6',
		paths: [
			{ lat: -1.2665, lng: -78.6264 },
			{ lat: -1.2665, lng: -78.6240 },
			{ lat: -1.2686, lng: -78.6240 },
			{ lat: -1.2686, lng: -78.6257 },
			// ↑ el lado izquierdo cierra en diagonal siguiendo Av. Los Chasquis
		],
		center: { lat: -1.2675, lng: -78.6252 }
	},
	{
		// SE – Fac. Contabilidad / Complejo Acuático – área inferior derecha
		// Límites: Río Payamino (S), Av. Los Atis (E)
		id: 'Z3',
		nombre: 'Zona 3 – Sureste',
		color: '#27AE60',
		paths: [
			{ lat: -1.2686, lng: -78.6240 },
			{ lat: -1.2686, lng: -78.6218 },
			{ lat: -1.2707, lng: -78.6218 },
			{ lat: -1.2707, lng: -78.6240 },
		],
		center: { lat: -1.2696, lng: -78.6229 }
	},
	{
		// SW – UTA edificio central / área inferior izquierda
		// Límites: Río Payamino (S), Av. Los Chasquis diagonal (W)
		id: 'Z4',
		nombre: 'Zona 4 – Suroeste',
		color: '#E67E22',
		paths: [
			{ lat: -1.2686, lng: -78.6257 },
			{ lat: -1.2686, lng: -78.6240 },
			{ lat: -1.2707, lng: -78.6240 },
			{ lat: -1.2707, lng: -78.6250 },
			// ↑ el lado izquierdo cierra en diagonal siguiendo Av. Los Chasquis
		],
		center: { lat: -1.2696, lng: -78.6250 }
	}
];

/**
 * Determina la posición del marcador de una alerta.
 * Usa coordX/coordY de la API si están disponibles; si no, usa el centro
 * de la zona del campus que corresponde al índice de idZona.
 */
const getPosicionAlerta = (alerta, zonasApi = []) => {
	if (!alerta) return UTA_CENTER;

	const zonaApi = zonasApi.find(z => String(z.id) === String(alerta.idZona));
	if (zonaApi?.coordX && zonaApi?.coordY && Number(zonaApi.coordX) !== 0) {
		return { lat: Number(zonaApi.coordX), lng: Number(zonaApi.coordY) };
	}

	// Fallback: mapear idZona (1-based) a los cuadrantes del campus
	const idx = (Math.max(1, Number(alerta.idZona) || 1) - 1) % ZONAS_CAMPUS.length;
	return ZONAS_CAMPUS[idx].center;
};

const MapaCampus = ({ alertas = [], zonasApi = [], height = '380px' }) => {
	const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);

	const { isLoaded, loadError } = useLoadScript({
		googleMapsApiKey: GOOGLE_MAPS_API_KEY
	});

	const onMapLoad = useCallback(() => {}, []);

	if (loadError) {
		return (
			<div
				style={{
					width: '100%',
					height,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					background: '#fee2e2',
					borderRadius: '10px',
					border: '1px solid #fca5a5'
				}}
			>
				<p style={{ color: '#b91c1c', fontWeight: 600, textAlign: 'center', padding: '1rem' }}>
					⚠ Error al cargar el mapa. Verifica tu conexión a internet.
				</p>
			</div>
		);
	}

	if (!isLoaded) {
		return (
			<div
				style={{
					width: '100%',
					height,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					background: '#f4f6fa',
					borderRadius: '10px',
					border: '1px solid #d8deea'
				}}
			>
				<p style={{ color: '#666' }}>Cargando mapa del campus UTA...</p>
			</div>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', height }}>
			{/* Leyenda de zonas */}
			<div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
				{ZONAS_CAMPUS.map(zona => (
					<div
						key={zona.id}
						style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#2f3b54' }}
					>
						<span
							style={{
								width: 14,
								height: 14,
								background: zona.color,
								borderRadius: 3,
								opacity: 0.75,
								display: 'inline-block',
								border: `2px solid ${zona.color}`
							}}
						/>
						{zona.nombre}
					</div>
				))}
				{alertas.length > 0 && (
					<div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#dc2626' }}>
						📍 {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} activa{alertas.length !== 1 ? 's' : ''}
					</div>
				)}
			</div>

			{/* Mapa */}
			<div style={{ width: '100%', flex: 1, borderRadius: '10px', overflow: 'hidden', border: '1px solid #d8deea' }}>
				<GoogleMap
					mapContainerStyle={MAP_CONTAINER_STYLE}
					center={UTA_CENTER}
					zoom={MAP_ZOOM}
					onLoad={onMapLoad}
					options={{
						mapTypeId: 'roadmap',
						mapTypeControl: true,
						mapTypeControlOptions: {
							mapTypeIds: ['roadmap', 'satellite', 'hybrid']
						},
						streetViewControl: false,
						fullscreenControl: true,
						zoomControl: true
					}}
				>
					{/* Polígonos de las 4 zonas del campus Huachi */}
					{ZONAS_CAMPUS.map(zona => (
						<Polygon
							key={zona.id}
							paths={zona.paths}
							options={{
								strokeColor: zona.color,
								strokeOpacity: 1,
								strokeWeight: 2,
								fillColor: zona.color,
								fillOpacity: 0.22
							}}
						/>
					))}

					{/* Marcadores de alertas activas en tiempo real */}
					{alertas.map(alerta => {
						const pos = getPosicionAlerta(alerta, zonasApi);
						return (
							<Marker
								key={alerta.id}
								position={pos}
								onClick={() => setAlertaSeleccionada(alerta)}
								label={{
									text: '⚠',
									fontSize: '18px'
								}}
								title={`Alerta ${alerta.id} – ${alerta.motivo}`}
							/>
						);
					})}

					{/* InfoWindow al hacer clic en un marcador */}
					{alertaSeleccionada && (
						<InfoWindow
							position={getPosicionAlerta(alertaSeleccionada, zonasApi)}
							onCloseClick={() => setAlertaSeleccionada(null)}
						>
							<div style={{ minWidth: 180, fontFamily: 'sans-serif', fontSize: '0.85rem' }}>
								<p style={{ margin: '0 0 0.3rem', color: '#dc2626', fontWeight: 700 }}>⚠ Alerta Activa</p>
								<p style={{ margin: '0.2rem 0' }}><strong>ID:</strong> {alertaSeleccionada.id}</p>
								<p style={{ margin: '0.2rem 0' }}><strong>Motivo:</strong> {alertaSeleccionada.motivo}</p>
								{alertaSeleccionada.nombreZona && (
									<p style={{ margin: '0.2rem 0' }}><strong>Zona:</strong> {alertaSeleccionada.nombreZona}</p>
								)}
								{alertaSeleccionada.emailUsuario && (
									<p style={{ margin: '0.2rem 0' }}><strong>Usuario:</strong> {alertaSeleccionada.emailUsuario}</p>
								)}
								<p style={{ margin: '0.3rem 0 0', color: '#dc2626', fontWeight: 600 }}>
									Estado: {alertaSeleccionada.estado || 'Activo'}
								</p>
							</div>
						</InfoWindow>
					)}
				</GoogleMap>
			</div>
		</div>
	);
};

export default MapaCampus;
