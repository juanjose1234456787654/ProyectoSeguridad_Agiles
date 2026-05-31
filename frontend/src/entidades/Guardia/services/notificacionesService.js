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

// MP3 decodificado como PCM en memoria — carga única, reproducción instantánea
let _alarmaBuffer = null;
let _alarmaBufferPromise = null;

const _cargarAlarmaBuffer = () => {
  if (_alarmaBuffer) return Promise.resolve(_alarmaBuffer);
  if (_alarmaBufferPromise) return _alarmaBufferPromise;

  _alarmaBufferPromise = (async () => {
    try {
      const ctx = await getAudioContext();
      const response = await fetch(MP3_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      _alarmaBuffer = await ctx.decodeAudioData(arrayBuffer);
      return _alarmaBuffer;
    } catch (e) {
      _alarmaBufferPromise = null; // permitir reintento
      throw e;
    }
  })();

  return _alarmaBufferPromise;
};

/**
 * Desbloquea el AudioContext durante un gesto del usuario y precarga el buffer MP3.
 */
const preinicializarAudio = async () => {
  try {
    await getAudioContext();
    await _cargarAlarmaBuffer();
  } catch { /* silencioso */ }
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
 * Reproduce Alarma.mp3 via AudioBufferSourceNode (nuevo nodo por cada llamada,
 * sin conflictos de reproducción simultánea, arranque instantáneo desde PCM).
 * Si falla, usa beeps Web Audio como fallback.
 */
const reproducirAlarma = async () => {
  try {
    const ctx = await getAudioContext();
    const buffer = await _cargarAlarmaBuffer();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (e) {
    console.warn('[notificaciones] MP3 no disponible, usando beeps:', e.message);
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
    `ALERTA DE EMERGENCIA - UTA`,
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
