// classes/archer.js — アーチャー: E スキル(アローレイン)/ クラスの実装(CLASS_RT.archer)/ 特性・パッシブ・Q の処理
'use strict';

// アローレイン(長弓の E): 構え → 空へ放つ → 照準位置に矢の雨(雨はその場に残り、放った後は動ける)
// 雨そのものは zones の 'rain'(world.js の updZones で矢を降らせる)
WEAPON_SKILL.longbow = {
  info(c, dmg) {
    const sk = DATA.weapons.longbow.skill, m = c.wm, heavy = c.hasSp('e', 'pow'), dur = (sk.dur + (m.eDur || 0)) * (c.hasSp('e', 'cd') ? 1.5 : 1);
    const one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0)) * (heavy ? 0.6 : 1);
    return { name: sk.name, cat: 'e', desc: [
      _t`構え ${sk.windup}秒 → 照準位置の半径 ${sk.radius} に ${sk.dur}秒間、矢が降り注ぐ`,
      _t`${sk.every}秒ごとに、範囲内の敵全員へ 武器の威力 × ${Math.round(sk.pow * 100)}%`,
      _t('放った後は自由に動ける(雨はその場に残る)'),
    ], rows: [
      ['CD', _t`<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      [_t('攻撃回数'), _t`${Math.round(dur / (sk.every * (heavy ? 0.5 : 1)))} 回 / ${dur.toFixed(1)} 秒`],
      [_t('1回の威力'), `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, _t`武器の威力 × ${Math.round(sk.pow * 100)}%。攻撃力を掛けた値`],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.longbow || {}, t = ME.tgt(sk.range * P.range);
    if (t.x !== P.x) P.facing = t.x < P.x ? -1 : 1;
    P.act = { slot: 'e', ph: 'wind', t: 0, x: t.x, y: t.y, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('aRain', MOTIONS.aRain.dur);
    skillCall(sk.name, '#b8ff9a', 'e', { fx: '#5ad87a' }); AudioMan.click();
  },
  update(a, dt) {
    const sk = weaponSkill();
    P.moveMul = 0;
    if (a.t < sk.windup) { if (Math.random() < dt * 30) part(P.x + rand(-8, 8), P.y + 6, rand(-20, 20), -10, 0.4, pick(['#b8ff9a', '#e4ffd8']), { glow: true }); return; }
    arrowRain(ME, a);
    P.act = null;
  },
  cast(X, a) {
    const t = X.tgt(DATA.weapons.longbow.skill.range * X.range);
    arrowRain(X, { x: t.x, y: t.y, pow: a.pow });
    return null;
  },
};
// アローレインを放つ: 照準位置 (a.x, a.y) に矢の雨(zones の 'rain')。追従は使い手についていく
//   見た目: 空へ矢の一斉射(上へ飛んで消える)→ 照準の輪が縮んで定まる → 空から斜めに矢が降り注ぎ、地面に刺さって残る(world.js / render.js)
//   slant: 矢の傾き(1 落ちるあいだに横へ進む量。降る向きは使い手の向き)/ linger: 終わった後も刺さった矢が残る秒
function arrowRain(X, a) {
  const sk = DATA.weapons.longbow.skill, m = P.wm.longbow || {};
  const heavy = X.sp('pow'), delay = 0.25; // 放ってから降り始めるまで
  const follow = X.sp('cd'); // 追従: ついてくる + 持続 +50%
  const x = X.x, y = X.y, f = X.face || 1, every = sk.every * (heavy ? 0.5 : 1);
  // acc = every: 照準の輪が定まった瞬間(delay)に 1回目が降る(dur 秒で dur / every 回)
  zones.push({ kind: 'rain', x: a.x, y: a.y, r: sk.radius * (1 + X.lv('area')) * X.area, t: 0, delay, dur: delay + (sk.dur + (m.eDur || 0)) * (follow ? 1.5 : 1), tick: 0, acc: every,
    every, dmg: wst('longbow').dmg * sk.pow * (1 + X.lv('pow')) * a.pow * (heavy ? 0.6 : 1),
    nArrows: sk.arrows, follow: follow ? X : null, fire: X.sp('area') ? sk.fire : 0, fireT: sk.fireT, arrows: [], cl: X.cl, slant: 0.32 * f, linger: RAIN_STUCK });
  asMine(() => { // 空へ放つ矢の一斉射(当たらない。上へ飛んで消える)と、手元の光
    for (let i = 0; i < 7; i++) fire('volley', x + f * 3, y - 9, -Math.PI / 2 + f * 0.15 + (i - 3) * 0.07 + rand(-0.03, 0.03), rand(430, 520), { noHit: true, pierce: 999, life: rand(0.2, 0.28), src: 'arrowsky', r: 0, col: '#b8ffb0' });
    for (let i = 0; i < 6; i++) part(x + f * 4, y - 10, rand(-30, 30) + f * 20, -rand(200, 320), 0.3, pick(['#e4ffd8', '#b8ff9a', '#ffffff']), { glow: true, drag: 0 });
    burst(x + f * 3, y - 9, 8, ['#b8ff9a', '#e4ffd8'], { sp: 60, glow: true, life: 0.25 });
    fxBeam(x + f * 3, y - 9, { up: true, H: 130, w: 1.2, col: '#7dff9a', mid: '#b8ff9a', core: '#ffffff', life: 0.3, drop: 0.06 }); // 空へ駆け上がる光の筋
    fxGlint(x + f * 3, y - 10, 8, '#b8ff9a', { life: 0.22 });
    addRing(x, y, 18, '#b8ff9a', { w: 2, life: 0.3 }); addRing(a.x, a.y, 6, '#b8ff9a', { r0: 2, life: 0.2 }); shake(2);
  });
  AudioMan.volley();
}

CLASS_RT.archer = {
  skills: ['q'],
  init() { P.focus = 0; P.dash = null; P.backHeld = false; P.chainB = AR().chainMax; P.sealB = P.maxhp * AR().guardMax; },
  update(dt) {
    const p = AR(), max = focusMax();
    P.chainB = Math.min(p.chainMax, P.chainB + p.chainMax * dt); // 狩りの連鎖: 縮められる量の枠(1秒で chainMax 溜まる)
    P.sealB = Math.min(P.maxhp * p.guardMax, (P.sealB || 0) + P.maxhp * p.guardMax * dt); // 守印: 得られるシールドの枠(1秒で 最大HP × guardMax 溜まる)
    // 集中: 止まっている間(E / Q の予備動作中も)に溜まり、動くとゆっくり下がる
    const still = !P.moving || (P.act && P.act.ph === 'wind');
    if (still) P.focus = Math.min(max, (P.focus || 0) + dt / p.focusStep * (1 + cuV('passive', 'calm')));
    else P.focus = Math.max(0, (P.focus || 0) - dt * p.focusDecay * (1 - cuV('passive', 'hold')));
    const f = focusN();
    P.atkSpd = 1 + f * p.focusAtkSpd;
    P.shots = Math.round(P.stats.v.shots || 0) + (hasSp('passive', 'eye') && f >= max ? 1 : 0); // 連射
    // バックステップ中の移動 → 着地で集中 +1
    if (P.dash) {
      P.x += P.dash.vx * dt; P.y += P.dash.vy * dt; P.dash.t -= dt;
      if (Math.random() < 0.5) P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.1, f: P.facing }]).slice(-3);
      if (P.dash.t <= 0) { P.dash = null; P.focus = Math.min(max, P.focus + p.backFocus); burst(P.x, P.y + 6, 8, ['#8a8098', '#6a6078'], { sp: 40, up: 10, life: 0.3 }); }
    }
    const held = defHeld();
    if (held && !P.backHeld && !P.dash) { if (P.sta >= backCost()) archerBackstep(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
    P.backHeld = held;
    P.moveMul = P.dash ? 0 : 1;
  },
  onHurt(dmg) {
    if (hasSp('passive', 'calm') && focusN() >= focusMax()) return dmg * 0.8; // 不動: 被ダメージ -20%、集中は下がらない
    P.focus = Math.max(0, (P.focus || 0) - AR().focusHurt);
    return dmg;
  },
  onMainHit: e => addMark(e, 1),
  onEHit: e => addMark(e, 1),
  // 印を持つ敵が受けるダメージ / 弱点露出・集中によるクリティカル
  dmgTaken: e => (markOn(e) ? 1 + e.mark * (AR().markPct + (P.lvFx.markPct || 0)) : 1),
  critBonus: e => focusN() * (AR().focusCrit + cuV('passive', 'eye')) + (weakOn(e) ? AR().weakCrit : 0),
  critDmgBonus: e => (hasSp('trait', 'deep') && weakOn(e) ? 0.3 : 0), // 急所
  onKill(e) {
    if (!markOn(e)) return;
    const p = AR();
    const g = hasSp('trait', 'carve') ? Math.min(e.mark * p.guardK, P.sealB) : 0;
    if (g > 0) { // 守印: 倒した敵の印の数 × guardK のシールド(5秒。枠が残っている分だけ)
      P.sealB -= g; timedShield(g, p.guardT);
      part(e.x, e.y, (P.x - e.x) * 3, (P.y - e.y) * 3, 0.3, '#7ab8ff', { glow: true, sz: 2, drag: 0 });
    }
    const k = cuV('trait', 'spread');
    if (k) { // 伝播: 近くの敵へ印を移す
      const n = Math.floor(e.mark * k);
      let best = null, bd = p.spreadR * p.spreadR;
      forEachNear(e.x, e.y, p.spreadR, o => { if (o === e || o.dead || o.prop) return; const d = d2(o.x, o.y, e.x, e.y); if (d < bd) { bd = d; best = o; } });
      if (best && n > 0) { addMark(best, n); bolts.push({ x0: e.x, y0: e.y, x1: best.x, y1: best.y, t: 0, life: 0.15, w: 1 }); }
    }
    if (hasSp('trait', 'spread')) { // 狩りの連鎖: CD -chainCd(枠が残っている分だけ。1秒あたり chainMax まで)
      const n = Math.min(p.chainCd, P.chainB, P.sk.q.cd);
      P.chainB -= n; P.sk.q.cd -= n;
    }
  },
  atkBonus: () => 0,
  qStart() {
    const q = DATA.classes.archer.q;
    P.act = { slot: 'q', ph: 'wind', t: 0 };
    playAnim('aVolley', MOTIONS.aVolley.dur);
    slowmo(0.5, 0.2);
    skillCall(q.name, '#7dff9a', 'q', { fx: '#4ad870' }); AudioMan.click();
  },
  qUpdate(a, dt) {
    const q = DATA.classes.archer.q;
    P.moveMul = 0;
    if (a.t < q.windup) { // 長弓に光が集まる
      asMine(() => { if (Math.random() < dt * 60) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 22, P.y - 14 + Math.sin(r) * 22, -Math.cos(r) * 60, -Math.sin(r) * 60, 0.35, pick(['#b8ff9a', '#ffffff']), { glow: true, drag: 0 }); } });
      return;
    }
    archerVolley();
    P.act = null;
  },
  res: () => ({ kind: 'focus', label: _t('集中'), v: focusN(), max: focusMax(), seg: true, dk: '#1f6a3a' }),
  staBroken: () => false,
  statuses() {
    const p = AR(), f = focusN(), out = [];
    if (f > 0) out.push({ id: 'focus', glyph: '集', name: _t`集中 ${f}段`, fx: _t`攻撃速度 +${Math.round(f * p.focusAtkSpd * 100)}% クリティカル率 +${(f * (p.focusCrit + cuV('passive', 'eye')) * 100).toFixed(1)}%` + (hasSp('passive', 'calm') && f >= focusMax() ? _t(' 被ダメージ -20% 被弾で下がらない') : '') + (hasSp('passive', 'eye') && f >= focusMax() ? _t(' 弾数 +1') : ''), kind: 'buff' });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.archer.q.name, glyph: '射' }),
  info(c) {
    const p = AR(), q = DATA.classes.archer.q, k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0);
    return [
      { key: _t('特性'), name: _t('狩人の印'), cat: 'trait', desc: [
        _t('メイン武器の通常攻撃・E が命中すると、その敵に印 +1'),
        _t`印1つにつき、その敵が受けるダメージ +${Math.round((p.markPct + (c.lvFx.markPct || 0)) * 100)}%`,
        _t`印が ${p.markMax} 以上で弱点露出: ${p.weakT}秒間 その敵へのクリティカル率 +${Math.round(p.weakCrit * 100)}%`,
        _t`印は ${p.markT}秒 刻まれないと消える。一斉射撃で消費する`,
      ], rows: [
        [_t('印の上限'), `${p.markMax + c.cuV('trait', 'carve')}`],
        [_t('印の持続'), _t`${p.markT + c.cuV('trait', 'deep')} 秒`],
      ] },
      { key: _t('パッシブ'), name: _t('集中'), cat: 'passive', desc: [
        _t`止まっている間、${p.focusStep}秒ごとに +1段(E / Q の予備動作中も)`,
        _t`移動すると1秒ごとに ${p.focusDecay}段 下がる。被弾すると ${p.focusHurt}段 下がる`,
        _t`1段につき 攻撃速度 +${Math.round(p.focusAtkSpd * 100)}%(全武器)・クリティカル率 +${Math.round(p.focusCrit * 100)}%(全ての攻撃)`,
      ], rows: [
        [_t('最大段'), `${p.focusMax + (c.lvFx.focusMax || 0)}`],
        [_t('最大時の攻撃速度'), `<b>+${Math.round((p.focusMax + (c.lvFx.focusMax || 0)) * p.focusAtkSpd * 100)}%</b>`],
      ] },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → 画面内の印を持つ敵1体につき1本、その敵へまっすぐ高速の矢(基礎威力 ${q.pow}、貫通無限)`,
        _t`矢が当たった敵は、印1つにつき 基礎威力 ${q.markPow} の追加ダメージを連続で受ける(印は消費)`,
        _t('  → 途中で貫いた敵も、印を持っていれば同じく受ける'),
        _t`さらに無条件で、最寄りの ${q.none}体へも1本ずつ(最大 ${q.max}本)`,
      ], rows: [
        ['CD', _t`<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('矢の威力'), `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`],
        [_t('印1つの追加'), `${Math.round(q.markPow * k)} → <b>${Math.round(q.markPow * k * c.atkMul)}</b>`],
      ] },
      { key: 'Space', name: _t('バックステップ'), desc: [
        _t`移動方向と逆へ ${p.backDist} 跳ぶ(止まっているときは向きと逆)。${p.backIfr}秒 無敵`,
        _t`着地すると集中 +${p.backFocus}段`,
      ], rows: [
        [_t('スタミナ消費'), `<b>${p.backCost - (c.lvFx.backCut || 0)}</b>`],
      ] },
    ];
  },
};

