
const { AppError } = require('../lib/errors');
const authService = require('../services/authService');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Please log in.');
  }

  const user = await authService.userFromToken(token);
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Your session has ended. Please log in again.');
  }

  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do this.');
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
