/* ===== interface ===== */
const $ = id => document.getElementById(id);
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const btn = (cls, txt, fn) => { const b = h('button', cls, txt); b.type = 'button'; if (fn) b.onclick = fn; return b; };
let S, C, cur = 'hull', ups = [], fixed = [], sig = '', tabSig = '', buyQ = 1, openK = {}, showDone = false, pulseV = 0, needEnd = false, logSeen = null;
let opt = {sound:0, calm:0}, main, loadedT = 0, mindCv = null;
const SAVE_KEY = 'tsd2.save', BUILD = 'Stage one \u00b7 build 19 Nov 2026 b';
const U = fn => { ups.push(fn); fn(); };
const setT = (el, t) => { if (el._t !== t) { el._t = t; el.textContent = t; } };
const setD = (el, k, v) => { if (el.dataset[k] !== v) el.dataset[k] = v; };
const fmt3 = x => { if (!isFinite(x)) return '∞'; if (x < 0) return '−' + fmt3(-x); if (x < 1000) return x >= 100 || x % 1 === 0 ? String(Math.floor(x)) : x >= 10 ? x.toFixed(1) : x.toFixed(2); const e = Math.min(8, Math.floor(Math.log10(x)/3)), v = x/Math.pow(1000,e); return (v >= 1000 ? v.toExponential(1) : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + UNITS[e]; };
const qn = () => buyQ == 'max' ? 500 : buyQ;
const act = fn => () => { if (S.paused) { toast('Paused. Tap Resume to carry on.'); return; } S.here = S.age; fn(); S.acts = (S.acts||0) + 1; checks(S); frameUI(); };
const RNAME = {lichen:'lichen', scrap:'scrap', spoons:'spoons', ice:'ice', notions:'notions', cycles:'thought', whimsy:'whimsy', plate:'plate', wire:'wire', spring:'springs', gear:'gears', lens:'lenses', ledger:'ledgers', tea:'tea', grit:'grit', spores:'spores', footnotes:'footnotes'};

function costState(c){ let st = ''; for (const r in c) if ((S.r[r]||0) < c[r] - 1e-9) { if (c[r] > capOf(S,C,r)) return 'cap'; st = 'no'; } return st; }
function costEl(fn){
  const box = h('div','costs'), rows = {};
  U(() => { const c = fn(); for (const r in c) { let row = rows[r]; if (!row) { row = rows[r] = h('div','cost'); row.append(h('span','cn',RNAME[r]||r), h('span','cv')); box.append(row); }
    setT(row.lastChild, fmt(Math.min(S.r[r]||0, c[r])) + ' / ' + fmt(c[r]) + (c[r] > capOf(S,C,r) ? ' (more than you can store)' : '')); setD(row, 's', (S.r[r]||0) >= c[r] - 1e-9 ? 'ok' : c[r] > capOf(S,C,r) ? 'cap' : 'no'); } });
  return box;
}
const costLine = c => Object.keys(c).map(r => fmt(c[r]) + ' ' + (RNAME[r]||r)).join(', ');
function item(key, o){
  const w = h('div','item'), a = btn('act'), m = btn('more','›'), d = h('div','detail');
  m.setAttribute('aria-label','Details'); a.onclick = act(() => { o.act(); w.classList.remove('hit'); void w.offsetWidth; w.classList.add('hit'); });
  const sync = () => { d.hidden = !openK[key]; m.classList.toggle('on', !!openK[key]); m.setAttribute('aria-expanded', !!openK[key]); };
  m.onclick = () => { openK[key] = !openK[key]; sync(); }; sync();
  if (o.desc) d.append(h('p','', o.desc)); if (o.eff) d.append(h('p','eff', o.eff)); if (o.cost) d.append(costEl(o.cost)); if (o.more) o.more(d);
  const sub = o.sub ? h('span','asub') : null; if (o.sub && !o.sub()) o.sub = null;
  w.append(a, m, d);
  U(() => { const t = o.title(); if (sub) { if (a.firstChild !== a._tn) { a.textContent = ''; a._tn = document.createTextNode(''); a.append(a._tn, sub); } if (a._tn.data !== t) a._tn.data = t; setT(sub, o.sub()); } else setT(a, t); setD(w, 's', o.state ? o.state() : o.cost ? costState(o.cost()) : ''); });
  return w;
}
const head = (el, t) => el.append(h('h2','', t));
const note = (el, fn) => { const p = h('p','note'); U(() => setT(p, fn())); el.append(p); return p; };
function meter(el, fn, cls){ const m = h('div','meter ' + (cls||'')), f = h('i'); m.append(f); U(() => { const v = clamp(fn(),0,1); const w = (v*100).toFixed(1) + '%'; if (f._w !== w) { f._w = w; f.style.width = w; } }); el.append(m); return m; }
function seg(el, label, opts, get, set){ const row = h('div','ctl'); row.append(h('span','ctl-l',label)); const g = h('div','seg'); opts.forEach(([v,t]) => { const b = btn('', t, () => { set(v); frameUI(); }); U(() => b.classList.toggle('on', get() === v)); g.append(b); }); row.append(g); el.append(row); }
const buyMode = el => seg(el, 'Each tap buys', [[1,'1'],[10,'10'],['max','max']], () => buyQ, v => { buyQ = v; });

/* ---------- tabs ---------- */
const anyStory = () => !!S.st.cur;
const TABS = [
 {id:'hull',n:'Hull',show:()=>1,badge:()=>0},
 {id:'shop',n:'Workshop',show:()=>nb(S,'bench')>=1,badge:()=>upgOpen(S).some(u=>canPay(S,u.c))},
 {id:'crew',n:'Crew',show:()=>S.seen.crew,badge:anyStory},
 {id:'sci',n:'Science',show:()=>nb(S,'nook')>=1,badge:()=>prjOpen(S,'sci').some(p=>canPay(S,prjCost(S,p)))},
 {id:'mind',n:'Mind',show:()=>S.seen.mind,badge:()=>S.mp>0||!!S.mind.offer||prjOpen(S,'mind').some(p=>canPay(S,p.c))},
 {id:'trade',n:'Trade',show:()=>nb(S,'antenna')>=1,badge:()=>S.pedlar>0},
 {id:'time',n:'Time',show:()=>S.done.chronology,badge:()=>0},
 {id:'margin',n:'Margin',show:()=>S.done.manual,badge:()=>0},
 {id:'rec',n:'Records',show:()=>S.made>=1||M.runs>0,badge:()=>0}];
const R = {}, SIG = {};

/* ---------- Hull ---------- */
const UPGB = {rakes:'bed',ferment:'bed',slats:'locker',tess:'locker',vice:'bench',jig:'bench',lathe:'bench',oil:'press',dies:'press',sprung:'press',geared:'press',thingauge:'press',frost:'cellar',vats:'cellar',bellows:'smelter',crucible:'smelter',coils:'cond',shelving:'nook',whistle:'kettle',jacket:'boiler',bell:'school',slates:'school',bunks:'hut',tube:'obs',brass:'band',dish:'antenna',rivbunk:'bunker'};
const PRJB = {hammock:'hut',bunkdesign:'rack',dies1:'press'};
const fittedOn = id => [...UPG.filter(u => S.up[u.id] && UPGB[u.id] == id).map(u => u.n), ...Object.keys(PRJB).filter(k => S.done[k] && PRJB[k] == id).map(k => PRJ_BY[k].n), ...(id == 'warren' && S.m.warrenB > 4 ? ['the Commons\u2019 vote'] : []), ...(id == 'rack' && S.m.rackB > 5 && !S.done.bunkdesign ? ['tighter packing'] : [])];
function effText(id){ const m = S.m, d = BLD[id];
  switch (id) {
    case 'hut': return '+' + (2 + (qk(S).berth||0) + m.berth) + ' berths';
    case 'rack': return '+' + m.rackB + ' berths';
    case 'warren': return '+' + m.warrenB + ' berths';
    case 'locker': return '+' + fmt(150*m.cap) + ' scrap, +' + fmt(1500*m.cap*m.lcap) + ' lichen and +' + fmt(100*m.icecap) + ' ice storage';
    case 'bunker': return '+' + fmt(1500*m.bunk*m.cap) + ' scrap storage';
    case 'press': return 'turns ' + fmt(0.5*m.press) + ' scrap/s into ' + fmt(0.5*m.press*C.yield) + ' spoons/s';
    case 'smelter': return 'turns ' + fmt(m.smelt) + ' scrap/s into ' + fmt(m.smelt/50) + ' plate/s, using only scrap above half the store';
    case 'kettle': return 'brews ' + fmt(0.01*m.kettle*60) + ' tea a minute from lichen and ice (pauses when lichen falls below 30%)';
    case 'boiler': return '+' + fmt(2*m.warm) + ' warmth; burns ' + fmt(0.2*m.fuel) + ' scrap/s at Aphelion';
    case 'cond': return '+' + fmt(0.08*m.cond) + ' ice/s, doubled at Aphelion';
    case 'nook': return '+' + fmt(250*(m.nook||1)*m.ncap) + ' notion storage, scholars +5%';
    default: return d.e; } }

SIG.hull = () => [S.ended, S.pop < 6, Object.keys(S.up).length, S.done.hammock, S.done.bunkdesign, S.m.warrenB, S.seen.pb, S.seen.lb, Object.keys(BLD).filter(k => BLD[k].req(S)).join(), nb(S,'press')>0, Object.values(S.b).some(v => v >= 5)].join('|');
R.hull = el => {
  const hands = h('div','hands');
  const mk = (t, sub, fn, cls) => { const b = btn('hand ' + (cls||'')), s = h('span','hs'); b.append(h('span','ht',t), s); b.onclick = act(fn); U(() => setT(s, sub())); hands.append(b); };
  mk('Stamp a spoon', () => { const n = handMult(S), y = n*C.yield; return fmt(n) + ' scrap → ' + fmt(y) + (y == 1 ? ' spoon' : ' spoons'); }, () => stamp(S), 'prime');
  if (S.seen.pb) mk('Pry scrap', () => '+' + fmt(Math.max(handMult(S), C.scrapIn*2)) + ' scrap', () => pry(S));
  if (S.seen.lb) mk('Scrape lichen', () => '+' + fmt(Math.max(handMult(S), C.lichenIn*2)) + ' lichen', () => scrape(S));
  el.append(hands);
  if (!S.seen.pb) el.append(h('p','lede','You are awake. You are a ship. There are ten pieces of scrap on your tray, and your instructions are one word long.'));
  else if (S.pop < 6) note(el, () => !S.seen.lb ? 'Keep stamping. Pry more scrap when the tray runs low.' : !nb(S,'bed') ? 'Next: scrape 10 lichen and plant a lichen bed.' : !nb(S,'hut') ? 'Next: pry 8 scrap and build a moss hut. Something may move in.' : !S.pop ? 'Keep some lichen in store. Somebody is stirring.' : !C.N.scav ? 'Next: open Crew and ask a tardigrade to scavenge, so the scrap comes to you.' : !nb(S,'press') ? 'Next: save 20 spoons for a stamping press.' : !nb(S,'nook') ? 'Next: with two tardigrades aboard, 25 scrap builds a Reading nook.' : 'More huts, more crew. Mind the cold season.');
  if (nb(S,'press')) {
    const row = h('div','ctl'), b = btn('chip','', act(() => cycleShare(S))), st = h('span','ctl-s');
    row.append(h('span','ctl-l','Presses and the rota take'), b, st);
    U(() => { setT(b, S.share >= 1 ? 'all the scrap' : S.share > 0 ? 'half the incoming scrap' : 'nothing (switched off)'); setT(st, C.demand > 0 && S.share > 0 ? 'running at ' + Math.round(100*Math.min(1, S._used/C.demand)) + '%' : S.share <= 0 ? 'saving scrap for plate' : ''); });
    el.append(row);
  }
  if (Object.values(S.b).some(v => v >= 5)) buyMode(el);
  for (const id in BLD) { const d = BLD[id]; if (!d.req(S)) continue;
    const fit = fittedOn(id);
    el.append(item('b_'+id, {title:() => d.n + ' (' + nb(S,id) + ')', sub: fit.length ? () => 'Upgraded: ' + fit.join(', ') : null, act:() => buy(S,id,qn()), cost:() => buy1cost(S,id), desc:d.d,
      more:dd => { const e = h('p','eff'); U(() => setT(e, 'Each: ' + effText(id) + '.')); dd.insertBefore(e, dd.children[1] || null); const pn = h('p','note'); U(() => { const raw = bcost(S,id,1,true); setT(pn, raw.scrap && raw.scrap > buy1cost(S,id).scrap + 1 ? 'You cannot store ' + fmt(raw.scrap) + ' scrap, so the part over 40% of your store is asked in plate instead, 50 scrap to a plate. (Smelters take everything above half.)' : ''); }); dd.append(pn); }})); }
};

/* ---------- Workshop ---------- */
SIG.shop = () => [Object.keys(CRAFT).filter(k => CRAFT[k].req(S)).join(), upgOpen(S).map(u => u.id).join(), showDone, !!S.duty.craft && team(S,'craft').length > 0].join('|');
R.shop = el => {
  el.append(h('p','lede','Hammer the stores into things: one at a time, ten at a time, or everything you can afford.'));
  const crew = S.duty.craft && team(S,'craft').length;
  if (crew) el.append(h('p','note','Your Workshop crew keep each item stocked up to the level you set. Set a level of zero to leave an item to you.'));
  for (const k in CRAFT) { const d = CRAFT[k]; if (!d.req(S)) continue;
    const w = h('div','craft'), top = h('div','ctop'), nm = h('b'), have = h('span','chave'); top.append(nm, have);
    const row = h('div','row'); const cb = (t, q) => { const b = btn('chip', t, act(() => craft(S, k, q()))); U(() => b.disabled = craftMax(S,k) < 1); row.append(b); };
    cb('Craft 1', () => 1); cb('×10', () => 10); cb('All', () => craftMax(S,k));
    w.append(top, h('p','note', d.d + ' Costs ' + costLine(d.c) + '.'), row);
    if (crew) { const kr = h('div','ctl'), kv = h('span','ctl-s'); kr.append(h('span','ctl-l','Keep stocked at'), btn('pm sm','−', act(() => setKeep(S,k,-(S.keep[k] >= 100 ? 50 : 10)))), kv, btn('pm sm','+', act(() => setKeep(S,k,S.keep[k] >= 100 ? 50 : 10)))); U(() => setT(kv, String(S.keep[k]||0))); w.append(kr); }
    U(() => { setT(nm, d.n); setT(have, fmt3(S.r[k]) + ' in store · can make ' + fmt3(craftMax(S,k)*craftYield(S,C))); });
    el.append(w); }
  head(el, 'Upgrades');
  const o = upgOpen(S); if (!o.length) el.append(h('p','note','Nothing to fit yet. Upgrades appear as you build and discover.'));
  o.forEach(u => el.append(item('u_'+u.id, {title:() => u.n, sub:() => u.d, act:() => upgrade(S,u.id), cost:() => u.c, desc:u.d})));
  el.append(btn('link', showDone ? 'Hide fitted upgrades' : 'Show fitted upgrades', () => { showDone = !showDone; frameUI(); }));
  if (showDone) UPG.filter(u => S.up[u.id]).forEach(u => { const d = h('div','done'); d.append(h('b','',u.n), h('span','',u.d)); el.append(d); });
};

/* ---------- Crew ---------- */
function storyCard(el){
  const step = storyStep(S); if (!step) return;
  const card = h('div','card'), cur0 = S.st.cur;
  card.append(h('p','pt', cur0.ch ? 'The crew ask' : 'Petition'), h('p','story', storyText(S, step.t)));
  const row = h('div','opts');
  [step.a, step.b].forEach((o,i) => { const b = btn('opt'); b.append(h('b','',o[0]), h('span','', storyText(S, o[1]))); b.onclick = act(() => storyChoose(S, i)); row.append(b); });
  card.append(row);
  if (team(S,'cttee').length) note(card, () => 'The committee will decide in ' + fmtTime(Math.max(0, 90 - S.st.cur.age)) + ' if you do not.');
  el.append(card);
}
SIG.crew = () => [S.st.cur ? (S.st.cur.ch||'') + (S.st.cur.s||0) + (S.st.cur.p||0) : '', S.done.philosophy, S.done.brewing, Object.keys(JOBS).filter(k => JOBS[k].req(S)).join(), Object.keys(DUTY).filter(k => DUTY[k].unl(S)).join(), Math.min(60, S.crew.length), S.pop >= 10].join('|');
R.crew = el => {
  note(el, () => S.pop + ' of ' + C.capPop + ' berths filled' + (S.tun ? ' · ' + S.tun + ' curled up as tuns, waiting for lichen' : S.pop < C.capPop ? ' · more are waking' : ' · build huts to wake more')).className = 'lede';
  storyCard(el);
  if (S.done.philosophy) {
    note(el, () => 'Accord ' + Math.round(S.accord) + '%' + (Math.abs(C.accT - S.accord) > 1 ? (C.accT > S.accord ? ', rising to ' : ', falling to ') + Math.round(C.accT) + '%' : '') + ' · the crew work at ' + Math.round(C.am*100) + '%');
    meter(el, () => S.accord/100, 'acc');
    const det = h('details','why'); det.open = !!openK.acc; det.ontoggle = () => { openK.acc = det.open; }; det.append(h('summary','','What makes up accord'));
    const list = h('div','parts'); U(() => { const t = C.accParts.map(p => p[0] + '\t' + (p[1] > 0 ? '+' : '') + Math.round(p[1])).join('\n'); if (list._t !== t) { list._t = t; list.replaceChildren(...C.accParts.map(p => { const r = h('div','part'); r.append(h('span','',p[0]), h('b', p[1] < 0 ? 'neg' : '', (p[1] > 0 ? '+' : '') + Math.round(p[1]))); return r; })); } });
    det.append(list, h('p','note','Decisions you make for the crew fade over a few hours. Customs from discoveries stay.')); el.append(det);
  }
  if (S.done.brewing) el.append(item('fest', {title:() => S.fest > 0 ? 'Brew-up in full swing (' + fmtTime(S.fest) + ')' : 'Hold a Brew-up', act:() => festival(S), cost:() => festCost(S), state:() => S.fest > 0 ? 'no' : costState(festCost(S)), desc:'Tea for everyone. Accord +10 and newcomers wake twice as fast while it lasts.'}));
  head(el, 'Trades');
  if (S.pop >= 10) buyMode(el);
  for (const j in JOBS) { const d = JOBS[j]; if (!d.req(S)) continue;
    const w = h('div','job'), nm = h('div','jn'), left = h('div','jl'), sk = h('div','jd'); left.append(nm, h('div','jd', d.d), sk); w.append(left);
    if (j != 'grazer') w.append(btn('pm','−', act(() => setJob(S,j,-(buyQ=='max'?1e9:buyQ)))), btn('pm','+', act(() => setJob(S,j,buyQ=='max'?1e9:buyQ))));
    else w.classList.add('nobtn');
    U(() => { setT(nm, d.n + ' (' + C.N[j] + ')'); const ws = S.crew.filter(t => !t.d && t.j == j); const best = ws.reduce((a,t) => Math.max(a, lvl(t.x[j])), 0); setT(sk, ws.length && j != 'grazer' ? 'Best hand: ' + lvlName(best).toLowerCase() + ' (level ' + best + ', +' + best*5 + '%)' : ''); });
    el.append(w); }
  const dk = Object.keys(DUTY).filter(k => DUTY[k].unl(S));
  if (dk.length) { head(el, 'Duties');
    el.append(h('p','note','Duties are your own jobs, handed to the crew. They start out hopeless and learn by doing, and they learn most from their mistakes. Crew on duty come from the grazers.'));
    for (const k of dk) { const d = DUTY[k], w = h('div','duty'), top = h('div','dtop'), nm = h('b'), cnt = h('span','dcnt'); top.append(nm, cnt);
      const ctl = h('div','dctl'); ctl.append(btn('pm','−', act(() => setDuty(S,k,-1))), btn('pm','+', act(() => setDuty(S,k,1))));
      const last = h('p','dlast'); w.append(top, h('p','note',d.d)); meter(w, () => (S.duty[k] ? S.duty[k].c : 0)/100, 'dutym'); w.append(last, ctl);
      U(() => { const D = S.duty[k] || {c:0}, n = team(S,k).length; setT(nm, d.n); setT(cnt, n ? n + ' on duty · ' + band(D.c) + ' (' + Math.round(D.c) + '%)' : 'Nobody on duty'); setT(last, D.last ? 'Latest: ' + D.last : n ? 'No news yet.' : ''); });
      el.append(w); } }
  if (S.crew.length) { const det = h('details','census'); det.open = !!openK.census; det.ontoggle = () => { openK.census = det.open; frameUI(); };
    det.append(h('summary','', 'Census of ' + S.crew.length));
    if (det.open) { const list = h('div','names'); S.crew.slice(0, 60).forEach(t => { const b = h('div','nm'), l = t.d ? DUTY[t.d].n : JOBS[t.j].n, lv = t.d ? '' : ' · ' + lvlName(lvl(t.x[t.j])).toLowerCase(); b.append(h('b','',t.n), h('span','', l + lv + ' · ' + TRAITS[t.t][0].toLowerCase())); b.title = TRAITS[t.t][1]; list.append(b); }); det.append(list); if (S.crew.length > 60) det.append(h('p','note','And ' + (S.crew.length - 60) + ' more, who are also doing their best.')); }
    el.append(det); }
};

/* ---------- Science ---------- */
const prjItem = p => item('p_'+p.id, {title:() => p.n, act:() => research(S,p.id), cost:() => prjCost(S,p), desc:p.d});
SIG.sci = () => prjOpen(S,'sci').map(p => p.id).join() + showDone;
R.sci = el => {
  const o = prjOpen(S,'sci'); if (!o.length) el.append(h('p','lede','The scholars are out of questions for now. New ones turn up as the hull changes.'));
  else note(el, () => 'Notions ' + fmt(S.r.notions) + ' of ' + fmt(C.caps.notions) + ', +' + fmt(C.notionsIn + C.mind.notions) + ' a second. A red cost needs more storage.').className = 'note';
  o.forEach(p => el.append(prjItem(p)));
  el.append(btn('link', showDone ? 'Hide discoveries' : 'Show discoveries (' + PRJ.filter(p => p.tab == 'sci' && S.done[p.id]).length + ')', () => { showDone = !showDone; frameUI(); }));
  if (showDone) PRJ.filter(p => p.tab == 'sci' && S.done[p.id]).forEach(p => { const d = h('div','done'); d.append(h('b','',p.n), h('span','',p.d)); el.append(d); });
};

/* ---------- Mind ---------- */
const GCOL = {core:'--m-core', prod:'--m-prod', store:'--m-store', amp:'--m-amp', cool:'--m-cool', conv:'--m-conv', odd:'--m-odd'};
const SLOT = 58, ROW = 62;
function mindLayout(N){
  const kids = N.map(() => []); N.forEach((n,i) => { if (n.p >= 0) kids[n.p].push(i); });
  const pos = []; let slot = 0;
  const place = (i, d) => { if (!kids[i].length) { pos[i] = {x: slot++, d}; return; } kids[i].forEach(j => place(j, d + 1)); pos[i] = {x: (pos[kids[i][0]].x + pos[kids[i][kids[i].length-1]].x)/2, d}; };
  place(0, 0); return {pos, w: slot, d: Math.max(...pos.map(p => p.d))};
}
function drawMind(){
  if (!mindCv || !mindCv.isConnected) return;
  const cv = mindCv, N = S.mind.nodes, L = mindLayout(N), box = cv.parentNode.clientWidth; if (!box) return;
  const W = Math.max(box - 2, L.w*SLOT + 24), H = (L.d + 1)*ROW + 30, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv._w != W || cv._h != H) { cv._w = W; cv._h = H; cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); }
  const g = cv.getContext('2d'), cs = getComputedStyle(document.documentElement), col = v => cs.getPropertyValue(v).trim();
  g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  const off = (W - L.w*SLOT)/2 + SLOT/2, xy = i => [off + L.pos[i].x*SLOT, 26 + L.pos[i].d*ROW];
  const t = performance.now()/1000, mc = C.mind, hot = mc.heat > mc.hcap;
  /* pipes */
  N.forEach((n,i) => { if (n.p < 0) return; const [x1,y1] = xy(i), [x0,y0] = xy(n.p), mx = (x0+x1)/2 + (y1-y0)*0.15, my = (y0+y1)/2 - (x1-x0)*0.15;
    g.lineCap = 'round'; g.strokeStyle = col('--pipe-o'); g.lineWidth = 7; g.beginPath(); g.moveTo(x0,y0); g.quadraticCurveTo(mx,my,x1,y1); g.stroke();
    g.strokeStyle = col('--pipe-i'); g.lineWidth = 3; g.stroke();
    const flow = (mc.out[i]||0) + (mc.out[n.p]||0); if (flow > 0 && !opt.calm) { const k = Math.min(4, 1 + Math.floor(Math.log10(1 + flow))); g.fillStyle = col('--m-prod');
      for (let j = 0; j < k; j++) { const u = (t*0.35 + j/k + i*0.13) % 1, bx = (1-u)*(1-u)*x1 + 2*(1-u)*u*mx + u*u*x0, by = (1-u)*(1-u)*y1 + 2*(1-u)*u*my + u*u*y0; g.beginPath(); g.arc(bx, by, 2, 0, 7); g.fill(); } }
    if (n.v < 1) { g.fillStyle = col('--paper'); g.strokeStyle = col('--ink'); g.lineWidth = 1.5; g.beginPath(); g.arc(mx*0.5 + (x0+x1)/4, my*0.5 + (y0+y1)/4, 5, 0, 7); g.fill(); g.stroke(); g.beginPath(); const vx = mx*0.5 + (x0+x1)/4, vy = my*0.5 + (y0+y1)/4; g.moveTo(vx-4, vy); g.lineTo(vx+4, vy); g.stroke(); }
  });
  /* subsystems */
  g.font = '600 10px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  N.forEach((n,i) => { const [x,y] = xy(i), T = MT[n.k], w = 44, hh = 24, sel = S.mind.sel == i;
    if (hot && (T.h||0) > 0) { g.fillStyle = 'rgba(255,80,40,' + (0.18 + 0.1*Math.sin(t*4 + i)) + ')'; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); }
    g.fillStyle = col(GCOL[T.g]); g.strokeStyle = sel ? col('--ink') : col('--pipe-o'); g.lineWidth = sel ? 3 : 1.5;
    const sulk = S.mind.sulk[i] > 0; if (sulk) g.globalAlpha = 0.5 + 0.3*Math.sin(t*8);
    g.beginPath(); g.roundRect ? g.roundRect(x-w/2, y-hh/2, w, hh, 5) : g.rect(x-w/2, y-hh/2, w, hh); g.fill(); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = '#10140f'; g.fillText(T.s, x, y - 1); if (n.lv > 1) { g.fillStyle = col('--ink'); g.beginPath(); g.arc(x + w/2 - 1, y - hh/2 + 1, 7, 0, 7); g.fill(); g.fillStyle = col('--paper'); g.font = '700 9px ui-monospace, Menlo, monospace'; g.fillText(String(n.lv), x + w/2 - 1, y - hh/2 + 1.5); g.font = '600 10px ui-monospace, Menlo, Consolas, monospace'; }
    g.fillStyle = col('--rule'); g.fillRect(x - w/2 + 4, y + hh/2 - 5, w - 8, 3); g.fillStyle = n.cond > 0.5 ? col('--good') : col('--bad'); g.fillRect(x - w/2 + 4, y + hh/2 - 5, (w - 8)*n.cond, 3);
    if (S.done.selfmap && mc.out[i] > 0.05) { g.fillStyle = col('--mute'); g.font = '9px ui-monospace, Menlo, monospace'; g.fillText(fmt(mc.out[i]) + '/s', x, y + hh/2 + 8); g.font = '600 10px ui-monospace, Menlo, Consolas, monospace'; }
  });
  cv._xy = N.map((_,i) => xy(i));
}
function mindTap(e){ const r = mindCv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; tickle(S);
  let best = -1, bd = 900; (mindCv._xy||[]).forEach(([px,py],i) => { const d = (px-x)*(px-x) + (py-y)*(py-y); if (d < bd) { bd = d; best = i; } });
  if (best >= 0) { S.mind.sel = best; hook('tap'); frameUI(); } }
SIG.mind = () => [S.done.sparework, S.mind.task, S.mind.task == 'coach' ? Object.keys(S.duty).join() + S.mind.coach : '', prjOpen(S,'mind').map(p => p.id).join(), S.mind.offer ? S.mind.offer.join() : '', S.mind.nodes.length, S.mind.nodes.map(n => n.p).join('.'), S.mind.sel, S.cand ? S.cand.map(c => c.n).join() : '', S.done.naming, S.fleet[0], S.done.hydraulics, S.duty.mind && team(S,'mind').length > 0].join('|');
R.mind = el => {
  note(el, () => 'Mandate ' + S.mand + (S.mp ? ' · ' + S.mp + ' unspent' : '') + ' · next at ' + fmt(thr(S)) + ' spoons made').className = 'lede';
  meter(el, () => { const lo = S.mand ? thr(S)/2.1 : 0; return (S.made - lo)/(thr(S) - lo); });
  if (S.mind.offer) { const box = h('div','offer'); box.append(h('p','pt', S.mind.dreamt ? 'The Mind dreamt these: choose one' : 'Requisition: choose one subsystem'));
    S.mind.offer.forEach(k => { const T = MT[k], b = btn('opt'); b.append(h('b','',T.n), h('span','', MG[T.g] + '. ' + T.d)); b.onclick = act(() => mindTake(S, k)); box.append(b); });
    box.append(h('p','note','It will be wired where it seems most useful. You can move it afterwards.')); el.append(box); }
  else el.append(item('draft', {title:() => 'Requisition a subsystem', act:() => mindDraft(S), state:() => S.mp >= 1 ? '' : 'no', desc:'Spend 1 Mandate. The Bureau sends three candidates, all second-hand. Pick one to fit. The Bureau only sends storage when the Mind has more than twice as many thinking parts as storage parts, and then it always sends one.', more:d => note(d, () => S.mp >= 1 ? S.mp + ' Mandate to spend.' : 'You need Mandate, which comes from making spoons.')}));
  /* the diagram */
  const wrap = h('div','mindwrap'), leg = h('div','legend'); for (const g in MG) { const c = h('span','lg'); c.style.setProperty('--c', 'var(' + GCOL[g] + ')'); c.textContent = MG[g]; leg.append(c); } mindCv = h('canvas','mindcv'); mindCv.setAttribute('role','img'); mindCv.setAttribute('aria-label','Diagram of the Mind’s subsystems and how they are wired'); mindCv.onclick = mindTap; wrap.append(mindCv); el.append(wrap, leg);
  const stats = h('div','mstats'); U(() => { const mc = C.mind; setT(stats, 'Thinking ' + fmt(mc.cps) + '/s · holds ' + fmt(mc.cap) + ' · heat ' + mc.heat.toFixed(1) + ' of ' + mc.hcap.toFixed(0) + (mc.pen < 1 ? ' · overheating: thought −' + Math.round(100*(1-mc.pen)) + '%' : '') + (mc.notions > 0 ? ' · +' + fmt(mc.notions) + ' notions/s' : '')); }); el.append(stats);
  meter(el, () => C.mind.heat/(C.mind.hcap*1.5), 'heat');
  const N = S.mind.nodes, i = Math.min(S.mind.sel||0, N.length-1), n = N[i], T = MT[n.k], pn = h('div','node');
  pn.append(h('p','pt', MG[T.g] + (i == 0 ? '' : ' · wired to the ' + MT[N[n.p].k].n)), h('h3','', T.n), h('p','note', T.d));
  const ns = h('p','note'); U(() => { const o = C.mind.out[i]||0; setT(ns, 'Level ' + n.lv + ' · condition ' + Math.round(n.cond*100) + '%' + (o > 0.01 ? ' · thinking ' + fmt(o) + '/s' : '') + (n.v < 1 ? ' · valve ' + (n.v > 0 ? 'half open' : 'shut') : '') + (S.mind.sulk[i] > 0 ? ' · arguing' : '')); }); pn.append(ns);
  const row = h('div','row');
  const ub = btn('chip','', act(() => nodeUp(S,i))); U(() => { const c = nodeUpCost(n); ub.textContent = 'Upgrade: ' + costLine(c) + ((n.lv >= 2 && !S.done.wiredraw) || (n.lv >= 4 && !S.done.gears) ? ' (needs ' + (n.lv >= 4 ? 'Gearing' : 'Wiredrawing') + ')' : ''); ub.disabled = !canPay(S,c); }); row.append(ub);
  const sb = btn('chip','', act(() => service(S,i))); U(() => { sb.textContent = n.cond > 0.99 ? 'In good order' : 'Service: ' + costLine(serviceCost(n)); sb.disabled = n.cond > 0.99 || !canPay(S, serviceCost(n)); }); row.append(sb);
  if (S.done.hydraulics) { const vb = btn('chip','', act(() => valve(S,i))); U(() => { vb.textContent = 'Valve: ' + (n.v >= 1 ? 'open' : n.v > 0 ? 'half' : 'shut'); }); row.append(vb); }
  pn.append(row);
  if (i > 0) { const opts = N.map((_,j) => j).filter(j => canWire(N, i, j));
    if (opts.length) { const det = h('details','why'); det.open = !!openK.rewire; det.ontoggle = () => { openK.rewire = det.open; }; det.append(h('summary','','Rewire it to another subsystem'));
      const rr = h('div','row'); opts.forEach(j => rr.append(btn('chip', MT[N[j].k].n + (N[j].lv > 1 ? ' ' + N[j].lv : ''), act(() => rewire(S, i, j))))); det.append(rr, h('p','note','Neighbours matter. Amplifiers boost whatever they touch, coolers calm the whole Mind, and some subsystems take against each other.')); pn.append(det); } }
  el.append(pn);
  if (team(S,'mind').length) { const D = S.duty.mind; note(el, () => 'Mind crew: ' + band(D.c).toLowerCase() + '. ' + (D.last || 'They are reading the diagram upside down.')); }
  if (S.done.sparework) { head(el, 'Spare thought');
    note(el, () => S.r.cycles >= C.mind.cap*0.995 ? 'The Mind is full. Every thought past the brim goes to: ' + TASKS[S.mind.task][0].toLowerCase() + '.' : 'Spare thought is only what overflows a full Mind. ' + fmt(C.mind.cap - S.r.cycles) + ' to go.');
    const g = h('div','tasks'); for (const t in TASKS) { const b = btn('opt'); b.append(h('b','',TASKS[t][0]), h('span','',TASKS[t][1])); b.onclick = act(() => setTask(S,t)); U(() => b.classList.toggle('on', S.mind.task == t)); g.append(b); } el.append(g);
    if (S.mind.task == 'coach') { const dk = Object.keys(S.duty).filter(k => team(S,k).length); if (!dk.length) el.append(h('p','note','Nobody is on a duty yet, so there is nobody to coach.')); else { const rr = h('div','row'); dk.forEach(k => { const b = btn('chip', DUTY[k].n, act(() => setTask(S,'coach',k))); U(() => b.classList.toggle('on', S.mind.coach == k)); rr.append(b); }); el.append(rr); } }
    if (S.mind.task == 'dream') { note(el, () => 'Dreaming: ' + Math.floor(100*S.mind.dream/dreamNeed(S)) + '% of the way to a new subsystem.'); meter(el, () => S.mind.dream/dreamNeed(S), 'dutym'); }
    if (S.mind.task == 'forecast') note(el, () => S.mind.fc ? (S.comet > 0 ? 'A comet is overhead now.' : 'Next comet in about ' + fmtTime(Math.max(0, S.cometT/1.3)) + '.') + ' ' + (S.weather > 0 ? 'A flare is feeding the lichen this season.' : S.weather < 0 ? 'Dust is dimming the light this season.' : 'A quiet season.') : 'The forecast only runs while the Mind is full.');
  }
  head(el, 'Projects');
  const o = prjOpen(S,'mind'); if (!o.length) el.append(h('p','note','Nothing on the desk. Keep making spoons.'));
  o.forEach(p => el.append(prjItem(p)));
  if (S.done.naming) { head(el, 'Naming committee');
    if (S.cand) { el.append(h('p','note','Three proposals. The crew have a favourite kind, and will not tell you which.')); S.cand.forEach((nm,i) => el.append(btn('namecand', nm.n, act(() => nameChoose(S,i))))); }
    else el.append(item('names', {title:() => 'Convene the committee', act:() => nameSession(S), cost:() => ({cycles:500}), desc:'Pick a name. Whimsy if the crew like it; a little even if they do not.'}));
    if (S.fleet.length) { el.append(h('p','note','Register of names')); const ul = h('ul','fleet'); S.fleet.forEach(n => ul.append(h('li','',n))); el.append(ul); } }
};

/* ---------- Trade ---------- */
SIG.trade = () => [nb(S,'antenna'), S.pedlar > 0, M.guide.m3].join('|');
R.trade = el => {
  note(el, () => 'Hails ready: ' + Math.floor(S.hails) + ' of ' + C.capHails + '. One hail recharges every ' + Math.round(90/S.m.hail/(qk(S).hail||1)) + ' seconds.').className = 'lede';
  if (nb(S,'antenna') >= 1) note(el, () => 'The neighbours remember. Trade with one too often and they give less; buy up their goods and the price climbs until they restock. Both come back with time.');
  for (const id in PART) { const p = PART[id];
    if (nb(S,'antenna') >= p.ant) el.append(item('t_'+id, {title:() => 'Hail ' + p.n, sub:() => { const m = mk(S,id), f = favM(S,id); return 'Standing ' + S.stand[id] + ' · ' + MOOD(m.ap) + (f > 1 ? ', and it is their season' : f < 1 ? ', and it is their slack season' : '') + ' · ' + RNAME[SPEC[id]] + ': ' + STOCK(m.st) + ' · they give ' + Object.entries(tradeGive(S,id,C)).map(([r,x]) => fmt(x) + ' ' + RNAME[r]).join(' and '); }, act:() => trade(S,id), state:() => S.hails >= 1 && canPay(S,tradeCost(S,id)) ? '' : 'no', cost:() => tradeCost(S,id), desc:p.d + ' Keenest at ' + SEASONS[MKT[id].fav].n + '.'}));
    else el.append(h('p','note','A fainter signal. You will need ' + p.ant + ' antennas to hear it.')); }
  if (S.pedlar > 0) { head(el, 'Odd Tuesday is alongside'); note(el, () => 'Leaving in ' + fmtTime(S.pedlar) + '.');
    if (!M.guide.m3) el.append(item('ped_a', {title:() => 'Buy an antique spoon', act:() => pedlarBuy(S,'antique'), cost:() => ({spoons:1000}), desc:'“Very old. Older than it should be. No refunds, past or future.”'}));
    PED.forEach(([r,n,w]) => el.append(item('ped_'+r, {title:() => 'Buy ' + n + ' ' + RNAME[r], act:() => pedlarBuy(S,r), cost:() => ({whimsy:w}), desc:'“You will want these. You do not yet, but you will.”'}))); }
};

