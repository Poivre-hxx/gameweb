/**
 * 游戏工具函数
 */

/**
 * 根据容器大小和地图尺寸计算最佳 tileSize
 * @param gridWidth 地图网格宽度（格子数）
 * @param gridHeight 地图网格高度（格子数）
 * @param cameraMode 摄像机模式
 * @param containerWidth GameCanvas 容器宽度（像素）
 * @param containerHeight GameCanvas 容器高度（像素）
 * @param minTileSize 最小 tileSize（默认 16）
 * @param maxTileSize 最大 tileSize（默认 64）
 */
export function calculateOptimalTileSize(
  gridWidth: number,
  gridHeight: number,
  cameraMode: 'fixed' | 'follow' | 'auto-scroll',
  containerWidth: number,
  containerHeight: number,
  minTileSize = 16,
  maxTileSize = 64
): number {
  let tileSize: number;

  if (cameraMode === 'fixed') {
    // fixed 模式：整个地图需要完整显示，考虑宽高两个方向
    const tileSizeByWidth = Math.floor(containerWidth / gridWidth);
    const tileSizeByHeight = Math.floor(containerHeight / gridHeight);
    tileSize = Math.min(tileSizeByWidth, tileSizeByHeight);
  } else {
    // follow 或 auto-scroll 模式：地图是长条的，只需考虑高度
    tileSize = Math.floor(containerHeight / gridHeight);
  }

  // 限制在 min/max 范围内
  return Math.max(minTileSize, Math.min(maxTileSize, tileSize));
}
