import * as ex from 'excalibur';
import { GameEngine } from '../core/GameEngine';

// 缓存
const entityWrapperCache = new WeakMap<ex.Actor, EntityWrapper>();

// ==========================================
// 1. 实体包装器
// ==========================================
export class EntityWrapper {
    // 路径相关状态
    private currentPath: ex.Vector[] = [];
    private pathIndex: number = 0;
    private targetPos: ex.Vector | null = null;
    private pathRecomputeTimer: number = 0;
    private readonly PATH_RECOMPUTE_INTERVAL = 500;

    // 卡住检测状态
    private stuckTimer: number = 0;
    private lastStuckCheckPos: ex.Vector | null = null;
    private lastStuckCheckTime: number = 0;
    private readonly STUCK_THRESHOLD = 1000;  // 1秒
    private readonly STUCK_MOVE_THRESHOLD = 5;  // 移动距离阈值

    // 跳跃相关状态（可变高度跳跃）
    private jumpKeyHeld = false;
    private isJumping = false;
    private groundContacts: number = 0;
    private jumpCooldownTimer: number = 0;   // 跳跃冷却计时器
    private readonly JUMP_COOLDOWN = 400;    // 冷却时间 600ms

    constructor(public actor: ex.Actor) {
        // 保存 wrapper 引用，方便 GameEngine 访问
        (this.actor as any)._entityWrapper = this;

        // 初始假设在地面（player 通常生成在地形上）
        this.groundContacts = 1;

        // 禁止旋转
        actor.body.limitDegreeOfFreedom = [ex.DegreeOfFreedom.Rotation];

        // 使用 postcollision 持续检测地面接触（比 collisionstart 更可靠）
        actor.on('postcollision', (evt) => {
            if (evt.side === ex.Side.Bottom) {
                this.groundContacts = 1;
                this.isJumping = false;
                this.jumpKeyHeld = false;
                (this.actor as any)._hasDoubleJumped = false;
            }
        });

        actor.on('collisionend', (evt) => {
            if (evt.side === ex.Side.Bottom) {
                this.groundContacts = Math.max(0, this.groundContacts - 1);
            }
        });

        actor.on('preupdate', (evt) => {
            actor.rotation = 0;
            actor.angularVelocity = 0;

            // 处理冷却计时
            if (this.jumpCooldownTimer > 0) {
                this.jumpCooldownTimer -= evt.delta;
            }
        });
    }

    get name() { return this.actor.name; }
    get pos() { return this.actor.pos; }
    get active() { return this.actor.active && !this.actor.isKilled(); }

    /**
     * 受到伤害
     */
    damage(amount: number) {
        const currentHp = (this.actor as any).hp || 1;
        const newHp = currentHp - amount;
        (this.actor as any).hp = newHp;

        // 受击闪白反馈 (Excalibur Action API)
        this.actor.actions.blink(100, 100, 2);

        if (newHp <= 0) {
            this.die();
        }
    }

    /**
     * 死亡/销毁
     */
    die() {
        // 如果是 player 死亡：闪烁1秒 -> 销毁 -> 等待1秒 -> 跳转（共2秒）
        if (this.name === 'player') {
            // 先闪烁 1 秒
            this.actor.actions.blink(100, 100, 10);  // 100ms间隔闪烁10次 = 1秒

            // 1秒后销毁 player
            setTimeout(() => {
                this.actor.kill();

                // 再等 1 秒后停止引擎并跳转
                setTimeout(() => {
                    const engine = GameEngine.getInstance();
                    engine.stop();  // 停止并清理游戏场景
                    engine.triggerPlayerDeath();  // 触发跳转回调
                }, 1000);
            }, 1000);
            return;
        }

        this.actor.kill();
    }

    // --- 技能配置 --- 
    // ------ projectile（投射物类） ------

