// 战斗系统（卡牌连击原型）
class BattleSystem {
  constructor(game) {
    this.game = game;
    this.enemy = null;
    this.turn = 1;
    this.energy = 0;      // 先保留字段，但当前规则不再使用能量
    this.maxEnergy = 0;
    this.hand = [];
    this.handPoisons = []; // 与 hand 对齐：手牌中毒层数（Boss2 下毒，跨回合保留）
    this.playedCards = []; // 本回合打出的牌（最多5张），结束回合时用此结算
    this.playedSlots = []; // 与 playedCards 对齐：每张牌所在槽位 idx
    this.playedCardPoisons = []; // 与 playedCards 对齐：该牌来源手牌的中毒层数（打出后用于结算“反噬中毒”）
    this.deck = [];
    this.discard = [];
    this.damageThisTurn = 0;
    this.items = [];
    this.hasMulligan = false; // 每回合一次换牌（仅手牌），一回合一次
    this.drawForNextTurn = 0;
    this.retrieveForNextTurn = [];
  }

  // 初始化战斗
  initBattle(enemy, deck, items) {
    this.enemy = { ...enemy };
    this.game.gameEnded = false;
    const endTurnBtn = document.getElementById("end-turn-btn");
    const resetBtn = document.getElementById("reset-btn");
    if (endTurnBtn) endTurnBtn.disabled = false;
    if (resetBtn) resetBtn.disabled = false;
    const handContainer = document.getElementById("hand-container");
    if (handContainer) handContainer.classList.remove("game-ended");
    // 初始牌库洗牌
    this.deck = [...deck].sort(() => Math.random() - 0.5);
    this.items = items || [];
    this.turn = 1;
    this.energy = 0;
    this.hand = [];
    this.handPoisons = [];
    this.playedCards = [];
    this.playedSlots = [];
    this.playedCardPoisons = [];
    this.discard = [];
    this.damageThisTurn = 0;
    this.hasMulligan = false;
    this.drawForNextTurn = 0;
    this.retrieveForNextTurn = [];
    this.triRegionTilesActive = !!(this.game && this.game.triRegionUnlocked);
    this.triRegionTerrainRevealed = !!(this.game && this.game.triRegionUnlocked);

    // 播放战斗音乐（根据是否是Boss）
    try {
      if (window.audioManager && window.audioManager.initialized) {
        if (enemy.isBoss || enemy.name?.includes('Boss') || enemy.name?.includes('老大') || enemy.name?.includes('魔王') || enemy.name?.includes('主任')) {
          window.audioManager.playSceneMusic('boss');
        } else {
          window.audioManager.playSceneMusic('battle');
        }
      }
    } catch (e) {
      console.warn('Battle music error:', e);
    }

    this.startTurn();
  }

  // 开始回合
  startTurn() {
    if (this.game.gameEnded) return;
    this.game.turnDamageCommitted = false;
    // 兜底：若当前已全员阵亡，直接触发游戏结束
    const professions = this.game.selectedProfessions || [];
    const allDead = professions.length > 0 && professions.every(p => {
      const t = this.game.teammates[p];
      return !t || t.hp <= 0;
    });
    if (allDead) {
      this.game.gameOver();
      return;
    }
    try {
      // 新回合开始：解除结算锁，恢复交互
      try {
        if (this.game && typeof this.game.setBattleControlsEnabled === "function") {
          this.game.setBattleControlsEnabled(true);
        }
      } catch (_) {}

      // 回合开始：结算“出牌上限惩罚”等持续效果
      try {
        if (this.game && typeof this.game.tickPlayedSlotBurnAtTurnStart === "function") {
          this.game.tickPlayedSlotBurnAtTurnStart();
        }
      } catch (_) {}

      // 回合开始：持续伤害（中毒/火焰等）
      if (typeof this.game.applyDotsAtStartOfTurn === "function") {
        this.game.applyDotsAtStartOfTurn();
      }

      // Boss1 机制提示：在玩家回合开始再提醒一次（防止上一回合提示被错过）
      try {
        if (this.enemy && this.enemy.aiType === "boss1") {
          const mechLabel = (m) => (m === "shatter" ? "💣 破坏牌型" : m === "burnSlots" ? "🔥 点燃格子" : "");
          if (this.enemy.boss1NextMech && typeof this.game.showComboText === "function") {
            // 预告类提示：显示时间稍长一点，方便看清
            this.game.showComboText(`⚠️ 预告：Boss 下回合 ${mechLabel(this.enemy.boss1NextMech)}`, 3200);
          }
          if (this.enemy.boss1Skill === "shatter" && typeof this.game.showComboText === "function") {
            this.game.showComboText("警告：本回合结算前将破坏你的出牌组合", 3200);
          }
        }
      } catch (_) {}

      this.energy = 0;
      this.damageThisTurn = 0;
      this.hasMulligan = false;
      // 本回合换牌上限临时修正（由卡牌/技能设置）
      try { this.game._tempMulliganLimitBonusThisTurn = 0; } catch (_) {}
      if (typeof this.game.clearSelectedTarget === "function") {
        this.game.clearSelectedTarget();
      }
      if (typeof this.game.resetHealBindings === "function") {
        this.game.resetHealBindings();
      }
      if (typeof this.game.clearPendingPlaySlot === "function") {
        this.game.clearPendingPlaySlot();
      }

      // 手牌保留；出牌区在 endTurn 已清空并进入弃牌堆，此处无需再动

      // 回合开始：刷新道具带来的本回合临时加成（如骰子出牌上限+1）
      try {
        if (this.game && typeof this.game.refreshTurnItemBonuses === "function") {
          this.game.refreshTurnItemBonuses();
        }
      } catch (_) {}

      if (this.turn === 1 && this.game && typeof this.game.applyFirstTurnItemEffects === "function") {
        try { this.game.applyFirstTurnItemEffects(); } catch (_) {}
      }

      // 捡回来：上回合回收的牌直接加入手牌
      const retrieveCount = this.retrieveForNextTurn.length;
      if (retrieveCount > 0) {
        this.hand.push(...this.retrieveForNextTurn);
        this.handPoisons.push(...Array.from({ length: retrieveCount }, () => 0));
        this.retrieveForNextTurn = [];
        this.game.log(`捡回来：回收 ${retrieveCount} 张牌到手牌`, "system");
      }

      // 抽牌：起手 7 张；之后每回合基础摸 3 张；再叠加上回合打出带「过牌」效果的额外抽牌
      const baseDraw = (this.turn === 1) ? 7 : 3;
      const extraDraw = this.drawForNextTurn || 0;
      const itemDrawBonus = (this.turn === 1) ? 0 : (this.game && typeof this.game.getTurnDrawBonusFromItems === "function" ? this.game.getTurnDrawBonusFromItems() : 0);
      const drawCount = baseDraw + extraDraw + itemDrawBonus;
      this.drawForNextTurn = 0;
      this.drawCards(Math.max(1, drawCount));
      try {
        if (this.turn === 1) {
          this.game.log(`起手摸牌：${baseDraw} 张`, "system");
        } else {
          const parts = [`本回合摸牌：基础 ${baseDraw} 张`];
          if (extraDraw > 0) parts.push(`过牌 +${extraDraw}`);
          if (retrieveCount > 0) parts.push(`回收 +${retrieveCount}`);
          if (itemDrawBonus > 0) parts.push(`道具 +${itemDrawBonus}`);
          this.game.log(parts.join("，"), "system");
        }
      } catch (_) {}

      // 教学战斗：固定手牌，避免随机导致一回合秒怪/教学断档
      try {
        if (this.game && this.game.tutorialBattleActive && Array.isArray(this.game._tutorialFixedHand)) {
          this.hand = [...this.game._tutorialFixedHand];
          this.handPoisons = Array.from({ length: this.hand.length }, () => 0);
          // 不让牌堆干扰教学（防止下回合又随机抽到强牌）
          this.deck = [];
          this.discard = [];
        }
      } catch (_) {}

      // 播放抽牌音效
      if (window.audioManager) {
        window.audioManager.drawCard();
      }

      this.game.log(`=== 第 ${this.turn} 回合 ===`, "system");
      const roundEl = document.getElementById("battle-round");
      if (roundEl) roundEl.textContent = this.turn;
      this.game.updateEnergy();
      this.game.updateTurnDamage(0, null, null, false, null);
      this.game.renderHand(this.hand);
      this.game.renderPlayedArea(this.playedCards);
      this.game.updateComboDisplay();
      if (typeof this.game.updateDeckInfo === "function") {
        this.game.updateDeckInfo(this.deck.length, this.discard.length);
      }
      if (typeof this.game.updatePlayedCount === "function") {
        this.game.updatePlayedCount();
      }
      if (typeof this.game.updateEnemyDebuffsAndIntent === "function") {
        this.game.updateEnemyDebuffsAndIntent();
      }

      // 新手引导：聚焦高亮式教学（引导玩家点按钮完成一场战斗）
      try {
        if (typeof this.game.startBattleTutorialIfNeeded === "function") {
          this.game.startBattleTutorialIfNeeded();
        }
      } catch (_) {}
    } catch (e) {
      console.error("startTurn error:", e);
      this.game.log("新回合初始化出现异常，已尝试自动恢复。", "system");
      if (!this.hand || this.hand.length === 0) {
        this.drawCards(this.turn === 1 ? 7 : 3);
        this.game.renderHand(this.hand);
        if (typeof this.game.updateDeckInfo === "function") {
          this.game.updateDeckInfo(this.deck.length, this.discard.length);
        }
      }
      if (typeof this.game.renderPlayedArea === "function") {
        this.game.renderPlayedArea(this.playedCards);
      }
    }
  }

  // 从牌库抽牌，必要时洗回弃牌堆
  drawCards(count) {
    for (let i = 0; i < count; i++) {
      if (!this.deck.length) {
        if (!this.discard.length) break;
        // 弃牌堆洗回牌库
        this.deck = this.discard.sort(() => Math.random() - 0.5);
        this.discard = [];
      }
      const cardId = this.deck.pop();
      if (!cardId) break;
      this.hand.push(cardId);
      this.handPoisons.push(0);
    }
    if (typeof this.game.updateDeckInfo === "function") {
      this.game.updateDeckInfo(this.deck.length, this.discard.length);
    }
  }

