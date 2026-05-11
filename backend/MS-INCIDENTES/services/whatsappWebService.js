const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

let client = null;
let ready = false;
let initPromise = null;

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

const initWhatsAppWeb = async () => {
  if (ready && client) return client;

  if (initPromise) {
    await initPromise;
    return client;
  }

  client = buildClient();

  initPromise = (async () => {
    await client.initialize();
    await waitUntilReady();
  })();

  try {
    await initPromise;
    return client;
  } finally {
    initPromise = null;
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
  await initWhatsAppWeb();
  const normalized = normalizePhone(phoneNumber);

  if (!normalized) {
    throw new Error('Número de WhatsApp inválido');
  }

  const chatId = `${normalized}@c.us`;
  await client.sendMessage(chatId, message);
  return { id: chatId };
};

const sanitizeName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const sendToGroupByWeb = async (groupName, message) => {
  await initWhatsAppWeb();

  const requestedName = sanitizeName(groupName);
  if (!requestedName) {
    throw new Error('Nombre de grupo inválido');
  }

  const chats = await client.getChats();
  const groups = chats.filter((chat) => chat.isGroup);

  const exactMatch = groups.find((chat) => sanitizeName(chat.name) === requestedName);
  const partialMatch = groups.find((chat) => sanitizeName(chat.name).includes(requestedName));
  const selectedGroup = exactMatch || partialMatch;

  if (!selectedGroup) {
    throw new Error(`No se encontró un grupo de WhatsApp con el nombre: ${groupName}`);
  }

  await client.sendMessage(selectedGroup.id._serialized, message);
  return {
    id: selectedGroup.id._serialized,
    name: selectedGroup.name
  };
};

module.exports = {
  initWhatsAppWeb,
  buildAlertMessage,
  sendToPersonByWeb,
  sendToGroupByWeb
};
