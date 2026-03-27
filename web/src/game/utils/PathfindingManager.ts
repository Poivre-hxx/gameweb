import * as ex from 'excalibur';
import { ExcaliburAStar } from '@excaliburjs/plugin-pathfinding';
import type { MapData } from '../core/types';

/**
 * 瓦片定义类型（从 MapData.mapping 中获取）
 */
interface TileDefinition {
    name: string;
    category?: string;
    color?: string;
    description?: string;
    layer?: string;
    collision?: 'prevent' | 'passive' | 'active' | 'fixed';
}

/**
 * 寻路管理器
 * 封装 ExcaliburAStar，处理 MapData -> Excalibur TileMap 的转换
 */
export class PathfindingManager {
    private astar: ExcaliburAStar | null = null;
    private tileMap: ex.TileMap | null = null;
    private tileSize: number = 0;
    private rows: number = 0;
    private cols: number = 0;
    private allowDiagonals: boolean = false;
    private walkableTiles: Set<number> = new Set(); // 存储可行走的瓦片索引
    private walkableTiles: Set<number> = new Set();
    private componentMap: Map<number, number> = new Map();   // 瓦片 -> 连通区域ID
    private componentGroups: Map<number, number[]> = new Map(); // 区域ID -> 瓦片列表

    /**
     * 初始化寻路管理器
     * @param mapData 地图数据
     * @param tileSize 瓦片大小
     * @param physicsMode 物理模式（topdown=4方向, freely=8方向, platformer=不使用寻路）
     * @param engine Excalibur 引擎实例（用于将 TileMap 添加到场景）
     */
    initialize(mapData: MapData, tileSize: number, physicsMode: string, engine: ex.Engine): void {
        this.tileSize = tileSize;
        this.rows = mapData.terrain.grid.length;
        this.cols = mapData.terrain.grid[0].row.length;
        this.allowDiagonals = physicsMode === 'freely';
        this.walkableTiles.clear();

        // ✅ 不再使用 ex.TileMap，直接构建 GraphTileMap
        const graphTiles: { collider: boolean }[] = [];

        const { terrain, mapping } = mapData;

        for (let y = 0; y < this.rows; y++) {
            const row = terrain.grid[y].row;
            for (let x = 0; x < this.cols; x++) {
                const char = row[x];
                const def = mapping[char];
                const isWalkable = this.isTileWalkable(def);
                const tileIndex = y * this.cols + x;

                if (isWalkable) {
                    this.walkableTiles.add(tileIndex);
                }

                // ✅ collider: true = 障碍物，collider: false = 可通行
                graphTiles.push({ collider: !isWalkable });
            }
        }

        const graphTileMap: GraphTileMap = {
            name: 'pathfinding-map',
            tiles: graphTiles,
            rows: this.rows,
            cols: this.cols,
        };

        // ✅ 直接传 GraphTileMap，不再传 TileMap 实例
        this.astar = new ExcaliburAStar(graphTileMap);

        const solidCount = graphTiles.filter(t => t.collider).length;
        this.buildConnectivityMap();
    }

    private buildConnectivityMap(): void {
        this.componentMap.clear();
        this.componentGroups.clear();
        let componentId = 0;

        for (const startIdx of this.walkableTiles) {
            if (this.componentMap.has(startIdx)) continue;

            const group: number[] = [];
            const queue = [startIdx];
            this.componentMap.set(startIdx, componentId);

            while (queue.length > 0) {
                const current = queue.shift()!;
                group.push(current);

                const neighbors = [
                    current - 1,
                    current + 1,
                    current - this.cols,
                    current + this.cols,
                ];

                for (const n of neighbors) {
                    if (!this.walkableTiles.has(n)) continue;
                    if (this.componentMap.has(n)) continue;
                    this.componentMap.set(n, componentId);
                    queue.push(n);
                }
            }

            this.componentGroups.set(componentId, group);
            componentId++;
        }

        console.log(`[PathfindingManager] Connected components: ${componentId}`);
        for (const [id, group] of this.componentGroups) {
            console.log(`  Component ${id}: ${group.length} tiles`);
        }
    }

    /**
     * 判断瓦片是否可行走
     * 根据 def.collision 字段判断（Excalibur 碰撞类型含义）：
     * - 'prevent': 不参与碰撞，可以自由通行 → 可行走
     * - 'passive': 触发碰撞事件但不阻挡移动 → 可行走
     * - 'active': 参与碰撞并阻挡移动 → 不可行走（动态实体）
     * - 'fixed': 静态障碍，阻挡移动 → 不可行走
     */
    private isTileWalkable(def: TileDefinition | undefined): boolean {
        if (!def) return false;

        // 明确标记为不可行走的情况
        if (def.collision === 'fixed' || def.collision === 'active') {
            return false;
        }

        // prevent 和 passive 都视为可行走
        return true;
    }

