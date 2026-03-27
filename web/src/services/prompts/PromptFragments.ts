
import type { RAGContextInput, PromptFragment } from './types';

/**
 * FRAMEWORK_API
 */
export class PromptFragments {
  static getFrameworkAPIDoc(): PromptFragment {
    return `# Framework API Reference

## World Class Methods

Create entity:
world.createEntity()
Returns entity ID number

Destroy entity:
world.destroyEntity(eid)
world.markForDestruction(eid)
world.processDestructions()

Component operations:
world.addComponent(eid, 'Position', { x: 0, y: 0 })
world.getComponent(eid, 'Position')
world.hasComponent(eid, 'Position')
world.removeComponent(eid, 'Position')

Query entities (MUST use double brackets):
for (const [eid, [pos, vel]] of world.query('Position', 'Velocity')) {
  pos.x += vel.vx * deltaTime
}

---

## Components

Position:
{ x: 100, y: 200 }

Velocity:
{ vx: 0, vy: 0 }

Size:
{ width: 32, height: 32 }

Sprite:
{ color: [255, 0, 0], layer: 1 }

Tag:
{ category: 'character', type: 'player' }

RigidBody:
{ bodyType: 'static', gravityScale: 1 }
bodyType options: 'static' 'dynamic' 'kinematic'

Collider:
{ shapeType: 'box', width: 32, height: 32, radius: 0, density: 1.0, friction: 0.3, restitution: 0, isSensor: false }
shapeType options: 'box' 'circle'

GroundedFlag:
{ isGrounded: false, groundContactCount: 0 }

ActionIntent:
{ moveDirection: [0, 0], action: 'idle', actionParams: {} }
action options: 'idle' 'move' 'action1' 'action2' 'action3' 'action4'
CRITICAL: actionParams MUST be initialized to {} (empty object)
When accessing, use: const params = intent.actionParams || {}

---

## SystemBase Methods

Your systems extend SystemBase:

class YourSystem extends SystemBase {
  constructor(world) {
    super(world)
  }
  onCreate() {}
  onUpdate(deltaTime) {}
}

Physics helpers:
this.setVelocity(eid, vx, vy)
this.getVelocity(eid)
this.applyForce(eid, fx, fy)
this.applyImpulse(eid, ix, iy)
this.isGrounded(eid)
this.getMass(eid)
this.setGravityScale(eid, scale)

---

## Required Code Structure

class EntityFactory {
  constructor(world) {
    this.world = world
  }

  create_wall(x, y, color = [100, 100, 100]) {
    const eid = this.world.createEntity()
    this.world.addComponent(eid, 'Position', { x, y })
    this.world.addComponent(eid, 'Size', { width: 32, height: 32 })
    this.world.addComponent(eid, 'Sprite', { color, layer: 0 })
    this.world.addComponent(eid, 'Tag', { category: 'terrain', type: 'wall' })
    this.world.addComponent(eid, 'RigidBody', { bodyType: 'static', gravityScale: 1 })
    this.world.addComponent(eid, 'Collider', { shapeType: 'box', width: 32, height: 32, radius: 0, density: 0, friction: 0.3, restitution: 0, isSensor: false })
    return eid
  }

  create_player(x, y, width = 32, height = 32, color = [255, 255, 0]) {
    const eid = this.world.createEntity()
    this.world.addComponent(eid, 'Position', { x, y })
    this.world.addComponent(eid, 'Size', { width, height })
    this.world.addComponent(eid, 'Sprite', { color, layer: 1 })
    this.world.addComponent(eid, 'Tag', { category: 'character', type: 'player' })
    this.world.addComponent(eid, 'RigidBody', { bodyType: 'dynamic', gravityScale: 1 })
    this.world.addComponent(eid, 'Collider', { shapeType: 'box', width, height, radius: 0, density: 1.0, friction: 0.3, restitution: 0, isSensor: false })
    this.world.addComponent(eid, 'ActionIntent', { moveDirection: [0, 0], action: 'idle', actionParams: {} })
    this.world.addComponent(eid, 'Velocity', { vx: 0, vy: 0 })
    this.world.addComponent(eid, 'GroundedFlag', { isGrounded: false, groundContactCount: 0 })
    return eid
  }

  create_enemy(x, y, width = 32, height = 32, color = [255, 0, 0]) {
    const eid = this.world.createEntity()
    this.world.addComponent(eid, 'Position', { x, y })
    this.world.addComponent(eid, 'Size', { width, height })
    this.world.addComponent(eid, 'Sprite', { color, layer: 1 })
    this.world.addComponent(eid, 'Tag', { category: 'character', type: 'enemy' })
    this.world.addComponent(eid, 'RigidBody', { bodyType: 'dynamic', gravityScale: 1 })
    this.world.addComponent(eid, 'Collider', { shapeType: 'box', width, height, radius: 0, density: 0.8, friction: 0.3, restitution: 0, isSensor: false })
    this.world.addComponent(eid, 'Velocity', { vx: -50, vy: 0 })
    return eid
  }

  create_bullet(x, y, direction) {
    const eid = this.world.createEntity()
    this.world.addComponent(eid, 'Position', { x, y })
    this.world.addComponent(eid, 'Size', { width: 8, height: 8 })
    this.world.addComponent(eid, 'Sprite', { color: [255, 255, 0], layer: 2 })
    this.world.addComponent(eid, 'Tag', { category: 'projectile', type: 'bullet' })
    // CRITICAL: Use Matter.js physics - RigidBody + Collider for collision detection
    this.world.addComponent(eid, 'RigidBody', { bodyType: 'kinematic', gravityScale: 0 })
    this.world.addComponent(eid, 'Collider', {
      shapeType: 'circle',
      width: 0, height: 0, radius: 4,
      density: 0, friction: 0, restitution: 0,
      isSensor: true  // Sensor: detect collision without physical response
    })
    this.world.addComponent(eid, 'Velocity', { vx: direction[0] * 300, vy: direction[1] * 300 })
    return eid
  }
}

class ActionSystem extends SystemBase {
  constructor(world, factory) {
    super(world)
    this.factory = factory
  }

  onCreate() {}

  onUpdate(deltaTime) {
    const bulletsToCreate = []

    for (const [eid, [tag, intent, vel]] of this.world.query('Tag', 'ActionIntent', 'Velocity')) {
      if (tag.type !== 'player') continue

      // CRITICAL: Use defensive programming for actionParams
      const params = intent.actionParams || {}

      if (intent.action === 'move') {
        const [dx, dy] = intent.moveDirection
        const speed = params.speed || 200
        vel.vx = dx * speed
        vel.vy = dy * speed
      }

      if (intent.action === 'jump' && this.isGrounded(eid)) {
        this.applyImpulse(eid, 0, params.force || -400)
      }

      if (intent.action === 'shoot') {
        const pos = this.world.getComponent(eid, 'Position')
        bulletsToCreate.push({ x: pos.x, y: pos.y, dir: [1, 0] })
      }
    }

    for (const bullet of bulletsToCreate) {
      this.factory.create_bullet(bullet.x, bullet.y, bullet.dir)
    }
  }
}

class SimulationSystem extends SystemBase {
  onCreate() {}

  onUpdate(deltaTime) {
    for (const [eid, [pos, vel]] of this.world.query('Position', 'Velocity')) {
      pos.x += vel.vx * deltaTime
      pos.y += vel.vy * deltaTime
    }

    for (const [eid, [pos]] of this.world.query('Position')) {
      if (pos.x < -100 || pos.x > 1000 || pos.y > 800) {
        this.world.markForDestruction(eid)
      }
    }

    // Example: Enemy AI with defensive programming
    for (const [eid, [tag, intent]] of this.world.query('Tag', 'ActionIntent')) {
      if (tag.type !== 'enemy') continue

      // CRITICAL: Always check actionParams exists before accessing
      const params = intent.actionParams || {}
      let timer = params.timer || 0
      timer -= deltaTime

      // Update safely - ensure actionParams exists
      intent.actionParams = intent.actionParams || {}
      intent.actionParams.timer = timer
    }

    this.world.processDestructions()
  }
}

function createGameSystems(world, factory) {
  return [
    new ActionSystem(world, factory),
    new SimulationSystem(world)
  ]
}

---

## Component Requirements

All visible entities need:
Position Size Sprite Tag

Player needs:
Position Size Sprite Tag ActionIntent Velocity GroundedFlag RigidBody Collider

Static terrain needs:
Position Size Sprite Tag RigidBody Collider
RigidBody bodyType must be 'static'

Dynamic enemies need:
Position Size Sprite Tag RigidBody Collider Velocity
RigidBody bodyType must be 'dynamic'

Projectiles need:
Position Size Sprite Tag RigidBody Collider Velocity
RigidBody bodyType must be 'kinematic'

---

## Critical Rules

MUST use double bracket query:
for (const [eid, [pos, vel]] of world.query('Position', 'Velocity'))

MUST store world in constructor:
constructor(world) {
  this.world = world
}

MUST collect then create entities:
const toCreate = []
for (const [eid, [comp]] of this.world.query('Component')) {
  toCreate.push(data)
}
for (const data of toCreate) {
  this.factory.create_something(data)
}

MUST mark then process destruction:
for (const [eid, [pos]] of this.world.query('Position')) {
  if (condition) this.world.markForDestruction(eid)
}
this.world.processDestructions()

DO NOT generate:
UserInputSystem
PhysicsSystem
RenderSystem
Collision detection code (use CollisionRuleEngine instead)
Import export statements

MUST generate:
EntityFactory with all create methods
ActionSystem reading ActionIntent
SimulationSystem with game logic
createGameSystems function

---

## CollisionRuleEngine (Declarative Collision Handling)

Use CollisionRuleEngine for collision rules instead of manual AABB detection:

\`\`\`javascript
class SimulationSystem extends SystemBase {
  onCreate() {
    this.collisionEngine = new CollisionRuleEngine(this, [
      { entityA: 'player', entityB: 'coin', actions: ['destroy_b'] },
      { entityA: 'bullet', entityB: 'enemy', actions: ['destroy_a', 'destroy_b'] },
      { entityA: 'player', entityB: 'enemy', direction: 'top', actions: ['destroy_b', 'bounce_a'] }
    ])
  }

  handleCollision(eid1, tag1, eid2, tag2, direction) {
    this.collisionEngine.handle(eid1, tag1, eid2, tag2, direction)
  }
}
\`\`\`

Available actions: destroy_a, destroy_b, bounce_a, bounce_b, reverse_a, reverse_b, stop_a, stop_b
`;
  }

