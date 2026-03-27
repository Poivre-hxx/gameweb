import * as ex from 'excalibur';
import type { GameConfig } from './types';

export class GameModeManager {
  private engine: ex.Engine;
  private autoScrollSpeed = 0;
  private autoScrollMaxX = 0;
  private autoScrollEnabled = false;
  private mapWidth = 0;  // 用于 follow 模式的 X 轴边界限制
  private followModeEnabled = false;
  private followPlayer?: ex.Actor;  // follow 模式下跟随的玩家

  constructor(engine: ex.Engine) {
    this.engine = engine;
  }

  /**
   * 应用游戏模式配置
   * @param config 游戏配置
   * @param mapWidth 地图总宽度 (像素)
   * @param mapHeight 地图总高度 (像素)
   * @param player 玩家实体 (用于摄像机跟随)
   */
  public configure(config: GameConfig, mapWidth: number, mapHeight: number, player?: ex.Actor) {
    this.setupPhysics(config.physicsMode);
    this.setupCamera(config.cameraMode, mapWidth, mapHeight, player);
  }

  /**
   * 获取 auto-scroll 的基础速度
   * 如果当前不是 auto-scroll 模式，返回 0
   */
  public getAutoScrollSpeed(): number {
    return this.autoScrollEnabled ? this.autoScrollSpeed : 0;
  }

  /**
   * 每帧更新（用于 auto-scroll 模式和 follow 模式的边界检查）
   */
  public update(delta: number) {
    const camera = this.engine.currentScene.camera;

    // follow 模式：手动计算 camera 位置并应用边界限制
    if (this.followModeEnabled && this.followPlayer && this.mapWidth > 0) {
      // 计算目标 X 位置（跟随玩家）
      let targetX = this.followPlayer.pos.x;

      // 应用边界限制，确保相机不显示地图外的内容
      const minX = this.engine.drawWidth / 2;
      const maxX = this.mapWidth - this.engine.drawWidth / 2;

      if (targetX < minX) targetX = minX;
      if (targetX > maxX) targetX = maxX;

      camera.pos.x = targetX;
    }

    // auto-scroll 模式
    if (this.autoScrollEnabled) {
      const camera = this.engine.currentScene.camera;
      camera.pos.x += this.autoScrollSpeed * (delta / 1000);

      // 边界检查：防止超出左右边界
      // 左边界：相机 X 坐标最小为视口宽度的一半（地图左边界对齐视口左边界）
      const minX = this.engine.drawWidth / 2;
      // 右边界：相机 X 坐标最大为地图宽度减去视口宽度的一半（地图右边界对齐视口右边界）
      const maxX = this.autoScrollMaxX;

      if (camera.pos.x < minX) {
        camera.pos.x = minX;
      }
      if (camera.pos.x > maxX) {
        camera.pos.x = maxX;
      }
    }
  }

  // 1. 设置物理模式 (重力由 EntityFactory 在创建实体时通过 actor.acc 设置)
  private setupPhysics(mode: 'platformer' | 'topdown' | 'freely') {
    // 重力配置已移至 EntityFactory.createEntity() 中，根据实体类型设置 actor.acc
    console.log(`[GameMode] Physics mode: ${mode}`);
  }

  // 2. 设置摄像机模式
  private setupCamera(
    mode: 'fixed' | 'follow' | 'auto-scroll',
    mapWidth: number,
    mapHeight: number,
    player?: ex.Actor
  ) {
    const camera = this.engine.currentScene.camera;
    camera.clearAllStrategies(); // 清理旧策略

    // 重置状态
    this.autoScrollEnabled = false;
    this.autoScrollSpeed = 0;
    this.autoScrollMaxX = 0;
    this.followModeEnabled = false;

    switch (mode) {
      case 'fixed':
        // 固定视角：居中显示地图
        const centerX = mapWidth / 2;
        const centerY = mapHeight / 2;
        camera.pos = new ex.Vector(centerX, centerY);

        console.log(`[Camera] Fixed mode - center: (${centerX}, ${centerY})`);
        break;

      case 'follow':
        // 跟随模式：X 轴跟随 player，Y 轴固定在地图中央
        if (player) {
          // 保存地图尺寸用于 update 中的 X 轴边界检查
          this.mapWidth = mapWidth;
          this.followModeEnabled = true;
          this.followPlayer = player;  // 保存 player 引用

          // 设置相机初始位置
          camera.pos.x = this.engine.drawWidth / 2;  // X 从地图左侧开始
          camera.pos.y = mapHeight / 2;               // Y 固定在地图中央

          // 不使用 lockToActorAxis，改为在 update() 中手动计算位置并应用边界限制
        }
        console.log(`[Camera] Follow mode - X follows player, Y fixed at map center`);
        break;

      case 'auto-scroll':
        // 自动卷轴：水平向右滚动
        this.autoScrollSpeed = 100; // 每秒 100 像素
        this.autoScrollMaxX = mapWidth - this.engine.drawWidth / 2;  // 右边界：地图宽度减去视口一半
        this.autoScrollEnabled = true;

        // 初始位置在地图左侧（修复：camera.pos.x 应该是视口宽度的一半，而不是 0）
        camera.pos.x = this.engine.drawWidth / 2;
        camera.pos.y = mapHeight / 2;
        console.log(`[Camera] Auto-scroll mode enabled, speed: ${this.autoScrollSpeed}px/s`);
        break;
    }
    console.log(`[GameMode] Camera set to: ${mode}`);
  }
}
