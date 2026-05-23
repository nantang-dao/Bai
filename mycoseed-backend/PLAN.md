# 任务发布功能 Supabase 后端实现计划

## 项目结构

参考 `semi-new` 的架构，在 `mycoseed` 目录下创建：

- `mycoseed-backend/` - Node.js + Express 后端服务
- 保持 `mycoseed-frontend/` 不变，只修改 API 调用

## 实现步骤

### 1. 创建后端项目结构

在 `mycoseed/` 目录下创建 `mycoseed-backend/` 文件夹，包含：

- `package.json` - 项目依赖（express, @supabase/supabase-js, cors, dotenv 等）
- `src/` - 源代码目录
  - `index.ts` - Express 服务器入口
  - `routes/tasks.ts` - 任务相关路由
  - `controllers/tasksController.ts` - 任务控制器
  - `services/supabase.ts` - Supabase 客户端配置
  - `types/task.ts` - TypeScript 类型定义
- `db/` - 数据库相关
  - `migrations/` - SQL 迁移文件
  - `schema.sql` - 数据库表结构
- `.env.example` - 环境变量示例
- `README.md` - 后端文档

### 2. 数据库设计

在 Supabase 中创建以下表：

- `tasks` 表：
  - `id` (uuid, primary key)
  - `title` (text)
  - `description` (text)
  - `reward` (numeric)
  - `start_date` (timestamp)
  - `deadline` (timestamp)
  - `status` (text: 'unclaimed' | 'in_progress' | 'under_review' | 'completed' | 'rejected')
  - `proof_config` (jsonb) - 证明要求配置
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

### 3. 后端 API 端点

创建以下 RESTful API：

- `GET /api/tasks` - 获取所有任务列表
- `GET /api/tasks/:id` - 获取单个任务详情
- `POST /api/tasks` - 创建新任务
- `PATCH /api/tasks/:id/claim` - 领取任务
- `PATCH /api/tasks/:id/submit` - 提交任务凭证
- `GET /api/health` - 健康检查

### 4. 前端 API 调用修改

修改 `mycoseed-frontend/utils/api.ts`：

- 添加 `API_BASE_URL` 环境变量配置
- 将 `createTask`, `getAllTasks`, `claimTask`, `submitProof` 等函数改为调用真实后端 API
- 保持接口签名不变，确保前端代码无需修改

### 5. 环境配置

- 后端 `.env` 文件：Supabase URL 和 API Key
- 前端 `nuxt.config.ts`：添加 `NUXT_PUBLIC_API_URL` 环境变量

### 6. CORS 配置

在后端配置 CORS，允许前端跨域请求

## 技术栈

- **后端**: Node.js + Express + TypeScript
- **数据库**: Supabase (PostgreSQL)
- **ORM/客户端**: @supabase/supabase-js

## 文件清单

### 新建文件

- `mycoseed-backend/package.json`
- `mycoseed-backend/tsconfig.json`
- `mycoseed-backend/.env.example`
- `mycoseed-backend/README.md`
- `mycoseed-backend/src/index.ts`
- `mycoseed-backend/src/routes/tasks.ts`
- `mycoseed-backend/src/controllers/tasksController.ts`
- `mycoseed-backend/src/services/supabase.ts`
- `mycoseed-backend/src/types/task.ts`
- `mycoseed-backend/db/migrations/001_create_tasks_table.sql`

### 修改文件

- `mycoseed-frontend/utils/api.ts` - 替换 mock 数据为真实 API 调用
- `mycoseed-frontend/nuxt.config.ts` - 添加 API URL 环境变量配置
- `mycoseed-frontend/.env.example` - 添加后端 API URL（如需要）

## 注意事项

1. 暂时不需要用户认证，所有 API 都是公开的
2. 所有用户都能看到所有任务
3. 保持前端代码结构不变，只修改 API 调用层
4. 数据库迁移文件需要手动在 Supabase 中执行，或使用 Supabase CLI

## To-dos

- [ ] 创建后端项目基础结构（package.json, tsconfig.json, 目录结构）
- [ ] 创建 Supabase 客户端服务配置
- [ ] 创建数据库表结构 SQL 文件（tasks 表）
- [ ] 定义 TypeScript 类型（Task, CreateTaskParams 等）
- [ ] 实现任务控制器（CRUD 操作）
- [ ] 创建任务路由和 Express 服务器
- [ ] 修改前端 utils/api.ts，将 mock 数据替换为真实 API 调用
- [ ] 配置前后端环境变量（API URL, Supabase 配置）

