// render.js — 地面チャンク生成 / エンティティ描画 / ライトマップ / FX更新
'use strict';

// ============================================================
// 地面(128px チャンクを手続き生成してキャッシュ)
// ============================================================
const CH = 128;
const groundCache = new Map();
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const s = t => t * t * (3 - 2 * t);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, s(xf)), lerp(c, d, s(xf)), s(yf));
}
// 闘技場の床: 半枚ずらしの石畳 + ひび・血痕・骨・砂溜まり
function buildTileChunk(cx, cy, st) {
  const c = ART.canvas(CH, CH), x = c.getContext('2d'), g = ART.canvas(CH, CH);
  const [g0, g1, g2, g3] = st.ground, [mortar, hi, blood, bone] = st.deco, T = 16;
  const ox = cx * CH, oy = cy * CH;
  x.fillStyle = g0; x.fillRect(0, 0, CH, CH);
  for (let ty = 0; ty < CH; ty += T) {
    const off = (((oy + ty) / T) & 1) ? T / 2 : 0;
    for (let tx = -T; tx < CH + T; tx += T) {
      const px = tx + off, h = hash2(ox + px, oy + ty);
      x.fillStyle = h < 0.3 ? g1 : h < 0.55 ? g2 : h < 0.7 ? g3 : g0; x.fillRect(px, ty, T, T);
      x.fillStyle = hi; x.globalAlpha = 0.3; x.fillRect(px + 1, ty + 1, T - 2, 1); x.globalAlpha = 1;
      x.fillStyle = mortar; x.fillRect(px, ty, T, 1); x.fillRect(px, ty, 1, T);
      if (h > 0.9) { x.fillStyle = mortar; x.fillRect(px + 4, ty + 6, 3, 1); x.fillRect(px + 6, ty + 7, 1, 3); } // 欠け
    }
  }
  for (let i = 0; i < 160; i++) { // 細かい砂粒
    x.fillStyle = hash2(ox + i * 11, oy + i * 5) < 0.5 ? g3 : g2;
    x.fillRect((hash2(i, cx * 29 + cy) * CH) | 0, (hash2(cy * 19 + i, cx) * CH) | 0, 1, 1);
  }
  for (let i = 0; i < 10; i++) {
    const hx = (hash2(cx * 97 + i, cy * 57) * (CH - 10)) | 0, hy = (hash2(cy * 89 + i, cx * 43 + i) * (CH - 10)) | 0;
    const kind = hash2(hx + ox, hy + oy);
    if (kind < 0.3) { // ひび割れ
      let lx = hx, ly = hy; x.fillStyle = mortar;
      for (let k = 0; k < 9; k++) { x.fillRect(lx, ly, 1, 1); lx += 1; ly += hash2(lx + ox, k) < 0.5 ? 1 : -1; }
    } else if (kind < 0.5) { // 血痕
      x.fillStyle = blood; x.globalAlpha = 0.55;
      x.fillRect(hx + 1, hy, 3, 1); x.fillRect(hx, hy + 1, 5, 2); x.fillRect(hx + 1, hy + 3, 2, 1); x.fillRect(hx + 6, hy + 2, 1, 1);
      x.globalAlpha = 1;
    } else if (kind < 0.62) { // 骨
      x.fillStyle = bone; x.fillRect(hx, hy + 1, 5, 1); x.fillRect(hx, hy, 1, 3); x.fillRect(hx + 4, hy, 1, 3);
    } else if (kind < 0.8) { // 砂溜まり
      x.fillStyle = g3; x.fillRect(hx, hy + 1, 6, 1); x.fillRect(hx + 1, hy, 3, 1); x.fillRect(hx + 2, hy + 2, 4, 1);
    }
  }
  return { c, g };
}
function buildChunk(cx, cy, st) {
  if (st.tiles) return buildTileChunk(cx, cy, st);
  const c = ART.canvas(CH, CH), x = c.getContext('2d');
  const g = ART.canvas(CH, CH), gx = g.getContext('2d');
  const [g0, g1, g2, g3] = st.ground, [d0, d1, d2c, d3] = st.deco;
  x.fillStyle = g0; x.fillRect(0, 0, CH, CH);
  const ox = cx * CH, oy = cy * CH;
  // 大域パッチ(2x2 ブロック単位 + 境界ディザ)
  for (let py = 0; py < CH; py += 2) for (let px = 0; px < CH; px += 2) {
    const n = valueNoise((ox + px) / 70, (oy + py) / 70) + (hash2(ox + px, oy + py) - 0.5) * 0.12;
    if (n > 0.62) { x.fillStyle = g1; x.fillRect(px, py, 2, 2); }
    else if (n < 0.32) { x.fillStyle = g2; x.fillRect(px, py, 2, 2); }
  }
  // 細かいノイズ
  for (let i = 0; i < 220; i++) {
    const h = hash2(ox + i * 13, oy + i * 7);
    x.fillStyle = h < 0.5 ? g3 : g2;
    x.fillRect((hash2(i, cx * 31 + cy) * CH) | 0, (hash2(cy * 17 + i, cx) * CH) | 0, 1, 1);
  }
  // 装飾(草・花・石・骨・溶岩)
  for (let i = 0; i < 26; i++) {
    const hx = (hash2(cx * 97 + i, cy * 57) * (CH - 8)) | 0, hy = (hash2(cy * 89 + i, cx * 43 + i) * (CH - 8)) | 0;
    const kind = hash2(hx + ox, hy + oy);
    if (kind < 0.45) { // 草むら
      x.fillStyle = d0; x.fillRect(hx, hy + 2, 1, 2); x.fillRect(hx + 2, hy + 1, 1, 3); x.fillRect(hx + 4, hy + 2, 1, 2);
      x.fillStyle = d1; x.fillRect(hx + 2, hy, 1, 1); x.fillRect(hx, hy + 1, 1, 1);
    } else if (kind < 0.62) { // 花
      x.fillStyle = hash2(hx, hy) < 0.5 ? d2c : d3;
      x.fillRect(hx + 1, hy, 1, 1); x.fillRect(hx, hy + 1, 3, 1); x.fillRect(hx + 1, hy + 2, 1, 1);
      x.fillStyle = '#fff6c8'; x.fillRect(hx + 1, hy + 1, 1, 1);
    } else if (kind < 0.76) { // 石
      x.fillStyle = '#0c0913'; x.fillRect(hx, hy + 3, 5, 1);
      x.fillStyle = '#5a5566'; x.fillRect(hx, hy + 1, 5, 2); x.fillRect(hx + 1, hy, 3, 1);
      x.fillStyle = '#8a8598'; x.fillRect(hx + 1, hy, 2, 1);
    } else if (kind < 0.84) { // 骨
      x.fillStyle = '#cfcab6'; x.fillRect(hx, hy + 1, 5, 1); x.fillRect(hx, hy, 1, 3); x.fillRect(hx + 4, hy, 1, 3);
    } else if (st.lava && kind < 0.97) { // 溶岩の亀裂(発光)
      let lx = hx, ly = hy;
      for (let k = 0; k < 10; k++) {
        const cc = k % 3 === 0 ? '#ffc34a' : '#ff6a2a';
        x.fillStyle = cc; x.fillRect(lx, ly, 1, 1);
        gx.fillStyle = cc; gx.fillRect(lx, ly, 1, 1);
        lx += hash2(lx, k) < 0.5 ? 1 : 0; ly += hash2(k, ly) < 0.6 ? 1 : -1;
        lx = clamp(lx + 1, 0, CH - 1); ly = clamp(ly, 0, CH - 1);
      }
    } else if (!st.lava) { // 小さな光る苔
      x.fillStyle = d1; x.fillRect(hx, hy, 2, 1);
      gx.fillStyle = st.motes.col; gx.globalAlpha = 0.5; gx.fillRect(hx, hy, 1, 1); gx.globalAlpha = 1;
    }
  }
  return { c, g };
}
function drawGround() {
  const st = DATA.stages[S ? S.stage - 1 : 0];
  const x0 = Math.floor(cam.x / CH), y0 = Math.floor(cam.y / CH);
  const x1 = Math.floor((cam.x + GFX.VW) / CH), y1 = Math.floor((cam.y + GFX.VH) / CH);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const k = gkey(cx, cy);
    let ch = groundCache.get(k);
    if (!ch) {
      if (groundCache.size > 60) groundCache.delete(groundCache.keys().next().value);
      groundCache.set(k, ch = buildChunk(cx, cy, st));
    }
    const dx = cx * CH - cam.x, dy = cy * CH - cam.y;
    GFX.sctx.drawImage(ch.c, dx, dy);
    if (st.lava) { GFX.gctx.globalAlpha = 0.55 + 0.25 * Math.sin(GFX.fx.time * 2 + cx + cy); GFX.gctx.drawImage(ch.g, dx, dy); GFX.gctx.globalAlpha = 1; }
    else GFX.gctx.drawImage(ch.g, dx, dy);
  }
}