    /**
     * basic_shot 单发射击
     * @param type 子弹类型
     */
    basic_shoot(type: string = 'bullet') {
        const engine = GameEngine.getInstance();

        // 计算发射方向，始终使用移动方向
        let dir: ex.Vector;
        if (this.actor.vel.size > 1) {
            // 有移动速度，使用移动方向
            dir = this.actor.vel.normalize();
        } else {
            // 静止时，使用最后保存的方向或默认向上
            dir = (this.actor as any)._lastMoveDir || ex.Vector.fromAngle(-Math.PI / 2);
        }
        // 保存当前方向供静止时使用
        (this.actor as any)._lastMoveDir = dir;

        // 偏移一点，防止出生在自己肚子里
        // width/1.1 是个经验值，刚好在碰撞盒边缘外一点点
        const offset = dir.scale(this.actor.width / 1.1);
        const spawnPos = this.actor.pos.add(offset);

        // 调用引擎生成子弹 (GameEngine 必须有 spawnProjectile 方法)
        engine.spawnProjectile(type, spawnPos.x, spawnPos.y, dir, this.actor);
    }

    /**
     * spread_shot 散射（3颗子弹，45度扩散）
     * @param type 子弹类型
     */
    spread_shot(type: string = 'bullet') {
        const engine = GameEngine.getInstance();

        // 基础发射方向，始终使用移动方向
        let baseDir: ex.Vector;
        if (this.actor.vel.size > 1) {
            baseDir = this.actor.vel.normalize();
        } else {
            baseDir = (this.actor as any)._lastMoveDir || ex.Vector.fromAngle(-Math.PI / 2);
        }
        // 保存当前方向供静止时使用
        (this.actor as any)._lastMoveDir = baseDir;

        const baseAngle = baseDir.toAngle();
        const spreadRad = (45 * Math.PI) / 1200; // 转换为弧度
        const halfSpread = spreadRad / 2;
        const angleStep = spreadRad / 2;

        // 生成多颗子弹
        for (let i = 0; i < 3; i++) {
            // 计算每颗子弹的角度
            const angle = baseAngle - halfSpread + angleStep * i;
            const dir = ex.Vector.fromAngle(angle);

            // 偏移
            const offset = dir.scale(this.actor.width * 1.2);
            const spawnPos = this.actor.pos.add(offset);

            engine.spawnProjectile(type, spawnPos.x, spawnPos.y, dir, this.actor);
        }
    }

    // ------ movement（移动类） ------

    /**
     * jump - 可变高度跳跃
     * 按住跳到最大高度(4个tile)，松开提前下落
     */
    jump() {
        const isGrounded = Math.abs(this.actor.vel.y) < 5;

        const engine = GameEngine.getInstance();
        const tileSize = engine.getTileSize();
        const targetHeight = tileSize * 4;
        const jumpVelocity = -Math.sqrt(2 * 800 * targetHeight);

        if (isGrounded) {
            // 普通跳跃：在地面时触发
            if (!this.isJumping && this.jumpCooldownTimer <= 0) {
                this.actor.vel.y = jumpVelocity;
                this.isJumping = true;
                this.jumpKeyHeld = true;
                this.jumpCooldownTimer = this.JUMP_COOLDOWN;
                (this.actor as any)._hasDoubleJumped = false;
            }
        } else {
            // 二段跳：在空中时触发
            const hasDoubleJumped = (this.actor as any)._hasDoubleJumped || false;
            if (!hasDoubleJumped) {
                this.actor.vel.y = jumpVelocity * 0.5;
                (this.actor as any)._hasDoubleJumped = true;
            }
        }
    }

    /**
     * jumpRelease - 松开跳跃键（提前结束跳跃）
     */
    jumpRelease() {
        if (this.isJumping && this.actor.vel.y < 0) {
            // 正在上升时松开，速度减半以快速下落
            this.actor.vel.y = this.actor.vel.y * 0.5;
        }
        this.jumpKeyHeld = false;
    }

    // ------ Environment（环境类） ------

    /**
     * climbable_platform - 可攀爬平台
     * 玩家接触时可以沿着它移动（忽略重力）
     * 需要在碰撞检测中配合使用
     */
    climbable_platform() {
        // 标记此实体为可攀爬
        (this.actor as any)._isClimbable = true;

        // 设置为可穿透（不阻挡玩家）
        this.actor.body.collisionType = ex.CollisionType.Passive;
    }
    /**
     * 检查玩家是否正在攀爬
     * @param player 玩家实体
     */
    static isPlayerClimbing(player: ex.Actor): boolean {
        return (player as any)._isClimbing || false;
    }
    /**
     * 玩家开始攀爬（在碰撞检测中调用）
     * @param player 玩家实体
     */
    static startClimbing(player: ex.Actor) {
        (player as any)._isClimbing = true;
        // 禁用重力效果（保存原始速度）
        (player as any)._originalVelY = player.vel.y;
        player.vel.y = 0;
    }
    /**
     * 玩家停止攀爬
     * @param player 玩家实体
     */
    static stopClimbing(player: ex.Actor) {
        (player as any)._isClimbing = false;
    }

