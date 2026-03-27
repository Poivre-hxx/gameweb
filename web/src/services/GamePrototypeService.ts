/**
 * 游戏原型生成服务
 * 提供步骤回调机制用于UI进度显示
 */

import { mapGenerationService } from './MapGenerationService';
import { gameCodeGenerationService } from './GameCodeGenerationService';
import historyService from './HistoryService';
import type { GameSearchResult } from '../types';
import type { MapGenerationResult } from './MapGenerationService';
import type { CodeGenerationResult } from './GameCodeGenerationService';
import type { GameRules } from '../game/core/types';
import { downloadGeneratedCode, downloadJSON, downloadText } from '../utils/download';
import { parseMapData } from '../utils/parser';
import { CloudCog } from 'lucide-react';

// 后端API地址配置
// 空字符串表示使用相对路径，通过 Nginx 代理访问后端
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

/**
 * 生成步骤枚举
 */
export type GenerationStep =
  | 'rag_search'
  | 'description_enhance'
  | 'schema_generation'
  | 'detailed_rules_generation'
  | 'control_instructions'
  | 'game_description'
  | 'map_generation'
  | 'code_generation'
  | 'save_version'
  | 'completed';

export const GenerationStep = {
  RAG_SEARCH: 'rag_search' as GenerationStep,
  DESCRIPTION_ENHANCE: 'description_enhance' as GenerationStep,
  SCHEMA_GENERATION: 'schema_generation' as GenerationStep,
  DETAILED_RULES_GENERATION: 'detailed_rules_generation' as GenerationStep,
  CONTROL_INSTRUCTIONS: 'control_instructions' as GenerationStep,
  GAME_DESCRIPTION: 'game_description' as GenerationStep,
  MAP_GENERATION: 'map_generation' as GenerationStep,
  CODE_GENERATION: 'code_generation' as GenerationStep,
  SAVE_VERSION: 'save_version' as GenerationStep,
  COMPLETED: 'completed' as GenerationStep,
} as const;

/**
 * 步骤状态
 */
export interface StepStatus {
  step: GenerationStep;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  progress?: number; // 0-100
  data?: any;
}

/**
 * 生成配置
 */
export interface GenerationConfig {
  /** 用户输入的游戏描述 */
  userPrompt: string;

  /** 地图宽度（格子数） */
  mapWidth?: number;

  /** 地图高度（格子数） */
  mapHeight?: number;

  /** 物理模式 */
  physicsMode?: 'platformer' | 'topdown' | 'freely';

  /** 摄像机模式 */
  cameraMode?: 'fixed' | 'follow' | 'auto-scroll';

  /** 是否跳过RAG检索（调试用） */
  skipRAG?: boolean;

  /** 是否跳过描述增强（调试用） */
  skipDescriptionEnhance?: boolean;

  /** 模拟地图数据（调试用） */
  mockMapData?: any;

  /** 模拟游戏规则（调试用） */
  mockGameRules?: string;

  /** 代码生成最大重试次数 */
  maxCodeRetries?: number;

  /** 步骤回调函数 */
  onStepUpdate?: (status: StepStatus) => void;
}

/**
 * 生成结果
 */
export interface GenerationResult {
  success: boolean;
  error?: string;

  // 中间结果
  ragResults?: GameSearchResult[];
  enhancedDescription?: string;
  schema?: any;
  detailedRules?: string;
  controlInstructions?: string;
  gameDescription?: string;
  mapResult?: MapGenerationResult;
  codeResult?: CodeGenerationResult;

  // 最终结果
  gameCode?: GameRules;
  mapData?: any;
  gameRules?: string;

  // 版本ID（如果保存成功）
  versionId?: string;
}

/**
 * 游戏原型生成服务类
 */
