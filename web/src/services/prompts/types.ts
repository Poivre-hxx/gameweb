/**
 * Prompt系统类型定义
 * 为所有提示词构建方法提供强类型支持
 */

// 导入全局类型定义
import type { GameSearchResult } from '../../types';

// 重新导出以便内部使用
export type { GameSearchResult };

/**
 * 地图信息通用类型
 */
export interface MapInfo {
  width: number;
  height: number;
}

/**
 * Layer1 提示词输入
 */
export interface MapLayer1Input {
  prompt: string;
  schema: any;
  width: number;
  height: number;
}

/**
 * Layer2 提示词输入
 */
export interface MapLayer2Input {
  prompt: string;
  layer1Output: string;
}

/**
 * Layer3 提示词输入
 */
export interface MapLayer3Input {
  prompt: string;
  layer2Output: string;
  schema: any;
  width: number;
  height: number;
}

/**
 * Layer4 提示词输入
 */
export interface MapLayer4Input {
  mapData: any;
}

/**
 * 代码生成提示词输入
 */
export interface CodeGenerationInput {
  rules: string;
  mapData: any;
  controlInstructions?: string;
  maxRetries?: number;
}

/**
 * 代码修复提示词输入
 */
export interface CodeFixInput {
  code: string;
  errors: string[];
  rules: string;
  mapData: any;
}

/**
 * Schema生成提示词输入
 */
export interface SchemaGenerationInput {
  enhancedDescription: string;
  ragResults: GameSearchResult[];
  mapInfo: MapInfo;
}

/**
 * 详细规则生成提示词输入
 */
export interface DetailedRulesInput {
  enhancedDescription: string;
  ragResults: GameSearchResult[];
  schema: any;
  mapInfo: MapInfo;
}

/**
 * 描述增强提示词输入
 */
export interface DescriptionEnhanceInput {
  userPrompt: string;
  ragResults: GameSearchResult[];
}

/**
 * RAG上下文构建输入
 */
export interface RAGContextInput {
  ragResults: GameSearchResult[];
}

/**
 * 提供编译时类型安全，防止提示词混用
 */
export type MapLayer1Prompt = string & { __brand: 'MapLayer1Prompt' };
export type MapLayer2Prompt = string & { __brand: 'MapLayer2Prompt' };
export type MapLayer3Prompt = string & { __brand: 'MapLayer3Prompt' };
export type MapLayer4Prompt = string & { __brand: 'MapLayer4Prompt' };
export type CodeGenerationPrompt = string & { __brand: 'CodeGenerationPrompt' };
export type CodeFixPrompt = string & { __brand: 'CodeFixPrompt' };
export type SchemaGenerationPrompt = string & { __brand: 'SchemaGenerationPrompt' };
export type DetailedRulesPrompt = string & { __brand: 'DetailedRulesPrompt' };
export type DescriptionEnhancePrompt = string & { __brand: 'DescriptionEnhancePrompt' };

/**
 * 通用提示词片段类型
 */
export type PromptFragment = string;

/**
 * 反馈分析提示词输入
 */
export interface FeedbackAnalysisInput {
  feedback: string;
  currentRules: string;
  schema: any;
  mapData: any;
  currentCode: string;
}

/**
 * 反馈分析提示词类型
 */
export type FeedbackAnalysisPrompt = string & { __brand: 'FeedbackAnalysisPrompt' };

/**
 * 版本历史上下文输入
 */
import type { GameVersion } from '../../types';

export interface VersionHistoryContextInput {
  versions: GameVersion[];      // 迭代链（按时间顺序，从根到当前）
  currentVersionId: string;     // 当前版本ID
}

/**
 * 游戏助手系统提示词类型
 */
export type GameAssistantSystemPrompt = string & { __brand: 'GameAssistantSystemPrompt' };
