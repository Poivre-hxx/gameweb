/**
 * LLM聊天服务
 */

const CONFIG = {
  baseUrl: 'https://api.siliconflow.cn/v1',
  apiKey: 'sk-cyfmflbrbvvormfdgllfwdbqzxprdqmwjbjodfvddfebmidy',
  model: 'Pro/zai-org/GLM-5'
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chat(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.apiKey}`
    },
    body: JSON.stringify({
      model: CONFIG.model,
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}
