import * as ex from 'excalibur';
import type { MapData, GameRules } from './types';
import { GameModeManager } from './GameModeManager';
import { MapLoader } from '../loader/MapLoader';
import { InputManager } from '../runtime/InputManager';
import { RuleExecutor } from '../runtime/RuleExecutor';
import { PhysicsManager } from '../runtime/PhysicsManager';
import { PathfindingManager } from '../utils/PathfindingManager';
import { ResourceManager } from '../loader/ResourceManager';

export class GameEngine {
    private static instance: GameEngine;

    public game!: ex.Engine;  // 延迟初始化
    private modeManager!: GameModeManager;
    private mapLoader!: MapLoader;
    private ruleExecutor!: RuleExecutor;
    private physicsManager!: PhysicsManager;
    public inputManager!: InputManager;
    private pathfindingManager: PathfindingManager;

    private currentPlayer: ex.Actor | null = null;
    private currentRules: GameRules | null = null;
    private currentPhysicsMode: string = '';  // 存储当前物理模式

    private initialized = false;
    private isPaused: boolean = false;

    private currentTileSize: number = 32;

    // Player 死亡回调
    private onPlayerDeathCallback?: () => void;

    private constructor() {
        // 不在这里创建 Engine
        this.pathfindingManager = new PathfindingManager();
    }

    public static getInstance(): GameEngine {
        if (!GameEngine.instance) {
            GameEngine.instance = new GameEngine();
        }
        return GameEngine.instance;
    }

    /**
     * 初始化引擎，绑定到指定的 canvas 元素
     */
    public init(canvas: HTMLCanvasElement) {
        // 如果已经初始化，先清理旧的engine（支持重新绑定新的 canvas）
        // 避免新加载的游戏无法绑定canvas的问题
        if (this.initialized) {
            console.log('[GameEngine] Re-initializing with new canvas');
            this.game?.stop();
            this.initialized = false;
            // 注意：不重新创建 physicsManager，复用以避免 collision group 冲突
        }

        // 创建 Engine 时直接传入 canvas 元素
        this.game = new ex.Engine({
            canvasElement: canvas,  // ✅ 关键：直接传入 canvas 元素
            width: 600,
            height: 600,
            displayMode: ex.DisplayMode.FitContainer,  // ✅ 改成自适应容器
            backgroundColor: ex.Color.fromHex('#000000'),
            pixelArt: true,
            antialiasing: false,
        });

        // 初始化管理器
        this.modeManager = new GameModeManager(this.game);
        // 复用 physicsManager（如果已存在），避免 collision group 冲突
        if (!this.physicsManager) {
            this.physicsManager = new PhysicsManager(this.game);
        }
        this.mapLoader = new MapLoader(this.game, this.physicsManager);
        this.inputManager = new InputManager(this.game);
        this.ruleExecutor = new RuleExecutor(this);

        this.initialized = true;
        console.log('GameEngine initialized with canvas:', canvas);
    }

    /**
     * 获取 PhysicsManager 实例（供其他模块使用）
     */
    public getPhysicsManager(): PhysicsManager {
        return this.physicsManager;
    }

    /**
     * 获取寻路管理器
     */
    public getPathfindingManager(): PathfindingManager {
        return this.pathfindingManager;
    }

    /**
     * 获取当前物理模式
     */
    public getCurrentPhysicsMode(): string {
        return this.currentPhysicsMode;
    }

    /**
     * 发射投射物接口
     */
    public spawnProjectile(type: string, x: number, y: number, dir: ex.Vector, owner: ex.Actor) {
        const bullet = this.ruleExecutor.getFactory().createProjectile(type, x, y, dir, owner);
        // // ✅ 测试各种碰撞事件
        // bullet.on('precollision', (evt) => {
        //     console.log(`[Bullet precollision] with: ${evt.other.name}`);
        // });

        // bullet.on('postcollision', (evt) => {
        //     console.log(`[Bullet postcollision] with: ${evt.other.name}`);
        // });

        // bullet.on('collisionstart', (evt) => {
        //     console.log(`[Bullet collisionstart] with: ${evt.other.name}`);
        // });

        // bullet.on('collisionend', (evt) => {
        //     console.log(`[Bullet collisionend] with: ${evt.other.name}`);
        // });

        // console.log(`[GameEngine] Spawned projectile: ${bullet.name}, group: ${bullet.body.group?.name}, type: ${bullet.body.collisionType}`);

        // 给投射物注册碰撞监听
        bullet.on('collisionstart', (evt) => {
            this.ruleExecutor.handleProjectileCollision(bullet, evt.other);
        });

        this.game.add(bullet);
    }

    public getTileSize(): number {
        return this.currentTileSize;
    }