    /**
     * moving_platform_h - 水平移动平台
     */
    moving_platform_h() {
        // 标记为移动平台
        (this.actor as any)._isPlatform = true;

        const startX = this.actor.pos.x;
        const startY = this.actor.pos.y;
        const moveDistance = 100;  // 移动距离
        const speed = 30;          // 移动速度（像素/秒）

        // 使用 Actions 系统实现来回移动
        this.actor.actions.repeatForever((ctx) => {
            ctx.moveTo(startX + moveDistance, startY, speed);
            ctx.moveTo(startX, startY, speed);
        });
    }

    /**
     * moving_platform_v - 垂直移动平台
     */
    moving_platform_v() {
        // 标记为移动平台
        (this.actor as any)._isPlatform = true;
        (this.actor as any)._platformDirection = 1;  // 1 = 下, -1 = 上

        // 记录起始位置
        const startY = this.actor.pos.y;
        (this.actor as any)._platformStartY = startY;

        // 设置初始速度
        this.actor.vel.y = 30;

        // 每帧检查是否需要反向
        this.actor.on('preupdate', () => {
            const dir = (this.actor as any)._platformDirection;
            const currentY = this.actor.pos.y;
            const maxDistance = (this.actor as any)._platformDistance;

            // 检查速度是否被阻挡（碰到墙）
            if (Math.abs(this.actor.vel.y) < 1) {
                this.reversePlatformV(30);
            }
        });
    }
    /**
     * 垂直平台反向
     */
    private reversePlatformV(speed: number) {
        const dir = (this.actor as any)._platformDirection;
        (this.actor as any)._platformDirection = -dir;
        this.actor.vel.y = -dir * speed;
    }
    // ------ spawn（实体类） ------
    /**
     * create_entity - 创建实体（在当前位置生成指定实体）
     * @param entityName 实体名称（对应 entityConfig 中的 key）
     * @param offset 生成位置偏移（可选）
     */
    create_entity(entityName: string, offset: ex.Vector = ex.Vector.Zero) {
        const engine = GameEngine.getInstance();
        const factory = engine.ruleExecutor.getFactory();

        // 计算生成位置
        const spawnPos = this.actor.pos.add(offset);

        // 从 entityConfig 获取实体配置
        const config = engine.currentRules?.entityConfig[entityName];
        if (!config) {
            console.warn(`[Spawn] Entity config not found: ${entityName}`);
            return null;
        }

        // 根据实体类型创建
        const color = config.color || '#FFFFFF';
        const w = config.width || 1;
        const h = config.height || 1;

        let newActor: ex.Actor | null = null;

        // 判断实体类型并创建
        if (config.behavior !== undefined || entityName.includes('enemy')) {
            // 有 behavior 字段或名字包含 enemy，视为角色
            newActor = factory.createCharacter(entityName, spawnPos.x, spawnPos.y, w, h, color);
        } else if (config.speed !== undefined && config.speed > 0) {
            // 有速度且大于 0，视为投射物
            const dir = ex.Vector.fromAngle(this.actor.rotation);
            newActor = factory.createProjectile(entityName, spawnPos.x, spawnPos.y, dir, this.actor);
        } else {
            // 默认视为道具/地形
            newActor = factory.createProp(entityName, spawnPos.x, spawnPos.y, w, h, color);
        }

        if (newActor) {
            // 注册碰撞处理
            engine.ruleExecutor.registerCollisionHandler(newActor);
            // 添加到场景
            engine.game.add(newActor);
            console.log(`[Spawn] Created ${entityName} at (${spawnPos.x}, ${spawnPos.y})`);
        }

        return newActor;
    }

    // ------ status（状态类） ------
    /**
     * slow - 减速（降低目标移动速度）
     * @param target 目标实体
     * @param duration 持续时间（毫秒）
     * @param slowRate 减速比例（0.5 = 减速50%）
     */
    slow(target: EntityWrapper | null, duration: number = 4000, slowRate: number = 0.5) {
        if (!target || !target.active) return;

        const actor = target.actor;

        // 已经被减速，不重复施加
        if ((actor as any)._isSlowed) return;

        // 记录原始速度
        const originalVel = actor.vel.clone();
        (actor as any)._originalSpeed = originalVel.size;
        (actor as any)._isSlowed = true;

        // 应用减速
        actor.vel = actor.vel.scale(slowRate);

        // 视觉反馈：变蓝
        const originalColor = actor.color?.clone();
        actor.color = ex.Color.Blue;

        console.log(`[Status] ${actor.name} slowed for ${duration}ms`);

        // 持续时间结束后恢复
        setTimeout(() => {
            if (!actor.isKilled()) {
                (actor as any)._isSlowed = false;
                if (originalColor) {
                    actor.color = originalColor;
                }
                console.log(`[Status] ${actor.name} slow ended`);
            }
        }, duration);
    }

    /**
     * fast - 加速（提升自身移动速度）
     * @param duration 持续时间（毫秒）
     * @param speedRate 加速比例（2.0 = 加速100%）
     */
    fast(duration: number = 4000, speedRate: number = 2.0) {
        // 已经被加速，不重复施加
        if ((this.actor as any)._isFast) return;

        // 记录状态
        (this.actor as any)._isFast = true;
        (this.actor as any)._speedMultiplier = speedRate;

        // 视觉反馈：变黄
        const originalColor = this.actor.color?.clone();
        this.actor.color = ex.Color.Yellow;

        console.log(`[Status] ${this.name} speed boosted for ${duration}ms`);

        // 持续时间结束后恢复
        setTimeout(() => {
            if (!this.actor.isKilled()) {
                (this.actor as any)._isFast = false;
                (this.actor as any)._speedMultiplier = 1.0;
                if (originalColor) {
                    this.actor.color = originalColor;
                }
                console.log(`[Status] ${this.name} speed boost ended`);
            }
        }, duration);
    }

    /**
     * trap - 困住（目标无法移动）
     * @param target 目标实体
     * @param duration 持续时间（毫秒）
     */
    trap(target: EntityWrapper | null, duration: number = 4000) {
        if (!target || !target.active) return;

        const actor = target.actor;

        // 已经被困住，不重复施加
        if ((actor as any)._isTrapped) return;

        // 记录原始速度
        const originalVel = actor.vel.clone();
        (actor as any)._isTrapped = true;

        // 完全停止移动
        actor.vel = ex.Vector.Zero;

        // 视觉反馈：变紫 + 闪烁
        const originalColor = actor.color?.clone();
        actor.color = ex.Color.Violet;
        actor.actions.blink(200, 200, Math.floor(duration / 400));

        console.log(`[Status] ${actor.name} trapped for ${duration}ms`);

        // 持续时间结束后恢复
        setTimeout(() => {
            if (!actor.isKilled()) {
                (actor as any)._isTrapped = false;
                if (originalColor) {
                    actor.color = originalColor;
                }
                console.log(`[Status] ${actor.name} trap ended`);
            }
        }, duration);
    }

    /**
     * invincible - 无敌（不受伤害，不触发碰撞伤害）
     * @param duration 持续时间（毫秒）
     */
    invincible(duration: number = 4000) {
        // 已经无敌，不重复施加
        if ((this.actor as any)._isInvincible) return;

        // 记录状态
        (this.actor as any)._isInvincible = true;

        // 视觉反馈：半透明 + 闪烁
        this.actor.graphics.opacity = 0.5;
        this.actor.actions.blink(100, 100, Math.floor(duration / 200));

        console.log(`[Status] ${this.name} invincible for ${duration}ms`);

        // 持续时间结束后恢复
        setTimeout(() => {
            if (!this.actor.isKilled()) {
                (this.actor as any)._isInvincible = false;
                this.actor.graphics.opacity = 1.0;
                console.log(`[Status] ${this.name} invincible ended`);
            }
        }, duration);
    }

