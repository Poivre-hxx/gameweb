import * as ex from 'excalibur';
import type { GameRules } from '../core/types';

export class PhysicsManager {
    // 改为实例变量，支持动态创建
    private groups: Map<string, ex.CollisionGroup> = new Map();

    constructor(engine: ex.Engine) {
        // engine 引用保留用于可能的未来扩展
        void engine;
    }

    /**
     * 重新配置碰撞组（用于加载新游戏时）
     */
    public reconfigure(rules: GameRules) {
        // 不清空现有组，复用已存在的 collision group
        // CollisionGroupManager 是全局单例，已创建的 group 无法删除

        // 初始化新组（会跳过已存在的）
        this.initializeGroups(rules);

        // 配置碰撞矩阵
        this.setupCollisionMatrix(rules);

        console.log(`[PhysicsManager] Configured ${this.groups.size} collision groups:`, Array.from(this.groups.keys()));
    }

    /**
     * 从 entityConfig 动态创建碰撞组
     * 每个实体类型都有自己的 CollisionGroup
     */
    private initializeGroups(rules: GameRules) {
        // 1. 首先创建固定的边界墙组（所有游戏通用）
        if (!this.groups.has('boundary_wall')) {
            this.groups.set('boundary_wall', ex.CollisionGroupManager.create('boundary_wall'));
        }

        // 2. 遍历 entityConfig，为每个类型创建组
        for (const entityType of Object.keys(rules.entityConfig)) {
            if (!this.groups.has(entityType)) {
                const group = ex.CollisionGroupManager.create(entityType);
                this.groups.set(entityType, group);
            }
        }

        // 3. 特殊处理：确保 'player' 组始终存在（即使 entityConfig 中没有）
        if (!this.groups.has('player')) {
            this.groups.set('player', ex.CollisionGroupManager.create('player'));
        }
    }

    /**
     * 从 collisionRules 动态配置碰撞矩阵
     */
    private setupCollisionMatrix(rules: GameRules) {
        // 1. 首先配置边界墙的通用碰撞规则
        // 边界墙与所有可移动物体碰撞
        const boundaryGroup = this.groups.get('boundary_wall');
        if (boundaryGroup) {
            // 遍历所有组，让它们都能与边界墙碰撞
            this.groups.forEach((group, typeName) => {
                if (typeName !== 'boundary_wall') {
                    // 默认让所有东西都能撞边界墙
                    boundaryGroup.canCollide(group);
                    group.canCollide(boundaryGroup);
                }
            });
        }

        // 2. 根据 collisionRules 配置自定义碰撞关系
        let configuredPairs = 0;
        rules.collisionRules.forEach(rule => {
            const groupA = this.groups.get(rule.a);
            const groupB = this.groups.get(rule.b);

            if (groupA && groupB) {
                // 双向碰撞
                groupA.canCollide(groupB);
                groupB.canCollide(groupA);
                configuredPairs++;
            } else {
                console.warn(
                    `[PhysicsManager] Missing collision group for rule: ${rule.a} <-> ${rule.b}`
                );
            }
        });

        console.log(`[PhysicsManager] Configured ${configuredPairs} collision rule pairs`);
    }

    /**
     * 获取实体类型对应的碰撞组
     */
    public getGroupForType(type: string): ex.CollisionGroup {
        // 直接按名称查找
        if (this.groups.has(type)) {
            return this.groups.get(type)!;
        }

        // 如果不存在，创建并返回（用于运行时动态创建的类型）
        console.warn(`[PhysicsManager] Creating group for unknown type: ${type}`);
        const newGroup = ex.CollisionGroupManager.create(type);
        this.groups.set(type, newGroup);
        return newGroup;
    }

    /**
     * 向后兼容：保留静态访问器
     * @deprecated 使用实例方法 getGroupForType() 代替
     */
    public static getGroupForType(_type: string): ex.CollisionGroup {
        throw new Error('[PhysicsManager] Static getGroupForType() is deprecated. Use instance method via GameEngine instead.');
    }

    /**
     * 向后兼容：保留静态 GROUPS 访问器
     * @deprecated 使用实例方法 getGroupForType() 代替
     */
    public static get GROUPS() {
        throw new Error('[PhysicsManager] Static GROUPS is deprecated. Use instance method getGroupForType() instead.');
    }
}
