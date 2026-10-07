// skillfx.js — E / Q スキルの演出(足元の陣・光芒・集中線・光の柱・きらめき・地面の跡)
//   すべて自分の攻撃の層に描く(render.js が mineOn の間に drawSkillFx を呼ぶ)。濃さ設定(SET.fxA)とグラフィック品質に従う
//   光の層(gctx)は透明度が効かず色だけで明るさが決まるので、光らせる量は dimCol で色を暗くして決める
//   演出の時刻はゲーム時間(updFx で進む。ヒットストップ・スローで一緒に止まる)
'use strict';

// ---------- 色 ----------
const DIM_CACHE = new Map();
// 光の層用に色を暗くする(k = 0..1。0.05 刻み)
function dimCol(col, k) {
  k = Math.round(clamp(k, 0, 1) * 20) / 20;
  const key = col + k;
  let c = DIM_CACHE.get(key);
  if (!c) {
    const n = parseInt(col.slice(1), 16);
    c = `rgb(${Math.round((n >> 16) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
    DIM_CACHE.set(key, c);
  }
  return c;
}
const fxN = n => Math.max(1, Math.round(n * Math.min(1, 0.4 + gq().parts))); // 本数を画質で減らす

// ---------- クラスごとの陣の形 ----------
//   rune: 魔法陣(外の二重円・ルーンの銘・内の円・星形) / aura: 気の輪(破線の輪が回り、外から内へ気の筋が集まる)
//   n / step: 星形の頂点の数と結ぶ間隔(5 / 2 = 五芒星)。mark: 中の模様(cross 十字 / snow 雪の結晶 / reticle 照準 / spokes 放射 / cracks 地割れ)
//   飾り: flame 縁に揺れる炎 / crackle 縁を走る稲妻 / wisps 縁を回る鬼火 / stars 中に瞬く星
//   hi: 白く光らせる所(星形の頂点・中心・放つ瞬間)の色。白や淡い色を使わないクラス(ブラッドアサシンの血の色・ネクロマンサーの濃い紫など)は芯の色
const SIGIL = {
  samurai: { style: 'aura', mark: 'spokes', n: 8 },
  mage: { style: 'rune', n: 5, step: 2 },
  archer: { style: 'aura', mark: 'reticle' },
  knight: { style: 'rune', mark: 'cross' },
  pyro: { style: 'rune', n: 5, step: 2, flame: true },
  cryo: { style: 'rune', mark: 'snow' },
  electro: { style: 'rune', n: 6, step: 2, crackle: true },
  cleric: { style: 'rune', n: 8, step: 3 },
  assassin: { style: 'rune', n: 5, step: 2, hi: '#d0142a' },
  necro: { style: 'rune', n: 5, step: 2, wisps: true, hi: '#c8b4ff' },
  astro: { style: 'rune', n: 7, step: 3, stars: true, hi: '#ffd8f2' },
  berserker: { style: 'aura', mark: 'cracks', n: 6, hi: '#b8402a' },
  weaponmaster: { style: 'aura', mark: 'spokes', n: 8 },
};

// ---------- 作る ----------
// 共通: t(秒。負の値は遅れて出る)/ life / follow(x, y を持つもの。ついていく)+ ox, oy
function fxAdd(kind, o) {
  if (sfx.length > 160) sfx.splice(Math.max(0, sfx.findIndex(f => f.kind !== 'decal')), 1); // 多すぎるときは地面の跡以外の古いものから
  const f = Object.assign({ kind, t: 0, life: 0.5, seed: Math.random() * 1000 }, o);
  if (f.follow) { f.x = f.follow.x + (f.ox || 0); f.y = f.follow.y + (f.oy || 0); }
  sfx.push(f);
  return f;
}
// 陣: 足元・照準位置に描く円。wu 秒かけて開いて明るくなり(溜め)、wu を過ぎると一瞬白く光って広がりながら消える(放つ)
//   r: 半径 / col: 色 / sq: 縦のつぶれ(地面を斜めから見た形。照準の範囲を示すときは 1)/ spin: 回る速さ / glow: 光の強さ / dim: 全体の濃さ
//   形は o.style を渡せばそれ(クラスの飾りは付けない)、なければクラスの形(SIGIL)
function fxSigil(x, y, r, col, o = {}) {
  return fxAdd('sigil', Object.assign({ x, y, r, col, wu: 0.3, life: 0.65, sq: 0.5, spin: 1.2, glow: 0.6, rot0: Math.random() * TAU }, o.style ? {} : SIGIL[P.cls] || SIGIL.mage, o));
}
// 光芒: 点から放射状に伸びる光の筋(炸裂の瞬間)。n: 本数 / r: 長さ / core: 根元の色 / r0: 根元の半径(中心は空けて、重なって白く飛ばないように)
function fxRays(x, y, r, col, o = {}) {
  return fxAdd('rays', Object.assign({ x, y, r, col, core: col, n: 12, life: 0.35, sq: 1, spin: 0.6, a0: Math.random() * TAU, r0: Math.max(5, r * 0.12) }, o, { n: fxN(o.n || 12) }));
}
// 集中線: 画面の縁から (x, y) へ集まる細い線(Q の構え)。画面の座標で描く
function fxFocus(x, y, life, col, o = {}) {
  return fxAdd('focus', Object.assign({ x, y, life, col, n: 34 }, o, { n: fxN(o.n || 34) }));
}
// 光の柱: 天から降りる光(up: 地面から立ちのぼる炎の柱)。w: 半幅 / H: 高さ / core: 芯の色 / wob: 揺らぎ / zig: 稲妻のジグザグ / drop: 降りてくる時間
function fxBeam(x, y, o = {}) {
  return fxAdd('beam', Object.assign({ x, y, w: 4, H: 150, col: '#ffe38a', mid: null, core: '#ffffff', life: 0.5, drop: 0.07, wob: 0, zig: 0, up: false }, o));
}
// きらめき: 4方向の光の十字(大きくなって消える)。core: 中心の色
function fxGlint(x, y, r, col, o = {}) {
  return fxAdd('glint', Object.assign({ x, y, r, col, core: '#ffffff', life: 0.25 }, o, { core: o.core || '#ffffff' }));
}
// 地面の跡(数秒で消える): scorch 焦げ跡と燻る火の粉 / crack 地割れ(芯が赤熱して冷える)/ frost 霜の結晶 / scar 斬撃の跡(o.hx, o.hy: 中心から端までの向きと長さ)
//   col: 焦げ・ひびの色 / hot: 光る芯・火の粉の色
function fxDecal(x, y, r, type, o = {}) {
  if (gq().parts < 0.5 && type !== 'crack') return null; // 画質「低」では地割れだけ
  const f = fxAdd('decal', Object.assign({ x, y, r, type, life: 3, col: '#140c08', hot: '#ff8a3d', heatT: 0.9 }, o));
  const rnd = (() => { let s = f.seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })(); // 形は作るときに決める(毎フレーム揺れない)
  if (type === 'scorch') {
    f.blobs = []; f.embers = [];
    for (let i = 0; i < 7; i++) { const a = rnd() * TAU, d = rnd() * r * 0.45; f.blobs.push([Math.cos(a) * d, Math.sin(a) * d * 0.6, r * (0.3 + 0.3 * rnd())]); }
    for (let i = 0; i < 10; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * r * 0.85; f.embers.push([Math.cos(a) * d, Math.sin(a) * d * 0.6, rnd() * 6]); }
  } else if (type === 'crack') {
    f.lines = [];
    const n = o.n || 6;
    for (let i = 0; i < n; i++) {
      let a = (i + rnd() * 0.6) / n * TAU, x0 = Math.cos(a) * 2, y0 = Math.sin(a) * 2 * 0.6;
      const pts = [[x0, y0]], L = r * (0.55 + 0.5 * rnd());
      for (let d = 0; d < L; d += 3) { a += (rnd() - 0.5) * 0.9; x0 += Math.cos(a) * 3; y0 += Math.sin(a) * 3 * 0.6; pts.push([x0, y0]); }
      f.lines.push(pts);
    }
  } else if (type === 'frost') {
    f.lines = [];
    const n = o.n || 8;
    for (let i = 0; i < n; i++) {
      const a = (i + rnd() * 0.3) / n * TAU, L = r * (0.6 + 0.4 * rnd()), c = Math.cos(a), s = Math.sin(a) * 0.6;
      f.lines.push([[0, 0], [c * L, s * L]]);
      for (const u of [0.45, 0.7]) for (const sd of [-1, 1]) { const b = a + sd * 0.7, l = L * 0.22; f.lines.push([[c * L * u, s * L * u], [c * L * u + Math.cos(b) * l, s * L * u + Math.sin(b) * l * 0.6]]); }
    }
  }
  return f;
}

// ---------- 更新 ----------
function updSkillFx(dt) {
  for (let i = sfx.length - 1; i >= 0; i--) {
    const f = sfx[i];
    f.t += dt;
    if (f.follow) { f.x = f.follow.x + (f.ox || 0); f.y = f.follow.y + (f.oy || 0); }
    if (f.t >= f.life) sfx.splice(i, 1);
  }
}

// ---------- 描く ----------
// layer: 0 = 地面の跡(ゾーンより下)/ 1 = 陣(ゾーンの上・敵より奥)/ 2 = 手前(光芒・光の柱・きらめき)/ 3 = 画面(集中線)
//   front: 陣を手前に描く(空に浮かぶ陣など)
const SFX_LAYER = { decal: 0, sigil: 1, rays: 2, beam: 2, glint: 2, focus: 3 };
function drawSkillFx(layer) {
  if (!sfx.length || P.dead) return;
  const sx = GFX.sctx, gx = GFX.gctx;
  for (const f of sfx) {
    if (f.t < 0 || (f.front ? 2 : SFX_LAYER[f.kind]) !== layer) continue;
    if (f.kind === 'decal') drawDecal(f, sx, gx);
    else if (f.kind === 'sigil') drawSigil(f, sx, gx);
    else if (f.kind === 'rays') drawRays(f, sx, gx);
    else if (f.kind === 'beam') drawBeam(f, sx, gx);
    else if (f.kind === 'glint') drawGlint(f, sx, gx);
    else if (f.kind === 'focus') drawFocus(f, sx);
  }
  sx.globalAlpha = gx.globalAlpha = 1;
}
// 楕円を 1ドットずつ(場面と光の層へ同時に)。dash: 破線の数(0 = 実線)/ a0: 回転
function ellBoth(sx, gx, cx, cy, rx, ry, col, al, gcol, dash = 0, a0 = 0) {
  if (rx < 1) return;
  const n = Math.max(12, Math.round(TAU * Math.max(rx, ry) * 1.2));
  sx.globalAlpha = al; sx.fillStyle = col;
  if (gcol) gx.fillStyle = gcol;
  let lx = 1e9, ly = 1e9;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    if (dash && Math.floor(u * dash * 2) % 2) continue;
    const a = a0 + u * TAU, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
    if (x === lx && y === ly) continue;
    lx = x; ly = y;
    sx.fillRect(x, y, 1, 1);
    if (gcol) gx.fillRect(x, y, 1, 1);
  }
}
function lineBoth(sx, gx, x0, y0, x1, y1, col, al, gcol) {
  sx.globalAlpha = al; pLine(sx, x0, y0, x1, y1, col, 1);
  if (gcol) pLine(gx, x0, y0, x1, y1, gcol, 1);
}
// 陣
function drawSigil(f, sx, gx) {
  const T = f.t, wu = f.wu || 0, charge = wu > 0 ? Math.min(1, T / wu) : 1;
  const rel = T > wu ? (T - wu) / Math.max(0.01, f.life - wu) : 0, flash = !f.quiet && wu > 0 && T >= wu && T - wu < 0.07; // 放った瞬間は白く(quiet: 光らず広がらずに消える)
  const grow = easeOutBack(Math.min(1, T / clamp((wu || 0.2) * 0.55, 0.1, 0.3))); // 開く(溜めが長くても 0.3秒で開ききる)
  const R = f.r * (0.5 + 0.5 * grow) * (1 + (f.quiet ? 0 : 0.45 * easeOutCubic(rel))), q = f.sq, fade = (1 - rel) * (1 - rel) * (f.dim ?? 1);
  const hi = f.hi || '#ffffff', lit = (0.45 + 0.55 * charge) * fade, col = flash ? hi : f.col;
  const cx = f.x - cam.x, cy = f.y - cam.y, rot = f.rot0 + T * f.spin * (1 + 1.5 * charge);
  const G = k => dimCol(f.col, Math.min(1, k * f.glow * (flash ? 1.6 : 1) * lit));
  const al = k => Math.min(1, k * lit);
  if (f.style === 'aura') {
    ellBoth(sx, gx, cx, cy, R, R * q, col, al(0.9), G(0.75), 10, rot * 1.5);
    ellBoth(sx, gx, cx, cy, R * 0.62, R * 0.62 * q, col, al(0.6), G(0.5), 6, -rot);
    if (rel === 0) { // 外から内へ集まる気の筋
      for (let i = 0; i < 14; i++) {
        const h = hash2(i, f.seed | 0), a = h * TAU + rot * 0.2, ph = (T * 2.4 + hash2(i + 30, f.seed | 0)) % 1, d = R * (1.4 - ph), L = 2 + 3 * h;
        const c = Math.cos(a), s = Math.sin(a) * q;
        lineBoth(sx, gx, cx + c * d, cy + s * d, cx + c * (d + L), cy + s * (d + L), col, al(0.8 * Math.sin(Math.PI * ph)), G(0.6));
      }
    }
  } else { // 魔法陣
    ellBoth(sx, gx, cx, cy, R, R * q, col, al(1), G(0.8));
    ellBoth(sx, gx, cx, cy, R - 4, (R - 4) * q, col, al(0.7), G(0.5));
    const m = Math.max(8, Math.round(R * 0.9)); // ルーンの銘: 二重円の間に、目盛り・点・横棒が並ぶ(逆回り)
    sx.globalAlpha = al(0.85); sx.fillStyle = col; gx.fillStyle = G(0.45);
    for (let i = 0; i < m; i++) {
      const kind = Math.floor(hash2(i, 7) * 4);
      if (kind === 3) continue;
      const a = -rot * 0.6 + i * TAU / m, c = Math.cos(a), s = Math.sin(a);
      const pts = kind === 0 ? [[R - 3, 0], [R - 1, 0]] : kind === 1 ? [[R - 2, 0]] : [[R - 2, -0.06], [R - 2, 0.06]];
      for (const [rr, da] of pts) {
        const x = Math.round(cx + Math.cos(a + da) * rr), y = Math.round(cy + Math.sin(a + da) * rr * q);
        sx.fillRect(x, y, 1, 1); gx.fillRect(x, y, 1, 1);
      }
    }
    const ri = R * 0.62;
    ellBoth(sx, gx, cx, cy, ri, ri * q, col, al(0.6), G(0.4));
    if (f.n && !f.mark) { // 星形(溜めの間に一画ずつ描かれていく)
      const n = f.n, st = f.step || 2, shown = flash || rel > 0 ? n : Math.floor(charge * n * 1.2 + 1);
      for (let i = 0; i < Math.min(n, shown); i++) {
        const a0 = rot + i * TAU / n, a1 = rot + ((i + st) % n) * TAU / n;
        lineBoth(sx, gx, cx + Math.cos(a0) * ri, cy + Math.sin(a0) * ri * q, cx + Math.cos(a1) * ri, cy + Math.sin(a1) * ri * q, col, al(0.9), G(0.7));
      }
      sx.globalAlpha = al(1); sx.fillStyle = hi; // 頂点の光
      for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; sx.fillRect(Math.round(cx + Math.cos(a) * ri), Math.round(cy + Math.sin(a) * ri * q), 1, 1); }
    }
  }
  drawMark(f, sx, gx, cx, cy, R, rot, q, col, al, G, charge);
  // 飾り
  if (f.flame) { // 縁に揺れる炎
    for (let i = 0; i < 12; i++) {
      const a = rot * 0.5 + i * TAU / 12, x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R * q), h = 1 + Math.round(2.5 * (0.5 + 0.5 * Math.sin(T * 20 + i * 2.1)) * charge);
      sx.globalAlpha = al(0.9); sx.fillStyle = '#ffc34a'; sx.fillRect(x, y - h, 1, h);
      sx.fillStyle = '#fff6c8'; sx.fillRect(x, y - h, 1, 1); gx.fillStyle = G(0.8); gx.fillRect(x, y - h, 1, h);
    }
  }
  if (f.crackle && Math.random() < 0.5 + 0.5 * charge) { // 縁を走る稲妻(毎フレーム引き直す)
    const a = Math.random() * TAU, L = 0.5 + Math.random() * 0.5;
    let px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R * q;
    for (let k = 1; k <= 5; k++) {
      const b = a + L * k / 5, rr = R + (Math.random() - 0.5) * 5, nx = cx + Math.cos(b) * rr, ny = cy + Math.sin(b) * rr * q;
      lineBoth(sx, gx, px, py, nx, ny, '#ffffff', al(1), G(1)); px = nx; py = ny;
    }
  }
  if (f.wisps) for (let i = 0; i < 4; i++) { // 縁を回る鬼火
    const a = -rot * 1.3 + i * TAU / 4, x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R * q) - 1;
    sx.globalAlpha = al(1); sx.fillStyle = '#c8b4ff'; sx.fillRect(x, y, 1, 1); sx.fillStyle = '#8a6cff'; sx.fillRect(x - 1, y + 1, 3, 1); sx.fillRect(x, y - 1, 1, 1);
    gx.fillStyle = G(0.9); gx.fillRect(x - 1, y, 3, 2);
  }
  if (f.stars) for (let i = 0; i < 10; i++) { // 中に瞬く星
    const a = hash2(i, 3) * TAU + rot * 0.3, d = Math.sqrt(hash2(i, 5)) * R * 0.9, tw = 0.5 + 0.5 * Math.sin(T * 9 + i * 1.7);
    const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * q);
    sx.globalAlpha = al(tw); sx.fillStyle = i % 3 ? f.col : hi; sx.fillRect(x, y, 1, 1);
    gx.fillStyle = G(tw * 0.8); gx.fillRect(x, y, 1, 1);
  }
  sx.globalAlpha = 1;
  // 中心のきらめきと、陣が足元を照らす光
  if (charge >= 1 && rel < 0.35) { sx.globalAlpha = al(1); sx.fillStyle = hi; sx.fillRect(Math.round(cx) - 1, Math.round(cy), 3, 1); sx.fillRect(Math.round(cx), Math.round(cy) - 1, 1, 3); sx.globalAlpha = 1; }
  addLight(f.x, f.y, R * 3.2, f.col, Math.min(1, 0.55 * lit * (flash ? 1.8 : 1)));
}
// 陣の中の模様
function drawMark(f, sx, gx, cx, cy, R, rot, q, col, al, G, charge) {
  const ri = R * 0.62, mk = f.mark;
  if (!mk) return;
  const ln = (a0, r0, a1, r1, k = 0.9) => lineBoth(sx, gx, cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0 * q, cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1 * q, col, al(k), G(0.7 * k));
  if (mk === 'cross') { // 十字(ゆっくり回る)と中心の菱形
    for (let i = 0; i < 4; i++) { const a = rot * 0.4 + i * Math.PI / 2; ln(a, 2, a, ri * (i % 2 ? 0.75 : 1)); }
    for (let i = 0; i < 4; i++) { const a = rot * 0.4 + Math.PI / 4 + i * Math.PI / 2, b = a + Math.PI / 2; ln(a, ri * 0.3, b, ri * 0.3, 0.7); }
  } else if (mk === 'snow') { // 雪の結晶: 6本の枝に 2組の小枝
    for (let i = 0; i < 6; i++) {
      const a = rot * 0.5 + i * TAU / 6;
      ln(a, 1, a, ri * (0.5 + 0.5 * charge));
      for (const u of [0.5, 0.78]) for (const sd of [-1, 1]) {
        const bx = Math.cos(a) * ri * u, by = Math.sin(a) * ri * u, b = a + sd * 0.8, l = ri * 0.22;
        lineBoth(sx, gx, cx + bx, cy + by * q, cx + bx + Math.cos(b) * l, cy + (by + Math.sin(b) * l) * q, col, al(0.75), G(0.5));
      }
    }
  } else if (mk === 'reticle') { // 照準: 4本の目盛りが外から締まる + 中心の小さな十字
    const k = 1.35 - 0.35 * charge;
    for (let i = 0; i < 4; i++) { const a = rot * 0.25 + i * Math.PI / 2; ln(a, R * k - 4, a, R * k + 3, 1); }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ln(a, 2, a, 4, 1); }
  } else if (mk === 'spokes') { // 放射: 内の輪から外へ短い線
    const n = f.n || 8;
    for (let i = 0; i < n; i++) { const a = rot * 0.8 + i * TAU / n; ln(a, ri * 0.35, a, ri * (0.7 + 0.3 * charge), 0.85); }
  } else if (mk === 'cracks') { // 地割れ: 中心からぎざぎざに伸びる(溜まるほど長い)
    const n = f.n || 6;
    for (let i = 0; i < n; i++) {
      let a = hash2(i, f.seed | 0) * TAU, r = 2, px = cx, py = cy;
      const L = R * (0.7 + 0.4 * hash2(i + 9, f.seed | 0)) * charge;
      for (let k = 0; r < L && k < 12; k++) {
        a += (hash2(i * 13 + k, 11) - 0.5) * 0.9; r += 3;
        const nx = cx + Math.cos(a) * r, ny = cy + Math.sin(a) * r * q;
        lineBoth(sx, gx, px, py, nx, ny, col, al(0.9), G(0.8)); px = nx; py = ny;
      }
    }
  }
}
// 光芒
function drawRays(f, sx, gx) {
  const k = f.t / f.life, e = easeOutCubic(Math.min(1, f.t / (f.life * 0.3))), fade = 1 - k * k, cx = f.x - cam.x, cy = f.y - cam.y, r0 = f.r0;
  for (let i = 0; i < f.n; i++) {
    const h = hash2(i, f.seed | 0), a = f.a0 + f.spin * f.t + (i + (h - 0.5) * 0.7) / f.n * TAU;
    const L = r0 + f.r * (0.45 + 0.55 * hash2(i + 50, f.seed | 0)) * e, c = Math.cos(a), s = Math.sin(a) * f.sq, px = -s, py = c;
    for (let d = r0; d < L; d++) {
      const u = (d - r0) / Math.max(1, L - r0), al = fade * (1 - u), x = Math.round(cx + c * d), y = Math.round(cy + s * d);
      sx.globalAlpha = al * 0.7; sx.fillStyle = u < 0.22 ? f.core : f.col; sx.fillRect(x, y, 1, 1);
      if (u < 0.3) sx.fillRect(Math.round(x + px), Math.round(y + py), 1, 1); // 根元は太い
      if (u < 0.6) { gx.fillStyle = dimCol(f.col, al * 0.5); gx.fillRect(x, y, 1, 1); }
    }
  }
  sx.globalAlpha = 1;
  addLight(f.x, f.y, f.r * 2.2, f.col, 0.8 * fade);
}
// 光の柱(1行ずつ。揺らぎ・炎は行ごとに横へずらす)
function drawBeam(f, sx, gx) {
  const k = f.t / f.life, cx = Math.round(f.x - cam.x), gy = Math.round(f.y - cam.y);
  const open = easeOutCubic(Math.min(1, f.t / Math.max(0.01, f.life * 0.18))), fade = 1 - clamp((k - 0.3) / 0.7, 0, 1);
  const w = f.w * (0.45 + 0.55 * open) * (0.3 + 0.7 * fade);
  if (w < 0.3) return;
  const reach = easeOutCubic(Math.min(1, f.t / f.drop)), top = f.up ? Math.round(gy - f.H * reach) : gy - f.H, bot = f.up ? gy : Math.round(gy - f.H + f.H * reach);
  const fr = Math.floor(f.t * 30) + (f.seed | 0), zz = s => (hash2(s, fr) - 0.5) * 2 * f.zig; // 稲妻: 6行ごとの折れ点を 1/30 秒ごとに引き直す
  for (let y = Math.max(top, -2); y < Math.min(bot, GFX.VH + 2); y++) {
    const v = (y - (gy - f.H)) / f.H; // 0 = 上端 / 1 = 地面
    const sg = (y - top) / 6, s0 = Math.floor(sg);
    const wob = f.zig ? Math.round(zz(s0) + (zz(s0 + 1) - zz(s0)) * (sg - s0)) : f.wob ? Math.round(Math.sin(f.t * 24 + y * 0.45 + f.seed) * f.wob * (1 - v * 0.6)) : 0;
    const ww = Math.max(0, Math.round(w * (f.up ? 0.3 + 0.7 * v : 1))), a = fade * (f.up ? Math.min(1, v * 1.8) : Math.min(1, 0.3 + v * 1.2)); // 炎の柱は上ほど細く、先が消える
    const x0 = cx + wob;
    sx.globalAlpha = 0.3 * a; sx.fillStyle = f.col; sx.fillRect(x0 - ww - 1, y, ww * 2 + 3, 1);
    if (f.mid) { sx.globalAlpha = 0.8 * a; sx.fillStyle = f.mid; sx.fillRect(x0 - ww, y, ww * 2 + 1, 1); }
    sx.globalAlpha = a; sx.fillStyle = f.core; sx.fillRect(x0 - Math.max(0, ww - 2), y, Math.max(1, (ww - 2) * 2 + 1), 1);
    gx.fillStyle = dimCol(f.col, 0.55 * a); gx.fillRect(x0 - ww - 1, y, ww * 2 + 3, 1);
  }
  if (reach >= 1) { // 足元: 光が地面に当たって広がる
    const er = w * 2.6 + 3;
    ellBoth(sx, gx, cx, gy, er, er * 0.4, f.col, 0.7 * fade, dimCol(f.col, 0.6 * fade));
    ellBoth(sx, gx, cx, gy, er * 0.55, er * 0.22, f.core, 0.9 * fade, null);
  }
  sx.globalAlpha = 1;
  addLight(f.x, f.y - 10, f.w * 12 + 30, f.col, 0.9 * fade);
}
// きらめき
function drawGlint(f, sx, gx) {
  const k = f.t / f.life, r = Math.round(f.r * Math.sin(Math.PI * Math.min(1, k * 1.15))), x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y);
  if (r < 1) return;
  sx.globalAlpha = 1; sx.fillStyle = f.core; sx.fillRect(x, y, 1, 1);
  gx.fillStyle = dimCol(f.col, 0.9); gx.fillRect(x, y, 1, 1);
  for (let i = 1; i <= r; i++) {
    const a = 1 - i / (r + 1), d = i <= r / 2;
    sx.globalAlpha = a; sx.fillStyle = i === 1 ? f.core : f.col; gx.fillStyle = dimCol(f.col, a * 0.8);
    for (const [ox, oy] of [[i, 0], [-i, 0], [0, i], [0, -i]]) { sx.fillRect(x + ox, y + oy, 1, 1); gx.fillRect(x + ox, y + oy, 1, 1); }
    if (d && i < 3) for (const [ox, oy] of [[i, i], [-i, -i], [i, -i], [-i, i]]) sx.fillRect(x + ox, y + oy, 1, 1);
  }
  sx.globalAlpha = 1;
  addLight(f.x, f.y, f.r * 5, f.col, 0.7 * (1 - k));
}
// 集中線(1/24 秒ごとに引き直してちらつかせる)
function drawFocus(f, sx) {
  const env = Math.min(1, f.t / 0.06) * Math.min(1, (f.life - f.t) / 0.12);
  if (env <= 0) return;
  const VW = GFX.VW, VH = GFX.VH, cx = f.x - cam.x, cy = f.y - cam.y, R = Math.hypot(Math.max(cx, VW - cx), Math.max(cy, VH - cy)) + 4, fr = Math.floor(f.t * 24);
  for (let i = 0; i < f.n; i++) {
    const h = hash2(i * 7 + fr * 131, f.seed | 0), h2 = hash2(i * 13 + fr * 71, (f.seed | 0) + 9);
    const a = (i + h * 0.85) / f.n * TAU, r0 = R * (0.4 + 0.32 * h2), c = Math.cos(a), s = Math.sin(a), rm = r0 + (R - r0) * 0.35;
    sx.globalAlpha = env * (0.22 + 0.3 * h);
    pLine(sx, cx + c * r0, cy + s * r0, cx + c * rm, cy + s * rm, f.col, 1);
    pLine(sx, cx + c * rm, cy + s * rm, cx + c * R, cy + s * R, f.col, h2 > 0.6 ? 2 : 1); // 外ほど太い
  }
  sx.globalAlpha = 1;
}
// 地面の跡
function drawDecal(f, sx, gx) {
  const k = f.t / f.life, fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4, heat = Math.max(0, 1 - f.t / f.heatT), cx = f.x - cam.x, cy = f.y - cam.y;
  if (!onScreen(f.x, f.y, f.r + 8)) return;
  if (f.type === 'scorch') {
    sx.globalAlpha = 0.38 * fade;
    for (const [ox, oy, r] of f.blobs) pDisc(sx, cx + ox, cy + oy, Math.round(r * 0.6), f.col); // 小さめの円を重ねた不規則な焦げ
    sx.globalAlpha = 1;
    if (heat > 0) for (const [ox, oy, ph] of f.embers) { // 燻る火の粉(冷えて消える)
      const fl = heat * (0.55 + 0.45 * Math.sin(f.t * 10 + ph)), x = Math.round(cx + ox), y = Math.round(cy + oy);
      sx.globalAlpha = fl; sx.fillStyle = f.hot; sx.fillRect(x, y, 1, 1);
      gx.fillStyle = dimCol(f.hot, fl * 0.8); gx.fillRect(x, y, 1, 1);
    }
  } else if (f.type === 'crack') {
    for (const pts of f.lines) for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      sx.globalAlpha = 0.75 * fade; pLine(sx, cx + x0, cy + y0 + 1, cx + x1, cy + y1 + 1, f.col, 1); // 割れ目の影
      if (heat > 0) { const h = heat * (1 - i / pts.length * 0.6); sx.globalAlpha = h; pLine(sx, cx + x0, cy + y0, cx + x1, cy + y1, f.hot, 1); pLine(gx, cx + x0, cy + y0, cx + x1, cy + y1, dimCol(f.hot, h * 0.85), 1); }
    }
  } else if (f.type === 'scar') { // 斬撃の跡: 暗い溝の上で、芯の光が両端から冷えていく
    const L = Math.hypot(f.hx, f.hy) || 1, nx = -f.hy / L, ny = f.hx / L;
    sx.globalAlpha = 0.55 * fade; pLine(sx, cx - f.hx + nx, cy - f.hy + ny + 1, cx + f.hx + nx, cy + f.hy + ny + 1, f.col, 2);
    if (heat > 0) {
      const u = 0.15 + 0.85 * heat; // 光っている長さ(中心から)
      sx.globalAlpha = heat; pLine(sx, cx - f.hx * u, cy - f.hy * u, cx + f.hx * u, cy + f.hy * u, f.hot, 1);
      pLine(gx, cx - f.hx * u, cy - f.hy * u, cx + f.hx * u, cy + f.hy * u, dimCol(f.hot, heat * 0.8), 1);
    }
  } else if (f.type === 'frost') {
    sx.globalAlpha = 0.14 * fade; pDisc(sx, cx, cy, Math.round(f.r * 0.5), '#bff4ff');
    for (const [[x0, y0], [x1, y1]] of f.lines) {
      sx.globalAlpha = 0.6 * fade; pLine(sx, cx + x0, cy + y0, cx + x1, cy + y1, '#e0f8ff', 1);
      pLine(gx, cx + x0, cy + y0, cx + x1, cy + y1, dimCol('#7ad7ff', 0.45 * fade * (0.4 + 0.6 * heat)), 1);
    }
  }
  sx.globalAlpha = 1;
  if (heat > 0 && f.type !== 'frost') addLight(f.x, f.y, f.r * 2, f.hot, 0.35 * heat);
}
