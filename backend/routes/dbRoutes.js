const express = require('express');
const { health } = require('../controllers/dbController');

const router = express.Router();

router.get('/health', health);

module.exports = router;
