# DESIGN.md — Auto-Writer 前端设计规范

> 记录前端的视觉风格、布局结构、组件体系和使用约定，方便后续维护与迭代。

---

## 1. 技术选型

| 层面 | 选型 | 说明 |
|------|------|------|
| 框架 | React 18.3 | 函数组件 + Hooks |
| 语言 | TypeScript 5.4 | 全量类型覆盖 |
| 路由 | react-router-dom v6 | `BrowserRouter`，客户端路由 |
| 构建 | Vite 5.3 | 开发服务器 + 生产打包 |
| 样式 | 纯 CSS | 无 UI 库、无 CSS-in-JS、无 Tailwind |
| 图标 | Emoji | 直接写在 JSX 中，不依赖图标库 |
| 语言 | `zh-CN` | `<html lang="zh-CN">` |

---

## 2. 布局体系

### 2.1 整体结构

```
┌──────────────────────────────────────────────────┐
│  .app  (display: flex, height: 100vh)            │
│  ┌──────────┬───────────────────────────────────┐│
│  │ .sidebar │ .workspace                        ││
│  │ 200px    │ flex: 1, overflow-y: auto         ││
│  │ 固定宽度  │ padding: 32px 40px                ││
│  │          │                                   ││
│  └──────────┴───────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

- **左侧**：固定宽度 200px 深色导航栏（`.sidebar`）
- **右侧**：自适应浅色工作区（`.workspace`），为 React Router `<Routes>` 出口
- 全屏高度布局（`height: 100vh`），工作区超出时独立滚动

### 2.2 CSS 变量（设计令牌）

定义在 `:root` 中，位于 `src/index.css`：

| 变量 | 值 | 说明 |
|------|-----|------|
| `--sidebar-width` | `200px` | 侧边栏宽度 |
| `--sidebar-bg` | `#1e1e2e` | 侧边栏深色背景 |
| `--sidebar-text` | `#cdd6f4` | 侧边栏文字色 |
| `--sidebar-active` | `#4a90d9` | 激活态高亮 + 主按钮色 |
| `--workspace-bg` | `#f5f5f5` | 工作区背景 |

---

## 3. 色彩规范

| 用途 | 色值 | 备注 |
|------|------|------|
| 页面背景 | `#f5f5f5` | `--workspace-bg` |
| 侧边栏背景 | `#1e1e2e` | `--sidebar-bg` |
| 侧边栏文字 | `#cdd6f4` | `--sidebar-text` |
| 正文文字 | `#222` | body 默认 |
| 主色调/按钮/激活 | `#4a90d9` | `--sidebar-active` |
| 按钮 hover | `#357abd` | 主色加深 |
| 危险按钮 | `#d94a4a` | 删除等操作 |
| 危险按钮 hover | `#b93a3a` | |
| 卡片/列表项背景 | `#fff` | 带阴影 `0 1px 3px rgba(0,0,0,0.08)` |
| 次要文字 | `#666` / `#888` | placeholder、hint |
| 时间等元信息 | `#999` | `.story-meta` |
| 输入框边框 | `#ccc` | |
| 侧边栏分割线 | `rgba(255,255,255,0.08)` | border-top/bottom |

---

## 4. 排版

| 层级 | 字号 | 字重 | 说明 |
|------|------|------|------|
| 统计数字 | `2rem` | `700` | `.card-num` |
| 页面标题 h1 | 默认（约 2rem） | 默认 | 各页面统一 `margin-bottom: 16px` |
| 区域标题 h2 | `1.1rem` | 默认 | `.dashboard-section h2` |
| 品牌名 | `1.1rem` | `700` | `.sidebar-brand`，letter-spacing `0.5px` |
| 正文/导航 | `0.93rem` | 默认 | `.sidebar-link` |
| 提示文字 | `0.95rem` | 默认 | `.placeholder-hint` |
| 元信息 | `0.85rem` | 默认 | `.story-meta` |

- **字体栈**：`"Segoe UI", system-ui, sans-serif`（全局继承，含 `.editor`）
- **行高**：`1.6`（全局）

---

## 5. 组件体系

### 5.1 Sidebar（`src/components/Sidebar.tsx`）

侧边导航栏，分为上下两组：

**上部导航（8 项）：**

