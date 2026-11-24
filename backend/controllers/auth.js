const authService = require('../services/authService');
const { badRequest, requireJson } = require('../lib/errors');
const { str, EMAIL_PATTERN } = require('../lib/validate');

async function login(req, res) {
  requireJson(req);

  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!EMAIL_PATTERN.test(email) || !password) {
    throw badRequest('Please enter a valid email and your password.');
  }

  const result = await authService.login(email, password);
  res.status(200).json(result);
}

async function me(req, res) {
  res.status(200).json({ user: authService.publicUser(req.user) });
}

module.exports = { login, me };
