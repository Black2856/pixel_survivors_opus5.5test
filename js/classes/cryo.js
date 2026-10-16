// classes/cryo.js — クライオマンサー: E スキル(アイシクルフォール)/ クラスの実装(CLASS_RT.cryo)/ 特性・パッシブ・Q の処理
'use strict';

// アイシクルフォール(ブリザードの E): 構え → 照準位置につららが降り続ける(放った後は動ける)
// つららそのものは zones の 'icicle'(world.js の updZones で落とす)
WEAPON_SKILL.blizzard = {
  info(c, dmg) {
    const sk = DATA.weapons.blizzard.skill, m = c.wm, n = sk.n + c.cuV('e', 'n') + (m.eCount || 0), one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      _t`構え ${sk.windup}秒 → 照準位置(半径 ${sk.radius})に、${sk.dur}秒かけてつららが降る`,
      _t`つららは範囲内の敵を狙って落ちる(いなければランダムな位置)`,
      _t`つらら1本: 半径 ${sk.iceR} に 武器の威力 × ${Math.round(sk.pow * 100)}% と凍傷 +${sk.frost}`,
      _t('放った後は自由に動ける(つららはその場に降り続ける)'),
    ], rows: [
      ['CD', _t`<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      [_t('つらら'), _t`${Math.round(n * (c.hasSp('e', 'cd') ? sk.rainK : 1))} 本 / ${sk.dur} 秒`],
      [_t('1本の威力'), `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, _t`武器の威力 × ${Math.round(sk.pow * 100)}%。攻撃力を掛けた値`],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.blizzard || {}, t = ME.tgt(sk.range * P.range);
    if (t.x !== P.x) P.facing = t.x < P.x ? -1 : 1;
    P.act = { slot: 'e', ph: 'wind', t: 0, x: t.x, y: t.y, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('cIcicle', MOTIONS.cIcicle.dur);
    skillCall(sk.name, '#bff4ff', 'e', { fx: '#7ad7ff' }); AudioMan.click();
  },
  update(a, dt) {
    const sk = weaponSkill();
    P.moveMul = 0;
    if (a.t < sk.windup) { // 頭上に氷の魔法陣
      if (Math.random() < dt * 40) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 12, P.y - 22 + Math.sin(r) * 4, 0, -10, 0.35, pick(['#bff4ff', '#ffffff']), { glow: true }); }
      return;
    }
    icicleFall(ME, a);
    P.act = null;
  },
  cast(X, a) {
    const t = X.tgt(DATA.weapons.blizzard.skill.range * X.range);
    icicleFall(X, { x: t.x, y: t.y, pow: a.pow });
    return null;
  },
};
// アイシクルフォールを放つ: 照準位置 (a.x, a.y) につららが降る(zones の 'icicle')
function icicleFall(X, a) {
  const sk = DATA.weapons.blizzard.skill, m = P.wm.blizzard || {}, ar = X.area, dmg = wst('blizzard').dmg * (1 + X.lv('pow')) * a.pow;
  const n = Math.round((sk.n + X.lv('n') + (m.eCount || 0)) * (X.sp('cd') ? sk.rainK : 1)); // 氷雨: 攻撃頻度 1.5倍
  zones.push({ kind: 'icicle', x: a.x, y: a.y, r: sk.radius * ar, t: 0, dur: sk.dur + 0.5, tick: 0, acc: 0, every: sk.dur / n, left: n, ices: [],
    dmg: dmg * sk.pow, iceR: sk.iceR * ar, frost: sk.frost,
    patch: X.sp('n'), big: X.sp('pow') ? dmg * sk.bigPow : 0, bigR: sk.bigR * ar, cl: X.cl });
  const x = X.x, y = X.y;
  asMine(() => { addRing(a.x, a.y, sk.radius * ar, '#bff4ff', { w: 2, life: 0.4 }); addFlash(x, y - 20, 40, '#bff4ff', 0.25); });
  fxSigil(a.x, a.y, sk.radius * ar, '#bff4ff', { style: 'rune', mark: 'snow', sq: 1, wu: sk.dur, life: sk.dur + 0.4, spin: 0.35, glow: 0.35, dim: 0.65 });
  AudioMan.blizz();
}

