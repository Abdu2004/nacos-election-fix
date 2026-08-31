const express = require('express');
const resultController = require('../../controllers/result.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

// Validation schema
const electionParamSchema = {
  params: {
    electionId: { required: true, isUUID: true }
  }
};

// ==============================================================================
// 1. PUBLIC RESULTS ENDPOINT (CRITICAL RULE 5: Accessible only after publication)
// ==============================================================================
router.get(
  '/:electionId',
  validate(electionParamSchema),
  asyncHandler(resultController.getPublicResults)
);

// ==============================================================================
// 2. ADMINISTRATOR RESULTS OPERATIONS
// ==============================================================================
router.post(
  '/:electionId/calculate',
  authenticate,
  authorize('ADMINISTRATOR'),
  validate(electionParamSchema),
  asyncHandler(resultController.calculateResults)
);

router.post(
  '/:electionId/publish',
  authenticate,
  authorize('ADMINISTRATOR'),
  validate(electionParamSchema),
  asyncHandler(resultController.publishResults)
);

router.get(
  '/:electionId/admin-preview',
  authenticate,
  authorize('ADMINISTRATOR'),
  validate(electionParamSchema),
  asyncHandler(resultController.getAdminResultsPreview)
);

module.exports = router;
