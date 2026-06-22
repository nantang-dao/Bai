# 前端工程约定（mycoseed-frontend）

## 子目录组件必须显式 import

本项目的 `components/` 下常有子目录（如 `pixel/`、`markdown/`、`tasks/`）。**页面与布局中引用这些组件时，必须在 `<script setup>` 里手写 import**，不要依赖 Nuxt 自动注册名。

### 原因

Nuxt 对嵌套路径的自动组件名是「目录名 + 文件名」（例如 `components/markdown/SimpleMarkdownEditor.vue` → `MarkdownSimpleMarkdownEditor`）。模板里写 `<SimpleMarkdownEditor>` 时，若未 import，Vue 不会报错，但组件**不会挂载**，页面上会出现「标签在、内容空白」。

### 正确写法

```vue
<script setup lang="ts">
import PixelCard from '~/components/pixel/PixelCard.vue'
import SimpleMarkdownEditor from '~/components/markdown/SimpleMarkdownEditor.vue'
import MarkdownContent from '~/components/markdown/MarkdownContent.vue'
</script>

<template>
  <PixelCard>
    <SimpleMarkdownEditor v-model="text" />
    <MarkdownContent :content="text" />
  </PixelCard>
</template>
```

### 错误写法

```vue
<!-- 未 import，仅靠自动注册 — 子目录组件名可能对不上 -->
<SimpleMarkdownEditor v-model="text" />
```

### 适用范围

凡路径形如 `components/<子目录>/<Component>.vue` 的组件，在 `pages/`、`layouts/` 中使用时一律显式 import。`components/ActivityCard.vue` 这类根目录单文件可按团队习惯处理，但子目录组件以本约定为准。

---

## 关键 UI 改动后的验证

改完页面级 UI（新建/替换组件、表单控件等）后，除 `npm run build` 外应：

1. 运行 `npm run test:component-imports`（检查子目录组件是否漏 import）
2. 在浏览器打开受影响路由，确认控件可见、可交互（例如 `/tasks/create` 应有工具栏与输入框）
3. 查看控制台无 `Failed to resolve component` 等警告

纯 `utils/` 函数改动可只跑对应单元测试；**涉及 Vue 模板挂载的改动必须做页面级或 import 校验**。
