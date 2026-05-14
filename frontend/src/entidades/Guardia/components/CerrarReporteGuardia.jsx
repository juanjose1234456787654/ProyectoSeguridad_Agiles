import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import guardiaService from '../services/guardiaService';

const CerrarReporteGuardia = () => {
	const { idIncidente } = useParams();
	const navigate = useNavigate();
	const { user } = useAuth();
  
	const [incidente, setIncidente] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [acciones, setAcciones] = useState('');
	const [estado, setEstado] = useState('Cerrado');
	const [enviando, setEnviando] = useState(false);

	useEffect(() => {
		if (!idIncidente) {
			navigate('/guardia');
			return;
		}
    
		cargarDetalles();
	}, [idIncidente]);

	const cargarDetalles = async () => {
		try {
			setLoading(true);
			setError('');
			const data = await guardiaService.getIncidenteDetalle(idIncidente);
			setIncidente(data);
		} catch (err) {
			const message = err?.response?.data?.message || 'No se pudo cargar los detalles del incidente';
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	const handleCerrar = async (e) => {
		e.preventDefault();
    
		if (!acciones.trim()) {
			setError('Por favor, describe las acciones realizadas');
			return;
		}

		try {
			setEnviando(true);
			setError('');
			await guardiaService.cerrarReporte(idIncidente, acciones);
			navigate('/guardia');
		} catch (err) {
			const message = err?.response?.data?.message || 'No se pudo cerrar el reporte';
			setError(message);
		} finally {
			setEnviando(false);
		}
	};

	if (loading) {
		return (
			<div style={{ maxWidth: 900, margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
				<p>Cargando detalles del incidente...</p>
			</div>
		);
	}

	if (!incidente) {
		return (
			<div style={{ maxWidth: 900, margin: '2rem auto', padding: '1rem' }}>
				<p style={{ color: '#b91c1c' }}>No se encontró el incidente</p>
				<button onClick={() => navigate('/guardia')}>Volver</button>
			</div>
		);
	}

	return (
		<div style={{ maxWidth: 1200, margin: '2rem auto', padding: '1rem' }}>
			<div style={{ background: '#fff', borderRadius: 8, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
				<h1 style={{ margin: '0 0 1.5rem 0', color: '#21335b', fontSize: '1.8rem' }}>
					Cierre de Caso
				</h1>

				{error && (
					<div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: 6, marginBottom: '1rem', border: '1px solid #fecaca' }}>
						{error}
					</div>
				)}

				<form onSubmit={handleCerrar}>
					{/* ID DEL CASO */}
					<div style={{ marginBottom: '1.5rem' }}>
						<label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
							ID del Caso:
						</label>
						<input
							type="text"
							value={incidente.id || ''}
							disabled
							style={{
								width: '100%',
								padding: '0.75rem',
								border: '1px solid #d1d5db',
								borderRadius: 4,
								background: '#f9fafb',
								color: '#6b7280',
								fontFamily: 'monospace'
							}}
						/>
					</div>

					{/* DESCRIPCIÓN DEL EVENTO (MOTIVO) */}
					<div style={{ marginBottom: '1.5rem' }}>
						<label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
							Descripción del Evento:
						</label>
						<textarea
							value={incidente.motivo || ''}
							disabled
							style={{
								width: '100%',
								padding: '0.75rem',
								border: '1px solid #d1d5db',
								borderRadius: 4,
								background: '#f9fafb',
								color: '#6b7280',
								fontFamily: 'inherit',
								minHeight: '80px',
								resize: 'vertical'
							}}
						/>
						<p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
							Reportado por: {incidente.nombreUsuario || incidente.emailUsuario || 'Sin dato'}
						</p>
					</div>

					{/* ACCIONES REALIZADAS */}
					<div style={{ marginBottom: '1.5rem' }}>
						<label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
							Acciones Realizadas: *
						</label>
						<textarea
							value={acciones}
							onChange={(e) => setAcciones(e.target.value)}
							placeholder="Describe brevemente las acciones tomadas para resolver la alerta (máx. 500 caracteres)"
							maxLength={500}
							style={{
								width: '100%',
								padding: '0.75rem',
								border: '1px solid #d1d5db',
								borderRadius: 4,
								fontFamily: 'inherit',
								minHeight: '120px',
								resize: 'vertical',
								fontSize: '0.95rem'
							}}
						/>
						<p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
							{acciones.length}/500 caracteres
						</p>
					</div>

					{/* ESTADO DEL CASO */}
					<div style={{ marginBottom: '2rem' }}>
						<label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
							Estado del Caso:
						</label>
						<select
							value={estado}
							onChange={(e) => setEstado(e.target.value)}
							disabled
							style={{
								padding: '0.75rem',
								border: '1px solid #d1d5db',
								borderRadius: 4,
								background: '#f9fafb',
								color: '#6b7280',
								fontSize: '1rem',
								cursor: 'not-allowed'
							}}
						>
							<option value="Cerrado">Cerrado</option>
						</select>
					</div>

					{/* BOTONES */}
					<div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
						<button
							type="button"
							onClick={() => navigate('/guardia')}
							disabled={enviando}
							style={{
								padding: '0.75rem 1.5rem',
								background: '#e5e7eb',
								color: '#374151',
								border: 'none',
								borderRadius: 4,
								cursor: enviando ? 'not-allowed' : 'pointer',
								fontWeight: '600',
								fontSize: '1rem'
							}}
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={enviando}
							style={{
								padding: '0.75rem 1.5rem',
								background: '#21335b',
								color: '#fff',
								border: 'none',
								borderRadius: 4,
								cursor: enviando ? 'not-allowed' : 'pointer',
								fontWeight: '600',
								fontSize: '1rem',
								opacity: enviando ? 0.7 : 1
							}}
						>
							{enviando ? 'Cerrando...' : 'Cerrar Caso'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default CerrarReporteGuardia;