export class GamePrototypeService {
  /**
   * 生成完整游戏原型
   */
  async generatePrototype(config: GenerationConfig): Promise<GenerationResult> {
    const result: GenerationResult = {
      success: false,
    };

    try {
      // ========== 步骤1: RAG检索 ==========
      this.updateStep(config, {
        step: GenerationStep.RAG_SEARCH,
        status: 'running',
        message: '正在检索相似游戏...',
        progress: 0,
      });

      try {
        console.log('[GamePrototype] 步骤1: 调用RAG检索API...');
        const ragResponse = await fetch(`${BACKEND_URL}/api/rag/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userPrompt: config.userPrompt,
            topK: 3
          })
        });

        if (!ragResponse.ok) {
          throw new Error(`RAG检索API调用失败: ${ragResponse.status}`);
        }

        const ragData = await ragResponse.json();

        if (!ragData.success) {
          throw new Error(ragData.error || 'RAG检索失败');
        }

        result.ragResults = ragData.ragResults;

        // 输出找到的相似游戏名称
        console.log('[GamePrototype] 步骤1完成 - 找到相似游戏:');
        result.ragResults?.forEach((r: any, index: number) => {
          const game = r.game;
          console.log(`  ${index + 1}. ${game.name || game.game_id} - 相似度: ${(r.similarity * 100).toFixed(1)}%`);
        });

        this.updateStep(config, {
          step: GenerationStep.RAG_SEARCH,
          status: 'success',
          message: `找到 ${result.ragResults?.length || 0} 个相似游戏`,
          progress: 100,
          data: result.ragResults,
        });
      } catch (error) {
        const errorMsg = `步骤1失败: ${error instanceof Error ? error.message : '未知错误'}`;
        console.error('[GamePrototype]', errorMsg);
        this.updateStep(config, {
          step: GenerationStep.RAG_SEARCH,
          status: 'error',
          message: errorMsg,
        });
        result.error = errorMsg;
        return result;
      }

      // ========== 步骤2: 描述增强 ==========
      this.updateStep(config, {
        step: GenerationStep.DESCRIPTION_ENHANCE,
        status: 'running',
        message: '正在增强游戏描述...',
        progress: 0,
      });

      try {
        console.log('[GamePrototype] 步骤2: 调用描述增强API...');
        const enhanceResponse = await fetch(`${BACKEND_URL}/api/description/enhance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userPrompt: config.userPrompt,
            ragResults: result.ragResults
          })
        });

        if (!enhanceResponse.ok) {
          throw new Error(`描述增强API调用失败: ${enhanceResponse.status}`);
        }

        const enhanceData = await enhanceResponse.json();

        if (!enhanceData.success) {
          throw new Error(enhanceData.error || '描述增强失败');
        }

        result.enhancedDescription = enhanceData.enhancedDescription;
        console.log('[GamePrototype] 步骤2完成 - 描述增强完成');

