# 后端开发文档

SaaS服务Key调用与管理

1、项目技术栈

- 运行环境: Node.js + TypeScript
- Web框架: Express.js
- 数据库: Supabase 
- 短信服务: 阿里云SMS
- 文件存储: Supabase Storage
- 部署平台: Fly.io

2. 环境变量配置清单

2.1 阿里云SMS相关

```jsx
// 阿里云访问密钥ID
ACCESS_KEY_ID=
// 阿里云访问秘钥Secret
ACCESS_KEY_SECRET=
// 短信签名名称
ALIYUN_SMS_SIGN_NAME=安百
// 短信模版代码
ALIYUN_SMS_TEMPLATE_CODE=SMS_478855061
// 短信服务开关
SMS_ENABLED=ENABLED  
```

2.2 Supabase相关

```jsx
// supabase服务角色秘钥：https://supabase.com/dashboard/project/hljbelljnoreahmyvydp/settings/api-keys 这里看service_role
SUPABASE_SERVICE_ROLE_KEY
// supabase项目URL
SUPABASE_URL=
```

注意: `SUPABASE_SERVICE_ROLE_KEY` 拥有完整数据库权限，仅用于后端服务，切勿在前端使用。

2.3 前端配置

```jsx
FRONTEND_URL=
```

2.4 其他配置

```jsx
NODE_ENV=
PORT=
```

3. SMS

3.1 代码实现

SMS服务实现位于：`src/services/sms.ts`

在认证控制器中的调用位置：`src/controllers/authController.ts`

3.2.1 SMS_ENABLED开关机制

- 当 `SMS_ENABLED=ENABLED` 时，系统会尝试发送真实短信
- 当 `SMS_ENABLED` 未设置或为其他值时，跳过短信发送
- 即使短信发送失败，验证码仍会保存到数据库，不影响用户登录流程

3.2.2 开发环境Mock模式

当环境变量未设置时（开发环境常见情况）：
- 系统会输出警告日志
- `sendSMS` 函数会返回Mock响应 `{ Code: 'OK' }`
- 不会实际发送短信，但验证码仍会保存到数据库
- 开发环境会在响应中返回验证码，方便测试

4. Supabase服务配置与使用

4.1
Supabase客户端初始化位于：`src/services/supabase.ts`

文件存储服务位于：`src/services/storage.ts`
主要功能：
- `uploadFileToStorage`: 通用文件上传
- `uploadAvatar`: 用户头像上传
- `uploadTaskProof`: 任务凭证上传

4.2 使用Supabase Storage的配置要求

创建Storage Bucket:
   - 在Supabase Dashboard进入 Storage
   - 创建以下bucket：

avatars 存储桶：

```markdown
- Bucket name: `avatars`
- Public bucket
- File size limit: 
- Allowed MIME types: image/*
```

task-proofs 存储桶：

```jsx
- Bucket name: `task-proofs`
   - Public bucket
   - File size limit: `10 MB`
   - Allowed MIME types: application/pdf,image/*
```

上传文件后，使用 `getPublicUrl` 方法生成公共访问URL。

4.3 安全配置
`SUPABASE_SERVICE_ROLE_KEY` 拥有：
- 完整数据库读写权限
- 绕过所有RLS策略
- 访问所有表和数据
- Storage的完整访问权限

5、 前端URL配置

`FRONTEND_URL` 用于配置CORS（跨域资源共享），允许指定的前端域名访问后端API。

CORS配置位于：`src/index.ts`

```jsx
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // 允许的域名列表
    const allowedOrigins = [
      process.env.FRONTEND_URL, // Vercel 部署的前端 URL
      'http://localhost:3000',   // 本地开发
      'http://localhost:5173', // VITE默认端口
      'http://localhost:3003'  
    ].filter(Boolean) // 过滤掉 undefined
    
    // 开发环境允许所有来源，生产环境只允许配置的域名
    if (process.env.NODE_ENV === 'development' || !origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}
```

6. 附录

相关文档链接

```jsx
- [阿里云短信服务文档](https://help.aliyun.com/product/44282.html)
- [Supabase官方文档](https://supabase.com/docs)
- [Supabase JavaScript客户端文档](https://supabase.com/docs/reference/javascript/introduction)
- [Fly.io Secrets管理](https://fly.io/docs/reference/secrets/)
- [Express.js CORS配置](https://expressjs.com/en/resources/middleware/cors.html)
```

服务商控制台地址

```jsx
- **阿里云控制台**: https://ecs.console.aliyun.com/
- **阿里云短信服务**: https://dysms.console.aliyun.com/
- **Supabase Dashboard**: https://app.supabase.com/
- **Fly.io Dashboard**: https://fly.io/dashboard
```