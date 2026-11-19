// Usage: node tools/harness/run.js [lives per player, default 3] [players, comma-separated, default all]
// Plays many lives in parallel and writes build/harness.json and build/report.html.
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), fs = require('fs'), os = require('os');

if (!isMainThread) {
  const { playLife } = require('./play.js');
  const { player, seed } = workerData; const t0 = Date.now();
  const R = playLife(player, seed); R.ms = Date.now() - t0;
  parentPort.postMessage(R);
} else {
  const { PLAYERS } = require('./play.js');
  const lives = +(process.argv[2] || 3), only = process.argv[3] ? process.argv[3].split(',') : Object.keys(PLAYERS);
  const jobs = []; for (const p of only) for (let i = 0; i < lives; i++) jobs.push({player:p, seed:1000 + i*97 + p.length});
  const out = path.join(__dirname, '..', '..', 'build'); fs.mkdirSync(out, {recursive:true});
  const results = [], N = Math.max(1, Math.min(os.cpus().length, 8)); let next = 0, live = 0; const t0 = Date.now();
  const start = () => { while (live < N && next < jobs.length) { const j = jobs[next++]; live++;
    const w = new Worker(__filename, {workerData:j}); w.on('message', R => { results.push(R); process.stdout.write('.'); });
    w.on('error', e => { results.push({player:j.player, seed:j.seed, label:PLAYERS[j.player].label, error:String(e.stack||e), flags:[{type:'crash', t:0, msg:'The life crashed outright: ' + e.message}], firsts:[], series:[], done:{}, final:{}}); });
    w.on('exit', () => { live--; if (next < jobs.length) start(); else if (!live) finish(); }); } };
  const finish = () => {
    const meta = {when:new Date().toISOString(), lives:results.length, secs:Math.round((Date.now() - t0)/1000), build:'stage one'};
    fs.writeFileSync(path.join(out, 'harness.json'), JSON.stringify({meta, results}));
    require('./report.js').write(path.join(out, 'report.html'), meta, results);
    const n = results.reduce((a,R) => a + R.flags.length, 0);
    console.log('\n' + results.length + ' lives in ' + meta.secs + 's, ' + n + ' flags. Report: build/report.html');
  };
  start();
}
