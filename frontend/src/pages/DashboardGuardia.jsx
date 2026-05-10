import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import guardiaService from '../services/guardiaService';
import AlertasUsuario from './AlertasUsuario';

const DashboardGuardia = () => {
  const { user, logout } = useAuth();
  const [alertas, setAlertas] = useState([]);
  const [loadingAlertas, setLoadingAlertas] = useState(true);
  const [errorAlertas, setErrorAlertas] = useState('');
  const [avisoTiempoReal, setAvisoTiempoReal] = useState('');
  const [sidebarAbierto, setSidebarAbierto] = useState(true);

  const [idEstado, setIdEstado] = useState(null);
  const [enServicio, setEnServicio] = useState(false);
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  const idUsuarioGuardia = user?.id;

  const cargarAlertas = async () => {
    if (!idUsuarioGuardia) return;

    try {
      setLoadingAlertas(true);
      setErrorAlertas('');
      const data = await guardiaService.getIncidentesActivos();
      setAlertas(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = error?.response?.data?.message || 'No se pudo cargar alertas activas';
      setErrorAlertas(message);
    } finally {
      setLoadingAlertas(false);
    }
  };

  const cargarEstadoGuardia = async () => {
    if (!idUsuarioGuardia) return;

    try {
      const estados = await guardiaService.getEstadoGuardia(idUsuarioGuardia);
      const actual = Array.isArray(estados) ? estados[0] : null;

      if (actual) {
        setIdEstado(actual.id);
        const valor = String(actual.estado || '').toLowerCase();
        setEnServicio(valor.includes('en servicio') || valor === 'check');
      }
    } catch {
      // Si falla, mantenemos estado local en false y permitimos reintento al guardar.
    }
  };

  useEffect(() => {
    cargarEstadoGuardia();
    cargarAlertas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idUsuarioGuardia]);

  useEffect(() => {
    if (!user?.token) return undefined;

    let timerId;

    const socket = guardiaService.connectGuardiaSocket({
      onIncidenteChange: (eventName, payload) => {
        if (eventName === 'incidente:creado') {
          setAvisoTiempoReal(
            `Nueva alerta en vivo: ${payload?.id || 'SIN-ID'} - ${payload?.motivo || 'Sin motivo'}`
          );
        } else if (eventName === 'incidente:actualizado') {
          setAvisoTiempoReal(
            `Alerta actualizada: ${payload?.id || 'SIN-ID'} - Estado ${payload?.estado || 'sin cambio'}`
          );
        } else if (eventName === 'incidente:cerrado') {
          setAvisoTiempoReal(`Alerta cerrada: ${payload?.id || 'SIN-ID'}`);
        }

        window.clearTimeout(timerId);
        timerId = window.setTimeout(() => {
          setAvisoTiempoReal('');
        }, 6000);

        cargarAlertas();
      },
      onError: () => {
        // El panel sigue funcionando por API aunque falle el socket.
      }
    });

    return () => {
      window.clearTimeout(timerId);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token, idUsuarioGuardia]);

  useEffect(() => {
    if (!idUsuarioGuardia) return undefined;

    const intervalId = window.setInterval(() => {
      cargarAlertas();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idUsuarioGuardia]);

  const onToggleServicio = async () => {
    if (!idUsuarioGuardia || guardandoEstado) return;

    try {
      setGuardandoEstado(true);
      const siguiente = !enServicio;
      const response = await guardiaService.setEstadoGuardia({
        idEstado,
        enServicio: siguiente,
        idUsuario: idUsuarioGuardia
      });

      setEnServicio(siguiente);
      if (!idEstado && response?.id) {
        setIdEstado(response.id);
      }
    } finally {
      setGuardandoEstado(false);
    }
  };

  const resumen = useMemo(
    () => {
      return { activas: alertas.length, lista: alertas };
    },
    [alertas]
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* SIDEBAR IZQUIERDO - ALERTAS */}
      <aside
        style={{
          width: sidebarAbierto ? '380px' : '0',
          background: '#fff',
          borderRight: '1px solid #ddd',
          overflow: 'hidden',
          transition: 'width 0.3s ease',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            padding: '1.2rem',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#21335b' }}>
                Alertas de Usuarios
              </h2>
            </div>
          <button
            onClick={() => setSidebarAbierto(false)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#666',
              padding: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1rem', overflow: 'auto', flex: 1 }}>
          {loadingAlertas && <p style={{ textAlign: 'center', color: '#999' }}>Cargando...</p>}
          {errorAlertas && <p style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{errorAlertas}</p>}

          {!loadingAlertas && resumen.activas === 0 && (
            <p style={{ textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
              No hay alertas activas
            </p>
          )}

          {resumen.lista.map((alerta) => (
            <div
              key={alerta.id}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '0.9rem',
                marginBottom: '0.75rem',
                background: '#fafafa',
                cursor: 'pointer',
                transition: 'all 0.2s',
                ':hover': { background: '#f0f0f0' }
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fafafa')}
            >
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#21335b', fontSize: '0.95rem' }}>
                {alerta.id}
              </h4>
              <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#555' }}>
                <strong>Motivo:</strong> {alerta.motivo}
              </p>
              <p style={{ margin: '0.3rem 0', fontSize: '0.85rem', color: '#555' }}>
                <strong>Reportó:</strong> {alerta.emailUsuario || alerta.idUsuario || 'Sin dato'}
              </p>
              <Link to={`/guardia/cerrar/${alerta.id}`} style={{ textDecoration: 'none' }}>
                <button
                  style={{
                    width: '100%',
                    marginTop: '0.6rem',
                    padding: '0.45rem',
                    background: '#21335b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '600'
                  }}
                >
                  Cerrar
                </button>
              </Link>
            </div>
          ))}
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid #ddd', textAlign: 'center', fontSize: '0.85rem', color: '#999' }}>
            <div style={{ fontWeight: 'bold', color: '#21335b', marginBottom: '0.3rem' }}>
              Incidentes activos en BD: {resumen.activas}
            </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {/* HEADER CON CONTROLES */}
        <div style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 100 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {!sidebarAbierto && (
                <button
                  onClick={() => setSidebarAbierto(true)}
                  style={{
                    background: '#21335b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.6rem 1rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                  }}
                >
                  Incidentes Activos
                </button>
              )}
              <h1 style={{ margin: 0, fontSize: '1.3rem' }}>Panel de Guardia</h1>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={enServicio} onChange={onToggleServicio} disabled={guardandoEstado} />
                <span style={{ fontSize: '0.9rem' }}>
                  {guardandoEstado ? 'Guardando...' : enServicio ? 'En Servicio' : 'No en Servicio'}
                </span>
              </label>
              <button onClick={logout} style={{ padding: '0.6rem 1rem', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Salir
              </button>
            </div>
          </header>
        </div>

        {/* NOTIFICACIÓN EN TIEMPO REAL */}
        {avisoTiempoReal && (
          <div
            style={{
              padding: '0.8rem 1.5rem',
              borderBottom: '2px solid #fde68a',
              background: '#fffbeb',
              color: '#92400e',
              fontWeight: 700,
              fontSize: '0.95rem'
            }}
          >
            {avisoTiempoReal}
          </div>
        )}

        {/* ALERTAS USUARIO COMPONENT */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          <AlertasUsuario />
        </div>
      </main>
    </div>
  );
};

export default DashboardGuardia;