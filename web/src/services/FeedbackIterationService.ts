/**
 * 反馈迭代服务 - 处理用户反馈并重新生成游戏
 *
 * 流程: 反馈分析 → 更新规则 → 条件重新生成（代码/地图/两者）
 */

import { mapGenerationService } from './MapGenerationService';
import { gameCodeGenerationService } from './GameCodeGenerationService';
import historyService from './HistoryService';
import type { GameVersion } from '../types';
import type { GameRules } from '../game/core/types';

/**
 * 反馈迭代步骤枚举
 */
export type FeedbackIterationStep =
  | 'feedback_analysis'
  | 'segment_detection'
  | 'map_regeneration'
  | 'partial_map_regeneration'
  | 'code_regeneration'
  | 'save_version'
  | 'completed';

export const FeedbackIterationStep = {
  FEEDBACK_ANALYSIS: 'feedback_analysis' as FeedbackIterationStep,
  SEGMENT_DETECTION: 'segment_detection' as FeedbackIterationStep,
  MAP_REGENERATION: 'map_regeneration' as FeedbackIterationStep,
  PARTIAL_MAP_REGENERATION: 'partial_map_regeneration' as FeedbackIterationStep,
  CODE_REGENERATION: 'code_regeneration' as FeedbackIterationStep,
  SAVE_VERSION: 'save_version' as FeedbackIterationStep,
  COMPLETED: 'completed' as FeedbackIterationStep,
} as const;

/**
 * 步骤状态
 */
export interface StepStatus {
  step: FeedbackIterationStep;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  progress?: number; // 0-100
  data?: any;
}

/**
 * 反馈迭代配置
 */
export interface FeedbackIterationConfig {
  feedback: string;
  currentVersion: GameVersion;
  onStepUpdate?: (status: StepStatus) => void;
}

/**
 * 更新决策
 */
export interface UpdateDecision {
  updateCode: boolean;
  updateMap: boolean;
  reasoning: string;
}

/**
 * 反馈迭代结果
 */
export interface FeedbackIterationResult {
  success: boolean;
  error?: string;

  // 分析结果
  updatedRules?: string;
  updateDecision?: UpdateDecision;

  // 重新生成结果
  newMapData?: any;
  newCode?: GameRules;

  // 版本追踪
  newVersionId?: string;
  parentVersionId: string;
  iterationCount: number;
}

/**
 * 反馈迭代服务类
 */
