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
// 時計塔の地面: 小さな石畳。ところどころに真鍮の歯車がはめこまれ(ほのかに光る)、鋲の打たれた真鍮の板、ひび、砂だまり
function buildClockChunk(cx, cy, st) {
  const c = ART.canvas(CH, CH), x = c.getContext('2d'), g = ART.canvas(CH, CH), gx = g.getContext('2d');
  const [g0, g1, g2, g3] = st.ground, [mortar, hi, brass, brassHi] = st.deco, T = 12;
  const ox = cx * CH, oy = cy * CH;
  x.fillStyle = mortar; x.fillRect(0, 0, CH, CH);
  for (let ty = 0; ty < CH; ty += T) {
    const off = (((oy + ty) / T) & 1) ? T / 2 : 0;
    for (let tx = -T; tx < CH + T; tx += T) {
      const px = tx + off, h = hash2(ox + px, oy + ty);
      x.fillStyle = h < 0.3 ? g1 : h < 0.55 ? g2 : h < 0.7 ? g3 : g0; x.fillRect(px + 1, ty + 1, T - 1, T - 1); // 石(目地は暗い)
      x.fillStyle = hi; x.globalAlpha = 0.22; x.fillRect(px + 1, ty + 1, T - 2, 1); x.fillRect(px + 1, ty + 1, 1, T - 2); x.globalAlpha = 1;
      if (h > 0.93) { x.fillStyle = mortar; x.fillRect(px + 3, ty + 5, 3, 1); x.fillRect(px + 5, ty + 6, 1, 3); } // 欠け
    }
  }
  for (let i = 0; i < 120; i++) { x.fillStyle = hash2(ox + i * 11, oy + i * 5) < 0.5 ? g3 : '#6a5a40'; x.fillRect((hash2(i, cx * 29 + cy) * CH) | 0, (hash2(cy * 19 + i, cx) * CH) | 0, 1, 1); } // 砂粒
  for (let i = 0; i < 8; i++) {
    const hx = (hash2(cx * 97 + i, cy * 57) * (CH - 22)) | 0, hy = (hash2(cy * 89 + i, cx * 43 + i) * (CH - 22)) | 0, kind = hash2(hx + ox, hy + oy);
    if (kind < 0.28) { // はめこまれた歯車(歯の数・大きさは場所ごと)
      const R = 5 + ((kind * 40) | 0) % 5, n = 8 + ((kind * 97) | 0) % 5, cx0 = hx + 10, cy0 = hy + 10;
      x.fillStyle = mortar; for (let a = 0; a < TAU; a += 0.08) x.fillRect(Math.round(cx0 + Math.cos(a) * (R + 2)), Math.round(cy0 + Math.sin(a) * (R + 2)), 1, 1);
      for (let a = 0; a < TAU; a += 0.1) { x.fillStyle = brass; x.fillRect(Math.round(cx0 + Math.cos(a) * R), Math.round(cy0 + Math.sin(a) * R), 1, 1); }
      for (let k = 0; k < n; k++) { const a = TAU / n * k; x.fillStyle = brass; x.fillRect(Math.round(cx0 + Math.cos(a) * (R + 1)), Math.round(cy0 + Math.sin(a) * (R + 1)), 2, 2); } // 床の歯車はくすんだ色で光らせない(転がる歯車の敵と見分ける)
      for (let k = 0; k < 4; k++) { const a = TAU / 4 * k + kind * 3; x.fillStyle = brass; x.fillRect(Math.round(cx0 + Math.cos(a) * R * 0.5), Math.round(cy0 + Math.sin(a) * R * 0.5), 1, 1); } // スポーク
      x.fillStyle = brassHi; x.fillRect(cx0 - 1, cy0 - 1, 2, 2); x.fillStyle = mortar; x.fillRect(cx0, cy0, 1, 1);
    } else if (kind < 0.42) { // 鋲の打たれた真鍮の板
      x.fillStyle = '#5a4424'; x.fillRect(hx, hy, 10, 6); x.fillStyle = brass; x.fillRect(hx, hy, 10, 1); x.fillRect(hx, hy, 1, 6);
      x.fillStyle = brassHi; x.fillRect(hx + 1, hy + 1, 1, 1); x.fillRect(hx + 8, hy + 1, 1, 1); x.fillRect(hx + 1, hy + 4, 1, 1); x.fillRect(hx + 8, hy + 4, 1, 1);
    } else if (kind < 0.62) { // ひび
      let lx = hx, ly = hy; x.fillStyle = mortar;
      for (let k = 0; k < 10; k++) { x.fillRect(lx, ly, 1, 1); lx += 1; ly = clamp(ly + (hash2(lx + ox, k) < 0.5 ? 1 : -1), 0, CH - 1); }
    } else if (kind < 0.8) { // 砂だまり
      x.fillStyle = '#8a7650'; x.fillRect(hx, hy + 1, 7, 1); x.fillRect(hx + 1, hy, 4, 1); x.fillRect(hx + 2, hy + 2, 5, 1);
      x.fillStyle = '#b89c68'; x.fillRect(hx + 2, hy, 2, 1);
    }
  }
  return { c, g };
}
// 王墓の地面: 黒紫の石畳。ひび(奥から紫の光がもれる)・頭蓋と骨・小さな墓標・毒の水たまり(緑にかすかに光る)・床のルーンの輪・燭台の蝋燭
//   蝋燭の位置は lights に入れて、drawGround が揺らめく光源を置く(光源は毎フレーム置き直すので、チャンクの絵には焼き込まない)
function buildTombChunk(cx, cy, st) {
  const c = ART.canvas(CH, CH), x = c.getContext('2d'), g = ART.canvas(CH, CH), gx = g.getContext('2d'), lights = [];
  const [g0, g1, g2, g3] = st.ground, [mortar, hi, venom, rune] = st.deco, T = 16;
  const ox = cx * CH, oy = cy * CH;
  x.fillStyle = mortar; x.fillRect(0, 0, CH, CH);
  for (let ty = 0; ty < CH; ty += T) {
    const off = (((oy + ty) / T) & 1) ? T / 2 : 0;
    for (let tx = -T; tx < CH + T; tx += T) {
      const px = tx + off, h = hash2(ox + px, oy + ty);
      x.fillStyle = h < 0.3 ? g1 : h < 0.55 ? g2 : h < 0.7 ? g3 : g0; x.fillRect(px + 1, ty + 1, T - 1, T - 1); // 石(目地は黒)
      x.fillStyle = hi; x.globalAlpha = 0.16; x.fillRect(px + 1, ty + 1, T - 2, 1); x.globalAlpha = 1; // 上の縁の照り
      if (h > 0.9) { x.fillStyle = mortar; x.fillRect(px + 4, ty + 7, 4, 1); x.fillRect(px + 7, ty + 8, 1, 3); } // 欠け
      else if (h > 0.45 && h < 0.5) { x.fillStyle = '#2a2236'; x.fillRect(px + 3, ty + 3, 3, 1); x.fillRect(px + 4, ty + 4, 1, 1); } // 染み
    }
  }
  for (let i = 0; i < 90; i++) { x.fillStyle = hash2(ox + i * 11, oy + i * 5) < 0.5 ? g3 : '#2a2238'; x.fillRect((hash2(i, cx * 29 + cy) * CH) | 0, (hash2(cy * 19 + i, cx) * CH) | 0, 1, 1); } // 砂ぼこり
  for (let i = 0; i < 9; i++) {
    const hx = 4 + ((hash2(cx * 97 + i, cy * 57) * (CH - 20)) | 0), hy = 6 + ((hash2(cy * 89 + i, cx * 43 + i) * (CH - 20)) | 0), kind = hash2(hx + ox, hy + oy);
    if (kind < 0.2) { // ひび: 奥から紫の光がもれる
      let lx = hx, ly = hy;
      for (let k = 0; k < 12; k++) {
        x.fillStyle = k % 4 === 0 ? '#5a3a8a' : mortar; x.fillRect(lx, ly, 1, 1);
        if (k % 4 === 0) { gx.fillStyle = '#1c0e2c'; gx.fillRect(lx, ly, 1, 1); }
        lx = clamp(lx + 1, 0, CH - 1); ly = clamp(ly + (hash2(lx + ox, k) < 0.5 ? 1 : -1), 0, CH - 1);
      }
    } else if (kind < 0.32) { // 頭蓋と骨
      x.fillStyle = '#0a080e'; x.fillRect(hx, hy + 4, 7, 1);
      x.fillStyle = '#b8b0a0'; x.fillRect(hx + 1, hy, 3, 1); x.fillRect(hx, hy + 1, 5, 2); x.fillRect(hx + 1, hy + 3, 3, 1);
      x.fillStyle = '#0a080e'; x.fillRect(hx + 1, hy + 1, 1, 1); x.fillRect(hx + 3, hy + 1, 1, 1); // 眼窩
      x.fillStyle = '#8a8478'; x.fillRect(hx + 5, hy + 3, 4, 1); x.fillRect(hx + 8, hy + 2, 1, 3); // 骨
    } else if (kind < 0.46) { // 小さな墓標(十字の石)
      x.fillStyle = '#0a080e'; x.fillRect(hx - 1, hy + 8, 7, 1);
      x.fillStyle = '#4a4458'; x.fillRect(hx + 2, hy, 1, 8); x.fillRect(hx, hy + 2, 5, 1);
      x.fillStyle = '#6a6478'; x.fillRect(hx + 2, hy, 1, 2); x.fillRect(hx, hy + 2, 1, 1);
      x.fillStyle = '#2a2436'; x.fillRect(hx, hy + 7, 5, 1);
    } else if (kind < 0.58) { // 毒の水たまり(緑にかすかに光る)
      x.fillStyle = '#1a3a1a'; x.fillRect(hx, hy + 1, 8, 2); x.fillRect(hx + 1, hy, 5, 1); x.fillRect(hx + 2, hy + 3, 4, 1);
      x.fillStyle = '#3a8a3a'; x.fillRect(hx + 2, hy + 1, 3, 1); x.fillStyle = venom; x.fillRect(hx + 2, hy + 1, 1, 1);
      gx.fillStyle = '#0e2a0c'; gx.fillRect(hx + 1, hy + 1, 6, 2);
    } else if (kind < 0.68) { // 床に刻まれたルーン文字(3文字。紫にかすかに光る)
      const RUNES = ['101111101010010', '110101110101101', '100110101100100', '010111010010010', '101101010101101'];
      for (let k = 0; k < 3; k++) {
        const g0 = RUNES[((kind * 97 + k * 3) * 10 | 0) % RUNES.length], bx = hx + k * 4;
        for (let p = 0; p < 15; p++) if (g0[p] === '1') { x.fillStyle = '#3a2a52'; x.fillRect(bx + (p % 3), hy + ((p / 3) | 0), 1, 1); gx.fillStyle = '#140a20'; gx.fillRect(bx + (p % 3), hy + ((p / 3) | 0), 1, 1); }
      }
      x.fillStyle = rune; x.fillRect(hx + 5, hy + 2, 1, 1); gx.fillStyle = '#2a1640'; gx.fillRect(hx + 5, hy + 2, 1, 1); // 真ん中の文字だけ少し強く光る
    } else if (kind < 0.8) { // 燭台の蝋燭(2〜3本。炎は光の層と光源)
      const n = 2 + (kind > 0.74 ? 1 : 0);
      x.fillStyle = '#0a080e'; x.fillRect(hx - 1, hy + 7, n * 3 + 1, 1);
      x.fillStyle = '#3a3048'; x.fillRect(hx - 1, hy + 6, n * 3 + 1, 1); // 燭台の皿
      for (let k = 0; k < n; k++) {
        const bx = hx + k * 3, H = 3 + ((((kind * 37 + k * 7) * 10) | 0) % 3);
        x.fillStyle = '#d8d0c0'; x.fillRect(bx, hy + 6 - H, 1, H); x.fillStyle = '#a8a090'; x.fillRect(bx + 1, hy + 7 - H, 1, H - 1); // 蝋(垂れた側は暗い)
        x.fillStyle = '#ffd27a'; x.fillRect(bx, hy + 4 - H, 1, 2); x.fillStyle = '#fff6c8'; x.fillRect(bx, hy + 5 - H, 1, 1);
        gx.fillStyle = '#c87a2a'; gx.fillRect(bx, hy + 4 - H, 1, 2);
      }
      lights.push({ x: hx + n * 1.5, y: hy + 2, s: kind * 50 });
    }
  }
  return { c, g, lights };
}
function buildChunk(cx, cy, st) {
  if (st.tiles) return buildTileChunk(cx, cy, st);
  if (st.clock) return buildClockChunk(cx, cy, st);
  if (st.tomb) return buildTombChunk(cx, cy, st);
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
  // 装飾(草・花・石・骨・溶岩)。晶窟は結晶の群れ・岩・光る小石
  for (let i = 0; i < 26; i++) {
    const hx = (hash2(cx * 97 + i, cy * 57) * (CH - 8)) | 0, hy = (hash2(cy * 89 + i, cx * 43 + i) * (CH - 8)) | 0;
    const kind = hash2(hx + ox, hy + oy);
    if (st.crystal) { crystalDeco(x, gx, hx, hy, kind, hash2(hx * 3 + ox, hy * 5 + oy)); continue; }
    if (st.sea) { seaDeco(x, gx, hx, hy, kind, hash2(hx * 3 + ox, hy * 5 + oy), st.deco); continue; }
    if (st.snow) { snowDeco(x, gx, hx, hy, kind, hash2(hx * 3 + ox, hy * 5 + oy), st.deco); continue; }
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
// 晶窟の地面の装飾: 七色の結晶の群れ(光る)/ 岩 / 小さな光る石
const CRYSTAL_COLS = [['#7ad7ff', '#d8f8ff', '#2a5a8a'], ['#ff8ad8', '#ffd0f0', '#7a2a6a'], ['#ffd23f', '#fff6c8', '#7a5a10'], ['#7dff9a', '#d8ffe0', '#1a6a3a'], ['#a88aff', '#e8d8ff', '#3a2a7a']];
function crystalDeco(x, gx, hx, hy, kind, h2) {
  const [cMain, cHi, cDark] = CRYSTAL_COLS[(h2 * CRYSTAL_COLS.length) | 0];
  if (kind < 0.4) { // 結晶の群れ: 高さの違う 2〜3本の柱
    const n = 2 + (h2 > 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const bx = hx + k * 3, H = 3 + (((h2 * 7 + k * 3) % 1) * 5 | 0), by = hy + 7;
      for (let j = 0; j < H; j++) {
        const w = j > H - 2 ? 1 : 2;
        x.fillStyle = j > H - 3 ? cHi : j < 2 ? cDark : cMain; x.fillRect(bx, by - j, w, 1);
        if (j > H - 3) { gx.fillStyle = cMain; gx.fillRect(bx, by - j, 1, 1); }
      }
    }
    x.fillStyle = '#0c0913'; x.fillRect(hx - 1, hy + 8, n * 3 + 2, 1);
  } else if (kind < 0.62) { // 岩
    x.fillStyle = '#0c0913'; x.fillRect(hx, hy + 3, 6, 1);
    x.fillStyle = '#3a3050'; x.fillRect(hx, hy + 1, 6, 2); x.fillRect(hx + 1, hy, 4, 1);
    x.fillStyle = '#5a4a7a'; x.fillRect(hx + 1, hy, 2, 1);
  } else if (kind < 0.85) { // 光る小石
    x.fillStyle = cMain; x.fillRect(hx, hy, 1, 1); x.fillStyle = cDark; x.fillRect(hx + 1, hy, 1, 1);
    gx.fillStyle = cMain; gx.fillRect(hx, hy, 1, 1);
  }
}
// 海淵の海底の装飾: 揺れる海藻 / 枝珊瑚(先がほのかに光る)/ 貝 / 岩 / 砂紋 / 光る夜光虫
function seaDeco(x, gx, hx, hy, kind, h2, [d0, d1, d2c, d3]) {
  if (kind < 0.3) { // 海藻: 高さの違う 2〜3本がうねる
    const n = 2 + (h2 > 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) { // 葉は同じ向きにゆるく曲がる(隣と交差しないように)
      const H = 5 + (((h2 * 7 + k * 3) % 1) * 5 | 0), bx = hx + k * 4;
      for (let j = 0; j < H; j++) { const sw = Math.round(Math.sin(j * 0.35 + h2 * 3) * 1.4); x.fillStyle = j > H - 3 ? d1 : d0; x.fillRect(bx + sw, hy + 8 - j, 1, 1); if (j < 2) x.fillRect(bx + sw + 1, hy + 8 - j, 1, 1); }
    }
  } else if (kind < 0.48) { // 枝珊瑚
    const col = h2 < 0.5 ? d2c : d3, dark = h2 < 0.5 ? '#7a2a3a' : '#7a4a20';
    x.fillStyle = '#0a1a1e'; x.fillRect(hx, hy + 7, 7, 1);
    x.fillStyle = dark; x.fillRect(hx + 3, hy + 3, 1, 4);
    x.fillStyle = col; x.fillRect(hx + 1, hy + 2, 1, 3); x.fillRect(hx + 5, hy + 1, 1, 4); x.fillRect(hx + 2, hy + 4, 1, 1); x.fillRect(hx + 4, hy + 3, 1, 1); x.fillRect(hx + 3, hy, 1, 3);
    gx.fillStyle = h2 < 0.5 ? '#3a1a22' : '#3a2a14'; gx.fillRect(hx + 1, hy + 2, 1, 1); gx.fillRect(hx + 5, hy + 1, 1, 1); gx.fillRect(hx + 3, hy, 1, 1); // 光の層は暗い色で
  } else if (kind < 0.6) { // 貝
    x.fillStyle = '#0a1a1e'; x.fillRect(hx, hy + 3, 5, 1);
    x.fillStyle = h2 < 0.5 ? '#e8d8c8' : '#ffc0c8'; x.fillRect(hx, hy + 1, 5, 2); x.fillRect(hx + 1, hy, 3, 1);
    x.fillStyle = '#a89888'; x.fillRect(hx + 1, hy + 1, 1, 2); x.fillRect(hx + 3, hy + 1, 1, 2);
  } else if (kind < 0.74) { // 岩
    x.fillStyle = '#081418'; x.fillRect(hx, hy + 3, 7, 1);
    x.fillStyle = '#2a4048'; x.fillRect(hx, hy + 1, 7, 2); x.fillRect(hx + 1, hy, 5, 1);
    x.fillStyle = '#4a6a70'; x.fillRect(hx + 1, hy, 2, 1);
    if (h2 > 0.6) { x.fillStyle = d0; x.fillRect(hx + 4, hy, 2, 1); } // 苔
  } else if (kind < 0.86) { // 砂紋
    x.fillStyle = '#1a3e48';
    for (let k = 0; k < 7; k++) x.fillRect(hx + k, hy + Math.round(Math.sin(k * 0.9 + h2 * 6)), 1, 1);
  } else { // 夜光虫
    x.fillStyle = '#bff4ff'; x.fillRect(hx, hy, 1, 1);
    gx.fillStyle = '#7ad7ff'; gx.fillRect(hx, hy, 1, 1);
  }
}
// 霊峰の地面の装飾: 雪の吹きだまり / 氷の割れ目(ほのかに光る)/ 雪をかぶった岩 / 針葉樹の若木 / 足跡 / 氷の結晶
function snowDeco(x, gx, hx, hy, kind, h2, [d0, d1, d2c, d3]) {
  if (kind < 0.3) { // 吹きだまり
    x.fillStyle = d0; x.fillRect(hx + 1, hy + 4, 7, 1);
    x.fillStyle = d1; x.fillRect(hx, hy + 2, 8, 2); x.fillRect(hx + 2, hy + 1, 4, 1);
    x.fillStyle = '#ffffff'; x.fillRect(hx + 2, hy + 1, 2, 1); x.fillRect(hx + 1, hy + 2, 2, 1);
  } else if (kind < 0.42) { // 氷の割れ目
    let lx = hx, ly = hy;
    for (let k = 0; k < 9; k++) {
      x.fillStyle = '#9fd8ff'; x.fillRect(lx, ly, 1, 1); gx.fillStyle = '#16303e'; gx.fillRect(lx, ly, 1, 1);
      lx = clamp(lx + 1, 0, CH - 1); ly = clamp(ly + (hash2(lx * 7, k + h2 * 50) < 0.5 ? 1 : 0), 0, CH - 1);
    }
  } else if (kind < 0.56) { // 雪をかぶった岩
    x.fillStyle = '#1a2030'; x.fillRect(hx, hy + 4, 7, 1);
    x.fillStyle = '#3a4458'; x.fillRect(hx, hy + 2, 7, 2); x.fillRect(hx + 1, hy + 1, 5, 1);
    x.fillStyle = '#ffffff'; x.fillRect(hx + 1, hy, 4, 1); x.fillRect(hx, hy + 1, 3, 1);
  } else if (kind < 0.66) { // 針葉樹の若木(枝に雪)
    x.fillStyle = '#1a2030'; x.fillRect(hx, hy + 8, 7, 1);
    x.fillStyle = '#4a3a2a'; x.fillRect(hx + 3, hy + 6, 1, 2);
    x.fillStyle = d2c; for (const [ox, oy, w] of [[3, 0, 1], [2, 1, 3], [3, 2, 1], [2, 3, 3], [1, 4, 5], [2, 5, 3], [0, 6, 7]]) x.fillRect(hx + ox, hy + oy, w, 1);
    x.fillStyle = '#ffffff'; x.fillRect(hx + 3, hy, 1, 1); x.fillRect(hx + 2, hy + 1, 1, 1); x.fillRect(hx + 2, hy + 3, 1, 1); x.fillRect(hx + 1, hy + 4, 2, 1); x.fillRect(hx, hy + 6, 2, 1);
  } else if (kind < 0.78) { // 足跡
    x.fillStyle = d0; for (let k = 0; k < 4; k++) x.fillRect(hx + k * 3, hy + (k % 2) * 2, 1, 1);
  } else if (kind < 0.9) { // 氷の結晶(ほのかに光る)
    x.fillStyle = d3; x.fillRect(hx + 1, hy, 1, 3); x.fillRect(hx, hy + 1, 3, 1);
    gx.fillStyle = '#2a5a6a'; gx.fillRect(hx + 1, hy + 1, 1, 1);
  }
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
    if (ch.lights) for (const L of ch.lights) { const tt = GFX.fx.time; addLight(cx * CH + L.x, cy * CH + L.y, 48 + 5 * Math.sin(tt * 9 + L.s), '#ff9b3d', 0.5 + 0.12 * Math.sin(tt * 13 + L.s * 3)); } // 王墓の蝋燭: 揺らめく灯
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
  if (e.ai === 'roll') return s[Math.floor((e.spin || 0) * 1.3) % s.length]; // 歯車: 転がった距離でコマを送る
  if (e.ai === 'burrow') return s[Math.floor(e.t * 3) % s.length]; // マグマワーム: ゆっくり口を開け閉め
  if (e.ai === 'skitter') return s[e.run ? Math.floor(e.t * 14) % s.length : 0]; // 毒蜘蛛: 走っている間だけ脚を動かす
  if (e.type === 'shadoweye') return s[e.wind > 0 ? 1 : 0]; // 影の眼: 撃つ前に見開く
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
function drawPose(rig, sp, ms, x, y, flip, white, emitImg) { // emitImg: 発光の絵の差し替え(バーサーカーの戦化粧の明るさ)
  const sx = GFX.sctx, gx = GFX.gctx, sg = flip ? -1 : 1;
  const fx = Math.round(x - cam.x), fy = Math.round(y - cam.y + sp.h / 2 - 1), ax = sp.w / 2, ay = sp.h - 1;
  const img = white ? ART.variant(sp, 'white') : sp.c;
  sx.setTransform(sg, 0, -ms.lean * sg, ms.sy, fx, fy); sx.drawImage(img, -ax, -ay); sx.setTransform(1, 0, 0, 1, 0, 0);
  if (sp.e) { gx.globalAlpha = 0.9; gx.setTransform(sg, 0, -ms.lean * sg, ms.sy, fx, fy); gx.drawImage(white ? img : emitImg || sp.e, -ax, -ay); gx.setTransform(1, 0, 0, 1, 0, 0); gx.globalAlpha = 1; }
  const hist = P.anim.hist || (P.anim.hist = []);
  if (ms.bow && ms.hand) { const rx = 1 + rig.padX + ms.hand[0] - ax, ry = 1 + ms.hand[1] - ay; drawBow(fx + sg * (rx - ms.lean * ry), fy + ms.sy * ry, flip ? Math.PI - ms.bowAng : ms.bowAng, ms.pull || 0, ms.arrow, ms.glow); }
  if (ms.icon && ms.hand) { const rx = 1 + rig.padX + ms.hand[0] - ax, ry = 1 + ms.hand[1] - ay; drawHeld(ms.icon, fx + sg * (rx - ms.lean * ry), fy + ms.sy * ry, flip); } // 手に持った武器(ウェポンマスター)
  if (!ms.blade || !ms.hand) { hist.length = 0; return; }
  const rx = 1 + rig.padX + ms.hand[0] - ax, ry = 1 + ms.hand[1] - ay;
  const hx = fx + sg * (rx - ms.lean * ry), hy = fy + ms.sy * ry;
  const ang = flip ? Math.PI - ms.ang : ms.ang, T = P.anim.t, L = ms.len || BLADE_LEN; // len: 持ち物の長さ(バーサーカーの斧)
  // スミア: 直近の角度の範囲を扇形に塗る(新しい角度ほど明るい)。smear: 色(既定は白っぽい青)
  hist.push({ t: T, a: ang }); while (hist.length && T - hist[0].t > 0.07) hist.shift();
  let a0 = Infinity, a1 = -Infinity;
  for (const h of hist) { const d = Math.atan2(Math.sin(h.a - ang), Math.cos(h.a - ang)); a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
  if (a1 - a0 > 0.25) {
    const span = a1 - a0;
    for (let yy = -L - 1; yy <= L + 1; yy++) for (let xx = -L - 1; xx <= L + 1; xx++) {
      const d = Math.hypot(xx, yy); if (d < 3 || d > L + 0.5) continue;
      const da = Math.atan2(Math.sin(Math.atan2(yy, xx) - ang), Math.cos(Math.atan2(yy, xx) - ang));
      if (da < a0 || da > a1) continue;
      const alpha = 0.55 * (1 - Math.abs(da) / (span + 0.01)) * (d / L);
      sx.globalAlpha = gx.globalAlpha = alpha * SET.fxA; sx.fillStyle = gx.fillStyle = ms.smear || '#eaf4ff';
      sx.fillRect(Math.round(hx + xx), Math.round(hy + yy), 1, 1); gx.fillRect(Math.round(hx + xx), Math.round(hy + yy), 1, 1);
    }
    sx.globalAlpha = gx.globalAlpha = 1;
  }
  // 刀身(柄は金)。斧(axe)は木の柄で光らない
  const seen = new Set();
  for (let i = 0; i <= L; i++) {
    const px = Math.round(hx + Math.cos(ang) * i), py = Math.round(hy + Math.sin(ang) * i), k = px * 1000 + py;
    if (seen.has(k)) continue; seen.add(k);
    if (ms.axe) { sx.fillStyle = i < L - 3 ? '#6a4424' : '#5a5f6a'; sx.fillRect(px, py, 1, 1); continue; }
    sx.fillStyle = i < 2 ? '#d6ae5c' : '#eaf4ff'; sx.fillRect(px, py, 1, 1);
    if (i >= 2) { gx.fillStyle = '#eaf4ff'; gx.fillRect(px, py, 1, 1); }
  }
  if (ms.axe) { // 斧の刃: 先端の片側(振る向きの前)に張り出す。背に小さなとがり。big は刃が大きい(狂乱の大斧)
    const nx = -Math.sin(ang) * sg, ny = Math.cos(ang) * sg, W = ms.big ? 3 : 2;
    for (let i = L - 3; i <= L; i++) for (let s = -1; s <= W; s++) {
      if (s === 0 || (s < 0 && i < L - 1) || (s === W && (i === L - 3 || i === L))) continue; // 柄の上・背のとがり以外・刃の角
      const px = Math.round(hx + Math.cos(ang) * i + nx * s), py = Math.round(hy + Math.sin(ang) * i + ny * s);
      sx.fillStyle = s === W || (s === W - 1 && (i === L - 3 || i === L)) ? '#e8eef6' : '#8d97a6'; sx.fillRect(px, py, 1, 1);
    }
  }
}
// 手に持った武器: 武器のアイコン(9×9)を手の位置 (hx, hy)(画面の座標)の少し上に描く。光の層には描かない(白く飛ぶため)
function drawHeld(k, hx, hy, flip, alpha = 1) {
  const ic = ART.S.icons[k];
  if (!ic) return;
  const sx = GFX.sctx;
  sx.globalAlpha = alpha;
  sx.drawImage(flip ? ART.variant(ic, 'flip') : ic.c, Math.round(hx - ic.w / 2), Math.round(hy - ic.h + 2));
  sx.globalAlpha = 1;
}
// 体の縁の光(バーサーカーの狂乱・不屈): スプライトの形の単色を上下左右へ 1ドットずらして本体の後ろに描く
//   光の層には別の暗い色(gcol)で描き、本体の形でくり抜いて縁の 1ドットだけを光らせる(体ごと光るとブルームで丸く白く飛ぶため)
//   光の層は透明度では暗くならない(色そのままで光る)ので、明るさは gcol の色で決める
//   ms があればスキルのモーション中(drawPose と同じ変形)、なければ待機・歩き(drawSp と同じ位置)
function drawRim(psp, ms, x, y, flip, col, a, gcol) {
  const sx = GFX.sctx, gx = GFX.gctx, D = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const sg = flip ? -1 : 1, fx = Math.round(x - cam.x), fy = Math.round(y - cam.y + psp.h / 2 - 1), src = ms ? psp.c : flip ? ART.variant(psp, 'flip') : psp.c;
  const dx = Math.round(x - cam.x - psp.w / 2), dy = Math.round(y - cam.y - psp.h / 2);
  const put = (c, img, ox, oy) => {
    if (ms) { c.setTransform(sg, 0, -ms.lean * sg, ms.sy, fx + ox, fy + oy); c.drawImage(img, -psp.w / 2, -(psp.h - 1)); c.setTransform(1, 0, 0, 1, 0, 0); }
    else c.drawImage(img, dx + ox, dy + oy);
  };
  sx.globalAlpha = a; for (const [ox, oy] of D) put(sx, ART.tint(src, col), ox, oy); sx.globalAlpha = 1;
  if (!gcol) return;
  for (const [ox, oy] of D) put(gx, ART.tint(src, gcol), ox, oy);
  gx.globalCompositeOperation = 'destination-out'; put(gx, src, 0, 0); gx.globalCompositeOperation = 'source-over';
}
// バーサーカー: 体の縁の光 [色, 濃さ, 光の層の色](狂乱は赤く脈打ち、不屈は暗い赤で光らせない)
const bkRim = t => (P.frenzy ? ['#7a0e1c', 0.75 + 0.15 * Math.sin(t * 12), Math.sin(t * 12) > 0 ? '#3a0610' : '#2a040a'] : P.firmT > 0 ? ['#4a0810', 0.9, null] : null);
// 発光の絵を明るさの段階 lv(0〜n-1)で暗くしたもの(光の層は透明度では暗くならないので、色そのものを暗くする)。段階ごとにキャッシュ
const dimCache = new WeakMap();
function dimEmit(e, lv, n = 6) {
  if (!e || lv >= n - 1) return e;
  let a = dimCache.get(e);
  if (!a) dimCache.set(e, a = []);
  if (!a[lv]) {
    const c = ART.canvas(e.width, e.height), x = c.getContext('2d'), v = Math.round(255 * (0.12 + 0.88 * lv / (n - 1)));
    x.drawImage(e, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(e, 0, 0);
    a[lv] = c;
  }
  return a[lv];
}
// バーサーカーの戦化粧の光り方の段階: 怒りが溜まるほど明るい(狂乱中は最大)。目(怒りが上限・狂乱中だけ赤い)も同じ絵なので一緒に明るくなる
const bkPaintLv = () => (P.frenzy ? 5 : Math.round(5 * Math.min(1, P.rage / bkRageMax())));
// ウェポンマスター: 影の追撃の影と、武神降臨の分身(自分の後ろに描く)。shades = true: 影だけ(自分の攻撃なので「攻撃の濃さ」の層に描く)/ false: 分身だけ
//   影: 黒い影が一瞬現れ、まねた武器を手に前へ突き出して、薄れて消える(銅色の縁取り)
//   分身: 半透明の自分(銅色の縁取り。光の層には暗い銅の縁だけ)。今使っている武器を手に持つ(持ち替えた直後は少し掲げる)。現れるとき・消えるときは薄く
function drawWm(rig, t, shades) {
  if (P.cls !== 'weaponmaster' || !rig) return;
  const sx = GFX.sctx, base = rig.base, foot = y => y - (base.h - ART.S.player.h) / 2; // 足元の位置を旧プレイヤーと揃える
  if (shades) for (const s of P.shades) {
    const u = s.t / WM_SHADE_LIFE, a = s.t < 0.06 ? s.t / 0.06 : 1 - Math.max(0, (u - 0.45) / 0.55), flip = s.face < 0, y = foot(s.y);
    const pose = weaponmasterPose(s.t < 0.2 ? 1 : 0, { L: s.t < 0.2 ? 1 : 0, arm: s.t < 0.25 ? 'forward' : 'base', legs: s.t < 0.25 ? 'stepA' : 'base' }), sp = rig.pose(pose.p);
    shadow(s.x, s.y + 7, 7 * a);
    drawRim(sp, null, s.x, y, flip, WM_COL, 0.5 * a, null);
    sx.globalAlpha = 0.8 * a; sx.drawImage(ART.tint(flip ? ART.variant(sp, 'flip') : sp.c, '#140e0c'), Math.round(s.x - cam.x - sp.w / 2), Math.round(y - cam.y - sp.h / 2)); sx.globalAlpha = 1;
    const hx = s.x + (flip ? -1 : 1) * (pose.hand[0] + 1 - sp.w / 2 + rig.padX), hy = y - sp.h / 2 + pose.hand[1] + 1;
    drawHeld(s.k, hx, hy, flip, 0.9 * a);
  }
  if (shades) return;
  const c = P.wmClone;
  if (!c) return;
  const end = c.i >= c.list.length && !c.chans.length ? Math.min(1, Math.max(0, Math.max(c.stay, c.lastT + 0.35) - c.t) / 0.25) : 1;
  const a = Math.min(1, c.t / 0.15, end), flip = c.face < 0, y = foot(c.y), raise = c.curT < 0.25;
  const moving = Math.hypot(P.x + c.side * 16 - c.x, P.y + 1 - c.y) > 2 || P.moving;
  const pose = raise ? weaponmasterPose(0, { arm: 'raise', armDy: -2, legs: 'stepB' }) : weaponmasterPose(0, { arm: 'forward', legs: moving ? (Math.floor(t * 9) % 2 ? 'stepA' : 'stepB') : 'base' });
  const sp = rig.pose(pose.p), img = flip ? ART.variant(sp, 'flip') : sp.c, dx = Math.round(c.x - cam.x - sp.w / 2), dy = Math.round(y - cam.y - sp.h / 2);
  shadow(c.x, c.y + 7, 8 * a);
  // 縁は暗めの銅(足元の光で明るくなるので、クラスの色そのままだと白っぽく飛ぶ)。光の層には暗い銅の縁だけ
  drawRim(sp, null, c.x, y, flip, '#8a5a2a', 0.85 * a, '#2a1a0c');
  sx.globalAlpha = 0.7 * a; sx.drawImage(ART.tint(img, '#16121a'), dx, dy); // 影の体
  sx.globalAlpha = 0.3 * a; sx.drawImage(img, dx, dy);                      // うっすら自分の姿(鉢金・背中の武器)
  sx.globalAlpha = 1;
  if (c.cur) {
    const hx = c.x + (flip ? -1 : 1) * (pose.hand[0] + 1 - sp.w / 2 + rig.padX), hy = y - sp.h / 2 + pose.hand[1] + 1;
    drawHeld(c.cur, hx, hy, flip, 0.9 * a);
  }
}
// バーサーカー: 足元の昂りの輪(段の数だけ重なる。最大で脈打つ)
function drawBerserkRings(t) {
  if (P.cls !== 'berserker' || P.dead) return;
  const n = bkFervorN();
  if (!n) return;
  const sx = GFX.sctx, gx = GFX.gctx, cx = P.x - cam.x, cy = P.y - cam.y + 7, full = n >= BK().fervorMax, pulse = full ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
  gx.globalAlpha = 1;
  for (let i = 0; i < n; i++) {
    const R = 7 + i * 3 + (full && pulse > 0.5 ? 1 : 0), m = Math.round(R * 4.5);
    for (let j = 0; j < m; j++) {
      const a = j * TAU / m, x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R * 0.38);
      sx.globalAlpha = 0.45 + 0.3 * pulse; sx.fillStyle = '#4a0810'; sx.fillRect(x, y, 1, 1);
      if (full && pulse > 0.6) { gx.fillStyle = '#1e0306'; gx.fillRect(x, y, 1, 1); } // 最大で脈打つ(光の層は色で明るさが決まるので、ごく暗い赤)
    }
  }
  sx.globalAlpha = gx.globalAlpha = 1;
}

function render() {
  const { lctx: lx, VW, VH } = GFX;
  if (GFX.overOn) { GFX.octx.clearRect(0, 0, VW, VH); GFX.overOn = false; } // 前景(重力崩壊の特異点)と重力レンズは毎フレーム描き直す
  GFX.lenses.length = 0;
  const REAL_S = GFX.sctx, REAL_G = GFX.gctx;
  let sx = REAL_S, gx = REAL_G;
  sx.setTransform(1, 0, 0, 1, 0, 0); gx.setTransform(1, 0, 0, 1, 0, 0);
  gx.clearRect(0, 0, VW, VH);
  lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1;
  lx.fillStyle = '#000'; lx.fillRect(0, 0, GFX.light.width, GFX.light.height);
  lx.globalCompositeOperation = 'lighter';

  const st = DATA.stages[S ? S.stage - 1 : 0], LM = st.light ?? 1; // light: 光源の強さ(明るい雪原では弱めないと白く飛ぶ)
  GFX.lightMul = LM;
  // 環境光・グレーディングを滑らかに遷移。闇の霧は環境光を暗く、青紫に寄せる(光源のまわりだけが見える)
  const fk = fogDarkK(), ink = S && (S.inInk || (P && P.darkT > 0)) ? 0.4 : 1; // 墨だまり(クラーケン)の中・暗闇(王墓)は暗い
  for (let i = 0; i < 3; i++) { GFX.ambient[i] = lerp(GFX.ambient[i], st.amb[i] * (1 - 0.55 * fk) * (i === 2 ? 1 + 0.3 * fk : 1) * ink, ink < 1 ? 0.08 : 0.03); GFX.tint[i] = lerp(GFX.tint[i], st.tint[i] * (i === 1 ? 1 - 0.12 * fk : 1), 0.03); }

  drawGround();
  if (!S || S.demo) return drawMotes(st);
  const t = GFX.fx.time;
  if (S.mode === 'arena') drawArena(t);

  // 自分の攻撃は専用レイヤーへ描き、「攻撃の濃さ」の透明度でまとめて合成する(重なっても濃くならない)
  const layered = SET.fxA < 0.999;
  const mineOn = () => {
    GFX.lightMul = SET.fxA * LM;
    if (!layered) return;
    GFX.msctx.clearRect(0, 0, VW, VH); GFX.mgctx.clearRect(0, 0, VW, VH);
    GFX.sctx = sx = GFX.msctx; GFX.gctx = gx = GFX.mgctx;
  };
  const mineOff = () => {
    GFX.lightMul = LM;
    if (!layered) return;
    GFX.sctx = sx = REAL_S; GFX.gctx = gx = REAL_G;
    sx.globalAlpha = SET.fxA; sx.drawImage(GFX.mscene, 0, 0); sx.globalAlpha = 1;
    // 光の層は透明度が効かない(シェーダーは色だけを足す。透明な所に薄く重ねても明るさは落ちない)ので、色を暗くしてから加算で重ねる
    const mg = GFX.mgctx;
    mg.save(); mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.globalCompositeOperation = 'source-atop'; mg.globalAlpha = 1 - SET.fxA; mg.fillStyle = '#000'; mg.fillRect(0, 0, VW, VH);
    mg.restore();
    gx.globalCompositeOperation = 'lighter'; gx.drawImage(GFX.mglow, 0, 0); gx.globalCompositeOperation = 'source-over';
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
    const gk = pal.glowK ?? 1, lk = pal.lightK ?? 1; // 発光・光源の強さ(血の色は弱めて、ブルームで白く飛ばないように)
    if (t < tOmen) { // 予兆: 刃の筋が点線でうっすら走り、始点と自分の刀がきらめく
      const k = t / tOmen, fl = Math.floor(t * 60) % 2;
      sx.globalAlpha = (0.2 + 0.6 * k) * (fl ? 1 : 0.6); sx.fillStyle = pal.omen || '#ffd6dc';
      for (let i = 0; i <= n; i += 3) { const [x, y] = cutPt(s, i / n); sx.fillRect(Math.round(x - ox), Math.round(y - oy), 1, 1); }
      sx.globalAlpha = 1;
      glint(s.x0 - ox, s.y0 - oy, 2 + Math.round(6 * k), pal.core || '#ffffff');
      if (!P.dead) glint(P.x + P.facing * 7 - ox, P.y - 7 - oy, 1 + Math.round(4 * k), pal.flash || '#ffd0d8');
      addLight(s.x0, s.y0, 40, pal.glow, 0.6 * k * lk);
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
    band(gx, pal.wakeGlow, 0.3 * fade * gk, u => wW(u) * 0.6, wake);                      // 残像の光(控えめ)
    band(sx, pal.dark, 0.55 * fade, wW, wake);                                     // 残像: 暗い紅
    band(sx, pal.mid, 0.7 * fade, u => wW(u) * 0.62, wake);                       //       紅
    band(sx, pal.bright, 0.9 * Math.sqrt(Math.max(0, fade)), u => wW(u) * 0.3, wake); //     明るい赤(刃の近く)
    band(sx, pal.edge, 0.8 * fade, u => 1.6 * sn(u), edge);                         // 外側の墨の縁
    band(sx, pal.rim, Math.max(0, 1 - ke * 2), u => 1.1 * sn(u) * (1 - ke), edge); // 外側の鋭い縁
    const flash = t >= tRun && t < tRun + 0.045, flash2 = t >= tHit && t < tHit + 0.04; // 走り終えた瞬間 / 斬撃が炸裂する瞬間に、刃筋全体が一瞬光る
    const core = u => (flash ? 2.2 : 1.3) * sn(u) * (1 - ke * 3);
    if (flash2) band(sx, pal.flash || '#ffd0d8', 1, u => 1.6 * sn(u));
    band(sx, pal.core || '#ffffff', 1, core);                                        // 芯(針のように両端が尖る。既定は白)
    band(gx, pal.core || '#ffffff', Math.max(0, 0.55 - ke * 2) * gk, core);
    band(gx, pal.glow, 0.4 * fade * gk, u => 2 * sn(u) * (1 - ke));
    if (run < 1) { // 走る切っ先
      const [hx, hy] = pts[m];
      glint(hx - ox, hy - oy, 7, pal.core || '#ffffff');
      addLight(hx, hy, 70, pal.flash || '#ffd0d8', lk);
    } else { // 速度線: 残像側に細い線が数本走り、外へ流れて消える
      const kk = Math.min(1, (t - tRun) / 0.22);
      if (kk < 1) {
        [[6, 0.15, 0.6, 0.55], [11, 0.35, 0.85, 0.35]].forEach(([d, u0, u1, al]) => {
          const off = wake * d * (1 + kk * 0.8);
          let px = null, py = null;
          sx.globalAlpha = al * (1 - kk); gx.globalAlpha = al * (1 - kk) * 0.4 * gk;
          for (let i = Math.round(n * u0); i <= Math.round(n * u1); i += 4) {
            const [x, y] = cutPt(s, i / n), qx = x - ox + s.nx * off * sn(i / n), qy = y - oy + s.ny * off * sn(i / n);
            if (px !== null) { pLine(sx, px, py, qx, qy, pal.rim, 1); pLine(gx, px, py, qx, qy, pal.glow, 1); }
            px = qx; py = qy;
          }
        });
        sx.globalAlpha = gx.globalAlpha = 1;
      }
    }
    for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) if (u <= run) { const [x, y] = cutPt(s, u); addLight(x, y, 70, pal.glow, 0.9 * (1 - ke) * lk); }
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
      dim = Math.max(dim, S.dimK || 0); // スキルの構えで暗くする(Q の構え)
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
        sx.globalAlpha = 1 - k; pLine(sx, ax, ay, bx, by, s.core || '#ffffff', 1);
        gx.globalAlpha = 0.45 * (1 - k); pLine(gx, ax, ay, bx, by, s.col || '#ff3b5c', 1);
        sx.globalAlpha = gx.globalAlpha = 1;
        continue;
      }
      if (s.line) { // 一閃 / グランドクロス: 経路に走る鋭い光
        const k = easeOutCubic(s.t / s.life), w = Math.max(1, Math.round((s.w || 4) * (1 - k)));
        pLine(gx, s.x - cam.x, s.y - cam.y, s.x1 - cam.x, s.y1 - cam.y, s.col || '#ff3b5c', w + 2);
        pLine(sx, s.x - cam.x, s.y - cam.y, s.x1 - cam.x, s.y1 - cam.y, s.core || '#ffffff', w);
        addLight((s.x + s.x1) / 2, (s.y + s.y1) / 2, 90, s.col || '#ff5d73', 1 - k);
        continue;
      }
      drawSwing(s); // 刀・騎士剣・見切りの反撃・乱れ桜・敵の爪撃
    }
  };
  // 斬撃の振り抜き: 刃の軌跡が扇の端から端へ走る三日月。少し遅れて尾がついていき、消える
  //   外側の縁 = 当たり判定の半径 r、振り抜く角度 = 当たり判定の角度 span(full は全周)。follow: 自分(true)・使い手(x, y を持つもの)について動く
  //   通った範囲の外縁には細い線が残り、どこまで届いたかが分かる
  const drawSwing = s => {
    const span = s.full ? TAU : s.span || 2.1, R = s.r, dir = s.flip ? -1 : 1, pal = s.pal || SWING_PAL.katana;
    const fo = s.follow === true ? P : s.follow, ox = (fo ? fo.x : s.x) - cam.x, oy = (fo ? fo.y : s.y) - cam.y;
    const k = s.t / s.life, ss = x => x * x * (3 - 2 * x);
    const head = easeOutCubic(Math.min(1, k / 0.45)), tail = ss(clamp((k - 0.15) / 0.85, 0, 1)); // 切っ先 / 尾(0 = 扇の始端 → 1 = 終端)
    const fade = 1 - ss(clamp((k - 0.5) / 0.5, 0, 1));
    const a0 = s.a - dir * span / 2, angAt = u => a0 + dir * span * u;
    // 外縁の細い線(通った範囲)
    const m = Math.ceil(span * R * head);
    sx.globalAlpha = 0.5 * fade; gx.globalAlpha = 0.35 * fade; sx.fillStyle = pal.edge; gx.fillStyle = pal.glow;
    for (let i = 0; i <= m; i++) { const a = angAt(head * i / Math.max(1, m)), px = Math.round(ox + Math.cos(a) * R), py = Math.round(oy + Math.sin(a) * R); sx.fillRect(px, py, 1, 1); gx.fillRect(px, py, 1, 1); }
    sx.globalAlpha = gx.globalAlpha = 1;
    if (head - tail < 0.004) return;
    // 刃の軌跡: 外縁 R から内側へ。厚みは切っ先の少し手前で最大、尾ほど細い
    const n = Math.max(6, Math.ceil(span * R * (head - tail) / 2)), W = Math.max(4, R * 0.42) * (1 - 0.4 * k);
    const thick = v => W * Math.pow(v, 1.4) * (1 - 0.6 * Math.pow(v, 12));
    const band = (c, col, alpha, f) => { // f: 厚みのどこまでを塗るか(1 = 最も内側まで)
      c.globalAlpha = alpha; c.fillStyle = col; c.beginPath();
      for (let i = 0; i <= n; i++) { const a = angAt(tail + (head - tail) * i / n); c.lineTo(ox + Math.cos(a) * R, oy + Math.sin(a) * R); }
      for (let i = n; i >= 0; i--) { const v = i / n, a = angAt(tail + (head - tail) * v), r = R - thick(v) * f; c.lineTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r); }
      c.closePath(); c.fill(); c.globalAlpha = 1;
    };
    band(gx, pal.glow, 0.45 * fade, 0.7);
    band(sx, pal.body, 0.6 * fade, 1);
    band(sx, pal.edge, 0.95 * fade, 0.4);
    band(sx, pal.core || '#ffffff', fade, 0.12); // 刃の縁(= 当たり判定の端)
    const ah = angAt(head), hx = ox + Math.cos(ah) * R, hy = oy + Math.sin(ah) * R;
    if (head < 1) { sx.fillStyle = pal.core || '#ffffff'; sx.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 2, 2); } // 走る切っ先
    addLight(hx + cam.x, hy + cam.y, Math.max(30, R * 1.2), pal.glow, 0.7 * fade);
  };

  // ======== 自分の攻撃(地面側): ゾーン・オーラ ========
  // 範囲は均一な半透明塗り(市松ディザは模様の切り替わりでちらつくため廃止)
  mineOn();
  drawSkillFx(0); // スキルの地面の跡(焦げ・地割れ・霜)
  drawRift(t); // ディメンション・リフト: 画面全体を異次元に沈める(地面の上・敵の下)
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
      drawArrowRain(z, zx, zy, t);
    } else if (z.kind === 'pillar') { // 光の柱: 天から一瞬で降りて太くなり、細くなって消える。外の金の光 → 淡い帯 → 白い芯。足元に光の輪が広がり、光の粒が昇る
      if (z.t >= 0) {
        const u = z.t / z.dur, x = Math.round(zx), k = 1 - u, w = Math.max(1, Math.round(z.r * 0.36 * Math.sin(Math.min(1, u * 2.5) * Math.PI / 2) * k));
        const top = Math.round(zy - 200), y0 = Math.round(zy), drop = Math.min(1, u * 8), bot = Math.round(top + (y0 - top) * drop);
        sx.globalAlpha = 0.22 * k; sx.fillStyle = '#ffe38a'; sx.fillRect(x - w - 2, top, w * 2 + 5, bot - top);
        sx.globalAlpha = 0.5 * k; sx.fillStyle = '#fff6d8'; sx.fillRect(x - w, top, w * 2 + 1, bot - top);
        sx.globalAlpha = 0.85 * k; sx.fillStyle = '#ffffff'; sx.fillRect(x - Math.max(0, w - 2), top, Math.max(1, (w - 2) * 2 + 1), bot - top);
        gx.fillStyle = dimCol('#ffe38a', 0.6 * k); gx.fillRect(x - w - 1, top, w * 2 + 3, bot - top); // 光の層は透明度が効かないので色で弱める
        if (drop >= 1) { // 足元: 光が地面に当たって広がる楕円と、立ちのぼる光の粒
          const er = z.r * (0.45 + 0.75 * easeOutCubic(u));
          ellBoth(sx, gx, zx, zy, er, er * 0.42, '#ffe38a', 0.75 * k, dimCol('#ffe38a', 0.5 * k));
          ellBoth(sx, gx, zx, zy, er * 0.55, er * 0.23, '#fff6d8', 0.9 * k, null);
          for (let i = 0; i < 6; i++) { const h = hash2(i, Math.round(z.x)), px = Math.round(zx + (h - 0.5) * z.r * 1.2), py = Math.round(zy - (u * 60 + h * 30) % 40); sx.globalAlpha = k; sx.fillStyle = '#fff6d8'; sx.fillRect(px, py, 1, 1); gx.fillStyle = dimCol('#ffe38a', 0.8 * k); gx.fillRect(px, py, 1, 1); }
        }
        sx.globalAlpha = 1;
        addLight(z.x, z.y, z.r * 3, '#fff6d8', 0.9 * k);
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
    } else if (z.kind === 'grudge') { // 慟哭: 紫の念が渦を巻く円
      const R = Math.round(z.r);
      sx.globalAlpha = 0.18 * fade; pDisc(sx, zx, zy, R, '#4a3a8a');
      sx.globalAlpha = 0.6 * fade; pCircle(sx, zx, zy, R, '#8a6cff', 1); sx.globalAlpha = 1;
      gx.globalAlpha = 0.5 * fade;
      for (let i = 0; i < 3; i++) for (let s = 0; s < 7; s++) { // 中心へ巻き込む腕
        const rr = R * (1 - s / 8), aa = t * 2 + i * TAU / 3 + s * 0.5;
        gx.fillStyle = s % 2 ? '#6a4ad0' : '#8a6cff'; gx.fillRect(Math.round(zx + Math.cos(aa) * rr), Math.round(zy + Math.sin(aa) * rr * 0.7), 1, 1);
      }
      gx.globalAlpha = 1;
      addLight(z.x, z.y, z.r * 2, '#7a50e0', 0.3 * fade);
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
  drawSkillFx(1); // スキルの陣(足元・照準位置)
  drawAstroField(t); // アストロマンサーの重力圏の縁
  const aw = P.weapons.aura;
  if (aw && aw.R && !P.dead) {
    const ca = P.wmClone && P.wmClone.cws.aura && P.wmClone.cws.aura.R ? [P.wmClone] : []; // 分身(化身)のオーラも
    for (const o of [P, ...ca]) {
      const R = Math.round(aw.R), col = aw.evo ? '#fff3a0' : '#ffe38a', ox = o.x - cam.x, oy = o.y - cam.y;
      sx.globalAlpha = 0.12; pDisc(sx, ox, oy, R, col); sx.globalAlpha = 1;
      pCircle(gx, ox, oy, R, col, 1);
      gx.globalAlpha = 0.5;
      for (let i = 0; i < 8; i++) { const a = t * 1.2 + TAU / 8 * i; gx.fillStyle = col; gx.fillRect(Math.round(ox + Math.cos(a) * (R - 3)), Math.round(oy + Math.sin(a) * (R - 3)), 2, 2); }
      gx.globalAlpha = 1;
      addLight(o.x, o.y, R * 2.2, '#ffe38a', 0.45);
    }
  }
  mineOff();
  drawSkillFx(0, true); drawSkillFx(1, true); // ボスの攻撃の地面の跡・陣(攻撃の濃さで薄くならない)

  // ---- ボスの設置物(自分の範囲より手前。縁は赤で危険を示す) ----
  const warnBlink = Math.floor(t * 8) % 2;
  for (const h of hazards) {
    if (h.delay > 0) continue; // 予告のあとに出る床
    const hx = h.x - cam.x, hy = h.y - cam.y, fade = Math.min(1, (h.dur - h.t) * 3, h.t * 8);
    if (h.kind === 'goo') {
      const R = Math.round(h.r * Math.min(1, h.t * 6));
      sx.globalAlpha = 0.45 * fade; pDisc(sx, hx, hy, R, '#2f9c7c');
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, '#4fd6a8'); pCircle(sx, hx, hy, R + 1, '#ff3b5c', 2); sx.globalAlpha = 1;
      gx.globalAlpha = 0.3 * fade; pCircle(gx, hx, hy, R + 1, '#ff3b5c', 2); gx.globalAlpha = 1;
    } else if (h.kind === 'fire') { // 燃える床: 赤熱した地面に炎の舌がちらつく(縁は危険を示す赤)
      const R = Math.round(h.r * Math.min(1, h.t * 8));
      sx.globalAlpha = 0.55 * fade; pDisc(sx, hx, hy, R, '#4a1208');
      sx.globalAlpha = 0.45 * fade; pDisc(sx, hx, hy, Math.max(1, R - 2), '#a8321a');
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b1a' : '#ff8a3d'); sx.globalAlpha = 1;
      if (!h.lite) pDisc(gx, hx, hy, Math.max(1, R - 2), fade > 0.6 ? '#3a0e04' : '#1e0602'); // 赤熱(光の層は色で明るさが決まるので暗い色で。重なって並ぶ空襲の床は描かない)
      const n = 3 + R;
      for (let i = 0; i < n; i++) { // 炎の舌: 床ごとに決まった位置で、高さが揺らめく
        const pa = hash2(i, h.seed) * TAU, pr = Math.sqrt(hash2(i + 31, h.seed)) * R * 0.85;
        const fx = Math.round(hx + Math.cos(pa) * pr), fy = Math.round(hy + Math.sin(pa) * pr * 0.8);
        const fh = Math.max(1, Math.round((1 + 3 * Math.abs(Math.sin(t * 9 + i * 1.7))) * fade));
        for (let k = 0; k < fh; k++) { const col = k === fh - 1 ? '#ffe9a0' : k > fh / 2 ? '#ffc34a' : '#ff6a2a'; sx.fillStyle = gx.fillStyle = col; sx.fillRect(fx, fy - k, 1, 1); gx.fillRect(fx, fy - k, 1, 1); }
      }
      addLight(h.x, h.y, R * 3, '#ff6a2a', 0.75 * fade * (h.lite || 1));
    } else if (h.kind === 'magma') { // マグマ溜まり: 黒い岩の縁の中で赤く煮えたつ溶岩。泡がはじける(縁は危険を示す赤)
      const R = Math.round(h.r * Math.min(1, h.t * 6));
      sx.globalAlpha = 0.85 * fade; pDisc(sx, hx, hy, R, '#2a1008');
      sx.globalAlpha = 0.9 * fade; pDisc(sx, hx, hy, Math.max(1, R - 3), '#a8281a');
      sx.globalAlpha = 0.8 * fade; pDisc(sx, hx + Math.round(Math.sin(t * 1.3 + h.seed) * 2), hy + Math.round(Math.cos(t * 1.1 + h.seed) * 2), Math.max(1, R - 7), '#ff6a2a');
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b1a' : '#ff8a3d'); sx.globalAlpha = 1;
      pDisc(gx, hx, hy, Math.max(1, R - 4), fade > 0.6 ? '#3a1004' : '#1e0602'); // 赤熱(光の層は暗い色で)
      for (let i = 0; i < 5; i++) { // 泡: 決まった位置でふくらんではじける
        const u2 = (t * 0.9 + hash2(i, h.seed)) % 1, pa = hash2(i + 9, h.seed) * TAU, pr = Math.sqrt(hash2(i + 17, h.seed)) * (R - 5);
        const bx = Math.round(hx + Math.cos(pa) * pr), by = Math.round(hy + Math.sin(pa) * pr * 0.8), br = Math.round(u2 * 2.5);
        if (u2 < 0.85) { sx.globalAlpha = fade; pCircle(sx, bx, by, Math.max(1, br), '#ffc34a'); sx.globalAlpha = 1; }
      }
      addLight(h.x, h.y, R * 3, '#ff6a2a', 0.7 * fade);
    } else if (h.kind === 'fband') { // 空襲の燃える床: 影の通り道と同じ幅の赤熱した帯に炎の舌がちらつく(縁は危険の赤)
      const c = Math.cos(h.a), s = Math.sin(h.a), nx = -s * h.w / 2, ny = c * h.w / 2;
      const head = Math.min(h.L, h.t * h.spd), tail = Math.max(0, (h.t - h.stay) * h.spd);
      if (head > tail) {
        const x0 = hx + c * tail, y0 = hy + s * tail, x1 = hx + c * head, y1 = hy + s * head;
        const band = (ctx, k, col, al) => { ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 + nx * k, y0 + ny * k); ctx.lineTo(x1 + nx * k, y1 + ny * k); ctx.lineTo(x1 - nx * k, y1 - ny * k); ctx.lineTo(x0 - nx * k, y0 - ny * k); ctx.fill(); ctx.globalAlpha = 1; };
        band(sx, 1, '#4a1208', 0.55 * fade); band(sx, 0.85, '#a8321a', 0.45 * fade);
        band(gx, 0.85, '#120401', fade); // 赤熱(光の層は色で明るさが決まるので、広い帯はとても暗い色で)
        for (const k of [-1, 1]) { sx.globalAlpha = fade; pLine(sx, x0 + nx * k, y0 + ny * k, x1 + nx * k, y1 + ny * k, warnBlink ? '#ff3b1a' : '#ff8a3d'); sx.globalAlpha = 1; }
        for (let i = Math.floor(tail / 2); i < Math.ceil(head / 2); i++) { // 炎の舌: 位置は帯ごとに決まっていて、高さが揺らめく
          const d = (i + hash2(i, h.seed)) * 2; if (d < tail || d > head) continue;
          const off = (hash2(i + 7, h.seed) - 0.5) * 0.9, fx = Math.round(hx + c * d + nx * off * 2), fy = Math.round(hy + s * d + ny * off * 2);
          const fh = Math.max(1, Math.round((1 + 3 * Math.abs(Math.sin(t * 9 + i * 1.7))) * fade * Math.min(1, (d - tail) / 16 + 0.3)));
          for (let k = 0; k < fh; k++) { const col = k === fh - 1 ? '#ffe9a0' : k > fh / 2 ? '#ffc34a' : '#ff6a2a'; sx.fillStyle = gx.fillStyle = col; sx.fillRect(fx, fy - k, 1, 1); gx.fillRect(fx, fy - k, 1, 1); }
        }
        for (let d = tail; d < head; d += 50) addLight(h.x + c * d, h.y + s * d, 55, '#ff6a2a', 0.3 * fade);
      }
    } else if (h.kind === 'fwall') { // 炎の壁: 赤熱した帯の上に炎の柱が揺らめく(縁は危険の赤)
      const c = Math.cos(h.a), s = Math.sin(h.a), nx = -s * h.w / 2, ny = c * h.w / 2, L = h.len * Math.min(1, h.t * 6);
      const band = (k, col, al) => { sx.globalAlpha = al; sx.fillStyle = col; sx.beginPath(); sx.moveTo(hx + nx * k, hy + ny * k); sx.lineTo(hx + c * L + nx * k, hy + s * L + ny * k); sx.lineTo(hx + c * L - nx * k, hy + s * L - ny * k); sx.lineTo(hx - nx * k, hy - ny * k); sx.fill(); };
      band(1, '#4a1208', 0.6 * fade); band(0.6, '#c2401a', 0.5 * fade); sx.globalAlpha = 1;
      for (const k of [-1, 1]) { sx.globalAlpha = fade; pLine(sx, hx + nx * k, hy + ny * k, hx + c * L + nx * k, hy + s * L + ny * k, warnBlink ? '#ff3b1a' : '#ff8a3d'); sx.globalAlpha = 1; }
      const n = Math.floor(L / 3);
      for (let i = 0; i < n; i++) { // 炎の柱: 位置は壁ごとに決まっていて、高さが揺らめく
        const d = (i + hash2(i, h.seed)) * 3, off = (hash2(i + 7, h.seed) - 0.5) * h.w * 0.7;
        const fx = Math.round(hx + c * d + nx * off * 2 / h.w), fy = Math.round(hy + s * d + ny * off * 2 / h.w);
        const fh = Math.max(1, Math.round((3 + 5 * Math.abs(Math.sin(t * 8 + i * 1.3))) * fade));
        for (let k = 0; k < fh; k++) { const col = k === fh - 1 ? '#fff0b0' : k > fh * 0.55 ? '#ffc34a' : '#ff6a2a'; sx.fillStyle = gx.fillStyle = col; sx.fillRect(fx, fy - k, 1, 1); if (k > 0) gx.fillRect(fx, fy - k, 1, 1); }
      }
      for (let d = 0; d < L; d += 40) addLight(h.x + c * d, h.y + s * d, 60, '#ff6a2a', 0.7 * fade);
    } else if (h.kind === 'rift') { // 断界の裂け目(影の王): 黒い裂け目の縁が紫に光り、ときどき白く走る(この線は越えられない)
      const c = Math.cos(h.a), s = Math.sin(h.a), x1 = hx + c * h.len, y1 = hy + s * h.len, fl = Math.floor(t * 10 + h.seed) % 7 === 0;
      pLine(sx, hx, hy, x1, y1, '#06030c', 4);
      pLine(sx, hx - s * 2, hy + c * 2, x1 - s * 2, y1 + c * 2, warnBlink ? '#a66bff' : '#7a3ab0'); pLine(sx, hx + s * 2, hy - c * 2, x1 + s * 2, y1 - c * 2, warnBlink ? '#a66bff' : '#7a3ab0');
      if (fl) pLine(sx, hx, hy, x1, y1, '#e8c8ff');
      pLine(gx, hx, hy, x1, y1, dimCol('#a66bff', 0.45 * fade), 2);
      for (let d = 0; d < h.len; d += 70) { const lx = h.x + c * d, ly = h.y + s * d; if (onScreen(lx, ly, 40)) addLight(lx, ly, 60, '#7a3ab0', 0.4 * fade); }
    } else if (h.kind === 'darkwave') { // 闇の遠吠え(ケルベロス): 黒い霧の波が広がる(縁は紫の光、内側は闇)
      const R = Math.max(1, Math.round(h.cur || 1)), f2 = h.t <= h.spread ? 1 : Math.max(0, 1 - (h.t - h.spread) / (h.dur - h.spread));
      sx.globalAlpha = 0.42 * f2; pDisc(sx, hx, hy, R, '#06030c');
      sx.globalAlpha = 0.8 * f2; pCircle(sx, hx, hy, R, '#e8c8ff'); pCircle(sx, hx, hy, Math.max(1, R - 1), '#a66bff', 2); pCircle(sx, hx, hy, Math.max(1, R - 4), '#3a1a5a', 2); sx.globalAlpha = 1;
      pCircle(gx, hx, hy, R, dimCol('#a66bff', 0.7 * f2), 2);
      addLight(h.x, h.y, R * 1.6, '#7a3ab0', 0.55 * f2);
    } else if (h.kind === 'miasma') { // 瘴気の霧(腐毒のグール): 緑と紫の霧が渦を巻く(縁は危険の赤)
      const R = Math.round(h.r * Math.min(1, h.t * 5));
      sx.globalAlpha = 0.35 * fade; pDisc(sx, hx, hy, R, '#1e3a1a');
      sx.globalAlpha = 0.3 * fade; pDisc(sx, hx + Math.round(Math.sin(t * 1.7 + h.seed) * 2), hy + Math.round(Math.cos(t * 1.3 + h.seed) * 2), Math.max(1, Math.round(R * 0.7)), '#3a1a4a');
      for (let i = 0; i < 12; i++) { // 渦を巻く霧のかたまり
        const a = t * 0.9 + TAU / 12 * i + h.seed, rr = R * (0.3 + 0.6 * ((i * 0.37 + t * 0.2) % 1));
        sx.globalAlpha = 0.55 * fade; sx.fillStyle = i % 2 ? '#5aff6a' : '#9a7dff'; sx.fillRect(Math.round(hx + Math.cos(a) * rr), Math.round(hy + Math.sin(a) * rr * 0.8), 2, 1);
      }
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b5c' : '#7dff6a'); sx.globalAlpha = 1;
      pDisc(gx, hx, hy, Math.max(1, R - 3), fade > 0.6 ? '#0c1a0a' : '#060c04'); // ほのかに光る(光の層はとても暗い色で)
      addLight(h.x, h.y, R * 2.4, '#5aff6a', 0.35 * fade);
    } else if (h.kind === 'quake') {
      if (h.bell) { // 鐘の衝撃(ダメージなし・押すだけ): 金色の音の輪
        pCircle(sx, hx, hy, Math.round(h.r), '#fff0c8'); pCircle(sx, hx, hy, Math.round(h.r) - 1, '#ffd27a'); pCircle(sx, hx, hy, Math.round(h.r) - 3, '#c8a050', 2);
        pCircle(gx, hx, hy, Math.round(h.r), '#5a4010');
      } else {
        pCircle(sx, hx, hy, Math.round(h.r), '#ffd0d8'); pCircle(sx, hx, hy, Math.round(h.r) - 1, '#ff3b5c');
        gx.globalAlpha = 0.8; pCircle(gx, hx, hy, Math.round(h.r), '#ff3b5c'); gx.globalAlpha = 1;
      }
    } else if (h.kind === 'clock') { // 時計盤: 目盛りと逆回転する針
      const R = Math.round(h.r * Math.min(1, h.t * 4));
      // スロウタイム・リバース: 遅くなる側を紫で塗る。反転の 1秒前から、中の紫が薄れて外の紫が濃くなっていく(sw: 0 = 中が遅い、1 = 外が遅い)
      const sw = h.rev ? clamp(h.t - (h.rev - 1), 0, 1) : 0;
      sx.globalAlpha = 0.22 * fade * (1 - sw); pDisc(sx, hx, hy, R, '#6a3aa0');
      if (sw > 0) {
        sx.globalAlpha = 0.32 * fade * sw; sx.fillStyle = '#3a1460';
        sx.beginPath(); sx.rect(0, 0, VW, VH); sx.arc(Math.round(hx), Math.round(hy), R, 0, TAU); sx.fill('evenodd');
        sx.globalAlpha = 0.1 * fade * sw; pDisc(sx, hx, hy, R, '#ffffff'); // 中は安全: うっすら明るく
        for (let i = 0; i < 24; i++) { const a = TAU / 24 * i - t * 0.6, r0 = R + 6 + ((t * 30 + i * 7) % 40); sx.globalAlpha = 0.5 * fade * sw * (1 - (r0 - R - 6) / 40); sx.fillStyle = '#c29bff'; sx.fillRect(Math.round(hx + Math.cos(a) * r0), Math.round(hy + Math.sin(a) * r0), 1, 1); } // 外へ流れ出る時の粒
      }
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b5c' : '#c29bff'); sx.globalAlpha = 1;
      gx.globalAlpha = 0.6 * fade; pCircle(gx, hx, hy, R, '#c29bff');
      for (let i = 0; i < 12; i++) { const a = TAU / 12 * i; gx.fillStyle = '#c29bff'; gx.fillRect(Math.round(hx + Math.cos(a) * (R - 4)), Math.round(hy + Math.sin(a) * (R - 4)), 2, 2); }
      const rv = h.rev && h.t >= h.rev - 1 ? -1 : 1; // スロウタイム・リバース: 反転の 1秒前から針が逆回り
      pLine(gx, hx, hy, hx + Math.cos(-t * 3 * rv) * R * 0.8, hy + Math.sin(-t * 3 * rv) * R * 0.8, '#ffffff');
      pLine(gx, hx, hy, hx + Math.cos(-t * 0.5 * rv) * R * 0.5, hy + Math.sin(-t * 0.5 * rv) * R * 0.5, '#c29bff', 2);
      if (h.rev && h.t >= h.rev - 1 && h.t < h.rev && Math.floor(t * 10) % 2) { gx.globalAlpha = 1; pCircle(gx, hx, hy, R + 2, '#ffffff', 1); pCircle(sx, hx, hy, R + 2, '#ff3b5c'); } // 反転の前に縁が点滅
      if (h.rev && h.t >= h.rev) { // 反転後: 縁に外向きの矢印(外が遅い)
        sx.globalAlpha = fade;
        for (let i = 0; i < 8; i++) { const a = TAU / 8 * i + t * 0.4, x0 = hx + Math.cos(a) * (R + 4), y0 = hy + Math.sin(a) * (R + 4); pLine(sx, x0, y0, x0 + Math.cos(a) * 6, y0 + Math.sin(a) * 6, '#c29bff'); pLine(sx, x0 + Math.cos(a) * 6, y0 + Math.sin(a) * 6, x0 + Math.cos(a + 2.5) * 3 + Math.cos(a) * 6, y0 + Math.sin(a + 2.5) * 3 + Math.sin(a) * 6, '#c29bff'); pLine(sx, x0 + Math.cos(a) * 6, y0 + Math.sin(a) * 6, x0 + Math.cos(a - 2.5) * 3 + Math.cos(a) * 6, y0 + Math.sin(a - 2.5) * 3 + Math.sin(a) * 6, '#c29bff'); }
        sx.globalAlpha = 1;
      }
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
    } else if (h.kind === 'ink') { // 墨だまり: 黒い墨がゆらぎ、ふちに飛沫。中で暗い紫のうずが回る(ダメージはないので縁は赤くしない)
      const R = Math.round(h.r * Math.min(1, h.t * 6));
      sx.globalAlpha = 0.72 * fade; pDisc(sx, hx, hy, R, '#0a0a14');
      sx.globalAlpha = 0.5 * fade; pDisc(sx, hx, hy, Math.max(1, R - 4), '#04040a');
      for (let i = 0; i < 12; i++) {
        const a = hash2(i, h.seed) * TAU, r = R + Math.sin(t * 3 + i * 1.7) * 2;
        sx.globalAlpha = 0.6 * fade; pDisc(sx, hx + Math.cos(a) * r, hy + Math.sin(a) * r, 1 + (i % 3), '#0a0a14');
      }
      sx.globalAlpha = 0.85 * fade; pCircle(sx, hx, hy, R, '#3a2a5a');
      for (let i = 0; i < 3; i++) for (let k = 0; k < 7; k++) { const aa = t * 0.8 + TAU / 3 * i + k * 0.16, rr = R * (0.2 + 0.09 * k); sx.fillStyle = '#2a2a4a'; sx.fillRect(Math.round(hx + Math.cos(aa) * rr), Math.round(hy + Math.sin(aa) * rr), 1, 1); }
      sx.globalAlpha = 1;
    } else if (h.kind === 'tide') { // 潮の満ち引き: 引き(内へ縮む波紋)→ 押し(外へ広がる波紋)→ 縁に触手の輪(縁の予告は赤)
      const R = Math.round(h.r), RR = Math.round(h.r * 1.06), pull = h.t < 2;
      sx.globalAlpha = 0.16 * fade; pDisc(sx, hx, hy, R, '#2a8ac8'); sx.globalAlpha = 1;
      if (h.t < 3) {
        for (let j = 0; j < 4; j++) { const k = (t * (pull ? 0.7 : 1.5) + j / 4) % 1, rr = Math.round(R * (pull ? 1 - k : k)); if (rr > 2) pCircle(gx, hx, hy, rr, '#1a4a5a'); }
        sx.globalAlpha = 0.8; pCircle(sx, hx, hy, R, '#7ad7ff'); sx.globalAlpha = 1;
        if (h.t > 1.2) { const bw = Math.max(2, Math.round(h.r * 0.12)); sx.globalAlpha = 0.18 + 0.1 * warnBlink; sx.strokeStyle = '#ff3b5c'; sx.lineWidth = bw; sx.beginPath(); sx.arc(Math.round(hx), Math.round(hy), RR, 0, TAU); sx.stroke(); sx.globalAlpha = 1; pCircle(sx, hx, hy, RR + Math.ceil(bw / 2), warnBlink ? '#ff3b5c' : '#ffd0d8'); pCircle(gx, hx, hy, RR + Math.ceil(bw / 2), '#7a1020'); }
      } else { // 触手の輪: せり上がって沈む
        const u = (h.t - 3) / Math.max(0.01, h.dur - 3), k = u < 0.2 ? u / 0.2 : Math.max(0, 1 - (u - 0.2) / 0.8), H = Math.round(20 * k);
        for (let i = 0; i < 28; i++) {
          const a = TAU / 28 * i + 0.11, x0 = Math.round(hx + Math.cos(a) * RR), y0 = Math.round(hy + Math.sin(a) * RR);
          sx.fillStyle = '#0a1a1e'; sx.fillRect(x0 - 3, y0 + 1, 7, 1);
          for (let j = 0; j < H; j++) {
            const sw = Math.round(Math.sin(j * 0.35 + i) * j / 5), w = j < H * 0.4 ? 3 : j < H - 3 ? 2 : 1;
            sx.fillStyle = '#3a0e24'; sx.fillRect(x0 + sw - 1, y0 - j, w + 2, 1);
            sx.fillStyle = j > H - 3 ? '#e89aaa' : j % 3 === 1 ? '#c2486a' : '#8a2a4a'; sx.fillRect(x0 + sw, y0 - j, w, 1);
            if (j % 3 === 0 && w > 1) { sx.fillStyle = '#e89aaa'; sx.fillRect(x0 + sw, y0 - j, 1, 1); } // 吸盤
          }
        }
      }
      addLight(h.x, h.y, R * 1.6, '#2a8ac8', 0.35 * fade);
    } else if (h.kind === 'reef') { // 岩礁: 苔むした黒い岩。波が来るまで、陰(波に当たらない所)を淡い緑で示す
      const c = Math.cos(h.th), s = Math.sin(h.th), L = 60 * CHAOS.area, W = 13 * CHAOS.area, R = Math.round(h.r * Math.min(1, h.t * 5));
      if (!h.gone) {
        sx.globalAlpha = (0.16 + 0.06 * Math.sin(t * 6)) * fade; sx.fillStyle = '#7dffd0'; sx.beginPath();
        sx.moveTo(hx - s * W, hy + c * W); sx.lineTo(hx + c * L - s * W, hy + s * L + c * W); sx.lineTo(hx + c * L + s * W, hy + s * L - c * W); sx.lineTo(hx + s * W, hy - c * W); sx.fill();
        sx.globalAlpha = 0.7 * fade;
        for (const k of [-1, 1]) for (let d = 0; d < L; d += 4) { const qx = Math.round(hx + c * d - s * W * k), qy = Math.round(hy + s * d + c * W * k); sx.fillStyle = '#bff4ff'; sx.fillRect(qx, qy, 2, 1); gx.fillStyle = '#1a4a3a'; gx.fillRect(qx, qy, 1, 1); }
        sx.globalAlpha = 1;
      }
      pDisc(sx, hx, hy + 2, R, '#081418');
      pDisc(sx, hx, hy, Math.max(1, R - 1), '#2a3e46');
      pDisc(sx, hx - 2, hy - 3, Math.max(1, R - 5), '#4a6a70');
      for (let i = 0; i < 6; i++) { const a = hash2(i, h.seed) * TAU, r = R * 0.6 * hash2(i + 5, h.seed); sx.fillStyle = i % 2 ? '#2f7a5a' : '#e8d8c8'; sx.fillRect(Math.round(hx + Math.cos(a) * r), Math.round(hy + Math.sin(a) * r * 0.7), 2, 1); } // 苔とフジツボ
      gx.globalAlpha = 1; pCircle(gx, hx, hy + 1, R + 1, '#163a44'); // 波打ちぎわの白い泡
    } else if (h.kind === 'tsunami') { // 大津波: 画面を横切る大波(白い波頭)。岩礁の陰では波が割れる
      const c = Math.cos(h.th), s = Math.sin(h.th), d = h.d, A = CHAOS.area;
      sx.save(); gx.save(); sx.translate(hx, hy); gx.translate(hx, hy); sx.rotate(h.th); gx.rotate(h.th);
      for (let sd = -h.span; sd < h.span; sd += 4) {
        const wob = Math.sin(t * 9 + sd * 0.15) * 2 + Math.sin(sd * 0.05 + t * 3) * 2;
        if (h.reefs.some(r => d > r.along && d - r.along < 60 * A && Math.abs(sd + 2 - r.side) < 13 * A)) { sx.globalAlpha = 0.3; sx.fillStyle = '#0e3a5a'; sx.fillRect(d - 90 + wob, sd, 30, 4); continue; } // 陰: 波が割れて跡だけ
        const fo = (Math.floor(sd / 4) + Math.floor(t * 12)) % 3;
        sx.globalAlpha = 0.45; sx.fillStyle = '#0e3a5a'; sx.fillRect(d - 90 + wob, sd, 66, 4); // 波の背(深い水)
        sx.globalAlpha = 0.7; sx.fillStyle = '#1a6a9a'; sx.fillRect(d - 24 + wob, sd, 14, 4);
        sx.globalAlpha = 0.9; sx.fillStyle = '#4ab8e8'; sx.fillRect(d - 10 + wob, sd, 6, 4); // 波の面
        sx.globalAlpha = 1; sx.fillStyle = fo ? '#ffffff' : '#bff4ff'; sx.fillRect(d - 4 + wob, sd, 4, 4); // 白い波頭
        if (fo === 0) { sx.globalAlpha = 0.7; sx.fillRect(d + 1 + wob + (sd % 3), sd + 1, 1, 1); } // 前に散るしぶき
        gx.fillStyle = '#163a4a'; gx.fillRect(d - 3 + wob, sd, 2, 4);
      }
      sx.restore(); gx.restore(); sx.globalAlpha = 1;
      for (let k = -2; k <= 2; k++) addLight(h.x + c * d - s * k * h.span / 2.5, h.y + s * d + c * k * h.span / 2.5, 90, '#7ad7ff', 0.35);
    } else if (h.kind === 'wpillar') { // 水柱: 足元の渦(縁は危険の赤)と、渦を巻いて立ちのぼる水の柱
      const R = Math.round(h.r * Math.min(1, h.t * 6)), H = Math.round(36 * Math.min(1, h.t * 4) * fade);
      sx.globalAlpha = 0.35 * fade; pDisc(sx, hx, hy, R, '#2a8ac8');
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b5c' : '#ffd0d8'); sx.globalAlpha = 1;
      pCircle(gx, hx, hy, R, '#5a1020');
      for (let j = 0; j < H; j++) {
        const w = Math.max(1, Math.round(R * 0.55 * (1 - j / Math.max(1, H) * 0.35))), y = Math.round(hy - j), sw = Math.round(Math.sin(t * 10 + j * 0.45) * w * 0.8);
        sx.globalAlpha = 0.5 * fade; sx.fillStyle = '#2a8ac8'; sx.fillRect(Math.round(hx - w), y, w * 2 + 1, 1);
        sx.globalAlpha = 0.9 * fade; sx.fillStyle = j % 4 < 2 ? '#bff4ff' : '#7ad7ff'; sx.fillRect(Math.round(hx + sw), y, 2, 1);
        gx.fillStyle = '#1a4a5a'; gx.fillRect(Math.round(hx + sw), y, 1, 1);
      }
      sx.globalAlpha = 1;
      for (let i = 0; i < 5; i++) { sx.fillStyle = '#ffffff'; sx.fillRect(Math.round(hx + Math.sin(t * 7 + i * 1.3) * R * 0.5), Math.round(hy - H - (i % 2)), 1, 1); } // 柱の先の白いしぶき
      addLight(h.x, h.y - H / 2, 50, '#7ad7ff', 0.5 * fade);
    } else if (h.kind === 'ringgear') { // リングギア: 予告(地面に赤い輪の帯)と、上から降りてくる中が空いた真鍮の歯車(内側に歯)。降りたあとは回り、縁は危険の赤
      const R = h.r, W = h.w, u = Math.min(1, h.t / h.land), down = h.t >= h.land, up = Math.max(0, (h.t - (h.dur - 0.4)) / 0.4);
      const lift = down ? 150 * up * up : 150 * (1 - u) * (1 - u), gy = hy - lift, rot = h.rot0 + h.dir * 0.35 * Math.max(0, h.t - h.land);
      const band = (c, cy, r0, r1) => { c.beginPath(); c.arc(hx, cy, r1, 0, TAU); c.arc(hx, cy, Math.max(0, r0), 0, TAU, true); c.fill(); };
      if (!down) { // 予告: 落ちてくる歯車の影の上に、赤い輪の帯(内側から満ちる)と、点滅する縁
        sx.globalAlpha = 0.15 + 0.25 * u; sx.fillStyle = '#000'; band(sx, hy, R - W / 2, R + W / 2);
        sx.fillStyle = '#ff3b5c'; sx.globalAlpha = 0.16; band(sx, hy, R - W / 2, R + W / 2);
        sx.globalAlpha = 0.26; band(sx, hy, R - W / 2, R - W / 2 + W * u); sx.globalAlpha = 1;
        const edge = warnBlink ? '#ff3b5c' : '#ffd0d8';
        pCircle(sx, hx, hy, Math.round(R - W / 2), edge); pCircle(sx, hx, hy, Math.round(R + W / 2), edge);
        pCircle(gx, hx, hy, Math.round(R + W / 2), '#ff3b5c');
      }
      const a0 = down ? fade : u; // 降りてくる間は薄い → 着地でくっきり
      // 歯も含めて幅 W の中に描く(見た目 = 当たり判定): 外側 12 が輪の体、内側 4 が歯
      sx.globalAlpha = a0; sx.fillStyle = '#5a4520'; band(sx, gy, R - W / 2 + 4, R + W / 2); // 輪の体(暗い真鍮)
      sx.fillStyle = '#7a5e2c'; band(sx, gy, R - W / 2 + 7, R + W / 2 - 3); // 中ほどの面
      const nT = 56;
      for (let i = 0; i < nT; i++) { // 内側の歯
        const a = rot + TAU / nT * i, tx = hx + Math.cos(a) * (R - W / 2 + 2), ty = gy + Math.sin(a) * (R - W / 2 + 2);
        pDisc(sx, tx, ty, 3, '#241e1a'); pDisc(sx, tx, ty, 2, '#c8a050'); sx.fillStyle = '#ffd27a'; sx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 1, 1);
      }
      for (let i = 0; i < 12; i++) { const a = rot + TAU / 24 + TAU / 12 * i; pDisc(sx, hx + Math.cos(a) * (R + 2), gy + Math.sin(a) * (R + 2), 2, '#241e1a'); } // 輪の穴
      pCircle(sx, hx, gy, Math.round(R + W / 2), '#241e1a'); pCircle(sx, hx, gy, Math.round(R + W / 2 - 1), '#c8a050'); pCircle(sx, hx, gy, Math.round(R - W / 2 + 4), '#8a6a30');
      if (down && up === 0) { // 当たる輪: 縁を危険の赤で(光の層は色で弱める)
        sx.globalAlpha = fade * 0.9; pCircle(sx, hx, gy, Math.round(R + W / 2 + 1), '#ff3b5c'); pCircle(sx, hx, gy, Math.round(R - W / 2 - 2), '#ff3b5c');
        pCircle(gx, hx, gy, Math.round(R + W / 2 + 1), dimCol('#ff3b5c', 0.55)); pCircle(gx, hx, gy, Math.round(R - W / 2 - 2), dimCol('#ff3b5c', 0.4));
      }
      sx.globalAlpha = 1;
      for (let k = 0; k < 6; k++) { const a = rot + TAU / 6 * k; addLight(h.x + Math.cos(a) * R, h.y - lift + Math.sin(a) * R, 70, '#ffd27a', 0.25 * a0); }
    } else if (h.kind === 'gearfloor') { // 歯車の床: 床の上で回る真鍮の歯車(歯・スポーク・軸)と、回る向きの矢印
      const R = Math.round(h.r * Math.min(1, h.t * 5)), rot = h.t * 1.0 * h.dir, n = 14;
      sx.globalAlpha = 0.35 * fade; pDisc(sx, hx, hy, R, '#3a2e1e');
      sx.globalAlpha = 0.85 * fade;
      for (let i = 0; i < n; i++) { const a = rot + TAU / n * i; for (let k = 0; k < 3; k++) { const aa = a + (k - 1) * 0.06; sx.fillStyle = '#c8a050'; sx.fillRect(Math.round(hx + Math.cos(aa) * (R + 1)), Math.round(hy + Math.sin(aa) * (R + 1)), 2, 2); } } // 歯
      pCircle(sx, hx, hy, R, '#c8a050'); pCircle(sx, hx, hy, Math.max(1, R - 1), '#8a6a30'); pCircle(sx, hx, hy, Math.round(R * 0.3), '#c8a050');
      for (let i = 0; i < 6; i++) { const a = rot + TAU / 6 * i; pLine(sx, hx + Math.cos(a) * R * 0.3, hy + Math.sin(a) * R * 0.3, hx + Math.cos(a) * (R - 2), hy + Math.sin(a) * (R - 2), '#8a6a30', 2); } // スポーク
      for (let i = 0; i < 4; i++) { const a = rot * 1.5 + TAU / 4 * i, r = R * 0.65, x = hx + Math.cos(a) * r, y = hy + Math.sin(a) * r, ta = a + h.dir * Math.PI / 2; for (const k of [-1, 1]) pLine(sx, x + Math.cos(ta) * 3, y + Math.sin(ta) * 3, x - Math.cos(ta) * 2 + Math.cos(ta + k * 1.6) * 3, y - Math.sin(ta) * 2 + Math.sin(ta + k * 1.6) * 3, '#ffd27a'); } // 回る向きの矢印
      sx.fillStyle = '#ffd27a'; sx.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3); sx.globalAlpha = 1;
      pCircle(gx, hx, hy, R, '#3a2a08');
      addLight(h.x, h.y, R * 1.8, '#ffd27a', 0.35 * fade);
    } else if (h.kind === 'ice') { // 滑る床: 青白い氷の面に、反射の筋が流れる(ダメージはないので縁は赤くしない)
      const R = Math.round(h.r * Math.min(1, h.t * 6));
      sx.globalAlpha = 0.3 * fade; pDisc(sx, hx, hy, R, '#7ab0d8');
      sx.globalAlpha = 0.12 * fade; pDisc(sx, Math.round(hx - R * 0.25), Math.round(hy - R * 0.25), Math.round(R * 0.5), '#ffffff');
      sx.globalAlpha = 0.7 * fade; pCircle(sx, hx, hy, R, '#d8f0ff');
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.45 + i / 3) % 1) * 2 - 1, y0 = hy + k * R * 0.7, w = Math.sqrt(Math.max(0, R * R - Math.pow(y0 - hy, 2))) * 0.55;
        sx.globalAlpha = 0.6 * fade * (1 - Math.abs(k)); pLine(sx, hx - w, y0 + w * 0.35, hx + w, y0 - w * 0.35, '#ffffff');
      }
      sx.globalAlpha = 1;
      pCircle(gx, hx, hy, R, '#16303e');
    } else if (h.kind === 'snow') { // 雪の床(イエティ): 白い雪だまり(縁は危険の赤)
      const R = Math.round(h.r * Math.min(1, h.t * 6));
      sx.globalAlpha = 0.8 * fade; pDisc(sx, hx, hy, R, '#e8f0fa');
      for (let i = 0; i < 9; i++) { const a = hash2(i, h.seed) * TAU, r = R * 0.75 * hash2(i + 3, h.seed); sx.fillStyle = i % 2 ? '#ffffff' : '#b8c8de'; sx.fillRect(Math.round(hx + Math.cos(a) * r), Math.round(hy + Math.sin(a) * r * 0.8), 2, 1); }
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b5c' : '#ffd0d8'); sx.globalAlpha = 1;
      pCircle(gx, hx, hy, R, '#5a1020');
    } else if (h.kind === 'drift') { // 地吹雪(霜の巨人の周り): 渦を巻く雪(縁は危険の赤)
      const R = Math.round(h.r * Math.min(1, h.t * 6));
      sx.globalAlpha = 0.12 * fade; pDisc(sx, hx, hy, R, '#e8f4ff');
      for (let j = 0; j < 4; j++) for (let s = 0; s < 14; s++) { const a = -t * 3 + TAU / 4 * j + s * 0.22, r = R * (0.25 + s / 18); sx.globalAlpha = 0.75 * fade; sx.fillStyle = s % 3 ? '#ffffff' : '#bff4ff'; sx.fillRect(Math.round(hx + Math.cos(a) * r), Math.round(hy + Math.sin(a) * r), 2, 1); }
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b5c' : '#ffd0d8'); sx.globalAlpha = 1;
      pCircle(gx, hx, hy, R, '#5a1020');
      addLight(h.x, h.y, R * 2, '#e8f4ff', 0.35 * fade);
    } else if (h.kind === 'blizzard') { // 吹雪の風: 画面が白くかすみ、氷塊の風下(風も凍傷も受けない所)を淡い緑で示す
      const c = Math.cos(h.th), s = Math.sin(h.th), L = 70 * CHAOS.area, W = 15 * CHAOS.area;
      sx.globalAlpha = 0.1 * fade; sx.fillStyle = '#e8f4ff'; sx.fillRect(0, 0, VW, VH);
      for (const o of enemies) {
        if (o.obj !== 'iceblock' || o.dead) continue;
        const ox = o.x - cam.x, oy = o.y - cam.y;
        sx.globalAlpha = (0.18 + 0.06 * Math.sin(t * 6)) * fade; sx.fillStyle = '#7dffd0'; sx.beginPath();
        sx.moveTo(ox - s * W, oy + c * W); sx.lineTo(ox + c * L - s * W, oy + s * L + c * W); sx.lineTo(ox + c * L + s * W, oy + s * L - c * W); sx.lineTo(ox + s * W, oy - c * W); sx.fill();
        sx.globalAlpha = 0.7 * fade;
        for (const k of [-1, 1]) for (let d = 0; d < L; d += 4) { const qx = Math.round(ox + c * d - s * W * k), qy = Math.round(oy + s * d + c * W * k); sx.fillStyle = '#d8fff0'; sx.fillRect(qx, qy, 2, 1); gx.fillStyle = '#1a4a3a'; gx.fillRect(qx, qy, 1, 1); }
      }
      sx.globalAlpha = 1;
      if (S.lee) { pCircle(sx, P.x - cam.x, P.y - cam.y, 10, '#7dffd0'); pCircle(gx, P.x - cam.x, P.y - cam.y, 10, '#1a4a3a'); } // 風下にいる: 足元に緑の輪
    } else if (h.kind === 'aval') { // 雪崩: 帯を転がる雪の塊と、後ろに残る雪の跡
      const c = Math.cos(h.th), s = Math.sin(h.th), R = Math.round(h.w / 2), mx = hx + c * h.d, my = hy + s * h.d;
      for (let k = 1; k < 7; k++) { sx.globalAlpha = 0.4 * (1 - k / 7); pDisc(sx, mx - c * k * 7, my - s * k * 7, Math.max(2, R - k), '#e8f0fa'); }
      sx.globalAlpha = 0.5; pDisc(sx, mx, my + 3, R, '#2a3448'); sx.globalAlpha = 1; // 影
      pDisc(sx, mx, my, R, '#dce8f6'); pDisc(sx, mx - R * 0.3, my - R * 0.3, Math.round(R * 0.55), '#ffffff');
      for (let k = 0; k < 6; k++) { const a = h.d / Math.max(4, R) + TAU / 6 * k; sx.fillStyle = k % 2 ? '#b8c8e0' : '#ffffff'; sx.fillRect(Math.round(mx + Math.cos(a) * R * 0.7), Math.round(my + Math.sin(a) * R * 0.7), 2, 2); } // 転がる凹凸
      pCircle(sx, mx, my, R, '#8aa0c8');
      addLight(h.x + c * h.d, h.y + s * h.d, 50, '#e8f4ff', 0.4);
    } else if (h.kind === 'icering') { // 縮む氷輪: 氷の棘の輪(外側に危険の赤)
      const R = Math.round(h.rr ?? h.r0);
      if (R > 1) {
        pCircle(sx, hx, hy, R + 1, '#5ab8e8'); pCircle(sx, hx, hy, R, '#ffffff'); pCircle(sx, hx, hy, Math.max(1, R - 1), '#bff4ff');
        pCircle(gx, hx, hy, R, '#2a5a6a');
        const n = Math.max(6, Math.round(R / 3));
        for (let i = 0; i < n; i++) { const a = TAU / n * i + t * 0.5, x = Math.round(hx + Math.cos(a) * R), y = Math.round(hy + Math.sin(a) * R); sx.fillStyle = '#ffffff'; sx.fillRect(x, y - 3, 1, 3); sx.fillStyle = '#9ff7ff'; sx.fillRect(x - 1, y - 1, 3, 1); } // 氷の棘
        sx.globalAlpha = 0.7; pCircle(sx, hx, hy, R + 4, warnBlink ? '#ff3b5c' : '#ffd0d8', 2); sx.globalAlpha = 1;
        addLight(h.x, h.y, R * 2 + 20, '#9ff7ff', 0.35);
      }
    } else if (h.kind === 'veil') { // 吹雪の帳: 画面の縁から白い霜が凍りつく(内側の縁は危険の赤)
      const R = Math.round(h.cur ?? h.R), f2 = Math.min(1, (h.dur - h.t) * 2, h.t * 4);
      sx.globalAlpha = 0.58 * f2; sx.fillStyle = '#d4ecff';
      sx.beginPath(); sx.rect(0, 0, VW, VH); sx.arc(Math.round(hx), Math.round(hy), R, 0, TAU); sx.fill('evenodd');
      sx.globalAlpha = 0.5 * f2; // 凍った面のひび
      for (let i = 0; i < 40; i++) {
        const a = hash2(i, h.seed + 1) * TAU, r = R + 8 + hash2(i, h.seed + 2) * 140, x = hx + Math.cos(a) * r, y = hy + Math.sin(a) * r;
        if (x < -10 || y < -10 || x > VW + 10 || y > VH + 10) continue;
        const ca = a + (hash2(i, h.seed + 3) - 0.5) * 2;
        pLine(sx, x, y, x + Math.cos(ca) * 8, y + Math.sin(ca) * 8, '#8ab8e0');
      }
      const n = Math.round(R / 2.5);
      for (let i = 0; i < n; i++) { const a = TAU / n * i, j = hash2(i, h.seed) * 7; sx.globalAlpha = 0.9 * f2; sx.fillStyle = i % 3 ? '#ffffff' : '#9ff7ff'; sx.fillRect(Math.round(hx + Math.cos(a) * (R + j)), Math.round(hy + Math.sin(a) * (R + j)), 2, 1); } // 霜の結晶
      sx.globalAlpha = f2; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b5c' : '#ffd0d8'); sx.globalAlpha = 1;
      pCircle(gx, hx, hy, R, '#5a1020');
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

  drawBossCharge(t); // ボスの構え: 足元に縮んでいく危険の輪
  // ---- 敵(Yソート) ----
  const vis = enemies.filter(e => !e.dead && onScreen(e.x, e.y, 30));
  vis.sort((a, b) => a.y - b.y);
  for (const e of vis) {
    if (e.under) { // マグマワーム(地中): 盛り上がった土と赤熱したひびだけ(予告の間は震えて明るくなる)
      const m = ART.S.mwormMound[Math.floor(t * 8 + e.seed * 5) % 2], sh = e.wind > 0 ? Math.round(Math.sin(t * 70)) : 0;
      drawSp(m, e.x + sh, e.y + 3, { scale: e.scale });
      addLight(e.x, e.y + 2, e.wind > 0 ? 34 : 18, '#ff6a2a', e.wind > 0 ? 0.7 : 0.35);
      continue;
    }
    if (e.flying) continue; // 空襲で空高く飛んでいるボスは影だけ(drawBossFx)
    const sp = e.boss ? ART.S[e.spr || e.boss] : e.prop ? ART.S.brazier[Math.floor(t * 6 + e.seed * 5) % 2] : spriteOf(e);
    const sc = e.scale;
    if (!e.hz) shadow(e.x, e.y + sp.h * sc / 2 - 1, sp.w * sc * 0.8); // 宙にある物(ケルベロスの首)は影なし
    let sy = 1, sxk = 1, yo = 0;
    if (e.ai === 'hop') { const ha = e.hopAir || 0.35, h = e.hopT < ha ? Math.sin((e.hopT / ha) * Math.PI) : 0; yo = -h * 5; sy = 1 + h * 0.15 - (e.hopT > (e.hopEvery || 1.1) - 0.2 ? 0.15 : 0); sxk = 2 - sy; }
    else if (e.ai === 'flutter' || e.type === 'imp') yo = Math.sin(e.t * 12) * 1.5; // 飛ぶ敵は上下に揺れる(火の小鬼は浮いたまま射撃)
    if (e.swell > 0) { sy = sxk = 1 + 0.45 * e.swell; } // 鬼火の自爆: 膨らむ
    else if (e.disguise) { sy = 1 + Math.sin(e.t * 3) * 0.03; sxk = 2 - sy; } // 鏡の分身: 女王と同じ揺れ
    else if (e.obj) { if (e.dropT > 0) yo = -e.dropT * 260; sy = e.rise * (1 + (e.pulse || 0) * 0.6); sxk = 1 + (e.pulse || 0) * 0.4 + (e.obj === 'meat' ? Math.sin(e.t * 4 + e.seed * 9) * 0.04 : 0); } // せり上がる / 肉塊は脈打つ // 砂時計は空から落ちてくる
    if (e.hz) { yo -= e.hz + (e.raise ? 4 : 0) + Math.sin(e.t * 3 + e.slot * 2) * 0.8; if (e.obj === 'chead') sy = Math.max(0.3, e.rise) * (1 + (e.pulse || 0) * 0.25), sxk = 1 + (e.pulse || 0) * 0.2; } // ケルベロスの首: 首の高さ(遠吠えで天を仰ぐ)。ふくらみは控えめに
    else if (e.type === 'mworm') { sy = Math.max(0.1, e.rise ?? 1); sxk = 1 + (1 - sy) * 0.4; } // マグマワーム: 地面から伸び出る・沈む
    else if (!e.prop && !e.boss) { const w = Math.abs(Math.sin(e.t * 7 + e.seed * 6)); sy = 1 - w * 0.06; sxk = 1 + w * 0.04; }
    if (e.boss) { sy = (e.sq || 1) + Math.sin(e.t * 3) * 0.03; sxk = 2 - sy; yo = -(e.jz || 0); }
    const flip = (e.face || 1) < 0;
    let alpha = e.ghost ? 0.7 : 1;
    if (e.hideA !== undefined) alpha *= e.hideA;
    if (e.veil) alpha *= 0.26 + 0.08 * Math.sin(t * 6 + e.seed * 9); // 影法師: 遠い間は薄い影(目だけが光る)
    if (e.elite) { // 金色の脈動アウトライン
      const gold = ART.variant(sp, flip ? 'goldFlip' : 'gold'), ex = Math.round(e.x - cam.x - sp.w * sc / 2), ey = Math.round(e.y + yo - cam.y - sp.h * sc / 2);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) sx.drawImage(gold, ex + ox, ey + oy, sp.w * sc, sp.h * sc);
    }
    if (e.shadow || (e.owner && e.owner.shadow)) drawShade(sp, e.x, e.y + yo, { flip, scale: sc, sy, sxk, alpha, white: e.flash > 0 }); // 影の王が呼んだ影(と、その影が出した物)
    else drawSp(sp, e.x, e.y + yo, { flip, scale: sc, sy, sxk, alpha, white: e.flash > 0, emitA: e.ghost ? 0.25 : e.flash > 0 ? 0.5 : undefined });
    if (e.boss === 'cerberus') drawCerbNecks(e, sp, yo); // 首: 体から頭へ(頭より奥に描く)
    if (e.type === 'mworm') drawSp(ART.S.mwormMound[0], e.x, e.y + sp.h * sc / 2 - 1, { scale: sc }); // 出てきた穴の盛り土(体の根元を隠す)
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
    if (e.curseT > S.time) { // 呪い(紫): 頭上で小さな火がゆらめく(取り憑いた精霊は自分の攻撃の層で描く)
      const top = Math.round(e.y + yo - cam.y - sp.h * sc / 2) - 3, f = Math.floor(t * 8 + e.seed * 5) % 2, x = Math.round(e.x - cam.x) - (e.possN > 0 ? 3 : 0);
      sx.fillStyle = gx.fillStyle = '#a58cff'; sx.fillRect(x, top - f, 1, 2); gx.fillRect(x, top - f, 1, 2); sx.fillRect(x - 1, top + 1, 3, 1);
    }
    if (e.elite) {
      addLight(e.x, e.y, 50, '#ffd23f', 0.8);
    }
    if (e.phaseElite) { // エリート群: 足元で脈打つ赤い輪
      const rr = Math.round(sp.w * sc * 0.55 + 2 + Math.sin(t * 6 + e.seed * 7) * 1.5), fy = Math.round(e.y - cam.y + sp.h * sc / 2 - 1);
      sx.globalAlpha = 0.55; pCircle(sx, Math.round(e.x - cam.x), fy, rr, '#ff3b5c'); sx.globalAlpha = 1;
      pCircle(gx, Math.round(e.x - cam.x), fy, rr, '#7a1020');
      addLight(e.x, e.y, 60, '#ff3b5c', 0.6);
    }
    if (e.prop) addLight(e.x, e.y - 3, 70 + Math.sin(t * 13 + e.seed * 9) * 6, '#ff9b3d', 1);
    if (e.boss) addLight(e.x, e.y, 90, e.shadow ? '#7a3ab0' : e.col, e.shadow ? 0.6 : 0.8);
    if (e.aim) { gx.fillStyle = '#ffb13a'; gx.fillRect(Math.round(e.x - cam.x), Math.round(e.y - cam.y - 10), 1, 3); }
    if (e.type === 'goblin') addLight(e.x, e.y, 40, '#ffcc33', 0.8);
    else if (e.type === 'angler') { // チョウチンアンコウ: 提灯の光(光る予兆の間は大きく脈打つ)
      const g = e.glowL || 0, lx = e.x + (flip ? -4 : 4) * sc, ly = e.y + yo - sp.h * sc / 2 + 1;
      addLight(lx, ly, (26 + 80 * g) * (1 + 0.1 * Math.sin(t * 6 + e.seed * 9)), '#fff6a0', 0.7 + 0.3 * g);
      if (g > 0) { gx.fillStyle = g > 0.7 && warnBlink ? '#ffffff' : '#fff6a0'; gx.fillRect(Math.round(lx - cam.x) - 1, Math.round(ly - cam.y) - 1, 3, 3); }
    } else if (e.type === 'jelly') addLight(e.x, e.y, 20, '#ff8ad8', 0.25);
    else if (e.type === 'mworm') addLight(e.x, e.y - 4, 26, '#ff6a2a', 0.5);
    else if (e.type === 'icesprite') addLight(e.x, e.y, 26, '#9ff7ff', 0.5);
    else if (e.type === 'ghost') addLight(e.x, e.y, 22, '#8ab8ff', 0.3); // 冷たい霊: 青白い光
    else if (e.type === 'ghoul') addLight(e.x, e.y - 4, 22, '#7dff6a', 0.32); // 腐毒のグール: 緑の毒の光
    else if (e.type === 'spider') addLight(e.x, e.y, 14, '#7dff6a', 0.22);
    else if (e.type === 'shadoweye') { // 影の眼: 撃つ前に瞳が赤紫に光り、闇が集まる
      if (e.wind > 0) { const k = 1 - e.wind / 0.6; pCircle(gx, Math.round(e.x - cam.x), Math.round(e.y - cam.y - 1), Math.round(10 - 7 * k), dimCol('#a66bff', 0.3 + 0.5 * k)); }
      addLight(e.x, e.y, e.wind > 0 ? 44 : 20, '#a66bff', e.wind > 0 ? 0.85 : 0.4);
    }
    else if (e.type === 'stalker' && !e.veil) addLight(e.x, e.y - 4, 18, '#c79bff', 0.3);
    else if (e.obj === 'doom') { // 終刻の時計: 文字盤に残り秒(12 → 0)。少なくなると赤く脈打つ
      const n = Math.max(0, Math.ceil(e.life)), img = ART.text(String(n), n <= 3 ? '#ff3b5c' : '#ffd0d8', 2);
      const cx2 = Math.round(e.x - cam.x), cy2 = Math.round(e.y + yo - cam.y - sp.h * sc / 2), fy2 = cy2 + 11; // 文字盤の中心
      const ha = -Math.PI / 2 + (12 - e.life) / 12 * TAU; pLine(sx, cx2, fy2, cx2 + Math.cos(ha) * 7, fy2 + Math.sin(ha) * 7, '#8a1020', 2); pLine(sx, cx2, fy2, cx2, fy2 - 5, '#1a0a14'); // 文字盤の針
      sx.drawImage(img, Math.round(cx2 - img.width / 2), Math.round(cy2 - img.height - 6)); // 残り秒(時計の上に大きく)
      const R = Math.round(sp.w * sc * 0.75), m = Math.ceil(TAU * R);
      for (let i = 0; i < m; i++) { const u = i / m; if (u > e.life / 12) continue; const a2 = -Math.PI / 2 + TAU * u; sx.fillStyle = n <= 3 && Math.floor(t * 8) % 2 ? '#ffffff' : '#ff3b5c'; sx.fillRect(Math.round(cx2 + Math.cos(a2) * R), Math.round(e.y - cam.y + Math.sin(a2) * R), 1, 1); } // 減っていく赤い輪
      addLight(e.x, e.y - 8, 60 + (e.pulse || 0) * 120, '#ff3b5c', n <= 3 ? 0.9 : 0.5);
    }
    else if (e.obj === 'sandglass') addLight(e.x, e.y - 6, 40, '#c29bff', 0.5);
    else if (e.obj === 'pillar') { // 肋骨の魔弾の骨柱: 青く光り、撃つ前に白く光る
      if (e.glint) { const mx = Math.round(e.x - cam.x), my = Math.round(e.y + yo - cam.y - 10); sx.fillStyle = gx.fillStyle = '#ffffff'; sx.fillRect(mx - 3, my, 7, 1); sx.fillRect(mx, my - 3, 1, 7); gx.fillRect(mx - 2, my, 5, 1); addLight(e.x, e.y - 10, 46, '#ffffff', 0.9); }
      else addLight(e.x, e.y - 8, 24, '#6ee7ff', 0.45);
    }
    else if (e.obj === 'qmirror') addLight(e.x, e.y - 10, 44 + Math.sin(t * 4 + e.seed * 6) * 6, PRISM[Math.floor(t * 4 + e.seed * 7) % 7], 0.6); // 女王の鏡: 七色に移ろう光
    else if (e.obj === 'tomb') addLight(e.x, e.y - 10, 50 + Math.sin(t * 3 + e.seed * 6) * 6, '#9ff7ff', 0.6); // 氷柱の墓標: 青白く光る
    else if (e.obj === 'chead') addLight(e.x + 3 * (e.face || 1), e.y + yo - 1, 26 + (e.pulse || 0) * 30, CERB[e.hk][0], 0.4 + (e.pulse || 0) * 0.4); // ケルベロスの首: 目と首の色の光
    if (e.disguise) addLight(e.x, e.y, 90, '#ff8ad8', 0.8); // 鏡の分身: 本物と同じ光(HP バーは出さない)
    else if (e.obj) { // ボスが出した物: いつも金色の HP バー(壊せることを示す)と、足元の金の輪
      const w = Math.max(10, Math.round(sp.w * sc)), bx = Math.round(e.x - cam.x - w / 2), by = Math.round(e.y + (e.hz ? yo - sp.h * sc - 4 : 0) - cam.y + sp.h * sc / 2 + 2); // 宙にある首は頭の上に
      sx.fillStyle = '#0c0913'; sx.fillRect(bx - 1, by - 1, w + 2, 3);
      sx.fillStyle = '#ffd23f'; sx.fillRect(bx, by, Math.max(1, Math.round(w * e.hp / e.maxhp)), 1);
      gx.fillStyle = '#4a3a08'; gx.fillRect(bx, by, Math.max(1, Math.round(w * e.hp / e.maxhp)), 1);
      if (!e.hz) { sx.globalAlpha = 0.45 + 0.25 * Math.sin(t * 5 + e.seed * 6); pCircle(sx, Math.round(e.x - cam.x), Math.round(e.y - cam.y + sp.h * sc / 2 - 1), Math.round(e.r + 3), '#ffd23f'); sx.globalAlpha = 1; }
    } else if (e.shadow) { // 影: 頭の上に紫の HP バー
      const w = Math.max(16, Math.round(sp.w * 0.8)), bx = Math.round(e.x - cam.x - w / 2), by = Math.round(e.y + yo - cam.y - sp.h / 2 - 6), k = Math.max(0, e.hp / e.maxhp);
      sx.fillStyle = '#0c0913'; sx.fillRect(bx - 1, by - 1, w + 2, 4);
      sx.fillStyle = '#a66bff'; sx.fillRect(bx, by, Math.max(1, Math.round(w * k)), 2);
      gx.fillStyle = '#3a1a5a'; gx.fillRect(bx, by, Math.max(1, Math.round(w * k)), 1);
    } else if (!e.boss && !e.prop && e.hp < e.maxhp && (e.elite || e.maxhp > 90 || e.owner)) {
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
    const bk = P.cls === 'berserker', walkM = (P.moving ? 'walk' : 'idle') + (bk && bkEyes() ? 'R' : ''); // バーサーカー: 怒りが上限・狂乱中は目が赤く光る絵
    const psp = ms ? rig.pose(ms.p) : rig && P.guard && rig.guard ? rig.pose(rig.guard) : rig ? ART.rigFrame(rig, walkM, P.cls === 'astro' && P.moving ? P.walkT : t) : ART.S.player; // アストロマンサーは重いほど足取りが遅い // guard: 構えの姿勢(ナイト)
    const py = P.y - (psp.h - ART.S.player.h) / 2; // 足元の位置を旧プレイヤーと揃える
    // 空蝉の分身(白いシルエットが明滅する)
    if (S.decoy && rig) drawSp(rig.base, S.decoy.x, S.decoy.y - (rig.base.h - ART.S.player.h) / 2, { white: true, alpha: 0.35 + 0.25 * Math.sin(t * 20), flip: P.facing < 0, emit: false });
    // 残像: クラスの色のシルエット(白だとブルームで塊になるため)
    if (P.after) for (const a of P.after) {
      const ax = Math.round(a.x - cam.x - psp.w / 2), ay = Math.round(a.y - (P.y - py) - cam.y - psp.h / 2);
      const src = a.f < 0 ? ART.variant(psp, 'flip') : psp.c;
      sx.globalAlpha = 0.45 * (1 - a.t / 0.25);
      sx.drawImage(ART.tint(src, a.col || DATA.classes[P.cls].col), ax, ay); // col: 残像ごとの色(バーサーカーの狂乱は暗い赤)
      sx.globalAlpha = 1;
    }
    if (P.shades && P.shades.length && P.cls === 'weaponmaster') { mineOn(); drawWm(rig, t, true); mineOff(); } // ウェポンマスター: 影の追撃の影(自分の攻撃。自分の後ろに描く)
    drawWm(rig, t, false); // 武神降臨の分身
    shadow(P.x, P.y + 7, 9);
    drawAstroBody(t, false); // アストロマンサー: 足元の暗い輪・奥側を回る星
    drawBerserkRings(t);     // バーサーカー: 足元の昂りの輪
    const step = rig ? 0 : P.moving ? Math.sin(P.animT * 14) : Math.sin(P.animT * 3) * 0.5;
    const blink = P.ifr > 0 && Math.floor(t * 20) % 2 === 0, ghostA = P.phase ? 0.45 : 1; // 霊体化(ネクロマンサー): 半透明
    const rim = bk ? bkRim(t) : null; // バーサーカー: 体の縁の光(狂乱・不屈)
    if (ms) { if (!blink || P.invT > 0) { if (rim) drawRim(psp, ms, P.x, py, P.facing < 0, ...rim); sx.globalAlpha = ghostA; drawPose(rig, psp, ms, P.x, py, P.facing < 0, P.hurtT > 0, bk ? dimEmit(psp.e, bkPaintLv()) : null); sx.globalAlpha = 1; } }
    else if (!blink || P.invT > 0) {
      if (rim) drawRim(psp, null, P.x, py, P.facing < 0, ...rim);
      const dimE = bk && P.hurtT <= 0; // バーサーカー: 戦化粧は怒りが溜まるほど光る(暗くした発光の絵を自分で重ねる)
      drawSp(psp, P.x, py - Math.abs(step) * (P.moving ? 1.5 : 0.5), { flip: P.facing < 0, white: P.hurtT > 0, sy: 1 + step * 0.05, sxk: 1 - step * 0.03, alpha: P.phase ? ghostA : undefined, emit: !dimE });
      if (dimE && psp.e) { gx.globalAlpha = 0.9; gx.drawImage(dimEmit(P.facing < 0 ? ART.variant(psp, 'flipE') : psp.e, bkPaintLv()), Math.round(P.x - cam.x - psp.w / 2), Math.round(py - cam.y - psp.h / 2)); gx.globalAlpha = 1; }
    }
    drawAstroBody(t, true); // アストロマンサー: 質量の塵・手前を回る星
    if (P.frzT > 0) { // 凍結(氷の槍): 体が氷に閉じ込められる
      const ix = Math.round(P.x - cam.x), iy = Math.round(py - cam.y), a0 = Math.min(1, P.frzT * 4);
      sx.globalAlpha = 0.25 * a0; sx.fillStyle = '#9ff7ff'; sx.fillRect(ix - 7, iy - 10, 15, 19);
      sx.globalAlpha = 0.7 * a0; sx.fillStyle = '#ffffff'; sx.fillRect(ix - 7, iy - 10, 15, 1); sx.fillRect(ix - 7, iy + 8, 15, 1); sx.fillRect(ix - 7, iy - 10, 1, 19); sx.fillRect(ix + 7, iy - 10, 1, 19); sx.fillRect(ix - 4, iy - 7, 1, 4); sx.fillRect(ix - 3, iy - 8, 2, 1);
      sx.globalAlpha = 1; gx.fillStyle = '#16303e'; gx.fillRect(ix - 6, iy - 9, 13, 17); // 光の層は暗い色で
    }
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
    const fireOn = !!(S.flamePuffs && S.flamePuffs.length) || !!P.flame || !!(P.wmClone && P.wmClone.chans.some(ch => ch.flame));
    if (fireOn) mineOn(); // 火炎放射は自分の攻撃(「攻撃の濃さ」の層に描く)
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
    // 杖先の噴き出し口と、炎に照らされた地面(ダブル放射は反対側にも)。分身の火炎放射は分身の位置から
    const flames = P.flame ? [[P.flame, P]] : [];
    if (P.wmClone) for (const ch of P.wmClone.chans) if (ch.flame) flames.push([ch.flame, ch.X]);
    for (const [f, o] of flames) {
      for (const a of f.dbl ? [f.a, f.a + Math.PI] : [f.a]) {
        const nx = o.x + Math.cos(a) * 9 - cam.x, ny = o.y - 6 + Math.sin(a) * 6 - cam.y;
        gx.globalAlpha = 0.5; pDisc(gx, nx, ny, 2 + Math.round(Math.random()), f.blue ? '#bff4ff' : '#ffc34a'); gx.globalAlpha = 1;
        pDisc(sx, nx, ny, 2, '#ffffff');
        addLight(o.x + Math.cos(a) * f.len * 0.5, o.y + Math.sin(a) * f.len * 0.5, f.len * 1.8, f.blue ? '#7ad7ff' : '#ff8a3d', 0.9 + 0.1 * Math.sin(t * 25));
      }
    }
    if (fireOn) mineOff();
    addLight(P.x, P.y, 105, DATA.classes[P.cls].light || '#ffe2b8', 0.95);
  }

  // ======== 自分の攻撃(手前側): ブレード・斬撃・弾・落雷・演出 ========
  mineOn();
  const bw = P.weapons.blade;
  if (bw && bw.blades) {
    if (P.bladeE && bw.blades.length) { // 刃輪展開: 広がった輪の軌跡がうっすら光る
      const b0 = bw.blades[0], R = Math.hypot(b0.x - P.x, b0.y - P.y), cx = P.x - cam.x, cy = P.y - cam.y;
      gx.globalAlpha = 0.35; gx.fillStyle = bw.evo ? '#8e0016' : '#d8e4ff';
      for (let a = 0; a < TAU; a += 0.05) gx.fillRect(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R), 1, 1);
      gx.globalAlpha = 1;
    }
    // 自分の刃と、分身(化身)の刃の輪
    const cbw = P.wmClone && P.wmClone.cws.blade;
    for (const b of cbw && cbw.blades ? bw.blades.concat(cbw.blades) : bw.blades) {
      drawRot(bw.evo ? 'bladeEvo' : 'blade', b.a * 2, b.x, b.y, { scale: b.s || 1 });
      addLight(b.x, b.y, 16 * (b.s || 1), bw.evo ? '#8e0016' : '#d8e4ff', 0.6);
    }
  }
  drawSlashes(false); // (一閃・葬送の構えで周りを暗くするので、死霊・霊弾はこの後に描いて浮かび上がらせる)
  drawSings(t); // 重力崩壊の特異点(引き寄せた敵の団子に隠れないよう、敵より手前に描く)
  // ネクロマンサーの死霊: 小さな紫白の人魂(進む向きと反対に尾を引く)。ふだんは暗め、飛びかかる瞬間だけ明るい
  if (P.souls && P.souls.length && !P.dead) for (const s of P.souls) {
    const x = Math.round(s.x - cam.x), y = Math.round(s.y - cam.y), v = Math.hypot(s.vx || 0, s.vy || 0);
    const tx = v > 20 ? -s.vx / v : 0, ty = v > 20 ? -s.vy / v : 1, k = 0.6 + 0.4 * s.bright; // 尾の向き(止まっているときは下)
    sx.fillStyle = '#5a3ab0';
    for (let i = 2; i <= 5; i++) { sx.globalAlpha = k * (1 - i / 6); sx.fillRect(Math.round(x + tx * i), Math.round(y + ty * i), 1, 1); }
    sx.globalAlpha = k; sx.fillStyle = '#8a6cff'; sx.fillRect(x - 1, y, 3, 1); sx.fillRect(x, y - 1, 1, 3);
    sx.fillStyle = s.bright > 0.3 ? '#d8c8ff' : '#b8a4ff'; sx.fillRect(x, y, 1, 1);
    gx.globalAlpha = 0.12 + 0.45 * s.bright; gx.fillStyle = '#6a4ad0'; gx.fillRect(x - 1, y, 3, 1); gx.fillRect(x, y - 1, 1, 3);
    sx.globalAlpha = gx.globalAlpha = 1;
    addLight(s.x, s.y, 8 + 10 * s.bright, '#7a50e0', 0.15 + 0.35 * s.bright);
  }
  // 葬送の霊弾: 紫の光の球と尾(集束は大きい)
  if (P.nbombs && P.nbombs.length) for (const b of P.nbombs) {
    const x = b.x - cam.x, y = b.y - cam.y, r = b.big ? 5 : 2, v = Math.hypot(b.vx, b.vy) || 1, L = b.big ? 14 : 8;
    gx.fillStyle = '#6a4ad0';
    for (let i = 1; i <= L; i++) { gx.globalAlpha = 0.6 * (1 - i / (L + 1)); gx.fillRect(Math.round(x - b.vx / v * i), Math.round(y - b.vy / v * i), b.big ? 2 : 1, b.big ? 2 : 1); }
    gx.globalAlpha = 1;
    pDisc(sx, x, y, r, '#4a2a9a'); pDisc(sx, x, y, Math.max(1, r - 1), '#8a6cff'); sx.fillStyle = '#d8c8ff'; sx.fillRect(Math.round(x), Math.round(y), 1, 1);
    gx.globalAlpha = 0.55; pDisc(gx, x, y, r, '#6a4ad0'); gx.globalAlpha = 1;
    addLight(b.x, b.y, b.big ? 50 : 22, '#7a50e0', 0.6);
  }
  // 大精霊(スピリットストームの特殊強化)
  if (P.bigWisps) for (const b of P.bigWisps) { drawSp(ART.S.wisp, b.x, b.y + Math.sin(t * 6) * 1.5, { scale: 3 }); addLight(b.x, b.y, 70, '#9dffcf', 0.9); }
  // スピリットストームの取り憑いた精霊: 宿主の頭の上を小さく回る緑の火(数が多いので、白く飛ばないよう暗めの緑で小さく)
  if (P.poss && P.poss.length) for (const ps of P.poss) {
    if (ps.done || !ps.e) continue;
    const e = ps.e, x = Math.round(e.x - cam.x + Math.cos(ps.a) * 4), y = Math.round(e.y - cam.y - (e.r || 4) - 5 + Math.sin(ps.a * 2)), f = Math.floor(t * 10 + ps.a) % 2;
    sx.fillStyle = '#1f8f6a'; sx.fillRect(x + (f ? 1 : 0), y - 2 - f, 1, 1); // 揺れる火の先
    sx.fillStyle = '#2fbf8a'; sx.fillRect(x - 1, y, 3, 1); sx.fillRect(x, y - 1, 1, 3);
    sx.fillStyle = '#9dffcf'; sx.fillRect(x, y, 1, 1);
    gx.globalAlpha = 0.35; gx.fillStyle = '#2fbf8a'; gx.fillRect(x - 1, y, 3, 1); gx.fillRect(x, y - 1, 1, 3); gx.globalAlpha = 1;
    addLight(e.x, e.y - 6, 12, '#2fbf8a', 0.3);
  }
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
      case 'wisp': drawSp(ART.S.wisp, p.x, p.y + Math.sin(p.t * 20)); addLight(p.x, p.y, p.eHit ? 16 : 24, '#9dffcf', p.eHit ? 0.35 : 0.7); break; // スピリットストームの精霊は一度に大量に出て重なるので、光を弱める
      case 'fire': drawSp(ART.S.fire, p.x, p.y); addLight(p.x, p.y, 30, '#ff8a3d', 0.8); break;
      case 'axe': {
        if (p.wh === 1) { // 巨斧旋風: 斧の周りを回る斬撃の弧(回転に合わせて回り、後ろへ尾を引く)
          const R = DATA.weapons.axe.evo.whirlR * P.area, cx = p.x - cam.x, cy = p.y - cam.y, fade = Math.min(1, p.wt / 0.15), s = Math.sign(p.spin) || 1;
          for (let k = 0; k < 3; k++) for (let j = 0; j < 10; j++) {
            const a = p.ang + k * TAU / 3 - s * j * 0.09, al = fade * (1 - j / 10), x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R);
            sx.globalAlpha = 0.5 * al; sx.fillStyle = j < 2 ? '#fff1d0' : '#ffb070'; sx.fillRect(x, y, 1, 1);
            gx.globalAlpha = 0.35 * al; gx.fillStyle = '#ffb070'; gx.fillRect(x, y, 1, 1);
          }
          sx.globalAlpha = gx.globalAlpha = 1;
          addLight(p.x, p.y, R * 2, '#ffb070', 0.35 * fade);
        }
        drawRot('axe', p.ang, p.x, p.y, { scale: p.sz || 1 }); // 斧の大きさ(武器Lv・熟練)
        break;
      }
      case 'toma': { // ワイルドトマホーク: 回る大きな斧が赤い軌跡を引く(新しいほど明るく太い)
        const tr = p.trail, n = tr.length / 2;
        for (let i = 1; i <= n; i++) {
          const k = i / n, x0 = tr[i * 2 - 2] - cam.x, y0 = tr[i * 2 - 1] - cam.y, x1 = (i < n ? tr[i * 2] : p.x) - cam.x, y1 = (i < n ? tr[i * 2 + 1] : p.y) - cam.y;
          const col = TOMA_TRAIL[k > 0.66 ? 0 : k > 0.33 ? 1 : 2];
          sx.globalAlpha = 0.55 * k; pLine(sx, x0, y0, x1, y1, col, Math.max(1, Math.round(p.sz * 0.9 * k)));
          gx.globalAlpha = 0.3 * k; pLine(gx, x0, y0, x1, y1, col, 1);
        }
        sx.globalAlpha = gx.globalAlpha = 1;
        drawRot('axe', p.ang, p.x, p.y, { scale: p.sz });
        addLight(p.x, p.y, 18, '#ffb070', 0.2); // 強い光だと銀の刃が白く飛んで斧の形が見えなくなる
        break;
      }
      case 'bscatter': { // 刃輪展開の飛び散る刃: 回りながら飛び、後ろに光の筋
        const a = Math.atan2(p.vy, p.vx), cx = p.x - cam.x, cy = p.y - cam.y;
        gx.fillStyle = p.col;
        for (let i = 2; i < 12; i++) { gx.globalAlpha = 0.6 * (1 - i / 12); gx.fillRect(Math.round(cx - Math.cos(a) * i), Math.round(cy - Math.sin(a) * i), 1, 1); }
        gx.globalAlpha = 1;
        drawRot(p.evo ? 'bladeEvo' : 'blade', p.t * 30, p.x, p.y, { scale: p.sz || 2 });
        addLight(p.x, p.y, 24, p.col, 0.7);
        break;
      }
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
  drawSkillFx(2); // スキルの光芒・光の柱・きらめき
  drawParts(true);
  drawRings(true);
  drawSkillFx(3); // スキルの集中線(画面)
  mineOff();

  // ======== 敵の攻撃(最前面): ボスの技・敵弾・予兆 ========
  for (const b of [...(S.bosses || []), ...(S.shadows || [])]) if (!b.dead) drawBossFx(b); // 双王(カオス)の2体目・影の王が呼んだ影の技も描く
  drawBfx();
  drawSkillFx(2, true); // ボスの攻撃の光芒・光の柱・きらめき
  drawSlashes(true);
  drawParts(false);
  drawRings(false);
  for (const p of eprojs) {
    if (!onScreen(p.x, p.y, 30)) continue;
    const a = Math.atan2(p.vy, p.vx);
    // アストロマンサーの重力圏: 止まった弾(時間停止)は暗い桃色の縁で薄く、ゆっくりになった弾(時の歪み)は少しくすむ
    const tm = p.tk === undefined || p.tk === 1 ? null : p.tk < -0.05 ? '#c29bff' : p.tk < 0.15 ? '#7ad7ff' : p.tk > 1.3 ? '#ff2a2a' : null; // 時の操作(終刻の死神): 止まる = 青・速い = 赤・巻き戻る = 紫
    const stop = !!p.stopT, al = stop ? 0.45 : P.astK > 0 && P.cls === 'astro' && d2(p.x, p.y, P.x, P.y) < P.astR * P.astR ? 0.75 : undefined, oc = stop ? '#8a2a6e' : tm || '#ff3b5c';
    if (p.lob) { // 放物線弾: 地面に影、高さぶん持ち上げて描く
      shadow(p.x, p.y + 2, p.kind === 'rock' ? 10 : 5);
      drawSp(ART.S[p.kind], p.x, p.y - p.z, { scale: p.kind === 'rock' ? 1 + p.z / 140 : 1, outline: oc, alpha: al });
      addLight(p.x, p.y - p.z, 20, oc, stop ? 0.2 : 0.5);
      continue;
    }
    // 敵弾は形に沿った赤いアウトラインで自分の弾と区別する。大きさは当たり判定(p.r)と同じく攻撃範囲の倍率を掛ける
    const A = CHAOS.area, ol = { outline: oc, alpha: al, scale: A * (p.sk || 1) }; // sk: エリートの弾は範囲 ×1.5 で大きい
    if (al !== undefined) sx.globalAlpha = al; // drawRot は透明度を受け取らないので、ここで掛けて戻す
    if (p.kind === 'boomer') drawRot('scythe', p.t * 16, p.x, p.y, { scale: 2 * A, outline: oc });
    else if (p.kind === 'glob' || p.kind === 'rbit' || p.kind === 'efire' || p.kind === 'esand' || p.kind === 'bball' || p.kind === 'vball') drawSp(ART.S[p.kind], p.x, p.y, ol);
    else if (p.kind === 'arrow' || p.kind === 'espear' || p.kind === 'bspear' || p.kind === 'trident' || p.kind === 'needle' || p.kind === 'eice' || p.kind === 'ispear' || p.kind === 'tick') drawRot(p.kind, a, p.x, p.y, ol);
    else if (p.kind === 'flake') drawSp(p.small ? ART.S.flakeS : ART.S.flake, p.x, p.y, ol); // 雪華弾(割れた後は小さな結晶)
    else if (p.kind === 'cog') drawSp(ART.S.gear[Math.floor(p.spin || 0) % 2], p.x, p.y, ol); // 番人の歯車弾
    else if (p.kind === 'bigsnow') { // 大雪玉: 転がる白い雪の玉(凹凸が回る)
      const R = Math.round(p.r), x = p.x - cam.x, y = p.y - cam.y;
      shadow(p.x, p.y + R - 2, R * 2);
      pDisc(sx, x, y, R, '#dce8f6'); pDisc(sx, x - R * 0.3, y - R * 0.3, Math.round(R * 0.5), '#ffffff');
      for (let k = 0; k < 6; k++) { const aa = (p.spin || 0) + TAU / 6 * k; sx.fillStyle = k % 2 ? '#b8c8e0' : '#ffffff'; sx.fillRect(Math.round(x + Math.cos(aa) * R * 0.65), Math.round(y + Math.sin(aa) * R * 0.65), 2, 2); }
      pCircle(sx, x, y, R, '#8aa0c8');
    }
    else if (p.kind === 'water') { drawSp(ART.S.water, p.x, p.y, ol); if (Math.random() < 0.3) part(p.x, p.y, rand(-8, 8), rand(-8, 8), 0.3, '#bff4ff', { drag: 2 }); } // 水弾: しずくの尾
    else if (p.kind === 'pshard') drawSp(ART.S.pshard[p.ci || 0], p.x, p.y, ol); // 七色の欠片
    else if (p.kind === 'ray') { // 乱反射の光: 白い頭と、七色に移ろう尾
      for (let i = 1; i < p.trail.length; i++) { const A = p.trail[i - 1], B = p.trail[i], k = i / p.trail.length; sx.globalAlpha = k; pLine(sx, A.x - cam.x, A.y - cam.y, B.x - cam.x, B.y - cam.y, PRISM[(i + Math.floor(t * 20)) % 7], 2); gx.globalAlpha = 1; pLine(gx, A.x - cam.x, A.y - cam.y, B.x - cam.x, B.y - cam.y, '#3a2a5a', 1); }
      sx.globalAlpha = 1; const hx = Math.round(p.x - cam.x), hy = Math.round(p.y - cam.y);
      sx.fillStyle = oc; sx.fillRect(hx - 2, hy - 2, 5, 5); sx.fillStyle = gx.fillStyle = '#ffffff'; sx.fillRect(hx - 1, hy - 1, 3, 3); gx.fillRect(hx, hy, 1, 1);
      addLight(p.x, p.y, 34, '#ffffff', 0.9);
    }
    else if (p.kind === 'prismorb') { // 光の屈折弾: 七色に移ろう大きな光の玉(白い芯)
      const R = Math.round(p.r), x = p.x - cam.x, y = p.y - cam.y, c = PRISM[Math.floor(t * 12) % 7];
      pCircle(sx, x, y, R + 1, oc); pDisc(sx, x, y, R, c); pDisc(sx, x, y, Math.max(1, R - 2), '#ffffff'); pDisc(gx, x, y, Math.max(1, R - 3), '#3a2a5a');
      addLight(p.x, p.y, 40, c, 0.8);
    }
    else if (p.kind === 'phantom') { // 結晶の残像・幻の鹿: 透きとおった七色の大鹿
      const sp2 = ART.S.stag, img = ART.tint(p.face < 0 ? ART.variant(sp2, 'flip') : sp2.c, PRISM[Math.floor(p.t * 12) % 7]);
      const w = sp2.w, h = sp2.h, dx = Math.round(p.x - cam.x - w / 2), dy = Math.round(p.y - cam.y - h / 2);
      outlineImg(img, dx, dy, w, h, oc); // 縁取りの上に、七色に移ろう結晶の姿
      sx.drawImage(img, dx, dy);
      gx.globalAlpha = 1; gx.drawImage(ART.tint(p.face < 0 ? ART.variant(sp2, 'flip') : sp2.c, '#3a2a5a'), dx, dy); // ほのかに光る(光の層は暗い色で)
      addLight(p.x, p.y, 50, '#d88aff', 0.7);
    }
    else if (p.kind === 'scythe' || p.kind === 'rscythe') drawRot(p.kind, p.t * 14, p.x, p.y, ol);
    else if (p.kind === 'vslash') { // 影刃・五月雨: 地面に垂直に立った三日月の刃が飛んでいく(当たり判定は地面の線)
      const c = Math.cos(p.a), s = Math.sin(p.a), x = p.x - cam.x, y = p.y - cam.y, L = Math.round(p.len), H = 24 * A, fl = Math.floor(t * 30) % 2;
      pLine(sx, x - c * L, y - s * L, x + c * L, y + s * L, oc, 3); pLine(sx, x - c * L, y - s * L, x + c * L, y + s * L, '#2a1240', 1); // 地面の線(当たり判定)
      for (let i = -L; i <= L; i++) { // 立った刃: 前ほど高く、後ろへ反る三日月
        const u = (i + L) / (2 * L), hh = Math.round(H * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 0.8) * (0.45 + 0.55 * u));
        if (hh < 1) continue;
        const bx = Math.round(x + c * i), by = Math.round(y + s * i);
        sx.fillStyle = '#1a0a2a'; sx.fillRect(bx, by - hh, 1, hh);
        sx.fillStyle = u > 0.7 ? '#ffffff' : '#c79bff'; sx.fillRect(bx, by - hh, 1, 1); // 刃の縁
        if (hh > 3) { sx.fillStyle = '#7a3ab0'; sx.fillRect(bx, by - hh + 1, 1, 2); }
        gx.fillStyle = u > 0.7 && fl ? '#6a3a9a' : '#3a1a5a'; gx.fillRect(bx, by - hh, 1, 2);
      }
      addLight(p.x, p.y - 10, 40, '#a66bff', 0.7);
    }
    else if (p.kind === 'hshadow') { // 追い影: 黒い影の玉。紫の炎の頭と、進む向きに光る2つの目
      const R = Math.round(p.r * 1.3), x = p.x - cam.x, y = p.y - cam.y, a2 = Math.atan2(p.vy, p.vx), fl = Math.floor(t * 20) % 2;
      pCircle(sx, x, y, R + 1, oc); pDisc(sx, x, y, R, '#2a1240'); pDisc(sx, x - Math.cos(a2), y - Math.sin(a2), Math.max(1, R - 1), '#06030c');
      for (const sd of [-1, 1]) { const ex2 = Math.round(x + Math.cos(a2) * 2 - Math.sin(a2) * sd * 2), ey2 = Math.round(y + Math.sin(a2) * 2 + Math.cos(a2) * sd * 2); sx.fillStyle = fl ? '#ffffff' : '#e8c8ff'; sx.fillRect(ex2, ey2, 1, 1); gx.fillStyle = '#7a3ab0'; gx.fillRect(ex2, ey2, 1, 1); }
      pCircle(gx, x, y, R, '#3a1a5a');
      addLight(p.x, p.y, 28, '#a66bff', 0.6);
    }
    else if (p.kind === 'darkorb') { // 闇の玉(影の眼): 黒い芯を紫の光が縁取り、脈打つ
      const R = Math.round(p.r * 1.6), x = p.x - cam.x, y = p.y - cam.y, pl = Math.sin(t * 14 + p.t * 7) > 0 ? 1 : 0;
      pCircle(sx, x, y, R + 1 + pl, oc); pDisc(sx, x, y, R, '#7a3ab0'); pDisc(sx, x, y, Math.max(1, R - 1), '#1a0a2a');
      sx.fillStyle = '#e8c8ff'; sx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 1, 1);
      pCircle(gx, x, y, R, '#4a1a7a');
      addLight(p.x, p.y, 30, '#a66bff', 0.7);
    }
    else drawSp(ART.S.ball, p.x, p.y, ol);
    sx.globalAlpha = 1;
    addLight(p.x, p.y, (p.kind === 'boomer' ? 40 : p.kind === 'efire' ? 34 : 22) * A, p.kind === 'efire' && !stop ? '#ff6a2a' : oc, stop ? 0.2 : 0.6);
  }
  // 予兆: 赤い半透明の塗り(時間とともに内側が満ちる) + 点滅する縁
  //   当たる時を示す動き: 円は外から縁へ縮む輪 / 帯は攻撃の向きへ流れる山形 / 扇は外から縁へ縮む弧。当たった瞬間は形が一瞬白く光る(snap)
  const edge = warnBlink ? '#ff3b5c' : '#ffd0d8';
  const blind = P.darkT > 0; // 暗闇(王墓): 敵の攻撃の予告が見えない
  for (const w of warns) {
    if (blind || (w.ink && S.inInk)) continue; // 墨だまりの中では触手の予告が見えない
    const k = w.t / w.life, wx = w.x - cam.x, wy = w.y - cam.y;
    if (w.snap) { drawWarnSnap(w, wx, wy, 1 - k); continue; }
    if (w.kind === 'line' && w.sever) { // 断界: 画面の端まで届く細い線が点滅する(当たれば即死)
      const ca = Math.cos(w.a), sa = Math.sin(w.a), fl = Math.floor(t * (8 + 16 * k)) % 2, ex2 = wx + ca * w.len, ey2 = wy + sa * w.len, nx = -sa * w.w / 2, ny = ca * w.w / 2;
      sx.globalAlpha = 0.14 + 0.16 * k; sx.fillStyle = '#ff3b5c'; sx.beginPath(); sx.moveTo(wx + nx, wy + ny); sx.lineTo(ex2 + nx, ey2 + ny); sx.lineTo(ex2 - nx, ey2 - ny); sx.lineTo(wx - nx, wy - ny); sx.fill(); sx.globalAlpha = 1;
      pLine(sx, wx, wy, ex2, ey2, fl ? '#ffffff' : '#ff3b5c'); pLine(gx, wx, wy, ex2, ey2, dimCol('#ff3b5c', 0.4 + 0.5 * k));
      continue;
    }
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
      const cw = Math.min(w.w * 0.3, 7), off = (t * 60) % 14; // 攻撃の向きへ流れる山形(>)
      sx.globalAlpha = 0.25 + 0.35 * k;
      for (let d = off + 5; d < w.len - 4; d += 14) {
        const cx = wx + ca * d, cy = wy + sa * d;
        for (const s of [-1, 1]) pLine(sx, cx + ca * 3, cy + sa * 3, cx - ca * 2 - sa * cw * s, cy - sa * 2 + ca * cw * s, '#ff3b5c');
      }
      sx.globalAlpha = 1;
    } else if (w.kind === 'fan') { // 扇: 塗り(内側から満ちる)+ 点滅する弧と両端
      const R = w.r, sector = (rr, al) => { if (rr < 1) return; sx.globalAlpha = al; sx.fillStyle = '#ff3b5c'; sx.beginPath(); sx.moveTo(wx, wy); sx.arc(wx, wy, rr, w.a - w.h, w.a + w.h); sx.closePath(); sx.fill(); };
      sector(R, 0.18); sector(R * (w.noFill ? 0 : k), 0.22); sx.globalAlpha = 1;
      const n = Math.ceil(R * w.h * 2);
      for (let i = 0; i <= n; i++) {
        const aa = w.a - w.h + 2 * w.h * i / Math.max(1, n), px = Math.round(wx + Math.cos(aa) * R), py = Math.round(wy + Math.sin(aa) * R);
        sx.fillStyle = edge; sx.fillRect(px, py, 1, 1); gx.fillStyle = '#ff3b5c'; gx.fillRect(px, py, 1, 1);
      }
      for (const s of [-1, 1]) { const ex = wx + Math.cos(w.a + s * w.h) * R, ey = wy + Math.sin(w.a + s * w.h) * R; pLine(sx, wx, wy, ex, ey, edge); pLine(gx, wx, wy, ex, ey, '#ff3b5c'); }
      if (k < 1) { // 外から縁へ縮む弧(当たる時)
        const TR = R * (1 + 0.25 * (1 - k)), m = Math.ceil(TR * w.h * 2);
        sx.globalAlpha = 0.25 + 0.5 * k; sx.fillStyle = '#ff3b5c'; gx.fillStyle = dimCol('#ff3b5c', 0.3 + 0.4 * k);
        for (let i = 0; i <= m; i += 2) { const aa = w.a - w.h + 2 * w.h * i / Math.max(1, m), px = Math.round(wx + Math.cos(aa) * TR), py = Math.round(wy + Math.sin(aa) * TR); sx.fillRect(px, py, 1, 1); gx.fillRect(px, py, 1, 1); }
        sx.globalAlpha = 1;
      }
    } else if (w.kind === 'ring') { // 輪(影の三重輪): 内側 r0 〜 外側 r。塗り(内側から満ちる)+ 点滅する内と外の縁
      const R = Math.round(w.r), R0 = Math.round(w.r0 || 0), annulus = (r1, al) => { sx.globalAlpha = al; sx.fillStyle = '#ff3b5c'; sx.beginPath(); sx.arc(wx, wy, r1, 0, TAU); if (R0 > 0) sx.arc(wx, wy, R0, 0, TAU, true); sx.fill('evenodd'); };
      annulus(R, 0.16); if (k > 0.02) annulus(R0 + (R - R0) * k, 0.2); sx.globalAlpha = 1;
      pCircle(sx, wx, wy, R, edge); pCircle(gx, wx, wy, R, '#ff3b5c');
      if (R0 > 0) { pCircle(sx, wx, wy, R0, edge); pCircle(gx, wx, wy, R0, '#ff3b5c'); }
      if (k < 1) { const TR = Math.round(R * (1 + 0.25 * (1 - k))); sx.globalAlpha = 0.25 + 0.5 * k; pCircle(sx, wx, wy, TR, '#ff3b5c', 2); sx.globalAlpha = 1; }
    } else {
      const R = Math.round(w.r);
      sx.globalAlpha = 0.18; pDisc(sx, wx, wy, R, '#ff3b5c');
      sx.globalAlpha = 0.22; pDisc(sx, wx, wy, Math.round(R * k), '#ff3b5c'); sx.globalAlpha = 1;
      pCircle(sx, wx, wy, R, edge); pCircle(gx, wx, wy, R, '#ff3b5c');
      if (k < 1) { const TR = Math.round(R * (1 + 0.35 * (1 - k))); sx.globalAlpha = 0.25 + 0.5 * k; pCircle(sx, wx, wy, TR, '#ff3b5c', 2); sx.globalAlpha = 1; pCircle(gx, wx, wy, TR, dimCol('#ff3b5c', 0.3 + 0.4 * k), 2); } // 外から縁へ縮む輪(当たる時)
    }
  }
  // エリート群: 画面の外にいるエリートの方向を、画面の縁に赤い二重の矢印で示す
  if (S.phase && S.phase.kind === 'elite') {
    const cx0 = VW / 2, cy0 = VH / 2, blink = Math.floor(t * 5) % 2;
    for (const e of S.phase.elites) {
      if (e.dead || onScreen(e.x, e.y, -10)) continue;
      const a = Math.atan2(e.y - cam.y - cy0, e.x - cam.x - cx0), ca = Math.cos(a), sa = Math.sin(a);
      const k = Math.min((cx0 - 14) / Math.max(1e-4, Math.abs(ca)), (cy0 - 14) / Math.max(1e-4, Math.abs(sa)));
      for (let j = 0; j < 2; j++) {
        const d = k - j * 5 + (blink ? 1 : 0), tx = cx0 + ca * d, ty = cy0 + sa * d;
        for (const s of [-1, 1]) {
          const wx = tx + Math.cos(a + s * 2.4) * 6, wy = ty + Math.sin(a + s * 2.4) * 6;
          pLine(sx, tx, ty, wx, wy, j ? '#ffd0d8' : '#ff3b5c', 2); pLine(gx, tx, ty, wx, wy, '#a01828', 2);
        }
      }
    }
  }

  drawMotes(st);
  if (S.cine) drawCine(); // 冥鎖(影の王)の止まった時

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

