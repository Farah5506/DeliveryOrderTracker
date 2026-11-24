const crypto = require('crypto');
const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { db, TABLES, scanAll, isConditionFailure } = require('../lib/db');
const { hashPassword, verifyPassword } = require('../lib/passwords');
const { AppError, conflict } = require('../lib/errors');

const SESSION_HOURS = 12;

function publicUser(user) {
  return { id: user.id, fullName: user.fullName, email: user.email, role: user.role };
}

async function getUser(id) {
  const result = await db.send(new GetCommand({ TableName: TABLES.users, Key: { id } }));
  return result.Item || null;
}

async function findUserByEmail(email) {
  const items = await scanAll({
    TableName: TABLES.users,
    FilterExpression: 'email = :e',
    ExpressionAttributeValues: { ':e': email.toLowerCase() }
  });
  return items[0] || null;
}

async function createUser({ fullName, email, password, role, extra = {} }) {
  const normalizedEmail = email.toLowerCase();
  if (await findUserByEmail(normalizedEmail)) {
    throw conflict('EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const now = new Date().toISOString();
  const user = {
    id: `${role === 'courier' ? 'c' : 'u'}-${crypto.randomBytes(5).toString('hex')}`,
    fullName,
    email: normalizedEmail,
    role,
    passwordHash: await hashPassword(password),
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...extra
  };

  try {
    await db.send(new PutCommand({
      TableName: TABLES.users,
      Item: user,
      ConditionExpression: 'attribute_not_exists(id)'
    }));
  } catch (error) {
    if (isConditionFailure(error)) throw conflict('EMAIL_TAKEN', 'Please try again.');
    throw error;
  }
  return user;
}

async function login(email, password) {
  const user = await findUserByEmail(email);
  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;

  // Same message for "no such email" and "wrong password": do not tell attackers which one
  if (!user || !passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Wrong email or password.');
  }
  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated. Please contact the dispatcher.');
  }

  const now = Date.now();
  const token = crypto.randomBytes(32).toString('hex');
  await db.send(new PutCommand({
    TableName: TABLES.sessions,
    Item: {
      token,
      userId: user.id,
      createdAt: new Date(now).toISOString(),
      expiresAt: Math.floor(now / 1000) + SESSION_HOURS * 3600
    }
  }));

  return { token, user: publicUser(user) };
}

async function userFromToken(token) {
  const result = await db.send(new GetCommand({ TableName: TABLES.sessions, Key: { token } }));
  const session = result.Item;
  if (!session || session.expiresAt < Math.floor(Date.now() / 1000)) return null;

  const user = await getUser(session.userId);
  if (!user || !user.isActive) return null;   // a deactivated courier is logged out at once
  return user;
}

module.exports = { publicUser, getUser, findUserByEmail, createUser, login, userFromToken };
