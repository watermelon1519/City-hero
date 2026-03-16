// 装备数据库（挂到 window 供其他脚本使用）
const EQUIPMENT_DB = {
  // 武器
  short_sword: {
    id: "short_sword",
    name: "短剑",
    icon: "🗡️",
    width: 1,
    height: 2,
    baseAtk: 5,
    baseDef: 0,
    baseHp: 0,
    rarity: "common",
    description: "基础近战武器",
  },
  spear: {
    id: "spear",
    name: "长矛",
    icon: "🔱",
    width: 1,
    height: 3,
    baseAtk: 8,
    baseDef: 0,
    baseHp: 0,
    rarity: "common",
    description: "长柄武器，攻击距离远",
  },
  dagger: {
    id: "dagger",
    name: "匕首",
    icon: "🔪",
    width: 1,
    height: 1,
    baseAtk: 3,
    baseDef: 0,
    baseHp: 0,
    critChance: 0.1,
    rarity: "common",
    description: "小巧锋利，暴击率高",
  },
  bow: {
    id: "bow",
    name: "弓",
    icon: "🏹",
    width: 2,
    height: 1,
    baseAtk: 6,
    baseDef: 0,
    baseHp: 0,
    rarity: "common",
    description: "远程武器，先手攻击",
  },
  staff: {
    id: "staff",
    name: "法杖",
    icon: "🪄",
    width: 1,
    height: 3,
    baseAtk: 10,
    baseDef: 0,
    baseHp: 0,
    magic: 5,
    rarity: "rare",
    description: "魔法增幅器",
  },

  // 防具
  shield: {
    id: "shield",
    name: "盾牌",
    icon: "🛡️",
    width: 2,
    height: 2,
    baseAtk: 0,
    baseDef: 8,
    baseHp: 0,
    rarity: "common",
    description: "坚固的防御装备",
  },
  helmet: {
    id: "helmet",
    name: "头盔",
    icon: "🪖",
    width: 1,
    height: 1,
    baseAtk: 0,
    baseDef: 5,
    baseHp: 10,
    rarity: "common",
    description: "保护头部",
  },
  armor: {
    id: "armor",
    name: "铠甲",
    icon: "🦺",
    width: 2,
    height: 3,
    baseAtk: 0,
    baseDef: 15,
    baseHp: 0,
    rarity: "rare",
    description: "重型防护",
  },

  // 饰品
  ring: {
    id: "ring",
    name: "戒指",
    icon: "💍",
    width: 1,
    height: 1,
    baseAtk: 0,
    baseDef: 0,
    baseHp: 0,
    allBonus: 0.05, // +5% 所有属性
    rarity: "rare",
    description: "小幅提升所有属性",
  },
  necklace: {
    id: "necklace",
    name: "项链",
    icon: "📿",
    width: 1,
    height: 2,
    baseAtk: 0,
    baseDef: 0,
    baseHp: 0,
    critDamage: 0.1,
    rarity: "rare",
    description: "增加暴击伤害",
  },
  amulet: {
    id: "amulet",
    name: "护身符",
    icon: "🔮",
    width: 1,
    height: 1,
    baseAtk: 5,
    baseDef: 5,
    baseHp: 5,
    rarity: "epic",
    description: "全面提升",
  },

  // 消耗品
  potion: {
    id: "potion",
    name: "药水",
    icon: "🧪",
    width: 1,
    height: 1,
    baseAtk: 0,
    baseDef: 0,
    baseHp: 0,
    healOnWin: 5,
    rarity: "common",
    description: "战斗胜利后恢复生命",
  },

  // 特殊
  gem: {
    id: "gem",
    name: "宝石",
    icon: "💎",
    width: 1,
    height: 1,
    baseAtk: 0,
    baseDef: 0,
    baseHp: 0,
    goldBonus: 10,
    rarity: "rare",
    description: "增加金币收益",
  },
  quiver: {
    id: "quiver",
    name: "箭袋",
    icon: "🎯",
    width: 1,
    height: 2,
    baseAtk: 3,
    baseDef: 0,
    baseHp: 0,
    rarity: "common",
    description: "弓箭的好搭档",
  },
  spellbook: {
    id: "spellbook",
    name: "法书",
    icon: "📕",
    width: 2,
    height: 2,
    baseAtk: 0,
    baseDef: 0,
    baseHp: 0,
    magic: 5,
    rarity: "rare",
    description: "记载魔法知识",
  },
};

// 羁绊规则（MVP 只做 atk/def/hp 三类直观加成）
const BOND_RULES = [
  {
    name: "攻防一体",
    description: "短剑 + 盾牌相邻",
    isGlobal: false,
    check: (eq1, eq2) =>
      (eq1.id === "short_sword" && eq2.id === "shield") ||
      (eq1.id === "shield" && eq2.id === "short_sword"),
    effect: { def: 3 },
  },
  {
    name: "箭在弦上",
    description: "弓 + 箭袋相邻",
    isGlobal: false,
    check: (eq1, eq2) =>
      (eq1.id === "bow" && eq2.id === "quiver") || (eq1.id === "quiver" && eq2.id === "bow"),
    effect: { atk: 5 },
  },
  {
    name: "防护大师",
    description: "头盔 + 铠甲相邻",
    isGlobal: false,
    check: (eq1, eq2) =>
      (eq1.id === "helmet" && eq2.id === "armor") || (eq1.id === "armor" && eq2.id === "helmet"),
    effect: { hp: 5 },
  },
  {
    name: "长矛阵列",
    description: "长矛相邻（每对 +2 ATK）",
    isGlobal: false,
    check: (eq1, eq2) => eq1.id === "spear" && eq2.id === "spear",
    effect: { atk: 2 },
  },
  {
    name: "匕首群",
    description: "3 把以上匕首（MVP：只做展示，不影响战斗数值）",
    isGlobal: true,
    checkGrid: (placedEquipments) => placedEquipments.filter((e) => e.id === "dagger").length >= 3,
    effect: {},
  },
  {
    name: "戒指共鸣",
    description: "戒指相邻（MVP：只做展示，不影响战斗数值）",
    isGlobal: false,
    check: (eq1, eq2) => eq1.id === "ring" && eq2.id === "ring",
    effect: {},
  },
];

