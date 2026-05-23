# 使用 Node.js 官方镜像
FROM node:20-alpine AS base

# 设置工作目录
WORKDIR /app

# 安装依赖阶段
FROM base AS deps
# 复制 package.json 和 package-lock.json
COPY package.json package-lock.json* ./
# 安装生产依赖
RUN npm ci --omit=dev && npm cache clean --force

# 构建阶段
FROM base AS build
# 复制 package.json 和配置文件
COPY package.json package-lock.json* tsconfig.json ./
# 安装所有依赖（包括 devDependencies）
RUN npm ci && npm cache clean --force
# 复制源代码
COPY src ./src
# 构建 TypeScript
RUN npm run build

# 生产阶段
FROM base AS runner

# 设置生产环境（PORT 默认 8080，与 fly.toml internal_port 一致，避免 Fly 未注入时落到 3001）
ENV NODE_ENV=production
ENV PORT=8080

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# 从 deps 阶段复制生产依赖
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
# 从 build 阶段复制构建产物
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
# 复制 package.json
COPY --chown=nodejs:nodejs package.json ./

# 切换到非 root 用户
USER nodejs

# 暴露端口（Fly.io 使用 internal_port=8080 时会注入 PORT=8080）
EXPOSE 8080

# 健康检查：使用环境变量 PORT，与 Fly.io 注入的 PORT 一致
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const p=process.env.PORT||8080;require('http').get('http://127.0.0.1:'+p+'/api/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

# 启动应用
CMD ["node", "dist/index.js"]

