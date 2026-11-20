// One simulated life: a player type, a seed, and detectors watching for deadlocks, walls, grind, long waits,
// thin choice, waste and unreached content. Returns a plain record that report.js turns into a page.
'use strict';
const path = require('path');
const G = require(path.join(__dirname, '..', '..', 'src', 'core.js'));

const CRAFTED = ['plate','wire','spring','gear','lens','ledger','tea','duct'];
const TRADED = {grit:'choir', spores:'bloom', footnotes:'quorate'};
const STORE = {scrap:['bunker','locker'], lichen:['locker','cellar'], ice:['cellar','locker'], notions:['shelf','obs','nook']};
const HOUSING = ['hut','rack','warren'];
const NEW_KINDS = new Set(['research','project','upgrade','ending']);

/* ---------- player types ---------- */
const PLAYERS = {
  optimiser: {label:'Optimiser', desc:'Checks in every few seconds and takes the best-looking move. The fastest a person could plausibly go.', every:3},
  casual: {label:'Casual', desc:'Six short sessions a day between 7am and 11pm, asleep overnight. Away time is simulated as the game does it, up to 12 hours.', casual:true, every:4},
  notrade: {label:'Never trades', desc:'Optimiser who never hails a neighbour or buys from the pedlar.', every:3, noTrade:true, expectFail:'Trade is compulsory by design: lenses and footnotes only come from neighbours. This player should never reach the engine; it is here to catch a route that bypasses trade.'},
  noduty: {label:'No duties', desc:'Optimiser who never puts crew on duties.', every:3, noDuty:true},
  mindrush: {label:'Mind first', desc:'Spends Mandate and materials on the Mind before anything else, and lets it dream.', every:3, mindFirst:true},
  hoarder: {label:'Hoarder', desc:'Only spends when a store is nearly full. Slow, steady, cautious.', every:6, hoarder:true},
  fuzzer: {label:'Fuzzer', desc:'Feeds the crew, then makes random legal moves. Finds routes nobody would plan.', every:2, fuzz:true},
  storyA: {label:'Story: always first choice', desc:'Optimiser who always takes the first option in every story and petition.', every:3, story:0},
  storyB: {label:'Story: always second choice', desc:'Optimiser who always takes the second option.', every:3, story:1}};

