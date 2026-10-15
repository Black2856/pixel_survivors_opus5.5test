// classes/assassin.js — ブラッドアサシン: E スキル(刃輪展開)/ クラスの実装(CLASS_RT.assassin)/ 特性・パッシブ・Q の処理
'use strict';

// 刃輪展開(オービットブレードの E): 構え → dur 秒間、刃の輪が広がる(半径・刃のサイズ・回転・威力が上がる)→ 終わりに刃が外へ飛び散る
//   展開中の状態は P.bladeE(world.js のオービットブレードが読む)。P.act は構えの間だけ(展開中も動けて、Q も使える)
WEAPON_SKILL.blade = {
  info(c, dmg) {
    const sk = DATA.weapons.blade.skill, m = c.wm, pw = (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0)), one = dmg * sk.pow * pw, sc = dmg * sk.scatter * pw;
    return { name: sk.name, cat: 'e', desc: [
      _t`構え ${sk.windup}秒 → ${sk.dur}秒間、刃の輪が広がる(使っている間も動ける)`,
      _t`回転半径 ×${sk.rMul}、刃のサイズ ×${sk.size}、回転速度 ×${sk.rot}、刃の威力 ×${Math.round(sk.pow * 100)}%`,
      _t`終わりに刃が回転しながら外へ飛び散る(1枚ごとに 武器の威力 × ${Math.round(sk.scatter * 100)}%、貫通)`,
    ], rows: [
      ['CD', _t`<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      [_t('持続'), _t`${(sk.dur + (m.eDur || 0)).toFixed(1)} 秒`],
      [_t('展開中の刃の威力'), `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, _t`武器の威力 × ${Math.round(sk.pow * 100)}%。攻撃力を掛けた値`],
      [_t('飛び散る刃の威力'), `${Math.round(sc)} → <b>${Math.round(sc * c.atkMul)}</b>`],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.blade || {};
    P.act = { slot: 'e', ph: 'wind', t: 0 };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('bRing', MOTIONS.bRing.dur);
    skillCall(sk.name, '#d8e4ff', 'e', { fx: '#8ea6d8' }); AudioMan.click();
  },
  update(a, dt) {
    const sk = weaponSkill(), m = P.wm.blade || {};
    P.moveMul = 0;
    if (a.t < sk.windup) { // 構え: 刃に光が集まる
      if (Math.random() < dt * 40) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 20, P.y + Math.sin(r) * 14, -Math.cos(r) * 60, -Math.sin(r) * 40, 0.25, pick(['#d8e4ff', '#ffffff']), { glow: true, drag: 0 }); }
      return;
    }
    bladeOpen(ME, clsESkillMul() * (1 + (m.ePow || 0)));
    P.act = null;
  },
  // 分身など: 自分のオービットブレードの輪を広げる(輪は自分の武器なので、自分の周りで広がる)
  cast(X, a) { if (P.weapons.blade) bladeOpen(X, a.pow); return null; },
  // 展開中(毎フレーム)。連環: 展開中の撃破で持続 +killExt / 渦: 輪の外側の敵を輪へ引き寄せる
  tick(dt) {
    const b = P.bladeE;
    if (!b) return;
    const sk = DATA.weapons.blade.skill, has = p => b.Xs.some(X => X.sp(p));
    if (S.kills > b.kills && has('cd') && b.ext < sk.killExtMax) { const add = Math.min(sk.killExtMax - b.ext, (S.kills - b.kills) * sk.killExt); b.t += add; b.ext += add; }
    b.kills = S.kills;
    if (has('area')) {
      const R = (wst('blade').radius || 20) * P.area * b.rMul;
      forEachNear(P.x, P.y, R * sk.pullK, e => {
        if (e.boss || e.prop || e.dead) return;
        const d = Math.hypot(e.x - P.x, e.y - P.y);
        if (d <= R) return;
        const k = Math.min(d - R, sk.pull * dt);
        e.x -= (e.x - P.x) / d * k; e.y -= (e.y - P.y) / d * k;
      });
    }
    if ((b.t -= dt) > 0) return;
    P.bladeE = null;
    bladeScatter(b);
  },
};
// 刃輪展開を始める(P.bladeE。world.js のオービットブレードが読む)。展開中にもう一度使われたら 1つにまとめる(長い方・強い方。特殊強化はどちらかが持っていれば)
//   Xs: 使い手(連環・渦・刃の雨はここから読む)/ cl: 全て自分以外の使い手
function bladeOpen(X, pow) {
  const sk = DATA.weapons.blade.skill, m = P.wm.blade || {}, pw = (1 + X.lv('pow')) * pow;
  const b = { t: sk.dur + (m.eDur || 0), ext: 0, kills: S.kills, rMul: sk.rMul * (1 + X.lv('area')), size: sk.size, rot: sk.rot, pow: sk.pow * pw, scat: sk.scatter * pw, Xs: [X], cl: X.cl };
  const o = P.bladeE;
  if (o) { o.t = Math.max(o.t, b.t); o.rMul = Math.max(o.rMul, b.rMul); o.pow = Math.max(o.pow, b.pow); o.scat = Math.max(o.scat, b.scat); o.Xs.push(X); o.cl = o.cl && X.cl; }
  else P.bladeE = b;
  const R = (wst('blade').radius || 20) * P.area * P.bladeE.rMul;
  asMine(() => {
    addRing(P.x, P.y, R, '#ffffff', { w: 2, life: 0.35 }); addRing(P.x, P.y, R * 0.6, '#d8e4ff', { life: 0.3 });
    burst(P.x, P.y, 24, ['#d8e4ff', '#ffffff', '#8ea6d8'], { sp: 120, glow: true, life: 0.4 });
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + rand(-0.2, 0.2); fxGlint(P.x + Math.cos(a) * R, P.y + Math.sin(a) * R, rand(4, 7), '#d8e4ff', { t: -i * 0.03, life: 0.22 }); } // 輪の上を刃のきらめきが一周する
    fxRays(P.x, P.y - 2, R * 1.2, '#8ea6d8', { n: 12, life: 0.3, core: '#d8e4ff' });
    shockAt(P.x, P.y, 1, 1.1); shake(3); hitstop(0.04);
  });
  AudioMan.slash(); AudioMan.zap();
}
// 刃輪展開の終わり: 刃が回転しながら外へ飛び散る(輪の回転を保ったまま、らせんを描いて広がる)
//   刃の雨: rainT 秒 広がった後、自分のところへ戻ってきてもう一度当たる(戻りの威力 ×rainPow)
function bladeScatter(b) {
  const sk = DATA.weapons.blade.skill, w = P.weapons.blade;
  if (!w || !w.blades) return;
  const st = wst('blade'), col = w.evo ? '#8e0016' : '#d8e4ff', back = b.Xs.some(X => X.sp('pow')), mcd = (P.wm.blade || {}).cd || 0;
  const omega = st.rot * P.atkSpd / (P.cdMul * (1 - mcd)) * b.rot; // 飛び散る直前の輪の回る速さ(rad/s)
  const o = s => ({ dmg: st.dmg * b.scat, pierce: 999, src: 'blade', eHit: true, r: 5 * s, sz: s, col, evo: w.evo, cl: b.cl }); // s: 刃の大きさ(当たり判定・見た目)
  for (const bl of w.blades) {
    const a = Math.atan2(bl.y - P.y, bl.x - P.x), r = Math.hypot(bl.x - P.x, bl.y - P.y), s = bl.s || 2, dir = bl.dir || 1;
    const vt = Math.sign(dir) * Math.min(sk.spinMax, omega * Math.abs(dir) * r); // 回る向きと速さ(接線方向)
    fire('bscatter', bl.x, bl.y, a, sk.scatterSpd, Object.assign(o(s), { life: back ? sk.rainT : sk.scatterT,
      spiral: { cx: P.x, cy: P.y, r, a, vr: sk.scatterSpd, vt },
      onEnd: back ? p => fire('bscatter', p.x, p.y, Math.atan2(P.y - p.y, P.x - p.x), sk.scatterSpd, Object.assign(o(s), { dmg: p.dmg * sk.rainPow, life: 3, toP: true, speed: sk.scatterSpd * 1.3 })) : null }));
  }
  asMine(() => { addRing(P.x, P.y, 30, col, { w: 2, life: 0.3 }); burst(P.x, P.y, 16, [col, '#ffffff'], { sp: 140, glow: true, life: 0.3 }); fxRays(P.x, P.y - 2, 64, w.evo ? '#8e0016' : '#8ea6d8', { n: 14, life: 0.3, core: w.evo ? '#c0102a' : '#d8e4ff' }); shake(4); });
  AudioMan.slash();
}

