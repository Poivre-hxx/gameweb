/**
 * Express服务入口 - 后端API
 */

// CRITICAL: dotenv.config() 必须在所有其他 import 之前调用
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

if (!process.env.OPENAI_API_KEY) {
  console.error('[ERROR] OPENAI_API_KEY not found in .env file at:', envPath);
  throw new Error(`Failed to load OPENAI_API_KEY from ${envPath}`);
}
console.log('[Server] Environment variables loaded from .env');

import express from 'express';
import cors from 'cors';
import { ragService } from './services/RAGService.js';
import { llmService } from './services/LLMService.js';
import { promptService } from './services/PromptService.js';
import { mapGenerationService } from './services/MapGenerationService.js';
import { gameCodeGenerationService } from './services/GameCodeGenerationService.js';
import { controlInstructionService } from './services/ControlInstructionService.js';
import { feedbackAnalysisService } from './services/FeedbackAnalysisService.js';
import { segmentDetectionService } from './services/SegmentDetectionService.js';
import { backupService, SessionData } from './services/BackupService.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ============ 活跃会话缓存 ============
// 用于在内存中保持活跃会话，避免频繁文件读写
const activeSessions = new Map<string, SessionData>();

// 会话超时时间（30分钟无活动则从缓存移除并保存）
const SESSION_TIMEOUT = 30 * 60 * 1000;
const sessionTimers = new Map<string, NodeJS.Timeout>();

/**
 * 获取或创建会话
 */
function getOrCreateSession(userId: string, sessionId?: string, metadata?: any): SessionData {
  // 如果提供了sessionId，尝试从缓存或文件获取
  if (sessionId) {
    // 先检查缓存
    const cacheKey = `${userId}:${sessionId}`;
    if (activeSessions.has(cacheKey)) {
      refreshSessionTimer(cacheKey);
      return activeSessions.get(cacheKey)!;
    }
    
    // 再检查文件
    const existingSession = backupService.getSession(userId, sessionId);
    if (existingSession) {
      activeSessions.set(cacheKey, existingSession);
      refreshSessionTimer(cacheKey);
      return existingSession;
    }
  }

  // 创建新会话
  const newSession = backupService.createSession(userId, metadata);
  const cacheKey = `${userId}:${newSession.sessionId}`;
  activeSessions.set(cacheKey, newSession);
  refreshSessionTimer(cacheKey);
  
  // 立即保存新会话
  backupService.saveSession(newSession);
  console.log(`[Session] 创建新会话: ${newSession.sessionId}`);
  
  return newSession;
}

/**
 * 刷新会话超时计时器
 */
function refreshSessionTimer(cacheKey: string): void {
  // 清除旧计时器
  if (sessionTimers.has(cacheKey)) {
    clearTimeout(sessionTimers.get(cacheKey)!);
  }
  
  // 设置新计时器
  const timer = setTimeout(() => {
    const session = activeSessions.get(cacheKey);
    if (session) {
      backupService.saveSession(session);
      activeSessions.delete(cacheKey);
      console.log(`[Session] 会话超时已保存并移除: ${cacheKey}`);
    }
    sessionTimers.delete(cacheKey);
  }, SESSION_TIMEOUT);
  
  sessionTimers.set(cacheKey, timer);
}

/**
 * 保存步骤并更新会话
 */
function saveStepToSession(userId: string, sessionId: string, stepName: string, data: any): void {
  const cacheKey = `${userId}:${sessionId}`;
  const session = activeSessions.get(cacheKey);
  
  if (session) {
    backupService.addStep(session, stepName, data);
    backupService.saveSession(session);
    console.log(`[Session] 步骤已保存: ${stepName} -> ${sessionId}`);
  }
}

