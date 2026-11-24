const orderService = require('../services/orderService');
const { badRequest, requireJson } = require('../lib/errors');
const { str, cleanPhone, checkLength, PHONE_PATTERN, DATE_PATTERN } = require('../lib/validate');

const STATUSES = ['created', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'failed', 'cancelled'];
const PRIORITIES = ['standard', 'express'];


function readOrderInput(body) {
  const order = {
    customerName: str(body.customerName),
    customerPhone: cleanPhone(body.customerPhone),
    pickupAddress: str(body.pickupAddress),
    deliveryAddress: str(body.deliveryAddress),
    packageDetails: str(body.packageDetails),
    priority: str(body.priority) || 'standard',
    notes: str(body.notes)
  };

  const problems = [
    checkLength(order.customerName, 'Customer name', 2, 100),
    PHONE_PATTERN.test(order.customerPhone) ? null : 'Customer phone must be 10 to 15 digits.',
    checkLength(order.pickupAddress, 'Pickup address', 5, 200),
    checkLength(order.deliveryAddress, 'Delivery address', 5, 200),
    checkLength(order.packageDetails, 'Package details', 2, 200),
    PRIORITIES.includes(order.priority) ? null : 'Priority must be standard or express.',
    checkLength(order.notes, 'Notes', 0, 500)
  ].filter(Boolean);

  if (problems.length) throw badRequest(problems[0], problems);
  return order;
}

async function createOrder(req, res) {
  requireJson(req);
  const input = readOrderInput(req.body);
  const order = await orderService.createOrder(input, req.user);
  res.status(201).json({ order });
}

async function listOrders(req, res) {
  const filters = {
    status: str(req.query.status),
    courierId: str(req.query.courierId),
    date: str(req.query.date),
    q: str(req.query.q)
  };
  if (filters.status && !STATUSES.includes(filters.status)) {
    throw badRequest('Unknown status filter.');
  }
  if (filters.date && !DATE_PATTERN.test(filters.date)) {
    throw badRequest('Date must look like 2026-11-24.');
  }
  const orders = await orderService.listOrders(filters);
  res.status(200).json({ orders });
}

async function getOrder(req, res) {
  const order = await orderService.getOrder(req.params.id);
  res.status(200).json({ order });
}

async function updateOrder(req, res) {
  requireJson(req);
  const changes = readOrderInput(req.body);
  const order = await orderService.updateOrder(req.params.id, changes, req.user);
  res.status(200).json({ order });
}

async function cancelOrder(req, res) {
  const order = await orderService.cancelOrder(req.params.id, req.user);
  res.status(200).json({ order });
}

module.exports = { createOrder, listOrders, getOrder, updateOrder, cancelOrder };