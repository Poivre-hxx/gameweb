import * as ex from 'excalibur';

/**
 * 1. 游戏模式配置 (LLM 生成的 gameConfig)
 * physicsMode 平台类模式
 * ★ platformer
 * 重力 + 水平（左右）移动 + 跳跃
 * ★ topdown
 * 无重力 + 四方向（上下左右）移动
 * ★ freely
 * 无重力 + 8方向移动
 * 
 * cameraMode 摄像机模式
 * ★ fixed
 * 完全固定，整个地图完全显示在画布内
 * ★ follow
 * 摄像机跟随玩家移动，但是不超出地图边界
 * 未到达地图边界时：player保持在屏幕水平方向30%左右位置（左侧），前方有70%视野
 * 到达地图边界时：摄像机停止，玩家可以在屏幕内自由移动
 * ★ auto-scroll
 * 自动卷轴，水平向右滚动，但是不超出地图边界
 */
export interface GameConfig {
  physicsMode: 'platformer' | 'topdown' | 'freely';
  cameraMode: 'fixed' | 'follow' | 'auto-scroll';
  tileSize?: number;  // 可选，由 PreviewPage 响应式计算
}

/**
 * 2. 实体属性配置 (LLM 生成的 entityConfig)
 * 例如: { "player": { speed: 100, color: "#00ff00" } }
 */
export interface EntityConfig {
  [key: string]: {
    speed?: number;
    health?: number;
    color?: string;
    width?: number;
    height?: number;

    // AI 行为配置
    behavior?: 'chase' | 'patrol' | 'patrol_then_chase';

    // 投射物相关属性
    projectileType?: string; // 例如: 'bullet', 'bomb'
    damage?: number;         // 伤害值
    lifespan?: number;       // 存活时间(毫秒)
    isDestructible?: boolean;// 是否会被相互抵消
  };
}

/**
 * 碰撞方向类型 (a 相对于 b 的位置)
 */
export type CollisionDirection = 'above' | 'below' | 'left' | 'right';

/**
 * 3. 碰撞规则 (LLM 生成的 collisionRules)
 * 例如: { a: 'bullet', b: 'enemy', action: 'destroy_both' }
 */
export interface CollisionRule {
  a: string; // 主动方 (通常是 type 名称)
  b: string; // 被动方
  direction?: CollisionDirection[]; // 可选：碰撞方向（不填则任意方向都触发）
  action: string[]; // 执行的动作列表
}

/**
 * 3.5. 技能规则配置 (LLM 生成的 skillRules)
 * 将配置中的技能名映射到实体的技能方法
 */
export interface SkillRule {
  entity: string;        // 实体名称，如 "player", "enemy"
  skills: string[];      // 技能名称列表，与 EntityWrapper 方法名完全匹配
}

/**
 * 3.6. AI 规则配置 (LLM 生成的 aiRules)
 * 配置实体的 AI 行为
 */
export interface AiRule {
  entity: string;           // 实体名称
  movementAI?: 'chase' | 'patrol' | 'patrol_then_chase' | 'stop';  // 移动AI
  combatAI?: 'aim_attack' | 'random_attack';  // 战斗AI
}

/**
 * 4. 地图数据结构 (对应 JSON 文件)
 */
export interface MapData {
  terrain: {
    grid: { y: number; row: string }[];
  };
  interaction?: Array<{
    id: string;
    category: string;
    element: string;
    anchor: { x: number; y: number };
    size?: { width: number; height: number };
  }>
  mapping: {
    [key: string]: {
      name: string;
      category?: string;
      color?: string;
      sprite?: string;  // 贴图路径（相对于 public 目录，如 /sprites/ground.png）
      description?: string;
      layer?: string;
      collision?: 'prevent' | 'passive' | 'active' | 'fixed';
    };
  };
  meta?: {
    map_size?: { width: number; height: number };
  };
};

/**
 * 5. LLM 生成的完整规则
 */
export interface GameRules {
  gameConfig: GameConfig;
  entityConfig: EntityConfig;
  collisionRules: CollisionRule[];
  inputMapping: Record<string, string>;
  skillRules?: SkillRule[];   // 技能规则配置
  aiRules?: AiRule[];         // AI 规则配置
}