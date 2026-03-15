-- ============================================
-- 删除 tasks 表中 reward = 0.10 的所有行
-- ============================================

-- 步骤1: 先查看要删除的数据（建议先执行这个查询确认）
SELECT 
    id,
    task_info_id,
    creator_id,
    claimer_id,
    reward,
    currency,
    status,
    created_at
FROM tasks
WHERE reward = 0.10;

-- 步骤2: 查看要删除的行数
SELECT COUNT(*) as rows_to_delete
FROM tasks
WHERE reward = 0.10;

-- 步骤3: 执行删除（确认无误后执行）
-- ⚠️ 警告：此操作不可逆，请确保已备份数据
DELETE FROM tasks
WHERE reward = 0.10;

-- 步骤4: 验证删除结果
SELECT COUNT(*) as remaining_rows
FROM tasks
WHERE reward = 0.10;
-- 应该返回 0
