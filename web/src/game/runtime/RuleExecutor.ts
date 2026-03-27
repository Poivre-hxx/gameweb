import * as ex from 'excalibur';
import { GameEngine } from '../core/GameEngine';
import type { GameRules } from '../core/types';
import { EntityFactory } from '../loader/EntityFactory';
import { EntityWrapper, GameUtils } from '../api/GameUtils';

export class RuleExecutor {
    private rules: GameRules | null = null;
    private factory: EntityFactory;
    // 冷却时间记录 (防止一秒发射60发子弹)
    private cooldowns: Map<string, number> = new Map();
    // 技能冷却配置：entityName -> skillName -> cooldown
    private skillCooldowns: Map<string, Map<string, number>> = new Map();

    private engine: GameEngine;
    constructor(engine: GameEngine) {
        this.engine = engine;
        // 这里暂时用默认 tileSize，loadGame 时会更新 factory
        this.factory = new EntityFactory(32, {});
    }

    public getFactory() { return this.factory };

    /**
     * 游戏加载时初始化
     */
    init(rules: GameRules) {
        console.log('[RuleExecutor] init called');

        // 安全检查
        if (!this.engine) {
            console.error('[RuleExecutor] this.engine is undefined!');
            return;
        }

        if (!this.engine.game) {
            console.error('[RuleExecutor] this.engine.game is undefined!');
            return;
        }

        this.rules = rules;
        // 更新工厂配置，这样发射的子弹才有正确的速度/颜色
        const physicsManager = this.engine.getPhysicsManager();
        const physicsMode = rules.gameConfig.physicsMode;
        this.factory = new EntityFactory(rules.gameConfig.tileSize, rules.entityConfig, physicsManager, physicsMode);
        this.cooldowns.clear();

        // 注册技能冷却配置
        this.registerSkillCooldowns();

        // 给场景中所有Actor添加碰撞监听
        this.registerCollisionHandlers();

        console.log('[RuleExecutor] Collision listener registered');
    }

    /**
     * 注册技能冷却配置
     */
    private registerSkillCooldowns() {
        if (!this.rules?.skillRules) return;

        this.skillCooldowns.clear();

        for (const rule of this.rules.skillRules) {
            const entityName = rule.entity;
            const cooldownsMap = new Map<string, number>();

            for (const skillName of rule.skills) {
                // 直接使用默认值，不从配置读取
                const cooldown = this.getDefaultCooldown(skillName);
                cooldownsMap.set(skillName, cooldown);
            }

            this.skillCooldowns.set(entityName, cooldownsMap);
            console.log(`[SkillRegistry] Registered ${rule.skills.length} skills for ${entityName}`);
        }
    }

    /**
     * 获取技能默认冷却时间（毫秒）
     */
    private getDefaultCooldown(skillName: string): number {
        const defaults: Record<string, number> = {
            'basic_shoot': 300,
            'spread_shot': 800,
            'jump': 100,
            'doubleJump': 100,
            'aim_attack': 1000,
            'random_attack': 3000,
        };
        return defaults[skillName] || 500;
    }

    /**
     * 根据技能名构建参数
     */
    private buildSkillArgs(skillName: string, config: any, target?: EntityWrapper): any[] {
        // 投射物类技能
        if (['basic_shoot', 'spread_shot'].includes(skillName)) {
            return [config?.projectileType || 'bullet'];
        }
        // AI 攻击类技能
        if (skillName === 'aim_attack') {
            // 使用传入的target，如果没有则用null
            return [target || null, 200, 2000, config?.projectileType || 'bullet'];
        }
        // 其他无参数技能
        return [];
    }

    /**
     * 根据 Excalibur 的碰撞法线获取方向字符串
     * @param normal 碰撞法线（从 b 指向 a）
     * @returns 方向字符串
     */
    private getCollisionDirection(normal: ex.Vector): import('../core/types').CollisionDirection | null {
        const THRESHOLD = 0.5;

        if (normal.y < -THRESHOLD) return 'above';   // a 在 b 上方（踩踏）
        if (normal.y > THRESHOLD) return 'below';    // a 在 b 下方（顶砖块）
        if (normal.x < -THRESHOLD) return 'left';    // a 在 b 左边
        if (normal.x > THRESHOLD) return 'right';    // a 在 b 右边

        return null; // 碰撞角度太倾斜，无法确定明确方向
    }

