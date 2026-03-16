// 卡牌数据库 - 城市英雄
// 每张卡牌都有详细的效果说明
const CARDS_DB = {
  // ===== 通用卡 =====
  attack: {
    id: "attack",
    name: "攻击",
    icon: "⚔️",
    type: "attack",
    profession: "common",
    cost: 1,
    damage: 4,
    description: "造成 4 点伤害",
    detail: "基础攻击牌，适合凑牌型"
  },
  heavy_attack: {
    id: "heavy_attack",
    name: "重击",
    icon: "💥",
    type: "attack",
    profession: "common",
    cost: 2,
    damage: 8,
    description: "造成 8 点伤害",
    detail: "消耗更高的攻击牌，伤害适中"
  },
  block: {
    id: "block",
    name: "格挡",
    icon: "🛡️",
    type: "skill",
    profession: "common",
    cost: 1,
    shield: 6,
    description: "获得 6 点护盾",
    detail: "护盾可以抵挡伤害，每回合清除"
  },
  potion: {
    id: "potion",
    name: "药水",
    icon: "🧪",
    type: "item",
    profession: "common",
    cost: 1,
    heal: 8,
    description: "恢复 8 点生命",
    detail: "拖到队友头像上使用，紧急回复"
  },

  // ===== 程序员 =====
  // 核心机制：敲代码卡需要凑多张才触发效果，数量越多效果越强
  coder_code: {
    id: "coder_code",
    name: "敲代码",
    icon: "💻",
    type: "skill",
    profession: "coder",
    cost: 0,
    damage: 0,
    description: "凑代码牌触发效果",
    detail: "【核心卡】需要凑多张才能生效：\n2张 → 眩晕敌人1回合\n3张 → 眩晕+15伤害\n4张 → 眩晕+30伤害\n5张 → 眩晕+50伤害+敌人技能封印",
    combo: {
      2: { stun: true, damage: 0 },
      3: { stun: true, damage: 15 },
      4: { stun: true, damage: 30 },
      5: { stun: true, damage: 50, silence: true }
    }
  },
  coder_code_master: {
    id: "coder_code_master",
    name: "重构代码",
    icon: "👨‍💻",
    type: "skill",
    profession: "coder",
    cost: 0,
    damage: 0,
    description: "高级代码牌，效果更强",
    detail: "【核心卡】相当于2张敲代码牌\n手牌中有 2 张时：眩晕敌人\n手牌中有 3 张时：眩晕+20伤害\n可与其他代码牌叠加计算",
    combo: {
      2: { stun: true, damage: 0 },
      3: { stun: true, damage: 20 }
    },
    comboValue: 2 // 相当于2张普通代码牌
  },
  coder_bug: {
    id: "coder_bug",
    name: "写 Bug",
    icon: "🐛",
    type: "attack",
    profession: "coder",
    cost: 1,
    damage: 3,
    selfDamage: 2,
    description: "造成 3 伤害，自己掉 2 血",
    detail: "低伤自残牌，适合凑牌型\n⚠️ 注意：自己也会受伤"
  },
  coder_coffee: {
    id: "coder_coffee",
    name: "咖啡续命",
    icon: "☕",
    type: "skill",
    profession: "coder",
    cost: 1,
    heal: 8,
    draw: 1,
    description: "恢复 8 血，下回合多抽 1 张",
    detail: "程序员的核心回复牌\n回血+过牌，下回合多抽1张牌\n性价比高"
  },
  coder_deadline: {
    id: "coder_deadline",
    name: "Deadline",
    icon: "⏰",
    type: "attack",
    profession: "coder",
    cost: 2,
    damage: 18,
    selfDamage: 6,
    description: "造成 18 伤害！自己掉 6 血",
    detail: "高伤自残牌，关键时刻爆发\n⚠️ 使用时注意自身血量"
  },

  // ===== 成就解锁卡牌 =====
  coder_pull_request: {
    id: "coder_pull_request",
    name: "提 PR",
    icon: "🔀",
    type: "skill",
    profession: "coder",
    cost: 0,
    damage: 0,
    draw: 2,
    lockedByDefault: true,
    description: "下回合多抽 2 张",
    detail: "【成就解锁】程序员过牌强化\n打出后，下回合额外抽 2 张\n适合更快凑齐核心组合"
  },
  coder_refactor: {
    id: "coder_refactor",
    name: "重构",
    icon: "🔄",
    type: "skill",
    profession: "coder",
    cost: 1,
    discardAndDraw: 3,
    description: "下回合多抽 3 张牌",
    detail: "换牌神技！\n下回合多抽3张，加速过牌寻找核心组合"
  },

  // ===== 狗 =====
  // 定位：辅助/治疗，配合流氓打输出
  dog_bark: {
    id: "dog_bark",
    name: "汪汪汪",
    icon: "🐕",
    type: "attack",
    profession: "dog",
    cost: 1,
    damage: 4,
    stun: true,
    description: "造成 4 伤害，眩晕敌人 1 回合",
    detail: "【控制牌】低伤但带眩晕\n打断敌人节奏的神技\n可与流氓牌触发「街头恶霸」组合"
  },
  dog_bite: {
    id: "dog_bite",
    name: "咬一口",
    icon: "🦷",
    type: "attack",
    profession: "dog",
    cost: 1,
    damage: 6,
    description: "造成 6 伤害",
    detail: "狗的基础攻击牌\n伤害适中，适合凑牌型\n可与流氓牌触发「街头恶霸」组合"
  },
  dog_tail: {
    id: "dog_tail",
    name: "摇尾巴",
    icon: "💫",
    type: "skill",
    profession: "dog",
    cost: 0,
    healAll: 3,
    draw: 1,
    description: "全队恢复 3 血，下回合多抽 1 张",
    detail: "【神技】免费打出！\n全队回血+过牌，下回合多抽1张\n狗的核心辅助牌"
  },
  dog_dig: {
    id: "dog_dig",
    name: "挖坑",
    icon: "🕳️",
    type: "skill",
    profession: "dog",
    cost: 1,
    trap: true,
    damage: 12,
    description: "埋坑，敌人下回合踩中受 12 伤害",
    detail: "【陷阱牌】延迟伤害\n回合结束不触发，敌人回合触发\n适合在安全回合布置"
  },
  dog_fetch: {
    id: "dog_fetch",
    name: "捡回来",
    icon: "🎾",
    type: "skill",
    profession: "dog",
    cost: 1,
    retrieve: 2,
    description: "从弃牌堆回收 2 张到下回合手牌",
    detail: "【回收牌】资源循环利器\n从弃牌堆取2张，下回合直接到手牌\n与程序员牌触发「摸鱼搭档」组合"
  },
  dog_goodboy: {
    id: "dog_goodboy",
    name: "好狗狗！",
    icon: "🌟",
    type: "skill",
    profession: "dog",
    cost: 2,
    buff: { damage: 1.3, duration: 2 },
    healAll: 6,
    description: "全队回 6 血，伤害×1.3 持续 2 回合",
    detail: "【大招】狗的最强辅助牌\n全队回血+增伤Buff\n持续2回合，性价比极高"
  },

  // ===== 老师 =====
  // 定位：控制/削弱，配合程序员打爆发
  teacher_lecture: {
    id: "teacher_lecture",
    name: "说教",
    icon: "📚",
    type: "attack",
    profession: "teacher",
    cost: 1,
    damage: 3,
    slow: 2,
    description: "造成 3 伤害，敌人减速 2 回合",
    detail: "【控制牌】降低敌人攻击力\n适合削弱Boss\n与程序员牌触发「网课噩梦」组合"
  },
  teacher_homework: {
    id: "teacher_homework",
    name: "布置作业",
    icon: "📝",
    type: "skill",
    profession: "teacher",
    cost: 1,
    enemyDraw: 2,
    description: "敌人下回合少行动 2 次",
    detail: "【强力控制】敌人少攻击2次\n打断敌人节奏\n与程序员牌触发「网课噩梦」组合"
  },
  teacher_ruler: {
    id: "teacher_ruler",
    name: "戒尺敲头",
    icon: "📏",
    type: "attack",
    profession: "teacher",
    cost: 1,
    damage: 8,
    description: "造成 8 伤害",
    detail: "老师的基础攻击牌\n伤害适中，适合凑牌型"
  },
  teacher_redpen: {
    id: "teacher_redpen",
    name: "红笔批改",
    icon: "🖊️",
    type: "attack",
    profession: "teacher",
    cost: 2,
    damage: 5,
    weakness: 2,
    description: "造成 5 伤害，敌人伤害-50% 持续 2 回合",
    detail: "【削弱牌】大幅降低敌人伤害\n对付高攻敌人必备\n与流氓牌触发「思想教育」组合"
  },
  teacher_summer: {
    id: "teacher_summer",
    name: "暑假作业",
    icon: "☀️",
    type: "skill",
    profession: "teacher",
    cost: 2,
    healAll: 12,
    shield: 6,
    description: "全队回 12 血 + 6 护盾",
    detail: "【回复牌】老师的核心回复牌\n回血+护盾，保护全队\n与保安牌触发「班级秩序」组合"
  },
  teacher_failing: {
    id: "teacher_failing",
    name: "不及格！",
    icon: "❌",
    type: "attack",
    profession: "teacher",
    cost: 3,
    damage: 25,
    execute: 0.25,
    description: "造成 25 伤害，敌人血量<25% 直接秒杀",
    detail: "【大招】老师的终结技\n斩杀线：敌人血量低于25%\n适合收尾"
  },

  // ===== 保安 =====
  // 定位：坦克/控制，配合狗打防守反击
  security_flashlight: {
    id: "security_flashlight",
    name: "手电筒照",
    icon: "🔦",
    type: "attack",
    profession: "security",
    cost: 1,
    damage: 4,
    blind: true,
    description: "造成 4 伤害，敌人致盲 1 回合",
    detail: "【控制牌】致盲让敌人命中率下降\n低伤但控制效果强\n与流氓牌触发「暴力执法」组合"
  },
  security_whistle: {
    id: "security_whistle",
    name: "吹哨子",
    icon: "📯",
    type: "skill",
    profession: "security",
    cost: 1,
    taunt: true,
    shield: 10,
    description: "嘲讽敌人 + 获得 10 护盾",
    detail: "【坦克牌】强制敌人攻击自己\n+护盾保护自己\n与狗牌触发「忠诚卫士」组合"
  },
  security_patrol: {
    id: "security_patrol",
    name: "巡逻",
    icon: "🚶",
    type: "skill",
    profession: "security",
    cost: 1,
    shield: 6,
    draw: 1,
    description: "获得 6 护盾，下回合多抽 1 张",
    detail: "【防御牌】护盾+过牌\n稳定防御，下回合多抽1张\n与老师牌触发「班级秩序」组合"
  },
  security_baton: {
    id: "security_baton",
    name: "警棍",
    icon: "🪖",
    type: "attack",
    profession: "security",
    cost: 2,
    damage: 12,
    stun: true,
    description: "造成 12 伤害，眩晕敌人 1 回合",
    detail: "【控制攻击】伤害不错+眩晕\n与流氓牌触发「暴力执法」组合"
  },
  security_id: {
    id: "security_id",
    name: "检查证件",
    icon: "🪪",
    type: "skill",
    profession: "security",
    cost: 1,
    reveal: true,
    draw: 2,
    description: "查看敌人意图，下回合多抽 2 张",
    detail: "【情报牌】知道敌人要做什么\n下回合多抽2张\n信息就是力量"
  },
  security_call_backup: {
    id: "security_call_backup",
    name: "呼叫支援",
    icon: "📞",
    type: "skill",
    profession: "security",
    cost: 3,
    shield: 20,
    healAll: 10,
    description: "全队回 10 血 + 自己 20 护盾",
    detail: "【大招】保安的最强防御牌\n全队回血+巨额护盾\n保命神技"
  },

  // ===== 流氓 =====
  // 定位：纯物理输出，配合狗/保安打爆发
  hooligan_punch: {
    id: "hooligan_punch",
    name: "拳头",
    icon: "👊",
    type: "attack",
    profession: "hooligan",
    cost: 1,
    damage: 6,
    description: "造成 6 伤害（物理输出）",
    detail: "流氓的基础攻击牌\n低费适中伤害\n与狗牌触发「街头恶霸」组合\n与保安牌触发「暴力执法」组合"
  },
  hooligan_kick: {
    id: "hooligan_kick",
    name: "飞踢",
    icon: "🦶",
    type: "attack",
    profession: "hooligan",
    cost: 2,
    damage: 12,
    description: "造成 12 伤害",
    detail: "流氓的中等伤害攻击\n适合爆发输出\n可与狗牌触发「街头恶霸」组合"
  },

  hooligan_uppercut: {
    id: "hooligan_uppercut",
    name: "上勾拳",
    icon: "🥊",
    type: "attack",
    profession: "hooligan",
    cost: 2,
    damage: 12,
    stun: true,
    lockedByDefault: true,
    description: "造成 12 伤害，眩晕敌人 1 回合",
    detail: "【成就解锁】高爆发控制\n单卡质量极高，适合压制 Boss\n与任何牌型都能直接增强输出"
  },
  hooligan_steal: {
    id: "hooligan_steal",
    name: "偷窃",
    icon: "💰",
    type: "skill",
    profession: "hooligan",
    cost: 1,
    steal: 8,
    description: "偷取敌人 8 金币",
    detail: "【经济牌】额外获取金币\n不影响战斗但增加收益\n刷钱利器"
  },
  hooligan_intimidate: {
    id: "hooligan_intimidate",
    name: "恐吓",
    icon: "😈",
    type: "skill",
    profession: "hooligan",
    cost: 1,
    weakness: 2,
    description: "敌人伤害 -50% 持续 2 回合",
    detail: "【削弱牌】大幅降低敌人攻击\n对付高攻敌人\n与老师牌触发「思想教育」组合"
  },
  hooligan_sand: {
    id: "hooligan_sand",
    name: "撒沙子",
    icon: "🏖️",
    type: "attack",
    profession: "hooligan",
    cost: 1,
    damage: 3,
    blind: true,
    stun: true,
    description: "造成 3 伤害 + 致盲 + 眩晕",
    detail: "【卑鄙牌】低伤但双控制\n致盲+眩晕，打断敌人\n不讲武德！"
  },
  hooligan_combo: {
    id: "hooligan_combo",
    name: "组合拳",
    icon: "💥",
    type: "attack",
    profession: "hooligan",
    cost: 3,
    damage: 5,
    hitCount: 4,
    description: "造成 5×4 = 20 伤害",
    detail: "【大招】流氓的爆发技能\n4连击，总伤害20\n适合收尾或打爆发\n与狗牌触发「街头恶霸」组合"
  }
};

// 职业颜色
const PROFESSION_COLORS = {
  common: "#888",
  coder: "#9b59b6",      // 程序员 - 紫色
  dog: "#f39c12",        // 狗 - 橙色
  teacher: "#1abc9c",    // 老师 - 青色
  security: "#34495e",   // 保安 - 深灰
  hooligan: "#c0392b",   // 流氓 - 暗红
};

// 职业中文名
const PROFESSION_NAMES = {
  common: "通用",
  coder: "程序员",
  dog: "狗",
  teacher: "老师",
  security: "保安",
  hooligan: "流氓",
};

// 职业角标简称（用于卡牌角标，一眼区分职业）
const PROFESSION_SHORT = {
  common: "通",
  coder: "程",
  dog: "狗",
  teacher: "师",
  security: "保",
  hooligan: "流",
};

// 职业组合效果说明
const PROFESSION_COMBOS = {
  coder: {
    name: "程序员",
    comboCards: ["coder_code", "coder_code_master"],
    combos: [
      { cards: 2, effect: "眩晕敌人1回合" },
      { cards: 3, effect: "眩晕+15伤害" },
      { cards: 4, effect: "眩晕+30伤害" },
      { cards: 5, effect: "眩晕+50伤害+封印敌人技能" }
    ],
    crossProfession: [
      { with: "teacher", name: "网课噩梦", effect: "伤害×3 + 敌人混乱" },
      { with: "dog", name: "摸鱼搭档", effect: "伤害×1.8 + 抽2张牌" }
    ]
  },
  dog: {
    name: "狗",
    comboCards: ["dog_bark", "dog_bite", "dog_tail"],
    crossProfession: [
      { with: "hooligan", name: "街头恶霸", effect: "伤害×2.5 + 眩晕" },
      { with: "security", name: "忠诚卫士", effect: "伤害×2 + 护盾20" }
    ]
  },
  teacher: {
    name: "老师",
    comboCards: ["teacher_lecture", "teacher_homework"],
    crossProfession: [
      { with: "coder", name: "网课噩梦", effect: "伤害×3 + 敌人混乱" },
      { with: "hooligan", name: "思想教育", effect: "伤害×1.5 + 伤害转治疗50%" },
      { with: "security", name: "班级秩序", effect: "伤害×2 + 嘲讽" }
    ]
  },
  security: {
    name: "保安",
    comboCards: ["security_whistle", "security_baton"],
    crossProfession: [
      { with: "dog", name: "忠诚卫士", effect: "伤害×2 + 护盾20" },
      { with: "hooligan", name: "暴力执法", effect: "伤害×3.5 + 无视防御" },
      { with: "teacher", name: "班级秩序", effect: "伤害×2 + 嘲讽" }
    ]
  },
  hooligan: {
    name: "流氓",
    comboCards: ["hooligan_punch", "hooligan_kick", "hooligan_combo"],
    crossProfession: [
      { with: "dog", name: "街头恶霸", effect: "伤害×2.5 + 眩晕" },
      { with: "teacher", name: "思想教育", effect: "伤害×1.5 + 伤害转治疗50%" },
      { with: "security", name: "暴力执法", effect: "伤害×3.5 + 无视防御" }
    ]
  }
};

// 工具函数
const CardUtil = {
  // 创建卡牌元素
  createCardElement(cardId, index) {
    const card = CARDS_DB[cardId];
    if (!card) return null;

    const el = document.createElement("div");
    el.className = `card ${card.profession}`;
    el.draggable = true;
    el.dataset.cardId = cardId;
    el.dataset.index = index;

    const profShort = PROFESSION_SHORT[card.profession] || "通";
    el.innerHTML = `
      <div class="card-profession-badge" data-profession="${card.profession || 'common'}">${profShort}</div>
      <div class="card-icon">${card.icon}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-type">${card.description}</div>
    `;

    // 悬停显示详情
    el.addEventListener("mouseenter", () => CardUtil.showCardTooltip(card, el));
    el.addEventListener("mouseleave", () => CardUtil.hideCardTooltip());

    // 拖拽事件
    el.addEventListener("dragstart", (e) => {
      el.classList.add("dragging");
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
          cardId: cardId,
          index: index,
        })
      );
    });

    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
    });

    return el;
  },

  // 显示卡牌详情提示
  showCardTooltip(card, element) {
    let tooltip = document.getElementById("card-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "card-tooltip";
      tooltip.className = "card-tooltip";
      document.body.appendChild(tooltip);
    }

    // 构建详情内容
    let details = `<div class="tooltip-header">
      <span class="tooltip-icon">${card.icon}</span>
      <span class="tooltip-name">${card.name}</span>
    </div>`;
    
    details += `<div class="tooltip-desc">${card.description}</div>`;
    
    if (card.detail) {
      details += `<div class="tooltip-detail">${card.detail.replace(/\n/g, '<br>')}</div>`;
    }

    // 护盾机制说明（避免玩家误解：护盾如何吸收、毒/火焰如何处理）
    if (card.shield) {
      details += `<div class="tooltip-detail">护盾规则：先扣护盾再扣血。中毒无视护盾；火焰结算时护盾减免只有50%。</div>`;
    }

    // 显示职业组合信息
    if (card.profession !== "common" && PROFESSION_COMBOS[card.profession]) {
      const profCombo = PROFESSION_COMBOS[card.profession];
      
      // 职业内组合（如程序员的代码牌）
      if (profCombo.combos && profCombo.combos.length > 0) {
        details += `<div class="tooltip-combo">
          <div class="tooltip-combo-title">📋 职业组合:</div>`;
        profCombo.combos.forEach(c => {
          details += `<div class="tooltip-combo-item">${c.cards}张 → ${c.effect}</div>`;
        });
        details += `</div>`;
      }

      // 跨职业组合
      if (profCombo.crossProfession && profCombo.crossProfession.length > 0) {
        details += `<div class="tooltip-combo">
          <div class="tooltip-combo-title">🌟 跨职业组合:</div>`;
        profCombo.crossProfession.forEach(c => {
          details += `<div class="tooltip-combo-item">
            <span class="combo-name">${c.name}</span>
            <span class="combo-with">(${PROFESSION_NAMES[c.with]})</span>
            <span class="combo-effect">${c.effect}</span>
          </div>`;
        });
        details += `</div>`;
      }
    }

    tooltip.innerHTML = details;
    
    // 定位
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.right + 10}px`;
    tooltip.style.top = `${rect.top}px`;
    tooltip.style.display = "block";
    tooltip.classList.add("show");
  },

  // 隐藏卡牌详情提示
  hideCardTooltip() {
    const tooltip = document.getElementById("card-tooltip");
    if (tooltip) {
      tooltip.classList.remove("show");
      tooltip.style.display = "none";
    }
  },

  // 获取职业颜色
  getProfessionColor(profession) {
    return PROFESSION_COLORS[profession] || "#888";
  },

  // 随机抽卡
  drawCard(deck, count) {
    const drawn = [];
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      drawn.push(shuffled[i]);
    }
    return drawn;
  },
};

// 导出（Node 环境兼容）
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CARDS_DB, PROFESSION_COLORS, PROFESSION_NAMES, PROFESSION_COMBOS, CardUtil };
}
