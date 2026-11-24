const deliveryService = require('../services/deliveryService');
const { badRequest, requireJson } = require('../lib/errors');
const { str } = require('../lib/validate');

const COURIER_STATUSES = ['picked_up', 'on_the_way', 'delivered', 'failed'];

async function listMyDeliveries(req, res) {
  const deliveries = await deliveryService.listForCourier(req.user.id);
  res.status(200).json({ deliveries });
}

async function updateStatus(req, res) {
  requireJson(req);
  const status = str(req.body.status);
  const note = str(req.body.note);

  if (!COURIER_STATUSES.includes(status)) {
    throw badRequest('Status must be picked_up, on_the_way, delivered or failed.');
  }
  if (status === 'failed' && note.length < 3) {
    throw badRequest('Please write the reason the delivery failed.');
  }
  if (note.length > 500) {
    throw badRequest('The note must be 500 characters or less.');
  }

  const order = await deliveryService.updateStatus(req.params.id, status, note, req.user);
  res.status(200).json({ order });
}

async function getHistory(req, res) {
  const history = await deliveryService.historyFor(req.params.id, req.user);
  res.status(200).json({ history });
}

module.exports = { listMyDeliveries, updateStatus, getHistory };
