/**
 * 后端导出服务
 * 将生成内容导出到本地文件系统，用于开发调试和质量分析
 */

import type { GameVersion, VersionHistory } from '../types';
import logger from '../utils/Logger';

class BackendExportService {
  private enabled: boolean;
  private exportPath: string;

  constructor() {
    // 禁用导出功能以避免 localStorage 配额超限
    this.enabled = false;
    this.exportPath = import.meta.env.VITE_EXPORT_PATH || './exports';
  }

  /**
   * 检查是否启用导出功能
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 导出完整版本历史
   */
  async exportVersionHistory(history: VersionHistory): Promise<void> {
    if (!this.enabled) return;

    try {
      const timestamp = Date.now();
      const exportDir = `${this.exportPath}/${timestamp}`;

      logger.info('BackendExport', `开始导出版本历史到 ${exportDir}`);

      // 创建导出数据
      const exportData = {
        exportTime: new Date(timestamp).toISOString(),
        totalVersions: history.versions.length,
        currentVersionId: history.currentVersionId,
        versions: history.versions,
      };

      // 保存完整历史
      await this.saveJSON(`${exportDir}/version-history.json`, exportData);

      // 导出每个版本的详细数据
      for (const version of history.versions) {
        await this.exportVersion(version, exportDir);
      }

      // 生成README
      await this.generateREADME(exportDir, history);

      // 导出日志
      await this.exportLogs(exportDir);

      logger.info('BackendExport', '版本历史导出完成', {
        exportDir,
        versionsCount: history.versions.length,
      });
    } catch (error) {
      logger.error('BackendExport', '导出版本历史失败', error);
      console.error('Failed to export version history:', error);
    }
  }