// 灰色にした絵(クロノ・エコーの姿)。元の絵ごとに一度だけ作る
const GRAY_IMG = new Map();
function grayOf(img) {
  let c = GRAY_IMG.get(img);
  if (c) return c;
  c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const v = Math.min(255, (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) * 0.8 + 40); p[i] = v; p[i + 1] = v; p[i + 2] = Math.min(255, v + 10); }
  x.putImageData(d, 0, 0); GRAY_IMG.set(img, c);
  return c;
}
// 予告が終わった瞬間(当たる瞬間): 同じ形が一瞬白く光って消える(f: 残りの濃さ 1 → 0)
//   面は場面の層に薄く塗るだけ(光の層に面を描くと、着弾の閃光と重なって形の全体が白く飛ぶ)。光らせるのは縁だけ
function drawWarnSnap(w, wx, wy, f) {
  const sx = GFX.sctx, gx = GFX.gctx, ge = dimCol('#ff3b5c', 0.8 * f); // 光の層は色で弱める
  const edge = (x0, y0, x1, y1) => { sx.globalAlpha = f; pLine(sx, x0, y0, x1, y1, '#ffffff'); pLine(gx, x0, y0, x1, y1, ge); };
  sx.fillStyle = '#ffd0d8';
  if (w.kind === 'line') {
    const ca = Math.cos(w.a), sa = Math.sin(w.a), nx = -sa * w.w / 2, ny = ca * w.w / 2;
    sx.globalAlpha = 0.22 * f; sx.beginPath(); sx.moveTo(wx + nx, wy + ny); sx.lineTo(wx + ca * w.len + nx, wy + sa * w.len + ny); sx.lineTo(wx + ca * w.len - nx, wy + sa * w.len - ny); sx.lineTo(wx - nx, wy - ny); sx.fill();
    for (const s of [-1, 1]) edge(wx + nx * s, wy + ny * s, wx + ca * w.len + nx * s, wy + sa * w.len + ny * s);
  } else if (w.kind === 'fan') {
    if (w.r >= 1) {
      sx.globalAlpha = 0.22 * f; sx.beginPath(); sx.moveTo(wx, wy); sx.arc(wx, wy, w.r, w.a - w.h, w.a + w.h); sx.closePath(); sx.fill();
      for (const s of [-1, 1]) edge(wx, wy, wx + Math.cos(w.a + s * w.h) * w.r, wy + Math.sin(w.a + s * w.h) * w.r);
      const m = Math.ceil(w.r * w.h * 2); sx.globalAlpha = f; sx.fillStyle = '#ffffff'; gx.fillStyle = ge; // 弧の縁(1px の点)
      for (let i = 0; i <= m; i++) { const aa = w.a - w.h + 2 * w.h * i / Math.max(1, m), px = Math.round(wx + Math.cos(aa) * w.r), py = Math.round(wy + Math.sin(aa) * w.r); sx.fillRect(px, py, 1, 1); gx.fillRect(px, py, 1, 1); }
    }
  } else if (w.kind === 'ring') { // 輪: 内と外の縁が光る
    sx.globalAlpha = f; pCircle(sx, wx, wy, Math.round(w.r), '#ffffff'); pCircle(gx, wx, wy, Math.round(w.r), ge);
    if (w.r0 > 0) { pCircle(sx, wx, wy, Math.round(w.r0), '#ffffff'); pCircle(gx, wx, wy, Math.round(w.r0), ge); }
  } else {
    const R = Math.round(w.r * (1 + 0.12 * (1 - f))); // 少し広がりながら消える
    sx.globalAlpha = 0.22 * f; pDisc(sx, wx, wy, R, '#ffd0d8'); sx.globalAlpha = f; pCircle(sx, wx, wy, R, '#ffffff'); pCircle(gx, wx, wy, R, ge);
  }
  sx.globalAlpha = 1;
}
// ボスの構え(予備動作。windup の間): 足元に縮んでいく赤い破線の輪(回る)と、ボスの色の内側の輪。溜まるほど明るい
//   技の直前の頭上の赤いきらめきは world.js の bossAI
function drawBossCharge(t) {
  const sx = GFX.sctx, gx = GFX.gctx;
  for (const e of [...(S.bosses || []), ...(S.shadows || [])]) {
    const ai = e.ai;
    if (e.dead || !ai || !(ai.wind > 0) || !ai.windT || !onScreen(e.x, e.y, 80)) continue;
    const u = clamp(1 - ai.wind / ai.windT, 0, 1), cx = e.x - cam.x, cy = e.y - cam.y + e.r * 0.6, R = e.r * (2.3 - 1.2 * easeOutCubic(u)), q = 0.42;
    ellBoth(sx, gx, cx, cy, R, R * q, '#ff3b5c', 0.3 + 0.45 * u, dimCol('#ff3b5c', 0.2 + 0.5 * u), 12, t * 3);
    ellBoth(sx, gx, cx, cy, e.r * 0.95, e.r * 0.95 * q, e.col, 0.2 + 0.35 * u, dimCol(e.col, 0.15 + 0.3 * u));
    addLight(e.x, e.y, e.r * 3 + 40 * u, '#ff3b5c', 0.2 + 0.45 * u);
  }
}
// 影(影の王が呼んだボス): 黒い体に紫の縁取り。光る所(目など)は紫に光る
function drawShade(sp, x, y, o) {
  const sx = GFX.sctx, gx = GFX.gctx, img = o.flip ? ART.variant(sp, 'flip') : sp.c, sc = o.scale || 1;
  const w = Math.round(sp.w * sc * (o.sxk || 1)), h = Math.round(sp.h * sc * (o.sy || 1));
  const dx = Math.round(x - cam.x - w / 2), dy = Math.round(y - cam.y + sp.h * sc / 2 - h);
  const rim = ART.tint(img, o.white ? '#ffffff' : '#a66bff');
  sx.globalAlpha = o.alpha ?? 1;
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) sx.drawImage(rim, dx + ox, dy + oy, w, h);
  sx.drawImage(ART.tint(img, '#0c0614'), dx, dy, w, h);
  if (sp.e) { const em = o.flip ? ART.variant(sp, 'flipE') : sp.e; sx.drawImage(ART.tint(em, '#e8c8ff'), dx, dy, w, h); gx.drawImage(ART.tint(em, '#7a3ab0'), dx, dy, w, h); }
  sx.globalAlpha = 1;
}
// 影の王: 影を呼んでいる間の守り(回る紫の殻と、影へつながる糸)/ 追い影の構え(手に闇)/ 断界の構え(掲げた剣が紫に光る)/ 冥鎖の鎖
function drawSkFx(e, sx, gx, ex, ey) {
  const ai = e.ai, t = GFX.fx.time, sh = ai.shade && !ai.shade.dead ? ai.shade : null;
  if (e.hideA !== undefined && e.hideA < 0.5) { if (P.chain) drawChain(); return; } // 影歩で沈んでいる
  if (sh || ai.act === 'summon') { // 守りの殻: 回る紫の破線の輪(2重)
    ellBoth(sx, gx, ex, ey + 2, 18, 16, '#a66bff', 0.55 + 0.2 * Math.sin(t * 6), dimCol('#a66bff', 0.35), 14, t * 2);
    ellBoth(sx, gx, ex, ey + 2, 23, 20, '#7a3ab0', 0.35, dimCol('#7a3ab0', 0.25), 10, -t * 1.4);
    addLight(e.x, e.y, 60, '#7a3ab0', 0.5);
  }
  if (sh) { // 影へつながる紫の糸(脈が影へ流れる)
    const x1 = sh.x - cam.x, y1 = sh.y - cam.y, L = Math.hypot(x1 - ex, y1 - ey) || 1, n = Math.max(2, Math.round(L / 3)), nx = -(y1 - ey) / L, ny = (x1 - ex) / L;
    for (let i = 0; i <= n; i++) {
      const u = i / n, wv = Math.sin(u * Math.PI) * Math.sin(t * 7 + u * 9) * 4, px = Math.round(ex + (x1 - ex) * u + nx * wv), py = Math.round(ey + (y1 - ey) * u + ny * wv), on = (i + Math.floor(t * 30)) % 8 < 2;
      sx.fillStyle = on ? '#e8c8ff' : '#5a2a8a'; sx.fillRect(px, py, 1, 1);
      if (on) { gx.fillStyle = '#4a1a7a'; gx.fillRect(px, py, 1, 1); }
    }
  }
  if (ai.act === 'summon') { // 影喚び: 掲げた剣の先に闇が集まる
    const hx = ex + (e.face || 1) * 9, hy = ey - 20, k = 0.5 + 0.5 * Math.sin(t * 20);
    pDisc(sx, hx, hy, 3, '#1a0a2a'); pCircle(sx, hx, hy, 4 + Math.round(k), '#c79bff'); pCircle(gx, hx, hy, 5, dimCol('#a66bff', 0.7));
    addLight(e.x + (e.face || 1) * 9, e.y - 20, 50, '#a66bff', 0.9);
  }
  if (ai.handGlow > 0) { // 追い影の構え: 手に闇の玉が膨らむ
    const k = 1 - ai.handGlow / 0.5, hx = ex + (e.face || 1) * 8, hy = ey - 4;
    pDisc(sx, hx, hy, Math.round(2 + 4 * k), '#1a0a2a'); pCircle(sx, hx, hy, Math.round(3 + 4 * k), '#a66bff'); pCircle(gx, hx, hy, Math.round(3 + 4 * k), dimCol('#a66bff', 0.6));
    addLight(e.x + (e.face || 1) * 8, e.y - 4, 30 + 40 * k, '#a66bff', 0.8);
  }
  if (warns.some(w => w.sever && !w.snap)) { // 断界の構え: 剣が紫に光り、刃から闇がこぼれる
    const fl = Math.floor(t * 16) % 2, bx = ex + (e.face || 1) * 7;
    pLine(sx, bx, ey - 26, bx, ey + 10, fl ? '#e8c8ff' : '#a66bff', 2); pLine(gx, bx, ey - 26, bx, ey + 10, dimCol('#a66bff', 0.7), 2);
    addLight(e.x + (e.face || 1) * 7, e.y - 8, 70, '#a66bff', 0.9);
  }
  if (P.chain) drawChain();
}
// 冥鎖の鎖: 杭の輪からプレイヤーへ。張るほどまっすぐになり、紫の光が走る。足元に鎖の輪
function drawChain() {
  const st = P.chain && P.chain.stake;
  if (!st || st.dead) return;
  const sx = GFX.sctx, gx = GFX.gctx, x0 = st.x - cam.x, y0 = st.y - 14 - cam.y, x1 = P.x - cam.x, y1 = P.y - 2 - cam.y, d = Math.hypot(x1 - x0, y1 - y0), taut = clamp((d - 40) / 30, 0, 1), t = GFX.fx.time;
  const n = Math.max(2, Math.round(d / 3));
  for (let i = 0; i <= n; i++) {
    const u = i / n, sag = (1 - taut) * Math.sin(u * Math.PI) * Math.min(12, d * 0.25), px = Math.round(x0 + (x1 - x0) * u), py = Math.round(y0 + (y1 - y0) * u + sag);
    sx.fillStyle = '#0c0913'; sx.fillRect(px - 1, py - 1, 3, 3);
    sx.fillStyle = i % 2 ? '#5a5a6a' : '#9a9aaa'; sx.fillRect(px, py, i % 2 ? 1 : 2, 1);
    if (taut > 0.3 && (i + Math.floor(t * 24)) % 6 === 0) { sx.fillStyle = '#e8c8ff'; sx.fillRect(px, py, 1, 1); gx.fillStyle = '#4a1a7a'; gx.fillRect(px, py, 1, 1); }
  }
  ellBoth(sx, gx, x1, y1 + 8, 6, 3, '#9a9aaa', 0.9, dimCol('#7a3ab0', 0.3 + 0.4 * taut));
  addLight(P.x, P.y, 30 + 30 * taut, '#7a3ab0', 0.3 + 0.4 * taut);
}
// 冥鎖の止まった時: 画面が暗く沈み、空から黒い杭が落ちて刺さり、鎖がプレイヤーへ巻きつく
function drawCine() {
  const c = S.cine;
  if (!c || c.kind !== 'chain') return;
  const sx = GFX.sctx, gx = GFX.gctx, t = c.t, x = c.x - cam.x, y = c.y - cam.y;
  sx.globalAlpha = Math.min(0.55, t * 2); sx.fillStyle = '#06030c'; sx.fillRect(0, 0, GFX.VW, GFX.VH); sx.globalAlpha = 1;
  const k = Math.min(1, t / 0.55), sp = ART.S.obj_stake;
  if (t < 0.55) { const u = 1 - k * k; pLine(sx, x, y - 240, x, y - u * 200 - 10, '#2a1240', 1); } // 落ちてくる跡
  drawSp(sp, c.x, c.y - (1 - k * k) * 200 - 10, { scale: 1.5 });
  addLight(c.x, c.y - (1 - k * k) * 200 - 10, 50, '#a66bff', 0.9);
  if (t >= 0.55) {
    const u = Math.min(1, (t - 0.55) / 0.35);
    pCircle(sx, x, y, Math.round(8 + 40 * u), u < 1 ? '#e8c8ff' : '#a66bff'); pCircle(gx, x, y, Math.round(8 + 40 * u), dimCol('#a66bff', 0.7 * (1 - u)), 2);
    for (let i = 0; i < 6; i++) { const a = TAU / 6 * i + 0.3, L = 10 + 26 * u; pLine(sx, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L * 0.5, '#7a3ab0'); } // 床に走るひび
    const ch = clamp((t - 0.7) / 0.6, 0, 1); // 鎖がプレイヤーへ巻きつく(輪が下から順に締まる)
    for (let r = 0; r < 3; r++) { const v = clamp(ch * 3 - r, 0, 1); if (v <= 0) continue; const ry = y + 4 - r * 6; ellBoth(sx, gx, x, ry, 9 - v * 3, (9 - v * 3) * 0.4, r % 2 ? '#5a5a6a' : '#9a9aaa', 0.95, dimCol('#a66bff', 0.5 * v)); }
    addLight(c.x, c.y, 90, '#a66bff', 0.8 * (1 - u * 0.5));
  }
}
// ケルベロスの首: 体の胸から3本の首が頭へ伸びる(黒紫の毛、上側に照り)。壊れた首は短い付け根から黒い血がしたたる
function drawCerbNecks(e, sp, yo) {
  const sx = GFX.sctx, f = e.face || 1, ai = e.ai, ax = e.x + 7 * f - cam.x, ay = e.y + yo - 5 - cam.y;
  for (let i = 0; i < 3; i++) {
    const h = ai.heads && ai.heads[i], H = CHEAD[i], live = h && !h.dead;
    const hx = (live ? h.x : e.x + H.dx * f) - 3 * f - cam.x, hy = (live ? h.y - h.hz - (h.raise ? 4 : 0) : e.y + H.dy - H.hz) + 2 + yo - cam.y;
    const k = live ? Math.max(0.3, h.rise) : 0.4, x1 = ax + (hx - ax) * k, y1 = ay + (hy - ay) * k;
    pLine(sx, ax, ay, x1, y1, '#0e0a14', 6); pLine(sx, ax, ay, x1, y1, '#281c36', 4); pLine(sx, ax, ay - 1, x1, y1 - 1, '#4a3462', 2);
    if (!live) { pDisc(sx, x1, y1, 2, '#5a1020'); sx.fillStyle = '#1a0a14'; sx.fillRect(Math.round(x1), Math.round(y1) + 1, 1, 2 + Math.floor((GFX.fx.time * 3 + i) % 3)); } // 付け根の黒い血
  }
}
// ケルベロスの技の見た目: 毒の息(緑の煙の扇)/ 闇の遠吠えの構え(足元から黒い霧)/ 瘴気弾の構え
function drawCerbFx(e, sx, gx, ex, ey, A) {
  const ai = e.ai, t = GFX.fx.time;
  if (ai.br) { // 毒の息: 扇いっぱいに緑の煙(半透明の扇が揺らめき、縁が明滅する)
    const b = ai.br, R = b.r * A, fl = 0.75 + 0.25 * Math.sin(t * 30);
    for (const c of b.cones) {
      for (const [rr, al, col] of [[R, 0.13, '#1e8a2a'], [R * 0.7, 0.16, '#3aff5a'], [R * 0.35, 0.18, '#c8ffb0']]) { sx.globalAlpha = al * fl; sx.fillStyle = col; sx.beginPath(); sx.moveTo(ex, ey); sx.arc(ex, ey, rr, c.a - b.h, c.a + b.h); sx.closePath(); sx.fill(); }
      sx.globalAlpha = 1;
      const n = Math.ceil(R * b.h * 2);
      for (let i = 0; i <= n; i += 2) { const aa = c.a - b.h + 2 * b.h * i / n, px = Math.round(ex + Math.cos(aa) * R), py = Math.round(ey + Math.sin(aa) * R); sx.fillStyle = (i + Math.floor(t * 20)) % 4 ? '#7dff6a' : '#ff3b5c'; sx.fillRect(px, py, 1, 1); gx.fillStyle = '#1e5a1a'; gx.fillRect(px, py, 1, 1); } // 縁(危険の赤が混じって明滅)
      for (let r = 16; r < R; r += 22) addLight(e.x + Math.cos(c.a) * r, e.y + Math.sin(c.a) * r, r * 0.9, '#5aff6a', 0.5);
    }
  }
  if (ai.mist && ai.wind > 0) { // 闇の遠吠えの構え: 足元から黒い霧が渦を巻いて立ちのぼり、闇の首が光る
    const u = 1 - ai.wind / ai.windT;
    for (let k = 0; k < 3; k++) { const pa = rand(0, TAU), pr = rand(10, 30 + 40 * u); part(e.x + Math.cos(pa) * pr, e.y + 8 + Math.sin(pa) * pr * 0.4, -Math.sin(pa) * 20, -rand(10, 40), rand(0.5, 0.9), pick(['#0a0612', '#1a0a2a', '#3a1a5a', '#7a3ab0']), { drag: 1, sz: pick([1, 2, 3]) }); }
    gx.globalAlpha = 1; pCircle(gx, ex, ey + 8, Math.round(14 + 50 * u), dimCol('#7a3ab0', 0.25 + 0.4 * u), 2);
    addLight(e.x, e.y, 60 + 80 * u, '#7a3ab0', 0.4 + 0.4 * u);
  }
}
// ボス固有の付随表現(ゴーレムの拳・掲げた岩 / ドラゴンのブレス・ビーム・溜め)
function drawBossFx(e) {
  const sx = GFX.sctx, gx = GFX.gctx, ai = e.ai, ex = e.x - cam.x, ey = e.y - cam.y, sp = ART.S[e.boss], yo = -(e.jz || 0);
  const A = CHAOS.area; // 攻撃範囲の倍率(当たり判定と同じだけ見た目も広げる)
  if (e.fists) for (const f of e.fists) {
    pLine(sx, ex, ey, f.x - cam.x, f.y - cam.y, '#6a6258', 3);
    drawSp(ART.S.fist, f.x, f.y, { scale: A });
    addLight(f.x, f.y, 26 * A, '#6ee7ff', 0.5);
  }
  if (e.hold) drawSp(ART.S.rock, e.x, e.y + yo - sp.h / 2 - 5);
  if (e.boss === 'cerberus') drawCerbFx(e, sx, gx, ex, ey, A);
  if (e.boss === 'shadowking' && !e.shadow) drawSkFx(e, sx, gx, ex, ey);
  if (e.stun > 0 || e.stunVis) for (let i = 0; i < 3; i++) { const a = GFX.fx.time * 6 + TAU / 3 * i, x = Math.round(ex + Math.cos(a) * 10), y = Math.round(ey + yo - sp.h / 2 - 4 + Math.sin(a) * 3); sx.fillStyle = gx.fillStyle = '#ffe14a'; sx.fillRect(x - 1, y, 3, 1); sx.fillRect(x, y - 1, 1, 3); gx.fillRect(x, y, 1, 1); } // ひるみ(砂時計・終刻の時計を壊した): 頭の上を星が回る
  if (ai.act === 'breath' && e.boss === 'cdragon') for (let r = 20; r < 125 * A; r += 26 * A) addLight(e.x + Math.cos(ai.ba) * r, e.y + Math.sin(ai.ba) * r, r * 0.9, '#ff6a2a', 0.7);
  if (ai.act === 'beam' && ai.bA != null) {
    const BL = BEAM_LEN * A, bx = ex + Math.cos(ai.bA) * BL, by = ey + Math.sin(ai.bA) * BL, fl = Math.floor(GFX.fx.time * 30) % 2;
    pLine(gx, ex, ey, bx, by, '#ff4a8a', Math.round((9 + fl * 2) * A));
    pLine(sx, ex, ey, bx, by, '#ffd0f0', Math.round(5 * A));
    pLine(sx, ex, ey, bx, by, '#ffffff', Math.round(3 * A));
    for (let r = 0; r < BL; r += 40) addLight(e.x + Math.cos(ai.bA) * r, e.y + Math.sin(ai.bA) * r, 60, '#ff4a8a', 0.8);
  }
  if (ai.chg && ai.wind > 0) {
    gx.globalAlpha = 0.6; pCircle(gx, ex, ey, Math.round(10 + ai.wind * 20), '#ff4a8a', 2); gx.globalAlpha = 1;
    addLight(e.x, e.y, 120 - ai.wind * 50, '#ff4a8a', 1);
  }
  const t = GFX.fx.time;
  // 白骨竜の狙い撃ち: 撃つ前に頭(目)が光る
  if (e.boss === 'wyrm' && ai.aiming > 0) {
    const k = 1 - ai.aiming / 0.3, hx = ex, hy = ey + yo - sp.h / 2 + 7;
    for (const s of [-1, 1]) { sx.fillStyle = gx.fillStyle = '#ffffff'; sx.fillRect(Math.round(hx + s * 4) - 1, Math.round(hy), 3, 2); gx.fillRect(Math.round(hx + s * 4) - 1, Math.round(hy), 3, 2); }
    addLight(e.x, e.y + yo - sp.h / 2 + 7, 30 + 50 * k, '#6ee7ff', 1);
  }
  // 巨大スライム: 吸収の光の線 / 分裂の残り時間(縮む弧)と中スライムへの糸
  if (e.boss === 'gslime') {
    for (const s of enemies) if (s.pulled === e && !s.dead) {
      const fl = 0.5 + 0.5 * Math.sin(t * 20 + s.id);
      pLine(gx, ex, ey, s.x - cam.x, s.y - cam.y, fl > 0.5 ? '#5dff8a' : '#2a7a4a', 1);
      sx.globalAlpha = 0.7; pLine(sx, ex, ey, s.x - cam.x, s.y - cam.y, '#d8fff2', 1); sx.globalAlpha = 1;
      addLight(s.x, s.y, 30, '#5dff8a', 0.6);
    }
    if (ai.act === 'split' && ai.mids) {
      const k = Math.max(0, ai.pt / 12), R = 22, n = Math.ceil(TAU * R * k);
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + TAU * k * i / Math.max(1, n); sx.fillStyle = gx.fillStyle = k < 0.25 && Math.floor(t * 8) % 2 ? '#ff3b5c' : '#d8fff2'; sx.fillRect(Math.round(ex + Math.cos(a) * R), Math.round(ey + Math.sin(a) * R), 1, 1); gx.fillRect(Math.round(ex + Math.cos(a) * R), Math.round(ey + Math.sin(a) * R), 1, 1); }
      for (const m of ai.mids) if (!m.dead) { sx.globalAlpha = 0.35; pLine(sx, ex, ey, m.x - cam.x, m.y - cam.y, '#4fd6a8', 1); sx.globalAlpha = 1; }
    }
  }
  // ゴーレム: 岩の鎧(体を覆う岩・削った分だけ入るひび・DPSチェックの輪)/ ひるみの星 / 全速の赤い光
  if (e.boss === 'golem') {
    if (ai.act === 'armor') {
      const dx = Math.round(ex - sp.w / 2), dy = Math.round(ey + yo - sp.h / 2);
      sx.globalAlpha = 0.55; sx.drawImage(ART.tint(sp.c, '#3a3530'), dx, dy); sx.globalAlpha = 1;
      const n = Math.floor(ai.armK * 14);
      for (let i = 0; i < n; i++) { // 削るほど増えるひび(光る)
        const x0 = dx + 2 + hash2(i, 41) * (sp.w - 4), y0 = dy + 2 + hash2(i, 43) * (sp.h - 4), a = hash2(i, 47) * TAU;
        pLine(gx, x0, y0, x0 + Math.cos(a) * 4, y0 + Math.sin(a) * 4, '#6ee7ff', 1);
      }
      const R = 26, m = Math.ceil(TAU * R);
      for (let i = 0; i < m; i++) { // DPSチェックの輪: 削った割合だけ金色に満ちる。残り時間で点滅
        const u = i / m, a = -Math.PI / 2 + TAU * u, on = u <= ai.armK;
        if (!on && i % 2) continue;
        sx.fillStyle = on ? '#ffd23f' : ai.pt < 1.5 && Math.floor(t * 8) % 2 ? '#ff3b5c' : '#8a8676';
        sx.fillRect(Math.round(ex + Math.cos(a) * R), Math.round(ey + Math.sin(a) * R), 1, 1);
        if (on) { gx.fillStyle = '#5a4a10'; gx.fillRect(Math.round(ex + Math.cos(a) * R), Math.round(ey + Math.sin(a) * R), 1, 1); }
      }
    } else if (ai.act === 'stagger') {
      for (let i = 0; i < 3; i++) { const a = t * 6 + TAU / 3 * i, x = Math.round(ex + Math.cos(a) * 9), y = Math.round(ey + yo - sp.h / 2 - 4 + Math.sin(a) * 3); sx.fillStyle = gx.fillStyle = '#ffe14a'; sx.fillRect(x, y, 1, 1); gx.fillRect(x, y, 1, 1); sx.fillRect(x - 1, y, 3, 1); sx.fillRect(x, y - 1, 1, 3); }
    }
    if (ai.overT > 0) addLight(e.x, e.y, 80, '#ff3b1a', 0.8);
  }
  // 炎魔イフリート: 激昂の熱(足元の赤熱した輪と強い光)/ 祭壇から流れ込む炎の筋 / 祭壇で強まった炎のオーラ
  if (e.boss === 'ifrit') {
    if (ai.enraged) {
      const rr = Math.round(sp.w * 0.75 + Math.sin(t * 10) * 1.5), fy = Math.round(ey + sp.h * 0.55);
      sx.globalAlpha = 0.6; pCircle(sx, ex, fy, rr, '#ffc34a'); sx.globalAlpha = 1;
      pCircle(gx, ex, fy, rr, '#6a2a08'); // 光の層は暗い色で
      addLight(e.x, e.y, 90 + Math.sin(t * 8) * 10, '#ff8a3d', 0.85);
    }
    let n = 0;
    for (const o of enemies) if (o.owner === e && o.obj === 'altar' && !o.dead) {
      n++;
      const ox = o.x - cam.x, oy = o.y - cam.y - 10, k = (t * 1.5 + o.seed) % 1;
      sx.globalAlpha = 0.35; pLine(sx, ox, oy, ex, ey + yo, '#ff6a2a', 1); sx.globalAlpha = 1;
      const px = ox + (ex - ox) * k, py = oy + (ey + yo - oy) * k; sx.fillStyle = gx.fillStyle = '#ffc34a'; sx.fillRect(Math.round(px), Math.round(py), 2, 2); gx.fillRect(Math.round(px), Math.round(py), 2, 2); // 流れる火の玉
    }
    if (n > 0) { gx.globalAlpha = 1; pCircle(gx, ex, ey + yo, Math.round(sp.w * 0.6 + Math.sin(t * 8) * 1.5), n > 2 ? '#ff6a2a' : '#7a2a0a', 1); addLight(e.x, e.y, 60 + n * 20, '#ff6a2a', 0.6 + n * 0.1); }
  }
  // 晶角の大鹿: ひるみの星
  if (e.boss === 'stag' && ai.act === 'stun') {
    for (let i = 0; i < 3; i++) { const a = t * 6 + TAU / 3 * i, x = Math.round(ex + Math.cos(a) * 9), y = Math.round(ey + yo - sp.h / 2 - 3 + Math.sin(a) * 3); sx.fillStyle = gx.fillStyle = PRISM[(i * 2) % 7]; sx.fillRect(x - 1, y, 3, 1); sx.fillRect(x, y - 1, 1, 3); gx.fillRect(x, y, 1, 1); }
  }
  // 七彩の女王: 分身の間、本物だけ 0.5秒ごとに弱く光る
  if (e.boss === 'pqueen') {
    if (ai.clones && t % 0.5 < 0.12) { const gxp = Math.round(ex), gyp = Math.round(ey + yo - sp.h / 2 - 3); sx.fillStyle = gx.fillStyle = '#fff6c8'; sx.fillRect(gxp - 1, gyp, 3, 1); sx.fillRect(gxp, gyp - 1, 1, 3); gx.fillRect(gxp, gyp, 1, 1); } // 本物のしるし
  }
  // クラーケン: 触手が 2本以上ある間は、触手から本体へ水の流れ(守り)と、本体を包む水の膜
  if (e.boss === 'kraken' && e.takeK < 1 && !e.hidden) {
    for (const o of enemies) {
      if (o.owner !== e || o.obj !== 'tentacle' || o.dead) continue;
      const ox = o.x - cam.x, oy = o.y - cam.y - 8, n = Math.floor(Math.hypot(ex - ox, ey - oy) / 4);
      for (let i = 0; i <= n; i++) {
        if ((i + Math.floor(t * 14)) % 3) continue;
        const k = i / Math.max(1, n), x = Math.round(ox + (ex - ox) * k), y = Math.round(oy + (ey - oy) * k + Math.sin(k * Math.PI) * -6);
        sx.fillStyle = '#7ad7ff'; sx.fillRect(x, y, 1, 1); gx.fillStyle = '#1a4a5a'; gx.fillRect(x, y, 1, 1);
      }
    }
    const rr = Math.round(e.r + 8 + Math.sin(t * 4));
    sx.globalAlpha = 0.5; pCircle(sx, ex, ey, rr, '#7ad7ff'); sx.globalAlpha = 1;
    pCircle(gx, ex, ey, rr, '#1a4a5a', 2);
  }
  // 深淵の海竜: 潜航中は大きな影が水の下を泳ぐ / 水流ブレス
  if (e.boss === 'levia') {
    if (ai.act === 'dive') {
      sx.globalAlpha = 0.45; sx.fillStyle = '#04121a';
      sx.beginPath(); sx.ellipse(ex, ey, 26, 11, Math.sin(t * 2) * 0.35, 0, TAU); sx.fill();
      sx.beginPath(); sx.ellipse(ex - 22 * Math.cos(Math.sin(t * 2) * 0.35), ey - 22 * Math.sin(Math.sin(t * 2) * 0.35) + Math.sin(t * 5) * 3, 12, 4, Math.sin(t * 2) * 0.35 + Math.sin(t * 5) * 0.3, 0, TAU); sx.fill(); // 尾
      sx.globalAlpha = 1;
    }
    if (ai.act === 'breath' && ai.ba != null) {
      const BL = 220 * A, bx = ex + Math.cos(ai.ba) * BL, by = ey + Math.sin(ai.ba) * BL, fl = Math.floor(t * 30) % 2;
      pLine(gx, ex, ey, bx, by, '#1a5a7a', Math.round((10 + fl * 2) * A));
      pLine(sx, ex, ey, bx, by, '#2a8ac8', Math.round(9 * A));
      pLine(sx, ex, ey, bx, by, '#7ad7ff', Math.round(5 * A));
      pLine(sx, ex, ey, bx, by, '#ffffff', Math.max(1, Math.round(2 * A)));
      for (let r = 0; r < BL; r += 44) addLight(e.x + Math.cos(ai.ba) * r, e.y + Math.sin(ai.ba) * r, 60, '#7ad7ff', 0.7);
    }
  }
  // 死神: 変身(時が止まる間、背後に大きな時計が現れて針が止まり、体が赤くひび割れる)
  if (e.boss === 'reaper' && S.morph && S.morph.e === e) {
    const k = 1 - S.morph.t / 2, R = Math.round(30 + 40 * k);
    sx.globalAlpha = 0.5 * k; pCircle(sx, ex, ey, R, '#c29bff'); pCircle(sx, ex, ey, R - 3, '#ff3b5c'); sx.globalAlpha = 1;
    for (let i = 0; i < 12; i++) { const a = TAU / 12 * i; sx.fillStyle = gx.fillStyle = '#ffd0d8'; sx.fillRect(Math.round(ex + Math.cos(a) * (R - 6)), Math.round(ey + Math.sin(a) * (R - 6)), 2, 2); gx.fillRect(Math.round(ex + Math.cos(a) * (R - 6)), Math.round(ey + Math.sin(a) * (R - 6)), 1, 1); }
    const ha = -Math.PI / 2 + (1 - k) * 8; pLine(sx, ex, ey, ex + Math.cos(ha) * R * 0.8, ey + Math.sin(ha) * R * 0.8, '#ffffff', 2); pLine(gx, ex, ey, ex + Math.cos(ha) * R * 0.8, ey + Math.sin(ha) * R * 0.8, '#5a1020', 1);
    for (let i = 0; i < Math.floor(k * 10); i++) { const a = hash2(i, 61) * TAU, l = 6 + hash2(i, 67) * 10; pLine(gx, ex, ey + yo - 6, ex + Math.cos(a) * l, ey + yo - 6 + Math.sin(a) * l, '#ff3b5c', 1); } // 赤いひび
    addLight(e.x, e.y, 60 + 120 * k, '#ff3b5c', 0.4 + 0.6 * k);
  }
  // 終刻の死神: 背後に回る時計の光輪(12の目盛りと針)/ 秒針の弾幕の前に目盛りが光る / 時間停止中は止まった時計
  if (e.boss === 'fhour' && !e.hidden) { // 十二の刻印で消えている間は描かない
    const R = 22, frozen = S.tstop > 0, rv = S.rewind > 0 ? -4 : 1;
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + TAU / 12 * i, glow = ai.secGlow > 0 && Math.floor(t * 12 + i) % 2 === 0, rr = ai.secGlow > 0 ? R + 10 : R;
      sx.fillStyle = glow ? '#ffffff' : '#c8a050'; sx.fillRect(Math.round(ex + Math.cos(a) * rr), Math.round(ey + yo - 4 + Math.sin(a) * rr), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
      if (glow) { gx.fillStyle = '#ff3b5c'; gx.fillRect(Math.round(ex + Math.cos(a) * rr), Math.round(ey + yo - 4 + Math.sin(a) * rr), 2, 2); }
    }
    const ha = frozen ? -Math.PI / 2 : t * 2 * rv - Math.PI / 2, ma = frozen ? Math.PI / 6 : t * 0.3 * rv;
    sx.globalAlpha = 0.7; pLine(sx, ex, ey + yo - 4, ex + Math.cos(ha) * (R - 3), ey + yo - 4 + Math.sin(ha) * (R - 3), '#ff3b5c'); pLine(sx, ex, ey + yo - 4, ex + Math.cos(ma) * (R - 8), ey + yo - 4 + Math.sin(ma) * (R - 8), '#c8a050', 2); sx.globalAlpha = 1;
    if (ai.secGlow > 0) addLight(e.x, e.y, 100, '#ff3b5c', 0.7);
    drawSp(sp, e.x, e.y + yo, { flip: (e.face || 1) < 0, sy: e.sq || 1, sxk: 2 - (e.sq || 1), white: e.flash > 0 }); // 光輪の上に体を描き直す
  }
  // クロノ・エコー(終刻の死神): 灰色の死神。0.4秒で現れ、技が終わると 0.4秒で消える。秒針の弾幕の構えでは目盛りが光る
  if (e.boss === 'fhour' && ai.echoes) for (const g of ai.echoes) {
    if (g.hidden) continue;
    const a = Math.min(1, g.t / 0.4) * (g.out ? Math.max(0, 1 - g.out / 0.4) : 1), gx0 = g.x - cam.x, gy0 = g.y - cam.y;
    sx.globalAlpha = 0.75 * a; sx.drawImage(grayOf((g.face || 1) < 0 ? ART.variant(sp, 'flip') : sp.c), Math.round(gx0 - sp.w / 2), Math.round(gy0 - sp.h / 2));
    if (g.ai.secGlow > 0) for (let i = 0; i < 12; i++) { const ta = -Math.PI / 2 + TAU / 12 * i; if (Math.floor(t * 12 + i) % 2) continue; sx.fillStyle = '#e8e8f0'; sx.fillRect(Math.round(gx0 + Math.cos(ta) * 32), Math.round(gy0 - 4 + Math.sin(ta) * 32), 2, 2); }
    sx.globalAlpha = 1;
    addLight(g.x, g.y, 46, '#9a9aaa', 0.5 * a);
  }
  // 時計仕掛けの番人: 背中のゼンマイ / 時針と分針 / 鐘の光 / ゼンマイ巻きのDPSチェックの輪 / 止まった火花の星 / 全速の赤い光(リングギアは床として描く)
  if (e.boss === 'warden') {
    const kx = ex + 13, ky = ey + yo - 2, ka = ai.keyA || 0; // ゼンマイの鍵(背中から横に突き出て回る)
    pLine(sx, ex + 8, ky, kx, ky, '#8a6a30', 2);
    for (const s2 of [1, -1]) { const bx = kx + Math.cos(ka) * 4 * s2, by = ky + Math.sin(ka) * 2 * s2; pDisc(sx, bx, by, 2, '#c8a050'); sx.fillStyle = '#241e1a'; sx.fillRect(Math.round(bx), Math.round(by), 1, 1); }
    if (ai.hands) { // 2本の針: 薄く出る → 真鍮の針が回る
      const on = ai.hands.t > 1, L = 180 * A;
      for (const [ha, w, col] of [[ai.hands.a1, 10, '#8a6a30'], [ai.hands.a2, 7, '#c8a050']]) {
        const x1 = ex + Math.cos(ha) * L, y1 = ey + Math.sin(ha) * L;
        if (!on) { sx.globalAlpha = 0.35; pLine(sx, ex, ey, x1, y1, '#c8a050', 3); sx.globalAlpha = 1; continue; }
        const nx = -Math.sin(ha) * w * A * 0.3, ny = Math.cos(ha) * w * A * 0.3;
        pLine(sx, ex, ey, x1, y1, '#241e1a', Math.round((w + 2) * A)); pLine(sx, ex, ey, x1, y1, col, Math.round(w * A));
        pLine(sx, ex + nx, ey + ny, x1 + nx, y1 + ny, '#e8c880', 1); // 片側の照り返し
        for (const k of [0.55, 0.85]) { const tx = ex + Math.cos(ha) * L * k, ty = ey + Math.sin(ha) * L * k; pDisc(sx, tx, ty, Math.round(w * 0.55 * A) + 1, '#241e1a'); pDisc(sx, tx, ty, Math.round(w * 0.55 * A), col); } // 針の飾り(透かしの輪)
      }
      if (on) { pDisc(sx, ex, ey, 5, '#241e1a'); pDisc(sx, ex, ey, 4, '#c8a050'); addLight(e.x, e.y, 90, '#ffd27a', 0.3); }
    }
    if (ai.hands) drawSp(sp, e.x, e.y + yo, { flip: (e.face || 1) < 0, sy: e.sq || 1, sxk: 2 - (e.sq || 1), white: e.flash > 0 }); // 針の上に体を描き直す(軸は胸の文字盤)
    if (ai.bellT > 0) { const k = 1 - ai.bellT / 0.8; pCircle(gx, ex, ey + yo - sp.h / 2 + 4, Math.round(6 + 6 * k), '#7a5a10'); addLight(e.x, e.y + yo - sp.h / 2 + 4, 40 + 60 * k, '#ffd27a', 0.9); } // 鐘が光る
    if (ai.act === 'spring') {
      const R = 26, m = Math.ceil(TAU * R);
      for (let i = 0; i < m; i++) { // DPSチェックの輪: 削った割合だけ金色に満ちる。残り時間で点滅
        const u = i / m, a2 = -Math.PI / 2 + TAU * u, on = u <= ai.armK;
        if (!on && i % 2) continue;
        sx.fillStyle = on ? '#ffd23f' : ai.pt < 1.5 && Math.floor(t * 8) % 2 ? '#ff3b5c' : '#8a7a60';
        sx.fillRect(Math.round(ex + Math.cos(a2) * R), Math.round(ey + Math.sin(a2) * R), 1, 1);
        if (on) { gx.fillStyle = '#5a4a10'; gx.fillRect(Math.round(ex + Math.cos(a2) * R), Math.round(ey + Math.sin(a2) * R), 1, 1); }
      }
    } else if (ai.act === 'stall') {
      for (let i = 0; i < 3; i++) { const a2 = t * 6 + TAU / 3 * i, x = Math.round(ex + Math.cos(a2) * 10), y = Math.round(ey + yo - sp.h / 2 - 4 + Math.sin(a2) * 3); sx.fillStyle = gx.fillStyle = '#ffe14a'; sx.fillRect(x - 1, y, 3, 1); sx.fillRect(x, y - 1, 1, 3); gx.fillRect(x, y, 1, 1); }
    }
    if (ai.fastT > 0) addLight(e.x, e.y, 80, '#ff8a3d', 0.8);
  }
  // 霜の巨人: 氷槌を振りかぶる間、頭上に氷が集まる / 地吹雪の前に体が白く光る
  if (e.boss === 'fgiant') {
    if (ai.raise && ai.wind > 0) {
      const k = 1 - ai.wind / ai.raise, R = Math.round(3 + 7 * k), hx = ex, hy = ey + yo - sp.h / 2 - 4 - R;
      pDisc(sx, hx, hy, R, '#bff4ff'); pDisc(sx, hx - 1, hy - 1, Math.max(1, R - 3), '#ffffff'); pCircle(sx, hx, hy, R, '#5ab8e8');
      pDisc(gx, hx, hy, Math.max(1, R - 2), k > 0.7 && Math.floor(GFX.fx.time * 16) % 2 ? '#7ab8d0' : '#3a6a80');
      for (let i = 0; i < 3; i++) { const pa = rand(0, TAU), pr = R + rand(6, 14); part(e.x + Math.cos(pa) * pr, e.y + yo - sp.h / 2 - 4 - R + Math.sin(pa) * pr, -Math.cos(pa) * pr * 4, -Math.sin(pa) * pr * 4, 0.2, pick(['#ffffff', '#9ff7ff']), { glow: true, drag: 0 }); } // 冷気が吸い込まれる
      addLight(e.x, e.y + yo - sp.h / 2 - 4 - R, 40 + 40 * k, '#9ff7ff', 0.8);
    }
    if (ai.glowT > 0) { const k = 1 - ai.glowT / 0.5; gx.globalAlpha = 1; pCircle(gx, ex, ey, Math.round(e.r + 4 + k * 60 * A), '#8aa0b8', 2); pCircle(sx, ex, ey, Math.round(e.r + 4 + k * 60 * A), '#ffffff'); addLight(e.x, e.y, 120, '#ffffff', 0.6); }
  }
  // カオスドラゴン: 空襲の影(空の上の竜の影が地面を走る)
  if (e.boss === 'cdragon' && ai.act === 'raid' && ai.rd && ai.rd.ph === 'sky') {
    const R = 15 * A, x = ex, y = ey, c = Math.cos(ai.rd.th), s = Math.sin(ai.rd.th);
    sx.globalAlpha = 0.55; sx.fillStyle = '#12060e';
    sx.beginPath(); sx.ellipse(x, y, R, R * 0.7, ai.rd.th, 0, TAU); sx.fill();
    for (const w of [-1, 1]) { // 翼の影
      const wx = x - s * w * R * 1.1, wy = y + c * w * R * 1.1;
      sx.beginPath(); sx.ellipse(wx, wy, R * 0.9, R * 0.35, ai.rd.th + w * 0.4, 0, TAU); sx.fill();
    }
    sx.globalAlpha = 1;
    pCircle(sx, x, y, Math.round(R), Math.floor(t * 10) % 2 ? '#ff3b5c' : '#ffd0d8');
    addLight(e.x, e.y, 60, '#ff6a2a', 0.5);
  }
}