    /**
     * grow - 变大（提升自身尺寸，包含碰撞盒）
     * @param duration 持续时间（毫秒）
     * @param scale 放大比例（1.2 = 放大20%）
     */
    grow(duration: number = 4000, scale: number = 1.2) {
        // 已经变大，不重复施加
        if ((this.actor as any)._isGrown) return;

        // 记录状态
        (this.actor as any)._isGrown = true;

        // 记录原始尺寸
        const originalWidth = this.actor.width;
        const originalHeight = this.actor.height;
        (this.actor as any)._originalWidth = originalWidth;
        (this.actor as any)._originalHeight = originalHeight;

        // 计算新尺寸
        const newWidth = originalWidth * scale;
        const newHeight = originalHeight * scale;

        // 更新碰撞盒（scale 不会自动更新碰撞盒）
        const newBox = ex.Shape.Box(newWidth, newHeight, ex.Vector.Half);
        this.actor.collider.set(newBox);

        // 更新视觉尺寸
        const rect = new ex.Rectangle({
            width: newWidth,
            height: newHeight,
            color: ex.Color.Blue,
        });
        this.actor.graphics.use(rect);

        // 记录原始颜色用于恢复
        (this.actor as any)._originalColor = this.actor.color?.clone();

        console.log(`[Status] ${this.name} grown to ${scale}x for ${duration}ms`);

        // 持续时间结束后恢复
        setTimeout(() => {
            if (!this.actor.isKilled()) {
                (this.actor as any)._isGrown = false;

                // 恢复碰撞盒
                const originalBox = ex.Shape.Box(
                    (this.actor as any)._originalWidth,
                    (this.actor as any)._originalHeight,
                    ex.Vector.Half
                );
                this.actor.collider.set(originalBox);

                // 恢复视觉
                const originalRect = new ex.Rectangle({
                    width: (this.actor as any)._originalWidth,
                    height: (this.actor as any)._originalHeight,
                    color: (this.actor as any)._originalColor || ex.Color.Green,
                });
                this.actor.graphics.use(originalRect);

                console.log(`[Status] ${this.name} grow ended`);
            }
        }, duration);
    }

    /**
     * 检查实体是否无敌
     */
    isInvincible(): boolean {
        return (this.actor as any)._isInvincible || false;
    }

    /**
     * 检查实体是否被困住
     */
    isTrapped(): boolean {
        return (this.actor as any)._isTrapped || false;
    }

    /**
     * 检查实体是否被减速
     */
    isSlowed(): boolean {
        return (this.actor as any)._isSlowed || false;
    }

    /**
     * 获取速度倍率（用于移动计算）
     */
    getSpeedMultiplier(): number {
        if ((this.actor as any)._isTrapped) return 0;
        if ((this.actor as any)._isSlowed) return 0.5;
        if ((this.actor as any)._isFast) return (this.actor as any)._speedMultiplier || 2.0;
        return 1.0;
    }

    // --- AI ---
    // ------ combat AI ------
    /**
     * aim_attack - 进入射程后射击
     * @param cooldown 冷却时间（毫秒）
     * @param projectileType 投射物类型
     * @returns 是否成功攻击
     */
    aim_attack(target: EntityWrapper | null, range: number, cooldown: number, projectileType: string): boolean {
        if (!target || !target.active) return false;

        // 检查距离
        const distance = this.pos.distance(target.pos);
        if (distance > range) return false;

        // 检查冷却
        const now = Date.now();
        const lastAttackTime = (this.actor as any)._lastAttackTime || 0;
        if (now - lastAttackTime < cooldown) return false;

        // 记录攻击时间
        (this.actor as any)._lastAttackTime = now;

        // 朝向目标发射（设置移动方向以影响射击方向）
        const dir = target.pos.sub(this.pos).normalize();
        this.actor.vel = dir.scale(this.actor.vel.size || 100);
        this.basic_shoot(projectileType);

        return true;
    }

    /**
     * random_attack - 随机方向射击（不瞄准目标）
     * @param cooldown 冷却时间（毫秒）
     * @param projectileType 投射物类型
     * @returns 是否成功攻击
     */
    random_attack(cooldown: number = 3000, projectileType: string = 'enemy_projectile'): boolean {
        // 检查冷却
        const now = Date.now();
        cooldown = Math.random() * (8000 - 3000) + 3000;
        const lastAttackTime = (this.actor as any)._lastRandomAttackTime || 0;
        if (now - lastAttackTime < cooldown) return false;

        // 记录攻击时间
        (this.actor as any)._lastRandomAttackTime = now;

        // 随机方向发射（设置移动方向以影响射击方向）
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDir = ex.Vector.fromAngle(randomAngle);
        this.actor.vel = randomDir.scale(this.actor.vel.size || 100);
        this.basic_shoot(projectileType);

        return true;
    }

