const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { db, TABLES, scanAll, isConditionFailure } = require('../lib/db');
const { notFound, conflict, forbidden } = require('../lib/errors');
const history = require('./historyService');

const ACTIVE_STATUSES = ['assigned', 'picked_up', 'on_the_way'];

const NEXT_STEPS = {
  assigned: ['picked_up'],
  picked_up: ['on_the_way', 'failed'],
  on_the_way: ['delivered', 'failed']
};

const LABELS = {
  created: 'Created', assigned: 'Assigned', picked_up: 'Picked up', on_the_way: 'On the way',
  delivered: 'Delivered', failed: 'Failed', cancelled: 'Cancelled'
};

async function getOrder(id) {
  const result = await db.send(new GetCommand({ TableName: TABLES.orders, Key: { id } }));
  if (!result.Item) throw notFound('ORDER_NOT_FOUND', 'Order not found.');
  return result.Item;
}

async function listForCourier(courierId) {
  const orders = await scanAll({
    TableName: TABLES.orders,
    FilterExpression: 'courierId = :c',
    ExpressionAttributeValues: { ':c': courierId }
  });

  return orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'express' ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

async function updateStatus(orderId, newStatus, note, user) {
  const order = await getOrder(orderId);

  if (order.courierId !== user.id) {
    throw forbidden('NOT_ASSIGNED', 'This order is not assigned to you.');
  }

  const allowed = NEXT_STEPS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw conflict('INVALID_TRANSITION',
      `An order that is "${LABELS[order.status]}" cannot be marked "${LABELS[newStatus]}".`);
  }

  const now = new Date().toISOString();
  const sets = ['#s = :new', 'updatedAt = :now'];
  const values = { ':new': newStatus, ':now': now, ':current': order.status, ':me': user.id };
  if (newStatus === 'picked_up') sets.push('pickedUpAt = :now');
  if (newStatus === 'delivered') sets.push('deliveredAt = :now');
  if (newStatus === 'failed') {
    sets.push('failedAt = :now', 'failureReason = :reason');
    values[':reason'] = note;
  }

  let updated;
  try {
    const result = await db.send(new UpdateCommand({
      TableName: TABLES.orders,
      Key: { id: orderId },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ConditionExpression: '#s = :current AND courierId = :me',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW'
    }));
    updated = result.Attributes;
  } catch (error) {
    if (isConditionFailure(error)) {
      throw conflict('INVALID_TRANSITION', 'The order changed meanwhile. Refresh and try again.');
    }
    throw error;
  }

  await history.record({ orderId, fromStatus: order.status, toStatus: newStatus, note, user });
  return updated;
}

async function historyFor(orderId, user) {
  const order = await getOrder(orderId);
  if (user.role === 'courier' && order.courierId !== user.id) {
    throw forbidden('NOT_ASSIGNED', 'This order is not assigned to you.');
  }
  return history.listForOrder(orderId);
}

module.exports = { NEXT_STEPS, listForCourier, updateStatus, historyFor };
