// classes/pyro.js — パイロマンサー: E スキル(火炎放射)/ クラスの実装(CLASS_RT.pyro)/ 特性・パッシブ・Q の処理
'use strict';

// 火炎放射(ファイアーの E): 構え → 照準方向へ扇形に炎を吹き続ける(放射中も動ける)
//   ダブル放射: 反対方向にも吹く / 火炎旋風: 攻撃ごとに放射先(炎の先端)へ吸い込み
WEAPON_SKILL.fire = {
  info(c, dmg) {
    const sk = DATA.weapons.fire.skill, m = c.wm, dur = sk.dur + (m.eDur || 0), one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      _t`構え ${sk.windup}秒 → ${sk.dur}秒間、照準方向へ扇形に炎を吹き続ける`,
      _t`${sk.every}秒ごとに、範囲内の敵へ 武器の威力 × ${Math.round(sk.pow * 100)}% と炎上(武器の炎上/s × ${Math.round(sk.burn * 100)}% を 3秒)`,
      _t('放射中も動ける'),
    ], rows: [
      ['CD', _t`<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      [_t('放射'), _t`${Math.round(dur / sk.every)} 回 / ${dur.toFixed(1)} 秒`],
      [_t('長さ'), `${Math.round(sk.len * (1 + c.cuV('e', 'len')) * (1 + c.st.v.area) * c.st.mul.area)}`],
      [_t('1回の威力'), `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, _t`武器の威力 × ${Math.round(sk.pow * 100)}%。攻撃力を掛けた値`],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.fire || {};
    P.act = Object.assign(flameState(ME, clsESkillMul() * (1 + (m.ePow || 0))), { slot: 'e', ph: 'wind', t: 0 });
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('pFlame', MOTIONS.pFlame.duration(P.act.dur), P.act.dur);
    sigilKeep(skillCall(sk.name, '#ff8a3d'), P.act.dur); AudioMan.click();
  },
  // 分身など: 使い手の位置から吹く(噴き出し口の描画は返り値の flame)
  cast(X, a) {
    const o = flameState(X, a.pow), ch = { flame: null, X };
    ch.step = dt => { const done = flameStep(X, o, dt); ch.flame = o.flame; return done; };
    return ch;
  },
  // 炎の塊の移動(放射が終わっても消えるまで動かす)
  tick(dt) {
    const fp = P.flamePuffs;
    if (!fp || !fp.length) return;
    for (const f of fp) {
      f.t += dt;
      const k = Math.exp(-2.2 * dt); f.vx *= k; f.vy *= k; // 空気で減速
      f.vy -= 40 * dt * (f.t / f.life);                     // 熱で昇る
      f.x += f.vx * dt; f.y += f.vy * dt;
    }
    P.flamePuffs = fp.filter(f => f.t < f.life);
  },
  update(a, dt) {
    const sk = weaponSkill(), L = sk.len * (1 + cuV('e', 'len')) * P.area;
    a.a = aimDir(L * 1.5);
    if (Math.cos(a.a) !== 0) P.facing = Math.cos(a.a) < 0 ? -1 : 1;
    if (a.ph === 'wind') { // 構え: 杖先に火が集まる
      P.moveMul = 0;
      if (Math.random() < dt * 40) part(P.x + P.facing * 10 + rand(-6, 6), P.y - 8 + rand(-6, 6), -P.facing * 20, -10, 0.3, pick(['#ff6a2a', '#ffc34a']), { glow: true });
      if (a.t >= sk.windup) a.ph = 'fire';
      return;
    }
    const done = flameStep(ME, a, dt);
    P.flame = a.flame;
    if (done) P.act = null;
  },
};
// 火炎放射 1回分の状態(dur: 放射の時間 / acc: 次の攻撃までの時間 / pow: 威力の倍率)
function flameState(X, pow) {
  const sk = DATA.weapons.fire.skill, m = P.wm.fire || {};
  return { dur: sk.dur + (m.eDur || 0), acc: 0, u: 0, a: X.aim(sk.len * 1.5), pow, flame: null };
}
// 火炎放射を dt 進める(終わったら true)。a.flame: 噴き出し口の描画用(終わると null)
function flameStep(X, a, dt) {
  const sk = DATA.weapons.fire.skill, blue = X.sp('pow'), L = sk.len * (1 + X.lv('len')) * X.area;
  a.a = X.aim(L * 1.5);
  const dirs = X.sp('cd') ? [a.a, a.a + Math.PI] : [a.a]; // ダブル放射: 反対方向にも
  a.flame = { a: a.a, len: L, arc: sk.arc, blue, t: a.u, dbl: dirs.length > 1 };
  for (const d of dirs) flamePuffs(X, d, L, sk.arc, blue, dt);
  a.acc += dt;
  while (a.acc >= sk.every) { a.acc -= sk.every; for (const d of dirs) flameTick(X, a, d, L, blue); }
  a.u += dt;
  if (a.u < a.dur) return false;
  a.flame = null;
  return true;
}
// 火炎放射の見た目: 杖先から炎の塊を噴き出す(描画は render.js)。先端の速さは長さ L に届くように
//   見た目だけで、数は画質で変わるので見た目の乱数の列で(core.js の fxScope)
function flamePuffs(X, ang, L, arc, blue, dt) { fxScope(() => {
  const fp = P.flamePuffs || (P.flamePuffs = []), n = Math.round(dt * 110 * gq().parts) || 1;
  const nx = X.x + Math.cos(ang) * 9, ny = X.y - 6 + Math.sin(ang) * 6;
  for (let i = 0; i < n && fp.length < 260; i++) {
    const d = ang + rand(-arc / 2, arc / 2) * rand(0.3, 1), life = rand(0.32, 0.45), sp = L / life * rand(1.25, 1.55);
    fp.push({ x: nx + rand(-1, 1), y: ny + rand(-1, 1), vx: Math.cos(d) * sp, vy: Math.sin(d) * sp, t: 0, life, r0: rand(1, 2), r1: rand(6, 10) * X.area, blue, seed: Math.random() });
  }
  if (Math.random() < dt * 25) part(nx, ny, Math.cos(ang) * L * 2 + rand(-40, 40), Math.sin(ang) * L * 2 + rand(-40, 40), rand(0.3, 0.5), blue ? '#ffffff' : pick(['#ffc34a', '#fff6c8']), { glow: true, drag: 2 }); // 火の粉
}); }
// 火炎放射の1回: 向き ang の扇形の中の敵へダメージと炎上(1回 = 1回の E の攻撃)
function flameTick(X, a, ang, L, blue) {
  const sk = DATA.weapons.fire.skill, st = wst('fire'), pw = (1 + X.lv('pow')) * a.pow, dmg = st.dmg * sk.pow * pw, burn = (st.burn || 0) * sk.burn * (blue ? 2 : 1), el = clsNextEl();
  const x = X.x, y = X.y;
  asMine(() => forEachNear(x, y, L, e => {
    let diff = Math.atan2(e.y - y, e.x - x) - ang;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > sk.arc / 2) return;
    if (e.prop) { killEnemy(e); return; }
    hitEnemy(e, dmg, { src: 'flamer', ang, kb: 6, col: blue ? '#7ad7ff' : '#ff8a3d', el, eHit: true, noNum: Math.random() < 0.6, cl: X.cl });
    if (!e.dead) addBurn(e, burn, 3, 'flamer');
  }));
  if (X.sp('len')) flameSuck(X, x + Math.cos(ang) * L, y + Math.sin(ang) * L, st.dmg * sk.suckPow * pw, blue); // 火炎旋風
  if (Math.random() < 0.3) { const d = L * rand(0.35, 0.95), aa = ang + rand(-sk.arc, sk.arc) / 3; fxDecal(x + Math.cos(aa) * d, y + 4 + Math.sin(aa) * d, rand(5, 8), 'scorch', { life: 2.2, heatT: 0.6, hot: blue ? '#7ad7ff' : '#ff8a3d' }); } // 炎がなめた地面の焦げ
  if (Math.random() < 0.3) AudioMan.fire();
}
// 火炎旋風: 放射先(炎の先端)へ周りの敵を吸い込み、半径 suckR の敵を焼く(攻撃1回ごと)。ボスは引き寄せない
function flameSuck(X, x, y, dmg, blue) {
  const sk = DATA.weapons.fire.skill, R = sk.suckR * X.area, cols = blue ? ['#7ad7ff', '#bff4ff', '#ffffff'] : ['#ff6a2a', '#ffc34a', '#fff6c8'];
  asMine(() => {
    forEachNear(x, y, R * 2, e => {
      if (e.prop) return;
      const dd = Math.sqrt(d2(x, y, e.x, e.y));
      if (dd <= R) hitEnemy(e, dmg, { src: 'flamer', noNum: Math.random() < 0.6, col: blue ? '#7ad7ff' : '#ff8a3d', eHit: true, cl: X.cl });
      if (e.boss || e.obj || e.dead) return; // ボスが出した物は吸い込まれない
      const a = Math.atan2(y - e.y, x - e.x), k = Math.min(dd, sk.suckPull * (1 - (e.kbRes || 0) * 0.6));
      e.x += Math.cos(a) * k; e.y += Math.sin(a) * k;
    });
    // 見た目: 先端へ渦を巻いて吸い込まれる火の粉と、縮む輪
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU), r = R * rand(0.7, 1.1), sp = r * 6;
      part(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, (-Math.cos(a) - Math.sin(a) * 0.8) * sp, (-Math.sin(a) + Math.cos(a) * 0.8) * sp * 0.7, 0.18, pick(cols), { glow: true, drag: 3 });
    }
    addRing(x, y, 2, cols[0], { r0: R, life: 0.18 });
  });
}