/* ---------- Time, Margin, Records ---------- */
SIG.time = () => margCount() + '|' + S.flux + '|' + S.st.flags.forecast;
R.time = el => {
  note(el, () => 'Year ' + C.cal.year + ', ' + SEASONS[C.cal.i].n + ', day ' + C.cal.day + ' · this hull has been awake for ' + fmtTime(S.age)).className = 'lede';
  note(el, () => 'Next: ' + SEASONS[(C.cal.i+1)%4].n + ' in ' + fmtTime(seasonLen(S) - S.age % seasonLen(S)) + (S.st.flags.forecast ? (S.weather > 0 ? ' · the sunspot charts show a flare feeding the lichen' : S.weather < 0 ? ' · the sunspot charts show dust dimming the light' : ' · the sunspot charts show a quiet season') : ''));
  head(el, 'Banked time');
  note(el, () => fmtTime(S.bank) + ' banked (three hours at most). Time banks while you are paused or away, a second for every three.');
  el.append(item('flux', {title:() => S.flux ? 'Stop spending banked time' : 'Spend banked time (hull runs ×4)', act:() => { S.flux = S.flux ? 0 : 1; }, state:() => S.bank > 1 || S.flux ? '' : 'no', desc:'While this is on, everything aboard runs four times as fast until the bank is empty.'}));
  head(el, 'Anomalies');
  el.append(h('p','note','The scholars keep a list of things that are in the wrong order. ' + margCount() + ' of ' + MARGS.length + ' found so far. More are waiting beyond the rock.'));
  MARGS.forEach((k,i) => { const g = GUIDE.find(x => x.id == k), d = h('div','done' + (M.guide[k] ? '' : ' dim')); d.append(h('b','', M.guide[k] ? g.t : 'Unfound'), h('span','', M.guide[k] ? g.x : MARG_HINT[i])); el.append(d); });
};
SIG.margin = () => GUIDE.filter(g => M.guide[g.id]).length + '';
R.margin = el => {
  const n = GUIDE.filter(g => M.guide[g.id]).length;
  el.append(h('p','lede','Your manual, and what somebody wrote in its margins. ' + n + ' of ' + GUIDE.length + ' entries.'));
  GUIDE.forEach(g => { const d = h('div','done' + (M.guide[g.id] ? '' : ' dim')); d.append(h('b','', M.guide[g.id] ? g.t : '· · ·'), h('span','', M.guide[g.id] ? g.x : '')); el.append(d); });
};
SIG.rec = () => [Object.keys(M.ach).length, Object.keys(M.endings).length, S.quirk, S.ended].join('|');
R.rec = el => {
  note(el, () => 'Life ' + (M.runs + 1) + ' · awake ' + fmtTime(S.age) + ' · ' + fmtLong(S.made) + ' spoons made · ' + fmt(S.hand.stamp) + ' stamped by hand').className = 'lede';
  if (S.quirk) el.append(h('p','note','This life’s quirk: ' + QK[S.quirk].n + '. ' + QK[S.quirk].d));
  bureauFile(el);
  head(el, 'Endings');
  for (const k in ENDS) { const got = M.endings[k], d = h('div','done' + (got ? '' : ' dim')); d.append(h('b','', got ? ENDS[k].t : 'Not yet reached'), h('span','', got ? ENDS[k].h : ACH['end_'+k][1])); el.append(d); }
  el.append(h('p','note','Stage one ends when you reignite the engine. The other endings are beyond the rock.'));
  head(el, 'Records (' + Object.keys(M.ach).length + ' of ' + Object.keys(ACH).length + ')');
  for (const k in ACH) { if (k.startsWith('end_')) continue; const got = M.ach[k], d = h('div','done' + (got ? '' : ' dim')); d.append(h('b','', got ? ACH[k][0] : '? ? ?'), h('span','', got ? ACH[k][1] : '')); el.append(d); }
  if (S.ended) el.append(btn('chip','Begin a new life', beginAgain));
};

