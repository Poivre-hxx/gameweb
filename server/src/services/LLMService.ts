/**
 * LLM服务 - 统一的LLM调用接口
 * 使用OpenAI SDK
 */

import OpenAI from 'openai';

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

/**
 * LLM服务类
 * 封装OpenAI API调用，提供统一的接口
 */
export class LLMService {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: 180000,
    });
  }

  /**
   * 调用LLM生成内容
   * @param prompt 提示词
   * @param config LLM配置（模型、温度、最大token数）
   * @returns 生成的文本内容
   */
  async call(
    prompt: string,
    config: LLMConfig = {
      model: 'claude-sonnet-4-6',
      temperature: 0.7,
      maxTokens: 50000,
    }
  ): Promise<string> {
    try {
      console.log('[LLMService] 发起API调用', {
        model: config.model,
        maxTokens: config.maxTokens,
        promptLength: prompt.length,
      });

      const response = await this.client.chat.completions.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // 验证响应格式
      if (!response.choices || response.choices.length === 0) {
        console.error('[LLMService] 响应格式错误 - choices为空或不存在');
        throw new Error('Invalid API response: choices is undefined or empty');
      }

      const message = response.choices[0]?.message;
      if (!message || !message.content) {
        console.error('[LLMService] 响应格式错误 - message或content为空');
        throw new Error('Invalid API response: message or content is missing');
      }

      console.log('[LLMService] API调用成功', {
        contentLength: message.content.length,
      });

      return message.content;
    } catch (error) {
      console.error('[LLMService] API调用失败:', error);
      throw error;
    }
  }

  /**
   * 调用LLM生成内容（带重试机制）
   * @param prompt 提示词
   * @param config LLM配置
   * @param maxRetries 最大重试次数
   * @returns 生成的文本内容
   */
  async callWithRetry(
    prompt: string,
    config?: LLMConfig,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.call(prompt, config);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`LLM call attempt ${i + 1} failed:`, lastError.message);

        // 如果不是最后一次重试，等待一段时间后重试
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    throw lastError || new Error('LLM call failed after retries');
  }
}

// 导出单例实例 - 延迟初始化
let llmServiceInstance: LLMService | null = null;

export function getLLMService(): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}

// 为了保持向后兼容，导出一个 getter
export const llmService = new Proxy({} as LLMService, {
  get(_target, prop) {
    const service = getLLMService();
    return service[prop as keyof LLMService];
  }
});
