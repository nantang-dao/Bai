import { supabase } from './supabase'
import { createHash } from 'crypto'
import { Readable } from 'stream'

// 计算文件的 SHA-256 哈希值
export const calculateFileHash = async (buffer: Buffer): Promise<string> => {
    return createHash('sha256').update(buffer).digest('hex')
}

// 将 buffer 转换为 readable stream
const bufferToStream = (buffer: Buffer): Readable => {
    const stream = new Readable()
    stream.push(buffer)
    stream.push(null)
    return stream
}

/**
 * 上传文件到 Supabase Storage
 * @param file 文件 Buffer
 * @param postId 动态ID（可以是前端预生成的UUID，或后端创建后返回的ID）
 * @param bucket 存储桶名称
 * @param path 文件路径
 * @param contentType 文件的 MIME 类型
 * @returns 文件的公共 URL 和哈希值
 */
export const uploadFileToStorage = async (
    file: Buffer,
    bucket: string,
    path: string,
    contentType: string
): Promise<{ url: string; hash: string }> => {
    // 计算文件哈希
    const hash = await calculateFileHash(file)

    // 上传文件到 Supabase storage
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: contentType
        })

    if (error) {
        throw new Error(`文件上传失败：${error.message}`)
    }

    // 获取文件的公共 URL 
    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path)

    return {
        url: publicUrl,
        hash
    }
}

/**
 * 上传用户头像
 * @param file 头像文件 Buffer
 * @param userId 用户 ID
 * @param contentType 文件的 MIME 类型
 * @returns 头像的公共 URL 和哈希值
 */
export const uploadAvatar = async (
    file: Buffer,
    userId: string,
    contentType: string
): Promise<{ url: string; hash: string }> => {
    // 根据 MIME 类型推断文件扩展名
    const getExtension = (mimeType: string): string => {
        const mimeToExt: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp'
        }
        return mimeToExt[mimeType.toLowerCase()] || 'jpg'
    }

    // 生成唯一文件名
    const timestamp = Date.now()
    const ext = getExtension(contentType)
    const fileName = `${userId}/${timestamp}.${ext}`

    return await uploadFileToStorage(file, 'avatars', fileName, contentType)
}

/**
 * 上传任务凭证文件
 * @param file 凭证文件 Buffer
 * @param taskId 任务 ID
 * @param userId 用户 ID
 * @param index 文件索引（用于多文件上传）
 * @param contentType 文件的 MIME 类型
 * @returns 文件的公共 URL 和哈希值
 */
export const uploadTaskProof = async (
    file: Buffer,
    taskId: string,
    userId: string,
    index: number = 0,
    contentType: string
): Promise<{ url: string; hash: string }> => {
    // 根据 MIME 类型推断文件扩展名
    const getExtension = (mimeType: string): string => {
        if (mimeType === 'application/pdf') {
            return 'pdf'
        }
        // 图片类型
        const mimeToExt: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp'
        }
        return mimeToExt[mimeType.toLowerCase()] || 'bin'
    }

    // 生成唯一文件名
    const timestamp = Date.now()
    const ext = getExtension(contentType)
    const fileName = `${taskId}/${userId}/${timestamp}_${index}.${ext}`

    return await uploadFileToStorage(file, 'task-proofs', fileName, contentType)
}


/**
 * 上传社区动态图片
 * @param file 图片文件 Buffer
 * @param postId 动态ID（可以是前端预生成的UUID，或后端创建后返回的ID）
 * @param communityId 社区ID
 * @param index 图片索引（用于多图上传，0-8）
 * @param contentType 文件的 MIME 类型
 * @returns 图片的公共 URL 和哈希值
 */
export const uploadPostImage = async (
    file: Buffer,
    postId: string,
    communityId: string,
    index: number = 0,
    contentType: string
): Promise<{ url: string; hash: string }> => {
    // 根据 MIME 类型推断文件扩展名（仅支持图片）
    const getExtension = (mimeType: string): string => {
        const mimeToExt: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp'
        }
        const ext = mimeToExt[mimeType.toLowerCase()]
        if (!ext) {
            throw new Error(`不支持的图片类型：${mimeType}，仅支持 JPEG、PNG、GIF、WebP`)
        }
        return ext
    }

    // 验证索引范围（最多9张图片，索引0-8）
    if (index < 0 || index > 8) {
        throw new Error(`图片索引必须在0-8之间，当前索引：${index}`)
    }

    // 生成唯一文件名
    // 路径格式：{communityId}/{postId}/{timestamp}_{index}.{ext}
    // postId 可以是前端预生成的UUID，这样路径完美关联
    const timestamp = Date.now()
    const ext = getExtension(contentType)
    const fileName = `${communityId}/${postId}/${timestamp}_${index}.${ext}`

    return await uploadFileToStorage(file, 'community-posts', fileName, contentType)
}