    // --- Movement AI ---

    /**
     * 压缩路径：合并同方向的连续航点
     * [A→B→C→D] 如果 A→B 和 B→C 方向相同，则合并为 [A→C→D]
     */
    private compressPath(path: ex.Vector[]): ex.Vector[] {
        if (path.length <= 2) return path;

        const compressed: ex.Vector[] = [path[0]];

        for (let i = 1; i < path.length - 1; i++) {
            const prev = path[i - 1];
            const curr = path[i];
            const next = path[i + 1];

            // 判断 prev→curr 和 curr→next 方向是否相同
            const dir1 = curr.sub(prev);
            const dir2 = next.sub(curr);

            // 用叉积判断是否共线（叉积为0则同向或反向）
            const cross = dir1.x * dir2.y - dir1.y * dir2.x;

            // 不共线才保留这个中间点
            if (Math.abs(cross) > 0.01) {
                compressed.push(curr);
            }
            // 共线则跳过，直接连到下一个
        }

        compressed.push(path[path.length - 1]);
        return compressed;
    }

    /**
     * 追逐目标（支持 A* 寻路）
     * @param target 目标实体
     * @param speed 移动速度
     * @param usePathfinding 是否使用寻路（默认 true）
     */
    chase(target: EntityWrapper | null, speed: number, usePathfinding: boolean = true) {
        if (!target || !target.active) {
            this.stop();
            return;
        }

        const engine = GameEngine.getInstance();
        const physicsMode = engine.getCurrentPhysicsMode();

        // platformer 模式：简单的水平追逐（使用现有逻辑，不使用寻路）
        if (physicsMode === 'platformer' || !usePathfinding) {
            const dir = target.pos.sub(this.pos).normalize();
            this.actor.vel = dir.scale(speed);
            // if (dir.size > 0.1) {
            //     this.actor.rotation = dir.toAngle();
            // }
            // return;
        }

        // 获取寻路管理器
        const pathfinding = engine.getPathfindingManager();
        if (!pathfinding) {
            // 回退到直线追逐
            const dir = target.pos.sub(this.pos).normalize();
            this.actor.vel = dir.scale(speed);
            return;
        }

        // 检查是否需要重新计算路径
        const now = Date.now();
        const distanceToTarget = this.pos.distance(target.pos);
        const shouldRecompute =
            this.targetPos === null ||
            distanceToTarget > 200 ||
            now - this.pathRecomputeTimer > this.PATH_RECOMPUTE_INTERVAL ||
            this.currentPath.length === 0;

        if (shouldRecompute) {
            this.currentPath = pathfinding.findPath(this.pos, target.pos);
            this.currentPath = this.compressPath(this.currentPath);
            this.pathIndex = 0;
            this.targetPos = target.pos.clone();
            this.pathRecomputeTimer = now;
        }

        // 沿路径移动
        this.followPath(speed, target.pos);
    }