  /**
   * 格式化地图信息为Markdown表格
   */
  static formatMapInfo(mapData: any): PromptFragment {
    const mapping = mapData?.schema?.mapping || {};

    // 从实际的 terrain grid 读取地图尺寸,不依赖 schema 中的硬编码
    const width = mapData?.terrain?.grid?.[0]?.row?.length || 0;
    const height = mapData?.terrain?.grid?.length || 0;
    const tileSize = 32;  // 固定值,实际渲染时会根据 canvas 窗口动态计算

    let result = '## Map Configuration\n\n';
    result += `### Map Dimensions\n`;
    result += `- Width: ${width} tiles\n`;
    result += `- Height: ${height} tiles\n`;
    result += `- Tile Size: ${tileSize}px (base size, will be dynamically scaled to fit canvas)\n\n`;

    // Game Entities - 按照 category 分类，不暴露 layer 技术概念
    result += `### Game Entities\n\n`;
    result += `You need to implement factory methods for the following entities:\n\n`;

    // 收集所有实体并按 category 分类
    const props: Array<{ name: string, defaultSize?: any }> = [];
    const characters: Array<{ name: string, defaultSize?: any }> = [];

    for (const [key, info] of Object.entries(mapping)) {
      const layer = (info as any).layer || 'unknown';
      if (layer === 'terrain' || layer === 'interaction') {
        const name = (info as any).name || key;
        const category = (info as any).category || 'prop'; // terrain 默认为 prop
        const defaultSize = (info as any).default_size;

        const entity = { name, defaultSize };

        if (category === 'character') {
          characters.push(entity);
        } else {
          props.push(entity);
        }
      }
    }

    // 输出 Props
    if (props.length > 0) {
      result += `**Props (Static/Interactive Objects):**\n`;
      result += `| Element Name | Factory Method |\n`;
      result += `|--------------|----------------|\n`;

      for (const prop of props) {
        const factoryName = `create_${prop.name.replace(/\s+/g, '_')}`;
        // 根据是否有 defaultSize 判断签名
        const signature = prop.defaultSize
          ? `${factoryName}(x, y, width?, height?, color?)`
          : `${factoryName}(x, y, color?)`;
        result += `| ${prop.name} | \`${signature}\` |\n`;
      }
      result += `\n`;
    }

    // 输出 Characters
    if (characters.length > 0) {
      result += `**Characters (Moving Entities):**\n`;
      result += `| Element Name | Factory Method |\n`;
      result += `|--------------|----------------|\n`;

      for (const char of characters) {
        const factoryName = `create_${char.name.replace(/\s+/g, '_')}`;
        const signature = char.defaultSize
          ? `${factoryName}(x, y, width?, height?, color?)`
          : `${factoryName}(x, y, color?)`;
        result += `| ${char.name} | \`${signature}\` |\n`;
      }
      result += `\n`;
    }

    // 添加说明
    result += `**Notes:**\n`;
    result += `- Single-tile entities use signature: \`create_<name>(x, y, color?)\`\n`;
    result += `- Multi-tile entities use signature: \`create_<name>(x, y, width?, height?, color?)\`\n`;
    result += `- The map will be automatically rendered by the framework using these factory methods\n`;

    return result;
  }

