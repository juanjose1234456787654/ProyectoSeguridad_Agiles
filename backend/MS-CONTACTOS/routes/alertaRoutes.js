const express = require('express');
const { alertar } = require('../controllers/alertaController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protect);

// POST /api/contactos/alertar  → envía alerta simultánea a todos los contactos
router.post('/alertar', alertar);

module.exports = router;
