import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/core/GameEngine';
import { VirtualGamepad } from './VirtualGamepad';
import type { MapData, GameRules } from '../game/core/types';

interface GameCanvasProps {
  mapData?: MapData | null;
  rules?: GameRules | null;
  onPlayerDeath?: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ mapData, rules, onPlayerDeath }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = GameEngine.getInstance();
    engine.init(canvasRef.current);
    engineRef.current = engine;

    return () => {
      engine.stop();
    };
  }, []);


  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !mapData || !rules) return;

    console.log('[GameCanvas] loadGame called');
    engine.loadGame(mapData, rules).catch(err => {
      console.error('Game Load Failed:', err);
    });
  }, [mapData, rules]);

  // 注册 player 死亡回调
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !onPlayerDeath) return;

    engine.setOnPlayerDeathCallback(onPlayerDeath);
  }, [onPlayerDeath]);

  // 暂停状态轮询
  useEffect(() => {
    const interval = setInterval(() => {
      setIsPaused(engineRef.current?.getPausedState() ?? false);
    }, 100);
    return () => clearInterval(interval);
  }, []);


  const handleJoystickMove = (x: number, y: number) => {
    engineRef.current?.inputManager.setJoystick(x, y);
  };
  const handleJoystickRelease = () => {
    engineRef.current?.inputManager.setJoystick(0, 0);
  };
  const handleButtonPress = (btn: 'A' | 'B' | 'X' | 'Y') => {
    engineRef.current?.inputManager.setButtonState(btn, true);
  };
  const handleButtonRelease = (btn: 'A' | 'B' | 'X' | 'Y') => {
    engineRef.current?.inputManager.setButtonState(btn, false);
  };

  return (
    // ✅ 关键修改：使用 h-full 而不是 h-screen，让组件适应父容器
    <div className="relative w-full h-full bg-gray-900 overflow-hidden">

      {/* Loading 提示 */}
      {(!mapData || !rules) && (
        <div className="absolute inset-0 flex items-center justify-center text-white z-10">
          Waiting for Game Generation...
        </div>
      )}

      {/* 游戏画布区域 - 占据上方大部分空间 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full"
          style={{ boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* 暂停UI */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white mb-4 animate-pulse">
              PAUSED
            </h2>
            <p className="text-gray-300 text-sm">Press SPACE to continue</p>
          </div>
        </div>
      )}

      {/* 虚拟手柄 - 固定在底部，确保在容器内 */}
      <div className="absolute bottom-2 left-0 right-0 h-20">
        <VirtualGamepad
          onJoystickMove={handleJoystickMove}
          onJoystickRelease={handleJoystickRelease}
          onButtonPress={handleButtonPress}
          onButtonRelease={handleButtonRelease}
        />
      </div>
    </div>
  );
};