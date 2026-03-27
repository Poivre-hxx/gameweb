import { useState } from 'react';
import { gamePrototypeService, GenerationStep, type StepStatus } from '../services/GamePrototypeService';
import type { GameRules } from '../game/core/types';

interface HomePageProps {
  onNavigate: (tab: 'home' | 'preview' | 'history' | 'settings', versionId?: string, gameData?: { code: GameRules; mapData: any; schema?: any }) => void;
}

// 生成阶段标签映射
const GENERATION_STEPS = [
  { step: GenerationStep.RAG_SEARCH, label: 'Retrieving similar games' },
  { step: GenerationStep.DESCRIPTION_ENHANCE, label: 'Enhancing the game description' },
  { step: GenerationStep.SCHEMA_GENERATION, label: 'Generating the game schema' },
  { step: GenerationStep.DETAILED_RULES_GENERATION, label: 'Generating detailed game rules' },
  { step: GenerationStep.MAP_GENERATION, label: 'Generating game levels' },
  { step: GenerationStep.CODE_GENERATION, label: 'Generating game code' },
] as const;

export default function HomePage({ onNavigate }: HomePageProps) {
  const [userPrompt, setUserPrompt] = useState('');
  const [physicsMode, setPhysicsMode] = useState<'platformer' | 'topdown' | 'freely'>('topdown');
  const [cameraMode, setCameraMode] = useState<'fixed' | 'follow' | 'auto-scroll'>('fixed');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<{
    currentStep: GenerationStep | null;
    progress: number;
    message: string;
    steps: Map<GenerationStep, 'pending' | 'running' | 'success' | 'error'>;
  }>({
    currentStep: null,
    progress: 0,
    message: '',
    steps: new Map(),
  });

  // 判断 physicsMode 选项是否应该被禁用
  const isPhysicsModeDisabled = (
    mode: 'platformer' | 'topdown' | 'freely',
    currentCameraMode: 'fixed' | 'follow' | 'auto-scroll'
  ): boolean => {
    if (mode === 'topdown' && (currentCameraMode === 'follow' || currentCameraMode === 'auto-scroll')) {
      return true;
    }
    if (mode === 'freely' && currentCameraMode === 'fixed') {
      return true;
    }
    return false;
  };

  // 判断 cameraMode 选项是否应该被禁用
  const isCameraModeDisabled = (
    mode: 'fixed' | 'follow' | 'auto-scroll',
    currentPhysicsMode: 'platformer' | 'topdown' | 'freely'
  ): boolean => {
    if (mode === 'fixed' && currentPhysicsMode === 'freely') {
      return true;
    }
    if ((mode === 'follow' || mode === 'auto-scroll') && currentPhysicsMode === 'topdown') {
      return true;
    }
    return false;
  };

  const handleGenerate = async () => {
    if (!userPrompt.trim()) {
      alert('Please enter the game description');
      return;
    }

    setIsGenerating(true);
    setError(null);

    // console.log('[HomePage] Starting game generation...');

    // 开始调用 web\src\services\GamePrototypeService.ts pipeline生成游戏内容
    try {
      const result = await gamePrototypeService.generatePrototype({
        userPrompt: userPrompt.trim(),
        mapWidth: 15,
        mapHeight: 15,
        physicsMode,
        cameraMode,
        onStepUpdate: (status: StepStatus) => {

          setGenerationStatus(prev => {
            const newSteps = new Map(prev.steps);
            newSteps.set(status.step, status.status);

            return {
              currentStep: status.step,
              progress: status.progress || 0,
              message: status.message,
              steps: newSteps,
            };
          });
        },
      });

      if (result.success && result.versionId) {
        // 将 physicsMode/cameraMode 放入 gameConfig
        if (result.gameCode) {
          result.gameCode.gameConfig = {
            physicsMode,
            cameraMode,
          };
        }
        // 使用版本ID加载（正常模式）
        onNavigate('preview', result.versionId);
      } else if (result.success && result.gameCode && result.mapData) {
        // 回退到直接数据传递（如果保存失败）
        // 将 physicsMode/cameraMode 放入 gameConfig
        result.gameCode.gameConfig = {
          physicsMode,
          cameraMode,
        };
        onNavigate('preview', undefined, {
          code: result.gameCode,
          mapData: result.mapData,
        });
      } else {
        const errorMsg = result.error || '生成失败';
        console.error('[HomePage] ❌ Generation failed:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      console.error('[HomePage] ❌ Generation error:', errorMsg);
      setError(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-[3vh] px-[4vw] pb-tabbar-safe">
      <div className="w-full max-w-[55vw] max-h-[80vh] overflow-y-auto">
        <h1 className="whitespace-nowrap text-[clamp(1.4vw,2.5rem,2.5vw)] font-bold mb-3 md:mb-4 text-center text-white">
          DESCRIBE YOUR DREAM 2DGAME
        </h1>

        <div className="w-full bg-black/30 rounded-2xl border border-white/10 focus-within:border-[#38bdf8] focus-within:shadow-[0_0_20px_rgba(56,189,248,0.5)] transition-all duration-300">
          {/* 上半部分：textarea */}
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="E.g., A retro platformer where a cybernetic cat collects energy drinks in a neon Tokyo, avoiding robotic dogs. Pixel art style."
            disabled={isGenerating}
            className="w-full h-30 md:h-48 max-h-[30vh] p-4 bg-transparent rounded-t-2xl
                       border-0 outline-none resize-none text-white
                       placeholder:text-[#6a6a6a] disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* 分隔线 */}
          <div className="border-t border-white/10" />

          {/* 下半部分：控制区 - 一行布局 */}
          <div className="flex justify-between items-center px-2 md:px-4 py-2 md:py-3 gap-1.5 md:gap-4">
            {/* 左侧：两个下拉框 */}
            <div className="flex gap-1 md:gap-3 items-center">
              <div className="flex items-center gap-0.5 md:gap-2">
                <label className="text-white/70 text-[10px] md:text-sm whitespace-nowrap">Physics</label>
                <select
                  value={physicsMode}
                  onChange={(e) => setPhysicsMode(e.target.value as 'platformer' | 'topdown' | 'freely')}
                  className="bg-slate-800 border border-white/10 rounded-md
                             px-1 py-0.5 md:px-3 md:py-1.5
                             text-[11px] text-white
                             focus:border-[#38bdf8] outline-none cursor-pointer
                             disabled:opacity-50"
                  disabled={isGenerating}
                >
                  <option value="platformer">platformer</option>
                  <option value="topdown" disabled={isPhysicsModeDisabled('topdown', cameraMode)}>top-down</option>
                  <option value="freely" disabled={isPhysicsModeDisabled('freely', cameraMode)}>freely</option>
                </select>
              </div>

              <div className="flex items-center gap-0.5 md:gap-2">
                <label className="text-white/70 text-[10px] md:text-sm whitespace-nowrap">Camera</label>
                <select
                  value={cameraMode}
                  onChange={(e) => setCameraMode(e.target.value as 'fixed' | 'follow' | 'auto-scroll')}
                  className="bg-slate-800 border border-white/10 rounded-md
                             px-1 py-0.5 md:px-3 md:py-1.5
                             text-[11px] text-white
                             focus:border-[#38bdf8] outline-none cursor-pointer
                             disabled:opacity-50"
                  disabled={isGenerating}
                >
                  <option value="fixed" disabled={isCameraModeDisabled('fixed', physicsMode)}>fixed</option>
                  <option value="follow" disabled={isCameraModeDisabled('follow', physicsMode)}>follow</option>
                  <option value="auto-scroll" disabled={isCameraModeDisabled('auto-scroll', physicsMode)}>auto-scroll</option>
                </select>
              </div>
            </div>

            {/* 右侧：Generate 按钮 */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !userPrompt.trim()}
              className="px-2 md:px-6 py-1 md:py-2 rounded-xl
                           text-[10px] md:text-[clamp(1.2vw,1.8rem,1.8vw)]
                           bg-gradient-to-r from-blue-500 to-cyan-400
                           font-semibold text-white
                           transition-all duration-300
                           disabled:opacity-50 disabled:cursor-not-allowed
                           whitespace-nowrap"
            >
              {isGenerating ? '...' : 'Generate'}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* 生成进度显示 */}
        {isGenerating && (
          <div className="mt-3 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl">
            {/* 阶段列表 */}
            <div className="space-y-1 text-xs">
              {GENERATION_STEPS.map(({ step, label }) => {
                const status = generationStatus.steps.get(step) || 'pending';
                const icon = status === 'success' ? '✓' :
                             status === 'running' ? '○' :
                             status === 'error' ? '✗' : '○';
                const color = status === 'success' ? 'text-green-400' :
                              status === 'running' ? 'text-blue-400' :
                              status === 'error' ? 'text-red-400' : 'text-gray-500';

                return (
                  <div key={step} className={`flex items-center gap-2 ${color}`}>
                    <span>{icon}</span>
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>

            {/* 预计时间 */}
            <p className="text-gray-400 text-xs mt-3">Estimated time: approximately 4–6 minutes</p>
          </div>
        )}
      </div>
    </div>
  );
}

// import { useState } from 'react';
// import { gamePrototypeService, GenerationStep, type StepStatus } from '../services/GamePrototypeService';
// import type { GameRules } from '../game/core/types';

// interface HomePageProps {
//   onNavigate: (tab: 'home' | 'preview' | 'history' | 'settings', versionId?: string, gameData?: { code: GameRules; mapData: any }) => void;
// }

// // 生成阶段标签映射（简化版）
// const GENERATION_STEPS = [
//   { step: GenerationStep.LOAD_MAP, label: 'Loading map data' },
//   { step: GenerationStep.LOAD_CODE, label: 'Loading game code' },
// ] as const;

// // ========== 测试模式配置 - 手动调整这两个值来测试不同模式 ==========
// const TEST_PHYSICS_MODE: 'platformer' | 'topdown' | 'freely' = 'platformer';
// const TEST_CAMERA_MODE: 'fixed' | 'follow' | 'auto-scroll' = 'follow';
// // =====================================================================

// export default function HomePage({ onNavigate }: HomePageProps) {
//   const [isGenerating, setIsGenerating] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [generationStatus, setGenerationStatus] = useState<{
//     currentStep: string | null;
//     progress: number;
//     message: string;
//     steps: Map<string, 'pending' | 'running' | 'success' | 'error'>;
//   }>({
//     currentStep: null,
//     progress: 0,
//     message: '',
//     steps: new Map(),
//   });

//   const handleGenerate = async () => {
//     setIsGenerating(true);
//     setError(null);

//     try {
//       const result = await gamePrototypeService.generatePrototype({
//         onStepUpdate: (status: StepStatus) => {
//           setGenerationStatus(prev => {
//             const newSteps = new Map(prev.steps);
//             newSteps.set(status.step, status.status);

//             return {
//               currentStep: status.step,
//               progress: status.progress || 0,
//               message: status.message,
//               steps: newSteps,
//             };
//           });
//         },
//       });

//       if (result.success && result.gameCode && result.mapData) {
//         // 使用测试配置动态添加 gameConfig（只包含 physicsMode 和 cameraMode）
//         result.gameCode.gameConfig = {
//           physicsMode: TEST_PHYSICS_MODE,
//           cameraMode: TEST_CAMERA_MODE,
//         };

//         console.log('[homepage] onNavigate called with gameConfig:', result.gameCode.gameConfig);
//         onNavigate('preview', undefined, {
//           code: result.gameCode,
//           mapData: result.mapData,
//         });
//       } else {
//         const errorMsg = result.error || '加载失败';
//         console.error('[HomePage] ❌ Load failed:', errorMsg);
//         setError(errorMsg);
//       }
//     } catch (err) {
//       const errorMsg = err instanceof Error ? err.message : '未知错误';
//       console.error('[HomePage] ❌ Load error:', errorMsg);
//       setError(errorMsg);
//     } finally {
//       setIsGenerating(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center py-[3vh] px-[4vw] pb-tabbar-safe">
//       <div className="w-full max-w-[55vw] max-h-[80vh] overflow-y-auto">
//         <h1 className="whitespace-nowrap text-[clamp(1.4vw,2.5rem,2.5vw)] font-bold mb-3 md:mb-4 text-center text-white">
//           DESCRIBE YOUR DREAM 2DGAME
//         </h1>

//         <p className="text-center text-gray-400 mb-4">
//           sample-battlecity
//         </p>

//         <button
//           onClick={handleGenerate}
//           disabled={isGenerating}
//           className="block mt-2 md:mt-4 w-[97%] mx-auto py-1.5 md:py-2.5 rounded-xl text-[clamp(1.2vw,1.8rem,1.8vw)]
//                            bg-gradient-to-r from-blue-500 to-cyan-400
//                            font-semibold text-white
//                            transition-all duration-300
//                            disabled:opacity-50 disabled:cursor-not-allowed">
//           {isGenerating ? 'Loading...' : '⭐Load Game⭐'}
//         </button>

//         {/* 错误提示 */}
//         {error && (
//           <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-xl">
//             <p className="text-red-400 text-sm">{error}</p>
//           </div>
//         )}

//         {/* 加载进度显示 */}
//         {isGenerating && (
//           <div className="mt-3 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl">
//             {/* 阶段列表 */}
//             <div className="space-y-1 text-xs">
//               {GENERATION_STEPS.map(({ step, label }) => {
//                 const status = generationStatus.steps.get(step) || 'pending';
//                 const icon = status === 'success' ? '✓' :
//                   status === 'running' ? '○' :
//                     status === 'error' ? '✗' : '○';
//                 const color = status === 'success' ? 'text-green-400' :
//                   status === 'running' ? 'text-blue-400' :
//                     status === 'error' ? 'text-red-400' : 'text-gray-500';

//                 return (
//                   <div key={step} className={`flex items-center gap-2 ${color}`}>
//                     <span>{icon}</span>
//                     <span>{label}</span>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }