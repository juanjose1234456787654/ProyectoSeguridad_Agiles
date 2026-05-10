const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { getMiConfianza, saveMiConfianza } = require('../controllers/confianzaController');

const router = express.Router();

router.use(protect);

// GET /api/identidad/confianza/me
router.get('/confianza/me', getMiConfianza);

// PUT /api/identidad/confianza/me
router.put('/confianza/me', saveMiConfianza);

module.exports = router;
