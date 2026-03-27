/**
 * 反馈分析提示词构建器
 * 负责构建反馈分析和规则更新的提示词
 */

import type { FeedbackAnalysisInput, FeedbackAnalysisPrompt } from './types';

export class FeedbackPromptBuilder {
  /**
   * 构建反馈分析提示词
   * 分析用户反馈并生成更新后的规则 + 更新决策
   */
  buildFeedbackAnalysisPrompt(input: FeedbackAnalysisInput): FeedbackAnalysisPrompt {
    // 提取地图摘要信息
    const mapSize = input.mapData?.meta?.map_size || input.mapData?.map_size;
    const mapSummary = mapSize
      ? `${mapSize.width} × ${mapSize.height}`
      : '未知';

    // 提取schema信息
    const schemaJson = JSON.stringify(input.schema, null, 2);

    // 从代码中提取系统信息（简单的正则匹配）
    const systemMatches = input.currentCode.match(/class\s+(\w+System)\s+/g) || [];
    const systems = systemMatches.map(m => m.replace(/class\s+|System\s+/g, '')).join(', ');

    return `# Feedback Analysis and Rules Update Task

You are a game design expert. Analyze user feedback on the current game and generate updated rules.

---

## Current Game State

### Current Detailed Rules

${input.currentRules}

---

### Current Schema

\`\`\`json
${schemaJson}
\`\`\`

---

### Current Map Summary

- **Size**: ${mapSummary}
- **Element Count**: ${Object.keys(input.schema?.mapping || {}).length} element types

---

### Current Code Summary

- **Systems**: ${systems || 'No systems detected'}
- **Lines of Code**: Approximately ${input.currentCode.split('\n').length} lines

---

## User Feedback

${input.feedback}

---

## Task Requirements

1. **Analyze Feedback**: Understand what the user wants to change
2. **Update Rules**: Generate updated detailedRules incorporating the feedback
   - Preserve existing markdown structure
   - Only modify parts related to the feedback
   - Maintain consistency with schema
3. **Decide Updates**: Determine what needs to be regenerated

---

## Update Decision Logic

### Code Only (updateCode: true, updateMap: false)

If feedback is about:
- **Game Mechanics**: Speed, jump height, damage values, health
- **Control Mapping**: Key bindings, control scheme
- **Collision Behavior**: Collision effects, physics parameters
- **AI Patterns**: Enemy behavior, movement patterns
- **Win/Loss Conditions**: Victory/defeat rules
- **System Logic**: Game loop, state management

### Map Only (updateCode: false, updateMap: true)

If feedback is about:
- **Map Layout**: Overall structure, area division
- **Element Distribution**: Obstacle placement, density
- **Terrain Patterns**: Terrain types, arrangement
- **Object Placement**: Enemy positions, item positions
- **Map Size**: Width, height adjustments

### Both (updateCode: true, updateMap: true)

If feedback affects:
- **New Entity Types**: Adding new enemy/item types (requires schema + map + code changes)
- **Major Gameplay Changes**: E.g., platformer → top-down
- **Layout and Mechanics Together**: E.g., "add more enemies and make them stronger"

---

## Code Generation Constraints

**IMPORTANT**: The updated rules will be used to regenerate code. Generated code MUST follow these constraints:

1. **DO NOT use import statements**:
   - Do NOT include any \`import\` statements in the code
   - All dependencies (World, SystemBase, CollisionRuleEngine) are provided through runtime context
   - Use these classes directly without importing

2. **Code Format**:
   - Use plain JavaScript/TypeScript class definitions
   - Do NOT use ES6 module syntax (import/export)
   - Use \`class\` keyword to define classes and systems

---

## Output Format

**IMPORTANT**: Output ONLY valid JSON. Do NOT include any other text, explanations, or markdown code block markers.

Output structure:

\`\`\`json
{
  "updatedRules": "... complete updated detailed rules (markdown format) ...",
  "updateDecision": {
    "updateCode": true/false,
    "updateMap": true/false,
    "reasoning": "Brief explanation of what changed and why these updates are needed"
  }
}
\`\`\`

---

## Critical Constraints

1. **Preserve Structure**: Maintain the same markdown section structure as current rules
2. **Be Specific**: Make concrete changes, not vague modifications
3. **Consistency**: Ensure updated rules are consistent with schema
4. **Minimal Changes**: Only change what the feedback requires
5. **Valid JSON**: Output must be parseable JSON, do NOT wrap in markdown code blocks

---

## Example Output

\`\`\`json
{
  "updatedRules": "### Game Overview\\n\\n**Game Type**: Platform game\\n\\n**Core Gameplay**: Player controls a character that can jump higher now...\\n\\n### Entity Definitions\\n\\n#### Player Entity\\n\\n**Attributes**:\\n- Movement Speed: 200\\n- Jump Force: 800 (increased from 600)\\n- Health: 3\\n\\n...",
  "updateDecision": {
    "updateCode": true,
    "updateMap": false,
    "reasoning": "User requested higher jump height, which only requires modifying jump force parameter in code, no map layout changes needed"
  }
}
\`\`\`

---

Now analyze the user feedback and generate updated rules and decision. Remember: Output ONLY JSON, no other content.` as FeedbackAnalysisPrompt;
  }
}
