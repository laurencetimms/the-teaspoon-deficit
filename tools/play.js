// Scripted tap-through: the opening by hand, then the new systems, then away time and a reload.
const { chromium } = require('playwright'); const path = require('path');
const OUT = path.join(__dirname, '..', 'build');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME || undefined, args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const ctx = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2, hasTouch:true});
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() == 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('file://' + path.join(OUT, 'test.html')); await page.waitForTimeout(400);
  const tap = async (sel, n = 1) => { for (let i = 0; i < n; i++) await page.click(sel, {timeout: 3000}); };
  const st = () => page.evaluate(() => { const S = __tsd.S; return {made: Math.round(S.made), pop: S.crew.length, b: S.b, scav: S.crew.filter(t => t.j == 'scav').length, mand: S.mand, nodes: S.mind.nodes.length}; });
  const skip = s => page.evaluate(s => { __tsd.simulate(__tsd.S, s); __tsd.frameUI(); }, s);
  await tap('.hand.prime', 10); await tap('text=Pry scrap', 8); await tap('.hand.prime', 6);
  await tap('text=Scrape lichen', 14); await tap('.act:has-text("Lichen bed")'); await tap('text=Pry scrap', 10); await tap('.act:has-text("Moss hut")');
  await tap('text=Scrape lichen', 10); await skip(40);
  await tap('#tab-crew'); await tap('.job .pm >> nth=1'); console.log('opening:', JSON.stringify(await st()));
  await tap('#tab-hull'); await tap('text=Pry scrap', 20); await tap('.hand.prime', 20); await tap('.act:has-text("Stamping press")');
  await page.evaluate(() => { __tsd.S.r.scrap = 100; }); await tap('.hand.prime', 40); await page.waitForTimeout(1300); await tap('#tab-mind'); await tap('text=Requisition a subsystem'); await tap('.offer .opt >> nth=0');
  console.log('mind:', JSON.stringify(await st()));
  await page.mouse.click(195, 700); // tap the diagram
  await page.mouse.click(150, 60); await page.waitForTimeout(500); await page.mouse.click(150, 60); // expand and close the view
  await tap('.r-cycles'); await tap('.sheet .chip.wide');
  // give it a working colony, then try the story, the workshop and duties
  await page.evaluate(() => { const S = __tsd.S; S.r.notions = 500; S.r.scrap = 400; S.b.nook = 2; S.b.locker = 3; S.done.calendar = S.done.craft = S.done.delegation = S.done.philosophy = 1; for (let i = 0; i < 10; i++) S.crew.push({n:'Test ' + i, t:'clumsy', j:'grazer', x:{}, d:''}); S.b.hut = 6; S.hand.stamp = 200; S.st.cur = {ch:'who', s:0, w:0, age:0}; __tsd.checks(S); __tsd.frameUI(); });
  await tap('#tab-crew'); await tap('.opts .opt >> nth=0');
  await tap('.duty .pm >> nth=1'); await tap('.duty .pm >> nth=1'); await skip(1800);
  await page.screenshot({path: path.join(OUT, 'play_duties.png')});
  await page.evaluate(() => { __tsd.S.b.bench = 1; __tsd.S.r.scrap = 900; __tsd.frameUI(); }); await tap('#tab-shop'); await tap('.craft .chip >> nth=2');
  console.log('after story, duty and craft:', await page.evaluate(() => JSON.stringify({plate: __tsd.S.r.plate, rota: __tsd.S.duty.stamp, flagwho: __tsd.S.st.flags.who})));
  // away for three hours, then reload from storage
  await page.evaluate(() => { __tsd.S.t = Date.now() - 3*3600e3; localStorage.setItem('tsd2.save', JSON.stringify({S:__tsd.S, M:__tsd.M})); window.onbeforeunload = null; });
  const saved = await page.evaluate(() => localStorage.getItem('tsd2.save'));
  await page.addInitScript(v => { if (!sessionStorage.getItem('once')) { sessionStorage.setItem('once','1'); localStorage.setItem('tsd2.save', v); } }, saved);
  await page.reload(); await page.waitForTimeout(700); console.log('after 3h away:', JSON.stringify(await st()));
  await page.screenshot({path: path.join(OUT, 'play_back.png')});
  console.log(errs.length ? errs.join('\n') : 'no console errors'); await browser.close();
})();
