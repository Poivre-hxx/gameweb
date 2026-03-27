/**
 * 备份服务 - 管理用户会话数据的备份和恢复
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 会话步骤数据接口
 */
interface SessionStep {
  step: string;              // 步骤名称：'rag_search', 'description_enhance', 'schema_generate', 'rules_generate'
  timestamp: string;         // ISO 8601格式时间戳
  data: any;                 // 该步骤的输出数据
}

/**
 * 完整会话数据接口
 */
interface SessionData {
  sessionId: string;         // 会话唯一标识
  userId: string;            // 用户标识
  startTime: string;         // 会话开始时间
  endTime?: string;          // 会话结束时间（可选）
  steps: SessionStep[];      // 所有步骤数据（按时间顺序）
  metadata: {
    userPrompt?: string;     // 用户的原始输入
    mapWidth?: number;       // 地图宽度
    mapHeight?: number;      // 地图高度
    [key: string]: any;      // 其他元数据
  };
}

/**
 * 会话查询选项
 */
interface SessionQueryOptions {
  limit?: number;            // 限制返回数量
  startDate?: string;        // 开始日期
  endDate?: string;          // 结束日期
}

/**
 * 备份服务类
 */
class BackupService {
  private backupsDir: string;
  private sessionsDir: string;

  constructor() {
    // 设置备份目录路径
    this.backupsDir = path.join(__dirname, '../../data/backups');
    this.sessionsDir = path.join(this.backupsDir, 'sessions');

    // 确保目录存在
    this.ensureDirectories();
  }

  /**
   * 确保备份目录存在
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * 生成唯一的sessionId
   * 格式: YYYYMMDDHHMMSS_random6
   * 例如: 20250129143052_abc123
   */
  generateSessionId(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 15); // YYYYMMDDHHMMSS
    const random = Math.random().toString(36).substring(2, 8); // 6位随机字符
    return `${timestamp}_${random}`;
  }

  /**
   * 生成用户ID（基于IP地址）
   * 如果没有IP或本地地址，使用匿名用户标识
   */
  generateUserId(ipAddress?: string): string {
    if (!ipAddress || ipAddress === '' || ipAddress === '::1' || ipAddress === '127.0.0.1') {
      return 'user_anonymous';
    }
    // 对IP地址进行简单hash以生成用户ID
    const hash = ipAddress.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    return `user_${Math.abs(hash).toString(16).padStart(6, '0')}`;
  }

  /**
   * 创建新会话
   */
  createSession(
    userId: string,
    metadata?: {
      userPrompt?: string;
      mapWidth?: number;
      mapHeight?: number;
      [key: string]: any;
    }
  ): SessionData {
    const sessionId = this.generateSessionId();
    const startTime = new Date().toISOString();

    return {
      sessionId,
      userId,
      startTime,
      steps: [],
      metadata: metadata || {}
    };
  }

  /**
   * 添加步骤到会话
   */
  addStep(session: SessionData, stepName: string, data: any): SessionData {
    const step: SessionStep = {
      step: stepName,
      timestamp: new Date().toISOString(),
      data
    };

    // 按时间顺序插入步骤
    session.steps.push(step);

    return session;
  }

  /**
   * 保存会话到文件
   */
  saveSession(session: SessionData): void {
    try {
      // 设置会话结束时间
      if (!session.endTime) {
        session.endTime = new Date().toISOString();
      }

      // 创建用户目录
      const userDir = path.join(this.sessionsDir, session.userId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      // 生成文件名: YYYYMMDDHHMMSS_session_[shortId].json
      const datePrefix = new Date(session.startTime)
        .toISOString()
        .replace(/[-:T.]/g, '')
        .slice(0, 15);
      const shortId = session.sessionId.split('_').pop() || 'unknown';
      const fileName = `${datePrefix}_session_${shortId}.json`;
      const filePath = path.join(userDir, fileName);

      // 写入文件（使用格式化的JSON以便阅读）
      fs.writeFileSync(
        filePath,
        JSON.stringify(session, null, 2),
        'utf-8'
      );

      console.log(`[BackupService] 会话已保存: ${filePath}`);
    } catch (error) {
      console.error('[BackupService] 保存会话失败:', error);
      // 不抛出错误，避免影响主业务逻辑
    }
  }

  /**
   * 读取用户的所有会话
   */
  getUserSessions(userId: string, options?: SessionQueryOptions): SessionData[] {
    const userDir = path.join(this.sessionsDir, userId);

    if (!fs.existsSync(userDir)) {
      return [];
    }

    const files = fs.readdirSync(userDir)
      .filter(file => file.endsWith('.json'))
      .sort() // 按文件名排序（即按时间排序）
      .reverse(); // 最新的在前

    let sessions: SessionData[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(userDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const session = JSON.parse(content) as SessionData;

        // 应用筛选条件
        if (options?.startDate && session.startTime < options.startDate) continue;
        if (options?.endDate && session.startTime > options.endDate) continue;

        sessions.push(session);

        // 应用数量限制
        if (options?.limit && sessions.length >= options.limit) break;
      } catch (error) {
        console.error(`[BackupService] 读取会话文件失败: ${file}`, error);
      }
    }

    return sessions;
  }

  /**
   * 读取特定会话
   */
  getSession(userId: string, sessionId: string): SessionData | null {
    const userDir = path.join(this.sessionsDir, userId);

    if (!fs.existsSync(userDir)) {
      return null;
    }

    const shortId = sessionId.split('_').pop();
    const files = fs.readdirSync(userDir)
      .filter(file => file.endsWith(`session_${shortId}.json`));

    if (files.length === 0) {
      return null;
    }

    try {
      const filePath = path.join(userDir, files[0]);
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as SessionData;
    } catch (error) {
      console.error(`[BackupService] 读取会话失败: ${sessionId}`, error);
      return null;
    }
  }

  /**
   * 删除会话
   */
  deleteSession(userId: string, sessionId: string): boolean {
    const userDir = path.join(this.sessionsDir, userId);

    if (!fs.existsSync(userDir)) {
      return false;
    }

    const shortId = sessionId.split('_').pop();
    const files = fs.readdirSync(userDir)
      .filter(file => file.endsWith(`session_${shortId}.json`));

    if (files.length === 0) {
      return false;
    }

    try {
      const filePath = path.join(userDir, files[0]);
      fs.unlinkSync(filePath);
      console.log(`[BackupService] 会话已删除: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`[BackupService] 删除会话失败: ${sessionId}`, error);
      return false;
    }
  }
}

// 导出类型
export type { SessionData, SessionStep, SessionQueryOptions };

// 导出单例实例 - 延迟初始化
let backupServiceInstance: BackupService | null = null;

export function getBackupService(): BackupService {
  if (!backupServiceInstance) {
    backupServiceInstance = new BackupService();
  }
  return backupServiceInstance;
}

// 为了保持向后兼容，导出一个 getter
export const backupService = new Proxy({} as BackupService, {
  get(_target, prop) {
    const service = getBackupService();
    return service[prop as keyof BackupService];
  }
});
