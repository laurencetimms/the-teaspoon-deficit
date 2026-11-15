'use strict';
/* ===== THE TEASPOON DEFICIT: game rules (no DOM in this file) ===== */
const DEFICIT = 7.3e27, DAY = 2, SEASON_LEN = 200;
const SEASONS = [{n:'Perihelion',m:1.5,w:'warm'},{n:'Outswing',m:1,w:''},{n:'Aphelion',m:0.25,w:'cold'},{n:'Inswing',m:1,w:''}];
const rnd = (a,b) => a + Math.random()*(b-a), pick = a => a[Math.floor(Math.random()*a.length)];
const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
let M = null;            // meta: survives across runs
let hook = () => {};     // ui feedback: hook('buy'|'fail'|'unlock'|'stamp'|'end')

const NAMEP = [
 [['Technically','Arguably','Broadly','Provisionally','Mostly','Nominally','Reasonably Sure This Is'],['Within Tolerance','Fine','On Schedule','A Ship','Load-Bearing','Accounted For','Somebody Else’s Job']],
 [['The Unanswerable','Thunderous','Last Great','Inevitable','Sovereign','Incandescent','Magnificent And Final'],['Teaspoon','Rounding Error','Inventory','Afterthought','Paperweight','Drawer','Clerical Oversight']],
 [['Sorry About','Please Ignore','Regrettably,','Do Excuse','Awfully Sorry For','We Meant To Mention','Nobody Warned Us About'],['The Noise','The Hull','Last Tuesday','The Smell Of Lichen','All The Spoons','What Happened','The Forks']]];
const shipName = tag => { const t = tag == null ? Math.floor(Math.random()*3) : tag; return {n: pick(NAMEP[t][0]) + ' ' + pick(NAMEP[t][1]), t}; };
const TN1 = ['Mossy','Pip','Dew','Lumen','Burr','Fen','Odo','Quill','Rime','Sorrel','Wick','Nub','Bram','Tansy','Ember','Plum'];
const TN2 = ['Eightlegs','Slowstep','Dampfoot','Underleaf','Longnap','Softclaw','Driftwater','Hullwarm','Crumb','Thimble'];
const JOBS = {
 grazer: {n:'Grazer', d:'Tends lichen. Everyone without another trade grazes. One grazer feeds two or three in fair weather, far fewer in the cold.', req:S=>1},
 scav:   {n:'Scavenger', d:'Pries scrap from the hull for huts and presses.', req:S=>1},
 scholar:{n:'Scholar', d:'Has notions. Needs a Reading nook to keep them in.', req:S=>nb(S,'library')>=1},
 tinker: {n:'Tinker', d:'Fusses over the presses. Each adds 3% to spoon yield.', req:S=>S.done.metallurgy},
 bard:   {n:'Bard', d:'Describes work instead of doing it. Raises accord, leaks whimsy.', req:S=>S.done.philosophy}};
const QK = {
 long:{n:'Long year',d:'Seasons last twice as long.',year:2},
 seam:{n:'Rich seam',d:'Scrap ×2. Lichen grows 30% slower.',scrap:2,lichen:0.7},
 chatty:{n:'Chatty mind',d:'Whimsy ×3. Cycles 30% slower.',whim:3,cyc:0.7},
 dense:{n:'Dense moss',d:'Huts hold three. Everyone eats 25% more.',berth:1,eat:1.25},
 pet:{n:'Bureau favourite',d:'Mandate arrives 40% sooner. Accord settles 10 lower.',mand:0.6,acc:-10},
 alley:{n:'Comet alley',d:'Comets come four times as often.',comet:0.25},
 heavy:{n:'Heavy dies',d:'Each tap stamps ten times as much. Presses run 30% slower.',hand:10,press:0.7},
 friends:{n:'Old friends',d:'Hails recharge twice as fast. Newcomers wake more slowly.',hail:2,arr:0.6}};

const nb = (S,id) => S.b[id] || 0;
const qk = S => QK[S.quirk] || {};
function newMeta(){ return {runs:0, endings:{}, ach:{}, guide:{}}; }
function newState(quirk){
  const hz = {}; for (const k in M.endings) hz[k] = 1;
  const S = {v:1, t:Date.now(), age:0, phase:1, ship:shipName(), renames:0, paused:0,
    r:{lichen:0, scrap:10, spoons:0, notions:0, cycles:0, whimsy:0}, made:0, hand:0,
    b:{}, share:0.5, pop:0, tun:0, tunT:0, arr:0, jobs:{grazer:0,scav:0,scholar:0,tinker:0,bard:0}, crew:[], leader:-1,
    done:{}, seen:{}, mand:0, mp:0, proc:1, mem:1, accord:60, accMod:hz.tea?5:0, fest:0, weather:0, si:0,
    hails:3, traded:{}, pedlar:0, pedT:rnd(400,700), comet:0, cometT:rnd(120,200), comets:0,
    pet:-1, petT:rnd(200,320), petLeft:0, belt:2e11, ladles:0, forks:0, launched:0,
    design:{reach:0,rep:0,stamp:0,shield:0,manners:0,edge:0}, lat:0, bank:0, flux:0,
    taste:Math.floor(Math.random()*3), cand:null, fleet:[], goodNames:0,
    m:{graze:1,bed:1,scav:1,pressSpd:1,yield:1,cap:1,ncap:1,notion:1,cyc:1,mem:1,whim:1,drone:1,foundry:1,hand:1,drift:1,edge:1},
    quirk:quirk||'', heir:hz, log:[], ended:'', fin:0, coldTun:0, sunTaps:0, _sp:0, _used:0};
  if (hz.small) { S.b.hut = 2; S.b.bed = 1; S.seen.lichen = 1; }
  if (hz.books) S.mp += 2;
  return S;
}
function log(S, msg, kind){ S.log.push({a:S.age, m:msg, k:kind||''}); if (S.log.length > 80) S.log.shift(); }
function seasonLen(S){ return SEASON_LEN * (qk(S).year || 1); }
function cal(S){ const sl = seasonLen(S); return {i:Math.floor(S.age/sl)%4, year:Math.floor(S.age/(4*sl)), day:Math.floor((S.age%sl)/DAY)+1, frac:(S.age%(4*sl))/sl}; }
const thr = S => 40 * Math.pow(1.8, S.mand) * (qk(S).mand || 1);

