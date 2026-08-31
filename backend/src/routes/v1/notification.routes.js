const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  pingVerification
} = require('../../controllers/notification.controller');

// All notification routes require authentication
router.use(authenticate);

router.get('/', getUserNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.post('/ping-verification', pingVerification);

module.exports = router;
