import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../../contexts/AuthContext';
import MapaCampus from '../../Guardia/components/MapaCampus';
import guardiaService from '../../Guardia/services/guardiaService';
import alertaService from '../../Guardia/services/alertaService';
import { getGuardiasEstado } from '../services/adminService';
import GestionUsuarios from './GestionUsuarios';
import GuardiasEstado from './GuardiasEstado';
import EstadisticasPanel from './EstadisticasPanel';
import HistorialIncidentes from '../../Historial/components/HistorialIncidentes';
import '../styles/DashboardAdmin.css';

const SECCIONES_MENU = [
  { id: 'mapa', label: 'Mapa y Alertas' },
  { id: 'usuarios', label: 'Gestión de Usuarios' },
  { id: 'guardias', label: 'Gestión de Guardias' },
  { id: 'estadisticas', label: 'Estadísticas' },
  { id: 'historial', label: 'Historial de Incidentes' }
];

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

const estaAlertaAsignada = (alerta) => {
  if (!alerta) return false;
  return Boolean(
    alerta.idEstadoGuardia ||
    alerta.idGuardia ||
    alerta.idGuardiaAsignado ||
    String(alerta.estado || '').toLowerCase().includes('asign')
  );
};

const nombreGuardiaAsignado = (alerta) => {
  if (!alerta) return '';
  return (
    alerta.nombreGuardiaAsignado ||
    alerta.nombreGuardia ||
    alerta.emailGuardiaAsignado ||
    alerta.emailGuardia ||
    ''
  );
};