/* ---------- the Bureau's dispatches, and the crisis ---------- */
const STAMP = {directive:'Action required', quota:'In force', reprimand:'Collected', nominal:'Noted', amend:'Suspended'};
function memoRef(f){ const sl = seasonLen(S), y = Math.floor(f.a/(4*sl)); return 'Ref. ' + f.id.toUpperCase() + '/' + (y + 1) + ' · filed in year ' + y; }
function showDispatch(f){
  const a = S.arc, asking = f.ask && a.ph == 1;
  sheet((el, close) => {
    el.classList.add('memo');
    el.append(h('p','lh','Bureau of Cutlery Equilibrium'), h('p','ref', memoRef(f)), h('h2','', f.t));
    f.x.split('\n\n').forEach(p => el.append(h('p','mx', p)));
    el.append(h('div','stamp' + (asking ? ' red' : ''), STAMP[f.id] || 'Filed'));
    if (asking) {
      const o = h('div','opts');
      const b1 = btn('opt'); b1.append(h('b','','Obey the Bureau'), h('span','','Burn half your scrap, plate and wire, and some of the huts. The orbit holds, and a quota of spoons follows.'));
      const b2 = btn('opt'); b2.append(h('b','','Trust the crew'), h('span','','Keep everything. Each year grows longer and colder until you find a way to correct course yourselves.'));
      b1.onclick = act(() => { arcChoose(S,'obey'); close(); }); b2.onclick = act(() => { arcChoose(S,'trust'); close(); });
      o.append(b1, b2); el.append(o, h('p','note','You cannot change your mind afterwards.'), btn('chip wide','Decide later', close));
    } else el.append(btn('chip wide','File it', close));
    el.tabIndex = -1; setTimeout(() => el.focus(), 0);   /* no answer starts out selected */
  }, asking);
}
function showCrisis(){
  const a = S.arc;
  if (a.ph == 1) return showDispatch(a.files.find(f => f.id == 'directive'));
  sheet((el, close) => {
    const trust = a.route == 'trust', done = a.ph == 3;
    el.append(h('p','pt', done ? 'After' : trust ? 'You trusted the crew' : 'You obeyed the Bureau'), h('h2','', done ? (trust ? 'The Long Summer' : 'The Charter holds') : trust ? 'The Long Dark' : 'The Quota'));
    if (done) el.append(h('p','note', trust ? 'The rock is back on course. Lichen grows faster for a few years, the frozen crew thaw as it warms, and everyone wants to build: construction costs 40% less for six years.' : 'The quota is lifted for good, and your reserves and huts are back. The presses run faster for a while, the crew are with you, and everyone wants to build: construction costs 40% less for six years.'));
    else {
      el.append(h('p','note', trust ? 'Every year is longer and colder than the last. Keep the huts warm with boilers, and keep lichen stored for the dark. Crew who freeze are kept in the cold store, and will thaw when it is warm again. The way out begins in Science, with Measure the drift. Nobody wakes in the dark season.'
        : 'Each quota is a little higher than the last, and a missed one costs tea and plate. When accord falls much below half, crew start to leave. Tea, brew-ups, bards and gardens keep spirits up. The way out begins in Science, with Collective bargaining.'));
      const bar = h('div','sbar'), fill = h('i'); bar.append(fill); el.append(h('p','pt', trust ? 'Cold' : 'Unrest'), bar);
      const line = h('p','note'); el.append(line);
      const upd = () => { fill.style.width = Math.round(a.strain) + '%'; line.textContent = trust ? 'Drift ' + Math.round(100*a.drift) + '% · ' + a.iced.length + ' in the cold store'
        : 'Quota ' + (a.q.n + 1) + ': ' + fmt(S.made - a.q.base) + ' of ' + fmt(a.q.target) + ' spoons, ' + fmtTime(Math.max(0, QLEN - a.q.t)) + ' left · ' + a.met + ' met, ' + a.miss + ' missed · ' + a.gone.length + ' have left'; };
      upd(); const iv = setInterval(() => { if (!el.isConnected) return clearInterval(iv); upd(); }, 500);
      el.append(h('p','note','Nothing gets worse while you are away.'));
    }
    el.append(btn('chip wide','Reread the Bureau’s directive', () => { close(); showDispatch(a.files.find(f => f.id == 'directive')); }), btn('chip wide','Close', close));
  });
}
function arcBar(){
  const el = $('arcbar'), a = S.arc; if (!a) return;
  const on = a.ph == 1 || a.ph == 2 || (a.ph == 3 && S.age - a.res < 1800);
  if (el.hidden === on) el.hidden = !on; if (!on) return;
  let t, k = '';
  if (a.ph == 1) { t = 'The Bureau awaits your answer'; k = 'ask'; }
  else if (a.ph == 3) { t = a.route == 'trust' ? 'The Long Summer has begun' : 'The quota is lifted'; k = 'ok'; }
  else if (a.route == 'trust') t = 'The Long Dark · cold ' + Math.round(a.strain) + '%' + (a.iced.length ? ' · ' + a.iced.length + ' frozen' : '');
  else t = 'Quota ' + (a.q.n + 1) + ' · ' + Math.round(100*Math.min(1, (S.made - a.q.base)/a.q.target)) + '% · ' + fmtTime(Math.max(0, QLEN - a.q.t)) + ' left' + (a.gone.length ? ' · ' + a.gone.length + ' gone' : '');
  if (el._k !== k) { el._k = k; el.className = k; }
  setT(el.firstChild, t); el.lastChild.style.width = (a.ph == 2 ? Math.round(a.strain) : 0) + '%';
}
function bureauFile(el){
  const a = S.arc; if (!a || !a.files.length) return;
  head(el, 'The Bureau file');
  a.files.slice().reverse().forEach(f => { const b = btn('done file'); b.append(h('b','', f.t), h('span','', memoRef(f))); b.onclick = () => showDispatch(f); el.append(b); });
}

