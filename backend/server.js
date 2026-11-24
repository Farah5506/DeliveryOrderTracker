const { createApp } = require('./app');

const app = createApp((app) => {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/couriers', require('./routes/couriers'));
  app.use('/api/orders/:id/assignment', require('./routes/assignment'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/deliveries', require('./routes/deliveries'));
  app.use('/api/track', require('./routes/tracking'));
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Delivery Order Tracker API on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
});