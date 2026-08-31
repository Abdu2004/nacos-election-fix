const express = require('express');
const adminUserController = require('../../controllers/adminUser.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

// Strict: All routes in this router require valid JWT and ADMINISTRATOR role
router.use(authenticate, authorize('ADMINISTRATOR'));

const updateRoleSchema = {
  body: {
    role: { required: true, enum: ['ADMINISTRATOR', 'VALIDATOR', 'VOTER', 'CANDIDATE'] }
  },
  params: {
    id: { required: true, isUUID: true }
  }
};

const updateStatusSchema = {
  body: {
    status: { required: true, enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] }
  },
  params: {
    id: { required: true, isUUID: true }
  }
};

const userParamSchema = {
  params: {
    id: { required: true, isUUID: true }
  }
};

const createStaffSchema = {
  body: {
    fullName: { required: true, minLength: 2 },
    admissionNumber: { required: true, minLength: 2 },
    email: { required: true, isEmail: true },
    password: { required: true, minLength: 6 },
    role: { required: true, enum: ['ADMINISTRATOR', 'VALIDATOR'] }
  }
};

// Routes
router.get('/stats', asyncHandler(adminUserController.getSystemStats));
router.get('/users', asyncHandler(adminUserController.listUsers));
router.post('/users', asyncHandler(adminUserController.createUser));
router.post('/users/create-staff', validate(createStaffSchema), asyncHandler(adminUserController.createStaffUser));
router.get('/users/:id', validate(userParamSchema), asyncHandler(adminUserController.getUserById));
router.patch('/users/:id/role', validate(updateRoleSchema), asyncHandler(adminUserController.updateUserRole));
router.patch('/users/:id/status', validate(updateStatusSchema), asyncHandler(adminUserController.updateUserStatus));
router.delete('/users/:id', validate(userParamSchema), asyncHandler(adminUserController.deleteUser));
router.delete('/elections/:id', validate(userParamSchema), asyncHandler(adminUserController.deleteElection));

module.exports = router;
