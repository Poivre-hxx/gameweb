/**
 * 代码生成相关类型定义
 */

import type { GameRules } from '../game/core/types';

/**
 * 代码生成请求
 */
export interface CodeGenerationRequest {
  /** 游戏规则描述 */
  rules: string;
  /** 地图数据 */
  mapData: any;
  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * 代码生成结果
 */
export interface CodeGenerationResult {
  /** 是否成功 */
  success: boolean;
  /** 生成的代码 */
  code?: GameRules;
  /** 错误信息 */
  error?: string;
  /** 所有尝试记录 */
  attempts: CodeGenerationAttempt[];
}

/**
 * 代码生成尝试记录
 */
export interface CodeGenerationAttempt {
  /** 尝试次数 */
  attempt: number;
  /** 生成的代码 */
  code: GameRules;
  /** 验证结果 */
  validation: ValidationResult;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否成功 */
  success: boolean;
  /** 错误列表 */
  errors: string[];
  /** 静态检查结果 */
  staticCheck?: {
    success: boolean;
    errors: string[];
  };
  /** 运行时检查结果 */
  runtimeCheck?: {
    success: boolean;
    errors: string[];
  };
  /** 工厂方法检查结果 */
  factoryCheck?: {
    success: boolean;
    missing: string[];
  };
}

/**
 * LLM配置
 */
export interface LLMConfig {
  /** 模型名称 */
  model: string;
  /** 温度参数 */
  temperature: number;
  /** 最大token数 */
  maxTokens: number;
}
