const { query } = require('../config/db');

/**
 * Service to manage in-app notifications
 */
class NotificationService {
  /**
   * Create a targeted notification for a specific user
   */
  static async createNotification({ userId, type, title, message, link = null }) {
    if (!userId || !type || !title || !message) return null;
    try {
      const res = await query(
        `INSERT INTO notifications (user_id, type, title, message, link, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP)
         RETURNING *;`,
        [userId, type, title, message, link]
      );
      return res.rows[0];
    } catch (err) {
      console.error('[NotificationService Error] Failed to create notification:', err.message);
      return null;
    }
  }

  /**
   * Create a broadcast notification for all system users
   */
  static async broadcastNotification({ type = 'ANNOUNCEMENT', title, message, link = null }) {
    if (!title || !message) return null;
    try {
      const res = await query(
        `INSERT INTO notifications (user_id, type, title, message, link, is_read, created_at)
         VALUES (NULL, $1, $2, $3, $4, FALSE, CURRENT_TIMESTAMP)
         RETURNING *;`,
        [type, title, message, link]
      );
      return res.rows[0];
    } catch (err) {
      console.error('[NotificationService Error] Failed to broadcast notification:', err.message);
      return null;
    }
  }

  /**
   * Send notification to all Administrators and Validators
   */
  static async notifyAdminsAndValidators({ type, title, message, link = null }) {
    try {
      const staffRes = await query(
        `SELECT id FROM users WHERE role IN ('ADMINISTRATOR', 'VALIDATOR') AND status = 'ACTIVE';`
      );

      const promises = staffRes.rows.map((staff) =>
        query(
          `INSERT INTO notifications (user_id, type, title, message, link, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP);`,
          [staff.id, type, title, message, link]
        )
      );

      await Promise.all(promises);
      return true;
    } catch (err) {
      console.error('[NotificationService Error] Failed to notify staff:', err.message);
      return false;
    }
  }
}

module.exports = NotificationService;