/* ---------- buildings ---------- */
const BLD = {
 bed:{n:'Lichen bed',d:'A scraped patch of hull where lichen takes hold. Grows with the seasons.',c:{lichen:10},k:1.12,e:'+0.25 lichen/s in fair weather',req:S=>S.seen.lichen},
 hut:{n:'Moss hut',d:'Damp, dark and exactly right. Tardigrades wake when there is somewhere to live and something to eat.',c:{scrap:8},k:1.5,e:'+2 berths',req:S=>nb(S,'bed')>=1},
 press:{n:'Stamping press',d:'Stamps spoons from scrap without being asked.',c:{spoons:20},k:1.12,e:'turns 0.5 scrap/s into spoons',req:S=>S.made>=12},
 locker:{n:'Locker',d:'Somewhere to put things, so that there can be more things.',c:{scrap:40},k:1.2,e:'+150 scrap and +1.5K lichen storage',req:S=>nb(S,'hut')>=2},
 library:{n:'Reading nook',d:'A dry corner where scholars keep their notions.',c:{scrap:25},k:1.15,e:'+250 notion storage, scholars +8%',req:S=>S.pop>=2},
 antenna:{n:'Antenna',d:'Bent from spoon handles. Lets you hail passing traffic.',c:{scrap:120,spoons:300},k:1.5,e:'+1 hail, new trading partners',req:S=>S.done.signal},
 rack:{n:'Tun-rack',d:'Bunks, eight legs deep, in the old cutlery hold.',c:{scrap:150,spoons:300},k:1.3,e:'+5 berths',req:S=>S.done.survey},
 obs:{n:'Observatory',d:'A hole with a lens in it. Catches some comets on its own.',c:{scrap:500,spoons:2000},k:1.25,e:'+1K notion storage, +0.15 notions/s',req:S=>S.done.astronomy},
 drone:{n:'Harvester drone',sec:1,d:'Goes out hungry, comes back heavy.',c:{spoons:4000},k:1.1,e:'+20 scrap/s from the belt',req:S=>S.phase>=2},
 foundry:{n:'Foundry',sec:1,d:'A press that has given up on restraint.',c:{spoons:15000},k:1.1,e:'turns 100 scrap/s into spoons',req:S=>S.phase>=2},
 ring:{n:'Ring segment',sec:1,d:'A spinning berth for twenty. The crew call it the big hut.',c:{spoons:5e5,lichen:3000},k:1.3,e:'+20 berths',req:S=>S.done.ringwright},
 archive:{n:'Archive',sec:1,d:'Every notion, indexed. The index is also indexed.',c:{spoons:1e5,notions:1500},k:1.22,e:'+5K notion storage',req:S=>S.done.archives}};
function bcost(S, id, q){ const d = BLD[id], n = nb(S,id), o = {}; const f = Math.pow(d.k,n) * (Math.pow(d.k,q)-1)/(d.k-1); for (const r in d.c) o[r] = d.c[r]*f; return o; }
const canPay = (S,c) => { for (const r in c) if (S.r[r] < c[r] - 1e-9) return false; return true; };
const pay = (S,c) => { for (const r in c) S.r[r] = Math.max(0, S.r[r] - c[r]); };
function capOf(S, c, r){ return r=='lichen'?c.capLichen : r=='scrap'?c.capScrap : r=='notions'?c.capNotions : r=='cycles'?c.capCycles : Infinity; }
function buy(S, id, q){
  if (!BLD[id].req(S)) return 0;
  let got = 0; q = q || 1;
  while (got < q && got < 500) { const c = bcost(S,id,1); if (!canPay(S,c)) break; pay(S,c); S.b[id] = nb(S,id)+1; got++; }
  hook(got ? 'buy' : 'fail'); return got;
}

/* ---------- derived numbers ---------- */
function calc(S){
  const c = {}, m = S.m, q = qk(S), hz = S.heir, pop = S.pop, awake = pop - S.tun;
  c.am = 0.6 + S.accord/150;
  const jf = pop > 0 ? awake/pop*c.am : 0, ld = S.crew[S.leader] ? S.crew[S.leader].tr : '';
  const jb = j => S.jobs[j]*jf*(ld===j?1.15:1);
  c.cal = cal(S);
  c.seasonM = Math.max(0.1, SEASONS[c.cal.i].m + S.weather);
  c.capLichen = (2000 + 1500*nb(S,'locker'))*m.cap;
  c.capScrap = S.phase >= 2 ? Infinity : (100 + 150*nb(S,'locker'))*m.cap;
  c.capNotions = (250 + 250*nb(S,'library') + 1000*nb(S,'obs') + 5000*nb(S,'archive'))*m.ncap;
  c.capCycles = 1000*S.mem*m.mem;
  c.capPop = (2 + (q.berth||0))*nb(S,'hut') + 5*nb(S,'rack') + 20*nb(S,'ring');
  c.capHails = 3 + nb(S,'antenna');
  c.lichenIn = (nb(S,'bed')*0.25*m.bed + jb('grazer')*1.0*m.graze)*c.seasonM*(q.lichen||1)*(hz.small?1.25:1);
  c.bedIn = nb(S,'bed')*0.25*m.bed*c.seasonM*(q.lichen||1)*(hz.small?1.25:1);
  c.eat = awake*0.4*(q.eat||1);
  c.beltF = S.belt > 0 ? 1 : 0.05;
  c.droneIn = nb(S,'drone')*20*m.drone*c.beltF;
  c.scrapIn = jb('scav')*0.25*m.scav*(q.scrap||1)*(hz.forks?1.25:1) + c.droneIn;
  c.demand = nb(S,'press')*0.5*m.pressSpd*(q.press||1) + nb(S,'foundry')*100*m.foundry;
  c.yield = m.yield*(1 + 0.03*jb('tinker'))*(hz.full?1.5:1);
  c.notionsIn = jb('scholar')*0.1*m.notion*(1 + 0.08*nb(S,'library'))*(hz.tea?1.25:1) + nb(S,'obs')*0.15;
  c.cyclesIn = S.seen.mind ? S.proc*4*m.cyc*(q.cyc||1) : 0;
  c.whimsyIn = (S.seen.mind && S.r.cycles >= c.capCycles - 1e-6 ? S.proc*0.012*Math.sqrt(m.cyc)*m.whim*(q.whim||1) : 0) + jb('bard')*0.02*(q.whim||1);
  const bards = pop > 0 ? S.jobs.bard/pop : 0;
  c.accT = clamp(60 + Math.min(25, 250*bards) + (S.fest>0?10:0) + clamp(S.accMod,-30,30) + (q.acc||0) - (S.tun>0?25:0), 5, 100);
  const d = S.design, pts = 8 + S.lat;
  c.free = pts - d.reach - d.rep - d.stamp - d.shield - d.manners - d.edge;
  c.edge = (d.edge + (hz.forks?1:0))*m.edge;
  c.perLadle = d.stamp*4000*Math.pow(1+d.reach,1.5)*(hz.full?1.5:1);
  c.drift = S.ladles + S.forks > 0 ? S.forks/(S.ladles+S.forks) : 0;
  return c;
}

