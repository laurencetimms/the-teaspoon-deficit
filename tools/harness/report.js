// Turns harness results into one self-contained HTML page.
'use strict';
const fs = require('fs'), path = require('path');
const G = require(path.join(__dirname, '..', '..', 'src', 'core.js'));

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hrs = t => t == null ? '—' : (t/3600).toFixed(1) + 'h';
const days = t => t == null ? '—' : (t/86400).toFixed(1) + ' days';
const med = a => { if (!a.length) return null; const b = a.slice().sort((x,y) => x - y); return b[Math.floor(b.length/2)]; };
const KIND = {p:'Discovery or project', u:'Upgrade', b:'Building', n:'Subsystem', d:'Duty', s:'Story', c:'Material'};
const KCOL = {p:'var(--c1)', u:'var(--c2)', b:'var(--c3)', n:'var(--c4)', d:'var(--c5)', s:'var(--c6)', c:'var(--c7)'};
const FTYPE = {
  crash:['Crashes','The rules threw an error. Always a bug.'],
  deadlock:['Deadlocks','For half an hour, nothing new was reachable within six hours: everything left needed something that was not coming.'],
  wall:['Walls','Something needed more than the store could ever hold, with no way to raise it, for at least half an hour.'],
  grind:['Grind','Half an hour where progress hung on one repeated action, or most spoons came from tapping by hand.'],
  crisis:['Stuck crises','The midpoint crisis went on far longer than it should, or the Bureau\'s question was never answered.'],
  wait:['Long waits','More than 45 minutes of play (or three casual sessions) with nothing new appearing.']};

function gaps(R, casual){ const f = R.firsts.map(x => casual ? x[2] : x[0]); f.unshift(0); f.push(casual ? R.wallEnd : R.tEnd); let g = 0, at = 0; for (let i = 1; i < f.length; i++) if (f[i] - f[i-1] > g) { g = f[i] - f[i-1]; at = f[i-1]; } return [g, at]; }

