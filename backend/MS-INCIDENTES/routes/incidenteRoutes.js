const express = require('express');
const { getAll, getById, create, update, remove } = require('../controllers/incidenteController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Todas las rutas requieren token válido
router.use(protect);

// GET  /api/incidentes         → todos los roles autenticados pueden consultar
router.get('/', getAll);

// GET  /api/incidentes/:id     → todos los roles autenticados
router.get('/:id', getById);

// POST /api/incidentes         → Guardia y Administrador pueden registrar
router.post('/', authorize('Guardia', 'Administrador'), create);

// PUT  /api/incidentes/:id     → solo Administrador puede editar
router.put('/:id', authorize('Administrador'), update);

// DELETE /api/incidentes/:id   → solo Administrador puede eliminar
router.delete('/:id', authorize('Administrador'), remove);

module.exports = router;
