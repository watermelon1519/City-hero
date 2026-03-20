// 特效管理器 - 打斗爽感特效
class EffectsManager {
  constructor(game) {
    this.game = game;
    this.particles = [];
  }

  // 控制提示：成功/未命中（敌人头上弹图标）
  controlPop(opts) {
    const { kind = "stun", ok = true } = opts || {};
    const enemyEl = document.getElementById("enemy-section");
    if (!enemyEl) return;

    const el = document.createElement("div");
    el.className = `control-pop ${ok ? "ok" : "miss"} ${kind}`;
    const icon =
      kind === "blind" ? "👁" :
      kind === "stun" ? "🌀" :
      kind === "weakness" ? "💔" :
      kind === "slow" ? "🐢" :
      "🌀";
    el.textContent = ok ? icon : "MISS";
    enemyEl.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // 屏幕抖动
  shake(heavy = false) {
    const container = document.querySelector(".container") || document.body;
    container.classList.remove("shake", "shake-heavy");
    void container.offsetWidth; // 强制重排
    container.classList.add(heavy ? "shake-heavy" : "shake");
    
    setTimeout(() => {
      container.classList.remove("shake", "shake-heavy");
    }, heavy ? 500 : 300);
  }

  // 屏幕裂痕特效
  crack(duration = 300) {
    let overlay = document.getElementById("screen-crack");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "screen-crack";
      overlay.className = "screen-crack";
      document.body.appendChild(overlay);
    }
    
    overlay.classList.add("show");
    setTimeout(() => {
      overlay.classList.remove("show");
    }, duration);
  }

