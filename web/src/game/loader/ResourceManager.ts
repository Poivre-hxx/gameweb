import * as ex from 'excalibur';
import type { MapData } from '../core/types';

/**
 * 资源管理器
 * 负责加载和管理游戏贴图资源
 */
export class ResourceManager {
  private static instance: ResourceManager;

  // 存储已加载的 ImageSource
  private imageSources: Map<string, ex.ImageSource> = new Map();
  // 存储加载失败的路径
  private failedSprites: Set<string> = new Set();
  // 存储 name -> sprite 路径的映射
  private nameToPath: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  /**
   * 预加载 mapping 中所有贴图
   * @param mapping 地图映射配置
   */
  public async loadSprites(mapping: MapData['mapping']): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    for (const [key, def] of Object.entries(mapping)) {
      if (def.sprite && !this.imageSources.has(def.sprite)) {
        const path = def.sprite;
        const imageSource = new ex.ImageSource(path);

        // 记录 name -> path 映射
        this.nameToPath.set(def.name, path);

        const loadPromise = imageSource.load()
          .then(() => {
            this.imageSources.set(path, imageSource);
            console.log(`[ResourceManager] Loaded sprite: ${path}`);
          })
          .catch((error) => {
            console.warn(`[ResourceManager] Failed to load sprite: ${path}`, error);
            this.failedSprites.add(path);
          });

        loadPromises.push(loadPromise);
      }
    }

    await Promise.all(loadPromises);
    console.log(`[ResourceManager] Loaded ${this.imageSources.size} sprites, ${this.failedSprites.size} failed`);
  }

  /**
   * 获取指定名称的精灵
   * @param name 元素名称
   * @param targetSize 目标尺寸（用于缩放）
   * @returns Sprite 或 null（如果不存在或加载失败）
   */
  public getSprite(name: string, targetSize: number): ex.Sprite | null {
    const path = this.nameToPath.get(name);
    if (!path) return null;

    // 检查是否加载失败
    if (this.failedSprites.has(path)) return null;

    const imageSource = this.imageSources.get(path);
    if (!imageSource || !imageSource.isLoaded()) return null;

    // 创建精灵（不使用 destSize，改用 scale 避免纹理采样问题）
    const sprite = imageSource.toSprite();

    // 使用 scale 缩放，避免 destSize 导致的边缘问题
    const scale = targetSize / imageSource.width;
    sprite.scale = new ex.Vector(scale, scale);

    return sprite;
  }

  /**
   * 检查指定名称是否有可用的贴图
   * @param name 元素名称
   */
  public hasSprite(name: string): boolean {
    const path = this.nameToPath.get(name);
    if (!path) return false;
    if (this.failedSprites.has(path)) return false;
    return this.imageSources.has(path);
  }

  /**
   * 清理所有已加载的资源
   */
  public clear(): void {
    this.imageSources.clear();
    this.failedSprites.clear();
    this.nameToPath.clear();
    console.log('[ResourceManager] Cleared all resources');
  }
}
