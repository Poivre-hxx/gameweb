/**
 * 地图生成服务 - 后端版本
 * 实现3层生成pipeline: Layer1(特征分析) → Layer2(蓝图) → Layer3(具体地图)
 * 
 * 支持两种模式：
 * - Fixed Camera Mode: 单块地图生成
 * - Scrolling Mode: 长关卡分段生成
 */

import { llmService } from './LLMService.js';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载参考地图数据
// fixed-topdown
const refLevelPath_topdown_fixed = join(__dirname, '../../data/level/ref_topdown-fixed.json');
const refLevel_topdown_fixed = await fs.readFile(refLevelPath_topdown_fixed, 'utf-8');
// fixed-platformer
const refLevelPath_platformer_fixed = join(__dirname, '../../data/level/ref_platformer-fixed.json');
const refLevel_platformer_fixed = await fs.readFile(refLevelPath_platformer_fixed, 'utf-8');

// follow/auto-scroll-platformer
const refLevelPath_platformer = join(__dirname, '../../data/level/ref_platformer.json');
const refLevel_platformer = await fs.readFile(refLevelPath_platformer, 'utf-8');
// follow/auto-scroll-freely
const refLevelPath_freely = join(__dirname, '../../data/level/ref_freely.json');
const refLevel_freely = await fs.readFile(refLevelPath_freely, 'utf-8');

export interface MapGenerationRequest {
  prompt: string;
  width: number;
  height: number;
  schema?: any;
  physicsMode?: 'platformer' | 'topdown' | 'freely';
  cameraMode?: 'fixed' | 'follow' | 'auto-scroll';
  segmentCount?: number; // 长关卡分段数量，默认4
}

export interface MapGenerationAttempt {
  attempt: number;
  layer3Output: string;
  mapData?: any;
  validationResult: {
    success: boolean;
    error?: string;
  };
}

export interface SegmentGenerationAttempt {
  segmentIndex: number;
  attempt: number;
  output: string;
  segmentData?: any;
  validationResult: {
    success: boolean;
    error?: string;
  };
}

export interface ConnectionValidation {
  segmentAIndex: number;
  segmentBIndex: number;
  validationResult: 'valid' | 'invalid';
  issuesFound: Array<{
    type: string;
    description: string;
    affectedYCoordinates: number[];
  }>;
  repairs?: {
    segmentARightEdgeFixes: Array<{ y: number; newChar: string }>;
    segmentBLeftEdgeFixes: Array<{ y: number; newChar: string }>;
  };
  verifiedConnectionPoints: number[];
}

export interface SimplifiedMapData {
  terrain: {
    grid: Array<{ y: number; row: string }>;
  };
  interaction: Array<{
    id: string;
    element: string;
    category?: string;
    anchor: { x: number; y: number };
    size?: { width: number; height: number };
  }>;
}

export interface SchemaData {
  meta: {
    map_size: { width: number; height: number };
    tile_size?: number;
    coordinate_system?: string;
  };
  field_guide?: {
    mapping?: string;
    terrain?: string;
    interaction?: string;
  };
  mapping: {
    [char: string]: {
      name: string;
      description?: string;
      color: string;
      layer: string;
      category?: string;
      default_size?: { width: number; height: number };
    };
  };
}

export interface MapGenerationResult {
  success: boolean;
  mapData?: SimplifiedMapData;
  schema?: SchemaData;
  error?: string;
  layers?: {
    layer1: string;
    layer2: string;
    layer3: string;
  };
  attempts?: MapGenerationAttempt[];
  // 长关卡特有字段
  segments?: any[];
  connectionValidations?: ConnectionValidation[];
}

// ============================================================
// 局部重生成相关接口
// ============================================================

export interface PartialRegenerationRequest {
  prompt: string;              // 用户反馈/更新后的规则
  schema: any;                 // 地图 schema
  mapData: SimplifiedMapData;  // 完整地图数据
  targetSegments: number[];    // 需要重新生成的段索引
  physicsMode?: 'platformer' | 'topdown' | 'freely';
  segmentWidth?: number;       // 默认 17
  segmentHeight?: number;      // 默认 17
  totalSegments?: number;      // 默认 4
}

export interface SegmentData {
  segmentIndex: number;
  terrain: {
    grid: Array<{ y: number; row: string }>;
  };
  interaction: Array<{
    id: string;
    element: string;
    category?: string;
    anchor: { x: number; y: number };
    size?: { width: number; height: number };
  }>;
  connectivity?: {
    left_edge_entry_points: number[];
    right_edge_exit_points: number[];
    notes?: string;
  };
  mapping?: Record<string, any>;
}

export interface MapSplitInfo {
  segments: SegmentData[];
  totalSegments: number;
  segmentWidth: number;
  segmentHeight: number;
}

export interface PartialRegenerationResult {
  success: boolean;
  mapData?: SimplifiedMapData;
  schema?: SchemaData;
  regeneratedSegments?: number[];
  connectionValidations?: ConnectionValidation[];
  error?: string;
}

/**
 * 地图生成服务类 - 后端版本
 */
class MapGenerationService {
  private maxRetries: number = 3;
  private readonly DEFAULT_SEGMENT_SIZE = 17;
  private readonly DEFAULT_SEGMENT_COUNT = 4;

