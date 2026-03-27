import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GameData {
  game_id: string;
  tags?: string[];
  view?: string;
  gameplay_summary: string;
  key_mechanics?: any;
  embedding: number[];
}

interface GameSearchResult {
  game: GameData;
  similarity: number;
}

/**
 * RAG服务 - 读取JSON文件并进行向量检索
 */
class RAGService {
  private openaiClient: OpenAI;
  private gamesData: Map<string, GameData> = new Map();
  private dataLoaded: boolean = false;

  constructor() {
    // 从环境变量读取配置
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL;

    if (!apiKey) {
      throw new Error('缺少 OPENAI_API_KEY 环境变量');
    }

    // 初始化 OpenAI 客户端（后端不需要 dangerouslyAllowBrowser）
    this.openaiClient = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
      timeout: 180000,
    });

    // 启动时加载数据
    this.loadData();
  }

  /**
   * 加载游戏数据（从本地文件系统）
   */
  private loadData(): void {
    if (this.dataLoaded) {
      return;
    }

    try {
      const dataPath = path.join(__dirname, '../../data/summaries_embedded.json');
      const rawData = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(rawData);

      for (const [id, game] of Object.entries(data)) {
        this.gamesData.set(id, game as GameData);
      }

      this.dataLoaded = true;
      console.log(`[RAGService] 成功加载 ${this.gamesData.size} 个游戏数据`);
    } catch (error) {
      throw new Error(`加载游戏数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 搜索相似游戏
   * @param prompt 用户输入的查询文本
   * @param topK 返回前K个最相似的游戏，默认3个
   * @returns 相似游戏列表，按相似度降序排列
   */
  async searchSimilarGames(prompt: string, topK: number = 3): Promise<GameSearchResult[]> {
    if (!this.dataLoaded) {
      this.loadData();
    }

    if (this.gamesData.size === 0) {
      throw new Error('游戏数据未加载');
    }

    // 获取用户输入的 embedding 向量
    const queryEmbedding = await this.getEmbedding(prompt);

    // 计算所有游戏的相似度
    const similarities: GameSearchResult[] = [];

    for (const gameData of this.gamesData.values()) {
      const similarity = this.cosineSimilarity(queryEmbedding, gameData.embedding);
      similarities.push({
        game: gameData,
        similarity,
      });
    }

    // 按相似度降序排序，取前 topK 个
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * 调用 OpenAI API 获取文本的 embedding 向量
   * @param text 输入文本
   * @returns embedding 向量
   */
  private async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openaiClient.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      const embedding = response.data[0].embedding;

      // 验证维度
      if (embedding.length !== 1536) {
        console.warn(`警告: embedding 维度为 ${embedding.length}，期望 1536`);
      }

      return embedding;
    } catch (error) {
      throw new Error(`生成 embedding 失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 计算两个向量的余弦相似度
   * @param vecA 向量A
   * @param vecB 向量B
   * @returns 余弦相似度 (0-1之间)
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error(`向量维度不匹配: ${vecA.length} vs ${vecB.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);

    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }
}

// 导出单例实例 - 延迟初始化
let ragServiceInstance: RAGService | null = null;

export function getRAGService(): RAGService {
  if (!ragServiceInstance) {
    ragServiceInstance = new RAGService();
  }
  return ragServiceInstance;
}

// 为了保持向后兼容，导出一个 getter
export const ragService = new Proxy({} as RAGService, {
  get(_target, prop) {
    const service = getRAGService();
    return service[prop as keyof RAGService];
  }
});