        this.updateStep(config, {
          step: GenerationStep.DESCRIPTION_ENHANCE,
          status: 'success',
          message: '游戏描述增强完成',
          progress: 100,
          data: result.enhancedDescription,
        });
      } catch (error) {
        const errorMsg = `步骤2失败: ${error instanceof Error ? error.message : '未知错误'}`;
        console.error('[GamePrototype]', errorMsg);
        this.updateStep(config, {
          step: GenerationStep.DESCRIPTION_ENHANCE,
          status: 'error',
          message: errorMsg,
        });
        result.error = errorMsg;
        return result;
      }

      // ========== 步骤3: Schema生成 ==========
      this.updateStep(config, {
        step: GenerationStep.SCHEMA_GENERATION,
        status: 'running',
        message: '正在生成地图元素定义...',
        progress: 0,
      });

      try {
        console.log('[GamePrototype] 步骤3: 调用Schema生成API...');
        const schemaResponse = await fetch(`${BACKEND_URL}/api/schema/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enhancedDescription: result.enhancedDescription,
            ragResults: result.ragResults,
            mapWidth: config.mapWidth || 18,
            mapHeight: config.mapHeight || 18
          })
        });

        if (!schemaResponse.ok) {
          throw new Error(`Schema生成API调用失败: ${schemaResponse.status}`);
        }

        const schemaData = await schemaResponse.json();

        if (!schemaData.success) {
          throw new Error(schemaData.error || 'Schema生成失败');
        }

        result.schema = schemaData.schema;
        console.log('[GamePrototype] 步骤3完成 - Schema生成完成');

        this.updateStep(config, {
          step: GenerationStep.SCHEMA_GENERATION,
          status: 'success',
          message: '地图元素定义生成完成',
          progress: 100,
          data: { elementCount: Object.keys(result.schema?.mapping || {}).length },
        });
      } catch (error) {
        const errorMsg = `步骤3失败: ${error instanceof Error ? error.message : '未知错误'}`;
        console.error('[GamePrototype]', errorMsg);
        this.updateStep(config, {
          step: GenerationStep.SCHEMA_GENERATION,
          status: 'error',
          message: errorMsg,
        });
        result.error = errorMsg;
        return result;
      }

      // ========== 步骤4: 详细规则生成 ==========
      this.updateStep(config, {
        step: GenerationStep.DETAILED_RULES_GENERATION,
        status: 'running',
        message: '正在生成详细游戏规则...',
        progress: 0,
      });

      try {
        console.log('[GamePrototype] 步骤4: 调用详细规则生成API...');
        const rulesResponse = await fetch(`${BACKEND_URL}/api/rules/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enhancedDescription: result.enhancedDescription,
            ragResults: result.ragResults,
            schema: result.schema,
            mapWidth: config.mapWidth || 18,
            mapHeight: config.mapHeight || 18
          })
        });

        if (!rulesResponse.ok) {
          throw new Error(`详细规则生成API调用失败: ${rulesResponse.status}`);
        }

        const rulesData = await rulesResponse.json();

        if (!rulesData.success) {
          throw new Error(rulesData.error || '详细规则生成失败');
        }

        result.detailedRules = rulesData.detailedRules;
        console.log('[GamePrototype] 步骤4完成 - 详细规则生成完成');

        this.updateStep(config, {
          step: GenerationStep.DETAILED_RULES_GENERATION,
          status: 'success',
          message: '详细规则生成完成',
          progress: 100,
          data: { rulesLength: result.detailedRules?.length || 0 },
        });
      } catch (error) {
        const errorMsg = `步骤4失败: ${error instanceof Error ? error.message : '未知错误'}`;
        console.error('[GamePrototype]', errorMsg);
        this.updateStep(config, {
          step: GenerationStep.DETAILED_RULES_GENERATION,
          status: 'error',
          message: errorMsg,
        });
        result.error = errorMsg;
        return result;
      }

      // Step 4.5: 操作说明生成（调用后端API）
      this.updateStep(config, {
        step: GenerationStep.CONTROL_INSTRUCTIONS,
        status: 'running',
        message: '正在生成操作说明（后端处理）...',
        progress: 0,
      });

      try {
        console.log('[GamePrototype] 调用后端操作说明生成API...');
        const controlResponse = await fetch(`${BACKEND_URL}/api/control-instructions/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rules: result.enhancedDescription || '',
          })
        });

        if (!controlResponse.ok) {
          throw new Error(`后端API调用失败: ${controlResponse.status}`);
        }

        const controlData = await controlResponse.json();

        if (!controlData.success) {
          throw new Error(controlData.error || '后端处理失败');
        }

        result.controlInstructions = controlData.controlInstructions?.trim() || '';

        console.log('[GamePrototype] 🎮 生成的操作说明:');
        console.log('─'.repeat(60));
        console.log(result.controlInstructions);
        console.log('─'.repeat(60));

        this.updateStep(config, {
          step: GenerationStep.CONTROL_INSTRUCTIONS,
          status: 'success',
          message: '操作说明生成完成',
          progress: 100,
          data: { controlInstructions: result.controlInstructions },
        });
      } catch (error) {
        this.updateStep(config, {
          step: GenerationStep.CONTROL_INSTRUCTIONS,
          status: 'error',
          message: `操作说明生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        });
        // 失败则使用默认操作说明
        result.controlInstructions = 'Joystick : Move\nButton A : Action';
        console.warn('[GamePrototype] Control instructions generation failed, using default');
      }

      // Step 5: 地图生成
      this.updateStep(config, {
        step: GenerationStep.MAP_GENERATION,
        status: 'running',
        message: '正在生成游戏地图...',
        progress: 0,
      });

      const mapResult = await mapGenerationService.generateMap({
        prompt: result.enhancedDescription || config.userPrompt,
        width: config.mapWidth || 17,
        height: config.mapHeight || 17,
        schema: result.schema,
        physicsMode: config.physicsMode,
        cameraMode: config.cameraMode,
      });

      result.mapResult = mapResult;

      if (!mapResult.success || !mapResult.mapData) {
        this.updateStep(config, {
          step: GenerationStep.MAP_GENERATION,
          status: 'error',
          message: `地图生成失败: ${mapResult.error || '未知错误'}`,
        });
        result.error = `地图生成失败: ${mapResult.error}`;
        return result;
      }

      // 把数据保存到result上
      result.mapData = mapResult.mapData;

      // 把schema保存到result上
      result.schema = mapResult.schema;

      result.mapData = {
        ...mapResult.mapData,
        ...mapResult.schema
      }

      // 下载
      // downloadJSON(result.mapData, 'map.json')

      this.updateStep(config, {
        step: GenerationStep.MAP_GENERATION,
        status: 'success',
        message: '地图生成完成',
        progress: 100,
        data: mapResult.mapData,
      });


      // Step 6: 代码生成
      this.updateStep(config, {
        step: GenerationStep.CODE_GENERATION,
        status: 'running',
        message: '正在生成游戏企划...',
        progress: 0,
      });

      console.log(result.controlInstructions);

      const gameRules = config.mockGameRules || result.enhancedDescription || config.userPrompt;
      result.gameRules = gameRules;

      const codeResult = await gameCodeGenerationService.generateGameCode({
        rules: gameRules,
        mapData: result.mapData,
        controlInstructions: result.controlInstructions,
        maxRetries: config.maxCodeRetries || 2,
      });

      result.codeResult = codeResult;

      if (!codeResult.success || !codeResult.code) {
        this.updateStep(config, {
          step: GenerationStep.CODE_GENERATION,
          status: 'error',
          message: `代码生成失败: ${codeResult.error || '未知错误'}`,
        });
        result.error = `代码生成失败: ${codeResult.error}`;
        return result;
      }

      // 下载生成代码
      // downloadJSON(codeResult.code, 'code.json');

      // 保存生成的代码到结果中
      result.gameCode = codeResult.code;

      this.updateStep(config, {
        step: GenerationStep.CODE_GENERATION,
        status: 'success',
        message: '代码生成完成',
        progress: 100,
        data: { attempts: codeResult.attempts.length },
      });

      // Step 6.5: 游戏描述生成
      this.updateStep(config, {
        step: GenerationStep.GAME_DESCRIPTION,
        status: 'running',
        message: '正在生成游戏描述...',
        progress: 0,
      });

      try {
        console.log('[GamePrototype] 调用游戏描述生成API...');
        const descResponse = await fetch(`${BACKEND_URL}/api/game/describe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: result.gameCode,
            map: result.mapData,
            enhancedRules: result.detailedRules || result.enhancedDescription,
          })
        });

        if (!descResponse.ok) {
          throw new Error(`游戏描述API调用失败: ${descResponse.status}`);
        }

        const descData = await descResponse.json();

        if (!descData.success) {
          throw new Error(descData.error || '游戏描述生成失败');
        }

        result.gameDescription = descData.description;

        console.log('[GamePrototype] 游戏描述生成完成:', result.gameDescription);

        this.updateStep(config, {
          step: GenerationStep.GAME_DESCRIPTION,
          status: 'success',
          message: '游戏描述生成完成',
          progress: 100,
          data: { description: result.gameDescription },
        });
      } catch (error) {
        this.updateStep(config, {
          step: GenerationStep.GAME_DESCRIPTION,
          status: 'error',
          message: `游戏描述生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        });
        // 失败不影响继续执行
        result.gameDescription = '';
        console.warn('[GamePrototype] Game description generation failed, continuing without it');
      }

      // Step 7: 保存版本
      this.updateStep(config, {
        step: GenerationStep.SAVE_VERSION,
        status: 'running',
        message: '正在保存游戏版本...',
        progress: 0,
      });

      try {
        // 在保存前添加 gameConfig（包含用户选择的模式和 tileSize）
        const gameCodeWithConfig = {
          ...result.gameCode,
          gameConfig: {
            physicsMode: config.physicsMode || 'topdown',
            cameraMode: config.cameraMode || 'fixed',
            tileSize: 32,
          }
        };

        const version = historyService.saveVersion(
          gameCodeWithConfig,  // 使用包含 gameConfig 的配置
          result.mapData,
          result.schema,
          config.userPrompt,
          result.gameDescription  // 传递游戏描述
        );

        // 补充 metadata 中的详细规则
        if (result.detailedRules) {
          version.metadata = {
            ...version.metadata,
            detailedRules: result.detailedRules,
            controlInstructions: result.controlInstructions,
            gameDescription: result.gameDescription,
          };
          // 重新保存以包含 metadata
          const VERSION_STORAGE_KEY = 'game-version-history';
          const historyData = localStorage.getItem(VERSION_STORAGE_KEY);
          if (historyData) {
            const history = JSON.parse(historyData);
            const index = history.versions.findIndex((v: any) => v.id === version.id);
            if (index !== -1) {
              history.versions[index] = version;
              localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(history));
            }
          }
        }

        result.versionId = version.id;
        this.updateStep(config, {
          step: GenerationStep.SAVE_VERSION,
          status: 'success',
          message: '游戏版本已保存',
          progress: 100,
          data: { versionId: version.id },
        });
      } catch (error) {
        this.updateStep(config, {
          step: GenerationStep.SAVE_VERSION,
          status: 'error',
          message: `保存版本失败: ${error instanceof Error ? error.message : '未知错误'}`,
        });
        // 保存失败不影响生成成功
        console.warn('[GamePrototype] Failed to save version, but generation succeeded');
      }

      // 完成
      this.updateStep(config, {
        step: GenerationStep.COMPLETED,
        status: 'success',
        message: '游戏生成完成！',
        progress: 100,
      });

      result.success = true;
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : '未知错误';
      result.success = false;

      this.updateStep(config, {
        step: GenerationStep.COMPLETED,
        status: 'error',
        message: `生成失败: ${result.error}`,
      });

      return result;
    }
  }

  /**
   * 更新步骤状态
   */
  private updateStep(config: GenerationConfig, status: StepStatus): void {
    if (config.onStepUpdate) {
      config.onStepUpdate(status);
    }

    // 同时输出到控制台
    const emoji = status.status === 'success' ? '✅' : status.status === 'error' ? '❌' : '⏳';
    console.log(`[GamePrototype] ${emoji} ${status.step}: ${status.message}`);
  }

  /**
   * 从历史版本加载游戏
   */
  loadFromHistory(versionId: string): { code: string; mapData: any } | null {
    const version = historyService.getVersion(versionId);
    if (!version) {
      return null;
    }

    return {
      code: version.code,
      mapData: version.mapData,
    };
  }

  /**
   * 获取所有历史版本
   */
  getAllVersions() {
    return historyService.getVersions();
  }

  /**
   * 删除历史版本
   */
  deleteVersion(versionId: string): boolean {
    return historyService.deleteVersion(versionId);
  }

  /**
   * 回退到指定版本
   */
  rollbackToVersion(versionId: string): boolean {
    const result = historyService.revertToVersion(versionId);
    return result !== null;
  }
}

