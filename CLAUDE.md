# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No package.json, build, lint, or tests. README and UI text are in Spanish.

## Run

Open `index.html` directly, or serve statically: `python3 -m http.server 8000`.

## Architecture

Three files: `index.html` (DOM + canvases), `style.css`, `game.js` (all logic, global scope, `'use strict'`).

- `game.js` state lives in module-level `let` vars (`board`, `current`, `next`, `score`, ...), reset in `init()` (also the restart button handler).
- Board: `ROWS×COLS` matrix; 0 = empty, 1–7 = index into `COLORS`/`PIECES` (same index used for piece type).
- Loop: `requestAnimationFrame` `loop()` accumulates `dropAccum` vs `dropInterval`; `cancelAnimationFrame(animId)` is used for pause and game over. Resuming calls `loop()` directly after resetting `lastTime`.
- Piece lifecycle: `lockPiece()` → `merge()` → `clearLines()` (updates score/level/`dropInterval`) → `spawn()`. `spawn()` calls `endGame()` if the new piece collides.
- Rotation: `rotateCW` + horizontal-only kicks `[0,-1,1,-2,2]` in `tryRotate`.
- Scoring: `LINE_SCORES[cleared] * level`; soft drop +1/row, hard drop +2/row. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000-(level-1)*90)`.

## Gotchas

- Changing `COLS`/`ROWS`/`BLOCK` requires updating canvas `width`/`height` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`). The next-piece canvas is hardcoded 120×120 with a 4×4 grid of 30px blocks (`drawNext`).
- `game.js` grabs DOM elements by ID at load (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`); renaming IDs in HTML breaks it.
- Keydown handler ends with `updateHUD()` for every key press, so movement code doesn't need to call it.
