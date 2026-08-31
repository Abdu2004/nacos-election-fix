const express = require('express');
const verificationController = require('../../controllers/verification.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { uploadVerificationDoc } = require('../../middleware/upload');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

// Validation Schemas
const uuidParamSchema = {
  params: {
    id: { required: true, isUUID: true }
  }
};

const reviewSchema = {
  params: {
    id: { required: true, isUUID: true }
  },
  body: {
    status: { required: true, enum: ['APPROVED', 'REJECTED'] }
  }
};

// --- Voter Routes ---
router.post(
  '/upload',
  authenticate,
  uploadVerificationDoc.single('document'),
  asyncHandler(verificationController.uploadDocument)
);

router.get(
  '/status',
  authenticate,
  asyncHandler(verificationController.getVerificationStatus)
);

router.get(
  '/documents/:id/file',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(verificationController.getDocumentFile)
);

// --- Validator / Admin Staff Review Routes ---
router.get(
  '/pending',
  authenticate,
  authorize('VALIDATOR', 'ADMINISTRATOR'),
  asyncHandler(verificationController.listPendingApplications)
);

router.patch(
  '/applications/:id/review',
  authenticate,
  authorize('VALIDATOR', 'ADMINISTRATOR'),
  validate(reviewSchema),
  asyncHandler(verificationController.reviewApplication)
);

module.exports = router;
