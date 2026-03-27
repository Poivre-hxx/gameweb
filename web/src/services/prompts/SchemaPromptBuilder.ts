/**
 * Schema和详细规则生成相关提示词构建器
 * 负责元素定义Schema和游戏详细规则的提示词构建
 */

import { PromptFragments } from './PromptFragments';
import type {
  SchemaGenerationInput,
  DetailedRulesInput,
  SchemaGenerationPrompt,
  DetailedRulesPrompt,
} from './types';

export class SchemaPromptBuilder {
  /**
   * Build schema generation prompt
   * Generate unified element definition schema for map and rules
   */
  buildSchemaGenerationPrompt(input: SchemaGenerationInput): SchemaGenerationPrompt {
    // const ragContext = PromptFragments.buildRAGContext({
    //   ragResults: input.ragResults,
    // });

    return `# Map Element Schema Generation Task

You are a game design expert. Based on the enhanced game description and reference games, generate a **complete element definition schema** for the game map.

This schema will be used to constrain both detailed rules generation and map generation, ensuring consistency.

---

## Game Description

${input.enhancedDescription}

---

## Map Information

- **Size**: ${input.mapInfo.width} × ${input.mapInfo.height} cells
- **Coordinate System**: Top-left corner is origin (0,0), all coordinates must be integers and grid-aligned

---

## Map Layer Architecture

The map uses a **two-layer system**:

### Layer 1 - Terrain
- Single-tile terrain elements (1×1 grid cells)
- Each character represents one grid cell
- Examples: empty space, walls, water, forest

### Layer 2 - Interaction
- Multi-tile objects and characters (rectangular areas)
- Each element has an **anchor point (top-left corner)** and **size**
- Two categories:
  - **"character"**: Player, enemies, NPCs
  - **"prop"**: Base/objectives, collectibles, interactive objects (doors, switches, etc.)

---

## CRITICAL: Element Extraction Rules

**ONLY extract elements explicitly mentioned in the user's game description. DO NOT add extra elements from reference games.**

### Analysis Process:
1. **Read the game description carefully**
2. **Identify explicit mentions**:
   - Terrain types (walls, water, ground types)
   - Characters (player, enemies, NPCs)
   - Props (base, items, objectives, interactive objects)
3. **DO NOT invent**:
   - Multiple enemy types unless specified
   - Power-ups unless mentioned
   - Terrain variations unless described

### Minimal Element Set:
Start with the bare minimum:
- **Always include**: \`X\` (space) - required terrain base
- **Terrain**: Only walls/obstacles mentioned in description
- **Characters**: Only if player/enemies are mentioned
- **Props**: Only objectives/items explicitly described

---

## Element Definition Requirements

### Terrain Elements (layer: "terrain")

**Required fields**:
- \`name\`: Element name (English, lowercase with underscores)
- \`description\`: Brief description (Chinese preferred)
- \`color\`: Hex color code (e.g., "#000000")
- \`layer\`: Must be "terrain"
- \`category\`: Must be "prop"

**Rules**:
- Use single uppercase letters (A-Z)
- Each character = exactly 1×1 grid cell
- \`X\` is always space/empty area (reserved, always first)

### Interaction Elements (layer: "interaction")

**Required fields**:
- \`name\`: Element name (English, lowercase with underscores)
- \`description\`: Brief description (Chinese preferred)
- \`color\`: Hex color code
- \`layer\`: Must be "interaction"
- \`category\`: Either "character" or "prop"
  - \`"character"\`: Player, enemies, NPCs
  - \`"prop"\`: Base, collectibles, doors, switches, objectives
- \`default_size\`: Object dimensions
  - \`width\`: Integer grid cells
  - \`height\`: Integer grid cells
  - Must form a rectangle

**Rules**:
- Use single uppercase letters (A-Z, avoid X)
- Anchor point is **top-left corner** of the object
- Common conventions:
  - \`P\`: Player spawn
  - \`N\`: Enemy spawn
  - \`E\`: Eagle/Base/Objective

**CRITICAL - Player Entity Constraint**:
If the game has a player-controlled entity (controlled by virtual gamepad):
- The \`name\` field MUST be exactly \`"player"\` (not "player_spawn", "player_tank", etc.)
- This ensures the GenericInputSystem can correctly identify and control the player entity
- Example:
  \`\`\`json
  "P": {
    "name": "player",  // CRITICAL: Must be exactly "player"
    "description": "玩家控制的实体",
    "category": "character",
    ...
  }
  \`\`\`

---

## Important Constraints

1. **Single Character Keys**: Each element uses exactly ONE uppercase letter
2. **No Duplicates**: Each letter represents only one element
3. **Layer Separation**: Clear distinction between terrain (single-tile) and interaction (multi-tile)
4. **Grid Alignment**: All coordinates and sizes are integers
5. **First Element**: \`X\` (space) is always first in the mapping
6. **Minimal Set**: Only include elements explicitly mentioned in the game description

---

## Output Format

Output ONLY the JSON schema with this exact structure:

\`\`\`json
{
  "map_size": {
    "width": ${input.mapInfo.width},
    "height": ${input.mapInfo.height}
  },
  "coordinate_system": "Top-left corner is the origin (0,0)",
  "field_guide": {
    "mapping": "Defines all element types (terrain and interactive objects)",
    "terrain": "Layer 1 - Single-tile terrain (1×1 grid cells)",
    "interaction": "Layer 2 - Multi-tile objects and characters (rectangular areas with anchor points)"
  },
  "mapping": {
    "X": {
      "name": "space",
      "description": "空白区域",
      "color": "#000000",
      "layer": "terrain",
      "category": "prop"
    }
    // Add other elements extracted from game description
  }
}
\`\`\`

### Example Output Structure:

\`\`\`json
{
  "mapping": {
    "X": {
      "name": "space",
      "description": "空白区域",
      "color": "#000000",
      "layer": "terrain",
      "category": "prop"
    },
    "B": {
      "name": "brick",
      "description": "普通砖块",
      "color": "#9c4a00",
      "layer": "terrain",
      "category": "prop"
    },
    "P": {
      "name": "player",
      "description": "玩家控制的实体",
      "color": "#00ff00",
      "layer": "interaction",
      "category": "character",
      "default_size": {
        "width": 2,
        "height": 2
      }
    },
    "N": {
      "name": "enemy_spawn",
      "description": "敌人生成点",
      "color": "#ff0000",
      "layer": "interaction",
      "category": "character",
      "default_size": {
        "width": 2,
        "height": 2
      }
    },
    "E": {
      "name": "base",
      "description": "基地/目标",
      "color": "#636363",
      "layer": "interaction",
      "category": "prop",
      "default_size": {
        "width": 2,
        "height": 2
      }
    }
  }
}
\`\`\`

---

Please generate the complete schema now based on the game description above.` as SchemaGenerationPrompt;
  }

