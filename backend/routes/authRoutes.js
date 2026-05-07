const express = require('express');
const { login } = require('../controllers/authController');
const router = express.Router();

// T1.1 - ruta POST /api/auth/login
router.post('/login', login);

module.exports = router;