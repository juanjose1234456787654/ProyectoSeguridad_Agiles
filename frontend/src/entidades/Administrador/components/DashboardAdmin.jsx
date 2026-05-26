import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../../contexts/AuthContext';
import MapaCampus from '../../Guardia/components/MapaCampus';
import guardiaService from '../../Guardia/services/guardiaService';
import alertaService from '../../Guardia/services/alertaService';
import EstadisticasPanel from './EstadisticasPanel';
import GestionUsuarios from './GestionUsuarios';
import '../styles/DashboardAdmin.css';

const SECCIONES_MENU = [
  { id: 'usuarios', icono: '👥', label: 'Gestión de Usuarios' },
  { id: 'estadisticas', icono: '📊', label: 'Estadísticas' }
];

const DashboardAdmin = () => {
  const { logout } = useAuth();

  const [alertasActivas, setAlertasActivas] = useState([]);
  const [zonasApi, setZonasApi] = useState([]);
  const [sidebarAbierto, setSidebarAbierto] = useState(true);
  const [seccionActiva, setSeccionActiva] = useState('usuarios');
  const socketRef = useRef(null);

  const cargarAlertas = async () => {
    try {
      const data = await guardiaService.getIncidentesActivos();
      setAlertasActivas(Array.isArray(data) ? data : []);
    } catch { /* el mapa sigue visible */ }
  };

  useEffect(() => {
    cargarAlertas();
    alertaService.getZonas()
      .then(data => setZonasApi(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    socketRef.current = io('http://localhost:4000', { transports: ['websocket'] });

    socketRef.current.on('incidente:creado', (payload) => {
      if (!payload) return;
      setAlertasActivas(prev => {
        const existe = prev.some(a => a.id === payload.id);
        return existe ? prev : [...prev, payload];
      });
    });

    socketRef.current.on('incidente:cerrado', (payload) => {
      if (!payload) return;
      setAlertasActivas(prev => prev.filter(a => a.id !== payload.id));
    });

    socketRef.current.on('incidente:actualizado', () => { cargarAlertas(); });

    return () => socketRef.current?.disconnect();
  }, []);

  const seleccionarSeccion = (id) => {
    setSeccionActiva(id);
    if (!sidebarAbierto) setSidebarAbierto(true);
  };

  return (
    <div className="da-shell">

      {/* ─── SIDEBAR IZQUIERDO ─────────────────────────────────────────── */}
      <aside className={`da-sidebar ${sidebarAbierto ? 'da-sidebar--open' : 'da-sidebar--collapsed'}`}>

        <div className="da-sidebar__head">
          {sidebarAbierto && <span className="da-sidebar__logo">🛡 Admin UTA</span>}
          <button
            className="da-sidebar__toggle"
            onClick={() => setSidebarAbierto(v => !v)}
            title={sidebarAbierto ? 'Colapsar menú' : 'Expandir menú'}
          >
            {sidebarAbierto ? '◀' : '▶'}
          </button>
        </div>

        {alertasActivas.length > 0 && (
          <div className={`da-sidebar__badge ${sidebarAbierto ? '' : 'da-sidebar__badge--mini'}`}>
            {sidebarAbierto
              ? `🔴 ${alertasActivas.length} alerta${alertasActivas.length !== 1 ? 's' : ''} activa${alertasActivas.length !== 1 ? 's' : ''}`
              : `🔴 ${alertasActivas.length}`}
          </div>
        )}

        <nav className="da-sidebar__nav">
          {SECCIONES_MENU.map(s => (
            <button
              key={s.id}
              className={`da-sidebar__item ${seccionActiva === s.id ? 'da-sidebar__item--active' : ''}`}
              onClick={() => seleccionarSeccion(s.id)}
              title={!sidebarAbierto ? s.label : undefined}
            >
              <span className="da-sidebar__icono">{s.icono}</span>
              {sidebarAbierto && <span className="da-sidebar__label">{s.label}</span>}
            </button>
          ))}
        </nav>

        <div className="da-sidebar__footer">
          <button className="da-sidebar__logout" onClick={logout} title="Cerrar sesión">
            <span>🚪</span>
            {sidebarAbierto && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ─── CONTENIDO PRINCIPAL ───────────────────────────────────────── */}
      <main className="da-main">

        {/* MAPA – ocupa toda la parte superior */}
        <section className="da-mapa-section">
          <div className="da-mapa-header">
            <div>
              <h1 className="da-mapa-title">🗺 Campus UTA – Monitoreo en Tiempo Real</h1>
              <p className="da-mapa-sub">Huachi, Ambato · 4 zonas monitoreadas</p>
            </div>
            {alertasActivas.length > 0 && (
              <span className="da-alerta-badge">
                🔴 {alertasActivas.length} activa{alertasActivas.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="da-mapa-wrap">
            <MapaCampus alertas={alertasActivas} zonasApi={zonasApi} height="100%" />
          </div>
        </section>

        {/* PANEL INFERIOR – gestión + estadísticas */}
        <section className="da-panel-section">
          <div className="da-panel-tabs">
            {SECCIONES_MENU.map(s => (
              <button
                key={s.id}
                className={`da-panel-tab ${seccionActiva === s.id ? 'da-panel-tab--active' : ''}`}
                onClick={() => setSeccionActiva(s.id)}
              >
                {s.icono} {s.label}
              </button>
            ))}
          </div>

          <div className="da-panel-content">
            {seccionActiva === 'estadisticas' && <EstadisticasPanel />}
            {seccionActiva === 'usuarios'     && <GestionUsuarios />}
          </div>
        </section>
      </main>
    </div>
  );
};

export default DashboardAdmin;