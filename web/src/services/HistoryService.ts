import type { GameVersion, VersionHistory, MergeConflict, MergePreview, ConflictResolution, MergeStrategyInput } from '../types';
import type { GameRules, CollisionRule, SkillRule, AiRule } from '../game/core/types';
import backendExportService from './BackendExportService';
import logger from '../utils/Logger';
import { getSampleVersionHistory } from '../data/sampleVersions';
import { chat, type ChatMessage } from './LLMChatService';

const VERSION_STORAGE_KEY = 'game-version-history';
const MERGE_PREVIEW_CACHE_PREFIX = 'merge-preview-';

/**
 * 版本树节点接口
 */
export interface VersionTreeNode {
  version: GameVersion;
  children: VersionTreeNode[];
}

/**
 * 历史记录管理服务
 * 使用 localStorage 存储游戏版本历史
 */
class HistoryService {
  // ========== 版本管理方法 ==========

  /**
   * 保存新版本（自动生成caption）
   */
  saveVersion(
    code: GameRules,
    mapData: any,
    schema?: any,
    caption?: string,
    gameDescription?: string
  ): GameVersion {
    const history = this.getVersionHistory();

    // 生成默认caption
    const defaultCaption = caption || this.generateCaption(code, mapData);

    const newVersion: GameVersion = {
      id: Date.now().toString(),
      caption: defaultCaption,
      timestamp: Date.now(),
      code,
      mapData,
      schema: schema || { meta: { map_size: { width: 18, height: 18 } }, mapping: {} },
      metadata: gameDescription ? { gameDescription } : undefined,
    };

    // 添加到版本列表
    history.versions.push(newVersion);
    history.currentVersionId = newVersion.id;

    this.saveVersionHistory(history);

    // 触发导出钩子
    this.exportVersionIfEnabled(newVersion, history);

    logger.info('HistoryService', '版本已保存', {
      versionId: newVersion.id,
      caption: defaultCaption,
      totalVersions: history.versions.length,
    });

    return newVersion;
  }

  /**
   * 保存迭代版本（带父版本链接）
   */
  saveIterationVersion(
    code: GameRules,
    mapData: any,
    parentVersionId: string,
    feedbackText: string,
    updatedRules: string,
    schema: any,
    updateDecision: any
  ): GameVersion {
    const history = this.getVersionHistory();

    // 获取父版本以计算迭代次数
    const parentVersion = this.getVersion(parentVersionId);
    const iterationCount = (parentVersion?.iterationCount || 0) + 1;

    // 使用完整的 feedbackText 作为 caption
    const caption = feedbackText;

    const newVersion: GameVersion = {
      id: Date.now().toString(),
      caption,
      timestamp: Date.now(),
      code,
      mapData,
      schema,  // schema 现在是顶层字段
      parentVersionId,
      iterationCount,
      feedbackText,
      metadata: {
        detailedRules: updatedRules,
        updateDecision,
      },
    };

    // 添加到版本列表
    history.versions.push(newVersion);
    history.currentVersionId = newVersion.id;

    this.saveVersionHistory(history);

    // 触发导出钩子
    this.exportVersionIfEnabled(newVersion, history);

    logger.info('HistoryService', '迭代版本已保存', {
      versionId: newVersion.id,
      parentVersionId,
      iterationCount,
      totalVersions: history.versions.length,
    });

    return newVersion;
  }

  /**
   * 获取所有版本（按时间倒序）
   */
  getVersions(): GameVersion[] {
    const history = this.getVersionHistory();
    return [...history.versions].reverse(); // 最新的在前
  }

  /**
   * 获取特定版本
   */
  getVersion(versionId: string): GameVersion | null {
    const history = this.getVersionHistory();
    return history.versions.find((v) => v.id === versionId) || null;
  }

  /**
   * 切换到指定版本（不删除任何版本，支持分支）
   */
  switchToVersion(versionId: string): GameVersion | null {
    const history = this.getVersionHistory();

    const targetVersion = this.getVersion(versionId);
    if (!targetVersion) {
      return null;
    }

    // 只更新当前版本ID，不删除任何版本
    history.currentVersionId = versionId;
    this.saveVersionHistory(history);

    return targetVersion;
  }

  /**
   * 回退到指定版本（删除后续版本）- 保留兼容性，但建议使用 switchToVersion
   * @deprecated 使用 switchToVersion 代替
   */
  revertToVersion(versionId: string): GameVersion | null {
    return this.switchToVersion(versionId);
  }

