const Zona = require('../models/Zona');

// GET /api/zonas
const getAll = async (req, res) => {
  try {
    const zonas = await Zona.findAll();
    res.json(zonas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener zonas' });
  }
};

// GET /api/zonas/:id
const getById = async (req, res) => {
  try {
    const zona = await Zona.findById(req.params.id);
    if (!zona) {
      return res.status(404).json({ message: 'Zona no encontrada' });
    }
    res.json(zona);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener la zona' });
  }
};

module.exports = { getAll, getById };
