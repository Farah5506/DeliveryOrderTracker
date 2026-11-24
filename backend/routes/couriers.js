const express = require('express');
const courierController = require('../controllers/couriers');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('dispatcher'));

router.post('/', courierController.createCourier);
router.get('/', courierController.listCouriers);
router.patch('/:id', courierController.updateCourier);

module.exports = router;
