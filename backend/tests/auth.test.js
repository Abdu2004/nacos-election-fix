const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

const { hashPassword, comparePassword, generateOTP, hashOTP, compareOTP } = require('../src/utils/crypto');
const { generateTokens, verifyAccessToken, verifyRefreshToken } = require('../src/utils/token');

describe('Stage 8: Authentication & Cryptographic Unit Tests', () => {

  // 1. Password Cryptography
  test('Password hashing produces secure bcrypt hash and verifies correctly', async () => {
    const rawPassword = 'SecureStudentPassword2026!';
    const hash = await hashPassword(rawPassword);

    assert.notEqual(rawPassword, hash);
    assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));

    const isMatch = await comparePassword(rawPassword, hash);
    assert.equal(isMatch, true, 'Valid password must match hash');

    const isWrongMatch = await comparePassword('WrongPassword123', hash);
    assert.equal(isWrongMatch, false, 'Invalid password must not match hash');
  });

  // 2. OTP Generation & Verification
  test('OTP generator produces 6-digit numeric codes', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateOTP(6);
      assert.equal(otp.length, 6);
      assert.ok(/^\d{6}$/.test(otp), `OTP ${otp} must be strictly numeric`);
    }
  });

  test('OTP hashing and comparison behaves correctly', async () => {
    const otp = '849201';
    const otpHash = await hashOTP(otp);

    assert.notEqual(otp, otpHash);
    const isValid = await compareOTP(otp, otpHash);
    assert.equal(isValid, true);

    const isInvalid = await compareOTP('111111', otpHash);
    assert.equal(isInvalid, false);
  });

  // 3. JWT Tokens
  test('generateTokens produces valid Access and Refresh JWTs', () => {
    const mockUser = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'student.voter@gmail.com',
      role: 'VOTER',
      is_verified: false
    };

    const { accessToken, refreshToken, expiresIn } = generateTokens(mockUser);
    assert.ok(accessToken);
    assert.ok(refreshToken);
    assert.ok(expiresIn);

    // Verify access token
    const decodedAccess = verifyAccessToken(accessToken);
    assert.equal(decodedAccess.id, mockUser.id);
    assert.equal(decodedAccess.email, mockUser.email);
    assert.equal(decodedAccess.role, mockUser.role);
    assert.equal(decodedAccess.is_verified, false);

    // Verify refresh token
    const decodedRefresh = verifyRefreshToken(refreshToken);
    assert.equal(decodedRefresh.id, mockUser.id);
  });

  // 4. Registration Validation Endpoint Tests
  test('POST /api/v1/auth/register rejects non-Gmail address', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Jane Doe',
        admissionNumber: '2026204001',
        email: 'janedoe@yahoo.com',
        password: 'Password123!'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.status, 'fail');
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
    assert.ok(res.body.details.some(d => d.field === 'email'));
  });

  test('POST /api/v1/auth/register rejects password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Jane Doe',
        admissionNumber: '2026204002',
        email: 'janedoe@gmail.com',
        password: 'short'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.status, 'fail');
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
    assert.ok(res.body.details.some(d => d.field === 'password'));
  });

  test('POST /api/v1/auth/register rejects admission number not having 204 as 5th, 6th, and 7th digits', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Jane Doe',
        admissionNumber: '2022205001', // '205' instead of '204'
        email: 'janedoe205@gmail.com',
        password: 'Password123!'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.status, 'fail');
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
    assert.ok(res.body.details.some(d => d.field === 'admissionNumber'));
  });

  test('POST /api/v1/auth/register rejects admission number not exactly 10 digits', async () => {
    const res9 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Jane Doe',
        admissionNumber: '202220401', // 9 digits
        email: 'janedoe9@gmail.com',
        password: 'Password123!'
      });

    assert.equal(res9.status, 400);
    assert.equal(res9.body.status, 'fail');
    assert.equal(res9.body.errorCode, 'VALIDATION_ERROR');
    assert.ok(res9.body.details.some(d => d.field === 'admissionNumber'));

    const res11 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Jane Doe',
        admissionNumber: '20222040001', // 11 digits
        email: 'janedoe11@gmail.com',
        password: 'Password123!'
      });

    assert.equal(res11.status, 400);
    assert.equal(res11.body.status, 'fail');
    assert.equal(res11.body.errorCode, 'VALIDATION_ERROR');
    assert.ok(res11.body.details.some(d => d.field === 'admissionNumber'));
  });

  // 5. OTP Request & Verification Endpoint Validations
  test('POST /api/v1/auth/request-otp rejects non-Gmail address', async () => {
    const res = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ email: 'voter@outlook.com' });

    assert.equal(res.status, 400);
    assert.equal(res.body.status, 'fail');
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
  });

  test('POST /api/v1/auth/verify-otp rejects invalid length OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email: 'student@gmail.com', otp: '123' });

    assert.equal(res.status, 400);
    assert.equal(res.body.status, 'fail');
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
  });

  // 6. Protected Endpoint Authentication Checks
  test('GET /api/v1/auth/me rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.status, 'fail');
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('GET /api/v1/auth/me rejects invalid Bearer token with 401', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid_garbage_token_value');

    assert.equal(res.status, 401);
    assert.equal(res.body.status, 'fail');
  });
});
