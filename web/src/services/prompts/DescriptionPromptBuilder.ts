/**
 * 描述增强相关提示词构建器
 * 负责游戏描述增强的提示词构建
 */

import { PromptFragments } from './PromptFragments';
import type {
  DescriptionEnhanceInput,
  DescriptionEnhancePrompt,
} from './types';

export class DescriptionPromptBuilder {
  /**
   * 构建描述增强提示词
   */
  buildDescriptionEnhancePrompt(input: DescriptionEnhanceInput): DescriptionEnhancePrompt {
    const ragContext = PromptFragments.buildRAGContext({
      ragResults: input.ragResults,
    });

    return `# Game Description Enhancement Task

You are a game design documentation expert. The user has provided a brief gameplay description for a 2D action game. Your task is to expand this description into a standardized game annotation format based on reference examples from similar games.

## User's Brief Description
${input.userPrompt}

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

Please output the YAML annotation directly, without additional explanations.` as DescriptionEnhancePrompt;
  }
}