  /**
   * 导出单个版本
   */
  async exportVersion(version: GameVersion, baseDir: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const versionDir = `${baseDir}/versions/${version.id}`;

      logger.debug('BackendExport', `导出版本 ${version.id}`, {
        caption: version.caption,
      });

      // 保存代码文件（将 GameRules 对象序列化为 JSON）
      await this.saveText(`${versionDir}/code.json`, JSON.stringify(version.code, null, 2));

      // 保存地图数据
      await this.saveJSON(`${versionDir}/map.json`, version.mapData);

      // 保存元数据
      const metadata = {
        id: version.id,
        caption: version.caption,
        timestamp: version.timestamp,
        createdAt: new Date(version.timestamp).toISOString(),
        parentVersionId: version.parentVersionId,
        iterationCount: version.iterationCount,
        feedbackText: version.feedbackText,
        metadata: version.metadata,
      };
      await this.saveJSON(`${versionDir}/metadata.json`, metadata);

      // 保存生成日志（如果有）
      if (version.metadata?.mapLayers) {
        const generationLog = {
          layer1_analysis: version.metadata.mapLayers.layer1,
          layer2_blueprint: version.metadata.mapLayers.layer2,
          layer3_map: version.metadata.mapLayers.layer3,
        };
        await this.saveJSON(`${versionDir}/generation-log.json`, generationLog);
      }
    } catch (error) {
      logger.error('BackendExport', `导出版本 ${version.id} 失败`, error);
      console.error(`Failed to export version ${version.id}:`, error);
    }
  }

  /**
   * 导出日志文件
   */
  async exportLogs(baseDir: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const logsDir = `${baseDir}/logs`;

      // 导出地图生成日志
      const mapLogs = logger.getLogsByCategory('MapGeneration');
      if (mapLogs.length > 0) {
        await this.saveText(
          `${logsDir}/map-generation.log`,
          logger.formatLogsAsText(mapLogs)
        );
      }

      // 导出代码生成日志
      const codeLogs = logger.getLogsByCategory('CodeGeneration');
      if (codeLogs.length > 0) {
        await this.saveText(
          `${logsDir}/code-generation.log`,
          logger.formatLogsAsText(codeLogs)
        );
      }

      // 导出验证日志
      const validationLogs = logger.getLogsByCategory('Validation');
      if (validationLogs.length > 0) {
        await this.saveText(
          `${logsDir}/validation.log`,
          logger.formatLogsAsText(validationLogs)
        );
      }

      // 导出所有日志的JSON格式
      const allLogs = logger.getAllLogs();
      if (allLogs.length > 0) {
        await this.saveJSON(`${logsDir}/all-logs.json`, allLogs);
      }

      logger.debug('BackendExport', '日志导出完成', {
        mapLogsCount: mapLogs.length,
        codeLogsCount: codeLogs.length,
        validationLogsCount: validationLogs.length,
      });
    } catch (error) {
      logger.error('BackendExport', '导出日志失败', error);
      console.error('Failed to export logs:', error);
    }
  }

  /**
   * 保存LLM交互记录
   */
  async saveLLMInteraction(
    baseDir: string,
    prompt: string,
    response: string,
    metadata?: any
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const timestamp = Date.now();
      const interactionDir = `${baseDir}/llm-interactions`;

      // 保存提示词
      await this.saveText(`${interactionDir}/${timestamp}-prompt.txt`, prompt);

      // 保存响应
      await this.saveText(`${interactionDir}/${timestamp}-response.txt`, response);

      // 保存元数据
      if (metadata) {
        await this.saveJSON(`${interactionDir}/${timestamp}-metadata.json`, metadata);
      }

      logger.debug('BackendExport', 'LLM交互记录已保存', { timestamp });
    } catch (error) {
      logger.error('BackendExport', '保存LLM交互记录失败', error);
      console.error('Failed to save LLM interaction:', error);
    }
  }

  /**
   * 生成README文件
   */
  private async generateREADME(
    exportDir: string,
    history: VersionHistory
  ): Promise<void> {
    const readme = `# 游戏生成内容导出

## 导出信息

- **导出时间**: ${new Date().toLocaleString('zh-CN')}
- **版本数量**: ${history.versions.length}
- **当前版本**: ${history.currentVersionId || '无'}

## 文件结构

\`\`\`
${exportDir}/
├── README.md                    # 本文件
├── version-history.json         # 完整版本历史
├── versions/                    # 各版本详细数据
│   ├── [version-id]/
│   │   ├── code.ts              # 生成的TypeScript代码
│   │   ├── map.json             # 地图数据
│   │   ├── metadata.json        # 版本元数据
│   │   └── generation-log.json  # 生成过程日志
├── logs/                        # 生成日志
│   ├── map-generation.log       # 地图生成日志
│   ├── code-generation.log      # 代码生成日志
│   ├── validation.log           # 验证日志
│   └── all-logs.json            # 所有日志（JSON格式）
└── llm-interactions/            # LLM交互记录
    ├── [timestamp]-prompt.txt   # 提示词
    ├── [timestamp]-response.txt # 响应内容
    └── [timestamp]-metadata.json # 交互元数据
\`\`\`

## 版本列表

${history.versions
  .map(
    (v, i) => `${i + 1}. **${v.caption}** (ID: ${v.id})
   - Created: ${new Date(v.timestamp).toLocaleString('en-US')}
   - Config Fields: ${Object.keys(v.code).length}
   - Map Rows: ${v.mapData?.terrain?.grid?.length || '?'}
   ${v.parentVersionId ? `- Parent: ${v.parentVersionId}` : ''}
   ${v.iterationCount ? `- Iterations: ${v.iterationCount}` : ''}`
  )
  .join('\n\n')}

## 使用说明

1. **查看代码质量**: 打开 \`versions/[version-id]/code.json\` 查看生成的游戏规则
2. **分析地图结构**: 打开 \`versions/[version-id]/map.json\` 查看地图数据
3. **了解生成过程**: 查看 \`logs/\` 目录下的日志文件
4. **调试问题**: 查看 \`llm-interactions/\` 目录下的LLM交互记录
5. **性能分析**: 查看日志中的耗时和重试信息

## 注意事项

- 本导出用于开发调试和质量分析
- 包含完整的生成过程和中间数据
- 可用于改进提示词和优化生成质量
`;

    await this.saveText(`${exportDir}/README.md`, readme);
  }

  /**
   * 保存JSON文件（模拟）
   */
  private async saveJSON(filePath: string, data: any): Promise<void> {
    // 在浏览器环境中，我们只能模拟文件保存
    // 实际的文件系统操作需要在Node.js环境中进行
    const jsonStr = JSON.stringify(data, null, 2);
    logger.debug('BackendExport', `保存JSON文件: ${filePath}`, {
      size: jsonStr.length,
    });

    // 在开发环境中，可以将数据保存到localStorage或IndexedDB
    // 或者通过API发送到后端服务器
    this.simulateSave(filePath, jsonStr);
  }

  /**
   * 保存文本文件（模拟）
   */
  private async saveText(filePath: string, content: string): Promise<void> {
    logger.debug('BackendExport', `保存文本文件: ${filePath}`, {
      size: content.length,
    });

    this.simulateSave(filePath, content);
  }

  /**
   * 模拟文件保存
   * 导出功能已禁用，仅在开发模式下输出到控制台
   */
  private simulateSave(filePath: string, content: string): void {
    // 导出功能已禁用，避免 localStorage 配额超限
    // 仅在开发环境输出简短日志
    if (import.meta.env.DEV) {
      console.log(`[Export] ${filePath} (${content.length} bytes) - 导出已禁用`);
    }
  }

  /**
   * 获取所有导出的文件列表
   */
  getExportedFiles(): string[] {
    const files: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('export:')) {
        files.push(key.replace('export:', ''));
      }
    }
    return files;
  }

  /**
   * 读取导出的文件内容
   */
  readExportedFile(filePath: string): string | null {
    const key = `export:${filePath}`;
    return localStorage.getItem(key);
  }

  /**
   * 清理旧的导出文件
   */
  cleanupOldExports(): void {
    if (!this.enabled) return;

    const retentionDays = parseInt(
      import.meta.env.VITE_EXPORT_RETENTION_DAYS || '7'
    );
    const autoCleanup = import.meta.env.VITE_EXPORT_AUTO_CLEANUP === 'true';

    if (!autoCleanup) return;

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    logger.info('BackendExport', `清理 ${retentionDays} 天前的导出文件`);

    // 清理localStorage中的旧导出
    const files = this.getExportedFiles();
    let cleanedCount = 0;

    for (const file of files) {
      // 从文件路径中提取时间戳
      const match = file.match(/\/(\d+)\//);
      if (match) {
        const timestamp = parseInt(match[1]);
        if (timestamp < cutoffTime) {
          localStorage.removeItem(`export:${file}`);
          cleanedCount++;
        }
      }
    }

    logger.info('BackendExport', `清理完成，删除了 ${cleanedCount} 个文件`);
  }
}

// 导出单例实例
export default new BackendExportService();
