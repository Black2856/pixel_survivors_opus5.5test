// classes/knight.js — ナイト: E スキル(グランドスラム)/ クラスの実装(CLASS_RT.knight)/ 特性・パッシブ・Q の処理
'use strict';

// グランドスラム(騎士剣の E): シールドを得る → 構え → 前方へ衝撃波が数段走る(威力は 武器の威力 + 今のシールド)
WEAPON_SKILL.longsword = {
  info(c, dmg) {
    const sk = DATA.weapons.longsword.skill, m = c.wm, one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      _t`使うと、シールドを最大HP の ${Math.round(sk.shield * 100)}% 得る(${sk.shieldT}秒)`,
      _t`構え ${sk.windup}秒 → 剣を叩きつけ、前方へ衝撃波が ${sk.steps}段 走る`,
      _t`1段の威力: 武器の威力 × ${Math.round(sk.pow * 100)}% + 今のシールド`,
    ], rows: [
      ['CD', _t`<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      [_t('段数'), _t`${sk.steps + (m.eSteps || 0)} 段`],
      [_t('1段の威力(シールド 0)'), `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, _t('シールドがあると、その値がそのまま足される')],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.longsword || {};
    timedShield(P.maxhp * sk.shield * (1 + cuV('e', 'guard')), sk.shieldT);
    const a = aimDir(120);
    if (Math.cos(a) !== 0) P.facing = Math.cos(a) < 0 ? -1 : 1;
    P.act = { slot: 'e', ph: 'wind', t: 0, a, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('kSlam', MOTIONS.kSlam.dur);
    skillCall(sk.name, '#ffe9a0', 'e', { fx: '#e0b040' }); AudioMan.click();
    fxGlint(P.x, P.y - 20, 9, '#ffe9a0', { t: -Math.max(0, sk.windup - 0.14), life: 0.26 }); // 振りかぶった剣がきらめく
  },
  update(a, dt) {
    const sk = weaponSkill();
    P.moveMul = 0;
    if (a.t < sk.windup) return;
    grandSlam(ME, a);
    P.act = null;
  },
  cast(X, a) {
    const sk = DATA.weapons.longsword.skill;
    timedShield(P.maxhp * sk.shield * (1 + X.lv('guard')), sk.shieldT); // シールドは自分に入る
    grandSlam(X, { a: X.aim(120), pow: a.pow });
    return null;
  },
};
// 叩きつける: 使い手の位置から a.a の方向へ衝撃波(余震(威力の特殊強化): 1.5秒後にもう一度)
function grandSlam(X, a) {
  const x0 = X.x, y0 = X.y;
  slamWaves(X, a, x0, y0, 1);
  if (X.sp('pow')) simTimeout(() => { if (state === 'play') slamWaves(X, a, x0, y0, 0.6); }, 1500); // 余震
}
// 衝撃波を段ごとに時間差で前へ走らせる(1段 = 1回の E の攻撃)。吹き飛ばし(迅速)/ 堅牢(堅陣): 当たった敵 1体につきシールド(自分に入る)
function slamWaves(X, a, x0, y0, k) {
  const sk = DATA.weapons.longsword.skill, m = P.wm.longsword || {}, n = sk.steps + (m.eSteps || 0), fly = X.sp('cd'), firm = X.sp('guard');
  for (let i = 0; i < n; i++) simTimeout(() => {
    if (state !== 'play' || !P.weapons.longsword) return; // 遅れて走る間にランが変わったとき
    const d = sk.stepD * (i + 1) * X.area, x = x0 + Math.cos(a.a) * d, y = y0 + Math.sin(a.a) * d, R = sk.waveR * X.area, el = clsNextEl();
    const dmg = (wst('longsword').dmg * sk.pow * (1 + X.lv('pow')) * a.pow + shieldTotal()) * k; // シールドはそのまま足す
    let hits = 0;
    asMine(() => {
      forEachNear(x, y, R, e => {
        if (e.prop) { killEnemy(e); return; }
        hitEnemy(e, dmg, { src: 'slam', ang: a.a, kb: fly ? 220 : 70, col: '#ffe9a0', el, eHit: true, cl: X.cl });
        if (missed === e) return; // 外れた敵は止まらず、数えない
        hits++;
        if (fly && !e.dead) e.stun = Math.max(e.stun || 0, 1.5); // 吹き飛ばし
      });
      addRing(x, y, R, '#ffe9a0', { w: 2, life: 0.3 }); addFlash(x, y, R * 2.4, '#fff1d0', 0.25);
      burst(x, y, 18, ['#8a7a60', '#5a4a3a', '#ffe9a0', '#ffffff'], { sp: 110, up: 50, g: 180, life: 0.6 }); // 岩の破片と土煙
      fxDecal(x, y + 2, R, 'crack', { n: 6, col: '#120a06', hot: '#ffd34a', heatT: 0.7, life: 2.5 }); // 叩き割られた地面(金色に光って冷える)
      if (i === n - 1) fxRays(x, y - 2, R * 1.7, '#d8a83a', { n: 14, life: 0.34, core: '#ffe9a0' }); // 最後の段: 光芒
      shockAt(x, y, 1, 1); shake(4 + i);
    });
    if (firm && hits) timedShield(P.maxhp * sk.hitShield * hits, sk.shieldT); // 堅牢
    AudioMan.boom();
    if (i === n - 1 && k >= 1) AudioMan.impact();
  }, i * sk.gap * 1000);
}

CLASS_RT.knight = {
  skills: ['q'],
  init() { P.guard = false; P.guardHeld = false; P.guardT = 0; P.breakT = 0; P.knGainT = -99; P.knRes = {}; P.knLoss = 0; },
  update(dt) {
    const p = KN();
    P.breakT -= dt;
    // 大盾(Space 長押し)。構えた瞬間にスタミナ guardCost(盤石で減る)。押し直すまで再び構えない
    const held = defHeld(), cost = p.guardCost * knGuardK();
    if (held && !P.guard && !P.guardHeld && P.breakT <= 0) {
      if (P.sta >= cost) { staUse(cost); P.guard = true; P.guardT = 0; AudioMan.click(); }
      else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88');
    }
    P.guardHeld = held;
    if (!held && P.guard) P.guard = false;
    if (P.guard) P.guardT += dt;
    P.moveMul = P.guard ? p.guardSlow : 1;
    // シールド: 1秒に今の量の decay ずつ減る(聖盾でシールドを得てから decayWait 秒は減らない。減った分は還元の対象)/ 上限を超えた分は削る
    if (S.time - P.knGainT > p.decayWait && P.shield > 0) {
      const s0 = P.shield;
      P.shield *= Math.exp(-knDecay() * dt);
      if (P.shield < 0.5) P.shield = 0;
      knMend(s0 - P.shield);
    }
    if (P.knLoss > 0) { knMend(P.knLoss); P.knLoss = 0; } // 被弾で減った分は、HP が減った後に回復する
    const over = shieldTotal() - knCap();
    if (over > 0) P.shield = Math.max(0, P.shield - over);
  },
  // 被弾: 大盾を構えていれば全方向で受け止める(HP は減らない)。受けたダメージはシールドに変わる
  onHurt(dmg) {
    const p = KN();
    if (P.breakT > 0 || !P.guard) return dmg;
    const blocked = Math.max(1, Math.round((dmg - P.armor) * (1 - P.dr)));
    staUse(blocked * Math.max(0, p.pay - (P.lvFx.payCut || 0)) * knGuardK(), DATA.player.staLock); // 盤石で減る
    holyGain(blocked * p.convert);
    if (hasSp('trait', 'convert')) { // 反射: 近くの敵に返す
      let best = null, bd = p.reflectR * p.reflectR;
      forEachNear(P.x, P.y, p.reflectR, e => { if (e.prop || e.dead) return; const d = d2(e.x, e.y, P.x, P.y); if (d < bd) { bd = d; best = e; } });
      if (best) asMine(() => { hitEnemy(best, blocked * p.reflect, { src: 'reflect', ang: Math.atan2(best.y - P.y, best.x - P.x), kb: 80, col: '#f2c84b' }); bolts.push({ x0: P.x, y0: P.y, x1: best.x, y1: best.y, t: 0, life: 0.15, w: 1 }); });
    }
    burst(P.x, P.y - 4, 10, ['#f2c84b', '#ffffff'], { sp: 70, glow: true, life: 0.25 });
    addRing(P.x, P.y, 14, '#f2c84b', { life: 0.2 });
    AudioMan.hit(); shake(2);
    if (P.sta <= 0) { // ガードブレイク
      P.guard = false; P.breakT = p.breakT;
      UI.announce('GUARD BREAK', ''); AudioMan.hurt(); shake(6);
      addRing(P.x, P.y, 26, '#ff3b5c', { w: 2, life: 0.4 });
    }
    P.ifr = P.iframe * 0.5;
    return null;
  },
  onMainHit() {},
  onSkill: slot => { if (slot === 'e') holyGain(P.maxhp * KN().skillGain); }, // E を使うとシールド(Q は構えの前に qStart で得る)
  shieldCap: () => knCap(),
  shieldGain: () => (hasSp('trait', 'cap') ? 1 + KN().sanctGain : 1), // 不滅の盾: 獲得量 +40%
  atkBonus: () => knHoldAtk(),
  // 被弾をシールドで受けるとき: 痛み分け(HP が shareAt より多いとき、シールドで受けるのは share だけ)・鉄壁(シールドの減る量)
  shieldMod: () => ({ share: hasSp('passive', 'mend') && P.hp > P.maxhp * KN().shareAt ? KN().share : 1, k: 1 - cuV('passive', 'wall') }),
  onShieldLoss: n => { P.knLoss += n; }, // 還元: 被弾で減ったシールド(次の update で回復)
  resistDebuff: kind => knResist(kind), // 金剛
  qStart() {
    const q = DATA.classes.knight.q, a = aimDir(q.r * 1.5);
    if (Math.cos(a) !== 0) P.facing = Math.cos(a) < 0 ? -1 : 1;
    holyGain(P.maxhp * KN().skillGain); // 発動前にシールドを得る(そのまま審判で消費する)
    P.act = { slot: 'q', ph: 'wind', t: 0, a };
    playAnim('kVerdict', MOTIONS.kVerdict.dur);
    slowmo(0.5, 0.2);
    skillCall(q.name, '#f2c84b', 'q'); AudioMan.click();
  },
  qUpdate(a, dt) {
    const q = DATA.classes.knight.q;
    P.moveMul = 0;
    if (a.t < q.windup) { // 大盾に光が集まる
      asMine(() => { if (Math.random() < dt * 50) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 24, P.y - 16 + Math.sin(r) * 24, -Math.cos(r) * 70, -Math.sin(r) * 70, 0.35, pick(['#f2c84b', '#ffffff']), { glow: true, drag: 0 }); } });
      return;
    }
    knightVerdict(a);
    P.act = null;
  },
  res: () => ({ kind: 'shield', label: _t('シールド'), v: Math.floor(shieldTotal()), max: Math.max(1, Math.round(knCap())), dk: '#6a5a1a' }),
  staBroken: () => P.breakT > 0,
  statuses() {
    const out = [], k = knHoldAtk();
    if (k > 0.005) out.push({ id: 'hold', glyph: '堅', name: _t('堅守'), fx: _t`攻撃力 +${Math.round(k * 100)}%(シールドの量に比例)`, kind: 'buff' });
    if (P.breakT > 0) out.push({ id: 'break', glyph: '崩', name: _t('ガードブレイク'), fx: _t('ガード不可'), t: P.breakT, max: KN().breakT, kind: 'debuff' });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.knight.q.name, glyph: '審' }),
  info(c) {
    const p = KN(), q = DATA.classes.knight.q, k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0), capP = p.capPct + c.cuV('trait', 'cap') + (c.lvFx.capPct || 0);
    const gk = c.hasSp('trait', 'keep') ? 1 - p.guardCut : 1, pay = Math.round((p.pay - (c.lvFx.payCut || 0)) * gk * 100); // 盤石
    return [
      { key: _t('特性'), name: _t('聖盾'), cat: 'trait', desc: [
        _t`大盾での被ダメージの ${Math.round(p.convert * 100)}% がシールドになる`,
        _t`E / Q を使うと、発動前に最大HP の ${Math.round(p.skillGain * 100)}% のシールドを得る(Q はそのまま消費に含まれる)`,
        _t`1秒に今のシールドの ${+(p.decay * (1 - c.cuV('trait', 'keep')) * 100).toFixed(2)}% ずつ減る(聖盾でシールドを得てから ${p.decayWait}秒は減らない)`,
        _t('  → 魔力障壁などほかのシールドも同じ扱い'),
      ], rows: [
        [_t('シールドの上限'), _t`最大HP の ${Math.round(capP * 100)}%`],
      ] },
      { key: _t('パッシブ'), name: _t('堅守'), cat: 'passive', desc: [
        _t('シールドの量に比例して攻撃力アップ'),
        _t('  → 魔力障壁などほかのシールドも同じ扱い'),
      ], rows: [
        [_t('攻撃力(上限のとき)'), `<b>+${Math.round((c.cuV('passive', 'hold', p.holdAtk) + (c.lvFx.holdAtk || 0)) * 100)}%</b>`],
        ...(c.cuV('passive', 'wall') ? [[_t('シールドの被ダメージ'), `<b>-${Math.round(c.cuV('passive', 'wall') * 100)}%</b>`]] : []),
        ...(c.cuV('passive', 'mend') ? [[_t('還元'), _t`減ったシールドの <b>${Math.round(c.cuV('passive', 'mend') * 100)}%</b> を HP に`]] : []),
      ] },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → シールドを全て消費し、前方の扇形に光の衝撃`,
        _t`基礎威力 ${q.pow} + 消費したシールド × ${q.perShield}`,
        _t`当たった敵を押し返し、${q.stun} + 消費したシールド × ${q.stunPer}秒 スタン`,
      ], rows: [
        ['CD', _t`<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('基礎威力(シールド 0)'), `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`],
      ] },
      { key: 'Space', name: _t('大盾'), desc: [
        _t('長押しで大盾を構え、全方向の攻撃を受け止める(HP は減らない)'),
        _t`構えた瞬間にスタミナ ${+(p.guardCost * gk).toFixed(2)}。被ダメージの ${pay}% をスタミナで払う`,
        _t`構えている間は移動速度 ×${p.guardSlow}。スタミナ 0 でガードブレイク(${p.breakT}秒)`,
      ], rows: [
        [_t('スタミナの払い'), `<b>${pay}%</b>`],
      ] },
    ];
  },
};