/* ---------- a sensible player's housekeeping ---------- */
function feed(S, c, P){
  const free = S.crew.filter(t => !t.d), pop = S.crew.length; if (!free.length) return;
  const bed = c.bedIn/c.seasonM, perG = S.m.graze*c.am*0.9;
  const need = Math.max(0, Math.min(free.length - (free.length >= 2 ? 1 : 0) - (free.length >= 6 ? 1 : 0), Math.ceil((pop*0.4*1.15 - bed*0.25)/Math.max(0.1, perG*0.55))));
  const rest = Math.max(0, free.length - need), want = P.fuzz ? {scav:Math.random(), scholar:Math.random(), icer:Math.random()*0.3, tinker:Math.random()*0.3, bard:Math.random()*0.3} : {scav:0.35, scholar:0.35, icer:0.08, tinker:0.1, bard:0.12};
  const tot = Object.values(want).reduce((a,x) => a + x, 0);
  for (const j in want) if (G.JOBS[j].req(S)) { const tgt = Math.floor(rest*want[j]/tot), cur = S.crew.filter(t => !t.d && t.j == j).length; if (tgt != cur) G.setJob(S, j, tgt - cur); }
}
function duties(S, P){
  if (P.noDuty) return; const pop = S.crew.length;
  for (const k in G.DUTY) if (G.DUTY[k].unl(S)) { const n = G.team(S,k).length, tgt = k == 'mind' ? 4 : k == 'cttee' ? 2 : 3;
    if (n < tgt && pop >= 10 && S.crew.filter(t => t.d).length < pop*0.25) G.setDuty(S, k, 1); }
}
function hintScore(h){ let s = 0; const m = h.match(/Accord ([+−])(\d+)/); if (m) s += (m[1] == '+' ? 1 : -1)*+m[2]; if (/Unlocks|free|good/.test(h)) s += 4; if (/\+/.test(h)) s += 1; if (/−/.test(h) && !m) s -= 1; return s; }
function story(S, P){
  if (G.arc(S).ph == 1) G.arcChoose(S, P.route);
  if (!S.st.cur) return; const step = G.storyStep(S);
  const ch = P.story != null ? P.story : P.fuzz ? (Math.random() < 0.5 ? 0 : 1) : hintScore(step.b[1]) > hintScore(step.a[1]) ? 1 : 0;
  G.storyChoose(S, ch);
}
function mind(S, c, P){
  const md = S.mind;
  if (md.offer) { const pref = P.mindFirst ? ['second','hunch','echo','rumin','pend','grudge','attic','bilge','npress','thermo','sump','gland','metro','worry','daydream','lobe','sock','reflex','bulb','bureau','tickle'] : ['attic','bilge','rumin','second','hunch','thermo','npress','pend','grudge','sump','gland','metro','echo','worry','daydream','lobe','sock','reflex','bulb','bureau','tickle'];
    const o = md.offer.slice().sort((a,b) => pref.indexOf(a) - pref.indexOf(b));
    const cramped = ['sci','mind'].some(t => G.prjOpen(S,t).some(p => (G.prjCost(S,p).cycles||0) > c.mind.cap*0.9)), st = o.find(k => G.MT[k].g == 'store');
    if (cramped && st && !P.fuzz) { G.mindTake(S, st); return; }
    G.mindTake(S, P.fuzz ? o[Math.floor(Math.random()*o.length)] : o[0]); }
  else if (S.mp > 0) G.mindDraft(S);
  md.nodes.forEach((n,i) => { if (n.cond < 0.6) G.service(S, i); });
  if (S.done.hydraulics && c.mind.heat > c.mind.hcap) { const i = md.nodes.findIndex(n => n.v >= 1 && (G.MT[n.k].h||0) >= 1.5); if (i >= 0) G.valve(S, i); }
  if (S.done.sparework && md.task == 'idle') G.setTask(S, P.mindFirst ? 'dream' : 'ponder');
  const saving = G.inCrisis(S) && G.actions(S).some(a => /^p:(drift|thruster|burn|unions|charter|petition)$/.test(a.id) && !a.can);
  if (P.mindFirst && !saving && Math.random() < 0.2) { const i = Math.floor(Math.random()*md.nodes.length); if (G.canPay(S, G.nodeUpCost(md.nodes[i]))) G.nodeUp(S, i); }
}

