import * as ex from 'excalibur';

export class InputManager {
  // 1. 内部状态存储
  private virtualJoystick = ex.Vector.Zero;
  private virtualButtons = new Set<string>(); // 存储 'A' | 'B' | 'X' | 'Y'
  private lastFrameButtons = new Set<string>(); // 上一帧的按键状态

  // 2. 映射规则 (由 LLM 生成)
  // 格式示例: { "A": "shoot", "B": "jump", "X": "reload" }
  private currentMapping: Record<string, string> = {};

  private engine: ex.Engine;
  constructor(engine: ex.Engine) {
    this.engine = engine;
  }

  /**
   * 设置当前的输入映射 (在 loadGame 时调用)
   */
  setMapping(mapping: Record<string, string>) {
    this.currentMapping = mapping;
  }

  // ========== 来自 React UI 的信号通道 ==========

  setJoystick(x: number, y: number) {
    // x, y 已经是归一化的 (-1 到 1)
    this.virtualJoystick = new ex.Vector(x, y);
  }

  setButtonState(button: string, pressed: boolean) {
    if (pressed) {
      this.virtualButtons.add(button);
    } else {
      this.virtualButtons.delete(button);
    }
  }

  // ========== 给游戏逻辑使用的查询接口 ==========

  /**
   * 获取移动向量 (摇杆方式)
   */
  getMoveVector(mode: 'topdown' | 'platformer' | 'freely'): ex.Vector {
    const raw = this.virtualJoystick;

    // 模式修正
    if (mode === 'platformer') {
      // 平台跳跃模式下，摇杆通常只控制左右移动
      // 上下由重力或跳跃键控制，防止摇杆导致角色"飞行"
      return new ex.Vector(raw.x, 0);
    }

    if (mode === 'topdown') {
      // Topdown: 4 方向移动（上下左右）
      const absX = Math.abs(raw.x);
      const absY = Math.abs(raw.y);
      const threshold = 0.3;

      if (absX < threshold && absY < threshold) {
        return ex.Vector.Zero;
      }

      // 选择主导轴
      if (absX > absY) {
        return new ex.Vector(Math.sign(raw.x), 0);
      } else {
        return new ex.Vector(0, Math.sign(raw.y));
      }
    }

    // Freely: 8 方向自由移动
    return raw;
  }

  /**
   * 检查动作是否触发
   * @param actionName 游戏定义的动作名，如 "shoot", "jump", "interact"
   */
  isActionPressed(actionName: string): boolean {
    // 遍历映射表，查找哪个按钮对应这个动作
    for (const [btn, mappedAction] of Object.entries(this.currentMapping)) {
      if (mappedAction === actionName) {
        // 找到了映射 (例如 "A": "shoot")
        // 检查这个按钮是否被按下
        if (this.virtualButtons.has(btn)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 保存当前按键状态（每帧开始时调用）
   */
  saveCurrentState() {
    this.lastFrameButtons = new Set(this.virtualButtons);
  }

  /**
   * 检测动作按键刚刚释放
   * @param actionName 游戏定义的动作名
   */
  isActionJustReleased(actionName: string): boolean {
    for (const [btn, mappedAction] of Object.entries(this.currentMapping)) {
      if (mappedAction === actionName) {
        // 上帧按下了，本帧没按 = 刚刚释放
        return this.lastFrameButtons.has(btn) && !this.virtualButtons.has(btn);
      }
    }
    return false;
  }

  /**
   * 检测动作按键刚刚按下
   */
  isActionJustPressed(actionName: string): boolean {
    for (const [btn, mappedAction] of Object.entries(this.currentMapping)) {
      if (mappedAction === actionName) {
        return !this.lastFrameButtons.has(btn) && this.virtualButtons.has(btn);
      }
    }
    return false;
  }
}