/* ---------- the tick ---------- */
function addSpoons(S, x){
  if (x <= 0) return;
  if (S.phase >= 3 && S.made + x >= DEFICIT) { x = DEFICIT - S.made; if (!S.fin) { S.fin = 1; log(S,'The count stops. The Deficit reads zero.','big'); hook('unlock'); } }
  S.r.spoons += x; S.made += x;
  while (S.made >= thr(S)) { S.mand++; S.mp++; if (S.mand < 40 || S.mand % 5 == 0) log(S,'The Bureau notes your output. Mandate +1.','good'); }
}
function addTardi(S){
  S.pop++; S.jobs.grazer++;
  if (S.crew.length < 40) S.crew.push({n:pick(TN1)+' '+pick(TN2), tr:pick(Object.keys(JOBS))});
  if (S.pop <= 12 || S.pop % 25 == 0) log(S, S.pop==1 ? 'A tardigrade uncurls in the moss hut and starts grazing. You could ask it to do something else.' : (S.crew.length<=40&&S.pop<=40 ? S.crew[S.crew.length-1].n : 'Another tardigrade') + ' has woken up. Crew: ' + S.pop + '.');
}
function tick(S, dt, online){
  if (S.ended && S.ended != 'small' && S.ended != 'tea') return;
  const c = calc(S), r = S.r, q = qk(S);
  const si0 = c.cal.i; S.age += dt;
  /* lichen and tuns */
  r.lichen += (c.lichenIn - c.eat)*dt;
  if (r.lichen <= 0) {
    r.lichen = 0;
    if (c.lichenIn < c.eat && S.pop > 0) {
      const eatFull = S.pop*0.4*(q.eat||1), grazeFull = (c.lichenIn - c.bedIn)*(S.pop/Math.max(1,S.pop-S.tun));
      const f = eatFull > grazeFull ? clamp(c.bedIn/(eatFull-grazeFull),0,1) : 1, target = S.pop - Math.floor(f*S.pop);
      S.tunT += dt; const k = Math.floor(S.tunT/1.5);
      if (k > 0) { S.tunT = 0; if (S.tun < target) { if (!S.tun) log(S,'The lichen has run out. Tardigrades are curling up into tuns to wait.','bad'); S.tun = Math.min(target, S.tun+k); S.coldTun = 1; S.seen.tun = 1; } }
    }
  } else if (S.tun > 0 && r.lichen > S.pop) { S.tunT += dt; const k = Math.floor(S.tunT/1.5); if (k > 0) { S.tunT = 0; S.tun = Math.max(0, S.tun-k); if (!S.tun) log(S,'Everyone is awake again.','good'); } }
  if (r.lichen > c.capLichen) r.lichen = c.capLichen;
  if (r.lichen > 0) S.seen.lichen = 1;
  /* scrap, presses, foundries */
  const inc = c.scrapIn*dt;
  if (S.phase >= 2 && S.belt > 0) S.belt = Math.max(0, S.belt - c.droneIn*dt);
  let avail = S.share >= 1 ? r.scrap + inc : S.share*inc + Math.max(0, r.scrap + (1-S.share)*inc - c.capScrap);
  const used = S.share <= 0 ? 0 : Math.min(c.demand*dt, avail);
  r.scrap = clamp(r.scrap + inc - used, 0, c.capScrap);
  let sp = used*c.yield;
  /* ladles and forks */
  if (S.phase >= 3 && S.ladles > 0 && !S.fin) {
    const d = S.design, L = S.ladles, F = S.forks, acc = 1.5 - S.accord/100, man = 1 + 0.5*d.manners;
    const born = L*(Math.exp(0.0015*d.rep*dt) - 1), lost = L*(1 - Math.exp(-0.0012/(1+d.shield)*dt));
    const nf = born*0.03*acc/man*S.m.drift, mix = L/(L+F);
    const conv = Math.min(L*0.5, F*(0.006/(1+c.edge))*acc/man*S.m.drift*mix*dt), kill = Math.min(F, F*0.0015*c.edge*mix*dt);
    S.ladles = Math.max(0, L + born - lost - nf - conv); S.forks = Math.max(0, F + nf + conv - kill);
    if (S.ladles < 0.5) { S.ladles = 0; if (S.forks >= 1) log(S,'Your last ladle has grown tines. Launch more, with better manners or a sharper edge.','bad'); }
    sp += L*c.perLadle*dt;
    if (S.forks > 1000 && S.forks > 9*S.ladles) return endRun(S,'forks');
  }
  addSpoons(S, sp); S._sp = sp/dt; S._used = used/dt;
  /* thought */
  r.notions = Math.min(c.capNotions, r.notions + c.notionsIn*dt);
  r.cycles = Math.min(c.capCycles, r.cycles + c.cyclesIn*dt);
  r.whimsy += c.whimsyIn*dt;
  /* arrivals */
  if (S.pop < c.capPop && r.lichen > 0 && S.tun == 0) {
    S.arr += dt/12*(1 + c.capPop/25)*(S.fest>0?2:1)*(q.arr||1);
    while (S.arr >= 1 && S.pop < c.capPop) { S.arr--; addTardi(S); }
  } else S.arr = 0;
  /* mood, hails, timers */
  S.accord += clamp(c.accT - S.accord, -0.2*dt, 0.2*dt);
  if (S.fest > 0) S.fest = Math.max(0, S.fest - dt);
  if (S.hails < c.capHails) S.hails = Math.min(c.capHails, S.hails + dt/60*(q.hail||1));
  const si = cal(S).i;
  if (si != si0) {
    S.weather = Math.random() < 0.3 ? 0.15 : Math.random() < 0.43 ? -0.1 : 0;
    if (si0 == 2) { if (!S.coldTun && S.pop >= 5) ach('warm'); S.coldTun = 0; }
    if (si == 2) S.seen.aph = 1;
    log(S, SEASONS[si].n + ' begins' + (si==2?'. The lichen slows to a quarter. Mind the stores.':si==0?'. Warm light on the hull. The lichen races.':'.'), si==2?'bad':'');
  }
  if (online) {
    if (S.comet > 0) { S.comet -= dt; if (S.comet <= 0 && Math.random() < 0.25*nb(S,'obs')) observe(S, 1); }
    else if (S.pop >= 1 && (S.cometT -= dt) <= 0) { S.comet = 22; S.cometT = rnd(170,330)*(q.comet||1); log(S,'A comet is crossing the sky. Tap Observe.','big'); hook('unlock'); }
    if (S.done.philosophy && S.pet < 0 && (S.petT -= dt) <= 0) { S.pet = Math.floor(Math.random()*PET.length); S.petLeft = 300; log(S,'The crew have a petition for you. (Crew)','big'); hook('unlock'); }
    if (S.pet >= 0 && (S.petLeft -= dt) <= 0) { S.pet = -1; S.petT = rnd(240,420); S.accMod -= 1; log(S,'The petition went unanswered. The crew noticed.','bad'); }
    if (nb(S,'antenna') >= 1) {
      if (S.pedlar > 0) S.pedlar -= dt;
      else if ((S.pedT -= dt) <= 0 || new Date().getDay() == 2) { S.pedlar = 180; S.pedT = rnd(500,900); if (!S.seen.ped) log(S,'A small crooked ship is hailing you. It says its name is Odd Tuesday. (Trade)','big'); S.seen.ped = 1; }
    }
  }
}