/* ---------- choosing progress moves ---------- */
function buildWant(S, c, id){
  const nb = k => S.b[k] || 0, pop = S.crew.length;
  if (HOUSING.includes(id)) return 3.2;
  if (id == 'bed') return S.r.lichen > 0.4*c.caps.lichen || nb('bed') < 4 ? 2 : 0;
  if (id == 'locker' || id == 'bunker') return S.r.scrap > 0.85*c.caps.scrap || S.r.lichen > 0.95*c.caps.lichen ? 3.4 : 0;
  if (id == 'nook' || id == 'shelf') return S.r.notions > 0.8*c.caps.notions ? 3.4 : 0.5;
  if (id == 'press') return c.demand < c.scrapIn*0.6 + 0.3 ? 2.5 : 0;
  if (id == 'antenna') return nb('antenna') < 3 ? 2.6 : 0;
  return nb(id) < 2 + pop/10 ? 2 : 0;
}
function score(S, c, a, P){
  let s = 0;
  if (a.kind == 'research') s = 4; else if (a.kind == 'project') s = a.id == 'p:engine' ? 9 : 3.6; else if (a.kind == 'upgrade') s = 3; else if (a.kind == 'build') s = buildWant(S, c, a.id.slice(2)); else if (a.kind == 'ending') s = P.wantEnding ? 5 : -1;
  if (P.mindFirst && (a.kind == 'project')) s += 2;
  if (!P.fuzz && G.inCrisis(S) && a.kind == 'upgrade' && (a.cost.plate||0) > 0 && G.actions(S).some(x => /^p:(thruster|burn|charter|petition)$/.test(x.id) && !x.can)) s -= 2.5;   /* a diligent player keeps plate for the way out */
  if (!P.fuzz && G.inCrisis(S)) { const id = a.id.slice(2), A = G.arc(S);
    if (['drift','thruster','burn','unions','charter','petition'].includes(id)) s += 4;
    if (A.route == 'trust' && (id == 'boilers' || (id == 'boiler' && c.warm < c.warmNeed*1.2) || (id == 'bed' && S.r.lichen < 0.5*c.caps.lichen))) s += 3;
    if (A.route == 'obey' && S.accord < 60 && ['band','garden','brewing','music','gardening','kettle'].includes(id)) s += 3;
    if (A.route == 'obey' && ['press','dies','dies1','thingauge'].includes(id)) s += 1; }
  return s;
}
function shortfall(S, c, cost){ const o = {}; for (const r in cost) { const d = cost[r] - (S.r[r]||0); if (d > 1e-9) o[r] = d; } return o; }
function unblock(S, c, P, want){
  // craft, trade or build storage for what the best unaffordable moves are short of
  let saving = false;
  for (const a of want.slice(0, 6)) { const sf = shortfall(S, c, a.cost); if (sf.scrap && a.cost.scrap <= c.caps.scrap) saving = true;
    for (const r in sf) {
      if (CRAFTED.includes(r) && G.CRAFT[r].req(S)) { const n = Math.min(Math.ceil(sf[r]/Math.max(0.01, 1)), G.craftMax(S, r)); if (n > 0) G.craft(S, r, n);
        else for (const q in G.CRAFT[r].c) if (TRADED[q] && !P.noTrade && (S.r[q]||0) < G.CRAFT[r].c[q]*sf[r] && S.hails >= 1) G.trade(S, TRADED[q]); }
      else if (TRADED[r] && !P.noTrade && S.hails >= 1) G.trade(S, TRADED[r]);
      if (a.cost[r] > G.calc(S).caps[r] && STORE[r]) for (const b of STORE[r]) if (G.BLD[b].req(S)) G.buy(S, b, 1);
      if (r == 'cycles' && a.cost[r] > G.calc(S).caps.cycles) { const i = S.mind.nodes.findIndex(n => G.MT[n.k].g == 'store' && G.canPay(S, G.nodeUpCost(n))); if (i >= 0) G.nodeUp(S, i); }
    } }
  if (!P.fuzz && (S.b.press||0) > 0) S.share = saving && S.r.spoons > 3000 && Math.random() < 0.7 ? 0 : 0.5;
}
function decide(S, P, ctx){
  let c = G.calc(S);
  if (P.hoarder && !Object.keys(c.caps).some(r => isFinite(c.caps[r]) && S.r[r] > 0.9*c.caps[r]) && !S.st.cur && S.mp < 1) { feed(S, c, P); return; }
  feed(S, c, P); duties(S, P); story(S, P); mind(S, c, P);
  for (const r of CRAFTED) if (G.CRAFT[r].req(S)) S.keep[r] = {plate:60,wire:30,spring:15,gear:40,lens:12,ledger:8,tea:30}[r];
  if (G.CRAFT.plate.req(S) && S.r.plate < 200 && S.r.scrap > 0.6*c.caps.scrap) ctx.act('c:plate', () => G.craft(S, 'plate', Math.floor((S.r.scrap - 0.3*c.caps.scrap)/50)));
  if (S.comet > 0 && (P.fuzz || Math.random() < 0.6)) ctx.act('obs', () => G.observe(S));
  if (S.done.brewing && S.fest <= 0 && S.accord < 70) G.festival(S);
  const L = G.actions(S);
  if (P.fuzz) { for (let k = 0; k < 3; k++) { const ok = L.filter(a => a.can && a.kind != 'job' && a.kind != 'duty'); if (!ok.length) break; const a = ok[Math.floor(Math.random()*ok.length)]; if (P.noTrade && a.kind == 'trade') continue; ctx.act(a.id, a.run); } return; }
  const scored = L.filter(a => ['research','project','upgrade','build','ending'].includes(a.kind)).map(a => ({a, s: score(S, c, a, P) + Math.random()*0.3})).filter(x => x.s > 0).sort((x,y) => y.s - x.s);
  let n = 0; for (const x of scored) { if (n >= 4) break; if (x.a.can) { ctx.act(x.a.id, x.a.run); n++; } }
  unblock(S, c, P, scored.filter(x => !x.a.can).map(x => x.a));
  if (!P.noTrade && S.hails >= 2 && S.r.grit < 6 && (S.b.antenna||0) >= 1) G.trade(S, 'choir');
}

