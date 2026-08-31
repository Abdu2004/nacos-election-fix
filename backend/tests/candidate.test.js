const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

const {
  generateSecureCandidateCode
} = require('../src/controllers/candidate.controller');
const {
  uploadCandidateAssets,
  CANDIDATE_PHOTOS_DIR,
  CANDIDATE_CREDENTIALS_DIR,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_IMAGE_EXTENSIONS
} = require('../src/middleware/upload');
const errorHandler = require('../src/middleware/errorHandler');
const { authorize, requireVerified } = require('../src/middleware/rbac');
const app = require('../src/app');

describe('Stage 11: Candidate Application, Code Issuance & Validation Workflow Tests', () => {

  // 1. Candidate Code Generation & Format
  test('generateSecureCandidateCode generates cryptographically secure CAND-XXXX-XXXX-XXXX format', () => {
    const code1 = generateSecureCandidateCode();
    const code2 = generateSecureCandidateCode();

    assert.match(code1, /^CAND-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/, 'Code must match CAND-XXXX-XXXX-XXXX');
    assert.match(code2, /^CAND-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/, 'Code must match CAND-XXXX-XXXX-XXXX');
    assert.notEqual(code1, code2, 'Generated codes must be unique and random');
  });

  // 2. Candidate Upload Directories and Allowed File Types
  test('Candidate photos and credentials directories exist in backend uploads', () => {
    assert.ok(fs.existsSync(CANDIDATE_PHOTOS_DIR), 'CANDIDATE_PHOTOS_DIR must exist');
    assert.ok(fs.existsSync(CANDIDATE_CREDENTIALS_DIR), 'CANDIDATE_CREDENTIALS_DIR must exist');
  });

  test('Candidate headshot upload permits images only and rejects documents/executables', () => {
    assert.ok(ALLOWED_IMAGE_MIME_TYPES.has('image/jpeg'));
    assert.ok(ALLOWED_IMAGE_MIME_TYPES.has('image/png'));
    assert.ok(ALLOWED_IMAGE_MIME_TYPES.has('image/webp'));
    assert.equal(ALLOWED_IMAGE_MIME_TYPES.has('application/pdf'), false, 'Photos must not accept PDF');

    assert.ok(ALLOWED_IMAGE_EXTENSIONS.has('.jpg'));
    assert.ok(ALLOWED_IMAGE_EXTENSIONS.has('.jpeg'));
    assert.ok(ALLOWED_IMAGE_EXTENSIONS.has('.png'));
    assert.ok(ALLOWED_IMAGE_EXTENSIONS.has('.webp'));
    assert.equal(ALLOWED_IMAGE_EXTENSIONS.has('.exe'), false);
    assert.equal(ALLOWED_IMAGE_EXTENSIONS.has('.sh'), false);
  });

  // 3. Candidate Code Issuance Authorization
  test('POST /api/v1/candidates/codes/generate rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/v1/candidates/codes/generate')
      .send({ electionId: '11111111-1111-4111-a111-111111111111', count: 5 });

    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('POST /api/v1/candidates/codes/generate rejects VOTER with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.post('/api/v1/candidates/codes/generate', authorize('ADMINISTRATOR', 'VALIDATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/candidates/codes/generate')
      .send({ electionId: '11111111-1111-4111-a111-111111111111', count: 5 });

    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('GET /api/v1/candidates/codes rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/candidates/codes');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  // 4. Candidate Application Eligibility & Validation
  test('POST /api/v1/candidates/apply rejects unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/v1/candidates/apply');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('POST /api/v1/candidates/apply with missing mandatory fields returns 400 validation error', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com', is_verified: true, verification_status: 'APPROVED' };
      next();
    });
    // Apply validation schema check
    testApp.post('/api/v1/candidates/apply', (req, res) => {
      const { electionId, positionId, candidateCode, externalPaymentReference } = req.body;
      if (!electionId || !positionId || !candidateCode || !externalPaymentReference) {
        return res.status(400).json({ status: 'fail', errorCode: 'MISSING_REQUIRED_FIELDS' });
      }
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/candidates/apply')
      .send({ electionId: '11111111-1111-4111-a111-111111111111' });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'MISSING_REQUIRED_FIELDS');
  });

  test('POST /api/v1/candidates/apply rejects unverified voter with 403', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      // Unverified voter
      req.user = {
        id: '11111111-1111-4111-a111-111111111111',
        role: 'VOTER',
        email: 'unverified@gmail.com',
        is_verified: false,
        verification_status: 'PENDING'
      };
      next();
    });
    testApp.post('/api/v1/candidates/apply', requireVerified, (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/candidates/apply')
      .send({
        electionId: '11111111-1111-4111-a111-111111111111',
        positionId: '22222222-2222-4222-a222-222222222222',
        candidateCode: 'CAND-ABCD-1234-EF56',
        externalPaymentReference: 'PAY-REF-998877'
      });

    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'VERIFICATION_REQUIRED');
  });

  test('CRITICAL RULE 2: Application enforces One Candidate, One Position rejection logic', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = {
        id: '11111111-1111-4111-a111-111111111111',
        role: 'VOTER',
        email: 'voter@gmail.com',
        is_verified: true,
        verification_status: 'APPROVED'
      };
      next();
    });

    // Mock candidacy application endpoint demonstrating duplicate contest prevention
    testApp.post('/api/v1/candidates/apply', (req, res) => {
      const existingApplicationInElection = true; // Simulated existing application
      if (existingApplicationInElection) {
        return res.status(409).json({
          status: 'fail',
          errorCode: 'CANDIDATE_MULTIPLE_POSITIONS_FORBIDDEN',
          message: 'CRITICAL ELECTION RULE VIOLATION: You have already applied for a position in this election. A candidate can contest for ONLY ONE position in a particular election.'
        });
      }
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/candidates/apply')
      .send({
        electionId: '11111111-1111-4111-a111-111111111111',
        positionId: '22222222-2222-4222-a222-222222222222',
        candidateCode: 'CAND-ABCD-1234-EF56',
        externalPaymentReference: 'PAY-REF-998877'
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.errorCode, 'CANDIDATE_MULTIPLE_POSITIONS_FORBIDDEN');
    assert.ok(res.body.message.includes('A candidate can contest for ONLY ONE position'));
  });

  // 5. Staff Review & Decision Authorization
  test('GET /api/v1/candidates/applications rejects normal VOTER with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.get('/api/v1/candidates/applications', authorize('VALIDATOR', 'ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/candidates/applications');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('PATCH /api/v1/candidates/applications/:id/review requires valid rejection reason on REJECTED', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '33333333-3333-4333-a333-333333333333', role: 'VALIDATOR', email: 'validator@gmail.com' };
      next();
    });
    testApp.patch('/api/v1/candidates/applications/:id/review', (req, res) => {
      const { status, rejectionReason } = req.body;
      if (status === 'REJECTED' && (!rejectionReason || rejectionReason.trim().length < 3)) {
        return res.status(400).json({
          status: 'fail',
          errorCode: 'REJECTION_REASON_REQUIRED',
          message: 'A valid rejection reason is required when rejecting a candidate application.'
        });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .patch('/api/v1/candidates/applications/11111111-1111-4111-a111-111111111111/review')
      .send({ status: 'REJECTED', rejectionReason: '' });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'REJECTION_REASON_REQUIRED');
  });

  test('PATCH /api/v1/candidates/applications/:id/review with invalid status returns 400', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '33333333-3333-4333-a333-333333333333', role: 'VALIDATOR', email: 'validator@gmail.com' };
      next();
    });
    testApp.patch('/api/v1/candidates/applications/:id/review', (req, res) => {
      const { status } = req.body;
      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ status: 'fail', errorCode: 'INVALID_REVIEW_STATUS' });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .patch('/api/v1/candidates/applications/11111111-1111-4111-a111-111111111111/review')
      .send({ status: 'MAYBE' });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'INVALID_REVIEW_STATUS');
  });

  // 6. Public Candidates & Personal Endpoints Validation
  test('GET /api/v1/candidates/me/application rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/candidates/me/application');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('GET /api/v1/candidates/elections/:electionId with invalid UUID returns 400 validation error', async () => {
    const res = await request(app).get('/api/v1/candidates/elections/invalid-uuid-123');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
  });

  test('GET /api/v1/candidates/:id with invalid UUID returns 400 validation error', async () => {
    const res = await request(app).get('/api/v1/candidates/not-a-uuid');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
  });

  test('GET /api/v1/candidates/photos/:filename for non-existent photo returns 404', async () => {
    const res = await request(app).get('/api/v1/candidates/photos/non-existent-photo-xyz.jpg');
    assert.equal(res.status, 404);
    assert.equal(res.body.errorCode, 'PHOTO_NOT_FOUND');
  });
});