  // 过牌（每回合一次）：indices 为当前手牌索引数组
  mulligan(indices) {
    if (this.hasMulligan) {
      const limit = (this.game && typeof this.game.getMulliganLimit === "function") ? this.game.getMulliganLimit() : 2;
      this.game.log("本回合已经换牌过一次了。", "system");
      try {
        if (this.game && typeof this.game.showComboText === "function") {
          this.game.showComboText(`已换牌（每回合最多 ${limit} 张）`);
        }
      } catch (_) {}
      return;
    }
    let unique = Array.from(new Set(indices)).filter(
      (i) => i >= 0 && i < this.hand.length
    );
    if (!unique.length) {
      this.game.log("没有选择要过掉的牌。", "system");
      return;
    }

    // 每回合最多换 N 张（默认2，可被道具/卡牌调整）
    const limit = (this.game && typeof this.game.getMulliganLimit === "function") ? this.game.getMulliganLimit() : 2;
    if (unique.length > limit) {
      unique = unique.slice(0, limit);
      this.game.log(`本回合最多换 ${limit} 张牌，已自动只换前 ${limit} 张。`, "system");
      try {
        if (this.game && typeof this.game.showComboText === "function") {
          this.game.showComboText(`每回合最多换 ${limit} 张`);
        }
      } catch (_) {}
    }

    // 教学战斗：换牌结果固定可控（保证教学体验）
    try {
      if (this.game && this.game.tutorialBattleActive) {
        // 把选中的牌丢进弃牌堆
        unique.sort((a, b) => b - a);
        for (const idx of unique) {
          const [removed] = this.hand.splice(idx, 1);
          if (Array.isArray(this.handPoisons)) this.handPoisons.splice(idx, 1);
          if (removed) this.discard.push(removed);
        }
        // 用固定池补回（不走抽牌）
        const pool = Array.isArray(this.game._tutorialSwapPool) ? this.game._tutorialSwapPool : ["attack", "attack", "block"];
        for (let i = 0; i < unique.length; i++) {
          this.hand.push(pool[i % pool.length]);
          this.handPoisons.push(0);
        }
        this.hasMulligan = true;
        this.game.renderHand(this.hand);
        if (typeof this.game.resetHealBindings === "function") this.game.resetHealBindings();
        if (typeof this.game.updateDeckInfo === "function") this.game.updateDeckInfo(this.deck.length, this.discard.length);
        return;
      }
    } catch (_) {}

    // 把选中的牌丢进弃牌堆
    unique.sort((a, b) => b - a);
    for (const idx of unique) {
      const [removed] = this.hand.splice(idx, 1);
      if (Array.isArray(this.handPoisons)) this.handPoisons.splice(idx, 1);
      if (removed) this.discard.push(removed);
    }

    // 重抽相同数量
    this.drawCards(unique.length);
    this.hasMulligan = true;

    this.game.renderHand(this.hand);
    if (typeof this.game.resetHealBindings === "function") {
      this.game.resetHealBindings();
    }
    if (typeof this.game.updateDeckInfo === "function") {
      this.game.updateDeckInfo(this.deck.length, this.discard.length);
    }
  }

