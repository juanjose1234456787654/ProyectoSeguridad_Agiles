const express = require('express');
const { getAll, getById, create, update, remove } = require('../controllers/historialController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(protect);

// Consultas: Administrador y Guardia
router.get('/', authorize('Administrador', 'Guardia'), getAll);
router.get('/:id', authorize('Administrador', 'Guardia'), getById);

// Escritura: solo Administrador
router.post('/', authorize('Administrador'), create);
router.put('/:id', authorize('Administrador'), update);
router.delete('/:id', authorize('Administrador'), remove);

module.exports = router;