// ボスの技の見た目だけの演出(bfx。world.js の各ボスの技が積む)
function drawBfx() {
  const sx = GFX.sctx, gx = GFX.gctx, t = GFX.fx.time;
  for (const f of bfx) {
    const fx = f.x - cam.x, fy = f.y - cam.y, u = f.t / f.life;
    if (f.kind === 'portal') { // 影喚び: 床に影の門が開く(黒い楕円が広がり、紫のルーンが回る)→ 影が出ると閉じる
      const k = Math.min(1, f.t / 0.5), close = f.t > 1.25 ? Math.max(0, 1 - (f.t - 1.25) / 0.45) : 1, R = f.r * easeOutCubic(k) * close;
      if (R >= 1) {
        sx.globalAlpha = 0.85; sx.fillStyle = '#06030c'; sx.beginPath(); sx.ellipse(fx, fy, R, R * 0.45, 0, 0, TAU); sx.fill(); sx.globalAlpha = 1;
        ellBoth(sx, gx, fx, fy, R, R * 0.45, '#a66bff', 0.9, dimCol('#a66bff', 0.6));
        ellBoth(sx, gx, fx, fy, R * 0.7, R * 0.32, '#7a3ab0', 0.8, dimCol('#7a3ab0', 0.4), 12, t * 2);
        for (let i = 0; i < 8; i++) { const a = t * 1.5 + TAU / 8 * i, px = Math.round(fx + Math.cos(a) * R * 0.85), py = Math.round(fy + Math.sin(a) * R * 0.38); sx.fillStyle = '#e8c8ff'; sx.fillRect(px, py - 1, 1, 3); sx.fillRect(px - 1, py, 3, 1); gx.fillStyle = '#4a1a7a'; gx.fillRect(px, py, 1, 1); } // ルーン
        for (let k2 = 0; k2 < 3; k2++) part(f.x + rand(-R, R) * 0.8, f.y + rand(-R, R) * 0.3, rand(-6, 6), -rand(20, 60), rand(0.4, 0.8), pick(['#0a0612', '#2a1240', '#7a3ab0']), { drag: 1, sz: pick([1, 2]) }); // 門から闇が立ちのぼる
        addLight(f.x, f.y, R * 3, '#7a3ab0', 0.7 * close);
      }
      continue;
    }
    if (f.kind === 'spool') { // 影歩: 影だまり(沈む = 縮んで消える / 出る = 広がって脈打つ)
      const k = f.sink ? 1 - u : Math.min(1, u * 2), R = 4 + 9 * k;
      sx.globalAlpha = 0.85 * (f.sink ? 1 : Math.min(1, (1 - u) * 3)); sx.fillStyle = '#06030c'; sx.beginPath(); sx.ellipse(fx, fy + 4, R, R * 0.45, 0, 0, TAU); sx.fill(); sx.globalAlpha = 1;
      ellBoth(sx, gx, fx, fy + 4, R, R * 0.45, '#a66bff', 0.8, dimCol('#a66bff', 0.5));
      continue;
    }
    if (f.kind === 'skaura') { // 影の三重輪の構え: 足元から闇が渦を巻いて広がる
      const R = f.r * Math.min(1, u * 1.6);
      for (let i = 0; i < 3; i++) ellBoth(sx, gx, fx, fy + 2, R * (0.4 + 0.3 * i), R * (0.4 + 0.3 * i) * 0.9, i % 2 ? '#7a3ab0' : '#a66bff', 0.5, dimCol('#7a3ab0', 0.3), 10 + i * 4, t * (2 + i) * (i % 2 ? -1 : 1));
      if (Math.random() < 0.6) { const a = rand(0, TAU), r = rand(0.3, 1) * R; part(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, -Math.sin(a) * 40, Math.cos(a) * 40 - 10, 0.5, pick(SKC.slice(0, 4)), { glow: Math.random() < 0.3, drag: 1 }); }
      addLight(f.x, f.y, R * 1.6, '#7a3ab0', 0.5);
      continue;
    }
    if (f.kind === 'skring') { // 影の三重輪の炸裂: 輪の形に闇が噴き上がり、縁が光る
      const fade = 1 - u, R0 = f.r0, R1 = f.r1;
      sx.globalAlpha = 0.5 * fade; sx.fillStyle = '#2a1240'; sx.beginPath(); sx.arc(fx, fy, R1, 0, TAU); if (R0 > 0) sx.arc(fx, fy, R0, 0, TAU, true); sx.fill('evenodd'); sx.globalAlpha = 1;
      sx.globalAlpha = fade; pCircle(sx, fx, fy, Math.round(R1), '#e8c8ff'); if (R0 > 0) pCircle(sx, fx, fy, Math.round(R0), '#a66bff'); sx.globalAlpha = 1;
      pCircle(gx, fx, fy, Math.round(R1), dimCol('#a66bff', 0.7 * fade), 2);
      addLight(f.x, f.y, R1 * 1.5, '#a66bff', 0.7 * fade);
      continue;
    }
    if (f.kind === 'sever') { // 断界: 一瞬で伸びる終わりのない斬撃(白い芯・紫の光・黒い縁)
      const c = Math.cos(f.a), s = Math.sin(f.a), x1 = fx + c * f.len, y1 = fy + s * f.len, fade = 1 - u, w = Math.max(1, Math.round(6 * fade));
      pLine(sx, fx, fy, x1, y1, '#06030c', w + 4); pLine(sx, fx, fy, x1, y1, '#a66bff', w + 2); pLine(sx, fx, fy, x1, y1, '#ffffff', w);
      pLine(gx, fx, fy, x1, y1, dimCol('#a66bff', 0.8 * fade), w + 2);
      for (let d = 0; d < Math.min(f.len, 600); d += 50) addLight(f.x + c * d, f.y + s * d, 80, '#a66bff', 0.9 * fade);
      continue;
    }
    if (f.kind === 'ghost') { // 残像(ケルベロスの突進・影の王の影歩): 体の形を単色で、すぐ消える
      const sp = ART.S[f.spr], img = ART.tint(f.flip ? ART.variant(sp, 'flip') : sp.c, f.col);
      sx.globalAlpha = 0.5 * (1 - u); sx.drawImage(img, Math.round(fx - sp.w / 2), Math.round(fy - sp.h / 2)); sx.globalAlpha = 1;
      gx.globalAlpha = 1; gx.drawImage(ART.tint(f.flip ? ART.variant(sp, 'flip') : sp.c, dimCol(f.col, 0.25 * (1 - u))), Math.round(fx - sp.w / 2), Math.round(fy - sp.h / 2));
      continue;
    }
    if (f.kind === 'cbite') { // 噛みつき(ケルベロス): 上下のあごが閉じる(黒いあごに白い牙)。閉じた瞬間に首の色の閃光
      const k = Math.min(1, u / 0.35), gap = (1 - easeOutCubic(k)) * 9 + 1, c = Math.cos(f.a), s = Math.sin(f.a), fade = u < 0.5 ? 1 : 1 - (u - 0.5) / 0.5;
      for (const sd of [-1, 1]) for (let i = -7; i <= 7; i++) {
        const bend = (1 - (i * i) / 49) * gap * sd, px = fx + c * i - s * bend, py = fy + s * i + c * bend;
        sx.globalAlpha = fade; sx.fillStyle = '#1e1428'; sx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
        if (i % 2 === 0) { sx.fillStyle = '#ffffff'; sx.fillRect(Math.round(px + s * sd * 2), Math.round(py - c * sd * 2), 1, 1); } // 牙はあごの内側
      }
      sx.globalAlpha = 1;
      if (k >= 1 && u < 0.5) pDisc(gx, fx, fy, 5, dimCol(f.col, 0.7));
      if (k >= 1 && !f.u0) { f.u0 = 1; fxGlint(f.x, f.y, 10, f.col, { foe: true, life: 0.18 }); } // 閉じた瞬間に1回だけ
      addLight(f.x, f.y, 40, f.col, 0.6 * fade);
      continue;
    }
    if (f.kind === 'grave') { // 死者の手の印: 印の中で土がうごめき、小さな墓標が立つ
      for (let i = 0; i < 9; i++) {
        const a = hash2(i, 3) * TAU + Math.sin(t * 6 + i) * 0.4, r = (0.2 + 0.55 * hash2(i, 5)) * 16;
        sx.fillStyle = i % 2 ? '#3a2a1a' : '#6a5038'; sx.fillRect(Math.round(fx + Math.cos(a) * r), Math.round(fy + Math.sin(a) * r * 0.7), 2, 1);
      }
      const bx = Math.round(fx), by = Math.round(fy) + Math.round(Math.sin(t * 9) * 0.6);
      sx.fillStyle = '#3a2a1a'; sx.fillRect(bx - 1, by - 5, 3, 7); sx.fillRect(bx - 2, by - 4, 5, 3);
      sx.fillStyle = '#b8b098'; sx.fillRect(bx, by - 4, 1, 5); sx.fillRect(bx - 1, by - 3, 3, 1);
      gx.fillStyle = '#2a3a14'; gx.fillRect(bx, by - 4, 1, 5); // うっすら緑に光る(光の層は暗い色で)
    } else if (f.kind === 'hands') { // 死者の手: 骨の手が地面から突き出て、沈んでいく
      for (let i = 0; i < 6; i++) {
        const a = hash2(i, f.seed) * TAU, r = Math.sqrt(hash2(i + 9, f.seed)) * f.r * 0.85;
        const hx = Math.round(fx + Math.cos(a) * r), hy = Math.round(fy + Math.sin(a) * r * 0.75);
        const k = u < 0.15 ? u / 0.15 : u > 0.6 ? Math.max(0, 1 - (u - 0.6) / 0.4) : 1, h = Math.round(9 * k * (0.75 + 0.5 * hash2(i + 3, f.seed)));
        sx.fillStyle = '#5a4030'; sx.fillRect(hx - 2, hy, 5, 1); sx.fillRect(hx - 1, hy - 1, 3, 1); // 盛り上がった土
        if (h <= 0) continue;
        sx.fillStyle = '#1e1414'; sx.fillRect(hx - 1, hy - h - 2, 3, h + 2);
        sx.fillStyle = '#e8e0c0'; sx.fillRect(hx, hy - h, 1, h);
        if (h > 3) { sx.fillRect(hx - 1, hy - h - 1, 1, 1); sx.fillRect(hx + 1, hy - h - 1, 1, 1); sx.fillRect(hx, hy - h - 2, 1, 1); } // 指
      }
      addLight(f.x, f.y, f.r * 2.2, '#b8d86a', 0.5 * (1 - u));
    } else if (f.kind === 'crack') { // 地割れ: 地面の裂け目が前へ走り(赤熱)、噴き出したあと冷えて消える
      const grow = Math.min(1, f.t / f.T), L = f.len * grow, c = Math.cos(f.a), s = Math.sin(f.a), nx = -s, ny = c;
      const erupt = f.t >= f.T + 0.2, fade = erupt ? Math.max(0, 1 - (f.t - f.T - 0.2) / 0.7) : 1;
      const gcol = !erupt ? (Math.floor(t * 12) % 2 ? '#7a3008' : '#4a1e06') : fade > 0.66 ? '#ffb347' : fade > 0.33 ? '#8a5a1a' : '#3a2008'; // 光の層は色で明るさが決まる
      let px = fx, py = fy;
      for (let d = 3; d <= L; d += 3) {
        const j = (hash2(Math.floor(d / 3), f.seed) - 0.5) * 4, qx = fx + c * d + nx * j, qy = fy + s * d + ny * j;
        sx.globalAlpha = fade; pLine(sx, px, py, qx, qy, '#1a1008', 2); sx.globalAlpha = 1;
        pLine(gx, px, py, qx, qy, gcol, 1);
        if (hash2(Math.floor(d / 3) + 77, f.seed) < 0.25) { const bj = (hash2(Math.floor(d / 3) + 5, f.seed) - 0.5) * 2; sx.globalAlpha = fade; pLine(sx, qx, qy, qx + nx * bj * 5 + c * 2, qy + ny * bj * 5 + s * 2, '#1a1008', 1); sx.globalAlpha = 1; } // 枝分かれ
        px = qx; py = qy;
      }
      if (!erupt) { sx.fillStyle = '#ffb347'; sx.fillRect(Math.round(px), Math.round(py), 2, 2); addLight(f.x + c * L, f.y + s * L, 40, '#ff8a3d', 0.8); } // 走る先端
      else if (fade > 0) addLight(f.x + c * f.len / 2, f.y + s * f.len / 2, f.len * 0.8, '#ffb347', fade);
    } else if (f.kind === 'trail') { // 残像の突進の経路: 光の線が残り、残像が走り抜けると消えていく
      const fade = Math.min(1, (f.life - f.t) * 3);
      f.segs.forEach((g, i) => {
        const x0 = g.x0 - cam.x, y0 = g.y0 - cam.y, x1 = g.x1 - cam.x, y1 = g.y1 - cam.y, c = PRISM[(i * 2 + Math.floor(t * 10)) % 7];
        sx.globalAlpha = 0.7 * fade; pLine(sx, x0, y0, x1, y1, c, 1); sx.globalAlpha = 1;
        pLine(gx, x0, y0, x1, y1, fade > 0.5 ? '#5a3a8a' : '#2a1a4a', 1);
      });
    } else if (f.kind === 'spike') { // 晶棘: 地面から結晶の棘が突き出て、砕けて沈む
      const k = u < 0.12 ? u / 0.12 : u > 0.6 ? Math.max(0, 1 - (u - 0.6) / 0.4) : 1, H = Math.round(14 * k), c = PRISM[f.ci], x0 = Math.round(fx), y0 = Math.round(fy);
      for (let j = 0; j < H; j++) { const w = Math.max(1, Math.round((H - j) / H * 3)); sx.fillStyle = j > H - 3 ? '#ffffff' : c; sx.fillRect(x0 - w, y0 - j, w * 2 + 1, 1); if (j > H / 2) { gx.fillStyle = c; gx.fillRect(x0, y0 - j, 1, 1); } }
      for (let i = 0; i < 2; i++) { const sxp = x0 + (i ? 4 : -5), H2 = Math.round(H * 0.6); for (let j = 0; j < H2; j++) { sx.fillStyle = j > H2 - 2 ? '#ffffff' : c; sx.fillRect(sxp, y0 - j, 1, 1); } } // 脇の小さな棘
      sx.fillStyle = '#0c0913'; sx.fillRect(x0 - 5, y0 + 1, 11, 1);
      addLight(f.x, f.y - 6, 40, c, 0.8 * k);
    } else if (f.kind === 'rbeam') { // 反射光線: 鏡で折れる七色の光線(白い芯)。折れる所が白く光る
      const fl = Math.floor(t * 30) % 2, k = 1 - u;
      for (let i = 0; i + 1 < f.pts.length; i++) {
        const A = f.pts[i], B = f.pts[i + 1], x0 = A.x - cam.x, y0 = A.y - cam.y, x1 = B.x - cam.x, y1 = B.y - cam.y, c = PRISM[(i * 2 + Math.floor(t * 10)) % 7];
        pLine(gx, x0, y0, x1, y1, c, Math.max(1, Math.round((2 + fl) * k + 1))); // 光は細く(太いと白く飛んで色が見えない)
        pLine(sx, x0, y0, x1, y1, c, Math.max(1, Math.round(f.w * 0.7 * k + 1)));
        pLine(sx, x0, y0, x1, y1, '#ffffff', 1);
        const L = Math.hypot(B.x - A.x, B.y - A.y);
        for (let r = 20; r < L; r += 50) addLight(A.x + (B.x - A.x) * r / L, A.y + (B.y - A.y) * r / L, 40, c, 0.5 * k);
      }
      for (const p of f.pts.slice(1, -1)) addLight(p.x, p.y, 60, '#ffffff', 0.8 * k);
    } else if (f.kind === 'chain') { // 灼熱の鎖: 飛んでいく鎖 / つながった鎖(イフリートとプレイヤーの間。輪が流れる)
      const tx = f.hold ? P.x - cam.x : fx + Math.cos(f.a) * f.len * Math.min(1, u * 1.6), ty = f.hold ? P.y - cam.y : fy + Math.sin(f.a) * f.len * Math.min(1, u * 1.6);
      const L = Math.hypot(tx - fx, ty - fy), n = Math.floor(L / 4);
      for (let i = 0; i <= n; i++) {
        const k = i / Math.max(1, n), x = Math.round(fx + (tx - fx) * k), y = Math.round(fy + (ty - fy) * k), lit = (i + Math.floor(t * 20)) % 3 === 0;
        sx.fillStyle = lit ? '#ffc34a' : '#a8381a'; sx.fillRect(x - 1, y, 3, 1); sx.fillRect(x, y - 1, 1, 3);
        gx.fillStyle = lit ? '#ff8a3d' : '#3a0e04'; gx.fillRect(x, y, 1, 1);
      }
      addLight((f.x + tx + cam.x) / 2, (f.y + ty + cam.y) / 2, L * 0.6 + 20, '#ff6a2a', 0.6);
    } else if (f.kind === 'ripple') { // 海底が泡立つ(何かが出てくる場所): 広がる波紋と、湧き上がる泡
      for (let j = 0; j < 3; j++) { const k = (u * 2 + j / 3) % 1; pCircle(gx, fx, fy, Math.round(4 + k * 18), k < 0.5 ? '#2a6a7a' : '#163a44'); }
      for (let i = 0; i < 7; i++) { const a = hash2(i, 5) * TAU + t * 2, r = 12 * hash2(i, 9), y = Math.round(fy + Math.sin(a) * r * 0.6 - ((t * 20 + i * 3) % 6)); sx.fillStyle = '#bff4ff'; sx.fillRect(Math.round(fx + Math.cos(a) * r), y, 1, 1); }
    } else if (f.kind === 'tslap') { // 触手の叩きつけ・薙ぎ: 吸盤の並ぶ太い触手が帯の上に現れて沈む
      const k = u < 0.2 ? u / 0.2 : Math.max(0, 1 - (u - 0.2) / 0.8), c = Math.cos(f.a), s = Math.sin(f.a), nx = -s, ny = c, L = f.len, n = 9;
      sx.globalAlpha = k;
      for (let i = 0; i < n; i++) {
        const d0 = L * i / n, d1 = L * (i + 1) / n, w0 = Math.max(1, Math.round(f.w * 0.7 * (1 - i / n * 0.7)));
        const v0 = Math.sin(d0 * 0.07 + f.t * 18) * 2, v1 = Math.sin(d1 * 0.07 + f.t * 18) * 2;
        const x0 = fx + c * d0 + nx * v0, y0 = fy + s * d0 + ny * v0, x1 = fx + c * d1 + nx * v1, y1 = fy + s * d1 + ny * v1;
        pLine(sx, x0, y0, x1, y1, '#3a0e24', w0 + 2);
        pLine(sx, x0, y0, x1, y1, '#8a2a4a', w0);
        if (w0 > 2) pLine(sx, x0 + nx * w0 * 0.25, y0 + ny * w0 * 0.25, x1 + nx * w0 * 0.25, y1 + ny * w0 * 0.25, '#c2486a', 1);
        sx.fillStyle = '#e89aaa'; sx.fillRect(Math.round((x0 + x1) / 2 - nx * w0 * 0.25), Math.round((y0 + y1) / 2 - ny * w0 * 0.25), 1, 1); // 吸盤
      }
      sx.globalAlpha = 1;
    } else if (f.kind === 'grab') { // 絡め取り: クラーケンからプレイヤーへ伸びて巻きつく触手
      const px = P.x - cam.x, py = P.y - cam.y, L = Math.hypot(px - fx, py - fy) || 1, nx = -(py - fy) / L, ny = (px - fx) / L, n = Math.max(4, Math.floor(L / 6));
      let lx = fx, ly = fy;
      for (let i = 1; i <= n; i++) {
        const k = i / n, wv = Math.sin(k * 9 - t * 8) * 3 * Math.sin(k * Math.PI), x = fx + (px - fx) * k + nx * wv, y = fy + (py - fy) * k + ny * wv, w = Math.max(2, Math.round(5 - k * 3));
        pLine(sx, lx, ly, x, y, '#3a0e24', w + 2); pLine(sx, lx, ly, x, y, '#8a2a4a', w);
        if (i % 2) { sx.fillStyle = '#e89aaa'; sx.fillRect(Math.round(x), Math.round(y), 1, 1); }
        lx = x; ly = y;
      }
      for (let i = 0; i < 3; i++) { const yy = Math.round(py - 3 + i * 3), sh = Math.round(Math.sin(t * 6 + i) * 1); sx.fillStyle = '#3a0e24'; sx.fillRect(Math.round(px - 6) + sh, yy - 1, 13, 4); sx.fillStyle = '#8a2a4a'; sx.fillRect(Math.round(px - 5) + sh, yy, 11, 2); sx.fillStyle = '#e89aaa'; sx.fillRect(Math.round(px - 3 + i * 2) + sh, yy, 1, 1); } // 巻きつき
    } else if (f.kind === 'flow') { // 海流: 始まる前は画面いっぱいに点滅する矢印、流れている間は流れの筋
      const c = Math.cos(f.th), s = Math.sin(f.th), VW = GFX.VW, VH = GFX.VH, on = f.t >= 1, fade = Math.min(1, (f.life - f.t) * 2), W = VW + 40, H = VH + 40;
      for (let i = 0; i < 22; i++) {
        const h1 = hash2(i, 41), h2 = hash2(i, 59), sp = (on ? 70 : 25) * (1 + h2);
        const x = ((h1 * W + c * f.t * sp) % W + W) % W - 20, y = ((h2 * H + s * f.t * sp) % H + H) % H - 20;
        if (!on || i % 4 === 0) { // 矢印
          if (!on && Math.floor(t * 6) % 2) continue;
          for (const k of [-1, 1]) { const bx = x - c * 4 + s * 4 * k, by = y - s * 4 - c * 4 * k; sx.globalAlpha = on ? 0.6 * fade : 0.9; pLine(sx, bx, by, x + c * 2, y + s * 2, '#bff4ff'); pLine(gx, bx, by, x + c * 2, y + s * 2, '#2a6a7a'); }
        } else { sx.globalAlpha = 0.45 * fade; pLine(sx, x, y, x - c * 14, y - s * 14, '#bff4ff'); pLine(gx, x, y, x - c * 6, y - s * 6, '#1a4a5a'); }
      }
      sx.globalAlpha = 1;
    } else if (f.kind === 'deathmark') { // 死の宣告: 足元を追う紫の印(回る時計の目盛りと髑髏)。止まると赤く
      const R = 44 * CHAOS.area, stopd = f.t >= 3.5, col = stopd ? '#ff3b5c' : '#c29bff', fade = Math.min(1, f.t * 3, (f.life - f.t) * 4);
      sx.globalAlpha = 0.18 * fade; pDisc(sx, fx, fy, Math.round(R), stopd ? '#ff3b5c' : '#6a3aa0'); sx.globalAlpha = fade;
      pCircle(sx, fx, fy, Math.round(R), col); pCircle(gx, fx, fy, Math.round(R), stopd ? '#5a1020' : '#2a1a4a');
      for (let i = 0; i < 12; i++) { const a = -t * (stopd ? 0 : 1.2) + TAU / 12 * i, r0 = R - 4, r1 = R - (i % 3 ? 7 : 11); pLine(sx, fx + Math.cos(a) * r0, fy + Math.sin(a) * r0, fx + Math.cos(a) * r1, fy + Math.sin(a) * r1, col); } // 目盛り
      const hx = Math.round(fx), hy = Math.round(fy) - 2; // 髑髏
      sx.fillStyle = col; sx.fillRect(hx - 3, hy - 3, 7, 5); sx.fillRect(hx - 2, hy + 2, 5, 2); sx.fillStyle = '#0c0913'; sx.fillRect(hx - 2, hy - 1, 2, 2); sx.fillRect(hx + 1, hy - 1, 2, 2); sx.fillRect(hx - 1, hy + 2, 1, 1); sx.fillRect(hx + 1, hy + 2, 1, 1);
      gx.fillStyle = stopd ? '#5a1020' : '#2a1a4a'; gx.fillRect(hx - 2, hy - 2, 5, 4);
      sx.globalAlpha = 1;
      addLight(f.x, f.y, R * 1.8, col, 0.4 * fade);
    } else if (f.kind === 'pillar') { // 十二の刻印の炸裂: 帯に沿って立つ赤い光の柱
      const k = 1 - u, c = Math.cos(f.a), s = Math.sin(f.a), n = Math.floor(f.len / 6);
      for (let i = 1; i <= n; i++) { const d = i * 6, x = Math.round(fx + c * d), y = Math.round(fy + s * d), H = Math.round((10 + 8 * Math.sin(i + t * 20)) * k); sx.globalAlpha = k; sx.fillStyle = i % 2 ? '#ff3b5c' : '#ffd0d8'; sx.fillRect(x - 1, y - H, 2, H); gx.fillStyle = '#5a1020'; gx.fillRect(x, y - H, 1, H); }
      sx.globalAlpha = 0.5 * k; pLine(sx, fx, fy, fx + c * f.len, fy + s * f.len, '#ff3b5c', Math.round(f.w)); sx.globalAlpha = 1;
      addLight(f.x + c * f.len / 2, f.y + s * f.len / 2, f.len, '#ff3b5c', 0.6 * k);
    } else if (f.kind === 'madwarn') { // 狂い時計の予告: 画面の縁が紫に揺れる
      const VW = GFX.VW, VH = GFX.VH;
      for (let i = 0; i < 4; i++) { const w = Math.round(4 + 4 * Math.abs(Math.sin(t * 30 + i))); sx.globalAlpha = 0.35; sx.fillStyle = '#8a4ae0'; if (i === 0) sx.fillRect(0, 0, VW, w); else if (i === 1) sx.fillRect(0, VH - w, VW, w); else if (i === 2) sx.fillRect(0, 0, w, VH); else sx.fillRect(VW - w, 0, w, VH); }
      sx.globalAlpha = 1;
    } else if (f.kind === 'dance') { // 雪華の輪舞: 円が回る軌道(点線の輪)と、中心の雪の結晶
      const R = DANCE_R, fade = Math.min(1, (f.life - f.t) * 3, f.t * 4), n = 40;
      for (let i = 0; i < n; i++) { if ((i + Math.floor(t * 8)) % 2) continue; const a = TAU / n * i; sx.globalAlpha = 0.6 * fade; sx.fillStyle = '#d8f0ff'; sx.fillRect(Math.round(fx + Math.cos(a) * R), Math.round(fy + Math.sin(a) * R), 1, 1); }
      sx.globalAlpha = fade; drawSp(ART.S.flake, f.x, f.y, { alpha: fade }); sx.globalAlpha = 1;
    } else if (f.kind === 'afterimg') { // 消える残像: 縦に伸びて細くなりながら溶ける
      sx.globalAlpha = Math.max(0, 1 - u); drawSp(ART.S[f.spr], f.x, f.y, { flip: f.flip, sy: 1 + u * 0.5, sxk: Math.max(0.1, 1 - u * 0.8), white: u < 0.15 }); sx.globalAlpha = 1;
    } else if (f.kind === 'spincut') { // 十二の刻印の回転斬り: 大鎌が一回転する三日月の斬撃(白い刃先・赤い軌跡・黒い縁)
      const k = 1 - Math.pow(1 - Math.min(1, u / 0.55), 3), head = f.a0 + f.dir * TAU * k;
      const tail = 2.6 * Math.min(1, k * 3) * (1 - Math.max(0, (u - 0.55) / 0.45)); // 軌跡の長さ(rad): 振り始めに伸び、振り切ったあと縮んで消える
      const n = Math.ceil(tail * f.r);
      for (let i = 0; i <= n; i++) {
        const s = i / Math.max(1, n), a = head - f.dir * tail * s, w = Math.max(1, Math.round((1 - s) * 7)); // 刃先ほど太い
        for (let j = 0; j < w; j++) {
          const rr = f.r - j + 1, x = Math.round(fx + Math.cos(a) * rr), y = Math.round(fy + Math.sin(a) * rr);
          sx.fillStyle = j === 0 && s < 0.5 ? '#000000' : s < 0.1 ? '#ffffff' : s < 0.45 ? '#ff3b5c' : '#8e0016';
          sx.globalAlpha = 1 - s * 0.6; sx.fillRect(x, y, 1, 1);
          if (j > 0 && s < 0.45) { gx.fillStyle = s < 0.1 ? '#ffffff' : '#5a000c'; gx.fillRect(x, y, 1, 1); }
        }
      }
      sx.globalAlpha = 1;
      const hx2 = f.x + Math.cos(head) * f.r, hy2 = f.y + Math.sin(head) * f.r;
      if (u < 0.55) drawRot('rscythe', head + f.dir * Math.PI / 2, hx2, hy2, { scale: 1.6 }); // 刃先の大鎌
      addLight(hx2, hy2, 50, '#ff3b5c', 0.9 * (1 - u)); addLight(f.x, f.y, f.r * 2.5, '#ff3b5c', 0.4 * (1 - u));
    } else if (f.kind === 'skyspear') { // 氷柱の墓標の氷柱: 女王の頭上から空へ飛ぶ(up)/ 空から落ちてくる(down)
      const H = 200, y = f.up ? f.y - 10 - H * u * u : f.y - 18 - H * (1 - u) * (1 - u);
      drawSp(f.up ? ART.S.icespireUp : ART.S.obj_tomb, f.x, y, { alpha: f.up ? Math.max(0, 1 - u * 0.6) : 1 });
      addLight(f.x, y, 50, '#bff4ff', 0.8);
      if (Math.random() < 0.6) part(f.x + rand(-3, 3), y + (f.up ? 12 : -12), 0, f.up ? 30 : -30, 0.3, pick(['#ffffff', '#bff4ff']), { glow: true, drag: 2 }); // 尾を引く冷気
    } else if (f.kind === 'icespike') { // 氷の棘: 地面から突き出て、砕けて沈む
      const k = u < 0.15 ? u / 0.15 : u > 0.6 ? Math.max(0, 1 - (u - 0.6) / 0.4) : 1, H = Math.round(f.h * k), x0 = Math.round(fx), y0 = Math.round(fy);
      for (let j = 0; j < H; j++) { const w = Math.max(1, Math.round((H - j) / Math.max(1, H) * 3)); sx.fillStyle = j > H - 3 ? '#ffffff' : j < 2 ? '#5ab8e8' : '#bff4ff'; sx.fillRect(x0 - (w >> 1), y0 - j, w, 1); if (j > H / 2) { gx.fillStyle = '#2a5a6a'; gx.fillRect(x0, y0 - j, 1, 1); } }
      if (H > 0) { sx.fillStyle = '#2a3448'; sx.fillRect(x0 - 2, y0 + 1, 5, 1); }
    } else if (f.kind === 'windwarn') { // 吹雪の風の予告: 画面いっぱいに風の線(点滅しながら風向きへ流れる)
      const c = Math.cos(f.th), s = Math.sin(f.th), VW = GFX.VW, VH = GFX.VH, W = VW + 60, H = VH + 60, on = Math.floor(t * 8) % 2;
      for (let i = 0; i < 26; i++) {
        const h1 = hash2(i, 71), h2 = hash2(i, 83), sp = 160 * (1 + h2);
        const x = ((h1 * W + c * f.t * sp) % W + W) % W - 30, y = ((h2 * H + s * f.t * sp) % H + H) % H - 30, L = 10 + h1 * 14;
        sx.globalAlpha = on ? 0.8 : 0.45; pLine(sx, x, y, x - c * L, y - s * L, '#ffffff'); pLine(gx, x, y, x - c * L * 0.5, y - s * L * 0.5, '#3a4a5a');
        if (i % 5 === 0) for (const k of [-1, 1]) pLine(sx, x + c * 3, y + s * 3, x - c * 2 + s * 4 * k, y - s * 2 - c * 4 * k, '#ff3b5c'); // 風向きの矢印(赤)
      }
      sx.globalAlpha = 1;
    } else if (f.kind === 'veilwarn') { // 吹雪の帳の予告: 画面の縁が白く凍りはじめる
      const VW = GFX.VW, VH = GFX.VH, bw = Math.round(6 + 10 * u), on = Math.floor(t * 8) % 2;
      sx.globalAlpha = (on ? 0.55 : 0.35); sx.fillStyle = '#e8f4ff';
      sx.fillRect(0, 0, VW, bw); sx.fillRect(0, VH - bw, VW, bw); sx.fillRect(0, bw, bw, VH - bw * 2); sx.fillRect(VW - bw, bw, bw, VH - bw * 2);
      sx.globalAlpha = 1; sx.fillStyle = on ? '#ff3b5c' : '#ffd0d8';
      sx.fillRect(bw, bw, VW - bw * 2, 1); sx.fillRect(bw, VH - bw - 1, VW - bw * 2, 1); sx.fillRect(bw, bw, 1, VH - bw * 2); sx.fillRect(VW - bw - 1, bw, 1, VH - bw * 2);
    } else if (f.kind === 'wavewarn') { // 大津波の予告: 波の来る側の端に赤い帯、画面を横切って流れる矢印の列
      const blink = Math.floor(t * 8) % 2;
      sx.save(); gx.save(); sx.translate(fx, fy); gx.translate(fx, fy); sx.rotate(f.th); gx.rotate(f.th);
      sx.globalAlpha = 0.22 + 0.12 * blink; sx.fillStyle = '#ff3b5c'; sx.fillRect(0, -f.span, 46, f.span * 2); // 端(画面の外 20)から画面の内側 26 まで
      sx.globalAlpha = 1; sx.fillStyle = blink ? '#ff3b5c' : '#ffd0d8'; sx.fillRect(46, -f.span, 1, f.span * 2);
      gx.fillStyle = '#7a1020'; gx.fillRect(46, -f.span, 1, f.span * 2);
      for (let row = -f.span + 40; row < f.span; row += 70) for (let k = 0; k < 4; k++) {
        const al = (t * 170 + k * f.len / 4 + row * 0.7) % f.len;
        for (let j = 0; j < 6; j++) { sx.fillStyle = '#ff3b5c'; sx.fillRect(al - j, row - j, 2, 1); sx.fillRect(al - j, row + j, 2, 1); gx.fillStyle = '#5a1020'; gx.fillRect(al - j, row - j, 1, 1); gx.fillRect(al - j, row + j, 1, 1); }
      }
      sx.restore(); gx.restore(); sx.globalAlpha = 1;
    }
  }
}

