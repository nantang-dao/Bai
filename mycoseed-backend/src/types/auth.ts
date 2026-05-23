export interface User
{
    id: string
    phone?: string
    email?: string
    handle?: string
    image_url?: string      // 数据库字段名（后端使用）
    name?: string
    bio?: string
    avatar?: string         // 前端使用的字段名（与 image_url 互斥，前端优先使用 avatar）
    phone_verified: boolean
    password_hash?: string   // 密码哈希值（加密存储，不返回给前端）
    created_at?: string
    updated_at?: string
    // 钱包相关字段（从外部身份系统同步）
    evm_chain_address?: string
    evm_chain_active_key?: string
    encrypted_keys?: any
    // Semi 用户关联
    semi_id?: string  // Semi 用户 ID (TSID)
}

export interface AuthToken
{
    id: string
    token: string
    user_id: string
    disabled: boolean
    created_at?: string
    updated_at?: string
}

export interface VerificationToken
{
    id: string
    context: string
    sent_to: string
    code: string
    expires_at: string
    used: boolean
    created_at?: string
    updated_at?: string
}

export interface SendSMSRequest
{
    phone: string
}

export interface SignInRequest
{
    phone: string
    code: string
}

export interface SignInResponse
{
    result: string
    auth_token?: string
    phone?: string
    id?: string
    address_type?: string
}

