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
function buildChunk(cx, cy, st) {
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
  const drawSlashes = enemy => {
    for (const s of slashes) {
      if (!!s.enemy !== enemy) continue;
      if (s.line) { // 一閃 / グランドクロス: 経路に走る鋭い光
        const k = easeOutCubic(s.t / s.life), w = Math.max(1, Math.round((s.w || 4) * (1 - k)));
        pLine(gx, s.x - cam.x, s.y - cam.y, s.x1 - cam.x, s.y1 - cam.y, '#ff3b5c', w + 2);
        pLine(sx, s.x - cam.x, s.y - cam.y, s.x1 - cam.x, s.y1 - cam.y, '#ffffff', w);
        addLight((s.x + s.x1) / 2, (s.y + s.y1) / 2, 90, '#ff5d73', 1 - k);
        continue;
      }
      const k = s.t / s.life, R = s.r, span = 1.9, n = 26;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        if (u > k * 1.6) break;
        const a = s.a + (s.flip ? -1 : 1) * (u - 0.5) * span, th = Math.sin(u * Math.PI) * 3 * (1 - k);
        for (let r = R * 0.55; r < R * 0.55 + th + 1; r++) {
          const px = Math.round(s.x + Math.cos(a) * r * (0.7 + 0.3 * k) - cam.x), py = Math.round(s.y + Math.sin(a) * r * (0.7 + 0.3 * k) - cam.y);
          const col = r > R * 0.55 + th - 1 ? '#ffffff' : s.evo ? '#ff3b5c' : '#ff8a9a';
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
    if (d.kind === 'chest' || d.kind === 'orb') {
      const col = d.kind === 'orb' ? '#b06ef0' : '#ffd23f';
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
    if (e.frost > 0 || e.stun > 0) {
      const ice = ART.variant(sp, flip ? 'iceFlip' : 'ice'), ix = Math.round(e.x - cam.x - sp.w * sc / 2), iy = Math.round(e.y + yo - cam.y - sp.h * sc / 2);
      sx.globalAlpha = e.stun > 0 ? 0.6 : Math.min(0.4, e.frost * 0.04); sx.drawImage(ice, ix, iy, sp.w * sc, sp.h * sc);
      gx.globalAlpha = sx.globalAlpha * 0.6; gx.drawImage(ice, ix, iy, sp.w * sc, sp.h * sc);
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
    if (P.after) for (const a of P.after) {
      sx.globalAlpha = 0.4 * (1 - a.t / 0.25);
      sx.drawImage(ART.variant(ART.S.player, a.f < 0 ? 'whiteFlip' : 'white'), Math.round(a.x - cam.x - ART.S.player.w / 2), Math.round(a.y - cam.y - ART.S.player.h / 2));
      gx.globalAlpha = 0.5 * (1 - a.t / 0.25);
      gx.drawImage(ART.variant(ART.S.player, a.f < 0 ? 'whiteFlip' : 'white'), Math.round(a.x - cam.x - ART.S.player.w / 2), Math.round(a.y - cam.y - ART.S.player.h / 2));
      sx.globalAlpha = gx.globalAlpha = 1;
    }
    shadow(P.x, P.y + 7, 9);
    const step = P.moving ? Math.sin(P.animT * 14) : Math.sin(P.animT * 3) * 0.5;
    const blink = P.ifr > 0 && Math.floor(t * 20) % 2 === 0;
    if (!blink || P.dashT > 0) drawSp(ART.S.player, P.x, P.y - Math.abs(step) * (P.moving ? 1.5 : 0.5), { flip: P.facing < 0, white: P.hurtT > 0, sy: 1 + step * 0.05, sxk: 1 - step * 0.03 });
    // HP・ダッシュゲージ
    const bx = Math.round(P.x - cam.x - 7), by = Math.round(P.y - cam.y + 10);
    sx.fillStyle = '#0c0913'; sx.fillRect(bx - 1, by - 1, 16, 4);
    sx.fillStyle = '#3a1520'; sx.fillRect(bx, by, 14, 1);
    sx.fillStyle = P.hp / P.maxhp < 0.3 ? (Math.floor(t * 8) % 2 ? '#ff3b5c' : '#ffffff') : '#ff3b5c';
    sx.fillRect(bx, by, Math.round(14 * clamp(P.hp / P.maxhp, 0, 1)), 1);
    sx.fillStyle = P.dashG >= P.dashCost ? '#9ff7ff' : '#3a5a70';
    sx.fillRect(bx, by + 1, Math.round(14 * clamp(P.dashG, 0, 1)), 1);
    addLight(P.x, P.y, 105, '#ffe2b8', 0.95);
  }

  // ======== 自分の攻撃(手前側): ブレード・斬撃・弾・落雷・演出 ========
  mineOn();
  const bw = P.weapons.blade;
  if (bw && bw.blades) for (const b of bw.blades) {
    drawRot(bw.evo ? 'bladeEvo' : 'blade', b.a * 2, b.x, b.y);
    addLight(b.x, b.y, 16, bw.evo ? '#ffc93a' : '#d8e4ff', 0.6);
  }
  drawSlashes(false);
  for (const p of projs) {
    if (!onScreen(p.x, p.y)) continue;
    switch (p.kind) {
      case 'bolt': drawSp(p.home ? ART.S.boltEvo : ART.S.bolt, p.x, p.y); addLight(p.x, p.y, 22, p.col, 0.7); break;
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
}
