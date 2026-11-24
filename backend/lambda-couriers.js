const serverless = require('serverless-http');
const { createApp } = require('./app');

const app = createApp((app) => {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/couriers', require('./routes/couriers'));
  app.use('/api/orders/:id/assignment', require('./routes/assignment'));
});

module.exports.handler = serverless(app);