    /**
     * 检查检测到的方向是否在要求的方向列表中
     */
    private matchesRequiredDirection(
        detectedDir: import('../core/types').CollisionDirection | null,
        requiredDirs: import('../core/types').CollisionDirection[]
    ): boolean {
        // 如果检测不到明确方向，默认不匹配（严格模式）
        if (!detectedDir) return false;
        return requiredDirs.includes(detectedDir);
    }

    /**
    * 给所有需要碰撞检测的 Actor 注册事件
    */
    private registerCollisionHandlers() {
        const scene = this.engine.game.currentScene;

        scene.actors.forEach(actor => {
            // 只给 Active 类型的实体添加监听（Player、Enemy、Projectile）
            if (actor.body.collisionType === ex.CollisionType.Active) {
                // precollision：碰撞解算前触发，用于方向检测和条件判断
                actor.on('precollision', (evt) => {
                    this.handlePreCollision(actor, evt.other, evt);
                });

                // collisionstart：碰撞开始时触发，用于执行 action
                actor.on('collisionstart', (evt) => {
                    this.handleActorCollision(actor, evt.other);
                });
            }
        });
    }

    /**
     * 处理 precollision 事件（碰撞解算前）
     * 用于检测方向并决定是否执行后续的 action
     */
    private handlePreCollision(self: ex.Actor, other: ex.Actor, evt: ex.PreCollisionEvent) {
        if (!this.rules) return;

        // 查找所有匹配的碰撞规则
        const matchingRules = this.rules.collisionRules.filter(r => {
            const match1 = r.a === self.name && r.b === other.name;
            const match2 = r.a === other.name && r.b === self.name;
            return match1 || match2;
        });

        if (matchingRules.length === 0) {
            // 初始化 Map 并按 other.id 存储空数组
            if (!(self as any)._collisionRulesMap) {
                (self as any)._collisionRulesMap = {};
            }
            (self as any)._collisionRulesMap[other.id] = [];
            return;
        }

        // 获取碰撞法线（Excalibur 已计算好）
        const normal = evt.contact.normal;

        // 找出所有方向匹配的规则
        const matchedRulesWithDirection: Array<{ rule: typeof matchingRules[0], detectedDir: string | null }> = [];

        matchingRules.forEach(rule => {
            if (!rule.direction) {
                // 没有方向要求，默认匹配
                matchedRulesWithDirection.push({ rule, detectedDir: null });
            } else {
                // 确定法线方向（需要考虑规则中 a/b 的顺序）
                const selfIsA = rule.a === self.name;
                const effectiveNormal = selfIsA ? normal : normal.negate();
                const detectedDir = this.getCollisionDirection(effectiveNormal);

                if (this.matchesRequiredDirection(detectedDir, rule.direction)) {
                    matchedRulesWithDirection.push({ rule, detectedDir });
                }
            }
        });

        if (matchedRulesWithDirection.length === 0) {
            // 没有任何规则的方向匹配，存储空数组
            if (!(self as any)._collisionRulesMap) {
                (self as any)._collisionRulesMap = {};
            }
            (self as any)._collisionRulesMap[other.id] = [];
            console.log(`[PreCollision] ${self.name} <-> ${other.name}, no direction matched, SKIP`);
        } else {
            // 有匹配的规则，按 other.id 缓存这些规则供 handleActorCollision 使用
            if (!(self as any)._collisionRulesMap) {
                (self as any)._collisionRulesMap = {};
            }
            (self as any)._collisionRulesMap[other.id] = matchedRulesWithDirection.map(item => item.rule);
            const matchedDirs = matchedRulesWithDirection.map(item => item.detectedDir).filter(d => d).join(', ');
            console.log(`[PreCollision] ${self.name} <-> ${other.name}, direction: ${matchedDirs || 'any'}, MATCH ${matchedRulesWithDirection.length} rule(s)`);
        }
    }

