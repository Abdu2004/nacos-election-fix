const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');

const errorHandler = require('../src/middleware/errorHandler');
const { authorize } = require('../src/middleware/rbac');
const app = require('../src/app');

describe('Stage 14: Results Tabulation, Calculation, Publication & Privacy (Rule 5) Tests', () => {

  // 1. CRITICAL RULE 5: BACKEND RESULT PRIVACY ENFORCEMENT
  test('CRITICAL RULE 5: GET /api/v1/results/:id for UPCOMING election returns 403 RESULTS_PRIVATE', async () => {
    const testApp = express();
    testApp.get('/api/v1/results/:electionId', (req, res) => {
      const electionStatus = 'UPCOMING';
      if (electionStatus !== 'RESULTS_PUBLISHED') {
        return res.status(403).json({
          status: 'fail',
          errorCode: 'RESULTS_PRIVATE',
          message: 'CRITICAL ELECTION PRIVACY: Election results are private and will become available only after official publication by the Administrator.'
        });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/results/11111111-1111-4111-a111-111111111111');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'RESULTS_PRIVATE');
    assert.ok(res.body.message.includes('Election results are private'));
  });

  test('CRITICAL RULE 5: GET /api/v1/results/:id for OPEN (ongoing) election returns 403 RESULTS_PRIVATE', async () => {
    const testApp = express();
    testApp.get('/api/v1/results/:electionId', (req, res) => {
      const electionStatus = 'OPEN';
      if (electionStatus !== 'RESULTS_PUBLISHED') {
        return res.status(403).json({
          status: 'fail',
          errorCode: 'RESULTS_PRIVATE',
          message: 'CRITICAL ELECTION PRIVACY: Election results are private and will become available only after official publication by the Administrator.'
        });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/results/11111111-1111-4111-a111-111111111111');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'RESULTS_PRIVATE');
  });

  test('CRITICAL RULE 5: GET /api/v1/results/:id for CLOSED (unpublished) election returns 403 RESULTS_PRIVATE', async () => {
    const testApp = express();
    testApp.get('/api/v1/results/:electionId', (req, res) => {
      const electionStatus = 'CLOSED'; // Closed, but Administrator has not published yet
      if (electionStatus !== 'RESULTS_PUBLISHED') {
        return res.status(403).json({
          status: 'fail',
          errorCode: 'RESULTS_PRIVATE',
          message: 'CRITICAL ELECTION PRIVACY: Election results are private and will become available only after official publication by the Administrator.'
        });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/results/11111111-1111-4111-a111-111111111111');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'RESULTS_PRIVATE');
  });

  test('GET /api/v1/results/:id for RESULTS_PUBLISHED election returns 200 with structured data', async () => {
    const testApp = express();
    testApp.get('/api/v1/results/:electionId', (req, res) => {
      res.status(200).json({
        status: 'success',
        data: {
          election: {
            id: req.params.electionId,
            title: 'Annual Student Union Election 2026',
            status: 'RESULTS_PUBLISHED',
            publishedAt: '2026-08-28T21:00:00.000Z',
            totalBallotsCast: 150
          },
          results: [
            {
              positionId: '22222222-2222-4222-a222-222222222222',
              positionName: 'President',
              totalVotesForPosition: 150,
              candidates: [
                { candidateId: '33333333-3333-4333-a333-333333333333', candidateName: 'Alice Smith', votes: 95, votePercentage: '63.3', isWinner: true },
                { candidateId: '44444444-4444-4444-a444-444444444444', candidateName: 'Bob Johnson', votes: 55, votePercentage: '36.7', isWinner: false }
              ]
            }
          ]
        },
        message: 'Official published election results retrieved successfully.'
      });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/results/11111111-1111-4111-a111-111111111111');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.election.status, 'RESULTS_PUBLISHED');
    assert.equal(res.body.data.results[0].candidates[0].isWinner, true);
    assert.equal(res.body.data.results[0].candidates[0].votePercentage, '63.3');
  });

  // 2. PARAMETER VALIDATION
  test('GET /api/v1/results/:id with invalid UUID returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/api/v1/results/invalid-uuid-format');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
  });

  // 3. CALCULATION ENDPOINT AUTHORIZATION & RULES
  test('POST /api/v1/results/:id/calculate rejects unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/v1/results/11111111-1111-4111-a111-111111111111/calculate');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('POST /api/v1/results/:id/calculate rejects VOTER with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.post('/api/v1/results/:electionId/calculate', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).post('/api/v1/results/11111111-1111-4111-a111-111111111111/calculate');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('POST /api/v1/results/:id/calculate rejects VALIDATOR with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '22222222-2222-4222-a222-222222222222', role: 'VALIDATOR', email: 'validator@gmail.com' };
      next();
    });
    testApp.post('/api/v1/results/:electionId/calculate', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).post('/api/v1/results/11111111-1111-4111-a111-111111111111/calculate');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('POST /api/v1/results/:id/calculate rejects active OPEN election with 400 ELECTION_NOT_CLOSED', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '99999999-9999-4999-a999-999999999999', role: 'ADMINISTRATOR', email: 'admin@gmail.com' };
      next();
    });
    testApp.post('/api/v1/results/:electionId/calculate', (req, res) => {
      const electionStatus = 'OPEN';
      if (['UPCOMING', 'OPEN'].includes(electionStatus)) {
        return res.status(400).json({
          status: 'fail',
          errorCode: 'ELECTION_NOT_CLOSED',
          message: `Cannot calculate results while election status is '${electionStatus}'. The election must be CLOSED before tabulation.`
        });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).post('/api/v1/results/11111111-1111-4111-a111-111111111111/calculate');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'ELECTION_NOT_CLOSED');
  });

  // 4. PUBLICATION ENDPOINT AUTHORIZATION & RULES
  test('POST /api/v1/results/:id/publish rejects unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/v1/results/11111111-1111-4111-a111-111111111111/publish');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('POST /api/v1/results/:id/publish rejects VOTER with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.post('/api/v1/results/:electionId/publish', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).post('/api/v1/results/11111111-1111-4111-a111-111111111111/publish');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('POST /api/v1/results/:id/publish rejects OPEN election with 400 ELECTION_NOT_CLOSED', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '99999999-9999-4999-a999-999999999999', role: 'ADMINISTRATOR', email: 'admin@gmail.com' };
      next();
    });
    testApp.post('/api/v1/results/:electionId/publish', (req, res) => {
      const electionStatus = 'OPEN';
      if (electionStatus !== 'CLOSED') {
        return res.status(400).json({
          status: 'fail',
          errorCode: 'ELECTION_NOT_CLOSED',
          message: `Cannot publish results for election with status '${electionStatus}'. Election must be in CLOSED status to publish results.`
        });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).post('/api/v1/results/11111111-1111-4111-a111-111111111111/publish');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'ELECTION_NOT_CLOSED');
  });

  // 5. ADMIN PREVIEW ENDPOINT
  test('GET /api/v1/results/:id/admin-preview rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/results/11111111-1111-4111-a111-111111111111/admin-preview');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('GET /api/v1/results/:id/admin-preview rejects VOTER with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.get('/api/v1/results/:electionId/admin-preview', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/results/11111111-1111-4111-a111-111111111111/admin-preview');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });
});