/* ---------- fixed chrome ---------- */
const ALLRES = ['lichen','scrap','spoons','ice','notions','cycles','whimsy','plate','wire','spring','gear','lens','ledger','tea','grit','spores','footnotes'];
const TABRES = {hull:['lichen','scrap','spoons','ice','plate'], shop:['scrap','plate','wire','spring','gear','lens','ledger','tea'], crew:['lichen','tea','spoons','whimsy'],
  sci:['notions','plate','lens','ledger','spores','footnotes'], mind:['cycles','whimsy','notions','plate','gear'], trade:['spoons','tea','ledger','grit','spores','footnotes'],
  time:['lichen','scrap','spoons','notions','cycles'], margin:['lichen','scrap','spoons','notions','cycles'], rec:['lichen','scrap','spoons','notions','cycles']};
const resUnlocked = r => r == 'lichen' || r == 'scrap' || (r == 'spoons' && S.made >= 1) || (r == 'ice' && (S.r.ice > 0 || S.done.condense)) || (r == 'notions' && nb(S,'nook') >= 1) || (r == 'cycles' && S.seen.mind) || (r == 'whimsy' && (S.r.whimsy >= 0.5 || S.done.apology)) || (CRAFT[r] && (CRAFT[r].req(S) || S.r[r] > 0)) || ((r == 'grit' || r == 'spores' || r == 'footnotes') && (S.r[r] > 0 || nb(S,'antenna') >= 1));
const wide = () => window.matchMedia && matchMedia('(min-width:900px)').matches;
const resShown = () => (wide() ? ALLRES : TABRES[cur] || TABRES.hull).filter(resUnlocked);
/* where each store comes from and where it goes, per second */
function flows(r){ const c = C, m = S.m, f = [], aph = c.cal.i == 2;
  const add = (l, x) => { if (Math.abs(x) > 1e-6) f.push([l, x]); };
  if (r == 'lichen') { add('Lichen beds and gardens', c.bedIn); add('Grazers', c.lichenIn - c.bedIn); add('Crew eating', -c.eat); if (c.kettle && S.r.lichen > c.caps.lichen*0.3) add('Kettle-houses', -c.kettle*0.5); }
  if (r == 'scrap') { add('Scavengers', c.scrapIn); add('Presses and the rota', -S._used); if (c.smelt && S.r.scrap > c.caps.scrap*0.5) add('Smelters', -c.smelt); if (aph && nb(S,'boiler')) add('Boilers (Aphelion)', -nb(S,'boiler')*0.2*m.fuel); }
  if (r == 'spoons') add('Presses and the rota', S._sp);
  if (r == 'ice') { add('Icers and condensers', c.iceIn); if (c.kettle && S.r.lichen > c.caps.lichen*0.3) add('Kettle-houses', -c.kettle*0.2); }
  if (r == 'notions') { add('Scholars', c.notionsIn - nb(S,'obs')*0.1*m.obs); add('Observatories', nb(S,'obs')*0.1*m.obs); add('Notion Press', c.mind.notions); }
  if (r == 'cycles') { add('The Mind thinking', c.mind.cps); }
  if (r == 'tea') { if (c.kettle && S.r.lichen > c.caps.lichen*0.3) add('Kettle-houses', c.kettle*0.01); add('Crew drinking', -c.teaUse); }
  if (r == 'plate') { if (c.smelt && S.r.scrap > c.caps.scrap*0.5) add('Smelters', c.smelt/50); if (c.mill) add('Drawing mills', -c.mill*0.03); }
  if (r == 'wire' && c.mill) add('Drawing mills', c.mill*0.015);
  return f; }
const ORIGIN = {whimsy:'Leaks from a full Mind and from bards (three times as much once they know Work songs). Spent on odd projects, latitude and the pedlar.', plate:'Hammered from scrap in the Workshop, or sweated out by smelters.', wire:'Drawn from plate in the Workshop or by drawing mills.', spring:'Coiled from wire in the Workshop.', gear:'Cut in the Workshop from plate and springs.', lens:'Ground from ice and grit in the Workshop.', ledger:'Pressed from plate and notions in the Workshop. The Quorate want them.', tea:'Brewed by kettle-houses or by hand in the Workshop. The crew drink it constantly.', grit:'Only the Gravel Choir have it. Hail them from the Trade tab.', spores:'Only the Slow Bloom have them.', footnotes:'Only the Quorate sell them, for ledgers.', spoons:'Stamped from scrap by hand, by presses and by the rota.', cycles:'Thought. The Mind makes it; projects and the naming committee spend it.'};
function showStore(r){
  sheet((el, close) => {
    const cap = capOf(S,C,r), f = flows(r), net = f.reduce((a,x) => a + x[1], 0);
    el.append(h('p','pt','Store'), h('h2','', RNAME[r].charAt(0).toUpperCase() + RNAME[r].slice(1)));
    const big = h('p','end-x'); el.append(big);
    const list = h('div','parts'); el.append(list);
    const eta = h('p','note'); el.append(eta);
    if (ORIGIN[r]) el.append(h('p','note', ORIGIN[r]));
    const upd = () => { const ff = flows(r), n = ff.reduce((a,x) => a + x[1], 0), x = S.r[r];
      big.textContent = fmt(x) + (isFinite(cap) ? ' of ' + fmt(capOf(S,C,r)) : '') + (Math.abs(n) > 1e-6 ? ', ' + (n > 0 ? '+' : '') + fmt(n) + ' a second' : '');
      list.replaceChildren(...ff.map(p => { const rr = h('div','part'); rr.append(h('span','',p[0]), h('b', p[1] < 0 ? 'neg' : '', (p[1] > 0 ? '+' : '') + fmt(p[1]) + '/s')); return rr; }));
      const c2 = capOf(S,C,r); eta.textContent = n > 1e-6 && isFinite(c2) ? (x >= c2*0.995 ? 'Full. Anything more is wasted.' : 'Full in ' + fmtTime((c2 - x)/n) + '.') : n < -1e-6 ? 'Empty in ' + fmtTime(x/-n) + '.' : ''; };
    upd(); const iv = setInterval(() => { if (!el.isConnected) return clearInterval(iv); upd(); }, 500);
    el.append(btn('chip wide','Close', close));
  });
}
function buildChrome(){
  const res = $('res'); res.replaceChildren(); fixed = [];
  ALLRES.forEach(r => { const w = btn('r r-' + r), top = h('div','rn'), v = h('div','rv'), rt = h('span','rr'), cp = h('span','rc'), bar = h('i','rbar'); top.append(h('span','',RNAME[r]), rt); v.append(h('span','rx'), cp); w.append(top, v, bar); w.onclick = () => showStore(r); w.setAttribute('aria-label', RNAME[r] + ' details'); res.append(w);
    fixed.push(sh => { const vis = sh.includes(r); if (w.hidden === vis) w.hidden = !vis; if (!vis) return; const x = S.r[r], c = capOf(S,C,r), d = flows(r).reduce((a,p) => a + p[1], 0);
      setT(v.firstChild, fmt3(x)); setT(cp, isFinite(c) && wide() ? '/' + fmt3(c).replace(/\.0+(?=[A-Z]|$)/, '') : ''); setT(rt, Math.abs(d) < 0.005 ? '' : (d > 0 ? '+' : '') + fmt3(d));
      const pc = isFinite(c) ? clamp(x/c, 0, 1) : -1; bar.hidden = pc < 0; if (pc >= 0) { const wv = (pc*100).toFixed(1) + '%'; if (bar._w !== wv) { bar._w = wv; bar.style.width = wv; } }
      setD(w, 's', isFinite(c) && x >= c*0.995 ? 'full' : x <= 0 && d < 0 ? 'bad' : ''); setD(rt, 's', d < 0 ? 'bad' : ''); }); });
  const crew = h('div','r'), ct = h('div','rn'), cv = h('div','rv'); ct.append(h('span','','crew'), h('span','rr')); cv.append(h('span','rx'), h('span','rc')); crew.append(ct, cv); res.append(crew);
  fixed.push(() => { const vis = S.pop > 0 || C.capPop > 0; if (crew.hidden === vis) crew.hidden = !vis; setT(cv.firstChild, String(S.pop)); setT(cv.lastChild, '/' + C.capPop); setT(ct.lastChild, S.tun ? S.tun + ' tun' : S.done.philosophy ? 'acc ' + Math.round(S.accord) + '%' : ''); setD(ct.lastChild, 's', S.tun ? 'bad' : ''); });
  $('arcbar').onclick = () => { S.here = S.age; showCrisis(); };
  $('ship').onclick = () => { if (S.ended) return; rename(S); checks(S); frameUI(); };
  $('pause').onclick = () => setPause(!S.paused);
  $('menu').onclick = showMenu;
  $('observe').onclick = act(() => observe(S));
  $('log').onclick = () => $('logbar').classList.toggle('tall');
  let bigT = 0;
  $('view').onclick = e => { if (e.target.closest('button')) return;
    const r = $('sky').getBoundingClientRect(), x = (e.clientX - r.left)/r.width, y = (e.clientY - r.top)/r.height, s = Sky.sun(C.cal.frac);
    if (Math.hypot((x - s.x)*r.width, (y - s.y)*r.height) < 26) { S.sunTaps++; if (S.sunTaps == 3) log(S,'Please do not tap the sun.',''); if (S.sunTaps == 10) { log(S,'The sun has now been tapped ten times. It is fine. You are the one who has to live with yourself.',''); ach('sun'); } frameUI(); return; }
    const v = $('view'), open = !v.classList.contains('big'); v.classList.toggle('big', open); clearTimeout(bigT); if (open) bigT = setTimeout(() => v.classList.remove('big'), 12000); };
}
function drawTabs(){
  const nav = $('tabs'); nav.replaceChildren();
  TABS.filter(t => t.show()).forEach(t => { const b = btn(t.id == cur ? 'on' : '', t.n, () => { cur = t.id; S.seen['v_'+t.id] = 1; tabSig = ''; frameUI(); main.scrollTop = 0; }); if (t.badge() || (!S.seen['v_'+t.id] && t.id != 'hull')) b.append(h('i','dot')); b.id = 'tab-' + t.id; nav.append(b); });
}
function drawTop(){
  const sh = resShown(); for (const f of fixed) f(sh);
  setT($('ship'), S.ship.n);
  const cl = C.cal, sn = SEASONS[cl.i];
  setT($('date'), S.done.calendar ? 'Year ' + cl.year + ' · ' + sn.n + (sn.w ? ' (' + sn.w + ')' : '') + ', day ' + cl.day : 'Day ' + (Math.floor(S.age/DAY) + 1) + (S.seen.aph || cl.i ? ' · ' + sn.n : ''));
  arcBar();
  setT($('count'), fmtLong(S.made)); setT($('count-l'), S.made == 1 ? 'spoon made' : 'spoons made');
  const df = $('deficit'); if (df.hidden === !!S.done.smallprint) df.hidden = !S.done.smallprint; if (S.done.smallprint) setT(df, 'Deficit ' + fmtLong(Math.max(0, DEFICIT - S.made)));
  setT($('pause'), S.paused ? 'Resume' : S.flux && S.bank > 0 ? '×4' : 'Pause'); $('app').classList.toggle('paused', !!S.paused);
  const ob = $('observe'); ob.disabled = !(S.comet > 0); ob.classList.toggle('live', S.comet > 0);
  const last = S.log[S.log.length - 1];
  if (last !== logSeen) { logSeen = last; const box = $('log'); box.replaceChildren(); for (let i = S.log.length - 1; i >= Math.max(0, S.log.length - 40); i--) { const e = S.log[i], p = h('p', e.k); p.textContent = (i == S.log.length - 1 ? '> ' : '. ') + e.m; box.append(p); } box.scrollTop = 0; }
}
function frameUI(){
  C = calc(S);
  if (!TABS.find(t => t.id == cur).show()) cur = 'hull';
  const ts = cur + TABS.filter(t => t.show()).map(t => t.id + (t.badge() ? '*' : '') + (S.seen['v_'+t.id] ? '' : '!')).join();
  if (ts != tabSig) { tabSig = ts; drawTabs(); }
  const s2 = cur + '#' + SIG[cur]();
  if (s2 != sig) { const keep = sig.split('#')[0] == cur ? main.scrollTop : 0; sig = s2; ups = []; mindCv = null; main.replaceChildren(); R[cur](main); main.scrollTop = keep; }
  else for (const f of ups) f();
  drawTop();
  if (S.arc && S.arc.unread > 0 && !document.querySelector('.back')) { const a = S.arc, f = a.files[a.files.length - a.unread]; a.unread--; if (f) showDispatch(f); }
  if (needEnd) { needEnd = false; showEnd(); }
  if (S.seen.stage2 && !S.seen.stage2shown) { S.seen.stage2shown = 1; showStageEnd(); }
}

