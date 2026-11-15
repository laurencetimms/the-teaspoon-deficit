# The Teaspoon Deficit

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
| `tools/shot.js`, `tools/play.js` | Browser checks: screenshots at phone and desktop sizes, and a scripted tap-through. |

## Build and check

```sh
python3 build.py                 # writes index.html and build/test.html
node tools/sim.js spoons 1       # full run, attentive player
node tools/sim.js crew 1 "" tea  # crew-first run, taking the Long Tea ending
```

The browser tools need Playwright (`npm i playwright`). They read the state files `tools/sim.js` writes to `build/`, so run a simulation first. Set `CHROME=/path/to/chrome` to use an installed browser.

```sh
node tools/shot.js               # screenshots into build/
node tools/play.js               # scripted first ten minutes, pause, away time, an ending, a new life
```

## Balance notes

A simulated perfect player reaches the earliest ending in about 1.5 hours and the full one in about 8, so expect a few days of real sessions. Known soft spots: whimsy gets too plentiful late on, and the middle stretch has a quiet hour while thinking capacity catches up with the big projects.

## Saving on other hosts

When the page is served as a Claude artifact it also mirrors the save to the viewer's account. Everywhere else that code path does nothing and the browser save is the only one.