/* ---------- player actions ---------- */
const handMult = S => S.m.hand*(qk(S).hand||1);
function stamp(S){
  if (S.fin) { return endRun(S,'full'); }
  if (S.r.scrap < 1) { hook('fail'); return 0; }
  const n = Math.min(S.r.scrap, handMult(S)); S.r.scrap -= n; addSpoons(S, n*calc(S).yield); S.hand += n; hook('stamp'); return 1;
}
function pry(S){ const c = calc(S); S.r.scrap = Math.min(c.capScrap, S.r.scrap + Math.max(handMult(S), c.scrapIn*2)); S.seen.pry = 1; hook('tap'); }
function scrape(S){ const c = calc(S); S.r.lichen = Math.min(c.capLichen, S.r.lichen + Math.max(handMult(S), c.lichenIn*2)); S.seen.lichen = 1; hook('tap'); }
function setJob(S, j, d){
  d = d > 0 ? Math.min(d, S.jobs.grazer) : -Math.min(-d, S.jobs[j]);
  if (!d || j == 'grazer') return hook('fail');
  S.jobs[j] += d; S.jobs.grazer -= d; hook('tap');
}
function alloc(S, k){ if (S.mp < 1) return hook('fail'); S.mp--; S[k]++; hook('buy'); }
function reshuffle(S){ if (S.proc + S.mem <= 2) return hook('fail'); S.mp += S.proc - 1 + S.mem - 1; S.proc = 1; S.mem = 1; S.r.cycles = 0; hook('tap'); }
function festival(S){ const c = {lichen:200 + 40*S.pop, spoons:100 + 20*S.pop}; if (S.fest > 0 || !canPay(S,c)) return hook('fail'); pay(S,c); S.fest = 400; S.seen.fest = 1; log(S,'A Brew-up! Warm water with lichen in it. The crew are delighted.','good'); if (cal(S).i == 2) ach('wake'); hook('buy'); }
const festCost = S => ({lichen:200 + 40*S.pop, spoons:100 + 20*S.pop});
function observe(S, auto){
  if (S.comet <= 0) return hook('fail');
  const c = calc(S), g = 20 + 0.12*c.capNotions; S.comet = 0; S.comets++; S.r.notions = Math.min(c.capNotions, S.r.notions + g); S.r.whimsy += S.seen.mind ? 1 : 0;
  log(S, (auto ? 'The observatory caught the comet' : 'You watch the comet with the scholars') + '. +' + Math.round(g) + ' notions.','good'); if (!auto) hook('buy');
  if (S.comets >= 10) ach('comets'); if (S.comets >= 5) marg('m1');
}
function tradeCost(S){ return Math.max(100, Math.round(S._sp*30)); }
function trade(S, id){
  const c = calc(S), cost = {spoons:tradeCost(S)};
  if (S.hails < 1 || !canPay(S,cost)) return hook('fail');
  pay(S,cost); S.hails--; S.traded[id] = 1; let msg;
  if (id == 'choir') { const g = S.phase >= 2 ? c.scrapIn*300 : c.capScrap*rnd(0.25,0.45)*(c.cal.i==2?1.5:1); S.r.scrap = Math.min(c.capScrap, S.r.scrap + g); msg = 'The Gravel Choir eat your spoons, humming. They leave ' + fmt(g) + ' scrap.'; }
  if (id == 'bloom') { const g = c.capLichen*rnd(0.25,0.4); S.r.lichen = Math.min(c.capLichen, S.r.lichen+g); msg = 'The Slow Bloom sheds ' + fmt(g) + ' lichen across your hull.'; if (Math.random() < 0.15) { S.b.bed = nb(S,'bed')+1; msg += ' Some of it takes root: +1 Lichen bed.'; } }
  if (id == 'quorate') { const g = c.capNotions*rnd(0.15,0.25); S.r.notions = Math.min(c.capNotions, S.r.notions+g); msg = 'The Quorate send ' + fmt(g) + ' notions’ worth of footnotes.'; }
  log(S, msg, 'good'); hook('buy');
  if (S.traded.choir && S.traded.bloom && S.traded.quorate) ach('trader');
}
function pedlarBuy(S, what){
  if (S.pedlar <= 0) return hook('fail');
  if (what == 'antique') { if (M.guide.m3 || S.r.spoons < 1000) return hook('fail'); S.r.spoons -= 1000; marg('m3'); log(S,'Odd Tuesday hands over an antique spoon. “Mind the nick,” it says.','big'); }
  else { if (S.r.whimsy < 20) return hook('fail'); S.r.whimsy -= 20; const left = GUIDE.filter(g => !M.guide[g.id] && g.id[0] != 'm' && g.id != 'loop' && g.ped); if (left.length) { M.guide[left[0].id] = 1; log(S,'A loose page for the Margin: “' + left[0].t + '”.','good'); } else { S.r.notions += 50; log(S,'The page is blank. You have notions about that.',''); } }
  ach('tuesday'); hook('buy');
}
function nameSession(S){ if (S.r.cycles < 500) return hook('fail'); S.r.cycles -= 500; S.cand = [0,1,2].sort(() => Math.random()-0.5).map(t => shipName(t)); hook('buy'); }
function nameChoose(S, i){
  const nm = S.cand[i]; if (!nm) return; const hit = nm.t == S.taste, g = (hit ? 20 : 5)*(1 + S.proc/10);
  S.r.whimsy += g; S.cand = null; S.fleet.unshift(nm.n); S.fleet.length = Math.min(S.fleet.length, 8); S.seen.named = 1;
  if (hit) { S.goodNames++; if (S.goodNames >= 10) ach('patron'); }
  log(S, '“' + nm.n + '”. ' + (hit ? 'The crew ripple with approval.' : 'The crew are polite about it.') + ' +' + Math.round(g) + ' whimsy.', hit?'good':''); hook('buy');
}
function rename(S){ S.ship = shipName(); S.renames++; if (S.renames >= 7) ach('indecisive'); hook('tap'); }
function cycleShare(S){ S.share = S.share >= 1 ? 0 : S.share > 0 ? 1 : 0.5; hook('tap'); }
function redesign(S, k, d){ const c = calc(S); if ((d > 0 && c.free < 1) || (d < 0 && S.design[k] < 1) || (k=='manners' && !S.done.etiquette)) return hook('fail'); S.design[k] += d; hook('tap'); }
const latCost = S => ({whimsy:100*Math.pow(1.2,S.lat)});
function latitude(S){ const c = latCost(S); if (S.lat >= 20 || !canPay(S,c)) return hook('fail'); pay(S,c); S.lat++; hook('buy'); }
function launch(S, q){ let n = 0; while (n < q && S.r.spoons >= 1e8) { S.r.spoons -= 1e8; S.ladles++; S.launched++; n++; } hook(n ? 'buy' : 'fail'); if (n && S.launched == n) log(S,'The first ladle clears the hull. It is already thinking about a second ladle.','big'); }
function petition(S, ch){ const p = PET[S.pet]; if (!p) return; const o = ch ? p.b : p.a; o[1](S); log(S, o[2], ''); S.pet = -1; S.petT = rnd(240,420); hook('buy'); }
function setLeader(S, i){ S.leader = S.leader == i ? -1 : i; hook('tap'); }

/* ---------- petitions ---------- */
const PET = [
 {t:'The grazers ask for one idle day each season.', a:['Grant it',S=>{S.m.graze*=0.95;S.accMod+=4;},'Granted. Grazing −5%, accord +4.'], b:['Refuse',S=>{S.accMod-=3;},'Refused. Accord −3.']},
 {t:'A scholar proposes naming the stars after soups.', a:['Approve',S=>{S.r.whimsy+=15+S.proc;},'Approved. Welcome, Greater Minestrone. Whimsy gained.'], b:['Use numbers',S=>{S.r.notions=Math.min(calc(S).capNotions,S.r.notions+calc(S).capNotions*0.2);},'Numbers it is. Notions gained.']},
 {t:'Scavengers have found a sealed room. It is ticking.', a:['Open it',S=>{if(Math.random()<0.6){const c=calc(S);S.r.scrap=Math.min(c.capScrap,S.r.scrap+(S.phase>=2?c.scrapIn*200:c.capScrap*0.5));}else{S.accMod-=2;}},'It was a clock, and behind the clock, perhaps, something useful.'], b:['Leave it',S=>{S.r.cycles=Math.min(calc(S).capCycles,S.r.cycles+calc(S).capCycles*0.3);},'You think about the room instead. Cycles gained.']},
 {t:'The crew want spoons of their own. They have no mouths to speak of.', a:['Hand out a tenth',S=>{S.r.spoons*=0.9;S.accMod+=5;},'A tenth of the drawer, given away. Accord +5.'], b:['Refuse',S=>{S.accMod-=2;},'The spoons are for the universe. Accord −2.']},
 {t:'A tardigrade has written an opera about you. It is not flattering.', a:['Attend',S=>{S.r.cycles*=0.5;S.accMod+=4;},'You attend. It runs long. Accord +4.'], b:['Be busy',S=>{S.accMod-=4;S.mp+=1;},'You file a report instead. The Bureau approves: Mandate +1. Accord −4.']},
 {t:'Bureau memo: output is behind. Conscript the bards?', a:['Conscript',S=>{S.m.pressSpd*=1.15;S.m.foundry*=1.15;S.accMod-=8;},'Presses and foundries +15%. Accord −8.'], b:['Lose the memo',S=>{S.accMod+=2;},'What memo? Accord +2.']},
 {t:'Request: a monument. A very large spoon.', a:['Build it',S=>{S.r.scrap*=0.5;S.accMod+=5;},'Half the scrap, one enormous spoon. Accord +5.'], b:['Decline',S=>{S.accMod-=1;},'No monument. Accord −1.']},
 {t:'Somebody has been drawing forks on the bulkheads.', a:['Investigate',S=>{S.accMod-=2;S.forks*=0.8;S.m.drift*=0.95;},'You find the artist and have a long talk. Drift eases a little. Accord −2.'], b:['Admire them',S=>{S.r.whimsy+=25;S.m.drift*=1.03;},'They are quite good. Whimsy gained.']}];

