const express = require('express');
const { getAll, getById, getActivasByGuardia, create, remove } = require('../controllers/asignacionAlertaController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Todas las rutas requieren token válido
router.use(protect);

// GET  /api/seguridad/alertas         → Administrador y Guardia consultan
router.get('/', authorize('Administrador', 'Guardia'), getAll);

// GET /api/seguridad/alertas/guardia/:idUsuario/activas → alerta activa por guardia
router.get('/guardia/:idUsuario/activas', authorize('Administrador', 'Guardia'), getActivasByGuardia);

// GET  /api/seguridad/alertas/:id     → Administrador y Guardia
router.get('/:id', authorize('Administrador', 'Guardia'), getById);

// POST /api/seguridad/alertas         → solo Administrador asigna alertas
router.post('/', authorize('Administrador'), create);

// DELETE /api/seguridad/alertas/:id   → solo Administrador elimina
router.delete('/:id', authorize('Administrador'), remove);

module.exports = router;
