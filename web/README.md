# 2D Game Web - LLM驱动的游戏生成平台

基于LLM的2D游戏快速原型生成平台，支持从自然语言描述到可玩游戏的完整生成流程。

## 项目简介
这是一个将Python/Pygame游戏框架迁移到Web平台的项目，使用React + TypeScript + excalibur构建。核心功能包括：

1. **地图生成**: 根据提示词和样例地图，使用LLM生成游戏地图
2. **代码生成**: 根据游戏规则和地图，生成游戏规则结构（碰撞逻辑+元素技能+ai逻辑）
3. **自动验证**: 静态检查 + 运行时验证，确保生成代码的正确性
4. **自动修复**: 验证失败时自动修复代码
5. **版本控制**: 基于localStorage的版本管理，支持自动保存和回退

## 技术栈
- **前端框架**: React 19 + TypeScript + Vite
- **样式**: TailwindCSS v3
- **游戏引擎**: excalibur
- **架构**: ECS (Entity-Component-System)

## 快速开始
```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

## 环境配置

在项目根目录创建 `.env` 文件：

```env
VITE_OPENAI_API_KEY=your_api_key_here
VITE_OPENAI_BASE_URL=https://api.deerapi.com/v1
```

## 项目结构
```
src/
├── pages/              # 页面组件
│   ├── HomePage.tsx    # 主页 - 输入游戏描述
│   ├── PreviewPage.tsx # 游戏预览页 - 运行和测试游戏
│   ├── HistoryPage.tsx # 历史记录页 - 查看和管理游戏版本
│   └── SettingsPage.tsx # 设置页
├── components/         # UI组件
│   ├── TabBar.tsx      # 底部导航栏
│   ├── GameCanvas.tsx  # 游戏画布组件 - Phaser容器
│   └── VirtualGamepad.tsx # 虚拟手柄 - 移动端控制器
src/game/
│
├── core/                           # ========== 核心层 ==========
│   │
│   ├── GameEngine.ts               # [核心] 引擎入口
│   │   # - 单例模式
│   │   # - start/stop/loadGame
│   │   # - 管理所有 Manager (Input, Mode, Physics, Rule)
│   │   # - [新增] spawnProjectile() 供 API 调用
│   │
│   ├── GameModeManager.ts          # [模式] 物理与摄像机配置
│   │   # - 处理 Topdown vs Platformer 重力
│   │   # - 处理 Camera 跟随逻辑
│   │
│   └── types.ts                    # [类型] 数据定义
│       # - MapData, GameRules, EntityConfig, CollisionRule
│
├── loader/                         # ========== 加载层 ==========
│   │
│   ├── MapLoader.ts                # [解析] 地图加载器
│   │   # - 解析 JSON 地图
│   │   # - 调用 Factory 生成初始实体
│   │
│   └── EntityFactory.ts            # [工厂] 实体生产线
│       # - createCharacter / createProp / createTerrain
│       # - [新增] createProjectile (动态生成子弹)
│       # - [新增] 集成 PhysicsManager 设置碰撞组
│
├── runtime/                        # ========== 运行时 ==========
│   │
│   ├── InputManager.ts             # [输入] 纯移动端输入
│   │   # - 仅处理 VirtualJoystick + ABXY 按钮
│   │   # - 不再处理键盘事件
│   │
│   ├── PhysicsManager.ts           # [物理] 碰撞矩阵管理
│   │   # - [新增] 定义 CollisionGroups (Player, Enemy, Projectile...)
│   │   # - 设定谁能撞谁 (防止子弹打到自己)
│   │
│   └── RuleExecutor.ts             # [大脑] 规则执行器
│       # - 解析 inputMapping 执行按键动作
│       # - 解析 collisionRules 处理碰撞结果
│       # - [新增] 调用 GameUtils API 控制 AI
│       # - [新增] 暴露 getFactory()
│
├── api/                            # ========== LLM 接口层 (已合并) ==========
│   │
│   └── GameUtils.ts                # [统一接口] 包含以下两部分：
│       # 1. class EntityWrapper: 
│       #    - 封装 Actor，提供 shoot, chase, patrol, damage, die
│       # 2. class GameUtils: 
│       #    - 上帝视角查询: findAll, find, exists, triggerGameOver
│
└── components/
    └── GameCanvas.tsx              # [React] 画布容器
