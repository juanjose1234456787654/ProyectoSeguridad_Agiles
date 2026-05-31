import { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleMap, useLoadScript, Polygon, Marker, InfoWindow } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Centro de referencia tomado de la ficha OSM de la imagen compartida.
const UTA_CENTER = { lat: -1.2687, lng: -78.62434 };
const MAP_ZOOM = 17;

const MAP_CONTAINER_STYLE = {
	width: '100%',
	height: '100%',
	borderRadius: '10px'
};

// Contorno real de la parcela UTA (OpenStreetMap way 341833423).
const PARCELA_UTA_PATH = [
	{ lat: -1.2703839, lng: -78.6263824 },
	{ lat: -1.2709772, lng: -78.6223047 },
	{ lat: -1.2702042, lng: -78.6224417 },
	{ lat: -1.2700231, lng: -78.6238953 },
	{ lat: -1.2699127, lng: -78.6238908 },
	{ lat: -1.2698353, lng: -78.6236258 },
	{ lat: -1.2695738, lng: -78.6233711 },
	{ lat: -1.2691266, lng: -78.6232902 },
	{ lat: -1.2686305, lng: -78.6232714 },
	{ lat: -1.2670878, lng: -78.62332 },
	{ lat: -1.2665622, lng: -78.6232027 },
	{ lat: -1.2664762, lng: -78.6244767 },
	{ lat: -1.2664563, lng: -78.6247703 },
	{ lat: -1.2664505, lng: -78.6248568 },
	{ lat: -1.2664358, lng: -78.6250734 },
	{ lat: -1.2664169, lng: -78.6253537 },
	{ lat: -1.2687472, lng: -78.625958 },
];

// Límites (bbox) derivados del contorno OSM para dividir en 4 zonas operativas.
const LAT_N = -1.2664169;
const LAT_S = -1.2709772;
const LNG_W = -78.6263824;
const LNG_E = -78.6223047;
const LAT_M = (LAT_N + LAT_S) / 2;
const LNG_M = (LNG_W + LNG_E) / 2;

const EPS = 1e-10;

const almostEqual = (a, b) => Math.abs(a - b) < EPS;

const samePoint = (a, b) => almostEqual(a.lat, b.lat) && almostEqual(a.lng, b.lng);

const sanitizePolygon = (points) => {
	if (!Array.isArray(points) || points.length === 0) return [];
	const clean = [];
	for (const p of points) {
		if (!clean.length || !samePoint(clean[clean.length - 1], p)) {
			clean.push(p);
		}
	}
	if (clean.length > 1 && samePoint(clean[0], clean[clean.length - 1])) {
		clean.pop();
	}
	return clean;
};

const clipPolygonByAxis = (points, axis, value, keepGreater) => {
	if (!points.length) return [];

	const isInside = (p) => keepGreater ? p[axis] >= value - EPS : p[axis] <= value + EPS;

	const intersect = (a, b) => {
		const denom = b[axis] - a[axis];
		if (Math.abs(denom) < EPS) return { ...b };
		const t = (value - a[axis]) / denom;
		return {
			lat: a.lat + (b.lat - a.lat) * t,
			lng: a.lng + (b.lng - a.lng) * t
		};
	};

	const output = [];
	let prev = points[points.length - 1];
	let prevInside = isInside(prev);

	for (const curr of points) {
		const currInside = isInside(curr);

		if (currInside) {
			if (!prevInside) output.push(intersect(prev, curr));
			output.push(curr);
		} else if (prevInside) {
			output.push(intersect(prev, curr));
		}

		prev = curr;
		prevInside = currInside;
	}

	return sanitizePolygon(output);
};

const clipPolygonToRect = (points, rect) => {
	let clipped = sanitizePolygon(points);
	clipped = clipPolygonByAxis(clipped, 'lng', rect.minLng, true);
	clipped = clipPolygonByAxis(clipped, 'lng', rect.maxLng, false);
	clipped = clipPolygonByAxis(clipped, 'lat', rect.minLat, true);
	clipped = clipPolygonByAxis(clipped, 'lat', rect.maxLat, false);
	return sanitizePolygon(clipped);
};

const getPolygonCenter = (points) => {
	if (!points.length) return UTA_CENTER;
	const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
	return {
		lat: sum.lat / points.length,
		lng: sum.lng / points.length
	};
};

const ZONAS_BASE = [
	{
		id: 'Z1',
		nombre: 'Zona1',
		color: '#4A90E2',
		rect: { minLat: LAT_M, maxLat: LAT_N, minLng: LNG_M, maxLng: LNG_E }
	},
	{
		id: 'Z2',
		nombre: 'Zona2',
		color: '#9B59B6',
		rect: { minLat: LAT_M, maxLat: LAT_N, minLng: LNG_W, maxLng: LNG_M }
	},
	{
		id: 'Z3',
		nombre: 'Zona3',
		color: '#27AE60',
		rect: { minLat: LAT_S, maxLat: LAT_M, minLng: LNG_M, maxLng: LNG_E }
	},
	{
		id: 'Z4',
		nombre: 'Zona4',
		color: '#E67E22',
		rect: { minLat: LAT_S, maxLat: LAT_M, minLng: LNG_W, maxLng: LNG_M }
	}
];

// Se mantiene la estructura de 4 zonas para compatibilidad con el resto del sistema.
export const ZONAS_CAMPUS = ZONAS_BASE.map((zona) => {
	const paths = clipPolygonToRect(PARCELA_UTA_PATH, zona.rect);
	return {
		id: zona.id,
		nombre: zona.nombre,
		color: zona.color,
		paths,
		center: getPolygonCenter(paths)
	};
});

