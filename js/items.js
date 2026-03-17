// 道具数据库（类似 Joker 被动）
const ITEMS_DB = {
  // ===== 程序员专属道具 =====
  lobster: {
    id: "lobster",
    name: "🦞 龙虾",
    icon: "🦞",
    type: "profession",
    rarity: "legendary",
    profession: "coder",
    description: "「代码」卡伤害×10，但 10 回合后摧毁所有「代码」牌",
    detail: "【传奇】程序员最强道具\n「敲代码」「重构代码」伤害×10\n⚠️ 10回合后所有代码牌销毁\n双刃剑，高风险高回报",
    effect: (state) => {
      if (state.cardProfession === "coder" && state.cardId && state.cardId.includes("code")) {
        return { damageMultiplier: 10, destroyCodeCardsAfter: 10 };
      }
      return {};
    },
  },
  mechanical_keyboard: {
    id: "mechanical_keyboard",
    name: "⌨️ 机械键盘",
    icon: "⌨️",
    type: "profession",
    rarity: "epic",
    profession: "coder",
    description: "程序员卡 +8 伤害",
    detail: "【史诗】程序员通用增伤道具\n所有程序员卡牌+8伤害\n适合纯程序员流派",
    effect: (state) => {
      if (state.cardProfession === "coder") {
        return { damageBonus: 8 };
      }
      return {};
    },
  },
  energy_drink: {
    id: "energy_drink",
    name: "🥤 功能饮料",
    icon: "🥤",
    type: "profession",
    rarity: "rare",
    profession: "coder",
    description: "程序员卡抽牌 +1",
    detail: "【稀有】程序员过牌道具\n打出程序员卡时额外抽1张\n帮助寻找代码组合",
    effect: (state) => {
      if (state.cardProfession === "coder") {
        return { drawBonus: 1 };
      }
      return {};
    },
  },
  rubber_duck: {
    id: "rubber_duck",
    name: "🦆 橡皮鸭",
    icon: "🦆",
    type: "profession",
    rarity: "rare",
    profession: "coder",
    description: "出牌上限 +1（基础 5 → 6）",
    detail: "【稀有】程序员节奏道具\n本回合可多打出 1 张牌（出牌上限 +1）\n适合更快凑齐牌型/隐藏组合",
    effect: (state) => {
      return { playedLimitBonus: 1 };
    },
  },

  // ===== 狗专属道具 =====
  dog_treat: {
    id: "dog_treat",
    name: "🦴 狗粮",
    icon: "🦴",
    type: "profession",
    rarity: "rare",
    profession: "dog",
    description: "狗卡 +5 伤害，回 2 血",
    detail: "【稀有】狗的攻守兼备道具\n狗卡+5伤害，自回2血\n稳定收益",
    effect: (state) => {
      if (state.cardProfession === "dog") {
        return { damageBonus: 5, selfHeal: 2 };
      }
      return {};
    },
  },
  tennis_ball: {
    id: "tennis_ball",
    name: "🎾 网球",
    icon: "🎾",
    type: "profession",
    rarity: "epic",
    profession: "dog",
    description: "「捡回来」卡回收数 +2",
    detail: "【史诗】狗的回收强化道具\n「捡回来」从弃牌堆回收2→4张\n大幅增加资源循环能力",
    effect: (state) => {
      if (state.cardProfession === "dog" && state.cardId === "dog_fetch") {
        return { retrieveBonus: 2 };
      }
      return {};
    },
  },
  cozy_bed: {
    id: "cozy_bed",
    name: "🛏️ 狗窝",
    icon: "🛏️",
    type: "profession",
    rarity: "legendary",
    profession: "dog",
    description: "每回合开始自动回 10 血",
    detail: "【传奇】狗的续航神器\n每回合开始全队回10血\n配合狗的治疗牌，全队不死",
    effect: (state) => {
      if (state.turnStart) {
        return { autoHeal: 10 };
      }
      return {};
    },
  },

  // ===== 成就解锁道具 =====
  coupon_book: {
    id: "coupon_book",
    name: "📒 优惠券册",
    icon: "📒",
    type: "global",
    rarity: "epic",
    lockedByDefault: true,
    description: "解锁后才会出现在商店",
    detail: "【成就解锁】商店将开始出售该道具\n（用于“富翁”等成就奖励展示）",
    effect: () => {
      // 当前道具系统主要用于伤害/连击等，这里先保留为“可解锁收集品”
      return {};
    },
  },
  hero_medal: {
    id: "hero_medal",
    name: "🏅 城市英雄勋章",
    icon: "🏅",
    type: "global",
    rarity: "legendary",
    lockedByDefault: true,
    description: "解锁后才会出现在商店",
    detail: "【成就解锁】象征通关与荣誉的勋章\n（用于“组合大师/通关”等成就奖励展示）",
    effect: () => {
      return {};
    },
  },

  // ===== 老师专属道具 =====
  red_pen: {
    id: "red_pen",
    name: "🖊️ 红笔",
    icon: "🖊️",
    type: "profession",
    rarity: "rare",
    profession: "teacher",
    description: "老师卡 +6 伤害",
    detail: "【稀有】老师增伤道具\n所有老师卡牌+6伤害\n稳定提升输出",
    effect: (state) => {
      if (state.cardProfession === "teacher") {
        return { damageBonus: 6 };
      }
      return {};
    },
  },
  textbook: {
    id: "textbook",
    name: "📖 教科书",
    icon: "📖",
    type: "profession",
    rarity: "epic",
    profession: "teacher",
    description: "「说教」卡减速回合 +2",
    detail: "【史诗】老师控制强化道具\n「说教」减速效果+2回合\n大幅延长敌人虚弱时间",
    effect: (state) => {
      if (state.cardProfession === "teacher" && state.cardId === "teacher_lecture") {
        return { slowBonus: 2 };
      }
      return {};
    },
  },
  summer_vacation: {
    id: "summer_vacation",
    name: "🏖️ 暑假",
    icon: "🏖️",
    type: "profession",
    rarity: "legendary",
    profession: "teacher",
    description: "每 3 回合，全队回 20 血",
    detail: "【传奇】老师的群体回复道具\n每3回合自动全队回20血\n持续战斗的保障",
    effect: (state) => {
      if (state.turnCount % 3 === 0) {
        return { healAll: 20 };
      }
      return {};
    },
  },

  // ===== 保安专属道具 =====
  flashlight: {
    id: "flashlight",
    name: "🔦 手电筒",
    icon: "🔦",
    type: "profession",
    rarity: "rare",
    profession: "security",
    description: "保安卡 +5 伤害",
    detail: "【稀有】保安增伤道具\n所有保安卡牌+5伤害\n提升坦克输出",
    effect: (state) => {
      if (state.cardProfession === "security") {
        return { damageBonus: 5 };
      }
      return {};
    },
  },
  walkie_talkie: {
    id: "walkie_talkie",
    name: "📻 对讲机",
    icon: "📻",
    type: "profession",
    rarity: "epic",
    profession: "security",
    description: "「呼叫支援」护盾 +20",
    detail: "【史诗】保安防御强化道具\n「呼叫支援」护盾20→40\n全队回复效果不变\n超级坦克必备",
    effect: (state) => {
      if (state.cardProfession === "security" && state.cardId === "security_call_backup") {
        return { shieldBonus: 20 };
      }
      return {};
    },
  },
  security_booth: {
    id: "security_booth",
    name: "🏚️ 保安亭",
    icon: "🏚️",
    type: "profession",
    rarity: "legendary",
    profession: "security",
    description: "每回合开始自动获得 10 护盾",
    detail: "【传奇】保安的永续防御道具\n每回合开始自动+10护盾\n配合嘲讽，全队安全",
    effect: (state) => {
      if (state.turnStart) {
        return { autoShield: 10 };
      }
      return {};
    },
  },

  // ===== 流氓专属道具 =====
  brass_knuckles: {
    id: "brass_knuckles",
    name: "🥊 指虎",
    icon: "🥊",
    type: "profession",
    rarity: "rare",
    profession: "hooligan",
    description: "流氓卡 +7 伤害",
    detail: "【稀有】流氓增伤道具\n所有流氓卡牌+7伤害\n纯输出流首选",
    effect: (state) => {
      if (state.cardProfession === "hooligan") {
        return { damageBonus: 7 };
      }
      return {};
    },
  },
  lucky_coin: {
    id: "lucky_coin",
    name: "🪙 幸运币",
    icon: "🪙",
    type: "profession",
    rarity: "epic",
    profession: "hooligan",
    description: "「偷窃」金币翻倍",
    detail: "【史诗】流氓经济道具\n「偷窃」金币8→16\n快速积累财富",
    effect: (state) => {
      if (state.cardProfession === "hooligan" && state.cardId === "hooligan_steal") {
        return { stealMultiplier: 2 };
      }
      return {};
    },
  },
  gang_spirit: {
    id: "gang_spirit",
    name: "🔥 街头精神",
    icon: "🔥",
    type: "profession",
    rarity: "legendary",
    profession: "hooligan",
    description: "「组合拳」流血 +6",
    detail: "【传奇】流氓流血神器\n「组合拳」流血 +6\n让持续伤害更稳定（克制厚血Boss）",
    effect: (state) => {
      if (state.cardProfession === "hooligan" && state.cardId === "hooligan_combo") {
        return { bleedBonus: 6 };
      }
      return {};
    },
  },

  // ===== 连击类 =====
  rage_badge: {
    id: "rage_badge",
    name: "狂怒徽章",
    icon: "🗡️",
    type: "combo",
    rarity: "legendary",
    description: "3 连击时伤害×2",
    detail: "【传奇】连击爆发道具\n打出3张以上卡牌时伤害翻倍\n适合快速出牌流派",
    effect: (state) => {
      if (state.comboCount >= 3) {
        return { damageMultiplier: 2 };
      }
      return {};
    },
  },
  lucky_gem: {
    id: "lucky_gem",
    name: "幸运宝石",
    icon: "💎",
    type: "combo",
    rarity: "legendary",
    description: "每回合第 1 张牌必暴击",
    detail: "【传奇】首牌暴击道具\n每回合第一张牌必定暴击\n伤害×1.5",
    effect: (state) => {
      if (state.cardsPlayed === 0) {
        return { critChance: 1 };
      }
      return {};
    },
  },
  combo_charm: {
    id: "combo_charm",
    name: "连击护符",
    icon: "🔗",
    type: "combo",
    rarity: "epic",
    description: "连击中断时保留 50% 层数",
    detail: "【史诗】连击保护道具\n连击中断时保留一半层数\n减少损失，更易维持高连击",
    effect: (state) => {
      if (state.comboBroken) {
        return { preserveCombo: 0.5 };
      }
      return {};
    },
  },

  // ===== 爽感类 =====
  thunder_blade: {
    id: "thunder_blade",
    name: "雷霆之刃",
    icon: "⚡",
    type: "power",
    rarity: "legendary",
    description: "打满出牌上限时：追加一次雷击伤害",
    detail: "【传奇】清场神器\n当你本回合把出牌区打满（达到本回合出牌上限）\n会追加一次「雷击」：对当前敌人造成额外伤害（对 Boss 也有效）",
    effect: (state) => {
      const limit = state && typeof state.playedLimit === "number" ? state.playedLimit : 5;
      if (state && state.cardsPlayed >= limit) return { thunderStrike: true };
      return { thunderStrike: false };
    },
  },
  reap_scythe: {
    id: "reap_scythe",
    name: "收割镰刀",
    icon: "💀",
    type: "power",
    rarity: "legendary",
    description: "击杀敌人后额外金币 +50%",
    detail: "【传奇】连杀神器\n每次击杀敌人后，额外获得 50% 金币奖励\n清小怪越多，钱越多",
    effect: (state) => {
      if (state && state.victory) return { goldOnKillBonus: 0.5 };
      return { goldOnKillBonus: 0 };
    },
  },
  infinity_core: {
    id: "infinity_core",
    name: "无限核心",
    icon: "🌟",
    type: "power",
    rarity: "legendary",
    description: "出牌上限 +2（基础 5 → 7）",
    detail: "【传奇】资源扩展道具\n本回合可多打出 2 张牌（出牌上限 +2）\n一回合更容易打出更高倍率",
    effect: () => {
      return { playedLimitBonus: 2 };
    },
  },

  // ===== 辅助类 =====
  backpack: {
    id: "backpack",
    name: "背包",
    icon: "📦",
    type: "utility",
    rarity: "rare",
    description: "出牌上限 +1（基础 5 → 6）",
    detail: "【稀有】容量扩展道具\n本回合可多打出 1 张牌（出牌上限 +1）\n更容易凑齐关键牌型",
    effect: () => {
      return { playedLimitBonus: 1 };
    },
  },
  battery: {
    id: "battery",
    name: "电池",
    icon: "🔋",
    type: "utility",
    rarity: "rare",
    description: "每回合基础摸牌 +1",
    detail: "【稀有】续航型道具\n每回合基础摸牌 +1（在起手/过牌之外额外增加）\n稳定提升长期输出上限",
    effect: () => {
      return { turnDrawBonus: 1 };
    },
  },
  cycle_rune: {
    id: "cycle_rune",
    name: "循环符文",
    icon: "🔄",
    type: "utility",
    rarity: "rare",
    description: "每回合基础摸牌 +1",
    detail: "【稀有】循环加速道具\n每回合基础摸牌 +1\n更快找到核心组合与控制牌",
    effect: () => {
      return { turnDrawBonus: 1 };
    },
  },
  control_amplifier: {
    id: "control_amplifier",
    name: "📡 控制增幅器",
    icon: "📡",
    type: "utility",
    rarity: "rare",
    description: "控制命中率 +30%（用于对抗 Boss 免控）",
    detail: "【稀有】控场强化道具\n你的眩晕类控制对 Boss 更容易生效\n（用于对抗 Boss 的 80% 免控）",
    effect: () => {
      return { controlChanceBonus: 0.30 };
    },
  },
  dice: {
    id: "dice",
    name: "幸运骰子",
    icon: "🎲",
    type: "utility",
    rarity: "rare",
    description: "每回合 50% 概率出牌上限 +1",
    detail: "【稀有】赌狗快乐道具\n每回合开始掷骰：50% 概率本回合出牌上限 +1\n看脸把握一回合爆发",
    effect: (state) => {
      if (state && state.turnStart && state.rand != null) {
        return { playedLimitBonus: (state.rand < 0.5) ? 1 : 0 };
      }
      return { playedLimitBonus: 0 };
    },
  },
  greedy_wallet: {
    id: "greedy_wallet",
    name: "贪婪钱包",
    icon: "💰",
    type: "utility",
    rarity: "rare",
    description: "战斗胜利金币 +50%",
    detail: "【稀有】经济增益道具\n战斗胜利金币+50%\n快速积累财富",
    effect: (state) => {
      if (state.victory) {
        return { goldBonus: 0.5 };
      }
      return {};
    },
  },
};

