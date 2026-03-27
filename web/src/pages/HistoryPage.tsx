import { useState, useEffect, useMemo } from 'react';
import { ReactFlow, Background, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Node, Edge } from '@xyflow/react';
import historyService, { type VersionTreeNode } from '../services/HistoryService';
import type { GameVersion, MergePreview, MergeConflict, ConflictResolution } from '../types';
import type { GameRules } from '../game/core/types';

interface HistoryPageProps {
  onNavigate: (tab: 'home' | 'preview' | 'history' | 'settings', versionId?: string) => void;
}

// 布局常量
const CARD_WIDTH = 240;
const CARD_HEIGHT = 200;
const GAP_Y = 20;      // 垂直间距
const COLUMN_GAP = 30; // 水平间距

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function countConfigFields(rules: GameRules): number {
  if (!rules?.entityConfig) return 0;
  return Object.keys(rules.entityConfig).length;
}

function getMapSizeDescription(mapData: any): string {
  if (!mapData) return 'No map';

  const width = mapData?.schema?.map_size?.width || mapData?.meta?.map_size?.width;
  const height = mapData?.schema?.map_size?.height || mapData?.meta?.map_size?.height;

  if (width && height) {
    return `${width}×${height}`;
  }

  const grid = mapData?.terrain?.grid;
  if (grid && grid.length > 0 && grid[0]?.row?.length > 0) {
    return `${grid[0].row.length}×${grid.length}`;
  }

  return 'Unknown';
}

// ========== Merge Preview Components ==========

interface ConflictItemProps {
  conflict: MergeConflict;
  selectedResolution: ConflictResolution | undefined;
  onResolutionChange: (resolution: ConflictResolution) => void;
}

function ConflictItem({ conflict, selectedResolution, onResolutionChange }: ConflictItemProps) {
  const severityColors = {
    high: 'border-red-500/50 bg-red-500/10',
    medium: 'border-yellow-500/50 bg-yellow-500/10',
    low: 'border-blue-500/50 bg-blue-500/10',
  };

  const severityLabels = {
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
  };

  return (
    <div className={`p-2 rounded-lg border ${severityColors[conflict.severity]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">
          {severityLabels[conflict.severity]}
        </span>
        <span className="text-gray-300 text-xs">{conflict.description}</span>
      </div>

      <div className="flex gap-1 mt-2">
        <button
          onClick={() => onResolutionChange({ conflictId: conflict.id, strategy: 'useMain' })}
          className={`flex-1 py-1 rounded text-[10px] transition-all ${
            selectedResolution?.strategy === 'useMain'
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 text-gray-400 hover:bg-white/20'
          }`}
        >
          Use Main
        </button>
        <button
          onClick={() => onResolutionChange({ conflictId: conflict.id, strategy: 'useBranch' })}
          className={`flex-1 py-1 rounded text-[10px] transition-all ${
            selectedResolution?.strategy === 'useBranch'
              ? 'bg-green-500 text-white'
              : 'bg-white/10 text-gray-400 hover:bg-white/20'
          }`}
        >
          Use Branch
        </button>
        {conflict.severity !== 'high' && (
          <button
            onClick={() => onResolutionChange({ conflictId: conflict.id, strategy: 'merge' })}
            className={`flex-1 py-1 rounded text-[10px] transition-all ${
              selectedResolution?.strategy === 'merge'
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            Merge Both
          </button>
        )}
      </div>
    </div>
  );
}

interface MergePreviewPanelProps {
  preview: MergePreview;
  userStrategy: string;
  conflictResolutions: ConflictResolution[];
  onStrategyChange: (strategy: string) => void;
  onResolutionChange: (resolution: ConflictResolution) => void;
  onConfirmMerge: () => void;
  onCancel: () => void;
  isMerging: boolean;
}

