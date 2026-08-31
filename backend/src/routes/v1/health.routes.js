const express = require('express');
const { testConnection } = require('../../config/db');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const config = require('../../config/env');

const router = express.Router();

router.get('/health', asyncHandler(async (req, res) => {
  const dbStatus = await testConnection();

  const healthInfo = {
    status: 'healthy',
    api: {
      uptimeSeconds: Math.floor(process.uptime()),
      environment: config.env,
      version: '1.0.0'
    },
    database: {
      connected: dbStatus.connected,
      ...(dbStatus.connected
        ? { database: dbStatus.database, user: dbStatus.user }
        : { error: dbStatus.message })
    },
    timestamp: new Date().toISOString()
  };

  return sendSuccess(res, healthInfo, 'Student Election System API v1 is operational');
}));

module.exports = router;
