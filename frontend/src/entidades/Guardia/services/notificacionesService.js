/**
 * notificacionesService.js
 * T3.2 / T3.4 – Notificaciones push (Browser Notifications API) + alertas sonoras (Web Audio API)
 * HU-4: Notificaciones Push/Sonoras en tiempo real
 */

// ─── Permisos de notificación del navegador ───────────────────────────────────

const isSupported = () => 'Notification' in window;

const getPermission = () => (isSupported() ? Notification.permission : 'denied');

/**
 * Solicita permiso para mostrar notificaciones.
 * Retorna: 'granted' | 'denied' | 'default' | 'unsupported'
 */
const requestPermission = async () => {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return 'denied';
  }
};

/**
 * Muestra una notificación del sistema operativo (funciona con la pestaña en segundo plano).
 * @param {string} titulo
 * @param {string} cuerpo
 * @param {Function} [onClick]
 */
const mostrarNotificacionOS = (titulo, cuerpo, onClick) => {
  if (!isSupported() || Notification.permission !== 'granted') return null;

  const notif = new Notification(titulo, {
    body: cuerpo,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'alerta-uta-emergencia',
    requireInteraction: true,    // permanece hasta que el usuario la cierre
    vibrate: [200, 100, 200]     // patrón de vibración en móviles
  });

  if (onClick) {
    notif.onclick = (e) => {
      e.preventDefault();
      window.focus();
      notif.close();
      onClick();
    };
  }

  return notif;
};

// ─── Alerta sonora ────────────────────────────────────────────────────────────

const MP3_URL = '/Alarma.mp3';

// Instancia única reutilizable — se desbloquea en el primer gesto del usuario
let _alarmaAudio = null;

const _getAlarmaAudio = () => {
  if (!_alarmaAudio) {
    _alarmaAudio = new Audio(MP3_URL);
    _alarmaAudio.preload = 'auto';
    _alarmaAudio.volume = 1.0;
  }
  return _alarmaAudio;
};

let _audioCtx = null;

const getAudioContext = async () => {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') {
    await _audioCtx.resume();
  }
  return _audioCtx;
};

/**
 * Desbloquea el elemento Audio y el AudioContext durante un gesto del usuario.
 * Técnica: play() + pause() inmediato — el navegador marca el elemento como
 * "desbloqueado" y los .play() posteriores (desde WebSocket) funcionan sin restricción.
 */
const preinicializarAudio = async () => {
  try {
    const audio = _getAlarmaAudio();
    const p = audio.play();
    if (p !== undefined) {
      await p;
      audio.pause();
      audio.currentTime = 0;
    }
  } catch {
    // El MP3 puede no estar aún cargado; el desbloqueo igual queda registrado
  }
  // También calentar AudioContext (fallback)
  try { await getAudioContext(); } catch { /* silencioso */ }
};

/**
 * Fallback: beeps generados por Web Audio API (sin archivo externo).
 */
const _reproducirBeeps = async () => {
  const ctx = await getAudioContext();
  const ahora = ctx.currentTime;

  const pulsos = [
    { freq: 1000, inicio: 0,    duracion: 0.18 },
    { freq: 800,  inicio: 0.22, duracion: 0.18 },
    { freq: 1000, inicio: 0.44, duracion: 0.18 },
    { freq: 800,  inicio: 0.66, duracion: 0.18 },
    { freq: 1000, inicio: 0.88, duracion: 0.18 },
    { freq: 600,  inicio: 1.1,  duracion: 0.35 }
  ];

  pulsos.forEach(({ freq, inicio, duracion }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ahora + inicio);
    gain.gain.setValueAtTime(0, ahora + inicio);
    gain.gain.linearRampToValueAtTime(0.45, ahora + inicio + 0.01);
    gain.gain.setValueAtTime(0.45, ahora + inicio + duracion - 0.02);
    gain.gain.linearRampToValueAtTime(0, ahora + inicio + duracion);
    osc.start(ahora + inicio);
    osc.stop(ahora + inicio + duracion + 0.05);
  });
};

/**
 * Reproduce Alarma.mp3 usando la instancia pre-desbloqueada.
 * Si falla, usa beeps Web Audio como fallback.
 */
const reproducirAlarma = async () => {
  try {
    const audio = _getAlarmaAudio();
    audio.currentTime = 0; // rebobinar si ya sonó antes
    await audio.play();
  } catch (e) {
    console.warn('[notificaciones] MP3 bloqueado, usando beeps:', e.message);
    try {
      await _reproducirBeeps();
    } catch (e2) {
      console.warn('[notificaciones] Sin sonido disponible:', e2.message);
    }
  }
};

// ─── Función unificada de notificación ───────────────────────────────────────

/**
 * Dispara una notificación completa: sonido + notificación del SO.
 * @param {{ nombreEmisor, emailEmisor, motivo, nombreZona, idIncidente }} datos
 * @param {Function} [onClickOS] - callback al hacer clic en la notificación OS
 */
const notificar = (datos, onClickOS) => {
  const { nombreEmisor, emailEmisor, motivo, nombreZona } = datos;

  const emisor = nombreEmisor || emailEmisor || 'Usuario UTA';
  const zona = nombreZona ? ` | Zona: ${nombreZona}` : '';

  reproducirAlarma(); // async — se ejecuta sin bloquear
  mostrarNotificacionOS(
    `🚨 ALERTA DE EMERGENCIA – UTA`,
    `De: ${emisor} | Motivo: ${motivo}${zona}`,
    onClickOS
  );
};

export default {
  isSupported,
  getPermission,
  requestPermission,
  mostrarNotificacionOS,
  reproducirAlarma,
  preinicializarAudio,
  notificar
};
