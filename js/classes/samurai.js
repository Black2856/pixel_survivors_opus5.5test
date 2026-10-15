// classes/samurai.js — サムライ: E スキル(乱れ桜)/ クラスの実装(CLASS_RT.samurai)/ 特性・パッシブ・Q の処理
'use strict';

// 乱れ桜: 構え → 周囲を連続で斬る(移動できる)→ 終了
WEAPON_SKILL.katana = {
  // ステータス画面用(c: StatusUI の値一式 / dmg: 熟練を掛けた武器の威力)
  info(c, dmg) {
    const sk = DATA.weapons.katana.skill, m = c.wm;
    const cd = sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul, one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      _t`構え ${sk.windup}秒 → ${sk.dur}秒間、周り(半径 ${sk.radius})を連続で斬る`,
      _t`1回の威力: 武器の威力 × ${Math.round(sk.pow * 100)}%`,
      _t('使っている間も動ける'),
    ], rows: [
      ['CD', _t`<b>${cd.toFixed(1)}</b> 秒`],
      [_t('斬る回数'), _t`${sk.hits + Math.round(c.cuV('e', 'dur') / 0.15) + (m.eHits || 0)} 回 / ${(sk.dur + c.cuV('e', 'dur')).toFixed(2)} 秒`],
      [_t('1回の威力'), `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, _t`武器の威力 × ${Math.round(sk.pow * 100)}%。攻撃力を掛けた値`],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.katana || {}; // 熟練: 斬る回数・威力
    P.act = Object.assign(ranbuState(ME, clsESkillMul() * (1 + (m.ePow || 0))), { slot: 'e', ph: 'wind', t: 0 });
    playAnim('ranbu', MOTIONS.ranbu.duration(P.act.dur), P.act.dur);
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul); // 熟練のクールダウンは武器スキルにも効く
    const sg = skillCall(sk.name, '#ffb7d5', 'e', { fx: '#e8357f' }); AudioMan.click();
    sigilKeep(sg, P.act.dur); sg.quiet = !hasSp('e', 'pow'); // 斬っている間も足元の陣が回る。終了時に判定があるのは桜吹雪だけなので、通常の終了では光らずに消える
    burst(P.x, P.y, 12, ['#ffb7d5', '#ffffff'], { sp: 40, up: 20, glow: true });
  },
  update(a, dt) {
    const sk = weaponSkill();
    if (a.ph === 'wind') {
      P.moveMul = 0;
      if (a.t < sk.windup) return;
      a.ph = 'spin';
      asMine(() => { // 抜刀: 花びらが渦を巻いて舞い上がり、桜色の光芒が走る
        for (let i = 0; i < 28; i++) { const r = i * TAU / 28, s = rand(90, 150); part(P.x + Math.cos(r) * 5, P.y + Math.sin(r) * 3, Math.cos(r + 1.3) * s, Math.sin(r + 1.3) * s * 0.7 - 20, rand(0.5, 0.8), pick(['#ffb7d5', '#ff8ac0', '#e8357f']), { glow: i % 3 === 0, drag: 2.2 }); }
        fxRays(P.x, P.y - 4, 56, '#a8185a', { n: 12, life: 0.3, core: '#e8357f' });
      });
      return;
    }
    if (hasSp('e', 'dur')) { P.moveMul *= 1.5; P.invT = Math.max(P.invT, 0.05); } // 千本桜
    if (ranbuStep(ME, a, dt)) P.act = null;
  },
  // 分身など自分以外の使い手(構えなし)。乱れ桜の間は使い手のまわりを斬り続ける(返り値の step が true で終わり)
  cast(X, a) {
    const s = ranbuState(X, a.pow);
    if (X.sp('dur')) s.self = true; // 千本桜: 自分の移動速度・無敵(自分への効果は自分に入る)
    return { step: dt => { if (s.self) { P.moveMul *= 1.5; P.invT = Math.max(P.invT, 0.05); } return ranbuStep(X, s, dt); } };
  },
};

// 乱れ桜 1回分の状態(dur: 斬る時間 / hits: 斬る回数 / pow: 威力の倍率)
function ranbuState(X, pow) {
  const sk = DATA.weapons.katana.skill, m = P.wm.katana || {};
  return { dur: sk.dur + X.lv('dur'), hits: sk.hits + Math.round(X.lv('dur') / 0.15) + (m.eHits || 0), n: 0, hitT: 0, u: 0, pow };
}
// 乱れ桜を dt 進める(終わったら true)
function ranbuStep(X, a, dt) {
  const sk = DATA.weapons.katana.skill;
  a.u += dt; a.hitT -= dt;
  if (a.hitT <= 0 && a.n < a.hits) { a.hitT += a.dur / a.hits; a.n++; ranbuHit(X, a); }
  for (let n = dt * 55; Math.random() < n; n--) { // 花びらが使い手のまわりを渦を巻いて舞う
    const r = rand(0, TAU), d = rand(0.35, 1) * sk.radius * X.area, s = rand(60, 110);
    part(X.x + Math.cos(r) * d, X.y + Math.sin(r) * d * 0.8, -Math.sin(r) * s, Math.cos(r) * s * 0.8 - 10, rand(0.5, 0.9), pick(['#ffb7d5', '#ff8ac0', '#ffffff']), { glow: Math.random() < 0.5, drag: 1.2 });
  }
  for (let n = dt * 45 * SET.fxA; Math.random() < n; n--) ranbuCut(X); // あちこちで流れるような斬撃(毎秒 約45本)
  if (a.u < a.dur) return false;
  if (X.sp('pow')) sakuraBurst(X, a); // 桜吹雪
  return true;
}

function ranbuHit(X, a) {
  const sk = DATA.weapons.katana.skill, R = sk.radius * X.area, dmg = wst('katana').dmg * sk.pow * (1 + X.lv('pow')) * a.pow, k0 = S.kills, el = clsNextEl(); // 1回の斬撃 = 1属性
  const x = X.x, y = X.y;
  asMine(() => {
    forEachNear(x, y, R, e => { if (!e.prop) hitEnemy(e, dmg, { src: 'ranbu', ang: Math.atan2(e.y - y, e.x - x), kb: 25, col: '#ffb7d5', noNum: Math.random() < 0.4, el, eHit: true, cl: X.cl }); });
    slashes.push({ x, y, follow: X, a: rand(0, TAU), r: R, t: 0, life: 0.18, flip: Math.random() < 0.5, span: 1.9, pal: SWING_PAL.ranbu }); // 外縁 = 乱れ桜の範囲(全周に当たる。向きはばらばら)
    burst(x + rand(-R, R) * 0.6, y + rand(-R, R) * 0.6, 6, ['#ffb7d5', '#ffffff'], { sp: 70, glow: true, life: 0.3 });
    shake(1.5);
  });
  AudioMan.slash();
  if (X.sp('cd')) X.cdCut(S.kills - k0); // 剣の舞: 撃破1体ごとに CD -1秒
}
// 乱れ桜の演出: 範囲のあちこち(敵がいればその上)で、2点の間を数フレームかけて刻む、流れるような桜色の斬撃(ダメージは ranbuHit)
//   切っ先が少し反った弧を描いて走り、少し遅れて尾がついていく(描画は render.js の drawFlow)
//   配色は彩度の高い濃い桜色(淡い桃色はライト・発光・ブルームが重なると白に飛ぶ)
const RANBU_PAL = { mid: '#a8185a', bright: '#e8357f', glow: '#b8205e' };
function ranbuCut(X) {
  const R = DATA.weapons.katana.skill.radius * X.area, r = Math.sqrt(Math.random()) * R * 0.8, ang = rand(0, TAU);
  let cx = X.x + Math.cos(ang) * r, cy = X.y + Math.sin(ang) * r;
  const tg = Math.random() < 0.6 ? nearestEnemy(cx, cy, 22) : null;
  if (tg) { cx = tg.x; cy = tg.y; }
  const a = rand(0, TAU), ca = Math.cos(a), sa = Math.sin(a), L = rand(16, 30) * X.area, run = rand(0.07, 0.11); // run: 切っ先が走る時間(4〜7フレーム)
  const s = { flow: true, a, x0: cx - ca * L, y0: cy - sa * L, x1: cx + ca * L, y1: cy + sa * L, nx: -sa, ny: ca, bulge: L * 2 * rand(0.1, 0.22) * (Math.random() < 0.5 ? -1 : 1),
    len: L * 2, t: 0, run, lag: run * 0.55, fade: 0.1, life: run * 1.55 + 0.1, w: rand(1.6, 2.4), pal: RANBU_PAL };
  s.ev = [{ at: run, fn: () => asMine(() => { // 走り抜けた先に花びら
    for (let i = 0; i < 2; i++) part(s.x1, s.y1, ca * rand(20, 80) + rand(-20, 20), sa * rand(20, 80) + rand(-20, 20), rand(0.3, 0.6), pick(['#ffb7d5', '#ff8ac0', '#ffffff']), { glow: true, drag: 3 });
  }) }];
  slashes.push(s);
}
function sakuraBurst(X, a) {
  const sk = DATA.weapons.katana.skill, R = sk.burstR * X.area, dmg = wst('katana').dmg * sk.burst * (1 + X.lv('pow')) * a.pow, x = X.x, y = X.y;
  asMine(() => {
    forEachNear(x, y, R, e => { if (!e.prop) hitEnemy(e, dmg, { src: 'ranbu', ang: Math.atan2(e.y - y, e.x - x), kb: 120, col: '#ff8ac0', eHit: true, cl: X.cl }); });
    addRing(x, y, R, '#ffb7d5', { w: 3, life: 0.5 }); addRing(x, y, R * 0.6, '#ffffff', { w: 2, life: 0.35 });
    addFlash(x, y, R * 2, '#ffb7d5', 0.5); shockAt(x, y, 1.6, 0.9);
    burst(x, y, 70, ['#ffb7d5', '#ff8ac0', '#ffffff'], { sp: 170, glow: true, life: 0.8, drag: 1.5 });
    fxRays(x, y - 4, R * 1.3, '#a8185a', { n: 18, life: 0.42, core: '#e8357f' }); // 濃い桜色(淡い桃色は白く飛ぶ)
    hitstop(0.06); shake(8); screenFlash(0.3 * SET.fxA, '#ffb7d5');
  });
  AudioMan.boom(); AudioMan.impact();
}

// 残心の攻撃力: 気迫の値(未取得なら基本値)+ クラスLv8
const zanshinAtk = () => cuV('passive', 'kihaku', DATA.classes.samurai.params.zanshinAtk) + (P.lvFx.zanshinAtk || 0);

CLASS_RT.samurai = {
  skills: ['q'], // 実装済みのクラススキル(強化ツリーの need と対応)
  init() {
    const c = DATA.classes.samurai.params;
    P.ki = 0; P.kiMax = c.kiMax; P.kiWin = 0; P.kiWinT = 0;
    P.guard = false; P.guardT = 0; P.breakT = 0; P.zanshinT = 0;
  },
  update(dt) {
    const c = DATA.classes.samurai.params;
    P.kiWinT -= dt; if (P.kiWinT <= 0) P.kiWin = 0;
    P.zanshinT -= dt; P.breakT -= dt;
    P.kiMax = c.kiMax + cuV('trait', 'zan'); // 残気: 最大値アップ
    P.atkSpd = hasSp('trait', 'juu') && kiHigh() ? 1.25 : 1; // 明鏡止水: 剣気100以上の間 攻撃速度 +25%
    // 見切り(Space 長押しでガード)。構えた瞬間にスタミナ guardCost を消費する(連打でジャストを狙いやすくしないため)
    // 押し直すまで再び構えない / スタミナ不足・ガードブレイク中・スキル中は構えられない
    const held = defHeld();
    if (held && !P.guard && !P.guardHeld && P.breakT <= 0) {
      if (P.sta >= c.guardCost) { staUse(c.guardCost); P.guard = true; P.guardT = 0; AudioMan.click(); }
      else { addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
    }
    P.guardHeld = held;
    if (!held && P.guard) P.guard = false;
    if (P.guard) P.guardT += dt;
    // 身軽: 残心中の移動速度アップ(背水で2倍)
    P.moveMul = (P.guard ? c.guardSlow : 1) * (P.zanshinT > 0 ? 1 + cuV('passive', 'migaru') * zanshinK() : 1);
  },
  // 被弾: ガード中ならスタミナで受ける。受けきれた場合は null(HPは減らない)
  onHurt(dmg) {
    const c = DATA.classes.samurai.params;
    if (P.breakT > 0) return dmg * (1 + c.breakDmg);
    if (!P.guard) {
      let k = 1;
      if (hasSp('trait', 'juu') && kiHigh()) k *= 0.8;  // 明鏡止水
      return dmg * k;
    }
    P.zanshinT = c.zanshinT + cuV('passive', 'jizoku'); // 残心: 防御スキルで攻撃を受けた後、攻撃力アップ
    if (P.guardT <= c.parryWin + (P.lvFx.parryWin || 0)) { samuraiParry(); return null; }
    staUse(Math.max(1, Math.round((dmg - P.armor) * (1 - P.dr))), DATA.player.staLock); // 受けるはずだったダメージ分
    burst(P.x, P.y - 4, 8, ['#9ff7ff', '#ffffff'], { sp: 60, glow: true, life: 0.25 });
    AudioMan.hit(); shake(2);
    if (P.sta <= 0) { // ガードブレイク
      P.guard = false; P.breakT = c.breakT;
      UI.announce('GUARD BREAK', ''); AudioMan.hurt(); shake(6);
      addRing(P.x, P.y, 26, '#ff3b5c', { w: 2, life: 0.4 });
    }
    P.ifr = P.iframe * 0.5;
    return null;
  },
  // 通常攻撃(メイン武器)が命中: 1体につき剣気 +kiHit(1回の攻撃 = 0.15 秒以内の獲得は kiHitCap まで)
  onMainHit() {
    const c = DATA.classes.samurai.params;
    if (P.kiWinT <= 0) { P.kiWinT = 0.15; P.kiWin = 0; }
    if (P.kiWin >= c.kiHitCap) return;
    P.kiWin += c.kiHit; kiAdd(c.kiHit);
  },
  onKill() {
    if (hasSp('passive', 'jizoku') && P.zanshinT > 0) P.zanshinT = DATA.classes.samurai.params.zanshinT + cuV('passive', 'jizoku'); // 常在戦場
  },
  // 無尽: E スキルでも剣気を全て消費し、剣気 × 0.5% だけ威力アップ
  eMul() {
    if (!hasSp('trait', 'ren') || P.ki <= 0) return 1;
    const k = 1 + P.ki * 0.005;
    addFloat(P.x, P.y - 34, _t`剣気 ${Math.floor(P.ki)} 解放`, '#ff5d73', 1, -20);
    P.ki = 0;
    return k;
  },
  atkBonus() {
    const c = DATA.classes.samurai.params;
    return (kiHigh() ? cuV('trait', 'juu', c.kiFullAtk) : 0) + (P.zanshinT > 0 ? zanshinAtk() * zanshinK() : 0);
  },
  // 居合・朧月(Q): 構え → 突進して通過した敵を斬る。剣気を全て消費し、消費量で威力が上がる
  qStart() {
    const q = DATA.classes.samurai.q, a = aimDir(q.dist * 1.6);
    const D = q.dist * (1 + cuV('q', 'reach')), full = kiHigh();
    // 一閃(演出): 構えの間に周りが暗くなり刃筋が点線で走る → 突進と同時に切っ先が走る → 遅れて炸裂(world.js の makeCut)
    const cut = makeCut(P.x, P.y, P.x + Math.cos(a) * D, P.y + Math.sin(a) * D, { omen: q.windup, run: q.windup + q.dash, hit: q.windup + q.dash + 0.08, life: 0.9, wk: full ? 1.2 : 0.85, late: true });
    cut.ev.push({ at: q.windup, fn: () => { AudioMan.cut(); GFX.fx.aberr = Math.max(GFX.fx.aberr, (full ? 1 : 0.7) * SET.fxA); } }, { at: q.windup + q.dash, fn: () => cutSpark(cut, full ? 26 : 16) });
    P.act = { slot: 'q', ph: 'wind', t: 0, a, ki: P.ki, x0: P.x, y0: P.y, hits: new Set(), back: false, cut };
    AudioMan.cutDraw();
    if (Math.cos(a) !== 0) P.facing = Math.cos(a) < 0 ? -1 : 1;
    playAnim('iai', MOTIONS.iai.dur);
    slowmo(0.35, 0.22);
    skillCall(q.name, '#ff5d73', 'q'); AudioMan.click();
    if (kiHigh()) { addRing(P.x, P.y, 22, '#ff3b5c', { w: 2, life: 0.35 }); burst(P.x, P.y, 20, ['#ff3b5c', '#ffd0d8'], { sp: 50, up: 20, glow: true }); }
  },
  qUpdate(a, dt) {
    const q = DATA.classes.samurai.q, reach = 1 + cuV('q', 'reach');
    P.moveMul = 0;
    if (a.ph === 'wind') {
      if (a.t < q.windup) return;
      // 抜刀: 剣気を全て消費して突進
      a.ph = 'dash'; a.t0 = a.t; a.ki = P.ki; P.ki = 0;
      P.invT = Math.max(P.invT, q.dash + 0.15);
      if (hasSp('q', 'reach')) S.decoy = { x: P.x, y: P.y, t: 5 }; // 空蝉: 開始地点に分身
      AudioMan.dash(); shake(2);
      return;
    }
    if (a.ph === 'dash') {
      const sp = q.dist * reach / q.dash, dir = a.back ? a.a + Math.PI : a.a;
      P.x += Math.cos(dir) * sp * dt; P.y += Math.sin(dir) * sp * dt;
      forEachNear(P.x, P.y, q.width * reach, e => { if (!e.prop && !e.dead) a.hits.add(e); });
      const la = P.after && P.after[P.after.length - 1]; // 残像は 6 ドットごとに残す(重なって白い塊にならないように)
      if (!la || d2(la.x, la.y, P.x, P.y) > 36) P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0, f: P.facing }]).slice(-6);
      if (a.t - a.t0 < q.dash) return;
      iaiStrike(a);
      if (hasSp('q', 'cd') && !a.back) { // 燕返し: 元の位置へ戻りながらもう一度斬る(予兆なし)
        a.back = true; a.hits = new Set(); a.t0 = a.t; a.x0 = P.x; a.y0 = P.y;
        const D = q.dist * reach, full = a.ki >= DATA.classes.samurai.params.kiFull;
        a.cut = makeCut(P.x, P.y, P.x - Math.cos(a.a) * D, P.y - Math.sin(a.a) * D, { omen: 0, run: q.dash, hit: q.dash + 0.08, life: 0.7, wk: full ? 1.1 : 0.75, late: true, nodim: true });
        a.cut.ev.push({ at: q.dash, fn: () => cutSpark(a.cut, 12) });
        AudioMan.cut();
        return;
      }
      a.ph = 'rec'; a.t0 = a.t;
      return;
    }
    if (a.t - a.t0 >= q.recover) P.act = null; // 残心の硬直
  },
  // HUD 用: クラスリソース / スキル
  res: () => ({ kind: 'blade', label: _t('剣気'), v: P.ki, max: P.kiMax }),
  staBroken: () => P.breakT > 0,
  // HUD 用: いま効いている状態。t / max は残り時間(無期限なら省略)
  statuses() {
    const c = DATA.classes.samurai.params, out = [];
    if (P.zanshinT > 0) {
      const k = zanshinK(), mv = cuV('passive', 'migaru') * k;
      out.push({ id: 'zanshin', glyph: '残', name: _t('残心') + (k > 1 ? _t('(背水)') : ''), fx: _t`攻撃力 +${Math.round(zanshinAtk() * k * 100)}%` + (mv ? _t` 移動 +${Math.round(mv * 100)}%` : ''), t: P.zanshinT, max: c.zanshinT + cuV('passive', 'jizoku'), kind: 'buff' });
    }
    if (kiHigh()) out.push({ id: 'kiHigh', glyph: '気', name: hasSp('trait', 'juu') ? _t('明鏡止水') : _t('剣気解放'), fx: _t`攻撃力 +${Math.round(cuV('trait', 'juu', c.kiFullAtk) * 100)}%` + (hasSp('trait', 'juu') ? _t(' 攻撃速度 +25% 被ダメージ -20%') : ''), kind: 'buff' });
    if (P.breakT > 0) out.push({ id: 'break', glyph: '崩', name: _t('ガードブレイク'), fx: _t`ガード不可 被ダメージ +${Math.round(c.breakDmg * 100)}%`, t: P.breakT, max: c.breakT, kind: 'debuff' });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.samurai.q.name, glyph: '居' }),
  // ステータス画面用: 特性・パッシブ・Q・Space
  info(c) {
    const S2 = DATA.classes.samurai, q = S2.q, p = S2.params, k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0);
    const zAtk = c.cuV('passive', 'kihaku', p.zanshinAtk) + (c.lvFx.zanshinAtk || 0), zT = p.zanshinT + c.cuV('passive', 'jizoku');
    return [
      { key: _t('特性'), name: _t('剣気'), cat: 'trait', desc: [
        _t`メイン武器の通常攻撃の命中1体につき +${p.kiHit}(1回の攻撃で ${p.kiHitCap} まで)`,
        _t`ジャスト見切りで +${p.kiParry}`,
        _t`${p.kiFull} 以上の間は攻撃力アップ(全ての攻撃)`,
        _t('居合で全て消費し、威力に上乗せする'),
      ], rows: [
        [_t('最大値'), `${p.kiMax + c.cuV('trait', 'zan')}`],
        [_t('獲得量'), `+${Math.round((c.cuV('trait', 'ren') + (c.lvFx.kiGain || 0)) * 100)}%`],
        [_t`${p.kiFull} 以上の攻撃力`, `<b>+${Math.round(c.cuV('trait', 'juu', p.kiFullAtk) * 100)}%</b>`],
      ] },
      { key: _t('パッシブ'), name: _t('残心'), cat: 'passive', desc: [
        _t('見切り(ガード)で攻撃を受けた後、一定時間 攻撃力アップ(全ての攻撃)'),
        _t('ガードで受けるたびに効果時間が戻る'),
      ], rows: [
        [_t('攻撃力'), `<b>+${Math.round(zAtk * 100)}%</b>`],
        [_t('効果時間'), _t`${zT} 秒`],
      ] },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → 照準方向へ ${q.dist} 突進(無敵)`,
        _t`通過した敵をまとめて斬る(基礎威力 ${q.pow})`,
        _t`剣気を全て消費し、剣気1につき威力 +${q.kiPow}`,
      ], rows: [
        ['CD', _t`<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('威力'), `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, _t`消費した剣気1につき +${(q.kiPow * k).toFixed(1)}`],
        [_t('突進距離'), `${Math.round(q.dist * (1 + c.cuV('q', 'reach')))}`],
      ] },
      { key: 'Space', name: _t('見切り'), desc: [
        _t`長押しでガード(移動 ×${p.guardSlow})。構えた瞬間にスタミナ ${p.guardCost}`,
        _t`構えてから ${p.parryWin}秒以内に受けるとジャスト見切り`,
        _t`  → スタミナを使わず周りに反撃・剣気 +${p.kiParry}・無敵 ${p.parryIfr}秒`,
        _t('  → その後も押している間はガードを続ける'),
        _t('それ以外は被ダメージ分のスタミナで受ける'),
        _t`スタミナ 0 でガードブレイク(${p.breakT}秒 ガード不可・被ダメージ +${Math.round(p.breakDmg * 100)}%)`,
      ], rows: [
        [_t('スタミナ消費'), _t`${p.guardCost} + 被ダメージ分`, _t('構えた瞬間に消費。ガード中の被弾はダメージ分')],
        [_t('ジャスト受付'), _t`<b>${(p.parryWin + (c.lvFx.parryWin || 0)).toFixed(2)}</b> 秒`],
        [_t('反撃の威力'), `${p.parryPow} → <b>${Math.round(p.parryPow * c.atkMul)}</b>`],
      ] },
    ];
  },
};

