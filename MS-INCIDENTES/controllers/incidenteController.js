const Incidente = require('../models/Incidente');

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
    const { motivo, estado, idZona, idUsuario } = req.body;

    if (!motivo || !idZona || !idUsuario) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: motivo, idZona, idUsuario' });
    }

    const nuevo = await Incidente.create({ motivo, estado, idZona, idUsuario });
    res.status(201).json(nuevo);
  } catch (error) {
    console.error(error);
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

    const { motivo, estado, idZona, idUsuario } = req.body;

    if (!motivo || !idZona || !idUsuario) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: motivo, idZona, idUsuario' });
    }

    const actualizado = await Incidente.update(req.params.id, { motivo, estado, idZona, idUsuario });
    res.json(actualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el incidente' });
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

module.exports = { getAll, getById, create, update, remove };
