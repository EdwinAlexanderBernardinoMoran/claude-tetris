'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#00bcd4', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - light blue
  '#ffb74d', // L - orange
  '#9e9e9e', // N - nut (tuerca) gris metálico
  '#ffe57f', // comodín (Tinte); no es una pieza, se dibuja con degradado
];

// Skins: cada uno define paleta (índices 1–8 piezas), degradado del comodín (9),
// fondo del canvas (null = el de CSS, según tema), color de cuadrícula por tema y draw().
// draw(context, px, py, size, fill, base): px/py en píxeles; fill puede ser degradado;
// base es un color sólido equivalente (para glow/derivados). Para añadir uno basta un objeto aquí.
const SKINS = {
  retro: {
    id: 'retro', label: 'Retro',
    colors: COLORS,
    wildcard: ['#ff8a80', '#ffe57f', '#80d8ff'],
    background: null,
    gridColor: light => light ? '#e1e5f0' : '#22222e',
    draw(context, px, py, size, fill) {
      context.fillStyle = fill;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    id: 'neon', label: 'Neon',
    colors: [null, '#00e5ff', '#ffee00', '#d500f9', '#00ff6a', '#ff1744', '#448aff', '#ff9100', '#c0c0d0', '#ffee58'],
    wildcard: ['#ff4081', '#ffff00', '#18ffff'],
    background: '#000000',
    gridColor: () => '#14141f',
    draw(context, px, py, size, fill, base) {
      context.save();
      context.shadowColor = base;
      context.shadowBlur = 10;
      context.strokeStyle = fill;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      context.restore(); // corta el glow antes del relleno
      context.save();
      context.globalAlpha *= 0.3;
      context.fillStyle = fill;
      context.fillRect(px + 4, py + 4, size - 8, size - 8);
      context.restore();
    },
  },
  pastel: {
    id: 'pastel', label: 'Pastel',
    colors: [null, '#a8e6ef', '#fff2b3', '#dcbcf0', '#c3ebc5', '#ffb8b8', '#bbdcfa', '#ffd6a5', '#cfd3d8', '#fff0b8'],
    wildcard: ['#ffc4c4', '#fff4c2', '#c4ecff'],
    background: null,
    gridColor: light => light ? '#e8ebf4' : '#252533',
    draw(context, px, py, size, fill) {
      roundRectPath(context, px + 2, py + 2, size - 4, size - 4, 8);
      context.fillStyle = fill;
      context.fill();
      // brillo suave
      roundRectPath(context, px + 5, py + 5, size - 10, 5, 2.5);
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fill();
    },
  },
  pixel: {
    id: 'pixel', label: 'Pixel art',
    colors: [null, '#00acc1', '#fbc02d', '#8e24aa', '#43a047', '#e53935', '#1e88e5', '#fb8c00', '#757575', '#ffd54f'],
    wildcard: ['#ff5252', '#ffd740', '#40c4ff'],
    background: null,
    gridColor: light => light ? '#dde1ee' : '#1e1e2a',
    draw(context, px, py, size, fill) {
      const u = size / 6; // "píxel" de la textura
      context.fillStyle = fill;
      context.fillRect(px, py, size, size);
      // damero de píxeles
      context.fillStyle = 'rgba(255,255,255,0.16)';
      for (let i = 1; i < 5; i++)
        for (let j = 1; j < 5; j++)
          if ((i + j) % 2 === 0) context.fillRect(px + i * u, py + j * u, u, u);
      // bisel: luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.4)';
      context.fillRect(px, py, size, u);
      context.fillRect(px, py, u, size);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(px, py + size - u, size, u);
      context.fillRect(px + size - u, py, u, size);
    },
  },
};

const SKIN_KEY = 'tetris.skin';

// Rectángulo redondeado: roundRect nativo o fallback con arcTo.
function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (context.roundRect) { context.roundRect(x, y, w, h, r); return; }
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const WILDCARD = 9;             // índice de COLORS para bloques comodín
const POWERUP_EVERY_LINES = 2;  // líneas necesarias para ganar un power-up
const FREEZE_MS = 5000;
const DESTROY_SCORE = 5;        // puntos por bloque destruido (× nivel)

// Registro de power-ups. Para agregar uno nuevo basta añadir un objeto aquí:
// apply(row, col, piece) se llama al fijar la pieza, con (row, col) = celda ancla
// en coordenadas del tablero. No hay que tocar ninguna otra función.
const POWERUPS = [
  {
    id: 'bomb', icon: '💣',
    // Área 3×3 centrada en el ancla; los bordes se recortan al tablero.
    apply(row, col) {
      const cells = [];
      for (let r = Math.max(0, row - 1); r <= Math.min(ROWS - 1, row + 1); r++)
        for (let c = Math.max(0, col - 1); c <= Math.min(COLS - 1, col + 1); c++)
          cells.push([r, c]);
      destroyBlocks(cells);
    },
  },
  {
    id: 'lightning', icon: '⚡',
    // Borra la fila del ancla y colapsa lo de arriba (sin contar como línea).
    apply(row) {
      destroyBlocks(board[row].map((_, c) => [row, c]));
      board.splice(row, 1);
      board.unshift(new Array(COLS).fill(0));
    },
  },
  {
    id: 'tint', icon: '🎨',
    // Los bloques del color de la pieza pasan a comodín; ver destroyAdjacentWildcards.
    apply(row, col, piece) {
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (board[r][c] === piece.type) board[r][c] = WILDCARD;
    },
  },
  {
    id: 'gravity', icon: '⬇️',
    // Cada bloque cae hasta el fondo de su columna; lockPiece revisa líneas después.
    apply() {
      for (let c = 0; c < COLS; c++) {
        let write = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (!board[r][c]) continue;
          if (r !== write) { board[write][c] = board[r][c]; board[r][c] = 0; }
          write--;
        }
      }
    },
  },
  {
    id: 'freeze', icon: '❄️',
    // Reinicia (no acumula) el contador si ya había un Congelar activo.
    apply() { freezeLeft = FREEZE_MS; },
  },
];

