import * as ex from 'excalibur';
import type { EntityConfig } from '../core/types';
import { PhysicsManager } from '../runtime/PhysicsManager';
import { ResourceManager } from './ResourceManager';

export class EntityFactory {
    private tileSize: number = 32;
    private config: EntityConfig = {};
    private physicsManager: PhysicsManager;
    private physicsMode: string = 'topdown'; // 默认为 topdown，不受重力影响
    private resourceManager: ResourceManager;

    constructor(tileSize: number = 32, config: EntityConfig = {}, physicsManager?: PhysicsManager, physicsMode?: string) {
        this.tileSize = tileSize;
        this.config = config;
        this.physicsMode = physicsMode || 'topdown';
        // 如果没有传入 physicsManager，创建一个临时的（向后兼容）
        // 注意：这种情况下碰撞组功能不会正常工作
        if (!physicsManager) {
            console.warn('[EntityFactory] No PhysicsManager provided, collision groups will not work properly');
        }
        this.physicsManager = physicsManager as PhysicsManager;
        this.resourceManager = ResourceManager.getInstance();
    }

    /**
     * 获取当前 tileSize
     */
    getTileSize(): number {
        return this.tileSize;
    }

    /**
     * 解析碰撞类型字符串为 Excalibur 的 CollisionType
     * @param collision 碰撞类型字符串: 'prevent' | 'passive' | 'active' | 'fixed'
     * @returns Excalibur 的 CollisionType 枚举值
     */
    private parseCollisionType(collision?: string): ex.CollisionType {
        if (!collision) return ex.CollisionType.Fixed; // 默认值

        switch (collision.toLowerCase()) {
            case 'prevent':
                return ex.CollisionType.PreventCollision;
            case 'passive':
                return ex.CollisionType.Passive;
            case 'active':
                return ex.CollisionType.Active;
            case 'fixed':
                return ex.CollisionType.Fixed;
            default:
                console.warn(`[EntityFactory] Unknown collision type: ${collision}, using Fixed`);
                return ex.CollisionType.Fixed;
        }
    }

    /**
     * 创建图形：优先使用贴图，失败则回退到颜色方块
     * 支持 size > 1x1 的元素：多个贴图拼接
     * @param name 元素名称
     * @param gridCols 格子列数（决定贴图拼接数量，来自 map.json size）
     * @param gridRows 格子行数（决定贴图拼接数量，来自 map.json size）
     * @param color 回退颜色
     * @param scaleW 宽度缩放比例（来自 code.json）
     * @param scaleH 高度缩放比例（来自 code.json）
     */
    private createGraphic(
        name: string,
        gridCols: number,
        gridRows: number,
        color: string,
        scaleW: number = 1,
        scaleH: number = 1
    ): ex.Graphic {
        // 计算单个格子的尺寸（缩放后）
        const cellW = this.tileSize * scaleW;
        const cellH = this.tileSize * scaleH;
        // 计算总尺寸
        const totalW = gridCols * cellW;
        const totalH = gridRows * cellH;

        // 尝试获取贴图
        const sprite = this.resourceManager.getSprite(name, this.tileSize);
        if (sprite) {
            // 计算缩放比例（cellW/cellH 是目标尺寸，tileSize 是原始贴图尺寸）
            const scaleX = cellW / this.tileSize;
            const scaleY = cellH / this.tileSize;

            if (gridCols === 1 && gridRows === 1) {
                // 单个贴图，使用 scale 缩放（不用 destSize，避免缝隙问题）
                const scaled = sprite.clone();
                scaled.scale = new ex.Vector(scaleX, scaleY);
                return scaled;
            }

            // 多个贴图拼接：使用 GraphicsGroup
            const members: ex.GraphicsGrouping[] = [];
            for (let row = 0; row < gridRows; row++) {
                for (let col = 0; col < gridCols; col++) {
                    const spriteCopy = sprite.clone();
                    spriteCopy.scale = new ex.Vector(scaleX, scaleY);
                    members.push({
                        graphic: spriteCopy,
                        offset: new ex.Vector(
                            col * cellW + cellW / 2 - totalW / 2,
                            row * cellH + cellH / 2 - totalH / 2
                        )
                    });
                }
            }
            return new ex.GraphicsGroup({ members });
        }

        // 回退到颜色方块
        return new ex.Rectangle({
            width: totalW,
            height: totalH,
            color: ex.Color.fromHex(color),
            strokeColor: ex.Color.White,
            lineWidth: 1,
        });
    }


