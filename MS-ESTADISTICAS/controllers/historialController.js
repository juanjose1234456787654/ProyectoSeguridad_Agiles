const Historial = require('../models/Historial');

const normalizeDatosJson = (datosJson) => {
  if (datosJson === undefined || datosJson === null) return null;
  if (typeof datosJson === 'string') return datosJson;

  try {
    return JSON.stringify(datosJson);
  } catch {
    return null;
  }
};

const getAll = async (req, res) => {
  try {
    const historial = await Historial.findAll();
    res.json(historial);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener historial' });
  }
};

const getById = async (req, res) => {
  try {
    const registro = await Historial.findById(req.params.id);
    if (!registro) {
      return res.status(404).json({ message: 'Registro de historial no encontrado' });
    }
    res.json(registro);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el registro' });
  }
};

const create = async (req, res) => {
  try {
    const { fechaInicio, fechaCierre, resultadoGuardia, idAsignacion, datosJson } = req.body;

    if (!fechaInicio || !resultadoGuardia || !idAsignacion) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: fechaInicio, resultadoGuardia, idAsignacion' });
    }

    const nuevo = await Historial.create({
      fechaInicio,
      fechaCierre: fechaCierre || null,
      resultadoGuardia,
      idAsignacion,
      datosJson: normalizeDatosJson(datosJson)
    });

    res.status(201).json(nuevo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear historial' });
  }
};

const update = async (req, res) => {
  try {
    const existente = await Historial.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ message: 'Registro de historial no encontrado' });
    }

    const { fechaInicio, fechaCierre, resultadoGuardia, idAsignacion, datosJson } = req.body;

    if (!fechaInicio || !resultadoGuardia || !idAsignacion) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: fechaInicio, resultadoGuardia, idAsignacion' });
    }

    const actualizado = await Historial.update(req.params.id, {
      fechaInicio,
      fechaCierre: fechaCierre || null,
      resultadoGuardia,
      idAsignacion,
      datosJson: normalizeDatosJson(datosJson)
    });

    res.json(actualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar historial' });
  }
};

const remove = async (req, res) => {
  try {
    const existente = await Historial.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ message: 'Registro de historial no encontrado' });
    }

    await Historial.delete(req.params.id);
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar historial' });
  }
};

module.exports = { getAll, getById, create, update, remove };