// ============ 中间件 ============
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use((req, res, next) => {
  // 优先读取 Nginx 传递的真实 IP
  const ip = (req.headers['x-real-ip'] as string) 
          || (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
          || req.ip 
          || 'unknown';
  
  (req as any).userIp = ip;
  (req as any).userId = backupService.generateUserId(ip);
  next();
});

// ============ API 路由 ============

/**
 * 步骤1: RAG检索相似游戏
 */
app.post('/api/rag/search', async (req, res) => {
  const { userPrompt, topK, sessionId } = req.body;
  const userId = (req as any).userId;

  console.log('[API] 步骤1: RAG检索开始...', { userPrompt, topK });

  try {
    // 获取或创建会话
    const session = getOrCreateSession(userId, sessionId, {
      userPrompt,
      startStep: 'rag_search'
    });

    const ragResults = await ragService.searchSimilarGames(userPrompt, topK || 3);
    console.log('[API] 步骤1: RAG检索完成');

    // 自动备份
    saveStepToSession(userId, session.sessionId, 'rag_search', { 
      userPrompt, 
      topK: topK || 3,
      ragResults 
    });

    res.json({
      success: true,
      ragResults,
      sessionId: session.sessionId  // 返回sessionId供后续步骤使用
    });
  } catch (error) {
    console.error('[API] RAG检索错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 步骤2: 描述增强
 */
app.post('/api/description/enhance', async (req, res) => {
  const { userPrompt, ragResults, sessionId } = req.body;
  const userId = (req as any).userId;

  console.log('[API] 步骤2: 描述增强开始...');

  try {
    // 获取或创建会话
    const session = getOrCreateSession(userId, sessionId, { userPrompt });

    const enhancePrompt = promptService.buildDescriptionEnhancePrompt(userPrompt, ragResults);
    const enhancedDescription = await llmService.callWithRetry(enhancePrompt);
    console.log('[API] 步骤2: 描述增强完成');

    // 自动备份
    saveStepToSession(userId, session.sessionId, 'description_enhance', { 
      enhancedDescription 
    });

    res.json({
      success: true,
      enhancedDescription,
      sessionId: session.sessionId
    });
  } catch (error) {
    console.error('[API] 描述增强错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 步骤3: Schema生成
 */
app.post('/api/schema/generate', async (req, res) => {
  const { enhancedDescription, ragResults, mapWidth, mapHeight, sessionId } = req.body;
  const userId = (req as any).userId;

  console.log('[API] 步骤3: Schema生成开始...');

  try {
    const session = getOrCreateSession(userId, sessionId, { mapWidth, mapHeight });

    const schemaPrompt = promptService.buildSchemaGenerationPrompt(
      enhancedDescription,
      ragResults,
      { width: mapWidth, height: mapHeight }
    );
    const schemaJson = await llmService.callWithRetry(schemaPrompt);

    const cleanedSchema = schemaJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const schema = JSON.parse(cleanedSchema);
    console.log('[API] 步骤3: Schema生成完成');

    // 自动备份
    saveStepToSession(userId, session.sessionId, 'schema_generate', { 
      mapWidth, 
      mapHeight, 
      schema 
    });

    res.json({
      success: true,
      schema,
      sessionId: session.sessionId
    });
  } catch (error) {
    console.error('[API] Schema生成错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 步骤4: 详细规则生成
 */
app.post('/api/rules/generate', async (req, res) => {
  const { enhancedDescription, ragResults, schema, mapWidth, mapHeight, sessionId } = req.body;
  const userId = (req as any).userId;

  console.log('[API] 步骤4: 详细规则生成开始...');

  try {
    const session = getOrCreateSession(userId, sessionId);

    const rulesPrompt = promptService.buildDetailedRulesPrompt(
      enhancedDescription,
      ragResults,
      schema,
      { width: mapWidth, height: mapHeight }
    );
    const detailedRules = await llmService.callWithRetry(rulesPrompt);
    console.log('[API] 步骤4: 详细规则生成完成');

    // 自动备份
    saveStepToSession(userId, session.sessionId, 'rules_generate', { 
      detailedRules 
    });

    res.json({
      success: true,
      detailedRules,
      sessionId: session.sessionId
    });
  } catch (error) {
    console.error('[API] 详细规则生成错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 步骤5: 操作说明生成
 */
app.post('/api/control-instructions/generate', async (req, res) => {
  const { rules, sessionId } = req.body;
  const userId = (req as any).userId;

  console.log('[API] 步骤5: 操作说明生成开始...');

  try {
    const session = getOrCreateSession(userId, sessionId);

    const result = await controlInstructionService.generateControlInstructions({
      rules: rules,
    });

    // 自动备份
    if (result.success) {
      saveStepToSession(userId, session.sessionId, 'control_instructions', { 
        controlInstructions: result.controlInstructions 
      });
    }

    res.json({
      ...result,
      sessionId: session.sessionId
    });
  } catch (error) {
    console.error('[API] 操作说明生成错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 步骤6: 地图生成
 */
app.post('/api/map/generate', async (req, res) => {
  const { enhancedDescription, schema, mapWidth, mapHeight, physicsMode, cameraMode, sessionId } = req.body;
  const userId = (req as any).userId;

  console.log('[API] 步骤6: 地图生成开始...', { mapWidth, mapHeight, physicsMode, cameraMode });

  try {
    const session = getOrCreateSession(userId, sessionId);

    const result = await mapGenerationService.generateMap({
      prompt: enhancedDescription,
      schema,
      width: mapWidth,
      height: mapHeight,
      physicsMode,
      cameraMode,
    });

    // 自动备份
    if (result.success) {
      saveStepToSession(userId, session.sessionId, 'map_generate', { 
        mapWidth, 
        mapHeight, 
        physicsMode, 
        cameraMode,
        mapData: result.mapData 
      });
    }

    res.json({
      ...result,
      sessionId: session.sessionId
    });
  } catch (error) {
    console.error('[API] 地图生成错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 步骤7: 代码生成
 */
app.post('/api/code/generate', async (req, res) => {
  const { rules, mapData, controlInstructions, maxRetries, sessionId } = req.body;
  const userId = (req as any).userId;

  console.log('[API] 步骤7: 代码生成开始...');

  try {
    const session = getOrCreateSession(userId, sessionId);

    const result = await gameCodeGenerationService.generateGameCode({
      rules,
      mapData,
      controlInstructions,
      maxRetries,
    });

    // 自动备份
    if (result.success) {
      saveStepToSession(userId, session.sessionId, 'code_generate', { 
        code: result.code,
      });
    }

    res.json({
      ...result,
      sessionId: session.sessionId
    });
  } catch (error) {
    console.error('[API] 代码生成错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 游戏描述生成
 */
app.post('/api/game/describe', async (req, res) => {
  const { code, map, enhancedRules, sessionId } = req.body;
  const userId = (req as any).userId;

  console.log('[API] 游戏描述生成开始...');

  try {
    const session = getOrCreateSession(userId, sessionId);

    // 使用 PromptService 构建提示词
    const prompt = promptService.buildGameDescriptionPrompt(code, map, enhancedRules);

    // 调用 LLM 生成描述
    const description = await llmService.callWithRetry(prompt, {
      model: 'gemini-3-pro-preview',
      temperature: 0.7,
      maxTokens: 10000,
    });

    // 清理可能的markdown标记
    let cleanedDescription = description.trim();
    if (cleanedDescription.startsWith('```')) {
      const firstNewline = cleanedDescription.indexOf('\n');
      if (firstNewline !== -1) {
        cleanedDescription = cleanedDescription.substring(firstNewline + 1);
      }
    }
    if (cleanedDescription.endsWith('```')) {
      cleanedDescription = cleanedDescription.substring(0, cleanedDescription.length - 3);
    }
    cleanedDescription = cleanedDescription.trim();

    // 自动备份
    saveStepToSession(userId, session.sessionId, 'game_describe', {
      description: cleanedDescription,
    });

    res.json({
      success: true,
      description: cleanedDescription,
      sessionId: session.sessionId,
    });
  } catch (error) {
    console.error('[API] 游戏描述生成错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
});

/**
 * 反馈分析
 */
app.post('/api/feedback/analyze', async (req, res) => {
  const { feedback, currentRules, schema, mapData, currentCode, sessionId } = req.body;
  const userId = (req as any).userId;

  console.log('[API] 反馈分析开始...');

  try {
    const session = getOrCreateSession(userId, sessionId);

    const result = await feedbackAnalysisService.analyzeFeedback({
      feedback,
      currentRules,
      schema,
      mapData,
      currentCode,
    });

    // 自动备份
    saveStepToSession(userId, session.sessionId, 'feedback_analyze', { 
      feedback,
      analysisResult: result
    });

    res.json({
      ...result,
      sessionId: session.sessionId
    });
  } catch (error) {
    console.error('[API] 反馈分析错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 段索引检测 - 判断是否需要局部重生成地图
 */
app.post('/api/segment/detect', async (req, res) => {
  const { feedback, cameraMode, totalSegments, sessionId } = req.body;
  const userId = (req as any).userId;

  console.log('[API] 段索引检测开始...');

  try {
    const session = getOrCreateSession(userId, sessionId);

    const result = await segmentDetectionService.detectTargetSegments({
      feedback,
      cameraMode,
      totalSegments,
    });

    // 自动备份
    saveStepToSession(userId, session.sessionId, 'segment_detect', {
      feedback,
      detectionResult: result
    });

    res.json({
      ...result,
      sessionId: session.sessionId
    });
  } catch (error) {
    console.error('[API] 段索引检测错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 局部地图重生成
 */
app.post('/api/map/regenerate-partial', async (req, res) => {
  const {
    prompt,
    schema,
    mapData,
    targetSegments,
    physicsMode,
    segmentWidth,
    segmentHeight,
    totalSegments,
    sessionId
  } = req.body;
  const userId = (req as any).userId;

  console.log('[API] 局部地图重生成开始...');
  console.log(`[API] 目标段: ${targetSegments?.join(', ')}`);

  try {
    const session = getOrCreateSession(userId, sessionId);

    const result = await mapGenerationService.regeneratePartial({
      prompt,
      schema,
      mapData,
      targetSegments,
      physicsMode,
      segmentWidth,
      segmentHeight,
      totalSegments,
    });

    // 自动备份
    saveStepToSession(userId, session.sessionId, 'partial_map_regeneration', {
      targetSegments,
      result
    });

    res.json({
      ...result,
      sessionId: session.sessionId
    });
  } catch (error) {
    console.error('[API] 局部地图重生成错误:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * 健康检查接口
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: activeSessions.size
  });
});

// ============ 错误处理 ============

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server] 错误:', err);
  res.status(500).json({ error: err.message });
});

// ============ 优雅退出 ============

process.on('SIGINT', () => {
  console.log('\n[Server] 正在保存所有活跃会话...');
  
  // 保存所有活跃会话
  for (const [key, session] of activeSessions) {
    backupService.saveSession(session);
    console.log(`[Server] 已保存会话: ${key}`);
  }
  
  console.log('[Server] 所有会话已保存，退出');
  process.exit(0);
});

// ============ 启动服务器 ============

app.listen(PORT, () => {
  console.log(`[Server] 后端服务运行在 http://localhost:${PORT}`);
  console.log(`[Server] 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] 自动备份: 已启用`);
});