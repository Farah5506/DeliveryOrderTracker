const trackingService = require('../services/trackingService');
const { badRequest } = require('../lib/errors');
const { str, ORDER_NUMBER_PATTERN } = require('../lib/validate');

async function trackOrder(req, res) {
  const orderNumber = str(req.params.orderNumber).toUpperCase();
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
    throw badRequest('Order number should look like DOT-7K3P9Q.');
  }
  const order = await trackingService.publicStatus(orderNumber);
  res.status(200).json({ order });
}

module.exports = { trackOrder };
