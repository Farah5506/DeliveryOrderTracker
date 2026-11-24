const serverless = require('serverless-http');
const { createApp } = require('./app');

const app = createApp((app) => {
  app.use('/api/orders', require('./routes/orders'));
});

module.exports.handler = serverless(app);