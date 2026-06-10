import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { getHistorialDetallado } from '../services/historialService';
import '../styles/HistorialIncidentes.css';

const TAMANO_PAGINA = 8;

const formatearFechaInput = (fecha) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getRangoMesActual = () => {
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

  return {
    desde: formatearFechaInput(inicio),
    hasta: formatearFechaInput(fin)
  };
};

const RANGO_MES_ACTUAL = getRangoMesActual();

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

const HistorialIncidentes = ({ refreshSignal = 0, embedded = false }) => {
  const { user } = useAuth();

  const [busquedaInput, setBusquedaInput] = useState('');
  const [busquedaActiva, setBusquedaActiva] = useState('');
  const [fechaDesdeInput, setFechaDesdeInput] = useState(RANGO_MES_ACTUAL.desde);
  const [fechaHastaInput, setFechaHastaInput] = useState(RANGO_MES_ACTUAL.hasta);
  const [rangoActivo, setRangoActivo] = useState(RANGO_MES_ACTUAL);
  const [pagina, setPagina] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: TAMANO_PAGINA, total: 0, totalPages: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = async ({
    search = busquedaActiva,
    page = pagina,
    desde = rangoActivo.desde,
    hasta = rangoActivo.hasta
  } = {}) => {
    setCargando(true);
    setAviso('');
    if (!items.length) {
      setError('');
    }

    try {
      const response = await getHistorialDetallado({
        q: search,
        page,
        limit: TAMANO_PAGINA,
        desde,
        hasta
      });
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
  }, [busquedaActiva, pagina, rangoActivo.desde, rangoActivo.hasta]);

  useEffect(() => {
    if (!refreshSignal) return;
    cargar({ search: busquedaActiva, page: pagina, desde: rangoActivo.desde, hasta: rangoActivo.hasta });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const totalRegistros = useMemo(() => Number(pagination?.total || 0), [pagination]);
  const totalPages = useMemo(() => Number(pagination?.totalPages || 0), [pagination]);
  const pages = useMemo(() => getPagesToRender(Number(pagination?.page || pagina), totalPages), [pagina, pagination, totalPages]);

  const onSubmit = (e) => {
    e.preventDefault();
    const cleaned = busquedaInput.trim();
    if (fechaDesdeInput && fechaHastaInput && fechaDesdeInput > fechaHastaInput) {
      setAviso('La fecha inicial no puede ser mayor que la fecha final.');
      return;
    }

    setPagina(1);
    setAviso('');
    setBusquedaActiva(cleaned);
    setRangoActivo({ desde: fechaDesdeInput, hasta: fechaHastaInput });
  };

  const onLimpiar = () => {
    setBusquedaInput('');
    setFechaDesdeInput(RANGO_MES_ACTUAL.desde);
    setFechaHastaInput(RANGO_MES_ACTUAL.hasta);
    setPagina(1);
    setAviso('');
    setBusquedaActiva('');
    setRangoActivo(RANGO_MES_ACTUAL);
  };

  if (cargando && !items.length) {
    return (
      <section className={`hi-shell ${embedded ? 'hi-shell--embedded' : ''}`}>
        <div className="hi-loading">Cargando historial de incidentes...</div>
      </section>
    );
  }

  if (error && !items.length) {
    return (
      <section className={`hi-shell ${embedded ? 'hi-shell--embedded' : ''}`}>
        <div className="hi-error-panel">
          <h2>No se pudo cargar el historial</h2>
          <p>{error}</p>
          <button type="button" className="hi-btn hi-btn--primary" onClick={() => cargar({ search: busquedaActiva, page: pagina })}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`hi-shell ${embedded ? 'hi-shell--embedded' : ''}`}>
      <div className={`hi-card ${embedded ? 'hi-card--embedded' : ''}`}>
        <header className="hi-header">
          <div>
            <h1 className="hi-title">Historial de Incidentes</h1>
          </div>
        </header>

        <form className="hi-filters" onSubmit={onSubmit}>
          <div className="hi-search-group">
            <label className="hi-search hi-search--grow">
              <span className="hi-search__label">Buscar</span>
              <input
                type="text"
                value={busquedaInput}
                onChange={(e) => setBusquedaInput(e.target.value)}
                placeholder="ID, motivo, zona, usuario o resolución"
              />
            </label>

            <button type="button" className="hi-btn hi-btn--ghost hi-btn--compact" onClick={onLimpiar}>
              Limpiar
            </button>
          </div>

          <div className="hi-date-range">
            <label className="hi-search hi-search--compact">
              <span className="hi-search__label">Desde</span>
              <input
                type="date"
                value={fechaDesdeInput}
                onChange={(e) => setFechaDesdeInput(e.target.value)}
                max={fechaHastaInput || undefined}
              />
            </label>

            <label className="hi-search hi-search--compact">
              <span className="hi-search__label">Hasta</span>
              <input
                type="date"
                value={fechaHastaInput}
                onChange={(e) => setFechaHastaInput(e.target.value)}
                min={fechaDesdeInput || undefined}
              />
            </label>
          </div>

          <div className="hi-filters__actions">
            <button type="submit" className="hi-btn hi-btn--primary">
              Buscar
            </button>
          </div>
        </form>

        {aviso && <div className="hi-alert hi-alert--warning">{aviso}</div>}

        <div className="hi-meta">
          <span>{totalRegistros} incidentes encontrados</span>
          <span>{rangoActivo.desde || rangoActivo.hasta ? `Rango: ${rangoActivo.desde || 'inicio'} a ${rangoActivo.hasta || 'hoy'}` : 'Rango: todos los cierres'}</span>
          <span>Página {pagination.page || 1} de {totalPages || 1}</span>
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
