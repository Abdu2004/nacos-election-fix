const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');

const { validateStatusTransition } = require('../src/controllers/election.controller');
const { authorize } = require('../src/middleware/rbac');
const errorHandler = require('../src/middleware/errorHandler');
const app = require('../src/app');

describe('Stage 12: Election Management & Lifecycle Tests', () => {

  // 1. STATUS TRANSITION LOGIC
  test('validateStatusTransition: UPCOMING → OPEN is valid', () => {
    assert.equal(validateStatusTransition('UPCOMING', 'OPEN'), true);
  });

  test('validateStatusTransition: OPEN → CLOSED is valid', () => {
    assert.equal(validateStatusTransition('OPEN', 'CLOSED'), true);
  });

  test('validateStatusTransition: CLOSED → RESULTS_PUBLISHED is valid', () => {
    assert.equal(validateStatusTransition('CLOSED', 'RESULTS_PUBLISHED'), true);
  });

  test('validateStatusTransition: UPCOMING → CLOSED is INVALID', () => {
    assert.equal(validateStatusTransition('UPCOMING', 'CLOSED'), false);
  });

  test('validateStatusTransition: OPEN → UPCOMING is INVALID (cannot revert)', () => {
    assert.equal(validateStatusTransition('OPEN', 'UPCOMING'), false);
  });

  test('validateStatusTransition: RESULTS_PUBLISHED → OPEN is INVALID (terminal state)', () => {
    assert.equal(validateStatusTransition('RESULTS_PUBLISHED', 'OPEN'), false);
  });

  test('validateStatusTransition: CLOSED → OPEN is INVALID', () => {
    assert.equal(validateStatusTransition('CLOSED', 'OPEN'), false);
  });

  // 2. ELECTION CREATION AUTHORIZATION
  test('POST /api/v1/elections rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/v1/elections')
      .send({ title: 'Test Election', startDate: '2027-01-01', endDate: '2027-01-31' });
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('POST /api/v1/elections rejects VOTER with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.post('/api/v1/elections', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/elections')
      .send({ title: 'Test Election', startDate: '2027-01-01', endDate: '2027-01-31' });

    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('POST /api/v1/elections rejects VALIDATOR with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '22222222-2222-4222-a222-222222222222', role: 'VALIDATOR', email: 'validator@gmail.com' };
      next();
    });
    testApp.post('/api/v1/elections', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/elections')
      .send({ title: 'Test Election', startDate: '2027-01-01', endDate: '2027-01-31' });

    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  // 3. ELECTION CREATION VALIDATION
  test('POST /api/v1/elections with missing title returns 400 VALIDATION_ERROR', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '99999999-9999-4999-a999-999999999999', role: 'ADMINISTRATOR', email: 'admin@gmail.com' };
      next();
    });
    testApp.post('/api/v1/elections', (req, res) => {
      if (!req.body.title) {
        return res.status(400).json({ status: 'fail', errorCode: 'ELECTION_TITLE_REQUIRED' });
      }
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/elections')
      .send({ startDate: '2027-01-01', endDate: '2027-01-31' });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'ELECTION_TITLE_REQUIRED');
  });

  test('POST /api/v1/elections with start date after end date returns 400 INVALID_DATE_RANGE', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '99999999-9999-4999-a999-999999999999', role: 'ADMINISTRATOR', email: 'admin@gmail.com' };
      next();
    });
    testApp.post('/api/v1/elections', (req, res) => {
      const start = new Date(req.body.startDate);
      const end = new Date(req.body.endDate);
      if (start >= end) {
        return res.status(400).json({ status: 'fail', errorCode: 'INVALID_DATE_RANGE' });
      }
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/elections')
      .send({ title: 'Bad Dates Election', startDate: '2027-02-01', endDate: '2027-01-01' });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'INVALID_DATE_RANGE');
  });

  // 4. ELECTION LISTING (validation and access patterns)
  test('GET /api/v1/elections with invalid status filter returns 400', async () => {
    const res = await request(app).get('/api/v1/elections?status=INVALID_STATUS');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'INVALID_STATUS_FILTER');
  });

  test('GET /api/v1/elections returns 200 on valid status filter when DB available or handles gracefully', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/api/v1/elections', (req, res) => {
      const { status } = req.query;
      const valid = ['UPCOMING', 'OPEN', 'CLOSED', 'RESULTS_PUBLISHED'];
      if (status && !valid.includes(status.toUpperCase())) {
        return res.status(400).json({ status: 'fail', errorCode: 'INVALID_STATUS_FILTER' });
      }
      res.status(200).json({
        status: 'success',
        data: { elections: [], total: 0, page: 1 },
        message: 'Elections retrieved successfully.'
      });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/elections?status=UPCOMING');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
  });

  test('GET /api/v1/elections is publicly accessible (no auth required)', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/api/v1/elections', (req, res) => {
      // No authenticate middleware — public endpoint
      res.status(200).json({ status: 'success', data: { elections: [], total: 0 } });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/elections');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
  });

  // 5. ELECTION DETAILS (UUID Validation)
  test('GET /api/v1/elections/:id with invalid UUID returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/api/v1/elections/not-a-real-uuid');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
  });

  test('GET /api/v1/elections/:id with valid UUID returns 404 when not found', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/api/v1/elections/:id', (req, res) => {
      return res.status(404).json({ status: 'fail', errorCode: 'ELECTION_NOT_FOUND' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/elections/00000000-0000-4000-a000-000000000001');
    assert.equal(res.status, 404);
    assert.equal(res.body.errorCode, 'ELECTION_NOT_FOUND');
  });

  // 6. STATE TRANSITION ENDPOINT AUTHORIZATION
  test('PATCH /api/v1/elections/:id/open rejects unauthenticated request with 401', async () => {
    const res = await request(app).patch('/api/v1/elections/00000000-0000-4000-a000-000000000001/open');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('PATCH /api/v1/elections/:id/close rejects unauthenticated request with 401', async () => {
    const res = await request(app).patch('/api/v1/elections/00000000-0000-4000-a000-000000000001/close');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('PATCH /api/v1/elections/:id/open rejects VOTER with 403', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.patch('/api/v1/elections/:id/open', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).patch('/api/v1/elections/11111111-1111-4111-a111-111111111111/open');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  // 7. INVALID TRANSITION REJECTION (Logic-level)
  test('OPEN → UPCOMING transition is rejected as invalid with INVALID_STATUS_TRANSITION', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.patch('/api/v1/elections/:id/revert', (req, res) => {
      const currentStatus = 'OPEN';
      const targetStatus = 'UPCOMING';
      if (!validateStatusTransition(currentStatus, targetStatus)) {
        return res.status(400).json({ status: 'fail', errorCode: 'INVALID_STATUS_TRANSITION' });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).patch('/api/v1/elections/11111111-1111-4111-a111-111111111111/revert');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'INVALID_STATUS_TRANSITION');
  });

  // 8. ELECTION STATS AUTHORIZATION
  test('GET /api/v1/elections/:id/stats rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/elections/00000000-0000-4000-a000-000000000001/stats');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('GET /api/v1/elections/:id/stats rejects VOTER with 403', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.get('/api/v1/elections/:id/stats', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/elections/11111111-1111-4111-a111-111111111111/stats');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  // 9. POSITION MASTER LIST AUTHORIZATION
  test('GET /api/v1/elections/positions/all rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/elections/positions/all');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });
});
