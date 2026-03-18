// 游戏主逻辑（战斗原型）
class Game {
  constructor() {
    this.battle = new BattleSystem(this);
    this.items = []; // 初始道具为空
    this.itemSlotCapacity = 10; // 道具栏容量（暂定上限 10）
    this.gold = 100; // 初始金币
    this.difficulty = 1;
    this.maxDifficultyUnlocked = 1;
    this.difficultiesCompleted = [];
    this.gameStarted = false; // 游戏是否已开始
    this.isFirstBattle = true; // 是否是第一场战斗
    this.gameEnded = false;
    this.turnDamageCommitted = false; // 本回合是否已结算伤害（未结算时显示预计伤害）
    this.cardLevels = {}; // 卡牌类型 -> 等级 (1~3)，用于商店升级与战斗结算
    this.battleUIEnabled = true; // 战斗交互是否可用（结算/动画期间会锁定）

    // 地图
    this.map = new MapManager(this);
    this.currentNode = null;
    this.view = "map"; // map | battle | shop | event

    // 成就系统：发现的隐藏组合
    this.discoveredCombos = [];
    this.loadDiscoveredCombos();

    // 当前选择的职业组合（难度1开局仅流氓可用）
    this.selectedProfessions = ["hooligan"];
    // 已解锁职业（难度1：开局仅流氓；后续通关解锁）
    this.unlockedProfessions = ["hooligan"];
    this.loadUnlockedProfessions();

    // 已解锁卡牌/道具（用于“成就解锁内容”与商店卡池过滤）
    this.unlockedCards = [];
    this.unlockedItems = [];
    this.loadUnlocks();

    // 统计（用于进度型成就）
    this.stats = {
      goldEarned: 0,
      battlesWon: 0,
      bossesDefeated: 0,
      combosDiscovered: 0,
      itemsBought: 0,
      cardsBought: 0,
      cardsUpgraded: 0,
      maxDamage: 0,
    };
    this.loadStats();

    // 商店和事件状态
    this.shopItems = null;
    this.currentEvent = null;

    // 特效管理器
    this.effects = new EffectsManager(this);

    // 成就列表（支持奖励：解锁职业/卡牌/道具）
    this.achievements = [
      { id: 'first_win', name: '初次胜利', desc: '完成第一场战斗', icon: '⚔️', unlocked: false },
      { id: 'first_boss', name: 'Boss猎手', desc: '击败第2层Boss', icon: '👑', unlocked: false, reward: { type: "profession", id: "security" } },
      { id: 'combo_master', name: '组合大师', desc: '发现 10 种隐藏组合', icon: '🌟', unlocked: false, criteria: { stat: "combosDiscovered", gte: 10 }, reward: { type: "item", id: "hero_medal" } },
      { id: 'rich', name: '富翁', desc: '累计获得 500 金币', icon: '💰', unlocked: false, criteria: { stat: "goldEarned", gte: 500 }, reward: { type: "item", id: "coupon_book" } },
      { id: 'big_hit', name: '一拳超人', desc: '单回合造成 ≥150 伤害', icon: '💥', unlocked: false, criteria: { stat: "maxDamage", gte: 150 }, reward: { type: "card", id: "hooligan_uppercut" } },
      { id: 'shopaholic', name: '剁手达人', desc: '累计购买 3 个道具', icon: '🛍️', unlocked: false, criteria: { stat: "itemsBought", gte: 3 }, reward: { type: "card", id: "coder_pull_request" } },
      { id: 'floor5', name: '城市英雄', desc: '通关第 5 层', icon: '🏆', unlocked: false, reward: { type: "item", id: "hero_medal" } },
    ];
    this.loadAchievements();
    // 进度型成就：启动时也尝试补判一次
    this.checkCriteriaAchievements();

    // 设置：是否启用教学关（默认关闭=跳过教学）
    this.tutorialEnabled = this.loadTutorialEnabled();

    this.init();
  }

  loadTutorialEnabled() {
    try {
      const k = "cityHeroTutorialEnabled";
      const v = localStorage.getItem(k);
      if (v == null) return false;
      return v === "1" || v === "true";
    } catch (_) {
      return false;
    }
  }

  setTutorialEnabled(enabled) {
    this.tutorialEnabled = !!enabled;
    try {
      localStorage.setItem("cityHeroTutorialEnabled", this.tutorialEnabled ? "1" : "0");
    } catch (_) {}
  }

  // 基础出牌上限（可被道具提高）
  getBasePlayedLimit() {
    return 5;
  }

  getItemSlotCapacity() {
    return Math.min(10, Math.max(1, Math.floor(this.itemSlotCapacity || 10)));
  }

  increaseItemSlotCapacity(delta = 1) {
    const d = Math.max(0, Math.floor(delta || 0));
    if (!d) return;
    this.itemSlotCapacity = this.getItemSlotCapacity() + d;
    this.renderItems();
    this.log(`🎒 道具栏扩展：容量 +${d}（当前 ${this.getItemSlotCapacity()} 格）`, "system");
  }

  // 控制命中加成（用于对抗 Boss 免控）
  getControlChanceBonusFromItems() {
    try {
      const items = Array.isArray(this.items) ? this.items : [];
      let bonus = 0;
      for (const id of items) {
        const item = (typeof ITEMS_DB !== "undefined") ? ITEMS_DB[id] : null;
        if (!item || !item.effect) continue;
        const eff = item.effect({}) || {};
        if (typeof eff.controlChanceBonus === "number") bonus += eff.controlChanceBonus;
      }
      return bonus;
    } catch (_) {
      return 0;
    }
  }

  getPlayedLimitBonus() {
    try {
      const items = Array.isArray(this.items) ? this.items : [];
      let bonus = 0;
      for (const id of items) {
        if (typeof ITEMS_DB === "undefined" || !ITEMS_DB[id] || !ITEMS_DB[id].effect) continue;
        // 注意：部分道具在回合开始才确定（如骰子），此处只统计“常驻上限加成”
        const eff = ITEMS_DB[id].effect({}) || {};
        if (typeof eff.playedLimitBonus === "number") bonus += eff.playedLimitBonus;
      }
      return bonus;
    } catch (_) {
      return 0;
    }
  }

  getPlayedLimit() {
    const slots = this.getPlayedSlotCount();
    const broken = this.getBrokenPlayedSlots().size;
    return Math.max(1, slots - broken);
  }

  // 出牌区“格子”总数：基础 + 道具常驻 + 本回合临时（骰子）
  getPlayedSlotCount() {
    return this.getBasePlayedLimit() + this.getPlayedLimitBonus() + (this._tempPlayedLimitBonusThisTurn || 0);
  }

  getBrokenPlayedSlots() {
    const out = new Set();
    (this._permaBrokenPlayedSlots || []).forEach((i) => {
      const idx = Math.floor(i);
      if (Number.isFinite(idx) && idx >= 0) out.add(idx);
    });
    const arr = Array.isArray(this._brokenPlayedSlots) ? this._brokenPlayedSlots : [];
    for (const x of arr) {
      if (!x) continue;
      const idx = Math.floor(x.idx);
      const turns = Math.floor(x.turns);
      if (Number.isFinite(idx) && idx >= 0 && Number.isFinite(turns) && turns > 0) out.add(idx);
    }
    return out;
  }

  /** 第3关 Boss：永久塌陷出牌格（本场战斗）；战后 onBattleResult 会清空 */
  applyPermanentPlayedSlotCrack(count = 1) {
    const n = Math.max(0, Math.floor(count || 0));
    if (!n) return [];
    if (!Array.isArray(this._permaBrokenPlayedSlots)) this._permaBrokenPlayedSlots = [];
    const picked = [];
    for (let k = 0; k < n; k++) {
      const slots = this.getPlayedSlotCount();
      const broken = this.getBrokenPlayedSlots();
      const candidates = [];
      for (let i = 0; i < slots; i++) {
        if (!broken.has(i)) candidates.push(i);
      }
      if (!candidates.length) break;
      const idx = candidates[Math.floor(Math.random() * candidates.length)];
      this._permaBrokenPlayedSlots.push(idx);
      picked.push(idx);
    }
    if (typeof this.updatePlayedCount === "function") this.updatePlayedCount();
    return picked;
  }

  clearPlayedSlotBattleEffects() {
    this._permaBrokenPlayedSlots = [];
    this._brokenPlayedSlots = [];
    try {
      this.setPlayedAreaBurning(false);
    } catch (_) {}
  }

  getBrokenPlayedSlotTurns() {
    const out = new Map();
    const arr = Array.isArray(this._brokenPlayedSlots) ? this._brokenPlayedSlots : [];
    for (const x of arr) {
      if (!x) continue;
      const idx = Math.floor(x.idx);
      const turns = Math.floor(x.turns);
      if (!Number.isFinite(idx) || idx < 0 || !Number.isFinite(turns) || turns <= 0) continue;
      // 同一格子若重复记录，取更久的
      out.set(idx, Math.max(out.get(idx) || 0, turns));
    }
    return out;
  }

  // Boss/机制：随机烧毁出牌区格子（持续若干个“我方回合开始”）
  applyPlayedSlotBurn(brokenCount = 1, turns = 2) {
    const count = Math.max(0, Math.floor(brokenCount || 0));
    const t = Math.max(0, Math.floor(turns || 0));
    if (!count || !t) return [];
    const slots = this.getPlayedSlotCount();
    if (slots <= 0) return [];
    const existing = this.getBrokenPlayedSlots();
    const candidates = [];
    for (let i = 0; i < slots; i++) {
      if (!existing.has(i)) candidates.push(i);
    }
    if (!candidates.length) return [];
    // 选出要烧毁的格子
    const picked = candidates.sort(() => Math.random() - 0.5).slice(0, Math.min(count, candidates.length));
    if (!Array.isArray(this._brokenPlayedSlots)) this._brokenPlayedSlots = [];
    for (const idx of picked) {
      this._brokenPlayedSlots.push({ idx, turns: t });
    }
    this.setPlayedAreaBurning(true);
    if (typeof this.updatePlayedCount === "function") this.updatePlayedCount();
    if (typeof this.renderPlayedArea === "function" && this.battle) this.renderPlayedArea(this.battle.playedCards);
    return picked;
  }

  tickPlayedSlotBurnAtTurnStart() {
    const arr = Array.isArray(this._brokenPlayedSlots) ? this._brokenPlayedSlots : [];
    if (!arr.length) {
      this.setPlayedAreaBurning(false);
      return;
    }
    const next = [];
    for (const x of arr) {
      if (!x) continue;
      const turns = Math.floor(x.turns) - 1;
      if (turns > 0) next.push({ idx: Math.floor(x.idx), turns });
    }
    this._brokenPlayedSlots = next;
    this.setPlayedAreaBurning(next.length > 0);
    if (typeof this.updatePlayedCount === "function") this.updatePlayedCount();
    if (typeof this.renderPlayedArea === "function" && this.battle) this.renderPlayedArea(this.battle.playedCards);
  }

  setPlayedAreaBurning(active) {
    const wrap = document.getElementById("played-area-wrap");
    if (!wrap) return;
    wrap.classList.toggle("boss-fire", !!active);
  }

  // 回合开始时计算“本回合临时加成”（例如骰子）
  refreshTurnItemBonuses() {
    try {
      const items = Array.isArray(this.items) ? this.items : [];
      let temp = 0;
      const rand = Math.random();
      for (const id of items) {
        const item = (typeof ITEMS_DB !== "undefined") ? ITEMS_DB[id] : null;
        if (!item || !item.effect) continue;
        const eff = item.effect({ turnStart: true, rand }) || {};
        if (typeof eff.playedLimitBonus === "number" && eff.playedLimitBonus > 0) {
          // “常驻加成”已在 getPlayedLimitBonus() 里算过，这里只加临时的（骰子返回 0/1）
          if (id === "dice") temp += eff.playedLimitBonus;
        }
      }
      this._tempPlayedLimitBonusThisTurn = temp;
    } catch (_) {
      this._tempPlayedLimitBonusThisTurn = 0;
    }
  }

  getTurnDrawBonusFromItems() {
    try {
      const items = Array.isArray(this.items) ? this.items : [];
      let bonus = 0;
      for (const id of items) {
        const item = (typeof ITEMS_DB !== "undefined") ? ITEMS_DB[id] : null;
        if (!item || !item.effect) continue;
        const eff = item.effect({}) || {};
        if (typeof eff.turnDrawBonus === "number") bonus += eff.turnDrawBonus;
      }
      return bonus;
    } catch (_) {
      return 0;
    }
  }

  // 每回合换牌上限（默认2，可被道具/本回合效果增减）
  getBaseMulliganLimit() {
    return 2;
  }

  getMulliganLimitBonusFromItems() {
    try {
      const items = Array.isArray(this.items) ? this.items : [];
      let bonus = 0;
      for (const id of items) {
        const item = (typeof ITEMS_DB !== "undefined") ? ITEMS_DB[id] : null;
        if (!item || !item.effect) continue;
        const eff = item.effect({}) || {};
        if (typeof eff.mulliganLimitBonus === "number") bonus += eff.mulliganLimitBonus;
      }
      return bonus;
    } catch (_) {
      return 0;
    }
  }

  getMulliganLimit() {
    const base = this.getBaseMulliganLimit();
    const bonus = this.getMulliganLimitBonusFromItems();
    const temp = Number(this._tempMulliganLimitBonusThisTurn || 0);
    return Math.max(0, Math.floor(base + bonus + temp));
  }

  // ===== 新手引导（聚焦高亮）=====
  startBattleTutorialIfNeeded() {
    try {
      if (!this.isFirstBattle) return;
      if (this.tutorialBattleShownThisRun) return;
      this.tutorialBattleShownThisRun = true;

      const overlay = document.getElementById("tutorial-overlay");
      const titleEl = document.getElementById("tutorial-title");
      const textEl = document.getElementById("tutorial-text");
      const nextBtn = document.getElementById("tutorial-next");
      const skipBtn = document.getElementById("tutorial-skip");
      if (!overlay || !titleEl || !textEl || !nextBtn || !skipBtn) return;

      const getHandPunchCards = () => Array.from(document.querySelectorAll('#hand-container .card[data-card-id="hooligan_punch"]'));

      const steps = [
        {
          title: "认识界面：手牌与起手 7 张",
          text:
            "这里是【手牌区】。\n" +
            "战斗开始时会摸到【起手 7 张】。\n" +
            "之后每回合会再摸到【3 张】（可被道具/卡牌效果增加）。\n" +
            "你可以从手牌中挑选最多 5 张打到出牌区（部分道具可提高上限）。\n" +
            "先点选一张【药水】牌（教学里用它来演示换牌）。",
          getTargets: () => {
            return Array.from(document.querySelectorAll('#hand-container .card[data-card-id="potion"]'));
          },
          allowed: () => {
            return Array.from(document.querySelectorAll('#hand-container .card[data-card-id="potion"]'));
          },
          advance: "condition",
          condition: () => {
            const selected = this.getSelectedHandIndices();
            if (!selected.length) return false;
            // 检查被选中的是否是药水
            const hand = this.battle?.hand || [];
            return selected.some((idx) => hand[idx] === "potion");
          },
        },
        {
          title: "换牌：先体验一次换掉手牌",
          text:
            "如果手牌不好，可以点选要换掉的牌，然后点击【换牌】。\n" +
            "先任选一张【非拳头】手牌点选，再点【换牌】体验一次。\n" +
            "（每回合只能换牌一次，本教学会把它换成另一张“拳头”）",
          selector: "#reset-btn",
          advance: "condition",
          condition: () => {
            const hasMulligan = !!(this.battle && this.battle.hasMulligan);
            const handPunchCount = (this.battle?.hand || []).filter((id) => id === "hooligan_punch").length;
            return hasMulligan && handPunchCount >= 2;
          },
        },
        {
          title: "出牌方式：双击打出 1 张拳头",
          text:
            "先用【双击】打出 1 张“拳头”（流氓攻击）。\n" +
            "注意：本步只需要打出 1 张拳头。",
          getTargets: () => getHandPunchCards(),
          allowed: () => getHandPunchCards(),
          advance: "condition",
          condition: () => {
            const played = this.battle?.playedCards || [];
            const cnt = played.filter((id) => id === "hooligan_punch").length;
            return cnt >= 1;
          },
        },
        {
          title: "出牌方式：选中拳头 → 点「出牌」",
          text:
            "现在用按钮出牌：点击剩下那张“拳头”把它选中，然后点击【出牌】。\n" +
            "这样出牌区就会有 2 张相同的拳头，触发【搭档 ×1.5】规则。",
          getTargets: () => {
            const punch = getHandPunchCards()[0];
            const btn = document.querySelector("#play-cards-btn");
            return [punch, btn].filter(Boolean);
          },
          allowed: () => {
            const punch = getHandPunchCards()[0];
            const btn = document.querySelector("#play-cards-btn");
            return [punch, btn].filter(Boolean);
          },
          advance: "condition",
          condition: () => {
            const played = this.battle?.playedCards || [];
            const cnt = played.filter((id) => id === "hooligan_punch").length;
            return cnt >= 2;
          },
        },
        {
          title: "预计伤害：看见搭档倍率",
          text:
            "看左侧【预计伤害】里的倍率变化：两张相同职业拳头会触发【搭档 ×1.5】。\n" +
            "把鼠标移到伤害框上，还能看到具体怎么算。",
          selector: "#battle-sidebar-damage-box",
          advance: "manual",
        },
        {
          title: "补满出牌区到 5 张",
          text:
            "接下来把出牌区尽量凑到 5 张（用双击或点选→出牌都可以）。\n" +
            "你也可以直接点击【自动出牌】更快完成，系统会自动选出当前伤害最高的一组牌。",
          getTargets: () => {
            const btn = document.querySelector("#auto-fill-btn");
            return btn ? [btn] : [];
          },
          allowed: () => {
            const autoBtn = document.querySelector("#auto-fill-btn");
            const playBtn = document.querySelector("#play-cards-btn");
            const hand = document.querySelector("#hand-container");
            return [autoBtn, playBtn, hand].filter(Boolean);
          },
          advance: "condition",
          condition: () => (this.battle?.playedCards?.length || 0) >= Math.min(5, (this.getPlayedLimit ? this.getPlayedLimit() : 5)),
        },
        {
          title: "结算：结束回合造成伤害",
          text:
            "最后点击【结束回合】。\n" +
            "系统会按出牌区结算伤害。",
          selector: "#end-turn-btn",
          advance: "click",
        },
      ];

      const state = {
        idx: 0,
        cleanup: [],
        spotlightEls: [],
      };

      const clearSpotlight = () => {
        state.spotlightEls.forEach((el) => {
          try { el.classList.remove("tutorial-spotlight"); } catch (_) {}
        });
        state.spotlightEls = [];
        state.cleanup.forEach((fn) => {
          try { fn(); } catch (_) {}
        });
        state.cleanup = [];
        try {
          const ov = document.getElementById("tutorial-overlay");
          if (ov) {
            const m = ov.querySelector(".tutorial-mask");
            if (m) {
              m.style.opacity = "";
              m.style.visibility = "";
            }
            const dim = ov.querySelector(".tutorial-dim-layer");
            if (dim) dim.innerHTML = "";
            const hi = ov.querySelector(".tutorial-highlight-layer");
            if (hi) hi.innerHTML = "";
          }
        } catch (_) {}
      };

      const stop = () => {
        clearSpotlight();
        overlay.classList.add("hidden");
        overlay.setAttribute("aria-hidden", "true");
      };

      const showStep = (i) => {
        clearSpotlight();
        state.idx = i;
        const step = steps[i];
        if (!step) return stop();
        titleEl.textContent = step.title;
        textEl.textContent = step.text;
        nextBtn.style.display = (step.advance === "manual" || step.advance === "condition") ? "inline-block" : "none";
        // condition 步骤：按钮始终可点；未满足条件时点击会提示，并在满足后自动进入下一步
        nextBtn.disabled = false;
        // 默认：手动下一步（condition 会覆盖）
        nextBtn.onclick = () => showStep(i + 1);

        overlay.classList.remove("hidden");
        overlay.setAttribute("aria-hidden", "false");

        const targets = (() => {
          if (typeof step.getTargets === "function") return step.getTargets();
          if (step.selector) {
            const t = document.querySelector(step.selector);
            return t ? [t] : [];
          }
          return [];
        })();
        // 某些环境下（首次加载/DOM 切换/渲染抖动），目标元素可能还没插入到页面。
        // 若此时直接显示遮罩，会导致玩家“啥也点不了”。这里做一次轻量重试。
        if (!targets || !targets.length) {
          state._retryCount = (state._retryCount || 0) + 1;
          if (state._retryCount <= 20) {
            overlay.classList.add("hidden");
            overlay.setAttribute("aria-hidden", "true");
            setTimeout(() => showStep(i), 60);
            return;
          }
          // 多次重试仍未找到，直接结束教学，避免卡死在遮罩层
          return stop();
        }
        state._retryCount = 0;
        state.spotlightEls = targets;
        targets.forEach((t) => t.classList.add("tutorial-spotlight"));

        // 聚光灯：用 box-shadow 挖洞，目标区域不被压暗；黄框 + 目标本体提亮（.tutorial-spotlight）
        try {
          const maskEl = overlay.querySelector(".tutorial-mask");
          const ensureDimLayer = () => {
            let dim = overlay.querySelector(".tutorial-dim-layer");
            if (!dim) {
              dim = document.createElement("div");
              dim.className = "tutorial-dim-layer";
              const box = overlay.querySelector(".tutorial-box");
              if (box) overlay.insertBefore(dim, box);
              else overlay.appendChild(dim);
            }
            return dim;
          };
          const ensureHighlightLayer = () => {
            let layer = overlay.querySelector(".tutorial-highlight-layer");
            if (!layer) {
              layer = document.createElement("div");
              layer.className = "tutorial-highlight-layer";
              const box = overlay.querySelector(".tutorial-box");
              if (box) overlay.insertBefore(layer, box);
              else overlay.appendChild(layer);
            }
            return layer;
          };
          const dimLayer = ensureDimLayer();
          const layer = ensureHighlightLayer();

          const drawHighlights = () => {
            if (maskEl) {
              maskEl.style.opacity = "0";
              maskEl.style.visibility = "hidden";
            }
            if (dimLayer) {
              dimLayer.innerHTML = "";
              const els = targets.filter(Boolean);
              els.forEach((el) => {
                if (!el || !el.getBoundingClientRect) return;
                const r = el.getBoundingClientRect();
                const pad = el.closest && el.closest("#hand-container") ? 14 : 8;
                const hole = document.createElement("div");
                hole.className = "tutorial-spot-hole";
                hole.style.left = `${Math.max(0, r.left - pad)}px`;
                hole.style.top = `${Math.max(0, r.top - pad)}px`;
                hole.style.width = `${Math.max(8, r.width + pad * 2)}px`;
                hole.style.height = `${Math.max(8, r.height + pad * 2)}px`;
                dimLayer.appendChild(hole);
              });
            }
            if (layer) {
              layer.innerHTML = "";
              const els = targets.filter(Boolean);
              els.forEach((el) => {
                if (!el || !el.getBoundingClientRect) return;
                const r = el.getBoundingClientRect();
                const pad = el.closest && el.closest("#hand-container") ? 14 : 8;
                const box = document.createElement("div");
                box.className = "tutorial-highlight";
                box.style.left = `${Math.max(0, r.left - pad)}px`;
                box.style.top = `${Math.max(0, r.top - pad)}px`;
                box.style.width = `${Math.max(8, r.width + pad * 2)}px`;
                box.style.height = `${Math.max(8, r.height + pad * 2)}px`;
                layer.appendChild(box);
              });
            }
          };

          drawHighlights();
          const hiTimer = setInterval(drawHighlights, 150);
          state.cleanup.push(() => clearInterval(hiTimer));
          state.cleanup.push(() => {
            try {
              if (dimLayer) dimLayer.innerHTML = "";
              if (layer) layer.innerHTML = "";
              if (maskEl) {
                maskEl.style.opacity = "";
                maskEl.style.visibility = "";
              }
            } catch (_) {}
          });
        } catch (_) {}

        // 重新定位教学框：尽量不遮挡当前高亮目标
        // 手牌/屏幕下方目标：说明框必须固定顶部，否则 clamp 会把框挤到手牌上（z-index 高于聚光灯洞，把高亮盖住）
        try {
          const box = overlay.querySelector(".tutorial-box");
          if (box) {
            box.style.right = "";
            box.style.bottom = "";
            const margin = 12;
            const r = targets[0].getBoundingClientRect();
            const bw = box.offsetWidth || 520;
            const bh = box.offsetHeight || 180;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

            const isHand =
              targets.some((t) => t && typeof t.closest === "function" && t.closest("#hand-container"));
            const targetLow = r.bottom > vh * 0.62;

            if (isHand || targetLow) {
              box.classList.add("tutorial-box--top-fixed");
              box.style.left = "50%";
              box.style.top = `${Math.max(8, margin)}px`;
              box.style.transform = "translateX(-50%)";
              box.style.maxHeight = "min(36vh, 300px)";
              box.style.overflowY = "auto";
            } else {
              box.classList.remove("tutorial-box--top-fixed");
              box.style.maxHeight = "";
              box.style.overflowY = "";
              box.style.left = "50%";
              box.style.top = "24px";
              box.style.transform = "translateX(-50%)";

              const spaces = {
                top: r.top,
                bottom: vh - r.bottom,
                left: r.left,
                right: vw - r.right,
              };
              let pos = "bottom";
              if (spaces.bottom >= bh + margin) pos = "bottom";
              else if (spaces.top >= bh + margin) pos = "top";
              else if (spaces.right >= bw + margin) pos = "right";
              else if (spaces.left >= bw + margin) pos = "left";
              else pos = "bottom";

              if (pos === "bottom" || pos === "top") {
                let left = r.left + r.width / 2 - bw / 2;
                left = clamp(left, 8, vw - bw - 8);
                const top = pos === "bottom" ? r.bottom + margin : r.top - bh - margin;
                box.style.left = `${left}px`;
                box.style.top = `${clamp(top, 8, vh - bh - 8)}px`;
                box.style.transform = "none";
              } else if (pos === "right") {
                const left = r.right + margin;
                let top = r.top;
                top = clamp(top, 8, vh - bh - 8);
                box.style.left = `${clamp(left, 8, vw - bw - 8)}px`;
                box.style.top = `${top}px`;
                box.style.transform = "none";
              } else {
                const left = r.left - bw - margin;
                let top = r.top;
                top = clamp(top, 8, vh - bh - 8);
                box.style.left = `${clamp(left, 8, vw - bw - 8)}px`;
                box.style.top = `${top}px`;
                box.style.transform = "none";
              }
            }
          }
        } catch (_) {}

        // 只允许点聚焦目标：遮罩捕获点击，阻止其它区域操作
        const mask = overlay.querySelector(".tutorial-mask");
        const onMaskClick = (e) => {
          // 点击遮罩不做事，阻止穿透
          e.preventDefault();
          e.stopPropagation();
        };
        mask.addEventListener("mousedown", onMaskClick, true);
        state.cleanup.push(() => mask.removeEventListener("mousedown", onMaskClick, true));

        // 进一步限制：只允许与 allowed 元素交互（否则提示不响应）
        try {
          const getAllowed = () => {
            let allowedEls = [];
            if (typeof step.allowed === "function") {
              allowedEls = (step.allowed() || []).filter(Boolean);
            } else {
              allowedEls = targets;
            }
            // 始终允许点击教学面板上的按钮（下一步/跳过）
            const box = overlay.querySelector(".tutorial-box");
            if (box) allowedEls.push(box);
            return allowedEls;
          };
          const isInsideAllowed = (el) => {
            const allowedEls = getAllowed();
            return allowedEls.some((a) => a && (a === el || a.contains(el)));
          };
          const blocker = (e) => {
            const t = e.target;
            if (!isInsideAllowed(t)) {
              e.preventDefault();
              e.stopPropagation();
            }
          };
          document.addEventListener("mousedown", blocker, true);
          document.addEventListener("click", blocker, true);
          state.cleanup.push(() => document.removeEventListener("mousedown", blocker, true));
          state.cleanup.push(() => document.removeEventListener("click", blocker, true));
        } catch (_) {}

        if (step.advance === "click") {
          const onClick = () => showStep(i + 1);
          targets.forEach((t) => t.addEventListener("click", onClick, { once: true }));
          state.cleanup.push(() => targets.forEach((t) => t.removeEventListener("click", onClick)));
        }

        if (step.advance === "condition" && typeof step.condition === "function") {
          let lastOk = false;
          const tick = () => {
            try {
              const ok = !!step.condition();
              lastOk = ok;
              if (ok) nextBtn.classList.add("tutorial-ready");
              else nextBtn.classList.remove("tutorial-ready");
            } catch (_) {
              lastOk = false;
            }
          };
          tick();
          const timer = setInterval(tick, 200);
          state.cleanup.push(() => clearInterval(timer));

          // 点击「下一步」时，如果条件未满足，给出提示；满足则推进
          const onNext = () => {
            if (!lastOk) {
              textEl.textContent = `${step.text}\n\n（还没完成本步要求：请先按提示操作，完成后再点“下一步”）`;
              return;
            }
            showStep(i + 1);
          };
          nextBtn.onclick = onNext;

          // 条件满足后自动推进（减少“卡住”感）
          const auto = setInterval(() => {
            if (lastOk) {
              clearInterval(auto);
              showStep(i + 1);
            }
          }, 300);
          state.cleanup.push(() => clearInterval(auto));
        }
      };

      skipBtn.onclick = () => stop();

      // 若战斗结束/切视图，自动关闭
      const autoStop = () => {
        if (this.view !== "battle" || this.gameEnded) stop();
      };
      const interval = setInterval(autoStop, 250);
      state.cleanup.push(() => clearInterval(interval));

      showStep(0);

      // 打赢第一场战斗后自动结束教学（避免遮罩残留）
      this._tutorialStopAfterFirstWin = stop;
    } catch (_) {
      // ignore
    }
  }