    /**
     * 查找从起点到终点的路径
     * @param startWorld 起点世界坐标
     * @param goalWorld 终点世界坐标
     * @returns 返回世界坐标数组（从起点到终点的路径点）
     */
    findPath(startWorld: ex.Vector, goalWorld: ex.Vector): ex.Vector[] {
        if (!this.astar) return [];

        const startTileIndex = this.worldToTileIndex(startWorld);
        const goalTileIndex = this.worldToTileIndex(goalWorld);

        if (startTileIndex === goalTileIndex) return [startWorld];

        const startNode = this.astar.getNodeByIndex(startTileIndex);
        const goalNode = this.astar.getNodeByIndex(goalTileIndex);

        if (!startNode || !goalNode) return [];

        // ✅ 检查起点和终点是否是障碍物（常见陷阱！）
        if (startNode.collider) {
            console.warn(`[findPath] Start tile ${startTileIndex} is a collider!`);
            return [];
        }
        if (goalNode.collider) {
            console.warn(`[findPath] Goal tile ${goalTileIndex} is a collider!`);
            return [];
        }

        const pathNodes = this.astar.astar(startNode, goalNode, this.allowDiagonals);

        // ✅ 每次 findPath 后必须重置，否则第二次调用 parent 链是脏数据
        this.astar.resetGrid();

        const path: ex.Vector[] = [];
        // ✅ 补上起点（插件不会在路径里包含 startnode）
        for (const node of pathNodes) {
            path.push(this.tileIndexToWorld(typeof node.id === 'string' ? parseInt(node.id) : node.id));
        }

        return path;
    }

    /**
     * 获取随机可行走位置
     * 只选择空地（space），不会选择墙壁或其他障碍物
     * @param fromWorld 起点世界坐标（用于计算距离）
     * @param minTileDistance 最小瓦片距离（默认 3 个瓦片）
     * @param lastTarget 上一次的终点（用于选择与上次终点相距较远的新终点）
     */
    getRandomWalkablePosition(fromWorld?: ex.Vector, minTileDistance: number = 3, lastTarget?: ex.Vector): ex.Vector {
        if (!this.astar || this.walkableTiles.size === 0) return ex.Vector.Zero;

        let pool: number[];

        if (fromWorld) {
            const fromIndex = this.worldToTileIndex(fromWorld);
            const componentId = this.componentMap.get(fromIndex);

            if (componentId !== undefined) {
                pool = this.componentGroups.get(componentId) || [];
            } else {
                // 起点不在可走区域，用全部可走瓦片
                pool = Array.from(this.walkableTiles);
            }
        } else {
            pool = Array.from(this.walkableTiles);
        }

        if (pool.length === 0) return ex.Vector.Zero;

        // 过滤距离太近的瓦片
        if (fromWorld && minTileDistance > 0) {
            const farEnoughPool = pool.filter(idx => {
                const tileWorld = this.tileIndexToWorld(idx);
                const tileDist = tileWorld.sub(fromWorld).size / this.tileSize;
                return tileDist >= minTileDistance;
            });
            // 如果过滤后还有可选的，使用过滤后的池子
            if (farEnoughPool.length > 0) {
                pool = farEnoughPool;
            }
        }

        // 过滤四周安全（不紧贴墙）的瓦片
        const safePool = pool.filter(idx => {
            const neighbors = [
                idx - 1,              // 左
                idx + 1,              // 右
                idx - this.cols,      // 上
                idx + this.cols,      // 下
                idx - this.cols - 1,  // 左上
                idx - this.cols + 1,  // 右上
                idx + this.cols - 1,  // 左下
                idx + this.cols + 1,  // 右下
            ];
            return neighbors.every(n => this.walkableTiles.has(n));
        });

        const finalPool = safePool.length > 0 ? safePool : pool;

        // 选择综合得分最高的瓦片（距离起点远 + 距离上次终点远）
        let bestIndex = finalPool[0];
        let bestScore = 0;

        if (fromWorld) {
            for (const idx of finalPool) {
                const tileWorld = this.tileIndexToWorld(idx);
                const distFromStart = tileWorld.sub(fromWorld).size;

                // 如果有上一次终点，计算距离上次终点的距离
                let distFromLastTarget = 0;
                if (lastTarget) {
                    distFromLastTarget = tileWorld.sub(lastTarget).size;
                }

                // 综合得分 = 距起点距离 + 距上次终点距离
                const score = distFromStart + distFromLastTarget;

                if (score > bestScore) {
                    bestScore = score;
                    bestIndex = idx;
                }
            }
        } else {
            // 没有起点时，随机选择（保持向后兼容）
            bestIndex = finalPool[Math.floor(Math.random() * finalPool.length)];
        }

        return this.tileIndexToWorld(bestIndex);
    }

    /**
     * 世界坐标转瓦片索引
     */
    private worldToTileIndex(worldPos: ex.Vector): number {
        const x = Math.floor(worldPos.x / this.tileSize);
        const y = Math.floor(worldPos.y / this.tileSize);
        return y * this.cols + x;
    }

    /**
     * 瓦片索引转世界坐标
     */
    private tileIndexToWorld(tileIndex: number): ex.Vector {
        const x = tileIndex % this.cols;
        const y = Math.floor(tileIndex / this.cols);
        return new ex.Vector(
            x * this.tileSize + this.tileSize / 2,
            y * this.tileSize + this.tileSize / 2
        );
    }
}
