import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { getHistorialDetallado } from '../services/historialService';
import '../styles/HistorialIncidentes.css';

const TAMANO_PAGINA = 8;

const formatearFecha = (fecha) => {
  if (!fecha) return '—';
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil'
  });
};

const getPagesToRender = (page, totalPages) => {
  if (totalPages <= 0) return [];
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages = [];

  if (start > 1) pages.push(1);
  if (start > 2) pages.push('...');

  for (let current = start; current <= end; current += 1) {
    pages.push(current);
  }

  if (end < totalPages - 1) pages.push('...');
  if (end < totalPages) pages.push(totalPages);

  return pages;
};

const HistorialIncidentes = ({ refreshSignal = 0 }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [busquedaInput, setBusquedaInput] = useState('');
  const [busquedaActiva, setBusquedaActiva] = useState('');
  const [pagina, setPagina] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: TAMANO_PAGINA, total: 0, totalPages: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = async ({ search = busquedaActiva, page = pagina } = {}) => {
    setCargando(true);
    setAviso('');
    if (!items.length) {
      setError('');
    }

    try {
      const response = await getHistorialDetallado({ q: search, page, limit: TAMANO_PAGINA });
      setItems(Array.isArray(response?.items) ? response.items : []);
      setPagination(response?.pagination || { page, limit: TAMANO_PAGINA, total: 0, totalPages: 0 });
      setError('');
    } catch (e) {
      const mensaje = e?.message || 'No se pudo cargar el historial de incidentes';
      if (items.length) {
        setAviso(`${mensaje}. Se mantienen los datos anteriores.`);
      } else {
        setError(mensaje);
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaActiva, pagina]);

  useEffect(() => {
    if (!refreshSignal) return;
    cargar({ search: busquedaActiva, page: pagina });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const totalRegistros = useMemo(() => Number(pagination?.total || 0), [pagination]);
  const totalPages = useMemo(() => Number(pagination?.totalPages || 0), [pagination]);
  const pages = useMemo(() => getPagesToRender(Number(pagination?.page || pagina), totalPages), [pagina, pagination, totalPages]);

  const onSubmit = (e) => {
    e.preventDefault();
    const cleaned = busquedaInput.trim();
    setPagina(1);
    setBusquedaActiva(cleaned);
  };

  const onLimpiar = () => {
    setBusquedaInput('');
    setPagina(1);
    setBusquedaActiva('');
  };

  const volver = () => {
    navigate(user?.rol === 'Guardia' ? '/guardia' : '/admin');
  };

  const tituloRol = user?.rol === 'Guardia' ? 'Guardia de Seguridad' : 'Administrador';

  if (cargando && !items.length) {
    return (
      <section className="hi-shell">
        <div className="hi-loading">Cargando historial de incidentes...</div>
      </section>
    );
  }

  if (error && !items.length) {
    return (
      <section className="hi-shell">
        <div className="hi-error-panel">
          <h2>No se pudo cargar el historial</h2>
          <p>{error}</p>
          <button type="button" className="hi-btn hi-btn--primary" onClick={() => cargar({ search: busquedaActiva, page: pagina })}>
            Reintentar
          </button>
          <button type="button" className="hi-btn hi-btn--ghost" onClick={volver}>
            Volver
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="hi-shell">
      <div className="hi-card">
        <header className="hi-header">
          <div>
            <p className="hi-kicker">{tituloRol}</p>
            <h1 className="hi-title">Historial de Incidentes</h1>
            <p className="hi-subtitle">Consulta cronológica de casos cerrados con búsqueda y paginación.</p>
          </div>

          <div className="hi-header__actions">
            <span className="hi-role-pill">{user?.rol || 'Usuario'}</span>
            <button type="button" className="hi-btn hi-btn--ghost" onClick={volver}>
              Volver
            </button>
          </div>
        </header>

        <form className="hi-filters" onSubmit={onSubmit}>
          <label className="hi-search">
            <span className="hi-search__label">Buscar</span>
            <input
              type="text"
              value={busquedaInput}
              onChange={(e) => setBusquedaInput(e.target.value)}
              placeholder="ID, motivo, zona, usuario o resolución"
            />
          </label>

          <div className="hi-filters__actions">
            <button type="submit" className="hi-btn hi-btn--primary">
              Buscar
            </button>
            <button type="button" className="hi-btn hi-btn--ghost" onClick={onLimpiar}>
              Limpiar
            </button>
          </div>
        </form>

        {aviso && <div className="hi-alert hi-alert--warning">{aviso}</div>}

        <div className="hi-meta">
          <span>{totalRegistros} incidentes encontrados</span>
          <span>
            Página {pagination.page || 1} de {totalPages || 1}
          </span>
        </div>

        {cargando && items.length > 0 && <div className="hi-alert hi-alert--info">Actualizando historial...</div>}

        {items.length === 0 ? (
          <div className="hi-empty">No se encontraron incidentes registrados.</div>
        ) : (
          <>
            <div className="hi-table-wrap">
              <table className="hi-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuario afectado</th>
                    <th>Motivo del incidente</th>
                    <th>Zona</th>
                    <th>Fecha/Hora de cierre</th>
                    <th>Motivo de resolución</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${item.idHistorial || item.id}-${item.fechaCierre || ''}`}>
                      <td>{item.id || '—'}</td>
                      <td>{item.usuarioAfectado || '—'}</td>
                      <td>{item.motivoIncidente || '—'}</td>
                      <td>{item.zona || '—'}</td>
                      <td>{formatearFecha(item.fechaCierre)}</td>
                      <td>{item.motivoResolucion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hi-cards-mobile">
              {items.map((item) => (
                <details className="hi-mobile-card" key={`${item.idHistorial || item.id}-mobile`}>
                  <summary>
                    <span className="hi-mobile-card__id">{item.id || 'SIN ID'}</span>
                    <span className="hi-mobile-card__summary">{item.motivoIncidente || 'Sin motivo'} · {item.zona || 'Sin zona'}</span>
                  </summary>
                  <div className="hi-mobile-card__body">
                    <div><strong>Usuario afectado:</strong> {item.usuarioAfectado || '—'}</div>
                    <div><strong>Fecha/Hora de cierre:</strong> {formatearFecha(item.fechaCierre)}</div>
                    <div><strong>Motivo de resolución:</strong> {item.motivoResolucion || '—'}</div>
                  </div>
                </details>
              ))}
            </div>

            <div className="hi-pagination">
              <button
                type="button"
                className="hi-btn hi-btn--ghost"
                onClick={() => setPagina((prev) => Math.max(1, prev - 1))}
                disabled={pagina <= 1 || cargando}
              >
                Anterior
              </button>

              <div className="hi-pages">
                {pages.map((pageItem, index) => (
                  pageItem === '...'
                    ? <span key={`ellipsis-${index}`} className="hi-pages__ellipsis">...</span>
                    : (
                      <button
                        key={pageItem}
                        type="button"
                        className={`hi-page ${pageItem === pagina ? 'hi-page--active' : ''}`}
                        onClick={() => setPagina(pageItem)}
                        disabled={cargando}
                      >
                        {pageItem}
                      </button>
                    )
                ))}
              </div>

              <button
                type="button"
                className="hi-btn hi-btn--ghost"
                onClick={() => setPagina((prev) => Math.min(totalPages || prev + 1, prev + 1))}
                disabled={pagina >= totalPages || cargando || totalPages === 0}
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default HistorialIncidentes;
