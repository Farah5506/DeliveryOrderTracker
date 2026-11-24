const serverless = require('serverless-http');
const { createApp } = require('./app');

const app = createApp((app) => {
  app.use('/api/deliveries', require('./routes/deliveries'));
  app.use('/api/track', require('./routes/tracking'));
});

module.exports.handler = serverless(app);