  // 伤害数字飘动
  showDamageNumber(value, x, y, isCrit = false, isHeal = false) {
    const el = document.createElement("div");
    el.className = `damage-number ${isCrit ? 'crit' : ''} ${isHeal ? 'heal' : ''}`;
    el.textContent = isHeal ? `+${value}` : `-${value}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    
    setTimeout(() => el.remove(), 1000);
  }

  // 冲击波效果
  impact(x, y) {
    const el = document.createElement("div");
    el.className = "impact";
    el.style.position = "fixed";
    el.style.left = `${x - 30}px`;
    el.style.top = `${y - 30}px`;
    el.style.width = "60px";
    el.style.height = "60px";
    el.style.borderRadius = "50%";
    el.style.pointerEvents = "none";
    el.style.zIndex = "1000";
    document.body.appendChild(el);
    
    setTimeout(() => el.remove(), 400);
  }

  // 敌人受击
  enemyHit() {
    const enemyEl = document.getElementById("enemy-section") || document.querySelector(".enemy-container");
    if (enemyEl) {
      enemyEl.classList.remove("enemy-hit");
      void enemyEl.offsetWidth;
      enemyEl.classList.add("enemy-hit");
      setTimeout(() => enemyEl.classList.remove("enemy-hit"), 200);
    }
    
    // 同时抖动屏幕
    this.shake();
  }

  // 玩家受击（旧接口，保留兼容）
  playerHit(targetId) {
    this.playerDamageEffect(targetId, "direct");
  }

  // 按伤害类型播放队友受伤特效：direct=物理, spell=法术, poison=中毒, burn=灼烧
  playerDamageEffect(targetIdOrElement, damageType = "direct") {
    const slot = typeof targetIdOrElement === "string"
      ? document.getElementById(`slot-${targetIdOrElement}`)
      : targetIdOrElement;
    if (!slot) return;
    slot.classList.remove("damage-direct", "damage-spell", "damage-poison", "damage-burn");
    void slot.offsetWidth;
    const cls = "damage-" + (["direct", "spell", "poison", "burn"].includes(damageType) ? damageType : "direct");
    slot.classList.add(cls);
    setTimeout(() => slot.classList.remove(cls), 520);
    this.shake();
  }

  // 施加 debuff 时的小特效（毒/灼烧层数增加）
  playerDebuffEffect(targetId, kind = "poison") {
    const slot = document.getElementById(`slot-${targetId}`);
    if (!slot) return;
    slot.classList.remove("debuff-applied");
    void slot.offsetWidth;
    slot.classList.add("debuff-applied");
    setTimeout(() => slot.classList.remove("debuff-applied"), 320);
  }

  // 连击特效
  comboFlash(element) {
    if (!element) return;
    element.classList.remove("combo-flash");
    void element.offsetWidth;
    element.classList.add("combo-flash");
    setTimeout(() => element.classList.remove("combo-flash"), 300);
  }

  // 辅助：延时 Promise
  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * 全屏播放技能介绍视频（裂隙打手等）；结束后 resolve，失败或超时也会结束以免卡死
   * @param {string} src - 相对站点根路径，如 vedio/xxx.mp4
   * @param {{ maxMs?: number, muted?: boolean, sfxSrc?: string|null, sfxVolume?: number }} [videoOpts]
   *   - muted 默认 true：关闭 MP4 内整条音轨（含背景音乐；标准视频无法只关 BGM 保留同轨音效）
   *   - sfxSrc 可选：另存「仅技能音效」的音频文件（与视频同屏播放），用于保留音效而不带 BGM
   */
  async playBossIntroVideo(src, videoOpts = {}) {
    const maxMs = typeof videoOpts.maxMs === "number" && videoOpts.maxMs > 0 ? videoOpts.maxMs : 5500;
    if (!src || typeof document === "undefined") return;

    await new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "boss-intro-video-overlay";
      wrap.setAttribute("role", "dialog");
      wrap.setAttribute("aria-label", "技能演出");

      const video = document.createElement("video");
      video.className = "boss-intro-video";
      video.src = src;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.controls = false;
      // 默认静音：去掉 MP4 里混在一起的背景音乐（浏览器无法从单轨里只删 BGM）
      const muteVideo = videoOpts.muted !== false;
      video.defaultMuted = muteVideo;
      video.muted = muteVideo;
      video.volume = muteVideo ? 0 : 1;

      /** @type {HTMLAudioElement|null} */
      let sfx = null;
      const sfxSrc = videoOpts.sfxSrc || null;
      if (sfxSrc) {
        try {
          sfx = new Audio(sfxSrc);
          sfx.volume =
            typeof videoOpts.sfxVolume === "number" && videoOpts.sfxVolume >= 0 && videoOpts.sfxVolume <= 1
              ? videoOpts.sfxVolume
              : 1;
        } catch (_) {
          sfx = null;
        }
      }

      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "boss-intro-video-skip pixel-font";
      skip.textContent = "跳过";

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try {
          video.pause();
        } catch (_) {}
        try {
          if (sfx) {
            sfx.pause();
            sfx.currentTime = 0;
          }
        } catch (_) {}
        try {
          wrap.remove();
        } catch (_) {}
        resolve();
      };

      const timer = setTimeout(finish, maxMs);

      skip.addEventListener("click", (e) => {
        e.stopPropagation();
        clearTimeout(timer);
        finish();
      });
      wrap.addEventListener("click", (e) => {
        if (e.target === wrap) {
          clearTimeout(timer);
          finish();
        }
      });
      video.addEventListener("ended", () => {
        clearTimeout(timer);
        finish();
      });
      video.addEventListener("error", () => {
        clearTimeout(timer);
        finish();
      });

      wrap.appendChild(video);
      wrap.appendChild(skip);
      document.body.appendChild(wrap);

      let playStarted = false;
      const tryPlay = () => {
        if (playStarted) return;
        playStarted = true;
        const p = video.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            video.muted = true;
            video.volume = 0;
            return video.play().catch(() => {
              clearTimeout(timer);
              finish();
            });
          });
        }
        if (sfx) {
          try {
            sfx.currentTime = 0;
            const sp = sfx.play();
            if (sp && typeof sp.catch === "function") sp.catch(() => {});
          } catch (_) {}
        }
      };
      if (video.readyState >= 2) {
        tryPlay();
      } else {
        video.addEventListener("canplay", tryPlay, { once: true });
        video.addEventListener("loadeddata", tryPlay, { once: true });
      }
    });
  }

  // Boss 破坏牌型完整动画序列（返回 Promise）
  async bossShatterSequence(opts) {
    const {
      bossName = "Boss",
      cardElements = [],      // 要被破坏的 2 张牌的 DOM 元素
      cardNames = [],
      fullDamage = 0,
      reducedDamage = 0,
      introVideoSrc = null,   // 可选：全屏技能视频（裂隙打手地块觉醒已改在 game.runTriRegionTerrainRevealScene 播放）
      introVideoSfxSrc = null, // 可选：单独导出的技能音效（无 BGM），与 mp4 同步播放；无则视频默认静音
    } = opts || {};

    // 0. 可选：先播全屏技能视频，再接原有破坏牌型演出（裂隙打手地块视频见 game.runTriRegionTerrainRevealScene）
    if (introVideoSrc) {
      try {
        await this.playBossIntroVideo(introVideoSrc, {
          maxMs: 5500,
          muted: true,
          sfxSrc: introVideoSfxSrc || undefined,
        });
      } catch (_) {}
    }

    // 1. 屏幕中央显示 Boss 发动技能
    const overlay = document.createElement("div");
    overlay.className = "boss-skill-overlay";
    overlay.innerHTML = `
      <div class="skill-title">💣 ${bossName} 发动技能</div>
      <div class="skill-desc">破坏牌型：${cardNames.length ? cardNames.join("、") + " 被选中！" : "组合被打乱！"}</div>
    `;
    document.body.appendChild(overlay);
    await this.sleep(900);
    overlay.remove();

    // 2. 闪电从敌人指向 2 张牌
    const enemySection = document.getElementById("enemy-section");
    const enemyRect = enemySection ? enemySection.getBoundingClientRect() : { left: window.innerWidth / 2 - 60, top: 60, width: 120 };
    const fromX = enemyRect.left + enemyRect.width / 2;
    const fromY = enemyRect.top + enemyRect.height * 0.3;

    const lightningWrap = document.createElement("div");
    lightningWrap.className = "boss-lightning";
    document.body.appendChild(lightningWrap);

    for (const el of cardElements) {
      if (!el || !el.getBoundingClientRect) continue;
      const rect = el.getBoundingClientRect();
      const toX = rect.left + rect.width / 2;
      const toY = rect.top + rect.height / 2;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const line = document.createElement("div");
      line.className = "boss-lightning-line";
      line.style.width = `${len}px`;
      line.style.left = `${fromX}px`;
      line.style.top = `${fromY}px`;
      line.style.transform = `rotate(${angle}deg)`;
      lightningWrap.appendChild(line);
    }
    this.shake();
    await this.sleep(450);
    lightningWrap.remove();

    // 3. 2 张牌碎裂（慢）
    for (const el of cardElements) {
      if (el) el.classList.add("card-shattering");
    }
    await this.sleep(950);

    // 4. 滚动数字：预计伤害从 fullDamage 降到 reducedDamage（突出伤害降低）
    const turnEl = document.getElementById("turn-damage");
    const labelEl = document.getElementById("turn-damage-label");
    const boxEl = document.getElementById("battle-sidebar-damage-box");
    const origLabel = labelEl ? labelEl.textContent : "";
    if (turnEl && fullDamage > reducedDamage) {
      if (labelEl) labelEl.textContent = "预计伤害";
      const step = Math.max(1, Math.ceil((fullDamage - reducedDamage) / 10));
      let cur = fullDamage;
      while (cur > reducedDamage) {
        cur = Math.max(reducedDamage, cur - step);
        turnEl.textContent = `${cur} ↓ (原本 ${fullDamage})`;
        if (boxEl) boxEl.classList.add("damage-rolling");
        await this.sleep(90);
        if (boxEl) boxEl.classList.remove("damage-rolling");
      }
      turnEl.textContent = `${reducedDamage} ↓ (原本 ${fullDamage})`;
      if (boxEl) boxEl.classList.add("damage-rolling");
      await this.sleep(350);
      if (boxEl) boxEl.classList.remove("damage-rolling");
      if (labelEl) labelEl.textContent = origLabel;
    }
    await this.sleep(150);
  }

  // Boss1：点燃出牌区（提示 + 小爆燃）
  async bossBurnSlotsSequence(opts) {
    const { bossName = "Boss", slotIndices = [], turns = 2 } = opts || {};
    const overlay = document.createElement("div");
    overlay.className = "boss-skill-overlay";
    overlay.innerHTML = `
      <div class="skill-title">🔥 ${bossName} 发动技能</div>
      <div class="skill-desc">点燃出牌区：烧毁格子（持续 ${turns} 回合）</div>
    `;
    document.body.appendChild(overlay);
    this.shake();

    // 红橙射线：从敌人指向被烧毁的格子
    try {
      const enemySection = document.getElementById("enemy-section");
      const enemyRect = enemySection ? enemySection.getBoundingClientRect() : { left: window.innerWidth / 2 - 60, top: 60, width: 120, height: 120 };
      const fromX = enemyRect.left + enemyRect.width / 2;
      const fromY = enemyRect.top + enemyRect.height * 0.45;

      const beamWrap = document.createElement("div");
      beamWrap.className = "boss-fire-beam";
      document.body.appendChild(beamWrap);

      const targets = (slotIndices || []).map((idx) => {
        const el = document.querySelector(`.played-slot[data-slot-index="${idx}"]`);
        return el;
      }).filter(Boolean);

      for (const el of targets) {
        const rect = el.getBoundingClientRect();
        const toX = rect.left + rect.width / 2;
        const toY = rect.top + rect.height / 2;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const line = document.createElement("div");
        line.className = "boss-fire-beam-line";
        line.style.width = `${len}px`;
        line.style.left = `${fromX}px`;
        line.style.top = `${fromY}px`;
        line.style.transform = `rotate(${angle}deg)`;
        beamWrap.appendChild(line);

        // 终点火花粒子
        try {
          this.particles(toX, toY, 8, ["#ffb347", "#ff5a3d", "#ffd28a"][Math.floor(Math.random() * 3)]);
        } catch (_) {}
      }
      setTimeout(() => beamWrap.remove(), 700);
    } catch (_) {}

    const wrap = document.getElementById("played-area-wrap");
    if (wrap) {
      wrap.classList.remove("boss-fire-pop");
      void wrap.offsetWidth;
      wrap.classList.add("boss-fire-pop");
      setTimeout(() => wrap.classList.remove("boss-fire-pop"), 600);
    }

    await this.sleep(1350);
    overlay.remove();
  }

  /** 第3关 Boss：裂地 — 永久塌陷出牌格（视觉） */
  async playedSlotCrackGround(opts) {
    const { slotIndex = 0, bossName = "Boss" } = opts || {};
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const overlay = document.createElement("div");
    overlay.className = "boss-skill-overlay boss-crack-skill-overlay";
    overlay.innerHTML = `
      <div class="skill-title">🌋 ${bossName} · 裂地</div>
      <div class="skill-desc">出牌格永久塌陷（本场战斗，战后恢复）</div>
    `;
    document.body.appendChild(overlay);
    this.shake(true);
    try {
      this.crack(420);
    } catch (_) {}

    try {
      const enemySection = document.getElementById("enemy-section");
      const enemyRect = enemySection
        ? enemySection.getBoundingClientRect()
        : { left: window.innerWidth / 2 - 50, top: 70, width: 100, height: 100 };
      const fromX = enemyRect.left + enemyRect.width / 2;
      const fromY = enemyRect.top + enemyRect.height * 0.55;
      const slotEl = document.querySelector(`.played-slot[data-slot-index="${slotIndex}"]`);
      const beamWrap = document.createElement("div");
      beamWrap.className = "boss-crack-beam-layer";
      document.body.appendChild(beamWrap);
      if (slotEl) {
        const rect = slotEl.getBoundingClientRect();
        const toX = rect.left + rect.width / 2;
        const toY = rect.top + rect.height / 2;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        for (let i = 0; i < 3; i++) {
          const line = document.createElement("div");
          line.className = "boss-crack-beam-line";
          line.style.width = `${len}px`;
          line.style.left = `${fromX}px`;
          line.style.top = `${fromY + (i - 1) * 6}px`;
          line.style.transform = `rotate(${angle}deg)`;
          beamWrap.appendChild(line);
        }
        try {
          const dust = ["#78716c", "#57534e", "#a8a29e", "#44403c"];
          this.particles(toX, toY, 14, dust[Math.floor(Math.random() * dust.length)]);
        } catch (_) {}
      }
      await wait(520);
      beamWrap.remove();
    } catch (_) {}

    const slotEl2 = document.querySelector(`.played-slot[data-slot-index="${slotIndex}"]`);
    if (slotEl2) {
      slotEl2.classList.add("crack-ground-hit");
      await wait(1000);
      slotEl2.classList.remove("crack-ground-hit");
    }
    await wait(200);
    overlay.remove();
  }

  // 敌人攻击射线（从敌人指向目标）
  async enemyAttackBeams(opts) {
    const { targetElements = [], color = "red" } = opts || {};
    const enemySection = document.getElementById("enemy-section");
    if (!enemySection) return;
    const enemyRect = enemySection.getBoundingClientRect();
    const fromX = enemyRect.left + enemyRect.width * 0.35;
    const fromY = enemyRect.top + enemyRect.height * 0.55;

    const wrap = document.createElement("div");
    wrap.className = "enemy-attack-beam";
    document.body.appendChild(wrap);

    for (const el of targetElements) {
      if (!el || !el.getBoundingClientRect) continue;
      const rect = el.getBoundingClientRect();
      const toX = rect.left + rect.width / 2;
      const toY = rect.top + rect.height / 2;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // 1) 轻微抖动的“能量轨迹”（多条叠加更有质感）
      for (let i = 0; i < 2; i++) {
        const line = document.createElement("div");
        line.className = `enemy-attack-beam-line ${color}`;
        const jitter = (Math.random() - 0.5) * 10;
        line.style.width = `${len}px`;
        line.style.left = `${fromX}px`;
        line.style.top = `${fromY + jitter}px`;
        line.style.transform = `rotate(${angle}deg)`;
        wrap.appendChild(line);
      }

      // 命中特效：粒子 + 更明显的目标闪光（保留命中反馈，移除“扔球”）
      try { this.particles(toX, toY, 10, color === "purple" ? "#b87bff" : "#ff6b6b"); } catch (_) {}
      // 目标闪光：更明显地告诉玩家“打到谁”
      try {
        el.classList.remove("enemy-hit-flash");
        void el.offsetWidth;
        el.classList.add("enemy-hit-flash");
        setTimeout(() => { try { el.classList.remove("enemy-hit-flash"); } catch (_) {} }, 620);
      } catch (_) {}
    }
    this.shake(true);
    await this.sleep(1050);
    wrap.remove();
  }

  // Boss 重击/挥砍：比“能量球”更像近战打击（冲击波 + 斩击轨迹）
  async enemyAttackSmash(opts) {
    const { targetElements = [], color = "red" } = opts || {};
    const enemySection = document.getElementById("enemy-section");
    if (!enemySection) return;
    const enemyRect = enemySection.getBoundingClientRect();
    const fromX = enemyRect.left + enemyRect.width * 0.42;
    const fromY = enemyRect.top + enemyRect.height * 0.58;

    const wrap = document.createElement("div");
    wrap.className = "enemy-attack-smash";
    document.body.appendChild(wrap);

    for (const el of targetElements) {
      if (!el || !el.getBoundingClientRect) continue;
      const rect = el.getBoundingClientRect();
      const toX = rect.left + rect.width / 2;
      const toY = rect.top + rect.height / 2;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // 前摇：一道更粗的“斩击轨迹”（两条叠加更立体）
      for (let i = 0; i < 2; i++) {
        const swipe = document.createElement("div");
        swipe.className = `enemy-smash-swipe ${color}`;
        const jitter = (Math.random() - 0.5) * 14;
        swipe.style.left = `${toX}px`;
        swipe.style.top = `${toY + jitter}px`;
        swipe.style.transform = `translate(-50%, -50%) rotate(${angle + (i === 0 ? -12 : 12)}deg)`;
        wrap.appendChild(swipe);
      }

      // 命中：冲击波环 + 粒子
      const ring = document.createElement("div");
      ring.className = `enemy-smash-ring ${color}`;
      ring.style.left = `${toX}px`;
      ring.style.top = `${toY}px`;
      wrap.appendChild(ring);

      try { this.particles(toX, toY, 14, color === "purple" ? "#b87bff" : "#ffb347"); } catch (_) {}

      // 目标闪光（沿用现有 class）
      try {
        el.classList.remove("enemy-hit-flash");
        void el.offsetWidth;
        el.classList.add("enemy-hit-flash");
        setTimeout(() => { try { el.classList.remove("enemy-hit-flash"); } catch (_) {} }, 620);
      } catch (_) {}
    }

    this.shake(true);
    await this.sleep(980);
    wrap.remove();
  }

  // Boss 举起武器砸下：上举蓄力 → 砸向目标 → 冲击波
  async enemyAttackSlam(opts) {
    const { targetElements = [], color = "red" } = opts || {};
    const enemySection = document.getElementById("enemy-section");
    if (!enemySection) return;
    const enemyRect = enemySection.getBoundingClientRect();
    const fromX = enemyRect.left + enemyRect.width * 0.44;
    const fromY = enemyRect.top + enemyRect.height * 0.54;

    const wrap = document.createElement("div");
    wrap.className = "enemy-attack-slam";
    document.body.appendChild(wrap);

    for (const el of targetElements) {
      if (!el || !el.getBoundingClientRect) continue;
      const rect = el.getBoundingClientRect();
      const toX = rect.left + rect.width / 2;
      const toY = rect.top + rect.height / 2;
      const dx = toX - fromX;
      const dy = toY - fromY;

      // 武器：先上举再砸下（用 CSS 变量控制位移）
      const weapon = document.createElement("div");
      weapon.className = `enemy-slam-weapon ${color}`;
      weapon.style.left = `${fromX}px`;
      weapon.style.top = `${fromY}px`;
      weapon.style.setProperty("--tx", `${dx}px`);
      weapon.style.setProperty("--ty", `${dy}px`);
      wrap.appendChild(weapon);

      // 命中：冲击波环 + 粒子（延迟到“砸下”命中帧附近）
      setTimeout(() => {
        try {
          const ring = document.createElement("div");
          ring.className = `enemy-smash-ring ${color}`;
          ring.style.left = `${toX}px`;
          ring.style.top = `${toY}px`;
          wrap.appendChild(ring);
        } catch (_) {}
        try { this.particles(toX, toY, 16, color === "purple" ? "#b87bff" : "#ffb347"); } catch (_) {}
        try {
          el.classList.remove("enemy-hit-flash");
          void el.offsetWidth;
          el.classList.add("enemy-hit-flash");
          setTimeout(() => { try { el.classList.remove("enemy-hit-flash"); } catch (_) {} }, 620);
        } catch (_) {}
      }, 520);
    }

    // 更重的震屏节奏：命中时再抖一次
    this.shake(true);
    setTimeout(() => { try { this.shake(true); } catch (_) {} }, 520);
    await this.sleep(980);
    wrap.remove();
  }

  // 组合技触发特效
  comboTrigger(element) {
    if (!element) return;
    element.classList.remove("combo-trigger");
    void element.offsetWidth;
    element.classList.add("combo-trigger");
    
    // 大抖动 + 裂痕
    this.shake(true);
    this.crack(500);
    
    setTimeout(() => element.classList.remove("combo-trigger"), 500);
  }

  // 致命一击特效
  criticalHit() {
    const overlay = document.createElement("div");
    overlay.className = "critical-overlay";
    document.body.appendChild(overlay);
    
    this.shake(true);
    this.crack(400);
    
    setTimeout(() => overlay.remove(), 500);
  }

  // 粒子爆炸
  particles(x, y, count = 10, color = "#ffd700") {
    for (let i = 0; i < count; i++) {
      const particle = document.createElement("div");
      particle.className = "particle";
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.background = color;
      
      const angle = (Math.PI * 2 / count) * i;
      const distance = 50 + Math.random() * 50;
      particle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
      
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 600);
    }
  }

  // 胜利特效
  victory() {
    const battleView = document.getElementById("battle-view");
    if (battleView) {
      battleView.classList.add("victory-glow");
      
      // 在屏幕中央放烟花粒子
      const rect = battleView.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          this.particles(centerX + (Math.random() - 0.5) * 200, centerY + (Math.random() - 0.5) * 200, 15, 
            ['#ffd700', '#ff6b6b', '#4ecdc4', '#a855f7'][Math.floor(Math.random() * 4)]);
        }, i * 200);
      }
      
      setTimeout(() => battleView.classList.remove("victory-glow"), 3000);
    }
  }

  // 应用关卡主题
  applyFloorTheme(floorNum) {
    const floor = window.getCurrentFloor ? window.getCurrentFloor(floorNum) : null;
    if (!floor) return;
    
    document.body.className = `theme-${floor.theme || 'street'}`;
    document.body.style.setProperty('--floor-accent', floor.accentColor || '#e94560');
  }
}

// 全局特效函数（方便调用）
function playDamageEffect(value, isCrit = false, isHeal = false) {
  const enemySection = document.getElementById("enemy-section");
  if (enemySection && window.game && window.game.effects) {
    const rect = enemySection.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    window.game.effects.showDamageNumber(value, x, y, isCrit, isHeal);
    
    if (isCrit) {
      window.game.effects.criticalHit();
    } else {
      window.game.effects.enemyHit();
    }
  }
}

function playHealEffect(value, targetId) {
  if (window.game && window.game.effects) {
    const slot = document.getElementById(`slot-${targetId}`);
    if (slot) {
      const rect = slot.getBoundingClientRect();
      window.game.effects.showDamageNumber(value, rect.left + rect.width / 2, rect.top, false, true);
    }
  }
}

// 挂载到 window
if (typeof window !== "undefined") {
  window.EffectsManager = EffectsManager;
  window.playDamageEffect = playDamageEffect;
  window.playHealEffect = playHealEffect;
}