    /**
     * 辅助方法：统一创建逻辑
     * z 表示层级
     * 默认interaction层的character类实体z=20, interaction层的prop类实体z=10, terrain层的实体z=0
     * 上层的实体不会被覆盖
     * 只会影响渲染的层级，不影响层级之间的实体物理模拟问题
     * @param gridW 格子宽度（来自 map.json size）
     * @param gridH 格子高度（来自 map.json size）
     * @param scaleW 宽度缩放比例（来自 code.json）
     * @param scaleH 高度缩放比例（来自 code.json）
     */
    private createActor(params: {
        name: string;
        x: number; y: number;
        gridW: number; gridH: number;
        scaleW: number; scaleH: number;
        color: string;
        type: ex.CollisionType;
        z: number;
    }): ex.Actor {
        const width = params.gridW * params.scaleW * this.tileSize;
        const height = params.gridH * params.scaleH * this.tileSize;

        // 从实例获取碰撞组
        const colGroup = this.physicsManager?.getGroupForType(params.name);

        const actor = new ex.Actor({
            name: params.name,
            pos: new ex.Vector(Math.round(params.x), Math.round(params.y)),
            width: width,
            height: height,
            collisionType: params.type,
            collisionGroup: colGroup,
            z: params.z,
            anchor: ex.Vector.Half,
        });

        // 优先使用贴图，失败则回退到颜色方块
        const graphic = this.createGraphic(params.name, params.gridW, params.gridH, params.color, params.scaleW, params.scaleH);
        actor.graphics.use(graphic);

        // 注意：重力逻辑由 createCharacter 和 createProp 分别处理
        // - character 类型：在 platformer 模式下有重力
        // - prop 类型：无重力（即使是 active 类型）

        return actor;
    }

    /**
     * 1. 地形(Layer: Terrain, Z=0)
     * 地形固定为 1x1 格子，不支持缩放
     */
    createTerrain(name: string, x: number, y: number, color: string, collision?: string): ex.Actor {
        const collisionType = this.parseCollisionType(collision);

        // 地形不使用碰撞组，确保和所有 Active 实体都触发碰撞事件
        const actor = new ex.Actor({
            name,
            pos: new ex.Vector(Math.round(x), Math.round(y)),
            width: this.tileSize,
            height: this.tileSize,
            collisionType: collisionType,
            z: 0,
            anchor: ex.Vector.Half,
        });

        // 优先使用贴图，失败则回退到颜色方块（地形固定 1x1 格子，无缩放）
        const graphic = this.createGraphic(name, 1, 1, color, 1, 1);
        actor.graphics.use(graphic);

        const box = ex.Shape.Box(this.tileSize, this.tileSize);
        actor.collider.set(box);

        return actor;
    }

    /**
     * 2. 交互道具 (Layer: Interaction, Z=10)
     * 处理可以交互的prop类实体
     * prop 类型实体无重力，但可以是 active 类型（如移动平台）
     * @param gridW 格子宽度（来自 map.json size）
     * @param gridH 格子高度（来自 map.json size）
     * @param scaleW 宽度缩放比例（来自 code.json）
     * @param scaleH 高度缩放比例（来自 code.json）
     */
    createProp(name: string, x: number, y: number, gridW: number, gridH: number, scaleW: number, scaleH: number, color: string, collision?: string): ex.Actor {
        let collisionType = this.parseCollisionType(collision);
        const actor = this.createActor({
            name, x, y, gridW, gridH, scaleW, scaleH, color,
            type: collisionType,
            z: 10
        });

        // prop 类型无重力（即使 collision 是 active）
        actor.body.useGravity = false;

        return actor;
    }

