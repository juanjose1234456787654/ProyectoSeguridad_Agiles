const nodemailer = require('nodemailer');
const Contacto = require('../models/Contacto');
const Grupo = require('../models/Grupo');

// ─── Configuración del transporte de correo ───────────────────────────────────

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const SMTP_CONFIGURED = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

/**
 * Envía un correo de alerta a un destinatario.
 * Retorna { correo, enviado, error? }
 */
const enviarCorreo = async (transporter, { destinatario, nombreEmisor, mensaje }) => {
  try {
    await transporter.sendMail({
      from: `"Sistema UTA Seguridad" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: destinatario,
      subject: '⚠️ ALERTA DE EMERGENCIA – UTA Campus',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:2px solid #e53e3e;border-radius:8px;padding:24px;">
          <h2 style="color:#e53e3e;margin-top:0;">⚠️ Alerta de Emergencia</h2>
          <p><strong>${nombreEmisor}</strong> ha activado una alerta de emergencia en el campus de la
          <strong>Universidad Técnica de Ambato</strong>.</p>
          ${mensaje ? `<p><em>"${mensaje}"</em></p>` : ''}
          <p>Por favor, contacte con las autoridades de seguridad o diríjase al campus de inmediato.</p>
          <hr style="border-color:#e53e3e;"/>
          <p style="font-size:12px;color:#718096;">
            Este mensaje fue generado automáticamente por el Sistema de Gestión de Seguridad UTA.
            No responda a este correo.
          </p>
        </div>
      `
    });
    return { correo: destinatario, enviado: true };
  } catch (err) {
    console.error(`[alerta] Error enviando a ${destinatario}:`, err.message);
    return { correo: destinatario, enviado: false, error: err.message };
  }
};

// POST /api/contactos/alertar
const alertar = async (req, res) => {
  try {
    const idUsuario = String(req.usuario?.id || '').trim();
    const nombreEmisor = String(req.usuario?.nombre || req.usuario?.email || idUsuario);
    const { mensaje } = req.body;

    // 1. Recolectar todos los contactos (individuales + grupos) en paralelo
    const [contactosInd, contactosGrupo] = await Promise.all([
      Contacto.findCorreosIndividuales(idUsuario),
      Grupo.findCorreosGrupos(idUsuario)
    ]);

    // 2. Combinar y deduplicar correos
    const mapaDestinatarios = new Map();

    for (const c of contactosInd) {
      mapaDestinatarios.set(c.correo, { correo: c.correo, origen: `Individual (${c.alias || 'sin alias'})` });
    }
    for (const c of contactosGrupo) {
      if (!mapaDestinatarios.has(c.correo)) {
        mapaDestinatarios.set(c.correo, { correo: c.correo, origen: `Grupo "${c.grupo}"` });
      }
    }

    const destinatarios = [...mapaDestinatarios.values()];

    if (destinatarios.length === 0) {
      return res.status(422).json({
        message: 'No tienes contactos de confianza configurados. Agrega al menos un contacto individual o un grupo antes de activar la alerta.',
        enviados: 0,
        fallidos: 0,
        resultados: []
      });
    }

    // 3. Envío simultáneo
    let resultados;

    if (SMTP_CONFIGURED) {
      const transporter = createTransporter();
      resultados = await Promise.all(
        destinatarios.map(({ correo }) =>
          enviarCorreo(transporter, { destinatario: correo, nombreEmisor, mensaje })
        )
      );
    } else {
      // SMTP no configurado: simular el envío (útil en desarrollo)
      console.warn('[alerta] SMTP no configurado. Simulando envío a:', destinatarios.map((d) => d.correo));
      resultados = destinatarios.map(({ correo }) => ({ correo, enviado: true, simulado: true }));
    }

    const enviados = resultados.filter((r) => r.enviado).length;
    const fallidos = resultados.filter((r) => !r.enviado).length;

    res.json({
      message: `Alerta enviada a ${enviados} contacto(s) de confianza.`,
      enviados,
      fallidos,
      resultados
    });
  } catch (error) {
    console.error('[alertar]', error.message);
    res.status(500).json({ message: 'Error al procesar el envío de la alerta' });
  }
};

module.exports = { alertar };
