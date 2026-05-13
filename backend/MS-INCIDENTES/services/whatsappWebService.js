const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

let client = null;
let ready = false;
let initPromise = null;
let lastInitStartedAt = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isDetachedFrameError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('detached frame') ||
    message.includes('execution context was destroyed') ||
    message.includes('cannot find context with specified id') ||
    message.includes('target closed')
  );
};

const resetClient = async (reason) => {
  if (reason) {
    console.warn(`[whatsapp-web] Reiniciando cliente: ${reason}`);
  }

  ready = false;
  const currentClient = client;
  client = null;
  initPromise = null;

  if (!currentClient) return;

  try {
    await currentClient.destroy();
  } catch (error) {
    console.warn('[whatsapp-web] No se pudo destruir el cliente actual:', error.message);
  }
};

const buildClient = () => {
  const sessionPath = process.env.WHATSAPP_SESSION_PATH || path.join(__dirname, '..', '.wwebjs_auth');

  const newClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: sessionPath
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  newClient.on('qr', (qr) => {
    console.log('[whatsapp-web] Escanea este QR con la cuenta que enviará alertas:');
    qrcode.generate(qr, { small: true });
  });

  newClient.on('ready', () => {
    ready = true;
    console.log('[whatsapp-web] Cliente listo para enviar mensajes.');
  });

  newClient.on('authenticated', () => {
    console.log('[whatsapp-web] Sesión autenticada.');
  });

  newClient.on('auth_failure', (message) => {
    ready = false;
    console.error('[whatsapp-web] Falló autenticación:', message);
  });

  newClient.on('disconnected', (reason) => {
    ready = false;
    console.warn('[whatsapp-web] Sesión desconectada:', reason);
    client = null;
    initPromise = null;
  });

  return newClient;
};

const waitUntilReady = async (timeoutMs = 120000) => {
  const startedAt = Date.now();
  while (!ready) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('WhatsApp Web no quedó listo. Verifica autenticación QR y vuelve a intentar.');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

const withTimeout = async (promise, timeoutMs, message) => {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const initWhatsAppWeb = async () => {
  if (ready && client) return client;

  if (initPromise) {
    await initPromise;
    return client;
  }

  console.log('[whatsapp-web] Iniciando cliente...');
  client = buildClient();
  lastInitStartedAt = Date.now();
  const initTimeoutMs = Number(process.env.WHATSAPP_INIT_TIMEOUT_MS || 45000);

  initPromise = (async () => {
    await withTimeout(
      client.initialize(),
      initTimeoutMs,
      `WhatsApp Web no respondió durante initialize() en ${initTimeoutMs}ms`
    );
    await waitUntilReady(initTimeoutMs);
    await sleep(Number(process.env.WHATSAPP_READY_DELAY_MS || 2000));
    console.log('[whatsapp-web] Inicialización completa.');
  })();

  try {
    await initPromise;
    return client;
  } catch (error) {
    const elapsed = lastInitStartedAt ? `${Date.now() - lastInitStartedAt}ms` : 'desconocido';
    console.error(`[whatsapp-web] Falló la inicialización tras ${elapsed}:`, error.message);
    await resetClient('falló initialize()');
    throw error;
  } finally {
    lastInitStartedAt = null;
    initPromise = null;
  }
};

const withClientRetry = async (operation, options = {}) => {
  const retries = Number(options.retries ?? 2);
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const activeClient = await initWhatsAppWeb();
      return await operation(activeClient);
    } catch (error) {
      if (!isDetachedFrameError(error) || attempt === retries) {
        throw error;
      }

      attempt += 1;
      console.warn(
        `[whatsapp-web] Error transitorio detectado (${error.message}). Reintentando ${attempt}/${retries}...`
      );
      await resetClient('frame/contexto inválido durante envío');
      await sleep(1500);
    }
  }
};

const normalizePhone = (value) => {
  // Remover caracteres no numéricos
  let cleaned = String(value || '').replace(/\D/g, '');
  
  // Si comienza con 0 (formato ecuatoriano local), remover el 0
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Si no tiene código de país (593 para Ecuador), agregarlo
  if (!cleaned.startsWith('593')) {
    cleaned = '593' + cleaned;
  }
  
  console.log('[normalizePhone] Valor original:', value, '-> Normalizado:', cleaned);
  return cleaned;
};

const buildAlertMessage = (incidente) => {
  const motivo = String(incidente?.motivo || 'Sin motivo').trim();
  return `Motivo de Alarma: ${motivo}`;
};

const sendToPersonByWeb = async (phoneNumber, message) => {
  const normalized = normalizePhone(phoneNumber);

  if (!normalized) {
    throw new Error('Número de WhatsApp inválido');
  }

  const chatId = `${normalized}@c.us`;
  await withClientRetry((activeClient) => activeClient.sendMessage(chatId, message));
  return { id: chatId };
};

const sanitizeName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const sendToGroupByWeb = async (groupName, message) => {
  const requestedName = sanitizeName(groupName);
  if (!requestedName) {
    throw new Error('Nombre de grupo inválido');
  }

  return withClientRetry(async (activeClient) => {
    const chats = await activeClient.getChats();
    const groups = chats.filter((chat) => chat.isGroup);

    const exactMatch = groups.find((chat) => sanitizeName(chat.name) === requestedName);
    const partialMatch = groups.find((chat) => sanitizeName(chat.name).includes(requestedName));
    const selectedGroup = exactMatch || partialMatch;

    if (!selectedGroup) {
      throw new Error(`No se encontró un grupo de WhatsApp con el nombre: ${groupName}`);
    }

    await activeClient.sendMessage(selectedGroup.id._serialized, message);
    return {
      id: selectedGroup.id._serialized,
      name: selectedGroup.name
    };
  });
};

module.exports = {
  initWhatsAppWeb,
  buildAlertMessage,
  sendToPersonByWeb,
  sendToGroupByWeb
};