CLASS_RT.pyro = {
  skills: ['q'],
  init() { P.pyT = 0; P.pyExt = 0; P.wallHeld = false; P.flame = null; },
  update(dt) {
    const p = PY();
    if (P.pyT > 0) {
      P.pyT = Math.max(0, P.pyT - dt);
      if (hasSp('passive', 'kindle')) { P.hp -= P.hp * p.drain * dt; S.hudDirty = true; } // 業火: 今のHP を消費する(0 にはならない)
      if (Math.random() < dt * 30) part(P.x + rand(-6, 6), P.y + rand(-4, 6), rand(-8, 8), -rand(20, 40), 0.45, pick(['#ff6a2a', '#ffc34a', '#b8261a']), { glow: true }); // 纏った炎
    }
    // 炎壁(Space): 押した瞬間に1回
    const held = defHeld();
    if (held && !P.wallHeld) { if (P.sta >= wallCost()) pyroWall(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
    P.wallHeld = held;
    P.moveMul = 1;
  },
  onHurt: dmg => dmg,
  onMainHit() {},
  onSkill: () => pyWear(), // E / Q を使うと纏う
  // 焔纏い: 全武器の命中(通常攻撃・E)で炎上を付ける
  onWeaponHit(e, dmg, crit) {
    if (P.pyT <= 0 || e.dead) return;
    const k = pyIgnite() * (crit && hasSp('passive', 'ignite') ? PY().critIgnite : 1); // 爆ぜる炎
    addBurn(e, dmg * k / 3 / dmgMul(), 3, 'ignite');
  },
  // 業火: 火勢(スタック数に比例)・業火(特殊): 纏っている間 +50%
  burnMul: e => 1 + Math.min((e.burns || []).length, pyStackMax()) * pyStackPct() + (P.pyT > 0 && hasSp('passive', 'kindle') ? PY().hellBurn : 0),
  burnDur: () => cuV('trait', 'dur'),
  critBonus: e => (pyWhite(e) ? PY().whiteCrit : 0), // 白炎(炎上ダメージにも乗る)
  onKill(e) {
    const left = burnLeft(e), p = PY();
    if (left > 0) pySpread(e, left);
    if (P.pyT > 0 && left > 0 && hasSp('passive', 'wear') && P.pyExt < p.extendMax) { P.pyT += p.extendT; P.pyExt += p.extendT; } // 燎原
  },
  atkBonus: () => 0,
  qStart() {
    const q = DATA.classes.pyro.q;
    P.act = { slot: 'q', ph: 'wind', t: 0 };
    playAnim('pInferno', MOTIONS.pInferno.dur);
    slowmo(0.5, 0.2);
    skillCall(q.name, '#ff6a2a', 'q'); AudioMan.click();
  },
  qUpdate(a, dt) {
    const q = DATA.classes.pyro.q;
    P.moveMul = 0;
    if (a.t < q.windup) { // 燃えている敵から火の粉が杖へ吸い込まれる
      asMine(() => {
        if (Math.random() < dt * 60) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 26, P.y - 16 + Math.sin(r) * 26, -Math.cos(r) * 80, -Math.sin(r) * 80, 0.3, pick(['#ff6a2a', '#ffc34a', '#ffffff']), { glow: true, drag: 0 }); }
        for (const e of enemies) if (!e.dead && e.burnT > 0 && Math.random() < dt * 6 && onScreen(e.x, e.y)) part(e.x, e.y, (P.x - e.x) * 2, (P.y - 16 - e.y) * 2, 0.45, pick(['#ff6a2a', '#ffc34a']), { glow: true, drag: 0 });
      });
      return;
    }
    pyroInferno();
    P.act = null;
  },
  res: () => ({ kind: 'wear', label: _t('焔纏い'), v: P.pyT, max: Math.max(P.pyT, wearDur()), dk: '#7a2a10' }),
  staBroken: () => false,
  statuses() {
    const out = [];
    if (P.pyT > 0) out.push({ id: 'wear', glyph: '焔', name: _t('焔纏い'), fx: _t`全武器の命中で炎上(与えたダメージの ${Math.round(pyIgnite() * 100)}%)` + (hasSp('passive', 'kindle') ? _t(' 炎上ダメージ +50% HP 3%/s 消費') : ''), t: P.pyT, max: Math.max(P.pyT, wearDur()), kind: 'buff' });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.pyro.q.name, glyph: '煉' }),
  info(c) {
    const p = PY(), q = DATA.classes.pyro.q, k = 1 + (c.lvFx.qPow || 0), kin = c.cuV('passive', 'kindle');
    return [
      { key: _t('特性'), name: _t('業火'), cat: 'trait', desc: [
        _t`火勢: 敵の炎上 1スタックにつき、その敵の炎上ダメージ +${+((p.stackPct + (c.lvFx.stackPct || 0) + (c.hasSp('trait', 'dur') ? p.fierce : 0)) * 100).toFixed(1)}%`,
        _t`延焼: 炎上中の敵が倒れると、残っていた炎上ダメージを周りの ${p.spreadN}体へ燃え移らせる`,
      ], rows: [
        [_t('火勢の最大スタック'), `${p.stackMax + c.cuV('trait', 'stack')}`],
        [_t('燃え移る量'), `<b>${Math.round(c.cuV('trait', 'spread', p.spreadPct) * 100)}%</b>`],
        [_t('炎上の持続'), _t`+${c.cuV('trait', 'dur')} 秒`],
      ] },
      { key: _t('パッシブ'), name: _t('焔纏い'), cat: 'passive', desc: [
        _t('E / Q を使うと、焔を纏う(使うたびに時間が戻る)'),
        _t('纏っている間、全武器の攻撃(通常攻撃・E)が命中すると、与えたダメージの一部を 3秒の炎上で付ける'),
        _t('  → 炎上そのもの・Q・爆風からは付かない'),
      ].concat(kin ? [_t`纏った瞬間、周り(半径 ${p.kindleR})に火の輪`] : []), rows: [
        [_t('纏う時間'), _t`<b>${c.cuV('passive', 'wear', p.wearT)}</b> 秒`],
        [_t('付与量'), `<b>${Math.round((c.cuV('passive', 'ignite', p.ignite) + (c.lvFx.ignite || 0)) * 100)}%</b>`],
      ].concat(kin ? [[_t('火の輪の威力'), `${kin} → <b>${Math.round(kin * c.atkMul)}</b>`]] : []) },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → 画面内の炎上中の敵全員の炎上を、まとめて爆発させる`,
        _t`各敵に、基礎威力 ${q.base} + 残っていた炎上ダメージ × 爆発の倍率 をすぐに与える(炎上は消費する)`,
        _t`その敵の周り(半径 ${q.r})に 基礎威力 ${q.pow} + 炎上スタック数 × ${q.perStack} の爆風`,
        _t('炎上中の敵がいなくても使える(自分の周りに爆風だけ)'),
      ], rows: [
        ['CD', _t`<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('爆発の基礎威力'), `${Math.round(q.base * k)} → <b>${Math.round(q.base * k * c.atkMul)}</b>`],
        [_t('爆発の倍率'), `<b>${Math.round(c.cuV('q', 'pow', q.mul) * k * 100)}%</b>`, _t('残っていた炎上ダメージに掛ける')],
        [_t('爆風の基礎威力'), `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, _t`炎上1スタックにつき +${Math.round(q.perStack * k)}`],
      ] },
      { key: 'Space', name: _t('炎壁'), desc: [
        _t`その場で炎を噴き出し、周り(半径 ${p.wallR})の敵を押し返して炎上させる(${p.wallBurn}/s を 3秒)`,
        _t`使った瞬間から ${p.wallIfr}秒 無敵`,
      ], rows: [
        [_t('スタミナ消費'), `<b>${p.wallCost - (c.lvFx.wallCut || 0)}</b>`],
      ] },
    ];
  },
};

// ---------- パイロマンサー: 業火・焔纏い・煉獄・炎壁 ----------
const PY = () => DATA.classes.pyro.params;
const pyStackMax = () => PY().stackMax + cuV('trait', 'stack');
const pyStackPct = () => PY().stackPct + (P.lvFx.stackPct || 0) + (hasSp('trait', 'dur') ? PY().fierce : 0); // 猛火
const pyWhite = e => hasSp('trait', 'stack') && (e.burns || []).length >= PY().whiteAt; // 白炎
const pyIgnite = () => cuV('passive', 'ignite', PY().ignite) + (P.lvFx.ignite || 0);
const wearDur = () => cuV('passive', 'wear', PY().wearT);
const wallCost = () => PY().wallCost - (P.lvFx.wallCut || 0);
// 残っていた炎上ダメージ(各炎上の 1秒のダメージ × 残り秒の合計。攻撃力を掛ける前の値)
const burnLeft = e => (e.burns || []).reduce((a, b) => a + b.v * Math.max(0, b.t), 0);
// 焔纏い: 纏う(点火: 纏った瞬間に火の輪)
function pyWear() {
  const p = PY();
  P.pyT = wearDur(); P.pyExt = 0; S.hudDirty = true;
  const pow = cuV('passive', 'kindle');
  asMine(() => {
    if (pow) {
      const R = p.kindleR * P.area;
      forEachNear(P.x, P.y, R, e => {
        if (e.prop) return;
        const dealt = hitEnemy(e, pow, { src: 'kindle', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 60, col: '#ff8a3d' });
        if (dealt && !e.dead) addBurn(e, dealt * p.kindleBurn / 3 / dmgMul(), 3, 'kindle');
      });
      addRing(P.x, P.y, R, '#ff6a2a', { w: 3, life: 0.4 }); addRing(P.x, P.y, R * 0.6, '#ffc34a', { w: 2, life: 0.3 });
      addFlash(P.x, P.y, R * 2, '#ff8a3d', 0.3); shockAt(P.x, P.y, 1, 1);
    }
    burst(P.x, P.y, 18, ['#ff6a2a', '#ffc34a', '#ffffff'], { sp: 70, up: 30, glow: true, life: 0.45 });
  });
}
// 延焼: 残っていた炎上ダメージを周りの敵へ燃え移らせる。連鎖爆発: 倒れた場所で爆発(少し遅れて。連鎖しても深く再帰しない)
function pySpread(e, left) {
  const p = PY(), k = cuV('trait', 'spread', p.spreadPct), R = p.spreadR * P.area;
  const near = [];
  forEachNear(e.x, e.y, R, o => { if (o !== e && !o.dead && !o.prop) near.push(o); });
  near.sort((a, b) => d2(a.x, a.y, e.x, e.y) - d2(b.x, b.y, e.x, e.y));
  for (const o of near.slice(0, p.spreadN)) {
    addBurn(o, left * k / 3, 3, 'spread');
    for (let i = 0; i < 4; i++) { const u = i / 4; part(e.x + (o.x - e.x) * u, e.y + (o.y - e.y) * u, 0, -15, 0.35, pick(['#ff6a2a', '#ffc34a']), { glow: true }); }
  }
  if (hasSp('trait', 'spread')) {
    const x = e.x, y = e.y, CR = p.chainR * P.area;
    simTimeout(() => {
      if (state !== 'play') return;
      asMine(() => {
        forEachNear(x, y, CR, o => { if (!o.prop) hitEnemy(o, left, { src: 'spread', ang: Math.atan2(o.y - y, o.x - x), kb: 40, col: '#ff8a3d', noNum: Math.random() < 0.5 }); });
        addFlash(x, y, CR * 2.4, '#ff8a3d', 0.25); addRing(x, y, CR, '#ffc34a', { w: 2, life: 0.25 });
        burst(x, y, 14, ['#ff6a2a', '#ffc34a', '#fff6c8'], { sp: 90, glow: true, life: 0.35 });
      });
      AudioMan.boom();
    }, 80);
  }
}
// 炎壁: 周りの敵を押し返して炎上させる。少しの間 無敵
function pyroWall() {
  const p = PY(), R = p.wallR * P.area;
  staUse(wallCost());
  P.invT = Math.max(P.invT, dodgeIfr(p.wallIfr)); P.ifr = Math.max(P.ifr, dodgeIfr(p.wallIfr));
  asMine(() => {
    forEachNear(P.x, P.y, R, e => {
      if (e.prop || e.dead) return;
      const a = Math.atan2(e.y - P.y, e.x - P.x);
      if (!e.boss) { const k = 150 * (1 - (e.kbRes || 0)); e.kx += Math.cos(a) * k; e.ky += Math.sin(a) * k; }
      if (rollHit(e)) addBurn(e, p.wallBurn, 3, 'wall'); // 炎上は外れる(押し返しは防御なので外れない)
    });
    addRing(P.x, P.y, R, '#ff6a2a', { w: 3, life: 0.35 }); addRing(P.x, P.y, R * 0.55, '#ffc34a', { w: 2, life: 0.25 });
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; part(P.x + Math.cos(a) * 6, P.y + Math.sin(a) * 6, Math.cos(a) * R * 2.6, Math.sin(a) * R * 2.6 - 20, rand(0.25, 0.4), pick(['#ff6a2a', '#ffc34a', '#b8261a']), { glow: true }); }
    addFlash(P.x, P.y, R * 2, '#ff8a3d', 0.25); shake(3);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; fxBeam(P.x + Math.cos(a) * R * 0.75, P.y + Math.sin(a) * R * 0.75, { up: true, w: 1.5, H: 14, col: '#ff6a2a', mid: '#ffc34a', core: '#fff6c8', wob: 1, life: 0.35, drop: 0.08 }); } // 炎の壁が立ち上がる
  });
  playAnim('pWall', MOTIONS.pWall.dur); P.anim.keep = true;
  AudioMan.dash();
}
// 煉獄: 画面内の炎上中の敵全員の炎上を爆発させる
function pyroInferno() {
  const q = DATA.classes.pyro.q, k = 1 + (P.lvFx.qPow || 0), mul = cuV('q', 'pow', q.mul) * k, R = q.r * (1 + cuV('q', 'area')) * P.area;
  const cremate = hasSp('q', 'pow'), rekindle = hasSp('q', 'cd'), big = hasSp('q', 'area');
  const burning = enemies.filter(e => !e.dead && !e.prop && onScreen(e.x, e.y) && (e.burns || []).length);
  const blast = (x, y, pow, self) => forEachNear(x, y, R, o => {
    if (o === self || o.prop || o.dead) return;
    const d = hitEnemy(o, pow, { src: 'inferno', ang: Math.atan2(o.y - y, o.x - x), kb: 50, col: '#ff8a3d', noNum: Math.random() < 0.5 });
    if (big && d && !o.dead) addBurn(o, d * q.bigfire / 3 / dmgMul(), 3, 'inferno'); // 大火
  });
  asMine(() => {
    burning.forEach((e, i) => {
      const left = burnLeft(e), n = e.burns.length;
      e.burns = []; e.burnT = 0; // 炎上を消費
      hitEnemy(e, q.base * k + left * mul, { src: 'inferno', col: '#ffc34a' });
      if (e.dead && cremate) pySpread(e, left);                          // 火葬
      else if (!e.dead && rekindle) addBurn(e, left * q.rekindle / 3, 3, 'inferno'); // 残火
      blast(e.x, e.y, (q.pow + n * q.perStack) * k, e);
      if (i < 40) { // 火柱
        for (let j = 0; j < 10; j++) part(e.x + rand(-4, 4), e.y + rand(-2, 2), rand(-10, 10), -rand(80, 180), rand(0.3, 0.55), pick(['#ff6a2a', '#ffc34a', '#fff6c8', '#ffffff']), { glow: true, drag: 1.5, sz: pick([1, 2]) });
        addFlash(e.x, e.y, R * 2.2, '#ff8a3d', 0.35); addRing(e.x, e.y, R, '#ffc34a', { w: 2, life: 0.3 });
        if (i < 14) fxBeam(e.x, e.y + 2, { up: true, t: -i * 0.02, w: 3, H: 38, col: '#ff6a2a', mid: '#ffc34a', core: '#fff6c8', wob: 1.2, life: 0.55, drop: 0.12 }); // 立ちのぼる炎の柱
        if (i < 20) fxDecal(e.x, e.y + 2, 9, 'scorch', { life: 3 });
      }
    });
    if (!burning.length) { blast(P.x, P.y, q.pow * k, null); addRing(P.x, P.y, R, '#ff6a2a', { w: 3, life: 0.4 }); addFlash(P.x, P.y, R * 2.5, '#ff8a3d', 0.35); }
    burst(P.x, P.y, 40, ['#ff6a2a', '#ffc34a', '#ffffff'], { sp: 160, glow: true, life: 0.5 });
    fxRays(P.x, P.y - 10, 90, '#ff6a2a', { n: 14, life: 0.4, core: '#ffc34a' });
    for (let i = 0; i < 70; i++) part(cam.x + rand(0, GFX.VW), cam.y + GFX.VH * rand(0.35, 1.05), rand(-12, 12), -rand(30, 80), rand(0.8, 1.5), pick(['#ff6a2a', '#ffc34a', '#b8261a']), { glow: Math.random() < 0.5, drag: 0.6 }); // 画面じゅうに火の粉が舞い上がる
    shockAt(P.x, P.y, 1.6, 1); shake(10); hitstop(0.08); screenFlash(0.35 * SET.fxA, '#ff6a2a');
  });
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.boom(); AudioMan.crit(); AudioMan.impact();
}
