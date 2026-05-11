import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import alertaService from '../services/alertaService';
import mapImage from '../assets/img/map.png';
import './AlertasUsuario.css';

const ROLES_PERMITIDOS = ['Guardia', 'Estudiante', 'Docente', 'Personal'];

const AlertasUsuario = () => {
  const { user, logout } = useAuth();

  const [motivo, setMotivo] = useState('Robo');
  const [estado, setEstado] = useState('Inactivo');
  const [ultimaAlerta, setUltimaAlerta] = useState(null);
  const [misAlertas, setMisAlertas] = useState([]);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [confianza, setConfianza] = useState(null);
  const [tipoConfianza, setTipoConfianza] = useState('persona');
  const [valorConfianza, setValorConfianza] = useState('');
  const [guardandoConfianza, setGuardandoConfianza] = useState(false);

  const getConfianzaActiva = () => {
    if (confianza?.valor) return confianza;
    if (!valorConfianza.trim()) return null;
    return {
      tipo: tipoConfianza,
      valor: valorConfianza.trim()
    };
  };

  const construirMensajeWhatsApp = (alerta) => {
    const motivoAlerta = alerta?.motivo || motivo;

    return `Motivo de Alarma: ${motivoAlerta}`;
  };

  const normalizarId = (value) => String(value || '').trim().toUpperCase();

  const filtrarAlertasDelUsuario = (alertas = []) => {
    if (!Array.isArray(alertas) || !user?.id) return [];
    const idUsuarioActual = normalizarId(user.id);
    return alertas.filter((a) => normalizarId(a?.idUsuario) === idUsuarioActual);
  };

  const cargarMisAlertas = async () => {
    if (!user?.id) {
      console.warn('user.id no esta disponible');
      return;
    }
    try {
      console.log(`Cargando alertas del usuario ${user.id}...`);
      const alertas = await alertaService.getMisAlertas();
      console.log('Alertas cargadas:', alertas);
      setMisAlertas(filtrarAlertasDelUsuario(alertas));
    } catch (e) {
      console.error('No se pudo cargar alertas:', e);
    }
  };

  useEffect(() => {
    if (!user?.rol || !ROLES_PERMITIDOS.includes(user.rol)) return;

    const cargarDatos = async () => {
      try {
        setError('');

        const confianzaData = await alertaService.getMiConfianza();

        if (confianzaData?.configurado && confianzaData.confianza) {
          setConfianza(confianzaData.confianza);
          setTipoConfianza(confianzaData.confianza.tipo || 'persona');
          setValorConfianza(confianzaData.confianza.valor || '');
        }

        // Cargar mis alertas activas
        await cargarMisAlertas();
      } catch (e) {
        setError(e?.response?.data?.message || 'No se pudo cargar configuración de confianza');
      }
    };

    cargarDatos();

    // Recargar alertas cada 10 segundos como fallback
    const intervalId = setInterval(() => {
      cargarMisAlertas();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [user?.rol, user?.id]);

  useEffect(() => {
    if (!user?.token || !user?.id) return undefined;

    const socket = alertaService.connectAlertasSocket({
      onIncidenteCreado: (payload) => {
        if (!payload) return;

        const esMiAlerta = normalizarId(payload.idUsuario) === normalizarId(user.id);
        if (esMiAlerta) {
          setUltimaAlerta(payload);
          setEstado('Activo');
          // Agregar nueva alerta a la lista solo si no existe
          setMisAlertas((prev) => {
            const soloMias = filtrarAlertasDelUsuario(prev);
            const existe = soloMias.some(a => a.id === payload.id);
            return existe ? soloMias : [...soloMias, payload];
          });
          if (confianza?.valor) {
            setNotice(`Aviso enviado en tiempo real a tu ${confianza.tipo} de confianza: ${confianza.valor}`);
          } else {
            setNotice('Alerta emitida. Configura una persona o grupo de confianza para recibir aviso inmediato.');
          }
        }

        if (user.rol === 'Guardia' && !esMiAlerta) {
          setNotice('Nueva alerta detectada en el sistema.');
        }
      },
      onIncidenteCerrado: (payload) => {
        if (!payload) return;
        // Remover alerta cerrada de la lista
        setMisAlertas((prev) => prev.filter(a => a.id !== payload.id));
        setNotice(`Alerta ${payload.id} ha sido cerrada por un guardia.`);
      }
    });

    return () => socket.disconnect();
  }, [user?.token, user?.id, user?.rol, confianza]);

  const onCrearAlerta = async () => {
    if (!motivo) {
      setError('Debes seleccionar el motivo de la alerta');
      return;
    }

    try {
      setEnviando(true);
      setError('');
      setNotice('');

      const confianzaActiva = getConfianzaActiva();

      const nueva = await alertaService.crearAlerta({
        motivo: motivo.trim(),
        idUsuario: user.id
      });

      setUltimaAlerta(nueva);
      setEstado('Activo');
      // NO agregar aquí - dejar que el socket notifique a través de incidente:creado
      // esto evita duplicación cuando el servidor emite el evento
      if (!confianzaActiva?.valor) {
        setNotice('Alerta registrada correctamente. Configura un contacto o grupo de confianza para compartirla por WhatsApp.');
      } else if (confianzaActiva.tipo === 'persona') {
        setNotice('Alerta registrada. El backend intentará enviar automáticamente el mensaje al contacto configurado.');
      } else {
        setNotice('Alerta registrada. El backend intentará enviar automáticamente el mensaje al grupo configurado.');
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo registrar la alerta');
    } finally {
      setEnviando(false);
    }
  };

  const onGuardarConfianza = async () => {
    if (!valorConfianza.trim()) {
      setError('Ingresa un contacto o nombre de grupo para guardar configuración');
      return;
    }

    try {
      setGuardandoConfianza(true);
      setError('');

      const response = await alertaService.saveMiConfianza({
        tipo: tipoConfianza,
        valor: valorConfianza.trim()
      });

      if (response?.confianza) {
        setConfianza(response.confianza);
        setNotice(response.message || 'Configuración guardada');
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo guardar configuración de confianza');
    } finally {
      setGuardandoConfianza(false);
    }
  };

  if (!user || !ROLES_PERMITIDOS.includes(user.rol)) {
    return <div className="alertas-shell"><p>No autorizado para esta interfaz.</p></div>;
  }

  return (
    <div className="alertas-shell">
      {user.rol === 'Guardia' && (
        <section className="guardia-head-card" aria-label="Imagen de cabecera de guardia">
          <img src={mapImage} alt="Mapa de referencia para guardia" className="guardia-head-image" />
        </section>
      )}

      {/* CONTENEDOR SUPERIOR: CREAR ALERTA */}
      <section className="alertas-card">
        <header className="alertas-header">
          <div>
            <h1>Bienvenido, {user.rol || 'Usuario'}</h1>
            <p>Seleccione el motivo de la alerta:</p>
          </div>
          <button type="button" className="btn-ghost" onClick={logout}>Cerrar sesión</button>
        </header>

        {error ? <p className="msg error">{error}</p> : null}
        {notice ? <p className="msg ok">{notice}</p> : null}

        <div className="form-grid">
          <label>
            Motivo de Alarma
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={enviando}
            >
              <option value="Robo">Robo</option>
              <option value="Agresión Verbal">Agresión Verbal</option>
              <option value="Agresión Física">Agresión Física</option>
            </select>
          </label>

          <label>
            Zona
              <select value="" disabled>
              <option value="">Próximamente (Mapa interactivo)</option>
            </select>
          </label>
        </div>

        <div className="center-block">
          <button
            type="button"
            className="btn-alerta"
            onClick={onCrearAlerta}
            disabled={enviando}
            aria-label="Generar alerta"
          >
            Alertar
          </button>
        </div>

        <footer className="status-row">
          <p><strong>Estado:</strong> {estado}</p>
          <p><strong>Ubicación:</strong> Campus Central (Próximamente: Mapa interactivo)</p>
        </footer>
      </section>

      {/* CONFIGURACIÓN DE CONFIANZA */}
      <section className="confianza-card">
        <h2>Configuración de Persona o Grupo de Confianza</h2>
        <p>
          Registra una persona o grupo de WhatsApp para recibir aviso inmediato cuando generes una alerta.
        </p>

        <div className="form-grid confianza-grid">
          <label>
            Tipo
            <select value={tipoConfianza} onChange={(e) => setTipoConfianza(e.target.value)}>
              <option value="persona">Persona</option>
              <option value="grupo">Grupo de WhatsApp</option>
            </select>
          </label>

          <label>
            {tipoConfianza === 'persona' ? 'Número de WhatsApp' : 'Nombre del grupo'}
            <div className="whatsapp-input-row">
              <input
                type={tipoConfianza === 'persona' ? 'tel' : 'text'}
                value={valorConfianza}
                onChange={(e) => setValorConfianza(e.target.value)}
                placeholder={tipoConfianza === 'persona' ? '+593xxxxxxxxx' : 'Ej: Familia, Amigos UTA'}
              />
            </div>
          </label>
        </div>

        <div className="panel-actions">
          <button type="button" onClick={onGuardarConfianza} disabled={guardandoConfianza}>
            {guardandoConfianza ? 'Guardando...' : 'Guardar Configuración'}
          </button>
          {confianza && (
            <span className="confianza-actual">
              Actual: {confianza.tipo === 'grupo' ? 'Grupo' : 'Persona'} — <strong>{confianza.valor}</strong>
            </span>
          )}
        </div>
      </section>

      {/* MIS ALERTAS ACTIVAS - SECCIÓN PRINCIPAL */}
      <section style={{
        background: '#fff',
        border: '2px solid #21335b',
        borderRadius: '12px',
        padding: '1.5rem',
        marginTop: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#21335b', fontSize: '1.4rem' }}>
              Mis Alertas Activas
            </h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
              {misAlertas.length === 0
                ? 'Sin alertas activas'
                : `${misAlertas.length} alerta${misAlertas.length !== 1 ? 's' : ''} activa${misAlertas.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {misAlertas.length > 0 && (
            <span style={{
              background: '#ff6b6b',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              fontSize: '0.9rem',
              fontWeight: 'bold'
            }}>
              {misAlertas.length} Activa{misAlertas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {misAlertas.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            color: '#999'
          }}>
              <p style={{ fontSize: '1rem' }}>No tienes alertas activas.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {misAlertas.map((alerta) => (
              <div
                key={alerta.id}
                style={{
                  padding: '1.2rem',
                  border: '2px solid #fbbf24',
                  borderRadius: '8px',
                  background: '#fffbeb',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#92400e' }}>
                      <strong>ID:</strong> <span style={{ fontFamily: 'monospace' }}>{alerta.id}</span>
                    </p>
                    <p style={{ margin: '0.3rem 0', fontSize: '1rem', color: '#21335b' }}>
                      <strong>Motivo:</strong> {alerta.motivo}
                    </p>
                    <p style={{ margin: '0.3rem 0', fontSize: '0.9rem', color: '#666' }}>
                      <strong>Estado:</strong> <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{alerta.estado || 'Activo'}</span>
                    </p>
                    {alerta.acciones && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#059669', background: '#ecfdf5', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid #059669' }}>
                        <strong>Acciones del guardia:</strong> {alerta.acciones}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AlertasUsuario;
