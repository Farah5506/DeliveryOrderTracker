require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const { AppError } = require('./lib/errors');

function createApp(mountRoutes) {
  const app = express();
  app.disable('x-powered-by');   


  app.use((req, res, next) => {
    const started = Date.now();
    const path = req.originalUrl.split('?')[0];
    res.on('finish', () => {
      console.log(`${new Date().toISOString()} ${req.method} ${path} -> ${res.statusCode} ${Date.now() - started}ms`);
    });
    next();
  });


  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    next();
  });

  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(cors({ origin: allowedOrigins }));

  app.use(express.json({ limit: '64kb' }));

  
  app.use((req, res, next) => {
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
      const text = req.body.toString('utf8').trim();
      const decoded = /^[A-Za-z0-9+/=\s]+$/.test(text) && !text.startsWith('{')
        ? Buffer.from(text, 'base64').toString('utf8')
        : text;
      try {
        req.body = decoded ? JSON.parse(decoded) : {};
      } catch {
        return next(new AppError(400, 'VALIDATION_ERROR', 'Request body is not valid JSON.'));
      }
    }
    if (req.body === undefined || req.body === null) req.body = {};
    next();
  });

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: process.env.SERVICE_NAME || 'all-services',
      environment: process.env.NODE_ENV || 'development',
      runtime: process.env.AWS_LAMBDA_FUNCTION_NAME ? 'lambda' : 'pc'
    });
  });

  mountRoutes(app);

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' } });
  });

  app.use((error, req, res, next) => {
    if (error instanceof AppError) {
      const body = { code: error.code, message: error.message };
      if (error.details) body.details = error.details;
      return res.status(error.status).json({ error: body });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON.' } });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
    }
    console.error(error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' } });
  });

  return app;
}

module.exports = { createApp };
