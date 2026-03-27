import type { MapData, GameRules } from '../game/core/types';

/**
 * 解析地图数据
 * 数据来源 1: LLM 生成的 Map JSON
 */
export function parseMapData(input: string | object): MapData {
  try {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    
    // 简单的结构校验 (防止 LLM 生成错误的格式炸掉引擎)
    if (!data.mapData || !data.mapData.terrain) {
      throw new Error("Invalid MapData: missing 'mapData.terrain'");
    }
    
    return data as MapData;
  } catch (e) {
    console.error("Failed to parse MapData:", e);
    // 返回一个空地图或抛出错误，视需求而定
    throw e;
  }
}

/**
 * 解析游戏规则
 * 数据来源 2: LLM 生成的 Rules JSON/Code
 */
export function parseGameRules(input: string | object): GameRules {
  try {
    const rules = typeof input === 'string' ? JSON.parse(input) : input;
    
    // 校验必要字段
    if (!rules.gameConfig || !rules.entityConfig) {
      throw new Error("Invalid GameRules: missing config sections");
    }

    return rules as GameRules;
  } catch (e) {
    console.error("Failed to parse GameRules:", e);
    throw e;
  }
}