/**
 * Determina la posición del marcador de una alerta.
 * Usa coordX/coordY de la API si están disponibles; si no, usa el centro
 * de la zona del campus que corresponde al índice de idZona.
 */
const getPosicionAlerta = (alerta, zonasApi = []) => {
	if (!alerta) return UTA_CENTER;

	const latAlerta = Number(alerta.lat);
	const lngAlerta = Number(alerta.lng);
	if (Number.isFinite(latAlerta) && Number.isFinite(lngAlerta)) {
		return { lat: latAlerta, lng: lngAlerta };
	}

	const zonaApi = zonasApi.find(z => String(z.id) === String(alerta.idZona));
	if (zonaApi?.coordX && zonaApi?.coordY && Number(zonaApi.coordX) !== 0) {
		return { lat: Number(zonaApi.coordX), lng: Number(zonaApi.coordY) };
	}

	// Fallback: mapear idZona (1-based) a los cuadrantes del campus
	const idx = (Math.max(1, Number(alerta.idZona) || 1) - 1) % ZONAS_CAMPUS.length;
	return ZONAS_CAMPUS[idx].center;
};

const MapaCampus = ({
	alertas = [],
	zonasApi = [],
	height = '380px',
	alertaFoco = null,
	alertaSeleccionada = null,
	onAlertaSeleccionadaChange = null,
	renderAlertaDetalle = null
}) => {
	const [alertaSeleccionadaInterna, setAlertaSeleccionadaInterna] = useState(null);
	const mapRef = useRef(null);
	const alertaActiva = alertaSeleccionada || alertaSeleccionadaInterna;

	const seleccionarAlerta = (alerta) => {
		setAlertaSeleccionadaInterna(alerta);
		if (onAlertaSeleccionadaChange) onAlertaSeleccionadaChange(alerta);
	};

	const limpiarAlertaSeleccionada = () => {
		setAlertaSeleccionadaInterna(null);
		if (onAlertaSeleccionadaChange) onAlertaSeleccionadaChange(null);
	};

	const { isLoaded, loadError } = useLoadScript({
		googleMapsApiKey: GOOGLE_MAPS_API_KEY
	});

	const onMapLoad = useCallback((map) => {
		mapRef.current = map;
		if (!window.google?.maps) return;
		if (alertaFoco) {
			const posFoco = getPosicionAlerta(alertaFoco, zonasApi);
			map.panTo(posFoco);
			map.setZoom(19);
			seleccionarAlerta(alertaFoco);
			return;
		}
		const bounds = new window.google.maps.LatLngBounds();
		PARCELA_UTA_PATH.forEach(p => bounds.extend(p));
		map.fitBounds(bounds, 24);
	}, [alertaFoco, zonasApi]);

	useEffect(() => {
		if (!mapRef.current || !alertaFoco) return;
		const posFoco = getPosicionAlerta(alertaFoco, zonasApi);
		mapRef.current.panTo(posFoco);
		mapRef.current.setZoom(19);
		seleccionarAlerta(alertaFoco);
	}, [alertaFoco, zonasApi]);

	useEffect(() => {
		if (!alertaSeleccionada) return;
		setAlertaSeleccionadaInterna(alertaSeleccionada);
	}, [alertaSeleccionada]);

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
					Error al cargar el mapa. Verifica tu conexión a internet.
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
						{alertas.length} alerta{alertas.length !== 1 ? 's' : ''} activa{alertas.length !== 1 ? 's' : ''}
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
					{/* Contorno oficial de la parcela UTA (OSM) */}
					<Polygon
						paths={PARCELA_UTA_PATH}
						options={{
							strokeColor: '#1f2937',
							strokeOpacity: 0.95,
							strokeWeight: 3,
							fillColor: '#1f2937',
							fillOpacity: 0.06
						}}
					/>

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
								onClick={() => seleccionarAlerta(alerta)}
								label={{
									text: 'A',
									fontSize: '18px'
								}}
								title={`Alerta ${alerta.id} – ${alerta.motivo}`}
							/>
						);
					})}

					{/* InfoWindow al hacer clic en un marcador */}
					{alertaActiva && (
						<InfoWindow
							position={getPosicionAlerta(alertaActiva, zonasApi)}
							onCloseClick={limpiarAlertaSeleccionada}
						>
							<div style={{ minWidth: 180, fontFamily: 'sans-serif', fontSize: '0.85rem' }}>
								<p style={{ margin: '0 0 0.3rem', color: '#dc2626', fontWeight: 700 }}>Alerta Activa</p>
								<p style={{ margin: '0.2rem 0' }}><strong>ID:</strong> {alertaActiva.id}</p>
								<p style={{ margin: '0.2rem 0' }}><strong>Motivo:</strong> {alertaActiva.motivo}</p>
								{alertaActiva.nombreZona && (
									<p style={{ margin: '0.2rem 0' }}><strong>Zona:</strong> {alertaActiva.nombreZona}</p>
								)}
								{alertaActiva.emailUsuario && (
									<p style={{ margin: '0.2rem 0' }}><strong>Usuario:</strong> {alertaActiva.emailUsuario}</p>
								)}
								<p style={{ margin: '0.3rem 0 0', color: '#dc2626', fontWeight: 600 }}>
									Estado: {alertaActiva.estado || 'Activo'}
								</p>
								{typeof renderAlertaDetalle === 'function' && renderAlertaDetalle(alertaActiva)}
							</div>
						</InfoWindow>
					)}
				</GoogleMap>
			</div>
		</div>
	);
};

export default MapaCampus;