  /**
   * 获取当前版本
   */
  getCurrentVersion(): GameVersion | null {
    const history = this.getVersionHistory();
    if (!history.currentVersionId) {
      return null;
    }
    return this.getVersion(history.currentVersionId);
  }

  /**
   * 删除指定版本
   */
  deleteVersion(versionId: string): boolean {
    const history = this.getVersionHistory();
    const index = history.versions.findIndex((v) => v.id === versionId);

    if (index === -1) {
      return false;
    }

    history.versions.splice(index, 1);

    // 如果删除的是当前版本，更新currentVersionId
    if (history.currentVersionId === versionId) {
      history.currentVersionId =
        history.versions.length > 0
          ? history.versions[history.versions.length - 1].id
          : null;
    }

    this.saveVersionHistory(history);
    return true;
  }

  /**
   * 清空所有版本
   */
  clearVersions(): void {
    const emptyHistory: VersionHistory = {
      versions: [],
      currentVersionId: null,
    };
    this.saveVersionHistory(emptyHistory);
  }

  /**
   * 获取迭代链（从根到当前版本）
   */
  getIterationChain(versionId: string): GameVersion[] {
    const chain: GameVersion[] = [];
    let currentId: string | undefined = versionId;

    while (currentId) {
      const version = this.getVersion(currentId);
      if (!version) break;

      chain.unshift(version); // 添加到开头
      currentId = version.parentVersionId;
    }

    return chain;
  }

  /**
   * 获取根版本（链中的第一个）
   */
  getRootVersion(versionId: string): GameVersion | null {
    const chain = this.getIterationChain(versionId);
    return chain.length > 0 ? chain[0] : null;
  }

  /**
   * 获取某版本的所有直接子版本
   */
  getChildren(versionId: string): GameVersion[] {
    const history = this.getVersionHistory();
    return history.versions.filter((v) => v.parentVersionId === versionId);
  }

  /**
   * 获取所有根版本（没有父版本的版本）
   */
  getRootVersions(): GameVersion[] {
    const history = this.getVersionHistory();
    return history.versions.filter((v) => !v.parentVersionId);
  }

  /**
   * 版本树节点接口
   */
  getVersionTree(): VersionTreeNode[] {
    const rootVersions = this.getRootVersions();
    return rootVersions.map((v) => this.buildTreeNode(v));
  }

  /**
   * 递归构建版本树节点
   */
  private buildTreeNode(version: GameVersion): VersionTreeNode {
    const children = this.getChildren(version.id);
    return {
      version,
      children: children.map((child) => this.buildTreeNode(child)),
    };
  }

