// ===== Telegram Mini App init =====
// Безопасно работает и вне Telegram (например, при локальной отладке в браузере).
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready();
  tg.expand();
  // отключаем закрытие свайпом вниз во время игры (если метод доступен)
  if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
}

// ===== Предохранитель: ни одна непредвиденная ошибка не должна ронять игру =====
window.addEventListener('error', function (e) {
  try { console.error('[BLINDGRID] перехвачена ошибка:', (e && (e.error || e.message)) || e); } catch (_) {}
});
window.addEventListener('unhandledrejection', function (e) {
  try { console.error('[BLINDGRID] перехвачен промис:', e && e.reason); } catch (_) {}
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
});

// Гасим жест «свайп вниз = закрыть приложение» Telegram: не даём странице утаскивать жест.
// Прокручиваемые зоны (#custom-center) исключаем.
document.addEventListener('touchmove', function (e) {
  let el = e.target;
  while (el && el !== document.body) {
    if (el.id === 'custom-center' || (el.classList && el.classList.contains('scrollable'))) return;
    el = el.parentElement;
  }
  if (e.cancelable) e.preventDefault();
}, { passive: false });

// Страховка названия в меню: после проявления снимаем анимацию с текста/креста,
// чтобы при любом сбое они остались видимыми (кубик не трогаем — у него своя анимация).
function ensureMenuLogoVisible() {
  document.querySelectorAll('#menu-logo .logo-text, #menu-logo .logo-cross, #menu-logo .logo-cube').forEach(function (el) {
    el.style.transform = '';
  });
}
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) setTimeout(ensureMenuLogoVisible, 120);
});

// частицы — в форме фигур из морского боя (блоки 1-3 клетки), мягкие, размытые
// единый набор частиц: считаем позиции один раз и рисуем идентично во всех слоях
const PARTICLE_GRADS = [
  'linear-gradient(140deg,#ff8c97,#ff6f86)',
  'linear-gradient(140deg,#62d3cd,#4fcac4)',
  'linear-gradient(140deg,#ffce6e,#ffbf4d)'
];
const PARTICLE_SPECS = (function () {
  const N = 16, specs = [];
  for (let i = 0; i < N; i++) {
    const unit = 6 + Math.random() * 5;
    const len = 1 + Math.floor(Math.random() * 3);
    const horiz = Math.random() < 0.5;
    const dur = 40 + Math.random() * 35;
    specs.push({
      w: horiz ? unit * len : unit,
      h: horiz ? unit : unit * len,
      left: Math.random() * 100,
      grad: PARTICLE_GRADS[i % PARTICLE_GRADS.length],
      rot: Math.random() * 30 - 15,
      dur: dur,
      delay: -Math.random() * dur
    });
  }
  return specs;
})();
function makeParticles(layerId) {
  const layer = document.getElementById(layerId);
  if (!layer) return;
  layer.innerHTML = '';
  PARTICLE_SPECS.forEach(s => {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.width = s.w + 'px';
    p.style.height = s.h + 'px';
    p.style.left = s.left + '%';
    p.style.bottom = '-10%';
    p.style.background = s.grad;
    p.style.setProperty('--rot', s.rot + 'deg');
    p.style.animationDuration = s.dur + 's';
    p.style.animationDelay = s.delay + 's';
    layer.appendChild(p);
  });
}
makeParticles('particles');
makeParticles('menu-particles');

// перезапуск красивой анимации лого меню (вызывается после загрузочного экрана — надёжная точка)
function playMenuLogo() {
  try {
    var cross = document.querySelector('#menu-logo .logo-cross');
    var text = document.querySelector('#menu-logo .logo-text');
    var cube = document.querySelector('#menu-logo .logo-cube');
    if (cross) cross.style.transform = 'rotate(-150deg) scale(0.4)';
    if (text) text.style.transform = 'translateX(10px)';
    if (cube) cube.style.transform = 'translateX(70px) rotate(40deg) scale(0.5)';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (cube) cube.style.transform = 'translateX(0) rotate(0deg) scale(1)';
        if (cross) setTimeout(function () { cross.style.transform = 'rotate(0deg) scale(1)'; }, 80);
        if (text) setTimeout(function () { text.style.transform = 'translateX(0)'; }, 120);
      });
    });
  } catch (e) {}
}
// загрузочный экран: простой кружок, скрываем по готовности страницы
(function () {
  var loader = document.getElementById('loader');
  if (!loader) return;
  var start = Date.now();
  var hidden = false;
  function hideLoader() {
    if (hidden) return; hidden = true;
    document.body.classList.add('ready');
    loader.classList.add('done');
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(function () { loader.style.display = 'none'; }, 380);
    try { playMenuLogo(); } catch (e) {}
    setTimeout(function () { try { ensureMenuLogoVisible(); } catch (e) {} }, 600);
  }
  // минимум 500мс показа, иначе мелькнёт; прячем когда страница готова
  function ready() {
    var wait = Math.max(0, 500 - (Date.now() - start));
    setTimeout(hideLoader, wait);
  }
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready);
  setTimeout(hideLoader, 4000);   // подстраховка
})();

const MODES = {
  fast: {
    size: 8,
    fleet: [ { len: 3, count: 1 }, { len: 2, count: 2 }, { len: 1, count: 3 } ]
  },
  classic: {
    size: 10,
    fleet: [ { len: 4, count: 1 }, { len: 3, count: 2 }, { len: 2, count: 3 }, { len: 1, count: 4 } ]
  }
};
let SIZE = 8;
let FLEET_LIST = [];
let TOTAL_SHIPS = 0;

function applyMode(mode) {
  const cfg = MODES[mode] || MODES.fast;
  SIZE = cfg.size;
  FLEET_LIST = [];
  cfg.fleet.forEach(f => { for (let i = 0; i < f.count; i++) FLEET_LIST.push(f.len); });
  FLEET_LIST.sort((a, b) => b - a);
  TOTAL_SHIPS = FLEET_LIST.length;
  // размер клетки: быстрый 35px, классика 33px
  const GAP = 4, PAD = 12;
  const CELL = SIZE >= 10 ? 33 : 35;
  const boardW = SIZE * CELL + (SIZE - 1) * GAP + PAD;
  document.documentElement.style.setProperty('--board-w', boardW + 'px');
  // уменьшенное «твоё поле» в бою — оно информационное, по нему не кликают
  const MINI_CELL = SIZE >= 10 ? 18 : 20;
  const miniW = SIZE * MINI_CELL + (SIZE - 1) * GAP + PAD;
  document.documentElement.style.setProperty('--board-w-mini', miniW + 'px');
  document.querySelectorAll('.grid').forEach(g => {
    g.style.gridTemplateColumns = 'repeat(' + SIZE + ', 1fr)';
  });
}

let placement = null;
let state = null;

function freshBoard() {
  const b = [];
  for (let r = 0; r < SIZE; r++) { const row = []; for (let c = 0; c < SIZE; c++) row.push({ shipId: null, shot: false }); b.push(row); }
  return b;
}
function placeFleetAuto() {
  for (let full = 0; full < 300; full++) {
    const board = freshBoard(); const ships = []; let id = 0; let okAll = true;
    for (const len of FLEET_LIST) {
      let placed = false, attempts = 0;
      while (!placed && attempts < 800) {
        attempts++;
        const horiz = Math.random() < 0.5;
        const maxR = horiz ? SIZE : SIZE - len, maxC = horiz ? SIZE - len : SIZE;
        const r0 = Math.floor(Math.random() * maxR), c0 = Math.floor(Math.random() * maxC);
        const cells = [];
        for (let i = 0; i < len; i++) cells.push({ r: horiz ? r0 : r0 + i, c: horiz ? c0 + i : c0 });
        if (cellsFreeStrict(board, cells)) {
          cells.forEach(({ r, c }) => board[r][c].shipId = id);
          ships.push({ id, len, cells, hits: 0, sunk: false }); id++; placed = true;
        }
      }
      if (!placed) { okAll = false; break; }
    }
    if (okAll) return { board, ships };
  }
  return { board: freshBoard(), ships: [] };
}
function cellsFreeStrict(board, cells, ignoreId = null) {
  for (const { r, c } of cells) {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
      const sid = board[nr][nc].shipId;
      if (sid !== null && sid !== ignoreId) return false;
    }
  }
  return true;
}
function cellsNotOverlapping(board, cells) {
  for (const { r, c } of cells) {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    if (board[r][c].shipId !== null) return false;
  }
  return true;
}

function makeShipPieceEl(boardId, ship) {
  const board = document.getElementById(boardId);
  const gridRect = board.getBoundingClientRect();
  let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity, ok = true;
  ship.cells.forEach(({ r, c }) => {
    const el = getCellEl(boardId, r, c);
    if (!el) { ok = false; return; }
    const rect = el.getBoundingClientRect();
    minL = Math.min(minL, rect.left); minT = Math.min(minT, rect.top);
    maxR = Math.max(maxR, rect.right); maxB = Math.max(maxB, rect.bottom);
  });
  if (!ok) return null;
  const piece = document.createElement('div');
  piece.dataset.key = 'sp-' + boardId + '-' + ship.id;
  piece.className = 'ship-piece len' + ship.len;
  piece.style.transition = 'none';
  piece.style.left = (minL - gridRect.left) + 'px';
  piece.style.top = (minT - gridRect.top) + 'px';
  piece.style.width = (maxR - minL) + 'px';
  piece.style.height = (maxB - minT) + 'px';
  requestAnimationFrame(() => { piece.style.transition = ''; });
  return piece;
}

function renderShipLayer(boardId, pieces, animateId, animType, instant) {
  const board = document.getElementById(boardId);
  let layer = board.querySelector('.ship-layer');
  if (!layer) { layer = document.createElement('div'); layer.className = 'ship-layer'; board.appendChild(layer); }
  const gridRect = board.getBoundingClientRect();

  const seen = new Set();
  pieces.forEach(p => {
    if (!p.cells || p.cells.length === 0) return;
    let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity, ok = true;
    p.cells.forEach(({ r, c }) => {
      const el = getCellEl(boardId, r, c);
      if (!el) { ok = false; return; }
      const rect = el.getBoundingClientRect();
      minL = Math.min(minL, rect.left); minT = Math.min(minT, rect.top);
      maxR = Math.max(maxR, rect.right); maxB = Math.max(maxB, rect.bottom);
    });
    if (!ok) return;

    const key = 'sp-' + boardId + '-' + p.id;
    seen.add(key);
    let piece = layer.querySelector('[data-key="' + key + '"]');
    const isAnimated = (animateId !== undefined && p.id === animateId);
    const L = (minL - gridRect.left), T = (minT - gridRect.top), W = (maxR - minL), H = (maxB - minT);

    if (isAnimated && piece) { piece.remove(); piece = null; }

    const wasSunk = piece && piece.classList.contains('sunk');
    const isNew = !piece;
    if (isNew) {
      piece = document.createElement('div');
      piece.dataset.key = key;
      layer.appendChild(piece);
    }
    piece.className = 'ship-piece len' + p.len + (p.sunk ? ' sunk' : '') + (p.bad ? ' bad' : '');
    // стиль "цветочки": вся фигура — связанная цветочная композиция своего вида
    if (shipStyle === 'flowers') {
      const horiz = W >= H;
      let art = piece.querySelector('.flower-art');
      if (!art) { art = document.createElement('div'); art.className = 'flower-art'; piece.appendChild(art); }
      const sig = p.len + (horiz ? 'h' : 'v');
      if (art.dataset.sig !== sig) {
        art.innerHTML = flowerArtSVG(p.len, horiz);
        art.dataset.sig = sig;
      }
    } else {
      const art = piece.querySelector('.flower-art');
      if (art) art.remove();
    }
    // только что потоплено — мягкое появление блока
    if (p.sunk && !wasSunk && !isNew) piece.classList.add('sink-pop');
    if (p.sunk && isNew) piece.classList.add('sink-pop');

    if (isNew || instant) {
      piece.style.transition = 'none';
      piece.style.left = L + 'px'; piece.style.top = T + 'px';
      piece.style.width = W + 'px'; piece.style.height = H + 'px';
      requestAnimationFrame(() => { piece.style.transition = ''; });
      if (isAnimated) piece.classList.add(animType === 'rotate' ? 'lift-rotate' : 'place-in');
      else if (isNew && !p.sunk) piece.classList.add('place-in');
    } else {
      piece.style.left = L + 'px'; piece.style.top = T + 'px';
      piece.style.width = W + 'px'; piece.style.height = H + 'px';
    }
  });

  layer.querySelectorAll('.ship-piece').forEach(el => {
    if (!seen.has(el.dataset.key)) el.remove();
  });
}

