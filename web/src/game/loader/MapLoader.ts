import * as ex from 'excalibur';
import type { MapData, EntityConfig } from '../core/types';
import { EntityFactory } from './EntityFactory';
import { PhysicsManager } from '../runtime/PhysicsManager';
import { EntityWrapper } from '../api/GameUtils';
import { ResourceManager } from './ResourceManager';


export class MapLoader {
    private engine: ex.Engine;
    private physicsManager: PhysicsManager;

    constructor(engine: ex.Engine, physicsManager: PhysicsManager) {
        this.engine = engine;
        this.physicsManager = physicsManager;
    }

    /**
     * 解析地图并生成实体
     * @param physicsMode 物理模式，用于决定是否启用重力
     * @returns 返回玩家实体(如果找到)，用于摄像机跟随
     */
    async load(data: MapData, tileSize: number, entityConfig?: EntityConfig, physicsMode?: string): Promise<ex.Actor | null> {
        const { terrain, interaction, mapping } = data;

        if (!terrain?.grid) {
            console.error("MapLoader: Missing terrain.grid", data);
            return null;
        }

        if (!mapping) {
            console.error("MapLoader: Missing mapping", data);
            return null;
        }

        // 预加载所有贴图资源
        const resourceManager = ResourceManager.getInstance();
        await resourceManager.loadSprites(mapping);

        const factory = new EntityFactory(tileSize, entityConfig, this.physicsManager, physicsMode);

        const { grid } = terrain;

        // 1. 清理场景
        this.engine.currentScene.clear();

        let playerCount = 0;
        let playerActor: ex.Actor | null = null;

        // 2. 遍历地形网格（只处理 terrain 层：地面、墙等）
        grid.forEach((rowObj) => {
            const yIndex = rowObj.y;
            const chars = rowObj.row.split('');

            chars.forEach((char, xIndex) => {
                const def = mapping[char];
                if (!def) return;
                // 只处理 terrain 层的元素
                if (def.layer !== 'terrain') return;

                if (def.name === 'space') return;

                const worldX = xIndex * tileSize + tileSize / 2;
                const worldY = yIndex * tileSize + tileSize / 2;
                const color = def.color || '#ffffff';

                if (def.name === 'player') {
                    console.warn(`[MapLoader] ⚠️ Player found in TERRAIN at (${xIndex}, ${yIndex})`);
                    playerCount++;
                }

                const actor = factory.createTerrain(def.name, worldX, worldY, color, def.collision);
                if (actor) {
                    this.engine.add(actor);
                }
            });
        });

        // 3. 遍历 interaction 数组（处理玩家、敌人、道具等）
        if (interaction && Array.isArray(interaction)) {
            interaction.forEach((item) => {
                const def = mapping[item.element];
                if (!def) {
                    console.warn(`MapLoader: Unknown element "${item.element}" in interaction`);
                    return;
                }

                // 计算世界坐标（anchor 是左上角，转换为中心点）
                const worldX = item.anchor.x * tileSize + tileSize / 2;
                const worldY = item.anchor.y * tileSize + tileSize / 2;
                const color = def.color || '#ffffff';

                let actor: ex.Actor | null = null;

                // 分离格子数量和缩放比例
                // gridW/gridH: 格子数量（来自 map.json size），决定贴图拼接数量
                // scaleW/scaleH: 缩放比例（来自 code.json width/height），决定贴图拉伸
                const gridW = item.size?.width || 1;
                const gridH = item.size?.height || 1;
                const scaleW = entityConfig?.[def.name]?.width || 1;
                const scaleH = entityConfig?.[def.name]?.height || 1;

                // 根据类型创建实体
                if (def.name === 'player') {
                    actor = factory.createCharacter(def.name, worldX, worldY, gridW, gridH, scaleW, scaleH, color, def.collision);
                    playerActor = actor;
                    new EntityWrapper(actor);

                    // 直接在 actor 上监听，绕过 EntityWrapper
                    actor.on('collisionstart', (evt) => {
                        console.log(`[RAW collisionstart] player <-> ${evt.other?.name}, side=${evt.side}`);
                    });
                } else if (def.category === 'character') {
                    actor = factory.createCharacter(def.name, worldX, worldY, gridW, gridH, scaleW, scaleH, color, def.collision);
                } else if (def.category === 'prop') {
                    actor = factory.createProp(def.name, worldX, worldY, gridW, gridH, scaleW, scaleH, color, def.collision);
                }

                if (actor) {
                    // 可以把 interaction item 的额外信息挂到 actor 上
                    (actor as any).interactionId = item.id;
                    (actor as any).interactionSize = item.size;
                    this.engine.add(actor);
                }
            });
        }

        // 4. 创建隐形边界墙
        const mapWidth = grid[0].row.length * tileSize;
        const mapHeight = grid.length * tileSize;
        const wallThickness = 16;
        const margin = tileSize / 8; // 留出 1/8 个瓦片的边距，防止卡墙（从 tileSize/4 减小）

        const boundaryGroup = this.physicsManager.getGroupForType('boundary_wall');

        const boundaryConfig = {
            name: 'boundary_wall',
            collisionType: ex.CollisionType.Fixed,
            collisionGroup: boundaryGroup,
            color: ex.Color.Transparent,
        };

        // 上墙
        const topWall = new ex.Actor({
            ...boundaryConfig,
            pos: new ex.Vector(mapWidth / 2, -wallThickness / 2 - margin),
            width: mapWidth + wallThickness * 2 + margin * 2,
            height: wallThickness,
        });
        (topWall as any).boundaryType = 'top';
        this.engine.add(topWall);

        // 下墙
        const bottomWall = new ex.Actor({
            ...boundaryConfig,
            pos: new ex.Vector(mapWidth / 2, mapHeight + wallThickness / 2 + margin),
            width: mapWidth + wallThickness * 2 + margin * 2,
            height: wallThickness,
        });
        (bottomWall as any).boundaryType = 'bottom';
        this.engine.add(bottomWall);

        // 左墙
        const leftWall = new ex.Actor({
            ...boundaryConfig,
            pos: new ex.Vector(-wallThickness / 2 - margin, mapHeight / 2),
            width: wallThickness,
            height: mapHeight + margin * 2,
        });
        (leftWall as any).boundaryType = 'left';
        this.engine.add(leftWall);

        // 右墙
        const rightWall = new ex.Actor({
            ...boundaryConfig,
            pos: new ex.Vector(mapWidth + wallThickness / 2 + margin, mapHeight / 2),
            width: wallThickness,
            height: mapHeight + margin * 2,
        });
        (rightWall as any).boundaryType = 'right';
        this.engine.add(rightWall);

        console.log(`[MapLoader] Total actors in scene: ${this.engine.currentScene.actors.length}`);
        return playerActor;
    }
}
