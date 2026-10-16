// classes/electro.js — エレクトロマンサー: E スキル(グラビティスパーク)/ クラスの実装(CLASS_RT.electro)/ 特性・パッシブ・Q の処理
'use strict';

// グラビティスパーク(サンダーの E): 構え → 照準位置に雷の球。周りの敵を1回大きく引き寄せて爆発(zones の 'gspark')
WEAPON_SKILL.thunder = {
  info(c, dmg) {
    const sk = DATA.weapons.thunder.skill, m = c.wm, one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0)), ar = (1 + c.cuV('e', 'area')) * (1 + c.st.v.area) * c.st.mul.area;
    return { name: sk.name, cat: 'e', desc: [
      _t`構え ${sk.windup}秒 → 照準位置に雷の球を放つ`,
      _t`周りの敵を中心へ1回だけ大きく引き寄せ(ボス以外)、直後に爆発(武器の威力 × ${Math.round(sk.pow * 100)}%、感電 ${Math.round(sk.shock * 100)}%)`,
    ], rows: [
      ['CD', _t`<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      [_t('引き寄せ / 爆発の半径'), `${Math.round(sk.pullR * ar * (1 + (m.eArea || 0)))} / ${Math.round(sk.boomR * ar)}`],
      [_t('爆発の威力'), `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, _t`武器の威力 × ${Math.round(sk.pow * 100)}%。攻撃力を掛けた値`],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.thunder || {}, t = ME.tgt(sk.range * P.range);
    if (t.x !== P.x) P.facing = t.x < P.x ? -1 : 1;
    P.act = { slot: 'e', ph: 'wind', t: 0, x: t.x, y: t.y, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('eSpark', MOTIONS.eSpark.dur);
    skillCall(sk.name, '#9fd8ff', 'e', { fx: '#4aa8f0' }); AudioMan.click();
  },
  update(a, dt) {
    const sk = weaponSkill();
    P.moveMul = 0;
    if (a.t < sk.windup) { // 杖の先に雷の球が膨らむ
      if (Math.random() < dt * 40) part(P.x + P.facing * 10 + rand(-5, 5), P.y - 8 + rand(-5, 5), rand(-20, 20), rand(-20, 20), 0.2, pick(['#9fd8ff', '#fff27a', '#ffffff']), { glow: true });
      if (Math.random() < dt * 22) asMine(() => bolts.push({ x0: P.x + P.facing * 10, y0: P.y - 9, x1: P.x + P.facing * 10 + rand(-16, 16), y1: P.y - 9 + rand(-14, 10), t: 0, life: 0.06, w: 1 })); // 杖の先から散る稲妻
      return;
    }
    gravitySpark(ME, a.x, a.y, a.pow, 1, hasSp('e', 'area'));
    if (hasSp('e', 'cd')) P.stormT = S.time + sk.stormT; // 雷雨
    P.act = null;
  },
  cast(X, a) {
    const sk = DATA.weapons.thunder.skill, t = X.tgt(sk.range * X.range);
    gravitySpark(X, t.x, t.y, a.pow, 1, X.sp('area'));
    if (X.sp('cd')) P.stormT = S.time + sk.stormT; // 雷雨(自分のサンダーに効く)
    return null;
  },
};
// グラビティスパークの球を置く(k: 威力の倍率。again: 二重重力でもう一度)
function gravitySpark(X, x, y, pow, k, again) {
  const sk = DATA.weapons.thunder.skill, m = P.wm.thunder || {}, ar = (1 + X.lv('area')) * X.area;
  zones.push({ kind: 'gspark', x, y, r: sk.pullR * ar * (1 + (m.eArea || 0)), boomR: sk.boomR * ar, t: 0, tick: 0, pulled: false, boomed: false,
    dur: sk.boomT + 0.15, dmg: wst('thunder').dmg * sk.pow * (1 + X.lv('pow')) * pow * k, stun: X.sp('pow'), cl: X.cl });
  if (again) simTimeout(() => { if (state === 'play' && P.weapons.thunder) gravitySpark(X, x, y, pow, sk.againK, false); }, sk.againT * 1000); // 二重重力
  AudioMan.zap();
}

CLASS_RT.electro = {
  skills: ['q'],
  init() { P.charge = 0; P.chargeT = -99; P.elT = 0; P.elExt = 0; P.dash = null; P.dashHeld = false; P.recharge = null; P.elDis = {}; P.dashHit = null; },
  update(dt) {
    const p = EL();
    P.elT = Math.max(0, P.elT - dt);
    P.atkSpd = 1 + (P.elT > 0 ? cuV('passive', 'charge') : 0); // 充電: 纏っている間の攻撃速度
    // 帯電: 感電が decayWait 秒起きないと減る / 再充電で少しずつ戻る
    if (S.time - P.chargeT > p.decayWait && P.charge > 0) { P.charge = Math.max(0, P.charge - p.decay * dt); S.hudDirty = true; }
    if (P.recharge) { const g = Math.min(P.recharge.left, P.recharge.rate * dt); P.recharge.left -= g; P.charge = Math.min(elMax(), P.charge + g); if (P.recharge.left <= 0.01) P.recharge = null; }
    if (P.elT > 0 && Math.random() < dt * 14) { const a = rand(0, TAU); bolts.push({ x0: P.x, y0: P.y - 4, x1: P.x + Math.cos(a) * 9, y1: P.y - 4 + Math.sin(a) * 9, t: 0, life: 0.08, w: 1 }); } // 纏った雷
    // 雷走: 駆け抜けながら、通った敵に一度ずつ
    if (P.dash) {
      P.x += P.dash.vx * dt; P.y += P.dash.vy * dt; P.dash.t -= dt;
      P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.12, f: P.facing }]).slice(-5);
      asMine(() => forEachNear(P.x, P.y, p.dashR, e => {
        if (e.prop || e.dead || P.dashHit.has(e.id)) return;
        P.dashHit.add(e.id);
        const dealt = hitEnemy(e, p.dashPow, { src: 'edash', ang: Math.atan2(P.dash.vy, P.dash.vx), kb: 40, col: '#fff27a' });
        addShock(e, dealt, p.dashShock);
      }));
      if (P.dash.t <= 0) P.dash = null;
    }
    const held = defHeld();
    if (held && !P.dashHeld && !P.dash) { if (P.sta >= dashCost()) electroDash(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
    P.dashHeld = held;
    P.moveMul = P.dash ? 0 : 1;
  },
  onHurt: dmg => dmg,
  onMainHit() {},
  // E / Q を使うと纏う + 放電(帯電を消費して、その発動の命中に強い感電)
  onSkill(slot) { elWear(); P.elDis[slot] = elDischarge(); },
  onEHit(e, dealt) { if (P.elDis.e && dealt) addShock(e, dealt, P.elDis.e, { noCharge: true }); }, // 放電(E)
  // 雷纏い: 全武器の命中に感電
  onWeaponHit(e, dmg) {
    if (P.elT > 0 && !e.dead) addShock(e, dmg, cuV('passive', 'shock', EL().wearShock) + (P.lvFx.wearShock || 0));
  },
  shockMod: e => elShockMod(e),
  shockOrigin: true, // 帯電: 感電は起点の敵(攻撃が当たった敵)にも入る
  onShock(o) { P.chargeT = S.time; if (!o.noCharge) elGain(1); },
  blockProj: () => P.elT > 0 && hasSp('passive', 'charge') && Math.random() < EL().static, // 静電気
  onKill(e, o) { // 雷原: 纏っている間に感電で倒すと纏う時間が延びる
    const p = EL();
    if (o && o.src === 'shock' && P.elT > 0 && hasSp('passive', 'wear') && P.elExt < p.extendMax) { const add = Math.min(p.extendT, p.extendMax - P.elExt); P.elT += add; P.elExt += add; }
  },
  atkBonus: () => 0,
  qStart() {
    const q = DATA.classes.electro.q;
    P.act = { slot: 'q', ph: 'wind', t: 0 };
    playAnim('eTower', MOTIONS.eTower.dur);
    slowmo(0.5, 0.2);
    skillCall(q.name, '#fff27a', 'q', { fx: '#d8c040' }); AudioMan.click();
  },
  qUpdate(a, dt) {
    const q = DATA.classes.electro.q;
    P.moveMul = 0;
    if (a.t < q.windup) {
      asMine(() => { if (Math.random() < dt * 40) { const r = rand(0, TAU); bolts.push({ x0: P.x, y0: P.y - 16, x1: P.x + Math.cos(r) * 18, y1: P.y - 16 + Math.sin(r) * 18, t: 0, life: 0.08, w: 1 }); } });
      return;
    }
    electroTowers();
    P.act = null;
  },
  res: () => ({ kind: 'charge', label: _t('帯電'), v: Math.floor(P.charge), max: elMax(), dk: '#6a5a10' }),
  staBroken: () => false,
  statuses() {
    const out = [], n = Math.floor(P.charge / EL().perChain);
    if (n > 0) out.push({ id: 'charge', glyph: '電', name: _t`帯電 ${Math.floor(P.charge)}`, fx: _t`感電の連鎖 +${n}`, kind: 'buff' });
    if (P.elT > 0) out.push({ id: 'elwear', glyph: '雷', name: _t('雷纏い'), fx: _t`全武器に感電 ${Math.round((cuV('passive', 'shock', EL().wearShock) + (P.lvFx.wearShock || 0)) * 100)}%` + (cuV('passive', 'charge') ? _t` 攻撃速度 +${Math.round(cuV('passive', 'charge') * 100)}%` : ''), t: P.elT, max: Math.max(P.elT, elWearDur()), kind: 'buff' });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.electro.q.name, glyph: '塔' }),
  info(c) {
    const p = EL(), q = DATA.classes.electro.q, k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0);
    const big = c.hasSp('q', 'pow'), nT = q.n + c.cuV('q', 'n'), kq = big ? k * nT * q.bigK : k; // 大鉄塔: 1本に本数分の威力
    return [
      { key: _t('特性'), name: _t('帯電'), cat: 'trait', desc: [
        _t`感電が起きるたびに帯電 +1。帯電 ${p.perChain} につき感電の連鎖 +1`,
        _t`${p.decayWait}秒間 感電が起きないと、1秒に ${p.decay} ずつ減る`,
        _t('放電: E / Q を使うと帯電を消費し、その発動の命中に追加の感電(消費した帯電が多いほど強い)'),
        _t('感電: 命中した敵から近くの敵へ雷が連鎖し、与えたダメージの一部を与える'),
      ], rows: [
        [_t('帯電の上限'), `${p.max + c.cuV('trait', 'cap')}`],
        [_t('放電で消費する帯電'), `<b>${Math.round(c.cuV('trait', 'store', p.use) * 100)}%</b>`],
        [_t('放電の感電'), `${Math.round(p.disShock * 100)}%`, _t`消費した帯電 1 につき感電ダメージ +${Math.round((c.hasSp('trait', 'store') ? p.overPer : p.disPer) * 100)}%`],
      ] },
      { key: _t('パッシブ'), name: _t('雷纏い'), cat: 'passive', desc: [
        _t('E / Q を使うと、雷を纏う(使うたびに時間が戻る)'),
        _t('纏っている間、全武器の攻撃(通常攻撃・E)に感電が付く'),
      ], rows: [
        [_t('纏う時間'), _t`<b>${c.cuV('passive', 'wear', p.wearT)}</b> 秒`],
        [_t('感電'), `<b>${Math.round((c.cuV('passive', 'shock', p.wearShock) + (c.lvFx.wearShock || 0)) * 100)}%</b>`],
      ] },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → 画面内のランダムな位置に鉄塔を落とす(落ちた瞬間に落雷: 基礎威力 ${q.landPow})`,
        _t`${q.dur}秒間、各鉄塔は ${q.every}秒ごとに近くの敵 1体へ電気を放つ(基礎威力 ${q.pow}、感電 ${Math.round(q.shock * 100)}%)`,
        _t('放電は使ったときに1回。この Q の攻撃すべてに放電の感電が乗る'),
      ], rows: [
        ['CD', _t`<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('鉄塔'), big ? _t('1 本(大鉄塔)') : _t`${nT} 本`],
        [_t('落雷 / 放電の威力'), `${Math.round(q.landPow * kq)} / ${Math.round(q.pow * kq)} → <b>${Math.round(q.landPow * kq * c.atkMul)} / ${Math.round(q.pow * kq * c.atkMul)}</b>`],
      ] },
      { key: 'Space', name: _t('雷走'), desc: [
        _t`移動方向へ ${p.dashDist} 駆け抜ける(${p.dashIfr}秒 無敵)`,
        _t`通り抜けた敵に 基礎威力 ${p.dashPow} と感電 ${Math.round(p.dashShock * 100)}%`,
      ], rows: [
        [_t('スタミナ消費'), `<b>${p.dashCost - (c.lvFx.dashCut || 0)}</b>`],
      ] },
    ];
  },
};

