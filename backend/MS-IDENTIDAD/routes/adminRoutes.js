const express = require('express');
const { getUsuarios, updateUsuario, bloquearUsuario } = require('../controllers/adminController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.use(protect, authorize('Administrador'));

// GET  /api/identidad/usuarios
router.get('/', getUsuarios);

// PUT  /api/identidad/usuarios/:id
router.put('/:id', updateUsuario);

// PATCH /api/identidad/usuarios/:id/bloquear
router.patch('/:id/bloquear', bloquearUsuario);

module.exports = router;
