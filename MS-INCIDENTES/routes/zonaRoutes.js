const express = require('express');
const { getAll, getById } = require('../controllers/zonaController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// Todas las rutas requieren token válido
router.use(protect);

// GET /api/zonas       → todos los roles autenticados (se usan al registrar incidentes)
router.get('/', getAll);

// GET /api/zonas/:id
router.get('/:id', getById);

module.exports = router;
