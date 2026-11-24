
const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { db, TABLES, scanAll } = require('../lib/db');
const { notFound } = require('../lib/errors');
const authService = require('./authService');

const ACTIVE_STATUSES = ['assigned', 'picked_up', 'on_the_way'];

function courierView(user, activeOrders) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    vehicleType: user.vehicleType,
    availability: user.availability,
    isActive: user.isActive,
    activeOrders: activeOrders || 0
  };
}

async function activeOrderCounts() {
  const orders = await scanAll({
    TableName: TABLES.orders,
    ProjectionExpression: 'courierId, #s',
    ExpressionAttributeNames: { '#s': 'status' }
  });
  const counts = {};
  orders.forEach((o) => {
    if (o.courierId && ACTIVE_STATUSES.includes(o.status)) {
      counts[o.courierId] = (counts[o.courierId] || 0) + 1;
    }
  });
  return counts;
}

async function getCourier(id) {
  const result = await db.send(new GetCommand({ TableName: TABLES.users, Key: { id } }));
  if (!result.Item || result.Item.role !== 'courier') {
    throw notFound('COURIER_NOT_FOUND', 'Courier not found.');
  }
  return result.Item;
}

async function createCourier({ fullName, email, password, phone, vehicleType }) {
  const user = await authService.createUser({
    fullName,
    email,
    password,
    role: 'courier',
    extra: { phone, vehicleType, availability: 'available' }
  });
  return courierView(user, 0);
}

async function listCouriers({ availability, q }) {
  const [couriers, counts] = await Promise.all([
    scanAll({
      TableName: TABLES.users,
      FilterExpression: '#r = :courier',
      ExpressionAttributeNames: { '#r': 'role' },
      ExpressionAttributeValues: { ':courier': 'courier' }
    }),
    activeOrderCounts()
  ]);
  const text = (q || '').toLowerCase();

  return couriers
    .filter((c) => !availability || c.availability === availability)
    .filter((c) => !text ||
      c.fullName.toLowerCase().includes(text) ||
      c.email.toLowerCase().includes(text))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((c) => courierView(c, counts[c.id]));
}

async function updateCourier(id, changes) {
  await getCourier(id);   

  const fields = { ...changes, updatedAt: new Date().toISOString() };
  const names = {};
  const values = {};
  const sets = Object.keys(fields).map((key, i) => {
    names[`#f${i}`] = key;
    values[`:v${i}`] = fields[key];
    return `#f${i} = :v${i}`;
  });

  const result = await db.send(new UpdateCommand({
    TableName: TABLES.users,
    Key: { id },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW'
  }));

  const counts = await activeOrderCounts();
  return courierView(result.Attributes, counts[id]);
}

module.exports = { ACTIVE_STATUSES, courierView, activeOrderCounts, getCourier, createCourier, listCouriers, updateCourier };
