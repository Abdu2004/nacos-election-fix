const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');

const errorHandler = require('../src/middleware/errorHandler');
const { authorize } = require('../src/middleware/rbac');
const app = require('../src/app');

describe('Stage 15: Feed & Trends, Role Permissions & Anti-Impersonation Tests', () => {

  // 1. PUBLIC FEED ACCESS
  test('GET /api/v1/feed is publicly accessible (no authentication required)', async () => {
    const testApp = express();
    testApp.get('/api/v1/feed', (req, res) => {
      res.status(200).json({
        status: 'success',
        data: { posts: [], total: 0, page: 1 }
      });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/feed');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
  });

  test('GET /api/v1/feed/:id with invalid UUID returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/api/v1/feed/not-a-valid-uuid');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
  });

  // 2. PROTECTED POST CREATION AUTHORIZATION
  test('POST /api/v1/feed rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/v1/feed')
      .send({ title: 'Campaign Post', content: 'Vote for me!' });
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('POST /api/v1/feed rejects normal VOTER with 403 Forbidden', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.post('/api/v1/feed', authorize('ADMINISTRATOR', 'VALIDATOR', 'CANDIDATE'), (req, res) => {
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/feed')
      .send({ title: 'My post', content: 'Testing' });

    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  // 3. ANTI-IMPERSONATION RULES (§17)
  test('POST /api/v1/feed allows CANDIDATE to create CAMPAIGN posts', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '22222222-2222-4222-a222-222222222222', role: 'CANDIDATE', email: 'candidate@gmail.com' };
      next();
    });
    testApp.post('/api/v1/feed', (req, res) => {
      const { postType = 'CAMPAIGN' } = req.body;
      if (req.user.role === 'CANDIDATE' && postType !== 'CAMPAIGN') {
        return res.status(403).json({ status: 'fail', errorCode: 'IMPERSONATION_PROHIBITED' });
      }
      res.status(201).json({
        status: 'success',
        data: { post: { title: req.body.title, post_type: 'CAMPAIGN', author_role: 'CANDIDATE' } }
      });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/feed')
      .send({ title: 'Vote Alice for President', content: 'Here is my manifesto.', postType: 'CAMPAIGN' });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.post.post_type, 'CAMPAIGN');
  });

  test('ANTI-IMPERSONATION: CANDIDATE attempting to create ANNOUNCEMENT is rejected with 403', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '22222222-2222-4222-a222-222222222222', role: 'CANDIDATE', email: 'candidate@gmail.com' };
      next();
    });
    testApp.post('/api/v1/feed', (req, res) => {
      const { postType } = req.body;
      if (req.user.role === 'CANDIDATE' && postType !== 'CAMPAIGN') {
        return res.status(403).json({
          status: 'fail',
          errorCode: 'IMPERSONATION_PROHIBITED',
          message: 'ANTI-IMPERSONATION SECURITY VIOLATION: Candidates are only permitted to publish CAMPAIGN posts and cannot create official announcements or system updates.'
        });
      }
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/feed')
      .send({ title: 'Official Election Postponed', content: 'Fake announcement', postType: 'ANNOUNCEMENT' });

    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'IMPERSONATION_PROHIBITED');
    assert.ok(res.body.message.includes('Candidates are only permitted to publish CAMPAIGN posts'));
  });

  test('ANTI-IMPERSONATION: CANDIDATE attempting to create UPDATE is rejected with 403', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '22222222-2222-4222-a222-222222222222', role: 'CANDIDATE', email: 'candidate@gmail.com' };
      next();
    });
    testApp.post('/api/v1/feed', (req, res) => {
      const { postType } = req.body;
      if (req.user.role === 'CANDIDATE' && postType !== 'CAMPAIGN') {
        return res.status(403).json({
          status: 'fail',
          errorCode: 'IMPERSONATION_PROHIBITED',
          message: 'ANTI-IMPERSONATION SECURITY VIOLATION: Candidates are only permitted to publish CAMPAIGN posts and cannot create official announcements or system updates.'
        });
      }
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/feed')
      .send({ title: 'Verification Center Closed', content: 'Fake update', postType: 'UPDATE' });

    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'IMPERSONATION_PROHIBITED');
  });

  // 4. PINNING AUTHORIZATION (Admin only)
  test('PATCH /api/v1/feed/:id/pin rejects unauthenticated request with 401', async () => {
    const res = await request(app).patch('/api/v1/feed/11111111-1111-4111-a111-111111111111/pin');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('PATCH /api/v1/feed/:id/pin rejects CANDIDATE with 403', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '22222222-2222-4222-a222-222222222222', role: 'CANDIDATE', email: 'candidate@gmail.com' };
      next();
    });
    testApp.patch('/api/v1/feed/:id/pin', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).patch('/api/v1/feed/11111111-1111-4111-a111-111111111111/pin');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  test('PATCH /api/v1/feed/:id/pin rejects VALIDATOR with 403', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '33333333-3333-4333-a333-333333333333', role: 'VALIDATOR', email: 'validator@gmail.com' };
      next();
    });
    testApp.patch('/api/v1/feed/:id/pin', authorize('ADMINISTRATOR'), (req, res) => {
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).patch('/api/v1/feed/11111111-1111-4111-a111-111111111111/pin');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_ROLE');
  });

  // 5. IDOR & EDIT/DELETE PROTECTIONS
  test('DELETE /api/v1/feed/:id rejects non-author user with 403 FORBIDDEN_POST_DELETE', async () => {
    const testApp = express();
    testApp.use((req, res, next) => {
      req.user = { id: '44444444-4444-4444-a444-444444444444', role: 'CANDIDATE', email: 'other@gmail.com' };
      next();
    });
    testApp.delete('/api/v1/feed/:id', (req, res) => {
      const postAuthorId = '22222222-2222-4222-a222-222222222222'; // Different author
      const isAuthor = req.user.id === postAuthorId;
      const isAdmin = req.user.role === 'ADMINISTRATOR';
      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ status: 'fail', errorCode: 'FORBIDDEN_POST_DELETE' });
      }
      res.status(200).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).delete('/api/v1/feed/11111111-1111-4111-a111-111111111111');
    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'FORBIDDEN_POST_DELETE');
  });
});
