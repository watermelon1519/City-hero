// 城市英雄 - Roguelike 地图系统
// 节点类型：battle / event / shop / boss / elite

class MapManager {
  constructor(game) {
    this.game = game;
    this.nodes = [];
    this.currentNodeId = null;
    this.floor = 1; // 当前层数
    this.maxFloor = 5; // 最大层数
  }

  // 获取当前楼层配置
  getCurrentFloor() {
    return window.getCurrentFloor ? window.getCurrentFloor(this.floor) : {
      id: this.floor,
      name: "未知区域",
      enemies: [{ id: "thug", name: "混混", hp: 60, atk: 8, icon: "👊" }],
      boss: { id: "boss", name: "Boss", hp: 200, atk: 10, icon: "👑" },
      events: [{ id: "default", name: "事件", icon: "❓", description: "发生了一些事..." }],
      bgColor: "#1a1a2e",
      accentColor: "#e94560"
    };
  }

  // 生成地图
  generate() {
    const floor = this.getCurrentFloor();
    this.nodes = [];
    this.currentNodeId = null;

    const rows = 4 + this.floor; // 层数越多，行数越多

    const n = (id, type, row, col) => ({
      id,
      type,
      row,
      col,
      next: [],
      visited: false,
      unlocked: false,
      enemy: null,
      event: null,
      shop: null,
    });

    // 起点
    const start = n("start", "start", 0, 1);
    this.nodes.push(start);

    // 生成中间行（尽量避免复杂交叉：每个节点 1~2 个父节点，优先直线/邻近连接）
    let prevRowNodes = [start];
    for (let row = 1; row < rows; row++) {
      const rowNodes = [];
      const nodeCount = 2 + Math.floor(Math.random() * 2); // 2-3 个节点每行
      
      for (let i = 0; i < nodeCount; i++) {
        const nodeId = `r${row}n${i}`;
        const nodeType = this.randomNodeType(row, rows);
        const node = n(nodeId, nodeType, row, i);
        
        // 填充节点内容
        if (nodeType === "battle" || nodeType === "elite") {
          node.enemy = this.generateEnemy(nodeType);
        } else if (nodeType === "event") {
          node.event = this.generateEvent();
        } else if (nodeType === "shop") {
          node.shop = this.generateShop();
        }
        
        rowNodes.push(node);
        this.nodes.push(node);
      }

      // 连接到上一行：每个上一行节点连接到本行 1~2 个“邻近列”的节点
      // 额外约束：同一行的父子索引尽量单调，避免出现明显的「W 型」交叉线
      const parentCount = new Map(rowNodes.map(node => [node.id, 0]));
      const childMaxParents = 1; // 每个子节点最多 1 个父节点，更接近杀戮尖塔那种树形

      prevRowNodes.forEach((prevNode, prevIndex) => {
        const targetCol = Math.min(
          rowNodes.length - 1,
          Math.max(0, prevIndex)
        );

        // 只考虑「同列或右侧」的节点，避免从右往左连造成 W 形
        const sortedByDistance = [...rowNodes]
          .filter(n => n.col >= targetCol - 1) // 同列或稍微偏左一点
          .sort((a, b) => Math.abs(a.col - targetCol) - Math.abs(b.col - targetCol));

        const connectTargets = [];
        for (const candidate of sortedByDistance) {
          const count = parentCount.get(candidate.id) || 0;
          if (count < childMaxParents) {
            connectTargets.push(candidate);
          }
          if (connectTargets.length >= 2) break;
        }

        if (connectTargets.length === 0) {
          // 兜底：仍然连到目标列，保证连通
          connectTargets.push(rowNodes[targetCol]);
        }

        // 至少连 1 个，第二条边有一定概率出现（向右扩散）
        const first = connectTargets[0];
        prevNode.next.push(first.id);
        parentCount.set(first.id, (parentCount.get(first.id) || 0) + 1);

        const second = connectTargets[1];
        if (second && second.col >= first.col && Math.random() < 0.35) {
          prevNode.next.push(second.id);
          parentCount.set(second.id, (parentCount.get(second.id) || 0) + 1);
        }
      });

      // 确保本行每个节点至少有 1 个父节点（否则从最近的上一行节点补一条）
      rowNodes.forEach((node, idx) => {
        if ((parentCount.get(node.id) || 0) > 0) return;
        let bestPrev = prevRowNodes[0];
        let bestDist = Math.abs(idx - 0);
        prevRowNodes.forEach((p, pi) => {
          const d = Math.abs(idx - pi);
          if (d < bestDist) {
            bestDist = d;
            bestPrev = p;
          }
        });
        bestPrev.next.push(node.id);
        parentCount.set(node.id, (parentCount.get(node.id) || 0) + 1);
      });

      prevRowNodes = rowNodes;
    }

    // Boss 节点
    const boss = n("boss", "boss", rows, 1);
    boss.enemy = {
      ...floor.boss,
      hp: floor.boss.hp * (1 + this.floor * 0.1), // 难度递增
      atk: floor.boss.atk * (1 + this.floor * 0.05)
    };
    
    // 连接最后一行到 Boss
    for (const prevNode of prevRowNodes) {
      prevNode.next.push("boss");
    }
    this.nodes.push(boss);

    // 初始化起点
    this.currentNodeId = "start";
    start.visited = true;
    start.unlocked = true;
    this._unlockNext(start);
    
    // 更新楼层显示
    this.game.updateFloorDisplay();
  }

