/**
 * 示例版本数据 - 用于首次访问时初始化 HistoryPage
 *
 * 用户只需填写以下字段：
 * - caption: 版本描述
 * - code: GameRules 游戏规则
 * - mapData: 地图数据
 * - feedbackText: 反馈文本（可选）
 * - metadata: 元数据（可选，#6 合并节点需要填写 mergedFrom）
 *
 * ID 和父子关系已自动处理，无需修改
 */

import type { GameVersion } from '../types';
import type { GameRules } from '../game/core/types';

// ============================================================
// 用户填写区域 - 编辑每个版本的内容
// ============================================================

/**
 * #0 根节点
 */
export const SAMPLE_V0_CONTENT: Omit<GameVersion, 'id' | 'timestamp' | 'parentVersionId' | 'iterationCount'> = {
  caption: "The player controls a little raccoon in the level. They need to jump between platforms at different heights, and sometimes make a few jumps in a row or use special terrain to get through tricky areas. There are different enemies and obstacles in the level. If the raccoon runs into an enemy, they lose. There are also traps, so the player needs to be careful and avoid them with precise movement.",
  code: {
    gameConfig: {
      physicsMode: "platformer",
      cameraMode: "auto-scroll",
    },
    entityConfig: {
      "X": {
        "name": "space",
        "description": "empty area, all entities can pass through freely, no collision detection",
        "color": "#000000",
        "collision": "prevent",
        "layer": "terrain"
      },
      "G": {
        "name": "ground",
        "description": "solid terrain, blocks player/enemy movement, player can stand and walk on top, defines level boundaries and platforms",
        "color": "#4A7023",
        "collision": "fixed",
        "layer": "terrain"
      },
      "P": {
        "name": "platform",
        "description": "thin solid surface at various heights, player can stand and walk on top, blocks movement from above only, used to create multi-level jumping paths",
        "color": "#8B7355",
        "collision": "fixed",
        "layer": "terrain"
      },
      "T": {
        "name": "trap_spike",
        "description": "environmental hazard, instantly kills player on contact, placed on ground or walls, player must jump over or avoid with precise movement, blocks ground movement",
        "color": "#8B0000",
        "collision": "passive",
        "layer": "terrain"
      },
      "M": {
        "name": "moving_platform",
        "description": "dynamic solid surface, moves horizontally between two points, player can stand and ride on top, used to cross gaps that are too wide to jump",
        "color": "#4682B4",
        "collision": "fixed",
        "layer": "interaction",
        "category": "prop",
        "default_size": {
          "width": 1,
          "height": 1
        }
      },
      "o": {
        "name": "acorn",
        "description": "collectible item, player can pass through and collect on contact, adds score, no collision with enemies",
        "color": "#DAA520",
        "collision": "passive",
        "layer": "terrain"
      },
      "E": {
        "name": "enemy",
        "description": "hostile creature, moves horizontally and reverses on collision with obstacles, kills player on contact, can be defeated by player jumping on top",
        "color": "#FF0000",
        "collision": "active",
        "layer": "interaction",
        "category": "character",
        "default_size": {
          "width": 1,
          "height": 1
        }
      },
      "F": {
        "name": "flying_enemy",
        "description": "airborne hostile creature, moves in a wave pattern horizontally, kills player on contact, can be defeated by player jumping on top, does not collide with terrain",
        "color": "#FF4500",
        "collision": "active",
        "layer": "interaction",
        "category": "character",
        "default_size": {
          "width": 1,
          "height": 1
        }
      },
      "R": {
        "name": "player",
        "description": "player controlled raccoon character, moves left/right and jumps, affected by gravity, can perform consecutive jumps between platforms, defeats enemies by jumping on top, collects acorns on contact",
        "color": "#708090",
        "collision": "active",
        "layer": "interaction",
        "category": "character",
        "default_size": {
          "width": 1,
          "height": 1
        }
      }
    },
    skillRules: [
      {
        "entity": "player",
        "skills": [
          "jump"
        ]
      },
      {
        "entity": "moving_platform",
        "skills": [
          "moving_platform_h"
        ]
      }
    ],
    aiRules: [
      {
        "entity": "enemy",
        "movementAI": "patrol"
      },
      {
        "entity": "flying_enemy",
        "movementAI": "patrol"
      }
    ],
    collisionRules: [
      {
        "a": "player",
        "b": "acorn",
        "action": [
          "destroy_b"
        ]
      },
      {
        "a": "player",
        "b": "enemy",
        "action": [
          "destroy_a"
        ]
      },
      {
        "a": "player",
        "b": "flying_enemy",
        "action": [
          "destroy_a"
        ]
      },
      {
        "a": "player",
        "b": "trap_spike",
        "action": [
          "destroy_a"
        ]
      }
    ],
    inputMapping: { "A": "jump", },
  } as GameRules,

  mapData: {
    "terrain": {
      "grid": [
        { "y": 0, "row": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" },
        { "y": 1, "row": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" },
        { "y": 2, "row": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" },
        { "y": 3, "row": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXoooXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" },
        { "y": 4, "row": "XXXXXXXXXXXXXXXXXoooXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXoXXXXXXXXXXXXXXXXXXXXXXPPPPPXXXXXXXXXXXXXXXXXXXXXXXXXXoooXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" },
        { "y": 5, "row": "XXXXXXXXXXXXXXXXXPPPPPPXXXXXXXXXXXXXXXXXXXXXXXXXPPPPXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXPPPPPXXXXXXXXXXXXXXXXXXXXXXXXPPPPPXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" },
        { "y": 6, "row": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXoXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" },
        { "y": 7, "row": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXPPPPPXXXXXXXXXXXXXXXXXXXXXXXXXXXXXPPPPPXXXXXXXXXXXXXXXXXXXXXXXXXPPPPXXXXXXXXXXXXPPPPPXXXXXXXXXXXoXXXXXXXXXXXXXXXXXXXXXXXXXXX" },
        { "y": 8, "row": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXPPPPXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXoXXXXXXXXXXXXXXXXXXXXPPPPPXXXXXXXXXXXXXXXXXXXXXXXX" },
        { "y": 9, "row": "XXXXXXXXXXPPPPPXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXoXXXXXXX" },
        { "y": 10, "row": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXTTTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXPPPPPPXXXXXXXXXXX" },
        { "y": 11, "row": "GGGGGGGGGGGGGGGGGGGGXXXGGGGGGGGGGGGGGGGGXXXXXXGGGGGGGGGGGGGGGGXXXXXXGGGGGGGGXXXXGGGGGGGGGGGGGGGGGGGGGGGGXXGGGGGGGGGGGGTTTTTTGGGGGGGXXXXGGGGGGGGXXXXXXXXGGGG" },
        { "y": 12, "row": "GGGGGGGGGGGGGGGGGGGGXXXGGGGGGGGGGGGGGGGGXXXXXXGGGGGGGGGGGGGGGGXXXXXXGGGGGGGGXXXXGGGGGGGGGGGGGGGGGGGGGGGGXXGGGGGGGGGGGGGGGGGGGGGGGGGGXXXXGGGGGGGGXXXXXXXXGGG" },
        { "y": 13, "row": "GGGGGGGGGGGGGGGGGGGGXXXGGGGGGGGGGGGGGGGGXXXXXXGGGGGGGGGGGGGGGGXXXXXXGGGGGGGGXXXXGGGGGGGGGGGGGGGGGGGGGGGGXXGGGGGGGGGGGGGGGGGGGGGGGGGGXXXXGGGGGGGGXXXXXXXXGGG" }
      ]
    },
    "interaction": [
      { "id": "player", "element": "R", "anchor": { "x": 3, "y": 10 }, "size": { "width": 1, "height": 1 } },
      { "id": "enemy", "element": "E", "anchor": { "x": 25, "y": 10 }, "size": { "width": 1, "height": 1 } },
      { "id": "enemy", "element": "E", "anchor": { "x": 42, "y": 10 }, "size": { "width": 1, "height": 1 } },
      { "id": "enemy", "element": "E", "anchor": { "x": 60, "y": 10 }, "size": { "width": 1, "height": 1 } },
      { "id": "flying_enemy", "element": "F", "anchor": { "x": 55, "y": 5 }, "size": { "width": 1, "height": 1 } },
      { "id": "enemy", "element": "E", "anchor": { "x": 75, "y": 7 }, "size": { "width": 1, "height": 1 } },
      { "id": "enemy", "element": "E", "anchor": { "x": 95, "y": 10 }, "size": { "width": 1, "height": 1 } },
      { "id": "flying_enemy", "element": "F", "anchor": { "x": 105, "y": 4 }, "size": { "width": 1, "height": 1 } },
      { "id": "enemy", "element": "E", "anchor": { "x": 120, "y": 10 }, "size": { "width": 1, "height": 1 } },
      { "id": "enemy", "element": "E", "anchor": { "x": 121, "y": 10 }, "size": { "width": 1, "height": 1 } },
      { "id": "moving_platform", "element": "M", "anchor": { "x": 136, "y": 7 }, "size": { "width": 1, "height": 1 } },
    ]
  },

  schema: {
    meta: {
      map_size: { width: 155, height: 14 },
    },
    mapping: {
      "X": {
        "name": "space",
        "description": "empty area, all entities can pass through freely, no collision detection",
        "color": "#000000",
        "collision": "prevent",
        "layer": "terrain"
      },
      "G": {
        "name": "ground",
        "description": "solid terrain, blocks player/enemy movement, player can stand and walk on top, defines level boundaries and platforms",
        "color": "#4A7023",
        "collision": "fixed",
        "layer": "terrain"
      },
      "P": {
        "name": "platform",
        "description": "thin solid surface at various heights, player can stand and walk on top, blocks movement from above only, used to create multi-level jumping paths",
        "color": "#8B7355",
        "collision": "fixed",
        "layer": "terrain"
      },
      "T": {
        "name": "trap_spike",
        "description": "environmental hazard, instantly kills player on contact, placed on ground or walls, player must jump over or avoid with precise movement, blocks ground movement",
        "color": "#8B0000",
        "collision": "passive",
        "layer": "terrain"
      },
      "M": {
        "name": "moving_platform",
        "description": "dynamic solid surface, moves horizontally between two points, player can stand and ride on top, used to cross gaps that are too wide to jump",
        "color": "#4682B4",
        "collision": "fixed",
        "layer": "interaction",
        "category": "prop",
        "default_size": {
          "width": 1,
          "height": 1
        }
      },
      "o": {
        "name": "acorn",
        "description": "collectible item, player can pass through and collect on contact, adds score, no collision with enemies",
        "color": "#DAA520",
        "collision": "passive",
        "layer": "terrain"
      },
      "E": {
        "name": "enemy",
        "description": "hostile creature, moves horizontally and reverses on collision with obstacles, kills player on contact, can be defeated by player jumping on top",
        "color": "#FF0000",
        "collision": "active",
        "layer": "interaction",
        "category": "character",
        "default_size": {
          "width": 1,
          "height": 1
        }
      },
      "F": {
        "name": "flying_enemy",
        "description": "airborne hostile creature, moves in a wave pattern horizontally, kills player on contact, can be defeated by player jumping on top, does not collide with terrain",
        "color": "#FF4500",
        "collision": "active",
        "layer": "interaction",
        "category": "character",
        "default_size": {
          "width": 1,
          "height": 1
        }
      },
      "R": {
        "name": "player",
        "description": "player controlled raccoon character, moves left/right and jumps, affected by gravity, can perform consecutive jumps between platforms, defeats enemies by jumping on top, collects acorns on contact",
        "color": "#708090",
        "collision": "active",
        "layer": "interaction",
        "category": "character",
        "default_size": {
          "width": 1,
          "height": 1
        }
      }
    },
  },

  feedbackText: 'This is a platformer game with an auto-scrolling camera. The player controls a raccoon that moves and jumps through the level to explore the environment and complete the objective. The level contains platforms at different heights, walls, and other terrain structures that affect the raccoon’s movement and jumping paths. Sometimes the player needs to make consecutive jumps or use special terrain to get through more complex areas. There are also various enemies and obstacles in the level. If the raccoon touches an enemy, they lose, and the player also needs to carefully avoid different traps.',
  // metadata: {},
};

/**
 * #1 根节点
 * 起始版本，没有父节点
 */
export const SAMPLE_V1_CONTENT: Omit<GameVersion, 'id' | 'timestamp' | 'parentVersionId' | 'iterationCount'> = {
  caption: "I’d like the game to include a player-controlled raccoon. The player can move and jump freely around the level to explore the environment. Fruits are scattered throughout the scene, and whenever the raccoon touches one, it collects it. The map can also include different kinds of terrain and obstacles, like platforms, walls, or other environmental elements. These structures affect how the raccoon moves and jumps. The player needs to move around the level, avoid obstacles, and collect fruits to complete the objective.",
  code: {
    gameConfig: {
      physicsMode: "platformer",
      cameraMode: "fixed",
    },
    entityConfig: {
      "player": {
        "speed": 180,
        "color": "#808080",
        "width": 0.8,
        "height": 0.8
      },
      "fruit": {
        "color": "#FFD700",
        "width": 0.6,
        "height": 0.6
      },
      "brick": {
        "color": "#8B4513",
        "width": 1,
        "height": 1
      },
      "platform": {
        "color": "#556B2F",
        "width": 1,
        "height": 0.5
      }
    },
    skillRules: [
      {
        "entity": "player",
        "skills": [
          "jump"
        ]
      }
    ],
    collisionRules: [{
      "a": "player",
      "b": "fruit",
      "action": [
        "destroy_b"
      ]
    }],
    inputMapping: {
      "A": "jump",
    },
  } as GameRules,

  mapData: {
    "terrain": {
      "grid": [
        {
          "y": 0,
          "row": "BBBBBBBBBBBBBBBB"
        },
        {
          "y": 1,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 2,
          "row": "BXXXBBBBXXXXXXXB"
        },
        {
          "y": 3,
          "row": "BX--BXXXXX---XXB"
        },
        {
          "y": 4,
          "row": "BXXXBXBBBBXXXXXB"
        },
        {
          "y": 5,
          "row": "BXXXBXBXXBXXXXXB"
        },
        {
          "y": 6,
          "row": "BXXXXBXXBXXXXBBB"
        },
        {
          "y": 7,
          "row": "BBBBBXXXXXXBBBBB"
        },
        {
          "y": 8,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 9,
          "row": "B-XXBBX-XXBBXX-B"
        },
        {
          "y": 10,
          "row": "BXXXBXXXXXBXXXXB"
        },
        {
          "y": 11,
          "row": "BXXXBXXXXXBXXXXB"
        },
        {
          "y": 12,
          "row": "BBBBXXX--XBBBBBB"
        },
        {
          "y": 13,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 14,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 15,
          "row": "BBBBBBBBBBBBBBBB"
        }
      ]
    },
    "interaction": [
      {
        "id": "player",
        "element": "P",
        "anchor": {
          "x": 4,
          "y": 14
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 2,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 7,
          "y": 8
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 6
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 6,
          "y": 1
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 3,
          "y": 6
        },
        "size": {
          "width": 1,
          "height": 1
        }
      }
    ]
  },

  schema: {
    meta: {
      map_size: { width: 16, height: 16 },
    },
    mapping: {
      "X": {
        "name": "space",
        "description": "empty area, player can pass through freely, no collision detection",
        "color": "#000000",
        "layer": "terrain",
        "collision": "prevent"
      },
      "B": {
        "name": "brick",
        "description": "solid block, blocks player movement, player can stand and walk on top",
        "color": "#8B4513",
        "layer": "terrain",
        "collision": "fixed"
      },
      "-": {
        "name": "platform",
        "description": "one-way platform, player can stand on top and jump up through from below",
        "color": "#556B2F",
        "layer": "terrain",
        "collision": "fixed"
      },
      "P": {
        "name": "player",
        "description": "player controlled raccoon, moves left/right and jumps, collects fruits, affected by gravity, collides with brick/platform",
        "color": "#808080",
        "layer": "interaction",
        "category": "character",
        "collision": "active",
        "default_size": {
          "width": 1,
          "height": 1
        }
      },
      "F": {
        "name": "fruit",
        "description": "collectible prop, player collects on contact to complete objective, triggers collection event",
        "color": "#FFD700",
        "layer": "interaction",
        "category": "prop",
        "collision": "passive",
        "default_size": {
          "width": 1,
          "height": 1
        }
      }
    },
  },

  feedbackText: 'This is a platformer game with a fixed camera view. The player controls a raccoon that can move and jump through the level to explore the environment and complete the level objective. Fruits are scattered throughout the level and can be collected when the raccoon touches them. The map contains various types of terrain and obstacles, such as platforms at different heights, walls, and other environmental structures. These elements influence the raccoon’s movement paths and jumping routes. Players must move and jump carefully between platforms, avoid obstacles, and collect as many fruits as possible in order to complete the level.',
  // metadata: {},
};

/**
 * #2 主链更新
 * 父节点: #1
 */
export const SAMPLE_V2_CONTENT: Omit<GameVersion, 'id' | 'timestamp' | 'parentVersionId' | 'iterationCount'> = {
  caption: 'I’d also like to add more platforms to the map.',
  code: {
    gameConfig: {
      physicsMode: "platformer",
      cameraMode: "fixed",
    },
    entityConfig: {
      "player": {
        "speed": 180,
        "color": "#808080",
        "width": 0.8,
        "height": 0.8
      },
      "fruit": {
        "color": "#FFD700",
        "width": 0.6,
        "height": 0.6
      },
      "brick": {
        "color": "#8B4513",
        "width": 1,
        "height": 1
      },
      "platform": {
        "color": "#556B2F",
        "width": 1,
        "height": 0.5
      }
    },
    skillRules: [
      {
        "entity": "player",
        "skills": [
          "jump"
        ]
      }
    ],
    collisionRules: [{
      "a": "player",
      "b": "fruit",
      "action": [
        "destroy_b"
      ]
    }],
    inputMapping: {
      "A": "jump",
    },
  } as GameRules,

  mapData: {
    "terrain": {
      "grid": [
        {
          "y": 0,
          "row": "BBBBBBBBBBBBBBBB"
        },
        {
          "y": 1,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 2,
          "row": "BXXXBBBB----XXBB"
        },
        {
          "y": 3,
          "row": "BX--BXXXXX---XXB"
        },
        {
          "y": 4,
          "row": "BXXXBXBBBBXXXXXB"
        },
        {
          "y": 5,
          "row": "BXXXBXB--BXXXXXB"
        },
        {
          "y": 6,
          "row": "BXXXXBXXBXXXXBBB"
        },
        {
          "y": 7,
          "row": "BBBBBXXXXXXBBBBB"
        },
        {
          "y": 8,
          "row": "B-----XXXX-----B"
        },
        {
          "y": 9,
          "row": "B-XXBBX-XXBBXX-B"
        },
        {
          "y": 10,
          "row": "BXXXBX----BXXXXB"
        },
        {
          "y": 11,
          "row": "BXXXB--XX--BXXXX"
        },
        {
          "y": 12,
          "row": "BBBBXXX--XBBBBBB"
        },
        {
          "y": 13,
          "row": "B----XXXXXX----B"
        },
        {
          "y": 14,
          "row": "B--XXXXXXXXXX--B"
        },
        {
          "y": 15,
          "row": "BBBBBBBBBBBBBBBB"
        }
      ]
    },
    "interaction": [
      {
        "id": "player",
        "element": "P",
        "anchor": {
          "x": 4,
          "y": 14
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 2,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 7,
          "y": 8
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 6
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 6,
          "y": 1
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 3,
          "y": 6
        },
        "size": {
          "width": 1,
          "height": 1
        }
      }
    ]
  },

  schema: {
    meta: {
      map_size: { width: 16, height: 16 },
    },
    mapping: {
      "X": {
        "name": "space",
        "description": "empty area, player can pass through freely, no collision detection",
        "color": "#000000",
        "collision": "prevent",
        "layer": "terrain"
      },
      "B": {
        "name": "brick",
        "description": "solid block, blocks player movement, player can stand and walk on top",
        "color": "#8B4513",
        "collision": "fixed",
        "layer": "terrain"
      },
      "-": {
        "name": "platform",
        "description": "one-way platform, player can stand on top and jump up through from below",
        "color": "#556B2F",
        "collision": "fixed",
        "layer": "terrain"
      },
      "P": {
        "name": "player",
        "description": "player controlled raccoon, moves left/right and jumps, collects fruits, affected by gravity, collides with brick/platform",
        "color": "#808080",
        "collision": "active",
        "layer": "interaction",
        "category": "character"
      },
      "F": {
        "name": "fruit",
        "description": "collectible prop, player collects on contact to complete objective, triggers collection event",
        "color": "#FFD700",
        "collision": "passive",
        "layer": "interaction",
        "category": "prop"
      },
      "f": {
        "name": "orange",
        "description": "collectible prop, player collects on contact to complete objective, triggers collection event",
        "color": "#e34a1b",
        "collision": "passive",
        "layer": "interaction",
        "category": "prop"
      }
    },
  },

  //feedbackText: 'This is a platformer game with a fixed camera view. The player controls a raccoon that can move and jump through the level to explore the environment and complete the level objective. Fruits are scattered throughout the level and can be collected when the raccoon touches them. The map contains various types of terrain and obstacles, such as platforms at different heights, walls, and other environmental structures. These elements influence the raccoon’s movement paths and jumping routes. Players must move and jump carefully between platforms, avoid obstacles, and collect as many fruits as possible in order to complete the level.',
  // metadata: {},
};

/**
 * #4 分支 A
 * 父节点: #2
 */
export const SAMPLE_V4_CONTENT: Omit<GameVersion, 'id' | 'timestamp' | 'parentVersionId' | 'iterationCount'> = {
  caption: 'The map should have fewer platforms so the raccoon can move through the level more easily. The game should also include some hostile enemies, and if the raccoon runs into one of them, the player immediately loses.',
  code: {
    gameConfig: {
      physicsMode: "platformer",
      cameraMode: "fixed",
    },
    entityConfig: {
      "player": {
        "speed": 180,
        "color": "#808080",
        "width": 0.8,
        "height": 0.8
      },
      "enemy": {
        "speed": 20,
        "color": "#e73f32",
        "width": 0.8,
        "height": 0.8
      },
      "fruit": {
        "color": "#FFD700",
        "width": 0.6,
        "height": 0.6
      },
      "brick": {
        "color": "#8B4513",
        "width": 1,
        "height": 1
      },
      "platform": {
        "color": "#556B2F",
        "width": 1,
        "height": 0.5
      }
    },
    skillRules: [
      {
        "entity": "player",
        "skills": [
          "jump"
        ]
      }
    ],
    aiRules: [
      {
        "entity": "enemy",
        "movementAI": "patrol"
      }
    ],
    collisionRules: [{
      "a": "player",
      "b": "fruit",
      "action": [
        "destroy_b"
      ]
    },
    {
      "a": "player",
      "b": "enemy",
      "action": [
        "destroy_a"
      ]
    }],
    inputMapping: {
      "A": "jump",
    },
  } as GameRules,

  mapData: {
    "terrain": {
      "grid": [
        {
          "y": 0,
          "row": "BBBBBBBBBBBBBBBB"
        },
        {
          "y": 1,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 2,
          "row": "BXXXBBBBXXXXXXBB"
        },
        {
          "y": 3,
          "row": "BXXXBXXXXXXXXXXB"
        },
        {
          "y": 4,
          "row": "BXXXBXBBBBXXXXXB"
        },
        {
          "y": 5,
          "row": "BXXXBXBXXBXXXXXB"
        },
        {
          "y": 6,
          "row": "BXXXXBXXBXXXXBBB"
        },
        {
          "y": 7,
          "row": "BBBBBXXXXXXBBBBB"
        },
        {
          "y": 8,
          "row": "BXXXXX-XX------B"
        },
        {
          "y": 9,
          "row": "BXXXXXXXXXBBXXXB"
        },
        {
          "y": 10,
          "row": "BXXXBXBXXBXXXXXB"
        },
        {
          "y": 11,
          "row": "BXXXBXXXXXXBXXXB"
        },
        {
          "y": 12,
          "row": "BBBBXXX--XBBBBBB"
        },
        {
          "y": 13,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 14,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 15,
          "row": "BBBBBBBBBBBBBBBB"
        }
      ]
    },
    "interaction": [
      {
        "id": "player",
        "element": "P",
        "anchor": {
          "x": 2,
          "y": 14
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 2,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 6
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 3,
          "y": 6
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "enemy",
        "element": "f",
        "anchor": {
          "x": 8,
          "y": 14
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "enemy",
        "element": "f",
        "anchor": {
          "x": 3,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "enemy",
        "element": "f",
        "anchor": {
          "x": 14,
          "y": 5
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 6,
          "y": 7
        },
        "size": {
          "width": 1,
          "height": 1
        }
      }
    ]
  },

  schema: {
    meta: {
      map_size: { width: 16, height: 16 },
    },
    mapping: {
      "X": {
        "name": "space",
        "description": "empty area, player can pass through freely, no collision detection",
        "color": "#000000",
        "collision": "prevent",
        "layer": "terrain"
      },
      "B": {
        "name": "brick",
        "description": "solid block, blocks player movement, player can stand and walk on top",
        "color": "#8B4513",
        "collision": "fixed",
        "layer": "terrain"
      },
      "-": {
        "name": "platform",
        "description": "one-way platform, player can stand on top and jump up through from below",
        "color": "#556B2F",
        "collision": "fixed",
        "layer": "terrain"
      },
      "P": {
        "name": "player",
        "description": "player controlled raccoon, moves left/right and jumps, collects fruits, affected by gravity, collides with brick/platform",
        "color": "#808080",
        "collision": "active",
        "layer": "interaction",
        "category": "character"
      },
      "F": {
        "name": "fruit",
        "description": "collectible item, player collects on contact to complete objective, triggers collection event",
        "color": "#FFD700",
        "collision": "passive",
        "layer": "interaction",
        "category": "prop"
      },
      "f": {
        "name": "enemy",
        "description": "hostile enemy, kills player on contact",
        "color": "#e73f32",
        "collision": "active",
        "layer": "interaction",
        "category": "character"
      }
    },
  },

  //feedbackText: 'This is a platformer game with a fixed camera view. The player controls a raccoon that can move and jump through the level to explore the environment and complete the level objective. Fruits are scattered throughout the level and can be collected when the raccoon touches them. The map contains various types of terrain and obstacles, such as platforms at different heights, walls, and other environmental structures. These elements influence the raccoon’s movement paths and jumping routes. Players must move and jump carefully between platforms, avoid obstacles, and collect as many fruits as possible in order to complete the level.',
  // metadata: {},
};

/**
 * #3 分支 B
 * 父节点: #2
 */
export const SAMPLE_V3_CONTENT: Omit<GameVersion, 'id' | 'timestamp' | 'parentVersionId' | 'iterationCount'> = {
  caption: 'The number of platforms should be reduced to make sure the raccoon can move through the level smoothly. There should also be more types of fruits in the game.',
  code: {
    gameConfig: {
      physicsMode: "platformer",
      cameraMode: "fixed",
    },
    entityConfig: {
      "player": {
        "speed": 180,
        "color": "#808080",
        "width": 0.8,
        "height": 0.8
      },
      "fruit": {
        "color": "#FFD700",
        "width": 0.6,
        "height": 0.6
      },
      "orange": {
        "color": "#e34a1b",
        "width": 0.6,
        "height": 0.6
      },
      "brick": {
        "color": "#8B4513",
        "width": 1,
        "height": 1
      },
      "platform": {
        "color": "#556B2F",
        "width": 1,
        "height": 0.5
      }
    },
    skillRules: [
      {
        "entity": "player",
        "skills": [
          "jump"
        ]
      }
    ],
    collisionRules: [{
      "a": "player",
      "b": "fruit",
      "action": [
        "destroy_b"
      ]
    },
    {
      "a": "player",
      "b": "orange",
      "action": [
        "destroy_b"
      ]
    }],
    inputMapping: {
      "A": "jump",
    },
  } as GameRules,

  mapData: {
    "terrain": {
      "grid": [
        {
          "y": 0,
          "row": "BBBBBBBBBBBBBBBB"
        },
        {
          "y": 1,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 2,
          "row": "BXXXBBBBXXXXXXXB"
        },
        {
          "y": 3,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 4,
          "row": "BXXXBXBBBBXXXXXB"
        },
        {
          "y": 5,
          "row": "BXXXBXBXXXXXXXXB"
        },
        {
          "y": 6,
          "row": "BXXXXBXXXXXXXBBB"
        },
        {
          "y": 7,
          "row": "BBBBB--XX--BBBBB"
        },
        {
          "y": 8,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 9,
          "row": "BXXXXBBXXXXBBXXB"
        },
        {
          "y": 10,
          "row": "BXXXBXBXXBXXXXXB"
        },
        {
          "y": 11,
          "row": "BXXXBXXXXXXBXXXX"
        },
        {
          "y": 12,
          "row": "BBBBXXXXXXXXBBBB"
        },
        {
          "y": 13,
          "row": "BXXXXXXXXXBBBXXB"
        },
        {
          "y": 14,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 15,
          "row": "BBBBBBBBBBBBBBBB"
        }
      ]
    },
    "interaction": [
      {
        "id": "player",
        "element": "P",
        "anchor": {
          "x": 2,
          "y": 14
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 6
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 10
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "orange",
        "element": "f",
        "anchor": {
          "x": 2,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "orange",
        "element": "f",
        "anchor": {
          "x": 5,
          "y": 8
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "orange",
        "element": "f",
        "anchor": {
          "x": 14,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 5,
          "y": 1
        },
        "size": {
          "width": 1,
          "height": 1
        }
      }
    ]
  },

  schema: {
    meta: {
      map_size: { width: 16, height: 16 },
    },
    mapping: {
      "X": {
        "name": "space",
        "description": "empty area, player can pass through freely, no collision detection",
        "color": "#000000",
        "collision": "prevent",
        "layer": "terrain"
      },
      "B": {
        "name": "brick",
        "description": "solid block, blocks player movement, player can stand and walk on top",
        "color": "#8B4513",
        "collision": "fixed",
        "layer": "terrain"
      },
      "-": {
        "name": "platform",
        "description": "one-way platform, player can stand on top and jump up through from below",
        "color": "#556B2F",
        "collision": "fixed",
        "layer": "terrain"
      },
      "P": {
        "name": "player",
        "description": "player controlled raccoon, moves left/right and jumps, collects fruits, affected by gravity, collides with brick/platform",
        "color": "#808080",
        "collision": "active",
        "layer": "interaction",
        "category": "character"
      },
      "F": {
        "name": "fruit",
        "description": "collectible prop, player collects on contact to complete objective, triggers collection event",
        "color": "#FFD700",
        "collision": "passive",
        "layer": "interaction",
        "category": "prop"
      },
      "f": {
        "name": "orange",
        "description": "collectible prop, player collects on contact to complete objective, triggers collection event",
        "color": "#e34a1b",
        "collision": "passive",
        "layer": "interaction",
        "category": "prop"
      }
    },
  },

  //feedbackText: 'This is a platformer game with a fixed camera view. The player controls a raccoon that can move and jump through the level to explore the environment and complete the level objective. Fruits are scattered throughout the level and can be collected when the raccoon touches them. The map contains various types of terrain and obstacles, such as platforms at different heights, walls, and other environmental structures. These elements influence the raccoon’s movement paths and jumping routes. Players must move and jump carefully between platforms, avoid obstacles, and collect as many fruits as possible in order to complete the level.',
  // metadata: {},
};

/**
 * #5 分支 C
 * 父节点: #2
 */
export const SAMPLE_V5_CONTENT: Omit<GameVersion, 'id' | 'timestamp' | 'parentVersionId' | 'iterationCount'> = {
  caption: 'The raccoon can attack.',
  code: {
    gameConfig: {
      physicsMode: "platformer",
      cameraMode: "fixed",
    },
    entityConfig: {
      "player": {
        "speed": 180,
        "color": "#808080",
        "projectileType": "player_projectile",
        "width": 0.8,
        "height": 0.8
      },
      "fruit": {
        "color": "#FFD700",
        "width": 0.6,
        "height": 0.6
      },
      "player_projectile": {
        "speed": 250,
        "color": "#FFFF00",
        "width": 0.25,
        "height": 0.25
      },
      "brick": {
        "color": "#8B4513",
        "width": 1,
        "height": 1
      },
      "platform": {
        "color": "#556B2F",
        "width": 1,
        "height": 0.5
      }
    },
    skillRules: [
      {
        "entity": "player",
        "skills": [
          "jump",
          "basic_shoot"
        ]
      }
    ],
    collisionRules: [{
      "a": "player",
      "b": "fruit",
      "action": [
        "destroy_b"
      ]
    },
    {
      "a": "player_projectile",
      "b": "brick",
      "action": [
        "destroy_a"
      ]
    },
    {
      "a": "player_projectile",
      "b": "platform",
      "action": [
        "destroy_a"
      ]
    }],
    inputMapping: {
      "A": "jump",
      "B": "basic_shoot"
    },
  } as GameRules,

  mapData: {
    "terrain": {
      "grid": [
        {
          "y": 0,
          "row": "BBBBBBBBBBBBBBBB"
        },
        {
          "y": 1,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 2,
          "row": "BXXXBBBB----XXBB"
        },
        {
          "y": 3,
          "row": "BX--BXXXXX---XXB"
        },
        {
          "y": 4,
          "row": "BXXXBXBBBBXXXXXB"
        },
        {
          "y": 5,
          "row": "BXXXBXB--BXXXXXB"
        },
        {
          "y": 6,
          "row": "BXXXXBXXBXXXXBBB"
        },
        {
          "y": 7,
          "row": "BBBBBXXXXXXBBBBB"
        },
        {
          "y": 8,
          "row": "B-----XXXX-----B"
        },
        {
          "y": 9,
          "row": "B-XXBBX-XXBBXX-B"
        },
        {
          "y": 10,
          "row": "BXXXBX----BXXXXB"
        },
        {
          "y": 11,
          "row": "BXXXB--XX--BXXXX"
        },
        {
          "y": 12,
          "row": "BBBBXXX--XBBBBBB"
        },
        {
          "y": 13,
          "row": "B----XXXXXX----B"
        },
        {
          "y": 14,
          "row": "B--XXXXXXXXXX--B"
        },
        {
          "y": 15,
          "row": "BBBBBBBBBBBBBBBB"
        }
      ]
    },
    "interaction": [
      {
        "id": "player",
        "element": "P",
        "anchor": {
          "x": 4,
          "y": 14
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 2,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 7,
          "y": 8
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 6
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 6,
          "y": 1
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 3,
          "y": 6
        },
        "size": {
          "width": 1,
          "height": 1
        }
      }
    ]
  },

  schema: {
    meta: {
      map_size: { width: 16, height: 16 },
    },
    mapping: {
      "X": {
        "name": "space",
        "description": "empty area, player can pass through freely, no collision detection",
        "color": "#000000",
        "collision": "prevent",
        "layer": "terrain"
      },
      "B": {
        "name": "brick",
        "description": "solid block, blocks player movement, player can stand and walk on top",
        "color": "#8B4513",
        "collision": "fixed",
        "layer": "terrain"
      },
      "-": {
        "name": "platform",
        "description": "one-way platform, player can stand on top and jump up through from below",
        "color": "#556B2F",
        "collision": "fixed",
        "layer": "terrain"
      },
      "P": {
        "name": "player",
        "description": "player controlled raccoon, moves left/right and jumps, collects fruits, affected by gravity, collides with brick/platform",
        "color": "#808080",
        "collision": "active",
        "layer": "interaction",
        "category": "character"
      },
      "F": {
        "name": "fruit",
        "description": "collectible prop, player collects on contact to complete objective, triggers collection event",
        "color": "#FFD700",
        "collision": "passive",
        "layer": "interaction",
        "category": "prop"
      },
      "f": {
        "name": "orange",
        "description": "collectible prop, player collects on contact to complete objective, triggers collection event",
        "color": "#e34a1b",
        "collision": "passive",
        "layer": "interaction",
        "category": "prop"
      }
    },
  },

  //feedbackText: 'This is a platformer game with a fixed camera view. The player controls a raccoon that can move and jump through the level to explore the environment and complete the level objective. Fruits are scattered throughout the level and can be collected when the raccoon touches them. The map contains various types of terrain and obstacles, such as platforms at different heights, walls, and other environmental structures. These elements influence the raccoon’s movement paths and jumping routes. Players must move and jump carefully between platforms, avoid obstacles, and collect as many fruits as possible in order to complete the level.',
  // metadata: {},
};

/**
 * #6 合并节点
 * 父节点: #3
 * 合并来源: #3 (合并 #3 的内容)
 */
export const SAMPLE_V6_CONTENT: Omit<GameVersion, 'id' | 'timestamp' | 'parentVersionId' | 'iterationCount'> = {
  caption: 'Merge branch - Reduce platforms, add enemies and fruit variety. Reduced platform count for smoother traversal, added hostile enemies with instant failure on contact, and introduced more fruit types for variety.',
  code: {
    gameConfig: {
      physicsMode: "platformer",
      cameraMode: "fixed",
    },
    entityConfig: {
      "player": {
        "speed": 180,
        "color": "#808080",
        "width": 0.8,
        "height": 0.8
      },
      "enemy": {
        "speed": 20,
        "color": "#e73f32",
        "width": 0.8,
        "height": 0.8
      },
      "fruit": {
        "color": "#FFD700",
        "width": 0.6,
        "height": 0.6
      },
      "brick": {
        "color": "#8B4513",
        "width": 1,
        "height": 1
      },
      "platform": {
        "color": "#556B2F",
        "width": 1,
        "height": 0.5
      }
    },
    skillRules: [
      {
        "entity": "player",
        "skills": [
          "jump"
        ]
      }
    ],
    aiRules: [
      {
        "entity": "enemy",
        "movementAI": "patrol"
      }
    ],
    collisionRules: [{
      "a": "player",
      "b": "fruit",
      "action": [
        "destroy_b"
      ]
    },
    {
      "a": "player",
      "b": "enemy",
      "action": [
        "destroy_a"
      ]
    }],
    inputMapping: {
      "A": "jump",
    },
  } as GameRules,

  mapData: {
    "terrain": {
      "grid": [
        {
          "y": 0,
          "row": "BBBBBBBBBBBBBBBB"
        },
        {
          "y": 1,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 2,
          "row": "BXXXBBBBXXXXXXBB"
        },
        {
          "y": 3,
          "row": "BXXXBXXXXXXXXXXB"
        },
        {
          "y": 4,
          "row": "BXXXBXBBBBXXXXXB"
        },
        {
          "y": 5,
          "row": "BXXXBXBXXBXXXXXB"
        },
        {
          "y": 6,
          "row": "BXXXXBXXBXXXXBBB"
        },
        {
          "y": 7,
          "row": "BBBBBXXXXXXBBBBB"
        },
        {
          "y": 8,
          "row": "BXXXXX-XX------B"
        },
        {
          "y": 9,
          "row": "BXXXXXXXXXBBXXXB"
        },
        {
          "y": 10,
          "row": "BXXXBXBXXBXXXXXB"
        },
        {
          "y": 11,
          "row": "BXXXBXXXXXXBXXXB"
        },
        {
          "y": 12,
          "row": "BBBBXXX--XBBBBBB"
        },
        {
          "y": 13,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 14,
          "row": "BXXXXXXXXXXXXXXB"
        },
        {
          "y": 15,
          "row": "BBBBBBBBBBBBBBBB"
        }
      ]
    },
    "interaction": [
      {
        "id": "player",
        "element": "P",
        "anchor": {
          "x": 2,
          "y": 14
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 2,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 12,
          "y": 6
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 3,
          "y": 6
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "enemy",
        "element": "f",
        "anchor": {
          "x": 8,
          "y": 14
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "enemy",
        "element": "f",
        "anchor": {
          "x": 3,
          "y": 11
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "enemy",
        "element": "f",
        "anchor": {
          "x": 14,
          "y": 5
        },
        "size": {
          "width": 1,
          "height": 1
        }
      },
      {
        "id": "fruit",
        "element": "F",
        "anchor": {
          "x": 6,
          "y": 7
        },
        "size": {
          "width": 1,
          "height": 1
        }
      }
    ]
  },

  schema: {
    meta: {
      map_size: { width: 16, height: 16 },
    },
    mapping: {
      "X": {
        "name": "space",
        "description": "empty area, player can pass through freely, no collision detection",
        "color": "#000000",
        "collision": "prevent",
        "layer": "terrain"
      },
      "B": {
        "name": "brick",
        "description": "solid block, blocks player movement, player can stand and walk on top",
        "color": "#8B4513",
        "collision": "fixed",
        "layer": "terrain"
      },
      "-": {
        "name": "platform",
        "description": "one-way platform, player can stand on top and jump up through from below",
        "color": "#556B2F",
        "collision": "fixed",
        "layer": "terrain"
      },
      "P": {
        "name": "player",
        "description": "player controlled raccoon, moves left/right and jumps, collects fruits, affected by gravity, collides with brick/platform",
        "color": "#808080",
        "collision": "active",
        "layer": "interaction",
        "category": "character"
      },
      "F": {
        "name": "fruit",
        "description": "collectible item, player collects on contact to complete objective, triggers collection event",
        "color": "#FFD700",
        "collision": "passive",
        "layer": "interaction",
        "category": "prop"
      },
      "f": {
        "name": "enemy",
        "description": "hostile enemy, kills player on contact",
        "color": "#e73f32",
        "collision": "active",
        "layer": "interaction",
        "category": "character"
      }
    },
  },

  //feedbackText: 'This is a platformer game with a fixed camera view. The player controls a raccoon that can move and jump through the level to explore the environment and complete the level objective. Fruits are scattered throughout the level and can be collected when the raccoon touches them. The map contains various types of terrain and obstacles, such as platforms at different heights, walls, and other environmental structures. These elements influence the raccoon’s movement paths and jumping routes. Players must move and jump carefully between platforms, avoid obstacles, and collect as many fruits as possible in order to complete the level.',
  // metadata: {},
};

// ============================================================
// 以下代码自动组装完整版本数据，无需修改
// ============================================================

// ============================================================
// 用户填写区域 - 7个版本的日期（格式：'YYYY-MM-DD HH:mm'）
// ============================================================

const SAMPLE_DATE_0 = '2026-03-23 08:20'; // #0 根节点（空白模板）
const SAMPLE_DATE_1 = '2026-03-10 14:30'; // #1 根节点
const SAMPLE_DATE_2 = '2026-03-10 14:36'; // #2 主链
const SAMPLE_DATE_3 = '2026-03-10 14:44'; // #3 分支 A（主链延续）
const SAMPLE_DATE_4 = '2026-03-10 15:01'; // #4 分支 B
const SAMPLE_DATE_5 = '2026-03-11 11:21'; // #5 分支 C
const SAMPLE_DATE_6 = '2026-03-10 15:39'; // #6 合并节点

// ============================================================
// 辅助函数
// ============================================================

function parseDate(dateStr: string): number {
  return new Date(dateStr).getTime();
}

/**
 * 获取完整的示例版本数据
 * 自动处理 ID、时间戳、父子关系
 *
 * 树结构（按时间顺序 0→1→2→3→4→5→6）：
 * #0 (根节点-空白)
 *
 * #1 (根节点)
 * └── #2 (主链) ─── #3 (分支A) ─── #6 (合并)
 *               ├── #4 (分支B)
 *               └── #5 (分支C)
 */
export function getSampleVersions(): GameVersion[] {
  // 时间戳
  const t0 = parseDate(SAMPLE_DATE_0);
  const t1 = parseDate(SAMPLE_DATE_1);
  const t2 = parseDate(SAMPLE_DATE_2);
  const t3 = parseDate(SAMPLE_DATE_3);
  const t4 = parseDate(SAMPLE_DATE_4);
  const t5 = parseDate(SAMPLE_DATE_5);
  const t6 = parseDate(SAMPLE_DATE_6);

  // ID 使用时间戳字符串格式
  const id0 = t0.toString();
  const id1 = t1.toString();
  const id2 = t2.toString();
  const id3 = t3.toString();
  const id4 = t4.toString();
  const id5 = t5.toString();
  const id6 = t6.toString();

  return [
    // #0 根节点（空白模板）
    {
      ...SAMPLE_V0_CONTENT,
      id: id0,
      timestamp: t0,
      iterationCount: 0,
    },

    // #1 根节点
    {
      ...SAMPLE_V1_CONTENT,
      id: id1,
      timestamp: t1,
      iterationCount: 0,
    },

    // #2 主链 - #1 的唯一子节点
    {
      ...SAMPLE_V2_CONTENT,
      id: id2,
      timestamp: t2,
      parentVersionId: id1,
      iterationCount: 1,
    },

    // #3 分支 A - #2 的第一个子节点（最早，成为主链）
    {
      ...SAMPLE_V3_CONTENT,
      id: id3,
      timestamp: t3,
      parentVersionId: id2,
      iterationCount: 2,
    },

    // #4 分支 B - #2 的第二个子节点（比 #3 晚，成为分支）
    {
      ...SAMPLE_V4_CONTENT,
      id: id4,
      timestamp: t4,
      parentVersionId: id2,
      iterationCount: 2,
    },

    // #5 分支 C - #2 的第三个子节点
    {
      ...SAMPLE_V5_CONTENT,
      id: id5,
      timestamp: t5,
      parentVersionId: id2,
      iterationCount: 2,
    },

    // #6 合并节点 - #3 的子节点，合并 #4 的内容
    {
      ...SAMPLE_V6_CONTENT,
      id: id6,
      timestamp: t6,
      parentVersionId: id3,
      iterationCount: 3,
      metadata: {
        ...SAMPLE_V6_CONTENT.metadata,
        mergedFrom: id4,
      },
    },
  ];
}

/**
 * 获取示例版本历史
 */
export function getSampleVersionHistory(): { versions: GameVersion[]; currentVersionId: string } {
  const versions = getSampleVersions();
  return {
    versions,
    currentVersionId: versions[versions.length - 1].id, // 当前版本指向最新的合并节点
  };
}