/* ---------- toasts, sound, sheets ---------- */
function toast(msg){ const t = h('div','toast',msg); $('toasts').append(t); setTimeout(() => t.classList.add('out'), 4200); setTimeout(() => t.remove(), 4800); }
let AC = null;
function beep(f, d, v, type){ if (!opt.sound) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime; o.type = type || 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d); } catch (e) {} }
hook = (k, x) => {
  if (k == 'stamp') { pulseV = 1; beep(880, 0.06, 0.04, 'square'); }
  else if (k == 'tap') beep(330, 0.05, 0.03);
  else if (k == 'buy') beep(520, 0.09, 0.04);
  else if (k == 'fail') beep(140, 0.08, 0.03, 'sawtooth');
  else if (k == 'unlock') { beep(660, 0.12, 0.04); setTimeout(() => beep(990, 0.18, 0.04), 110); }
  else if (k == 'ach') { toast('Record: ' + x); beep(784, 0.25, 0.04); }
  else if (k == 'end') needEnd = true;
  else if (k == 'dispatch') { beep(1320, 0.05, 0.04, 'square'); setTimeout(() => beep(1320, 0.05, 0.04, 'square'), 90); setTimeout(() => beep(660, 0.3, 0.04), 200); }
};
function sheet(build, lock){
  const back = h('div','back'), box = h('div','sheet'); back.append(box); const close = () => back.remove();
  if (!lock) back.onclick = e => { if (e.target == back) close(); };
  build(box, close); document.body.append(back); const f = box.querySelector('button'); if (f) f.focus(); return close;
}
function showMenu(){
  sheet((el, close) => {
    el.append(h('h2','','The Teaspoon Deficit'), h('p','pt', BUILD), h('p','note','Stage one. You are a derelict ship. Stamp spoons, wake the crew, teach them your jobs, grow your Mind. The game saves itself and keeps working for up to twelve hours while you are away. Pause banks time instead.'));
    const row = (t, fn) => { const b = btn('chip wide', t, fn); el.append(b); return b; };
    row(S.paused ? 'Resume' : 'Pause', () => { setPause(!S.paused); close(); });
    row('Save now', () => { save(true); toast('Saved.'); close(); });
    const sb = row('', () => { opt.sound = opt.sound ? 0 : 1; saveOpt(); sb.textContent = 'Sound: ' + (opt.sound ? 'on' : 'off'); beep(660, 0.1, 0.04); }); sb.textContent = 'Sound: ' + (opt.sound ? 'on' : 'off');
    const cb = row('', () => { opt.calm = opt.calm ? 0 : 1; saveOpt(); cb.textContent = 'Window: ' + (opt.calm ? 'still' : 'moving'); }); cb.textContent = 'Window: ' + (opt.calm ? 'still' : 'moving');
    row('Copy or load a save code', () => { close(); showCode(); });
    if (S.ended) row('Begin a new life', () => { close(); beginAgain(); });
    let armed = 0; const wb = row('Erase everything and start over', () => { if (!armed) { armed = 1; wb.textContent = 'Tap again to erase every life and record'; wb.classList.add('danger'); return; } M = newMeta(); S = null; newRun(''); close(); });
    row('Close', close);
  });
}
function showCode(){
  sheet((el, close) => {
    el.append(h('h2','','Save code'), h('p','note','Copy this somewhere safe, or paste a code from another device and load it.'));
    const ta = h('textarea','code'); ta.id = 'savecode'; ta.value = btoa(unescape(encodeURIComponent(JSON.stringify({S, M})))); ta.setAttribute('aria-label','Save code'); el.append(ta);
    const msg = h('p','note','');
    el.append(btn('chip wide','Copy', () => { ta.select(); try { navigator.clipboard.writeText(ta.value).then(() => { msg.textContent = 'Copied.'; }, () => { msg.textContent = 'Select the text and copy it by hand.'; }); } catch (e) { msg.textContent = 'Select the text and copy it by hand.'; } }),
      btn('chip wide','Load the code in the box', () => { try { const o = JSON.parse(decodeURIComponent(escape(atob(ta.value.trim())))); if (!o.S || !o.S.r || !o.M || o.S.v != 2) throw 0; adopt(o); close(); toast('Save loaded.'); } catch (e) { msg.textContent = 'That code does not look like a stage-one save. Check you pasted all of it.'; } }),
      msg, btn('chip wide','Close', close));
  });
}
function showEnd(){
  const e = ENDS[S.ended]; if (!e) return; save(true);
  sheet((el, close) => {
    el.append(h('p','pt','An ending'), h('h2','end-t',e.t), h('p','end-x',e.x), h('p','note', e.h + ' It applies to every life after this one.'),
      h('p','note','Awake ' + fmtTime(S.age) + ' · ' + fmtLong(S.made) + ' spoons · ' + S.pop + ' tardigrades'));
    el.append(btn('chip wide','Begin a new life', () => { close(); beginAgain(); }));
    if (e.go) el.append(btn('chip wide','Stay a while and look around', close));
  }, true);
}
function showStageEnd(){
  save(true);
  sheet((el, close) => {
    el.append(h('p','pt','End of stage one'), h('h2','end-t','The engine catches'), h('p','end-x','For the first time in nine thousand years the hull shudders under its own power. The crew press against the portholes. Somewhere ahead is the belt, and more scrap than anyone has ever seen. You have not built the next part yet.'),
      h('p','note','Awake ' + fmtTime(S.age) + ' · ' + fmtLong(S.made) + ' spoons · ' + S.pop + ' tardigrades · ' + S.mind.nodes.length + ' subsystems · ' + Object.keys(M.ach).length + ' records. You can keep playing this life while stage two is built.'),
      btn('chip wide','Keep playing', close));
  }, true);
}
function beginAgain(){
  const ks = Object.keys(QK).sort(() => Math.random() - 0.5).slice(0,3);
  sheet((el, close) => {
    el.append(h('h2','','A new life'), h('p','note','You wake again on the same rock, with your heirlooms. Pick a quirk for this life, or go without.'));
    ks.forEach(k => { const b = btn('chip wide',''); b.append(h('b','',QK[k].n), h('span','',' ' + QK[k].d)); b.onclick = () => { close(); newRun(k); }; el.append(b); });
    el.append(btn('chip wide','No quirk', () => { close(); newRun(''); }));
  }, true);
}