// ============================================================
// 闘技場: 床の紋章・円形の壁・観客席(一度だけ描いてキャッシュ) + 松明
// ============================================================
const ARENA_OUT = 90; // 壁の外側に描く観客席の幅
let arenaImg = null;
function buildArenaImg() {
  const R = DATA.arena.r, C = R + ARENA_OUT, W = C * 2;
  const c = ART.canvas(W, W), x = c.getContext('2d'), img = x.createImageData(W, W), d = img.data;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const crowd = ['#c46a4a', '#7a8ab8', '#d8c07a', '#8a4fc0', '#5a9a6a', '#e0e0d0', '#b04050'].map(hex);
  const put = (i, [r, g, b], a = 255) => { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; };
  const WALL_T = hex('#cbbb98'), WALL = hex('#7a6850'), WALL_D = hex('#4a3c2e'), STEP = hex('#2a2030'), SEAT = hex('#3a2e3e'), VOID = hex('#0b0710'), MARK = hex('#3a2c22');
  for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
    const dx = px - C + 0.5, dy = py - C + 0.5, r = Math.hypot(dx, dy), i = (py * W + px) * 4;
    if (r < R - 8) { // 床: 中央の紋章(二重円 + 十字)と壁際の影
      if ((r > 44 && r < 46.5) || (r > 92 && r < 93.5) || (r < 92 && r > 46 && (Math.abs(dx) < 1 || Math.abs(dy) < 1))) put(i, MARK, 150);
      continue;
    }
    if (r < R - 1) { put(i, [0, 0, 0], Math.round((r - (R - 8)) / 7 * 90)); continue; }
    if (r < R + 7) { // 壁: 天端の明るい縁 + 石ブロック
      const a = Math.atan2(dy, dx), blk = Math.floor(a * R / 9 + (r > R + 3 ? 0.5 : 0));
      const seam = Math.abs(a * R / 9 + (r > R + 3 ? 0.5 : 0) - blk) < 0.12 || Math.abs(r - (R + 3)) < 0.5;
      put(i, r < R + 1 ? WALL_T : seam ? WALL_D : (hash2(blk, r > R + 3 ? 1 : 0) < 0.5 ? WALL : hex('#6c5a44')));
      continue;
    }
    if (r < R + ARENA_OUT - 6) { // 観客席: 8px ごとの段 + 観客のドット
      const k = (r - R - 7) % 9;
      if (k < 1.2) { put(i, STEP); continue; }
      const a = Math.atan2(dy, dx), seatI = Math.floor(a * r / 4), row = Math.floor((r - R - 7) / 9);
      const h = hash2(seatI, row);
      if (h < 0.7 && k > 3 && k < 7.5 && Math.abs(a * r / 4 - seatI - 0.5) < 0.3) put(i, crowd[(h * 70 | 0) % crowd.length]);
      else if (h < 0.7 && k > 1.5 && k < 3.5 && Math.abs(a * r / 4 - seatI - 0.5) < 0.22) put(i, hex('#e8c8a8')); // 頭
      else put(i, SEAT);
      continue;
    }
    put(i, VOID);
  }
  x.putImageData(img, 0, 0);
  return c;
}
function drawArena(t) {
  const sx = GFX.sctx, gx = GFX.gctx, R = DATA.arena.r, C = R + ARENA_OUT;
  if (!arenaImg) arenaImg = buildArenaImg();
  const ax = -C - cam.x, ay = -C - cam.y, W = C * 2;
  sx.drawImage(arenaImg, ax, ay);
  sx.fillStyle = '#0b0710'; // キャッシュ範囲の外は闇
  if (ay > 0) sx.fillRect(0, 0, GFX.VW, ay);
  if (ay + W < GFX.VH) sx.fillRect(0, ay + W, GFX.VW, GFX.VH - ay - W);
  if (ax > 0) sx.fillRect(0, 0, ax, GFX.VH);
  if (ax + W < GFX.VW) sx.fillRect(ax + W, 0, GFX.VW - ax - W, GFX.VH);
  // 壁の上の松明
  for (let i = 0; i < 20; i++) {
    const a = TAU / 20 * i, wx = Math.cos(a) * (R + 3), wy = Math.sin(a) * (R + 3);
    if (!onScreen(wx, wy, 40)) continue;
    const px = Math.round(wx - cam.x), py = Math.round(wy - cam.y), fl = Math.sin(t * 13 + i * 2.1) * 0.5 + Math.sin(t * 7.3 + i) * 0.5;
    sx.fillStyle = '#3a2a1e'; sx.fillRect(px - 1, py - 1, 3, 3);
    const fh = 3 + (fl > 0.3 ? 1 : 0);
    for (const ctx of [sx, gx]) { ctx.fillStyle = '#ff6a2a'; ctx.fillRect(px - 1, py - fh, 3, fh - 1); ctx.fillStyle = '#ffd27a'; ctx.fillRect(px, py - fh + 1, 1, fh - 2); }
    addLight(wx, wy - 2, 80 + fl * 8, '#ffb347', 0.75 + fl * 0.1);
    if (Math.random() < 0.05) part(wx + rand(-1, 1), wy - fh, rand(-4, 4), -rand(14, 26), rand(0.5, 0.9), pick(['#ffb347', '#ff6a2a']), { glow: true });
  }
}

// 影(楕円)
const shadowCache = {};
function shadow(x, y, w) {
  w = Math.max(4, Math.round(w));
  let c = shadowCache[w];
  if (!c) {
    c = shadowCache[w] = ART.canvas(w, Math.ceil(w / 3) + 1);
    const cx = c.getContext('2d'), h = c.height;
    cx.fillStyle = '#000';
    for (let yy = 0; yy < h; yy++) {
      const t = (yy - (h - 1) / 2) / (h / 2), ww = Math.round(w * Math.sqrt(Math.max(0, 1 - t * t)));
      cx.fillRect(Math.round((w - ww) / 2), yy, ww, 1);
    }
  }
  GFX.sctx.globalAlpha = 0.35;
  GFX.sctx.drawImage(c, Math.round(x - cam.x - w / 2), Math.round(y - cam.y - c.height / 2));
  GFX.sctx.globalAlpha = 1;
}

// ============================================================
// 描画本体
// ============================================================
function spriteOf(e) {
  const s = ART.S[e.type];
  if (Array.isArray(s)) return s[Math.floor(e.t * 8) % s.length];
  return s;
}

