/**
 * 简化的提示词服务 - 只包含前4步所需的提示词构建
 */

/**
 * 构建RAG上下文 - 从 GameData 重建 YAML 格式
 */
function buildRAGContext(ragResults: any[]): string {
  return ragResults
    .map((result, index) => {
      const game = result.game;

      let yaml = `### Reference Game ${index + 1}: ${game.name || game.game_id}\n\n`;
      yaml += `game_id: ${game.game_id}\n`;
      yaml += `tags: [${game.tags.join(', ')}]\n`;
      yaml += `view: ${game.view}\n\n`;
      yaml += `gameplay_summary: |\n`;
      const summaryLines = game.gameplay_summary.split('\n');
      summaryLines.forEach(line => {
        yaml += `  ${line}\n`;
      });
      yaml += `\n`;

      const km = game.key_mechanics;
      yaml += `key_mechanics:\n`;

      if (km.player_abilities && km.player_abilities.length > 0) {
        yaml += `  player_abilities:\n`;
        km.player_abilities.forEach(ability => {
          yaml += `    - ${ability}\n`;
        });
        yaml += `\n`;
      }

      if (km.interaction_modes && km.interaction_modes.length > 0) {
        yaml += `  interaction_modes:\n`;
        km.interaction_modes.forEach(mode => {
          yaml += `    - ${mode}\n`;
        });
        yaml += `\n`;
      }

      if (km.enemy_characteristics && km.enemy_characteristics.length > 0) {
        yaml += `  enemy_characteristics:\n`;
        km.enemy_characteristics.forEach(char => {
          yaml += `    - ${char}\n`;
        });
        yaml += `\n`;
      }

      if (km.environment_characteristics && km.environment_characteristics.length > 0) {
        yaml += `  environment_characteristics:\n`;
        km.environment_characteristics.forEach(char => {
          yaml += `    - ${char}\n`;
        });
        yaml += `\n`;
      }

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
function formatSchema(schema: any): string {
  return `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``;
}

/**
 * 提示词服务类
 */
export class PromptService {
  /**
   * 构建描述增强提示词
   */
  buildDescriptionEnhancePrompt(userPrompt: string, ragResults: any[]): string {
    const ragContext = buildRAGContext(ragResults);

    return `# Game Description Enhancement Task

You are a game design documentation expert. The user has provided a brief gameplay description for a 2D action game. Your task is to expand this description into a standardized game annotation format based on reference examples from similar games.

## User's Brief Description
${userPrompt}

## Similar Game Examples (for reference)
${ragContext}

## Tag and View Selection

### Recommended Approach: Extract from Examples
1. **Tags**:
   - Collect all tags from similar game examples
   - Select 2-4 most relevant tags based on user's description
   - Always include \`Arcade\` tag
2. **View**:
   - Use the most frequently appearing view from examples
   - If tied, choose based on user's description

### Available Options (if manual selection needed)

**Tags**:
- Primary: \`Platform\`, \`Shooter\`, \`Beat 'em up\`, \`Fighting\`, \`Maze\`, \`Puzzle\`
- Specialized: \`Shoot 'em up\`, \`Run and Gun\` (combine with \`Shooter\`)
- Required: \`Arcade\` (always include)

**Views**:
- \`frame view\` - Fixed single screen
- \`scroller view\` - Scrolling (horizontal/vertical/both)
- \`top-down view\` - Overhead orthographic
- \`isometric view\` - Angled perspective

## Task Requirements

1. **Preserve Core Intent**: Keep user's original gameplay concept unchanged
2. **Follow Standard Format**: Use exact YAML structure from examples
3. **Add Tactical Depth**: Use pattern: [Action] → [Effect] → [Consequence]
4. **Use Generic Terms**:
   - "character", "enemy", "projectile" (not character names)
   - "craft" not "spaceship", "power-up" not item names
   - Remove all IP references
5. **Be Concrete**:

## Output Format

\\\`\\\`\\\`yaml
game_id: [descriptive_id]
tags: [Tag1, Tag2, Arcade]
view: [frame view / scroller view / top-down view / isometric view]

gameplay_summary: |
  [2-4 sentences describing core gameplay loop]
  [Mention key mechanics and systems]
  [State objective clearly]

key_mechanics:
  player_abilities: [ability1, ability2, ...]
  interaction_modes:
    - [Action] → [Effect]
    - [Action] → [Effect] → [Consequence]
  enemy_characteristics: [behaviors, damage types, defeat conditions]
  environment_characteristics: [terrain, scrolling, special mechanics]
  win_condition: [Clear victory condition]
\\\`\\\`\\\`

## Critical Rules

- **Interaction pattern**: [Action] → [Effect] format
- **No IP references**: Remove character names, franchises, story
- **Universal terms**: "craft" not "spaceship", "enemy" not "alien"
- **Concrete mechanics**: Every action needs clear effect

Please output the YAML annotation directly, without additional explanations.`;
  }

  /**
   * 构建schema生成prompt
   */
  buildSchemaGenerationPrompt(
    enhancedDescription: string,
    ragResults: any[],
    mapInfo: { width: number; height: number }
  ): string {
    return `# Game Element Schema Generation Task

You are a game design expert. Based on the game description, generate a complete element definition Schema for the game.
This Schema will serve as a structural constraint within the game generation process to ensure overall consistency.

---

## Game Description

${enhancedDescription}

---

## CRITICAL: Element Extraction Rules

**ONLY extract elements explicitly mentioned in the user's game description. DO NOT add extra elements from reference games.**

### Minimal Element Set:
Start with the bare minimum:
- **Always include**: \`X\` (space) - required terrain base

---

## Map Layer Architecture

The map uses a two-layer system.
All elements belong to exactly one of two categories: "prop" or "character".

### Layer 1 - Terrain
- Single-tile terrain elements (1×1 grid cells)
- Each character represents exactly one grid cell
- All terrain elements must have category: "prop"

### Layer 2 - Interaction
- Multi-tile objects and characters
- Each element MUST define \`default_size\` as an object containing:
    - width
    - height
- The occupied area MUST form a rectangular grid-aligned region
- Elements in this layer may have "category": "prop" or "character"

---

## Collision System

Every element **MUST** include a \`collision\` field that defines its physical collision behavior.
Allowed four collision types:
- \`prevent\`
- \`passive\`
- \`active\`
- \`fixed\`

No other collision values are permitted under any circumstances.

### Collision Mapping Rules
- Empty space or decorative background → \`prevent\`
- Indestructible walls → \`fixed\`
- Destructible obstacles (block movement before destruction) → \`fixed\`
- Stationary turrets or cannons → \`fixed\`
- Environmental hazards (deal damage but do not block movement) → \`passive\`
- Collectibles, switches, triggers, destructible weak points → \`passive\`
- Player → \`active\`
- Enemy → \`active\`
- NPC → \`active\`
- Movable objects → \`active\`
Fallback rule (if not listed above):
- Blocks movement → \`fixed\`
- Can move or be pushed → \`active\`
- Does not block but triggers interaction → \`passive\`
- Purely visual → \`prevent\`

---

## Element Definition Requirements

### Terrain Elements (layer: "terrain")

**Required fields**:
- \`name\`: Element name
- \`description\`: Brief description of appearance, behavior, and interaction rules
- \`color\`: Hex color code (e.g., "#000000")
- \`collision\`: One of \`"prevent"\`, \`"passive"\`, \`"active"\`, \`"fixed"\` (see Collision System)
- \`layer\`: Must be "terrain"
- \`category\`: Must be "prop"

### Interaction Elements (layer: "interaction")

**Required fields**:
- \`name\`: Element name
- \`description\`: Brief description of appearance, behavior, and interaction rules
- \`color\`: Hex color code (e.g., "#000000")
- \`collision\`: One of \`"prevent"\`, \`"passive"\`, \`"active"\`, \`"fixed"\` (see Collision System)
- \`layer\`: Must be "interaction"
- \`category\`: Either "character" or "prop"
  - \`"character"\`: Entities affected by gravity.
  - \`"prop"\`: Entities not affected by gravity.
- \`default_size\`: Object dimensions
  - \`width\`: Integer grid cells
  - \`height\`: Integer grid cells
  - Must form a rectangle

### Rules:
- Use single uppercase letters (A-Z)
- \`X\` is always space/empty area (reserved, always first)
- Entity Naming Constraints: **Player element name MUST be "player"**, No alternative naming is allowed.
---

## Important Constraints

1. Each element uses exactly ONE uppercase key.
2. No duplicate keys.
3. Clear separation between terrain and interaction layers.
4. All sizes and coordinates must be integers.
5. \`X\` must appear first in mapping.
6. Only explicitly mentioned elements are allowed.

---

## Output Format

Output ONLY the JSON schema.

Do NOT include explanations, comments, or extra text.

The JSON must follow this structure:

\`\`\`json
{
  "mapping": {
      "X": {
          "name": "space",
          "description": "empty area, all entities can pass through freely",
          "color": "#000000",
          "collision": "prevent",
          "layer": "terrain",
          "category": "prop"
      },
      "B": {
          "name": "brick",
          "description": "destructible wall, blocks player/enemy/projectile, can be destroyed by projectile",
          "color": "#9c4a00",
          "collision": "fixed",
          "layer": "terrain",
          "category": "prop"
      },
      "F": {
          "name": "forest",
          "description": "visual cover layer, all entities can pass through, hides player/enemy beneath it visually",
          "color": "#8cd600",
          "collision": "prevent",
          "layer": "terrain",
          "category": "prop"
      },
      "P": {
          "name": "player",
          "description": "player controlled, can move in four directions, fires projectile",
          "color": "#00ff00",
          "collision": "active",
          "layer": "interaction",
          "category": "character",
          "default_size": {
              "width": 2,
              "height": 2
          }
      },
      "N": {
          "name": "enemy",
          "description": "AI controlled enemy, moves and fires automatically, destroyed by player projectile",
          "color": "#ff0000",
          "collision": "active",
          "layer": "interaction",
          "category": "character",
          "default_size": {
              "width": 2,
              "height": 2
          }
      }
  }
}
\`\`\``;
  }

  /**
   * 构建具体规则生成prompt
   */
  buildDetailedRulesPrompt(
    enhancedDescription: string,
    ragResults: any[],
    schema: any,
    mapInfo: { width: number; height: number }
  ): string {
    const ragContext = buildRAGContext(ragResults);
    const schemaJson = formatSchema(schema);

    return `# Detailed Game Rules Generation Task

You are a game design expert. Based on the user's enhanced game description and reference information from similar games, generate a **detailed, structured** game design rules document.

This rules document will guide subsequent map generation and code generation, so it needs to be very specific and executable.

---

## User's Game Description

${enhancedDescription}

---

## Similar Games Reference

${ragContext}

---

## Map Information

- **Size**: ${mapInfo.width} × ${mapInfo.height} cells
- **Type**: 2D platform game map

---

## Map Element Schema

The following schema defines all available game elements:

${schemaJson}

**IMPORTANT**: All entity definitions in your rules MUST use elements defined in this schema.

---

## Task Requirements

1. **Preserve Core Gameplay**: Strictly follow the core gameplay and game type described by the user
2. **Learn from Reference Games**: Extract appropriate mechanics and design patterns from similar games
3. **Structured Output**: Output detailed rules according to the format below
4. **Technical Feasibility**: Ensure all rules can be implemented with a 2D game engine

---

## Output Format Requirements

Please strictly output detailed game rules in the following Markdown format:

### Game Overview

**Game Type**: [Platform game / Shooting game / Puzzle game / etc.]

**Core Gameplay**: [Describe the core gameplay loop in 2-3 sentences]

**Game Objective**: [What goal does the player need to achieve]

---

### Entity Definitions

#### Player Entity

**Name**: player

**Description**: [Description of the player character]

**Spawn Method**: [init spawn / trigger spawn]

**Physics Type**: dynamic

**Movement Mode**: platformer / topdown / custom

**Ability List**:
- [Ability 1]: [Description]
- [Ability 2]: [Description]

**Attributes**:
- Movement Speed: [Value]
- Jump Force: [Value, if applicable]
- Health: [Value, if applicable]

---

#### Terrain Entities

List all terrain elements (such as ground, walls, platforms, etc.)

---

#### Interactive Entities

List all interactive elements (such as props, enemies, mechanisms, etc.)

---

### Game Systems

#### User Input System

**Function**: Handle player input and update PlayerInput component

**IMPORTANT - Control Constraints**:
The game MUST be controlled using a virtual gamepad with the following inputs ONLY:
- **Joystick** (Left side): Provides normalized X/Y values (-1 to 1) for directional movement
- **Button A** (Green, bottom): Primary action (e.g., jump, confirm, attack)
- **Button B** (Red, right): Secondary action (e.g., special ability, cancel)

**Design Principle**: Keep controls simple and intuitive.

**Monitored Inputs**:
- Joystick X/Y: [Map to player movement direction]
- Button A: [Primary action, e.g., jump, shoot]
- Button B: [Secondary action, optional]

---

#### Action System

**Function**: Execute game actions based on PlayerInput

**Handled Actions**:
- [Action 1]: [Implementation logic]
- [Action 2]: [Implementation logic]

---

#### Simulation System

**Function**: Handle simulation logic of the game world

**Included Logic**:
- [Logic 1]: [Description]
- [Logic 2]: [Description]

---

### Collision Rules

List all important collision interactions:

1. **Player vs Terrain**
   - Behavior: [Block/Landing/etc.]
   - Effect: [Specific effect]

2. **Player vs [Entity Type]**
   - Behavior: [Describe collision behavior]
   - Effect: [Specific effect]

---

### Game Mechanics

#### Mechanism 1: [Mechanism Name]

**Description**: [Detailed description of the mechanism]

**Implementation Method**: [How to implement this mechanism]

**Related Entities**: [Which entities are involved]

---

### Victory and Failure Conditions

**Victory Condition**: [How the player wins]

**Failure Condition**: [How the player fails, if any]

**Restart**: [How to restart after failure]

---

### Special Constraints

List any special game rules or constraints:

- [Constraint 1]
- [Constraint 2]

---

## Important Notes

1. **Be Specific**: All descriptions should be concrete, avoid vague statements
2. **Be Executable**: Rules must be directly convertible to code implementation
3. **Be Complete**: Cover all core elements of the game
4. **Reference and Learn**: Make full use of design patterns from similar games
5. **Single Level Only**: Generate rules for ONE complete level, not multiple stages

Please now generate the detailed game rules document, strictly following the above format.`;
  }

  /**
   * 构建游戏描述生成提示词
   */
  buildGameDescriptionPrompt(
    code: any,
    map: any,
    enhancedRules: string
  ): string {
    // 提取关键信息
    const physicsMode = code.gameConfig?.physicsMode || 'unknown';
    const cameraMode = code.gameConfig?.cameraMode || 'unknown';

    // 实体配置摘要
    const entitySummary = Object.entries(code.entityConfig || {})
      .map(([name, config]: [string, any]) => {
        const parts = [];
        if (config.speed) parts.push(`speed ${config.speed}`);
        if (config.health) parts.push(`health ${config.health}`);
        if (config.behavior) parts.push(`behavior ${config.behavior}`);
        if (config.projectileType) parts.push(`projectile ${config.projectileType}`);
        return `- ${name}: ${parts.join(', ') || 'basic config'}`;
      })
      .join('\n');

    // 碰撞规则摘要
    const collisionSummary = (code.collisionRules || [])
      .map((rule: any) => `${rule.a} ↔ ${rule.b}: ${rule.action.join(', ')}`)
      .join('; ');

    // 输入映射
    const inputMapping = Object.entries(code.inputMapping || {})
      .map(([key, action]) => `${key}→${action}`)
      .join(', ');

    // 技能规则摘要
    const skillSummary = (code.skillRules || [])
      .map((rule: any) => `${rule.entity}: [${rule.skills.join(', ')}]`)
      .join('; ') || 'none';

    // AI规则摘要
    const aiSummary = (code.aiRules || [])
      .map((rule: any) => {
        const parts = [];
        if (rule.movementAI) parts.push(`movement ${rule.movementAI}`);
        if (rule.combatAI) parts.push(`combat ${rule.combatAI}`);
        return `${rule.entity}: ${parts.join(', ')}`;
      })
      .join('; ') || 'none';

    // 地图信息
    const terrainRows = map.terrain?.grid?.length || 0;
    const interactionCount = map.interaction?.length || 0;
    const mappingElements = Object.keys(map.mapping || {}).length;

    return `You are a game analyst. Based on the following information, describe in 3-4 concise sentences in English what this game implements:

【Game Configuration】
- Physics Mode: ${physicsMode}
- Camera Mode: ${cameraMode}

【Entity Configuration】
${entitySummary}

【Collision Rules】
${collisionSummary}

【Skill Rules】
${skillSummary}

【AI Rules】
${aiSummary}

【Map Information】
- Terrain Grid: ${terrainRows} rows
- Interactive Elements: ${interactionCount}
- Mapping Elements: ${mappingElements} types

${enhancedRules ? `【Enhanced Rules】\n${enhancedRules}` : ''}

Please summarize the core gameplay, mechanics, and features of this game in 3-4 concise English sentences. Each sentence must appear on a separate line, must end with the newline character '\n'`;
  }
}

// 导出单例实例
export const promptService = new PromptService();
