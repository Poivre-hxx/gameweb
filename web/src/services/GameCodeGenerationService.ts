/**
 * 游戏代码生成服务 - 前端版本（调用后端API）
 * 从原来的完整LLM调用改为调用后端API
 */

import logger from '../utils/Logger';
import type { GameRules } from '../game/core/types';

export interface CodeGenerationRequest {
  rules: string;
  mapData: any;
  controlInstructions?: string;
  maxRetries?: number;
}

export interface ValidationResult {
  success: boolean;
  errors: string[];
}

export interface CodeGenerationResult {
  success: boolean;
  code?: GameRules;
  error?: string;
  attempts: {
    attempt: number;
    code: GameRules;
    validation: ValidationResult;
  }[];
}

/**
 * 游戏代码生成服务类 - 前端版本（调用后端API）
 * 负责调用后端API生成游戏代码
 */
export class GameCodeGenerationService {
  /**
   * 生成游戏代码
   * @param request 代码生成请求
   * @returns 代码生成结果
   */
  async generateGameCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

    try {
      console.log('[CodeGeneration] 调用后端代码生成API...');
      logger.info('CodeGeneration', '开始生成游戏代码（后端处理）', {
        maxRetries: request.maxRetries,
        rulesLength: request.rules.length,
      });

      const apiResponse = await fetch(`${BACKEND_URL}/api/code/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: request.rules,
          mapData: request.mapData,
          controlInstructions: request.controlInstructions,
          maxRetries: request.maxRetries,
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`后端API调用失败: ${apiResponse.status} ${apiResponse.statusText}`);
      }

      const data = await apiResponse.json();

      if (!data.success) {
        logger.error('CodeGeneration', '后端代码生成失败', { error: data.error });
        return {
          success: false,
          error: data.error || '后端代码生成失败',
          attempts: data.attempts || [],
        };
      }

      console.log('[CodeGeneration] 代码生成完成');
      logger.info('CodeGeneration', '代码生成完成', {
        codeLength: data.code?.length || 0,
        totalAttempts: data.attempts?.length || 0,
      });

      return {
        success: true,
        code: data.code,
        attempts: data.attempts || [],
      };
    } catch (error) {
      console.error('[CodeGeneration] Error:', error);
      logger.error('CodeGeneration', '代码生成异常', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: [],
      };
    }
  }
}

// 导出单例实例
export const gameCodeGenerationService = new GameCodeGenerationService();
