// classes/mage.js — メイジ: E スキル(アーケイン・バラージュ)/ クラスの実装(CLASS_RT.mage)/ 特性・パッシブ・Q の処理
'use strict';

// アーケイン・バラージュ(マジックボルトの E): 詠唱 → 照準方向へ連射(連射中も普通に動ける)。魔力障壁(持続の特殊強化)では撃破で連射が伸びる
// オーブ(迅速の特殊強化)では、代わりに周りを回るオーブが5秒間連射し、自分は自由に動ける
WEAPON_SKILL.bolt = {
  info(c, dmg) {
    const sk = DATA.weapons.bolt.skill, m = c.wm, dur = sk.dur + c.cuV('e', 'dur') + (m.eDur || 0), one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      _t`構え ${sk.windup}秒 → ${sk.dur}秒間、照準方向へ毎秒 ${sk.rate}発の魔弾を連射`,
      _t`1発の威力: 武器の威力 × ${Math.round(sk.pow * 100)}%`,
      _t('連射中も普通に動ける'),
      _t`弾数は通常攻撃の ${Math.round(sk.countMul * 100)}%。弾速・貫通・追尾は通常攻撃と同じ`,
    ], rows: [
      ['CD', _t`<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      [_t('連射'), _t`${Math.round(dur * sk.rate)} 発 / ${dur.toFixed(1)} 秒`],
      [_t('1発の威力'), `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, _t`武器の威力 × ${Math.round(sk.pow * 100)}%。攻撃力を掛けた値`],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.bolt || {};
    const o = barrageState(ME, clsESkillMul() * (1 + (m.ePow || 0)));
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    const sg = skillCall(sk.name, '#b98bff'); AudioMan.click();
    if (hasSp('e', 'cd')) { arcaneOrb(ME, o); skillRelease('e'); return; } // オーブ(構えなし)
    sigilKeep(sg, o.dur); // 連射の間も足元の陣が回り続け、撃ち終わりに光る
    P.act = Object.assign(o, { slot: 'e', ph: 'wind', t: 0, sg });
    if (hasSp('e', 'dur')) gainShield(P.maxhp * sk.shield); // 魔力障壁
    playAnim('mBarrage', MOTIONS.mBarrage.duration(o.dur), o.dur);
    addRing(P.x, P.y, 20, '#b98bff', { w: 2, life: 0.4 });
  },
  update(a, dt) {
    const sk = weaponSkill();
    if (a.ph === 'wind') { // 詠唱: 足元に魔法陣
      P.moveMul = 0;
      if (Math.random() < dt * 40) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 14, P.y + 5 + Math.sin(r) * 6, 0, -20, 0.4, pick(['#b98bff', '#ffffff']), { glow: true }); }
      if (a.t >= sk.windup) { a.ph = 'fire'; a.kills = P.kills; }
      return;
    }
    const d0 = a.dur, done = barrageStep(ME, a, dt);
    if (a.dur > d0 && P.anim && P.anim.name === 'mBarrage') { P.anim.dur += a.dur - d0; P.anim.arg += a.dur - d0; } // 魔力障壁で伸びた分はモーションも伸ばす
    if (a.dur > d0 && a.sg) sigilKeep(a.sg, a.dur - d0); // 足元の陣も
    if (!done) return;
    P.act = null;
    asMine(() => { addRing(P.x, P.y, 28, '#b98bff', { w: 2, life: 0.35 }); burst(P.x, P.y, 16, ['#b98bff', '#ffffff'], { sp: 80, glow: true }); fxRays(P.x, P.y - 4, 44, '#b98bff', { n: 10, life: 0.28 }); });
  },
  cast(X, a) {
    const o = barrageState(X, a.pow);
    if (X.sp('cd')) { arcaneOrb(X, o); return null; } // オーブ(使い手の周りを回る)
    if (X.sp('dur')) gainShield(P.maxhp * DATA.weapons.bolt.skill.shield); // 魔力障壁(シールドは自分に入る)
    return { step: dt => barrageStep(X, o, dt) };
  },
  // スキルの実行とは別に毎フレーム(オーブ)
  tick(dt) {
    if (!P.orbs || !P.orbs.length) return;
    const sk = DATA.weapons.bolt.skill, spin = S.time * 5;
    for (const o of P.orbs) {
      o.t -= dt;
      const X = o.X, pos = i => ({ x: X.x + Math.cos(spin + i * TAU / 3) * 20, y: X.y - 3 + Math.sin(spin + i * TAU / 3) * 12 });
      for (let i = 0; i < 3; i++) { const q = pos(i); part(q.x, q.y, 0, 0, 0.15, pick(['#b98bff', '#ffffff']), { glow: true, sz: 2, drag: 0 }); }
      o.shotT -= dt;
      while (o.shotT <= 0) {
        o.shotT += 1 / sk.rate;
        const q = pos(o.n = ((o.n || 0) + 1) % 3), tg = nearestEnemy(q.x, q.y, 200);
        if (tg) barrageShot(X, o, q.x, q.y, Math.atan2(tg.y - q.y, tg.x - q.x));
      }
    }
    P.orbs = P.orbs.filter(o => o.t > 0);
  },
};
// バラージュ 1回分の状態(dur: 連射の時間 / pow: 威力の倍率 / id: 集中砲火の数え分け)
function barrageState(X, pow) {
  const sk = DATA.weapons.bolt.skill, m = P.wm.bolt || {};
  return { dur: sk.dur + X.lv('dur') + (m.eDur || 0), pow, shotT: 0, u: 0, kills: P.kills, ext: 0, id: (P.actId = (P.actId || 0) + 1) };
}
// オーブ: 使い手の周りを回る 3つのオーブが 5秒間、近くの敵へ自動で連射する
function arcaneOrb(X, o) {
  (P.orbs || (P.orbs = [])).push(Object.assign(o, { X, t: 5, shotT: 0 }));
  burst(X.x, X.y, 20, ['#b98bff', '#ffffff'], { sp: 60, glow: true });
}
// バラージュの連射を dt 進める(終わったら true)
//   魔力障壁: 連射中に敵を倒すと持続 +killExt(1回の連射で killExtMax まで)
function barrageStep(X, a, dt) {
  const sk = DATA.weapons.bolt.skill;
  if (X.sp('dur') && P.kills > a.kills && a.ext < sk.killExtMax) {
    const add = Math.min(sk.killExtMax - a.ext, (P.kills - a.kills) * sk.killExt);
    a.dur += add; a.ext += add;
  }
  a.kills = P.kills;
  a.shotT -= dt;
  while (a.shotT <= 0) { a.shotT += 1 / sk.rate; barrageShot(X, a, X.x, X.y, X.aim(220)); }
  a.u += dt;
  return a.u >= a.dur;
}
// シールド: 被ダメージを HP より先に受ける(最大HP を超えない。時間では消えない)
function gainShield(n) {
  n *= clsShieldGain();
  P.shield = Math.min(Math.max(0, shieldCap() - (P.oShield || 0)), Math.max(P.shield || 0, Math.round(n))); // 整数(割れたときの表示が小数にならないように)。上限はクラスが決める
  addRing(P.x, P.y, 16, '#4f8ff0', { w: 2, life: 0.35 }); burst(P.x, P.y, 14, ['#9fd8ff', '#4f8ff0', '#ffffff'], { sp: 60, glow: true });
  S.hudDirty = true;
}
// バラージュの1回の発射: 通常攻撃(メイン武器)の半分の弾数を、同じ弾速・貫通・追尾で扇状に撃つ。E の攻撃なので発射ごとに属性が変わる
function barrageShot(X, a, x, y, ang) {
  const sk = DATA.weapons.bolt.skill, w = P.weapons.bolt, st = wst('bolt'), dmg = st.dmg * sk.pow * (1 + X.lv('pow')) * a.pow, el = clsNextEl();
  const n = Math.ceil(((st.count || 1) + P.shots) * sk.countMul), base = ang + rand(-0.12, 0.12); // 弾数は通常攻撃の半分(切り上げ)
  for (let i = 0; i < n; i++) fire('bolt', x, y, base + (i - (n - 1) / 2) * 0.13, st.speed || 200, { dmg, pierce: st.pierce || 0, life: 1.3, src: 'barrage', col: '#b98bff', r: 3, el, eHit: true, home: w.evo, homing: w.evo ? ARCANE_TURN : 0, focus: X.sp('pow') ? a.id : 0, cl: X.cl });
  if (Math.random() < 0.5) part(x + Math.cos(ang) * 6, y + Math.sin(ang) * 6, Math.cos(ang) * 60, Math.sin(ang) * 60, 0.2, '#ffffff', { glow: true });
  if (Math.random() < 0.45) fxGlint(x + Math.cos(ang) * 7, y - 1 + Math.sin(ang) * 7, 4, '#b98bff', { life: 0.1 }); // 撃ち出す瞬間の光
  AudioMan.shoot();
}