├── services/           # 业务服务
│   ├── LLMClient.ts              # LLM调用客户端
│   ├── PromptBuilder.ts          # Prompt构建器
│   ├── MapGenerationService.ts   # 地图生成服务 (4层Pipeline)
│   ├── GameCodeGenerationService.ts # 代码生成服务
│   ├── GamePrototypeService.ts   # 游戏原型生成服务
│   ├── ValidationService.ts      # 代码验证服务
│   ├── FeedbackIterationService.ts # 反馈迭代服务
│   ├── BackendExportService.ts   # 后端导出服务
│   ├── GameRAG.ts                # RAG检索服务
│   ├── HistoryService.ts         # 历史记录服务
│   └── prompts/         # Prompt模板
│       ├── PromptFragments.ts      # ECS框架API文档
│       ├── CodePromptBuilder.ts    # 代码生成Prompt
│       └── SchemaPromptBuilder.ts  # Schema生成Prompt
├── types/              # TypeScript类型定义
│   ├── MapGeneration.ts  # 地图生成类型
│   └── CodeGeneration.ts # 代码生成类型
└── utils/              # 工具函数
    ├── ColorUtils.ts   # 颜色工具
    ├── Logger.ts       # 日志工具
    └── Constants.ts    # 常量定义
```

## 输入示例
  The player controls a tank in top-down fixed-screen stages, shooting enemies and defending territory.
  The tank can move in four directions and shoot projectiles forward.
  Destructible walls can be shot to create paths or defensive positions.
  All enemy tanks must be defeated to clear each stage.
  The objective is to destroy all enemy tanks and advance through stages.

## 核心功能
### 1. 地图生成 (4层Pipeline)
- **Layer1**: 深度特征分析 - 分析参考地图的元素分布、高频结构和硬约束
- **Layer2**: 蓝图生成 - 根据特征分析生成地图蓝图
- **Layer3**: 具体地图生成 - 生成完整的地图JSON数据
- **Layer4**: 长地图分段 - 对超过26×26的地图进行分段处理

### 2. 游戏代码生成 (3步流程)
- **Generate**: 根据游戏规则和地图生成js代码
- **Validate**: 验证生成的代码（静态检查 + 工厂方法完整性 + 运行时验证）
- **Fix**: 如果验证失败，自动修复代码（最多重试2次）

### 3. ECS游戏架构
- **Entity**: 游戏实体（玩家、敌人、地形等）
- **Component**: 组件（Position, Velocity, Sprite, RigidBody等）
- **System**: 系统（PhysicsSystem, RenderSystem, UserInputSystem等）

### 4. 跨引擎物理抽象
提供统一的物理API，屏蔽底层物理引擎差异：
- `setVelocity()` - 设置速度
- `applyImpulse()` - 施加冲量
- `isGrounded()` - 检测是否着地
- `checkCollision()` - 碰撞检测

### 5. 重力控制接口

框架支持通过 `enableGravity` 配置选项来控制重力是否启用，以适应不同类型的游戏需求。

#### 配置概述

- **enableGravity**: `boolean` - 是否启用物理世界的重力（默认: `false`）
  - `false`: 禁用重力，适用于俯视角游戏（如坦克大战、飞行射击等）
  - `true`: 启用重力，适用于平台跳跃游戏

#### 配置层级

重力控制可以在多个层级进行配置：

```typescript
// 1. GameCanvas.tsx - 组件级配置（推荐）
<GameCanvas
  config={{
    enableGravity: false,  // 俯视角游戏禁用重力
  }}
  onReady={handleGameReady}
/>

// 2. GameScene.ts - 场景级配置
const scene = new GameScene({
  width: 800,
  height: 600,
  enableGravity: false,
  gravity: { x: 0, y: 980 },  // 仅在 enableGravity=true 时生效
});

