# MycoSeed - 菌丝计划

一个基于像素艺术风格的互助社区平台，将互助行为游戏化。

## 🍄 项目简介

MycoSeed 是一个受超级马里奥启发的 8-bit 像素风格 Web3 应用，通过游戏化的方式促进社区互助。核心概念是"互助即游戏"（Mutual Aid as Gameplay）。

### 核心特性

- **像素艺术风格 UI**：8-bit 复古游戏风格界面
- **网络图谱可视化**：使用 D3.js 实现的动态力导向图，展示用户和社区关系
- **游戏化机制**：积分系统、徽章、任务等游戏元素
- **Web3 集成**：支持钱包连接、链上交易等功能
- **社区治理**：DAO 投票、社区管理

## 🛠 技术栈

- **框架**: Nuxt 3
- **UI 库**: @nuxt/ui, Tailwind CSS
- **状态管理**: Pinia
- **数据可视化**: D3.js
- **图标**: @nuxt/icon

## 📦 安装

确保已安装 Node.js (推荐 v18+) 和 Yarn。

```bash
# 安装依赖
yarn install
```

## 🚀 开发

启动开发服务器（默认端口 3003）：

```bash
yarn dev
```

访问 `http://localhost:3003` 查看应用。

## 📁 项目结构

```
activity-frontend/
├── components/          # Vue 组件
│   ├── pixel/          # 像素风格 UI 组件
│   ├── layout/         # 布局组件
│   └── graph/          # 图表组件
├── pages/              # 页面路由
├── layouts/            # 布局模板
├── stores/             # Pinia 状态管理
├── composables/        # 组合式函数
├── utils/              # 工具函数
└── public/             # 静态资源
```

详细的项目结构说明请查看 [PAGE_STRUCTURE.md](./PAGE_STRUCTURE.md)

## 🎨 像素风格组件

项目提供了一套像素风格的 UI 组件：

- `PixelButton.vue` - 像素风格按钮
- `PixelCard.vue` - 像素风格卡片容器
- `PixelAvatar.vue` - 像素风格头像生成器

详细设置说明请查看 [SETUP_PIXEL.md](./SETUP_PIXEL.md)

## 📝 主要页面

- `/` - 首页（网络图谱）
- `/wallet` - 钱包页面
- `/community/[id]` - 社区详情
- `/member/[id]` - 用户主页
- `/tasks` - 任务列表
- `/activities` - 活动列表
- `/dao` - DAO 治理
- `/market` - 商城

## 🏗 构建

构建生产版本：

```bash
yarn build
```

预览生产构建：

```bash
yarn preview
```

## 📚 相关文档

- [页面结构说明](./PAGE_STRUCTURE.md)
- [像素风格设置](./SETUP_PIXEL.md)
- [Nuxt 文档](https://nuxt.com/docs)

## 📄 许可证

© 2024 MYCOSEED • PRESS START
