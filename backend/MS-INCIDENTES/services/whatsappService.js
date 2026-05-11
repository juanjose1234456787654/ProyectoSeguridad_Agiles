const https = require('https');
const {
  initWhatsAppWeb,
  buildAlertMessage,
  sendToPersonByWeb,
  sendToGroupByWeb
} = require('./whatsappWebService');

const parseConfianza = (raw) => {
  if (!raw) return null;

  const [tipo, ...resto] = String(raw).split(':');
  const valor = resto.join(':').trim();

  if (!tipo || !valor) {
    return {
      tipo: 'persona',
      valor: String(raw).trim()
    };
  }

  return {
    tipo: tipo.trim().toLowerCase(),
    valor
  };
};

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const getProvider = () => String(process.env.WHATSAPP_PROVIDER || 'cloud').toLowerCase();

const postGraphMessage = ({ token, phoneNumberId, to, textBody }) => {
  const data = JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body: textBody
    }
  });

  const options = {
    hostname: 'graph.facebook.com',
    path: `/v22.0/${encodeURIComponent(phoneNumberId)}/messages`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        const status = Number(res.statusCode || 0);
        if (status >= 200 && status < 300) {
          return resolve({ ok: true, status, body: responseBody });
        }

        return reject(
          new Error(`WhatsApp API ${status}: ${responseBody || 'sin detalle'}`)
        );
      });
    });

    req.on('error', (error) => reject(error));
    req.write(data);
    req.end();
  });
};

const sendAlertToConfianza = async ({ incidente, confianzaRaw }) => {
  console.log('[sendAlertToConfianza] Iniciando envío');
  console.log('[sendAlertToConfianza] WHATSAPP_ENABLED:', process.env.WHATSAPP_ENABLED);
  console.log('[sendAlertToConfianza] WHATSAPP_PROVIDER:', process.env.WHATSAPP_PROVIDER);
  
  const enabled = String(process.env.WHATSAPP_ENABLED || 'false').toLowerCase() === 'true';
  if (!enabled) {
    console.log('[sendAlertToConfianza] WhatsApp deshabilitado');
    return { sent: false, reason: 'disabled' };
  }

  const provider = getProvider();
  console.log('[sendAlertToConfianza] Provider:', provider);

  const confianza = parseConfianza(confianzaRaw);
  console.log('[sendAlertToConfianza] Confianza parseada:', confianza);
  
  if (!confianza?.valor) {
    console.log('[sendAlertToConfianza] Sin valor en confianza');
    return { sent: false, reason: 'no-confianza' };
  }

  const textBody = buildAlertMessage(incidente);
  console.log('[sendAlertToConfianza] Mensaje a enviar:', textBody);

  if (provider === 'webjs') {
    console.log('[sendAlertToConfianza] Usando provider webjs');
    await initWhatsAppWeb();
    console.log('[sendAlertToConfianza] WhatsApp Web inicializado');

    if (confianza.tipo === 'grupo') {
      console.log('[sendAlertToConfianza] Enviando a grupo:', confianza.valor);
      const groupName = String(confianza.valor || '').trim();
      if (!groupName) {
        console.log('[sendAlertToConfianza] Nombre de grupo vacío');
        return { sent: false, reason: 'invalid-group-name' };
      }

      try {
        const groupInfo = await sendToGroupByWeb(groupName, textBody);
        console.log('[sendAlertToConfianza] Grupo encontrado y mensaje enviado:', groupInfo);
        return {
          sent: true,
          by: 'webjs',
          groupId: groupInfo?.id,
          groupName: groupInfo?.name
        };
      } catch (err) {
        console.error('[sendAlertToConfianza] Error enviando a grupo:', err.message);
        return { sent: false, reason: 'group-send-error' };
      }
    }

    console.log('[sendAlertToConfianza] Enviando a persona:', confianza.valor);
    const personNumber = normalizePhone(confianza.valor);
    console.log('[sendAlertToConfianza] Número normalizado:', personNumber);
    
    if (!personNumber) {
      console.log('[sendAlertToConfianza] Número inválido después de normalizar');
      return { sent: false, reason: 'invalid-phone' };
    }

    try {
      await sendToPersonByWeb(personNumber, textBody);
      console.log('[sendAlertToConfianza] Mensaje enviado a:', personNumber);
      return { sent: true, by: 'webjs', to: personNumber };
    } catch (err) {
      console.error('[sendAlertToConfianza] Error enviando a persona:', err.message);
      return { sent: false, reason: 'person-send-error' };
    }
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return { sent: false, reason: 'missing-config' };
  }

  if (confianza.tipo !== 'persona') {
    // La API oficial de WhatsApp no permite enviar a grupos.
    return { sent: false, reason: 'group-not-supported' };
  }

  const to = normalizePhone(confianza.valor);
  if (!to) {
    return { sent: false, reason: 'invalid-phone' };
  }

  await postGraphMessage({ token, phoneNumberId, to, textBody });
  return { sent: true, by: 'cloud', to };
};

module.exports = {
  sendAlertToConfianza
};
