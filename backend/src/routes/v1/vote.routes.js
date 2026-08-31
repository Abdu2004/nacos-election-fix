const express = require('express');
const voteController = require('../../controllers/vote.controller');
const { authenticate } = require('../../middleware/auth');
const { requireVerified } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

// Validation schemas
const submitBallotSchema = {
  body: {
    electionId: { required: true, isUUID: true },
    votes: { required: true }
  }
};

// ==============================================================================
// VOTING CONFIRMATION OTP REQUEST
// Requires: Authentication + Verified voter.
// ==============================================================================
router.post(
  '/request-otp',
  authenticate,
  requireVerified,
  asyncHandler(voteController.requestVotingOTP)
);

// ==============================================================================
// BALLOT SUBMISSION
// Most security-critical endpoint in the entire system.
// Requires: Authentication + Verified voter + Atomic transaction.
// ==============================================================================
router.post(
  '/',
  authenticate,
  requireVerified,
  validate(submitBallotSchema),
  asyncHandler(voteController.submitBallot)
);

// ==============================================================================
// VOTER BALLOT STATUS
// Returns whether the authenticated voter has voted - NOT their choices.
// ==============================================================================
router.get(
  '/status',
  authenticate,
  asyncHandler(voteController.getVotingStatus)
);

// ==============================================================================
// BALLOT RECEIPT VERIFICATION (Public)
// Allows a voter to verify their ballot was recorded.
// Does NOT reveal voter identity or individual choices.
// ==============================================================================
router.get(
  '/verify/:receiptHash',
  asyncHandler(voteController.verifyBallotReceipt)
);

module.exports = router;
