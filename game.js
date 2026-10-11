'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - light blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// ---- Skins ----
// Cada skin define su paleta (indexada por tipo de pieza; si falta un índice se usa COLORS),
// el fondo y la rejilla del tablero (null = usar las variables CSS del tema) y cómo se dibuja
// un bloque. drawBlock recibe la esquina en píxeles (px, py); el alpha ya viene aplicado.

// Rectángulo con esquinas redondeadas trazado a mano (no depende de roundRect)
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    label: 'Retro',
    colors: COLORS,
    boardBg: null,
    grid: null,
    drawBlock(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    label: 'Neón',
    colors: [null, '#00f0ff', '#fff200', '#e040fb', '#39ff14', '#ff1744', '#2979ff', '#ff9100'],
    boardBg: '#000000',
    grid: '#11111c',
    drawBlock(context, px, py, size, color, alpha) {
      // tubo de neón: relleno tenue + contorno brillante con glow
      context.shadowColor = color;
      context.shadowBlur = size * 0.5;
      context.fillStyle = color;
      context.globalAlpha = alpha * 0.3;
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.globalAlpha = alpha;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      // núcleo blanco del tubo
      context.strokeStyle = 'rgba(255,255,255,0.6)';
      context.lineWidth = 0.75;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
    },
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a8e6ef', '#fff1a8', '#d9bdf5', '#bde8b5', '#f7b7b7', '#bcd6f7', '#ffd4a8'],
    boardBg: null,
    grid: null,
    drawBlock(context, px, py, size, color) {
      roundedRectPath(context, px + 2, py + 2, size - 4, size - 4, size * 0.25);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = 'rgba(0,0,0,0.12)';
      context.lineWidth = 1;
      context.stroke();
      // brillo suave arriba a la izquierda
      roundedRectPath(context, px + 6, py + 5, size * 0.4, size * 0.18, size * 0.09);
      context.fillStyle = 'rgba(255,255,255,0.55)';
      context.fill();
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: [null, '#3cbcfc', '#f8d838', '#b853f0', '#58d854', '#f83800', '#4a6cf7', '#fc9838'],
    boardBg: null,
    grid: null,
    drawBlock(context, px, py, size, color) {
      const p = Math.max(1, Math.round(size / 10)); // tamaño de cada "pixel"
      const x0 = px + 1, y0 = py + 1, inner = size - 2;
      // contorno oscuro + color base
      context.fillStyle = '#111';
      context.fillRect(x0, y0, inner, inner);
      context.fillStyle = color;
      context.fillRect(x0 + 1, y0 + 1, inner - 2, inner - 2);
      // bisel: luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(x0 + 1, y0 + 1, inner - 2, p);
      context.fillRect(x0 + 1, y0 + 1, p, inner - 2);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(x0 + 1, y0 + inner - 1 - p, inner - 2, p);
      context.fillRect(x0 + inner - 1 - p, y0 + 1, p, inner - 2);
      // textura: damero de pixeles algo más oscuros en el interior
      context.fillStyle = 'rgba(0,0,0,0.12)';
      const start = 1 + p, end = inner - 1 - p;
      for (let yy = start, row = 0; yy + p <= end; yy += p, row++)
        for (let xx = start + (row % 2) * p; xx + p <= end; xx += 2 * p)
          context.fillRect(x0 + xx, y0 + yy, p, p);
      // destello en la esquina
      context.fillStyle = 'rgba(255,255,255,0.8)';
      context.fillRect(x0 + 1 + p, y0 + 1 + p, p, p);
    },
  },
};

const DEFAULT_SKIN = 'retro';

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
let gridColor;

const skinSelect = document.getElementById('skin-select');
let skin = SKINS[DEFAULT_SKIN];

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
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
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
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
  const color = skin.colors[colorIndex] || COLORS[colorIndex];
  // save/restore: ningún estado del skin (alpha, shadowBlur...) se filtra a otros dibujos
  context.save();
  context.globalAlpha = alpha ?? 1;
  skin.drawBlock(context, x * size, y * size, size, color, alpha ?? 1);
  context.restore();
}

function applySkin(name) {
  if (!Object.prototype.hasOwnProperty.call(SKINS, name)) name = DEFAULT_SKIN;
  skin = SKINS[name];
  skinSelect.value = name;
  document.documentElement.setAttribute('data-skin', name);
  try { localStorage.setItem('tetris-skin', name); } catch (e) {}
  // en pausa o game over el loop no corre: redibujar manualmente
  if (current && next) { draw(); drawNext(); }
}

// Pinta el fondo del skin si lo define; si no, el canvas queda transparente y se ve --board-bg
function clearCanvas(context, c) {
  context.clearRect(0, 0, c.width, c.height);
  if (skin.boardBg) {
    context.fillStyle = skin.boardBg;
    context.fillRect(0, 0, c.width, c.height);
  }
}

function applyTheme(theme) {
  const light = theme === 'light';
  if (light) document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  themeToggle.textContent = light ? 'Modo oscuro' : 'Modo claro';
  themeToggle.setAttribute('aria-pressed', String(light));
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch (e) {}
  // en pausa o game over el loop no corre: redibujar manualmente
  if (current && next) { draw(); drawNext(); }
}

function drawGrid() {
  ctx.strokeStyle = skin.grid || gridColor;
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

function draw() {
  clearCanvas(ctx, canvas);
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
}

function drawNext() {
  const NB = 30;
  clearCanvas(nextCtx, nextCanvas);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
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
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
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

themeToggle.addEventListener('click', () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  applyTheme(isLight ? 'dark' : 'light');
  themeToggle.blur(); // evita que Espacio vuelva a activar el botón
});

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch (e) {}
applyTheme(savedTheme);

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que las flechas cambien el skin en vez de mover la pieza
});
// si el select sigue enfocado (p. ej. se cerró con Escape sin cambiar), las teclas de juego
// no deben cambiar el skin: se cancela su acción nativa y el evento sigue hacia el juego
skinSelect.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
    skinSelect.blur();
  }
});

let savedSkin = DEFAULT_SKIN;
try { savedSkin = localStorage.getItem('tetris-skin') || DEFAULT_SKIN; } catch (e) {}
applySkin(savedSkin);

init();
