-- 为 task_proofs 表增加接包者备注字段（用于备注上链）
ALTER TABLE task_proofs
ADD COLUMN IF NOT EXISTS receiver_remark TEXT;

COMMENT ON COLUMN task_proofs.receiver_remark IS '接包者备注，与 proof 一起提交，用于上链';