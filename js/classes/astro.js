// classes/astro.js — アストロマンサー: E スキル(ディメンション・リフト)/ クラスの実装(CLASS_RT.astro)/ 特性・パッシブ・Q の処理
'use strict';

// ディメンション・リフト(ブラックホールの E): 構え → 画面全体を異次元に沈める(P.rift。放った後は動ける)
//   every 秒ごとに画面内の全ての敵(ボスも)へ。敵が多いので当たり方は静か(音・光なし。数字はクリティカルだけ)
WEAPON_SKILL.bhole = {
  info(c, dmg) {
    const sk = DATA.weapons.bhole.skill, m = c.wm, dur = sk.dur + c.cuV('e', 'dur') + (m.eDur || 0), one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    const n = Math.floor(dur / sk.every + 1e-6), f = v => (v < 10 ? v.toFixed(1) : Math.round(v)); // 1回の威力は小さいので 10 未満は小数1桁
    return { name: sk.name, cat: 'e', desc: [
      _t`構え ${sk.windup}秒 → ${sk.dur}秒間、画面全体を異次元に沈める(放った後は動ける)`,
      _t`異次元の間、${sk.every}秒ごとに 画面内の全ての敵(ボスも)へ 武器の威力 × ${Math.round(sk.pow * 100)}%`,
      _t('距離に関係なく当たる(範囲のステータスは効かない)。効果中に画面へ入ってきた敵にも当たる'),
    ], rows: [
      ['CD', _t`<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      [_t('回数'), _t`${n} 回 / ${dur.toFixed(1)} 秒`],
      [_t('1回の威力'), `${f(one)} → <b>${f(one * c.atkMul)}</b>`, _t`武器の威力 × ${Math.round(sk.pow * 100)}%。攻撃力を掛けた値`],
      [_t('1体あたりの合計'), `${f(one * n)} → <b>${f(one * n * c.atkMul)}</b>`, _t('ずっと画面内にいた敵')],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.bhole || {};
    P.act = { slot: 'e', ph: 'wind', t: 0, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('gRift', MOTIONS.gRift.dur);
    skillCall(sk.name, '#c78bff', 'e', { fx: '#9a5ad0' }); AudioMan.click();
  },
  update(a, dt) {
    const sk = weaponSkill();
    P.moveMul = 0;
    if (a.t < sk.windup) { // 構え: 杖先の黒い球へ光の粒が吸い込まれる
      const hx = P.x + P.facing * 8, hy = P.y - 14;
      asMine(() => { for (let n = dt * 50; Math.random() < n; n--) { const r = rand(0, TAU), d = rand(10, 22); part(hx + Math.cos(r) * d, hy + Math.sin(r) * d, -Math.cos(r) * d * 3.5, -Math.sin(r) * d * 3.5, 0.28, pick(RIFT_FX), { glow: Math.random() < 0.4, drag: 0 }); } });
      return;
    }
    riftOpen(ME, a);
    P.act = null;
  },
  cast(X, a) { riftOpen(X, a); return null; },
  // 次元歪み(迅速の特殊強化): リフトのダメージを受けるたびに、その敵がどの攻撃からも受けるダメージが warp ずつ増える(リフトが終わるまで)
  dmgTaken: e => (e.riftT > S.time ? 1 + DATA.weapons.bhole.skill.warp * (e.riftN || 1) : 1),
  // スキルの実行とは別に毎フレーム: 異次元
  tick(dt) { riftTick(dt); },
};
const RIFT_FX = ['#c78bff', '#6a3aa0', '#2a1040', '#ff7ad9']; // 異次元の演出の色(暗い紫。明るいのは少しだけ)
// 画面内の敵(置物以外)。画面の縁で当たったり外れたりしないよう、少しだけ画面の外まで含める(onScreen の余白)
const riftTargets = () => enemies.filter(e => !e.dead && !e.prop && !e.hidden && onScreen(e.x, e.y));
// 異次元を開く: 画面の端から走るひび(画面の座標)を作る
//   異次元は画面に 1つだけ。開いている間にもう一度開かれたら 1つにまとめる(長い方・強い方。特殊強化はどれかの使い手が持っていれば)
//   Xs: 使い手 / cl: 全て自分以外の使い手
function riftOpen(X, a) {
  const sk = DATA.weapons.bhole.skill, m = P.wm.bhole || {}, VW = GFX.VW, VH = GFX.VH, cracks = [], dur = sk.dur + X.lv('dur') + (m.eDur || 0);
  const r = P.rift;
  if (r) { r.dur = Math.max(r.dur, r.t + dur); r.pow = Math.max(r.pow, a.pow); r.Xs.push(X); r.cl = r.cl && X.cl; r.pulse = 1; AudioMan.rift(); return; }
  for (let i = 0; i < 8; i++) {
    const side = i % 4, u = rand(0.1, 0.9);
    let x = side === 1 ? VW : side === 3 ? 0 : u * VW, y = side === 0 ? 0 : side === 2 ? VH : u * VH;
    let ang = Math.atan2(VH / 2 - y, VW / 2 - x) + rand(-0.5, 0.5);
    const pts = [[x, y]], L = rand(50, 110);
    for (let d = 0; d < L; d += 5) { ang += rand(-0.55, 0.55); x += Math.cos(ang) * 5; y += Math.sin(ang) * 5; pts.push([x, y]); }
    cracks.push(pts);
  }
  P.rift = { t: 0, dur, tick: sk.every, n: 0, pow: a.pow, pulse: 0, cracks, Xs: [X], cl: X.cl };
  asMine(() => { shake(4); hitstop(0.04); fxRays(X.x, X.y - 10, 90, '#6a3aa0', { n: 16, life: 0.42, core: '#ff7ad9' }); fxGlint(X.x + (X.face || 1) * 8, X.y - 14, 9, '#c78bff', { life: 0.3 }); });
  GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.7 * SET.fxA);
  AudioMan.rift();
}
const riftHas = (r, p) => r.Xs.some(X => X.sp(p));                // どれかの使い手が特殊強化を持っているか
const riftPow = r => 1 + Math.max(...r.Xs.map(X => X.lv('pow'))); // 威力のパス(一番高い使い手)
// 異次元(毎フレーム): every 秒ごとに画面内の全ての敵へ / 異次元送り / 終わりに次元断層
function riftTick(dt) {
  const r = P.rift;
  if (!r) return;
  const sk = DATA.weapons.bhole.skill;
  r.t += dt; r.tick -= dt; r.pulse = Math.max(0, r.pulse - dt * 3);
  if (r.tick <= 1e-6 && r.n < Math.floor(r.dur / sk.every + 1e-6)) {
    r.tick += sk.every; r.n++; r.pulse = 1;
    const dmg = wst('bhole').dmg * sk.pow * riftPow(r) * r.pow, el = clsNextEl(), warp = riftHas(r, 'cd'), until = S.time + Math.max(0, r.dur - r.t) + 0.05, marks = gq().parts > 0.5;
    asMine(() => {
      for (const e of riftTargets()) {
        hitEnemy(e, dmg, { src: 'rift', eHit: true, el, noNum: true, quiet: true, col: '#c78bff', cl: r.cl });
        if (e.dead) continue;
        if (warp) { e.riftN = (e.riftT > S.time ? e.riftN || 0 : 0) + 1; e.riftT = until; } // 次元歪み: 当たるたびに 1段ずつ(前のリフトの分は数えない)
        if (marks) fxScope(() => { const a = rand(0, Math.PI), L = (e.r || 4) + 2; slashes.push(owned({ mark: true, x: e.x - Math.cos(a) * L, y: e.y - 2 - Math.sin(a) * L, x1: e.x + Math.cos(a) * L, y1: e.y - 2 + Math.sin(a) * L, t: 0, life: 0.22, col: '#6a1a58', core: '#ff7ad9' })); }); // 体に細い裂け目が一瞬走る(画質で出す / 出さないので見た目の乱数の列)
      }
    });
    if (gq().post) GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.25 * SET.fxA);
    AudioMan.riftPulse();
  }
  if (riftHas(r, 'dur')) for (const e of riftTargets()) if (e.hp <= e.maxhp * (e.boss ? sk.exileBoss : sk.exile)) riftExile(e, r.cl); // 異次元送り
  if (r.t < r.dur) return;
  if (riftHas(r, 'pow')) riftFault(r); // 次元断層
  P.rift = null;
}
// 異次元送り: 残りの HP を与えて倒した扱い(内側へ縮んで消える)
function riftExile(e, cl) {
  const left = Math.max(0, Math.round(e.hp));
  P.totalDmg += left; P.dmgBy.rift = (P.dmgBy.rift || 0) + left;
  e.hp = 0;
  asMine(() => {
    addRing(e.x, e.y, 1, '#ff7ad9', { r0: (e.r || 4) + 8, life: 0.25 });
    for (let i = 0; i < 8; i++) { const a = rand(0, TAU), d = rand(6, 14); part(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, -Math.cos(a) * d * 5, -Math.sin(a) * d * 5, 0.2, pick(RIFT_FX), { glow: i % 3 === 0, drag: 0 }); }
    if (e.boss || e.elite) { addFlash(e.x, e.y, 70, '#5a1450', 0.35); shockAt(e.x, e.y, 1.2, 0.8); shake(5); }
  });
  if (e.boss) UI.announce(_t('異次元送り'), '');
  killEnemy(e, { src: 'rift', cl });
}
// 次元断層: 最後に画面全体が一度に裂ける(画面を横切る裂け目)
function riftFault(r) {
  const sk = DATA.weapons.bhole.skill, dmg = wst('bhole').dmg * sk.faultPow * riftPow(r) * r.pow, el = clsNextEl();
  asMine(() => {
    for (const e of riftTargets()) hitEnemy(e, dmg, { src: 'rift', eHit: true, el, quiet: true, noNum: Math.random() < 0.6, col: '#c78bff', cl: r.cl });
    for (let i = 0; i < 4; i++) {
      const a = rand(-0.5, 0.5) + (i % 2 ? Math.PI / 2 : 0), cx = cam.x + GFX.VW * rand(0.25, 0.75), cy = cam.y + GFX.VH * rand(0.25, 0.75), L = Math.hypot(GFX.VW, GFX.VH) * 0.6;
      slashes.push(owned({ line: true, x: cx - Math.cos(a) * L, y: cy - Math.sin(a) * L, x1: cx + Math.cos(a) * L, y1: cy + Math.sin(a) * L, t: 0, life: 0.4, w: 3, col: '#6a1a58', core: '#ff7ad9' }));
    }
    shake(9); hitstop(0.06);
    screenFlash(0.15 * SET.fxA, '#3a0a30');
  });
  GFX.fx.aberr = Math.max(GFX.fx.aberr, 1 * SET.fxA);
  AudioMan.cut(); AudioMan.boom();
}

// 質量(P.mass)は敵を倒すと溜まり、攻撃力が上がって足が遅くなる。質量放出(Space)と重力崩壊(Q)で使う
// 重力圏(半径 P.astR・遅くする割合 P.astK)の中では、敵の移動・攻撃と敵の弾がゆっくりになる(world.js の clsEnemySlow / clsProjTime / clsBossRate)
CLASS_RT.astro = {
  skills: ['q'],
  init() { P.mass = 0; P.sings = []; P.dash = null; P.ejectHeld = false; P.tideT = 0; P.astR = 0; P.astK = 0; P.walkT = 0; },
  update(dt) {
    if (P.dash) { // 質量放出: 跳んでいる間(無敵)。最後のフレームは残りの時間だけ進める(跳ぶ距離をぴったりにする)
      const k = Math.min(dt, P.dash.t);
      P.x += P.dash.vx * k; P.y += P.dash.vy * k; P.dash.t -= dt;
      P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.05, f: P.facing }]).slice(-6);
      if (P.dash.t <= 0) P.dash = null;
    }
    const held = defHeld();
    if (held && !P.ejectHeld && !P.dash) { if (P.sta >= astEjectCost()) astEject(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
    P.ejectHeld = held;
    const slow = astSlow();
    P.moveMul = P.dash ? 0 : 1 - slow;
    if (P.moving) P.walkT += dt * (1 - slow); // 歩きのモーション: 重いほど足取りが遅い
    astField(dt); // 重力圏
    astSings(dt); // 重力崩壊の特異点
  },
  onHurt: dmg => dmg * (1 - astGuard()), // 慣性(防御力・軽減より先)
  onMainHit() { if (hasSp('trait', 'accrete')) astGain(AST().catchN); }, // 重力捕獲: メイン武器の通常攻撃が当たるたびに
  onPickup() { astGain(AST().pickN * astAccrete()); }, // アイテム(経験値の宝石も)を拾うと質量が溜まる(吸積)
  onKill(e) { if (hasSp('trait', 'accrete')) astGain(AST().catchKill, e.x, e.y); },     // 重力捕獲: 敵を倒しても溜まる
  onBossKill(e) { if (hasSp('trait', 'accrete')) astGain(AST().catchKill, e.x, e.y); },
  atkBonus: () => astAtk(),
  critBonus: () => (hasSp('trait', 'dense') && P.mass >= AST().critAt ? AST().crit : 0), // 中性子星
  bossRate: e => astTime(e.x, e.y),  // 重力圏の中のボスは攻撃もゆっくり
  enemySlow: e => astTime(e.x, e.y), // 重力圏の中の敵の移動・攻撃(凍傷と掛け算)
  projTime(p) {                     // 重力圏の中の敵の弾(時間停止: 止まって stopT 秒で消える)
    if (!astIn(p.x, p.y)) return 1;
    if (hasSp('passive', 'area')) { p.stopT = S.time + AST().stopT; return 0; }
    return 1 - P.astK;
  },
  ifrMul: () => (hasSp('passive', 'inert') && P.mass >= AST().ifrAt ? AST().ifrK : 1), // 不動
  qStart() {
    const q = DATA.classes.astro.q;
    let t = mouseAimPt() || astCrowdPt(q.range);
    if (!t) { // 射程内の敵がみな自分のすぐ近く(50 以内)か、いない: 一番近い敵の方向(いなければ向いている方向)へ 70 離して生む(敵を自分から引きはがす)
      const e = nearestEnemy(P.x, P.y, q.range), a = e ? Math.atan2(e.y - P.y, e.x - P.x) : (P.facing < 0 ? Math.PI : 0);
      t = { x: P.x + Math.cos(a) * 70, y: P.y + Math.sin(a) * 70 };
    }
    const dd = Math.sqrt(d2(P.x, P.y, t.x, t.y));
    if (dd > q.range) t = { x: P.x + (t.x - P.x) * q.range / dd, y: P.y + (t.y - P.y) * q.range / dd };
    if (t.x !== P.x) P.facing = t.x < P.x ? -1 : 1;
    P.act = { slot: 'q', ph: 'wind', t: 0, x: t.x, y: t.y };
    playAnim('gCrush', MOTIONS.gCrush.dur);
    skillCall(DATA.classes.astro.q.name, '#ff7ad9', 'q'); AudioMan.click();
  },
  qUpdate(a, dt) {
    const q = DATA.classes.astro.q;
    P.moveMul = 0;
    if (a.t < q.windup) { // 構え: 周りが少し暗くなり、光の粒が両手の間へ流れ込む。照準位置に縮む輪
      P.dimK = Math.max(P.dimK || 0, 0.18 * Math.min(1, a.t / 0.15));
      asMine(() => {
        for (let n = dt * 45; Math.random() < n; n--) { const r = rand(0, TAU), d = rand(14, 28); part(P.x + P.facing * 5 + Math.cos(r) * d, P.y - 8 + Math.sin(r) * d * 0.6, -Math.cos(r) * d * 3, -Math.sin(r) * d * 1.8, 0.3, pick(AST_FX), { glow: Math.random() < 0.4, drag: 0 }); }
        if (Math.random() < dt * 20) addRing(a.x, a.y, 3, '#ff7ad9', { r0: 16, life: 0.15 });
      });
      return;
    }
    astCollapse(a);
    P.act = null;
  },
  res: () => ({ kind: 'mass', label: _t('質量'), v: P.mass, max: astMax(), dk: '#8a2a6e' }),
  staBroken: () => false,
  statuses() {
    const out = [];
    const pc = v => String(+(v * 100).toFixed(1));
    if (P.mass >= 1) out.push({ id: 'mass', glyph: '質', name: _t`質量 ${Math.floor(P.mass)}`, fx: _t`攻撃力 +${pc(astAtk())}%・移動速度 -${pc(astSlow())}%・重力圏 ${pc(P.astK)}%`, kind: 'buff' });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.astro.q.name, glyph: '崩' }),
  info(c) {
    const p = AST(), q = DATA.classes.astro.q, mass = c.run ? P.mass : 0, pc = v => String(+(v * 100).toFixed(2)); // % 表示(0.15 / 0.03 のような小さい値も出す)
    const max = p.max + c.cuV('trait', 'vessel') + (c.lvFx.massMax || 0), atkPer = c.cuV('trait', 'dense', p.atkPer);
    const ar = (1 + c.st.v.area) * c.st.mul.area, fieldR = (p.fieldR + c.cuV('passive', 'area') + (c.lvFx.fieldR || 0)) * ar, slowPer = c.cuV('passive', 'power', p.slowPer), inert = c.cuV('passive', 'inert');
    const k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0), qr = (1 + c.cuV('q', 'area')) * ar, rel = mass * p.ejectPart, qd = (q.pow + mass * q.perMass) * k, ej = p.ejectPow + rel * p.ejectPowPer;
    const slow = c.hasSp('trait', 'vessel') && mass >= max ? 0 : Math.min(p.spdCap, mass * p.spdPer);
    return [
      { key: _t('特性'), name: _t('質量'), cat: 'trait', desc: [
        _t`アイテム(経験値の宝石・コイン・肉・磁石・爆弾・宝箱)を拾うと質量が溜まる(1つにつき +${p.pickN})。時間では減らない`,
        _t`質量 1 につき攻撃力 +${pc(atkPer)}%、移動速度 -${pc(p.spdPer)}%(移動速度の低下は -${Math.round(p.spdCap * 100)}% まで)`,
        _t('減るのは質量放出(Space)と重力崩壊(Q)で使ったときだけ'),
      ], rows: [
        [_t('質量'), c.run ? `<b>${Math.floor(mass)}</b> / ${max}` : _t`上限 <b>${max}</b>`],
        [_t('攻撃力'), `<b>+${pc(mass * atkPer)}%</b>`, c.run ? _t('今の質量') : _t`上限で +${pc(max * atkPer)}%`],
        [_t('移動速度'), `<b>-${pc(slow)}%</b>`, c.run ? _t('今の質量') : _t`上限で -${pc(Math.min(p.spdCap, max * p.spdPer))}%`],
      ] },
      { key: _t('パッシブ'), name: _t('重力圏'), cat: 'passive', desc: [
        _t`自分の周り(半径 ${Math.round(fieldR)})の敵の移動速度・攻撃速度と、敵の弾が遅くなる`,
        _t`遅くなる割合は 質量 1 につき ${pc(slowPer)}%(最大 ${Math.round(p.slowCap * 100)}%)`,
      ], rows: [
        [_t('半径'), `<b>${Math.round(fieldR)}</b>`],
        [_t('遅くなる割合'), `<b>${pc(Math.min(p.slowCap, mass * slowPer))}%</b>`, c.run ? _t('今の質量') : _t`上限で ${pc(Math.min(p.slowCap, max * slowPer))}%`],
      ].concat(inert ? [[_t('被ダメージ'), `<b>-${pc(Math.min(p.guardCap, mass * inert))}%</b>`, _t`慣性: 質量 1 につき -${pc(inert)}%(最大 -${Math.round(p.guardCap * 100)}%)`]] : []) },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → 質量を全て使い、照準位置(射程 ${q.range})に特異点を生む`,
        _t`${q.dur}秒間、周り(半径 ${q.pullR} + 使った質量 × ${q.pullPer})の敵を中心へ引き寄せる(中心に近いほど強く。ボス以外)`,
        _t`最後に崩壊して、半径 ${q.r} の敵へ 基礎威力 ${q.pow} + 使った質量 × ${q.perMass}(質量 0 でも使える)`,
      ], rows: [
        ['CD', _t`<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('崩壊の威力'), `${Math.round(qd)} → <b>${Math.round(qd * c.atkMul)}</b>`, (c.run ? _t('今の質量を全て使ったとき') : _t('質量 0 のとき')) + _t('。攻撃力を掛けた値')],
        [_t('引き寄せ / 崩壊の半径'), `${Math.round((q.pullR + mass * q.pullPer) * qr)} / ${Math.round(q.r * qr)}`],
      ] },
      { key: 'Space', name: _t('質量放出'), desc: [
        _t`質量の ${Math.round(p.ejectPart * 100)}% を後ろへ噴き出して、移動方向へ跳ぶ(距離 ${p.ejectDist} + 使った質量 × ${p.ejectPer}。${p.ejectIfr}秒 無敵)`,
        _t`放出した質量は元の位置で爆ぜる(半径 ${p.ejectR}、基礎威力 ${p.ejectPow} + 使った質量 × ${p.ejectPowPer})`,
      ], rows: [
        [_t('スタミナ消費'), `<b>${p.ejectCost - (c.lvFx.ejectCut || 0)}</b>`],
        [_t('跳ぶ距離'), `<b>${Math.round(p.ejectDist + rel * p.ejectPer)}</b>`, c.run ? _t('今の質量') : _t('質量 0 のとき')],
        [_t('爆発の威力'), `${Math.round(ej)} → <b>${Math.round(ej * c.atkMul)}</b>`, _t('攻撃力を掛けた値')],
      ] },
    ];
  },
};

// ---------- アストロマンサー ----------
const AST = () => DATA.classes.astro.params;
const AST_FX = ['#ff7ad9', '#8a2a6e', '#3a1438', '#c78bff']; // 重力の演出の色(濃い桃〜紫。淡い色や白はブルームで白く飛ぶので、明るいのは芯の1色だけ)
const AST_INFALL = ['#ffcc8c', '#ff8c68', '#e25292', '#8a2a6e']; // 特異点へ落ちていく物質の色(降着円盤と同じ: 金 → 珊瑚 → 桃 → 暗い紫)
const astMax = () => AST().max + cuV('trait', 'vessel') + (P.lvFx.massMax || 0);                                         // 質量の上限(器・クラスLv3)
const astAtk = () => (P.mass || 0) * cuV('trait', 'dense', AST().atkPer);                                                 // 攻撃力の上昇(密度)
const astSlow = () => (hasSp('trait', 'vessel') && P.mass >= astMax() ? 0 : Math.min(AST().spdCap, (P.mass || 0) * AST().spdPer)); // 移動速度の低下(事象の地平: 上限のときは下がらない)
const astFieldR = () => (AST().fieldR + cuV('passive', 'area') + (P.lvFx.fieldR || 0)) * P.area;                         // 重力圏の半径(範囲・クラスLv8・範囲%)
const astWarp = () => Math.min(AST().slowCap, (P.mass || 0) * cuV('passive', 'power', AST().slowPer));                     // 時の歪み: 遅くなる割合(強度)
const astGuard = () => Math.min(AST().guardCap, (P.mass || 0) * cuV('passive', 'inert'));                                 // 慣性: 被ダメージの軽減
const astEjectCost = () => AST().ejectCost - (P.lvFx.ejectCut || 0);                                                      // 質量放出のスタミナ(クラスLv6)
const astAccrete = () => cuV('trait', 'accrete', 1);                                                                      // 吸積: 拾ったときの質量の倍率
const astIn = (x, y) => d2(x, y, P.x, P.y) < (P.astR || 0) * (P.astR || 0);                                              // 重力圏の中か
const astTime = (x, y) => (P.astK > 0 && astIn(x, y) ? 1 - P.astK : 1);                                                 // 重力圏の中の時間の進み方(1 = ふつう)
// 質量を得る(上限まで)。x, y: 倒した敵の位置(自分へ吸い込まれる粒を出す)
function astGain(n, x, y) {
  if (!(n > 0)) return;
  const before = P.mass;
  P.mass = Math.min(astMax(), P.mass + n);
  if (Math.floor(P.mass) !== Math.floor(before)) S.hudDirty = true;
  if (x !== undefined) asMine(() => part(x, y - 3, (P.x - x) * 1.6, (P.y - y) * 1.6, 0.55, pick(['#8a2a6e', '#ff7ad9']), { glow: true, drag: 0 }));
}
// 重力圏(毎フレーム): 半径と遅くする割合を決める / 潮汐力
function astField(dt) {
  const p = AST();
  P.astR = astFieldR(); P.astK = astWarp();
  if (!hasSp('passive', 'power') || (P.tideT -= dt) > 0) return;
  P.tideT = p.tideEvery;
  const pow = p.tidePow + P.mass * p.tidePer;
  asMine(() => forEachNear(P.x, P.y, P.astR, e => { if (!e.prop) hitEnemy(e, pow, { src: 'gtide', col: '#ff7ad9', noNum: Math.random() < 0.5 }); }));
}
// 質量放出(Space): 質量の一部を後ろへ噴き出して、移動方向へ跳ぶ。元の位置で爆ぜる
function astEject() {
  const p = AST(), rel = (P.mass || 0) * p.ejectPart, d = P.moving && P.dir ? P.dir : [P.facing, 0], len = Math.hypot(d[0], d[1]) || 1;
  const dist = p.ejectDist + rel * p.ejectPer, x = P.x, y = P.y, R = p.ejectR * P.area, pow = p.ejectPow + rel * p.ejectPowPer;
  staUse(astEjectCost());
  P.mass -= rel; S.hudDirty = true;
  P.dash = { vx: d[0] / len * dist / p.ejectTime, vy: d[1] / len * dist / p.ejectTime, t: p.ejectTime };
  P.invT = Math.max(P.invT, dodgeIfr(p.ejectIfr)); P.ifr = Math.max(P.ifr, dodgeIfr(p.ejectIfr));
  playAnim('gEject', MOTIONS.gEject.dur); P.anim.keep = true;
  asMine(() => {
    forEachNear(x, y, R, e => {
      if (e.prop) { killEnemy(e); return; }
      hitEnemy(e, pow, { src: 'geject', ang: Math.atan2(e.y - y, e.x - x), kb: 70, col: '#ff7ad9' });
    });
    const back = Math.atan2(-d[1], -d[0]); // 背中から暗い塵と桃色の光が噴き出す(跳ぶ向きと反対へ)
    for (let i = 0; i < 18; i++) { const s = rand(40, 130), a = back + rand(-0.6, 0.6); part(x, y - 3, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.55), pick(AST_FX), { glow: i % 3 === 0, drag: 3 }); }
    burst(x, y, 10 + Math.round(rel / 3), ['#3a1438', '#8a2a6e', '#ff7ad9'], { sp: 80, glow: true, life: 0.4 });
    addRing(x, y, R, '#ff7ad9', { w: 2, life: 0.3 }); addRing(x, y, R * 0.5, '#8a2a6e', { life: 0.25 });
    addFlash(x, y, R * 1.8, '#5a1450', 0.18);
    fxRays(x, y - 3, R * 1.3, '#8a2a6e', { n: 9, life: 0.25, core: '#ff7ad9' });
    shockAt(x, y, 0.6 + Math.min(0.8, rel / 40), 1.2); shake(2 + Math.min(4, rel / 10));
  });
  AudioMan.dash(); AudioMan.boom();
}
// 照準がないときの重力崩壊の位置: 射程内で敵が一番集まっている敵の位置。自分のすぐ近くは避ける(引き寄せた敵が自分に重ならないように)
function astCrowdPt(R) {
  let best = null, bn = 0;
  for (const e of enemies) {
    if (e.dead || e.prop || e.hidden) continue;
    const d = d2(e.x, e.y, P.x, P.y);
    if (d < 50 * 50 || d > R * R) continue;
    let n = 0;
    forEachNear(e.x, e.y, 40, o => { if (!o.dead && !o.prop) n++; });
    if (n > bn) { bn = n; best = e; }
  }
  return best;
}
// 重力崩壊(Q): 質量を全て使い、照準位置に特異点を生む(P.sings)。dur 秒引き寄せてから崩壊する
function astCollapse(a) {
  const q = DATA.classes.astro.q, used = P.mass || 0, ar = (1 + cuV('q', 'area')) * P.area, k = 1 + cuV('q', 'pow') + (P.lvFx.qPow || 0);
  P.mass = 0; S.hudDirty = true;
  P.sings.push({ x: a.x, y: a.y, t: 0, used, pullR: (q.pullR + used * q.pullPer) * ar, r: q.r * ar, dmg: (q.pow + used * q.perMass) * k,
    nova: hasSp('q', 'pow'), hawking: hasSp('q', 'cd'), white: hasSp('q', 'area'), boomed: false, novaDone: false });
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  asMine(() => { addRing(a.x, a.y, 24, '#ff7ad9', { r0: 4, w: 2, life: 0.35 }); burst(a.x, a.y, 14, AST_FX, { sp: 60, glow: true, life: 0.35 }); shockAt(a.x, a.y, 0.8, 0.6); shake(3); });
  GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.4 * SET.fxA);
  AudioMan.hum(q.dur);
}
// 特異点: 引き寄せ(中心に近いほど速い。ボス以外)→ 崩壊 → 超新星(特殊強化)
function astSings(dt) {
  if (!P.sings.length) return;
  const q = DATA.classes.astro.q;
  for (let i = P.sings.length - 1; i >= 0; i--) {
    const s = P.sings[i];
    s.t += dt;
    if (s.t < q.dur) {
      const R = s.pullR * Math.min(1, s.t * 4);
      forEachNear(s.x, s.y, R, e => {
        if (e.boss || e.prop || e.obj) return; // ボスが出した物は吸い込まれない
        const dd = Math.sqrt(d2(s.x, s.y, e.x, e.y)), u = 1 - Math.min(1, dd / s.pullR), ang = Math.atan2(s.y - e.y, s.x - e.x);
        const k = Math.min(dd, (q.pullMin + (q.pullMax - q.pullMin) * u) * (1 - (e.kbRes || 0) * 0.6) * dt);
        e.x += Math.cos(ang) * k; e.y += Math.sin(ang) * k;
      });
      // 周りの物質(光の粒)が渦を巻きながら、傾いた降着円盤の面へ落ちていく
      asMine(() => { for (let n = dt * 50; Math.random() < n; n--) { const a = rand(0, TAU), r = R * rand(0.4, 1), c = Math.cos(a), sn = Math.sin(a); part(s.x + c * r, s.y + sn * r * 0.45, (-c * 1.2 - sn * 0.8) * r * 1.5, (-sn * 1.2 + c * 0.8) * r * 0.68, 0.45, pick(AST_INFALL), { glow: Math.random() < 0.3, drag: 0 }); } });
      continue;
    }
    if (!s.boomed) { s.boomed = true; astCrush(s); }
    if (s.nova && !s.novaDone && s.t >= q.dur + q.novaT) { s.novaDone = true; astNova(s); }
    if (s.t >= q.dur + (s.nova ? q.novaT : 0) + 0.05) P.sings.splice(i, 1);
  }
}
// 崩壊: 半径 r の敵へ(ホワイトホール: 生き残りを外へ吹き飛ばしてスタン / ホーキング放射: 使った質量の一部が戻る)
function astCrush(s) {
  const q = DATA.classes.astro.q, out = e => { const dx = e.x - s.x, dy = e.y - s.y; return dx * dx + dy * dy < 1 ? rand(0, TAU) : Math.atan2(dy, dx); }; // 中心に重なった敵はランダムな向きへ
  asMine(() => {
    forEachNear(s.x, s.y, s.r, e => {
      if (e.prop) { killEnemy(e); return; }
      const a = out(e);
      hitEnemy(e, s.dmg, { src: 'gcrush', ang: a, kb: 60, col: '#ff7ad9' });
      if (!s.white || e.dead || missed === e) return; // 外れた敵は吹き飛ばない
      if (!e.boss) { const kb = q.whiteKb * (1 - (e.kbRes || 0)); e.kx += Math.cos(a) * kb; e.ky += Math.sin(a) * kb; }
      e.stun = Math.max(e.stun || 0, q.whiteStun); // ホワイトホール
    });
    // 一瞬縮んで → 桃色の閃光と衝撃波
    addFlash(s.x, s.y, s.r * 2.4, '#8a2a6e', 0.35); addFlash(s.x, s.y, s.r * 0.8, '#ff7ad9', 0.12);
    addRing(s.x, s.y, s.r, '#ff7ad9', { w: 3, life: 0.4 }); addRing(s.x, s.y, s.r * 1.4, '#8a2a6e', { w: 2, life: 0.5 });
    burst(s.x, s.y, 50, AST_FX, { sp: 170, glow: true, life: 0.6 });
    shockAt(s.x, s.y, 2, 0.9); shake(10); hitstop(0.07);
    screenFlash(0.15 * SET.fxA, '#3a0a30');
    fxRays(s.x, s.y, s.r * 1.5, '#e25292', { n: 18, life: 0.4, core: '#ffd8f2' });
    fxDecal(s.x, s.y, s.r * 0.8, 'crack', { n: 10, col: '#14041a', hot: '#c78bff', heatT: 1.2, life: 3.5 }); // 押しつぶされた地面
    if (s.white) { addRing(s.x, s.y, s.r * 2, '#c78bff', { r0: s.r * 0.3, w: 2, life: 0.45 }); shockAt(s.x, s.y, 1.4, 1.4); }
  });
  GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.9 * SET.fxA);
  if (s.hawking) astGain(s.used * q.hawking); // ホーキング放射
  AudioMan.crush(); AudioMan.impact();
}
// 超新星: 崩壊の novaT 秒後、外へ向かってもう一度(威力 ×novaK、半径 ×novaR)
function astNova(s) {
  const q = DATA.classes.astro.q, R = s.r * q.novaR;
  asMine(() => {
    forEachNear(s.x, s.y, R, e => {
      if (e.prop) { killEnemy(e); return; }
      hitEnemy(e, s.dmg * q.novaK, { src: 'gcrush', ang: Math.atan2(e.y - s.y, e.x - s.x), kb: 90, col: '#ff7ad9' });
    });
    addRing(s.x, s.y, R, '#ff7ad9', { r0: s.r * 0.5, w: 3, life: 0.45 }); addRing(s.x, s.y, R * 0.8, '#8a2a6e', { r0: s.r * 0.3, w: 2, life: 0.5 });
    addFlash(s.x, s.y, R * 1.6, '#8a2a6e', 0.3);
    burst(s.x, s.y, 40, AST_FX, { sp: 220, glow: true, life: 0.55 });
    fxRays(s.x, s.y, R * 1.2, '#8a2a6e', { n: 14, life: 0.36, core: '#ff7ad9' });
    shockAt(s.x, s.y, 1.6, 1.1); shake(7);
  });
  AudioMan.boom();
}
