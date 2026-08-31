const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const NotificationService = require('../services/notificationService');

/**
 * Get notifications for authenticated user
 * GET /api/v1/notifications
 */
async function getUserNotifications(req, res, next) {
  const userId = req.user.id;

  const sql = `
    SELECT id, user_id, type, title, message, link, is_read, created_at
    FROM notifications
    WHERE user_id = $1 OR user_id IS NULL
    ORDER BY created_at DESC
    LIMIT 50;
  `;

  const notifRes = await query(sql, [userId]);

  const unreadCount = notifRes.rows.filter(n => !n.is_read).length;

  return sendSuccess(res, {
    notifications: notifRes.rows,
    unreadCount
  }, 'Notifications retrieved successfully.');
}

/**
 * Mark a single notification as read
 * PATCH /api/v1/notifications/:id/read
 */
async function markNotificationRead(req, res, next) {
  const { id } = req.params;
  const userId = req.user.id;

  await query(
    `UPDATE notifications 
     SET is_read = TRUE 
     WHERE id = $1 AND (user_id = $2 OR user_id IS NULL);`,
    [id, userId]
  );

  return sendSuccess(res, { id, is_read: true }, 'Notification marked as read.');
}

/**
 * Mark all notifications as read for current user
 * PATCH /api/v1/notifications/read-all
 */
async function markAllNotificationsRead(req, res, next) {
  const userId = req.user.id;

  await query(
    `UPDATE notifications 
     SET is_read = TRUE 
     WHERE user_id = $1 OR user_id IS NULL;`,
    [userId]
  );

  return sendSuccess(res, null, 'All notifications marked as read.');
}

/**
 * Ping verification desk (Voters/Candidates can send reminder to Admins & Validators)
 * POST /api/v1/notifications/ping-verification
 */
async function pingVerification(req, res, next) {
  const user = req.user;
  const { type = 'voter' } = req.body; // 'voter' or 'candidate'

  // Verify that user actually has pending verification
  if (type === 'voter') {
    if (user.verification_status !== 'PENDING') {
      return next(new AppError('You do not have a pending voter verification request.', 400, 'NO_PENDING_VERIFICATION'));
    }
  } else if (type === 'candidate') {
    const candidateCheck = await query(
      `SELECT id, status FROM candidate_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1;`,
      [user.id]
    );

    if (candidateCheck.rows.length === 0 || candidateCheck.rows[0].status !== 'PENDING') {
      return next(new AppError('You do not have a pending candidate application.', 400, 'NO_PENDING_CANDIDACY'));
    }
  }

  // Cooldown check: 5 minutes between pings from same user
  const recentPing = await query(
    `SELECT created_at FROM notifications 
     WHERE type = 'PING' AND message LIKE $1 
     ORDER BY created_at DESC LIMIT 1;`,
    [`%${user.email}%`]
  );

  if (recentPing.rows.length > 0) {
    const lastPing = new Date(recentPing.rows[0].created_at).getTime();
    const diffMins = (Date.now() - lastPing) / (1000 * 60);
    if (diffMins < 5) {
      const waitMins = Math.ceil(5 - diffMins);
      return next(new AppError(`Please wait ${waitMins} minute(s) before sending another verification reminder.`, 429, 'PING_COOLDOWN'));
    }
  }

  const subject = type === 'candidate' ? 'Candidate Application' : 'Voter ID Verification';
  const title = `Verification Reminder: ${user.full_name}`;
  const message = `Applicant ${user.full_name} (${user.email}, Admission: ${user.admission_number}) has pinged the verification desk for their pending ${subject}.`;

  await NotificationService.notifyAdminsAndValidators({
    type: 'PING',
    title,
    message,
    link: type === 'candidate' ? '/validator' : '/validator'
  });

  return sendSuccess(res, {
    pingedAt: new Date().toISOString()
  }, 'Verification desk successfully notified of your pending review request.');
}

module.exports = {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  pingVerification
};
