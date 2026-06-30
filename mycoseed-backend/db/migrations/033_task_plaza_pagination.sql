-- ============================================
-- 任务广场分页：聚合视图 + 游标分页索引
-- ============================================

-- 任务名额聚合（列表页用，不拉全量子行）
CREATE OR REPLACE VIEW task_info_plaza_stats AS
SELECT
    t.task_info_id,
    COUNT(*)::int AS total_slots,
    COUNT(t.claimer_id)::int AS claimed_count,
    (array_agg(t.id ORDER BY t.participant_index ASC NULLS LAST, t.created_at ASC))[1] AS representative_task_id,
    MAX(t.reward)::numeric AS max_reward,
    MAX(t.currency) AS currency,
    array_agg(t.status ORDER BY t.participant_index ASC NULLS LAST) AS participant_statuses
FROM tasks t
GROUP BY t.task_info_id;

COMMENT ON VIEW task_info_plaza_stats IS '任务广场列表聚合：名额数、已认领数、代表行 ID、奖励';

-- 社区 + 创建时间游标分页
CREATE INDEX IF NOT EXISTS idx_task_info_community_created
    ON task_info (community_id, created_at DESC);

-- 社区 + 截止时间排序
CREATE INDEX IF NOT EXISTS idx_task_info_community_deadline
    ON task_info (community_id, deadline ASC);
