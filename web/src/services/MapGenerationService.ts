/**
 * 地图生成服务 - 前端版本（调用后端API）
 * 从原来的完整LLM调用改为调用后端API
 */

import logger from '../utils/Logger';

export interface MapGenerationRequest {
  prompt: string;
  referenceMap?: any;
  width?: number;
  height?: number;
  schema?: any;
  physicsMode?: 'platformer' | 'topdown' | 'freely';
  cameraMode?: 'fixed' | 'follow' | 'auto-scroll';
}

export interface MapGenerationAttempt {
  attempt: number;
  layer3Output: string;
  mapData?: any;
  validationResult: {
    success: boolean;
    error?: string;
  };
}

export interface SimplifiedMapData {
  terrain: {
    grid: Array<{ y: number; row: string }>;
  };
  interaction: Array<{
    id: string;
    element: string;
    category?: string;
    anchor: { x: number; y: number };
    size?: { width: number; height: number };
  }>;
}

export interface SchemaData {
  meta: {
    map_size: { width: number; height: number };
    tile_size?: number;
    coordinate_system?: string;
  };
  field_guide?: {
    mapping?: string;
    terrain?: string;
    interaction?: string;
  };
  mapping: {
    [char: string]: {
      name: string;
      description?: string;
      color: string;
      layer: string;
      category?: string;
      default_size?: { width: number; height: number };
    };
  };
}

export interface MapGenerationResult {
  success: boolean;
  mapData?: SimplifiedMapData;
  schema?: SchemaData;
  error?: string;
  layers?: {
    layer1: string;
    layer2: string;
    layer3: string;
  };
  attempts?: MapGenerationAttempt[];
}

/**
 * 地图生成服务类 - 前端版本（调用后端API）
 * 负责调用后端API生成游戏地图
 */
export class MapGenerationService {
  /**
   * 生成地图
   * @param request 地图生成请求
   * @returns 地图生成结果
   */
  async generateMap(request: MapGenerationRequest): Promise<MapGenerationResult> {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

    try {
      console.log('[MapGeneration] 调用后端地图生成API...');
      logger.info('MapGeneration', '开始生成地图（后端处理）', {
        width: request.width,
        height: request.height,
      });

      const apiResponse = await fetch(`${BACKEND_URL}/api/map/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enhancedDescription: request.prompt,
          schema: request.schema,
          mapWidth: request.width,
          mapHeight: request.height,
          physicsMode: request.physicsMode,
          cameraMode: request.cameraMode,
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`后端API调用失败: ${apiResponse.status} ${apiResponse.statusText}`);
      }

      const data = await apiResponse.json();

      if (!data.success) {
        logger.error('MapGeneration', '后端地图生成失败', { error: data.error });
        return {
          success: false,
          error: data.error || '后端地图生成失败',
        };
      }

      console.log('[MapGeneration] 地图生成完成');
      logger.info('MapGeneration', '地图生成完成', {
        hasMapData: !!data.mapData,
        hasSchema: !!data.schema,
      });

      return {
        success: true,
        mapData: data.mapData,
        schema: data.schema || request.schema,
        layers: data.layers,
        attempts: data.attempts,
      };
    } catch (error) {
      console.error('[MapGeneration] Error:', error);
      logger.error('MapGeneration', '地图生成异常', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// 导出单例实例
export const mapGenerationService = new MapGenerationService();
