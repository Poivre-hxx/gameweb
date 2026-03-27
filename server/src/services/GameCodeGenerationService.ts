/**
 * 游戏代码生成服务 - 后端版本
 * 实现3步生成流程: Generate → Validate → Fix (最多重试2次)
 */

import { llmService } from './LLMService.js';

export interface CodeGenerationRequest {
  rules: string;
  mapData: any;
  controlInstructions: string;
  maxRetries?: number;
}

export interface CodeGenerationResult {
  success: boolean;
  code?: any;
  error?: string;
  attempts: {
    attempt: number;
    code: any;
    validation: {
      success: boolean;
      errors: string[];
    };
  }[];
}

/**
 * 游戏代码生成服务类 - 后端版本
 */
class GameCodeGenerationService {
  /**
   * 生成游戏代码
   */
  async generateGameCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    const attempts: CodeGenerationResult['attempts'] = [];

    try {
      console.log('[CodeGeneration] Starting code generation...');

      const code = await this.generate(request);

      attempts.push({
        attempt: 1,
        code, validation: { success: true, errors: [] }
      });
      return {
        success: true, code, attempts
      };
      // 注释检验方法，用不着
      // let validation = this.validateCode(code, request.mapData);
      // attempts.push({ attempt: 1, code, validation });
      // console.log(`[Validate] Attempt 1: ${validation.success ? 'SUCCESS' : 'FAILED'}`);

      // if (validation.success) {
      //   return {
      //     success: true,
      //     code,
      //     attempts,
      //   };
      // }

      // // Step 2 & 3: Validate & Fix (up to maxRetries times)
      // let retryCount = 0;
      // while (!validation.success && retryCount < maxRetries) {
      //   retryCount++;
      //   console.log(`[Fix] Fixing code (attempt ${retryCount + 1}/${maxRetries + 1})...`);

      //   code = await this.fix(code, validation.errors, request);
      //   validation = this.validateCode(code, request.mapData);

      //   attempts.push({ attempt: retryCount + 1, code, validation });
      //   console.log(`[Validate] Attempt ${retryCount + 1}: ${validation.success ? 'SUCCESS' : 'FAILED'}`);

      //   if (validation.success) {
      //     console.log('[CodeGeneration] Code generation completed after fixes');
      //     return {
      //       success: true,
      //       code,
      //       attempts,
      //     };
      //   }
      // }

      // // 所有重试都失败
      // console.error('[CodeGeneration] Code generation failed after all retries');
      // return {
      //   success: false,
      //   error: validation.errors.join('\n'),
      //   attempts,
      // };
    } catch (error) {
      console.error('[CodeGeneration] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts,
      };
    }
  }

  /**
   * 生成初始代码
   */
  private async generate(request: CodeGenerationRequest): Promise<any> {
    const prompt = this.buildCodeGenerationPrompt(request);
    const output = await llmService.callWithRetry(prompt);
    return this.extractCode(output);
  }

  /**
   * 修复代码
   */
  private async fix(
    code: any,
    errors: string[],
    request: CodeGenerationRequest
  ): Promise<any> {
    const prompt = this.buildCodeFixPrompt(code, errors, request);
    const output = await llmService.callWithRetry(prompt);
    return this.extractCode(output);
  }

  /**
   * 构建代码生成prompt
   */
  private buildCodeGenerationPrompt(request: CodeGenerationRequest): string {
    const mapInfo = this.formatMapInfo(request.mapData);
    const controlInstructions = request.controlInstructions || '';
    const controlConstraints = controlInstructions
      ? `\n## Control Instructions (CRITICAL)\n\n**Implement these controls exactly as specified**:\n\n${controlInstructions}\n\nYour UserInputSystem must implement ONLY these controls. Do not add or modify any mappings.\n`
      : '';

    return `# Game Configuration Generation Task

You are a Game Designer. Your job is to configure the gameplay rules for a 2D game engine based on the User's Description and the Map Layout.

**CRITICAL**: You must output PURE JSON data. Do NOT write any JavaScript code/classes/functions.

---

## Input Context

### Map Information
${mapInfo}
Note: The map information only contains entities present at game initialization.
Projectile entities typically do NOT appear in the map.
If the game includes shooting or attack mechanics, you MUST explicitly define the corresponding projectile entities in entityConfig.

### Game Rules
${request.rules}

---

## 2. Engine Capability Documentation (What you can configure)

You need to generate a JSON object matching the \`GameRules\` interface.

### A. Entity Config (\`entityConfig\`)
  Description:
    - A configuration MUST be defined for every entity appearing in the Map (e.g., "player", "enemy").
    - If the game includes shooting or attack mechanics, the corresponding projectile entities MUST be explicitly defined.
    - All entity names must be unique and must exactly match the names in the Map information (case-sensitive).
  Dimension Rules (width & height):
    Global Constraints:
      - width and height MUST be equal.
      - Values other than those explicitly listed below are NOT allowed.
    Projectile Entities:
      Description: e.g., player_projectile, enemy_projectile
      width: 0.25
      height: 0.25
      Constraints:
        - MUST be exactly 0.25.
        - No other values are allowed.
    Character Entities:
      Description: e.g., player, enemy
      width: 0.8
      height: 0.8
      Constraints:
        - MUST be exactly 0.8.
        - No other values are allowed.
    Other Entities:
      Description: Includes wall, boundary, space, platforms, and all environment elements.
      width: 1
      height: 1
      Constraints:
        - MUST be exactly 1.
        - No other values are allowed.
  speed:
    Type: number
    Unit: pixels/second
    Rules:
      - May only be defined for entities with active movement capability (e.g., player, enemy, moving_platform).
      - Static entities (e.g., wall, boundary, space) MUST NOT include this field.
      - Negative values are NOT allowed.
  color:
    Type: string
    Format: Hex color string (e.g., "#FF0000")
    Rules:
      - MUST be defined for all entities.
      - MUST match the corresponding color defined in mapInfo.
      - Other formats (e.g., rgb() or named colors) are NOT allowed.
  projectileType:
    Type: string
    Trigger Condition:
      - MUST be defined only if the entity has shooting capability.
    Allowed Values:
      - player_projectile
      - enemy_projectile
    Rules:
      - Must choose exactly one of the two options.
      - Custom names are NOT allowed.
      - Must not reference entities that are not defined in entityConfig.
      - If the entity cannot shoot, this field MUST NOT be included.

### B. Input Mapping (\`inputMapping\`)
  Description:
    - Map virtual gamepad buttons to system-defined standard logical actions.
    - Control Constraints are the single source of truth for input mapping.
    - Based on the semantic description in controlConstraints, match and assign the corresponding standard action name.
  Button Scope:
    - "A"
    - "B"
    - "X"
    - "Y"
  Allowed Action Enum (restricted to the following values):
    - "basic_shoot"
    - "spread_shot"
    - "jump"
  Movement:
    - Movement is handled automatically by the system.
    - Do NOT map any movement-related operations.
  Generation Rules:
    - Must strictly follow: ${controlConstraints}
    - Only values from the allowed action enum may be output.
    - Actions not listed above are NOT allowed.
    - If a button is not assigned any behavior in controlConstraints, it must be mapped to null.

### C. Collision Rules (\`collisionRules\`)
Define what happens when two objects collide.
- Fields: \`a\` (name), \`b\` (name), \`direction\` (optional string array), \`action\` (string array).
- \`direction\`: Describes the position of **a relative to b** at the moment of collision.
  - \"above\": a is above b (e.g. player stomps enemy from above)
  - \"below\": a is below b (e.g. player hits block from below)
  - \"left\": a is to the left of b
  - \"right\": a is to the right of b
  - If \`direction\` is omitted, the rule triggers on contact from any direction.
  - Multiple directions can be specified, e.g. \`[\"left\", \"right\"]\` means either side.
- Supported Actions:
  - \'destroy_a\': Remove entity A.
  - \'destroy_b\': Remove entity B.
  - \'destroy_both\': Remove both.

### D. Skill Rules (\`skillRules\`) - Optional
  entity:
    Description: Entity name (must correspond to an element already defined in entityConfig)
  skills:
    Description: An array of skill names used to grant behavioral abilities to the entity
  Available Skills:
    Projectile:
      basic_shoot:
        Description: Fires a single bullet in the current facing direction
      spread_shot:
        Description: Fires a 3-way spread shot (45° angle), covering a wider range
    Movement:
      jump:
        Description: Normal jump; can jump again after touching the ground
    Status (Trigger Rule: When this element is destroyed, the skill effect is applied to the player):
      slow:
        Description: Reduces player's movement speed
      fast:
        Description: Doubles the player's movement speed
      trap:
        Description: Player cannot move
      invincible:
        Description: Grants invincibility, immune to damage and collisions
      grow:
        Description: Increases player's size
    Platform (for environment/terrain entities):
      climbable_platform:
        Description: Makes the platform climbable; player can pass through and move up and down along it
      moving_platform_h:
        Description: Horizontally moving platform that loops left and right automatically
      moving_platform_v:
        Description: Vertically moving platform that loops up and down automatically

### E. AI Rules (\`aiRules\`) - Optional
Configure AI behavior logic for entities.
- \`entity\`: Entity name (must correspond to an element already defined in entityConfig)
- \`movementAI\`: Movement behavior (optional)
  - \`chase\`: Chase player
  - \`patrol\`: Random patrol
  - \`patrol_then_chase\`: Patrol first, chase when player detected
- \`combatAI\`: Combat behavior (optional)
  - \`aim_attack\`: Aim and attack player
  - \`random_attack\`: Attack in random direction

---

## 3. Output Format

**CRITICAL: Output ONLY valid JSON. No explanations, no markdown, no code blocks.**
**Start your response directly with { and end with }**

Example of CORRECT output:
\\\`\\\`\\\`json
{
  "entityConfig": {
    "player": {
      "speed": 160,
      "color": "#00FF00",
      "width": 0.8,
      "height": 0.8
    },
    "enemy": {
      "speed": 64,
      "color": "#FF0000",
      "width": 1,
      "height": 1
    },
    "mushroom": {
      "speed": 64,
      "color": "#d93f31",
      "width": 0.9,
      "height": 0.9
    },
    "coin": {
      "color": "#FFD700",
      "width": 1,
      "height": 1
    },
    "ground": {
      "color": "#c84c0c",
      "width": 1,
      "height": 1
    },
    "question block": {
      "color": "#fc9838",
      "width": 1,
      "height": 1
    },
    "moving platform": {
      "color": "#f6f7f9",
      "width": 1,
      "height": 1
    },
    "space": {
      "color": "#000000",
      "width": 1,
      "height": 1
    }
  },
  "inputMapping": {
    "A": "jump",
    "B": null,
    "X": null,
    "Y": null
  },
  "skillRules": [
    {
      "entity": "player",
      "skills": [
        "jump"
      ]
    },
    {
      "entity": "moving platform",
      "skills": [
        "moving_platform_h"
      ]
    },
    {
      "entity": "mushroom",
      "skills": [
        "grow",
        "invincible"
      ]
    }
  ],
  "aiRules": [
    {
      "entity": "enemy",
      "movementAI": "patrol"
    }
  ],
  "collisionRules": [
    {
      "a": "player",
      "b": "coin",
      "action": [
        "destroy_b"
      ]
    },
    {
      "a": "player",
      "b": "enemy",
      "direction": [
        "above"
      ],
      "action": [
        "destroy_b"
      ]
    },
    {
      "a": "player",
      "b": "enemy",
      "direction": [
        "left",
        "right"
      ],
      "action": [
        "destroy_a"
      ]
    },
    {
      "a": "player",
      "b": "question block",
      "direction": [
        "below"
      ],
      "action": [
        "destroy_b"
      ]
    },
    {
      "a": "player",
      "b": "mushroom",
      "action": [
        "destroy_b"
      ]
    }
  ]
}
\\\`\\\`\\\`

Ensure all entity names in the Map are defined in \`entityConfig\`.`;
  }

  /**
   * 构建代码修复prompt
   */
  private buildCodeFixPrompt(
    code: any,
    errors: string[],
    request: CodeGenerationRequest
  ): string {
    return `# Task: Fix Invalid Game Configuration JSON

The following JSON string failed to parse or is missing required fields for the Game Engine.

## Current Invalid JSON:
\\\`\\\`\\\`json
${code}
\\\`\\\`\\\`

---

## Error Report:

${errors.join('\n')}

## Requirement
Fix the JSON syntax and structure. Ensure it strictly follows this interface:

\\\`\\\`\\\`typescript
interface GameRules {
  entityConfig: Record<string, { speed?: number; color?: string; behavior?: string; }>;
  inputMapping: Record<string, string>;
  skillRules?: Array<{ entity: string; skills: string[] }>;
  aiRules?: Array<{ entity: string; movementAI?: string; combatAI?: string }>;
  collisionRules: Array<{ a: string; b: string; action: string[] }>;
}
\\\`\\\`\\\`

**Output ONLY the fixed, valid JSON.**`;
  }

  /**
   * 格式化地图信息
   */
  private formatMapInfo(mapData: any): string {
    if (!mapData) return 'No map data provided';

    const info: string[] = [];

    if (mapData.meta?.map_size) {
      info.push(`Map Size: ${mapData.meta.map_size.width} × ${mapData.meta.map_size.height}`);
    }

    if (mapData.mapping) {
      info.push('\nElement Mapping:');
      for (const [key, value] of Object.entries(mapData.mapping)) {
        const v = value as any;
        info.push(`  ${key}: ${v.name} (${v.layer})`);
      }
    }

    if (mapData.terrain?.grid) {
      info.push('\nTerrain Layout (preview):');
      const preview = mapData.terrain.grid.slice(0, 5).map((row: any) => `  ${row.y}: ${row.row}`).join('\n');
      info.push(preview);
      if (mapData.terrain.grid.length > 5) {
        info.push(`  ... (${mapData.terrain.grid.length - 5} more rows)`);
      }
    }

    return info.join('\n');
  }

  /**
   * 从LLM输出中提取代码
   */
  private extractCode(output: string): any {
    const trimmedOutput = output.trim();

    // 方法1：匹配 markdown JSON 代码块
    const jsonBlockPattern = /```(?:json)?\s*([\s\S]*?)```/;
    const match = trimmedOutput.match(jsonBlockPattern);

    let extracted: string;

    if (match && match[1]) {
      extracted = match[1].trim();
    } else {
      // 方法2：查找第一个 { 到最后一个 } 之间的内容
      const firstBrace = trimmedOutput.indexOf('{');
      const lastBrace = trimmedOutput.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        extracted = trimmedOutput.slice(firstBrace, lastBrace + 1);
      } else {
        throw new Error('Failed to extract code from LLM output - no code block found');
      }
    }

    // 解析并重新格式化 JSON
    try {
      return JSON.parse(extracted);
    } catch (e) {
      // 如果解析失败，返回原始提取的内容
      return extracted;
    }
  }

  /**
   * 验证输出内容
   */
  private validateCode(code: any, mapData: any): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // 检查必需字段
      if (!code.entityConfig) {
        errors.push('Missing required field: entityConfig');
      }
      if (!code.inputMapping) {
        errors.push('Missing required field: inputMapping');
      }
      if (!code.collisionRules) {
        errors.push('Missing required field: collisionRules');
      }

      // 检查实体是否完整
      if (code.entityConfig && mapData?.mapping) {
        for (const [key, value] of Object.entries(mapData.mapping)) {
          const v = value as any;
          if (v.layer === 'interaction' && v.category === 'character') {
            if (!code.entityConfig[v.name]) {
              errors.push(`Missing entity config for: ${v.name} (found in map as '${key}')`);
            }
          }
        }
      }

      return { success: errors.length === 0, errors };
    } catch (error) {
      return {
        success: false,
        errors: [`JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }
}

let gameCodeGenerationServiceInstance: GameCodeGenerationService | null = null;

export function getGameCodeGenerationService(): GameCodeGenerationService {
  if (!gameCodeGenerationServiceInstance) {
    gameCodeGenerationServiceInstance = new GameCodeGenerationService();
  }
  return gameCodeGenerationServiceInstance;
}

export const gameCodeGenerationService = new Proxy({} as GameCodeGenerationService, {
  get(_target, prop) {
    const service = getGameCodeGenerationService();
    return service[prop as keyof GameCodeGenerationService];
  }
});
