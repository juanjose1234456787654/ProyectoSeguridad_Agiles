import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { getEstadisticas, getHistorial } from '../services/adminService';
import '../styles/EstadisticasPanel.css';

const COLORES_PASTEL = ['#21335b', '#e53e3e', '#d69e2e', '#38a169', '#805ad5', '#3182ce', '#dd6b20'];
const PERIODOS = [
  { id: 'dia', label: 'Dia' }
];

const normalizarPeriodo = (periodo) => {
  const valor = String(periodo || '').trim().toLowerCase();
  return PERIODOS.some((item) => item.id === valor) ? valor : 'dia';
};

const parsearFecha = (registro) => {
  const fecha = registro?.fechaCierre || registro?.fechaInicio;
  if (!fecha) return null;
  const parsed = new Date(fecha);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatearFechaEcuador = (fecha) => {
  if (!fecha) return '—';
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
};

const inicioSemana = (fecha) => {
  const base = new Date(fecha);
  const dia = base.getDay();
  const ajuste = dia === 0 ? -6 : 1 - dia;
  base.setDate(base.getDate() + ajuste);
  base.setHours(0, 0, 0, 0);
  return base;
};

const coincidePeriodo = (fecha, periodo, referencia = new Date()) => {
  const p = normalizarPeriodo(periodo);

  if (p === 'dia') {
    return fecha.toDateString() === referencia.toDateString();
  }

  if (p === 'semana') {
    return inicioSemana(fecha).getTime() === inicioSemana(referencia).getTime();
  }

  if (p === 'mes') {
    return fecha.getMonth() === referencia.getMonth() && fecha.getFullYear() === referencia.getFullYear();
  }

  return fecha.getFullYear() === referencia.getFullYear();
};

const getFechaMasReciente = (registros) => {
  let fechaMasReciente = null;

  registros.forEach((registro) => {
    const fecha = parsearFecha(registro);
    if (!fecha) return;
    if (!fechaMasReciente || fecha > fechaMasReciente) {
      fechaMasReciente = fecha;
    }
  });

  return fechaMasReciente;
};

const etiquetaTemporal = (fecha, periodo) => {
  const p = normalizarPeriodo(periodo);

  if (p === 'dia') {
    return `${String(fecha.getHours()).padStart(2, '0')}:00`;
  }

  if (p === 'semana') {
    return fecha.toLocaleDateString('es-EC', { weekday: 'short' });
  }

  if (p === 'mes') {
    return String(fecha.getDate()).padStart(2, '0');
  }

  return fecha.toLocaleDateString('es-EC', { month: 'short' });
};

const ordenarEtiquetas = (periodo) => (a, b) => {
  const p = normalizarPeriodo(periodo);

  if (p === 'dia') return a.localeCompare(b);
  if (p === 'mes') return Number(a) - Number(b);

  if (p === 'semana') {
    const orden = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
    return orden.indexOf(a.slice(0, 3).toLowerCase()) - orden.indexOf(b.slice(0, 3).toLowerCase());
  }

  const ordenMes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return ordenMes.indexOf(a.slice(0, 3).toLowerCase()) - ordenMes.indexOf(b.slice(0, 3).toLowerCase());
};

const LABEL_CENTRO = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const rad = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * rad);
  const y = cy + r * Math.sin(-midAngle * rad);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const CUSTOM_TOOLTIP_PASTEL = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ep-tooltip">
      <strong>{payload[0].name}</strong>
      <span>{payload[0].value} alerta{payload[0].value !== 1 ? 's' : ''}</span>
    </div>
  );
};

const CUSTOM_TOOLTIP_BARRA = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ep-tooltip">
      <strong>{label}</strong>
      <span>{payload[0].value} alerta{payload[0].value !== 1 ? 's' : ''}</span>
    </div>
  );
};

