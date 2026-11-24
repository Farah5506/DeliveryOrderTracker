const express = require('express');
const assignmentController = require('../controllers/assignment');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use(requireAuth, requireRole('dispatcher'));

router.patch('/', assignmentController.assignCourier);
router.delete('/', assignmentController.unassignCourier);

module.exports = router;
