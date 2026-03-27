/**
 * 地图生成相关提示词构建器
 * 负责 Layer1-4 的提示词构建
 */

import type {
  MapLayer1Input,
  MapLayer2Input,
  MapLayer3Input,
  MapLayer4Input,
  MapLayer1Prompt,
  MapLayer2Prompt,
  MapLayer3Prompt,
  MapLayer4Prompt,
} from './types';

export class MapPromptBuilder {
  /**
   * 构建Layer1 prompt（地图特征分析）
   */
  buildLayer1Prompt(input: MapLayer1Input): MapLayer1Prompt {
    const schemaJson = JSON.stringify(input.schema || {}, null, 2);

    return `# Layer1: Game Design Analysis

You are a game level design analyst. Based on the game rules and element schema, analyze and suggest map design requirements.

## Game Rules

${input.prompt}

## Element Schema

\`\`\`json
${schemaJson}
\`\`\`

## Task Requirements

### 1. Element Distribution Suggestion

Analyze the game rules and suggest which terrain elements should be used and their approximate percentages.

Output format:
\`\`\`yaml
Element Distribution Suggestion:
  <element_key>_<name>:
    Suggested Percentage: X-Y%
    Reason: [Why this element is needed based on game mechanics]
    Spatial Pattern: [How it should be distributed, e.g., "scattered", "clustered", "border"]
\`\`\`

### 2. Structure Patterns Suggestion

Based on the game type and mechanics, suggest common structural patterns that should appear in the map.

Output format:
\`\`\`yaml
Structure Patterns Suggestion:
  S1_<structure_name>:
    Size: width×height
    Purpose: [Tactical or gameplay purpose]
    Suggested Locations: [Where these structures should typically appear]
    Example Pattern: |
      [Draw a small example using element keys]
\`\`\`

### 3. Hard Constraints Extraction

Extract mandatory constraints from the schema and rules.

Output format:
\`\`\`yaml
Hard Constraints:
  Map Size:
    Width: ${input.width}
    Height: ${input.height}

  Interaction Objects:
    - Element: <element_key from schema where layer="interaction">
      Category: <character/prop>
      Typical Count: <suggested count based on rules>
      Size: <width × height from schema>
      Placement Rule: <where they should be placed>
      Terrain Requirement: All cells must be empty space (typically "X")

  Connectivity:
    Core Requirement: All empty space elements must form a single 4-connected component
    Connection Rule: 4-connected (up, down, left, right), diagonal does not count
    Minimum Path Width: 1 cell
\`\`\`

## Important Notes

- Base your analysis on the **game rules** and **game type** (platformer/topdown/puzzle/etc.)
- Do NOT assume this is a Battle City-like game unless the rules explicitly describe it
- Suggest element distributions that match the described gameplay
- Consider the game's win/lose conditions when suggesting structures

## Output Format

Please strictly output the analysis results in the above YAML format. Output only YAML content without other explanations.` as MapLayer1Prompt;
  }

  /**
   * 构建Layer2 prompt（蓝图生成）
   */
  buildLayer2Prompt(input: MapLayer2Input): MapLayer2Prompt {
    return `# Layer2: Level Blueprint Generation

Based on the game rules and design analysis, generate a blueprint for ONE single level.

## Game Rules

${input.prompt}

## Layer1 Design Analysis

\`\`\`yaml
${input.layer1Output}
\`\`\`

## Task Requirements

**IMPORTANT**: Generate a blueprint for EXACTLY ONE SINGLE level/stage.
- DO NOT generate multiple levels or stages
- DO NOT include level progression or stage transitions
- Focus on ONE complete, playable level only

The blueprint should:
1. **Match the game type** described in the rules (platformer/topdown/puzzle/etc.)
2. **Use element proportions** suggested by Layer1 analysis
3. **Include structures** that support the core gameplay mechanics
4. **Consider win/lose conditions** from the rules

## Output Format

\`\`\`yaml
level:
  Theme: "One sentence describing the level's design concept based on game rules"
  Game Type: [platformer/topdown/puzzle/maze/etc.]
  Element Proportion: "key:percentage%, key:percentage%, ..."
  Key Structures:
    - Structure: S1_<name>
      Purpose: [How it supports gameplay]
      Placement: [Where in the map]
  Layout Strategy: [Overall spatial organization, e.g., "symmetric", "linear progression", "open arena"]
\`\`\`

Please strictly output in the above YAML format. Output only YAML content without other explanations.` as MapLayer2Prompt;
  }