  // 随机节点类型
  randomNodeType(row, totalRows) {
    const isLate = row >= totalRows - 2;
    
    // 权重分布
    const weights = {
      battle: isLate ? 0.35 : 0.45,
      event: 0.25,
      shop: 0.15,
      elite: isLate ? 0.25 : 0.15
    };
    
    const rand = Math.random();
    let cumulative = 0;
    for (const [type, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (rand < cumulative) return type;
    }
    return "battle";
  }

  // 生成敌人
  generateEnemy(type) {
    const floor = this.getCurrentFloor();
    const templates = floor.enemies || [];
    if (templates.length === 0) {
      return { name: "敌人", hp: 50, atk: 5, icon: "👤", gold: 10 };
    }
    
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // 精英怪加强
    if (type === "elite") {
      const base = {
        ...template,
        name: `★${template.name}`,
        hp: Math.floor(template.hp * 1.8),
        atk: Math.floor(template.atk * 1.5),
        gold: 40 + this.floor * 15,
        isElite: true
      };
      // 第一层精英：具备 Boss1 的“破坏牌型”机制，但只破坏 1 张牌
      if ((floor && floor.id) === 1) {
        base.aiType = "elite1_shatter";
      }
      return base;
    }

    // 普通敌人随机强化
    const levelBonus = this.floor * 0.1;
    return {
      ...template,
      hp: Math.floor(template.hp * (1 + levelBonus) + Math.random() * 15),
      atk: Math.floor(template.atk * (1 + levelBonus * 0.5) + Math.random() * 2),
      gold: 15 + this.floor * 8
    };
  }

  // 生成随机事件
  generateEvent() {
    // 使用全局事件池或自定义
    if (window.getRandomEvent) {
      const baseEvent = window.getRandomEvent(this.floor);
      return this.enrichEvent(baseEvent);
    }
    
    // 默认事件池
    const events = [
      {
        id: "treasure",
        name: "宝藏",
        icon: "💰",
        description: "你发现了一个宝箱！",
        effect: { gold: 50 + this.floor * 20 }
      },
      {
        id: "heal",
        name: "休息站",
        icon: "♨️",
        description: "你找到了一个休息的地方，恢复了体力！",
        effect: { healAll: true }
      },
      {
        id: "card",
        name: "神秘商人",
        icon: "🎴",
        description: "一个神秘商人给你一张卡牌。",
        effect: { addCard: true }
      },
      {
        id: "trap",
        name: "陷阱",
        icon: "⚠️",
        description: "你踩到了陷阱！",
        effect: { damage: 10 + this.floor * 5 }
      },
      {
        id: "gold",
        name: "钱包",
        icon: "👛",
        description: "地上有个钱包！",
        effect: { gold: 30 + this.floor * 10 }
      },
      {
        id: "shrine",
        name: "神殿",
        icon: "🏛️",
        description: "神殿赐予你力量！",
        effect: { buff: "damage", value: 1.15 }
      },
      {
        id: "mystery",
        name: "???",
        icon: "❓",
        description: "神秘的遭遇...",
        effect: { random: true }
      }
    ];

    return events[Math.floor(Math.random() * events.length)];
  }
  
  // 丰富事件内容
  enrichEvent(baseEvent) {
    const floor = this.getCurrentFloor();
    return {
      ...baseEvent,
      description: baseEvent.description || `在${floor.name}发生了什么...`,
      effect: baseEvent.effect || { gold: 20 }
    };
  }

  // 生成商店
  generateShop() {
    return {
      name: "商店",
      icon: "🏪"
    };
  }

  getNode(id) {
    return this.nodes.find((x) => x.id === id) || null;
  }

  getRows() {
    const rows = new Map();
    for (const node of this.nodes) {
      if (!rows.has(node.row)) rows.set(node.row, []);
      rows.get(node.row).push(node);
    }
    return [...rows.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, arr]) => arr.sort((a, b) => a.col - b.col));
  }

  // 获取全部节点（用于地图连线渲染）
  getNodes() {
    return this.nodes || [];
  }

  canEnter(id) {
    const node = this.getNode(id);
    if (!node) return false;
    if (node.visited) return false;
    if (!node.unlocked) return false;
    // 必须从当前节点出发，只能进入当前节点的 next 列表
    const current = this.getNode(this.currentNodeId);
    if (!current || !current.next || !current.next.includes(id)) return false;
    return true;
  }

  // 进入节点（仅允许 unlocked 且未 visited 的节点）
  enter(id) {
    const node = this.getNode(id);
    if (!node || !this.canEnter(id)) return null;
    
    // 记录路径来源，用于地图连线高亮
    const prev = this.getNode(this.currentNodeId);
    if (prev && node.id !== "start") {
      node._from = prev.id;
    }
    
    this.currentNodeId = id;
    node.visited = true;
    this._unlockNext(node);
    
    // 根据节点类型触发事件
    if (node.type === "battle" || node.type === "elite" || node.type === "boss") {
      // 战斗
      this.game.startBattleForNode(node);
    } else if (node.type === "event") {
      // 事件
      this.game.showEvent(node.event || this.generateEvent());
    } else if (node.type === "shop") {
      // 商店
      this.game.showShop();
    }
    
    return node;
  }

  _unlockNext(node) {
    for (const nextId of node.next || []) {
      const n = this.getNode(nextId);
      if (n) n.unlocked = true;
    }
  }

  // 进入下一层
  nextFloor() {
    if (this.floor < this.maxFloor) {
      this.floor++;
      this.generate();
      this.game.updateFloorDisplay();
      return true;
    }
    return false; // 游戏通关
  }
}

window.MapManager = MapManager;