    /**
    * 处理 Actor 碰撞
    */
    private handleActorCollision(self: ex.Actor, other: ex.Actor) {
        if (!this.rules) return;

        // 排除自己打自己
        if ((self as any).owner === other || (other as any).owner === self) return;

        // Platformer 模式下，Active 类型元素碰到下边界墙销毁
        // 注意：这个逻辑必须在 _skipCollisionAction 检查之前执行，
        // 因为 boundary_wall 不在 collisionRules 中，会导致 _skipCollisionAction=true
        if (this.rules.gameConfig.physicsMode === 'platformer') {
            if (self.body.collisionType === ex.CollisionType.Active && other.name === 'boundary_wall') {
                // 只有下边界墙才会导致销毁
                if ((other as any).boundaryType === 'bottom') {
                    console.log(`[Collision] ${self.name} hit BOTTOM boundary wall, destroying`);
                    const wrapper = new EntityWrapper(self);
                    wrapper.die();
                }
                return;
            }
            if (other.body.collisionType === ex.CollisionType.Active && self.name === 'boundary_wall') {
                // 只有下边界墙才会导致销毁
                if ((self as any).boundaryType === 'bottom') {
                    console.log(`[Collision] ${other.name} hit BOTTOM boundary wall, destroying`);
                    const wrapper = new EntityWrapper(other);
                    wrapper.die();
                }
                return;
            }
        }

        // 从 Map 中获取 other.id 对应的缓存规则
        const rulesMap = (self as any)._collisionRulesMap || {};
        const matchedRules = rulesMap[other.id] || [];
        delete rulesMap[other.id]; // 读取后清理，防止内存泄漏

        // 输出碰撞函数（启用调试）
        console.log(`[Collision] ${self.name} <-> ${other.name}, ${matchedRules.length} matched rule(s)`);

        // 投射物碰到任何东西都销毁
        const projectileTypes = ['player_projectile', 'enemy_projectile', 'bullet'];
        if (projectileTypes.includes(self.name)) {
            self.kill();
        }

        // 执行所有匹配的规则
        matchedRules.forEach((rule: any) => {
            this.applyCollisionResult(rule.action, rule.a, self, other);
        });
    }

    /**
    * 处理投射物碰撞（公开方法，供 GameEngine 调用）
    */
    public handleProjectileCollision(projectile: ex.Actor, other: ex.Actor) {
        console.log(`[Projectile Collision] ${projectile.name} <-> ${other.name}`);

        // 排除自己打自己
        if ((projectile as any).owner === other) return;

        // 投射物碰到任何东西都销毁自己
        projectile.kill();

        // 查找并执行碰撞规则
        if (!this.rules) return;

        const rule = this.rules.collisionRules.find(r => {
            const match1 = r.a === projectile.name && r.b === other.name;
            const match2 = r.a === other.name && r.b === projectile.name;
            return match1 || match2;
        });

        if (rule) {
            this.applyCollisionResult(rule.action, rule.a, projectile, other);
        }
    }

    /**
     * 每帧调用 (在 GameEngine 的 update 中调用)
     * 负责处理：按键触发技能
     */
    update(player: ex.Actor, delta: number) {
        if (!this.rules) return;
        if (!player.active || player.isKilled()) return;
        // 1. 冷却倒计时
        this.cooldowns.forEach((val, key) => {
            if (val > 0) this.cooldowns.set(key, val - delta);
        });

        // 2. 处理玩家按键输入
        // 例如 inputMapping: { "A": "shoot", "B": "bomb" }
        for (const [btn, actionName] of Object.entries(this.rules.inputMapping)) {
            if (!actionName) continue;

            // 对于跳跃类技能，使用 JustPressed（只触发一次）
            if (actionName === 'jump' || actionName === 'doubleJump') {
                if (this.engine.inputManager.isActionJustPressed(actionName)) {
                    const playerWrapper = (player as any)._entityWrapper || new EntityWrapper(player);
                    this.executeAction(actionName, playerWrapper);
                }
            } else {
                // 其他技能保持原逻辑（持续按住可触发）
                if (this.engine.inputManager.isActionPressed(actionName)) {
                    const playerWrapper = (player as any)._entityWrapper || new EntityWrapper(player);
                    this.executeAction(actionName, playerWrapper);
                }
            }
        }

        // 3. 处理 AI (根据 aiRules 配置动态处理)
        if (this.rules?.aiRules) {
            const playerWrapper = new EntityWrapper(player);

            // 遍历每个 AI 规则
            for (const aiRule of this.rules.aiRules) {
                // 查找该规则对应的所有实体
                const entities = GameUtils.findAll(aiRule.entity);

                entities.forEach(entity => {
                    const config = this.rules?.entityConfig[aiRule.entity];
                    const speed = config?.speed || 50;

                    // 移动 AI
                    switch (aiRule.movementAI) {
                        case 'chase':
                            entity.chase(playerWrapper, speed);
                            break;
                        case 'patrol':
                            entity.patrol(speed);
                            break;
                        case 'patrol_then_chase':
                            entity.patrol_then_chase(playerWrapper, speed);
                            break;
                        case 'stop':
                        default:
                            entity.stop();
                            break;
                    }

                    // 战斗 AI - 直接调用，不依赖 skillRules 注册
                    const projectileType = config?.projectileType || 'bullet';

                    if (aiRule.combatAI === 'aim_attack') {
                        entity.aim_attack(playerWrapper, 200, 1000, projectileType);
                    } else if (aiRule.combatAI === 'random_attack') {
                        entity.random_attack(3000, projectileType);
                    }
                });
            }
        }
    }