  // 执行出牌（以出牌区 playedCards 结算，手牌保留）
  async playCards() {
    if (this.game.gameEnded) return;
    this.damageThisTurn = 0;

    try {
      // 结算开始：锁定交互，避免动画期间误点造成状态错乱
      try {
        if (this.game && typeof this.game.setBattleControlsEnabled === "function") {
          this.game.setBattleControlsEnabled(false);
        }
      } catch (_) {}

      // 治疗牌默认目标：如果玩家没绑目标，结算前自动分配（最低血量优先）
      try {
        if (this.game && typeof this.game.needsHealTarget === "function" && this.game.needsHealTarget()) {
          if (typeof this.game.autoAssignHealTargets === "function") this.game.autoAssignHealTargets();
        }
      } catch (_) {}

      let cardsToResolve = this.playedCards;

      for (let i = 0; i < cardsToResolve.length; i++) {
        const cardId = cardsToResolve[i];
        const card = CARDS_DB[cardId];
        if (!card) continue;
        const slotIdxHeal = Array.isArray(this.playedSlots) && this.playedSlots[i] != null ? this.playedSlots[i] : i;
        const supMult =
          this.game && typeof this.game.getTriRegionHealShieldFactor === "function"
            ? this.game.getTriRegionHealShieldFactor(slotIdxHeal)
            : 1;

        if (card.heal && !card.healAll) {
          const ownerProf = card.profession || "common";
          if (!this.game.isProfessionActive(ownerProf)) continue;
          const targetProf = this.game.healTargets && this.game.healTargets[i] && this.game.healTargets[i].target;
          if (targetProf && this.game.isProfessionActive(targetProf)) {
            if (typeof this.game.healTarget === "function") {
              const level = typeof this.game.getCardLevel === "function" ? this.game.getCardLevel(cardId) : 1;
              const healMult = 1 + (level - 1) * 0.5;
              this.game.healTarget(targetProf, Math.floor((card.heal || 0) * healMult * supMult), card.name);
            }
          }
        }

        if (card.healAll) {
          if (typeof this.game.healAll === "function") {
            const level = typeof this.game.getCardLevel === "function" ? this.game.getCardLevel(cardId) : 1;
            const healMult = 1 + (level - 1) * 0.5;
            this.game.healAll(Math.floor((card.healAll || 0) * healMult * supMult), card.name);
          }
        }

        // 损耗生命（如“以血换盾”）：先扣血（无视护盾），再结算该牌的护盾等
        if (card.loseHp && typeof this.game.applyDamageToTeammate === "function") {
          const ownerProf = card.profession || "common";
          if (ownerProf !== "common" && this.game.isProfessionActive(ownerProf)) {
            const level = typeof this.game.getCardLevel === "function" ? this.game.getCardLevel(cardId) : 1;
            const mult = 1 + (level - 1) * 0.5;
            const amount = Math.max(0, Math.floor((card.loseHp || 0) * mult));
            if (amount > 0) {
              this.game.applyDamageToTeammate(ownerProf, amount, { ignoreShield: true, damageType: "direct" });
              this.game.log(`${card.name}：${this.game.getProfessionLabel ? this.game.getProfessionLabel(ownerProf) : ownerProf} 损耗 ${amount} 生命`, "system");
            }
          }
        }

        if (card.shield) {
          if (typeof this.game.addShield === "function") {
            const level = typeof this.game.getCardLevel === "function" ? this.game.getCardLevel(cardId) : 1;
            const shieldMult = 1 + (level - 1) * 0.5;
            const amount = Math.floor((card.shield || 0) * shieldMult * supMult);

            // 护盾卡不再只绑定“warrior”，否则非战士队伍会出现“出了护盾牌但看不到护盾”的问题。
            // 规则：若该牌也是全队治疗（healAll），则护盾给全队；否则给该牌对应职业（若是 common，则给全队）。
            const selected = Array.isArray(this.game.selectedProfessions) ? this.game.selectedProfessions : [];
            let targets = [];
            if (card.healAll) {
              targets = selected;
            } else if (card.profession && card.profession !== "common") {
              targets = [card.profession];
            } else {
              targets = selected;
            }
            let uniqueTargets = [...new Set(targets.filter((p) => this.game.isProfessionActive && this.game.isProfessionActive(p)))];
            if (uniqueTargets.length === 0 && this.game.teammates) {
              uniqueTargets = Object.keys(this.game.teammates).filter((p) => this.game.isProfessionActive && this.game.isProfessionActive(p));
            }
            uniqueTargets.forEach((p) => this.game.addShield(p, amount, card.name));
          }
        }

        // 本回合换牌上限：由打出的牌临时增减（可为负）
        if (typeof card.mulliganLimitBonusThisTurn === "number") {
          try {
            this.game._tempMulliganLimitBonusThisTurn = Number(this.game._tempMulliganLimitBonusThisTurn || 0) + Number(card.mulliganLimitBonusThisTurn || 0);
          } catch (_) {}
        }
      }

      // 将出牌区转换为用于牌型结算的结构
      const buildPlayedArray = (ids) => {
        const out = [];
        for (let i = 0; i < ids.length; i++) {
          const cardId = ids[i];
          const card = CARDS_DB[cardId];
          if (!card) continue;
          const profession = card.profession || "common";
          if (!this.game.isProfessionActive(profession)) continue;
          const level = typeof this.game.getCardLevel === "function" ? this.game.getCardLevel(cardId) : 1;
          const damageMult = 1 + (level - 1) * 0.5;
          const hits = Math.max(1, Math.floor(card.hitCount || 1));
          const slotIdx = Array.isArray(this.playedSlots) && this.playedSlots[i] != null ? this.playedSlots[i] : i;
          const atkSlotMult =
            (card.damage || 0) > 0 &&
            this.game &&
            typeof this.game.getTriRegionAttackDamageFactor === "function"
              ? this.game.getTriRegionAttackDamageFactor(slotIdx)
              : 1;
          out.push({
            id: cardId,
            profession,
            archetype: card.archetype || card.type || "attack",
            bleed: Math.max(0, Math.floor(card.bleed || 0)),
            baseDamage: Math.floor((card.damage || 0) * damageMult * atkSlotMult) * hits,
          });
        }
        return out;
      };

      // 传入游戏状态以检查隐藏组合
      const gameState = {
        discoveredCombos: this.game.discoveredCombos || [],
        items: this.game.items || [],
      };

      // ===== 先按“完整组合”计算一次伤害，用于 Boss 破坏前的对比 =====
      let played = buildPlayedArray(cardsToResolve);
      if (!played.length) {
        this.game.log("本回合未出牌或仅使用了治疗/护盾。", "system");
        await this.endTurn();
        return;
      }

      const fullResult = typeof evaluateCombo === "function" ? evaluateCombo(played, gameState) : null;
      if (!fullResult) {
        this.game.log("结算失败：未找到牌型系统。", "system");
        await this.endTurn();
        return;
      }

      // ===== 裂隙觉醒（前三格地形）：优先于「破坏牌型」；半血以下首次或本击击杀时触发，且不与本回合破坏同时结算 =====
      // 是否揭示仍在此用预览判定（用于跳过破坏牌型）；实际演出推迟到「造成伤害 + 血条动画」之后
      let skipShatterForTerrain = false;
      let pendingTerrainReveal = false;
      try {
        const beforeHpPreview = this.enemy.hp;
        const maxHpPreview = this.enemy.maxHp || 1;
        const dealtPreviewFull =
          this.game && typeof this.game.previewDealtToEnemyFromResult === "function"
            ? this.game.previewDealtToEnemyFromResult(this.enemy, fullResult)
            : 0;
        const hpAfterPreview = beforeHpPreview - dealtPreviewFull;
        if (
          this.game &&
          typeof this.game.shouldRevealTriRegionTerrain === "function" &&
          this.game.shouldRevealTriRegionTerrain(this, {
            beforeHp: beforeHpPreview,
            hpAfterPreview,
            maxHp: maxHpPreview,
          })
        ) {
          skipShatterForTerrain = true;
          pendingTerrainReveal = true;
        }
      } catch (_) {}

      // ===== 第1层 Boss / 精英 特殊机制：在结算前破坏牌型 =====
      let reducedResult = fullResult;
      let shatterSelfDamage = 0;
      // 若 Boss 处于眩晕，本回合不触发“机制技能”（持续型效果除外）
      const shatterActive =
        !skipShatterForTerrain &&
        ((this.enemy && this.enemy.aiType === "boss1" && this.enemy.boss1Skill === "shatter") ||
          (this.enemy && this.enemy.aiType === "elite1_shatter" && ((this.enemy.eliteShatterCD ?? 0) <= 0)) ||
          (this.enemy && this.enemy.aiType === "elite_tri_region_gate" && ((this.enemy.eliteShatterCD ?? 0) <= 0)));
      if (shatterActive && (this.enemy.stunned || 0) <= 0) {
        try {
          // 再次明确提醒：本回合结算前会破坏你的牌型（无论上一回合是否已经看过预告）
          try {
            if (this.enemy && this.enemy.aiType === "boss1" && typeof this.game.showComboText === "function") {
              this.game.showComboText("Boss 技能发动：本回合结算前将破坏你的出牌组合", 3200);
            }
            if (this.enemy && this.enemy.aiType === "elite1_shatter" && typeof this.game.showComboText === "function") {
              this.game.showComboText("精英技能：本回合结算前将破坏你的出牌组合", 2600);
            }
            if (this.enemy && this.enemy.aiType === "elite_tri_region_gate" && typeof this.game.showComboText === "function") {
              this.game.showComboText("裂隙打手：本回合结算前将破坏你的出牌组合", 2600);
            }
          } catch (_) {}

          // 只从有基础伤害的牌里挑
          const dmgCards = played
            .map((c, idx) => ({ ...c, idx }))
            .filter((c) => (c.baseDamage || 0) > 0);

          if (dmgCards.length > 0) {
            const shuffled = [...dmgCards].sort(() => Math.random() - 0.5);
            const maxBreak =
              this.enemy && (this.enemy.aiType === "elite1_shatter" || this.enemy.aiType === "elite_tri_region_gate")
                ? 1
                : 2;
            const picked = shuffled.slice(0, Math.min(maxBreak, shuffled.length));
            const removedIndices = new Set(picked.map((p) => p.idx));
            const removedNames = [];

            picked.forEach((p) => {
              const card = CARDS_DB[p.id];
              if (card && !removedNames.includes(card.name)) removedNames.push(card.name);
            });

            // 反噬伤害 = 仅被破坏牌的牌面伤害之和（不考虑牌型倍率）
            shatterSelfDamage = picked.reduce((s, p) => s + (p.baseDamage || 0), 0);

            // 提前算出破坏后的数据，用于动画。played 与 cardsToResolve 一一对应仅对“参与结算”的牌；
            // buildPlayedArray 会跳过未激活职业的牌，故要用“当前在 played 中的下标”判定是否移除，不能用 findIndex(id)（重复牌会错位）
            const newCardsToResolve = [];
            const newPlayedSlots = [];
            let playedIdx = -1;
            for (let i = 0; i < cardsToResolve.length; i++) {
              const cardId = cardsToResolve[i];
              const card = CARDS_DB[cardId];
              const slotIdx = Array.isArray(this.playedSlots) && this.playedSlots[i] != null ? this.playedSlots[i] : i;
              if (!card) {
                newCardsToResolve.push(cardId);
                newPlayedSlots.push(slotIdx);
                continue;
              }
              if (!this.game.isProfessionActive(card.profession || "common")) {
                newCardsToResolve.push(cardId);
                newPlayedSlots.push(slotIdx);
                continue;
              }
              playedIdx += 1;
              if (removedIndices.has(playedIdx)) {
                this.discard.push(cardId);
              } else {
                newCardsToResolve.push(cardId);
                newPlayedSlots.push(slotIdx);
              }
            }
            const tempCardsToResolve = newCardsToResolve;
            const tempPlayed = buildPlayedArray(tempCardsToResolve);
            const tempReducedResult = tempPlayed.length && typeof evaluateCombo === "function"
              ? evaluateCombo(tempPlayed, gameState) : null;
            const fullDmg = fullResult.totalDamage || 0;
            const reducedDmg = tempReducedResult ? (tempReducedResult.totalDamage || 0) : 0;

            // played 的 idx 对应 buildPlayedArray 中的顺序，需映射回 cardsToResolve 的索引
            const playedToResolveIndex = [];
            for (let i = 0; i < cardsToResolve.length; i++) {
              const card = CARDS_DB[cardsToResolve[i]];
              if (card && this.game.isProfessionActive(card.profession || "common")) {
                playedToResolveIndex.push(i);
              }
            }
            const playedContainer = document.getElementById("played-container");
            const targetEls = picked
              .map((p) => {
                const resolveIdx = playedToResolveIndex[p.idx];
                if (resolveIdx == null || !playedContainer) return null;
                return playedContainer.querySelector(`.card[data-played-index="${resolveIdx}"]`);
              })
              .filter(Boolean);

            this.game.log(`💣 ${this.enemy.name} 破坏了你的牌型：强制移除 ${removedNames.join("、")}，组合被打乱！`, "enemy");

            // 播放完整动画序列（技能文字 → 闪电 → 牌碎裂 → 伤害滚动）
            // 裂隙打手「地块觉醒」全屏视频改在 runTriRegionTerrainRevealScene 播放，此处不再绑破坏牌型
            if (this.game.effects && typeof this.game.effects.bossShatterSequence === "function") {
              await this.game.effects.bossShatterSequence({
                bossName: this.enemy.name,
                cardElements: targetEls,
                cardNames: removedNames,
                fullDamage: fullDmg,
                reducedDamage: reducedDmg,
                introVideoSrc: null,
                introVideoSfxSrc: null,
              });
            }

            // 动画结束后再更新数据和 UI（出牌区移除被破坏的牌）
            cardsToResolve = tempCardsToResolve;
            this.playedCards = cardsToResolve;
            this.playedSlots = newPlayedSlots;
            played = tempPlayed;
            reducedResult = tempReducedResult || fullResult;
            if (typeof this.game.renderPlayedArea === "function") {
              this.game.renderPlayedArea(this.playedCards);
            }
            if (typeof this.game.updatePlayedCount === "function") {
              this.game.updatePlayedCount();
            }

            if (fullDmg > reducedDmg) {
              this.game.log(`✂ 组合被压制：原本预计伤害 ${fullDmg}，被打断后仅剩 ${reducedDmg}（-${fullDmg - reducedDmg}）`, "system");
            }
            if (shatterSelfDamage > 0) {
              this.game.log(`⚠ 反噬：被破坏牌的能量反噬，我方承受 ${shatterSelfDamage} 点伤害`, "enemy");
            }
          }
        } catch (_) {
          reducedResult = fullResult;
          shatterSelfDamage = 0;
        }
      }

      // “破坏牌型”每回合只触发一次：结算后清掉标记，等待 Boss 下次随机选择
      if (this.enemy && this.enemy.aiType === "boss1" && this.enemy.boss1Skill === "shatter") {
        this.enemy.boss1Skill = null;
        // 本回合牌型已经被破坏，头像下方的“机制：破坏牌型”提示不应继续保留
        try {
          if (typeof this.game.updateEnemyDebuffsAndIntent === "function") {
            // 只移除文案中的“ | 机制：xxx”部分，保留原本的伤害意图
            if (typeof this.enemy.intentText === "string" && this.enemy.intentText.includes("机制：")) {
              this.enemy.intentText = this.enemy.intentText.replace(/\s*\|\s*机制：.*$/, "");
            }
            this.game.updateEnemyDebuffsAndIntent();
          }
        } catch (_) {}
      }

      // 精英怪：频次降低为“2 回合 1 次”
      // - CD 含义：>0 表示还在冷却（本回合不触发），每个敌方回合结束 -1
      // - 触发后设为 1 → 下个敌方回合减到 0 → 再下个玩家回合才会触发（约等于每 2 回合 1 次）
      if (this.enemy && (this.enemy.aiType === "elite1_shatter" || this.enemy.aiType === "elite_tri_region_gate")) {
        if (typeof this.enemy.eliteShatterCD !== "number") this.enemy.eliteShatterCD = 0;
        if (shatterActive) {
          // 无尽模式：层数越高，精英技能触发越频繁（更短冷却）
          const stage = this.enemy.endlessStage || 1;
          this.enemy.eliteShatterCD = stage >= 8 ? 0 : 1;
        }
      }

      const result = reducedResult || fullResult;

      // 护甲：减免本回合伤害（尤其用于第4层 Boss）
      const armor = this.enemy.armor || 0;
      let raw = result.totalDamage;
      try {
        const eb = this.game && this.game._eventRunDamageBuff;
        if (eb && eb > 1) {
          raw = Math.max(0, Math.floor(raw * eb));
          if (!this.game._eventBuffTipShown) {
            this.game._eventBuffTipShown = true;
            this.game.log(`☕ 事件增益：本战伤害 ×${eb}`, "combo");
          }
        }
      } catch (_) {}
      try {
        const nextBuff = this.game && this.game._battleNextTurnDamageBuff;
        if (nextBuff && nextBuff > 1) {
          raw = Math.max(0, Math.floor(raw * nextBuff));
          this.game.log(`⬆️ 蓄力生效：本回合伤害 ×${nextBuff}`, "combo");
          this.game._battleNextTurnDamageBuff = 1;
        }
      } catch (_) {}
      const vuln = Math.max(0, Math.floor(this.enemy.vulnerable || 0));
      if (vuln > 0) {
        const mult = 1 + 0.25 * vuln;
        raw = Math.max(0, Math.floor(raw * mult));
        this.game.log(`易伤：伤害 ×${mult}（${vuln} 层）`, "combo");
      }
      const dealt = Math.max(0, raw - armor);
      if (armor > 0) {
        this.game.log(`🛡️ ${this.enemy.name} 护甲减免 ${armor}，实际受到 ${dealt} 伤害`, "system");
      }
      const beforeHp = this.enemy.hp;
      this.enemy.hp -= dealt;
      this.damageThisTurn = dealt;

      // 新规则：每次敌人受到伤害后，易伤值再叠加一次
      if (dealt > 0) {
        const inc = Math.max(0, Math.floor(this.enemy.vulnerableOnHit || 0));
        if (inc > 0) {
          this.enemy.vulnerable = (this.enemy.vulnerable || 0) + inc;
          try {
            if (typeof this.game.updateEnemyDebuffsAndIntent === "function") this.game.updateEnemyDebuffsAndIntent();
          } catch (_) {}
          this.game.log(`📉 易伤增长：+${inc}（当前 ${this.enemy.vulnerable}）`, "combo");
        }
      }
      try {
        if (dealt > 0 && this.game && typeof this.game.notifyPlayerDamageToEnemy === "function") {
          this.game.notifyPlayerDamageToEnemy(played);
        }
      } catch (_) {}
      try {
        if (this.game && typeof this.game.recordDamage === "function") this.game.recordDamage(dealt);
      } catch (_) {}

      this.game.log(result.summary, "combo");
      this.game.turnDamageCommitted = true;
      const comboInfo = {
        comboName: result.comboName,
        comboReason: result.comboReason,
        multiplier: result.multiplier,
        baseLine: result.baseLine,
        hiddenLines: result.hiddenLines,
        breakdownText: result.breakdownText,
        hiddenComboNames: (result.hiddenCombos || []).map(r => r.combo.name)
      };
      this.game.updateTurnDamage(dealt, result.baseDamage, result.finalMultiplier, true, comboInfo, result.codeComboDamage);
      // 我方伤害演出：先命中特效 + 数字，再平滑掉血（让玩家“感受到打击”）
      try {
        this.game.showDamageNumber(dealt, result.baseDamage, result.finalMultiplier);
      } catch (_) {}
      try { if (this.game.effects) this.game.effects.enemyHit(); } catch (_) {}
      try {
        if (window.playDamageEffect) window.playDamageEffect(dealt, result.finalMultiplier >= 3);
      } catch (_) {}
      try {
        // 更强的打击感：额外冲击波 + 更重的屏幕抖动
        const enemyEl = document.getElementById("enemy-section") || document.querySelector(".enemy-container");
        if (enemyEl && this.game && this.game.effects) {
          const rect = enemyEl.getBoundingClientRect();
          if (typeof this.game.effects.impact === "function") {
            this.game.effects.impact(rect.left + rect.width / 2, rect.top + rect.height / 2);
          }
          if (typeof this.game.effects.shake === "function") {
            this.game.effects.shake(true);
          }
        }
      } catch (_) {}
      try {
        if (this.game && typeof this.game.animateEnemyHP === "function") {
          // 掉血更慢，观感更强
          await new Promise((r) => setTimeout(r, 220));
          await this.game.animateEnemyHP(beforeHp, this.enemy.hp, 1300);
        } else {
          this.game.updateEnemyHP(this.enemy.hp);
          await new Promise((r) => setTimeout(r, 650));
        }
      } catch (_) {
        this.game.updateEnemyHP(this.enemy.hp);
      }
      // 让观感稍微停留一下
      await new Promise((r) => setTimeout(r, 450));

      // 裂隙觉醒：先播完本次伤害的命中与掉血，再弹出地块说明（避免「先弹窗、血条才动」）
      try {
        if (pendingTerrainReveal && this.game && typeof this.game.runTriRegionTerrainRevealScene === "function") {
          await this.game.runTriRegionTerrainRevealScene(this);
        }
      } catch (_) {}

      // Boss1 的“反噬伤害”：在我方回合结算时，同时对队伍造成伤害
      if (this.enemy && this.enemy.aiType === "boss1" && shatterSelfDamage > 0) {
        try {
          this.game.takeDamageAll(shatterSelfDamage, {});
        } catch (_) {}
      }

      // ===== 道具：雷霆之刃（打满出牌上限 → 追加雷击伤害）=====
      try {
        const items = (this.game && Array.isArray(this.game.items)) ? this.game.items : [];
        if (items.includes("thunder_blade")) {
          const limit = (this.game && typeof this.game.getPlayedLimit === "function") ? this.game.getPlayedLimit() : 5;
          const playedCount = cardsToResolve.length;
          const eff = (typeof ITEMS_DB !== "undefined" && ITEMS_DB.thunder_blade && ITEMS_DB.thunder_blade.effect)
            ? ITEMS_DB.thunder_blade.effect({ cardsPlayed: playedCount, playedLimit: limit })
            : { thunderStrike: playedCount >= limit };
          if (eff && eff.thunderStrike) {
            // 追加伤害（百分比版）：对敌人当前生命造成 25% 伤害（至少 12），无视护甲（清场感）
            const curHp = Math.max(0, this.enemy.hp || 0);
            const strike = Math.max(12, Math.floor(curHp * 0.25));
            this.enemy.hp -= strike;
            this.damageThisTurn += strike;
            try {
              if (strike > 0 && this.game && typeof this.game.flashEnemySpriteHit === "function") {
                this.game.flashEnemySpriteHit();
              }
            } catch (_) {}
            if (this.game && typeof this.game.recordDamage === "function") this.game.recordDamage(this.damageThisTurn);
            this.game.log(`⚡ 雷霆之刃触发：雷击追加 ${strike} 伤害（敌人当前生命 25%，打满出牌上限 ${playedCount}/${limit}）`, "combo");
            try { this.game.showDamageNumber(strike, strike, 1.0); } catch (_) {}
            this.game.updateEnemyHP(this.enemy.hp);
            if (this.enemy.hp <= 0) {
              this.victory();
              return;
            }
          }
        }
      } catch (_) {}
      
      // 播放战斗/组合技特效（防御性包一层，避免特效异常卡死战斗流程）
      try {
        if (window.playDamageEffect && this.game.effects) {
          const isCrit = result.finalMultiplier >= 3;
          window.playDamageEffect(result.totalDamage, isCrit);
          
          if (result.hiddenCombos && result.hiddenCombos.length > 0) {
            const comboEl = document.getElementById("combo-type-area") || document.querySelector(".damage-formula-box");
            if (comboEl && this.game.effects.comboTrigger) {
              this.game.effects.comboTrigger(comboEl);
            }
          }
        }
      } catch (e) {
        console.warn("Battle FX error:", e);
      }

      // 检查并发现隐藏组合
      if (result.hiddenCombos && result.hiddenCombos.length > 0) {
        for (const comboResult of result.hiddenCombos) {
          if (comboResult.isNewlyDiscovered && this.game.discoverCombo) {
            this.game.discoverCombo(comboResult.combo.id);
            this.game.log(`🌟 发现隐藏组合：${comboResult.combo.name}！`, "combo");
          }
        }
      }

      if (this.enemy.hp <= 0) {
        this.victory();
        return;
      }

      // 收集本回合打出的牌的「过牌」「回收」「debuff」效果（卡牌等级 Lv1=1.0 / Lv2=1.5 / Lv3=2.0 倍）
      let totalDraw = 0;
      let totalRetrieve = 0;
      let cleanse = 0;
      let bleed = 0;
      let stealGold = 0;
      const debuffs = { stun: 0, slow: 0, weakness: 0, blind: 0, vulnerable: 0, vulnerableOnHit: 0 };
      let nextTurnDamageMult = 1;
      for (let i = 0; i < cardsToResolve.length; i++) {
        const cardId = cardsToResolve[i];
        const card = CARDS_DB[cardId];
        if (!card || !this.game.isProfessionActive(card.profession || "common")) continue;
        const level = typeof this.game.getCardLevel === "function" ? this.game.getCardLevel(cardId) : 1;
        const levelMult = 1 + (level - 1) * 0.5;
        const slotIdxCtrl = Array.isArray(this.playedSlots) && this.playedSlots[i] != null ? this.playedSlots[i] : i;
        // 裂隙地块现为迟缓/低温，不再提供「控制位 +1 回合」加成
        const ctrlExtra = 0;
        const controlTurns = (baseTurns) => Math.max(1, Math.floor((baseTurns || 1) * levelMult));
        let draw = 0;
        if (card.draw) draw += Math.max(0, Math.floor((card.draw || 0) * levelMult));
        if (card.discardAndDraw) draw += Math.max(0, Math.floor((card.discardAndDraw || 0) * levelMult));
        // 功能饮料：每有 1 个道具，本回合每打出 1 张程序员卡，下回合额外 +1 抽
        if (card.profession === "coder" && this.game && Array.isArray(this.game.items)) {
          const drinkCount = this.game.items.filter((id) => id === "energy_drink").length;
          if (drinkCount > 0) draw += drinkCount;
        }
        totalDraw += draw;
        if (card.retrieve) totalRetrieve += Math.max(0, Math.floor((card.retrieve || 0) * levelMult));
        if (card.cleanse) cleanse = Math.max(cleanse, Math.floor((card.cleanse || 0) * levelMult));
        if (card.steal) stealGold += Math.max(0, Math.floor((card.steal || 0) * levelMult));
        if (card.bleed) {
          // 组合拳等：流血叠加；可被道具进一步提升；等级提升基础流血量
          let add = Math.max(0, Math.floor((card.bleed || 0) * levelMult));
          if (ctrlExtra) add += 1; // 控制位：持续/层数 +1（DoT）
          try {
            if (typeof ItemUtil !== "undefined" && this.game && Array.isArray(this.game.items)) {
              const eff = ItemUtil.calculateEffects(this.game.items, { cardProfession: card.profession, cardId: card.id }) || {};
              if (typeof eff.bleedBonus === "number") add += Math.max(0, Math.floor(eff.bleedBonus));
            }
          } catch (_) {}
          bleed += add;
        }
        if (card.stun) debuffs.stun = Math.max(debuffs.stun, controlTurns(1) + ctrlExtra);
        if (card.slow) debuffs.slow = Math.max(debuffs.slow, controlTurns(card.slow) + ctrlExtra);
        if (card.weakness) debuffs.weakness = Math.max(debuffs.weakness, controlTurns(card.weakness) + ctrlExtra);
        if (card.blind) debuffs.blind = Math.max(debuffs.blind, controlTurns(1) + ctrlExtra);
        if (card.vulnerable) {
          // 新规则：易伤 +N 表示“每次敌人受到伤害后，易伤值再 +N（本场战斗持续叠加）”
          const add = Math.max(0, Math.floor((card.vulnerable || 0) * levelMult));
          if (add > 0) {
            debuffs.vulnerable += add; // 立即增加易伤值
            debuffs.vulnerableOnHit += add; // 之后每次受伤再增加相同增量
          }
        }
        if (card.nextTurnDamageBuff && typeof card.nextTurnDamageBuff === "number" && card.nextTurnDamageBuff > 1) {
          nextTurnDamageMult = Math.max(nextTurnDamageMult, card.nextTurnDamageBuff);
        }
      }
      if (nextTurnDamageMult > 1) {
        this.game._battleNextTurnDamageBuff = Math.max(this.game._battleNextTurnDamageBuff || 1, nextTurnDamageMult);
        this.game.log(`⬆️ 蓄力：下回合伤害 ×${nextTurnDamageMult}`, "system");
      }
      this.drawForNextTurn = totalDraw;
      if (totalDraw > 0) this.game.log(`过牌：下回合多抽 ${totalDraw} 张`, "system");

      // 捡回来：从弃牌堆取指定数量加入下回合手牌（取最近打出的，即弃牌堆末尾）
      if (totalRetrieve > 0 && this.discard.length > 0) {
        const take = Math.min(totalRetrieve, this.discard.length);
        const retrieved = this.discard.splice(-take, take).reverse();
        this.retrieveForNextTurn = retrieved;
        this.game.updateDeckInfo(this.deck.length, this.discard.length);
      }

      // 净化：减少我方负面层数（中毒/灼烧）
      if (cleanse > 0 && this.game && this.game.teammates) {
        const profs = this.game.selectedProfessions || [];
        let anyChanged = false;
        profs.forEach((p) => {
          const t = this.game.teammates[p];
          if (!t || t.hp <= 0) return;
          const beforePoison = t.poison || 0;
          const beforeBurn = t.burn || 0;
          const nextPoison = Math.max(0, beforePoison - cleanse);
          const nextBurn = Math.max(0, beforeBurn - cleanse);
          let changedP = false;
          if (nextPoison !== beforePoison) {
            t.poison = nextPoison;
            changedP = true;
          }
          if (nextBurn !== beforeBurn) {
            t.burn = nextBurn;
            changedP = true;
          }
          if (changedP) {
            anyChanged = true;
            if (typeof this.game.updateTeammateStatus === "function") this.game.updateTeammateStatus(p);
          }
        });
        if (anyChanged) this.game.log(`🧼 净化：全队中毒/灼烧 -${cleanse}`, "system");
      }

      // Boss2 手牌中毒机制：若打出了“中毒手牌”，则我方中毒（除非本回合打出狗的守护牌）
      try {
        const playedIds = cardsToResolve || [];
        const hasGuard = playedIds.some((id) => {
          const c = CARDS_DB[id];
          return c && c.negateHandPoison;
        });
        const poisons = Array.isArray(this.playedCardPoisons) ? this.playedCardPoisons : [];
        let totalPoison = poisons.reduce((s, v) => s + (Number(v) || 0), 0);
        // 本回合打出净化牌（解毒）：本批手牌毒反噬不叠加，否则先 -6 再加十几层等于白打
        if (cleanse > 0) totalPoison = 0;
        if (totalPoison > 0) {
          if (hasGuard) {
            this.game.log(`🛡️ 守护气息：本回合中毒手牌的异常效果无效（免疫中毒 ${totalPoison}）`, "system");
          } else {
            this.game.addTeamStatus("poison", totalPoison);
            this.game.log(`☠️ 中毒手牌反噬：我方中毒 +${totalPoison}`, "enemy");
          }
        }
      } catch (_) {}

      // 应用 debuff 到敌人
      const isBoss = !!(this.enemy && (this.enemy.isBoss || (this.enemy.aiType && String(this.enemy.aiType).startsWith("boss"))));
      const controlBonus = (this.game && typeof this.game.getControlChanceBonusFromItems === "function")
        ? (this.game.getControlChanceBonusFromItems() || 0)
        : 0;
      const tryApplyControl = (kindLabel, turns = 1) => {
        const t = Math.max(0, Math.floor(turns || 0));
        if (!t) return false;
        // 小怪：基础 60% 命中；Boss：基础 20% 命中（80% 免控）
        const baseSuccess = isBoss ? 0.20 : 0.60;
        const success = Math.max(0.05, Math.min(0.95, baseSuccess + controlBonus));
        const ok = Math.random() < success;
        try {
          if (this.game && this.game.effects && typeof this.game.effects.controlPop === "function") {
            this.game.effects.controlPop({ kind: "stun", ok, isBoss, enemyName: this.enemy?.name });
          }
        } catch (_) {}
        if (!ok) this.game.log(`MISS：${kindLabel} 未生效`, "system");
        return ok;
      };

      if (debuffs.stun) {
        if (tryApplyControl("眩晕", debuffs.stun)) {
          this.enemy.stunned = (this.enemy.stunned || 0) + debuffs.stun;
          this.game.log(`眩晕：敌人下 ${debuffs.stun} 回合无法行动`, "system");
        }
      }
      if (debuffs.slow) {
        this.enemy.slow = Math.max(this.enemy.slow || 0, debuffs.slow);
        this.game.log(`减速：敌人攻击力降低，持续 ${debuffs.slow} 回合`, "system");
      }
      if (debuffs.weakness) {
        this.enemy.weakness = Math.max(this.enemy.weakness || 0, debuffs.weakness);
        this.game.log(`虚弱：敌人伤害 -50%，持续 ${debuffs.weakness} 回合`, "system");
      }
      if (debuffs.blind) {
        this.enemy.blind = Math.max(this.enemy.blind || 0, debuffs.blind);
        this.game.log(`致盲：敌人命中率下降，持续 ${debuffs.blind} 回合`, "system");
        try {
          if (this.game && this.game.effects && typeof this.game.effects.controlPop === "function") {
            this.game.effects.controlPop({ kind: "blind", ok: true, isBoss, enemyName: this.enemy?.name });
          }
        } catch (_) {}
        try {
          if (this.game && typeof this.game.showComboText === "function") {
            this.game.showComboText(`👁 致盲生效：命中率 -${20 * Math.max(1, Math.floor(debuffs.blind || 1))}%`);
          }
        } catch (_) {}
      }
      if (debuffs.vulnerable) {
        this.enemy.vulnerable = (this.enemy.vulnerable || 0) + debuffs.vulnerable;
        this.enemy.vulnerableOnHit = (this.enemy.vulnerableOnHit || 0) + (debuffs.vulnerableOnHit || debuffs.vulnerable);
        this.game.log(`易伤：易伤值 +${debuffs.vulnerable}，每次受到伤害后再 +${debuffs.vulnerableOnHit}（本场战斗叠加）`, "system");
      }
      if (stealGold > 0) {
        // 偷窃：直接增加金币（当前敌人没有独立金币池，所以按“掠夺”理解）
        this.game.gold = (this.game.gold || 0) + stealGold;
        try { if (typeof this.game.updateGoldDisplay === "function") this.game.updateGoldDisplay(); } catch (_) {}
        this.game.log(`💰 偷窃：获得 ${stealGold} 金币`, "player");
      }
      if (bleed > 0) {
        const mult = Math.max(1, Math.floor(result?.extraEffects?.bleedStackMultiplier || 1));
        const applied = bleed * mult;
        if (mult > 1) {
          this.game.log(`🩸 流血牌型命中：流血叠层 ×${mult}（${bleed} → ${applied}）`, "system");
        }
        this.enemy.bleed = (this.enemy.bleed || 0) + applied;
        this.game.log(`🩸 流血：敌人流血 +${applied}（每回合结算并衰减）`, "system");
      }
      // 程序员代码牌组合的眩晕
      if (result.codeComboStun) {
        if (tryApplyControl("眩晕", 1)) {
          debuffs.stun = Math.max(debuffs.stun || 0, 1);
          this.enemy.stunned = (this.enemy.stunned || 0) + 1;
          this.game.log(`💻 代码组合：眩晕敌人 1 回合`, "system");
        }
      }
      // 跨职业组合技：额外眩晕（白名单触发）
      {
        const extra = Math.max(0, Math.floor(result?.extraEffects?.extraStunTurns || 0));
        if (extra > 0) {
          if (tryApplyControl("眩晕", extra)) {
            debuffs.stun = Math.max(debuffs.stun || 0, extra);
            this.enemy.stunned = (this.enemy.stunned || 0) + extra;
            this.game.log(`🤝 跨职业组合技：眩晕敌人 ${extra} 回合`, "system");
          }
        }
      }
      if (typeof this.game.updateEnemyDebuffsAndIntent === "function") {
        this.game.updateEnemyDebuffsAndIntent();
      }

      // 等出牌伤害/连击等演出略收尾后再进入敌方回合，避免敌方阶段与意图刷新抢在玩家动画前结束
      await new Promise((r) => setTimeout(r, 320));

      await this.endTurn();
    } catch (e) {
      console.error("playCards error:", e);
      this.game.log("结算时出现异常，本回合强制结束。", "system");
      await this.endTurn();
    }
  }

