// Screenshots of the built page at phone and desktop sizes, from saves the bot wrote to build/.
// Usage: node tools/shot.js [names...]   (needs Playwright; CHROME=/path/to/chrome to use an installed browser)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'build'), PAGE = 'file://' + path.join(OUT, 'test.html');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME || undefined, args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const errs = [];
  async function run(name, vp, state, steps) {
    const ctx = await browser.newContext({viewport: vp, deviceScaleFactor: 2, colorScheme: name.includes('dark') ? 'dark' : 'light'});
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() == 'error' || m.text().startsWith('glok')) errs.push(name + ': ' + m.text()); });
    page.on('pageerror', e => errs.push(name + ' PAGEERROR: ' + e.message + ' | ' + (e.stack||'').split('\n').slice(1,3).join(' | ')));
    if (state) { const o = JSON.parse(fs.readFileSync(path.join(OUT, state))); o.S.t = Date.now(); await page.addInitScript(v => { localStorage.setItem('tsd2.save', v); }, JSON.stringify(o)); }
    await page.goto(PAGE); await page.waitForTimeout(700);
    if (!/memo|crisis|quota|file/.test(name)) await page.evaluate(() => { document.querySelectorAll('.back').forEach(b => b.remove()); });
    if (steps) await steps(page);
    await page.waitForTimeout(500);
    await page.screenshot({path: path.join(OUT, 'shot_' + name + '.png')});
    await ctx.close();
  }
const arcSet = 'const S = __tsd.S; S.arc.ph = 0; S.arc.files = []; S.arc.unread = 0; delete S.done.orbital; delete S.seen.stage2; S.b.antenna = Math.max(1, S.b.antenna||0); S.here = S.age;';
  const P = {width: 390, height: 844}, D = {width: 1280, height: 820};
  const jobs = {
    fresh: () => run('fresh', P, null, async p => { for (let i = 0; i < 12; i++) await p.click('.hand.prime'); await p.click('text=Pry scrap'); }),
    hull: () => run('hull', P, 'state_0.5h.json'),
    crew: () => run('crew', P, 'state_4h.json', async p => { await p.evaluate(() => { const S = __tsd.S; S.st.cur = {ch:'mindcrew', s:0, w:0, age:0}; }); await p.click('#tab-crew'); await p.evaluate(() => document.querySelector('#main').scrollTop = 0); }),
    duties: () => run('duties', P, 'state_9h.json', async p => { await p.click('#tab-crew'); await p.evaluate(() => { const d = [...document.querySelectorAll('h2')].find(x => x.textContent == 'Duties'); if (d) d.scrollIntoView(); }); }),
    shop: () => run('shop', P, 'state_9h.json', async p => { await p.click('#tab-shop'); }),
    mind: () => run('mind', P, 'state_9h.json', async p => { await p.click('#tab-mind'); await p.evaluate(() => { const c = document.querySelector('.mindcv'); c.scrollIntoView(); }); }),
    mind_dark: () => run('mind_dark', P, 'state_4h.json', async p => { await p.click('#tab-mind'); await p.evaluate(() => { __tsd.S.mp = 1; __tsd.frameUI(); }); await p.click('text=Requisition a subsystem'); }),
    desk: () => run('desk', D, 'state_9h.json', async p => { await p.click('#tab-mind'); }),
    desk_dark: () => run('desk_dark', D, 'state_9h.json', async p => { await p.click('#tab-crew'); }),
    sky: () => run('sky_big', P, 'state_9h.json', async p => { await p.evaluate(() => { const S = __tsd.S; S.age = Math.floor(S.age/800)*800 + 450; S.r.scrap = 500; console.log('glok', __tsd.Sky.ok); }); await p.waitForTimeout(300); await p.mouse.click(120, 90); await p.waitForTimeout(800); }),
    sky_desk: () => run('sky_desk', D, 'state_9h.json', async p => { await p.evaluate(() => { const S = __tsd.S; S.age = Math.floor(S.age/800)*800 + 450; S.r.scrap = 500; }); await p.mouse.click(300, 90); await p.waitForTimeout(800); }),
    store: () => run('store', P, 'state_9h.json', async p => { await p.click('.r-lichen'); }),
    hutitem: () => run('hutitem', P, 'state_9h.json', async p => { await p.click('#tab-hull'); await p.click('.item:has(.act:has-text("Moss hut")) .more'); await p.evaluate(() => document.querySelector('.item:has(.more.on)').scrollIntoView()); }),
    memo: () => run('memo', P, 'state_9h.json', async p => { await p.evaluate(arcSet); await p.waitForTimeout(1500); }),
    memo_dark: () => run('memo_dark', P, 'state_9h.json', async p => { await p.evaluate(arcSet); await p.waitForTimeout(1500); await p.evaluate(() => document.querySelector('.sheet').scrollTop = 999); }),
    dark_sheet: () => run('crisis', P, 'state_9h.json', async p => { await p.evaluate(arcSet); await p.waitForTimeout(1500); await p.click('text=Trust the crew'); await p.evaluate(() => { const S = __tsd.S; S.arc.dt = 7000; S.here = S.age; }); await p.waitForTimeout(1200); await p.click('#arcbar'); await p.waitForTimeout(800); }),
    quota: () => run('quota', P, 'state_9h.json', async p => { await p.evaluate(arcSet); await p.waitForTimeout(1500); await p.click('text=Obey the Bureau'); await p.waitForTimeout(1500); await p.click('text=File it'); await p.click('#tab-hull'); await p.waitForTimeout(600); }),
    file: () => run('file', D, 'state_9h.json', async p => { await p.evaluate(arcSet); await p.waitForTimeout(1500); await p.click('text=Obey the Bureau'); await p.waitForTimeout(1200); await p.click('text=File it'); await p.evaluate(() => { __tsd.S.seen.chrono = 1; }); if (await p.$('#tab-rec')) await p.click('#tab-rec'); await p.waitForTimeout(500); }),
    trade: () => run('trade', P, 'state_9h.json', async p => { await p.evaluate(() => { const S = __tsd.S; S.b.antenna = 3; S.hails = 3; S.r.ledger = 10; __tsd.trade(S,'quorate'); __tsd.trade(S,'quorate'); __tsd.frameUI(); }); await p.click('#tab-trade'); }),
    mindtask: () => run('mindtask', P, 'state_9h.json', async p => { await p.click('#tab-mind'); await p.evaluate(() => { const S = __tsd.S; S.mind.task = 'dream'; S.r.cycles = 1e9; __tsd.frameUI(); [...document.querySelectorAll('h2')].find(x => x.textContent == 'Spare thought').scrollIntoView(); }); }),
    walk: () => run('walk', P, 'state_9h.json', async p => { for (const t of ['hull','shop','crew','sci','mind','trade','time','margin','rec']) { if (await p.$('#tab-' + t)) { await p.click('#tab-' + t); await p.waitForTimeout(150); } } }),
  };
  const want = process.argv.slice(2);
  for (const k in jobs) if (!want.length || want.includes(k)) await jobs[k]();
  console.log(errs.length ? errs.join('\n') : 'no console errors');
  await browser.close();
})();
