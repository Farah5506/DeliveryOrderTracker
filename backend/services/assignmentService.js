
const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { db, TABLES, isConditionFailure } = require('../lib/db');
const { notFound, conflict } = require('../lib/errors');
const courierService = require('./courierService');
const history = require('./historyService');

const ASSIGNABLE = ['created', 'assigned', 'failed'];
const MAX_ACTIVE_ORDERS = Number(process.env.MAX_ACTIVE_ORDERS) || 5;

async function getOrder(id) {
  const result = await db.send(new GetCommand({ TableName: TABLES.orders, Key: { id } }));
  if (!result.Item) throw notFound('ORDER_NOT_FOUND', 'Order not found.');
  return result.Item;
}

async function assign(orderId, courierId, user) {
  const [order, courier] = await Promise.all([getOrder(orderId), courierService.getCourier(courierId)]);

  if (!ASSIGNABLE.includes(order.status)) {
    throw conflict('ORDER_NOT_ASSIGNABLE', 'Only new, assigned or failed orders can be given to a courier.');
  }
  if (order.status === 'assigned' && order.courierId === courierId) {
    throw conflict('ORDER_NOT_ASSIGNABLE', 'This courier already has this order.');
  }
  if (!courier.isActive || courier.availability !== 'available') {
    throw conflict('COURIER_UNAVAILABLE', `${courier.fullName} is off duty or deactivated. Choose another courier.`);
  }

  const counts = await courierService.activeOrderCounts();
  if ((counts[courierId] || 0) >= MAX_ACTIVE_ORDERS) {
    throw conflict('COURIER_UNAVAILABLE',
      `${courier.fullName} already has ${MAX_ACTIVE_ORDERS} active orders. Choose another courier.`);
  }

  const now = new Date().toISOString();
  let updated;
  try {
    const result = await db.send(new UpdateCommand({
      TableName: TABLES.orders,
      Key: { id: orderId },
      UpdateExpression: 'SET courierId = :cid, courierName = :cname, #s = :assigned, assignedAt = :now, updatedAt = :now',
      ConditionExpression: '#s = :current',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':cid': courier.id,
        ':cname': courier.fullName,
        ':assigned': 'assigned',
        ':now': now,
        ':current': order.status
      },
      ReturnValues: 'ALL_NEW'
    }));
    updated = result.Attributes;
  } catch (error) {
    if (isConditionFailure(error)) {
      throw conflict('ORDER_NOT_ASSIGNABLE', 'The order changed meanwhile. Refresh and try again.');
    }
    throw error;
  }

  const note = order.courierName && order.courierId !== courier.id
    ? `Reassigned from ${order.courierName} to ${courier.fullName}`
    : `Assigned to ${courier.fullName}`;
  await history.record({ orderId, fromStatus: order.status, toStatus: 'assigned', note, user });

  return updated;
}

async function unassign(orderId, user) {
  const order = await getOrder(orderId);
  if (order.status !== 'assigned') {
    throw conflict('ORDER_NOT_ASSIGNABLE', 'Only orders that are assigned and not yet picked up can be unassigned.');
  }

  let updated;
  try {
    const result = await db.send(new UpdateCommand({
      TableName: TABLES.orders,
      Key: { id: orderId },
      UpdateExpression: 'SET courierId = :none, courierName = :none, #s = :created, updatedAt = :now',
      ConditionExpression: '#s = :assigned',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':none': null,
        ':created': 'created',
        ':assigned': 'assigned',
        ':now': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    }));
    updated = result.Attributes;
  } catch (error) {
    if (isConditionFailure(error)) {
      throw conflict('ORDER_NOT_ASSIGNABLE', 'The courier has already picked up this order.');
    }
    throw error;
  }

  await history.record({
    orderId, fromStatus: 'assigned', toStatus: 'created', note: `Unassigned from ${order.courierName}`, user
  });
  return updated;
}

module.exports = { assign, unassign };