    /**
     * 巡逻（智能随机移动）
     * @param speed 移动速度
     * @param usePathfinding 未使用（保留兼容性）
     */
    patrol(speed: number, usePathfinding: boolean = true) {
        const engine = GameEngine.getInstance();
        const physicsMode = engine.getCurrentPhysicsMode();

        if (physicsMode === 'platformer') {
            // 平台模式：碰边/碰墙/超范围/平台边缘转向
            if ((this.actor as any)._patrolStartPos === undefined) {
                (this.actor as any)._patrolStartPos = this.actor.pos.clone();
                (this.actor as any)._patrolDirection = 1;
                this.actor.vel.x = speed;
                // 检测是否站在地面上（用于判断是否需要边缘检测）
                (this.actor as any)._isPatrolGrounded = this.checkGroundBelow();
            }

            const startPos = (this.actor as any)._patrolStartPos as ex.Vector;
            const direction = (this.actor as any)._patrolDirection;
            const isGrounded = (this.actor as any)._isPatrolGrounded;

            let shouldReverse = false;

            // 碰墙（速度接近 0）
            if (Math.abs(this.actor.vel.x) < 5 && Math.abs(this.actor.vel.y) < 5) {
                shouldReverse = true;
            }

            // 超过移动范围
            if (this.actor.pos.distance(startPos) >= 100) {
                shouldReverse = true;
            }

            // 平台边缘检测（仅对站在地面上的元素）
            if (isGrounded && !this.checkGroundAhead(direction)) {
                shouldReverse = true;
            }

            if (shouldReverse) {
                (this.actor as any)._patrolDirection = -direction;
                this.actor.vel.x = -direction * speed;
            }
            return;
        }

        // 顶视图模式：往一个方向走，1秒不动后换方向
        const now = Date.now();
        const STUCK_THRESHOLD = 1000; // 1秒

        // 初始化方向
        if (!this.actor.vel || this.actor.vel.size < 5) {
            this.randomizeDirection(speed);
            this.lastStuckCheckPos = this.pos.clone();
            this.lastStuckCheckTime = now;
            return;
        }

        // 卡住检测：1秒不动就换方向
        if (this.lastStuckCheckPos) {
            const moved = this.pos.distance(this.lastStuckCheckPos);
            if (moved < this.STUCK_MOVE_THRESHOLD) {
                const elapsed = now - this.lastStuckCheckTime;
                if (elapsed >= STUCK_THRESHOLD) {
                    // 1秒没动，换成另外三个方向
                    this.randomizeDirectionExcludingCurrent(speed);
                    this.lastStuckCheckPos = this.pos.clone();
                    this.lastStuckCheckTime = now;
                    return;
                }
            } else {
                // 移动了，重置检测
                this.lastStuckCheckPos = this.pos.clone();
                this.lastStuckCheckTime = now;
            }
        } else {
            this.lastStuckCheckPos = this.pos.clone();
            this.lastStuckCheckTime = now;
        }
    }

    /**
     * 随机选择上下左右方向
     */
    private randomizeDirection(speed: number) {
        const directions = [
            new ex.Vector(speed, 0),    // 右
            new ex.Vector(-speed, 0),   // 左
            new ex.Vector(0, speed),    // 下
            new ex.Vector(0, -speed),   // 上
        ];
        this.actor.vel = directions[Math.floor(Math.random() * 4)];
    }

    /**
     * 随机选择另外三个方向（排除当前方向）
     */
    private randomizeDirectionExcludingCurrent(speed: number) {
        const directions = [
            new ex.Vector(speed, 0),    // 右
            new ex.Vector(-speed, 0),   // 左
            new ex.Vector(0, speed),    // 下
            new ex.Vector(0, -speed),   // 上
        ];

        // 找到当前方向
        const currentVel = this.actor.vel;
        let currentIndex = 0;
        if (currentVel.x > 0) currentIndex = 0;      // 右
        else if (currentVel.x < 0) currentIndex = 1; // 左
        else if (currentVel.y > 0) currentIndex = 2; // 下
        else if (currentVel.y < 0) currentIndex = 3; // 上

        // 从另外三个方向中随机选一个
        const otherIndices = [0, 1, 2, 3].filter(i => i !== currentIndex);
        const chosenIndex = otherIndices[Math.floor(Math.random() * 3)];
        this.actor.vel = directions[chosenIndex];
    }

