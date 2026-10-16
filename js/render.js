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
// 天光の聖堂の床: 象牙色の大理石の石畳(目地は暗い金。淡い灰の筋)。6枚ごとに金の象嵌の帯(交わる所に金の菱形)。
//   ところどころ: 太陽の円紋(金の象嵌)・ステンドグラス越しの淡い色の光(赤・緑・青・金の四つ葉。ボス1 の色の光と見まちがえないように淡く、動かさない)・
//   落ちた羽根・折れた白い柱の根元・金の燭台(蝋燭の灯は lights)・小さなひび
function buildHolyChunk(cx, cy, st) {
  const c = ART.canvas(CH, CH), x = c.getContext('2d'), g = ART.canvas(CH, CH), gx = g.getContext('2d'), lights = [];
  const [g0, g1, g2, g3] = st.ground, [mortar, hi, gold, goldHi] = st.deco, T = 16, P6 = T * 6;
  const ox = cx * CH, oy = cy * CH;
  x.fillStyle = mortar; x.fillRect(0, 0, CH, CH);
  for (let ty = 0; ty < CH; ty += T) for (let tx = 0; tx < CH; tx += T) {
    const h = hash2(ox + tx, oy + ty);
    x.fillStyle = h < 0.3 ? g1 : h < 0.55 ? g2 : h < 0.7 ? g3 : g0; x.fillRect(tx + 1, ty + 1, T - 1, T - 1); // 大理石(目地は暗い金)
    if (h > 0.55) { x.globalAlpha = 0.35; x.fillStyle = '#8a8270'; let vx = tx + 2 + ((h * 37) | 0) % 6, vy = ty + 2; for (let k = 0; k < 11; k++) { x.fillRect(vx, vy, 1, 1); vx = clamp(vx + (hash2(vx + ox, k + oy) < 0.55 ? 1 : 0), tx + 1, tx + T - 2); vy = Math.min(ty + T - 2, vy + 1); } x.globalAlpha = 1; } // 大理石の筋
    x.globalAlpha = 0.4; x.fillStyle = hi; x.fillRect(tx + 1, ty + 1, T - 2, 1); x.fillRect(tx + 1, ty + 1, 1, T - 2); x.globalAlpha = 1; // 上と左の縁の照り
  }
  // 金の象嵌の帯(世界の 6枚ごとの目地。交わる所に金の菱形)
  for (let k = 0; k < CH; k += T) {
    if (((ox + k) / T) % 6 === 0) { x.fillStyle = gold; x.fillRect(k, 0, 1, CH); x.fillStyle = goldHi; for (let y = 2; y < CH; y += 8) x.fillRect(k, y, 1, 1); }
    if (((oy + k) / T) % 6 === 0) { x.fillStyle = gold; x.fillRect(0, k, CH, 1); x.fillStyle = goldHi; for (let xx = 2; xx < CH; xx += 8) x.fillRect(xx, k, 1, 1); }
  }
  for (let ky = 0; ky < CH; ky += T) for (let kx = 0; kx < CH; kx += T) if (((ox + kx) / T) % 6 === 0 && ((oy + ky) / T) % 6 === 0) { x.fillStyle = gold; x.fillRect(kx - 2, ky, 5, 1); x.fillRect(kx, ky - 2, 1, 5); x.fillRect(kx - 1, ky - 1, 3, 3); x.fillStyle = goldHi; x.fillRect(kx, ky, 1, 1); }
  for (let i = 0; i < 9; i++) {
    const hx = 8 + ((hash2(cx * 97 + i, cy * 57) * (CH - 24)) | 0), hy = 8 + ((hash2(cy * 89 + i, cx * 43 + i) * (CH - 24)) | 0), kind = hash2(hx + ox, hy + oy);
    if (kind < 0.16) { // 太陽の円紋: 金の輪と 8本の光(中心は白金)
      const R = 5 + ((kind * 60) | 0) % 4, ccx = hx + 6, ccy = hy + 6;
      x.fillStyle = gold; for (let a = 0; a < TAU; a += 0.09) x.fillRect(Math.round(ccx + Math.cos(a) * R), Math.round(ccy + Math.sin(a) * R), 1, 1);
      for (let k = 0; k < 8; k++) { const a = TAU / 8 * k; for (let d = R + 1; d <= R + 3; d++) x.fillRect(Math.round(ccx + Math.cos(a) * d), Math.round(ccy + Math.sin(a) * d), 1, 1); }
      x.fillStyle = goldHi; x.fillRect(ccx - 1, ccy - 1, 3, 3); x.fillStyle = '#ffffff'; x.fillRect(ccx, ccy, 1, 1);
      gx.fillStyle = '#2a2008'; gx.fillRect(ccx - 1, ccy - 1, 3, 3);
    } else if (kind < 0.32) { // ステンドグラス越しの淡い色の光(四つ葉。赤・緑・青・金)
      const cols = ['#e84860', '#58d878', '#4878e8', '#ffd23f'], o0 = ((kind * 97) | 0) % 4;
      x.globalAlpha = 0.16;
      for (let k = 0; k < 4; k++) { const a = TAU / 4 * k + 0.785, px = hx + 6 + Math.round(Math.cos(a) * 4), py = hy + 6 + Math.round(Math.sin(a) * 4); x.fillStyle = cols[(k + o0) % 4]; x.fillRect(px - 2, py - 2, 5, 5); x.fillRect(px - 3, py - 1, 7, 3); x.fillRect(px - 1, py - 3, 3, 7); }
      x.globalAlpha = 0.22; x.fillStyle = '#fff6e0'; x.fillRect(hx + 5, hy + 5, 3, 3); x.globalAlpha = 1;
    } else if (kind < 0.46) { // 落ちた羽根
      const fl = kind * 100 % 2 < 1 ? 1 : -1;
      x.fillStyle = '#8a8270'; for (let k = 0; k < 7; k++) x.fillRect(hx + k, hy + 3 + Math.round(fl * k * 0.3), 1, 1); // 羽軸
      x.fillStyle = '#f8f4ea'; for (let k = 1; k < 7; k++) { x.fillRect(hx + k, hy + 1 + Math.round(fl * k * 0.3), 1, 2); if (k > 1 && k < 6) x.fillRect(hx + k, hy + 4 + Math.round(fl * k * 0.3), 1, 1); }
    } else if (kind < 0.58) { // 折れた白い柱の根元(溝彫りの円と、落ちたかけら)
      const R = 6, ccx = hx + 7, ccy = hy + 7;
      x.fillStyle = '#5a5444'; for (let a = 0; a < TAU; a += 0.1) x.fillRect(Math.round(ccx + Math.cos(a) * (R + 1)), Math.round(ccy + Math.sin(a) * (R + 1) * 0.6 + 1), 1, 1); // 影
      x.fillStyle = '#e8e2d2'; for (let dy = -3; dy <= 3; dy++) { const w = Math.round(Math.sqrt(R * R - (dy / 0.6) * (dy / 0.6) || 0)); x.fillRect(ccx - w, ccy + dy, w * 2 + 1, 1); }
      x.fillStyle = '#b8b2a2'; for (let k = -R + 2; k < R; k += 3) x.fillRect(ccx + k, ccy - 1, 1, 3); // 溝彫り
      x.fillStyle = '#fffaf0'; x.fillRect(ccx - R + 1, ccy - 3, R * 2 - 2, 1);
      x.fillStyle = '#d8d2c2'; x.fillRect(ccx + R + 3, ccy + 2, 3, 2); x.fillRect(ccx - R - 5, ccy + 3, 2, 2); // かけら
    } else if (kind < 0.7) { // 金の燭台(3本の蝋燭。炎は光の層と光源)
      x.fillStyle = '#5a4424'; x.fillRect(hx + 1, hy + 11, 9, 1);
      x.fillStyle = gold; x.fillRect(hx + 5, hy + 5, 1, 6); x.fillRect(hx + 1, hy + 5, 9, 1); x.fillRect(hx + 3, hy + 10, 5, 1);
      for (const bx of [hx + 1, hx + 5, hx + 9]) {
        x.fillStyle = '#fffaf0'; x.fillRect(bx, hy + 2, 1, 3); x.fillStyle = '#ffd27a'; x.fillRect(bx, hy, 1, 2); x.fillStyle = '#ffffff'; x.fillRect(bx, hy + 1, 1, 1);
        gx.fillStyle = '#a8681e'; gx.fillRect(bx, hy, 1, 2);
      }
      lights.push({ x: hx + 5, y: hy + 1, s: kind * 50 });
    } else if (kind < 0.8) { // 小さなひび
      let lx = hx, ly = hy; x.fillStyle = '#7a7262';
      for (let k = 0; k < 8; k++) { x.fillRect(lx, ly, 1, 1); lx = clamp(lx + 1, 0, CH - 1); ly = clamp(ly + (hash2(lx + ox, k) < 0.5 ? 1 : -1), 0, CH - 1); }
    }
  }
  return { c, g, lights };
}
function buildChunk(cx, cy, st) {
  if (st.tiles) return buildTileChunk(cx, cy, st);
  if (st.holy) return buildHolyChunk(cx, cy, st);
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
    if (st.forest) { forestDeco(x, gx, hx, hy, kind, hash2(hx * 3 + ox, hy * 5 + oy), st.deco); continue; }
    if (st.desert) { desertDeco(x, hx, hy, kind, hash2(hx * 3 + ox, hy * 5 + oy), st.deco); continue; }
    if (st.thunder) { thunderDeco(x, gx, hx, hy, kind, hash2(hx * 3 + ox, hy * 5 + oy), st.deco); continue; }
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
// 森の地面の装飾: シダ / 落ち葉 / キノコ(ほのかに光るものも)/ 木の根 / 倒木 / 苔むした石 / 小さな白い花 / 大きな木の根元
function forestDeco(x, gx, hx, hy, kind, h2, [d0, d1, d2c, d3]) {
  if (kind < 0.24) { // シダ: 根元から左右へ広がる葉
    for (const [dx, dy, w] of [[3, 0, 1], [2, 1, 1], [4, 1, 1], [1, 2, 2], [4, 2, 2], [0, 3, 2], [5, 3, 2], [3, 3, 1], [3, 4, 1]]) { x.fillStyle = dy < 2 ? d1 : d0; x.fillRect(hx + dx, hy + dy, w, 1); }
    x.fillStyle = '#10200e'; x.fillRect(hx + 1, hy + 5, 5, 1);
  } else if (kind < 0.38) { // 落ち葉
    for (let k = 0; k < 5; k++) { x.fillStyle = (h2 * 7 + k) % 3 < 1 ? '#a85a2a' : (h2 * 5 + k) % 2 < 1 ? d2c : '#8a6a2a'; x.fillRect(hx + ((h2 * 37 + k * 5) % 9 | 0), hy + ((h2 * 23 + k * 3) % 5 | 0), 2, 1); }
  } else if (kind < 0.5) { // キノコ: 2本。赤い傘に白い点か、ほのかに光る青白い傘
    const glow = h2 > 0.7, cap = glow ? '#7ad7c8' : h2 > 0.35 ? '#c83a2a' : d2c;
    for (const [bx, H] of [[0, 3], [4, 2]]) {
      x.fillStyle = '#e8e0c8'; x.fillRect(hx + bx + 1, hy + 4 - H + 2, 1, H);
      x.fillStyle = cap; x.fillRect(hx + bx, hy + 3 - H, 3, 1); x.fillRect(hx + bx + 1, hy + 2 - H, 1, 1);
      if (!glow && h2 > 0.35) { x.fillStyle = '#ffffff'; x.fillRect(hx + bx, hy + 3 - H, 1, 1); }
      if (glow) { gx.fillStyle = '#1a4a44'; gx.fillRect(hx + bx, hy + 3 - H, 3, 1); }
    }
    x.fillStyle = '#10200e'; x.fillRect(hx, hy + 6, 7, 1);
  } else if (kind < 0.6) { // 木の根: うねる茶色の根
    let lx = hx, ly = hy + 2;
    for (let k = 0; k < 11; k++) { x.fillStyle = k % 4 === 0 ? '#3a2410' : '#5a3a1a'; x.fillRect(lx, ly, 1, 2); x.fillStyle = '#7a5a30'; x.fillRect(lx, ly, 1, 1); lx = clamp(lx + 1, 0, CH - 1); ly = clamp(ly + (hash2(lx * 7, k + h2 * 50) < 0.5 ? 1 : -1), 0, CH - 2); }
  } else if (kind < 0.68) { // 倒木: 横たわる丸太(切り口の年輪と苔)
    x.fillStyle = '#10200e'; x.fillRect(hx, hy + 4, 11, 1);
    x.fillStyle = '#5a3a1a'; x.fillRect(hx, hy + 1, 10, 3); x.fillStyle = '#7a5a30'; x.fillRect(hx, hy + 1, 10, 1);
    x.fillStyle = '#c8a060'; x.fillRect(hx + 9, hy + 1, 2, 3); x.fillStyle = '#8a6a3a'; x.fillRect(hx + 10, hy + 2, 1, 1); // 切り口
    x.fillStyle = d1; x.fillRect(hx + 2, hy, 3, 1); x.fillRect(hx + 6, hy, 2, 1); // 苔
  } else if (kind < 0.76) { // 苔むした石
    x.fillStyle = '#10200e'; x.fillRect(hx, hy + 4, 7, 1);
    x.fillStyle = '#4a5050'; x.fillRect(hx, hy + 2, 7, 2); x.fillRect(hx + 1, hy + 1, 5, 1);
    x.fillStyle = d1; x.fillRect(hx + 1, hy + 1, 3, 1); x.fillRect(hx, hy + 2, 2, 1);
  } else if (kind < 0.86) { // 小さな白い花
    for (let k = 0; k < 3; k++) { const fx = hx + k * 3, fy = hy + (k % 2) * 2; x.fillStyle = d0; x.fillRect(fx + 1, fy + 2, 1, 2); x.fillStyle = '#f0f0e0'; x.fillRect(fx, fy + 1, 3, 1); x.fillRect(fx + 1, fy, 1, 3); x.fillStyle = d3; x.fillRect(fx + 1, fy + 1, 1, 1); }
  } else if (kind > 0.95) { // 大きな木の根元: 幹と、四方へ張った根
    x.fillStyle = '#10200e'; x.fillRect(hx - 1, hy + 8, 12, 2);
    x.fillStyle = '#3a2410'; x.fillRect(hx + 2, hy, 6, 8); x.fillStyle = '#5a3a1a'; x.fillRect(hx + 3, hy, 4, 8); x.fillStyle = '#7a5a30'; x.fillRect(hx + 4, hy, 1, 8);
    x.fillStyle = '#5a3a1a'; x.fillRect(hx, hy + 7, 3, 1); x.fillRect(hx + 7, hy + 7, 3, 1); x.fillRect(hx - 1, hy + 8, 2, 1); x.fillRect(hx + 9, hy + 8, 2, 1);
    x.fillStyle = d1; x.fillRect(hx + 2, hy + 6, 2, 1);
  }
}
// 雲海の床の装飾: 雲の盛り上がり / 雲の中を走る稲光の筋(光る)/ 雨の水たまり / 小石 / 社の朱の梁のかけら / 太鼓 / 緑青の銅の柱
function thunderDeco(x, gx, hx, hy, kind, h2, [d0, d1, d2c, d3]) {
  if (kind < 0.3) { // 雲の盛り上がり: 明るい紫の丸いふくらみ
    for (const [dx, dy, r] of [[2, 2, 2], [5, 1, 2.5], [8, 2, 2]]) for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx + yy * yy <= r * r) { x.fillStyle = yy < 0 ? d1 : d0; x.fillRect(hx + dx + xx, hy + dy + yy + 2, 1, 1); }
    x.fillStyle = '#7a72a8'; x.fillRect(hx + 4, hy, 2, 1); x.fillRect(hx + 1, hy + 1, 2, 1);
  } else if (kind < 0.38) { // 稲光の筋: 雲の中を走るぎざぎざの光(光の層は暗い紫で)
    let lx = hx, ly = hy;
    for (let k = 0; k < 10; k++) { x.fillStyle = k % 3 ? '#8a72d8' : d3; x.fillRect(lx, ly, 1, 1); gx.fillStyle = '#2a1a5a'; gx.fillRect(lx, ly, 1, 1); lx = clamp(lx + 1, 0, CH - 1); ly = clamp(ly + (hash2(lx * 7, k + h2 * 50) < 0.5 ? 1 : -1), 0, CH - 1); }
  } else if (kind < 0.5) { // 雨の水たまり: 暗い水面に空の光
    x.fillStyle = '#16122a'; x.fillRect(hx + 1, hy + 1, 7, 2); x.fillRect(hx, hy + 2, 9, 1);
    x.fillStyle = '#4a4278'; x.fillRect(hx + 2, hy + 1, 2, 1); x.fillStyle = '#6a62a0'; x.fillRect(hx + 6, hy + 2, 1, 1);
  } else if (kind < 0.6) { // 小石
    x.fillStyle = '#14101e'; x.fillRect(hx, hy + 2, 4, 1); x.fillStyle = '#4a4466'; x.fillRect(hx, hy + 1, 4, 1); x.fillRect(hx + 1, hy, 2, 1);
  } else if (kind > 0.96) { // 緑青の銅の柱: 雨に打たれて青緑になった銅の柱(上に輪)
    x.fillStyle = '#14101e'; x.fillRect(hx - 1, hy + 11, 7, 1);
    x.fillStyle = '#2a5a4a'; x.fillRect(hx + 1, hy + 1, 3, 10); x.fillStyle = '#4a9a7a'; x.fillRect(hx + 1, hy + 1, 1, 10); x.fillStyle = '#7ac8a0'; x.fillRect(hx + 2, hy + 2, 1, 1);
    x.fillStyle = d2c; x.fillRect(hx, hy, 5, 1); x.fillRect(hx, hy + 5, 5, 1); x.fillRect(hx, hy + 10, 5, 1);
  } else if (kind > 0.93) { // 太鼓: 台に載った朱の胴の太鼓(金の鋲)
    x.fillStyle = '#14101e'; x.fillRect(hx, hy + 8, 9, 1);
    x.fillStyle = '#5a3a2a'; x.fillRect(hx + 1, hy + 6, 1, 2); x.fillRect(hx + 7, hy + 6, 1, 2);
    x.fillStyle = '#a8402a'; x.fillRect(hx + 1, hy + 1, 7, 5); x.fillStyle = '#c85a3a'; x.fillRect(hx + 1, hy + 1, 7, 1);
    x.fillStyle = '#e8d0a0'; x.fillRect(hx + 2, hy, 5, 1); x.fillStyle = '#ffd27a'; x.fillRect(hx + 1, hy + 2, 1, 1); x.fillRect(hx + 7, hy + 2, 1, 1); x.fillRect(hx + 1, hy + 4, 1, 1); x.fillRect(hx + 7, hy + 4, 1, 1);
  } else if (kind > 0.9) { // 社の朱の梁のかけら: 倒れた鳥居の梁が雲に埋もれる
    x.fillStyle = '#14101e'; x.fillRect(hx, hy + 3, 12, 1);
    x.fillStyle = '#a8302a'; x.fillRect(hx, hy + 1, 11, 2); x.fillStyle = '#d84a3a'; x.fillRect(hx, hy + 1, 11, 1); x.fillStyle = '#2a1a1a'; x.fillRect(hx + 11, hy, 1, 3);
    x.fillStyle = d1; x.fillRect(hx + 3, hy + 2, 4, 1);
  }
}
// 砂海の地面の装飾: 風紋 / 小石 / 枯れ草 / 獣の骨(角のある頭骨・砂から出たあばら)/ 倒れた柱 / 半分埋もれた石柱
function desertDeco(x, hx, hy, kind, h2, [d0, d1, d2c, d3]) {
  if (kind < 0.36) { // 風紋: 平行に波打つ砂の筋(明るい稜線と、その下の影)
    for (let r = 0; r < 3; r++) for (let k = 0; k < 12; k++) { const yy = hy + r * 3 + Math.round(Math.sin(k * 0.55 + h2 * 6 + r) * 1); x.fillStyle = d1; x.fillRect(hx + k, yy, 1, 1); x.fillStyle = d0; x.fillRect(hx + k, yy + 1, 1, 1); }
  } else if (kind < 0.46) { // 小石
    x.fillStyle = '#6a5a48'; x.fillRect(hx, hy + 2, 3, 1); x.fillStyle = d2c; x.fillRect(hx, hy + 1, 3, 1); x.fillRect(hx + 1, hy, 1, 1); x.fillRect(hx + 5, hy + 3, 2, 1);
  } else if (kind < 0.54) { // 枯れ草
    x.fillStyle = '#8a7048'; x.fillRect(hx + 1, hy + 1, 1, 3); x.fillRect(hx + 3, hy, 1, 4); x.fillRect(hx + 5, hy + 2, 1, 2); x.fillRect(hx, hy + 2, 1, 1); x.fillRect(hx + 4, hy + 1, 1, 1);
  } else if (kind < 0.58) { // 獣の骨: 角のある頭骨
    x.fillStyle = d0; x.fillRect(hx, hy + 5, 8, 1);
    x.fillStyle = d3; x.fillRect(hx + 2, hy + 1, 4, 3); x.fillRect(hx + 3, hy + 4, 2, 1); x.fillRect(hx, hy, 2, 1); x.fillRect(hx + 6, hy, 2, 1); x.fillRect(hx, hy - 1, 1, 1); x.fillRect(hx + 7, hy - 1, 1, 1);
    x.fillStyle = '#5a4a3a'; x.fillRect(hx + 2, hy + 2, 1, 1); x.fillRect(hx + 5, hy + 2, 1, 1);
  } else if (kind < 0.62) { // 獣の骨: 砂から出たあばら
    x.fillStyle = d0; x.fillRect(hx - 1, hy + 4, 12, 1);
    for (let k = 0; k < 4; k++) { x.fillStyle = d3; x.fillRect(hx + k * 3, hy + 1, 1, 3); x.fillRect(hx + k * 3 + 1, hy, 1, 1); }
  } else if (kind > 0.96) { // 半分埋もれた石柱: 折れた柱(縦の溝)と、根元の砂だまり
    x.fillStyle = d0; x.fillRect(hx - 1, hy + 9, 9, 2);
    x.fillStyle = '#b8a888'; x.fillRect(hx + 1, hy, 5, 9); x.fillStyle = '#d8ccb0'; x.fillRect(hx + 1, hy, 2, 9); x.fillStyle = '#8a7a60'; x.fillRect(hx + 4, hy + 1, 1, 8);
    x.fillStyle = '#efe6d0'; x.fillRect(hx + 1, hy, 5, 1); x.fillStyle = '#8a7a60'; x.fillRect(hx + 3, hy, 1, 1);
    x.fillStyle = d1; x.fillRect(hx, hy + 7, 7, 2); x.fillRect(hx - 1, hy + 8, 9, 1);
  } else if (kind > 0.92) { // 倒れた柱: 横たわる柱の胴(溝と切り口)に砂がかぶる
    x.fillStyle = d0; x.fillRect(hx, hy + 4, 13, 1);
    x.fillStyle = '#b8a888'; x.fillRect(hx, hy + 1, 12, 3); x.fillStyle = '#d8ccb0'; x.fillRect(hx, hy + 1, 12, 1); x.fillStyle = '#8a7a60'; for (let k = 2; k < 11; k += 3) x.fillRect(hx + k, hy + 2, 1, 2);
    x.fillStyle = '#efe6d0'; x.fillRect(hx + 11, hy + 1, 2, 3); x.fillStyle = d1; x.fillRect(hx + 3, hy + 3, 5, 1);
  }
}
// 陽炎(砂海): 地面を 2行ずつの帯に分け、ゆっくり進む波の山にかかった帯だけを 1px 左右へずらして描き直す(熱で地面がゆらいで見える)
function drawHaze() {
  const sx = GFX.sctx, c = sx.canvas, t = GFX.fx.time, VW = GFX.VW, VH = GFX.VH;
  for (let y = 0; y < VH; y += 2) {
    const wave = Math.sin(y * 0.045 - t * 1.1) * Math.sin(y * 0.013 + t * 0.37); // 2つの波の山が重なった所だけゆらぐ
    if (wave < 0.45) continue;
    const dx = Math.sin(t * 5 + y * 0.6) > 0 ? 1 : -1;
    sx.drawImage(c, 0, y, VW, 2, dx, y, VW, 2);
  }
}
// 雲の中を走る稲光(雲海): 2.3秒ごとに、画面のどこかの雲の床を細い稲光が 0.16秒 走る(またたく)。光の層は暗い紫で
function drawCloudBolts() {
  const t = GFX.fx.time, cyc = Math.floor(t / 2.3), u = t / 2.3 - cyc;
  if (u >= 0.07 || Math.floor(u * 100) % 3 === 2) return;
  const x0 = hash2(cyc, 31) * GFX.VW, y0 = hash2(cyc, 37) * GFX.VH, a = hash2(cyc, 41) * TAU, L = 30 + hash2(cyc, 43) * 40;
  jagBolt(x0, y0, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L * 0.5, { step: 6, j: 3, col: '#8a72d8', glow: '#2a1a5a' });
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
  if (e.obj === 'cdog') return s[e.run ? Math.floor(e.t * 10) % s.length : 0]; // 冥犬の犬: 走っている間だけ脚を動かす
  if (e.type === 'bear') return e.stand ? ART.S.bearStand : s[Math.floor(e.t * 5) % s.length]; // クマ: 爪の前に立ち上がる
  if (e.type === 'squirrel' && e.aim) return ART.S.squirrelThrow; // リス: ドングリを振りかぶる
  if (e.type === 'bee' || e.obj === 'wbee') return s[Math.floor(e.t * 24 + e.seed * 5) % s.length]; // 蜂: 速い羽ばたき
  if (e.type === 'scorpion' && e.aim) return ART.S.scorpionUp; // サソリ: 尾を振り上げる
  if (e.type === 'vulture') return e.landed ? ART.S.vultureLand : s[Math.floor(e.t * (e.jz > 0 ? 10 : 6) + e.seed * 5) % s.length]; // ハゲワシ: 降りたあとは翼をたたむ。空の上では速く羽ばたく
  if (e.type === 'antlion') return s[e.biteT > S.time ? 1 : Math.floor(e.t * 1.5 + e.seed * 3) % s.length]; // アリジゴク: 大あごをゆっくり開け閉め(噛むときは閉じる)
  if (e.type === 'tarmor' && e.aim) return ART.S.tarmorUp; // 雷の甲冑: 刀を掲げて雷を受ける
  if (e.type === 'twinsprite') { const f = e.twinIdx ? ART.S.twinsprite2 : ART.S.twinsprite; return f[Math.floor(e.t * 10 + e.seed * 5) % f.length]; } // 対の雷精: 2体で色が違う(紫・水色)
  if (MAGE_COL[e.type]) return e.aim || e.castT > S.time ? ART.S[e.type + 'Cast'] : s; // メイジ: 撃つ前・バフの時は杖を掲げる
  if (e.type === 'lampkeeper') return e.aim ? ART.S.lampkeeperLit : s; // 灯の番人: 見つけかけているとランタンが白く強く光る
  if (e.type === 'glassangel') return s[Math.floor(e.t * 3 + e.seed * 5) % s.length]; // 玻璃の天使: ゆっくり羽ばたく
  if (Array.isArray(s)) return s[Math.floor(e.t * 8) % s.length];
  return s;
}

