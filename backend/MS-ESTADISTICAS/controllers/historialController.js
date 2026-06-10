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

const PERIODOS_VALIDOS = new Set(['dia', 'semana', 'mes', 'anio']);

const normalizarPeriodo = (periodo) => {
  const valor = String(periodo || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return PERIODOS_VALIDOS.has(valor) ? valor : 'mes';
};

const calcularRango = (periodo) => {
  const ahora = new Date();
  const inicio = new Date(ahora);
  const fin = new Date(ahora);

  if (periodo === 'dia') {
    inicio.setHours(0, 0, 0, 0);
    fin.setHours(23, 59, 59, 999);
    return { inicio, fin };
  }

  if (periodo === 'semana') {
    const dia = ahora.getDay();
    const ajuste = dia === 0 ? -6 : 1 - dia;
    inicio.setDate(ahora.getDate() + ajuste);
    inicio.setHours(0, 0, 0, 0);
    fin.setTime(inicio.getTime());
    fin.setDate(inicio.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    return { inicio, fin };
  }

  if (periodo === 'anio') {
    inicio.setMonth(0, 1);
    inicio.setHours(0, 0, 0, 0);
    fin.setMonth(11, 31);
    fin.setHours(23, 59, 59, 999);
    return { inicio, fin };
  }

  inicio.setDate(1);
  inicio.setHours(0, 0, 0, 0);
  fin.setMonth(inicio.getMonth() + 1, 0);
  fin.setHours(23, 59, 59, 999);
  return { inicio, fin };
};

const parseDateParam = (value, endOfDay = false) => {
  if (!value) return null;
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getAll = async (req, res) => {
  try {
    const periodo = normalizarPeriodo(req.query?.periodo || req.query?.temporalidad);
    const { inicio, fin } = calcularRango(periodo);
    const historial = await Historial.findAll({ inicio, fin });
    res.json(historial);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener historial' });
  }
};

const getDetallado = async (req, res) => {
  try {
    const { q = '', page = 1, limit = 8, desde = '', hasta = '' } = req.query || {};
    const fechaDesde = parseDateParam(desde, false);
    const fechaHasta = parseDateParam(hasta, true);

    if (desde && !fechaDesde) {
      return res.status(400).json({ message: 'La fecha inicial es invalida' });
    }

    if (hasta && !fechaHasta) {
      return res.status(400).json({ message: 'La fecha final es invalida' });
    }

    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      return res.status(400).json({ message: 'La fecha inicial no puede ser mayor que la fecha final' });
    }

    const resultado = await Historial.findDetailed({
      search: q,
      page,
      limit,
      desde: fechaDesde,
      hasta: fechaHasta
    });
    res.json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener historial detallado' });
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

module.exports = { getAll, getDetallado, getById, create, update, remove };