export class FeedbackIterationService {
  /**
   * 使用反馈进行迭代
   */
  async iterateWithFeedback(
    config: FeedbackIterationConfig
  ): Promise<FeedbackIterationResult> {
    const result: FeedbackIterationResult = {
      success: false,
      parentVersionId: config.currentVersion.id,
      iterationCount: (config.currentVersion.iterationCount || 0) + 1,
    };

    try {
      // 步骤1: 反馈分析
      this.updateStep(config, {
        step: FeedbackIterationStep.FEEDBACK_ANALYSIS,
        status: 'running',
        message: '正在分析反馈...',
        progress: 0,
      });

      const analysisResult = await this.analyzeFeedback(config);
      if (!analysisResult.success) {
        result.error = analysisResult.error;
        this.updateStep(config, {
          step: FeedbackIterationStep.FEEDBACK_ANALYSIS,
          status: 'error',
          message: `反馈分析失败: ${analysisResult.error}`,
        });
        return result;
      }

      result.updatedRules = analysisResult.updatedRules;
      result.updateDecision = analysisResult.updateDecision;

      this.updateStep(config, {
        step: FeedbackIterationStep.FEEDBACK_ANALYSIS,
        status: 'success',
        message: `分析完成: ${analysisResult.updateDecision?.reasoning}`,
        progress: 100,
        data: analysisResult.updateDecision,
      });

      console.log('[FeedbackIteration] 更新决策:', analysisResult.updateDecision);

      // 步骤2: 条件重新生成
      let newMapData = config.currentVersion.mapData;
      let newCode = config.currentVersion.code;
      let newSchema = config.currentVersion.schema || {};

      const decision = analysisResult.updateDecision!;

      // 2a: 重新生成地图（如果需要）
      if (decision.updateMap) {
        const cameraMode = config.currentVersion.code?.gameConfig?.cameraMode;

        // 检查是否为长地图，如果是则尝试局部重生成
        if (cameraMode && cameraMode !== 'fixed') {
          // 步骤2a-1: 段索引检测
          this.updateStep(config, {
            step: FeedbackIterationStep.SEGMENT_DETECTION,
            status: 'running',
            message: '正在分析反馈目标区域...',
            progress: 0,
          });

          const segmentDetection = await this.detectTargetSegments(config.feedback, cameraMode);

          if (segmentDetection.success && segmentDetection.isPartial) {
            // 局部重生成
            this.updateStep(config, {
              step: FeedbackIterationStep.SEGMENT_DETECTION,
              status: 'success',
              message: `检测到局部区域: ${segmentDetection.segmentDescriptions}`,
              progress: 100,
            });

            this.updateStep(config, {
              step: FeedbackIterationStep.PARTIAL_MAP_REGENERATION,
              status: 'running',
              message: `正在局部重新生成地图段 [${segmentDetection.targetSegments?.join(', ')}]...`,
              progress: 0,
            });

            const partialResult = await this.regeneratePartialMap(
              analysisResult.updatedRules!,
              config.currentVersion,
              segmentDetection.targetSegments!
            );

            if (partialResult.success) {
              newMapData = partialResult.mapData!;
              result.newMapData = newMapData;
              newSchema = {
                meta: (partialResult.mapData as any).meta || { map_size: { width: 68, height: 17 } },
                mapping: (partialResult.mapData as any).mapping || {},
              };
              this.updateStep(config, {
                step: FeedbackIterationStep.PARTIAL_MAP_REGENERATION,
                status: 'success',
                message: `局部重新生成完成: 段 [${partialResult.regeneratedSegments?.join(', ')}]`,
                progress: 100,
              });
            } else {
              // 局部重生成失败，回退到完整重生成
              console.warn('[FeedbackIteration] 局部重生成失败，回退到完整重生成');
              this.updateStep(config, {
                step: FeedbackIterationStep.PARTIAL_MAP_REGENERATION,
                status: 'error',
                message: `局部重生成失败，尝试完整重生成...`,
              });

              const mapResult = await this.regenerateMap(
                analysisResult.updatedRules!,
                config.currentVersion.schema || {},
                cameraMode
              );

              if (mapResult.success) {
                newMapData = mapResult.mapData!;
                result.newMapData = newMapData;
                newSchema = {
                  meta: (mapResult.mapData as any).meta || { map_size: { width: 17, height: 17 } },
                  mapping: (mapResult.mapData as any).mapping || {},
                };
                this.updateStep(config, {
                  step: FeedbackIterationStep.MAP_REGENERATION,
                  status: 'success',
                  message: '地图重新生成完成',
                  progress: 100,
                });
              }
            }
          } else {
            // 非局部重生成，使用完整重生成
            this.updateStep(config, {
              step: FeedbackIterationStep.SEGMENT_DETECTION,
              status: 'success',
              message: '需要完整重新生成地图',
              progress: 100,
            });

            this.updateStep(config, {
              step: FeedbackIterationStep.MAP_REGENERATION,
              status: 'running',
              message: '正在重新生成地图...',
              progress: 0,
            });

            const mapResult = await this.regenerateMap(
              analysisResult.updatedRules!,
              config.currentVersion.schema || {},
              cameraMode
            );

            if (!mapResult.success) {
              console.warn('[FeedbackIteration] 地图重新生成失败，保留原地图');
              this.updateStep(config, {
                step: FeedbackIterationStep.MAP_REGENERATION,
                status: 'error',
                message: `地图重新生成失败: ${mapResult.error}`,
              });
            } else {
              newMapData = mapResult.mapData!;
              result.newMapData = newMapData;
              newSchema = {
                meta: (mapResult.mapData as any).meta || { map_size: { width: 17, height: 17 } },
                mapping: (mapResult.mapData as any).mapping || {},
              };
              this.updateStep(config, {
                step: FeedbackIterationStep.MAP_REGENERATION,
                status: 'success',
                message: '地图重新生成完成',
                progress: 100,
              });
            }
          }
        } else {
          // 固定镜头，使用完整重生成
          this.updateStep(config, {
            step: FeedbackIterationStep.MAP_REGENERATION,
            status: 'running',
            message: '正在重新生成地图...',
            progress: 0,
          });

          const mapResult = await this.regenerateMap(
            analysisResult.updatedRules!,
            config.currentVersion.schema || {},
            cameraMode
          );

          if (!mapResult.success) {
            console.warn('[FeedbackIteration] 地图重新生成失败，保留原地图');
            this.updateStep(config, {
              step: FeedbackIterationStep.MAP_REGENERATION,
              status: 'error',
              message: `地图重新生成失败: ${mapResult.error}`,
            });
          } else {
            newMapData = mapResult.mapData!;
            result.newMapData = newMapData;
            newSchema = {
              meta: (mapResult.mapData as any).meta || { map_size: { width: 17, height: 17 } },
              mapping: (mapResult.mapData as any).mapping || {},
            };
            this.updateStep(config, {
              step: FeedbackIterationStep.MAP_REGENERATION,
              status: 'success',
              message: '地图重新生成完成',
              progress: 100,
            });
          }
        }
      }

      // 2b: 重新生成代码（如果需要）
      if (decision.updateCode) {
        this.updateStep(config, {
          step: FeedbackIterationStep.CODE_REGENERATION,
          status: 'running',
          message: '正在重新生成代码...',
          progress: 0,
        });

        const codeResult = await this.regenerateCode(
          analysisResult.updatedRules!,
          newMapData,
          config.currentVersion.mapData?.controlInstructions
        );

        if (!codeResult.success) {
          result.error = codeResult.error;
          this.updateStep(config, {
            step: FeedbackIterationStep.CODE_REGENERATION,
            status: 'error',
            message: `代码重新生成失败: ${codeResult.error}`,
          });
          return result;
        }

        newCode = codeResult.code!;
        result.newCode = newCode;
        this.updateStep(config, {
          step: FeedbackIterationStep.CODE_REGENERATION,
          status: 'success',
          message: '代码重新生成完成',
          progress: 100,
        });
      }

      // 步骤3: 保存新版本
      this.updateStep(config, {
        step: FeedbackIterationStep.SAVE_VERSION,
        status: 'running',
        message: '正在保存新版本...',
      });

      const newVersion = historyService.saveIterationVersion(
        newCode,
        newMapData,
        config.currentVersion.id,
        config.feedback,
        analysisResult.updatedRules!,
        newSchema,
        analysisResult.updateDecision
      );

      result.newVersionId = newVersion.id;
      result.success = true;

      this.updateStep(config, {
        step: FeedbackIterationStep.SAVE_VERSION,
        status: 'success',
        message: '新版本已保存',
      });

      this.updateStep(config, {
        step: FeedbackIterationStep.COMPLETED,
        status: 'success',
        message: '迭代完成',
        progress: 100,
      });

      console.log('[FeedbackIteration] 迭代成功完成，新版本ID:', newVersion.id);

      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : '未知错误';
      console.error('[FeedbackIteration] 错误:', error);
      return result;
    }
  }

