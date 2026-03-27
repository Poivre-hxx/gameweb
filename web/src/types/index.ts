export interface GameData {
  game_id: string;
  name: string;
  genre: string;
  view: string;
  tags: string[];
  gameplay_summary: string;
  key_mechanics: {
    player_abilities: string[];
    interaction_modes: string[];
    enemy_characteristics: string[];
    environment_characteristics: string[];
    win_condition: string;
  };
  embedding: number[];
}

export interface EmbeddedGames {
  [gameId: string]: GameData;
}

export type TabType = 'home' | 'preview' | 'history';

// GameRAG 搜索结果类型
export interface GameSearchResult {
  game: GameData;
  similarity: number;
}

import type { GameRules } from '../game/core/types';

// 游戏版本控制类型
export interface GameVersion {
  id: string; // 唯一ID（使用timestamp）
  caption: string; // 版本描述（类似git commit message）
  timestamp: number; // 创建时间戳
  code: GameRules; // 游戏规则对象
  mapData: {
    // 简化的地图数据，只包含 terrain 和 interaction
    terrain: { grid: Array<{ y: number; row: string }> };
    interaction?: Array<{
      id: string;
      element: string;
      category?: string;
      anchor: { x: number; y: number };
      size?: { width: number; height: number };
    }>;
  };
  schema: {
    // Schema 定义（独立字段）
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
        collision?: 'prevent' | 'passive' | 'active' | 'fixed';
        default_size?: { width: number; height: number };
      };
    };
  };

  // 迭代追踪字段
  parentVersionId?: string; // 父版本ID链接
  iterationCount?: number; // 从根版本开始的迭代次数
  feedbackText?: string; // 创建此版本的反馈内容

  metadata?: {
    // 可选的元数据
    codeGenerationAttempts?: number; // 代码生成尝试次数
    validationErrors?: string[]; // 验证错误（如果有）
    mapLayers?: {
      // 地图生成的中间层
      layer1?: string;
      layer2?: string;
      layer3?: string;
    };

    // 存储中间数据用于迭代
    detailedRules?: string; // 存储规则供未来迭代使用
    controlInstructions?: string; // 控制指令
    gameDescription?: string; // 游戏描述（3-4句话）
    updateDecision?: {
      // 此次迭代更新了什么
      updateCode: boolean;
      updateMap: boolean;
      reasoning: string;
    };
    mergedFrom?: string; // 合并来源版本ID
    mergeStrategy?: string; // 用户描述的合并策略
  };
}

export interface VersionHistory {
  versions: GameVersion[]; // 版本列表（按时间顺序）
  currentVersionId: string | null; // 当前版本ID
}

/**
 * 导出的地图数据格式（用于 map.json 下载）
 */
export interface ExportedMapData {
  mapData: {
    terrain: { grid: Array<{ y: number; row: string }> };
    interaction?: Array<{
      id: string;
      element: string;
      category?: string;
      anchor: { x: number; y: number };
      size?: { width: number; height: number };
    }>;
  };
  schema: {
    meta: {
      map_size: { width: number; height: number };
      tile_size?: number;
      coordinate_system?: string;
    };
    mapping: {
      [char: string]: {
        name: string;
        color: string;
        layer: string;
        category?: string;
        default_size?: { width: number; height: number };
      };
    };
  };
}

// Merge conflict and preview types
export type ConflictType = 'gameConfig' | 'entityConfig' | 'collisionRules' | 'inputMapping' | 'skillRules' | 'aiRules';
export type ConflictSeverity = 'high' | 'medium' | 'low';

export interface MergeConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  entityKey?: string;
  mainValue: any;
  branchValue: any;
  description: string;
}

export interface ConflictResolution {
  conflictId: string;
  strategy: 'useMain' | 'useBranch' | 'merge';
}

export interface MergePreview {
  branchVersionId: string;
  mainVersionId: string;
  llmDifferenceSummary: string;
  conflicts: MergeConflict[];
  autoMerged: string[]; // List of auto-merged LOW severity items
  isLoading: boolean;
  error?: string;
}

export interface MergeStrategyInput {
  userStrategyDescription: string;
  conflictResolutions: ConflictResolution[];
}