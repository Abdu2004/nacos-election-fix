const express = require('express');
const authController = require('../../controllers/auth.controller');
const { validate } = require('../../middleware/validate');
const { authLimiter, otpVerifyLimiter } = require('../../middleware/rateLimiter');
const { authenticate } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

// Validation Schemas
const registerSchema = {
  body: {
    fullName: { required: true, minLength: 2, maxLength: 150 },
    admissionNumber: {
      required: true,
      regex: /^\d{4}204\d{3}$/,
      message: "Admission number must be exactly 10 digits with '204' as the 5th, 6th, and 7th digits (e.g., 2022204001)."
    },
    email: { required: true, isGmail: true, message: 'A valid Gmail address (@gmail.com) is required.' },
    password: { required: true, minLength: 8, message: 'Password must be at least 8 characters long.' }
  }
};

const loginSchema = {
  body: {
    email: { required: true, isEmail: true },
    password: { required: true, minLength: 1 }
  }
};

const requestOtpSchema = {
  body: {
    email: { required: true, isGmail: true, message: 'A registered Gmail address is required.' }
  }
};

const verifyOtpSchema = {
  body: {
    email: { required: true, isGmail: true },
    otp: { required: true, minLength: 6, maxLength: 6, message: 'OTP must be a 6-digit number.' }
  }
};

const refreshSchema = {
  body: {
    refreshToken: { required: true, message: 'Refresh token is required.' }
  }
};

// Routes
router.post('/register', authLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.loginWithPassword));
router.post('/request-otp', authLimiter, validate(requestOtpSchema), asyncHandler(authController.requestOTP));
router.post('/verify-otp', otpVerifyLimiter, validate(verifyOtpSchema), asyncHandler(authController.verifyOTPAndLogin));
router.post('/forgot-password', authLimiter, validate(requestOtpSchema), asyncHandler(authController.requestPasswordResetOTP));
router.post('/reset-password', otpVerifyLimiter, asyncHandler(authController.resetPasswordWithOTP));
router.post('/refresh', validate(refreshSchema), asyncHandler(authController.refreshToken));

// Protected Routes
router.get('/me', authenticate, asyncHandler(authController.getMe));
router.post('/logout', authenticate, asyncHandler(authController.logout));

module.exports = router;
