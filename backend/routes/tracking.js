const express = require('express');
const trackingController = require('../controllers/tracking');
const { verifyTurnstile } = require('../middleware/turnstile');

const router = express.Router();

router.get('/:orderNumber', verifyTurnstile, trackingController.trackOrder);

module.exports = router;
