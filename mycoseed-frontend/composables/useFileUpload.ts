import { ref } from 'vue'
import { useApi } from './useApi'

export const useFileUpload = () => {
  const uploading = ref(false)
  const previewUrl = ref<string | null>(null)
  const error = ref<string | null>(null)
  const { uploadAvatar } = useApi()

  const handleFileSelect = (file: File) => {
    error.value = null
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      error.value = '请选择图片文件'
      return false
    }
    
    // 验证文件大小（最大5MB）
    if (file.size > 5 * 1024 * 1024) {
      error.value = '图片大小不能超过5MB'
      return false
    }
    
    // 创建预览
    const reader = new FileReader()
    reader.onload = (e) => {
      previewUrl.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
    
    return true
  }

  const uploadFile = async (file: File): Promise<string | null> => {
    uploading.value = true
    error.value = null
    
    try {
      // 先创建预览
      if (!handleFileSelect(file)) {
        return null
      }
      
      // 上传文件到后端
      const result = await uploadAvatar(file)
      return result.url
    } catch (err: any) {
      error.value = err.message || '上传失败，请重试'
      console.error('Upload error:', err)
      return null
    } finally {
      uploading.value = false
    }
  }

  const clearPreview = () => {
    if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl.value)
    }
    previewUrl.value = null
    error.value = null
  }

  return {
    uploading,
    previewUrl,
    error,
    handleFileSelect,
    uploadFile,
    clearPreview
  }
}