  /**
   * Build detailed rules generation prompt
   * Generate structured detailed rules based on RAG-retrieved game information
   */
  buildDetailedRulesPrompt(input: DetailedRulesInput): DetailedRulesPrompt {
    const ragContext = PromptFragments.buildRAGContext({
      ragResults: input.ragResults,
    });

    // Format schema
    const schemaJson = PromptFragments.formatSchema(input.schema);

    return `# Detailed Game Rules Generation Task

You are a game design expert. Based on the user's enhanced game description and reference information from similar games, generate a **detailed, structured** game design rules document.

This rules document will guide subsequent map generation and code generation, so it needs to be very specific and executable.

---

## User's Game Description

${input.enhancedDescription}

---

## Similar Games Reference

${ragContext}

---

## Map Information

- **Size**: ${input.mapInfo.width} × ${input.mapInfo.height} cells
- **Type**: 2D platform game map

---

## Map Element Schema

The following schema defines all available game elements:

${schemaJson}

**IMPORTANT**: All entity definitions in your rules MUST use elements defined in this schema.
- Terrain entities: Use elements with layer="terrain"
- Interactive entities: Use elements with layer="interaction"
- Follow the exact naming and categorization from the schema

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
- ...

**Attributes**:
- Movement Speed: [Value]
- Jump Force: [Value, if applicable]
- Health: [Value, if applicable]
- ...

---

#### Terrain Entities

List all terrain elements (such as ground, walls, platforms, etc.), each element includes:

**Name**: [Element name, e.g., ground, wall, platform]

**Description**: [Description and function of the element]

**Spawn Method**: init

**Physics Type**: static / kinematic

**Collision Behavior**: [Which entities it collides with and what effects]

---

#### Interactive Entities

List all interactive elements (such as props, enemies, mechanisms, etc.), each element includes:

**Name**: [Element name]

**Description**: [Description of the element]

**Spawn Method**: init / trigger / spawn

**Physics Type**: dynamic / kinematic / sensor

**Behavior Pattern**: [Movement pattern, AI logic]

**Interaction Effect**: [Effect when interacting with player or other entities]

---

### Game Systems

#### User Input System

**Function**: Handle player input and update PlayerInput component

**IMPORTANT - Control Constraints**:
The game MUST be controlled using a virtual gamepad with the following inputs ONLY:
- **Joystick** (Left side): Provides normalized X/Y values (-1 to 1) for directional movement
  - X-axis: -1 (left) to +1 (right)
  - Y-axis: -1 (up) to +1 (down)
- **Button A** (Green, bottom): Primary action (e.g., jump, confirm, attack)
- **Button B** (Red, right): Secondary action (e.g., special ability, cancel)
- **Button X** (Blue, left): Tertiary action (e.g., item use, dash)
- **Button Y** (Yellow, top): Quaternary action (e.g., menu, switch)

**Design Principle**: Keep controls simple and intuitive. Most games should only use:
- Joystick for movement
- Button A for primary action (jump/attack)
- Button B for secondary action (optional)
- Buttons X and Y are optional for advanced mechanics

**Monitored Inputs**:
- Joystick X/Y: [Map to player movement direction]
- Button A: [Primary action, e.g., jump, shoot]
- Button B: [Secondary action, optional]
- Button X: [Tertiary action, optional]
- Button Y: [Quaternary action, optional]

---

#### Action System

**Function**: Execute game actions based on PlayerInput

**Handled Actions**:
- [Action 1]: [Implementation logic]
- [Action 2]: [Implementation logic]
- ...

---

#### Simulation System

**Function**: Handle simulation logic of the game world

**Included Logic**:
- [Logic 1]: [Description]
- [Logic 2]: [Description]
- ...

---

### Collision Rules

List all important collision interactions:

1. **Player vs Terrain**
   - Behavior: [Block/Landing/etc.]
   - Effect: [Specific effect]

2. **Player vs [Entity Type]**
   - Behavior: [Describe collision behavior]
   - Effect: [Specific effect, such as damage, collection, destruction, etc.]

3. **[Continue listing other collision rules]**

---

### Game Mechanics

#### Mechanism 1: [Mechanism Name]

**Description**: [Detailed description of the mechanism]

**Implementation Method**: [How to implement this mechanism]

**Related Entities**: [Which entities are involved]

#### Mechanism 2: [Mechanism Name]

[Same as above]

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
- ...

---

## Important Notes

1. **Be Specific**: All descriptions should be concrete, avoid vague statements
2. **Be Executable**: Rules must be directly convertible to code implementation
3. **Be Complete**: Cover all core elements of the game
4. **Reference and Learn**: Make full use of design patterns from similar games
5. **Single Level Only**: Generate rules for ONE complete level, not multiple stages

Please now generate the detailed game rules document, strictly following the above format.` as DetailedRulesPrompt;
  }

