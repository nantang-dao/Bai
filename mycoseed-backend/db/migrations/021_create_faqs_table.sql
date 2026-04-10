-- ============================================
-- FAQ：常见问题（问题/答案）
-- ============================================

CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_created_at ON faqs(created_at DESC);

DROP TRIGGER IF EXISTS update_faqs_updated_at ON faqs;
CREATE TRIGGER update_faqs_updated_at
    BEFORE UPDATE ON faqs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE faqs IS '帮助与反馈 - FAQ（问题与答案）';

-- 示例数据（可按需修改/删除）
INSERT INTO faqs (question, answer)
VALUES
('这个系统的核心流程是什么？', '简要流程：加入社区 → 浏览/领取任务 → 按要求提交凭证 → 任务创建者审核 → 审核通过后发放积分/奖励（按任务配置）。'),
('如何领取任务？', '进入任务列表，打开任务详情后点击“领取”。若任务指定了参与者或已满员/过期，将无法领取。'),
('提交凭证需要哪些内容？', '取决于任务的凭证配置：可能需要文字描述、照片/文件、GPS 定位等。提交后会进入“待审核”状态。'),
('多人任务如何计算进度？', '多人任务会为每个参与者生成一条独立任务行；每个人的领取、提交、审核互不影响。列表页会汇总显示整体进度。'),
('审核驳回后我该怎么做？', '创建者可选择“重新提交（resubmit）”“重新发布（reclaim）”或“终止（rejected）”。你可按提示重新提交凭证或重新领取任务。')
ON CONFLICT DO NOTHING;