  // 执行单张卡牌
  executeCard(cardId, profession) {
    // 单张执行逻辑已由牌型系统统一处理，这里暂时保留空壳以备后续扩展
    return;
  }

  // 结束回合：仅将出牌区的牌进弃牌堆，手牌保留
  async endTurn() {
    if (this.playedCards.length) {
      this.discard.push(...this.playedCards);
      this.playedCards = [];
      this.playedSlots = [];
    }
    try {
      if (this.game && typeof this.game.clearPendingPlaySlot === "function") {
        this.game.clearPendingPlaySlot();
      }
    } catch (_) {}

    // 每回合结束后触发职业技能（如流氓回合结束回 5 血）
    try {
      if (this.game && typeof this.game.triggerProfessionSkillsEndOfTurn === "function") {
        this.game.triggerProfessionSkillsEndOfTurn();
      }
    } catch (_) {}

    await this.enemyTurn();

    this.turn++;
    // 结束回合的停顿更明显（避免“太快看不清”）
    await new Promise((r) => setTimeout(r, 500));
    if (!this.game.gameEnded) this.startTurn();
  }

  // 从手牌打到出牌区（基础 5 张，可被道具提高）
  // targetSlotIndex：指定落入第几格（0 起）；仅当该格可用时成功。不传则按「第一个空位」自动填充。
  playCardToArea(handIndex, targetSlotIndex) {
    const slots = (this.game && typeof this.game.getPlayedSlotCount === "function") ? this.game.getPlayedSlotCount() : 5;
    const broken = (this.game && typeof this.game.getBrokenPlayedSlots === "function") ? this.game.getBrokenPlayedSlots() : new Set();
    // 可用槽位数 = 总槽位 - 烧毁槽位
    const limit = (this.game && typeof this.game.getPlayedLimit === "function") ? this.game.getPlayedLimit() : Math.max(1, slots - broken.size);
    if (this.playedCards.length >= limit) return false;
    if (handIndex < 0 || handIndex >= this.hand.length) return false;
    // 找一个“未被烧毁 && 未被占用”的槽位
    const used = new Set(this.playedSlots || []);
    let slotIdx = -1;
    if (typeof targetSlotIndex === "number" && Number.isFinite(targetSlotIndex)) {
      const t = Math.floor(targetSlotIndex);
      if (t >= 0 && t < slots && !(broken && broken.has && broken.has(t)) && !used.has(t)) {
        slotIdx = t;
      } else {
        return false;
      }
    } else {
      for (let i = 0; i < slots; i++) {
        if (broken && broken.has && broken.has(i)) continue;
        if (used.has(i)) continue;
        slotIdx = i;
        break;
      }
    }
    if (slotIdx < 0) return false;
    const cardId = this.hand.splice(handIndex, 1)[0];
    const poison = Array.isArray(this.handPoisons) ? (this.handPoisons.splice(handIndex, 1)[0] || 0) : 0;
    if (cardId) {
      this.playedCards.push(cardId);
      this.playedSlots.push(slotIdx);
      this.playedCardPoisons.push(poison);
    }
    return true;
  }