  /**
   * 合并分支版本到主链
   * 在主链最新版本上方创建合并版本
   */
  async mergeVersion(branchVersionId: string): Promise<GameVersion | null> {
    const history = this.getVersionHistory();
    const branchVersion = this.getVersion(branchVersionId);

    if (!branchVersion) return null;

    // 找到主链最新版本
    const mainChainVersions = history.versions.filter(v => !this.isBranchVersion(v.id, history));
    const latestMainVersion = mainChainVersions.length > 0
      ? mainChainVersions.reduce((a, b) => a.timestamp > b.timestamp ? a : b)
      : null;

    // 合并两个版本的 code（GameRules）
    const mergedCode = latestMainVersion
      ? this.mergeGameRules(latestMainVersion.code, branchVersion.code)
      : branchVersion.code;

    // 用 LLM 生成合并 caption
    let mergedCaption: string;
    try {
      mergedCaption = await this.generateMergeCaption(
        latestMainVersion?.caption || 'Initial version',
        branchVersion.caption || 'No description'
      );
    } catch (error) {
      // Fallback: LLM 失败时使用简单拼接
      logger.warn('HistoryService', 'LLM caption generation failed, using fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      mergedCaption = `Merge branch: ${branchVersion.caption || 'No description'}`;
    }

    // 创建合并版本
    const newVersion: GameVersion = {
      id: Date.now().toString(),
      caption: mergedCaption,
      timestamp: Date.now(),
      code: mergedCode,
      mapData: branchVersion.mapData,
      schema: branchVersion.schema,
      parentVersionId: latestMainVersion?.id,
      metadata: { mergedFrom: branchVersionId },
    };

    history.versions.push(newVersion);
    history.currentVersionId = newVersion.id;
    this.saveVersionHistory(history);

    logger.info('HistoryService', '分支已合并', {
      versionId: newVersion.id,
      branchVersionId,
      parentVersionId: latestMainVersion?.id,
      caption: mergedCaption,
    });

    return newVersion;
  }

  /**
   * 判断版本是否是分支版本
   * 分支版本：有父版本且不是父版本的第一个子版本
   */
  isBranchVersion(versionId: string, history?: VersionHistory): boolean {
    const h = history || this.getVersionHistory();
    const version = h.versions.find(v => v.id === versionId);
    if (!version?.parentVersionId) return false;

    const siblings = h.versions.filter(v => v.parentVersionId === version.parentVersionId);
    const sortedSiblings = siblings.sort((a, b) => a.timestamp - b.timestamp);
    return sortedSiblings[0]?.id !== versionId;
  }

  // ========== 合并预览和分析方法 ==========

  /**
   * 获取主链最新版本 ID
   */
  getMainChainLatestId(): string | null {
    const history = this.getVersionHistory();
    const mainChainVersions = history.versions.filter(v => !this.isBranchVersion(v.id, history));
    if (mainChainVersions.length === 0) return null;
    return mainChainVersions.reduce((a, b) => a.timestamp > b.timestamp ? a : b).id;
  }

  /**
   * 分析两个版本的合并差异（带缓存）
   */
  async analyzeMergeDifferences(mainVersionId: string, branchVersionId: string): Promise<MergePreview> {
    const cacheKey = `${MERGE_PREVIEW_CACHE_PREFIX}${mainVersionId}-${branchVersionId}`;

    // Try to get from cache
    const cached = this.getMergePreviewFromCache(cacheKey);
    if (cached) {
      logger.info('HistoryService', 'Using cached merge preview', { mainVersionId, branchVersionId });
      return cached;
    }

    const mainVersion = this.getVersion(mainVersionId);
    const branchVersion = this.getVersion(branchVersionId);

    if (!mainVersion || !branchVersion) {
      return {
        branchVersionId,
        mainVersionId,
        llmDifferenceSummary: '',
        conflicts: [],
        autoMerged: [],
        isLoading: false,
        error: 'Version not found',
      };
    }

    // Detect conflicts
    const { conflicts, autoMerged } = this.detectMergeConflicts(mainVersion.code, branchVersion.code);

    // Generate LLM summary
    let llmDifferenceSummary = '';
    try {
      llmDifferenceSummary = await this.generateDifferenceSummary(mainVersion, branchVersion);
    } catch (error) {
      logger.warn('HistoryService', 'LLM difference summary failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      llmDifferenceSummary = this.generateFallbackSummary(mainVersion, branchVersion);
    }

    const preview: MergePreview = {
      branchVersionId,
      mainVersionId,
      llmDifferenceSummary,
      conflicts,
      autoMerged,
      isLoading: false,
    };

    // Save to cache
    this.saveMergePreviewToCache(cacheKey, preview);

    return preview;
  }

  /**
   * 检测合并冲突
   * 返回 MEDIUM/HIGH 严重性冲突和自动合并的 LOW 严重性项目
   */
  detectMergeConflicts(mainRules: GameRules, branchRules: GameRules): {
    conflicts: MergeConflict[];
    autoMerged: string[];
  } {
    const conflicts: MergeConflict[] = [];
    const autoMerged: string[] = [];
    let conflictId = 0;

    // 1. gameConfig conflicts (HIGH)
    if (mainRules.gameConfig.physicsMode !== branchRules.gameConfig.physicsMode) {
      conflicts.push({
        id: `conflict-${++conflictId}`,
        type: 'gameConfig',
        severity: 'high',
        entityKey: 'physicsMode',
        mainValue: mainRules.gameConfig.physicsMode,
        branchValue: branchRules.gameConfig.physicsMode,
        description: `Physics mode: main="${mainRules.gameConfig.physicsMode}" vs branch="${branchRules.gameConfig.physicsMode}"`,
      });
    }
    if (mainRules.gameConfig.cameraMode !== branchRules.gameConfig.cameraMode) {
      conflicts.push({
        id: `conflict-${++conflictId}`,
        type: 'gameConfig',
        severity: 'high',
        entityKey: 'cameraMode',
        mainValue: mainRules.gameConfig.cameraMode,
        branchValue: branchRules.gameConfig.cameraMode,
        description: `Camera mode: main="${mainRules.gameConfig.cameraMode}" vs branch="${branchRules.gameConfig.cameraMode}"`,
      });
    }

    // 2. entityConfig conflicts (MEDIUM)
    const allEntityKeys = new Set([
      ...Object.keys(mainRules.entityConfig || {}),
      ...Object.keys(branchRules.entityConfig || {}),
    ]);
    for (const key of allEntityKeys) {
      const mainEntity = mainRules.entityConfig?.[key];
      const branchEntity = branchRules.entityConfig?.[key];
      if (mainEntity && branchEntity && JSON.stringify(mainEntity) !== JSON.stringify(branchEntity)) {
        conflicts.push({
          id: `conflict-${++conflictId}`,
          type: 'entityConfig',
          severity: 'medium',
          entityKey: key,
          mainValue: mainEntity,
          branchValue: branchEntity,
          description: `Entity "${key}" has different configurations`,
        });
      }
    }

    // 3. inputMapping conflicts (MEDIUM)
    const allInputKeys = new Set([
      ...Object.keys(mainRules.inputMapping || {}),
      ...Object.keys(branchRules.inputMapping || {}),
    ]);
    for (const key of allInputKeys) {
      const mainVal = mainRules.inputMapping?.[key];
      const branchVal = branchRules.inputMapping?.[key];
      if (mainVal && branchVal && mainVal !== branchVal) {
        conflicts.push({
          id: `conflict-${++conflictId}`,
          type: 'inputMapping',
          severity: 'medium',
          entityKey: key,
          mainValue: mainVal,
          branchValue: branchVal,
          description: `Input "${key}": main="${mainVal}" vs branch="${branchVal}"`,
        });
      }
    }

    // 4. aiRules conflicts (MEDIUM)
    if (mainRules.aiRules && branchRules.aiRules) {
      const mainAiMap = new Map(mainRules.aiRules.map(r => [r.entity, r]));
      const branchAiMap = new Map(branchRules.aiRules.map(r => [r.entity, r]));
      for (const [entity, branchRule] of branchAiMap) {
        const mainRule = mainAiMap.get(entity);
        if (mainRule && JSON.stringify(mainRule) !== JSON.stringify(branchRule)) {
          conflicts.push({
            id: `conflict-${++conflictId}`,
            type: 'aiRules',
            severity: 'medium',
            entityKey: entity,
            mainValue: mainRule,
            branchValue: branchRule,
            description: `AI rules for "${entity}" differ`,
          });
        }
      }
    }

    // 5. LOW severity items are auto-merged
    if (mainRules.collisionRules?.length || branchRules.collisionRules?.length) {
      autoMerged.push('collisionRules');
    }
    if (mainRules.skillRules?.length || branchRules.skillRules?.length) {
      autoMerged.push('skillRules');
    }

    return { conflicts, autoMerged };
  }

  /**
   * 根据用户策略合并版本
   */
  async mergeVersionWithStrategy(
    branchVersionId: string,
    strategy: MergeStrategyInput
  ): Promise<GameVersion | null> {
    const history = this.getVersionHistory();
    const branchVersion = this.getVersion(branchVersionId);

    if (!branchVersion) return null;

    // Find main chain latest version
    const mainChainVersions = history.versions.filter(v => !this.isBranchVersion(v.id, history));
    const latestMainVersion = mainChainVersions.length > 0
      ? mainChainVersions.reduce((a, b) => a.timestamp > b.timestamp ? a : b)
      : null;

    // Apply conflict resolutions
    const mergedCode = latestMainVersion
      ? this.applyConflictResolutions(
          latestMainVersion.code,
          branchVersion.code,
          strategy.conflictResolutions
        )
      : branchVersion.code;

    // Generate caption with user strategy
    let mergedCaption: string;
    try {
      mergedCaption = await this.generateStrategicMergeCaption(
        latestMainVersion?.caption || 'Initial version',
        branchVersion.caption || 'No description',
        strategy.userStrategyDescription
      );
    } catch (error) {
      mergedCaption = `Merge: ${strategy.userStrategyDescription.substring(0, 50)}`;
    }

    // Create merged version
    const newVersion: GameVersion = {
      id: Date.now().toString(),
      caption: mergedCaption,
      timestamp: Date.now(),
      code: mergedCode,
      mapData: branchVersion.mapData,
      schema: branchVersion.schema,
      parentVersionId: latestMainVersion?.id,
      metadata: {
        mergedFrom: branchVersionId,
        mergeStrategy: strategy.userStrategyDescription,
      },
    };

    history.versions.push(newVersion);
    history.currentVersionId = newVersion.id;
    this.saveVersionHistory(history);

    // Invalidate cache for this branch
    this.invalidateMergePreviewCache(branchVersionId);

    logger.info('HistoryService', '分支已合并 (with strategy)', {
      versionId: newVersion.id,
      branchVersionId,
      parentVersionId: latestMainVersion?.id,
      caption: mergedCaption,
    });

    return newVersion;
  }

  // ========== 合并预览私有方法 ==========

  private getMergePreviewFromCache(cacheKey: string): MergePreview | null {
    try {
      const data = localStorage.getItem(cacheKey);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private saveMergePreviewToCache(cacheKey: string, preview: MergePreview): void {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(preview));
    } catch (error) {
      console.warn('Failed to cache merge preview:', error);
    }
  }

  private invalidateMergePreviewCache(branchVersionId: string): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.includes(branchVersionId)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to invalidate merge preview cache:', error);
    }
  }

