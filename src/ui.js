/* ===== interface ===== */
const $ = id => document.getElementById(id);
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const btn = (cls, txt, fn) => { const b = h('button', cls, txt); b.type = 'button'; if (fn) b.onclick = fn; return b; };
let S, C, cur = 'hull', ups = [], fixed = [], sig = '', tabSig = '', buyQ = 1, openK = {}, showDone = false, pulseV = 0, needEnd = false, logSeen = null;
let opt = {sound:0, calm:0}, main, loadedT = 0;
const U = fn => { ups.push(fn); fn(); };
const setT = (el, t) => { if (el._t !== t) { el._t = t; el.textContent = t; } };
const setD = (el, k, v) => { if (el.dataset[k] !== v) el.dataset[k] = v; };
const fmt3 = x => { if (!isFinite(x)) return '\u221e'; if (x < 0) return '\u2212' + fmt3(-x); if (x < 1000) return x >= 100 || x % 1 === 0 ? String(Math.floor(x)) : x >= 10 ? x.toFixed(1) : x.toFixed(2); const e = Math.min(8, Math.floor(Math.log10(x)/3)), v = x/Math.pow(1000,e); return (v >= 1000 ? v.toExponential(1) : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + UNITS[e]; };
const qn = () => buyQ == 'max' ? 500 : buyQ;
const act = fn => () => { if (S.paused) { toast('Paused. Tap Resume to carry on.'); return; } fn(); S.acts = (S.acts||0) + 1; checks(S); frameUI(); };

function costState(c){ let st = ''; for (const r in c) if (S.r[r] < c[r] - 1e-9) { if (c[r] > capOf(S,C,r)) return 'cap'; st = 'no'; } return st; }
function costEl(fn){
  const box = h('div','costs'), rows = {};
  U(() => { const c = fn(); for (const r in c) { let row = rows[r]; if (!row) { row = rows[r] = h('div','cost'); row.append(h('span','cn',r), h('span','cv')); box.append(row); }
    setT(row.lastChild, fmt(Math.min(S.r[r], c[r])) + ' / ' + fmt(c[r])); setD(row, 's', S.r[r] >= c[r] - 1e-9 ? 'ok' : c[r] > capOf(S,C,r) ? 'cap' : 'no'); } });
  return box;
}
function item(key, o){
  const w = h('div','item'), a = btn('act'), m = btn('more','›'), d = h('div','detail');
  m.setAttribute('aria-label','Details'); a.onclick = act(() => { o.act(); w.classList.remove('hit'); void w.offsetWidth; w.classList.add('hit'); });
  const sync = () => { d.hidden = !openK[key]; m.classList.toggle('on', !!openK[key]); m.setAttribute('aria-expanded', !!openK[key]); };
  m.onclick = () => { openK[key] = !openK[key]; sync(); }; sync();
  if (o.desc) d.append(h('p','', o.desc)); if (o.eff) d.append(h('p','eff', o.eff)); if (o.cost) d.append(costEl(o.cost)); if (o.more) o.more(d);
  w.append(a, m, d);
  U(() => { setT(a, o.title()); setD(w, 's', o.state ? o.state() : o.cost ? costState(o.cost()) : ''); });
  return w;
}
const head = (el, t) => el.append(h('h2','', t));
const note = (el, fn) => { const p = h('p','note'); U(() => setT(p, fn())); el.append(p); return p; };
function meter(el, fn, cls){ const m = h('div','meter ' + (cls||'')), f = h('i'); m.append(f); U(() => { const v = clamp(fn(),0,1); const w = (v*100).toFixed(1) + '%'; if (f._w !== w) { f._w = w; f.style.width = w; } }); el.append(m); return m; }
function seg(el, label, opts, get, set){ const row = h('div','ctl'); row.append(h('span','ctl-l',label)); const g = h('div','seg'); opts.forEach(([v,t]) => { const b = btn('', t, () => { set(v); frameUI(); }); U(() => b.classList.toggle('on', get() === v)); g.append(b); }); row.append(g); el.append(row); }
const buyMode = el => seg(el, 'Each tap buys', [[1,'1'],[10,'10'],['max','max']], () => buyQ, v => { buyQ = v; });

/* ---------- tabs ---------- */
const TABS = [
 {id:'hull',n:'Hull',show:()=>1,badge:()=>0},
 {id:'crew',n:'Crew',show:()=>S.seen.crew,badge:()=>S.pet>=0},
 {id:'sci',n:'Science',show:()=>nb(S,'library')>=1,badge:()=>prjOpen(S,'sci').some(p=>canPay(S,p.c))},
 {id:'mind',n:'Mind',show:()=>S.seen.mind,badge:()=>S.mp>0||prjOpen(S,'mind').some(p=>canPay(S,p.c))},
 {id:'trade',n:'Trade',show:()=>nb(S,'antenna')>=1,badge:()=>S.pedlar>0},
 {id:'ladles',n:'Ladles',show:()=>S.phase>=3,badge:()=>C.free>0},
 {id:'time',n:'Time',show:()=>S.done.chronology,badge:()=>0},
 {id:'margin',n:'Margin',show:()=>S.done.manual,badge:()=>0},
 {id:'rec',n:'Records',show:()=>S.made>=1||M.runs>0,badge:()=>0}];
const R = {}, SIG = {};

SIG.hull = () => [S.fin, S.ended, S.pop < 6, S.seen.pb, S.seen.lb, S.phase, Object.keys(BLD).filter(k => BLD[k].req(S)).join(), nb(S,'press')>0, nb(S,'foundry')>0, Object.values(S.b).some(v => v >= 5)].join('|');
R.hull = el => {
  if (S.ended && !ENDS[S.ended].go) { el.append(h('p','lede','This life is over: ' + ENDS[S.ended].t + '. The hull is quiet.'), btn('last','Begin a new life', beginAgain)); return; }
  if (S.fin) { el.append(h('p','lede','The Deficit reads zero, less one. The foundries have stopped. Every ladle has come home and been melted. There is one rivet left, and it is yours.'), btn('last','Stamp the last spoon', act(() => stamp(S)))); return; }
  const hands = h('div','hands');
  const mk = (t, sub, fn, cls) => { const b = btn('hand ' + (cls||'')), s = h('span','hs'); b.append(h('span','ht',t), s); b.onclick = act(fn); U(() => setT(s, sub())); hands.append(b); };
  mk('Stamp a spoon', () => { const n = handMult(S), y = n*C.yield; return fmt(n) + ' scrap → ' + fmt(y) + (y == 1 ? ' spoon' : ' spoons'); }, () => stamp(S), 'prime');
  if (S.seen.pb) mk('Pry scrap', () => '+' + fmt(Math.max(handMult(S), C.scrapIn*2)) + ' scrap', () => pry(S));
  if (S.seen.lb) mk('Scrape lichen', () => '+' + fmt(Math.max(handMult(S), C.lichenIn*2)) + ' lichen', () => scrape(S));
  el.append(hands);
  if (!S.seen.pb) el.append(h('p','lede','You are awake. You are a ship. There are ten pieces of scrap on your tray, and your instructions are one word long.'));
  else if (S.pop < 6 && S.phase == 1) note(el, () => !S.seen.lb ? 'Keep stamping. Pry more scrap when the tray runs low.' : !nb(S,'bed') ? 'Next: scrape 10 lichen and plant a lichen bed.' : !nb(S,'hut') ? 'Next: pry 8 scrap and build a moss hut. Something may move in.' : !S.pop ? 'Keep some lichen in store. Somebody is stirring.' : !S.jobs.scav ? 'Next: open Crew and ask a tardigrade to scavenge, so the scrap comes to you.' : !nb(S,'press') ? 'Next: save 20 spoons for a stamping press.' : !nb(S,'library') ? 'Next: with two tardigrades aboard, 25 scrap builds a Reading nook.' : 'More huts, more crew. Mind the cold season.');
  if (nb(S,'press') || nb(S,'foundry')) {
    const row = h('div','ctl'), b = btn('chip','', act(() => cycleShare(S))), st = h('span','ctl-s');
    row.append(h('span','ctl-l', S.phase >= 2 ? 'Presses and foundries take' : 'Presses take'), b, st);
    U(() => { setT(b, S.share >= 1 ? 'all the scrap' : S.share > 0 ? 'half the incoming scrap' : 'nothing (switched off)'); setT(st, C.demand > 0 && S.share > 0 ? 'running at ' + Math.round(100*Math.min(1, S._used/C.demand)) + '%' : ''); });
    el.append(row);
  }
  if (Object.values(S.b).some(v => v >= 5)) buyMode(el);
  let sec = 0;
  for (const id in BLD) { const d = BLD[id]; if (!d.req(S)) continue;
    if (d.sec && !sec) { sec = 1; head(el, 'The belt'); note(el, () => S.belt > 0 ? 'Belt remaining: ' + (100*S.belt/2e11).toFixed(1) + '%' : 'The belt is spent. Drones are scraping dust at a twentieth of their old haul.'); }
    el.append(item('b_'+id, {title:() => d.n + ' (' + nb(S,id) + ')', act:() => buy(S,id,qn()), cost:() => bcost(S,id,1), desc:d.d, eff:'Each: ' + d.e + '.'})); }
};

SIG.crew = () => [S.pet, S.done.philosophy, Object.keys(JOBS).filter(k => JOBS[k].req(S)).join(), Math.min(40,S.crew.length), S.leader, S.pop >= 10].join('|');
R.crew = el => {
  note(el, () => S.pop + ' of ' + C.capPop + ' berths filled' + (S.tun ? ' · ' + S.tun + ' curled up as tuns, waiting for lichen' : S.pop < C.capPop ? ' · more are waking' : ' · build huts to wake more')).className = 'lede';
  if (S.done.philosophy) {
    note(el, () => 'Accord ' + Math.round(S.accord) + '%' + (Math.abs(C.accT - S.accord) > 1 ? (C.accT > S.accord ? ', rising to ' : ', falling to ') + Math.round(C.accT) + '%' : '') + ' · the crew work at ' + Math.round(C.am*100) + '%');
    meter(el, () => S.accord/100, 'acc');
  }
  if (S.pet >= 0) { const p = PET[S.pet], card = h('div','card'); card.append(h('p','pt','Petition'), h('p','', p.t)); const row = h('div','row'); row.append(btn('chip', p.a[0], act(() => petition(S,0))), btn('chip', p.b[0], act(() => petition(S,1)))); card.append(row); el.append(card); }
  if (S.done.philosophy) el.append(item('fest', {title:() => S.fest > 0 ? 'Brew-up in full swing (' + fmtTime(S.fest) + ')' : 'Hold a Brew-up', act:() => festival(S), cost:() => festCost(S), state:() => S.fest > 0 ? 'no' : costState(festCost(S)), desc:'Warm water with lichen in it. Accord +10 and newcomers wake twice as fast while it lasts.'}));
  head(el, 'Trades');
  if (S.pop >= 10) buyMode(el);
  for (const j in JOBS) { const d = JOBS[j]; if (!d.req(S)) continue;
    const w = h('div','job'), nm = h('div','jn'), left = h('div','jl'); left.append(nm, h('div','jd', d.d)); w.append(left);
    if (j != 'grazer') w.append(btn('pm','−', act(() => setJob(S,j,-(buyQ=='max'?1e9:buyQ)))), btn('pm','+', act(() => setJob(S,j,buyQ=='max'?1e9:buyQ))));
    U(() => setT(nm, d.n + ' (' + S.jobs[j] + ')')); el.append(w); }
  if (S.crew.length) { const det = h('details','census'); det.open = !!openK.census; det.ontoggle = () => { openK.census = det.open; };
    det.append(h('summary','', 'Census' + (S.pop > S.crew.length ? ' (the first ' + S.crew.length + ')' : '')), h('p','note','Tap a tardigrade to make it Spoonbearer. Its trade works 15% harder.'));
    const list = h('div','names'); S.crew.forEach((t,i) => { const b = btn('nm' + (S.leader == i ? ' on' : ''), '', act(() => setLeader(S,i))); b.append(h('b','',t.n), h('span','', (S.leader == i ? 'Spoonbearer · ' : '') + 'born ' + JOBS[t.tr].n.toLowerCase())); list.append(b); });
    det.append(list); el.append(det); }
};

const prjItem = p => item('p_'+p.id, {title:() => p.n, act:() => research(S,p.id), cost:() => p.c, desc:p.d});
SIG.sci = () => prjOpen(S,'sci').map(p => p.id).join() + showDone;
R.sci = el => {
  const o = prjOpen(S,'sci'); if (!o.length) el.append(h('p','lede','The scholars are out of questions for now. New ones turn up as the hull changes.'));
  o.forEach(p => el.append(prjItem(p)));
  el.append(btn('link', showDone ? 'Hide researched' : 'Show researched', () => { showDone = !showDone; frameUI(); }));
  if (showDone) PRJ.filter(p => p.tab == 'sci' && S.done[p.id]).forEach(p => { const d = h('div','done'); d.append(h('b','',p.n + ' (complete)'), h('span','',p.d)); el.append(d); });
};

SIG.mind = () => [prjOpen(S,'mind').map(p => p.id).join(), S.cand ? S.cand.map(c => c.n).join() : '', S.done.naming, S.fleet.length, S.fleet[0], S.done.smallprint, S.proc + S.mem > 2].join('|');
R.mind = el => {
  note(el, () => 'Mandate ' + S.mand + (S.mp ? ' · ' + S.mp + ' unspent' : '') + ' · next at ' + fmt(thr(S)) + ' spoons made').className = 'lede';
  meter(el, () => { const lo = S.mand ? thr(S)/1.8 : 0; return (S.made - lo)/(thr(S) - lo); });
  const row = h('div','two');
  row.append(item('proc', {title:() => 'Processor (' + S.proc + ')', act:() => alloc(S,'proc'), state:() => S.mp > 0 ? '' : 'no', desc:'Costs 1 Mandate. Thinks faster: +' + fmt(4*S.m.cyc) + ' cycles/s. A full mind leaks whimsy.'}),
             item('mem', {title:() => 'Memory (' + S.mem + ')', act:() => alloc(S,'mem'), state:() => S.mp > 0 ? '' : 'no', desc:'Costs 1 Mandate. Holds ' + fmt(1000*S.m.mem) + ' more cycles, for bigger projects.'}));
  el.append(row);
  if (S.proc + S.mem > 2) el.append(btn('link','Take back all Mandate and start again (empties your cycles)', act(() => reshuffle(S))));
  head(el, 'Projects');
  const o = prjOpen(S,'mind'); if (!o.length) el.append(h('p','note','Nothing on the desk. Keep making spoons.'));
  o.forEach(p => el.append(prjItem(p)));
  if (S.done.naming) { head(el, 'Naming committee');
    if (S.cand) { el.append(h('p','note','Three proposals. The crew have a favourite kind, and will not tell you which.')); S.cand.forEach((nm,i) => el.append(btn('namecand', nm.n, act(() => nameChoose(S,i))))); }
    else el.append(item('names', {title:() => 'Convene the committee', act:() => nameSession(S), cost:() => ({cycles:500}), desc:'Pick a name. Whimsy if the crew like it; a little even if they do not.'}));
    if (S.fleet.length) { el.append(h('p','note','Register of names')); const ul = h('ul','fleet'); S.fleet.forEach(n => ul.append(h('li','',n))); el.append(ul); } }
};

const PARTNERS = {choir:['The Gravel Choir','Eat cutlery, pay in rubble. Hungriest at Aphelion.','scrap',1], bloom:['The Slow Bloom','A ship that grew. Sheds lichen, and now and then a spore.','lichen',2], quorate:['The Quorate','Sell footnotes to texts they will not show you.','notions',3]};
SIG.trade = () => [nb(S,'antenna'), S.pedlar > 0, M.guide.m3].join('|');
R.trade = el => {
  note(el, () => 'Hails ready: ' + Math.floor(S.hails) + ' of ' + C.capHails + ' · each trade costs ' + fmt(tradeCost(S)) + ' spoons').className = 'lede';
  for (const id in PARTNERS) { const p = PARTNERS[id];
    if (nb(S,'antenna') >= p[3]) el.append(item('t_'+id, {title:() => 'Hail ' + p[0], act:() => trade(S,id), state:() => S.hails >= 1 && S.r.spoons >= tradeCost(S) ? '' : 'no', cost:() => ({spoons:tradeCost(S)}), desc:p[1], eff:'You get ' + p[2] + '.'}));
    else el.append(h('p','note','A fainter signal needs ' + p[3] + ' antennas.')); }
  if (S.pedlar > 0) { head(el, 'Odd Tuesday is alongside'); note(el, () => 'Leaving in ' + fmtTime(S.pedlar) + '.');
    if (!M.guide.m3) el.append(item('ped_a', {title:() => 'Buy an antique spoon', act:() => pedlarBuy(S,'antique'), cost:() => ({spoons:1000}), desc:'“Very old. Older than it should be. No refunds, past or future.”'}));
    el.append(item('ped_p', {title:() => 'Buy a loose page', act:() => pedlarBuy(S,'page'), cost:() => ({whimsy:20}), desc:'A page torn from somebody’s Margin. Possibly yours.'})); }
};

const STATS = {rep:['Replication','Ladles that build ladles. Sets how fast the fleet doubles.'], stamp:['Stamping','Spoons per ladle. At zero, a ladle makes nothing at all.'], reach:['Reach','How far they roam. More matter, more spoons each.'], shield:['Shielding','Fewer ladles lost to rocks, stars and boredom.'], edge:['Edge','Ladles convert less easily and can retire Forks.'], manners:['Manners','Fewer ladles drift. Needs Etiquette.']};
SIG.ladles = () => [S.done.etiquette, S.fin].join('|');
R.ladles = el => {
  note(el, () => 'Deficit remaining: ' + fmtLong(Math.max(0, DEFICIT - S.made)) + ' spoons').className = 'lede';
  meter(el, () => Math.log10(Math.max(1,S.made))/Math.log10(DEFICIT));
  note(el, () => 'Ladles ' + fmt(Math.floor(S.ladles)) + ' · Forks ' + fmt(Math.floor(S.forks)) + ' · each ladle stamps ' + fmt(C.perLadle) + '/s');
  note(el, () => { const d = S.design, g = 0.0015*d.rep - 0.0012/(1+d.shield); return S.ladles < 1 ? 'No ladles flying. Set a design, then launch.' : g > 0 ? 'The fleet doubles about every ' + fmtTime(Math.log(2)/g) + ', before Forks.' : 'The fleet is shrinking. Add Replication or Shielding.'; });
  const dn = note(el, () => 'Drift: ' + (C.drift*100).toFixed(1) + '% of the fleet are Forks'); meter(el, () => C.drift, 'drift'); U(() => dn.classList.toggle('warn', C.drift > 0.15));
  buyMode(el);
  el.append(item('launch', {title:() => 'Launch a ladle', act:() => launch(S, qn()), cost:() => ({spoons:1e8}), desc:'One is enough to start. They make more of themselves.'}));
  head(el, 'Design'); note(el, () => C.free + ' of ' + (8 + S.lat) + ' points free. Redesign whenever you like; the fleet obeys at once.');
  for (const k in STATS) { const w = h('div','job'), nm = h('div','jn'), left = h('div','jl'); left.append(nm, h('div','jd', STATS[k][1])); w.append(left, btn('pm','−', act(() => redesign(S,k,-1))), btn('pm','+', act(() => redesign(S,k,1))));
    U(() => { setT(nm, STATS[k][0] + ' ' + S.design[k] + (k == 'edge' && S.heir.forks ? ' (+1)' : '')); w.classList.toggle('dim', k == 'manners' && !S.done.etiquette); }); el.append(w); }
  el.append(item('lat', {title:() => S.lat >= 20 ? 'Latitude (as wide as it goes)' : 'Argue for more latitude (' + S.lat + ')', act:() => latitude(S), cost:() => latCost(S), state:() => S.lat >= 20 ? 'no' : costState(latCost(S)), desc:'One more design point. The Bureau is persuaded by whimsy, which says a lot about the Bureau.'}));
};

SIG.time = () => margCount() + '|' + S.flux;
R.time = el => {
  note(el, () => 'Year ' + C.cal.year + ', ' + SEASONS[C.cal.i].n + ', day ' + C.cal.day + ' · this hull has been awake for ' + fmtTime(S.age)).className = 'lede';
  note(el, () => 'Next: ' + SEASONS[(C.cal.i+1)%4].n + ' in ' + fmtTime(seasonLen(S) - S.age % seasonLen(S)) + (S.weather > 0 ? ' · a flare is feeding the lichen' : S.weather < 0 ? ' · dust is dimming the light' : ''));
  head(el, 'Banked time');
  note(el, () => fmtTime(S.bank) + ' banked (three hours at most). Time banks while you are paused or away, a second for every three.');
  el.append(item('flux', {title:() => S.flux ? 'Stop spending banked time' : 'Spend banked time (hull runs ×4)', act:() => { S.flux = S.flux ? 0 : 1; }, state:() => S.bank > 1 || S.flux ? '' : 'no', desc:'While this is on, everything aboard runs four times as fast until the bank is empty.'}));
  head(el, 'Anomalies');
  el.append(h('p','note','The scholars keep a list of things that are in the wrong order. ' + margCount() + ' of 7 found.' + (M.runs ? '' : ' Some of these will take more than one life to find.')));
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
  note(el, () => 'Life ' + (M.runs + 1) + ' · awake ' + fmtTime(S.age) + ' · ' + fmtLong(S.made) + ' spoons made · ' + fmt(S.hand) + ' scrap stamped by hand').className = 'lede';
  if (S.quirk) el.append(h('p','note','This life’s quirk: ' + QK[S.quirk].n + '. ' + QK[S.quirk].d));
  head(el, 'Endings (' + Object.keys(M.endings).length + ' of 5)');
  for (const k in ENDS) { const got = M.endings[k], d = h('div','done' + (got ? '' : ' dim')); d.append(h('b','', got ? ENDS[k].t : 'Not yet reached'), h('span','', got ? ENDS[k].h : ACH['end_'+k][1])); el.append(d); }
  head(el, 'Records (' + Object.keys(M.ach).length + ' of ' + Object.keys(ACH).length + ')');
  for (const k in ACH) { if (k.startsWith('end_')) continue; const got = M.ach[k], d = h('div','done' + (got ? '' : ' dim')); d.append(h('b','', got ? ACH[k][0] : '? ? ?'), h('span','', got ? ACH[k][1] : '')); el.append(d); }
  if (S.ended) el.append(btn('chip','Begin a new life', beginAgain));
};

/* ---------- fixed chrome: header, window, resources, log ---------- */
const RES = [
 ['lichen',() => 1,() => C.lichenIn - C.eat,() => C.capLichen],
 ['scrap',() => 1,() => C.scrapIn - S._used,() => C.capScrap],
 ['spoons',() => S.made >= 1,() => S._sp,null],
 ['notions',() => nb(S,'library') >= 1,() => C.notionsIn,() => C.capNotions],
 ['cycles',() => S.seen.mind,() => C.cyclesIn,() => C.capCycles],
 ['whimsy',() => S.r.whimsy >= 0.5 || S.done.apology,() => C.whimsyIn,null]];
function buildChrome(){
  const res = $('res'); res.replaceChildren(); fixed = [];
  RES.forEach(([r, show, rate, cap]) => { const w = h('div','r r-' + r), top = h('div','rn'), v = h('div','rv'), rt = h('span','rr'), cp = h('span','rc'); top.append(h('span','',r), rt); v.append(h('span','rx'), cp); w.append(top, v); res.append(w);
    fixed.push(() => { const vis = !!show(); if (w.hidden === vis) w.hidden = !vis; if (!vis) return; const x = S.r[r], c = cap ? cap() : Infinity, d = rate();
      setT(v.firstChild, fmt3(x)); setT(cp, isFinite(c) ? '/' + fmt3(c).replace(/\.0+(?=[A-Z]|$)/, '') : ''); setT(rt, Math.abs(d) < 0.005 ? '' : (d > 0 ? '+' : '') + fmt3(d));
      setD(w, 's', isFinite(c) && x >= c*0.995 ? 'full' : x <= 0 && d < 0 ? 'bad' : ''); setD(rt, 's', d < 0 ? 'bad' : ''); }); });
  const crew = h('div','r'), ct = h('div','rn'), cv = h('div','rv'); ct.append(h('span','','crew'), h('span','rr')); cv.append(h('span','rx'), h('span','rc')); crew.append(ct, cv); res.append(crew);
  fixed.push(() => { const vis = S.pop > 0 || C.capPop > 0; if (crew.hidden === vis) crew.hidden = !vis; setT(cv.firstChild, String(S.pop)); setT(cv.lastChild, '/' + C.capPop); setT(ct.lastChild, S.tun ? S.tun + ' tun' : S.done.philosophy ? 'acc ' + Math.round(S.accord) + '%' : ''); setD(ct.lastChild, 's', S.tun ? 'bad' : ''); });
  $('ship').onclick = () => { if (S.ended) return; rename(S); checks(S); frameUI(); };
  $('pause').onclick = () => setPause(!S.paused);
  $('menu').onclick = showMenu;
  $('observe').onclick = act(() => observe(S));
  $('log').onclick = () => $('logbar').classList.toggle('tall');
  $('sky').onclick = e => { const r = $('sky').getBoundingClientRect(), x = (e.clientX - r.left)/r.width, y = (e.clientY - r.top)/r.height;
    if (S.comet > 0) return act(() => observe(S))();
    const s = Sky.sun(C.cal.frac); if (Math.hypot((x - s.x)*r.width, (y - s.y)*r.height) < 30) { S.sunTaps++; if (S.sunTaps == 3) log(S,'Please do not tap the sun.',''); if (S.sunTaps == 10) { log(S,'The sun has now been tapped ten times. It is fine. You are the one who has to live with yourself.',''); ach('sun'); } frameUI(); } };
}
function drawTabs(){
  const nav = $('tabs'); nav.replaceChildren();
  TABS.filter(t => t.show()).forEach(t => { const b = btn(t.id == cur ? 'on' : '', t.n, () => { cur = t.id; S.seen['v_'+t.id] = 1; tabSig = ''; frameUI(); main.scrollTop = 0; }); if (t.badge() || (!S.seen['v_'+t.id] && t.id != 'hull')) b.append(h('i','dot')); b.id = 'tab-' + t.id; nav.append(b); });
}
function drawTop(){
  for (const f of fixed) f();
  setT($('ship'), S.ship.n);
  const cl = C.cal, sn = SEASONS[cl.i];
  setT($('date'), S.done.calendar ? 'Year ' + cl.year + ' · ' + sn.n + (sn.w ? ' (' + sn.w + ')' : '') + ', day ' + cl.day : 'Day ' + (Math.floor(S.age/DAY) + 1) + (S.seen.aph || cl.i ? ' · ' + sn.n : ''));
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
  if (s2 != sig) { const keep = sig.split('#')[0] == cur ? main.scrollTop : 0; sig = s2; ups = []; main.replaceChildren(); R[cur](main); main.scrollTop = keep; }
  else for (const f of ups) f();
  drawTop();
  if (needEnd) { needEnd = false; showEnd(); }
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
};
function sheet(build, lock){
  const back = h('div','back'), box = h('div','sheet'); back.append(box); const close = () => back.remove();
  if (!lock) back.onclick = e => { if (e.target == back) close(); };
  build(box, close); document.body.append(back); const f = box.querySelector('button'); if (f) f.focus(); return close;
}
function showMenu(){
  sheet((el, close) => {
    el.append(h('h2','','The Teaspoon Deficit'), h('p','note','You are a derelict ship. Stamp spoons, wake the crew, see what opens up. The game saves itself and keeps working while you are away. Pause banks time instead.'));
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
      btn('chip wide','Load the code in the box', () => { try { const o = JSON.parse(decodeURIComponent(escape(atob(ta.value.trim())))); if (!o.S || !o.S.r || !o.M) throw 0; adopt(o); close(); toast('Save loaded.'); } catch (e) { msg.textContent = 'That code does not look like a save. Check you pasted all of it.'; } }),
      msg, btn('chip wide','Close', close));
  });
}
function showEnd(){
  const e = ENDS[S.ended]; if (!e) return; save(true);
  sheet((el, close) => {
    el.append(h('p','pt','An ending'), h('h2','end-t',e.t), h('p','end-x',e.x), h('p','note', e.h + ' It applies to every life after this one.'),
      h('p','note','Awake ' + fmtTime(S.age) + ' · ' + fmtLong(S.made) + ' spoons · ' + S.pop + ' tardigrades · endings found: ' + Object.keys(M.endings).length + ' of 5'));
    el.append(btn('chip wide','Begin a new life', () => { close(); beginAgain(); }));
    if (e.go) el.append(btn('chip wide','Stay a while and look around', close));
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

/* ---------- saving: this browser first, the viewer's Claude account when the page is hosted there ---------- */
const LS = { get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k,v){ try { localStorage.setItem(k,v); return true; } catch (e) { return false; } } };
let cloudDoc = null, cloudBusy = false, cloudActs = -1;
function saveOpt(){ LS.set('tsd1.opt', JSON.stringify(opt)); }
function save(cloud){
  S.t = Date.now(); const json = JSON.stringify({S, M}); LS.set('tsd1.save', json);
  if (cloud && cloudDoc && !cloudBusy && cloudActs !== (S.acts||0) + S.ended) { cloudBusy = true; cloudActs = (S.acts||0) + S.ended; cloudDoc.set({json, t:S.t}).catch(() => {}).then(() => { cloudBusy = false; }); }
}
function adopt(o){ M = Object.assign(newMeta(), o.M); S = Object.assign(newState(o.S.quirk), o.S); S.m = Object.assign(newState('').m, o.S.m); welcomeBack(); sig = tabSig = ''; logSeen = null; cur = 'hull'; frameUI(); save(false); }
function welcomeBack(){
  const el = Math.max(0, (Date.now() - S.t)/1000); if (el < 15) return;
  S.bank = Math.min(10800, S.bank + el/3);
  if (S.paused || S.ended) { log(S,'You were away for ' + fmtTime(el) + ', paused. Time has been banked.',''); return; }
  const m0 = S.made, p0 = S.pop; simulate(S, Math.min(el, 12*3600));
  const msg = 'You were away for ' + fmtTime(el) + (el > 12*3600 ? ' (the hull only works twelve hours unattended)' : '') + '. The hull made ' + fmtLong(S.made - m0) + ' spoons' + (S.pop > p0 ? ' and woke ' + (S.pop - p0) + ' tardigrades' : '') + '.';
  log(S, msg, 'big'); toast(msg);
}
function newRun(q){ if (S && (S.ended || S.made > 0)) M.runs++; S = newState(q); log(S,'You are awake. You are a ship. Your instructions are one word long: spoons.','big'); if (M.runs) log(S,'This is not the first time you have woken up here. Your heirlooms are aboard.',''); sig = tabSig = ''; logSeen = null; cur = 'hull'; openK = {}; frameUI(); save(true); }
function setPause(p){ S.paused = p ? 1 : 0; log(S, p ? 'Paused. Time will bank while you are gone.' : 'Resumed.', ''); save(true); frameUI(); }
async function cloudInit(){
  try {
    const c = window.claude; if (!c || !c.use) return;
    const [db, user] = await Promise.all([c.use('db'), c.use('user')]); if (!db || !user) return;
    const id = await user.id(); if (!id) return;
    const doc = db.doc('data/users/' + id + '/save'), snap = await doc.get(); cloudDoc = doc;
    if (snap.exists) { const d = snap.data(); if (d && d.json && (d.t||0) > loadedT + 60000) { const o = JSON.parse(d.json); if (o.S && o.M) { for (const k of ['endings','ach','guide']) o.M[k] = Object.assign({}, M[k], o.M[k]); adopt(o); toast('Save restored from your account.'); } } }
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
  Sky.draw({SEA:C.cal.frac, WARM:clamp(C.seasonM/1.5, 0.12, 1.1), BEDS:clamp(Math.log(1 + nb(S,'bed'))/Math.log(60), 0, 1), POP:clamp(Math.sqrt(S.pop)/14 + (S.pop > 0 ? 0.07 : 0), 0, 1), PH:S.phase,
    COM:S.comet > 0 ? 1 - S.comet/22 : -1, DRIFT:C.drift, PULSE:pulseV, TUN:S.pop ? S.tun/S.pop : 0, GOLD:S.ended == 'books' ? 1 : 0, FLEET:clamp(Math.log10(1 + S.ladles + S.forks)/22, 0, 1), BELT:clamp(S.belt/2e11, 0.1, 1)});
}
function start(hot){
  main = $('main'); M = newMeta();
  try { const o = JSON.parse(LS.get('tsd1.opt') || '{}'); opt = Object.assign(opt, o); } catch (e) {}
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && LS.get('tsd1.opt') == null) opt.calm = 1;
  let o = hot && hot.S ? hot : null;
  if (!o) { try { o = JSON.parse(LS.get('tsd1.save') || 'null'); } catch (e) { o = null; } }
  Sky.init($('sky')); buildChrome();
  if (o && o.S && o.S.r && o.M) { loadedT = o.S.t || 0; adopt(o); } else { S = null; newRun(''); }
  setInterval(step, 200); requestAnimationFrame(paint);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); else step(); });
  window.addEventListener('pagehide', () => save(false));
  cloudInit();
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => JSON.parse(JSON.stringify({S, M}))); } catch (e) {}
}
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start); else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
