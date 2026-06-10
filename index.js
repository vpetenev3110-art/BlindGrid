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
        if (cube) cube.style.transform = 'translateX(0) rotate(8deg) scale(1)';
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
  arsBuy = null; arsDefense = null; arsShopPhase = false;
  { const dp = document.getElementById('dock-pieces'); if (dp) dp._snap = true; }   // первый рендер дока без анимации
  state = null;   // старый бой мёртв: его таймеры (aiTurn и пр.) дальше не действуют
  document.querySelectorAll('.battle-cd, .board-cd, .skip-dim').forEach(e => e.remove());
  const dk = document.getElementById('dock'); if (dk) dk.classList.remove('shop-mode');
  const pb = document.getElementById('place-board'); if (pb) pb.classList.remove('def-mode');
  setTimeout(() => setPlayBtnLabel('Далее'), 0);
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
  // плавная анимация высоты дока (но при входе на экран — мгновенно, без «расширения»)
  dock.style.transition = 'none';
  dock.style.height = 'auto';
  const newH = dock.getBoundingClientRect().height;
  if (dock._snap) {
    dock._snap = false;
    dock.style.height = newH + 'px';
    requestAnimationFrame(() => { dock.style.transition = ''; });
  } else {
    dock.style.height = oldH + 'px';
    requestAnimationFrame(() => {
      dock.style.transition = '';
      dock.style.height = newH + 'px';
    });
  }

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
  if (arsShopPhase) return;   // во время расстановки арсенала корабли заблокированы
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

