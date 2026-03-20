// ===== 无尽模式：波次/敌人生成器 =====
// 说明：
// - stage=1..N：每打完 6 波（1~5 普通/精英 + 6 Boss）算过一关
// - 精英概率随 stage 上升；若上一波是精英，则低层会更“抑制连续精英”，高层更容易连续出现

(() => {
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const BOSS_SKILL_POOL = ["boss1", "boss2_poison", "boss3_crack", "boss4_tank", "boss5_control"];

  const bossMeta = {
    boss1: { floorId: 1 },
    boss2_poison: { floorId: 2 },
    boss3_crack: { floorId: 3 },
    boss4_tank: { floorId: 4 },
    boss5_control: { floorId: 5 },
  };

  function getFloorConfig(stage) {
    try {
      if (typeof window !== "undefined" && typeof window.getCurrentFloor === "function") {
        return window.getCurrentFloor(stage);
      }
    } catch (_) {}
    return null;
  }

  function getBossConfigByStageSkill(skillAiType) {
    const meta = bossMeta[skillAiType] || { floorId: 5 };
    const floorId = meta.floorId;
    try {
      if (typeof window !== "undefined" && typeof window.getBoss === "function") {
        return window.getBoss(floorId);
      }
    } catch (_) {}
    return null;
  }

  // stage>=2 时惩罚上一波精英：低层惩罚更大；高层惩罚更小
  function calcEliteChance(stage, prevElite, difficulty) {
    const d = Math.max(1, Math.floor(difficulty || 1));
    // base 随 stage 上升（0.10 -> 0.45 左右）
    const base = clamp(0.10 + (stage - 1) * 0.06 + (d - 1) * 0.04, 0.06, 0.55);
    if (!prevElite) return base;

    // 低层(<=6)惩罚更强，高层更容易连精英
    const lowStagePenalty = clamp((6 - stage) / 5, 0, 1); // stage=2 -> 0.8, stage=6 -> 0
    const penaltyMultiplier = 1 - 0.70 * lowStagePenalty; // stage=2 -> 0.44
    return clamp(base * penaltyMultiplier, 0.02, base);
  }

  // 精英技能（目前复用 elite1_shatter，后续你加新精英机制时再扩展 pool）
  function pickEliteAiType(stage) {
    const p = clamp(0.35 + (stage - 1) * 0.05, 0.25, 0.85);
    return Math.random() < p ? "elite1_shatter" : "basic";
  }

  // weighted random（不放重复）
  function weightedPickDistinct(pool, weights, count) {
    const items = pool.map((id, idx) => ({ id, w: weights[idx] ?? 1 }));
    const out = [];
    const pickOne = () => {
      const total = items.reduce((s, it) => s + (it.w > 0 ? it.w : 0), 0);
      if (total <= 0) return items[Math.floor(Math.random() * items.length)]?.id;
      let r = Math.random() * total;
      for (const it of items) {
        const w = it.w > 0 ? it.w : 0;
        if (w === 0) continue;
        r -= w;
        if (r <= 0) return it.id;
      }
      return items[items.length - 1]?.id;
    };

    while (out.length < count && items.length > 0) {
      const id = pickOne();
      if (!id) break;
      out.push(id);
      // 移除该项，避免重复
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].id === id) items.splice(i, 1);
      }
    }
    return out;
  }

  function buildWaveEnemy(stage, wave, prevElite, difficulty) {
    const d = Math.max(1, Math.floor(difficulty || 1));
    const diffHpMult = 1 + (d - 1) * 0.20;  // 难度越高生命越厚
    const diffAtkMult = 1 + (d - 1) * 0.14; // 难度越高攻击越高

    const floor = getFloorConfig(stage) || { enemies: [{ id: "thug", name: "敌人", hp: 60, atk: 6, icon: "👤", gold: 15 }] };
    const enemies = floor.enemies || [];
    const template = enemies[Math.floor(Math.random() * Math.max(1, enemies.length))] || enemies[0] || { id: "enemy", name: "敌人", hp: 60, atk: 6, icon: "👤", gold: 15 };

    if (wave === 1) {
      return {
        id: template.id,
        name: template.name,
        icon: template.icon,
        hp: Math.floor(template.hp * diffHpMult),
        atk: Math.floor(template.atk * diffAtkMult),
        gold: template.gold || (15 + stage * 2),
        aiType: "basic",
        armor: template.armor || 0,
        endlessStage: stage,
        endlessDifficulty: difficulty,
      };
    }

    const eliteChance = calcEliteChance(stage, prevElite, difficulty);
    const isElite = Math.random() < eliteChance;
    if (!isElite) {
      return {
        id: template.id,
        name: template.name,
        icon: template.icon,
        hp: Math.floor(template.hp * diffHpMult),
        atk: Math.floor(template.atk * diffAtkMult),
        gold: template.gold || (15 + stage * 2),
        aiType: "basic",
        armor: template.armor || 0,
        endlessStage: stage,
        endlessDifficulty: difficulty,
      };
    }

    const hp = Math.floor((template.hp || 60) * 1.75 * diffHpMult);
    const atk = Math.floor((template.atk || 6) * 1.45 * diffAtkMult);
    const gold = 35 + stage * 6;
    return {
      id: template.id,
      name: `★${template.name}`,
      icon: template.icon,
      hp,
      atk,
      gold,
      aiType: "elite1_shatter",
      armor: template.armor || 0,
      isElite: true,
      endlessStage: stage,
      endlessDifficulty: difficulty,
    };
  }

  function buildBossEnemy(stage, difficulty) {
    // stage 1..5 技能固定映射
    const d = Math.max(1, Math.floor(difficulty || 1));
    const diffHpMult = 1 + (d - 1) * 0.25;
    const diffAtkMult = 1 + (d - 1) * 0.18;

    // 与 combat-rules.js 中 FLOORS[].boss.aiType 对齐；若战役 Boss 顺延改层数，须同步此处
    const bossSkillByStage = {
      1: "boss1",
      2: "boss2_poison",
      3: "boss3_crack",
      4: "boss4_tank",
      5: "boss5_control",
    };

    if (stage >= 1 && stage <= 5) {
      const skill = bossSkillByStage[stage];
      const cfg = getBossConfigByStageSkill(skill);
      return {
        id: cfg?.id || "boss",
        name: cfg?.name || "Boss",
        icon: cfg?.icon || "👑",
        hp: Math.floor((cfg?.hp || 420) * diffHpMult),
        atk: Math.floor((cfg?.atk || 12) * diffAtkMult),
        gold: 120 + stage * 10,
        aiType: skill,
        armor: cfg?.armor || 0,
        endlessStage: stage,
        endlessDifficulty: d,
      };
    }

    // stage>=6：随机选 2 个技能，stage>=10：选 3 个技能
    const count = stage >= 10 ? 3 : 2;

    // stage越高：对更“机制化”的 boss 技能权重略增（但先不做复杂权重表）
    const weights = BOSS_SKILL_POOL.map((_) => 1 + (stage - 1) * 0.03);
    const picked = weightedPickDistinct(BOSS_SKILL_POOL, weights, count);

    // boss 名称取第一个技能的 boss 配置，hp/atk 用平均/上取整
    const pickedMeta = picked.map((s) => getBossConfigByStageSkill(s)).filter(Boolean);
    const hpBase = Math.floor(
      pickedMeta.reduce((s, b) => s + (b.hp || 400), 0) / Math.max(1, pickedMeta.length)
    );
    const atkBase = Math.floor(
      pickedMeta.reduce((s, b) => s + (b.atk || 12), 0) / Math.max(1, pickedMeta.length)
    );
    const baseCfg = pickedMeta[0] || {};
    const bossName = baseCfg.name || "无尽Boss";

    return {
      id: `endless_boss_${stage}`,
      name: bossName,
      icon: baseCfg.icon || "👑",
      hp: Math.floor(hpBase * diffHpMult),
      atk: Math.floor(atkBase * diffAtkMult),
      gold: 160 + stage * 14,
      aiType: "boss_multi",
      armor: baseCfg.armor || 0,
      bossSkills: picked,
      endlessStage: stage,
      endlessDifficulty: d,
    };
  }

  // 浏览器环境挂载
  if (typeof window !== "undefined") {
    window.EndlessMode = {
      buildWaveEnemy,
      buildBossEnemy,
    };
  }
})();

