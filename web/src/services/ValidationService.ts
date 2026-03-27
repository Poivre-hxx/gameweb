/**
 * 验证服务 - 验证生成的游戏代码
 * 包括工厂方法完整性检查和运行时验证
 */

import type { GameRules } from "../game/core/types";

export interface ValidationResult {
  success: boolean;
  errors: string[];
  ParsedRules?: GameRules;
}

/**
 * 验证服务类
 * 负责验证生成的游戏配置json内容
 */
export class ValidationService {
  /**
   * 验证生成配置
   * @param code 游戏规则对象 (GameRules)
   * @param mapData 地图数据 (json)
   */
  async validate(code: GameRules, mapData: any): Promise<ValidationResult> {
    const errors: string[] = [];

    // 1. 检查对象是否有效
    if (!code || typeof code !== 'object') {
      return {
        success: false,
        errors: ['游戏规则对象无效']
      };
    }

    // 2. 核心字段完整性检查 (Schema Check)
    this.validateSchema(code, errors);

    // 如果结构都错了，就没必要查逻辑了
    if (errors.length > 0) {
      return { success: false, errors };
    }

    // 3. 逻辑一致性检查 (Logic Consistency Check)
    // 确保生成的规则和地图里的东西对得上
    if (mapData && code) {
      this.validateConsistency(code, mapData, errors);
    }

    return {
      success: errors.length === 0,
      errors,
      parsedRules: errors.length === 0 ? code : undefined
    };
  }

  /**
    * 辅助：清洗 JSON 字符串 (去掉 Markdown 代码块标记)
    */
  private cleanJsonString(str: string): string {
    // 移除 ```json 和 ``` 包裹
    let cleaned = str.replace(/```json/g, '').replace(/```/g, '').trim();
    return cleaned;
  }

  /**
   * 步骤 2: 验证数据结构
   */
  private validateSchema(rules: any, errors: string[]) {
    // A. GameConfig
    if (!rules.gameConfig) {
      errors.push("缺少 'gameConfig' 配置项");
    } else {
      if (!rules.gameConfig.tileSize) {
        errors.push("gameConfig.tileSize 缺失");
      }
    }

    // B. EntityConfig
    if (!rules.entityConfig || typeof rules.entityConfig !== 'object') {
      errors.push("缺少 'entityConfig' 配置项");
    }

    // C. InputMapping
    if (!rules.inputMapping) {
      errors.push("缺少 'inputMapping' 配置项");
    }

    // D. CollisionRules
    if (!Array.isArray(rules.collisionRules)) {
      errors.push("'collisionRules' 必须是一个数组");
    }
  }

  /**
   * 步骤 3: 验证业务逻辑一致性
   * 比如：地图里有个敌人叫 'boss'，但规则里没配置 'boss' 的血量
   */
  private validateConsistency(rules: GameRules, mapData: any, errors: string[]) {
    const mapping = mapData?.schema?.mapping || {};

    // 3.1 检查地图实体是否都有配置
    for (const [key, info] of Object.entries(mapping)) {
      const name = (info as any).name;
      const category = (info as any).category;

      // 我们只关心 Character (动的东西)，墙壁等静态物体可以没有 config
      if (category === 'character' || category === 'enemy' || name === 'player') {
        if (!rules.entityConfig[name]) {
          errors.push(`地图中存在实体 '${name}'，但 entityConfig 中未定义其属性`);
        }
      }
    }

    // 3.2 检查子弹引用是否有效
    for (const [entityName, config] of Object.entries(rules.entityConfig)) {
      if (config.projectileType) {
        // 如果引用了子弹，那么子弹本身也必须在 entityConfig 里定义
        if (!rules.entityConfig[config.projectileType]) {
          errors.push(`实体 '${entityName}' 发射的子弹类型 '${config.projectileType}' 未在 entityConfig 中定义`);
        }
      }
    }

    // 3.3 检查碰撞规则里的名字是否存在
    rules.collisionRules.forEach((rule, idx) => {
      if (!rule.a || !rule.b) {
        errors.push(`第 ${idx + 1} 条碰撞规则缺少 'a' 或 'b'`);
      }
      if (!rule.action || !Array.isArray(rule.action)) {
        errors.push(`第 ${idx + 1} 条碰撞规则的 'action' 必须是数组`);
      }
    });
  }
}

export const validationService = new ValidationService();