// 環境パーティクル(ホタル・火の粉)。カメラに対して視差を付けて漂わせる
function drawMotes(st) {
  const gx = GFX.gctx, VW = GFX.VW, VH = GFX.VH, t = GFX.fx.time, m = st.motes;
  if (m.snow) { // 霊峰: 揺れながら降る雪(手前の大きな粒ほど速い)
    const sx = GFX.sctx;
    for (let i = 0; i < 48; i++) {
      const near = i % 4 === 0, sp = near ? 26 : 12 + hash2(i, 5) * 8;
      const wx = ((hash2(i, 7) * 1000 + Math.sin(t * 0.8 + i) * 6 - cam.x * (near ? 1.1 : 0.9)) % (VW + 20) + VW + 20) % (VW + 20) - 10;
      const wy = ((hash2(i, 13) * 1000 + t * sp - cam.y * (near ? 1.1 : 0.9)) % (VH + 20) + VH + 20) % (VH + 20) - 10;
      sx.fillStyle = '#ffffff'; sx.fillRect(Math.round(wx), Math.round(wy), near ? 2 : 1, near ? 2 : 1);
      gx.fillStyle = near ? '#5a6a7a' : '#3a4450'; gx.fillRect(Math.round(wx), Math.round(wy), 1, 1);
    }
    return;
  }
  for (let i = 0; i < 26; i++) {
    const seedx = hash2(i, 7) * 1000, seedy = hash2(i, 13) * 1000;
    const wx = ((seedx + t * (m.rise ? 4 : 6) * (hash2(i, 3) - 0.5) * 2 - cam.x * 0.9) % (VW + 20) + VW + 20) % (VW + 20) - 10;
    const wy = ((seedy + (m.rise ? -t * 14 : Math.sin(t + i) * 8) - cam.y * 0.9) % (VH + 20) + VH + 20) % (VH + 20) - 10;
    gx.globalAlpha = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + i * 1.7));
    const col = m.cols ? m.cols[i % m.cols.length] : m.col; // 晶窟は色とりどりのきらめき
    if (m.bubble && i % 2 === 0) { // 海淵: 揺れながら昇る泡(小さな輪)
      const bx = Math.round(wx + Math.sin(t * 2.2 + i) * 2), by = Math.round(wy), big = i % 4 === 0;
      gx.globalAlpha = 1; gx.fillStyle = '#4a8a9a';
      if (big) { gx.fillRect(bx - 1, by - 2, 3, 1); gx.fillRect(bx - 1, by + 2, 3, 1); gx.fillRect(bx - 2, by - 1, 1, 3); gx.fillRect(bx + 2, by - 1, 1, 3); gx.fillStyle = '#bff4ff'; gx.fillRect(bx - 1, by - 1, 1, 1); }
      else { gx.fillRect(bx - 1, by, 1, 1); gx.fillRect(bx + 1, by, 1, 1); gx.fillRect(bx, by - 1, 1, 1); gx.fillRect(bx, by + 1, 1, 1); }
      continue;
    }
    gx.fillStyle = col; gx.fillRect(Math.round(wx), Math.round(wy), 1, 1);
    if (i % 3 === 0) addLight(wx + cam.x, wy + cam.y, 14, col, 0.5);
  }
  gx.globalAlpha = 1;
  if (m.bubble) for (let i = 0; i < 4; i++) { // 海面から差しこむ光のゆらぎ(ゆっくり動く大きな淡い光)
    const lx = cam.x + VW * (0.5 + 0.45 * Math.sin(t * 0.13 + i * 1.9)), ly = cam.y + VH * (0.5 + 0.4 * Math.sin(t * 0.09 + i * 2.7));
    addLight(lx, ly, 120 + 30 * Math.sin(t * 0.7 + i), '#5ab8d8', 0.22 + 0.08 * Math.sin(t * 1.3 + i * 2));
  }
}