CLASS_RT.assassin = {
  skills: ['q'],
  init() { P.dash = null; P.dashHeld = false; P.dashHit = null; P.pact = null; P.asBucket = asLeechCap(); },
  update(dt) {
    const p = AS(), q = DATA.classes.assassin.q;
    // 血の渇き: 回復の上限(1秒に leechCap まで)。使った分は少しずつ戻る
    const cap = asLeechCap();
    P.asBucket = Math.min(cap, (P.asBucket || 0) + cap * dt);
    // 血の契約: 効果中は赤い霧をまとう / 血の嵐
    if (P.pact) {
      P.pact.t -= dt;
      if (Math.random() < dt * 14) part(P.x + rand(-5, 5), P.y + rand(-4, 6), rand(-8, 8), -rand(10, 25), 0.5, pick(BLOOD), { glow: Math.random() < 0.4 });
      if (hasSp('q', 'pow') && (P.pact.storm -= dt) <= 0) { P.pact.storm += q.stormEvery; asStorm(); }
      if (P.pact.t <= 0) { P.pact = null; S.hudDirty = true; }
    }
    // 瞬影: 駆け抜けながら、通った敵に一度ずつ
    if (P.dash) {
      P.x += P.dash.vx * dt; P.y += P.dash.vy * dt; P.dash.t -= dt;
      P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.1, f: P.facing }]).slice(-5);
      asMine(() => forEachNear(P.x, P.y, p.dashR, e => {
        if (e.prop || e.dead || P.dashHit.has(e.id)) return;
        P.dashHit.add(e.id);
        hitEnemy(e, p.dashPow, { src: 'adash', ang: Math.atan2(P.dash.vy, P.dash.vx), kb: 30, col: '#8e0016' });
        addBleed(e, p.dashBleed);
        slashes.push({ mark: true, x: e.x - 5, y: e.y + 4, x1: e.x + 5, y1: e.y - 4, t: 0, life: 0.14, core: '#c0102a', col: '#5a000c' });
      }));
      if (P.dash.t <= 0) P.dash = null;
    }
    const held = defHeld();
    if (held && !P.dashHeld && !P.dash) { if (P.sta >= p.dashCost) assassinDash(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
    P.dashHeld = held;
    P.moveMul = P.dash ? 0 : P.pact ? 1 + q.spd * asPactK() : 1;
  },
  onHurt: dmg => dmg,
  // 血の渇き: メイン武器の命中ごとに leech を回復(撃破時の回復と合わせて 1秒に 最大HP × leechCap まで。血宴で上限アップ)
  onMainHit() { asHeal(AS().leech * asLeechK()); },
  // 血刃: 斬撃タイプの武器の命中(通常攻撃・E)で出血 +1
  onWeaponHit(e, dmg, crit, o) {
    const k = o && o.eHit ? P.mainW : o && o.src;
    if (isCut(k)) addBleed(e, 1);
  },
  bleedCap: () => asBleedCap(),
  bleedDur: () => cuV('trait', 'last'),                                   // 延命
  bleedMul: () => 1 + cuV('trait', 'deep') + (P.lvFx.bleedDmg || 0),      // 深傷・クラスLv3
  bleedFull: () => hasSp('trait', 'deep'),                                 // 鮮血
  critBonus: e => (hasSp('trait', 'last') ? (e.bleed || 0) * AS().critPer : 0), // 致命傷
  dmgTaken: e => (P.pact ? 1 + (e.bleed || 0) * DATA.classes.assassin.q.perStack * asPactK() : 1), // 血の契約: 出血1につき与ダメ +1%
  onKill(e) {
    if (!(e.bleed > 0)) return;
    // 血の渇き: 出血中の敵を倒すと、最大HP × 出血 × killPer を回復(1秒の上限に含む。貪りで 1スタックあたりが増える)
    asHeal(P.maxhp * e.bleed * cuV('passive', 'greed', AS().killPer) * asLeechK());
    if (hasSp('trait', 'rend')) asChain(e);  // 血の連鎖
    const q = DATA.classes.assassin.q;
    if (P.pact && hasSp('q', 'dur') && P.pact.ext < q.extendMax) { // 血の契り
      const add = Math.min(q.extendMax - P.pact.ext, q.extend);
      P.pact.t += add; P.pact.ext += add; P.pact.max += add;
    }
  },
  onOverheal(n) { if (hasSp('passive', 'thirst') && n > 0) timedShield(n * AS().shieldK, AS().shieldT); }, // 血の盾: 超えた分 × shieldK
  atkBonus: () => 0,
  qStart() {
    const q = DATA.classes.assassin.q, a = aimDir((q.crossD + q.crossL) * 1.5);
    if (Math.cos(a) !== 0) P.facing = Math.cos(a) < 0 ? -1 : 1;
    P.act = { slot: 'q', ph: 'wind', t: 0, a };
    playAnim('bPact', MOTIONS.bPact.dur);
    slowmo(0.5, 0.2);
    skillCall(q.name, '#c0204a', 'q', { fx: '#8e0016' }); AudioMan.click();
  },
  qUpdate(a, dt) {
    const q = DATA.classes.assassin.q;
    P.moveMul = 0;
    if (a.t < q.windup) { // 構え: 体から赤い霧が立ちのぼる
      asMine(() => { if (Math.random() < dt * 50) part(P.x + rand(-7, 7), P.y + rand(-2, 7), rand(-10, 10), -rand(25, 50), 0.45, pick(BLOOD), { glow: true, drag: 1 }); });
      return;
    }
    assassinPact(a.a);
    P.act = null;
  },
  res: () => (P.pact
    ? { kind: 'pact', label: _t('血の契約'), v: Math.ceil(P.pact.t), max: Math.max(1, Math.ceil(P.pact.max)), dk: '#6a0a1e' }
    : { kind: 'bleed', label: _t('出血の上限'), v: asBleedCap(), max: Math.max(1, asBleedMax()), dk: '#6a0a1e' }),
  staBroken: () => false,
  statuses() {
    const out = [], q = DATA.classes.assassin.q, k = asPactK();
    if (P.pact) out.push({ id: 'pact', glyph: '契', name: _t('血の契約'), fx: _t`移動速度 +${Math.round(q.spd * k * 100)}% 出血1につき与ダメ +${(q.perStack * k * 100).toFixed(1)}%` + (hasSp('passive', 'feast') ? _t` 血の渇きの上限 ×${AS().pactCap}` : ''), t: P.pact.t, max: P.pact.max, kind: 'buff' });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.assassin.q.name, glyph: '契' }),
  info(c) {
    const p = AS(), q = DATA.classes.assassin.q, B = DATA.bleed, k = (1 + c.cuV('q', 'pow')) * (1 + (c.lvFx.qPow || 0));
    const lk = 1 + c.cuV('passive', 'thirst') + (c.lvFx.leech || 0), pk = c.cuV('q', 'price', 1);
    return [
      { key: _t('特性'), name: _t('血刃'), cat: 'trait', desc: [
        _t('斬撃タイプの武器(刀・騎士剣・オービットブレード・スローイングアックス)の命中で、出血 +1(通常攻撃・E とも)'),
        _t`出血の最大スタック = 斬撃タイプの武器の所持数 × ${p.perCut}`,
        _t`出血: 1スタックにつき毎秒 最大HP の ${(B.pct * 100).toFixed(1)}%(ボス ×${B.boss}、エリート ×${B.elite})`,
      ], rows: [
        [_t('出血の最大スタック'), c.run ? `<b>${asBleedCap()}</b>` : _t`斬撃タイプ 1本につき <b>${p.perCut + c.cuV('trait', 'rend')}</b>`],
        [_t('出血ダメージ'), `<b>+${Math.round((c.cuV('trait', 'deep') + (c.lvFx.bleedDmg || 0)) * 100)}%</b>`],
        [_t('出血の持続'), _t`${B.dur + c.cuV('trait', 'last')} 秒`],
      ] },
      { key: _t('パッシブ'), name: _t('血の渇き'), cat: 'passive', desc: [
        _t`メイン武器の攻撃が当たるたびに HP を ${p.leech} 回復する`,
        _t`出血中の敵を倒すと、その敵の出血 1スタックにつき 最大HP の ${(p.killPer * 100).toFixed(2)}% を回復する`,
        _t`血の渇きの回復は、合わせて 1秒に 最大HP の ${p.leechCap * 100}% まで`,
      ], rows: [
        [_t('命中ごとの回復'), `<b>${(p.leech * lk).toFixed(2)}</b>`],
        [_t('撃破時の回復'), _t`出血 1 につき 最大HP の <b>${(c.cuV('passive', 'greed', p.killPer) * lk * 100).toFixed(3)}%</b>`],
        [_t('1秒の上限'), _t`最大HP の <b>${(c.cuV('passive', 'feast', p.leechCap) * 100).toFixed(1)}%</b>`],
      ] },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → 今の HP の ${Math.round(q.pay * 100)}% を支払う(HP は 1 未満にならない)`,
        _t`支払った瞬間、照準方向へ×字に交差する二筋の斬撃: 基礎威力 ${q.pow} + 支払った HP × ${q.perHp}、出血 +${q.bleed}(1体に1回)`,
        _t`  → 交差の中心は ${q.crossD} 前、1本の長さ ${q.crossL * 2}、線から ${q.crossW} 以内に当たる`,
        _t`${q.dur}秒間、移動速度 +${Math.round(q.spd * 100)}%、敵の出血 1スタックにつき与えるダメージ +${Math.round(q.perStack * 100)}%`,
      ], rows: [
        ['CD', _t`<b>${(q.cd * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('斬り裂きの威力'), _t`${q.pow} + 支払った HP × ${q.perHp} → <b>×${(k * c.atkMul).toFixed(2)}</b>`, _t('強化・攻撃力の倍率')],
        [_t('効果'), _t`移動速度 +${Math.round(q.spd * pk * 100)}%、出血1につき +${(q.perStack * pk * 100).toFixed(1)}%、${q.dur + c.cuV('q', 'dur')} 秒`],
      ] },
      { key: 'Space', name: _t('瞬影'), desc: [
        _t`移動方向へ ${p.dashDist} 駆け抜ける(${p.dashIfr}秒 無敵)`,
        _t`通り抜けた敵に 基礎威力 ${p.dashPow} と出血 +${p.dashBleed}`,
      ], rows: [
        [_t('スタミナ消費'), `<b>${p.dashCost}</b>`],
      ] },
    ];
  },
};