  /** 保证 playedSlots / playedCardPoisons 与 playedCards 等长，避免 swap 时只换了一半 */
  _ensurePlayedParallelArrays() {
    const n = this.playedCards.length;
    if (!Array.isArray(this.playedSlots)) this.playedSlots = [];
    let i = this.playedSlots.length;
    while (i < n) {
      this.playedSlots.push(i);
      i++;
    }
    if (this.playedSlots.length > n) this.playedSlots.length = n;
    if (!Array.isArray(this.playedCardPoisons)) this.playedCardPoisons = [];
    i = this.playedCardPoisons.length;
    while (i < n) {
      this.playedCardPoisons.push(0);
      i++;
    }
    if (this.playedCardPoisons.length > n) this.playedCardPoisons.length = n;
  }

  /**
   * 交换出牌区内两张牌（显式「暂存→互换」：顺序、槽位、中毒标记同步）
   */
  swapPlayedCardsAt(a, b) {
    if (a === b) return false;
    const n = this.playedCards.length;
    if (a < 0 || b < 0 || a >= n || b >= n) return false;
    this._ensurePlayedParallelArrays();
    const cA = this.playedCards[a];
    const cB = this.playedCards[b];
    this.playedCards[a] = cB;
    this.playedCards[b] = cA;
    const sA = this.playedSlots[a];
    const sB = this.playedSlots[b];
    this.playedSlots[a] = sB;
    this.playedSlots[b] = sA;
    if (this.playedCardPoisons.length === n) {
      const pA = this.playedCardPoisons[a];
      const pB = this.playedCardPoisons[b];
      this.playedCardPoisons[a] = pB;
      this.playedCardPoisons[b] = pA;
    }
    return true;
  }

