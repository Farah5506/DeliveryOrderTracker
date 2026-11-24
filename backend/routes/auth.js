const express = require('express');
const authController = require('../controllers/auth');
const { requireAuth } = require('../middleware/auth');
const { verifyTurnstile } = require('../middleware/turnstile');

const router = express.Router();

router.post('/login', verifyTurnstile, authController.login);
router.get('/me', requireAuth, authController.me);

module.exports = router;