// 导出单例实例
export const gamePrototypeService = new GamePrototypeService();

/**
 * 游戏原型生成服务 - 简化测试版
 * 直接读取本地文件，不调用 LLM
 */

// import type { GameRules } from '../game/core/types';

// /**
//  * 生成步骤枚举
//  */
// export type GenerationStep = 'load_map' | 'load_code' | 'completed';

// export const GenerationStep = {
//   LOAD_MAP: 'load_map' as GenerationStep,
//   LOAD_CODE: 'load_code' as GenerationStep,
//   COMPLETED: 'completed' as GenerationStep,
// } as const;

// /**
//  * 步骤状态
//  */
// export interface StepStatus {
//   step: GenerationStep;
//   status: 'pending' | 'running' | 'success' | 'error';
//   message: string;
//   progress?: number;
//   data?: any;
// }

// /**
//  * 生成配置
//  */
// export interface GenerationConfig {
//   /** 用户输入的游戏描述（保留接口兼容） */
//   userPrompt?: string;
//   /** 步骤回调函数 */
//   onStepUpdate?: (status: StepStatus) => void;
// }

// /**
//  * 生成结果
//  */
// export interface GenerationResult {
//   success: boolean;
//   error?: string;
//   mapData?: any;
//   gameCode?: GameRules;
// }