  /**
   * 构建Layer3 prompt（具体地图生成）
   */
  buildLayer3Prompt(input: MapLayer3Input): MapLayer3Prompt {
    // Use passed-in schema
    const schema = input.schema || {};
    const schemaJson = JSON.stringify(schema, null, 2);

    // Extract interaction elements from schema (not from reference map)
    const interactionElements = Object.entries(schema.mapping || {})
      .filter(([_, element]: [string, any]) => element.layer === 'interaction')
      .map(([key, element]: [string, any]) => ({
        key,
        name: element.name,
        category: element.category,
        default_size: element.default_size
      }));
    const interactionJson = JSON.stringify(interactionElements, null, 2);

    const mapWidth = input.width;
    const mapHeight = input.height;

    return `# Layer3: Concrete Map Level Data Generation

Based on the blueprint and game rules, generate concrete playable map data.

## Game Rules

${input.prompt}

## Layer2 Blueprint

\`\`\`yaml
${input.layer2Output}
\`\`\`

## CRITICAL DIMENSION REQUIREMENTS

**YOU MUST GENERATE EXACTLY:**
- **${mapHeight} rows** (no more, no less)
- **Each row EXACTLY ${mapWidth} characters** (no more, no less)

**VALIDATION CHECKLIST BEFORE OUTPUT:**
□ Count total rows = ${mapHeight}
□ Count characters in EACH row = ${mapWidth}
□ No row has more or fewer characters than ${mapWidth}

---

## Schema Definition

\`\`\`json
${schemaJson}
\`\`\`

## Interaction Elements Available

\`\`\`json
${interactionJson}
\`\`\`

## Generation Principles

### P0 Core Constraints (MUST be met)

1. **Map Completeness**: ${mapHeight} rows × ${mapWidth} columns, each row exactly ${mapWidth} characters

   **ABSOLUTE REQUIREMENT**:
   - Total rows: EXACTLY ${mapHeight} (count: 0, 1, 2, ..., ${mapHeight-1})
   - Each row width: EXACTLY ${mapWidth} characters
   - NO EXCEPTIONS: Not ${mapWidth-1}, not ${mapWidth+1}, EXACTLY ${mapWidth}

2. **Element Legality**: Only use terrain elements defined in \`schema.mapping\` where \`layer="terrain"\`

3. **Interaction Placement Rules**:
   - For each interaction object, within the width×height rectangular area starting from anchor(x,y)
   - The corresponding positions in terrain.grid must ALL be 'X' (space element)
   - Example: anchor={x:5,y:8}, size={width:2,height:2}
     Then terrain.grid[8].row[5:7] and grid[9].row[5:7] must both be "XX"

   **CRITICAL**: Only use 'X' for interaction object positions, NOT other elements

4. **Connectivity Verification**: All empty space elements must form a single 4-connected component

5. **Match Blueprint**: Generated map should follow the blueprint's theme, game type, and element proportions (±10% acceptable)

### P1 Quality Optimization

1. **Gameplay Support**: Structures should support the game mechanics described in rules
2. **Spatial Variety**: Avoid large areas (>6 cells) of continuous single element
3. **Playability**: Ensure the map is actually playable according to the game rules

## Output Format

\`\`\`json
{
  "terrain": {
    "grid": [
      {"y": 0, "row": "XXXXXXXXXXXXXXXXXX"},  // ← MUST be ${mapWidth} chars
      {"y": 1, "row": "XXBBXXBBXXBBXXBBXX"},  // ← MUST be ${mapWidth} chars
      ...(all ${mapHeight} rows)
      {"y": ${mapHeight-1}, "row": "XXXXXXXXXXXXXXXXXX"}  // ← MUST be ${mapWidth} chars
    ]
  },
  "interaction": [
    {
      "id": "player_1",
      "category": "character",
      "element": "P",
      "anchor": {"x": 8, "y": 8},
      "size": {"width": 1, "height": 1}
    }
  ]
}
\`\`\`

**IMPORTANT REMINDERS**:
1. Generate based on the **game rules**, not Battle City or any other reference game
2. Use interaction elements from the **schema**, not from external references
3. Ensure the map supports the **gameplay mechanics** described in the rules
4. **If ANY row has wrong width, FIX IT before output!**

Please strictly output complete data for the level in the above JSON format. Output only JSON content without other explanations or markdown markers.` as MapLayer3Prompt;
  }

  /**
   * 构建Layer4 prompt（长地图分段）
   */
  buildLayer4Prompt(input: MapLayer4Input): MapLayer4Prompt {
    return `# Layer4: Map Segmentation

Segment the long map into smaller chunks with connecting seams.

## Current Map
\`\`\`json
${JSON.stringify(input.mapData, null, 2)}
\`\`\`

## Task
Split this map into segments of max 24×24 size with 5-cell seams connecting them.

Please output the segmented map structure.` as MapLayer4Prompt;
  }
}