    /**
     * 执行动作 (Action)
     * 这里是 "动作解释器"，把字符串 "shoot" 翻译成代码
     */
    private executeAction(action: string, userWrapper: EntityWrapper) {
        const entityName = userWrapper.name;
        // 使用 actor.id 而不是 entityName，确保每个实体实例独立冷却
        const cdKey = `${userWrapper.actor.id}_${action}`;

        // 1. 检查冷却
        if ((this.cooldowns.get(cdKey) || 0) > 0) return;

        // 2. 检查技能是否已注册
        const entityCooldowns = this.skillCooldowns.get(entityName);
        if (!entityCooldowns?.has(action)) {
            console.warn(`[ExecuteAction] Skill not registered: ${action} for ${entityName}`);
            return;
        }

        // 3. 检查方法是否存在
        if (typeof (userWrapper as any)[action] !== 'function') {
            console.error(`[ExecuteAction] Method not found: ${action} on EntityWrapper`);
            return;
        }

        // 4. 构建参数并执行
        try {
            const config = this.rules?.entityConfig[entityName];
            const args = this.buildSkillArgs(action, config);

            (userWrapper as any)[action](...args);

            // 5. 设置冷却
            this.cooldowns.set(cdKey, entityCooldowns.get(action)!);

        } catch (error) {
            console.error(`[ExecuteAction] Error executing ${action}:`, error);
        }
    }

    /**
     * 激活非 player 实体的技能（实体创建时调用）
     * 规则：player 的技能需要按键触发，其他实体的技能自动激活
     * 注意：状态技能（grow、invincible 等）不在创建时激活，它们在元素销毁时触发
     */
    public activateEntitySkills(entityName: string, actor: ex.Actor) {
        // player 的技能由按键触发，不在这里激活
        if (entityName === 'player') return;

        const skillRule = this.rules?.skillRules?.find(r => r.entity === entityName);
        if (!skillRule) return;

        // 状态技能不在创建时激活，它们在元素销毁时才施加给 player
        const statusSkills = ['grow', 'invincible', 'slow', 'fast', 'trap'];

        const wrapper = new EntityWrapper(actor);
        for (const skillName of skillRule.skills) {
            // 跳过状态技能
            if (statusSkills.includes(skillName)) {
                continue;
            }
            const method = (wrapper as any)[skillName];
            if (typeof method === 'function') {
                method.call(wrapper);
                console.log(`[RuleExecutor] Activated skill: ${skillName} for ${entityName}`);
            }
        }
    }

    /**
     * 为实体执行指定技能（供 AI、条件触发等外部调用）
     */
    public executeSkill(entityName: string, skillName: string, wrapper: EntityWrapper, target?: EntityWrapper): boolean {
        // 使用 actor.id 而不是 entityName，确保每个实体实例独立冷却
        const cdKey = `${wrapper.actor.id}_${skillName}`;

        // 检查冷却
        if ((this.cooldowns.get(cdKey) || 0) > 0) {
            return false;
        }

        // 检查技能是否已注册
        const entityCooldowns = this.skillCooldowns.get(entityName);
        if (!entityCooldowns?.has(skillName)) {
            return false;
        }

        // 检查方法是否存在
        if (typeof (wrapper as any)[skillName] !== 'function') {
            console.error(`[ExecuteSkill] Method not found: ${skillName}`);
            return false;
        }

        try {
            const config = this.rules?.entityConfig[entityName];
            const args = this.buildSkillArgs(skillName, config, target);
            (wrapper as any)[skillName](...args);

            const cooldown = entityCooldowns.get(skillName)!;
            this.cooldowns.set(cdKey, cooldown);

            return true;
        } catch (error) {
            console.error(`[ExecuteSkill] Error:`, error);
            return false;
        }
    }

