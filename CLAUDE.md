# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas. No dependencies, no `package.json`, no build step, no linter, no test suite. Three source files: `index.html` (DOM + canvases), `style.css` (dark/retro theme), `game.js` (all logic). The README and all user-facing text (overlay messages, button labels, control hints) are in Spanish — keep new UI strings in Spanish.

## Running

Open `index.html` directly (`start index.html` on Windows), or serve the folder statically and visit `http://localhost:8000`:

```bash
python -m http.server 8000
# or: npx serve .
```

There is nothing to compile; reload the browser after edits. Verify changes manually in the browser.

## Architecture (`game.js`)

- **Single script, global mutable state.** All game state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`) is top-level `let` variables, (re)initialized in `init()`. `init()` is also the restart handler, so any new state must be reset there.
- **Cell values double as color indices.** `board` is a `ROWS × COLS` matrix of `0` (empty) or `1–7`. Each shape in `PIECES[type]` stores its own `type` number in its filled cells, which `drawBlock` looks up in `COLORS`. `PIECES`, `COLORS`, and `randomPiece()` (`Math.random() * 7 + 1`) must stay in sync when adding/removing piece types.
- **Collision is the single source of truth.** `collide(shape, ox, oy)` handles walls, floor, and locked blocks (cells above row 0 are allowed). Movement, rotation wall kicks (`tryRotate`: offsets `0, -1, 1, -2, 2`), ghost projection (`ghostY`), and game-over detection in `spawn()` all go through it.
- **Lock pipeline:** `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next`, may call `endGame()`).
- **Loop:** `loop(ts)` via `requestAnimationFrame` accumulates `dt` into `dropAccum` and steps gravity when it exceeds `dropInterval`, then redraws everything each frame. Pause/game-over stop it with `cancelAnimationFrame(animId)`; resuming resets `lastTime` to avoid a large `dt` jump.
- **HUD** is DOM (`updateHUD()`), not canvas; the keydown handler calls it after every key.
- **Start screen / records.** On load `init()` is NOT called: `#start-screen` is shown and `startGame()` (Jugar button or Enter) hides it and calls `init()`, so `board`/`current` are undefined until then. The keydown handler ignores events from `input/select/textarea` and swallows all keys while the start screen is visible. Records live in `localStorage['tetris-records']` (`{ top: [{name, score, lines, level, date}] (max 5), bestCombo, maxLines }`, validated by `loadRecords()`) plus `tetris-last-name`. `clearLines()` tracks `combo`/`maxComboThisGame` (consecutive line-clearing locks); `endGame()` calls `showGameOverRecords()`; `init()` calls `commitPendingRecord()` first so restarting without pressing Guardar still saves a qualifying score. Names are rendered with `textContent` only.

## Coupling between files

- `COLS × BLOCK` / `ROWS × BLOCK` must match `<canvas id="board" width="300" height="600">` in `index.html`.
- `drawNext()` assumes a 4×4 grid of 30px cells, matching `<canvas id="next-canvas" width="120" height="120">`.
- `game.js` grabs elements by id at load time (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, plus the records ids: `start-screen`, `start-table`, `start-stats`, `play-btn`, `reset-records-btn`, `gameover-records`, `record-form`, `record-rank`, `record-name`, `gameover-table`, `gameover-stats`); renaming ids in HTML requires updating these lookups. The overlay is toggled via the `hidden` class defined in `style.css`.
- Controls are documented in three places: the keydown handler, the controls list in `index.html`, and the README table.

## Known quirk

Unpausing in `togglePause()` restarts the loop but does not re-add the `hidden` class to `#overlay`, so the "PAUSA" overlay stays visible after resuming.