function MergePreviewPanel({
  preview,
  userStrategy,
  conflictResolutions,
  onStrategyChange,
  onResolutionChange,
  onConfirmMerge,
  onCancel,
  isMerging,
}: MergePreviewPanelProps) {
  return (
    <div className="mb-4 p-3 bg-gray-900/80 rounded-xl border border-green-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-green-400 font-semibold text-sm">Merge Preview</h4>
        <button onClick={onCancel} className="text-gray-400 hover:text-white text-xs">
          ✕
        </button>
      </div>

      {/* Loading State */}
      {preview.isLoading && (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
          <span className="animate-spin">⏳</span>
          <span>Analyzing differences...</span>
        </div>
      )}

      {/* Error State */}
      {preview.error && (
        <div className="text-red-400 text-sm py-2">{preview.error}</div>
      )}

      {/* Content */}
      {!preview.isLoading && !preview.error && (
        <>
          {/* LLM Difference Summary */}
          <div className="mb-3">
            <span className="text-gray-500 text-xs">Differences</span>
            <div className="mt-1 p-2 bg-black/30 rounded-lg text-gray-300 text-xs whitespace-pre-wrap max-h-24 overflow-y-auto">
              {preview.llmDifferenceSummary}
            </div>
          </div>

          {/* Auto-Merged Items */}
          {preview.autoMerged.length > 0 && (
            <div className="mb-3">
              <span className="text-gray-500 text-xs">Auto-Merged (LOW severity)</span>
              <div className="mt-1 p-2 bg-black/30 rounded-lg">
                {preview.autoMerged.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-green-400 text-xs">
                    <span>✓</span>
                    <span>{item}: merged</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conflicts List */}
          {preview.conflicts.length > 0 && (
            <div className="mb-3">
              <span className="text-gray-500 text-xs">
                Conflicts Need Resolution ({preview.conflicts.length})
              </span>
              <div className="mt-1 space-y-2 max-h-40 overflow-y-auto">
                {preview.conflicts.map(conflict => (
                  <ConflictItem
                    key={conflict.id}
                    conflict={conflict}
                    selectedResolution={conflictResolutions.find(r => r.conflictId === conflict.id)}
                    onResolutionChange={onResolutionChange}
                  />
                ))}
              </div>
            </div>
          )}

          {/* User Strategy Input */}
          <div className="mb-3">
            <span className="text-gray-500 text-xs">Your Merge Strategy</span>
            <textarea
              value={userStrategy}
              onChange={(e) => onStrategyChange(e.target.value)}
              placeholder="Describe how you want to handle this merge..."
              className="mt-1 w-full p-2 bg-black/30 rounded-lg text-white text-xs
                         border border-white/10 focus:border-green-500/50
                         outline-none resize-none h-16"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onConfirmMerge}
              disabled={isMerging || !userStrategy.trim()}
              className="flex-1 py-2 rounded-lg text-sm
                         bg-green-500/20 hover:bg-green-500/40
                         text-green-400 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMerging ? 'Merging...' : 'Confirm Merge'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ========== Version Card Components ==========

interface VersionCardProps {
  version: GameVersion;
  currentVersionId: string | null;
  selectedVersionId: string | null;
  deleteConfirmId: string | null;
  onSelect: (version: GameVersion) => void;
  onLoad: (version: GameVersion) => void;
  onDelete: (versionId: string, e: React.MouseEvent) => void;
  versionNumber: string;  // 格式如 "1-1", "1-2" (分支-序号)
  branchColor?: string; // 分支边框颜色（主链为 undefined）
}

function VersionCard({
  version,
  currentVersionId,
  selectedVersionId,
  deleteConfirmId,
  onSelect,
  onLoad,
  onDelete,
  versionNumber,
  branchColor,
}: VersionCardProps) {
  const isSelected = selectedVersionId === version.id;
  const isCurrent = version.id === currentVersionId;
  const mapSize = getMapSizeDescription(version.mapData);
  const fieldCount = countConfigFields(version.code);

  return (
    <div
      onClick={() => onSelect(version)}
      className={`
        relative w-[240px] h-[200px] rounded-xl p-4 border-[3px]
        transition-all cursor-pointer hover:shadow-lg
        flex flex-col
        ${isSelected
          ? 'bg-[#0c111e] shadow-[0_0_1px_#1971c2]'
          : 'bg-[#131c31]'
        }
        ${branchColor
          ? 'hover:shadow-lg'
          : 'border-[#5a3a12]'
        }
      `}
      style={branchColor ? { borderColor: branchColor } : undefined}
    >
      {/* Version header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-300 text-xs font-mono">
            #{versionNumber}
          </span>

          {isCurrent && (
            <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded">
              Current
            </span>
          )}
        </div>

        <span className="text-gray-300 text-[10px]">
          {formatTimestamp(version.timestamp)}
        </span>
      </div>

      {/* Description */}
      <div className="mb-3">
        <p className="text-white text-sm line-clamp-3">
          {version.caption || 'No description'}
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[10px] text-gray-300 mb-3">
        <span>📐 {mapSize}</span>
        <span>📃 {fieldCount} entities</span>
      </div>

      {/* Action buttons */}
      <div className="mt-auto flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLoad(version);
          }}
          className="flex-1 py-1.5 rounded-lg text-[10px]
                     bg-blue-500/20 hover:bg-blue-500/40
                     text-blue-400 transition-all duration-300"
        >
          Load
        </button>

        <button
          onClick={(e) => onDelete(version.id, e)}
          className={`px-3 py-1.5 rounded-lg text-[10px] transition-all duration-300
            ${deleteConfirmId === version.id
              ? 'bg-red-500 text-white'
              : 'bg-red-500/20 hover:bg-red-500/40 text-red-400'
            }`}
        >
          {deleteConfirmId === version.id ? 'Confirm?' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

// React Flow 自定义节点数据类型
interface VersionNodeData extends Record<string, unknown> {
  version: GameVersion;
  currentVersionId: string | null;
  selectedVersionId: string | null;
  deleteConfirmId: string | null;
  onSelect: (version: GameVersion) => void;
  onLoad: (version: GameVersion) => void;
  onDelete: (versionId: string, e: React.MouseEvent) => void;
  versionNumber: string;  // 格式如 "1-1", "1-2" (分支-序号)
  branchColor?: string;
  hasParent: boolean;       // 是否有父节点
  hasMainChild: boolean;    // 是否有主链子节点
  hasBranchChild: boolean;  // 是否有分支子节点
  isBranchNode: boolean;    // 是否是分支节点
  mergedFrom?: string;      // 合并来源版本ID
}

// React Flow 自定义节点组件
function VersionNode({ data }: { data: VersionNodeData }) {
  return (
    <div className="relative">
      {/* Bottom Handle - 接收来自父节点的连线（父节点在下方） */}
      {data.hasParent && (
        <Handle
          type="target"
          position={Position.Bottom}
          className="!w-1 !h-1 !bg-transparent !border-none"
        />
      )}
      <VersionCard
        version={data.version}
        currentVersionId={data.currentVersionId}
        selectedVersionId={data.selectedVersionId}
        deleteConfirmId={data.deleteConfirmId}
        onSelect={data.onSelect}
        onLoad={data.onLoad}
        onDelete={data.onDelete}
        versionNumber={data.versionNumber}
        branchColor={data.branchColor}
      />
      {/* Top Handle - 连接到主链子节点（子节点在上方） */}
      {data.hasMainChild && (
        <Handle
          type="source"
          position={Position.Top}
          className="!w-1 !h-1 !bg-transparent !border-none"
        />
      )}
      {/* Right Handle - 连接到分支子节点（分支在右侧，起点在 2/3 高度处） */}
      {data.hasBranchChild && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-1 !h-1 !bg-transparent !border-none"
          style={{ top: '66%' }}
        />
      )}
      {/* Merge Handle - 分支节点顶部（用于发出合并边） */}
      {data.isBranchNode && (
        <Handle
          type="source"
          position={Position.Top}
          id="merge"
          className="!w-1 !h-1 !bg-transparent !border-none"
          style={{ left: '50%' }}
        />
      )}
      {/* Merge Target Handle - 合并节点右侧（用于接收合并边） */}
      {data.mergedFrom && (
        <Handle
          type="target"
          position={Position.Right}
          id="mergeTarget"
          className="!w-1 !h-1 !bg-transparent !border-none"
          style={{ top: '33%' }}
        />
      )}
    </div>
  );
}

const nodeTypes = { versionNode: VersionNode };

// 分支颜色
const BRANCH_COLORS = ['#4a1f2f', '#1c4546'];

// Git 树布局组件 - 使用 React Flow
interface GitTreeLayoutProps {
  versionTree: VersionTreeNode[];
  currentVersionId: string | null;
  selectedVersionId: string | null;
  deleteConfirmId: string | null;
  onSelect: (version: GameVersion) => void;
  onLoad: (version: GameVersion) => void;
  onDelete: (versionId: string, e: React.MouseEvent) => void;
  onMerge: (versionId: string) => void;
}

function GitTreeLayout({
  versionTree,
  currentVersionId,
  selectedVersionId,
  deleteConfirmId,
  onSelect,
  onLoad,
  onDelete,
  onMerge,
}: GitTreeLayoutProps) {
  // 计算 nodes 和 edges
  const { nodes, edges } = useMemo(() => {
    const flowNodes: Node<VersionNodeData>[] = [];
    const flowEdges: Edge[] = [];
    let branchColorIndex = 0;

    // 计算每个分支（及其子分支）需要的总列数
    function getBranchColumns(treeNode: VersionTreeNode): number {
      if (treeNode.children.length === 0) return 1;
      let columns = 0;
      treeNode.children.forEach(child => {
        columns += getBranchColumns(child);
      });
      return Math.max(1, columns);
    }

    // 收集树节点及其所有子孙节点
    function collectNodes(treeNode: VersionTreeNode): VersionTreeNode[] {
      const nodes: VersionTreeNode[] = [treeNode];
      treeNode.children.forEach(child => {
        nodes.push(...collectNodes(child));
      });
      return nodes;
    }

    function traverse(
      treeNode: VersionTreeNode,
      x: number,
      y: number,
      rootIndex: number,
      numberMap: Map<string, number>,
      parentId?: string,
      branchColor?: string
    ) {
      const nodeId = treeNode.version.id;
      const nodeNumber = numberMap.get(nodeId) || 1;
      const hasMainChild = treeNode.children.length > 0;
      const hasBranchChild = treeNode.children.length > 1;

      flowNodes.push({
        id: nodeId,
        type: 'versionNode',
        position: { x, y },
        data: {
          version: treeNode.version,
          currentVersionId,
          selectedVersionId,
          deleteConfirmId,
          onSelect,
          onLoad,
          onDelete,
          versionNumber: `${rootIndex}-${nodeNumber}`,
          branchColor,
          hasParent: !!parentId,
          hasMainChild,
          hasBranchChild,
          isBranchNode: !!branchColor,
          mergedFrom: treeNode.version.metadata?.mergedFrom,
        },
        draggable: false, // 禁止拖动单个节点
      });

      if (parentId) {
        // 判断是否是同一列（主链）
        const parentNode = flowNodes.find(n => n.id === parentId);
        const isMainChain = parentNode?.position.x === x;

        flowEdges.push({
          id: `edge-${nodeId}`,
          source: parentId,
          target: nodeId,
          sourceHandle: isMainChain ? undefined : 'right',
          type: 'smoothstep', // 折线样式
          animated: false,
          style: { stroke: '#475569', strokeWidth: 3 },
        });
      }

      if (treeNode.children.length > 0) {
        // 主链子节点
        const mainChild = treeNode.children[0];
        traverse(mainChild, x, y - CARD_HEIGHT - GAP_Y, rootIndex, numberMap, nodeId, branchColor);

        // 分支子节点
        let branchX = x + CARD_WIDTH + COLUMN_GAP;
        treeNode.children.slice(1).forEach(child => {
          const branchColumns = getBranchColumns(child);
          const branchCenterX = branchX + (branchColumns * (CARD_WIDTH + COLUMN_GAP) - COLUMN_GAP - CARD_WIDTH) / 2;
          const childColor = BRANCH_COLORS[branchColorIndex % BRANCH_COLORS.length];
          branchColorIndex++;
          traverse(child, branchCenterX, y - (CARD_HEIGHT + GAP_Y) / 2, rootIndex, numberMap, nodeId, childColor);
          branchX += branchColumns * (CARD_WIDTH + COLUMN_GAP);
        });
      }
    }

    // 从初始 x 偏移开始遍历，多个根版本水平排列
    const initialXOffset = 400;
    const ROOT_GAP = COLUMN_GAP * 4; // 根版本之间的额外间距
    let currentX = initialXOffset;

    versionTree.forEach((root, rootIndex) => {
      // 收集该根版本下的所有节点，按时间戳排序后编号
      const allNodes = collectNodes(root);
      allNodes.sort((a, b) => a.version.timestamp - b.version.timestamp);

      // 创建 versionId -> 编号 的映射
      const numberMap = new Map<string, number>();
      allNodes.forEach((node, i) => {
        numberMap.set(node.version.id, i + 1);
      });

      const branchColumns = getBranchColumns(root);
      traverse(root, currentX, 0, rootIndex + 1, numberMap);
      currentX += branchColumns * (CARD_WIDTH + COLUMN_GAP) + ROOT_GAP;
    });

    // 计算最小 y 值，用于调整所有节点位置让它们都在正数区域
    const minY = Math.min(...flowNodes.map(n => n.position.y));
    if (minY < 0) {
      flowNodes.forEach(node => {
        node.position.y -= minY;
      });
    }

    // 添加合并边
    flowNodes.forEach(node => {
      const mergedFrom = node.data.mergedFrom;
      if (mergedFrom) {
        flowEdges.push({
          id: `merge-${node.id}`,
          source: mergedFrom,
          target: node.id,
          sourceHandle: 'merge',
          targetHandle: 'mergeTarget',
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#475569', strokeWidth: 3 },
        });
      }
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [versionTree, currentVersionId, selectedVersionId, deleteConfirmId, onSelect, onLoad, onDelete, onMerge]);

  return (
    <div className="w-full h-full rounded-2xl border border-gray-700 bg-gray-800/50 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        preventScrolling={true}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#475569', strokeWidth: 2 },
        }}
      >
        <Background color="#374151" gap={20} />
      </ReactFlow>
    </div>
  );
}

export default function HistoryPage({ onNavigate }: HistoryPageProps) {
  const [versionTree, setVersionTree] = useState<VersionTreeNode[]>([]);
  const [totalVersions, setTotalVersions] = useState(0);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<GameVersion | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<GameVersion | null>(null);

  // Merge preview state
  const [mergePreviews, setMergePreviews] = useState<Map<string, MergePreview>>(new Map());
  const [activeMergeBranchId, setActiveMergeBranchId] = useState<string | null>(null);
  const [userStrategy, setUserStrategy] = useState<string>('');
  const [conflictResolutions, setConflictResolutions] = useState<ConflictResolution[]>([]);
  const [isMerging, setIsMerging] = useState<boolean>(false);

  useEffect(() => {
    loadVersions();
  }, []);

  // Pre-compute merge previews for all branch versions
  useEffect(() => {
    const allVersions = historyService.getVersions();
    const branchVersions = allVersions.filter(v => historyService.isBranchVersion(v.id));
    const mainChainId = historyService.getMainChainLatestId();

    if (!mainChainId || branchVersions.length === 0) return;

    // Pre-compute previews in background
    branchVersions.forEach(async (branch) => {
      const preview = await historyService.analyzeMergeDifferences(mainChainId, branch.id);
      setMergePreviews(prev => {
        const newMap = new Map(prev);
        newMap.set(branch.id, preview);
        return newMap;
      });
    });
  }, [versionTree]);

  const loadVersions = () => {
    const tree = historyService.getVersionTree();
    const allVersions = historyService.getVersions();
    const current = historyService.getCurrentVersion();
    setVersionTree(tree);
    setTotalVersions(allVersions.length);
    setCurrentVersionId(current?.id || null);
    setCurrentVersion(current || null);
  };

  const handleLoadVersion = (version: GameVersion) => {
    onNavigate('preview', version.id);
  };

  const handleDeleteVersion = (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirmId === versionId) {
      const success = historyService.deleteVersion(versionId);
      if (success) {
        loadVersions();
        setDeleteConfirmId(null);
        if (selectedVersion?.id === versionId) setSelectedVersion(null);
      } else {
        alert('Delete failed');
      }
    } else {
      setDeleteConfirmId(versionId);
      setTimeout(() => {
        setDeleteConfirmId((prev) => (prev === versionId ? null : prev));
      }, 3000);
    }
  };

  const handlePreviewMerge = (branchVersionId: string) => {
    setActiveMergeBranchId(branchVersionId);
    setUserStrategy('');
    const preview = mergePreviews.get(branchVersionId);
    if (preview) {
      // Initialize default resolutions (use branch)
      setConflictResolutions(
        preview.conflicts.map(c => ({
          conflictId: c.id,
          strategy: 'useBranch' as const,
        }))
      );
    }
  };

  const handleCancelMerge = () => {
    setActiveMergeBranchId(null);
    setUserStrategy('');
    setConflictResolutions([]);
  };

  const handleResolutionChange = (resolution: ConflictResolution) => {
    setConflictResolutions(prev => {
      const filtered = prev.filter(r => r.conflictId !== resolution.conflictId);
      return [...filtered, resolution];
    });
  };

  const handleConfirmMerge = async () => {
    if (!activeMergeBranchId || !userStrategy.trim()) return;

    setIsMerging(true);
    try {
      const newVersion = await historyService.mergeVersionWithStrategy(
        activeMergeBranchId,
        {
          userStrategyDescription: userStrategy,
          conflictResolutions,
        }
      );
      if (newVersion) {
        loadVersions();
        onNavigate('preview', newVersion.id);
        // Reset state
        setActiveMergeBranchId(null);
        setUserStrategy('');
        setConflictResolutions([]);
      }
    } catch (error) {
      console.error('Merge failed:', error);
      alert('Merge failed, please try again');
    } finally {
      setIsMerging(false);
    }
  };

  const handleMergeVersion = async (versionId: string) => {
    try {
      const newVersion = await historyService.mergeVersion(versionId);
      if (newVersion) {
        loadVersions();
        onNavigate('preview', newVersion.id);
      }
    } catch (error) {
      console.error('Merge failed:', error);
      alert('Merge failed, please try again');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-[3vh] px-[4vw] pb-tabbar-safe">
      <div className="w-[90vw] max-w-6xl h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-400 text-sm">{totalVersions} versions</span>
        </div>

        {totalVersions === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-xl">No versions yet</p>
              <p className="text-sm mt-2">Versions are automatically saved after game generation</p>
              <button
                onClick={() => onNavigate('home')}
                className="mt-6 px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 font-semibold text-white hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-300"
              >
                Start Creating
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Left: version tree - React Flow 画布 */}
            <div className="flex-1">
              <GitTreeLayout
                versionTree={versionTree}
                currentVersionId={currentVersionId}
                selectedVersionId={selectedVersion?.id || null}
                deleteConfirmId={deleteConfirmId}
                onSelect={setSelectedVersion}
                onLoad={handleLoadVersion}
                onDelete={handleDeleteVersion}
                onMerge={handleMergeVersion}
              />
            </div>

            {/* Right: version details */}
            <div className="w-80 bg-gray-800/50 rounded-xl p-4 border border-gray-700 overflow-y-auto">
              <h3 className="text-white font-bold mb-4">Version Details</h3>
              {(() => {
                const displayVersion = selectedVersion || currentVersion;
                if (!displayVersion) return null;
                return (
                  <>
                    <div className="space-y-3 mb-4">
                      <div>
                        <span className="text-gray-500 text-xs">Version ID</span>
                        <div className="mt-1 p-2 bg-black/30 rounded-lg">
                          <p className="text-white text-sm font-mono">{displayVersion.id}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Created</span>
                        <div className="mt-1 p-2 bg-black/30 rounded-lg">
                          <p className="text-white text-sm">{new Date(displayVersion.timestamp).toLocaleString('en-US')}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Camera Mode</span>
                        <div className="mt-1 p-2 bg-black/30 rounded-lg">
                          <p className="text-white text-sm">{displayVersion.code?.gameConfig?.cameraMode || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Physics Mode</span>
                        <div className="mt-1 p-2 bg-black/30 rounded-lg">
                          <p className="text-white text-sm">{displayVersion.code?.gameConfig?.physicsMode || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Description</span>
                        <div className="mt-1 p-2 bg-black/30 rounded-lg">
                          <p className="text-white text-sm">{displayVersion.caption || 'No description'}</p>
                        </div>
                      </div>
                    </div >
                    <div className="mb-4">
                      <span className="text-gray-500 text-xs">Map Info</span>
                      <div className="mt-1 p-2 bg-black/30 rounded-lg">
                        <p className="text-white text-sm">Size: {getMapSizeDescription(displayVersion.mapData)}</p>
                      </div>
                    </div>
                    <div className="mb-4">
                      <span className="text-gray-500 text-xs">Code Stats</span>
                      <div className="mt-1 p-2 bg-black/30 rounded-lg">
                        <p className="text-white text-sm">{countConfigFields(displayVersion.code)} entities</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Code Preview</span>
                      <pre className="mt-1 p-2 bg-black/50 rounded-lg text-[10px] text-gray-300 overflow-x-auto max-h-40 overflow-y-auto">
                        {JSON.stringify(displayVersion.code, null, 2) || 'No code'}
                      </pre>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => handleLoadVersion(displayVersion)}
                        className="w-full py-2 rounded-lg text-sm bg-blue-500/20 hover:bg-blue-500/40 font-semibold text-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300"
                      >
                        Load This Version
                      </button>
                    </div>
                    {selectedVersion && historyService.isBranchVersion(selectedVersion.id) && (
                      <div className="mt-2">
                        {/* Show preview panel if active */}
                        {activeMergeBranchId === selectedVersion.id ? (
                          <MergePreviewPanel
                            preview={mergePreviews.get(selectedVersion.id) || {
                              branchVersionId: selectedVersion.id,
                              mainVersionId: historyService.getMainChainLatestId() || '',
                              llmDifferenceSummary: '',
                              conflicts: [],
                              autoMerged: [],
                              isLoading: !mergePreviews.has(selectedVersion.id),
                            }}
                            userStrategy={userStrategy}
                            conflictResolutions={conflictResolutions}
                            onStrategyChange={setUserStrategy}
                            onResolutionChange={handleResolutionChange}
                            onConfirmMerge={handleConfirmMerge}
                            onCancel={handleCancelMerge}
                            isMerging={isMerging}
                          />
                        ) : (
                          /* Preview Merge Button */
                          <button
                            onClick={() => handlePreviewMerge(selectedVersion.id)}
                            className="w-full py-2 rounded-lg text-sm bg-green-500/20 hover:bg-green-500/40 text-green-400 transition-all duration-300"
                          >
                            Preview Merge
                          </button>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div >
  );
}