  /**
   * 将一张已打出的牌移到目标槽位；若目标格已有牌则与占用者交换
   */
  movePlayedCardToSlot(playedIndex, targetSlotIndex) {
    const slots = this.game && typeof this.game.getPlayedSlotCount === "function" ? this.game.getPlayedSlotCount() : 5;
    const broken =
      this.game && typeof this.game.getBrokenPlayedSlots === "function" ? this.game.getBrokenPlayedSlots() : new Set();
    if (playedIndex < 0 || playedIndex >= this.playedCards.length) return false;
    const t = Math.floor(targetSlotIndex);
    if (!Number.isFinite(t) || t < 0 || t >= slots) return false;
    if (broken && broken.has && broken.has(t)) return false;
    this._ensurePlayedParallelArrays();
    const occupiedBy = this.playedSlots.findIndex((s, i) => i !== playedIndex && s === t);
    if (occupiedBy >= 0) {
      return this.swapPlayedCardsAt(playedIndex, occupiedBy);
    }
    if (this.playedSlots[playedIndex] === t) return false;
    this.playedSlots[playedIndex] = t;
    return true;
  }

  // 从出牌区收回手牌
  unplayCardFromArea(playedIndex) {
    if (playedIndex < 0 || playedIndex >= this.playedCards.length) return false;
    const cardId = this.playedCards.splice(playedIndex, 1)[0];
    if (Array.isArray(this.playedSlots)) this.playedSlots.splice(playedIndex, 1);
    const poison = Array.isArray(this.playedCardPoisons) ? (this.playedCardPoisons.splice(playedIndex, 1)[0] || 0) : 0;
    if (cardId) {
      this.hand.push(cardId);
      this.handPoisons.push(poison);
    }
    return true;
  }

  // Boss2：对手牌下毒（随机选 count 张，每张 +[min,max] 层，跨回合保留）
  poisonHandCards(count = 4, min = 1, max = 2) {
    const n = Math.max(0, Math.floor(count || 0));
    if (!n) return [];
    const L = this.hand.length;
    if (!L) return [];
    if (!Array.isArray(this.handPoisons) || this.handPoisons.length !== L) {
      this.handPoisons = Array.from({ length: L }, () => 0);
    }
    const indices = Array.from({ length: L }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, Math.min(n, L));
    const lo = Math.max(0, Math.floor(min || 0));
    const hi = Math.max(lo, Math.floor(max || 0));
    indices.forEach((i) => {
      const add = lo + Math.floor(Math.random() * (hi - lo + 1));
      this.handPoisons[i] = (this.handPoisons[i] || 0) + add;
    });
    return indices;
  }

  // 检查卡牌是否已分配
  isCardAssigned(index) {
    return false;
  }

