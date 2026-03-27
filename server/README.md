# 后端服务 - 使用说明

## 概述

这个后端服务负责处理游戏生成的前4步LLM调用，将结果返回给前端继续处理。

## 功能

1. **RAG检索** - 从游戏数据库中检索相似游戏
2. **描述增强** - 增强用户的游戏描述
3. **Schema生成** - 生成地图元素定义
4. **详细规则生成** - 生成详细的游戏规则

## 启动步骤

### 1. 配置环境变量

编辑 `server/.env` 文件，设置你的OpenAI API密钥：

```
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
PORT=3000
```

### 2. 安装依赖（如果还没有）

```bash
cd server
npm install
```

### 3. 启动服务

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

## API接口

### POST /api/rag/prepare

前4步准备接口，一次性返回所有结果。

**请求体**：
```json
{
  "sessionId": "unique-session-id",
  "userPrompt": "制作一个射击游戏",
  "mapWidth": 18,
  "mapHeight": 18
}
```

**响应**：
```json
{
  "success": true,
  "ragResults": [...],
  "enhancedDescription": "...",
  "schema": {...},
  "detailedRules": "..."
}
```

### GET /api/health

健康检查接口。

## 测试

使用curl测试：

```bash
curl -X POST http://localhost:3000/api/rag/prepare \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-1","userPrompt":"制作一个射击游戏","mapWidth":18,"mapHeight":18}'
```

## 目录结构

```
server/
├── src/
│   ├── index.ts              # Express入口
│   └── services/
│       ├── RAGService.ts     # RAG检索服务
│       ├── LLMService.ts     # LLM调用服务
│       └── PromptService.ts   # 提示词服务
├── data/
│   └── summaries_embedded.json  # 游戏数据（10MB）
├── package.json
├── tsconfig.json
└── .env                    # 环境变量配置
```

## 技术栈

- Node.js + Express + TypeScript
- OpenAI SDK (用于LLM和Embedding调用)
- 本地文件系统（读取JSON数据）

## 注意事项

1. 确保 `data/summaries_embedded.json` 文件存在（约10MB）
2. 确保设置了正确的OPENAI_API_KEY
3. 首次启动会加载游戏数据到内存，需要几秒钟