  private async generateDifferenceSummary(
    mainVersion: GameVersion,
    branchVersion: GameVersion
  ): Promise<string> {
    const prompt = `You are analyzing differences between two game versions for a merge.

## Main Version
- Caption: ${mainVersion.caption}
- GameRules: ${JSON.stringify(mainVersion.code, null, 2)}

## Branch Version
- Caption: ${branchVersion.caption}
- GameRules: ${JSON.stringify(branchVersion.code, null, 2)}

Provide 3-5 bullet points summarizing key differences.
Focus on: game config, entities, rules, input mappings.
Format: Each bullet starts with "- "
Output in English only.`;

    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    const response = await chat(messages);
    return response.trim();
  }

  private generateFallbackSummary(mainVersion: GameVersion, branchVersion: GameVersion): string {
    return `- Main version: ${mainVersion.caption}
- Branch version: ${branchVersion.caption}
- Review the differences before merging.`;
  }

  private async generateStrategicMergeCaption(
    mainCaption: string,
    branchCaption: string,
    userStrategy: string
  ): Promise<string> {
    const prompt = `You are generating a description for a game version merge operation.

Two versions are being merged:
1. **Main version**: ${mainCaption}
2. **Branch version**: ${branchCaption}

User's merge strategy: ${userStrategy}

Generate a concise single-sentence caption (max 60 characters) summarizing this merge.
Requirements:
- Start with "Merge branch:"
- Reflect the user's strategy
- Output only the caption text, nothing else
- Output in English only`;

    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    const response = await chat(messages);
    return response.trim();
  }