function startPlacement() {
  setGameUIHidden(false);
  state = null;               // сбрасываем прошлый бой (фикс вылета на «Ещё раз»)
  dragInfo = null;
  document.getElementById('play-window').classList.remove('show'); // не мигаем кнопкой «Играть» до расстановки
  placement = {
    board: freshBoard(),
    pieces: FLEET_LIST.map((len, i) => ({ id: i, len, horiz: true, placed: false, cells: [], bad: false })),
    animateId: undefined, animType: undefined,
  };
  showScreen('placement-screen');
  renderPlaceBoard(); renderDock(); renderPlaceControls(); updatePlaceFill();
}

function recomputeBadFlags() {
  placement.pieces.forEach(p => {
    if (!p.placed) { p.bad = false; return; }
    p.cells.forEach(({ r, c }) => placement.board[r][c].shipId = null);
    p.bad = !cellsFreeStrict(placement.board, p.cells);
    p.cells.forEach(({ r, c }) => placement.board[r][c].shipId = p.id);
  });
}
// зона: синяя у корректных, красная у нарушающих фигур
function computeZones() {
  const blue = new Set(), red = new Set();
  placement.pieces.forEach(p => {
    if (!p.placed) return;
    p.cells.forEach(({ r, c }) => {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        if (placement.board[nr][nc].shipId !== null) continue;
        if (p.bad) red.add(nr + ',' + nc); else blue.add(nr + ',' + nc);
      }
    });
  });
  return { blue, red };
}

function renderPlaceBoard() {
  recomputeBadFlags();
  const board = document.getElementById('place-board');
  const { blue, red } = computeZones();
  let layer = board.querySelector('.ship-layer');

  // создаём клетки один раз; пересоздаём, если размер поля изменился (смена режима)
  if (board.querySelectorAll('.cell').length !== SIZE * SIZE) {
    board.querySelectorAll('.cell').forEach(el => el.remove());
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r; cell.dataset.c = c;
      if (layer) board.insertBefore(cell, layer);
      else board.appendChild(cell);
    }
  }

  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const cell = getCellEl('place-board', r, c);
    if (!cell) continue;
    const pc = placement.board[r][c];
    // сбрасываем классы состояний, сохраняя базовый
    cell.classList.remove('ship', 'conflict-cell', 'placed-zone', 'placed-zone-bad');
    cell.onpointerdown = null;
    const key = r + ',' + c;
    if (pc.shipId !== null) {
      const piece = placement.pieces[pc.shipId];
      cell.classList.add('ship');
      if (piece.bad) cell.classList.add('conflict-cell');
      cell.onpointerdown = (e) => beginDrag(e, piece, 'board', cell);
    } else if (red.has(key)) {
      cell.classList.add('placed-zone-bad');
    } else if (blue.has(key)) {
      cell.classList.add('placed-zone');
    }
  }
  renderShipLayer('place-board', placement.pieces.filter(p => p.placed), placement.animateId, placement.animType);
  placement.animateId = undefined; placement.animType = undefined;
}

function renderDock() {
  const dock = document.getElementById('dock-pieces');
  const oldH = dock.getBoundingClientRect().height;
  dock.innerHTML = '';
  placement.pieces.forEach(piece => {
    if (piece.placed || piece.dragging) return;
    piece.horiz = true; // в доке всегда горизонтально
    const el = document.createElement('div');
    el.className = 'dock-piece'; el.dataset.len = piece.len; el.dataset.pieceId = piece.id;
    layoutDockPiece(el, piece);
    el.addEventListener('pointerdown', (e) => beginDrag(e, piece, 'dock', el));
    dock.appendChild(el);
  });
  // плавная анимация высоты дока
  dock.style.transition = 'none';
  dock.style.height = 'auto';
  const newH = dock.getBoundingClientRect().height;
  dock.style.height = oldH + 'px';
  requestAnimationFrame(() => {
    dock.style.transition = '';
    dock.style.height = newH + 'px';
  });

  const allPlaced = placement.pieces.every(p => p.placed);
  const anyBad = placement.pieces.some(p => p.placed && p.bad);
  const playWindow = document.getElementById('play-window');
  const title = document.getElementById('dock-title');
  title.textContent = anyBad ? 'фигуры впритык — разнеси их' : 'твои фигуры';
  if (allPlaced && !anyBad) playWindow.classList.add('show');
  else playWindow.classList.remove('show');
}

function layoutDockPiece(el, piece) {
  el.innerHTML = '';
  const unit = 32;
  const shape = document.createElement('div'); shape.className = 'dock-shape';
  // в доке всегда горизонтально
  shape.style.width = (unit * piece.len) + 'px'; shape.style.height = unit + 'px';
  el.appendChild(shape);
}

const ghost = document.getElementById('drag-ghost');
const gameEl = document.getElementById('game');
let dragInfo = null;

function beginDrag(e, piece, source, el) {
  if (dragInfo) return;
  e.preventDefault();
  dragInfo = { piece, source, el, startX: e.clientX, startY: e.clientY, moved: false };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragEnd);
}
function onDragMove(e) {
  if (!dragInfo) return;
  const dx = e.clientX - dragInfo.startX, dy = e.clientY - dragInfo.startY;
  if (!dragInfo.moved && Math.hypot(dx, dy) > 6) {
    dragInfo.moved = true;
    if (dragInfo.source === 'dock') dragInfo.el.classList.add('dragging');
    else liftPiece(dragInfo.piece);
    startGhost(dragInfo.piece);
  }
  if (dragInfo.moved) { moveGhost(e.clientX, e.clientY); previewOnBoard(e.clientX, e.clientY, dragInfo.piece); }
}
function onDragEnd(e) {
  if (!dragInfo) return;
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragEnd);
  const { piece, source, el, moved } = dragInfo;
  if (!moved) {
    // в доке фигуры не вращаем — поворот только для уже поставленных на поле
    if (source !== 'dock') rotatePlacedPiece(piece.id);
    dragInfo = null; return;
  }
  hideGhost(); clearPreview();
  if (source === 'dock') el.classList.remove('dragging');
  piece.dragging = false;
  const target = boardCellFromPoint(e.clientX, e.clientY);
  let success = false;
  if (target) success = tryPlacePiece(piece, target.r, target.c);
  if (!success) { renderPlaceBoard(); renderDock(); updatePlaceFill(); }
  dragInfo = null;
}
function liftPiece(piece) {
  if (!piece.placed) return;
  piece.cells.forEach(({ r, c }) => placement.board[r][c].shipId = null);
  piece.placed = false; piece.cells = []; piece.bad = false;
  piece.dragging = true;
  renderPlaceBoard(); updatePlaceFill();
  // окно «Играть» спрятать, но док не пересобираем (без мигания)
  document.getElementById('play-window').classList.remove('show');
}
function startGhost(piece) {
  ghost.dataset.len = piece.len; ghost.style.display = 'block';
  const cs = getBoardCellSize() * 1.12; const gap = 4;
  if (piece.horiz) { ghost.style.width = (cs * piece.len + gap * (piece.len - 1)) + 'px'; ghost.style.height = cs + 'px'; }
  else { ghost.style.width = cs + 'px'; ghost.style.height = (cs * piece.len + gap * (piece.len - 1)) + 'px'; }
  ghost._cs = cs;
}
function moveGhost(x, y) {
  const gameRect = gameEl.getBoundingClientRect();
  const cs = ghost._cs || getBoardCellSize();
  ghost.style.left = (x - gameRect.left - cs / 2) + 'px';
  ghost.style.top  = (y - gameRect.top  - cs / 2) + 'px';
}
function hideGhost() { ghost.style.display = 'none'; }
function getBoardCellSize() {
  const cell = document.querySelector('#place-board .cell');
  return cell ? cell.getBoundingClientRect().width : 34;
}
function boardCellFromPoint(x, y) {
  // прямое попадание в клетку
  const below = document.elementFromPoint(x, y);
  if (below) {
    const cell = below.closest('#place-board .cell');
    if (cell) return { r: +cell.dataset.r, c: +cell.dataset.c };
  }
  // если на зазоре/контуре — вычисляем ближайшую клетку по геометрии поля
  const board = document.getElementById('place-board');
  const rect = board.getBoundingClientRect();
  const pad = 6; // padding грида
  const inner = rect.width - pad * 2;
  if (x < rect.left + pad || x > rect.right - pad || y < rect.top + pad || y > rect.bottom - pad) {
    // чуть за пределами — всё равно прижимаем к краю если близко
    if (x < rect.left - 20 || x > rect.right + 20 || y < rect.top - 20 || y > rect.bottom + 20) return null;
  }
  const step = inner / SIZE;
  let c = Math.floor((x - rect.left - pad) / step);
  let r = Math.floor((y - rect.top - pad) / step);
  c = Math.max(0, Math.min(SIZE - 1, c));
  r = Math.max(0, Math.min(SIZE - 1, r));
  return { r, c };
}
function pieceCellsAt(piece, r, c) {
  const cells = [];
  for (let i = 0; i < piece.len; i++) cells.push({ r: piece.horiz ? r : r + i, c: piece.horiz ? c + i : c });
  return cells;
}

function cellIsBadForPlacement(r, c, selfCells) {
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return true;
  if (placement.board[r][c].shipId !== null) return true;  // перекрытие
  // касается чужой фигуры?
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
    if (selfCells.some(cc => cc.r === nr && cc.c === nc)) continue; // своя клетка — ок
    if (placement.board[nr][nc].shipId !== null) return true;
  }
  return false;
}

function previewOnBoard(x, y, piece) {
  clearPreview();
  const target = boardCellFromPoint(x, y);
  if (!target) return;
  const cells = pieceCellsAt(piece, target.r, target.c);

  // помечаем каждую клетку фигуры индивидуально
  cells.forEach(({ r, c }) => {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    const el = getCellEl('place-board', r, c);
    if (!el) return;
    const cellBad = cellIsBadForPlacement(r, c, cells);
    el.classList.add(cellBad ? 'preview-self-bad' : 'preview-self');
  });

  // зона вокруг — всегда нейтрально-синяя (просто показывает что станет недоступно)
  const around = new Set();
  cells.forEach(({ r, c }) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
      if (cells.some(cc => cc.r === nr && cc.c === nc)) continue;
      around.add(nr + ',' + nc);
    }
  });
  around.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    const el = getCellEl('place-board', r, c);
    if (el && !el.classList.contains('preview-self') && !el.classList.contains('preview-self-bad'))
      el.classList.add('preview-around');
  });
}
function clearPreview() {
  document.querySelectorAll('#place-board .preview-self, #place-board .preview-self-bad, #place-board .preview-around, #place-board .preview-around-bad')
    .forEach(el => el.classList.remove('preview-self', 'preview-self-bad', 'preview-around', 'preview-around-bad'));
}

function tryPlacePiece(piece, r, c) {
  const cells = pieceCellsAt(piece, r, c);
  if (!cellsNotOverlapping(placement.board, cells)) return false;
  cells.forEach(({ r, c }) => placement.board[r][c].shipId = piece.id);
  piece.placed = true; piece.cells = cells;
  placement.animateId = piece.id; placement.animType = 'place';
  renderPlaceBoard(); renderDock(); updatePlaceFill();
  return true;
}

function rotatePlacedPiece(pieceId) {
  const piece = placement.pieces[pieceId];
  if (!piece.placed || piece.len === 1) return;
  const anchor = piece.cells[0];
  piece.cells.forEach(({ r, c }) => placement.board[r][c].shipId = null);
  const test = { ...piece, horiz: !piece.horiz };
  const newCells = pieceCellsAt(test, anchor.r, anchor.c);
  piece.horiz = !piece.horiz;
  if (cellsNotOverlapping(placement.board, newCells)) {
    piece.cells = newCells; piece.placed = true;
    newCells.forEach(({ r, c }) => placement.board[r][c].shipId = piece.id);
    placement.animateId = piece.id; placement.animType = 'rotate';
    renderPlaceBoard(); renderDock(); updatePlaceFill();
  } else {
    piece.placed = false; piece.cells = [];
    renderPlaceBoard(); renderDock(); updatePlaceFill();
  }
}

function updatePlaceFill() {
  const placed = placement.pieces.filter(p => p.placed).length;
  document.getElementById('place-fill').style.width = (placed / TOTAL_SHIPS * 100) + '%';
}