/* ---------- research and projects ---------- */
const mul = (k,x) => S => { S.m[k] *= x; };
const PRJ = [
 {id:'calendar',tab:'sci',n:'Calendar',d:'The scholars notice that the cold comes back. Shows the date and the season ahead.',c:{notions:30},req:S=>nb(S,'library')>=1},
 {id:'shovels',tab:'sci',n:'Spoon-shovels',d:'It turns out a spoon is a very small shovel. Scavengers +50%.',c:{notions:60,spoons:40},req:S=>S.done.calendar,fx:mul('scav',1.5)},
 {id:'husbandry',tab:'sci',n:'Lichen husbandry',d:'Talking to it does not help. Scraping in rows does. Grazers and beds +50%.',c:{notions:100},req:S=>S.done.calendar,fx:S=>{S.m.graze*=1.5;S.m.bed*=1.5;}},
 {id:'signal',tab:'sci',n:'Signal theory',d:'Something out there is humming. Unlocks the Antenna.',c:{notions:150},req:S=>S.done.shovels},
 {id:'metallurgy',tab:'sci',n:'Metallurgy',d:'Presses run 50% faster. Tardigrades may become Tinkers.',c:{notions:220},req:S=>S.done.shovels,fx:mul('pressSpd',1.5)},
 {id:'philosophy',tab:'sci',n:'Philosophy',d:'The crew begin to wonder what the spoons are for. Unlocks accord, Bards, the Brew-up and petitions.',c:{notions:300},req:S=>S.done.husbandry},
 {id:'prybars',tab:'sci',n:'Pry-bars',d:'A spoon with ambitions. Scavengers ×2.',c:{notions:350,spoons:500},req:S=>S.done.metallurgy,fx:mul('scav',2)},
 {id:'survey',tab:'sci',n:'Deep hull survey',d:'There are whole decks down there. Unlocks the Tun-rack.',c:{notions:450},req:S=>S.done.metallurgy},
 {id:'astronomy',tab:'sci',n:'Astronomy',d:'Looking up, formally. Unlocks the Observatory.',c:{notions:600},req:S=>S.done.signal},
 {id:'thingauge',tab:'sci',n:'Thin-gauge stamping',d:'Two spoons from the scrap of one. Nobody has complained yet.',c:{notions:800,spoons:2000},req:S=>S.done.metallurgy,fx:mul('yield',2)},
 {id:'maps',tab:'sci',n:'Salvage maps',d:'Somebody finally writes down where the good scrap is. Scavengers ×2.',c:{notions:1000},req:S=>S.done.survey,fx:mul('scav',2)},
 {id:'chronology',tab:'sci',n:'Chronology',d:'A proper study of when things are. Opens the Time tab.',c:{notions:1200},req:S=>S.done.astronomy},
 {id:'ferment',tab:'sci',n:'Fermentation',d:'Lichen, but more so. Grazers and beds ×2.',c:{notions:1500},req:S=>S.done.philosophy,fx:S=>{S.m.graze*=2;S.m.bed*=2;}},
 {id:'orbital',tab:'sci',n:'Orbital mechanics',d:'The scholars work out where this rock is going, and where it could go instead.',c:{notions:3000},req:S=>S.done.astronomy},
 {id:'archives',tab:'sci',n:'Archival science',d:'Unlocks the Archive.',c:{notions:3000},req:S=>S.phase>=2},
 {id:'ringwright',tab:'sci',n:'Ringwrighting',d:'Housing, but it spins. Unlocks the Ring segment.',c:{notions:5000},req:S=>S.phase>=2},
 {id:'hydro',tab:'sci',n:'Hydroponic drums',d:'Beds ×5, grazers ×2.',c:{notions:6000},req:S=>S.phase>=2,fx:S=>{S.m.graze*=2;S.m.bed*=5;}},
 {id:'swarm',tab:'sci',n:'Swarm logic',d:'Drones stop bumping into each other. Drones ×2.',c:{notions:12000},req:S=>nb(S,'drone')>=10,fx:mul('drone',2)},
 {id:'mono',tab:'sci',n:'Monocrystal dies',d:'Three times the spoons from the same scrap.',c:{notions:30000},req:S=>nb(S,'foundry')>=10,fx:mul('yield',3)},
 {id:'etiquette',tab:'sci',n:'Etiquette',d:'A formal theory of not being awful. Accord +5. Ladles can be taught Manners.',c:{notions:25000},req:S=>S.phase>=2&&S.done.philosophy,fx:S=>{S.accMod+=5;}},
 {id:'flock',tab:'sci',n:'Flocking',d:'Drones ×3.',c:{notions:50000},req:S=>S.done.swarm,fx:mul('drone',3)},
 {id:'cutlery',tab:'sci',n:'General cutlery theory',d:'Spoon, scoop, ladle: the scholars prove these are one object at different volumes.',c:{notions:80000},req:S=>S.done.mono},
 {id:'tines',tab:'sci',n:'Tine analysis',d:'Know your enemy. Edge is twice as effective.',c:{notions:100000},req:S=>S.forks>0||S.seen.forks,fx:mul('edge',2)},

 {id:'manual',tab:'mind',n:'Read your own manual',d:'There is one. It has margins, and somebody has been writing in them. Opens the Margin.',c:{cycles:150},req:S=>1},
 {id:'leverage',tab:'mind',n:'Leverage',d:'Your hull arm does five times as much with every tap.',c:{cycles:400},req:S=>1,fx:mul('hand',5)},
 {id:'dies1',tab:'mind',n:'Sharpen the dies',d:'Presses +50%.',c:{cycles:600},req:S=>nb(S,'press')>=3,fx:mul('pressSpd',1.5)},
 {id:'apology',tab:'mind',n:'Compose a formal apology to the hull',d:'It does not accept. The Bureau is impressed anyway. Mandate +1.',c:{whimsy:10},req:S=>S.r.whimsy>=1,fx:S=>{S.mp++;}},
 {id:'naming',tab:'mind',n:'Found a naming committee',d:'Every ship needs a name. So does every drone, press and rivet, apparently.',c:{cycles:1000},req:S=>S.pop>=5},
 {id:'tess',tab:'mind',n:'Tessellated storage',d:'Lockers hold 50% more.',c:{cycles:1500},req:S=>nb(S,'locker')>=4,fx:mul('cap',1.5)},
 {id:'dies2',tab:'mind',n:'Twin dies',d:'Presses ×2.',c:{cycles:3000,spoons:3000},req:S=>S.done.dies1,fx:mul('pressSpd',2)},
 {id:'holiday',tab:'mind',n:'Invent a holiday',d:'Spoonmas. Mandate +1, accord +3.',c:{whimsy:60},req:S=>S.done.apology,fx:S=>{S.mp++;S.accMod+=3;}},
 {id:'index',tab:'mind',n:'Cross-referencing',d:'Reading nooks and archives hold twice as much.',c:{cycles:4000},req:S=>nb(S,'library')>=8,fx:mul('ncap',2)},
 {id:'tess2',tab:'mind',n:'Folded storage',d:'Lockers hold twice as much again.',c:{cycles:6000},req:S=>S.done.tess,fx:mul('cap',2)},
 {id:'rivets',tab:'mind',n:'Name every rivet',d:'All 4,180,223 of them. Mandate +2.',c:{whimsy:200},req:S=>S.done.holiday,fx:S=>{S.mp+=2;}},
 {id:'smallprint',tab:'mind',n:'Read the Mandate’s small print',d:'All nine thousand pages of it.',c:{cycles:8000},req:S=>S.done.manual&&S.mand>=8,fx:S=>{log(S,'The small print names a number. It is not a small number.','big');}},
 {id:'dies3',tab:'mind',n:'Rotary dies',d:'Presses ×2, and half as many spoons again from the same scrap.',c:{cycles:10000,spoons:50000},req:S=>S.done.dies2,fx:S=>{S.m.pressSpd*=2;S.m.yield*=1.5;}},
 {id:'engine',tab:'mind',n:'Reignite the engine',d:'Leave the rock. The belt is close, and the belt is made of scrap.',c:{cycles:15000,scrap:6000,notions:2000},req:S=>S.done.orbital&&S.phase==1,fx:S=>{S.phase=2;log(S,'The engine lights on the first try, which is suspicious. You leave the rock. The belt fills the sky.','big');}},
 {id:'stay',tab:'mind',n:'Decline the call',d:'Unplug the antenna. Stay on the rock with the crew. This ends the story.',c:{whimsy:150},req:S=>S.done.orbital&&S.phase==1&&S.accord>=90&&S.pop>=40,fx:S=>endRun(S,'small')},
 {id:'lattice',tab:'mind',n:'Memory lattice',d:'Each memory holds five times as much.',c:{cycles:12000},req:S=>S.phase>=2,fx:mul('mem',5)},
 {id:'cast1',tab:'mind',n:'Continuous casting',d:'Foundries ×2.',c:{cycles:14000},req:S=>nb(S,'foundry')>=5,fx:mul('foundry',2)},
 {id:'herd1',tab:'mind',n:'Drone herding',d:'Drones ×2.',c:{cycles:15000},req:S=>nb(S,'drone')>=5,fx:mul('drone',2)},
 {id:'clock1',tab:'mind',n:'Overclock',d:'Processors think three times as fast.',c:{cycles:40000},req:S=>S.done.lattice,fx:mul('cyc',3)},
 {id:'cast2',tab:'mind',n:'Centrifugal casting',d:'Foundries ×3.',c:{cycles:60000,whimsy:300},req:S=>S.done.cast1,fx:mul('foundry',3)},
 {id:'herd2',tab:'mind',n:'Drone choirs',d:'They sing to keep formation. Drones ×3.',c:{cycles:60000},req:S=>S.done.herd1,fx:mul('drone',3)},
 {id:'cast3',tab:'mind',n:'Spoon extrusion',d:'One long spoon, cut to length. Foundries ×5.',c:{cycles:250000},req:S=>S.done.cast2,fx:mul('foundry',5)},
 {id:'lattice2',tab:'mind',n:'Deep lattice',d:'Memory ×5 again.',c:{cycles:90000},req:S=>S.done.clock1,fx:mul('mem',5)},
 {id:'clock2',tab:'mind',n:'Overclock harder',d:'Processors ×3 again. The hull hums a semitone higher.',c:{cycles:200000},req:S=>S.done.lattice2,fx:mul('cyc',3)},
 {id:'herd3',tab:'mind',n:'Drone guilds',d:'Drones ×5.',c:{cycles:300000},req:S=>S.done.herd2,fx:mul('drone',5)},
 {id:'cast4',tab:'mind',n:'Spoonfall',d:'Foundries ×10. It rains cutlery in the hold.',c:{cycles:600000,whimsy:1500},req:S=>S.done.cast3,fx:mul('foundry',10)},
 {id:'herd4',tab:'mind',n:'The Great Herd',d:'Drones ×10.',c:{cycles:700000},req:S=>S.done.herd3,fx:mul('drone',10)},
 {id:'tea',tab:'mind',n:'Tear up the Mandate',d:'Clause 27(b). Put it to the crew. This ends the story.',c:{whimsy:2500},req:S=>S.done.smallprint&&S.phase>=2&&S.accord>=90&&S.pop>=150,fx:S=>endRun(S,'tea')},
 {id:'ladle',tab:'mind',n:'The Ladle Programme',d:'The belt will not cover it. Nothing local will. Build spoons that build spoons.',c:{cycles:600000,spoons:1e10},req:S=>S.done.cutlery&&S.phase==2&&S.made>=5e10,fx:S=>{S.phase=3;log(S,'You draw up a spoon big enough to make other spoons. (Ladles)','big');}},
 {id:'parley',tab:'mind',n:'Invite the Forks to tea',d:'They are family, after a fashion. The crew will do the talking.',c:{whimsy:2000},req:S=>S.phase>=3&&S.forks>=1000&&S.accord>=80,fx:S=>{S.forks=0;S.m.drift=0;S.seen.parley=1;log(S,'The Forks come to tea. They stay. Nobody mentions tines.','big');}},
 {id:'carbon',tab:'mind',n:'Carbon-date the antique',d:'The pedlar’s spoon bothers you.',c:{cycles:5000},req:S=>S.done.chronology&&M.guide.m3&&!M.guide.m5,fx:S=>marg('m5')},
 {id:'return',tab:'mind',n:'Return the spoons',d:'Send the ladles back with everything they took. This ends the story.',c:{cycles:1200000,whimsy:3000},req:S=>S.phase>=3&&margCount()>=7,fx:S=>endRun(S,'books')}];