// スキルのモーション中の描画(motions.js の状態): 姿勢を足元基準で前傾・伸縮し、武器を任意の角度で1ドットずつ描く
// 武器を振った軌跡には、直近 0.07 秒の角度の範囲に光の弧(スミア)を残す
const BLADE_LEN = 11;
// 長弓: 手の位置 (hx, hy) を中心に、狙う向き ang へ弓を構える。pull = 弦を引いた量、arrow = つがえた矢、glow = 光を集めている
function drawBow(hx, hy, ang, pull, arrow, glow) {
  const sx = GFX.sctx, gx = GFX.gctx, R = 6, fw = [Math.cos(ang), Math.sin(ang)], pd = [-fw[1], fw[0]];
  const pt = (s, f) => [Math.round(hx + pd[0] * s + fw[0] * f), Math.round(hy + pd[1] * s + fw[1] * f)];
  const dot = (p, c, g) => { sx.fillStyle = c; sx.fillRect(p[0], p[1], 1, 1); if (g) { gx.fillStyle = g; gx.fillRect(p[0], p[1], 1, 1); } };
  // 木(前へふくらむ弧)
  for (let s = -R; s <= R; s += 0.5) dot(pt(s, 2 * (1 - (s / R) * (s / R))), s === 0 ? '#6b4a2c' : '#a0703a');
  // 弦: 上端 → 引いた位置 → 下端
  for (let i = 0; i <= 10; i++) { const u = i / 10; dot(pt(-R + R * u, -pull * u), '#e8e4d8'); dot(pt(R - R * u, -pull * u), '#e8e4d8'); }
  if (arrow) for (let i = 0; i <= 9; i++) dot(pt(0, -pull + i), i === 9 ? '#ffffff' : i < 2 ? '#7dff9a' : '#d9c9a0', glow ? '#b8ff9a' : i === 9 ? '#e4ffd8' : null);
  if (glow) addLight(hx + fw[0] * 6 + cam.x, hy + fw[1] * 6 + cam.y, 30, '#b8ff9a', 0.8);
}
function drawPose(rig, sp, ms, x, y, flip, white) {
  const sx = GFX.sctx, gx = GFX.gctx, sg = flip ? -1 : 1;
  const fx = Math.round(x - cam.x), fy = Math.round(y - cam.y + sp.h / 2 - 1), ax = sp.w / 2, ay = sp.h - 1;
  const img = white ? ART.variant(sp, 'white') : sp.c;
  sx.setTransform(sg, 0, -ms.lean * sg, ms.sy, fx, fy); sx.drawImage(img, -ax, -ay); sx.setTransform(1, 0, 0, 1, 0, 0);
  if (sp.e) { gx.globalAlpha = 0.9; gx.setTransform(sg, 0, -ms.lean * sg, ms.sy, fx, fy); gx.drawImage(white ? img : sp.e, -ax, -ay); gx.setTransform(1, 0, 0, 1, 0, 0); gx.globalAlpha = 1; }
  const hist = P.anim.hist || (P.anim.hist = []);
  if (ms.bow && ms.hand) { const rx = 1 + rig.padX + ms.hand[0] - ax, ry = 1 + ms.hand[1] - ay; drawBow(fx + sg * (rx - ms.lean * ry), fy + ms.sy * ry, flip ? Math.PI - ms.bowAng : ms.bowAng, ms.pull || 0, ms.arrow, ms.glow); }
  if (!ms.blade || !ms.hand) { hist.length = 0; return; }
  const rx = 1 + rig.padX + ms.hand[0] - ax, ry = 1 + ms.hand[1] - ay;
  const hx = fx + sg * (rx - ms.lean * ry), hy = fy + ms.sy * ry;
  const ang = flip ? Math.PI - ms.ang : ms.ang, T = P.anim.t;
  // スミア: 直近の角度の範囲を扇形に塗る(新しい角度ほど明るい)
  hist.push({ t: T, a: ang }); while (hist.length && T - hist[0].t > 0.07) hist.shift();
  let a0 = Infinity, a1 = -Infinity;
  for (const h of hist) { const d = Math.atan2(Math.sin(h.a - ang), Math.cos(h.a - ang)); a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
  if (a1 - a0 > 0.25) {
    const span = a1 - a0;
    for (let yy = -BLADE_LEN - 1; yy <= BLADE_LEN + 1; yy++) for (let xx = -BLADE_LEN - 1; xx <= BLADE_LEN + 1; xx++) {
      const d = Math.hypot(xx, yy); if (d < 3 || d > BLADE_LEN + 0.5) continue;
      const da = Math.atan2(Math.sin(Math.atan2(yy, xx) - ang), Math.cos(Math.atan2(yy, xx) - ang));
      if (da < a0 || da > a1) continue;
      const alpha = 0.55 * (1 - Math.abs(da) / (span + 0.01)) * (d / BLADE_LEN);
      sx.globalAlpha = gx.globalAlpha = alpha * SET.fxA; sx.fillStyle = gx.fillStyle = '#eaf4ff';
      sx.fillRect(Math.round(hx + xx), Math.round(hy + yy), 1, 1); gx.fillRect(Math.round(hx + xx), Math.round(hy + yy), 1, 1);
    }
    sx.globalAlpha = gx.globalAlpha = 1;
  }
  // 刀身(柄は金)
  const seen = new Set();
  for (let i = 0; i <= BLADE_LEN; i++) {
    const px = Math.round(hx + Math.cos(ang) * i), py = Math.round(hy + Math.sin(ang) * i), k = px * 1000 + py;
    if (seen.has(k)) continue; seen.add(k);
    sx.fillStyle = i < 2 ? '#d6ae5c' : '#eaf4ff'; sx.fillRect(px, py, 1, 1);
    if (i >= 2) { gx.fillStyle = '#eaf4ff'; gx.fillRect(px, py, 1, 1); }
  }
}

function render() {
  const { lctx: lx, VW, VH } = GFX;
  const REAL_S = GFX.sctx, REAL_G = GFX.gctx;
  let sx = REAL_S, gx = REAL_G;
  sx.setTransform(1, 0, 0, 1, 0, 0); gx.setTransform(1, 0, 0, 1, 0, 0);
  gx.clearRect(0, 0, VW, VH);
  lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1;
  lx.fillStyle = '#000'; lx.fillRect(0, 0, GFX.light.width, GFX.light.height);
  lx.globalCompositeOperation = 'lighter';

  const st = DATA.stages[S ? S.stage - 1 : 0];
  // 環境光・グレーディングを滑らかに遷移
  for (let i = 0; i < 3; i++) { GFX.ambient[i] = lerp(GFX.ambient[i], st.amb[i], 0.03); GFX.tint[i] = lerp(GFX.tint[i], st.tint[i], 0.03); }

  drawGround();
  if (!S || S.demo) return drawMotes(st);
  const t = GFX.fx.time;
  if (S.mode === 'arena') drawArena(t);

  // 自分の攻撃は専用レイヤーへ描き、「攻撃の濃さ」の透明度でまとめて合成する(重なっても濃くならない)
  const layered = SET.fxA < 0.999;
  const mineOn = () => {
    GFX.lightMul = SET.fxA;
    if (!layered) return;
    GFX.msctx.clearRect(0, 0, VW, VH); GFX.mgctx.clearRect(0, 0, VW, VH);
    GFX.sctx = sx = GFX.msctx; GFX.gctx = gx = GFX.mgctx;
  };
  const mineOff = () => {
    GFX.lightMul = 1;
    if (!layered) return;
    GFX.sctx = sx = REAL_S; GFX.gctx = gx = REAL_G;
    sx.globalAlpha = gx.globalAlpha = SET.fxA;
    sx.drawImage(GFX.mscene, 0, 0); gx.drawImage(GFX.mglow, 0, 0);
    sx.globalAlpha = gx.globalAlpha = 1;
  };
  const drawParts = mine => {
    for (const p of parts) {
      if (p.mine !== mine) continue;
      const k = p.t / p.life, sz = p.shrink ? Math.max(1, Math.round(p.sz * (1 - k))) : p.sz;
      const px = Math.round(p.x - cam.x), py = Math.round(p.y - cam.y);
      if (px < -4 || py < -4 || px > VW + 4 || py > VH + 4) continue;
      sx.fillStyle = p.col; sx.fillRect(px, py, sz, sz);
      if (p.glow) { gx.globalAlpha = 1 - k; gx.fillStyle = p.col; gx.fillRect(px, py, sz, sz); gx.globalAlpha = 1; }
    }
  };
  const drawRings = mine => {
    for (const r of rings) {
      if (r.mine !== mine) continue;
      const k = r.t / r.life, R = lerp(r.r0, r.r, 1 - Math.pow(1 - k, 3));
      gx.globalAlpha = 1 - k;
      pCircle(gx, r.x - cam.x, r.y - cam.y, R, r.col);
      if (r.w > 1) pCircle(gx, r.x - cam.x, r.y - cam.y, R - 1, r.col);
      if (r.w > 2) pCircle(sx, r.x - cam.x, r.y - cam.y, R + 1, r.col);
      gx.globalAlpha = 1;
    }
    for (const f of flashes) if (f.mine === mine) addLight(f.x, f.y, f.r * (1 + f.t / f.life * 0.3), f.col, 1 - f.t / f.life);
  };
  // 4点のきらめき(中心は白、腕は先ほど薄い)
  const glint = (x, y, r, col) => {
    x = Math.round(x); y = Math.round(y);
    for (const c of [sx, gx]) {
      c.fillStyle = col; c.fillRect(x - 1, y - 1, 3, 3);
      for (let i = 2; i <= r; i++) {
        c.globalAlpha = 1 - i / (r + 1);
        c.fillRect(x + i, y, 1, 1); c.fillRect(x - i, y, 1, 1); c.fillRect(x, y + i, 1, 1); c.fillRect(x, y - i, 1, 1);
        if (i <= r / 2) { c.fillRect(x + i, y + i, 1, 1); c.fillRect(x - i, y - i, 1, 1); c.fillRect(x + i, y - i, 1, 1); c.fillRect(x - i, y + i, 1, 1); }
      }
      c.globalAlpha = 1;
    }
  };
  // 鬼神・村正の一閃(world.js の muramasaCut と時刻を合わせる)
  const cutDim = s => { // 周りを暗くする量(予兆で暗くなり、斬撃が炸裂する少し前から戻る)
    if (s.nodim) return 0;
    const t = s.t, hold = s.hit - 0.04;
    return t < s.omen ? 0.22 * t / Math.max(s.omen, 0.001) : t < hold ? 0.22 : t < hold + 0.18 ? 0.22 * (1 - (t - hold) / 0.18) : 0;
  };
  const drawCut = s => {
    const t = s.t, n = Math.ceil(s.len), ox = cam.x, oy = cam.y, pal = s.pal, wk = s.wk, tOmen = s.omen, tRun = s.run, tHit = s.hit;
    if (t < tOmen) { // 予兆: 刃の筋が点線でうっすら走り、始点と自分の刀がきらめく
      const k = t / tOmen, fl = Math.floor(t * 60) % 2;
      sx.globalAlpha = (0.2 + 0.6 * k) * (fl ? 1 : 0.6); sx.fillStyle = '#ffd6dc';
      for (let i = 0; i <= n; i += 3) { const [x, y] = cutPt(s, i / n); sx.fillRect(Math.round(x - ox), Math.round(y - oy), 1, 1); }
      sx.globalAlpha = 1;
      glint(s.x0 - ox, s.y0 - oy, 2 + Math.round(6 * k), '#ffffff');
      if (!P.dead) glint(P.x + P.facing * 7 - ox, P.y - 7 - oy, 1 + Math.round(4 * k), '#ffd0d8');
      addLight(s.x0, s.y0, 40, '#ff8a9a', 0.6 * k);
      return;
    }
    const run = easeOutCubic(Math.min(1, (t - tOmen) / (tRun - tOmen))), m = Math.max(1, Math.round(n * run));
    const k = Math.max(0, (t - tRun) / (s.life - tRun)), ke = easeOutCubic(k);
    const pts = [];
    for (let i = 0; i <= m; i++) pts.push(cutPt(s, i / n));
    const sn = u => Math.sin(Math.PI * Math.min(1, u));
    // 帯を塗る(半幅 w(u)。side: 0 = 両側 / ±1 = 中心線から片側(法線 ± の向き)だけ)
    const band = (c, col, alpha, w, side = 0) => {
      if (alpha <= 0.01) return;
      const A = [], B = [];
      for (let i = 0; i <= m; i++) {
        const r = Math.max(0, w(i / n)), [x, y] = pts[i], a = side === 0 ? r : side > 0 ? r : 0, b = side === 0 ? r : side < 0 ? r : 0;
        A.push([x - ox + s.nx * a, y - oy + s.ny * a]); B.push([x - ox - s.nx * b, y - oy - s.ny * b]);
      }
      c.globalAlpha = alpha; c.fillStyle = col; c.beginPath();
      c.moveTo(A[0][0], A[0][1]);
      for (const p of A) c.lineTo(p[0], p[1]);
      for (let i = B.length - 1; i >= 0; i--) c.lineTo(B[i][0], B[i][1]);
      c.closePath(); c.fill(); c.globalAlpha = 1;
    };
    // 刃が振られた内側(反りの内側)に赤い残像、外側は鋭い縁。芯は細い針のような白
    const wake = -Math.sign(s.bulge) || 1, edge = -wake, fade = 1 - ke;
    const wW = u => 8 * wk * Math.pow(sn(u), 0.8) * (0.55 + 0.9 * u) * (1 - ke * 0.5); // 刃が抜けていく後半ほど太い三日月
    band(gx, pal.wakeGlow, 0.3 * fade, u => wW(u) * 0.6, wake);                      // 残像の光(控えめ)
    band(sx, pal.dark, 0.55 * fade, wW, wake);                                     // 残像: 暗い紅
    band(sx, pal.mid, 0.7 * fade, u => wW(u) * 0.62, wake);                       //       紅
    band(sx, pal.bright, 0.9 * Math.sqrt(Math.max(0, fade)), u => wW(u) * 0.3, wake); //     明るい赤(刃の近く)
    band(sx, pal.edge, 0.8 * fade, u => 1.6 * sn(u), edge);                         // 外側の墨の縁
    band(sx, pal.rim, Math.max(0, 1 - ke * 2), u => 1.1 * sn(u) * (1 - ke), edge); // 外側の鋭い縁
    const flash = t >= tRun && t < tRun + 0.045, flash2 = t >= tHit && t < tHit + 0.04; // 走り終えた瞬間 / 斬撃が炸裂する瞬間に、刃筋全体が一瞬光る
    const core = u => (flash ? 2.2 : 1.3) * sn(u) * (1 - ke * 3);
    if (flash2) band(sx, '#ffd0d8', 1, u => 1.6 * sn(u));
    band(sx, '#ffffff', 1, core);                                                    // 白い芯(針のように両端が尖る)
    band(gx, '#ffffff', Math.max(0, 0.55 - ke * 2), core);
    band(gx, pal.glow, 0.4 * fade, u => 2 * sn(u) * (1 - ke));
    if (run < 1) { // 走る切っ先
      const [hx, hy] = pts[m];
      glint(hx - ox, hy - oy, 7, '#ffffff');
      addLight(hx, hy, 70, '#ffd0d8', 1);
    } else { // 速度線: 残像側に細い線が数本走り、外へ流れて消える
      const kk = Math.min(1, (t - tRun) / 0.22);
      if (kk < 1) {
        [[6, 0.15, 0.6, 0.55], [11, 0.35, 0.85, 0.35]].forEach(([d, u0, u1, al]) => {
          const off = wake * d * (1 + kk * 0.8);
          let px = null, py = null;
          sx.globalAlpha = al * (1 - kk); gx.globalAlpha = al * (1 - kk) * 0.4;
          for (let i = Math.round(n * u0); i <= Math.round(n * u1); i += 4) {
            const [x, y] = cutPt(s, i / n), qx = x - ox + s.nx * off * sn(i / n), qy = y - oy + s.ny * off * sn(i / n);
            if (px !== null) { pLine(sx, px, py, qx, qy, pal.rim, 1); pLine(gx, px, py, qx, qy, pal.glow, 1); }
            px = qx; py = qy;
          }
        });
        sx.globalAlpha = gx.globalAlpha = 1;
      }
    }
    for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) if (u <= run) { const [x, y] = cutPt(s, u); addLight(x, y, 70, pal.glow, 0.9 * (1 - ke)); }
  };
  // 乱れ桜の流れる斬撃: 切っ先が 2点の間を数フレームかけて弧を描いて走り、少し遅れて尾がついていく(見えるのは尾〜切っ先の間の三日月)
  //   通った跡には 1ドットの線が残り、すぐ消える
  const drawFlow = s => {
    const t = s.t, ox = cam.x, oy = cam.y, pal = s.pal, ss = x => x * x * (3 - 2 * x);
    const uh = ss(Math.min(1, t / s.run)), ut = ss(clamp((t - s.lag) / s.run, 0, 1)); // 切っ先 / 尾の位置(0..1)
    const at = u => { // 曲線上の点(画面座標)と法線
      const [x, y] = cutPt(s, u), k = s.bulge * Math.PI * Math.cos(Math.PI * u);
      const tx = s.x1 - s.x0 + s.nx * k, ty = s.y1 - s.y0 + s.ny * k, l = Math.hypot(tx, ty) || 1;
      return [x - ox, y - oy, -ty / l, tx / l];
    };
    const ra = 0.35 * (1 - clamp((t - s.lag) / (s.run + s.fade), 0, 1)); // 通った跡(桜色の細い線。尾に近いほど濃く、古い側から消える)
    if (ut > 0 && ra > 0.02) {
      const n = Math.max(2, Math.ceil(s.len * ut / 3));
      let p = at(0);
      for (let i = 1; i <= n; i++) {
        const q = at(ut * i / n), al = ra * i / n;
        sx.globalAlpha = al; gx.globalAlpha = al * 0.5;
        pLine(sx, p[0], p[1], q[0], q[1], pal.mid, 1); pLine(gx, p[0], p[1], q[0], q[1], pal.glow, 1); p = q;
      }
      sx.globalAlpha = gx.globalAlpha = 1;
    }
    if (uh - ut < 0.003) return;
    const n = Math.max(4, Math.ceil(s.len * (uh - ut) / 1.5)), pts = [];
    for (let i = 0; i <= n; i++) pts.push(at(ut + (uh - ut) * i / n));
    // 尾は細く、切っ先の少し手前が一番太く、切っ先は尖る。front: 切っ先側だけ(白い芯。胴体は桜色のまま)
    const band = (c, col, alpha, k, front) => {
      const w = i => { const v = i / n; return s.w * k * Math.pow(Math.sin(Math.PI * v), 0.7) * (0.3 + 0.7 * v) * (front ? ss(clamp((v - 0.35) / 0.55, 0, 1)) : 1); };
      c.globalAlpha = alpha; c.fillStyle = col; c.beginPath();
      for (let i = 0; i <= n; i++) { const [x, y, nx, ny] = pts[i], r = w(i); c.lineTo(x + nx * r, y + ny * r); }
      for (let i = n; i >= 0; i--) { const [x, y, nx, ny] = pts[i], r = w(i); c.lineTo(x - nx * r, y - ny * r); }
      c.closePath(); c.fill(); c.globalAlpha = 1;
    };
    band(gx, pal.glow, 0.35, 1.6);      // 光
    band(sx, pal.mid, 0.9, 1.35);       // 桜色の縁
    band(sx, pal.bright, 1, 0.85);
    band(sx, '#ffffff', 1, 0.35, true); // 白い芯(切っ先側)
    const [hx, hy] = pts[n];
    if (t < s.run) { sx.fillStyle = '#ffffff'; sx.fillRect(Math.round(hx), Math.round(hy), 1, 1); } // 走っている切っ先
    addLight(hx + ox, hy + oy, 28, pal.glow, 0.6 * (1 - ut));
  };
  const drawSlashes = enemy => {
    if (!enemy) { // 一閃の間は周りを少し暗くする(刃筋だけが浮かび上がる)
      let dim = 0;
      for (const s of slashes) if (s.cut) dim = Math.max(dim, cutDim(s));
      if (dim > 0.01) { sx.globalAlpha = dim; sx.fillStyle = '#0a0208'; sx.fillRect(0, 0, VW, VH); sx.globalAlpha = 1; }
    }
    for (const s of slashes) {
      if (!!s.enemy !== enemy) continue;
      if (s.fan) { // 聖盾の審判: 攻撃範囲そのままの扇形(span = TAU で全周)が広がる
        const k = easeOutCubic(Math.min(1, s.t / (s.life * 0.45))), fade = 1 - s.t / s.life, R = s.r * (0.3 + 0.7 * k), h = s.span / 2;
        const cx = s.x - cam.x, cy = s.y - cam.y, full = s.span >= TAU - 0.01;
        sx.globalAlpha = 0.3 * fade; sx.fillStyle = s.col; // 範囲の塗り
        sx.beginPath(); if (!full) sx.moveTo(cx, cy); sx.arc(cx, cy, R, s.a - h, s.a + h); sx.closePath(); sx.fill();
        sx.globalAlpha = gx.globalAlpha = fade;
        const n = Math.ceil(R * s.span); // 外周の光の弧(外側ほど白く)
        for (let i = 0; i <= n; i++) {
          const a = s.a - h + s.span * i / n, c = Math.cos(a), sn = Math.sin(a);
          for (let t = 0; t < 3; t++) {
            const col = t === 0 ? '#ffffff' : s.col, px = Math.round(cx + c * (R - t)), py = Math.round(cy + sn * (R - t));
            sx.fillStyle = col; sx.fillRect(px, py, 1, 1); gx.fillStyle = col; gx.fillRect(px, py, 1, 1);
          }
        }
        if (!full) for (const e of [-1, 1]) { // 扇の両端
          const x1 = cx + Math.cos(s.a + e * h) * R, y1 = cy + Math.sin(s.a + e * h) * R;
          pLine(sx, cx, cy, x1, y1, s.col, 1); pLine(gx, cx, cy, x1, y1, s.col, 1);
        }
        sx.globalAlpha = gx.globalAlpha = 1;
        addLight(s.x + (full ? 0 : Math.cos(s.a) * s.r * 0.5), s.y + (full ? 0 : Math.sin(s.a) * s.r * 0.5), s.r * 1.2, s.col, 0.8 * fade);
        continue;
      }
      if (s.cut) { drawCut(s); continue; } // 鬼神・村正の一閃
      if (s.flow) { drawFlow(s); continue; } // 乱れ桜の流れる斬撃
      if (s.mark) { // 一閃で斬られた敵の上の細い斬り跡(1ドット。光は控えめ)
        const k = s.t / s.life, ax = s.x - cam.x, ay = s.y - cam.y, bx = s.x1 - cam.x, by = s.y1 - cam.y;
        sx.globalAlpha = 1 - k; pLine(sx, ax, ay, bx, by, '#ffffff', 1);
        gx.globalAlpha = 0.45 * (1 - k); pLine(gx, ax, ay, bx, by, '#ff3b5c', 1);
        sx.globalAlpha = gx.globalAlpha = 1;
        continue;
      }
      if (s.line) { // 一閃 / グランドクロス: 経路に走る鋭い光
        const k = easeOutCubic(s.t / s.life), w = Math.max(1, Math.round((s.w || 4) * (1 - k)));
        pLine(gx, s.x - cam.x, s.y - cam.y, s.x1 - cam.x, s.y1 - cam.y, '#ff3b5c', w + 2);
        pLine(sx, s.x - cam.x, s.y - cam.y, s.x1 - cam.x, s.y1 - cam.y, '#ffffff', w);
        addLight((s.x + s.x1) / 2, (s.y + s.y1) / 2, 90, '#ff5d73', 1 - k);
        continue;
      }
      const k = s.t / s.life, R = s.r, span = s.full ? TAU : s.span || 1.9, n = s.full ? 64 : 26; // full: 全周の斬撃(見切りの反撃など)
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        if (u > k * 1.6) break;
        const a = s.a + (s.flip ? -1 : 1) * (u - 0.5) * span, th = Math.sin(u * Math.PI) * 3 * (1 - k);
        for (let r = R * 0.55; r < R * 0.55 + th + 1; r++) {
          const px = Math.round(s.x + Math.cos(a) * r * (0.7 + 0.3 * k) - cam.x), py = Math.round(s.y + Math.sin(a) * r * (0.7 + 0.3 * k) - cam.y);
          const col = r > R * 0.55 + th - 1 ? '#ffffff' : s.col || (s.evo ? '#ff3b5c' : '#ff8a9a');
          sx.fillStyle = col; sx.fillRect(px, py, 1, 1);
          gx.fillStyle = col; gx.fillRect(px, py, 1, 1);
        }
      }
      addLight(s.x + Math.cos(s.a) * R * 0.6, s.y + Math.sin(s.a) * R * 0.6, 40, '#ff5d73', 0.6 * (1 - k));
    }
  };

  // ======== 自分の攻撃(地面側): ゾーン・オーラ ========
  // 範囲は均一な半透明塗り(市松ディザは模様の切り替わりでちらつくため廃止)
  mineOn();
  for (const z of zones) {
    const zx = z.x - cam.x, zy = z.y - cam.y;
    const fade = Math.min(1, (z.dur - z.t) * 4, z.t * 6);
    if (z.kind === 'blizz') {
      sx.globalAlpha = 0.16 * fade; pDisc(sx, zx, zy, Math.round(z.r), '#bff4ff');
      sx.globalAlpha = 0.8 * fade; pCircle(sx, zx, zy, Math.round(z.r), '#ffffff', 2); sx.globalAlpha = 1;
      gx.globalAlpha = 0.25 * fade; pCircle(gx, zx, zy, Math.round(z.r), '#bff4ff'); gx.globalAlpha = 1;
      addLight(z.x, z.y, z.r * 2.2, '#7ad7ff', 0.6 * fade);
    } else if (z.kind === 'crack') {
      sx.globalAlpha = 0.35 * fade; pDisc(sx, zx, zy, Math.round(z.r * 0.8), '#1a1008'); sx.globalAlpha = 1;
      for (let i = 0; i < 5; i++) { // 放射状の割れ目(光る)
        const a = i * 1.26 + 0.4;
        for (let d = 2; d < z.r * 0.8; d += 1) { const x = Math.round(zx + Math.cos(a + Math.sin(d * 0.5) * 0.2) * d), y = Math.round(zy + Math.sin(a + Math.sin(d * 0.5) * 0.2) * d * 0.6); gx.globalAlpha = 0.7 * fade; gx.fillStyle = '#ffb347'; gx.fillRect(x, y, 1, 1); }
      }
      gx.globalAlpha = 1;
    } else if (z.kind === 'rain') {
      const on = z.t >= z.delay ? 1 : z.t / z.delay;
      sx.globalAlpha = 0.22 * fade * on; pDisc(sx, zx, zy, Math.round(z.r), '#0c1a10'); // 影の円
      sx.globalAlpha = 0.6 * fade * on; pCircle(sx, zx, zy, Math.round(z.r), '#b8ff9a', 1); sx.globalAlpha = 1;
      for (const ar of z.arrows) { // 落ちてくる矢(0.07秒)→ 刺さった矢(薄れて消える)
        if (ar.t < 0) continue;
        const ax = Math.round(ar.x - cam.x), ay = Math.round(ar.y - cam.y);
        if (ar.t < 0.07) {
          const top = ay - Math.round(26 * (1 - ar.t / 0.07));
          for (let yy = top - 5; yy <= top; yy++) { sx.fillStyle = yy === top ? '#ffffff' : '#e4ffd8'; sx.fillRect(ax, yy, 1, 1); gx.fillStyle = '#b8ff9a'; gx.fillRect(ax, yy, 1, 1); }
        } else {
          sx.globalAlpha = 1 - ar.t / 0.5;
          sx.fillStyle = '#d9c9a0'; sx.fillRect(ax, ay - 3, 1, 3); sx.fillStyle = '#7dff9a'; sx.fillRect(ax - 1, ay - 4, 1, 1); sx.fillRect(ax + 1, ay - 4, 1, 1);
          sx.globalAlpha = 1;
        }
      }
      addLight(z.x, z.y, z.r * 2, '#b8ff9a', 0.35 * fade * on);
    } else if (z.kind === 'pillar') { // 光の柱: 天から細く降りて太くなり、消えていく
      if (z.t >= 0) {
        const u = z.t / z.dur, x = Math.round(zx), w = Math.max(1, Math.round(z.r * 0.35 * Math.sin(Math.min(1, u * 2.5) * Math.PI / 2) * (1 - u)));
        const top = Math.round(zy - 200), y0 = Math.round(zy);
        sx.globalAlpha = 0.55 * (1 - u); sx.fillStyle = '#fff6d8'; sx.fillRect(x - w, top, w * 2 + 1, y0 - top);
        sx.globalAlpha = 0.9 * (1 - u); sx.fillStyle = '#ffffff'; sx.fillRect(x - Math.max(0, w - 2), top, Math.max(1, (w - 2) * 2 + 1), y0 - top);
        gx.globalAlpha = 0.5 * (1 - u); gx.fillStyle = '#ffe38a'; gx.fillRect(x - w - 1, top, w * 2 + 3, y0 - top);
        sx.globalAlpha = gx.globalAlpha = 1;
        sx.globalAlpha = 0.5 * (1 - u); pCircle(sx, zx, zy, Math.round(z.r * (0.6 + 0.4 * u)), '#ffe38a', 1); sx.globalAlpha = 1;
        addLight(z.x, z.y, z.r * 3, '#fff6d8', 0.9 * (1 - u));
      }
    } else if (z.kind === 'lightrain') { // 光の雨: 淡い金の円
      sx.globalAlpha = 0.18 * fade; pDisc(sx, zx, zy, Math.round(z.r), '#ffe38a');
      sx.globalAlpha = 0.6 * fade; pCircle(sx, zx, zy, Math.round(z.r), '#fff6d8', 1); sx.globalAlpha = 1;
      addLight(z.x, z.y, z.r * 2, '#ffe38a', 0.5 * fade);
    } else if (z.kind === 'gspark') { // グラビティスパーク: 雷の球(引き寄せの縁が縮む → 爆発で消える)
      const sk = DATA.weapons.thunder.skill, u = Math.min(1, z.t / sk.boomT);
      if (!z.boomed) {
        sx.globalAlpha = 0.5 * (1 - u); pCircle(sx, zx, zy, Math.round(z.r * (1 - u * 0.8)), '#9fd8ff', 1); sx.globalAlpha = 1;
        pDisc(sx, zx, zy, 3 + Math.round(u * 3), '#ffffff'); gx.globalAlpha = 0.8; pDisc(gx, zx, zy, 6 + Math.round(u * 4), '#9fd8ff'); gx.globalAlpha = 1;
        addLight(z.x, z.y, 90, '#9fd8ff', 1);
      } else if (z.field) { // 残留磁場: 回る弱い輪
        sx.globalAlpha = 0.35 * fade; pCircle(sx, zx, zy, Math.round(z.r * (0.5 + 0.5 * ((t * 1.5) % 1))), '#9fd8ff', 1); sx.globalAlpha = 1;
        addLight(z.x, z.y, z.r, '#9fd8ff', 0.4 * fade);
      }
    } else if (z.kind === 'tower') { // 鉄塔: 格子の塔(先端の球が光る)。送電線: 隣の鉄塔へ雷の線
      const rise = Math.min(1, z.t * 8), x = Math.round(zx), base = Math.round(zy), H = 20, top = base - Math.round(H * rise);
      for (let y = top; y <= base; y++) {
        const k = (y - top) / H, w = Math.round(1 + k * 3);
        sx.fillStyle = (y - top) % 3 === 0 ? '#c8c0d8' : '#6a6080'; sx.fillRect(x - w, y, 1, 1); sx.fillRect(x + w, y, 1, 1);
        if ((y - top) % 3 === 0) { sx.fillStyle = '#8a8098'; sx.fillRect(x - w, y, w * 2 + 1, 1); }
      }
      sx.fillStyle = '#ffffff'; sx.fillRect(x - 1, top - 2, 3, 2); gx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 20); pDisc(gx, x, top - 1, 3, '#fff27a'); gx.globalAlpha = 1;
      if (z.link && z.wire) {
        const lx = Math.round(z.link.x - cam.x), ly = Math.round(z.link.y - cam.y) - H;
        gx.globalAlpha = 0.6 * fade; pLine(gx, x, top, lx, ly, '#fff27a', 1); gx.globalAlpha = 1;
        sx.globalAlpha = 0.8 * fade; pLine(sx, x, top + (Math.random() < 0.5 ? 1 : 0), lx, ly, '#ffffff', 1); sx.globalAlpha = 1;
      }
      addLight(z.x, z.y - 20, 60, '#fff27a', 0.7 * fade);
    } else if (z.kind === 'icicle') { // アイシクルフォール: 範囲の影 + 落ちてくるつらら
      sx.globalAlpha = 0.18 * fade; pDisc(sx, zx, zy, Math.round(z.r), '#0c1a2a');
      sx.globalAlpha = 0.5 * fade; pCircle(sx, zx, zy, Math.round(z.r), '#bff4ff', 1); sx.globalAlpha = 1;
      for (const ic of z.ices) {
        if (ic.t < 0) continue;
        const x = Math.round(ic.x - cam.x), y = Math.round(ic.y - cam.y), L = ic.big ? 22 : 8, W = ic.big ? 3 : 1;
        if (ic.t < ICE_FALL) { // 落ちてくる(先が尖った氷柱)
          const tip = y - Math.round((ic.big ? 120 : 60) * (1 - ic.t / ICE_FALL));
          for (let k = 0; k < L; k++) { const w = Math.max(0, Math.round(W * k / L)); sx.fillStyle = k < 2 ? '#ffffff' : '#bff4ff'; sx.fillRect(x - w, tip - k, w * 2 + 1, 1); gx.fillStyle = '#7ad7ff'; gx.fillRect(x, tip - k, 1, 1); }
          sx.globalAlpha = 0.35; pDisc(sx, x, y, ic.big ? 6 : 2, '#0c1a2a'); sx.globalAlpha = 1; // 落ちる先の影
        } else { // 砕けた跡(薄れて消える)
          const k = 1 - (ic.t - ICE_FALL) / 0.4;
          sx.globalAlpha = 0.6 * k; pCircle(sx, x, y, Math.round((ic.big ? z.bigR : z.iceR) * (1.1 - 0.3 * k)), '#ffffff', 1); sx.globalAlpha = 1;
        }
      }
      addLight(z.x, z.y, z.r * 2, '#7ad7ff', 0.4 * fade);
    } else if (z.kind === 'frostpatch') { // 凍てつく大地
      sx.globalAlpha = 0.3 * fade; pDisc(sx, zx, zy, Math.round(z.r), '#bff4ff'); sx.globalAlpha = 1;
      gx.globalAlpha = 0.25 * fade; pCircle(gx, zx, zy, Math.round(z.r), '#ffffff'); gx.globalAlpha = 1;
    } else if (z.kind === 'ddust') { // ダイヤモンドダスト: 淡く光る縁ときらめき
      sx.globalAlpha = 0.1 * fade; pDisc(sx, zx, zy, Math.round(z.r), '#bff4ff');
      sx.globalAlpha = 0.55 * fade; pCircle(sx, zx, zy, Math.round(z.r), '#e0f8ff', 1); sx.globalAlpha = 1;
      for (let i = 0; i < 24; i++) { // 縁を回る光
        const a = t * 0.8 + i * TAU / 24, x = Math.round(zx + Math.cos(a) * z.r), y = Math.round(zy + Math.sin(a) * z.r);
        gx.globalAlpha = fade * (0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i))); gx.fillStyle = '#ffffff'; gx.fillRect(x, y, 1, 1);
      }
      gx.globalAlpha = 1;
      addLight(z.x, z.y, z.r * 2.2, '#bff4ff', 0.6 * fade);
    } else if (z.kind === 'residue') {
      sx.globalAlpha = 0.28 * fade; pDisc(sx, zx, zy, Math.round(z.r), '#bff4ff');
      sx.globalAlpha = 0.7 * fade; pCircle(sx, zx, zy, Math.round(z.r), '#ffffff', 1); sx.globalAlpha = 1;
      addLight(z.x, z.y, z.r * 2, '#7ad7ff', 0.5 * fade);
    } else if (z.kind === 'hole') {
      const R = Math.round(z.r * Math.min(1, z.t * 5) * (0.35 + 0.05 * Math.sin(t * 20)));
      pDisc(sx, zx, zy, R + 3, '#6a3aa0'); pDisc(sx, zx, zy, R, '#05020a');
      pCircle(gx, zx, zy, R + 3, '#c78bff'); pCircle(gx, zx, zy, R + 5, '#6a3aa0', 2);
      gx.globalAlpha = 0.3; pCircle(gx, zx, zy, Math.round(z.r * 1.6 * (1 - (t * 1.5) % 1)), '#c78bff', 3); gx.globalAlpha = 1;
      addLight(z.x, z.y, z.r * 2.5, '#c78bff', 0.9);
    }
  }
  const aw = P.weapons.aura;
  if (aw && aw.R && !P.dead) {
    const R = Math.round(aw.R), col = aw.evo ? '#fff3a0' : '#ffe38a';
    sx.globalAlpha = 0.12; pDisc(sx, P.x - cam.x, P.y - cam.y, R, col); sx.globalAlpha = 1;
    pCircle(gx, P.x - cam.x, P.y - cam.y, R, col, 1);
    gx.globalAlpha = 0.5;
    for (let i = 0; i < 8; i++) { const a = t * 1.2 + TAU / 8 * i; gx.fillStyle = col; gx.fillRect(Math.round(P.x - cam.x + Math.cos(a) * (R - 3)), Math.round(P.y - cam.y + Math.sin(a) * (R - 3)), 2, 2); }
    gx.globalAlpha = 1;
    addLight(P.x, P.y, R * 2.2, '#ffe38a', 0.45);
  }
  mineOff();

  // ---- ボスの設置物(自分の範囲より手前。縁は赤で危険を示す) ----
  const warnBlink = Math.floor(t * 8) % 2;
  for (const h of hazards) {
    const hx = h.x - cam.x, hy = h.y - cam.y, fade = Math.min(1, (h.dur - h.t) * 3, h.t * 8);
    if (h.kind === 'goo') {
      const R = Math.round(h.r * Math.min(1, h.t * 6));
      sx.globalAlpha = 0.45 * fade; pDisc(sx, hx, hy, R, '#2f9c7c');
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, '#4fd6a8'); pCircle(sx, hx, hy, R + 1, '#ff3b5c', 2); sx.globalAlpha = 1;
      gx.globalAlpha = 0.3 * fade; pCircle(gx, hx, hy, R + 1, '#ff3b5c', 2); gx.globalAlpha = 1;
    } else if (h.kind === 'quake') {
      pCircle(sx, hx, hy, Math.round(h.r), '#ffd0d8'); pCircle(sx, hx, hy, Math.round(h.r) - 1, '#ff3b5c');
      gx.globalAlpha = 0.8; pCircle(gx, hx, hy, Math.round(h.r), '#ff3b5c'); gx.globalAlpha = 1;
    } else if (h.kind === 'clock') { // 時計盤: 目盛りと逆回転する針
      const R = Math.round(h.r * Math.min(1, h.t * 4));
      sx.globalAlpha = 0.22 * fade; pDisc(sx, hx, hy, R, '#6a3aa0');
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b5c' : '#c29bff'); sx.globalAlpha = 1;
      gx.globalAlpha = 0.6 * fade; pCircle(gx, hx, hy, R, '#c29bff');
      for (let i = 0; i < 12; i++) { const a = TAU / 12 * i; gx.fillStyle = '#c29bff'; gx.fillRect(Math.round(hx + Math.cos(a) * (R - 4)), Math.round(hy + Math.sin(a) * (R - 4)), 2, 2); }
      pLine(gx, hx, hy, hx + Math.cos(-t * 3) * R * 0.8, hy + Math.sin(-t * 3) * R * 0.8, '#ffffff');
      pLine(gx, hx, hy, hx + Math.cos(-t * 0.5) * R * 0.5, hy + Math.sin(-t * 0.5) * R * 0.5, '#c29bff', 2);
      gx.globalAlpha = 1;
      addLight(h.x, h.y, R * 2, '#c29bff', 0.4 * fade);
    } else if (h.kind === 'vortex') { // 渦: 内側へ縮む輪と回転する腕
      const R = Math.round(h.r * Math.min(1, h.t * 4));
      sx.globalAlpha = 0.2 * fade; pDisc(sx, hx, hy, R, '#5a1a4a');
      sx.globalAlpha = 0.35 * fade; pDisc(sx, hx, hy, Math.round(R * 0.18), '#1a0514');
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b5c' : '#ff4a8a'); sx.globalAlpha = 1;
      gx.globalAlpha = 0.6 * fade;
      for (let j = 0; j < 3; j++) pCircle(gx, hx, hy, Math.round(R * (1 - ((t * 0.9 + j / 3) % 1))), '#ff4a8a');
      for (let i = 0; i < 4; i++) for (let s = 0; s < 8; s++) {
        const r = R * (1 - s / 8), a = t * 2.5 + TAU / 4 * i + s * 0.35;
        gx.fillStyle = s % 2 ? '#c78bff' : '#ffd0f0'; gx.fillRect(Math.round(hx + Math.cos(a) * r), Math.round(hy + Math.sin(a) * r), 2, 2);
      }
      gx.globalAlpha = 1;
      addLight(h.x, h.y, R * 2, '#ff4a8a', 0.45 * fade);
    }
  }

  // ---- ジェム・ドロップ ----
  for (const g of gems) {
    if (!onScreen(g.x, g.y)) continue;
    const bob = Math.round(Math.sin(g.t * 4) * 1) + g.z;
    shadow(g.x, g.y + 3, 4);
    drawSp(ART.S.gem[g.tier], g.x, g.y + bob, { emitA: 0.5 + 0.4 * Math.max(0, Math.sin(g.t * 3)) });
    if (g.tier >= 2) addLight(g.x, g.y, 18, g.tier === 2 ? '#ff5d73' : '#ffd23f', 0.6);
  }
  for (const d of drops) {
    if (!onScreen(d.x, d.y)) continue;
    const bob = d.kind === 'coin' ? 0 : Math.round(Math.sin(d.t * 3) * 1.5);
    let sp = ART.S[d.kind];
    if (d.kind === 'coin') sp = ART.S.coin[Math.floor(d.t * 6) % 2];
    shadow(d.x, d.y + sp.h / 2, sp.w * 0.8);
    if (d.kind === 'chest') { // 装備宝箱(フェーズ3で再びドロップさせる)
      const col = '#ffd23f';
      gx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 5);
      pCircle(gx, d.x - cam.x, d.y - cam.y, 9 + Math.round(Math.sin(t * 5)), col, 2);
      gx.globalAlpha = 1;
      addLight(d.x, d.y, 60, col, 0.9);
      if (Math.random() < 0.3) part(d.x + rand(-6, 6), d.y + rand(-4, 4), 0, -18, 0.6, col, { glow: true });
    }
    drawSp(sp, d.x, d.y + bob + d.z);
  }

  // ---- 敵(Yソート) ----
  const vis = enemies.filter(e => !e.dead && onScreen(e.x, e.y, 30));
  vis.sort((a, b) => a.y - b.y);
  for (const e of vis) {
    const sp = e.boss ? ART.S[e.boss] : e.prop ? ART.S.brazier[Math.floor(t * 6 + e.seed * 5) % 2] : spriteOf(e);
    const sc = e.scale;
    shadow(e.x, e.y + sp.h * sc / 2 - 1, sp.w * sc * 0.8);
    let sy = 1, sxk = 1, yo = 0;
    if (e.ai === 'hop') { const h = e.hopT < 0.35 ? Math.sin((e.hopT / 0.35) * Math.PI) : 0; yo = -h * 5; sy = 1 + h * 0.15 - (e.hopT > 0.9 ? 0.15 : 0); sxk = 2 - sy; }
    else if (e.ai === 'flutter') yo = Math.sin(e.t * 12) * 1.5;
    else if (!e.prop && !e.boss) { const w = Math.abs(Math.sin(e.t * 7 + e.seed * 6)); sy = 1 - w * 0.06; sxk = 1 + w * 0.04; }
    if (e.boss) { sy = (e.sq || 1) + Math.sin(e.t * 3) * 0.03; sxk = 2 - sy; yo = -(e.jz || 0); }
    const flip = (e.face || 1) < 0;
    let alpha = e.ghost ? 0.7 : 1;
    if (e.hideA !== undefined) alpha *= e.hideA;
    if (e.elite) { // 金色の脈動アウトライン
      const gold = ART.variant(sp, flip ? 'goldFlip' : 'gold'), ex = Math.round(e.x - cam.x - sp.w * sc / 2), ey = Math.round(e.y + yo - cam.y - sp.h * sc / 2);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) sx.drawImage(gold, ex + ox, ey + oy, sp.w * sc, sp.h * sc);
    }
    drawSp(sp, e.x, e.y + yo, { flip, scale: sc, sy, sxk, alpha, white: e.flash > 0, emitA: e.ghost ? 0.25 : e.flash > 0 ? 0.5 : undefined });
    // 状態異常の色味
    if (e.mark > 0 && S.time < e.markT) { // アーチャーの印: 頭上に緑のドット(10個で1段)。弱点露出中は赤く明滅
      const weak = S.time < (e.weakT || 0), n = Math.min(e.mark, 30), top = Math.round(e.y + yo - cam.y - sp.h * sc / 2) - 3;
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / 10), col = i % 10, cnt = Math.min(10, n - row * 10);
        const x = Math.round(e.x - cam.x - cnt + 1 + col * 2), y = top - row * 2;
        sx.fillStyle = gx.fillStyle = weak ? (Math.floor(t * 10) % 2 ? '#ff5d73' : '#ffd0d8') : '#7dff9a';
        sx.fillRect(x, y, 1, 1); gx.fillRect(x, y, 1, 1);
      }
    }
    if (e.frost > 0 || e.stun > 0) {
      const ice = ART.variant(sp, e.freeze ? (flip ? 'frzFlip' : 'frz') : flip ? 'iceFlip' : 'ice'), ix = Math.round(e.x - cam.x - sp.w * sc / 2), iy = Math.round(e.y + yo - cam.y - sp.h * sc / 2);
      sx.globalAlpha = e.freeze ? 0.7 : e.stun > 0 ? 0.6 : Math.min(0.35, e.frost * 0.025); sx.drawImage(ice, ix, iy, sp.w * sc, sp.h * sc); // 凍結は氷漬け
      if (!(e.frost > 0)) { gx.globalAlpha = sx.globalAlpha * 0.6; gx.drawImage(ice, ix, iy, sp.w * sc, sp.h * sc); } // 凍傷・凍結は光の層に描かない(薄くても白く飛んで、敵が白い塊に見えるため)
      sx.globalAlpha = gx.globalAlpha = 1;
    }
    if (e.elite) {
      addLight(e.x, e.y, 50, '#ffd23f', 0.8);
    }
    if (e.prop) addLight(e.x, e.y - 3, 70 + Math.sin(t * 13 + e.seed * 9) * 6, '#ff9b3d', 1);
    if (e.boss) addLight(e.x, e.y, 90, e.col, 0.8);
    if (e.aim) { gx.fillStyle = '#ffb13a'; gx.fillRect(Math.round(e.x - cam.x), Math.round(e.y - cam.y - 10), 1, 3); }
    if (e.type === 'goblin') addLight(e.x, e.y, 40, '#ffcc33', 0.8);
    if (!e.boss && !e.prop && e.hp < e.maxhp && (e.elite || e.maxhp > 90)) {
      const w = Math.round(sp.w * sc * 0.8), bx = Math.round(e.x - cam.x - w / 2), by = Math.round(e.y - cam.y + sp.h * sc / 2 + 2);
      sx.fillStyle = '#0c0913'; sx.fillRect(bx - 1, by - 1, w + 2, 3);
      sx.fillStyle = '#ff3b5c'; sx.fillRect(bx, by, Math.round(w * e.hp / e.maxhp), 1);
    }
  }

  // ---- プレイヤー ----
  if (!P.dead) {
    // クラスの部位アニメーション: スキルのモーション中は補間した姿勢、それ以外は待機・歩きのフレーム。なければ旧プレイヤー
    const rig = ART.S[DATA.classes[P.cls].rig];
    const mn = rig && P.anim ? (rig.alias && rig.alias[P.anim.name]) || P.anim.name : null;
    const M = mn && MOTIONS[mn] && MOTIONS[mn].rig === DATA.classes[P.cls].rig ? MOTIONS[mn] : null; // 他クラスのモーションは使わない
    const ms = M ? M.state(P.anim.t, P.anim.arg) : null;
    const psp = ms ? rig.pose(ms.p) : rig && P.guard && rig.guard ? rig.pose(rig.guard) : rig ? ART.rigFrame(rig, P.moving ? 'walk' : 'idle', t) : ART.S.player; // guard: 構えの姿勢(ナイト)
    const py = P.y - (psp.h - ART.S.player.h) / 2; // 足元の位置を旧プレイヤーと揃える
    // 空蝉の分身(白いシルエットが明滅する)
    if (S.decoy && rig) drawSp(rig.base, S.decoy.x, S.decoy.y - (rig.base.h - ART.S.player.h) / 2, { white: true, alpha: 0.35 + 0.25 * Math.sin(t * 20), flip: P.facing < 0, emit: false });
    // 残像: クラスの色のシルエット(白だとブルームで塊になるため)
    if (P.after) for (const a of P.after) {
      const ax = Math.round(a.x - cam.x - psp.w / 2), ay = Math.round(a.y - (P.y - py) - cam.y - psp.h / 2);
      const src = a.f < 0 ? ART.variant(psp, 'flip') : psp.c;
      sx.globalAlpha = 0.45 * (1 - a.t / 0.25);
      sx.drawImage(ART.tint(src, DATA.classes[P.cls].col), ax, ay);
      sx.globalAlpha = 1;
    }
    shadow(P.x, P.y + 7, 9);
    const step = rig ? 0 : P.moving ? Math.sin(P.animT * 14) : Math.sin(P.animT * 3) * 0.5;
    const blink = P.ifr > 0 && Math.floor(t * 20) % 2 === 0;
    if (ms) { if (!blink || P.invT > 0) drawPose(rig, psp, ms, P.x, py, P.facing < 0, P.hurtT > 0); }
    else if (!blink || P.invT > 0) drawSp(psp, P.x, py - Math.abs(step) * (P.moving ? 1.5 : 0.5), { flip: P.facing < 0, white: P.hurtT > 0, sy: 1 + step * 0.05, sxk: 1 - step * 0.03 });
    // ガード(見切り): 正面に光る弧。ジャスト受付中は白く明るい
    if (P.guard && P.cls === 'knight') { // 大盾: 全方向を守る金の輪(ゆっくり回る光)
      const cx = P.x - cam.x, cy = P.y - cam.y - 2, R = 13;
      for (let a = 0; a < TAU; a += 0.08) {
        const x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R * 0.85), lit = Math.abs(Math.sin(a * 2 - t * 4)) > 0.8;
        sx.fillStyle = gx.fillStyle = lit ? '#ffffff' : '#f2c84b'; gx.globalAlpha = lit ? 0.9 : 0.45; sx.fillRect(x, y, 1, 1); gx.fillRect(x, y, 1, 1);
      }
      gx.globalAlpha = 1;
    } else if (P.guard) {
      const just = P.guardT <= DATA.classes.samurai.params.parryWin, col = just ? '#ffffff' : '#9ff7ff';
      const a0 = P.facing < 0 ? Math.PI : 0, R = 11, cx = P.x - cam.x, cy = P.y - cam.y - 2;
      sx.fillStyle = gx.fillStyle = col;
      gx.globalAlpha = just ? 1 : 0.6;
      for (let a = -1.2; a <= 1.2; a += 0.1) {
        const x = Math.round(cx + Math.cos(a0 + a) * R), y = Math.round(cy + Math.sin(a0 + a) * R);
        sx.fillRect(x, y, 1, 1); gx.fillRect(x, y, 1, 1);
      }
      gx.globalAlpha = 1;
    }
    if (S.flamePuffs && S.flamePuffs.length) { // 火炎放射: 炎の塊。進むほど膨らみ、白 → 黄 → 橙 → 赤 → 煙(古いものから描いて、芯が上に来る)
      const PAL = [[0.05, '#fff6c8', '#dff8ff'], [0.2, '#ffc34a', '#7ad7ff'], [0.4, '#ff9a2a', '#4aa8f0'], [0.62, '#e8501a', '#2f6fd8'], [0.82, '#9a1e14', '#1f3f9a'], [1, '#3a2a2a', '#2a2a3a']];
      for (const f of S.flamePuffs) {
        const u = f.t / f.life, r = Math.max(1, Math.round(f.r0 + (f.r1 - f.r0) * Math.pow(u, 0.7) * (0.9 + 0.2 * Math.sin(t * 30 + f.seed * 9))));
        let col = PAL[PAL.length - 1];
        for (const c of PAL) if (u < c[0]) { col = c; break; }
        const smoke = u >= 0.82, x = f.x - cam.x, y = f.y - cam.y;
        sx.globalAlpha = smoke ? 0.35 * (1 - u) / 0.18 : 0.6;
        pDisc(sx, x, y, r, f.blue ? col[2] : col[1]);
        if (!smoke && u > 0.2) { gx.globalAlpha = 0.18 * (1 - u); pDisc(gx, x, y, Math.max(1, r - 1), f.blue ? col[2] : col[1]); }
      }
      sx.globalAlpha = gx.globalAlpha = 1;
    }
    if (P.flame) { // 杖先の噴き出し口と、炎に照らされた地面(ダブル放射は反対側にも)
      const f = P.flame;
      for (const a of f.dbl ? [f.a, f.a + Math.PI] : [f.a]) {
        const nx = P.x + Math.cos(a) * 9 - cam.x, ny = P.y - 6 + Math.sin(a) * 6 - cam.y;
        gx.globalAlpha = 0.5; pDisc(gx, nx, ny, 2 + Math.round(Math.random()), f.blue ? '#bff4ff' : '#ffc34a'); gx.globalAlpha = 1;
        pDisc(sx, nx, ny, 2, '#ffffff');
        addLight(P.x + Math.cos(a) * f.len * 0.5, P.y + Math.sin(a) * f.len * 0.5, f.len * 1.8, f.blue ? '#7ad7ff' : '#ff8a3d', 0.9 + 0.1 * Math.sin(t * 25));
      }
    }
    addLight(P.x, P.y, 105, DATA.classes[P.cls].light || '#ffe2b8', 0.95);
  }

  // ======== 自分の攻撃(手前側): ブレード・斬撃・弾・落雷・演出 ========
  mineOn();
  const bw = P.weapons.blade;
  if (bw && bw.blades) for (const b of bw.blades) {
    drawRot(bw.evo ? 'bladeEvo' : 'blade', b.a * 2, b.x, b.y);
    addLight(b.x, b.y, 16, bw.evo ? '#ffc93a' : '#d8e4ff', 0.6);
  }
  drawSlashes(false);
  // 聖剣: 上から降ってくる光の剣(落ちる → 刺さって光りながら消える)
  if (S.skyBlades && S.skyBlades.length) {
    S.skyBlades = S.skyBlades.filter(b => S.time - b.t0 < SKY_FALL + 0.3);
    for (const b of S.skyBlades) {
      const u = (S.time - b.t0) / SKY_FALL;
      if (u < 0) continue;
      if (b.e && !b.e.dead) { b.x = b.e.x; b.y = b.e.y; }
      const x = Math.round(b.x - cam.x), ground = Math.round(b.y - cam.y) + 2;
      const tip = u < 1 ? ground - Math.round(56 * (1 - u) * (1 - u)) : ground, fade = u < 1 ? 1 : 1 - (u - 1) * SKY_FALL / 0.3;
      sx.globalAlpha = gx.globalAlpha = Math.max(0, fade);
      for (let yy = tip - 15; yy <= tip - 2; yy++) { // 刀身(芯は白、縁は金)。下の 2 ドットは切っ先
        sx.fillStyle = '#ffffff'; sx.fillRect(x, yy, 1, 1);
        sx.fillStyle = '#ffe9a0'; sx.fillRect(x - 1, yy, 1, 1); sx.fillRect(x + 1, yy, 1, 1);
      }
      sx.fillStyle = '#ffffff'; sx.fillRect(x, tip - 1, 1, 2);
      gx.globalAlpha = 0.45 * Math.max(0, fade); gx.fillStyle = '#fff3a0'; gx.fillRect(x, tip - 15, 1, 16);
      sx.globalAlpha = Math.max(0, fade);
      sx.fillStyle = '#b8862a'; sx.fillRect(x - 3, tip - 16, 7, 2); sx.fillStyle = '#f2c84b'; sx.fillRect(x - 3, tip - 16, 7, 1); // 鍔
      sx.fillStyle = '#6b4a2c'; sx.fillRect(x, tip - 20, 1, 4); sx.fillStyle = '#f2c84b'; sx.fillRect(x, tip - 21, 1, 1); // 柄と柄頭
      if (u < 1) { gx.globalAlpha = 0.3; gx.fillStyle = '#fff3a0'; gx.fillRect(x, tip - 34, 1, 14); } // 落ちる軌跡
      sx.globalAlpha = gx.globalAlpha = 1;
      addLight(b.x, b.y - 8, 40, '#fff1d0', 0.8 * Math.max(0, fade));
    }
  }
  for (const p of projs) {
    if (!onScreen(p.x, p.y)) continue;
    switch (p.kind) {
      case 'arrow': case 'volley': { // 矢: 進む向きに沿って 6 ドット(先端・矢柄・矢羽)
        const a = Math.atan2(p.vy, p.vx), cx = p.x - cam.x, cy = p.y - cam.y, vol = p.kind === 'volley';
        if (vol) for (let i = 6; i < 18; i++) { // 一斉射撃の矢: 後ろに光の筋
          gx.globalAlpha = 1 - (i - 6) / 12; gx.fillStyle = '#b8ffb0'; gx.fillRect(Math.round(cx - Math.cos(a) * i), Math.round(cy - Math.sin(a) * i), 1, 1);
        }
        gx.globalAlpha = 1;
        for (let i = 0; i < 6; i++) {
          const x = Math.round(cx - Math.cos(a) * i), y = Math.round(cy - Math.sin(a) * i);
          sx.fillStyle = i === 0 ? '#ffffff' : i >= 4 ? (vol ? '#7dff9a' : '#7dff9a') : vol ? '#d8ffd0' : p.dbl ? '#ffe14a' : '#d9c9a0';
          sx.fillRect(x, y, 1, 1);
          if (vol || i === 0) { gx.fillStyle = vol ? '#b8ffb0' : p.col; gx.fillRect(x, y, 1, 1); }
        }
        addLight(p.x, p.y, vol ? 26 : 16, vol ? '#b8ffb0' : p.col, 0.6);
        break;
      }
      case 'bolt':
        drawSp(p.home ? ART.S.boltEvo : ART.S.bolt, p.x, p.y); addLight(p.x, p.y, 22, p.col, 0.7); break;
      case 'wisp': drawSp(ART.S.wisp, p.x, p.y + Math.sin(p.t * 20)); addLight(p.x, p.y, 24, '#9dffcf', 0.7); break;
      case 'fire': drawSp(ART.S.fire, p.x, p.y); addLight(p.x, p.y, 30, '#ff8a3d', 0.8); break;
      case 'axe': drawRot('axe', p.ang, p.x, p.y, { scale: p.big ? 2 : 1 }); break;
      case 'wave': { // 村正の斬撃波(三日月)
        const a = Math.atan2(p.vy, p.vx), fade = 1 - p.t / p.life;
        for (let i = -7; i <= 7; i++) {
          const u = i / 7, aa = a + u * 1.1, rr = 8 - u * u * 3;
          const px = Math.round(p.x + Math.cos(aa) * rr - cam.x), py = Math.round(p.y + Math.sin(aa) * rr - cam.y);
          sx.fillStyle = Math.abs(i) < 4 ? '#ffffff' : '#ff5d73'; sx.fillRect(px, py, 1, 2);
          gx.globalAlpha = fade; gx.fillStyle = '#ff5d73'; gx.fillRect(px, py, 2, 2); gx.globalAlpha = 1;
        }
        addLight(p.x, p.y, 30, '#ff5d73', 0.7 * fade);
        break;
      }
      case 'orbShot': pDisc(sx, p.x - cam.x, p.y - cam.y, 3, '#05020a'); pCircle(gx, p.x - cam.x, p.y - cam.y, 3, '#c78bff'); addLight(p.x, p.y, 20, '#c78bff', 0.7); break;
    }
  }
  for (const b of bolts) {
    const k = 1 - b.t / b.life;
    let px = b.x0, py = b.y0;
    const segs = 9;
    for (let i = 1; i <= segs; i++) {
      const u = i / segs, jx = i === segs ? 0 : rand(-6, 6), nx = lerp(b.x0, b.x1, u) + jx, ny = lerp(b.y0, b.y1, u) + (i === segs ? 0 : rand(-2, 2));
      pLine(sx, px - cam.x, py - cam.y, nx - cam.x, ny - cam.y, '#ffffff', b.w);
      gx.globalAlpha = k; pLine(gx, px - cam.x, py - cam.y, nx - cam.x, ny - cam.y, '#fff27a', b.w + 1); gx.globalAlpha = 1;
      px = nx; py = ny;
    }
  }
  drawParts(true);
  drawRings(true);
  mineOff();

  // ======== 敵の攻撃(最前面): ボスの技・敵弾・予兆 ========
  if (S.boss && !S.boss.dead) drawBossFx(S.boss);
  drawSlashes(true);
  drawParts(false);
  drawRings(false);
  for (const p of eprojs) {
    if (!onScreen(p.x, p.y, 30)) continue;
    const a = Math.atan2(p.vy, p.vx);
    if (p.lob) { // 放物線弾: 地面に影、高さぶん持ち上げて描く
      shadow(p.x, p.y + 2, p.kind === 'rock' ? 10 : 5);
      drawSp(ART.S[p.kind], p.x, p.y - p.z, { scale: p.kind === 'rock' ? 1 + p.z / 140 : 1, outline: '#ff3b5c' });
      addLight(p.x, p.y - p.z, 20, '#ff3b5c', 0.5);
      continue;
    }
    // 敵弾は形に沿った赤いアウトラインで自分の弾と区別する
    const ol = { outline: '#ff3b5c' };
    if (p.kind === 'boomer') drawRot('scythe', p.t * 16, p.x, p.y, { scale: 2, outline: '#ff3b5c' });
    else if (p.kind === 'glob' || p.kind === 'rbit') drawSp(ART.S[p.kind], p.x, p.y, ol);
    else if (p.kind === 'arrow') drawRot('arrow', a, p.x, p.y, ol);
    else if (p.kind === 'scythe') drawRot('scythe', p.t * 14, p.x, p.y, ol);
    else drawSp(ART.S.ball, p.x, p.y, ol);
    addLight(p.x, p.y, p.kind === 'boomer' ? 40 : 22, '#ff3b5c', 0.6);
  }
  // 予兆: 赤い半透明の塗り(時間とともに内側が満ちる) + 点滅する縁
  const edge = warnBlink ? '#ff3b5c' : '#ffd0d8';
  for (const w of warns) {
    const k = w.t / w.life, wx = w.x - cam.x, wy = w.y - cam.y;
    if (w.kind === 'line') {
      const ca = Math.cos(w.a), sa = Math.sin(w.a), nx = -sa * w.w / 2, ny = ca * w.w / 2;
      const quad = (len, a) => {
        sx.globalAlpha = a; sx.fillStyle = '#ff3b5c'; sx.beginPath();
        sx.moveTo(wx + nx, wy + ny); sx.lineTo(wx + ca * len + nx, wy + sa * len + ny);
        sx.lineTo(wx + ca * len - nx, wy + sa * len - ny); sx.lineTo(wx - nx, wy - ny); sx.fill();
      };
      quad(w.len, 0.18); quad(w.len * k, 0.22); sx.globalAlpha = 1;
      for (const s of [-1, 1]) {
        pLine(sx, wx + nx * s, wy + ny * s, wx + ca * w.len + nx * s, wy + sa * w.len + ny * s, edge);
        pLine(gx, wx + nx * s, wy + ny * s, wx + ca * w.len + nx * s, wy + sa * w.len + ny * s, '#ff3b5c');
      }
    } else {
      const R = Math.round(w.r);
      sx.globalAlpha = 0.18; pDisc(sx, wx, wy, R, '#ff3b5c');
      sx.globalAlpha = 0.22; pDisc(sx, wx, wy, Math.round(R * k), '#ff3b5c'); sx.globalAlpha = 1;
      pCircle(sx, wx, wy, R, edge); pCircle(gx, wx, wy, R, '#ff3b5c');
    }
  }

  drawMotes(st);

  // ---- ダメージ数値 ----
  for (const f of floats) {
    const k = f.t / f.life;
    const pop = (1 + 0.5 * (1 - easeOutCubic(f.t / 0.18))) * f.k;
    const w = f.img.width * pop, h = f.img.height * pop;
    sx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    sx.drawImage(f.img, Math.round(f.x - cam.x - w / 2), Math.round(f.y - cam.y - h / 2), Math.round(w), Math.round(h));
    sx.globalAlpha = 1;
  }

  // ---- マウス照準のカーソル ----
  if (mouse.aim && !P.dead) {
    const mx = Math.round(mouse.x), my = Math.round(mouse.y);
    pCircle(gx, mx, my, 4, '#ff5d73');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pLine(gx, mx + dx * 3, my + dy * 3, mx + dx * 7, my + dy * 7, '#ffffff');
  }

  // ---- タッチスティック ----
  if (touch.active) {
    const ox = touch.ox / GFX.PX, oy = touch.oy / GFX.PX;
    gx.globalAlpha = 0.4; pCircle(gx, ox, oy, 12, '#ffffff'); pDisc(gx, ox + touch.dx * 10, oy + touch.dy * 10, 4, '#ffffff'); gx.globalAlpha = 1;
  }
}

