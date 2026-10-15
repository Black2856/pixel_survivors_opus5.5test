// classes/necro.js — ネクロマンサー: E スキル(スピリットストーム)/ クラスの実装(CLASS_RT.necro)/ 特性・パッシブ・Q の処理
'use strict';

// スピリットストーム(スピリットウィスプの E): 構え → 自分の周りから精霊が渦を巻いて広がり、それぞれ近くの敵へ飛んで取り憑く(放った後は動ける)
//   取り憑いた精霊(P.poss): 一定時間ダメージを与え続け、宿主が倒れたら近くの敵へ乗り移り、時間が来たら宿主の中で爆ぜる
//   侵蝕: 取り憑かれた敵の被ダメージ(dmgTaken)/ 分霊: 乗り移るときに分かれる / 大精霊: P.bigWisps
WEAPON_SKILL.wisp = {
  info(c, dmg) {
    const sk = DATA.weapons.wisp.skill, m = c.wm, n = sk.n + c.cuV('e', 'n') + (m.eCount || 0), k = (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    const one = dmg * sk.pow * k, boom = dmg * sk.burstPow * k, f = v => (v < 10 ? v.toFixed(1) : Math.round(v)); // 1回の威力は小さいので 10 未満は小数1桁
    return { name: sk.name, cat: 'e', desc: [
      _t`構え ${sk.windup}秒 → 自分の周りから精霊 ${sk.n}体が渦を巻いて広がり、それぞれ近くの敵へ飛んで取り憑く(まだ取り憑かれていない敵を優先)`,
      _t`取り憑いた精霊は ${sk.possT}秒間、${sk.every}秒ごとにその敵へ 武器の威力 × ${Math.round(sk.pow * 100)}%(取り憑いた瞬間にも1回)`,
      _t`  → その敵が倒れると、近く(半径 ${sk.hopR})の敵へ乗り移る(残り時間はそのまま。いなければその場で爆ぜる)`,
      _t`  → 時間が来ると、取り憑いた敵の中で爆ぜる(武器の威力 × ${Math.round(sk.burstPow * 100)}%、半径 ${sk.burstR})`,
    ], rows: [
      ['CD', _t`<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      [_t('精霊の数'), _t`<b>${n}</b> 体`],
      [_t('1回の威力'), `${f(one)} → <b>${f(one * c.atkMul)}</b>`, _t`${sk.every}秒ごと・${sk.possT}秒。武器の威力 × ${Math.round(sk.pow * 100)}%。攻撃力を掛けた値`],
      [_t('爆ぜる威力'), `${f(boom)} → <b>${f(boom * c.atkMul)}</b>`, _t`武器の威力 × ${Math.round(sk.burstPow * 100)}%`],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.wisp || {};
    P.act = { slot: 'e', ph: 'wind', t: 0, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('nStorm', MOTIONS.nStorm.dur);
    skillCall(sk.name, '#9dffcf', 'e', { fx: '#2fbf8a' }); AudioMan.click();
  },
  update(a, dt) {
    const sk = weaponSkill();
    P.moveMul = 0;
    if (a.t < sk.windup) { // 構え: 足元に緑の円陣が広がり、精霊が集まってくる
      const u = a.t / sk.windup;
      asMine(() => {
        if (Math.random() < dt * 30) addRing(P.x, P.y + 5, 6 + 22 * u, '#9dffcf', { r0: 5 + 22 * u, life: 0.1 });
        for (let n = dt * 60; Math.random() < n; n--) { const r = rand(0, TAU), d = rand(18, 30); part(P.x + Math.cos(r) * d, P.y + Math.sin(r) * d * 0.7, -Math.cos(r) * d * 3, -Math.sin(r) * d * 2, 0.3, pick(['#9dffcf', '#2fbf8a', '#1f8f6a']), { glow: true, drag: 0 }); }
      });
      return;
    }
    spiritStorm(ME, a);
    P.act = null;
  },
  cast(X, a) { spiritStorm(X, a); return null; },
  // 侵蝕(威力の特殊強化): 取り憑かれた敵は、どの攻撃からも受けるダメージが増える(侵蝕を持つ使い手の精霊が取り憑いている敵 = possE)
  dmgTaken: e => (e.possE > 0 ? 1 + DATA.weapons.wisp.skill.erode : 1),
  // スキルの実行とは別に毎フレーム: 取り憑いた精霊・大精霊
  tick(dt) {
    stormPossess(dt);
    if (!P.bigWisps || !P.bigWisps.length) return;
    for (const b of P.bigWisps) bigWispStep(b, dt);
    P.bigWisps = P.bigWisps.filter(b => b.t > 0);
  },
};
// 大精霊: 精霊が広がりきるまで使い手の頭上で待ち、そのあと bigT 秒 敵を追う(bigEvery 秒ごとに触れた敵へ)
function bigWispStep(b, dt) {
  const sk = DATA.weapons.wisp.skill, X = b.X;
  if (b.delay > 0) { b.delay -= dt; b.x = X.x; b.y = X.y - 10; return; } // 精霊が広がりきるまで頭上で待つ
  const tg = nearestEnemy(b.x, b.y, 260);
  if (tg) { // ゆっくり向きを変えながら追う
    const a = Math.atan2(tg.y - b.y, tg.x - b.x);
    b.vx += (Math.cos(a) * sk.bigSpd - b.vx) * Math.min(1, dt * 3); b.vy += (Math.sin(a) * sk.bigSpd - b.vy) * Math.min(1, dt * 3);
  } else { b.vx *= 1 - Math.min(1, dt * 2); b.vy *= 1 - Math.min(1, dt * 2); }
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.t -= dt; b.tick -= dt;
  if (b.tick <= 0) {
    b.tick = sk.bigEvery;
    asMine(() => {
      forEachNear(b.x, b.y, sk.bigR * X.area, e => {
        if (e.prop) { killEnemy(e); return; }
        hitEnemy(e, b.dmg, { src: 'wstorm', ang: Math.atan2(e.y - b.y, e.x - b.x), kb: 25, col: '#9dffcf', eHit: true, el: clsNextEl(), noNum: Math.random() < 0.3, cl: X.cl });
      });
      addRing(b.x, b.y, sk.bigR * X.area, '#9dffcf', { life: 0.25 });
    });
  }
  if (Math.random() < dt * 30) asMine(() => part(b.x + rand(-5, 5), b.y + rand(-5, 5), rand(-10, 10), -rand(10, 30), 0.5, pick(['#9dffcf', '#2fbf8a', '#1f8f6a']), { glow: true }));
  if (b.t <= 0) asMine(() => { burst(b.x, b.y, 24, ['#9dffcf', '#2fbf8a', '#1f8f6a'], { sp: 90, glow: true, life: 0.5 }); addFlash(b.x, b.y, 40, '#2fbf8a', 0.2); });
}
// スピリットストームの解放: 精霊が渦を巻いて広がる(spreadT 秒)→ それぞれ近くの敵へ飛び、最初に触れた敵に取り憑く(貫通しない)
function spiritStorm(X, a) {
  const sk = DATA.weapons.wisp.skill, m = P.wm.wisp || {}, st = wst('wisp'), pw = (1 + X.lv('pow')) * a.pow, x = X.x, y = X.y;
  const n = sk.n + X.lv('n') + (m.eCount || 0), dmg = st.dmg * sk.pow * pw, boom = st.dmg * sk.burstPow * pw;
  for (let i = 0; i < n; i++) {
    const ang = i * TAU / n + rand(-0.08, 0.08), o = { dmg, boom, X };
    fire('wisp', x, y, ang, st.speed, { dmg, pierce: 0, life: sk.life, src: 'wstorm', eHit: true, el: clsNextEl(), homing: 5.5, speed: st.speed, col: '#9dffcf', r: 3, cl: X.cl,
      spiral: { cx: x, cy: y, r: 6, a: ang, vr: 80 + rand(-10, 10), vt: 170 }, spiralT: sk.spreadT, // 渦を巻いて広がってから追い始める
      seek: stormSeek, onHit: e => stormAttach(e, o) }); // 触れた瞬間に 1回当たって(dmg)、そのまま取り憑く
  }
  if (X.sp('n')) (P.bigWisps || (P.bigWisps = [])).push({ x, y: y - 10, vx: 0, vy: 0, t: sk.bigT, tick: 0, delay: sk.spreadT, dmg: st.dmg * sk.bigPow * pw, X }); // 大精霊
  asMine(() => {
    addRing(x, y, 34, '#9dffcf', { w: 2, life: 0.4 }); addRing(x, y, 18, '#2fbf8a', { life: 0.25 });
    addFlash(x, y, 60, '#2fbf8a', 0.18);
    burst(x, y, 26, ['#9dffcf', '#2fbf8a', '#1f8f6a'], { sp: 120, glow: true, life: 0.45 });
    fxRays(x, y - 4, 62, '#2fbf8a', { n: 12, life: 0.34, core: '#9dffcf' });
    shockAt(x, y, 0.9, 1.1); shake(3); hitstop(0.04);
  });
  slowmo(0.55, 0.18);
  AudioMan.zap(); AudioMan.shoot();
}
// 飛ぶ精霊の狙い: まだ取り憑かれていない(ほかの精霊も追っていない)一番近い敵。いなければ取り憑かれた敵でも。置物は狙わない
function stormSeek(p) {
  const R = DATA.weapons.wisp.skill.seekR, taken = new Set();
  for (const q of projs) if (q !== p && q.seek === stormSeek && q.seekT && !q.seekT.dead) taken.add(q.seekT);
  let best = null, bd = R * R, alt = null, ad = R * R;
  for (const e of enemies) {
    if (e.dead || e.hidden || e.prop || p.hit.has(e.id)) continue;
    const d = d2(p.x, p.y, e.x, e.y);
    if (e.possN > 0 || taken.has(e)) { if (d < ad) { ad = d; alt = e; } } else if (d < bd) { bd = d; best = e; }
  }
  return (p.seekT = best || alt);
}
// 取り憑いた精霊: { e: 宿主, t: 残り秒, tick: 次に当たるまでの秒, dmg: 1回の威力, boom: 爆ぜる威力, x, y, a: 宿主の頭上を回る角度, X: 使い手, er: 侵蝕 }
//   宿主の possN = 取り憑いている精霊の数 / possE = そのうち侵蝕を持つ精霊の数(侵蝕は取り憑いたときの使い手で決まる)
function stormHost(ps, e) { ps.e = e; e.possN = (e.possN || 0) + 1; ps.er = ps.X.sp('pow'); if (ps.er) e.possE = (e.possE || 0) + 1; ps.x = e.x; ps.y = e.y; }
function stormLeave(ps) {
  if (ps.e) { ps.e.possN = Math.max(0, (ps.e.possN || 1) - 1); if (ps.er) ps.e.possE = Math.max(0, (ps.e.possE || 1) - 1); }
  ps.e = null; ps.er = false;
}
function stormAttach(e, o) {
  const sk = DATA.weapons.wisp.skill, ps = { e: null, t: sk.possT, tick: sk.every, dmg: o.dmg, boom: o.boom, x: e.x, y: e.y, a: rand(0, TAU), X: o.X };
  P.poss.push(ps);
  if (e.dead || e.prop) stormHop(ps); else stormHost(ps, e); // 触れた一撃で倒れたら、すぐ近くの敵へ乗り移る
  asMine(() => burst(e.x, e.y - 3, 5, ['#9dffcf', '#2fbf8a', '#1f8f6a'], { sp: 40, glow: true, life: 0.25 }));
}
// 宿主が倒れた: 近くの敵へ乗り移る(分霊: 2体に分かれる)。いなければその場で爆ぜる。乗り移れたら true
function stormHop(ps) {
  const sk = DATA.weapons.wisp.skill, R = sk.hopR * ps.X.area, fx = ps.x, fy = ps.y;
  stormLeave(ps);
  const near = skip => {
    let best = null, bd = R * R, alt = null, ad = R * R;
    forEachNear(fx, fy, R, e => {
      if (e.dead || e.prop || e.hidden || e === skip) return;
      const d = d2(fx, fy, e.x, e.y);
      if (e.possN > 0) { if (d < ad) { ad = d; alt = e; } } else if (d < bd) { bd = d; best = e; }
    });
    return best || alt;
  };
  const t1 = near(null);
  if (!t1) { stormBurst(ps); return false; }
  const jump = t => asMine(() => slashes.push({ line: true, x: fx, y: fy - 4, x1: t.x, y1: t.y - 4, t: 0, life: 0.2, w: 1, col: '#1f8f6a', core: '#9dffcf' }));
  stormHost(ps, t1); jump(t1);
  if (ps.X.sp('cd') && P.poss.filter(q => !q.done).length < sk.splitMax) { // 分霊
    const t2 = near(t1);
    if (t2) { const c = Object.assign({}, ps, { e: null, a: rand(0, TAU), er: false }); P.poss.push(c); stormHost(c, t2); jump(t2); }
  }
  return true;
}
// 時間が来た(または乗り移る先がない): 宿主の中で爆ぜる
function stormBurst(ps) {
  const R = DATA.weapons.wisp.skill.burstR * ps.X.area, x = ps.x, y = ps.y, cl = ps.X.cl;
  ps.done = true;
  stormLeave(ps);
  asMine(() => {
    forEachNear(x, y, R, e => { if (!e.prop) hitEnemy(e, ps.boom, { src: 'wstorm', ang: Math.atan2(e.y - y, e.x - x), kb: 40, col: '#9dffcf', eHit: true, el: clsNextEl(), noNum: Math.random() < 0.3, cl }); });
    burst(x, y, 14, ['#9dffcf', '#2fbf8a', '#1f8f6a', '#0f5a44'], { sp: 90, glow: true, life: 0.4 });
    addRing(x, y, R, '#2fbf8a', { w: 2, life: 0.3 }); addFlash(x, y, R * 2, '#1f8f6a', 0.15);
    shake(1.5);
  });
  AudioMan.boom();
}
// 取り憑いた精霊を毎フレーム進める(every 秒ごとに宿主へ。宿主が倒れたら乗り移る。時間が来たら爆ぜる)
function stormPossess(dt) {
  if (!P.poss || !P.poss.length) return;
  const sk = DATA.weapons.wisp.skill;
  for (const ps of P.poss.slice()) { // 分霊で増えた分は次のフレームから
    if (ps.done) continue;
    if ((!ps.e || ps.e.dead) && !stormHop(ps)) continue;
    const e = ps.e;
    ps.x = e.x; ps.y = e.y; ps.a += dt * 5;
    ps.t -= dt; ps.tick -= dt;
    if (ps.tick <= 0) {
      ps.tick += sk.every;
      asMine(() => {
        hitEnemy(e, ps.dmg, { src: 'wstorm', col: '#9dffcf', eHit: true, el: clsNextEl(), noNum: Math.random() < 0.4, cl: ps.X.cl });
        part(e.x + rand(-3, 3), e.y - 2, rand(-10, 10), -rand(15, 30), 0.4, pick(['#9dffcf', '#2fbf8a']), { glow: true });
      });
    }
    if (ps.t <= 0) stormBurst(ps);
  }
  P.poss = P.poss.filter(ps => !ps.done);
}

// 死霊(P.souls)は倒した敵から増え、周りを漂って敵を襲う。身代わり(死者の盾)と葬送(Q)で使う
CLASS_RT.necro = {
  skills: ['q'],
  init() { P.souls = []; P.rei = 0; P.nbombs = []; P.nOver = []; P.phase = null; P.phaseHeld = false; P.undyingAt = -999; },
  update(dt) {
    const p = NC();
    necSouls(dt);  // 死霊: 漂う・飛びかかる・戻る
    necBombs(dt);  // 葬送の霊弾
    if (P.rei > 0) P.rei = Math.max(0, P.rei - necReiDecay() * dt); // 霊力は少しずつ減る
    // 百鬼夜行: 上限を超えた死霊は少し遅れて爆ぜる(連鎖が1フレームに重ならないように)
    for (let i = P.nOver.length - 1; i >= 0; i--) { const o = P.nOver[i]; if ((o.t -= dt) <= 0) { P.nOver.splice(i, 1); necOverBurst(o); } }
    // 霊体化: 半透明で滑る → 解けた瞬間に死霊が一斉に飛びかかる
    if (P.phase) {
      P.phase.t -= dt;
      P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.06, f: P.facing }]).slice(-6);
      if (Math.random() < dt * 30) asMine(() => part(P.x + rand(-5, 5), P.y + rand(-6, 6), rand(-10, 10), -rand(5, 20), 0.4, pick(NEC_FX), { glow: true }));
      if (P.phase.t <= 0) { P.phase = null; necVolley(); }
    }
    const held = defHeld();
    if (held && !P.phaseHeld && !P.phase) { if (P.sta >= necPhaseCost()) necPhase(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
    P.phaseHeld = held;
    P.moveMul = P.phase ? 1 + p.phaseSpd : 1;
  },
  onHurt: dmg => necGuard(dmg), // 死者の盾
  onMainHit() {},
  onKill(e) { necGain(e.elite ? NC().eliteN : 1, e.x, e.y); }, // 死霊使役: 倒した敵が死霊になる
  onBossKill(e) { necGain(necMax(), e.x, e.y, true); },          // ボスは上限まで満たす(溢れた分は爆ぜない)
  dmgTaken: e => (e.curseT > S.time ? 1 + NC().curse : 1),      // 呪い牙: 呪われた敵が受けるダメージ
  atkBonus: () => 0,
  qStart() {
    const q = DATA.classes.necro.q, a = aimDir(220);
    if (Math.cos(a) !== 0) P.facing = Math.cos(a) < 0 ? -1 : 1;
    P.act = { slot: 'q', ph: 'wind', t: 0, a };
    for (const s of P.souls) s.ph = 'gather';
    playAnim('nRite', MOTIONS.nRite.dur);
    skillCall(q.name, '#a58cff', 'q', { fx: '#8a6cff' }); AudioMan.click();
  },
  qUpdate(a, dt) {
    const q = DATA.classes.necro.q;
    P.moveMul = 0;
    if (a.t < q.windup) { // 構え: 死霊が頭上に集まって渦を巻き、周りが少し暗くなる
      S.dimK = Math.max(S.dimK || 0, 0.2 * Math.min(1, a.t / 0.15));
      asMine(() => { if (Math.random() < dt * 40) { const r = rand(0, TAU), d = rand(10, 22); part(P.x + Math.cos(r) * d, P.y - 22 + Math.sin(r) * d * 0.5, -Math.cos(r) * d * 2, -Math.sin(r) * d, 0.3, pick(NEC_FX), { glow: true, drag: 0 }); } });
      return;
    }
    necRelease(a);
    P.act = null;
  },
  res: () => ({ kind: 'soul', label: _t('死霊'), v: P.souls.length, max: necMax(), seg: true, dk: '#4a3a8a' }),
  staBroken: () => false,
  statuses() {
    const out = [], p = NC(), left = p.undyingCd - (S.time - P.undyingAt);
    if (P.rei >= 1) out.push({ id: 'rei', glyph: '霊', name: _t`霊力 ${Math.floor(P.rei)}`, fx: _t`死霊の攻撃・葬送の威力 +${((necK() - 1) * 100).toFixed(1)}%`, kind: 'buff' });
    if (hasSp('passive', 'soul') && left > 0) out.push({ id: 'undying', glyph: '契', name: _t('不死の契り'), fx: _t('再び使えるまで'), t: left, max: p.undyingCd, kind: 'debuff' });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.necro.q.name, glyph: '葬' }),
  info(c) {
    const p = NC(), q = DATA.classes.necro.q, rk = c.run ? necK() : 1, k = (1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0)) * rk;
    const max = p.max + (c.lvFx.soulMax || 0) + c.cuV('trait', 'herd'), pow = p.pow * (1 + c.cuV('trait', 'fang') + (c.lvFx.soulPow || 0)) * rk, itv = p.every, decay = p.reiDecay * (1 - c.cuV('trait', 'haste'));
    return [
      { key: _t('特性'), name: _t('死霊使役'), cat: 'trait', desc: [
        _t`敵を倒すと、その敵が死霊になって従う(+1。エリートは +${p.eliteN}、ボスは上限まで)`,
        _t`死霊は周りを漂い、それぞれ ${p.every}秒ごとに近く(半径 ${p.range})の敵へ飛びかかる(基礎威力 ${p.pow}。なるべく別の敵を狙う)`,
        _t('死霊が減るのは、身代わりと葬送で使ったときだけ'),
        _t`上限のときに得た死霊は霊力になる(1秒に ${p.reiDecay} ずつ減る)。霊力 1 につき、死霊の攻撃(噛みつき・百鬼夜行・報い)と葬送の威力 +${(p.reiK * 100).toFixed(1)}%`,
      ], rows: [
        [_t('死霊'), c.run ? _t`<b>${P.souls.length}</b> / ${max} 体` : _t`上限 <b>${max}</b> 体`],
        [_t('霊力'), c.run ? `<b>${Math.floor(P.rei)}</b>(+${((rk - 1) * 100).toFixed(1)}%)` : _t`上限のときに得た死霊 1体につき +${(p.reiK * 100).toFixed(1)}%`, _t`1秒に ${+decay.toFixed(2)} ずつ減る`],
        [_t('1回の威力'), `${Math.round(pow)} → <b>${Math.round(pow * c.atkMul)}</b>`, _t('霊力・攻撃力を掛けた値')],
        [_t('攻撃の間隔'), _t`<b>${itv.toFixed(2)}</b> 秒(1体ごと)`],
      ] },
      { key: _t('パッシブ'), name: _t('死者の盾'), cat: 'passive', desc: [
        _t`被弾したとき、死霊を ${p.guardN}体 使って(少ないときはいるだけ)、そのダメージを ${Math.round(p.guard * 100)}% 減らす(死霊がいないときは減らない)。霊力は減らない`,
      ], rows: [
        [_t('身代わりの軽減'), `<b>${Math.round(c.cuV('passive', 'ward', p.guard) * 100)}%</b>`],
      ] },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → 死霊を全て解き放つ。1体につき霊弾 1発(最低 ${q.minShots}発)`,
        _t`霊弾は照準方向へ飛び出し、近くの敵を追って触れると爆ぜる(基礎威力 ${q.pow}、半径 ${q.r})`,
        _t('解き放った死霊は戻らない。威力は霊力で上がる'),
      ], rows: [
        ['CD', _t`<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('1発の威力'), `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, _t('霊力・攻撃力を掛けた値')],
        [_t('爆発の半径'), `${Math.round(q.r * (1 + c.cuV('q', 'area')) * (1 + c.st.v.area) * c.st.mul.area)}`],
      ] },
      { key: 'Space', name: _t('霊体化'), desc: [
        _t`${p.phaseT}秒間 霊体になる(無敵、移動速度 +${Math.round(p.phaseSpd * 100)}%)`,
        _t('解けた瞬間、死霊が全員、近くの敵へ一斉に飛びかかる'),
      ], rows: [
        [_t('スタミナ消費'), `<b>${p.phaseCost - (c.lvFx.phaseCut || 0)}</b>`],
      ] },
    ];
  },
};

// ---------- ネクロマンサー: 死霊使役・死者の盾・葬送・霊体化 ----------
// 死霊: { x, y, vx, vy, ph, t, bright, e, ot, hop }
//   ph: join(倒した敵の位置から来る)/ orbit(漂う)/ out(飛びかかる)/ back(戻る)/ gather(葬送の構えで頭上に集まる)
//   t: 次に飛びかかるまでの秒数(every 秒ごと。戻る途中でも時間が来たら次へ)/ ot: 飛びかかってからの秒数 / hop: 渡りを使った
const NC = () => DATA.classes.necro.params;
const NEC_FX = ['#8a6cff', '#5a3ab0', '#3a2a6a', '#c8b4ff']; // 死霊の演出の色(濃い紫。淡い色や白はブルームで白く飛ぶので、明るいのは芯の1色だけ)
const necMax = () => NC().max + (P.lvFx.soulMax || 0) + cuV('trait', 'herd');                // 上限(クラスLv8・群れ)
const necK = () => 1 + (P.rei || 0) * NC().reiK;                                             // 霊力: 死霊の攻撃・葬送の威力の倍率(上限のときに得た死霊 1体につき +reiK)
const necPow = () => NC().pow * (1 + cuV('trait', 'fang') + (P.lvFx.soulPow || 0)) * necK();  // 1回の威力(牙・クラスLv3・霊力)
const necEvery = () => NC().every;                                                            // 攻撃の間隔
const necReiDecay = () => NC().reiDecay * (1 - cuV('trait', 'haste'));                         // 霊力の減り方(1秒あたり。疾走で遅くなる)
const necPhaseCost = () => NC().phaseCost - (P.lvFx.phaseCut || 0);                           // 霊体化のスタミナ(クラスLv6)
// 死霊を得る(倒した敵の位置から飛んでくる)。fill: ボス(上限まで満たし、溢れない)
//   上限を超えた分は霊力になる(使っても減らない)/ 百鬼夜行: さらに、倒した場所で少し遅れて爆ぜる
function necGain(n, x, y, fill) {
  const add = Math.max(0, Math.min(n, necMax() - P.souls.length));
  for (let i = 0; i < add; i++) P.souls.push({ x: x + rand(-3, 3), y: y - 4, vx: 0, vy: 0, ph: 'join', t: NC().every * rand(0.3, 1), bright: 1, e: null, ot: 0, hop: false });
  if (add) { S.hudDirty = true; asMine(() => part(x, y - 4, 0, -25, 0.5, '#8a6cff', { glow: true, sz: 2 })); }
  const over = fill ? 0 : n - add;
  if (over <= 0) return;
  P.rei = (P.rei || 0) + over;
  asMine(() => part(x, y - 4, (P.x - x) * 1.5, (P.y - y) * 1.5, 0.6, '#5a3ab0', { glow: true, drag: 0 })); // 霊力: 自分へ吸い込まれる
  if (hasSp('trait', 'herd')) P.nOver.push({ x, y, n: over, t: 0.08 });
}
function necOverBurst(o) {
  const p = NC(), R = p.overR * P.area;
  asMine(() => {
    forEachNear(o.x, o.y, R, e => {
      if (e.prop) { killEnemy(e); return; }
      hitEnemy(e, p.overPow * o.n * necK(), { src: 'nsoul', ang: Math.atan2(e.y - o.y, e.x - o.x), kb: 40, col: '#a58cff', noNum: Math.random() < 0.4 });
    });
    burst(o.x, o.y, 14, NEC_FX, { sp: 90, glow: true, life: 0.4 });
    addRing(o.x, o.y, R, '#8a6cff', { w: 2, life: 0.3 }); addFlash(o.x, o.y, R * 2, '#5a30c0', 0.15);
    shake(1.5);
  });
  AudioMan.boom();
}
// 死霊の狙い: (x, y) から半径 R の敵のうち一番近い敵(ほかの死霊が飛びかかっている敵は後回し)
function necTarget(x, y, R, skip) {
  const taken = new Set();
  for (const s of P.souls) if (s.ph === 'out' && s.e) taken.add(s.e);
  let best = null, bd = Infinity, alt = null, ad = Infinity;
  forEachNear(x, y, R, e => {
    if (e.dead || e.prop || e.hidden || e === skip) return;
    const d = d2(x, y, e.x, e.y);
    if (!taken.has(e)) { if (d < bd) { bd = d; best = e; } } else if (d < ad) { ad = d; alt = e; }
  });
  return best || alt;
}
function necLaunch(s, e, itv) { s.ph = 'out'; s.e = e; s.ot = 0; s.hop = false; s.t = itv; }
// 死霊: 自分の周りを楕円に漂い、every 秒ごとに近くの敵へ飛びかかって戻る
function necSouls(dt) {
  const L = P.souls, n = L.length, R = NC().range * P.area, itv = necEvery();
  for (let i = 0; i < n; i++) {
    const s = L[i], a = S.time * 1.1 + i * TAU / n;
    const ox = P.x + Math.cos(a) * 15, oy = P.y - 4 + Math.sin(a) * 8 + Math.sin(S.time * 3 + i * 1.7) * 1.5; // 漂う位置
    s.bright = Math.max(0, s.bright - dt * 3);
    s.t -= dt;
    if (s.ph === 'gather') { // 葬送の構え: 頭上に集まって渦を巻く
      const ga = S.time * 6 + i * TAU / n, gx = P.x + Math.cos(ga) * 7, gy = P.y - 22 + Math.sin(ga) * 3, k = Math.min(1, dt * 12);
      s.vx = (gx - s.x) * k / dt; s.vy = (gy - s.y) * k / dt; s.x += (gx - s.x) * k; s.y += (gy - s.y) * k; s.bright = 1;
      continue;
    }
    if (s.ph === 'out') { // 飛びかかる(狙った敵が倒れたら近くの別の敵へ。いなければ戻る)
      if (!s.e || s.e.dead) { s.e = necTarget(s.x, s.y, 40); if (!s.e) { s.ph = 'back'; continue; } }
      const e = s.e, d = Math.hypot(e.x - s.x, e.y - s.y), k = Math.min(1, 300 * dt / Math.max(d, 0.01));
      s.vx = (e.x - s.x) * k / dt; s.vy = (e.y - s.y) * k / dt; s.x += (e.x - s.x) * k; s.y += (e.y - s.y) * k;
      s.ot += dt; s.bright = 1;
      if (d <= (e.r || 4) + 2) necBite(s, e);
      else if (s.ot > 0.7) s.ph = 'back';
      continue;
    }
    if (s.ph === 'join' || s.ph === 'back') { // 漂う位置へ戻る
      const d = Math.hypot(ox - s.x, oy - s.y), k = Math.min(1, (s.ph === 'join' ? 170 : 220) * dt / Math.max(d, 0.01));
      s.vx = (ox - s.x) * k / dt; s.vy = (oy - s.y) * k / dt; s.x += (ox - s.x) * k; s.y += (oy - s.y) * k;
      if (d < 3) s.ph = 'orbit';
    } else { const k = Math.min(1, dt * 10); s.vx = (ox - s.x) * k / dt; s.vy = (oy - s.y) * k / dt; s.x += (ox - s.x) * k; s.y += (oy - s.y) * k; }
    if (s.t <= 0 && s.ph !== 'join') { const e = necTarget(P.x, P.y, R); if (e) necLaunch(s, e, itv); else s.t = 0.25; }
  }
}
// 噛みつき(呪い牙: 呪う / 渡り: 近くの別の敵へもう一度)
function necBite(s, e) {
  const p = NC();
  asMine(() => {
    hitEnemy(e, necPow(), { src: 'nsoul', ang: Math.atan2(s.vy, s.vx), kb: 18, col: '#a58cff', noNum: Math.random() < 0.3 });
    if (hasSp('trait', 'fang') && !e.dead && missed !== e) e.curseT = S.time + p.curseT; // 外れた敵には付かない
    burst(e.x, e.y, 5, NEC_FX, { sp: 50, glow: true, life: 0.25 });
  });
  if (hasSp('trait', 'haste') && !s.hop) {
    const e2 = necTarget(e.x, e.y, p.hopR * P.area, e);
    if (e2) { s.hop = true; s.e = e2; s.ot = 0; return; }
  }
  s.ph = 'back';
}
// 死霊を k 体使う(古いものから)。還魂: 1体につき HP 回復。quiet: 砕ける演出を出さない(葬送で霊弾になる)
function necSpend(k, quiet) {
  const used = P.souls.splice(0, Math.min(k, P.souls.length));
  if (!quiet) asMine(() => { for (const s of used) burst(s.x, s.y, 6, NEC_FX, { sp: 60, glow: true, life: 0.3 }); });
  const h = used.length * cuV('passive', 'soul');
  if (h > 0) heal(h, true);
  S.hudDirty = true;
  return used;
}
// 死者の盾: 被弾したとき、死霊を guardN 体使ってダメージを減らす(少ないときはいるだけ使う)
//   骸の盾: 死霊が guardN × 2 体以上いるときは、その数を使って 2回分(×(1 - 軽減)^2)
//   不死の契り: 身代わりで減らしても倒れるとき、死霊が undyingMin 体以上(使う前の数)なら全て使って耐える
//   報い: 身代わりになった死霊が自分の周りで爆ぜる(1回の身代わりにつき1回。骸の盾は2回分の威力。呪詛返し: 減らしたダメージ × backK を足す)
function necGuard(dmg) {
  const p = NC(), n = P.souls.length;
  if (!n) return dmg;
  const r = cuV('passive', 'ward', p.guard), two = hasSp('passive', 'ward') && n >= p.guardN * 2, out = dmg * (two ? (1 - r) * (1 - r) : 1 - r);
  if (hasSp('passive', 'soul') && n >= p.undyingMin && S.time - P.undyingAt >= p.undyingCd) {
    const fin = Math.max(1, Math.round((out - P.armor) * (1 - P.dr))) - Math.floor(shieldTotal()); // HP が減る量(hurtPlayer と同じ計算)
    if (fin >= P.hp) { necUndying(); return null; }
  }
  necSpend(two ? p.guardN * 2 : Math.min(n, p.guardN));
  const ret = cuV('passive', 'ret');
  if (ret > 0) necRetBurst(ret * (two ? 2 : 1) + (hasSp('passive', 'ret') ? (dmg - out) * p.backK : 0));
  asMine(() => addRing(P.x, P.y, 14, '#8a6cff', { w: 2, life: 0.3 }));
  return out;
}
function necRetBurst(pow) {
  const R = NC().burstR * P.area;
  pow *= necK(); // 霊力
  asMine(() => {
    forEachNear(P.x, P.y, R, e => { if (!e.prop) hitEnemy(e, pow, { src: 'nsoul', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 50, col: '#a58cff' }); });
    burst(P.x, P.y, 16, NEC_FX, { sp: 100, glow: true, life: 0.4 });
    addRing(P.x, P.y, R, '#8a6cff', { w: 2, life: 0.3 }); addFlash(P.x, P.y, R * 2, '#5a30c0', 0.15);
  });
  AudioMan.boom();
}
function necUndying() {
  const p = NC(), n = P.souls.length;
  necSpend(n);
  P.hp = Math.min(P.maxhp, Math.max(P.hp, P.maxhp * p.undyingHp * n));
  P.undyingAt = S.time; P.ifr = Math.max(P.ifr, 1); P.invT = Math.max(P.invT, 1);
  S.hudDirty = true;
  UI.announce(_t('不死の契り'), '');
  asMine(() => {
    addRing(P.x, P.y, 50, '#8a6cff', { w: 3, life: 0.6 }); addFlash(P.x, P.y, 120, '#5a30c0', 0.4);
    burst(P.x, P.y, 40, NEC_FX, { sp: 140, up: 40, glow: true, life: 0.8 });
    shockAt(P.x, P.y, 1.6, 0.8); screenFlash(0.3 * SET.fxA, '#5a30c0');
  });
  slowmo(0.3, 0.6); AudioMan.knell();
}
// 葬送: 死霊を全て霊弾にして放つ(最低 minShots 発)。集束: 1発にまとめる / 輪廻: 使った死霊 1体につき CD -rebirth 秒
function necRelease(a) {
  const q = DATA.classes.necro.q, k = (1 + cuV('q', 'pow') + (P.lvFx.qPow || 0)) * necK(), R = q.r * (1 + cuV('q', 'area')) * P.area; // 霊力も乗る
  const used = necSpend(P.souls.length, true), shots = Math.max(q.minShots, used.length), hx = P.x, hy = P.y - 22;
  if (hasSp('q', 'area')) necBomb(hx, hy, a.a, q.pow * k * shots * q.fuseK, R * q.fuseR, 0, true);
  else for (let i = 0; i < shots; i++) {
    const s = used[i] || { x: hx, y: hy }, ang = a.a + (shots > 1 ? (i / (shots - 1) - 0.5) * 1.4 : 0);
    necBomb(s.x, s.y, ang, q.pow * k, R, i * 0.03);
  }
  const base = q.cd * (1 - cuV('q', 'cd')) * P.cdMul;
  setCd('q', hasSp('q', 'cd') ? Math.max(1, base - used.length * q.rebirth) : base);
  asMine(() => {
    addFlash(hx, hy, 70, '#5a30c0', 0.25); addRing(hx, hy, 24, '#8a6cff', { w: 2, life: 0.3 });
    burst(hx, hy, 20, NEC_FX, { sp: 110, glow: true, life: 0.4 }); shake(4); hitstop(0.05);
    fxRays(hx, hy, 64, '#5a3ab0', { n: 14, life: 0.34, core: '#c8b4ff' });
  });
  GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.6 * SET.fxA);
  AudioMan.boom();
}
function necBomb(x, y, ang, pow, R, delay, big) {
  const q = DATA.classes.necro.q;
  P.nbombs.push({ x, y, vx: Math.cos(ang) * q.speed, vy: Math.sin(ang) * q.speed, t: 0, life: q.life, pow, R, big: !!big, delay, tg: null });
}
// 霊弾: 照準方向へ飛び出し、近くの敵を追って触れると爆ぜる(寿命で消えるときも爆ぜる)
function necBombs(dt) {
  for (let i = P.nbombs.length - 1; i >= 0; i--) {
    const b = P.nbombs[i];
    if (b.delay > 0) { b.delay -= dt; continue; }
    b.t += dt;
    if (!b.tg || b.tg.dead) b.tg = nearestEnemy(b.x, b.y, 220);
    const sp = Math.min(260, Math.hypot(b.vx, b.vy) + 200 * dt);
    let cur = Math.atan2(b.vy, b.vx);
    if (b.tg && b.t > 0.08) { const d = Math.atan2(b.tg.y - b.y, b.tg.x - b.x) - cur; cur += clamp(Math.atan2(Math.sin(d), Math.cos(d)), -7 * dt, 7 * dt); }
    b.vx = Math.cos(cur) * sp; b.vy = Math.sin(cur) * sp;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (Math.random() < dt * 40) asMine(() => part(b.x, b.y, rand(-8, 8), rand(-8, 8), 0.35, pick(['#8a6cff', '#5a3ab0', '#3a2a6a']), { glow: true, drag: 4 }));
    let hit = false;
    forEachNear(b.x, b.y, b.big ? 8 : 4, e => { if (!e.dead && !e.prop) { hit = true; return false; } });
    if (hit || b.t >= b.life) { P.nbombs.splice(i, 1); necBombBurst(b, !P.nbombs.length); }
  }
}
// 霊弾の爆発(慟哭: 着弾地点に念が残る)。last: 最後の1発(鐘の音)
function necBombBurst(b, last) {
  const q = DATA.classes.necro.q;
  asMine(() => {
    forEachNear(b.x, b.y, b.R, e => {
      if (e.prop) { killEnemy(e); return; }
      hitEnemy(e, b.pow, { src: 'nrite', ang: Math.atan2(e.y - b.y, e.x - b.x), kb: b.big ? 120 : 60, col: '#a58cff' });
    });
    burst(b.x, b.y, b.big ? 50 : 16, NEC_FX, { sp: b.big ? 180 : 110, glow: true, life: 0.5 });
    addRing(b.x, b.y, b.R, '#8a6cff', { w: 2, life: 0.35 }); addFlash(b.x, b.y, b.R * 2, '#5a30c0', b.big ? 0.3 : 0.18);
    if (b.big) {
      shockAt(b.x, b.y, 1.8, 1); shake(9); hitstop(0.07); screenFlash(0.2 * SET.fxA, '#5a30c0');
      fxRays(b.x, b.y, b.R * 1.4, '#5a3ab0', { n: 16, life: 0.4, core: '#c8b4ff' }); fxDecal(b.x, b.y, b.R * 0.8, 'crack', { n: 8, col: '#0a0614', hot: '#8a6cff', heatT: 1.2, life: 3.5 });
    } else { shockAt(b.x, b.y, 0.7, 1.2); shake(2); if (Math.random() < 0.5) fxDecal(b.x, b.y, b.R * 0.6, 'scorch', { col: '#140c24', hot: '#6a4ad0', heatT: 0.6, life: 2 }); }
  });
  if (hasSp('q', 'pow')) zones.push({ kind: 'grudge', x: b.x, y: b.y, r: b.R, t: 0, dur: q.lingerT, tick: 0, dmg: q.lingerPow * necK() }); // 慟哭(霊力も乗る)
  if (last) AudioMan.knell(); else AudioMan.boom();
  if (b.big) AudioMan.impact();
}
// 霊体化: 無敵で滑るように進む
function necPhase() {
  const p = NC();
  staUse(necPhaseCost());
  P.phase = { t: p.phaseT };
  P.invT = Math.max(P.invT, p.phaseT); P.ifr = Math.max(P.ifr, p.phaseT);
  playAnim('nPhase', MOTIONS.nPhase.dur); P.anim.keep = true;
  asMine(() => burst(P.x, P.y, 14, NEC_FX, { sp: 50, glow: true, life: 0.35 }));
  AudioMan.dash();
}
// 霊体化が解けた瞬間: 死霊が全員、近くの敵へ一斉に飛びかかる(攻撃の間隔はここから数え直す)
function necVolley() {
  const R = NC().range * P.area, itv = necEvery();
  let n = 0;
  for (const s of P.souls) {
    if (s.ph === 'gather' || s.ph === 'out') continue;
    const e = necTarget(P.x, P.y, R);
    if (e) { necLaunch(s, e, itv); n++; }
  }
  asMine(() => { addRing(P.x, P.y, 20, '#8a6cff', { w: 2, life: 0.3 }); burst(P.x, P.y, 12, NEC_FX, { sp: 80, glow: true, life: 0.3 }); });
  if (n) AudioMan.slash();
}