  /**
   * 从游戏规则中提取碰撞提示
   */
  static extractCollisionHints(rules: string): PromptFragment {
    let hints = '\n## Collision Hints (Extracted from Game Rules)\n\n';

    // 检测常见碰撞模式
    const patterns = [
      {
        regex: /player.*stomp|stomp.*enemy|jump.*on.*enemy|踩.*敌人|踩踏/i,
        hint: '- **Player stomps enemy**: Use `{ entityA: \'player\', entityB: \'enemy\', direction: \'top\', actions: [\'destroy_b\', \'bounce_a\'] }`'
      },
      {
        regex: /collect.*coin|pick.*up.*coin|获取.*金币|收集.*金币/i,
        hint: '- **Player collects coin**: Use `{ entityA: \'player\', entityB: \'coin\', actions: [\'destroy_b\'] }`'
      },
      {
        regex: /bullet.*hit|bullet.*destroy|子弹.*击中|子弹.*摧毁/i,
        hint: '- **Bullet hits enemy**: Use `{ entityA: \'bullet\', entityB: \'enemy\', actions: [\'destroy_a\', \'destroy_b\'] }`'
      },
      {
        regex: /enemy.*reverse|enemy.*turn|bounce.*wall|敌人.*反向|敌人.*转向/i,
        hint: '- **Enemy reverses at wall**: Use `{ entityA: \'enemy\', entityB: \'wall\', direction: \'left\', actions: [\'reverse_a\'] }` and similar for \'right\''
      },
      {
        regex: /player.*die|player.*death|game.*over|玩家.*死亡|游戏.*结束/i,
        hint: '- **Player dies on contact**: Use `{ entityA: \'player\', entityB: \'enemy\', actions: [\'destroy_a\'] }` (but check direction to avoid stomp case)'
      },
      {
        regex: /spring|bounce.*pad|弹簧|弹跳/i,
        hint: '- **Spring bounce**: Use custom handler with `applyImpulse(eidA, 0, -600)` for strong upward bounce'
      },
      {
        regex: /power.*up|item|道具|增益/i,
        hint: '- **Player collects power-up**: Use `{ entityA: \'player\', entityB: \'powerup\', actions: [\'destroy_b\'] }` + custom handler for effect'
      }
    ];

    let foundAny = false;
    for (const pattern of patterns) {
      if (pattern.regex.test(rules)) {
        hints += pattern.hint + '\n';
        foundAny = true;
      }
    }

    if (!foundAny) {
      hints += '- No specific collision patterns detected. Implement collision logic based on game rules.\n';
    }

    hints += '\n**Reminder**: Use CollisionRuleEngine for declarative collision handling to reduce code complexity.\n';

    return hints;
  }

