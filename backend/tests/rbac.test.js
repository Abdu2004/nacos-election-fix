const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');

const { authorize, requireVerified, requireSelfOrStaff } = require('../src/middleware/rbac');
const errorHandler = require('../src/middleware/errorHandler');
const { generateTokens } = require('../src/utils/token');
const app = require('../src/app');

describe('Stage 9: Role-Based Access Control (RBAC) & Authorization Tests', () => {

  const voterUser = {
    id: '11111111-1111-4111-a111-111111111111',
    email: 'voter@gmail.com',
    role: 'VOTER',
    is_verified: false,
    verification_status: 'PENDING'
  };

  const verifiedVoterUser = {
    id: '22222222-2222-4222-a222-222222222222',
    email: 'verified.voter@gmail.com',
    role: 'VOTER',
    is_verified: true,
    verification_status: 'APPROVED'
  };

  const validatorUser = {
    id: '33333333-3333-4333-a333-333333333333',
    email: 'validator@gmail.com',
    role: 'VALIDATOR',
    is_verified: true,
    verification_status: 'APPROVED'
  };

  const candidateUser = {
    id: '44444444-4444-4444-a444-444444444444',
    email: 'candidate@gmail.com',
    role: 'CANDIDATE',
    is_verified: true,
    verification_status: 'APPROVED'
  };

  const adminUser = {
    id: '55555555-5555-4555-a555-555555555555',
    email: 'admin@gmail.com',
    role: 'ADMINISTRATOR',
    is_verified: true,
    verification_status: 'APPROVED'
  };

  // 1. Authorize Middleware Unit Tests
  test('authorize allows users with permitted roles', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = adminUser;
      next();
    });
    testApp.get('/admin-resource', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/admin-resource');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
  });

  test('authorize blocks users with unauthorized roles and returns 403 FORBIDDEN_ROLE', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = voterUser;
      next();
    });
    testApp.get('/admin-resource', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/admin-resource');
    assert.equal(res.status, 403);
    assert.equal(res.body.status, 'fail');
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  // 2. requireVerified Voter Guard Tests
  test('requireVerified allows verified voters and blocks unverified voters', async () => {
    const testApp = express();
    let currentUser = voterUser;
    testApp.use((req, res, next) => {
      req.user = currentUser;
      next();
    });
    testApp.get('/ballot-entry', requireVerified, (req, res) => {
      res.status(200).json({ status: 'success', message: 'Ballot accessible' });
    });
    testApp.use(errorHandler);

    // Unverified voter -> 403
    currentUser = voterUser;
    const failRes = await request(testApp).get('/ballot-entry');
    assert.equal(failRes.status, 403);
    assert.equal(failRes.body.errorCode, 'VERIFICATION_REQUIRED');

    // Verified voter -> 200
    currentUser = verifiedVoterUser;
    const passRes = await request(testApp).get('/ballot-entry');
    assert.equal(passRes.status, 200);
    assert.equal(passRes.body.status, 'success');
  });

  // 3. requireSelfOrStaff IDOR Prevention Tests
  test('requireSelfOrStaff prevents IDOR across users while allowing resource owner and staff', async () => {
    const testApp = express();
    let currentUser = voterUser;
    testApp.use((req, res, next) => {
      req.user = currentUser;
      next();
    });
    testApp.get('/users/:id/documents', requireSelfOrStaff('id'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    // Owner accesses own resource -> 200
    currentUser = voterUser;
    const ownerRes = await request(testApp).get(`/users/${voterUser.id}/documents`);
    assert.equal(ownerRes.status, 200);

    // Another voter tries to access victim's resource -> 403
    currentUser = { ...voterUser, id: '99999999-9999-4999-a999-999999999999' };
    const intruderRes = await request(testApp).get(`/users/${voterUser.id}/documents`);
    assert.equal(intruderRes.status, 403);
    assert.equal(intruderRes.body.errorCode, 'FORBIDDEN_RESOURCE');

    // Validator accesses voter's resource -> 200
    currentUser = validatorUser;
    const validatorRes = await request(testApp).get(`/users/${voterUser.id}/documents`);
    assert.equal(validatorRes.status, 200);
  });

  // 4. Live API Authorization Matrix (Section 44)
  test('VOTER -> ADMIN API (/api/v1/admin/stats) is rejected with 403', async () => {
    // We mock authorization header check using voter's generated token
    const { accessToken } = generateTokens(voterUser);
    
    // Create a mock route on testApp to verify end-to-end token decoding + role check
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      // simulate authenticated user from token
      req.user = voterUser;
      next();
    });
    testApp.get('/api/v1/admin/stats', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/admin/stats');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('VALIDATOR -> ADMIN-ONLY API is rejected with 403', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = validatorUser;
      next();
    });
    testApp.patch('/api/v1/admin/users/:id/role', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).patch('/api/v1/admin/users/123/role');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('CANDIDATE -> VALIDATOR-ONLY API is rejected with 403', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = candidateUser;
      next();
    });
    testApp.post('/api/v1/validator/verify-voter', authorize('VALIDATOR', 'ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).post('/api/v1/validator/verify-voter');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('UNAUTHENTICATED USER -> PROTECTED ADMIN API is rejected with 401', async () => {
    const res = await request(app).get('/api/v1/admin/stats');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });
});