/* ---------- detectors ---------- */
function saveCode(S){ const o = JSON.parse(JSON.stringify({S, M: G.getM()})); o.S.frozen = 1; return Buffer.from(JSON.stringify(o), 'utf8').toString('base64'); }
function eta(S, c, rate, a, peak, spent){
  // how long until this move is affordable, and if never, why
  let worst = 0, why = '';
  for (const r in a.cost) { const need = a.cost[r] - (S.r[r]||0); if (need <= 1e-9) continue;
    const cap = c.caps[r];
    if (r == 'cycles' && a.cost[r] > cap) { const st = S.mind.nodes.map((n,i) => [n,i]).filter(([n]) => G.MT[n.k].g == 'store' && !((n.lv >= 2 && !S.done.wiredraw) || (n.lv >= 4 && !S.done.gears)));
      if (st.length) { worst = Math.max(worst, 1800); why = why || 'needs a bigger Mind: upgrade a storage subsystem'; continue; }
      const t2m = Math.max(0, G.thr(S) - S.made)/Math.max(1e-6, rate.spoons); if (!isFinite(t2m) || t2m > 6*3600) return [Infinity, 'needs ' + G.fmt(a.cost[r]) + ' thought but the Mind holds ' + G.fmt(cap) + '; only a storage subsystem can raise it, and the next Mandate is ' + (!isFinite(t2m) || t2m > 7*86400 ? 'more than a week' : G.fmtTime(t2m)) + ' away']; worst = Math.max(worst, t2m + 600); why = why || 'needs a Mind storage subsystem, via the next Mandate'; continue; }
    if (cap != null && isFinite(cap) && a.cost[r] > cap) { const st = (STORE[r]||[]).some(b => G.BLD[b].req(S)); if (!st) return [Infinity, 'needs ' + G.fmt(a.cost[r]) + ' ' + r + ' but the store holds ' + G.fmt(cap) + ', and nothing can raise it']; worst = Math.max(worst, 3600); why = why || 'needs more ' + r + ' storage'; continue; }
    if (CRAFTED.includes(r)) { if (!G.CRAFT[r].req(S)) return [Infinity, 'needs ' + r + ', which cannot be made yet']; const ing = G.CRAFT[r].c; let t = 0; for (const q in ing) { const tot = ing[q]*need - (S.r[q]||0); if (tot > 0) { if (TRADED[q] && (S.b.antenna||0) >= G.PART[TRADED[q]].ant) { t = Math.max(t, tot*45); continue; } const rt = rate[q] || 0; if (rt <= 0 && !CRAFTED.includes(q)) return [Infinity, 'needs ' + r + ', made from ' + q + ', which is not coming in']; t = Math.max(t, rt > 0 ? tot/rt : 1800); } } worst = Math.max(worst, t); continue; }
    if (TRADED[r]) { const p = G.PART[TRADED[r]]; if ((S.b.antenna||0) < p.ant) { if (!G.BLD.antenna.req(S)) return [Infinity, 'needs ' + r + ' from ' + p.n + ', who cannot be heard yet']; worst = Math.max(worst, 3600); continue; } worst = Math.max(worst, need*90/2); continue; }
    const pk = peak[r]; if (pk && a.cost[r] > pk.v*1.02 && S.age - pk.t > 3600 && S.age > 7200 && S.age - (spent[r]||0) > 3600) return [Infinity, r + ' has not risen above ' + G.fmt(pk.v) + ' for ' + G.fmtTime(S.age - pk.t) + ', but this needs ' + G.fmt(a.cost[r]) + ': something is draining it'];
    const rt = rate[r] || 0; if (rt <= 1e-6) return [Infinity, 'needs ' + G.fmt(need) + ' more ' + r + ', which is not coming in']; worst = Math.max(worst, need/rt);
  }
  return [worst, why];
}