const EstadisticasPanel = ({ refreshSignal = 0 }) => {
  const [datos, setDatos] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [errorAviso, setErrorAviso] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState(null);
  const [filtroZona, setFiltroZona] = useState(null);
  const periodoTemporal = 'dia';
  const periodoConsultaHistorial = 'anio';
  const datosRef = useRef(null);

  useEffect(() => {
    datosRef.current = datos;
  }, [datos]);

  const cargar = useCallback(async (periodo, { segundoPlano = false } = {}) => {
    const hayDatosPrevios = Boolean(datosRef.current);
    if (hayDatosPrevios && segundoPlano) {
      setActualizando(true);
    } else {
      setCargando(true);
    }
    setErrorAviso('');
    try {
      const [data, hist] = await Promise.all([
        getEstadisticas(),
        getHistorial({ periodo: periodoConsultaHistorial })
      ]);
      setDatos(data);
      setHistorial(Array.isArray(hist) ? hist : []);
      setError('');
    } catch (e) {
      const mensaje = e.message || 'Error al cargar estadísticas';
      if (datosRef.current) {
        setErrorAviso(`${mensaje}. Se mantienen los datos anteriores.`);
      } else {
        setError(mensaje);
      }
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [periodoConsultaHistorial]);

  useEffect(() => {
    cargar(periodoTemporal);
  }, [cargar, periodoTemporal]);

  useEffect(() => {
    if (!refreshSignal) return;
    cargar(periodoTemporal, { segundoPlano: true });
  }, [refreshSignal, cargar, periodoTemporal]);

  const periodoActivo = normalizarPeriodo(periodoTemporal);

  const historialCerrados = useMemo(
    () => historial.filter((h) => Boolean(h?.fechaCierre || h?.fechaInicio)),
    [historial]
  );

  const fechaReferencia = useMemo(
    () => getFechaMasReciente(historialCerrados),
    [historialCerrados]
  );

  const historialFiltrado = useMemo(
    () => historialCerrados.filter((h) => {
      const fecha = parsearFecha(h);
      return fecha && fechaReferencia ? coincidePeriodo(fecha, periodoActivo, fechaReferencia) : false;
    }),
    [fechaReferencia, historialCerrados, periodoActivo]
  );

  const serieTemporal = useMemo(() => {
    const contador = new Map();

    historialFiltrado.forEach((registro) => {
      const fecha = parsearFecha(registro);
      if (!fecha) return;
      const etiqueta = etiquetaTemporal(fecha, periodoActivo);
      contador.set(etiqueta, (contador.get(etiqueta) || 0) + 1);
    });

    return [...contador.entries()]
      .sort(([a], [b]) => ordenarEtiquetas(periodoActivo)(a, b))
      .map(([etiqueta, cantidad]) => ({ etiqueta, cantidad }));
  }, [historialFiltrado, periodoActivo]);

  const etiquetaPeriodo = fechaReferencia
    ? `Ultimo dia con registros: ${fechaReferencia.toLocaleDateString('es-EC')}`
    : (PERIODOS.find((p) => p.id === periodoActivo)?.label || 'Dia');

  if (cargando && !datos) return <div className="ep-loading">Cargando estadísticas…</div>;
  if (error)    return <div className="ep-error">{error} <button onClick={() => cargar(periodoTemporal)}>Reintentar</button></div>;
  if (!datos)   return null;

  return (
    <div className="ep-root">
      {errorAviso && <div className="ep-alerta">{errorAviso}</div>}

      {/* ── Tarjetas resumen ── */}
      <div className={`ep-kpis ${actualizando ? 'ep-kpis--updating' : ''}`}>
        <div className="ep-kpi ep-kpi--total">
          <span className="ep-kpi__num">{datos.total}</span>
          <span className="ep-kpi__label">Total alertas</span>
        </div>
        <div className="ep-kpi ep-kpi--activas">
          <span className="ep-kpi__num">{datos.activas}</span>
          <span className="ep-kpi__label">Activas</span>
        </div>
        <div className="ep-kpi ep-kpi--cerradas">
          <span className="ep-kpi__num">{datos.cerradas}</span>
          <span className="ep-kpi__label">Cerradas</span>
        </div>
      </div>

      {/* ── Gráficos ── */}
      <div className={`ep-graficos ${actualizando ? 'ep-graficos--updating' : ''}`}>
        {/* Pastel por motivo */}
        <div className="ep-card">
          <h3 className="ep-card__title">Alertas por Tipo</h3>
          <p className="ep-card__hint">Clic en un sector para filtrar la tabla</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={datos.porMotivo}
                dataKey="cantidad"
                nameKey="motivo"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={LABEL_CENTRO}
                onClick={(entry) => setFiltroMotivo(prev => prev === entry.motivo ? null : entry.motivo)}
                style={{ cursor: 'pointer' }}
              >
                {datos.porMotivo.map((entry, i) => (
                  <Cell
                    key={entry.motivo}
                    fill={COLORES_PASTEL[i % COLORES_PASTEL.length]}
                    opacity={filtroMotivo && filtroMotivo !== entry.motivo ? 0.35 : 1}
                    stroke={filtroMotivo === entry.motivo ? '#fff' : 'none'}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CUSTOM_TOOLTIP_PASTEL />} />
              <Legend formatter={(v) => <span style={{ fontSize: '0.82rem' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Barras por zona */}
        <div className="ep-card">
          <h3 className="ep-card__title">Alertas por Zona</h3>
          <p className="ep-card__hint">Clic en una barra para filtrar la tabla</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={datos.porZona} margin={{ top: 4, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="zona" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CUSTOM_TOOLTIP_BARRA />} />
              <Bar
                dataKey="cantidad"
                radius={[6, 6, 0, 0]}
                onClick={(entry) => setFiltroZona(prev => prev === entry.zona ? null : entry.zona)}
                style={{ cursor: 'pointer' }}
              >
                {datos.porZona.map((entry, i) => (
                  <Cell
                    key={entry.zona}
                    fill={COLORES_PASTEL[i % COLORES_PASTEL.length]}
                    opacity={filtroZona && filtroZona !== entry.zona ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="ep-card ep-card--full">
          <div className="ep-card__head">
            <h3 className="ep-card__title">Incidentes cerrados por temporalidad</h3>
            <span className="ep-filtro-activo">Vista del ultimo dia con registros</span>
            {actualizando && <span className="ep-loading-inline">Actualizando...</span>}
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={serieTemporal} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CUSTOM_TOOLTIP_BARRA />} />
              <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} fill="#1f6f8b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Historial ── */}
      <div className={`ep-card ep-card--full ${actualizando ? 'ep-card--updating' : ''}`}>
        <div className="ep-tabla-header">
          <h3 className="ep-card__title">Historial</h3>
          <span className="ep-filtro-activo">Periodo: {etiquetaPeriodo}</span>
        </div>

        {historialFiltrado.length === 0 ? (
          <p className="ep-empty">No hay registros en el historial.</p>
        ) : (
          <div className="ep-tabla-wrap">
            <table className="ep-tabla">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha Inicio</th>
                  <th>Fecha Cierre</th>
                  <th>Guardia (ID)</th>
                  <th>ID Asignacion</th>
                  <th>Datos</th>
                </tr>
              </thead>
              <tbody>
                {historialFiltrado.map(h => (
                  <tr key={h.id}>
                    <td className="ep-td-id">{h.id}</td>
                    <td>{formatearFechaEcuador(h.fechaInicio)}</td>
                    <td>{formatearFechaEcuador(h.fechaCierre)}</td>
                    <td>{h.resultadoGuardia || '—'}</td>
                    <td>{h.idAsignacion || '—'}</td>
                    <td className="ep-td-acciones">{h.datosJson || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EstadisticasPanel;
