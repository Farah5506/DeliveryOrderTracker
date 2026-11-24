const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const { db, TABLES } = require('../lib/db');
const { notFound } = require('../lib/errors');
const history = require('./historyService');

async function publicStatus(orderNumber) {
  const result = await db.send(new GetCommand({ TableName: TABLES.orders, Key: { id: orderNumber } }));
  const order = result.Item;
  if (!order) throw notFound('ORDER_NOT_FOUND', 'No order found with that number.');

  const timeline = await history.listForOrder(order.id);

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    updatedAt: order.updatedAt,
    courierFirstName: order.courierName ? order.courierName.split(' ')[0] : null,
    history: timeline.map((entry) => ({ toStatus: entry.toStatus, createdAt: entry.createdAt }))
  };
}

module.exports = { publicStatus };