// アローレインの色(ふつう / 炎の矢)。光の層は色で明るさが決まるので、軌跡は暗い色を順に(先端に近いほど明るい)
const RAIN_PAL = {
  base: { ring: '#b8ff9a', tick: '#e4ffd8', head: '#ffffff', body: '#d8f0c8', fletch: '#5ad07a', shaft: '#b8a880', trail: ['#3a6a3a', '#284a28', '#183018'], light: '#b8ff9a', shade: '#0c1a10' },
  fire: { ring: '#ffb070', tick: '#ffe0b0', head: '#fff6c8', body: '#ffc34a', fletch: '#ff6a2a', shaft: '#6a4a30', trail: ['#7a3a10', '#4a220a', '#2a1206'], light: '#ff8a3d', shade: '#1a0c06' },
};
// アローレイン: 照準の輪(外から縮んで定まる・回る目盛り)→ 空から斜めに降る矢(光の軌跡・地面の小さな影)→ 刺さった矢が残る
//   攻撃 1回ごとに縁から内へ波紋。終わった後(linger)は刺さった矢だけ残って消える
function drawArrowRain(z, zx, zy, t) {
  const sx = GFX.sctx, gx = GFX.gctx, C = z.fire ? RAIN_PAL.fire : RAIN_PAL.base, R = Math.round(z.r);
  const fade = Math.max(0, Math.min(1, (z.dur - z.t) * 4, z.t * 6)), lock = Math.min(1, z.t / z.delay);
  if (fade > 0) {
    sx.globalAlpha = 0.24 * fade * lock; pDisc(sx, zx, zy, R, C.shade); // 影の円
    const rr = Math.round(R * (1 + 0.5 * (1 - easeOutCubic(lock)))); // 照準の輪: 外から縮んで定まる
    sx.globalAlpha = (0.35 + 0.35 * lock) * fade; pCircle(sx, zx, zy, rr, C.ring, 1);
    for (let i = 0; i < 4; i++) { // 目盛り: 輪の上の 4本の短い線(ゆっくり回る)
      const a = t * 0.9 + i * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      pLine(sx, zx + ca * (rr - 4), zy + sa * (rr - 4), zx + ca * (rr + 3), zy + sa * (rr + 3), C.tick, 1);
    }
    if (lock < 1) { gx.fillStyle = C.trail[1]; for (let i = 0; i < 4; i++) { const a = t * 0.9 + i * Math.PI / 2; gx.fillRect(Math.round(zx + Math.cos(a) * rr), Math.round(zy + Math.sin(a) * rr), 1, 1); } }
    const pu = z.pulseT === undefined ? 1 : (z.t - z.pulseT) / 0.22; // 攻撃ごとの波紋(縁から内へ)
    if (pu < 1) { sx.globalAlpha = 0.45 * (1 - pu) * fade; pCircle(sx, zx, zy, Math.round(R * (1 - 0.3 * pu)), C.tick, 1); }
    sx.globalAlpha = 1;
    addLight(z.x, z.y, z.r * 2, C.light, (0.3 + 0.2 * Math.max(0, 1 - pu)) * fade * lock);
  }
  const sl = z.slant || 0, len = Math.hypot(sl, 1), dx = sl / len, dy = 1 / len; // 矢の進む向き(斜め下)
  for (const ar of z.arrows) {
    if (ar.t < 0) continue;
    const ax = Math.round(ar.x - cam.x), ay = Math.round(ar.y - cam.y);
    if (ar.t < RAIN_FALL) { // 落ちてくる矢: 先端(白)・矢柄・矢羽。後ろに光の軌跡。地面の小さな影が濃くなる
      const u = ar.t / RAIN_FALL, H = RAIN_H * (1 - u), hx = ax - sl * H, hy = ay - H;
      for (let i = 2; i < 18; i++) { gx.fillStyle = C.trail[Math.min(2, (i - 2) / 5 | 0)]; gx.fillRect(Math.round(hx - dx * i), Math.round(hy - dy * i), 1, 1); }
      for (let i = 0; i < 8; i++) { sx.fillStyle = i === 0 ? C.head : i < 6 ? C.body : C.fletch; sx.fillRect(Math.round(hx - dx * i), Math.round(hy - dy * i), 1, 1); }
      sx.fillStyle = C.fletch; sx.fillRect(Math.round(hx - dx * 7 - 1), Math.round(hy - dy * 7), 1, 1); sx.fillRect(Math.round(hx - dx * 7 + 1), Math.round(hy - dy * 7), 1, 1); // 矢羽の広がり
      sx.globalAlpha = 0.55 * u; sx.fillStyle = '#060c06'; sx.fillRect(ax - 1, ay, 3, 1); sx.globalAlpha = 1;
      continue;
    }
    const s = ar.t - RAIN_FALL, k = s / RAIN_STUCK; // 刺さった矢: 斜めに地面へ刺さり、だんだん薄れる(炎の矢は矢羽の火が揺れる)
    sx.globalAlpha = 1 - k * k;
    for (let i = 0; i < 5; i++) { sx.fillStyle = i === 0 ? '#2a2418' : C.shaft; sx.fillRect(Math.round(ax - dx * i), Math.round(ay - dy * i), 1, 1); }
    const fx = Math.round(ax - dx * 5), fy = Math.round(ay - dy * 5), fl = z.fire && Math.floor(t * 12 + ar.x) % 2;
    sx.fillStyle = fl ? '#ffc34a' : C.fletch; sx.fillRect(fx - 1, fy, 1, 1); sx.fillRect(fx + 1, fy, 1, 1); sx.fillRect(fx, fy - 1, 1, 1);
    sx.globalAlpha = 1;
    if (z.fire && k < 0.7) { gx.fillStyle = fl ? '#5a2a08' : '#3a1606'; gx.fillRect(fx, fy - 1, 1, 2); }
    if (s < 0.05) { gx.fillStyle = C.trail[0]; gx.fillRect(ax - 1, ay - 1, 3, 2); } // 刺さった瞬間の光
  }
}
// ディメンション・リフト: 画面全体が暗い星空(異次元)に沈み、画面の端から暗いひびが走る(画面の座標)
//   白く飛ぶと画面全体が見えなくなるので、明るくせず暗く沈める。画質が低いときは、ひびと背景の切り替えだけ
function drawRift(t) {
  const r = P.rift;
  if (!r || P.dead) return; // 倒れたら消す(倒れると時間が止まり、そのまま残るため)
  const sx = GFX.sctx, gx = GFX.gctx, VW = GFX.VW, VH = GFX.VH, pulse = r.pulse || 0;
  const open = Math.min(1, r.t / 0.3), close = clamp((r.dur - r.t) / 0.3, 0, 1), k = Math.min(open, close);
  sx.globalAlpha = (0.42 + 0.1 * pulse) * k; sx.fillStyle = '#0a0418'; sx.fillRect(0, 0, VW, VH);
  if (gq().parts > 0.5) for (let i = 0; i < 80; i++) { // 星(画面に貼りついた点がゆっくり流れて瞬く)
    const h = Math.sin(i * 127.1) * 43758.5453, u = h - Math.floor(h), h2 = Math.sin(i * 311.7) * 24634.6345, v = h2 - Math.floor(h2);
    const x = Math.floor((u * VW + t * (3 + (i % 5))) % VW), y = Math.floor(v * VH);
    sx.globalAlpha = k * (0.3 + 0.5 * Math.abs(Math.sin(t * 2 + i))); sx.fillStyle = i % 9 === 0 ? '#ff7ad9' : i % 3 === 0 ? '#9a7ad8' : '#5a5a98';
    sx.fillRect(x, y, 1, 1);
  }
  for (const c of r.cracks) { // ひび: 開くときに伸び、閉じるときに縮む(芯は黒、縁だけ暗い桃色にかすかに光る)
    const n = Math.max(1, Math.round((c.length - 1) * k));
    for (let i = 0; i < n; i++) {
      const [x0, y0] = c[i], [x1, y1] = c[i + 1];
      sx.globalAlpha = 0.9 * k; pLine(sx, x0, y0, x1, y1, '#030108', 2);
      gx.globalAlpha = (0.3 + 0.35 * pulse) * k * (1 - i / c.length); pLine(gx, x0, y0, x1, y1, '#8a2a6e', 1);
    }
  }
  sx.globalAlpha = gx.globalAlpha = 1;
}
// 重力崩壊の特異点: 本物のブラックホールのように描く。周りの景色は重力レンズで引き伸ばされ、渦を巻く(GFX.lenses。画質「高」だけ)
//   ブラックホール自体は前景(GFX.octx)へ描くので、自分が起こす空間の歪みでは歪まない。引き寄せの範囲の縁がうっすら縮む
//   最後の一瞬(shrinkT 秒)で縮みながら白くなり、そのあと崩壊の閃光・衝撃波(classes.js の astCrush)
function drawSings(t) {
  if (!P.sings || !P.sings.length || P.dead) return;
  const sx = GFX.sctx, gx = GFX.gctx, q = DATA.classes.astro.q, shrinkT = 0.15;
  for (const s of P.sings) {
    if (s.t >= q.dur) continue; // 崩壊した後はリング・閃光だけ
    const u = s.t / q.dur, x = s.x - cam.x, y = s.y - cam.y;
    const wht = clamp(1 - (q.dur - s.t) / shrinkT, 0, 1); // 縮む瞬間の白さ
    const rsMax = clamp(4 + s.pullR / 40, 6, 13); // 影の大きさは引き寄せの範囲(使った質量・範囲)で大きくなる
    const rs = Math.max(0.6, rsMax * easeOutCubic(Math.min(1, s.t / 0.5)) * (1 + 0.04 * Math.sin(t * 10)) * (1 - 0.9 * wht * wht));
    gx.globalAlpha = 0.22; pCircle(gx, x, y, Math.round(s.pullR * (1 - ((t * 0.8) % 1) * 0.6)), '#8a2a6e', 3); // 引き寄せの範囲
    sx.globalAlpha = 0.3; pCircle(sx, x, y, Math.round(s.pullR), '#8a2a6e', 4);
    gx.globalAlpha = 0.25 * (1 - wht); pCircle(gx, x, y, Math.round(rs + 1), '#ffb38a'); // 影の縁のかすかな光(レンズで外へ引き伸ばされて光の輪になる)
    sx.globalAlpha = gx.globalAlpha = 1;
    drawBlackHole(x, y, rs, t, wht, SET.fxA);
    GFX.lenses.push({ x, y, e: rs * 0.75, rs, R: Math.max(70, s.pullR * 0.6), swirl: 2.2 * (0.2 + 0.8 * u), a: Math.min(1, s.t / 0.35) * (1 - wht) });
    addLight(s.x, s.y, rs * 9, '#ffb38a', 0.25 + 0.2 * u); // 降着円盤が周りを暖かく照らす(敵が集まって重なるので控えめ)
  }
}
// 降着円盤の色(内側ほど熱い: 白 → 金 → 珊瑚 → 桃 → 暗い紫)
const BH_PAL = [[0, [255, 246, 232]], [0.2, [255, 204, 140]], [0.45, [255, 140, 104]], [0.72, [226, 82, 146]], [1, [96, 24, 84]]];
function bhCol(u) {
  u = clamp(u, 0, 1);
  for (let i = 1; i < BH_PAL.length; i++) {
    const [u1, c1] = BH_PAL[i];
    if (u > u1) continue;
    const [u0, c0] = BH_PAL[i - 1], k = (u - u0) / (u1 - u0);
    return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
  }
  return BH_PAL[BH_PAL.length - 1][1];
}
const BH_CV = document.createElement('canvas'), BH_CX = BH_CV.getContext('2d');
// ブラックホール 1つを 1ドットずつ計算して前景へ描く(cx, cy: 画面の座標 / rs: 影の半径 / wht: 白さ 0..1 / alpha: 全体の濃さ)
//   奥から: 周りを暗く沈める(光が呑まれる)→ 傾いた降着円盤の奥側 → 奥側が重力で曲がって影の上下に回り込んで見える弧(上は太く、下は細い)
//   → 光子リング → 影(事象の地平)→ 円盤の手前側。円盤は近づく側(左)が明るく、筋が内側ほど速く回る
function drawBlackHole(cx, cy, rs, t, wht, alpha) {
  const tilt = 0.3, rin = rs * 1.45, rout = rs * 3.1, halo = rs * 3.2, W = Math.ceil(Math.max(rout, halo)) + 1, H = Math.ceil(halo) + 1, w = W * 2 + 1, h = H * 2 + 1;
  if (BH_CV.width < w || BH_CV.height < h) { BH_CV.width = Math.max(BH_CV.width, w); BH_CV.height = Math.max(BH_CV.height, h); }
  const img = BH_CX.createImageData(w, h), D = img.data;
  const white = c => [c[0] + (255 - c[0]) * wht, c[1] + (255 - c[1]) * wht, c[2] + (255 - c[2]) * wht];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = i - W, dy = j - H, r = Math.hypot(dx, dy), pz = dy / tilt, rho = Math.hypot(dx, pz);
    let R = 0, G = 0, B = 0, A = 0;
    const put = (c, a) => { // 奥から手前へ重ねる
      if (a <= 0) return;
      const na = a + A * (1 - a);
      R = (c[0] * a + R * A * (1 - a)) / na; G = (c[1] * a + G * A * (1 - a)) / na; B = (c[2] * a + B * A * (1 - a)) / na; A = na;
    };
    const inDisk = rho >= rin && rho <= rout;
    const disk = () => {
      const phi = Math.atan2(pz, dx), u = (rho - rin) / (rout - rin), c = bhCol(u);
      const k = (1 - 0.5 * Math.cos(phi)) * (0.7 + 0.3 * Math.sin(phi * 4 - t * 9 * rin / rho + rho * 0.7)); // 近づく側が明るい × 回る筋
      put(white([Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)]), Math.min(1, 1.7 * (1 - u)) * 0.95);
    };
    if (r >= rs && r < halo) { const f = 1 - (r - rs) / (halo - rs); put([6, 2, 12], 0.62 * f * f); }   // 0) 周りを暗く沈める
    if (inDisk && dy < 0 && r >= rs) disk();                                                          // 1) 円盤の奥側
    if (r >= rs && r < rs + (dy < 0 ? Math.max(1.2, 3.2 - 2 * Math.abs(dx) / (rs + 3)) : 1.4)) {        // 2) 回り込んで見える弧
      const c = bhCol(dy < 0 ? 0.06 : 0.25), k = 1 - 0.45 * dx / (rs + 3);
      put(white([Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)]), dy < 0 ? 0.9 : 0.55);
    }
    if (Math.abs(r - rs - 0.4) < 0.75) put(white([255, 236, 246]), 0.85);                              // 3) 光子リング
    if (r < rs) put([0, 0, 0], 1);                                                                    // 4) 影
    if (inDisk && dy >= 0) disk();                                                                    // 5) 円盤の手前側
    const o = (j * w + i) * 4;
    D[o] = R; D[o + 1] = G; D[o + 2] = B; D[o + 3] = Math.round(A * alpha * 255);
  }
  BH_CX.clearRect(0, 0, BH_CV.width, BH_CV.height);
  BH_CX.putImageData(img, 0, 0);
  GFX.octx.drawImage(BH_CV, 0, 0, w, h, Math.round(cx) - W, Math.round(cy) - H, w, h);
  GFX.overOn = true;
}
// アストロマンサーの重力圏: 縁にごく薄い桃色の点線が回る(時の歪みが強いほど少し濃い)
function drawAstroField(t) {
  if (P.cls !== 'astro' || P.dead || !P.astR) return;
  const sx = GFX.sctx, gx = GFX.gctx, cx = P.x - cam.x, cy = P.y - cam.y, R = P.astR, n = Math.max(12, Math.round(R * TAU / 3)), k = 0.35 + 0.65 * Math.min(1, (P.astK || 0) / 0.3);
  sx.fillStyle = gx.fillStyle = '#ff7ad9';
  for (let i = 0; i < n; i += 2) {
    const a = t * 0.5 + i * TAU / n, x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R);
    sx.globalAlpha = 0.3 * k; sx.fillRect(x, y, 1, 1);
    gx.globalAlpha = 0.15 * k; gx.fillRect(x, y, 1, 1);
  }
  sx.globalAlpha = gx.globalAlpha = 1;
}
// アストロマンサーの体まわり。front = false: 足元の暗い輪(質量が増えるほど濃い。上限で脈打つ)と奥側の星 / true: 回る暗い塵と手前側の星
function drawAstroBody(t, front) {
  if (P.cls !== 'astro' || P.dead) return;
  const sx = GFX.sctx, gx = GFX.gctx, cx = P.x - cam.x, cy = P.y - cam.y, max = astMax(), f = Math.min(1, (P.mass || 0) / max), full = P.mass >= max;
  if (!front && f > 0.02) {
    const pulse = full ? 0.5 + 0.5 * Math.sin(t * 8) : 0, R = 9 + Math.round(2 * pulse);
    sx.globalAlpha = 0.2 + 0.45 * f; pCircle(sx, cx, cy + 7, R, '#2a0a28'); pCircle(sx, cx, cy + 7, R + 1, '#14041a');
    if (full) { gx.globalAlpha = 0.3 * pulse; pCircle(gx, cx, cy + 7, R, '#8a2a6e'); }
    sx.globalAlpha = gx.globalAlpha = 1;
  }
  if (front) { // 質量 10 ごとに 1粒(最大 20)
    const n = Math.min(20, Math.floor((P.mass || 0) / 10));
    for (let i = 0; i < n; i++) {
      const a = t * (1.2 + (i % 3) * 0.3) + i * 2.399, rr = 9 + (i % 4) * 2;
      sx.fillStyle = i % 4 === 0 ? '#8a2a6e' : '#2a1030'; sx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy - 2 + Math.sin(a) * rr * 0.45), 1, 1);
    }
  }
  for (let i = 0; i < 3; i++) { // 肩のまわりを公転する 3つの星(奥側は体の後ろに隠れる)
    const a = t * 1.6 + i * TAU / 3;
    if ((Math.sin(a) >= 0) !== front) continue;
    const x = Math.round(cx + Math.cos(a) * 9), y = Math.round(cy - 9 + Math.sin(a) * 3);
    sx.fillStyle = i === 0 ? '#ffd8f2' : '#ff7ad9'; sx.fillRect(x, y, 1, 1);
    gx.globalAlpha = 0.6; gx.fillStyle = '#ff7ad9'; gx.fillRect(x, y, 1, 1); gx.globalAlpha = 1;
  }
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
  for (const arr of [rings, slashes, bolts, warns, flashes, bfx]) for (let i = arr.length - 1; i >= 0; i--) {
    const o = arr[i], gone = arr === warns && o.owner && o.owner.dead; // 予兆は出した敵が倒れたら消す
    o.t += dt;
    if (o.t < o.life && !gone) continue;
    if (arr === warns && !gone && !o.snap) warns.push({ kind: o.kind, x: o.x, y: o.y, a: o.a, r: o.r, r0: o.r0, h: o.h, len: o.len, w: o.w, ink: o.ink, sever: o.sever, snap: true, t: 0, life: 0.12 }); // 当たる瞬間: 同じ形が一瞬光る
    arr.splice(i, 1);
  }
  // 斬撃のイベント(鬼神・村正の一閃など): 決まった時刻に一度だけ。処理中に slashes が増えてもいいように、集めてから実行する
  const due = [];
  for (const s of slashes) if (s.ev) for (const ev of s.ev) if (!ev.done && s.t >= ev.at) { ev.done = true; due.push([ev.fn, !s.enemy]); }
  for (const [fn, mine] of due) if (mine) asMine(fn); else fn(); // 自分の斬撃のイベントの演出は「攻撃の濃さ」の対象
  for (const w of warns) if (w.track) w.track(w); // 追随する予兆(発生源・向きを毎フレーム更新)
  for (const f of bfx) if (f.track) f.track(f, dt); // ボスの技の演出(動く影など)
  updSkillFx(dt); // スキルの演出(skillfx.js)
}