// 居合の斬撃: 通過した敵にまとめてダメージ(切っ先が走り終えた少しあとに、一閃の演出と同時に炸裂する)
function iaiStrike(a) {
  const q = DATA.classes.samurai.q, full = a.ki >= DATA.classes.samurai.params.kiFull, ittou = hasSp('q', 'pow') && full;
  const dmg = (q.pow + a.ki * q.kiPow) * (1 + cuV('q', 'pow') + (P.lvFx.qPow || 0)) * (a.back ? 0.6 : 1) * (ittou ? 1.5 : 1);
  const x0 = a.x0, y0 = a.y0, x1 = P.x, y1 = P.y, hits = [...a.hits], ca = Math.cos(a.a), sa = Math.sin(a.a);
  const onHit = () => {
    if (state !== 'play' && state !== 'levelup') return;
    asMine(() => {
      let marks = 0;
      for (const e of hits) if (!e.dead) {
        hitEnemy(e, dmg, { src: 'iai', ang: a.a, kb: 120, col: '#ff3b5c' });
        if (ittou) addBleed(e, 10); // 一刀両断: 出血 10スタック
        if (marks++ < 8) slashes.push({ mark: true, x: e.x - ca * 8, y: e.y - sa * 8, x1: e.x + ca * 8, y1: e.y + sa * 8, t: 0, life: 0.16 }); // 敵の上の細い斬り跡
        for (let i = 0; i < 8; i++) { // 血しぶき(線の両側へ)
          const k = i % 2 ? 1 : -1, sp = rand(40, 120);
          part(e.x, e.y, -sa * k * sp + ca * rand(-30, 30), ca * k * sp + sa * rand(-30, 30) - 20, rand(0.3, 0.6), pick(['#a0122a', '#5a0a14', '#ff3b5c']), { g: 220, drag: 2, sz: pick([1, 2]) });
        }
        burst(e.x, e.y, 6, ['#ff3b5c', '#ffffff'], { sp: 100, glow: true, life: 0.35 });
      }
      for (let i = 0; i < (full ? 30 : 18); i++) { // 墨のような飛沫(線全体から)
        const u = Math.random(), k = Math.random() < 0.5 ? -1 : 1, sp = rand(20, 100);
        part(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, -sa * k * sp, ca * k * sp - 10, rand(0.4, 0.8), pick(['#1a0508', '#1a0508', '#a0122a', '#ff3b5c', '#ffd0d8']), { g: 140, drag: 2.5, sz: pick([1, 1, 2]), glow: Math.random() < 0.3 });
      }
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      hitstop(0.08); shake(full ? 10 : 7); screenFlash((full ? 0.3 : 0.2) * SET.fxA, full ? '#ff3b5c' : '#ffffff');
      shockAt(mx, my, full ? 1.8 : 1.3, 1); addFlash(mx, my, 120, full ? '#ff3b5c' : '#ffffff', 0.4);
      if (full) addRing(mx, my, 70, '#ff3b5c', { w: 3, life: 0.45 });
      fxRays(mx, my, full ? 100 : 72, '#c8243e', { n: full ? 18 : 12, life: 0.34, sq: 0.7, core: '#ffd0d8' }); // 炸裂の光芒(明るい赤は敵の攻撃の色なので、暗い紅と淡い桃色の芯)
      fxDecal(mx, my, Math.hypot(x1 - x0, y1 - y0) / 2 + 4, 'scar', { hx: (x1 - x0) / 2, hy: (y1 - y0) / 2, col: '#1a0408', hot: '#c8243e', heatT: 0.9, life: 3 }); // 地面に残る斬撃の跡
    });
    AudioMan.cutHit(); AudioMan.crit();
    if (full) AudioMan.impact();
  };
  a.cut.onHit = onHit; // 炸裂の時刻は一閃(makeCut の late)が決める。すでに過ぎていたらすぐ
  if (a.cut.hitDue) onHit();
  // CD(連環: 消費した剣気1につき 0.1秒短縮)
  if (!a.back) {
    const base = q.cd * (1 - cuV('q', 'cd')) * P.cdMul;
    setCd('q', hasSp('trait', 'zan') ? Math.max(3, base - a.ki * 0.1) : base);
  }
}

