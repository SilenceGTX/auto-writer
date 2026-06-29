# Auto-Writer

LLM 辅助小说写作 Web 应用：帮助作者管理作品、构建世界观、编排大纲、撰写正文并完成审阅，全程可由 AI 协作。面向**单用户、本地优先**场景，SQLite 始终是唯一数据真源。

## 功能概览

- **作品管理**：系列 / 作品的增删改查，列表搜索、排序、分页，进度可视化，行内状态切换。
- **世界观设定**：按种类（人物 / 地点 / 组织 / 概念 …）管理设定条目，支持自定义键值属性与属性模板。
- **大纲编排**：基于故事结构（三幕式、起承转合、英雄之旅、斯奈德节拍表或自定义）生成阶段树与章节大纲，支持阶段筛选、拖拽排序、章节占比统计。
- **正文写作**：章节编辑器（撤销/重做、定时自动保存、实时字数、专注模式、滚动记忆），AI 草稿生成、局部重写 diff 预览、前情提要缓存，辅助区 AI 对话。
- **`@` 引用 & 灵感**：在大纲/写作中 `@` 引用设定条目并注入 prompt；任意页面选中文字「加入灵感」，在灵感页统一管理（搜索/过滤/标签/复制/回插正文末尾/来源跳转高亮）。
- **审阅**：阅读器（目录、翻页、阅读进度）+ AI 审阅对话。
- **系统设置**：连接配置（含连接测试）、全局偏好（创造力/聚焦度/篇幅档位 + 高级参数）、写作风格、数据保存、字体与排版，以及配置一键导入 / 导出。
- **导出与快照**：作品可导出为结构化 JSON（全量备份/迁移）或 Markdown（正文归档）；写作时按配置间隔自动写入磁盘快照（大纲/细纲 `.json`、正文 `.md`，并轮转历史版本）。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + HeroUI + Tailwind；pnpm 管理依赖，ESLint 检查，Vitest 测试。
- **后端**: Python 3.11 + FastAPI + SQLAlchemy（异步）+ SQLite；uv 管理依赖，Ruff 检查，Pytest 测试，loguru 日志。
- **部署**: Docker Compose（一键启动）。

## 快速开始

### Docker 生产部署（一键启动）

```bash
docker compose up --build app
```

访问 http://localhost:8080 （后端 API 在 http://localhost:8000）。

### Docker 开发环境（一键启动 + 热重载）

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build app
```

访问 http://localhost:5173，修改前后端代码即时生效。

### 本地开发（不使用 Docker）

```bash
# 后端
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000

# 前端（另开终端）
cd frontend
pnpm install
pnpm dev
```

访问 http://localhost:5173。

## 测试与检查

```bash
# 后端
cd backend
uv run ruff check app tests
uv run pytest

# 前端
cd frontend
pnpm exec eslint src
pnpm exec tsc --noEmit
pnpm exec vitest run
```

## 数据与存储

- **SQLite 主库**：默认位于 `data/auto_writer.db`，为唯一数据真源（表结构见 `designs/DATA_STORAGE_DESIGN.md`）。
- **快照**：默认写入 `data/snapshots/{work_id}/`（路径与历史版本数量可在「系统设置 → 数据保存」中配置），作为数据库的备份。
- **导出**：手动导出文件写入 `data/exports/` 并触发浏览器下载。
- **日志**：loguru 同时输出到控制台与 `data/logs/` 下的轮转文件。
- `data/` 目录已纳入 `.gitignore`；Docker 部署时通过卷挂载持久化。

## 项目结构

```
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── core/             # 配置与日志
│   │   ├── models/           # SQLAlchemy ORM 模型
│   │   ├── routers/          # API 路由（works/outline/writing/review/export/settings…）
│   │   ├── services/         # 业务逻辑（llm/prompts/export/snapshot/chat…）
│   │   ├── schemas.py        # Pydantic 请求/响应模型
│   │   ├── database.py
│   │   └── main.py
│   ├── tests/                # Pytest 测试
│   └── pyproject.toml
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── components/        # 通用布局与设置组件
│   │   ├── context/          # 全局状态（主题/当前作品/辅助区）
│   │   ├── pages/            # 各功能页面
│   │   ├── hooks/ utils/     # 复用 hook 与工具
│   │   ├── test/             # Vitest 测试
│   │   ├── api.ts            # API 客户端
│   │   ├── App.tsx           # 根组件
│   │   └── main.tsx          # 入口
│   └── package.json
├── designs/                  # 设计文档（权威需求与数据存储设计）
├── docker-compose.yml        # 生产编排
├── docker-compose.dev.yml    # 开发编排（热重载）
└── AGENTS.md                 # 协作智能体指南
```