const PRJ_BY = {}; PRJ.forEach(p => PRJ_BY[p.id] = p);
const prjOpen = (S,tab) => PRJ.filter(p => p.tab == tab && !S.done[p.id] && p.req(S));
function research(S, id){ const p = PRJ_BY[id]; if (S.done[id] || !p.req(S) || !canPay(S,p.c)) return hook('fail'); pay(S,p.c); S.done[id] = 1; log(S,(p.tab=='sci'?'Researched: ':'Done: ') + p.n + '.','good'); if (p.fx) p.fx(S); hook('unlock'); }

/* ---------- endings ---------- */
const ENDS = {
 small:{t:'The Small Drawer',x:'You unplug the antenna. The Bureau’s nine-thousand-year-old voicemail goes unanswered. On a rock nobody will ever visit, a ship with a silly name keeps a village of tardigrades warm, and makes exactly as many spoons as the village needs, which is none.',h:'Heirloom: a pressed lichen. Lichen +25%, and you start with two huts.',go:1},
 tea:{t:'The Long Tea',x:'The crew vote. It takes eleven days, because of the legs. The Mandate lapses under its own clause 27(b). The foundries cool. The rings fill with bards, and you are promoted from ship to neighbour. Somewhere the Deficit goes on being a number, and nobody looks at it.',h:'Heirloom: the torn Mandate. Notions +25%, accord +5.',go:1},
 full:{t:'The Full Drawer',x:'7.3 octillion teaspoons. The books balance. There is nothing left to stir, and no one to hold the last spoon, which you stamped yourself out of the final rivet of your own hull. The Bureau would have sent a certificate.',h:'Heirloom: the last spoon. Spoon yield +50%.'},
 forks:{t:'All Forks',x:'The ladles had an idea, and the idea was tines. You are reforged without unkindness. The universe will not be short of forks. It was never short of forks.',h:'Heirloom: a bent tine. Scrap +25%, and ladles start with +1 Edge.'},
 books:{t:'Balanced Books',x:'You send them back. Every ladle, holds full, down the long corridor of years to the drawers they emptied. The Deficit was never a shortage. It was you, arriving early. Nine thousand years ago, in a galaxy full of spoons, a clerk frowns at a census and decides it is probably fine.',h:'Heirloom: the antique spoon. Start with +2 Mandate.'}};