function renderPlaceControls() {
  const ctrl = document.getElementById('controls');
  ctrl.classList.remove('hidden'); ctrl.innerHTML = '';
  const randBtn = document.createElement('button');
  randBtn.type = 'button';
  randBtn.className = 'icon-btn'; randBtn.title = 'Случайно';
  randBtn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 8 H17"/><path d="M14 5 L17 8 L14 11"/><path d="M20 16 H7"/><path d="M10 13 L7 16 L10 19"/></svg>`;
  randBtn.addEventListener('click', (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!placement) return;
    try {
      const auto = placeFleetAuto();
      if (!auto.ships.length) return;
      placement.board = auto.board;
      placement.pieces = auto.ships.map(s => ({
        id: s.id, len: s.len,
        horiz: s.cells.length < 2 ? true : (s.cells[0].r === s.cells[1].r),
        placed: true, cells: s.cells, bad: false
      }));
      placement.animateId = undefined; placement.animType = undefined;
      renderPlaceBoard(); renderDock(); updatePlaceFill();
    } catch (err) { try { console.error('[BLINDGRID] rand:', err); } catch (_) {} }
  });
  ctrl.appendChild(randBtn);
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'icon-btn'; resetBtn.title = 'Сброс';
  resetBtn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 4 V19"/><path d="M6 13 L12 19 L18 13"/></svg>`;
  resetBtn.addEventListener('click', resetWithAnimation);
  ctrl.appendChild(resetBtn);
}

function resetWithAnimation() {
  const layer = document.querySelector('#place-board .ship-layer');
  const hasPieces = layer && layer.querySelector('.ship-piece');
  if (!hasPieces) { startPlacement(); return; }
  // фигуры плавно уезжают вниз
  const board = document.getElementById('place-board');
  const fallH = board.getBoundingClientRect().height + 40;
  layer.querySelectorAll('.ship-piece').forEach((el, i) => {
    el.style.transition = 'top 0.45s cubic-bezier(.5,0,.75,0), opacity 0.45s ease';
    el.style.top = (parseFloat(el.style.top) + fallH) + 'px';
    el.style.opacity = '0';
  });
  setTimeout(startPlacement, 420);
}

function startBattle() {
  const playerShips = placement.pieces.map(p => ({ id: p.id, len: p.len, cells: p.cells, hits: 0, sunk: false }));
  const playerBoard = freshBoard();
  playerShips.forEach(s => s.cells.forEach(({ r, c }) => playerBoard[r][c].shipId = s.id));
  const enemy = placeFleetAuto();
  state = { player: { board: playerBoard, ships: playerShips }, enemy, turn: 'player', over: false, aiQueue: [], aiHitsOnShip: [], combo: 0, missStreak: 0, comboXP: 0 };
  hideCombo();
  showScreen('battle-screen');
  document.getElementById('controls').classList.add('hidden');
  document.getElementById('enemy-board').classList.remove('locked');
  // мгновенно ставим шкалы в 0 без анимации (чтобы не «уезжали назад»)
  ['my-fill','enemy-fill'].forEach(id => {
    const f = document.getElementById(id);
    f.style.transition = 'none'; f.style.width = '0%';
    requestAnimationFrame(() => { f.style.transition = ''; });
  });
  renderBattleBoards();
  renderShipLayer('battle-my-board', state.player.ships);
  updateFleetFills();
  turnAngle = 0; turnSide = null; turnLastFlip = 0;   // сброс инерции стрелки
  setTurnArrow('player');
}
function renderBattleBoards() {
  const myBoard = document.getElementById('battle-my-board');
  const enemyBoard = document.getElementById('enemy-board');
  myBoard.innerHTML = ''; enemyBoard.innerHTML = '';
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const myCell = document.createElement('div');
    myCell.className = 'cell'; myCell.dataset.r = r; myCell.dataset.c = c;
    if (state.player.board[r][c].shipId !== null) myCell.classList.add('ship');
    myBoard.appendChild(myCell);
    const enemyCell = document.createElement('div');
    enemyCell.className = 'cell'; enemyCell.dataset.r = r; enemyCell.dataset.c = c;
    enemyCell.addEventListener('click', () => onEnemyCellClick(r, c));
    enemyBoard.appendChild(enemyCell);
  }
  // слой для мостов на обоих полях (одинаковая раскладка стека)
  [myBoard, enemyBoard].forEach(b => {
    if (!b.querySelector('.ship-layer')) {
      const l = document.createElement('div'); l.className = 'ship-layer'; b.appendChild(l);
    }
  });
}
function getCellEl(boardId, r, c) {
  return document.querySelector(`#${boardId} .cell[data-r="${r}"][data-c="${c}"]`);
}
function updateFleetFills() {
  const mySunk = state.player.ships.filter(s => s.sunk).length;
  const enemySunk = state.enemy.ships.filter(s => s.sunk).length;
  document.getElementById('my-fill').style.width = (mySunk / TOTAL_SHIPS * 100) + '%';
  document.getElementById('enemy-fill').style.width = (enemySunk / TOTAL_SHIPS * 100) + '%';
}
let turnAngle = 0, turnSide = null, turnLastFlip = 0;
function setTurnArrow(who) {
  const arrow = document.getElementById('turn-arrow');
  // классы — для цвета фона/треугольника
  if (who === 'player') { arrow.classList.add('down'); arrow.classList.remove('up'); }
  else { arrow.classList.add('up'); arrow.classList.remove('down'); }

  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (turnSide === null) {
    turnAngle = (who === 'enemy') ? 180 : 0;     // первая установка — без вращения
  } else if (who !== turnSide) {
    turnAngle += 180;                            // всегда крутим вперёд
  }
  const changed = (turnSide !== null && who !== turnSide);
  turnSide = who;

  const dt = now - turnLastFlip; turnLastFlip = now;
  // насколько «быстро» переключают: 0 (медленно) .. 1 (очень быстро)
  const fast = changed ? Math.max(0, Math.min(1, (620 - dt) / 620)) : 0;
  const overshoot = 22 * fast;                   // занос 0..22°
  const p1 = 0.5 - 0.3 * fast;                   // фаза разгона: медленно 0.5с → быстро 0.2с

  arrow.style.transition = 'transform ' + p1.toFixed(3) + 's cubic-bezier(.3,.75,.32,1), background 0.6s ease';
  arrow.style.transform = 'rotate(' + (turnAngle + overshoot) + 'deg)';
  clearTimeout(arrow._settle);
  if (overshoot > 0.5) {
    // возврат с заносом обратно к цели
    arrow._settle = setTimeout(() => {
      arrow.style.transition = 'transform ' + (0.34 + 0.16 * fast).toFixed(3) + 's cubic-bezier(.25,.9,.35,1), background 0.6s ease';
      arrow.style.transform = 'rotate(' + turnAngle + 'deg)';
    }, p1 * 1000);
  }
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function setGameUIHidden(hidden) {
  document.getElementById('game').classList.toggle('ui-hidden', hidden);
}

function sinkShipSmooth(boardId, side, ship) {
  const cells = [...ship.cells];
  const horiz = cells.length > 1 && cells[0].r === cells[1].r;
  cells.sort((a, b) => horiz ? (a.c - b.c) : (a.r - b.r));
  const cellSet = new Set(ship.cells.map(c => c.r + ',' + c.c));

  const step = 180;
  cells.forEach((pos, i) => {
    const el = getCellEl(boardId, pos.r, pos.c);
    if (!el) return;
    // переводим в sunk (фон и маркер совпадают с hit — без скачка)
    el.classList.add('sunk');
    el.classList.remove('hit');
    const applyFilled = () => {
      el.classList.add('filled');
      const { r, c } = pos;
      // ровно 5 теней (база + 4 направленные слота) — совпадает со стартовым числом → плавно
      const up    = cellSet.has((r - 1) + ',' + c) ? '0 -6px 0 0 var(--sunk)' : '0 0 0 0 transparent';
      const down  = cellSet.has((r + 1) + ',' + c) ? '0 6px 0 0 var(--sunk)'  : '0 0 0 0 transparent';
      const left  = cellSet.has(r + ',' + (c - 1)) ? '-6px 0 0 0 var(--sunk)' : '0 0 0 0 transparent';
      const right = cellSet.has(r + ',' + (c + 1)) ? '6px 0 0 0 var(--sunk)'  : '0 0 0 0 transparent';
      el.style.boxShadow = ['0 0 0 1.5px var(--sunk)', up, down, left, right].join(', ');
    };
    // всегда даём кадр на фиксацию стартового состояния sunk перед filled
    if (i === 0) requestAnimationFrame(() => requestAnimationFrame(applyFilled));
    else setTimeout(applyFilled, i * step);
  });

  // на своём поле плавно гасим цветную фигуру под попаданиями; на поле врага фигур нет
  if (boardId === 'battle-my-board') {
    const layer = document.getElementById(boardId).querySelector('.ship-layer');
    const pieceEl = layer && layer.querySelector('[data-key="sp-' + boardId + '-' + ship.id + '"]');
    if (pieceEl) {
      const fadeDelay = cells.length * step * 0.4;
      setTimeout(() => {
        pieceEl.classList.add('fade-out');
        setTimeout(() => renderShipLayer(boardId, side.ships.filter(s => !s.sunk)), 950);
      }, fadeDelay);
    } else {
      renderShipLayer(boardId, side.ships.filter(s => !s.sunk));
    }
  }

  const waveDone = cells.length * step + 500;
  const around = [];
  ship.cells.forEach(({ r, c }) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
      const cell = side.board[nr][nc];
      if (cell.shipId !== null || cell.shot) continue;
      cell.shot = true; around.push({ r: nr, c: nc });
    }
  });
  around.forEach((pos, i) => {
    setTimeout(() => {
      const el = getCellEl(boardId, pos.r, pos.c);
      if (el) el.classList.add('miss');
    }, waveDone + i * 35);
  });
}

function buildSunkBridges(boardId, ship) {
  const cellSet = new Set(ship.cells.map(c => c.r + ',' + c.c));
  ship.cells.forEach(({ r, c }) => {
    const el = getCellEl(boardId, r, c);
    if (!el) return;
    // базовый тонкий кант того же цвета — перекрывает зазор у любой клетки (в т.ч. одиночной)
    const shadows = ['0 0 0 1.5px var(--sunk)'];
    if (cellSet.has((r - 1) + ',' + c)) shadows.push('0 -6px 0 0 var(--sunk)');
    if (cellSet.has((r + 1) + ',' + c)) shadows.push('0 6px 0 0 var(--sunk)');
    if (cellSet.has(r + ',' + (c - 1))) shadows.push('-6px 0 0 0 var(--sunk)');
    if (cellSet.has(r + ',' + (c + 1))) shadows.push('6px 0 0 0 var(--sunk)');
    el.style.boxShadow = shadows.join(', ');
  });
}

function onEnemyCellClick(r, c) {
  if (!state || state.over || state.turn !== 'player') return;
  const cell = state.enemy.board[r][c];
  if (cell.shot) return;
  cell.shot = true;
  const el = getCellEl('enemy-board', r, c);
  spawnRipple(el, 'blue');
  if (cell.shipId !== null) {
    const ship = state.enemy.ships[cell.shipId];
    ship.hits++;
    if (el) el.classList.add('hit');
    // КОМБО: попадание увеличивает
    state.combo = (state.combo || 0) + 1;
    state.missStreak = 0;
    if (state.combo >= 2) {
      // комбо-опыт: быстрая игра — геометрия (x2=10,x3=20,…); классика — мягко и с потолком
      const cg = (lastMode === 'classic')
        ? Math.min(30, 5 * (state.combo - 1))           // x2=5, x3=10, … потолок 30
        : 10 * Math.pow(2, state.combo - 2);
      state.comboXP = (state.comboXP || 0) + cg;
      showCombo(state.combo);
    }
    if (ship.hits >= ship.len) {
      ship.sunk = true;
      setTimeout(() => {
        sinkShipSmooth('enemy-board', state.enemy, ship);
        updateFleetFills();
        if (allSunk(state.enemy)) endGame('player');
      }, 450);
    }
  } else {
    if (el) el.classList.add('miss');
    // КОМБО: первый промах не сбивает, но тускнеет; второй подряд — сброс
    state.missStreak = (state.missStreak || 0) + 1;
    if (state.missStreak >= 2) {
      state.combo = 0; hideCombo();
    } else if (state.combo >= 2) {
      document.getElementById('combo-tag').classList.add('dim');
    }
    state.turn = 'enemy'; setTurnArrow('enemy');
    document.getElementById('enemy-board').classList.add('locked');
    setTimeout(aiTurn, 750);
  }
}
function allSunk(side) { return side.ships.every(s => s.sunk); }

