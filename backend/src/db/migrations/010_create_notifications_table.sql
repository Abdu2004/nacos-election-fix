-- Migration 010: Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL indicates system broadcast to all users
  type VARCHAR(50) NOT NULL, -- VERIFICATION_REQUEST, VERIFICATION_STATUS, ANNOUNCEMENT, PING, SYSTEM
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