    /**
     * 处理碰撞 (Collision)
     * 这里是 "规则匹配器"，查表 collisionRules
     */
    private handleCollision(evt: ex.CollisionStartEvent) {
        if (!this.rules) return;

        const a = evt.actorA;
        const b = evt.actorB;

        // console.log(`[Collision] ${a.name} <-> ${b.name}`);

        // 排除自己打自己的情况 (子弹 owner)
        if ((a as any).owner === b || (b as any).owner === a) return;

        // 投射物碰到任何东西直接销毁
        const isProjectile = (actor: ex.Actor) =>
            ['player_projectile', 'enemy_projectile', 'bullet'].includes(actor.name);
        if (isProjectile(a)) a.kill();
        if (isProjectile(b)) b.kill();

        // 查找规则
        // 我们需要在 rules.collisionRules 数组里找
        // 规则可能是: { a: 'bullet', b: 'enemy' }
        // 但实际碰撞可能是 a=enemy, b=bullet，所以要双向检查

        const rule = this.rules.collisionRules.find(r => {
            const match1 = r.a === a.name && r.b === b.name;
            const match2 = r.a === b.name && r.b === a.name; // 反向匹配
            return match1 || match2;
        });

        if (rule) {
            // 执行规则里定义的效果
            // rule.action 是一个字符串数组，如 ["destroy_a", "destroy_b"]
            this.applyCollisionResult(rule.action, rule.a, a, b);
        }
    }

    // 状态技能列表（元素销毁时触发，效果施加给 player）
    private static readonly STATUS_SKILLS = ['slow', 'fast', 'trap', 'invincible', 'grow'];

    /**
     * 执行碰撞结果
     * @param actions 动作列表
     * @param ruleKeyA 规则中定义为 'a' 的那个名字 (用于区分谁是a谁是b)
     * @param realActorA 实际碰撞体 A
     * @param realActorB 实际碰撞体 B
     */
    private applyCollisionResult(actions: string[], ruleKeyA: string, realActorA: ex.Actor, realActorB: ex.Actor) {
        // 包装成 Wrapper 以使用 damage/die 方法
        let wrapperA = new EntityWrapper(realActorA.name === ruleKeyA ? realActorA : realActorB);
        let wrapperB = new EntityWrapper(realActorA.name === ruleKeyA ? realActorB : realActorA);

        // 检查无敌状态：如果某一方无敌，跳过对其的 destroy/damage
        const aIsInvincible = wrapperA.isInvincible();
        const bIsInvincible = wrapperB.isInvincible();

        if (aIsInvincible) {
            console.log(`[Collision] ${wrapperA.name} is invincible, skip destroy_a`);
        }
        if (bIsInvincible) {
            console.log(`[Collision] ${wrapperB.name} is invincible, skip destroy_b/damage_b`);
        }

        actions.forEach(act => {
            switch (act) {
                case 'destroy_a':
                    if (!aIsInvincible) {
                        this.triggerStatusSkill(wrapperA.name);
                        wrapperA.die();
                    }
                    break;
                case 'destroy_b':
                    if (!bIsInvincible) {
                        this.triggerStatusSkill(wrapperB.name);
                        wrapperB.die();
                    }
                    break;
                case 'destroy_both':
                    if (!aIsInvincible) wrapperA.die();
                    if (!bIsInvincible) wrapperB.die();
                    break;
                case 'damage_b':
                    if (!bIsInvincible) {
                        wrapperB.damage(1);
                    }
                    if (!aIsInvincible) {
                        wrapperA.die(); // 子弹打中人通常自己会销毁
                    }
                    break;
            }
        });
    }

    /**
     * 触发状态技能（元素销毁时调用）
     * @param destroyedEntityName 被销毁的实体名称
     */
    private triggerStatusSkill(destroyedEntityName: string) {
        const skillRule = this.rules?.skillRules?.find(r => r.entity === destroyedEntityName);
        if (!skillRule?.skills) return;

        // 找到该实体配置的状态技能
        const statusSkills = skillRule.skills.filter(s => RuleExecutor.STATUS_SKILLS.includes(s));
        if (statusSkills.length === 0) return;

        // 找到 player 作为目标
        const players = GameUtils.findAll('player');
        const playerWrapper = players[0];
        if (!playerWrapper) return;

        for (const skillName of statusSkills) {
            const method = (playerWrapper as any)[skillName];
            if (typeof method === 'function') {
                // slow 和 trap 需要传 target 参数，但这里目标就是 player 自己
                // 不传 duration，使用技能方法的默认值
                if (skillName === 'slow' || skillName === 'trap') {
                    method.call(playerWrapper, playerWrapper);
                } else {
                    // fast、invincible、grow 作用在自身，不传参数使用默认值
                    method.call(playerWrapper);
                }
                console.log(`[StatusSkill] ${destroyedEntityName} triggers ${skillName} on player`);
            }
        }
    }
}