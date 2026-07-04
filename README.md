# Auto-Writer

[![CI](https://github.com/SilenceGTX/auto-writer/actions/workflows/ci.yml/badge.svg)](https://github.com/SilenceGTX/auto-writer/actions/workflows/ci.yml)

LLM 辅助小说写作 Web 应用：帮助作者管理作品、构建世界观、编排大纲、撰写正文并完成审阅，全程可由 AI 协作。面向**单用户、本地优先**场景，SQLite 始终是唯一数据真源。

## 功能概览

- **作品管理**：作品增删改查；系列可创建并用于归类（暂不支持改名/删除）。列表支持搜索、排序、分页，进度可视化，行内状态切换。
- **世界观设定**：按种类（人物 / 地点 / 组织 / 概念 …）管理设定条目，支持自定义种类、键值属性，以及同种类下属性名称复用（模板候选）。
- **大纲编排**：基于故事结构（三幕式、起承转合、英雄之旅、斯奈德节拍表或自定义）生成阶段树与章节大纲，支持阶段筛选、章节拖拽排序、章节占比统计。
- **正文写作**：章节编辑器（撤销/重做、定时自动保存、实时字数、专注模式、滚动记忆），AI 草稿生成、局部重写 diff 预览、前情提要缓存，辅助区 AI 对话。
- **`@` 引用 & 灵感**：在大纲 / 写作 / 审阅助手中 `@` 引用设定条目并注入 prompt；任意页面选中文字「加入灵感」，在灵感页统一管理（搜索/过滤/标签/复制/回插正文末尾/来源跳转高亮）。
- **审阅**：阅读器（目录、翻页、阅读进度）+ AI 审阅对话；可将作品导出为 ZIP（解压后根目录为作品名，每章一个 `.md`，跳过无正文章节）。
- **系统设置**：连接配置（含连接测试）、全局偏好（创造力/聚焦度/篇幅档位 + 高级参数）、写作风格、数据保存、字体与排版，以及配置一键导入 / 导出。
- **导出与快照**：作品页可导出结构化 JSON（全量备份/迁移）或 Markdown（正文归档）；审阅页可导出按章节分文件的 ZIP。写作时按配置间隔自动写入磁盘快照（`outline.json`、正文 `.md`，并轮转历史版本；`scenes.json` 为场景细纲预留，当前尚无编辑界面）。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + HeroUI + Tailwind；pnpm 管理依赖，ESLint 检查，Vitest 测试。
- **后端**: Python 3.11 + FastAPI + SQLAlchemy（异步）+ SQLite；uv 管理依赖，Ruff 检查，Pytest 测试，loguru 日志。
- **部署**: Docker Compose（生产/开发）或桌面单进程包（Win / Linux / macOS）。

## 快速开始

### 桌面版（单进程，自动打开浏览器）

无需 Docker。从 [Releases](https://github.com/SilenceGTX/auto-writer/releases) 下载对应平台的压缩包，解压后：

| 平台 | 启动方式 |
|------|----------|
| Windows | 双击 `start.bat` |
| macOS | 双击 `start.command`，或在终端运行 `./start.sh` |
| Linux | 终端运行 `./start.sh` |

浏览器会自动打开本地地址（默认 `http://127.0.0.1:17890`）。在终端按 Ctrl+C 停止服务。

发布包内嵌对应平台的便携 CPython（`backend/runtime/python/`）与依赖（`backend/.venv/`），**用户不必单独安装 Python**。请下载与本机匹配的压缩包（如 `win-x64`），不要把 Linux/macOS 包拷到 Windows 使用。若 `start.bat` 报错提到 `hostedtoolcache`，说明是旧版构建，请重新下载最新 Release。

**用户数据目录**（数据库、快照、导出、日志；可用 `AW_DATA_DIR` 覆盖）：

| 平台 | 默认路径 |
|------|----------|
| Windows | `%LOCALAPPDATA%\Auto-Writer\` |
| macOS | `~/Library/Application Support/Auto-Writer/` |
| Linux | `~/.local/share/auto-writer/`（或 `$XDG_DATA_HOME/auto-writer/`） |

从源码本地试跑桌面模式（需已安装 [uv](https://docs.astral.sh/uv/) 与 pnpm）：

```bash
./scripts/start.sh          # Linux / macOS
scripts\start.bat           # Windows
```

手动打包（CI 使用同一脚本）：

```bash
cd frontend && pnpm install --frozen-lockfile && pnpm build && cd ..
python scripts/assemble_release.py --output dist/desktop --version dev
```

打 tag `v*` 推送后，GitHub Actions [Release 工作流](.github/workflows/release.yml) 会自动构建三平台安装包并发布。

### Docker 生产部署（一键启动）

```bash
docker compose up -d --build app
```

访问 http://localhost:8080 （后端 API 在 http://localhost:8000）。

> 加 `-d` 在后台运行，关闭终端后服务不会停。若不加 `-d`，终端里只会看到 nginx 日志，按 Ctrl+C 会停止前端容器；此时请访问 **8080**（不是开发环境的 5173）。

### Docker 开发环境（一键启动 + 热重载）

`docker-compose.dev.yml` 自成一体，可直接单独启动：

```bash
docker compose -f docker-compose.dev.yml up --build app
```

访问 http://localhost:5173，修改前后端代码即时生效。

> 生产镜像（`auto-writer-*:prod`，nginx）与开发镜像（`auto-writer-*:dev`，Vite 热重载）使用不同的镜像名，互不覆盖。首次或依赖变更后加 `--build` 以确保重新构建对应镜像。

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

- **SQLite 主库**：开发 / Docker 默认位于 `data/auto_writer.db`；桌面版写入上表中的用户数据目录。
- **快照**：默认写入 `{数据目录}/snapshots/{work_id}/`（路径与历史版本数量可在「系统设置 → 数据保存」中配置），包含 `outline.json`（阶段树与章节概述）、各章正文 `.md`；`scenes.json` 为场景细纲预留字段，作为数据库的备份。
- **导出**：手动导出文件写入 `data/exports/` 并触发浏览器下载（JSON / Markdown / 章节 ZIP）。
- **日志**：loguru 同时输出到控制台与 `data/logs/` 下的轮转文件。
- `data/` 目录已纳入 `.gitignore`；Docker 部署时通过卷挂载持久化。

## 项目结构

```
├── .github/workflows/        # CI（GitHub Actions）与 Release 打包
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── core/             # 配置、日志、路径
│   │   ├── models/           # SQLAlchemy ORM 模型
│   │   ├── routers/          # API 路由（works / outline / writing / review / export / settings …）
│   │   ├── services/         # 业务逻辑（llm / prompts / export / snapshot / chat …）
│   │   ├── frontend.py       # 桌面模式静态资源挂载
│   │   ├── launcher.py       # 桌面启动器（开浏览器 + 单进程服务）
│   │   ├── schemas.py        # Pydantic 请求/响应模型
│   │   ├── database.py
│   │   └── main.py
│   ├── tests/                # Pytest 测试
│   ├── Dockerfile
│   ├── .env.example
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/                 # React 前端
│   ├── public/               # 静态资源
│   ├── src/
│   │   ├── components/       # 通用布局与设置组件
│   │   ├── context/          # 全局状态（主题 / 当前作品 / 辅助区）
│   │   ├── hooks/            # 复用 React hooks
│   │   ├── pages/            # 各功能页面（含 outline / writing / review 等子目录）
│   │   ├── utils/            # 纯函数工具
│   │   ├── test/             # Vitest 测试
│   │   ├── api.ts            # API 客户端
│   │   ├── App.tsx           # 根组件
│   │   ├── main.tsx          # 入口
│   │   └── styles.css        # 全局样式
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf            # 生产镜像静态托管
│   ├── package.json
│   └── vite.config.ts
├── scripts/                  # 桌面打包与启动脚本
│   ├── assemble_release.py   # 组装三平台发布目录
│   ├── start.sh              # 开发树桌面启动（Linux / macOS）
│   ├── start.bat             # 开发树桌面启动（Windows）
│   └── start.command         # macOS 双击启动
├── docker-compose.yml        # 生产编排
├── docker-compose.dev.yml    # 开发编排（热重载）
└── README.md
```

运行时数据（`data/` 数据库、快照、导出、日志等）与本地环境文件（`.env`、`node_modules/` 等）见 `.gitignore`，不在仓库中跟踪。
