// A scripted first ten minutes with real taps, then pause, away-time, petition, trade, pedlar and a new life.
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, '..', 'build');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME || undefined, args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const ctx = await browser.newContext({viewport:{width:390,height:760}, deviceScaleFactor:2, hasTouch:true});
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() == 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + (e.stack||'').split('\n').slice(0,3).join(' | ')));
  await page.goto('file://' + require('path').join(__dirname, '..', 'build', 'test.html')); await page.waitForTimeout(400);
  const tap = async (sel, n=1) => { for (let i = 0; i < n; i++) await page.click(sel, {timeout:3000}); };
  const st = () => page.evaluate(() => { const S = __tsd.S; return {made:S.made, pop:S.pop, b:S.b, r:S.r, jobs:S.jobs, bank:S.bank, age:S.age}; });
  const skip = s => page.evaluate(s => { __tsd.simulate(__tsd.S, s); __tsd.frameUI(); }, s);
  await tap('.hand.prime', 10); await tap('text=Pry scrap', 6); await tap('.hand.prime', 4);
  await tap('text=Scrape lichen', 14); await tap('.act:has-text("Lichen bed")'); await tap('text=Pry scrap', 10); await tap('.act:has-text("Moss hut")');
  await tap('text=Scrape lichen', 10); await skip(30); console.log('after hut', JSON.stringify(await st()));
  await page.screenshot({path:OUT + '/play_1.png'});
  await tap('#tab-crew'); await tap('.job .pm >> nth=1'); console.log('jobs', JSON.stringify((await st()).jobs));
  await tap('#tab-hull'); await tap('text=Pry scrap', 25); await tap('.hand.prime', 12); await tap('.act:has-text("Stamping press")');
  await tap('text=Pry scrap', 20); await tap('.hand.prime', 20); await page.waitForTimeout(1200); await tap('#tab-mind'); await page.screenshot({path:OUT + '/play_2.png'}); await tap('.act:has-text("Processor")');
  // pause banks time, and actions are refused
  await tap('#pause'); await page.waitForTimeout(700); await tap('#tab-hull'); await tap('.hand.prime'); const a = await st(); await page.waitForTimeout(400); const b = await st();
  console.log('paused: age moved', b.age - a.age, 'bank', b.bank.toFixed(2)); await tap('#pause');
  // come back after three hours away
  await page.evaluate(() => { __tsd.S.t = Date.now() - 3*3600e3; localStorage.setItem('tsd1.save', JSON.stringify({S:__tsd.S, M:__tsd.M})); });
  await page.evaluate(() => { window.onpagehide = null; }); 
  const saved = await page.evaluate(() => localStorage.getItem('tsd1.save'));
  await page.addInitScript(v => { if (!sessionStorage.getItem('once')) { sessionStorage.setItem('once','1'); localStorage.setItem('tsd1.save', v); } }, saved);
  await page.reload(); await page.waitForTimeout(600); console.log('after 3h away', JSON.stringify(await st())); await page.screenshot({path:OUT + '/play_3.png'});
  // force a petition, the pedlar, and an antenna
  await page.evaluate(() => { const S = __tsd.S; S.done.philosophy = 1; S.pet = 4; S.petLeft = 200; S.b.antenna = 3; S.pedlar = 100; S.r.spoons = 1e5; S.r.whimsy = 100; __tsd.frameUI(); });
  await tap('#tab-crew'); await page.screenshot({path:OUT + '/play_4.png'}); await tap('text=Attend');
  await tap('#tab-trade'); await tap('text=Hail The Gravel Choir'); await tap('text=Buy an antique spoon'); await tap('text=Buy a loose page'); await page.screenshot({path:OUT + '/play_5.png'});
  // an early ending and a new life with a quirk
  await page.evaluate(() => { const S = __tsd.S; S.done.orbital = 1; S.accord = 95; S.accMod = 30; S.pop = 45; S.jobs.bard = 12; S.jobs.grazer = 33; S.seen.mind = 1; S.r.whimsy = 500; __tsd.frameUI(); });
  await tap('#tab-mind'); await tap('text=Decline the call'); await page.waitForTimeout(200); await page.screenshot({path:OUT + '/play_6.png'});
  await tap('text=Begin a new life'); await page.waitForTimeout(200); await page.screenshot({path:OUT + '/play_7.png'}); await tap('.sheet .chip >> nth=0'); await page.waitForTimeout(300);
  console.log('new life', JSON.stringify(await st()), await page.evaluate(() => JSON.stringify({q:__tsd.S.quirk, runs:__tsd.M.runs, ends:__tsd.M.endings, heir:__tsd.S.heir})));
  await page.screenshot({path:OUT + '/play_8.png'});
  console.log(errs.length ? errs.join('\n') : 'no console errors');
  await browser.close();
})();
