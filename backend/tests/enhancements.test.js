const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/config/db');
const { hashPassword, hashOTP } = require('../src/utils/crypto');
const { createNotification } = require('../src/services/notificationService');

describe('System Enhancements: Admin Deletion, Notifications & Password Reset Tests', () => {
  let adminToken;
  let adminId;
  let voterToken;
  let voterId;
  const adminEmail = 'admin.enhancement.suite@gmail.com';
  const voterEmail = 'voter.enhancement.suite@gmail.com';
  const voterAdmission = '2026204999';

  before(async () => {
    // Clean any remnants
    await query('DELETE FROM notifications WHERE user_id IS NOT NULL');
    await query("DELETE FROM notifications WHERE type = 'PING'");
    await query('DELETE FROM users WHERE email IN ($1, $2)', [adminEmail, voterEmail]);

    // 1. Create Admin
    const adminPassHash = await hashPassword('AdminPass123!');
    const adminRes = await query(`
      INSERT INTO users (full_name, admission_number, email, password_hash, role, is_verified, verification_status, status)
      VALUES ('Enhancement Admin', 'ADM/ENH/999', $1, $2, 'ADMINISTRATOR', TRUE, 'APPROVED', 'ACTIVE')
      RETURNING id;
    `, [adminEmail, adminPassHash]);
    adminId = adminRes.rows[0].id;

    // Login Admin
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'AdminPass123!' });
    adminToken = adminLoginRes.body?.data?.tokens?.accessToken;

    // 2. Create Voter
    const voterPassHash = await hashPassword('VoterPass123!');
    const voterRes = await query(`
      INSERT INTO users (full_name, admission_number, email, password_hash, role, is_verified, verification_status, status)
      VALUES ('Enhancement Voter', $1, $2, $3, 'VOTER', TRUE, 'APPROVED', 'ACTIVE')
      RETURNING id;
    `, [voterAdmission, voterEmail, voterPassHash]);
    voterId = voterRes.rows[0].id;

    // Login Voter
    const voterLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: voterEmail, password: 'VoterPass123!' });
    voterToken = voterLoginRes.body?.data?.tokens?.accessToken;
  });

  after(async () => {
    // Cleanup test artifacts
    await query('DELETE FROM notifications WHERE user_id IN ($1, $2)', [adminId, voterId]);
    await query('DELETE FROM otp_verifications WHERE email IN ($1, $2)', [adminEmail, voterEmail]);
  });

  it('Admin can search and list users (GET /api/v1/admin/users)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users?search=Enhancement')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.ok(res.body.data.items.length > 0);
  });

  it('Admin can create a new user with any role (POST /api/v1/admin/users)', async () => {
    const tempEmail = 'temp.voter.create@gmail.com';
    await query('DELETE FROM users WHERE email = $1', [tempEmail]);

    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Temp Created Voter',
        admissionNumber: '2026204001',
        email: tempEmail,
        password: 'Password123!',
        role: 'VOTER',
        isVerified: true
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.user.email, tempEmail);

    // Delete temp user
    const createdUserId = res.body.data.user.id;
    const delRes = await request(app)
      .delete(`/api/v1/admin/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.status, 'success');
  });

  it('User can request password reset OTP (POST /api/v1/auth/forgot-password)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: voterEmail });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
  });

  it('User can reset password with OTP and log in with new password', async () => {
    const knownOtp = '654321';
    const knownHash = await hashOTP(knownOtp);
    await query(
      `INSERT INTO otp_verifications (email, otp_hash, purpose, attempts, max_attempts, is_used, expires_at)
       VALUES ($1, $2, 'PASSWORD_RESET', 0, 3, false, NOW() + INTERVAL '10 minutes')`,
      [voterEmail, knownHash]
    );

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email: voterEmail,
        otp: knownOtp,
        newPassword: 'BrandNewPassword123!'
      });

    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.status, 'success');

    // Now login with new password
    const newLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: voterEmail,
        password: 'BrandNewPassword123!'
      });

    assert.equal(newLoginRes.status, 200);
    assert.equal(newLoginRes.body.status, 'success');
    voterToken = newLoginRes.body?.data?.tokens?.accessToken;
  });

  it('Notifications API: User can retrieve notifications and mark them as read', async () => {
    // Dispatch a test notification
    await createNotification({
      userId: voterId,
      type: 'ANNOUNCEMENT',
      title: 'Test Enhancement Announcement',
      message: 'This is a test notification message'
    });

    const notifRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${voterToken}`);

    assert.equal(notifRes.status, 200);
    assert.equal(notifRes.body.status, 'success');
    assert.ok(notifRes.body.data.notifications.length > 0);

    const notifId = notifRes.body.data.notifications[0].id;

    // Mark single notification read
    const readRes = await request(app)
      .patch(`/api/v1/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${voterToken}`);

    assert.equal(readRes.status, 200);
    assert.equal(readRes.body.status, 'success');

    // Mark all read
    const readAllRes = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${voterToken}`);

    assert.equal(readAllRes.status, 200);
    assert.equal(readAllRes.body.status, 'success');
  });

  it('User can ping verification reviewers (POST /api/v1/notifications/ping-verification)', async () => {
    await query("UPDATE users SET verification_status = 'PENDING' WHERE id = $1", [voterId]);
    await query("DELETE FROM notifications WHERE type = 'PING'");

    const pingRes = await request(app)
      .post('/api/v1/notifications/ping-verification')
      .set('Authorization', `Bearer ${voterToken}`)
      .send({ type: 'voter' });

    assert.equal(pingRes.status, 200);
    assert.equal(pingRes.body.status, 'success');
  });

  it('Admin can delete an election cleanly (DELETE /api/v1/admin/elections/:id)', async () => {
    // Create an election to delete
    const createElecRes = await request(app)
      .post('/api/v1/elections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Temporary Test Election To Delete',
        description: 'Election for testing admin delete',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString()
      });

    const tempElectionId = createElecRes.body?.data?.election?.id;
    assert.ok(tempElectionId);

    // Delete election
    const delRes = await request(app)
      .delete(`/api/v1/admin/elections/${tempElectionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.status, 'success');

    // Confirm it's deleted
    const checkRes = await query('SELECT id FROM elections WHERE id = $1', [tempElectionId]);
    assert.equal(checkRes.rows.length, 0);
  });
});