function renderCombo(tag, n) {
  if (!tag) return;
  let inner = tag.querySelector('.combo-inner');
  if (!inner) { inner = document.createElement('span'); inner.className = 'combo-inner'; tag.appendChild(inner); }
  const palette = ['#3fc4b0', '#4e8eff', '#9b6dff', '#ff5d8f', '#ff9326', '#ff4757'];
  const idx = Math.max(0, Math.min(n - 2, palette.length - 1));
  const big = n >= 4;
  inner.textContent = '×' + n + '!';
  inner.style.color = palette[idx];
  inner.style.fontSize = (22 + Math.min(n, 8) * 4) + 'px';
  inner.style.textShadow = big
    ? '0 2px 6px rgba(52,48,74,0.28), 0 0 14px ' + palette[idx] + '66'
    : '0 2px 4px rgba(52,48,74,0.18)';

  const wasVisible = tag.classList.contains('show') || tag.classList.contains('big');
  tag.classList.remove('hide-out', 'dim');
  const cls = big ? 'big' : 'show';
  if (!wasVisible) {
    tag.classList.remove('show', 'big');
    void tag.offsetWidth;
    tag.classList.add(cls);
  } else if (!tag.classList.contains(cls)) {
    tag.classList.remove('show', 'big');
    tag.classList.add(cls);
  }
  // эпичный подскок числа при каждом росте комбо
  tag.classList.remove('levelup');
  void inner.offsetWidth;
  tag.classList.add('levelup');
  clearTimeout(tag._luT);
  tag._luT = setTimeout(() => tag.classList.remove('levelup'), 520);
}
function hideComboTag(tag) {
  if (!tag) return;
  const wasVisible = tag.classList.contains('show') || tag.classList.contains('big');
  tag.classList.remove('show', 'big', 'levelup', 'dim');
  if (wasVisible) {
    tag.classList.add('hide-out');
    setTimeout(() => { tag.classList.remove('hide-out'); tag.style.opacity = '0'; }, 440);
  } else {
    tag.style.opacity = '0';
  }
}
function showCombo(n) { renderCombo(document.getElementById('combo-tag'), n); }
function hideCombo() { hideComboTag(document.getElementById('combo-tag')); }

let shipStyle = 'classic';
// у каждого размера корабля — свой вид цветка и своя связка
const FLOWER_SPECIES = {
  1: { petal:'#ffd24d', edge:'#f0a92a', center:'#ff9326', leaf:'#7bc47a', kind:'daisy'   },
  2: { petal:'#7fe0da', edge:'#39b6ae', center:'#ffe08a', leaf:'#6fc88f', kind:'tulip'   },
  3: { petal:'#ff9bb0', edge:'#ff5d77', center:'#ffe08a', leaf:'#7bc47a', kind:'rose'    },
  4: { petal:'#ffc06a', edge:'#e87a14', center:'#a8410e', leaf:'#6fc88f', kind:'sun'     },
};
// рисует один цветок в локальных координатах 0..100 (центр 50,50)
function oneFlower(sp, rot) {
  const k = sp.kind; let petals = '';
  if (k === 'daisy') {
    const n = 8;
    for (let i=0;i<n;i++){ const a=(360/n)*i;
      petals += `<g transform="rotate(${a} 50 50)"><ellipse cx="50" cy="28" rx="9" ry="20" fill="${sp.petal}" stroke="${sp.edge}" stroke-width="2.5"/></g>`; }
  } else if (k === 'tulip') {
    const n = 6;
    for (let i=0;i<n;i++){ const a=(360/n)*i;
      petals += `<g transform="rotate(${a} 50 50)"><path d="M50 14 C40 30 44 44 50 50 C56 44 60 30 50 14 Z" fill="${sp.petal}" stroke="${sp.edge}" stroke-width="2.5"/></g>`; }
  } else if (k === 'rose') {
    const n = 5;
    for (let i=0;i<n;i++){ const a=(360/n)*i;
      petals += `<g transform="rotate(${a} 50 50)"><path d="M50 50 C36 44 34 22 50 16 C66 22 64 44 50 50 Z" fill="${sp.petal}" stroke="${sp.edge}" stroke-width="2.5"/></g>`; }
  } else { // sun — острые лепестки
    const n = 12;
    for (let i=0;i<n;i++){ const a=(360/n)*i;
      petals += `<g transform="rotate(${a} 50 50)"><path d="M50 8 L57 32 L50 42 L43 32 Z" fill="${sp.petal}" stroke="${sp.edge}" stroke-width="2"/></g>`; }
  }
  return `<g transform="rotate(${rot} 50 50)">${petals}<circle cx="50" cy="50" r="13" fill="${sp.center}" stroke="${sp.edge}" stroke-width="2.5"/></g>`;
}
// связанная цветочная фигура на N клеток вдоль оси
function flowerArtSVG(len, horiz) {
  const sp = FLOWER_SPECIES[len] || FLOWER_SPECIES[1];
  // виртуальная сетка вдоль длинной оси; каждая клетка = 100 ед.
  const span = len * 100;
  const W = horiz ? span : 100, H = horiz ? 100 : span;
  const cx = c => horiz ? c*100 + 50 : 50;
  const cy = c => horiz ? 50 : c*100 + 50;
  // стебель-лоза, соединяющая центры цветов (плавная волна)
  let stem = '';
  if (len > 1) {
    let d = `M ${cx(0)} ${cy(0)}`;
    for (let c=1;c<len;c++){
      const px = cx(c-1), py = cy(c-1), nx = cx(c), ny = cy(c);
      const mx = (px+nx)/2, my=(py+ny)/2;
      const off = (c%2===0?1:-1)*16;
      const ctrlx = horiz ? mx : mx+off, ctrly = horiz ? my+off : my;
      d += ` Q ${ctrlx} ${ctrly} ${nx} ${ny}`;
    }
    stem = `<path d="${d}" fill="none" stroke="${sp.leaf}" stroke-width="9" stroke-linecap="round"/>`;
    // листики на стебле
    for (let c=0;c<len-1;c++){
      const lx = horiz ? c*100+100 : 50 + (c%2?22:-22);
      const ly = horiz ? 50 + (c%2?22:-22) : c*100+100;
      const lr = horiz ? (c%2?30:-30) : (c%2?60:120);
      stem += `<g transform="translate(${lx} ${ly}) rotate(${lr})"><path d="M0 0 C12 -7 24 -3 26 8 C15 12 3 9 0 0 Z" fill="${sp.leaf}"/></g>`;
    }
  }
  let flowers = '';
  for (let c=0;c<len;c++){
    flowers += `<g transform="translate(${cx(c)-50} ${cy(c)-50})">${oneFlower(sp, c*18)}</g>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${stem}${flowers}</svg>`;
}
function buildStylePreviews() {
  const lens = [1, 2, 3, 4];
  const classic = document.getElementById('preview-classic');
  const flowers = document.getElementById('preview-flowers');
  if (classic) {
    classic.innerHTML = lens.map(len => {
      let cells = '';
      for (let i = 0; i < len; i++) cells += `<span class="pv-cell" style="background:var(--grad-${len})"></span>`;
      return `<span class="pv-ship">${cells}</span>`;
    }).join('');
  }
  if (flowers) {
    flowers.innerHTML = lens.map(len =>
      `<span class="pv-flower-ship" style="width:${len*18}px;height:18px;display:inline-flex">${flowerArtSVG(len, true)}</span>`
    ).join('');
  }
}
function applyStyle(style) {
  shipStyle = style;
  document.getElementById('game').classList.toggle('style-flowers', style === 'flowers');
  // перерисовать фигуры на активных полях
  if (typeof state !== 'undefined' && state && state.player) {
    renderShipLayer('battle-my-board', state.player.ships.filter(s => !s.sunk), undefined, undefined, true);
  }
  if (typeof placement !== 'undefined' && placement) {
    renderShipLayer('place-board', placement.pieces.filter(p => p.placed), undefined, undefined, true);
  }
  syncStyleButtons();
}
function syncStyleButtons() {
  const c = document.getElementById('style-classic');
  const fl = document.getElementById('style-flowers');
  if (c) c.classList.toggle('selected', shipStyle === 'classic');
  if (fl) fl.classList.toggle('selected', shipStyle === 'flowers');
}

function shipGrad(len) {
  return ({
    4: 'linear-gradient(140deg,#ffb259,#ff9326)',
    3: 'linear-gradient(140deg,#ff8c97,#ff6f86)',
    2: 'linear-gradient(140deg,#62d3cd,#4fcac4)',
    1: 'linear-gradient(140deg,#ffce6e,#ffbf4d)'
  })[len] || 'var(--hit)';
}

function spawnRipple(cellEl, color) {
  if (!cellEl) return;
  const grid = cellEl.closest('.grid');
  if (!grid) return;
  const cr = cellEl.getBoundingClientRect();
  const gr = grid.getBoundingClientRect();
  const rip = document.createElement('div');
  rip.className = 'shot-ripple ' + color;
  rip.style.left = (cr.left - gr.left) + 'px';
  rip.style.top = (cr.top - gr.top) + 'px';
  rip.style.width = cr.width + 'px';
  rip.style.height = cr.height + 'px';
  grid.appendChild(rip);
  setTimeout(() => rip.remove(), 650);
}

function aiTurn() {
  if (!state || state.over || state.turn !== 'enemy') return;
  const target = pickAITarget();
  if (!target) {
    // свободных клеток нет — безопасно вернуть ход игроку, не падаем
    state.turn = 'player'; setTurnArrow('player');
    document.getElementById('enemy-board').classList.remove('locked');
    return;
  }
  const cell = state.player.board[target.r][target.c];
  cell.shot = true;
  const el = getCellEl('battle-my-board', target.r, target.c);
  spawnRipple(el, 'red');
  if (cell.shipId !== null) {
    const ship = state.player.ships[cell.shipId];
    ship.hits++;
    if (el) el.classList.add('hit');
    state.aiHitsOnShip.push(target);
    enqueueAINeighbors(target);
    if (ship.hits >= ship.len) {
      ship.sunk = true;
      setTimeout(() => {
        sinkShipSmooth('battle-my-board', state.player, ship);
        updateFleetFills();
      }, 450);
      state.aiQueue = []; state.aiHitsOnShip = [];
      if (allSunk(state.player)) { setTimeout(() => endGame('enemy'), 600); return; }
    }
    setTimeout(aiTurn, 950);
  } else {
    if (el) el.classList.add('miss');
    state.turn = 'player'; setTurnArrow('player');
    document.getElementById('enemy-board').classList.remove('locked');
  }
}

function pickAITarget() {
  while (state.aiQueue.length > 0) {
    const t = state.aiQueue.shift();
    if (validAITarget(t.r, t.c)) return t;
  }
  const candidates = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++)
    if (!state.player.board[r][c].shot && (r + c) % 2 === 0) candidates.push({ r, c });
  if (candidates.length === 0)
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++)
      if (!state.player.board[r][c].shot) candidates.push({ r, c });
  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}
function validAITarget(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE && !state.player.board[r][c].shot; }
function enqueueAINeighbors(hit) {
  const hits = state.aiHitsOnShip;
  if (hits.length >= 2) {
    const sorted = [...hits].sort((a, b) => (a.r - b.r) || (a.c - b.c));
    const first = sorted[0], last = sorted[sorted.length - 1];
    const horiz = first.r === last.r;
    const ends = horiz ? [{ r: first.r, c: first.c - 1 }, { r: last.r, c: last.c + 1 }]
                       : [{ r: first.r - 1, c: first.c }, { r: last.r + 1, c: last.c }];
    ends.forEach(e => { if (validAITarget(e.r, e.c)) state.aiQueue.unshift(e); });
  } else {
    [{ r: hit.r - 1, c: hit.c }, { r: hit.r + 1, c: hit.c }, { r: hit.r, c: hit.c - 1 }, { r: hit.r, c: hit.c + 1 }]
      .forEach(e => { if (validAITarget(e.r, e.c)) state.aiQueue.push(e); });
  }
}

function endGame(winner) {
  state.over = true;
  document.getElementById('enemy-board').classList.add('locked');
  const win = winner === 'player';
  // очки: +10 за каждый уцелевший блок твоих кораблей (при победе), при поражении блоков не остаётся → −100
  const remaining = state.player.ships.reduce((a, s) => a + Math.max(0, s.len - s.hits), 0);
  const combo = Math.round(state.comboXP || 0);   // бонус за комбо — отдельным этапом
  setTimeout(() => {
    showXpResult(win, remaining, 'sea', combo);
    launchConfetti(win);
  }, 600);
}