  // 敌人回合
  async enemyTurn() {
    try {
      // 流血：回合开始结算一次，然后衰减
      if ((this.enemy.bleed || 0) > 0 && (this.enemy.hp || 0) > 0) {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const dmg = Math.max(1, Math.floor(this.enemy.bleed || 0));
        const fromHp = this.enemy.hp || 0;
        this.enemy.hp = Math.max(0, (this.enemy.hp || 0) - dmg);
        try {
          if (dmg > 0 && this.game && typeof this.game.flashEnemySpriteHit === "function") {
            this.game.flashEnemySpriteHit();
          }
        } catch (_) {}
        try {
          if (this.game && this.game.effects && typeof this.game.effects.showDamageNumber === "function") {
            const enemyEl = document.getElementById("enemy-section");
            const rect = enemyEl ? enemyEl.getBoundingClientRect() : null;
            const x = rect ? (rect.left + rect.width / 2) : (window.innerWidth / 2);
            const y = rect ? (rect.top + 12) : 80;
            this.game.effects.showDamageNumber(Math.floor(dmg), x, y, false, false);
          }
        } catch (_) {}
        if (this.game && typeof this.game.animateEnemyHP === "function") {
          await this.game.animateEnemyHP(fromHp, this.enemy.hp, 650);
        } else if (this.game && typeof this.game.updateEnemyHP === "function") {
          this.game.updateEnemyHP(this.enemy.hp);
        }
        this.enemy.bleed = Math.max(0, (this.enemy.bleed || 0) - 1);
        await wait(350);
        if ((this.enemy.hp || 0) <= 0) {
          this.game.onBattleResult(true);
          return;
        }
      }

      // 眩晕：本回合跳过攻击
      if ((this.enemy.stunned || 0) > 0) {
        this.enemy.stunned--;
        // 眩晕跳过时，其它“持续 N 回合”的 debuff 也应正常衰减，
        // 否则会出现玩家连续空过/控住敌人时，减速/虚弱/致盲回合数不减少的情况。
        if ((this.enemy.slow || 0) > 0) this.enemy.slow--;
        if ((this.enemy.weakness || 0) > 0) this.enemy.weakness--;
        if ((this.enemy.blind || 0) > 0) this.enemy.blind--;
        // 被眩晕时：不触发本回合的随机机制技能（持续型效果已在别处结算）
        // boss_multi 也可能包含 boss1 的机制，因此这里要一并清掉。
        if (this.enemy) {
          const includesBoss1 =
            this.enemy.aiType === "boss1" ||
            (this.enemy.aiType === "boss_multi" && Array.isArray(this.enemy.bossSkills) && this.enemy.bossSkills.includes("boss1"));
          if (includesBoss1) this.enemy.boss1Skill = null;
        }
        this.game.log(`✨ ${this.enemy.name} 被眩晕，本回合无法行动`, "system");
        if (typeof this.game.updateEnemyDebuffsAndIntent === "function") {
          this.game.updateEnemyDebuffsAndIntent();
        }
        await new Promise((r) => setTimeout(r, 650));
        return;
      }

      let ai = this.enemy.aiType || "basic";
      const baseAtk = this.enemy.atk || 10;
      const applyDebuffMult = (dmg) => {
        let damage = dmg;
        if ((this.enemy.slow || 0) > 0) damage = Math.floor(damage * 0.6);   // 减速：攻击力 -40%
        if ((this.enemy.weakness || 0) > 0) damage = Math.floor(damage * 0.5); // 虚弱：伤害 -50%
        return Math.max(0, damage);
      };

      const actIndex = this.turn; // 敌人每回合行动一次，与回合数同步

      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const enemyAttack = async (damage, opts = {}) => {
        const dmg = applyDebuffMult(damage);
        try {
          if (dmg > 0 && this.game && typeof this.game.playEnemyAttackAnim === "function") {
            this.game.playEnemyAttackAnim(480);
          }
        } catch (_) {}
        const damageType = opts.damageType || (opts.aoe ? "spell" : "direct");
        const damageOpts = { damageType, ...(opts.damageOpts || {}) };
        // 致盲：降低命中率（每层 -20%），最低保留 5% 命中
        const blindStacks = Math.max(0, Math.floor(this.enemy.blind || 0));
        const hitChance = Math.max(0.05, 1 - 0.2 * blindStacks);
        if (opts.aoe) {
          this.game.log(`${this.enemy.name} 释放群攻，造成 ${dmg} 点伤害`, "enemy");
          if (window.audioManager) window.audioManager.enemyAttack();
          // 演出：锁定全队 → 射线 → 受击与数字
          const targets = (this.game.selectedProfessions || []).map((p) => document.getElementById(`slot-${p}`)).filter(Boolean);
          targets.forEach((el) => { try { el.classList.add("enemy-target"); } catch (_) {} });
          try {
            if (this.game.effects) {
              const c = damageType === "spell" ? "purple" : "red";
              const isBoss = String(this.enemy && this.enemy.aiType || "").startsWith("boss");
              // AOE 仍用更“范围”的效果；单体 boss 攻击会用更像“砸下去”的演出
              if (isBoss && this.game.effects.enemyAttackSmash) {
                await this.game.effects.enemyAttackSmash({ targetElements: targets, color: c });
              } else {
                await this.game.effects.enemyAttackBeams({ targetElements: targets, color: c });
              }
            }
          } catch (_) {}
          targets.forEach((el) => setTimeout(() => { try { el.classList.remove("enemy-target"); } catch (_) {} }, 600));
          // AOE：每个目标单独判定命中/闪避
          const professions =
            (Array.isArray(this.game.selectedProfessions) && this.game.selectedProfessions.length ? this.game.selectedProfessions : null) ||
            (this.game.teammates ? Object.keys(this.game.teammates) : []);
          for (const p of professions) {
            const t = this.game.teammates && this.game.teammates[p];
            if (!t || (t.hp || 0) <= 0) continue;
            const el = document.getElementById(`slot-${p}`);
            const ok = Math.random() < hitChance;
            if (ok) {
              this.game.takeDamage(dmg, { ...damageOpts, targetProfession: p });
              try {
                if (el && this.game.effects) {
                  const rect = el.getBoundingClientRect();
                  this.game.effects.showDamageNumber(Math.floor(dmg), rect.left + rect.width / 2, rect.top + 10, false, false);
                }
              } catch (_) {}
            } else {
              this.game.log(`MISS：${this.enemy.name} 的攻击被闪避（致盲）`, "system");
              try {
                if (el && this.game.effects) {
                  const rect = el.getBoundingClientRect();
                  this.game.effects.showDamageNumber(0, rect.left + rect.width / 2, rect.top + 10, false, false);
                  // 用 0 伤害数字不够直观：用中心提示补一下
                  if (typeof this.game.showComboText === "function") this.game.showComboText("MISS");
                }
              } catch (_) {}
            }
          }
          await wait(900);
        } else {
          this.game.log(`${this.enemy.name} 造成 ${dmg} 点伤害`, "enemy");
          if (window.audioManager) window.audioManager.enemyAttack();
          const professions =
            (Array.isArray(this.game.selectedProfessions) && this.game.selectedProfessions.length ? this.game.selectedProfessions : null) ||
            (this.game.teammates ? Object.keys(this.game.teammates) : []);
          const alive = professions.filter((p) => {
            const t = this.game.teammates && this.game.teammates[p];
            return t && typeof t.hp === "number" && t.hp > 0;
          });
          const target = alive.length ? alive[Math.floor(Math.random() * alive.length)] : null;
          const el = target ? document.getElementById(`slot-${target}`) : null;
          if (el) el.classList.add("enemy-target");
          try {
            if (this.game.effects) {
              const c = damageType === "spell" ? "purple" : "red";
              const isBoss = String(this.enemy && this.enemy.aiType || "").startsWith("boss");
              if (isBoss && damageType === "direct" && this.game.effects.enemyAttackSlam) {
                await this.game.effects.enemyAttackSlam({ targetElements: el ? [el] : [], color: c });
              } else if (isBoss && this.game.effects.enemyAttackSmash) {
                await this.game.effects.enemyAttackSmash({ targetElements: el ? [el] : [], color: c });
              } else {
                await this.game.effects.enemyAttackBeams({ targetElements: el ? [el] : [], color: c });
              }
            }
          } catch (_) {}
          const ok = Math.random() < hitChance;
          if (ok) {
            this.game.takeDamage(dmg, damageOpts);
            try {
              if (el && this.game.effects) {
                const rect = el.getBoundingClientRect();
                this.game.effects.showDamageNumber(Math.floor(dmg), rect.left + rect.width / 2, rect.top + 10, false, false);
              }
            } catch (_) {}
          } else {
            this.game.log(`MISS：${this.enemy.name} 的攻击被闪避（致盲）`, "system");
            try {
              if (el && this.game.effects) {
                const rect = el.getBoundingClientRect();
                this.game.effects.showDamageNumber(0, rect.left + rect.width / 2, rect.top + 10, false, false);
                if (typeof this.game.showComboText === "function") this.game.showComboText("MISS");
              }
            } catch (_) {}
          }
          try {
            // 伤害数字已在命中判定处展示
          } catch (_) {}
          if (el) setTimeout(() => { try { el.classList.remove("enemy-target"); } catch (_) {} }, 650);
          await wait(900);
        }
      };

      // boss_multi：根据关数决定是否触发其中某个 Boss 技能
      if (ai === "boss_multi") {
        const stage = this.enemy.endlessStage || (this.game && this.game.endlessStage) || 1;
        const skills = Array.isArray(this.enemy.bossSkills) ? this.enemy.bossSkills : [];
        const triggerChance = Math.min(0.95, 0.35 + (stage - 1) * 0.04); // stage 越高，触发频率越高
        if (skills.length > 0 && Math.random() < triggerChance) {
          ai = skills[Math.floor(Math.random() * skills.length)];
        } else {
          ai = "basic";
        }
      }

      if (ai === "boss1") {
        // Boss1：机制技能不再“每回合必放”，改为【预告 → 下回合执行】并带冷却
        // - shatter：下个我方回合结算前破坏牌型（在 playCards 中触发）
        // - burnSlots：烧毁出牌区格子（持续 2 个我方回合开始）
        const mechLabel = (m) => (m === "shatter" ? "💣 破坏牌型" : m === "burnSlots" ? "🔥 点燃格子" : "");
        const pickMechanic = () => (Math.random() < 0.5 ? "shatter" : "burnSlots");

        // 初始化冷却（单位：敌方回合）
        if (typeof this.enemy.boss1MechCD !== "number") this.enemy.boss1MechCD = 0;
        if (!this.enemy.boss1NextMech && this.enemy.boss1MechCD > 0) this.enemy.boss1MechCD--;

        // 若已预告：本回合执行预告的机制
        if (this.enemy.boss1NextMech) {
          const chosen = this.enemy.boss1NextMech;
          this.enemy.boss1NextMech = null;
          // 执行后进入冷却：每 3 个敌方回合最多放 1 次机制
          this.enemy.boss1MechCD = 2;

          if (chosen === "shatter") {
            this.enemy.boss1Skill = "shatter";
            this.game.log(`💣 ${this.enemy.name} 出手：本回合将破坏你的牌型结算！`, "enemy");
            try {
              if (typeof this.game.showComboText === "function") {
                this.game.showComboText("Boss 技能：本回合结算前将破坏你的出牌组合", 3200);
              }
            } catch (_) {}
          } else if (chosen === "burnSlots") {
            const brokenCount = Math.random() < 0.75 ? 1 : 2; // 频率降低时，2格概率也降低
            let picked = [];
            try {
              if (this.game && typeof this.game.applyPlayedSlotBurn === "function") {
                picked = this.game.applyPlayedSlotBurn(brokenCount, 2) || [];
              }
            } catch (_) {}
            this.game.log(`🔥 ${this.enemy.name} 点燃出牌区：烧毁 ${brokenCount} 个格子（持续 2 回合）！`, "enemy");
            try { if (typeof this.game.showComboText === "function") this.game.showComboText(`🔥 Boss 技能：点燃格子（烧毁 ${brokenCount} 个，持续 2 回合）`); } catch (_) {}
            try {
              if (this.game.effects && typeof this.game.effects.bossBurnSlotsSequence === "function") {
                this.game.effects.bossBurnSlotsSequence({ bossName: this.enemy.name, slotIndices: picked, turns: 2 });
              }
            } catch (_) {}
          }
        } else if (this.enemy.boss1MechCD <= 0) {
          // 冷却结束：预告下一回合要放的机制
          this.enemy.boss1NextMech = pickMechanic();
          this.game.log(`⚠️ ${this.enemy.name} 蓄力中：下回合将使用 ${mechLabel(this.enemy.boss1NextMech)}！`, "enemy");
          try {
            if (typeof this.game.showComboText === "function") {
              this.game.showComboText(`⚠️ 蓄力预告：下回合 ${mechLabel(this.enemy.boss1NextMech)}`, 3200);
            }
          } catch (_) {}
        }

        if (actIndex % 2 === 0) {
          await enemyAttack(Math.floor(baseAtk * 0.75), { aoe: true, damageType: "spell" });
          this.enemy.intentText = `⚔️ 下回合：重击 (${applyDebuffMult(baseAtk)} 伤害)${this.enemy.boss1NextMech ? ` | 机制：${mechLabel(this.enemy.boss1NextMech)}` : ""}`;
        } else {
          await enemyAttack(baseAtk, { damageType: "direct" });
          this.enemy.intentText = `💥 下回合：群攻 (${applyDebuffMult(Math.floor(baseAtk * 0.75))} 伤害)${this.enemy.boss1NextMech ? ` | 机制：${mechLabel(this.enemy.boss1NextMech)}` : ""}`;
        }
      } else if (ai === "boss2_poison") {
        // 第2层 Boss：对手牌下毒（打出会反噬中毒；换牌丢弃则不触发）+ 自愈 + 攻击
        if (actIndex % 3 === 1) {
          const picked = this.poisonHandCards(4, 1, 2);
          this.game.log(`☠️ ${this.enemy.name} 对你的手牌下毒：${picked.length} 张手牌被污染（每张 1~2 层）`, "enemy");
          this.game.renderHand(this.hand);
          try {
            if (picked.length > 0 && typeof this.game.onBossHandPoisonApplied === "function") {
              this.game.onBossHandPoisonApplied(this.enemy.name, picked.length);
            }
          } catch (_) {}
          this.enemy.intentText = `🩹 下回合：回血 + 攻击`;
          await wait(900);
        } else if (actIndex % 3 === 2) {
          const heal = Math.max(10, Math.floor(this.enemy.maxHp * 0.08));
          this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + heal);
          this.game.updateEnemyHP(this.enemy.hp);
          this.game.log(`🩹 ${this.enemy.name} 回复 ${heal} 生命`, "enemy");
          await enemyAttack(Math.floor(baseAtk * 0.9));
          this.enemy.intentText = `☠️ 下回合：手牌下毒`;
        } else {
          await enemyAttack(Math.floor(baseAtk * 1.15));
          this.enemy.intentText = `☠️ 下回合：手牌下毒`;
        }
      } else if (ai === "boss3_crack") {
        // 第3层 Boss：每 3 次行动裂地（永久少 1 出牌格）+ 叠护甲 + 普攻，逼玩家速战
        if (typeof this.enemy.boss3CrackCounter !== "number") this.enemy.boss3CrackCounter = 0;
        this.enemy.boss3CrackCounter++;
        if (this.enemy.boss3CrackCounter >= 3) {
          this.enemy.boss3CrackCounter = 0;
          const floor = (this.game.map && this.game.map.floor) || 3;
          const shieldAdd = 12 + Math.max(0, floor) * 5;
          this.enemy.armor = Math.max(0, (this.enemy.armor || 0) + shieldAdd);
          const picked = this.game.applyPermanentPlayedSlotCrack(1);
          this.game.renderPlayedArea(this.playedCards);
          if (picked.length > 0) {
            this.game.log(`🌋 ${this.enemy.name} 裂地！1 格出牌区永久塌陷，护甲 +${shieldAdd}`, "enemy");
            if (this.game.effects && typeof this.game.effects.playedSlotCrackGround === "function") {
              await this.game.effects.playedSlotCrackGround({
                slotIndex: picked[0],
                bossName: this.enemy.name,
              });
            }
          } else {
            this.game.log(`🌋 ${this.enemy.name} 裂地！出牌区已无法再塌，护甲仍 +${shieldAdd}`, "enemy");
            if (this.game.effects && typeof this.game.effects.shake === "function") this.game.effects.shake(true);
            await wait(450);
          }
        }
        if (window.audioManager) window.audioManager.enemyAttack();
        await enemyAttack(Math.floor(baseAtk * 1.08));
        const left = 3 - (this.enemy.boss3CrackCounter || 0);
        this.enemy.intentText =
          left <= 1
            ? `🌋 下次 Boss 行动：裂地塌陷 + 护甲`
            : `⚔ 攻击 | 🌋 再过 ${left} 次 Boss 行动：裂地`;
      } else if (ai === "boss4_tank") {
        // 第4层 Boss：高护甲高攻击，护甲逐回合增强
        this.enemy.armor = (this.enemy.armor || 12) + 4;
        this.game.log(`🛡️ ${this.enemy.name} 护甲提升至 ${this.enemy.armor}`, "enemy");
        await enemyAttack(Math.floor(baseAtk * 1.2));
        this.enemy.intentText = `🛡️ 下回合：护甲提升 + 重击 (${applyDebuffMult(Math.floor(baseAtk * 1.2))} 伤害)`;
      } else if (ai === "boss5_control") {
        // 第5层 Boss：控制系（眩晕/群攻）
        if (actIndex % 3 === 1) {
          this.game.teamStunned = (this.game.teamStunned || 0) + 1;
          this.game.log(`✨ ${this.enemy.name} 释放眩晕：我方下回合无法出牌`, "enemy");
          this.enemy.intentText = `💥 下回合：群攻 (${applyDebuffMult(Math.floor(baseAtk * 0.85))} 伤害)`;
        } else if (actIndex % 3 === 2) {
          await enemyAttack(Math.floor(baseAtk * 0.85), { aoe: true, damageType: "spell" });
          this.enemy.intentText = `⚔️ 下回合：重击 (${applyDebuffMult(Math.floor(baseAtk * 1.25))} 伤害)`;
        } else {
          await enemyAttack(Math.floor(baseAtk * 1.25), { damageType: "direct" });
          this.enemy.intentText = `✨ 下回合：眩晕（我方无法出牌）`;
        }
      } else if (ai === "elite_tri_region_gate") {
        // 裂隙打手：地形「裂隙觉醒」改在玩家出牌造成伤害时（半血/击杀）触发，敌方回合仅普攻
        const ramp = 1 + Math.min(0.18, (actIndex - 1) * 0.03);
        const dmg = Math.floor(baseAtk * ramp);
        await enemyAttack(dmg);
        this.enemy.intentText = `⚔️ 下回合：攻击 (${applyDebuffMult(dmg)} 伤害)`;
      } else {
        // 普通怪：逐回合稍微变强，且偶尔双击
        const isElite = !!(this.enemy && this.enemy.isElite);
        const rampCap = isElite ? 0.18 : 0.25;
        const ramp = 1 + Math.min(rampCap, (actIndex - 1) * 0.03);
        const roll = Math.random();

        // 精英怪：降低双击/群攻的触发率与倍率，避免出现“单回合秒杀”
        const doubleChance = isElite ? 0.12 : 0.18;
        const aoeChance = isElite ? 0.20 : 0.28;
        const doubleMult = isElite ? 0.6 : 0.7;
        const aoeMult = isElite ? 0.55 : 0.65;

        if (roll < doubleChance) {
          await enemyAttack(Math.floor(baseAtk * doubleMult * ramp));
          await enemyAttack(Math.floor(baseAtk * doubleMult * ramp));
          this.enemy.intentText = `⚔️ 下回合：连击 (${applyDebuffMult(Math.floor(baseAtk * doubleMult * ramp))}×2)`;
        } else if (roll < aoeChance) {
          await enemyAttack(Math.floor(baseAtk * aoeMult * ramp), { aoe: true });
          this.enemy.intentText = `💥 下回合：群攻 (${applyDebuffMult(Math.floor(baseAtk * aoeMult * ramp))} 伤害)`;
        } else {
          await enemyAttack(Math.floor(baseAtk * ramp));
          this.enemy.intentText = `⚔️ 下回合：攻击 (${applyDebuffMult(Math.floor(baseAtk * ramp))} 伤害)`;
        }
      }

      // 敌人行动后 decay debuff 持续回合
      if ((this.enemy.slow || 0) > 0) this.enemy.slow--;
      if ((this.enemy.weakness || 0) > 0) this.enemy.weakness--;
      if ((this.enemy.blind || 0) > 0) this.enemy.blind--;

      // 精英破坏牌型：冷却递减（2 回合 1 次）
      if (this.enemy && (this.enemy.aiType === "elite1_shatter" || this.enemy.aiType === "elite_tri_region_gate")) {
        if (typeof this.enemy.eliteShatterCD !== "number") this.enemy.eliteShatterCD = 0;
        if (this.enemy.eliteShatterCD > 0) this.enemy.eliteShatterCD--;
      }

      // 敌方攻击动画与数字飘字结束后，再刷新为「下回合」意图（defer 仅延迟意图条，debuff 已立即更新）
      if (typeof this.game.updateEnemyDebuffsAndIntent === "function") {
        this.game.updateEnemyDebuffsAndIntent({ deferIntentMs: 820 });
      }
    } catch (e) {
      console.error("enemyTurn error:", e);
      this.game.log("敌人行动时出现异常，已跳过该次攻击。", "system");
    }
  }

  // 胜利
  victory() {
    this.game.log(`🎉 胜利！击败了 ${this.enemy.name}！`, "combo");
    
    // 播放胜利音效和特效
    if (window.audioManager) {
      window.audioManager.victory();
    }
    if (this.game.effects) {
      this.game.effects.victory();
    }
    
    setTimeout(() => {
      if (typeof this.game.onBattleResult === "function") {
        this.game.onBattleResult(true);
      } else {
        this.game.showModal("胜利！", `击败了 ${this.enemy.name}！`);
      }
    }, 500);
  }

  // 重置分配
  resetAssignment() {
    // 新规则下，重置仅重绘手牌并清除一次过牌机会
    this.hasMulligan = false;
    this.game.renderHand(this.hand);
    this.game.updateEnergy();
    this.game.updateComboDisplay();
  }
}

