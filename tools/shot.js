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
    page.on('console', m => { if (m.type() == 'error') errs.push(name + ': ' + m.text()); });
    page.on('pageerror', e => errs.push(name + ' PAGEERROR: ' + e.message + ' | ' + (e.stack||'').split('\n').slice(1,3).join(' | ')));
    if (state) { const o = JSON.parse(fs.readFileSync(path.join(OUT, state))); o.S.t = Date.now(); await page.addInitScript(v => { localStorage.setItem('tsd2.save', v); }, JSON.stringify(o)); }
    await page.goto(PAGE); await page.waitForTimeout(700);
    if (steps) await steps(page);
    await page.waitForTimeout(500);
    await page.screenshot({path: path.join(OUT, 'shot_' + name + '.png')});
    await ctx.close();
  }
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
    walk: () => run('walk', P, 'state_9h.json', async p => { for (const t of ['hull','shop','crew','sci','mind','trade','time','margin','rec']) { if (await p.$('#tab-' + t)) { await p.click('#tab-' + t); await p.waitForTimeout(150); } } }),
  };
  const want = process.argv.slice(2);
  for (const k in jobs) if (!want.length || want.includes(k)) await jobs[k]();
  console.log(errs.length ? errs.join('\n') : 'no console errors');
  await browser.close();
})();