  /**
   * 分析反馈并生成更新后的规则（调用后端API）
   */
  private async analyzeFeedback(
    config: FeedbackIterationConfig
  ): Promise<{
    success: boolean;
    error?: string;
    updatedRules?: string;
    updateDecision?: UpdateDecision;
  }> {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

    try {
      // 从当前版本提取必要信息
      const currentRules =
        config.currentVersion.metadata?.detailedRules || '无可用规则';
      const schema = config.currentVersion.schema || {};
      const mapData = config.currentVersion.mapData;
      const currentCode = config.currentVersion.code;

      console.log('[FeedbackIteration] 调用后端反馈分析API...');

      // 调用后端API
      const apiResponse = await fetch(`${BACKEND_URL}/api/feedback/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: config.feedback,
          currentRules,
          schema,
          mapData,
          currentCode,
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`后端API调用失败: ${apiResponse.status}`);
      }

      const data = await apiResponse.json();

      if (!data.success) {
        return {
          success: false,
          error: data.error || '后端反馈分析失败',
        };
      }

      return {
        success: true,
        updatedRules: data.updatedRules,
        updateDecision: data.updateDecision,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 解析反馈分析输出
   */
  private parseAnalysisOutput(output: string): {
    success: boolean;
    error?: string;
    updatedRules?: string;
    updateDecision?: UpdateDecision;
  } {
    try {
      // 清理可能的markdown代码块标记
      let cleaned = output.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
      cleaned = cleaned.trim();

      // 解析JSON
      const parsed = JSON.parse(cleaned);

      // 验证必需字段
      if (!parsed.updatedRules || !parsed.updateDecision) {
        return {
          success: false,
          error: '响应缺少必需字段',
        };
      }

      // 使用默认值填充缺失的决策字段
      const updateDecision: UpdateDecision = {
        updateCode: parsed.updateDecision.updateCode ?? true,
        updateMap: parsed.updateDecision.updateMap ?? false,
        reasoning: parsed.updateDecision.reasoning || '未提供原因',
      };

      return {
        success: true,
        updatedRules: parsed.updatedRules,
        updateDecision,
      };
    } catch (error) {
      return {
        success: false,
        error: `JSON解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 重新生成地图
   */
  private async regenerateMap(
    updatedRules: string,
    schema: any,
    cameraMode?: 'fixed' | 'follow' | 'auto-scroll'
  ): Promise<{ success: boolean; error?: string; mapData?: any }> {
    try {
      const mapResult = await mapGenerationService.generateMap({
        prompt: updatedRules,
        schema,
        width: schema.map_size?.width || 17,
        height: schema.map_size?.height || 17,
        cameraMode,
      });

      return {
        success: mapResult.success,
        error: mapResult.error,
        mapData: {
          ...mapResult.mapData,
          ...mapResult.schema,  // 合并 schema 中的 mapping
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 检测目标段索引
   */
  private async detectTargetSegments(
    feedback: string,
    cameraMode: string
  ): Promise<{
    success: boolean;
    isPartial: boolean;
    targetSegments?: number[];
    segmentDescriptions?: string;
    error?: string;
  }> {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

    try {
      const response = await fetch(`${BACKEND_URL}/api/segment/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback,
          cameraMode,
          totalSegments: 4,
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: data.success,
        isPartial: data.isPartial,
        targetSegments: data.targetSegments,
        segmentDescriptions: data.segmentDescriptions,
        error: data.error,
      };
    } catch (error) {
      return {
        success: false,
        isPartial: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 局部重新生成地图
   */
  private async regeneratePartialMap(
    updatedRules: string,
    currentVersion: GameVersion,
    targetSegments: number[]
  ): Promise<{
    success: boolean;
    mapData?: any;
    regeneratedSegments?: number[];
    error?: string;
  }> {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

    try {
      const response = await fetch(`${BACKEND_URL}/api/map/regenerate-partial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: updatedRules,
          schema: currentVersion.schema || {},
          mapData: currentVersion.mapData,
          targetSegments,
          physicsMode: currentVersion.code?.gameConfig?.physicsMode,
          segmentWidth: 17,
          segmentHeight: 17,
          totalSegments: 4,
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: data.success,
        mapData: data.mapData,
        regeneratedSegments: data.regeneratedSegments,
        error: data.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 重新生成代码
   */
  private async regenerateCode(
    updatedRules: string,
    mapData: any,
    controlInstructions?: string
  ): Promise<{ success: boolean; error?: string; code?: string }> {
    try {
      const codeResult = await gameCodeGenerationService.generateGameCode({
        rules: updatedRules,
        mapData,
        controlInstructions,
        maxRetries: 2,
      });

      return {
        success: codeResult.success,
        error: codeResult.error,
        code: codeResult.code,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 更新步骤状态
   */
  private updateStep(config: FeedbackIterationConfig, status: StepStatus): void {
    if (config.onStepUpdate) {
      config.onStepUpdate(status);
    }
  }
}

// 导出单例实例
export const feedbackIterationService = new FeedbackIterationService();
