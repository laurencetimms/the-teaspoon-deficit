// Usage: node tools/sim.js [attention 0..1] [hours] [quiet]
// A greedy bot plays stage one and prints when each new thing first appears, plus the longest wait between new things.
const G = require('../src/core.js');
const att = +(process.argv[2] || 1), HOURS = +(process.argv[3] || 60), quiet = process.argv[4] == 'quiet';
G.setM(G.newMeta());
const S = G.newState('');
const nb = id => S.b[id] || 0;
const firsts = []; const seen = new Set();
const mark = (k) => { if (seen.has(k)) return; seen.add(k); firsts.push([S.age, k]); if (!quiet) console.log((S.age/3600).toFixed(2).padStart(6) + 'h  ' + k + '   [spoons ' + G.fmt(S.made) + ', crew ' + S.crew.length + ', mand ' + S.mand + ', nodes ' + S.mind.nodes.length + ', accord ' + Math.round(S.accord) + ']'); };
function policy() {
  const c = G.calc(S);
  if (S.age < 3600 && S.r.scrap < 20) G.pry(S);
  if (S.age < 1200) for (let i = 0; i < 2; i++) { if (S.r.scrap < 30 && nb('hut') < 5) G.pry(S); if (S.r.lichen < 60 && S.crew.length < 4) G.scrape(S); if (S.r.scrap >= 1) G.stamp(S); }
  else if (S.age < 4*3600 && Math.random() < 0.3) { G.stamp(S); G.pry(S); }
  if (Math.random() > att) return;
  // jobs: enough grazers for the worst season plus a margin, then split the rest
  const pop = S.crew.length, onDuty = S.crew.filter(t => t.d).length, free = pop - onDuty;
  if (free > 0) {
    const bed = c.bedIn / c.seasonM, perG = S.m.graze * c.am * 0.9;
    const need = Math.max(0, Math.min(free - (free >= 2 ? 1 : 0) - (free >= 6 ? 1 : 0), Math.ceil((pop*0.4*1.15 - bed*0.25) / Math.max(0.1, perG*0.55))));
    const rest = Math.max(0, free - need), want = {scav:0.35, scholar:0.35, icer:0.08, tinker:0.1, bard:0.12};
    for (const j in want) if (G.JOBS[j].req(S)) { const tgt = Math.floor(rest*want[j]), cur = S.crew.filter(t => !t.d && t.j == j).length; if (tgt != cur) G.setJob(S, j, tgt - cur); }
  }
  // duties: a few crew on each once unlocked
  for (const k in G.DUTY) if (G.DUTY[k].unl(S)) { const n = G.team(S,k).length, tgt = k == 'mind' ? 4 : k == 'cttee' ? 2 : 3; if (n < tgt && pop >= 10 && S.crew.filter(t => t.d).length < pop*0.25) G.setDuty(S, k, 1); }
  for (const r of ['plate','wire','spring','gear','lens','ledger','tea']) if (G.CRAFT[r].req(S)) S.keep[r] = {plate:60,wire:30,spring:15,gear:80,lens:12,ledger:8,tea:30}[r];
  // save scrap for plate when plate is short
  S.share = S.done.craft && S.r.plate < 40 ? 0 : 0.5;
  const bigNeed = Math.max(0, ...G.prjOpen(S,'sci').map(p => G.prjCost(S,p).notions || 0));
  if (S.r.notions > 0.9*c.caps.notions || bigNeed > c.caps.notions) { for (const id of ['nook','shelf','obs']) if (G.BLD[id].req(S)) G.buy(S, id, 1); if (bigNeed > c.caps.notions) { S.keep.lens = 20; S.keep.ledger = 20; } }
  // craft by hand what the workshop crew can't keep up with
  if (G.CRAFT.plate.req(S) && S.r.plate < 200 && S.r.scrap > 0.35*c.caps.scrap) G.craft(S, 'plate', Math.floor((S.r.scrap - 0.2*c.caps.scrap)/50));
  for (const r of ['wire','spring','gear','lens','ledger','tea']) if (G.CRAFT[r].req(S) && S.r[r] < S.keep[r] && Math.random() < 0.2) G.craft(S, r, 1);
  // stories: take the first option
  if (S.st.cur) G.storyChoose(S, Math.random() < 0.7 ? 0 : 1);
  // research and projects
  for (const tab of ['sci','mind']) for (const p of G.prjOpen(S, tab)) { if (p.id == 'stay') continue; if (G.canPay(S, G.prjCost(S,p))) G.research(S, p.id); }
  for (const u of G.upgOpen(S)) if (G.canPay(S, u.c)) G.upgrade(S, u.id);
  // the Mind
  if (S.mind.offer) { const pref = ['attic','bilge','rumin','second','hunch','thermo','npress','pend','grudge','sump','gland','metro','echo','worry','daydream','lobe','sock','reflex','bulb','bureau','tickle']; const o = S.mind.offer.slice().sort((a,b) => pref.indexOf(a) - pref.indexOf(b)); G.mindTake(S, o[0]); }
  else if (S.mp > 0) G.mindDraft(S);
  S.mind.nodes.forEach((n,i) => { if (n.cond < 0.6) G.service(S, i); });
  if (Math.random() < 0.05) { const i = Math.floor(Math.random()*S.mind.nodes.length); if (G.canPay(S, G.nodeUpCost(S.mind.nodes[i])) && S.r.plate > 80) G.nodeUp(S, i); }
  if (G.calc(S).mind.heat > G.calc(S).mind.hcap && S.done.hydraulics) { const i = S.mind.nodes.findIndex(n => n.v >= 1 && (G.MT[n.k].h||0) >= 1.5); if (i >= 0) G.valve(S, i); }
  // buildings
  const tryBuy = (id, n) => { if (G.BLD[id].req(S)) G.buy(S, id, n || 1); };
  tryBuy('hut'); tryBuy('rack');
  if (S.r.lichen > 0.4*c.caps.lichen || nb('bed') < 4) tryBuy('bed');
  if (S.r.scrap > 0.85*c.caps.scrap || S.r.lichen > 0.95*c.caps.lichen) tryBuy('locker');
  if (S.r.notions > 0.8*c.caps.notions) { tryBuy('nook'); tryBuy('shelf'); }
  if (c.demand < c.scrapIn*0.6 + 0.3) tryBuy('press');
  for (const id of ['bench','cond','cellar','smelter','kettle','boiler','school','obs','band','mill','garden']) if (nb(id) < 2 + S.crew.length/10) tryBuy(id);
  if (S.r.scrap > 0.6*c.caps.scrap && Math.random() < 0.1) tryBuy('locker');
  if (nb('antenna') < 3) tryBuy('antenna');
  if (S.done.philosophy && S.fest <= 0 && S.accord < 70) G.festival(S);
  // trade for what can't be made
  if (S.hails >= 1) { if (nb('antenna') >= 3 && S.r.ledger >= 2 && S.r.footnotes < 25) G.trade(S,'quorate'); else if (nb('antenna') >= 2 && S.r.spores < 6 && S.r.tea > 10) G.trade(S,'bloom'); else if (S.r.grit < 10) G.trade(S,'choir'); }
  if (S.comet > 0 && Math.random() < 0.5) G.observe(S);
}
let t = 0;
const MAX = HOURS*3600;
while (t < MAX && !S.seen.stage2) {
  G.tick(S, 1, true); G.checks(S); policy(); t++;
  if ([1800, 4*3600, 9*3600].includes(t)) require('fs').writeFileSync(require('path').join(__dirname, '..', 'build', 'state_' + (t/3600) + 'h.json'), JSON.stringify({S, M: G.getM()}));
  for (const k in S.b) mark('build ' + k); for (const k in S.done) mark('done ' + k); for (const k in S.up) mark('upgrade ' + k);
  for (const k in S.duty) mark('duty ' + k); S.mind.nodes.forEach(n => mark('node ' + n.k)); for (const k in G.CRAFT) if (S.r[k] >= 1) mark('have ' + k);
  for (const k in S.st.done) mark('story ' + k);
  if (t % 7200 == 0 && !quiet) { const c = G.calc(S); console.log('      ' + (t/3600) + 'h: spoons ' + G.fmt(S.made) + ' (' + G.fmt(S._sp) + '/s) crew ' + S.crew.length + '/' + c.capPop + ' scrap ' + G.fmt(c.scrapIn) + '/s notions ' + G.fmt(S.r.notions) + '/' + G.fmt(c.caps.notions) + ' (' + G.fmt(c.notionsIn) + '/s) cycles ' + G.fmt(c.mind.cps) + '/s cap ' + G.fmt(c.mind.cap) + ' tun ' + S.tun + ' lichen ' + G.fmt(S.r.lichen) + '/' + G.fmt(c.lichenIn - c.eat) + ' heat ' + c.mind.heat.toFixed(1) + '/' + c.mind.hcap.toFixed(1) + ' plate ' + G.fmt(S.r.plate) + ' duties ' + Object.entries(S.duty).map(([k,d]) => k + ':' + Math.round(d.c)).join(',') + ' accord ' + Math.round(S.accord) + ' open: ' + [...G.prjOpen(S,'sci'),...G.prjOpen(S,'mind')].map(p => p.id).join(',')); }
}
let gap = 0, gapAt = 0; for (let i = 1; i < firsts.length; i++) { const g = firsts[i][0] - firsts[i-1][0]; if (g > gap) { gap = g; gapAt = firsts[i-1][0]; } }
{ const c = G.calc(S); console.log('jobs', JSON.stringify(c.N), 'duties', JSON.stringify(c.D), 'm', JSON.stringify(S.m), 'tun', S.tun, 'am', c.am.toFixed(2), 'accParts', JSON.stringify(c.accParts)); }
console.log('stock', JSON.stringify({fn:S.r.footnotes,gear:S.r.gear,led:S.r.ledger,lens:S.r.lens,n:S.r.notions,cap:G.calc(S).caps.notions,hails:S.hails,ant:S.b.antenna,cyc:S.r.cycles,cyccap:G.calc(S).caps.cycles,plate:S.r.plate, keep:S.keep}));
console.log('END', S.seen.stage2 ? 'engine reignited' : 'not finished', (S.age/3600).toFixed(1) + 'h', firsts.length + ' new things; longest wait ' + (gap/60).toFixed(0) + ' min, after ' + (gapAt/3600).toFixed(1) + 'h');
const after = firsts.filter(f => f[0] > 0); const late = after.filter(f => f[0] > MAX*0.5); if (!quiet) console.log('missing:', ['bed','hut','press','locker','nook','bench','cond','cellar','smelter','kettle','boiler','school','rack','antenna','obs','band','shelf','mill','garden'].filter(b => !S.b[b]).join(',') || 'none', '| projects not done:', G.PRJ.filter(p => !S.done[p.id]).map(p => p.id).join(','));