function lanes(results, casual){
  const rows = results.filter(R => !!R.player && (casual ? R.player == 'casual' : R.player != 'casual'));
  if (!rows.length) return '';
  const T = Math.max(...rows.map(R => casual ? R.wallEnd || 0 : R.tEnd || 0), 1), W = 900, L = 170, RH = 22, H = rows.length*RH + 36;
  const x = t => L + (W - L - 10)*t/T, unit = casual ? 86400 : 3600, step = casual ? 1 : T/3600 > 40 ? 10 : 5;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="lanes" role="img" aria-label="When each new thing first appeared, per life">';
  for (let v = 0; v*unit <= T; v += step) s += '<line x1="' + x(v*unit) + '" x2="' + x(v*unit) + '" y1="6" y2="' + (H - 22) + '" class="grid"/><text x="' + x(v*unit) + '" y="' + (H - 6) + '" class="tick">' + v + (casual ? 'd' : 'h') + '</text>';
  rows.forEach((R, i) => { const y = 14 + i*RH;
    s += '<text x="' + (L - 8) + '" y="' + (y + 4) + '" class="lab">' + esc(R.label) + ' #' + (R.seed % 1000) + '</text><line x1="' + L + '" x2="' + x(casual ? R.wallEnd : R.tEnd) + '" y1="' + y + '" y2="' + y + '" class="lane"/>';
    for (const f of R.firsts) { const k = f[1][0]; s += '<circle cx="' + x(casual ? f[2] : f[0]).toFixed(1) + '" cy="' + y + '" r="2.6" fill="' + (KCOL[k] || 'var(--mute)') + '"><title>' + esc(f[1]) + ' at ' + (casual ? days(f[2]) : hrs(f[0])) + '</title></circle>'; }
    for (const fl of R.flags) { const tx = x(casual ? fl.wall : fl.t); s += '<path d="M' + tx + ' ' + (y - 9) + 'l4 6h-8z" class="fl fl-' + fl.type + '"><title>' + esc(FTYPE[fl.type][0] + ': ' + fl.msg) + '</title></path>'; }
    if (R.finished) s += '<rect x="' + (x(casual ? R.wallEnd : R.tEnd) - 3) + '" y="' + (y - 5) + '" width="6" height="10" class="done"><title>Engine reignited</title></rect>';
  });
  return s + '</svg>';
}
function spark(R){ const S = R.series; if (!S || S.length < 2) return ''; const T = S[S.length-1].t || 1, mx = Math.max(4, ...S.map(p => p.decisions)), W = 220, H = 36;
  const pts = S.map(p => (W*p.t/T).toFixed(1) + ',' + (H - 3 - (H - 6)*p.decisions/mx).toFixed(1)).join(' ');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="spark" role="img" aria-label="New decisions available over time"><polyline points="0,' + H + ' ' + pts + ' ' + W + ',' + H + '" class="area"/><polyline points="' + pts + '" class="line"/></svg>'; }

/* the three acts: tension over the life, by route */
function tension(results){
  const R0 = results.filter(R => R.arc && R.player != 'fuzzer' && !R.expectFail);
  const routes = {obey:'Obeyed the Bureau', trust:'Trusted the crew'}, col = {obey:'var(--c1)', trust:'var(--c4)'};
  const fast = R0.filter(R => R.player != 'casual'), T = Math.max(...fast.map(R => R.tEnd || 0), 3600), W = 720, H = 200, L = 34, B = 24;
  const x = t => L + (W - L - 8)*t/T, y = v => H - B - (H - B - 10)*v/100;
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tens" role="img" aria-label="Median tension over the life, by route">';
  for (let h = 0; h <= T/3600; h += 2) svg += '<line x1="' + x(h*3600) + '" x2="' + x(h*3600) + '" y1="10" y2="' + (H - B) + '" class="grid"/><text x="' + x(h*3600) + '" y="' + (H - 8) + '" class="tick">' + h + 'h</text>';
  for (const v of [0,50,100]) svg += '<line x1="' + L + '" x2="' + (W - 8) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid"/><text x="' + (L - 6) + '" y="' + (y(v) + 3) + '" class="tick" style="text-anchor:end">' + v + '</text>';
  let rows = '';
  for (const r in routes) {
    const rs = fast.filter(R => R.route == r && R.mid != null); if (!rs.length) continue;
    const pts = []; for (let t = 0; t <= T; t += 600) { const v = rs.map(R => { const p = R.series.find(p => p.t >= t); return p ? (p.strain||0) : 0; }); pts.push([t, med(v)]); }
    svg += '<polyline points="' + pts.map(([t,v]) => x(t).toFixed(1) + ',' + y(v).toFixed(1)).join(' ') + '" fill="none" stroke="' + col[r] + '" stroke-width="2"/>';
    const mm = med(rs.map(R => R.mid)), rr = med(rs.filter(R => R.resT).map(R => R.resT)), ee = med(rs.filter(R => R.finished).map(R => R.tEnd));
    for (const [t, lab] of [[mm,'midpoint'],[rr,'resolved'],[ee,'engine']]) if (t != null) svg += '<line x1="' + x(t) + '" x2="' + x(t) + '" y1="10" y2="' + (H - B) + '" stroke="' + col[r] + '" stroke-dasharray="3 3" opacity=".7"><title>' + routes[r] + ': ' + lab + ' at ' + hrs(t) + '</title></line>';
  }
  svg += '</svg>';
  const all = (r, cas) => R0.filter(R => R.route == r && (cas ? R.player == 'casual' : R.player != 'casual') && R.mid != null);
  for (const r in routes) for (const cas of [false, true]) { const rs = all(r, cas); if (!rs.length) continue; const u = cas ? (t => days(t)) : hrs, wl = (R, k) => cas ? R[k + 'Wall'] : R[k];
    const res = rs.filter(R => R.resT != null), len = res.map(R => cas ? R.resWall - R.midWall : R.resT - R.mid);
    rows += '<tr><td><b>' + routes[r] + '</b><span class="sub">' + (cas ? 'casual players' : 'attentive players') + '</span></td><td class="n">' + rs.length + '</td><td class="n">' + u(med(rs.map(R => wl(R,'mid')))) + '</td><td class="n">' + (len.length ? u(med(len)) : '—') + '</td><td class="n">' + Math.round(med(rs.map(R => R.arc.peak))) + '%</td><td class="n">' + med(rs.map(R => R.arc.lost)) + ' (max ' + Math.max(...rs.map(R => R.arc.lost)) + ')</td><td class="n">' + (r == 'obey' ? med(rs.map(R => R.arc.met)) + ' / ' + med(rs.map(R => R.arc.miss)) : '—') + '</td><td class="n">' + res.length + ' of ' + rs.length + '</td><td class="n">' + u(med(rs.filter(R => R.finished).map(R => cas ? R.wallEnd : R.tEnd))) + '</td></tr>'; }
  const legend = Object.keys(routes).map(r => '<span class="lg" style="--lc:' + col[r] + '">' + routes[r] + '</span>').join('');
  return '<div class="legend tl">' + legend + '<span>dashed lines: median midpoint, resolution and engine</span></div><div class="scroll">' + svg + '</div>' +
    '<div class="scroll"><table><thead><tr><th>Route</th><th>Lives</th><th>Midpoint at</th><th>Crisis lasted</th><th>Peak tension</th><th>Crew lost (median)</th><th>Quotas met / missed</th><th>Resolved</th><th>Engine at</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function write(file, meta, results){
  const byP = {}; for (const R of results) (byP[R.player] = byP[R.player] || []).push(R);
  /* summary */
  let sum = '<table><thead><tr><th>Player</th><th>Lives</th><th>Reached the engine</th><th>Time to engine (median)</th><th>Longest wait</th><th>Notions from trade</th><th>Findings</th><th>New decisions over time</th></tr></thead><tbody>';
  for (const p in byP) { const rs = byP[p], cas = p == 'casual', fin = rs.filter(R => R.finished);
    const tt = med(fin.map(R => cas ? R.wallEnd : R.tEnd)), lw = Math.max(...rs.map(R => gaps(R, cas)[0]));
    const fc = {}; rs.forEach(R => R.flags.forEach(f => fc[f.type] = (fc[f.type]||0) + 1));
    sum += '<tr><td><b>' + esc(rs[0].label) + '</b><span class="sub">' + esc(rs[0].desc || '') + '</span></td><td class="n">' + rs.length + '</td><td class="n">' + fin.length + ' of ' + rs.length + '</td><td class="n">' + (tt == null ? '—' : cas ? days(tt) : hrs(tt)) + '</td><td class="n">' + (cas ? days(lw) : Math.round(lw/60) + ' min') + '</td><td class="n">' + Math.round(100*(med(rs.map(R => R.tradeShare||0))||0)) + '%</td><td>' + (rs[0].expectFail ? (fin.length ? '<span class="pill pill-wall">finished, unexpectedly</span>' : '<span class="pill ok">failed, as expected</span>') : Object.keys(fc).length ? Object.entries(fc).map(([k,v]) => '<span class="pill pill-' + k + '">' + v + ' ' + FTYPE[k][0].toLowerCase() + '</span>').join(' ') : '<span class="pill ok">none</span>') + '</td><td>' + spark(rs[0]) + '</td></tr>'; }
  sum += '</tbody></table>';
  for (const p in byP) if (byP[p][0].expectFail) sum += '<p class="note"><b>' + esc(byP[p][0].label) + ':</b> ' + esc(byP[p][0].expectFail) + ' Its findings are left out below.</p>';
  /* findings, grouped by message */
  let finds = '', codes = [];
  for (const type in FTYPE) { const all = []; results.filter(R => !R.expectFail || R.finished).forEach(R => R.flags.filter(f => f.type == type).forEach(f => all.push([R, f]))); if (!all.length) continue;
    const grp = {}; for (const [R, f] of all) { const key = f.msg.replace(/\d+(\.\d+)?[KMG]?/g, '#'); (grp[key] = grp[key] || []).push([R, f]); }
    finds += '<section class="ftype"><h3><span class="pill pill-' + type + '">' + FTYPE[type][0] + '</span> ' + all.length + '</h3><p class="note">' + FTYPE[type][1] + '</p>';
    for (const key in grp) { const g = grp[key], [R, f] = g[0], players = [...new Set(g.map(x => x[0].label))];
      const ci = codes.push(f.code || '') - 1;
      finds += '<div class="find"><p><b>' + esc(f.msg) + '</b></p><p class="note">' + g.length + ' time' + (g.length > 1 ? 's' : '') + ', in ' + esc(players.join(', ')) + '. First: ' + esc(R.label) + ' #' + (R.seed % 1000) + ' at ' + (R.player == 'casual' ? days(f.wall) : hrs(f.t)) + ' of play.</p>' +
        (f.blockers ? '<ul class="block">' + f.blockers.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' : '') + (f.stack ? '<pre>' + esc(f.stack) + '</pre>' : '') +
        (f.code ? '<button type="button" class="copy" data-i="' + ci + '">Copy save code</button><span class="copied" aria-live="polite"></span>' : '') + '</div>'; }
    finds += '</section>'; }
  if (!finds) finds = '<p class="lede">No findings in this run.</p>';
  /* waste and idle Mind */
  const wr = {}; results.forEach(R => { for (const r in R.waste||{}) wr[r] = (wr[r]||[]).concat([R.waste[r]/Math.max(1, R.samples)]); });
  let waste = '<table class="narrow"><thead><tr><th>Store</th><th>Time spent full (average)</th></tr></thead><tbody>' + Object.entries(wr).map(([r,a]) => [r, a.reduce((x,y) => x + y, 0)/results.length]).sort((a,b) => b[1] - a[1]).map(([r,v]) => '<tr><td>' + esc(r == 'cycles' ? 'thought' : r) + '</td><td><div class="bar"><i style="width:' + (v*100).toFixed(0) + '%"></i></div><span class="n">' + (v*100).toFixed(0) + '%</span></td></tr>').join('') + '</tbody></table>';
  const idle = results.reduce((a,R) => a + (R.idleMind||0)/Math.max(1, R.samples), 0)/results.length;
  waste += '<p class="note">A full Mind with nothing to do: ' + (idle*100).toFixed(0) + '% of the time, on average.</p>';
  /* coverage */
  const reached = k => { const s = new Set(); results.forEach(R => (R.done && R.done[k] || []).forEach(x => s.add(x))); return s; };
  const cov = [['Discoveries and projects', G.PRJ.map(p => [p.id, p.n]), reached('projects')], ['Upgrades', G.UPG.map(u => [u.id, u.n]), reached('upgrades')], ['Buildings', Object.keys(G.BLD).map(k => [k, G.BLD[k].n]), reached('buildings')],
    ['Story chains', G.STORY.map(c => [c.id, c.id]), reached('stories')], ['Subsystems', Object.keys(G.MT).map(k => [k, G.MT[k].n]), reached('nodes')], ['Duties', Object.keys(G.DUTY).map(k => [k, G.DUTY[k].n]), reached('duties')]];
  let covH = '<table><thead><tr><th>Content</th><th>Reached by any life</th><th>Never reached</th></tr></thead><tbody>';
  for (const [n, all, got] of cov) { const miss = all.filter(([id]) => !got.has(id)); covH += '<tr><td>' + n + '</td><td class="n">' + (all.length - miss.length) + ' of ' + all.length + '</td><td>' + (miss.length ? miss.map(m => '<span class="tag">' + esc(m[1]) + '</span>').join(' ') : '<span class="pill ok">all reached</span>') + '</td></tr>'; }
  covH += '</tbody></table>';
  /* story choice comparison */
  let ab = '';
  if (byP.storyA && byP.storyB) { const a = med(byP.storyA.filter(R => R.finished).map(R => R.tEnd)), b = med(byP.storyB.filter(R => R.finished).map(R => R.tEnd)), o = byP.optimiser ? med(byP.optimiser.filter(R => R.finished).map(R => R.tEnd)) : null;
    ab = '<p class="lede">Always the first choice: ' + (a ? hrs(a) : 'did not finish') + '. Always the second: ' + (b ? hrs(b) : 'did not finish') + '. Choosing by the hints: ' + (o ? hrs(o) : '—') + '.</p><p class="note">If one side is consistently much faster, the stories have a right answer, and the choices stop being choices.</p>'; }
  const legend = Object.entries(KIND).map(([k,n]) => '<span class="lg" style="--c:' + KCOL[k] + '">' + n + '</span>').join('') + Object.entries(FTYPE).map(([k,v]) => '<span class="lg tri lg-' + k + '">' + v[0] + '</span>').join('') + '<span class="lg sq">Engine reignited</span>';

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Teaspoon Deficit Test Run</title>
<style>
:root{ /* a lab notebook: paper, ink, one teal accent; findings get their own semantic colours */
 --paper:#eef0ea; --panel:#f8f9f5; --ink:#17201c; --mute:#5a6860; --rule:#c8d0c9; --accent:#0c6a5c;
 --c1:#2254a3; --c2:#972c83; --c3:#0c6a5c; --c4:#b05e00; --c5:#1d7a3e; --c6:#b1271f; --c7:#6b5a2a;
 --crash:#b1271f; --deadlock:#7a1712; --wall:#c4541a; --grind:#8a6d00; --wait:#5a6860; --crisis:#972c83; --ok:#1d7a3e;
 --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; --sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace; }
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ color-scheme:dark; --paper:#0e1412; --panel:#151d1a; --ink:#dde6df; --mute:#8d9b93; --rule:#2b3732; --accent:#4dc3a9;
 --c1:#82b2ff; --c2:#e78cd8; --c3:#4dc3a9; --c4:#f0a23a; --c5:#6fd08c; --c6:#ff7d70; --c7:#d8c27a; --crash:#ff7d70; --deadlock:#ff9d8f; --wall:#ff9a5a; --grind:#e8c84a; --wait:#8d9b93; --crisis:#e78cd8; --ok:#6fd08c; } }
:root[data-theme="dark"]{ color-scheme:dark; --paper:#0e1412; --panel:#151d1a; --ink:#dde6df; --mute:#8d9b93; --rule:#2b3732; --accent:#4dc3a9;
 --c1:#82b2ff; --c2:#e78cd8; --c3:#4dc3a9; --c4:#f0a23a; --c5:#6fd08c; --c6:#ff7d70; --c7:#d8c27a; --crash:#ff7d70; --deadlock:#ff9d8f; --wall:#ff9a5a; --grind:#e8c84a; --wait:#8d9b93; --crisis:#e78cd8; --ok:#6fd08c; }
*{box-sizing:border-box} body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 var(--sans)}
main{max-width:1100px;margin:0 auto;padding:24px 16px 60px;display:flex;flex-direction:column;gap:28px}
h1{font:700 32px/1.1 var(--serif);margin:0;text-wrap:balance} h2{font:600 12px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--mute);margin:0 0 10px} h3{margin:0 0 4px;font:600 16px var(--sans);display:flex;gap:8px;align-items:center}
.lede{font:17px/1.45 var(--serif);max-width:68ch;margin:0} .note{color:var(--mute);font-size:13.5px;max-width:70ch;margin:2px 0}
section{display:flex;flex-direction:column;gap:8px} .scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:14px} th{text-align:left;font:600 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);border-bottom:1px solid var(--ink);padding:6px 8px} td{border-bottom:1px solid var(--rule);padding:8px;vertical-align:top}
td.n,.n{font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap} .sub{display:block;color:var(--mute);font-size:12.5px;max-width:34ch}
table.narrow{max-width:560px}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font:600 11.5px var(--mono);border:1px solid currentColor;white-space:nowrap}
.pill-crash{color:var(--crash)} .pill-deadlock{color:var(--deadlock)} .pill-wall{color:var(--wall)} .pill-grind{color:var(--grind)} .pill-wait{color:var(--wait)} .pill-crisis{color:var(--crisis)} .pill.ok{color:var(--ok)}
.tag{display:inline-block;padding:1px 6px;margin:1px;border-radius:4px;background:var(--panel);border:1px solid var(--rule);font-size:12.5px}
.find{border:1px solid var(--rule);border-left:4px solid var(--rule);border-radius:6px;background:var(--panel);padding:10px 12px;display:flex;flex-direction:column;gap:4px}
.ftype .find{border-left-color:currentColor} .ftype:has(.pill-crash) .find{color:var(--crash)} .ftype:has(.pill-deadlock) .find{color:var(--deadlock)} .ftype:has(.pill-wall) .find{color:var(--wall)} .ftype:has(.pill-grind) .find{color:var(--grind)} .ftype:has(.pill-wait) .find{color:var(--wait)}
.find p, .find ul, .find pre{color:var(--ink);margin:0} .find .note{color:var(--mute)} .block{font-size:13px;padding-left:18px} pre{font:12px/1.4 var(--mono);white-space:pre-wrap;background:var(--paper);padding:6px;border-radius:4px}
.copy{align-self:flex-start;margin-top:4px;font:13px var(--sans);padding:6px 10px;border:1px solid var(--ink);border-radius:6px;background:var(--paper);color:var(--ink);cursor:pointer} .copy:focus-visible{outline:2px solid var(--accent);outline-offset:2px} .copied{font-size:12px;color:var(--ok)}
.lanes{width:100%;min-width:640px;height:auto} .lanes .grid{stroke:var(--rule)} .lanes .tick{font:10px var(--mono);fill:var(--mute);text-anchor:middle} .lanes .lab{font:11px var(--sans);fill:var(--ink);text-anchor:end} .lanes .lane{stroke:var(--rule);stroke-width:5;stroke-linecap:round}
.fl{stroke:var(--panel);stroke-width:.5} .fl-crash{fill:var(--crash)} .fl-deadlock{fill:var(--deadlock)} .fl-wall{fill:var(--wall)} .fl-grind{fill:var(--grind)} .fl-wait{fill:var(--wait)} .fl-crisis{fill:var(--crisis)} .done{fill:var(--ink)}
.legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--mute)} .lg::before{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;background:var(--c);vertical-align:-1px}
.lg.tri::before{border-radius:0;clip-path:polygon(50% 100%,0 0,100% 0);background:var(--mute)} .lg-crash::before{background:var(--crash)!important} .lg-deadlock::before{background:var(--deadlock)!important} .lg-wall::before{background:var(--wall)!important} .lg-grind::before{background:var(--grind)!important} .lg.sq::before{border-radius:1px;background:var(--ink)}
.spark{width:220px;height:36px} .spark .line{fill:none;stroke:var(--accent);stroke-width:1.5} .spark .area{fill:color-mix(in srgb,var(--accent) 14%,transparent);stroke:none}
.bar{display:inline-block;width:200px;height:8px;background:var(--rule);border-radius:4px;overflow:hidden;vertical-align:middle;margin-right:8px} .bar i{display:block;height:100%;background:var(--accent)}
.meta{font:12px var(--mono);color:var(--mute)}
.tens{width:100%;min-width:560px;height:auto} .tens .grid{stroke:var(--rule)} .tens .tick{font:10px var(--mono);fill:var(--mute);text-anchor:middle}
.legend.tl .lg::before{background:var(--lc)}
</style></head><body><main>
<header><p class="meta">THE TEASPOON DEFICIT · TEST HARNESS · ${esc(meta.build)}</p><h1>${results.length} simulated lives</h1>
<p class="lede">Each life is a different kind of player making moves from the game's own list of legal moves. ${results.reduce((a,R) => a + R.flags.length, 0)} findings across ${Object.keys(byP).length} player types. Every finding carries a save code: paste it into the game (Menu, then Copy or load a save code) to stand at that moment.</p>
<p class="meta">${esc(meta.when.slice(0,16).replace('T',' '))} UTC · ran in ${meta.secs}s</p></header>
<section><h2>Players</h2><div class="scroll">${sum}</div><p class="note">The line in the last column is how many new things a player could choose between, over the life. Flat at zero means nothing to decide.</p></section>
<section><h2>The three acts</h2><p class="note">Median tension over a life, for each answer to the Bureau. Tension is how bad the crisis is right now: cold, hunger and drift on one route; unrest, missed quotas and the growing quota on the other. It should be near zero in Act 1, climb through Act 2, and fall away once the crisis is resolved.</p>${tension(results)}</section>
<section><h2>Findings</h2>${finds}</section>
<section><h2>Routes through the game</h2><p class="note">One row per life. Each dot is the first time something new appeared; triangles are findings. Hover for detail.</p><div class="legend">${legend}</div><div class="scroll">${lanes(results, false)}</div>${byP.casual ? '<p class="note">Casual players, in days of real time:</p><div class="scroll">' + lanes(results, true) + '</div>' : ''}</section>
${ab ? '<section><h2>Story choices</h2>' + ab + '</section>' : ''}
<section><h2>Waste</h2><p class="note">Time a store spent full, so anything more was lost. Some is fine; a store that is always full is either too small or not needed.</p>${waste}</section>
<section><h2>Coverage</h2><p class="note">Content that no simulated life reached. Either it is gated too late, or the players never chose it.</p><div class="scroll">${covH}</div></section>
</main>
<script>
const CODES = ${JSON.stringify(codes)};
document.addEventListener('click', e => { const b = e.target.closest('.copy'); if (!b) return; const code = CODES[+b.dataset.i], msg = b.nextElementSibling;
  const done = ok => { msg.textContent = ok ? ' Copied.' : ' Copy failed. Select the code below by hand.'; if (!ok && !b.parentNode.querySelector('textarea')) { const t = document.createElement('textarea'); t.value = code; t.rows = 3; t.style.width = '100%'; b.parentNode.append(t); t.select(); } };
  try { navigator.clipboard.writeText(code).then(() => done(true), () => done(false)); } catch (err) { done(false); } });
</script></body></html>`;
  fs.writeFileSync(file, html);
}
module.exports = {write};