// ---------- ブラッドアサシン: 血刃・血の渇き・血の契約・瞬影 ----------
const AS = () => DATA.classes.assassin.params;
const isCut = k => !!(k && DATA.weapons[k] && DATA.weapons[k].cut); // 斬撃タイプの武器
// 出血の最大スタック: 斬撃タイプの所持数 × (perCut + 裂創)。メイン武器も数える
const asPerCut = () => AS().perCut + cuV('trait', 'rend');
function asBleedCap() {
  let n = 0;
  for (const k in P.weapons) if (isCut(k)) n++;
  return n * asPerCut();
}
// HUD 用: 出血の最大スタックの上限(武器枠を全て斬撃タイプにしたとき)
function asBleedMax() {
  const cuts = Object.keys(DATA.weapons).filter(isCut).length;
  return Math.min(S.weaponSlots, cuts) * asPerCut();
}
// 血の渇きの回復量の倍率(渇き・クラスLv6)
const asLeechK = () => 1 + cuV('passive', 'thirst') + (P.lvFx.leech || 0);
// 命中ごとの回復の上限(1秒あたり。血宴で上がる。饗宴: 血の契約の効果中 × pactCap)
const asLeechCap = () => P.maxhp * cuV('passive', 'feast', AS().leechCap) * (P.pact && hasSp('passive', 'feast') ? AS().pactCap : 1);
const asPactK = () => cuV('q', 'price', 1); // 代償: 血の契約の効果の倍率
// 血の渇きの回復(数字は出さない)。命中ごと・撃破時とも、1秒の上限の枠から取る。生き血: 枠を超えた分も × overK で回復する
function asHeal(n) {
  if (!(n > 0)) return;
  const take = Math.min(n, Math.max(0, P.asBucket)), over = hasSp('passive', 'greed') ? (n - take) * AS().overK : 0;
  P.asBucket -= take;
  if (take + over > 0) heal(take + over, true);
}
// 血の連鎖: 倒した敵の出血の半分を、近くの敵 chainN 体へ移す
function asChain(e) {
  const p = AS(), n = Math.floor(e.bleed / 2);
  if (n <= 0) return;
  const near = [];
  forEachNear(e.x, e.y, p.chainR, t => { if (t !== e && !t.dead && !t.prop) near.push(t); });
  near.sort((a, b) => d2(e.x, e.y, a.x, a.y) - d2(e.x, e.y, b.x, b.y));
  asMine(() => near.slice(0, p.chainN).forEach(t => {
    addBleed(t, n);
    slashes.push({ line: true, x: e.x, y: e.y, x1: t.x, y1: t.y, t: 0, life: 0.18, w: 1, col: '#5a000c', core: '#a0001a' });
  }));
}
// 瞬影: 移動方向へ駆け抜ける
function assassinDash() {
  const p = AS(), d = P.moving && P.dir ? P.dir : [P.facing, 0], len = Math.hypot(d[0], d[1]) || 1;
  staUse(p.dashCost);
  P.dash = { vx: d[0] / len * p.dashDist / p.dashTime, vy: d[1] / len * p.dashDist / p.dashTime, t: p.dashTime };
  P.dashHit = new Set();
  P.invT = Math.max(P.invT, dodgeIfr(p.dashIfr)); P.ifr = Math.max(P.ifr, dodgeIfr(p.dashIfr));
  playAnim('bStep', MOTIONS.bStep.dur); P.anim.keep = true;
  asMine(() => burst(P.x, P.y, 10, ['#8e0016', '#1a1420', '#3a0008'], { sp: 60, life: 0.3 }));
  AudioMan.dash();
}
// 血の契約: 今の HP の一部を支払い(HP は 1 未満にならない。シールドでは払えない)、照準方向へ×字に交差する二筋の斬撃 → 効果中は加速・出血の敵へのダメージアップ
//   斬撃は鬼神・村正の一閃と同じ作り(world.js の makeCut。時刻はゲーム時間)
//   0 〜 0.07   1本目: 左上から右下へ切っ先が走る(照準方向を右としたとき)
//   〜 0.15     2本目: 右上から左下へ、1本目に交差するように走る
//   0.2         交差しきった瞬間に、二筋の上の敵へまとめて炸裂(1体に1回)
function assassinPact(a) {
  const q = DATA.classes.assassin.q, lv = cuLv('q', 'price'), allIn = hasSp('q', 'price');
  const pay = lv ? q.pricePay[lv - 1] : q.pay;
  const paid = Math.max(0, allIn ? P.hp - 1 : Math.min(P.hp - 1, P.hp * pay));
  P.hp -= paid; S.hudDirty = true;
  if (allIn && paid > 0) timedShield(paid * q.allIn, q.allInT); // 捨て身
  const dmg = (q.pow + paid * q.perHp) * (1 + cuV('q', 'pow')) * (1 + (P.lvFx.qPow || 0));
  const cx = P.x + Math.cos(a) * q.crossD * P.area, cy = P.y + Math.sin(a) * q.crossD * P.area, L = q.crossL * P.area, W = q.crossW * P.area;
  const t1 = a + Math.PI / 4, t2 = a - Math.PI / 4;
  const c1 = makeCut(cx - Math.cos(t1) * L, cy - Math.sin(t1) * L, cx + Math.cos(t1) * L, cy + Math.sin(t1) * L, { omen: 0, run: 0.07, hit: 0.2, life: 0.7, wk: 1.25, pal: CUT_PAL_BLOOD });
  const c2 = makeCut(cx + Math.cos(t2) * L, cy + Math.sin(t2) * L, cx - Math.cos(t2) * L, cy - Math.sin(t2) * L, { omen: 0.08, run: 0.15, hit: 0.2, life: 0.75, wk: 1.25, late: true, pal: CUT_PAL_BLOOD });
  c1.ev.push({ at: 0, fn: () => { AudioMan.cut(); GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.8 * SET.fxA); } }, { at: 0.07, fn: () => cutSpark(c1, 16, ['#d0142a', '#8e0016', '#5a000c']) });
  c2.ev.push({ at: 0.08, fn: () => { AudioMan.cut(); GFX.fx.aberr = Math.max(GFX.fx.aberr, 1 * SET.fxA); } }, { at: 0.15, fn: () => { cutSpark(c2, 16, ['#d0142a', '#8e0016', '#5a000c']); hitstop(0.04); } });
  c2.onHit = () => { // 交差しきった瞬間: 二筋の上の敵へまとめて炸裂
    if (state !== 'play' && state !== 'levelup') return;
    asMine(() => {
      const hit = new Set();
      forEachNear(cx, cy, L + W + 8, e => { if (!e.dead && (cutNear(c1, e.x, e.y, W + (e.r || 4)) || cutNear(c2, e.x, e.y, W + (e.r || 4)))) hit.add(e); });
      let marks = 0;
      for (const e of hit) {
        if (e.prop) { killEnemy(e); continue; }
        hitEnemy(e, dmg, { src: 'pact', ang: a, kb: 90, col: '#8e0016' });
        addBleed(e, q.bleed);
        if (marks++ < 8) for (const t of [t1, t2]) slashes.push({ mark: true, x: e.x - Math.cos(t) * 7, y: e.y - Math.sin(t) * 7, x1: e.x + Math.cos(t) * 7, y1: e.y + Math.sin(t) * 7, t: 0, life: 0.18, core: '#c0102a', col: '#5a000c' }); // 敵の上の×字の斬り跡
        for (let i = 0; i < 8; i++) { const d = rand(0, TAU), sp = rand(40, 120); part(e.x, e.y, Math.cos(d) * sp, Math.sin(d) * sp - 20, rand(0.3, 0.6), pick(BLOOD), { g: 220, drag: 2, sz: pick([1, 2]) }); } // 血しぶき
      }
      for (const s of [c1, c2]) for (let i = 0; i < 18; i++) { // 墨のような飛沫(線全体から)
        const [x, y] = cutPt(s, Math.random()), k = Math.random() < 0.5 ? -1 : 1, sp = rand(20, 110);
        part(x, y, s.nx * k * sp, s.ny * k * sp - 10, rand(0.4, 0.9), pick(['#0a0002', '#1e0004', '#3a0008', '#5a000c', '#8e0016']), { g: 140, drag: 2.5, sz: pick([1, 1, 2]), glow: Math.random() < 0.2 });
      }
      addFlash(cx, cy, L * 2.4, '#6a000e', 0.35); addRing(cx, cy, L * 0.8, '#8e0016', { w: 3, life: 0.4 }); addRing(cx, cy, L * 0.45, '#c0102a', { w: 2, life: 0.3 });
      fxRays(cx, cy, L * 1.6, '#8e0016', { n: 14, life: 0.36, core: '#d0142a' });
      fxDecal(cx, cy, L * 0.8, 'scorch', { col: '#2a0006', hot: '#5a000c', heatT: 0.01, life: 3.5 }); // 血だまり
      for (const s of [c1, c2]) fxDecal((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, L + 4, 'scar', { hx: (s.x1 - s.x0) / 2, hy: (s.y1 - s.y0) / 2, col: '#1e0004', hot: '#8e0016', heatT: 0.9, life: 3 }); // 地面に残る×字の斬撃の跡
      shockAt(cx, cy, 1.6, 1); shake(9); hitstop(0.07); screenFlash(0.3 * SET.fxA, '#3a0008');
    });
    AudioMan.cutHit(); AudioMan.crit(); AudioMan.impact();
  };
  asMine(() => burst(P.x, P.y, 24, BLOOD, { sp: 110, up: 20, glow: true, life: 0.5 })); // 支払いの瞬間: 体から血の霧が噴き出す
  if (paid >= 1) addFloat(P.x, P.y - 16, '-' + Math.round(paid), '#ff3b5c', 1.2);
  const dur = q.dur + cuV('q', 'dur');
  P.pact = { t: dur, max: dur, ext: 0, storm: q.stormEvery };
  setCd('q', q.cd * P.cdMul);
  AudioMan.boom(); AudioMan.crit();
}
// 血の嵐: 血の契約の間、周りを斬る
function asStorm() {
  const q = DATA.classes.assassin.q, R = q.stormR * P.area;
  asMine(() => {
    forEachNear(P.x, P.y, R, e => {
      if (e.prop) { killEnemy(e); return; }
      hitEnemy(e, q.stormPow, { src: 'pact', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 30, col: '#8e0016', noNum: Math.random() < 0.5 });
      addBleed(e, 1);
    });
    slashes.push({ x: P.x, y: P.y, follow: true, a: rand(0, TAU), r: R, t: 0, life: 0.22, full: true, pal: SWING_PAL.blood });
  });
  AudioMan.slash();
}
