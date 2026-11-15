// Usage: node tools/sim.js [spoons|crew] [attention 0..1] [endings already seen, comma-separated] [stay|tea] [noedge]
// Headless bot: plays a whole run with a plain greedy policy and prints when milestones land.
const G = require('../src/core.js');
const style = process.argv[2] || 'spoons';   // spoons | crew
const active = +(process.argv[3] || 1);      // 1 = attentive player, 0.3 = mostly idle
G.setM(G.newMeta());
if (process.argv[4]) process.argv[4].split(',').forEach(e => G.getM().endings[e] = 1);
const S = G.newState();
const marks = {}; const mark = (k) => { if (!marks[k]) { marks[k] = S.age; console.log((S.age/3600).toFixed(2).padStart(6) + 'h  ' + k + '  [made ' + G.fmt(S.made) + ', pop ' + S.pop + ', mand ' + S.mand + ', accord ' + Math.round(S.accord) + ']'); } };
const nb = id => S.b[id] || 0;
function policy(t) {
  const c = G.calc(S);
  if (S.age < 900) { for (let i = 0; i < 2; i++) { if (S.r.scrap < 30 && nb('hut') < 4) G.pry(S); if (S.r.lichen < 60 && S.pop < 4) G.scrape(S); if (S.made < 40 && S.r.scrap >= 1 && (nb('hut') >= 1 || S.made < 12)) G.stamp(S); } }
  if (Math.random() > active) return;
  // jobs
  const pop = S.pop; if (pop > 0) {
    const bedAvg = (S.b.bed||0)*0.25*S.m.bed*0.9; const need = Math.max(0, Math.min(pop, Math.ceil((pop*0.4*1.2 - bedAvg) / Math.max(0.2, S.m.graze*0.9*c.am))));
    const rest = pop - need; const want = {scav: 0.5, scholar: 0.3, tinker: 0.1, bard: 0.1};
    if (style == 'crew') { want.bard = 0.25; want.scav = 0.4; want.scholar = 0.25; }
    for (const j in want) { if (!G.JOBS[j].req(S)) continue; const tgt = Math.floor(rest*want[j]); G.setJob(S, j, tgt - S.jobs[j]); }
    if (S.jobs.grazer < need) { for (const j of ['scav','scholar','tinker','bard']) if (S.jobs.grazer < need && S.jobs[j] > 0) G.setJob(S, j, -Math.min(S.jobs[j], need - S.jobs.grazer)); }
  }
  // research
  for (const tab of ['sci','mind']) for (const p of G.prjOpen(S, tab)) { if (['stay','tea','return'].includes(p.id) && process.argv[5] != p.id) continue; if (G.canPay(S, p.c)) G.research(S, p.id); }
  // mandate
  while (S.mp > 0) { const needC = Math.max(0, ...G.prjOpen(S,'mind').map(p => p.c.cycles || 0)); G.alloc(S, needC > c.capCycles && S.mem < S.proc*3 ? 'mem' : (S.mem < S.proc ? 'mem' : 'proc')); c.capCycles = G.calc(S).capCycles; }
  // buildings
  const tryBuy = (id, n) => { if (G.BLD[id].req(S)) G.buy(S, id, n || 1); };
  tryBuy('hut'); tryBuy('rack'); tryBuy('ring');
  if (S.r.lichen > 0.5*c.capLichen || nb('bed') < 3) tryBuy('bed');
  if (S.r.scrap > 0.85*c.capScrap || S.r.lichen > 0.95*c.capLichen) tryBuy('locker');
  if (S.r.notions > 0.8*c.capNotions) { tryBuy('library'); tryBuy('archive'); }
  if (nb('antenna') < 3) tryBuy('antenna'); if (nb('obs') < 4) tryBuy('obs');
  if (c.demand < c.scrapIn*1.2 + 0.3) tryBuy('press');
  if (S.phase >= 2) { if (c.demand < c.scrapIn) tryBuy('foundry', 5); else tryBuy('drone', 5); }
  if (S.hails >= 1 && nb('antenna') >= 1 && S.r.spoons > G.tradeCost(S)*3) G.trade(S, nb('antenna') >= 3 && S.r.notions < c.capNotions*0.5 ? 'quorate' : 'choir');
  if (S.pet >= 0) G.petition(S, style == 'crew' ? 0 : 1);
  if (S.comet > 0) G.observe(S);
  if (S.done.philosophy && S.fest <= 0 && style == 'crew') G.festival(S);
  if (S.done.naming && S.r.cycles >= c.capCycles*0.9 && !G.prjOpen(S,'mind').some(p => p.c.cycles)) { G.nameSession(S); if (S.cand) G.nameChoose(S, 0); }
  if (S.phase >= 3) {
    const d = S.design; const plan = style == 'crew' ? ['rep','stamp','rep','shield','manners','rep','stamp','reach','manners','rep','reach','reach','rep','reach','reach','reach'] : (process.argv[6] == 'noedge' ? ['rep','stamp','rep','shield','rep','stamp','reach','reach','rep','reach','reach','stamp'] : ['rep','stamp','rep','shield','edge','rep','stamp','reach','edge','rep','reach','reach','rep','reach','reach','reach']);
    let k = 0; while (G.calc(S).free > 0 && k < 40) { const tot = d.reach+d.rep+d.stamp+d.shield+d.manners+d.edge; G.redesign(S, plan[Math.min(tot, plan.length-1)], 1); k++; }
    if (S.launched < 5) G.launch(S, 1);
    G.latitude(S);
  }
}
let t = 0; const MAX = 60*3600;
while (t < MAX && !S.ended) {
  G.tick(S, 1, true); G.checks(S); policy(t); t++;
  if (S.fin) { G.stamp(S); }
  if (S.pop >= 1) mark('first tardigrade'); if (S.seen.mind) mark('mind tab'); if (S.done.calendar) mark('calendar');
  if (S.done.philosophy) mark('philosophy'); if (nb('antenna')) mark('antenna'); if (S.done.chronology) mark('chronology'); if (S.done.orbital) mark('orbital'); if (S.done.smallprint) mark('smallprint');
  if (S.pop >= 40 && S.accord >= 90) mark('small-drawer eligible');
  if (S.phase >= 2) mark('PHASE 2'); if (S.done.cutlery) mark('cutlery theory'); if (S.made >= 5e10) mark('5e10 made');
  if (S.pop >= 120 && S.accord >= 90 && S.phase >= 2) mark('long-tea eligible');
  if (S.phase >= 3) mark('PHASE 3'); if (S.ladles > 1e6) mark('1e6 ladles'); if (S.forks > 1000) mark('forks>1000');
  for (const [nm, at] of [['p1', marks['antenna'] && marks['antenna'] + 1500], ['p2', marks['PHASE 2'] && marks['PHASE 2'] + 2400], ['p3', marks['PHASE 3'] && marks['PHASE 3'] + 1500]]) if (at && S.age >= at && !marks['dump'+nm]) { marks['dump'+nm] = 1; require('fs').writeFileSync(require('path').join(__dirname, '..', 'build', 'state_' + nm + '.json'), JSON.stringify({S, M: G.getM()})); }
  if (t % 3600 == 0) { const c = G.calc(S); console.log('      ' + (t/3600) + 'h: made ' + G.fmt(S.made) + ' sp/s ' + G.fmt(S._sp) + ' pop ' + S.pop + '/' + c.capPop + ' scrap/s ' + G.fmt(c.scrapIn) + ' notions ' + G.fmt(S.r.notions) + '/' + G.fmt(c.capNotions) + ' cyc cap ' + G.fmt(c.capCycles) + ' whimsy ' + G.fmt(S.r.whimsy) + ' proc/mem ' + S.proc + '/' + S.mem + (S.phase>=3 ? ' L ' + G.fmt(S.ladles) + ' F ' + G.fmt(S.forks) : '') + ' open: ' + [...G.prjOpen(S,'sci'),...G.prjOpen(S,'mind')].map(p => p.id).join(',')); }
}
console.log('L',S.ladles,'F',S.forks);console.log('END', S.ended || '(none)', (S.age/3600).toFixed(2) + 'h', 'made', G.fmt(S.made), 'margin', Object.keys(G.getM().guide).length, 'ach', Object.keys(G.getM().ach).join(','));
