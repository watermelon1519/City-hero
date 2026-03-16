// 特效管理器 - 打斗爽感特效
class EffectsManager {
  constructor(game) {
    this.game = game;
    this.particles = [];
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

  // 玩家受击
  playerHit(targetId) {
    const slot = document.getElementById(`slot-${targetId}`);
    if (slot) {
      slot.classList.remove("player-hit");
      void slot.offsetWidth;
      slot.classList.add("player-hit");
      setTimeout(() => slot.classList.remove("player-hit"), 300);
    }
    
    // 轻微抖动
    this.shake();
  }

  // 连击特效
  comboFlash(element) {
    if (!element) return;
    element.classList.remove("combo-flash");
    void element.offsetWidth;
    element.classList.add("combo-flash");
    setTimeout(() => element.classList.remove("combo-flash"), 300);
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
