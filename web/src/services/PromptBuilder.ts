/**
 * Prompt构建器 - Facade模式
 * 为LLM生成各种提示词，现在作为统一入口委托给专门的Builder类
 *
 * 重构说明:
 * - 保持向后兼容的公共接口
 * - 内部委托给专门的Builder类（MapPromptBuilder, CodePromptBuilder等）
 * - 所有可复用片段已移至PromptFragments
 */

import {
  MapPromptBuilder,
  CodePromptBuilder,
  SchemaPromptBuilder,
  DescriptionPromptBuilder,
} from './prompts';
import { FeedbackPromptBuilder } from './prompts/FeedbackPromptBuilder';
import type { GameSearchResult } from '../types';

/**
 * 地图生成请求接口
 */
export interface MapGenerationRequest {
  prompt: string;
  referenceMap?: any;
  width: number;
  height: number;
  schema?: any;
}

/**
 * 代码生成请求接口
 */
export interface CodeGenerationRequest {
  rules: string;
  mapData: any;
  controlInstructions?: string;
  maxRetries?: number;
}

/**
 * Prompt构建器类 - Facade模式
 * 负责协调各个专门的Builder类
 */
export class PromptBuilder {
  private mapBuilder = new MapPromptBuilder();
  private codeBuilder = new CodePromptBuilder();
  private schemaBuilder = new SchemaPromptBuilder();
  private descriptionBuilder = new DescriptionPromptBuilder();
  private feedbackBuilder = new FeedbackPromptBuilder();

  /**
 * 构建schema生成prompt
 * 生成用于map和rule 的统一元素定义方法
 * 委托给SchemaPromptBuilder
 */
  buildSchemaGenerationPrompt(
    enhancedDescription: string,
    ragResults: any[],
    mapInfo: { width: number; height: number }
  ): string {
    return this.schemaBuilder.buildSchemaGenerationPrompt({
      enhancedDescription,
      ragResults,
      mapInfo,
    });
  }

  /**
   * 构建具体规则生成prompt
   * （当前）基于已有的两个mario和battlecity生成新游戏具体规则
   * 委托给 SchemaPromptBuilder
   */
  buildDetailedRulesPrompt(
    enhancedDescription: string,
    ragResults: any[],
    schema: any,
    mapInfo: { width: number; height: number }
  ): string {
    return this.schemaBuilder.buildDetailedRulesPrompt({
      enhancedDescription,
      ragResults,
      schema,
      mapInfo,
    });
  }

  /**
   * 构建描述增强prompt
   * 将概述扩展为简单游戏描述
   * 委托给 DescriptionPromptBuilder
   * 用于替代 GamePrototypeService.enhanceDescription() 中硬编码的提示词
   */
  buildDescriptionEnhancePrompt(
    userPrompt: string,
    ragResults: GameSearchResult[]
  ): string {
    return this.descriptionBuilder.buildDescriptionEnhancePrompt({
      userPrompt,
      ragResults,
    });
  }

  /**
   * 构建操作说明提取prompt
   * 从详细游戏规则中提取简洁的操作说明
   * 委托给 SchemaPromptBuilder
   */
  buildControlInstructionsPrompt(detailedRules: string): string {
    return this.schemaBuilder.buildControlInstructionsPrompt(detailedRules);
  }

  /**
   * 构建Layer1 prompt（地图特征分析）
   * 委托给 MapPromptBuilder
   */
  async buildMapLayer1Prompt(request: MapGenerationRequest): Promise<string> {
    return this.mapBuilder.buildLayer1Prompt({
      prompt: request.prompt,
      schema: request.schema,
      width: request.width,
      height: request.height,
    });
  }

  /**
   * 构建Layer2 prompt（蓝图生成）
   * 委托给 MapPromptBuilder
   */
  buildMapLayer2Prompt(request: MapGenerationRequest, layer1Output: string): string {
    return this.mapBuilder.buildLayer2Prompt({
      prompt: request.prompt,
      layer1Output,
    });
  }

  /**
   * 构建Layer3 prompt（具体地图生成）
   * 委托给 MapPromptBuilder
   */
  buildMapLayer3Prompt(request: MapGenerationRequest, layer2Output: string): string {
    return this.mapBuilder.buildLayer3Prompt({
      prompt: request.prompt,
      layer2Output,
      schema: request.schema,
      width: request.width,
      height: request.height,
    });
  }

  /**
   * 构建Layer4 prompt（长地图分段）
   * 委托给 MapPromptBuilder
   */
  buildMapLayer4Prompt(mapData: any): string {
    return this.mapBuilder.buildLayer4Prompt({ mapData });
  }

  /**
   * 构建代码生成prompt
   * 委托给 CodePromptBuilder
   */
  buildCodeGenerationPrompt(request: CodeGenerationRequest): string {
    return this.codeBuilder.buildCodeGenerationPrompt({
      rules: request.rules,
      mapData: request.mapData,
      controlInstructions: request.controlInstructions,
    });
  }

  /**
   * 构建代码修复prompt
   * 委托给 CodePromptBuilder
   */
  buildCodeFixPrompt(
    code: string,
    errors: string[],
    request: CodeGenerationRequest
  ): string {
    return this.codeBuilder.buildCodeFixPrompt({
      code,
      errors,
      rules: request.rules,
      mapData: request.mapData,
    });
  }

  /**
   * 构建反馈分析prompt
   * 分析用户反馈并生成更新后的规则 + 更新决策
   * 委托给 FeedbackPromptBuilder
   */
  buildFeedbackAnalysisPrompt(
    feedback: string,
    currentRules: string,
    schema: any,
    mapData: any,
    currentCode: string
  ): string {
    return this.feedbackBuilder.buildFeedbackAnalysisPrompt({
      feedback,
      currentRules,
      schema,
      mapData,
      currentCode,
    });
  }
}

// 导出单例实例
export const promptBuilder = new PromptBuilder();