    /**
     * 检测正下方是否有地面
     */
    private checkGroundBelow(): boolean {
        const engine = GameEngine.getInstance();
        const actors = engine.game.currentScene.actors;
        const tileSize = engine.getTileSize();

        // 检测点：正下方半个 tile 的位置
        const checkY = this.actor.pos.y + tileSize * 0.5;

        for (const other of actors) {
            if (other === this.actor || !other.active || other.isKilled()) continue;
            // 只检测 Fixed 类型的碰撞体（地面、平台等）
            if (other.body.collisionType !== ex.CollisionType.Fixed) continue;

            // 检查是否在正下方
            const halfWidth = (other.width || 0) / 2;
            const halfHeight = (other.height || 0) / 2;

            if (Math.abs(this.actor.pos.x - other.pos.x) < halfWidth + (this.actor.width || 0) / 2 &&
                checkY >= other.pos.y - halfHeight &&
                checkY <= other.pos.y + halfHeight) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检测前方是否有地面（用于平台边缘检测）
     * @param direction 移动方向 (1 = 右, -1 = 左)
     */
    private checkGroundAhead(direction: number): boolean {
        const engine = GameEngine.getInstance();
        const actors = engine.game.currentScene.actors;
        const tileSize = engine.getTileSize();

        // 检测点：前方半个 tile + 下方半个 tile
        const checkX = this.actor.pos.x + direction * tileSize * 0.5;
        const checkY = this.actor.pos.y + tileSize * 0.5;

        for (const other of actors) {
            if (other === this.actor || !other.active || other.isKilled()) continue;
            // 只检测 Fixed 类型的碰撞体（地面、平台等）
            if (other.body.collisionType !== ex.CollisionType.Fixed) continue;

            const halfWidth = (other.width || 0) / 2;
            const halfHeight = (other.height || 0) / 2;

            // 检查检测点是否在 other 的碰撞范围内
            if (checkX >= other.pos.x - halfWidth &&
                checkX <= other.pos.x + halfWidth &&
                checkY >= other.pos.y - halfHeight &&
                checkY <= other.pos.y + halfHeight) {
                return true;
            }
        }
        return false;
    }

    /**
     * patrol_then_chase - 巡逻，发现目标后追逐
     * @param target 追逐目标
     * @param speed 移动速度
     * @param detectRange 发现范围（像素），默认 150
     */
    patrol_then_chase(target: EntityWrapper | null, speed: number, detectRange: number = 150) {
        // 检查目标是否在范围内
        const targetInRange = target && target.active &&
            this.pos.distance(target.pos) <= detectRange;

        if (targetInRange) {
            // 发现目标，追逐
            this.chase(target, speed);
        } else {
            // 未发现目标，巡逻
            this.patrol(speed);
        }
    }

    stop() {
        this.actor.vel = ex.Vector.Zero;
        this.currentPath = [];
        this.pathIndex = 0;
        this.targetPos = null;
    }

    // 只暂停速度，不清空状态
    private haltMovement() {
        this.actor.actions.clearActions();
        this.actor.vel = ex.Vector.Zero;
    }

    /**
     * 沿计算好的路径移动
     * 使用引擎自带方法管理移动
     */
    private followPath(speed: number) {
        if (this.currentPath.length === 0 || this.pathIndex >= this.currentPath.length) {
            this.haltMovement();
            this.currentPath = [];
            this.pathRecomputeTimer = Date.now();  // 路径完成时更新计时器
            return;
        }

        const waypoint = this.currentPath[this.pathIndex];
        const distance = waypoint.sub(this.pos).size;

        if (distance < 20) {
            this.pathIndex++;
            if (this.pathIndex >= this.currentPath.length) {
                this.haltMovement();
                this.currentPath = [];
                this.pathRecomputeTimer = Date.now();  // 路径完成时更新计时器
            }
            return;
        }

        // 用 Actions API，只在航点变化时设置一次，不要每帧调用
        const currentTarget = (this.actor as any)._currentWaypointTarget;
        const waypointChanged = !currentTarget ||
            currentTarget.x !== waypoint.x ||
            currentTarget.y !== waypoint.y;

        if (waypointChanged) {
            (this.actor as any)._currentWaypointTarget = waypoint;
            this.actor.actions.clearActions();
            this.actor.actions.moveTo(waypoint, speed);
        }
    }
}

// ==========================================
// 2. 全局工具 (上帝视角查询)
// ==========================================
export class GameUtils {

    /**
     * 查找所有指定类型的实体 (返回包装器列表)
     * @param type 例如 'enemy', 'player'
     */
    static findAll(type: string): EntityWrapper[] {
        const engine = GameEngine.getInstance();
        const actors = engine.game.currentScene.actors;

        return actors
            .filter(a => a.name === type && a.active && !a.isKilled())
            .map(a => {
                // 同一个actor返回一个wrapper，保留移动状态
                if (!entityWrapperCache.has(a)) {
                    entityWrapperCache.set(a, new EntityWrapper(a));
                }
                return entityWrapperCache.get(a)!;
            });
    }

    /**
     * 查找单个实体 (通常用于找玩家)
     */
    static find(type: string): EntityWrapper | null {
        const list = this.findAll(type);
        return list.length > 0 ? list[0] : null;
    }

    /**
     * 检查是否存在
     */
    static exists(type: string): boolean {
        return this.findAll(type).length > 0;
    }

    /**
     * 触发游戏结束
     */
    static triggerGameOver(win: boolean) {
        const engine = GameEngine.getInstance();
        engine.game.stop();
        // 实际项目中这里可以 dispatch 一个 React 事件
        alert(win ? "MISSION COMPLETE!" : "GAME OVER");
    }
}