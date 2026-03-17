// 简易数据编辑器（仅设计者使用，不在正式入口暴露）

(function () {
  const state = {
    tab: "cards", // cards | items | roles
    cards: [],
    items: [],
    roles: [],
    selectedId: null,
  };

  function normalizeCards() {
    const out = [];
    if (typeof CARDS_DB !== "object") return out;
    Object.keys(CARDS_DB).forEach((id) => {
      const c = CARDS_DB[id];
      if (!c) return;
      out.push({
        id: c.id || id,
        name: c.name || "",
        icon: c.icon || "",
        type: c.type || "",
        profession: c.profession || "common",
        cost: c.cost ?? "",
        damage: c.damage ?? "",
        heal: c.heal ?? "",
        healAll: c.healAll ?? "",
        draw: c.draw ?? "",
        discardAndDraw: c.discardAndDraw ?? "",
        shield: c.shield ?? "",
        stun: c.stun ? 1 : 0,
        weakness: c.weakness ?? "",
        slow: c.slow ?? "",
        blind: c.blind ? 1 : 0,
        description: c.description || "",
        detail: c.detail || "",
      });
    });
    return out;
  }

  function normalizeItems() {
    const out = [];
    if (typeof ITEMS_DB !== "object") return out;
    Object.keys(ITEMS_DB).forEach((id) => {
      const it = ITEMS_DB[id];
      if (!it) return;
      out.push({
        id: it.id || id,
        name: it.name || "",
        icon: it.icon || "",
        type: it.type || "",
        profession: it.profession || "",
        rarity: it.rarity || "common",
        lockedByDefault: !!it.lockedByDefault,
        description: it.description || "",
        detail: it.detail || "",
        // 常见数值效果字段（部分可能未被当前版本完全使用）
        damageBonus: "",
        damageMultiplier: "",
        playedLimitBonus: "",
        turnDrawBonus: "",
        goldBonus: "",
        autoHeal: "",
        autoShield: "",
      });
    });
    return out;
  }

  function initRoles() {
    // 从 teammates / selectedProfessions 推断定义（当前仅展示）
    const base = [
      { id: "coder", name: "程序员" },
      { id: "dog", name: "狗" },
      { id: "teacher", name: "老师" },
      { id: "security", name: "保安" },
      { id: "hooligan", name: "流氓" },
    ];
    return base;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setTab(tab) {
    state.tab = tab;
    state.selectedId = null;

    document.querySelectorAll(".editor-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    $("list-title").textContent =
      tab === "cards" ? "卡牌列表" : tab === "items" ? "道具列表" : "职业列表（只读）";
    $("form-title").textContent =
      tab === "cards" ? "卡牌详情" : tab === "items" ? "道具详情" : "职业详情（暂时只读）";

    const filter = $("filter-select");
    filter.innerHTML = "";
    if (tab === "cards" || tab === "items") {
      const optAll = document.createElement("option");
      optAll.value = "";
      optAll.textContent = "全部职业";
      filter.appendChild(optAll);
      const profSet = new Set();
      const list = tab === "cards" ? state.cards : state.items;
      list.forEach((x) => {
        if (x.profession) profSet.add(x.profession);
      });
      Array.from(profSet).sort().forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        filter.appendChild(opt);
      });
    } else {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "全部职业";
      filter.appendChild(opt);
    }

    renderList();
    renderForm(null);
  }

  function renderList() {
    const listEl = $("editor-list");
    listEl.innerHTML = "";
    const search = ($("search-input").value || "").toLowerCase();
    const filter = $("filter-select").value || "";

    let data = [];
    if (state.tab === "cards") data = state.cards;
    else if (state.tab === "items") data = state.items;
    else data = state.roles;

    data
      .filter((x) => {
        if (search) {
          const s = (x.name || "").toLowerCase() + " " + (x.id || "").toLowerCase();
          if (!s.includes(search)) return false;
        }
        if (filter) {
          if ((x.profession || "") !== filter) return false;
        }
        return true;
      })
      .sort((a, b) => (a.id || "").localeCompare(b.id || ""))
      .forEach((x) => {
        const item = document.createElement("div");
        item.className = "editor-list-item" + (state.selectedId === x.id ? " active" : "");

        const main = document.createElement("div");
        main.className = "editor-list-main";
        const icon = document.createElement("span");
        icon.textContent = x.icon || "🃏";
        const name = document.createElement("span");
        name.textContent = x.name || x.id;
        const idSpan = document.createElement("span");
        idSpan.className = "editor-list-id";
        idSpan.textContent = x.id;
        main.appendChild(icon);
        main.appendChild(name);
        main.appendChild(idSpan);

        item.appendChild(main);

        if (x.profession) {
          const badge = document.createElement("span");
          badge.className = "editor-badge prof";
          badge.textContent = x.profession;
          item.appendChild(badge);
        } else if (x.type) {
          const badge = document.createElement("span");
          badge.className = "editor-badge";
          badge.textContent = x.type;
          item.appendChild(badge);
        }

        item.onclick = () => {
          state.selectedId = x.id;
          renderList();
          renderForm(x);
        };
        listEl.appendChild(item);
      });
  }

  function addField(form, key, label, value, type = "text", opts = {}) {
    const wrap = document.createElement("div");
    wrap.className = "editor-field" + (opts.full ? " editor-field-full" : "");
    const lab = document.createElement("label");
    lab.textContent = label;
    const input =
      type === "textarea"
        ? document.createElement("textarea")
        : type === "select"
        ? document.createElement("select")
        : document.createElement("input");
    if (type !== "textarea" && type !== "select") input.type = type;
    input.name = key;
    if (type === "number" && value === "") value = "";
    input.value = value ?? "";
    if (opts.options && type === "select") {
      opts.options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        input.appendChild(o);
      });
      input.value = value || "";
    }
    wrap.appendChild(lab);
    wrap.appendChild(input);
    form.appendChild(wrap);
  }

  function renderForm(entry) {
    const form = $("editor-form");
    form.innerHTML = "";
    const tab = state.tab;

    if (!entry) {
      $("btn-delete").disabled = true;
      $("btn-duplicate").disabled = true;
    } else {
      $("btn-delete").disabled = tab === "roles";
      $("btn-duplicate").disabled = false;
    }

    if (tab === "roles") {
      if (!entry) {
        form.innerHTML = "<div class='editor-hint'>从左侧选择一个职业查看详情。</div>";
        return;
      }
      addField(form, "id", "职业 ID", entry.id, "text", { full: true });
      addField(form, "name", "名称", entry.name, "text", { full: true });
      form.querySelectorAll("input").forEach((i) => (i.disabled = true));
      $("btn-delete").disabled = true;
      $("btn-duplicate").disabled = true;
      return;
    }

    if (!entry) {
      form.innerHTML = "<div class='editor-hint'>从左侧选择一条记录，或在这里编辑后通过导出来生成配置。</div>";
      return;
    }

    if (tab === "cards") {
      addField(form, "id", "卡牌 ID", entry.id, "text");
      addField(form, "name", "名称", entry.name, "text");
      addField(form, "icon", "图标", entry.icon, "text");
      addField(
        form,
        "profession",
        "职业",
        entry.profession,
        "select",
        {
          options: [
            { value: "common", label: "common" },
            { value: "coder", label: "coder" },
            { value: "dog", label: "dog" },
            { value: "teacher", label: "teacher" },
            { value: "security", label: "security" },
            { value: "hooligan", label: "hooligan" },
          ],
        }
      );
      addField(
        form,
        "type",
        "类型",
        entry.type,
        "select",
        {
          options: [
            { value: "attack", label: "attack" },
            { value: "skill", label: "skill" },
            { value: "power", label: "power" },
          ],
        }
      );
      addField(form, "cost", "费用(暂未使用)", entry.cost, "number");
      addField(form, "damage", "伤害", entry.damage, "number");
      addField(form, "heal", "单体治疗", entry.heal, "number");
      addField(form, "healAll", "群体治疗", entry.healAll, "number");
      addField(form, "draw", "抽牌", entry.draw, "number");
      addField(form, "discardAndDraw", "换牌(弃后抽)", entry.discardAndDraw, "number");
      addField(form, "shield", "护盾", entry.shield, "number");
      addField(form, "stun", "眩晕(1=true)", entry.stun, "number");
      addField(form, "weakness", "虚弱层数", entry.weakness, "number");
      addField(form, "slow", "减速层数", entry.slow, "number");
      addField(form, "blind", "致盲(1=true)", entry.blind, "number");
      addField(form, "description", "简要描述", entry.description, "textarea", { full: true });
      addField(form, "detail", "详细说明", entry.detail, "textarea", { full: true });
    } else if (tab === "items") {
      addField(form, "id", "道具 ID", entry.id, "text");
      addField(form, "name", "名称", entry.name, "text");
      addField(form, "icon", "图标", entry.icon, "text");
      addField(
        form,
        "type",
        "类型",
        entry.type,
        "select",
        {
          options: [
            { value: "profession", label: "profession" },
            { value: "combo", label: "combo" },
            { value: "power", label: "power" },
            { value: "utility", label: "utility" },
          ],
        }
      );
      addField(
        form,
        "profession",
        "绑定职业",
        entry.profession,
        "select",
        {
          options: [
            { value: "", label: "（无）" },
            { value: "coder", label: "coder" },
            { value: "dog", label: "dog" },
            { value: "teacher", label: "teacher" },
            { value: "security", label: "security" },
            { value: "hooligan", label: "hooligan" },
          ],
        }
      );
      addField(
        form,
        "rarity",
        "稀有度",
        entry.rarity,
        "select",
        {
          options: [
            { value: "common", label: "common" },
            { value: "rare", label: "rare" },
            { value: "epic", label: "epic" },
            { value: "legendary", label: "legendary" },
          ],
        }
      );
      addField(form, "lockedByDefault", "默认锁定(1/0)", entry.lockedByDefault ? 1 : 0, "number");
      addField(form, "damageBonus", "伤害+X", entry.damageBonus, "number");
      addField(form, "damageMultiplier", "伤害倍率×", entry.damageMultiplier, "number");
      addField(form, "playedLimitBonus", "出牌上限+X", entry.playedLimitBonus, "number");
      addField(form, "turnDrawBonus", "每回合抽牌+X", entry.turnDrawBonus, "number");
      addField(form, "goldBonus", "金币奖励+比例(0.5=+50%)", entry.goldBonus, "number");
      addField(form, "autoHeal", "每回合自动回血", entry.autoHeal, "number");
      addField(form, "autoShield", "每回合自动护盾", entry.autoShield, "number");
      addField(form, "description", "简要描述", entry.description, "textarea", { full: true });
      addField(form, "detail", "详细说明", entry.detail, "textarea", { full: true });
    }

    form.oninput = () => {
      if (!state.selectedId) return;
      const fd = new FormData(form);
      const obj = {};
      fd.forEach((v, k) => {
        obj[k] = v;
      });
      if (tab === "cards") {
        const idx = state.cards.findIndex((c) => c.id === state.selectedId);
        if (idx >= 0) {
          Object.assign(state.cards[idx], normalizeTypes(obj, "cards"));
        }
      } else if (tab === "items") {
        const idx = state.items.findIndex((c) => c.id === state.selectedId);
        if (idx >= 0) {
          Object.assign(state.items[idx], normalizeTypes(obj, "items"));
        }
      }
      renderList();
    };
  }

  function normalizeTypes(obj, tab) {
    const out = { ...obj };
    const numFieldsCards = [
      "cost",
      "damage",
      "heal",
      "healAll",
      "draw",
      "discardAndDraw",
      "shield",
      "stun",
      "weakness",
      "slow",
      "blind",
    ];
    const numFieldsItems = [
      "damageBonus",
      "damageMultiplier",
      "playedLimitBonus",
      "turnDrawBonus",
      "goldBonus",
      "autoHeal",
      "autoShield",
      "lockedByDefault",
    ];
    const target = tab === "cards" ? numFieldsCards : numFieldsItems;
    target.forEach((k) => {
      if (k in out) {
        const v = String(out[k]).trim();
        if (v === "") out[k] = "";
        else out[k] = Number(v);
      }
    });
    return out;
  }

  function exportCurrent() {
    let data;
    let filename;
    if (state.tab === "cards") {
      data = state.cards;
      filename = "cards.generated.json";
    } else if (state.tab === "items") {
      data = state.items;
      filename = "items.generated.json";
    } else {
      data = state.roles;
      filename = "roles.generated.json";
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function duplicateCurrent() {
    if (state.tab === "roles" || !state.selectedId) return;
    const list = state.tab === "cards" ? state.cards : state.items;
    const idx = list.findIndex((x) => x.id === state.selectedId);
    if (idx < 0) return;
    const base = list[idx];
    const copy = JSON.parse(JSON.stringify(base));
    copy.id = base.id + "_copy";
    copy.name = base.name + "（复制）";
    list.push(copy);
    state.selectedId = copy.id;
    renderList();
    renderForm(copy);
  }

  function deleteCurrent() {
    if (state.tab === "roles" || !state.selectedId) return;
    const list = state.tab === "cards" ? state.cards : state.items;
    const idx = list.findIndex((x) => x.id === state.selectedId);
    if (idx < 0) return;
    if (!window.confirm(`确定要删除 ${list[idx].name || list[idx].id} 吗？此操作仅影响导出的 JSON，不会修改原始 js 文件。`)) {
      return;
    }
    list.splice(idx, 1);
    state.selectedId = null;
    renderList();
    renderForm(null);
  }

  document.addEventListener("DOMContentLoaded", () => {
    state.cards = normalizeCards();
    state.items = normalizeItems();
    state.roles = initRoles();

    document.querySelectorAll(".editor-tab").forEach((btn) => {
      btn.addEventListener("click", () => setTab(btn.dataset.tab));
    });
    $("search-input").addEventListener("input", renderList);
    $("filter-select").addEventListener("change", renderList);
    $("btn-export").addEventListener("click", exportCurrent);
    $("btn-duplicate").addEventListener("click", duplicateCurrent);
    $("btn-delete").addEventListener("click", deleteCurrent);
    const btnNew = $("btn-new");
    if (btnNew) {
      btnNew.addEventListener("click", () => {
        if (state.tab === "roles") return;
        if (state.tab === "cards") {
          const base = {
            id: "new_card_" + (state.cards.length + 1),
            name: "新卡牌",
            icon: "🃏",
            type: "attack",
            profession: "common",
            cost: "",
            damage: "",
            heal: "",
            healAll: "",
            draw: "",
            discardAndDraw: "",
            shield: "",
            stun: 0,
            weakness: "",
            slow: "",
            blind: 0,
            description: "",
            detail: "",
          };
          state.cards.push(base);
          state.selectedId = base.id;
          renderList();
          renderForm(base);
        } else if (state.tab === "items") {
          const base = {
            id: "new_item_" + (state.items.length + 1),
            name: "新道具",
            icon: "🎁",
            type: "utility",
            profession: "",
            rarity: "rare",
            lockedByDefault: 0,
            description: "",
            detail: "",
            damageBonus: "",
            damageMultiplier: "",
            playedLimitBonus: "",
            turnDrawBonus: "",
            goldBonus: "",
            autoHeal: "",
            autoShield: "",
          };
          state.items.push(base);
          state.selectedId = base.id;
          renderList();
          renderForm(base);
        }
      });
    }

    setTab("cards");
  });
})();

