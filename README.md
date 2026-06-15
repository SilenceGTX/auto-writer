# Auto-Writer

LLM 辅助小说写作 Web 应用。

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **后端**: Python 3.11 + FastAPI + SQLAlchemy + SQLite
- **部署**: Docker

## 快速开始

### 本地开发

```bash
# 后端
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
pnpm install
pnpm dev
```

访问 http://localhost:5173

### Docker 生产部署

```bash
docker compose up -d
```

### Docker 开发环境（一键启动 + 热重载）

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

访问 http://localhost:5173，修改前后端代码即时生效。

## 项目结构

```
├── backend/          # FastAPI 后端
│   ├── app/
│   │   ├── core/     # 配置
│   │   ├── models/   # ORM 模型
│   │   ├── routers/  # API 路由
│   │   ├── services/ # 业务逻辑
│   │   ├── database.py
│   │   └── main.py
│   └── pyproject.toml
├── frontend/         # React 前端
│   ├── src/
│   │   ├── pages/    # 页面组件
│   │   ├── api.ts    # API 客户端
│   │   ├── App.tsx   # 根组件
│   │   └── main.tsx  # 入口
│   └── package.json
├── docker-compose.yml
└── AGENTS.md
```
