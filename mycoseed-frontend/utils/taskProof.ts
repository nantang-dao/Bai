export type ProofFileRef = {
  url: string
  name?: string
  size?: number
  type?: string
  hash?: string
}

export type ParsedTaskProof = {
  description: string
  files: ProofFileRef[]
  gps: { latitude: number; longitude: number; accuracy?: number; timestamp?: string } | null
  receiverRemark?: string
}

export function parseTaskProof(proof: unknown): ParsedTaskProof | null {
  if (!proof) return null

  let data: any = proof
  if (typeof proof === 'string') {
    const trimmed = proof.trim()
    if (!trimmed.startsWith('{')) return null
    try {
      data = JSON.parse(trimmed)
    } catch {
      return null
    }
  }

  if (!data || typeof data !== 'object') return null

  const files: ProofFileRef[] = Array.isArray(data.files)
    ? data.files
        .filter((f: any) => f && typeof f.url === 'string')
        .map((f: any) => ({
          url: f.url,
          name: f.name,
          size: f.size,
          type: f.type,
          hash: f.hash,
        }))
    : []

  const gpsRaw = data.gps
  const gps =
    gpsRaw &&
    typeof gpsRaw.latitude === 'number' &&
    typeof gpsRaw.longitude === 'number'
      ? {
          latitude: gpsRaw.latitude,
          longitude: gpsRaw.longitude,
          accuracy: gpsRaw.accuracy,
          timestamp: gpsRaw.timestamp,
        }
      : null

  return {
    description: typeof data.description === 'string' ? data.description : '',
    files,
    gps,
  }
}

/**
 * 从已保存的 proof 恢复提交表单（localStorage 草稿优先）
 */
export function buildSubmitFormRestore(input: {
  localDescription?: string
  proof: unknown
  receiverRemark?: string
}): {
  description: string
  files: ProofFileRef[]
  gps: ParsedTaskProof['gps']
  receiverRemark: string
  source: 'local' | 'server' | 'none'
} {
  const local = input.localDescription?.trim()
  if (local) {
    return {
      description: local,
      files: [],
      gps: null,
      receiverRemark: input.receiverRemark || '',
      source: 'local',
    }
  }

  const parsed = parseTaskProof(input.proof)
  if (parsed) {
    return {
      description: parsed.description,
      files: parsed.files,
      gps: parsed.gps,
      receiverRemark: input.receiverRemark || '',
      source: 'server',
    }
  }

  return {
    description: '',
    files: [],
    gps: null,
    receiverRemark: input.receiverRemark || '',
    source: 'none',
  }
}
