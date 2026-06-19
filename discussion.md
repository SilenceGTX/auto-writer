# Discussion Summary

本项目对话记录 — Auto-Writer 小说创作助手的功能迭代和问题修复。

---

## 〇、需求总览

### 项目定位
LLM 辅助小说创作工具，帮助作者进行结构化管理（系列、作品、章节、场景、设定），而非直接 AI 生成文本。

### 侧边栏导航
- 作品 (`/stories`)  — 作品/系列管理
- 大纲 (`/outline`)  — 章节+场景管理（核心写作规划工具）
- 写作 (`/write`)   — 正文写作编辑器（待实现）
- 设定 (`/worldbuilding`) — 世界设定（人物/地点/物品/组织及自定义类型）
- 灵感 (`/inspiration`) — 灵感碎片（待实现）
- 审阅 (`/review`) — 全文审阅（待实现）
- 系统设置 (`/settings`) — 偏好配置（待实现）

### 数据层级
```
系列 (Series)
  └─ 作品 (Story)
       ├─ 作品简介 (description)
       ├─ 章节 (Chapter) × N
       │    └─ 场景 (Scene) × N
       │         └─ 情节点 (PlotItem) × N
       │              ├─ 类型: 目标/铺垫/推进/冲突/反转/高潮/结尾
       │              └─ 描述: 多行文本
       └─ 设定条目 (WorldEntity) × N
            ├─ entity_type: chara/location/item/org/自定义
            ├─ name
            └─ properties: JSON (自由 key-value)
```

### 大纲模块（场景管理）需求
- 章节树：侧边栏展示，支持双击编辑标题、新建/删除、切换
- 场景卡片：每个章节含若干场景，可拖拽排序
- 情节点系统：每个场景含若干情节点
  - 7 种类型：🎯目标、📝铺垫、▶️推进、⚡冲突、🔄反转、🔥高潮、🏁结尾
  - 多行 textarea 描述
  - 拖拽排序
- YAML 导出：`{story}/{chapter}/scene_{id}/scene.yml`

### 设定模块（World Building）需求
- 每个作品有独立的设定数据，与作品绑定
- 设定按类型组织为 Tab：人物(chara)、地点(location)、物品(item)、组织(org) — 4 个默认
- 用户可新建自定义类型（如势力、魔法），标签存 localStorage
- 条目数据结构：
  ```json
  {
    "name": "Allen",
    "entity": "chara",
    "properties": { "age": 24, "gender": "male", "career": "knight" }
  }
  ```
- 属性 key 使用可搜索 dropdown，自动收集当前类型所有已用 key
- 页面布局：左（作品选择+搜索+条目树）+ 右（类型 tabs + 详情编辑）

### 全局 UX 规则
- 所有删除操作必须弹框确认，防止误删
- 弹框点击遮罩不关闭，只能通过按钮关闭（防止误触丢失内容）
- 章节树和工作区宽度可拖拽调整（160-500px），宽度持久化到 localStorage
- 大纲/写作页面自动缓存最后编辑的作品，从侧边栏进入时恢复

### 存储策略
- 数据库：SQLite，所有核心数据
- YAML 导出：`data/exports/` 目录，层级化存储场景数据
- localStorage：侧边栏宽度、上次编辑作品、自定义类型标签

---

## 一、基础设施修复

### 1.1 Nginx 反向代理
- **问题**: 生产模式下前端请求 `/api/*` 返回 404
- **修复**: 创建 `frontend/nginx.conf`，配置 `/api/` → `backend:8000` 反向代理；更新 Dockerfile 复制配置

### 1.2 PATCH 端点 Body 注解
- **问题**: 所有 PATCH 端点简单类型参数缺少 `Body()` 注解，FastAPI 将 JSON body 当作 query string 忽略
- **修复**: chapters/scenes/plot_items/stories/series 五个路由的 PATCH 端点全部加上 `Body(None)`

---

## 二、场景管理系统（大纲核心功能）

### 2.1 数据模型
- 增强 `Scene` 模型：添加 `updated_at`、`plot_items` relationship
- `Chapter` 添加 `scenes` relationship（back_populates）
- 新增 `PlotItem` 模型：`scene_id`、`item_type`（7 种类型）、`description`、`order`
- 情节点类型常量：目标、铺垫、推进、冲突、反转、高潮、结尾

### 2.2 API 路由
- `chapters.py`: 章节 CRUD（5 端点）
- `scenes.py`: 场景 CRUD + reorder + YAML export（7 端点）
- `plot_items.py`: 情节点 CRUD + reorder + types（6 端点）

