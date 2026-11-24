const express = require('express');
const orderController = require('../controllers/orders');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('dispatcher'));

router.post('/', orderController.createOrder);
router.get('/', orderController.listOrders);
router.get('/:id', orderController.getOrder);
router.patch('/:id', orderController.updateOrder);
router.patch('/:id/cancel', orderController.cancelOrder);

module.exports = router;
