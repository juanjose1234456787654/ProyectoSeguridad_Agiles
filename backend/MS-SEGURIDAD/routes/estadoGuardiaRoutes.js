const express = require('express');
const { getAll, getById, getByUsuario, create, update, remove } = require('../controllers/estadoGuardiaController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Todas las rutas requieren token válido
router.use(protect);

// GET  /api/seguridad/guardias               → Administrador consulta todos
router.get('/', authorize('Administrador'), getAll);

// GET  /api/seguridad/guardias/usuario/:idUsuario → el guardia ve su propio historial
router.get('/usuario/:idUsuario', authorize('Administrador', 'Guardia'), getByUsuario);

// GET  /api/seguridad/guardias/:id           → Administrador o el propio guardia
router.get('/:id', authorize('Administrador', 'Guardia'), getById);

// POST /api/seguridad/guardias               → Guardia registra su propio estado
router.post('/', authorize('Guardia', 'Administrador'), create);

// PUT  /api/seguridad/guardias/:id           → solo Administrador edita
router.put('/:id', authorize('Administrador'), update);

// DELETE /api/seguridad/guardias/:id         → solo Administrador elimina
router.delete('/:id', authorize('Administrador'), remove);

module.exports = router;
