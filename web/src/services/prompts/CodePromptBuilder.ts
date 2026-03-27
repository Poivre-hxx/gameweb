/**
 * 代码生成相关提示词构建器
 * 负责游戏代码生成和修复的提示词构建
 */

import { PromptFragments } from './PromptFragments';
import type {
  CodeGenerationInput,
  CodeFixInput,
  CodeGenerationPrompt,
  CodeFixPrompt,
} from './types';

export class CodePromptBuilder {
  /**
   * 构建代码生成prompt
   * 让LLM输入游戏规则json数据
   */
  buildCodeGenerationPrompt(input: CodeGenerationInput): CodeGenerationPrompt {
    // const frameworkAPI = PromptFragments.getFrameworkAPIDoc();
    const mapInfo = PromptFragments.formatMapInfo(input.mapData);
    // const collisionHints = PromptFragments.extractCollisionHints(input.rules);

    // 构建操作说明约束部分
    const controlInstructions = input.controlInstructions || '';
    const controlConstraints = controlInstructions
      ? `\n## Control Instructions (CRITICAL)\n\n**Implement these controls exactly as specified**:\n\n${controlInstructions}\n\nYour UserInputSystem must implement ONLY these controls. Do not add or modify any mappings.\n`
      : '';

    return (`# Game Configuration Generation Task

You are a Game Designer. Your job is to configure the gameplay rules for a 2D game engine based on the User's Description and the Map Layout.

**CRITICAL**: You must output PURE JSON data. Do NOT write any JavaScript code/classes/functions.

---

## Input Context

### Map Information
${mapInfo}

### Game Rules
${input.rules}

### Control Mappings
${controlConstraints}

---

## 2. Engine Capability Documentation (What you can configure)

You need to generate a JSON object matching the \`GameRules\` interface.

### A. Entity Config (\`entityConfig\`)
Define stats and behaviors for every entity name found in the map (e.g., 'player', 'enemy') and projectiles.
- \`speed\`: Number (pixels/sec).
- \`color\`: Hex string.
- \`projectileType\`: String key (e.g., 'bullet_normal') if this entity shoots.
- \`behavior\`: String enum (AI Logic). Supported values:
  - 'chase': Relentlessly moves towards the player.
  - 'patrol': Moves randomly.
  - null/undefined: Does not move automatically.

### B. Input Mapping (\`inputMapping\`)
Map virtual gamepad buttons to logical actions.
- Keys must be: "A", "B", "X", "Y".
- Common Actions: "shoot", "jump", "interact", "bomb".
- **Note**: Movement (Joystick) is handled automatically. Do not map movement.

### C. Collision Rules (\`collisionRules\`)
Define what happens when two objects collide.
- Fields: \`a\` (name), \`b\` (name), \`action\` (string array).
- Supported Actions:
  - 'destroy_a': Remove entity A.
  - 'destroy_b': Remove entity B.
  - 'destroy_both': Remove both.
  - 'damage_b': Entity B takes 1 damage (if it hits 0 HP, it dies).

---

## 3. Output Format

**CRITICAL: Output ONLY valid JSON. No explanations, no markdown, no code blocks.**
**Start your response directly with { and end with }**

Example of CORRECT output:
{"entityConfig":{"player":{...},...},...}

Example of WRONG output:
\`\`\`json
{
  "entityConfig": {
    "player": {
      "speed": 150,
      "color": "#00ff00",
      "projectileType": "player_bullet"
    },
    "enemy": {
      "speed": 80,
      "color": "#ff0000",
      "behavior": "chase",
      "projectileType": "enemy_bullet"
    },
    "player_bullet": {
      "speed": 400,
      "color": "#ffff00",
      "width": 0.3,
      "height": 0.3
    },
    "enemy_bullet": {
      "speed": 200,
      "color": "#ffa500"
    }
  },
  "inputMapping": {
    "A": "shoot",
    "B": null
  },
  "collisionRules": [
    { "a": "player_bullet", "b": "enemy", "action": ["damage_b", "destroy_a"] },
    { "a": "player_bullet", "b": "wall", "action": ["destroy_a"] }
  ]
}
\`\`\`

Ensure all entity names in the Map (e.g., "player", "enemy", "base") are defined in \`entityConfig\`.`) as CodeGenerationPrompt;
  }

  /**
   * 构建代码修复prompt
   */
  buildCodeFixPrompt(input: CodeFixInput): CodeFixPrompt {
    const frameworkAPI = PromptFragments.getFrameworkAPIDoc();

    return (`# # Task: Fix Invalid Game Configuration JSON

The following JSON string failed to parse or is missing required fields for the Game Engine.

## Current Invalid JSON:
\`\`\`json
${input.code}
\`\`\`

---

## Error Report:

${input.errors.join('\n')}

## Requirement
Fix the JSON syntax and structure. Ensure it strictly follows this interface:

\`\`\`typescript
interface GameRules {
  gameConfig: { physicsMode: string; cameraMode: string; tileSize: number; };
  entityConfig: Record<string, { speed?: number; color?: string; behavior?: string; }>;
  inputMapping: Record<string, string>;
  collisionRules: Array<{ a: string; b: string; action: string[] }>;
}
\`\`\`

**Output ONLY the fixed, valid JSON.**`) as CodeFixPrompt;
  }
}