// 3. GameEngine.ts - 引擎级配置
const engine = new GameEngine({
  width: 800,
  height: 600,
  enableGravity: false,
  gravity: { x: 0, y: 980 },
  pixelsPerMeter: 100,
});
```

#### 使用示例

**俯视角游戏（禁用重力）**：
```typescript
// 坦克大战、飞行射击等游戏不需要重力
const engine = new GameEngine({
  width: 800,
  height: 600,
  enableGravity: false,  // 关键配置
  gravity: { x: 0, y: 980 },
  pixelsPerMeter: 100,
  debugPhysics: false,
});
```

**平台跳跃游戏（启用重力）**：
```typescript
// 平台跳跃游戏需要重力让角色下落
const engine = new GameEngine({
  width: 800,
  height: 600,
  enableGravity: true,   // 关键配置
  gravity: { x: 0, y: 980 },  // 重力加速度 (像素/秒²)
  pixelsPerMeter: 100,
  debugPhysics: false,
});
```

#### 注意事项

1. **实体级别的重力控制**: 即使全局启用了重力，也可以通过 `gravityScale` 属性为单个实体控制重力影响：
   ```typescript
   // MapParser.ts 中的实体创建示例
   world.addComponent(eid, 'RigidBody', {
     bodyType: 'dynamic',
     gravityScale: 0,  // 该实体不受重力影响
   });
   ```

2. **默认值**: 为了适应俯视角游戏，`enableGravity` 的默认值为 `false`

3. **相关类型定义**:
   - `src/game/physics/PhysicsTypes.ts` - `PhysicsWorldConfig` 接口
   - `src/game/scenes/GameScene.ts` - `GameSceneConfig` 接口

### 6. 版本控制系统
基于localStorage的轻量级版本管理系统：
- **自动保存**: 代码生成成功后自动创建版本快照
- **版本回退**: 点击历史版本卡片即可回退，自动删除后续版本
- **单线历史**: 简洁的单线版本记录，不考虑分支
- **横向滚动**: 卡片式UI，支持横向滚动查看所有版本

**存储结构**:
```typescript
// localStorage key: 'game-version-history'
{
  versions: [
    {
      id: "1736668800000",           // 时间戳ID
      caption: "玩家可以移动和射击...",  // 版本描述
      timestamp: 1736668800000,       // 创建时间
      code: "export class...",        // 生成的代码
      mapData: { ... }                // 地图数据
    }
  ],
  currentVersionId: "1736668800000"  // 当前版本
}
```

**使用示例**:
```typescript
import historyService from '@/services/HistoryService';

// 保存版本（自动调用）
historyService.saveVersion(code, mapData, '添加敌人AI');

// 获取所有版本
const versions = historyService.getVersions();

// 回退到指定版本
historyService.revertToVersion(versionId);
```

## 使用说明

### 生成游戏原型
```typescript
import { gamePrototypeService } from '@/services/GamePrototypeService';

// 一键生成游戏原型（包含地图和代码）
const result = await gamePrototypeService.generateGame({
  description: '生成一个坦克大战游戏，玩家可以移动和射击敌人',
  width: 18,
  height: 18,
});

if (result.success) {
  console.log('游戏生成成功:', result);
  // result.mapData - 地图数据
  // result.code - 游戏代码
  // result.schema - Schema定义
}
```

### 生成地图
```typescript
import { mapGenerationService } from '@/services/MapGenerationService';

const result = await mapGenerationService.generateMap({
  prompt: '生成一个坦克大战风格的地图',
  referenceMap: referenceMapData,
  width: 18,
  height: 18,
});

if (result.success) {
  console.log('地图生成成功:', result.mapData);
}
```

### 生成游戏代码
```typescript
import { gameCodeGenerationService } from '@/services/GameCodeGenerationService';

const result = await gameCodeGenerationService.generateGameCode({
  rules: '玩家可以移动和射击，敌人会自动巡逻...',
  mapData: generatedMapData,
  maxRetries: 2,
});

if (result.success) {
  console.log('代码生成成功:', result.code);
}
```

### 反馈迭代
```typescript
import { feedbackIterationService } from '@/services/FeedbackIterationService';

// 根据用户反馈迭代游戏
const result = await feedbackIterationService.iterateWithFeedback({
  feedback: '让敌人移动速度更快，增加更多障碍物',
  currentVersion: currentGameVersion,
  onStepUpdate: (status) => {
    console.log(`${status.step}: ${status.message}`);
  }
});

if (result.success) {
  console.log('新版本ID:', result.newVersionId);
}
```

## 开发计划
- [x] ECS核心系统
- [x] Matter.js物理引擎集成
- [x] Phaser场景集成
- [x] LLM客户端和Prompt构建器
- [x] 地图生成服务（4层Pipeline）
- [x] 代码生成服务（3步流程）
- [x] 代码验证服务
- [x] localStorage版本控制系统
- [x] 版本历史UI（横向滚动卡片）
- [x] 游戏原型生成服务
- [x] 反馈迭代服务
- [x] 虚拟手柄UI
- [x] 重力控制接口
- [x] 坐标系统修复
- [ ] 更多游戏模板
- [ ] 性能优化
