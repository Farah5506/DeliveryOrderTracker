const assignmentService = require('../services/assignmentService');
const { badRequest, requireJson } = require('../lib/errors');
const { str } = require('../lib/validate');

async function assignCourier(req, res) {
  requireJson(req);
  const courierId = str(req.body.courierId);
  if (!courierId) throw badRequest('Please choose a courier.');

  const order = await assignmentService.assign(req.params.id, courierId, req.user);
  res.status(200).json({ order });
}

async function unassignCourier(req, res) {
  const order = await assignmentService.unassign(req.params.id, req.user);
  res.status(200).json({ order });
}

module.exports = { assignCourier, unassignCourier };