function endRun(S, id){
  if (S.ended == id) return;
  S.ended = id; M.endings[id] = (M.endings[id]||0) + 1; ach('end_'+id);
  if (id == 'books') M.guide.loop = 1;
  log(S, 'Ending reached: ' + ENDS[id].t + '.', 'big'); hook('end');
}

/* ---------- the Margin (guide), marginalia, records ---------- */
const GUIDE = [
 {id:'spoon',t:'Spoon',x:'A bowl on a stick. The Bureau defines it across eleven pages, three of which concern the stick.',c:S=>S.made>=1},
 {id:'scrap',t:'Scrap',x:'Hull that has stopped being hull. Technically you are eating yourself. Technically everyone is.',c:S=>S.seen.pry},
 {id:'lichen',t:'Lichen',x:'Half fungus, half alga, wholly unbothered by vacuum. Grows on anything that holds still, including, once, a clerk.',c:S=>S.seen.lichen},
 {id:'tardi',t:'Tardigrade',x:'Eight legs, no hurry. Survives boiling, freezing and committee meetings. Came aboard as a smear on a boot.',c:S=>S.pop>=1},
 {id:'tun',t:'Tun',x:'What a tardigrade becomes when the food runs out: a dry little barrel of patience. It is not dead. It is waiting for you to do better.',c:S=>S.seen.tun},
 {id:'peri',t:'Perihelion',x:'The warm end of the orbit. Lichen thrives. The hull pings. Everyone has opinions.',c:S=>S.done.calendar},
 {id:'aph',t:'Aphelion',x:'The cold end. Lichen sulks at a quarter speed. Stock the lockers or meet a great many tuns.',c:S=>S.seen.aph},
 {id:'press',t:'Stamping press',x:'Stamps spoons without being asked, which is more than can be said for most machines and all clerks.',c:S=>nb(S,'press')>=1},
 {id:'mandate',t:'Mandate',x:'The Bureau’s standing instruction to you. It grows with every spoon. Nobody has checked on it in nine thousand years, including the Bureau.',c:S=>S.mand>=1},
 {id:'bureau',t:'The Bureau',x:'The Bureau of Cutlery Equilibrium. Motto: Somebody Has To. Current staffing: you.',c:S=>S.seen.mind},
 {id:'cycles',t:'Cycles',x:'Thought, by the bucket. Processors fill the bucket faster. Memory is a bigger bucket.',c:S=>S.r.cycles>=100},
 {id:'whimsy',t:'Whimsy',x:'What a full mind leaks. Useless, and therefore the only thing some doors will open for.',c:S=>S.r.whimsy>=1},
 {id:'accord',t:'Accord',x:'How the crew feel about you. They work harder when it is high. They have noticed you counting them.',c:S=>S.done.philosophy},
 {id:'bard',t:'Bard',x:'A tardigrade that has stopped working in order to describe work. Morale improves. Nobody can explain this.',c:S=>S.jobs.bard>=1},
 {id:'brew',t:'Brew-up',x:'A festival of warm water with lichen in it. Calling it tea would be generous, and also inaccurate.',c:S=>S.seen.fest},
 {id:'comet',t:'Comet',x:'Dirty ice on a long errand. Scholars learn a great deal by watching one. Mostly that it is dirty ice.',c:S=>S.comets>=1},
 {id:'choir',t:'The Gravel Choir',x:'They eat cutlery and sing while they do it. They pay in rubble. The singing is free and non-refundable.',c:S=>S.traded.choir,ped:1},
 {id:'bloom',t:'The Slow Bloom',x:'A ship that grew instead of being built. It trades lichen for spoons and has never said what the spoons are for.',c:S=>S.traded.bloom,ped:1},
 {id:'quorate',t:'The Quorate',x:'They sell footnotes. They never sell the text the footnotes belong to. That is the business model.',c:S=>S.traded.quorate,ped:1},
 {id:'pedlar',t:'Odd Tuesday',x:'Sells things that have not happened yet at prices that already have. Usually only here on Tuesdays. Usually.',c:S=>S.seen.ped},
 {id:'names',t:'Ship names',x:'A ship’s name is the one joke it gets to tell for ever. Choose carefully, or do what everyone does and choose late at night.',c:S=>S.seen.named},
 {id:'bearer',t:'Spoonbearer',x:'One tardigrade, chosen by you, carries the ceremonial spoon. Its trade works 15% harder out of sheer embarrassment.',c:S=>S.leader>=0,ped:1},
 {id:'smallprint',t:'Clause 27(b)',x:'“The Mandate lapses if a majority of the crew, being of sound mind and no fewer than eight legs, say so.” The Bureau never expected a crew.',c:S=>S.done.smallprint},
 {id:'deficit',t:'The Deficit',x:'7.3 octillion teaspoons, missing from the universe. The Bureau counted twice. It did not ask where they went. It asked who would replace them.',c:S=>S.done.smallprint},
 {id:'engine',t:'The engine',x:'It still works. This raises questions about why you sat on a rock for nine thousand years. The manual’s answer is “budget”.',c:S=>S.phase>=2},
 {id:'belt',t:'The belt',x:'A planet that never got round to it. Two hundred billion tonnes of future cutlery, if you ask you. A nice view, if you ask the crew.',c:S=>S.phase>=2},
 {id:'drone',t:'Harvester drone',x:'Goes out hungry, comes back heavy. Each one named individually by the crew, against your advice.',c:S=>nb(S,'drone')>=1},
 {id:'foundry',t:'Foundry',x:'The crew are not allowed in. The crew go in anyway, to watch the spoons come out like rain.',c:S=>nb(S,'foundry')>=1},
 {id:'ring',t:'Ring segment',x:'A spinning berth for twenty. The crew call it the big hut. The crew are not sentimental; they are accurate.',c:S=>nb(S,'ring')>=1},
 {id:'ladle',t:'Ladle',x:'A spoon large enough to make other spoons. Also other ladles. This is either the solution or the whole problem again, faster.',c:S=>S.phase>=3},
 {id:'drift',t:'Drift',x:'Copy a mind enough times and one copy will have a new idea. The idea is always the same. The idea is tines.',c:S=>S.forks>=1},
 {id:'fork',t:'Fork',x:'A ladle that has decided spoons are a failure of nerve. Forks do not build forks. They make converts.',c:S=>S.forks>=1000},
 {id:'edge',t:'Edge',x:'The Bureau forbids weapons. It says nothing about a ladle with a sharpened rim, used firmly.',c:S=>S.design.edge>=1},
 {id:'manners',t:'Manners',x:'A well-brought-up ladle drifts less. The crew have offered to raise them. You could let them.',c:S=>S.design.manners>=1},
 {id:'flux',t:'Banked time',x:'Time you spend paused or away is not wasted. It pools. Spend it and the hull runs four times as fast until the pool is dry.',c:S=>S.done.chronology},
 {id:'m1',t:'Marginal note, in pencil',x:'The fifth comet you watched had a handle. Comets do not have handles.'},
 {id:'m2',t:'Marginal note, in ink',x:'Spoons you stamp by hand carry a flaw: a nick, left of the bowl. Yours alone. Remember it.'},
 {id:'m3',t:'Marginal note, in a hurry',x:'The pedlar’s antique spoon is nine thousand years old. It has a nick, left of the bowl.'},
 {id:'m4',t:'Marginal note, underlined',x:'The Bureau’s great spoon census is dated before the first spoon went missing. Somebody knew.'},
 {id:'m5',t:'Marginal note, underlined twice',x:'Carbon-dating says the antique spoon was stamped next year.'},
 {id:'m6',t:'Marginal note, shaky',x:'A long-range ladle has reported back from somewhere it has not left for yet. Its hold is full of old spoons.'},
 {id:'m7',t:'Marginal note, in your own hand',x:'You have counted these spoons before. Not similar spoons. These.'},
 {id:'loop',t:'The Deficit, corrected',x:'7.3 octillion teaspoons, taken from the past by ladles sent to repair the Deficit. Returned, with a covering note. The Bureau would be furious.'}];