function playLife(name, seed, opt){
  opt = opt || {}; const P = Object.assign({}, PLAYERS[name]);
  P.route = opt.route || (P.story === 0 ? 'obey' : P.story === 1 ? 'trust' : seed % 2 ? 'obey' : 'trust');
  G.setSeed(seed); const rng = (() => { let a = seed*7919 >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  Math.random = rng; // the bots' own choices replay too
  G.setM(G.newMeta()); G.setHook(() => {});
  const S = G.newState('');
  const R = {player:name, label:P.label, desc:P.desc, expectFail:P.expectFail||null, route:P.route, seed, firsts:[], flags:[], series:[], acts:{}, waste:{}, idleMind:0, samples:0, finished:false, tEnd:null, wall:0};
  const seen = new Set(), flagged = new Set(), hist = [], walls = {}, peak = {}, spent = {};
  let dlStart = 0, lastNew = 0, lastNewWall = 0, win = {t:0, acts:{}, hand:0, auto:0}, noReach = 0, sessionsQuiet = 0, wall = 0;
  const ctx = {act:(id, fn) => { const s0 = S.made, sc0 = S.r.scrap, before = Object.assign({}, S.r); try { fn(); } catch (e) { flag('crash', id + String(e.message), 'The rules threw an error on ' + id + ': ' + e.message, {stack:String(e.stack).split('\n').slice(0,4).join('\n')}); return; } for (const r in before) if ((S.r[r]||0) < before[r] - 1e-9) spent[r] = S.age; R.acts[id] = (R.acts[id]||0) + 1; win.acts[id] = (win.acts[id]||0) + 1; if (id == 'stamp') win.hand += S.made - s0; if (id == 'pry') win.handScrap = (win.handScrap||0) + Math.max(0, S.r.scrap - sc0); }};
  /* anything the bot spends during its own turn, directly or through ctx.act, counts as spending, not draining */
  const botStep = () => { S.here = S.age; const b = Object.assign({}, S.r); decide(S, P, ctx); for (const r in b) if ((S.r[r]||0) < b[r] - 1e-9) spent[r] = S.age; };
  const flag = (type, key, msg, extra) => { if (flagged.has(type + key)) return; flagged.add(type + key); R.flags.push(Object.assign({type, t:S.age, wall, msg, code:saveCode(S)}, extra||{})); };
  const markNew = () => {
    const ids = [...Object.keys(S.done).map(k => 'p:' + k), ...Object.keys(S.up).map(k => 'u:' + k), ...Object.keys(S.b).map(k => 'b:' + k), ...S.mind.nodes.map(n => 'n:' + n.k), ...Object.keys(S.duty).map(k => 'd:' + k), ...Object.keys(S.st.done).map(k => 's:' + k), ...G.CRAFT_IDS.filter(k => S.r[k] >= 1).map(k => 'c:' + k)];
    for (const id of ids) if (!seen.has(id)) { seen.add(id); R.firsts.push([S.age, id, wall]); lastNew = S.age; lastNewWall = wall; sessionsQuiet = 0; }
  };
  const sample = () => {
    if (opt.onSample) opt.onSample(S, G.calc(S));
    { const A = G.arc(S); if (A.ph >= 1 && R.mid == null) { R.mid = S.age; R.midWall = wall; } if (A.ph == 3 && R.resT == null) { R.resT = S.age; R.resWall = wall; }
      if (A.ph == 2 && A.ct > 4*3600) flag('crisis', A.route, 'The ' + (A.route == 'trust' ? 'Long Dark' : 'Quota') + ' has gone on for more than four hours of play without being resolved. ' + A.lost + ' crew lost so far, strain ' + Math.round(A.strain) + '%.');
      if (A.ph == 1 && S.age - (R.mid||S.age) > 1800) flag('crisis', 'undecided', 'The Bureau\'s directive has gone unanswered for half an hour.'); }
    const c = G.calc(S); hist.push({t:S.age, r:Object.fromEntries(G.BASE.map(r => [r, S.r[r]||0]))}); while (hist.length > 12) hist.shift();
    const old = hist[0], dt = S.age - old.t, rate = {}; for (const r of G.BASE) rate[r] = dt > 0 ? ((S.r[r]||0) - old.r[r])/dt : 0;
    // smooth out the bot's own spending: use gross income where the rules know it
    rate.scrap = Math.max(rate.scrap, c.scrapIn - S._used); rate.lichen = Math.max(rate.lichen, c.lichenIn - c.eat); rate.notions = Math.max(rate.notions, c.notionsIn + c.mind.notions); rate.cycles = Math.max(rate.cycles, c.mind.cps); rate.ice = Math.max(rate.ice, c.iceIn); rate.spoons = Math.max(rate.spoons, S._sp); rate.plate = Math.max(rate.plate, S.r.scrap > c.caps.scrap*0.5 ? c.smelt/50 : 0, c.scrapIn/50*0.5);
    R.samples++;
    for (const r of G.BASE) { const v = S.r[r]||0, pk = peak[r]; if (!pk || v > pk.v*1.01) peak[r] = {v, t:S.age}; }
    for (const r in c.caps) { const cp = c.caps[r]; if (r == 'cycles' && S.done.sparework && S.mind.task != 'idle') continue; if (isFinite(cp) && cp > 0 && (S.r[r]||0) >= cp*0.995) R.waste[r] = (R.waste[r]||0) + 1; }
    if (S.r.cycles >= c.mind.cap*0.995 && (S.mind.task == 'idle' || !S.done.sparework) && S.mind.nodes.length >= 4) R.idleMind++;
    // what could the player newly do?
    const L = G.actions(S), cand = L.filter(a => NEW_KINDS.has(a.kind) || (a.kind == 'build' && !(S.b[a.id.slice(2)])) || (a.kind == 'craft' && !(S.r[a.id.slice(2)] >= 1)));
    const nowNew = cand.filter(a => a.can && a.kind != 'ending');
    let reach = nowNew.length > 0, blockers = [];
    for (const a of cand) { if (a.can) continue; const [e, why] = eta(S, c, rate, a, peak, spent); if (e < 6*3600) reach = true; else blockers.push(a.id.replace(/^\w+:/, '') + ': ' + (why || 'more than six hours away')); }
    const decisions = nowNew.length + (S.st.cur ? 1 : 0) + (S.mind.offer ? 1 : 0);
    if (R.samples % 10 == 0) R.series.push({t:S.age, wall, made:S.made, pop:S.crew.length, nodes:S.mind.nodes.length, decisions, notions:S.r.notions, ncap:c.caps.notions, strain:G.arc(S).strain, ph:G.arc(S).ph, scrap:S.r.scrap, scap:c.caps.scrap, accord:S.accord});
    R.lastBlockers = blockers; if (!reach) { if (!noReach) dlStart = S.age; noReach += 60; if (noReach >= 1800) flag('deadlock', blockers.map(b => b.split(':')[0]).sort().join(','), 'Nothing new is reachable within six hours.', {blockers:blockers.slice(0, 8)}); } else noReach = 0;
    for (const a of cand) { if (a.can) { if (walls[a.id]) { walls[a.id].end = S.age; } continue; } const [e, why] = eta(S, c, rate, a, peak, spent);
      if (!isFinite(e) && /store holds|Mind holds|draining/.test(why)) { const w = walls[a.id] || (walls[a.id] = {start:S.age, why, code:null}); if (!w.end && S.age - w.start >= 1800 && !w.flagged) { w.flagged = 1; flag('wall', a.id, why.charAt(0).toUpperCase() + why.slice(1) + ' (' + a.id.replace(/^\w+:/, '') + '). Stuck for half an hour so far.'); } } }
    if (S.age - win.t >= 1800) { const tot = Object.values(win.acts).reduce((a,x) => a + x, 0), top = Object.entries(win.acts).sort((a,b) => b[1] - a[1])[0];
      const made = S.made - (win.made0||0), handShare = made > 0 ? win.hand/made : 0;
      if (S.age > 1800 && handShare > 0.6 && made > 50) flag('grind', 'hand' + Math.floor(S.age/3600), 'For half an hour, ' + Math.round(handShare*100) + '% of all spoons came from tapping Stamp by hand.');
      if (top && tot > 80 && top[1]/tot > 0.8 && !P.fuzz) flag('grind', top[0] + Math.floor(S.age/7200), 'For half an hour, ' + Math.round(100*top[1]/tot) + '% of moves were the same one: ' + top[0] + ' (' + top[1] + ' times).');
      win = {t:S.age, acts:{}, hand:0, made0:S.made}; }
    const gapLim = P.casual ? Infinity : 45*60;
    if (S.age - lastNew > gapLim) flag('wait', String(lastNew), 'Nothing new for ' + Math.round((S.age - lastNew)/60) + ' minutes and counting.', {since:lastNew});
  };

  const MAXT = opt.hours ? opt.hours*3600 : P.casual ? 14*86400 : 72*3600;
  // the opening, by hand: what a person does before there is a crew and a press
  const tickAct = () => { const early = !(S.b.press) || S.made < 40;
    if (early) { if (S.r.scrap < 30 && (S.b.hut||0) < 5) ctx.act('pry', () => G.pry(S)); if (S.r.lichen < 60 && S.crew.length < 4) ctx.act('scrape', () => G.scrape(S));
      if (S.r.scrap >= 1 && (S.made < 12 || ((S.b.hut||0) >= 1 && S.r.scrap > 45))) ctx.act('stamp', () => G.stamp(S)); }
    else if (S.r.scrap < 20 && G.calc(S).scrapIn < 0.5) ctx.act('pry', () => G.pry(S)); };
  let t = 0, nextSample = 60;
  if (!P.casual) {
    while (S.age < MAXT && !S.seen.stage2) { G.tick(S, 1, true); G.checks(S); tickAct(); if (++t % P.every == 0) botStep(); if (opt.probe && S.age >= opt.probe.t && !opt.probe.done) { opt.probe.done = 1; opt.probe.fn(S); } markNew(); if (S.age >= nextSample) { nextSample += 60; sample(); } wall = S.age; }
  } else {
    // a day: sessions at these hours, each about a quarter of an hour; the rest is time away
    const SESS = [7.5, 10.5, 13, 17.5, 20, 22.5].map(h => h*3600); let day = 0; wall = SESS[0];
    while (wall < MAXT && !S.seen.stage2) {
      for (const st of SESS) { const start = day*86400 + st; if (start < wall) continue;
        const away = start - wall; if (away > 0) { const s0 = new Set(seen); G.simulate(S, Math.min(away, 12*3600)); wall = start; markNew(); }
        const len = 600 + Math.floor(Math.random()*600), before = R.firsts.length;
        for (let i = 0; i < len && !S.seen.stage2; i++) { G.tick(S, 1, true); G.checks(S); tickAct(); if (i % P.every == 0) botStep(); wall++; markNew(); if (i % 60 == 0) sample(); }
        if (R.firsts.length == before) { sessionsQuiet++; if (sessionsQuiet >= 3) flag('wait', String(lastNewWall), sessionsQuiet + ' sessions in a row with nothing new.', {since:lastNew}); }
        if (S.seen.stage2 || wall >= MAXT) break; }
      day++;
    }
  }
  sample();
  R.open = G.actions(S).filter(a => (a.kind == 'research' || a.kind == 'project') && a.id != 'p:stay').map(a => a.id.slice(2));
  R.missingReq = G.PRJ.filter(p => !S.done[p.id] && !p.req(S)).map(p => p.id);
  R.finished = !!S.seen.stage2; R.tEnd = S.age; R.wallEnd = wall;
  R.done = {projects:Object.keys(S.done), upgrades:Object.keys(S.up), buildings:Object.keys(S.b), stories:Object.keys(S.st.done), nodes:[...new Set(S.mind.nodes.map(n => n.k))], duties:Object.keys(S.duty), ach:Object.keys(G.getM().ach), glitches:S.seen.glitch||0};
  R.final = {made:S.made, pop:S.crew.length, nodes:S.mind.nodes.length, mand:S.mand, accord:S.accord, duties:Object.fromEntries(Object.entries(S.duty).map(([k,d]) => [k, Math.round(d.c)]))};
  R.walls = Object.entries(walls).filter(([,w]) => w.flagged).map(([id,w]) => ({id, start:w.start, end:w.end || S.age, why:w.why}));
  R.endCode = saveCode(S);
  { const A = G.arc(S); R.arc = {ph:A.ph, route:A.route, ct:A.ct, lost:A.lost, iced:A.iced.length, gone:A.gone.length, met:A.met, miss:A.miss, res:A.res||null, peak:Math.max(0, ...R.series.map(p => p.strain||0))}; }
  { const t = S.tally || {}; R.tradeShare = (t.tradeN||0)/Math.max(1, (t.tradeN||0) + (t.passN||0)); R.trades = Object.fromEntries(Object.entries(S.mkt||{}).map(([k,m]) => [k, m.n])); }
  return R;
}
module.exports = {PLAYERS, playLife};
