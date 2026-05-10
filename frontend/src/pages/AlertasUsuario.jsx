import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import alertaService from '../services/alertaService';
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

  const filtrarAlertasDelUsuario = (alertas = []) => {
    if (!Array.isArray(alertas) || !user?.id) return [];
    return alertas.filter((a) => String(a?.idUsuario) === String(user.id));
  };

  const cargarMisAlertas = async () => {
    if (!user?.id) {
      console.warn('user.id no esta disponible');
      return;
    }
    try {
      console.log(`Cargando alertas del usuario ${user.id}...`);
      const alertas = await alertaService.getMisAlertas(user.id);
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

        const esMiAlerta = String(payload.idUsuario) === String(user.id);
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

      const nueva = await alertaService.crearAlerta({
        motivo: motivo.trim(),
        idUsuario: user.id
      });

      setUltimaAlerta(nueva);
      setEstado('Activo');
      // NO agregar aquí - dejar que el socket notifique a través de incidente:creado
      // esto evita duplicación cuando el servidor emite el evento
      setNotice('Alerta registrada correctamente.');
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

  const abrirWhatsApp = () => {
    if (tipoConfianza === 'persona' && valorConfianza.trim()) {
      const num = valorConfianza.replace(/\D/g, '');
      window.open(`https://wa.me/${num}`, '_blank', 'noopener,noreferrer');
    } else {
      window.open('https://wa.me/', '_blank', 'noopener,noreferrer');
    }
  };

  if (!user || !ROLES_PERMITIDOS.includes(user.rol)) {
    return <div className="alertas-shell"><p>No autorizado para esta interfaz.</p></div>;
  }

  return (
    <div className="alertas-shell">
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
              <button type="button" className="btn-whatsapp" onClick={abrirWhatsApp} title="Abrir WhatsApp">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Abrir WhatsApp
              </button>
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
                  alignItems: 'flex-start',
                  gap: '1rem'
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
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: '#fed7aa',
                    fontSize: '1.5rem'
                  }}>
                    Aviso
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