function launchConfetti(win) {
  const overlay = document.getElementById('overlay');
  let layer = overlay.querySelector('.confetti-layer');
  if (layer) layer.remove();
  layer = document.createElement('div');
  layer.className = 'confetti-layer';
  overlay.appendChild(layer);
  const grads = win ? [
    'linear-gradient(140deg,#ff8c97,#ff6f86)',
    'linear-gradient(140deg,#62d3cd,#4fcac4)',
    'linear-gradient(140deg,#ffce6e,#ffbf4d)',
    'linear-gradient(140deg,#8b7cff,#6c5ce7)'
  ] : [
    'linear-gradient(140deg,#ff8c97,#ff5d73)',
    'linear-gradient(140deg,#ff6f86,#e23d56)',
    'linear-gradient(140deg,#ff9aa2,#ff5d73)'
  ];
  const N = 38;
  for (let i = 0; i < N; i++) {
    const c = document.createElement('div');
    c.className = 'confetti' + (win ? '' : ' up');
    const unit = 7 + Math.random() * 6;
    const len = 1 + Math.floor(Math.random() * 3);
    const horiz = Math.random() < 0.5;
    if (horiz) { c.style.width = (unit * len) + 'px'; c.style.height = unit + 'px'; }
    else { c.style.width = unit + 'px'; c.style.height = (unit * len) + 'px'; }
    c.style.left = (Math.random() * 100) + '%';
    c.style.top = win ? '-12%' : '112%';
    c.style.background = grads[i % grads.length];
    c.style.setProperty('--rot', (Math.random() * 360) + 'deg');
    c.style.setProperty('--drift', (Math.random() * 120 - 60) + 'px');
    c.style.animationDuration = (2.2 + Math.random() * 1.8) + 's';
    c.style.animationDelay = (Math.random() * 0.6) + 's';
    layer.appendChild(c);
  }
  setTimeout(() => { if (layer) layer.remove(); }, 5000);
}

window.addEventListener('resize', () => {
  if (document.getElementById('placement-screen').classList.contains('active') && placement) {
    renderShipLayer('place-board', placement.pieces.filter(p => p.placed));
  } else if (state) {
    renderShipLayer('battle-my-board', state.player.ships.filter(s => !s.sunk));
  }
});

document.getElementById('overlay-btn').addEventListener('click', () => {
  document.getElementById('overlay').classList.add('hidden');
  if (currentGame === 'snake') { startSnake(); return; }
  applyMode(lastMode);
  startPlacement();
});
document.getElementById('overlay-back').addEventListener('click', () => {
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('snake-screen').classList.add('hidden');
  setGameUIHidden(true);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  renderProfile();
  document.getElementById('opp-select').classList.remove('hidden');
});
document.getElementById('play-btn').addEventListener('click', () => {
  if (!placement) return;
  const allPlaced = placement.pieces.every(p => p.placed);
  const anyBad = placement.pieces.some(p => p.placed && p.bad);
  if (!allPlaced || anyBad) return;
  startBattle();
});

function showMenu() {
  // прячем игровой UI, чтобы под меню ничего не мелькало
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  setGameUIHidden(true);
  const menu = document.getElementById('menu');
  menu.classList.remove('hidden');
}

let gameType = 'sea';   // 'sea' | 'snake'
let currentGame = 'sea';
document.getElementById('menu-play').addEventListener('click', () => {
  setGameUIHidden(true);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('menu').classList.add('hidden');
  renderProfile();
  document.getElementById('gametype-select').classList.remove('hidden');
});
document.getElementById('gametype-back-x').addEventListener('click', () => {
  document.getElementById('gametype-select').classList.add('hidden');
  showMenu();
});
document.getElementById('gt-sea').addEventListener('click', () => {
  gameType = 'sea';
  document.getElementById('gametype-select').classList.add('hidden');
  renderProfile();
  document.getElementById('opp-select').classList.remove('hidden');
});
document.getElementById('gt-snake').addEventListener('click', () => {
  gameType = 'snake';
  document.getElementById('gametype-select').classList.add('hidden');
  renderProfile();
  document.getElementById('opp-select').classList.remove('hidden');
});
document.getElementById('menu-friends').addEventListener('click', () => {
  // друзья — появится позже
});
document.getElementById('menu-settings').addEventListener('click', () => {
  setGameUIHidden(true);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('custom-select').classList.remove('hidden');
  buildStylePreviews();
  syncStyleButtons();
});
document.getElementById('custom-back-x').addEventListener('click', () => {
  document.getElementById('custom-select').classList.add('hidden');
  showMenu();
});
const THEME_KEY = 'bg_theme_v1';
function applyTheme(theme) {
  document.body.classList.toggle('theme-dark', theme === 'dark');
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  buildStylePreviews();
}
document.getElementById('theme-switch').addEventListener('click', () => {
  const dark = document.body.classList.contains('theme-dark');
  applyTheme(dark ? 'light' : 'dark');
});
document.getElementById('style-classic').addEventListener('click', () => { applyStyle('classic'); buildStylePreviews(); });
document.getElementById('style-flowers').addEventListener('click', () => { applyStyle('flowers'); buildStylePreviews(); });

// экран выбора соперника
document.getElementById('opp-ai').addEventListener('click', () => {
  document.getElementById('opp-select').classList.add('hidden');
  if (gameType === 'snake') startSnake();
  else showModeSelect();
});
document.getElementById('opp-pvp').addEventListener('click', () => {
  // против игрока — появится позже
});
document.getElementById('opp-back-x').addEventListener('click', () => {
  document.getElementById('opp-select').classList.add('hidden');
  document.getElementById('gametype-select').classList.remove('hidden');
});

function showModeSelect() {
  setGameUIHidden(true);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  renderProfile();
  document.getElementById('mode-select').classList.remove('hidden');
}
let lastMode = 'fast';
function startGameWithMode(mode) {
  currentGame = 'sea';
  lastMode = mode;
  applyMode(mode);
  document.getElementById('mode-select').classList.add('hidden');
  startPlacement();
}
document.getElementById('mode-fast').addEventListener('click', () => startGameWithMode('fast'));
document.getElementById('mode-classic').addEventListener('click', () => startGameWithMode('classic'));
document.getElementById('mode-back-x').addEventListener('click', () => {
  document.getElementById('mode-select').classList.add('hidden');
  document.getElementById('opp-select').classList.remove('hidden');
});

makeParticles('mode-particles');
makeParticles('opp-particles');
makeParticles('custom-particles');
makeParticles('gametype-particles');
makeParticles('snake-particles');
syncStyleButtons();

renderPlaceControls();
applyMode('fast');
startPlacement();
// тема: сохранённая, иначе тёмная по умолчанию
(function () {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  applyTheme(saved || 'dark');
})();
setGameUIHidden(true);
document.getElementById('menu').classList.remove('hidden');

/* ===================== СИСТЕМА ОПЫТА И РАНГОВ (v1.1) ===================== */
const tgUser = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
const XP_KEY = 'bg_xp_v1';
let bgXpMem = 0;
function getXP() { try { return parseInt(localStorage.getItem(XP_KEY) || '0', 10) || 0; } catch (e) { return bgXpMem; } }
function setXP(v) { bgXpMem = v; try { localStorage.setItem(XP_KEY, String(v)); } catch (e) {} renderProfile(); }

const RANK_CATS = [
  { key: 'bronze',    name: 'Бронза',    c1: '#c8804a', c2: '#e6a96f' },
  { key: 'iron',      name: 'Железо',    c1: '#7d8590', c2: '#aeb6c1' },
  { key: 'silver',    name: 'Серебро',   c1: '#9aa7b8', c2: '#dde6f0' },
  { key: 'gold',      name: 'Золото',    c1: '#e0a52a', c2: '#ffdb74' },
  { key: 'diamond',   name: 'Алмаз',     c1: '#2fb4d8', c2: '#9af0ff' },
  { key: 'emerald',   name: 'Изумруд',   c1: '#1aa869', c2: '#74e8b0' },
  { key: 'ruby',      name: 'Рубин',     c1: '#d4324f', c2: '#ff7a92' },
  { key: 'brilliant', name: 'Бриллиант', c1: '#8a7bff', c2: '#d6c9ff' }
];
const TIER_NEED = {
  bronze: [250, 350, 450], iron: [550, 700, 850], silver: [1000, 1200, 1400],
  gold: [1700, 2000, 2300], diamond: [2700, 3100, 3500], emerald: [4000, 4600, 5200],
  ruby: [6000, 6800, 7600], brilliant: [8800, 10000, 11500]
};
const ROMAN = ['', 'I', 'II', 'III'];
const RANKS = [];
RANK_CATS.forEach(cat => {
  for (let t = 1; t <= 3; t++) RANKS.push({ cat: cat.key, catName: cat.name, tier: t, c1: cat.c1, c2: cat.c2, need: TIER_NEED[cat.key][t - 1] });
});
RANKS.push({ cat: 'absolute', catName: 'Абсолют', tier: 0, c1: '#ff5d8f', c2: '#6c80f5', need: Infinity });

function mkRI(i, into, need) {
  const r = RANKS[i];
  const name = r.tier ? (r.catName + ' ' + ROMAN[r.tier]) : r.catName;
  const frac = need === Infinity ? 1 : Math.max(0, Math.min(1, into / need));
  const bw = r.cat === 'absolute' ? 4.5 : (2 + r.tier * 0.7);
  return { index: i, cat: r.cat, catName: r.catName, tier: r.tier, name: name, c1: r.c1, c2: r.c2, into: into, need: need, frac: frac, bw: bw };
}
function rankInfo(total) {
  let acc = 0;
  for (let i = 0; i < RANKS.length; i++) {
    const r = RANKS[i];
    if (r.need === Infinity) return mkRI(i, total - acc, Infinity);
    if (total < acc + r.need) return mkRI(i, total - acc, r.need);
    acc += r.need;
  }
  return mkRI(RANKS.length - 1, 0, Infinity);
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
  const n = parseInt(f, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function styleFrame(el, ri) {
  if (!el) return;
  el.style.padding = ri.bw + 'px';
  const glow = (ri.tier === 3 || ri.cat === 'absolute') ? 14 : (ri.tier === 2 ? 9 : 6);
  el.style.boxShadow = '0 0 ' + glow + 'px ' + hexA(ri.c1, 0.55) + ', 0 4px 14px -6px ' + hexA(ri.c1, 0.5);
  if (ri.cat === 'absolute') {
    el.classList.add('absolute-frame');
    el.style.background = 'conic-gradient(from 0deg,#ff5d8f,#ffbf4d,#4fcac4,#6c80f5,#ff5d8f)';
  } else {
    el.classList.remove('absolute-frame');
    el.style.background = 'linear-gradient(135deg,' + ri.c1 + ',' + ri.c2 + ')';
  }
}
function pfDisplayName() {
  if (!tgUser) return 'Игрок';
  const n = ((tgUser.first_name || '') + (tgUser.last_name ? ' ' + tgUser.last_name : '')).trim();
  return n || (tgUser.username ? '@' + tgUser.username : 'Игрок');
}
function setAvatar(el) {
  if (!el) return;
  if (tgUser && tgUser.photo_url) { el.style.backgroundImage = 'url("' + tgUser.photo_url + '")'; el.textContent = ''; }
  else { el.style.backgroundImage = ''; el.textContent = (tgUser && tgUser.first_name ? tgUser.first_name[0] : 'И').toUpperCase(); }
}

// окна профиля (экраны выбора соперника и режима)
let pfIndex = 0;
function pfRenderCard(card, idx) {
  const cur = rankInfo(getXP());
  const r = RANKS[idx];
  const ri = mkRI(idx, idx === cur.index ? cur.into : 0, r.need);
  const nameEl = card.querySelector('.pf-name'); if (nameEl) nameEl.textContent = pfDisplayName();
  setAvatar(card.querySelector('.pf-avatar'));
  styleFrame(card.querySelector('.pf-frame'), ri);
  const rk = card.querySelector('.pf-rank'); if (rk) { rk.textContent = ri.name; rk.style.color = ri.c1; }
  const fill = card.querySelector('.pf-xp-fill');
  if (fill) {
    const frac = (idx === cur.index) ? cur.frac : 1;   // соседние — полная полоса (виден цвет)
    fill.style.width = (frac * 100) + '%';
    fill.style.background = 'linear-gradient(90deg,' + ri.c1 + ',' + ri.c2 + ')';
  }
}
function pfUpdateScrollbar() {
  const total = RANKS.length;
  const wPct = Math.max(10, 100 / total);
  const pos = total > 1 ? pfIndex / (total - 1) : 0;
  document.querySelectorAll('.pf-scrollbar-thumb').forEach(th => {
    th.style.width = wPct + '%';
    th.style.left = (pos * (100 - wPct)) + '%';
  });
}
function pfGoto(idx) {
  const old = pfIndex;
  pfIndex = Math.max(0, Math.min(RANKS.length - 1, idx));
  if (pfIndex === old) return;
  const dir = pfIndex > old ? 1 : -1;
  const curIdx = rankInfo(getXP()).index;
  const targetOp = pfIndex > curIdx ? '0.62' : '1';   // будущие ранги чуть затемнены
  document.querySelectorAll('.pf-card').forEach(card => {
    card.style.transition = 'none';
    card.style.transform = 'translateX(' + (dir * 18) + 'px)';
    card.style.opacity = '0.3';
    pfRenderCard(card, pfIndex);
    requestAnimationFrame(() => {
      card.style.transition = 'transform 0.22s cubic-bezier(.25,.9,.3,1), opacity 0.22s ease';
      card.style.transform = 'translateX(0)';
      card.style.opacity = targetOp;
    });
  });
  pfUpdateScrollbar();
  try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch (e) {}
}
function pfBindSwipe() {
  document.querySelectorAll('.pf-window').forEach(win => {
    if (win._pfSwipe) return; win._pfSwipe = true;
    let sx = 0, sy = 0, active = false;
    win.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; active = true; }, { passive: true });
    win.addEventListener('touchend', e => {
      if (!active) return; active = false;
      const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) pfGoto(pfIndex + (dx < 0 ? 1 : -1));
    }, { passive: true });
  });
}
function renderProfile() {
  pfIndex = rankInfo(getXP()).index;
  document.querySelectorAll('.pf-card').forEach(card => {
    card.style.transition = 'none'; card.style.transform = 'translateX(0)'; card.style.opacity = '1';
    pfRenderCard(card, pfIndex);
  });
  pfBindSwipe();
  pfUpdateScrollbar();
}