// /**
//  * 游戏原型生成服务类
//  */
// export class GamePrototypeService {
//   // 文件路径配置（放在 public 目录下）
//   private readonly MAP_PATH = '/map.json';
//   private readonly CODE_PATH = '/code.json';

//   /**
//    * 生成完整游戏原型（简化版：直接读取本地文件）
//    */
//   async generatePrototype(config?: GenerationConfig): Promise<GenerationResult> {
//     const result: GenerationResult = {
//       success: false,
//     };

//     try {
//       // Step 1: 加载地图数据
//       this.updateStep(config, {
//         step: GenerationStep.LOAD_MAP,
//         status: 'running',
//         message: '正在加载地图数据...',
//         progress: 0,
//       });

//       const mapData = await this.loadJSON(this.MAP_PATH);
//       result.mapData = mapData;

//       this.updateStep(config, {
//         step: GenerationStep.LOAD_MAP,
//         status: 'success',
//         message: '地图数据加载完成',
//         progress: 100,
//         data: mapData,
//       });

//       // Step 2: 加载游戏代码
//       this.updateStep(config, {
//         step: GenerationStep.LOAD_CODE,
//         status: 'running',
//         message: '正在加载游戏代码...',
//         progress: 0,
//       });

//       const gameCode = await this.loadJSON(this.CODE_PATH);
//       result.gameCode = gameCode;

