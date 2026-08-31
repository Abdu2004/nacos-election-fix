const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

describe('System Health & Base API Tests', () => {
  test('GET /api/health should return 200 and standardized healthy status payload', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.message, 'Student Election System API is healthy');
    assert.ok(res.body.timestamp);
    assert.equal(res.body.data.version, '1.0.0');
  });

  test('GET /api/nonexistent-route should return 404 with structured failure payload', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.status, 'fail');
    assert.equal(res.body.errorCode, 'ROUTE_NOT_FOUND');
    assert.ok(res.body.message);
  });
});
