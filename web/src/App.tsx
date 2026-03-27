import { useState, useEffect } from 'react';
import TabBar from './components/TabBar';
import { CustomGameAssistantChat } from './components/GameAssistantChat';
import HomePage from './pages/HomePage';
import PreviewPage from './pages/PreviewPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

type TabType = 'home' | 'preview' | 'history' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // AI 聊天对话框状态
  const [isChatOpen, setIsChatOpen] = useState(false);

  // 预览页状态
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  // 直接传递代码和地图数据的状态（physicsMode/cameraMode 包含在 gameData.code.gameConfig 中）
  const [previewData, setPreviewData] = useState<{ code: any; mapData: any } | null>(null);
  const [forceReloadCounter, setForceReloadCounter] = useState(0); // 用于强制刷新

  // 1. 应用启动时读取 URL 参数并恢复状态
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as TabType | null;
    const version = params.get('version');

    if (tab && ['home', 'preview', 'history', 'settings'].includes(tab)) {
      setActiveTab(tab);

      if (tab === 'preview' && version) {
        setPreviewVersionId(version);
        setPreviewData(null);
      } else if (tab !== 'preview') {
        // 切换到其他页面时清空预览数据
        setPreviewVersionId(null);
        setPreviewData(null);
      }
    }
  }, []);

  // 2. 监听浏览器前进/后退事件
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') as TabType | null;
      const version = params.get('version');

      if (tab && ['home', 'preview', 'history', 'settings'].includes(tab)) {
        setActiveTab(tab);

        if (tab === 'preview' && version) {
          setPreviewVersionId(version);
          setPreviewData(null);
        } else {
          setPreviewVersionId(null);
          setPreviewData(null);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 3. 当 activeTab 或 previewVersionId 变化时同步 URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);

    if (activeTab === 'preview' && previewVersionId) {
      params.set('version', previewVersionId);
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    window.history.replaceState({}, '', newUrl);
  }, [activeTab, previewVersionId]);

  const handleNavigate = (tab: TabType, versionId?: string, gameData?: { code: any; mapData: any }) => {
    if (tab === 'preview') {
      if (gameData) {
        // 直接传递代码和地图数据（physicsMode/cameraMode 在 gameData.code.gameConfig 中）
        setPreviewData(gameData);
        setPreviewVersionId(null);
      } else if (versionId) {
        setPreviewVersionId(versionId);
        setPreviewData(null);
      } else {
        // 清空预览数据
        setPreviewVersionId(null);
        setPreviewData(null);
      }
    } else {
      // 切换到其他页面时清空预览数据
      setPreviewVersionId(null);
      setPreviewData(null);
    }

    setActiveTab(tab);
  };

  return (
    <>
      {activeTab === 'home' && <HomePage onNavigate={handleNavigate} />}
      {activeTab === 'preview' && <PreviewPage versionId={previewVersionId} gameData={previewData} forceReloadCounter={forceReloadCounter} onNavigate={handleNavigate} />}
      {activeTab === 'history' && <HistoryPage onNavigate={handleNavigate} />}
      {activeTab === 'settings' && <SettingsPage />}

      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showChatButton={activeTab === 'preview'}
        onChatClick={() => setIsChatOpen(true)}
      />

      {/* AI 聊天对话框 */}
      <CustomGameAssistantChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </>
  );
}

export default App;