//       this.updateStep(config, {
//         step: GenerationStep.LOAD_CODE,
//         status: 'success',
//         message: '游戏代码加载完成',
//         progress: 100,
//         data: { codeLength: gameCode.length },
//       });

//       // 完成
//       this.updateStep(config, {
//         step: GenerationStep.COMPLETED,
//         status: 'success',
//         message: '加载完成！',
//         progress: 100,
//       });

//       result.success = true;
//       return result;

//     } catch (error) {
//       result.error = error instanceof Error ? error.message : '未知错误';
//       result.success = false;

//       this.updateStep(config, {
//         step: GenerationStep.COMPLETED,
//         status: 'error',
//         message: `加载失败: ${result.error}`,
//       });

//       return result;
//     }
//   }

//   /**
//    * 加载 JSON 文件
//    */
//   private async loadJSON(path: string): Promise<any> {
//     const response = await fetch(path);
//     if (!response.ok) {
//       throw new Error(`加载 ${path} 失败: ${response.status} ${response.statusText}`);
//     }
//     return response.json();
//   }

//   /**
//    * 更新步骤状态
//    */
//   private updateStep(config: GenerationConfig | undefined, status: StepStatus): void {
//     if (config?.onStepUpdate) {
//       config.onStepUpdate(status);
//     }

//     // 同时输出到控制台
//     const emoji = status.status === 'success' ? '✅' : status.status === 'error' ? '❌' : '⏳';
//     console.log(`[GamePrototype] ${emoji} ${status.step}: ${status.message}`);
//   }
// }

// // 导出单例实例
// export const gamePrototypeService = new GamePrototypeService();
