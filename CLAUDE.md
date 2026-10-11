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
- **Pause menu** (`#pause-menu`, separate from the game-over `#overlay`): `P`/`Escape` call `togglePause()` (auto-repeat ignored); while paused the keydown handler returns early, so no game input reaches the board. Resuming hides the menu, blurs any focused menu control, and resets `lastTime` (but keeps `dropAccum`, so rapid pause/resume can't freeze gravity). `startLevel` is a persisted preference (`localStorage['tetris-start-level']`, 1–15) copied into the per-game `baseLevel` by `init()`; `clearLines()` never drops below `baseLevel`. Speed comes from `intervalForLevel(level)`.

## Coupling between files

- `COLS × BLOCK` / `ROWS × BLOCK` must match `<canvas id="board" width="300" height="600">` in `index.html`.
- `drawNext()` assumes a 4×4 grid of 30px cells, matching `<canvas id="next-canvas" width="120" height="120">`.
- `game.js` grabs elements by id at load time (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `theme-toggle`, and the pause menu's `pause-menu`, `pause-resume`, `pause-restart`, `pause-controls-toggle`, `pause-controls`, `start-level`); renaming ids in HTML requires updating these lookups. The overlay is toggled via the `hidden` class defined in `style.css`.
- Controls are documented in four places: the keydown handler, the controls list in the panel and the `#pause-controls` list in `index.html`, and the README table.
