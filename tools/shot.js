const { chromium } = require('playwright');
const fs = require('fs');
const OUT = require('path').join(__dirname, '..', 'build');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME || undefined, args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const errs = [];
  async function run(name, vp, state, steps) {
    const ctx = await browser.newContext({viewport: vp, deviceScaleFactor: 2, colorScheme: name.includes('dark') ? 'dark' : 'light'});
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() == 'error') errs.push(name + ': ' + m.text()); });
    page.on('pageerror', e => errs.push(name + ' PAGEERROR: ' + e.message + '\n' + (e.stack||'').split('\n').slice(0,4).join('\n')));
    if (state) { const o = JSON.parse(fs.readFileSync(state)); o.S.t = Date.now(); await page.addInitScript(v => { localStorage.setItem('tsd1.save', v); }, JSON.stringify(o)); }
    await page.goto('file://' + require('path').join(__dirname, '..', 'build', 'test.html'));
    await page.waitForTimeout(600);
    if (steps) await steps(page);
    await page.waitForTimeout(500);
    await page.screenshot({path: OUT + '/shot_' + name + '.png'});
    await ctx.close();
  }
  const which = process.argv[2] || 'all';
  const M = {width: 390, height: 760}, D = {width: 1280, height: 800};
  const jobs = {
    fresh: () => run('fresh', M, null, async p => { for (let i = 0; i < 12; i++) await p.click('.hand.prime'); await p.click('text=Pry scrap'); }),
    p1: () => run('p1', M, OUT + '/state_p1.json', async p => { await p.click('.item .more >> nth=1'); }),
    p1crew: () => run('p1crew', M, OUT + '/state_p1.json', async p => { await p.click('#tab-crew'); }),
    p1mind: () => run('p1mind_dark', M, OUT + '/state_p1.json', async p => { await p.click('#tab-mind'); }),
    p2: () => run('p2_desktop', D, OUT + '/state_p2.json', async p => { await p.evaluate(() => { __tsd.S.comet = 12; }); }),
    p3: () => run('p3', M, OUT + '/state_p3.json', async p => { await p.click('#tab-ladles'); }),
    p3d: () => run('p3_desktop_dark', D, OUT + '/state_p3.json', async p => { await p.click('#tab-margin'); }),
    walk: () => run('walk', M, OUT + '/state_p3.json', async p => { for (const t of ['hull','crew','sci','mind','trade','ladles','time','margin','rec']) { await p.click('#tab-' + t); await p.waitForTimeout(150); } await p.click('#menu'); await p.waitForTimeout(100); await p.click('text=Copy or load a save code'); }),
    end: () => run('end', M, OUT + '/state_p3.json', async p => { await p.evaluate(() => { const S = __tsd.S; S.made = 7.3e27 - 5; S.r.scrap = 1e9; }); await p.waitForTimeout(800); await p.click('#tab-hull'); await p.waitForTimeout(300); await p.screenshot({path:OUT + '/shot_end_a.png'}); await p.click('.last'); await p.waitForTimeout(300); }),
  };
  for (const k in jobs) if (which == 'all' || which.split(',').includes(k)) await jobs[k]();
  console.log(errs.length ? errs.join('\n') : 'no console errors');
  await browser.close();
})();
