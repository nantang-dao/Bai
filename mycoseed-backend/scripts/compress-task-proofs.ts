/**
 * 存量 task-proofs 压缩回填。
 *
 * 默认 dry-run（只统计不写库）。正式执行：
 *   npx tsx scripts/compress-task-proofs.ts --prod --execute --limit 20
 * 删除旧文件（确认新 URL 可用后）：
 *   npx tsx scripts/compress-task-proofs.ts --prod --execute --delete-old --limit 20
 *
 * 环境：默认读 .env；加 --prod 会优先用注释掉的正式库 SUPABASE_*。
 */
import fs from 'fs'
import path from 'path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import {
  compressProofImage,
  parseProofPayload,
  parseTaskProofStoragePath,
  PROOF_COMPRESS,
  ProofFileInfo,
  ProofPayload,
} from '../src/services/imageCompress'

type Args = {
  prod: boolean
  execute: boolean
  deleteOld: boolean
  limit: number
  minBytes: number
  onlyTaskId?: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    prod: false,
    execute: false,
    deleteOld: false,
    limit: 0,
    minBytes: PROOF_COMPRESS.minBytesToCompress,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--prod') args.prod = true
    else if (a === '--execute') args.execute = true
    else if (a === '--delete-old') args.deleteOld = true
    else if (a === '--limit') args.limit = Math.max(0, parseInt(argv[++i] || '0', 10) || 0)
    else if (a === '--min-bytes') args.minBytes = Math.max(0, parseInt(argv[++i] || '0', 10) || 0)
    else if (a === '--task-id') args.onlyTaskId = argv[++i]
  }
  return args
}

