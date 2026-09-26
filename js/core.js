// core.js — ユーティリティ / 状態 / 永続データ / 入力 / 演出ヘルパー / 空間グリッド / 描画プリミティブ
'use strict';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const d2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const fmtTime = t => String((t / 60) | 0).padStart(2, '0') + ':' + String((t % 60) | 0).padStart(2, '0');
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

// ============================================================
// 状態
// ============================================================
let state = 'title'; // title | play | levelup | chest | pause | over | victory | shop
let S = null, P = null;
let enemies = [], projs = [], eprojs = [], gems = [], drops = [], props = [];
let parts = [], floats = [], rings = [], zones = [], slashes = [], bolts = [], warns = [], flashes = [];
let hazards = []; // ボスが設置する床・フィールド(粘液 / 衝撃波 / スロウタイム)
let nextId = 1;
const cam = { x: 0, y: 0, shake: 0, sx: 0, sy: 0 };

// ---------- 永続データ(ゴールド・永続強化・記録) ----------
const META = (() => {
  const def = { gold: 0, up: {}, best: { time: 0, kills: 0, level: 0 }, runs: 0 };
  let m;
  try { m = Object.assign(def, JSON.parse(localStorage.getItem('ps55_meta') || '{}')); } catch (e) { m = def; }
  for (const k in m.up) if (!DATA.meta[k]) delete m.up[k]; // 廃止された項目(不死鳥など)
  return m;
})();
function saveMeta() { try { localStorage.setItem('ps55_meta', JSON.stringify(META)); } catch (e) { /* 保存不可でも続行 */ } }
const metaLv = k => META.up[k] || 0;
const metaMax = k => DATA.meta[k].costs.length;
const metaCost = k => DATA.meta[k].costs[metaLv(k)];
// 購入済みの永続強化をすべて返金してリセット
function metaRefund() {
  let back = 0;
  for (const k in META.up) { const c = DATA.meta[k] ? DATA.meta[k].costs : []; for (let i = 0; i < META.up[k]; i++) back += c[i] || 0; }
  META.gold += back; META.up = {};
  saveMeta();
  return back;
}

// ============================================================
// 入力
// ============================================================
const keys = {};
const touch = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
addEventListener('keydown', e => {
  keys[e.code] = true;
  // ダッシュは押した瞬間のみ受け付ける(長押し・キーリピートで連続発動させない)
  if (e.code === 'Space' && !e.repeat && state === 'play') keys._dash = true;
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && state === 'play') toggleAim();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  AudioMan.unlock();
  if (typeof onKey === 'function') onKey(e);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') pauseGame(); });
addEventListener('pointerdown', () => AudioMan.unlock());

// タッチ: 画面左半分で仮想スティック / 右半分タップでダッシュ
const cvsEl = document.getElementById('game');
cvsEl.addEventListener('touchstart', e => {
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.6 && !touch.active) { Object.assign(touch, { active: true, id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 }); }
    else keys._dash = true;
  }
  e.preventDefault();
}, { passive: false });
cvsEl.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) if (t.identifier === touch.id) {
    touch.dx = clamp((t.clientX - touch.ox) / 40, -1, 1); touch.dy = clamp((t.clientY - touch.oy) / 40, -1, 1);
  }
  e.preventDefault();
}, { passive: false });
cvsEl.addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.active = false; touch.dx = touch.dy = 0; } });

// マウス位置(内部解像度の画面座標)。Shift でマウス照準モードを切り替える
const mouse = { x: 0, y: 0, aim: false };
function toggleAim() {
  mouse.aim = !mouse.aim;
  UI.announce(mouse.aim ? 'マウス照準 ON' : '自動照準', mouse.aim ? 'SHIFT で自動照準に戻す' : '');
  AudioMan.click();
}
addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  const r = cvsEl.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) / GFX.PX; mouse.y = (e.clientY - r.top) / GFX.PX;
});
// 照準点(ワールド座標)。マウス照準モードでなければ null(従来の自動照準)
const mouseAimPt = () => (mouse.aim ? { x: cam.x + mouse.x, y: cam.y + mouse.y } : null);

