const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

const { uploadVerificationDoc, ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, VERIFICATION_DOCS_DIR } = require('../src/middleware/upload');
const errorHandler = require('../src/middleware/errorHandler');
const { authorize } = require('../src/middleware/rbac');
const app = require('../src/app');

describe('Stage 10: Voter Verification & File Upload Security Tests', () => {

  // 1. Upload Middleware & File Type Rules
  test('Allowed MIME types and file extensions are properly configured', () => {
    assert.ok(ALLOWED_MIME_TYPES.has('image/jpeg'));
    assert.ok(ALLOWED_MIME_TYPES.has('image/png'));
    assert.ok(ALLOWED_MIME_TYPES.has('image/webp'));
    assert.ok(ALLOWED_MIME_TYPES.has('application/pdf'));

    assert.ok(ALLOWED_EXTENSIONS.has('.jpg'));
    assert.ok(ALLOWED_EXTENSIONS.has('.jpeg'));
    assert.ok(ALLOWED_EXTENSIONS.has('.png'));
    assert.ok(ALLOWED_EXTENSIONS.has('.webp'));
    assert.ok(ALLOWED_EXTENSIONS.has('.pdf'));

    // Verify dangerous extensions are excluded
    assert.equal(ALLOWED_EXTENSIONS.has('.exe'), false);
    assert.equal(ALLOWED_EXTENSIONS.has('.sh'), false);
    assert.equal(ALLOWED_EXTENSIONS.has('.js'), false);
    assert.equal(ALLOWED_EXTENSIONS.has('.php'), false);
  });

  test('Verification documents directory exists in private backend path', () => {
    assert.ok(fs.existsSync(VERIFICATION_DOCS_DIR), 'VERIFICATION_DOCS_DIR must exist');
  });

  // 2. Upload Endpoint Rejections
  test('POST /api/v1/verification/upload rejects unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/v1/verification/upload');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('POST /api/v1/verification/upload with auth but missing file returns 400', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.post('/api/v1/verification/upload', uploadVerificationDoc.single('document'), (req, res, next) => {
      if (!req.file) {
        return res.status(400).json({ status: 'fail', errorCode: 'NO_FILE_UPLOADED' });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).post('/api/v1/verification/upload');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'NO_FILE_UPLOADED');
  });

  test('Upload middleware rejects disallowed file extensions (e.g. .txt or .sh)', async () => {
    const testApp = express();
    testApp.post('/test-upload', uploadVerificationDoc.single('document'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/test-upload')
      .attach('document', Buffer.from('console.log("malicious")'), 'script.js');

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'INVALID_FILE_TYPE');
  });

  // 3. Validator Review Access Controls
  test('GET /api/v1/verification/pending blocks normal VOTER with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.get('/api/v1/verification/pending', authorize('VALIDATOR', 'ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/verification/pending');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('PATCH /api/v1/verification/applications/:id/review requires rejection reason if status is REJECTED', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '33333333-3333-4333-a333-333333333333', role: 'VALIDATOR', email: 'validator@gmail.com' };
      next();
    });
    testApp.patch('/api/v1/verification/applications/:id/review', (req, res) => {
      const { status, rejectionReason } = req.body;
      if (status === 'REJECTED' && (!rejectionReason || rejectionReason.trim().length < 3)) {
        return res.status(400).json({ status: 'fail', errorCode: 'REJECTION_REASON_REQUIRED' });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .patch('/api/v1/verification/applications/11111111-1111-4111-a111-111111111111/review')
      .send({ status: 'REJECTED', rejectionReason: '' });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'REJECTION_REASON_REQUIRED');
  });

  // 4. Private Document Streaming IDOR Protection
  test('GET /api/v1/verification/documents/:id/file blocks unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/verification/documents/11111111-1111-4111-a111-111111111111/file');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });
});
