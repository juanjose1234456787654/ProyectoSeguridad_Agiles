const AsignacionAlerta = require('../models/AsignacionAlerta');

// GET /api/seguridad/alertas
const getAll = async (req, res) => {
  try {
    const asignaciones = await AsignacionAlerta.findAll();
    res.json(asignaciones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener asignaciones de alertas' });
  }
};

// GET /api/seguridad/alertas/:id
const getById = async (req, res) => {
  try {
    const asignacion = await AsignacionAlerta.findById(req.params.id);
    if (!asignacion) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }
    res.json(asignacion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener la asignación' });
  }
};

// GET /api/seguridad/alertas/guardia/:idUsuario/activas
const getActivasByGuardia = async (req, res) => {
  try {
    const asignaciones = await AsignacionAlerta.findActivasByGuardiaUsuario(req.params.idUsuario);
    res.json(asignaciones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener alertas activas del guardia' });
  }
};

// POST /api/seguridad/alertas
const create = async (req, res) => {
  try {
    const { idIncidente, idEstadoGuardia } = req.body;

    if (!idIncidente || !idEstadoGuardia) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: idIncidente, idEstadoGuardia' });
    }

    const nueva = await AsignacionAlerta.create({ idIncidente, idEstadoGuardia });
    res.status(201).json(nueva);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear la asignación de alerta' });
  }
};

// DELETE /api/seguridad/alertas/:id
const remove = async (req, res) => {
  try {
    const existente = await AsignacionAlerta.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }

    await AsignacionAlerta.delete(req.params.id);
    res.json({ message: 'Asignación eliminada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar la asignación' });
  }
};

module.exports = { getAll, getById, getActivasByGuardia, create, remove };
