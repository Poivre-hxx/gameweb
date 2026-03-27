/**
 * 控制说明生成服务 - 后端版本
 * 从游戏规则中提取简洁的控制说明
 */

import { llmService } from './LLMService.js';

export interface ControlInstructionRequest {
  rules: string;
}

export interface ControlInstructionResult {
  success: boolean;
  controlInstructions?: string;
  error?: string;
}

/**
 * 控制说明生成服务类
 */
class ControlInstructionService {
  /**
   * 生成控制说明
   */
  async generateControlInstructions(request: ControlInstructionRequest): Promise<ControlInstructionResult> {
    try {
      console.log('[ControlInstruction] Starting control instructions generation...');

      const prompt = this.buildControlInstructionsPrompt(request.rules);
      const output = await llmService.callWithRetry(prompt);

      if (!output) {
        return {
          success: false,
          error: 'Failed to generate control instructions',
        };
      }

      const controlInstructions = output.trim();

      console.log('[ControlInstruction] successfully');
      return {
        success: true,
        controlInstructions,
      };
    } catch (error) {
      console.error('[ControlInstruction] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 构建控制说明生成prompt
   */
  private buildControlInstructionsPrompt(rules: string): string {
    return `#Control Instructions Extraction Task

role: >
  You are a game design assistant.

objective: >
  Based ONLY on the provided game design description,
  generate simple mobile gamepad control instructions.

constraints:
  - Do NOT invent actions that are not explicitly described.
  - Do NOT assume extra mechanics.
  - Do NOT generate abilities outside the provided skill list.

game_design_document: |
  ${rules}

available_controls:
  - Button A (Primary action)
  - Button B (Secondary action)
  - Button X (Tertiary action)
  - Button Y (Quaternary action)

control_notes:
  - Not all buttons must be used.
  - Only include controls necessary for core gameplay.
  - Prioritize completeness of essential actions.

available_skills:
  projectile:
    basic_shoot: Fires a single bullet in the current facing direction
    spread_shot: Fires a 3-way spread shot (45° angle)
  movement:
    jump: Normal jump; can jump again after touching the ground

skill_rules:
  - Only use actions corresponding to the skill names listed above.
  - If a skill is not explicitly mentioned in the design document, do NOT output a control for it.

output_requirements:
  line_count: 2-4
  format: "[Control] : [Action]"
  rules:
    - Use short verb phrases only (1-3 words)
    - No full sentences
    - No explanations
    - No punctuation at end
    - No extra text before or after
    - No empty lines
    - Prioritize essential actions first

button_priority:
  1: Button A (Most frequent action)
  2: Button B (Secondary action)
  3: Button X/Y (Rare actions)

example:
  - "Button A : Jump"
  - "Button B : Shoot"`;
  }
}

let controlInstructionServiceInstance: ControlInstructionService | null = null;

export function getControlInstructionService(): ControlInstructionService {
  if (!controlInstructionServiceInstance) {
    controlInstructionServiceInstance = new ControlInstructionService();
  }
  return controlInstructionServiceInstance;
}

export const controlInstructionService = new Proxy({} as ControlInstructionService, {
  get(_target, prop) {
    const service = getControlInstructionService();
    return service[prop as keyof ControlInstructionService];
  }
});