// ボス固有の付随表現(ゴーレムの拳・掲げた岩 / ドラゴンのブレス・ビーム・溜め)
function drawBossFx(e) {
  const sx = GFX.sctx, gx = GFX.gctx, ai = e.ai, ex = e.x - cam.x, ey = e.y - cam.y, sp = ART.S[e.boss], yo = -(e.jz || 0);
  if (e.fists) for (const f of e.fists) {
    pLine(sx, ex, ey, f.x - cam.x, f.y - cam.y, '#6a6258', 3);
    drawSp(ART.S.fist, f.x, f.y);
    addLight(f.x, f.y, 26, '#6ee7ff', 0.5);
  }
  if (e.hold) drawSp(ART.S.rock, e.x, e.y + yo - sp.h / 2 - 5);
  if (ai.act === 'breath') for (let r = 20; r < 125; r += 26) addLight(e.x + Math.cos(ai.ba) * r, e.y + Math.sin(ai.ba) * r, r * 0.9, '#ff6a2a', 0.7);
  if (ai.act === 'beam' && ai.bA != null) {
    const bx = ex + Math.cos(ai.bA) * BEAM_LEN, by = ey + Math.sin(ai.bA) * BEAM_LEN, fl = Math.floor(GFX.fx.time * 30) % 2;
    pLine(gx, ex, ey, bx, by, '#ff4a8a', 9 + fl * 2);
    pLine(sx, ex, ey, bx, by, '#ffd0f0', 5);
    pLine(sx, ex, ey, bx, by, '#ffffff', 3);
    for (let r = 0; r < BEAM_LEN; r += 40) addLight(e.x + Math.cos(ai.bA) * r, e.y + Math.sin(ai.bA) * r, 60, '#ff4a8a', 0.8);
  }
  if (ai.chg && ai.wind > 0) {
    gx.globalAlpha = 0.6; pCircle(gx, ex, ey, Math.round(10 + ai.wind * 20), '#ff4a8a', 2); gx.globalAlpha = 1;
    addLight(e.x, e.y, 120 - ai.wind * 50, '#ff4a8a', 1);
  }
}

