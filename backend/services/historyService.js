const crypto = require('crypto');
const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { db, TABLES } = require('../lib/db');

async function record({ orderId, fromStatus, toStatus, note, user }) {
  const createdAt = new Date().toISOString();
  const entry = {
    orderId,
    eventId: `${createdAt}#${crypto.randomBytes(3).toString('hex')}`,
    fromStatus: fromStatus || null,
    toStatus,
    note: note || '',
    changedById: user ? user.id : null,
    changedByName: user ? user.fullName : 'System',
    createdAt
  };
  await db.send(new PutCommand({ TableName: TABLES.history, Item: entry }));
  return entry;
}

async function listForOrder(orderId) {
  const items = [];
  let startKey;
  do {
    const result = await db.send(new QueryCommand({
      TableName: TABLES.history,
      KeyConditionExpression: 'orderId = :o',
      ExpressionAttributeValues: { ':o': orderId },
      ScanIndexForward: true,          // oldest first
      ExclusiveStartKey: startKey
    }));
    items.push(...(result.Items || []));
    startKey = result.LastEvaluatedKey;
  } while (startKey);

  return items.map((entry) => ({
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    note: entry.note,
    changedByName: entry.changedByName,
    createdAt: entry.createdAt
  }));
}

module.exports = { record, listForOrder };