// Borra las celdas dadas (solo las ocupadas) y suma puntos por bloque.
function destroyBlocks(cells) {
  let n = 0;
  for (const [r, c] of cells) {
    if (board[r][c]) { board[r][c] = 0; n++; }
  }
  score += n * DESTROY_SCORE * level;
}

// Comodín: se elimina solo cuando se completa una fila adyacente (arriba o abajo).
function destroyAdjacentWildcards(fullRows) {
  const cells = [];
  for (const r of fullRows)
    for (const rr of [r - 1, r + 1]) {
      if (rr < 0 || rr >= ROWS || fullRows.includes(rr)) continue;
      for (let c = 0; c < COLS; c++)
        if (board[rr][c] === WILDCARD) cells.push([rr, c]);
    }
  destroyBlocks(cells);
}

// Celda ocupada de la forma más cercana a su centro (coordenadas locales de la forma).
function pieceAnchor(shape) {
  const cr = (shape.length - 1) / 2, cc = (shape[0].length - 1) / 2;
  let best = null, bestDist = Infinity;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const d = (r - cr) ** 2 + (c - cc) ** 2;
      if (d < bestDist) { bestDist = d; best = { r, c }; }
    }
  return best;
}

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const themeText = document.getElementById('theme-text');
const skinSelect = document.getElementById('skin-select');

let gridColor = '#22222e';
let skin = SKINS.retro;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let powerUpsPending, linesSincePowerUp, freezeLeft;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  const piece = { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
  if (powerUpsPending > 0) {
    powerUpsPending--;
    piece.powerUp = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
  }
  return piece;
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  const full = [];
  for (let r = 0; r < ROWS; r++)
    if (board[r].every(v => v !== 0)) full.push(r);
  const cleared = full.length;
  if (cleared) {
    destroyAdjacentWildcards(full);
    for (let i = full.length - 1; i >= 0; i--) {
      board.splice(full[i], 1);
      board.unshift(new Array(COLS).fill(0));
    }
    lines += cleared;
    linesSincePowerUp += cleared;
    powerUpsPending += Math.floor(linesSincePowerUp / POWERUP_EVERY_LINES);
    linesSincePowerUp %= POWERUP_EVERY_LINES;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  if (current.powerUp) {
    const a = pieceAnchor(current.shape);
    current.powerUp.apply(current.y + a.r, current.x + a.c, current);
    updateHUD();
  }
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const px = x * size, py = y * size;
  let fill, base;
  if (colorIndex === WILDCARD) {
    const [a, b, c] = skin.wildcard;
    const g = context.createLinearGradient(px, py, px + size, py + size);
    g.addColorStop(0, a);
    g.addColorStop(0.5, b);
    g.addColorStop(1, c);
    fill = g;
    base = b;
  } else {
    fill = base = skin.colors[colorIndex];
  }
  context.save();
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, px, py, size, fill, base);
  context.restore(); // restablece globalAlpha / shadowBlur
}