// メイジのバフ: 足元を囲む属性の色の楕円(攻撃力 = 橙・受けるダメージ = 水色・移動速度 = 黄。いくつもかかると外へ重なる)
//   明るい点が楕円を回る。切れる前の 1.5秒は点滅。光の層は手前の半分だけ(体の上に光がにじまないように)
function drawBuffRings(e, sp, sc) {
  const sx = GFX.sctx, gx = GFX.gctx, cx = e.x - cam.x, cy = e.y - cam.y + sp.h * sc / 2 - 1;
  let k = 0;
  for (const bk in BUFF_COL) {
    const b = e.buffs[bk];
    if (!b || b.t <= S.time) continue;
    const left = b.t - S.time, on = left > 1.5 || Math.floor(left * 8) % 2;
    const rx = sp.w * sc * 0.5 + 1 + k * 3, ry = Math.max(2, rx * 0.4), C = BUFF_COL[bk].ring, n = Math.max(16, Math.round(TAU * rx)), rot = S.time * 2.5 * (k % 2 ? -1 : 1) + e.seed * 9;
    k++;
    if (!on) continue;
    for (let i = 0; i < n; i++) {
      const a = TAU / n * i, front = Math.sin(a) > 0, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
      const hi = Math.cos(a * 2 - rot) > 0.85; // 回る明るい点(2つ)
      sx.fillStyle = hi ? '#ffffff' : front ? C[0] : C[2]; sx.fillRect(x, y, 1, 1);
      if (front || hi) { gx.fillStyle = C[1]; gx.fillRect(x, y, 1, 1); }
    }
  }
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

function render() { fxScope(drawFrame); } // 描画の乱数は見た目の列(引く回数は窓の大きさ・画質で変わる)
function drawFrame() {
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
  const godDark = S && S.bosses ? S.bosses.reduce((m, b) => (!b.dead && b.ai && b.ai.godLit > 0 ? Math.max(m, 0.4 + b.ai.godLit / 8 * 0.6) : m), 0) : 0; // 神鳴りの溜め(雷神): 太鼓が光るほど画面の端が暗くなる
  const serDark = S && S.bosses ? S.bosses.reduce((m, b) => { const ai = !b.dead && b.boss === 'seraph' && b.ai; if (!ai) return m; const W = ai.wo; return Math.max(m, W && W.t < 5 ? 0.25 + 0.75 * Math.pow(W.t / 5, 2) : ai.lr && !ai.lr.still && !(W && W.t < 8) ? 0.3 : 0); }, 0) : 0; // ホワイトアウトの溜め・ラストラディアンス(熾天使): 画面が暗くなり、熾天使の光だけが強まる
  GFX.fx.dark = lerp(GFX.fx.dark, S && !S.demo && P && P.darkT > 0 && !P.dead ? 1 : Math.max(godDark, serDark), 0.08); // 暗闇(王墓)の間は画面の端も暗く(gfx.js の仕上げのシェーダー)
  for (let i = 0; i < 3; i++) { GFX.ambient[i] = lerp(GFX.ambient[i], st.amb[i] * (1 - 0.55 * fk) * (i === 2 ? 1 + 0.3 * fk : 1) * ink * (1 - 0.5 * serDark), ink < 1 ? 0.08 : 0.03); GFX.tint[i] = lerp(GFX.tint[i], st.tint[i] * (i === 1 ? 1 - 0.12 * fk : 1), 0.03); }

  drawGround();
  if (st.desert) drawHaze(); // 陽炎: 地面だけをゆらす(敵・自分は描く前)
  if (st.thunder) drawCloudBolts(); // 雲の中を走る稲光(敵・自分は描く前)
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
      dim = Math.max(dim, P.dimK || 0); // スキルの構えで暗くする(Q の構え)
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
      }
    } else if (z.kind === 'tower') { // 鉄塔: 格子の塔(先端の球が光る。大鉄塔は高く太い)。送電線: 自分へ雷の線
      const rise = Math.min(1, z.t * 8), x = Math.round(zx), base = Math.round(zy), H = z.big ? 30 : 20, top = base - Math.round(H * rise);
      for (let y = top; y <= base; y++) {
        const k = (y - top) / H, w = Math.round(1 + k * (z.big ? 5 : 3));
        sx.fillStyle = (y - top) % 3 === 0 ? '#c8c0d8' : '#6a6080'; sx.fillRect(x - w, y, 1, 1); sx.fillRect(x + w, y, 1, 1);
        if ((y - top) % 3 === 0) { sx.fillStyle = '#8a8098'; sx.fillRect(x - w, y, w * 2 + 1, 1); }
      }
      sx.fillStyle = '#ffffff'; sx.fillRect(x - 1, top - 2, 3, 2); gx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 20); pDisc(gx, x, top - 1, 3, '#fff27a'); gx.globalAlpha = 1;
      if (z.wire) {
        const lx = Math.round(P.x - cam.x), ly = Math.round(P.y - cam.y) - 8;
        gx.globalAlpha = 0.6 * fade; pLine(gx, x, top, lx, ly, '#fff27a', 1); gx.globalAlpha = 1;
        sx.globalAlpha = 0.8 * fade; pLine(sx, x, top + (Math.random() < 0.5 ? 1 : 0), lx, ly, '#ffffff', 1); sx.globalAlpha = 1;
      }
      addLight(z.x, z.y - H, z.big ? 90 : 60, '#fff27a', 0.7 * fade);
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
  const hd = { t, warnBlink, sx, gx, VW, VH }; // HAZ_DRAW に渡す render のローカル
  for (const h of hazards) {
    if (h.delay > 0) continue; // 予告のあとに出る床
    const hx = h.x - cam.x, hy = h.y - cam.y, fade = Math.min(1, (h.dur - h.t) * 3, h.t * 8);
    // ボスが置く物の描き方は、そのボスのファイルの HAZ_DRAW.<種類>(bosses/common.js)。ここは共有する種類(敵も置く物・複数のボス)
    const hf = HAZ_DRAW[h.kind];
    if (hf) { hf(h, hx, hy, fade, hd); continue; }
    if (h.kind === 'fire') { // 燃える床: 赤熱した地面に炎の舌がちらつく(縁は危険を示す赤)
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
    } else if (h.kind === 'pit') { // すり鉢(アリジゴク): 底ほど暗い砂のくぼみ。3本の筋が渦を巻いて中心へ流れ込む。縁は危険を示す赤
      const R = Math.round(h.r * Math.min(1, h.t * 4));
      sx.globalAlpha = 0.5 * fade; pDisc(sx, hx, hy, R, '#a8803a');
      sx.globalAlpha = 0.55 * fade; pDisc(sx, hx, hy, Math.round(R * 0.66), '#8a6a32');
      sx.globalAlpha = 0.6 * fade; pDisc(sx, hx, hy, Math.round(R * 0.33), '#5a4220'); sx.globalAlpha = fade;
      for (let k = 0; k < 3; k++) for (let i = 0; i < 28; i++) { const u = i / 28, pa = t * 1.6 + k * TAU / 3 + u * 4, pr = R * (1 - u); sx.fillStyle = u > 0.6 ? '#4a3418' : '#e8c88a'; sx.fillRect(Math.round(hx + Math.cos(pa) * pr), Math.round(hy + Math.sin(pa) * pr), 1, 1); }
      pCircle(sx, hx, hy, R, warnBlink ? '#ff3b1a' : '#ff8a3d'); sx.globalAlpha = 1;
    } else if (h.kind === 'miasma') { // 瘴気の霧(腐毒のグール)・三獄の雨の霧(ケルベロス): 霧が渦を巻く(縁は危険の赤)。毒 = 緑と紫・炎 = 橙と赤・氷 = 青白
      const R = Math.round(h.r * Math.min(1, h.t * 5)), FC = FOG_COL[h.el] || FOG_COL.poison;
      sx.globalAlpha = 0.35 * fade; pDisc(sx, hx, hy, R, FC[0]);
      sx.globalAlpha = 0.3 * fade; pDisc(sx, hx + Math.round(Math.sin(t * 1.7 + h.seed) * 2), hy + Math.round(Math.cos(t * 1.3 + h.seed) * 2), Math.max(1, Math.round(R * 0.7)), FC[1]);
      const nb = Math.max(12, Math.round(R / 3)), big = R > 60; // 大きな霧(瘴気の雨)ほどかたまりを増やす
      for (let i = 0; i < nb; i++) { // 渦を巻く霧のかたまり
        const a = t * 0.9 + TAU / nb * i + h.seed, rr = R * (0.3 + 0.6 * ((i * 0.37 + t * 0.2) % 1));
        sx.globalAlpha = 0.55 * fade; sx.fillStyle = i % 2 ? FC[2] : FC[3]; sx.fillRect(Math.round(hx + Math.cos(a) * rr), Math.round(hy + Math.sin(a) * rr * 0.8), big ? 3 : 2, big ? 2 : 1);
      }
      sx.globalAlpha = fade; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b5c' : FC[4]); sx.globalAlpha = 1;
      pDisc(gx, hx, hy, Math.max(1, R - 3), fade > 0.6 ? FC[5] : dimCol(FC[5], 0.5)); // ほのかに光る(光の層はとても暗い色で)
      addLight(h.x, h.y, Math.min(R * 2.4, R + 60), FC[6], 0.35 * fade);
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

  drawSpotCones(t); // 灯の番人の光の扇(地面を照らす。見つけかけると赤く)
  drawBossGround(t); // ボスの技の地面の光(三原の光精の色の円・ミラーボールの地面の光)
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
    if (e.flying) continue; // 空襲で空高く飛んでいるボスは影だけ(drawBossFx)。分裂しているケルベロスも
    if (e.sunk) { drawDogPool(e); continue; } // 闇の犬の影潜り: 影だまりと光る目だけ
    const sp = e.boss ? ART.S[e.spr || e.boss] : e.prop ? ART.S.brazier[Math.floor(t * 6 + e.seed * 5) % 2] : spriteOf(e);
    const sc = e.scale;
    if (!e.hz) shadow(e.x, e.y + sp.h * sc / 2 - 1, sp.w * sc * 0.8); // 宙にある物(ケルベロスの首)は影なし
    if (e.buffs) drawBuffRings(e, sp, sc); // メイジのバフ(体の後ろ側は体に隠れるので、体より先に)
    let sy = 1, sxk = 1, yo = 0;
    if (e.ai === 'hop') { const ha = e.hopAir || 0.35, h = e.hopT < ha ? Math.sin((e.hopT / ha) * Math.PI) : 0; yo = -h * 5; sy = 1 + h * 0.15 - (e.hopT > (e.hopEvery || 1.1) - 0.2 ? 0.15 : 0); sxk = 2 - sy; }
    else if (e.ai === 'flutter' || e.type === 'imp' || e.ai === 'twin' || e.type === 'raincloud') yo = Math.sin(e.t * 12) * 1.5;
    else if (e.type === 'glassangel') yo = Math.sin(e.t * 3 + e.seed * 6) * 2 - 1; // 玻璃の天使: ゆっくり浮き沈みする // 飛ぶ敵は上下に揺れる(火の小鬼は浮いたまま射撃。雷雲・対の雷精も浮く)
    if (e.swell > 0) { sy = sxk = 1 + 0.45 * e.swell; } // 鬼火の自爆: 膨らむ
    else if (e.disguise) { sy = 1 + Math.sin(e.t * 3) * 0.03; sxk = 2 - sy; } // 鏡の分身: 女王と同じ揺れ
    else if (e.obj) { if (e.dropT > 0) yo = -e.dropT * 260; sy = e.rise * (1 + (e.pulse || 0) * 0.6); sxk = 1 + (e.pulse || 0) * 0.4 + (e.obj === 'meat' ? Math.sin(e.t * 4 + e.seed * 9) * 0.04 : 0); } // せり上がる / 肉塊は脈打つ // 砂時計は空から落ちてくる
    if (e.obj === 'cdog') { yo -= e.jz || 0; sy = 1 + (e.pulse || 0) * 0.15; sxk = 1 + (e.pulse || 0) * 0.1; } // 冥犬の犬: 跳ぶ高さ。ふくらみは控えめに
    else if (e.type === 'mworm') { sy = Math.max(0.1, e.rise ?? 1); sxk = 1 + (1 - sy) * 0.4; } // マグマワーム: 地面から伸び出る・沈む
    else if (!e.prop && !e.boss) { const w = Math.abs(Math.sin(e.t * 7 + e.seed * 6)); sy = 1 - w * 0.06; sxk = 1 + w * 0.04; }
    if (e.ripe) { const pk = 1 + 0.1 * Math.abs(Math.sin(e.t * 12)); sy *= pk; sxk *= pk; } // 若木: 育つ前の 3秒はふくらんで光る
    if (e.boss) { sy = (e.sq || 1) + Math.sin(e.t * 3) * 0.03; sxk = 2 - sy; yo = -(e.jz || 0); }
    if (e.type === 'vulture' && e.jz > 0) yo -= e.jz; // ハゲワシ: 空の上(影は地面に残る)
    else if (e.type === 'antlion') yo += 2; // アリジゴク: すり鉢の底に半分埋まる
    if (e.riseAt !== undefined) { const k = Math.min(1, (S.time - e.riseAt) / 0.35); sy *= 0.2 + 0.8 * k; } // 立ち上がった砂人形: 砂から伸び上がる
    if (e.mound && e.moundT < 1) { const k = Math.abs(Math.sin(e.t * 30)) * 0.12; sy *= 1 + k; sxk *= 1 - k * 0.5; } // 砂山: 立ち上がる前に震える
    if (e.boss === 'seraph') drawSerBack(e, sp, yo); // 熾天使: 光の柱・光芒・6枚の翼(体の後ろ)
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
    if (e.boss === 'cerberus') drawCerbHeads(e, sp, yo, { flip, scale: sc, sy, sxk, alpha, white: e.flash > 0 }); // 首: 体から首の線が伸びて、その先に頭
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
    if (e.boss) addLight(e.x, e.y, 90, e.shadow ? '#7a3ab0' : e.col, e.shadow ? 0.6 : e.boss === 'seraph' ? 0.2 : 0.8); // 熾天使: 白い衣が明るい床で白く飛ばないように弱く
    if (e.aim) { gx.fillStyle = '#ffb13a'; gx.fillRect(Math.round(e.x - cam.x), Math.round(e.y - cam.y - 10), 1, 3); }
    if (e.type === 'goblin') addLight(e.x, e.y, 40, '#ffcc33', 0.8);
    else if (e.type === 'angler') { // チョウチンアンコウ: 提灯の光(光る予兆の間は大きく脈打つ)
      const g = e.glowL || 0, lx = e.x + (flip ? -4 : 4) * sc, ly = e.y + yo - sp.h * sc / 2 + 1;
      addLight(lx, ly, (26 + 80 * g) * (1 + 0.1 * Math.sin(t * 6 + e.seed * 9)), '#fff6a0', 0.7 + 0.3 * g);
      if (g > 0) { gx.fillStyle = g > 0.7 && warnBlink ? '#ffffff' : '#fff6a0'; gx.fillRect(Math.round(lx - cam.x) - 1, Math.round(ly - cam.y) - 1, 3, 3); }
    } else if (e.type === 'jelly') addLight(e.x, e.y, 20, '#ff8ad8', 0.25);
    else if (e.type === 'mworm') addLight(e.x, e.y - 4, 26, '#ff6a2a', 0.5);
    else if (e.type === 'icesprite') addLight(e.x, e.y, 26, '#9ff7ff', 0.5);
    else if (e.type === 'lampkeeper') addLight(e.x + (flip ? -8 : 8) * sc, e.y + yo + 3, e.aim ? 46 : 26, e.aim ? '#fff6c8' : '#ffd27a', e.aim ? 0.8 : 0.45 / (e.lanS || 1)); // 灯の番人: ランタンの灯(ふだんの灯は重なった番人の数で分ける。drawSpotCones)
    else if (e.type === 'holymage') addLight(e.x, e.y + yo - 10 * sc, 24, '#ffe8a0', 0.4); // ホーリーメイジ: 頭上の光輪
    else if (e.type === 'lightmoth' && !(e.dazCd > 0) && !(P.dazImm > 0)) { // 光の蝶: 眩惑を出せるとき、プレイヤーに近づくほど体の光が強まる(光る前の合図)
      const dz = DATA.enemies.lightmoth.dazzle, k = clamp(1 - (Math.sqrt(d2(e.x, e.y, P.x, P.y)) - dz.r * e.areaK) / 40, 0, 1);
      if (k > 0) { addLight(e.x, e.y, 14 + 18 * k, '#fff6c8', 0.7 * k); gx.fillStyle = k > 0.6 ? '#6a5a24' : '#3a3214'; gx.fillRect(Math.round(e.x - cam.x), Math.round(e.y - cam.y) - 1, 1, 2); }
    }
    else if (e.type === 'glassangel') addLight(e.x, e.y + yo - 4, 30, ['#e84860', '#58d878', '#4878e8', '#ffd23f'][Math.floor(t * 1.5 + e.seed * 4) % 4], 0.25); // 玻璃の天使: ステンドグラスを透ける色の光
    else if (e.type === 'ghost') addLight(e.x, e.y, 22, '#8ab8ff', 0.3); // 冷たい霊: 青白い光
    else if (e.type === 'ghoul') addLight(e.x, e.y - 4, 22, '#7dff6a', 0.32); // 腐毒のグール: 緑の毒の光
    else if (e.type === 'spider') addLight(e.x, e.y, 14, '#7dff6a', 0.22);
    else if (e.type === 'shadoweye') { // 影の眼: 撃つ前に瞳が赤紫に光り、闇が集まる
      if (e.wind > 0) { const k = 1 - e.wind / 0.6; pCircle(gx, Math.round(e.x - cam.x), Math.round(e.y - cam.y - 1), Math.round(10 - 7 * k), dimCol('#a66bff', 0.3 + 0.5 * k)); }
      addLight(e.x, e.y, e.wind > 0 ? 44 : 20, '#a66bff', e.wind > 0 ? 0.85 : 0.4);
    }
    else if (e.type === 'stalker' && !e.veil) addLight(e.x, e.y - 4, 18, '#c79bff', 0.3);
    else if (e.type === 'sapling' && e.ripe) addLight(e.x, e.y - 3, 20, '#d8ff9a', 0.45);
    else if (e.type === 'twinsprite') addLight(e.x, e.y, 30, e.twinIdx ? '#5ac8ff' : '#9a7aff', 0.6); // 対の雷精: 体の光
    else if (e.type === 'raichild') addLight(e.x, e.y, 18, '#9aa8ff', 0.35);
    else if (e.type === 'raincloud') addLight(e.x, e.y + 4, e.aim ? 40 : 16, '#b8a0ff', e.aim ? 0.7 : 0.3); // 雷雲: 稲妻を溜める間は光る
    else if (e.type === 'tarmor') addLight(e.x, e.y - 6, e.aim ? 46 : 16, e.aim ? '#b8a0ff' : '#9ab8ff', e.aim ? 0.8 : 0.3); // 雷の甲冑: 兜の奥の目 / 掲げた刀
    else if (e.obj === 'beeball') addLight(e.x, e.y, 24, '#ffb13a', 0.15); // 蜂球: 黄色の体が明るいので光は控えめに(強いと白く飛んで蜂の模様が消える)
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
    else if (e.obj === 'cdog') addLight(e.x + 8 * (e.face || 1), e.y + yo - 8, 30 + (e.pulse || 0) * 30, e.owner.shadow ? '#7a3ab0' : CERB[e.hk][0], 0.45 + (e.pulse || 0) * 0.4); // 冥犬の犬: 目と首の色の光
    if (e.disguise) addLight(e.x, e.y, 90, '#ff8ad8', 0.8); // 鏡の分身: 本物と同じ光(HP バーは出さない)
    else if (e.obj && !e.tiny) { // ボスが出した物: いつも金色の HP バー(壊せることを示す)と、足元の金の輪(蜂の陣の働き蜂は出さない)
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
  // 協力プレイ: 全員を描く(ほかの人を先に、自分 = players[0] を最後に重ねる。名前・矢印・薄さは 5段)
  for (const pl of players.slice().reverse()) withPlayer(pl, () => { if (!P.dead) {
    // クラスの部位アニメーション: スキルのモーション中は補間した姿勢、それ以外は待機・歩きのフレーム。なければ旧プレイヤー
    const rig = ART.S[DATA.classes[P.cls].rig];
    const mn = rig && P.anim ? (rig.alias && rig.alias[P.anim.name]) || P.anim.name : null;
    const M = mn && MOTIONS[mn] && MOTIONS[mn].rig === DATA.classes[P.cls].rig ? MOTIONS[mn] : null; // 他クラスのモーションは使わない
    const ms = M ? M.state(P.anim.t, P.anim.arg) : null;
    const bk = P.cls === 'berserker', walkM = (P.moving ? 'walk' : 'idle') + (bk && bkEyes() ? 'R' : ''); // バーサーカー: 怒りが上限・狂乱中は目が赤く光る絵
    const psp = ms ? rig.pose(ms.p) : rig && P.guard && rig.guard ? rig.pose(rig.guard) : rig ? ART.rigFrame(rig, walkM, P.cls === 'astro' && P.moving ? P.walkT : t) : ART.S.player; // アストロマンサーは重いほど足取りが遅い // guard: 構えの姿勢(ナイト)
    const py = P.y - (psp.h - ART.S.player.h) / 2; // 足元の位置を旧プレイヤーと揃える
    // 空蝉の分身(白いシルエットが明滅する)
    if (P.decoy && rig) drawSp(rig.base, P.decoy.x, P.decoy.y - (rig.base.h - ART.S.player.h) / 2, { white: true, alpha: 0.35 + 0.25 * Math.sin(t * 20), flip: P.facing < 0, emit: false });
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
    if (P.frzT > 0) { // 凍結(凍傷が上限に達した): 体が氷に閉じ込められる
      const ix = Math.round(P.x - cam.x), iy = Math.round(py - cam.y), a0 = Math.min(1, P.frzT * 4);
      sx.globalAlpha = 0.25 * a0; sx.fillStyle = '#9ff7ff'; sx.fillRect(ix - 7, iy - 10, 15, 19);
      sx.globalAlpha = 0.7 * a0; sx.fillStyle = '#ffffff'; sx.fillRect(ix - 7, iy - 10, 15, 1); sx.fillRect(ix - 7, iy + 8, 15, 1); sx.fillRect(ix - 7, iy - 10, 1, 19); sx.fillRect(ix + 7, iy - 10, 1, 19); sx.fillRect(ix - 4, iy - 7, 1, 4); sx.fillRect(ix - 3, iy - 8, 2, 1);
      sx.globalAlpha = 1; gx.fillStyle = '#16303e'; gx.fillRect(ix - 6, iy - 9, 13, 17); // 光の層は暗い色で
    }
    if (P.lockT > 0) { // 攻撃不能(ラストラディアンスの封印): 斜めに傾いた光の輪の枷が 2本、逆向きに回る。輪に刻まれた光の文字が流れる
      const cx = P.x - cam.x, cy = py - cam.y - 2, a0 = Math.min(1, P.lockT * 3);
      for (let k = 0; k < 2; k++) {
        const R = 11 + k * 3, tilt = k ? 0.5 : -0.5, sp = (k ? -1 : 1) * 2.2;
        for (let i = 0; i < 40; i++) {
          const a = TAU / 40 * i, ca = Math.cos(a), sa = Math.sin(a), x = Math.round(cx + ca * R), y = Math.round(cy + sa * R * 0.35 + ca * R * tilt * 0.4);
          const lit = Math.sin(a * 3 + t * sp * 3) > 0.7;
          sx.globalAlpha = (sa > 0 ? 0.95 : 0.45) * a0; sx.fillStyle = lit ? '#ffffff' : '#f2c84b'; sx.fillRect(x, y, 1, 1);
          if (lit) { gx.fillStyle = '#5a4a14'; gx.fillRect(x, y, 1, 1); } // 光の層は暗い金(体を白く飛ばさない)
        }
      }
      sx.globalAlpha = 1;
    }
    if (P.dazT > 0) { // 眩惑(光の蝶): 目の前で光の十字が 3つ、大きさを変えながらまたたいて回る(光の層は暗い金。明るい床で白く飛ばさない)
      const cx = P.x - cam.x, cy = py - cam.y - 9, a0 = Math.min(1, P.dazT * 4);
      for (let i = 0; i < 3; i++) {
        const ph = t * 2.4 + i * TAU / 3, x = Math.round(cx + Math.cos(ph) * 7), y = Math.round(cy + Math.sin(ph) * 3), s = Math.round(1 + 2 * Math.abs(Math.sin(t * 9 + i * 1.7)));
        sx.globalAlpha = 0.95 * a0; sx.fillStyle = '#ffffff'; sx.fillRect(x - s, y, s * 2 + 1, 1); sx.fillRect(x, y - s, 1, s * 2 + 1);
        sx.globalAlpha = 0.6 * a0; sx.fillStyle = '#ffe08a'; sx.fillRect(x - 1, y - 1, 1, 1); sx.fillRect(x + 1, y - 1, 1, 1); sx.fillRect(x - 1, y + 1, 1, 1); sx.fillRect(x + 1, y + 1, 1, 1);
        gx.fillStyle = '#5a4a14'; gx.fillRect(x, y, 1, 1);
      }
      sx.globalAlpha = 1;
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
    const fireOn = !!(P.flamePuffs && P.flamePuffs.length) || !!P.flame || !!(P.wmClone && P.wmClone.chans.some(ch => ch.flame));
    if (fireOn) mineOn(); // 火炎放射は自分の攻撃(「攻撃の濃さ」の層に描く)
    if (P.flamePuffs && P.flamePuffs.length) { // 火炎放射: 炎の塊。進むほど膨らみ、白 → 黄 → 橙 → 赤 → 煙(古いものから描いて、芯が上に来る)
      const PAL = [[0.05, '#fff6c8', '#dff8ff'], [0.2, '#ffc34a', '#7ad7ff'], [0.4, '#ff9a2a', '#4aa8f0'], [0.62, '#e8501a', '#2f6fd8'], [0.82, '#9a1e14', '#1f3f9a'], [1, '#3a2a2a', '#2a2a3a']];
      for (const f of P.flamePuffs) {
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
  } });

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
  for (const b of bolts) { // b.jit: 横の揺れ幅(既定 6)/ b.gcol: 光の層の色(既定 '#fff27a'。光の層は色で明るさが決まるので、弱めるなら暗い色)
    const k = 1 - b.t / b.life, J = b.jit ?? 6;
    let px = b.x0, py = b.y0;
    const segs = 9;
    for (let i = 1; i <= segs; i++) {
      const u = i / segs, jx = i === segs ? 0 : rand(-J, J), nx = lerp(b.x0, b.x1, u) + jx, ny = lerp(b.y0, b.y1, u) + (i === segs ? 0 : rand(-2, 2) * J / 6);
      pLine(sx, px - cam.x, py - cam.y, nx - cam.x, ny - cam.y, '#ffffff', b.w);
      gx.globalAlpha = k; pLine(gx, px - cam.x, py - cam.y, nx - cam.x, ny - cam.y, b.gcol || '#fff27a', b.w + 1); gx.globalAlpha = 1;
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
  drawTwinLinks(); // 対の雷精の線
  drawSkillFx(2, true); // ボスの攻撃の光芒・光の柱・きらめき
  drawSkillFx(3, true); // ボスの集中線(画面。ホワイトアウトの溜め)
  drawSerWhiteout(t); // ホワイトアウトの爆発(前景を白で覆う。影の扇だけ穴)
  drawSlashes(true);
  drawParts(false);
  drawRings(false);
  for (const p of eprojs) {
    if (p.nx && !p.stopT && eprojs.includes(p.nx)) jagBolt(p.x - cam.x, p.y - cam.y, p.nx.x - cam.x, p.nx.y - cam.y, { step: 8, j: 2, col: '#d8c8ff', glow: '#3a2478' }); // 雷の網(雷神): となりの玉と結ぶ稲妻(玉より先に描く)
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
    else if (p.kind === 'glob' || p.kind === 'rbit' || p.kind === 'efire' || p.kind === 'esand' || p.kind === 'bball' || p.kind === 'vball' || p.kind === 'sandshot') drawSp(ART.S[p.kind], p.x, p.y, ol);
    else if (p.kind === 'arrow' || p.kind === 'espear' || p.kind === 'bspear' || p.kind === 'trident' || p.kind === 'needle' || p.kind === 'eice' || p.kind === 'ispear' || p.kind === 'tick' || p.kind === 'stinger' || p.kind === 'feather') drawRot(p.kind, a, p.x, p.y, ol);
    else if (p.kind === 'leaf') drawRot('leaf', p.t * 9 + p.x * 0.1, p.x, p.y, ol); // 葉の嵐: くるくる回る葉
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
    else if (p.kind === 'tnet') { drawSp(ART.S.nethead, p.x, p.y, ol); addLight(p.x, p.y, 24, '#9a7aff', 0.4); } // 雷の網の玉
    else if (p.kind === 'tchroma') { // 三原の光精の分光の玉: 白(割れる前)・赤・緑・青の光の玉(白い芯)
      const col = p.ci === 3 ? '#ffffff' : TRI.col[p.ci], R = Math.max(2, Math.round(p.r * 1.2)), x = p.x - cam.x, y = p.y - cam.y;
      pCircle(sx, x, y, R + 1, oc); pDisc(sx, x, y, R, col); sx.fillStyle = '#ffffff'; sx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      pDisc(gx, x, y, Math.max(1, R - 2), dimCol(p.ci === 3 ? '#c8c8d8' : col, 0.3));
      addLight(p.x, p.y, 18, col, 0.3);
    }
    else if (p.kind === 'sbolt') { drawSp(ART.S.sbolt, p.x, p.y, ol); if (Math.random() < 0.3) part(p.x, p.y, rand(-6, 6), rand(-6, 6), 0.25, pick(['#bff4ff', '#ffffff']), { glow: true, drag: 3 }); } // クリスタルサテライトの光弾: 青白い光の玉(きらめきの尾)
    else if (p.kind === 'sfeather' || p.kind === 'sprism') { // セラフィムレイの光の羽根(金)/ プリズムバラージの弾(七色): 速さのぶん伸びる光の筋(赤い縁)。先は白
      const v2 = Math.hypot(p.vx, p.vy) || 1, Ln = Math.round((3 + v2 / 50) * A), c = p.vx / v2, s = p.vy / v2, x = p.x - cam.x, y = p.y - cam.y;
      const col = p.kind === 'sprism' ? PRISM[Math.floor(p.t * 14 + Math.abs(p.x) * 0.05) % 7] : '#ffd23f';
      pLine(sx, x - c * Ln, y - s * Ln, x, y, oc, 3); pLine(sx, x - c * Ln, y - s * Ln, x, y, col, 1);
      sx.fillStyle = '#ffffff'; sx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      pLine(gx, x - c * Ln * 0.6, y - s * Ln * 0.6, x, y, dimCol(p.kind === 'sprism' ? '#d8c8ff' : '#ffe8a0', 0.6));
    }
    else if (p.kind === 'gshard') drawSp(ART.S.gshard[p.ci || 0], p.x, p.y, Object.assign({ flip: Math.floor(p.t * 12 + p.rot) % 2 === 0 }, ol)); // 玻璃の天使のガラスの破片: 裏返りながら飛ぶ
    else if (p.kind === 'tspark') { drawSp(ART.S.tspark[Math.floor(t * 14 + Math.abs(p.x) * 0.05) % 2], p.x, p.y, ol); if (Math.random() < 0.25) part(p.x, p.y, rand(-10, 10), rand(-10, 10), 0.15, pick(['#d8c8ff', '#fff6c0']), { glow: true, drag: 3 }); } // サンダーメイジの雷の弾: またたく火花
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
    else if (p.kind === 'corb') { // 三獄の魔弾: 毒(緑)・炎(橙)・氷(青白)の玉。黒い芯を属性の光が縁取り、脈打つ
      const C = BREATH_COL[p.el], R = Math.round(p.r * 1.5), x = p.x - cam.x, y = p.y - cam.y, pl = Math.sin(t * 14 + p.t * 7) > 0 ? 1 : 0;
      pCircle(sx, x, y, R + 1 + pl, oc); pDisc(sx, x, y, R, C[0]); pDisc(sx, x, y, Math.max(1, R - 1), C[2]); pDisc(sx, x - 1, y - 1, Math.max(1, R - 2), '#1a0a14');
      sx.fillStyle = C[3]; sx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 1, 1);
      pCircle(gx, x, y, R, dimCol(C[0], 0.35));
      addLight(p.x, p.y, 30, C[0], 0.7);
    }
    else if (p.kind === 'cshade') { // 影の突進: ケルベロスの影絵が駆け抜ける(赤い縁)
      const f = p.vx < 0 ? -1 : 1, so = { flip: f < 0, rim: oc };
      drawShade(ART.S.cerberus, p.x, p.y, so);
      for (const hk of p.heads || []) { const H = CHEAD.find(c => c.hk === hk); drawShade(ART.S['obj_chead_' + hk], p.x + H.dx * f, p.y + H.dy - H.hz, so); }
      addLight(p.x, p.y, 50, '#7a3ab0', 0.6);
    }
    else if (p.kind === 'shound') { // 影の猟犬: 黒い犬の影絵(赤い縁・赤い目)が駆け抜ける
      drawShade(ART.S.cdog_dark[Math.floor(p.t * 14) % 2], p.x, p.y, { flip: p.vx < 0, rim: oc, emit: '#ff3b5c', emitG: '#7a1020' });
      addLight(p.x, p.y, 40, '#ff3b5c', 0.5);
    }
    else drawSp(ART.S.ball, p.x, p.y, ol);
    sx.globalAlpha = 1;
    addLight(p.x, p.y, (p.kind === 'boomer' ? 40 : p.kind === 'efire' ? 34 : 22) * A, stop ? oc : p.kind === 'efire' ? '#ff6a2a' : p.kind === 'tspark' ? '#9a7aff' : oc, stop ? 0.2 : 0.6);
  }
  // 予兆: 赤い半透明の塗り(時間とともに内側が満ちる) + 点滅する縁
  //   当たる時を示す動き: 円は外から縁へ縮む輪 / 帯は攻撃の向きへ流れる山形 / 扇は外から縁へ縮む弧。当たった瞬間は形が一瞬白く光る(snap)
  const edge = warnBlink ? '#ff3b5c' : '#ffd0d8';
  const blind = P.darkT > 0; // 暗闇(王墓): 敵の攻撃の予告が見えない
  for (const w of warns) {
    if (blind || (w.ink && S.inInk)) continue; // 墨だまりの中では触手の予告が見えない
    const k = w.t / w.life, wx = w.x - cam.x, wy = w.y - cam.y;
    if (w.snap) { drawWarnSnap(w, wx, wy, 1 - k); continue; }
    if (w.kind === 'sun') { drawSunWarn(w, k); continue; } // 謎かけの陽光: 安全な円の外すべて
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
    } else if (w.kind === 'sweep') { // 光の通り道(ヘヴンズリフト): 楕円が通る所全体(us ごとの片側の幅 vs)。傾き始める(aim)までは根元から赤く満ちる。傾いている間は縁の破線だけ残す
      const ca = Math.cos(w.a), sa = Math.sin(w.a), n = w.us.length;
      const shape = m => { const q = []; for (let i = 0; i < m; i++) q.push([wx + ca * w.us[i] - sa * w.vs[i], wy + sa * w.us[i] + ca * w.vs[i]]); for (let i = m - 1; i >= 0; i--) q.push([wx + ca * w.us[i] + sa * w.vs[i], wy + sa * w.us[i] - ca * w.vs[i]]); return q; };
      const poly = (q, al) => { sx.globalAlpha = al; sx.fillStyle = '#ff3b5c'; sx.beginPath(); q.forEach(([x, y], i) => i ? sx.lineTo(x, y) : sx.moveTo(x, y)); sx.closePath(); sx.fill(); };
      const full = shape(n);
      if (w.t < w.aim) {
        const ka = w.t / w.aim;
        poly(full, 0.1); poly(shape(Math.max(2, Math.ceil(n * ka))), 0.12); sx.globalAlpha = 1; // 塗りは薄め(1秒ごとに次の光の予告が重なるので、照らしている所が透けて見えるように)
        for (let i = 0; i < full.length; i++) { const p = full[i], q = full[(i + 1) % full.length]; pLine(sx, p[0], p[1], q[0], q[1], edge); pLine(gx, p[0], p[1], q[0], q[1], '#ff3b5c'); }
        const off = (t * 60) % 14; // 光が進む向きへ流れる山形(>)
        sx.globalAlpha = 0.25 + 0.35 * ka;
        for (let d = off + 5, i = 1; d < w.us[n - 1] - 4; d += 14) {
          while (i < n - 1 && w.us[i] < d) i++; // us は根元ほど細かいので、幅はその所の前後から
          const cw = Math.min(lerp(w.vs[i - 1], w.vs[i], clamp((d - w.us[i - 1]) / (w.us[i] - w.us[i - 1] || 1), 0, 1)) * 0.4, 7), px = wx + ca * d, py = wy + sa * d;
          for (const s of [-1, 1]) pLine(sx, px + ca * 3, py + sa * 3, px - ca * 2 - sa * cw * s, py - sa * 2 + ca * cw * s, '#ff3b5c');
        }
      } else { // 傾いている間: 縁の破線(光が消えるまで同じ濃さで残す。今の楕円の外でも、最後の速く伸びる所で当たるので)
        sx.globalAlpha = 0.55;
        for (let i = 0; i < full.length; i += 2) { const p = full[i], q = full[(i + 1) % full.length]; pLine(sx, p[0], p[1], q[0], q[1], '#ff3b5c'); }
      }
      sx.globalAlpha = 1;
    } else drawWarnCircle(wx, wy, Math.round(w.r), k, edge, { noFill: w.noFill });
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
  if (w.kind === 'sun') { drawSunWarn(w, 1, f); sx.globalAlpha = 1; return; }
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
// 円の予兆: 赤い半透明の塗り(時間とともに内側が満ちる)+ 点滅する縁 + 外から縁へ縮む輪(当たる時)。k = 経過の割合
//   noFill: 縁だけ(蜂の陣)/ glow: false なら光の層に描かない(根の檻は予告の上に根を描くので、光の縁が根に重ならないように)
function drawWarnCircle(wx, wy, R, k, edge, o = {}) {
  const sx = GFX.sctx, gx = o.glow === false ? null : GFX.gctx;
  if (!o.noFill) {
    sx.globalAlpha = 0.18; pDisc(sx, wx, wy, R, '#ff3b5c');
    sx.globalAlpha = 0.22; pDisc(sx, wx, wy, Math.round(R * k), '#ff3b5c'); sx.globalAlpha = 1;
  }
  pCircle(sx, wx, wy, R, edge); if (gx) pCircle(gx, wx, wy, R, '#ff3b5c');
  if (k < 1) { const TR = Math.round(R * (1 + 0.35 * (1 - k))); sx.globalAlpha = 0.25 + 0.5 * k; pCircle(sx, wx, wy, TR, '#ff3b5c', 2); sx.globalAlpha = 1; if (gx) pCircle(gx, wx, wy, TR, dimCol('#ff3b5c', 0.3 + 0.4 * k), 2); } // 外から縁へ縮む輪(当たる時)
}
// 謎かけの陽光(スフィンクス): 安全な円(石板)の外がすべて危ない。画面を赤く塗り、安全な円だけを抜く(行ごとに円の弦を除いて塗る)。縁は白く光る
//   snapF: 当たる瞬間の光(drawWarnSnap から。淡い色で一瞬)
function drawSunWarn(w, k, snapF) {
  const sx = GFX.sctx, gx = GFX.gctx, VW = GFX.VW, VH = GFX.VH, holes = w.safe.map(s => ({ x: s.x - cam.x, y: s.y - cam.y, r: s.r }));
  sx.globalAlpha = snapF !== undefined ? 0.3 * snapF : 0.16 + 0.22 * k; sx.fillStyle = snapF !== undefined ? '#ffd0d8' : '#ff3b5c';
  for (let y = 0; y < VH; y++) {
    const cut = [];
    for (const h of holes) { const dy = y - h.y; if (Math.abs(dy) <= h.r) { const hw = Math.sqrt(h.r * h.r - dy * dy); cut.push([Math.round(h.x - hw), Math.round(h.x + hw)]); } }
    cut.sort((a, b) => a[0] - b[0]);
    let x0 = 0;
    for (const [a, b] of cut) { if (a > x0) sx.fillRect(x0, y, a - x0, 1); x0 = Math.max(x0, b + 1); }
    if (x0 < VW) sx.fillRect(x0, y, VW - x0, 1);
  }
  sx.globalAlpha = snapF !== undefined ? snapF : 1;
  for (const h of holes) { pCircle(sx, h.x, h.y, Math.round(h.r), '#ffffff'); pCircle(gx, h.x, h.y, Math.round(h.r), '#6a5a1a'); }
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
// 瘴気の霧・三獄の雨の霧の色: [底, 渦, かたまり1, かたまり2, 縁, 光の層, 照らす光]
const FOG_COL = {
  poison: ['#1e3a1a', '#3a1a4a', '#5aff6a', '#9a7dff', '#7dff6a', '#0c1a0a', '#5aff6a'],
  fang: ['#3a1408', '#4a1a0a', '#ff6a2a', '#ffc34a', '#ff8a3d', '#1a0a04', '#ff6a2a'],
  dark: ['#0a2a3a', '#1a2a4a', '#9ff7ff', '#ffffff', '#bff4ff', '#04121a', '#7ad7ff'],
};
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
  if (e.boss === 'trichroma') drawTriFx(e, sx, gx, ex, ey, yo);
  if (e.boss === 'seraph') drawSerFx(e, sx, gx, ex, ey, yo);
  if (e.boss === 'shadowking' && !e.shadow) drawSkFx(e, sx, gx, ex, ey);
  if (e.boss === 'sphinx') drawSphinxFx(e, ai, sx, gx, ex, ey, sp, yo, A);
  if (e.stun > 0 || e.stunVis) for (let i = 0; i < 3; i++) { const a = GFX.fx.time * 6 + TAU / 3 * i, x = Math.round(ex + Math.cos(a) * 10), y = Math.round(ey + yo - sp.h / 2 - 4 + Math.sin(a) * 3); sx.fillStyle = gx.fillStyle = '#ffe14a'; sx.fillRect(x - 1, y, 3, 1); sx.fillRect(x, y - 1, 1, 3); gx.fillRect(x, y, 1, 1); } // ひるみ(砂時計・終刻の時計を壊した): 頭の上を星が回る
  if (ai.act === 'breath' && e.boss === 'cdragon') drawCdragonFx(e, ai, A);
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
  if (e.boss === 'raijin' && ai.godLit > 0) drawRaijinFx(e, ai, sx, gx, ex, ey, yo, t);
  // 白骨竜の狙い撃ち: 撃つ前に頭(目)が光る
  if (e.boss === 'wyrm' && ai.aiming > 0) drawWyrmFx(e, ai, sx, gx, ex, ey, sp, yo);
  // 巨大スライム: 吸収の光の線 / 分裂の残り時間(縮む弧)と中スライムへの糸
  if (e.boss === 'gslime') drawGslimeFx(e, ai, sx, gx, ex, ey, t);
  // ゴーレム: 岩の鎧(体を覆う岩・削った分だけ入るひび・DPSチェックの輪)/ ひるみの星 / 全速の赤い光
  if (e.boss === 'golem') drawGolemFx(e, ai, sx, gx, ex, ey, sp, yo, t);
  // 炎魔イフリート: 激昂の熱(足元の赤熱した輪と強い光)/ 祭壇から流れ込む炎の筋 / 祭壇で強まった炎のオーラ
  if (e.boss === 'ifrit') drawIfritFx(e, ai, sx, gx, ex, ey, sp, yo, t);
  // 晶角の大鹿: ひるみの星
  if (e.boss === 'stag' && ai.act === 'stun') drawStagFx(e, sx, gx, ex, ey, sp, yo, t);
  // 七彩の女王: 分身の間、本物だけ 0.5秒ごとに弱く光る
  if (e.boss === 'pqueen') drawPqueenFx(e, ai, sx, gx, ex, ey, sp, yo, t);
  // クラーケン: 触手が 2本以上ある間は、触手から本体へ水の流れ(守り)と、本体を包む水の膜
  if (e.boss === 'kraken' && e.takeK < 1 && !e.hidden) drawKrakenFx(e, sx, gx, ex, ey, t);
  // 深淵の海竜: 潜航中は大きな影が水の下を泳ぐ / 水流ブレス
  if (e.boss === 'levia') drawLeviaFx(e, ai, sx, gx, ex, ey, A, t);
  // 死神: 変身(時が止まる間、背後に大きな時計が現れて針が止まり、体が赤くひび割れる)
  if (e.boss === 'reaper' && S.morph && S.morph.e === e) drawReaperFx(e, sx, gx, ex, ey, yo);
  // 終刻の死神: 背後に回る時計の光輪(12の目盛りと針)/ 秒針の弾幕の前に目盛りが光る / 時間停止中は止まった時計
  if (e.boss === 'fhour' && !e.hidden) drawFhourFx(e, ai, sx, gx, ex, ey, sp, yo, t);
  // クロノ・エコー(終刻の死神): 灰色の死神。0.4秒で現れ、技が終わると 0.4秒で消える。秒針の弾幕の構えでは目盛りが光る
  if (e.boss === 'fhour' && ai.echoes) drawFhourFx2(e, ai, sx, sp, t);
  // 時計仕掛けの番人: 背中のゼンマイ / 時針と分針 / 鐘の光 / ゼンマイ巻きのDPSチェックの輪 / 止まった火花の星 / 全速の赤い光(リングギアは床として描く)
  if (e.boss === 'warden') drawWardenFx(e, ai, sx, gx, ex, ey, sp, yo, A, t);
  // 霜の巨人: 氷槌を振りかぶる間、頭上に氷が集まる / 地吹雪の前に体が白く光る
  if (e.boss === 'fgiant') drawFgiantFx(e, ai, sx, gx, ex, ey, sp, yo, A);
  // カオスドラゴン: 空襲の影(空の上の竜の影が地面を走る)
  if (e.boss === 'cdragon' && ai.act === 'raid' && ai.rd && ai.rd.ph === 'sky') drawCdragonFx2(e, ai, sx, ex, ey, A, t);
}

// ボスの技の見た目だけの演出(bfx。world.js の各ボスの技が積む)
// 2点を結ぶぎざぎざの稲妻(画面の座標)。o.step: 折れ目の間隔 / o.j: 揺れ幅 / o.col: 芯の色 / o.glow: 光の層の色(透明度が効かないので暗い色で)
function jagBolt(ax, ay, bx, by, o) {
  const L = Math.hypot(bx - ax, by - ay); if (L < 1) return;
  const sx = GFX.sctx, gx = GFX.gctx, n = Math.max(2, Math.round(L / o.step)), nxu = -(by - ay) / L, nyu = (bx - ax) / L;
  let px0 = ax, py0 = ay;
  for (let i = 1; i <= n; i++) { const v = i / n, j = i === n ? 0 : rand(-o.j, o.j), nx = lerp(ax, bx, v) + nxu * j, ny = lerp(ay, by, v) + nyu * j; pLine(sx, px0, py0, nx, ny, o.col); pLine(gx, px0, py0, nx, ny, o.glow, 2); px0 = nx; py0 = ny; }
}
// ボスの技の地面の光(敵より奥に描く)
//   三原の光精の色の円: 赤・緑・青の円を場面に足し合わせて塗る(lighter)ので、重なった所は黄・紫・水色・白になる。縁は回る光の点。光の層は暗い色で
//   ミラーボールの地面の光: 円錐を床で切った赤・緑・青の楕円(当たる所)を、色の円と同じ塗り方で(drawTriZones)。三原の灯と同時なら 1回で塗る(重なった所も色が混ざる)
function drawBossGround(t) {
  const sx = GFX.sctx, gx = GFX.gctx;
  for (const b of [...(S.bosses || []), ...(S.shadows || [])]) { // 影の王が呼んだ影も
    if (b.dead) continue;
    if (b.boss === 'seraph') { drawSerGround(b, t); continue; } // 熾天使: 足もとの光の陣・残像・壊れたクリスタルと影
    if (b.boss !== 'trichroma') continue;
    const ai = b.ai, L = ai.lamp, B = ai.ball, zs = [], R = Math.round(50 * CHAOS.area), k = L ? Math.min(1, L.t / 0.6) * clamp((L.dur + 0.5 - L.t) / 0.5, 0, 1) : 0;
    if (L) { const al = (L.t >= 0.6 && L.t < L.dur ? 0.34 : 0.16) * k; for (const z of triCircleZones(L.cs, R)) zs.push(Object.assign(z, { al })); }
    if (B) { // ミラーボールの地面の光(光が地面に届いてから): 赤・緑・青の楕円を三原の灯の円と同じ塗り方で(重なった所は色が混ざる。真下では白)
      const Q = TRI_BALL, kb = clamp((B.t - Q.show) / 0.08, 0, 1) * (1 - clamp((B.t - Q.dur) / Q.fade, 0, 1)), al = (B.t < Q.show + Q.warm ? 0.16 : 0.34) * kb;
      if (kb > 0) for (const z of triBallZones(triBallBeams(b, B))) zs.push(Object.assign(z, { al }));
    }
    const al = zs.length ? Math.max(...zs.map(z => z.al)) : 0; // 三原の灯の円とミラーボールの楕円は 1回で塗る(重なった所も色が混ざる。弱い方は z.k で淡く)
    if (al > 0) { for (const z of zs) z.k = z.al / al; drawTriZones(sx, zs, al, t); }
    if (L) {
      for (const c of L.cs) { // 縁: 回る光の点(灯の色と白)
        const cx = c.x - cam.x, cy = c.y - cam.y, dir = c.i % 2 ? -1 : 1;
        for (let j = 0; j < 40; j++) {
          const a = TAU / 40 * j + t * dir * 0.9, x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R), hi = j % 5 === 0;
          sx.globalAlpha = (hi ? 1 : 0.55) * k; sx.fillStyle = hi ? '#ffffff' : TRI.col[c.i]; sx.fillRect(x, y, 1, 1);
        }
        sx.globalAlpha = 1; pCircle(gx, cx, cy, R, dimCol(TRI.col[c.i], 0.3 * k));
        addLight(c.x, c.y, R * 1.6, TRI.col[c.i], 0.12 * k);
      }
      sx.globalAlpha = 1;
    }
  }
}
const triCircleZones = (cs, R) => cs.map(c => ({ i: c.i, x0: c.x - R - 1, y0: c.y - R - 1, x1: c.x + R + 2, y1: c.y + R + 2, hit: (x, y) => { const dx = x - c.x, dy = y - c.y; return dx * dx + dy * dy <= R * R; } }));
const triBallZones = bs => bs.map(b => { // ミラーボールの地面の楕円(当たる所。囲む四角は傾いた楕円の幅)。中かどうかは inConeSpot と同じ式(1点ごとに呼ぶので cos・sin は先に)
  const o = b.o, c = Math.cos(b.a), sn = Math.sin(b.a), cx = b.gx + c * o.c, cy = b.gy + sn * o.c, hx = Math.hypot(o.a * c, o.b * sn), hy = Math.hypot(o.a * sn, o.b * c), ia = 1 / (o.a * o.a), ib = 1 / (o.b * o.b);
  return { i: b.ci, x0: cx - hx - 1, y0: cy - hy - 1, x1: cx + hx + 2, y1: cy + hy + 2, hit: (x, y) => { const dx = x - cx, dy = y - cy, u = dx * c + dy * sn, v = dy * c - dx * sn; return u * u * ia + v * v * ib < 1; } };
});
// ---- ヘヴンズリフト(熾天使): 空の裂け目と、裂け目から地面へ差す光 ----
//   光は円錐(裂け目の高さ h・開きの半分 α)。地面の光は円錐を床で切った楕円(riftSpot)。画面では高さを上へずらして描くので、空中の円錐は
//   裂け目の口と地面の楕円を包む形(凸包)になる。プレイヤーが裂け目の向こう(画面の上)にいると、円錐は地面の楕円に重なって見えない
function hull2(pts) { // 凸包(点は [x, y]。渡した点の配列そのものを返すので、参照で見分けられる)
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
function riftEllPts(R, b, o, n) { // 地面の楕円の点(画面の座標)
  const c = Math.cos(b.a), s = Math.sin(b.a), cx = R.x + c * o.c - cam.x, cy = R.y + s * o.c - cam.y, pts = [];
  for (let i = 0; i < n; i++) { const q = TAU * i / n, lu = Math.cos(q) * o.a, lv = Math.sin(q) * o.b; pts.push([cx + c * lu - s * lv, cy + s * lu + c * lv]); }
  return pts;
}
// 空中の円錐(最前面): 光源の口と地面の楕円を包む形を薄い光で塗る(地面の楕円の所は抜く)。光の中を光の粒が降りる。地面の光の縁: lit なら赤い線(敵の攻撃の印。当たる所の縁そのもの)、でなければ淡い金の点線
//   src: { x, y: 光源の真下・H: 高さ・a: 向き・ap: 口の幅の半分・col / glow: 光の色・rim / dot: 照らしている間 / 弱い光の間の縁の色(なければ淡い金と赤) }・o: 地面の楕円・k: 光の強さ・f: 赤い縁の強さ・dr < 1: 光の先が口から地面へ降りていく途中(r0: 真下の円の半径)
function drawConeShaft(sx, gx, t, src, o, k, f, lit, dr, r0) {
  if (k <= 0) return;
  const H = src.H, ax = src.x - cam.x, ay = src.y - H - cam.y, c = Math.cos(src.a), s = Math.sin(src.a), down = dr * dr, aL = [ax - src.ap, ay], aR = [ax + src.ap, ay];
  let ell, hx, hy;
  if (dr < 1) { const rr = Math.max(1, r0 * down); hx = ax; hy = ay + H * down; ell = []; for (let i = 0; i < 24; i++) { const q = TAU * i / 24; ell.push([hx + Math.cos(q) * rr, hy + Math.sin(q) * rr]); } } // 降りていく光の先(空中の円)
  else { ell = riftEllPts(src, src, o, 48); hx = src.x + c * o.x - cam.x; hy = src.y + s * o.x - cam.y; } // 芯は円錐の軸が地面に当たる所へ
  const hl = hull2([aL, aR, ...ell]), path = (x, q) => { x.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) x.lineTo(q[i][0], q[i][1]); x.closePath(); };
  const col = src.col || '#fff6dc', rim = src.rim || '#ff3b5c';
  sx.globalAlpha = 0.2 * k; sx.fillStyle = col; // 差しこむ光(薄く塗る)
  sx.beginPath(); path(sx, hl); if (dr >= 1) path(sx, ell); sx.fill('evenodd'); // 地面の楕円の所は同じ点で抜く(楕円しか見えない向きでは何も残らない)
  gx.globalAlpha = 1; gx.fillStyle = dimCol(src.glow || '#fff2b0', 0.07 * k); gx.beginPath(); path(gx, hl); if (dr >= 1) path(gx, ell); gx.fill('evenodd');
  sx.globalAlpha = 0.25 * k; // 円錐の縁(口から地面の光へ接する 2本。淡く)
  for (const ap of [aL, aR]) { const i = hl.indexOf(ap); if (i < 0) continue; for (const j of [i - 1, i + 1]) { const q = hl[(j + hl.length) % hl.length]; if (q !== aL && q !== aR) pLine(sx, ap[0], ap[1], q[0], q[1], col); } }
  const Ln = Math.hypot(hx - ax, hy - ay) || 1, nx = -(hy - ay) / Ln, ny = (hx - ax) / Ln, wd = dr < 1 ? 2 : Math.min(o.b, 12);
  sx.fillStyle = '#ffffff';
  for (let j = -1; j <= 1; j++) for (let d = (t * 1.2 + (j + 1) * 0.29) % 0.25; d < 1; d += 0.25) { // 光の中を降りる粒
    const w = j * (1 + d * wd * 0.6);
    sx.globalAlpha = 0.45 * k * Math.sin(d * Math.PI); sx.fillRect(Math.round(ax + (hx - ax) * d + nx * w), Math.round(ay + (hy - ay) * d + ny * w), 1, 1);
  }
  if (dr >= 1) { // 地面の光の縁(楕円そのもの)
    const n = Math.max(24, Math.round(TAU * Math.max(o.a, o.b) * 1.1)), pts = riftEllPts(src, src, o, n);
    sx.globalAlpha = lit ? 0.85 * f : 0.5 * k; sx.fillStyle = lit ? rim : src.dot || '#ffe8a0'; gx.fillStyle = dimCol(rim, 0.35 * f);
    let lx = 1e9, ly = 1e9;
    for (let i = 0; i < n; i++) {
      const x = Math.round(pts[i][0]), y = Math.round(pts[i][1]);
      if (x === lx && y === ly) continue;
      lx = x; ly = y;
      if (!lit) { if ((i + (src.dph || 0)) % 3 === 0) sx.fillRect(x, y, 1, 1); continue; } // 予告の間: 淡い金の点線(dph: 点をずらす。同じ楕円に重なる光の色を交互に)
      sx.fillRect(x, y, 1, 1); gx.fillRect(x, y, 1, 1);
    }
  }
  sx.globalAlpha = 1;
}
// 対の雷精の線: 予告は細い赤の線が点滅 → 張られている間は紫白のぎざぎざの雷の線(光の層は暗い紫)
function drawTwinLinks() {
  const sx = GFX.sctx, gx = GFX.gctx, t = GFX.fx.time;
  for (const e of enemies) {
    if (e.dead || e.ai !== 'twin' || e.twinIdx !== 0 || !e.mate || e.mate.dead || !e.pr) continue;
    const m = e.mate, pr = e.pr, ax = e.x - cam.x, ay = e.y - cam.y - 1, bx = m.x - cam.x, by = m.y - cam.y - 1, L = Math.hypot(bx - ax, by - ay) || 1;
    if (pr.ph === 'tele') { if (Math.floor(t * 16) % 2) { sx.globalAlpha = 0.8; pLine(sx, ax, ay, bx, by, '#ff3b5c'); sx.globalAlpha = 1; pLine(gx, ax, ay, bx, by, '#5a1020'); } }
    else if (pr.ph === 'on') {
      const n = Math.max(4, Math.round(L / 10)), nxu = -(by - ay) / L, nyu = (bx - ax) / L;
      let px0 = ax, py0 = ay;
      for (let i = 1; i <= n; i++) { const v = i / n, j = i === n ? 0 : rand(-3, 3), nx = lerp(ax, bx, v) + nxu * j, ny = lerp(ay, by, v) + nyu * j; pLine(sx, px0, py0, nx, ny, '#f0e8ff'); pLine(gx, px0, py0, nx, ny, '#4a2a98', 2); px0 = nx; py0 = ny; }
      addLight((e.x + m.x) / 2, (e.y + m.y) / 2, Math.min(80, L * 0.6), '#9a7aff', 0.5);
    }
  }
}
function drawBfx() {
  const sx = GFX.sctx, gx = GFX.gctx, t = GFX.fx.time;
  const bd = { t, sx, gx }; // BFX_DRAW に渡す drawBfx のローカル
  for (const f of bfx) {
    const fx = f.x - cam.x, fy = f.y - cam.y, u = f.t / f.life;
    // ボスの演出の描き方は、そのボスのファイルの BFX_DRAW.<種類>(bosses/common.js)。ここは共有する種類(敵も出す物・複数のボス)
    const bf = BFX_DRAW[f.kind];
    if (bf) { bf(f, fx, fy, u, bd); continue; }
    if (f.kind === 'rootspike') { // 突き上げる根(樹人・古樹の主): 地面から尖った根が伸び、少しして沈む
      const k = u < 0.18 ? u / 0.18 : u > 0.7 ? Math.max(0, (1 - u) / 0.3) : 1, H = Math.round(f.h * k), bx = Math.round(fx), by = Math.round(fy);
      if (H >= 1) {
        sx.fillStyle = '#1a1008'; sx.fillRect(bx - 2, by + 1, 5, 1);
        for (let j = 0; j < H; j++) { const w = j < H * 0.4 ? 3 : j < H * 0.75 ? 2 : 1; sx.fillStyle = j === H - 1 ? '#c8a060' : j % 3 === 0 ? '#3a2410' : '#6a4424'; sx.fillRect(bx - (w >> 1), by - j, w, 1); }
      }
      continue;
    }
    if (f.kind === 'hbeam') { // ホーリーメイジの光のビーム: 太い白金の光線が一瞬で走り、細くなって消える(芯は白、縁は金。光の層は暗い金)
      const k = 1 - u, c = Math.cos(f.a), s = Math.sin(f.a), x0 = Math.round(fx), y0 = Math.round(fy), x1 = fx + c * f.len, y1 = fy + s * f.len, W = Math.max(1, Math.round(f.w * (0.4 + 0.6 * k)));
      sx.globalAlpha = 0.55 * k; pLine(sx, x0, y0, x1, y1, '#ffd23f', W + 2);
      sx.globalAlpha = k; pLine(sx, x0, y0, x1, y1, '#fff6c8', W); pLine(sx, x0, y0, x1, y1, '#ffffff', Math.max(1, W - 3));
      sx.globalAlpha = 1; pLine(gx, x0, y0, x1, y1, dimCol('#c8a050', 0.7 * k), W + 1);
      for (let d = 0; d < f.len; d += 30) addLight(f.x + c * d, f.y + s * d, 26, '#fff2b8', 0.5 * k);
      continue;
    }
    if (f.kind === 'spotflash') { // 灯の番人が見つけた: 扇の形の白い光が一瞬強く光って消える
      const k = 1 - u, cx = fx, cy = fy;
      sx.globalAlpha = 0.55 * k; sx.fillStyle = '#ffffff'; sx.beginPath(); sx.moveTo(cx, cy); sx.arc(cx, cy, f.r, f.a - f.h, f.a + f.h); sx.closePath(); sx.fill();
      sx.globalAlpha = 1; gx.fillStyle = dimCol('#c8a050', 0.5 * k); gx.beginPath(); gx.moveTo(cx, cy); gx.arc(cx, cy, f.r, f.a - f.h * 0.5, f.a + f.h * 0.5); gx.closePath(); gx.fill();
      for (let d = 10; d < f.r; d += 20) addLight(f.x + Math.cos(f.a) * d, f.y + Math.sin(f.a) * d, 24, '#fff6c8', 0.7 * k);
      continue;
    }
    if (f.kind === 'ebolt') { // 敵の稲妻: 紫白のぎざぎざの線(光の層は暗い紫。光の層は透明度が効かないので、消えるときは色を暗くする)
      const k = 1 - u, J = f.jit ?? 6; let px0 = f.x, py0 = f.y;
      for (let i = 1; i <= 9; i++) {
        const v = i / 9, nx = lerp(f.x, f.x1, v) + (i === 9 ? 0 : rand(-J, J)), ny = lerp(f.y, f.y1, v) + (i === 9 ? 0 : rand(-2, 2) * J / 6);
        pLine(sx, px0 - cam.x, py0 - cam.y, nx - cam.x, ny - cam.y, f.col || '#f0e8ff', f.w); // col: 芯の色(放射する細い稲妻は淡い紫)
        pLine(gx, px0 - cam.x, py0 - cam.y, nx - cam.x, ny - cam.y, dimCol('#5a3aa8', k), f.w + 1);
        px0 = nx; py0 = ny;
      }
      addLight(f.x1, f.y1, 40, '#9a7aff', 0.6 * k);
      continue;
    }
    if (f.kind === 'ghost') { // 残像(ケルベロスの突進・影の王の影歩): 体の形を単色で、すぐ消える
      const s0 = ART.S[f.spr], sp = Array.isArray(s0) ? s0[0] : s0, img = ART.tint(f.flip ? ART.variant(sp, 'flip') : sp.c, f.col);
      sx.globalAlpha = 0.5 * (1 - u); sx.drawImage(img, Math.round(fx - sp.w / 2), Math.round(fy - sp.h / 2)); sx.globalAlpha = 1;
      gx.globalAlpha = 1; gx.drawImage(ART.tint(f.flip ? ART.variant(sp, 'flip') : sp.c, dimCol(f.col, 0.25 * (1 - u))), Math.round(fx - sp.w / 2), Math.round(fy - sp.h / 2));
      continue;
    }
    if (f.kind === 'tslap') { // 触手の叩きつけ・薙ぎ: 吸盤の並ぶ太い触手が帯の上に現れて沈む
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
    } else if (f.kind === 'icespike') { // 氷の棘: 地面から突き出て、砕けて沈む
      const k = u < 0.15 ? u / 0.15 : u > 0.6 ? Math.max(0, 1 - (u - 0.6) / 0.4) : 1, H = Math.round(f.h * k), x0 = Math.round(fx), y0 = Math.round(fy);
      for (let j = 0; j < H; j++) { const w = Math.max(1, Math.round((H - j) / Math.max(1, H) * 3)); sx.fillStyle = j > H - 3 ? '#ffffff' : j < 2 ? '#5ab8e8' : '#bff4ff'; sx.fillRect(x0 - (w >> 1), y0 - j, w, 1); if (j > H / 2) { gx.fillStyle = '#2a5a6a'; gx.fillRect(x0, y0 - j, 1, 1); } }
      if (H > 0) { sx.fillStyle = '#2a3448'; sx.fillRect(x0 - 2, y0 + 1, 5, 1); }
    }
  }
}

// 環境パーティクル(ホタル・火の粉)。カメラに対して視差を付けて漂わせる
function drawMotes(st) {
  const gx = GFX.gctx, VW = GFX.VW, VH = GFX.VH, t = GFX.fx.time, m = st.motes;
  if (m.rain) { // 雲海: 斜めに降る雨(手前の粒ほど長く速い)と、地面ではねるしぶき
    const sx = GFX.sctx;
    for (let i = 0; i < 70; i++) {
      const near = i % 5 === 0, sp = near ? 260 : 170 + hash2(i, 5) * 50, L = near ? 7 : 4 + Math.round(hash2(i, 9) * 2);
      const wx = ((hash2(i, 7) * 1000 - t * sp * 0.25 - cam.x * (near ? 1.1 : 0.9)) % (VW + 20) + VW + 20) % (VW + 20) - 10;
      const wy = ((hash2(i, 13) * 1000 + t * sp - cam.y * (near ? 1.1 : 0.9)) % (VH + 20) + VH + 20) % (VH + 20) - 10;
      sx.globalAlpha = near ? 0.55 : 0.35; pLine(sx, wx, wy, wx + L * 0.25, wy - L, '#9a94d8');
    }
    for (let i = 0; i < 12; i++) { // しぶき: 0.77秒ごとに場所を変えて、はじめの 0.2秒だけ
      const k = t * 1.3 + hash2(i, 21), cyc = Math.floor(k), ph = k - cyc; if (ph >= 0.25) continue;
      const x = Math.round(((hash2(i, cyc * 7 + 1) * 2000 - cam.x) % VW + VW) % VW), y = Math.round(((hash2(i, cyc * 11 + 3) * 2000 - cam.y) % VH + VH) % VH);
      sx.globalAlpha = 1 - ph * 4; sx.fillStyle = '#8a84c8'; sx.fillRect(x - 1, y, 1, 1); sx.fillRect(x + 1, y, 1, 1); sx.fillRect(x, y - 1, 1, 1);
    }
    sx.globalAlpha = 1;
    return;
  }
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
  if (m.feather) { // 天光の聖堂: 天から斜めに差す光の筋(ゆっくり流れる。ごく淡く)と、ひらひら舞い落ちる白い羽根
    const sx = GFX.sctx;
    for (let i = 0; i < 3; i++) { // 光の筋: 右上から左下へ傾いた帯(帯の中は淡い白金。光源も少し)
      const ph = t * 0.012 + i * 0.37, bx = ((hash2(i, 3) * 2 + ph) % 1.6 - 0.3) * VW - (cam.x * 0.15) % VW, W = 26 + hash2(i, 5) * 30;
      sx.globalAlpha = 0.05 + 0.02 * Math.sin(t * 0.5 + i * 2); sx.fillStyle = '#fff6dc';
      sx.beginPath(); sx.moveTo(bx, -10); sx.lineTo(bx + W, -10); sx.lineTo(bx + W - VH * 0.45, VH + 10); sx.lineTo(bx - VH * 0.45, VH + 10); sx.closePath(); sx.fill();
      for (let k = 0; k < 3; k++) { const u = (k + 0.5) / 3; addLight(cam.x + bx + W / 2 - VH * 0.45 * u, cam.y + VH * u, W * 1.4, '#fff2c8', 0.12); }
    }
    sx.globalAlpha = 1;
    for (let i = 0; i < 16; i++) { // 羽根: 揺れながらゆっくり落ち、くるりと向きを変える(手前は大きく速い)
      const near = i % 4 === 0, sp = near ? 16 : 7 + hash2(i, 5) * 5, sw = Math.sin(t * (0.9 + hash2(i, 2) * 0.6) + i * 1.7);
      const wx = Math.round(((hash2(i, 7) * 1000 + sw * 10 - cam.x * (near ? 1.1 : 0.9)) % (VW + 20) + VW + 20) % (VW + 20) - 10);
      const wy = Math.round(((hash2(i, 13) * 1000 + t * sp - cam.y * (near ? 1.1 : 0.9)) % (VH + 20) + VH + 20) % (VH + 20) - 10);
      const dir = sw > 0 ? 1 : -1, L = near ? 4 : 3;
      sx.fillStyle = '#b8b0a0'; for (let k = 0; k < L; k++) sx.fillRect(wx + k * dir, wy + (k >> 1), 1, 1); // 羽軸
      sx.fillStyle = '#ffffff'; for (let k = 1; k < L; k++) sx.fillRect(wx + k * dir, wy - 1 + (k >> 1), 1, 1);
      if (near) { sx.fillRect(wx + dir, wy + 1, 1, 1); gx.fillStyle = '#3a3830'; gx.fillRect(wx + dir, wy, 1, 1); }
    }
  }
  if (st.forest) { // 木漏れ日: 梢のすき間から差す光のまだら(地面に貼りつき、ゆっくり揺れる)
    const G = 150, x0 = Math.floor((cam.x - 80) / G), y0 = Math.floor((cam.y - 80) / G), x1 = Math.floor((cam.x + VW + 80) / G), y1 = Math.floor((cam.y + VH + 80) / G);
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
      const h = hash2(i * 7 + 3, j * 13 + 5);
      if (h < 0.3) continue;
      const lx = (i + 0.15 + 0.7 * hash2(i, j)) * G + Math.sin(t * 0.25 + h * 9) * 12, ly = (j + 0.15 + 0.7 * hash2(j, i + 9)) * G + Math.cos(t * 0.21 + h * 7) * 9;
      addLight(lx, ly, 60 + h * 55, '#fff0c0', 0.3 + 0.1 * Math.sin(t * 0.6 + h * 11));
    }
  }
  if (st.desert) { // 流れる砂: 風に吹かれた細い砂の筋が地面すれすれを流れる(ときどき強い風で多くなる)
    const sx = GFX.sctx, gust = 0.5 + 0.5 * Math.sin(t * 0.4), n = Math.round(14 + 22 * gust);
    for (let i = 0; i < n; i++) {
      const sp = 50 + hash2(i, 3) * 40, wx = ((hash2(i, 7) * 1000 + t * sp - cam.x) % (VW + 40) + VW + 40) % (VW + 40) - 20;
      const wy = ((hash2(i, 13) * 1000 - cam.y + Math.sin(t * 2 + i) * 2) % (VH + 20) + VH + 20) % (VH + 20) - 10, L = 2 + Math.round(hash2(i, 5) * 4);
      sx.globalAlpha = 0.35 + 0.35 * hash2(i, 9); sx.fillStyle = hash2(i, 11) < 0.5 ? '#f0d8a0' : '#fff0c8'; sx.fillRect(Math.round(wx), Math.round(wy), L, 1);
    }
    sx.globalAlpha = 1;
  }
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
    if (arr === warns && !gone && !o.snap && !o.noSnap) warns.push({ kind: o.kind, x: o.x, y: o.y, a: o.a, r: o.r, r0: o.r0, h: o.h, len: o.len, w: o.w, ink: o.ink, sever: o.sever, safe: o.safe, snap: true, t: 0, life: 0.12 }); // 当たる瞬間: 同じ形が一瞬光る(noSnap: 動く道すじの予告など、当たる所ではないもの)
    arr.splice(i, 1);
  }
  // 斬撃のイベント(鬼神・村正の一閃など): 決まった時刻に一度だけ。処理中に slashes が増えてもいいように、集めてから実行する
  const due = [];
  for (const s of slashes) if (s.ev) for (const ev of s.ev) if (!ev.done && s.t >= ev.at) { ev.done = true; due.push([ev.fn, !s.enemy, s.pl]); }
  for (const [fn, mine, pl] of due) if (mine) withPlayer(pl || P, () => asMine(fn)); else fn(); // 自分の斬撃のイベントは斬った人で(撃破・ダメージ)。演出は「攻撃の濃さ」の対象
  for (const w of warns) if (w.track) w.track(w); // 追随する予兆(発生源・向きを毎フレーム更新)
  for (const f of bfx) if (f.track) f.track(f, dt); // ボスの技の演出(動く影など)
  updSkillFx(dt); // スキルの演出(skillfx.js)
}
