const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const v1Router = require('./routes/v1');
const { sendSuccess } = require('./utils/response');

const app = express();

// Trust reverse proxy if in production
if (config.env === 'production') {
  app.set('trust proxy', 1);
}

// Security HTTP headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(cors());

// Request logging
if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

// Global API rate limiting
app.use('/api', apiLimiter);

// Body parsing with safe size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Legacy / Quick root health check
app.get('/api/health', (req, res) => {
  return sendSuccess(res, {
    environment: config.env,
    version: '1.0.0'
  }, 'Student Election System API is healthy');
});

// API Version 1 Routes
app.use('/api/v1', v1Router);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `Cannot find ${req.method} ${req.originalUrl} on this server`,
    errorCode: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString()
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