    /**
     * 加载游戏
     */
    public async loadGame(mapData: MapData, rules: GameRules) {
        if (!this.initialized) {
            throw new Error('GameEngine not initialized. Call init() first.');
        }

        console.log('[GameEngine] loadGame called, gameConfig:', rules.gameConfig);

        // 停止并清理旧场景
        this.game.stop();

        // 清理旧的贴图资源
        ResourceManager.getInstance().clear();

        this.currentRules = rules;
        this.currentPlayer = null;

        // 存储物理模式
        this.currentPhysicsMode = rules.gameConfig.physicsMode;
        console.log('[GameEngine] currentPhysicsMode:', this.currentPhysicsMode);

        if (rules.inputMapping) {
            this.inputManager.setMapping(rules.inputMapping);
        }

        await this.game.start();

        // 重新配置碰撞组（需要在引擎启动后）
        this.physicsManager.reconfigure(rules);

        // 对于 follow 和 auto-scroll 模式，根据引擎实际高度动态计算 tileSize
        // 确保地图高度等于视口高度
        let actualTileSize = rules.gameConfig.tileSize || 32;
        this.currentTileSize = actualTileSize;


        const cameraMode = rules.gameConfig.cameraMode;
        if (cameraMode === 'follow' || cameraMode === 'auto-scroll') {
            const gridHeight = mapData.terrain.grid.length;
            actualTileSize = Math.floor(this.game.drawHeight / gridHeight);
            console.log(`[GameEngine] Dynamic tileSize for ${cameraMode} mode: ${actualTileSize} (drawHeight: ${this.game.drawHeight}, gridHeight: ${gridHeight})`);
        }

        // mapLoader.load 现在是异步的，需要等待贴图加载完成
        const playerActor = await this.mapLoader.load(
            mapData,
            actualTileSize,
            rules.entityConfig,
            this.currentPhysicsMode
        );
        this.currentPlayer = playerActor;

        // 注册碰撞监听器
        // 初始化实体后再注册碰撞监听
        this.ruleExecutor.init(rules);

        // 激活非 player 实体的技能（自动触发）
        this.game.currentScene.actors.forEach(actor => {
            if (actor.name && actor.name !== 'boundary_wall') {
                this.ruleExecutor.activateEntitySkills(actor.name, actor);
            }
        });

        // 初始化寻路管理器（platformer 模式不需要寻路）
        if (this.currentPhysicsMode !== 'platformer') {
            this.pathfindingManager.initialize(
                mapData,
                actualTileSize,
                this.currentPhysicsMode,
                this.game
            );
        }

        const mapWidth = mapData.terrain.grid[0].row.length * actualTileSize;
        const mapHeight = mapData.terrain.grid.length * actualTileSize;

        this.modeManager.configure(
            rules.gameConfig,
            mapWidth,
            mapHeight,
            playerActor || undefined
        );

        this.game.currentScene.off('preupdate');
        this.game.currentScene.on('preupdate', (evt) => this.updateLoop(evt.delta));

        console.log('Game Loaded via GameEngine Core');

        // 监听碰撞事件
        // this.game.currentScene.on('collisionstart', (evt) => {
        //     console.log(`[TEST Collision] ${evt.actorA.name} <-> ${evt.actorB.name}`);
        // });
    }

    private updateLoop(delta: number) {
        if (this.isPaused) return;
        if (!this.currentPlayer || !this.currentRules) return;

        // 更新摄像机（用于 auto-scroll 模式）
        this.modeManager.update(delta);

        const mode = this.currentRules.gameConfig.physicsMode;
        const moveDir = this.inputManager.getMoveVector(mode);
        const speed = this.currentRules.entityConfig['player']?.speed || 150;

        // 获取 auto-scroll 的基础速度（如果是 auto-scroll 模式）
        const autoScrollBaseSpeed = this.modeManager.getAutoScrollSpeed();

        if (mode === 'topdown') {
            this.currentPlayer.vel = moveDir.scale(speed);
            this.currentPlayer.vel.x += autoScrollBaseSpeed;
            if (moveDir.size > 0.1) {
                this.currentPlayer.rotation = moveDir.toAngle();
            }
        } else if (mode === 'freely') {
            // Freely: 与 topdown 相同的运动逻辑
            this.currentPlayer.vel = moveDir.scale(speed);
            this.currentPlayer.vel.x += autoScrollBaseSpeed;
            if (moveDir.size > 0.1) {
                this.currentPlayer.rotation = moveDir.toAngle();
            }
        } else if (mode === 'platformer') {
            // Platformer: 只控制 X，Y 由物理引擎处理
            this.currentPlayer.vel.x = moveDir.x * speed + autoScrollBaseSpeed;

            // 检测跳跃键释放，实现可变高度跳跃
            if (this.inputManager.isActionJustReleased('jump')) {
                const wrapper = (this.currentPlayer as any)._entityWrapper;
                if (wrapper && typeof wrapper.jumpRelease === 'function') {
                    wrapper.jumpRelease();
                }
            }
        }

        // 移除位置强制取整，防止卡墙
        // this.currentPlayer.pos.x = Math.round(this.currentPlayer.pos.x);
        // this.currentPlayer.pos.y = Math.round(this.currentPlayer.pos.y);

        this.ruleExecutor.update(this.currentPlayer, delta);

        // 在帧末尾保存当前状态，供下一帧的 isActionJustPressed 使用
        this.inputManager.saveCurrentState();
    }

    public stop() {
        this.game?.stop();
    }

    /**
     * 设置 Player 死亡回调
     */
    public setOnPlayerDeathCallback(callback: () => void) {
        this.onPlayerDeathCallback = callback;
    }

    /**
     * 触发 Player 死亡回调
     */
    public triggerPlayerDeath() {
        if (this.onPlayerDeathCallback) {
            this.onPlayerDeathCallback();
        }
    }

    /**
    * 切换暂停状态
    */
    public togglePause(): void {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.game.stop();
        } else {
            this.game.start();
        }
    }

    /**
     * 获取暂停状态
     */
    public getPausedState(): boolean {
        return this.isPaused;
    }

    /**
     * 完全销毁引擎（用于组件卸载时）
     */
    public destroy() {
        console.log('[GameEngine] destroy() called');  // ✅ 添加
        console.trace();
        this.game?.stop();
        this.initialized = false;
        GameEngine.instance = null as any;
    }
}