/**
 * 阶段 9：删除/修改门禁（任务池）
 *
 * 覆盖点（接口级）：
 * - 早期：创建者可 PATCH pool-draft；可撤回 withdraw（task-info）；
 * - 一旦 Manager 认领：创建者不可 PATCH pool-draft；不可 withdraw/delete（tasks 与 task-info 一致）；
 *
 * 用法：
 *   API_BASE_URL=http://127.0.0.1:3001 \
 *   AUTH_TOKEN_PUBLISHER=... \
 *   AUTH_TOKEN_MANAGER=... \
 *   npm run test:taskpool-delete-edit-gates
 */
import 'dotenv/config'
import assert from 'node:assert/strict'

const apiBaseUrl =
  process.env.API_BASE_URL || process.env.NUXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'
const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
const managerToken = process.env.AUTH_TOKEN_MANAGER || publisherToken

function h(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function mustJson(resp: Response) {
  const txt = await resp.text()
  try {
    return JSON.parse(txt)
  } catch {
    throw new Error(`非 JSON(${resp.status}): ${txt.slice(0, 400)}`)
  }
}

async function createTaskpool() {
  const now = Date.now()
  const resp = await fetch(`${apiBaseUrl}/api/tasks`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({
      title: `tp-delete-edit-${now}`,
      description: 'testTaskpoolDeleteEditGates',
      reward: 1,
      participantLimit: 1,
      rewardDistributionMode: 'per_person',
      startDate: new Date(Date.now() - 120_000).toISOString(),
      deadline: new Date(Date.now() + 60 * 60_000).toISOString(),
      submitDeadline: new Date(Date.now() + 120 * 60_000).toISOString(),
      submissionInstructions: 'n/a',
      proofConfig: { photo: { enabled: false } },
      useTaskpool: true,
      allowSplit: true,
    }),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, `创建任务池失败: ${JSON.stringify(data)}`)
  assert.ok(data.id && data.taskInfoId, JSON.stringify(data))
  return { poolPrimaryTaskId: data.id as string, taskInfoId: data.taskInfoId as string }
}

async function patchPoolDraft(taskInfoId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/pool-draft`, {
    method: 'PATCH',
    headers: h(token),
    body: JSON.stringify({
      title: `patched-${Date.now()}`,
      description: 'patched',
      reward: 1,
      participantLimit: 1,
      startDate: new Date(Date.now() - 120_000).toISOString(),
      deadline: new Date(Date.now() + 60 * 60_000).toISOString(),
      submitDeadline: new Date(Date.now() + 120 * 60_000).toISOString(),
      submissionInstructions: 'n/a',
      proofConfig: { photo: { enabled: false } },
    }),
  })
  return { resp, data: await mustJson(resp) }
}

async function withdrawPool(taskInfoId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/withdraw`, {
    method: 'POST',
    headers: h(token),
    body: JSON.stringify({}),
  })
  return { resp, data: await mustJson(resp) }
}

async function withdrawTask(taskId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/tasks/${taskId}/withdraw`, {
    method: 'POST',
    headers: h(token),
    body: JSON.stringify({}),
  })
  return { resp, data: await mustJson(resp) }
}

async function deleteTask(taskId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/tasks/${taskId}`, {
    method: 'DELETE',
    headers: h(token),
  })
  return { resp, data: await mustJson(resp) }
}

async function claimPoolPrimary(taskId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/tasks/${taskId}/claim`, {
    method: 'PATCH',
    headers: h(token),
    body: JSON.stringify({}),
  })
  return { resp, data: await mustJson(resp) }
}

function isConnRefused(err: unknown): boolean {
  const c = err as { cause?: { code?: string } }
  return c?.cause?.code === 'ECONNREFUSED'
}

async function main() {
  if (!publisherToken || !managerToken) {
    console.log(
      '[SKIP] testTaskpoolDeleteEditGates：缺少 AUTH_TOKEN_PUBLISHER 或 AUTH_TOKEN_MANAGER（需要真实登录态）'
    )
    return
  }
  // 该脚本要验证「Manager 认领后，Publisher 不可删改」的门禁，因此最好用不同账号。
  // 若未提供独立 manager，则尝试复用 Candidate 作为 manager；若仍同账号则跳过后半段。
  const managerTokenEffective = (process.env.AUTH_TOKEN_MANAGER || process.env.AUTH_TOKEN_CANDIDATE || managerToken) as string
  if (publisherToken === managerTokenEffective) {
    console.log('[SKIP] testTaskpoolDeleteEditGates：Publisher 与 Manager 为同账号，无法覆盖“他人认领后不可删改”的门禁分支')
    console.log('（建议：设置 AUTH_TOKEN_CANDIDATE 或 AUTH_TOKEN_MANAGER 为第二个账号）')
    return
  }

  // 早期：可改、可撤回
  const pool = await createTaskpool()
  let r = await patchPoolDraft(pool.taskInfoId, publisherToken!)
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  // 撤回（管理侧接口）应成功
  r = await withdrawPool(pool.taskInfoId, publisherToken!)
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  // 再创建一份用于“已认领后不可删改”验证
  const pool2 = await createTaskpool()

  // manager 认领池主入口
  r = await claimPoolPrimary(pool2.poolPrimaryTaskId, managerTokenEffective!)
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  // 认领后：publisher 不可改主信息
  r = await patchPoolDraft(pool2.taskInfoId, publisherToken!)
  assert.equal(r.resp.status, 400, `期望认领后 patch=400，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

  // 认领后：publisher 不可撤回（task-info withdraw）
  r = await withdrawPool(pool2.taskInfoId, publisherToken!)
  assert.equal(r.resp.status, 400, `期望认领后 withdrawPool=400，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

  // 认领后：publisher 不可从商城侧 tasks/:id/withdraw 撤回
  r = await withdrawTask(pool2.poolPrimaryTaskId, publisherToken!)
  assert.equal(r.resp.status, 400, `期望认领后 withdrawTask=400，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

  // 认领后：publisher 不可 DELETE /tasks/:id
  r = await deleteTask(pool2.poolPrimaryTaskId, publisherToken!)
  assert.equal(r.resp.status, 400, `期望认领后 deleteTask=400，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

  console.log('testTaskpoolDeleteEditGates: OK')
}

main().catch((e) => {
  if (isConnRefused(e)) {
    console.error(
      `无法连接 ${apiBaseUrl}（ECONNREFUSED）。请先启动后端：npm run dev\n` +
        '若使用其它端口：export API_BASE_URL=http://127.0.0.1:<端口>'
    )
  } else {
    console.error(e)
  }
  process.exit(1)
})

