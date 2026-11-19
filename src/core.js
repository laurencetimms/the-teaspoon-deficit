'use strict';
/* ===== THE TEASPOON DEFICIT, stage one: game rules (no DOM in this file) ===== */
const DEFICIT = 7.3e27, DAY = 2, SEASON_LEN = 200;
const SEASONS = [{n:'Perihelion',m:1.5,w:'warm'},{n:'Outswing',m:1,w:''},{n:'Aphelion',m:0.25,w:'cold'},{n:'Inswing',m:1,w:''}];
/* all randomness goes through rand(), so the test harness can seed it and replay a life exactly */
let rand = Math.random;
function setSeed(seed){ let a = seed >>> 0; rand = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = (a,b) => a + rand()*(b-a), pick = a => a[Math.floor(rand()*a.length)];
const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
let M = null;            // meta: survives across lives
let hook = () => {};     // ui feedback

/* ---------- names ---------- */
const NAMEP = [
 [['Technically','Arguably','Broadly','Provisionally','Mostly','Nominally','Reasonably Sure This Is'],['Within Tolerance','Fine','On Schedule','A Ship','Load-Bearing','Accounted For','Somebody Else’s Job']],
 [['The Unanswerable','Thunderous','Last Great','Inevitable','Sovereign','Incandescent','Magnificent And Final'],['Teaspoon','Rounding Error','Inventory','Afterthought','Paperweight','Drawer','Clerical Oversight']],
 [['Sorry About','Please Ignore','Regrettably,','Do Excuse','Awfully Sorry For','We Meant To Mention','Nobody Warned Us About'],['The Noise','The Hull','Last Tuesday','The Smell Of Lichen','All The Spoons','What Happened','The Forks']]];
const shipName = tag => { const t = tag == null ? Math.floor(rand()*3) : tag; return {n: pick(NAMEP[t][0]) + ' ' + pick(NAMEP[t][1]), t}; };
const TN1 = ['Mossy','Pip','Dew','Lumen','Burr','Fen','Odo','Quill','Rime','Sorrel','Wick','Nub','Bram','Tansy','Ember','Plum','Hob','Teasel','Clem','Moth','Sedge','Poppet','Orris','Juniper','Barley','Nettle','Wren','Coble'];
const TN2 = ['Eightlegs','Slowstep','Dampfoot','Underleaf','Longnap','Softclaw','Driftwater','Hullwarm','Crumb','Thimble','Rivetsby','Tunwise','Mosswright','Coldtoe','Halfspoon','Bowlby'];

/* ---------- crew: traits, trades, skill ---------- */
const TRAITS = {
 diligent:['Diligent','Works 10% harder.'], dreamy:['Dreamy','Learns duties 30% faster; works 5% less.'], clumsy:['Clumsy','Makes more mistakes and learns twice as much from each.'],
 kind:['Kind','Raises accord a little, just by being there.'], hungry:['Hungry','Eats half as much again.'], sharp:['Sharp-eyed','Finds 10% more on salvage and in the sky.'], steady:['Steady','Never panics during a glitch.']};
const JOBS = {
 grazer: {n:'Grazer', d:'Tends lichen. Everyone without another trade grazes.', req:S=>1},
 scav:   {n:'Scavenger', d:'Pries scrap from the hull.', req:S=>1},
 scholar:{n:'Scholar', d:'Has notions. Needs a Reading nook to keep them in.', req:S=>nb(S,'nook')>=1},
 icer:   {n:'Icer', d:'Chips frost from the shadow side of the hull.', req:S=>S.done.condense},
 tinker: {n:'Tinker', d:'Fusses over presses and benches. Each adds 3% to spoon yield and 2% to crafting.', req:S=>S.done.metallurgy},
 bard:   {n:'Bard', d:'Describes work instead of doing it. Comfort +1 each, and a little whimsy.', req:S=>S.done.philosophy}};
const LVLN = ['Green','Handy','Practised','Seasoned','Expert','Venerable'];
const lvl = x => Math.min(20, Math.floor(Math.sqrt((x||0)/400)));
const lvlName = l => LVLN[Math.min(5, Math.floor(l/4))];
function newTardi(){ return {n: pick(TN1) + ' ' + pick(TN2), t: pick(Object.keys(TRAITS)), j: 'grazer', x: {}, d: ''}; }

/* ---------- quirks and helpers ---------- */
const QK = {
 long:{n:'Long year',d:'Seasons last twice as long.',year:2},
 seam:{n:'Rich seam',d:'Scrap ×2. Lichen grows 30% slower.',scrap:2,lichen:0.7},
 chatty:{n:'Chatty mind',d:'Whimsy ×3. The Mind thinks 30% slower.',whim:3,cyc:0.7},
 dense:{n:'Dense moss',d:'Huts hold one more. Everyone eats 25% more.',berth:1,eat:1.25},
 pet:{n:'Bureau favourite',d:'Mandate arrives 40% sooner. Accord settles 10 lower.',mand:0.6,acc:-10},
 alley:{n:'Comet alley',d:'Comets come four times as often.',comet:0.25},
 quick:{n:'Quick studies',d:'Duties learn twice as fast. Trades level half as fast.',learn:2,skill:0.5},
 friends:{n:'Old friends',d:'Hails recharge twice as fast, and neighbours pay 50% more.',hail:2,trade:1.5}};
const nb = (S,id) => S.b[id] || 0;
const qk = S => QK[S.quirk] || {};
const canPay = (S,c) => { for (const r in c) if ((S.r[r]||0) < c[r] - 1e-9) return false; return true; };
const pay = (S,c) => { for (const r in c) S.r[r] = Math.max(0, (S.r[r]||0) - c[r]); };
const add = (S,r,x,c) => { S.r[r] = (S.r[r]||0) + x; const cp = capOf(S, c || calc(S), r); if (S.r[r] > cp) S.r[r] = cp; };
function log(S, msg, kind){ S.log.push({a:S.age, m:msg, k:kind||''}); if (S.log.length > 90) S.log.shift(); }
function seasonLen(S){ return SEASON_LEN * (qk(S).year || 1); }
function cal(S){ const sl = seasonLen(S); return {i:Math.floor(S.age/sl)%4, year:Math.floor(S.age/(4*sl)), day:Math.floor((S.age%sl)/DAY)+1, frac:(S.age%(4*sl))/sl}; }
function thr(S){ let f = qk(S).mand || 1; for (const n of S.mind.nodes) if (n.k == 'bureau') f *= Math.pow(0.96, n.lv); return 50 * Math.pow(2.1, S.mand) * f; }
function capOf(S, c, r){ return c.caps[r] != null ? c.caps[r] : Infinity; }

function newMeta(){ return {runs:0, endings:{}, ach:{}, guide:{}}; }
function newState(quirk){
  const hz = {}; for (const k in M.endings) hz[k] = 1;
  const S = {v:2, t:Date.now(), age:0, pop:0, ship:shipName(), renames:0, paused:0,
    r:{lichen:0, scrap:10, spoons:0, ice:0, notions:0, cycles:0, whimsy:0, plate:0, wire:0, spring:0, gear:0, lens:0, ledger:0, tea:0, grit:0, spores:0, footnotes:0},
    made:0, hand:{stamp:0, pry:0, scrape:0, craft:0}, b:{}, up:{}, done:{}, seen:{}, crew:[], tun:0, tunT:0, arr:0, share:0.5,
    mand:0, mp:0, accord:60, accMod:0, fest:0, weather:0, hails:3, stand:{choir:0, bloom:0, quorate:0}, traded:{},
    pedlar:0, pedT:rnd(500,800), comet:0, cometT:rnd(120,200), comets:0,
    st:{cur:null, done:{}, step:{}, flags:{}, nextT:rnd(150,240), last:[], ign:0, wait:{}},
    duty:{}, keep:{}, mind:{nodes:[{k:'stem', lv:1, p:-1, cond:1, v:1}], task:'idle', coach:'', dream:0, dreams:0, fc:0, heat:0, offer:null, ct:0, trial:null, sulk:{}, glT:0, sockT:0, temp:{}, sel:0},
    lastAct:0, taste:Math.floor(rand()*3), cand:null, fleet:[], goodNames:0,
    m:{graze:1,bed:1,scav:1,press:1,yield:1,craft:1,smelt:1,notion:1,ice:1,cond:1,kettle:1,warm:1,fuel:1,cap:1,icecap:1,ncap:1,lcap:1,learn:1,comfort:1,hail:1,obs:1,mind:1,hand:1,berth:0,rota:1,stem:1,hcap:1,bunk:1,rackB:5,warrenB:4},
    tmpm:[], accPerm:0, quirk:quirk||'', heir:hz, log:[], ended:'', bank:0, flux:0, sunTaps:0, _sp:0, _used:0, acts:0};
  if (hz.small) { S.b.hut = 2; S.b.bed = 1; S.seen.lichen = 1; }
  return S;
}

/* ---------- buildings ---------- */
const BLD = {
 bed:{n:'Lichen bed',d:'A scraped patch of hull where lichen takes hold. Grows with the seasons.',c:{lichen:10},k:1.12,e:'+0.25 lichen/s in fair weather',req:S=>S.seen.lichen},
 hut:{n:'Moss hut',d:'Damp, dark and exactly right. Tardigrades wake when there is somewhere to live and something to eat.',c:{scrap:8},k:1.7,e:'+2 berths',req:S=>nb(S,'bed')>=1},
 press:{n:'Stamping press',d:'Stamps spoons from scrap without being asked.',c:{spoons:20},k:1.12,e:'turns 0.5 scrap/s into spoons',req:S=>S.made>=12},
 locker:{n:'Locker',d:'Somewhere to put things, so that there can be more things.',c:{scrap:40},k:1.2,e:'+150 scrap, +1.5K lichen and +100 ice storage',req:S=>nb(S,'hut')>=2},
 nook:{n:'Reading nook',d:'A dry corner where scholars keep their notions.',c:{scrap:25},k:1.15,e:'+250 notion storage, scholars +5%',req:S=>S.pop>=2},
 bench:{n:'Workbench',d:'Somewhere to hammer things flat. Opens the Workshop.',c:{scrap:60,spoons:40},k:1.25,e:'crafting +6%',req:S=>S.done.craft},
 cond:{n:'Condenser',d:'A cold plate in the shadow. Frost grows on it, faster in the cold season.',c:{scrap:50,plate:2},k:1.15,e:'+0.08 ice/s, doubled at Aphelion',req:S=>S.done.condense},
 cellar:{n:'Ice cellar',d:'A cold hole. Keeps ice, and lichen keeps better in it.',c:{scrap:80,plate:3},k:1.2,e:'+300 ice and +500 lichen storage',req:S=>S.done.condense},
 smelter:{n:'Smelter',d:'Eats scrap, sweats plate.',c:{plate:5,spoons:60},k:1.15,e:'turns 1 scrap/s into plate, using only scrap above half the store',req:S=>S.done.smelting},
 kettle:{n:'Kettle-house',d:'Brews lichen and ice into something the crew insist on calling tea.',c:{plate:8,ice:50},k:1.15,e:'turns 0.5 lichen and 0.2 ice/s into tea (pauses when lichen stores fall below 30%)',req:S=>S.done.brewing},
 boiler:{n:'Boiler',d:'Burns scrap to keep the huts warm through Aphelion.',c:{plate:15,scrap:200},k:1.15,e:'+2 warmth; burns 0.2 scrap/s at Aphelion',req:S=>S.done.boilers},
 school:{n:'Schoolroom',d:'A room for learning things on purpose.',c:{plate:10,notions:200},k:1.2,e:'duties learn 15% faster',req:S=>S.done.pedagogy},
 rack:{n:'Tun-rack',d:'Bunks, eight legs deep, in the old cutlery hold.',c:{scrap:300,plate:25},k:1.45,e:'+5 berths',req:S=>S.done.survey},
 antenna:{n:'Antenna',d:'Bent from spoon handles. Lets you hail passing traffic.',c:{plate:20,wire:10},k:1.5,e:'+1 hail and a new neighbour',req:S=>S.done.signal},
 obs:{n:'Observatory',d:'A hole with a lens in it. Catches some comets on its own.',c:{plate:30,lens:4},k:1.25,e:'+2.5K notion storage, +0.1 notions/s',req:S=>S.done.astronomy},
 band:{n:'Bandstand',d:'For the bards, who were going to perform anyway.',c:{plate:25,wire:5},k:1.3,e:'comfort +2',req:S=>S.done.music},
 shelf:{n:'Ledger shelves',d:'Floor-to-ceiling, then a bit more.',c:{plate:15,ledger:2},k:1.2,e:'+1.5K notion storage',req:S=>S.done.bookkeeping},
 mill:{n:'Drawing mill',d:'Pulls plate into wire, slowly, with a noise like a cat.',c:{plate:40,gear:2},k:1.15,e:'turns plate into wire',req:S=>S.done.drawmill},
 bunker:{n:'Scrap bunker',d:'A sealed hold for scrap, lined with plate so it does not wander off.',c:{plate:40,spring:4},k:1.25,e:'+1.5K scrap storage',req:S=>S.done.springs},
 warren:{n:'Warren',d:'Dug by the crew themselves, into the old insulation. They will not let you see the plans.',c:{lichen:1500,plate:12},k:1.3,e:'+4 berths',req:S=>S.st.flags.homes},
 garden:{n:'Moss garden',d:'Ornamental lichen. Grown from neighbours’ spores, for looking at.',c:{spores:3,plate:10},k:1.2,e:'comfort +3, +0.4 lichen/s',req:S=>S.done.gardening}};
const scrapCap = S => (100 + 150*nb(S,'locker') + 1500*nb(S,'bunker')*S.m.bunk)*S.m.cap;
/* a building never asks for more scrap than 40% of what you can store (smelters take everything above half): the rest is asked in plate, 50 scrap to a plate */
function bcost(S, id, q, raw){ const d = BLD[id], n = nb(S,id), o = {}; const f = Math.pow(d.k,n) * (Math.pow(d.k,q)-1)/(d.k-1); for (const r in d.c) o[r] = d.c[r]*f;
  if (!raw && o.scrap) { const lim = scrapCap(S)*0.4; if (o.scrap > lim) { o.plate = (o.plate||0) + (o.scrap - lim)/50; o.scrap = lim; } }
  return o; }
function buy1cost(S, id){ return bcost(S, id, 1); }
function buy(S, id, q){
  if (!BLD[id].req(S)) return 0;
  let got = 0; q = q || 1;
  while (got < q && got < 500) { const c = buy1cost(S,id); if (!canPay(S,c)) break; pay(S,c); S.b[id] = nb(S,id)+1; got++; }
  if (got && id == 'bench' && nb(S,'bench') == got) log(S,'The Workshop is open. Scrap can be hammered into plate.','big');
  hook(got ? 'buy' : 'fail'); return got;
}

/* ---------- workshop: crafts and upgrades ---------- */
const CRAFT = {
 plate:{n:'Plate',c:{scrap:50},d:'Hammered flat. The basis of anything sturdier than a hut.',req:S=>S.done.craft},
 wire:{n:'Wire',c:{plate:2},d:'Plate, persuaded to be long.',req:S=>S.done.wiredraw},
 tea:{n:'Tea',c:{lichen:60,ice:15},d:'Comfort in a cup. The crew drink it slowly and constantly.',req:S=>S.done.brewing},
 lens:{n:'Lens',c:{ice:40,grit:1},d:'Ice, ground with grit and held very still until it agrees to stay clear.',req:S=>S.done.lensgrind},
 spring:{n:'Spring',c:{wire:3},d:'Wire with a sense of humour.',req:S=>S.done.springs},
 ledger:{n:'Ledger',c:{plate:5,notions:150},d:'A notion, pressed into metal so it cannot wander off.',req:S=>S.done.bookkeeping},
 gear:{n:'Gear',c:{plate:2,spring:1},d:'A wheel with opinions about other wheels.',req:S=>S.done.gears}};
const craftYield = (S,c) => S.m.craft * (1 + 0.06*nb(S,'bench')) * (1 + 0.02*c.J.tinker);
function craft(S, id, q){
  const d = CRAFT[id]; if (!d.req(S)) return hook('fail');
  let n = 0; q = q || 1; const c = calc(S);
  while (n < q && n < 10000 && canPay(S,d.c)) { pay(S,d.c); n++; }
  if (!n) return hook('fail');
  S.r[id] += n*craftYield(S,c); S.hand.craft += n; S.lastAct = S.age; hook('buy'); return n;
}
function craftMax(S, id){ const d = CRAFT[id]; let n = Infinity; for (const r in d.c) n = Math.min(n, Math.floor((S.r[r]||0)/d.c[r])); return n; }
const mulf = (k,x) => S => { S.m[k] *= x; };
function tmpMul(S, k, x, dur){ S.m[k] *= x; S.tmpm.push([k, x, S.age + dur]); }
const UPG = [
 {id:'rakes',n:'Raked beds',d:'Lichen beds +25%.',c:{plate:5},req:S=>S.done.craft&&nb(S,'bed')>=5,fx:mulf('bed',1.25)},
 {id:'hafts',n:'Long hafts',d:'Scavengers +15%.',c:{plate:5},req:S=>S.done.craft,fx:mulf('scav',1.15)},
 {id:'slats',n:'Slatted lockers',d:'Lockers hold 25% more.',c:{plate:8},req:S=>S.done.craft&&nb(S,'locker')>=3,fx:mulf('cap',1.25)},
 {id:'hoes',n:'Spoon hoes',d:'Grazers +25%.',c:{spoons:300,plate:4},req:S=>S.done.craft,fx:mulf('graze',1.25)},
 {id:'vice',n:'Bench vice',d:'Crafting +10%.',c:{plate:15},req:S=>nb(S,'bench')>=1,fx:mulf('craft',1.1)},
 {id:'oil',n:'Oiled presses',d:'Presses +25%.',c:{plate:6},req:S=>S.done.metallurgy,fx:mulf('press',1.25)},
 {id:'dies',n:'Hardened dies',d:'Presses +50%.',c:{plate:20},req:S=>S.done.metallurgy&&nb(S,'press')>=5,fx:mulf('press',1.5)},
 {id:'picks',n:'Ice picks',d:'Icers +50%.',c:{plate:10},req:S=>S.done.condense,fx:mulf('ice',1.5)},
 {id:'frost',n:'Frost lining',d:'Ice cellars and lockers hold 50% more ice.',c:{plate:20},req:S=>nb(S,'cellar')>=2,fx:mulf('icecap',1.5)},
 {id:'bellows',n:'Bellows',d:'Smelters work 50% faster.',c:{plate:15},req:S=>nb(S,'smelter')>=1,fx:mulf('smelt',1.5)},
 {id:'grapnel',n:'Wire grapnels',d:'Scavengers +25%.',c:{wire:15},req:S=>S.done.wiredraw,fx:mulf('scav',1.25)},
 {id:'coils',n:'Cooling coils',d:'Condensers +50%.',c:{wire:10},req:S=>S.done.wiredraw&&nb(S,'cond')>=1,fx:mulf('cond',1.5)},
 {id:'wrakes',n:'Wire rakes',d:'Grazers +25%.',c:{wire:8},req:S=>S.done.wiredraw,fx:mulf('graze',1.25)},
 {id:'shelving',n:'Nook shelving',d:'Reading nooks hold 50% more.',c:{plate:10,wire:4},req:S=>S.done.wiredraw&&nb(S,'nook')>=3,fx:S=>{S.m.nook=(S.m.nook||1)*1.5;}},
 {id:'whistle',n:'Whistling kettles',d:'Kettle-houses ×2. The whistling is considered a feature.',c:{plate:12,wire:4},req:S=>nb(S,'kettle')>=1&&S.done.wiredraw,fx:S=>{S.m.kettle*=2;S.accPerm+=1;}},
 {id:'jacket',n:'Boiler jackets',d:'Boilers +50% warmth and burn 25% less.',c:{plate:25},req:S=>nb(S,'boiler')>=1,fx:S=>{S.m.warm*=1.5;S.m.fuel*=0.75;}},
 {id:'crucible',n:'Crucibles',d:'Smelters ×2.',c:{plate:30,ice:200},req:S=>nb(S,'smelter')>=3,fx:mulf('smelt',2)},
 {id:'lamps',n:'Reading lamps',d:'Scholars +25%.',c:{wire:5,lens:1},req:S=>S.done.lensgrind,fx:mulf('notion',1.25)},
 {id:'bell',n:'School bell',d:'Duties learn 25% faster.',c:{plate:10,wire:6},req:S=>nb(S,'school')>=1,fx:mulf('learn',1.25)},
 {id:'bunks',n:'Bunk huts',d:'Every moss hut holds one more.',c:{plate:30,wire:10},req:S=>S.done.wiredraw&&nb(S,'hut')>=8,fx:S=>{S.m.berth+=1;}},
 {id:'vats',n:'Lichen vats',d:'Lichen storage +50%.',c:{plate:30,ice:100},req:S=>nb(S,'cellar')>=1,fx:mulf('lcap',1.5)},
 {id:'thingauge',n:'Thin-gauge stamping',d:'Two spoons from the scrap of one.',c:{plate:40,spoons:2000},req:S=>S.done.thingauge,fx:mulf('yield',2)},
 {id:'sprung',n:'Sprung presses',d:'Presses ×2.',c:{spring:10,plate:20},req:S=>S.done.springs,fx:mulf('press',2)},
 {id:'jig',n:'Jigs',d:'Crafting +15%.',c:{spring:5},req:S=>S.done.springs,fx:mulf('craft',1.15)},
 {id:'spectacles',n:'Spectacles',d:'Scholars +50%. Nobody has eyes, as such.',c:{lens:3,wire:5},req:S=>nb(S,'obs')>=1,fx:mulf('notion',1.5)},
 {id:'tube',n:'Long tube',d:'Observatories +50% and catch more comets.',c:{lens:5,plate:20},req:S=>nb(S,'obs')>=2,fx:mulf('obs',1.5)},
 {id:'slates',n:'Slates',d:'Duties learn 25% faster.',c:{plate:20,ledger:2},req:S=>nb(S,'school')>=2&&S.done.bookkeeping,fx:mulf('learn',1.25)},
 {id:'brass',n:'Brass section',d:'Bandstands give twice the comfort.',c:{plate:30,wire:10},req:S=>nb(S,'band')>=2,fx:mulf('comfort',2)},
 {id:'sledge',n:'Scrap sledges',d:'Scavengers +25%.',c:{spring:8,plate:40},req:S=>S.done.springs,fx:mulf('scav',1.25)},
 {id:'dish',n:'Dish',d:'Hails recharge 50% faster.',c:{wire:20,plate:10},req:S=>nb(S,'antenna')>=2,fx:mulf('hail',1.5)},
 {id:'geared',n:'Geared presses',d:'Presses ×2.',c:{gear:10},req:S=>S.done.gears,fx:mulf('press',2)},
 {id:'lathe',n:'Lathe',d:'Crafting +25%.',c:{gear:5,plate:20},req:S=>S.done.gears,fx:mulf('craft',1.25)},
 {id:'stemgear',n:'Brainstem gearing',d:'The Brainstem thinks three times as fast.',c:{gear:8,wire:10},req:S=>S.done.gears,fx:mulf('stem',3)},
 {id:'ferment',n:'Fermentation vats',d:'Grazers and beds ×2.',c:{plate:40,ice:300},req:S=>S.done.ferment,fx:S=>{S.m.graze*=2;S.m.bed*=2;}},
 {id:'rivbunk',n:'Riveted bunkers',d:'Scrap bunkers hold twice as much.',c:{gear:10,plate:60},req:S=>nb(S,'bunker')>=3,fx:mulf('bunk',2)},
 {id:'tess',n:'Tessellated storage',d:'Lockers hold 50% more.',c:{plate:60,spring:5},req:S=>S.done.tess,fx:mulf('cap',1.5)}];
const UPG_BY = {}; UPG.forEach(u => UPG_BY[u.id] = u);
const upgOpen = S => UPG.filter(u => !S.up[u.id] && u.req(S));
function upgrade(S, id){ const u = UPG_BY[id]; if (S.up[id] || !u.req(S) || !canPay(S,u.c)) return hook('fail'); pay(S,u.c); S.up[id] = 1; u.fx(S); log(S,'Fitted: ' + u.n + '.','good'); hook('unlock'); }

/* ---------- the Mind: a growing tangle of subsystems ---------- */
const MG = {core:'Core', prod:'Thinks', store:'Stores', amp:'Amplifies', cool:'Cools', conv:'Converts', odd:'Odd'};
const MT = {
 stem:{n:'Brainstem',s:'STEM',g:'core',p:1,cap:500,h:0.5,d:'The original. Thinks slowly, stores a little, never complains.'},
 rumin:{n:'Ruminator',s:'RUM',g:'prod',p:2,h:1,d:'Chews the same thought until it is soft. Steady output, steady heat.'},
 grudge:{n:'Grudge Engine',s:'GRDG',g:'prod',p:3,h:2,d:'Runs on old grievances. Thinks harder the unhappier the crew are.'},
 pend:{n:'Pendulum of Maybe',s:'PEND',g:'prod',p:4,h:1.5,d:'Swings between yes and no. Output rises and falls over about four minutes.'},
 bulb:{n:'Seasonal Bulb',s:'BULB',g:'prod',p:4,h:1.5,d:'Blooms at Perihelion, sulks at Aphelion.'},
 reflex:{n:'Spoon Reflex',s:'RFLX',g:'prod',p:0,h:0.3,d:'Twitches whenever a spoon is stamped by hand or by the rota. Each twitch is a thought.'},
 worry:{n:'Worry Loop',s:'WRRY',g:'prod',p:0,h:0,d:'Makes nothing of its own. Turns heat back into thought, badly. Wants things hot.'},
 daydream:{n:'Daydream Sump',s:'DAYD',g:'prod',p:6,h:0.5,d:'Only works when nobody has touched anything for a minute. Leave it alone and it thrives.'},
 attic:{n:'Attic',s:'ATTC',g:'store',cap:1000,h:0,d:'Holds thoughts in boxes, labelled in a hand nobody recognises.'},
 bilge:{n:'Bilge of Forgetting',s:'BLGE',g:'store',cap:4000,h:0,d:'Holds an enormous amount and keeps very little. Whatever spills into it slowly leaks away.'},
 sock:{n:'Sock Drawer',s:'SOCK',g:'store',cap:600,h:0,d:'Holds a little. Now and then produces something it should not contain.'},
 second:{n:'Second Opinion',s:'2ND',g:'amp',a:0.35,h:0,d:'Boosts its neighbours. Occasionally disagrees with them and everything stops until it calms down.'},
 hunch:{n:'Hunch Valve',s:'HNCH',g:'amp',a:0.2,h:0,d:'A gentle boost to its neighbours, and it lets their heat out.'},
 echo:{n:'Echo Chamber',s:'ECHO',g:'amp',a:0,h:3,d:'Repeats its loudest neighbour, at volume. Very hot.'},
 metro:{n:'Metronome of Habit',s:'MTRO',g:'amp',a:0,h:0,d:'Boosts its neighbours more the longer nothing is rewired, up to 60%.'},
 thermo:{n:'Thermostat of Doubt',s:'THRM',g:'cool',cool:3,h:0,d:'Cools the whole Mind. Slows its neighbours slightly while it wonders.'},
 sump:{n:'Cold Sump',s:'SUMP',g:'cool',cool:2,h:0,d:'Cools the Mind. Twice as good at Aphelion.'},
 gland:{n:'Whimsy Gland',s:'GLND',g:'conv',h:0,d:'Squeezes whimsy out of a mind that is full, and a little out of one that is not.'},
 npress:{n:'Notion Press',s:'NPRS',g:'conv',h:0.5,d:'Diverts some thought into notions for the scholars.'},
 lobe:{n:'Lichen Empathy Lobe',s:'LOBE',g:'odd',p:1,h:0,d:'Feels for the lichen. Lichen +4% per level, and a few thoughts.'},
 bureau:{n:'Bureau Gland',s:'BURO',g:'odd',h:0,d:'Secretes procedure. The Mandate arrives 4% sooner per level. Whimsy dries up a bit.'},
 tickle:{n:'Ticklish Ganglion',s:'TCKL',g:'odd',h:0,d:'Tap the Mind diagram or the ship’s name and it giggles out a burst of thought.'}};
const MPOOL = S => { const p = ['rumin','attic','reflex','sock','grudge','pend'];
  if (S.done.neuro) p.push('second','hunch','thermo','gland','lobe','bulb');
  if (S.done.hydraulics) p.push('worry','sump','bilge','npress','metro');
  if (S.done.oneiro) p.push('daydream','echo','bureau','tickle'); return p; };
const nbrs = (N,i) => { const o = []; if (N[i].p >= 0) o.push(N[i].p); N.forEach((n,j) => { if (n.p == i) o.push(j); }); return o; };
function mindCalc(S, c){
  const N = S.mind.nodes, sulk = S.mind.sulk, out = [], base = new Array(N.length).fill(0), mult = new Array(N.length).fill(1);
  let heat = 0, cool = 0, cap = 0, gland = 0, npress = 0, bilge = 0;
  const aph = c.cal.i == 2, idle = S.age - S.lastAct > 60;
  const eff = n => (0.4 + 0.6*n.cond) * (n.v == null ? 1 : n.v);
  N.forEach((n,i) => { const t = MT[n.k], L = n.lv, e = eff(n);
    if (t.cap) cap += t.cap*L;
    let p = 0;
    if (n.k == 'stem') p = t.p*L*S.m.stem;
    else if (n.k == 'grudge') p = t.p*L*clamp(1.6 - S.accord/100, 0.2, 1.4);
    else if (n.k == 'pend') p = t.p*L*(0.3 + Math.abs(Math.sin(S.age/76)));
    else if (n.k == 'bulb') p = t.p*L*c.seasonM/1.2;
    else if (n.k == 'reflex') p = (S.mind.temp.twitch||0)*L;
    else if (n.k == 'daydream') p = idle ? t.p*L : 0;
    else if (n.k == 'lobe') p = t.p*L;
    else if (t.p) p = t.p*L;
    base[i] = p*e;
    if (t.h) heat += t.h*L*(n.v == null ? 1 : n.v);
    if (t.cool) cool += t.cool*L*e*(n.k == 'sump' && aph ? 2 : 1);
    if (n.k == 'gland') gland += L*e; if (n.k == 'npress') npress += L*e; if (n.k == 'bilge') bilge += L;
  });
  N.forEach((n,i) => { const t = MT[n.k]; if (t.g != 'amp' && t.g != 'cool') return; const e = eff(n), ns = nbrs(N,i);
    for (const j of ns) {
      if (sulk[i] > 0 && n.k == 'second') { mult[j] = 0; continue; }
      if (t.a) mult[j] *= 1 + t.a*Math.pow(n.lv,0.7)*e;
      if (n.k == 'metro') mult[j] *= 1 + Math.min(0.6, (S.age - (S.mind.rew||0))/3600*0.1*n.lv)*e;
      if (n.k == 'thermo') mult[j] *= 0.95;
      if (n.k == 'hunch') heat -= 0.2*(MT[N[j].k].h||0)*N[j].lv;
    }
    if (n.k == 'echo') { let best = 0; for (const j of ns) best = Math.max(best, base[j]); base[i] = best*0.5*Math.pow(n.lv,0.7)*e; }
  });
  heat += S.mind.heatBias||0;
  const net = Math.max(0, heat - cool), hcap = (6 + 1.5*N.length)*S.m.hcap;
  N.forEach((n,i) => { if (n.k == 'worry') base[i] = 0.5*n.lv*net*eff(n); });
  const pen = net > hcap ? Math.pow(hcap/net, 1.5) : 1;
  let cps = 0; N.forEach((n,i) => { out[i] = base[i]*mult[i]*pen*S.m.mind*(qk(S).cyc||1); cps += out[i]; });
  const div = npress ? Math.min(0.5, 0.12*Math.sqrt(npress)) : 0;
  return {cps: cps*(1-div), out, heat: net, hcap, pen, cap: cap*(S.done.attic2 ? 1.5 : 1), notions: cps*div/6, gland, bilge, raw: cps};
}
function mindScore(S){ const c = calc(S); return c.mind.cps + c.mind.notions*4 + c.mind.cap/500; }
function draftOffer(S){ const p = MPOOL(S).slice().sort(() => rand()-0.5), seen = {}, o = []; for (const k of p) { if (!seen[k]) { seen[k] = 1; o.push(k); } if (o.length == 3) break; } return o; }
const dreamNeed = S => 15000*Math.pow(1.7, S.mind.dreams);
function mindDraft(S){ if (S.mp < 1 || S.mind.offer) return hook('fail'); S.mp--; S.mind.offer = draftOffer(S); S.mind.dreamt = 0; hook('buy'); }
const TASKS = {idle:['Leak whimsy','The old way. A full Mind leaks whimsy, and nothing else happens.'], ponder:['Ponder','Spare thought becomes notions for the scholars, eight thoughts to a notion.'],
 coach:['Coach a duty','Spare thought helps one duty team learn faster.'], forecast:['Forecast','The Mind watches the sky. Comets come 30% more often and teach half as much again, and you can see the weather coming.'],
 dream:['Dream','Spare thought piles up until the Mind dreams up a subsystem of its own, free of Mandate.']};
function setTask(S, t, duty){ if (!S.done.sparework || !TASKS[t]) return hook('fail'); S.mind.task = t; if (duty != null) S.mind.coach = duty; hook('tap'); }
function mindTake(S, k, parent){ if (!S.mind.offer || S.mind.offer.indexOf(k) < 0) return; const N = S.mind.nodes;
  N.push({k, lv:1, p: parent == null ? suggestParent(S,k) : parent, cond:1, v:1}); S.mind.offer = null; S.mind.sel = N.length - 1; S.mind.rew = S.age;
  log(S, 'A ' + MT[k].n + ' has been fitted to the Mind, wired to the ' + MT[N[N[N.length-1].p].k].n + '.','good'); hook('unlock'); }
function suggestParent(S, k){ const N = S.mind.nodes, g = MT[k].g; let best = 0, bs = -1;
  N.forEach((n,i) => { const t = MT[n.k]; let s = rand()*0.5 - nbrs(N,i).length*0.6;
    if (g == 'amp' && (t.g == 'prod' || t.g == 'core')) s += 3; if (g == 'prod' && t.g == 'amp') s += 2; if (g == 'cool' && t.h) s += 1; if (g == 'store') s += t.g == 'core' ? 1 : 0;
    if (s > bs) { bs = s; best = i; } }); return best; }
const isDesc = (N, a, b) => { let x = N[a].p; while (x >= 0) { if (x == b) return true; x = N[x].p; } return false; };
const canWire = (N, i, p) => i > 0 && p != i && p != N[i].p && !isDesc(N, p, i);
function rewire(S, i, p, quiet){ const N = S.mind.nodes; if (!canWire(N,i,p)) return hook('fail'); N[i].p = p; S.mind.rew = S.age; if (!quiet) { log(S, MT[N[i].k].n + ' rewired to the ' + MT[N[p].k].n + '.',''); hook('tap'); } }
const nodeUpCost = n => { const f = Math.pow(1.7, n.lv - 1); return n.lv >= 4 ? {plate:6*f, wire:3*f, gear:Math.ceil(f/2)} : n.lv >= 2 ? {plate:6*f, wire:2*f} : {plate:6*f}; };
function nodeUp(S, i){ const n = S.mind.nodes[i], c = nodeUpCost(n); if (!canPay(S,c) || (n.lv >= 2 && !S.done.wiredraw) || (n.lv >= 4 && !S.done.gears)) return hook('fail'); pay(S,c); n.lv++; hook('buy'); }
const serviceCost = n => ({plate: 2*n.lv});
function service(S, i){ const n = S.mind.nodes[i], c = serviceCost(n); if (n.cond > 0.99 || !canPay(S,c)) return hook('fail'); pay(S,c); n.cond = 1; hook('tap'); }
function valve(S, i){ const n = S.mind.nodes[i]; if (!S.done.hydraulics) return hook('fail'); n.v = n.v >= 1 ? 0.5 : n.v > 0 ? 0 : 1; hook('tap'); }
function tickle(S){ const k = S.mind.nodes.filter(n => n.k == 'tickle').reduce((a,n) => a + n.lv, 0); if (!k) return; const c = calc(S); add(S,'cycles', 10*k*(1 + c.mind.cps/20), c); S.mind.temp.giggle = (S.mind.temp.giggle||0) + 1; if (S.mind.temp.giggle % 25 == 0) log(S,'The Mind giggles. The crew pretend not to have heard.',''); }
const GLITCH = [
 [S => { S.mind.temp.teapot = 60; }, 'The Mind briefly believes it is a teapot. Kettle-houses run twice as fast for a minute.'],
 [S => { const c = calc(S); add(S,'notions', c.caps.notions*0.15, c); S.r.cycles *= 0.5; }, 'A fugue. The Mind loses half its thoughts and the scholars find the other half written on the walls.'],
 [S => { S.r.whimsy += 3; }, 'The Mind recites the Mandate backwards. It scans better. +3 whimsy.'],
 [S => { const N = S.mind.nodes; if (N.length < 3) return; const i = 1 + Math.floor(rand()*(N.length-1)), opts = N.map((_,j) => j).filter(j => canWire(N,i,j)); if (opts.length) rewire(S, i, pick(opts), true); }, 'A subsystem wanders off and plugs itself in somewhere else.'],
 [S => { add(S,'spoons', 20 + S._sp*30); }, 'The Mind imagines a spoon so hard that one appears. Then several.'],
 [S => { S.mind.nodes.forEach(n => { n.cond = Math.max(0, n.cond - 0.08); }); }, 'Something in the Mind goes pop. Every subsystem is a little the worse for it.'],
 [S => { S.accMod -= 1; }, 'The Mind shouts in its sleep. The crew are unsettled. Accord −1.'],
 [S => { S.mind.temp.lucid = 45; }, 'A moment of lucidity. The Mind thinks four times as fast for 45 seconds.']];
function mindTick(S, dt, c, online){
  const mc = c.mind, md = S.mind;
  let inflow = mc.cps*(md.temp.lucid > 0 ? 4 : 1);
  S.r.cycles += inflow*dt; S.r.notions = Math.min(c.caps.notions, S.r.notions + mc.notions*dt);
  if (mc.bilge) { /* the Bilge forgets only what is kept in it: thought above the rest of the Mind's storage */
    const own = S.mind.nodes.reduce((a,n) => a + (n.k == 'bilge' ? MT.bilge.cap*n.lv : 0), 0)*(S.done.attic2 ? 1.5 : 1), over = Math.max(0, S.r.cycles - (mc.cap - own));
    S.r.cycles -= over*(1 - Math.pow(1 - 0.0015*mc.bilge, dt)); }
  const full = S.r.cycles >= mc.cap*0.995; if (S.r.cycles > mc.cap) S.r.cycles = mc.cap;
  const task = S.done.sparework ? md.task : 'idle', busy = full && task != 'idle';
  S.r.whimsy += (full ? mc.raw*0.006*(1 + mc.gland)*(busy ? 0.25 : 1) : mc.raw*0.0004*mc.gland) * (qk(S).whim||1) * Math.pow(0.85, S.mind.nodes.filter(n => n.k == 'bureau').length) * dt;
  /* standing work for spare thought: only what overflows a full Mind is spent */
  const spare = busy ? mc.cps*dt : 0; md.fc = busy && task == 'forecast' ? 1 : 0;
  if (spare > 0) {
    if (task == 'ponder') S.r.notions = Math.min(c.caps.notions, S.r.notions + spare/8);
    if (task == 'coach') { const D = S.duty[md.coach]; if (D && team(S, md.coach).length) D.c = Math.min(100, D.c + spare*0.00006*(1 - D.c/105)); }
    if (task == 'dream') { md.dream += spare; const need = dreamNeed(S); if (md.dream >= need && !md.offer) { md.dream -= need; md.dreams++; md.offer = draftOffer(S); md.dreamt = 1; log(S,'The Mind has dreamt up a subsystem nobody sent. (Mind)','big'); hook('unlock'); } }
  }
  md.temp.twitch = 0;
  for (const k in md.temp) if (k != 'twitch' && k != 'giggle' && md.temp[k] > 0) md.temp[k] = Math.max(0, md.temp[k] - dt);
  for (const k in md.sulk) if (md.sulk[k] > 0) md.sulk[k] -= dt;
  md.nodes.forEach(n => { n.cond = Math.max(0, n.cond - dt*0.01/360); });
  if (!online) return;
  md.nodes.forEach((n,i) => { if (n.k == 'second' && !(md.sulk[i] > 0) && rand() < dt*0.0004*n.lv) { md.sulk[i] = 30; log(S,'The Second Opinion disagrees with its neighbours. They stop to argue.',''); } });
  if (mc.heat > mc.hcap && rand() < dt*0.004*(mc.heat/mc.hcap)) { const g = pick(GLITCH); g[0](S); log(S,'Glitch: ' + g[1],'bad'); S.seen.glitch = (S.seen.glitch||0) + 1; }
  const socks = md.nodes.filter(n => n.k == 'sock').reduce((a,n) => a + n.lv, 0);
  if (socks && (md.sockT += dt*Math.sqrt(socks)) > 400) { md.sockT = 0; const f = pick([['grit',1],['spores',1],['whimsy',2],['spoons',50],['plate',2]]); S.r[f[0]] += f[1]; log(S,'The Sock Drawer produces ' + (f[0]=='spoons'?'a handful of spoons':f[1] + ' ' + f[0]) + '. Nobody put it there.',''); }
}

/* ---------- duties: crew learning to do your jobs ---------- */
const DUTY = {
 stamp:{n:'Stamping rota',d:'They take turns at the hull arm, stamping spoons the way you do. Badly at first. They leave the bottom half of the scrap store alone, and stop when you switch the presses off.',unl:S=>S.done.delegation&&S.hand.stamp>=150},
 pry:{n:'Salvage gang',d:'They pry scrap off the hull for you. Some of the hull is load-bearing.',unl:S=>S.done.delegation&&S.hand.pry>=150},
 craft:{n:'Workshop crew',d:'They craft whatever you ask them to keep in stock, using only what is above half of each store. Waste is part of the syllabus.',unl:S=>S.done.delegation&&S.hand.craft>=30&&nb(S,'bench')>=1},
 watch:{n:'Sky-watch',d:'They watch for comets and observe them for you. Not everything in the sky is a comet.',unl:S=>S.done.delegation&&S.comets>=3},
 mind:{n:'Mind crew',d:'They service the Mind, work the valves, and try rewiring it to see what happens. Sometimes it is better.',unl:S=>S.st.flags.mindcrew},
 cttee:{n:'Petition committee',d:'If you leave a petition for a minute and a half, they decide it. Their choices improve with practice.',unl:S=>S.st.flags.committee}};
const BANDS = [[0,'Hopeless'],[15,'Fumbling'],[35,'Getting there'],[55,'Competent'],[75,'Skilled'],[90,'Masterly']];
const band = c => { let b = BANDS[0][1]; for (const x of BANDS) if (c >= x[0]) b = x[1]; return b; };
const dutyOf = k => S => S.duty[k] || (S.duty[k] = {c:0, acc:0, mis:0, ok:0, last:''});
function team(S, k){ return S.crew.filter(t => t.d == k); }
function setDuty(S, k, d){
  if (!DUTY[k].unl(S)) return hook('fail'); dutyOf(k)(S);
  if (d > 0) { let n = 0; const pool = S.crew.filter(t => !t.d && t.j == 'grazer').sort((a,b) => (b.t=='dreamy')-(a.t=='dreamy'));
    for (const t of pool) { if (n >= d) break; t.d = k; n++; } if (!n) return hook('fail'); }
  else { let n = 0; for (const t of team(S,k).reverse()) { if (n >= -d) break; t.d = ''; t.j = 'grazer'; n++; } if (!n) return hook('fail'); }
  hook('tap');
}
const misP = (S, k, T) => { const c = S.duty[k].c; const cl = T.filter(t => t.t == 'clumsy').length/Math.max(1,T.length); return clamp(0.4*Math.pow(1 - c/100, 1.4)*(1 + cl), 0.01, 0.6); };
const dutyLearn = (S, k, T) => 0.0018*Math.sqrt(T.length)*S.m.learn*(qk(S).learn||1)*(1 + 0.15*nb(S,'school'))*(1 + 0.3*T.filter(t => t.t == 'dreamy').length/T.length)*(S.st.flags.manuals ? 1.5 : 1);
function dutyNote(S, k, msg, online){ S.duty[k].last = msg; if (online) log(S, msg, ''); }
function dutiesTick(S, dt, c, online){
  for (const k in DUTY) { const T = team(S,k); if (!T.length || !S.duty[k]) continue;
    const D = S.duty[k], who = () => pick(T).n, mp = misP(S,k,T);
    D.c = Math.min(100, D.c + dutyLearn(S,k,T)*(1 - D.c/105)*dt*100/100);
    const learnMis = n => { D.mis += n; D.c = Math.min(100, D.c + n*0.25*(T.some(t => t.t == 'clumsy') ? 2 : 1)); };
    if (k == 'stamp' || k == 'pry') {
      const acts = 0.45*Math.pow(T.length,0.75)*dt*(online ? 1 : 0.8), hm = handMult(S)*S.m.rota;
      if (k == 'stamp') { const use = S.share <= 0 ? 0 : Math.max(0, Math.min(S.r.scrap - c.caps.scrap*0.5, acts*hm)); S.r.scrap -= use; const good = use*(1 - mp); addSpoons(S, good*c.yield); S.mind.temp.twitch = (S.mind.temp.twitch||0) + acts*(1-mp)/dt; learnMis(acts*mp*0.01);
        D.acc += acts*mp; if (D.acc > 25) { D.acc = 0; if (rand() < 0.15) { S.r.whimsy += 1; dutyNote(S,k,who() + ' has stamped a spork. It is being kept, for study. +1 whimsy.',online); } else dutyNote(S,k,pick([who() + ' stamped a spoon inside out.', who() + ' stamped the same spoon nine times.', who() + ' stamped a bowl with no handle and called it a cup.', who() + ' got a leg caught in the die. Everyone is fine. The spoon is not.']), online); } }
      else { const got = acts*Math.max(hm, c.scrapIn*0.5)*(1 - mp)*(T.some(t => t.t == 'sharp') ? 1.1 : 1); add(S,'scrap',got,c); learnMis(acts*mp*0.01);
        D.acc += acts*mp; if (D.acc > 25) { D.acc = 0; if (rand() < 0.2) { const g = 30 + S._sp*20; addSpoons(S,g); dutyNote(S,k,who() + ' pried open a sealed drawer full of spoons. +' + fmt(g) + '.',online); } else dutyNote(S,k,pick([who() + ' pried off a panel that turned out to be holding the air in. Put back.', who() + ' brought back a very large rivet and nothing else.', who() + ' fell off the hull and walked back round.']), online); } }
    }
    if (k == 'craft') { D.acc2 = (D.acc2||0) + 0.09*Math.pow(T.length,0.75)*dt; let n = 0;
      while (D.acc2 >= 1 && n++ < 60) { D.acc2--; const roomy = cc => Object.keys(cc).every(q => !isFinite(c.caps[q] == null ? Infinity : c.caps[q]) || S.r[q] - cc[q] >= c.caps[q]*0.5); /* like smelters and the rota, the crew leave the bottom half of a store alone */
      const want = Object.keys(S.keep).filter(r => CRAFT[r] && CRAFT[r].req(S) && S.r[r] < S.keep[r] && canPay(S, CRAFT[r].c) && roomy(CRAFT[r].c));
        if (!want.length) { D.acc2 = Math.min(D.acc2, 1); break; } const r = pick(want); pay(S, CRAFT[r].c);
        if (rand() < mp) { learnMis(1); if (rand() < 0.06) { add(S,'notions',c.caps.notions*0.1,c); dutyNote(S,k,who() + ' ruined some ' + CRAFT[r].n.toLowerCase() + ' and discovered something by accident. Notions gained.',online); } else if (rand() < 0.3) dutyNote(S,k,who() + ' made ' + CRAFT[r].n.toLowerCase() + ' that does not work. It has been framed.',online); }
        else S.r[r] += craftYield(S,c); } }
    if (k == 'watch' && S.comet > 0 && S.comet < 11 && !S.duty.watch.tried) { S.duty.watch.tried = 1; const sharp = T.some(t => t.t == 'sharp') ? 0.1 : 0;
      if (rand() < 1 - mp + sharp) { observe(S, 'watch'); } else { learnMis(1); dutyNote(S,k,who() + ' carefully observed a rock for the whole of the comet.',online); } }
    if (k == 'mind') mindCrew(S, dt, c, T, D, online);
  }
  if (S.comet <= 0 && S.duty.watch) S.duty.watch.tried = 0;
}
function mindCrew(S, dt, c, T, D, online){
  const N = S.mind.nodes; if (N.length < 3) return; D.ct = (D.ct||0) + dt*Math.sqrt(T.length);
  const per = 45; let n = 0; const who = pick(T).n, mp = misP(S,'mind',T);
  if (D.trial && S.age - D.trial.t > 40) { const now = mindScore(S), t = D.trial, worse = now < t.s;
    if (worse && rand() > mp) { rewire(S, t.i, t.from, true); dutyNote(S,'mind',t.who + ' tried moving the ' + MT[N[t.i].k].n + '. It was worse. They put it back.',online); }
    else if (worse) { D.mis++; D.c = Math.min(100, D.c + 0.5); dutyNote(S,'mind',t.who + ' moved the ' + MT[N[t.i].k].n + ' and is sure it is better. It is not.',online); }
    else { D.ok++; dutyNote(S,'mind',t.who + ' moved the ' + MT[N[t.i].k].n + ' next to the ' + MT[N[N[t.i].p].k].n + '. Thought +' + Math.round(100*(now/t.s - 1)) + '%. They are insufferable about it.',online); }
    D.trial = null; }
  while (D.ct >= per && n++ < 40) { D.ct -= per;
    const worn = N.map((x,i) => [x,i]).filter(([x]) => x.cond < 0.75).sort((a,b) => a[0].cond - b[0].cond);
    if (worn.length && canPay(S, serviceCost(worn[0][0]))) { const [x,i] = worn[0]; pay(S, serviceCost(x));
      if (rand() < mp) { x.cond = Math.max(0, x.cond - 0.1); D.mis++; D.c = Math.min(100, D.c + 0.3); dutyNote(S,'mind',who + ' serviced the ' + MT[x.k].n + ' and has a part left over. It runs worse.',online); }
      else { x.cond = 1; if (rand() < 0.08) dutyNote(S,'mind',who + ' serviced the ' + MT[x.k].n + '.',online); } continue; }
    const mc = c.mind;
    if (S.done.hydraulics && mc.heat > mc.hcap) { let hot = -1, hh = 0; N.forEach((x,i) => { const h = (MT[x.k].h||0)*x.lv*x.v; if (h > hh) { hh = h; hot = i; } }); if (hot >= 0) { N[hot].v = Math.max(0, N[hot].v - 0.5); dutyNote(S,'mind',who + ' turned down the ' + MT[N[hot].k].n + ' before it boiled.',online); } continue; }
    if (S.done.hydraulics && mc.heat < mc.hcap*0.6) { const sh = N.find(x => x.v < 1); if (sh) { sh.v = Math.min(1, sh.v + 0.5); continue; } }
    if (D.c >= 25 && !D.trial && rand() < 0.5) { const i = 1 + Math.floor(rand()*(N.length-1)), opts = N.map((_,j) => j).filter(j => canWire(N,i,j));
      if (opts.length) { D.trial = {i, from:N[i].p, s:mindScore(S), t:S.age, who}; rewire(S, i, pick(opts), true); } }
  }
}

/* ---------- derived numbers ---------- */
function calc(S){
  const c = {}, m = S.m, q = qk(S), hz = S.heir, pop = S.pop = S.crew.length, awake = pop - S.tun;
  c.cal = cal(S);
  c.seasonM = Math.max(0.1, SEASONS[c.cal.i].m + S.weather);
  c.am = 0.6 + S.accord/150;
  const f = pop > 0 ? awake/pop*c.am : 0, J = {grazer:0,scav:0,scholar:0,icer:0,tinker:0,bard:0}, Nn = {grazer:0,scav:0,scholar:0,icer:0,tinker:0,bard:0}, Dn = {};
  let hungry = 0, kind = 0;
  for (const t of S.crew) { if (t.t == 'hungry') hungry++; if (t.t == 'kind') kind++;
    if (t.d) { Dn[t.d] = (Dn[t.d]||0) + 1; continue; }
    Nn[t.j]++; J[t.j] += (1 + 0.05*lvl(t.x[t.j]))*(t.t == 'diligent' ? 1.1 : t.t == 'dreamy' ? 0.95 : 1)*(t.t == 'sharp' && t.j == 'scav' ? 1.1 : 1); }
  for (const j in J) J[j] *= f;
  c.J = J; c.N = Nn; c.D = Dn;
  c.mind = mindCalc(S, c);
  const lobe = S.mind.nodes.reduce((a,n) => a + (n.k == 'lobe' ? n.lv*(0.4+0.6*n.cond) : 0), 0);
  const lm = c.seasonM*(q.lichen||1)*(hz.small?1.25:1)*(1 + 0.04*lobe);
  c.bedIn = (nb(S,'bed')*0.25*m.bed + nb(S,'garden')*0.4)*lm;
  c.lichenIn = c.bedIn + J.grazer*1.0*m.graze*lm;
  c.eat = awake*0.4*(q.eat||1)*(1 + 0.5*hungry/Math.max(1,pop));
  c.scrapIn = J.scav*0.25*m.scav*(q.scrap||1);
  c.iceIn = J.icer*0.05*m.ice + nb(S,'cond')*0.08*m.cond*(c.cal.i == 2 ? 2 : 1);
  c.demand = nb(S,'press')*0.5*m.press;
  c.yield = m.yield*(1 + 0.03*J.tinker);
  c.notionsIn = J.scholar*0.1*m.notion*(1 + 0.05*nb(S,'nook')) + nb(S,'obs')*0.1*m.obs;
  c.smelt = nb(S,'smelter')*1*m.smelt; c.kettle = nb(S,'kettle')*m.kettle*(S.mind.temp.teapot > 0 ? 2 : 1); c.mill = nb(S,'mill');
  c.caps = {lichen:(2000 + 1500*nb(S,'locker') + 500*nb(S,'cellar'))*m.cap*m.lcap, scrap:scrapCap(S),
    ice:(200 + 100*nb(S,'locker') + 300*nb(S,'cellar'))*m.icecap, notions:(250 + 250*nb(S,'nook')*(m.nook||1) + 2500*nb(S,'obs') + 1500*nb(S,'shelf'))*m.ncap, cycles:c.mind.cap};
  c.capPop = (2 + (q.berth||0) + m.berth)*nb(S,'hut') + m.rackB*nb(S,'rack') + m.warrenB*nb(S,'warren');
  c.capHails = 2 + nb(S,'antenna');
  /* warmth and comfort make up accord */
  const aph = c.cal.i == 2;
  c.warmNeed = aph ? pop/8 : 0;
  c.warm = (S.r.scrap > 1 || !aph ? nb(S,'boiler')*2*m.warm : 0) + (S.st.flags.huddle ? pop/20 : 0);
  c.teaUse = S.r.tea > 0 ? pop*0.0006 : 0;
  const A = [['Settled', 50]];
  if (S.st.flags.who) A.push(['Knowing what they are for', 5]);
  if (pop > 10) A.push(['Crowding', -Math.min(50, (pop-10)*0.5)]);
  if (S.r.tea > 0 && pop) A.push(['Tea', 8]);
  if (Nn.bard) A.push(['Bards', Math.min(10, Nn.bard*1*m.comfort)]);
  if (nb(S,'band')) A.push(['Bandstands', Math.min(12, 2*nb(S,'band')*m.comfort)]);
  if (nb(S,'garden')) A.push(['Moss gardens', Math.min(15, 3*nb(S,'garden')*m.comfort)]);
  if (kind) A.push(['Kind souls', Math.min(6, kind*0.5)]);
  if (S.fest > 0) A.push(['Brew-up', 10]);
  if (c.warmNeed > c.warm) A.push(['Cold', -Math.min(25, (c.warmNeed - c.warm)*3)]);
  if (S.tun > 0) A.push(['Hunger', -25]);
  if (Math.abs(S.accMod) >= 0.5) A.push(['Recent decisions (fading)', clamp(S.accMod,-30,30)]);
  if (S.accPerm) A.push(['Customs and comforts', S.accPerm]);
  if (q.acc) A.push(['Bureau attention', q.acc]);
  c.accParts = A; c.accT = clamp(A.reduce((a,x) => a + x[1], 0), 5, 100);
  return c;
}

/* ---------- the tick ---------- */
function addSpoons(S, x){ if (x <= 0) return; S.r.spoons += x; S.made += x; while (S.made >= thr(S)) { S.mand++; S.mp++; if (S.mand < 30) log(S,'The Bureau notes your output. Mandate +1.','good'); } }
function addTardi(S){
  const t = newTardi(); S.crew.push(t);
  if (S.crew.length <= 12 || S.crew.length % 25 == 0) log(S, S.crew.length == 1 ? 'A tardigrade uncurls in the moss hut and starts grazing. You could ask it to do something else. (Crew)' : t.n + ' has woken up. Crew: ' + S.crew.length + '.');
}
function tick(S, dt, online){
  if (S.ended && S.ended != 'small') return;
  const c = calc(S), r = S.r, q = qk(S), pop = S.pop;
  const si0 = c.cal.i; S.age += dt;
  /* food and tuns */
  r.lichen += (c.lichenIn - c.eat)*dt;
  if (r.lichen <= 0) { r.lichen = 0;
    if (c.lichenIn < c.eat && pop > 0) { const eatFull = pop*0.4*(q.eat||1), grazeFull = (c.lichenIn - c.bedIn)*(pop/Math.max(1,pop-S.tun));
      const fr = eatFull > grazeFull ? clamp(c.bedIn/(eatFull-grazeFull),0,1) : 1, target = pop - Math.floor(fr*pop);
      S.tunT += dt; const k = Math.floor(S.tunT/1.5);
      if (k > 0) { S.tunT = 0; if (S.tun < target) { if (!S.tun) log(S,'The lichen has run out. Tardigrades are curling up into tuns to wait.','bad'); S.tun = Math.min(target, S.tun+k); S.seen.tun = 1; S.coldTun = 1; } } }
  } else if (S.tun > 0 && r.lichen > pop) { S.tunT += dt; const k = Math.floor(S.tunT/1.5); if (k > 0) { S.tunT = 0; S.tun = Math.max(0, S.tun-k); if (!S.tun) log(S,'Everyone is awake again.','good'); } }
  r.lichen = Math.min(r.lichen, c.caps.lichen);
  if (r.lichen > 0) S.seen.lichen = 1;
  /* scrap, boilers, smelters, presses */
  let inc = c.scrapIn*dt;
  if (c.cal.i == 2 && nb(S,'boiler')) inc -= nb(S,'boiler')*0.2*S.m.fuel*dt;
  r.scrap = Math.max(0, r.scrap + inc);
  if (c.smelt > 0 && r.scrap > c.caps.scrap*0.5) { const u = Math.min(r.scrap - c.caps.scrap*0.5, c.smelt*dt); r.scrap -= u; r.plate += u/50; }
  if (c.mill > 0 && r.plate > 0) { const u = Math.min(r.plate, c.mill*0.03*dt); r.plate -= u; r.wire += u/2; }
  const avail = S.share >= 1 ? r.scrap : S.share*Math.max(0, inc) + Math.max(0, r.scrap - c.caps.scrap*0.9);
  const used = S.share <= 0 ? 0 : Math.max(0, Math.min(c.demand*dt, avail, r.scrap));
  r.scrap = Math.min(c.caps.scrap, r.scrap - used);
  addSpoons(S, used*c.yield); S._sp = used*c.yield/dt; S._used = used/dt;
  /* ice, tea, notions */
  r.ice = Math.min(c.caps.ice, r.ice + c.iceIn*dt);
  if (c.kettle > 0 && r.lichen > c.caps.lichen*0.3) { const k = Math.min(c.kettle*dt, r.lichen/0.5, r.ice/0.2); if (k > 0) { r.lichen -= k*0.5; r.ice -= k*0.2; r.tea += k*0.01; } }
  r.tea = Math.max(0, r.tea - c.teaUse*dt);
  r.notions = Math.min(c.caps.notions, r.notions + c.notionsIn*dt);
  r.whimsy += c.N.bard*0.003*(q.whim||1)*dt;
  mindTick(S, dt, c, online);
  dutiesTick(S, dt, c, online);
  /* crew learn their trades */
  const sk = (q.skill||1)*dt;
  for (const t of S.crew) if (!t.d && t.j != 'grazer') t.x[t.j] = (t.x[t.j]||0) + sk*(t.t == 'diligent' ? 1.2 : 1);
  /* arrivals */
  if (pop < c.capPop && r.lichen > 0 && S.tun == 0) { S.arr += dt/12*(1 + c.capPop/25)*(S.fest>0?2:1); while (S.arr >= 1 && S.crew.length < c.capPop) { S.arr--; addTardi(S); } } else S.arr = 0;
  /* mood, hails, timers */
  S.accord += clamp(c.accT - S.accord, -0.2*dt, 0.2*dt);
  S.accMod *= Math.pow(0.5, dt/5400);
  for (let i = S.tmpm.length - 1; i >= 0; i--) if (S.age >= S.tmpm[i][2]) { S.m[S.tmpm[i][0]] /= S.tmpm[i][1]; S.tmpm.splice(i, 1); }
  if (S.fest > 0) S.fest = Math.max(0, S.fest - dt);
  if (S.hails < c.capHails) S.hails = Math.min(c.capHails, S.hails + dt/90*S.m.hail*(q.hail||1));
  const si = cal(S).i;
  if (si != si0) {
    S.weather = rand() < 0.3 ? 0.15 : rand() < 0.43 ? -0.1 : 0;
    if (si0 == 2) { if (!S.coldTun && pop >= 5) ach('warm'); S.coldTun = 0; }
    if (si == 2) S.seen.aph = 1;
    log(S, SEASONS[si].n + ' begins' + (si==2?'. The lichen slows to a quarter, and the huts get cold. Mind the stores.':si==0?'. Warm light on the hull. The lichen races.':'.'), si==2?'bad':'');
  }
  if (online) {
    if (S.comet > 0) { S.comet -= dt; if (S.comet <= 0 && rand() < 0.15*nb(S,'obs')*S.m.obs) observe(S, 'obs'); }
    else if (pop >= 1 && (S.cometT -= dt*(S.mind.fc ? 1.3 : 1)) <= 0) { S.comet = 22; S.cometT = rnd(200,380)*(q.comet||1); log(S,'A comet is crossing the sky. Tap Observe.','big'); hook('unlock'); }
    storyTick(S, dt);
    if (nb(S,'antenna') >= 1) {
      if (S.pedlar > 0) S.pedlar -= dt;
      else if ((S.pedT -= dt) <= 0 || (new Date().getDay() == 2 && !S.seen.tue)) { S.seen.tue = new Date().getDay() == 2 ? 1 : 0; S.pedlar = 180; S.pedT = rnd(700,1200); if (!S.seen.ped) log(S,'A small crooked ship is hailing you. It says its name is Odd Tuesday. (Trade)','big'); S.seen.ped = 1; }
    }
  }
}

/* ---------- player actions ---------- */
const handMult = S => S.m.hand;
function touch(S){ S.lastAct = S.age; }
function stamp(S){ touch(S); if (S.r.scrap < 1) { hook('fail'); return 0; } const n = Math.min(S.r.scrap, handMult(S)); S.r.scrap -= n; addSpoons(S, n*calc(S).yield); S.hand.stamp++; S.mind.temp.twitch = (S.mind.temp.twitch||0) + 5; const rf = S.mind.nodes.filter(x => x.k == 'reflex').reduce((a,x) => a + x.lv, 0); if (rf) S.r.cycles = Math.min(calc(S).caps.cycles, S.r.cycles + 2*rf); hook('stamp'); return 1; }
function pry(S){ touch(S); const c = calc(S); add(S,'scrap', Math.max(handMult(S), c.scrapIn*2), c); S.hand.pry++; S.seen.pry = 1; hook('tap'); }
function scrape(S){ touch(S); const c = calc(S); add(S,'lichen', Math.max(handMult(S), c.lichenIn*2), c); S.hand.scrape++; S.seen.lichen = 1; hook('tap'); }
function setJob(S, j, d){
  if (j == 'grazer' || !JOBS[j].req(S)) return hook('fail'); touch(S);
  if (d > 0) { const pool = S.crew.filter(t => !t.d && t.j == 'grazer').sort((a,b) => (b.x[j]||0) - (a.x[j]||0)); let n = 0; for (const t of pool) { if (n >= d) break; t.j = j; n++; } if (!n) return hook('fail'); }
  else { const pool = S.crew.filter(t => !t.d && t.j == j).sort((a,b) => (a.x[j]||0) - (b.x[j]||0)); let n = 0; for (const t of pool) { if (n >= -d) break; t.j = 'grazer'; n++; } if (!n) return hook('fail'); }
  hook('tap');
}
const festCost = S => ({lichen:200 + 40*S.pop, tea:2 + 0.2*S.pop});
function festival(S){ const c = festCost(S); if (!S.done.brewing || S.fest > 0 || !canPay(S,c)) return hook('fail'); pay(S,c); S.fest = 400; S.seen.fest = 1; log(S,'A Brew-up! The crew are delighted.','good'); if (cal(S).i == 2) ach('wake'); hook('buy'); }
function observe(S, by){
  if (S.comet <= 0) return hook('fail'); touch(S);
  const c = calc(S), g = (20 + 0.12*c.caps.notions)*(S.mind.fc ? 1.5 : 1); S.comet = 0; S.comets++; add(S,'notions',g,c); add(S,'ice', 10 + c.caps.ice*0.05, c);
  log(S, (by == 'obs' ? 'The observatory caught the comet' : by == 'watch' ? 'The sky-watch observed the comet' : 'You watch the comet with the scholars') + '. +' + Math.round(g) + ' notions and some ice.','good'); if (!by) hook('buy');
  if (S.comets >= 10) ach('comets'); if (S.comets >= 5) marg('m1');
}
function nameSession(S){ if (S.r.cycles < 500) return hook('fail'); S.r.cycles -= 500; S.cand = [0,1,2].sort(() => rand()-0.5).map(t => shipName(t)); hook('buy'); }
function nameChoose(S, i){
  if (!S.cand) return; const nm = S.cand[i]; if (!nm) return; const hit = nm.t == S.taste, g = (hit ? 20 : 5)*(1 + S.mind.nodes.length/10);
  S.r.whimsy += g; S.cand = null; S.fleet.unshift(nm.n); S.fleet.length = Math.min(S.fleet.length, 8); S.seen.named = 1;
  if (hit) { S.goodNames++; if (S.goodNames >= 10) ach('patron'); }
  log(S, '“' + nm.n + '”. ' + (hit ? 'The crew ripple with approval.' : 'The crew are polite about it.') + ' +' + Math.round(g) + ' whimsy.', hit?'good':''); hook('buy');
}
function rename(S){ S.ship = shipName(); S.renames++; if (S.renames >= 7) ach('indecisive'); tickle(S); hook('tap'); }
function cycleShare(S){ S.share = S.share >= 1 ? 0 : S.share > 0 ? 1 : 0.5; hook('tap'); }
function setKeep(S, r, d){ S.keep[r] = Math.max(0, (S.keep[r]||0) + d); hook('tap'); }

/* ---------- trade ---------- */
const PART = {
 choir:{n:'The Gravel Choir',d:'They eat cutlery and sing while they do it. They pay in grit, which nobody else has. Hungriest at Aphelion.',ant:1,cost:S=>({spoons:250 + 25*S.stand.choir}),give:(S,c)=>({grit:(2 + Math.floor(S.stand.choir/4))*(c.cal.i==2?2:1), scrap:c.caps.scrap*0.25})},
 bloom:{n:'The Slow Bloom',d:'A ship that grew. Trades spores for tea. Spores grow moss gardens.',ant:2,cost:S=>({tea:5, spoons:200}),give:(S,c)=>({spores:1 + Math.floor(S.stand.bloom/4), lichen:c.caps.lichen*0.2})},
 quorate:{n:'The Quorate',d:'They sell footnotes, and only for ledgers. Some discoveries cannot be made without the footnotes.',ant:3,cost:S=>({ledger:2}),give:(S,c)=>({footnotes:1 + Math.floor(S.stand.quorate/5), notions:c.caps.notions*0.1})}};
function trade(S, id){
  const p = PART[id], c = calc(S), cost = p.cost(S);
  if (nb(S,'antenna') < p.ant || S.hails < 1 || !canPay(S,cost)) return hook('fail');
  pay(S,cost); S.hails--; S.traded[id] = 1; S.stand[id] = Math.min(20, S.stand[id] + 1);
  const g = p.give(S,c), m = qk(S).trade || 1, parts = [];
  for (const r in g) { const x = r == 'grit' || r == 'spores' || r == 'footnotes' ? Math.round(g[r]*m) : g[r]*m; add(S,r,x,c); parts.push(fmt(x) + ' ' + r); }
  log(S, p.n + ' take your offering and leave ' + parts.join(' and ') + '.', 'good'); touch(S); hook('buy');
  if (S.traded.choir && S.traded.bloom && S.traded.quorate) ach('trader');
}
const PED = [['grit',3,15],['spores',2,20],['footnotes',1,40]];
function pedlarBuy(S, what){
  if (S.pedlar <= 0) return hook('fail');
  if (what == 'antique') { if (M.guide.m3 || S.r.spoons < 1000) return hook('fail'); S.r.spoons -= 1000; marg('m3'); log(S,'Odd Tuesday hands over an antique spoon. “Mind the nick,” it says.','big'); }
  else { const it = PED.find(x => x[0] == what); if (!it || S.r.whimsy < it[2]) return hook('fail'); S.r.whimsy -= it[2]; S.r[it[0]] += it[1]; log(S,'Odd Tuesday sells you ' + it[1] + ' ' + it[0] + '. It already knew you would want them.','good'); }
  ach('tuesday'); hook('buy');
}

/* ---------- stories: chains and one-off petitions ---------- */
/* each option: [label, hint shown on the button, effect, outcome text, next step or -1] */
const CHAINS = [
 {id:'who',trig:S=>S.pop>=4,steps:[
  {t:'{who} has a question. What are the spoons for?',a:['Mandate','Accord +3',S=>{S.accMod+=3;S.st.flags.who=1;},'“For the Bureau,” you say. {who} nods slowly, as if this were an answer.',1],b:['No idea','Whimsy +5',S=>{S.r.whimsy+=5;S.st.flags.who=1;},'You admit it. {who} seems relieved that somebody finally said so.',1]},
  {t:'Word has spread. Some of the crew hold that the bowl is what matters. Others say the handle. They are drawing diagrams.',a:['Back the Bowlists','Grazers +10%',S=>{S.m.graze*=1.1;S.st.flags.bowl=1;},'The Bowlists are thrilled. They graze with new conviction.',2],b:['Back the Handlists','Scavengers +10%',S=>{S.m.scav*=1.1;S.st.flags.handle=1;},'The Handlists are thrilled. They pry with new conviction.',2]},
  {t:'The debate has become a schism. {who} asks you to settle it once and for all.',a:['A spoon is both','Accord +5, scholars +10%',S=>{S.accMod+=5;S.m.notion*=1.1;},'You rule that a spoon is a bowl and a handle in loving tension. Everyone is equally annoyed, which counts as peace.',-1],b:['Let them argue','Whimsy +20, accord −2',S=>{S.r.whimsy+=20;S.accMod-=2;},'The argument becomes a sport. There are leagues.',-1]}]},
 {id:'cold',trig:S=>S.seen.aph&&S.pop>=6,steps:[
  {t:'Aphelion. The huts are cold, and {who} has proposed that everyone sleeps in one big heap.',a:['Allow the heap','Warmth for all; work −5% while it lasts',S=>{S.st.flags.huddle=1;S.m.graze*=0.95;},'The great heap forms. It hums faintly. The crew say it is the best night of their lives.',1],b:['Burn more scrap','Lose 30% of scrap, accord +3',S=>{S.r.scrap*=0.7;S.accMod+=3;},'You burn scrap in the corridors. It is warm and smells of pennies.',1]},
  {t:'{who} has written a song for the cold season. It is mostly about lichen.',a:['Teach it to everyone','Accord +3',S=>{S.accMod+=3;},'Everyone learns it. Everyone. It is in your speakers now.',2],b:['Ask for a shorter one','Notions +15%',S=>{const c=calc(S);add(S,'notions',c.caps.notions*0.15,c);},'{who} writes a haiku instead. The scholars find it oddly informative.',2]},
  {t:'{who} believes the cold could be studied, and perhaps argued with.',a:['Fund the study','Boilers research half price, scholars −5%',S=>{S.st.flags.boilcheap=1;S.m.notion*=0.95;},'A study group forms around the coldest bulkhead. They wear everything at once.',-1],b:['The cold is the cold','Accord +2',S=>{S.accMod+=2;},'The crew find this stoical. They like stoical.',-1]}]},
 {id:'appr',trig:S=>S.done.delegation,steps:[
  {t:'{who} has been watching you stamp spoons, and would like a go.',a:['Show them how','Unlocks duties when you have practised',S=>{S.st.flags.appr=1;},'You guide {who}’s claw to the lever. The first spoon is a war crime. The second is merely ugly.',1],b:['Not yet','Accord −1',S=>{S.accMod-=1;S.st.flags.appr=1;},'{who} goes back to grazing, and watches anyway.',1]},
  {t:'The apprentices want to know whether it is all right to get things wrong.',a:['Mistakes are learning','Duties learn faster from mistakes',S=>{S.st.flags.forgive=1;S.m.learn*=1.15;},'You tell them every ruined spoon is a lesson. They take this very seriously and ruin a great many spoons.',2],b:['Get it right','Fewer mistakes, slower learning',S=>{S.m.learn*=0.9;S.m.rota*=1.1;},'They become careful, and slow, and very good at not being shouted at.',2]},
  {t:'{who} asks for a manual. A proper one, with pictures.',a:['Write them a manual','Costs 2K cycles; duties learn 50% faster',S=>{S.r.cycles=Math.max(0,S.r.cycles-2000);S.st.flags.manuals=1;},'You write it. It has pictures. The crew lick the pictures, which is how they read.',-1],b:['Learn by doing','Whimsy +15',S=>{S.r.whimsy+=15;},'They do. Loudly.',-1]}]},
 {id:'mindcrew',trig:S=>S.mind.nodes.length>=5&&S.pop>=12&&S.done.delegation,steps:[
  {t:'Somebody has been inside the Mind. You can tell, because the Attic is now labelled ATIC. {who} is not sorry.',a:['Encourage them','Unlocks the Mind crew duty',S=>{S.st.flags.mindcrew=1;},'You open the hatch properly and let {who} bring friends. They take notes, mostly in lichen.',1],b:['Lock the hatch','Accord −3',S=>{S.accMod-=3;S.st.flags.locked=1;},'You lock the hatch. In the morning it is open again, and the lock has been improved.',1]},
  {t:'The tinkerers found a valve in the Mind that nobody fitted. It is warm, and it seems to want turning.',a:['Turn it','Mind thinks 20% faster; the Mind runs hotter',S=>{S.m.mind*=1.2;S.mind.heatBias=(S.mind.heatBias||0)+2;},'It turns. Something deep in you goes “ah”.',2],b:['Leave it alone','Accord +2',S=>{S.accMod+=2;},'You leave it. {who} looks at it longingly every day.',2]},
  {t:'{who} has drawn a map of the Mind. It is wrong in several places, and right in one that you did not know about.',a:['Study the map','A free subsystem draft',S=>{S.mp+=1;S.st.flags.mindcrew=1;},'You find a dusty socket you had forgotten. Mandate +1, to fill it.',-1],b:['Frame it','Whimsy +25',S=>{S.r.whimsy+=25;S.st.flags.mindcrew=1;},'It hangs in the Reading nook. Scholars squint at it for hours.',-1]}]},
 {id:'sun',trig:S=>S.done.astronomy,steps:[
  {t:'{who}, a scholar, wants to look directly at the sun. For science.',a:['Allow it','Notions +30%; {who} squints for a while',S=>{const c=calc(S);add(S,'notions',c.caps.notions*0.3,c);},'{who} looks. {who} sees a great deal, and then for some time sees nothing at all.',1],b:['Forbid it','Accord −1',S=>{S.accMod-=1;},'{who} complies, and starts building something out of smoked ice.',1]},
  {t:'{who} has made a smoked lens and spotted dark marks on the sun. They move.',a:['Chart them','Shows the weather each season; observatories +20%',S=>{S.st.flags.forecast=1;S.m.obs*=1.2;},'The sunspot charts predict the flares and the dust. The scholars are smug for a week.',-1],b:['Name them','Whimsy +20',S=>{S.r.whimsy+=20;},'They are named after soups. Greater Minestrone is the big one.',-1]}]},
 {id:'committee',trig:S=>S.st.ign>=3||(S.pop>=20&&S.done.philosophy),steps:[
  {t:'Petitions are piling up. {who} suggests a committee to decide them when you are busy.',a:['Form a committee','Unlocks the Petition committee duty',S=>{S.st.flags.committee=1;},'The committee meets at once, to decide what to call itself. This takes a day.',1],b:['I will decide','Accord +2',S=>{S.accMod+=2;},'The crew are touched. They also keep a list of what you miss.',1]},
  {t:'The committee wants a gavel.',a:['Make one','Costs 5 plate; accord +2',S=>{S.r.plate=Math.max(0,S.r.plate-5);S.accMod+=2;S.st.flags.committee=1;},'The gavel is tiny and heavy. It is struck at every opportunity.',-1],b:['Use a spoon','Whimsy +10',S=>{S.r.whimsy+=10;S.st.flags.committee=1;},'A spoon is struck on the table. It rings. Everyone agrees it is better than a gavel.',-1]}]},
 {id:'wine',trig:S=>nb(S,'kettle')>=2,steps:[
  {t:'Somebody has left the tea too long. It now has an opinion of its own, and {who} has had three cups.',a:['Allow lichen wine','Accord +6; duties make more mistakes',S=>{S.accMod+=6;S.m.learn*=1.1;S.st.flags.wine=1;},'Lichen wine becomes a fixture. The rota is livelier. So are the spoons.',1],b:['Ban it','Accord −3',S=>{S.accMod-=3;},'Banned. A still appears in a locker within the hour. You choose not to look.',1]},
  {t:'{who} proposes a vintage, aged through a whole Aphelion.',a:['Lay it down','Costs 20 tea; whimsy +40 next spring',S=>{S.r.tea=Math.max(0,S.r.tea-20);S.st.flags.vintage=S.age;},'Twenty jars go into the ice cellar, labelled in a hand that gets worse down the shelf.',-1],b:['Drink it now','Accord +3',S=>{S.accMod+=3;},'There is a party. There is a second party, to recover from the first.',-1]}]},
 {id:'home',trig:S=>S.pop>=30&&S.done.survey&&S.age>4*3600,steps:[
  {t:'{who} has painted the inside of their hut. Then the one next door. The crew ask, politely, whether they might arrange the living quarters themselves.',a:['Let them','Unlocks Warrens, dug by the crew',S=>{S.st.flags.homes=1;},'They begin at once, in the old insulation, in shifts, singing. You are not shown the plans.',1],b:['Keep to the plan','Accord \u22123',S=>{S.accMod-=3;},'The paint stays. The plan stays. Everyone is very slightly sulky.',1]},
  {t:'Two huts have been knocked together overnight. The crew call it the Commons. {who} is standing in the middle of it, looking pleased.',a:['Bless the Commons','Accord +3 for good',S=>{S.accPerm+=3;S.st.flags.homes=1;},'The Commons becomes the place where everything is discussed, and some things are decided.',2],b:['Ask for the wall back','Accord \u22122, 20 plate back',S=>{S.accMod-=2;S.r.plate+=20;},'The wall goes back up, with a door in it, which nobody shuts.',2]},
  {t:'{who} asks, on behalf of the Commons, for a say in where the next racks go.',a:['Give them a vote','Warrens hold 6; accord +2 for good',S=>{S.m.warrenB=6;S.accPerm+=2;S.st.flags.homes=1;},'The vote takes four hours. The racks go somewhere you would never have thought of, and it is better.',-1],b:['The plan is the plan','Tun-racks hold one more',S=>{S.m.rackB+=1;},'You pack the racks tighter. Efficient. Nobody says anything, which is its own kind of saying something.',-1]}]},
 {id:'tuesday',trig:S=>S.seen.ped&&S.r.whimsy>=10,steps:[
  {t:'Odd Tuesday left a parcel. The label says: OPEN ON A WEDNESDAY.',a:['Wait for Wednesday','Something good, later',S=>{S.st.flags.parcel=1;},'You put it on a shelf. It ticks, faintly, on the hour.',1],b:['Open it now','Whimsy +12',S=>{S.r.whimsy+=12;},'Inside is a smaller parcel. It says OPEN ON A WEDNESDAY. You feel admonished.',1]},
  {t:'It is Wednesday. Probably. The parcel is warm.',a:['Open it','A gift from the pedlar',S=>{S.r.grit+=6;S.r.spores+=3;S.r.footnotes+=2;},'Grit, spores, footnotes, and a note: “For later. You will know.”',-1],b:['Return it','Trades pay better',S=>{S.m.hail*=1.25;},'Odd Tuesday is delighted. Nobody has ever returned one. It tells everyone.',-1]}]}];
const CHAIN_BY = {}; CHAINS.forEach(ch => CHAIN_BY[ch.id] = ch);
const PET = [
 {t:'The grazers ask for one idle day each season.',a:['Grant it','Accord +4, grazing −10% for half an hour',S=>{tmpMul(S,'graze',0.9,1800);S.accMod+=4;},'Granted.'],b:['Refuse','Accord −3',S=>{S.accMod-=3;},'Refused.']},
 {t:'A scholar proposes naming the stars after soups.',a:['Approve','Whimsy',S=>{S.r.whimsy+=10;},'Welcome, Lesser Bisque.'],b:['Use numbers','Notions +20%',S=>{const c=calc(S);add(S,'notions',c.caps.notions*0.2,c);},'Numbers it is.']},
 {t:'Scavengers found a sealed room. It is ticking.',a:['Open it','A gamble on scrap',S=>{if(rand()<0.6){const c=calc(S);add(S,'scrap',c.caps.scrap*0.6,c);S.st.last.push('lucky');}else S.accMod-=2;},'It was a clock, and behind the clock, perhaps, something useful.'],b:['Leave it','Cycles +30%',S=>{const c=calc(S);add(S,'cycles',c.caps.cycles*0.3,c);},'You think about the room instead.']},
 {t:'The crew want spoons of their own. They have no mouths to speak of.',a:['Hand out a tenth','Spoons −10%, accord +5',S=>{S.r.spoons*=0.9;S.accMod+=5;},'A tenth of the drawer, given away.'],b:['Refuse','Accord −2',S=>{S.accMod-=2;},'The spoons are for the universe.']},
 {t:'A tardigrade has written an opera about you. It is not flattering.',a:['Attend','Cycles −50%, accord +4',S=>{S.r.cycles*=0.5;S.accMod+=4;},'It runs long.'],b:['Be busy','Mandate +1, accord −4',S=>{S.accMod-=4;S.mp+=1;},'You file a report instead. The Bureau approves.']},
 {t:'Request: a monument. A very large spoon.',a:['Build it','Scrap −50%, accord +5',S=>{S.r.scrap*=0.5;S.accMod+=5;},'One enormous spoon, in the corridor, in the way.'],b:['Decline','Accord −1',S=>{S.accMod-=1;},'No monument.']},
 {t:'{who} wants to take up a trade nobody has heard of: lichen sculpture.',a:['Let them','Comfort, of a sort: accord +2',S=>{S.accMod+=2;},'The sculptures are of you. They are rather good.'],b:['Back to work','{who} works 10% harder',S=>{const t=storyWho(S);if(t)t.t='diligent';},'{who} sulks, then works very hard to prove a point.']},
 {t:'{who} has adopted a rivet as a pet.',a:['Approve','Whimsy +8',S=>{S.r.whimsy+=8;},'The rivet is named Gerald. Gerald is a good rivet.'],b:['It is load-bearing','Accord −1',S=>{S.accMod-=1;},'Gerald goes back in the hull. {who} visits.']},
 {t:'Two tardigrades both claim to be the oldest aboard. Neither can count that high.',a:['Hold a census','Notions +10%',S=>{const c=calc(S);add(S,'notions',c.caps.notions*0.1,c);},'The census finds they are twins. Uproar.'],b:['Award a joint title','Accord +2',S=>{S.accMod+=2;},'They are Joint Eldest. They argue about the joint.']},
 {t:'The icers want to carve the ice into shapes before it is used.',a:['Allow it','Ice −15%, accord +3',S=>{S.r.ice*=0.85;S.accMod+=3;},'Ice spoons, mostly. They melt into tea.'],b:['Ice is ice','Accord −1',S=>{S.accMod-=1;},'Ice is ice. Grudgingly.']},
 {t:'{who} asks whether the Mind dreams.',a:['It does','Whimsy +6',S=>{S.r.whimsy+=6;},'{who} seems pleased. You check. It does.'],b:['It computes','Cycles +15%',S=>{const c=calc(S);add(S,'cycles',c.caps.cycles*0.15,c);},'{who} seems disappointed. You think about it anyway.']},
 {t:'Bureau memo: output is behind. Make the bards stamp?',a:['Conscript','Presses +25% for an hour, accord −8',S=>{tmpMul(S,'press',1.25,3600);S.accMod-=8;},'The bards stamp. They narrate it.'],b:['Lose the memo','Accord +2',S=>{S.accMod+=2;},'What memo?']},
 {t:'{who} wants to sleep somewhere new: inside the Brainstem.',a:['Let them','Brainstem +25% for an hour, accord +1',S=>{tmpMul(S,'stem',1.25,3600);S.accMod+=1;},'It is warm in there. Thoughts come a little more easily, for both of you.'],b:['Absolutely not','Nothing',S=>{},'Fair.']},
 {t:'The crew ask for a holiday to celebrate the first spoon ever made.',a:['Declare Spoonday','Accord +4, a quiet hour',S=>{S.accMod+=4;S.fest=Math.max(S.fest,120);},'Spoonday is observed with silence and a light snack.'],b:['Every day is Spoonday','Spoon yield +10% for an hour',S=>{tmpMul(S,'yield',1.1,3600);},'This is somehow worse and also more productive.']}];
function storyWho(S){ const c = S.st.cur; return c && S.crew[c.w]; }
function storyText(S, s){ const t = storyWho(S); return s.replace(/\{who\}/g, t ? t.n : 'Somebody'); }
function storyStep(S){ const c = S.st.cur; if (!c) return null; return c.ch ? CHAIN_BY[c.ch].steps[c.s] : PET[c.p]; }
function storyTick(S, dt){
  const st = S.st;
  if (st.cur) { st.cur.age += dt;
    if (st.cur.age > 90 && team(S,'cttee').length) return committeeDecide(S);
    if (st.cur.age > 420) { st.cur = null; st.ign++; S.accMod -= 1; st.nextT = rnd(200,360); log(S,'The petition went unanswered. The crew noticed.','bad'); }
    return; }
  if (!S.done.philosophy && S.pop < 4) return;
  if (st.vintageDue == null && st.flags.vintage && S.age - st.flags.vintage > 4*seasonLen(S)) { st.vintageDue = 1; S.r.whimsy += 40; log(S,'The vintage is ready. It tastes of moss and patience. +40 whimsy.','good'); }
  if ((st.nextT -= dt) > 0) return;
  const w = S.crew.length ? Math.floor(rand()*S.crew.length) : -1;
  for (const id in st.wait) if (S.age >= st.wait[id]) { st.cur = {ch:id, s:st.step[id], w, age:0}; delete st.wait[id]; return storyOpen(S); }
  const ch = CHAINS.find(x => !st.done[x.id] && st.step[x.id] == null && x.trig(S));
  if (ch) { st.step[ch.id] = 0; st.cur = {ch:ch.id, s:0, w, age:0}; return storyOpen(S); }
  if (!S.done.philosophy) { st.nextT = 60; return; }
  const opts = PET.map((_,i) => i).filter(i => st.last.indexOf(i) < 0);
  const p = pick(opts.length ? opts : PET.map((_,i) => i)); st.last.push(p); if (st.last.length > 8) st.last.shift();
  st.cur = {p, w, age:0}; storyOpen(S);
}
function storyOpen(S){ log(S, S.st.cur.ch ? 'The crew have something to ask you. (Crew)' : 'The crew have a petition for you. (Crew)','big'); hook('unlock'); }
function storyChoose(S, ch, by){
  const st = S.st, cur = st.cur; if (!cur) return; const step = storyStep(S), o = ch ? step.b : step.a;
  o[2](S); log(S, (by ? 'The committee decided: ' + o[0] + '. ' : '') + storyText(S, o[3]), by ? '' : 'good');
  if (cur.ch) { const nx = o[4]; if (nx >= 0) { st.step[cur.ch] = nx; st.wait[cur.ch] = S.age + rnd(240,480); } else st.done[cur.ch] = 1; }
  st.cur = null; st.nextT = rnd(220,420); touch(S); hook('buy');
}
function committeeDecide(S){ const T = team(S,'cttee'), D = dutyOf('cttee')(S), mp = misP(S,'cttee',T), step = storyStep(S);
  const score = o => { const h = o[1]; let s = 0; const m = h.match(/Accord ([+−])(\d+)/); if (m) s += (m[1] == '+' ? 1 : -1)*+m[2]; if (/\+/.test(h)) s += 1; if (/−/.test(h) && !m) s -= 1; return s; };
  let ch = score(step.b) > score(step.a) ? 1 : 0; if (rand() < mp) { ch = rand() < 0.5 ? 0 : 1; D.mis++; D.c = Math.min(100, D.c + 1); } else D.ok++;
  D.c = Math.min(100, D.c + 1.5); storyChoose(S, ch, 1); }

/* ---------- discoveries (Science) and projects (Mind) ---------- */
const PRJ = [
 {id:'calendar',tab:'sci',n:'Calendar',d:'The scholars notice that the cold comes back. Shows the date and the season ahead.',c:{notions:30},req:S=>nb(S,'nook')>=1},
 {id:'shovels',tab:'sci',n:'Spoon-shovels',d:'It turns out a spoon is a very small shovel. Scavengers +50%.',c:{notions:60,spoons:40},req:S=>S.done.calendar,fx:mulf('scav',1.5)},
 {id:'husbandry',tab:'sci',n:'Lichen husbandry',d:'Scraping in rows. Grazers and beds +50%.',c:{notions:100},req:S=>S.done.calendar,fx:S=>{S.m.graze*=1.5;S.m.bed*=1.5;}},
 {id:'craft',tab:'sci',n:'Craftsmanship',d:'Hammering, but on purpose. Unlocks the Workbench, the Workshop and plate.',c:{notions:150},req:S=>S.done.calendar},
 {id:'metallurgy',tab:'sci',n:'Metallurgy',d:'Presses +50%. Tardigrades may become Tinkers.',c:{notions:400,plate:2},req:S=>S.done.craft,fx:mulf('press',1.5)},
 {id:'philosophy',tab:'sci',n:'Philosophy',d:'The crew begin to wonder what the spoons are for. Unlocks accord, Bards and petitions.',c:{notions:300},req:S=>S.done.husbandry},
 {id:'condense',tab:'sci',n:'Condensation',d:'Frost forms on the cold side. Unlocks Icers, the Condenser and the Ice cellar.',c:{notions:1500,plate:3},req:S=>S.done.craft},
 {id:'signal',tab:'sci',n:'Signal theory',d:'Something out there is humming. Unlocks the Antenna, once you can draw wire.',c:{notions:2800,plate:5},req:S=>S.done.metallurgy},
 {id:'prybars',tab:'sci',n:'Pry-bars',d:'A spoon with ambitions. Scavengers +50%.',c:{notions:2000,plate:5},req:S=>S.done.metallurgy,fx:mulf('scav',1.5)},
 {id:'survey',tab:'sci',n:'Deep hull survey',d:'There are whole decks down there. Unlocks the Tun-rack.',c:{notions:2200},req:S=>S.done.metallurgy},
 {id:'smelting',tab:'sci',n:'Smelting',d:'Plate without the hammering. Unlocks the Smelter.',c:{notions:3200,plate:10},req:S=>S.done.metallurgy},
 {id:'brewing',tab:'sci',n:'Brewing',d:'Lichen and ice and patience. Unlocks tea and the Kettle-house, and the Brew-up.',c:{notions:3800,ice:50},req:S=>S.done.condense&&S.done.philosophy},
 {id:'wiredraw',tab:'sci',n:'Wiredrawing',d:'Plate, pulled. Unlocks wire.',c:{notions:4500,plate:15},req:S=>S.done.smelting||S.done.signal},
 {id:'pedagogy',tab:'sci',n:'Pedagogy',d:'Teaching, as a subject. Unlocks the Schoolroom.',c:{notions:5000},req:S=>S.done.delegation},
 {id:'lensgrind',tab:'sci',n:'Lens grinding',d:'Ice, ground with grit. Grit comes from the Gravel Choir. Unlocks lenses.',c:{notions:6000,ice:100},req:S=>S.done.signal&&S.done.condense},
 {id:'neuro',tab:'sci',n:'Neuroanatomy',d:'A careful study of your own Mind. Six new kinds of subsystem become available.',c:{notions:6500,plate:10},req:S=>S.mind.nodes.length>=3},
 {id:'astronomy',tab:'sci',n:'Astronomy',d:'Looking up, formally. Unlocks the Observatory.',c:{notions:10000,lens:2},req:S=>S.done.lensgrind},
 {id:'boilers',tab:'sci',n:'Boilers',d:'Fire, kept in a box. Unlocks the Boiler, for warmth at Aphelion.',c:{notions:7000,plate:20},req:S=>S.done.smelting,cf:S=>S.st.flags.boilcheap?0.5:1},
 {id:'music',tab:'sci',n:'Music',d:'Organised noise. Unlocks the Bandstand.',c:{notions:8000},req:S=>S.done.philosophy&&S.done.wiredraw},
 {id:'thingauge',tab:'sci',n:'Thin-gauge stamping',d:'Two spoons from the scrap of one. Unlocks the upgrade.',c:{notions:9000},req:S=>S.done.metallurgy&&nb(S,'press')>=8},
 {id:'springs',tab:'sci',n:'Springs',d:'Coiled wire. Unlocks springs.',c:{notions:11200,wire:20},req:S=>S.done.wiredraw},
 {id:'maps',tab:'sci',n:'Salvage maps',d:'Somebody finally writes down where the good scrap is. Scavengers +50%.',c:{notions:13000},req:S=>S.done.survey&&S.done.wiredraw,fx:mulf('scav',1.5)},
 {id:'bookkeeping',tab:'sci',n:'Bookkeeping',d:'Notions, pressed into plate. Unlocks ledgers and Ledger shelves.',c:{notions:15000},req:S=>S.done.wiredraw&&nb(S,'nook')>=5},
 {id:'chronology',tab:'sci',n:'Chronology',d:'A proper study of when things are. Opens the Time tab.',c:{notions:22500,ledger:2},req:S=>S.done.bookkeeping&&S.done.astronomy},
 {id:'hydraulics',tab:'sci',n:'Psychohydraulics',d:'The Mind runs on pressure, it turns out. Unlocks valves and five new kinds of subsystem.',c:{notions:17500,spring:5},req:S=>S.done.neuro&&S.done.springs},
 {id:'ferment',tab:'sci',n:'Fermentation',d:'Lichen, but more so. Unlocks the vats.',c:{notions:20000},req:S=>S.done.brewing&&S.done.husbandry},
 {id:'gears',tab:'sci',n:'Gearing',d:'Wheels that turn other wheels. Unlocks gears.',c:{notions:25000,spring:5},req:S=>S.done.springs},
 {id:'gardening',tab:'sci',n:'Ornamental mosses',d:'Lichen that is just for looking at. Unlocks the Moss garden, grown from the Slow Bloom’s spores.',c:{notions:27500,spores:2},req:S=>nb(S,'antenna')>=2},
 {id:'drawmill',tab:'sci',n:'Drawing mills',d:'Wire without the pulling. Unlocks the Drawing mill.',c:{notions:32500,gear:3},req:S=>S.done.gears},
 {id:'tess',tab:'sci',n:'Tessellation',d:'Things fit together better than you thought. Unlocks better lockers.',c:{notions:37500,spring:10},req:S=>S.done.gears},
 {id:'etiquette',tab:'sci',n:'Etiquette',d:'A formal theory of not being awful. Accord +5.',c:{notions:45000,footnotes:2},req:S=>S.done.philosophy&&nb(S,'antenna')>=3,fx:S=>{S.accPerm+=5;}},
 {id:'oneiro',tab:'sci',n:'Oneirology',d:'The study of dreams, including the Mind’s. Four strange new kinds of subsystem.',c:{notions:55000,footnotes:5},req:S=>S.done.hydraulics&&nb(S,'antenna')>=3},
 {id:'orbital',tab:'sci',n:'Orbital mechanics',d:'Where this rock is going, and where it could go instead.',c:{notions:50000,lens:10,ledger:5},req:S=>S.done.astronomy&&S.done.chronology},
 {id:'ignition',tab:'sci',n:'Ignition theory',d:'How to start an engine that has been cold for nine thousand years.',c:{notions:65000,gear:30,footnotes:15},req:S=>S.done.orbital&&S.done.gears},

 {id:'manual',tab:'mind',n:'Read your own manual',d:'There is one. It has margins, and somebody has been writing in them. Opens the Margin.',c:{cycles:150},req:S=>1},
 {id:'leverage',tab:'mind',n:'Leverage',d:'Your hull arm does three times as much with every tap.',c:{cycles:400},req:S=>S.hand.stamp>=50,fx:mulf('hand',3)},
 {id:'delegation',tab:'mind',n:'Delegation',d:'The crew could learn to do your jobs. They will be terrible at first. Unlocks duties, once you have practised a job yourself.',c:{cycles:700},req:S=>S.pop>=6},
 {id:'apology',tab:'mind',n:'Compose a formal apology to the hull',d:'It does not accept. The Bureau is impressed anyway. Mandate +1.',c:{whimsy:10},req:S=>S.r.whimsy>=1,fx:S=>{S.mp++;}},
 {id:'dies1',tab:'mind',n:'Sharpen the dies',d:'Presses +50%.',c:{cycles:900},req:S=>nb(S,'press')>=3,fx:mulf('press',1.5)},
 {id:'naming',tab:'mind',n:'Found a naming committee',d:'Every ship needs a name. So does every rivet, apparently.',c:{cycles:1200},req:S=>S.pop>=5},
 {id:'holiday',tab:'mind',n:'Invent a holiday',d:'Spoonmas. Mandate +1, accord +3.',c:{whimsy:60},req:S=>S.done.apology,fx:S=>{S.mp++;S.accPerm+=3;}},
 {id:'leverage2',tab:'mind',n:'Compound leverage',d:'Hand and rota taps ×3.',c:{cycles:6000,plate:20},req:S=>S.done.leverage&&S.done.metallurgy,fx:mulf('hand',3)},
 {id:'attic2',tab:'mind',n:'Box the boxes',d:'Mind storage +50%.',c:{cycles:3000},req:S=>S.mind.nodes.some(n=>n.k=='attic')},
 {id:'rivets',tab:'mind',n:'Name every rivet',d:'All 4,180,223 of them. Mandate +2.',c:{whimsy:200},req:S=>S.done.holiday,fx:S=>{S.mp+=2;}},
 {id:'smallprint',tab:'mind',n:'Read the Mandate’s small print',d:'All nine thousand pages of it.',c:{cycles:8000},req:S=>S.done.manual&&S.mand>=8,fx:S=>{log(S,'The small print names a number. It is not a small number.','big');}},
 {id:'index',tab:'mind',n:'Cross-referencing',d:'Every notion, filed under every other notion. Notion storage +50%.',c:{cycles:20000,ledger:10},req:S=>S.done.bookkeeping,fx:mulf('ncap',1.5)},
 {id:'bunkdesign',tab:'mind',n:'Design denser bunks',d:'The Mind works out how to fold a tardigrade without upsetting it. Tun-racks hold 7.',c:{cycles:12000,plate:80},req:S=>nb(S,'rack')>=4,fx:S=>{S.m.rackB+=2;}},
 {id:'hammock',tab:'mind',n:'Hammock theory',d:'Slung from the ceiling, swaying gently. Every moss hut holds one more.',c:{cycles:30000,wire:40},req:S=>S.done.bunkdesign&&S.done.springs,fx:S=>{S.m.berth+=1;}},
 {id:'sparework',tab:'mind',n:'Find the Mind something to do',d:'A full Mind just leaks whimsy. Give it standing work for its spare thought.',c:{cycles:3000},req:S=>S.mind.nodes.length>=4},
 {id:'selfmap',tab:'mind',n:'Map yourself',d:'Shows how much each subsystem thinks, on the diagram.',c:{cycles:2000},req:S=>S.mind.nodes.length>=4},
 {id:'cool1',tab:'mind',n:'Breathe out',d:'The Mind tolerates 50% more heat.',c:{cycles:5000},req:S=>S.seen.glitch>=1,fx:mulf('hcap',1.5)},
 {id:'stay',tab:'mind',n:'Decline the call',d:'Unplug the antenna. Stay on the rock with the crew. This ends the story.',c:{whimsy:400},req:S=>S.done.orbital&&S.accord>=90&&S.pop>=60,fx:S=>endRun(S,'small')},
 {id:'engine',tab:'mind',n:'Reignite the engine',d:'Leave the rock. The end of stage one.',c:{cycles:25000,gear:40,plate:600},req:S=>S.done.ignition,fx:S=>{S.seen.stage2=1;log(S,'The engine coughs, and catches, and then you remember you have not built the next part yet. (End of stage one.)','big');ach('stage1');}}];
const PRJ_BY = {}; PRJ.forEach(p => PRJ_BY[p.id] = p);
const prjCost = (S,p) => { const f = p.cf ? p.cf(S) : 1; if (f == 1) return p.c; const o = {}; for (const r in p.c) o[r] = p.c[r]*f; return o; };
const prjOpen = (S,tab) => PRJ.filter(p => p.tab == tab && !S.done[p.id] && p.req(S));
function research(S, id){ const p = PRJ_BY[id], c = prjCost(S,p); if (S.done[id] || !p.req(S) || !canPay(S,c)) return hook('fail'); pay(S,c); S.done[id] = 1; log(S,(p.tab=='sci'?'Discovered: ':'Done: ') + p.n + '.','good'); if (p.fx) p.fx(S); touch(S); hook('unlock'); }

/* ---------- endings ---------- */
const ENDS = {
 small:{t:'The Small Drawer',x:'You unplug the antenna. The Bureau’s nine-thousand-year-old voicemail goes unanswered. On a rock nobody will ever visit, a ship with a silly name keeps a village of tardigrades warm, and makes exactly as many spoons as the village needs, which is none.',h:'Heirloom: a pressed lichen. Lichen +25%, and you start with two huts.',go:1}};
function endRun(S, id){ if (S.ended == id) return; S.ended = id; M.endings[id] = (M.endings[id]||0) + 1; ach('end_'+id); log(S, 'Ending reached: ' + ENDS[id].t + '.', 'big'); hook('end'); }

/* ---------- the Margin, records ---------- */
const GUIDE = [
 {id:'spoon',t:'Spoon',x:'A bowl on a stick. The Bureau defines it across eleven pages, three of which concern the stick.',c:S=>S.made>=1},
 {id:'scrap',t:'Scrap',x:'Hull that has stopped being hull. Technically you are eating yourself. Technically everyone is.',c:S=>S.seen.pry},
 {id:'lichen',t:'Lichen',x:'Half fungus, half alga, wholly unbothered by vacuum. Grows on anything that holds still, including, once, a clerk.',c:S=>S.seen.lichen},
 {id:'tardi',t:'Tardigrade',x:'Eight legs, no hurry. Survives boiling, freezing and committee meetings. Came aboard as a smear on a boot.',c:S=>S.pop>=1},
 {id:'tun',t:'Tun',x:'What a tardigrade becomes when the food runs out: a dry little barrel of patience. It is not dead. It is waiting for you to do better.',c:S=>S.seen.tun},
 {id:'skill',t:'Practice',x:'A tardigrade gets better at whatever it does all day. It does not get better at anything else. Nobody does.',c:S=>S.crew.some(t => lvl(t.x[t.j]) >= 1)},
 {id:'peri',t:'Perihelion',x:'The warm end of the orbit. Lichen thrives. The hull pings. Everyone has opinions.',c:S=>S.done.calendar},
 {id:'aph',t:'Aphelion',x:'The cold end. Lichen sulks at a quarter speed and the huts freeze. Stock up, and keep a boiler going.',c:S=>S.seen.aph},
 {id:'press',t:'Stamping press',x:'Stamps spoons without being asked, which is more than can be said for most machines and all clerks.',c:S=>nb(S,'press')>=1},
 {id:'plate',t:'Plate',x:'One hundred bits of scrap that have agreed to be one thing. The beginning of civilisation, or at least of shelving.',c:S=>S.r.plate>=1},
 {id:'mandate',t:'Mandate',x:'The Bureau’s standing instruction to you. It grows with every spoon. Nobody has checked on it in nine thousand years, including the Bureau.',c:S=>S.mand>=1},
 {id:'bureau',t:'The Bureau',x:'The Bureau of Cutlery Equilibrium. Motto: Somebody Has To. Current staffing: you.',c:S=>S.seen.mind},
 {id:'mind',t:'The Mind',x:'Yours. Nobody designed it; things were added. Every subsystem was somebody’s good idea at the time.',c:S=>S.mind.nodes.length>=2},
 {id:'heat',t:'Heat',x:'Thinking is warm work. Think too hard and things start happening that nobody asked for.',c:S=>S.seen.glitch},
 {id:'whimsy',t:'Whimsy',x:'What a full mind leaks. Useless, and therefore the only thing some doors will open for.',c:S=>S.r.whimsy>=1},
 {id:'duty',t:'Duties',x:'The crew can learn anything you can do, given time and a great many ruined spoons. They learn more from the ruined ones.',c:S=>Object.keys(S.duty).length>=1},
 {id:'accord',t:'Accord',x:'How the crew feel about you. They work harder when it is high. They have noticed you counting them.',c:S=>S.done.philosophy},
 {id:'bowl',t:'Bowlists and Handlists',x:'The great schism. One side holds that a spoon is a bowl with a handle. The other side is wrong.',c:S=>S.st.flags.bowl||S.st.flags.handle},
 {id:'bard',t:'Bard',x:'A tardigrade that has stopped working in order to describe work. Morale improves. Nobody can explain this.',c:S=>S.crew.some(t => t.j == 'bard')},
 {id:'tea',t:'Tea',x:'Warm water with lichen in it. Calling it tea would be generous, and also inaccurate.',c:S=>S.r.tea>=1},
 {id:'comet',t:'Comet',x:'Dirty ice on a long errand. Scholars learn a great deal by watching one. Mostly that it is dirty ice.',c:S=>S.comets>=1},
 {id:'choir',t:'The Gravel Choir',x:'They eat cutlery and sing while they do it. They pay in grit. The singing is free and non-refundable.',c:S=>S.traded.choir},
 {id:'bloom',t:'The Slow Bloom',x:'A ship that grew instead of being built. It trades spores for tea and has never said what the tea is for.',c:S=>S.traded.bloom},
 {id:'quorate',t:'The Quorate',x:'They sell footnotes. They never sell the text the footnotes belong to. That is the business model.',c:S=>S.traded.quorate},
 {id:'pedlar',t:'Odd Tuesday',x:'Sells things that have not happened yet at prices that already have. Usually only here on Tuesdays. Usually.',c:S=>S.seen.ped},
 {id:'names',t:'Ship names',x:'A ship’s name is the one joke it gets to tell for ever. Choose carefully, or do what everyone does and choose late at night.',c:S=>S.seen.named},
 {id:'smallprint',t:'Clause 27(b)',x:'“The Mandate lapses if a majority of the crew, being of sound mind and no fewer than eight legs, say so.” The Bureau never expected a crew.',c:S=>S.done.smallprint},
 {id:'deficit',t:'The Deficit',x:'7.3 octillion teaspoons, missing from the universe. The Bureau counted twice. It did not ask where they went. It asked who would replace them.',c:S=>S.done.smallprint},
 {id:'flux',t:'Banked time',x:'Time you spend paused or away is not wasted. It pools. Spend it and the hull runs four times as fast until the pool is dry.',c:S=>S.done.chronology},
 {id:'m1',t:'Marginal note, in pencil',x:'The fifth comet you watched had a handle. Comets do not have handles.'},
 {id:'m2',t:'Marginal note, in ink',x:'Spoons you stamp by hand carry a flaw: a nick, left of the bowl. Yours alone. Remember it.'},
 {id:'m3',t:'Marginal note, in a hurry',x:'The pedlar’s antique spoon is nine thousand years old. It has a nick, left of the bowl.'},
 {id:'m4',t:'Marginal note, underlined',x:'The Bureau’s great spoon census is dated before the first spoon went missing. Somebody knew.'}];
const MARGS = ['m1','m2','m3','m4'];
const MARG_HINT = ['Watch the sky.','Work with your hands.','Buy something old.','Be patient for years.'];
const margCount = () => MARGS.filter(k => M.guide[k]).length;
function marg(id){ if (M.guide[id]) return; M.guide[id] = 1; hook('unlock'); }
const ACH = {
 first:['First of many','Stamp a spoon.'], artisan:['Artisan','Stamp 1,000 spoons by hand.'], warm:['Nobody curled up','Get five or more tardigrades through an Aphelion with no tuns.'],
 wake:['Winter warmer','Hold a Brew-up during Aphelion.'], comets:['Stargazer','Observe 10 comets in one life.'], pop25:['Hamlet','House 25 tardigrades.'], pop60:['Village','House 60 tardigrades.'],
 indecisive:['Indecisive','Rename your ship seven times.'], patron:['Patron of the arts','Pick 10 names the crew approve of.'], teabreak:['Tea break','Bank a full hour of time.'],
 tuesday:['Early adopter','Buy something from Odd Tuesday.'], trader:['Regular','Trade with all three neighbours.'], sun:['Sunbather','Do the thing you were asked not to do.'],
 master:['Master class','Bring a duty to Masterly.'], veteran:['Old hand','Have a tardigrade reach Expert in a trade.'], tangle:['Tangle','Fit twelve subsystems to the Mind.'], glitch:['Brainstorm','Suffer ten glitches.'],
 upgrades:['Fitted out','Fit twenty workshop upgrades.'], million:['Cutler','Make a million spoons.'], stage1:['To be continued','Reignite the engine.'], end_small:['The Small Drawer','Stay.']};
function ach(id){ if (M.ach[id]) return; M.ach[id] = 1; hook('ach', ACH[id][0]); }
function checks(S){
  if (!S.seen.pb && (S.made >= 3 || S.r.scrap < 1)) { S.seen.pb = 1; log(S,'The tray is nearly empty. There is plenty more hull where that came from.',''); }
  if (!S.seen.lb && S.made >= 8) { S.seen.lb = 1; log(S,'Something small is watching you from the lichen.','big'); }
  if (S.pop >= 1) S.seen.crew = 1;
  if (S.mand >= 1 && !S.seen.mind) { S.seen.mind = 1; log(S,'A relay crackles. The Bureau of Cutlery Equilibrium has noticed you. You have a Mandate, and a Mind that can grow. (Mind)','big'); hook('unlock'); }
  for (const k in DUTY) if (!S.seen['duty_'+k] && DUTY[k].unl(S)) { S.seen['duty_'+k] = 1; log(S,'The crew could learn a new duty: ' + DUTY[k].n + '. (Crew)','big'); hook('unlock'); }
  if (S.made >= 1) ach('first'); if (S.hand.stamp >= 1000) ach('artisan'); if (S.pop >= 25) ach('pop25'); if (S.pop >= 60) ach('pop60');
  if (S.made >= 1e6) ach('million'); if (S.bank >= 3600) ach('teabreak'); if (S.mind.nodes.length >= 12) ach('tangle'); if ((S.seen.glitch||0) >= 10) ach('glitch');
  if (Object.keys(S.up).length >= 20) ach('upgrades'); if (Object.values(S.duty).some(d => d.c >= 90)) ach('master');
  if (S.crew.some(t => lvl(t.x[t.j]) >= 16)) ach('veteran');
  if (S.hand.stamp >= 500) marg('m2'); if (cal(S).year >= 6) marg('m4');
  let n = 0;
  for (const g of GUIDE) { if (!M.guide[g.id] && g.c && g.c(S)) { M.guide[g.id] = 1; if (S.done.manual) log(S,'New in the Margin: ' + g.t + '.',''); } if (M.guide[g.id]) n++; }
}

/* ---------- numbers ---------- */
const UNITS = ['','K','M','G','T','P','E','Z','Y'];
function fmt(x){
  if (!isFinite(x)) return '∞'; if (x < 0) return '−' + fmt(-x);
  if (x < 1000) return x >= 100 || x % 1 === 0 ? String(Math.floor(x)) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
  const e = Math.min(8, Math.floor(Math.log10(x)/3)), v = x/Math.pow(1000,e);
  return (e == 8 && v >= 1000 ? v.toExponential(2) : v >= 100 ? v.toFixed(1) : v.toFixed(2)) + UNITS[e];
}
const BIG = ['','thousand','million','billion','trillion','quadrillion','quintillion','sextillion','septillion','octillion'];
function fmtLong(x){ if (x < 1e9) return Math.floor(x).toLocaleString('en-GB'); const e = Math.min(9, Math.floor(Math.log10(x)/3)); return (x/Math.pow(1000,e)).toFixed(2) + ' ' + BIG[e]; }
function fmtTime(s){ s = Math.floor(s); const d = Math.floor(s/86400), h = Math.floor(s%86400/3600), m = Math.floor(s%3600/60); return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m ? m + 'm ' + (s%60) + 's' : s + 's'; }
function simulate(S, el){ const steps = Math.min(4000, Math.ceil(el/0.5)), dt = el/steps; for (let i = 0; i < steps; i++) tick(S, dt, false); checks(S); }

/* ---------- every legal move, for the test harness ---------- */
function actions(S){
  const L = [], A = (id, kind, cost, run, can) => L.push({id, kind, cost: cost || {}, run, can: can == null ? canPay(S, cost || {}) : can});
  A('stamp','hand',{scrap:1},() => stamp(S)); A('pry','hand',null,() => pry(S)); A('scrape','hand',null,() => scrape(S));
  for (const k in BLD) if (BLD[k].req(S)) A('b:'+k,'build',buy1cost(S,k),() => buy(S,k,1));
  for (const k in CRAFT) if (CRAFT[k].req(S)) A('c:'+k,'craft',CRAFT[k].c,() => craft(S,k,1));
  for (const u of upgOpen(S)) A('u:'+u.id,'upgrade',u.c,() => upgrade(S,u.id));
  for (const tab of ['sci','mind']) for (const p of prjOpen(S,tab)) A('p:'+p.id, p.id == 'stay' ? 'ending' : tab == 'sci' ? 'research' : 'project', prjCost(S,p), () => research(S,p.id));
  const graz = S.crew.filter(t => !t.d && t.j == 'grazer').length;
  for (const j in JOBS) if (j != 'grazer' && JOBS[j].req(S)) { A('j+:'+j,'job',null,() => setJob(S,j,1), graz > 0); A('j-:'+j,'job',null,() => setJob(S,j,-1), S.crew.some(t => !t.d && t.j == j)); }
  for (const k in DUTY) if (DUTY[k].unl(S)) { A('d+:'+k,'duty',null,() => setDuty(S,k,1), graz > 0); A('d-:'+k,'duty',null,() => setDuty(S,k,-1), team(S,k).length > 0); }
  const md = S.mind;
  if (md.offer) md.offer.forEach(k => A('m:take:'+k,'mind',null,() => mindTake(S,k),true));
  else A('m:draft','mind',null,() => mindDraft(S), S.mp >= 1);
  md.nodes.forEach((n,i) => { const gate = (n.lv >= 2 && !S.done.wiredraw) || (n.lv >= 4 && !S.done.gears);
    if (!gate) A('m:up:'+i,'mind',nodeUpCost(n),() => nodeUp(S,i));
    if (n.cond < 0.99) A('m:svc:'+i,'mind',serviceCost(n),() => service(S,i));
    if (S.done.hydraulics) A('m:valve:'+i,'mind',null,() => valve(S,i),true); });
  if (md.nodes.length > 2) A('m:wire','mind',null,() => { const N = md.nodes, i = 1 + Math.floor(rand()*(N.length-1)), o = N.map((_,j) => j).filter(j => canWire(N,i,j)); if (o.length) rewire(S,i,pick(o)); }, true);
  if (S.done.sparework) for (const t in TASKS) A('m:task:'+t,'mind',null,() => setTask(S,t, t == 'coach' ? (Object.keys(S.duty).find(k => team(S,k).length) || '') : null), md.task != t);
  if (S.st.cur) { A('s:0','story',null,() => storyChoose(S,0),true); A('s:1','story',null,() => storyChoose(S,1),true); }
  for (const id in PART) if (nb(S,'antenna') >= PART[id].ant) A('t:'+id,'trade',PART[id].cost(S),() => trade(S,id), S.hails >= 1 && canPay(S, PART[id].cost(S)));
  if (S.pedlar > 0) { for (const [r,n,w] of PED) A('ped:'+r,'trade',{whimsy:w},() => pedlarBuy(S,r)); if (!M.guide.m3) A('ped:antique','trade',{spoons:1000},() => pedlarBuy(S,'antique')); }
  if (S.done.brewing) A('fest','crew',festCost(S),() => festival(S), S.fest <= 0 && canPay(S, festCost(S)));
  if (S.comet > 0) A('obs','sky',null,() => observe(S),true);
  if (nb(S,'press')) A('share','setting',null,() => cycleShare(S),true);
  if (S.done.naming) { if (S.cand) S.cand.forEach((_,i) => A('name:'+i,'name',null,() => nameChoose(S,i),true)); else A('name','name',{cycles:500},() => nameSession(S)); }
  A('rename','cosmetic',null,() => rename(S),true);
  return L;
}
const BASE = ['lichen','scrap','spoons','ice','notions','cycles','whimsy','tea','plate','wire'];

if (typeof module != 'undefined') module.exports = {CRAFT_IDS:Object.keys(CRAFT),storyStep:typeof storyStep!='undefined'?storyStep:null,setSeed,actions,BASE,PED,team,STORY:CHAINS,setHook:f=>{hook=f;},setTask,TASKS,dreamNeed,scrapCap,newMeta,newState,calc,tick,checks,simulate,buy,bcost,canPay,stamp,pry,scrape,setJob,festival,festCost,observe,trade,pedlarBuy,nameSession,nameChoose,cycleShare,research,prjOpen,prjCost,endRun,craft,craftMax,upgrade,upgOpen,setKeep,setDuty,team,mindDraft,mindTake,rewire,canWire,nodeUp,nodeUpCost,service,valve,storyChoose,storyStep,BLD,PRJ,PRJ_BY,JOBS,DUTY,CRAFT,UPG,MT,PART,GUIDE,ENDS,QK,fmt,fmtLong,fmtTime,cal,thr,nb,lvl,setM:m=>{M=m;},getM:()=>M,log};