function loadEnv(preferProd: boolean) {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  const active: Record<string, string> = {}
  const commented: Record<string, string> = {}
  for (const line of lines) {
    const m = line.match(/^(#)?(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/)
    if (!m) continue
    const [, hash, key, value] = m
    if (hash) commented[key] = value.trim()
    else active[key] = value.trim()
  }
  const pick = preferProd
    ? { ...active, ...commented }
    : active
  for (const [k, v] of Object.entries(pick)) {
    if (v) process.env[k] = v
  }
}

function sha256(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex')
}

function isImageFile(file: ProofFileInfo): boolean {
  const type = (file.type || '').toLowerCase()
  if (type.startsWith('image/')) return true
  const url = file.url || ''
  return /\.(jpe?g|png|webp)$/i.test(url.split('?')[0])
}

async function downloadObject(sb: SupabaseClient, objectPath: string): Promise<Buffer> {
  const { data, error } = await sb.storage.from('task-proofs').download(objectPath)
  if (error || !data) throw new Error(error?.message || 'download failed')
  const ab = await data.arrayBuffer()
  return Buffer.from(ab)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  loadEnv(args.prod)

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(JSON.stringify({
    mode: args.execute ? 'EXECUTE' : 'DRY_RUN',
    prod: args.prod,
    deleteOld: args.deleteOld,
    limit: args.limit || 'all',
    minBytes: args.minBytes,
    supabase: url,
  }, null, 2))

  let query = sb.from('task_proofs').select('task_id, proof').not('proof', 'is', null)
  if (args.onlyTaskId) query = query.eq('task_id', args.onlyTaskId)

  const { data: rows, error } = await query
  if (error) throw error

  const summary = {
    rows: rows?.length || 0,
    filesSeen: 0,
    candidates: 0,
    compressed: 0,
    skipped: 0,
    bytesBefore: 0,
    bytesAfter: 0,
    updatedRows: 0,
    deletedOld: 0,
    errors: [] as string[],
  }

  let processedCandidates = 0

  for (const row of rows || []) {
    const raw = row.proof
    const asString = typeof raw === 'string'
    const payload = parseProofPayload(raw)
    if (!payload?.files?.length) continue

    let rowChanged = false
    const oldPathsToDelete: string[] = []
    const nextFiles: ProofFileInfo[] = []

    for (const file of payload.files) {
      summary.filesSeen++
      if (!file?.url || !isImageFile(file)) {
        nextFiles.push(file)
        summary.skipped++
        continue
      }

      const objectPath = parseTaskProofStoragePath(file.url)
      if (!objectPath) {
        nextFiles.push(file)
        summary.skipped++
        continue
      }

      const reportedSize = typeof file.size === 'number' ? file.size : 0
      // 已迁移过的压缩图（路径含 _c 时间戳）不再重复处理
      if (/_c\d+\.(jpe?g)$/i.test(objectPath) && reportedSize > 0 && reportedSize < 550 * 1024) {
        nextFiles.push(file)
        summary.skipped++
        continue
      }
      // 先按元数据粗筛；真正下载后再判断
      if (reportedSize > 0 && reportedSize < args.minBytes) {
        nextFiles.push(file)
        summary.skipped++
        continue
      }

      if (args.limit > 0 && processedCandidates >= args.limit) {
        nextFiles.push(file)
        continue
      }

      try {
        const original = await downloadObject(sb, objectPath)
        summary.bytesBefore += original.length

        if (original.length < args.minBytes) {
          nextFiles.push(file)
          summary.skipped++
          continue
        }

        processedCandidates++
        summary.candidates++

        const contentType = file.type || 'image/jpeg'
        const compressed = await compressProofImage(original, contentType, {
          minBytesToCompress: args.minBytes,
        })

        if (!compressed.compressed) {
          nextFiles.push(file)
          summary.skipped++
          summary.bytesAfter += original.length
          continue
        }

        summary.compressed++
        summary.bytesAfter += compressed.buffer.length

        const dir = objectPath.includes('/') ? objectPath.slice(0, objectPath.lastIndexOf('/')) : ''
        const base = path.posix.basename(objectPath).replace(/\.[^.]+$/, '')
        const newPath = `${dir ? dir + '/' : ''}${base}_c${Date.now()}.jpg`
        const newHash = sha256(compressed.buffer)
        const publicUrl = sb.storage.from('task-proofs').getPublicUrl(newPath).data.publicUrl

        console.log(
          `[candidate] task=${row.task_id} ${original.length} -> ${compressed.buffer.length} ` +
          `(${((1 - compressed.buffer.length / original.length) * 100).toFixed(1)}%) ` +
          `${objectPath} => ${newPath}`
        )

        if (args.execute) {
          const { error: upErr } = await sb.storage.from('task-proofs').upload(newPath, compressed.buffer, {
            contentType: compressed.contentType,
            cacheControl: '3600',
            upsert: false,
          })
          if (upErr) throw upErr

          nextFiles.push({
            ...file,
            url: publicUrl,
            hash: newHash,
            size: compressed.buffer.length,
            type: compressed.contentType,
          })
          oldPathsToDelete.push(objectPath)
          rowChanged = true
        } else {
          nextFiles.push(file)
        }
      } catch (e: any) {
        const msg = `task=${row.task_id} path=${objectPath}: ${e?.message || e}`
        summary.errors.push(msg)
        console.error('[error]', msg)
        nextFiles.push(file)
      }
    }

    if (args.execute && rowChanged) {
      const nextPayload: ProofPayload = { ...payload, files: nextFiles }
      const toStore = asString ? JSON.stringify(nextPayload) : nextPayload
      const { error: updErr } = await sb
        .from('task_proofs')
        .update({ proof: toStore, updated_at: new Date().toISOString() })
        .eq('task_id', row.task_id)
      if (updErr) {
        summary.errors.push(`update ${row.task_id}: ${updErr.message}`)
      } else {
        summary.updatedRows++
        if (args.deleteOld && oldPathsToDelete.length) {
          const { error: delErr } = await sb.storage.from('task-proofs').remove(oldPathsToDelete)
          if (delErr) summary.errors.push(`delete ${row.task_id}: ${delErr.message}`)
          else summary.deletedOld += oldPathsToDelete.length
        }
      }
    }
  }

  const saved = summary.bytesBefore - summary.bytesAfter
  console.log('\n=== summary ===')
  console.log(JSON.stringify({
    ...summary,
    savedBytes: saved,
    savedHuman: `${(saved / 1048576).toFixed(2)} MB`,
    note: args.execute
      ? (args.deleteOld ? '已写库并删除旧文件' : '已写库，旧文件仍保留（可再加 --delete-old）')
      : 'dry-run：未上传/未改库；加 --execute 才会落地',
  }, null, 2))

  if (summary.errors.length) process.exitCode = 2
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