  private applyConflictResolutions(
    mainRules: GameRules,
    branchRules: GameRules,
    resolutions: ConflictResolution[]
  ): GameRules {
    // Start with base merge
    let merged = this.mergeGameRules(mainRules, branchRules);

    // Apply each resolution
    for (const resolution of resolutions) {
      merged = this.applySingleResolution(merged, mainRules, branchRules, resolution);
    }

    return merged;
  }

  private applySingleResolution(
    merged: GameRules,
    mainRules: GameRules,
    branchRules: GameRules,
    resolution: ConflictResolution
  ): GameRules {
    // For simplicity, we use the strategy directly
    // In a more complex implementation, we'd look up the conflict by ID
    const { strategy } = resolution;

    // If useMain, restore main values for gameConfig
    if (strategy === 'useMain') {
      return {
        ...merged,
        gameConfig: mainRules.gameConfig,
      };
    }

    // If useBranch, use branch values
    if (strategy === 'useBranch') {
      return {
        ...merged,
        gameConfig: branchRules.gameConfig,
      };
    }

    // 'merge' strategy keeps the default merged result
    return merged;
  }

  // ========== 私有辅助方法 ==========

  private getVersionHistory(): VersionHistory {
    try {
      const data = localStorage.getItem(VERSION_STORAGE_KEY);
      if (!data) {
        // 无数据：初始化示例
        return this.initializeSampleData();
      }
      const history = JSON.parse(data);
      // 有数据但为空：也初始化示例
      if (!history.versions || history.versions.length === 0) {
        return this.initializeSampleData();
      }
      return history;
    } catch (error) {
      console.error('Failed to load version history:', error);
      return this.initializeSampleData();
    }
  }

  private initializeSampleData(): VersionHistory {
    const sampleHistory = getSampleVersionHistory();
    this.saveVersionHistory(sampleHistory);
    logger.info('HistoryService', '已初始化示例版本数据', {
      totalVersions: sampleHistory.versions.length,
    });
    return sampleHistory;
  }

