(() => {
  "use strict";

  const PARTY = {
    dpp: { label: "民主進步黨", short: "民進黨", v: "--dpp" },
    kmt: { label: "中國國民黨", short: "國民黨", v: "--kmt" },
    tpp: { label: "台灣民眾黨", short: "民眾黨", v: "--tpp" },
    ind: { label: "無黨籍及其他", short: "無黨籍／其他", v: "--ind" },
  };
  const CATS = ["中央政務官員", "國營與公股董事長", "地方縣市首長"];
  const CAT_SHORT = { "中央政務官員": "中央政務", "國營與公股董事長": "國營公股", "地方縣市首長": "地方首長" };
  const VIEWS = ["cards", "graph", "map", "insights", "factions", "about"];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const hl = (text, q) => {
    const t = esc(text);
    if (!q) return t;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return t;
    return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
  };
  const dot = (pg) => `<i class="dot" style="background:var(${PARTY[pg].v})"></i>`;
  const pendingBadge = (p) => (p.pending ? '<span class="badge">待確認</span>' : "");

  let DATA, byId, clusters;
  const state = { cats: new Set(), parties: new Set(), cluster: "", q: "", sort: "default" };
  let navList = [];
  let currentId = null;
  const compare = [];

  fetch("data/people.json")
    .then((r) => r.json())
    .then((d) => {
      DATA = d;
      clusters = d.clusters;
      byId = new Map(d.people.map((p) => [p.id, p]));
      $("#updated").textContent = d.updated || "—";
      buildStats();
      buildFilters();
      renderCards();
      bindUI();
      route();
    })
    .catch((err) => {
      console.error(err);
      $("#grid").innerHTML = '<p class="empty">資料載入失敗。若直接開啟本機檔案，請改用本機伺服器（例如 <code>python3 -m http.server</code>）。</p>';
    });

  /* ── Stats ─────────────────────────────── */
  function buildStats() {
    const ps = DATA.people;
    $("#stat-total").textContent = ps.length;
    const count = (f) => ps.filter(f).length;
    const items = [
      ...CATS.map((c) => [CAT_SHORT[c], count((p) => p.category === c), ""]),
      ...Object.entries(PARTY).map(([k, v]) => [v.short, count((p) => p.partyGroup === k), k]),
    ];
    $("#stats").innerHTML = items.map(([l, n, k]) =>
      `<div><dt>${k ? dot(k) : ""}${l}</dt><dd>${n}</dd></div>`).join("");
  }

  /* ── Filters ───────────────────────────── */
  function chip(label, value, extra = "", n = null) {
    return `<button class="chip" data-v="${esc(value)}" aria-pressed="false">${extra}${esc(label)}${n != null ? `<span class="n">${n}</span>` : ""}</button>`;
  }
  function buildFilters() {
    const ps = DATA.people;
    $("#f-category").innerHTML = CATS.map((c) => chip(CAT_SHORT[c], c, "", ps.filter((p) => p.category === c).length)).join("");
    $("#f-party").innerHTML = Object.entries(PARTY).map(([k, v]) =>
      chip(v.short, k, dot(k), ps.filter((p) => p.partyGroup === k).length)).join("");
    const fams = {};
    for (const [id, c] of Object.entries(clusters)) (fams[c.family] ||= []).push([id, c]);
    $("#f-cluster").innerHTML = '<option value="">全部</option>' + Object.entries(fams).map(([f, list]) =>
      `<optgroup label="${esc(f)}">${list.map(([id, c]) => {
        const n = ps.filter((p) => p.clusters.some((x) => x.id === id)).length;
        return `<option value="${id}">${esc(c.label)}（${n}）</option>`;
      }).join("")}</optgroup>`).join("");
  }
  function syncFilterUI() {
    $$("#f-category .chip").forEach((b) => b.setAttribute("aria-pressed", state.cats.has(b.dataset.v)));
    $$("#f-party .chip").forEach((b) => b.setAttribute("aria-pressed", state.parties.has(b.dataset.v)));
    $("#f-cluster").value = state.cluster;
    $("#q").value = state.q;
  }

  function matches(p) {
    if (state.cats.size && !state.cats.has(p.category)) return false;
    if (state.parties.size && !state.parties.has(p.partyGroup)) return false;
    if (state.cluster && !p.clusters.some((c) => c.id === state.cluster)) return false;
    if (state.q) {
      const hay = [p.name, p.org, p.title, p.party, p.faction, p.bio, p.orgDesc, ...p.clusters.map((c) => clusters[c.id].label)].join(" ").toLowerCase();
      if (!hay.includes(state.q.toLowerCase())) return false;
    }
    return true;
  }

  /* ── Cards ─────────────────────────────── */
  function cardHTML(p) {
    const pc = `var(${PARTY[p.partyGroup].v})`;
    const inCmp = compare.includes(p.id);
    return `<div class="card-wrap"><button class="card" data-id="${p.id}" style="--pc:${pc}">
      <span class="org">${hl(p.org, state.q)}${pendingBadge(p)}</span>
      <span class="name">${hl(p.name, state.q)}</span>
      <span class="title">${esc(p.title)}</span>
      <span class="meta">
        <span class="party">${dot(p.partyGroup)}${esc(p.party)}</span>
        <span class="faction">${hl(p.faction, state.q)}</span>
      </span>
    </button><button class="cmp-toggle" data-cmp="${p.id}" aria-pressed="${inCmp}" title="加入比較">${inCmp ? "✓ 比較中" : "+ 比較"}</button></div>`;
  }

  function renderCards() {
    const list = DATA.people.filter(matches);
    let groups;
    if (state.sort === "party") {
      groups = Object.keys(PARTY).map((k) => [PARTY[k].label, list.filter((p) => p.partyGroup === k)]);
    } else if (state.sort === "cluster") {
      const first = (p) => (p.clusters[0] ? p.clusters[0].id : "_none");
      groups = [...Object.entries(clusters).map(([id, c]) => [c.label, list.filter((p) => first(p) === id)]),
        ["未歸類（待確認）", list.filter((p) => first(p) === "_none")]];
    } else if (state.sort === "name") {
      const coll = new Intl.Collator("zh-Hant-TW-u-co-stroke");
      groups = [[null, [...list].sort((a, b) => coll.compare(a.name, b.name))]];
    } else {
      groups = CATS.map((c) => [c, list.filter((p) => p.category === c)]);
    }
    groups = groups.filter(([, g]) => g.length);
    navList = groups.flatMap(([, g]) => g.map((p) => p.id));
    $("#grid").innerHTML = groups.map(([h, g]) =>
      (h ? `<div class="group-head">${esc(h)}　<span style="opacity:.55">${g.length}</span></div>` : "") + g.map(cardHTML).join("")).join("");
    $("#count").textContent = `顯示 ${list.length} / ${DATA.people.length} 人`;
    $("#empty").hidden = list.length > 0;
    $("#grid").hidden = list.length === 0;
  }

  /* ── Drawer ────────────────────────────── */
  function related(p) {
    const out = [];
    const seen = new Set([p.id]);
    for (const e of DATA.edges) {
      const other = e.source === p.id ? e.target : e.target === p.id ? e.source : null;
      if (other && !seen.has(other)) { seen.add(other); out.push({ p: byId.get(other), note: e.note, edge: true }); }
    }
    for (const c of p.clusters) {
      for (const q of DATA.people) {
        if (seen.has(q.id)) continue;
        const m = q.clusters.find((x) => x.id === c.id);
        if (m) { seen.add(q.id); out.push({ p: q, note: clusters[c.id].label + (m.w < 1 ? "・友好" : "") }); }
      }
    }
    return out.slice(0, 14);
  }

  function openPerson(id, push = true) {
    const p = byId.get(id);
    if (!p) return;
    currentId = id;
    const rel = related(p);
    const inCmp = compare.includes(p.id);
    $("#d-body").innerHTML = `
      <div class="cat">${esc(p.category)}</div>
      <h2 id="d-name">${esc(p.name)}${pendingBadge(p)}</h2>
      <p class="role">${esc(p.org)}　${esc(p.title)}</p>
      <dl class="facts">
        <div><dt>政黨</dt><dd><span class="party">${dot(p.partyGroup)}${esc(p.party)}</span></dd></div>
        <div><dt>派系／背景</dt><dd>${esc(p.faction)}</dd></div>
      </dl>
      <p class="bio">${esc(p.bio)}</p>
      ${p.pending ? '<p class="pending-note">這位人物的部分資料尚待查證。若你有可靠來源，歡迎到關於資料頁的更正管道回報。</p>' : ""}
      ${p.orgDesc ? `<div class="org-desc"><h3>這個職位做什麼</h3><p>${esc(p.orgDesc)}</p></div>` : ""}
      ${p.clusters.length ? `<h3>歸類群組</h3>
      <div class="cluster-tags">${p.clusters.map((c) =>
        `<button class="chip" data-cluster="${c.id}">${esc(clusters[c.id].label)}${c.w < 1 ? '<span class="n">友好／淵源</span>' : ""}</button>`).join("")}</div>` : ""}
      ${rel.length ? `<h3>相關人物</h3><div class="rel">${rel.map((r) =>
        `<button data-id="${r.p.id}">${dot(r.p.partyGroup)}
          <span><span class="rn">${esc(r.p.name)}</span><br><span class="rs">${esc(r.p.org)} ${esc(r.p.title)}</span></span>
          <span class="rt${r.edge ? " edge" : ""}">${esc(r.note)}</span></button>`).join("")}</div>` : ""}
      <div class="drawer-actions">
        <button class="btn" data-locate="${p.id}">在派系星圖中定位</button>
        <button class="btn" data-cmp="${p.id}" aria-pressed="${inCmp}">${inCmp ? "✓ 已加入比較" : "+ 加入比較"}</button>
        <button class="btn" data-copy>複製連結</button>
      </div>`;
    const list = navList.includes(id) ? navList : DATA.people.map((x) => x.id);
    const i = list.indexOf(id);
    $("#d-prev").disabled = i <= 0;
    $("#d-next").disabled = i >= list.length - 1;
    $("#d-pos").textContent = `${i + 1} / ${list.length}`;
    $("#d-prev").dataset.target = list[i - 1] || "";
    $("#d-next").dataset.target = list[i + 1] || "";
    const d = $("#drawer");
    d.classList.add("is-open");
    d.setAttribute("aria-hidden", "false");
    $("#scrim").hidden = false;
    $(".drawer-body").scrollTop = 0;
    d.scrollTop = 0;
    if (push) history.replaceState(null, "", "#" + id);
    $("#d-close").focus({ preventScroll: true });
  }
  function closeDrawer() {
    const d = $("#drawer");
    if (!d.classList.contains("is-open")) return;
    d.classList.remove("is-open");
    d.setAttribute("aria-hidden", "true");
    $("#scrim").hidden = true;
    currentId = null;
    history.replaceState(null, "", location.pathname + (currentView !== "cards" ? "#" + currentView : ""));
  }

  /* ── Toast ─────────────────────────────── */
  let toastT;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 1800);
  }
  async function copyLink(id) {
    const url = location.origin + location.pathname + "#" + id;
    try { await navigator.clipboard.writeText(url); toast("已複製連結"); }
    catch { toast(url); }
  }

  /* ── Compare ───────────────────────────── */
  function toggleCompare(id) {
    const i = compare.indexOf(id);
    if (i >= 0) compare.splice(i, 1);
    else {
      if (compare.length >= 3) { toast("最多比較三位"); return; }
      compare.push(id);
    }
    renderTray();
    $$(`[data-cmp="${id}"]`).forEach((b) => {
      const on = compare.includes(id);
      b.setAttribute("aria-pressed", on);
      b.textContent = b.classList.contains("cmp-toggle") ? (on ? "✓ 比較中" : "+ 比較") : (on ? "✓ 已加入比較" : "+ 加入比較");
    });
  }
  function renderTray() {
    $("#tray").hidden = compare.length === 0;
    document.body.classList.toggle("has-tray", compare.length > 0);
    $("#tray-items").innerHTML = compare.map((id) => {
      const p = byId.get(id);
      return `<button class="tray-chip" data-rm="${id}">${dot(p.partyGroup)}${esc(p.name)}<span aria-hidden="true">×</span></button>`;
    }).join("") + (compare.length < 3 ? `<span class="tray-hint">再選 ${3 - compare.length} 位</span>` : "");
    $("#tray-go").disabled = compare.length < 2;
  }
  function openCompare() {
    const ps = compare.map((id) => byId.get(id));
    const cid = (p) => new Set(p.clusters.map((c) => c.id));
    const shared = [...cid(ps[0])].filter((c) => ps.every((p) => cid(p).has(c)));
    const sameParty = ps.every((p) => p.partyGroup === ps[0].partyGroup);
    const sameCat = ps.every((p) => p.category === ps[0].category);
    const notes = [];
    notes.push(sameParty ? `同屬${PARTY[ps[0].partyGroup].label}` : "政黨不同");
    notes.push(sameCat ? `同為${ps[0].category}` : "分屬不同類別的職位");
    notes.push(shared.length ? `共同群組：${shared.map((c) => clusters[c].label).join("、")}` : "沒有共同的派系或背景群組");
    const direct = DATA.edges.filter((e) => compare.includes(e.source) && compare.includes(e.target));
    if (direct.length) notes.push("直接淵源：" + direct.map((e) => `${byId.get(e.source).name}－${byId.get(e.target).name}（${e.note}）`).join("；"));
    const row = (label, f) => `<div class="cmp-row"><div class="cmp-label">${label}</div>${ps.map((p) => `<div class="cmp-cell">${f(p)}</div>`).join("")}</div>`;
    $("#cmp-body").innerHTML = `
      <p class="kicker">人物比較</p>
      <p class="cmp-summary">${notes.map(esc).join("　·　")}</p>
      <div class="cmp-grid" style="--n:${ps.length}">
        <div class="cmp-row cmp-head"><div class="cmp-label"></div>${ps.map((p) =>
          `<div class="cmp-cell"><button class="cmp-name" data-id="${p.id}">${esc(p.name)}</button><div class="cmp-role">${esc(p.org)}　${esc(p.title)}</div></div>`).join("")}</div>
        ${row("類別", (p) => esc(p.category))}
        ${row("政黨", (p) => `<span class="party">${dot(p.partyGroup)}${esc(p.party)}</span>`)}
        ${row("派系／背景", (p) => esc(p.faction))}
        ${row("歸類群組", (p) => p.clusters.map((c) => `<span class="tag${shared.includes(c.id) ? " shared" : ""}">${esc(clusters[c.id].label)}</span>`).join("") || "—")}
        ${row("背景說明", (p) => `<span class="cmp-bio">${esc(p.bio)}</span>`)}
        ${row("職位說明", (p) => `<span class="cmp-bio muted">${esc(p.orgDesc)}</span>`)}
      </div>`;
    $("#compare").hidden = false;
    document.body.classList.add("no-scroll");
    $("#cmp-close").focus();
  }
  function closeCompare() { $("#compare").hidden = true; document.body.classList.remove("no-scroll"); }

  /* ── Views ─────────────────────────────── */
  let currentView = "cards";
  function setView(v) {
    currentView = v;
    $$(".tab").forEach((t) => {
      const on = t.dataset.view === v;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on);
    });
    $$(".view").forEach((s) => s.classList.toggle("is-active", s.id === "view-" + v));
    document.body.classList.toggle("on-graph", v === "graph");
    if (v === "graph") Graph.init();
    if (v === "map") TileMap.init();
    if (v === "insights") Insights.init();
    if (v === "factions") Factions.init();
  }
  function go(v, hash = true) {
    setView(v);
    if (hash) history.replaceState(null, "", v === "cards" ? location.pathname : "#" + v);
    $(".tabs").scrollIntoView({ behavior: "smooth" });
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (VIEWS.includes(h)) setView(h);
    else if (/^p\d+$/.test(h)) openPerson(h, false);
  }
  function filterBy(patch) {
    state.cats.clear(); state.parties.clear(); state.cluster = ""; state.q = "";
    if (patch.cat) state.cats.add(patch.cat);
    if (patch.cluster) state.cluster = patch.cluster;
    if (patch.party) state.parties.add(patch.party);
    syncFilterUI(); renderCards(); go("cards");
  }

  /* ── UI bindings ───────────────────────── */
  function bindUI() {
    $$(".tab").forEach((t) => t.addEventListener("click", () => go(t.dataset.view)));
    $(".primer").addEventListener("click", (e) => {
      const b = e.target.closest("[data-goto]"); if (!b) return;
      if (b.dataset.cat) filterBy({ cat: b.dataset.cat }); else go(b.dataset.goto);
    });

    const toggleChip = (wrap, set) => wrap.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      const v = b.dataset.v;
      set.has(v) ? set.delete(v) : set.add(v);
      b.setAttribute("aria-pressed", set.has(v));
      renderCards();
    });
    toggleChip($("#f-category"), state.cats);
    toggleChip($("#f-party"), state.parties);

    let t;
    $("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); renderCards(); }, 120); });
    $("#f-cluster").addEventListener("change", (e) => { state.cluster = e.target.value; renderCards(); });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderCards(); });
    $("#reset").addEventListener("click", () => { filterBy({}); });
    $("#random").addEventListener("click", () => {
      const pool = navList.length ? navList : DATA.people.map((p) => p.id);
      openPerson(pool[Math.floor(Math.random() * pool.length)]);
    });

    $("#grid").addEventListener("click", (e) => {
      const c = e.target.closest("[data-cmp]"); if (c) return toggleCompare(c.dataset.cmp);
      const k = e.target.closest(".card"); if (k) openPerson(k.dataset.id);
    });
    $("#d-body").addEventListener("click", (e) => {
      const r = e.target.closest("[data-id]");
      if (r) return openPerson(r.dataset.id);
      const c = e.target.closest("[data-cluster]");
      if (c) { closeDrawer(); filterBy({ cluster: c.dataset.cluster }); return; }
      const l = e.target.closest("[data-locate]");
      if (l) { closeDrawer(); go("graph"); Graph.focus(l.dataset.locate); return; }
      const m = e.target.closest("[data-cmp]");
      if (m) return toggleCompare(m.dataset.cmp);
      if (e.target.closest("[data-copy]")) copyLink(currentId);
    });
    $("#d-prev").addEventListener("click", (e) => e.currentTarget.dataset.target && openPerson(e.currentTarget.dataset.target));
    $("#d-next").addEventListener("click", (e) => e.currentTarget.dataset.target && openPerson(e.currentTarget.dataset.target));
    $("#scrim").addEventListener("click", closeDrawer);
    $("#d-close").addEventListener("click", closeDrawer);

    $("#tray-items").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) toggleCompare(b.dataset.rm); });
    $("#tray-clear").addEventListener("click", () => { [...compare].forEach(toggleCompare); });
    $("#tray-go").addEventListener("click", () => { closeDrawer(); openCompare(); });
    $("#cmp-close").addEventListener("click", closeCompare);
    $("#compare").addEventListener("click", (e) => {
      if (e.target.id === "compare") return closeCompare();
      const n = e.target.closest("[data-id]"); if (n) { closeCompare(); openPerson(n.dataset.id); }
    });

    document.addEventListener("keydown", (e) => {
      const typing = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName);
      if (e.key === "Escape") { if (!$("#compare").hidden) closeCompare(); else closeDrawer(); }
      if (e.key === "/" && !typing && currentView === "cards") { e.preventDefault(); $("#q").focus(); }
      if (currentId && !typing && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const b = e.key === "ArrowLeft" ? $("#d-prev") : $("#d-next");
        if (b.dataset.target) openPerson(b.dataset.target);
      }
    });
    window.addEventListener("hashchange", route);
  }

  /* ── Tile map ──────────────────────────── */
  const TileMap = (() => {
    let ready = false, mode = "party";
    const POS = {
      "連江縣": [0, 0], "台北市": [3, 0], "基隆市": [4, 0],
      "桃園市": [2, 1], "新北市": [3, 1],
      "新竹市": [1, 2], "新竹縣": [2, 2], "宜蘭縣": [3, 2],
      "金門縣": [0, 3], "苗栗縣": [1, 3], "台中市": [2, 3], "花蓮縣": [3, 3],
      "彰化縣": [1, 4], "南投縣": [2, 4],
      "澎湖縣": [0, 5], "雲林縣": [1, 5], "嘉義縣": [2, 5], "台東縣": [3, 5],
      "嘉義市": [1, 6], "台南市": [2, 6],
      "高雄市": [2, 7], "屏東縣": [3, 7],
    };
    const TAG = {
      "台北市": "都會藍", "新北市": "警政文官", "桃園市": "科技官僚", "台中市": "整合紅黑派",
      "台南市": "新潮流友好", "高雄市": "英系", "基隆市": "謝派", "新竹縣": "邱派・范派",
      "新竹市": "柯文哲系統", "苗栗縣": "黃派", "彰化縣": "鹿港派・紅派", "南投縣": "林明溱系統",
      "雲林縣": "張派", "嘉義縣": "英系・陳明文系統", "嘉義市": "黃派", "屏東縣": "新潮流",
      "宜蘭縣": "林派", "花蓮縣": "傅派", "台東縣": "饒派", "澎湖縣": "正國會友好",
      "金門縣": "陳氏宗親", "連江縣": "陳雪生系統",
    };
    function init() {
      if (ready) return; ready = true;
      const locals = DATA.people.filter((p) => p.category === "地方縣市首長");
      $("#tilemap").innerHTML = locals.map((p) => {
        const [c, r] = POS[p.org] || [4, 7];
        return `<button class="tile" role="listitem" data-id="${p.id}" style="grid-column:${c + 1};grid-row:${r + 1};--pc:var(${PARTY[p.partyGroup].v})"
          aria-label="${esc(p.org)}，${esc(p.name)}，${esc(p.party)}">
          <span class="t-city">${esc(/^(新竹|嘉義)/.test(p.org) ? p.org : p.org.replace(/[縣市]$/, ""))}</span>
          <span class="t-name">${esc(p.name)}</span>
          <span class="t-tag">${esc(TAG[p.org] || "")}</span>
        </button>`;
      }).join("");
      const by = (k) => locals.filter((p) => p.partyGroup === k);
      const special = ["台北市", "新北市", "桃園市", "台中市", "台南市", "高雄市"];
      const sp = (k) => by(k).filter((p) => special.includes(p.org)).length;
      $("#map-summary").innerHTML = `<ul class="bars">${Object.keys(PARTY).filter((k) => by(k).length).map((k) =>
        `<li><span class="b-label">${dot(k)}${PARTY[k].short}</span><span class="b-track"><span class="b-fill" style="width:${pct(by(k).length, 22)}%;background:var(${PARTY[k].v})"></span></span><span class="b-n">${by(k).length}</span></li>`).join("")}</ul>
        <p>六個直轄市中，國民黨 ${sp("kmt")} 席、民進黨 ${sp("dpp")} 席。國民黨籍首長多依託地方派系或家族網絡，民進黨則集中在嘉南、高屏與澎湖，大致延續「北藍南綠」的長期格局。</p>`;
      $("#tilemap").addEventListener("click", (e) => { const t = e.target.closest(".tile"); if (t) openPerson(t.dataset.id); });
      $("#map-mode").addEventListener("click", (e) => {
        const b = e.target.closest(".chip"); if (!b) return;
        mode = b.dataset.v;
        $$("#map-mode .chip").forEach((x) => x.setAttribute("aria-pressed", x === b));
        $("#tilemap").classList.toggle("show-tag", mode === "local");
      });
    }
    return { init };
  })();

  /* ── Insights ──────────────────────────── */
  const Insights = (() => {
    let ready = false;
    function init() {
      if (ready) return; ready = true;
      const ps = DATA.people;
      const inCat = (c) => ps.filter((p) => p.category === c);
      const central = inCat(CATS[0]), soe = inCat(CATS[1]), local = inCat(CATS[2]);
      const nonParty = central.filter((p) => p.partyGroup === "ind").length;
      const civilSoe = soe.filter((p) => p.clusters.some((c) => c.id === "civil")).length;
      const kmtLocal = local.filter((p) => p.partyGroup === "kmt").length;
      const core = (id) => ps.filter((p) => p.clusters.some((c) => c.id === id && c.w === 1)).length;
      const weak = (id) => ps.filter((p) => p.clusters.some((c) => c.id === id && c.w < 1)).length;
      const partyClusters = Object.keys(clusters).filter((id) => clusters[id].family === "政黨派系");
      const topParty = partyClusters.sort((a, b) => core(b) - core(a))[0];

      $("#heroes").innerHTML = [
        [`${nonParty}<small>/${central.length}</small>`, "中央政務官員為無黨籍或背景待確認", `${pct(nonParty, central.length)}%`],
        [`${civilSoe}<small>/${soe.length}</small>`, "國營公股董事長出身常任文官或內部升任", `${pct(civilSoe, soe.length)}%`],
        [`${kmtLocal}<small>/${local.length}</small>`, "縣市首長為國民黨籍", `${pct(kmtLocal, local.length)}%`],
        [`${core(topParty)}`, `${clusters[topParty].label}核心成員，為人數最多的政黨派系`, ""],
      ].map(([n, l, s]) => `<div class="hero"><div class="h-num">${n}</div><div class="h-label">${l}${s ? `<span class="h-pct">${s}</span>` : ""}</div></div>`).join("");

      // 政黨組成堆疊長條
      const keys = Object.keys(PARTY);
      const max = Math.max(...CATS.map((c) => inCat(c).length));
      $("#chart-party").innerHTML = `<div class="legend-row">${keys.map((k) => `<span>${dot(k)}${PARTY[k].short}</span>`).join("")}</div>` +
        CATS.map((c) => {
          const g = inCat(c);
          return `<div class="sb-row"><div class="sb-label">${CAT_SHORT[c]}<span>${g.length} 人</span></div>
          <div class="sb-track" style="width:${(g.length / max) * 100}%">${keys.map((k) => {
            const n = g.filter((p) => p.partyGroup === k).length;
            if (!n) return "";
            return `<span class="sb-seg" style="flex:${n};background:var(${PARTY[k].v})" data-tip="${CAT_SHORT[c]}・${PARTY[k].short}：${n} 人（${pct(n, g.length)}%）">${n >= 3 ? n : ""}</span>`;
          }).join("")}</div></div>`;
        }).join("");
      const dppC = central.filter((p) => p.partyGroup === "dpp").length;
      const dppS = soe.filter((p) => p.partyGroup === "dpp").length;
      $("#obs-party").innerHTML = `<b>觀察</b>中央政務官員中，民進黨籍 ${dppC} 人、無黨籍或待確認 ${nonParty} 人，政黨任命與專業延攬大約各占一半。國營與公股董事長只有 ${dppS} 位標示為民進黨籍，其餘多為無黨籍專業人士（部分資料標註為「民進黨友好」，本站歸入無黨籍及其他）。地方首長則呈現另一種面貌：國民黨 ${kmtLocal} 席、民進黨 ${local.filter((p) => p.partyGroup === "dpp").length} 席、民眾黨 ${local.filter((p) => p.partyGroup === "tpp").length} 席，與中央的執政結構形成對比。`;

      // 派系人數
      const ids = Object.keys(clusters).sort((a, b) => (core(b) + weak(b) * 0.01) - (core(a) + weak(a) * 0.01));
      const cmax = Math.max(...ids.map((id) => core(id) + weak(id)));
      $("#chart-cluster").innerHTML = `<div class="legend-row"><span><i class="sw core"></i>核心成員</span><span><i class="sw weak"></i>友好／淵源</span></div>` +
        ids.map((id) => {
          const a = core(id), b = weak(id);
          return `<button class="hb-row" data-cluster="${id}" title="篩選這個群組">
            <span class="hb-label">${esc(clusters[id].label)}<em>${esc(clusters[id].family)}</em></span>
            <span class="hb-track">${a ? `<span class="hb-seg core" style="width:${(a / cmax) * 100}%" data-tip="${esc(clusters[id].label)}・核心 ${a} 人"></span>` : ""}${b ? `<span class="hb-seg weak" style="width:${(b / cmax) * 100}%" data-tip="${esc(clusters[id].label)}・友好／淵源 ${b} 人"></span>` : ""}</span>
            <span class="hb-n">${a}${b ? `<small>+${b}</small>` : ""}</span></button>`;
        }).join("");
      const civ = core("civil"), xp = core("xpert");
      $("#obs-cluster").innerHTML = `<b>觀察</b>人數最多的兩個群組都不是政黨派系，而是「常任文官・內部升任」（${civ} 人）與「產學界延攬」（${xp} 人），兩者合計約占全體的 ${pct(civ + xp, ps.length)}%。在政黨派系中，${clusters[topParty].label}以 ${core(topParty)} 位核心成員居首，分布在總統府、國安會、多個部會、國營事業與地方。地方派系與家族則多數對應到國民黨籍或偏藍的縣市首長。點選任一列可以篩選該群組的人物。`;
      $("#chart-cluster").addEventListener("click", (e) => { const r = e.target.closest("[data-cluster]"); if (r) filterBy({ cluster: r.dataset.cluster }); });

      // 表格
      $("#tables").innerHTML = `<table><caption>政黨組成</caption><thead><tr><th>類別</th>${keys.map((k) => `<th>${PARTY[k].short}</th>`).join("")}<th>合計</th></tr></thead><tbody>${CATS.map((c) => {
        const g = inCat(c);
        return `<tr><th>${c}</th>${keys.map((k) => `<td>${g.filter((p) => p.partyGroup === k).length}</td>`).join("")}<td>${g.length}</td></tr>`;
      }).join("")}</tbody></table>
      <table><caption>派系與背景群組</caption><thead><tr><th>群組</th><th>類型</th><th>核心</th><th>友好／淵源</th></tr></thead><tbody>${ids.map((id) =>
        `<tr><th>${esc(clusters[id].label)}</th><td>${esc(clusters[id].family)}</td><td>${core(id)}</td><td>${weak(id)}</td></tr>`).join("")}</tbody></table>`;

      // 提示框
      const tip = document.createElement("div");
      tip.className = "ctip"; document.body.appendChild(tip);
      $("#view-insights").addEventListener("mousemove", (e) => {
        const s = e.target.closest("[data-tip]");
        if (!s) { tip.style.opacity = 0; return; }
        tip.textContent = s.dataset.tip; tip.style.opacity = 1;
        tip.style.left = Math.min(e.clientX + 14, innerWidth - 240) + "px"; tip.style.top = e.clientY + 14 + "px";
      });
      $("#view-insights").addEventListener("mouseleave", () => { tip.style.opacity = 0; });
    }
    return { init };
  })();

  /* ── Factions guide ────────────────────── */
  const Factions = (() => {
    let ready = false;
    function init() {
      if (ready) return; ready = true;
      const fams = {};
      for (const [id, c] of Object.entries(clusters)) (fams[c.family] ||= []).push(id);
      const FAM_INTRO = {
        "政黨派系": "政黨內部的派系與人脈網絡，以民進黨為主，另含國民黨與民眾黨的分群。",
        "地方網絡": "以地方家族、宗親、農會或地方政府歷練為基礎的人脈。",
        "專業體系": "不以政黨或派系為主要背景的常任文官與專業延攬人士。",
      };
      $("#faction-index").innerHTML = Object.entries(fams).map(([f, ids]) =>
        `<div><span class="fi-fam">${esc(f)}</span>${ids.map((id) => `<a href="#f-${id}" data-jump="${id}">${esc(clusters[id].label)}</a>`).join("")}</div>`).join("");
      $("#faction-list").innerHTML = Object.entries(fams).map(([f, ids]) => `
        <section class="fam"><h2 class="fam-title">${esc(f)}</h2><p class="fam-intro">${esc(FAM_INTRO[f] || "")}</p>
        ${ids.map((id) => {
          const mem = DATA.people.filter((p) => p.clusters.some((c) => c.id === id));
          const coreM = mem.filter((p) => p.clusters.find((c) => c.id === id).w === 1);
          const weakM = mem.filter((p) => p.clusters.find((c) => c.id === id).w < 1);
          const li = (p) => `<button class="member" data-id="${p.id}">${dot(p.partyGroup)}<b>${esc(p.name)}</b><span>${esc(p.org)} ${esc(p.title)}</span></button>`;
          return `<article class="faction" id="f-${id}">
            <header><h3>${esc(clusters[id].label)}</h3><span class="f-count">${coreM.length} 位核心${weakM.length ? `・${weakM.length} 位友好／淵源` : ""}</span></header>
            <p class="f-desc">${esc(clusters[id].desc)}</p>
            <div class="members">${coreM.map(li).join("")}</div>
            ${weakM.length ? `<p class="f-sub">友好／淵源</p><div class="members weak">${weakM.map(li).join("")}</div>` : ""}
            <div class="f-actions"><button class="linkish" data-focus="${id}">在星圖中聚焦 →</button><button class="linkish" data-filter="${id}">在圖鑑中篩選 →</button></div>
          </article>`;
        }).join("")}</section>`).join("");
      $("#view-factions").addEventListener("click", (e) => {
        const j = e.target.closest("[data-jump]");
        if (j) { e.preventDefault(); document.getElementById("f-" + j.dataset.jump).scrollIntoView({ behavior: "smooth", block: "start" }); return; }
        const m = e.target.closest("[data-id]"); if (m) return openPerson(m.dataset.id);
        const f = e.target.closest("[data-focus]"); if (f) { go("graph"); Graph.focusCluster(f.dataset.focus); return; }
        const t = e.target.closest("[data-filter]"); if (t) filterBy({ cluster: t.dataset.filter });
      });
    }
    return { init };
  })();

  /* ── Graph ─────────────────────────────── */
  const Graph = (() => {
    let ready = false, svg, g, zoom, nodes, links, nodeSel, linkSel, tip, cats = new Set(CATS), focused = null;
    const FAM_POS = { "政黨派系": [-0.18, -0.05], "地方網絡": [0.28, 0.1], "專業體系": [0.02, 0.32] };

    function init() {
      if (ready) return;
      if (typeof d3 === "undefined") { $("#view-graph .hint").textContent = "圖表函式庫載入失敗，請檢查網路連線。"; return; }
      ready = true;
      svg = d3.select("#graph");
      const W = svg.node().clientWidth, H = svg.node().clientHeight;
      const S = 900, portrait = H > W * 1.1;

      const persons = DATA.people.map((p) => ({ ...p, kind: "p", r: p.category === "中央政務官員" ? 8 : 6.5 }));
      const hubs = Object.entries(clusters).map(([id, c]) => {
        let [fx, fy] = FAM_POS[c.family];
        if (portrait) [fx, fy] = [fy * 0.6, fx * 1.6];
        return { id: "h:" + id, cid: id, kind: "h", label: c.label, family: c.family, tx: fx * S, ty: fy * S };
      });
      nodes = [...hubs, ...persons];
      links = [];
      for (const p of persons) for (const c of p.clusters) links.push({ source: p.id, target: "h:" + c.id, w: c.w, kind: "m" });
      for (const e of DATA.edges) links.push({ source: e.source, target: e.target, w: 1, kind: "e", note: e.note });

      const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id((d) => d.id)
          .distance((l) => l.kind === "e" ? 46 : l.w < 1 ? 95 : 54)
          .strength((l) => l.kind === "e" ? 0.3 : l.w < 1 ? 0.12 : 0.55))
        .force("charge", d3.forceManyBody().strength((d) => d.kind === "h" ? -360 : -70))
        .force("collide", d3.forceCollide((d) => d.kind === "h" ? 36 : d.r + 13))
        .force("x", d3.forceX((d) => d.kind === "h" ? d.tx : 0).strength((d) => d.kind === "h" ? 0.18 : 0.03))
        .force("y", d3.forceY((d) => d.kind === "h" ? d.ty : 0).strength((d) => d.kind === "h" ? 0.18 : 0.03))
        .stop();
      for (let i = 0; i < 400; i++) sim.tick();

      g = svg.append("g");
      zoom = d3.zoom().scaleExtent([0.3, 5]).on("zoom", (e) => {
        g.attr("transform", e.transform);
        nodeSel && nodeSel.select("text").style("display", (d) => d.kind === "p" && e.transform.k < 0.55 ? "none" : null);
      });
      svg.call(zoom).on("dblclick.zoom", null);
      svg.on("click", (e) => { if (e.target === svg.node()) clearFocus(); });

      linkSel = g.append("g").selectAll("line").data(links).join("line")
        .attr("class", (l) => l.kind === "e" ? "l-edge" : "l-member" + (l.w < 1 ? " weak" : ""))
        .attr("stroke-width", (l) => l.kind === "m" ? (l.w < 1 ? 1 : 1.3) : null);

      nodeSel = g.append("g").selectAll("g").data(nodes, (d) => d.id).join("g")
        .attr("class", (d) => d.kind === "h" ? "n-hub fam-" + d.family : "n-person");

      const hubSel = nodeSel.filter((d) => d.kind === "h");
      hubSel.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").text((d) => d.label);
      hubSel.on("click", (e, d) => { e.stopPropagation(); focusHub(d.id); });

      const pSel = nodeSel.filter((d) => d.kind === "p");
      pSel.append("circle").attr("r", (d) => d.r).attr("fill", (d) => css(PARTY[d.partyGroup].v));
      pSel.append("text").attr("x", (d) => d.r + 4).attr("dy", "0.35em").text((d) => d.name);
      pSel.on("mouseenter", (e, d) => { if (!focused) highlight(d.id); showTip(e, d); })
        .on("mousemove", moveTip)
        .on("mouseleave", () => { if (!focused) clearHighlight(); hideTip(); })
        .on("click", (e, d) => { e.stopPropagation(); hideTip(); openPerson(d.id); });

      pSel.call(d3.drag()
        .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
      sim.on("tick", draw);
      draw();

      tip = d3.select(".graph-shell").append("div").attr("class", "tip");
      buildGraphUI();
      fit(0);
      $("#graph-reset").addEventListener("click", () => { clearFocus(); fit(600); });

      matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () =>
        pSel.select("circle").attr("fill", (d) => css(PARTY[d.partyGroup].v)));
    }

    function draw() {
      linkSel.attr("x1", (l) => l.source.x).attr("y1", (l) => l.source.y).attr("x2", (l) => l.target.x).attr("y2", (l) => l.target.y);
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    }

    function visibleNodes() { return nodes.filter((n) => n.kind === "h" ? hubVisible(n) : cats.has(n.category)); }
    function hubVisible(h) { return links.some((l) => l.target.id === h.id && cats.has(l.source.category)); }

    function fit(ms, only) {
      const W = svg.node().clientWidth, H = svg.node().clientHeight;
      const ns = only || visibleNodes();
      if (!ns.length) return;
      const [x0, x1] = d3.extent(ns, (n) => n.x), [y0, y1] = d3.extent(ns, (n) => n.y);
      const pad = W < 600 ? 40 : 90, topPad = W < 600 ? 150 : 60;
      const k = Math.max(W < 600 ? 0.62 : 0.3, Math.min(2.2, (W - pad * 2) / (x1 - x0 || 1), (H - pad - topPad) / (y1 - y0 || 1)));
      const t = d3.zoomIdentity.translate(W / 2, (H + topPad - pad) / 2 + pad / 2 - 20).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
      svg.transition().duration(ms).call(zoom.transform, t);
    }

    function neighbors(id) {
      const s = new Set([id]);
      for (const l of links) {
        if (l.source.id === id) s.add(l.target.id);
        if (l.target.id === id) s.add(l.source.id);
      }
      return s;
    }
    function highlight(id) {
      const nb = neighbors(id);
      nodeSel.classed("dim", (d) => !nb.has(d.id)).classed("hi", (d) => d.id === id);
      linkSel.classed("dim", (l) => l.source.id !== id && l.target.id !== id);
    }
    function clearHighlight() { nodeSel.classed("dim", false).classed("hi", false); linkSel.classed("dim", false); }
    function clearFocus() { focused = null; clearHighlight(); }
    function focusHub(id) {
      focused = id; highlight(id);
      const nb = neighbors(id);
      fit(600, nodes.filter((n) => nb.has(n.id) && (n.kind === "h" || cats.has(n.category))));
    }
    function focusCluster(cid) {
      init(); if (!ready) return;
      CATS.forEach((c) => cats.add(c)); applyCats();
      setTimeout(() => focusHub("h:" + cid), 50);
    }
    function focus(pid) {
      init();
      if (!ready) return;
      const d = nodes.find((n) => n.id === pid);
      if (!d) return;
      if (!cats.has(d.category)) { cats.add(d.category); applyCats(); }
      focused = pid; highlight(pid);
      const W = svg.node().clientWidth, H = svg.node().clientHeight;
      svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(2).translate(-d.x, -d.y));
    }

    function showTip(e, d) {
      tip.html(`<b>${esc(d.name)}</b>${esc(d.org)}・${esc(d.title)}<br><span style="opacity:.7">${esc(d.faction)}</span>`).style("opacity", 1);
      moveTip(e);
    }
    function moveTip(e) {
      const [x, y] = d3.pointer(e, $(".graph-shell"));
      const W = $(".graph-shell").clientWidth;
      tip.style("left", Math.min(x + 14, W - 250) + "px").style("top", y + 14 + "px");
    }
    function hideTip() { tip && tip.style("opacity", 0); }

    function applyCats() {
      nodeSel.style("display", (d) => (d.kind === "h" ? hubVisible(d) : cats.has(d.category)) ? null : "none");
      linkSel.style("display", (l) => {
        const ok = (n) => n.kind === "h" ? true : cats.has(n.category);
        return ok(l.source) && ok(l.target) ? null : "none";
      });
      $$("#g-category .chip").forEach((b) => b.setAttribute("aria-pressed", cats.has(b.dataset.v)));
    }

    function buildGraphUI() {
      $("#legend").innerHTML = Object.keys(PARTY).map((k) => `<span>${dot(k)}${PARTY[k].short}</span>`).join("")
        + `<span><i class="line" style="border-color:rgba(233,228,216,.5)"></i>核心</span>`
        + `<span><i class="line" style="border-color:rgba(233,228,216,.5);border-top-style:dashed"></i>友好／淵源</span>`
        + `<span><i class="line" style="border-color:#e0745d"></i>直接淵源</span>`;
      $("#g-category").innerHTML = CATS.map((c) => chip(CAT_SHORT[c], c)).join("");
      applyCats();
      $("#g-category").addEventListener("click", (e) => {
        const b = e.target.closest(".chip"); if (!b) return;
        const v = b.dataset.v;
        if (cats.has(v) && cats.size === 1) return;
        cats.has(v) ? cats.delete(v) : cats.add(v);
        applyCats(); clearFocus(); fit(500);
      });
    }

    return { init, focus, focusCluster };
  })();
})();