  // 初始化
  init() {
    // 绑定开始页面按钮
    this.bindStartScreenEvents();

    // 响应式：窗口尺寸变化时同步移动端战斗头部
    try {
      if (!window.__mobileHeaderSyncBound) {
        window.__mobileHeaderSyncBound = true;
        window.addEventListener("resize", () => {
          try {
            if (window.gameInstance && typeof window.gameInstance.syncMobileBattleHeader === "function") {
              window.gameInstance.syncMobileBattleHeader();
            }
          } catch (_) {}
        });
      }
    } catch (_) {}
  }

  // 绑定开始页面事件
  bindStartScreenEvents() {
    // 开始游戏
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.openDifficultyModal());
    }
    const teamBuildStart = document.getElementById('team-build-start');
    if (teamBuildStart) {
      teamBuildStart.addEventListener('click', () => this.startAdventureFromTeamBuild());
    }

    // 继续游戏
    const continueBtn = document.getElementById('btn-continue-game');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => this.openSaveModal("load"));
    }

    // 顶部状态栏：手动存档
    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.openSaveModal("save"));
    }

    // 成就
    const achievementsBtn = document.getElementById('btn-achievements');
    if (achievementsBtn) {
      achievementsBtn.addEventListener('click', () => this.showAchievementsModal());
    }

    // 设置
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettingsModal());
    }

    // 检查存档
    this.checkSaveData();

    if (this.isDevShortcutsEnabled()) {
      this.setupDevShortcutsUI();
    }

    // 按任意键开始
    document.addEventListener('keydown', (e) => {
      if (!this.gameStarted && e.key !== 'Escape') {
        this.startNewGame();
      }
    });
  }

  /** 本地测试：URL 加 ?dev=1 或 localStorage.setItem('cityHeroDev','1') 后刷新 */
  isDevShortcutsEnabled() {
    try {
      if (typeof location !== "undefined" && new URLSearchParams(location.search).get("dev") === "1") return true;
      if (typeof localStorage !== "undefined" && localStorage.getItem("cityHeroDev") === "1") return true;
    } catch (_) {}
    return false;
  }

  setupDevShortcutsUI() {
    const startContent = document.querySelector(".start-content");
    if (!startContent || document.getElementById("dev-shortcuts-panel")) return;
    const panel = document.createElement("div");
    panel.id = "dev-shortcuts-panel";
    panel.className = "dev-shortcuts-panel";
    panel.innerHTML = `
      <div class="dev-shortcuts-title">开发者捷径</div>
      <p class="dev-shortcuts-hint">跳过教学/第一大关，直接测进度。线上勿带 ?dev=1</p>
      <div class="dev-shortcuts-btns">
        <button type="button" class="dev-sc-btn" data-cp="floor1_map">第1层地图</button>
        <button type="button" class="dev-sc-btn" data-cp="post_floor1_team">通第1关后·组队</button>
        <button type="button" class="dev-sc-btn" data-cp="floor2_map">第2层·已带狗</button>
      </div>
    `;
    panel.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cp]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      this.debugLoadCheckpoint(btn.dataset.cp);
    });
    startContent.appendChild(panel);
  }

  /**
   * 测试用存档点（不写本地存档）
   * floor1_map — 跳过假人，第1层新地图
   * post_floor1_team — 模拟击败第1层Boss后：已解锁狗、第2层地图、打开组队
   * floor2_map — 流氓+狗，第2层地图（测打完组队后进图）
   */
  debugLoadCheckpoint(checkpointId) {
    const enter = () => {
      document.getElementById("start-screen")?.classList.add("hidden");
      document.getElementById("game-container")?.classList.remove("hidden");
      this.gameStarted = true;
      try {
        if (window.audioManager) window.audioManager.init();
      } catch (_) {}
    };

    this.difficulty = 1;
    this.isFirstBattle = false;
    this.tutorialBattleActive = false;
    this.justFinishedFirstBattle = false;
    this.pendingTeamBuildAfterBoss = false;
    this.gold = 180;
    this.items = [];
    this.discoveredCombos = this.discoveredCombos || [];
    this.cardLevels = this.cardLevels || {};

    if (checkpointId === "floor1_map") {
      this.unlockedProfessions = ["hooligan"];
      this.selectedProfessions = ["hooligan"];
      this.initGameData();
      this.deck = this.createStarterDeck();
      this.map.floor = 1;
      this.map.generate();
      this.currentNode = this.map.getNode(this.map.currentNodeId);
      enter();
      this.updateFloorDisplay();
      this.showMapView();
      this.log("[Dev] 检查点：第1层地图起点", "system");
      return;
    }

    if (checkpointId === "post_floor1_team") {
      this.unlockedProfessions = ["hooligan", "dog"];
      this.selectedProfessions = ["hooligan"];
      this.initGameData();
      this.deck = this.createStarterDeck();
      this.map.floor = 2;
      this.map.generate();
      this.currentNode = this.map.getNode(this.map.currentNodeId);
      enter();
      this.updateFloorDisplay();
      this._flashUnlockedProfession = "dog";
      this.showTeamBuildView();
      this.log("[Dev] 检查点：通第1关后组队（狗已解锁）", "system");
      return;
    }

    if (checkpointId === "floor2_map") {
      this.unlockedProfessions = ["hooligan", "dog"];
      this.selectedProfessions = ["hooligan", "dog"];
      this.initGameData();
      this.deck = this.createStarterDeck();
      this.map.floor = 2;
      this.map.generate();
      this.currentNode = this.map.getNode(this.map.currentNodeId);
      enter();
      this.updateFloorDisplay();
      this.showMapView();
      this.log("[Dev] 检查点：第2层地图（流氓+狗）", "system");
      return;
    }

    console.warn("[Dev] 未知检查点:", checkpointId, "可选: floor1_map, post_floor1_team, floor2_map");
  }

  openDifficultyModal() {
    const modal = document.getElementById("difficulty-modal");
    const list = document.getElementById("difficulty-list");
    const cancel = document.getElementById("difficulty-cancel");
    if (!modal || !list) {
      // 兜底：没有弹窗就按默认难度1开局
      this.startNewGame(1);
      return;
    }
    list.innerHTML = "";
    const max = Math.max(1, this.maxDifficultyUnlocked || 1);
    for (let d = 1; d <= 5; d++) {
      const unlocked = d <= max;
      const btn = document.createElement("button");
      btn.className = "start-btn";
      btn.disabled = !unlocked;
      const done = Array.isArray(this.difficultiesCompleted) && this.difficultiesCompleted.includes(d);
      btn.textContent = unlocked
        ? `难度 ${d}${done ? "（已通关）" : ""}`
        : `难度 ${d}（未解锁）`;
      btn.onclick = () => {
        modal.classList.add("hidden");
        this.startNewGame(d);
      };
      list.appendChild(btn);
    }
    if (cancel) cancel.onclick = () => modal.classList.add("hidden");
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };
    modal.classList.remove("hidden");
  }

  // 检查存档
  checkSaveData() {
    try {
      const saveData =
        localStorage.getItem('cityHeroSaveSlot1') ||
        localStorage.getItem('cityHeroSaveSlot2') ||
        localStorage.getItem('cityHeroSaveSlot3') ||
        localStorage.getItem('cityHeroSave'); // 兼容旧单槽
      const continueBtn = document.getElementById('btn-continue-game');
      if (saveData && continueBtn) {
        continueBtn.disabled = false;
      }
    } catch (e) {
      console.warn('Failed to check save data');
    }
  }

  getSaveKey(slot) {
    const s = Math.min(3, Math.max(1, Number(slot) || 1));
    return `cityHeroSaveSlot${s}`;
  }

  formatSaveTime(ts) {
    if (!ts) return "空";
    try {
      return new Date(ts).toLocaleString();
    } catch (_) {
      return String(ts);
    }
  }

  readSaveMeta(slot) {
    try {
      const raw = localStorage.getItem(this.getSaveKey(slot));
      if (!raw) return null;
      const data = JSON.parse(raw);
      return { savedAt: data.savedAt || null };
    } catch (_) {
      return null;
    }
  }

  refreshSaveModalUI() {
    for (let s = 1; s <= 3; s++) {
      const meta = this.readSaveMeta(s);
      const el = document.getElementById(`save-slot-time-${s}`);
      if (el) el.textContent = meta ? this.formatSaveTime(meta.savedAt) : "空";
    }
  }

  openSaveModal(mode) {
    const modal = document.getElementById("save-modal");
    const modeEl = document.getElementById("save-modal-mode");
    if (!modal) return;
    modal.classList.remove("hidden");
    if (modeEl) modeEl.textContent = mode === "load" ? "选择要读取的存档位" : "选择要保存的存档位";
    this.refreshSaveModalUI();
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    };
    const closeBtn = document.getElementById("save-modal-close");
    if (closeBtn) closeBtn.onclick = () => modal.classList.add("hidden");
    const slotBtns = modal.querySelectorAll(".save-slot-btn");
    slotBtns.forEach((btn) => {
      btn.onclick = () => {
        const slot = Number(btn.dataset.slot || 1);
        if (mode === "load") {
          const ok = this.continueGame(slot);
          if (ok !== false) modal.classList.add("hidden");
        } else {
          this.saveGame(slot);
          modal.classList.add("hidden");
        }
      };
    });
  }

  // 开始新游戏 -> 先进入战队构建
  startNewGame(difficulty = 1) {
    this.gameStarted = true;
    this.isFirstBattle = true;
    this.difficulty = Math.max(1, Math.floor(difficulty || 1));
    this.gold = 100;
    this.items = [];
    this.discoveredCombos = [];
    // 难度1开局：仅流氓可用
    this.selectedProfessions = ["hooligan"];
    if (this.difficulty === 1) {
      // 关键：开新一局难度1时，职业解锁从0开始（狗/老师需要在本次流程中解锁）
      this.unlockedProfessions = ["hooligan"];
      this.saveUnlockedProfessions();
    }

    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.add('hidden');
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) gameContainer.classList.remove('hidden');

    this.showTeamBuildView();
    if (window.audioManager) window.audioManager.init();
  }

  showTeamBuildView() {
    const view = document.getElementById("team-build-view");
    const listEl = document.getElementById("team-build-professions");
    const previewEl = document.getElementById("team-build-deck-preview");
    if (!view || !listEl) return;

    this.teamBuildSelection = [...this.selectedProfessions];
    this.teamBuildSelectedCardId = null;
    listEl.innerHTML = "";
    const labels = { coder: "程序员", dog: "狗", teacher: "老师", security: "保安", hooligan: "流氓" };
    const icons = { coder: "💻", dog: "🐕", teacher: "📚", security: "👮", hooligan: "👊" };
    const allProfs = ["hooligan", "dog", "coder", "teacher", "security"];
    const unlocked = new Set(this.unlockedProfessions || []);
    allProfs.forEach(prof => {
      const btn = document.createElement("button");
      btn.className = "team-build-prof-btn";
      btn.dataset.prof = prof;
      btn.textContent = `${icons[prof] || "?"} ${labels[prof] || prof}`;
      const isUnlocked = unlocked.has(prof);
      btn.disabled = !isUnlocked;
      btn.classList.toggle("locked", !isUnlocked);
      if (this.teamBuildSelection.includes(prof)) btn.classList.add("team-build-prof-selected");
      btn.addEventListener("click", () => {
        if (!isUnlocked) return;
        const idx = this.teamBuildSelection.indexOf(prof);
        if (idx >= 0) {
          if (this.teamBuildSelection.length <= 1) return;
          this.teamBuildSelection.splice(idx, 1);
        } else {
          if (this.teamBuildSelection.length >= 3) return;
          this.teamBuildSelection.push(prof);
        }
        btn.classList.toggle("team-build-prof-selected", this.teamBuildSelection.includes(prof));
        this.updateTeamBuildDeckPreview();
      });
      listEl.appendChild(btn);

      // 新解锁职业：闪一下引导
      try {
        if (this._flashUnlockedProfession && this._flashUnlockedProfession === prof && isUnlocked) {
          btn.classList.add("prof-flash");
          setTimeout(() => btn.classList.remove("prof-flash"), 1600);
        }
      } catch (_) {}
    });
    this._flashUnlockedProfession = null;
    this.updateTeamBuildDeckPreview();
    this.updateTeamBuildDetailPanel(null);

    document.getElementById("map-view")?.classList.add("hidden");
    document.getElementById("battle-view")?.classList.add("hidden");
    document.getElementById("shop-view")?.classList.add("hidden");
    document.getElementById("event-view")?.classList.add("hidden");
    view.classList.remove("hidden");
    this.syncBattleTopChrome();
  }

  showProfessionUnlockModal(prof) {
    const labels = { coder: "程序员", dog: "狗", teacher: "老师", security: "保安", hooligan: "流氓" };
    const icons = { coder: "💻", dog: "🐕", teacher: "📚", security: "👮", hooligan: "👊" };
    this.showModal("新职业解锁！", `${icons[prof] || "✨"} ${labels[prof] || prof} 已解锁。\n现在可以在组队页面加入队伍。`);
  }

  updateTeamBuildDeckPreview() {
    const previewEl = document.getElementById("team-build-deck-preview");
    if (!previewEl) return;
    const profs = this.teamBuildSelection || [];
    const deck = this.getStarterDeckForProfessions(profs);
    const countBy = {};
    deck.forEach(id => { countBy[id] = (countBy[id] || 0) + 1; });
    const professionOrder = ["common", "coder", "dog", "teacher", "security", "hooligan"];
    const getOrder = (cardId) => {
      const card = CARDS_DB[cardId];
      const p = (card && card.profession) ? card.profession : "common";
      const idx = professionOrder.indexOf(p);
      return idx >= 0 ? idx : professionOrder.length;
    };
    const sorted = Object.entries(countBy).sort((a, b) => getOrder(a[0]) - getOrder(b[0]) || (b[1] - a[1]));
    const selectedId = this.teamBuildSelectedCardId;
    previewEl.innerHTML = "";
    sorted.forEach(([cardId, count]) => {
      const card = CARDS_DB[cardId];
      const prof = (card && card.profession) ? card.profession : "common";
      const profShort = (typeof PROFESSION_SHORT !== "undefined" && PROFESSION_SHORT[prof]) ? PROFESSION_SHORT[prof] : (prof === "common" ? "通" : (prof || "通").slice(0, 1));
      const archRaw = (card && (card.archetype || card.type)) || "";
      const archLabel =
        archRaw === "attack" ? "攻" :
        archRaw === "skill" ? "守" :
        archRaw === "item" ? "技" :
        (archRaw ? String(archRaw) : "");
      const el = document.createElement("div");
      el.className = "team-build-card-item" + (selectedId === cardId ? " selected" : "");
      el.dataset.cardId = cardId;
      el.innerHTML = `
        <div class="tb-card-prof-badge" data-profession="${prof}">${profShort}</div>
        ${archLabel ? `<div class="tb-card-arch-badge" data-arch="${archLabel}">${archLabel}</div>` : ""}
        <div class="tb-card-icon">${card ? card.icon : "🃏"}</div>
        <div class="tb-card-name">${card ? card.name : cardId}</div>
        <div class="tb-card-count">× ${count}</div>
      `;
      el.addEventListener("click", () => {
        this.teamBuildSelectedCardId = this.teamBuildSelectedCardId === cardId ? null : cardId;
        previewEl.querySelectorAll(".team-build-card-item").forEach(n => n.classList.remove("selected"));
        if (this.teamBuildSelectedCardId === cardId) el.classList.add("selected");
        this.updateTeamBuildDetailPanel(this.teamBuildSelectedCardId);
      });
      previewEl.appendChild(el);
    });
  }

  updateTeamBuildDetailPanel(cardId) {
    const placeholder = document.getElementById("team-build-detail-placeholder");
    const content = document.getElementById("team-build-detail-content");
    if (!placeholder || !content) return;
    if (!cardId) {
      placeholder.classList.remove("hidden");
      content.classList.add("hidden");
      return;
    }
    const card = CARDS_DB[cardId];
    placeholder.classList.add("hidden");
    content.classList.remove("hidden");
    const iconEl = document.getElementById("team-build-detail-icon");
    const nameEl = document.getElementById("team-build-detail-name");
    const descEl = document.getElementById("team-build-detail-desc");
    const effectEl = document.getElementById("team-build-detail-effect");
    if (iconEl) iconEl.textContent = card ? card.icon : "🃏";
    if (nameEl) nameEl.textContent = card ? card.name : cardId;
    if (descEl) {
      const archRaw = (card && (card.archetype || card.type)) || "";
      const archLabel =
        archRaw === "attack" ? "攻" :
        archRaw === "skill" ? "守" :
        archRaw === "item" ? "技" :
        (archRaw ? String(archRaw) : "");
      const prefix = archLabel ? `【${archLabel}】 ` : "";
      descEl.textContent = card ? (prefix + (card.description || "")) : "";
    }
    if (effectEl) {
      let detail = card ? (card.detail || "") : "";
      try {
        // 与 tooltip 一致：未解锁的跨职业组合不泄露具体名称
        const unlocked = Array.isArray(this.unlockedProfessions) ? this.unlockedProfessions : [];
        const discovered = Array.isArray(this.discoveredCombos) ? this.discoveredCombos : [];
        if (detail && typeof CardUtil !== "undefined" && typeof CardUtil.maskCrossComboText === "function") {
          detail = CardUtil.maskCrossComboText(detail, unlocked, discovered);
        }
      } catch (_) {}
      effectEl.textContent = detail;
    }
  }

  getStarterDeckForProfessions(profs) {
    const deck = ["attack", "potion"];
    (profs || []).forEach(prof => {
      if (prof === "coder") {
        for (let i = 0; i < 3; i++) deck.push("coder_code");
        deck.push("coder_bug", "coder_coffee", "coder_refactor");
      } else if (prof === "dog") {
        deck.push("dog_bark", "dog_bite", "dog_tail", "dog_guard", "dog_detox", "dog_fetch", "dog_roar");
      } else if (prof === "teacher") {
        deck.push("teacher_lecture", "teacher_homework", "teacher_ruler", "teacher_redpen");
      } else if (prof === "security") {
        deck.push("security_flashlight", "security_whistle", "security_patrol", "security_baton");
      } else if (prof === "hooligan") {
        deck.push("hooligan_punch", "hooligan_punch", "hooligan_kick", "hooligan_sand", "hooligan_intimidate");
      }
    });
    return deck;
  }

  startAdventureFromTeamBuild() {
    if (!this.teamBuildSelection || this.teamBuildSelection.length < 1) {
      this.showModal("提示", "请至少选择 1 个职业。");
      return;
    }
    const prevProfs = [...(this.selectedProfessions || [])];
    this.selectedProfessions = [...this.teamBuildSelection];
    document.getElementById("team-build-view").classList.add("hidden");
    if (this.isFirstBattle) {
      this.initGameData();
      this.deck = this.createStarterDeck();
      if (this.tutorialEnabled) {
        this.startFirstBattle();
      } else {
        this.startRunSkipTutorial();
      }
    } else {
      // 大关后重新组队：回到地图继续冒险，禁止再进「假人教学战」（否则会误判为 Boss 通关）
      this.resumeAdventureAfterTeamBuild(prevProfs);
    }
  }

  /** 新开一局但跳过教学战：直接生成第1层地图并进入地图视图 */
  startRunSkipTutorial() {
    this.isFirstBattle = false;
    this.tutorialBattleActive = false;
    this.justFinishedFirstBattle = false;
    this.pendingTeamBuildAfterBoss = false;
    try {
      this.map.floor = 1;
      this.map.generate();
      this.currentNode = this.map.getNode(this.map.currentNodeId);
    } catch (_) {}
    try {
      this.updateFloorDisplay();
      this.updateGoldDisplay();
      this.renderItems();
      this.updateTeammateUI();
      (this.selectedProfessions || []).forEach((p) => this.updateTeammateStatus(p));
    } catch (_) {}
    this.showMapView();
  }

  /** 中途换队：保留进度，补齐新队员与卡组，回地图 */
  resumeAdventureAfterTeamBuild(prevProfs) {
    const professionHp = {
      coder: 30, dog: 35, teacher: 40, security: 50, hooligan: 38,
      warrior: 50, mage: 35, ranger: 40, priest: 35,
    };
    const newProfs = this.selectedProfessions || [];
    Object.keys(this.teammates || {}).forEach((p) => {
      if (!newProfs.includes(p)) delete this.teammates[p];
    });
    newProfs.forEach((p) => {
      if (!this.teammates[p]) {
        const hp = professionHp[p] || 40;
        this.teammates[p] = { hp, maxHp: hp, shield: 0 };
      }
    });
    const added = newProfs.filter((p) => !prevProfs.includes(p));
    this.appendStarterCardsForNewProfessions(added);
    this.gameEnded = false;
    this.tutorialBattleActive = false;
    try {
      this.updateTeammateUI();
      newProfs.forEach((p) => this.updateTeammateStatus(p));
      this.updateGoldDisplay();
      this.renderItems();
    } catch (_) {}
    this.showMapView();
  }

  appendStarterCardsForNewProfessions(added) {
    if (!Array.isArray(this.deck)) this.deck = [];
    added.forEach((prof) => {
      if (prof === "coder") {
        for (let i = 0; i < 3; i++) this.deck.push("coder_code");
        this.deck.push("coder_bug", "coder_coffee", "coder_refactor");
      } else if (prof === "dog") {
        this.deck.push("dog_bark", "dog_bite", "dog_tail", "dog_guard", "dog_detox", "dog_fetch", "dog_roar");
      } else if (prof === "teacher") {
        this.deck.push("teacher_lecture", "teacher_homework", "teacher_ruler", "teacher_redpen");
      } else if (prof === "security") {
        this.deck.push("security_flashlight", "security_whistle", "security_patrol", "security_baton");
      } else if (prof === "hooligan") {
        for (let i = 0; i < 2; i++) this.deck.push("hooligan_punch");
        this.deck.push("hooligan_kick", "hooligan_sand", "hooligan_intimidate");
      }
    });
  }

  // 继续游戏
  continueGame(slot = 1) {
    try {
      const saveData =
        localStorage.getItem(this.getSaveKey(slot)) ||
        localStorage.getItem('cityHeroSave'); // 兼容旧单槽
      if (saveData) {
        const data = JSON.parse(saveData);
        // 先初始化基础数据与事件绑定（避免缺失方法导致直接回到开局）
        this.selectedProfessions = data.selectedProfessions || this.selectedProfessions;
        this.initGameData();

        this.gold = data.gold || 100;
        this.items = data.items || [];
        this.itemSlotCapacity = Math.min(10, Math.max(1, data.itemSlotCapacity || this.itemSlotCapacity || 10));
        this.deck = data.deck || this.createStarterDeck();
        this.discoveredCombos = data.discoveredCombos || [];
        this.map.floor = data.floor || 1;
        this.cardLevels = data.cardLevels || {};
        this.unlockedProfessions = data.unlockedProfessions || this.unlockedProfessions;
        this.unlockedCards = data.unlockedCards || this.unlockedCards;
        this.unlockedItems = data.unlockedItems || this.unlockedItems;
        
        // 隐藏开始页面
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.classList.add('hidden');
        
        // 显示游戏容器
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) gameContainer.classList.remove('hidden');
        
        this.gameStarted = true;
        this.isFirstBattle = !!data.isFirstBattle ? true : false;
        this.tutorialBattleActive = !!data.tutorialBattleActive;
        this._tutorialFixedHand = data._tutorialFixedHand || this._tutorialFixedHand;
        this._tutorialFixedPickIndices = data._tutorialFixedPickIndices || this._tutorialFixedPickIndices;
        this._tutorialSwapPool = data._tutorialSwapPool || this._tutorialSwapPool;
        
        // 恢复队友（血量/护盾/状态）
        if (data.teammates) {
          this.teammates = data.teammates;
        }
        
        // 恢复地图进度（节点、当前位置）
        if (data.mapState && data.mapState.nodes && Array.isArray(data.mapState.nodes)) {
          this.map.nodes = data.mapState.nodes;
          this.map.currentNodeId = data.mapState.currentNodeId || "start";
          this.currentNode = this.map.getNode(this.map.currentNodeId);
        } else {
          // 兼容旧存档：重新生成地图
          this.map.generate();
        }

        this.updateFloorDisplay();
        this.updateGoldDisplay();
        this.renderItems();
        this.updateTeammateUI();
        (this.selectedProfessions || []).forEach((p) => this.updateTeammateStatus(p));

        // 恢复视图：若存档时在战斗中，则回到战斗；否则回到地图
        const savedView = data.view || "map";
        if (savedView === "battle" && data.battleState) {
          // 还原敌人与战斗状态
          const bs = data.battleState;
          if (bs.enemy) {
            this.enemy = { ...bs.enemy };
          }
          this.showBattleView();
          this.updateEnemyHP(this.enemy.hp);
          this.battle = new BattleSystem(this);
          this.battle.enemy = this.enemy;
          this.battle.turn = bs.turn || 1;
          this.battle.hand = bs.hand || [];
          this.battle.playedCards = bs.playedCards || [];
          this.battle.deck = bs.deck || [];
          this.battle.discard = bs.discard || [];
          this.battle.hasMulligan = !!bs.hasMulligan;
          this.battle.drawForNextTurn = bs.drawForNextTurn || 0;
          this.battle.retrieveForNextTurn = bs.retrieveForNextTurn || [];
          const roundEl = document.getElementById("battle-round");
          if (roundEl) roundEl.textContent = this.battle.turn;
          this.renderHand(this.battle.hand);
          this.renderPlayedArea(this.battle.playedCards);
          this.updatePlayedCount();
          this.updateEstimatedDamage();
        } else {
          this.showMapView();
        }
      }
      return true;
    } catch (e) {
      console.error('Failed to load save:', e);
      return false;
    }
  }

  // 保存游戏
  saveGame(slot = 1) {
    try {
      const mapState = {
        nodes: this.map && typeof this.map.getNodes === "function" ? this.map.getNodes() : (this.map?.nodes || []),
        currentNodeId: this.map?.currentNodeId || "start",
      };
      const battleState = (this.view === "battle" && this.battle) ? {
        turn: this.battle.turn,
        enemy: this.enemy,
        hand: this.battle.hand,
        playedCards: this.battle.playedCards,
        deck: this.battle.deck,
        discard: this.battle.discard,
        hasMulligan: this.battle.hasMulligan,
        drawForNextTurn: this.battle.drawForNextTurn,
        retrieveForNextTurn: this.battle.retrieveForNextTurn,
      } : null;
      const saveData = {
        savedAt: Date.now(),
        view: this.view,
        gold: this.gold,
        items: this.items,
        itemSlotCapacity: this.getItemSlotCapacity(),
        deck: this.deck,
        discoveredCombos: this.discoveredCombos,
        floor: this.map.floor,
        cardLevels: this.cardLevels || {},
        teammates: this.teammates || {},
        selectedProfessions: this.selectedProfessions || [],
        unlockedProfessions: this.unlockedProfessions || [],
        unlockedCards: this.unlockedCards || [],
        unlockedItems: this.unlockedItems || [],
        mapState,
        battleState,
        isFirstBattle: this.isFirstBattle,
        tutorialBattleActive: this.tutorialBattleActive,
        _tutorialFixedHand: this._tutorialFixedHand,
        _tutorialFixedPickIndices: this._tutorialFixedPickIndices,
        _tutorialSwapPool: this._tutorialSwapPool,
      };
      localStorage.setItem(this.getSaveKey(slot), JSON.stringify(saveData));
      this.log(`游戏已保存（存档位 ${Math.min(3, Math.max(1, Number(slot) || 1))}）`, 'system');
    } catch (e) {
      console.error('Failed to save game:', e);
    }
  }

  // 加载成就
  loadAchievements() {
    try {
      const saved = localStorage.getItem('cityHeroAchievements');
      if (saved) {
        const unlocked = JSON.parse(saved);
        this.achievements.forEach(a => {
          if (unlocked.includes(a.id)) a.unlocked = true;
        });
      }
    } catch (e) {
      console.warn('Failed to load achievements');
    }
  }

  // ===== 解锁内容（卡牌/道具）=====
  loadUnlocks() {
    try {
      const raw = localStorage.getItem("cityHeroUnlocks");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.cards)) this.unlockedCards = data.cards;
      if (data && Array.isArray(data.items)) this.unlockedItems = data.items;
      if (data && typeof data.maxDifficultyUnlocked === "number") this.maxDifficultyUnlocked = Math.max(1, Math.floor(data.maxDifficultyUnlocked));
      if (data && Array.isArray(data.difficultiesCompleted)) this.difficultiesCompleted = data.difficultiesCompleted.map(n => Math.floor(n)).filter(n => n >= 1);
    } catch (_) {}
  }

  saveUnlocks() {
    try {
      localStorage.setItem("cityHeroUnlocks", JSON.stringify({
        cards: this.unlockedCards || [],
        items: this.unlockedItems || [],
        maxDifficultyUnlocked: this.maxDifficultyUnlocked || 1,
        difficultiesCompleted: this.difficultiesCompleted || [],
      }));
    } catch (_) {}
  }

  isCardUnlocked(cardId) {
    try {
      const card = (typeof CARDS_DB !== "undefined") ? CARDS_DB[cardId] : null;
      if (!card) return false;
      if (!card.lockedByDefault) return true;
      return Array.isArray(this.unlockedCards) && this.unlockedCards.includes(cardId);
    } catch (_) {
      return true;
    }
  }

  isItemUnlocked(itemId) {
    try {
      const item = (typeof ITEMS_DB !== "undefined") ? ITEMS_DB[itemId] : null;
      if (!item) return false;
      if (!item.lockedByDefault) return true;
      return Array.isArray(this.unlockedItems) && this.unlockedItems.includes(itemId);
    } catch (_) {
      return true;
    }
  }

  /** 商店/随机事件：仅通用、连击/爽感/辅助类，或当前编队职业的专属道具 */
  getShopAndEventItemPool() {
    const team = new Set(this.selectedProfessions || []);
    const skip = new Set(["coupon_book", "hero_medal"]);
    const pool = [];
    try {
      Object.keys(typeof ITEMS_DB !== "undefined" ? ITEMS_DB : {}).forEach((id) => {
        if (skip.has(id)) return;
        if (!this.isItemUnlocked(id)) return;
        const it = ITEMS_DB[id];
        if (!it) return;
        if (it.type === "profession" && it.profession && !team.has(it.profession)) return;
        pool.push(id);
      });
    } catch (_) {}
    return pool;
  }

  pickRandomEventItemId() {
    const pool = this.getShopAndEventItemPool();
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** 发事件道具：栏满则折合金币 */
  grantEventItemReward(context = "事件") {
    const id = this.pickRandomEventItemId();
    if (!id) {
      this.gold = (this.gold || 0) + 22;
      this.updateGoldDisplay();
      this.log(`${context}：暂无可用道具，获得金币 +22`, "system");
      return;
    }
    const cap = typeof this.getItemSlotCapacity === "function" ? this.getItemSlotCapacity() : 4;
    const name = ITEMS_DB[id] ? ITEMS_DB[id].name : id;
    if (!Array.isArray(this.items)) this.items = [];
    if (this.items.length < cap) {
      this.items.push(id);
      if (typeof this.renderItems === "function") this.renderItems();
      this.log(`${context}获得道具：${name}`, "player");
    } else {
      this.gold = (this.gold || 0) + 35;
      this.updateGoldDisplay();
      this.log(`${context}：道具栏已满，折合金币 +35（${name}）`, "system");
    }
  }

  grantEventCardRewards(count = 1, context = "事件") {
    const n = Math.max(0, Math.floor(count || 0));
    if (!n) return;
    const pool = this.getProfessionCardPool();
    if (!pool.length) {
      this.deck.push("attack");
      this.log(`${context}获得卡牌：基础攻击`, "player");
      return;
    }
    for (let i = 0; i < n; i++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      this.deck.push(id);
      const nm = CARDS_DB[id] ? CARDS_DB[id].name : id;
      this.log(`${context}获得卡牌：${nm}`, "player");
    }
  }

  // ===== 统计（进度型成就）=====
  loadStats() {
    try {
      const raw = localStorage.getItem("cityHeroStats");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        this.stats = { ...(this.stats || {}), ...data };
      }
    } catch (_) {}
  }

  saveStats() {
    try {
      localStorage.setItem("cityHeroStats", JSON.stringify(this.stats || {}));
    } catch (_) {}
  }

  incStat(key, delta) {
    if (!this.stats) this.stats = {};
    const cur = Number(this.stats[key] || 0);
    const next = cur + Number(delta || 0);
    this.stats[key] = next;
    this.saveStats();
    this.checkCriteriaAchievements();
  }

  setMaxStat(key, value) {
    if (!this.stats) this.stats = {};
    const cur = Number(this.stats[key] || 0);
    const next = Math.max(cur, Number(value || 0));
    if (next !== cur) {
      this.stats[key] = next;
      this.saveStats();
      this.checkCriteriaAchievements();
    }
  }

  recordDamage(dmg) {
    this.setMaxStat("maxDamage", Number(dmg || 0));
  }

  checkCriteriaAchievements() {
    try {
      (this.achievements || []).forEach((a) => {
        if (!a || a.unlocked) return;
        const c = a.criteria;
        if (!c || !c.stat) return;
        const v = Number(this.stats && this.stats[c.stat] || 0);
        if (v >= Number(c.gte || 0)) this.unlockAchievement(a.id);
      });
    } catch (_) {}
  }

  // 保存成就
  saveAchievements() {
    try {
      const unlocked = this.achievements.filter(a => a.unlocked).map(a => a.id);
      localStorage.setItem('cityHeroAchievements', JSON.stringify(unlocked));
    } catch (e) {
      console.warn('Failed to save achievements');
    }
  }

  // 解锁成就
  unlockAchievement(id) {
    const achievement = this.achievements.find(a => a.id === id);
    if (achievement && !achievement.unlocked) {
      achievement.unlocked = true;
      this.saveAchievements();
      // 发放奖励（解锁职业/卡牌/道具）
      try {
        if (achievement.reward) this.applyAchievementReward(achievement.reward);
      } catch (_) {}
      this.showAchievementToast(achievement);
    }
  }

  applyAchievementReward(reward) {
    if (!reward || !reward.type || !reward.id) return;
    if (reward.type === "profession") {
      if (!this.unlockedProfessions.includes(reward.id)) {
        this.unlockedProfessions.push(reward.id);
        this.saveUnlockedProfessions();
      }
      this.log(`解锁新职业：${reward.id}！`, "combo");
      return;
    }
    if (reward.type === "card") {
      if (!this.unlockedCards.includes(reward.id)) {
        this.unlockedCards.push(reward.id);
        this.saveUnlocks();
      }
      this.log(`解锁新卡牌：${CARDS_DB[reward.id] ? CARDS_DB[reward.id].name : reward.id}！`, "combo");
      return;
    }
    if (reward.type === "item") {
      if (!this.unlockedItems.includes(reward.id)) {
        this.unlockedItems.push(reward.id);
        this.saveUnlocks();
      }
      this.log(`解锁新道具：${typeof ITEMS_DB !== "undefined" && ITEMS_DB[reward.id] ? ITEMS_DB[reward.id].name : reward.id}！`, "combo");
    }
  }

  // 显示成就弹窗
  showAchievementsModal() {
    // 不要进入游戏，只显示弹窗
    const modal = document.getElementById('achievements-modal');
    const list = document.getElementById('achievements-list');
    if (!modal || !list) {
      console.error('Achievements modal not found');
      return;
    }
    
    list.innerHTML = '';
    const rewardText = (a) => {
      if (!a.reward) return "";
      if (a.reward.type === "profession") return `解锁职业：${a.reward.id}`;
      if (a.reward.type === "card") return `解锁卡牌：${CARDS_DB[a.reward.id] ? CARDS_DB[a.reward.id].name : a.reward.id}`;
      if (a.reward.type === "item") return `解锁道具：${typeof ITEMS_DB !== "undefined" && ITEMS_DB[a.reward.id] ? ITEMS_DB[a.reward.id].name : a.reward.id}`;
      return "";
    };
    const progressText = (a) => {
      if (!a.criteria || !a.criteria.stat) return "";
      const cur = Number(this.stats && this.stats[a.criteria.stat] || 0);
      const need = Number(a.criteria.gte || 0);
      return `进度：${Math.min(cur, need)} / ${need}`;
    };

    this.achievements.forEach(a => {
      const item = document.createElement('div');
      item.className = `achievement-item ${a.unlocked ? '' : 'locked'}`;
      const r = rewardText(a);
      const p = progressText(a);
      item.innerHTML = `
        <div class="icon">${a.unlocked ? a.icon : '🔒'}</div>
        <div class="info">
          <div class="name">${a.name}</div>
          <div class="desc">${a.desc}</div>
          ${p ? `<div class="desc" style="opacity:.9;">${p}</div>` : ""}
          ${r ? `<div class="desc" style="opacity:.9;">奖励：${r}</div>` : ""}
        </div>
      `;
      list.appendChild(item);
    });
    
    modal.classList.remove('hidden');
    
    // 点击背景关闭
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    };
    
    // 关闭按钮
    const closeBtn = document.getElementById('achievements-close');
    if (closeBtn) {
      closeBtn.onclick = () => modal.classList.add('hidden');
    }
  }

  // 显示设置弹窗
  showSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    const syncMusicLabels = () => {
      const on = window.audioManager && window.audioManager.bgMusicEnabled;
      const st = document.getElementById("settings-music-toggle");
      if (st) st.textContent = on ? "🎵 音乐：开" : "🔇 音乐：关";
      const top = document.getElementById("music-btn");
      const sv = top && top.querySelector(".status-value");
      if (sv) sv.textContent = on ? "音乐" : "静音";
    };
    
    modal.classList.remove('hidden');
    syncMusicLabels();

    // 教学开关（默认跳过）
    try {
      const tut = document.getElementById("tutorial-toggle");
      if (tut) {
        tut.checked = !!this.tutorialEnabled;
        if (!tut.dataset.bound) {
          tut.dataset.bound = "1";
          tut.addEventListener("change", () => {
            this.setTutorialEnabled(!!tut.checked);
          });
        }
      }
    } catch (_) {}

    if (!this._settingsQuickActionsBound) {
      this._settingsQuickActionsBound = true;
      document.getElementById("settings-save-game")?.addEventListener("click", () => {
        try {
          modal.classList.add("hidden");
        } catch (_) {}
        this.openSaveModal("save");
      });
      document.getElementById("settings-load-game")?.addEventListener("click", () => {
        try {
          modal.classList.add("hidden");
        } catch (_) {}
        this.openSaveModal("load");
      });
      document.getElementById("settings-music-toggle")?.addEventListener("click", () => {
        if (window.audioManager) window.audioManager.toggleBgMusic();
        syncMusicLabels();
      });
    }
    
    // 音乐音量
    const musicVol = document.getElementById('music-volume');
    if (musicVol && window.audioManager) {
      musicVol.value = window.audioManager.musicVolume * 100;
      musicVol.oninput = () => {
        window.audioManager.setMusicVolume(musicVol.value / 100);
      };
    }
    
    // 音效音量
    const sfxVol = document.getElementById('sfx-volume');
    if (sfxVol && window.audioManager) {
      sfxVol.value = window.audioManager.sfxVolume * 100;
      sfxVol.oninput = () => {
        window.audioManager.setSfxVolume(sfxVol.value / 100);
      };
    }
    
    // 像素风切换
    const pixelToggle = document.getElementById('pixel-mode-toggle');
    if (pixelToggle) {
      pixelToggle.onchange = () => {
        document.body.classList.toggle('pixel-mode', pixelToggle.checked);
      };
    }
    
    // 关闭按钮
    const closeBtn = document.getElementById('settings-close');
    if (closeBtn) {
      closeBtn.onclick = () => modal.classList.add('hidden');
    }

    // 测试工具：清理本地存储（避免测试期间持久化干扰）
    if (!this._settingsResetBound) {
      this._settingsResetBound = true;
      const btnSaves = document.getElementById("btn-reset-saves");
      const btnUnlocks = document.getElementById("btn-reset-unlocks");
      const btnAll = document.getElementById("btn-reset-all");

      const ask = (title, msg, fn) => {
        // 用原生 confirm，避免再套一层 modal
        const ok = window.confirm(`${title}\n\n${msg}`);
        if (!ok) return;
        try { fn(); } catch (_) {}
        try { location.reload(); } catch (_) {}
      };

      if (btnSaves) {
        btnSaves.onclick = () => ask(
          "清空存档",
          "将删除 3 个存档位（以及旧单槽存档）。\n不会影响职业/难度解锁与成就。",
          () => this.resetLocalSaves()
        );
      }
      if (btnUnlocks) {
        btnUnlocks.onclick = () => ask(
          "重置解锁/难度",
          "将重置职业解锁、卡牌/道具解锁、难度解锁进度。\n不会删除存档（但旧存档可能因此不匹配新规则）。",
          () => this.resetLocalUnlocksAndDifficulty()
        );
      }
      if (btnAll) {
        btnAll.onclick = () => ask(
          "全清（推荐）",
          "将清空：存档、解锁/难度、成就、统计、已发现组合。\n用于从0开始测试完整流程。",
          () => this.resetLocalAll()
        );
      }
    }
  }

  // ===== 测试工具：清理本地存储 =====
  resetLocalSaves() {
    ["cityHeroSaveSlot1", "cityHeroSaveSlot2", "cityHeroSaveSlot3", "cityHeroSave"].forEach((k) => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
  }

  resetLocalUnlocksAndDifficulty() {
    ["cityHeroUnlockedProfessions", "cityHeroUnlocks"].forEach((k) => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
  }

  resetLocalAll() {
    [
      "cityHeroSaveSlot1", "cityHeroSaveSlot2", "cityHeroSaveSlot3", "cityHeroSave",
      "cityHeroUnlockedProfessions", "cityHeroUnlocks",
      "cityHeroStats", "cityHeroAchievements",
      "discoveredCombos"
    ].forEach((k) => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
  }

  // 开始第一场战斗
  startFirstBattle() {
    // 第一场战斗是教学性质的简单战斗
    // 教学期间：固定手牌/固定出牌，避免一回合秒怪导致教学中断
    this.tutorialBattleActive = true;
    // 固定手牌：起手只有 1 张拳头，通过“换牌”教学换出第 2 张拳头，再讲解牌型
    this._tutorialFixedHand = [
      "hooligan_punch",
      "hooligan_kick",
      "hooligan_intimidate",
      "attack",
      "attack",
      "potion",
      "block",
    ];
    // 教学：固定自动出牌索引（换牌后会有 2 张拳头 + 若干流氓/通用牌）
    this._tutorialFixedPickIndices = [0, 1, 2, 3, 4];
    this._tutorialSwapPool = ["hooligan_punch"];

    const firstEnemy = {
      id: "dummy",
      name: '训练假人',
      hp: 130,
      atk: 4,
      gold: 0,
      armor: 10,
      aiType: "basic",
    };
    
    this.enemy = {
      id: firstEnemy.id,
      name: firstEnemy.name,
      hp: firstEnemy.hp,
      maxHp: firstEnemy.hp,
      atk: firstEnemy.atk,
      gold: firstEnemy.gold,
      armor: firstEnemy.armor || 0,
      aiType: firstEnemy.aiType || "basic",
      intentText: "",
      stunned: 0,
      slow: 0,
      weakness: 0,
      blind: 0,
    };
    
    // 更新敌人显示
    const enemyLayerEl = document.getElementById('enemy-layer');
    if (enemyLayerEl) {
      enemyLayerEl.textContent = '教学战斗';
    }
    
    // 更新状态显示
    this.updateGoldDisplay();
    this.updateEnemyHP(this.enemy.hp);
    this.renderEnemySprite();
    this.renderItems();
    
    // 更新队友UI
    this.updateTeammateUI();
    this.selectedProfessions.forEach((p) => this.updateTeammateStatus(p));
    
    this.showBattleView();
    this.battle.initBattle(this.enemy, this.deck, this.items);
    
    // 显示提示
    this.log('💡 教学战斗：请按引导按钮完成流程', 'system');
  }

  loadUnlockedProfessions() {
    try {
      const saved = localStorage.getItem("cityHeroUnlockedProfessions");
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list) && list.length > 0) this.unlockedProfessions = list;
      }
    } catch (e) {
      this.unlockedProfessions = ["hooligan"];
    }
  }

  saveUnlockedProfessions() {
    try {
      localStorage.setItem("cityHeroUnlockedProfessions", JSON.stringify(this.unlockedProfessions));
    } catch (e) {}
  }

  // 加载已发现的组合
  loadDiscoveredCombos() {
    try {
      const saved = localStorage.getItem("discoveredCombos");
      if (saved) {
        this.discoveredCombos = JSON.parse(saved);
      }
    } catch (e) {
      this.discoveredCombos = [];
    }
  }

  // 保存已发现的组合
  saveDiscoveredCombos() {
    try {
      localStorage.setItem("discoveredCombos", JSON.stringify(this.discoveredCombos));
    } catch (e) {
      console.warn("Failed to save discovered combos");
    }
  }

  // 发现新组合
  discoverCombo(comboId) {
    if (!this.discoveredCombos.includes(comboId)) {
      this.discoveredCombos.push(comboId);
      this.saveDiscoveredCombos();
      this.incStat("combosDiscovered", 1);
      
      // 播放成就音效
      if (window.audioManager) {
        window.audioManager.legendaryItem();
      }
      
      // 显示成就弹窗
      const combo = HIDDEN_COMBOS.find(c => c.id === comboId);
      if (combo) {
        this.showAchievementToast(combo);
      }
    }
  }

  // 成就/发现提示（右上角 toast）
  showAchievementToast(entry) {
    const overlay = document.getElementById("achievement-overlay");
    if (!overlay) {
      const div = document.createElement("div");
      div.id = "achievement-overlay";
      div.className = "achievement-overlay";
      document.body.appendChild(div);
    }
    
    const el = document.getElementById("achievement-overlay") || document.createElement("div");
    const icon = entry && entry.icon ? entry.icon : "🏆";
    const name = entry && entry.name ? entry.name : "成就";
    const desc = entry && (entry.description || entry.desc) ? (entry.description || entry.desc) : "";
    const isCombo = !!(entry && entry.description && !entry.desc);
    const title = isCombo ? "🌟 发现隐藏组合！" : "🏆 解锁成就！";
    el.innerHTML = `
      <div class="achievement-content">
        <div class="achievement-icon">${icon}</div>
        <div class="achievement-title">${title}</div>
        <div class="achievement-name">${name}</div>
        <div class="achievement-desc">${desc}</div>
      </div>
    `;
    el.className = "achievement-overlay show";
    
    setTimeout(() => {
      el.className = "achievement-overlay";
    }, 3000);
  }

  init() {
    // 绑定开始页面按钮
    this.bindStartScreenEvents();
    
    // 绑定音乐按钮
    const musicBtn = document.getElementById('music-btn');
    if (musicBtn) {
      musicBtn.addEventListener('click', () => {
        if (window.audioManager) {
          const enabled = window.audioManager.toggleBgMusic();
          musicBtn.querySelector('.status-value').textContent = enabled ? '音乐' : '静音';
        }
      });
    }
    
    // 绑定组合技按钮
    const combosBtn = document.getElementById('combos-btn');
    if (combosBtn) {
      combosBtn.addEventListener('click', () => this.showCombosView());
    }

    // 死亡结算画面按钮
    if (!this._deathOverlayBound) {
      this._deathOverlayBound = true;
      document.getElementById("death-restart")?.addEventListener("click", () => this.restartAfterDeath());
      document.getElementById("death-exit")?.addEventListener("click", () => this.exitAfterDeath());
    }

    // 战斗内「牌型 / 伤害规则」按钮（效果等同于组合技说明，但战斗时更顺手）
    const battleRulesBtn = document.getElementById("battle-rules-btn");
    if (battleRulesBtn) {
      battleRulesBtn.addEventListener("click", () => this.showCombosView());
    }
    
    // 绑定组合技关闭按钮
    const combosClose = document.getElementById('combos-close');
    if (combosClose) {
      combosClose.addEventListener('click', () => {
        document.getElementById('combos-view').classList.add('hidden');
      });
    }
    // 牌库查看
    const deckBtn = document.getElementById('deck-btn');
    if (deckBtn) deckBtn.addEventListener('click', () => this.showDeckView());
    const deckClose = document.getElementById('deck-close');
    if (deckClose) deckClose.addEventListener('click', () => this.hideDeckView());

    // 全局兜底：任何点击/滚动都隐藏卡牌 tooltip，防止浮层卡住
    try {
      if (!document.body.dataset.globalTooltipHideBound) {
        document.body.dataset.globalTooltipHideBound = "1";
        const hide = () => {
          try { if (typeof CardUtil !== "undefined" && CardUtil.hideCardTooltip) CardUtil.hideCardTooltip(); } catch (_) {}
          try { document.getElementById("damage-breakdown-tooltip")?.classList.add("hidden"); } catch (_) {}
        };
        document.addEventListener("mousedown", hide, true);
        document.addEventListener("scroll", hide, true);
      }
    } catch (_) {}
  }

  showDeathOverlay() {
    const ov = document.getElementById("death-overlay");
    if (!ov) return;
    ov.classList.remove("hidden");
    ov.setAttribute("aria-hidden", "false");
  }

  hideDeathOverlay() {
    const ov = document.getElementById("death-overlay");
    if (!ov) return;
    ov.classList.add("hidden");
    ov.setAttribute("aria-hidden", "true");
  }

  restartAfterDeath() {
    this.hideDeathOverlay();
    // 直接开新一局（沿用当前难度；没设置则默认 1）
    this.gameEnded = false;
    this.battleUIEnabled = true;
    try { this.closeBattleDrawers(); } catch (_) {}
    try { document.getElementById("hand-container")?.classList.remove("game-ended"); } catch (_) {}
    this.startNewGame(this.difficulty || 1);
  }

  exitAfterDeath() {
    // 退出回到开始界面：用 reload 兜底清干净所有运行态
    try { this.hideDeathOverlay(); } catch (_) {}
    try { location.reload(); } catch (_) {}
  }
  
  // 初始化游戏数据（开始游戏时调用）
  initGameData() {
    // 队伍 - 根据选择的职业初始化
    this.teammates = {};
    const professionHp = {
      coder: 30,      // 程序员 - 血少，需要配合
      dog: 35,        // 狗 - 中等血量
      teacher: 40,    // 老师 - 中等血量
      security: 50,   // 保安 - 血厚，坦克
      hooligan: 38,   // 流氓 - 中等血量
      warrior: 50,    // 战士 - 血厚
      mage: 35,       // 法师 - 血少
      ranger: 40,     // 游侠 - 中等
      priest: 35,     // 牧师 - 血少
    };
    
    for (const prof of this.selectedProfessions) {
      const hp = professionHp[prof] || 40;
      this.teammates[prof] = { hp, maxHp: hp, shield: 0 };
    }

    this.gameEnded = false;
    this.tutorialBattleShownThisRun = false;

    // 每张单体治疗牌的绑定信息
    this.healTargets = {};
    this._healTagSeq = 1;

    // 敌人
    this.enemy = {
      name: "街头混混",
      hp: 50,
      maxHp: 50,
      atk: 5,
    };
    
    this.bindEvents();
  }

  // 更新队友 UI（根据选择的职业动态生成）
  updateTeammateUI() {
    const section = document.getElementById("teammate-section");
    if (!section) return;

    if (this._allyStateSprites) {
      Object.values(this._allyStateSprites).forEach((c) => {
        try {
          if (c && typeof c.destroy === "function") c.destroy();
        } catch (_) {}
      });
    }
    this._allyStateSprites = {};

    const professionInfo = {
      coder: { icon: "💻", name: "程序员", pixel: "coder" },
      dog: { icon: "🐕", name: "狗", pixel: "dog" },
      teacher: { icon: "📚", name: "老师", pixel: "teacher" },
      security: { icon: "👮", name: "保安", pixel: "security" },
      hooligan: { icon: "👊", name: "流氓", pixel: "hooligan" },
      warrior: { icon: "🛡️", name: "战士", pixel: "coder" },
      mage: { icon: "🔥", name: "法师", pixel: "coder" },
      ranger: { icon: "🏹", name: "游侠", pixel: "coder" },
      priest: { icon: "💚", name: "牧师", pixel: "coder" },
    };
    
    section.innerHTML = "";
    for (const prof of this.selectedProfessions) {
      const info = professionInfo[prof] || { icon: "❓", name: prof, pixel: "coder" };
      const slot = document.createElement("div");
      slot.className = "teammate-slot";
      slot.id = `slot-${prof}`;
      slot.dataset.type = prof;
      
      // 创建图标容器
      const iconContainer = document.createElement("div");
      iconContainer.className = "teammate-icon teammate-pixel";
      
      // 尝试渲染像素角色
      if (window.pixelRenderer && window.PIXEL_CHARS && window.PIXEL_CHARS[info.pixel]) {
        const ctrl =
          typeof window.pixelRenderer.createStateSprite === "function"
            ? window.pixelRenderer.createStateSprite(info.pixel, 1.15, 3)
            : null;
        if (ctrl && ctrl.el) {
          iconContainer.innerHTML = "";
          iconContainer.appendChild(ctrl.el);
          this._allyStateSprites[prof] = ctrl;
        } else {
          iconContainer.textContent = info.icon;
        }
      } else {
        iconContainer.textContent = info.icon;
      }
      
      slot.appendChild(iconContainer);
      
      // 添加其他元素
      const nameEl = document.createElement("div");
      nameEl.className = "teammate-name";
      nameEl.textContent = info.name;
      slot.appendChild(nameEl);
      
      const hpContainer = document.createElement("div");
      hpContainer.className = "teammate-hp";
      hpContainer.innerHTML = `
        <div class="hp-bar-wrap" title="生命值">
          <div class="hp-bar-fill" id="${prof}-hp-bar"></div>
          <div class="hp-bar-bg"></div>
        </div>
        <div class="hp-text" id="${prof}-hp">--/--</div>
      `;
      slot.appendChild(hpContainer);

      const debuffContainer = document.createElement("div");
      debuffContainer.className = "teammate-debuffs";
      debuffContainer.innerHTML = `
        <span class="debuff-badge poison" id="${prof}-poison-badge" title="中毒">☠️ <span id="${prof}-poison-val">0</span></span>
        <span class="debuff-badge burn" id="${prof}-burn-badge" title="灼烧">🔥 <span id="${prof}-burn-val">0</span></span>
      `;
      slot.appendChild(debuffContainer);
      
      const shieldContainer = document.createElement("div");
      shieldContainer.className = "teammate-shield";
      shieldContainer.innerHTML = `<span class="shield-icon">🛡️</span><span class="shield-value" id="${prof}-shield">0</span>`;
      slot.appendChild(shieldContainer);
      
      const comboEl = document.createElement("div");
      comboEl.className = "combo-indicator";
      comboEl.id = `${prof}-combo`;
      comboEl.textContent = "--";
      slot.appendChild(comboEl);
      
      // 绑定拖放事件
      this.bindDropZone(slot, prof);
      
      section.appendChild(slot);
    }
  }

  bindDropZone(slot, prof) {
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      slot.classList.add("target-selected");
    });
    slot.addEventListener("dragleave", () => {
      slot.classList.remove("target-selected");
    });
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("target-selected");
      const data = e.dataTransfer.getData("text/plain");
      if (!data) return;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "heal" && typeof parsed.index === "number") {
          // 这里的 index 是“手牌索引”。治疗目标绑定必须落在“出牌区索引”上，否则结算时读不到。
          const handIndex = parsed.index;
          if (!this.battle) return;
          const hand = this.battle.hand || [];
          const cardId = hand[handIndex];
          const card = cardId ? CARDS_DB[cardId] : null;
          if (!card || !card.heal || card.healAll) return;

          // 直接把这张治疗牌打到出牌区，然后按出牌区索引绑定目标
          const beforeLen = (this.battle.playedCards || []).length;
          const ok = this.battle.playCardToArea(handIndex);
          if (!ok) return;
          const playedIdx = ((this.battle.playedCards || []).length - 1);
          if (playedIdx < 0 || playedIdx < beforeLen) return;

          this.bindHealTarget(playedIdx, prof, { source: "played" });
          this.renderHand(this.battle.hand);
          this.renderPlayedArea(this.battle.playedCards);
          this.updateEstimatedDamage();
          this.updatePlayedCount();
        }
        // 出牌区内的治疗牌：拖到队友头像即可绑定目标（不移动卡）
        if (parsed.type === "heal-played" && typeof parsed.playedIndex === "number") {
          this.bindHealTarget(parsed.playedIndex, prof, { source: "played-drag" });
          this.renderHealMarkers();
          this.renderPlayedArea(this.battle?.playedCards || []);
        }
      } catch {
        // ignore
      }
    });

    // 点击队友头像：用于“出牌区治疗牌 -> 选目标模式”
    slot.addEventListener("click", () => {
      try {
        const idx = this._pendingHealPlayedIndex;
        if (typeof idx !== "number") return;
        this.bindHealTarget(idx, prof, { source: "played-click" });
        this._pendingHealPlayedIndex = null;
        this.renderHealMarkers();
        this.renderPlayedArea(this.battle?.playedCards || []);
      } catch (_) {}
    });
  }

  // ===== 视图切换 =====
  /** 战斗时：顶栏显示道具槽、隐藏存档/音乐；非战斗时相反 */
  syncBattleTopChrome() {
    try {
      const battle = document.getElementById("battle-view");
      const gc = document.getElementById("game-container");
      const items = document.getElementById("battle-top-items");
      const inBattle = !!(battle && !battle.classList.contains("hidden"));
      gc?.classList.toggle("in-battle", inBattle);
      if (items) {
        items.classList.toggle("hidden", !inBattle);
        items.setAttribute("aria-hidden", inBattle ? "false" : "true");
      }
    } catch (_) {}
  }

  showMapView() {
    this.view = "map";
    
    // 隐藏所有其他视图
    const teamBuildView = document.getElementById("team-build-view");
    const mapView = document.getElementById("map-view");
    const battleView = document.getElementById("battle-view");
    const shopView = document.getElementById("shop-view");
    const eventView = document.getElementById("event-view");
    const combosView = document.getElementById("combos-view");
    const rewardView = document.getElementById("reward-view");
    const deckView = document.getElementById("deck-view");
    
    if (teamBuildView) teamBuildView.classList.add("hidden");
    if (mapView) mapView.classList.remove("hidden");
    if (battleView) battleView.classList.add("hidden");
    if (shopView) shopView.classList.add("hidden");
    if (eventView) eventView.classList.add("hidden");
    if (combosView) combosView.classList.add("hidden");
    if (rewardView) rewardView.classList.add("hidden");
    if (deckView) deckView.classList.add("hidden");
    
    // 重新渲染地图
    this.renderMap();
    
    // 切换到地图音乐
    try {
      if (window.audioManager && window.audioManager.initialized) {
        window.audioManager.playSceneMusic('map');
      }
    } catch (e) {
      console.warn('Map music error:', e);
    }
    this.syncBattleTopChrome();
  }

  showBattleView() {
    this.view = "battle";
    const teamBuildView = document.getElementById("team-build-view");
    const mapView = document.getElementById("map-view");
    const battleView = document.getElementById("battle-view");
    const shopView = document.getElementById("shop-view");
    const eventView = document.getElementById("event-view");
    const rewardView = document.getElementById("reward-view");
    const combosView = document.getElementById("combos-view");
    const deckView = document.getElementById("deck-view");
    if (teamBuildView) teamBuildView.classList.add("hidden");
    if (mapView) mapView.classList.add("hidden");
    if (battleView) battleView.classList.remove("hidden");
    if (shopView) shopView.classList.add("hidden");
    if (eventView) eventView.classList.add("hidden");
    if (rewardView) rewardView.classList.add("hidden");
    if (combosView) combosView.classList.add("hidden");
    if (deckView) deckView.classList.add("hidden");

    // 移动端：调整战斗头部布局顺序（敌人 → 预计伤害 → 队友）
    try {
      this.syncMobileBattleHeader();
    } catch (_) {}
    this.syncBattleTopChrome();
  }

  syncMobileBattleHeader() {
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 600px)").matches;
    const header = document.getElementById("battle-header");
    const enemy = document.getElementById("enemy-section");
    const teammate = document.getElementById("teammate-section");
    const slot = document.getElementById("mobile-damage-slot");
    const dmg = document.getElementById("battle-sidebar-damage-box");
    const sidebar = document.getElementById("battle-sidebar");
    if (!header || !enemy || !teammate || !slot || !dmg) return;

    if (isMobile) {
      slot.classList.remove("hidden");
      // 头部顺序：敌人 → 伤害 → 队友
      if (enemy.parentElement === header) header.appendChild(enemy); // 先放到末尾再重排
      if (slot.parentElement === header) header.appendChild(slot);
      if (teammate.parentElement === header) header.appendChild(teammate);

      // 把伤害框挪到 slot 中（只挪 dom，不复制）
      if (dmg.parentElement !== slot) slot.appendChild(dmg);
    } else {
      // 桌面端：伤害框回到侧栏
      slot.classList.add("hidden");
      if (sidebar && dmg.parentElement !== sidebar) sidebar.insertBefore(dmg, sidebar.querySelector("#damage-breakdown-tooltip") || null);
    }
    // 伤害框可能被移动，确保悬停明细已绑定
    try { this.bindDamageBreakdownTooltip(); } catch (_) {}
  }

  renderMap() {
    const container = document.getElementById("map-container");
    if (!container) {
      console.error('Map container not found');
      return;
    }
    container.innerHTML = "";

    const rows = this.map.getRows();
    if (!rows || rows.length === 0) {
      console.error('No map rows to render');
      return;
    }
    // 连线层
    const linksLayer = document.createElement("div");
    linksLayer.className = "map-links-layer";
    container.appendChild(linksLayer);

    // 先渲染节点按钮，并记录引用
    const nodeButtonMap = new Map();
    
    for (const row of rows) {
      const rowEl = document.createElement("div");
      rowEl.className = "map-row";

      for (const node of row) {
        if (node.type === "start") continue;
        const btn = document.createElement("button");
        
        // 检查节点状态：必须未访问、已解锁、且在当前节点的 next 中
        const current = this.map.getNode(this.map.currentNodeId);
        const isNextOfCurrent = current && current.next && current.next.includes(node.id);
        const isUnlocked = node.unlocked && !node.visited && isNextOfCurrent;
        const isVisited = node.visited;
        
        btn.className = `map-node ${node.type} ${isVisited ? "visited" : ""} ${isUnlocked ? "" : "locked"}`;
        btn.type = "button";
        btn.textContent = this.nodeLabel(node.type);
        btn.disabled = !isUnlocked;
        // 悬停预览：战斗节点显示敌人信息/难度；其它节点显示简要说明
        if (node.type === "battle" || node.type === "elite" || node.type === "boss") {
          const e = node.enemy;
          const name = e?.name || (node.type === "boss" ? "Boss" : (node.type === "elite" ? "精英" : "敌人"));
          const hp = e?.hp != null ? Math.floor(e.hp) : "?";
          const atk = e?.atk != null ? Math.floor(e.atk) : "?";
          const stars = (node.type === "boss") ? "★★★★★" : (node.type === "elite") ? "★★★★" : "★★★";
          btn.title = `${stars} ${name}\n生命：${hp}\n攻击：${atk}`;
        } else if (node.type === "shop") {
          btn.title = "商店：购买卡牌/道具，升级卡牌";
        } else if (node.type === "event") {
          btn.title = "事件：可能获得奖励，也可能受伤";
        } else {
          btn.title = isUnlocked ? `${node.type}` : `需先通过前置节点`;
        }
        
        if (isUnlocked) {
          btn.addEventListener("click", () => this.enterNode(node.id));
        }
        nodeButtonMap.set(node.id, btn);
        rowEl.appendChild(btn);
      }

      if (rowEl.children.length) container.appendChild(rowEl);
    }

    // 再根据 MapManager.nodes 绘制完整网状连线
    if (typeof this.map.getNodes === "function") {
      const allNodes = this.map.getNodes();
      const currentId = this.map.currentNodeId;
      const current = this.map.getNode(currentId);
      const nextSet = new Set((current && current.next) || []);

      for (const node of allNodes) {
        if (!node.next || !node.next.length) continue;
        const fromBtn = nodeButtonMap.get(node.id);
        if (!fromBtn) continue;
        const isLockedBtn = fromBtn.classList.contains("locked");
        const isVisited = !!node.visited;
        const isCurrent = node.id === currentId;
        const isUnlocked = node.unlocked && !node.visited;
        // 只隐藏那种既未访问、也非当前、且依然是锁定的分支起点
        const shouldHideFrom = isLockedBtn && !isVisited && !isCurrent && !isUnlocked;
        if (shouldHideFrom) continue;
        const fromRect = fromBtn.getBoundingClientRect();

        for (const nextId of node.next) {
          const toBtn = nodeButtonMap.get(nextId);
          if (!toBtn) continue;
          const toRect = toBtn.getBoundingClientRect();

          const x1 = fromRect.left + fromRect.width / 2;
          const y1 = fromRect.top + fromRect.height / 2;
          const x2 = toRect.left + toRect.width / 2;
          const y2 = toRect.top + toRect.height / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;

          const link = document.createElement("div");
          link.className = "map-link";

          // 计算在 linksLayer 内部的相对坐标
          const layerRect = linksLayer.getBoundingClientRect();
          link.style.width = `${dist}px`;
          link.style.left = `${x1 - layerRect.left}px`;
          link.style.top = `${y1 - layerRect.top}px`;
          link.style.transform = `rotate(${angle}deg)`;

          // 状态：已走路径 / 当前可走 / 其它
          const toNode = this.map.getNode(nextId);
          const isVisitedPath = toNode && toNode._from === node.id;
          const isNext = nextSet.has(nextId) && !toNode?.visited;

          if (isVisitedPath) {
            link.classList.add("visited");
          } else if (isNext) {
            link.classList.add("next");
          } else {
            link.classList.add("locked");
          }

          linksLayer.appendChild(link);
        }
      }
    }
  }

  nodeLabel(type) {
    if (type === "battle") return "⚔️";
    if (type === "event") return "❓";
    if (type === "shop") return "🛒";
    if (type === "boss") return "👑";
    return "•";
  }

  enterNode(nodeId) {
    // 地图上可见且可点的节点，有时会因为状态不同步导致 canEnter 判错
    // 这里直接交给 MapManager.enter 来做最终判断，避免前置校验拦住点击
    const node = this.map.enter(nodeId);
    if (node) {
      this.currentNode = node;
    }
  }

  // ===== 事件系统 =====
  showEvent(event) {
    if (!event) {
      // 随机生成一个事件
      event = this.map.generateEvent();
    }
    
    this.currentEvent = event;
    const eventView = document.getElementById("event-view");
    const mapView = document.getElementById("map-view");
    
    if (mapView) mapView.classList.add("hidden");
    if (eventView) eventView.classList.remove("hidden");
    
    document.getElementById("event-icon").textContent = event.icon || "❓";
    document.getElementById("event-title").textContent = event.name || "神秘事件";
    document.getElementById("event-description").textContent = event.description || "";
    
    const effectEl = document.getElementById("event-effect");
    effectEl.innerHTML = "";
    if (event.effect) {
      const effects = [];
      if (event.effect.gold !== undefined && event.effect.gold !== null) {
        const sign = event.effect.gold >= 0 ? "+" : "";
        effects.push(`💰 ${sign}${event.effect.gold} 金币`);
      }
      if (event.effect.healAll) effects.push("💚 全队恢复生命");
      if (event.effect.damage) effects.push(`💔 受到 ${event.effect.damage} 伤害`);
      const ncPreview = Number(event.effect.addRandomCards) || (event.effect.addRandomCard ? 1 : 0);
      if (ncPreview > 0) {
        effects.push(ncPreview > 1 ? `🎴 随机卡牌 ×${ncPreview}（编队/通用）` : "🎴 随机卡牌（编队/通用）");
      }
      if (event.effect.addRandomItem) effects.push("🎁 随机道具（编队可用）");
      if (event.effect.buff) effects.push("⬆️ 获得增益效果");
      effectEl.innerHTML = effects.join(" | ");
    }
    
    // 播放事件音乐
    try {
      if (window.audioManager && window.audioManager.initialized) {
        window.audioManager.playSceneMusic('event');
        // 播放事件音效
        if (event.effect && (event.effect.healAll || (event.effect.gold && event.effect.gold > 0))) {
          window.audioManager.eventPositive();
        } else if (event.effect && (event.effect.damage || (event.effect.gold && event.effect.gold < 0))) {
          window.audioManager.eventNegative();
        }
      }
    } catch (e) {
      console.warn('Event music error:', e);
    }
    this.syncBattleTopChrome();
  }

  confirmEvent() {
    const event = this.currentEvent;
    if (event && event.effect) {
      const eff = event.effect;
      const goldDelta = typeof eff.gold === "number" ? eff.gold : 0;
      const payLoot =
        !!(eff.addRandomItem || eff.addRandomCard || (typeof eff.addRandomCards === "number" && eff.addRandomCards > 0));
      const broke = goldDelta < 0 && payLoot && (this.gold || 0) + goldDelta < 0;
      if (broke) {
        this.log("金币不够支付这次交换，对方算了——该给的仍给你，钱就不收了。", "system");
      } else if (eff.gold !== undefined && eff.gold !== null) {
        this.gold = Math.max(0, (this.gold || 0) + eff.gold);
        this.updateGoldDisplay();
      }
      if (eff.healAll) {
        (this.selectedProfessions || ["hooligan"]).forEach((p) => {
          if (this.teammates[p]) {
            this.teammates[p].hp = this.teammates[p].maxHp;
            this.updateTeammateStatus(p);
          }
        });
      }
      if (eff.damage) {
        const professions = Array.isArray(this.selectedProfessions) && this.selectedProfessions.length
          ? this.selectedProfessions
          : Object.keys(this.teammates || {});
        const alive = professions.filter((p) => {
          const t = this.teammates && this.teammates[p];
          return t && t.hp > 0;
        });
        if (alive.length && this.applyDamageToTeammate) {
          this.applyDamageToTeammate(alive[Math.floor(Math.random() * alive.length)], eff.damage);
        } else if (this.takeDamage) {
          this.takeDamage(eff.damage);
        }
      }
      if (eff.addRandomItem) this.grantEventItemReward("事件");
      const cardN = typeof eff.addRandomCards === "number" ? eff.addRandomCards : eff.addRandomCard ? 1 : 0;
      if (cardN > 0) this.grantEventCardRewards(cardN, "事件");
      if (eff.buff === "damage" && eff.value) {
        this._eventRunDamageBuff = Math.max(1, Number(eff.value) || 1);
        this._eventBuffTipShown = false;
        this.log(`下一场战斗我方造成伤害 ×${this._eventRunDamageBuff}（事件增益）`, "combo");
      }
    }
    
    this.currentEvent = null;
    document.getElementById("event-view").classList.add("hidden");
    this.showMapView();
  }

  // ===== 商店系统 =====
  showShop() {
    this.shopItems = this.generateShopItems();
    this.refreshShopUI();
    
    const shopView = document.getElementById("shop-view");
    const mapView = document.getElementById("map-view");
    
    if (mapView) mapView.classList.add("hidden");
    if (shopView) shopView.classList.remove("hidden");
    
    // 播放商店音乐
    try {
      if (window.audioManager && window.audioManager.initialized) {
        window.audioManager.playSceneMusic('shop');
      }
    } catch (e) {
      console.warn('Shop music error:', e);
    }
    this.syncBattleTopChrome();
  }

  generateShopItems() {
    const items = {
      cards: [],
      upgrades: [],
      shopItems: [],
      sellCards: [...this.deck]
    };
    
    // 随机生成可购买的卡牌
    const cardPool = Object.keys(CARDS_DB).filter(id => {
      const card = CARDS_DB[id];
      if (!card) return false;
      if (card.profession === "common") return false;
      // 只卖已解锁职业的卡；锁定卡需先通过成就解锁
      if (!this.unlockedProfessions.includes(card.profession)) return false;
      if (!this.isCardUnlocked(id)) return false;
      return true;
    });
    
    for (let i = 0; i < 3; i++) {
      const cardId = cardPool[Math.floor(Math.random() * cardPool.length)];
      const card = CARDS_DB[cardId];
      items.cards.push({
        id: cardId,
        name: card.name,
        icon: card.icon,
        cost: 50 + (card.damage || 0) * 2 + (card.heal || 0),
        rarity: card.profession
      });
    }
    
    // 可升级的卡牌（从牌库中选取，同种卡只出现一次）
    const seen = new Set();
    items.upgrades = [];
    for (const cardId of this.deck) {
      if (seen.has(cardId)) continue;
      seen.add(cardId);
      const card = CARDS_DB[cardId];
      if (card) items.upgrades.push({ id: cardId, name: card.name, icon: card.icon });
      if (items.upgrades.length >= 6) break;
    }
    
    // 随机生成道具（价格按稀有度落在设计文档区间）
    let itemPool = this.getShopAndEventItemPool();
    if (itemPool.length < 4) {
      itemPool = Object.keys(ITEMS_DB).filter((id) => this.isItemUnlocked(id));
    }
    for (let i = 0; i < 2; i++) {
      const itemId = itemPool[Math.floor(Math.random() * itemPool.length)];
      const item = ITEMS_DB[itemId];
      const rarity = item.rarity || "common";
      let minPrice = 80;
      let maxPrice = 120;
      if (rarity === "rare") {
        minPrice = 120;
        maxPrice = 180;
      } else if (rarity === "epic") {
        minPrice = 250;
        maxPrice = 350;
      } else if (rarity === "legendary") {
        minPrice = 450;
        maxPrice = 600;
      }
      const cost = minPrice + Math.floor(Math.random() * (maxPrice - minPrice + 1));
      items.shopItems.push({
        id: itemId,
        name: item.name,
        icon: item.icon,
        cost,
        rarity
      });
    }

    // 随机出售：道具栏扩展（一次购买，立刻生效）
    // 概率不宜过高，避免每家店都刷出
    if (Math.random() < 0.35) {
      const curCap = this.getItemSlotCapacity ? this.getItemSlotCapacity() : 10;
      if (curCap >= 10) return items;
      const cost = 120 + Math.max(0, curCap - 4) * 60;
      items.shopItems.push({
        kind: "item_slot_upgrade",
        id: "item_slot_upgrade",
        name: "道具栏扩展",
        icon: "🎒",
        cost,
        rarity: "rare"
      });
    }
    
    return items;
  }

  bindShopItemTooltip(el, name, desc, effect) {
    const tooltip = document.getElementById("shop-tooltip");
    if (!tooltip) return;
    const show = (e) => {
      tooltip.innerHTML = `
        <div class="tt-name">${name}</div>
        ${desc ? `<div class="tt-desc">${desc}</div>` : ''}
        ${effect ? `<div class="tt-effect">${effect.replace(/\n/g, '<br>')}</div>` : ''}
      `;
      tooltip.classList.remove("hidden");
      const x = e.clientX, y = e.clientY;
      const pad = 16;
      let left = x + pad, top = y + pad;
      if (left + 340 > window.innerWidth) left = x - 340 - pad;
      if (top + 200 > window.innerHeight) top = y - 200 - pad;
      if (top < 8) top = 8;
      if (left < 8) left = 8;
      tooltip.style.left = left + "px";
      tooltip.style.top = top + "px";
    };
    const hide = () => { tooltip.classList.add("hidden"); };
    el.addEventListener("mouseenter", show);
    el.addEventListener("mousemove", show);
    el.addEventListener("mouseleave", hide);
  }

  refreshShopUI() {
    // 更新金币显示
    document.getElementById("shop-gold-display").textContent = this.gold || 0;
    
    // 卡牌购买区
    const cardsEl = document.getElementById("shop-cards");
    cardsEl.innerHTML = "";
    this.shopItems.cards.forEach((item, idx) => {
      const card = CARDS_DB[item.id];
      if (!card) return;
      const prof = card.profession || 'common';
      const profShort = (typeof PROFESSION_SHORT !== 'undefined' && PROFESSION_SHORT[prof]) || '通';
      
      const el = document.createElement("div");
      el.className = `shop-item ${prof} ${item.rarity}`;
      el.innerHTML = `
        <div class="shop-item-prof" data-prof="${prof}">${profShort}</div>
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-cost">💰 ${item.cost}</div>
        <div class="shop-item-detail">
          <div class="shop-item-detail-header">
            <span class="shop-item-detail-icon">${card.icon}</span>
            <span class="shop-item-detail-name">${card.name}</span>
          </div>
          <div class="shop-item-detail-desc">${card.description}</div>
          ${card.detail ? `<div class="shop-item-detail-effect">${card.detail.replace(/\n/g, '<br>')}</div>` : ''}
        </div>
      `;
      el.addEventListener("click", () => this.buyCard(idx));
      this.bindShopItemTooltip(el, card.name, card.description, card.detail);
      cardsEl.appendChild(el);
    });
    
    // 升级区
    const upgradeEl = document.getElementById("shop-upgrade");
    upgradeEl.innerHTML = "";
    this.shopItems.upgrades.forEach((item, idx) => {
      const card = CARDS_DB[item.id];
      if (!card) return;
      const currentLevel = this.getCardLevel(item.id);
      const isMaxLevel = currentLevel >= 3;
      const el = document.createElement("div");
      el.className = `shop-item ${card?.profession || ''} ${isMaxLevel ? 'max-level' : ''}`;
      el.innerHTML = `
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-name">${item.name} Lv.${currentLevel}</div>
        <div class="shop-item-cost">${isMaxLevel ? '已满级' : '💰 50'}</div>
        <div class="shop-item-detail">
          <div class="shop-item-detail-header">
            <span class="shop-item-detail-icon">${item.icon}</span>
            <span class="shop-item-detail-name">${item.name}</span>
          </div>
          <div class="shop-item-detail-desc">${card?.description || ''}</div>
          <div class="shop-item-detail-effect">${isMaxLevel ? '已达 Lv.3，效果+100%' : '升级后效果+50%（最高Lv.3）'}</div>
        </div>
      `;
      if (!isMaxLevel) el.addEventListener("click", () => this.upgradeCard(idx));
      this.bindShopItemTooltip(el, item.name, card?.description || '', isMaxLevel ? '已达 Lv.3，效果+100%' : '升级后效果+50%（最高Lv.3）');
      upgradeEl.appendChild(el);
    });
    
    // 道具区
    const itemsEl = document.getElementById("shop-items");
    itemsEl.innerHTML = "";
    this.shopItems.shopItems.forEach((item, idx) => {
      const isSlotUpgrade = item.kind === "item_slot_upgrade";
      const itemData = isSlotUpgrade ? null : ITEMS_DB[item.id];
      if (!isSlotUpgrade && !itemData) return;
      
      const el = document.createElement("div");
      el.className = `shop-item ${item.rarity}`;
      el.innerHTML = `
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-cost">💰 ${item.cost}</div>
        <div class="shop-item-detail">
          <div class="shop-item-detail-header">
            <span class="shop-item-detail-icon">${isSlotUpgrade ? "🎒" : itemData.icon}</span>
            <span class="shop-item-detail-name">${isSlotUpgrade ? "道具栏扩展" : itemData.name}</span>
          </div>
          <div class="shop-item-detail-desc">${isSlotUpgrade ? "永久增加 1 个道具槽位（立即生效）" : (itemData.description || '')}</div>
          ${isSlotUpgrade ? `<div class="shop-item-detail-effect">（可叠加）</div>` : (itemData.detail ? `<div class="shop-item-detail-effect">${itemData.detail}</div>` : '')}
        </div>
      `;
      el.addEventListener("click", () => this.buyItem(idx));
      if (isSlotUpgrade) {
        this.bindShopItemTooltip(el, "道具栏扩展", "永久增加 1 个道具槽位（立即生效）", "（可叠加）");
      } else {
        this.bindShopItemTooltip(el, itemData.name, itemData.description, itemData.detail);
      }
      itemsEl.appendChild(el);
    });
    
    // 出售区
    const sellEl = document.getElementById("shop-sell");
    sellEl.innerHTML = "";
    this.shopItems.sellCards.forEach((cardId, idx) => {
      const card = CARDS_DB[cardId];
      if (!card) return;
      const price = 20 + (card.damage || 0);
      
      const el = document.createElement("div");
      const prof = card.profession || 'common';
      const profShort = (typeof PROFESSION_SHORT !== 'undefined' && PROFESSION_SHORT[prof]) || '通';
      el.className = `shop-item ${prof}`;
      el.innerHTML = `
        <div class="shop-item-prof" data-prof="${prof}">${profShort}</div>
        <div class="shop-item-icon">${card.icon}</div>
        <div class="shop-item-name">${card.name}</div>
        <div class="shop-item-cost">💰 ${price}</div>
        <div class="shop-item-detail">
          <div class="shop-item-detail-header">
            <span class="shop-item-detail-icon">${card.icon}</span>
            <span class="shop-item-detail-name">${card.name}</span>
          </div>
          <div class="shop-item-detail-desc">${card.description}</div>
          ${card.detail ? `<div class="shop-item-detail-effect">${card.detail.replace(/\n/g, '<br>')}</div>` : ''}
        </div>
      `;
      el.addEventListener("click", () => this.sellCard(idx));
      this.bindShopItemTooltip(el, card.name, card.description, card.detail);
      sellEl.appendChild(el);
    });
  }

  buyCard(idx) {
    const item = this.shopItems.cards[idx];
    if (!item) return;
    if ((this.gold || 0) < item.cost) {
      this.log("金币不足！", "system");
      return;
    }
    
    this.gold -= item.cost;
    this.deck.push(item.id);
    this.incStat("cardsBought", 1);
    this.shopItems.cards.splice(idx, 1);
    this.refreshShopUI();
    
    if (window.audioManager) window.audioManager.shopBuy();
    this.log(`购买卡牌：${item.name}`, "player");
  }

  upgradeCard(idx) {
    const item = this.shopItems.upgrades[idx];
    if (!item) return;
    const level = this.getCardLevel(item.id);
    if (level >= 3) {
      this.log("该卡牌已满级（Lv.3）！", "system");
      return;
    }
    if ((this.gold || 0) < 50) {
      this.log("金币不足！", "system");
      return;
    }
    this.gold -= 50;
    this.cardLevels[item.id] = level + 1;
    this.incStat("cardsUpgraded", 1);
    this.refreshShopUI();
    if (window.audioManager) window.audioManager.shopBuy();
    this.log(`升级卡牌：${item.name} → Lv.${level + 1}（效果+50%）`, "player");
  }

  buyItem(idx) {
    const item = this.shopItems.shopItems[idx];
    if (!item) return;
    if ((this.gold || 0) < item.cost) {
      this.log("金币不足！", "system");
      return;
    }

    // 商店特殊商品：道具栏扩展（非可装备道具）
    if (item.kind === "item_slot_upgrade") {
      this.gold -= item.cost;
      this.shopItems.shopItems.splice(idx, 1);
      this.refreshShopUI();
      this.updateGoldDisplay();
      if (window.audioManager) window.audioManager.shopBuy();
      if (typeof this.increaseItemSlotCapacity === "function") this.increaseItemSlotCapacity(1);
      this.log(`购买：道具栏扩展（当前 ${this.getItemSlotCapacity()} 格）`, "player");
      return;
    }

    // 道具栏满：允许直接选择替换槽位
    const cap = this.getItemSlotCapacity ? this.getItemSlotCapacity() : 4;
    if (this.items.length >= cap) {
      this.openShopReplaceItemModal(item, idx);
      return;
    }
    
    this.gold -= item.cost;
    this.items.push(item.id);
    this.incStat("itemsBought", 1);
    this.shopItems.shopItems.splice(idx, 1);
    this.refreshShopUI();
    this.renderItems();
    
    if (window.audioManager) window.audioManager.shopBuy();
    this.log(`购买道具：${item.name}`, "player");
  }

  openShopReplaceItemModal(shopItem, shopIdx) {
    const modal = document.getElementById("shop-replace-modal");
    const desc = document.getElementById("shop-replace-desc");
    const slots = document.getElementById("shop-replace-slots");
    const cancel = document.getElementById("shop-replace-cancel");
    if (!modal || !slots) {
      // 兜底：没有弹窗就按旧逻辑提示
      this.showModal("道具栏已满", "当前已装备 4 件道具，无法继续购买。");
      return;
    }

    const itemData = typeof ITEMS_DB !== "undefined" ? ITEMS_DB[shopItem.id] : null;
    if (desc) desc.textContent = `购买 ${itemData ? `${itemData.icon} ${itemData.name}` : shopItem.name}（💰 ${shopItem.cost}），请选择要替换的道具：`;

    slots.innerHTML = "";
    const cap = this.getItemSlotCapacity ? this.getItemSlotCapacity() : 4;
    for (let i = 0; i < cap; i++) {
      const curId = this.items[i];
      const cur = curId && typeof ITEMS_DB !== "undefined" ? ITEMS_DB[curId] : null;
      const btn = document.createElement("button");
      btn.className = "secondary-btn save-slot-btn";
      btn.innerHTML = `
        <div class="save-slot-title">槽位 ${i + 1}</div>
        <div class="save-slot-time">${cur ? `${cur.icon || "🎁"} ${cur.name || curId}` : "空"}</div>
      `;
      btn.title = cur ? (cur.detail || cur.description || "") : "";
      btn.onclick = () => {
        if ((this.gold || 0) < shopItem.cost) {
          this.log("金币不足！", "system");
          modal.classList.add("hidden");
          return;
        }
        this.gold -= shopItem.cost;
        this.items[i] = shopItem.id;
        this.incStat("itemsBought", 1);
        this.shopItems.shopItems.splice(shopIdx, 1);
        this.refreshShopUI();
        this.renderItems();
        this.updateGoldDisplay();
        if (window.audioManager) window.audioManager.shopBuy();
        this.log(`替换道具：槽位${i + 1} → ${itemData ? itemData.name : shopItem.name}`, "player");
        modal.classList.add("hidden");
      };
      slots.appendChild(btn);
    }

    if (cancel) cancel.onclick = () => modal.classList.add("hidden");
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };
    modal.classList.remove("hidden");
  }

  sellCard(idx) {
    const cardId = this.shopItems.sellCards[idx];
    const card = CARDS_DB[cardId];
    if (!card) return;
    
    const price = 20 + (card.damage || 0);
    this.gold = (this.gold || 0) + price;
    
    // 从牌库移除
    const deckIdx = this.deck.indexOf(cardId);
    if (deckIdx > -1) {
      this.deck.splice(deckIdx, 1);
    }
    this.shopItems.sellCards.splice(idx, 1);
    this.refreshShopUI();
    
    if (window.audioManager) window.audioManager.shopSell();
    this.log(`出售卡牌：${card.name} (+${price}金币)`, "player");
  }

  refreshShop() {
    if ((this.gold || 0) < 30) {
      this.log("金币不足！", "system");
      return;
    }
    
    this.gold -= 30;
    this.shopItems = this.generateShopItems();
    this.refreshShopUI();
    
    if (window.audioManager) window.audioManager.gold();
  }

  leaveShop() {
    document.getElementById("shop-view").classList.add("hidden");
    this.showMapView();
  }

  // ===== 牌型 / 伤害规则 查看（基础规则在前，隐藏组合在最后）=====
  showCombosView() {
    const combosView = document.getElementById("combos-view");
    const rulesBaseList = document.getElementById("rules-base-list");
    const rulesHint = document.getElementById("rules-base-hint");
    const rulesCodeText = document.getElementById("rules-code-text");
    const rulesShieldText = document.getElementById("rules-shield-text");
    const combosList = document.getElementById("combos-list");
    const combosEmpty = document.getElementById("combos-empty");

    if (!combosView) return;

    // 1. 基础牌型规则
    if (rulesBaseList && typeof BASE_COMBO_RULES !== "undefined") {
      rulesBaseList.innerHTML = "";
      BASE_COMBO_RULES.forEach((r) => {
        const row = document.createElement("div");
        row.className = "rule-row";
        row.innerHTML = `<span class="rule-name">${r.name}</span><span class="rule-desc">${r.rule}</span>`;
        rulesBaseList.appendChild(row);
      });
    }
    // 基础规则提示（避免误解：通用牌是否计入）
    if (rulesHint) {
      rulesHint.textContent = "提示：通用牌（标记为「通」）不计入牌型统计，只用于补位/触发自身效果。";
    }

    // 2. 程序员代码牌规则
    if (rulesCodeText && typeof CODE_COMBO_RULES_TEXT !== "undefined") {
      rulesCodeText.textContent = CODE_COMBO_RULES_TEXT;
    }

    // 2.5 护盾规则说明（让机制更明确）
    if (rulesShieldText) {
      rulesShieldText.textContent =
        "护盾会优先吸收伤害（先扣护盾，再扣血）。\n" +
        "中毒：回合开始结算，伤害无视护盾。\n" +
        "火焰：回合开始结算，护盾减免只有 50%，且每回合消耗 12 层火焰。\n" +
        "提示：某些 Boss 会专门克制护盾（如中毒/火焰）。";
    }

    // 3. 隐藏组合（放在最后）
    if (combosList) combosList.innerHTML = "";
    if (combosEmpty) {
      if (!this.discoveredCombos || this.discoveredCombos.length === 0) {
        combosEmpty.style.display = "block";
        if (combosList) combosList.style.display = "none";
      } else {
        combosEmpty.style.display = "none";
        if (combosList) combosList.style.display = "block";
        this.discoveredCombos.forEach((comboId) => {
          const combo = HIDDEN_COMBOS.find((c) => c.id === comboId);
          if (!combo) return;
          let effectText = `伤害×${combo.effect.damageMultiplier || 1}`;
          if (combo.effect.healAll) effectText += ` | 治疗全员 ${combo.effect.healAll}`;
          if (combo.effect.shield) effectText += ` | 护盾 ${combo.effect.shield}`;
          if (combo.effect.stun) effectText += " | 眩晕";
          if (combo.effect.draw) effectText += ` | 抽牌 ${combo.effect.draw}`;
          if (combo.effect.extraTurn) effectText += " | 额外回合";
          const el = document.createElement("div");
          el.className = "combo-item";
          el.innerHTML = `
            <div class="combo-icon">${combo.icon}</div>
            <div class="combo-info">
              <div class="combo-name">${combo.name}</div>
              <div class="combo-desc">${combo.description}</div>
              <div class="combo-effect">${effectText}</div>
              <div class="combo-hint" style="font-size: 12px; color: #888; margin-top: 5px;">📋 ${combo.hint || "需要特定卡牌组合"}</div>
            </div>
          `;
          combosList.appendChild(el);
        });
      }
    }

    document.getElementById("map-view")?.classList.add("hidden");
    document.getElementById("battle-view")?.classList.add("hidden");
    combosView.classList.remove("hidden");
    this.syncBattleTopChrome();
  }

  hideCombosView() {
    document.getElementById("combos-view")?.classList.add("hidden");
    if (this.view === "map") {
      document.getElementById("map-view")?.classList.remove("hidden");
    } else {
      document.getElementById("battle-view")?.classList.remove("hidden");
    }
    this.syncBattleTopChrome();
  }

  // ===== 牌库构成查看（与战队选择同款：当前职业 + 按职业网格 + 右侧详情） =====
  showDeckView() {
    const deckView = document.getElementById("deck-view");
    const deckList = document.getElementById("deck-list");
    const profEl = document.getElementById("deck-current-professions");
    if (!deckView || !deckList) return;

    const professionLabels = { common: "通用", coder: "程序员", dog: "狗", teacher: "老师", security: "保安", hooligan: "流氓" };
    const professionIcons = { coder: "💻", dog: "🐕", teacher: "📚", security: "👮", hooligan: "👊" };

    // 顶部：当前职业组合（只读展示）
    if (profEl) {
      profEl.innerHTML = "";
      (this.selectedProfessions || []).forEach(prof => {
        const span = document.createElement("span");
        span.className = "deck-current-prof-badge";
        span.textContent = `${professionIcons[prof] || "?"} ${professionLabels[prof] || prof}`;
        profEl.appendChild(span);
      });
    }

    const deck = this.deck || [];
    const countBy = {};
    deck.forEach(id => { countBy[id] = (countBy[id] || 0) + 1; });
    const totalCards = deck.length;
    const totalEl = document.getElementById("deck-total-count");
    if (totalEl) totalEl.textContent = `总计 ${totalCards} 张`;
    const professionOrder = ["common", "coder", "dog", "teacher", "security", "hooligan"];
    const getProfessionOrder = (cardId) => {
      const card = CARDS_DB[cardId];
      const p = (card && card.profession) ? card.profession : "common";
      const idx = professionOrder.indexOf(p);
      return idx >= 0 ? idx : professionOrder.length;
    };
    const sorted = Object.entries(countBy).sort((a, b) => {
      const orderA = getProfessionOrder(a[0]);
      const orderB = getProfessionOrder(b[0]);
      if (orderA !== orderB) return orderA - orderB;
      return (b[1] - a[1]) || (a[0].localeCompare(b[0]));
    });

    deckList.innerHTML = "";
    this.deckViewSelectedCardId = null;
    let lastProf = "";
    sorted.forEach(([cardId, count]) => {
      const card = CARDS_DB[cardId];
      const prof = (card && card.profession) ? card.profession : "common";
      if (prof !== lastProf) {
        lastProf = prof;
        const head = document.createElement("div");
        head.className = "deck-section-title";
        head.textContent = "【" + (professionLabels[prof] || prof) + "】";
        deckList.appendChild(head);
      }
      const name = card ? card.name : cardId;
      const icon = card ? card.icon : "🃏";
      const level = this.getCardLevel(cardId);
      const levelText = level > 1 ? ` Lv.${level}` : "";
      const el = document.createElement("div");
      el.className = "team-build-card-item" + (this.deckViewSelectedCardId === cardId ? " selected" : "");
      el.dataset.cardId = cardId;
      el.innerHTML = `
        <div class="tb-card-icon">${icon}</div>
        <div class="tb-card-name">${name}</div>
        <div class="tb-card-count">× ${count}${levelText}</div>
      `;
      el.addEventListener("click", () => {
        this.deckViewSelectedCardId = this.deckViewSelectedCardId === cardId ? null : cardId;
        deckList.querySelectorAll(".team-build-card-item").forEach(n => n.classList.remove("selected"));
        if (this.deckViewSelectedCardId === cardId) el.classList.add("selected");
        this.updateDeckViewDetail(cardId);
      });
      deckList.appendChild(el);
    });
    if (sorted.length === 0) {
      deckList.innerHTML = '<div class="combos-empty">牌库为空</div>';
    }
    this.updateDeckViewDetail(null);

    document.getElementById("map-view")?.classList.add("hidden");
    document.getElementById("battle-view")?.classList.add("hidden");
    document.getElementById("shop-view")?.classList.add("hidden");
    document.getElementById("event-view")?.classList.add("hidden");
    document.getElementById("combos-view")?.classList.add("hidden");
    deckView.classList.remove("hidden");
    this.syncBattleTopChrome();
  }

  updateDeckViewDetail(cardId) {
    const placeholder = document.getElementById("deck-detail-placeholder");
    const content = document.getElementById("deck-detail-content");
    if (!placeholder || !content) return;
    if (!cardId) {
      placeholder.classList.remove("hidden");
      content.classList.add("hidden");
      return;
    }
    const card = CARDS_DB[cardId];
    placeholder.classList.add("hidden");
    content.classList.remove("hidden");
    const iconEl = document.getElementById("deck-detail-icon");
    const nameEl = document.getElementById("deck-detail-name");
    const descEl = document.getElementById("deck-detail-desc");
    const effectEl = document.getElementById("deck-detail-effect");
    if (iconEl) iconEl.textContent = card ? card.icon : "🃏";
    if (nameEl) nameEl.textContent = card ? card.name : cardId;
    if (descEl) descEl.textContent = card ? (card.description || "") : "";
    if (effectEl) effectEl.textContent = card ? (card.detail || "") : "";
  }

  hideDeckView() {
    document.getElementById("deck-view")?.classList.add("hidden");
    if (this.view === "map") {
      document.getElementById("map-view")?.classList.remove("hidden");
    } else if (this.view === "battle") {
      document.getElementById("battle-view")?.classList.remove("hidden");
    } else if (this.view === "shop") {
      document.getElementById("shop-view")?.classList.remove("hidden");
    } else if (this.view === "event") {
      document.getElementById("event-view")?.classList.remove("hidden");
    } else {
      document.getElementById("map-view")?.classList.remove("hidden");
    }
    this.syncBattleTopChrome();
  }

  updateGoldDisplay() {
    const goldEl = document.getElementById("gold-display");
    if (goldEl) goldEl.textContent = this.gold || 0;
    const battleGoldEl = document.getElementById("battle-gold-display");
    if (battleGoldEl) battleGoldEl.textContent = this.gold || 0;
  }

  updateFloorDisplay() {
    const floorEl = document.getElementById("floor-display");
    const floorNameEl = document.getElementById("floor-name");
    const floorNumberEl = document.getElementById("floor-number");
    
    if (floorEl) floorEl.textContent = `第 ${this.map.floor} 层`;
    
    // 使用新的楼层配置
    const floorConfig = window.getCurrentFloor ? window.getCurrentFloor(this.map.floor) : null;
    if (floorNameEl) {
      floorNameEl.textContent = floorConfig ? floorConfig.name : "未知区域";
    }
    if (floorNumberEl) {
      floorNumberEl.textContent = `第 ${this.map.floor} 层 / 共 ${this.map.maxFloor} 层`;
    }
    
    // 应用楼层主题
    if (this.effects) {
      this.effects.applyFloorTheme(this.map.floor);
    }

    const battleFloorEl = document.getElementById("battle-floor-display");
    if (battleFloorEl) {
      battleFloorEl.textContent = `第 ${this.map.floor} 层`;
    }
  }

  // ===== 战斗相关 =====
  startBattleForNode(node) {
    const isBoss = node.type === "boss";
    const isElite = node.type === "elite";
    
    // 根据节点和层数设定敌人
    let enemyData;
    
    if (isBoss && node.enemy) {
      enemyData = { ...node.enemy };
    } else if (isElite && node.enemy) {
      enemyData = { ...node.enemy };
    } else if (node.enemy) {
      enemyData = { ...node.enemy };
    } else {
      // 默认敌人
      enemyData = {
        name: isBoss ? "Boss" : (isElite ? "精英怪" : "敌人"),
        hp: isBoss ? 300 : (isElite ? 150 : 100),
        atk: isBoss ? 15 : (isElite ? 10 : 6),
        gold: isBoss ? 100 : (isElite ? 40 : 15)
      };
    }
    
    // 根据层数增强敌人（逐层更明显地变难）
    const floorHpMult = 1 + (this.map.floor - 1) * 0.45;
    const floorAtkMult = 1 + (this.map.floor - 1) * 0.30;
    enemyData.hp = Math.floor(enemyData.hp * floorHpMult);
    enemyData.atk = Math.floor(enemyData.atk * floorAtkMult);
    
    // 构建新的敌人状态（重置上一场战斗遗留的 debuff）
    this.enemy = {
      id: enemyData.id || enemyData.enemyId || enemyData.key || null,
      name: enemyData.name,
      hp: enemyData.hp,
      maxHp: enemyData.hp,
      atk: enemyData.atk,
      gold: enemyData.gold || 20,
      aiType: enemyData.aiType || (isBoss ? "boss1" : "basic"),
      armor: enemyData.armor || 0,
      intentText: "",
      stunned: 0,
      slow: 0,
      weakness: 0,
      blind: 0,
    };
    
    // 更新敌人层显示
    const enemyLayerEl = document.getElementById("enemy-layer");
    if (enemyLayerEl) {
      enemyLayerEl.textContent = `第 ${this.map.floor} 层${isBoss ? " - Boss" : (isElite ? " - 精英" : "")}`;
    }
    // 生成队友槽位 DOM（开发者捷径跳过教学关时此处从未构建，会导致战斗里看不到角色）
    this.updateTeammateUI();
    const profs = this.selectedProfessions || [];
    profs.forEach((p) => this.updateTeammateStatus(p));

    // 每场战斗重建 BattleSystem，避免状态残留
    this.battle = new BattleSystem(this);

    // 先用新敌人状态刷新一次血量/意图 UI，避免看到上一只怪的 0 血和 debuff
    this.updateEnemyHP(this.enemy.hp);
    this.renderEnemySprite();

    this.renderItems();
    this._permaBrokenPlayedSlots = [];
    this.showBattleView();
    this.battle.initBattle(this.enemy, this.deck, this.items);
    if (this.enemy && this.enemy.aiType === "boss1") {
      this.log(
        "【黑帮老大】会交替使用「破坏牌型」与「点燃出牌格」。请留意屏幕中央预告与敌人意图栏。",
        "system"
      );
      try {
        const k = "cityHeroBoss1GuideShown";
        if (!localStorage.getItem(k)) {
          localStorage.setItem(k, "1");
          const name = this.enemy.name || "黑帮老大";
          setTimeout(() => {
            this.showModal(
              "机制说明：" + name,
              [
                `${name} 有两种技能轮换使用：`,
                "",
                "1）破坏牌型",
                "Boss 会预告「下回合破坏牌型」。到了那一回合，你在点「出牌」结算时，会随机打碎部分已打出的牌，被打碎的牌本回合伤害失效，并可能产生能量反噬伤害。",
                "",
                "2）点燃出牌格",
                "Boss 会烧毁出牌区上的几个格子，持续若干我方回合（格子上会显示 🔥 与剩余回合数），这段时间内不能往这些格子里放牌。",
                "",
                "提示：多留意预告与意图，合理安排出牌顺序与站位（格子序号）。",
              ].join("\n")
            );
          }, 480);
        }
      } catch (_) {}
    }
    if (this.enemy && this.enemy.aiType === "boss2_poison") {
      this.log(
        "【手牌毒】带紫光绿边与角标 ☠数字 的牌已被污染；打出会全队叠毒（回合开始扣血）。换牌丢掉毒牌不触发。狗可解毒/守护。",
        "system"
      );
    }
    if (this.enemy && this.enemy.aiType === "boss3_crack") {
      if (typeof this.enemy.boss3CrackCounter !== "number") this.enemy.boss3CrackCounter = 0;
      this.log(
        "【裂地】每经过 3 次 Boss 行动，会永久塌陷 1 个出牌格（本场战斗，战后恢复），并叠加护甲。格子呈裂地效果、无回合倒数——请尽快结束战斗！",
        "system"
      );
      const hint = "⚔ 普攻 | 🌋 每 3 次 Boss 行动：裂地（永久少 1 格）+ 护甲";
      if (this.battle && this.battle.enemy) this.battle.enemy.intentText = hint;
      this.enemy.intentText = hint;
      this.updateEnemyDebuffsAndIntent();
      try {
        const k3 = "cityHeroBoss3GuideShown";
        if (!localStorage.getItem(k3)) {
          localStorage.setItem(k3, "1");
          const n3 = this.enemy.name || "CTO大魔王";
          setTimeout(() => {
            this.showModal(
              "机制说明：裂地 · " + n3,
              [
                `${n3} 会逼迫你速战速决：`,
                "",
                "• 每经过 3 次 Boss 行动，会发动一次「裂地」：永久塌陷 1 个出牌格（本场战斗有效），并给自己叠加护甲。",
                "• 塌陷格呈大地裂纹样式，标注「塌陷」，没有「还剩几回合」的倒数——与第一关「点燃格子」那种限时损坏不同。",
                "• 击败 Boss 或战斗结束后，出牌区会恢复正常。",
                "",
                "建议：尽快压低 Boss 血量，避免出牌位被压到过少。",
              ].join("\n")
            );
          }, 480);
        }
      } catch (_) {}
    }
  }

  /**
   * 恶魔校长对手牌下毒后：手牌区说明条 + 首次弹窗（本地仅一次）
   */
  onBossHandPoisonApplied(bossName, count) {
    try {
      const k = "cityHeroHandPoisonGuideShown";
      if (localStorage.getItem(k)) return;
      localStorage.setItem(k, "1");
      const name = bossName || "Boss";
      setTimeout(() => {
        this.showModal(
          "机制说明：手牌中毒",
          `${name} 污染了你的 ${count} 张手牌（可能继续叠加）。\n\n` +
            "怎么看：牌面有紫色光晕、绿色描边，以及大号 ☠+数字。\n\n" +
            "规则：\n" +
            "• 打出带毒的牌 → 本回合结束时给全队叠中毒层数。\n" +
            "• 用「换牌」丢掉的毒牌 → 不会叠毒。\n" +
            "• 狗的「解毒」可减全队毒层；「守护气息」与同批毒牌一起出可免疫本次反噬。\n\n" +
            "手牌上方提示条会保留到本场战斗中你不再持有毒牌。"
        );
      }, 450);
    } catch (_) {}
  }

  // ===== 敌人/持续伤害支持 =====
  applyDamageToTeammate(profession, damage, opts = {}) {
    const t = this.teammates && this.teammates[profession];
    if (!t || t.hp <= 0) return 0;
    const damageType = opts.damageType || "direct";
    // 先播放受伤特效，再结算伤害（让玩家先看到特效，再看到血条/ debuff 变化）
    if (this.effects && typeof this.effects.playerDamageEffect === "function") {
      this.effects.playerDamageEffect(profession, damageType);
    }
    let remaining = Math.max(0, Math.floor(damage || 0));
    const ignoreShield = !!opts.ignoreShield;
    const shieldFactor = typeof opts.shieldFactor === "number" ? opts.shieldFactor : 1.0; // 0.5 = 护盾减免只有 50% 效率

    if (!ignoreShield && (t.shield || 0) > 0 && remaining > 0) {
      const shield = t.shield || 0;
      const effectiveShield = Math.floor(shield * shieldFactor);
      const absorbed = Math.min(remaining, effectiveShield);
      if (absorbed > 0) {
        // 扣除真实护盾值：absorbed = shieldLoss * shieldFactor
        const shieldLoss = Math.ceil(absorbed / Math.max(0.01, shieldFactor));
        t.shield = Math.max(0, shield - shieldLoss);
        remaining -= absorbed;
      }
    }

    if (remaining > 0) {
      t.hp = Math.max(0, t.hp - remaining);
    }
    this.updateTeammateStatus(profession);
    if (t.hp <= 0) {
      this.log(`${this.getProfessionLabel(profession)} 倒下了！`, "enemy");
    }
    return remaining;
  }

  takeDamageAll(damage, opts = {}) {
    const professions = this.selectedProfessions || [];
    let total = 0;
    professions.forEach((p) => {
      const dealt = this.applyDamageToTeammate(p, damage, opts);
      total += dealt;
    });
    // 若全灭，触发结束
    const allDead = professions.length > 0 && professions.every((p) => {
      const t = this.teammates[p];
      return !t || t.hp <= 0;
    });
    if (allDead) this.gameOver();
    return total;
  }

  addTeamStatus(kind, amount, maxCap = 99) {
    const professions = this.selectedProfessions || [];
    professions.forEach((p) => {
      const t = this.teammates[p];
      if (!t || t.hp <= 0) return;
      const cur = t[kind] || 0;
      t[kind] = Math.min(maxCap, cur + amount);
      if (this.effects && this.effects.playerDebuffEffect) {
        this.effects.playerDebuffEffect(p, kind);
      }
    });
    professions.forEach((p) => this.updateTeammateStatus(p));
  }

  applyDotsAtStartOfTurn() {
    const professions = this.selectedProfessions || [];
    let poisonTotal = 0;
    professions.forEach((p) => {
      const t = this.teammates[p];
      if (!t || t.hp <= 0) return;
      const poison = t.poison || 0;
      if (poison > 0) {
        const dealt = this.applyDamageToTeammate(p, poison, { ignoreShield: true, damageType: "poison" });
        poisonTotal += dealt;
      }
    });
    if (poisonTotal > 0) this.log(`☠️ 中毒结算：全队共受到 ${poisonTotal} 伤害（无视护盾）`, "enemy");

    let burnTotal = 0;
    professions.forEach((p) => {
      const t = this.teammates[p];
      if (!t || t.hp <= 0) return;
      const burn = t.burn || 0;
      if (burn > 0) {
        const dealt = this.applyDamageToTeammate(p, burn, { shieldFactor: 0.5, damageType: "burn" });
        burnTotal += dealt;
        t.burn = Math.max(0, burn - 12);
      }
    });
    if (burnTotal > 0) this.log(`🔥 火焰结算：全队共受到 ${burnTotal} 伤害（护盾减免 50%）`, "enemy");
  }

  // 战斗结果回调（由 battle.js 调用）
  onBattleResult(win) {
    try {
      this._eventRunDamageBuff = 1;
      this._eventBuffTipShown = false;
    } catch (_) {}
    try {
      this.clearPlayedSlotBattleEffects();
    } catch (_) {}
    if (win) {
      let goldReward = this.enemy.gold || 20;

      // 道具：收割镰刀（额外金币 +50%）
      try {
        if (Array.isArray(this.items) && this.items.includes("reap_scythe")) {
          const bonus = Math.floor(goldReward * 0.5);
          if (bonus > 0) {
            goldReward += bonus;
            this.log(`💀 收割镰刀：额外金币 +${bonus}（+50%）`, "combo");
          }
        }
      } catch (_) {}

      this.gold = (this.gold || 0) + goldReward;
      this.updateGoldDisplay();
      this.incStat("goldEarned", goldReward);
      this.incStat("battlesWon", 1);

      if (window.audioManager) window.audioManager.victory();
      this.unlockAchievement('first_win');

      if (this.isFirstBattle) {
        this.isFirstBattle = false;
        this.tutorialBattleActive = false;
        try { if (this._tutorialStopAfterFirstWin) this._tutorialStopAfterFirstWin(); } catch (_) {}
        this.justFinishedFirstBattle = true;
        this.map.generate();
        this.updateFloorDisplay();
        this.renderItems();
        this.selectedProfessions.forEach((p) => this.updateTeammateStatus(p));
        this.updateTeammateUI();
      } else {
        const currentNode = this.currentNode;
        // 训练假人 / 非地图战斗：不计 Boss 通关（防止误判层数解锁）
        if (this.enemy && this.enemy.id === "dummy") {
          this.tutorialBattleActive = false;
        } else if (currentNode && currentNode.type === "boss") {
          // 保安：仅第2层及以后 Boss 解锁（第1层 Boss 只解锁狗）
          if ((this.map.floor || 1) >= 2) {
            this.unlockAchievement("first_boss");
          }
          this.incStat("bossesDefeated", 1);
          // 每通关一大关（击败该层 Boss）：道具栏容量 +1
          try { this.increaseItemSlotCapacity(1); } catch (_) {}
          // 难度1：第1关（第1层 Boss）通关 → 解锁狗，并回到队伍选择
          if ((this.difficulty || 1) === 1 && this.map.floor === 1 && !this.unlockedProfessions.includes("dog")) {
            this.unlockedProfessions.push("dog");
            this.saveUnlockedProfessions();
            // 给狗新增一张解毒牌做为机制对策（永久加入解锁卡池/牌库展示）
            if (!this.deck.includes("dog_detox")) this.deck.push("dog_detox");
            this.log("解锁新职业：狗 🐕（获得新卡：解毒/守护气息）", "combo");
            this.showProfessionUnlockModal("dog");
            this._flashUnlockedProfession = "dog";
            this.pendingTeamBuildAfterBoss = true;
          }
          // 难度1：第2关（第2层 Boss）通关 → 解锁老师
          if ((this.difficulty || 1) === 1 && this.map.floor === 2 && !this.unlockedProfessions.includes("teacher")) {
            this.unlockedProfessions.push("teacher");
            this.saveUnlockedProfessions();
            this.log("解锁新职业：老师！", "combo");
            this.showProfessionUnlockModal("teacher");
            this._flashUnlockedProfession = "teacher";
          }
          if (this.map.nextFloor()) {
            this.log(`进入第 ${this.map.floor} 层！`, "system");
            this.updateFloorDisplay();
            this.map.generate();
            // 进入下一大关前：强制回组队页面（允许重新组队/加入新职业）
            this.pendingTeamBuildAfterBoss = true;
          } else {
            this.unlockAchievement("floor5");
            this.showModal("恭喜通关！", "你成功击败了所有敌人！");
            // 通关当前难度：解锁下一难度
            try {
              const d = Math.max(1, Math.floor(this.difficulty || 1));
              if (!Array.isArray(this.difficultiesCompleted)) this.difficultiesCompleted = [];
              if (!this.difficultiesCompleted.includes(d)) this.difficultiesCompleted.push(d);
              this.maxDifficultyUnlocked = Math.max(this.maxDifficultyUnlocked || 1, d + 1);
              this.saveUnlocks();
            } catch (_) {}
            return;
          }
        }
      }

      // 掉落：随机卡牌（我方职业池）+ 低概率随机道具
      const cardPool = this.getProfessionCardPool();
      const dropCard = cardPool.length > 0 ? cardPool[Math.floor(Math.random() * cardPool.length)] : null;
      const dropItem = Math.random() < 0.25 ? this.getRandomItemId() : null;
      this.showRewardScreen(goldReward, dropCard, dropItem);
    } else {
      // 播放失败音效
      if (window.audioManager) {
        window.audioManager.defeat();
      }
      this.gameOver();
    }
  }

  // 我方职业对应的卡牌池（用于战斗掉落）
  getProfessionCardPool() {
    const profs = this.selectedProfessions || [];
    const pool = [];
    Object.keys(CARDS_DB).forEach(id => {
      const card = CARDS_DB[id];
      if (!card) return;
      const p = card.profession || "common";
      if (!this.isCardUnlocked(id)) return;
      if (p === "common" || profs.includes(p)) pool.push(id);
    });
    return pool;
  }

  getRandomItemId() {
    const pool = this.getShopAndEventItemPool();
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    const ids = Object.keys(typeof ITEMS_DB !== "undefined" ? ITEMS_DB : {}).filter((id) => this.isItemUnlocked(id));
    return ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
  }

  showRewardScreen(goldReward, dropCardId, dropItemId) {
    const view = document.getElementById("reward-view");
    const goldEl = document.getElementById("reward-gold");
    const cardSection = document.getElementById("reward-card-section");
    const cardInfo = document.getElementById("reward-card-info");
    const itemSection = document.getElementById("reward-item-section");
    const itemInfo = document.getElementById("reward-item-info");
    if (!view || !goldEl) return;

    document.getElementById("map-view")?.classList.add("hidden");
    document.getElementById("battle-view")?.classList.add("hidden");
    view.classList.remove("hidden");
    this.syncBattleTopChrome();

    goldEl.textContent = `💰 获得 ${goldReward} 金币（已自动领取）`;
    this.rewardPending = { cardId: dropCardId, itemId: dropItemId, cardDone: false, itemDone: false };

    if (dropCardId) {
      const card = CARDS_DB[dropCardId];
      cardSection.classList.remove("hidden");
      const nameEl = cardInfo.querySelector(".reward-reward-name");
      const descEl = cardInfo.querySelector(".reward-reward-desc");
      const effectEl = cardInfo.querySelector(".reward-reward-effect");
      if (nameEl) nameEl.textContent = card ? `🎴 卡牌：${card.name}` : `🎴 ${dropCardId}`;
      if (descEl) { descEl.textContent = card ? (card.description || "") : ""; descEl.style.display = card && card.description ? "" : "none"; }
      if (effectEl) { effectEl.textContent = card ? (card.detail || "") : ""; effectEl.style.display = card && card.detail ? "" : "none"; }
      cardSection.querySelector("#reward-card-take").style.display = "";
      cardSection.querySelector("#reward-card-skip").style.display = "";
    } else {
      cardSection.classList.add("hidden");
      this.rewardPending.cardDone = true;
    }

    if (dropItemId) {
      const item = typeof ITEMS_DB !== "undefined" ? ITEMS_DB[dropItemId] : null;
      itemSection.classList.remove("hidden");
      const nameEl = itemInfo.querySelector(".reward-reward-name");
      const descEl = itemInfo.querySelector(".reward-reward-desc");
      const effectEl = itemInfo.querySelector(".reward-reward-effect");
      if (nameEl) nameEl.textContent = item ? `${item.icon} 道具：${item.name}` : dropItemId;
      if (descEl) { descEl.textContent = item ? (item.description || "") : ""; descEl.style.display = item && item.description ? "" : "none"; }
      if (effectEl) { effectEl.textContent = item ? (item.detail || "") : ""; effectEl.style.display = item && item.detail ? "" : "none"; }
      const cap = this.getItemSlotCapacity ? this.getItemSlotCapacity() : 10;
      const full = Array.isArray(this.items) && this.items.length >= cap;
      const takeBtn = itemSection.querySelector("#reward-item-take");
      const replaceBtn = itemSection.querySelector("#reward-item-replace");
      const replaceSlots = document.getElementById("reward-item-replace-slots");
      if (takeBtn) takeBtn.style.display = full ? "none" : "";
      if (replaceBtn) replaceBtn.style.display = full ? "none" : "none";
      if (replaceSlots) {
        replaceSlots.classList.toggle("hidden", !full);
        if (full) {
          replaceSlots.innerHTML = "";
          for (let i = 0; i < cap; i++) {
            const currentId = this.items[i];
            const data = currentId && typeof ITEMS_DB !== "undefined" ? ITEMS_DB[currentId] : null;
            const btn = document.createElement("button");
            btn.className = "secondary-btn save-slot-btn";
            btn.innerHTML = `
              <div class="save-slot-title">槽位 ${i + 1}</div>
              <div class="save-slot-time">${data ? `${data.icon || "🎁"} ${data.name || currentId}` : "空"}</div>
            `;
            btn.title = data ? (data.detail || data.description || "") : "";
            btn.disabled = !data;
            btn.onclick = () => this.rewardReplaceItem(i);
            replaceSlots.appendChild(btn);
          }
        }
      }
    } else {
      itemSection.classList.add("hidden");
      this.rewardPending.itemDone = true;
    }

    this.bindRewardButtonsOnce();
  }

  bindRewardButtonsOnce() {
    if (this._rewardBound) return;
    this._rewardBound = true;
    const takeCard = document.getElementById("reward-card-take");
    const skipCard = document.getElementById("reward-card-skip");
    const takeItem = document.getElementById("reward-item-take");
    const replaceItem = document.getElementById("reward-item-replace");
    const skipItem = document.getElementById("reward-item-skip");
    const cont = document.getElementById("reward-continue");

    if (takeCard) takeCard.addEventListener("click", () => this.rewardTakeCard());
    if (skipCard) skipCard.addEventListener("click", () => this.rewardSkipCard());
    if (takeItem) takeItem.addEventListener("click", () => this.rewardTakeItem());
    if (replaceItem) replaceItem.addEventListener("click", () => this.rewardReplaceItem());
    if (skipItem) skipItem.addEventListener("click", () => this.rewardSkipItem());
    if (cont) cont.addEventListener("click", () => this.rewardContinue());
  }

  rewardTakeCard() {
    const id = this.rewardPending && this.rewardPending.cardId;
    if (id) {
      this.deck.push(id);
      this.log(`获得卡牌：${CARDS_DB[id] ? CARDS_DB[id].name : id}`, "player");
    }
    this.rewardPending.cardDone = true;
    document.getElementById("reward-card-section").classList.add("hidden");
  }

  rewardSkipCard() {
    this.rewardPending.cardDone = true;
    document.getElementById("reward-card-section").classList.add("hidden");
  }

  rewardTakeItem() {
    const id = this.rewardPending && this.rewardPending.itemId;
    const cap = this.getItemSlotCapacity ? this.getItemSlotCapacity() : 10;
    if (id && this.items.length < cap) {
      this.items.push(id);
      this.renderItems();
      this.log(`获得道具：${typeof ITEMS_DB !== "undefined" && ITEMS_DB[id] ? ITEMS_DB[id].name : id}`, "player");
    }
    this.rewardPending.itemDone = true;
    document.getElementById("reward-item-section").classList.add("hidden");
  }

  rewardReplaceItem(slot) {
    const id = this.rewardPending && this.rewardPending.itemId;
    if (!id) { this.rewardPending.itemDone = true; document.getElementById("reward-item-section").classList.add("hidden"); return; }
    const cap = this.getItemSlotCapacity ? this.getItemSlotCapacity() : 10;
    slot = Math.min(cap - 1, Math.max(0, slot));
    this.items[slot] = id;
    this.renderItems();
    this.log(`替换道具槽位${slot + 1}：${typeof ITEMS_DB !== "undefined" && ITEMS_DB[id] ? ITEMS_DB[id].name : id}`, "player");
    this.rewardPending.itemDone = true;
    document.getElementById("reward-item-section").classList.add("hidden");
  }

  rewardSkipItem() {
    this.rewardPending.itemDone = true;
    document.getElementById("reward-item-section").classList.add("hidden");
  }

  rewardContinue() {
    if (this.rewardPending && !this.rewardPending.cardDone && this.rewardPending.cardId) this.rewardSkipCard();
    if (this.rewardPending && !this.rewardPending.itemDone && this.rewardPending.itemId) this.rewardSkipItem();
    document.getElementById("reward-view").classList.add("hidden");
    if (this.justFinishedFirstBattle) {
      this.justFinishedFirstBattle = false;
      this.log("欢迎来到城市！选择你的路线开始冒险", "system");
    }
    if (this.pendingTeamBuildAfterBoss) {
      this.pendingTeamBuildAfterBoss = false;
      // 通关大关后先回到队伍选择，让新解锁职业可加入队伍
      this.showTeamBuildView();
      return;
    }
    this.showMapView();
  }

  // 创建初始牌组
  createStarterDeck() {
    const deck = [];

    // 通用卡（少量，让牌型更重要；先不放独立格挡牌）
    deck.push("attack");
    deck.push("potion");

    // 根据选择的职业添加对应卡牌
    for (const prof of this.selectedProfessions) {
      if (prof === "coder") {
        // 程序员：需要凑代码牌才有用
        for (let i = 0; i < 3; i++) deck.push("coder_code");      // 敲代码 x3（需要凑 2-3 张）
        deck.push("coder_bug");
        deck.push("coder_coffee");
        deck.push("coder_refactor");
      } else if (prof === "dog") {
        // 狗：辅助+控制
        deck.push("dog_bark");
        deck.push("dog_bite");
        deck.push("dog_tail");
        deck.push("dog_guard");
        deck.push("dog_detox");
        deck.push("dog_fetch");
        deck.push("dog_roar");
      } else if (prof === "teacher") {
        // 老师：控制+削弱
        deck.push("teacher_lecture");
        deck.push("teacher_homework");
        deck.push("teacher_ruler");
        deck.push("teacher_redpen");
      } else if (prof === "security") {
        // 保安：坦克+控制
        deck.push("security_flashlight");
        deck.push("security_whistle");
        deck.push("security_patrol");
        deck.push("security_baton");
      } else if (prof === "hooligan") {
        // 流氓：纯物理输出
        for (let i = 0; i < 2; i++) deck.push("hooligan_punch");
        deck.push("hooligan_kick");
        deck.push("hooligan_sand");
        deck.push("hooligan_intimidate");
      }
    }

    return deck;
  }

  // 渲染手牌
  renderHand(hand) {
    const container = document.getElementById("hand-container");
    if (!container) return;
    let strip = document.getElementById("hand-strip");
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "hand-strip";
      strip.className = "hand-strip";
      strip.setAttribute("aria-label", "手牌");
      container.innerHTML = "";
      container.appendChild(strip);
    } else {
      strip.innerHTML = "";
    }

    for (let i = 0; i < hand.length; i++) {
      const cardId = hand[i];
      const card = CARDS_DB[cardId];
      const cardEl = CardUtil.createCardElement(cardId, i);
      if (cardEl) {
        // 判断职业是否仍然有效（用于禁用拖拽/选目标）
        const profession = card && card.profession ? card.profession : "common";
        const professionActive = this.isProfessionActive(profession);

        // 死亡职业的牌：标记为失效
        if (card && profession !== "common" && profession !== "joker" && !professionActive) {
          cardEl.classList.add("dead-card");
          cardEl.title = "该职业已阵亡，本回合此牌不会生效";
        }

        // 卡牌等级角标（商店升级后 Lv.2 / Lv.3）
        const cardLevel = this.getCardLevel(cardId);
        if (cardLevel > 1) {
          const levelBadge = document.createElement("div");
          levelBadge.className = "card-level-badge";
          levelBadge.textContent = `Lv.${cardLevel}`;
          cardEl.appendChild(levelBadge);
        }

        // 若该单体治疗牌已绑定目标，显示 badge
        const bind = this.healTargets[i];
        if (bind && bind.tag) {
          const badge = document.createElement("div");
          badge.className = "card-badge";
          const icon = bind.kind === "potion" ? "🧪" : "💚";
          badge.textContent = `${icon}${bind.tag}`;
          // 右上角流派角标占位：把功能 badge 下移，避免遮挡
          if (cardEl.querySelector(".card-archetype-badge")) badge.style.top = "28px";
          cardEl.appendChild(badge);
        }

        // Boss2 手牌中毒：明显边框 + 左上角毒层角标
        try {
          const p = this.battle && Array.isArray(this.battle.handPoisons) ? (this.battle.handPoisons[i] || 0) : 0;
          if (p > 0) {
            cardEl.classList.add("card-hand-poisoned");
            const badge = document.createElement("div");
            badge.className = "hand-poison-badge";
            badge.textContent = `☠${p}`;
            badge.title =
              "【中毒手牌】打出后会给全队叠中毒（回合开始按层数扣血，无视护盾）。用「换牌」丢弃此牌不会触发。";
            cardEl.appendChild(badge);
          }
        } catch (_) {}
        strip.appendChild(cardEl);
      }
    }

    try {
      const bar = document.getElementById("hand-poison-bar");
      if (bar && this.battle && Array.isArray(this.battle.handPoisons)) {
        const sum = this.battle.handPoisons.reduce((s, v) => s + (Number(v) || 0), 0);
        if (sum > 0) {
          bar.classList.remove("hidden");
          bar.innerHTML =
            `<span class="hand-poison-bar-icon">☠</span>` +
            `<span>手牌上有毒：看牌的 <strong>紫光绿边</strong> 与左上角 <strong>☠数字</strong>。<strong>打出=叠毒</strong>，<strong>换牌丢掉=安全</strong>。</span>`;
        } else {
          bar.classList.add("hidden");
          bar.innerHTML = "";
        }
      }
    } catch (_) {}

    const cards = strip.querySelectorAll(".card");
    cards.forEach((card) => {
      const idx = parseInt(card.dataset.index, 10);
      // 扑克牌叠放：默认按顺序叠层，避免后面的被压到下面
      try { card.style.zIndex = String(idx + 1); } catch (_) {}
      const cardData = CARDS_DB[hand[idx]];
      const prof = cardData && cardData.profession ? cardData.profession : "common";
      const canUseThisCard = !cardData || this.isProfessionActive(prof);
      const isHealCard = cardData && cardData.heal && !cardData.healAll && canUseThisCard;
      card.draggable = true;
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData(
          "text/plain",
          JSON.stringify({
            type: isHealCard ? "heal" : "play",
            index: idx,
            handIndex: idx
          })
        );
      });

      card.addEventListener("click", () => {
        card.classList.toggle("selected-discard");
        // 选中牌置顶
        try { card.style.zIndex = card.classList.contains("selected-discard") ? "999" : String(idx + 1); } catch (_) {}
        this.updateEstimatedDamage();
        // 扑克牌叠放时：选中牌滚动到完全可见
        try {
          if (
            (window.matchMedia && window.matchMedia("(max-width: 600px)").matches) ||
            document.getElementById("battle-view")?.classList.contains("battle-one-screen")
          ) {
            card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
          }
        } catch (_) {}
      });

      // 双击：直接打出到出牌区（更流畅）
      card.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.battle || this.gameEnded) return;
        const limit = this.getPlayedLimit ? this.getPlayedLimit() : 5;
        if (this.battle.playedCards.length >= limit) {
          this.log(`出牌区已满（最多 ${limit} 张）。`, "system");
          return;
        }
        // dblclick 触发时 idx 仍对应当前渲染索引
        const ok = this.battle.playCardToArea(idx);
        if (ok) {
          this.renderHand(this.battle.hand);
          this.renderPlayedArea(this.battle.playedCards);
          this.updatePlayedCount();
          this.updateEstimatedDamage();
        }
      });
    });
    this.updateEstimatedDamage();

    // 手牌：能铺开就居中；超出则靠左滚动
    try {
      const overflow = strip.scrollWidth > strip.clientWidth + 2;
      container.classList.toggle("hand-overflow", overflow);
    } catch (_) {}
  }

  // 渲染道具（含悬停显示效果）
  renderItems() {
    const tooltipEl = document.getElementById("item-tooltip");
    const wrap = document.getElementById("item-slots");
    if (!wrap) return;
    wrap.innerHTML = "";
    const cap = this.getItemSlotCapacity ? this.getItemSlotCapacity() : 4;
    for (let i = 0; i < cap; i++) {
      const slot = document.createElement("div");
      slot.className = "item-slot";
      slot.id = `item-${i}`;
      const itemId = this.items[i];
      slot.dataset.itemId = itemId || "";
      if (itemId) {
        const itemEl = ItemUtil.createItemElement(itemId);
        if (itemEl) slot.appendChild(itemEl);
      }

      if (itemId && typeof ITEMS_DB !== "undefined" && ITEMS_DB[itemId]) {
        const item = ITEMS_DB[itemId];
        slot.onmouseenter = () => {
          if (!tooltipEl) return;
          tooltipEl.innerHTML = `
            <div class="item-tooltip-name">${item.icon} ${item.name}</div>
            <div class="item-tooltip-desc">${item.description || ""}</div>
            ${item.detail ? `<div class="item-tooltip-effect">${item.detail.replace(/\n/g, "<br>")}</div>` : ""}
          `;
          tooltipEl.classList.remove("hidden");
          const rect = slot.getBoundingClientRect();
          tooltipEl.style.left = `${rect.left}px`;
          tooltipEl.style.top = `${rect.top - 10}px`;
          tooltipEl.style.transform = "translateY(-100%)";
        };
        slot.onmouseleave = () => {
          if (tooltipEl) tooltipEl.classList.add("hidden");
        };
      }
      wrap.appendChild(slot);
    }
  }

  // 绑定放置区域
  bindDropZones() {
    // 新规则下不再拖拽分配，这里保留空实现以兼容旧调用
  }

  // 标记已分配的卡牌
  markCardAssigned(index) {
    const cards = document.querySelectorAll(".card");
    cards.forEach((card) => {
      if (parseInt(card.dataset.index, 10) === index) {
        card.classList.add("assigned");
      }
    });
  }

  // 能量显示（当前规则未使用，保留空实现兼容调用）
  updateEnergy() {}

  // 连击/牌型显示（已整合到伤害区域的牌型/隐藏组合区块）
  updateComboDisplay() {
    // 牌型与倍率由 updateTurnDamage / updateEstimatedDamage 负责更新
  }

  // 回合伤害（仅更新左侧栏伤害框；写入 breakdown 供悬停显示）
  updateTurnDamage(damage, baseDamage, finalMultiplier, isActual, comboInfo, codeComboDamage) {
    const turnEl = document.getElementById("turn-damage");
    const labelEl = document.getElementById("turn-damage-label");
    const boxEl = document.getElementById("battle-sidebar-damage-box");
    if (!turnEl) return;
    if (labelEl) labelEl.textContent = isActual ? "本回合伤害" : "预计伤害";
    turnEl.classList.remove("has-damage", "damage-tier-0", "damage-tier-1", "damage-tier-2", "damage-tier-3", "damage-tier-4");
    if (boxEl) boxEl.classList.remove("damage-tier-0", "damage-tier-1", "damage-tier-2", "damage-tier-3", "damage-tier-4");
    if (baseDamage != null && finalMultiplier != null) {
      const codeDmg = codeComboDamage || 0;
      const total = (damage != null ? damage : Math.floor(baseDamage * finalMultiplier) + codeDmg);
      turnEl.textContent = codeDmg > 0
        ? `${baseDamage} × ${finalMultiplier.toFixed(1)} + ${codeDmg}(代码) = ${total}`
        : `${baseDamage} × ${finalMultiplier.toFixed(1)} = ${total}`;
      turnEl.classList.add("has-damage");
      const tier = this.getDamageTier(finalMultiplier, total);
      turnEl.classList.add("damage-tier-" + tier);
      if (boxEl) {
        boxEl.classList.add("damage-tier-" + tier);
        boxEl.dataset.damageBreakdown = this.buildDamageBreakdownText(comboInfo, baseDamage, finalMultiplier, total, codeDmg);
        // 兜底：确保悬停提示始终有绑定（避免布局/DOM移动导致失效）
        try { this.bindDamageBreakdownTooltip(); } catch (_) {}
      }
    } else {
      turnEl.textContent = "0 × 1.0 = 0";
      if (boxEl) {
        boxEl.classList.add("damage-tier-0");
        boxEl.dataset.damageBreakdown = "";
        try { this.bindDamageBreakdownTooltip(); } catch (_) {}
      }
    }
  }

  // 生成伤害计算说明文案（供悬停浮动窗显示）
  buildDamageBreakdownText(comboInfo, baseDamage, finalMultiplier, total, codeDmg) {
    const parts = [];
    if (comboInfo && (comboInfo.baseLine || (comboInfo.hiddenLines && comboInfo.hiddenLines.length))) {
      if (comboInfo.baseLine && comboInfo.comboName !== "单张") {
        parts.push({ line: comboInfo.baseLine, cls: "base" });
      }
      if (comboInfo.hiddenLines && comboInfo.hiddenLines.length) {
        comboInfo.hiddenLines.forEach((text) => {
          parts.push({ line: text, cls: "extra" });
        });
      }
    }
    if (baseDamage != null && finalMultiplier != null) {
      const formula = codeDmg
        ? `基础 ${baseDamage} × 倍率 ${finalMultiplier.toFixed(1)} + 代码 ${codeDmg} = ${total}`
        : `基础 ${baseDamage} × 倍率 ${finalMultiplier.toFixed(1)} = ${total}`;
      parts.push({ line: formula, cls: "formula" });
    }
    return parts.length ? JSON.stringify(parts) : "";
  }

  // 根据倍数和总伤计算档位 0~4，越高越爽
  getDamageTier(multiplier, totalDamage) {
    const multTier = multiplier >= 6 ? 4 : multiplier >= 4 ? 3 : multiplier >= 2.5 ? 2 : multiplier >= 1.5 ? 1 : 0;
    const totalTier = totalDamage >= 300 ? 4 : totalDamage >= 150 ? 3 : totalDamage >= 80 ? 2 : totalDamage >= 30 ? 1 : 0;
    return Math.max(multTier, totalTier);
  }

  // 获取当前选中的手牌索引（用于出牌/换牌）
  getSelectedHandIndices() {
    const cards = document.querySelectorAll("#hand-container .card.selected-discard");
    const indices = [];
    cards.forEach((card) => {
      const idx = parseInt(card.dataset.index, 10);
      if (!Number.isNaN(idx)) indices.push(idx);
    });
    return indices;
  }

  clearHandSelection() {
    const cards = document.querySelectorAll("#hand-container .card");
    cards.forEach((card) => card.classList.remove("selected-discard"));
  }

  applyHandSelection(indices) {
    const set = new Set(indices || []);
    const cards = document.querySelectorAll("#hand-container .card");
    cards.forEach((card) => {
      const idx = parseInt(card.dataset.index, 10);
      if (Number.isNaN(idx)) return;
      card.classList.toggle("selected-discard", set.has(idx));
    });
  }

  // 计算卡牌在当前等级下的基础伤害（用于快速搜索最优 5 张）
  getCardBaseDamageForCalc(cardId) {
    const card = CARDS_DB[cardId];
    if (!card) return 0;
    const level = typeof this.getCardLevel === "function" ? this.getCardLevel(cardId) : 1;
    const damageMult = 1 + (level - 1) * 0.5;
    const base = Math.floor((card.damage || 0) * damageMult);
    const hits = Math.max(1, Math.floor(card.hitCount || 1));
    return base * hits;
  }

  // 快捷键：从手牌中自动选出“预计伤害最高”的一组牌（数量受出牌上限影响，考虑隐藏组合/代码组合）
  quickPickBestFiveFromHand() {
    const battle = this.battle;
    if (!battle || this.gameEnded) return;
    const hand = battle.hand || [];
    if (!hand.length) return;

    // 教学战斗：固定选择，保证流程稳定
    if (this.tutorialBattleActive && Array.isArray(this._tutorialFixedPickIndices)) {
      this.clearHandSelection();
      this.applyHandSelection(this._tutorialFixedPickIndices);
      this.updateEstimatedDamage();
      return;
    }

    // 仅从可参与结算的牌里挑选
    const activeIndices = [];
    for (let i = 0; i < hand.length; i++) {
      const cardId = hand[i];
      const card = CARDS_DB[cardId];
      if (!card) continue;
      const prof = card.profession || "common";
      if (!this.isProfessionActive(prof)) continue;
      activeIndices.push(i);
    }
    if (!activeIndices.length) return;

    // 候选集裁剪：TopN（按基础伤害） + 可能触发隐藏组合/代码组合的关键牌
    const importantIds = new Set();
    try {
      if (typeof HIDDEN_COMBOS !== "undefined") {
        HIDDEN_COMBOS.forEach((c) => {
          Object.values(c.requiredCards || {}).forEach((arr) => {
            (arr || []).forEach((id) => importantIds.add(id));
          });
        });
      }
    } catch (_) {}
    importantIds.add("coder_code");
    importantIds.add("coder_code_master");

    const scored = activeIndices.map((i) => {
      const id = hand[i];
      const base = this.getCardBaseDamageForCalc(id);
      const imp = importantIds.has(id) ? 1000 : 0; // 让关键牌不会被裁剪掉
      return { i, id, base, score: base + imp };
    });
    scored.sort((a, b) => b.score - a.score);
    const TOP_N = 12;
    const candidate = scored.slice(0, TOP_N);
    // 再补充所有 importantIds 命中的牌
    scored.forEach((x) => {
      if (importantIds.has(x.id) && !candidate.some((c) => c.i === x.i)) candidate.push(x);
    });
    // 去重并限制最大候选量，防止组合爆炸
    const uniq = [];
    const seen = new Set();
    for (const x of candidate) {
      if (seen.has(x.i)) continue;
      seen.add(x.i);
      uniq.push(x);
      if (uniq.length >= 16) break;
    }

    const playedLimit = this.getPlayedLimit ? this.getPlayedLimit() : 5;
    const maxK = Math.min(playedLimit, uniq.length);
    const gameState = { discoveredCombos: this.discoveredCombos || [], items: this.items || [] };
    let best = { dmg: -1, indices: [] };

    // 枚举组合（最多 16 选 5 = 4368，足够快）
    const ids = uniq.map((x) => x.id);
    const idxs = uniq.map((x) => x.i);
    const choose = (start, k, pick) => {
      if (pick.length === k) {
        const played = pick.map((p) => {
          const cardId = ids[p];
          const card = CARDS_DB[cardId];
          return {
            id: cardId,
            profession: card.profession || "common",
            archetype: (card && (card.archetype || card.type)) || "attack",
            bleed: Math.max(0, Math.floor((card && card.bleed) || 0)),
            baseDamage: this.getCardBaseDamageForCalc(cardId),
          };
        });
        const result = typeof evaluateCombo === "function" ? evaluateCombo(played, gameState) : null;
        const dmg = result ? result.totalDamage : played.reduce((s, c) => s + (c.baseDamage || 0), 0);
        if (dmg > best.dmg) {
          best = { dmg, indices: pick.map((p) => idxs[p]) };
        }
        return;
      }
      for (let p = start; p <= ids.length - (k - pick.length); p++) {
        pick.push(p);
        choose(p + 1, k, pick);
        pick.pop();
      }
    };
    for (let k = 1; k <= maxK; k++) choose(0, k, []);

    this.clearHandSelection();
    this.applyHandSelection(best.indices);
    this.updateEstimatedDamage();
    this.log(`⚡ 快速选牌：已选出预计伤害最高的 ${best.indices.length} 张`, "system");
  }

  playSelectedToArea() {
    if (!this.battle || this.gameEnded) return;
    const indices = this.getSelectedHandIndices();
    if (indices.length === 0) return;
    const sorted = [...indices].sort((a, b) => b - a);
    let moved = 0;
    const limit = this.getPlayedLimit ? this.getPlayedLimit() : 5;
    for (const idx of sorted) {
      if (this.battle.playedCards.length >= limit) break;
      if (this.battle.playCardToArea(idx)) moved++;
    }
    if (moved > 0) {
      this.renderHand(this.battle.hand);
      this.renderPlayedArea(this.battle.playedCards);
      this.updatePlayedCount();
      this.updateEstimatedDamage();
    }
  }

  autoFillPlayedToFive() {
    if (!this.battle || this.gameEnded) return;
    if (this.battle.playedCards.length >= (this.getPlayedLimit ? this.getPlayedLimit() : 5)) return;
    this.quickPickBestFiveFromHand();
    this.playSelectedToArea();
  }

  // 根据「出牌区 + 选中的手牌」计算预计伤害（方便玩家决策：点哪几张就显示哪几张的伤害）
  updateEstimatedDamage() {
    if (this.turnDamageCommitted || this.gameEnded) return;
    const battle = this.battle;
    if (!battle) return;

    // 有效牌 = 出牌区 + 当前选中的手牌，最多 N 张（N 为出牌上限）
    const effectiveIds = [...(battle.playedCards || [])];
    const selectedIndices = this.getSelectedHandIndices().sort((a, b) => a - b);
    const hand = battle.hand || [];
    const limit2 = this.getPlayedLimit ? this.getPlayedLimit() : 5;
    for (const idx of selectedIndices) {
      if (effectiveIds.length >= limit2) break;
      if (idx >= 0 && idx < hand.length && !effectiveIds.includes(hand[idx])) {
        effectiveIds.push(hand[idx]);
      }
    }

    if (effectiveIds.length === 0) {
      this.updateTurnDamage(0, null, null, false, null);
      return;
    }

    const played = [];
    for (let i = 0; i < effectiveIds.length; i++) {
      const cardId = effectiveIds[i];
      const card = CARDS_DB[cardId];
      if (!card) continue;
      const profession = card.profession || "common";
      if (!this.isProfessionActive(profession)) continue;
      const level = typeof this.getCardLevel === "function" ? this.getCardLevel(cardId) : 1;
      const damageMult = 1 + (level - 1) * 0.5;
      played.push({
        id: cardId,
        profession,
        archetype: card.archetype || card.type || "attack",
        bleed: Math.max(0, Math.floor(card.bleed || 0)),
        baseDamage: Math.floor((card.damage || 0) * damageMult),
      });
    }
    if (played.length === 0) {
      this.updateTurnDamage(0, null, null, false, null);
      return;
    }
    const gameState = { discoveredCombos: this.discoveredCombos || [], items: this.items || [] };
    const result = typeof evaluateCombo === "function" ? evaluateCombo(played, gameState) : null;
    if (result) {
      const comboInfo = {
        comboName: result.comboName,
        comboReason: result.comboReason,
        multiplier: result.multiplier,
        baseLine: result.baseLine,
        hiddenLines: result.hiddenLines,
        breakdownText: result.breakdownText,
        hiddenComboNames: (result.hiddenCombos || []).map(r => r.combo.name)
      };
      this.updateTurnDamage(result.totalDamage, result.baseDamage, result.finalMultiplier, false, comboInfo, result.codeComboDamage);
    } else {
      this.updateTurnDamage(0, null, null, false, null);
    }
  }

  // 更新左侧栏出牌区计数
  updatePlayedCount() {
    const el = document.getElementById("battle-played-count");
    if (!el || !this.battle) return;
    const limit = this.getPlayedLimit ? this.getPlayedLimit() : 5;
    el.textContent = `${this.battle.playedCards.length} / ${limit}`;
  }

  // 渲染出牌区（本回合打出的牌，点击收回手牌）
  renderPlayedArea(playedCards) {
    const container = document.getElementById("played-container");
    if (!container) return;
    container.innerHTML = "";
    const slots = this.getPlayedSlotCount ? this.getPlayedSlotCount() : 5;
    const brokenTurns = this.getBrokenPlayedSlotTurns ? this.getBrokenPlayedSlotTurns() : new Map();
    const permaCrack = new Set(
      Array.isArray(this._permaBrokenPlayedSlots) ? this._permaBrokenPlayedSlots.map((i) => Math.floor(i)).filter((i) => i >= 0) : []
    );
    const brokenTimed = new Set(Array.from(brokenTurns.keys()));
    const broken = new Set([...permaCrack, ...brokenTimed]);
    const played = (this.battle && Array.isArray(this.battle.playedCards)) ? this.battle.playedCards : (playedCards || []);
    const playedSlots = (this.battle && Array.isArray(this.battle.playedSlots)) ? this.battle.playedSlots : [];

    // 空槽位（用于“破坏格子”视觉与规则一致）
    for (let s = 0; s < slots; s++) {
      const slotEl = document.createElement("div");
      let cls = "played-slot";
      if (permaCrack.has(s)) cls += " broken crack-perma";
      else if (brokenTimed.has(s)) cls += " broken";
      slotEl.className = cls;
      slotEl.dataset.slotIndex = String(s);
      if (brokenTurns.has(s)) slotEl.dataset.brokenTurns = String(brokenTurns.get(s));
      container.appendChild(slotEl);
    }

    // 把牌放入各自槽位
    for (let i = 0; i < played.length; i++) {
      const cardId = played[i];
      const slotIdx = Number.isFinite(playedSlots[i]) ? playedSlots[i] : i;
      const targetSlot = container.querySelector(`.played-slot[data-slot-index="${slotIdx}"]`);
      const cardEl = CardUtil.createCardElement(cardId, i);
      if (!cardEl || !targetSlot) continue;
      cardEl.dataset.playedIndex = String(i);
      const card = CARDS_DB[cardId];
      const isHeal = !!(card && card.heal && !card.healAll);
      // 治疗牌：允许“拖到队友头像/点击选目标”；其他牌：点击收回手牌
      if (isHeal) {
        cardEl.draggable = true;
        cardEl.title = (cardEl.title || "") + "\n（拖到队友头像选择目标 / 点击进入选目标模式）";
        cardEl.addEventListener("dragstart", (e) => {
          try {
            e.dataTransfer.setData("text/plain", JSON.stringify({ type: "heal-played", playedIndex: i }));
          } catch (_) {}
        });
        cardEl.addEventListener("click", () => {
          if (this.gameEnded || !this.battle) return;
          this._pendingHealPlayedIndex = i;
          this.showComboText("选择治疗目标：点击队友头像");
        });
      } else {
        cardEl.draggable = false;
        cardEl.addEventListener("click", () => {
          if (this.gameEnded || !this.battle) return;
          this.battle.unplayCardFromArea(i);
          this.renderHand(this.battle.hand);
          this.renderPlayedArea(this.battle.playedCards);
          this.updateEstimatedDamage();
          this.updatePlayedCount();
        });
      }
      targetSlot.appendChild(cardEl);
    }

    if (!container.dataset.dropBound) {
      container.dataset.dropBound = "1";
      container.addEventListener("dragover", (e) => {
        e.preventDefault();
        const limit = this.getPlayedLimit ? this.getPlayedLimit() : 5;
        if (this.battle && this.battle.playedCards.length < limit) {
          container.classList.add("drop-target");
        }
      });
      container.addEventListener("dragleave", () => container.classList.remove("drop-target"));
      container.addEventListener("drop", (e) => {
        e.preventDefault();
        container.classList.remove("drop-target");
        try {
          const data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
          const handIndex = data.handIndex;
          if (typeof handIndex !== "number" || !this.battle) return;
          if (this.battle.playCardToArea(handIndex)) {
            this.renderHand(this.battle.hand);
            this.renderPlayedArea(this.battle.playedCards);
            this.updateEstimatedDamage();
            this.updatePlayedCount();
          }
        } catch (_) {}
      });
    }
    this.updatePlayedCount();
  }

  // 敌人血量与名称/层数
  updateEnemyHP(hp) {
    if (!this.enemy) return;
    const nameEl = document.getElementById("enemy-name");
    if (nameEl) nameEl.textContent = this.enemy.name || "敌人";
    const layerEl = document.getElementById("enemy-layer");
    if (layerEl && this.map) {
      const floor = this.map.floor || 1;
      layerEl.textContent = `第 ${floor} 层`;
    }
    const maxHp = this.enemy.maxHp;
    const percent = maxHp > 0 ? (hp / maxHp) * 100 : 0;
    const fillEl = document.getElementById("enemy-hp-fill");
    if (fillEl) fillEl.style.width = `${Math.max(0, percent)}%`;
    const curEl = document.getElementById("enemy-hp-current");
    if (curEl) curEl.textContent = Math.max(0, Math.floor(hp));
    const maxEl = document.getElementById("enemy-hp-max");
    if (maxEl) maxEl.textContent = maxHp;
    this.updateEnemyDebuffsAndIntent();
  }

  renderEnemySprite() {
    try {
      const wrap = document.getElementById("enemy-sprite");
      if (!wrap) return;
      if (this._enemyStateSprite && typeof this._enemyStateSprite.destroy === "function") {
        try {
          this._enemyStateSprite.destroy();
        } catch (_) {}
      }
      this._enemyStateSprite = null;
      wrap.innerHTML = "";
      if (!this.enemy || !window.pixelRenderer) return;

      const id = this.enemy.id || "";
      const ai = this.enemy.aiType || "";
      const hasEnemy = (k) => (window.PIXEL_ENEMIES && window.PIXEL_ENEMIES[k]) || false;
      const key =
        (id && hasEnemy(id) ? id : null) ||
        (ai === "boss1" ? "boss" : null) ||
        (String(id).startsWith("boss_") ? "boss" : null) ||
        "thug";

      const ctrl =
        typeof window.pixelRenderer.createStateSprite === "function"
          ? window.pixelRenderer.createStateSprite(key, 1.55, 3)
          : null;
      if (ctrl && ctrl.el) {
        wrap.appendChild(ctrl.el);
        this._enemyStateSprite = ctrl;
      }
    } catch (_) {}
  }

  flashEnemySpriteHit() {
    const wrap = document.getElementById("enemy-sprite");
    if (!wrap) return;
    wrap.classList.remove("enemy-sprite-hit");
    void wrap.offsetWidth;
    wrap.classList.add("enemy-sprite-hit");
    setTimeout(() => {
      try {
        wrap.classList.remove("enemy-sprite-hit");
      } catch (_) {}
    }, 480);
  }

  /** 我方结算对敌造成伤害时：受击闪白 + 有伤害的对应职业队友播 attack */
  notifyPlayerDamageToEnemy(played) {
    this.flashEnemySpriteHit();
    if (!played || !this._allyStateSprites) return;
    const seen = new Set();
    for (const p of played) {
      if ((p.baseDamage || 0) <= 0) continue;
      const prof = p.profession;
      if (!prof || prof === "common" || seen.has(prof)) continue;
      seen.add(prof);
      const ctrl = this._allyStateSprites[prof];
      if (ctrl && typeof ctrl.playAttack === "function") ctrl.playAttack(400);
    }
  }

  /** 敌人出手时播敌人 attack 帧 */
  playEnemyAttackAnim(ms) {
    if (this._enemyStateSprite && typeof this._enemyStateSprite.playAttack === "function") {
      this._enemyStateSprite.playAttack(Math.max(200, ms || 450));
    }
  }

  openBattleDrawer(which) {
    const backdrop = document.getElementById("battle-drawer-backdrop");
    if (!backdrop) return;
    ["battle-drawer-log", "battle-drawer-discard"].forEach((id) => {
      const d = document.getElementById(id);
      if (d) {
        d.classList.remove("open");
        d.setAttribute("aria-hidden", "true");
      }
    });
    backdrop.classList.remove("hidden");
    backdrop.setAttribute("aria-hidden", "false");
    if (which === "log") {
      const d = document.getElementById("battle-drawer-log");
      if (d) {
        d.classList.add("open");
        d.setAttribute("aria-hidden", "false");
      }
      const bl = document.getElementById("battle-log");
      if (bl) bl.scrollTop = 0;
    } else {
      const d = document.getElementById("battle-drawer-discard");
      if (d) {
        d.classList.add("open");
        d.setAttribute("aria-hidden", "false");
      }
      this.renderDiscardList();
      const list = document.getElementById("discard-list");
      if (list) list.scrollTop = 0;
    }
  }

  closeBattleDrawers() {
    ["battle-drawer-log", "battle-drawer-discard"].forEach((id) => {
      const d = document.getElementById(id);
      if (d) {
        d.classList.remove("open");
        d.setAttribute("aria-hidden", "true");
      }
    });
    const b = document.getElementById("battle-drawer-backdrop");
    if (b) {
      b.classList.add("hidden");
      b.setAttribute("aria-hidden", "true");
    }
  }

  // 敌人血量演出：平滑过渡（不重复刷新 debuff/意图，避免卡顿）
  animateEnemyHP(fromHp, toHp, durationMs = 900) {
    if (!this.enemy) return Promise.resolve();
    const start = Math.max(0, Number(fromHp) || 0);
    const end = Math.max(0, Number(toHp) || 0);
    const dur = Math.max(120, Math.floor(durationMs || 900));
    const token = (this._enemyHpAnimToken || 0) + 1;
    this._enemyHpAnimToken = token;

    const maxHp = this.enemy.maxHp || 1;
    const fillEl = document.getElementById("enemy-hp-fill");
    const curEl = document.getElementById("enemy-hp-current");
    const maxEl = document.getElementById("enemy-hp-max");
    if (maxEl) maxEl.textContent = maxHp;

    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const t0 = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        if (this._enemyHpAnimToken !== token) return resolve();
        const t = Math.min(1, (now - t0) / dur);
        const v = start + (end - start) * easeOut(t);
        const percent = maxHp > 0 ? (v / maxHp) * 100 : 0;
        if (fillEl) fillEl.style.width = `${Math.max(0, percent)}%`;
        if (curEl) curEl.textContent = Math.max(0, Math.floor(v));
        if (t >= 1) return resolve();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // 更新敌人 debuff 显示与意图
  updateEnemyDebuffsAndIntent() {
    const enemy = this.battle?.enemy || this.enemy;
    if (!enemy) return;
    // 战斗中以 battle.enemy 为唯一真相，同步到 game.enemy，避免其它逻辑读到过期 debuff
    if (this.battle?.enemy && this.enemy) {
      const b = this.battle.enemy;
      this.enemy.stunned = b.stunned || 0;
      this.enemy.slow = b.slow || 0;
      this.enemy.weakness = b.weakness || 0;
      this.enemy.blind = b.blind || 0;
      this.enemy.bleed = b.bleed || 0;
    }
    const debuffsEl = document.getElementById("enemy-debuffs");
    const intentEl = document.getElementById("enemy-intent");
    if (debuffsEl) {
      const badges = [];
      if ((enemy.stunned || 0) > 0) badges.push(`<span class="debuff-badge stun" data-debuff="stun" title="眩晕：敌人下回合无法行动。剩余 ${enemy.stunned} 回合">✨ ${enemy.stunned}</span>`);
      if ((enemy.slow || 0) > 0) badges.push(`<span class="debuff-badge slow" data-debuff="slow" title="减速：敌人伤害 -40%。剩余 ${enemy.slow} 回合">🐢 ${enemy.slow}</span>`);
      if ((enemy.weakness || 0) > 0) badges.push(`<span class="debuff-badge weakness" data-debuff="weakness" title="虚弱：敌人伤害 -50%。剩余 ${enemy.weakness} 回合">💔 ${enemy.weakness}</span>`);
      if ((enemy.blind || 0) > 0) badges.push(`<span class="debuff-badge blind" data-debuff="blind" title="致盲：敌人命中率每层 -20%（最低 5%）。剩余 ${enemy.blind} 回合">👁 ${enemy.blind}</span>`);
      if ((enemy.bleed || 0) > 0) badges.push(`<span class="debuff-badge bleed" data-debuff="bleed" title="流血：敌人回合开始受到等同层数的伤害，并每回合 -1 衰减。当前 ${enemy.bleed}">🩸 ${enemy.bleed}</span>`);
      debuffsEl.innerHTML = badges.length ? badges.join("") : "";
      debuffsEl.classList.toggle("hidden", !badges.length);
      // 让玩家“看见”状态生效：闪一下
      try {
        debuffsEl.classList.remove("debuff-flash");
        void debuffsEl.offsetWidth;
        debuffsEl.classList.add("debuff-flash");
        setTimeout(() => debuffsEl.classList.remove("debuff-flash"), 420);
      } catch (_) {}
    }
    if (intentEl) {
      const blind = Math.max(0, Math.floor(enemy.blind || 0));
      const hitChance = Math.max(0.05, 1 - 0.2 * blind);
      if (enemy.intentText) {
        // 若有自定义意图，也要在致盲时明确提示命中率变化（否则玩家“看不到效果”）
        const t = String(enemy.intentText || "");
        if (blind > 0 && !t.includes("命中")) {
          intentEl.textContent = `${t}（命中 ${(hitChance * 100).toFixed(0)}%）`;
        } else {
          intentEl.textContent = t;
        }
        return;
      }
      let dmg = enemy.atk || 10;
      if ((enemy.slow || 0) > 0) dmg = Math.floor(dmg * 0.6);
      if ((enemy.weakness || 0) > 0) dmg = Math.floor(dmg * 0.5);
      const skip = (enemy.stunned || 0) > 0;
      intentEl.textContent = skip
        ? "✨ 眩晕中，下回合无法行动"
        : `⚔️ 下回合：攻击 (${dmg} 伤害，命中 ${(hitChance * 100).toFixed(0)}%)`;
    }
  }

  // 更新单个队友的生命 / 护盾 /  debuff 显示
  updateTeammateStatus(profession) {
    const t = this.teammates[profession];
    if (!t) return;
    const hpEl = document.getElementById(`${profession}-hp`);
    if (hpEl) hpEl.textContent = `${t.hp}/${t.maxHp}`;
    const hpBarEl = document.getElementById(`${profession}-hp-bar`);
    if (hpBarEl) {
      const pct = t.maxHp > 0 ? Math.max(0, Math.min(100, (t.hp / t.maxHp) * 100)) : 0;
      hpBarEl.style.width = `${pct}%`;
      hpBarEl.classList.toggle("low", pct > 0 && pct <= 25);
      hpBarEl.classList.toggle("mid", pct > 25 && pct <= 50);
    }
    const shieldEl = document.getElementById(`${profession}-shield`);
    if (shieldEl) shieldEl.textContent = t.shield || 0;
    const poisonBadge = document.getElementById(`${profession}-poison-badge`);
    const poisonVal = document.getElementById(`${profession}-poison-val`);
    if (poisonBadge && poisonVal) {
      const v = t.poison || 0;
      poisonVal.textContent = v;
      poisonBadge.classList.toggle("hidden", v <= 0);
    }
    const burnBadge = document.getElementById(`${profession}-burn-badge`);
    const burnVal = document.getElementById(`${profession}-burn-val`);
    if (burnBadge && burnVal) {
      const v = t.burn || 0;
      burnVal.textContent = v;
      burnBadge.classList.toggle("hidden", v <= 0);
    }
  }

  // 伤害数字（瞬间提示，主显示在顶部 A×B=XXX 持久保留）
  showDamageNumber(damage, baseDamage, finalMultiplier) {
    const overlay = document.getElementById("damage-overlay");
    const formula = (baseDamage != null && finalMultiplier != null)
      ? `${baseDamage} × ${finalMultiplier.toFixed(1)} = ${damage.toFixed(0)}`
      : damage.toFixed(0);
    overlay.innerHTML = `<div class="damage-number">${formula}</div>`;
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("hidden"), 2000);
  }

  // 连击文字
  showComboText(text, durationMs = 1500) {
    const overlay = document.getElementById("damage-overlay");
    overlay.innerHTML = `<div class="combo-text">${text}</div>`;
    overlay.classList.remove("hidden");
    // 重要技能/警告类提示：自动延长显示时间，避免“一闪而过”
    let duration = Math.max(300, Number(durationMs) || 1500);
    try {
      const importantPattern = /(Boss|boss|破坏牌型|点燃格子|下毒|蓄力预告|警告|预告|眩晕|群攻|精英|技能)/;
      if (importantPattern.test(String(text)) && duration < 3200) {
        duration = 3200;
      }
    } catch (_) {}
    setTimeout(() => {
      overlay.classList.add("hidden");
    }, duration);
  }

  // 队伍受到伤害（单体，随机目标）
  takeDamage(damage, opts = {}) {
    const professions =
      (Array.isArray(this.selectedProfessions) && this.selectedProfessions.length ? this.selectedProfessions : null) ||
      (this.teammates ? Object.keys(this.teammates) : []);

    const aliveProfessions = professions.filter((p) => {
      const t = this.teammates && this.teammates[p];
      return t && typeof t.hp === "number" && t.hp > 0;
    });
    if (aliveProfessions.length === 0) {
      this.log("未找到可受伤的队友（数据缺失），已忽略本次伤害。", "system");
      return;
    }
    const target = aliveProfessions[Math.floor(Math.random() * aliveProfessions.length)];
    this.applyDamageToTeammate(target, damage, { ...opts, damageType: opts.damageType || "direct" });
    if (window.audioManager) window.audioManager.damage();
    const stillAlive = professions.filter((p) => {
      const tm = this.teammates && this.teammates[p];
      return tm && tm.hp > 0;
    });
    if (stillAlive.length === 0) this.gameOver();
  }

  // 游戏结束（立即标记并弹窗，战斗侧会据此停止回合循环）
  gameOver() {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.log("💀 全军覆没！游戏结束。", "enemy");
    if (window.audioManager) {
      window.audioManager.defeat();
    }
    // 立即禁用战斗操作，防止继续出牌/结束回合
    this.setBattleControlsEnabled(false);
    const handContainer = document.getElementById("hand-container");
    if (handContainer) handContainer.classList.add("game-ended");
    setTimeout(() => this.showDeathOverlay(), 350);
  }

  setBattleControlsEnabled(enabled) {
    this.battleUIEnabled = !!enabled;
    const ids = ["play-cards-btn", "auto-fill-btn", "reset-btn", "end-turn-btn"];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !this.battleUIEnabled;
    });
    const hand = document.getElementById("hand-container");
    if (hand) hand.classList.toggle("battle-locked", !this.battleUIEnabled);
    const played = document.getElementById("played-container");
    if (played) played.classList.toggle("battle-locked", !this.battleUIEnabled);
  }

  // 获取卡牌等级（用于战斗伤害/治疗倍率）
  getCardLevel(cardId) {
    return Math.min(3, Math.max(1, (this.cardLevels && this.cardLevels[cardId]) || 1));
  }

  // 某职业是否仍可参与结算（存活且未被禁用）
  isProfessionActive(profession) {
    if (profession === "common" || profession === "joker") return true;
    const t = this.teammates[profession];
    return !!t && t.hp > 0;
  }

  // 单体治疗
  healTarget(profession, amount, sourceName) {
    const t = this.teammates[profession];
    if (!t) return;
    const before = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + amount);
    const healed = t.hp - before;
    this.updateTeammateStatus(profession);
    // 治疗飘字 + 护盾条上涨动画，让“回血”更明显
    try {
      const slot = document.getElementById(`slot-${profession}`);
      if (slot && this.effects && typeof this.effects.showDamageNumber === "function") {
        const rect = slot.getBoundingClientRect();
        this.effects.showDamageNumber(healed, rect.left + rect.width / 2, rect.top, false, true);
      }
    } catch (_) {}
    this.log(
      `${sourceName || "治疗"} 为 ${this.getProfessionLabel(
        profession
      )} 恢复 ${healed} 点生命`,
      "player"
    );
  }

  // 群体治疗
  healAll(amount, sourceName) {
    // 使用当前选择的职业列表
    const professions = this.selectedProfessions || ["warrior", "mage", "ranger"];
    professions.forEach((p) => {
      const t = this.teammates[p];
      if (!t || t.hp <= 0) return; // 跳过不存在的或已死亡的队友
      const before = t.hp;
      t.hp = Math.min(t.maxHp, t.hp + amount);
      const healed = t.hp - before;
      this.updateTeammateStatus(p);
      if (healed > 0) {
        try {
          const slot = document.getElementById(`slot-${p}`);
          if (slot && this.effects && typeof this.effects.showDamageNumber === "function") {
            const rect = slot.getBoundingClientRect();
            this.effects.showDamageNumber(healed, rect.left + rect.width / 2, rect.top, false, true);
          }
        } catch (_) {}
        this.log(
          `${sourceName || "群体治疗"} 为 ${this.getProfessionLabel(
            p
          )} 恢复 ${healed} 点生命`,
          "player"
        );
      }
    });
    
    // 播放治疗音效
    if (window.audioManager) {
      window.audioManager.heal();
    }
  }

  getProfessionLabel(profession) {
    const labels = {
      warrior: "战士",
      mage: "法师",
      ranger: "游侠",
      priest: "牧师",
      coder: "程序员",
      dog: "狗",
      teacher: "老师",
      security: "保安",
      hooligan: "流氓",
    };
    return labels[profession] || profession;
  }

  // 增加护盾（目前默认用于战士专属格挡牌）
  addShield(profession, amount, sourceName) {
    const t = this.teammates[profession];
    if (!t) return;
    t.shield = (t.shield || 0) + amount;
    this.updateTeammateStatus(profession);
    this.log(
      `${sourceName || "护盾"} 为 ${this.getProfessionLabel(
        profession
      )} 提供了 ${amount} 点护盾`,
      "player"
    );
  }

  // 日志
  log(message, type = "system") {
    const logDiv = document.getElementById("battle-log");
    const entry = document.createElement("div");
    entry.className = `log-entry log-${type}`;
    entry.textContent = message;
    logDiv.insertBefore(entry, logDiv.firstChild);
    while (logDiv.children.length > 50) {
      logDiv.removeChild(logDiv.lastChild);
    }
  }

  // 弹窗
  showModal(title, message) {
    // 弹窗前，强制隐藏所有悬停浮层，避免 tooltip 卡在画面里
    try {
      if (typeof CardUtil !== "undefined" && CardUtil.hideCardTooltip) CardUtil.hideCardTooltip();
    } catch (_) {}
    try {
      const el = document.getElementById("damage-breakdown-tooltip");
      if (el) el.classList.add("hidden");
    } catch (_) {}
    try {
      const el = document.getElementById("item-tooltip");
      if (el) el.classList.add("hidden");
    } catch (_) {}
    try {
      const el = document.getElementById("shop-tooltip");
      if (el) el.classList.add("hidden");
    } catch (_) {}

    window.alert(`${title}\n\n${message}`);
  }

  // 按钮事件
  bindEvents() {
    // 快捷键：Q = 快速选牌（自动选出预计伤害最高的 5 张）
    if (!document.body.dataset.quickPickBound) {
      document.body.dataset.quickPickBound = "1";
      document.addEventListener("keydown", (e) => {
        // 只在战斗界面生效；避免在输入框内触发
        const tag = (e.target && e.target.tagName) ? String(e.target.tagName).toLowerCase() : "";
        if (tag === "input" || tag === "textarea") return;
        if (this.view !== "battle") return;
        if (e.key === "q" || e.key === "Q") {
          e.preventDefault();
          this.quickPickBestFiveFromHand();
        }
      });
    }

    // 伤害框悬停：全局委托兜底（避免 DOM 移动/重复渲染导致监听器失效）
    if (!document.body.dataset.damageBreakdownGlobalBound) {
      document.body.dataset.damageBreakdownGlobalBound = "1";
      // 把 tooltip 节点抬到 body，避免被局部 transform/overflow 影响 fixed 定位或被遮挡
      try {
        const ids = ["damage-breakdown-tooltip", "status-hover-tooltip", "item-tooltip"];
        ids.forEach((id) => {
          const el = document.getElementById(id);
          if (el && el.parentElement !== document.body) document.body.appendChild(el);
        });
      } catch (_) {}

      const show = (damageBox) => {
        const damageTooltip = document.getElementById("damage-breakdown-tooltip");
        if (!damageTooltip || !damageBox) return;
        const raw = damageBox.dataset.damageBreakdown;
        if (!raw || !raw.length) {
          damageTooltip.innerHTML = "<span class=\"tooltip-title\">伤害计算</span><span class=\"tooltip-line\">当前无牌型 / 未出牌</span>";
        } else {
          try {
            const parts = JSON.parse(raw);
            let html = "<span class=\"tooltip-title\">伤害计算</span>";
            parts.forEach((p) => {
              const cls = p.cls || "";
              html += `<div class="tooltip-line ${cls}">${p.line}</div>`;
            });
            damageTooltip.innerHTML = html;
          } catch (_) {
            damageTooltip.textContent = raw;
          }
        }
        damageTooltip.classList.remove("hidden");
        const rect = damageBox.getBoundingClientRect();
        const ttRect = damageTooltip.getBoundingClientRect();
        let left = rect.right + 10;
        let top = rect.top;
        if (left + ttRect.width > window.innerWidth) left = rect.left - ttRect.width - 10;
        if (top + ttRect.height > window.innerHeight) top = window.innerHeight - ttRect.height - 10;
        if (top < 10) top = 10;
        damageTooltip.style.left = `${left}px`;
        damageTooltip.style.top = `${top}px`;
      };
      const hide = () => {
        const damageTooltip = document.getElementById("damage-breakdown-tooltip");
        if (damageTooltip) damageTooltip.classList.add("hidden");
      };
      const showStatus = (html, x, y) => {
        const tt = document.getElementById("status-hover-tooltip");
        if (!tt) return;
        tt.innerHTML = html;
        tt.classList.remove("hidden");
        const w = tt.getBoundingClientRect().width || 260;
        const h = tt.getBoundingClientRect().height || 80;
        let left = x + 14;
        let top = y + 14;
        if (left + w > window.innerWidth) left = x - w - 14;
        if (top + h > window.innerHeight) top = window.innerHeight - h - 10;
        if (top < 10) top = 10;
        tt.style.left = `${left}px`;
        tt.style.top = `${top}px`;
      };
      const hideStatus = () => {
        const tt = document.getElementById("status-hover-tooltip");
        if (tt) tt.classList.add("hidden");
      };
      const showItem = (itemId, x, y) => {
        const tt = document.getElementById("item-tooltip");
        if (!tt) return;
        if (!itemId || typeof ITEMS_DB === "undefined" || !ITEMS_DB[itemId]) return;
        const item = ITEMS_DB[itemId];
        tt.innerHTML = `
          <div class="item-tooltip-name">${item.icon} ${item.name}</div>
          <div class="item-tooltip-desc">${item.description || ""}</div>
          ${item.detail ? `<div class="item-tooltip-effect">${item.detail.replace(/\n/g, "<br>")}</div>` : ""}
        `;
        tt.classList.remove("hidden");
        const w = tt.getBoundingClientRect().width || 260;
        const h = tt.getBoundingClientRect().height || 120;
        let left = x + 14;
        let top = y + 14;
        if (left + w > window.innerWidth) left = x - w - 14;
        if (top + h > window.innerHeight) top = window.innerHeight - h - 10;
        if (top < 10) top = 10;
        tt.style.left = `${left}px`;
        tt.style.top = `${top}px`;
        tt.style.transform = "";
      };
      const hideItem = () => {
        const tt = document.getElementById("item-tooltip");
        if (tt) tt.classList.add("hidden");
      };

      document.addEventListener("mousemove", (e) => {
        const x = e.clientX;
        const y = e.clientY;

        // 1) 伤害明细：用坐标判断（不依赖 target）
        const box = document.getElementById("battle-sidebar-damage-box");
        if (box) {
          const r = box.getBoundingClientRect();
          const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
          if (inside) {
            show(box);
          } else {
            hide();
          }
        }

        // 2) debuff / 道具：用 elementFromPoint 抓真实覆盖下的元素
        const el = document.elementFromPoint(x, y);
        const badge = el && el.closest ? el.closest(".debuff-badge") : null;
        if (badge && badge.textContent) {
          const g = window.gameInstance;
          const be = g && g.battle && g.battle.enemy ? g.battle.enemy : null;
          const kind = badge.getAttribute("data-debuff") || "";
          let t = "";
          if (be && kind) {
            if (kind === "stun") t = `眩晕：敌人下回合无法行动。剩余 ${Math.max(0, Math.floor(be.stunned || 0))} 回合`;
            else if (kind === "slow") t = `减速：敌人伤害 -40%。剩余 ${Math.max(0, Math.floor(be.slow || 0))} 回合`;
            else if (kind === "weakness") t = `虚弱：敌人伤害 -50%。剩余 ${Math.max(0, Math.floor(be.weakness || 0))} 回合`;
            else if (kind === "blind") t = `致盲：敌人命中率每层 -20%（最低 5%）。剩余 ${Math.max(0, Math.floor(be.blind || 0))} 回合`;
            else if (kind === "bleed") t = `流血：敌人回合开始受到等同层数的伤害，并每回合 -1 衰减。当前 ${Math.max(0, Math.floor(be.bleed || 0))}`;
          }
          if (!t) t = badge.getAttribute("title") || "";
          if (t) {
            showStatus(
              `<span class="tooltip-title">状态说明</span><div class="tooltip-line base">${t}</div>`,
              x,
              y
            );
          } else {
            hideStatus();
          }
        } else {
          hideStatus();
        }

        // 3) 道具：不要用 closest(".item-slot") 直接取（ItemUtil 里会嵌套一个 .item-slot.has-item）
        //    这里向上找“带 data-item-id 的外层槽位”，保证稳定。
        let node = el;
        let itemId = "";
        for (let i = 0; i < 6 && node; i++) {
          if (node.dataset && typeof node.dataset.itemId === "string" && node.dataset.itemId) {
            itemId = node.dataset.itemId;
            break;
          }
          node = node.parentElement;
        }
        if (itemId) showItem(itemId, x, y);
        else hideItem();
      });
      // 额外兜底：窗口失焦时隐藏
      window.addEventListener("blur", () => { hide(); hideStatus(); hideItem(); });
      document.addEventListener("scroll", () => { hide(); hideStatus(); hideItem(); }, true);
    }

    document.getElementById("play-cards-btn").addEventListener("click", () => {
      if (!this.battle || this.gameEnded || !this.battleUIEnabled) return;
      const indices = this.getSelectedHandIndices();
      if (indices.length === 0) {
        this.log("请先点选手牌，再点「出牌」打到出牌区。", "system");
        return;
      }
      const limit = this.getPlayedLimit ? this.getPlayedLimit() : 5;
      if (this.battle.playedCards.length >= limit) {
        this.log(`出牌区已满（最多 ${limit} 张）。`, "system");
        return;
      }
      this.playSelectedToArea();
    });

    document.getElementById("auto-fill-btn").addEventListener("click", () => {
      if (!this.battle || this.gameEnded || !this.battleUIEnabled) return;
      this.autoFillPlayedToFive();
    });

    document.getElementById("reset-btn").addEventListener("click", () => {
      if (!this.battle || this.gameEnded || !this.battleUIEnabled) return;
      const indices = this.getSelectedHandIndices();
      if (indices.length === 0) {
        this.log("请先点选要换掉的牌，再点「换牌」。", "system");
        return;
      }
      this.battle.mulligan(indices);
    });

    document.getElementById("end-turn-btn").addEventListener("click", () => {
      if (!this.battle || this.gameEnded || !this.battleUIEnabled) return;
      // 团队眩晕：本回合无法出牌，只能结束回合
      if ((this.teamStunned || 0) > 0) {
        this.teamStunned--;
        this.log("✨ 眩晕中：本回合无法出牌，直接结束回合。", "system");
      }
      if (this.needsHealTarget()) {
        this.autoAssignHealTargets();
      }
      this.battle.playCards();
    });

    // 伤害框悬停：局部绑定保留（更省资源）；全局委托在上面已兜底
    this.bindDamageBreakdownTooltip();

    const discardToggle = document.getElementById("discard-toggle");
    const discardCount = document.getElementById("discard-count");
    const openLog = () => this.openBattleDrawer("log");
    const toggleDisc = () => this.toggleDiscardPanel();
    if (discardToggle) {
      discardToggle.addEventListener("click", toggleDisc);
      discardToggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleDisc();
        }
      });
    }
    if (discardCount) {
      discardCount.addEventListener("click", toggleDisc);
    }
    const btnLog = document.getElementById("btn-battle-log-drawer");
    const btnDisc = document.getElementById("btn-battle-discard-drawer");
    if (btnLog) btnLog.addEventListener("click", openLog);
    if (btnDisc) btnDisc.addEventListener("click", toggleDisc);
    document.getElementById("battle-drawer-log-close")?.addEventListener("click", () => this.closeBattleDrawers());
    document.getElementById("battle-drawer-discard-close")?.addEventListener("click", () => this.closeBattleDrawers());
    const backdrop = document.getElementById("battle-drawer-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", () => this.closeBattleDrawers());
    }
    if (!this._battleDrawerEscBound) {
      this._battleDrawerEscBound = true;
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const logO = document.getElementById("battle-drawer-log")?.classList.contains("open");
        const discO = document.getElementById("battle-drawer-discard")?.classList.contains("open");
        if (logO || discO) {
          e.preventDefault();
          this.closeBattleDrawers();
        }
      });
    }

    document.getElementById("battle-settings-btn")?.addEventListener("click", () => this.showSettingsModal());

    // 商店按钮
    const shopRefresh = document.getElementById("shop-refresh");
    if (shopRefresh) {
      shopRefresh.addEventListener("click", () => this.refreshShop());
    }
    const shopLeave = document.getElementById("shop-leave");
    if (shopLeave) {
      shopLeave.addEventListener("click", () => this.leaveShop());
    }

    // 事件确认按钮
    const eventConfirm = document.getElementById("event-confirm");
    if (eventConfirm) {
      eventConfirm.addEventListener("click", () => this.confirmEvent());
    }

    // 组合技查看按钮
    const combosBtn = document.getElementById("combos-btn");
    if (combosBtn) {
      combosBtn.addEventListener("click", () => this.showCombosView());
    }
    const combosClose = document.getElementById("combos-close");
    if (combosClose) {
      combosClose.addEventListener("click", () => this.hideCombosView());
    }
    const deckBtn = document.getElementById("deck-btn");
    if (deckBtn) deckBtn.addEventListener("click", () => this.showDeckView());
    const deckClose = document.getElementById("deck-close");
    if (deckClose) deckClose.addEventListener("click", () => this.hideDeckView());

    // 音乐开关按钮
    const musicBtn = document.getElementById("music-btn");
    if (musicBtn) {
      musicBtn.addEventListener("click", () => {
        if (window.audioManager) {
          const enabled = window.audioManager.toggleBgMusic();
          musicBtn.querySelector(".status-value").textContent = enabled ? "音乐" : "静音";
        }
      });
    }

    // 选择治疗/援护目标：点击队友头像
    // 注意：这里的事件绑定在 init 中通过 updateTeammateUI 动态完成
    // 因为职业列表是动态的，所以事件绑定需要在创建队友槽位时进行
  }

  bindDamageBreakdownTooltip() {
    const damageBox = document.getElementById("battle-sidebar-damage-box");
    const damageTooltip = document.getElementById("damage-breakdown-tooltip");
    if (!damageBox || !damageTooltip) return;

    // 避免重复绑定
    if (damageBox.dataset.breakdownBound === "1") return;
    damageBox.dataset.breakdownBound = "1";

    const show = () => {
      const raw = damageBox.dataset.damageBreakdown;
      if (!raw || !raw.length) {
        damageTooltip.innerHTML = "<span class=\"tooltip-title\">伤害计算</span><span class=\"tooltip-line\">当前无牌型 / 未出牌</span>";
      } else {
        try {
          const parts = JSON.parse(raw);
          let html = "<span class=\"tooltip-title\">伤害计算</span>";
          parts.forEach((p) => {
            const cls = p.cls || "";
            html += `<div class="tooltip-line ${cls}">${p.line}</div>`;
          });
          damageTooltip.innerHTML = html;
        } catch (_) {
          damageTooltip.textContent = raw;
        }
      }
      damageTooltip.classList.remove("hidden");
      const rect = damageBox.getBoundingClientRect();
      const ttRect = damageTooltip.getBoundingClientRect();
      let left = rect.right + 10;
      let top = rect.top;
      if (left + ttRect.width > window.innerWidth) left = rect.left - ttRect.width - 10;
      if (top + ttRect.height > window.innerHeight) top = window.innerHeight - ttRect.height - 10;
      if (top < 10) top = 10;
      damageTooltip.style.left = `${left}px`;
      damageTooltip.style.top = `${top}px`;
    };
    const hide = () => damageTooltip.classList.add("hidden");

    // 某些布局/覆盖层下 mouseenter 可能不稳定，补一个 mousemove 兜底
    damageBox.addEventListener("mouseenter", show);
    damageBox.addEventListener("mousemove", show);
    damageBox.addEventListener("mouseleave", hide);
  }

  clearSelectedTarget() {
    const professions = this.selectedProfessions || ["warrior", "mage", "ranger"];
    professions.forEach((p) => {
      const slot = document.getElementById(`slot-${p}`);
      if (!slot) return;
      slot.classList.remove("target-selected");
    });
  }

  // 为某张手牌索引绑定治疗目标
  // 为某张“出牌区索引”绑定治疗目标（用于治疗结算；拖拽到队友头像也走这里）
  bindHealTarget(cardIndex, profession, opts = {}) {
    if (!this.isProfessionActive(profession)) {
      this.log("该队友已无法战斗，不能作为目标。", "system");
      return;
    }
    if (!this.battle || !Array.isArray(this.battle.playedCards)) return;
    const playedId = this.battle.playedCards[cardIndex];
    if (!playedId) return;
    const card = CARDS_DB[playedId];
    if (!card || !card.heal || card.healAll) return;
    // 治疗牌所属职业如果已阵亡，则该牌本回合失效，不允许再选目标
    const ownerProf = card.profession || "common";
    if (!this.isProfessionActive(ownerProf)) {
      this.log("该治疗牌所属职业已阵亡，本回合无法生效。", "system");
      return;
    }

    const kind = card.id === "potion" ? "potion" : "heal";
    const existing = this.healTargets[cardIndex];
    const tag = existing && existing.tag ? existing.tag : this._healTagSeq++;
    this.healTargets[cardIndex] = { target: profession, kind, tag };

    this.renderHealMarkers();
    // 绑定是按“出牌区索引”，只需要刷新出牌区即可；手牌不再显示 heal-bound 以免误导
    if (typeof this.renderPlayedArea === "function") this.renderPlayedArea(this.battle.playedCards);

    this.log(
      `已将【${card.name}】绑定到 ${this.getProfessionLabel(profession)}（${kind === "potion" ? "🧪" : "💚"}${tag}）。`,
      "system"
    );
  }

  // 更新牌库 / 弃牌显示
  updateDeckInfo(deckCount, discardCount) {
    const deckEl = document.getElementById("deck-count");
    const discardEl = document.getElementById("discard-count");
    if (deckEl) deckEl.textContent = String(deckCount);
    if (discardEl) discardEl.textContent = String(discardCount);
    // 如果面板展开，顺便刷新列表
    const list = document.getElementById("discard-list");
    if (list && !list.classList.contains("hidden")) {
      this.renderDiscardList();
    }
  }

  // 根据 healTargets 渲染角色上的治疗标记和手牌上的绑定状态
  renderHealMarkers() {
    // 使用当前选择的职业列表动态构建 perProf
    const professions = this.selectedProfessions || ["warrior", "mage", "ranger"];
    const perProf = {};
    professions.forEach(p => {
      perProf[p] = { heal: [], potion: [] };
    });

    Object.keys(this.healTargets || {}).forEach((key) => {
      const bind = this.healTargets[key];
      if (!bind || !perProf[bind.target]) return;
      if (bind.kind === "potion") perProf[bind.target].potion.push(bind.tag);
      else perProf[bind.target].heal.push(bind.tag);
    });

    professions.forEach((p) => {
      const slot = document.getElementById(`slot-${p}`);
      if (!slot) return;
      const existed = slot.querySelector(".heal-marker");
      if (existed) slot.removeChild(existed);
      const info = perProf[p];
      if (!info || (info.heal.length === 0 && info.potion.length === 0)) return;

      const parts = [];
      if (info.heal.length > 0) {
        parts.push(
          `<span class="heal-marker-icon">💚</span><span class="heal-marker-count">${info.heal.join(",")}</span>`
        );
      }
      if (info.potion.length > 0) {
        parts.push(
          `<span class="heal-marker-icon">🧪</span><span class="heal-marker-count">${info.potion.join(",")}</span>`
        );
      }

      const el = document.createElement("div");
      el.className = "heal-marker";
      el.innerHTML = parts.join("");
      slot.appendChild(el);
    });

    // healTargets 现在按“出牌区索引”存，不再在手牌上标记 heal-bound
  }

  // 出牌区中是否存在需要指定目标的治疗牌
  needsHealTarget() {
    if (!this.battle || !this.battle.playedCards) return false;
    return this.battle.playedCards.some((id, idx) => {
      const card = CARDS_DB[id];
      if (!card) return false;
      const profession = card.profession || "common";
      if (!this.isProfessionActive(profession)) return false;
      if (card.heal && !card.healAll) {
        return this.healTargets[idx] == null || !this.healTargets[idx].target;
      }
      return false;
    });
  }

  // 自动分配治疗目标（按出牌区顺序）
  autoAssignHealTargets() {
    if (!this.battle || !this.battle.playedCards) return;

    const aliveProfessions = this.selectedProfessions.filter(p => {
      const t = this.teammates[p];
      return t && t.hp > 0;
    });

    if (aliveProfessions.length === 0) return;

    this.battle.playedCards.forEach((id, idx) => {
      const card = CARDS_DB[id];
      if (!card) return;

      if (card.heal && !card.healAll) {
        if (!this.healTargets[idx] || !this.healTargets[idx].target) {
          let lowestHpProf = aliveProfessions[0];
          let lowestHpPercent = 1;

          aliveProfessions.forEach(p => {
            const t = this.teammates[p];
            const hpPercent = t.hp / t.maxHp;
            if (hpPercent < lowestHpPercent) {
              lowestHpPercent = hpPercent;
              lowestHpProf = p;
            }
          });
          
          // 自动分配
          this.bindHealTarget(idx, lowestHpProf, { source: "auto" });
          this.log(`【${card.name}】自动分配给 ${this.getProfessionLabel(lowestHpProf)}`, "system");
        }
      }
    });
  }

  toggleDiscardPanel() {
    const disc = document.getElementById("battle-drawer-discard");
    if (disc && disc.classList.contains("open")) {
      this.closeBattleDrawers();
      return;
    }
    this.openBattleDrawer("discard");
  }

  renderDiscardList() {
    const list = document.getElementById("discard-list");
    if (!list || !this.battle) return;
    list.innerHTML = "";
    this.battle.discard.forEach((id) => {
      const card = CARDS_DB[id];
      if (!card) return;
      const el = document.createElement("div");
      el.className = "discard-card";
      el.innerHTML = `
        <span class="discard-card-icon">${card.icon || "🃏"}</span>
        <span class="discard-card-name">${card.name}</span>
      `;
      list.appendChild(el);
    });
  }

  // 每回合开始或换牌后重置所有治疗绑定
  resetHealBindings() {
    this.healTargets = {};
    this._healTagSeq = 1;
    this._pendingHealPlayedIndex = null;
    this.renderHealMarkers();
  }
}

let game;
document.addEventListener("DOMContentLoaded", () => {
  game = new Game();
  try {
    window.gameInstance = game;
    window.__CITY_HERO_DEBUG__ = {
      checkpoints: ["floor1_map", "post_floor1_team", "floor2_map"],
      /** 例：__CITY_HERO_DEBUG__.load('post_floor1_team') */
      load(id) {
        return window.gameInstance && window.gameInstance.debugLoadCheckpoint(id);
      },
    };
  } catch (_) {}
});