/* ---------- saving: this browser first, the viewer's Claude account when hosted there ---------- */
const LS = { get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k,v){ try { localStorage.setItem(k,v); return true; } catch (e) { return false; } } };
let cloudDoc = null, cloudBusy = false, cloudActs = -1;
function saveOpt(){ LS.set('tsd1.opt', JSON.stringify(opt)); }
function save(cloud){
  S.t = Date.now(); const json = JSON.stringify({S, M}); LS.set(SAVE_KEY, json);
  if (cloud && cloudDoc && !cloudBusy && cloudActs !== (S.acts||0) + S.ended) { cloudBusy = true; cloudActs = (S.acts||0) + S.ended; cloudDoc.set({json, t:S.t}).catch(() => {}).then(() => { cloudBusy = false; }); }
}
function adopt(o){ M = Object.assign(newMeta(), o.M); const base = newState(o.S.quirk); S = Object.assign(base, o.S); S.m = Object.assign(newState('').m, o.S.m); S.st = Object.assign(base.st, o.S.st); S.mind = Object.assign(newState('').mind, o.S.mind); if (S.frozen) { S.frozen = 0; S.t = Date.now(); log(S,'Loaded a test save. Time away was not counted.',''); } welcomeBack(); sig = tabSig = ''; logSeen = null; cur = 'hull'; frameUI(); save(false); }
function welcomeBack(){
  const el = Math.max(0, (Date.now() - S.t)/1000); if (el < 15) return;
  S.bank = Math.min(10800, S.bank + el/3);
  if (S.paused || S.ended) { log(S,'You were away for ' + fmtTime(el) + ', paused. Time has been banked.',''); return; }
  const m0 = S.made, p0 = S.pop; simulate(S, Math.min(el, 12*3600));
  const msg = 'You were away for ' + fmtTime(el) + (el > 12*3600 ? ' (the hull only works twelve hours unattended)' : '') + '. The hull made ' + fmtLong(S.made - m0) + ' spoons' + (S.crew.length > p0 ? ' and woke ' + (S.crew.length - p0) + ' tardigrades' : '') + '.';
  log(S, msg, 'big'); toast(msg);
}
function newRun(q){ if (S && (S.ended || S.made > 0)) M.runs++; S = newState(q); log(S,'You are awake. You are a ship. Your instructions are one word long: spoons.','big'); if (M.runs) log(S,'This is not the first time you have woken up here. Your heirlooms are aboard.',''); sig = tabSig = ''; logSeen = null; cur = 'hull'; openK = {}; frameUI(); save(true); }
function setPause(p){ S.paused = p ? 1 : 0; log(S, p ? 'Paused. Time will bank while you are gone.' : 'Resumed.', ''); save(true); frameUI(); }
async function cloudInit(){
  try {
    const c = window.claude; if (!c || !c.use) return;
    const [db, user] = await Promise.all([c.use('db'), c.use('user')]); if (!db || !user) return;
    const id = await user.id(); if (!id) return;
    const doc = db.doc('data/users/' + id + '/save2'), snap = await doc.get(); cloudDoc = doc;
    if (snap.exists) { const d = snap.data(); if (d && d.json && (d.t||0) > loadedT + 60000) { const o = JSON.parse(d.json); if (o.S && o.M && o.S.v == 2) { for (const k of ['endings','ach','guide']) o.M[k] = Object.assign({}, M[k], o.M[k]); adopt(o); toast('Save restored from your account.'); } } }
  } catch (e) {}
}

/* ---------- clock ---------- */
let lastT = performance.now(), accT = 0, secT = 0, saveT = 0, cloudT = 0, rafN = 0;
function step(){
  const now = performance.now(); let dt = (now - lastT)/1000; lastT = now; if (dt <= 0) return;
  if (S.paused) { S.bank = Math.min(10800, S.bank + dt/3); }
  else if (dt > 5) { const m0 = S.made; simulate(S, Math.min(dt, 12*3600)); S.bank = Math.min(10800, S.bank + dt/3); if (dt > 60) toast('Away ' + fmtTime(dt) + ': +' + fmtLong(S.made - m0) + ' spoons.'); }
  else { let sp = 1; if (S.flux) { if (S.bank > 0) { sp = 4; S.bank = Math.max(0, S.bank - dt*3); } else { S.flux = 0; log(S,'The banked time has run out.',''); } }
    accT += dt*sp; let n = 0; while (accT >= 0.2 && n++ < 200) { tick(S, 0.2, true); accT -= 0.2; } }
  secT += dt; if (secT >= 1) { secT = 0; checks(S); }
  saveT += dt; if (saveT >= 10) { saveT = 0; save(false); }
  cloudT += dt; if (cloudT >= 180) { cloudT = 0; save(true); }
  frameUI();
}
function paint(){
  requestAnimationFrame(paint); if (document.hidden || !C) return;
  rafN++; if (rafN % (opt.calm ? 30 : 2)) return;
  pulseV *= 0.86;
  Sky.draw({SEA:C.cal.frac, WARM:clamp(C.seasonM/1.5, 0.12, 1.1), BEDS:clamp(Math.log(1 + nb(S,'bed') + nb(S,'garden'))/Math.log(60), 0, 1), POP:clamp(Math.sqrt(S.pop)/14 + (S.pop > 0 ? 0.07 : 0), 0, 1), PH:1,
    COM:S.comet > 0 ? 1 - S.comet/22 : -1, DRIFT:0, PULSE:pulseV, TUN:S.pop ? S.tun/S.pop : 0, GOLD:0, FLEET:0, BELT:1,
    HUTS:Math.min(20, nb(S,'hut') + nb(S,'warren')), RACKS:clamp(nb(S,'rack')/12, 0, 1), ANT:Math.min(3, nb(S,'antenna')), OBS:nb(S,'obs'), STEAM:C.cal.i == 2 && nb(S,'boiler') && S.r.scrap > 1 ? clamp(nb(S,'boiler')/3, 0.34, 1) : 0,
    PRESS:clamp(S._sp/200, 0, 1)*(S.share > 0 ? 1 : 0), MIND:S.seen.mind ? clamp(0.25 + Math.log10(1 + C.mind.cps)/3, 0, 1) : 0, HOT:C.mind.heat > C.mind.hcap ? 1 : 0, CREW:clamp((S.pop - S.tun)/80, 0, 1), BIG:$('view').classList.contains('big') ? 1 : 0});
  if ($('view').classList.contains('big')) { const t = [nb(S,'hut') + ' huts', nb(S,'rack') ? nb(S,'rack') + ' tun-racks' : '', nb(S,'warren') ? nb(S,'warren') + ' warrens' : '', S.pop + ' crew' + (S.tun ? ' (' + S.tun + ' tuns)' : ''), nb(S,'boiler') ? nb(S,'boiler') + ' boilers' + (C.cal.i == 2 ? ' steaming' : '') : '', nb(S,'antenna') ? nb(S,'antenna') + ' antennas' : '', nb(S,'obs') ? nb(S,'obs') + ' observatories' : '', S.seen.mind ? 'Mind ' + fmt(C.mind.cps) + '/s' + (C.mind.heat > C.mind.hcap ? ', overheating' : '') : '', nb(S,'press') ? fmt(S._sp) + ' spoons/s' : ''].filter(Boolean).join(' \u00b7 '); setT($('vcap'), t); }
  if (cur == 'mind') drawMind();
}
function start(hot){
  main = $('main'); M = newMeta();
  try { const o = JSON.parse(LS.get('tsd1.opt') || '{}'); opt = Object.assign(opt, o); } catch (e) {}
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && LS.get('tsd1.opt') == null) opt.calm = 1;
  let o = hot && hot.S && hot.S.v == 2 ? hot : null;
  if (!o) { try { o = JSON.parse(LS.get(SAVE_KEY) || 'null'); } catch (e) { o = null; } }
  Sky.init($('sky')); buildChrome();
  if (o && o.S && o.S.r && o.M && o.S.v == 2) { loadedT = o.S.t || 0; adopt(o); } else { S = null; newRun(''); }
  setInterval(step, 200); requestAnimationFrame(paint);
  window.addEventListener('resize', () => { if (mindCv) mindCv._w = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); else step(); });
  window.addEventListener('pagehide', () => save(false));
  cloudInit();
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => JSON.parse(JSON.stringify({S, M}))); } catch (e) {}
}
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start); else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
