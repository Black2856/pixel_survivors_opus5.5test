// classes/weaponmaster.js — ウェポンマスター: クラスの実装(CLASS_RT.weaponmaster)/ 特性・パッシブ・Q の処理
'use strict';

// 専用武器を持たない。武芸百般(持っている武器の数で攻撃力・クールダウン・最大HP)と影の追撃(数秒ごとに武器のどれかがもう一度攻撃する)
// 武神降臨(Q): 分身(P.wmClone)が、持っている武器の武器スキルをランダムに使う。残像(Space): 跳んだ直後にメイン武器がもう一度攻撃する
CLASS_RT.weaponmaster = {
  skills: ['q'],
  init() { P.dash = null; P.dashHeld = false; P.wmShadeT = 0; P.shades = []; P.wmClone = null; P.wmCut = 0; P.wmKey = ''; P.wmHasteT = 0; },
  update(dt) {
    if (P.dash) { // 残像: 跳んでいる間(無敵)。最後のフレームは残りの時間だけ進める(跳ぶ距離をぴったりにする)
      const k = Math.min(dt, P.dash.t);
      P.x += P.dash.vx * k; P.y += P.dash.vy * k; P.dash.t -= dt;
      P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.12, f: P.facing, col: '#4a2e16' }]).slice(-4); // 跳んだ跡(暗い銅。明るいと光で塊に見える)
      if (P.dash.t <= 0) { P.dash = null; wmAgain(); } // 跳んだ直後: メイン武器がもう一度攻撃する
    }
    const held = defHeld();
    if (held && !P.dashHeld && !P.dash) { if (P.sta >= wmDashCost()) wmDash(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
    P.dashHeld = held;
    P.moveMul = P.dash ? 0 : 1;
    // 武芸百般: スタック・頑健が変わったら最大HP を計算し直す(applyStats が hpAdd を読む)
    const key = wmStack() + ':' + cuLv('trait', 'tough');
    if (key !== P.wmKey) { P.wmKey = key; recalc(); }
    // 器用: スタック 1つにつきクールダウン -(パスの値)(ステータスのクールダウンにさらに掛ける)
    P.cdMul = (1 - P.stats.v.cd) * P.stats.mul.cd * (1 - Math.min(0.5, wmStack() * cuV('trait', 'deft')));
    P.wmHasteT -= dt; P.atkSpd = 1 + (P.wmHasteT > 0 ? WM().hasteSpd : 0); // 早業
    wmShadeTick(dt);
    wmCloneTick(dt);
  },
  onHurt: dmg => (hasSp('trait', 'tough') && wmFull() ? dmg * (1 - WM().steadyDr) : dmg), // 不動
  onMainHit() {},
  onKill(e, o) { if (o && o.cl) wmQuick(); }, // 間髪: 分身の武器スキルで倒した
  atkBonus: () => wmStack() * cuV('trait', 'train', WM().stackAtk),
  hpAdd: () => Math.round(wmStack() * cuV('trait', 'tough')), // 頑健
  onSkill() { if (hasSp('trait', 'deft')) P.wmHasteT = WM().hasteT; }, // 早業: E / Q を使った後、全武器の攻撃速度アップ
  qStart() { // スキル名は分身が出たときに、使う武器スキルと一緒に出す(wmSummon)
    P.act = { slot: 'q', ph: 'wind', t: 0 };
    playAnim('wmSeal', MOTIONS.wmSeal.dur);
    skillWind(WM_COL, 'q'); AudioMan.click();
  },
  qUpdate(a, dt) {
    const q = DATA.classes.weaponmaster.q;
    P.moveMul = 0;
    if (a.t < q.windup) { // 構え: 両手で印を結ぶ。足元に銅色の円が縮み、光の粒が体へ集まる
      const u = a.t / q.windup;
      asMine(() => {
        if (Math.random() < dt * 25) addRing(P.x, P.y + 6, 4 + 12 * (1 - u), WM_COL, { r0: 6 + 12 * (1 - u), life: 0.12 });
        for (let n = dt * 40; Math.random() < n; n--) { const r = rand(0, TAU), d = rand(12, 22); part(P.x + Math.cos(r) * d, P.y - 4 + Math.sin(r) * d * 0.6, -Math.cos(r) * d * 3, -Math.sin(r) * d * 2, 0.3, pick(WM_FX), { glow: Math.random() < 0.3, drag: 0 }); }
      });
      return;
    }
    wmSummon();
    P.act = null;
  },
  res: () => ({ kind: 'arms', label: _t('武器'), v: Object.keys(P.weapons).length, max: P.weaponSlots, seg: true, dk: '#7a4a22', pulse: '#e0a060' }),
  staBroken: () => false,
  statuses() {
    const out = [], p = WM(), n = wmStack(), pc = v => String(+(v * 100).toFixed(1));
    const atk = n * cuV('trait', 'train', p.stackAtk), deft = Math.min(0.5, n * cuV('trait', 'deft')), hp = Math.round(n * cuV('trait', 'tough')), steady = hasSp('trait', 'tough') && wmFull();
    out.push({ id: 'wmArts', glyph: '武', name: _t`武芸百般 ${+n.toFixed(1)}`, kind: 'buff',
      fx: _t`攻撃力 +${pc(atk)}%` + (deft ? _t`・クールダウン -${pc(deft)}%` : '') + (hp ? _t`・最大HP +${hp}` : '') + (steady ? _t`・被ダメージ -${Math.round(p.steadyDr * 100)}%(不動)` : '') });
    if (P.wmHasteT > 0) out.push({ id: 'wmHaste', glyph: '速', name: _t('早業'), fx: _t`攻撃速度 +${Math.round(p.hasteSpd * 100)}%`, t: P.wmHasteT, max: p.hasteT, kind: 'buff' });
    const every = wmShadeEvery(), left = Math.max(0, every - P.wmShadeT);
    out.push({ id: 'wmShade', glyph: '影', name: _t('影の追撃'), fx: _t`${+every.toFixed(1)}秒ごとに、持っている武器(メイン武器も)のどれかがもう一度攻撃する(次まで ${left.toFixed(1)}秒)`, t: left, max: every, kind: 'buff' });
    const c = P.wmClone;
    if (c) out.push({ id: 'wmClone', glyph: '神', name: DATA.classes.weaponmaster.q.name, kind: 'buff', t: c.stay ? Math.max(0, c.stay - c.t) : undefined, max: c.stay || undefined,
      fx: _t`分身が武器スキルを使う(残り ${c.list.length - c.i}つ)` + (c.stay ? _t`・化身: 使った武器 ${c.used.length}種の通常攻撃` : '') });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.weaponmaster.q.name, glyph: '神' }),
  info(c) {
    const p = WM(), q = DATA.classes.weaponmaster.q, pc = v => String(+(v * 100).toFixed(1)), ar = (1 + c.st.v.area) * c.st.mul.area;
    const owned = c.run ? Object.keys(P.weapons).length : 1, n = c.run ? wmStack() : 1 + (c.lvFx.stack || 0), slots = c.run ? P.weaponSlots : c.st.v.wslot;
    const per = c.cuV('trait', 'train', p.stackAtk), deft = c.cuV('trait', 'deft'), tough = c.cuV('trait', 'tough'), evo = c.hasSp('trait', 'train') ? 1 : p.evoK;
    const every = p.shadeT - c.cuV('passive', 'freq') - (c.lvFx.shadeCut || 0), sp = 1 + c.cuV('passive', 'pow') + (c.lvFx.shadePow || 0), edge = c.cuV('passive', 'edge');
    const qn = q.n + c.cuV('q', 'multi') + (c.lvFx.qN || 0), lvA = c.run ? cuLv('q', 'art') : 0, qk = 1 + c.cuV('q', 'art') + (c.lvFx.qPow || 0);
    return [
      { key: _t('特性'), name: _t('武芸百般'), cat: 'trait', desc: [
        _t`持っている武器 1つにつき 攻撃力 +${pc(p.stackAtk)}%`,
        _t`進化した武器は 効果 +${Math.round(p.evoK * 100)}%(1つで ${1 + p.evoK}つ分)`,
      ].concat(c.lvFx.stack ? [_t`クラスLv3: 常に +${c.lvFx.stack}つ分`] : []), rows: [
        [_t('武芸百般'), _t`<b>${+n.toFixed(1)}</b> つ分`, c.run ? _t`武器 ${owned} / ${slots}。進化した武器は ${1 + evo}つ分` : _t('ラン開始時(メイン武器 1つ)')],
        [_t('攻撃力'), `<b>+${pc(n * per)}%</b>`, _t`1つにつき +${pc(per)}%`],
      ].concat(deft ? [[_t('クールダウン'), `<b>-${pc(Math.min(0.5, n * deft))}%</b>`, _t`器用: 1つにつき -${pc(deft)}%`]] : [])
        .concat(tough ? [[_t('最大HP'), `<b>+${Math.round(n * tough)}</b>`, _t`頑健: 1つにつき +${tough}`]] : []) },
      { key: _t('パッシブ'), name: _t('影の追撃'), cat: 'passive', desc: [
        _t`${p.shadeT}秒ごとに、持っている武器(メイン武器も)のどれか 1つを影がまねて、その武器がすぐにもう一度攻撃する(威力は通常攻撃と同じ)`,
        _t('影は自分の横に現れ、攻撃はそこから出る'),
      ], rows: [
        [_t('間隔'), _t`<b>${+every.toFixed(1)}</b> 秒`],
        [_t('まねた攻撃の威力'), `<b>${Math.round(sp * (c.hasSp('passive', 'freq') ? 1 - p.twinCut : 1) * 100)}%</b>` + (c.hasSp('passive', 'freq') ? _t(' × 2体') : ''), _t('通常攻撃の威力に対して')],
      ].concat(edge ? [[_t('影刃の威力'), `${edge} → <b>${Math.round(edge * c.atkMul)}</b>`, _t`半径 ${Math.round(p.edgeR * ar)}。攻撃力を掛けた値`]] : []) },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → 自分の隣に分身をつくる。分身は持っている武器の武器スキルをランダムに ${q.n}種(重複なし)使う`,
        _t`分身は ${q.gap}秒おきに 1つずつ使う。自分はすぐに動ける。分身は狙われず、ダメージも受けない`,
        _t('威力はその武器の今の値(Lv・進化・熟練)。メイン武器の E の強化も効く'),
        _t('武器スキルの自分への効果(シールド・回復など)は自分に入る'),
      ], rows: [
        ['CD', _t`<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('武器スキル'), _t`<b>${qn}</b> 種`, c.run ? _t`今は ${Math.min(qn, owned)} 種(持っている武器の数まで)` : _t('持っている武器の数まで')],
        [_t('威力'), `<b>${Math.round(qk * 100)}%</b>`, _t('武器スキルの威力に対して(練度・クラスLv)')],
      ].concat(lvA ? [[_t('範囲 / 射程'), `+${Math.round(q.artArea[lvA - 1] * 100)}% / +${Math.round(q.artRange[lvA - 1] * 100)}%`, _t('練度')]] : []) },
      { key: 'Space', name: _t('残像'), desc: [
        _t`移動方向へ ${p.dashDist} 跳ぶ(${p.dashTime}秒。${p.dashIfr}秒 無敵)。元の位置に残像が残る`,
        _t('跳んだ直後、メイン武器がすぐにもう一度攻撃する'),
      ], rows: [
        [_t('スタミナ消費'), `<b>${wmDashCostOf(c.lvFx)}</b>`],
      ] },
    ];
  },
};