function moveInput() {
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x--;
  if (keys.KeyD || keys.ArrowRight) x++;
  if (keys.KeyW || keys.ArrowUp) y--;
  if (keys.KeyS || keys.ArrowDown) y++;
  if (touch.active) { x += touch.dx; y += touch.dy; }
  const l = Math.hypot(x, y);
  return l > 1 ? [x / l, y / l] : [x, y];
}

// ============================================================
// 演出ヘルパー
// ============================================================
const MAX_PARTS = 2600;
// 汎用パーティクル: glow=true でグロー層にも描画(ブルームの光源になる)
function part(x, y, vx, vy, life, col, o = {}) {
  if (parts.length >= MAX_PARTS) parts.shift();
  parts.push({ x, y, vx, vy, t: 0, life, col, sz: o.sz || 1, g: o.g || 0, drag: o.drag ?? 2.5, glow: !!o.glow, shrink: !!o.shrink, up: o.up || 0 });
}
function burst(x, y, n, cols, o = {}) {
  const sp = o.sp || 60;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(sp * 0.25, sp);
    part(x, y, Math.cos(a) * s, Math.sin(a) * s - (o.up || 0), rand(0.3, o.life || 0.7), pick(cols), o);
  }
}
// k: 表示倍率(クリティカルは 1.2)
function addFloat(x, y, txt, col, scale = 1, vy = -30, k = 1) {
  if (floats.length > 140) floats.shift();
  floats.push({ x: x + rand(-3, 3), y, vy, t: 0, img: ART.text(txt, col, scale), k, life: k > 1 ? 0.8 : 0.6 });
}
// イージング
const easeOutCubic = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeOutBack = t => { t = clamp(t, 0, 1); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function addRing(x, y, r, col, o = {}) { rings.push({ x, y, r0: o.r0 || 2, r, t: 0, life: o.life || 0.4, col, w: o.w || 1 }); }
function addFlash(x, y, r, col, life = 0.25) { flashes.push({ x, y, r, col, t: 0, life }); }
function shake(n) { cam.shake = Math.max(cam.shake, n); }
function hitstop(t) { S.freeze = Math.max(S.freeze, t); }
function slowmo(k, dur) { S.ts = k; S.tsBack = dur; }
function screenFlash(a, col = '#ffffff') { GFX.fx.flash = Math.max(GFX.fx.flash, a); GFX.fx.flashCol = hexRgb(col); }
function shockAt(x, y, k = 1, spd = 0.9) { GFX.shock(x - cam.x, y - cam.y, k, spd); }
const onScreen = (x, y, m = 16) => x > cam.x - m && x < cam.x + GFX.VW + m && y > cam.y - m && y < cam.y + GFX.VH + m;

// ============================================================
// 空間グリッド(敵の近傍検索)
// ============================================================
const CELL = 24;
const grid = new Map();
const gkey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
function buildGrid() {
  grid.clear();
  for (const e of enemies) {
    if (e.dead) continue;
    const k = gkey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
    let c = grid.get(k);
    if (!c) grid.set(k, c = []);
    c.push(e);
  }
}
function forEachNear(x, y, r, cb) {
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const c = grid.get(gkey(cx, cy));
    if (!c) continue;
    for (let i = 0; i < c.length; i++) {
      const e = c[i];
      if (e.dead) continue;
      const rr = r + e.r;
      if (d2(x, y, e.x, e.y) <= rr * rr) if (cb(e) === false) return;
    }
  }
}
function nearestEnemy(x, y, maxD = 200, skip) {
  let best = null, bd = maxD * maxD;
  for (const e of enemies) {
    if (e.dead || e === skip || e.hidden) continue;
    const d = d2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ============================================================
// 描画プリミティブ(すべて整数ピクセル。円は中点円アルゴリズム)
// ============================================================
function pCircle(x, cx, cy, r, col, step = 1) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  if (r <= 0) return;
  x.fillStyle = col;
  let px = r, py = 0, err = 1 - r, i = 0;
  while (px >= py) {
    if (i++ % step === 0) {
      x.fillRect(cx + px, cy + py, 1, 1); x.fillRect(cx - px, cy + py, 1, 1);
      x.fillRect(cx + px, cy - py, 1, 1); x.fillRect(cx - px, cy - py, 1, 1);
      x.fillRect(cx + py, cy + px, 1, 1); x.fillRect(cx - py, cy + px, 1, 1);
      x.fillRect(cx + py, cy - px, 1, 1); x.fillRect(cx - py, cy - px, 1, 1);
    }
    py++;
    if (err < 0) err += 2 * py + 1; else { px--; err += 2 * (py - px) + 1; }
  }
}
function pDisc(x, cx, cy, r, col) {
  cx = Math.round(cx); cy = Math.round(cy);
  x.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    x.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}
// 市松ディザで半透明円(ドット絵らしい半透明表現)
function pDither(x, cx, cy, r, col, phase = 0) {
  cx = Math.round(cx); cy = Math.round(cy);
  x.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    for (let dx = -w + ((dy + cy + cx + w + phase) & 1); dx <= w; dx += 2) x.fillRect(cx + dx, cy + dy, 1, 1);
  }
}
function pLine(x, x0, y0, x1, y1, col, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  x.fillStyle = col;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  const o = (w - 1) >> 1;
  for (;;) {
    x.fillRect(x0 - o, y0 - o, w, w);
    if ((x0 === x1 && y0 === y1) || n++ > 2000) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// スプライト描画(中心基準)。発光ピクセルはグロー層にも重ねる
function drawSp(sp, x, y, o = {}) {
  const img = o.white ? (o.flip ? ART.variant(sp, 'whiteFlip') : ART.variant(sp, 'white')) : o.flip ? ART.variant(sp, 'flip') : sp.c;
  const sc = o.scale || 1, sy = o.sy || 1;
  const w = sp.w * sc * (o.sxk || 1), h = sp.h * sc * sy;
  const dx = Math.round(x - cam.x - w / 2), dy = Math.round(y - cam.y + sp.h * sc / 2 - h);
  const sx = GFX.sctx;
  if (o.alpha !== undefined) sx.globalAlpha = o.alpha;
  sx.drawImage(img, dx, dy, Math.round(w), Math.round(h));
  sx.globalAlpha = 1;
  if (sp.e && o.emit !== false) {
    const e = o.flip ? ART.variant(sp, 'flipE') : sp.e;
    GFX.gctx.globalAlpha = o.emitA ?? 0.9;
    GFX.gctx.drawImage(o.white ? img : e, dx, dy, Math.round(w), Math.round(h));
    GFX.gctx.globalAlpha = 1;
  }
}
function drawRot(key, ang, x, y, o = {}) {
  const fr = ART.ROT[key], n = fr.length;
  const i = ((Math.round(ang / TAU * n) % n) + n) % n;
  const img = fr[i], sc = o.scale || 1;
  const dx = Math.round(x - cam.x - img.width * sc / 2), dy = Math.round(y - cam.y - img.height * sc / 2);
  GFX.sctx.drawImage(img, dx, dy, img.width * sc, img.height * sc);
  const e = ART.ROT[key + 'E'];
  if (e || o.glowAll) { GFX.gctx.globalAlpha = o.emitA ?? 0.8; GFX.gctx.drawImage(e ? e[i] : img, dx, dy, img.width * sc, img.height * sc); GFX.gctx.globalAlpha = 1; }
}
// ライトマップへ光源を置く(ライト層は半解像度)
function addLight(x, y, r, col, a = 1) {
  const lx = GFX.lctx;
  lx.globalAlpha = a;
  lx.drawImage(ART.light(col), (x - cam.x - r) / 2, (y - cam.y - r) / 2, r, r);
}
