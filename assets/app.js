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

  const $ = (s, el = document) => el.querySelector(s);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hl = (text, q) => {
    const t = esc(text);
    if (!q) return t;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return t;
    return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
  };

  let DATA, byId, clusters;
  const state = { cats: new Set(), parties: new Set(), cluster: "", q: "", sort: "default" };

  fetch("data/people.json")
    .then((r) => r.json())
    .then((d) => {
      DATA = d;
      clusters = d.clusters;
      byId = new Map(d.people.map((p) => [p.id, p]));
      buildStats();
      buildFilters();
      renderCards();
      bindUI();
      route();
    })
    .catch(() => {
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
      `<div><dt>${k ? `<i class="dot" style="background:var(${PARTY[k].v})"></i>` : ""}${l}</dt><dd>${n}</dd></div>`).join("");
  }

  /* ── Filters ───────────────────────────── */
  function chip(label, value, extra = "", n = null) {
    return `<button class="chip" data-v="${esc(value)}" aria-pressed="false">${extra}${esc(label)}${n != null ? `<span class="n">${n}</span>` : ""}</button>`;
  }
  function buildFilters() {
    const ps = DATA.people;
    $("#f-category").innerHTML = CATS.map((c) => chip(CAT_SHORT[c], c, "", ps.filter((p) => p.category === c).length)).join("");
    $("#f-party").innerHTML = Object.entries(PARTY).map(([k, v]) =>
      chip(v.short, k, `<i class="dot" style="background:var(${v.v})"></i>`, ps.filter((p) => p.partyGroup === k).length)).join("");
    const fams = {};
    for (const [id, c] of Object.entries(clusters)) (fams[c.family] ||= []).push([id, c]);
    $("#f-cluster").innerHTML = '<option value="">全部</option>' + Object.entries(fams).map(([f, list]) =>
      `<optgroup label="${esc(f)}">${list.map(([id, c]) => {
        const n = ps.filter((p) => p.clusters.some((x) => x.id === id)).length;
        return `<option value="${id}">${esc(c.label)}（${n}）</option>`;
      }).join("")}</optgroup>`).join("");
  }

  function matches(p) {
    if (state.cats.size && !state.cats.has(p.category)) return false;
    if (state.parties.size && !state.parties.has(p.partyGroup)) return false;
    if (state.cluster && !p.clusters.some((c) => c.id === state.cluster)) return false;
    if (state.q) {
      const hay = [p.name, p.org, p.title, p.party, p.faction, p.bio, ...p.clusters.map((c) => clusters[c.id].label)].join(" ").toLowerCase();
      if (!hay.includes(state.q.toLowerCase())) return false;
    }
    return true;
  }

  /* ── Cards ─────────────────────────────── */
  function cardHTML(p) {
    const pc = `var(${PARTY[p.partyGroup].v})`;
    return `<button class="card" data-id="${p.id}" style="--pc:${pc}">
      <span class="org">${hl(p.org, state.q)}</span>
      <span class="name">${hl(p.name, state.q)}</span>
      <span class="title">${esc(p.title)}</span>
      <span class="meta">
        <span class="party"><i class="dot" style="background:${pc}"></i>${esc(p.party)}</span>
        <span class="faction">${hl(p.faction, state.q)}</span>
      </span>
    </button>`;
  }

  function renderCards() {
    const list = DATA.people.filter(matches);
    let groups;
    if (state.sort === "party") {
      groups = Object.keys(PARTY).map((k) => [PARTY[k].label, list.filter((p) => p.partyGroup === k)]);
    } else if (state.sort === "cluster") {
      groups = Object.entries(clusters).map(([id, c]) => [c.label, list.filter((p) => p.clusters[0].id === id)]);
    } else if (state.sort === "name") {
      const coll = new Intl.Collator("zh-Hant-TW-u-co-stroke");
      groups = [[null, [...list].sort((a, b) => coll.compare(a.name, b.name))]];
    } else {
      groups = CATS.map((c) => [c, list.filter((p) => p.category === c)]);
    }
    $("#grid").innerHTML = groups.filter(([, g]) => g.length).map(([h, g]) =>
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
    const pc = `var(${PARTY[p.partyGroup].v})`;
    const rel = related(p);
    $("#d-body").innerHTML = `
      <div class="cat">${esc(p.category)}</div>
      <h2 id="d-name">${esc(p.name)}</h2>
      <p class="role">${esc(p.org)}　${esc(p.title)}</p>
      <dl class="facts">
        <div><dt>政黨</dt><dd><span class="party"><i class="dot" style="background:${pc}"></i>${esc(p.party)}</span></dd></div>
        <div><dt>派系／背景</dt><dd>${esc(p.faction)}</dd></div>
      </dl>
      <p class="bio">${esc(p.bio)}</p>
      <h3>歸類群組</h3>
      <div class="cluster-tags">${p.clusters.map((c) =>
        `<button class="chip" data-cluster="${c.id}">${esc(clusters[c.id].label)}${c.w < 1 ? '<span class="n">友好／淵源</span>' : ""}</button>`).join("")}</div>
      ${rel.length ? `<h3>相關人物</h3><div class="rel">${rel.map((r) =>
        `<button data-id="${r.p.id}"><i class="dot" style="background:var(${PARTY[r.p.partyGroup].v})"></i>
          <span><span class="rn">${esc(r.p.name)}</span><br><span style="font-size:12px;color:var(--ink-3)">${esc(r.p.org)} ${esc(r.p.title)}</span></span>
          <span class="rt" ${r.edge ? 'style="color:var(--accent)"' : ""}>${esc(r.note)}</span></button>`).join("")}</div>` : ""}
      <button class="btn" data-locate="${p.id}">在派系星圖中定位 →</button>`;
    const d = $("#drawer");
    d.classList.add("is-open");
    d.setAttribute("aria-hidden", "false");
    $("#scrim").hidden = false;
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
    history.replaceState(null, "", location.pathname + (currentView !== "cards" ? "#" + currentView : ""));
  }

  /* ── Views ─────────────────────────────── */
  let currentView = "cards";
  function setView(v) {
    currentView = v;
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t.dataset.view === v;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on);
    });
    document.querySelectorAll(".view").forEach((s) => s.classList.toggle("is-active", s.id === "view-" + v));
    document.body.classList.toggle("on-graph", v === "graph");
    if (v === "graph") Graph.init();
  }
  function route() {
    const h = location.hash.slice(1);
    if (["cards", "graph", "about"].includes(h)) setView(h);
    else if (/^p\d+$/.test(h)) openPerson(h, false);
  }

  /* ── UI bindings ───────────────────────── */
  function bindUI() {
    document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
      setView(t.dataset.view);
      history.replaceState(null, "", t.dataset.view === "cards" ? location.pathname : "#" + t.dataset.view);
      if (t.dataset.view !== "graph") window.scrollTo({ top: Math.min(window.scrollY, $(".masthead").offsetHeight), behavior: "smooth" });
      else $(".tabs").scrollIntoView({ behavior: "smooth" });
    }));

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
    $("#reset").addEventListener("click", resetFilters);

    $("#grid").addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) openPerson(c.dataset.id); });
    $("#d-body").addEventListener("click", (e) => {
      const r = e.target.closest("[data-id]");
      if (r) return openPerson(r.dataset.id);
      const c = e.target.closest("[data-cluster]");
      if (c) {
        resetFilters();
        state.cluster = c.dataset.cluster; $("#f-cluster").value = state.cluster;
        closeDrawer(); setView("cards"); renderCards();
        $("#view-cards").scrollIntoView({ behavior: "smooth" });
        return;
      }
      const l = e.target.closest("[data-locate]");
      if (l) { closeDrawer(); setView("graph"); history.replaceState(null, "", "#graph"); $(".tabs").scrollIntoView(); Graph.focus(l.dataset.locate); }
    });
    $("#scrim").addEventListener("click", closeDrawer);
    $("#d-close").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
      if (e.key === "/" && document.activeElement.tagName !== "INPUT" && currentView === "cards") { e.preventDefault(); $("#q").focus(); }
    });
    window.addEventListener("hashchange", route);
  }
  function resetFilters() {
    state.cats.clear(); state.parties.clear(); state.cluster = ""; state.q = "";
    $("#q").value = ""; $("#f-cluster").value = "";
    document.querySelectorAll("#f-category .chip, #f-party .chip").forEach((b) => b.setAttribute("aria-pressed", "false"));
    renderCards();
  }

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
        g.classed("zoomed-out", e.transform.k < 0.75);
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

      // 主題切換時重繪節點顏色
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
      document.querySelectorAll("#g-category .chip").forEach((b) => b.setAttribute("aria-pressed", cats.has(b.dataset.v)));
    }

    function buildGraphUI() {
      $("#legend").innerHTML = Object.values(PARTY).map((p) => `<span><i class="dot" style="background:var(${p.v})"></i>${p.short}</span>`).join("")
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

    return { init, focus };
  })();
})();