// ---------- ウェポンマスター ----------
const WM = () => DATA.classes.weaponmaster.params;
const WM_COL = '#d08a48';                                  // クラスの色(銅)
const WM_FX = ['#d08a48', '#8a5a2a', '#5a3a1a', '#ffe8cc']; // 銅の粒(明るい色は少しだけ)
const WM_SMOKE = ['#5a4a40', '#3a2e28', '#8a5a2a'];         // 煙(分身の出入り・持ち替え・影)
const WM_SHADE_LIFE = 0.45;                                // 影が見えている時間
// 武芸百般のスタック: 持っている武器 1つにつき 1(進化した武器は 1 + evoK。極意で 2)+ クラスLv3
function wmStack() {
  const evo = hasSp('trait', 'train') ? 1 : WM().evoK;
  let n = P.lvFx.stack || 0;
  for (const k in P.weapons) n += P.weapons[k].evo ? 1 + evo : 1;
  return n;
}
const wmFull = () => Object.keys(P.weapons).length >= P.weaponSlots;           // 武器枠が全て埋まっている(不動)
const wmDashCostOf = lvFx => WM().dashCost - (lvFx.dashCut || 0);              // 残像のスタミナ(クラスLv6)
const wmDashCost = () => wmDashCostOf(P.lvFx);
const wmShadeEvery = () => WM().shadeT - cuV('passive', 'freq') - (P.lvFx.shadeCut || 0); // 影の追撃の間隔(頻度・クラスLv5)
// 影の追撃(毎フレーム): 間隔ごとに影が現れる。まねる武器は持っている武器(メイン武器も)からランダム
//   双影: 2体(別の武器。武器が 1つだけのときは同じ武器を 2体がまねる)
function wmShadeTick(dt) {
  for (const s of P.shades) s.t += dt;
  if (P.shades.length) P.shades = P.shades.filter(s => s.t < WM_SHADE_LIFE);
  const ks = shuffle(Object.keys(P.weapons));
  if (!ks.length || (P.wmShadeT += dt) < wmShadeEvery()) return;
  P.wmShadeT = 0;
  const twin = hasSp('passive', 'freq'), side = Math.random() < 0.5 ? -1 : 1;
  wmShade(ks[0], side, twin);
  if (twin) wmShade(ks[1] || ks[0], -side, true);
}
// 影 1体: 自分の横に現れ、武器 k の攻撃をまねる(攻撃は影の位置から)。威力 ×(1 + 威力のパス + クラスLv17)。双影は -twinCut
//   残響: その武器の攻撃速度 +echoSpd(echoT 秒)/ 影刃: 影の周り(半径 edgeR)へ 基礎威力(パスの値)。影縫い: スタン
function wmShade(k, side, twin) {
  const p = WM(), w = P.weapons[k], st = wst(k), s = { x: P.x + side * p.shadeD, y: P.y, face: P.facing, t: 0, k };
  const mul = (1 + cuV('passive', 'pow') + (P.lvFx.shadePow || 0)) * (twin ? 1 - p.twinCut : 1);
  P.shades.push(s);
  weaponFire(k, w, Object.assign({}, st, { dmg: st.dmg * mul }), orgOf(s, 'S'));
  if (hasSp('passive', 'pow')) { w.haste = 1 + p.echoSpd; w.hasteT = S.time + p.echoT; } // 残響
  const edge = cuV('passive', 'edge'), R = p.edgeR * P.area, stun = hasSp('passive', 'edge');
  asMine(() => {
    if (edge) { // 影刃: 影の周りの敵に黒い斬り跡が走る(8体まで)。範囲の縁に銅の輪
      let marks = 0;
      forEachNear(s.x, s.y, R, e => {
        if (e.prop) { killEnemy(e); return; }
        hitEnemy(e, edge, { src: 'wshade', ang: Math.atan2(e.y - s.y, e.x - s.x), kb: 30, col: WM_COL, noNum: Math.random() < 0.4 });
        if (stun && !e.dead && missed !== e) e.stun = Math.max(e.stun || 0, p.stunT); // 影縫い(外れた敵は止まらない)
        if (marks++ < 8) { const a = rand(0, Math.PI), L = (e.r || 4) + 3; slashes.push({ mark: true, x: e.x - Math.cos(a) * L, y: e.y - 2 - Math.sin(a) * L, x1: e.x + Math.cos(a) * L, y1: e.y - 2 + Math.sin(a) * L, t: 0, life: 0.2, col: '#2a1a0e', core: '#d08a48' }); }
      });
      addRing(s.x, s.y, R, '#8a5a2a', { r0: R * 0.6, life: 0.22 });
    }
    burst(s.x, s.y - 4, 8, WM_SMOKE, { sp: 40, up: 15, life: 0.35, drag: 2 });
  });
  AudioMan.shade();
}
// 残像(Space): 移動方向へ跳ぶ(無敵)。元の位置に銅色の残像
function wmDash() {
  const p = WM(), d = P.moving && P.dir ? P.dir : [P.facing, 0], len = Math.hypot(d[0], d[1]) || 1;
  staUse(wmDashCost());
  P.dash = { vx: d[0] / len * p.dashDist / p.dashTime, vy: d[1] / len * p.dashDist / p.dashTime, t: p.dashTime };
  P.invT = Math.max(P.invT, dodgeIfr(p.dashIfr)); P.ifr = Math.max(P.ifr, dodgeIfr(p.dashIfr));
  P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0, f: P.facing, col: '#7a4a22' }]); // 元の位置の残像(銅)
  playAnim('wmDash', MOTIONS.wmDash.dur); P.anim.keep = true;
  asMine(() => burst(P.x, P.y + 5, 8, WM_SMOKE, { sp: 40, up: 8, life: 0.3, drag: 3 }));
  AudioMan.dash();
}
// 残像: 跳んだ直後にメイン武器がもう一度攻撃する(攻撃間隔はそのまま)
function wmAgain() {
  const k = P.mainW;
  if (P.weapons[k]) weaponFire(k, P.weapons[k], wst(k), P_ORG);
  asMine(() => addRing(P.x, P.y, 12, WM_COL, { life: 0.2 }));
}
// 間髪: 分身の武器スキルで敵を倒すたびに 武神降臨の CD -killCd(1回の武神降臨で killMax まで)
function wmQuick() {
  const q = DATA.classes.weaponmaster.q;
  if (!hasSp('q', 'cd') || P.wmCut >= q.killMax) return;
  const n = Math.min(q.killCd, q.killMax - P.wmCut);
  P.wmCut += n; P.sk.q.cd = Math.max(0, P.sk.q.cd - n); S.hudDirty = true;
}
// 武神降臨: 分身を生む。持っている武器の武器スキルから n 個(多芸・クラスLv10。重複なし。武器の数まで)を選び、gap 秒おきに使わせる
//   分身: 自分の後ろ側(side)についてくる / list: 使う武器の順 / extra: 秘伝で付く特殊強化(武器ごと)/ chans: 使っている途中の武器スキル
//   stay: 化身(残る秒)/ cws: 化身の通常攻撃の武器の状態
//   秘伝: その武器の特殊強化を 1つ(メイン武器ですでに特殊強化を持っているときは残りの 2つから)
function wmSummon() {
  const q = DATA.classes.weaponmaster.q, n = q.n + cuV('q', 'multi') + (P.lvFx.qN || 0);
  const list = shuffle(Object.keys(P.weapons).filter(k => WEAPON_SKILL[k] && WEAPON_SKILL[k].cast)).slice(0, n);
  const extra = list.map(k => (hasSp('q', 'art') ? pick(Object.keys(DATA.weapons[k].skill.tree.paths).filter(p => !(k === P.mainW && P.cs.e === p))) : null));
  if (P.wmClone) wmCloneEnd(P.wmClone);
  const side = -P.facing, c = { x: P.x + side * 16, y: P.y + 1, side, face: P.facing, t: 0, list, extra, i: 0, next: 0.05, lastT: 0, chans: [], cur: null, curT: 9,
    stay: hasSp('q', 'multi') ? q.stayT : 0, cws: {}, used: [] };
  c.org = orgOf(c, 'C');
  P.wmClone = c; P.wmCut = 0;
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  UI.skillCut(q.name, WM_COL, true, { glyph: clsRT().qInfo().glyph, sub: list.map((k, i) => DATA.weapons[k].skill.name + (extra[i] ? `(${DATA.weapons[k].skill.tree.paths[extra[i]].sp.name})` : '')).join(' / ') }); // 使う武器スキル(秘伝の特殊強化)
  asMine(() => { // 体から半透明の分身が抜け出す: 煙と銅色の輪(自分が中心の衝撃波は自分の絵を引き伸ばすので使わない)
    burst(c.x, c.y - 4, 18, WM_SMOKE, { sp: 60, up: 20, life: 0.5, drag: 2 });
    for (let i = 0; i < 10; i++) part(P.x, P.y - 6, side * rand(40, 90), rand(-30, 10), 0.3, pick(WM_FX), { glow: i % 3 === 0, drag: 4 });
    addRing(c.x, c.y + 5, 14, WM_COL, { w: 2, life: 0.35 }); addFlash(c.x, c.y, 40, '#5a3a1a', 0.2);
    fxRays(c.x, c.y - 4, 56, '#8a5a2a', { n: 12, life: 0.32, core: '#d08a48' });
    for (let i = 0; i < 4; i++) fxGlint(c.x + rand(-8, 8), c.y - 4 + rand(-10, 6), rand(4, 7), WM_COL, { t: -i * 0.05, life: 0.25 }); // 分身が武器をかまえてきらめく
    shake(3);
  });
  AudioMan.summon();
}
// 分身(毎フレーム): ついてくる → gap 秒おきに武器スキル → 途中の武器スキルを進める → 化身の通常攻撃 → 全て終わったら消える
function wmCloneTick(dt) {
  const c = P.wmClone;
  if (!c) return;
  const q = DATA.classes.weaponmaster.q;
  c.t += dt; c.curT += dt;
  const tx = P.x + c.side * 16, ty = P.y + 1, k = Math.min(1, dt * 7);
  c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
  const e = nearestEnemy(c.x, c.y, 160);
  c.face = e ? (e.x < c.x ? -1 : 1) : P.facing;
  if ((c.next -= dt) <= 0 && c.i < c.list.length) { c.next += q.gap; wmCloneCast(c, c.list[c.i], c.extra[c.i]); c.i++; }
  c.chans = c.chans.filter(ch => !ch.step(dt));
  if (c.stay) { const cdt = atkLock() ? 0 : dt * cdRateK(); for (const k2 of c.used) weaponStep(k2, c.cws[k2], dt, cdt, c.org); } // 化身(凍結・麻痺の間は攻撃が出ない)
  if (c.i >= c.list.length && !c.chans.length && c.t >= Math.max(c.stay, c.lastT + 0.35)) wmCloneEnd(c);
}
// 分身が武器 k の武器スキルを使う: 持ち替え(煙)→ 分身の使い手から cast。威力: 熟練の E の威力 ×(1 + 練度 + クラスLv8・11)/ extra: 秘伝の特殊強化
function wmCloneCast(c, k, extra) {
  if (!P.weapons[k]) return; // 使う前に手放した武器(ふつうは起きない)
  const m = P.wm[k] || {}, X = wmCaster(c, k, extra);
  const ch = WEAPON_SKILL[k].cast(X, { pow: (1 + (m.ePow || 0)) * (1 + cuV('q', 'art') + (P.lvFx.qPow || 0)) });
  if (ch) c.chans.push(ch);
  c.cur = k; c.curT = 0; c.lastT = c.t;
  if (!c.used.includes(k)) { c.used.push(k); c.cws[k] = Object.assign(Object.create(P.weapons[k]), { cd: 0, q: [], tick: 0, t: 0, ang: 0, blades: null, R: 0, cutN: 0, cutAt: 0, hasteT: 0 }); }
  asMine(() => { burst(c.x, c.y - 6, 10, WM_SMOKE, { sp: 45, up: 15, life: 0.35, drag: 2 }); addRing(c.x, c.y + 5, 10, DATA.weapons[k].col, { life: 0.25 }); fxGlint(c.x + c.face * 5, c.y - 8, 6, DATA.weapons[k].col, { life: 0.2 }); }); // 持ち替えの煙と、武器の色の輪・きらめき
  AudioMan.click();
}
// 分身の使い手(武器スキルの cast に渡す)。位置は分身(分身が消えた後も残る効果は自分の位置へ。戻ってくる斧など)
//   E の強化: メイン武器なら自分の E の強化ツリーをそのまま / それ以外は強化なし(秘伝の特殊強化だけ)
//   範囲・射程: 練度で上がる / 剣の舞の CD 短縮は武神降臨の CD へ
function wmCaster(c, k, extra) {
  const q = DATA.classes.weaponmaster.q, lvA = cuLv('q', 'art'), main = k === P.mainW, here = () => P.wmClone === c;
  return {
    cl: true,
    get x() { return here() ? c.x : P.x; }, get y() { return here() ? c.y : P.y; }, get face() { return here() ? c.face : P.facing; },
    area: P.area * (1 + (lvA ? q.artArea[lvA - 1] : 0)), range: P.range * (1 + (lvA ? q.artRange[lvA - 1] : 0)),
    lv: (p, d = 0) => (main ? cuV('e', p, d) : d), sp: p => (main && hasSp('e', p)) || p === extra,
    aim(maxD) { const x = this.x, y = this.y, t = mouseAimPt() || nearestEnemy(x, y, maxD); return t ? Math.atan2(t.y - y, t.x - x) : (this.face > 0 ? 0 : Math.PI); },
    tgt(R) { return aimPt(this.x, this.y, R, this.face); },
    cdCut(n) { P.sk.q.cd = Math.max(0, P.sk.q.cd - n); S.hudDirty = true; },
  };
}
// 分身が煙のように消える
function wmCloneEnd(c) {
  if (P.wmClone === c) P.wmClone = null;
  asMine(() => burst(c.x, c.y - 4, 22, WM_SMOKE, { sp: 40, up: 25, life: 0.7, drag: 2 }));
}