// Fondo del canvas: color del skin, o transparente (fondo CSS del tema).
function paintBackground(context, cv) {
  context.clearRect(0, 0, cv.width, cv.height);
  if (skin.background) {
    context.fillStyle = skin.background;
    context.fillRect(0, 0, cv.width, cv.height);
  }
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

// Pieza especial: borde dorado brillante en cada bloque + icono en la celda ancla.
function drawPowerUpMarker(context, piece, ox, oy, size, pulse) {
  const a = pieceAnchor(piece.shape);
  context.save();
  context.strokeStyle = '#ffd700';
  context.lineWidth = 2;
  context.shadowColor = '#ffd700';
  context.shadowBlur = 4 + 8 * pulse;
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        context.strokeRect((ox + c) * size + 2, (oy + r) * size + 2, size - 4, size - 4);
  context.shadowBlur = 0;
  context.font = `${Math.floor(size * 0.6)}px serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(piece.powerUp.icon, (ox + a.c + 0.5) * size, (oy + a.r + 0.5) * size);
  context.restore();
}

function draw() {
  paintBackground(ctx, canvas);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  if (current.powerUp)
    drawPowerUpMarker(ctx, current, current.x, current.y, BLOCK, 0.5 + 0.5 * Math.sin(performance.now() / 200));

  // congelado: tinte azul + segundos restantes
  if (freezeLeft > 0) {
    ctx.fillStyle = 'rgba(100,181,246,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64b5f6';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`❄️ ${(freezeLeft / 1000).toFixed(1)}s`, 8, 6);
  }
}

function drawNext() {
  const NB = 30;
  paintBackground(nextCtx, nextCanvas);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  if (next.powerUp) drawPowerUpMarker(nextCtx, next, offX, offY, NB, 1);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt); // la caída automática espera; el jugador sí puede mover
  } else {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  powerUpsPending = 0;
  linesSincePowerUp = 0;
  freezeLeft = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

// Tema: siempre arranca en oscuro (no se persiste entre sesiones)
function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = theme;
  gridColor = skin.gridColor(light);
  themeToggle.setAttribute('aria-pressed', String(light));
  themeToggle.setAttribute('aria-label', light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  themeIcon.textContent = light ? '🌙' : '☀️';
  themeText.textContent = light ? 'Modo oscuro' : 'Modo claro';
  if (current) draw(); // redibuja la cuadrícula también en pausa / game over
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evita que Space active el botón durante la partida
});

// Skin: se persiste en localStorage; valor inválido o sin acceso → retro
function loadSkin() {
  try {
    const id = localStorage.getItem(SKIN_KEY);
    return Object.prototype.hasOwnProperty.call(SKINS, id) ? id : 'retro';
  } catch (e) { return 'retro'; }
}

function applySkin(id) {
  skin = SKINS[id] || SKINS.retro;
  skinSelect.value = skin.id;
  applyTheme(document.documentElement.dataset.theme || 'dark'); // recalcula gridColor y redibuja el tablero
  if (next) drawNext();
}

for (const id in SKINS) skinSelect.add(new Option(SKINS[id].label, id));

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  try { localStorage.setItem(SKIN_KEY, skin.id); } catch (e) { /* sin persistencia */ }
  skinSelect.blur(); // evita que Space cambie el select durante la partida
});

skin = SKINS[loadSkin()];
skinSelect.value = skin.id;
applyTheme('dark');

init();
