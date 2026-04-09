-- ============================================
-- 通知表（按用户+社区存储，支持已读/去重）
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id UUID, -- 可为空：例如未归属社区的通知

  category VARCHAR(20) NOT NULL CHECK (category IN ('community', 'task', 'due')),
  type VARCHAR(50) NOT NULL, -- 例如 post_like / post_comment / task_claim / task_submit / task_approved / task_rejected / task_due_1h / task_due_3h

  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,

  -- 去重键：同一用户同一 dedupe_key 只允许一条（避免重复提醒）
  dedupe_key TEXT,

  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_category_created_at ON notifications(user_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_community_id ON notifications(community_id) WHERE community_id IS NOT NULL;

-- 去重：同 user_id + dedupe_key 只保留 1 条
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_user_dedupe_key
  ON notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

COMMENT ON TABLE notifications IS '站内消息通知（按用户、分类存储，支持已读与去重）';