    /**
     * 3. 角色 (Layer: Interaction, Z=20)
     * @param gridW 格子宽度（来自 map.json size）
     * @param gridH 格子高度（来自 map.json size）
     * @param scaleW 宽度缩放比例（来自 code.json）
     * @param scaleH 高度缩放比例（来自 code.json）
     */
    createCharacter(name: string, x: number, y: number, gridW: number, gridH: number, scaleW: number, scaleH: number, color: string, collision?: string): ex.Actor {
        const collisionType = this.parseCollisionType(collision);

        // 所有角色都使用碰撞组，确保能与边界墙正确碰撞
        const colGroup = this.physicsManager?.getGroupForType(name);

        const width = gridW * scaleW * this.tileSize;
        const height = gridH * scaleH * this.tileSize;

        const actor = new ex.Actor({
            name,
            pos: new ex.Vector(Math.round(x), Math.round(y)),
            width,
            height,
            collisionType,
            collisionGroup: colGroup,
            z: 20,
            anchor: ex.Vector.Half,
        });

        // 优先使用贴图，失败则回退到颜色方块
        const graphic = this.createGraphic(name, gridW, gridH, color, scaleW, scaleH);
        actor.graphics.use(graphic);

        // 碰撞器尺寸与视觉尺寸一致（不再额外缩小）
        const box = ex.Shape.Box(width, height);
        actor.collider.set(box);

        // 在 platformer 模式下，为 Active 类型角色启用重力
        if (this.physicsMode === 'platformer' && collisionType === ex.CollisionType.Active) {
            actor.body.useGravity = true;
            actor.acc = new ex.Vector(0, 800);
        }

        return actor;
    }

    /**
     * 4. 投射物 （schema中未定义，游戏运行时动态实例化）
     * @param type 投射物类型键名 (如 'bullet', 'missile') - 用于去 config 里查属性
     * @param x, y, direction, owner - 运行时参数
     * @param collision - 碰撞类型字符串 (可选)
     */
    createProjectile(
        type: string,
        x: number,
        y: number,
        direction: ex.Vector,
        owner: ex.Actor,
        collision?: string
    ): ex.Actor {
        // 1. 从统一的 EntityConfig 中获取属性，如果没有则使用默认值
        const props = this.config[type] || {};

        const speed = props.speed || 300;
        const color = props.color || '#00d0ff';

        // 计算直径和半径，投射物的形状呈现为圆形
        const diameter = (props.width || 0.25) * this.tileSize;
        const radius = diameter / 2;

        const damage = props.damage || 1;

        // 从 physicsManager 获取碰撞组
        const colGroup = this.physicsManager?.getGroupForType(type);

        // 解析碰撞类型
        const collisionType = collision ? this.parseCollisionType(collision) : ex.CollisionType.Active;

        // 2. 组装 Entity
        const projectile = new ex.Actor({
            name: type,
            pos: new ex.Vector(Math.round(x), Math.round(y)),
            collider: ex.Shape.Circle(radius),
            anchor: ex.Vector.Half,

            collisionType: collisionType,
            collisionGroup: colGroup,
            vel: direction.scale(speed),
            z: 30
        });

        // 创建圆形视觉图形并应用
        const circleGraphic = new ex.Circle({
            radius: radius,
            color: ex.Color.fromHex(color)
        });
        projectile.graphics.use(circleGraphic);

        // 3. 挂载数据组件
        (projectile as any).owner = owner;
        (projectile as any).damage = damage;

        return projectile;
    }
}