| 图标 | 标签 | 路由 | 页面 |
|------|------|------|------|
| 🏠 | 总览 | `/` | DashboardPage |
| 📖 | 作品 | `/stories` | StoriesPage |
| 🗺️ | 大纲 | `/outline` | PlaceholderPage |
| ✍️ | 写作 | `/write` | WritePage |
| 👤 | 角色 | `/characters` | PlaceholderPage |
| 🌍 | 设定 | `/worldbuilding` | PlaceholderPage |
| 💡 | 灵感 | `/inspiration` | PlaceholderPage |
| 🔍 | 审阅 | `/review` | PlaceholderPage |

**下部导航（1 项）：**

| 图标 | 标签 | 路由 | 页面 |
|------|------|------|------|
| ⚙️ | 系统设置 | `/settings` | PlaceholderPage |

- 使用 `NavLink` 组件，`end` 精确匹配
- 激活态追加 `.active` 类：半透明蓝色背景 + 白色文字
- 上下组之间用 `border-top` 分割线分隔
- 每个链接结构：`span.sidebar-icon`（22px 定宽居中）+ `span.sidebar-label`

### 5.2 页面组件

| 组件 | 文件 | 状态 |
|------|------|------|
| `DashboardPage` | `src/pages/DashboardPage.tsx` | 已完成 — 4 张统计卡片 + 最近作品列表 |
| `StoriesPage` | `src/pages/StoriesPage.tsx` | 已完成 — 创建/删除/列表 |
| `WritePage` | `src/pages/WritePage.tsx` | 骨架 — textarea + AI 按钮占位 |
| `PlaceholderPage` | `src/pages/PlaceholderPage.tsx` | 通用占位 — 接收 `title` prop |

### 5.3 通用样式类

| 类名 | 用途 | 关键属性 |
|------|------|----------|
| `.card` | 统计卡片 | `border-radius: 8px`, `padding: 24px`, 白底 + 阴影，居中 |
| `.dashboard-cards` | 4 列卡片网格 | `grid-template-columns: repeat(4, 1fr)`, gap `16px` |
| `.story-list li` | 作品列表项 | flex row, `padding: 12px`, `border-radius: 6px`, 白底 + 阴影 |
| `.create-form` | 行内表单 | flex row, gap `8px` |
| `.create-form input` | 文本输入框 | `border-radius: 6px`, padding `8px 12px` |
| `button` | 主按钮 | `border-radius: 6px`, bg `#4a90d9`, padding `8px 16px` |
| `button.danger` | 危险按钮 | bg `#d94a4a` |
| `.editor` | 文本编辑区 | `min-height: 400px`, `border-radius: 6px`, 垂直可拖拽 |
| `.toolbar` | 编辑器工具栏 | flex row, gap `8px` |

---

## 6. 开发约定

### 6.1 新增页面

1. 在 `src/pages/` 下新建 `XxxPage.tsx`
2. 在 `App.tsx` 添加 `<Route>`（一般使用 `PlaceholderPage` 占位即可快速上线）
3. 如需侧边栏入口，在 `Sidebar.tsx` 的 `topItems` 或 `bottomItems` 中添加

### 6.2 样式

- 所有样式写在 `src/index.css`，不分拆文件
- 新组件样式优先复用已有的通用类（`.card`、`.story-list`、`button` 等）
- 新增颜色优先抽象为 CSS 变量，放在 `:root` 中
- 不要引入 CSS 框架或 utility 库

### 6.3 API 通信

- 封装在 `src/api.ts`
- 使用 `fetch`，base path 为 `/api`（Vite proxy 转发到后端）
- 接口类型（如 `Story`）也在 `api.ts` 中定义

### 6.4 路由

- `NavLink` 一律使用 `end` 精确匹配
- 首页 `/` 为仪表盘总览
- 各功能模块路径均为一级路径

---

## 7. 依赖清单

**运行时（3 个）：**
- `react` ^18.3.1
- `react-dom` ^18.3.1
- `react-router-dom` ^6.23.1

**开发时（6 个）：**
- `typescript` ^5.4.5
- `vite` ^5.3.1
- `@vitejs/plugin-react` ^4.3.0
- `@types/react` ^18.3.3
- `@types/react-dom` ^18.3.0
- `eslint` ^8.57.0
