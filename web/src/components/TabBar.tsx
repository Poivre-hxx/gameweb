import { Home, GitBranch, Settings, MessageCircle } from 'lucide-react';

interface TabBarProps {
  activeTab: 'home' | 'preview' | 'history' | 'settings';
  onTabChange: (tab: 'home' | 'preview' | 'history' | 'settings') => void;
  showChatButton?: boolean;
  onChatClick?: () => void;
}

export default function TabBar({ activeTab, onTabChange, showChatButton, onChatClick }: TabBarProps) {
  const tabs = [
    { id: 'home' as const, icon: Home },
    { id: 'history' as const, icon: GitBranch },
    { id: 'settings' as const, icon: Settings },
  ];

  return (
    <div className="tabbar-wrapper">
      {/* 左侧占位 - 保持居中 */}
      <div className="tabbar-spacer" />

      {/* 中间 tabbar */}
      <div className="tabbar-container">
        {tabs.map(({ id, icon: Icon }) => {
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="block my-auto relative h-full flex items-center justify-center px-3 sm:px-4 py-2 group outline-none transition-all duration-300"
            >
              <span
                className={`
                  absolute left-1/2 -translate-x-1/2
                  transition-all duration-300 rounded-full
                  ${isActive ? 'w-[110%] h-[77%] bg-[#2b7ac0]' : 'w-0 bg-transparent'}
                `}
              />

              <Icon
                strokeWidth={2}
                className="relative z-10 w-[80%] aspect-square transition-all duration-300 ease-out"
                style={{
                  color: isActive ? '#ffffffb2' : '#ffffff44',
                }}
              />
            </button>
          );
        })}
      </div>

      {/* 右侧 - chat button 或占位 */}
      {showChatButton ? (
        <button
          onClick={onChatClick}
          className="chat-button hover:scale-110 hover:shadow-[0_0_20px_rgba(59,130,246,0.7)] transition-all duration-300"
        >
          <MessageCircle className="text-white w-5 h-5" />
        </button>
      ) : (
        <div className="tabbar-spacer" />
      )}
    </div>
  );
}