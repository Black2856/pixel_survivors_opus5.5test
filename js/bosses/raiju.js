// bosses/raiju.js — ボス: 雷獣: 距離 100 を保って速く回り込む。★稲妻走り(雷の線が床に残る)/ 瞬雷光(消えて、まわりから続けて突進)/ 放電 / 雷玉 / 激昂: 雷化(12秒 雷の体になり、通った所に雷が残る)
'use strict';

// ---------- 雷獣: 距離 100 を保って速く回り込む。★稲妻走り(雷の線が床に残る)/ 瞬雷光(消えて、まわりから続けて突進)/ 放電 / 雷玉 / 激昂: 雷化(12秒 雷の体になり、通った所に雷が残る) ----------
const THUN = ['#e8e0ff', '#b8a0ff', '#7a5ad8', '#ffffff'];
function raijuAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (ai.trail) raijuTrail(e, ai); // 雷化: 通った所に雷を残す(ほかの技の間も)
  if (ai.act === 'dash') { updRaijuDash(e, ai, dt); return; }
  if (ai.act === 'blink') { updRaijuBlink(e, ai, dt); return; }
  e.spr = (ai.formEnd > S.time ? 'raijuL' : 'raiju') + (Math.floor(e.t * 10) % 2 ? '' : '2'); // 雷化の間は雷の体の絵
  // 距離 100 を保ち、速く横へ回り込む(ときどき向きを変える)
  if ((ai.flip = (ai.flip ?? 2.5) - dt) <= 0) { ai.flip = rand(2, 3.5); ai.side = -(ai.side || 1); }
  const dir = dist > 100 ? a : a + Math.PI, k = Math.abs(dist - 100) > 15 ? 1 : 0.25;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * e.spd * 0.9 * (ai.side || 1)) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * e.spd * 0.9 * (ai.side || 1)) * slow * dt;
  if (Math.random() < dt * 12) part(e.x + rand(-12, 12), e.y + rand(-8, 4), rand(-10, 10), -rand(6, 16), 0.3, pick(THUN), { glow: true, drag: 2 }); // 毛並みの火花
  ai.dash -= dt * R; ai.blink -= dt * R; ai.dis -= dt * R; ai.orb -= dt * R; if (ai.enraged) ai.form -= dt * R;
  if (ai.enraged && ai.form <= 0) { ai.form = 16; raijuForm(e, ai); }
  else if (ai.dash <= 0) { ai.dash = ai.enraged ? 10 : 12; ai.act = 'dash'; ai.dn = ai.enraged ? 4 : 3; raijuDashTele(e, ai); }
  else if (ai.blink <= 0) { ai.blink = ai.enraged ? 8 : 10; raijuBlink(e, ai); }
  else if (ai.dis <= 0) { ai.dis = ai.enraged ? 6 : 8; raijuDischarge(e, ai); }
  else if (ai.orb <= 0) { ai.orb = ai.enraged ? 7 : 9; raijuOrbs(e, ai); }
}
// ★稲妻走り: プレイヤーへ向かう稲妻形の経路(3回折れる帯。幅 = 体の直径)が 0.6秒光る → 0.15秒で駆け抜ける ×1.1・痺れ +3。通った跡は 4秒 雷の線(触れると 0.5秒ごとに ×0.4・痺れ +1)
//   3回(激昂 4回)続ける(0.25秒おき。毎回いまの位置からプレイヤーへ)。雷の線は同時に 6本まで(古いものから消える)
function raijuDashTele(e, ai) {
  const a = Math.atan2(P.y - e.y, P.x - e.x), c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c, sg = Math.random() < 0.5 ? 1 : -1, O = 22;
  const p2 = { x: P.x - c * 30 + nx * O * sg, y: P.y - s * 30 + ny * O * sg }, p3 = { x: P.x + c * 30 - nx * O * sg, y: P.y + s * 30 - ny * O * sg }; // 2つ目と 3つ目の折れ目の真ん中がプレイヤー
  const p0 = { x: e.x, y: e.y }, p1 = { x: (p0.x + p2.x) / 2 - nx * O * sg, y: (p0.y + p2.y) / 2 - ny * O * sg }, p4 = { x: p3.x + c * 40 + nx * O * sg, y: p3.y + s * 40 + ny * O * sg };
  const pts = [p0, p1, p2, p3, p4];
  for (let i = 0; i < 4; i++) { const A = pts[i], B = pts[i + 1]; pushWarn({ kind: 'line', x: A.x, y: A.y, a: Math.atan2(B.y - A.y, B.x - A.x), len: Math.hypot(B.x - A.x, B.y - A.y), w: e.r * 2, t: 0, life: 0.6, fixed: true, owner: e }); } // 突進の経路(体当たりなので広げない)
  ai.ds = { ph: 'tele', t: 0, pts, hit: false }; e.sq = 0.85; AudioMan.charge(0.6);
  hint('raiju_dash', _t('稲妻走り'), _t('通った跡に雷の線が残る。線に触れると痺れがたまる'));
}
function updRaijuDash(e, ai, dt) {
  const d = ai.ds; d.t += dt;
  if (d.ph === 'tele') { e.flash = Math.sin(d.t * 40) > 0 ? 0.05 : 0; if (d.t >= 0.6) { d.ph = 'run'; d.t = 0; AudioMan.dash(); AudioMan.zap(); } return; }
  if (d.ph === 'run') { // 経路を 0.15秒で駆け抜ける
    const segs = [], tot = d.pts.slice(1).reduce((s, p, i) => { const L = Math.hypot(p.x - d.pts[i].x, p.y - d.pts[i].y); segs.push(L); return s + L; }, 0);
    let at = Math.min(1, d.t / 0.15) * tot, i = 0; while (i < 3 && at > segs[i]) at -= segs[i++];
    const A = d.pts[i], B = d.pts[i + 1], u = Math.min(1, at / (segs[i] || 1)); e.x = lerp(A.x, B.x, u); e.y = lerp(A.y, B.y, u);
    if (!d.hit && d2(e.x, e.y, P.x, P.y) < Math.pow(e.r + 4, 2) && hurtPlayer(e.dmg * 1.1)) { d.hit = true; numbPlayer(3); }
    if (Math.random() < 0.7) part(e.x + rand(-6, 6), e.y + rand(-6, 6), rand(-20, 20), rand(-20, 20), 0.35, pick(THUN), { glow: true, drag: 3 });
    if (d.t >= 0.15) {
      raijuLine(e, d.pts); d.ph = 'gap'; d.t = 0; ai.dn--;
      for (let k = 0; k < 4; k++) bfx.push({ kind: 'ebolt', x: d.pts[k].x, y: d.pts[k].y, x1: d.pts[k + 1].x, y1: d.pts[k + 1].y, t: 0, life: 0.18, w: 2, jit: 3 }); // 駆け抜けた跡が光る
    }
    return;
  }
  if (d.t >= 0.25) { if (ai.dn > 0) raijuDashTele(e, ai); else ai.act = null; } // 次の稲妻走り / 終わり
}
// 雷の線(稲妻走りの跡): 4秒。触れると 0.5秒ごとに ×0.4・痺れ +1。同時に 6本まで(古いものから消える)
function raijuLine(e, pts) {
  const lines = hazards.filter(h => h.kind === 'eline' && h.t < h.dur);
  if (lines.length >= 6) lines[0].t = lines[0].dur;
  addHazard('eline', pts[0].x, pts[0].y, { pts: pts.map(p => ({ x: p.x, y: p.y })), dur: 4, owner2: e, dmg: e.dmg, tick: 0 });
}
// 瞬雷光: 雷を放って消え(攻撃が当たらない)、1秒後からプレイヤーのまわり(120 の所)に現れて 3回(激昂 5回)突進する。突進は 0.2秒おき、それぞれ 0.6秒前に経路の帯
//   (幅 = 体の直径。現れる所からプレイヤーを通って向こう側まで 240)が出る。0.2秒で駆け抜ける ×1.0・痺れ +2。現れる向きは 1回ごとに 2.4rad ずつ回る
//   次の突進まで間があれば消えている(今は駆け抜ける長さと突進の間が同じなので、続けて現れる)
const BLINK = { D: 120, tele: 0.6, run: 0.2, gap: 0.2 }; // 現れる距離・帯の予告・駆け抜ける長さ・突進の間
function raijuBlink(e, ai) {
  const n = ai.enraged ? 5 : 3, f0 = rand(0, TAU), B = BLINK;
  ai.act = 'blink'; ai.bl = { paths: [], i: -1, t: 0, hit: false, n };
  for (let k = 0; k < 9; k++) { const pa = TAU / 9 * k + rand(-0.2, 0.2), L = rand(30, 55); bfx.push({ kind: 'ebolt', x: e.x, y: e.y - 4, x1: e.x + Math.cos(pa) * L, y1: e.y + Math.sin(pa) * L, t: 0, life: 0.2, w: 1, jit: 4, col: '#c8b8ff' }); } // 雷を放って消える
  burst(e.x, e.y, 24, THUN, { sp: 100, glow: true, life: 0.4 }); addFlash(e.x, e.y, 60, '#5a3aa8', 0.3); AudioMan.zap(); AudioMan.dash();
  Object.assign(e, { hidden: true, flying: true, air: true });
  for (let k = 0; k < n; k++) {
    later(ai, 1 + k * B.gap, () => {
      const pa = f0 + k * 2.4, x = P.x + Math.cos(pa) * B.D, y = P.y + Math.sin(pa) * B.D, a = pa + Math.PI;
      ai.bl.paths[k] = { x, y, a, len: B.D * 2 };
      pushWarn({ kind: 'line', x, y, a, len: B.D * 2, w: e.r * 2, t: 0, life: B.tele, fixed: true, owner: e }); // 突進の経路(体当たりなので広げない)
      burst(x, y, 8, THUN, { sp: 50, glow: true, life: 0.3 }); AudioMan.zap();
    });
    later(ai, 1 + B.tele + k * B.gap, () => { const b = ai.bl, p = b.paths[k]; b.i = k; b.t = 0; b.hit = false; e.x = p.x; e.y = p.y; Object.assign(e, { hidden: false, flying: false, air: false }); AudioMan.dash(); });
  }
  later(ai, 1 + B.tele + (n - 1) * B.gap + B.run + 0.05, () => { ai.act = null; ai.bl = null; Object.assign(e, { hidden: false, flying: false, air: false }); });
  hint('raiju_blink', _t('瞬雷光'), _t('消えたあと、まわりから続けて突進してくる。帯の予告を見てよける'));
}
function updRaijuBlink(e, ai, dt) {
  const b = ai.bl, RUN = BLINK.run; if (!b || b.i < 0 || b.t >= RUN) return; // 消えている間 / 駆け抜けたあと
  const p = b.paths[b.i], u0 = Math.min(1, b.t / RUN); b.t += dt; const u = Math.min(1, b.t / RUN);
  const x0 = p.x + Math.cos(p.a) * p.len * u0, y0 = p.y + Math.sin(p.a) * p.len * u0;
  e.x = p.x + Math.cos(p.a) * p.len * u; e.y = p.y + Math.sin(p.a) * p.len * u;
  if (!b.hit && segD2(P.x, P.y, x0, y0, e.x, e.y) < Math.pow(e.r + 4, 2) && hurtPlayer(e.dmg)) { b.hit = true; numbPlayer(2); } // 速いので、この 1コマで通った線で当てる
  for (let k = 0; k < 3; k++) part(lerp(x0, e.x, Math.random()) + rand(-4, 4), lerp(y0, e.y, Math.random()) + rand(-4, 4), rand(-20, 20), rand(-20, 20), 0.3, pick(THUN), { glow: true, drag: 3 });
  if (u >= 1) {
    bfx.push({ kind: 'ebolt', x: p.x, y: p.y, x1: e.x, y1: e.y, t: 0, life: 0.18, w: 2, jit: 3 }); // 駆け抜けた跡が光る
    if (b.i < b.n - 1 && BLINK.gap - RUN > 0.01) Object.assign(e, { hidden: true, flying: true, air: true }); // 次の突進まで間があるときだけ消える(間がないときに消すと 1コマちらつく)
  }
}
// 放電: 0.7秒 毛が逆立つ(自分のまわり 円 半径 80)→ ×1.0・痺れ +4
function raijuDischarge(e, ai) {
  pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 80, t: 0, life: 0.7, owner: e, track: w => { w.x = e.x; w.y = e.y; } });
  windup(e, 0.7, () => {
    if (hitCircle(e.x, e.y, 80, e.dmg)) numbPlayer(4);
    const RR = 80 * CHAOS.area;
    for (let k = 0; k < 9; k++) { const pa = TAU / 9 * k + rand(-0.2, 0.2), L = RR * rand(0.6, 1); bfx.push({ kind: 'ebolt', x: e.x, y: e.y - 4, x1: e.x + Math.cos(pa) * L, y1: e.y + Math.sin(pa) * L, t: 0, life: 0.22, w: 1, jit: 5, col: '#c8b8ff' }); } // 放射する稲妻は芯を淡い紫に(白い線が重なると白く飛ぶ)
    addRing(e.x, e.y, RR, '#b8a0ff', { w: 2, life: 0.35 }); addFlash(e.x, e.y, RR * 1.6, '#5a3aa8', 0.4); shake(7); AudioMan.zap(); AudioMan.boom(); // 光芒は出さない(放射する稲妻と輪で見せる)
  });
}
// 雷玉: プレイヤーのまわり(125 の所に等しい間で 3個、激昂 4個)に雷の玉が現れ、ゆっくり寄る(速さ 22・8秒)。玉の周り 60 に入ると 1秒ごとに小さな稲妻 ×0.4・痺れ +1
function raijuOrbs(e, ai) {
  const n = ai.enraged ? 4 : 3, a0 = rand(0, TAU);
  for (let k = 0; k < n; k++) {
    const pa = a0 + TAU / n * k, x = P.x + Math.cos(pa) * 125, y = P.y + Math.sin(pa) * 125;
    addHazard('torb', x, y, { r: 60, dur: 8, owner2: e, dmg: e.dmg, zapT: 1 + k * 0.33 });
    burst(x, y - 6, 16, THUN, { sp: 60, glow: true, life: 0.4 }); bfx.push({ kind: 'ebolt', x: e.x, y: e.y - 6, x1: x, y1: y - 6, t: 0, life: 0.2, w: 1, jit: 5, col: '#c8b8ff' }); // 雷獣から稲妻が飛んで、玉が現れる
  }
  e.sq = 1.15; AudioMan.zap();
  hint('raiju_orb', _t('雷玉'), _t('玉のまわりに入ると、小さな稲妻が飛んでくる'));
}
// 雷化(激昂): 12秒 体が雷になり、通った所に雷が残る(各点 5秒)。触れると 0.5秒ごとに ×0.2・痺れ +1。雷化の間もほかの技を使う
function raijuForm(e, ai) {
  ai.formEnd = S.time + 12; // 終わる時刻(放電の構えなどで AI が止まっても 12秒で終わる)
  ai.trail = addHazard('etrail', e.x, e.y, { r: 3, dur: 17, pts: [], owner2: e, dmg: e.dmg, tick: 0 });
  burst(e.x, e.y, 30, THUN, { sp: 110, glow: true, life: 0.4 }); addRing(e.x, e.y, 30, '#6a4ac8', { w: 2, life: 0.3 }); shake(4); AudioMan.zap(); AudioMan.charge(0.6);
  hint('raiju_form', _t('雷化'), _t('12秒 体が雷になり、通った所に雷が残る。触れると痺れがたまる'));
}
// 雷化の跡: 6 動くごとに点を足す。消えている間(瞬雷光)は跡を切る(null)。雷化が終わったら跡を切って、点を足すのをやめる
function raijuTrail(e, ai) {
  const h = ai.trail; if (!h) return;
  const pts = h.pts, last = pts[pts.length - 1];
  if (e.hidden || S.time >= ai.formEnd) { if (last) pts.push(null); if (S.time >= ai.formEnd) ai.trail = null; return; }
  if (!last || d2(last.x, last.y, e.x, e.y) > 36) pts.push({ x: e.x, y: e.y, at: S.time });
  if (Math.random() < 0.4) part(e.x + rand(-10, 10), e.y + rand(-8, 4), rand(-15, 15), -rand(10, 30), 0.3, pick(THUN), { glow: true, drag: 2 }); // 雷の体から火花
}
