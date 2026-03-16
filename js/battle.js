// 战斗系统（卡牌连击原型）
class BattleSystem {
  constructor(game) {
    this.game = game;
    this.enemy = null;
    this.turn = 1;
    this.energy = 0;      // 先保留字段，但当前规则不再使用能量
    this.maxEnergy = 0;
    this.hand = [];
    this.playedCards = []; // 本回合打出的牌（最多5张），结束回合时用此结算
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
    this.playedCards = [];
    this.discard = [];
    this.damageThisTurn = 0;
    this.hasMulligan = false;
    this.drawForNextTurn = 0;
    this.retrieveForNextTurn = [];

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
      // 回合开始：持续伤害（中毒/火焰等）
      if (typeof this.game.applyDotsAtStartOfTurn === "function") {
        this.game.applyDotsAtStartOfTurn();
      }

      this.energy = 0;
      this.damageThisTurn = 0;
      this.hasMulligan = false;
      if (typeof this.game.clearSelectedTarget === "function") {
        this.game.clearSelectedTarget();
      }
      if (typeof this.game.resetHealBindings === "function") {
        this.game.resetHealBindings();
      }

      // 手牌保留；出牌区在 endTurn 已清空并进入弃牌堆，此处无需再动

      // 回合开始：刷新道具带来的本回合临时加成（如骰子出牌上限+1）
      try {
        if (this.game && typeof this.game.refreshTurnItemBonuses === "function") {
          this.game.refreshTurnItemBonuses();
        }
      } catch (_) {}

      // 捡回来：上回合回收的牌直接加入手牌
      const retrieveCount = this.retrieveForNextTurn.length;
      if (retrieveCount > 0) {
        this.hand.push(...this.retrieveForNextTurn);
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
    }
    if (typeof this.game.updateDeckInfo === "function") {
      this.game.updateDeckInfo(this.deck.length, this.discard.length);
    }
  }

