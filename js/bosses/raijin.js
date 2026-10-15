// bosses/raijin.js — ボス: 雷神: 太鼓の輪を背負い、距離 110 を保って浮かぶ。★雷鼓の輪(拍ごとに雷の輪)/ 雷の檻(雷柱を壊せば出られる)/ 雷の網・雷の双玉(玉と線の弾)/ 風神の風 / 激昂: 神鳴り
'use strict';

// ---------- 雷神: 太鼓の輪を背負い、距離 110 を保って浮かぶ。★雷鼓の輪(拍ごとに雷の輪)/ 雷の檻(雷柱を壊せば出られる)/ 雷の網・雷の双玉(玉と線の弾)/ 風神の風 / 激昂: 神鳴り ----------
function raijinAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  e.jz = 6 + Math.sin(e.t * 2) * 2; // 浮いている
  if (ai.act) return; // 雷鼓の輪で太鼓を叩いている間・神鳴りの溜めの間は動かない(終わりは技の later)
  if ((ai.flip = (ai.flip ?? 3) - dt) <= 0) { ai.flip = rand(3, 5); ai.side = -ai.side; } // ときどき回り込む向きを変える
  const dir = dist > 110 ? a : a + Math.PI, k = Math.abs(dist - 110) > 15 ? 1 : 0.25; // 距離 110 を保ち、横へ回り込む
  e.x += (Math.cos(dir) * k + Math.cos(a + Math.PI / 2) * 0.7 * ai.side) * e.spd * slow * dt;
  e.y += (Math.sin(dir) * k + Math.sin(a + Math.PI / 2) * 0.7 * ai.side) * e.spd * slow * dt;
  if (Math.random() < dt * 6) part(e.x + rand(-12, 12), e.y + e.r + rand(-2, 2), rand(-8, 8), rand(2, 8), 0.6, pick(['#8a84b8', '#6a6490', '#b8b0e0']), { drag: 1 }); // 足もとの雲がこぼれる
  ai.ring -= dt * R; ai.cage -= dt * R; ai.net -= dt * R; ai.pair -= dt * R; ai.gale -= dt * R; ai.busy -= dt * R; if (ai.enraged) ai.god -= dt * R;
  if (ai.busy > 0) return; // 技のあとは少しあける(技を重ねない)
  if (ai.enraged && ai.god <= 0) { ai.god = 15; raijinGod(e, ai); }
  else if (ai.gale <= 0) { ai.gale = ai.enraged ? 12 : 15; ai.busy = 2; raijinGale(e, ai); }
  else if (ai.ring <= 0) { ai.ring = ai.enraged ? 11 : 14; raijinRing(e, ai); }
  else if (ai.cage <= 0) { ai.cage = ai.enraged ? 12 : 16; ai.busy = 3.6; raijinCage(e, ai); }
  else if (ai.pair <= 0) { ai.pair = ai.enraged ? 7 : 9; ai.busy = 2; raijinPair(e, ai, a); }
  else if (ai.net <= 0) { ai.net = ai.enraged ? 5 : 6; ai.busy = 1; raijinNet(e, ai, a); }
}
// 落雷(雷神の技で共通): 円(半径 r)の中に ×n・痺れ +numb と、紫白の稲妻
function raijinStrike(e, x, y, r, n, numb, o) {
  if (hitCircle(x, y, r, e.dmg * n)) numbPlayer(numb);
  skyBolt(x, y, r * CHAOS.area, o);
}
// ★雷鼓の輪: 背中の太鼓を「ドン・ドン・ドドン」のリズムで叩き(1小節 = 0・0.5・1.0・1.25秒。1.75秒ごと)、1打ごとに太鼓の輪から雷の玉 8つの輪を撃つ(速さ 55・5秒)。
//   となりどうしの玉は稲妻でつながり、輪は 1か所だけ切れている(切れ目 = 45°)。切れ目は 1打目がプレイヤーの向きから 0.6rad ずれた所で、1打ごとに 0.15rad ずつ同じ向きへ回る。
//   玉にも線にも ×0.6・痺れ +2。8打(激昂 12打)。叩いている間は動かない
const RAIJIN_DRUM = { cy: -2, r: 19 }; // 雷神の絵の太鼓の輪(体の中心からの上下のずれ・半径。太鼓 8つは真上から時計回りに 45° おき。art.js の絵・神鳴りの溜めの描画と合わせる)
function raijinRing(e, ai) {
  const n = ai.enraged ? 12 : 8, beat = i => Math.floor(i / 4) * 1.75 + [0, 0.5, 1, 1.25][i % 4];
  const a0 = Math.atan2(P.y - e.y, P.x - e.x), sg = Math.random() < 0.5 ? 1 : -1;
  ai.act = 'ring';
  for (let i = 0; i < n; i++) later(ai, beat(i), () => {
    e.spr = 'raijin2'; e.sq = 0.88; AudioMan.thump(i % 4 !== 2); AudioMan.zap(); // 「ドドン」の「ド」だけ軽い音
    later(ai, 0.12, () => { e.spr = 'raijin'; });
    ringShot(e, a0 + sg * (0.6 + i * 0.15));
  });
  later(ai, beat(n - 1) + 0.5, () => { e.spr = 'raijin'; ai.act = null; ai.busy = 0.8; });
  hint('raijin_ring', _t('雷鼓の輪'), _t('太鼓の拍ごとに雷の輪が広がる。切れ目は 1か所で、拍ごとに少しずつ回る'));
}
// 雷鼓の輪の 1打: 太鼓の輪から玉 8つを外へ。ga = 切れ目の向き(玉 7 と玉 0 の間はつながない)
function ringShot(e, ga) {
  const D = RAIJIN_DRUM, cx = e.x, cy = e.y - e.jz + D.cy, th = ga + Math.PI / 8, orbs = [];
  for (let k = 0; k < 8; k++) {
    const a = th + TAU / 8 * k;
    orbs.push({ kind: 'tnet', x: cx + Math.cos(a) * D.r, y: cy + Math.sin(a) * D.r, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55, dmg: e.dmg * 0.6 * (S.eatk ?? 1), numb: 2, life: 5, t: 0, r: 3 * CHAOS.area });
  }
  for (let k = 0; k < 7; k++) orbs[k].nx = orbs[k + 1];
  eprojs.push(...orbs);
  addRing(cx, cy, D.r + 4, '#ffd27a', { r0: D.r - 4, life: 0.2 }); // 太鼓の輪が鳴る
}
// 雷の檻: プレイヤーのまわり(四隅 55)に雷柱 4本(壊せる物・HP 各 8%)。0.4秒後に隣どうしが雷の線でつながり(触れると 0.5秒ごとに ×0.8・痺れ +2)、
//   3秒後に檻の中(円 半径 60。柱より少し外まで届く)へ大落雷 ×1.5・痺れ +6。柱を 1本壊すと、その柱から出る線が消えて出られる(柱の置き場所も攻撃範囲の倍率で広がる)
function raijinCage(e, ai) {
  const cx = P.x, cy = P.y, a0 = rand(0, TAU), D = 55 * CHAOS.area, ps = [];
  for (let k = 0; k < 4; k++) { const pa = a0 + TAU / 4 * k; ps.push(spawnObj(e, 'tpillar', cx + Math.cos(pa) * D, cy + Math.sin(pa) * D, { pct: 0.08, r: 5, life: 3.6 })); }
  addHazard('tcage', cx, cy, { r: 60, dur: 3.6, ps, owner2: e, dmg: e.dmg, tick: 0 });
  pushWarn({ kind: 'circle', x: cx, y: cy, r: 60, t: 0, life: 3, owner: e }); // 檻の中の大落雷
  e.spr = 'raijin2'; e.sq = 1.2; later(ai, 0.2, () => { e.spr = 'raijin'; });
  AudioMan.zap(); AudioMan.charge(3);
  later(ai, 3, () => raijinStrike(e, cx, cy, 60, 1.5, 6, { big: true }));
  hint('raijin_cage', _t('雷の檻'), _t('雷柱を 1本壊すと線が切れて、檻から出られる'));
}
// 雷の網(弾): 雷の玉 6発を扇に撃つ(±0.5rad・速さ 70・4秒)。となりどうしは稲妻でつながったまま広がる。玉にも線にも ×0.6・痺れ +2(網の目はくぐれない。回避で抜けるか端を回る)
//   玉が消える(当たる・静電気で防ぐ)と、その玉につながる線も消える
function raijinNet(e, ai, a) {
  let prev = null;
  for (let i = 0; i < 6; i++) {
    const aa = a - 0.5 + i * 0.2, p = { kind: 'tnet', x: e.x, y: e.y - 4, vx: Math.cos(aa) * 70, vy: Math.sin(aa) * 70, dmg: e.dmg * 0.6 * (S.eatk ?? 1), numb: 2, life: 4, t: 0, r: 3 * CHAOS.area };
    if (prev) prev.nx = p; // nx: となりの玉(線でつながる)
    eprojs.push(p); prev = p;
  }
  e.spr = 'raijin2'; e.sq = 0.85; later(ai, 0.2, () => { e.spr = 'raijin'; });
  AudioMan.zap(); AudioMan.shoot();
  hint('raijin_net', _t('雷の網'), _t('玉と玉を結ぶ稲妻もくぐれない。回避で抜けるか、端を回る'));
}
// 雷の双玉: 稲妻でつながった 2つの玉(間 56)が、組の真ん中のまわりを回りながら飛ぶ(速さ 55・回る速さ 2.6rad/秒・5秒)。3組(激昂 5組)を扇に(±0.65rad。激昂 ±0.6rad)、となりの組は逆に回る。
//   玉にも線にも ×0.6・痺れ +2。棒が進む向きにそろって細く見える時のすき間を抜ける
function raijinPair(e, ai, a) {
  const das = ai.enraged ? [-0.6, -0.3, 0, 0.3, 0.6] : [-0.65, 0, 0.65], x0 = e.x, y0 = e.y - e.jz - 4;
  das.forEach((da, i) => {
    const s = { x0, y0, vx: Math.cos(a + da) * 55, vy: Math.sin(a + da) * 55, a0: rand(0, TAU), w: i % 2 ? -2.6 : 2.6, R: 28 * CHAOS.area };
    const orb = ph => ({ kind: 'tnet', x: x0 + Math.cos(s.a0 + ph) * s.R, y: y0 + Math.sin(s.a0 + ph) * s.R, vx: 0, vy: 0, dmg: e.dmg * 0.6 * (S.eatk ?? 1), numb: 2, life: 5, t: 0, r: 3 * CHAOS.area, spin: s, ph });
    const A = orb(0), B = orb(Math.PI); A.nx = B; eprojs.push(A, B);
  });
  e.spr = 'raijin2'; e.sq = 0.85; later(ai, 0.2, () => { e.spr = 'raijin'; });
  AudioMan.zap(); AudioMan.shoot();
  hint('raijin_pair', _t('雷の双玉'), _t('稲妻でつながった 2つの玉が回りながら飛んでくる。棒が細く見える時のすき間を抜ける'));
}
// 回る玉(雷の双玉): 組の真ん中がまっすぐ進み、玉はそのまわりを回る(位置は飛んでいる時間から決める。時の歪み・巻き戻しにもそのまま従う)
function spinOrb(p) { const s = p.spin, a = s.a0 + s.w * p.t + p.ph; p.x = s.x0 + s.vx * p.t + Math.cos(a) * s.R; p.y = s.y0 + s.vy * p.t + Math.sin(a) * s.R; }
// 風神の風: 風神の幻が風上に現れ、5秒 一定の向きの風(毎秒 40。ダッシュなら逆らえる)で押す。1秒後と 3秒後に、風下(プレイヤーから 70)に
//   風と直角の落雷の列(円 半径 26 が 5つ・40 おき。1秒の予告、0.12秒おきに落ちる)→ 各 ×0.8・痺れ +2
function raijinGale(e, ai) {
  const wa = rand(0, TAU), c = Math.cos(wa), s = Math.sin(wa);
  P.current = { vx: c * 40, vy: s * 40, t: 5, cols: ['#c8f0d8', '#e8fff0', '#88b898'] };
  bfx.push({ kind: 'fujin', x: P.x, y: P.y, a: wa, t: 0, life: 5.2 });
  for (const t0 of [1, 3]) later(ai, t0, () => {
    const bx = P.x + c * 70, by = P.y + s * 70;
    for (let k = 0; k < 5; k++) {
      const x = bx - s * (k - 2) * 40, y = by + c * (k - 2) * 40, T = 1 + k * 0.12;
      pushWarn({ kind: 'circle', x, y, r: 26, t: 0, life: T, owner: e });
      later(ai, T, () => raijinStrike(e, x, y, 26, 0.8, 2));
    }
  });
  AudioMan.charge(1); shake(4);
  hint('raijin_gale', _t('風神の風'), _t('風に押される。風下に雷の列が落ちる。ダッシュなら風に逆らえる'));
}
// 神鳴り(激昂): 激昂して 5秒後から 15秒ごとに、2秒 溜める。雷神は撥を高く掲げ、背中の太鼓が 0.25秒おきに 1つずつ光り(1つごとに音が鳴る)、画面の端が暗くなり、プレイヤーの頭上に雷雲が渦を巻く。
//   太鼓が 8つ光った次の拍(2秒)に、プレイヤーのいる所へ巨大な稲妻 ×1.2・痺れ +20。予告の円(半径 60)は落ちる 0.1秒前だけ。落ちる時は雷神の側で読む:
//   太鼓のカウントダウンと、掲げた撥の先へイージングで収束する稲妻の輪(render.js。収束した瞬間に落ちる)。0.15秒前に雷神の頭上に赤いきらめきと合図の音
function raijinGod(e, ai) {
  ai.act = 'god'; ai.godLit = 0; ai.godT0 = S.time; e.spr = 'raijin3'; e.sq = 1.2; // godT0: 溜めの始まり(収束する稲妻の輪の時計)
  for (let k = 0; k < 8; k++) later(ai, k * 0.25, () => { ai.godLit = k + 1; AudioMan.thump(true); shake(1 + k * 0.5); });
  later(ai, 1.85, () => { fxGlint(e.x, e.y - e.r - 12 - e.jz, 11, '#ff3b5c', { foe: true, life: 0.25 }); AudioMan.cue(); }); // 落ちる直前の合図(雷神の頭上)
  later(ai, 1.9, () => { ai.godAt = { x: P.x, y: P.y }; pushWarn({ kind: 'circle', x: P.x, y: P.y, r: 60, t: 0, life: 0.1, owner: e }); });
  later(ai, 2, () => { // 収束した力を撥の先から空へ放ち、プレイヤーのいる所へ落とす
    const fx = e.x, fy = e.y - e.jz - 23, at = ai.godAt;
    bfx.push({ kind: 'ebolt', x: fx, y: fy, x1: fx + rand(-8, 8), y1: Math.min(fy - 120, cam.y - 20), t: 0, life: 0.3, w: 3, jit: 6 }); burst(fx, fy, 24, THUN, { sp: 90, glow: true, life: 0.4 });
    raijinStrike(e, at.x, at.y, 60, 1.2, 20, { big: true }); hitstop(0.08); ai.godLit = 0; e.spr = 'raijin2'; e.sq = 0.8;
  });
  later(ai, 2.5, () => { e.spr = 'raijin'; ai.act = null; ai.godAt = null; ai.busy = 1; });
  AudioMan.drumroll(2); AudioMan.warning();
  hint('raijin_god', _t('神鳴り'), _t('背中の太鼓が全部光った次の拍に、巨大な雷が落ちる。その拍で回避する'));
}