const DashboardAdmin = () => {
  const { logout, user } = useAuth();

  const [alertasActivas, setAlertasActivas] = useState([]);
  const [zonasApi, setZonasApi] = useState([]);
  const [sidebarAbierto, setSidebarAbierto] = useState(true);
  const [seccionActiva, setSeccionActiva] = useState('mapa');
  const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);
  const [panelGuardiasAbierto, setPanelGuardiasAbierto] = useState(false);
  const [guardiasEnServicio, setGuardiasEnServicio] = useState([]);
  const [cargandoGuardias, setCargandoGuardias] = useState(false);
  const [avisoAsignacion, setAvisoAsignacion] = useState('');
  const [asignandoGuardiaId, setAsignandoGuardiaId] = useState(null);
  const [confirmacionAsignacion, setConfirmacionAsignacion] = useState(null);
  const [guardiaRefreshKey, setGuardiaRefreshKey] = useState(0);
  const [realtimeRefreshKey, setRealtimeRefreshKey] = useState(0);
  const [usuariosRefreshKey, setUsuariosRefreshKey] = useState(0);
  const socketRef = useRef(null);
  const socketSeguridadRef = useRef(null);
  const socketIdentidadRef = useRef(null);

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
    if (!user?.token) return undefined;

    socketRef.current = io('http://localhost:4000', {
      transports: ['websocket'],
      auth: { token: user.token }
    });

    socketRef.current.on('incidente:creado', (payload) => {
      if (!payload) return;
      setAlertasActivas(prev => {
        const existe = prev.some(a => a.id === payload.id);
        return existe ? prev : [...prev, payload];
      });
      setRealtimeRefreshKey((k) => k + 1);
    });

    socketRef.current.on('incidente:cerrado', (payload) => {
      if (!payload) return;
      setAlertasActivas(prev => prev.filter(a => a.id !== payload.id));
      setRealtimeRefreshKey((k) => k + 1);
    });

    socketRef.current.on('incidente:actualizado', () => {
      cargarAlertas();
      setRealtimeRefreshKey((k) => k + 1);
    });

    return () => socketRef.current?.disconnect();
  }, [user?.token]);

  useEffect(() => {
    if (!user?.token) return undefined;

    socketSeguridadRef.current = io('http://localhost:4003', {
      transports: ['websocket'],
      auth: { token: user.token }
    });
    socketSeguridadRef.current.on('connect', () => {
      console.log('[SOCKET SEGURIDAD] conectado al admin');
    });
    socketSeguridadRef.current.on('connect_error', (err) => {
      console.warn('[SOCKET SEGURIDAD] error de conexión:', err.message);
    });
    socketSeguridadRef.current.on('guardia:estadoCambiado', () => {
      setGuardiaRefreshKey(k => k + 1);
      if (panelGuardiasAbierto) {
        getGuardiasEstado()
          .then((data) => {
            const lista = Array.isArray(data) ? data.filter(g => esEnServicio(g.estado)) : [];
            setGuardiasEnServicio(lista);
          })
          .catch(() => {});
      }
    });
    return () => socketSeguridadRef.current?.disconnect();
  }, [panelGuardiasAbierto, user?.token]);

  useEffect(() => {
    if (!user?.token) return undefined;

    socketIdentidadRef.current = io('http://localhost:4000', {
      path: '/socket-identidad',
      transports: ['websocket'],
      auth: { token: user.token }
    });

    const onUsuarioChange = () => {
      setUsuariosRefreshKey((k) => k + 1);
    };

    socketIdentidadRef.current.on('usuario:actualizado', onUsuarioChange);
    socketIdentidadRef.current.on('usuario:bloqueado', onUsuarioChange);
    socketIdentidadRef.current.on('usuario:eliminado', onUsuarioChange);

    return () => socketIdentidadRef.current?.disconnect();
  }, [user?.token]);

  useEffect(() => {
    setPanelGuardiasAbierto(false);
    setAvisoAsignacion('');
    setConfirmacionAsignacion(null);
  }, [alertaSeleccionada?.id]);

  const cargarGuardiasEnServicio = async () => {
    try {
      setCargandoGuardias(true);
      const data = await getGuardiasEstado();
      const lista = Array.isArray(data) ? data.filter(g => esEnServicio(g.estado)) : [];
      setGuardiasEnServicio(lista);
    } catch {
      setGuardiasEnServicio([]);
    } finally {
      setCargandoGuardias(false);
    }
  };

  const onAbrirPanelGuardias = async () => {
    if (estaAlertaAsignada(alertaSeleccionada)) {
      setAvisoAsignacion('Esta alerta ya está asignada.');
      return;
    }
    setPanelGuardiasAbierto(v => !v);
    if (!panelGuardiasAbierto && guardiasEnServicio.length === 0) {
      await cargarGuardiasEnServicio();
    }
  };

  const onSeleccionarGuardiaAsignacion = (guardia) => {
    if (!alertaSeleccionada?.id || !guardia?.id || asignandoGuardiaId) return;
    if (estaAlertaAsignada(alertaSeleccionada)) {
      setAvisoAsignacion('Esta alerta ya está asignada.');
      return;
    }
    setConfirmacionAsignacion({ guardia, alerta: alertaSeleccionada });
  };

  const onConfirmarAsignacion = async () => {
    if (!confirmacionAsignacion?.guardia?.id || !confirmacionAsignacion?.alerta?.id) return;
    if (estaAlertaAsignada(confirmacionAsignacion.alerta)) {
      setAvisoAsignacion('Esta alerta ya está asignada.');
      setConfirmacionAsignacion(null);
      return;
    }

    const guardia = confirmacionAsignacion.guardia;
    const alerta = confirmacionAsignacion.alerta;

    try {
      setAsignandoGuardiaId(guardia.id);
      setAvisoAsignacion('');
      await guardiaService.asignarAlerta({
        idIncidente: alerta.id,
        idEstadoGuardia: guardia.id
      });
      const etiquetaGuardia = guardia.nombre || guardia.email || guardia.idUsuario || `Guardia ${guardia.id}`;
      setAlertasActivas(prev => prev.map(a => (
        a.id === alerta.id
          ? {
            ...a,
            idEstadoGuardia: guardia.id,
            estado: a.estado || 'Asignado',
            nombreGuardiaAsignado: etiquetaGuardia
          }
          : a
      )));
      setAlertaSeleccionada(prev => (
        prev?.id === alerta.id
          ? {
            ...prev,
            idEstadoGuardia: guardia.id,
            estado: prev.estado || 'Asignado',
            nombreGuardiaAsignado: etiquetaGuardia
          }
          : prev
      ));
      setAvisoAsignacion(`Alerta ${alerta.id} asignada a ${etiquetaGuardia}.`);
      setPanelGuardiasAbierto(false);
      setConfirmacionAsignacion(null);
      await cargarAlertas();
    } catch (e) {
      setAvisoAsignacion(e?.response?.data?.message || 'No se pudo asignar la alerta.');
    } finally {
      setAsignandoGuardiaId(null);
    }
  };

  const renderDetalleAlerta = (alerta) => {
    const asignada = estaAlertaAsignada(alerta);
    return (
      <div className="da-assign-detail">
        <p className={`da-assign-detail__status ${asignada ? 'da-assign-detail__status--ok' : 'da-assign-detail__status--pending'}`}>
          {asignada ? 'Asignado' : 'No Asignado'}
        </p>
        <button
          type="button"
          className="da-assign-detail__toggle"
          onClick={onAbrirPanelGuardias}
          disabled={asignada}
        >
          Asignar a Guardias de Seguridad
        </button>

        {asignada && (
          <p className="da-assign-detail__msg da-assign-detail__msg--ok">
            La alerta ya fue asignada y no permite reasignación.
          </p>
        )}

        {panelGuardiasAbierto && (
          <div className="da-assign-detail__panel">
            {cargandoGuardias && <p className="da-assign-detail__msg">Cargando guardias en servicio...</p>}
            {!cargandoGuardias && guardiasEnServicio.length === 0 && (
              <p className="da-assign-detail__msg">No hay guardias en servicio disponibles.</p>
            )}

            {!cargandoGuardias && guardiasEnServicio.length > 0 && (
              <div className="da-assign-detail__list">
                {guardiasEnServicio.map((guardia) => (
                  <button
                    key={guardia.id}
                    type="button"
                    className="da-assign-detail__guardia"
                    onClick={() => onSeleccionarGuardiaAsignacion(guardia)}
                    disabled={Boolean(asignandoGuardiaId) || asignada}
                  >
                    <span className="da-assign-detail__guardia-name">
                      {guardia.nombre || guardia.email || guardia.idUsuario || `Guardia ${guardia.id}`}
                    </span>
                    <span className="da-assign-detail__guardia-meta">ID Estado: {guardia.id}</span>
                  </button>
                ))}
              </div>
            )}

            {avisoAsignacion && (
              <p className={`da-assign-detail__msg ${avisoAsignacion.includes('asignada') ? 'da-assign-detail__msg--ok' : 'da-assign-detail__msg--error'}`}>
                {avisoAsignacion}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const seleccionarSeccion = (id) => {
    setSeccionActiva(id);
    if (!sidebarAbierto) setSidebarAbierto(true);
  };

  return (
    <div className="da-shell">

      {/* ─── SIDEBAR IZQUIERDO ─────────────────────────────────────────── */}
      <aside className={`da-sidebar ${sidebarAbierto ? 'da-sidebar--open' : 'da-sidebar--collapsed'}`}>

        <div className="da-sidebar__head">
          {sidebarAbierto && <span className="da-sidebar__logo">Admin UTA</span>}
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
              ? `${alertasActivas.length} alerta${alertasActivas.length !== 1 ? 's' : ''} activa${alertasActivas.length !== 1 ? 's' : ''}`
              : `${alertasActivas.length}`}
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
              {s.icono && <span className="da-sidebar__icono">{s.icono}</span>}
              {sidebarAbierto && <span className="da-sidebar__label">{s.label}</span>}
            </button>
          ))}
        </nav>

        <div className="da-sidebar__footer">
          <button className="da-sidebar__logout" onClick={logout} title="Cerrar sesión">
            {sidebarAbierto && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ─── CONTENIDO PRINCIPAL ───────────────────────────────────────── */}
      <main className="da-main">

        <section className={`da-mapa-section ${seccionActiva === 'mapa' ? 'da-mapa-section--full' : ''}`}>
          <div className="da-mapa-header">
            <div>
              <h1 className="da-mapa-title">Campus UTA - Monitoreo en Tiempo Real</h1>
              <p className="da-mapa-sub">Huachi, Ambato · 4 zonas monitoreadas</p>
            </div>
            {alertasActivas.length > 0 && (
              <span className="da-alerta-badge">
                {alertasActivas.length} activa{alertasActivas.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="da-mapa-wrap">
            <MapaCampus
              alertas={alertasActivas}
              zonasApi={zonasApi}
              height="100%"
              alertaFoco={alertaSeleccionada}
              alertaSeleccionada={alertaSeleccionada}
              onAlertaSeleccionadaChange={setAlertaSeleccionada}
              renderAlertaDetalle={renderDetalleAlerta}
            />

            <div className="da-alertas-float">
              <div className="da-alertas-float__head">Alertas Activas</div>
              {alertasActivas.length === 0 && (
                <p className="da-alertas-float__empty">Sin alertas activas</p>
              )}

              {alertasActivas.map((alerta) => (
                <button
                  key={alerta.id}
                  type="button"
                  className={`da-alertas-float__item ${alertaSeleccionada?.id === alerta.id ? 'da-alertas-float__item--active' : ''}`}
                  onClick={() => setAlertaSeleccionada(alerta)}
                >
                  <span className="da-alertas-float__item-id">{alerta.id}</span>
                  <span className="da-alertas-float__item-motivo">{alerta.motivo || 'Sin motivo'}</span>
                  <span className={`da-alertas-float__item-state ${estaAlertaAsignada(alerta) ? 'da-alertas-float__item-state--ok' : 'da-alertas-float__item-state--pending'}`}>
                    {estaAlertaAsignada(alerta) ? 'Asignado' : 'No Asignado'}
                  </span>
                  {estaAlertaAsignada(alerta) && nombreGuardiaAsignado(alerta) && (
                    <span className="da-alertas-float__item-assignee">Asignado a: {nombreGuardiaAsignado(alerta)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {seccionActiva !== 'mapa' && (
          <section className="da-panel-section">
            <div className="da-panel-tabs">
              {SECCIONES_MENU.filter(s => s.id !== 'mapa').map(s => (
                <button
                  key={s.id}
                  className={`da-panel-tab ${seccionActiva === s.id ? 'da-panel-tab--active' : ''}`}
                  onClick={() => setSeccionActiva(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="da-panel-content">
              {seccionActiva === 'usuarios' && <GestionUsuarios refreshSignal={usuariosRefreshKey} />}
              {seccionActiva === 'guardias' && <GuardiasEstado refreshKey={guardiaRefreshKey} />}
              {seccionActiva === 'estadisticas' && <EstadisticasPanel refreshSignal={realtimeRefreshKey} />}
              {seccionActiva === 'historial' && <HistorialIncidentes refreshSignal={realtimeRefreshKey} />}
            </div>
          </section>
        )}
      </main>

      {confirmacionAsignacion && (
        <div className="da-modal" role="dialog" aria-modal="true" aria-label="Confirmar asignación">
          <div className="da-modal__card">
            <h3 className="da-modal__title">Confirmar asignación</h3>
            <p className="da-modal__text">
              ¿Desea asignar la alerta <strong>{confirmacionAsignacion.alerta.id}</strong> al guardia
              {' '}<strong>{confirmacionAsignacion.guardia.nombre || confirmacionAsignacion.guardia.email || confirmacionAsignacion.guardia.idUsuario || confirmacionAsignacion.guardia.id}</strong>?
            </p>
            <div className="da-modal__actions">
              <button
                type="button"
                className="da-modal__btn da-modal__btn--ghost"
                onClick={() => setConfirmacionAsignacion(null)}
                disabled={Boolean(asignandoGuardiaId)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="da-modal__btn da-modal__btn--primary"
                onClick={onConfirmarAsignacion}
                disabled={Boolean(asignandoGuardiaId)}
              >
                {asignandoGuardiaId ? 'Asignando...' : 'Confirmar asignación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAdmin;