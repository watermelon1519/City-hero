// ===== 城市英雄 - 关卡配置 =====
const FLOORS = [
  {
    id: 1,
    name: "街头巷尾",
    description: "城市的阴暗角落，流氓和小混混的领地",
    theme: "street",
    enemies: [
      { id: "thug", name: "街头混混", hp: 95, atk: 8, icon: "👊" },
      { id: "gangster", name: "帮派成员", hp: 125, atk: 10, icon: "🧢" },
      { id: "dealer", name: "黑市商贩", hp: 85, atk: 6, icon: "💰" },
      { id: "pickpocket", name: "扒手", hp: 70, atk: 5, icon: "🦝" },
    ],
    boss: { id: "boss_gang", name: "黑帮老大", hp: 420, atk: 12, icon: "🕶️", aiType: "boss1" },
    events: [
      { id: "alley_cat", name: "巷子里的猫", icon: "🐱", description: "一只流浪猫向你讨食，你给了点钱。", effect: { gold: 15 } },
      { id: "street_vendor", name: "路边摊", icon: "🍜", description: "深夜的路边摊飘来香味，你买了一份。", effect: { gold: -10, healAll: true } },
      { id: "police_patrol", name: "警察巡逻", icon: "🚔", description: "警车驶过，你被盘问后放行。", effect: { gold: 5 } },
      { id: "mugged", name: "被抢", icon: "😱", description: "暗巷里有人抢了你的钱包！", effect: { gold: -25 } },
    ],
    bgColor: "#1a1a2e",
    accentColor: "#e94560"
  },
  {
    id: 2,
    name: "校园风云",
    description: "学校不只是读书的地方，还有操场上的较量",
    theme: "school",
    enemies: [
      { id: "bully", name: "校园恶霸", hp: 70, atk: 9, icon: "😤" },
      { id: "cheater", name: "作弊学生", hp: 45, atk: 5, icon: "📝" },
      { id: "fanatic", name: "成绩狂", hp: 55, atk: 7, icon: "📚" },
      { id: "playground_kid", name: "调皮学生", hp: 35, atk: 4, icon: "⚽" },
    ],
    boss: { id: "boss_principal", name: "恶魔校长", hp: 340, atk: 14, icon: "👔", aiType: "boss2_poison" },
    events: [
      { id: "exam_paper", name: "掉落的试卷", icon: "📄", description: "捡到试卷交给失主，对方酬谢。", effect: { gold: 25 } },
      { id: "vending_machine", name: "自动贩卖机", icon: "🥤", description: "投币后卡住了，钱没了。", effect: { gold: -15 } },
      { id: "pe_class", name: "体育课器材室", icon: "🏀", description: "借到器材，锻炼了一下。", effect: { healAll: true } },
      { id: "detention", name: "被留堂", icon: "📚", description: "莫名其妙被留堂，身心俱疲。", effect: { damage: 8 } },
    ],
    bgColor: "#16213e",
    accentColor: "#0f3460"
  },
  {
    id: 3,
    name: "科技园区",
    description: "高楼大厦背后，程序员们在加班中战斗",
    theme: "tech",
    enemies: [
      { id: "bug", name: "Bug怪", hp: 50, atk: 6, icon: "🐛" },
      { id: "pm", name: "产品经理", hp: 80, atk: 10, icon: "📋" },
      { id: "deadline", name: "Deadline", hp: 100, atk: 15, icon: "⏰" },
      { id: "coffee_zombie", name: "咖啡僵尸", hp: 60, atk: 8, icon: "☕" },
    ],
    boss: { id: "boss_cto", name: "CTO大魔王", hp: 450, atk: 18, icon: "💀", aiType: "boss3_crack", armor: 8 },
    events: [
      { id: "vending_coffee", name: "咖啡机", icon: "☕", description: "免费咖啡，精神一振！", effect: { gold: 10, buff: "damage", value: 1.1 } },
      { id: "code_review", name: "代码审查", icon: "👀", description: "发现 Bug 修掉，拿了奖金。", effect: { gold: 35 } },
      { id: "meeting_room", name: "会议室", icon: "🪑", description: "被拉去开会，浪费生命。", effect: { damage: 5 } },
      { id: "overtime", name: "强制加班", icon: "💀", description: "加班到深夜，扣血。", effect: { gold: 20, damage: 12 } },
    ],
    bgColor: "#0d1b2a",
    accentColor: "#1b263b"
  },
  {
    id: 4,
    name: "住宅小区",
    description: "看似平静的小区，暗藏着各种邻里纠纷",
    theme: "residential",
    enemies: [
      { id: "noisy_neighbor", name: "吵闹邻居", hp: 55, atk: 7, icon: "📢" },
      { id: "auntie", name: "广场舞大妈", hp: 90, atk: 12, icon: "💃" },
      { id: "pet_dog", name: "恶犬", hp: 45, atk: 8, icon: "🐕" },
      { id: "property_mgr", name: "物业大爷", hp: 70, atk: 6, icon: "🧓" },
    ],
    boss: { id: "boss_hoa", name: "业委会主任", hp: 550, atk: 20, icon: "🏠", aiType: "boss4_tank" },
    events: [
      { id: "lost_package", name: "快递驿站", icon: "📦", description: "帮邻居取件，收到小费。", effect: { gold: 20 } },
      { id: "community_garden", name: "社区花园", icon: "🌻", description: "在花园休息了一会。", effect: { healAll: true } },
      { id: "elevator", name: "电梯故障", icon: "🛗", description: "爬楼梯累个半死。", effect: { damage: 10 } },
      { id: "noise", name: "邻居装修", icon: "🔨", description: "噪音攻击，掉血。", effect: { damage: 6 } },
    ],
    bgColor: "#1a1a2e",
    accentColor: "#4a4e69"
  },
  {
    id: 5,
    name: "城市中心",
    description: "繁华的商业区，权力的中心，最终决战的舞台",
    theme: "city_center",
    enemies: [
      { id: "corporate", name: "公司高管", hp: 100, atk: 14, icon: "👔" },
      { id: "taxi_driver", name: "暴躁司机", hp: 70, atk: 11, icon: "🚕" },
      { id: "street_food", name: "摊贩老板", hp: 80, atk: 10, icon: "🍢" },
      { id: "influencer", name: "网红达人", hp: 60, atk: 9, icon: "📱" },
    ],
    boss: { id: "boss_mayor", name: "城市大Boss", hp: 650, atk: 25, icon: "👑", aiType: "boss5_control" },
    events: [
      { id: "subway", name: "地铁站", icon: "🚇", description: "捡到别人掉的零钱。", effect: { gold: 30 } },
      { id: "shopping_mall", name: "商场大促", icon: "🛒", description: "剁手了。", effect: { gold: -40 } },
      { id: "park", name: "城市公园", icon: "🌳", description: "散步放松。", effect: { healAll: true } },
      { id: "scam", name: "街头骗局", icon: "🎭", description: "被骗走了一笔钱。", effect: { gold: -30 } },
    ],
    bgColor: "#0f0f23",
    accentColor: "#ff6b6b"
  }
];

// ===== 基础牌型伤害规则（职业/街头风格命名，用于「牌型/伤害规则」界面）=====
const BASE_COMBO_RULES = [
  { name: "单张", rule: "伤害总和 × 1.0（通用牌不计入牌型）" },
  { name: "搭档", rule: "伤害总和 × 1.3（2张同职业同流派/属性；通用牌不计入）" },
  { name: "双组", rule: "伤害总和 × 1.6（两对同职业同流派/属性；通用牌不计入）" },
  { name: "小队", rule: "伤害总和 × 2.0（3张同职业同流派/属性；通用牌不计入）" },
  { name: "核心队", rule: "伤害总和 × 2.8（3+2 同职业同流派/属性组合；通用牌不计入）" },
  { name: "大队", rule: "伤害总和 × 3.5（4张同职业同流派/属性；通用牌不计入）" },
];

// 程序员代码牌组合规则说明
const CODE_COMBO_RULES_TEXT = "敲代码=1张等效，重构代码=2张等效。2张等效：眩晕+8伤害；3张：+18伤害+眩晕；4张：+32伤害+眩晕；5张：+50伤害+眩晕。";

// ===== 隐藏跨职业组合系统 =====
// 这些组合需要特定卡牌才能触发，不是任意该职业卡牌都可以
const HIDDEN_COMBOS = [
  // 流氓 + 狗 = 街头恶霸
  {
    id: "street_thug",
    name: "🐕‍🦺 街头恶霸",
    description: "流氓和狗联手，街头无敌！",
    professions: ["hooligan", "dog"],
    // 需要的卡牌组合：流氓攻击牌 + 狗攻击牌
    requiredCards: {
      hooligan: ["hooligan_punch", "hooligan_kick", "hooligan_sand", "hooligan_combo"],
      dog: ["dog_bark", "dog_bite"]
    },
    minCards: 3,
    effect: { damageMultiplier: 2.0, stun: true },
    discovered: false,
    icon: "🐕‍🦺",
    hint: "需要：流氓攻击牌 + 狗叫/咬牌（共3张以上）"
  },
  
  // 程序员 + 老师 = 网课噩梦
  {
    id: "online_class_nightmare",
    name: "💻 网课噩梦",
    description: "老师教编程，Bug 翻倍！",
    professions: ["coder", "teacher"],
    requiredCards: {
      coder: ["coder_code", "coder_code_master", "coder_bug"],
      teacher: ["teacher_lecture", "teacher_homework", "teacher_redpen"]
    },
    minCards: 3,
    effect: { damageMultiplier: 2.5, confusion: true },
    discovered: false,
    icon: "📹",
    hint: "需要：程序员代码牌 + 老师说教牌（共3张以上）"
  },
  
  // 保安 + 狗 = 忠诚卫士
  {
    id: "loyal_guardian",
    name: "🐕 忠诚卫士",
    description: "保安配警犬，安全翻倍！",
    professions: ["security", "dog"],
    requiredCards: {
      security: ["security_whistle", "security_patrol", "security_baton"],
      dog: ["dog_bark", "dog_tail"]
    },
    minCards: 3,
    effect: { damageMultiplier: 1.8, shield: 20 },
    discovered: false,
    icon: "🛡️",
    hint: "需要：保安控制牌 + 狗叫/摇尾牌（共3张以上）"
  },
  
  // 老师 + 流氓 = 思想教育
  {
    id: "reeducation",
    name: "📚 思想教育",
    description: "老师改造流氓，伤害转治疗！",
    professions: ["teacher", "hooligan"],
    requiredCards: {
      teacher: ["teacher_lecture", "teacher_homework", "teacher_redpen"],
      hooligan: ["hooligan_intimidate", "hooligan_sand"]
    },
    minCards: 2,
    effect: { damageMultiplier: 1.5, healFromDamage: 0.5 },
    discovered: false,
    icon: "🎓",
    hint: "需要：老师说教牌 + 流氓控制牌（共2张以上）"
  },
  
  // 程序员 + 狗 = 摸鱼搭档
  {
    id: "slacking_duo",
    name: "🐕 摸鱼搭档",
    description: "程序员写 Bug，狗负责卖萌！",
    professions: ["coder", "dog"],
    requiredCards: {
      coder: ["coder_code", "coder_bug", "coder_coffee"],
      dog: ["dog_tail", "dog_fetch", "dog_goodboy"]
    },
    minCards: 2,
    effect: { damageMultiplier: 1.6, draw: 2 },
    discovered: false,
    icon: "🎮",
    hint: "需要：程序员代码牌 + 狗辅助牌（共2张以上）"
  },
  
  // 保安 + 老师 = 班级秩序
  {
    id: "class_order",
    name: "👮 班级秩序",
    description: "老师讲课，保安镇场！",
    professions: ["security", "teacher"],
    requiredCards: {
      security: ["security_flashlight", "security_whistle", "security_id"],
      teacher: ["teacher_lecture", "teacher_homework"]
    },
    minCards: 2,
    effect: { damageMultiplier: 1.8, taunt: true },
    discovered: false,
    icon: "🏫",
    hint: "需要：保安控制牌 + 老师说教牌（共2张以上）"
  },
  
  // 保安 + 流氓 = 暴力执法
  {
    id: "brute_force",
    name: "👊 暴力执法",
    description: "保安和流氓联手，物理输出爆炸！",
    professions: ["security", "hooligan"],
    requiredCards: {
      security: ["security_baton", "security_flashlight"],
      hooligan: ["hooligan_punch", "hooligan_kick", "hooligan_combo"]
    },
    minCards: 3,
    effect: { damageMultiplier: 3.0, ignoreDefense: true },
    discovered: false,
    icon: "💥",
    hint: "需要：保安武器牌 + 流氓攻击牌（共3张以上）"
  },
  
  // 三职业组合：程序员 + 狗 + 老师 = 网课摸鱼
  {
    id: "online_slacking",
    name: "🎮 网课摸鱼",
    description: "程序员开直播，狗卖萌，老师假装在讲课！",
    professions: ["coder", "dog", "teacher"],
    requiredCards: {
      coder: ["coder_code", "coder_bug", "coder_coffee"],
      dog: ["dog_tail", "dog_fetch"],
      teacher: ["teacher_lecture", "teacher_homework"]
    },
    minCards: 4,
    effect: { damageMultiplier: 3.5, healAll: 30, draw: 3 },
    discovered: false,
    icon: "🎭",
    hint: "需要：程序员代码牌 + 狗辅助牌 + 老师说教牌（共4张以上）"
  },
  
  // 三职业组合：保安 + 流氓 + 狗 = 地下势力
  {
    id: "underground_power",
    name: "🕵️ 地下势力",
    description: "黑白两道通吃，伤害爆炸！",
    professions: ["security", "hooligan", "dog"],
    requiredCards: {
      security: ["security_whistle", "security_baton"],
      hooligan: ["hooligan_punch", "hooligan_kick", "hooligan_combo"],
      dog: ["dog_bark", "dog_bite"]
    },
    minCards: 4,
    effect: { damageMultiplier: 4.0, stun: true, extraTurn: true },
    discovered: false,
    icon: "🕶️",
    hint: "需要：保安控制牌 + 流氓攻击牌 + 狗攻击牌（共4张以上）"
  },
  
  // 四职业组合：程序员 + 老师 + 狗 + 保安 = 办公室生态
  {
    id: "office_ecosystem",
    name: "🏢 办公室生态",
    description: "程序员干活，狗陪玩，老师教育，保安看门！",
    professions: ["coder", "teacher", "dog", "security"],
    requiredCards: {
      coder: ["coder_code", "coder_coffee"],
      teacher: ["teacher_lecture"],
      dog: ["dog_tail", "dog_goodboy"],
      security: ["security_patrol", "security_whistle"]
    },
    minCards: 5,
    effect: { damageMultiplier: 5.0, healAll: 50, shield: 30, draw: 4 },
    discovered: false,
    icon: "🌟",
    hint: "需要：四职业各至少一张特定牌（共5张以上）"
  },
  
  // 全职业组合：终极混乱
  {
    id: "ultimate_chaos",
    name: "🔥 终极混乱",
    description: "全员出动！荒诞宇宙大爆发！",
    professions: ["coder", "teacher", "dog", "security", "hooligan"],
    requiredCards: {
      coder: ["coder_code", "coder_deadline"],
      teacher: ["teacher_failing", "teacher_summer"],
      dog: ["dog_goodboy", "dog_dig"],
      security: ["security_call_backup", "security_baton"],
      hooligan: ["hooligan_combo", "hooligan_steal"]
    },
    minCards: 5,
    effect: { damageMultiplier: 6.0, healAll: 100, stun: true, extraTurn: true },
    discovered: false,
    icon: "🌈",
    hint: "需要：五职业终极技能牌各一张（共5张以上）"
  }
];

// 检查隐藏组合 - 现在检查具体卡牌
function checkHiddenCombos(cards, discoveredCombos) {
  const results = [];
  const cardIds = cards.map(c => c.id).filter(id => id);
  const profCount = {};
  
  for (const c of cards) {
    if (!c || !c.profession) continue;
    profCount[c.profession] = (profCount[c.profession] || 0) + 1;
  }
  
  for (const combo of HIDDEN_COMBOS) {
    // 检查是否已经发现
    if (discoveredCombos && discoveredCombos.includes(combo.id)) continue;
    
    // 检查职业是否匹配
    const hasAllProfessions = combo.professions.every(p => profCount[p] > 0);
    if (!hasAllProfessions) continue;
    
    // 检查具体卡牌要求
    if (combo.requiredCards) {
      let hasRequiredCards = true;
      
      for (const prof of Object.keys(combo.requiredCards)) {
        const requiredForProf = combo.requiredCards[prof];
        const hasAny = requiredForProf.some(cardId => cardIds.includes(cardId));
        if (!hasAny) {
          hasRequiredCards = false;
          break;
        }
      }
      
      if (!hasRequiredCards) continue;
    }
    
    // 检查卡牌数量
    const totalCards = combo.professions.reduce((sum, p) => sum + (profCount[p] || 0), 0);
    if (totalCards < combo.minCards) continue;
    
    // 触发组合！
    results.push({
      combo: combo,
      totalCards: totalCards,
      cardsUsed: cardIds.filter(id => 
        Object.values(combo.requiredCards || {}).flat().includes(id)
      ),
      isNew: !discoveredCombos || !discoveredCombos.includes(combo.id)
    });
  }
  
  return results;
}

// 职业显示名（用于牌型说明）
const PROF_DISPLAY = { coder: "程序员", dog: "狗", teacher: "老师", security: "保安", hooligan: "流氓" };
const ARCH_DISPLAY = {
  // 优先使用卡牌自带 archetype（如：流氓=攻/守/割），否则回退到 type（attack/skill/...）
  attack: "攻",
  skill: "守",
  item: "技",
  "攻": "攻",
  "守": "守",
  "防": "防",
  "控": "控",
  "割": "割",
  "流": "流",
};

// 牌型 + 组合技结算
function evaluateCombo(cards, gameState) {
  // 新规则：必须“同职业 + 同流派(属性)”才计入牌型
  // - 流派优先用 c.archetype（例如：流氓=攻/守/割）
  // - 没有 archetype 的职业，回退到 c.type（attack/skill/...）
  const groupCount = {};
  const groupMeta = {}; // key -> { profession, archLabel }

  const normProf = (p) => (p && typeof p === "string" ? p : "common");
  const normArch = (c) => {
    const raw = (c && (c.archetype || c.type)) || "";
    const label = ARCH_DISPLAY[raw] || (raw ? String(raw) : "攻");
    return label;
  };
  const makeKey = (c) => `${normProf(c.profession)}:${normArch(c)}`;

  for (const c of cards) {
    if (!c) continue;
    const prof = normProf(c.profession);
    if (prof === "common") continue;
    const key = makeKey(c);
    groupCount[key] = (groupCount[key] || 0) + 1;
    if (!groupMeta[key]) groupMeta[key] = { profession: prof, archLabel: normArch(c) };
  }

  const groupCounts = Object.values(groupCount);
  const totalNonCommon = groupCounts.reduce((a, b) => a + b, 0);
  const totalCards = cards.length;

  const sorted = [...groupCounts].sort((a, b) => b - a);
  const pairs = groupCounts.filter((c) => c >= 2).length;
  const hasThree = groupCounts.some((c) => c >= 3);
  const hasFour = groupCounts.some((c) => c >= 4);
  const second = sorted[1] || 0;

  let bestMultiplier = 1.0;
  let bestName = "单张";
  let comboReason = ""; // 用于 UI 展示：如 "2张流氓"
  const reasons = [];
  let bestGroupTopKey = null;   // 本次牌型的“主流派组”（用于流派道具/流血叠层）
  let bestGroupTopCount = 0;

  function tryUpdate(mult, name, reason) {
    if (mult > bestMultiplier) {
      bestMultiplier = mult;
      bestName = name;
      comboReason = reason || "";
    }
  }

  function getTopGroupKey(min = 2) {
    const entries = Object.entries(groupCount)
      .filter(([, n]) => n >= min)
      .sort((a, b) => b[1] - a[1]);
    return entries.length ? entries[0][0] : null;
  }

  // 获取触发牌型的职业说明
  function getGroupDesc(min = 2) {
    const entries = Object.entries(groupCount)
      .filter(([, n]) => n >= min)
      .sort((a, b) => b[1] - a[1]);
    const parts = [];
    for (const [k, n] of entries) {
      const meta = groupMeta[k];
      const profLabel = PROF_DISPLAY[meta.profession] || meta.profession;
      parts.push(`${n}张${profLabel}-${meta.archLabel}`);
    }
    return parts.join("+");
  }
  function getGroupDescTop(min = 3) {
    const entries = Object.entries(groupCount)
      .filter(([, n]) => n >= min)
      .sort((a, b) => b[1] - a[1]);
    if (!entries.length) return "";
    const [k, n] = entries[0];
    const meta = groupMeta[k];
    const profLabel = PROF_DISPLAY[meta.profession] || meta.profession;
    return `${n}张${profLabel}-${meta.archLabel}`;
  }

  // ===== 基础牌型（职业组合，非扑克命名）=====
  if (totalNonCommon >= 2 && pairs >= 1) tryUpdate(1.3, "搭档", getGroupDesc(2));
  if (pairs >= 2) tryUpdate(1.6, "双组", getGroupDesc(2));
  if (hasThree) tryUpdate(2.0, "小队", getGroupDescTop(3));
  if (hasThree && (second >= 2 || pairs >= 2)) tryUpdate(2.8, "核心队", getGroupDesc(2));
  if (hasFour) tryUpdate(3.5, "大队", getGroupDescTop(4));

  // 记录本次牌型的“主流派组”（按牌型等级取不同阈值）
  const need = (bestName === "小队") ? 3 : (bestName === "大队") ? 4 : (bestName === "单张") ? 999 : 2;
  bestGroupTopKey = getTopGroupKey(need);
  bestGroupTopCount = bestGroupTopKey ? (groupCount[bestGroupTopKey] || 0) : 0;

  // ===== 检查隐藏组合 =====
  const discoveredCombos = gameState?.discoveredCombos || [];
  const hiddenComboResults = checkHiddenCombos(cards, discoveredCombos);
  
  let hiddenMultiplier = 1.0;
  let hiddenBonusDamage = 0;
  const hiddenComboNames = [];
  
  for (const result of hiddenComboResults) {
    const combo = result.combo;
    hiddenComboNames.push(combo.name);
    
    if (combo.effect.damageMultiplier) {
      hiddenMultiplier *= combo.effect.damageMultiplier;
    }
    if (combo.effect.extraDamage) {
      hiddenBonusDamage += combo.effect.extraDamage;
    }
    
    if (result.isNew) {
      result.isNewlyDiscovered = true;
    }
  }

  // ===== 流派道具：命中“职业-流派”牌型时，倍率再乘 N =====
  let comboTypeExtraMult = 1.0;
  try {
    const items = gameState?.items || [];
    if (bestGroupTopKey && typeof ItemUtil !== "undefined" && items && items.length) {
      const meta = groupMeta[bestGroupTopKey];
      if (meta) {
        const eff = ItemUtil.calculateEffects(items, { comboTypeProfession: meta.profession, comboTypeArch: meta.archLabel }) || {};
        const m = eff.comboTypeMults && eff.comboTypeMults[bestGroupTopKey];
        if (typeof m === "number" && isFinite(m) && m > 0) comboTypeExtraMult *= m;
      }
    }
  } catch (_) {}

  // ===== 流血流派：若命中组里存在流血牌，则本回合流血叠层按“命中组张数”倍增 =====
  let bleedStackMultiplier = 1;
  try {
    if (bestGroupTopKey && bestGroupTopCount >= 2) {
      const meta = groupMeta[bestGroupTopKey];
      if (meta && meta.archLabel === "割") {
        const hasBleed = cards.some((c) => {
          if (!c) return false;
          const k = `${normProf(c.profession)}:${normArch(c)}`;
          return k === bestGroupTopKey && (c.bleed || 0) > 0;
        });
        if (hasBleed) bleedStackMultiplier = Math.max(1, Math.floor(bestGroupTopCount));
      }
    }
  } catch (_) {}

  // ===== 程序员代码牌组合（敲代码 + 重构代码）=====
  // 敲代码=1，重构代码=2，按等效数量触发
  const CODE_CARD_IDS = ["coder_code", "coder_code_master"];
  const CODE_COMBO_TABLE = {
    2: { damage: 8, stun: true },
    3: { damage: 18, stun: true },
    4: { damage: 32, stun: true },
    5: { damage: 50, stun: true },
  };
  let codeEquivalent = 0;
  for (const c of cards) {
    if (!c || !c.id) continue;
    if (c.id === "coder_code") codeEquivalent += 1;
    else if (c.id === "coder_code_master") codeEquivalent += (typeof CARDS_DB !== "undefined" && CARDS_DB[c.id]?.comboValue) || 2;
  }
  let codeComboDamage = 0;
  let codeComboStun = false;
  if (codeEquivalent >= 2) {
    const tier = Math.min(codeEquivalent, 5);
    const effect = CODE_COMBO_TABLE[tier] || CODE_COMBO_TABLE[5];
    codeComboDamage = effect.damage || 0;
    codeComboStun = effect.stun || false;
  }

  // 计算总伤害：基础伤害×倍率 + 代码牌组合伤害（代码牌组合伤害不受牌型倍率影响）
  const cardDamage = cards.reduce((sum, c) => sum + (c.baseDamage || 0), 0);
  // finalMultiplier 会在构建完 cross-arch 组合后计算
  let finalMultiplier = 1.0;
  let totalDamage = 0;

  // 构建描述
  const reasonText = comboReason ? `牌型：${bestName}（${comboReason}）×${bestMultiplier.toFixed(1)}` : `牌型：${bestName} ×${bestMultiplier.toFixed(1)}`;
  reasons.push(reasonText);
  if (codeEquivalent >= 2) {
    reasons.push(`💻 代码组合（${codeEquivalent}张等效）：${codeComboStun ? "眩晕" : ""}${codeComboDamage ? ` +${codeComboDamage}伤害` : ""}`);
  }
  if (hiddenComboNames.length > 0) {
    reasons.push(`🌟 隐藏组合：${hiddenComboNames.join("，")}`);
  }

  // 构建牌型与隐藏组合分行说明，供 UI 展示
  const baseLine = comboReason
    ? `${bestName}（${comboReason}）×${bestMultiplier.toFixed(1)}`
    : `${bestName}×${bestMultiplier.toFixed(1)}`;
  const hiddenLines = [];
  for (const r of hiddenComboResults) {
    const mult = r.combo.effect.damageMultiplier;
    if (!mult) continue;
    const label = r.isNewlyDiscovered ? '*****' : r.combo.name;
    hiddenLines.push(`${label}×${mult}`);
  }

  // ===== 跨职业同流派“组合技”（白名单，不是同流派就通用加成）=====
  // 触发条件：同一流派下，指定职业各至少出 1 张，且两者合计张数 ≥ minTotal
  // 效果：可以是倍率/额外伤害/额外控制等（通过 extraEffects 交给战斗层处理）
  const CROSS_ARCH_COMBOS = [
    // 你提到的例子：狗·攻 + 流氓·攻
    { id: "cross_dog_hooligan_atk", name: "街头围攻", arch: "攻", professions: ["dog", "hooligan"], minTotal: 3, mult: 1.15, extraStunTurns: 1 },
  ];
  let crossArchMult = 1.0;
  let crossExtraStunTurns = 0;
  const crossLines = [];
  try {
    const count = {}; // `${prof}:${arch}` -> n
    for (const c of cards) {
      if (!c) continue;
      const prof = normProf(c.profession);
      if (prof === "common") continue;
      const arch = normArch(c);
      const k = `${prof}:${arch}`;
      count[k] = (count[k] || 0) + 1;
    }
    for (const combo of CROSS_ARCH_COMBOS) {
      const [p1, p2] = combo.professions || [];
      if (!p1 || !p2) continue;
      const n1 = count[`${p1}:${combo.arch}`] || 0;
      const n2 = count[`${p2}:${combo.arch}`] || 0;
      const total = n1 + n2;
      if (n1 < 1 || n2 < 1) continue;
      if (total < (combo.minTotal || 3)) continue;
      if (typeof combo.mult === "number" && combo.mult > 0) crossArchMult *= combo.mult;
      if (typeof combo.extraStunTurns === "number") crossExtraStunTurns = Math.max(crossExtraStunTurns, Math.floor(combo.extraStunTurns));
      const bits = [];
      if (combo.mult && combo.mult !== 1) bits.push(`×${combo.mult}`);
      if (combo.extraStunTurns) bits.push(`眩晕+${combo.extraStunTurns}T`);
      crossLines.push(`${combo.name}${bits.length ? `（${bits.join("，")}）` : ""}`);
    }
  } catch (_) {}
  if (crossLines.length) {
    reasons.push(`🤝 跨职业组合技：${crossLines.join("，")}`);
    hiddenLines.push(...crossLines);
  }

  // 应用隐藏组合倍率
  finalMultiplier = bestMultiplier * hiddenMultiplier;
  // 最终倍率：基础牌型 × 隐藏组合 × 流派道具 ×（白名单）跨职业组合技
  finalMultiplier *= comboTypeExtraMult;
  finalMultiplier *= crossArchMult;
  totalDamage = Math.floor(cardDamage * finalMultiplier + hiddenBonusDamage + codeComboDamage);
  const breakdownText = [baseLine, ...hiddenLines].join(' | ');

  return {
    multiplier: bestMultiplier,
    comboName: bestName,
    comboReason,
    baseLine,
    hiddenLines,
    breakdownText,
    combosHit: [],
    extraFlatDamage: 0,
    baseDamage: cardDamage,
    codeComboDamage,
    codeComboStun,
    totalDamage,
    extraEffects: {
      bleedStackMultiplier,
      extraStunTurns: crossExtraStunTurns,
    },
    summary: reasons.join(" | "),
    hiddenCombos: hiddenComboResults,
    hiddenMultiplier,
    finalMultiplier
  };
}

// 获取当前关卡配置
function getCurrentFloor(floorNum) {
  return FLOORS[Math.min(floorNum, FLOORS.length) - 1] || FLOORS[FLOORS.length - 1];
}

// 获取随机敌人
function getRandomEnemy(floorNum) {
  const floor = getCurrentFloor(floorNum);
  const enemies = floor.enemies;
  return enemies[Math.floor(Math.random() * enemies.length)];
}

// 获取Boss
function getBoss(floorNum) {
  const floor = getCurrentFloor(floorNum);
  return floor.boss;
}

// 获取随机事件
function getRandomEvent(floorNum) {
  const floor = getCurrentFloor(floorNum);
  const events = floor.events;
  return events[Math.floor(Math.random() * events.length)];
}

// 浏览器环境挂载
if (typeof window !== "undefined") {
  window.evaluateCombo = evaluateCombo;
  window.HIDDEN_COMBOS = HIDDEN_COMBOS;
  window.BASE_COMBO_RULES = BASE_COMBO_RULES;
  window.CODE_COMBO_RULES_TEXT = CODE_COMBO_RULES_TEXT;
  window.checkHiddenCombos = checkHiddenCombos;
  window.FLOORS = FLOORS;
  window.getCurrentFloor = getCurrentFloor;
  window.getRandomEnemy = getRandomEnemy;
  window.getBoss = getBoss;
  window.getRandomEvent = getRandomEvent;
}
