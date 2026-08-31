const express = require('express');
const auditController = require('../../controllers/audit.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

// Validation schema
const uuidParamSchema = {
  params: {
    id: { required: true, isUUID: true }
  }
};

// All audit log endpoints are strictly ADMINISTRATOR-only and read-only
router.use(authenticate, authorize('ADMINISTRATOR'));

router.get(
  '/',
  asyncHandler(auditController.listAuditLogs)
);

router.get(
  '/summary',
  asyncHandler(auditController.getAuditSummary)
);

router.get(
  '/export',
  asyncHandler(auditController.exportAuditLogs)
);

router.get(
  '/:id',
  validate(uuidParamSchema),
  asyncHandler(auditController.getAuditLogById)
);

module.exports = router;
