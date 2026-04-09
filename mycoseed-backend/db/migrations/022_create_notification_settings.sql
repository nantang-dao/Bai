-- ============================================
-- 用户通知设置（每用户一行）
-- ============================================

CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- 推送渠道（占位：先存储偏好，暂不实际发送）
  push_sms_enabled BOOLEAN NOT NULL DEFAULT false,
  push_email_enabled BOOLEAN NOT NULL DEFAULT false,

  -- 三类消息开关
  community_enabled BOOLEAN NOT NULL DEFAULT true, -- 社区圈：点赞/评论
  task_enabled BOOLEAN NOT NULL DEFAULT true,      -- 任务交互：领取/提交/审核结果
  due_enabled BOOLEAN NOT NULL DEFAULT true,       -- 到期提醒：1h/3h

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_user_notification_settings_updated_at ON user_notification_settings;
CREATE TRIGGER update_user_notification_settings_updated_at
  BEFORE UPDATE ON user_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_notification_settings IS '用户通知设置：渠道偏好与三类开关';

