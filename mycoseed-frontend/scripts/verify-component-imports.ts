/**
 * 校验 pages/layouts 中使用子目录组件时是否已显式 import
 * npx tsx scripts/verify-component-imports.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

const SUBDIR_COMPONENTS: Array<{ tag: string; importPath: string }> = [
  { tag: 'PixelCard', importPath: 'pixel/PixelCard.vue' },
  { tag: 'PixelButton', importPath: 'pixel/PixelButton.vue' },
  { tag: 'PixelAvatar', importPath: 'pixel/PixelAvatar.vue' },
  { tag: 'ShareToCommunityModal', importPath: 'tasks/ShareToCommunityModal.vue' },
]

function walkVueFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      out.push(...walkVueFiles(full))
    } else if (name.endsWith('.vue')) {
      out.push(full)
    }
  }
  return out
}

function checkFile(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf8')
  const rel = relative(ROOT, filePath).replace(/\\/g, '/')
  const errors: string[] = []

  for (const { tag, importPath } of SUBDIR_COMPONENTS) {
    const tagPattern = new RegExp(`<${tag}[\\s/>]`)
    if (!tagPattern.test(content)) continue
    if (!content.includes(importPath)) {
      errors.push(
        `${rel}: 使用了 <${tag}> 但未 import '~/components/${importPath}'`
      )
    }
  }

  return errors
}

const scanDirs = ['pages', 'layouts'].map((d) => join(ROOT, d))
const files = scanDirs.flatMap((d) => walkVueFiles(d))
const allErrors = files.flatMap(checkFile)

if (allErrors.length > 0) {
  console.error('组件 import 校验失败:\n')
  for (const e of allErrors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log(`[OK] ${files.length} 个页面/布局文件的子目录组件 import 校验通过`)
