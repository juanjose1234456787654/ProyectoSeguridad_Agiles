const express = require('express');
const { buscar, getContactos, addContacto, removeContacto } = require('../controllers/contactoController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// Todas las rutas requieren token válido
router.use(protect);

// GET  /api/contactos/buscar?q=termino  → buscar personas en BD_UTA
router.get('/buscar', buscar);

// GET  /api/contactos                   → mis contactos individuales
router.get('/', getContactos);

// POST /api/contactos                   → agregar contacto individual
router.post('/', addContacto);

// DELETE /api/contactos/:id             → eliminar contacto individual
router.delete('/:id', removeContacto);

module.exports = router;
