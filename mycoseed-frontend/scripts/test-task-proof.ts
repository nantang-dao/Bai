/**
 * 单元测试：任务凭证解析与表单恢复
 * npx tsx scripts/test-task-proof.ts
 */
import { parseTaskProof, buildSubmitFormRestore } from '../utils/taskProof'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function testParseTaskProof() {
  const parsed = parseTaskProof(
    JSON.stringify({
      description: '完成了任务',
      files: [{ url: 'https://example.com/a.png', name: 'a.png' }],
      gps: { latitude: 31.2, longitude: 121.5 },
    })
  )
  assert(parsed !== null, '应能解析 JSON proof')
  assert(parsed!.description === '完成了任务', '描述应正确')
  assert(parsed!.files.length === 1, '文件应有一条')
  assert(parsed!.gps?.latitude === 31.2, 'GPS 应正确')
  console.log('[OK] parseTaskProof')
}

function testBuildSubmitFormRestore() {
  const fromLocal = buildSubmitFormRestore({
    localDescription: '本地草稿',
    proof: JSON.stringify({ description: '服务器内容' }),
  })
  assert(fromLocal.source === 'local', 'localStorage 应优先')
  assert(fromLocal.description === '本地草稿', '应使用本地描述')

  const fromServer = buildSubmitFormRestore({
    proof: JSON.stringify({
      description: '服务器内容',
      files: [{ url: 'https://x.com/f.jpg', name: 'f.jpg' }],
    }),
    receiverRemark: '感想',
  })
  assert(fromServer.source === 'server', '无本地时应从服务器恢复')
  assert(fromServer.files.length === 1, '应恢复文件')
  assert(fromServer.receiverRemark === '感想', '应恢复感想')

  console.log('[OK] buildSubmitFormRestore')
}

function main() {
  testParseTaskProof()
  testBuildSubmitFormRestore()
  console.log('\nAll task-proof tests passed.')
}

main()
