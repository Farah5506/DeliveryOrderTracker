const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});

const TABLES = {
  users: process.env.USERS_TABLE || 'DotUsers',
  sessions: process.env.SESSIONS_TABLE || 'DotSessions',
  orders: process.env.ORDERS_TABLE || 'DotOrders',
  history: process.env.HISTORY_TABLE || 'DotOrderHistory'
};

async function scanAll(params) {
  const items = [];
  let startKey;
  do {
    const result = await db.send(new ScanCommand({ ...params, ExclusiveStartKey: startKey }));
    items.push(...(result.Items || []));
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return items;
}


function isConditionFailure(error) {
  return error && error.name === 'ConditionalCheckFailedException';
}

module.exports = { db, TABLES, scanAll, isConditionFailure };