CLASS_RT.cryo = {
  skills: ['q'],
  init() { P.cryT = 0; P.cryExt = 0; P.dash = null; P.mirrorHeld = false; },
  update(dt) {
    const p = CR();
    P.cryT = Math.max(0, P.cryT - dt);
    if (P.cryT > 0 && Math.random() < dt * 20) part(P.x + rand(-7, 7), P.y + rand(-6, 6), rand(-6, 6), -rand(10, 25), 0.5, pick(['#bff4ff', '#ffffff', '#7ad7ff']), { glow: true }); // 纏った冷気
    // 氷の鏡: 後ろへ滑る。分身に触れた敵に凍傷(1体1回)
    if (P.dash) {
      P.x += P.dash.vx * dt; P.y += P.dash.vy * dt; P.dash.t -= dt;
      if (Math.random() < 0.5) P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.1, f: P.facing }]).slice(-3);
      if (P.dash.t <= 0) P.dash = null;
    }
    const dc = P.decoy;
    if (dc && dc.cryo) forEachNear(dc.x, dc.y, p.decoyR + 6, e => { if (!e.prop && !e.dead && !dc.hit.has(e.id)) { dc.hit.add(e.id); if (rollHit(e)) { addFrost(e, p.decoyFrost, 10); part(e.x, e.y, 0, -15, 0.4, '#bff4ff', { glow: true }); } } }); // 効果だけの攻撃も外れる
    const held = defHeld();
    if (held && !P.mirrorHeld && !P.dash) { if (P.sta >= mirrorCost()) cryoMirror(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
    P.mirrorHeld = held;
    P.moveMul = P.dash ? 0 : 1;
  },
  onHurt: dmg => dmg,
  onMainHit() {},
  onSkill: () => cryWear(), // E / Q を使うと纏う
  // 氷纏い: 全武器の命中で凍傷 +1(付与: 確率でさらに +1。冷たい刃: クリティカルで確率 2倍)
  onWeaponHit(e, dmg, crit) {
    if (P.cryT <= 0 || e.dead) return;
    const ch = cuV('passive', 'chance') * (crit && hasSp('passive', 'chance') ? 2 : 1);
    addFrost(e, 1 + (Math.random() < ch ? 1 : 0), 10);
  },
  // 凍傷の上限(このクラスでは出どころを問わず固定)と、上限での凍結
  frostCap: () => cryCap(),
  onFrost(e) { if (!e.freeze && e.frost >= cryCap()) cryFreeze(e); },
  // 凍結中: 被ダメージ +freezeDmg、凍傷を付ける攻撃ならさらに +frostHit(永久凍土: どちらも 2倍)
  dmgTaken(e, o) {
    if (!e.freeze) return 1;
    const p = CR(), k2 = hasSp('trait', 'brittle') ? 2 : 1;
    return 1 + (cuV('trait', 'brittle', p.freezeDmg) + (P.lvFx.freezeDmg || 0)) * k2 + (frostAtk(o) ? p.frostHit * k2 : 0);
  },
  critBonus: e => (e.freeze && hasSp('trait', 'deep') ? CR().critSp : 0), // 氷晶の急所
  bossRate: e => (e.freeze ? CR().bossRate : 1), // 凍結中のボスは攻撃速度 -30%
  onKill(e) {
    if (!e.freeze) return;
    const p = CR();
    if (hasSp('trait', 'wave')) { // 砕氷
      const x = e.x, y = e.y, R = p.shardR * P.area;
      asMine(() => {
        forEachNear(x, y, R, o => { if (o.prop || o === e) return; hitEnemy(o, p.shardPow, { src: 'shard', ang: Math.atan2(o.y - y, o.x - x), kb: 40, col: '#bff4ff', noNum: Math.random() < 0.5, frost: true }); if (!o.dead) addFrost(o, p.shardFrost, 10); });
        burst(x, y, 16, ['#ffffff', '#bff4ff', '#7ad7ff'], { sp: 110, glow: true, life: 0.35 }); addRing(x, y, R, '#bff4ff', { w: 2, life: 0.25 });
      });
    }
    if (P.cryT > 0 && hasSp('passive', 'wear') && P.cryExt < p.extendMax) { P.cryT += p.extendT; P.cryExt += p.extendT; } // 氷原
  },
  atkBonus: () => 0,
  qStart() {
    const q = DATA.classes.cryo.q;
    P.act = { slot: 'q', ph: 'wind', t: 0 };
    playAnim('cDust', MOTIONS.cDust.dur);
    slowmo(0.5, 0.2);
    skillCall(q.name, '#a8e8ff', 'q', { fx: '#7ad7ff' }); AudioMan.click();
  },
  qUpdate(a, dt) {
    const q = DATA.classes.cryo.q;
    P.moveMul = 0;
    if (a.t < q.windup) { // 空気が凍りつく
      asMine(() => { if (Math.random() < dt * 60) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 30, P.y - 10 + Math.sin(r) * 30, -Math.cos(r) * 70, -Math.sin(r) * 70, 0.35, pick(['#bff4ff', '#ffffff']), { glow: true, drag: 0 }); } });
      return;
    }
    cryoDust();
    P.act = null;
  },
  res: () => ({ kind: 'wear', label: _t('氷纏い'), v: P.cryT, max: Math.max(P.cryT, cryWearDur()), dk: '#1d4a7a' }),
  staBroken: () => false,
  statuses() {
    const out = [];
    if (P.cryT > 0) out.push({ id: 'cwear', glyph: '氷', name: _t('氷纏い'), fx: _t('全武器の命中で凍傷 +1') + (cuV('passive', 'chance') ? _t`(${Math.round(cuV('passive', 'chance') * 100)}% でさらに +1)` : ''), t: P.cryT, max: Math.max(P.cryT, cryWearDur()), kind: 'buff' });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.cryo.q.name, glyph: '晶' }),
  info(c) {
    const p = CR(), q = DATA.classes.cryo.q, k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0), sp2 = c.hasSp('trait', 'brittle') ? 2 : 1;
    const cap = c.hasSp('trait', 'brittle') ? p.capSp : p.frostCap, iv = c.cuV('trait', 'deep', p.decay);
    return [
      { key: _t('特性'), name: _t('凍結'), cat: 'trait', desc: [
        _t`凍傷の上限が ${cap} になる。上限に達すると凍結する`,
        _t('凍結: 行動不能・被ダメージアップ。凍傷を付ける攻撃なら、さらにアップ'),
        _t`凍結中は凍傷が ${iv}秒ごとに 1 減り、0 で解除(凍結中は凍傷が増えない)`,
        _t('ボスは行動不能にならず、攻撃速度 -30%'),
      ], rows: [
        [_t('凍結の時間'), _t`<b>${(cap * iv).toFixed(1)}</b> 秒`],
        [_t('凍結中の被ダメージ'), `<b>+${Math.round((c.cuV('trait', 'brittle', p.freezeDmg) + (c.lvFx.freezeDmg || 0)) * sp2 * 100)}%</b>`, _t`凍傷を付ける攻撃ならさらに +${Math.round(p.frostHit * sp2 * 100)}%`],
      ] },
      { key: _t('パッシブ'), name: _t('氷纏い'), cat: 'passive', desc: [
        _t('E / Q を使うと、冷気を纏う(使うたびに時間が戻る)'),
        _t('纏っている間、全武器の攻撃(通常攻撃・E)が命中すると、その敵に凍傷 +1'),
      ], rows: [
        [_t('纏う時間'), _t`<b>${c.cuV('passive', 'wear', p.wearT) + (c.lvFx.wearT || 0)}</b> 秒`],
      ].concat(c.cuV('passive', 'armor') ? [[_t('纏った瞬間のシールド'), _t`最大HP の ${Math.round(c.cuV('passive', 'armor') * 100)}%`]] : []) },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → 自分を中心に ${q.dur}秒間、細氷の領域(自分についてくる)`,
        _t`範囲内の敵に、${q.every}秒ごとに凍傷 +${q.frost} と基礎威力 ${q.pow} のダメージ`,
        _t`この範囲内で凍結した敵は、凍結時間 +${Math.round(q.freezeUp * 100)}%`,
      ], rows: [
        ['CD', _t`<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('威力'), `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, _t`${q.every}秒ごと`],
        [_t('半径'), `${Math.round(q.r * (1 + c.cuV('q', 'area')) * (1 + c.st.v.area) * c.st.mul.area)}`],
      ] },
      { key: 'Space', name: _t('氷の鏡'), desc: [
        _t`移動方向と逆へ ${p.mirrorDist} 下がる(${p.mirrorIfr}秒 無敵)`,
        _t`元の位置に氷の分身を ${p.decoyT}秒残す。分身は敵を引きつけ、触れた敵に凍傷 +${p.decoyFrost}`,
      ], rows: [
        [_t('スタミナ消費'), `<b>${p.mirrorCost - (c.lvFx.mirrorCut || 0)}</b>`],
      ] },
    ];
  },
};

// ---------- クライオマンサー: 凍結・氷纏い・ダイヤモンドダスト・氷の鏡 ----------
const CR = () => DATA.classes.cryo.params;
const cryCap = () => (hasSp('trait', 'brittle') ? CR().capSp : CR().frostCap); // 永久凍土: 50
const cryWearDur = () => cuV('passive', 'wear', CR().wearT) + (P.lvFx.wearT || 0);
const mirrorCost = () => CR().mirrorCost - (P.lvFx.mirrorCut || 0);
// 凍傷を付ける攻撃か(凍結中の追加の被ダメージ): 凍傷を付ける処理を持つ攻撃 + 氷纏い中の武器の攻撃
const frostAtk = o => !!o && !o.dot && (o.frost || (P.cryT > 0 && (o.eHit || (o.src && P.weapons[o.src]))));
// 凍結: 行動不能(ボスは攻撃速度 -30%)。凍傷が iv 秒ごとに 1 減って、0 で解除(world.js)
function cryFreeze(e) {
  const p = CR(), q = DATA.classes.cryo.q;
  let iv = cuV('trait', 'deep', p.decay);
  if (S.time - (e.dustT || -9) < q.every + 0.1) iv *= 1 + q.freezeUp + (hasSp('q', 'cd') ? q.longFreeze : 0); // ダイヤモンドダストの範囲内
  e.freeze = { iv, acc: 0 };
  e.frost = cryCap(); e.frostT = 5;
  if (P.cryT > 0 && hasSp('passive', 'armor')) timedShield(P.maxhp * p.robeShield, P.cryT); // 冷気の衣: 纏っている間のシールド
  asMine(() => {
    addRing(e.x, e.y, e.r + 8, '#ffffff', { w: 2, life: 0.3 });
    burst(e.x, e.y, 10, ['#ffffff', '#bff4ff', '#7ad7ff'], { sp: 60, glow: true, life: 0.35 });
  });
  const n = cuV('trait', 'wave');
  if (n) { // 寒波: 周りの敵に凍傷(少し遅らせて、連鎖しても深く再帰しない)
    const x = e.x, y = e.y;
    simTimeout(() => {
      if (state !== 'play') return;
      forEachNear(x, y, p.waveR * P.area, o => { if (o !== e && !o.prop && !o.dead) addFrost(o, n, 10); });
      asMine(() => addRing(x, y, p.waveR * P.area, '#bff4ff', { w: 1, life: 0.3 }));
    }, 60);
  }
}
// 氷纏い: 纏う(氷鎧: 纏っている間のシールド)
function cryWear() {
  P.cryT = cryWearDur(); P.cryExt = 0; S.hudDirty = true;
  const a = cuV('passive', 'armor');
  if (a) timedShield(P.maxhp * a, P.cryT);
  asMine(() => burst(P.x, P.y, 18, ['#bff4ff', '#ffffff', '#7ad7ff'], { sp: 60, up: 20, glow: true, life: 0.45 }));
}
// 氷の鏡: 後ろへ滑り、元の位置に氷の分身(敵を引きつける)
function cryoMirror() {
  const p = CR(), d = P.moving && P.dir ? [-P.dir[0], -P.dir[1]] : [-P.facing, 0], len = Math.hypot(d[0], d[1]) || 1;
  staUse(mirrorCost());
  P.decoy = { x: P.x, y: P.y, t: p.decoyT, cryo: true, hit: new Set() };
  P.dash = { vx: d[0] / len * p.mirrorDist / p.mirrorTime, vy: d[1] / len * p.mirrorDist / p.mirrorTime, t: p.mirrorTime };
  P.invT = Math.max(P.invT, dodgeIfr(p.mirrorIfr)); P.ifr = Math.max(P.ifr, dodgeIfr(p.mirrorIfr));
  playAnim('cMirror', MOTIONS.cMirror.dur); P.anim.keep = true;
  asMine(() => { burst(P.x, P.y, 14, ['#ffffff', '#bff4ff'], { sp: 60, glow: true, life: 0.35 }); addRing(P.x, P.y, 14, '#bff4ff', { life: 0.25 }); fxGlint(P.x, P.y - 4, 7, '#bff4ff', { life: 0.22 }); fxDecal(P.x, P.y + 5, 10, 'frost', { life: 1.6, n: 6 }); });
  AudioMan.dash();
}
// ダイヤモンドダスト: 自分を中心に細氷の領域(zones の 'ddust'、world.js で凍傷とダメージ)
function cryoDust() {
  const q = DATA.classes.cryo.q, k = 1 + cuV('q', 'pow') + (P.lvFx.qPow || 0);
  zones.push({ kind: 'ddust', x: P.x, y: P.y, r: q.r * (1 + cuV('q', 'area')) * P.area, t: 0, dur: q.dur + (hasSp('q', 'cd') ? q.longDur : 0), tick: 0,
    every: q.every, frost: q.frost, dmg: q.pow * k, glitter: hasSp('q', 'pow') ? q.glitter * k : 0 });
  asMine(() => {
    burst(P.x, P.y, 50, ['#ffffff', '#bff4ff', '#7ad7ff'], { sp: 180, glow: true, life: 0.6 });
    addRing(P.x, P.y, q.r * P.area, '#ffffff', { w: 3, life: 0.5 }); addFlash(P.x, P.y, q.r * 2.5, '#bff4ff', 0.4);
    const z = zones[zones.length - 1]; // 細氷の領域: 足元に雪の結晶の陣(領域と一緒についてきて、消えるときに光る)・地面に霜・きらめく氷の粒
    fxSigil(P.x, P.y, z.r, '#a8e8ff', { follow: P, style: 'rune', mark: 'snow', sq: 1, wu: z.dur - 0.05, life: z.dur + 0.3, spin: 0.4, glow: 0.3, dim: 0.5 });
    fxRays(P.x, P.y - 4, z.r * 1.2, '#4aa8f0', { n: 14, life: 0.4, core: '#bff4ff' });
    fxDecal(P.x, P.y + 4, z.r * 0.6, 'frost', { life: 3, n: 8 });
    for (let i = 0; i < 10; i++) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * z.r; fxGlint(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, rand(4, 7), '#bff4ff', { t: -i * 0.06, life: 0.3 }); }
    shockAt(P.x, P.y, 1.4, 1); shake(6); screenFlash(0.25 * SET.fxA, '#bff4ff');
  });
  if (hasSp('q', 'area')) { // ホワイトアウト: 敵の弾を全て消し、画面内の敵に凍傷
    asMine(() => { for (const b of eprojs) if (onScreen(b.x, b.y)) burst(b.x, b.y, 3, ['#ffffff', '#bff4ff'], { sp: 30, glow: true, life: 0.3 }); screenFlash(0.35 * SET.fxA, '#ffffff'); });
    eprojs.length = 0;
    for (const e of enemies) if (!e.dead && !e.prop && onScreen(e.x, e.y) && rollHit(e)) addFrost(e, q.whiteFrost, 10); // 効果だけの攻撃も外れる
  }
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.blizz(); AudioMan.crit(); AudioMan.sparkle();
}
