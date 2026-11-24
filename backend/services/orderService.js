const crypto = require('crypto');
const { GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { db, TABLES, scanAll, isConditionFailure } = require('../lib/db');
const { badRequest, notFound, conflict } = require('../lib/errors');
const { geocode } = require('./geocodingService');
const history = require('./historyService');


const EDITABLE = ['created', 'assigned'];

const ORDER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newOrderNumber() {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += ORDER_ALPHABET[crypto.randomInt(ORDER_ALPHABET.length)];
  return `DOT-${code}`;
}


async function locate(address) {
  const result = await geocode(address);
  if (result.status === 'not_found') {
    throw badRequest('We could not find the delivery address on the map. Check the spelling and add the area and city.');
  }
  if (result.status === 'found') {
    return { deliveryLat: result.lat, deliveryLon: result.lon, addressVerified: true };
  }
 
  return { deliveryLat: null, deliveryLon: null, addressVerified: false };
}

async function createOrder(input, user) {
  const location = await locate(input.deliveryAddress);
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = newOrderNumber();
    const order = {
      id: orderNumber,
      orderNumber,
      ...input,
      ...location,
      status: 'created',
      courierId: null,
      courierName: null,
      createdById: user.id,
      createdAt: now,
      updatedAt: now
    };

    try {
      await db.send(new PutCommand({
        TableName: TABLES.orders,
        Item: order,
        ConditionExpression: 'attribute_not_exists(id)'
      }));
    } catch (error) {
      if (isConditionFailure(error)) continue;   
      throw error;
    }

    await history.record({ orderId: order.id, fromStatus: null, toStatus: 'created', note: '', user });
    return order;
  }
  throw new Error('Could not generate a unique order number');
}

async function getOrder(id) {
  const result = await db.send(new GetCommand({ TableName: TABLES.orders, Key: { id } }));
  if (!result.Item) throw notFound('ORDER_NOT_FOUND', 'Order not found.');
  return result.Item;
}

async function listOrders({ status, courierId, date, q }) {
  const orders = await scanAll({ TableName: TABLES.orders });
  const text = (q || '').toLowerCase();

  return orders
    .filter((o) => !status || o.status === status)
    .filter((o) => !courierId || o.courierId === courierId)
    .filter((o) => !date || (o.createdAt || '').startsWith(date))
    .filter((o) => !text ||
      o.orderNumber.toLowerCase().includes(text) ||
      (o.customerName || '').toLowerCase().includes(text))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));  
}

async function updateOrder(id, changes, user) {
  const current = await getOrder(id);
  if (!EDITABLE.includes(current.status)) {
    throw conflict('ORDER_LOCKED', 'This order has already been picked up, so it can no longer be edited.');
  }

  const location = changes.deliveryAddress !== current.deliveryAddress
    ? await locate(changes.deliveryAddress)
    : {};

  const fields = { ...changes, ...location, updatedAt: new Date().toISOString() };
  const names = { '#s': 'status' };
  const values = { ':created': 'created', ':assigned': 'assigned' };
  const sets = Object.keys(fields).map((key, i) => {
    names[`#f${i}`] = key;
    values[`:v${i}`] = fields[key];
    return `#f${i} = :v${i}`;
  });

  try {
    const result = await db.send(new UpdateCommand({
      TableName: TABLES.orders,
      Key: { id },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ConditionExpression: '#s IN (:created, :assigned)',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW'
    }));
    return result.Attributes;
  } catch (error) {
    if (isConditionFailure(error)) {
      throw conflict('ORDER_LOCKED', 'This order has already been picked up, so it can no longer be edited.');
    }
    throw error;
  }
}

async function cancelOrder(id, user) {
  const current = await getOrder(id);
  if (!EDITABLE.includes(current.status)) {
    throw conflict('ORDER_LOCKED', 'Only orders that have not been picked up can be cancelled.');
  }

  const now = new Date().toISOString();
  let order;
  try {
    const result = await db.send(new UpdateCommand({
      TableName: TABLES.orders,
      Key: { id },
      UpdateExpression: 'SET #s = :cancelled, cancelledAt = :now, updatedAt = :now',
      ConditionExpression: '#s = :current',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':cancelled': 'cancelled', ':now': now, ':current': current.status },
      ReturnValues: 'ALL_NEW'
    }));
    order = result.Attributes;
  } catch (error) {
    if (isConditionFailure(error)) {
      throw conflict('ORDER_LOCKED', 'The order changed meanwhile. Refresh and try again.');
    }
    throw error;
  }

  await history.record({ orderId: id, fromStatus: current.status, toStatus: 'cancelled', note: '', user });
  return order;
}

module.exports = { createOrder, getOrder, listOrders, updateOrder, cancelOrder };
