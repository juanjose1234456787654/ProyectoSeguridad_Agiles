const Incidente = require('../models/Incidente');

const emitRealtime = (req, eventName, payload) => {
  const io = req.app.get('io');
  if (io) {
    io.emit(eventName, payload);
  }
};

// GET /api/incidentes
const getAll = async (req, res) => {
  try {
    const incidentes = await Incidente.findAll();
    res.json(incidentes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener incidentes' });
  }
};

// GET /api/incidentes/activos
const getActivos = async (req, res) => {
  try {
    const incidentes = await Incidente.findActivos();
    res.json(incidentes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener incidentes activos' });
  }
};

// GET /api/incidentes/usuario/:idUsuario
const getByUsuario = async (req, res) => {
  try {
    const idUsuarioToken = String(req.usuario?.id || '').trim();
    const idUsuarioParam = String(req.params.idUsuario || '').trim();

    if (!idUsuarioToken) {
      return res.status(401).json({ message: 'Token inválido: no se pudo identificar al usuario' });
    }

    if (idUsuarioParam && idUsuarioParam !== idUsuarioToken) {
      console.warn(
        `[getByUsuario] Param (${idUsuarioParam}) distinto a token (${idUsuarioToken}). Se usa token.`
      );
    }

    console.log(`[getByUsuario] Buscando alertas del usuario autenticado: ${idUsuarioToken}`);
    
    const incidentes = await Incidente.findByUsuario(idUsuarioToken);
    
    console.log(`[getByUsuario] Se encontraron ${incidentes.length} alertas`);
    res.json(incidentes);
  } catch (error) {
    console.error('[getByUsuario] Error:', error);
    res.status(500).json({ message: 'Error al obtener incidentes del usuario' });
  }
};

// GET /api/incidentes/:id
const getById = async (req, res) => {
  try {
    const incidente = await Incidente.findById(req.params.id);
    if (!incidente) {
      return res.status(404).json({ message: 'Incidente no encontrado' });
    }
    res.json(incidente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el incidente' });
  }
};

// POST /api/incidentes
const create = async (req, res) => {
  try {
    const { motivo, estado, idZona } = req.body;
    let idUsuario = req.usuario?.id || req.body.idUsuario;
    
    // Asegurar que idUsuario sea string y sin espacios
    idUsuario = String(idUsuario).trim();

    console.log(`[create] Creando incidente - idUsuario: "${idUsuario}" (length: ${idUsuario.length}, type: ${typeof idUsuario})`);
    console.log(`[create] motivo: "${motivo}", estado: "${estado}", idZona: "${idZona}"`);

    if (!motivo || !idUsuario) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: motivo' });
    }

    const nuevo = await Incidente.create({ motivo, estado, idZona, idUsuario });
    
    console.log(`[create] Incidente creado: ${nuevo.id} para usuario: "${nuevo.idUsuario}"`);
    
    emitRealtime(req, 'incidente:creado', nuevo);
    res.status(201).json(nuevo);
  } catch (error) {
    console.error(`[create] Error:`, error);
    res.status(500).json({ message: 'Error al crear el incidente' });
  }
};

// PUT /api/incidentes/:id
const update = async (req, res) => {
  try {
    const existente = await Incidente.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ message: 'Incidente no encontrado' });
    }

    const { motivo, estado, idZona } = req.body;
    const idUsuario = req.body.idUsuario || existente.idUsuario;
    const zonaFinal = idZona ?? existente.idZona ?? null;

    if (!motivo || !idUsuario) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: motivo, idUsuario' });
    }

    const actualizado = await Incidente.update(req.params.id, {
      motivo,
      estado,
      idZona: zonaFinal,
      idUsuario
    });
    emitRealtime(req, 'incidente:actualizado', actualizado);
    res.json(actualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el incidente' });
  }
};

// PATCH /api/incidentes/:id/cerrar
const close = async (req, res) => {
  try {
    const existente = await Incidente.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ message: 'Incidente no encontrado' });
    }

    if (existente.estado === 'Cerrado') {
      return res.status(400).json({ message: 'El incidente ya está cerrado' });
    }

    const { acciones } = req.body || {};
    const cerrado = await Incidente.close(req.params.id, acciones || null);
    emitRealtime(req, 'incidente:cerrado', cerrado);
    res.json(cerrado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al cerrar el incidente' });
  }
};

// DELETE /api/incidentes/:id
const remove = async (req, res) => {
  try {
    const existente = await Incidente.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ message: 'Incidente no encontrado' });
    }

    await Incidente.delete(req.params.id);
    res.json({ message: 'Incidente eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar el incidente' });
  }
};

module.exports = { getAll, getActivos, getByUsuario, getById, create, update, close, remove };