### 2.3 YAML 导出
- `backend/app/services/yaml_export.py`: 支持单场景/整章节导出
- 目录结构: `{story}/{chapter}/scene_{id}/scene.yml`

### 2.4 前端 - WritePage 重写
- 左侧栏：作品面包屑 + 章节树（双击编辑标题、拖拽排序侧边栏宽度）
- 右侧工作区：场景卡片 + 情节点编辑器
- 情节点：类型 dropdown + 多行 textarea + 拖拽排序
- 章节标题编辑：Enter/blur 保存，DOM ref 直接读值解决闭包问题

---

## 三、可复用组件

### 3.1 ConfirmDialog
- `frontend/src/components/ConfirmDialog.tsx`
- 所有删除操作（作品/章节/场景/情节点/设定类型/设定条目）统一使用确认弹框
- 支持 `danger` 样式、自定义标题/内容/按钮文案

---

## 四、作品管理改进

### 4.1 导航优化
- 移除「总览」页面，`/` 重定向到 `/stories`
- 作品卡片增加「编写大纲」按钮 → `/outline?story={id}`

### 4.2 大纲/写作页面缓存
- 进入大纲页面时自动从 localStorage 恢复上次编辑的作品
- 从侧边栏点击「大纲」无需再从作品页进入

### 4.3 写作页面
- `/write` 路由改为 PlaceholderPage（待后续实现）

### 4.4 作品简介
- 章节树顶部固定「📝 作品简介」入口（不可删除）
- 右侧全高 textarea，失焦自动保存到 `Story.description`

---

## 五、设定管理系统（World Building）

### 5.1 数据模型
- 新增 `WorldEntity` 模型：`story_id`、`entity_type`、`name`、`properties`（JSON）
- 默认类型：人物(chara)、地点(location)、物品(item)、组织(org)
- 支持自定义类型（用户创建，标签存 localStorage）

### 5.2 API 路由
- `world.py`: types list、entities CRUD（6 端点）

### 5.3 前端 - WorldBuildingPage
- 左右分栏布局
- 左侧：作品 selector + 搜索框 + 条目树（点击选中、可删除）
- 右侧：水平类型 tabs（默认 4 个 + 自定义 + 新建按钮）+ 条目详情编辑面板
- 条目详情：名称 + key-value 属性编辑器
- 新建条目弹框：类型（只读，当前 tab 中文名）+ 名称 + 属性 KV 编辑器
- Key 输入框使用 `<datalist>` 实现可搜索 dropdown（自动收集当前类型所有已用 key）
- 点击遮罩不关闭弹框（防止误触丢失内容）
- 创建条目后自动聚焦到该条目
- 删除类型弹框确认（显示下属条目数量）

### 5.4 移除角色页面
- 侧边栏和路由中删除 `/characters`（设定系统已涵盖角色管理）

---

## 六、CSS / 布局修复

| 问题 | 修复 |
|------|------|
| 搜索框高度 346px | `.wb-left .wb-search` 设 `flex: none`，去除继承的 `flex: 1` |
| 新建条目按钮撑满宽度 | `.wb-tabs .btn-add` 覆盖 `width: auto` |
| 弹框各字段同行显示 | `.wb-field-row` flex 布局，label 固定 50px |
| 弹框宽度 | `.wb-modal-wide` max-width: 560px |
| 侧边栏可拖拽调整宽度 | 4px 拖拽手柄，范围 160-500px，宽度存 localStorage |
| 拖拽时宽度跳到最大值 | `e.clientX` 是绝对坐标，改用增量：mousedown 记录 `startX` + `startWidth`，mousemove 用 `startWidth + (clientX - startX)` |

---

## 七、关键经验教训

1. **FastAPI PATCH**: 简单类型参数必须显式加 `Body()`，否则被当作 query string
2. **React 闭包陷阱**: 事件 handler 中读 state 可能拿到旧值，用 ref 直接读 DOM 或事件对象
3. **`!value` 判空**: 数字 0 是 falsy，空值检查应用 `=== null`
4. **datalist 渲染位置**: 必须放在条件渲染之外，否则某些状态下 DOM 中不存在
5. **`flex: 1` 副作用**: 在 column flex 容器中会导致元素撑满高度
6. **拖拽调整宽度应用增量而非绝对值**: `e.clientX` 是视口绝对坐标，在多层 flex 布局中不能直接作为目标宽度。应在 `mousedown` 时记录初始鼠标位置和初始宽度，`mousemove` 时用增量 `delta = e.clientX - startX` 加到 `startWidth` 上
