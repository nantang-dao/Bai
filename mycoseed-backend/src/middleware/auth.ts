import { Request, Response, NextFunction } from 'express'
import { supabase } from '../services/supabase'  
import { User } from '../types/auth'

export interface MulterFile {
    fieldname: string
    originalname: string
    encoding: string
    mimetype: string
    size: number
    buffer: Buffer
    destination?: string
    filename?: string
    path?: string
}

export interface AuthRequest extends Omit<Request, 'file' | 'files'> {
    user?: User
    file?: MulterFile
    files?: MulterFile[] | { [fieldname: string]: MulterFile[] }
}

export const authenticate = async (req:AuthRequest,res:Response,next:NextFunction)=>
{
    try
    {
        const authHeader = req.headers.authorization

        if(!authHeader || !authHeader.startsWith('Bearer '))
        {
            return res.status(401).json({result:'error',message:'Unauthorized'})
        }

        const token = authHeader.split(' ')[1]

        // 查找 token
        const {data:authToken, error: tokenError} = await supabase
            .from('auth_tokens')
            .select('user_id')
            .eq('token',token)
            .eq('disabled',false)
            .single()
        
        if(tokenError || !authToken)
        {
            return res.status(401).json({result:'error',message:'Invalid token'})
        }

        // 根据 user_id 查询用户信息
        const {data:user, error:userError} = await supabase
            .from('users')
            .select('*')
            .eq('id',authToken.user_id)
            .single()
        
        if(userError || !user)
        {
            return res.status(401).json({result:'error',message:'User not found'})
        }

        // 将用户信息附加到请求对象
        req.user = user as User
        next()
    } catch (error:any)
    {
        console.error('Authentication error:',error)
        res.status(401).json({result:'error',message:'Unauthorized'})
    }
}

/** 可选认证：有 token 则设置 req.user，无 token 不报错 */
export const optionalAuthenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) return next()
        const token = authHeader.split(' ')[1]
        const { data: authToken, error: tokenError } = await supabase
            .from('auth_tokens')
            .select('user_id')
            .eq('token', token)
            .eq('disabled', false)
            .single()
        if (tokenError || !authToken) return next()
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authToken.user_id)
            .single()
        if (userError || !user) return next()
        req.user = user as User
        next()
    } catch (_) {
        next()
    }
}
