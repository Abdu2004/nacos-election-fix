const express = require('express');
const candidateController = require('../../controllers/candidate.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize, requireVerified } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { uploadCandidateAssets } = require('../../middleware/upload');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

// Validation Schemas
const uuidParamSchema = {
  params: {
    id: { required: true, isUUID: true }
  }
};

const electionParamSchema = {
  params: {
    electionId: { required: true, isUUID: true }
  }
};

const generateCodesSchema = {
  body: {
    electionId: { required: true, isUUID: true }
  }
};

const applySchema = {
  body: {
    electionId: { required: true, isUUID: true },
    positionId: { required: true, isUUID: true },
    candidateCode: { required: true }
  }
};

const reviewAppSchema = {
  params: {
    id: { required: true, isUUID: true }
  },
  body: {
    status: { required: true, enum: ['APPROVED', 'REJECTED'] }
  }
};

// ==============================================================================
// 1. CANDIDATE CODES (Admin & Validator)
// ==============================================================================
router.post(
  '/codes/generate',
  authenticate,
  authorize('ADMINISTRATOR', 'VALIDATOR'),
  validate(generateCodesSchema),
  asyncHandler(candidateController.generateCandidateCodes)
);

router.get(
  '/codes',
  authenticate,
  authorize('ADMINISTRATOR', 'VALIDATOR'),
  asyncHandler(candidateController.listCandidateCodes)
);

router.patch(
  '/codes/:id/revoke',
  authenticate,
  authorize('ADMINISTRATOR', 'VALIDATOR'),
  validate(uuidParamSchema),
  asyncHandler(candidateController.revokeCandidateCode)
);

// ==============================================================================
// 2. CANDIDACY APPLICATIONS (Voter Submission & Personal Status)
// ==============================================================================
router.post(
  '/apply',
  authenticate,
  requireVerified,
  uploadCandidateAssets.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'credentials', maxCount: 1 }
  ]),
  validate(applySchema),
  asyncHandler(candidateController.applyForCandidacy)
);

router.get(
  '/me/application',
  authenticate,
  asyncHandler(candidateController.getMyApplication)
);

// ==============================================================================
// 3. CANDIDACY APPLICATION REVIEW (Admin & Validator)
// ==============================================================================
router.get(
  '/applications',
  authenticate,
  authorize('ADMINISTRATOR', 'VALIDATOR'),
  asyncHandler(candidateController.listCandidateApplications)
);

router.get(
  '/applications/:id',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(candidateController.getApplicationDetails)
);

router.get(
  '/applications/:id/credentials',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(candidateController.getCandidateCredentialsFile)
);

router.patch(
  '/applications/:id/review',
  authenticate,
  authorize('ADMINISTRATOR', 'VALIDATOR'),
  validate(reviewAppSchema),
  asyncHandler(candidateController.reviewCandidateApplication)
);

// ==============================================================================
// 4. PUBLIC CANDIDATE ROSTER & PROFILE ENDPOINTS
// ==============================================================================
router.get(
  '/photos/:filename',
  asyncHandler(candidateController.serveCandidatePhoto)
);

router.get(
  '/elections/:electionId',
  validate(electionParamSchema),
  asyncHandler(candidateController.listApprovedCandidates)
);

router.get(
  '/:id',
  validate(uuidParamSchema),
  asyncHandler(candidateController.getCandidateProfile)
);

module.exports = router;