  /**
   * 生成地图 - 主入口
   */
  async generateMap(request: MapGenerationRequest): Promise<MapGenerationResult> {
    try {
      // 设置默认尺寸
      if (!request.width || !request.height) {
        request.width = this.DEFAULT_SEGMENT_SIZE;
        request.height = this.DEFAULT_SEGMENT_SIZE;
      }

      console.log('[MapGeneration] Starting map generation...');
      console.log(`[MapGeneration] Camera Mode: ${request.cameraMode}, Physics Mode: ${request.physicsMode}`);

      // 根据 cameraMode 选择生成逻辑
      if (request.cameraMode === 'fixed') {
        return await this.generateFixedMap(request);
      } else {
        return await this.generateLongMap(request);
      }
    } catch (error) {
      console.error('[MapGeneration] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 获取参考关卡
   */
  private getRefLevel(request: MapGenerationRequest): string {
    if (request.cameraMode === 'fixed' && request.physicsMode === 'topdown') {
      return refLevel_topdown_fixed;
    } else if (request.cameraMode === 'fixed' && request.physicsMode === 'platformer') {
      return refLevel_platformer_fixed;
    } else if (request.physicsMode === 'freely') {
      return refLevel_freely;
    } else {
      return refLevel_platformer;
    }
  }

  // ============================================================
  // Fixed Camera Mode - 单块地图生成逻辑
  // ============================================================

  /**
   * 生成固定镜头地图
   */
  private async generateFixedMap(request: MapGenerationRequest): Promise<MapGenerationResult> {
    console.log('[MapGeneration] Using Fixed Camera Mode (single block generation)');

    const refLevel = this.getRefLevel(request);

    // Layer 1: 特征分析
    console.log('[Layer1] Analyzing features...');
    const layer1Prompt = this.buildLayer1Prompt(request, refLevel);
    const layer1Output = await llmService.callWithRetry(layer1Prompt);

    if (!layer1Output) {
      return {
        success: false,
        error: 'Layer1 feature analysis failed',
      };
    }

    const layer1Result = this.cleanMarkdown(layer1Output, 'yaml');
    console.log('[Layer1] Feature analysis completed');

    // Layer 2: 蓝图生成
    console.log('[Layer2] Generating blueprint...');
    const layer2Prompt = this.buildLayer2Prompt(request, layer1Result, refLevel);
    const layer2Output = await llmService.callWithRetry(layer2Prompt);

    if (!layer2Output) {
      return {
        success: false,
        error: 'Layer2 blueprint generation failed',
      };
    }

    const layer2Result = this.cleanMarkdown(layer2Output, 'yaml');
    console.log('[Layer2] Blueprint generation completed');

    // Layer 3: 具体地图生成（带重试机制）
    console.log('[Layer3] Generating concrete map...');
    const attempts: MapGenerationAttempt[] = [];
    let mapData: any;
    let layer3Result: string = '';

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`[Layer3] Attempt ${attempt}/${this.maxRetries}`);

      const layer3Prompt = this.buildLayer3PromptWithRetryContext(
        request,
        layer2Result,
        attempts.length > 0 ? attempts[attempts.length - 1] : undefined,
        refLevel
      );

      const layer3Output = await llmService.callWithRetry(layer3Prompt);

      if (!layer3Output) {
        const validationResult = {
          success: false,
          error: 'Layer3 map generation failed - no output from LLM',
        };
        attempts.push({
          attempt,
          layer3Output: '',
          validationResult,
        });

        if (attempt === this.maxRetries) {
          return {
            success: false,
            error: `Failed after ${this.maxRetries} attempts: ${validationResult.error}`,
            attempts,
          };
        }
        continue;
      }

      layer3Result = this.cleanMarkdown(layer3Output, 'json');

      try {
        mapData = JSON.parse(layer3Result);
      } catch (error) {
        const validationResult = {
          success: false,
          error: `Failed to parse map JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
        attempts.push({
          attempt,
          layer3Output: layer3Result,
          validationResult,
        });

        console.warn(`[Layer3] Attempt ${attempt} failed: ${validationResult.error}`);

        if (attempt === this.maxRetries) {
          return {
            success: false,
            error: `Failed after ${this.maxRetries} attempts: ${validationResult.error}`,
            attempts,
          };
        }
        continue;
      }

      const validation = this.validateMap(mapData, request);
      attempts.push({
        attempt,
        layer3Output: layer3Result,
        mapData,
        validationResult: validation,
      });

      if (validation.success) {
        console.log(`[Layer3] Map generation completed successfully on attempt ${attempt}`);
        break;
      }

      console.warn(`[Layer3] Attempt ${attempt} validation failed: ${validation.error}`);

      if (attempt === this.maxRetries) {
        return {
          success: false,
          error: `Map validation failed after ${this.maxRetries} attempts: ${validation.error}`,
          attempts,
        };
      }
    }

    console.log('[MapGeneration] Map generation completed successfully');

    const simplifiedMapData: SimplifiedMapData = {
      terrain: mapData.terrain,
      interaction: mapData.interaction || [],
    };

    const outputSchema: SchemaData = request.schema || {
      meta: {
        map_size: {
          width: request.width,
          height: request.height,
        },
        tile_size: 32,
      },
      mapping: {},
    };

    return {
      success: true,
      mapData: simplifiedMapData,
      schema: outputSchema,
      layers: {
        layer1: layer1Result,
        layer2: layer2Result,
        layer3: layer3Result,
      },
      attempts,
    };
  }

  // ============================================================
  // Scrolling Mode - 长关卡分段生成逻辑
  // ============================================================

  /**
   * 生成长关卡（分段生成）
   */
  private async generateLongMap(request: MapGenerationRequest): Promise<MapGenerationResult> {
    console.log('[MapGeneration] Using Scrolling Mode (long level segmented generation)');

    const segmentCount = 4;
    const refLevel = this.getRefLevel(request);

    // Layer 1: 特征分析
    console.log('[Layer1] Analyzing features...');
    const layer1Prompt = this.buildLayer1Prompt(request, refLevel);
    const layer1Output = await llmService.callWithRetry(layer1Prompt);

    if (!layer1Output) {
      return {
        success: false,
        error: 'Layer1 feature analysis failed',
      };
    }

    const layer1Result = this.cleanMarkdown(layer1Output, 'yaml');
    console.log('[Layer1] Feature analysis completed');

    // Layer 2: 蓝图生成
    console.log('[Layer2] Generating blueprint...');
    const layer2Prompt = this.buildLayer2PromptForLongLevel(request, layer1Result, refLevel, segmentCount);
    const layer2Output = await llmService.callWithRetry(layer2Prompt);

    if (!layer2Output) {
      return {
        success: false,
        error: 'Layer2 blueprint generation failed',
      };
    }

    const layer2Result = this.cleanMarkdown(layer2Output, 'yaml');
    console.log('[Layer2] Blueprint generation completed');

    // Layer 3: 分段生成
    console.log(`[Layer3] Generating ${segmentCount} segments...`);

    const segments: any[] = [];
    const connectionValidations: ConnectionValidation[] = [];

    // Step 3.1: 生成初始块（包含Player）
    console.log('[Layer3.1] Generating initial segment (with player)...');
    const initialSegment = await this.generateInitialSegment(request, layer2Result, refLevel);
    if (!initialSegment) {
      return {
        success: false,
        error: 'Failed to generate initial segment',
      };
    }
    segments.push(initialSegment);

    // Step 3.2: 循环生成扩展块
    for (let i = 1; i < segmentCount; i++) {
      console.log(`[Layer3.2] Generating extension segment ${i}/${segmentCount - 1}...`);

      const prevSegment = segments[segments.length - 1];
      const extensionSegment = await this.generateExtensionSegment(
        request,
        layer2Result,
        refLevel,
        i,
        segmentCount,
        prevSegment
      );

      if (!extensionSegment) {
        return {
          success: false,
          error: `Failed to generate extension segment ${i}`,
          segments,
        };
      }
      segments.push(extensionSegment);

      // Step 3.3: 验证与前一块的连接
      console.log(`[Layer3.3] Validating connection ${i - 1} ↔ ${i}...`);
      const validation = await this.validateAndRepairConnection(
        request,
        segments[i - 1],
        segments[i],
        i - 1,
        i
      );
      connectionValidations.push(validation);

      // 如果连接无效，应用修复
      if (validation.validationResult === 'invalid' && validation.repairs) {
        console.log(`[Layer3.3] Connection invalid, applying repairs...`);
        this.applyRepairs(segments[i - 1], segments[i], validation.repairs);
      }
    }

    // Step 3.4: 合并所有段落
    console.log('[Layer3.4] Merging all segments...');
    const mergedMapData = this.mergeSegments(segments, request);

    const totalWidth = request.width * segmentCount;
    const outputSchema: SchemaData = request.schema || {
      meta: {
        map_size: {
          width: totalWidth,
          height: request.height,
        },
        tile_size: 32,
      },
      mapping: segments[0]?.mapping || {},
    };

    // 更新 schema 中的地图尺寸
    if (outputSchema.meta) {
      outputSchema.meta.map_size = {
        width: totalWidth,
        height: request.height,
      };
    }

    console.log('[MapGeneration] Long level generation completed successfully');

    return {
      success: true,
      mapData: mergedMapData,
      schema: outputSchema,
      layers: {
        layer1: layer1Result,
        layer2: layer2Result,
        layer3: JSON.stringify(mergedMapData, null, 2),
      },
      segments,
      connectionValidations,
    };
  }

  /**
   * 生成初始块（包含Player）
   */
  private async generateInitialSegment(
    request: MapGenerationRequest,
    layer2Output: string,
    refLevel: string
  ): Promise<any> {
    const prompt = this.buildLayer3Step1Prompt(request, layer2Output, refLevel);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`[Layer3.1] Attempt ${attempt}/${this.maxRetries}`);

      const output = await llmService.callWithRetry(prompt);
      if (!output) continue;

      const cleaned = this.cleanMarkdown(output, 'json');

      try {
        const segmentData = JSON.parse(cleaned);
        const validation = this.validateInitialSegment(segmentData, request);

        if (validation.success) {
          return segmentData;
        }

        console.warn(`[Layer3.1] Validation failed: ${validation.error}`);
      } catch (error) {
        console.warn(`[Layer3.1] JSON parse failed: ${error}`);
      }
    }

    return null;
  }

  /**
   * 生成扩展块（不包含Player）
   */
  private async generateExtensionSegment(
    request: MapGenerationRequest,
    layer2Output: string,
    refLevel: string,
    segmentIndex: number,
    totalSegments: number,
    prevSegment: any
  ): Promise<any> {
    const rightEdge = this.extractRightEdge(prevSegment, request.width);
    const exitPoints = prevSegment.connectivity?.right_edge_exit_points || this.inferExitPoints(rightEdge);

    const prompt = this.buildLayer3Step2Prompt(
      request,
      layer2Output,
      refLevel,
      segmentIndex,
      rightEdge,
      exitPoints,
      totalSegments
    );

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`[Layer3.2] Segment ${segmentIndex} - Attempt ${attempt}/${this.maxRetries}`);

      const output = await llmService.callWithRetry(prompt);
      if (!output) continue;

      const cleaned = this.cleanMarkdown(output, 'json');

      try {
        const segmentData = JSON.parse(cleaned);
        const validation = this.validateExtensionSegment(segmentData, request, exitPoints, segmentIndex === totalSegments - 1);

        if (validation.success) {
          return segmentData;
        }

        console.warn(`[Layer3.2] Validation failed: ${validation.error}`);
      } catch (error) {
        console.warn(`[Layer3.2] JSON parse failed: ${error}`);
      }
    }

    return null;
  }

  /**
   * 验证并修复连接
   */
  private async validateAndRepairConnection(
    request: MapGenerationRequest,
    segmentA: any,
    segmentB: any,
    indexA: number,
    indexB: number
  ): Promise<ConnectionValidation> {
    const rightEdge = this.extractRightEdge(segmentA, request.width);
    const leftEdge = this.extractLeftEdge(segmentB);
    const exitPoints = segmentA.connectivity?.right_edge_exit_points || this.inferExitPoints(rightEdge);
    const entryPoints = segmentB.connectivity?.left_edge_entry_points || exitPoints;

    // 检查连接有效性
    const issues: ConnectionValidation['issuesFound'] = [];
    const verifiedPoints: number[] = [];

    for (const y of exitPoints) {
      const rightChar = rightEdge[y];
      const leftChar = leftEdge[y];

      // 检查是否都是可通行的
      const rightPassable = this.isPassable(rightChar);
      const leftPassable = this.isPassable(leftChar);

      if (rightPassable && leftPassable) {
        verifiedPoints.push(y);
      } else {
        issues.push({
          type: rightPassable ? 'entry_blocked' : 'exit_blocked',
          description: `Connection blocked at y=${y}: right="${rightChar}", left="${leftChar}"`,
          affectedYCoordinates: [y],
        });
      }
    }

    const isValid = verifiedPoints.length > 0;

    // 生成修复方案
    let repairs: ConnectionValidation['repairs'] | undefined;
    if (!isValid && issues.length > 0) {
      repairs = {
        segmentARightEdgeFixes: [],
        segmentBLeftEdgeFixes: [],
      };

      // 找到一个可以修复的点
      const fixY = exitPoints[0] || Math.floor(request.height / 2);
      if (!this.isPassable(rightEdge[fixY])) {
        repairs.segmentARightEdgeFixes.push({ y: fixY, newChar: '.' });
      }
      if (!this.isPassable(leftEdge[fixY])) {
        repairs.segmentBLeftEdgeFixes.push({ y: fixY, newChar: '.' });
      }
    }

    return {
      segmentAIndex: indexA,
      segmentBIndex: indexB,
      validationResult: isValid ? 'valid' : 'invalid',
      issuesFound: issues,
      repairs,
      verifiedConnectionPoints: verifiedPoints,
    };
  }

  /**
   * 应用修复
   */
  private applyRepairs(segmentA: any, segmentB: any, repairs: ConnectionValidation['repairs']): void {
    if (!repairs) return;

    const widthA = segmentA.terrain?.grid?.[0]?.row?.length || 0;

    // 修复 segment A 的右边缘
    for (const fix of repairs.segmentARightEdgeFixes) {
      const row = segmentA.terrain?.grid?.find((r: any) => r.y === fix.y);
      if (row && row.row) {
        const chars = row.row.split('');
        chars[widthA - 1] = fix.newChar;
        row.row = chars.join('');
      }
    }

    // 修复 segment B 的左边缘
    for (const fix of repairs.segmentBLeftEdgeFixes) {
      const row = segmentB.terrain?.grid?.find((r: any) => r.y === fix.y);
      if (row && row.row) {
        const chars = row.row.split('');
        chars[0] = fix.newChar;
        row.row = chars.join('');
      }
    }
  }

  /**
   * 合并所有段落
   */
  private mergeSegments(segments: any[], request: MapGenerationRequest): SimplifiedMapData {
    const totalWidth = request.width * segments.length;

    // 合并 terrain
    const mergedGrid: Array<{ y: number; row: string }> = [];
    for (let y = 0; y < request.height; y++) {
      let mergedRow = '';
      for (const segment of segments) {
        const row = segment.terrain?.grid?.find((r: any) => r.y === y);
        mergedRow += row?.row || '.'.repeat(request.width);
      }
      mergedGrid.push({ y, row: mergedRow });
    }

    // 合并 interaction，调整 x 坐标
    const mergedInteraction: SimplifiedMapData['interaction'] = [];
    segments.forEach((segment, segIndex) => {
      const xOffset = segIndex * request.width;
      (segment.interaction || []).forEach((item: any) => {
        mergedInteraction.push({
          ...item,
          anchor: {
            ...item.anchor,
            x: item.anchor.x + xOffset,
          },
        });
      });
    });

    return {
      terrain: {
        grid: mergedGrid,
      },
      interaction: mergedInteraction,
    };
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 提取右边缘
   */
  private extractRightEdge(segment: any, width: number): string[] {
    if (!segment?.terrain?.grid) return [];
    return segment.terrain.grid.map((row: any) => {
      const rowStr = row.row || '';
      return rowStr.charAt(width - 1) || '.';
    });
  }

  /**
   * 提取左边缘
   */
  private extractLeftEdge(segment: any): string[] {
    if (!segment?.terrain?.grid) return [];
    return segment.terrain.grid.map((row: any) => {
      const rowStr = row.row || '';
      return rowStr.charAt(0) || '.';
    });
  }

  /**
   * 推断出口点（从边缘字符推断可通行的Y坐标）
   */
  private inferExitPoints(edge: string[]): number[] {
    const points: number[] = [];
    for (let y = 0; y < edge.length; y++) {
      if (this.isPassable(edge[y])) {
        points.push(y);
      }
    }
    // 如果没有找到可通行点，返回中间位置
    if (points.length === 0) {
      points.push(Math.floor(edge.length / 2));
    }
    return points;
  }

  /**
   * 判断字符是否可通行（暂不考虑）
   */
  private isPassable(char: string): boolean {
    // 常见的墙壁/障碍物字符
    const wallChars = ['W', '#', 'X', 'B'];
    // return !wallChars.includes(char);
    return true;
  }

  /**
   * 计算难度等级
   */
  // private calculateDifficulty(segmentIndex: number, totalSegments: number): string {
  //   const progress = segmentIndex / (totalSegments - 1);
  //   if (progress < 0.3) return 'easy';
  //   if (progress < 0.7) return 'medium';
  //   return 'hard';
  // }

  /**
   * 验证初始块
   */
  private validateInitialSegment(
    segment: any,
    request: MapGenerationRequest
  ): { success: boolean; error?: string } {
    // 检查基本结构
    if (!segment.terrain?.grid) {
      return { success: false, error: 'Missing terrain.grid' };
    }

    // 检查是否有 player
    const hasPlayer = segment.interaction?.some(
      (e: any) => e.id === 'player' || e.element === 'P'
    );
    if (!hasPlayer) {
      return { success: false, error: 'Initial segment must contain a player' };
    }

    // 检查尺寸
    return this.validateSegmentSize(segment, request);
  }

  /**
   * 验证扩展块
   */
  private validateExtensionSegment(
    segment: any,
    request: MapGenerationRequest,
    expectedEntryPoints: number[],
    isFinalSegment: boolean
  ): { success: boolean; error?: string } {
    // 检查基本结构
    if (!segment.terrain?.grid) {
      return { success: false, error: 'Missing terrain.grid' };
    }

    // 检查没有 player
    const hasPlayer = segment.interaction?.some(
      (e: any) => e.id === 'player' || e.element === 'P'
    );
    if (hasPlayer) {
      return { success: false, error: 'Extension segment must NOT contain a player' };
    }

    // 检查尺寸
    const sizeValidation = this.validateSegmentSize(segment, request);
    if (!sizeValidation.success) {
      return sizeValidation;
    }

    // 检查左边缘入口点（非最终块需要检查）
    if (!isFinalSegment) {
      const leftEdge = this.extractLeftEdge(segment);
      const blockedEntries = expectedEntryPoints.filter((y) => {
        const char = leftEdge[y];
        return !this.isPassable(char);
      });

      if (blockedEntries.length === expectedEntryPoints.length) {
        return {
          success: false,
          error: `All entry points blocked at Y: [${blockedEntries.join(', ')}]`,
        };
      }
    }

    return { success: true };
  }

  /**
   * 验证段落尺寸
   */
  private validateSegmentSize(
    segment: any,
    request: MapGenerationRequest
  ): { success: boolean; error?: string } {
    const grid = segment.terrain?.grid;
    if (!grid || grid.length !== request.height) {
      return {
        success: false,
        error: `Expected ${request.height} rows, got ${grid?.length || 0}`,
      };
    }

    for (const row of grid) {
      if (row.row?.length !== request.width) {
        return {
          success: false,
          error: `Row ${row.y} has ${row.row?.length || 0} chars, expected ${request.width}`,
        };
      }
    }

    return { success: true };
  }

  // ============================================================
  // 提示词构建方法 - Layer1 & Layer2
  // ============================================================

  /**
   * 构建Layer1提示词 - 特征分析
   */
  private buildLayer1Prompt(request: MapGenerationRequest, refLevel: string): string {
    return `# Map Generation - Layer 1: Layout Feature Analysis

You are a game design expert. Your goal is to extract reusable structural patterns from the example level below.
Do NOT rewrite the level. Do NOT invent elements. Only analyze what exists.

## Example Level
${refLevel}

## Analysis Objectives
Focus on extracting abstract layout patterns that can guide procedural generation.

1. Global Structure Pattern: Identify the overall structural type. Examples:
   - linear progression
   - layered vertical platforms
   - central hub with branches
  Describe:
   - Number of distinct structural zones (if any)
   - Whether the map is symmetric or asymmetric
2. Spatial Density Distribution: Divide the map conceptually into regions
   - top / middle / bottom
   - left / center / right
  Then describe(Avoid vague terms like “somewhat crowded”. Be specific about relative location):
   - dense_areas: Regions with high terrain or object concentration
   - open_areas: Regions with large traversable empty space
   - bottlenecks: Narrow passages that restrict movement
   - key_path: Likely intended player progression route
3. Terrain Distribution Logi(Describe the pattern, not the tiles)
  Analyze terrain placement rules:
   - Is ground continuous or fragmented?
   - Are platforms evenly spaced or irregular?
   - Are vertical stacks used?
   - Are boundaries clearly defined?
   - Is terrain clustered around edges or central?
4. Character Placement Pattern(Focus on placement strategy rather than exact coordinates)
  Describe systematic placement logic:
   - Player spawn position (edge, corner, center, elevated?)
   - Enemy clustering (near obstacles? guarding platforms?)
   - Distribution symmetry or randomness
   - Proximity to key path

## Output Format
\`\`\`yaml
global_structure:
  type: 
  flow_direction:
  zone_count:
  symmetry:

spatial_distribution:
  dense_areas:
  open_areas:
  bottlenecks:
  key_path:

terrain_pattern:
  continuity:
  verticality:
  clustering:
  boundary_definition:

character_pattern:
  player_spawn:
  enemy_distribution:
  symmetry:
  strategic_role:
\`\`\``;
  }

  /**
   * 构建Layer2提示词 - 蓝图生成
   */
  private buildLayer2Prompt(request: MapGenerationRequest, layer1Result: string, refLevel: string): string {
    return `# Map Generation - Layer 2: Blueprint Generation

You are a procedural level design planner. Your task is to convert the structural analysis (Layer 1) into a generation-ready constraint blueprint.
This blueprint will be used by Layer 3 to construct the actual tile grid and interaction layer.
Do NOT describe the level narratively.
Define constraints, proportions, distributions, and placement rules.

## Map Information
- Size: ${request.width} × ${request.height} cells
- Coordinate System: Top-left corner is origin (0,0)

## Structural Features (from Layer 1)
${layer1Result}

## Schema
${request.schema ? JSON.stringify(request.schema, null, 2) : 'No schema provided'}
**CRITICAL WARNING**
  - Every element referenced MUST exist in the Schema.
  - Do NOT invent new elements.
  - Use only Schema-defined names.
  - Do NOT copy element symbols from reference data.

## Reference Data (Structure Inspiration Only)
${refLevel}


## Objectives
Convert Layer 1 structure into:
1. Zone Partition Constraints
2. Element Distribution Constraints
3. Path & Connectivity Constraints
4. Density & Rhythm Profile
5. Difficulty Curve Model

## Output Format

Output your blueprint in YAML format:

\`\`\`yaml
zone_partition:
  progression_direction: left_to_right / right_to_left / top_to_bottom / bottom_to_top / mixed
  zone_count: integer
  zones:
    - name: start
      x_range: [min, max]   # optional if directional partition
      y_range: [min, max]
      area_ratio: 0.0–1.0
      difficulty_level: safe / easy / medium / hard
    - name: mid
      area_ratio:
      difficulty_level:
    - name: final
      area_ratio:
      difficulty_level:

element_distribution:
  terrain_rules:
    boundary_required: true / false
    vertical_layers: integer or range
    platform_spacing: tight / medium / wide
    fragmentation: low / medium / high

  interactive_rules:
    density_by_zone:
      start: sparse / medium / dense
      mid: sparse / medium / dense
      final: sparse / medium / dense
    placement_logic:
      - element: [schema element name]
        zones: [list of zones]
        proximity: near_obstacles / open_area / key_path / elevated / random
        count_range_per_zone: [min, max]

path_constraints:
  connectivity_required: true
  min_corridor_width: integer
  bottlenecks_required: true / false
  branching_allowed: true / false
  vertical_traversal_required: true / false

density_profile:
  left_region: sparse / medium / dense
  center_region: sparse / medium / dense
  right_region: sparse / medium / dense
  top_region: sparse / medium / dense
  bottom_region: sparse / medium / dense

difficulty_curve:
  type: linear / stepped / spike / wave
  rest_zones_required: integer
  peak_zone: start / mid / final
\`\`\``;
  }

  /**
   * 构建Layer2提示词 - 长关卡蓝图生成
   */
  private buildLayer2PromptForLongLevel(
    request: MapGenerationRequest,
    layer1Result: string,
    refLevel: string,
    segmentCount: number
  ): string {
    const totalWidth = request.width * segmentCount;

    return `# Map Generation - Layer 2: Long Level Blueprint Generation

You are a procedural long-level planner.
Your task is to convert Layer 1 structural analysis into a segment-based constraint blueprint for a scrolling level divided into ${segmentCount} segments.
This blueprint must define(Do NOT narrate the level, Define generation-ready constraints only):
  - Per-segment generation constraints
  - Cross-segment connectivity rules
  - Difficulty rhythm model
  - Structural continuity model

## Map Information
- **Segment Size**: ${request.width} × ${request.height}
- **Total Segments**: ${segmentCount}
- **Total Width**: ${totalWidth} × ${request.height} cells
- **Coordinate System**: Top-left corner is origin (0,0)

## Structural Features (from Layer 1)
${layer1Result}

## Schema
${request.schema ? JSON.stringify(request.schema, null, 2) : 'No schema provided'}
**CRITICAL WARNING**
  - Every element referenced MUST exist in the Schema.
  - Do NOT invent new elements.
  - Use only Schema-defined names.
  - Do NOT copy element symbols from reference data.

## Reference Data (Structure Inspiration Only)
${refLevel}

## Your Task

Create a blueprint for a long, scrolling level divided into ${segmentCount} segments:

1. **Segment Planning**: Define the purpose of each segment
   - Segment 0: Starting area (contains player spawn)
   - Segments 1-${segmentCount - 2}: Progressive challenge areas
   - Segment ${segmentCount - 1}: Final/objective area
2. **Connectivity Requirements**: Each segment must connect to the next
   - Define typical path heights (Y coordinates where paths should connect)
   - Ensure smooth transitions between segments

## Output Format

\`\`\`yaml
level_structure:
  progression_direction: left_to_right
  total_segments: ${segmentCount}
  global_difficulty_curve: linear / stepped / wave / spike
  structural_complexity_trend: increasing / constant / wave

segment_constraints:
  - segment_index: 0
    role: start
    difficulty_level: safe
    terrain_complexity: low / medium / high
    vertical_layers: integer
    enemy_density: sparse / medium / dense
    interactive_density: sparse / medium / dense
    exit_interface:
      required: true
      y_range: [min, max]
      min_width: integer

  - segment_index: 1
    role: challenge
    difficulty_level: easy / medium
    terrain_complexity:
    vertical_layers:
    enemy_density:
    interactive_density:
    entry_interface:
      y_range: [min, max]
    exit_interface:
      y_range: [min, max]
      min_width:

  # ... repeat ...

  - segment_index: ${segmentCount - 1}
    role: finale
    difficulty_level: hard
    terrain_complexity:
    vertical_layers:
    enemy_density:
    interactive_density:
    entry_interface:
      y_range: [min, max]
    exit_interface:
      required: false

connectivity_protocol:
  enforce_y_alignment: true
  max_vertical_shift_between_segments: integer
  min_corridor_width: integer
  bottleneck_allowed: true / false
  vertical_traversal_required: true / false

density_rhythm:
  segment_pattern: [sparse, medium, dense, medium, dense, ...]
  visual_variation_interval: integer

difficulty_wave_model:
  early_phase_segments: [indices]
  mid_phase_segments: [indices]
  climax_segments: [indices]
  rest_segments: [indices]

generation_constraints_for_layer3: |
  - Each segment must be internally connected.
  - Adjacent segments must align on interface y-range.
  - Maintain schema compliance.
  - Preserve progression direction.
  - Respect density rhythm pattern.
\`\`\``;
  }

  // ============================================================
  // 提示词构建方法 - Layer3 (Fixed Mode)
  // ============================================================

  /**
   * 构建Layer3提示词 - 具体地图生成（Fixed Mode）
   */
  private buildLayer3Prompt(request: MapGenerationRequest, layer2Output: string, refLevel: string): string {
    return `# Map Generation - Layer 3: Concrete Map Generation

You are a game design expert. Based on the blueprint, generate the actual map data in JSON format.

## Map Information
- **Size**: ${request.width} × ${request.height} cells
- **Coordinate System**: Top-left corner is origin (0,0)

## Schema
${request.schema ? JSON.stringify(request.schema, null, 2) : 'No schema provided'}
**CRITICAL WARNING**
  - All elements mentioned in your blueprint (e.g., in the elements lists) MUST be derived exclusively from the Schema above.
  - DO NOT use any characters, names, or concepts that are not explicitly defined in the Schema.

## Reference Data (FOR LAYOUT REFERENCE ONLY)
${refLevel}
Note
- The reference data is provided ONLY to inspire the spatial structure, pacing, and layout logic (e.g., where to place dense vs. sparse areas). DO NOT extract element symbols or specific rules from the reference data. The Schema remains the sole source of truth for elements.

## Blueprint (from Layer 2)
${layer2Output}

## CRITICAL OUTPUT REQUIREMENTS

You MUST output a JSON object with this exact structure:

\`\`\`json
{
  "terrain": {
    "grid": [
      { "y": 0, "row": "...." },
      { "y": 1, "row": "...." },
      ...
    ]
  },
  "interaction": [
    {
      "id": "player",
      "element": "P",
      "category": "character",
      "anchor": { "x": 2, "y": 10 },
      "size": { "width": 1, "height": 1 }
    },
    {
      "id": "enemy",
      "element": "E",
      "category": "character",
      "anchor": { "x": 15, "y": 5 },
      "size": { "width": 1, "height": 1 }
    }
  ],
  "mapping": ${request.schema?.mapping ? JSON.stringify(request.schema.mapping, null, 2).split('\n').map(line => '    ' + line).join('\n') : '{}'},
  "meta": {
    "map_size": { "width": ${request.width}, "height": ${request.height} },
    "tile_size": 32,
    "coordinate_system": "Top-left corner is origin (0,0)"
  }
}
\`\`\`

## CRITICAL RULES

1. **IMPORTANT** ID & Mapping Consistency: The id field in the interaction array MUST be the Type Name and MUST STRICTLY MATCH the name property defined in the mapping object for that element. (e.g., if mapping defines element "E" with "name": "enemy", then ALL interaction objects using "E" MUST have "id": "enemy").

2. **Exact Dimensions**: You MUST generate EXACTLY ${request.height} rows, and each row MUST have EXACTLY ${request.width} characters

3. **Character Encoding**:
   - Use single uppercase letters (A-Z) for elements
   - **All characters and elements used MUST be derived exclusively from the provided Schema. DO NOT use any elements or characters not defined in the Schema**

4. **Output ONLY JSON**: Do NOT include any explanatory text before or after the JSON. Start your response with \`{\` and end with \`}\`

5. **Valid JSON Syntax**:
   - All opening brackets \`{ [\` must have matching closing brackets \`} ]\`
   - All strings must be quoted with double quotes
   - No trailing commas

6. **Required Structure**:
   - \`terrain.grid\`: Array of objects with \`y\` (number) and \`row\` (string)
   - \`interaction\`: Array of interactive objects (can be empty)
   - \`mapping\`: Object defining each character used
   - \`meta\`: Object with map metadata
Generate the map data now.`;
  }

  /**
   * 构建Layer3提示词（带重试上下文）- Fixed Mode
   */
  private buildLayer3PromptWithRetryContext(
    request: MapGenerationRequest,
    layer2Output: string,
    previousAttempt?: MapGenerationAttempt,
    refLevel?: string
  ): string {
    if (!previousAttempt) {
      return this.buildLayer3Prompt(request, layer2Output, refLevel!);
    }

    const basePrompt = this.buildLayer3Prompt(request, layer2Output, refLevel!);
    const errorContext = this.formatErrorContext(previousAttempt, request);

    return `${basePrompt}

---

## RETRY CONTEXT - PREVIOUS ATTEMPT FAILED

Your previous generation attempt had the following issues:

${errorContext}

**CRITICAL INSTRUCTIONS FOR THIS RETRY**:
1. Carefully read the error message above
2. Identify what went wrong in the previous attempt
3. Generate a CORRECTED version that fixes these specific issues
4. Double-check dimensions before outputting: ${request.height} rows × ${request.width} columns

**Previous attempt's output** (for reference):
\`\`\`json
${previousAttempt.mapData ? JSON.stringify(previousAttempt.mapData, null, 2) : previousAttempt.layer3Output}
\`\`\`

Now generate the CORRECTED map data:`;
  }

  // ============================================================
  // 提示词构建方法 - Layer3 (Long Level Mode)
  // ============================================================

  /**
   * Layer 3.1: 生成初始块（包含Player）
   */
  private buildLayer3Step1Prompt(
    request: MapGenerationRequest,
    layer2Output: string,
    refLevel: string
  ): string {
    return `# Map Generation - Layer 3.1: Initial Segment Generation (WITH PLAYER)

You are a game design expert. Generate the FIRST segment of a long level that contains the player spawn point.

## Segment Information
- **Size**: ${request.width} × ${request.height} cells
- **Segment Index**: 0 (Initial Segment)
- **Coordinate System**: Top-left corner is origin (0,0)

## Schema
${request.schema ? JSON.stringify(request.schema, null, 2) : 'No schema provided'}
**CRITICAL WARNING**
  - All elements MUST be derived exclusively from the Schema above.
  - DO NOT use any characters not defined in the Schema.

## Reference Data (FOR LAYOUT REFERENCE ONLY)
${refLevel}

## Blueprint (from Layer 2)
${layer2Output}

## CRITICAL REQUIREMENTS FOR INITIAL SEGMENT

1. **MUST Include Player**: This segment MUST contain exactly ONE player spawn point
2. **Safe Starting Area**: The area around the player should be relatively safe (starting zone)
3. **Right Edge Connectivity**: The RIGHT edge of this segment must have passable terrain that can connect to the next segment
   - Ensure at least one continuous path leads to the right edge
   - Do NOT block the right edge completely with walls
   - Mark the "exit points" on the right edge where the path continues

## EXIT POINT RULES
- At least ONE row on the right edge (x = ${request.width - 1}) must be passable (not a wall)
- These exit points should align with the main traversal path
- Document the Y coordinates of exit points in the output

## Output Format

\`\`\`json
{
  "segment_index": 0,
  "segment_type": "initial",
  "terrain": {
    "grid": [
      { "y": 0, "row": "...." },
      { "y": 1, "row": "...." }
    ]
  },
  "interaction": [
    {
      "id": "player",
      "element": "P",
      "category": "character",
      "anchor": { "x": 2, "y": 10 },
      "size": { "width": 1, "height": 1 }
    }
  ],
  "connectivity": {
    "right_edge_exit_points": [5, 6, 7],
    "notes": "Exit points at y=5,6,7 connect to next segment"
  },
  "mapping": ${request.schema?.mapping ? JSON.stringify(request.schema.mapping, null, 2).split('\n').map(line => '  ' + line).join('\n') : '{}'}
}
\`\`\`

## CRITICAL RULES

1. **Exact Dimensions**: Generate EXACTLY ${request.height} rows, each with EXACTLY ${request.width} characters
2. **One Player Only**: Include exactly ONE player character
3. **Right Edge Open**: Ensure connectivity paths on right edge
4. **Output ONLY JSON**: No explanatory text, start with \`{\` and end with \`}\`

Generate the initial segment now.`;
  }

  /**
   * Layer 3.2: 生成扩展块（不包含Player）
   */
  private buildLayer3Step2Prompt(
    request: MapGenerationRequest,
    layer2Output: string,
    refLevel: string,
    segmentIndex: number,
    previousSegmentRightEdge: string[],
    previousExitPoints: number[],
    totalSegments: number
  ): string {
    const isLastSegment = segmentIndex === totalSegments - 1;
    // const difficultyLevel = this.calculateDifficulty(segmentIndex, totalSegments);

    return `# Map Generation - Layer 3.2: Extension Segment Generation (NO PLAYER)

You are a game design expert. Generate segment #${segmentIndex} of a long level.

## Segment Information
- **Size**: ${request.width} × ${request.height} cells
- **Segment Index**: ${segmentIndex} of ${totalSegments - 1}
- **Is Final Segment**: ${isLastSegment}

## Schema
${request.schema ? JSON.stringify(request.schema, null, 2) : 'No schema provided'}

## Reference Data (FOR LAYOUT REFERENCE ONLY)
${refLevel}

## Blueprint (from Layer 2)
${layer2Output}

## CONNECTIVITY REQUIREMENTS - CRITICAL!

### Previous Segment's Right Edge (Your Left Edge Must Connect)
The previous segment ends with these rows on its right edge (x = ${request.width - 1}):
\`\`\`
${previousSegmentRightEdge.map((char, y) => `y=${y}: "${char}"`).join('\n')}
\`\`\`

### Entry Points from Previous Segment
The player can enter this segment at Y coordinates: [${previousExitPoints.join(', ')}]

### LEFT EDGE CONNECTION RULES (CRITICAL!)
1. **Your left edge (x = 0) MUST have passable terrain at Y coordinates: [${previousExitPoints.join(', ')}]**
2. These entry points must connect to traversable paths within your segment
3. Do NOT place walls at entry points - this would make the level unplayable!

### RIGHT EDGE CONNECTION RULES
${isLastSegment ? `
- This is the FINAL segment - right edge can be closed (wall) or contain the goal/exit
- Place objective elements (goal, boss, exit) in this segment
` : `
- Right edge must have exit points for the NEXT segment
- At least ONE row on right edge must be passable
- Document exit point Y coordinates in output
`}

## SEGMENT CONTENT RULES

1. **NO PLAYER**: This segment must NOT contain a player spawn point
2. **Continuity**: Terrain style should match previous segments
3. **Variety**: Introduce new challenges while maintaining playability

## Output Format

\`\`\`json
{
  "segment_index": ${segmentIndex},
  "segment_type": "${isLastSegment ? 'final' : 'extension'}",
  "terrain": {
    "grid": [
      { "y": 0, "row": "...." },
      { "y": 1, "row": "...." }
    ]
  },
  "interaction": [
    {
      "id": "enemy",
      "element": "E",
      "category": "character",
      "anchor": { "x": 10, "y": 5 },
      "size": { "width": 1, "height": 1 }
    }
  ],
  "connectivity": {
    "left_edge_entry_points": [${previousExitPoints.join(', ')}],
    "right_edge_exit_points": ${isLastSegment ? '[]' : '[5, 6, 7]'},
    "notes": "Entry from previous segment verified, ${isLastSegment ? 'final segment - no exit needed' : 'exit points for next segment'}"
  },
  "mapping": ${request.schema?.mapping ? JSON.stringify(request.schema.mapping, null, 2).split('\n').map(line => '  ' + line).join('\n') : '{}'}
}
\`\`\`

## VALIDATION CHECKLIST
- [ ] Left edge has passable terrain at entry points [${previousExitPoints.join(', ')}]
- [ ] No player character in this segment
- [ ] Exactly ${request.height} rows × ${request.width} columns
- [ ] ${isLastSegment ? 'Contains goal/objective elements' : 'Right edge has documented exit points'}
- [ ] All paths are connected (no dead ends blocking progression)

Generate segment #${segmentIndex} now.`;
  }

  // ============================================================
  // 通用辅助方法
  // ============================================================

  /**
   * 格式化错误上下文
   */
  private formatErrorContext(
    attempt: MapGenerationAttempt,
    request: MapGenerationRequest
  ): string {
    const error = attempt.validationResult.error || 'Unknown error';

    let context = `**Error**: ${error}\n\n`;

    if (error.includes('width mismatch') || error.includes('height mismatch')) {
      context += `**Root Cause**: The generated map dimensions don't match requirements.\n`;
      context += `**Required**: ${request.height} rows, each with EXACTLY ${request.width} characters\n`;
      context += `**Fix**: Count your rows and characters carefully.\n`;
    } else if (error.includes('JSON parsing failed') || error.includes('parse map JSON')) {
      context += `**Root Cause**: The output is not valid JSON.\n`;
      context += `**Fix**: Ensure proper JSON syntax. OUTPUT ONLY THE JSON OBJECT!\n`;
    } else if (error.includes('Missing terrain.grid')) {
      context += `**Root Cause**: Required field 'terrain.grid' is missing.\n`;
      context += `**Fix**: Ensure the JSON has the structure: { "terrain": { "grid": [...] } }\n`;
    }

    return context;
  }

  /**
   * 清理markdown标记
   */
  private cleanMarkdown(output: string, type: 'json' | 'yaml'): string {
    let cleaned = output.trim();

    const codeBlockPattern = new RegExp(`\`\`\`${type}\\n?`, 'g');
    cleaned = cleaned.replace(codeBlockPattern, '');
    cleaned = cleaned.replace(/```\n?/g, '');

    if (cleaned.startsWith('```')) {
      const firstNewline = cleaned.indexOf('\n');
      if (firstNewline !== -1) {
        cleaned = cleaned.substring(firstNewline + 1);
      }
    }

    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }

    cleaned = cleaned.trim();

    if (type === 'json') {
      cleaned = this.extractJSON(cleaned);
    }

    return cleaned;
  }

  /**
   * 从文本中提取 JSON 对象
   */
  private extractJSON(text: string): string {
    try {
      JSON.parse(text);
      return text;
    } catch {
      // Continue extraction
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      return text;
    }

    const potentialJSON = text.substring(firstBrace, lastBrace + 1);

    try {
      JSON.parse(potentialJSON);
      return potentialJSON;
    } catch {
      return text;
    }
  }

  /**
   * 验证地图数据（用于 Fixed Mode）
   */
  private validateMap(
    mapData: any,
    request: MapGenerationRequest
  ): { success: boolean; error?: string } {
    if (!mapData.terrain || !mapData.terrain.grid) {
      return {
        success: false,
        error: 'Missing terrain.grid in map data. Expected structure: { terrain: { grid: [...] } }',
      };
    }

    const grid = mapData.terrain.grid;
    if (!Array.isArray(grid) || grid.length === 0) {
      return {
        success: false,
        error: `Terrain grid is empty or invalid. Expected an array with ${request.height} rows.`,
      };
    }

    const actualHeight = grid.length;
    const actualWidth = grid[0]?.row?.length || 0;

    if (actualHeight !== request.height) {
      return {
        success: false,
        error: `Map height mismatch: expected ${request.height} rows, got ${actualHeight} rows.`,
      };
    }

    if (actualWidth !== request.width) {
      return {
        success: false,
        error: `Map width mismatch: expected ${request.width} columns, got ${actualWidth} columns.`,
      };
    }

    for (let i = 0; i < grid.length; i++) {
      const row = grid[i];
      if (!row.row || row.row.length !== actualWidth) {
        return {
          success: false,
          error: `Row ${i} width mismatch: expected ${actualWidth} columns, got ${row.row?.length || 0}.`,
        };
      }
    }

    if (!Array.isArray(mapData.interaction)) {
      return {
        success: false,
        error: 'Missing or invalid interaction array.',
      };
    }

    return { success: true };
  }

  // ============================================================
  // 局部重生成方法
  // ============================================================

  /**
   * 局部重新生成地图 - 主入口
   */
  async regeneratePartial(request: PartialRegenerationRequest): Promise<PartialRegenerationResult> {
    try {
      console.log('[PartialRegeneration] Starting partial regeneration...');
      console.log(`[PartialRegeneration] Target segments: ${request.targetSegments.join(', ')}`);

      const segmentWidth = request.segmentWidth || this.DEFAULT_SEGMENT_SIZE;
      const segmentHeight = request.segmentHeight || this.DEFAULT_SEGMENT_SIZE;
      const totalSegments = request.totalSegments || this.DEFAULT_SEGMENT_COUNT;

      // Step 1: 分割现有地图
      console.log('[PartialRegeneration] Splitting existing map...');
      const splitInfo = this.splitMapData(request.mapData, segmentWidth, totalSegments);

      // Step 2: 获取参考关卡
      const refLevel = this.getRefLevel({
        physicsMode: request.physicsMode,
        cameraMode: 'follow'
      } as MapGenerationRequest);

      // Step 3: 重新生成目标段
      const regeneratedSegments: number[] = [];
      const sortedTargets = [...request.targetSegments].sort((a, b) => a - b);

      for (const targetIdx of sortedTargets) {
        console.log(`[PartialRegeneration] Regenerating segment ${targetIdx}...`);

        let newSegment: SegmentData | null = null;

        if (targetIdx === 0) {
          // 初始段（包含 player）
          newSegment = await this.regenerateInitialSegment(
            request, splitInfo, refLevel, targetIdx
          );
        } else {
          // 扩展段
          const prevSegment = splitInfo.segments[targetIdx - 1];
          newSegment = await this.regenerateExtensionSegmentPartial(
            request, splitInfo, refLevel, targetIdx, totalSegments, prevSegment
          );
        }

        if (newSegment) {
          splitInfo.segments[targetIdx] = newSegment;
          regeneratedSegments.push(targetIdx);
        } else {
          console.warn(`[PartialRegeneration] Failed to regenerate segment ${targetIdx}`);
        }
      }

      // Step 4: 验证和修复连接
      const connectionValidations: ConnectionValidation[] = [];

      for (const targetIdx of sortedTargets) {
        // 验证与前一段的连接
        if (targetIdx > 0) {
          const validation = this.validateAndRepairConnection(
            { width: segmentWidth, height: segmentHeight } as MapGenerationRequest,
            splitInfo.segments[targetIdx - 1],
            splitInfo.segments[targetIdx],
            targetIdx - 1,
            targetIdx
          );
          connectionValidations.push(validation);

          if (validation.validationResult === 'invalid' && validation.repairs) {
            console.log(`[PartialRegeneration] Connection ${targetIdx - 1}↔${targetIdx} invalid, applying repairs...`);
            this.applyRepairs(splitInfo.segments[targetIdx - 1], splitInfo.segments[targetIdx], validation.repairs);
          }
        }

        // 验证与后一段的连接
        if (targetIdx < totalSegments - 1) {
          const validation = this.validateAndRepairConnection(
            { width: segmentWidth, height: segmentHeight } as MapGenerationRequest,
            splitInfo.segments[targetIdx],
            splitInfo.segments[targetIdx + 1],
            targetIdx,
            targetIdx + 1
          );
          connectionValidations.push(validation);

          if (validation.validationResult === 'invalid' && validation.repairs) {
            console.log(`[PartialRegeneration] Connection ${targetIdx}↔${targetIdx + 1} invalid, applying repairs...`);
            this.applyRepairs(splitInfo.segments[targetIdx], splitInfo.segments[targetIdx + 1], validation.repairs);
          }
        }
      }

      // Step 5: 合并所有段
      console.log('[PartialRegeneration] Merging all segments...');
      const mergedMapData = this.mergeSegments(splitInfo.segments, {
        width: segmentWidth,
        height: segmentHeight
      } as MapGenerationRequest);

      // Step 6: 更新元数据 (关键步骤)
      const totalWidth = segmentWidth * totalSegments;
      const updatedMapData: SimplifiedMapData = {
        ...mergedMapData,
        meta: {
          map_size: {
            width: totalWidth,
            height: segmentHeight
          }
        },
        mapping: splitInfo.segments[0]?.mapping || request.schema?.mapping || {}
      };

      const updatedSchema: SchemaData = {
        meta: updatedMapData.meta!,
        mapping: updatedMapData.mapping!
      };

      console.log('[PartialRegeneration] Partial regeneration completed successfully');

      return {
        success: true,
        mapData: updatedMapData,
        schema: updatedSchema,
        regeneratedSegments,
        connectionValidations
      };
    } catch (error) {
      console.error('[PartialRegeneration] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 分割完整地图为多个段
   */
  private splitMapData(
    mapData: SimplifiedMapData,
    segmentWidth: number,
    totalSegments: number
  ): MapSplitInfo {
    const height = mapData.terrain.grid.length;
    const segments: SegmentData[] = [];

    for (let segIdx = 0; segIdx < totalSegments; segIdx++) {
      const xOffset = segIdx * segmentWidth;

      // 分割 terrain
      const segmentGrid = mapData.terrain.grid.map((row, y) => {
        const rowStr = row.row;
        const segmentRow = rowStr.substring(xOffset, xOffset + segmentWidth);
        return { y, row: segmentRow };
      });

      // 分割 interaction (x 坐标需要调整为段内坐标)
      const segmentInteraction = mapData.interaction
        .filter(item => {
          const x = item.anchor.x;
          return x >= xOffset && x < xOffset + segmentWidth;
        })
        .map(item => ({
          ...item,
          anchor: {
            x: item.anchor.x - xOffset,
            y: item.anchor.y
          }
        }));

      // 提取连接信息
      const leftEntryPoints = this.inferExitPoints(
        segmentGrid.map(r => r.row.charAt(0))
      );
      const rightExitPoints = this.inferExitPoints(
        segmentGrid.map(r => r.row.charAt(segmentWidth - 1))
      );

      segments.push({
        segmentIndex: segIdx,
        terrain: { grid: segmentGrid },
        interaction: segmentInteraction,
        connectivity: {
          left_edge_entry_points: leftEntryPoints,
          right_edge_exit_points: rightExitPoints
        }
      });
    }

    return {
      segments,
      totalSegments,
      segmentWidth,
      segmentHeight: height
    };
  }

  /**
   * 重新生成初始段（包含 Player）
   */
  private async regenerateInitialSegment(
    request: PartialRegenerationRequest,
    splitInfo: MapSplitInfo,
    refLevel: string,
    targetIdx: number
  ): Promise<SegmentData | null> {
    const segmentWidth = request.segmentWidth || this.DEFAULT_SEGMENT_SIZE;
    const segmentHeight = request.segmentHeight || this.DEFAULT_SEGMENT_SIZE;

    // 从现有段中提取 player 信息
    const existingPlayer = splitInfo.segments[0].interaction?.find(
      (e: any) => e.id === 'player' || e.element === 'P'
    );

    // 构建局部重生成 prompt
    const prompt = this.buildPartialRegenerationPrompt(
      request,
      splitInfo,
      refLevel,
      targetIdx,
      existingPlayer
    );

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`[PartialRegeneration] Initial segment - Attempt ${attempt}/${this.maxRetries}`);

      const output = await llmService.callWithRetry(prompt);
      if (!output) continue;

      const cleaned = this.cleanMarkdown(output, 'json');

      try {
        const segmentData = JSON.parse(cleaned);
        const validation = this.validateInitialSegment(segmentData, {
          width: segmentWidth,
          height: segmentHeight
        } as MapGenerationRequest);

        if (validation.success) {
          return {
            segmentIndex: targetIdx,
            ...segmentData,
            connectivity: segmentData.connectivity || {
              left_edge_entry_points: [],
              right_edge_exit_points: this.inferExitPoints(
                segmentData.terrain.grid.map((r: any) => r.row.charAt(segmentWidth - 1))
              )
            }
          };
        }

        console.warn(`[PartialRegeneration] Validation failed: ${validation.error}`);
      } catch (error) {
        console.warn(`[PartialRegeneration] JSON parse failed: ${error}`);
      }
    }

    return null;
  }

  /**
   * 重新生成扩展段
   */
  private async regenerateExtensionSegmentPartial(
    request: PartialRegenerationRequest,
    splitInfo: MapSplitInfo,
    refLevel: string,
    segmentIndex: number,
    totalSegments: number,
    prevSegment: SegmentData
  ): Promise<SegmentData | null> {
    const segmentWidth = request.segmentWidth || this.DEFAULT_SEGMENT_SIZE;
    const segmentHeight = request.segmentHeight || this.DEFAULT_SEGMENT_SIZE;

    const rightEdge = this.extractRightEdge(prevSegment, segmentWidth);
    const exitPoints = prevSegment.connectivity?.right_edge_exit_points || this.inferExitPoints(rightEdge);

    const prompt = this.buildPartialRegenerationPrompt(
      request,
      splitInfo,
      refLevel,
      segmentIndex,
      null,
      rightEdge,
      exitPoints
    );

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`[PartialRegeneration] Extension segment ${segmentIndex} - Attempt ${attempt}/${this.maxRetries}`);

      const output = await llmService.callWithRetry(prompt);
      if (!output) continue;

      const cleaned = this.cleanMarkdown(output, 'json');

      try {
        const segmentData = JSON.parse(cleaned);
        const validation = this.validateExtensionSegment(
          segmentData,
          { width: segmentWidth, height: segmentHeight } as MapGenerationRequest,
          exitPoints,
          segmentIndex === totalSegments - 1
        );

        if (validation.success) {
          return {
            segmentIndex,
            ...segmentData,
            connectivity: segmentData.connectivity || {
              left_edge_entry_points: exitPoints,
              right_edge_exit_points: this.inferExitPoints(
                segmentData.terrain.grid.map((r: any) => r.row.charAt(segmentWidth - 1))
              )
            }
          };
        }

        console.warn(`[PartialRegeneration] Validation failed: ${validation.error}`);
      } catch (error) {
        console.warn(`[PartialRegeneration] JSON parse failed: ${error}`);
      }
    }

    return null;
  }

  /**
   * 构建局部重生成 prompt
   */
  private buildPartialRegenerationPrompt(
    request: PartialRegenerationRequest,
    splitInfo: MapSplitInfo,
    refLevel: string,
    targetIdx: number,
    existingPlayer?: any,
    previousRightEdge?: string[],
    previousExitPoints?: number[]
  ): string {
    const isInitial = targetIdx === 0;
    const isFinal = targetIdx === splitInfo.totalSegments - 1;
    const segmentWidth = request.segmentWidth || this.DEFAULT_SEGMENT_SIZE;
    const segmentHeight = request.segmentHeight || this.DEFAULT_SEGMENT_SIZE;

    return `# Map Regeneration - Segment #${targetIdx}

You are regenerating a specific segment of an existing long level based on user feedback.

## User Feedback
${request.prompt}

## Segment Information
- **Segment Index**: ${targetIdx} of ${splitInfo.totalSegments - 1}
- **Size**: ${segmentWidth} x ${segmentHeight} cells
- **Role**: ${isInitial ? 'Start (contains player)' : isFinal ? 'Final (contains goal)' : 'Challenge'}

## Schema
\`\`\`json
${JSON.stringify(request.schema, null, 2)}
\`\`\`

## Reference Data (FOR LAYOUT REFERENCE ONLY)
${refLevel}

## Connectivity Requirements
${targetIdx > 0 ? `
### Previous Segment's Right Edge (Your Left Edge Must Connect)
Previous segment exit points at Y: [${previousExitPoints?.join(', ') || 'auto-detect'}]
Your left edge MUST have passable terrain at these Y coordinates.
` : ''}

${!isFinal ? `
### Next Segment's Left Edge (Your Right Edge Must Connect)
Next segment entry points will need to match your right edge.
Ensure your right edge has clear exit points.
` : ''}

## Original Segment Data (for reference)
\`\`\`json
${JSON.stringify(splitInfo.segments[targetIdx], null, 2)}
\`\`\`

## Regeneration Instructions
1. Apply the user's feedback to improve this segment
2. Maintain connectivity with adjacent segments
3. Keep the same general style and difficulty level
4. ${isInitial ? 'Preserve player spawn position' : 'Do NOT add player'}
5. ${isFinal ? 'Include goal/objective elements' : 'Provide exit points for next segment'}

## Output Format
\`\`\`json
{
  "segment_index": ${targetIdx},
  "segment_type": "${isInitial ? 'initial' : isFinal ? 'final' : 'extension'}",
  "terrain": {
    "grid": [
      { "y": 0, "row": "..." },
      { "y": 1, "row": "..." }
    ]
  },
  "interaction": [
    { "id": "...", "element": "...", "anchor": { "x": 0, "y": 0 } }
  ],
  "connectivity": {
    "left_edge_entry_points": [5, 6, 7],
    "right_edge_exit_points": [5, 6, 7]
  }
}
\`\`\`

Generate the improved segment now. Remember: Output ONLY JSON, no other content.`;
  }
}

let mapGenerationServiceInstance: MapGenerationService | null = null;

export function getMapGenerationService(): MapGenerationService {
  if (!mapGenerationServiceInstance) {
    mapGenerationServiceInstance = new MapGenerationService();
  }
  return mapGenerationServiceInstance;
}

export const mapGenerationService = new Proxy({} as MapGenerationService, {
  get(_target, prop) {
    const service = getMapGenerationService();
    return service[prop as keyof MapGenerationService];
  },
});