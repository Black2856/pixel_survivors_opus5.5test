// classes/cleric.js — クレリック: E スキル(ホーリーストライク)/ クラスの実装(CLASS_RT.cleric)/ 特性・パッシブ・Q の処理
'use strict';

// ホーリーストライク(ホーリーオーラの E): ランダムな敵の位置に光の柱が順に落ちる(予備動作なし・動ける)。1回ごとに回復
WEAPON_SKILL.aura = {
  info(c) {
    const sk = DATA.weapons.aura.skill, m = c.wm, n = sk.n + (c.hasSp('e', 'cd') ? sk.more : 0) + (m.eCount || 0), k = (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    const hp = c.st.v.hp * c.st.mul.hp, one = (sk.pow + hp * sk.hpPow) * k;
    return { name: sk.name, cat: 'e', desc: [
      _t`ランダムな敵の位置 ${sk.n}か所に、${sk.gap}秒おきに光の柱が落ちる(動ける)`,
      _t`1回: 半径 ${sk.r} に 基礎威力 ${sk.pow} + 最大HP の ${Math.round(sk.hpPow * 100)}%`,
      _t`1回ごとに HP を最大HP の ${Math.round(c.cuV('e', 'heal', sk.heal) * 100)}% 回復`,
    ], rows: [
      ['CD', _t`<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      [_t('光の柱'), _t`${n} 本`],
      [_t('1回の威力'), `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, _t('基礎威力 + 最大HP 比。攻撃力を掛けた値')],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.aura || {};
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('hStrike', MOTIONS.hStrike.dur); P.anim.keep = true;
    skillCall(sk.name, '#ffe38a', 'e', { fx: '#e0b040' }); AudioMan.click();
    asMine(() => addRing(P.x, P.y - 18, 10, '#ffe38a', { w: 2, life: 0.4 }));
    holyStrike(ME, clsESkillMul() * (1 + (m.ePow || 0)));
  },
  update() {},
  cast(X, a) { holyStrike(X, a.pow); return null; },
  // 聖痕: 印を付けた敵に、自分の回復量を 0.5秒ごとにまとめてダメージとして与える(攻撃力・クリティカルが乗る)
  //   自分の E(メイン武器がホーリーオーラ)が聖痕を持っているときと、ほかの使い手が付けた印が残っている間(S.stigmaUntil)
  tick(dt) {
    if (!(P.mainW === 'aura' && hasSp('e', 'pow')) && !(S.time < (S.stigmaUntil || 0))) { S.healSeen = S.healed || 0; return; }
    S.stigmaT = (S.stigmaT || 0) - dt;
    if (S.stigmaT > 0) return;
    S.stigmaT = 0.5;
    const amt = (S.healed || 0) - (S.healSeen || 0);
    S.healSeen = S.healed || 0;
    if (amt <= 0) return;
    const sk = DATA.weapons.aura.skill;
    asMine(() => { for (const e of enemies) if (!e.dead && !e.prop && S.time < (e.stigmaT || 0) && onScreen(e.x, e.y)) { hitEnemy(e, amt * sk.stigma, { src: 'stigma', dot: true, col: '#ffe38a', noNum: Math.random() < 0.5 }); } });
  },
};

// ホーリーストライク: 光の柱を gap 秒おきに n 本(連祷: +more 本)
function holyStrike(X, pow) {
  const sk = DATA.weapons.aura.skill, m = P.wm.aura || {}, n = sk.n + (X.sp('cd') ? sk.more : 0) + (m.eCount || 0);
  for (let i = 0; i < n; i++) setTimeout(() => { if (state === 'play') holyPillar(X, pow); }, (0.1 + i * sk.gap) * 1000);
}
// 光の柱1本: ランダムな敵の位置に落ちる(zones の 'pillar' は見た目だけ)。回復は自分に入る
function holyPillar(X, pow) {
  const sk = DATA.weapons.aura.skill, tg = randomTargets(1)[0];
  const x = tg ? tg.x : X.x + rand(-60, 60), y = tg ? tg.y : X.y + rand(-40, 40), R = sk.r * X.area;
  const dmg = (sk.pow + P.maxhp * sk.hpPow) * (1 + X.lv('pow')) * pow, el = clsNextEl(), mark = X.sp('pow');
  asMine(() => {
    forEachNear(x, y, R, e => {
      if (e.prop) { killEnemy(e); return; }
      hitEnemy(e, dmg, { src: 'hstrike', ang: Math.atan2(e.y - y, e.x - x), kb: 40, col: '#ffe38a', el, eHit: true, cl: X.cl });
      if (mark && !e.dead && missed !== e) { e.stigmaT = S.time + sk.stigmaT; S.stigmaUntil = Math.max(S.stigmaUntil || 0, e.stigmaT); } // 聖痕(外れた敵には付かない)
    });
    zones.push({ kind: 'pillar', x, y, r: R, t: 0, dur: 0.45, tick: 0 });
    if (X.sp('heal')) zones.push({ kind: 'lightrain', x, y, r: R, t: 0, dur: sk.rainT, tick: 0 }); // 光の雨
    addFlash(x, y, R * 2.4, '#fff6d8', 0.3); addRing(x, y, R, '#ffe38a', { w: 2, life: 0.35 });
    burst(x, y, 18, ['#ffe38a', '#fff6d8', '#ffffff'], { sp: 90, up: 40, glow: true, life: 0.45 }); shake(2);
    fxSigil(x, y, R, '#ffe38a', { style: 'rune', n: 8, step: 3, sq: 0.5, wu: 0, life: 0.6, spin: 1.5, glow: 0.5 }); // 聖印が押されて広がる
    fxRays(x, y - 6, R * 1.4, '#e0b040', { n: 10, life: 0.3, core: '#ffe38a' });
  });
  heal(P.maxhp * X.lv('heal', sk.heal));
  AudioMan.zap();
}

CLASS_RT.cleric = {
  skills: ['q'],
  init() { P.prayer = 0; P.afterT = 0; P.hot = null; P.lastCd = 0; P.noPray = false; P.prayHeld = false; P.strikeAt = -1; P.strikeNext = 0; },
  update(dt) {
    const p = CL();
    if (P.afterT > 0) { P.afterT -= dt; heal(cuV('passive', 'after') * dt, true); } // 余光
    if (P.hot) { heal(P.hot.rate * dt, true); if ((P.hot.t -= dt) <= 0) P.hot = null; } // 恩寵
    if (P.prayer > prayCap()) P.prayer = prayCap();
    // 不屈の祈り: HP が lowAt 以下になったら祈りを全て HP に(lastCd 秒に1回)
    if (hasSp('passive', 'mercy') && P.prayer >= 1 && P.hp > 0 && P.hp <= P.maxhp * p.lowAt && S.time >= P.lastCd) {
      P.lastCd = S.time + p.lastCd;
      const amt = P.prayer; P.prayer = 0; P.noPray = true; heal(amt); P.noPray = false;
      addFloat(P.x, P.y - 18, _t('不屈の祈り'), '#ffe38a', 1.2);
      asMine(() => { addRing(P.x, P.y, 30, '#ffe38a', { w: 3, life: 0.45 }); burst(P.x, P.y, 30, ['#ffe38a', '#ffffff'], { sp: 100, up: 30, glow: true, life: 0.5 }); });
    }
    if (P.prayer > 0 && Math.random() < dt * 4 * Math.min(1, P.prayer / Math.max(1, prayCap()))) part(P.x + rand(-6, 6), P.y + rand(-2, 6), 0, -rand(15, 30), 0.6, pick(['#ffe38a', '#fff6d8']), { glow: true }); // 祈りの光
    // 聖域の祈り(Space)
    const held = defHeld();
    if (held && !P.prayHeld) { if (P.sta >= prayCost()) clericPray(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
    P.prayHeld = held;
    P.moveMul = 1;
  },
  // 加護: 祈りがあるとき被ダメージ減 / 献身: 被ダメージの一部を祈りで相殺
  onHurt(dmg) {
    if (P.prayer <= 0) return dmg;
    dmg *= 1 - cuV('trait', 'ward');
    if (hasSp('trait', 'ward')) { const a = Math.min(P.prayer, dmg * CL().devote); P.prayer -= a; dmg -= a; S.hudDirty = true; }
    return dmg;
  },
  onMainHit() {},
  // 癒しの光: E / Q を使うと回復(恩寵: 2倍を 10秒かけて)。余光: その後しばらく HP回復速度アップ
  onSkill() {
    const p = CL(), amt = P.maxhp * (cuV('passive', 'light', p.light) + (P.lvFx.lightHeal || 0));
    if (hasSp('passive', 'light')) P.hot = { rate: amt * p.grace / p.graceT, t: p.graceT };
    else heal(amt);
    if (cuV('passive', 'after')) P.afterT = p.afterT;
  },
  healMul: () => clHealMul(),
  onOverheal(n) { // 超過回復 → 祈り(天啓 ×3、残光 +50%)
    if (P.noPray || !(n > 0)) return;
    P.prayer = Math.min(prayCap(), (P.prayer || 0) + n * (hasSp('trait', 'vessel') ? CL().revel : 1) * (hasSp('q', 'cd') ? 1 + DATA.classes.cleric.q.glow : 1));
    S.hudDirty = true;
  },
  // 祈りの一撃: メイン武器の通常攻撃・E の命中に 祈り × strike(聖杯: 祈りが上限で ×1.5)
  //   strikeCd 秒に1回。乗った瞬間(同じ S.time)の命中にはすべて乗る(1回の攻撃のすべての命中)
  hitBonus(e, o) {
    if (o.dot || !(P.prayer > 0) || !(o.eHit || (o.src && o.src === P.mainW))) return 0;
    if (S.time !== P.strikeAt) {
      if (S.time < (P.strikeNext || 0)) return 0;
      P.strikeAt = S.time; P.strikeNext = S.time + strikeCd();
    }
    const p = CL();
    return P.prayer * cuV('trait', 'faith', p.strike) * (hasSp('trait', 'faith') && P.prayer >= prayCap() - 0.5 ? p.grail : 1);
  },
  atkBonus: () => 0,
  qStart() {
    const q = DATA.classes.cleric.q, a = aimDir(q.r * 1.5);
    if (Math.cos(a) !== 0) P.facing = Math.cos(a) < 0 ? -1 : 1;
    P.act = { slot: 'q', ph: 'wind', t: 0, a };
    playAnim('hJudge', MOTIONS.hJudge.dur);
    fxSigil(P.x, P.y - 22, 9, '#ffe38a', { follow: P, oy: -22, style: 'rune', n: 8, step: 3, sq: 0.32, front: true, wu: q.windup, life: q.windup + 0.35, spin: 2.2, glow: 0.7 }); // 頭上の光の輪が広がって輝く
    slowmo(0.5, 0.2);
    skillCall(q.name, '#ffe38a', 'q', { fx: '#e0b040' }); AudioMan.click();
  },
  qUpdate(a, dt) {
    const q = DATA.classes.cleric.q;
    P.moveMul = 0;
    if (a.t < q.windup) {
      asMine(() => { if (Math.random() < dt * 50) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 26, P.y - 14 + Math.sin(r) * 26, -Math.cos(r) * 70, -Math.sin(r) * 70, 0.35, pick(['#ffe38a', '#ffffff']), { glow: true, drag: 0 }); } });
      return;
    }
    clericJudge(a);
    P.act = null;
  },
  res: () => ({ kind: 'prayer', label: _t('祈り'), v: Math.floor(P.prayer), max: Math.max(1, Math.round(prayCap())), dk: '#7a6a2a' }),
  staBroken: () => false,
  statuses() {
    const out = [];
    if (P.prayer >= 1) out.push({ id: 'prayer', glyph: '祈', name: _t`祈り ${Math.floor(P.prayer)}`, fx: _t`メイン武器の通常攻撃・E に +${Math.round(P.prayer * cuV('trait', 'faith', CL().strike))} ダメージ`, kind: 'buff' });
    if (P.afterT > 0) out.push({ id: 'after', glyph: '光', name: _t('余光'), fx: _t`HP回復速度 +${cuV('passive', 'after')}/s`, t: P.afterT, max: CL().afterT, kind: 'buff' });
    if (P.hot) out.push({ id: 'grace', glyph: '恩', name: _t('恩寵'), fx: _t`HP ${P.hot.rate.toFixed(1)}/s 回復`, t: P.hot.t, max: CL().graceT, kind: 'buff' });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.cleric.q.name, glyph: '審' }),
  info(c) {
    const p = CL(), q = DATA.classes.cleric.q, k = (1 + c.cuV('q', 'pow')) * (1 + (c.lvFx.qPow || 0)), hp = c.st.v.hp * c.st.mul.hp;
    return [
      { key: _t('特性'), name: _t('祈り'), cat: 'trait', desc: [
        _t('超過回復が祈りになる'),
        _t`祈りの一撃: メイン武器の通常攻撃・E のすべての命中に、祈りの ${Math.round(c.cuV('trait', 'faith', p.strike) * 100)}% の追加ダメージ`,
        _t('追加ダメージで祈りは減らない'),
      ], rows: [
        [_t('祈りの上限'), _t`最大HP と同じ(${Math.round(hp)})`],
        [_t('祈りの一撃の間隔'), _t`<b>${(p.strikeCd * (1 - c.cuV('trait', 'vessel')) * (1 - (c.lvFx.strikeCd || 0))).toFixed(2)}</b> 秒に1回`],
      ] },
      { key: _t('パッシブ'), name: _t('癒しの光'), cat: 'passive', desc: [
        _t('E / Q を使ったとき、HP を回復する'),
        _t('回復を受けるとき、今の HP が低いほど回復量が増える'),
      ], rows: [
        [_t('E / Q の回復'), _t`<b>最大HP の ${Math.round((c.cuV('passive', 'light', p.light) + (c.lvFx.lightHeal || 0)) * 100)}%</b>`],
        [_t('低HP の回復量アップ'), _t`最大 +${Math.round(c.cuV('passive', 'mercy', p.mercy) * 100)}%`],
      ] },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → 祈りを全て消費し、照準方向の扇形に光の一撃`,
        _t`基礎威力 ${q.pow} + 消費した祈り × ${q.perPray}`,
        _t`消費した祈りの ${Math.round(q.heal * 100)}% だけ HP を回復(この超過回復は祈りにならない)`,
      ], rows: [
        ['CD', _t`<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('基礎威力(祈り 0)'), `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, _t`祈り 1 につき +${(q.perPray * k).toFixed(1)}`],
      ] },
      { key: 'Space', name: _t('聖域の祈り'), desc: [
        _t`その場で短く祈り、${p.prayIfr}秒 無敵`,
        _t`使った瞬間に HP を最大HP の ${Math.round(p.prayHeal * 100)}% 回復(満タンなら祈りになる)`,
      ], rows: [
        [_t('スタミナ消費'), `<b>${p.prayCost - (c.lvFx.prayCut || 0)}</b>`],
      ] },
    ];
  },
};

// ---------- クレリック: 祈り・癒しの光・審判の祈り・聖域の祈り ----------
const CL = () => DATA.classes.cleric.params;
const prayCap = () => P.maxhp;
const strikeCd = () => CL().strikeCd * (1 - cuV('trait', 'vessel')) * (1 - (P.lvFx.strikeCd || 0)); // 祈りの一撃の間隔(祈祷・クラスLv3)
const prayCost = () => CL().prayCost - (P.lvFx.prayCut || 0);
// 被回復量: HP が低いほど増える(満ちる光: HP が高いほど)。天啓: ×revelHeal
function clHealMul() {
  const f = P.maxhp > 0 ? Math.max(0, Math.min(1, P.hp / P.maxhp)) : 1;
  let k = 1 + cuV('passive', 'mercy', CL().mercy) * (hasSp('passive', 'after') ? f : 1 - f);
  if (hasSp('trait', 'vessel')) k *= CL().revelHeal;
  return k;
}
// 聖域の祈り: 短く祈って無敵、少し回復
function clericPray() {
  const p = CL();
  staUse(prayCost());
  P.invT = Math.max(P.invT, dodgeIfr(p.prayIfr)); P.ifr = Math.max(P.ifr, dodgeIfr(p.prayIfr));
  heal(P.maxhp * p.prayHeal);
  playAnim('hPray', MOTIONS.hPray.dur); P.anim.keep = true;
  asMine(() => { addRing(P.x, P.y, 18, '#ffe38a', { w: 2, life: 0.4 }); burst(P.x, P.y, 14, ['#ffe38a', '#fff6d8', '#ffffff'], { sp: 50, up: 30, glow: true, life: 0.45 }); });
  fxSigil(P.x, P.y - 20, 7, '#ffe38a', { follow: P, oy: -20, style: 'rune', n: 8, step: 3, sq: 0.32, front: true, wu: 0, life: 0.5, spin: 2.5, glow: 0.7 }); // 頭上の光の輪
  AudioMan.heal();
}
// 審判の祈り: 祈りを全て消費して、照準方向の扇形(天の柱: 全方向)に光の一撃。消費した祈りの半分を回復
function clericJudge(a) {
  const q = DATA.classes.cleric.q, used = Math.floor(P.prayer || 0), full = hasSp('q', 'area');
  P.prayer = 0; S.hudDirty = true;
  const dmg = (q.pow + used * q.perPray) * (1 + cuV('q', 'pow')) * (1 + (P.lvFx.qPow || 0)), R = q.r * (1 + cuV('q', 'area')) * P.area;
  asMine(() => {
    forEachNear(P.x, P.y, R, e => {
      let diff = Math.atan2(e.y - P.y, e.x - P.x) - a.a;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (!full && Math.abs(diff) > q.arc / 2) return;
      if (e.prop) { killEnemy(e); return; }
      hitEnemy(e, dmg, { src: 'judge', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 120, col: '#fff6d8' });
      if (hasSp('q', 'pow') && !e.dead && missed !== e) e.stun = Math.max(e.stun || 0, e.boss ? q.bossStun : q.stun); // 神罰(外れた敵は止まらない)
    });
    slashes.push({ x: P.x, y: P.y, a: a.a, r: R, t: 0, life: 0.45, col: '#ffe38a', fan: true, span: full ? TAU : q.arc });
    const n = 6 + Math.min(10, Math.floor(used / 15));
    for (let i = 0; i < n; i++) { // 天から降る光の柱
      const d = full ? rand(0, TAU) : a.a + rand(-q.arc / 2, q.arc / 2), r = rand(0.3, 1) * R;
      zones.push({ kind: 'pillar', x: P.x + Math.cos(d) * r, y: P.y + Math.sin(d) * r, r: 12, t: -i * 0.03, dur: 0.45, tick: 0 });
    }
    const cx = full ? P.x : P.x + Math.cos(a.a) * R * 0.5, cy = full ? P.y : P.y + Math.sin(a.a) * R * 0.5;
    addFlash(cx, cy, R * 2, '#fff6d8', 0.45);
    fxRays(cx, cy - 4, R * 1.2, '#e0b040', { n: 12, life: 0.4, core: '#ffe38a' });
    fxSigil(P.x, P.y + 6, R * 0.5, '#ffe38a', { style: 'rune', n: 8, step: 3, wu: 0, life: 1.1, spin: 0.4, dim: 0.7 }); // 足元に聖印が焼き付いて広がる
    shockAt(cx, cy, 1.2 + Math.min(0.8, used / 150), 1); shake(9); hitstop(0.07); screenFlash(0.3 * SET.fxA, '#fff6d8');
  });
  if (used > 0) { P.noPray = true; heal(used * q.heal); P.noPray = false; } // この超過回復は祈りにならない
  AudioMan.impact();
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.boom(); AudioMan.crit();
}