// отсчёт перед боем: 3-2-1 на каждом поле; стрелка крутится и случайно выбирает, кто ходит первым
function battleCountdown(done) {
  const dims = [];
  ['battle-my-board', 'enemy-board'].forEach(bid => {
    const host = fxLayer(bid);
    if (!host) return;
    const d = document.createElement('div');
    d.className = 'board-cd';
    const num = document.createElement('div');
    num.className = 'board-cd-n';
    d.appendChild(num);
    host.appendChild(d);
    requestAnimationFrame(() => d.classList.add('on'));
    dims.push({ d, num });
  });
  // стрелка мечется между сторонами, замедляясь, и останавливается на случайной
  const first = Math.random() < 0.5 ? 'player' : 'enemy';
  const flips = [180, 330, 480, 650, 850, 1100, 1450];
  flips.forEach((t, i) => setTimeout(() => {
    if (!state) return;
    setTurnArrow(i % 2 === 0 ? 'enemy' : 'player');
  }, t));
  setTimeout(() => { if (state) setTurnArrow(first); }, 1850);
  const seq = ['3', '2', '1'];
  let i = 0;
  const show = () => {
    dims.forEach(o => {
      o.num.textContent = seq[i];
      o.num.style.transition = 'none';
      o.num.style.opacity = '0';
      o.num.style.transform = 'scale(1.55)';
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      dims.forEach(o => {
        o.num.style.transition = 'opacity 0.16s ease, transform 0.48s cubic-bezier(.2,.9,.3,1)';
        o.num.style.opacity = '1';
        o.num.style.transform = 'scale(1)';
      });
    }));
    i++;
    if (i < seq.length) setTimeout(show, 700);
    else setTimeout(() => {
      dims.forEach(o => o.d.classList.remove('on'));
      setTimeout(() => { dims.forEach(o => o.d.remove()); done(first); }, 330);
    }, 640);
  };
  show();
}
function startBattle() {
  const playerShips = placement.pieces.map(p => ({ id: p.id, len: p.len, cells: p.cells, hits: 0, sunk: false }));
  const playerBoard = freshBoard();
  playerShips.forEach(s => s.cells.forEach(({ r, c }) => playerBoard[r][c].shipId = s.id));
  const enemy = placeFleetAuto();
  state = { player: { board: playerBoard, ships: playerShips }, enemy, turn: 'player', over: false, aiQueue: [], aiHitsOnShip: [], combo: 0, missStreak: 0, comboXP: 0,
    ars: null, armed: null, skipPlayer: false, skipEnemy: false, aiKnown: [], aiMoves: 0 };
  if (arsBuy && arsDefense) {   // арсенал в обоих режимах
    state.ars = {
      player: {
        shields: arsDefense.shields.map(rTop => ({ rTop, used: false })),
        mines: arsDefense.mines.map(m => ({ r: m.r, c: m.c, hit: false })),
        radar: arsBuy.radar, big: arsBuy.big, line: arsBuy.line
      },
      enemy: arsAiAutoDefense(arsBuy)
    };
  }
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
  if (state.ars) { arsRenderMyDefense(); arsRenderPanel(); }
  else { document.getElementById('ars-panel').classList.add('hidden'); document.getElementById('ars-hint').classList.add('hidden'); }
  turnAngle = 0; turnSide = null; turnLastFlip = 0;   // сброс инерции стрелки
  setTurnArrow('player');
  state.cd = true;                      // отсчёт: ввод заблокирован
  battleCountdown(first => {
    if (!state) return;
    state.cd = false;
    state.turn = first;
    if (first === 'enemy') setTimeout(() => { if (state && !state.over) aiTurn(); }, 550);
  });
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
    if (!b.querySelector('.fx-layer')) {
      const f = document.createElement('div'); f.className = 'fx-layer'; b.appendChild(f);
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

// один выстрел по полю ИИ (без передачи хода); 'hit' | 'miss' | 'mine' | 'repeat'
function shootEnemyCell(r, c) {
  const cell = state.enemy.board[r][c];
  if (cell.shot) return 'repeat';
  cell.shot = true;
  const el = getCellEl('enemy-board', r, c);
  spawnRipple(el, 'blue');
  if (cell.shipId !== null) {
    const ship = state.enemy.ships[cell.shipId];
    ship.hits++;
    if (el) { el.classList.add('hit'); el.classList.remove('radar-ship', 'radar-dot'); }
    state.combo = (state.combo || 0) + 1;
    state.missStreak = 0;
    if (state.combo >= 2) {
      const cg = (lastMode === 'classic')
        ? Math.min(30, 5 * (state.combo - 1))
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
    return 'hit';
  }
  // мина противника: взрыв — пропускаешь ход
  const mine = arsGetMineAt(state.ars && state.ars.enemy, r, c);
  if (mine) {
    mine.hit = true;
    if (el) { el.classList.add('mine-boom'); el.classList.remove('radar-ship', 'radar-dot'); }
    spawnRipple(el, 'red');
    spawnMineBlast('enemy-board', r, c);
    try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error'); } catch (e) {}
    return 'mine';
  }
  if (el) { el.classList.add('miss'); el.classList.remove('radar-ship', 'radar-dot'); }
  state.missStreak = (state.missStreak || 0) + 1;
  if (state.missStreak >= 2) { state.combo = 0; hideCombo(); }
  else if (state.combo >= 2) document.getElementById('combo-tag').classList.add('dim');
  return 'miss';
}
function onEnemyCellClick(r, c) {
  if (!state || state.over || state.cd || state.turn !== 'player') return;
  if (state._wfire && Date.now() - state._wfire < 420) return;   // клик-эхо после тач-выстрела
  if (state.armed) { state._wfire = Date.now(); arsPlayerUse(r, c); return; }   // выбран арсенал — применяем
  if (state.enemy.board[r][c].shot) return;
  const res = shootEnemyCell(r, c);
  if (res === 'hit' || res === 'repeat') return;   // попал — ходи снова
  if (res === 'mine') { state.skipPlayer = true; skipDimOn('enemy-board'); }   // подорвался на поле противника — затемнение там до пропуска
  passTurnToEnemy();
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

// один выстрел ИИ по моему полю (без передачи хода); 'hit' | 'miss' | 'mine' | 'end' | 'repeat'
function aiShootPlayerCell(r, c) {
  const cell = state.player.board[r][c];
  if (cell.shot) return 'repeat';
  cell.shot = true;
  const el = getCellEl('battle-my-board', r, c);
  spawnRipple(el, 'red');
  if (cell.shipId !== null) {
    const ship = state.player.ships[cell.shipId];
    ship.hits++;
    if (el) el.classList.add('hit');
    state.aiHitsOnShip.push({ r, c });
    enqueueAINeighbors({ r, c });
    if (ship.hits >= ship.len) {
      ship.sunk = true;
      setTimeout(() => {
        sinkShipSmooth('battle-my-board', state.player, ship);
        updateFleetFills();
      }, 450);
      state.aiQueue = []; state.aiHitsOnShip = [];
      if (allSunk(state.player)) { setTimeout(() => endGame('enemy'), 600); return 'end'; }
    }
    return 'hit';
  }
  // моя мина: ИИ подорвался — пропустит ход
  const mine = arsGetMineAt(state.ars && state.ars.player, r, c);
  if (mine) {
    mine.hit = true;
    if (el) el.classList.add('mine-boom');
    spawnRipple(el, 'red');
    spawnMineBlast('battle-my-board', r, c);
    arsRenderMyDefense();
    try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success'); } catch (e) {}
    return 'mine';
  }
  if (el) el.classList.add('miss');
  return 'miss';
}
function aiTurn() {
  if (!state || state.over || state.turn !== 'enemy') return;
  if (state.ars && aiTryArsenal()) return;   // ИИ может применить арсенал
  const target = pickAITarget();
  if (!target) { passTurnToPlayer(); return; }
  const res = aiShootPlayerCell(target.r, target.c);
  if (res === 'end') return;
  if (res === 'hit') { setTimeout(aiTurn, 950); return; }
  if (res === 'mine') { state.skipEnemy = true; skipDimOn('battle-my-board'); }   // ИИ подорвался на твоём поле — до его пропуска
  passTurnToPlayer();
}

function pickAITarget() {
  while (state.aiQueue.length > 0) {
    const t = state.aiQueue.shift();
    if (validAITarget(t.r, t.c)) return t;
  }
  // разведанные радаром клетки — в приоритете
  while (state.aiKnown && state.aiKnown.length > 0) {
    const t = state.aiKnown.shift();
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

// ===================== АРСЕНАЛ (только классика) =====================
// Покупка за XP после расстановки; у ИИ — ровно столько же. Щиты и мины — на своём поле,
// радар/бомбы — кнопки справа от верхнего поля в бою.
const ARS_DEF = {
  shield: { name: 'Защита',        price: 30, max: 3, ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L19 6 V11 C19 16 16 19.5 12 21 C8 19.5 5 16 5 11 V6 Z"/></svg>' },
  radar:  { name: 'Радар',         price: 80, max: 1, ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/><path d="M12 12 L18 6"/></svg>' },
  big:    { name: 'Большая бомба', price: 45, max: 2, ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="14" r="6.5"/><path d="M14.5 8.5 L17 6 M17 6 L15.6 4.6 M17 6 L18.4 7.4 M19.5 3 l0.01 0 M21 6 l0.01 0"/></svg>' },
  line:   { name: 'Бомбы по линии',price: 40, max: 2, ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>' },
  mine:   { name: 'Мина',          price: 15, max: 5, ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 4 V6.5 M12 17.5 V20 M4 12 H6.5 M17.5 12 H20 M6.6 6.6 L8.2 8.2 M15.8 15.8 L17.4 17.4 M17.4 6.6 L15.8 8.2 M8.2 15.8 L6.6 17.4"/></svg>' }
};
const ARS_ORDER = ['shield', 'radar', 'big', 'line', 'mine'];
// быстрый режим: всё вдвое меньше (в меньшую сторону), без радара
const ARS_DEF_FAST = {
  shield: { price: 15, max: 1 },
  big: { price: 22, max: 1 },
  line: { price: 20, max: 1 },
  mine: { price: 7, max: 2 }
};
function ARSD(k) {
  const d = ARS_DEF[k];
  if (lastMode !== 'fast') return d;
  const f = ARS_DEF_FAST[k];
  return f ? Object.assign({}, d, f) : d;
}
function ARSO() { return lastMode === 'fast' ? ARS_ORDER.filter(k => k !== 'radar') : ARS_ORDER; }
let arsBuy = null;       // купленное (счётчики)
let arsDefense = null;   // {shields:[rTop..], mines:[{r,c}]} — размещение на своём поле
let arsShopPhase = false;

function setPlayBtnLabel(t) {
  const b = document.getElementById('play-btn');
  let node = null;
  for (let i = 0; i < b.childNodes.length; i++) if (b.childNodes[i].nodeType === 3) { node = b.childNodes[i]; break; }
  if (node) node.nodeValue = t + ' ';                                  // меняем только текст — svg не трогаем, кнопка не мигает
  else b.insertBefore(document.createTextNode(t + ' '), b.firstChild);
}
function arsSpent() { return ARSO().reduce((a, k) => a + (arsBuy ? arsBuy[k] : 0) * ARSD(k).price, 0); }
function arsShipCells() {
  const cells = [];
  if (placement) placement.pieces.forEach(p => { if (p.placed) p.cells.forEach(q => cells.push(q)); });
  return cells;
}
function arsMineCellOk(r, c, ignoreIdx) {
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
  for (const q of arsShipCells()) if (q.r === r && q.c === c) return false;      // не на корабле (вплотную — можно)
  for (let i = 0; i < arsDefense.mines.length; i++) {
    if (i === ignoreIdx) continue;
    const m = arsDefense.mines[i];
    if (m.r === r && m.c === c) return false;                                    // не на другой мине
  }
  return true;
}
function arsShieldTopOk(rTop, ignoreIdx) {
  if (rTop < 0 || rTop > SIZE - 2) return false;
  for (let i = 0; i < arsDefense.shields.length; i++) {
    if (i === ignoreIdx) continue;
    if (Math.abs(arsDefense.shields[i] - rTop) < 2) return false;                // полосы не пересекаются
  }
  return true;
}
function arsRandShield() {
  const opts = [];
  for (let r = 0; r <= SIZE - 2; r++) if (arsShieldTopOk(r, -1)) opts.push(r);
  return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
}
function arsRandMine() {
  for (let t = 0; t < 300; t++) {
    const r = Math.floor(Math.random() * SIZE), c = Math.floor(Math.random() * SIZE);
    if (arsMineCellOk(r, c, -1)) return { r, c };
  }
  return null;
}

// --- мини-магазин на месте дока фигур ---
// плавное превращение дока «твои фигуры» ↔ «арсенал»: FLIP по высоте + фейды контента
function arsDockMorph(toShop, label) {
  const dock = document.getElementById('dock');
  if (dock._morphing) return;
  dock._morphing = true;
  setTimeout(() => { dock._morphing = false; }, 700);
  const out = toShop ? [document.getElementById('dock-title'), document.getElementById('dock-pieces')] : [document.getElementById('dock-shop')];
  const inn = toShop ? [document.getElementById('dock-shop')] : [document.getElementById('dock-title'), document.getElementById('dock-pieces')];
  out.forEach(el => { if (el) { el.style.transition = 'opacity 0.24s ease'; el.style.opacity = '0'; } });
  setTimeout(() => {
    const h0 = dock.offsetHeight;
    if (label) setPlayBtnLabel(label);   // лейбл меняем пока контент скрыт — без скачка
    dock.classList.toggle('shop-mode', toShop);
    inn.forEach(el => { if (el) { el.style.transition = 'none'; el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; } });
    const h1 = dock.offsetHeight;
    if (h0 !== h1 && h0 > 0) {           // FLIP: поле плавно едет вместе с высотой дока
      dock.style.height = h0 + 'px';
      dock.style.overflow = 'hidden';
      void dock.offsetWidth;
      dock.style.transition = 'height 0.55s cubic-bezier(.3,.85,.3,1), max-width 0.55s cubic-bezier(.3,.85,.3,1), padding 0.55s cubic-bezier(.3,.85,.3,1)';
      dock.style.height = h1 + 'px';
      setTimeout(() => { dock.style.height = ''; dock.style.overflow = ''; dock.style.transition = ''; }, 590);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      inn.forEach(el => {
        if (!el) return;
        el.style.transition = 'opacity 0.4s ease 0.1s, transform 0.4s cubic-bezier(.25,.9,.3,1) 0.1s';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    }));
  }, 260);
}
function arsShopEnter() {
  arsShopPhase = true;
  if (!arsBuy) arsBuy = { shield: 0, radar: 0, big: 0, line: 0, mine: 0 };
  if (!arsDefense) arsDefense = { shields: [], mines: [] };
  arsDockMorph(true, 'Играть');
  const shop = document.getElementById('dock-shop');
  if (shop._builtMode !== lastMode) {
    shop._builtMode = lastMode;
    const grid = document.getElementById('dshop-grid');
    grid.innerHTML = '';
    ARSO().forEach(key => {
      const d = ARSD(key);
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'ars-tile';
      tile.id = 'ars-tile-' + key;
      tile.innerHTML = '<span class="t-price">' + d.price + ' XP</span>'
        + '<span class="t-ico">' + d.ico + '</span>'
        + '<span class="t-count" id="ars-n-' + key + '">0/' + d.max + '</span>';
      tile.addEventListener('click', () => arsTileTap(key));
      grid.appendChild(tile);
    });
    if (!shop._handlers) {
      shop._handlers = true;
      document.getElementById('dshop-reset').addEventListener('click', arsResetAll);
      document.getElementById('dshop-back').addEventListener('click', () => arsShopExit(true));
    }
  }
  document.getElementById('place-board').classList.add('def-mode');
  arsShopSync();
  arsRenderPlaceOverlays();
}
// тап по карточке: +1; на максимуме — сброс в 0 (с возвратом XP)
function arsTileTap(k) {
  const d = ARSD(k);
  if (arsBuy[k] >= d.max) {            // полный — обнуляем
    arsRefundAllOf(k);
  } else if (getXP() >= d.price) {
    arsBuyItem(k);
    return;
  } else {
    jsShake(document.getElementById('ars-tile-' + k));   // не хватает XP
    return;
  }
  arsShopSync(); arsRenderPlaceOverlays();
}
function arsRefundAllOf(k) {
  const n = arsBuy[k];
  if (n <= 0) return;
  if (k === 'shield') arsDefense.shields.length = 0;
  if (k === 'mine') arsDefense.mines.length = 0;
  arsBuy[k] = 0;
  setXP(getXP() + n * ARSD(k).price);
}
function arsResetAll() {
  if (!arsBuy) return;
  const back = arsSpent();
  if (back > 0) setXP(getXP() + back);
  ARSO().forEach(k => { arsBuy[k] = 0; });
  arsDefense.shields.length = 0; arsDefense.mines.length = 0;
  try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium'); } catch (e) {}
  arsShopSync(); arsRenderPlaceOverlays();
}
function arsShopExit(refund) {
  if (refund && arsBuy) {
    const back = arsSpent();
    if (back > 0) setXP(getXP() + back);
    arsBuy = null; arsDefense = null;
  }
  arsShopPhase = false;
  arsDockMorph(false, 'Далее');
  document.getElementById('place-board').classList.remove('def-mode');
  const pb = document.getElementById('place-board');
  pb.querySelectorAll('.ars-band, .ars-mine').forEach(e => e.remove());
}
function arsBuyItem(k) {
  const d = ARSD(k);
  if (arsBuy[k] >= d.max || getXP() < d.price) return;
  if (k === 'shield') { const rt = arsRandShield(); if (rt === null) return; arsDefense.shields.push(rt); }
  if (k === 'mine') { const m = arsRandMine(); if (!m) return; arsDefense.mines.push(m); }
  arsBuy[k]++;
  setXP(getXP() - d.price);
  try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch (e) {}
  arsShopSync(); arsRenderPlaceOverlays();
}
function arsShopSync() {
  document.getElementById('dshop-bal').textContent = getXP() + ' XP';
  const bal = getXP();
  ARSO().forEach(k => {
    const n = document.getElementById('ars-n-' + k);
    if (n) n.textContent = arsBuy[k] + '/' + ARSD(k).max;
    const tile = document.getElementById('ars-tile-' + k);
    if (tile) {
      tile.classList.toggle('sel', arsBuy[k] > 0);
      tile.classList.toggle('poor', arsBuy[k] === 0 && bal < ARSD(k).price);
    }
  });
}

// --- оверлеи на поле расстановки: перетаскиваемые щиты и мины ---
function arsRenderPlaceOverlays() {
  if (!arsDefense) return;
  const boardEl = document.getElementById('place-board');
  boardEl.querySelectorAll('.ars-band:not(.flash), .ars-mine').forEach(e => e.remove());   // flash-полосу не трогаем
  arsDefense.shields.forEach((rTop, idx) => {
    const rc = arsBandRect(boardEl, rTop); if (!rc) return;
    const d = document.createElement('div');
    d.className = 'ars-band draggable';
    d.style.cssText = 'left:' + rc.left + 'px;top:' + rc.top + 'px;width:' + rc.width + 'px;height:' + rc.height + 'px';
    arsBindBandDrag(d, idx);
    boardEl.appendChild(d);
  });
  arsDefense.mines.forEach((m, idx) => {
    const cell = boardEl.querySelector('.cell[data-r="' + m.r + '"][data-c="' + m.c + '"]');
    if (!cell) return;
    const d = document.createElement('div');
    d.className = 'ars-mine draggable';
    const sz = Math.round(cell.offsetWidth * 0.72);
    d.style.cssText = 'left:' + (cell.offsetLeft + (cell.offsetWidth - sz) / 2) + 'px;top:' + (cell.offsetTop + (cell.offsetHeight - sz) / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px';
    arsBindMineDrag(d, idx);
    boardEl.appendChild(d);
  });
}
function arsBindBandDrag(el, idx) {
  let active = false;
  const move = (x, y) => {
    if (!active) return;
    const cell = boardCellFromPoint(x, y); if (!cell) return;
    let rTop = Math.max(0, Math.min(SIZE - 2, cell.r));
    if (!arsShieldTopOk(rTop, idx)) {
      // упираемся в соседний барьер: подползаем к нему по шагу, не накладываясь
      const cur = (typeof el._cand === 'number') ? el._cand : arsDefense.shields[idx];
      const dir = rTop > cur ? 1 : -1;
      let probe = cur;
      while (probe !== rTop && arsShieldTopOk(probe + dir, idx)) probe += dir;
      rTop = probe;
    }
    el._cand = rTop;
    const boardEl = document.getElementById('place-board');
    const rc = arsBandRect(boardEl, rTop); if (!rc) return;
    el.style.top = rc.top + 'px';
  };
  const end = () => {
    if (!active) return; active = false;
    el.classList.remove('drag');
    const rTop = el._cand;
    if (typeof rTop === 'number' && arsShieldTopOk(rTop, idx)) arsDefense.shields[idx] = rTop;
    arsRenderPlaceOverlays();
  };
  el.addEventListener('touchstart', e => { active = true; el.classList.add('drag'); }, { passive: true });
  el.addEventListener('touchmove', e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
  el.addEventListener('touchend', end, { passive: true });
  el.addEventListener('mousedown', e => { active = true; el.classList.add('drag'); e.preventDefault(); });
  window.addEventListener('mousemove', e => { if (active) move(e.clientX, e.clientY); });
  window.addEventListener('mouseup', end);
}
function arsBindMineDrag(el, idx) {
  let active = false;
  const move = (x, y) => {
    if (!active) return;
    const cell = boardCellFromPoint(x, y); if (!cell) return;
    el._cand = cell;
    const boardEl = document.getElementById('place-board');
    const cEl = boardEl.querySelector('.cell[data-r="' + cell.r + '"][data-c="' + cell.c + '"]');
    if (!cEl) return;
    const sz = el.offsetWidth;
    el.style.left = (cEl.offsetLeft + (cEl.offsetWidth - sz) / 2) + 'px';
    el.style.top = (cEl.offsetTop + (cEl.offsetHeight - sz) / 2) + 'px';
    el.classList.toggle('bad', !arsMineCellOk(cell.r, cell.c, idx));
  };
  const end = () => {
    if (!active) return; active = false;
    el.classList.remove('drag');
    const cand = el._cand;
    if (cand && arsMineCellOk(cand.r, cand.c, idx)) arsDefense.mines[idx] = { r: cand.r, c: cand.c };
    arsRenderPlaceOverlays();
  };
  el.addEventListener('touchstart', () => { active = true; el.classList.add('drag'); }, { passive: true });
  el.addEventListener('touchmove', e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
  el.addEventListener('touchend', end, { passive: true });
  el.addEventListener('mousedown', e => { active = true; el.classList.add('drag'); e.preventDefault(); });
  window.addEventListener('mousemove', e => { if (active) move(e.clientX, e.clientY); });
  window.addEventListener('mouseup', end);
}

// --- оверлеи: полосы защиты, мины, скан ---
// эффекты кладём в стабильный fx-слой — вставки не трогают клетки и фигуры (не мигают)
function fxLayer(boardId) {
  const b = document.getElementById(boardId);
  if (!b) return null;
  return b.querySelector(':scope > .fx-layer') || b;
}
function arsBandRect(boardEl, rTop) {
  const c1 = boardEl.querySelector('.cell[data-r="' + rTop + '"][data-c="0"]');
  const c2 = boardEl.querySelector('.cell[data-r="' + (rTop + 1) + '"][data-c="' + (SIZE - 1) + '"]');
  if (!c1 || !c2) return null;
  return { left: c1.offsetLeft - 2, top: c1.offsetTop - 2, width: c2.offsetLeft + c2.offsetWidth - c1.offsetLeft + 4, height: c2.offsetTop + c2.offsetHeight - c1.offsetTop + 4 };
}
function arsRenderDefOverlays(boardId, shieldTops, mines) {
  const boardEl = document.getElementById(boardId);
  boardEl.querySelectorAll('.ars-band:not(.flash), .ars-mine').forEach(e => e.remove());   // flash-полосу не трогаем
  (shieldTops || []).forEach(s => {
    const rTop = (typeof s === 'number') ? s : s.rTop;
    if (typeof s === 'object' && s.used) return;   // потраченный щит исчезает
    const rc = arsBandRect(boardEl, rTop); if (!rc) return;
    const d = document.createElement('div');
    d.className = 'ars-band';
    d.style.cssText = 'left:' + rc.left + 'px;top:' + rc.top + 'px;width:' + rc.width + 'px;height:' + rc.height + 'px';
    (fxLayer(boardId) || boardEl).appendChild(d);
  });
  (mines || []).forEach(m => {
    if (m.hit) return;
    const cell = boardEl.querySelector('.cell[data-r="' + m.r + '"][data-c="' + m.c + '"]');
    if (!cell) return;
    const d = document.createElement('div');
    d.className = 'ars-mine';
    const sz = Math.round(cell.offsetWidth * 0.72);
    d.style.cssText = 'left:' + (cell.offsetLeft + (cell.offsetWidth - sz) / 2) + 'px;top:' + (cell.offsetTop + (cell.offsetHeight - sz) / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px';
    (fxLayer(boardId) || boardEl).appendChild(d);
  });
}
function arsFlashShield(boardId, shield) {
  shield.used = true;
  const boardEl = document.getElementById(boardId);
  const rc = arsBandRect(boardEl, shield.rTop); if (!rc) return;
  const d = document.createElement('div');
  d.className = 'ars-band flash';
  d.style.cssText = 'left:' + rc.left + 'px;top:' + rc.top + 'px;width:' + rc.width + 'px;height:' + rc.height + 'px;opacity:1;transition:opacity 0.5s ease 0.7s';
  boardEl.appendChild(d);
  jsShake(boardEl);
  try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning'); } catch (e) {}
  setTimeout(() => { d.style.opacity = '0'; }, 60);
  setTimeout(() => d.remove(), 1400);
  if (boardId === 'battle-my-board') arsRenderMyDefense();
}
function arsScanFlash(boardId, r0, c0) {
  const boardEl = document.getElementById(boardId);
  const c1 = boardEl.querySelector('.cell[data-r="' + r0 + '"][data-c="' + c0 + '"]');
  const c2 = boardEl.querySelector('.cell[data-r="' + (r0 + 2) + '"][data-c="' + (c0 + 2) + '"]');
  if (!c1 || !c2) return;
  const d = document.createElement('div');
  d.className = 'ars-scan';
  d.style.cssText = 'left:' + (c1.offsetLeft - 2) + 'px;top:' + (c1.offsetTop - 2) + 'px;width:'
    + (c2.offsetLeft + c2.offsetWidth - c1.offsetLeft + 4) + 'px;height:' + (c2.offsetTop + c2.offsetHeight - c1.offsetTop + 4) + 'px';
  (fxLayer(boardId) || boardEl).appendChild(d);
  requestAnimationFrame(() => d.classList.add('on'));
  setTimeout(() => d.classList.remove('on'), 1100);
  setTimeout(() => d.remove(), 1600);
}
function arsRenderMyDefense() {
  if (!state || !state.ars) return;
  // щиты в бою невидимы (видны только при срабатывании); мины показываем
  arsRenderDefOverlays('battle-my-board', [], state.ars.player.mines);
}
// затемнение «пропуск хода»: включается при подрыве и висит, пока пропуск не израсходован
function skipDimOn(boardId) {
  skipDimOff(boardId);
  const boardEl = document.getElementById(boardId);
  const d = document.createElement('div');
  d.className = 'skip-dim';
  d.textContent = 'пропуск хода';
  (fxLayer(boardId) || boardEl).appendChild(d);
  requestAnimationFrame(() => d.classList.add('on'));
}
function skipDimOff(boardId) {
  const sel = boardId ? '#' + boardId + ' .skip-dim' : '.skip-dim';
  document.querySelectorAll(sel).forEach(d => {
    d.classList.remove('on');
    setTimeout(() => d.remove(), 450);
  });
}

// --- предпоказ удара (синяя зона) + стрельба по отпусканию пальца ---
function cellFromPointIn(boardId, x, y) {
  const below = document.elementFromPoint(x, y);
  if (below) {
    const cell = below.closest('#' + boardId + ' .cell');
    if (cell) return { r: +cell.dataset.r, c: +cell.dataset.c };
  }
  const board = document.getElementById(boardId);
  const rect = board.getBoundingClientRect();
  const pad = 6;
  if (x < rect.left + pad || x > rect.right - pad || y < rect.top + pad || y > rect.bottom - pad) return null;
  const inner = rect.width - pad * 2;
  const cellSz = inner / SIZE;
  const c = Math.max(0, Math.min(SIZE - 1, Math.floor((x - rect.left - pad) / cellSz)));
  const r = Math.max(0, Math.min(SIZE - 1, Math.floor((y - rect.top - pad) / cellSz)));
  return { r, c };
}
// силуэт корабля от радара: появляется, мигает и тает (всё JS-транзишенами)
function radarBlinkCell(boardId, r, c) {
  const cell = getCellEl(boardId, r, c);
  if (!cell) return;
  const d = document.createElement('div');
  d.className = 'radar-sil';
  const inset = Math.round(cell.offsetWidth * 0.2);
  d.style.cssText = 'left:' + (cell.offsetLeft + inset) + 'px;top:' + (cell.offsetTop + inset) + 'px;width:'
    + (cell.offsetWidth - inset * 2) + 'px;height:' + (cell.offsetHeight - inset * 2) + 'px;opacity:0';
  (fxLayer(boardId) || cell).appendChild(d);
  const seq = [[30, '1', 0.25], [950, '0.25', 0.14], [1130, '1', 0.14], [1310, '0.25', 0.14], [1490, '1', 0.14], [1950, '0', 0.45]];
  seq.forEach(s => setTimeout(() => {
    d.style.transition = 'opacity ' + s[2] + 's ease';
    d.style.opacity = s[1];
  }, s[0]));
  setTimeout(() => d.remove(), 2500);
}
function arsClearAim() {
  document.querySelectorAll('#enemy-board .ars-aim').forEach(e => e.remove());
}
function arsShowAim(kind, r, c) {
  const boardEl = document.getElementById('enemy-board');
  const host = fxLayer('enemy-board') || boardEl;
  let aim = host.querySelector('.ars-aim');
  if (!aim) { aim = document.createElement('div'); host.appendChild(aim); }
  aim.className = 'ars-aim' + (kind === 'radar' ? ' scan' : '');
  let c1, c2;
  if (kind === 'line') {
    c1 = boardEl.querySelector('.cell[data-r="' + r + '"][data-c="0"]');
    c2 = boardEl.querySelector('.cell[data-r="' + r + '"][data-c="' + (SIZE - 1) + '"]');
  } else {
    const r0 = arsClampCenter(r) - 1, c0 = arsClampCenter(c) - 1;
    c1 = boardEl.querySelector('.cell[data-r="' + r0 + '"][data-c="' + c0 + '"]');
    c2 = boardEl.querySelector('.cell[data-r="' + (r0 + 2) + '"][data-c="' + (c0 + 2) + '"]');
  }
  if (!c1 || !c2) return;
  aim.style.cssText = 'left:' + (c1.offsetLeft - 2) + 'px;top:' + (c1.offsetTop - 2) + 'px;width:'
    + (c2.offsetLeft + c2.offsetWidth - c1.offsetLeft + 4) + 'px;height:' + (c2.offsetTop + c2.offsetHeight - c1.offsetTop + 4) + 'px';
}
(function () {
  const b = document.getElementById('enemy-board');
  if (!b) return;
  let aiming = false, last = null;
  const upd = (x, y) => {
    if (!state || !state.armed || state.cd || state.turn !== 'player' || state.over) return;
    const cell = cellFromPointIn('enemy-board', x, y);
    if (cell) { aiming = true; last = cell; arsShowAim(state.armed, cell.r, cell.c); }
  };
  b.addEventListener('touchstart', e => { const t = e.touches[0]; upd(t.clientX, t.clientY); }, { passive: true });
  b.addEventListener('touchmove', e => { const t = e.touches[0]; upd(t.clientX, t.clientY); }, { passive: true });
  b.addEventListener('touchend', e => {
    if (!aiming || !state || !state.armed) { aiming = false; return; }
    aiming = false;
    const t = e.changedTouches[0];
    const cell = cellFromPointIn('enemy-board', t.clientX, t.clientY) || last;
    arsClearAim();
    if (cell) { state._wfire = Date.now(); arsPlayerUse(cell.r, cell.c); }
  }, { passive: true });
  b.addEventListener('mousemove', e => upd(e.clientX, e.clientY));
  b.addEventListener('mouseleave', () => { if (state && state.armed) arsClearAim(); });
})();

// --- помощники боя ---
function arsGetMineAt(side, r, c) {
  if (!side || !side.mines) return null;
  return side.mines.find(m => !m.hit && m.r === r && m.c === c) || null;
}
function arsShieldFor(side, rows) {
  if (!side || !side.shields) return null;
  return side.shields.find(s => !s.used && rows.some(r => r === s.rTop || r === s.rTop + 1)) || null;
}
function arsZoneRows(r0) { return [r0, r0 + 1, r0 + 2]; }
function arsClampCenter(v) { return Math.max(1, Math.min(SIZE - 2, v)); }

// --- панель арсенала игрока в бою ---
function arsRenderPanel() {
  const panel = document.getElementById('ars-panel');
  const A = state && state.ars ? state.ars.player : null;
  if (!A || (A.radar + A.big + A.line) <= 0) {
    panel.classList.add('hidden');
    document.getElementById('ars-hint').classList.add('hidden');
    return;
  }
  if (!panel._built) {
    panel.innerHTML = '';
    ['radar', 'big', 'line'].forEach(k => {
      const b = document.createElement('button');
      b.className = 'ars-btn'; b.id = 'ars-btn-' + k; b.type = 'button';
      b.innerHTML = ARS_DEF[k].ico + '<span class="ars-dots" id="ars-bdg-' + k + '"></span>';
      b.addEventListener('click', () => {
        if (!state || state.over || state.cd || state.turn !== 'player') return;
        state.armed = (state.armed === k) ? null : k;
        if (!state.armed) arsClearAim();
        arsSyncPanel();
      });
      panel.appendChild(b);
    });
    panel._built = true;
  }
  panel.classList.remove('hidden');
  arsSyncPanel();
}
function arsSyncPanel() {
  const A = state && state.ars ? state.ars.player : null;
  if (!A) return;
  ['radar', 'big', 'line'].forEach(k => {
    const b = document.getElementById('ars-btn-' + k), bd = document.getElementById('ars-bdg-' + k);
    if (!b) return;
    if (k === 'radar' && lastMode === 'fast') { b.style.display = 'none'; return; }
    b.style.display = '';
    let dots = '';
    for (let i = 0; i < ARSD(k).max; i++) dots += '<i class="' + (i < A[k] ? '' : 'off') + '"></i>';
    bd.innerHTML = dots;
    b.classList.toggle('depleted', A[k] <= 0);
    b.classList.toggle('armed', state.armed === k);
    if (A[k] <= 0 && state.armed === k) state.armed = null;
  });
  const hint = document.getElementById('ars-hint');
  if (state.armed === 'radar') { hint.textContent = 'Радар: тапни центр зоны 3×3'; hint.classList.remove('hidden'); }
  else if (state.armed === 'big') { hint.textContent = 'Бомба: тапни центр зоны 3×3'; hint.classList.remove('hidden'); }
  else if (state.armed === 'line') { hint.textContent = 'Залп: тапни строку'; hint.classList.remove('hidden'); }
  else hint.classList.add('hidden');
}

// --- применение оружия игроком ---
function arsPlayerUse(r, c) {
  arsClearAim();
  const A = state.ars && state.ars.player;
  if (!A) { state.armed = null; return; }
  const kind = state.armed;
  state.armed = null;
  if (kind === 'radar' && A.radar > 0) {
    A.radar--; arsSyncPanel();
    const r0 = arsClampCenter(r) - 1, c0 = arsClampCenter(c) - 1;
    arsScanFlash('enemy-board', r0, c0);
    for (let rr = r0; rr <= r0 + 2; rr++) for (let cc = c0; cc <= c0 + 2; cc++) {
      const cell = state.enemy.board[rr][cc];
      if (cell.shot || cell.shipId === null) continue;          // отмечаем только корабли
      radarBlinkCell('enemy-board', rr, cc);                    // силуэт мигает и исчезает — запоминай
    }
    setTimeout(() => { if (state && !state.over) passTurnToEnemy(); }, 2500);   // радар тратит ход
    return;
  }
  if (kind === 'big' && A.big > 0) {
    A.big--; arsSyncPanel();
    const r0 = arsClampCenter(r) - 1, c0 = arsClampCenter(c) - 1;
    const sh = arsShieldFor(state.ars.enemy, arsZoneRows(r0));
    if (sh) { animShieldBlock('enemy-board', r0 + 1, c0 + 1, sh, () => { if (!state.over) passTurnToEnemy(); }); return; }
    const pool = [];
    for (let rr = r0; rr <= r0 + 2; rr++) for (let cc = c0; cc <= c0 + 2; cc++)
      if (!state.enemy.board[rr][cc].shot) pool.push({ r: rr, c: cc });
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    animBigStrike('enemy-board', r0 + 1, c0 + 1, pool.slice(0, 3), shootEnemyCell,
      () => { state.skipPlayer = true; skipDimOn('enemy-board'); setTimeout(() => { if (!state.over) passTurnToEnemy(); }, 700); },
      () => { if (!state.over) passTurnToEnemy(); });
    return;
  }
  if (kind === 'line' && A.line > 0) {
    A.line--; arsSyncPanel();
    const sh = arsShieldFor(state.ars.enemy, [r]);
    if (sh) { animShieldBlock('enemy-board', r, Math.floor(SIZE / 2), sh, () => { if (!state.over) passTurnToEnemy(); }); return; }
    const targets = [];
    for (let cc = 0; cc < SIZE; cc++) if (!state.enemy.board[r][cc].shot) targets.push({ r, c: cc });
    animLineVolley('enemy-board', targets, shootEnemyCell,
      () => { state.skipPlayer = true; skipDimOn('enemy-board'); setTimeout(() => { if (!state.over) passTurnToEnemy(); }, 700); },
      () => { if (!state.over) passTurnToEnemy(); });
    return;
  }
  arsSyncPanel();
}

// --- арсенал ИИ ---
function aiTryArsenal() {
  const A = state.ars && state.ars.enemy;
  if (!A) return false;
  state.aiMoves = (state.aiMoves || 0) + 1;
  if (A.radar > 0 && state.aiMoves >= 2 && Math.random() < 0.6) { aiUseRadar(); return true; }
  if (A.line > 0 && Math.random() < 0.2) { aiUseLine(); return true; }
  if (A.big > 0 && Math.random() < 0.25) { aiUseBig(); return true; }
  return false;
}
function aiZonePick() {
  // зона с максимумом непрострелянных клеток
  let best = null, bv = -1;
  for (let t = 0; t < 14; t++) {
    const r0 = 1 + Math.floor(Math.random() * (SIZE - 2)) - 1, c0 = 1 + Math.floor(Math.random() * (SIZE - 2)) - 1;
    const rr0 = Math.max(0, Math.min(SIZE - 3, r0)), cc0 = Math.max(0, Math.min(SIZE - 3, c0));
    let v = 0;
    for (let rr = rr0; rr <= rr0 + 2; rr++) for (let cc = cc0; cc <= cc0 + 2; cc++) if (!state.player.board[rr][cc].shot) v++;
    if (v > bv) { bv = v; best = { r0: rr0, c0: cc0 }; }
  }
  return best;
}
function aiUseRadar() {
  const A = state.ars.enemy; A.radar--;
  const z = aiZonePick();
  arsScanFlash('battle-my-board', z.r0, z.c0);
  state.aiKnown = state.aiKnown || [];
  for (let rr = z.r0; rr <= z.r0 + 2; rr++) for (let cc = z.c0; cc <= z.c0 + 2; cc++) {
    const cell = state.player.board[rr][cc];
    if (!cell.shot && cell.shipId !== null) state.aiKnown.push({ r: rr, c: cc });
  }
  setTimeout(() => { if (!state.over) passTurnToPlayer(); }, 1100);   // радар тоже тратит ход
}
function aiUseBig() {
  const A = state.ars.enemy; A.big--;
  const z = aiZonePick();
  const sh = arsShieldFor(state.ars.player, arsZoneRows(z.r0));
  if (sh) { animShieldBlock('battle-my-board', z.r0 + 1, z.c0 + 1, sh, () => { if (!state.over) passTurnToPlayer(); }); return; }
  const pool = [];
  for (let rr = z.r0; rr <= z.r0 + 2; rr++) for (let cc = z.c0; cc <= z.c0 + 2; cc++)
    if (!state.player.board[rr][cc].shot) pool.push({ r: rr, c: cc });
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  animBigStrike('battle-my-board', z.r0 + 1, z.c0 + 1, pool.slice(0, 3), aiShootPlayerCell,
    () => { state.skipEnemy = true; skipDimOn('battle-my-board'); setTimeout(() => { if (!state.over) passTurnToPlayer(); }, 700); },
    () => { if (!state.over) passTurnToPlayer(); });
}
function aiUseLine() {
  const A = state.ars.enemy; A.line--;
  let bestR = 0, bv = -1;
  for (let r = 0; r < SIZE; r++) {
    let v = 0; for (let c = 0; c < SIZE; c++) if (!state.player.board[r][c].shot) v++;
    if (v > bv) { bv = v; bestR = r; }
  }
  const sh = arsShieldFor(state.ars.player, [bestR]);
  if (sh) { animShieldBlock('battle-my-board', bestR, Math.floor(SIZE / 2), sh, () => { if (!state.over) passTurnToPlayer(); }); return; }
  const targets = [];
  for (let c = 0; c < SIZE; c++) if (!state.player.board[bestR][c].shot) targets.push({ r: bestR, c });
  animLineVolley('battle-my-board', targets, aiShootPlayerCell,
    () => { state.skipEnemy = true; skipDimOn('battle-my-board'); setTimeout(() => { if (!state.over) passTurnToPlayer(); }, 700); },
    () => { if (!state.over) passTurnToPlayer(); });
}
function arsAiAutoDefense(counts) {
  // ИИ ставит щиты и мины случайно по тем же правилам
  const shields = [];
  let guard = 0;
  while (shields.length < counts.shield && guard++ < 120) {
    const rTop = Math.floor(Math.random() * (SIZE - 1));
    if (!shields.some(s => Math.abs(s - rTop) < 2)) shields.push(rTop);
  }
  const mines = [];
  guard = 0;
  const shipCells = [];
  state.enemy.ships.forEach(s => s.cells.forEach(q => shipCells.push(q)));
  while (mines.length < counts.mine && guard++ < 400) {
    const r = Math.floor(Math.random() * SIZE), c = Math.floor(Math.random() * SIZE);
    const all = shipCells.concat(mines);
    let ok = true;
    for (const q of all) if (q.r === r && q.c === c) { ok = false; break; }   // вплотную можно, на клетку — нет
    if (ok) mines.push({ r, c });
  }
  return {
    shields: shields.map(rTop => ({ rTop, used: false })),
    mines: mines.map(m => ({ r: m.r, c: m.c, hit: false })),
    radar: counts.radar, big: counts.big, line: counts.line
  };
}

// --- анимации арсенала: дуговой полёт снаряда, взрывы, сбивание щитом (всё JS-транзишенами) ---
function arsCellCenter(boardId, r, c) {
  const cell = getCellEl(boardId, r, c);
  if (!cell) return null;
  const rc = cell.getBoundingClientRect();
  if (!rc.width) return null;   // поле невидимо/тесты
  return { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2, w: rc.width, cell };
}
function spawnBlast(boardId, r, c, mine) {
  const cell = getCellEl(boardId, r, c);
  const boardEl = document.getElementById(boardId);
  if (!cell || !boardEl) return;
  const sz = cell.offsetWidth * 1.7;
  const d = document.createElement('div');
  d.className = 'ars-blast' + (mine ? ' mine' : '');
  d.style.cssText = 'left:' + (cell.offsetLeft + cell.offsetWidth / 2 - sz / 2) + 'px;top:' + (cell.offsetTop + cell.offsetHeight / 2 - sz / 2)
    + 'px;width:' + sz + 'px;height:' + sz + 'px;transform:scale(0.25);opacity:1';
  (fxLayer(boardId) || boardEl).appendChild(d);
  requestAnimationFrame(() => {
    d.style.transition = 'transform 0.5s cubic-bezier(.2,.7,.35,1), opacity 0.5s ease';
    d.style.transform = 'scale(1)';
    d.style.opacity = '0';
  });
  setTimeout(() => d.remove(), 650);
}
function spawnMineBlast(boardId, r, c) {
  spawnBlast(boardId, r, c, true);
  jsShake(fxLayer(boardId));   // не сам board — иначе фигуры мигают
  const p = arsCellCenter(boardId, r, c);
  if (p) bombShatter(p.x, p.y, 'rgba(255,71,87,0.95)');
}
function bombShatter(x, y, color) {
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('div');
    s.className = 'ars-shard';
    if (color) s.style.background = color;
    s.style.transform = 'translate(' + (x - 2) + 'px,' + (y - 2) + 'px)';
    s.style.opacity = '1';
    document.body.appendChild(s);
    const a = Math.random() * Math.PI * 2, dist = 26 + Math.random() * 34;
    requestAnimationFrame(() => {
      s.style.transition = 'transform 0.45s cubic-bezier(.2,.6,.4,1), opacity 0.45s ease';
      s.style.transform = 'translate(' + (x + Math.cos(a) * dist) + 'px,' + (y + Math.sin(a) * dist) + 'px) rotate(' + (Math.random() * 240 - 120) + 'deg)';
      s.style.opacity = '0';
    });
    setTimeout(() => s.remove(), 600);
  }
}
// дуговой полёт: с края экрана, маленький → большой на пике (ближе к игроку) → уменьшается и садится в клетку.
// Внешний слой летит по прямой к цели, внутренний даёт подъём и масштаб — вместе получается дуга.
function flyBomb(boardId, r, c, fromRight, cb) {
  const p = arsCellCenter(boardId, r, c);
  if (!p) { if (cb) cb(null); return; }
  const w = document.createElement('div');
  w.className = 'ars-bomb-w';
  const inner = document.createElement('div');
  inner.className = 'ars-bomb';
  const bs = Math.max(10, Math.round(p.w * 0.55));   // размер бомбы — от размера клетки (на мини-поле миниатюрнее)
  inner.style.width = bs + 'px'; inner.style.height = bs + 'px';
  w.appendChild(inner);
  const sx = fromRight ? window.innerWidth + 50 : -50;
  w.style.transform = 'translate(' + sx + 'px,' + p.y + 'px)';
  inner.style.transform = 'translate(-50%,-50%) translateY(0px) scale(0.45)';
  document.body.appendChild(w);
  const T = 820;
  const arc = Math.round(p.w * 2.6);                 // высота дуги тоже от клетки
  requestAnimationFrame(() => {
    w.style.transition = 'transform ' + T + 'ms linear';
    w.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
    inner.style.transition = 'transform ' + Math.round(T * 0.55) + 'ms cubic-bezier(.25,.6,.5,1)';
    inner.style.transform = 'translate(-50%,-50%) translateY(' + (-arc) + 'px) scale(1.55)';
  });
  setTimeout(() => {
    inner.style.transition = 'transform ' + Math.round(T * 0.45) + 'ms cubic-bezier(.5,0,.8,.4)';
    inner.style.transform = 'translate(-50%,-50%) translateY(0px) scale(0.8)';
  }, Math.round(T * 0.55));
  setTimeout(() => {
    w.remove();
    if (cb) cb({ x: p.x, y: p.y });
  }, T + 20);
}
// тройная бомба: на подлёте к полю распадается на три бомбочки, летящие к своим клеткам
function flyBombSplit(boardId, centerR, centerC, targets, fromRight, onLand) {
  const pc = arsCellCenter(boardId, centerR, centerC);
  if (!pc) { onLand(); return; }
  const w = document.createElement('div');
  w.className = 'ars-bomb-w';
  const inner = document.createElement('div');
  inner.className = 'ars-bomb';
  const bs = Math.max(11, Math.round(pc.w * 0.6));
  inner.style.width = bs + 'px'; inner.style.height = bs + 'px';
  w.appendChild(inner);
  const sx = fromRight ? window.innerWidth + 50 : -50;
  // точка распада — на подлёте, чуть не доезжая поля
  const splitX = pc.x + (fromRight ? 1 : -1) * Math.max(90, pc.w * 3);
  const splitY = pc.y;
  w.style.transform = 'translate(' + sx + 'px,' + splitY + 'px)';
  inner.style.transform = 'translate(-50%,-50%) translateY(0px) scale(0.45)';
  document.body.appendChild(w);
  const T1 = 600;
  const arc = Math.round(pc.w * 2.6);
  requestAnimationFrame(() => {
    w.style.transition = 'transform ' + T1 + 'ms linear';
    w.style.transform = 'translate(' + splitX + 'px,' + splitY + 'px)';
    inner.style.transition = 'transform ' + T1 + 'ms cubic-bezier(.25,.6,.5,1)';
    inner.style.transform = 'translate(-50%,-50%) translateY(' + (-arc) + 'px) scale(1.4)';
  });
  setTimeout(() => {
    w.remove();
    const peakY = splitY - arc;
    const mini = Math.max(8, Math.round(pc.w * 0.42));
    let landed = 0;
    targets.forEach((t, i) => {
      const tp = arsCellCenter(boardId, t.r, t.c);
      const m = document.createElement('div');
      m.className = 'ars-bomb-w';
      const mi = document.createElement('div');
      mi.className = 'ars-bomb';
      mi.style.width = mini + 'px'; mi.style.height = mini + 'px';
      mi.style.transform = 'translate(-50%,-50%) scale(1.1)';
      m.appendChild(mi);
      m.style.transform = 'translate(' + splitX + 'px,' + peakY + 'px)';
      document.body.appendChild(m);
      const D = 330 + i * 80;
      requestAnimationFrame(() => {
        m.style.transition = 'transform ' + D + 'ms cubic-bezier(.45,.1,.75,.5)';
        m.style.transform = 'translate(' + (tp ? tp.x : splitX) + 'px,' + (tp ? tp.y : splitY) + 'px)';
        mi.style.transition = 'transform ' + D + 'ms ease-in';
        mi.style.transform = 'translate(-50%,-50%) scale(0.7)';
      });
      setTimeout(() => {
        m.remove();
        landed++;
        if (landed === targets.length) onLand();
      }, D + 20);
    });
    if (!targets.length) onLand();
  }, T1 + 10);
}
// сработавшая защита: единая полоса мигает, затем плавно растворяется справа налево
function arsFlashShield(boardId, shield) {
  shield.used = true;
  const boardEl = document.getElementById(boardId);
  const rc = arsBandRect(boardEl, shield.rTop);
  if (rc) {
    const host = fxLayer(boardId) || boardEl;
    const clip = document.createElement('div');   // обрезающая рамка: её ширина тает — полоса исчезает справа налево
    clip.style.cssText = 'position:absolute;left:' + rc.left + 'px;top:' + rc.top + 'px;width:' + rc.width + 'px;height:' + rc.height + 'px;overflow:hidden;pointer-events:none;z-index:7;opacity:1';
    const band = document.createElement('div');
    band.className = 'ars-band flash';
    band.style.cssText = 'left:0;top:0;width:' + rc.width + 'px;height:' + rc.height + 'px;opacity:1';
    clip.appendChild(band);
    host.appendChild(clip);
    // мигание целой полосы
    band.style.transition = 'opacity 0.1s ease';
    [[90, '0.25'], [200, '1'], [320, '0.25'], [440, '1']].forEach(b => setTimeout(() => { band.style.opacity = b[1]; }, b[0]));
    // растворение: правый край съедается, полоса тает
    setTimeout(() => {
      clip.style.transition = 'width 0.6s cubic-bezier(.45,.05,.55,.95), opacity 0.6s ease';
      clip.style.width = '0px';
      clip.style.opacity = '0.25';
      // несколько осколков по ходу растворения
      const bb = boardEl.getBoundingClientRect();
      if (bb.width) {
        [0.85, 0.55, 0.25].forEach((f, i) => setTimeout(() => {
          bombShatter(bb.left + rc.left + rc.width * f, bb.top + rc.top + rc.height / 2, 'rgba(255,71,87,0.9)');
        }, i * 170));
      }
    }, 580);
    setTimeout(() => clip.remove(), 1350);
  }
  jsShake(fxLayer(boardId));   // трясём fx-слой: transform на самом board перезапускает переходы фигур в Safari
  try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning'); } catch (e) {}
  if (boardId === 'battle-my-board') arsRenderMyDefense();
}
// бомба сбита щитом: долетает до зоны и в последний момент распадается, щит мигает и тает
function animShieldBlock(boardId, r, c, shield, done) {
  flyBomb(boardId, r, c, boardId === 'enemy-board', pt => {
    arsFlashShield(boardId, shield);
    if (pt) bombShatter(pt.x, pt.y);
    setTimeout(done, 950);
  });
}
// большая бомба: снаряд на подлёте распадается на три, каждая летит к своей клетке
function animBigStrike(boardId, centerR, centerC, targets, shootFn, onMine, done) {
  flyBombSplit(boardId, centerR, centerC, targets, boardId === 'enemy-board', () => {
    let i = 0;
    const step = () => {
      if (!state || state.over) return;
      if (i >= targets.length) { done(); return; }
      const t = targets[i++];
      const res = shootFn(t.r, t.c);
      if (res === 'hit' || res === 'miss') spawnBlast(boardId, t.r, t.c);
      if (res === 'mine') { spawnMineBlast(boardId, t.r, t.c); onMine(); return; }
      if (res === 'end') return;
      setTimeout(step, 120);
    };
    step();
  });
}
// линия: снаряд прилетает к началу строки, взрывы бегут по клеткам до корабля/мины
function animLineVolley(boardId, targets, shootFn, onMine, done) {
  if (!targets.length) { done(); return; }
  flyBomb(boardId, targets[0].r, targets[0].c, boardId === 'enemy-board', () => {
    let i = 0;
    const step = () => {
      if (!state || state.over) return;
      const t = targets[i];
      const res = shootFn(t.r, t.c);
      if (res === 'mine') { spawnMineBlast(boardId, t.r, t.c); onMine(); return; }
      if (res === 'end') return;
      if (res === 'hit') { spawnBlast(boardId, t.r, t.c); setTimeout(done, 550); return; }   // стоп о корабль
      i++;
      if (i >= targets.length) { done(); return; }
      setTimeout(step, 140);
    };
    step();
  });
}

// --- передача хода с учётом пропусков (мины) ---
function passTurnToEnemy() {
  if (!state || state.over) return;
  state.turn = 'enemy'; setTurnArrow('enemy');
  document.getElementById('enemy-board').classList.add('locked');
  setTimeout(() => {
    if (!state || state.over) return;
    if (state.skipEnemy) {   // ход ИИ пропущен — снимаем его затемнение и возвращаем ход
      state.skipEnemy = false;
      skipDimOff('battle-my-board');
      setTimeout(() => { if (state && !state.over) passTurnToPlayer(); }, 480);
    } else aiTurn();
  }, 750);
}
function passTurnToPlayer() {
  if (!state || state.over) return;
  if (state.skipPlayer) {   // твой ход пропущен — снимаем затемнение, ИИ ходит снова
    state.skipPlayer = false;
    skipDimOff('enemy-board');
    setTimeout(() => { if (state && !state.over) aiTurn(); }, 700);
    return;   // ход остаётся у ИИ
  }
  state.turn = 'player'; setTurnArrow('player');
  document.getElementById('enemy-board').classList.remove('locked');
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
  if (currentGame === 'arena') { startArena(); return; }
  if (currentGame === 'snake') { startSnake(); return; }
  applyMode(lastMode);
  startPlacement();
});
document.getElementById('overlay-back').addEventListener('click', () => {
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('snake-screen').classList.add('hidden');
  document.getElementById('arena-screen').classList.add('hidden');
  setGameUIHidden(true);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  renderProfile();
  document.getElementById('gametype-select').classList.remove('hidden');
});
document.getElementById('play-btn').addEventListener('click', () => {
  if (!placement) return;
  if (document.getElementById('dock')._morphing) return;   // не дёргаем во время морфа
  if (arsShopPhase) {   // «В бой» из мини-магазина
    if (arsBuy && ARS_ORDER.every(k => arsBuy[k] === 0)) { arsBuy = null; arsDefense = null; }
    arsShopExit(false);   // без возврата — куплено остаётся
    startBattle();
    return;
  }
  const allPlaced = placement.pieces.every(p => p.placed);
  const anyBad = placement.pieces.some(p => p.placed && p.bad);
  if (!allPlaced || anyBad) return;
  arsShopEnter();   // арсенал есть в обоих режимах (в быстром — урезанный)
});

setTimeout(() => { try { syncMenuVersion(!document.getElementById('menu').classList.contains('hidden')); } catch (e) {} }, 0);
// крестик в шапке игры: с расстановки (и из арсенала) — выход на экран выбора режима
setTimeout(() => {
  const x = document.querySelector('#title .logo-cross');
  if (!x) return;
  x.style.cursor = 'pointer';
  x.addEventListener('click', () => {
    const onPlacement = document.getElementById('placement-screen').classList.contains('active');
    if (!onPlacement) return;   // в бою крестик не работает — чтобы не слить партию случайно
    if (arsShopPhase) arsShopExit(true);   // из арсенала — с полным возвратом XP
    state = null;
    setGameUIHidden(true);
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    renderProfile();
    document.getElementById('gametype-select').classList.remove('hidden');
  });
}, 0);
function syncMenuVersion(open) {
  const gv = document.getElementById('app-version');
  const mv = document.getElementById('menu-version');
  if (mv && gv) mv.textContent = gv.textContent;
  if (gv) gv.style.display = open ? 'none' : '';
}
function showMenu() {
  syncMenuVersion(true);
  if (state) state.over = true;   // выход в меню глушит таймеры боя
  // прячем игровой UI, чтобы под меню ничего не мелькало
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  setGameUIHidden(true);
  const menu = document.getElementById('menu');
  menu.classList.remove('hidden');
}

let gameType = 'sea';   // 'sea' | 'snake'
let currentGame = 'sea';
document.getElementById('menu-play').addEventListener('click', () => {
  syncMenuVersion(false);
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
document.getElementById('menu-friends').addEventListener('click', () => {
  syncMenuVersion(false);
  // друзья — появится позже
});
document.getElementById('menu-settings').addEventListener('click', () => {
  syncMenuVersion(false);
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
  showModeSelect();
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
  const ms = document.getElementById('mode-select');
  ms.setAttribute('data-gt', gameType);
  const title = document.getElementById('mode-title');
  if (title) title.textContent = gameType === 'snake' ? 'Выбери режим змейки' : 'Выбери режим';
  renderProfile();
  ms.classList.remove('hidden');
}
let lastMode = 'fast';
function startGameWithMode(mode) {
  currentGame = 'sea';
  lastMode = mode;
  applyMode(mode);
  document.getElementById('mode-select').classList.add('hidden');
  document.getElementById('gametype-select').classList.add('hidden');
  startPlacement();
}
document.getElementById('mode-fast').addEventListener('click', () => startGameWithMode('fast'));
document.getElementById('mode-classic').addEventListener('click', () => startGameWithMode('classic'));
document.getElementById('mode-snake-classic').addEventListener('click', () => { document.getElementById('mode-select').classList.add('hidden'); document.getElementById('gametype-select').classList.add('hidden'); startSnake(); });
document.getElementById('mode-snake-arena').addEventListener('click', () => { document.getElementById('mode-select').classList.add('hidden'); document.getElementById('gametype-select').classList.add('hidden'); startArena(); });
document.getElementById('mode-back-x').addEventListener('click', () => {
  document.getElementById('mode-select').classList.add('hidden');
  document.getElementById('opp-select').classList.remove('hidden');
});

makeParticles('mode-particles');
makeParticles('opp-particles');
makeParticles('custom-particles');
makeParticles('gametype-particles');
makeParticles('snake-particles');
makeParticles('arena-particles');
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
  const bw = r.cat === 'absolute' ? 5 : (2 + r.tier * 0.9);
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
// Фигурный декор рамки: у каждой категории своя ФОРМА (шипы, накладки, клёпки, срезы),
// тир усиливает размер/количество элементов. Рисуется SVG-слоем вокруг рамки.
function frameDecoMarkup(ri) {
  const t = ri.tier || 1, c1 = ri.c1, c2 = ri.c2;
  const P = [];
  const ring = (inset, sw, col, op) =>
    '<rect x="' + inset + '" y="' + inset + '" width="' + (100 - 2 * inset) + '" height="' + (100 - 2 * inset)
    + '" rx="' + (27 - inset * 0.5) + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" opacity="' + (op || 1) + '"/>';
  switch (ri.cat) {
    case 'bronze': {   // ромбики-заклёпки на гранях (прижаты к рамке)
      const s = 4.5 + t * 0.8;
      const pts = [[2, 50], [98, 50]]; if (t >= 2) pts.push([50, 2], [50, 98]);
      pts.forEach(p => P.push('<rect x="' + (p[0] - s / 2) + '" y="' + (p[1] - s / 2) + '" width="' + s + '" height="' + s
        + '" rx="1.4" transform="rotate(45 ' + p[0] + ' ' + p[1] + ')" fill="' + c2 + '"/>'));
      break;
    }
    case 'iron': {     // клёпки по углам, на самой рамке
      const r = 3.2 + t * 0.7;
      const pos = [[16, 16], [84, 16], [16, 84], [84, 84]];
      if (t >= 2) pos.push([50, 2], [50, 98], [2, 50], [98, 50]);
      pos.forEach(p => P.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + r + '" fill="' + c2 + '"/>'
        + '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (r * 0.42).toFixed(2) + '" fill="rgba(255,255,255,0.55)"/>'));
      break;
    }
    case 'silver': {   // изящные тонкие линии впритык к рамке (и по её лицевой стороне)
      P.push(ring(-2.5, 2, c1, 0.9));
      if (t >= 2) P.push(ring(-5, 1.3, '#ffffff', 0.5));
      if (t >= 3) P.push(ring(5.5, 1.1, '#ffffff', 0.55));
      break;
    }
    case 'gold': {     // фигурные угловые накладки по контуру рамки
      const arm = 11 + t * 4, sw = 6 + t * 0.8;
      const capD = 'M 2 ' + (2 + arm) + ' L 2 29 Q 2 2 29 2 L ' + (2 + arm) + ' 2';
      for (const rot of [0, 90, 180, 270]) {
        P.push('<path d="' + capD + '" fill="none" stroke="' + c2 + '" stroke-width="' + sw + '" stroke-linecap="round" transform="rotate(' + rot + ' 50 50)"/>');
        P.push('<path d="' + capD + '" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="' + (sw * 0.3).toFixed(2) + '" stroke-linecap="round" transform="rotate(' + rot + ' 50 50)"/>');
      }
      break;
    }
    case 'diamond': {  // срезы-фасеты, прижатые к углам
      const off = 28 + t * 2, sw = 4 + t;
      const cut = rot => '<line x1="-2" y1="' + off + '" x2="' + off + '" y2="-2" stroke="' + c1
        + '" stroke-width="' + sw + '" stroke-linecap="round" transform="rotate(' + rot + ' 50 50)"/>';
      P.push(cut(0), cut(90), cut(180), cut(270));
      if (t >= 3) {
        const cut2 = rot => '<line x1="4" y1="' + (off - 6) + '" x2="' + (off - 6) + '" y2="4" stroke="' + c2
          + '" stroke-width="1.8" stroke-linecap="round" transform="rotate(' + rot + ' 50 50)"/>';
        P.push(cut2(0), cut2(90), cut2(180), cut2(270));
      }
      break;
    }
    case 'emerald': {  // ступенчатые скобы у углов, компактные
      const sw = 3.5 + t * 0.8, a = 14 + t * 2.5;
      const br = rot => '<path d="M -2 ' + a + ' H ' + (a * 0.45).toFixed(1) + ' V ' + (a * 0.45).toFixed(1) + ' H ' + a
        + ' V -2" fill="none" stroke="' + c2 + '" stroke-width="' + sw + '" stroke-linejoin="round" stroke-linecap="round" transform="rotate(' + rot + ' 50 50)"/>';
      P.push(br(0), br(90), br(180), br(270));
      break;
    }
    case 'ruby': {     // аккуратные шипы-маркизы, едва выступают
      const len = 4 + t, hw = 5 + t * 0.5;
      const sp = rot => '<polygon points="' + (50 - hw) + ',3 ' + (50 + hw) + ',3 50,' + (-len)
        + '" fill="' + c1 + '" transform="rotate(' + rot + ' 50 50)"/>';
      P.push(sp(0), sp(90), sp(180), sp(270));
      if (t >= 3) {
        const sp2 = rot => '<polygon points="47.5,1.5 52.5,1.5 50,-3.5" fill="' + c2 + '" transform="rotate(' + (rot + 45) + ' 50 50)"/>';
        P.push(sp2(0), sp2(90), sp2(180), sp2(270));
      }
      break;
    }
    case 'brilliant': {// сияющие компактные шипы из углов
      const len = 4 + t;
      const k = rot => '<polygon points="9,2 2,9 ' + (-len) + ',' + (-len) + '" fill="' + c1 + '" transform="rotate(' + rot + ' 50 50)"/>';
      P.push(k(0), k(90), k(180), k(270));
      if (t >= 2) {
        const m = rot => '<polygon points="46.5,1.5 53.5,1.5 50,' + (-3 - t) + '" fill="' + c2 + '" transform="rotate(' + rot + ' 50 50)"/>';
        P.push(m(0), m(90), m(180), m(270));
      }
      break;
    }
    case 'absolute': { // корона коротких лучей всех цветов
      const cols = ['#ff5d8f', '#ffbf4d', '#4fcac4', '#6c80f5'];
      for (let i = 0; i < 8; i++)
        P.push('<polygon points="46,1.5 54,1.5 50,-7" fill="' + cols[i % 4] + '" transform="rotate(' + (i * 45) + ' 50 50)"/>');
      break;
    }
  }
  return P.join('');
}
function styleFrame(el, ri, noGlow) {
  if (!el) return;
  el.style.position = 'relative';   // декор позиционируется от рамки (важно для #ov-frame и любых хостов)
  el.style.padding = ri.bw + 'px';
  const glow = (ri.tier === 3 || ri.cat === 'absolute') ? 15 : (ri.tier === 2 ? 10 : 6);
  let shadow = noGlow
    ? '0 0 0 0 transparent'
    : '0 0 ' + glow + 'px ' + hexA(ri.c1, 0.55) + ', 0 4px 14px -6px ' + hexA(ri.c1, 0.5);
  if (ri.tier === 2) shadow += ', inset 0 0 0 1px rgba(255,255,255,0.30)';
  if (ri.tier === 3) shadow += ', inset 0 0 0 1.5px rgba(255,255,255,0.5)';
  if (ri.cat === 'absolute') shadow += ', inset 0 0 0 1.5px rgba(255,255,255,0.65)';
  el.style.boxShadow = shadow;
  if (ri.cat === 'absolute') {
    el.classList.add('absolute-frame');
    el.style.background = 'conic-gradient(from 0deg,#ff5d8f,#ffbf4d,#4fcac4,#6c80f5,#ff5d8f)';
  } else {
    el.classList.remove('absolute-frame');
    el.style.background = 'linear-gradient(135deg,' + ri.c1 + ',' + ri.c2 + ')';
  }
  let deco = null;
  for (let i = 0; i < el.children.length; i++) if (el.children[i].classList && el.children[i].classList.contains('pf-frame-deco')) { deco = el.children[i]; break; }
  if (!deco) {
    deco = document.createElementNS('http://www.w3.org/2000/svg', 'svg');   // svgEl объявлен ниже — нельзя
    deco.setAttribute('class', 'pf-frame-deco');
    deco.setAttribute('viewBox', '-14 -14 128 128');
    el.insertBefore(deco, el.firstChild);
  }
  const key = ri.cat + '_' + ri.tier;
  if (deco._k !== key) { deco._k = key; deco.innerHTML = frameDecoMarkup(ri); }
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
const PF_GAP = 0;
function pfWindows() { return Array.prototype.slice.call(document.querySelectorAll('.pf-window')); }
function pfSlideEl(idx, cur) {
  const r = RANKS[idx];
  const ri = mkRI(idx, idx === cur.index ? cur.into : 0, r.need);
  const el = document.createElement('div');
  el.className = 'pf-slide';
  el.innerHTML = '<div class="pf-info"><span class="pf-name"></span><span class="pf-rank"></span>'
    + '<div class="pf-xp"><span class="pf-xp-fill"></span></div></div>'
    + '<div class="pf-frame"><div class="pf-avatar"></div></div>';
  el.querySelector('.pf-name').textContent = pfDisplayName();
  setAvatar(el.querySelector('.pf-avatar'));
  styleFrame(el.querySelector('.pf-frame'), ri, true);   // в карусели — без наружного свечения (режется краем окна)
  const rk = el.querySelector('.pf-rank'); rk.textContent = ri.name; rk.style.color = ri.c1;
  const fill = el.querySelector('.pf-xp-fill');
  const frac = (idx === cur.index) ? cur.frac : 1;   // чужие ранги — полная полоса (виден их цвет)
  fill.style.width = (frac * 100) + '%';
  fill.style.background = 'linear-gradient(90deg,' + ri.c1 + ',' + ri.c2 + ')';
  return el;
}
function pfLayout(win, animate) {
  const vp = win._vp, track = win._track;
  if (!vp || !track || !track.children.length) return;
  const Vw = vp.clientWidth; if (!Vw) return;   // окно скрыто — посчитаем при показе
  const Cw = Vw;   // карточка на всю ширину — соседи не выглядывают
  if (track._cwSet !== Cw) {   // ширины ставим только при первом показе/resize
    track._cwSet = Cw;
    for (let i = 0; i < track.children.length; i++) track.children[i].style.width = Cw + 'px';
  }
  track._cw = Cw; track._step = Cw + PF_GAP;
  if (track._actSet !== pfIndex) {   // классы трогаем только при смене индекса
    track._actSet = pfIndex;
    for (let i = 0; i < track.children.length; i++) track.children[i].classList.toggle('pf-active', i === pfIndex);
  }
  const tx = -(pfIndex * track._step) + (Vw - Cw) / 2;
  track.style.transition = animate ? 'transform 0.32s cubic-bezier(.22,.9,.32,1)' : 'none';
  track.style.transform = 'translateX(' + Math.round(tx) + 'px)';   // целые px — сосед не выглядывает полоской
  track._tx = tx;
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
function pfGoto(idx, animate) {
  const old = pfIndex;
  pfIndex = Math.max(0, Math.min(RANKS.length - 1, idx));
  pfWindows().forEach(w => pfLayout(w, animate !== false));
  pfUpdateScrollbar();
  if (pfIndex !== old) { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch (e) {} }
}
function pfBindDrag(win) {
  if (win._pfDrag) return; win._pfDrag = true;
  let sx = 0, sy = 0, startTx = 0, dragging = false, horiz = null;
  const begin = (x, y) => {
    const track = win._track; if (!track) return;
    sx = x; sy = y; startTx = track._tx || 0; dragging = true; horiz = null;
  };
  const move = (x, y) => {
    if (!dragging) return;
    const track = win._track, vp = win._vp;
    const dx = x - sx, dy = y - sy;
    if (horiz === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) horiz = Math.abs(dx) > Math.abs(dy);
    if (!horiz) return;
    let nx = startTx + dx;
    const maxTx = (vp.clientWidth - track._cw) / 2;                       // граница слева (первый ранг)
    const minTx = -((RANKS.length - 1) * track._step) + maxTx;            // граница справа (последний)
    if (nx > maxTx) nx = maxTx + (nx - maxTx) * 0.3;                      // резинка на краях
    if (nx < minTx) nx = minTx + (nx - minTx) * 0.3;
    track.style.transition = 'none';
    track.style.transform = 'translateX(' + nx + 'px)';
  };
  const finish = x => {
    if (!dragging) return; dragging = false;
    if (!horiz) return;
    const track = win._track;
    const dx = x - sx, TH = (track && track._cw ? track._cw : 220) * 0.18;
    if (dx < -TH) pfGoto(pfIndex + 1);
    else if (dx > TH) pfGoto(pfIndex - 1);
    else pfGoto(pfIndex);   // не дотянул — плавно вернуть
  };
  win.addEventListener('touchstart', e => { const t = e.touches[0]; begin(t.clientX, t.clientY); }, { passive: true });
  win.addEventListener('touchmove', e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
  win.addEventListener('touchend', e => { const t = e.changedTouches[0]; finish(t.clientX); }, { passive: true });
  win.addEventListener('mousedown', e => begin(e.clientX, e.clientY));
  win.addEventListener('mousemove', e => { if (e.buttons) move(e.clientX, e.clientY); });
  win.addEventListener('mouseup', e => finish(e.clientX));
  win.addEventListener('mouseleave', e => { if (dragging) finish(e.clientX); });
}
function renderProfile() {
  const cur = rankInfo(getXP());
  pfIndex = cur.index;
  pfWindows().forEach(win => {
    win._vp = win.querySelector('.pf-viewport');
    win._track = win.querySelector('.pf-track');
    if (!win._vp || !win._track) return;
    win._track.innerHTML = '';
    win._track._cwSet = null; win._track._actSet = null;   // слайды новые — кэш раскладки сброшен
    for (let i = 0; i < RANKS.length; i++) {
      const sl = pfSlideEl(i, cur);
      if (i === cur.index) sl.classList.add('pf-self');
      win._track.appendChild(sl);
    }
    pfBindDrag(win);
    pfLayout(win, false);
  });
  pfUpdateScrollbar();
}
window.addEventListener('resize', () => pfWindows().forEach(w => pfLayout(w, false)));

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
  title.innerHTML = '<span class="logo-text ov-pop">' + (win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ') + '</span>';
  {  // появление: мягкий поп (масштаб + проявление), без горизонтального сдвига
    const t = title.firstChild;
    t.style.opacity = '0';
    t.style.transform = 'scale(0.86) translateY(8px)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      t.style.transition = 'opacity 0.45s ease, transform 0.55s cubic-bezier(.3,1.25,.45,1)';
      t.style.opacity = '1';
      t.style.transform = 'scale(1) translateY(0)';
    }));
  }
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
const SNAKE_TICK = 200;
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
  const bg = svgEl('g', {});
  for (let r = 0; r < SNAKE_N; r++)
    for (let col = 0; col < SNAKE_N; col++)
      bg.appendChild(svgEl('rect', { class: 'snk-bgc', x: col + 0.06, y: r + 0.06, width: 0.88, height: 0.88, rx: 0.18 }));
  const gFruit = svgEl('g', {});
  const gBody = svgEl('g', {});
  gBody.style.setProperty('--sc', c.sc); gBody.style.setProperty('--sc-h', c.sch); gBody.style.setProperty('--sc-edge', c.edge);
  const innerId = 'snake-inner-' + who;
  const inner = svgEl('g', { id: innerId });
  gBody.appendChild(inner);
  // 8 тор-клонов для бесшовного перехода через край (svg клипует лишнее)
  [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].forEach(s => {
    const u = document.createElementNS(SVGNS, 'use');
    u.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + innerId);
    u.setAttribute('href', '#' + innerId);
    u.setAttribute('transform', 'translate(' + (s[0] * SNAKE_N) + ' ' + (s[1] * SNAKE_N) + ')');
    gBody.appendChild(u);
  });
  const gMarks = svgEl('g', {});
  svg.appendChild(bg); svg.appendChild(gFruit); svg.appendChild(gBody); svg.appendChild(gMarks);
  g.appendChild(svg);
  const dimEl = document.createElement('div'); dimEl.className = 'snake-dim';
  const num = document.createElement('span'); num.className = 'snake-num';
  dimEl.appendChild(num); g.appendChild(dimEl);
  return { svg, gFruit, gBody, gMarks, inner, dim: dimEl, num };
}

function snakeMakeSide(refs, who) {
  return {
    who, base: SNAKE_BASE[who],
    svg: refs.svg, gFruit: refs.gFruit, gBody: refs.gBody, gMarks: refs.gMarks, _inner: refs.inner,
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
function snakeHeadPath(cx, cy, size, d, R, nn) {
  const x = cx - size / 2, y = cy - size / 2;
  let tl = nn, tr = nn, br = nn, bl = nn;
  if (d.c === 1) { tr = R; br = R; }
  else if (d.c === -1) { tl = R; bl = R; }
  else if (d.r === 1) { bl = R; br = R; }
  else { tl = R; tr = R; }
  return roundRectPath(x, y, size, size, tl, tr, br, bl);
}
function snakeDirAngle(d) { return d.c === 1 ? 0 : (d.r === 1 ? 90 : (d.c === -1 ? 180 : -90)); }
function snakeEyesCanonical(hitEyes) {
  // глаза в «канонических» координатах (голова смотрит вправо, центр в 0,0) — позицию/поворот даёт transform группы
  const g = svgEl('g', {});
  const eyes = [{ x: 0.16, y: -0.17, tilt: -18 }, { x: 0.16, y: 0.17, tilt: 18 }];   // наклон к голове: /\
  if (hitEyes) {
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
// Отрисовка тела с кэшем: DOM пересоздаётся только при смене длины/глаз,
// в остальных кадрах обновляются лишь атрибуты (никакого пересоздания 60 раз/сек).
// Голова/глаза в канонических координатах + плавный доворот угла — повороты мягкие.
function snakeDrawBody(group, pts, d, hitEyes, solid) {
  const n = pts.length, h = pts[0];
  const W = 0.7, EW = 0.9;
  const target = (d && typeof d.ang === 'number') ? d.ang : snakeDirAngle(d);   // арена даёт угол напрямую
  let c = group._bc;
  if (!c || c.n !== n || c.hitEyes !== hitEyes || c.solid !== solid) {
    group.innerHTML = '';
    c = group._bc = { n, hitEyes, solid, links: [], ang: target };
    if (n >= 3) { c.poly = svgEl('polyline', { class: 'snk-edge', 'stroke-width': EW, style: 'fill:none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', points: '' }); group.appendChild(c.poly); }
    c.headEdgeG = svgEl('g', {});
    c.headEdgeG.appendChild(svgEl('path', { class: 'snk-edge', 'stroke-width': 0, d: snakeHeadPath(0, 0, 0.98, { r: 0, c: 1 }, 0.49, 0.24) }));
    group.appendChild(c.headEdgeG);
    if (n >= 2) { c.tailEdge = svgEl('polygon', { class: 'snk-edge', 'stroke-width': 0.32, 'stroke-linejoin': 'round', points: '' }); group.appendChild(c.tailEdge); }
    c.headFillG = svgEl('g', {});
    c.headFill = svgEl('path', { class: 'snk-head', d: snakeHeadPath(0, 0, 0.84, { r: 0, c: 1 }, 0.42, 0.18) });
    c.headFillG.appendChild(c.headFill);
    group.appendChild(c.headFillG);
    if (solid) {
      // цельное тело: одна непрерывная линия — без «ячеек» на стыках
      c.fillPoly = svgEl('polyline', { class: 'snk-link', 'stroke-width': W, style: 'fill:none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', points: '' });
      group.appendChild(c.fillPoly);
    } else {
      for (let i = 0; i < n - 2; i++) { const lk = svgEl('line', { class: 'snk-link', 'stroke-width': W }); c.links.push(lk); group.appendChild(lk); }
    }
    if (n >= 2) { c.tailFill = svgEl('polygon', { class: 'snk-tail', 'stroke-width': 0.30, points: '' }); group.appendChild(c.tailFill); }
    c.eyesG = snakeEyesCanonical(hitEyes);
    group.appendChild(c.eyesG);
  }
  if (c.poly) c.poly.setAttribute('points', pts.slice(0, n - 1).map(p => p.x.toFixed(3) + ',' + p.y.toFixed(3)).join(' '));
  if (c.fillPoly) {
    c.fillPoly.setAttribute('points', pts.slice(0, n - 1).map(p => p.x.toFixed(3) + ',' + p.y.toFixed(3)).join(' '));
  } else for (let i = 0; i < c.links.length; i++) {
    const a = pts[i], b = pts[i + 1], lk = c.links[i];
    lk.setAttribute('x1', a.x.toFixed(3)); lk.setAttribute('y1', a.y.toFixed(3));
    lk.setAttribute('x2', b.x.toFixed(3)); lk.setAttribute('y2', b.y.toFixed(3));
  }
  if (n >= 2) {
    const tip = pts[n - 1], nb = pts[n - 2];
    let dx = tip.x - nb.x, dy = tip.y - nb.y; const ln = Math.hypot(dx, dy) || 1; dx /= ln; dy /= ln;
    const px = -dy, py = dx;
    const mkTail = (hw, ext) => {
      const b1 = [nb.x + px * hw, nb.y + py * hw], b2 = [nb.x - px * hw, nb.y - py * hw], tp = [tip.x + dx * ext, tip.y + dy * ext];
      return [b1, b2, tp].map(v => v[0].toFixed(3) + ',' + v[1].toFixed(3)).join(' ');
    };
    c.tailEdge.setAttribute('points', mkTail(0.27, 0.02));
    c.tailFill.setAttribute('points', mkTail(0.18, -0.06));
  }
  // плавный доворот головы к целевому направлению (по короткой дуге)
  let diff = ((target - c.ang + 540) % 360) - 180;
  c.ang = Math.abs(diff) < 1 ? target : c.ang + diff * 0.35;
  const tr = 'translate(' + h.x.toFixed(3) + ' ' + h.y.toFixed(3) + ') rotate(' + c.ang.toFixed(2) + ')';
  c.headEdgeG.setAttribute('transform', tr);
  c.headFillG.setAttribute('transform', tr);
  c.eyesG.setAttribute('transform', tr);
  const waveEls = [c.headFill];
  if (c.fillPoly) waveEls.push(c.fillPoly);
  else c.links.forEach(l => waveEls.push(l));
  if (c.tailFill) waveEls.push(c.tailFill);
  return waveEls;
}
function snakeMinwrap(delta, size) { let x = ((delta % size) + size) % size; if (x > size / 2) x -= size; return x; }
// тороидальная отрисовка: «разворачиваем» клетки в непрерывные виртуальные координаты,
// рисуем во внутреннюю группу; 8 <use>-клонов + клип svg дают бесшовный переход через край
function torusPaint(side, t, cols, rows) {
  if (t == null) t = 1;
  const cells = side.cells, from = side.fromCells, m = cells.length;
  if (!m || !side._inner) return;
  const Vc = [cells[0].c], Vr = [cells[0].r];
  for (let i = 1; i < m; i++) {
    Vc.push(Vc[i - 1] + snakeMinwrap(cells[i].c - cells[i - 1].c, cols));
    Vr.push(Vr[i - 1] + snakeMinwrap(cells[i].r - cells[i - 1].r, rows));
  }
  const pts = cells.map((cur, i) => {
    let fc = Vc[i], fr = Vr[i];
    if (from && i < from.length) {
      fc = Vc[i] + snakeMinwrap(from[i].c - cur.c, cols);
      fr = Vr[i] + snakeMinwrap(from[i].r - cur.r, rows);
    }
    return { x: (fc + (Vc[i] - fc) * t) + 0.5, y: (fr + (Vr[i] - fr) * t) + 0.5 };
  });
  side._waveEls = snakeDrawBody(side._inner, pts, side.dir, side.hitEyes);
}
function snakePaint(side, t) { torusPaint(side, t, SNAKE_N, SNAKE_N); }
function snakeWaveColor(side, col) {
  // волна цвета от блока столкновения (голова, i=0) к хвосту — переход вешаем инлайном
  // (в базовых правилах transition нет, чтобы плавная перерисовка кадров не мазала)
  const step = 70;
  (side._waveEls || []).forEach((el, i) => {
    el.style.transition = 'fill 0.6s ease, stroke 0.6s ease';
    el.style.transitionDelay = (i * step) + 'ms';
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'line' || tag === 'polyline') el.style.stroke = col;   // штриховые элементы (включая цельное тело)
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
  const nr = ((head.r + dir.r) % SNAKE_N + SNAKE_N) % SNAKE_N;
  const nc = ((head.c + dir.c) % SNAKE_N + SNAKE_N) % SNAKE_N;   // выход за край → возврат с другой стороны
  const willEat = side.fruit && nr === side.fruit.r && nc === side.fruit.c;
  const body = willEat ? side.cells : side.cells.slice(0, side.cells.length - 1);
  for (const p of body) if (p.r === nr && p.c === nc) return 'crash';   // смерть только от самоукуса
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
  const cellOf = d => ({ r: ((head.r + d.r) % SNAKE_N + SNAKE_N) % SNAKE_N, c: ((head.c + d.c) % SNAKE_N + SNAKE_N) % SNAKE_N });
  const safe = opts.filter(d => { const n = cellOf(d); return !occ.has(n.r + '_' + n.c); });
  const pool = safe.length ? safe : opts;
  // свободный коридор: сколько клеток подряд впереди без собственного тела
  const corridor = d => {
    let r = head.r, c = head.c, n = 0;
    for (let i = 0; i < SNAKE_N; i++) {
      r = ((r + d.r) % SNAKE_N + SNAKE_N) % SNAKE_N;
      c = ((c + d.c) % SNAKE_N + SNAKE_N) % SNAKE_N;
      if (occ.has(r + '_' + c)) break;
      n++;
    }
    return n;
  };
  // большая змея в тесноте — не лезть к фрукту в узкий карман, а переждать голодный таймер на просторе
  if (side.cells.length >= 12 && side.fruit) {
    const toFruit = pool.length ? pool.slice().sort((a, b) => {
      const na = cellOf(a), nb = cellOf(b);
      return (Math.abs(snakeMinwrap(na.r - side.fruit.r, SNAKE_N)) + Math.abs(snakeMinwrap(na.c - side.fruit.c, SNAKE_N)))
           - (Math.abs(snakeMinwrap(nb.r - side.fruit.r, SNAKE_N)) + Math.abs(snakeMinwrap(nb.c - side.fruit.c, SNAKE_N)));
    })[0] : null;
    if (toFruit && corridor(toFruit) < 3) {
      const roomy = pool.slice().sort((a, b) => corridor(b) - corridor(a));
      if (roomy.length && corridor(roomy[0]) > corridor(toFruit)) return roomy[0];
    }
  }
  if (side.fruit) {
    pool.sort((a, b) => {
      const na = cellOf(a), nb = cellOf(b);
      const da = Math.abs(snakeMinwrap(na.r - side.fruit.r, SNAKE_N)) + Math.abs(snakeMinwrap(na.c - side.fruit.c, SNAKE_N));
      const db = Math.abs(snakeMinwrap(nb.r - side.fruit.r, SNAKE_N)) + Math.abs(snakeMinwrap(nb.c - side.fruit.c, SNAKE_N));
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
  side.gBody.style.setProperty('--sc', sc);
  side.gBody.style.setProperty('--sc-h', sch || sc);
  side.gBody.style.setProperty('--sc-edge', 'color-mix(in srgb, ' + sc + ', #000 32%)');
}

// микро-тряска поля при смерти — JS-транзишены (надёжно в iOS-webview, где one-shot keyframes капризны)
function jsShake(el) {
  if (!el) return;
  const seq = ['translateX(-3px)', 'translateX(3px)', 'translateY(-2px)', 'translateX(2px)', ''];
  el.style.transition = 'transform 0.05s linear';
  seq.forEach((tr, i) => setTimeout(() => {
    el.style.transform = tr;
    if (i === seq.length - 1) setTimeout(() => { el.style.transition = ''; }, 60);
  }, i * 50));
}
function snakeCountdownOn(side, onDone) {
  const st = snakeState;
  side.dim.classList.add('show');
  let n = 3;
  const setN = v => { side.num.textContent = v; side.num.style.animation = 'none'; void side.num.offsetWidth; side.num.style.animation = ''; };
  setN(n);
  const iv = setInterval(() => {
    if (snakeState !== st || !st || st.ended) { clearInterval(iv); return; }   // игра закрыта/кончилась
    n--;
    if (n <= 0) { clearInterval(iv); side.dim.classList.remove('show'); side.num.textContent = ''; onDone(); }
    else setN(n);
  }, 1000);
}

function snakeDeath(side) {
  const st = snakeState;
  side.state = 'dying';
  side.lives--;
  side.hitEyes = true;        // глаза-крестики сразу при столкновении
  side.fromCells = null;
  snakePaint(side, 1);        // зафиксировали кадр + собрали сегменты для волны
  snakeRenderLives();
  jsShake(side.svg && side.svg.parentElement);
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
    setTimeout(() => { if (snakeState !== st) return; side.state = 'dead'; snakeCheckOver(); }, dur);
    return;
  }

  // 1-я смерть → синий (убитый), 2-я → красный (подбитый); волной от головы
  const col = SNAKE_DMG[side.lives];
  snakeWaveColor(side, col);
  snakeSetColor(side, col, col);
  setTimeout(() => {
    if (snakeState !== st || st.ended) return;   // игру закрыли/сменили, пока ждали
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
  const st = snakeState;
  const me = snakeState.me, ai = snakeState.ai;
  if (me.state === 'dead' || ai.state === 'dead') {
    snakeState.ended = true;
    snakeStop();
    const playerWon = me.state !== 'dead' && ai.state === 'dead';
    setTimeout(() => { if (snakeState === st) snakeEnd(playerWon, me.fruitsEaten, me.comboXP); }, 850);
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

// пульс истощения: тело на миг бледнеет — видно, что змейка слабеет
function snakeStarvePulse(side) {
  const g = side._inner; if (!g) return;
  g.style.transition = 'opacity 0.16s ease';
  g.style.opacity = '0.45';
  setTimeout(() => { g.style.transition = 'opacity 0.3s ease'; g.style.opacity = '1'; }, 170);
}
// смерть от истощения: три мигания и обычная смерть
function snakeStarveDeath(side) {
  if (side.state !== 'alive') return;
  side.state = 'starving';
  const g = side._inner;
  if (g) {
    const seq = [[0, '0.25'], [180, '1'], [360, '0.25'], [540, '1'], [720, '0.25']];
    seq.forEach(s => setTimeout(() => { if (g) { g.style.transition = 'opacity 0.15s ease'; g.style.opacity = s[1]; } }, s[0]));
  }
  setTimeout(() => {
    if (!snakeState || side.state !== 'starving') return;
    side.state = 'alive';   // snakeDeath сам переведёт в dying
    if (g) g.style.opacity = '1';
    snakeDeath(side);
  }, 900);
}
function snakeTick() {
  if (!snakeState || !snakeState.running) return;
  const now = snakeNow();
  [snakeState.me, snakeState.ai].forEach(side => {
    if (side.state !== 'alive') return;
    const starving = side.hungerStart && (now - side.hungerStart) >= 5000 && (now - side.lastShrink) >= 1000;
    if (starving && side.cells.length <= 2) { snakeStarveDeath(side); return; }   // смерть от истощения — без шага, с миганием
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
    if (!ate && starving) {                  // ужимание на 1 клетку/сек + пульс истощения
      side.lastShrink = now;
      side.cells.pop();
      snakeStarvePulse(side);
    }
    side.tickAt = now;   // отрисовку с интерполяцией ведёт snakeRenderLoop
  });
  updateHunger(snakeState.me);
}

function snakeEnd(win, fruits, comboXP) {
  if (!snakeState) return;   // игру уже покинули
  snakeComboReset();
  { const el = document.getElementById('snake-hunger'); if (el) el.classList.remove('show', 'urgent'); }
  document.getElementById('snake-screen').classList.add('hidden');
  setTimeout(() => { showXpResult(win, fruits, 'snake', Math.round(comboXP || 0)); launchConfetti(win); }, 90);
}

function snakeStop() {
  if (snakeState) { snakeState.running = false; clearInterval(snakeState.interval); clearInterval(snakeState.cdiv); if (snakeState._raf) cancelAnimationFrame(snakeState._raf); }
}

function startSnake() {
  currentGame = 'snake';
  snakeStop(); arenaStop();   // глушим всё прежнее (включая отсчёты)
  document.getElementById('arena-screen').classList.add('hidden');
  setGameUIHidden(true);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('opp-select').classList.add('hidden');
  const meRefs = buildSnakeGrid('snake-me', 'me');
  const aiRefs = buildSnakeGrid('snake-ai', 'ai');
  const me = snakeMakeSide(meRefs, 'me');
  const ai = snakeMakeSide(aiRefs, 'ai');
  snakeState = { running: false, ended: false, interval: null, cdiv: null, me, ai };
  const st = snakeState;
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
  st.cdiv = setInterval(() => {
    if (snakeState !== st) { clearInterval(st.cdiv); return; }   // игру сменили/закрыли — отсчёт мёртв
    n--;
    if (n <= 0) {
      clearInterval(st.cdiv); st.cdiv = null;
      me.dim.classList.remove('show'); ai.dim.classList.remove('show');
      me.num.textContent = ''; ai.num.textContent = '';
      const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      me.hungerStart = t0; ai.hungerStart = t0; me.lastShrink = 0; ai.lastShrink = 0;
      st.running = true;
      st.interval = setInterval(snakeTick, SNAKE_TICK);
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
  const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (!arrows.includes(e.key)) return;
  const inGame = (arenaState && arenaState.running) || (snakeState && snakeState.running);
  if (inGame) e.preventDefault();   // чтобы стрелки не скроллили страницу
  const set = (r, c) => { if (arenaState && arenaState.running) arenaSetDir(r, c); else snakeSetDir(r, c); };
  if (e.key === 'ArrowUp') set(-1, 0);
  else if (e.key === 'ArrowDown') set(1, 0);
  else if (e.key === 'ArrowLeft') set(0, -1);
  else if (e.key === 'ArrowRight') set(0, 1);
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

// ===================== РЕЖИМ «АРЕНА» — свободное движение, как slither.io =====================
// Непрерывные координаты на тороидальном поле 13×20: змейка плывёт под любым углом,
// поворачивает к цели с ограниченной скоростью, тело тянется по следу головы.
const ARENA_COLS = 13, ARENA_FRUITS = 2;   // вдвое меньше фруктов
let ARENA_ROWS = 20;            // подбирается под высоту экрана при полной ширине поля
const ARENA_SPEED = 5.0;        // клеток в секунду
const ARENA_TURN = 5.2;         // рад/с — мягче дуги, тела без изломов
const ARENA_SEG = 0.62;         // расстояние между сегментами тела
const ARENA_START_SEG = 5, ARENA_MAX_SEG = 20;
const ARENA_HITR = 0.6;         // радиус столкновения с телом соперника
const ARENA_EATR = 0.62;        // радиус поедания фрукта
let arenaState = null;
function arenaMod(v, s) { return ((v % s) + s) % s; }
function arenaMinwrap(d, s) { let x = arenaMod(d, s); if (x > s / 2) x -= s; return x; }
function arenaDist(ax, ay, bx, by) {   // расстояние с учётом тора
  return Math.hypot(arenaMinwrap(ax - bx, ARENA_COLS), arenaMinwrap(ay - by, ARENA_ROWS));
}

function buildArenaField() {
  const host = document.getElementById('arena-field');
  host.innerHTML = '';
  // поле во всю ширину; рядов — сколько помещается по высоте (клетки крупные)
  const holder = document.getElementById('arena-field-holder');
  const hb = holder ? holder.getBoundingClientRect() : { width: 0, height: 0 };
  if (hb.width > 0 && hb.height > 0) {
    const cell = (hb.width - 12) / ARENA_COLS;             // минус паддинг рамки
    ARENA_ROWS = Math.max(13, Math.min(20, Math.floor((hb.height - 12) / cell)));
  } else ARENA_ROWS = 20;
  host.style.aspectRatio = '';
  const svg = svgEl('svg', { class: 'arena-svg', viewBox: '0 0 ' + ARENA_COLS + ' ' + ARENA_ROWS, preserveAspectRatio: 'xMidYMid meet' });
  svg.style.aspectRatio = ARENA_COLS + ' / ' + ARENA_ROWS;   // svg сам держит пропорции — рамка без пустых полос
  // клип по границам поля: торус-клоны не видны за краями
  const defs = svgEl('defs', {});
  const cp = svgEl('clipPath', { id: 'arena-clip', clipPathUnits: 'userSpaceOnUse' });
  cp.appendChild(svgEl('rect', { x: 0, y: 0, width: ARENA_COLS, height: ARENA_ROWS, rx: 0.3 }));
  defs.appendChild(cp);
  svg.appendChild(defs);
  const clipG = svgEl('g', { 'clip-path': 'url(#arena-clip)' });
  svg.appendChild(clipG);
  const bg = svgEl('g', {});
  for (let r = 0; r < ARENA_ROWS; r++)
    for (let c = 0; c < ARENA_COLS; c++)
      bg.appendChild(svgEl('rect', { class: 'snk-bgc', x: c + 0.06, y: r + 0.06, width: 0.88, height: 0.88, rx: 0.18 }));
  const gFruit = svgEl('g', {});
  clipG.appendChild(bg); clipG.appendChild(gFruit);
  const mk = who => {
    const gBody = svgEl('g', {});
    const gMarks = svgEl('g', {});
    const cb = SNAKE_BASE[who];
    gBody.style.setProperty('--sc', cb.sc); gBody.style.setProperty('--sc-h', cb.sch); gBody.style.setProperty('--sc-edge', cb.edge);
    const inner = svgEl('g', { id: 'arena-inner-' + who });
    gBody.appendChild(inner);
    [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].forEach(s => {
      const u = document.createElementNS(SVGNS, 'use');
      u.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#arena-inner-' + who);
      u.setAttribute('href', '#arena-inner-' + who);
      u.setAttribute('transform', 'translate(' + (s[0] * ARENA_COLS) + ' ' + (s[1] * ARENA_ROWS) + ')');
      gBody.appendChild(u);
    });
    clipG.appendChild(gBody); clipG.appendChild(gMarks);
    return { gBody, gMarks, inner };
  };
  const aiR = mk('ai'), meR = mk('me');
  host.appendChild(svg);
  return { svg, gFruit, me: meR, ai: aiR };
}
function arenaMakeSide(refs, who) {
  return {
    who, base: SNAKE_BASE[who], gBody: refs.gBody, gMarks: refs.gMarks, _inner: refs.inner,
    x: 0, y: 0, ang: 0, target: 0, nSeg: ARENA_START_SEG, trail: [],
    lives: SNAKE_LIVES, state: 'alive', fruitsEaten: 0, comboXP: 0, hitEyes: false
  };
}
function arenaInitPos(side, x, y, ang) {
  side.x = x; side.y = y; side.ang = ang; side.target = ang;
  side.nSeg = ARENA_START_SEG;
  side.trail = [];
  for (let i = 0; i <= 80; i++)
    side.trail.push({ x: x - Math.cos(ang) * i * 0.2, y: y - Math.sin(ang) * i * 0.2 });
}
function hexDarken(hex, f) {   // затемнение hex-цвета на долю f (0..1)
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const d = v => Math.max(0, Math.round(v * (1 - f)));
  return '#' + ((d(n >> 16 & 255) << 16) | (d(n >> 8 & 255) << 8) | d(n & 255)).toString(16).padStart(6, '0');
}
function arenaSetColor(side, sc, sch) {
  side.gBody.style.setProperty('--sc', sc);
  side.gBody.style.setProperty('--sc-h', sch || sc);
  side.gBody.style.setProperty('--sc-edge', 'color-mix(in srgb, ' + sc + ', #000 32%)');
}
// сегменты тела: точки на следе головы через каждые ARENA_SEG
function arenaSample(side) {
  const pts = [{ x: side.x, y: side.y }];
  const tr = side.trail;
  let need = ARENA_SEG, acc = 0, k = 1;
  let px = side.x, py = side.y;
  for (let i = 0; i < tr.length && k < side.nSeg; i++) {
    const q = tr[i];
    let d = Math.hypot(q.x - px, q.y - py);
    while (d >= need && k < side.nSeg) {
      const f = need / d;
      px = px + (q.x - px) * f; py = py + (q.y - py) * f;
      pts.push({ x: px, y: py });
      k++;
      d = Math.hypot(q.x - px, q.y - py);
      need = ARENA_SEG;
    }
    need -= d;
    px = q.x; py = q.y;
  }
  while (pts.length < side.nSeg) {   // след короче нужного — достраиваем по прямой назад
    const a = pts[pts.length - 1];
    pts.push({ x: a.x - Math.cos(side.ang) * ARENA_SEG, y: a.y - Math.sin(side.ang) * ARENA_SEG });
  }
  return pts;
}
function arenaPaintFree(side) {
  const pts = arenaSample(side);
  // сдвигаем так, чтобы голова была внутри поля — тор-клоны покажут хвост с другой стороны
  const sx = arenaMod(side.x, ARENA_COLS) - side.x;
  const sy = arenaMod(side.y, ARENA_ROWS) - side.y;
  const sp = pts.map(p => ({ x: p.x + sx, y: p.y + sy }));
  side._waveEls = snakeDrawBody(side._inner, sp, { ang: side.ang * 180 / Math.PI }, side.hitEyes, true);   // цельное тело
  side._pts = sp;   // для столкновений/меток (в координатах поля со сдвигом)
}
function arenaWrappedPts(side) {
  return (side._pts || []).map(p => ({ x: arenaMod(p.x, ARENA_COLS), y: arenaMod(p.y, ARENA_ROWS) }));
}
function arenaOccupiedCells() {
  const s = new Set();
  [arenaState.me, arenaState.ai].forEach(sd => {
    if (!sd) return;
    arenaWrappedPts(sd).forEach(p => s.add(Math.floor(p.y) + '_' + Math.floor(p.x)));
  });
  arenaState.fruits.forEach(f => s.add(f.r + '_' + f.c));
  return s;
}
function arenaEnsureFruits() {
  while (arenaState.fruits.length < ARENA_FRUITS) {
    const occ = arenaOccupiedCells(); const free = [];
    for (let r = 0; r < ARENA_ROWS; r++) for (let c = 0; c < ARENA_COLS; c++) if (!occ.has(r + '_' + c)) free.push({ r, c });
    if (!free.length) break;
    arenaState.fruits.push(free[Math.floor(Math.random() * free.length)]);
  }
}
function arenaDrawFruit(burst) {
  const g = arenaState.gFruit; g.innerHTML = '';
  if (burst) g.appendChild(svgEl('circle', { class: 'snk-fruit-eat', cx: burst.c + 0.5, cy: burst.r + 0.5, r: 0.3 }));
  arenaState.fruits.forEach(f => g.appendChild(svgEl('circle', { class: 'snk-fruit-dot appear', cx: f.c + 0.5, cy: f.r + 0.5, r: 0.3 })));
}
function arenaNearestFruit(side) {
  let best = null, bd = 1e9;
  const hx = arenaMod(side.x, ARENA_COLS), hy = arenaMod(side.y, ARENA_ROWS);
  arenaState.fruits.forEach(f => {
    const d = arenaDist(hx, hy, f.c + 0.5, f.r + 0.5);
    if (d < bd) { bd = d; best = f; }
  });
  return best;
}
function arenaSafeSpawn(opp) {
  for (let tries = 0; tries < 120; tries++) {
    const x = 1.5 + Math.random() * (ARENA_COLS - 3), y = 1.5 + Math.random() * (ARENA_ROWS - 3);
    let ok = true;
    if (opp && opp.state !== 'dead') {
      for (const p of arenaWrappedPts(opp)) if (arenaDist(x, y, p.x, p.y) < 3) { ok = false; break; }
    }
    if (ok) return { x, y, ang: Math.random() * Math.PI * 2 };
  }
  return { x: ARENA_COLS / 2, y: ARENA_ROWS / 2, ang: 0 };
}
function arenaTurnToward(side, dt) {
  let diff = side.target - side.ang;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const mx = ARENA_TURN * dt;
  side.ang += Math.abs(diff) <= mx ? diff : Math.sign(diff) * mx;
}
function arenaStep(side, dt) {
  arenaTurnToward(side, dt);
  side.x += Math.cos(side.ang) * ARENA_SPEED * dt;
  side.y += Math.sin(side.ang) * ARENA_SPEED * dt;
  side.trail.unshift({ x: side.x, y: side.y });
  // подрезаем след: держим чуть больше длины тела
  const maxLen = side.nSeg * ARENA_SEG + 2;
  let acc = 0;
  for (let i = 1; i < side.trail.length; i++) {
    acc += Math.hypot(side.trail[i].x - side.trail[i - 1].x, side.trail[i].y - side.trail[i - 1].y);
    if (acc > maxLen) { side.trail.length = i + 1; break; }
  }
}
function arenaAiSteer(side) {
  const opp = side.who === 'ai' ? arenaState.me : arenaState.ai;
  const fruit = arenaNearestFruit(side);
  const hx = arenaMod(side.x, ARENA_COLS), hy = arenaMod(side.y, ARENA_ROWS);
  let want = side.ang;
  if (fruit) want = Math.atan2(arenaMinwrap(fruit.r + 0.5 - hy, ARENA_ROWS), arenaMinwrap(fruit.c + 0.5 - hx, ARENA_COLS));
  // объезд тела соперника: пробуем углы по нарастающему отклонению
  const oppPts = (opp && opp.state === 'alive') ? arenaWrappedPts(opp) : [];
  const clear = a => {
    const lx = arenaMod(hx + Math.cos(a) * 1.6, ARENA_COLS), ly = arenaMod(hy + Math.sin(a) * 1.6, ARENA_ROWS);
    for (const p of oppPts) if (arenaDist(lx, ly, p.x, p.y) < 1.0) return false;
    return true;
  };
  for (const off of [0, 0.7, -0.7, 1.5, -1.5, 2.4, -2.4]) {
    if (clear(want + off)) { side.target = want + off; return; }
  }
  side.target = want + Math.PI;   // всё занято — разворот
}
function arenaRenderLives() {
  if (!arenaState) return;
  const draw = (id, lives) => {
    const el = document.getElementById(id); if (!el) return;
    let h = ''; for (let i = 0; i < SNAKE_LIVES; i++) h += '<i class="' + (i < lives ? '' : 'lost') + '"></i>';
    el.innerHTML = h;
  };
  draw('arena-me-hearts', arenaState.me.lives);
  draw('arena-ai-hearts', arenaState.ai.lives);
}
function arenaLoop() {
  if (!arenaState) return;
  const st = arenaState;
  const now = snakeNow();
  let dt = (now - (st._t || now)) / 1000;
  st._t = now;
  if (dt > 0.05) dt = 0.05;   // вкладка спала — не телепортируем
  if (st.running && dt > 0) {
    const me = st.me, ai = st.ai;
    if (ai.state === 'alive') arenaAiSteer(ai);
    [me, ai].forEach(side => {
      if (side.state !== 'alive') return;
      arenaStep(side, dt);
      // фрукты
      const hx = arenaMod(side.x, ARENA_COLS), hy = arenaMod(side.y, ARENA_ROWS);
      for (let i = 0; i < st.fruits.length; i++) {
        const f = st.fruits[i];
        if (arenaDist(hx, hy, f.c + 0.5, f.r + 0.5) < ARENA_EATR) {
          st.fruits.splice(i, 1);
          side.nSeg = Math.min(ARENA_MAX_SEG, side.nSeg + 1);
          if (side.who === 'me') side.fruitsEaten++;
          arenaEnsureFruits();
          arenaDrawFruit({ r: f.r, c: f.c });
          try { if (side.who === 'me' && tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch (e) {}
          break;
        }
      }
    });
    // отрисовка (нужна до столкновений — она же кэширует точки тел)
    if (me.state === 'alive') arenaPaintFree(me);
    if (ai.state === 'alive') arenaPaintFree(ai);
    // столкновения: голова в теле соперника (как slither.io); лоб-в-лоб — оба
    if (me.state === 'alive' && ai.state === 'alive') {
      const mw = arenaWrappedPts(me), aw = arenaWrappedPts(ai);
      const hit = (head, pts, skipHead) => {
        for (let i = skipHead ? 1 : 0; i < pts.length; i++)
          if (arenaDist(head.x, head.y, pts[i].x, pts[i].y) < ARENA_HITR) return true;
        return false;
      };
      const headOn = arenaDist(mw[0].x, mw[0].y, aw[0].x, aw[0].y) < ARENA_HITR + 0.1;
      const meHit = headOn || hit(mw[0], aw, true);
      const aiHit = headOn || hit(aw[0], mw, true);
      if (meHit) arenaDeath(me);
      if (aiHit) arenaDeath(ai);
      // самоукус: врезался в собственный хвост — съедает себя до минимума (кругами не отсидишься)
      const selfBite = (side, pts) => {
        if (side.state !== 'alive' || side.nSeg <= 3) return;
        if (side._biteCd && now - side._biteCd < 1200) return;   // иммунитет после укуса
        const skip = Math.ceil(2.2 / ARENA_SEG);                 // ближние к голове сегменты не считаем
        for (let i = skip; i < pts.length; i++) {
          if (arenaDist(pts[0].x, pts[0].y, pts[i].x, pts[i].y) < ARENA_HITR * 0.85) {
            side._biteCd = now;
            side.nSeg = 2;                                       // съел себя до огрызка
            const g = side._inner;
            if (g) {
              g.style.transition = 'opacity 0.12s ease';
              g.style.opacity = '0.4';
              setTimeout(() => { if (g) { g.style.transition = 'opacity 0.25s ease'; g.style.opacity = '1'; } }, 130);
            }
            try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning'); } catch (e) {}
            break;
          }
        }
      };
      if (!meHit) selfBite(me, mw);
      if (!aiHit) selfBite(ai, aw);
    }
  } else {
    if (st.me.state === 'alive') arenaPaintFree(st.me);
    if (st.ai.state === 'alive') arenaPaintFree(st.ai);
  }
  st._raf = requestAnimationFrame(arenaLoop);
}
function arenaDeath(side) {
  const st = arenaState;
  side.state = 'dying';
  side.lives--;
  side.hitEyes = true;
  arenaPaintFree(side);   // зафиксировали кадр с X-глазами + сегменты для волны
  arenaRenderLives();
  jsShake(document.getElementById('arena-field'));
  try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred(side.who === 'me' ? 'warning' : 'success'); } catch (e) {}
  if (side.lives <= 0) {
    snakeWaveColor(side, 'var(--miss)');
    arenaSetColor(side, 'var(--miss)', 'var(--miss)');
    side.gMarks.innerHTML = '';   // без точек — просто серая змея
    setTimeout(() => { if (arenaState !== st) return; side.state = 'dead'; arenaCheckOver(); }, 900);
    return;
  }
  const col = SNAKE_DMG[side.lives];
  snakeWaveColor(side, col);
  arenaSetColor(side, col, col);
  setTimeout(() => {
    if (arenaState !== st || st.ended) return;
    side.gMarks.innerHTML = '';
    const opp = side.who === 'me' ? st.ai : st.me;
    const sp = arenaSafeSpawn(opp);
    arenaInitPos(side, sp.x, sp.y, sp.ang);
    side.hitEyes = false;
    side.deaths = (side.deaths || 0) + 1;
    arenaSetColor(side, side.base.sc, side.base.sch);   // тело — базового цвета
    const edges = [null, '#6c80f5', '#ff4757'];          // контур меняет цвет с каждой смертью
    const ec = edges[Math.min(side.deaths, edges.length - 1)];
    if (ec) side.gBody.style.setProperty('--sc-edge', ec);
    side.state = 'alive';
    arenaPaintFree(side);
    snakeWaveColor(side, '');   // сброс инлайновых цветов — тело берёт новый (потемневший) базовый
  }, 1100);
}
function arenaCheckOver() {
  if (!arenaState || arenaState.ended) return;
  const st = arenaState;
  const me = arenaState.me, ai = arenaState.ai;
  if (me.state === 'dead' || ai.state === 'dead') {
    arenaState.ended = true;
    arenaStop();
    const playerWon = me.state !== 'dead' && ai.state === 'dead';
    setTimeout(() => { if (arenaState === st) arenaEnd(playerWon, me.fruitsEaten, me.comboXP); }, 850);
  }
}
function arenaEnd(win, fruits, comboXP) {
  if (!arenaState) return;   // игру уже покинули
  document.getElementById('arena-screen').classList.add('hidden');
  setTimeout(() => { showXpResult(win, fruits, 'snake', Math.round(comboXP || 0)); launchConfetti(win); }, 90);
}
function arenaStop() {
  if (arenaState) { arenaState.running = false; clearInterval(arenaState.cdiv); if (arenaState._raf) cancelAnimationFrame(arenaState._raf); }
}
function arenaSetDir(r, c) {   // клавиатура: стрелки задают целевой угол
  if (!arenaState || !arenaState.running) return;
  const me = arenaState.me;
  if (me.state !== 'alive') return;
  me.target = Math.atan2(r, c);
}
function startArena() {
  currentGame = 'arena';
  snakeStop(); arenaStop();   // глушим всё прежнее (включая отсчёты)
  document.getElementById('snake-screen').classList.add('hidden');
  setGameUIHidden(true);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('mode-select').classList.add('hidden');
  document.getElementById('opp-select').classList.add('hidden');
  const refs = buildArenaField();
  const me = arenaMakeSide(refs.me, 'me'), ai = arenaMakeSide(refs.ai, 'ai');
  arenaState = { running: false, ended: false, cdiv: null, _raf: 0, _t: 0, svg: refs.svg, gFruit: refs.gFruit, me, ai, fruits: [] };
  const st = arenaState;
  arenaInitPos(me, ARENA_COLS / 2, ARENA_ROWS - 3.5, -Math.PI / 2);   // я — снизу, смотрю вверх
  arenaInitPos(ai, ARENA_COLS / 2, 3.5, Math.PI / 2);                  // соперник — сверху, вниз
  arenaEnsureFruits(); arenaDrawFruit();
  arenaPaintFree(me); arenaPaintFree(ai);
  arenaRenderLives();
  arenaState._raf = requestAnimationFrame(arenaLoop);
  document.getElementById('arena-screen').classList.remove('hidden');
  const dim = document.getElementById('arena-dim'), num = document.getElementById('arena-num');
  dim.classList.add('show');
  let n = 3;
  const setNum = v => { num.textContent = v; num.style.animation = 'none'; void num.offsetWidth; num.style.animation = ''; };
  setNum(n);
  st.cdiv = setInterval(() => {
    if (arenaState !== st) { clearInterval(st.cdiv); return; }
    n--;
    if (n <= 0) {
      clearInterval(st.cdiv); st.cdiv = null;
      dim.classList.remove('show'); num.textContent = '';
      st._t = snakeNow();
      st.running = true;
    } else setNum(n);
  }, 1000);
}
// Управление-джойстик: палец на поле задаёт направление (вектор от точки касания)
(function () {
  const el = document.getElementById('arena-center');
  if (!el) return;
  let sx = 0, sy = 0, on = false;
  const begin = (x, y) => { sx = x; sy = y; on = true; };
  const move = (x, y) => {
    if (!on || !arenaState || !arenaState.running) return;
    const me = arenaState.me;
    if (me.state !== 'alive') return;
    const dx = x - sx, dy = y - sy;
    if (Math.hypot(dx, dy) < 12) return;   // мёртвая зона
    me.target = Math.atan2(dy, dx);
  };
  el.addEventListener('touchstart', e => { const t = e.touches[0]; begin(t.clientX, t.clientY); }, { passive: true });
  el.addEventListener('touchmove', e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
  el.addEventListener('touchend', () => { on = false; }, { passive: true });
  el.addEventListener('mousedown', e => begin(e.clientX, e.clientY));
  el.addEventListener('mousemove', e => { if (e.buttons) move(e.clientX, e.clientY); });
  el.addEventListener('mouseup', () => { on = false; });
})();
document.getElementById('arena-back-x').addEventListener('click', () => {
  arenaStop();
  arenaState = null;   // гарды таймеров (arenaState !== st) отсекут отложенные итоги
  document.getElementById('arena-screen').classList.add('hidden');
  document.getElementById('gametype-select').classList.remove('hidden');
});

document.getElementById('snake-back-x').addEventListener('click', () => {
  snakeStop();
  snakeState = null;   // подвисшие таймеры смерти не покажут оверлей поверх другой игры
  document.getElementById('snake-screen').classList.add('hidden');
  document.getElementById('gametype-select').classList.remove('hidden');
});