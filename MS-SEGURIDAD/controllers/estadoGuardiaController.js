const EstadoGuardia = require('../models/EstadoGuardia');

// GET /api/seguridad/guardias
const getAll = async (req, res) => {
  try {
    const guardias = await EstadoGuardia.findAll();
    res.json(guardias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener estados de guardias' });
  }
};

// GET /api/seguridad/guardias/:id
const getById = async (req, res) => {
  try {
    const guardia = await EstadoGuardia.findById(req.params.id);
    if (!guardia) {
      return res.status(404).json({ message: 'Estado de guardia no encontrado' });
    }
    res.json(guardia);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el estado de guardia' });
  }
};

// GET /api/seguridad/guardias/usuario/:idUsuario
const getByUsuario = async (req, res) => {
  try {
    const registros = await EstadoGuardia.findByUsuario(req.params.idUsuario);
    res.json(registros);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener estados del usuario' });
  }
};

// POST /api/seguridad/guardias
const create = async (req, res) => {
  try {
    const { estado, horario, idUsuario } = req.body;

    if (!estado || !horario || !idUsuario) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: estado, horario, idUsuario' });
    }

    const nuevo = await EstadoGuardia.create({ estado, horario, idUsuario });
    res.status(201).json(nuevo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar estado de guardia' });
  }
};

// PUT /api/seguridad/guardias/:id
const update = async (req, res) => {
  try {
    const existente = await EstadoGuardia.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ message: 'Estado de guardia no encontrado' });
    }

    const { estado, horario, idUsuario } = req.body;

    if (!estado || !horario || !idUsuario) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: estado, horario, idUsuario' });
    }

    const actualizado = await EstadoGuardia.update(req.params.id, { estado, horario, idUsuario });
    res.json(actualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar estado de guardia' });
  }
};

// DELETE /api/seguridad/guardias/:id
const remove = async (req, res) => {
  try {
    const existente = await EstadoGuardia.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ message: 'Estado de guardia no encontrado' });
    }

    await EstadoGuardia.delete(req.params.id);
    res.json({ message: 'Estado de guardia eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar estado de guardia' });
  }
};

module.exports = { getAll, getById, getByUsuario, create, update, remove };
