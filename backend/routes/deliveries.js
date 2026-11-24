const express = require('express');
const deliveryController = require('../controllers/deliveries');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', requireRole('courier'), deliveryController.listMyDeliveries);
router.patch('/:id/status', requireRole('courier'), deliveryController.updateStatus);
router.get('/:id/history', requireRole('dispatcher', 'courier'), deliveryController.getHistory);

module.exports = router;