// ---------- エレクトロマンサー: 帯電・雷纏い・鉄塔・雷走 ----------
const EL = () => DATA.classes.electro.params;
const elMax = () => EL().max + cuV('trait', 'cap');
const elWearDur = () => cuV('passive', 'wear', EL().wearT);
const dashCost = () => EL().dashCost - (P.lvFx.dashCut || 0);
// 帯電を得る
function elGain(n) {
  P.charge = Math.min(elMax(), (P.charge || 0) + n); S.hudDirty = true;
}
// 感電への補正: 帯電 20 につき連鎖 +1・避雷針・伝導(距離)・収束・雷光
function elShockMod(e) {
  const p = EL(), q = DATA.classes.electro.q;
  let n = Math.floor((P.charge || 0) / p.perChain);
  const rod = hasSp('q', 'cd') && zones.some(z => z.kind === 'tower' && d2(z.x, z.y, e.x, e.y) < Math.pow(z.big ? q.r * q.bigR : q.r, 2)); // 避雷針: 連鎖 +1・感電ダメージアップ
  if (rod) n++;
  const focus = hasSp('trait', 'conduct');
  return { n, nMul: focus ? p.focusN : 1, r: 1 + cuV('trait', 'conduct'), dmg: (focus ? p.focusDmg : 1) * (P.elT > 0 && hasSp('passive', 'shock') ? 1 + p.flash : 1) * (rod ? 1 + q.rodDmg : 1) };
}
// 雷纏い
function elWear() {
  P.elT = elWearDur(); P.elExt = 0; S.hudDirty = true;
  asMine(() => { for (let i = 0; i < 6; i++) { const a = rand(0, TAU); bolts.push({ x0: P.x, y0: P.y - 4, x1: P.x + Math.cos(a) * 16, y1: P.y - 4 + Math.sin(a) * 16, t: 0, life: 0.15, w: 1 }); } });
}
// 放電: 帯電の一部を消費し、その発動の命中に起こす感電の割合を返す
function elDischarge() {
  const p = EL(), used = Math.floor((P.charge || 0) * cuV('trait', 'store', p.use));
  P.charge -= used; S.hudDirty = true;
  if (used > 0 && hasSp('trait', 'cap')) P.recharge = { left: used * p.recharge, rate: used * p.recharge / p.rechargeT }; // 再充電
  if (used > 0) asMine(() => { addRing(P.x, P.y, 20 + used / 2, '#fff27a', { w: 2, life: 0.3 }); burst(P.x, P.y, 10 + used / 2, ['#fff27a', '#9fd8ff', '#ffffff'], { sp: 90, glow: true, life: 0.3 }); });
  return p.disShock * (1 + used * (hasSp('trait', 'store') ? p.overPer : p.disPer)) * (1 + (P.lvFx.disDmg || 0)); // 過電流: 消費 1 につき +overPer
}
// 雷走: 移動方向へ駆け抜ける
function electroDash() {
  const p = EL(), d = P.moving && P.dir ? P.dir : [P.facing, 0], len = Math.hypot(d[0], d[1]) || 1;
  staUse(dashCost());
  P.dash = { vx: d[0] / len * p.dashDist / p.dashTime, vy: d[1] / len * p.dashDist / p.dashTime, t: p.dashTime };
  P.dashHit = new Set();
  P.invT = Math.max(P.invT, dodgeIfr(p.dashIfr)); P.ifr = Math.max(P.ifr, dodgeIfr(p.dashIfr));
  playAnim('eDash', MOTIONS.eDash.dur); P.anim.keep = true;
  asMine(() => { burst(P.x, P.y, 12, ['#fff27a', '#9fd8ff', '#ffffff'], { sp: 70, glow: true, life: 0.3 }); });
  AudioMan.dash(); AudioMan.zap();
}
// 鉄塔: 画面内のランダムな位置に落とす(zones の 'tower'、world.js で放電)。大鉄塔: 自分の場所に 1本だけ(威力 × 本数 × bigK、半径 × bigR)
function electroTowers() {
  const q = DATA.classes.electro.q, k0 = 1 + cuV('q', 'pow') + (P.lvFx.qPow || 0), nT = q.n + cuV('q', 'n'), id = (P.actId = (P.actId || 0) + 1);
  const big = hasSp('q', 'pow'), n = big ? 1 : nT, k = big ? k0 * nT * q.bigK : k0, rk = (big ? q.bigR : 1) * P.area;
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul); // ここで纏い + 放電(P.elDis.q)
  const dis = P.elDis.q || 0;
  asMine(() => fxRays(P.x, P.y - 16, 70, '#fff27a', { n: 12, life: 0.3 })); screenFlash(0.1 * SET.fxA, '#fff27a'); // 空が一瞬光る
  for (let i = 0; i < n; i++) {
    const x = big ? P.x : cam.x + rand(24, GFX.VW - 24), y = big ? P.y : cam.y + rand(30, GFX.VH - 20);
    simTimeout(() => {
      if (state !== 'play') return;
      zones.push({ kind: 'tower', id, x, y, r: q.r * rk, t: 0, dur: q.dur, tick: q.every, dis, pow: q.pow * k, shock: q.shock, wireT: 0, big,
        wire: hasSp('q', 'n') ? q.wirePow * k0 : 0 });
      asMine(() => {
        forEachNear(x, y, q.landR * rk, e => {
          if (e.prop) { killEnemy(e); return; }
          const dealt = hitEnemy(e, q.landPow * k, { src: 'tower', ang: Math.atan2(e.y - y, e.x - x), kb: 60, col: '#fff27a' });
          if (dis && dealt) addShock(e, dealt, dis, { noCharge: true });
        });
        bolts.push({ x0: x + rand(-10, 10), y0: cam.y - 10, x1: x, y1: y - 20, t: 0, life: 0.25, w: 3 });
        addFlash(x, y, 80, '#fff27a', 0.35); addRing(x, y, q.landR * rk, '#ffffff', { w: 2, life: 0.3 });
        burst(x, y, 20, ['#8a8098', '#fff27a', '#ffffff'], { sp: 100, up: 30, g: 160, life: 0.5 }); shockAt(x, y, 1, 1); shake(5);
        fxBeam(x, y, { w: 2.5, H: 230, col: '#fff27a', mid: '#9fd8ff', core: '#ffffff', life: 0.28, drop: 0.04, zig: 3 }); // 天から落ちる雷の柱
        fxRays(x, y - 8, 52, '#fff27a', { n: 10, life: 0.26 });
        fxDecal(x, y + 2, q.landR * rk * 0.8, 'scorch', { col: '#0c0a14', hot: '#9fd8ff', heatT: 0.6, life: 3 });
      });
      AudioMan.zap(); AudioMan.boom();
      if (i === 0) AudioMan.impact();
    }, i * 120);
  }
}