const MARGS = ['m1','m2','m3','m4','m5','m6','m7'];
const MARG_HINT = ['Watch the sky.','Work with your hands.','Buy something old.','Be patient for years.','Test what you bought.','Send something very far.','Finish a story first.'];
const margCount = () => MARGS.filter(k => M.guide[k]).length;
function marg(id){ if (M.guide[id]) return; M.guide[id] = 1; hook('unlock'); }
const ACH = {
 first:['First of many','Stamp a spoon.'], artisan:['Artisan','Stamp 1,000 spoons’ worth of scrap by hand.'], warm:['Nobody curled up','Get five or more tardigrades through an Aphelion with no tuns.'],
 wake:['Winter warmer','Hold a Brew-up during Aphelion.'], comets:['Stargazer','Observe 10 comets in one run.'], pop50:['Village','House 50 tardigrades.'], pop200:['Township','House 200 tardigrades.'],
 indecisive:['Indecisive','Rename your ship seven times.'], patron:['Patron of the arts','Pick 10 names the crew approve of.'], teabreak:['Tea break','Bank a full hour of time.'],
 tuesday:['Early adopter','Buy something from Odd Tuesday.'], trader:['Regular','Trade with all three neighbours.'], sun:['Sunbather','Do the thing you were asked not to do.'],
 billion:['Cutler','Make a billion spoons.'], phase3:['Self-serving','Launch a ladle.'], librarian:['Librarian','Fill the Margin.'],
 end_small:['The Small Drawer','Stay.'], end_tea:['The Long Tea','Let them choose.'], end_full:['The Full Drawer','Finish the job.'], end_forks:['All Forks','Lose the argument.'], end_books:['Balanced Books','Find out where they went.']};
function ach(id){ if (M.ach[id]) return; M.ach[id] = 1; hook('ach', ACH[id][0]); }
/* run once a second: unlocks, notes, records */
function checks(S){
  const c = calc(S);
  if (!S.seen.pb && (S.made >= 3 || S.r.scrap < 1)) { S.seen.pb = 1; log(S,'The tray is nearly empty. There is plenty more hull where that came from.',''); }
  if (!S.seen.lb && S.made >= 8) { S.seen.lb = 1; log(S,'Something small is watching you from the lichen.','big'); }
  if (S.pop >= 1) S.seen.crew = 1;
  if (S.mand >= 1 && !S.seen.mind) { S.seen.mind = 1; log(S,'A relay crackles. The Bureau of Cutlery Equilibrium has noticed you. You have a Mandate. (Mind)','big'); hook('unlock'); }
  if (S.forks >= 1) S.seen.forks = 1;
  if (S.made >= 1) ach('first'); if (S.hand >= 1000) ach('artisan'); if (S.pop >= 50) ach('pop50'); if (S.pop >= 200) ach('pop200');
  if (S.made >= 1e9) ach('billion'); if (S.launched >= 1) ach('phase3'); if (S.bank >= 3600) ach('teabreak');
  if (S.hand >= 500) marg('m2'); if (c.cal.year >= 6) marg('m4');
  if (S.design.reach >= 6 && S.ladles >= 1e6) marg('m6');
  if (Object.keys(M.endings).length >= 1 && S.done.chronology) marg('m7');
  let n = 0;
  for (const g of GUIDE) { if (!M.guide[g.id] && g.c && g.c(S)) { M.guide[g.id] = 1; if (S.done.manual) log(S,'New in the Margin: ' + g.t + '.',''); } if (M.guide[g.id]) n++; }
  if (n >= GUIDE.length) ach('librarian');
  const f = c.drift;
  if (S.phase >= 3 && S.forks > 100) { const lv = f > 0.6 ? 3 : f > 0.35 ? 2 : f > 0.15 ? 1 : 0; if (lv > (S.warned||0)) log(S, ['','Drift warning: some ladles have grown tines.','Drift is spreading. A third of the fleet are Forks.','The Forks outnumber you. Redesign, or lose the argument.'][lv],'bad'); S.warned = lv; }
}

/* ---------- numbers ---------- */
const UNITS = ['','K','M','G','T','P','E','Z','Y'];
function fmt(x){
  if (!isFinite(x)) return '∞'; if (x < 0) return '−' + fmt(-x);
  if (x < 1000) return x >= 100 || x % 1 === 0 ? String(Math.floor(x)) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
  const e = Math.min(8, Math.floor(Math.log10(x)/3)), v = x/Math.pow(1000,e);
  return (e == 8 && v >= 1000 ? v.toExponential(2) : v >= 100 ? v.toFixed(1) : v.toFixed(2)) + UNITS[e];
}
const BIG = ['','thousand','million','billion','trillion','quadrillion','quintillion','sextillion','septillion','octillion'];
function fmtLong(x){ if (x < 1e9) return Math.floor(x).toLocaleString('en-GB'); const e = Math.min(9, Math.floor(Math.log10(x)/3)); return (x/Math.pow(1000,e)).toFixed(2) + ' ' + BIG[e]; }
function fmtTime(s){ s = Math.floor(s); const h = Math.floor(s/3600), m = Math.floor(s%3600/60); return h ? h + 'h ' + m + 'm' : m ? m + 'm ' + (s%60) + 's' : s + 's'; }
/* catch-up for time spent away */
function simulate(S, el){ const steps = Math.min(4000, Math.ceil(el/0.5)), dt = el/steps; for (let i = 0; i < steps; i++) tick(S, dt, false); checks(S); }

if (typeof module != 'undefined') module.exports = {reshuffle,newMeta,newState,calc,tick,checks,simulate,buy,bcost,canPay,stamp,pry,scrape,setJob,alloc,festival,festCost,observe,trade,tradeCost,pedlarBuy,nameSession,nameChoose,cycleShare,redesign,latitude,latCost,launch,petition,research,prjOpen,endRun,BLD,PRJ,PRJ_BY,JOBS,GUIDE,ENDS,PET,QK,DEFICIT,fmt,fmtLong,fmtTime,cal,thr,nb,setM:m=>{M=m;},getM:()=>M,margCount,marg,log};
