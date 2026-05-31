import { useEffect, useRef, useState } from 'react';
import '../styles/NotificacionToast.css';

const DURACION_MS = 9000; // tiempo visible

/**
 * NotificacionToast
 * Muestra una tarjeta flotante animada cuando llega una alerta de emergencia.
 *
 * Props:
 *  - notificacion: { id, nombreEmisor, emailEmisor, motivo, nombreZona, timestamp }
 *  - onDismiss: () => void
 */
const NotificacionToast = ({ notificacion, onDismiss }) => {
  const [progreso, setProgreso] = useState(100); // 100 → 0 en DURACION_MS
  const [saliendo, setSaliendo] = useState(false);
  const intervaloRef = useRef(null);
  const inicioRef = useRef(Date.now());

  useEffect(() => {
    inicioRef.current = Date.now();
    intervaloRef.current = setInterval(() => {
      const transcurrido = Date.now() - inicioRef.current;
      const restante = Math.max(0, 100 - (transcurrido / DURACION_MS) * 100);
      setProgreso(restante);

      if (restante === 0) {
        clearInterval(intervaloRef.current);
        cerrar();
      }
    }, 80);

    return () => clearInterval(intervaloRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cerrar = () => {
    setSaliendo(true);
    setTimeout(() => onDismiss?.(), 380); // tiempo de animación de salida
  };

  if (!notificacion) return null;

  const {
    nombreEmisor,
    emailEmisor,
    motivo = 'Sin motivo especificado',
    nombreZona,
    timestamp
  } = notificacion;

  const emisor = nombreEmisor || emailEmisor || 'Usuario UTA';
  const hora = timestamp
    ? new Date(timestamp).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`nt-toast ${saliendo ? 'nt-toast--saliendo' : 'nt-toast--entrando'}`} role="alert" aria-live="assertive">
      {/* Barra de progreso */}
      <div className="nt-barra" style={{ width: `${progreso}%` }} />

      {/* Cabecera */}
      <div className="nt-cabecera">
        <strong className="nt-titulo">ALERTA DE EMERGENCIA</strong>
        <button
          type="button"
          className="nt-cerrar"
          onClick={cerrar}
          aria-label="Cerrar notificación"
        >
          ×
        </button>
      </div>

      {/* Cuerpo */}
      <div className="nt-cuerpo">
        <p className="nt-fila">
          <span className="nt-etiqueta">De:</span>
          <span className="nt-valor">{emisor}</span>
        </p>
        <p className="nt-fila">
          <span className="nt-etiqueta">Motivo:</span>
          <span className="nt-valor nt-motivo">{motivo}</span>
        </p>
        {nombreZona && (
          <p className="nt-fila">
            <span className="nt-etiqueta">Zona:</span>
            <span className="nt-valor">{nombreZona}</span>
          </p>
        )}
        <p className="nt-hora">{hora}</p>
      </div>
    </div>
  );
};

/**
 * NotificacionesContainer
 * Gestiona la cola de toasts. Se monta una sola vez en AlertasUsuario.
 *
 * Props:
 *  - notificaciones: Array<{ id, ... }>
 *  - onDismiss: (id) => void
 */
export const NotificacionesContainer = ({ notificaciones = [], onDismiss }) => {
  if (notificaciones.length === 0) return null;

  return (
    <div className="nt-container" aria-label="Notificaciones de alerta">
      {notificaciones.map((n) => (
        <NotificacionToast
          key={n.id}
          notificacion={n}
          onDismiss={() => onDismiss(n.id)}
        />
      ))}
    </div>
  );
};

export default NotificacionToast;
