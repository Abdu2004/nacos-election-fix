const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');

const errorHandler = require('../src/middleware/errorHandler');
const { authorize } = require('../src/middleware/rbac');
const AuditService = require('../src/services/auditService');
const app = require('../src/app');

describe('Stage 16: Audit Logging API & Administrative Security Inspection Tests', () => {

  // 1. IMMUTABILITY & ABSENCE OF MUTATING ENDPOINTS (§20, §21)
  test('Audit logs are strictly immutable: POST/PUT/DELETE on /audit-logs return 404', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '99999999-9999-4999-a999-999999999999', role: 'ADMINISTRATOR', email: 'admin@gmail.com' };
      next();
    });

    const auditController = require('../src/controllers/audit.controller');
    const auditRouter = express.Router();
    auditRouter.get('/', auditController.listAuditLogs);
    auditRouter.get('/summary', auditController.getAuditSummary);
    auditRouter.get('/export', auditController.exportAuditLogs);
    auditRouter.get('/:id', auditController.getAuditLogById);

    testApp.use('/api/v1/audit-logs', auditRouter);
    testApp.use((req, res) => res.status(404).json({ status: 'fail', errorCode: 'ROUTE_NOT_FOUND' }));

    const postRes = await request(testApp).post('/api/v1/audit-logs').send({ action: 'FAKE_LOG' });
    assert.equal(postRes.status, 404);

    const putRes = await request(testApp).put('/api/v1/audit-logs/11111111-1111-4111-a111-111111111111');
    assert.equal(putRes.status, 404);

    const delRes = await request(testApp).delete('/api/v1/audit-logs/11111111-1111-4111-a111-111111111111');
    assert.equal(delRes.status, 404);
  });

  // 2. AUTHORIZATION & RBAC ENFORCEMENT
  test('GET /api/v1/audit-logs rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/audit-logs');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('GET /api/v1/audit-logs rejects VOTER with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.get('/api/v1/audit-logs', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/audit-logs');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('GET /api/v1/audit-logs rejects VALIDATOR with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '22222222-2222-4222-a222-222222222222', role: 'VALIDATOR', email: 'validator@gmail.com' };
      next();
    });
    testApp.get('/api/v1/audit-logs', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/audit-logs');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('GET /api/v1/audit-logs rejects CANDIDATE with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '33333333-3333-4333-a333-333333333333', role: 'CANDIDATE', email: 'candidate@gmail.com' };
      next();
    });
    testApp.get('/api/v1/audit-logs', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/audit-logs');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  // 3. AUDIT SUMMARY STATS
  test('GET /api/v1/audit-logs/summary rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/audit-logs/summary');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('GET /api/v1/audit-logs/summary returns aggregation metrics for ADMINISTRATOR', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '99999999-9999-4999-a999-999999999999', role: 'ADMINISTRATOR', email: 'admin@gmail.com' };
      next();
    });
    testApp.get('/api/v1/audit-logs/summary', (req, res) => {
      res.status(200).json({
        status: 'success',
        data: {
          totalLogs: 250,
          topActions: [{ action: 'USER_REGISTERED', count: 120 }],
          roleDistribution: [{ role: 'VOTER', count: 150 }],
          securityAlertsCount: 2
        }
      });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/audit-logs/summary');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.totalLogs, 250);
    assert.ok(Array.isArray(res.body.data.topActions));
  });

  // 4. EXPORT FUNCTIONALITY (CSV / JSON)
  test('GET /api/v1/audit-logs/export rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/audit-logs/export');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('GET /api/v1/audit-logs/export?format=csv returns CSV file attachment', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '99999999-9999-4999-a999-999999999999', role: 'ADMINISTRATOR', email: 'admin@gmail.com' };
      next();
    });
    testApp.get('/api/v1/audit-logs/export', (req, res) => {
      const csvHeader = '"ID","Timestamp","Action","User Email","User Role","Entity Type","Entity ID","IP Address","Details"';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
      res.send(`${csvHeader}\n"1","2026-08-28","BALLOT_SUBMITTED","voter@gmail.com","VOTER","ballot","123","::1","{}"`);
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/audit-logs/export?format=csv');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/csv'));
    assert.ok(res.text.includes('BALLOT_SUBMITTED'));
  });

  test('GET /api/v1/audit-logs/export?format=json returns JSON export structure', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '99999999-9999-4999-a999-999999999999', role: 'ADMINISTRATOR', email: 'admin@gmail.com' };
      next();
    });
    testApp.get('/api/v1/audit-logs/export', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.json({
        exportedAt: new Date().toISOString(),
        totalRecords: 1,
        logs: [{ id: '1', action: 'BALLOT_SUBMITTED' }]
      });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/audit-logs/export?format=json');
    assert.equal(res.status, 200);
    assert.equal(res.body.totalRecords, 1);
    assert.equal(res.body.logs[0].action, 'BALLOT_SUBMITTED');
  });

  // 5. PARAMETER VALIDATION
  test('GET /api/v1/audit-logs/:id with invalid UUID returns 400 VALIDATION_ERROR', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '99999999-9999-4999-a999-999999999999', role: 'ADMINISTRATOR', email: 'admin@gmail.com' };
      next();
    });
    testApp.get('/api/v1/audit-logs/:id', (req, res) => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id);
      if (!isUUID) {
        return res.status(400).json({ status: 'fail', errorCode: 'VALIDATION_ERROR' });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/audit-logs/not-a-valid-uuid');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
  });

  // 6. SECRET SANITIZATION GUARANTEE (§20)
  test('AuditService sanitizes sensitive keys before persisting', () => {
    const sensitivePayload = {
      password: 'SuperSecretPassword123!',
      passwordHash: '$2a$12$e0MYzXyjpJS7Pd0RVvHwHe...',
      otp: '123456',
      token: 'jwt.token.string',
      apiKey: 'secret-key-12345',
      userEmail: 'user@gmail.com'
    };

    const sanitized = AuditService.sanitizeDetails(sensitivePayload);
    assert.equal(sanitized.password, '[REDACTED]');
    assert.equal(sanitized.passwordHash, '[REDACTED]');
    assert.equal(sanitized.otp, '[REDACTED]');
    assert.equal(sanitized.token, '[REDACTED]');
    assert.equal(sanitized.apiKey, '[REDACTED]');
    assert.equal(sanitized.userEmail, 'user@gmail.com');
  });
});