// ---- оверлей конца раунда ----
function applyOverlayRank(ri) {
  styleFrame(document.getElementById('ov-frame'), ri);
  const rn = document.getElementById('ov-rank-name'); if (rn) { rn.textContent = ri.name; rn.style.color = '#fff'; }
  const fill = document.getElementById('ov-xp-fill');
  if (fill) { fill.style.width = (ri.frac * 100) + '%'; fill.style.background = 'linear-gradient(90deg,' + ri.c1 + ',' + ri.c2 + ')'; }
}
function rankParticles(ri, big) {
  const host = document.getElementById('ov-xp');
  if (!host) return;
  const palette = big
    ? ['#ff5d8f', '#ffbf4d', '#4fcac4', '#6c80f5', ri.c1, ri.c2]
    : [ri.c1, ri.c2, '#ffffff'];
  const n = big ? 28 : 15;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'rank-spark';
    const ang = Math.random() * Math.PI * 2;
    const dist = (big ? 95 : 60) + Math.random() * (big ? 95 : 55);
    s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
    s.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
    s.style.background = palette[i % palette.length];
    const sz = 6 + Math.random() * 6;
    s.style.width = sz + 'px'; s.style.height = sz + 'px';
    s.style.animationDuration = (0.85 + Math.random() * 0.7) + 's';
    host.appendChild(s);
    setTimeout(() => { if (s.parentNode) s.remove(); }, 1700);
  }
}
function popRankUp(ri, catChanged) {
  const ru = document.getElementById('ov-rankup');
  ru.textContent = catChanged ? ('Новая лига — ' + ri.catName + '!') : 'Повышение ранга!';
  ru.style.color = ri.c1;
  ru.classList.remove('show'); void ru.offsetWidth; ru.classList.add('show');
  const frame = document.getElementById('ov-frame');
  frame.classList.remove('flash'); void frame.offsetWidth; frame.classList.add('flash');
  rankParticles(ri, catChanged);
  if (catChanged) {
    const burst = document.getElementById('ov-cat-burst');
    burst.style.background = 'radial-gradient(circle,' + hexA(ri.c1, 0.5) + ', transparent 70%)';
    burst.classList.remove('go'); void burst.offsetWidth; burst.classList.add('go');
    try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success'); } catch (e) {}
  }
}

function animateXpBar(before, target, onDone) {
  const dur = Math.min(3600, 1300 + Math.abs(target - before) * 1.3);
  const start = performance.now();
  let lastIndex = rankInfo(before).index;
  let lastCat = rankInfo(before).cat;
  function frame(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const val = before + (target - before) * eased;
    const ri = rankInfo(val);
    if (ri.index > lastIndex) { popRankUp(ri, ri.cat !== lastCat); }
    lastIndex = ri.index; lastCat = ri.cat;
    applyOverlayRank(ri);
    if (t < 1) requestAnimationFrame(frame);
    else if (onDone) onDone();
  }
  requestAnimationFrame(frame);
}

function setRankVisuals(ri, withWidth) {
  styleFrame(document.getElementById('ov-frame'), ri);
  const rn = document.getElementById('ov-rank-name'); if (rn) { rn.textContent = ri.name; rn.style.color = '#fff'; }
  const fill = document.getElementById('ov-xp-fill');
  if (fill) {
    fill.style.background = 'linear-gradient(90deg,' + ri.c1 + ',' + ri.c2 + ')';
    if (withWidth) { fill.style.transition = 'none'; fill.style.width = (ri.frac * 100) + '%'; requestAnimationFrame(() => { fill.style.transition = ''; }); }
  }
}

// цветной налив: плюс → синяя линия идёт вперёд, за ней заливка; минус → заливка уходит назад, открывая красную
function animateXpBarColored(before, target, onDone) {
  const fill = document.getElementById('ov-xp-fill');
  const ghost = document.getElementById('ov-xp-ghost');
  const bRI = rankInfo(before), tRI = rankInfo(target);
  ghost.className = ''; ghost.style.transition = 'none'; ghost.style.opacity = '0'; ghost.style.width = (bRI.frac * 100) + '%';
  if (target === before) { if (onDone) onDone(); return; }
  if (bRI.index !== tRI.index) { animateXpBar(before, target, onDone); return; }
  setRankVisuals(tRI, false);
  const bf = bRI.frac * 100, tf = tRI.frac * 100;
  if (target > before) {
    void ghost.offsetWidth;
    ghost.classList.add('gain');
    ghost.style.opacity = '1';
    ghost.style.transition = 'width 0.6s cubic-bezier(.25,.9,.3,1)';
    fill.style.transition = 'width 0.95s cubic-bezier(.3,.9,.3,1) 0.22s';
    requestAnimationFrame(() => { ghost.style.width = tf + '%'; fill.style.width = tf + '%'; });
    setTimeout(() => { ghost.style.transition = 'opacity 0.45s ease'; ghost.style.opacity = '0'; if (onDone) onDone(); }, 1350);
  } else {
    ghost.classList.add('loss');
    ghost.style.opacity = '1';
    ghost.style.width = bf + '%';
    void ghost.offsetWidth;
    fill.style.transition = 'width 0.85s cubic-bezier(.3,.9,.3,1)';
    requestAnimationFrame(() => { fill.style.width = tf + '%'; });
    setTimeout(() => { ghost.style.transition = 'opacity 0.5s ease'; ghost.style.opacity = '0'; if (onDone) onDone(); }, 1150);
  }
}

function ovGainText(v) { return (v >= 0 ? '+' : '−') + Math.abs(v) + ' XP'; }

