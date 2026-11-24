const courierService = require('../services/courierService');
const { badRequest, requireJson } = require('../lib/errors');
const { str, cleanPhone, checkLength, PHONE_PATTERN, EMAIL_PATTERN } = require('../lib/validate');

const VEHICLES = ['bike', 'motorcycle', 'car', 'van'];
const AVAILABILITY = ['available', 'off_duty'];

function fail(problems) {
  const list = problems.filter(Boolean);
  if (list.length) throw badRequest(list[0], list);
}

async function createCourier(req, res) {
  requireJson(req);
  const input = {
    fullName: str(req.body.fullName),
    email: str(req.body.email).toLowerCase(),
    password: typeof req.body.password === 'string' ? req.body.password : '',
    phone: cleanPhone(req.body.phone),
    vehicleType: str(req.body.vehicleType)
  };

  fail([
    checkLength(input.fullName, 'Name', 2, 100),
    EMAIL_PATTERN.test(input.email) ? null : 'Please enter a valid email.',
    input.password.length >= 8 && input.password.length <= 100 ? null : 'Password must be 8 to 100 characters.',
    PHONE_PATTERN.test(input.phone) ? null : 'Phone must be 10 to 15 digits.',
    VEHICLES.includes(input.vehicleType) ? null : 'Vehicle type must be bike, motorcycle, car or van.'
  ]);

  const courier = await courierService.createCourier(input);
  res.status(201).json({ courier });
}

async function listCouriers(req, res) {
  const availability = str(req.query.availability);
  if (availability && !AVAILABILITY.includes(availability)) {
    throw badRequest('Availability must be available or off_duty.');
  }
  const couriers = await courierService.listCouriers({ availability, q: str(req.query.q) });
  res.status(200).json({ couriers });
}

async function updateCourier(req, res) {
  requireJson(req);
  const changes = {};
  const problems = [];

  if (req.body.phone !== undefined) {
    changes.phone = cleanPhone(req.body.phone);
    if (!PHONE_PATTERN.test(changes.phone)) problems.push('Phone must be 10 to 15 digits.');
  }
  if (req.body.vehicleType !== undefined) {
    changes.vehicleType = str(req.body.vehicleType);
    if (!VEHICLES.includes(changes.vehicleType)) problems.push('Vehicle type must be bike, motorcycle, car or van.');
  }
  if (req.body.availability !== undefined) {
    changes.availability = str(req.body.availability);
    if (!AVAILABILITY.includes(changes.availability)) problems.push('Availability must be available or off_duty.');
  }
  if (req.body.isActive !== undefined) {
    if (typeof req.body.isActive !== 'boolean') problems.push('isActive must be true or false.');
    changes.isActive = req.body.isActive;
  }

  fail(problems);
  if (Object.keys(changes).length === 0) throw badRequest('Nothing to update.');

  const courier = await courierService.updateCourier(req.params.id, changes);
  res.status(200).json({ courier });
}

module.exports = { createCourier, listCouriers, updateCourier };