// ---------- アーチャー: 狩人の印・集中・一斉射撃・バックステップ ----------
const AR = () => DATA.classes.archer.params;
const markMax = () => AR().markMax + cuV('trait', 'carve');
const markOn = e => e.mark > 0 && S.time < e.markT;
const weakOn = e => S.time < (e.weakT || 0);
// 印を刻む。上限(基本の markMax)に届いたら弱点露出
function addMark(e, n) {
  if (e.prop || e.dead || missed === e) return; // 外れた攻撃(砂塵・暗闇)では刻まない
  const p = AR();
  if (!markOn(e)) e.mark = 0;
  e.mark = Math.min(markMax(), e.mark + n);
  e.markT = S.time + p.markT + cuV('trait', 'deep');
  if (e.mark >= p.markMax && !weakOn(e)) {
    e.weakT = S.time + p.weakT;
    addRing(e.x, e.y, e.r + 8, '#ff5d73', { w: 1, life: 0.35 }); part(e.x, e.y - e.r - 4, 0, -20, 0.5, '#ff5d73', { glow: true, sz: 2 });
  }
}
const focusMax = () => AR().focusMax + (P.lvFx.focusMax || 0);
const focusN = () => Math.floor(P.focus || 0);
const backCost = () => AR().backCost - (P.lvFx.backCut || 0);
function archerBackstep() {
  const p = AR(), d = P.moving && P.dir ? [-P.dir[0], -P.dir[1]] : [-P.facing, 0], len = Math.hypot(d[0], d[1]) || 1;
  staUse(backCost());
  P.dash = { vx: d[0] / len * p.backDist / p.backTime, vy: d[1] / len * p.backDist / p.backTime, t: p.backTime };
  P.invT = Math.max(P.invT, dodgeIfr(p.backIfr));
  if (hasSp('passive', 'hold')) P.focus = Math.min(focusMax(), (P.focus || 0) + 2); // 狩りの構え
  playAnim('aStep', MOTIONS.aStep.dur); P.anim.keep = true;
  burst(P.x, P.y + 6, 10, ['#8a8098', '#b8ff9a'], { sp: 50, up: 10, life: 0.35 });
  AudioMan.dash();
}
// 一斉射撃: 画面内の印を持つ敵1体につき1本、その敵へまっすぐ高速の矢(貫通無限)
// 矢が当たった敵は、印1つにつき追加ダメージを連続で受ける(印は消費)。途中で貫いた敵も同じ
function archerVolley() {
  const q = DATA.classes.archer.q, k = 1 + cuV('q', 'pow') + (P.lvFx.qPow || 0);
  const vis = enemies.filter(e => !e.dead && !e.prop && onScreen(e.x, e.y));
  const marked = vis.filter(markOn).sort((a, b) => b.mark - a.mark);
  const others = vis.filter(e => !markOn(e)).sort((a, b) => d2(a.x, a.y, P.x, P.y) - d2(b.x, b.y, P.x, P.y));
  const shots = marked.slice();
  shots.push(...others.slice(0, q.none)); // 無条件で、最寄りの敵(印を持つ敵とは別)へも1本ずつ
  const keep = cuV('q', 'keep'), sure = hasSp('q', 'keep'), boom = hasSp('q', 'pow'), storm = hasSp('q', 'cd');
  const onHit = e => {
    if (boom) asMine(() => { // 流星
      forEachNear(e.x, e.y, q.meteorR * P.area, o => { if (!o.prop && o !== e) hitEnemy(o, q.meteorPow * k, { src: 'volley', noNum: true, col: '#b8ffb0' }); });
      addFlash(e.x, e.y, 30, '#b8ffb0', 0.15);
    });
    if (!markOn(e)) return;
    // 印を消費して、1つにつき追加ダメージを連続で。残印: 確率で印を消費せず、もう1回(上限は印の3倍)
    let n = 0;
    for (let left = e.mark; left > 0 && n < e.mark * 3; n++) if (Math.random() >= keep) left--;
    e.mark = 0;
    for (let i = 0; i < n; i++) setTimeout(() => {
      if (state !== 'play' || e.dead) return;
      asMine(() => { hitEnemy(e, q.markPow * k, { src: 'volley', col: '#b8ffb0', forceCrit: sure, noNum: i % 2 === 1 }); part(e.x + rand(-4, 4), e.y + rand(-4, 4), rand(-30, 30), rand(-30, 10), 0.25, pick(['#b8ffb0', '#ffffff']), { glow: true }); });
      if (i === 0) fxGlint(e.x, e.y - 4, 6, '#b8ffb0', { life: 0.2 }); // 印が弾ける
      if (i === n - 1 && storm && !e.dead) addMark(e, 5); // 印の嵐
    }, 60 + i * q.interval * 1000);
  };
  asMine(() => {
    shots.slice(0, q.max).forEach((tg, i) => {
      const a = Math.atan2(tg.y - P.y, tg.x - P.x);
      if (i < 8) slashes.push({ line: true, x: P.x, y: P.y - 4, x1: tg.x, y1: tg.y, t: 0, life: 0.13, w: 1, col: '#1f6a3a', core: '#b8ffb0' }); // 狙った敵へ一瞬走る照準の光
      fire('volley', P.x, P.y - 4, a, q.speed, { dmg: q.pow * k, pierce: 999, life: 1.2, src: 'volley', r: 4, col: '#b8ffb0', forceCrit: sure, onHit });
    });
    addRing(P.x, P.y - 4, 30, '#b8ff9a', { w: 2, life: 0.4 }); addFlash(P.x, P.y, 90, '#b8ff9a', 0.3);
    fxRays(P.x, P.y - 6, 64, '#3aa85a', { n: 12, life: 0.3, core: '#7dff9a' });
    burst(P.x, P.y - 4, 30, ['#e4ffd8', '#b8ff9a', '#ffffff'], { sp: 150, glow: true, life: 0.4 });
    shockAt(P.x, P.y, 1, 1.2); shake(4); screenFlash(0.15 * SET.fxA, '#b8ff9a');
  });
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.shoot(); AudioMan.crit();
}