  /**
   * Build control instructions extraction prompt
   * Extract concise control instructions from detailed game rules
   */
  buildControlInstructionsPrompt(detailedRules: string): string {
    return `# Control Instructions Extraction Task

Based on the game design, generate simple control instructions for mobile gamepad players.

---

## Game Design Document

${detailedRules}

---

## Available Controls

Players have a mobile gamepad with:
- Virtual Joystick: 8-directional movement
- Button A: Primarny action
- Button B: Secondary action
- Button X: Tertiary action
- Button Y: Quaternary action

---

## Task

Generate 2-4 lines of clear, concise control instructions.

**Guidelines**:
- Use format: [Control] : [Action]
- Use simple, direct language
- Focus on essential controls only
- Prioritize most important actions first

**Button Priority**:
1. Button A → Most frequent action (Jump, Shoot, Confirm)
2. Button B → Secondary action (Attack, Special)
3. Button X/Y → Less frequent actions

---

## Examples

**Platform Game**:
Joystick : Move
Button A : Jump

**Top-Down Shooter**:
Joystick : Move
Button A : Shoot

**Tank Battle**:
Joystick : Move and aim
Button A : Fire
Button B : Special weapon

**Puzzle Game**:
Joystick : Navigate
Button A : Select
Button B : Cancel

---

## Output

Output ONLY 2-4 lines of control instructions, without any explanations or formatting.
Each line: [Control] : [Action]

---

## Example
### Input
Game Type: Platform Game

Player Controls:
- Move left/right using horizontal input
- Jump by pressing jump button
- Sprint by holding sprint button while moving

Gameplay:
Player must navigate through levels, avoid enemies, and collect coins...

### Output
Joystick : Move left/right
Button A : Jump
Button B : Sprint`;
  }
}