CLASS_RT.mage = {
  skills: ['q'],
  init() {
    P.crystal = 0;
    P.elI = 0; P.flowWin = 0; P.flowT = 0; P.echoT = 0; P.ovf = 0; P.covf = 0; P.resoN = 0; P.blinkHeld = false; P.meteors = [];
  },
  update(dt) {
    const p = MG();
    P.flowT -= dt; if (P.flowT <= 0) { P.flowT = 1; P.flowWin = 0; } // 魔力循環の1秒ごとの上限
    P.echoT -= dt;
    P.atkSpd = 1 + (P.echoT > 0 ? cuV('passive', 'echo') : 0);                                   // 余韻
    P.shots = Math.round(P.stats.v.shots || 0) + (hasSp('passive', 'echo') && P.echoT > 0 ? 1 : 0); // 詠唱加速
    // ブリンク(Space を押した瞬間)
    const held = defHeld();
    if (held && !P.blinkHeld) { if (P.sta >= blinkCost()) mageBlink(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
    P.blinkHeld = held;
    P.moveMul = 1;
    updMeteors(dt);
  },
  qStart: meteorStart,
  qUpdate: meteorUpdate,
  qInfo: () => ({ name: DATA.classes.mage.q.name, glyph: '隕' }),
  onHurt: dmg => dmg,
  // 通常攻撃の命中: E / Q の CD を短縮(1秒あたりの上限あり)。オーバーフロー: CD 0 で命中するとスキル威力を貯める
  onMainHit() {
    if (hasSp('passive', 'flow') && (P.sk.e.cd <= 0 || P.sk.q.cd <= 0)) P.ovf = Math.min(0.5, P.ovf + 0.001);
    mageFlow(MG().flowCut + cuV('passive', 'flow') + (P.lvFx.flowCut || 0));
  },
  // 瞑想: 止まっている間はスタミナ回復 -calmCut。減らした量 × calmK 秒だけ E / Q の CD を縮める(魔力循環の上限の枠から)。満タンの間は回復量 × calmK 秒
  staRegen(n) {
    if (!hasSp('passive', 'cap') || P.moving) return n;
    const p = MG(), cut = n * p.calmCut;
    mageFlow(cut * p.calmK);
    return n - cut;
  },
  staFull(n) { if (hasSp('passive', 'cap') && !P.moving) mageFlow(n * MG().calmK); },
  // 次の攻撃の属性(三重詠唱: 15% で全属性)
  nextEl() {
    if (hasSp('trait', 'el') && Math.random() < 0.25) return 'all';
    return ELS[P.elI++ % 3];
  },
  onElement: (e, el, dealt) => mageAddEl(e, el, dealt),
  onSkill() { P.echoT = 5; },
  // オーバーフロー・余剰魔力: 貯めたスキル威力を使う(別枠で、合算する)
  eMul() { const k = 1 + P.ovf + P.covf; P.ovf = 0; P.covf = 0; return k; },
  atkBonus: () => (hasSp('trait', 'crys') ? P.crystal * MG().ampAtk : 0), // 魔力増幅
  res: () => ({ kind: 'crystal', label: _t('魔力結晶'), v: P.crystal, max: crystalMax(), seg: true, dk: '#1d4a7a' }),
  statuses() {
    const out = [], e = cuV('passive', 'echo'), sp = hasSp('passive', 'echo');
    if (hasSp('trait', 'crys') && P.crystal > 0) out.push({ id: 'amp', glyph: '晶', name: _t('魔力増幅'), fx: _t`攻撃力 +${Math.round(P.crystal * MG().ampAtk * 100)}%`, kind: 'buff' });
    if (P.echoT > 0 && (e || sp)) out.push({ id: 'echo', glyph: '韻', name: sp ? _t('詠唱加速') : _t('余韻'), fx: (e ? _t`攻撃速度 +${Math.round(e * 100)}%` : '') + (sp ? _t(' 弾数 +1') : ''), t: P.echoT, max: 5, kind: 'buff' });
    if (P.ovf > 0) out.push({ id: 'ovf', glyph: '溢', name: _t('オーバーフロー'), fx: _t`次のスキルの威力 +${+(P.ovf * 100).toFixed(1)}%`, kind: 'buff' });
    if (P.covf > 0) out.push({ id: 'covf', glyph: '余', name: _t('余剰魔力'), fx: _t`次のスキルの威力 +${+(P.covf * 100).toFixed(1)}%`, kind: 'buff' });
    if (hasSp('passive', 'cap') && !P.moving && P.staLockT <= 0) out.push({ id: 'calm', glyph: '瞑', name: _t('瞑想'), fx: P.sta >= P.maxSta ? _t('スタミナが満タン。回復量の分で E / Q の CD を縮める') : _t`スタミナ回復 -${Math.round(MG().calmCut * 100)}%。減った分で E / Q の CD を縮める`, kind: 'buff' });
    if (hasSp('trait', 'rpow')) out.push({ id: 'gcrys', glyph: '結', name: _t('共鳴結晶'), fx: _t`あと ${MG().giantN - P.resoN}回の共鳴で、巨大な魔力結晶が落ちる`, kind: 'buff' });
    return out;
  },
  info(c) {
    const p = MG();
    return [
      { key: _t('特性'), name: _t('元素循環'), cat: 'trait', desc: [
        _t('メイン武器の通常攻撃・E の攻撃1回ごとに 炎 → 氷 → 雷 の順で属性が付く'),
        _t`炎: 与えたダメージの ${Math.round(p.burnPct * 100)}% を ${p.burnDur}秒かけて与える`,
        _t`氷: 凍傷 +1(1つにつき移動速度 -${Math.round(DATA.debuff.frostSlow * 100)}%)`,
        _t`雷: 近くの敵に ${Math.round(p.chainPct * 100)}% で連鎖`,
        _t('共鳴: 2属性を持つ敵に3つ目が当たると爆発。魔力結晶 +1'),
        _t`魔力結晶が上限のときは、次のスキルの威力 +${+(p.crysOvf * 100).toFixed(1)}%(最大 +${Math.round(p.crysOvfMax * 100)}%。E / Q を使うと全て消費)`,
      ], rows: [
        [_t('凍傷の上限'), `${MG().frostCap + (c.run && cuLv('trait', 'el') ? DATA.classes.mage.elFrost[cuLv('trait', 'el') - 1] : 0)}`],
        [_t('連鎖'), _t`${p.chainN + (c.run ? cuLv('trait', 'el') : 0)} 体`],
        [_t('共鳴の威力'), `${Math.round(p.resoPow * (1 + c.cuV('trait', 'rpow') + (c.lvFx.resoPow || 0)))} → <b>${Math.round(p.resoPow * (1 + c.cuV('trait', 'rpow') + (c.lvFx.resoPow || 0)) * c.atkMul)}</b>`, _t('3属性目が当たると爆発。魔力結晶 +1')],
        [_t('共鳴の半径'), `${Math.round(p.resoR * (1 + c.st.v.area) * c.st.mul.area)}`],
        [_t('魔力結晶の上限'), `<b>${p.crystalMax + (c.lvFx.crystalMax || 0) + c.cuV('trait', 'crys')}</b>`],
      ] },
      { key: _t('パッシブ'), name: _t('魔力循環'), cat: 'passive', desc: [
        _t('メイン武器の通常攻撃が1回当たるごとに、E / Q の CD が短くなる'),
        _t('1秒あたりに短くなる量には上限がある'),
      ], rows: [
        [_t('1回の短縮'), _t`<b>${(p.flowCut + c.cuV('passive', 'flow') + (c.lvFx.flowCut || 0)).toFixed(2)}</b> 秒`],
        [_t('1秒あたりの上限'), _t`${(p.flowCap + c.cuV('passive', 'cap')).toFixed(1)} 秒`],
      ] },
      { key: 'Q', name: _t('メテオ'), cat: 'q', desc: [
        _t`構え ${DATA.classes.mage.q.windup}秒 → 照準位置に隕石が落ちる(基礎威力 ${DATA.classes.mage.q.pow}、半径 ${DATA.classes.mage.q.r})`,
        _t`当たった敵は炎上: 与えたダメージの ${Math.round(DATA.classes.mage.q.burnPct * 100)}% を ${p.burnDur}秒かけて与える`,
        _t`魔力結晶を全て消費し、1つにつき威力 +${Math.round(DATA.classes.mage.q.crystalPow * 100)}%・半径 +${Math.round(DATA.classes.mage.q.crystalR * 100)}%`,
      ], rows: [
        ['CD', _t`<b>${(DATA.classes.mage.q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('威力'), `${Math.round(DATA.classes.mage.q.pow * (1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0)))} → <b>${Math.round(DATA.classes.mage.q.pow * (1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0)) * c.atkMul)}</b>`, _t`魔力結晶1つにつき 威力 +${Math.round(DATA.classes.mage.q.crystalPow * 100)}%・半径 +${Math.round(DATA.classes.mage.q.crystalR * 100)}%`],
        [_t('半径'), `${Math.round(DATA.classes.mage.q.r * (1 + c.cuV('q', 'area')) * (1 + c.st.v.area) * c.st.mul.area)}`],
      ] },
      { key: 'Space', name: _t('ブリンク'), desc: [
        _t`移動方向へ ${p.blinkDist} 瞬間移動し、${p.blinkIfr}秒 無敵`,
        _t`出発地点に氷の残滓が ${p.residueT}秒残る(触れた敵に凍傷)`,
      ], rows: [
        [_t('スタミナ消費'), `<b>${p.blinkCost - (c.lvFx.blinkCut || 0)}</b>`],
        [_t('距離 / 無敵'), _t`${p.blinkDist} / ${p.blinkIfr} 秒`],
      ] },
    ];
  },
};

// ---------- メイジ: 元素循環・共鳴・魔力循環・ブリンク ----------
const ELS = ['fire', 'ice', 'bolt'], EL_BIT = { fire: 1, ice: 2, bolt: 4 }, EL_COL = { fire: '#ff8a3d', ice: '#9ff7ff', bolt: '#ffe14a' };
const MG = () => DATA.classes.mage.params;
const mageFrostCap = () => MG().frostCap + (cuLv('trait', 'el') ? DATA.classes.mage.elFrost[cuLv('trait', 'el') - 1] : 0);
const bitCount = b => (b & 1) + ((b >> 1) & 1) + ((b >> 2) & 1);
// 炎上: 与えたダメージの pct を burnDur 秒かけて与える(属性強化で +10%/Lv)。炎上はスタックする
const mageBurn = (e, dealt, pct) => addBurn(e, dealt * pct * (1 + 0.1 * cuLv('trait', 'el')) / MG().burnDur / dmgMul(), MG().burnDur, 'elfire');
// 属性の効果(dealt: 実際に与えたダメージ。攻撃力を掛けた後なので、追加ダメージは dmgMul で割って基礎値に戻す)
function elEffect(e, el, dealt) {
  const p = MG(), L = cuLv('trait', 'el');
  if (el === 'fire') {
    mageBurn(e, dealt, p.burnPct);
  } else if (el === 'ice') {
    addFrost(e, 1, mageFrostCap());
  } else if (el === 'bolt') {
    addShock(e, dealt, p.chainPct, { n: p.chainN + L, r: p.chainR, src: 'chain' }); // 感電(共通の仕組み)
  }
}
// 属性を付与して、3属性そろったら共鳴
function mageAddEl(e, el, dealt) {
  if (e.prop || missed === e) return; // 外れた攻撃(砂塵・暗闇)では属性が付かない
  const list = el === 'all' ? ELS : [el];
  for (const x of list) elEffect(e, x, dealt);
  const bits = e.els || 0;
  if (el === 'all' || (bitCount(bits) === 2 && !(bits & EL_BIT[el]))) mageResonate(e);
  else e.els = bits | EL_BIT[el];
}
function mageResonate(e) {
  const p = MG(), R = p.resoR * P.area, dmg = p.resoPow * (1 + cuV('trait', 'rpow') + (P.lvFx.resoPow || 0));
  e.els = 0;
  const x = e.x, y = e.y;
  asMine(() => {
    forEachNear(x, y, R, o => { if (!o.prop) hitEnemy(o, dmg, { src: 'reso', ang: Math.atan2(o.y - y, o.x - x), kb: 40, col: '#c78bff', noNum: o !== e }); });
    addRing(x, y, R, '#c78bff', { w: 2, life: 0.3 }); addRing(x, y, R * 0.55, '#ffffff', { life: 0.2 });
    addFlash(x, y, R * 2.4, '#c78bff', 0.3);
    burst(x, y, 16, ['#ff8a3d', '#9ff7ff', '#ffe14a', '#ffffff'], { sp: 110, glow: true, life: 0.4 });
    shake(1.5);
  });
  if (hasSp('trait', 'rpow') && ++P.resoN >= p.giantN) { // 共鳴結晶: 共鳴 giantN 回ごとに、その場所へ巨大な魔力結晶が落ちる(着弾まで giantFall 秒)
    P.resoN = 0;
    P.meteors.push({ x, y, t: 0, fall: p.giantFall, R: p.giantR * P.area, dmg: p.giantPow, big: 2, crys: true });
  }
  const cmax = crystalMax();
  if (P.crystal < cmax) {
    P.crystal++;
    part(x, y, (P.x - x) * 2, (P.y - y) * 2, 0.5, '#9ff7ff', { glow: true, sz: 2, drag: 0 });
    if (P.crystal === cmax) { AudioMan.levelup(); addRing(P.x, P.y, 26, '#7ad7ff', { w: 2, life: 0.4 }); }
  } else { // 上限を超えた分は余剰魔力(次のスキルの威力)
    P.covf = Math.min(p.crysOvfMax, P.covf + p.crysOvf);
    part(x, y, (P.x - x) * 2, (P.y - y) * 2, 0.5, '#c78bff', { glow: true, sz: 2, drag: 0 });
  }
  AudioMan.boom();
}
// 魔力循環: E / Q の CD を c 秒縮める(1秒あたり flowCap + 容量 まで。命中ごとの短縮と瞑想で同じ枠)
function mageFlow(c) {
  c = Math.min(c, MG().flowCap + cuV('passive', 'cap') - P.flowWin);
  if (!(c > 0)) return;
  P.flowWin += c;
  for (const k in P.sk) P.sk[k].cd = Math.max(0, P.sk[k].cd - c);
}
const blinkCost = () => MG().blinkCost - (P.lvFx.blinkCut || 0);
const crystalMax = () => MG().crystalMax + (P.lvFx.crystalMax || 0) + cuV('trait', 'crys'); // 魔力結晶の上限(クラスLv13・結晶容量)
// ---------- メテオ(Q) ----------
// 詠唱中は P.act、落下と着弾は P.meteors(着弾前に動ける)
function meteorStart() {
  const q = DATA.classes.mage.q;
  let t = mouseAimPt() || nearestEnemy(P.x, P.y, q.range) || { x: P.x + P.facing * 60, y: P.y };
  const dd = Math.sqrt(d2(P.x, P.y, t.x, t.y));
  if (dd > q.range) t = { x: P.x + (t.x - P.x) * q.range / dd, y: P.y + (t.y - P.y) * q.range / dd };
  const n = P.crystal, pow = CLASS_RT.mage.eMul(); // オーバーフローもメテオに乗る
  P.crystal = 0;
  const R = q.r * (1 + cuV('q', 'area')) * (1 + n * q.crystalR) * P.area;
  const dmg = q.pow * (1 + cuV('q', 'pow') + (P.lvFx.qPow || 0)) * (1 + n * q.crystalPow) * pow;
  P.act = { slot: 'q', ph: 'cast', t: 0, x: t.x, y: t.y, n, R, dmg };
  fxSigil(t.x, t.y, R, '#ff8a3d', { style: 'rune', n: 5, step: 2, flame: true, sq: 1, wu: q.windup + q.fall, life: q.windup + q.fall + 0.45, spin: 0.7, glow: 0.45 }); // 照準位置の魔法陣(落ちてくる間も回り、着弾で光る)
  playAnim('mMeteor', MOTIONS.mMeteor.dur);
  if (t.x !== P.x) P.facing = t.x < P.x ? -1 : 1;
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  skillCall(q.name + (n ? ` ×${n}` : ''), '#ff8a3d', 'q'); AudioMan.click();
  for (let i = 0; i < n * 4; i++) part(P.x + rand(-24, 24), P.y + rand(-24, 24), 0, 0, 0.5, '#9ff7ff', { glow: true, sz: 2, drag: 0 }); // 結晶が手元に集まる
}
function meteorUpdate(a, dt) {
  const q = DATA.classes.mage.q, u = Math.min(1, a.t / q.windup);
  P.moveMul = 0;
  // 魔法陣: 照準位置に広がる円と、周りを回る光
  asMine(() => {
    for (let i = 0; i < 2; i++) { const r = S.time * 4 + i * Math.PI; part(a.x + Math.cos(r) * a.R * u, a.y + Math.sin(r) * a.R * u * 0.9, 0, -10, 0.3, pick(['#ffc34a', '#ff8a3d']), { glow: true, sz: 2 }); }
    if (Math.random() < dt * 30) part(P.x + rand(-6, 6), P.y - 10 + rand(-4, 4), 0, -20, 0.3, pick(['#9ff7ff', '#ffc34a']), { glow: true });
  });
  if (a.t < q.windup) return;
  P.meteors = (P.meteors || []).concat([{ x: a.x, y: a.y, t: 0, fall: q.fall, R: a.R, dmg: a.dmg, big: 1 + a.n * q.crystalR * 2, main: true }]); // 隕石の大きさは半径の伸びに合わせる
  P.act = null;
}
// 落下中の隕石: 空から尾を引いて落ち、着弾で爆発
function updMeteors(dt) {
  if (!P.meteors || !P.meteors.length) return;
  for (let i = P.meteors.length - 1; i >= 0; i--) {
    const m = P.meteors[i];
    if (m.tg && !m.tg.dead) { m.x = m.tg.x; m.y = m.tg.y; } // 狙った敵を追って落ちる(倒れたらその場所へ)
    if (m.delay > 0) { m.delay -= dt; continue; }
    m.t += dt;
    const u = Math.min(1, m.t / m.fall), mx = m.x - 70 * (1 - u), my = m.y - 190 * (1 - u);
    asMine(() => {
      for (let k = 0; k < (m.main || m.crys ? 6 : 2); k++) part(mx + rand(-3, 3) * m.big, my + rand(-3, 3) * m.big, rand(-20, 20), rand(-40, -10), 0.45, pick(m.crys ? ['#9ff7ff', '#c78bff', '#ffffff', '#4a6aa0'] : ['#ffc34a', '#ff6a2a', '#fff6c8', '#6a4040']), { glow: true, sz: m.main || m.crys ? 3 : 2 });
      if ((m.main || m.crys) && Math.random() < dt * 30) addRing(m.x, m.y, m.R, m.crys ? '#c78bff' : '#ff3b1a', { r0: m.R - 1, life: 0.06 }); // 落ちる場所の予告
    });
    if (u < 1) continue;
    P.meteors.splice(i, 1);
    if (m.crys) giantCrystalImpact(m); else meteorImpact(m);
  }
}
// 共鳴結晶: 巨大な魔力結晶が砕けて、周りの敵に 基礎威力 giantPow(共鳴として数える)
function giantCrystalImpact(m) {
  asMine(() => {
    forEachNear(m.x, m.y, m.R, e => {
      if (e.prop) { killEnemy(e); return; }
      hitEnemy(e, m.dmg, { src: 'reso', ang: Math.atan2(e.y - m.y, e.x - m.x), kb: 120, col: '#c78bff' });
    });
    addFlash(m.x, m.y, m.R * 2.5, '#5a3a9a', 0.35); // 光の層は色で明るさが決まるので暗い紫(白く飛ばさない)
    addRing(m.x, m.y, m.R, '#c78bff', { w: 3, life: 0.4 }); addRing(m.x, m.y, m.R * 0.6, '#9ff7ff', { w: 2, life: 0.3 });
    burst(m.x, m.y, 50, ['#7ad7ff', '#a070e0', '#5a3a9a', '#4a6aa0'], { sp: 200, glow: true, life: 0.7, drag: 2 });
    burst(m.x, m.y, 24, ['#4a6aa0', '#7a5ac0', '#bff4ff'], { sp: 140, up: 60, g: 200, life: 0.8 }); // 結晶の破片
    fxRays(m.x, m.y - 4, m.R * 1.3, '#5a3a9a', { n: 16, life: 0.4, core: '#7a5ac0' });
    shockAt(m.x, m.y, 1.8, 1); shake(8); hitstop(0.05);
  });
  AudioMan.boom(); AudioMan.sparkle();
}
function meteorImpact(m) {
  const q = DATA.classes.mage.q;
  asMine(() => {
    forEachNear(m.x, m.y, m.R, e => {
      if (e.prop) { killEnemy(e); return; }
      const dealt = hitEnemy(e, m.dmg, { src: 'meteor', ang: Math.atan2(e.y - m.y, e.x - m.x), kb: m.main ? 150 : 60, col: '#ff8a3d' });
      if (dealt && !e.dead) mageBurn(e, dealt, q.burnPct); // 炎上(小隕石も同じ割合)
    });
    addFlash(m.x, m.y, m.R * 3, '#ff8a3d', m.main ? 0.5 : 0.25);
    addRing(m.x, m.y, m.R, '#ffc34a', { w: 3, life: 0.4 }); addRing(m.x, m.y, m.R * 1.4, '#ff6a2a', { w: 2, life: 0.55 });
    burst(m.x, m.y, m.main ? 80 : 20, ['#ff6a2a', '#ffc34a', '#fff6c8', '#ffffff'], { sp: m.main ? 230 : 120, glow: true, life: 0.7, drag: 2 });
    if (m.main) {
      burst(m.x, m.y, 30, ['#4a3a3a', '#6a5a5a', '#2a2020'], { sp: 150, up: 60, g: 200, life: 0.9 }); // 破片
      fxRays(m.x, m.y - 4, m.R * 1.5, '#ff6a2a', { n: 18, life: 0.42, core: '#ffc34a' });
      fxDecal(m.x, m.y, m.R * 0.9, 'scorch', { life: 4.5, heatT: 1.6 }); fxDecal(m.x, m.y, m.R, 'crack', { n: 9, col: '#1a0c06', hot: '#ff6a2a', heatT: 1.5, life: 4.5 }); // クレーター: 焦げ跡と赤熱した地割れ
      shockAt(m.x, m.y, 2.2, 1); shake(12); hitstop(0.08); screenFlash(0.35 * SET.fxA, '#ff8a3d');
    } else { shake(3); fxDecal(m.x, m.y, m.R * 0.7, 'scorch', { life: 2.5, heatT: 0.8 }); }
  });
  AudioMan.boom();
  if (m.main) AudioMan.impact();
  if (!m.main) return;
  const R = m.R;
  const alive = r => { const out = []; forEachNear(m.x, m.y, r, o => { if (!o.prop && !o.hidden) out.push(o); }); return out; };
  if (hasSp('q', 'pow')) { // メテオスウォーム: 周り(半径の2倍)の生き残りを狙う。5体より少なければ同じ敵にも落ち、いなければ周りのランダムな位置
    const near = shuffle(alive(R * 2));
    for (let i = 0; i < 5; i++) {
      const tg = near.length ? near[i % near.length] : null, a = rand(0, TAU), r = rand(R * 0.5, R * 1.3);
      P.meteors.push({ x: tg ? tg.x : m.x + Math.cos(a) * r, y: tg ? tg.y : m.y + Math.sin(a) * r, tg, t: 0, fall: 0.25, delay: 0.08 * (i + 1), R: 24 * P.area, dmg: q.swarmPow, big: 0.6 });
    }
  }
  if (hasSp('q', 'cd')) { // 審判: 落ちる瞬間に範囲内の敵を狙う(まだ打っていない敵を優先)
    const struck = new Set();
    for (let i = 0; i < 6; i++) simTimeout(() => {
      if (state !== 'play') return;
      const near = alive(R), fresh = near.filter(o => !struck.has(o)), pool = fresh.length ? fresh : near;
      const tg = pool.length ? pick(pool) : nearestEnemy(m.x, m.y, R * 2); // 範囲内にいなければ、半径の2倍までで一番近い敵
      let x, y;
      if (tg) { struck.add(tg); x = tg.x; y = tg.y; } else { const a = rand(0, TAU), r = rand(0, R); x = m.x + Math.cos(a) * r; y = m.y + Math.sin(a) * r; } // 敵がいなければ範囲内のランダムな位置
      asMine(() => {
        forEachNear(x, y, 24 * P.area, e => { if (!e.prop) hitEnemy(e, q.judgePow, { src: 'meteor', col: '#fff27a' }); });
        bolts.push({ x0: x + rand(-20, 20), y0: cam.y - 10, x1: x, y1: y, t: 0, life: 0.22, w: 2 });
        addFlash(x, y, 60, '#fff27a', 0.25); addRing(x, y, 24 * P.area, '#fff27a', { life: 0.3 });
      });
      AudioMan.zap();
    }, 250 + i * 110);
  }
  if (hasSp('q', 'area')) zones.push(owned({ kind: 'blizz', x: m.x, y: m.y, r: R, r0: R, t: 0, dur: 4, tick: 0, dmg: 0, maxFrost: true })); // 絶対零度
}

function mageBlink() {
  const p = MG(), d = P.dir && P.moving ? P.dir : [P.facing, 0], len = Math.hypot(d[0], d[1]) || 1;
  const x0 = P.x, y0 = P.y, dx = d[0] / len, dy = d[1] / len;
  staUse(blinkCost());
  P.x += dx * p.blinkDist; P.y += dy * p.blinkDist;
  P.invT = Math.max(P.invT, dodgeIfr(p.blinkIfr)); P.ifr = Math.max(P.ifr, dodgeIfr(p.blinkIfr));
  zones.push(owned({ kind: 'residue', x: x0, y: y0, r: p.residueR * P.area, t: 0, dur: p.residueT, tick: 0 }));
  playAnim('mBlink', MOTIONS.mBlink.dur); P.anim.keep = true;
  for (let i = 1; i <= 4; i++) P.after = (P.after || []).concat([{ x: x0 + dx * p.blinkDist * i / 5, y: y0 + dy * p.blinkDist * i / 5, t: 0, f: P.facing }]).slice(-6);
  burst(x0, y0, 14, ['#9ff7ff', '#ffffff', '#7ad7ff'], { sp: 70, glow: true, life: 0.35 });
  burst(P.x, P.y, 10, ['#9ff7ff', '#ffffff'], { sp: 50, glow: true, life: 0.3 });
  addRing(P.x, P.y, 14, '#9ff7ff', { life: 0.2 });
  asMine(() => { fxGlint(P.x, P.y - 4, 7, '#9ff7ff', { life: 0.22 }); slashes.push(owned({ line: true, x: x0, y: y0 - 4, x1: P.x, y1: P.y - 4, t: 0, life: 0.14, w: 2, col: '#2a6a9a', core: '#bff4ff' })); }); // 跳んだ道筋に光が走る
  AudioMan.dash();
}