// ---------- ナイト: 聖盾・堅守・大盾・聖盾の審判 ----------
const KN = () => DATA.classes.knight.params;
const knCap = () => P.maxhp * (KN().capPct + cuV('trait', 'cap') + (P.lvFx.capPct || 0));
const knDecay = () => KN().decay * (1 - cuV('trait', 'keep')); // 1秒に減る割合(保持で下がる)
const knGuardK = () => (hasSp('trait', 'keep') ? 1 - KN().guardCut : 1); // 盤石: 大盾のスタミナ(構え・払い)の倍率
// 還元: 減ったシールド(被弾・時間で減った分。審判の消費は含まない)の一部を HP として回復する
function knMend(n) { const k = cuV('passive', 'mend'); if (k && n > 0) heal(n * k, true); }
// 金剛: シールドがある間、自分への状態異常を kongo の確率で無効にする。同じ種類は kongoT 秒、最初の判定を使う(毎フレーム付く減速などでも確率が効くように)
function knResist(kind) {
  if (!hasSp('passive', 'wall') || shieldTotal() < 1) return false;
  const p = KN(), m = P.knRes, r = m[kind];
  if (r && S.time < r.until) return r.ok;
  const ok = Math.random() < p.kongo;
  m[kind] = { until: S.time + p.kongoT, ok };
  if (ok) { addRing(P.x, P.y, 14, '#f2c84b', { life: 0.25 }); addFloat(P.x, P.y - 18, _t('金剛'), '#f2c84b', 0.8); }
  return ok;
}
// 自分のシールド(時間では消えない。上限まで)
// 聖盾で得るシールド(大盾で受けた分・E / Q)。変換パスで増え、得てから decayWait 秒は減らない
function holyGain(n) {
  if (!(n > 0)) return;
  knGain(n * (1 + cuV('trait', 'convert')));
  P.knGainT = S.time;
}
function knGain(n) {
  if (!(n > 0)) return;
  n *= clsShieldGain();
  P.shield = Math.min(Math.max(0, knCap() - (P.oShield || 0)), (P.shield || 0) + n);
  S.hudDirty = true;
}
// 堅守(パッシブ): シールドの量(上限に対する割合)に比例して攻撃力アップ。盾撃: 上限の ironAt 以上で ×ironMul
const knShieldF = () => { const cap = knCap(); return cap > 0 ? Math.min(1, shieldTotal() / cap) : 0; };
function knHoldAtk() {
  const p = KN(), f = knShieldF();
  let k = (cuV('passive', 'hold', p.holdAtk) + (P.lvFx.holdAtk || 0)) * f;
  if (hasSp('passive', 'hold') && f >= p.ironAt) k *= p.ironMul;
  return k;
}
// 聖盾の審判: シールドを全て消費して、前方の扇形(全周)に光の衝撃
function knightVerdict(a) {
  const q = DATA.classes.knight.q, used = Math.floor(shieldTotal());
  P.shield = 0; P.oShield = 0; P.oChunks = []; S.hudDirty = true; // 消費(割れた扱いにはしない)
  const full = hasSp('q', 'area'), holy = hasSp('q', 'pow');
  const pow = (q.pow + used * q.perShield * (full ? 1.5 : 1)) * (1 + cuV('q', 'pow') + (P.lvFx.qPow || 0)); // 全周: シールド分 +50%
  const R = q.r * (1 + cuV('q', 'area')) * P.area;
  asMine(() => {
    forEachNear(P.x, P.y, R, e => {
      let diff = Math.atan2(e.y - P.y, e.x - P.x) - a.a;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (!full && Math.abs(diff) > q.arc / 2) return;
      if (e.prop) { killEnemy(e); return; }
      const dealt = hitEnemy(e, pow, { src: 'verdict', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 170, col: '#fff1d0' });
      if (dealt && !e.dead) e.stun = Math.max(e.stun || 0, q.stun + used * q.stunPer); // 消費したシールドが多いほど長い(外れた敵は止まらない)
      if (holy && dealt && !e.dead) addBurn(e, dealt * 0.5 / 3 / dmgMul(), 3, 'verdict'); // 聖炎
    });
    // 見た目は攻撃判定と同じ形(扇形。全周のときだけ円)
    slashes.push({ x: P.x, y: P.y, a: a.a, r: R, t: 0, life: 0.4, col: '#f2c84b', fan: true, span: full ? TAU : q.arc });
    if (full) { addRing(P.x, P.y, R, '#f2c84b', { w: 3, life: 0.45 }); addRing(P.x, P.y, R * 0.55, '#ffffff', { w: 2, life: 0.3 }); }
    const cx = full ? P.x : P.x + Math.cos(a.a) * R * 0.5, cy = full ? P.y : P.y + Math.sin(a.a) * R * 0.5;
    addFlash(cx, cy, full ? R * 2.5 : R * 1.6, '#fff1d0', 0.5);
    const n = 40 + Math.min(40, used), cols = ['#f2c84b', '#fff1d0', '#ffffff'];
    for (let i = 0; i < n; i++) { // 光の粒は範囲の方向へだけ飛ぶ
      const d = full ? rand(0, TAU) : a.a + rand(-q.arc / 2, q.arc / 2), s = rand(0.3, 1) * R * 2.4;
      part(P.x, P.y, Math.cos(d) * s, Math.sin(d) * s, rand(0.25, 0.5), pick(cols), { glow: true });
    }
    const nb = full ? 8 : 5; // 天から光の柱が範囲に降り注ぐ(扇の中 / 全周は円周に沿って)
    for (let i = 0; i < nb; i++) {
      const d = full ? i * TAU / nb + rand(-0.2, 0.2) : a.a + (i / (nb - 1) - 0.5) * q.arc * 0.85, r = R * (full ? 0.72 : rand(0.5, 0.9));
      fxBeam(P.x + Math.cos(d) * r, P.y + Math.sin(d) * r, { t: -i * 0.04, w: 3, H: 170, col: '#d8a83a', mid: '#f2c84b', core: '#fff1d0', life: 0.45 });
    }
    fxRays(cx, cy, R * 1.1, '#d8a83a', { n: 16, life: 0.4, core: '#f2c84b' });
    fxSigil(P.x, P.y + 6, R * 0.55, '#f2c84b', { style: 'rune', mark: 'cross', wu: 0, life: 1.2, spin: 0.3, dim: 0.7 }); // 足元に聖印が焼き付いて広がる
    shockAt(cx, cy, full ? 1.8 + Math.min(1, used / 60) : 1.1 + Math.min(0.6, used / 100), 1); shake(10); hitstop(0.08); screenFlash(0.3 * SET.fxA, '#fff1d0');
  });
  AudioMan.impact();
  if (hasSp('q', 'cd')) knGain(used * q.echo); // 残響
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.boom(); AudioMan.crit();
}
