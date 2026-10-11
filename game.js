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

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// combo: piezas consecutivas fijadas que limpian al menos una línea
let combo, maxComboThisGame;

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
  // combo para la tabla de records
  if (cleared) {
    combo++;
    maxComboThisGame = Math.max(maxComboThisGame, combo);
  } else {
    combo = 0;
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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
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

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
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
  showGameOverRecords();
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
  commitPendingRecord(); // reiniciar sin pulsar Guardar guarda con el nombre del campo
  gameoverRecords.classList.add('hidden');
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  combo = 0;
  maxComboThisGame = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

/* ---- Tabla de records (localStorage) ---- */
const RECORDS_KEY = 'tetris-records';
const LAST_NAME_KEY = 'tetris-last-name';
const MAX_RECORDS = 5;
const NAME_MAX = 12;
const DEFAULT_NAME = 'Jugador';

const startScreen = document.getElementById('start-screen');
const startTable = document.getElementById('start-table');
const startStats = document.getElementById('start-stats');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const gameoverRecords = document.getElementById('gameover-records');
const recordForm = document.getElementById('record-form');
const recordRank = document.getElementById('record-rank');
const recordName = document.getElementById('record-name');
const gameoverTable = document.getElementById('gameover-table');
const gameoverStats = document.getElementById('gameover-stats');

let records = loadRecords();
let pendingRecord = false; // puntuación de top 5 aún sin guardar

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function toCount(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function cleanName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, NAME_MAX);
}

// lee y valida los records; si están corruptos se parte de cero
function loadRecords() {
  const rec = emptyRecords();
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || typeof data !== 'object') return rec;
    if (Array.isArray(data.top)) {
      rec.top = data.top
        .filter(e => e && typeof e === 'object')
        .map(e => ({
          name: cleanName(e.name) || DEFAULT_NAME,
          score: toCount(e.score),
          lines: toCount(e.lines),
          level: Math.max(1, toCount(e.level)),
          date: typeof e.date === 'string' ? e.date.slice(0, 10) : '',
        }))
        .filter(e => e.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECORDS);
    }
    rec.bestCombo = toCount(data.bestCombo);
    rec.maxLines = toCount(data.maxLines);
  } catch (e) {}
  return rec;
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

function loadLastName() {
  try { return cleanName(localStorage.getItem(LAST_NAME_KEY)) || DEFAULT_NAME; } catch (e) { return DEFAULT_NAME; }
}

// posición (0-based) que ocuparía la puntuación, o -1 si no entra en el top
function recordRankFor(s) {
  if (s <= 0) return -1;
  const idx = records.top.findIndex(e => s > e.score);
  if (idx !== -1) return idx;
  return records.top.length < MAX_RECORDS ? records.top.length : -1;
}

function renderRecordsTable(container, highlight) {
  container.textContent = '';
  if (!records.top.length) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Sin records todavía';
    container.appendChild(empty);
    return;
  }
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const h of ['#', 'Nombre', 'Puntos', 'Líneas', 'Nivel']) {
    const th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  }
  const body = table.createTBody();
  records.top.forEach((e, i) => {
    const row = body.insertRow();
    if (i === highlight) row.className = 'record-highlight';
    if (e.date) row.title = e.date;
    for (const v of [i + 1, e.name, e.score.toLocaleString(), e.lines, e.level]) {
      row.insertCell().textContent = v; // textContent: los nombres nunca se interpretan como HTML
    }
  });
  container.appendChild(table);
}

function renderRecordStats(container, newCombo, newLines) {
  container.textContent = '';
  const items = [
    ['Mejor combo', records.bestCombo, newCombo],
    ['Líneas máximas', records.maxLines, newLines],
  ];
  for (const [label, value, isNew] of items) {
    const span = document.createElement('span');
    span.textContent = `${label}: ${value}` + (isNew ? ' ¡nuevo!' : '');
    if (isNew) span.className = 'record-new';
    container.appendChild(span);
  }
}

function renderStartScreen() {
  renderRecordsTable(startTable, -1);
  renderRecordStats(startStats, false, false);
}

function showGameOverRecords() {
  // mejor combo y líneas máximas se actualizan entren o no en el top 5
  const newCombo = maxComboThisGame > records.bestCombo;
  const newLines = lines > records.maxLines;
  if (newCombo) records.bestCombo = maxComboThisGame;
  if (newLines) records.maxLines = lines;
  if (newCombo || newLines) saveRecords();

  const rank = recordRankFor(score);
  pendingRecord = rank !== -1;
  recordForm.classList.toggle('hidden', !pendingRecord);
  renderRecordStats(gameoverStats, newCombo, newLines);
  renderRecordsTable(gameoverTable, -1);
  gameoverRecords.classList.remove('hidden');
  if (pendingRecord) {
    recordRank.textContent = `¡Nuevo récord! Puesto #${rank + 1}`;
    recordName.value = loadLastName();
    recordName.focus();
    recordName.select();
  }
}

// guarda la puntuación pendiente; devuelve su posición en el top (o -1)
function commitPendingRecord() {
  if (!pendingRecord) return -1;
  pendingRecord = false;
  const name = cleanName(recordName.value) || loadLastName();
  const entry = { name, score, lines, level, date: new Date().toISOString().slice(0, 10) };
  records.top.push(entry);
  records.top.sort((a, b) => b.score - a.score); // sort estable: en empate queda primero el más antiguo
  records.top = records.top.slice(0, MAX_RECORDS);
  saveRecords();
  try { localStorage.setItem(LAST_NAME_KEY, name); } catch (e) {}
  return records.top.indexOf(entry);
}

function startGame() {
  startScreen.classList.add('hidden');
  init();
}

// guarda el récord pendiente y deja la UI de game over en estado "guardado"
function saveAndShowRecord() {
  if (!pendingRecord) return;
  const idx = commitPendingRecord();
  recordName.blur();
  recordForm.classList.add('hidden');
  renderRecordsTable(gameoverTable, idx);
}

recordForm.addEventListener('submit', e => {
  e.preventDefault();
  saveAndShowRecord();
});

// mantener Espacio pulsado tras un hard drop no debe llenar el nombre de espacios
recordName.addEventListener('keydown', e => {
  if (e.repeat && e.code === 'Space') e.preventDefault();
});

playBtn.addEventListener('click', () => {
  playBtn.blur();
  startGame();
});

resetRecordsBtn.addEventListener('click', () => {
  resetRecordsBtn.blur();
  if (!confirm('¿Borrar todos los records? Esta acción no se puede deshacer.')) return;
  records = emptyRecords();
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) {}
  renderStartScreen();
});

// cerrar la pestaña con un récord sin guardar lo guarda con el nombre del campo;
// también actualiza la UI por si la página vuelve desde la caché atrás/adelante
window.addEventListener('pagehide', saveAndShowRecord);

document.addEventListener('keydown', e => {
  // escribir en un campo de texto no debe mover piezas ni pausar
  if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
  if (!startScreen.classList.contains('hidden')) {
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      startGame();
    }
    return;
  }
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

// el juego no arranca hasta pulsar "Jugar" en la pantalla de inicio
renderStartScreen();
