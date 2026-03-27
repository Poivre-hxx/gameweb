import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { chat, type ChatMessage } from '../services/LLMChatService';
import historyService from '../services/HistoryService';
import { HistoryContextBuilder } from '../services/prompts';

// 历史上下文构建器实例
const historyContextBuilder = new HistoryContextBuilder();

interface CustomChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CustomGameAssistantChat({ isOpen, onClose }: CustomChatProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 构建包含历史上下文的系统提示词
  const systemPrompt = (() => {
    if (!isOpen) {
      return { role: 'system', content: '' };
    }

    // 获取当前版本
    const currentVersion = historyService.getCurrentVersion();
    if (!currentVersion) {
      return {
        role: 'system',
        content: historyContextBuilder.buildGameAssistantPrompt(
          '### Game State\n\nNo saved game versions yet. Please create a game prototype first.'
        )
      };
    }

    // 获取当前分支的迭代链（按时间顺序，从根到当前)
    const iterationChain = historyService.getIterationChain(currentVersion.id);

    // 构建历史上下文
    const historyContext = historyContextBuilder.buildHistoryContext({
      versions: iterationChain,
      currentVersionId: currentVersion.id
    });

    // 构建完整的系统提示词
    return {
      role: 'system',
      content: historyContextBuilder.buildGameAssistantPrompt(historyContext)
    };
  })();

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // 构建消息历史
      const chatMessages: ChatMessage[] = [
        systemPrompt,
        ...messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: userMessage }
      ];

      const response = await chat(chatMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '请求失败';
      setMessages(prev => [...prev, { role: 'assistant', content: `错误: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 z-[70]"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="fixed bottom-24 right-6 w-[400px] h-[500px] max-h-[70vh]
                      bg-gray-900/95 backdrop-blur-xl
                      border border-white/20 rounded-2xl
                      shadow-2xl z-[71]
                      flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="text-white font-semibold text-sm">AI Game Assistant</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-white/70 hover:text-white hover:bg-white/10
                       transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {messages.length === 0 && !isLoading && (
            <div className="text-left text-white/70 text-sm py-4 px-2 space-y-3">
              <p>Hello, I'm your game design assistant.</p>
              <p>If you'd like, we can take a look at the current state of this version together—talk about which parts are already becoming clear and which areas could still be improved.</p>
              <p>Whether it's gameplay mechanics, level structure, or the overall design direction, I'll do my best to offer some analysis and suggestions.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white'
                    : 'bg-white/10 text-white/90'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 px-3 py-2 rounded-xl">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div className="p-3 border-t border-white/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about game improvements..."
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2
                         text-white text-sm placeholder-white/50
                         outline-none focus:border-[#38bdf8] focus:shadow-[0_0_10px_rgba(56,189,248,0.3)]
                         transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="px-4 py-2 rounded-xl
                         bg-gradient-to-r from-blue-500 to-cyan-400
                         text-white text-sm font-semibold
                         shadow-[0_0_10px_rgba(59,130,246,0.4)]
                         hover:shadow-[0_0_15px_rgba(59,130,246,0.6)]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// 浮动按钮组件
export function FloatingChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-6 w-14 h-14
                 flex items-center justify-center
                 rounded-full
                 bg-gradient-to-r from-blue-500 to-cyan-400
                 shadow-[0_0_20px_rgba(59,130,246,0.6)]
                 hover:shadow-[0_0_30px_rgba(59,130,246,0.8)]
                 hover:scale-110
                 transition-all duration-300
                 z-[65]"
    >
      <MessageCircle size={24} className="text-white" />
    </button>
  );
}
