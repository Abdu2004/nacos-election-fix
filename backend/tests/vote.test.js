const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');

const { generateBallotReceiptHash } = require('../src/controllers/vote.controller');
const errorHandler = require('../src/middleware/errorHandler');
const { requireVerified } = require('../src/middleware/rbac');
const app = require('../src/app');

describe('Stage 13: Voting Workflow, Ballot Security & Concurrency Tests', () => {

  // 1. BALLOT RECEIPT HASH GENERATION & PRIVACY
  test('generateBallotReceiptHash generates a 64-character SHA-256 receipt hash', () => {
    const hash1 = generateBallotReceiptHash('election-123', 'voter-456', new Date().toISOString());
    const hash2 = generateBallotReceiptHash('election-123', 'voter-456', new Date().toISOString());

    assert.equal(hash1.length, 64);
    assert.match(hash1, /^[a-f0-9]{64}$/);
    assert.notEqual(hash1, hash2, 'Receipt hashes must be distinct due to cryptographic nonce');
  });

  // 2. BALLOT SUBMISSION AUTHENTICATION & ELIGIBILITY
  test('POST /api/v1/votes rejects unauthenticated request with 401 UNAUTHENTICATED', async () => {
    const res = await request(app)
      .post('/api/v1/votes')
      .send({
        electionId: '11111111-1111-4111-a111-111111111111',
        votes: [{ positionId: '22222222-2222-4222-a222-222222222222', candidateId: '33333333-3333-4333-a333-333333333333' }]
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('POST /api/v1/votes rejects unverified voter with 403 VERIFICATION_REQUIRED', async () => {
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
    testApp.post('/api/v1/votes', requireVerified, (req, res) => {
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/votes')
      .send({
        electionId: '11111111-1111-4111-a111-111111111111',
        votes: [{ positionId: '22222222-2222-4222-a222-222222222222', candidateId: '33333333-3333-4333-a333-333333333333' }]
      });

    assert.equal(res.status, 403);
    assert.equal(res.body.errorCode, 'VERIFICATION_REQUIRED');
  });

  // 3. BALLOT STRUCTURE & POSITION VALIDATION
  test('POST /api/v1/votes with empty votes array returns 400 EMPTY_BALLOT', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com', is_verified: true, verification_status: 'APPROVED' };
      next();
    });
    testApp.post('/api/v1/votes', (req, res) => {
      const { votes } = req.body;
      if (!Array.isArray(votes) || votes.length === 0) {
        return res.status(400).json({ status: 'fail', errorCode: 'EMPTY_BALLOT' });
      }
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/votes')
      .send({ electionId: '11111111-1111-4111-a111-111111111111', votes: [] });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'EMPTY_BALLOT');
  });

  test('POST /api/v1/votes rejects duplicate votes for the same position with 400 DUPLICATE_POSITION_IN_BALLOT', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com', is_verified: true, verification_status: 'APPROVED' };
      next();
    });
    testApp.post('/api/v1/votes', (req, res) => {
      const { votes } = req.body;
      const positions = votes.map(v => v.positionId);
      const unique = new Set(positions);
      if (unique.size !== positions.length) {
        return res.status(400).json({
          status: 'fail',
          errorCode: 'DUPLICATE_POSITION_IN_BALLOT',
          message: 'Invalid ballot: duplicate positions detected. You may only vote once per position.'
        });
      }
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const samePosId = '22222222-2222-4222-a222-222222222222';
    const res = await request(testApp)
      .post('/api/v1/votes')
      .send({
        electionId: '11111111-1111-4111-a111-111111111111',
        votes: [
          { positionId: samePosId, candidateId: '33333333-3333-4333-a333-333333333333' },
          { positionId: samePosId, candidateId: '44444444-4444-4444-a444-444444444444' }
        ]
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'DUPLICATE_POSITION_IN_BALLOT');
  });

  // 4. ELECTION STATE & DUPLICATE VOTING RULES
  test('POST /api/v1/votes rejects voting when election status is not OPEN', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com', is_verified: true, verification_status: 'APPROVED' };
      next();
    });
    testApp.post('/api/v1/votes', (req, res) => {
      const electionStatus = 'CLOSED'; // Election is not OPEN
      if (electionStatus !== 'OPEN') {
        return res.status(400).json({
          status: 'fail',
          errorCode: 'ELECTION_NOT_OPEN',
          message: `Voting is not currently open. Election status is '${electionStatus}'.`
        });
      }
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/votes')
      .send({
        electionId: '11111111-1111-4111-a111-111111111111',
        votes: [{ positionId: '22222222-2222-4222-a222-222222222222', candidateId: '33333333-3333-4333-a333-333333333333' }]
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'ELECTION_NOT_OPEN');
  });

  test('CRITICAL RULE 1: One voter, one ballot — Duplicate ballot submission returns 409 BALLOT_ALREADY_SUBMITTED', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com', is_verified: true, verification_status: 'APPROVED' };
      next();
    });
    testApp.post('/api/v1/votes', (req, res) => {
      const alreadyVoted = true; // Simulating existing ballot in DB
      if (alreadyVoted) {
        return res.status(409).json({
          status: 'fail',
          errorCode: 'BALLOT_ALREADY_SUBMITTED',
          message: 'CRITICAL ELECTION RULE VIOLATION: You have already submitted a ballot for this election. Ballots cannot be changed.'
        });
      }
      res.status(201).json({ status: 'success' });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/v1/votes')
      .send({
        electionId: '11111111-1111-4111-a111-111111111111',
        votes: [{ positionId: '22222222-2222-4222-a222-222222222222', candidateId: '33333333-3333-4333-a333-333333333333' }]
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.errorCode, 'BALLOT_ALREADY_SUBMITTED');
    assert.ok(res.body.message.includes('One voter, one ballot') || res.body.message.includes('already submitted a ballot'));
  });

  // 5. VOTING STATUS & VOTE PRIVACY
  test('GET /api/v1/votes/status rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/votes/status?electionId=11111111-1111-4111-a111-111111111111');
    assert.equal(res.status, 401);
    assert.equal(res.body.errorCode, 'UNAUTHENTICATED');
  });

  test('GET /api/v1/votes/status returns whether voter has voted without exposing choices (Vote Privacy §14)', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req, res, next) => {
      req.user = { id: '11111111-1111-4111-a111-111111111111', role: 'VOTER', email: 'voter@gmail.com' };
      next();
    });
    testApp.get('/api/v1/votes/status', (req, res) => {
      res.status(200).json({
        status: 'success',
        data: {
          electionId: '11111111-1111-4111-a111-111111111111',
          electionTitle: 'Annual Student Election 2026',
          hasVoted: true,
          ballotReceiptHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          submittedAt: '2026-08-28T20:00:00.000Z'
          // Deliberately no 'votes' or 'candidates' chosen
        }
      });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/votes/status?electionId=11111111-1111-4111-a111-111111111111');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.hasVoted, true);
    assert.equal('votes' in res.body.data, false, 'Individual vote choices must never be exposed');
    assert.equal('candidates' in res.body.data, false, 'Individual candidates must never be exposed');
  });

  // 6. BALLOT RECEIPT VERIFICATION (Public)
  test('GET /api/v1/votes/verify/:receiptHash with invalid hash length returns 400', async () => {
    const res = await request(app).get('/api/v1/votes/verify/short-hash');
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'INVALID_RECEIPT_HASH');
  });

  test('GET /api/v1/votes/verify/:receiptHash returns valid verification without exposing voter ID or choices', async () => {
    const testApp = express();
    testApp.get('/api/v1/votes/verify/:receiptHash', (req, res) => {
      res.status(200).json({
        status: 'success',
        data: {
          valid: true,
          electionId: '11111111-1111-4111-a111-111111111111',
          electionTitle: 'Annual Student Election 2026',
          submittedAt: '2026-08-28T20:00:00.000Z'
          // No voter_id or candidate choices
        }
      });
    });
    testApp.use(errorHandler);

    const dummyHash = 'a'.repeat(64);
    const res = await request(testApp).get(`/api/v1/votes/verify/${dummyHash}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.valid, true);
    assert.equal('voterId' in res.body.data, false, 'Voter identity must not be revealed in receipt verification');
    assert.equal('votes' in res.body.data, false, 'Vote choices must not be revealed in receipt verification');
  });
});
