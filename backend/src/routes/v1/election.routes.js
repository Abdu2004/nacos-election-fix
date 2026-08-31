const express = require('express');
const electionController = require('../../controllers/election.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

// Validation schemas
const uuidParamSchema = {
  params: {
    id: { required: true, isUUID: true }
  }
};

const createElectionSchema = {
  body: {
    title: { required: true },
    startDate: { required: true },
    endDate: { required: true }
  }
};

const assignPositionsSchema = {
  params: {
    id: { required: true, isUUID: true }
  },
  body: {
    positionIds: { required: true }
  }
};

const removePositionSchema = {
  params: {
    id: { required: true, isUUID: true },
    positionId: { required: true, isUUID: true }
  }
};

// ==============================================================================
// GLOBAL POSITION MASTER LIST (Admin)
// ==============================================================================
router.get(
  '/positions/all',
  authenticate,
  authorize('ADMINISTRATOR'),
  asyncHandler(electionController.listAllPositions)
);

// ==============================================================================
// ELECTION CRUD (Administrator Only)
// ==============================================================================
router.post(
  '/',
  authenticate,
  authorize('ADMINISTRATOR'),
  validate(createElectionSchema),
  asyncHandler(electionController.createElection)
);

router.get(
  '/',
  asyncHandler(electionController.listElections)
);

router.get(
  '/:id',
  validate(uuidParamSchema),
  asyncHandler(electionController.getElectionDetails)
);

router.patch(
  '/:id',
  authenticate,
  authorize('ADMINISTRATOR'),
  validate(uuidParamSchema),
  asyncHandler(electionController.updateElection)
);

// ==============================================================================
// ELECTION STATISTICS (Administrator Only — Private)
// ==============================================================================
router.get(
  '/:id/stats',
  authenticate,
  authorize('ADMINISTRATOR'),
  validate(uuidParamSchema),
  asyncHandler(electionController.getElectionStats)
);

// ==============================================================================
// POSITION MANAGEMENT (Administrator Only)
// ==============================================================================
router.post(
  '/:id/positions',
  authenticate,
  authorize('ADMINISTRATOR'),
  validate(assignPositionsSchema),
  asyncHandler(electionController.assignPositions)
);

router.delete(
  '/:id/positions/:positionId',
  authenticate,
  authorize('ADMINISTRATOR'),
  validate(removePositionSchema),
  asyncHandler(electionController.removePosition)
);

// ==============================================================================
// STATE TRANSITIONS (Administrator Only)
// UPCOMING → OPEN → CLOSED
// ==============================================================================
router.patch(
  '/:id/open',
  authenticate,
  authorize('ADMINISTRATOR'),
  validate(uuidParamSchema),
  asyncHandler(electionController.openElection)
);

router.patch(
  '/:id/close',
  authenticate,
  authorize('ADMINISTRATOR'),
  validate(uuidParamSchema),
  asyncHandler(electionController.closeElection)
);

module.exports = router;