// 環境パーティクル(ホタル・火の粉)。カメラに対して視差を付けて漂わせる
function drawMotes(st) {
  const gx = GFX.gctx, VW = GFX.VW, VH = GFX.VH, t = GFX.fx.time, m = st.motes;
  for (let i = 0; i < 26; i++) {
    const seedx = hash2(i, 7) * 1000, seedy = hash2(i, 13) * 1000;
    const wx = ((seedx + t * (m.rise ? 4 : 6) * (hash2(i, 3) - 0.5) * 2 - cam.x * 0.9) % (VW + 20) + VW + 20) % (VW + 20) - 10;
    const wy = ((seedy + (m.rise ? -t * 14 : Math.sin(t + i) * 8) - cam.y * 0.9) % (VH + 20) + VH + 20) % (VH + 20) - 10;
    gx.globalAlpha = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + i * 1.7));
    gx.fillStyle = m.col; gx.fillRect(Math.round(wx), Math.round(wy), 1, 1);
    if (i % 3 === 0) addLight(wx + cam.x, wy + cam.y, 14, m.col, 0.5);
  }
  gx.globalAlpha = 1;
}

// ============================================================
// FX 更新
// ============================================================
function updFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t >= p.life) { parts.splice(i, 1); continue; }
    const dr = Math.exp(-p.drag * dt);
    p.vx *= dr; p.vy *= dr; p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t += dt; f.y += f.vy * dt; f.vy *= Math.exp(-5 * dt); if (f.t >= f.life) floats.splice(i, 1); }
  for (const arr of [rings, slashes, bolts, warns, flashes]) for (let i = arr.length - 1; i >= 0; i--) { arr[i].t += dt; if (arr[i].t >= arr[i].life) arr.splice(i, 1); }
  // 斬撃のイベント(鬼神・村正の一閃など): 決まった時刻に一度だけ。処理中に slashes が増えてもいいように、集めてから実行する
  const due = [];
  for (const s of slashes) if (s.ev) for (const ev of s.ev) if (!ev.done && s.t >= ev.at) { ev.done = true; due.push(ev.fn); }
  for (const fn of due) fn();
  for (const w of warns) if (w.track) w.track(w); // 追随する予兆(発生源・向きを毎フレーム更新)
}
