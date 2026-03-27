/**
 * 段索引检测服务
 * 使用 LLM 智能分析用户反馈，判断是否需要局部重新生成地图
 * 以及确定需要重新生成的段索引
 */

import { llmService } from './LLMService.js';

export interface SegmentDetectionRequest {
  feedback: string;
  cameraMode: string;
  totalSegments?: number; // 默认4
}

export interface SegmentDetectionResult {
  success: boolean;
  isPartial: boolean;           // 是否为局部重生成
  targetSegments: number[];     // 目标段索引 (0-3)
  segmentDescriptions: string;  // LLM 理解的描述
  reasoning: string;            // 判断理由
  error?: string;
}

/**
 * 段索引检测服务类
 */
class SegmentDetectionService {
  private readonly DEFAULT_TOTAL_SEGMENTS = 4;

  /**
   * 检测用户反馈中的段索引意图
   */
  async detectTargetSegments(request: SegmentDetectionRequest): Promise<SegmentDetectionResult> {
    try {
      // 如果不是长地图，直接返回非局部重生成
      if (request.cameraMode === 'fixed') {
        return {
          success: true,
          isPartial: false,
          targetSegments: [],
          segmentDescriptions: '',
          reasoning: 'Fixed camera mode does not support partial regeneration',
        };
      }

      console.log('[SegmentDetection] Analyzing feedback for segment targeting...');

      const prompt = this.buildDetectionPrompt(request);
      const output = await llmService.callWithRetry(prompt);

      if (!output) {
        return {
          success: false,
          isPartial: false,
          targetSegments: [],
          segmentDescriptions: '',
          reasoning: '',
          error: 'LLM returned empty response',
        };
      }

      const result = this.parseDetectionOutput(output);
      console.log('[SegmentDetection] Detection completed:', result);

      return result;
    } catch (error) {
      console.error('[SegmentDetection] Error:', error);
      return {
        success: false,
        isPartial: false,
        targetSegments: [],
        segmentDescriptions: '',
        reasoning: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 构建段索引检测 prompt
   */
  private buildDetectionPrompt(request: SegmentDetectionRequest): string {
    const totalSegments = request.totalSegments || this.DEFAULT_TOTAL_SEGMENTS;

    return `# Segment Detection Task

You are analyzing user feedback to determine if they want to regenerate a specific part of a long scrolling game level.

## Level Structure

The level has **${totalSegments} segments** (indexed 0-${totalSegments - 1}):

| Segment Index | Role | Description |
|--------------|------|-------------|
| 0 | Start/Beginning | Contains player spawn, tutorial elements, easy challenges |
| 1 | Early Challenge | First real challenges, medium difficulty |
| 2 | Mid Challenge | The middle section, often the hardest part |
| 3 | End/Final | Final challenges, goal/objective, level exit |

## User Feedback

\`\`\`
${request.feedback}
\`\`\`

## Detection Rules

### Segment Mapping Guide

**Segment 0 (Start)** keywords:
- "开头" / "开始" / "起点" / "入口" / "第一段" / "前面"
- "start" / "beginning" / "entrance" / "spawn" / "first part" / "front"
- References to player spawn or initial area

**Segment 3 (End)** keywords:
- "结尾" / "结束" / "终点" / "出口" / "最后一段" / "后面" / "末尾"
- "end" / "ending" / "final" / "exit" / "last part" / "back" / "tail"
- References to goal or level completion

**Segment 2 (Middle)** keywords:
- "中间" / "中部" / "第三段" / "中段"
- "middle" / "center" / "mid" / "third segment"
- References to the hardest part or core challenge

**Multiple Segments**:
- "前半部分" / "上半部分" → Segments 0, 1
- "后半部分" / "下半部分" → Segments 2, 3
- "整个" / "全部" / "all" → Not partial (isPartial: false)

### Decision Logic

1. **isPartial: true** - User clearly targets specific segment(s) for improvement
   - Feedback mentions specific location (start, middle, end)
   - Feedback describes issues in a specific area
   - The change is localized, not affecting the whole map

2. **isPartial: false** - User wants full regeneration or feedback is ambiguous
   - Feedback affects the entire level
   - No specific location mentioned
   - Changes are global (difficulty, style, etc.)

## Output Format

**IMPORTANT**: Output ONLY valid JSON. Do NOT include markdown code blocks or any other text.

\`\`\`json
{
  "isPartial": true/false,
  "targetSegments": [0, 1, 2, or 3],
  "segmentDescriptions": "Brief description of targeted area",
  "reasoning": "Why you made this decision"
}
\`\`\`

## Examples

**Example 1: "重新生成地图开头，增加更多障碍物"**
\`\`\`json
{
  "isPartial": true,
  "targetSegments": [0],
  "segmentDescriptions": "开头区域",
  "reasoning": "User explicitly requests to regenerate the beginning/start of the map"
}
\`\`\`

**Example 2: "优化地图结尾，让终点更明显"**
\`\`\`json
{
  "isPartial": true,
  "targetSegments": [3],
  "segmentDescriptions": "结尾区域",
  "reasoning": "User wants to improve the ending/final part of the level"
}
\`\`\`

**Example 3: "中间那个跳跃太难了，降低难度"**
\`\`\`json
{
  "isPartial": true,
  "targetSegments": [2],
  "segmentDescriptions": "中间区域",
  "reasoning": "User refers to 'middle' section having a difficult jump"
}
\`\`\`

**Example 4: "整个地图太简单了，增加难度"**
\`\`\`json
{
  "isPartial": false,
  "targetSegments": [],
  "segmentDescriptions": "",
  "reasoning": "Feedback affects the entire level, not a specific part"
}
\`\`\`

**Example 5: "前面太难了"**
\`\`\`json
{
  "isPartial": true,
  "targetSegments": [0, 1],
  "segmentDescriptions": "前半部分",
  "reasoning": "User says '前面' (front part) is too hard, targeting early segments"
}
\`\`\`

---

Now analyze the user feedback and determine the segment targeting. Remember: Output ONLY JSON, no other content.`;
  }

  /**
   * 解析检测输出
   */
  private parseDetectionOutput(output: string): SegmentDetectionResult {
    try {
      let cleaned = output.trim();

      // 移除可能的 markdown 代码块
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

      // 验证字段
      if (typeof parsed.isPartial !== 'boolean') {
        return {
          success: false,
          isPartial: false,
          targetSegments: [],
          segmentDescriptions: '',
          reasoning: '',
          error: 'Invalid isPartial field',
        };
      }

      // 验证 targetSegments
      let targetSegments: number[] = [];
      if (parsed.isPartial && Array.isArray(parsed.targetSegments)) {
        targetSegments = parsed.targetSegments.filter(
          (s: number) => Number.isInteger(s) && s >= 0 && s < this.DEFAULT_TOTAL_SEGMENTS
        );

        if (targetSegments.length === 0) {
          // 如果没有有效的段索引，返回非局部
          return {
            success: true,
            isPartial: false,
            targetSegments: [],
            segmentDescriptions: '',
            reasoning: 'No valid segment indices found, defaulting to full regeneration',
          };
        }
      }

      return {
        success: true,
        isPartial: parsed.isPartial,
        targetSegments,
        segmentDescriptions: parsed.segmentDescriptions || '',
        reasoning: parsed.reasoning || '',
      };
    } catch (error) {
      return {
        success: false,
        isPartial: false,
        targetSegments: [],
        segmentDescriptions: '',
        reasoning: '',
        error: `Failed to parse detection output: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

let segmentDetectionServiceInstance: SegmentDetectionService | null = null;

export function getSegmentDetectionService(): SegmentDetectionService {
  if (!segmentDetectionServiceInstance) {
    segmentDetectionServiceInstance = new SegmentDetectionService();
  }
  return segmentDetectionServiceInstance;
}

export const segmentDetectionService = new Proxy({} as SegmentDetectionService, {
  get(_target, prop) {
    const service = getSegmentDetectionService();
    return service[prop as keyof SegmentDetectionService];
  }
});
