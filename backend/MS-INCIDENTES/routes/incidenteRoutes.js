const express = require('express');
const { getAll, getActivos, getByUsuario, getById, create, update, close, remove } = require('../controllers/incidenteController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Todas las rutas requieren token válido
router.use(protect);

// GET  /api/incidentes         → todos los roles autenticados pueden consultar
router.get('/', getAll);

// GET  /api/incidentes/activos → todos los roles autenticados
router.get('/activos', getActivos);

// GET  /api/incidentes/usuario/:idUsuario → mis alertas activas
router.get('/usuario/:idUsuario', getByUsuario);

// GET  /api/incidentes/:id     → todos los roles autenticados
router.get('/:id', getById);

// POST /api/incidentes         → todos excepto Administrador pueden registrar
router.post('/', authorize('Guardia', 'Estudiante', 'Docente', 'Personal'), create);

// PUT  /api/incidentes/:id     → solo Administrador puede editar
router.put('/:id', authorize('Administrador'), update);

// PATCH /api/incidentes/:id/cerrar → Guardia y Administrador pueden cerrar
router.patch('/:id/cerrar', authorize('Guardia', 'Administrador'), close);

// DELETE /api/incidentes/:id   → solo Administrador puede eliminar
router.delete('/:id', authorize('Administrador'), remove);

module.exports = router;