// 稀有度颜色
const RARITY_COLORS = {
  common: "#888",
  rare: "#4a90d9",
  epic: "#a335ee",
  legendary: "#ff8000",
};

// 工具函数
const ItemUtil = {
  // 创建道具元素
  createItemElement(itemId) {
    const item = ITEMS_DB[itemId];
    if (!item) return null;

    const el = document.createElement("div");
    el.className = "item-slot has-item";
    el.title = `${item.name}\n${item.description}`;
    el.innerHTML = item.icon;
    el.style.borderColor = RARITY_COLORS[item.rarity];

    return el;
  },

  // 计算道具效果（当前仅用于连击/伤害的乘加）
  calculateEffects(items, state) {
    const effects = {
      damageMultiplier: 1,
      damageBonus: 0,
      critChance: 0,
      comboBonus: 0,
      maxEnergyBonus: 0,
      handSizeBonus: 0,
      goldBonus: 0,
      preserveCombo: 0,
      // 流派倍率：key = `${profession}:${archLabel}`
      comboTypeMults: {},
    };

    for (const itemId of items) {
      const item = ITEMS_DB[itemId];
      if (item && item.effect) {
        const itemEffects = item.effect(state);
        for (const key in itemEffects) {
          if (key === "damageMultiplier") {
            effects.damageMultiplier *= itemEffects[key];
          } else if (key === "damageBonus" || key === "comboBonus") {
            effects[key] += itemEffects[key];
          } else if (key === "goldBonus") {
            effects.goldBonus += itemEffects[key];
          } else if (key === "preserveCombo") {
            effects.preserveCombo = Math.max(effects.preserveCombo, itemEffects[key]);
          } else if (key === "comboTypeMults" && itemEffects[key] && typeof itemEffects[key] === "object") {
            for (const k in itemEffects[key]) {
              const v = itemEffects[key][k];
              if (typeof v !== "number") continue;
              effects.comboTypeMults[k] = (effects.comboTypeMults[k] || 1) * v;
            }
          } else {
            effects[key] = itemEffects[key];
          }
        }
      }
    }

    return effects;
  },
};

