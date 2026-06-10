import { useCallback, useEffect, useState } from 'react';
import { getGuardiasEstado } from '../services/adminService';

const esEnServicio = (estado) => {
  const valor = String(estado || '').trim().toLowerCase();

  if (
    valor === 'no en servicio' ||
    valor === 'no_en_servicio' ||
    valor === 'inactivo' ||
    valor === 'false' ||
    valor.startsWith('no ')
  ) {
    return false;
  }

  return (
    valor === 'en servicio' ||
    valor === 'en_servicio' ||
    valor === 'activo' ||
    valor === 'check' ||
    valor === 'true'
  );
};

const EstadoBadge = ({ estado }) => {
  const enServicio = esEnServicio(estado);
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.25rem 0.75rem',
      borderRadius: '20px',
      fontSize: '0.8rem',
      fontWeight: '700',
      background: enServicio ? '#d1fae5' : '#fee2e2',
      color: enServicio ? '#065f46' : '#991b1b'
    }}>
      {enServicio ? 'En Servicio' : 'No en Servicio'}
    </span>
  );
};

const GuardiasEstado = ({ refreshKey = 0 }) => {
  const [guardias, setGuardias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await getGuardiasEstado();
      setGuardias(Array.isArray(data) ? data : []);
      setUltimaActualizacion(new Date());
    } catch (e) {
      setError(e.message || 'Error al cargar guardias');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Recarga cuando el padre recibe un evento socket de cambio de estado
  useEffect(() => {
    if (refreshKey > 0) cargar();
  }, [refreshKey, cargar]);

  const guardiasFiltrados = guardias.filter(g => {
    if (filtro === 'enServicio') return esEnServicio(g.estado);
    if (filtro === 'noServicio') return !esEnServicio(g.estado);
    return true;
  });

  const totalEnServicio = guardias.filter(g => esEnServicio(g.estado)).length;

  if (cargando) return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Cargando guardias…</div>;
  if (error) return (
    <div style={{ padding: '2rem', color: '#b91c1c' }}>
      {error} <button onClick={cargar} style={{ marginLeft: '0.5rem', cursor: 'pointer' }}>Reintentar</button>
    </div>
  );

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '10px', padding: '1rem 1.5rem', minWidth: '140px' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#065f46' }}>{totalEnServicio}</div>
          <div style={{ fontSize: '0.85rem', color: '#047857', fontWeight: '600' }}>En Servicio</div>
        </div>
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '1rem 1.5rem', minWidth: '140px' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#991b1b' }}>{guardias.length - totalEnServicio}</div>
          <div style={{ fontSize: '0.85rem', color: '#b91c1c', fontWeight: '600' }}>No en Servicio</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '10px', padding: '1rem 1.5rem', minWidth: '140px' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1d4ed8' }}>{guardias.length}</div>
          <div style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: '600' }}>Total Registrados</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[
          { valor: 'todos', label: 'Todos' },
          { valor: 'enServicio', label: 'En Servicio' },
          { valor: 'noServicio', label: 'No en Servicio' }
        ].map(op => (
          <button
            key={op.valor}
            onClick={() => setFiltro(op.valor)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              border: '1px solid',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: filtro === op.valor ? '700' : '400',
              background: filtro === op.valor ? '#21335b' : '#fff',
              color: filtro === op.valor ? '#fff' : '#21335b',
              borderColor: '#21335b'
            }}
          >
            {op.label}
          </button>
        ))}
        <button
          onClick={cargar}
          style={{ marginLeft: 'auto', padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Actualizar
        </button>
        {ultimaActualizacion && (
          <span style={{ fontSize: '0.75rem', color: '#9ca3af', alignSelf: 'center' }}>
            Última actualización: {ultimaActualizacion.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Tabla */}
      {guardiasFiltrados.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
          No hay guardias{filtro !== 'todos' ? ' con ese estado' : ' registrados'}.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#21335b', color: '#fff' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Nombre</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Estado</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Jornada</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Casos Asignados</th>
              </tr>
            </thead>
            <tbody>
              {guardiasFiltrados.map((g, i) => (
                <tr key={g.id} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#6b7280', fontSize: '0.8rem' }}>{g.id}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: '#21335b' }}>
                    {g.nombre && g.nombre.trim() ? g.nombre : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>{g.email || g.idUsuario || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><EstadoBadge estado={g.estado} /></td>
                  <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>{g.horario || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      background: Number(g.casosAsignados) > 0 ? '#fef3c7' : '#f3f4f6',
                      color: Number(g.casosAsignados) > 0 ? '#92400e' : '#6b7280',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '0.85rem'
                    }}>
                      {g.casosAsignados ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GuardiasEstado;
