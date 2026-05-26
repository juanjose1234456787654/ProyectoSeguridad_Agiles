const express = require('express');
const { getGrupos, createGrupo, updateGrupo, deleteGrupo } = require('../controllers/grupoController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protect);

// GET  /api/contactos/grupos        → mis grupos de confianza (con integrantes)
router.get('/', getGrupos);

// POST /api/contactos/grupos        → crear grupo (nombre + lista de correos)
router.post('/', createGrupo);

// PUT  /api/contactos/grupos/:id    → editar nombre y/o integrantes
router.put('/:id', updateGrupo);

// DELETE /api/contactos/grupos/:id  → eliminar grupo y sus integrantes
router.delete('/:id', deleteGrupo);

module.exports = router;