  // 过牌（每回合一次）：indices 为当前手牌索引数组
  mulligan(indices) {
    if (this.hasMulligan) {
      this.game.log("本回合已经过牌过一次了。", "system");
      return;
    }
    const unique = Array.from(new Set(indices)).filter(
      (i) => i >= 0 && i < this.hand.length
    );
    if (!unique.length) {
      this.game.log("没有选择要过掉的牌。", "system");
      return;
    }

    // 教学战斗：换牌结果固定可控（保证教学体验）
    try {
      if (this.game && this.game.tutorialBattleActive) {
        // 把选中的牌丢进弃牌堆
        unique.sort((a, b) => b - a);
        for (const idx of unique) {
          const [removed] = this.hand.splice(idx, 1);
          if (removed) this.discard.push(removed);
        }
        // 用固定池补回（不走抽牌）
        const pool = Array.isArray(this.game._tutorialSwapPool) ? this.game._tutorialSwapPool : ["attack", "attack", "block"];
        for (let i = 0; i < unique.length; i++) {
          this.hand.push(pool[i % pool.length]);
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
  playCards() {
    if (this.game.gameEnded) return;
    this.damageThisTurn = 0;

    try {
      const cardsToResolve = this.playedCards;

      for (let i = 0; i < cardsToResolve.length; i++) {
        const cardId = cardsToResolve[i];
        const card = CARDS_DB[cardId];
        if (!card) continue;

        if (card.heal && !card.healAll) {
          const ownerProf = card.profession || "common";
          if (!this.game.isProfessionActive(ownerProf)) continue;
          const targetProf = this.game.healTargets && this.game.healTargets[i] && this.game.healTargets[i].target;
          if (targetProf && this.game.isProfessionActive(targetProf)) {
            if (typeof this.game.healTarget === "function") {
              const level = typeof this.game.getCardLevel === "function" ? this.game.getCardLevel(cardId) : 1;
              const healMult = 1 + (level - 1) * 0.5;
              this.game.healTarget(targetProf, Math.floor((card.heal || 0) * healMult), card.name);
            }
          }
        }

        if (card.healAll) {
          if (typeof this.game.healAll === "function") {
            const level = typeof this.game.getCardLevel === "function" ? this.game.getCardLevel(cardId) : 1;
            const healMult = 1 + (level - 1) * 0.5;
            this.game.healAll(Math.floor((card.healAll || 0) * healMult), card.name);
          }
        }

        if (card.shield) {
          if (typeof this.game.addShield === "function") {
            this.game.addShield("warrior", card.shield, card.name);
          }
        }
      }

      const played = [];
      for (let i = 0; i < cardsToResolve.length; i++) {
        const cardId = cardsToResolve[i];
        const card = CARDS_DB[cardId];
        if (!card) continue;
        const profession = card.profession || "common";
        if (!this.game.isProfessionActive(profession)) continue;
        const level = typeof this.game.getCardLevel === "function" ? this.game.getCardLevel(cardId) : 1;
        const damageMult = 1 + (level - 1) * 0.5;
        played.push({
          id: cardId,
          profession,
          baseDamage: Math.floor((card.damage || 0) * damageMult),
        });
      }

      if (!played.length) {
        this.game.log("本回合未出牌或仅使用了治疗/护盾。", "system");
        this.endTurn();
        return;
      }

      // 传入游戏状态以检查隐藏组合
      const gameState = {
        discoveredCombos: this.game.discoveredCombos || []
      };
      const result = typeof evaluateCombo === "function" ? evaluateCombo(played, gameState) : null;
      if (!result) {
        this.game.log("结算失败：未找到牌型系统。", "system");
        this.endTurn();
        return;
      }

      // 护甲：减免本回合伤害（尤其用于第4层 Boss）
      const armor = this.enemy.armor || 0;
      const raw = result.totalDamage;
      const dealt = Math.max(0, raw - armor);
      if (armor > 0) {
        this.game.log(`🛡️ ${this.enemy.name} 护甲减免 ${armor}，实际受到 ${dealt} 伤害`, "system");
      }
      this.enemy.hp -= dealt;
      this.damageThisTurn = dealt;
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
      this.game.showDamageNumber(dealt, result.baseDamage, result.finalMultiplier);
      this.game.updateEnemyHP(this.enemy.hp);

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

      // 收集本回合打出的牌的「过牌」「回收」「debuff」效果
      let totalDraw = 0;
      let totalRetrieve = 0;
      const debuffs = { stun: 0, slow: 0, weakness: 0, blind: 0 };
      for (let i = 0; i < cardsToResolve.length; i++) {
        const card = CARDS_DB[cardsToResolve[i]];
        if (!card || !this.game.isProfessionActive(card.profession || "common")) continue;
        let draw = 0;
        if (card.draw) draw += card.draw;
        if (card.discardAndDraw) draw += card.discardAndDraw;
        // 功能饮料：每有 1 个道具，本回合每打出 1 张程序员卡，下回合额外 +1 抽
        if (card.profession === "coder" && this.game && Array.isArray(this.game.items)) {
          const drinkCount = this.game.items.filter((id) => id === "energy_drink").length;
          if (drinkCount > 0) draw += drinkCount;
        }
        totalDraw += draw;
        if (card.retrieve) totalRetrieve += card.retrieve;
        if (card.stun) debuffs.stun = Math.max(debuffs.stun, 1);
        if (card.slow) debuffs.slow = Math.max(debuffs.slow, card.slow);
        if (card.weakness) debuffs.weakness = Math.max(debuffs.weakness, card.weakness);
        if (card.blind) debuffs.blind = Math.max(debuffs.blind, 1);
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

      // 应用 debuff 到敌人
      if (debuffs.stun) {
        this.enemy.stunned = (this.enemy.stunned || 0) + debuffs.stun;
        this.game.log(`眩晕：敌人下 ${debuffs.stun} 回合无法行动`, "system");
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
      }
      // 程序员代码牌组合的眩晕
      if (result.codeComboStun) {
        debuffs.stun = Math.max(debuffs.stun || 0, 1);
        this.enemy.stunned = (this.enemy.stunned || 0) + 1;
        this.game.log(`💻 代码组合：眩晕敌人 1 回合`, "system");
      }
      if (typeof this.game.updateEnemyDebuffsAndIntent === "function") {
        this.game.updateEnemyDebuffsAndIntent();
      }

      this.endTurn();
    } catch (e) {
      console.error("playCards error:", e);
      this.game.log("结算时出现异常，本回合强制结束。", "system");
      this.endTurn();
    }
  }

  // 执行单张卡牌
  executeCard(cardId, profession) {
    // 单张执行逻辑已由牌型系统统一处理，这里暂时保留空壳以备后续扩展
    return;
  }

  // 结束回合：仅将出牌区的牌进弃牌堆，手牌保留
  endTurn() {
    if (this.playedCards.length) {
      this.discard.push(...this.playedCards);
      this.playedCards = [];
    }

    this.enemyTurn();

    this.turn++;
    setTimeout(() => {
      if (!this.game.gameEnded) this.startTurn();
    }, 150);
  }

  // 从手牌打到出牌区（基础 5 张，可被道具提高）
  playCardToArea(handIndex) {
    const limit = (this.game && typeof this.game.getPlayedLimit === "function") ? this.game.getPlayedLimit() : 5;
    if (this.playedCards.length >= limit) return false;
    if (handIndex < 0 || handIndex >= this.hand.length) return false;
    const cardId = this.hand.splice(handIndex, 1)[0];
    if (cardId) this.playedCards.push(cardId);
    return true;
  }

  // 从出牌区收回手牌
  unplayCardFromArea(playedIndex) {
    if (playedIndex < 0 || playedIndex >= this.playedCards.length) return false;
    const cardId = this.playedCards.splice(playedIndex, 1)[0];
    if (cardId) this.hand.push(cardId);
    return true;
  }

  // 检查卡牌是否已分配
  isCardAssigned(index) {
    return false;
  }

  // 敌人回合
  enemyTurn() {
    try {
      // 眩晕：本回合跳过攻击
      if ((this.enemy.stunned || 0) > 0) {
        this.enemy.stunned--;
        this.game.log(`✨ ${this.enemy.name} 被眩晕，本回合无法行动`, "system");
        if (typeof this.game.updateEnemyDebuffsAndIntent === "function") {
          this.game.updateEnemyDebuffsAndIntent();
        }
        return;
      }

      const ai = this.enemy.aiType || "basic";
      const baseAtk = this.enemy.atk || 10;
      const applyDebuffMult = (dmg) => {
        let damage = dmg;
        if ((this.enemy.slow || 0) > 0) damage = Math.floor(damage * 0.6);   // 减速：攻击力 -40%
        if ((this.enemy.weakness || 0) > 0) damage = Math.floor(damage * 0.5); // 虚弱：伤害 -50%
        if ((this.enemy.blind || 0) > 0) damage = Math.floor(damage * 0.7);   // 致盲：伤害 -30%
        return Math.max(0, damage);
      };

      const actIndex = this.turn; // 敌人每回合行动一次，与回合数同步

      const enemyAttack = (damage, opts = {}) => {
        const dmg = applyDebuffMult(damage);
        if (opts.aoe) {
          this.game.log(`${this.enemy.name} 释放群攻，造成 ${dmg} 点伤害`, "enemy");
          if (window.audioManager) window.audioManager.enemyAttack();
          this.game.takeDamageAll(dmg, opts.damageOpts || {});
        } else {
          this.game.log(`${this.enemy.name} 造成 ${dmg} 点伤害`, "enemy");
          if (window.audioManager) window.audioManager.enemyAttack();
          this.game.takeDamage(dmg);
        }
      };

      if (ai === "boss1") {
        // 第1层 Boss：普通攻击与群攻交替
        if (actIndex % 2 === 0) {
          enemyAttack(Math.floor(baseAtk * 0.75), { aoe: true });
          this.enemy.intentText = `⚔️ 下回合：重击 (${applyDebuffMult(baseAtk)} 伤害)`;
        } else {
          enemyAttack(baseAtk);
          this.enemy.intentText = `💥 下回合：群攻 (${applyDebuffMult(Math.floor(baseAtk * 0.75))} 伤害)`;
        }
      } else if (ai === "boss2_poison") {
        // 第2层 Boss：叠毒（无视护盾）+ 自愈 + 攻击
        if (actIndex % 3 === 1) {
          this.game.addTeamStatus("poison", 4);
          this.game.log(`☠️ ${this.enemy.name} 施加中毒 +4（无视护盾）`, "enemy");
          this.enemy.intentText = `🩹 下回合：回血 + 攻击`;
        } else if (actIndex % 3 === 2) {
          const heal = Math.max(10, Math.floor(this.enemy.maxHp * 0.08));
          this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + heal);
          this.game.updateEnemyHP(this.enemy.hp);
          this.game.log(`🩹 ${this.enemy.name} 回复 ${heal} 生命`, "enemy");
          enemyAttack(Math.floor(baseAtk * 0.9));
          this.enemy.intentText = `☠️ 下回合：中毒 +4`;
        } else {
          enemyAttack(Math.floor(baseAtk * 1.15));
          this.enemy.intentText = `☠️ 下回合：中毒 +4`;
        }
      } else if (ai === "boss3_fire") {
        // 第3层 Boss：火焰叠加（护盾减免50%）+ 火焰攻击
        if (actIndex % 2 === 1) {
          this.game.addTeamStatus("burn", 18);
          this.game.log(`🔥 ${this.enemy.name} 叠加火焰 +18（护盾减免 50%，每回合消耗 12 层）`, "enemy");
          this.enemy.intentText = `🔥 下回合：火焰攻击 (${applyDebuffMult(Math.floor(baseAtk * 0.9))} 伤害，护盾减免50%)`;
        } else {
          const dmg = Math.floor(baseAtk * 0.9);
          this.game.log(`${this.enemy.name} 释放火焰打击`, "enemy");
          if (window.audioManager) window.audioManager.enemyAttack();
          this.game.takeDamageAll(applyDebuffMult(dmg), { shieldFactor: 0.5 });
          this.enemy.intentText = `🔥 下回合：叠加火焰 +18`;
        }
      } else if (ai === "boss4_tank") {
        // 第4层 Boss：高护甲高攻击，护甲逐回合增强
        this.enemy.armor = (this.enemy.armor || 12) + 4;
        this.game.log(`🛡️ ${this.enemy.name} 护甲提升至 ${this.enemy.armor}`, "enemy");
        enemyAttack(Math.floor(baseAtk * 1.2));
        this.enemy.intentText = `🛡️ 下回合：护甲提升 + 重击 (${applyDebuffMult(Math.floor(baseAtk * 1.2))} 伤害)`;
      } else if (ai === "boss5_control") {
        // 第5层 Boss：控制系（眩晕/群攻）
        if (actIndex % 3 === 1) {
          this.game.teamStunned = (this.game.teamStunned || 0) + 1;
          this.game.log(`✨ ${this.enemy.name} 释放眩晕：我方下回合无法出牌`, "enemy");
          this.enemy.intentText = `💥 下回合：群攻 (${applyDebuffMult(Math.floor(baseAtk * 0.85))} 伤害)`;
        } else if (actIndex % 3 === 2) {
          enemyAttack(Math.floor(baseAtk * 0.85), { aoe: true });
          this.enemy.intentText = `⚔️ 下回合：重击 (${applyDebuffMult(Math.floor(baseAtk * 1.25))} 伤害)`;
        } else {
          enemyAttack(Math.floor(baseAtk * 1.25));
          this.enemy.intentText = `✨ 下回合：眩晕（我方无法出牌）`;
        }
      } else {
        // 普通怪：逐回合稍微变强，且偶尔双击
        const ramp = 1 + Math.min(0.25, (actIndex - 1) * 0.03);
        const roll = Math.random();
        if (roll < 0.18) {
          enemyAttack(Math.floor(baseAtk * 0.7 * ramp));
          enemyAttack(Math.floor(baseAtk * 0.7 * ramp));
          this.enemy.intentText = `⚔️ 下回合：连击 (${applyDebuffMult(Math.floor(baseAtk * 0.7 * ramp))}×2)`;
        } else if (roll < 0.28) {
          enemyAttack(Math.floor(baseAtk * 0.65 * ramp), { aoe: true });
          this.enemy.intentText = `💥 下回合：群攻 (${applyDebuffMult(Math.floor(baseAtk * 0.65 * ramp))} 伤害)`;
        } else {
          enemyAttack(Math.floor(baseAtk * ramp));
          this.enemy.intentText = `⚔️ 下回合：攻击 (${applyDebuffMult(Math.floor(baseAtk * ramp))} 伤害)`;
        }
      }

      // 敌人行动后 decay debuff 持续回合
      if ((this.enemy.slow || 0) > 0) this.enemy.slow--;
      if ((this.enemy.weakness || 0) > 0) this.enemy.weakness--;
      if ((this.enemy.blind || 0) > 0) this.enemy.blind--;

      if (typeof this.game.updateEnemyDebuffsAndIntent === "function") {
        this.game.updateEnemyDebuffsAndIntent();
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

