/**
 * 地图生成相关类型定义
 */

/**
 * 地图生成请求
 */
export interface MapGenerationRequest {
  /** 用户提示词 */
  prompt: string;
  /** 参考地图数据 */
  referenceMap?: any;
  /** 地图宽度 */
  width: number;
  /** 地图高度 */
  height: number;
}

/**
 * 地图生成结果
 */
export interface MapGenerationResult {
  /** 是否成功 */
  success: boolean;
  /** 生成的地图数据 */
  mapData?: any;
  /** 错误信息 */
  error?: string;
  /** 各层输出 */
  layers?: {
    layer1: string; // 特征分析
    layer2: string; // 蓝图
    layer3: string; // 具体地图
    layer4?: string; // 分段（如果需要）
  };
}

/**
 * 地图元素定义
 */
export interface MapElement {
  /** 元素名称 */
  name: string;
  /** 元素描述 */
  description?: string;
  /** 所属层 */
  layer: 'terrain' | 'interaction';
  /** 颜色 */
  color?: string;
  /** 默认尺寸 */
  default_size?: {
    width: number;
    height: number;
  };
}

/**
 * 地图配置
 */
export interface MapConfig {
  /** 元数据 */
  meta: {
    game_type: string;
    tile_size: number;
    map_size: {
      width: number;
      height: number;
    };
    coordinate_system: string;
  };
  /** 字段说明 */
  field_guide?: Record<string, any>;
  /** 元素映射 */
  mapping: Record<string, MapElement>;
  /** 地形数据 */
  terrain: {
    grid: Array<{
      y: number;
      row: string;
    }>;
  };
  /** 交互对象 */
  interaction: Array<{
    id: string;
    category: string;
    element: string;
    anchor: {
      x: number;
      y: number;
    };
    size: {
      width: number;
      height: number;
    };
  }>;
}
