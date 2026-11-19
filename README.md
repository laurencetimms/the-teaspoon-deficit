# The Teaspoon Deficit

> **Branch `stage-one`:** a rebuild of the first era for a longer game. It adds a Workshop with crafting chains and upgrades, crew with traits and skills, duties the crew learn by trial and error, a Mind grown from oddly named subsystems, story chains, and neighbours who sell what you cannot make. It ends when you reignite the engine; stage two comes next.

An idle game for small creatures and large mistakes. You are a derelict cutlery ship, woken after nine thousand years with one instruction (spoons) and a crew of tardigrades who moved in by accident.

It is a mash-up in spirit of village-building idle games, paperclip-style runaway optimisers and dry British space comedy. All names, text and mechanics are original.

## Play

Open `index.html` in a browser. That one file is the whole game: no images, fonts, libraries or network requests. The window at the top is drawn by a fragment shader; everything else is plain DOM.

- Touch-first, and works with a mouse.
- Saves itself to the browser every ten seconds, and keeps working for up to twelve hours while you are away.
- Pause stops the hull and banks time, which can be spent later to run at four times speed.
- Menu → *Copy or load a save code* moves a save between devices.
- Five endings. Each leaves an heirloom for later lives, and each new life offers a quirk.

## Deploy

Any static host will do. For GitHub Pages: Settings → Pages → deploy from the `main` branch, root folder.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The built game. Generated; do not edit by hand. |
| `src/core.js` | Game rules, content and balance numbers. No DOM, so it also runs in Node. |
| `src/gl.js` | The shader and its WebGL setup. |
| `src/ui.js` | Interface, saving and the clock. |
| `src/index.tpl.html` | Page shell and styles. |
| `build.py` | Inlines `src/` into `index.html`, plus `build/test.html` for the tools. |
| `tools/sim.js` | A headless bot that plays a whole life and prints when each milestone lands. |
| `tools/harness/` | The test harness: many kinds of simulated player, detectors for deadlocks, walls, grinds and long waits, and an HTML report. |
| `tools/shot.js`, `tools/play.js` | Browser checks: screenshots at phone and desktop sizes, and a scripted tap-through. |

## Build and check

```sh
python3 build.py                 # writes index.html and build/test.html
node tools/sim.js 1 60           # attentive bot, up to 60 game hours
node tools/sim.js 0.005 100      # a bot that acts about once every three minutes
```

The browser tools need Playwright (`npm i playwright`). They read the state files `tools/sim.js` writes to `build/`, so run a simulation first. Set `CHROME=/path/to/chrome` to use an installed browser.

```sh
node tools/shot.js               # screenshots into build/
node tools/play.js               # scripted opening, Mind, a story, a duty, crafting, away time
```

## Versions

The version shows in the game's menu. Stage one is 1.x: the middle number goes up for new features, the last for fixes. Set it in `VERSION` at the top of `src/ui.js`.

- 1.4.2: the committee's chosen name goes on the hull, tapping the name cycles the register; long names pan
- 1.4.1: crew tab gets its own tap control; the census opens straight away
- 1.4: three acts (the Bureau's directive, the Quota or the Long Dark); neighbours with memories; the Quorate's auditor
- 1.3: storage rhythm for the Mind; Work songs
- 1.2: fixes from the test harness
- 1.1: storage, housing, Mind work, clearer stores, livelier view
- 1.0: stage one

## Test harness

```
node tools/harness/run.js 5      # 5 lives of each player type, in parallel
```

It writes `build/harness.json` and `build/report.html`. Each player type plays whole lives using the game's own list of legal moves (`actions(S)` in `src/core.js`), with seeded randomness so a run can be repeated. Player types: optimiser, casual (six short sessions a day), never trades, no duties, Mind first, hoarder, random fuzzer, and two story players (always first choice, always second).

Detectors flag crashes, deadlocks (nothing new reachable within six hours), walls (a cost no store can hold, or a store drained below a cost), grinds (one move doing most of the work), long waits, thin choice, waste at full stores and an idle Mind. Each finding carries a save code: in the game, Menu, then Copy or load a save code, to stand at that moment. Test saves skip away-time simulation.

## Balance notes (stage one)

The bot reaches Ignition in about 7 hours when attentive and 8 to 16 hours when it acts every minute or few. The longest wait between new things is under an hour for most of the era. A person with sessions, sleep and the twelve-hour offline cap should take a couple of days.

## Saving on other hosts

When the page is served as a Claude artifact it also mirrors the save to the viewer's account. Everywhere else that code path does nothing and the browser save is the only one.
