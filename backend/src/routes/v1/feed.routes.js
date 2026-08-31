const express = require('express');
const feedController = require('../../controllers/feed.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const { uploadFeedImage } = require('../../middleware/upload');

const router = express.Router();

// Validation schemas
const uuidParamSchema = {
  params: {
    id: { required: true, isUUID: true }
  }
};

const createPostSchema = {
  body: {
    title: { required: true },
    content: { required: true }
  }
};

// ==============================================================================
// 1. PUBLIC FEED ENDPOINTS
// ==============================================================================
router.get(
  '/',
  asyncHandler(feedController.listPosts)
);

router.get(
  '/images/:filename',
  asyncHandler(feedController.serveFeedImage)
);

router.get(
  '/:id',
  validate(uuidParamSchema),
  asyncHandler(feedController.getPostById)
);

// ==============================================================================
// 2. PROTECTED POST CREATION (Admin, Validator, Candidate)
// ==============================================================================
router.post(
  '/',
  authenticate,
  authorize('ADMINISTRATOR', 'VALIDATOR', 'CANDIDATE'),
  uploadFeedImage.single('image'),
  validate(createPostSchema),
  asyncHandler(feedController.createPost)
);

// ==============================================================================
// 3. EDIT & DELETE POSTS (Owner or Admin)
// ==============================================================================
router.patch(
  '/:id',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(feedController.updatePost)
);

router.delete(
  '/:id',
  authenticate,
  validate(uuidParamSchema),
  asyncHandler(feedController.deletePost)
);

// ==============================================================================
// 4. PIN / UNPIN POST (Admin Only)
// ==============================================================================
router.patch(
  '/:id/pin',
  authenticate,
  authorize('ADMINISTRATOR'),
  validate(uuidParamSchema),
  asyncHandler(feedController.togglePinPost)
);

module.exports = router;
