import sharp from 'sharp'

/** 凭证图压缩参数：审核够用，体积可控 */
export const PROOF_COMPRESS = {
  maxEdge: 1600,
  quality: 75,
  /** 小于该体积且已是 jpeg/webp 时，若边长也够小可跳过 */
  minBytesToCompress: 400 * 1024,
} as const

export type CompressImageResult = {
  buffer: Buffer
  contentType: string
  extension: string
  compressed: boolean
  skippedReason?: string
}

const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export function extensionForMime(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf'
  return IMAGE_EXT[mimeType.toLowerCase()] || 'bin'
}

/**
 * 压缩任务凭证图片。PDF / 非图片 / GIF 原样返回。
 * 输出统一 JPEG，保证兼容性；若压完反而更大则保留原图。
 */
export async function compressProofImage(
  input: Buffer,
  contentType: string,
  options: Partial<typeof PROOF_COMPRESS> = {}
): Promise<CompressImageResult> {
  const maxEdge = options.maxEdge ?? PROOF_COMPRESS.maxEdge
  const quality = options.quality ?? PROOF_COMPRESS.quality
  const minBytes = options.minBytesToCompress ?? PROOF_COMPRESS.minBytesToCompress
  const mime = (contentType || '').toLowerCase()

  if (mime === 'application/pdf') {
    return {
      buffer: input,
      contentType: mime,
      extension: 'pdf',
      compressed: false,
      skippedReason: 'pdf',
    }
  }

  if (!mime.startsWith('image/')) {
    return {
      buffer: input,
      contentType: contentType || 'application/octet-stream',
      extension: extensionForMime(contentType),
      compressed: false,
      skippedReason: 'not-image',
    }
  }

  if (mime === 'image/gif') {
    return {
      buffer: input,
      contentType: mime,
      extension: 'gif',
      compressed: false,
      skippedReason: 'gif',
    }
  }

  let meta: { width?: number; height?: number }
  try {
    meta = await sharp(input, { failOn: 'none' }).metadata()
  } catch {
    return {
      buffer: input,
      contentType: mime,
      extension: extensionForMime(mime),
      compressed: false,
      skippedReason: 'unreadable',
    }
  }

  const w = meta.width || 0
  const h = meta.height || 0
  const alreadySmall =
    input.length < minBytes &&
    w > 0 &&
    h > 0 &&
    w <= maxEdge &&
    h <= maxEdge &&
    (mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/webp')

  if (alreadySmall) {
    return {
      buffer: input,
      contentType: mime === 'image/jpg' ? 'image/jpeg' : mime,
      extension: extensionForMime(mime),
      compressed: false,
      skippedReason: 'already-small',
    }
  }

  const out = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()

  if (out.length >= input.length) {
    return {
      buffer: input,
      contentType: mime === 'image/jpg' ? 'image/jpeg' : mime,
      extension: extensionForMime(mime),
      compressed: false,
      skippedReason: 'no-gain',
    }
  }

  return {
    buffer: out,
    contentType: 'image/jpeg',
    extension: 'jpg',
    compressed: true,
  }
}

/** 从 public URL 解析 bucket 内 object path */
export function parseTaskProofStoragePath(publicUrl: string): string | null {
  const marker = '/storage/v1/object/public/task-proofs/'
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0])
}

export type ProofFileInfo = {
  url: string
  hash?: string
  name?: string
  size?: number
  type?: string
  [key: string]: unknown
}

export type ProofPayload = {
  files?: ProofFileInfo[]
  [key: string]: unknown
}

export function parseProofPayload(proof: unknown): ProofPayload | null {
  if (proof == null) return null
  if (typeof proof === 'string') {
    try {
      return JSON.parse(proof) as ProofPayload
    } catch {
      return null
    }
  }
  if (typeof proof === 'object') return proof as ProofPayload
  return null
}

export function stringifyProofPayload(payload: ProofPayload, asString: boolean): string | ProofPayload {
  return asString ? JSON.stringify(payload) : payload
}
