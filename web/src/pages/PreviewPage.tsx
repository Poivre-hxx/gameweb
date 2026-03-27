import { useState, useEffect, useMemo, useRef } from 'react';
import { GameCanvas } from '../components/GameCanvas';
import historyService from '../services/HistoryService';
import { feedbackIterationService } from '../services/FeedbackIterationService';
import type { GameVersion } from '../types';
import type { MapData, GameRules } from '../game/core/types';
import { calculateOptimalTileSize } from '../utils/gameUtils';

// Props 接口
interface PreviewPageProps {
  versionId?: string | null;
  gameData?: { code: GameRules; mapData: any; schema?: any } | null;
  forceReloadCounter?: number; // 用于强制重新加载
  onNavigate?: (tab: 'home' | 'preview' | 'history' | 'settings') => void;
}

export default function PreviewPage({ versionId, gameData, forceReloadCounter, onNavigate }: PreviewPageProps = { versionId: null, gameData: null, forceReloadCounter: 0, onNavigate: undefined }) {
  // const [searchParams] = useSearchParams();
  // const navigate = useNavigate();

  // 核心数据状态
  const [currentMapData, setCurrentMapData] = useState<MapData | null>(null);
  const [currentRules, setCurrentRules] = useState<GameRules | null>(null);

  // 版本控制状态
  const [currentVersion, setCurrentVersion] = useState<GameVersion | null>(null);
  const loadedVersionIdRef = useRef<string | null>(null); // 跟踪已加载的版本ID

  // GameCanvas 容器引用和尺寸状态
  const gameCanvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // 反馈交互状态
  const [feedbackText, setFeedbackText] = useState('');
  const [isIterating, setIsIterating] = useState(false);
  const [iterationError, setIterationError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<('level' | 'rule')[]>([]);
  /**
   * 辅助函数：加载数据并更新状态
   * physicsMode 和 cameraMode 从 gameConfig 中读取
   */
  const loadGameData = (data: { code: GameRules; mapData: any }) => {
    try {
      console.log('[PreviewPage] loadGameData called with gameConfig:', data.code.gameConfig);

      // 如果 gameConfig 不存在，先创建并设置默认值
      if (!data.code.gameConfig) {
        data.code.gameConfig = {
          physicsMode: 'topdown',
          cameraMode: 'fixed'
        };
      }

      // 确保 physicsMode 和 cameraMode 有默认值
      if (!data.code.gameConfig.physicsMode) {
        data.code.gameConfig.physicsMode = 'topdown';
      }
      if (!data.code.gameConfig.cameraMode) {
        data.code.gameConfig.cameraMode = 'fixed';
      }

      console.log('[PreviewPage] Final gameConfig:', data.code.gameConfig);

      // 动态计算 tileSize（优先级：已有值 > 计算值 > 默认值 32）
      // 只在 follow 和 auto-scroll 模式下根据高度计算，其他模式保持原值
      if (!data.code.gameConfig.tileSize || data.code.gameConfig.tileSize === 32) {
        const gridWidth = data.mapData.terrain.grid[0].row.length;
        const gridHeight = data.mapData.terrain.grid.length;

        const tileSize = calculateOptimalTileSize(
          gridWidth,
          gridHeight,
          data.code.gameConfig.cameraMode,
          containerSize.width,
          containerSize.height,
          16, // 最小 tileSize
          64  // 最大 tileSize
        );

        console.log(`[PreviewPage] Calculated tileSize: ${tileSize} for container: ${containerSize.width}x${containerSize.height}`);
        data.code.gameConfig.tileSize = tileSize;
      }

      // 创建新的对象引用，确保 useEffect 能检测到变化
      setCurrentMapData({ ...data.mapData });
      setCurrentRules({ ...data.code });
    } catch (e) {
      console.error("[PreviewPage] Data load error:", e);
      setIterationError("数据加载错误，无法加载游戏");
    }
  };

  /**
   * Effect: 初始化加载
   * 根据 Props 传入的 versionId 或 gameData 加载游戏
   */
  useEffect(() => {

    // 场景 1: 直接传入了游戏数据 (测试模式/生成完成即时预览)
    if (gameData) {
      console.log('[PreviewPage] Loading from gameData, gameConfig:', gameData.code.gameConfig);
      loadGameData({ code: gameData.code, mapData: gameData.mapData });

      // 构造一个临时的 Version 对象用于反馈逻辑
      setCurrentVersion({
        id: 'temp-preview',
        timestamp: Date.now(),
        code: gameData.code,
        mapData: gameData.mapData,
        schema: gameData.schema
      } as GameVersion);
      loadedVersionIdRef.current = 'temp-preview';
      return;
    }

    // 场景 2: 根据 ID 从历史记录加载
    if (versionId) {
      console.log('[PreviewPage] Loading from history:', versionId);
      const version = historyService.getVersion(versionId);
      if (version) {
        setCurrentVersion(version);
        loadGameData({
          code: version.code,
          mapData: { ...version.mapData, ...version.schema }
        });
        loadedVersionIdRef.current = versionId;
      } else {
        console.error('[PreviewPage] Version not found:', versionId);
        setIterationError(`版本 ${versionId} 未找到`);
      }
    } else {
      // 清空状态
      loadedVersionIdRef.current = null;
    }
  }, [versionId, gameData, forceReloadCounter]);

  /**
   * Effect: 监听 GameCanvas 容器尺寸变化
   * 只在组件挂载时执行一次
   */
  useEffect(() => {
    const container = gameCanvasContainerRef.current;
    if (!container) return;

    // 获取容器实际尺寸
    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight
      });
    };

    // 初始尺寸
    updateSize();

    // 监听尺寸变化
    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []); // 只在挂载时执行

  /**
   * 计算控制说明文本 (从 Rules 的 inputMapping 生成)
   */
  const controlInstructions = useMemo(() => {
    if (!currentRules?.inputMapping) return "Loading controls...";

    // 将 inputMapping: { "A": "shoot" } 转换为可读文本
    const lines = Object.entries(currentRules.inputMapping).map(([key, action]) => {
      if (!action) return null;
      return `Button ${key} : ${action}`;
    });

    return [
      "Joystick : Move",
      ...lines.filter(Boolean)
    ].join('\n');
  }, [currentRules]);


  /**
   * Player 死亡回调：跳转到首页
   */
  const handlePlayerDeath = () => {
    console.log('[PreviewPage] Player died, navigating to home');
    onNavigate?.('home');
  };

  /**
   * 提交反馈 (保持原有逻辑框架，适配新数据流)
   */
  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim() || !currentVersion) return;

    setIsIterating(true);
    setIterationError(null);

    try {
      console.log('[Feedback] submitting:', feedbackText);

      const result = await feedbackIterationService.iterateWithFeedback({
        feedback: feedbackText.trim(),
        currentVersion: currentVersion,
        onStepUpdate: (status) => {
          console.log(`[Feedback] ${status.step}: ${status.message}`);
        },
      });

      if (result.success && result.newVersionId) {
        // 迭代成功，获取新版本
        const newVersion = historyService.getVersion(result.newVersionId);
        if (newVersion) {
          console.log('[Feedback] Loading new version');
          setCurrentVersion(newVersion);
          // 更新画布（physicsMode/cameraMode 从 gameConfig 读取）
          loadGameData({ code: newVersion.code, mapData: newVersion.mapData });
          setFeedbackText('');
        }
      } else {
        setIterationError(result.error || '迭代失败');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      setIterationError(errorMsg);
    } finally {
      setIsIterating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center pb-tabbar-safe">
      <div
        className="w-[90vw] h-[85vh]
                   border border-white/20 rounded-2xl p-2.5 lg:p-3.5 mb-1
                   flex flex-col landscape:flex-row lg:flex-row gap-3 md:gap-4 overflow-hidden"
      >
        {/* 左侧：游戏画布区 */}
        <div
          ref={gameCanvasContainerRef}
          className="relative w-full landscape:w-[65%] lg:w-[65%] flex-[6.5]
                     border-2 border-white/30 rounded-xl
                     bg-black/20 flex items-center justify-center overflow-hidden"
        >
          {/* 核心修改：
              直接透传数据，GameCanvas 会处理加载、渲染、手柄交互。
              不再需要外层包裹 VirtualGamepad。
          */}
          <GameCanvas
            mapData={currentMapData}
            rules={currentRules}
            onPlayerDeath={handlePlayerDeath}
          />
        </div>

        {/* 右侧：交互区 */}
        <div className="w-full landscape:w-[35%] lg:w-[35%] flex-[3.5] h-full flex flex-col gap-2 md:gap-3 overflow-hidden">

          {/* 控制说明 */}
          <div className="flex-[1.5] border border-white/20 rounded-xl p-2 md:p-3 bg-black/10 overflow-auto scrollbar-thin">
            <h3 className="text-white font-bold my-2 text-xs md:text-sm">Controls</h3>
            <div className="text-[10px] md:text-xs text-gray-300 space-y-0.5 whitespace-pre-line">
              {controlInstructions}
            </div>
          </div>

          {/* 原始输入展示区 */}
          <div className="flex-[2.5] border border-white/20 rounded-xl p-2 md:p-3 bg-black/10 overflow-auto scrollbar-thin">
            <h3 className="text-white font-bold my-2 text-xs md:text-sm">Original Input</h3>
            <div className="text-[10px] md:text-xs text-gray-300">
              {currentVersion?.caption || 'None'}
            </div>
          </div>

          {/* 反馈区 */}
          <div className="flex-[6] flex flex-col gap-2 min-h-[100px] relative z-[60]">
            <div className="flex-1 bg-black/30 rounded-xl border border-white/10 focus-within:border-[#38bdf8] focus-within:shadow-[0_0_20px_rgba(56,189,248,0.5)] transition-all duration-300 flex flex-col overflow-hidden">
              {/* 上半部分：textarea */}
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={currentVersion?.metadata?.gameDescription || "Enter your feedback to update the game..."}
                className="flex-1 p-2 md:p-3 bg-transparent
                           border-0 outline-none resize-none text-white text-xs md:text-sm
                           placeholder:text-white/70 scrollbar-thin"
              />

              {/* 分隔线 */}
              <div className="border-t border-white/10" />

              {/* 下半部分：标签选择 */}
              <div className="flex px-2 py-1.5 gap-2">
                <div className="flex-1 flex justify-center">
                  <button
                    onClick={() => {
                      setSelectedTags(prev =>
                        prev.includes('level')
                          ? prev.filter(t => t !== 'level')
                          : [...prev, 'level']
                      );
                    }}
                    className={`w-[90%] py-1.5 rounded-lg text-xs transition-all ${selectedTags.includes('level')
                        ? 'bg-[#2b7ac0] text-white shadow-[0_0_10px_rgba(56,189,248)]'
                        : 'bg-white/10 text-white/70'
                      }`}
                  >
                    Level
                  </button>
                </div>
                <div className="flex-1 flex justify-center">
                  <button
                    onClick={() => {
                      setSelectedTags(prev =>
                        prev.includes('rule')
                          ? prev.filter(t => t !== 'rule')
                          : [...prev, 'rule']
                      );
                    }}
                    className={`w-[90%] py-1.5 rounded-lg text-xs transition-all ${selectedTags.includes('rule')
                        ? 'bg-[#2b7ac0] text-white shadow-[0_0_10px_rgba(56,189,248)]'
                        : 'bg-white/10 text-white/70'
                      }`}
                  >
                    Rule
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={handleSubmitFeedback}
              disabled={isIterating || !feedbackText.trim()}
              className="py-1.5 md:py-2 rounded-xl text-xs md:text-sm
                         bg-gradient-to-r from-blue-500 to-cyan-400
                         font-semibold text-white
                         shadow-[0_0_15px_rgba(59,130,246,0.5)]
                         hover:shadow-[0_0_25px_rgba(59,130,246,0.7)]
                         transition-all duration-300
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isIterating ? 'GENERATING...' : 'UPDATE GAME'}
            </button>

            {iterationError && (
              <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p className="text-red-400 text-xs">{iterationError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}