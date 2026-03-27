/**
 * 反馈分析服务 - 后端版本
 * 分析用户反馈并生成更新后的规则 + 更新决策
 */

import { llmService } from './LLMService.js';

export interface FeedbackAnalysisRequest {
  feedback: string;
  currentRules: string;
  schema: any;
  mapData: any;
  currentCode: string;
}

export interface UpdateDecision {
  updateCode: boolean;
  updateMap: boolean;
  reasoning: string;
}

export interface FeedbackAnalysisResult {
  success: boolean;
  error?: string;
  updatedRules?: string;
  updateDecision?: UpdateDecision;
}

/**
 * 反馈分析服务类 - 后端版本
 */
class FeedbackAnalysisService {
  /**
   * 分析反馈并生成更新后的规则
   */
  async analyzeFeedback(request: FeedbackAnalysisRequest): Promise<FeedbackAnalysisResult> {
    try {
      console.log('[FeedbackAnalysis] Starting feedback analysis...');

      const prompt = this.buildFeedbackAnalysisPrompt(request);
      const output = await llmService.callWithRetry(prompt);

      if (!output) {
        return {
          success: false,
          error: 'LLM returned empty response',
        };
      }

      const parsed = this.parseAnalysisOutput(output);
      if (!parsed.success) {
        return {
          success: false,
          error: parsed.error,
        };
      }

      console.log('[FeedbackAnalysis] Feedback analysis completed successfully');
      return {
        success: true,
        updatedRules: parsed.updatedRules,
        updateDecision: parsed.updateDecision,
      };
    } catch (error) {
      console.error('[FeedbackAnalysis] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 构建反馈分析prompt
   */
  private buildFeedbackAnalysisPrompt(request: FeedbackAnalysisRequest): string {
    const mapSize = request.mapData?.meta?.map_size || request.mapData?.map_size;
    const mapSummary = mapSize
      ? `${mapSize.width} × ${mapSize.height}`
      : 'Unknown';

    const schemaJson = JSON.stringify(request.schema, null, 2);

    // currentCode 可能是字符串或对象，需要统一转换为字符串
    const currentCodeStr = typeof request.currentCode === 'string'
      ? request.currentCode
      : JSON.stringify(request.currentCode);
    const systemMatches = currentCodeStr.match(/class\s+(\w+System)\s+/g) || [];
    const systems = systemMatches.map(m => m.replace(/class\s+|System\s+/g, '')).join(', ');

    return `# Feedback Analysis and Rules Update Task

You are a game design expert. Analyze user feedback on the current game and generate updated rules.

---

## Current Game State

### Current Detailed Rules

${request.currentRules}

---

### Current Schema

\\\`\\\`\\\`json
${schemaJson}
\\\`\\\`\\\`

---

### Current Map Summary

- **Size**: ${mapSummary}
- **Element Count**: ${Object.keys(request.schema?.mapping || {}).length} element types

---

### Current Code Summary

- **Systems**: ${systems || 'No systems detected'}
- **Lines of Code**: Approximately ${currentCodeStr.split('\n').length} lines

---

## User Feedback

${request.feedback}

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

## Output Format

**IMPORTANT**: Output ONLY valid JSON. Do NOT include any other text, explanations, or markdown code block markers.

Output structure:

\\\`\\\`\\\`json
{
  "updatedRules": "... complete updated detailed rules (markdown format) ...",
  "updateDecision": {
    "updateCode": true/false,
    "updateMap": true/false,
    "reasoning": "Brief explanation of what changed and why these updates are needed"
  }
}
\\\`\\\`\\\`

---

## Critical Constraints

1. **Preserve Structure**: Maintain the same markdown section structure as current rules
2. **Be Specific**: Make concrete changes, not vague modifications
3. **Consistency**: Ensure updated rules are consistent with schema
4. **Minimal Changes**: Only change what the feedback requires
5. **Valid JSON**: Output must be parseable JSON, do NOT wrap in markdown code blocks

---

Now analyze the user feedback and generate updated rules and decision. Remember: Output ONLY JSON, no other content.`;
  }

  /**
   * 解析反馈分析输出
   */
  private parseAnalysisOutput(output: string): {
    success: boolean;
    error?: string;
    updatedRules?: string;
    updateDecision?: UpdateDecision;
  } {
    try {
      let cleaned = output.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);

      if (!parsed.updatedRules || !parsed.updateDecision) {
        return {
          success: false,
          error: 'Response missing required fields',
        };
      }

      const updateDecision: UpdateDecision = {
        updateCode: parsed.updateDecision.updateCode ?? true,
        updateMap: parsed.updateDecision.updateMap ?? false,
        reasoning: parsed.updateDecision.reasoning || 'No reasoning provided',
      };

      return {
        success: true,
        updatedRules: parsed.updatedRules,
        updateDecision,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse analysis output: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

let feedbackAnalysisServiceInstance: FeedbackAnalysisService | null = null;

export function getFeedbackAnalysisService(): FeedbackAnalysisService {
  if (!feedbackAnalysisServiceInstance) {
    feedbackAnalysisServiceInstance = new FeedbackAnalysisService();
  }
  return feedbackAnalysisServiceInstance;
}

export const feedbackAnalysisService = new Proxy({} as FeedbackAnalysisService, {
  get(_target, prop) {
    const service = getFeedbackAnalysisService();
    return service[prop as keyof FeedbackAnalysisService];
  }
});