  private saveVersionHistory(history: VersionHistory): void {
    try {
      localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save version history:', error);
    }
  }

  private generateCaption(_code: GameRules, mapData: any): string {
    // 自动生成版本描述
    const timestamp = new Date().toLocaleString('zh-CN');
    const mapSize = mapData?.meta?.map_size;
    const sizeStr = mapSize
      ? `${mapSize.width}×${mapSize.height}`
      : '未知';

    return `版本 ${timestamp} - 地图尺寸: ${sizeStr}`;
  }

  /**
   * 导出版本（如果启用）
   * @param version 新版本
   * @param history 完整历史
   */
  private exportVersionIfEnabled(version: GameVersion, history: VersionHistory): void {
    if (backendExportService.isEnabled()) {
      // 异步导出，不阻塞主流程
      backendExportService.exportVersionHistory(history).catch((error) => {
        console.error('[HistoryService] Failed to export version:', error);
        logger.error('HistoryService', '导出版本失败', {
          versionId: version.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

      // 清理旧导出
      backendExportService.cleanupOldExports();
    }
  }

  // ========== 合并相关辅助方法 ==========

  /**
   * 调用 LLM 生成合并 caption
   */
  private async generateMergeCaption(
    mainCaption: string,
    branchCaption: string
  ): Promise<string> {
    const prompt = this.buildMergeCaptionPrompt(mainCaption, branchCaption);

    const messages: ChatMessage[] = [
      { role: 'user', content: prompt }
    ];

    const response = await chat(messages);
    return response.trim();
  }

  /**
   * 构建合并 caption 的 prompt
   */
  private buildMergeCaptionPrompt(mainCaption: string, branchCaption: string): string {
    return `You are generating a description for a game version merge operation.

Two versions are being merged:
1. **Main version**: ${mainCaption}
2. **Branch version**: ${branchCaption}

Please generate a concise single-sentence caption (max 50 characters) summarizing this merge.
Requirements:
- Start with "Merge branch:"
- Focus on key features combined from both versions
- Output only the caption text, nothing else

Example outputs:
- "Merge branch: Combine platform mechanics with enemy AI"
- "Merge branch: Add shooting feature to main level"`;
  }

  /**
   * 合并两个 GameRules 对象
   */
  private mergeGameRules(mainRules: GameRules, branchRules: GameRules): GameRules {
    return {
      gameConfig: mainRules.gameConfig,
      entityConfig: {
        ...mainRules.entityConfig,
        ...branchRules.entityConfig,
      },
      collisionRules: this.mergeCollisionRules(
        mainRules.collisionRules,
        branchRules.collisionRules
      ),
      inputMapping: {
        ...mainRules.inputMapping,
        ...branchRules.inputMapping,
      },
      skillRules: this.mergeSkillRules(mainRules.skillRules, branchRules.skillRules),
      aiRules: this.mergeAiRules(mainRules.aiRules, branchRules.aiRules),
    };
  }

  /**
   * 合并碰撞规则数组（基于 JSON 去重）
   */
  private mergeCollisionRules(
    main: CollisionRule[],
    branch: CollisionRule[]
  ): CollisionRule[] {
    const seen = new Set<string>();
    const result: CollisionRule[] = [];

    for (const rule of [...main, ...branch]) {
      const key = JSON.stringify(rule);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(rule);
      }
    }

    return result;
  }

  /**
   * 合并技能规则（基于 entity 去重，branch 优先）
   */
  private mergeSkillRules(
    main?: SkillRule[],
    branch?: SkillRule[]
  ): SkillRule[] | undefined {
    if (!main && !branch) return undefined;

    const entityMap = new Map<string, SkillRule>();

    for (const rule of main || []) {
      entityMap.set(rule.entity, rule);
    }

    for (const rule of branch || []) {
      entityMap.set(rule.entity, rule);
    }

    return Array.from(entityMap.values());
  }

  /**
   * 合并 AI 规则（基于 entity 去重，branch 优先）
   */
  private mergeAiRules(
    main?: AiRule[],
    branch?: AiRule[]
  ): AiRule[] | undefined {
    if (!main && !branch) return undefined;

    const entityMap = new Map<string, AiRule>();

    for (const rule of main || []) {
      entityMap.set(rule.entity, rule);
    }

    for (const rule of branch || []) {
      entityMap.set(rule.entity, rule);
    }

    return Array.from(entityMap.values());
  }
}

// 导出单例实例
export default new HistoryService();
