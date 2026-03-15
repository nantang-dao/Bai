import { Request, Response } from 'express'
import { uploadAvatar, uploadTaskProof, uploadPostImage } from '../services/storage'
import { AuthRequest, MulterFile } from '../middleware/auth'
import { DEFAULT_COMMUNITY_UUID } from '../constants/community'

/**
 * 上传用户头像
 */
export const uploadAvatarController = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ success: false, message: '未授权' })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ success: false, message: '请选择文件' })
    }

    // 验证文件类型（仅图片）
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ success: false, message: '只能上传图片文件' })
    }

    // 验证文件大小（最大5MB）
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: '图片大小不能超过5MB' })
    }

    // 上传文件
    const result = await uploadAvatar(file.buffer, user.id, file.mimetype)

    res.json({
      success: true,
      url: result.url,
      hash: result.hash
    })
  } catch (error: any) {
    console.error('Upload avatar error:', error)
    res.status(500).json({ success: false, message: error.message || '上传头像失败' })
  }
}

/**
 * 上传任务凭证文件（支持多文件）
 */
export const uploadProofController = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ success: false, message: '未授权' })
    }

    const files = req.files as MulterFile[]
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: '请选择文件' })
    }

    const { taskId } = req.body
    if (!taskId) {
      return res.status(400).json({ success: false, message: '缺少任务ID' })
    }

    // 验证文件类型和大小
    const allowedTypes = ['image/', 'application/pdf']
    for (const file of files) {
      const isValidType = allowedTypes.some(type => file.mimetype.startsWith(type))
      if (!isValidType) {
        return res.status(400).json({ 
          success: false, 
          message: `文件 ${file.originalname} 格式不支持，只能上传图片或PDF文件` 
        })
      }

      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ 
          success: false, 
          message: `文件 ${file.originalname} 大小不能超过10MB` 
        })
      }
    }

    // 上传所有文件
    const uploadResults = await Promise.all(
      files.map((file, index) => 
        uploadTaskProof(file.buffer, taskId, user.id, index, file.mimetype)
      )
    )

    // 构建返回数据
    const fileInfos = uploadResults.map((result, index) => ({
      url: result.url,
      hash: result.hash,
      name: files[index].originalname,
      size: files[index].size,
      type: files[index].mimetype
    }))

    res.json({
      success: true,
      files: fileInfos
    })
  } catch (error: any) {
    console.error('Upload proof error:', error)
    res.status(500).json({ success: false, message: error.message || '上传文件失败' })
  }
}

/**
 * 上传社区动态图片（支持多文件）
 */
export const uploadPostImageController = async (req: AuthRequest, res: Response) => {
  console.log('[upload] POST /post-image 收到请求', {
    hasUser: !!req.user,
    bodyKeys: Object.keys(req.body || {}),
    filesCount: (req.files as MulterFile[])?.length ?? 0
  })
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ success: false, message: '未授权' })
    }

    const files = req.files as MulterFile[]
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: '请选择文件' })
    }

    const { postId, communityId } = req.body
    if (!postId) {
      return res.status(400).json({ success: false, message: '缺少动态ID（postId）' })
    }
    // 如果 communityId 为空，使用默认 UUID
    const finalCommunityId = communityId || DEFAULT_COMMUNITY_UUID

    // 验证文件类型和大小（仅支持图片，最多9张，每张最大5MB）
    if (files.length > 9) {
      return res.status(400).json({ 
        success: false, 
        message: '最多只能上传9张图片' 
      })
    }

    for (const file of files) {
      // 验证文件类型（仅图片）
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ 
          success: false, 
          message: `文件 ${file.originalname} 格式不支持，只能上传图片文件` 
        })
      }

      // 验证文件大小（最大5MB）
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ 
          success: false, 
          message: `文件 ${file.originalname} 大小不能超过5MB` 
        })
      }
    }

    // 上传所有文件
    const uploadResults = await Promise.all(
      files.map((file, index) => uploadPostImage(
        file.buffer,
        postId,
        finalCommunityId,
        index,
        file.mimetype
      ))
    )

    // 构建返回数据
    const fileInfos = uploadResults.map((result, index) => ({
      url: result.url,
      hash: result.hash,
      name: files[index].originalname,
      size: files[index].size,
      type: files[index].mimetype
    }))

    res.json({
      success: true,
      files: fileInfos
    })
  } catch (error: any) {
    console.error('Upload post image error:', error)
    res.status(500).json({ success: false, message: error.message || '上传图片失败' })
  }
}
