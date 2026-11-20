// Usage: node tools/harness/traps.js [seeds, default 2]
// Trap hunt. Each "mistake" is something a player can do that cannot be undone (mostly: building too many of a
// thing that consumes a resource without limit). It is injected into an attentive player's life at a set time,
// and the player carries on as normal. The same life without the mistake is the control.
// For every resource it records how long it then sat pinned near empty while something the player wanted cost it.
// Writes build/traps.json and build/traps.html.
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), fs = require('fs'), os = require('os');

/* the mistakes: [id, label, why it might trap, hours to inject at, function (S, G) -> what was done, or null if not possible yet] */
const add = (S, k, n) => { S.b[k] = (S.b[k]||0) + n; return n; };
const MISTAKES = [
 ['kettles', 'Six more kettle-houses', 'Kettles use ice with no floor.', [6, 9], (S, G) => S.done.brewing ? add(S,'kettle',6) + ' kettles' : null],
 ['whistle', 'Three more kettles, whistling', 'Whistling kettles double what every kettle uses.', [6], (S, G) => S.done.brewing ? (add(S,'kettle',3), S.up.whistle || (S.up.whistle = 1, S.m.kettle *= 2), '3 kettles + whistling') : null],
 ['mills', 'Four more drawing mills', 'Mills draw plate with no floor; one mill draws more than a smelter makes.', [9.5, 11], (S, G) => S.done.drawmill ? add(S,'mill',4) + ' mills' : null],
 ['boilers', 'Ten more boilers', 'Boilers burn scrap with no floor in the cold season.', [6], (S, G) => S.done.boilers ? add(S,'boiler',10) + ' boilers' : null],
 ['boilersDark', 'Ten more boilers in the Long Dark', 'In the Long Dark boilers burn all year.', [6.5], (S, G) => S.done.boilers && G.inCrisis(S,'trust') ? add(S,'boiler',10) + ' boilers' : null, 'trust'],
 ['smelters', 'Ten more smelters', 'Smelters take scrap above half the store (should be safe).', [4, 7], (S, G) => S.done.smelting ? add(S,'smelter',10) + ' smelters' : null],
 ['crucible', 'Crucibles and ten more smelters', 'Crucibles double smelting.', [7], (S, G) => S.done.smelting ? (add(S,'smelter',10), S.up.crucible || (S.up.crucible = 1, S.m.smelt *= 2), '10 smelters + crucibles') : null],
 ['presses', 'Fifteen more presses', 'Presses eat scrap, but can be switched off.', [3, 6], (S, G) => add(S,'press',15) + ' presses'],
 ['racks', 'Four more tun-racks', 'More crew to feed.', [6], (S, G) => S.done.survey ? add(S,'rack',4) + ' racks' : null],
];
const BASE = ['lichen','scrap','spoons','ice','notions','cycles','whimsy','tea','plate','wire','lens','spring','gear','grit','ledger','footnotes'];

const PASSIVE = ['lichen','scrap','ice','plate','wire','notions','cycles','whimsy','tea','spoons'];
/* left alone for ten minutes, does this resource climb back towards what the player needs? If not, the drains win. */
function starvedBy(S, G, r, need){
  const F = JSON.parse(JSON.stringify(S)); F.here = -1e9; const a0 = F.r[r]||0;
  for (let i = 0; i < 600; i += 5) G.tick(F, 5, false);
  const gain = (F.r[r]||0) - a0; return gain < Math.max(1, 0.05*(need - a0));
}
function runOne(j){
  const { playLife } = require('./play.js'), G = require('../../src/core.js');
  const M = MISTAKES.find(m => m[0] == j.mistake), T = j.at*3600;
  const starve = {}, span = {}, cur = {}; let did = null, didT = null, lastT = 0, nextCheck = 0;
  const opt = {hours:40, route:(M && M[5]) || j.route, onSample:(S, c) => {
    if (S.age >= T && did == null && M) { const d = M[4](S, G); if (d != null) { did = d; didT = S.age; } }
    if (!M && S.age >= T && didT == null) didT = S.age;
    if (didT == null || S.age < nextCheck) return; const dt = lastT ? S.age - lastT : 600; lastT = S.age; nextCheck = S.age + 600;
    const want = {}; for (const a of G.actions(S)) if (!a.can && /^(b|u|p|c):/.test(a.id)) for (const r in a.cost) if (PASSIVE.includes(r) && (S.r[r]||0) < a.cost[r]) want[r] = Math.max(want[r]||0, Math.min(a.cost[r], (c.caps[r]||1e12)));
    for (const r of PASSIVE) { if (want[r] && starvedBy(S, G, r, want[r])) { starve[r] = (starve[r]||0) + dt; cur[r] = (cur[r]||0) + dt; span[r] = Math.max(span[r]||0, cur[r]); } else cur[r] = 0; } }};
  if (j.player == 'casual') opt.hours = null; const R = playLife(j.player || 'optimiser', j.seed, opt);
  return {player:j.player || 'optimiser', wallEnd:R.wallEnd, mistake:j.mistake, at:j.at, seed:j.seed, route:R.route, did, didT, finished:R.finished, tEnd:R.tEnd, flags:R.flags.map(f => ({type:f.type, t:f.t, msg:f.msg, code:f.code})), starve, span, endCode:R.endCode};
}

if (!isMainThread) { parentPort.postMessage(runOne(workerData)); }
else {
  const seeds = +(process.argv[2] || 2), jobs = [], who = process.argv[3] ? process.argv[3].split(',') : null, which = process.argv[4] ? process.argv[4].split(',') : null;
  if (who) { for (let i = 0; i < seeds; i++) for (const p of who) { const seed = 1001 + i, route = i % 2 ? 'obey' : 'trust'; jobs.push({player:p, mistake:'control', at:4, seed, route});
      for (const m of MISTAKES) if (!which || which.includes(m[0])) jobs.push({player:p, mistake:m[0], at:m[3][0], seed, route: m[5] || route}); } }
  else
  for (let i = 0; i < seeds; i++) { const seed = 1001 + i;
    for (const route of ['obey','trust']) for (const at of [4]) jobs.push({mistake:'control', at, seed, route});
    for (const m of MISTAKES) for (const at of m[3]) jobs.push({mistake:m[0], at, seed, route: m[5] || (i % 2 ? 'obey' : 'trust')}); }
  const out = path.join(__dirname, '..', '..', 'build'), res = [], N = Math.max(1, Math.min(os.cpus().length, 8)); let next = 0, live = 0; const t0 = Date.now();
  const start = () => { while (live < N && next < jobs.length) { const j = jobs[next++]; live++;
    const w = new Worker(__filename, {workerData:j}); w.on('message', r => { res.push(r); process.stdout.write('.'); });
    w.on('error', e => res.push(Object.assign({}, j, {error:String(e.stack||e)}))); w.on('exit', () => { live--; if (next < jobs.length) start(); else if (!live) finish(); }); } };
  const finish = () => { fs.writeFileSync(path.join(out, 'traps.json'), JSON.stringify({when:new Date().toISOString(), secs:Math.round((Date.now()-t0)/1000), mistakes:MISTAKES.map(m => ({id:m[0], label:m[1], why:m[2]})), res}));
    console.log('\n' + res.length + ' lives in ' + Math.round((Date.now()-t0)/1000) + 's. Results: build/traps.json'); };
  start();
}
module.exports = {MISTAKES};
