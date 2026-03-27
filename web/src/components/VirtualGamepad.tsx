import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/core/GameEngine';

interface VirtualGamepadProps {
  onJoystickMove?: (x: number, y: number) => void;
  onJoystickRelease?: () => void;
  onButtonPress?: (button: 'A' | 'B' | 'X' | 'Y') => void;
  onButtonRelease?: (button: 'A' | 'B' | 'X' | 'Y') => void;
}

// 键盘到按钮的映射 (WASD映射到ABXY)
const KEY_TO_BUTTON: Record<string, 'A' | 'B' | 'X' | 'Y'> = {
  'w': 'Y', 'W': 'Y',  // W → Y (上)
  's': 'A', 'S': 'A',  // S → A (下)
  'a': 'X', 'A': 'X',  // A → X (左)
  'd': 'B', 'D': 'B',  // D → B (右)
};

// 键盘到方向的映射
const KEY_TO_DIRECTION: Record<string, { x: number; y: number }> = {
  'ArrowUp': { x: 0, y: -1 },
  'ArrowDown': { x: 0, y: 1 },
  'ArrowLeft': { x: -1, y: 0 },
  'ArrowRight': { x: 1, y: 0 },
};

export function VirtualGamepad({
  onJoystickMove,
  onJoystickRelease,
  onButtonPress,
  onButtonRelease
}: VirtualGamepadProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const joystickTouchId = useRef<number | null>(null);
  const pressedDirections = useRef<Set<string>>(new Set());
  const [visualPressedButtons, setVisualPressedButtons] = useState<Set<'A' | 'B' | 'X' | 'Y'>>(new Set());

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 空格键暂停
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        GameEngine.getInstance().togglePause();
        return;
      }

      // 处理按钮
      const button = KEY_TO_BUTTON[e.key];
      if (button) {
        setVisualPressedButtons(prev => {
          if (prev.has(button)) return prev;
          const newSet = new Set(prev);
          newSet.add(button);
          return newSet;
        });
        onButtonPress?.(button);
      }

      // 处理方向
      const direction = KEY_TO_DIRECTION[e.key];
      if (direction && !pressedDirections.current.has(e.key)) {
        pressedDirections.current.add(e.key);
        updateJoystickFromKeys();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // 处理按钮
      const button = KEY_TO_BUTTON[e.key];
      if (button) {
        setVisualPressedButtons(prev => {
          const newSet = new Set(prev);
          newSet.delete(button);
          return newSet;
        });
        onButtonRelease?.(button);
      }

      // 处理方向
      const direction = KEY_TO_DIRECTION[e.key];
      if (direction) {
        pressedDirections.current.delete(e.key);
        updateJoystickFromKeys();
      }
    };

    const updateJoystickFromKeys = () => {
      let x = 0;
      let y = 0;

      pressedDirections.current.forEach(key => {
        const dir = KEY_TO_DIRECTION[key];
        if (dir) {
          x += dir.x;
          y += dir.y;
        }
      });

      // 归一化
      const length = Math.sqrt(x * x + y * y);
      if (length > 0) {
        x = x / length;
        y = y / length;
      }

      // 更新摇杆视觉位置
      if (thumbRef.current) {
        const maxDistance = 50;
        thumbRef.current.style.transform = `translate(${x * maxDistance}px, ${y * maxDistance}px)`;
      }

      if (pressedDirections.current.size > 0) {
        onJoystickMove?.(x, y);
      } else {
        onJoystickRelease?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onJoystickMove, onJoystickRelease, onButtonPress, onButtonRelease]);

  // 摇杆逻辑（保持不变）
  useEffect(() => {
    const joystick = joystickRef.current;
    const thumb = thumbRef.current;
    if (!joystick || !thumb) return;

    const maxDistance = 50;

    const handleStart = (_clientX: number, _clientY: number) => {
      isDragging.current = true;
    };

    const handleMove = (clientX: number, clientY: number) => {
      if (!isDragging.current) return;

      const rect = joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let deltaX = clientX - centerX;
      let deltaY = clientY - centerY;

      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > maxDistance) {
        const angle = Math.atan2(deltaY, deltaX);
        deltaX = Math.cos(angle) * maxDistance;
        deltaY = Math.sin(angle) * maxDistance;
      }

      thumb.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

      const normalizedX = deltaX / maxDistance;
      const normalizedY = deltaY / maxDistance;
      onJoystickMove?.(normalizedX, normalizedY);
    };

    const handleEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      thumb.style.transform = 'translate(0, 0)';
      onJoystickRelease?.();
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      joystickTouchId.current = touch.identifier;
      handleStart(touch.clientX, touch.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (joystickTouchId.current === null) return;

      // 找到摇杆的触摸点
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === joystickTouchId.current) {
          e.preventDefault();
          handleMove(e.touches[i].clientX, e.touches[i].clientY);
          break;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (joystickTouchId.current === null) return;

      // 检查结束的触摸点是否是摇杆的
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId.current) {
          e.preventDefault();
          joystickTouchId.current = null;
          handleEnd();
          break;
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      handleStart(e.clientX, e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      handleEnd();
    };

    joystick.addEventListener('touchstart', onTouchStart, { passive: false });
    joystick.addEventListener('mousedown', onMouseDown);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchend', onTouchEnd, { passive: false });
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      joystick.removeEventListener('touchstart', onTouchStart);
      joystick.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onJoystickMove, onJoystickRelease]);

  const buttons = [
    { id: 'Y' as const, color: '#f08c00', position: 'top-0 right-1/2 translate-x-1/2' },
    { id: 'B' as const, color: '#e03131', position: 'top-1/2 right-0 -translate-y-1/2' },
    { id: 'A' as const, color: '#2f9e44', position: 'bottom-0 right-1/2 translate-x-1/2' },
    { id: 'X' as const, color: '#1971c2', position: 'top-1/2 left-0 -translate-y-1/2' },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {/* 左侧：摇杆 - 响应式 */}
      <div className="absolute 
                      bottom-2 left-2 
                      sm:bottom-4 sm:left-4 
                      md:bottom-6 md:left-8 
                      lg:bottom-4 lg:left-16 
                      pointer-events-auto">
        <div
          ref={joystickRef}
          className="relative 
                     w-20 h-20 
                     sm:w-24 sm:h-24 
                     md:w-28 md:h-28 
                     lg:w-32 lg:h-32
                     rounded-full bg-black/30 border-2 border-white/20 
                     flex items-center justify-center"
        >
          {/* 拇指摇杆 */}
          <div
            ref={thumbRef}
            className="absolute 
                       w-10 h-10 
                       sm:w-12 sm:h-12 
                       md:w-14 md:h-14 
                       lg:w-16 lg:h-16
                       rounded-full bg-white/60 border-2 border-cyan-400 
                       shadow-[0_0_15px_rgba(56,189,248,0.6)] 
                       transition-transform duration-100"
            style={{ transform: 'translate(0, 0)' }}
          />
        </div>
      </div>

      {/* 右侧：按钮组 - 响应式 */}
      <div className="absolute 
                      bottom-2 right-2 
                      sm:bottom-4 sm:right-4 
                      md:bottom-6 md:right-8 
                      lg:bottom-4 lg:right-16 
                      pointer-events-auto">
        <div className="relative 
                        w-32 h-32 
                        sm:w-36 sm:h-36 
                        md:w-40 md:h-40 
                        lg:w-48 lg:h-48">
          {buttons.map(({ id, color, position }) => {
            const isPressed = visualPressedButtons.has(id);
            return (
              <button
                key={id}
                onTouchStart={() => {
                  setVisualPressedButtons(prev => new Set(prev).add(id));
                  onButtonPress?.(id);
                }}
                onTouchEnd={() => {
                  setVisualPressedButtons(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(id);
                    return newSet;
                  });
                  onButtonRelease?.(id);
                }}
                onMouseDown={() => {
                  setVisualPressedButtons(prev => new Set(prev).add(id));
                  onButtonPress?.(id);
                }}
                onMouseUp={() => {
                  setVisualPressedButtons(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(id);
                    return newSet;
                  });
                  onButtonRelease?.(id);
                }}
                className={`absolute ${position}
                         w-10 h-10
                         sm:w-12 sm:h-12
                         md:w-14 md:h-14
                         lg:w-16 lg:h-16
                         rounded-full
                         border-2 md:border-3 border-white/80
                         font-bold text-white
                         text-sm sm:text-base md:text-lg lg:text-xl
                         shadow-lg transition-all duration-75 select-none
                         flex items-center justify-center
                         ${isPressed ? 'scale-90' : 'scale-100'}`}
                style={{
                  backgroundColor: color,
                  opacity: isPressed ? 1 : 0.8,
                  boxShadow: isPressed ? `0 0 30px ${color}` : `0 0 20px ${color}80`
                }}
              >
                {id}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );
}