  /**
   * 构建RAG上下文 - 从 GameData 重建 YAML 格式
   */
  static buildRAGContext(input: RAGContextInput): PromptFragment {
    const { ragResults } = input;

    return ragResults
      .map((result, index) => {
        const game = result.game;

        // 标题（不包含相似度）
        let yaml = `### Reference Game ${index + 1}: ${game.name || game.game_id}\n\n`;

        // game_id
        yaml += `game_id: ${game.game_id}\n`;

        // tags
        yaml += `tags: [${game.tags.join(', ')}]\n`;

        // view
        yaml += `view: ${game.view}\n\n`;

        // gameplay_summary (多行文本块)
        yaml += `gameplay_summary: |\n`;
        const summaryLines = game.gameplay_summary.split('\n');
        summaryLines.forEach(line => {
          yaml += `  ${line}\n`;
        });
        yaml += `\n`;

        // key_mechanics
        yaml += `key_mechanics:\n`;

        const km = game.key_mechanics;

        // player_abilities
        if (km.player_abilities && km.player_abilities.length > 0) {
          yaml += `  player_abilities:\n`;
          km.player_abilities.forEach(ability => {
            yaml += `    - ${ability}\n`;
          });
          yaml += `\n`;
        }

        // interaction_modes
        if (km.interaction_modes && km.interaction_modes.length > 0) {
          yaml += `  interaction_modes:\n`;
          km.interaction_modes.forEach(mode => {
            yaml += `    - ${mode}\n`;
          });
          yaml += `\n`;
        }

        // enemy_characteristics
        if (km.enemy_characteristics && km.enemy_characteristics.length > 0) {
          yaml += `  enemy_characteristics:\n`;
          km.enemy_characteristics.forEach(char => {
            yaml += `    - ${char}\n`;
          });
          yaml += `\n`;
        }

        // environment_characteristics
        if (km.environment_characteristics && km.environment_characteristics.length > 0) {
          yaml += `  environment_characteristics:\n`;
          km.environment_characteristics.forEach(char => {
            yaml += `    - ${char}\n`;
          });
          yaml += `\n`;
        }

        // win_condition
        if (km.win_condition) {
          yaml += `  win_condition: ${km.win_condition}\n`;
        }

        return yaml;
      })
      .join('\n---\n\n');
  }

  /**
   * 格式化Schema为JSON代码块
   */
  static formatSchema(schema: any): PromptFragment {
    return `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``;
  }
}