// ===== 流派徽记道具（通用：命中某职业某流派的牌型时，牌型倍率再乘 N）=====
// 说明：
// - key = `${profession}:${archLabel}`，其中 archLabel 是 evaluateCombo 里的流派标签（攻/守/割/技...）
// - 目前先为每个职业生成 4 个基础流派（攻/守/割/技），后续你加更多流派只要扩展列表即可
(() => {
  try {
    const PROFS = ["hooligan", "dog", "coder", "teacher", "security"];
    const PROF_NAME = { hooligan: "流氓", dog: "狗", coder: "程序员", teacher: "老师", security: "保安" };
    // 每职业的默认流派（可按你的预设继续扩展）
    const PROF_ARCHS = {
      hooligan: ["攻", "防", "控", "割", "技"],
      dog: ["攻", "守", "控", "流", "技", "辅"],
      coder: ["攻", "防", "控", "技"],
      teacher: ["攻", "防", "控", "技"],
      security: ["攻", "防", "控", "技"],
    };
    const ARCH_ICON = { "攻": "🗡️", "守": "🛡️", "防": "🛡️", "控": "🌀", "割": "🩸", "流": "☠️", "技": "✨", "辅": "📢" };
    for (const p of PROFS) {
      const archs = PROF_ARCHS[p] || ["攻", "防", "控", "技"];
      for (const a of archs) {
        const id = `sigil_${p}_${a}`;
        if (ITEMS_DB[id]) continue;
        ITEMS_DB[id] = {
          id,
          name: `${ARCH_ICON[a] || "🏷️"} ${PROF_NAME[p] || p}-${a}徽记`,
          icon: `${ARCH_ICON[a] || "🏷️"}`,
          type: "combo",
          rarity: "rare",
          description: `命中「${PROF_NAME[p] || p}-${a}」牌型时，倍率 ×1.5`,
          detail: `【流派】强化特定流派的牌型倍率\n当本回合命中「${PROF_NAME[p] || p}-${a}」牌型（同职业同流派）时：\n最终牌型倍率再 ×1.5\n用于走纯流派构筑`,
          effect: (state) => {
            const prof = state?.comboTypeProfession;
            const arch = state?.comboTypeArch;
            if (prof === p && arch === a) {
              return { comboTypeMults: { [`${p}:${a}`]: 1.5 } };
            }
            return {};
          },
        };
      }
    }
  } catch (_) {}
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ITEMS_DB, RARITY_COLORS, ItemUtil };
}

