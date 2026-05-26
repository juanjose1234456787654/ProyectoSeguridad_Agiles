import { useEffect, useState, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { getEstadisticas } from '../services/adminService';
import '../styles/EstadisticasPanel.css';

const COLORES_PASTEL = ['#21335b', '#e53e3e', '#d69e2e', '#38a169', '#805ad5', '#3182ce', '#dd6b20'];

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

const EstadisticasPanel = () => {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState(null); // para interactividad T5.4
  const [filtroZona, setFiltroZona] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await getEstadisticas();
      setDatos(data);
    } catch (e) {
      setError(e.message || 'Error al cargar estadísticas');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return <div className="ep-loading">Cargando estadísticas…</div>;
  if (error)    return <div className="ep-error">{error} <button onClick={cargar}>Reintentar</button></div>;
  if (!datos)   return null;

  // Filtrado interactivo (T5.4)
  const cerradasFiltradas = datos.ultimasCerradas?.filter(a => {
    if (filtroMotivo && a.motivo !== filtroMotivo) return false;
    if (filtroZona && a.nombreZona !== filtroZona) return false;
    return true;
  }) ?? [];

  const hayFiltro = filtroMotivo || filtroZona;

  return (
    <div className="ep-root">
      {/* ── Tarjetas resumen ── */}
      <div className="ep-kpis">
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
      <div className="ep-graficos">
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
      </div>

      {/* ── Tabla historial cerradas ── */}
      <div className="ep-card ep-card--full">
        <div className="ep-tabla-header">
          <h3 className="ep-card__title">
            Últimas Alertas Cerradas
            {hayFiltro && (
              <span className="ep-filtro-activo">
                {filtroMotivo && `Tipo: ${filtroMotivo}`}
                {filtroMotivo && filtroZona && ' · '}
                {filtroZona && `Zona: ${filtroZona}`}
              </span>
            )}
          </h3>
          {hayFiltro && (
            <button className="ep-btn-limpiar" onClick={() => { setFiltroMotivo(null); setFiltroZona(null); }}>
              ✕ Limpiar filtros
            </button>
          )}
        </div>

        {cerradasFiltradas.length === 0 ? (
          <p className="ep-empty">No hay alertas cerradas{hayFiltro ? ' con ese filtro' : ''}.</p>
        ) : (
          <div className="ep-tabla-wrap">
            <table className="ep-tabla">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Motivo</th>
                  <th>Zona</th>
                  <th>Usuario</th>
                  <th>Acciones realizadas</th>
                </tr>
              </thead>
              <tbody>
                {cerradasFiltradas.map(a => (
                  <tr key={a.id}>
                    <td className="ep-td-id">{a.id}</td>
                    <td><span className="ep-badge">{a.motivo}</span></td>
                    <td>{a.nombreZona}</td>
                    <td>{a.emailUsuario || '—'}</td>
                    <td className="ep-td-acciones">{a.acciones || '—'}</td>
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
