const Usuario = require('../models/Usuario');

const MAX_LEN = 100;

const normalizePayload = (body = {}) => {
  const tipo = String(body.tipo || '').trim().toLowerCase();
  const valor = String(body.valor || '').trim();

  if (!tipo || !valor) {
    return { error: 'Debes enviar tipo y valor para la configuración de confianza' };
  }

  if (!['persona', 'grupo'].includes(tipo)) {
    return { error: "El tipo debe ser 'persona' o 'grupo'" };
  }

  const serializado = `${tipo}:${valor}`;
  if (serializado.length > MAX_LEN) {
    return { error: `La configuración excede el máximo de ${MAX_LEN} caracteres` };
  }

  return { tipo, valor, serializado };
};

const parseConfianza = (raw) => {
  if (!raw) return null;

  const [tipo, ...resto] = String(raw).split(':');
  const valor = resto.join(':').trim();
  if (!tipo || !valor) {
    return { tipo: 'persona', valor: String(raw) };
  }

  return {
    tipo: tipo.trim().toLowerCase(),
    valor
  };
};

const getMiConfianza = async (req, res) => {
  try {
    if (!req.usuario?.id) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const raw = await Usuario.getConfianzaByUserId(req.usuario.id);

    return res.json({
      configurado: Boolean(raw),
      confianza: parseConfianza(raw)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error al obtener configuración de confianza' });
  }
};

const saveMiConfianza = async (req, res) => {
  try {
    if (!req.usuario?.id) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    if (req.usuario.rol === 'Administrador') {
      return res.status(403).json({ message: 'Administrador no requiere configuración de alertas personales' });
    }

    const parsed = normalizePayload(req.body);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const anterior = await Usuario.getConfianzaByUserId(req.usuario.id);
    const updated = await Usuario.updateConfianzaByUserId(req.usuario.id, parsed.serializado);

    return res.json({
      message: anterior ? 'Configuración de confianza actualizada' : 'Configuración de confianza registrada',
      configurado: Boolean(updated),
      confianza: parseConfianza(updated)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error al guardar configuración de confianza' });
  }
};

module.exports = {
  getMiConfianza,
  saveMiConfianza
};