// 背水: HP 75% 以下で残心の効果が2倍
const zanshinK = () => (hasSp('passive', 'kihaku') && P.hp <= P.maxhp * 0.75 ? 2 : 1);
// 剣気100以上(攻撃力アップ・明鏡止水・一刀両断の条件)
const kiHigh = () => P.ki >= DATA.classes.samurai.params.kiFull;
// 剣気を得る(練気で獲得量アップ。flat = 倍率をかけない)
function kiAdd(n, flat) {
  const was = P.ki;
  P.ki = Math.min(P.kiMax, P.ki + (flat ? n : n * (1 + cuV('trait', 'ren') + (P.lvFx.kiGain || 0))));
  const full = DATA.classes.samurai.params.kiFull;
  if ((was < full && P.ki >= full) || (was < P.kiMax && P.ki >= P.kiMax)) { // 100 に届いた瞬間 / 最大値に届いた瞬間
    AudioMan.levelup(); addRing(P.x, P.y, 30, '#ff3b5c', { w: 2, life: 0.4 });
    burst(P.x, P.y, 16, ['#ff3b5c', '#ffd0d8'], { sp: 60, up: 30, glow: true });
  }
}

// ジャスト見切り: スタミナを使わず、剣気を得て周囲に反撃。押している間はガードを続ける(無敵が切れた後は通常のガード)
function samuraiParry() {
  const c = DATA.classes.samurai.params;
  kiAdd(c.kiParry);
  P.ifr = c.parryIfr;
  asMine(() => {
    const R = c.parryR * P.area;
    const stun = hasSp('passive', 'migaru'); // 崩し: 反撃が当たった敵をスタン
    forEachNear(P.x, P.y, R, e => {
      if (e.prop) return;
      hitEnemy(e, c.parryPow, { src: 'parry', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 80, col: '#ffffff' });
      if (stun && !e.dead && missed !== e) e.stun = Math.max(e.stun || 0, c.parryStun); // 外れた敵は止まらない
    });
    slashes.push({ x: P.x, y: P.y, follow: true, a: rand(0, TAU), r: R, t: 0, life: 0.25, full: true, pal: SWING_PAL.parry }); // 全周を一回転で斬る(見た目 = 反撃の範囲)
    hitstop(0.06); shake(5); screenFlash(0.25 * SET.fxA, '#ffffff'); shockAt(P.x, P.y, 1, 1.2);
    addRing(P.x, P.y, R, '#ffffff', { w: 2, life: 0.3 });
    burst(P.x, P.y, 24, ['#ffffff', '#9ff7ff', '#ff3b5c'], { sp: 120, glow: true, life: 0.35 });
    fxRays(P.x, P.y - 4, R * 1.3, '#4ab8d8', { n: 12, life: 0.28, core: '#9ff7ff' }); fxGlint(P.x + P.facing * 6, P.y - 8, 9, '#9ff7ff', { life: 0.24 }); // 受け流した刃のきらめき
  });
  addFloat(P.x, P.y - 16, _t('見切り!'), '#9ff7ff', 1.2);
  AudioMan.slash(); AudioMan.crit();
}