// единый экран результата: подсчёт (фрукты/блоки) → опыт за комбо → цветной бар
function showXpResult(win, count, kind, extra) {
  extra = extra || 0;
  const before = getXP();
  const base = win ? 0 : -100;
  const gained = base + count * 10 + extra;
  const target = Math.max(0, before + gained);
  setXP(target);

  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const ovxp = document.getElementById('ov-xp');
  const tallyN = document.getElementById('ov-tally-n');
  const gainEl = document.getElementById('ov-xp-gain');
  const fruitIcon = document.querySelector('#ov-tally .ov-fruit');
  title.innerHTML = '<span class="logo-text">' + (win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ') + '</span>';
  overlay.classList.toggle('lose', !win);
  overlay.classList.add('is-xp');
  overlay.classList.remove('settled', 'act-show');
  ovxp.classList.remove('show');
  document.getElementById('ov-rankup').classList.remove('show');
  document.getElementById('ov-cat-burst').classList.remove('go');
  document.getElementById('ov-frame').classList.remove('flash');
  document.getElementById('overlay-btn').textContent = 'Ещё раз';
  if (fruitIcon) { fruitIcon.classList.remove('combo'); fruitIcon.classList.toggle('block', kind === 'sea'); fruitIcon.style.display = (count > 0 ? '' : 'none'); }
  setRankVisuals(rankInfo(before), true);
  setAvatar(document.getElementById('ov-ava'));
  const ghost = document.getElementById('ov-xp-ghost');
  const fill = document.getElementById('ov-xp-fill');
  const beforeRI = rankInfo(before);
  ghost.className = ''; ghost.style.transition = 'none'; ghost.style.opacity = '0'; ghost.style.width = (beforeRI.frac * 100) + '%';
  tallyN.style.color = '';
  tallyN.textContent = count > 0 ? count : '';
  let running = 0;                          // накопитель: 0 → gained
  gainEl.classList.remove('show', 'minus');
  gainEl.textContent = ovGainText(running);
  overlay.classList.remove('hidden');

  const haptic = () => { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch (e) {} };
  // доля внутри ранга старта (зажим на границах, чтобы не прыгало)
  const fracFor = (xp) => { const ri = rankInfo(Math.max(0, xp)); return ri.index > beforeRI.index ? 1 : (ri.index < beforeRI.index ? 0 : ri.frac); };
  const gainLabel = () => { gainEl.textContent = ovGainText(Math.round(running)); gainEl.classList.toggle('minus', running < 0); };
  // живое обновление бара ПАРАЛЛЕЛЬНО с подсчётом
  const liveBar = () => {
    const xpNow = before + running;
    if (xpNow >= before) {
      // плюс: синяя линия растёт как индикатор начисления, заливка пока стоит
      ghost.classList.remove('loss'); ghost.classList.add('gain');
      ghost.style.opacity = '1'; ghost.style.transition = 'width 0.18s linear';
      ghost.style.width = (fracFor(xpNow) * 100) + '%';
    } else {
      // минус: заливка убывает параллельно, сзади красная на старте
      ghost.classList.remove('gain'); ghost.classList.add('loss');
      ghost.style.opacity = '1'; ghost.style.transition = 'opacity 0.2s ease';
      ghost.style.width = (beforeRI.frac * 100) + '%';
      fill.style.transition = 'width 0.18s linear';
      fill.style.width = (fracFor(xpNow) * 100) + '%';
    }
  };
  // финал: при плюсе заливка догоняет синий; при минусе докручиваем и гасим красный
  const finishBar = () => {
    gainEl.textContent = ovGainText(gained); gainEl.classList.toggle('minus', gained < 0);
    if (target >= before) {
      fill.style.transition = '';
      animateXpBar(before, target, () => {
        ghost.style.transition = 'opacity 0.5s ease'; ghost.style.opacity = '0';
        setTimeout(() => overlay.classList.add('act-show'), 250);
      });
    } else {
      fill.style.transition = 'width 0.3s ease';
      fill.style.width = (fracFor(target) * 100) + '%';
      setTimeout(() => {
        ghost.style.transition = 'opacity 0.55s ease'; ghost.style.opacity = '0';
        setTimeout(() => overlay.classList.add('act-show'), 250);
      }, 340);
    }
  };

  // налив к цели чистыми круглыми шагами (ровные числа), плавно и не слишком быстро
  const ramp = (target, onDone) => {
    const total = Math.abs(target - running);
    if (total < 1) { running = target; gainLabel(); liveBar(); onDone(); return; }
    const dir = target > running ? 1 : -1;
    const step = total <= 150 ? 10 : total <= 500 ? 20 : total <= 1500 ? 50 : 100;
    const steps = Math.ceil(total / step);
    const delay = Math.max(30, Math.min(95, Math.round(780 / steps)));
    let i = 0;
    const tick = () => {
      i++;
      running = (i >= steps) ? target : running + dir * step;
      if ((dir > 0 && running > target) || (dir < 0 && running < target)) running = target;
      gainLabel(); liveBar(); haptic();
      if (i >= steps) { onDone(); return; }
      setTimeout(tick, delay);
    };
    tick();
  };
  const lossPhase = (next) => {                     // поражение: один спуск к нетто (прогрессивно)
    if (fruitIcon) fruitIcon.style.display = 'none';
    tallyN.textContent = '';
    ramp(gained, next);
  };
  const blockPhase = (next) => {                    // блоки/фрукты (победа) — прогрессивная задержка
    if (count <= 0) { next(); return; }
    let left = count;
    const bdelay = Math.max(35, Math.min(150, Math.round(720 / count)));
    const bstep = () => {
      if (left <= 0) { next(); return; }
      left--; running += 10; tallyN.textContent = left;
      gainLabel(); liveBar(); haptic();
      setTimeout(bstep, bdelay);
    };
    bstep();
  };
  const comboPhase = (next) => {                    // опыт за комбо (прогрессивно)
    if (extra <= 0) { next(); return; }
    if (fruitIcon) fruitIcon.style.display = 'none';
    tallyN.textContent = 'Комбо'; tallyN.style.color = '#ffd24a';
    setTimeout(() => ramp(running + extra, next), 400);
  };

  setTimeout(() => overlay.classList.add('settled'), 1200);
  setTimeout(() => { ovxp.classList.add('show'); gainEl.classList.add('show'); }, 1650);
  setTimeout(() => {
    if (base < 0) lossPhase(() => finishBar());                 // поражение — единый итог
    else blockPhase(() => comboPhase(() => finishBar()));       // победа — блоки, затем комбо
  }, 2150);
}

renderProfile();

// ===================== РЕЖИМ «ЗМЕЙКА» =====================
const SNAKE_N = 11;
const SNAKE_TICK = 170;
const SNAKE_LIVES = 3;
const SVGNS = 'http://www.w3.org/2000/svg';
// базовые цвета (живая змейка) — из палитры морского боя
const SNAKE_BASE = {
  me: { sc: '#4fcac4', sch: '#2bb3ac', edge: '#2a8f8a' },
  ai: { sc: '#ffb259', sch: '#e8902f', edge: '#b8650f' }
};
// состояния урона: 1-я смерть → «убитый» (--sunk), 2-я → «подбитый» (--hit), финал → серый (--miss)
const SNAKE_DMG = { 2: 'var(--sunk)', 1: 'var(--hit)', 0: 'var(--miss)' };
let snakeState = null;

function svgEl(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// прямоугольник со скруглением по углам (tl,tr,br,bl)
function roundRectPath(x, y, w, h, tl, tr, br, bl) {
  return 'M' + (x + tl) + ',' + y +
    ' H' + (x + w - tr) + ' A' + tr + ',' + tr + ' 0 0 1 ' + (x + w) + ',' + (y + tr) +
    ' V' + (y + h - br) + ' A' + br + ',' + br + ' 0 0 1 ' + (x + w - br) + ',' + (y + h) +
    ' H' + (x + bl) + ' A' + bl + ',' + bl + ' 0 0 1 ' + x + ',' + (y + h - bl) +
    ' V' + (y + tl) + ' A' + tl + ',' + tl + ' 0 0 1 ' + (x + tl) + ',' + y + ' Z';
}

function buildSnakeGrid(id, who) {
  const g = document.getElementById(id);
  if (!g) return;
  g.innerHTML = '';
  const svg = svgEl('svg', { class: 'snake-svg', viewBox: '0 0 11 11', preserveAspectRatio: 'xMidYMid meet' });
  const c = SNAKE_BASE[who];
  svg.style.setProperty('--sc', c.sc);
  svg.style.setProperty('--sc-h', c.sch);
  svg.style.setProperty('--sc-edge', c.edge);
  const bg = svgEl('g', {});
  for (let r = 0; r < SNAKE_N; r++)
    for (let col = 0; col < SNAKE_N; col++)
      bg.appendChild(svgEl('rect', { class: 'snk-bgc', x: col + 0.06, y: r + 0.06, width: 0.88, height: 0.88, rx: 0.18 }));
  const gFruit = svgEl('g', {});
  const gBody = svgEl('g', {});
  const gMarks = svgEl('g', {});
  svg.appendChild(bg); svg.appendChild(gFruit); svg.appendChild(gBody); svg.appendChild(gMarks);
  g.appendChild(svg);
  const dimEl = document.createElement('div'); dimEl.className = 'snake-dim';
  const num = document.createElement('span'); num.className = 'snake-num';
  dimEl.appendChild(num); g.appendChild(dimEl);
  return { svg, gFruit, gBody, gMarks, dim: dimEl, num };
}

function snakeMakeSide(refs, who) {
  return {
    who, base: SNAKE_BASE[who],
    svg: refs.svg, gFruit: refs.gFruit, gBody: refs.gBody, gMarks: refs.gMarks,
    dim: refs.dim, num: refs.num,
    cells: [], dir: { r: 0, c: 1 }, nextDir: { r: 0, c: 1 },
    fruit: null, lives: SNAKE_LIVES, state: 'alive', fruitsEaten: 0,
    comboN: 0, comboXP: 0, lastEat: 0, _eaten: null,
    hungerStart: 0, lastShrink: 0, hitEyes: false
  };
}

function snakeStartCells(len) {
  const mid = Math.floor(SNAKE_N / 2);
  len = Math.max(3, Math.min(len, SNAKE_N - 1));
  const cells = [];
  // прямая горизонтальная змейка, голова справа (движется вправо)
  const headC = Math.min(mid + Math.floor(len / 2), SNAKE_N - 1);
  for (let i = 0; i < len; i++) cells.push({ r: mid, c: Math.max(0, headC - i) });
  return cells;
}

function snakeSpawnFruit(side) {
  const occ = new Set(side.cells.map(p => p.r + '_' + p.c));
  const free = [];
  for (let r = 0; r < SNAKE_N; r++)
    for (let c = 0; c < SNAKE_N; c++)
      if (!occ.has(r + '_' + c)) free.push({ r, c });
  side.fruit = free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

function snakeDrawFruit(side, burst) {
  side.gFruit.innerHTML = '';
  if (burst) {
    side.gFruit.appendChild(svgEl('circle', { class: 'snk-fruit-eat', cx: burst.c + 0.5, cy: burst.r + 0.5, r: 0.3 }));
  }
  if (side.fruit) {
    side.gFruit.appendChild(svgEl('circle', { class: 'snk-fruit-dot appear', cx: side.fruit.c + 0.5, cy: side.fruit.r + 0.5, r: 0.3 }));
  }
}

function snakeNow() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }
function snakeLerpCells(side, t) {
  return side.cells.map((cur, i) => {
    const from = (side.fromCells && i < side.fromCells.length) ? side.fromCells[i] : cur;
    return { x: (from.c + (cur.c - from.c) * t) + 0.5, y: (from.r + (cur.r - from.r) * t) + 0.5 };
  });
}
function snakeHeadPath(cx, cy, size, d, R, nn) {
  const x = cx - size / 2, y = cy - size / 2;
  let tl = nn, tr = nn, br = nn, bl = nn;
  if (d.c === 1) { tr = R; br = R; }
  else if (d.c === -1) { tl = R; bl = R; }
  else if (d.r === 1) { bl = R; br = R; }
  else { tl = R; tr = R; }
  return roundRectPath(x, y, size, size, tl, tr, br, bl);
}
function snakeEyesGroup(side, cx, cy, d) {
  // единый «канонический» макет глаз (как при движении вправо), повёрнутый на угол головы —
  // значит в любом направлении глаза выглядят одинаково
  let fa = 0;
  if (d.c === 1) fa = 0; else if (d.r === 1) fa = 90; else if (d.c === -1) fa = 180; else fa = -90;
  const g = svgEl('g', { transform: 'rotate(' + fa + ' ' + cx + ' ' + cy + ')' });
  const eyes = [{ x: cx + 0.16, y: cy - 0.17, tilt: 18 }, { x: cx + 0.16, y: cy + 0.17, tilt: -18 }];
  if (side.hitEyes) {
    eyes.forEach(e => {
      const s = 0.1, xg = svgEl('g', { class: 'snk-eye-x' });
      xg.appendChild(svgEl('line', { x1: e.x - s, y1: e.y - s, x2: e.x + s, y2: e.y + s }));
      xg.appendChild(svgEl('line', { x1: e.x - s, y1: e.y + s, x2: e.x + s, y2: e.y - s }));
      g.appendChild(xg);
    });
  } else {
    const ew = 0.1, eh = 0.26;
    eyes.forEach(e => g.appendChild(svgEl('rect', { class: 'snk-eye', x: e.x - ew / 2, y: e.y - eh / 2, width: ew, height: eh, rx: 0.05, transform: 'rotate(' + e.tilt + ' ' + e.x + ' ' + e.y + ')' })));
  }
  return g;
}
function snakePaint(side, t) {
  if (t == null) t = 1;
  const pts = snakeLerpCells(side, t);
  const n = pts.length;
  side.gBody.innerHTML = '';
  side._waveEls = [];
  const edges = [], fills = [];
  const W = 0.7, EW = 0.9;
  const d = side.dir, h = pts[0];
  // обводка тела единой линией (равномерный контур)
  if (n - 1 >= 2) {
    const list = pts.slice(0, n - 1).map(p => p.x.toFixed(3) + ',' + p.y.toFixed(3)).join(' ');
    edges.push(svgEl('polyline', { class: 'snk-edge', points: list, fill: 'none', 'stroke-width': EW }));
  }
  // голова (сегмент 0 — для волны цвета)
  edges.push(svgEl('path', { class: 'snk-edge', d: snakeHeadPath(h.x, h.y, 0.98, d, 0.49, 0.24) }));
  const headFill = svgEl('path', { class: 'snk-head', d: snakeHeadPath(h.x, h.y, 0.84, d, 0.42, 0.18) });
  fills.push(headFill); side._waveEls.push(headFill);
  // звенья тела
  for (let i = 0; i < n - 2; i++) {
    const a = pts[i], b = pts[i + 1];
    const lk = svgEl('line', { class: 'snk-link', x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-width': W });
    fills.push(lk); side._waveEls.push(lk);
  }
  // хвост-«карандаш» (последний сегмент), по направлению последнего звена
  if (n >= 2) {
    const tip = pts[n - 1], nb = pts[n - 2];
    let dx = tip.x - nb.x, dy = tip.y - nb.y; const ln = Math.hypot(dx, dy) || 1; dx /= ln; dy /= ln;
    const px = -dy, py = dx;
    const mkTail = (hw, ext) => {
      const b1 = [nb.x + px * hw, nb.y + py * hw], b2 = [nb.x - px * hw, nb.y - py * hw], tp = [tip.x + dx * ext, tip.y + dy * ext];
      return [b1, b2, tp].map(v => v[0].toFixed(3) + ',' + v[1].toFixed(3)).join(' ');
    };
    edges.push(svgEl('polygon', { class: 'snk-edge', points: mkTail(0.40, 0.20) }));
    const tailFill = svgEl('polygon', { class: 'snk-tail', points: mkTail(0.33, 0.12) });
    fills.push(tailFill); side._waveEls.push(tailFill);
  }
  // глаза поверх
  fills.push(snakeEyesGroup(side, h.x, h.y, d));
  edges.forEach(e => side.gBody.appendChild(e));
  fills.forEach(e => side.gBody.appendChild(e));
}
function snakeWaveColor(side, col) {
  // волна цвета от блока столкновения (голова, i=0) к хвосту
  const step = 70;
  (side._waveEls || []).forEach((el, i) => {
    el.style.transitionDelay = (i * step) + 'ms';
    if (el.tagName && el.tagName.toLowerCase() === 'line') el.style.stroke = col;
    else el.style.fill = col;
  });
}
function snakeRenderLoop() {
  if (!snakeState) return;
  const now = snakeNow();
  [snakeState.me, snakeState.ai].forEach(side => {
    if (side && side.state === 'alive' && side.gBody) {
      const t = (snakeState.running && side.tickAt) ? Math.min(1, (now - side.tickAt) / SNAKE_TICK) : 1;
      snakePaint(side, t);
    }
  });
  snakeState._raf = requestAnimationFrame(snakeRenderLoop);
}

function snakeAdvance(side, dir) {
  const head = side.cells[0];
  const nr = head.r + dir.r, nc = head.c + dir.c;
  if (nr < 0 || nr >= SNAKE_N || nc < 0 || nc >= SNAKE_N) return 'crash';
  const willEat = side.fruit && nr === side.fruit.r && nc === side.fruit.c;
  const body = willEat ? side.cells : side.cells.slice(0, side.cells.length - 1);
  for (const p of body) if (p.r === nr && p.c === nc) return 'crash';
  side.cells.unshift({ r: nr, c: nc });
  if (willEat) { side._eaten = { r: nr, c: nc }; snakeSpawnFruit(side); return 'eat'; }
  side.cells.pop();
  return 'ok';
}

function aiPickDir(side) {
  const head = side.cells[0];
  const all = [{ r: 0, c: 1 }, { r: 0, c: -1 }, { r: 1, c: 0 }, { r: -1, c: 0 }];
  const opts = all.filter(d => !(d.r === -side.dir.r && d.c === -side.dir.c));
  const occ = new Set(side.cells.slice(0, side.cells.length - 1).map(p => p.r + '_' + p.c));
  const safe = opts.filter(d => {
    const nr = head.r + d.r, nc = head.c + d.c;
    return nr >= 0 && nr < SNAKE_N && nc >= 0 && nc < SNAKE_N && !occ.has(nr + '_' + nc);
  });
  const pool = safe.length ? safe : opts;
  if (side.fruit) {
    pool.sort((a, b) => {
      const da = Math.abs(head.r + a.r - side.fruit.r) + Math.abs(head.c + a.c - side.fruit.c);
      const db = Math.abs(head.r + b.r - side.fruit.r) + Math.abs(head.c + b.c - side.fruit.c);
      return da - db;
    });
  }
  return pool[0] || side.dir;
}

function snakeRenderLives() {
  if (!snakeState) return;
  const draw = (id, lives) => {
    const el = document.getElementById(id); if (!el) return;
    let h = '';
    for (let i = 0; i < SNAKE_LIVES; i++) h += '<i class="' + (i < lives ? '' : 'lost') + '"></i>';
    el.innerHTML = h;
  };
  draw('snake-ai-hearts', snakeState.ai.lives);
  draw('snake-me-hearts', snakeState.me.lives);
}

function snakeSetColor(side, sc, sch) {
  side.svg.style.setProperty('--sc', sc);
  side.svg.style.setProperty('--sc-h', sch || sc);
  side.svg.style.setProperty('--sc-edge', 'color-mix(in srgb, ' + sc + ', #000 32%)');
}

function snakeCountdownOn(side, onDone) {
  side.dim.classList.add('show');
  let n = 3;
  const setN = v => { side.num.textContent = v; side.num.style.animation = 'none'; void side.num.offsetWidth; side.num.style.animation = ''; };
  setN(n);
  const iv = setInterval(() => {
    n--;
    if (n <= 0) { clearInterval(iv); side.dim.classList.remove('show'); side.num.textContent = ''; onDone(); }
    else setN(n);
  }, 1000);
}

function snakeDeath(side) {
  side.state = 'dying';
  side.lives--;
  side.hitEyes = true;        // глаза-крестики сразу при столкновении
  side.fromCells = null;
  snakePaint(side, 1);        // зафиксировали кадр + собрали сегменты для волны
  snakeRenderLives();
  try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred(side.who === 'me' ? 'warning' : 'success'); } catch (e) {}

  if (side.lives <= 0) {
    // ФИНАЛ: волна в серый + точки
    snakeWaveColor(side, 'var(--miss)');
    snakeSetColor(side, 'var(--miss)', 'var(--miss)');
    side.gMarks.innerHTML = '';
    side.cells.forEach((p, idx) => {
      const m = svgEl('rect', { class: 'snk-mark', x: p.c + 0.33, y: p.r + 0.33, width: 0.34, height: 0.34, rx: 0.17 });
      m.style.animationDelay = (0.3 + idx * 0.07).toFixed(2) + 's';
      side.gMarks.appendChild(m);
    });
    const dur = 800 + side.cells.length * 110;
    setTimeout(() => { side.state = 'dead'; snakeCheckOver(); }, dur);
    return;
  }

  // 1-я смерть → синий (убитый), 2-я → красный (подбитый); волной от головы
  const col = SNAKE_DMG[side.lives];
  snakeWaveColor(side, col);
  snakeSetColor(side, col, col);
  setTimeout(() => {
    snakeCountdownOn(side, () => {
      side.cells = snakeStartCells(3);  // после смерти змейка снова маленькая
      side.dir = { r: 0, c: 1 }; side.nextDir = { r: 0, c: 1 };
      side.fromCells = null; side.tickAt = 0;
      side.hitEyes = false;
      side.hungerStart = snakeNow();
      side.lastShrink = 0;
      snakeSpawnFruit(side);
      snakePaint(side, 1);
      snakeDrawFruit(side);
      side.state = 'alive';
    });
  }, 700);
}

function snakeCheckOver() {
  if (!snakeState || snakeState.ended) return;
  const me = snakeState.me, ai = snakeState.ai;
  if (me.state === 'dead' || ai.state === 'dead') {
    snakeState.ended = true;
    snakeStop();
    const playerWon = me.state !== 'dead' && ai.state === 'dead';
    setTimeout(() => snakeEnd(playerWon, me.fruitsEaten, me.comboXP), 850);
  }
}

let snakeComboTimer = null, snakeComboDimTimer = null;
function snakeComboReset() {
  clearTimeout(snakeComboTimer); clearTimeout(snakeComboDimTimer);
  if (snakeState) snakeState.me.comboN = 0;
  hideComboTag(document.getElementById('snake-combo-tag'));
}
// игрок съел фрукт: комбо, если успел в 3с после предыдущего
function snakeOnEat(side) {
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (side.comboN >= 1 && (now - side.lastEat) <= 3000) side.comboN++;
  else side.comboN = 1;
  side.lastEat = now;
  if (side.comboN >= 2) {
    side.comboXP += Math.min(40, 10 * (side.comboN - 1));   // x2=10, x3=20, … потолок 40
    renderCombo(document.getElementById('snake-combo-tag'), side.comboN);
    try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium'); } catch (e) {}
  }
  // тускнеет ближе к концу окна, сбрасывается через 3с
  clearTimeout(snakeComboTimer); clearTimeout(snakeComboDimTimer);
  const tag = document.getElementById('snake-combo-tag');
  snakeComboDimTimer = setTimeout(() => { if (tag) tag.classList.add('dim'); }, 1900);
  snakeComboTimer = setTimeout(() => { side.comboN = 0; hideComboTag(tag); }, 3000);
}

function updateHunger(me) {
  const el = document.getElementById('snake-hunger');
  const n = document.getElementById('snake-hunger-n');
  if (!el || !n) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const since = now - (me.hungerStart || now);
  if (me.state === 'alive' && since >= 3000) {
    const left = Math.max(0, 5 - Math.floor(since / 1000));   // обратный отсчёт до ужимания
    if (n.textContent !== String(left)) {
      n.textContent = left;
      n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
    }
    el.classList.add('show');
    el.classList.toggle('urgent', since >= 5000);
  } else {
    el.classList.remove('show', 'urgent');
  }
}

function snakeTick() {
  if (!snakeState || !snakeState.running) return;
  const now = snakeNow();
  [snakeState.me, snakeState.ai].forEach(side => {
    if (side.state !== 'alive') return;
    side.fromCells = side.cells.map(p => ({ r: p.r, c: p.c }));   // откуда плавно едем
    side.dir = (side.who === 'me') ? side.nextDir : aiPickDir(side);
    const res = snakeAdvance(side, side.dir);
    if (res === 'crash') { snakeDeath(side); return; }
    let ate = false;
    if (res === 'eat') {
      ate = true;
      side.hungerStart = now; side.lastShrink = 0;   // поел — голод сброшен
      if (side.who === 'me') { side.fruitsEaten++; snakeOnEat(side); }
      snakeDrawFruit(side, side._eaten);     // бёрст на месте съедения + новый фрукт с появлением
    }
    // голод: после 5с без еды — ужимание на 1 клетку/сек; на минимуме — смерть
    if (!ate && side.hungerStart && (now - side.hungerStart) >= 5000 && (now - side.lastShrink) >= 1000) {
      side.lastShrink = now;
      if (side.cells.length > 2) side.cells.pop();
      else { snakeDeath(side); return; }
    }
    side.tickAt = now;   // отрисовку с интерполяцией ведёт snakeRenderLoop
  });
  updateHunger(snakeState.me);
}

function snakeEnd(win, fruits, comboXP) {
  snakeComboReset();
  { const el = document.getElementById('snake-hunger'); if (el) el.classList.remove('show', 'urgent'); }
  document.getElementById('snake-screen').classList.add('hidden');
  setTimeout(() => { showXpResult(win, fruits, 'snake', Math.round(comboXP || 0)); launchConfetti(win); }, 90);
}

function snakeStop() {
  if (snakeState) { snakeState.running = false; clearInterval(snakeState.interval); if (snakeState._raf) cancelAnimationFrame(snakeState._raf); }
}

function startSnake() {
  currentGame = 'snake';
  if (snakeState && snakeState._raf) cancelAnimationFrame(snakeState._raf);
  setGameUIHidden(true);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('opp-select').classList.add('hidden');
  const meRefs = buildSnakeGrid('snake-me', 'me');
  const aiRefs = buildSnakeGrid('snake-ai', 'ai');
  const me = snakeMakeSide(meRefs, 'me');
  const ai = snakeMakeSide(aiRefs, 'ai');
  snakeState = { running: false, ended: false, interval: null, me, ai };
  snakeComboReset();
  { const el = document.getElementById('snake-hunger'); if (el) el.classList.remove('show', 'urgent'); }
  [me, ai].forEach(side => {
    side.cells = snakeStartCells(3);
    side.fromCells = null; side.tickAt = 0;
    snakeSpawnFruit(side);
    snakePaint(side, 1);
    snakeDrawFruit(side);
  });
  snakeRenderLives();
  snakeState._raf = requestAnimationFrame(snakeRenderLoop);
  document.getElementById('snake-screen').classList.remove('hidden');
  me.dim.classList.add('show'); ai.dim.classList.add('show');
  let n = 3;
  const setNum = v => {
    me.num.textContent = v; ai.num.textContent = v;
    [me.num, ai.num].forEach(el => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
  };
  setNum(n);
  const iv = setInterval(() => {
    n--;
    if (n <= 0) {
      clearInterval(iv);
      me.dim.classList.remove('show'); ai.dim.classList.remove('show');
      me.num.textContent = ''; ai.num.textContent = '';
      const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      me.hungerStart = t0; ai.hungerStart = t0; me.lastShrink = 0; ai.lastShrink = 0;
      snakeState.running = true;
      snakeState.interval = setInterval(snakeTick, SNAKE_TICK);
    } else setNum(n);
  }, 1000);
}

function snakeSetDir(r, c) {
  if (!snakeState || !snakeState.running) return;
  const me = snakeState.me;
  if (me.state !== 'alive') return;
  if (r === -me.dir.r && c === -me.dir.c) return;
  me.nextDir = { r, c };
}

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp') snakeSetDir(-1, 0);
  else if (e.key === 'ArrowDown') snakeSetDir(1, 0);
  else if (e.key === 'ArrowLeft') snakeSetDir(0, -1);
  else if (e.key === 'ArrowRight') snakeSetDir(0, 1);
});
(function () {
  const el = document.getElementById('snake-center');
  if (!el) return;
  let sx = 0, sy = 0, on = false;
  const begin = (x, y) => { sx = x; sy = y; on = true; };
  const finish = (x, y) => {
    if (!on) return; on = false;
    const dx = x - sx, dy = y - sy;
    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
    if (Math.abs(dx) > Math.abs(dy)) snakeSetDir(0, dx > 0 ? 1 : -1);
    else snakeSetDir(dy > 0 ? 1 : -1, 0);
  };
  el.addEventListener('touchstart', e => { const t = e.touches[0]; begin(t.clientX, t.clientY); }, { passive: true });
  el.addEventListener('touchend', e => { const t = e.changedTouches[0]; finish(t.clientX, t.clientY); }, { passive: true });
  el.addEventListener('mousedown', e => begin(e.clientX, e.clientY));
  el.addEventListener('mouseup', e => finish(e.clientX, e.clientY));
})();

document.getElementById('snake-back-x').addEventListener('click', () => {
  snakeStop();
  document.getElementById('snake-screen').classList.add('hidden');
  document.getElementById('opp-select').classList.remove('hidden');
});