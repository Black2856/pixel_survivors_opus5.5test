// bosses/escorp.js — ボス: 大蠍: プレイヤーへ寄る。★流砂の渦(引き寄せ・砂塵)/ はさみの挟撃(捕まると動けない → 尾の一突き)/ 尾の連突き / 砂かけ(砂塵の散弾)/ 砂潜り / 激昂: 大地の挟撃
'use strict';

// ---------- 大蠍: プレイヤーへ寄る。★流砂の渦(引き寄せ・砂塵)/ はさみの挟撃(捕まると動けない → 尾の一突き)/ 尾の連突き / 砂かけ(砂塵の散弾)/ 砂潜り / 激昂: 大地の挟撃 ----------
function escorpAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (ai.act === 'vortex' || ai.act === 'burrow' || ai.act === 'stab') { e.spr = 'escorp'; return; } // 渦の中心・砂の中・尾を砂に刺している間は動かない(終わりは技の later)
  if (ai.act === 'grab') { // はさみの挟撃: 0.6秒の予告 → 帯の中にいたら捕まえる → 2秒 動けない(回避で抜けられる)→ 尾の一突き ×1.2
    const g = ai.tl; g.t += dt;
    if (!g.done && g.t >= 0.6) {
      g.done = true;
      const tip = { x: e.x + Math.cos(g.a) * 70 * CHAOS.area, y: e.y + Math.sin(g.a) * 70 * CHAOS.area };
      if (!P.dead && !(P.invT > 0) && inLine(e.x, e.y, g.a, 80, 30)) {
        P.rootT = 2.1; ai.grabT = 2; bfx.push({ kind: 'egrab', x: e.x, y: e.y, owner: e, t: 0, life: 2.1, track: f => { if (!(P.rootT > 0)) f.t = f.life; } });
        burst(P.x, P.y - 2, 14, [...SAND, '#2e2622'], { sp: 70, life: 0.35 }); shake(4); AudioMan.crush();
        hint('escorp_grab', _t('はさみの挟撃'), _t('捕まると動けない。回避で抜け出せる'));
      } else { ai.act = null; burst(tip.x, tip.y, 10, SAND, { sp: 60, life: 0.3 }); }
      AudioMan.slash(); e.sq = 0.8; slashes.push({ x: e.x, y: e.y, a: g.a, r: 80 * CHAOS.area, t: 0, life: 0.2, flip: 0, span: 0.5, pal: SWING_PAL.enemy, enemy: true });
    }
    if (g.done && ai.act === 'grab') {
      if (!(P.rootT > 0)) { ai.act = null; ai.grabT = 0; } // 回避で抜けた
      else if ((ai.grabT -= dt) <= 0) {
        P.rootT = 0; ai.act = null; hurtPlayer(e.dmg * 1.2);
        bfx.push({ kind: 'estab', x: P.x, y: P.y, t: 0, life: 0.35 }); burst(P.x, P.y - 4, 18, ['#ffb040', '#ffd27a', '#2e2622'], { sp: 90, life: 0.4 }); shake(5); hitstop(0.04); AudioMan.slash(); AudioMan.thud();
      }
    }
    return;
  }
  if (dist > 34) { e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt; e.spr = Math.floor(e.t * 6) % 2 ? 'escorp' : 'escorp2'; } else e.spr = 'escorp'; // 34 まで近づくと止まる
  if (Math.random() < dt * 6) part(e.x + rand(-14, 14), e.y + e.r * 0.7, rand(-10, 10), -rand(4, 12), 0.5, pick(SAND), { g: 60, drag: 1 }); // 歩く砂ぼこり
  ai.vortex -= dt * R; ai.grab -= dt * R; ai.stab -= dt * R; ai.sand -= dt * R; ai.burrow -= dt * R; if (ai.enraged) ai.pinch -= dt * R;
  if (ai.enraged && ai.pinch <= 0) { ai.pinch = 11; earthPincer(e, ai); }
  else if (ai.vortex <= 0) { ai.vortex = ai.enraged ? 12 : 16; scorpVortex(e, ai); }
  else if (ai.grab <= 0 && dist < 90) { ai.grab = ai.enraged ? 4.5 : 6; scorpGrab(e, ai, a); }
  else if (ai.burrow <= 0) { ai.burrow = ai.enraged ? 9 : 12; scorpBurrow(e, ai); }
  else if (ai.stab <= 0 && dist < 160) { ai.stab = ai.enraged ? 5.5 : 7; scorpStab(e, ai); }
  else if (ai.sand <= 0 && dist < 140) { ai.sand = ai.enraged ? 4 : 5; windup(e, 0.4, () => scorpSand(e, ai)); }
}
// ★流砂の渦: 0.5秒の予告(大蠍のまわり 半径 150(激昂 180)の砂が渦を巻きはじめる)→ 5秒 流砂。大蠍へ引かれ(毎秒 30(激昂 36)。回避の無敵中は引かれない)、中にいると 1秒ごとに砂塵 +1
//   中心(半径 45)は 0.5秒ごとにはさみが鳴る ×0.6。大蠍は渦の中心で動かない
function scorpVortex(e, ai) {
  const R0 = ai.enraged ? 180 : 150;
  ai.act = 'vortex'; e.sq = 1.2;
  addHazard('quicksand', e.x, e.y, { r: R0, dur: 5.5, tele: 0.5, pull: ai.enraged ? 36 : 30, core: 45, owner2: e, dmg: e.dmg, dustT: 1, snapT: 0 });
  pushWarn({ kind: 'circle', x: e.x, y: e.y, r: R0, t: 0, life: 0.5, noFill: true, owner: e }); // 渦の広さ(縁だけ)
  pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 45, t: 0, life: 0.5, owner: e }); // はさみの届く中心
  AudioMan.charge(0.5); AudioMan.sand(); shake(4);
  later(ai, 5.5, () => { if (ai.act === 'vortex') ai.act = null; });
  hint('escorp_vortex', _t('流砂の渦'), _t('大蠍へ引き寄せられ、砂塵がたまる。中心のはさみに近づくな'));
}
// はさみの挟撃: 0.6秒 前方の帯(長さ 80・幅 30。大蠍について動かない)→ 捕まえる(つづきは escorpAI)
function scorpGrab(e, ai, a) {
  ai.act = 'grab'; ai.tl = { t: 0, a, done: false };
  pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: 80, w: 30, t: 0, life: 0.6, owner: e });
  AudioMan.charge(0.6); e.sq = 1.1;
}
// 尾の連突き: 尾を砂に刺し(1.65秒(激昂 2.65秒)動かない)、プレイヤーの足元に 円 半径 25 を 0.5秒おきに 3回(激昂 5回。毎回置き直す)。各 0.6秒の予告 → 砂から針が突き出す ×0.9
function scorpStab(e, ai) {
  const n = ai.enraged ? 5 : 3;
  ai.act = 'stab'; e.sq = 1.15; AudioMan.charge(0.6);
  burst(e.x - 8, e.y, 14, SAND, { sp: 60, up: 20, g: 200, life: 0.4 });
  for (let i = 0; i < n; i++) later(ai, i * 0.5, () => {
    const x = P.x, y = P.y;
    pushWarn({ kind: 'circle', x, y, r: 25, t: 0, life: 0.6, owner: e });
    later(ai, 0.6, () => {
      hitCircle(x, y, 25, e.dmg * 0.9);
      bfx.push({ kind: 'estab', x, y, t: 0, life: 0.35 });
      burst(x, y, 16, SAND, { sp: 80, up: 30, g: 220, life: 0.4 }); addRing(x, y, 25 * CHAOS.area, '#ffb040', { life: 0.25 }); shake(3); AudioMan.slash(); AudioMan.thud();
    });
  });
  later(ai, (n - 1) * 0.5 + 0.65, () => { if (ai.act === 'stab') ai.act = null; }); // 最後の一突きのあとまで
}
// 砂かけ: 前方へ砂の散弾 9発(±0.45rad・速さ 100〜140・1.5秒で消える)。×0.5・1発につき砂塵 +1
function scorpSand(e, ai) {
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  for (let i = 0; i < 9; i++) Object.assign(eball(e.x + Math.cos(a) * 12, e.y + 4, a + rand(-0.45, 0.45), rand(100, 140), e.dmg * 0.5, 'sandshot'), { dust: 1, life: 1.5, r: 2.5 * CHAOS.area });
  burst(e.x + Math.cos(a) * 14, e.y + 4, 24, SAND, { sp: 110, life: 0.4, drag: 2 }); e.sq = 0.8; AudioMan.sand(); AudioMan.dash();
}
// 砂潜り: 砂に潜り(0.4秒)、砂の中を進んで(盛り上がった砂が動く)、プレイヤーから 60〜90 の所に出る(出る所に 円 半径 30 の予告 1.2秒)。出る所の砂煙で砂塵 +2(ダメージはない)
function scorpBurrow(e, ai) {
  const pa = rand(0, TAU), pr = rand(60, 90), tx = P.x + Math.cos(pa) * pr, ty = P.y + Math.sin(pa) * pr;
  ai.act = 'burrow'; e.sq = 0.6;
  burst(e.x, e.y, 30, SAND, { sp: 90, up: 40, g: 200, life: 0.5 }); shake(3); AudioMan.thud(); AudioMan.sand();
  pushWarn({ kind: 'circle', x: tx, y: ty, r: 30, t: 0, life: 1.2, owner: e });
  later(ai, 0.4, () => { e.flying = e.hidden = e.air = true; bfx.push({ kind: 'emound', x: e.x, y: e.y, x0: e.x, y0: e.y, x1: tx, y1: ty, t: 0, life: 0.8 }); });
  later(ai, 1.2, () => {
    e.x = tx; e.y = ty; e.flying = e.hidden = e.air = false; ai.act = null; e.sq = 0.6;
    if (!P.dead && d2(tx, ty, P.x, P.y) < Math.pow(30 * CHAOS.area + 3, 2)) dustPlayer(2);
    burst(tx, ty, 40, SAND, { sp: 130, up: 60, g: 200, life: 0.6 }); addRing(tx, ty, 30 * CHAOS.area, '#e8c88a', { w: 2, life: 0.35 }); shake(6); AudioMan.boom();
    for (let i = 0; i < 16; i++) part(tx + rand(-20, 20), ty + rand(-10, 10), rand(-20, 20), -rand(10, 40), rand(0.8, 1.4), pick(SAND), { drag: 1.5, sz: pick([2, 3]) }); // 砂煙
  });
  hint('escorp_burrow', _t('砂潜り'), _t('出てくる所の砂煙を浴びると砂塵がたまる'));
}
// 大地の挟撃(激昂): プレイヤーの左右(大蠍から見て横)の砂から大きなはさみが出て、両側から 1秒かけて中央へ閉じる(帯 長さ 140・幅 40)→ ×1.4。前後へ逃げる
function earthPincer(e, ai) {
  const sa = Math.atan2(P.y - e.y, P.x - e.x) + Math.PI / 2, cx = P.x, cy = P.y, D = 70, x0 = cx - Math.cos(sa) * D, y0 = cy - Math.sin(sa) * D;
  pushWarn({ kind: 'line', x: x0, y: y0, a: sa, len: D * 2, w: 40, t: 0, life: 1, owner: e });
  bfx.push({ kind: 'epinch', x: cx, y: cy, a: sa, D: D * CHAOS.area, t: 0, life: 1.3 });
  burst(cx - Math.cos(sa) * D, cy - Math.sin(sa) * D, 16, SAND, { sp: 70, up: 30, g: 200 }); burst(cx + Math.cos(sa) * D, cy + Math.sin(sa) * D, 16, SAND, { sp: 70, up: 30, g: 200 });
  AudioMan.charge(1); AudioMan.thud(); shake(4);
  later(ai, 1, () => {
    hitLine(x0, y0, sa, D * 2, 40, e.dmg * 1.4);
    burst(cx, cy, 40, [...SAND, '#ffd27a'], { sp: 140, up: 50, g: 200, life: 0.5 }); bossBlast(cx, cy, 40 * CHAOS.area, Object.assign({ n: 14 }, BFX.escorp)); shake(9); hitstop(0.05); AudioMan.crush(); AudioMan.boom();
  });
  hint('escorp_pinch', _t('大地の挟撃'), _t('左右から大きなはさみが閉じる。前か後ろへ逃げる'));
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
// 流砂の渦(大蠍): 渦を巻く砂(予告の間は薄く)。中心のはさみの届く所は暗く、縁は危険を示す赤
HAZ_DRAW.quicksand = (h, hx, hy, fade, hd) => {
  const { sx, t, warnBlink } = hd;
  const R = Math.round(h.r), on = h.t >= h.tele, k0 = on ? 1 : h.t / h.tele, RC = Math.round(h.core * CHAOS.area);
  sx.globalAlpha = 0.32 * fade * k0; pDisc(sx, hx, hy, R, '#a8803a');
  sx.globalAlpha = 0.5 * fade * k0; pDisc(sx, hx, hy, RC, '#6a4a22'); sx.globalAlpha = fade * k0;
  for (let k = 0; k < 5; k++) for (let i = 0; i < 70; i++) { const u = i / 70, pa = t * 1.3 + k * TAU / 5 + u * 5, pr = R * (1 - u); if (pr < 6) continue; sx.fillStyle = u > 0.65 ? '#5a4220' : u > 0.3 ? '#c8a060' : '#f0d8a0'; sx.fillRect(Math.round(hx + Math.cos(pa) * pr), Math.round(hy + Math.sin(pa) * pr), 1, 1); }
  if (on) { pCircle(sx, hx, hy, R, warnBlink ? '#ff3b1a' : '#ff8a3d'); pCircle(sx, hx, hy, RC, '#ff3b5c', 2); }
  sx.globalAlpha = 1;
};
