(() => {
  "use strict";
  const { catalog: C, recipes: R } = window.RECIPE_DATA;
  const byId = Object.fromEntries(R.map(r => [r.id, r]));

  /* ---------------- constants ---------------- */
  const LEVELS = { low: { f: 0.5, label: "Light", target: 1900 }, normal: { f: 0.7, label: "Normal", target: 2500 }, big: { f: 1, label: "Big eater", target: 3300 } };
  const MEALS = { main: { label: "Lunch & dinner", short: "Lunch · Dinner", color: "var(--main)" }, bfast: { label: "Breakfast", short: "Breakfast batch", color: "var(--bfast)" }, quick: { label: "Quick breakfast", short: "Single serving", color: "var(--quick)" } };
  const AISLES = [
    ["Meat", "🥩", "#f6d5cc"], ["Dairy & eggs", "🥚", "#fbeac3"], ["Produce", "🥦", "#d6efd9"], ["Frozen", "❄️", "#d6e6f8"],
    ["Grains & bakery", "🍞", "#f3e2c8"], ["Canned & sauces", "🥫", "#f7d9cf"], ["Pantry", "🫙", "#e9e0d2"], ["Spices", "🌶️", "#f4d6d6"], ["Other", "🛒", "#e5e5e5"],
  ];
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MEAT_KEYS = new Set(Object.keys(C).filter(k => C[k].cat === "Meat").concat(["broth", "cbroth", "creamsoup", "oyster"]));

  /* ---------------- derived recipe info ---------------- */
  for (const r of R) {
    const keys = new Set(r.ing.map(i => i.key).filter(Boolean));
    const base = (r.base || "").toLowerCase();
    const allText = r.steps.map(s => s.title + " " + s.text).join(" ").toLowerCase();
    const f = new Set();
    if (![...keys].some(k => MEAT_KEYS.has(k))) f.add("veg");
    if (/pasta|noodle|orzo|gnocchi|lasagna|macaroni|spaghetti/.test(base) || ["pasta", "spaghetti", "orzo", "lasagna", "gnocchi"].some(k => keys.has(k))) f.add("pasta");
    if (/rice|basmati/.test(base)) f.add("rice");
    if (/potato|pierog|hash/.test(base)) f.add("potato");
    if (["tortilla", "salsa", "tacoseas", "ench", "fajitaseas"].some(k => keys.has(k)) || r.tags.includes("Tex-Mex")) f.add("texmex");
    if (["soy", "teriyaki", "stirsauce", "sweetchili", "peanutsauce", "curry", "hgsauce", "sesoil"].some(k => keys.has(k))) f.add("asian");
    if (!/\boven\b|bake\b|baking dish|broil/.test(allText)) f.add("nooven");
    if ((r.fib || 0) >= 15) f.add("fibre");
    if (r.p >= 75) f.add("protein");
    r.mins = parseInt(String(r.time || "").replace(/[^\d]/g, "")) || 999;
    if (r.mins <= 45) f.add("fast");
    r.flags = f;
    r.search = (r.name + " " + r.short + " " + r.base + " " + r.tags.join(" ") + " " + r.ing.map(i => i.name).join(" ")).toLowerCase();
  }
  const MY_FILTERS = [["fav", "♥ Favourites"], ["rated", "★ Rated"], ["notes", "✎ With my notes"]];
  const FILTERS = [
    ["veg", "Vegetarian"], ["pasta", "Pasta"], ["rice", "Rice"], ["potato", "Potatoes"], ["texmex", "Tex-Mex"], ["asian", "Asian-style"],
    ["fibre", "High fibre (15 g+)"], ["protein", "High protein"], ["fast", "45 min or less"], ["nooven", "No oven"],
  ];

  /* ---------------- state ---------------- */
  const KEY = "batchkitchen.v1";
  const defaults = { level: "normal", portions: 7, picks: [], ticks: {}, own: [], plan: {}, targets: {}, meal: "all", filters: [], sort: "name", view: "cards", metric: "fib", tab: "recipes", theme: null, accent: "green", fav: [], ratings: {}, notes: {} };
  let S = { ...defaults };
  try { S = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch (e) { /* storage blocked */ }
  S.picks = S.picks.filter(id => byId[id]);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

  const eater = () => LEVELS[S.level].f;
  const factor = r => (S.portions / r.portions) * eater();   // ingredient multiplier for a recipe
  const portionsOf = r => r.meal === "quick" ? S.portions : S.portions;

  /* ---------------- formatting ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtInt = n => Math.round(n).toLocaleString("en-CA");
  const FR = [[0, ""], [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"], [1, ""]];
  const FR_HALF = [[0, ""], [0.5, "½"], [1, ""]];
  function frac(n, halves = false) {
    if (n >= 10) return String(Math.round(n));
    if (halves && n < 0.5) return n < 0.375 ? "¼" : "½";
    const w = Math.floor(n), d = n - w;
    const set = halves ? FR_HALF : (n < 1 ? FR : FR.filter(f => f[1] !== "⅛"));
    let best = set[0]; for (const fr of set) if (Math.abs(fr[0] - d) < Math.abs(best[0] - d)) best = fr;
    const whole = best[0] === 1 ? w + 1 : w;
    if (whole === 0 && !best[1]) return n > 0 ? "⅛" : "0";
    return (whole ? whole : "") + best[1];
  }
  function roundNice(n) {
    if (n < 20) return Math.max(1, Math.round(n));
    if (n < 100) return Math.round(n / 5) * 5;
    if (n < 1000) return Math.round(n / 10) * 10;
    return Math.round(n / 50) * 50;
  }
  function fmtMass(g, unit) {
    const big = unit === "g" ? "kg" : "L";
    if (g >= 1000) return (Math.round(g / 100) / 10).toString().replace(/\.0$/, "") + " " + big;
    return roundNice(g) + " " + unit;
  }
  function fmtQty(q, u, key) {
    if (key === "oil" && q < 120) return spoon(q / 5);
    if (u === "g" || u === "mL") return fmtMass(q, u);
    if (u === "tsp") return spoon(q);
    return frac(q, true);
  }
  const spoon = tsp => tsp >= 2.75 ? frac(tsp / 3) + " tbsp" : frac(tsp) + " tsp";
  const parseNum = s => {
    const m = String(s).match(/^(\d+(?:\.\d+)?)?\s*([½⅓⅔¼¾⅛])?$/);
    if (!m) return NaN;
    const map = { "½": .5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": .25, "¾": .75, "⅛": .125 };
    return parseFloat(m[1] || 0) + (m[2] ? map[m[2]] : 0);
  };
  const NUM = "(\\d+(?:\\.\\d+)?\\s?[½⅓⅔¼¾⅛]?|[½⅓⅔¼¾⅛])";
  function scaleOne(numStr, unit, f) {
    const v = parseNum(numStr.replace(/\s/g, "")) * f;
    if (isNaN(v)) return numStr + (unit ? " " + unit : "");
    const u = unit.toLowerCase();
    if (u === "g" || u === "kg") { const g = u === "kg" ? v * 1000 : v; return fmtMass(g, "g"); }
    if (u === "ml" || u === "l") { const ml = u === "l" ? v * 1000 : v; return fmtMass(ml, "mL"); }
    if (u === "tbsp" && v < 0.9) return spoon(v * 3);
    if (u === "tsp" || u === "tbsp" || /^cups?$/.test(u) || u === "") return frac(v) + (unit ? " " + unit : "");
    return frac(v, true) + " " + unit;   // counted things: eggs, cans, cloves…
  }
  // amounts that describe ONE portion ("1¾ cups each", "Top each with 100 g") scale by appetite only
  const PER_PORTION = /\beach\b|per (container|portion|bowl|muffin|cup|burrito|sandwich)|on top|on each/i;
  // scale quantities with units inside free text (steps / ingredient notes)
  const UNIT_RE = new RegExp(NUM + "(?:\\s?[–-]\\s?" + NUM + ")?\\s?(kg|g|mL|L|cups?|tbsp|tsp|eggs?|cans?|jars?|cloves|tortillas|bananas|packets?|bottles?|scoops|slices|stalks|onions?|peppers|bell peppers|carrots|limes?|lemons?)\\b(?!\\s?(?:can|jar|bottle|carton|tub|bag|box|pack|brick|block|clamshell)\\b)", "g");
  function scaleText(t, f, mark = true, perPortion = false) {
    if (Math.abs(f - 1) < 0.001 && Math.abs(eater() - 1) < 0.001) return esc(t);
    let out = "", last = 0;
    t.replace(UNIT_RE, (m, a, b, unit, idx) => {
      const before = t.slice(Math.max(0, idx - 22), idx), after = t.slice(idx + m.length).split(/[.;:]/)[0].slice(0, 45);
      const k = perPortion || PER_PORTION.test(before + " " + after) ? eater() : f;
      if (Math.abs(k - 1) < 0.001) { out += esc(t.slice(last, idx + m.length)); last = idx + m.length; return m; }
      const rep = b ? scaleOne(a, "", k).trim() + "–" + scaleOne(b, unit, k) : scaleOne(a, unit, k);
      out += esc(t.slice(last, idx)) + (mark ? `<mark class="sc">${esc(rep)}</mark>` : esc(rep));
      last = idx + m.length;
      return m;
    });
    return out + esc(t.slice(last));
  }
  function stepText(t, f, perPortion = false) {
    let s = scaleText(t, f, true, perPortion);
    if (S.portions !== 7) s = s.replace(/\b7 (containers|portions|bowls)\b/g, `${S.portions} $1`).replace(/\binto 7\b/g, `into ${S.portions}`).replace(/\bfor 7 portions\b/g, `for ${S.portions} portions`);
    return s;
  }
  function ingDisplay(i, f) {
    const paren = (i.text.match(/\(([^)]*)\)/) || [])[1];
    if (i.key && i.qty != null) {
      const c = C[i.key];
      let main = fmtQty(i.qty * f, c.u, i.key);
      if (c.u === "pc") { const word = i.text.replace(/\(.*?\)/g, "").replace(/^[\d.½⅓⅔¼¾⅛\s]+/, "").trim(); if (word && !/^\d/.test(word)) main += " " + word; }
      if (paren && /cup|tbsp|tsp|mL|scoop|slice/.test(paren) && !/~/.test(paren)) main += ` <span class="muted">(${scaleText(paren, f, false)})</span>`;
      return main;
    }
    if (/^(—|to taste|-)$/.test(i.text.trim())) return "to taste";
    return scaleText(i.text, f, false);
  }
  const gImg = name => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(name + " recipe")}`;
  const toast = msg => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 1800); };
  const m = (r, k) => r[k] == null ? null : r[k] * eater();

  /* ---------------- controls ---------------- */
  function renderControls() {
    $$("#levelSeg button").forEach(b => b.setAttribute("aria-checked", b.dataset.level === S.level));
    $("#porInput").value = S.portions;
    const pct = Math.round(eater() * 100);
    $("#scaleNote").innerHTML = `Each portion is <b>${pct}%</b> of the original · <b>${S.portions}</b> portions per batch`;
  }
  $("#levelSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.level = b.dataset.level; save(); renderAll(); });
  const setPortions = v => { v = Math.max(1, Math.min(40, Math.round(v) || 7)); S.portions = v; save(); renderAll(); };
  $("#porMinus").onclick = () => setPortions(S.portions - 1);
  $("#porPlus").onclick = () => setPortions(S.portions + 1);
  $("#porInput").addEventListener("change", e => setPortions(+e.target.value));

  /* ---------------- tabs ---------------- */
  function showTab(tab) {
    S.tab = tab; save();
    $$(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab));
    $$(".panel").forEach(p => p.hidden = p.id !== "tab-" + tab);
    updateTray();
    if (tab === "plan") renderPlan();
    if (tab === "grocery") renderGrocery();
  }
  $$(".tabs button").forEach(b => b.onclick = () => { showTab(b.dataset.tab); window.scrollTo({ top: 0 }); });

  /* ---------------- theme ---------------- */
  function applyTheme() { if (S.theme) document.documentElement.dataset.theme = S.theme; else delete document.documentElement.dataset.theme; }
  $("#themeBtn").onclick = () => {
    const dark = S.theme ? S.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    S.theme = dark ? "light" : "dark"; save(); applyTheme();
  };

  /* ---------------- accent color (click the logo) ---------------- */
  const ACCENTS = {
    green: ["Green", "#1f8a4c", "#4cc47f"], teal: ["Teal", "#0f7f86", "#3cc3c9"], blue: ["Blue", "#2f6fd6", "#6aa2f5"], indigo: ["Indigo", "#5b4fd6", "#9a90f5"],
    purple: ["Purple", "#8a3fc2", "#c08af0"], pink: ["Pink", "#c93a7c", "#f07fb4"], red: ["Red", "#d1373a", "#f57a73"], orange: ["Orange", "#e8572a", "#ff7a4d"],
    amber: ["Amber", "#b86e00", "#f2b84f"], olive: ["Olive", "#6b7a1c", "#b6c95a"], brown: ["Cocoa", "#8a5a3c", "#d0a07c"], slate: ["Slate", "#475569", "#a3b2c7"],
  };
  function applyAccent() {
    const a = ACCENTS[S.accent] || ACCENTS.green, root = document.documentElement.style;
    root.setProperty("--accent-l", a[1]); root.setProperty("--accent-d", a[2]);
    $$("#swatches .sw").forEach(b => b.setAttribute("aria-checked", b.dataset.accent === (S.accent || "green")));
  }
  $("#swatches").innerHTML = Object.entries(ACCENTS).map(([k, [name, c]]) => `<button class="sw" role="radio" data-accent="${k}" style="--sw:${c}" aria-label="${name}" title="${name}"></button>`).join("");
  const pop = $("#accentPop"), brandBtn = $("#brandBtn");
  const setPop = open => { pop.hidden = !open; brandBtn.setAttribute("aria-expanded", open); };
  brandBtn.onclick = e => { e.stopPropagation(); if ($("#contactPop")) { $("#contactPop").hidden = true; $("#contactBtn").setAttribute("aria-expanded", false); } setPop(pop.hidden); };
  $("#swatches").addEventListener("click", e => { const b = e.target.closest(".sw"); if (!b) return; S.accent = b.dataset.accent; save(); applyAccent(); });
  document.addEventListener("click", e => { if (!pop.hidden && !e.target.closest(".brand-wrap")) setPop(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) { setPop(false); brandBtn.focus(); } });

  /* ---------------- contact popover ---------------- */
  const cPop = $("#contactPop"), cBtn = $("#contactBtn");
  const setCPop = open => { cPop.hidden = !open; cBtn.setAttribute("aria-expanded", open); };
  cBtn.onclick = e => { e.stopPropagation(); setPop(false); setCPop(cPop.hidden); };
  document.addEventListener("click", e => { if (!cPop.hidden && !e.target.closest(".contact-wrap")) setCPop(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !cPop.hidden) { setCPop(false); cBtn.focus(); } });

  /* ---------------- favourites, ratings, notes ---------------- */
  const isFav = id => S.fav.includes(id);
  const rating = id => S.ratings[id] || 0;
  const note = id => (S.notes[id] && S.notes[id].t) || "";
  function hasFlag(r, f) {
    if (f === "fav") return isFav(r.id);
    if (f === "rated") return rating(r.id) > 0;
    if (f === "notes") return !!note(r.id).trim();
    return r.flags.has(f);
  }
  const ICON_HEART = `<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9-9.2C1.6 7.3 3.8 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.4 0 5.6 3.3 4.2 6.8C19 15.6 12 20 12 20z"/></svg>`;
  const ICON_STAR = `<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>`;
  const fmtDate = t => new Date(t).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  function refreshRecipe(id) {
    if (S.filters.some(f => MY_FILTERS.some(([k]) => k === f)) || S.sort === "rating") { renderRecipes(); return; }
    $$(`.card[data-id="${id}"]`).forEach(el => el.outerHTML = card(byId[id]));
  }
  function favBtnHTML(id) {
    const on = isFav(id);
    return `<button class="btn ghost small fav-toggle ${on ? "on" : ""}" data-fav="${id}" aria-pressed="${on}">${ICON_HEART}${on ? "Favourite" : "Add to favourites"}</button>`;
  }
  function starsHTML(id) {
    const v = rating(id);
    return `<div class="stars" role="group" aria-label="Your rating">${[1, 2, 3, 4, 5].map(n => `<button class="star ${n <= v ? "on" : ""}" data-rate="${id}" data-n="${n}" aria-label="${n} star${n > 1 ? "s" : ""}" aria-pressed="${n <= v}">${ICON_STAR}</button>`).join("")}</div>`;
  }
  function toggleFav(id) {
    S.fav = isFav(id) ? S.fav.filter(x => x !== id) : [...S.fav, id]; save();
    toast(isFav(id) ? `♥ Added to favourites` : `Removed from favourites`);
    const b = $(`#detail [data-fav="${id}"]`); if (b) b.outerHTML = favBtnHTML(id);
    refreshRecipe(id); renderChips();
  }
  function setRating(id, n) {
    if (rating(id) === n) delete S.ratings[id]; else S.ratings[id] = n;
    save();
    const st = $("#detail .stars"); if (st) st.outerHTML = starsHTML(id);
    const lbl = $("#rateLbl"); if (lbl) lbl.textContent = rating(id) ? ["", "Not for me", "It was OK", "Good", "Really good", "Loved it!"][rating(id)] : "Tap to rate";
    refreshRecipe(id); renderChips();
  }

  /* ---------------- recipes view ---------------- */
  function filtered() {
    const q = $("#search").value.trim().toLowerCase();
    let list = R.filter(r => (S.meal === "all" || r.meal === S.meal) && S.filters.every(f => hasFlag(r, f)) && (!q || q.split(/\s+/).every(w => r.search.includes(w))));
    const sorters = {
      name: (a, b) => a.name.localeCompare(b.name), p: (a, b) => b.p - a.p, fib: (a, b) => (b.fib ?? -1) - (a.fib ?? -1),
      kcal: (a, b) => b.kcal - a.kcal, kcalAsc: (a, b) => a.kcal - b.kcal, time: (a, b) => a.mins - b.mins, pdens: (a, b) => b.p / b.kcal - a.p / a.kcal,
      rating: (a, b) => rating(b.id) - rating(a.id) || isFav(b.id) - isFav(a.id) || a.name.localeCompare(b.name),
    };
    return list.sort(sorters[S.sort] || sorters.name);
  }
  function renderChips() {
    const counts = { all: R.length }; R.forEach(r => counts[r.meal] = (counts[r.meal] || 0) + 1);
    $("#mealChips").innerHTML = [["all", "All recipes", "var(--ink-3)"], ...Object.entries(MEALS).map(([k, v]) => [k, v.label, v.color])]
      .map(([k, l, c]) => `<button class="chip" data-meal="${k}" aria-pressed="${S.meal === k}"><span class="dot" style="background:${c}"></span>${l}<span class="ct">${counts[k]}</span></button>`).join("");
    const myCt = { fav: S.fav.length, rated: Object.keys(S.ratings).length, notes: Object.values(S.notes).filter(n => n.t && n.t.trim()).length };
    $("#tagChips").innerHTML = MY_FILTERS.map(([k, l]) => `<button class="chip mine" data-f="${k}" aria-pressed="${S.filters.includes(k)}">${l}<span class="ct">${myCt[k]}</span></button>`).join("") + `<span class="chip-sep" aria-hidden="true"></span>` + FILTERS.map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${S.filters.includes(k)}">${l}</button>`).join("")
      + (S.filters.length ? `<button class="chip" data-clear="1">✕ Clear</button>` : "");
    $("#sort").value = S.sort;
    const nf = S.filters.length; $("#tagCount").textContent = nf; $("#tagCount").hidden = !nf;
    $$(".view-toggle button").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === S.view));
  }
  $("#mealChips").addEventListener("click", e => { const b = e.target.closest("[data-meal]"); if (!b) return; S.meal = b.dataset.meal; save(); renderRecipes(); });
  const onFilterClick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.clear) S.filters = [];
    else { const f = b.dataset.f; S.filters = S.filters.includes(f) ? S.filters.filter(x => x !== f) : [...S.filters, f]; }
    save(); renderRecipes();
  };
  $("#tagChips").addEventListener("click", onFilterClick);
  $("#tagsToggle").onclick = e => { const b = e.currentTarget, open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", open); };
  $("#sort").onchange = e => { S.sort = e.target.value; save(); renderRecipes(); };
  $("#search").addEventListener("input", () => renderRecipes());
  $$(".view-toggle button").forEach(b => b.onclick = () => { S.view = b.dataset.view; save(); renderRecipes(); });

  const ICON_CLOCK = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
  const ICON_BOWL = `<svg viewBox="0 0 24 24"><path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/></svg>`;
  const ICON_HAND = `<svg viewBox="0 0 24 24"><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 14a1.5 1.5 0 0 1 2.5-1.6L7 13"/></svg>`;
  const ICON_PLUS = `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`;
  const ICON_CHECK = `<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>`;
  const ICON_X = `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

  function ebar(r) {
    const p = r.p * 4, c = r.c * 4, f = r.f * 9, t = p + c + f;
    return `<div class="ebar" title="Energy from protein ${Math.round(p / t * 100)}% · carbs ${Math.round(c / t * 100)}% · fat ${Math.round(f / t * 100)}%"><span class="bp" style="width:${p / t * 100}%"></span><span class="bc" style="width:${c / t * 100}%"></span><span class="bf" style="width:${f / t * 100}%"></span></div>`;
  }
  function card(r) {
    const picked = S.picks.includes(r.id), M = MEALS[r.meal];
    const rv = rating(r.id), nt = note(r.id).trim();
    const mine = [rv ? `<span class="tag mine-rate">★ ${rv}/5</span>` : "", nt ? `<span class="tag mine-note" title="${esc(nt)}">✎ My note</span>` : ""].join("");
    const tags = mine + [...(r.flags.has("veg") ? [`<span class="tag veg">Vegetarian</span>`] : []), ...r.tags.filter(t => !/vegetarian/i.test(t)).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`)].join("");
    const fav = isFav(r.id);
    return `<article class="card ${picked ? "picked" : ""}" data-id="${r.id}">
      <button class="fav-btn ${fav ? "on" : ""}" data-fav="${r.id}" aria-pressed="${fav}" aria-label="${fav ? "Remove from" : "Add to"} favourites" title="${fav ? "Remove from" : "Add to"} favourites">${ICON_HEART}</button>
      <div class="card-top" data-open="${r.id}" tabindex="0" role="button" aria-label="Open ${esc(r.name)}">
        <div class="eyebrow"><span class="dot" style="background:${M.color}"></span>${M.short}</div>
        <h3><a href="${gImg(r.name)}" target="_blank" rel="noopener" title="See photos">${esc(r.name)}</a></h3>
        <p class="short">${esc(r.short)}</p>
        <div class="meta">
          ${r.time ? `<span>${ICON_CLOCK}${esc(r.time)}</span>` : ""}
          ${r.hands ? `<span>${ICON_HAND}${esc(r.hands)} hands-on</span>` : ""}
          ${r.base ? `<span>${ICON_BOWL}${esc(r.base)}</span>` : ""}
        </div>
        <div class="tags">${tags}</div>
        <div class="macros">
          <div class="macro-row">
            <div class="kcal"><b>${fmtInt(m(r, "kcal"))}</b><small>kcal</small></div>
            <div class="mp"><b>${Math.round(m(r, "p"))}</b><small>Protein</small></div>
            <div><b>${Math.round(m(r, "c"))}</b><small>Carbs</small></div>
            <div><b>${Math.round(m(r, "f"))}</b><small>Fat</small></div>
            <div class="mfib"><b>${r.fib == null ? "–" : Math.round(m(r, "fib"))}</b><small>Fibre</small></div>
          </div>
          ${ebar(r)}
        </div>
      </div>
      <div class="card-foot">
        <button class="btn ghost small" data-open="${r.id}">View recipe</button>
        <button class="btn small ${picked ? "picked" : "accent"}" data-pick="${r.id}" aria-pressed="${picked}">${picked ? ICON_CHECK + "Picked" : ICON_PLUS + "Pick"}</button>
      </div>
    </article>`;
  }
  function renderRecipes() {
    renderChips();
    const list = filtered();
    $("#resultCount").textContent = `${list.length} recipe${list.length === 1 ? "" : "s"} · macros per ${LEVELS[S.level].label.toLowerCase()} portion`;
    $("#emptyMsg").hidden = list.length > 0;
    const chart = S.view === "chart";
    $("#chartWrap").hidden = !chart || !list.length;
    if (chart) renderChart(list);
    $("#grid").innerHTML = list.map(card).join("");
  }
  function togglePick(id) {
    const on = !S.picks.includes(id);
    S.picks = on ? [...S.picks, id] : S.picks.filter(x => x !== id);
    save();
    toast(on ? `Added ${byId[id].name}` : `Removed ${byId[id].name}`);
    renderBadge(); updateTray();
    $$(`.card[data-id="${id}"]`).forEach(el => el.outerHTML = card(byId[id]));
    const dp = $(`#detail [data-pick="${id}"]`);
    if (dp) { dp.className = `btn ${on ? "picked" : "accent"}`; dp.innerHTML = on ? ICON_CHECK + "Picked for groceries" : ICON_PLUS + "Add to groceries"; }
    if (S.tab === "grocery") renderGrocery();
  }
  document.addEventListener("click", e => {
    const pk = e.target.closest("[data-pick]"); if (pk) { e.preventDefault(); togglePick(pk.dataset.pick); return; }
    const fv = e.target.closest("[data-fav]"); if (fv) { e.preventDefault(); toggleFav(fv.dataset.fav); return; }
    const rt = e.target.closest("[data-rate]"); if (rt) { e.preventDefault(); setRating(rt.dataset.rate, +rt.dataset.n); return; }
    if (e.target.closest("a")) return;
    const op = e.target.closest("[data-open]"); if (op) openDetail(op.dataset.open);
  });
  document.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".card-top")) { e.preventDefault(); openDetail(e.target.dataset.open); }
  });

  /* ---------------- chart ---------------- */
  const METRICS = { fib: ["Fibre", "g", "var(--fib)", 15], p: ["Protein", "g", "var(--p)", null], kcal: ["Calories", "kcal", "var(--c)", null], pdens: ["Protein / 100 kcal", "g", "var(--f)", null] };
  function renderChart(list) {
    $("#metricChips").innerHTML = Object.entries(METRICS).map(([k, v]) => `<button class="chip" data-metric="${k}" aria-pressed="${S.metric === k}">${v[0]}</button>`).join("");
    const [label, unit, , ref] = METRICS[S.metric];
    const val = r => S.metric === "pdens" ? r.p / r.kcal * 100 : r[S.metric] == null ? null : r[S.metric] * eater();
    const rows = list.filter(r => val(r) != null).sort((a, b) => val(b) - val(a));
    const max = Math.max(...rows.map(val), ref ? ref * eater() : 0);
    const refV = ref ? ref * eater() : null;
    $("#chartNote").textContent = rows.length < list.length ? `${list.length - rows.length} recipe(s) have no ${label.toLowerCase()} data` : (refV ? `Dashed line: ${Math.round(refV)} g fibre, a filling target` : "");
    $("#chart").innerHTML = `<div class="bars">${rows.map(r => {
      const v = val(r);
      return `<button class="bar" data-open="${r.id}"><span class="bl">${esc(r.name)}</span><span class="bt"><span style="width:${v / max * 100}%;background:${MEALS[r.meal].color}"></span>${refV ? `<i class="ref" style="left:${refV / max * 100}%"></i>` : ""}</span><span class="bv">${S.metric === "pdens" ? v.toFixed(1) : fmtInt(v)}${unit === "g" ? "g" : ""}</span></button>`;
    }).join("")}</div>
    <div class="legend">${Object.values(MEALS).map(v => `<span><i style="background:${v.color}"></i>${v.label}</span>`).join("")}</div>`;
  }
  $("#metricChips").addEventListener("click", e => { const b = e.target.closest("[data-metric]"); if (!b) return; S.metric = b.dataset.metric; save(); renderRecipes(); });

  /* ---------------- detail dialog ---------------- */
  const dlg = $("#detail");
  function openDetail(id) {
    const r = byId[id]; if (!r) return;
    const f = factor(r), picked = S.picks.includes(id), n = S.portions;
    const scaled = Math.abs(f - 1) > 0.001;
    const tags = [...(r.flags.has("veg") ? [`<span class="tag veg">Vegetarian</span>`] : []), ...r.tags.filter(t => !/vegetarian/i.test(t)).map(t => `<span class="tag">${esc(t)}</span>`)].join("");
    $("#dBody").innerHTML = `
      <div class="d-head">
        <button class="d-close" aria-label="Close" data-close>${ICON_X}</button>
        <div class="eyebrow"><span class="dot" style="background:${MEALS[r.meal].color}"></span>${MEALS[r.meal].short}</div>
        <h2 id="dTitle"><a href="${gImg(r.name)}" target="_blank" rel="noopener" title="See photos">${esc(r.name)} ↗</a></h2>
        <p class="short">${esc(r.short)}</p>
        <div class="meta">
          ${r.time ? `<span>${ICON_CLOCK}${esc(r.time)}</span>` : ""}${r.hands ? `<span>${ICON_HAND}${esc(r.hands)} hands-on</span>` : ""}${r.base ? `<span>${ICON_BOWL}${esc(r.base)}</span>` : ""}
        </div>
        <div class="tags">${tags}</div>
        <div class="mine-row">
          ${favBtnHTML(r.id)}
          <div class="rate-wrap">${starsHTML(r.id)}<span class="rate-lbl" id="rateLbl">${rating(r.id) ? ["", "Not for me", "It was OK", "Good", "Really good", "Loved it!"][rating(r.id)] : "Tap to rate"}</span></div>
        </div>
      </div>
      <div class="d-body">
        <div class="d-stats">
          <div class="stat"><b>${fmtInt(m(r, "kcal"))}</b><small>kcal / portion</small></div>
          <div class="stat sp"><b>${Math.round(m(r, "p"))}g</b><small>Protein</small></div>
          <div class="stat sc"><b>${Math.round(m(r, "c"))}g</b><small>Carbs</small></div>
          <div class="stat sf"><b>${Math.round(m(r, "f"))}g</b><small>Fat</small></div>
          <div class="stat sfib"><b>${r.fib == null ? "–" : Math.round(m(r, "fib")) + "g"}</b><small>Fibre</small></div>
        </div>
        ${ebar(r)}
        <p class="batch-line">Whole batch (${n} ${LEVELS[S.level].label.toLowerCase()} portion${n === 1 ? "" : "s"}): <span class="num">${fmtInt(m(r, "kcal") * n)} kcal · ${fmtInt(m(r, "p") * n)} g protein · ${fmtInt(m(r, "c") * n)} g carbs · ${fmtInt(m(r, "f") * n)} g fat</span></p>

        <div class="d-sec notes-sec">
          <h3>My notes <small id="noteSaved">${S.notes[r.id] && note(r.id) ? "Last edited " + fmtDate(S.notes[r.id].at) : ""}</small></h3>
          <textarea id="noteBox" data-note="${r.id}" rows="3" maxlength="4000" placeholder="Leave yourself a note for next time: swaps you made, what to change, how it turned out…">${esc(note(r.id))}</textarea>
          <p class="note-hint">Saved automatically, only on this device.</p>
        </div>

        <div class="d-sec">
          <h3>Ingredients <small>for ${n} portion${n === 1 ? "" : "s"}${scaled ? ` · ×${f.toFixed(2)}` : ""}</small></h3>
          <ul class="ing-list">${r.ing.map(i => `<li><span>${esc(i.name)}</span><span>${ingDisplay(i, f)}</span></li>`).join("")}</ul>
          ${r.equip ? `<p class="equip"><b>Equipment:</b> ${esc(r.equip)}</p>` : ""}
        </div>

        <div class="d-sec">
          <h3>Steps</h3>
          ${scaled ? `<div class="note">Highlighted amounts are adjusted for your batch. Times and temperatures stay the same; ${f < 0.75 ? "use smaller pans or dishes and check for doneness a few minutes early" : f > 1.3 ? "you may need bigger pots or an extra batch in the pan" : "pan sizes should still work"}.</div>` : ""}
          <ol class="steps">${r.steps.map(s => `<li>${s.title ? `<div class="st">${esc(s.title)}${s.time ? `<span class="tm">${esc(s.time)}</span>` : ""}</div>` : ""}<p>${stepText(s.text, f)}</p></li>`).join("")}</ol>
        </div>

        ${r.store.length ? `<div class="d-sec"><h3>Storage &amp; serving</h3><div class="store">${r.store.map(s => `<div><b>${esc(s.label)}</b>${stepText(s.text, f, /serve|add|protein/i.test(s.label))}</div>`).join("")}</div></div>` : ""}
      </div>
      <div class="d-foot">
        <button class="btn ghost" data-close>Close</button>
        <button class="btn ${picked ? "picked" : "accent"}" data-pick="${r.id}">${picked ? ICON_CHECK + "Picked for groceries" : ICON_PLUS + "Add to groceries"}</button>
      </div>`;
    dlg.dataset.id = id;
    const nb = $("#noteBox"); autosize(nb);
    if (!dlg.open) dlg.showModal();
    $(".d-inner").scrollTop = 0;
    history.replaceState(null, "", "#" + id);
  }
  dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
  dlg.addEventListener("close", () => {
    history.replaceState(null, "", location.pathname + location.search);
    if (dlg.dataset.id) { refreshRecipe(dlg.dataset.id); renderChips(); }
  });
  function autosize(t) { if (!t) return; t.style.height = "auto"; t.style.height = Math.max(84, t.scrollHeight + 2) + "px"; }
  let noteTimer;
  dlg.addEventListener("input", e => {
    const t = e.target.closest("#noteBox"); if (!t) return;
    autosize(t);
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      const id = t.dataset.note, v = t.value;
      if (v.trim()) S.notes[id] = { t: v, at: Date.now() }; else delete S.notes[id];
      save();
      $("#noteSaved").textContent = v.trim() ? "Saved ✓" : "";
    }, 350);
  });

  /* ---------------- plan ---------------- */
  const SLOTS = [["b", "Breakfast", r => r.meal !== "main"], ["l", "Lunch", r => r.meal === "main"], ["d", "Dinner", r => r.meal === "main"]];
  const target = () => S.targets[S.level] || LEVELS[S.level].target;
  function renderPlan() {
    $("#target").value = target();
    const opts = pred => R.filter(pred).sort((a, b) => a.name.localeCompare(b.name));
    const sortedPicked = id => S.picks.includes(id);
    $("#plan").innerHTML = DAYS.map((d, di) => {
      const day = S.plan[di] || {};
      let tot = 0, p = 0;
      const slots = SLOTS.map(([k, label, pred]) => {
        const sel = day[k]; const r = byId[sel];
        if (r) { tot += m(r, "kcal"); p += m(r, "p"); }
        const list = opts(pred);
        const pickedOpts = list.filter(x => sortedPicked(x.id)), other = list.filter(x => !sortedPicked(x.id));
        const o = x => `<option value="${x.id}" ${x.id === sel ? "selected" : ""}>${esc(x.name)}</option>`;
        return `<div class="slot"><label for="s${di}${k}">${label}</label><select id="s${di}${k}" data-day="${di}" data-slot="${k}" class="${r ? "set" : ""}"><option value="">—</option>${pickedOpts.length ? `<optgroup label="Picked">${pickedOpts.map(o).join("")}</optgroup><optgroup label="All recipes">${other.map(o).join("")}</optgroup>` : other.map(o).join("")}</select></div>`;
      }).join("");
      const t = target(), pct = Math.min(100, tot / t * 100), gap = t - tot;
      return `<div class="day"><h4>${d}${tot ? `<small>${Math.round(p)} g protein</small>` : ""}</h4>${slots}
        <div class="day-total">${tot ? `<div class="k">${fmtInt(tot)} <span class="muted small">/ ${fmtInt(t)} kcal</span></div>
        <div class="meter ${gap < -150 ? "over" : ""}"><span style="width:${pct}%"></span></div>
        <div class="gap-txt">${gap > 50 ? `Snack gap: <b>${fmtInt(gap)}</b> kcal` : gap < -150 ? `<b>${fmtInt(-gap)}</b> kcal over` : "On target"}</div>` : `<div class="gap-txt muted">Nothing planned</div>`}</div></div>`;
    }).join("");
    // summary
    const used = {}; let days = 0, kc = 0, pr = 0, fb = 0;
    DAYS.forEach((_, di) => { const day = S.plan[di] || {}; let any = false; SLOTS.forEach(([k]) => { const r = byId[day[k]]; if (r) { any = true; used[r.id] = (used[r.id] || 0) + 1; kc += m(r, "kcal"); pr += m(r, "p"); fb += m(r, "fib") || 0; } }); if (any) days++; });
    const ids = Object.keys(used);
    $("#planSummary").innerHTML = ids.length ? `
      <div class="stat"><b>${fmtInt(kc / days)}</b><small>Avg kcal / day</small></div>
      <div class="stat sp"><b>${Math.round(pr / days)}g</b><small>Avg protein / day</small></div>
      <div class="stat sfib"><b>${Math.round(fb / days)}g</b><small>Avg fibre / day</small></div>
      <div class="stat"><b>${ids.length}</b><small>Different recipes</small></div>
      ${ids.map(id => { const need = used[id], over = need > S.portions; return `<div class="stat"><b style="font-size:15px;font-family:var(--body)">${esc(byId[id].name)}</b><small style="${over ? "color:var(--warn)" : ""}">${need} of ${S.portions} portions${over ? " · make more!" : ""}</small></div>`; }).join("")}` : "";
  }
  $("#plan").addEventListener("change", e => {
    const s = e.target.closest("select"); if (!s) return;
    const di = s.dataset.day; S.plan[di] = { ...(S.plan[di] || {}), [s.dataset.slot]: s.value || undefined };
    save(); renderPlan();
  });
  $("#target").addEventListener("change", e => { const v = Math.max(1000, Math.min(6000, +e.target.value || LEVELS[S.level].target)); S.targets[S.level] = v; save(); renderPlan(); });
  $("#autoFill").onclick = () => {
    const mains = S.picks.filter(id => byId[id].meal === "main"), bf = S.picks.filter(id => byId[id].meal !== "main");
    if (!mains.length && !bf.length) { toast("Pick some recipes first"); return; }
    DAYS.forEach((_, di) => {
      const cur = S.plan[di] || {};
      S.plan[di] = {
        b: bf.length ? bf[di % bf.length] : cur.b,
        l: mains.length ? mains[0 % mains.length] : cur.l,
        d: mains.length ? mains[(mains.length > 1 ? 1 : 0)] : cur.d,
      };
      if (mains.length > 2) { S.plan[di].l = mains[(di * 2) % mains.length]; S.plan[di].d = mains[(di * 2 + 1) % mains.length]; }
    });
    save(); renderPlan(); toast("Week filled from your picks");
  };
  $("#pickPlanned").onclick = () => {
    const ids = new Set(); Object.values(S.plan).forEach(d => Object.values(d || {}).forEach(id => id && byId[id] && ids.add(id)));
    const add = [...ids].filter(id => !S.picks.includes(id));
    if (!ids.size) { toast("Plan some meals first"); return; }
    S.picks = [...S.picks, ...add]; save(); renderBadge(); updateTray(); renderPlan();
    toast(add.length ? `Added ${add.length} recipe${add.length > 1 ? "s" : ""} to groceries` : "Already in your grocery list");
  };
  $("#clearPlan").onclick = () => { if (!Object.keys(S.plan).length || confirm("Clear the whole week?")) { S.plan = {}; save(); renderPlan(); } };

  /* ---------------- grocery ---------------- */
  function buildList() {
    const items = {};
    for (const id of S.picks) {
      const r = byId[id], f = factor(r);
      for (const i of r.ing) {
        if (i.key === "salt") continue;
        const k = i.key && i.qty != null ? i.key : "x:" + i.name.toLowerCase();
        const it = items[k] || (items[k] = { key: k, name: i.key ? C[i.key].n : i.name, cat: i.key ? C[i.key].cat : "Other", u: i.key ? C[i.key].u : null, qty: 0, texts: [], recipes: [] });
        if (i.key && i.qty != null) it.qty += i.qty * f; else it.texts.push(scaleText(i.text, f, false));
        if (!it.recipes.includes(r.name)) it.recipes.push(r.name);
      }
    }
    return Object.values(items);
  }
  function packHint(it) {
    const c = C[it.key]; if (!c || !c.pack || !it.qty) return "";
    const mm = c.pack.match(/^~?(\d+(?:\.\d+)?)\s?(g|mL|L|kg)\s+(.+)$/);
    if (mm && (it.u === "g" || it.u === "mL")) {
      let size = +mm[1]; if (mm[2] === "L" || mm[2] === "kg") size *= 1000;
      const n = Math.max(1, Math.ceil(it.qty / size - 0.08));
      return `${n} × ${c.pack}`;
    }
    const pm = c.pack.match(/(?:carton|pack|tube) of (\d+)/);
    if (pm && it.u === "pc") { const n = Math.ceil(it.qty / +pm[1] - 0.05); return `${Math.max(1, n)} × ${c.pack}`; }
    if (/bunch|head|loaf|pint|bag|clamshell|jar|box/.test(c.pack)) {
      if (it.key === "garlic") { return `${Math.max(1, Math.ceil(it.qty / 10))} × head`; }
      if (it.key === "potato") return it.qty > 4536 ? `${Math.ceil(it.qty / 4536)} × 10 lb bag` : "";
      return c.pack;
    }
    return "";
  }
  function gQty(it) {
    if (!it.u) return it.texts.join(" + ");
    if (it.u === "pc") { const n = Math.ceil(it.qty - 0.1); return it.key === "garlic" ? `${n} clove${n > 1 ? "s" : ""}` : String(Math.max(1, n)); }
    return fmtQty(it.qty, it.u, it.key);
  }
  function renderGrocery() {
    const picks = S.picks.map(id => byId[id]);
    $("#groceryIntro").textContent = picks.length ? `${picks.length} recipe${picks.length > 1 ? "s" : ""} × ${S.portions} ${LEVELS[S.level].label.toLowerCase()} portions = ${picks.length * S.portions} meals.` : "Pick recipes and their ingredients are merged here, grouped by aisle.";
    $("#pickedList").innerHTML = picks.map(r => `<span class="pchip"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:${MEALS[r.meal].color}"></span>${esc(r.name)}<button data-pick="${r.id}" aria-label="Remove ${esc(r.name)}">${ICON_X}</button></span>`).join("");
    if (!picks.length) {
      $("#glist").innerHTML = `<div class="empty-state"><h3>Your list is empty</h3><p>Pick one or two recipes and everything you need appears here, summed and sorted by aisle.</p><button class="btn accent" id="goRecipes">Browse recipes</button></div>`;
      $("#goRecipes").onclick = () => showTab("recipes");
    } else {
      const items = buildList();
      $("#glist").innerHTML = AISLES.map(([a, ic, bg]) => {
        const list = items.filter(i => i.cat === a).sort((x, y) => x.name.localeCompare(y.name));
        if (!list.length) return "";
        const done = list.filter(i => S.ticks[i.key]).length;
        return `<section class="aisle"><h3><span class="ai" style="background:${bg}">${ic}</span>${a}<small>${done}/${list.length}</small></h3>
          ${list.map(i => { const ph = packHint(i); return `<label class="gi ${S.ticks[i.key] ? "done" : ""}"><input type="checkbox" data-tick="${esc(i.key)}" ${S.ticks[i.key] ? "checked" : ""}><span><span class="gn">${esc(i.name)}</span><span class="gu">${esc(i.recipes.join(" · "))}</span></span><span class="gq">${gQty(i)}${ph ? `<small>${esc(ph)}</small>` : ""}</span></label>`; }).join("")}
        </section>`;
      }).join("");
    }
    $("#ownList").innerHTML = S.own.map((o, idx) => `<li class="${o.done ? "done" : ""}"><label class="gi" style="border:0;padding:0;grid-template-columns:24px 1fr;flex:1"><input type="checkbox" data-own="${idx}" ${o.done ? "checked" : ""}><span>${esc(o.t)}</span></label><button data-del="${idx}" aria-label="Delete ${esc(o.t)}">${ICON_X}</button></li>`).join("");
  }
  $("#glist").addEventListener("change", e => { const k = e.target.dataset.tick; if (k == null) return; if (e.target.checked) S.ticks[k] = 1; else delete S.ticks[k]; save(); renderGrocery(); });
  $("#untickAll").onclick = () => { S.ticks = {}; S.own.forEach(o => o.done = false); save(); renderGrocery(); toast("All items unticked"); };
  $("#ownForm").onsubmit = e => { e.preventDefault(); const v = $("#ownInput").value.trim(); if (!v) return; S.own.push({ t: v, done: false }); $("#ownInput").value = ""; save(); renderGrocery(); };
  $("#ownList").addEventListener("change", e => { const i = e.target.dataset.own; if (i == null) return; S.own[i].done = e.target.checked; save(); renderGrocery(); });
  $("#ownList").addEventListener("click", e => { const b = e.target.closest("[data-del]"); if (!b) return; S.own.splice(+b.dataset.del, 1); save(); renderGrocery(); });
  $("#copyList").onclick = async () => {
    const items = buildList();
    const lines = [`Grocery list — ${S.picks.length} recipe(s), ${S.portions} ${LEVELS[S.level].label.toLowerCase()} portions each`, ""];
    for (const r of S.picks) lines.push("• " + byId[r].name);
    lines.push("");
    for (const [a] of AISLES) {
      const list = items.filter(i => i.cat === a && !S.ticks[i.key]).sort((x, y) => x.name.localeCompare(y.name));
      if (!list.length) continue;
      lines.push(a.toUpperCase());
      list.forEach(i => { const ph = packHint(i); lines.push(`☐ ${i.name} — ${gQty(i).replace(/<[^>]+>/g, "")}${ph ? ` (${ph})` : ""}`); });
      lines.push("");
    }
    const own = S.own.filter(o => !o.done);
    if (own.length) { lines.push("OTHER"); own.forEach(o => lines.push("☐ " + o.t)); }
    const text = lines.join("\n").trim();
    try { await navigator.clipboard.writeText(text); toast("List copied"); }
    catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("List copied"); }
  };

  /* ---------------- tray & badge ---------------- */
  function renderBadge() { const b = $("#pickBadge"); b.textContent = S.picks.length; b.hidden = !S.picks.length; }
  function updateTray() {
    const show = S.picks.length && S.tab === "recipes";
    $("#tray").hidden = !show;
    if (show) $("#trayText").textContent = `${S.picks.length} picked · ${S.picks.length * S.portions} meals`;
  }
  $("#trayGo").onclick = () => { showTab("grocery"); window.scrollTo({ top: 0 }); };

  /* ---------------- init ---------------- */
  function renderAll() {
    renderControls(); renderBadge(); renderRecipes(); updateTray();
    if (S.tab === "plan") renderPlan();
    if (S.tab === "grocery") renderGrocery();
    if (dlg.open) { const id = location.hash.slice(1); if (byId[id]) openDetail(id); }
  }
  applyTheme();
  applyAccent();
  renderAll();
  showTab(S.tab);
  const h = location.hash.slice(1); if (byId[h]) openDetail(h);
})();