function key(x, y) {
  return `${x},${y}`;
}

const EquipmentUtil = {
  cols: 5,
  rows: 6,

  index(x, y) {
    return y * this.cols + x;
  },

  inBounds(x, y) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  },

  // grid: Array(30) of null or {id, startX, startY}
  canPlace(grid, equipment, startX, startY) {
    for (let dy = 0; dy < equipment.height; dy++) {
      for (let dx = 0; dx < equipment.width; dx++) {
        const x = startX + dx;
        const y = startY + dy;
        if (!this.inBounds(x, y)) return false;
        if (grid[this.index(x, y)] !== null) return false;
      }
    }
    return true;
  },

  place(grid, equipment, startX, startY) {
    for (let dy = 0; dy < equipment.height; dy++) {
      for (let dx = 0; dx < equipment.width; dx++) {
        const x = startX + dx;
        const y = startY + dy;
        grid[this.index(x, y)] = { id: equipment.id, startX, startY };
      }
    }
  },

  // 从某个格子（必须是左上角）移除一整件装备，返回 equipment 对象
  remove(grid, startX, startY) {
    const cell = grid[this.index(startX, startY)];
    if (!cell) return null;
    if (cell.startX !== startX || cell.startY !== startY) return null;

    const equipment = EQUIPMENT_DB[cell.id];
    if (!equipment) return null;

    for (let dy = 0; dy < equipment.height; dy++) {
      for (let dx = 0; dx < equipment.width; dx++) {
        const x = startX + dx;
        const y = startY + dy;
        grid[this.index(x, y)] = null;
      }
    }
    return equipment;
  },

  // 只返回“左上角”的装备列表，避免重复
  listPlacedTopLeft(grid) {
    const tops = [];
    const seen = new Set();
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const cell = grid[this.index(x, y)];
        if (!cell) continue;
        const k = key(cell.startX, cell.startY);
        if (seen.has(k)) continue;
        seen.add(k);
        if (cell.startX === x && cell.startY === y) {
          const eq = EQUIPMENT_DB[cell.id];
          if (eq) tops.push({ x, y, eq });
        }
      }
    }
    return tops;
  },

  // 相邻：用“占用格子”来判断是否相邻（更符合直觉）
  isEquipmentAdjacent(grid, a, b) {
    const aCells = [];
    for (let dy = 0; dy < a.eq.height; dy++) {
      for (let dx = 0; dx < a.eq.width; dx++) aCells.push({ x: a.x + dx, y: a.y + dy });
    }
    const bCells = new Set();
    for (let dy = 0; dy < b.eq.height; dy++) {
      for (let dx = 0; dx < b.eq.width; dx++) bCells.add(key(b.x + dx, b.y + dy));
    }

    const dirs = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    for (const c of aCells) {
      for (const [dx, dy] of dirs) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (bCells.has(key(nx, ny))) return true;
      }
    }
    return false;
  },

  calculateBonds(grid) {
    const placed = this.listPlacedTopLeft(grid);
    const active = new Set();
    let atkBonus = 0;
    let defBonus = 0;
    let hpBonus = 0;

    // pair rules
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        if (!this.isEquipmentAdjacent(grid, a, b)) continue;
        for (const rule of BOND_RULES) {
          if (rule.isGlobal) continue;
          if (!rule.check) continue;
          if (rule.check(a.eq, b.eq)) {
            active.add(rule.name);
            if (rule.effect.atk) atkBonus += rule.effect.atk;
            if (rule.effect.def) defBonus += rule.effect.def;
            if (rule.effect.hp) hpBonus += rule.effect.hp;
          }
        }
      }
    }

    // global rules
    for (const rule of BOND_RULES) {
      if (!rule.isGlobal) continue;
      if (rule.checkGrid && rule.checkGrid(placed.map((p) => p.eq))) active.add(rule.name);
    }

    return { atkBonus, defBonus, hpBonus, activeBonds: [...active] };
  },

  calculateStats(grid, baseStats) {
    let totalAtk = baseStats.atk;
    let totalDef = baseStats.def;
    let totalHp = baseStats.hp;

    const placed = this.listPlacedTopLeft(grid);
    for (const p of placed) {
      totalAtk += p.eq.baseAtk || 0;
      totalDef += p.eq.baseDef || 0;
      totalHp += p.eq.baseHp || 0;
    }

    const bonds = this.calculateBonds(grid);
    totalAtk += bonds.atkBonus;
    totalDef += bonds.defBonus;
    totalHp += bonds.hpBonus;

    return { atk: totalAtk, def: totalDef, hp: totalHp, bonds: bonds.activeBonds };
  },

  randomEquip() {
    const keys = Object.keys(EQUIPMENT_DB);
    const randKey = keys[Math.floor(Math.random() * keys.length)];
    return EQUIPMENT_DB[randKey];
  },

  randomEquipByRarity(rarity) {
    const filtered = Object.values(EQUIPMENT_DB).filter((eq) => eq.rarity === rarity);
    if (filtered.length === 0) return this.randomEquip();
    return filtered[Math.floor(Math.random() * filtered.length)];
  },
};

window.EQUIPMENT_DB = EQUIPMENT_DB;
window.BOND_RULES = BOND_RULES;
window.EquipmentUtil = EquipmentUtil;
