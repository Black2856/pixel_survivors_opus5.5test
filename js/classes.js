// classes.js — クラスのランタイム(スタミナ・防御スキル・クラス特性・パッシブ・E / Q スキル)
// world.js からは clsInit / clsUpdate / clsOnHurt / clsOnMainHit / clsOnKill / clsAtkBonus などの入口だけを呼ぶ
'use strict';

// ---------- 共通: スタミナ ----------
// ガード系の防御スキルは、受けるはずだったダメージ分のスタミナを失い、staLock 秒のあいだ回復が止まる
function staUse(n, lock = 0) {
  P.sta = Math.max(0, P.sta - n);
  if (lock) P.staLockT = Math.max(P.staLockT, lock);
  S.hudDirty = true;
}
function updStamina(dt) {
  P.staLockT -= dt;
  if (P.staLockT <= 0 && P.sta < P.maxSta) P.sta = Math.min(P.maxSta, P.sta + P.staRegen * dt * (P.fatigueT > 0 ? DATA.debuff.fatigue : 1) * (P.cdSlowT > 0 ? DATA.debuff.slowRegen : 1)); // 疲労中・スロウタイム(時の歪み)の中はスタミナ回復 -50%(重なると掛け算)
}

// ---------- ラン中の強化(強化ツリー) ----------
// P.cu['カテゴリ.パス'] = Lv(1〜3) / P.cs[カテゴリ] = 特殊強化を取ったパス
// カテゴリ e(武器スキル)はメイン武器の skill.tree、それ以外はクラスの tree
const weaponSkill = () => DATA.weapons[P.mainW] && DATA.weapons[P.mainW].skill;
const treeCat = cat => (cat === 'e' ? weaponSkill() && weaponSkill().tree : DATA.classes[P.cls].tree[cat]);
const cuLv = (cat, path) => P.cu[cat + '.' + path] || 0;
const cuV = (cat, path, def = 0) => { const l = cuLv(cat, path); return l ? treeCat(cat).paths[path].v[l - 1] : def; };
const hasSp = (cat, path) => P.cs[cat] === path;

// ---------- 共通: E / Q ----------
// P.sk[slot] = { cd: 残り秒, max: 直近の CD 秒 } / P.act = 実行中のスキル(動けない時間などを管理)
// P.anim = 再生中のモーション { name, t, dur }(motions.js)
function aimDir(maxD) {
  const m = mouseAimPt();
  if (m) return Math.atan2(m.y - P.y, m.x - P.x);
  const e = nearestEnemy(P.x, P.y, maxD);
  if (e) return Math.atan2(e.y - P.y, e.x - P.x);
  return P.dir ? Math.atan2(P.dir[1], P.dir[0]) : (P.facing < 0 ? Math.PI : 0);
}
// (x, y) から狙う位置: 照準 → 一番近い敵 → 向いている方向の前。R より遠ければ R まで
function aimPt(x, y, R, face) {
  let t = mouseAimPt() || nearestEnemy(x, y, R) || { x: x + face * 60, y };
  const dd = Math.sqrt(d2(x, y, t.x, t.y));
  if (dd > R) t = { x: x + (t.x - x) * R / dd, y: y + (t.y - y) * R / dd };
  return t;
}
// 武器スキルの使い手。武器スキルは位置・向き・強化を使い手から読む(自分の E は ME。ほかの仕組みは自分の使い手を作って WEAPON_SKILL[k].cast を呼ぶ)
//   x, y: 位置(毎回読む)/ face: 向き / area, range: 範囲・射程の倍率 / lv(path, def): 強化ツリーの値 / sp(path): 特殊強化を持っているか
//   aim(maxD): 狙う向き / tgt(R): 狙う位置 / cdCut(秒): スキルの CD を縮める(剣の舞)/ cl: 自分以外が使った(撃破の数え方。hitEnemy の o.cl)
const ME = {
  cl: false,
  get x() { return P.x; }, get y() { return P.y; }, get face() { return P.facing; },
  get area() { return P.area; }, get range() { return P.range; },
  lv: (p, d = 0) => cuV('e', p, d), sp: p => hasSp('e', p),
  aim: maxD => aimDir(maxD), tgt: R => aimPt(P.x, P.y, R, P.facing),
  cdCut(n) { P.sk.e.cd = Math.max(0, P.sk.e.cd - n); },
};
// 半径 r 以内に敵が n 体以上いるか(自動発動の条件)。ボスは1体で条件を満たす
function crowd(r, n) {
  let c = 0;
  forEachNear(P.x, P.y, r, e => { if (!e.prop && !e.dead) c += e.boss ? n : 1; });
  return c >= n;
}
function setCd(slot, sec) {
  P.sk[slot].cd = P.sk[slot].max = Math.max(1, sec); S.hudDirty = true;
  if (clsRT() && clsRT().onSkill) clsRT().onSkill(slot); // スキル使用(メイジの余韻など)
}
function playAnim(name, dur, arg) { P.anim = { name, t: 0, dur, arg }; } // arg: モーションに渡す値(乱れ桜の持続時間など)
// スキル名を頭上に出す(カットイン)
function skillCall(name, col) {
  addFloat(P.x, P.y - 26, name, col, 1.4, -18);
  UI.announce(name, '');
}

// 武器スキル(E)。メイン武器ごとの実装
const WEAPON_SKILL = {
  // 乱れ桜: 構え → 周囲を連続で斬る(移動できる)→ 終了
  katana: {
    // ステータス画面用(c: StatusUI の値一式 / dmg: 熟練を掛けた武器の威力)
    info(c, dmg) {
      const sk = DATA.weapons.katana.skill, m = c.wm;
      const cd = sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul, one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
      return { name: sk.name, cat: 'e', desc: [
        `構え ${sk.windup}秒 → ${sk.dur}秒間、周り(半径 ${sk.radius})を連続で斬る`,
        `1回の威力: 武器の威力 × ${Math.round(sk.pow * 100)}%`,
        '使っている間も動ける',
      ], rows: [
        ['CD', `<b>${cd.toFixed(1)}</b> 秒`],
        ['斬る回数', `${sk.hits + Math.round(c.cuV('e', 'dur') / 0.15) + (m.eHits || 0)} 回 / ${(sk.dur + c.cuV('e', 'dur')).toFixed(2)} 秒`],
        ['1回の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
      ] };
    },
    start() {
      const sk = weaponSkill(), m = P.wm.katana || {}; // 熟練: 斬る回数・威力
      P.act = Object.assign(ranbuState(ME, clsESkillMul() * (1 + (m.ePow || 0))), { slot: 'e', ph: 'wind', t: 0 });
      playAnim('ranbu', MOTIONS.ranbu.duration(P.act.dur), P.act.dur);
      setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul); // 熟練のクールダウンは武器スキルにも効く
      skillCall(sk.name, '#ffb7d5'); AudioMan.click();
      burst(P.x, P.y, 12, ['#ffb7d5', '#ffffff'], { sp: 40, up: 20, glow: true });
    },
    update(a, dt) {
      const sk = weaponSkill();
      if (a.ph === 'wind') { P.moveMul = 0; if (a.t >= sk.windup) a.ph = 'spin'; return; }
      if (hasSp('e', 'dur')) { P.moveMul *= 1.5; P.invT = Math.max(P.invT, 0.05); } // 千本桜
      if (ranbuStep(ME, a, dt)) P.act = null;
    },
    // 分身など自分以外の使い手(構えなし)。乱れ桜の間は使い手のまわりを斬り続ける(返り値の step が true で終わり)
    cast(X, a) {
      const s = ranbuState(X, a.pow);
      if (X.sp('dur')) s.self = true; // 千本桜: 自分の移動速度・無敵(自分への効果は自分に入る)
      return { step: dt => { if (s.self) { P.moveMul *= 1.5; P.invT = Math.max(P.invT, 0.05); } return ranbuStep(X, s, dt); } };
    },
  },
};
// 乱れ桜 1回分の状態(dur: 斬る時間 / hits: 斬る回数 / pow: 威力の倍率)
function ranbuState(X, pow) {
  const sk = DATA.weapons.katana.skill, m = P.wm.katana || {};
  return { dur: sk.dur + X.lv('dur'), hits: sk.hits + Math.round(X.lv('dur') / 0.15) + (m.eHits || 0), n: 0, hitT: 0, u: 0, pow };
}
// 乱れ桜を dt 進める(終わったら true)
function ranbuStep(X, a, dt) {
  const sk = DATA.weapons.katana.skill;
  a.u += dt; a.hitT -= dt;
  if (a.hitT <= 0 && a.n < a.hits) { a.hitT += a.dur / a.hits; a.n++; ranbuHit(X, a); }
  if (Math.random() < dt * 40) part(X.x + rand(-sk.radius, sk.radius) * X.area, X.y + rand(-sk.radius, sk.radius) * X.area, rand(-20, 20), rand(-30, 0), 0.8, pick(['#ffb7d5', '#ff8ac0', '#ffffff']), { glow: true, drag: 1 });
  for (let n = dt * 45 * SET.fxA; Math.random() < n; n--) ranbuCut(X); // あちこちで流れるような斬撃(毎秒 約45本)
  if (a.u < a.dur) return false;
  if (X.sp('pow')) sakuraBurst(X, a); // 桜吹雪
  return true;
}
// アーケイン・バラージュ(マジックボルトの E): 詠唱 → 照準方向へ連射(連射中も普通に動ける)。魔力障壁(持続の特殊強化)では撃破で連射が伸びる
// オーブ(迅速の特殊強化)では、代わりに周りを回るオーブが5秒間連射し、自分は自由に動ける
WEAPON_SKILL.bolt = {
  info(c, dmg) {
    const sk = DATA.weapons.bolt.skill, m = c.wm, dur = sk.dur + c.cuV('e', 'dur') + (m.eDur || 0), one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      `構え ${sk.windup}秒 → ${sk.dur}秒間、照準方向へ毎秒 ${sk.rate}発の魔弾を連射`,
      `1発の威力: 武器の威力 × ${Math.round(sk.pow * 100)}%`,
      '連射中も普通に動ける',
      `弾数は通常攻撃の ${Math.round(sk.countMul * 100)}%。弾速・貫通・追尾は通常攻撃と同じ`,
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['連射', `${Math.round(dur * sk.rate)} 発 / ${dur.toFixed(1)} 秒`],
      ['1発の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.bolt || {};
    const o = barrageState(ME, clsESkillMul() * (1 + (m.ePow || 0)));
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    skillCall(sk.name, '#b98bff'); AudioMan.click();
    if (hasSp('e', 'cd')) { arcaneOrb(ME, o); return; } // オーブ
    P.act = Object.assign(o, { slot: 'e', ph: 'wind', t: 0 });
    if (hasSp('e', 'dur')) gainShield(P.maxhp * sk.shield); // 魔力障壁
    playAnim('mBarrage', MOTIONS.mBarrage.duration(o.dur), o.dur);
    addRing(P.x, P.y, 20, '#b98bff', { w: 2, life: 0.4 });
  },
  update(a, dt) {
    const sk = weaponSkill();
    if (a.ph === 'wind') { // 詠唱: 足元に魔法陣
      P.moveMul = 0;
      if (Math.random() < dt * 40) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 14, P.y + 5 + Math.sin(r) * 6, 0, -20, 0.4, pick(['#b98bff', '#ffffff']), { glow: true }); }
      if (a.t >= sk.windup) { a.ph = 'fire'; a.kills = S.kills; }
      return;
    }
    const d0 = a.dur, done = barrageStep(ME, a, dt);
    if (a.dur > d0 && P.anim && P.anim.name === 'mBarrage') { P.anim.dur += a.dur - d0; P.anim.arg += a.dur - d0; } // 魔力障壁で伸びた分はモーションも伸ばす
    if (!done) return;
    P.act = null;
    asMine(() => { addRing(P.x, P.y, 28, '#b98bff', { w: 2, life: 0.35 }); burst(P.x, P.y, 16, ['#b98bff', '#ffffff'], { sp: 80, glow: true }); });
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
  return { dur: sk.dur + X.lv('dur') + (m.eDur || 0), pow, shotT: 0, u: 0, kills: S.kills, ext: 0, id: (S.actId = (S.actId || 0) + 1) };
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
  if (X.sp('dur') && S.kills > a.kills && a.ext < sk.killExtMax) {
    const add = Math.min(sk.killExtMax - a.ext, (S.kills - a.kills) * sk.killExt);
    a.dur += add; a.ext += add;
  }
  a.kills = S.kills;
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
  AudioMan.shoot();
}

// アローレイン(長弓の E): 構え → 空へ放つ → 照準位置に矢の雨(雨はその場に残り、放った後は動ける)
// 雨そのものは zones の 'rain'(world.js の updZones で矢を降らせる)
WEAPON_SKILL.longbow = {
  info(c, dmg) {
    const sk = DATA.weapons.longbow.skill, m = c.wm, heavy = c.hasSp('e', 'pow'), dur = (sk.dur + (m.eDur || 0)) * (c.hasSp('e', 'cd') ? 1.5 : 1);
    const one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0)) * (heavy ? 0.6 : 1);
    return { name: sk.name, cat: 'e', desc: [
      `構え ${sk.windup}秒 → 照準位置の半径 ${sk.radius} に ${sk.dur}秒間、矢が降り注ぐ`,
      `${sk.every}秒ごとに、範囲内の敵全員へ 武器の威力 × ${Math.round(sk.pow * 100)}%`,
      '放った後は自由に動ける(雨はその場に残る)',
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['攻撃回数', `${Math.round(dur / (sk.every * (heavy ? 0.5 : 1)))} 回 / ${dur.toFixed(1)} 秒`],
      ['1回の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.longbow || {}, t = ME.tgt(sk.range * P.range);
    if (t.x !== P.x) P.facing = t.x < P.x ? -1 : 1;
    P.act = { slot: 'e', ph: 'wind', t: 0, x: t.x, y: t.y, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('aRain', MOTIONS.aRain.dur);
    skillCall(sk.name, '#b8ff9a'); AudioMan.click();
  },
  update(a, dt) {
    const sk = weaponSkill();
    P.moveMul = 0;
    if (a.t < sk.windup) { if (Math.random() < dt * 30) part(P.x + rand(-8, 8), P.y + 6, rand(-20, 20), -10, 0.4, pick(['#b8ff9a', '#e4ffd8']), { glow: true }); return; }
    arrowRain(ME, a);
    P.act = null;
  },
  cast(X, a) {
    const t = X.tgt(DATA.weapons.longbow.skill.range * X.range);
    arrowRain(X, { x: t.x, y: t.y, pow: a.pow });
    return null;
  },
};
// アローレインを放つ: 照準位置 (a.x, a.y) に矢の雨(zones の 'rain')。追従は使い手についていく
//   見た目: 空へ矢の一斉射(上へ飛んで消える)→ 照準の輪が縮んで定まる → 空から斜めに矢が降り注ぎ、地面に刺さって残る(world.js / render.js)
//   slant: 矢の傾き(1 落ちるあいだに横へ進む量。降る向きは使い手の向き)/ linger: 終わった後も刺さった矢が残る秒
function arrowRain(X, a) {
  const sk = DATA.weapons.longbow.skill, m = P.wm.longbow || {};
  const heavy = X.sp('pow'), delay = 0.25; // 放ってから降り始めるまで
  const follow = X.sp('cd'); // 追従: ついてくる + 持続 +50%
  const x = X.x, y = X.y, f = X.face || 1, every = sk.every * (heavy ? 0.5 : 1);
  // acc = every: 照準の輪が定まった瞬間(delay)に 1回目が降る(dur 秒で dur / every 回)
  zones.push({ kind: 'rain', x: a.x, y: a.y, r: sk.radius * (1 + X.lv('area')) * X.area, t: 0, delay, dur: delay + (sk.dur + (m.eDur || 0)) * (follow ? 1.5 : 1), tick: 0, acc: every,
    every, dmg: wst('longbow').dmg * sk.pow * (1 + X.lv('pow')) * a.pow * (heavy ? 0.6 : 1),
    nArrows: sk.arrows, follow: follow ? X : null, fire: X.sp('area') ? sk.fire : 0, fireT: sk.fireT, arrows: [], cl: X.cl, slant: 0.32 * f, linger: RAIN_STUCK });
  asMine(() => { // 空へ放つ矢の一斉射(当たらない。上へ飛んで消える)と、手元の光
    for (let i = 0; i < 7; i++) fire('volley', x + f * 3, y - 9, -Math.PI / 2 + f * 0.15 + (i - 3) * 0.07 + rand(-0.03, 0.03), rand(430, 520), { noHit: true, pierce: 999, life: rand(0.2, 0.28), src: 'arrowsky', r: 0, col: '#b8ffb0' });
    for (let i = 0; i < 6; i++) part(x + f * 4, y - 10, rand(-30, 30) + f * 20, -rand(200, 320), 0.3, pick(['#e4ffd8', '#b8ff9a', '#ffffff']), { glow: true, drag: 0 });
    burst(x + f * 3, y - 9, 8, ['#b8ff9a', '#e4ffd8'], { sp: 60, glow: true, life: 0.25 });
    addRing(x, y, 18, '#b8ff9a', { w: 2, life: 0.3 }); addRing(a.x, a.y, 6, '#b8ff9a', { r0: 2, life: 0.2 }); shake(2);
  });
  AudioMan.volley();
}

// グランドスラム(騎士剣の E): シールドを得る → 構え → 前方へ衝撃波が数段走る(威力は 武器の威力 + 今のシールド)
WEAPON_SKILL.longsword = {
  info(c, dmg) {
    const sk = DATA.weapons.longsword.skill, m = c.wm, one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      `使うと、シールドを最大HP の ${Math.round(sk.shield * 100)}% 得る(${sk.shieldT}秒)`,
      `構え ${sk.windup}秒 → 剣を叩きつけ、前方へ衝撃波が ${sk.steps}段 走る`,
      `1段の威力: 武器の威力 × ${Math.round(sk.pow * 100)}% + 今のシールド`,
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['段数', `${sk.steps + (m.eSteps || 0)} 段`],
      ['1段の威力(シールド 0)', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, 'シールドがあると、その値がそのまま足される'],
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
    skillCall(sk.name, '#ffe9a0'); AudioMan.click();
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
// 叩きつける: 使い手の位置から a.a の方向へ衝撃波(余震: 1.5秒後にもう一度)
function grandSlam(X, a) {
  const x0 = X.x, y0 = X.y;
  slamWaves(X, a, x0, y0, 1);
  if (X.sp('cd')) setTimeout(() => { if (state === 'play') slamWaves(X, a, x0, y0, 0.6); }, 1500); // 余震
}
// 衝撃波を段ごとに時間差で前へ走らせる(1段 = 1回の E の攻撃)
function slamWaves(X, a, x0, y0, k) {
  const sk = DATA.weapons.longsword.skill, m = P.wm.longsword || {}, n = sk.steps + (m.eSteps || 0), fly = X.sp('guard'), crack = X.sp('pow');
  for (let i = 0; i < n; i++) setTimeout(() => {
    if (state !== 'play' || !P.weapons.longsword) return; // 遅れて走る間にランが変わったとき
    const d = sk.stepD * (i + 1) * X.area, x = x0 + Math.cos(a.a) * d, y = y0 + Math.sin(a.a) * d, R = sk.waveR * X.area, el = clsNextEl();
    const dmg = (wst('longsword').dmg * sk.pow * (1 + X.lv('pow')) * a.pow + shieldTotal()) * k; // シールドはそのまま足す
    asMine(() => {
      forEachNear(x, y, R, e => {
        if (e.prop) { killEnemy(e); return; }
        hitEnemy(e, dmg, { src: 'slam', ang: a.a, kb: fly ? 220 : 70, col: '#ffe9a0', el, eHit: true, cl: X.cl });
        if (fly && !e.dead) e.stun = Math.max(e.stun || 0, 1.5); // 吹き飛ばし
      });
      addRing(x, y, R, '#ffe9a0', { w: 2, life: 0.3 }); addFlash(x, y, R * 2.4, '#fff1d0', 0.25);
      burst(x, y, 18, ['#8a7a60', '#5a4a3a', '#ffe9a0', '#ffffff'], { sp: 110, up: 50, g: 180, life: 0.6 }); // 岩の破片と土煙
      shockAt(x, y, 1, 1); shake(4 + i);
      if (crack) zones.push({ kind: 'crack', x, y, r: R, t: 0, dur: 5, tick: 0.5, dmg: wst('longsword').dmg * 0.8, cl: X.cl }); // 地割れ
    });
    AudioMan.boom();
  }, i * sk.gap * 1000);
}

// 火炎放射(ファイアーの E): 構え → 照準方向へ扇形に炎を吹き続ける(放射中も動ける)
//   ダブル放射: 反対方向にも吹く / 火炎旋風: 攻撃ごとに放射先(炎の先端)へ吸い込み
WEAPON_SKILL.fire = {
  info(c, dmg) {
    const sk = DATA.weapons.fire.skill, m = c.wm, dur = sk.dur + (m.eDur || 0), one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      `構え ${sk.windup}秒 → ${sk.dur}秒間、照準方向へ扇形に炎を吹き続ける`,
      `${sk.every}秒ごとに、範囲内の敵へ 武器の威力 × ${Math.round(sk.pow * 100)}% と炎上(武器の炎上/s × ${Math.round(sk.burn * 100)}% を 3秒)`,
      '放射中も動ける',
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['放射', `${Math.round(dur / sk.every)} 回 / ${dur.toFixed(1)} 秒`],
      ['長さ', `${Math.round(sk.len * (1 + c.cuV('e', 'len')) * (1 + c.st.v.area) * c.st.mul.area)}`],
      ['1回の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.fire || {};
    P.act = Object.assign(flameState(ME, clsESkillMul() * (1 + (m.ePow || 0))), { slot: 'e', ph: 'wind', t: 0 });
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('pFlame', MOTIONS.pFlame.duration(P.act.dur), P.act.dur);
    skillCall(sk.name, '#ff8a3d'); AudioMan.click();
  },
  // 分身など: 使い手の位置から吹く(噴き出し口の描画は返り値の flame)
  cast(X, a) {
    const o = flameState(X, a.pow), ch = { flame: null, X };
    ch.step = dt => { const done = flameStep(X, o, dt); ch.flame = o.flame; return done; };
    return ch;
  },
  // 炎の塊の移動(放射が終わっても消えるまで動かす)
  tick(dt) {
    const fp = S.flamePuffs;
    if (!fp || !fp.length) return;
    for (const f of fp) {
      f.t += dt;
      const k = Math.exp(-2.2 * dt); f.vx *= k; f.vy *= k; // 空気で減速
      f.vy -= 40 * dt * (f.t / f.life);                     // 熱で昇る
      f.x += f.vx * dt; f.y += f.vy * dt;
    }
    S.flamePuffs = fp.filter(f => f.t < f.life);
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
function flamePuffs(X, ang, L, arc, blue, dt) {
  const fp = S.flamePuffs || (S.flamePuffs = []), n = Math.round(dt * 110 * gq().parts) || 1;
  const nx = X.x + Math.cos(ang) * 9, ny = X.y - 6 + Math.sin(ang) * 6;
  for (let i = 0; i < n && fp.length < 260; i++) {
    const d = ang + rand(-arc / 2, arc / 2) * rand(0.3, 1), life = rand(0.32, 0.45), sp = L / life * rand(1.25, 1.55);
    fp.push({ x: nx + rand(-1, 1), y: ny + rand(-1, 1), vx: Math.cos(d) * sp, vy: Math.sin(d) * sp, t: 0, life, r0: rand(1, 2), r1: rand(6, 10) * X.area, blue, seed: Math.random() });
  }
  if (Math.random() < dt * 25) part(nx, ny, Math.cos(ang) * L * 2 + rand(-40, 40), Math.sin(ang) * L * 2 + rand(-40, 40), rand(0.3, 0.5), blue ? '#ffffff' : pick(['#ffc34a', '#fff6c8']), { glow: true, drag: 2 }); // 火の粉
}
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

// 刃輪展開(オービットブレードの E): 構え → dur 秒間、刃の輪が広がる(半径・刃のサイズ・回転・威力が上がる)→ 終わりに刃が外へ飛び散る
//   展開中の状態は P.bladeE(world.js のオービットブレードが読む)。P.act は構えの間だけ(展開中も動けて、Q も使える)
WEAPON_SKILL.blade = {
  info(c, dmg) {
    const sk = DATA.weapons.blade.skill, m = c.wm, pw = (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0)), one = dmg * sk.pow * pw, sc = dmg * sk.scatter * pw;
    return { name: sk.name, cat: 'e', desc: [
      `構え ${sk.windup}秒 → ${sk.dur}秒間、刃の輪が広がる(使っている間も動ける)`,
      `回転半径 ×${sk.rMul}、刃のサイズ ×${sk.size}、回転速度 ×${sk.rot}、刃の威力 ×${Math.round(sk.pow * 100)}%`,
      `終わりに刃が回転しながら外へ飛び散る(1枚ごとに 武器の威力 × ${Math.round(sk.scatter * 100)}%、貫通)`,
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['持続', `${(sk.dur + (m.eDur || 0)).toFixed(1)} 秒`],
      ['展開中の刃の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
      ['飛び散る刃の威力', `${Math.round(sc)} → <b>${Math.round(sc * c.atkMul)}</b>`],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.blade || {};
    P.act = { slot: 'e', ph: 'wind', t: 0 };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('bRing', MOTIONS.bRing.dur);
    skillCall(sk.name, '#d8e4ff'); AudioMan.click();
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
  asMine(() => { addRing(P.x, P.y, 30, col, { w: 2, life: 0.3 }); burst(P.x, P.y, 16, [col, '#ffffff'], { sp: 140, glow: true, life: 0.3 }); shake(4); });
  AudioMan.slash();
}

// スピリットストーム(スピリットウィスプの E): 構え → 自分の周りから精霊が渦を巻いて広がり、それぞれ近くの敵へ飛んで取り憑く(放った後は動ける)
//   取り憑いた精霊(P.poss): 一定時間ダメージを与え続け、宿主が倒れたら近くの敵へ乗り移り、時間が来たら宿主の中で爆ぜる
//   侵蝕: 取り憑かれた敵の被ダメージ(dmgTaken)/ 分霊: 乗り移るときに分かれる / 大精霊: P.bigWisps
WEAPON_SKILL.wisp = {
  info(c, dmg) {
    const sk = DATA.weapons.wisp.skill, m = c.wm, n = sk.n + c.cuV('e', 'n') + (m.eCount || 0), k = (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    const one = dmg * sk.pow * k, boom = dmg * sk.burstPow * k, f = v => (v < 10 ? v.toFixed(1) : Math.round(v)); // 1回の威力は小さいので 10 未満は小数1桁
    return { name: sk.name, cat: 'e', desc: [
      `構え ${sk.windup}秒 → 自分の周りから精霊 ${sk.n}体が渦を巻いて広がり、それぞれ近くの敵へ飛んで取り憑く(まだ取り憑かれていない敵を優先)`,
      `取り憑いた精霊は ${sk.possT}秒間、${sk.every}秒ごとにその敵へ 武器の威力 × ${Math.round(sk.pow * 100)}%(取り憑いた瞬間にも1回)`,
      `  → その敵が倒れると、近く(半径 ${sk.hopR})の敵へ乗り移る(残り時間はそのまま。いなければその場で爆ぜる)`,
      `  → 時間が来ると、取り憑いた敵の中で爆ぜる(武器の威力 × ${Math.round(sk.burstPow * 100)}%、半径 ${sk.burstR})`,
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['精霊の数', `<b>${n}</b> 体`],
      ['1回の威力', `${f(one)} → <b>${f(one * c.atkMul)}</b>`, `${sk.every}秒ごと・${sk.possT}秒。武器の威力 × ${Math.round(sk.pow * 100)}%。攻撃力を掛けた値`],
      ['爆ぜる威力', `${f(boom)} → <b>${f(boom * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.burstPow * 100) + '%'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.wisp || {};
    P.act = { slot: 'e', ph: 'wind', t: 0, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('nStorm', MOTIONS.nStorm.dur);
    skillCall(sk.name, '#9dffcf'); AudioMan.click();
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

// アイシクルフォール(ブリザードの E): 構え → 照準位置につららが降り続ける(放った後は動ける)
// つららそのものは zones の 'icicle'(world.js の updZones で落とす)
WEAPON_SKILL.blizzard = {
  info(c, dmg) {
    const sk = DATA.weapons.blizzard.skill, m = c.wm, n = sk.n + c.cuV('e', 'n') + (m.eCount || 0), one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      `構え ${sk.windup}秒 → 照準位置(半径 ${sk.radius})に、${sk.dur}秒かけてつららが降る`,
      `つららは範囲内の敵を狙って落ちる(いなければランダムな位置)`,
      `つらら1本: 半径 ${sk.iceR} に 武器の威力 × ${Math.round(sk.pow * 100)}% と凍傷 +${sk.frost}`,
      '放った後は自由に動ける(つららはその場に降り続ける)',
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['つらら', `${Math.round(n * (c.hasSp('e', 'cd') ? sk.rainK : 1))} 本 / ${sk.dur} 秒`],
      ['1本の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.blizzard || {}, t = ME.tgt(sk.range * P.range);
    if (t.x !== P.x) P.facing = t.x < P.x ? -1 : 1;
    P.act = { slot: 'e', ph: 'wind', t: 0, x: t.x, y: t.y, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('cIcicle', MOTIONS.cIcicle.dur);
    skillCall(sk.name, '#bff4ff'); AudioMan.click();
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
  AudioMan.blizz();
}

// グラビティスパーク(サンダーの E): 構え → 照準位置に雷の球。周りの敵を1回大きく引き寄せて爆発(zones の 'gspark')
WEAPON_SKILL.thunder = {
  info(c, dmg) {
    const sk = DATA.weapons.thunder.skill, m = c.wm, one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0)), ar = (1 + c.cuV('e', 'area')) * (1 + c.st.v.area) * c.st.mul.area;
    return { name: sk.name, cat: 'e', desc: [
      `構え ${sk.windup}秒 → 照準位置に雷の球を放つ`,
      `周りの敵を中心へ1回だけ大きく引き寄せ(ボス以外)、直後に爆発(武器の威力 × ${Math.round(sk.pow * 100)}%、感電 ${Math.round(sk.shock * 100)}%)`,
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['引き寄せ / 爆発の半径', `${Math.round(sk.pullR * ar * (1 + (m.eArea || 0)))} / ${Math.round(sk.boomR * ar)}`],
      ['爆発の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.thunder || {}, t = ME.tgt(sk.range * P.range);
    if (t.x !== P.x) P.facing = t.x < P.x ? -1 : 1;
    P.act = { slot: 'e', ph: 'wind', t: 0, x: t.x, y: t.y, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('eSpark', MOTIONS.eSpark.dur);
    skillCall(sk.name, '#9fd8ff'); AudioMan.click();
  },
  update(a, dt) {
    const sk = weaponSkill();
    P.moveMul = 0;
    if (a.t < sk.windup) { // 杖の先に雷の球が膨らむ
      if (Math.random() < dt * 40) part(P.x + P.facing * 10 + rand(-5, 5), P.y - 8 + rand(-5, 5), rand(-20, 20), rand(-20, 20), 0.2, pick(['#9fd8ff', '#fff27a', '#ffffff']), { glow: true });
      return;
    }
    gravitySpark(ME, a.x, a.y, a.pow, 1, hasSp('e', 'area'));
    P.act = null;
  },
  cast(X, a) {
    const t = X.tgt(DATA.weapons.thunder.skill.range * X.range);
    gravitySpark(X, t.x, t.y, a.pow, 1, X.sp('area'));
    return null;
  },
};
// グラビティスパークの球を置く(k: 威力の倍率。again: 二重重力でもう一度)
function gravitySpark(X, x, y, pow, k, again) {
  const sk = DATA.weapons.thunder.skill, m = P.wm.thunder || {}, ar = (1 + X.lv('area')) * X.area;
  zones.push({ kind: 'gspark', x, y, r: sk.pullR * ar * (1 + (m.eArea || 0)), boomR: sk.boomR * ar, t: 0, tick: 0, pulled: false, boomed: false,
    dur: X.sp('cd') ? sk.boomT + sk.fieldT : sk.boomT + 0.15, dmg: wst('thunder').dmg * sk.pow * (1 + X.lv('pow')) * pow * k, field: X.sp('cd'), stun: X.sp('pow'), cl: X.cl });
  if (again) setTimeout(() => { if (state === 'play' && P.weapons.thunder) gravitySpark(X, x, y, pow, sk.againK, false); }, sk.againT * 1000); // 二重重力
  AudioMan.zap();
}

// ホーリーストライク(ホーリーオーラの E): ランダムな敵の位置に光の柱が順に落ちる(予備動作なし・動ける)。1回ごとに回復
WEAPON_SKILL.aura = {
  info(c) {
    const sk = DATA.weapons.aura.skill, m = c.wm, n = sk.n + (c.hasSp('e', 'cd') ? sk.more : 0) + (m.eCount || 0), k = (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    const hp = c.st.v.hp * c.st.mul.hp, one = (sk.pow + hp * sk.hpPow) * k;
    return { name: sk.name, cat: 'e', desc: [
      `ランダムな敵の位置 ${sk.n}か所に、${sk.gap}秒おきに光の柱が落ちる(動ける)`,
      `1回: 半径 ${sk.r} に 基礎威力 ${sk.pow} + 最大HP の ${Math.round(sk.hpPow * 100)}%`,
      `1回ごとに HP を最大HP の ${Math.round(c.cuV('e', 'heal', sk.heal) * 100)}% 回復`,
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['光の柱', `${n} 本`],
      ['1回の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '基礎威力 + 最大HP 比。攻撃力を掛けた値'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.aura || {};
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('hStrike', MOTIONS.hStrike.dur); P.anim.keep = true;
    skillCall(sk.name, '#ffe38a'); AudioMan.click();
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

// ディメンション・リフト(ブラックホールの E): 構え → 画面全体を異次元に沈める(P.rift。放った後は動ける)
//   every 秒ごとに画面内の全ての敵(ボスも)へ。敵が多いので当たり方は静か(音・光なし。数字はクリティカルだけ)
WEAPON_SKILL.bhole = {
  info(c, dmg) {
    const sk = DATA.weapons.bhole.skill, m = c.wm, dur = sk.dur + c.cuV('e', 'dur') + (m.eDur || 0), one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    const n = Math.floor(dur / sk.every + 1e-6), f = v => (v < 10 ? v.toFixed(1) : Math.round(v)); // 1回の威力は小さいので 10 未満は小数1桁
    return { name: sk.name, cat: 'e', desc: [
      `構え ${sk.windup}秒 → ${sk.dur}秒間、画面全体を異次元に沈める(放った後は動ける)`,
      `異次元の間、${sk.every}秒ごとに 画面内の全ての敵(ボスも)へ 武器の威力 × ${Math.round(sk.pow * 100)}%`,
      '距離に関係なく当たる(範囲のステータスは効かない)。効果中に画面へ入ってきた敵にも当たる',
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['回数', `${n} 回 / ${dur.toFixed(1)} 秒`],
      ['1回の威力', `${f(one)} → <b>${f(one * c.atkMul)}</b>`, `武器の威力 × ${Math.round(sk.pow * 100)}%。攻撃力を掛けた値`],
      ['1体あたりの合計', `${f(one * n)} → <b>${f(one * n * c.atkMul)}</b>`, 'ずっと画面内にいた敵'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.bhole || {};
    P.act = { slot: 'e', ph: 'wind', t: 0, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('gRift', MOTIONS.gRift.dur);
    skillCall(sk.name, '#c78bff'); AudioMan.click();
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
  asMine(() => { shake(4); hitstop(0.04); });
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
        if (marks) { const a = rand(0, Math.PI), L = (e.r || 4) + 2; slashes.push({ mark: true, x: e.x - Math.cos(a) * L, y: e.y - 2 - Math.sin(a) * L, x1: e.x + Math.cos(a) * L, y1: e.y - 2 + Math.sin(a) * L, t: 0, life: 0.22, col: '#6a1a58', core: '#ff7ad9' }); } // 体に細い裂け目が一瞬走る
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
  S.totalDmg += left; S.dmgBy.rift = (S.dmgBy.rift || 0) + left;
  e.hp = 0;
  asMine(() => {
    addRing(e.x, e.y, 1, '#ff7ad9', { r0: (e.r || 4) + 8, life: 0.25 });
    for (let i = 0; i < 8; i++) { const a = rand(0, TAU), d = rand(6, 14); part(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, -Math.cos(a) * d * 5, -Math.sin(a) * d * 5, 0.2, pick(RIFT_FX), { glow: i % 3 === 0, drag: 0 }); }
    if (e.boss || e.elite) { addFlash(e.x, e.y, 70, '#5a1450', 0.35); shockAt(e.x, e.y, 1.2, 0.8); shake(5); }
  });
  if (e.boss) UI.announce('異次元送り', '');
  killEnemy(e, { src: 'rift', cl });
}
// 次元断層: 最後に画面全体が一度に裂ける(画面を横切る裂け目)
function riftFault(r) {
  const sk = DATA.weapons.bhole.skill, dmg = wst('bhole').dmg * sk.faultPow * riftPow(r) * r.pow, el = clsNextEl();
  asMine(() => {
    for (const e of riftTargets()) hitEnemy(e, dmg, { src: 'rift', eHit: true, el, quiet: true, noNum: Math.random() < 0.6, col: '#c78bff', cl: r.cl });
    for (let i = 0; i < 4; i++) {
      const a = rand(-0.5, 0.5) + (i % 2 ? Math.PI / 2 : 0), cx = cam.x + GFX.VW * rand(0.25, 0.75), cy = cam.y + GFX.VH * rand(0.25, 0.75), L = Math.hypot(GFX.VW, GFX.VH) * 0.6;
      slashes.push({ line: true, x: cx - Math.cos(a) * L, y: cy - Math.sin(a) * L, x1: cx + Math.cos(a) * L, y1: cy + Math.sin(a) * L, t: 0, life: 0.4, w: 3, col: '#6a1a58', core: '#ff7ad9' });
    }
    shake(9); hitstop(0.06);
    screenFlash(0.15 * SET.fxA, '#3a0a30');
  });
  GFX.fx.aberr = Math.max(GFX.fx.aberr, 1 * SET.fxA);
  AudioMan.cut(); AudioMan.boom();
}

// ワイルドトマホーク(スローイングアックスの E): HP を払う → 構え → 照準方向(照準がなければ一番近い敵)へ大きな斧を投げる(放った後は動ける)
//   代償: 使った瞬間に 最大HP × hpCost を受け(selfHurt)、実際に払った HP × hpK を今回の 1回ごとの威力に足す(跳ね返り・戻り。地割れには足さない)
//   斧は projs の 'toma'。共通の当たり判定は使わず、WEAPON_SKILL.axe.tick(tomaStep)で動かす
//   out: 真っすぐ(狙う敵がいれば曲がりながら)飛んで、最初に触れた敵に当たる / hop: 次の敵へ飛ぶ(狙った敵にだけ当たる) / back: 回りながら戻る(触れた敵に1回ずつ)
WEAPON_SKILL.axe = {
  info(c, dmg) {
    const sk = DATA.weapons.axe.skill, m = c.wm, k = (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0)), n = sk.bounces + c.cuV('e', 'jump') + (m.eBounce || 0);
    const hp = c.run ? P.maxhp : c.st.v.hp * c.st.mul.hp, paid = Math.round(hp * sk.hpCost), add = paid * sk.hpK; // 代償(最大HP のとき。HP が少ないと払える分だけ)
    const inc = c.hasSp('e', 'jump') ? sk.incSp : sk.inc, first = dmg * sk.pow * k + add, last = dmg * (sk.pow + inc * n) * k + add, back = dmg * sk.backPow * k + add;
    return { name: sk.name, cat: 'e', desc: [
      `使った瞬間に 最大HP の ${Math.round(sk.hpCost * 100)}% のダメージを受ける(防御力・シールドでは減らない。自分の技では倒れない)`,
      `  → 今回の攻撃 1回ごとの威力に、払った HP × ${sk.hpK} を足す`,
      `構え ${sk.windup}秒 → 照準方向(照準がなければ一番近い敵)へ、大きな斧(通常の斧の ${sk.big}倍の大きさ)を投げる`,
      `敵に当たると、近く(半径 ${sk.hopR})のまだ当たっていない敵へ跳ね返る(最大 ${sk.bounces}回)`,
      `1回の威力: 武器の威力 × ${Math.round(sk.pow * 100)}%、跳ねるたびに +${Math.round(sk.inc * 100)}%`,
      `跳ね終わると、回りながら自分のところへ戻ってくる(戻る途中も当たる。武器の威力 × ${Math.round(sk.backPow * 100)}%)`,
      '放った後は自由に動ける',
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['代償', `HP <b>${paid}</b>`, `最大HP の ${Math.round(sk.hpCost * 100)}%。1回ごとの威力 +${add}`],
      ['跳ねる回数', `<b>${n}</b> 回(${n + 1}回 当たる)`],
      ['1回目の威力', `${Math.round(first)} → <b>${Math.round(first * c.atkMul)}</b>`, `武器の威力 × ${Math.round(sk.pow * 100)}% + 払った HP × ${sk.hpK}。攻撃力を掛けた値`],
      [`${n + 1}回目の威力`, `${Math.round(last)} → <b>${Math.round(last * c.atkMul)}</b>`, `跳ねるたびに +${Math.round(inc * 100)}%`],
      ['戻りの威力', `${Math.round(back)} → <b>${Math.round(back * c.atkMul)}</b>`],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.axe || {}, a = aimDir(sk.reach * P.range);
    if (Math.cos(a) !== 0) P.facing = Math.cos(a) < 0 ? -1 : 1;
    const paid = selfHurt(P.maxhp * sk.hpCost); // 代償: 払った HP × hpK を今回の 1回ごとの威力に足す
    P.act = { slot: 'e', ph: 'wind', t: 0, pow: clsESkillMul() * (1 + (m.ePow || 0)), add: paid * sk.hpK };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('zThrow', MOTIONS.zThrow.dur);
    skillCall(sk.name, '#ffb070'); AudioMan.click();
  },
  update(a, dt) {
    const sk = weaponSkill();
    P.moveMul = 0;
    if (a.t < sk.windup) { // 構え: 振りかぶった斧の刃先に火花が散る
      const hx = P.x - P.facing * 5, hy = P.y - 17;
      asMine(() => { if (Math.random() < dt * 30) part(hx + rand(-3, 3), hy + rand(-3, 3), rand(-20, 20), -rand(10, 30), 0.25, pick(['#ffb070', '#fff1d0', '#8a5a2a']), { glow: Math.random() < 0.4, drag: 2 }); });
      return;
    }
    tomaThrow(ME, a);
    P.act = null;
  },
  // 分身など: 代償(HP)は払わない。斧は使い手の手元へ戻る
  cast(X, a) { tomaThrow(X, { pow: a.pow, add: 0 }); return null; },
  tick(dt) { tomaStep(dt); },
};
const TOMA_TRAIL = ['#e07a3a', '#a8401c', '#5a1a0c']; // 斧の軌跡(赤橙 → 暗い赤。明るい赤は敵の攻撃の色なので使わない)
// 投げる: 大きな斧を 1本(双斧は 2本、左右に開いて)。照準がないときは一番近い敵を狙って曲がりながら飛ぶ
//   斧は使い手 X を持つ(暴れ斧・地割れ・範囲・戻る先は X から読む)
function tomaThrow(X, a) {
  const sk = DATA.weapons.axe.skill, st = wst('axe'), m = P.wm.axe || {}, reach = sk.reach * X.range;
  const ang = X.aim(reach), tg = mouseAimPt() ? null : nearestEnemy(X.x, X.y, reach);
  const sz = (st.size || 1) * sk.big, max = sk.bounces + X.lv('jump') + (m.eBounce || 0), inc = X.sp('jump') ? sk.incSp : sk.inc, pw = (1 + X.lv('pow')) * a.pow;
  const hx = X.x + Math.cos(ang) * 6, hy = X.y - 8;
  for (const d of X.sp('cd') ? [ang - sk.twinA, ang + sk.twinA] : [ang]) { // 双斧
    projs.push({ kind: 'toma', x: hx, y: hy, vx: 0, vy: 0, ang: 0, spin: (Math.cos(d) < 0 ? -1 : 1) * 24, t: 0, life: 99, r: 5 * sz, sz, noHit: true, hit: new Set(), backHit: new Set(), src: 'toma',
      ph: 'out', dir: d, sp: sk.speed, dist: 0, reach, tg, n: 0, max, inc, pw, add: a.add || 0, armT: 0, trail: [], X });
  }
  asMine(() => { burst(hx, hy, 10, ['#ffb070', '#fff1d0', '#8a5a2a'], { sp: 90, glow: true, life: 0.3 }); shake(3); });
  AudioMan.dash(); AudioMan.slash();
}
// 毎フレーム: 斧を動かす(out → hop → back)。軌跡は直近 8点
function tomaStep(dt) {
  for (const p of projs) {
    if (p.kind !== 'toma' || p.t >= p.life) continue;
    p.trail.push(p.x, p.y); if (p.trail.length > 16) p.trail.splice(0, 2);
    if (p.ph === 'back') { tomaBack(p, dt); continue; }
    if (p.armT > 0) { // 跳ね返った直後: 少しだけ弾かれた向きへ飛んでから次の敵を追う
      p.armT -= dt;
      p.x += Math.cos(p.dir) * p.sp * dt; p.y += Math.sin(p.dir) * p.sp * dt;
      continue;
    }
    if (p.ph === 'out') {
      if (p.tg && !p.tg.dead) { // 狙う敵へ曲がりながら(双斧は左右から回り込む)
        const want = Math.atan2(p.tg.y - p.y, p.tg.x - p.x);
        p.dir += clamp(Math.atan2(Math.sin(want - p.dir), Math.cos(want - p.dir)), -7 * dt, 7 * dt);
      }
      const step = p.sp * dt;
      p.x += Math.cos(p.dir) * step; p.y += Math.sin(p.dir) * step; p.dist += step;
      let first = null;
      forEachNear(p.x, p.y, p.r, e => {
        if (e.dead || e.hidden) return;
        if (e.prop) { killEnemy(e); return; }
        first = e; return false;
      });
      if (first) tomaHit(p, first); else if (p.dist >= p.reach) tomaReturn(p);
      continue;
    }
    // hop: 狙った敵へまっすぐ。途中の敵は素通り(跳ねた回数 = 当たった回数 - 1 がずれないように)
    if (!p.tg || p.tg.dead) { p.tg = tomaNext(p, p.x, p.y, null); if (!p.tg) { tomaReturn(p); continue; } }
    const dx = p.tg.x - p.x, dy = p.tg.y - p.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, p.sp * dt / d);
    p.dir = Math.atan2(dy, dx); p.x += dx * k; p.y += dy * k;
    if (Math.hypot(p.tg.x - p.x, p.tg.y - p.y) <= p.r + (p.tg.r || 4)) tomaHit(p, p.tg);
  }
}
// 1回の命中: 武器の威力 × (pow + inc × 跳ねた回数) + 代償の上乗せ。地割れ / 次の敵へ跳ね返る(いなければ戻る)
function tomaHit(p, e) {
  const sk = DATA.weapons.axe.skill, x = e.x, y = e.y, dmg = wst('axe').dmg * (sk.pow + p.inc * p.n) * p.pw + p.add;
  p.hit.add(e.id); p.n++;
  asMine(() => {
    hitEnemy(e, dmg, { src: 'toma', ang: p.dir, kb: 70, col: '#ffb070', eHit: true, el: clsNextEl(), cl: p.X.cl });
    burst(x, y - 2, 10, ['#fff1d0', '#ffb070', '#a8401c'], { sp: 110, glow: true, life: 0.3 }); // 当たるたびに火花
    addRing(x, y, (e.r || 4) + 5, '#a8401c', { life: 0.18 });
    shake(1.5 + Math.min(3, p.n * 0.4));
    if (p.X.sp('pow')) tomaCrack(p.X, x, y, p.pw); // 地割れ
  });
  AudioMan.thud();
  if (p.n > p.max) { tomaReturn(p); return; } // 跳ね終わり(当たった回数 = 跳ねる回数 + 1)
  const nx = tomaNext(p, x, y, e);
  if (!nx) { tomaReturn(p); return; }
  p.ph = 'hop'; p.tg = nx;
  if (nx === e) { p.dir = Math.atan2(p.y - y, p.x - x) + rand(-0.6, 0.6); p.armT = 0.14; } // 同じ敵へは一度弾かれてから戻る(暴れ斧)
  else { p.dir = Math.atan2(nx.y - p.y, nx.x - p.x); p.armT = 0.04; }
}
// 次に跳ねる敵: 近く(半径 hopR)の、まだ当たっていない一番近い敵(ほかの斧が狙っている敵は後回し)
//   暴れ斧: 当たった敵も選べる。ボス → エリート → まだ当たっていない敵 → 当たった敵 の順(同じ順位なら近い敵)
//     ボス・エリートは今当たった敵でもまた選ぶ(一度弾かれてから戻る)。ふつうの敵は、ほかに誰もいないときだけ同じ敵へ
function tomaNext(p, x, y, cur) {
  const R = DATA.weapons.axe.skill.hopR * p.X.area, wild = p.X.sp('jump'), taken = new Set();
  for (const q of projs) if (q !== p && q.kind === 'toma' && q.tg) taken.add(q.tg);
  let best = null, bd = Infinity;
  forEachNear(x, y, R, e => {
    if (e.dead || e.prop || e.hidden) return;
    const was = p.hit.has(e.id), rank = !wild ? 0 : e.boss ? 0 : e.elite ? 1 : was ? 3 : 2;
    if (!wild && (was || e === cur)) return;
    if (wild && e === cur && rank > 1) return;
    const d = rank * 1e8 + (taken.has(e) ? 1e6 : 0) + d2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  });
  return best || (wild && cur && !cur.dead ? cur : null);
}
function tomaReturn(p) { p.ph = 'back'; p.tg = null; p.armT = 0; p.sp = DATA.weapons.axe.skill.speed * 0.5; }
// 戻る: 回りながら使い手の手元へ(だんだん速く)。途中で触れた敵に1回ずつ(武器の威力 × backPow)。手元に届いたら消える
function tomaBack(p, dt) {
  const sk = DATA.weapons.axe.skill, X = p.X, dx = X.x - p.x, dy = X.y - 8 - p.y, d = Math.hypot(dx, dy) || 1;
  p.sp = Math.min(sk.speed * 1.5, p.sp + sk.speed * 2 * dt);
  const step = p.sp * dt;
  if (d <= step + 4 || p.t > 8) { tomaCatch(p); return; }
  p.dir = Math.atan2(dy, dx); p.x += dx / d * step; p.y += dy / d * step;
  const dmg = wst('axe').dmg * sk.backPow * p.pw + p.add; // 代償の上乗せは戻りにも
  asMine(() => forEachNear(p.x, p.y, p.r, e => {
    if (e.dead || p.backHit.has(e.id)) return;
    if (e.prop) { killEnemy(e); return; }
    p.backHit.add(e.id);
    hitEnemy(e, dmg, { src: 'toma', ang: p.dir, kb: 40, col: '#ffb070', eHit: true, el: clsNextEl(), noNum: Math.random() < 0.3, cl: X.cl });
  }));
}
// 手元に収まる
function tomaCatch(p) {
  p.t = p.life; // updProjs が消す
  const X = p.X;
  asMine(() => burst(X.x + X.face * 4, X.y - 8, 8, ['#ffb070', '#fff1d0'], { sp: 50, glow: true, life: 0.25 }));
  AudioMan.click();
}
// 地割れ: 跳ねた場所の地面が割れ、周り(半径 crackR)へ 武器の威力 × crackPow。放射状のひびと、岩の破片・土煙
function tomaCrack(X, x, y, pw) {
  const sk = DATA.weapons.axe.skill, R = sk.crackR * X.area, dmg = wst('axe').dmg * sk.crackPow * pw;
  forEachNear(x, y, R, e => {
    if (e.prop) { killEnemy(e); return; }
    hitEnemy(e, dmg, { src: 'toma', ang: Math.atan2(e.y - y, e.x - x), kb: 25, col: '#a08060', eHit: true, noNum: Math.random() < 0.5, cl: X.cl });
  });
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 + rand(-0.4, 0.4), L = R * rand(0.6, 1.05);
    slashes.push({ mark: true, x, y: y + 2, x1: x + Math.cos(a) * L, y1: y + 2 + Math.sin(a) * L * 0.6, t: 0, life: 0.5, core: '#140806', col: '#7a2a10' });
  }
  burst(x, y + 2, 12, ['#8a7a60', '#5a4a3a', '#3a2a20'], { sp: 80, up: 40, g: 200, life: 0.5 });
  addRing(x, y + 2, R, '#6a3a1a', { w: 2, life: 0.3 });
}
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
      if (mark && !e.dead) { e.stigmaT = S.time + sk.stigmaT; S.stigmaUntil = Math.max(S.stigmaUntil || 0, e.stigmaT); } // 聖痕
    });
    zones.push({ kind: 'pillar', x, y, r: R, t: 0, dur: 0.45, tick: 0 });
    if (X.sp('heal')) zones.push({ kind: 'lightrain', x, y, r: R, t: 0, dur: sk.rainT, tick: 0 }); // 光の雨
    addFlash(x, y, R * 2.4, '#fff6d8', 0.3); addRing(x, y, R, '#ffe38a', { w: 2, life: 0.35 });
    burst(x, y, 18, ['#ffe38a', '#fff6d8', '#ffffff'], { sp: 90, up: 40, glow: true, life: 0.45 }); shake(2);
  });
  heal(P.maxhp * X.lv('heal', sk.heal));
  AudioMan.zap();
}

function ranbuHit(X, a) {
  const sk = DATA.weapons.katana.skill, R = sk.radius * X.area, dmg = wst('katana').dmg * sk.pow * (1 + X.lv('pow')) * a.pow, k0 = S.kills, el = clsNextEl(); // 1回の斬撃 = 1属性
  const x = X.x, y = X.y;
  asMine(() => {
    forEachNear(x, y, R, e => { if (!e.prop) hitEnemy(e, dmg, { src: 'ranbu', ang: Math.atan2(e.y - y, e.x - x), kb: 25, col: '#ffb7d5', noNum: Math.random() < 0.4, el, eHit: true, cl: X.cl }); });
    slashes.push({ x, y, follow: X, a: rand(0, TAU), r: R, t: 0, life: 0.18, flip: Math.random() < 0.5, span: 1.9, pal: SWING_PAL.ranbu }); // 外縁 = 乱れ桜の範囲(全周に当たる。向きはばらばら)
    burst(x + rand(-R, R) * 0.6, y + rand(-R, R) * 0.6, 6, ['#ffb7d5', '#ffffff'], { sp: 70, glow: true, life: 0.3 });
    shake(1.5);
  });
  AudioMan.slash();
  if (X.sp('cd')) X.cdCut(S.kills - k0); // 剣の舞: 撃破1体ごとに CD -1秒
}
// 乱れ桜の演出: 範囲のあちこち(敵がいればその上)で、2点の間を数フレームかけて刻む、流れるような桜色の斬撃(ダメージは ranbuHit)
//   切っ先が少し反った弧を描いて走り、少し遅れて尾がついていく(描画は render.js の drawFlow)
//   配色は彩度の高い濃い桜色(淡い桃色はライト・発光・ブルームが重なると白に飛ぶ)
const RANBU_PAL = { mid: '#a8185a', bright: '#e8357f', glow: '#b8205e' };
function ranbuCut(X) {
  const R = DATA.weapons.katana.skill.radius * X.area, r = Math.sqrt(Math.random()) * R * 0.8, ang = rand(0, TAU);
  let cx = X.x + Math.cos(ang) * r, cy = X.y + Math.sin(ang) * r;
  const tg = Math.random() < 0.6 ? nearestEnemy(cx, cy, 22) : null;
  if (tg) { cx = tg.x; cy = tg.y; }
  const a = rand(0, TAU), ca = Math.cos(a), sa = Math.sin(a), L = rand(16, 30) * X.area, run = rand(0.07, 0.11); // run: 切っ先が走る時間(4〜7フレーム)
  const s = { flow: true, a, x0: cx - ca * L, y0: cy - sa * L, x1: cx + ca * L, y1: cy + sa * L, nx: -sa, ny: ca, bulge: L * 2 * rand(0.1, 0.22) * (Math.random() < 0.5 ? -1 : 1),
    len: L * 2, t: 0, run, lag: run * 0.55, fade: 0.1, life: run * 1.55 + 0.1, w: rand(1.6, 2.4), pal: RANBU_PAL };
  s.ev = [{ at: run, fn: () => asMine(() => { // 走り抜けた先に花びら
    for (let i = 0; i < 2; i++) part(s.x1, s.y1, ca * rand(20, 80) + rand(-20, 20), sa * rand(20, 80) + rand(-20, 20), rand(0.3, 0.6), pick(['#ffb7d5', '#ff8ac0', '#ffffff']), { glow: true, drag: 3 });
  }) }];
  slashes.push(s);
}
function sakuraBurst(X, a) {
  const sk = DATA.weapons.katana.skill, R = sk.burstR * X.area, dmg = wst('katana').dmg * sk.burst * (1 + X.lv('pow')) * a.pow, x = X.x, y = X.y;
  asMine(() => {
    forEachNear(x, y, R, e => { if (!e.prop) hitEnemy(e, dmg, { src: 'ranbu', ang: Math.atan2(e.y - y, e.x - x), kb: 120, col: '#ff8ac0', eHit: true, cl: X.cl }); });
    addRing(x, y, R, '#ffb7d5', { w: 3, life: 0.5 }); addRing(x, y, R * 0.6, '#ffffff', { w: 2, life: 0.35 });
    addFlash(x, y, R * 2, '#ffb7d5', 0.5); shockAt(x, y, 1.6, 0.9);
    burst(x, y, 70, ['#ffb7d5', '#ff8ac0', '#ffffff'], { sp: 170, glow: true, life: 0.8, drag: 1.5 });
    hitstop(0.06); shake(8); screenFlash(0.3 * SET.fxA, '#ffb7d5');
  });
  AudioMan.boom();
}

// 残心の攻撃力: 気迫の値(未取得なら基本値)+ クラスLv8
const zanshinAtk = () => cuV('passive', 'kihaku', DATA.classes.samurai.params.zanshinAtk) + (P.lvFx.zanshinAtk || 0);

// ---------- クラスごとの実装 ----------
const CLASS_RT = {
  samurai: {
    skills: ['q'], // 実装済みのクラススキル(強化ツリーの need と対応)
    init() {
      const c = DATA.classes.samurai.params;
      P.ki = 0; P.kiMax = c.kiMax; P.kiWin = 0; P.kiWinT = 0;
      P.guard = false; P.guardT = 0; P.breakT = 0; P.zanshinT = 0;
    },
    update(dt) {
      const c = DATA.classes.samurai.params;
      P.kiWinT -= dt; if (P.kiWinT <= 0) P.kiWin = 0;
      P.zanshinT -= dt; P.breakT -= dt;
      P.kiMax = c.kiMax + cuV('trait', 'zan'); // 残気: 最大値アップ
      P.atkSpd = hasSp('trait', 'juu') && kiHigh() ? 1.25 : 1; // 明鏡止水: 剣気100以上の間 攻撃速度 +25%
      // 見切り(Space 長押しでガード)。構えた瞬間にスタミナ guardCost を消費する(連打でジャストを狙いやすくしないため)
      // 押し直すまで再び構えない / スタミナ不足・ガードブレイク中・スキル中は構えられない
      const held = (keys.Space || keys.TouchDef) && !P.act;
      if (held && !P.guard && !P.guardHeld && P.breakT <= 0) {
        if (P.sta >= c.guardCost) { staUse(c.guardCost); P.guard = true; P.guardT = 0; AudioMan.click(); }
        else { addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
      }
      P.guardHeld = held;
      if (!held && P.guard) P.guard = false;
      if (P.guard) P.guardT += dt;
      // 身軽: 残心中の移動速度アップ(背水で2倍)
      P.moveMul = (P.guard ? c.guardSlow : 1) * (P.zanshinT > 0 ? 1 + cuV('passive', 'migaru') * zanshinK() : 1);
    },
    // 被弾: ガード中ならスタミナで受ける。受けきれた場合は null(HPは減らない)
    onHurt(dmg) {
      const c = DATA.classes.samurai.params;
      if (P.breakT > 0) return dmg * (1 + c.breakDmg);
      if (!P.guard) {
        let k = 1;
        if (hasSp('trait', 'juu') && kiHigh()) k *= 0.7;  // 明鏡止水
        if (hasSp('passive', 'migaru') && P.zanshinT > 0) k *= 0.75; // 不動
        return dmg * k;
      }
      P.zanshinT = c.zanshinT + cuV('passive', 'jizoku'); // 残心: 防御スキルで攻撃を受けた後、攻撃力アップ
      if (P.guardT <= c.parryWin + (P.lvFx.parryWin || 0)) { samuraiParry(); return null; }
      staUse(Math.max(1, Math.round((dmg - P.armor) * (1 - P.dr))), DATA.player.staLock); // 受けるはずだったダメージ分
      burst(P.x, P.y - 4, 8, ['#9ff7ff', '#ffffff'], { sp: 60, glow: true, life: 0.25 });
      AudioMan.hit(); shake(2);
      if (P.sta <= 0) { // ガードブレイク
        P.guard = false; P.breakT = c.breakT;
        UI.announce('GUARD BREAK', ''); AudioMan.hurt(); shake(6);
        addRing(P.x, P.y, 26, '#ff3b5c', { w: 2, life: 0.4 });
      }
      P.ifr = P.iframe * 0.5;
      return null;
    },
    // 通常攻撃(メイン武器)が命中: 1体につき剣気 +kiHit(1回の攻撃 = 0.15 秒以内の獲得は kiHitCap まで)
    onMainHit() {
      const c = DATA.classes.samurai.params;
      if (P.kiWinT <= 0) { P.kiWinT = 0.15; P.kiWin = 0; }
      if (P.kiWin >= c.kiHitCap) return;
      P.kiWin += c.kiHit; kiAdd(c.kiHit);
    },
    onKill() {
      if (hasSp('passive', 'jizoku') && P.zanshinT > 0) P.zanshinT = DATA.classes.samurai.params.zanshinT + cuV('passive', 'jizoku'); // 常在戦場
    },
    // 無尽: E スキルでも剣気を全て消費し、剣気 × 0.5% だけ威力アップ
    eMul() {
      if (!hasSp('trait', 'ren') || P.ki <= 0) return 1;
      const k = 1 + P.ki * 0.005;
      addFloat(P.x, P.y - 34, `剣気 ${Math.floor(P.ki)} 解放`, '#ff5d73', 1, -20);
      P.ki = 0;
      return k;
    },
    atkBonus() {
      const c = DATA.classes.samurai.params;
      return (kiHigh() ? cuV('trait', 'juu', c.kiFullAtk) : 0) + (P.zanshinT > 0 ? zanshinAtk() * zanshinK() : 0);
    },
    // 居合・朧月(Q): 構え → 突進して通過した敵を斬る。剣気を全て消費し、消費量で威力が上がる
    qStart() {
      const q = DATA.classes.samurai.q, a = aimDir(q.dist * 1.6);
      const D = q.dist * (1 + cuV('q', 'reach')), full = kiHigh();
      // 一閃(演出): 構えの間に周りが暗くなり刃筋が点線で走る → 突進と同時に切っ先が走る → 遅れて炸裂(world.js の makeCut)
      const cut = makeCut(P.x, P.y, P.x + Math.cos(a) * D, P.y + Math.sin(a) * D, { omen: q.windup, run: q.windup + q.dash, hit: q.windup + q.dash + 0.08, life: 0.9, wk: full ? 1.2 : 0.85, late: true });
      cut.ev.push({ at: q.windup, fn: () => { AudioMan.cut(); GFX.fx.aberr = Math.max(GFX.fx.aberr, (full ? 1 : 0.7) * SET.fxA); } }, { at: q.windup + q.dash, fn: () => cutSpark(cut, full ? 26 : 16) });
      P.act = { slot: 'q', ph: 'wind', t: 0, a, ki: P.ki, x0: P.x, y0: P.y, hits: new Set(), back: false, cut };
      AudioMan.cutDraw();
      if (Math.cos(a) !== 0) P.facing = Math.cos(a) < 0 ? -1 : 1;
      playAnim('iai', MOTIONS.iai.dur);
      slowmo(0.35, 0.22);
      skillCall(q.name, '#ff5d73'); AudioMan.click();
      if (kiHigh()) { addRing(P.x, P.y, 22, '#ff3b5c', { w: 2, life: 0.35 }); burst(P.x, P.y, 20, ['#ff3b5c', '#ffd0d8'], { sp: 50, up: 20, glow: true }); }
    },
    qUpdate(a, dt) {
      const q = DATA.classes.samurai.q, reach = 1 + cuV('q', 'reach');
      P.moveMul = 0;
      if (a.ph === 'wind') {
        if (a.t < q.windup) return;
        // 抜刀: 剣気を全て消費して突進
        a.ph = 'dash'; a.t0 = a.t; a.ki = P.ki; P.ki = 0;
        P.invT = Math.max(P.invT, q.dash + 0.15);
        if (hasSp('q', 'reach')) S.decoy = { x: P.x, y: P.y, t: 2 }; // 空蝉: 開始地点に分身
        AudioMan.dash(); shake(2);
        return;
      }
      if (a.ph === 'dash') {
        const sp = q.dist * reach / q.dash, dir = a.back ? a.a + Math.PI : a.a;
        P.x += Math.cos(dir) * sp * dt; P.y += Math.sin(dir) * sp * dt;
        forEachNear(P.x, P.y, q.width * reach, e => { if (!e.prop && !e.dead) a.hits.add(e); });
        const la = P.after && P.after[P.after.length - 1]; // 残像は 6 ドットごとに残す(重なって白い塊にならないように)
        if (!la || d2(la.x, la.y, P.x, P.y) > 36) P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0, f: P.facing }]).slice(-6);
        if (a.t - a.t0 < q.dash) return;
        iaiStrike(a);
        if (hasSp('q', 'cd') && !a.back) { // 燕返し: 元の位置へ戻りながらもう一度斬る(予兆なし)
          a.back = true; a.hits = new Set(); a.t0 = a.t; a.x0 = P.x; a.y0 = P.y;
          const D = q.dist * reach, full = a.ki >= DATA.classes.samurai.params.kiFull;
          a.cut = makeCut(P.x, P.y, P.x - Math.cos(a.a) * D, P.y - Math.sin(a.a) * D, { omen: 0, run: q.dash, hit: q.dash + 0.08, life: 0.7, wk: full ? 1.1 : 0.75, late: true, nodim: true });
          a.cut.ev.push({ at: q.dash, fn: () => cutSpark(a.cut, 12) });
          AudioMan.cut();
          return;
        }
        a.ph = 'rec'; a.t0 = a.t;
        return;
      }
      if (a.t - a.t0 >= q.recover) P.act = null; // 残心の硬直
    },
    // HUD 用: クラスリソース / スキル
    res: () => ({ kind: 'blade', label: '剣気', v: P.ki, max: P.kiMax }),
    staBroken: () => P.breakT > 0,
    // HUD 用: いま効いている状態。t / max は残り時間(無期限なら省略)
    statuses() {
      const c = DATA.classes.samurai.params, out = [];
      if (P.zanshinT > 0) {
        const k = zanshinK(), mv = cuV('passive', 'migaru') * k;
        out.push({ id: 'zanshin', glyph: '残', name: '残心' + (k > 1 ? '(背水)' : ''), fx: `攻撃力 +${Math.round(zanshinAtk() * k * 100)}%` + (mv ? ` 移動 +${Math.round(mv * 100)}%` : '') + (hasSp('passive', 'migaru') ? ' 被ダメージ -25%' : ''), t: P.zanshinT, max: c.zanshinT + cuV('passive', 'jizoku'), kind: 'buff' });
      }
      if (kiHigh()) out.push({ id: 'kiHigh', glyph: '気', name: hasSp('trait', 'juu') ? '明鏡止水' : '剣気解放', fx: `攻撃力 +${Math.round(cuV('trait', 'juu', c.kiFullAtk) * 100)}%` + (hasSp('trait', 'juu') ? ' 攻撃速度 +25% 被ダメージ -30%' : ''), kind: 'buff' });
      if (P.breakT > 0) out.push({ id: 'break', glyph: '崩', name: 'ガードブレイク', fx: `ガード不可 被ダメージ +${Math.round(c.breakDmg * 100)}%`, t: P.breakT, max: c.breakT, kind: 'debuff' });
      return out;
    },
    qInfo: () => ({ name: DATA.classes.samurai.q.name, glyph: '居' }),
    // ステータス画面用: 特性・パッシブ・Q・Space
    info(c) {
      const S2 = DATA.classes.samurai, q = S2.q, p = S2.params, k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0);
      const zAtk = c.cuV('passive', 'kihaku', p.zanshinAtk) + (c.lvFx.zanshinAtk || 0), zT = p.zanshinT + c.cuV('passive', 'jizoku');
      return [
        { key: '特性', name: '剣気', cat: 'trait', desc: [
          `メイン武器の通常攻撃の命中1体につき +${p.kiHit}(1回の攻撃で ${p.kiHitCap} まで)`,
          `ジャスト見切りで +${p.kiParry}`,
          `${p.kiFull} 以上の間は攻撃力アップ(全ての攻撃)`,
          '居合で全て消費し、威力に上乗せする',
        ], rows: [
          ['最大値', `${p.kiMax + c.cuV('trait', 'zan')}`],
          ['獲得量', `+${Math.round((c.cuV('trait', 'ren') + (c.lvFx.kiGain || 0)) * 100)}%`],
          [`${p.kiFull} 以上の攻撃力`, `<b>+${Math.round(c.cuV('trait', 'juu', p.kiFullAtk) * 100)}%</b>`],
        ] },
        { key: 'パッシブ', name: '残心', cat: 'passive', desc: [
          '見切り(ガード)で攻撃を受けた後、一定時間 攻撃力アップ(全ての攻撃)',
          'ガードで受けるたびに効果時間が戻る',
        ], rows: [
          ['攻撃力', `<b>+${Math.round(zAtk * 100)}%</b>`],
          ['効果時間', `${zT} 秒`],
        ] },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → 照準方向へ ${q.dist} 突進(無敵)`,
          `通過した敵をまとめて斬る(基礎威力 ${q.pow})`,
          `剣気を全て消費し、剣気1につき威力 +${q.kiPow}`,
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['威力', `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, `消費した剣気1につき +${(q.kiPow * k).toFixed(1)}`],
          ['突進距離', `${Math.round(q.dist * (1 + c.cuV('q', 'reach')))}`],
        ] },
        { key: 'Space', name: '見切り', desc: [
          `長押しでガード(移動 ×${p.guardSlow})。構えた瞬間にスタミナ ${p.guardCost}`,
          `構えてから ${p.parryWin}秒以内に受けるとジャスト見切り`,
          `  → スタミナを使わず周りに反撃・剣気 +${p.kiParry}・無敵 ${p.parryIfr}秒`,
          '  → その後も押している間はガードを続ける',
          'それ以外は受けたダメージ分のスタミナで受ける',
          `スタミナ 0 でガードブレイク(${p.breakT}秒 ガード不可・被ダメージ +${Math.round(p.breakDmg * 100)}%)`,
        ], rows: [
          ['スタミナ消費', `${p.guardCost} + 受けたダメージ分`, '構えた瞬間に消費。ガード中の被弾はダメージ分'],
          ['ジャスト受付', `<b>${(p.parryWin + (c.lvFx.parryWin || 0)).toFixed(2)}</b> 秒`],
          ['反撃の威力', `${p.parryPow} → <b>${Math.round(p.parryPow * c.atkMul)}</b>`],
        ] },
      ];
    },
  },

  mage: {
    skills: ['q'],
    init() {
      P.crystal = 0;
      P.elI = 0; P.flowWin = 0; P.flowT = 0; P.echoT = 0; P.ovf = 0; P.covf = 0; P.calmT = 0; P.blinkHeld = false; P.meteors = [];
    },
    update(dt) {
      const p = MG();
      P.flowT -= dt; if (P.flowT <= 0) { P.flowT = 1; P.flowWin = 0; } // 魔力循環の1秒ごとの上限
      P.echoT -= dt; P.calmT += dt;
      P.atkSpd = 1 + (P.echoT > 0 ? cuV('passive', 'echo') : 0);                                   // 余韻
      P.shots = Math.round(P.stats.v.shots || 0) + (hasSp('passive', 'echo') && P.echoT > 0 ? 1 : 0); // 詠唱加速
      if (hasSp('passive', 'cap') && P.calmT >= 3) heal(2 * dt, true); // 瞑想(満タンで余った分は超過回復)
      // ブリンク(Space を押した瞬間)
      const held = (keys.Space || keys.TouchDef) && !P.act;
      if (held && !P.blinkHeld) { if (P.sta >= blinkCost()) mageBlink(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
      P.blinkHeld = held;
      P.moveMul = 1;
      updMeteors(dt);
    },
    qStart: meteorStart,
    qUpdate: meteorUpdate,
    qInfo: () => ({ name: DATA.classes.mage.q.name, glyph: '隕' }),
    onHurt(dmg) { P.calmT = 0; return dmg; },
    // 通常攻撃の命中: E / Q の CD を短縮(1秒あたりの上限あり)。オーバーフロー: CD 0 で命中するとスキル威力を貯める
    onMainHit() {
      const p = MG(), cut = p.flowCut + cuV('passive', 'flow') + (P.lvFx.flowCut || 0), cap = p.flowCap + cuV('passive', 'cap');
      if (hasSp('passive', 'flow') && (P.sk.e.cd <= 0 || P.sk.q.cd <= 0)) P.ovf = Math.min(0.5, P.ovf + 0.001);
      const c = Math.min(cut, cap - P.flowWin);
      if (c <= 0) return;
      P.flowWin += c;
      for (const k in P.sk) P.sk[k].cd = Math.max(0, P.sk[k].cd - c);
    },
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
    res: () => ({ kind: 'crystal', label: '魔力結晶', v: P.crystal, max: crystalMax(), seg: true, dk: '#1d4a7a' }),
    statuses() {
      const out = [], e = cuV('passive', 'echo'), sp = hasSp('passive', 'echo');
      if (hasSp('trait', 'crys') && P.crystal > 0) out.push({ id: 'amp', glyph: '晶', name: '魔力増幅', fx: `攻撃力 +${Math.round(P.crystal * MG().ampAtk * 100)}%`, kind: 'buff' });
      if (P.echoT > 0 && (e || sp)) out.push({ id: 'echo', glyph: '韻', name: sp ? '詠唱加速' : '余韻', fx: (e ? `攻撃速度 +${Math.round(e * 100)}%` : '') + (sp ? ' 弾数 +1' : ''), t: P.echoT, max: 5, kind: 'buff' });
      if (P.ovf > 0) out.push({ id: 'ovf', glyph: '溢', name: 'オーバーフロー', fx: `次のスキルの威力 +${+(P.ovf * 100).toFixed(1)}%`, kind: 'buff' });
      if (P.covf > 0) out.push({ id: 'covf', glyph: '余', name: '余剰魔力', fx: `次のスキルの威力 +${+(P.covf * 100).toFixed(1)}%`, kind: 'buff' });
      if (hasSp('passive', 'cap') && P.calmT >= 3) out.push({ id: 'calm', glyph: '瞑', name: '瞑想', fx: 'HP 2/s で回復', kind: 'buff' });
      return out;
    },
    info(c) {
      const p = MG();
      return [
        { key: '特性', name: '元素循環', cat: 'trait', desc: [
          'メイン武器の通常攻撃・E の攻撃1回ごとに 炎 → 氷 → 雷 の順で属性が付く(サブ武器には付かない)',
          `炎: 与えたダメージの ${Math.round(p.burnPct * 100)}% を ${p.burnDur}秒かけて与える`,
          `氷: 凍傷 +1(1つにつき移動速度 -${Math.round(DATA.debuff.frostSlow * 100)}%)`,
          `雷: 近くの敵に ${Math.round(p.chainPct * 100)}% で連鎖`,
          '共鳴: 2属性を持つ敵に3つ目が当たると爆発。魔力結晶 +1',
          `魔力結晶が上限のときは、次のスキルの威力 +${+(p.crysOvf * 100).toFixed(1)}%(最大 +${Math.round(p.crysOvfMax * 100)}%。E / Q を使うと全て消費)`,
        ], rows: [
          ['凍傷の上限', `${MG().frostCap + (c.run && cuLv('trait', 'el') ? DATA.classes.mage.elFrost[cuLv('trait', 'el') - 1] : 0)}`],
          ['連鎖', `${p.chainN + (c.run ? cuLv('trait', 'el') : 0)} 体`],
          ['共鳴の威力', `${Math.round(p.resoPow * (1 + c.cuV('trait', 'rpow') + (c.lvFx.resoPow || 0)))} → <b>${Math.round(p.resoPow * (1 + c.cuV('trait', 'rpow') + (c.lvFx.resoPow || 0)) * c.atkMul)}</b>`, '3属性目が当たると爆発。魔力結晶 +1'],
          ['共鳴の半径', `${Math.round(p.resoR * (1 + c.st.v.area) * c.st.mul.area)}`],
          ['魔力結晶の上限', `<b>${p.crystalMax + (c.lvFx.crystalMax || 0) + c.cuV('trait', 'crys')}</b>`],
        ] },
        { key: 'パッシブ', name: '魔力循環', cat: 'passive', desc: [
          'メイン武器の通常攻撃が1回当たるごとに、E / Q の CD が短くなる',
          '1秒あたりに短くなる量には上限がある',
        ], rows: [
          ['1回の短縮', `<b>${(p.flowCut + c.cuV('passive', 'flow') + (c.lvFx.flowCut || 0)).toFixed(2)}</b> 秒`],
          ['1秒あたりの上限', `${(p.flowCap + c.cuV('passive', 'cap')).toFixed(1)} 秒`],
        ] },
        { key: 'Q', name: 'メテオ', cat: 'q', desc: [
          `構え ${DATA.classes.mage.q.windup}秒 → 照準位置に隕石が落ちる(基礎威力 ${DATA.classes.mage.q.pow}、半径 ${DATA.classes.mage.q.r})`,
          `当たった敵は炎上: 与えたダメージの ${Math.round(DATA.classes.mage.q.burnPct * 100)}% を ${p.burnDur}秒かけて与える`,
          `魔力結晶を全て消費し、1つにつき威力 +${Math.round(DATA.classes.mage.q.crystalPow * 100)}%・半径 +${Math.round(DATA.classes.mage.q.crystalR * 100)}%`,
        ], rows: [
          ['CD', `<b>${(DATA.classes.mage.q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['威力', `${Math.round(DATA.classes.mage.q.pow * (1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0)))} → <b>${Math.round(DATA.classes.mage.q.pow * (1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0)) * c.atkMul)}</b>`, `魔力結晶1つにつき 威力 +${Math.round(DATA.classes.mage.q.crystalPow * 100)}%・半径 +${Math.round(DATA.classes.mage.q.crystalR * 100)}%`],
          ['半径', `${Math.round(DATA.classes.mage.q.r * (1 + c.cuV('q', 'area')) * (1 + c.st.v.area) * c.st.mul.area)}`],
        ] },
        { key: 'Space', name: 'ブリンク', desc: [
          `移動方向へ ${p.blinkDist} 瞬間移動し、${p.blinkIfr}秒 無敵`,
          `出発地点に氷の残滓が ${p.residueT}秒残る(触れた敵に凍傷)`,
        ], rows: [
          ['スタミナ消費', `<b>${p.blinkCost - (c.lvFx.blinkCut || 0)}</b>`],
          ['距離 / 無敵', `${p.blinkDist} / ${p.blinkIfr} 秒`],
        ] },
      ];
    },
  },

  archer: {
    skills: ['q'],
    init() { P.focus = 0; P.dash = null; P.backHeld = false; P.chainB = AR().chainMax; P.sealB = P.maxhp * AR().guardMax; },
    update(dt) {
      const p = AR(), max = focusMax();
      P.chainB = Math.min(p.chainMax, P.chainB + p.chainMax * dt); // 狩りの連鎖: 縮められる量の枠(1秒で chainMax 溜まる)
      P.sealB = Math.min(P.maxhp * p.guardMax, (P.sealB || 0) + P.maxhp * p.guardMax * dt); // 守印: 得られるシールドの枠(1秒で 最大HP × guardMax 溜まる)
      // 集中: 止まっている間(E / Q の予備動作中も)に溜まり、動くとゆっくり下がる
      const still = !P.moving || (P.act && P.act.ph === 'wind');
      if (still) P.focus = Math.min(max, (P.focus || 0) + dt / p.focusStep * (1 + cuV('passive', 'calm')));
      else P.focus = Math.max(0, (P.focus || 0) - dt * p.focusDecay * (1 - cuV('passive', 'hold')));
      const f = focusN();
      P.atkSpd = 1 + f * p.focusAtkSpd;
      P.shots = Math.round(P.stats.v.shots || 0) + (hasSp('passive', 'eye') && f >= max ? 1 : 0); // 連射
      // バックステップ中の移動 → 着地で集中 +1
      if (P.dash) {
        P.x += P.dash.vx * dt; P.y += P.dash.vy * dt; P.dash.t -= dt;
        if (Math.random() < 0.5) P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.1, f: P.facing }]).slice(-3);
        if (P.dash.t <= 0) { P.dash = null; P.focus = Math.min(max, P.focus + p.backFocus); burst(P.x, P.y + 6, 8, ['#8a8098', '#6a6078'], { sp: 40, up: 10, life: 0.3 }); }
      }
      const held = (keys.Space || keys.TouchDef) && !P.act;
      if (held && !P.backHeld && !P.dash) { if (P.sta >= backCost()) archerBackstep(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
      P.backHeld = held;
      P.moveMul = P.dash ? 0 : 1;
    },
    onHurt(dmg) {
      const k = hasSp('passive', 'calm') && focusN() >= focusMax() ? 0.8 : 1; // 不動
      P.focus = Math.max(0, (P.focus || 0) - AR().focusHurt);
      return dmg * k;
    },
    onMainHit: e => addMark(e, 1),
    onEHit: e => addMark(e, 1),
    // 印を持つ敵が受けるダメージ / 弱点露出・集中によるクリティカル
    dmgTaken: e => (markOn(e) ? 1 + e.mark * (AR().markPct + (P.lvFx.markPct || 0)) : 1),
    critBonus: e => focusN() * (AR().focusCrit + cuV('passive', 'eye')) + (weakOn(e) ? AR().weakCrit : 0),
    critDmgBonus: e => (hasSp('trait', 'deep') && weakOn(e) ? 0.3 : 0), // 急所
    onKill(e) {
      if (!markOn(e)) return;
      const p = AR();
      const g = hasSp('trait', 'carve') ? Math.min(e.mark * p.guardK, P.sealB) : 0;
      if (g > 0) { // 守印: 倒した敵の印の数 × guardK のシールド(5秒。枠が残っている分だけ)
        P.sealB -= g; timedShield(g, p.guardT);
        part(e.x, e.y, (P.x - e.x) * 3, (P.y - e.y) * 3, 0.3, '#7ab8ff', { glow: true, sz: 2, drag: 0 });
      }
      const k = cuV('trait', 'spread');
      if (k) { // 伝播: 近くの敵へ印を移す
        const n = Math.floor(e.mark * k);
        let best = null, bd = p.spreadR * p.spreadR;
        forEachNear(e.x, e.y, p.spreadR, o => { if (o === e || o.dead || o.prop) return; const d = d2(o.x, o.y, e.x, e.y); if (d < bd) { bd = d; best = o; } });
        if (best && n > 0) { addMark(best, n); bolts.push({ x0: e.x, y0: e.y, x1: best.x, y1: best.y, t: 0, life: 0.15, w: 1 }); }
      }
      if (hasSp('trait', 'spread')) { // 狩りの連鎖: CD -chainCd(枠が残っている分だけ。1秒あたり chainMax まで)
        const n = Math.min(p.chainCd, P.chainB, P.sk.q.cd);
        P.chainB -= n; P.sk.q.cd -= n;
      }
    },
    atkBonus: () => 0,
    qStart() {
      const q = DATA.classes.archer.q;
      P.act = { slot: 'q', ph: 'wind', t: 0 };
      playAnim('aVolley', MOTIONS.aVolley.dur);
      slowmo(0.5, 0.2);
      skillCall(q.name, '#7dff9a'); AudioMan.click();
    },
    qUpdate(a, dt) {
      const q = DATA.classes.archer.q;
      P.moveMul = 0;
      if (a.t < q.windup) { // 長弓に光が集まる
        asMine(() => { if (Math.random() < dt * 60) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 22, P.y - 14 + Math.sin(r) * 22, -Math.cos(r) * 60, -Math.sin(r) * 60, 0.35, pick(['#b8ff9a', '#ffffff']), { glow: true, drag: 0 }); } });
        return;
      }
      archerVolley();
      P.act = null;
    },
    res: () => ({ kind: 'focus', label: '集中', v: focusN(), max: focusMax(), seg: true, dk: '#1f6a3a' }),
    staBroken: () => false,
    statuses() {
      const p = AR(), f = focusN(), out = [];
      if (f > 0) out.push({ id: 'focus', glyph: '集', name: `集中 ${f}段`, fx: `攻撃速度 +${Math.round(f * p.focusAtkSpd * 100)}% クリティカル率 +${(f * (p.focusCrit + cuV('passive', 'eye')) * 100).toFixed(1)}%` + (hasSp('passive', 'calm') && f >= focusMax() ? ' 被ダメージ -20%' : '') + (hasSp('passive', 'eye') && f >= focusMax() ? ' 弾数 +1' : ''), kind: 'buff' });
      return out;
    },
    qInfo: () => ({ name: DATA.classes.archer.q.name, glyph: '射' }),
    info(c) {
      const p = AR(), q = DATA.classes.archer.q, k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0);
      return [
        { key: '特性', name: '狩人の印', cat: 'trait', desc: [
          'メイン武器の通常攻撃・E が命中すると、その敵に印 +1(サブ武器では付かない)',
          `印1つにつき、その敵が受けるダメージ +${Math.round((p.markPct + (c.lvFx.markPct || 0)) * 100)}%`,
          `印が ${p.markMax} 以上で弱点露出: ${p.weakT}秒間 その敵へのクリティカル率 +${Math.round(p.weakCrit * 100)}%`,
          `印は ${p.markT}秒 刻まれないと消える。一斉射撃で消費する`,
        ], rows: [
          ['印の上限', `${p.markMax + c.cuV('trait', 'carve')}`],
          ['印の持続', `${p.markT + c.cuV('trait', 'deep')} 秒`],
        ] },
        { key: 'パッシブ', name: '集中', cat: 'passive', desc: [
          `止まっている間、${p.focusStep}秒ごとに +1段(E / Q の予備動作中も)`,
          `移動すると1秒ごとに ${p.focusDecay}段 下がる。被弾すると ${p.focusHurt}段 下がる`,
          `1段につき 攻撃速度 +${Math.round(p.focusAtkSpd * 100)}%(全武器)・クリティカル率 +${Math.round(p.focusCrit * 100)}%(全ての攻撃)`,
        ], rows: [
          ['最大段', `${p.focusMax + (c.lvFx.focusMax || 0)}`],
          ['最大時の攻撃速度', `<b>+${Math.round((p.focusMax + (c.lvFx.focusMax || 0)) * p.focusAtkSpd * 100)}%</b>`],
        ] },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → 画面内の印を持つ敵1体につき1本、その敵へまっすぐ高速の矢(基礎威力 ${q.pow}、貫通無限)`,
          `矢が当たった敵は、印1つにつき 基礎威力 ${q.markPow} の追加ダメージを連続で受ける(印は消費)`,
          '  → 途中で貫いた敵も、印を持っていれば同じく受ける',
          `さらに無条件で、最寄りの ${q.none}体へも1本ずつ(最大 ${q.max}本)`,
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['矢の威力', `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`],
          ['印1つの追加', `${Math.round(q.markPow * k)} → <b>${Math.round(q.markPow * k * c.atkMul)}</b>`],
        ] },
        { key: 'Space', name: 'バックステップ', desc: [
          `移動方向と逆へ ${p.backDist} 跳ぶ(止まっているときは向きと逆)。${p.backIfr}秒 無敵`,
          `着地すると集中 +${p.backFocus}段`,
        ], rows: [
          ['スタミナ消費', `<b>${p.backCost - (c.lvFx.backCut || 0)}</b>`],
        ] },
      ];
    },
  },

  knight: {
    skills: ['q'],
    init() { P.guard = false; P.guardHeld = false; P.guardT = 0; P.breakT = 0; P.knGainT = -99; P.knBreakCd = 0; },
    update(dt) {
      const p = KN();
      P.breakT -= dt;
      // 大盾(Space 長押し)。構えた瞬間にスタミナ guardCost。押し直すまで再び構えない
      const held = (keys.Space || keys.TouchDef) && !P.act;
      if (held && !P.guard && !P.guardHeld && P.breakT <= 0) {
        if (P.sta >= p.guardCost) { staUse(p.guardCost); P.guard = true; P.guardT = 0; AudioMan.click(); }
        else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88');
      }
      P.guardHeld = held;
      if (!held && P.guard) P.guard = false;
      if (P.guard) P.guardT += dt;
      P.moveMul = P.guard ? p.guardSlow : 1;
      // シールド: 1秒に今の量の decay ずつ減る(聖盾でシールドを得てから decayWait 秒は減らない)/ 上限を超えた分は削る
      if (S.time - P.knGainT > p.decayWait && P.shield > 0) {
        const k = p.decay * (hasSp('trait', 'hold') ? 1 - p.sanctDecay : 1); // 不滅の盾: 減る量 -30%
        P.shield *= Math.exp(-k * dt);
        if (P.shield < 0.5) P.shield = 0;
      }
      const over = shieldTotal() - knCap();
      if (over > 0) P.shield = Math.max(0, P.shield - over);
    },
    // 被弾: 大盾を構えていれば全方向で受け止める(HP は減らない)。受けたダメージはシールドに変わる
    onHurt(dmg) {
      const p = KN();
      if (P.breakT > 0 || !P.guard) return dmg;
      const blocked = Math.max(1, Math.round((dmg - P.armor) * (1 - P.dr)));
      staUse(blocked * Math.max(0, p.pay - (P.lvFx.payCut || 0)), DATA.player.staLock);
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
    onShieldBreak: () => knightBreak(),
    shieldCap: () => knCap(),
    shieldGain: () => (hasSp('trait', 'hold') ? 1 + KN().sanctGain : 1), // 不滅の盾: 獲得量 +25%
    atkBonus: () => knHoldAtk(),
    qStart() {
      const q = DATA.classes.knight.q, a = aimDir(q.r * 1.5);
      if (Math.cos(a) !== 0) P.facing = Math.cos(a) < 0 ? -1 : 1;
      holyGain(P.maxhp * KN().skillGain); // 発動前にシールドを得る(そのまま審判で消費する)
      P.act = { slot: 'q', ph: 'wind', t: 0, a };
      playAnim('kVerdict', MOTIONS.kVerdict.dur);
      slowmo(0.5, 0.2);
      skillCall(q.name, '#f2c84b'); AudioMan.click();
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
    res: () => ({ kind: 'shield', label: 'シールド', v: Math.floor(shieldTotal()), max: Math.max(1, Math.round(knCap())), dk: '#6a5a1a' }),
    staBroken: () => P.breakT > 0,
    statuses() {
      const out = [], k = knHoldAtk();
      if (k > 0.005) out.push({ id: 'hold', glyph: '堅', name: '堅守', fx: `攻撃力 +${Math.round(k * 100)}%(シールドの量に比例)`, kind: 'buff' });
      if (P.breakT > 0) out.push({ id: 'break', glyph: '崩', name: 'ガードブレイク', fx: 'ガード不可', t: P.breakT, max: KN().breakT, kind: 'debuff' });
      return out;
    },
    qInfo: () => ({ name: DATA.classes.knight.q.name, glyph: '審' }),
    info(c) {
      const p = KN(), q = DATA.classes.knight.q, k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0), capP = p.capPct + c.cuV('trait', 'cap') + (c.lvFx.capPct || 0);
      return [
        { key: '特性', name: '聖盾', cat: 'trait', desc: [
          `大盾で受けたダメージの ${Math.round(p.convert * 100)}% がシールドになる`,
          `E / Q を使うと、発動前に最大HP の ${Math.round(p.skillGain * 100)}% のシールドを得る(Q はそのまま消費に含まれる)`,
          `1秒に今のシールドの ${Math.round(p.decay * 100)}% ずつ減る(聖盾でシールドを得てから ${p.decayWait}秒は減らない)`,
          '堅守: シールドの量に比例して攻撃力アップ(全ての攻撃)',
          '  → 魔力障壁などほかのシールドも同じ扱い',
        ], rows: [
          ['シールドの上限', `最大HP の ${Math.round(capP * 100)}%`],
          ['堅守(上限のとき)', `<b>+${Math.round(c.cuV('trait', 'hold', p.holdAtk) * 100)}%</b>`],
        ] },
        { key: 'パッシブ', name: '不屈', cat: 'passive', desc: [
          'シールドが割れた瞬間、周りに衝撃波を放って敵を押し返す',
          `割れた直後 ${p.breakIfr}秒 無敵(${p.breakCd}秒に1回まで)`,
        ], rows: [
          ['衝撃波の威力', `${Math.round(p.breakPow * (1 + c.cuV('passive', 'shock') + (c.lvFx.breakPow || 0)))} → <b>${Math.round(p.breakPow * (1 + c.cuV('passive', 'shock') + (c.lvFx.breakPow || 0)) * c.atkMul)}</b>`],
        ] },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → シールドを全て消費し、前方の扇形に光の衝撃`,
          `基礎威力 ${q.pow} + 消費したシールド × ${q.perShield}`,
          `当たった敵を押し返し、${q.stun} + 消費したシールド × ${q.stunPer}秒 スタン`,
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['基礎威力(シールド 0)', `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`],
        ] },
        { key: 'Space', name: '大盾', desc: [
          '長押しで大盾を構え、全方向の攻撃を受け止める(HP は減らない)',
          `構えた瞬間にスタミナ ${p.guardCost}。受けたダメージの ${Math.round((p.pay - (c.lvFx.payCut || 0)) * 100)}% をスタミナで払う`,
          `構えている間は移動速度 ×${p.guardSlow}。スタミナ 0 でガードブレイク(${p.breakT}秒)`,
        ], rows: [
          ['スタミナの払い', `<b>${Math.round((p.pay - (c.lvFx.payCut || 0)) * 100)}%</b>`],
        ] },
      ];
    },
  },

  pyro: {
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
      const held = (keys.Space || keys.TouchDef) && !P.act;
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
    // 燻り: 炎上が切れた敵に残り火(残り火が切れても次は出ない)
    onBurnOut(e, perSec, onlyEmber) { if (hasSp('trait', 'dur') && !onlyEmber) addBurn(e, perSec * PY().emberPct, 3, 'ember'); },
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
      skillCall(q.name, '#ff6a2a'); AudioMan.click();
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
    res: () => ({ kind: 'wear', label: '焔纏い', v: P.pyT, max: Math.max(P.pyT, wearDur()), dk: '#7a2a10' }),
    staBroken: () => false,
    statuses() {
      const out = [];
      if (P.pyT > 0) out.push({ id: 'wear', glyph: '焔', name: '焔纏い', fx: `全武器の命中で炎上(与えたダメージの ${Math.round(pyIgnite() * 100)}%)` + (hasSp('passive', 'kindle') ? ' 炎上ダメージ +50% HP 3%/s 消費' : ''), t: P.pyT, max: Math.max(P.pyT, wearDur()), kind: 'buff' });
      return out;
    },
    qInfo: () => ({ name: DATA.classes.pyro.q.name, glyph: '煉' }),
    info(c) {
      const p = PY(), q = DATA.classes.pyro.q, k = 1 + (c.lvFx.qPow || 0), kin = c.cuV('passive', 'kindle');
      return [
        { key: '特性', name: '業火', cat: 'trait', desc: [
          `火勢: 敵の炎上 1スタックにつき、その敵の炎上ダメージ +${Math.round((p.stackPct + (c.lvFx.stackPct || 0)) * 100)}%`,
          `延焼: 炎上中の敵が倒れると、残っていた炎上ダメージを周りの ${p.spreadN}体へ燃え移らせる`,
          'どの炎上にも効く(武器・スキル・装備のどれで付けた炎上でも)',
        ], rows: [
          ['火勢の最大スタック', `${p.stackMax + c.cuV('trait', 'stack')}`],
          ['燃え移る量', `<b>${Math.round(c.cuV('trait', 'spread', p.spreadPct) * 100)}%</b>`],
          ['炎上の持続', `+${c.cuV('trait', 'dur')} 秒`],
        ] },
        { key: 'パッシブ', name: '焔纏い', cat: 'passive', desc: [
          'E / Q を使うと、焔を纏う(使うたびに時間が戻る)',
          '纏っている間、全武器の攻撃(通常攻撃・E)が命中すると、与えたダメージの一部を 3秒の炎上で付ける',
          '  → サブ武器も対象。炎上そのもの・Q・爆風からは付かない',
        ].concat(kin ? [`纏った瞬間、周り(半径 ${p.kindleR})に火の輪`] : []), rows: [
          ['纏う時間', `<b>${c.cuV('passive', 'wear', p.wearT)}</b> 秒`],
          ['付与量', `<b>${Math.round((c.cuV('passive', 'ignite', p.ignite) + (c.lvFx.ignite || 0)) * 100)}%</b>`],
        ].concat(kin ? [['火の輪の威力', `${kin} → <b>${Math.round(kin * c.atkMul)}</b>`]] : []) },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → 画面内の炎上中の敵全員の炎上を、まとめて爆発させる`,
          `各敵に、基礎威力 ${q.base} + 残っていた炎上ダメージ × 爆発の倍率 をすぐに与える(炎上は消費する)`,
          `その敵の周り(半径 ${q.r})に 基礎威力 ${q.pow} + 炎上スタック数 × ${q.perStack} の爆風`,
          '炎上中の敵がいなくても使える(自分の周りに爆風だけ)',
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['爆発の基礎威力', `${Math.round(q.base * k)} → <b>${Math.round(q.base * k * c.atkMul)}</b>`],
          ['爆発の倍率', `<b>${Math.round(c.cuV('q', 'pow', q.mul) * k * 100)}%</b>`, '残っていた炎上ダメージに掛ける'],
          ['爆風の基礎威力', `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, `炎上1スタックにつき +${Math.round(q.perStack * k)}`],
        ] },
        { key: 'Space', name: '炎壁', desc: [
          `その場で炎を噴き出し、周り(半径 ${p.wallR})の敵を押し返して炎上させる(${p.wallBurn}/s を 3秒)`,
          `使った瞬間から ${p.wallIfr}秒 無敵`,
        ], rows: [
          ['スタミナ消費', `<b>${p.wallCost - (c.lvFx.wallCut || 0)}</b>`],
        ] },
      ];
    },
  },
  cryo: {
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
      const dc = S.decoy;
      if (dc && dc.cryo) forEachNear(dc.x, dc.y, p.decoyR + 6, e => { if (!e.prop && !e.dead && !dc.hit.has(e.id)) { dc.hit.add(e.id); addFrost(e, p.decoyFrost, 10); part(e.x, e.y, 0, -15, 0.4, '#bff4ff', { glow: true }); } });
      const held = (keys.Space || keys.TouchDef) && !P.act;
      if (held && !P.mirrorHeld && !P.dash) { if (P.sta >= mirrorCost()) cryoMirror(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
      P.mirrorHeld = held;
      P.moveMul = P.dash ? 0 : 1;
    },
    onHurt(dmg) {
      if (P.cryT > 0 && hasSp('passive', 'armor')) { // 冷気の反撃
        const p = CR();
        forEachNear(P.x, P.y, p.counterR, e => { if (!e.prop) addFrost(e, p.counterFrost, 10); });
        addRing(P.x, P.y, p.counterR, '#bff4ff', { w: 2, life: 0.3 });
      }
      return dmg;
    },
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
      skillCall(q.name, '#a8e8ff'); AudioMan.click();
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
    res: () => ({ kind: 'wear', label: '氷纏い', v: P.cryT, max: Math.max(P.cryT, cryWearDur()), dk: '#1d4a7a' }),
    staBroken: () => false,
    statuses() {
      const out = [];
      if (P.cryT > 0) out.push({ id: 'cwear', glyph: '氷', name: '氷纏い', fx: '全武器の命中で凍傷 +1' + (cuV('passive', 'chance') ? `(${Math.round(cuV('passive', 'chance') * 100)}% でさらに +1)` : ''), t: P.cryT, max: Math.max(P.cryT, cryWearDur()), kind: 'buff' });
      return out;
    },
    qInfo: () => ({ name: DATA.classes.cryo.q.name, glyph: '晶' }),
    info(c) {
      const p = CR(), q = DATA.classes.cryo.q, k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0), sp2 = c.hasSp('trait', 'brittle') ? 2 : 1;
      const cap = c.hasSp('trait', 'brittle') ? p.capSp : p.frostCap, iv = c.cuV('trait', 'deep', p.decay);
      return [
        { key: '特性', name: '凍結', cat: 'trait', desc: [
          `凍傷の上限が ${cap} になる(どの出どころの凍傷も)。上限に達すると凍結する`,
          '凍結: 行動不能・受けるダメージアップ。凍傷を付ける攻撃なら、さらにアップ',
          `凍結中は凍傷が ${iv}秒ごとに 1 減り、0 で解除(凍結中は凍傷が増えない)`,
          'ボスは行動不能にならず、攻撃速度 -30%',
        ], rows: [
          ['凍結の時間', `<b>${(cap * iv).toFixed(1)}</b> 秒`],
          ['凍結中の被ダメージ', `<b>+${Math.round((c.cuV('trait', 'brittle', p.freezeDmg) + (c.lvFx.freezeDmg || 0)) * sp2 * 100)}%</b>`, `凍傷を付ける攻撃ならさらに +${Math.round(p.frostHit * sp2 * 100)}%`],
        ] },
        { key: 'パッシブ', name: '氷纏い', cat: 'passive', desc: [
          'E / Q を使うと、冷気を纏う(使うたびに時間が戻る)',
          '纏っている間、全武器の攻撃(通常攻撃・E)が命中すると、その敵に凍傷 +1',
          '  → サブ武器も対象',
        ], rows: [
          ['纏う時間', `<b>${c.cuV('passive', 'wear', p.wearT) + (c.lvFx.wearT || 0)}</b> 秒`],
        ].concat(c.cuV('passive', 'armor') ? [['纏った瞬間のシールド', `最大HP の ${Math.round(c.cuV('passive', 'armor') * 100)}%`]] : []) },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → 自分を中心に ${q.dur}秒間、細氷の領域(自分についてくる)`,
          `範囲内の敵に、${q.every}秒ごとに凍傷 +${q.frost} と基礎威力 ${q.pow} のダメージ`,
          `この範囲内で凍結した敵は、凍結時間 +${Math.round(q.freezeUp * 100)}%`,
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['威力', `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, `${q.every}秒ごと`],
          ['半径', `${Math.round(q.r * (1 + c.cuV('q', 'area')) * (1 + c.st.v.area) * c.st.mul.area)}`],
        ] },
        { key: 'Space', name: '氷の鏡', desc: [
          `移動方向と逆へ ${p.mirrorDist} 下がる(${p.mirrorIfr}秒 無敵)`,
          `元の位置に氷の分身を ${p.decoyT}秒残す。分身は敵を引きつけ、触れた敵に凍傷 +${p.decoyFrost}`,
        ], rows: [
          ['スタミナ消費', `<b>${p.mirrorCost - (c.lvFx.mirrorCut || 0)}</b>`],
        ] },
      ];
    },
  },
  electro: {
    skills: ['q'],
    init() { P.charge = 0; P.chargeT = -99; P.elT = 0; P.dash = null; P.dashHeld = false; P.recharge = null; P.elDis = {}; P.dashHit = null; },
    update(dt) {
      const p = EL();
      P.elT = Math.max(0, P.elT - dt);
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
      const held = (keys.Space || keys.TouchDef) && !P.act;
      if (held && !P.dashHeld && !P.dash) { if (P.sta >= dashCost()) electroDash(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
      P.dashHeld = held;
      P.moveMul = P.dash ? 0 : 1;
    },
    onHurt: dmg => dmg,
    onMainHit() {},
    // E / Q を使うと纏う + 放電(帯電を消費して、その発動の命中に強い感電)
    onSkill(slot) { elWear(); P.elDis[slot] = elDischarge(); },
    onEHit(e, dealt) { if (P.elDis.e && dealt) addShock(e, dealt, P.elDis.e, { noCharge: true }); }, // 放電(E)
    // 雷纏い: 全武器の命中に感電 / 雷鳴: クリティカルで帯電 +1
    onWeaponHit(e, dmg, crit) {
      if (crit && hasSp('passive', 'charge')) elGain(1, true);
      if (P.elT > 0 && !e.dead) addShock(e, dmg, cuV('passive', 'shock', EL().wearShock) + (P.lvFx.wearShock || 0));
    },
    shockMod: e => elShockMod(e),
    shockOrigin: true, // 帯電: 感電は起点の敵(攻撃が当たった敵)にも入る
    onShock(o) { P.chargeT = S.time; if (!o.noCharge) elGain(1); },
    critDmgBonus: () => (hasSp('trait', 'store') && P.charge >= elMax() ? EL().overCrit : 0), // 過電流
    blockProj: () => P.elT > 0 && hasSp('passive', 'wear') && Math.random() < EL().static, // 静電気
    atkBonus: () => 0,
    qStart() {
      const q = DATA.classes.electro.q;
      P.act = { slot: 'q', ph: 'wind', t: 0 };
      playAnim('eTower', MOTIONS.eTower.dur);
      slowmo(0.5, 0.2);
      skillCall(q.name, '#fff27a'); AudioMan.click();
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
    res: () => ({ kind: 'charge', label: '帯電', v: Math.floor(P.charge), max: elMax(), dk: '#6a5a10' }),
    staBroken: () => false,
    statuses() {
      const out = [], n = Math.floor(P.charge / EL().perChain);
      if (n > 0) out.push({ id: 'charge', glyph: '電', name: `帯電 ${Math.floor(P.charge)}`, fx: `感電の連鎖 +${n}` + (hasSp('trait', 'store') && P.charge >= elMax() ? ' クリティカルダメージ +50%' : ''), kind: 'buff' });
      if (P.elT > 0) out.push({ id: 'elwear', glyph: '雷', name: '雷纏い', fx: `全武器に感電 ${Math.round((cuV('passive', 'shock', EL().wearShock) + (P.lvFx.wearShock || 0)) * 100)}%`, t: P.elT, max: Math.max(P.elT, elWearDur()), kind: 'buff' });
      return out;
    },
    qInfo: () => ({ name: DATA.classes.electro.q.name, glyph: '塔' }),
    info(c) {
      const p = EL(), q = DATA.classes.electro.q, k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0);
      return [
        { key: '特性', name: '帯電', cat: 'trait', desc: [
          '感電が起きるたびに帯電 +1。帯電 ' + p.perChain + ' につき感電の連鎖 +1',
          `${p.decayWait}秒間 感電が起きないと、1秒に ${p.decay} ずつ減る`,
          '放電: E / Q を使うと帯電を消費し、その発動の命中に追加の感電(消費した帯電が多いほど強い)',
          '感電: 命中した敵から近くの敵へ雷が連鎖し、与えたダメージの一部を与える',
        ], rows: [
          ['帯電の上限', `${p.max + c.cuV('trait', 'cap')}`],
          ['放電で消費する帯電', `<b>${Math.round(c.cuV('trait', 'store', p.use) * 100)}%</b>`],
          ['放電の感電', `${Math.round(p.disShock * 100)}%`, `消費した帯電 1 につき感電ダメージ +${Math.round(p.disPer * 100)}%`],
        ] },
        { key: 'パッシブ', name: '雷纏い', cat: 'passive', desc: [
          'E / Q を使うと、雷を纏う(使うたびに時間が戻る)',
          '纏っている間、全武器の攻撃(通常攻撃・E)に感電が付く',
          '  → サブ武器も対象',
        ], rows: [
          ['纏う時間', `<b>${c.cuV('passive', 'wear', p.wearT)}</b> 秒`],
          ['感電', `<b>${Math.round((c.cuV('passive', 'shock', p.wearShock) + (c.lvFx.wearShock || 0)) * 100)}%</b>`],
        ] },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → 画面内のランダムな位置に鉄塔を落とす(落ちた瞬間に落雷: 基礎威力 ${q.landPow})`,
          `${q.dur}秒間、各鉄塔は ${q.every}秒ごとに近くの敵 1体へ電気を放つ(基礎威力 ${q.pow}、感電 ${Math.round(q.shock * 100)}%)`,
          '放電は使ったときに1回。この Q の攻撃すべてに放電の感電が乗る',
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['鉄塔', `${q.n + c.cuV('q', 'n')} 本`],
          ['落雷 / 放電の威力', `${Math.round(q.landPow * k)} / ${Math.round(q.pow * k)} → <b>${Math.round(q.landPow * k * c.atkMul)} / ${Math.round(q.pow * k * c.atkMul)}</b>`],
        ] },
        { key: 'Space', name: '雷走', desc: [
          `移動方向へ ${p.dashDist} 駆け抜ける(${p.dashIfr}秒 無敵)`,
          `通り抜けた敵に 基礎威力 ${p.dashPow} と感電 ${Math.round(p.dashShock * 100)}%`,
        ], rows: [
          ['スタミナ消費', `<b>${p.dashCost - (c.lvFx.dashCut || 0)}</b>`],
        ] },
      ];
    },
  },
  cleric: {
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
        addFloat(P.x, P.y - 18, '不屈の祈り', '#ffe38a', 1.2);
        asMine(() => { addRing(P.x, P.y, 30, '#ffe38a', { w: 3, life: 0.45 }); burst(P.x, P.y, 30, ['#ffe38a', '#ffffff'], { sp: 100, up: 30, glow: true, life: 0.5 }); });
      }
      if (P.prayer > 0 && Math.random() < dt * 4 * Math.min(1, P.prayer / Math.max(1, prayCap()))) part(P.x + rand(-6, 6), P.y + rand(-2, 6), 0, -rand(15, 30), 0.6, pick(['#ffe38a', '#fff6d8']), { glow: true }); // 祈りの光
      // 聖域の祈り(Space)
      const held = (keys.Space || keys.TouchDef) && !P.act;
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
      slowmo(0.5, 0.2);
      skillCall(q.name, '#ffe38a'); AudioMan.click();
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
    res: () => ({ kind: 'prayer', label: '祈り', v: Math.floor(P.prayer), max: Math.max(1, Math.round(prayCap())), dk: '#7a6a2a' }),
    staBroken: () => false,
    statuses() {
      const out = [];
      if (P.prayer >= 1) out.push({ id: 'prayer', glyph: '祈', name: `祈り ${Math.floor(P.prayer)}`, fx: `メイン武器の通常攻撃・E に +${Math.round(P.prayer * cuV('trait', 'faith', CL().strike))} ダメージ`, kind: 'buff' });
      if (P.afterT > 0) out.push({ id: 'after', glyph: '光', name: '余光', fx: `HP回復速度 +${cuV('passive', 'after')}/s`, t: P.afterT, max: CL().afterT, kind: 'buff' });
      if (P.hot) out.push({ id: 'grace', glyph: '恩', name: '恩寵', fx: `HP ${P.hot.rate.toFixed(1)}/s 回復`, t: P.hot.t, max: CL().graceT, kind: 'buff' });
      return out;
    },
    qInfo: () => ({ name: DATA.classes.cleric.q.name, glyph: '審' }),
    info(c) {
      const p = CL(), q = DATA.classes.cleric.q, k = (1 + c.cuV('q', 'pow')) * (1 + (c.lvFx.qPow || 0)), hp = c.st.v.hp * c.st.mul.hp;
      return [
        { key: '特性', name: '祈り', cat: 'trait', desc: [
          '超過回復(HP が満タンを超えた分)が祈りになる(回復の出どころは問わない)',
          `祈りの一撃: メイン武器の通常攻撃・E のすべての命中に、祈りの ${Math.round(c.cuV('trait', 'faith', p.strike) * 100)}% の追加ダメージ(攻撃力を掛ける)`,
          '追加ダメージで祈りは減らない(祈りを使うのは Q だけ)',
        ], rows: [
          ['祈りの上限', `最大HP と同じ(${Math.round(hp)})`],
          ['祈りの一撃の間隔', `<b>${(p.strikeCd * (1 - c.cuV('trait', 'vessel')) * (1 - (c.lvFx.strikeCd || 0))).toFixed(2)}</b> 秒に1回`],
        ] },
        { key: 'パッシブ', name: '癒しの光', cat: 'passive', desc: [
          'E / Q を使ったとき、HP を回復する',
          '回復を受けるとき、今の HP が低いほど回復量が増える(自分が受けるすべての回復に効く)',
        ], rows: [
          ['E / Q の回復', `<b>最大HP の ${Math.round((c.cuV('passive', 'light', p.light) + (c.lvFx.lightHeal || 0)) * 100)}%</b>`],
          ['低HP の回復量アップ', `最大 +${Math.round(c.cuV('passive', 'mercy', p.mercy) * 100)}%`],
        ] },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → 祈りを全て消費し、照準方向の扇形に光の一撃`,
          `基礎威力 ${q.pow} + 消費した祈り × ${q.perPray}`,
          `消費した祈りの ${Math.round(q.heal * 100)}% だけ HP を回復(この超過回復は祈りにならない)`,
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['基礎威力(祈り 0)', `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, `祈り 1 につき +${(q.perPray * k).toFixed(1)}`],
        ] },
        { key: 'Space', name: '聖域の祈り', desc: [
          `その場で短く祈り、${p.prayIfr}秒 無敵`,
          `使った瞬間に HP を最大HP の ${Math.round(p.prayHeal * 100)}% 回復(満タンなら祈りになる)`,
        ], rows: [
          ['スタミナ消費', `<b>${p.prayCost - (c.lvFx.prayCut || 0)}</b>`],
        ] },
      ];
    },
  },
  assassin: {
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
      const held = (keys.Space || keys.TouchDef) && !P.act;
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
      skillCall(q.name, '#ff3b5c'); AudioMan.click();
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
      ? { kind: 'pact', label: '血の契約', v: Math.ceil(P.pact.t), max: Math.max(1, Math.ceil(P.pact.max)), dk: '#6a0a1e' }
      : { kind: 'bleed', label: '出血の上限', v: asBleedCap(), max: Math.max(1, asBleedMax()), dk: '#6a0a1e' }),
    staBroken: () => false,
    statuses() {
      const out = [], q = DATA.classes.assassin.q, k = asPactK();
      if (P.pact) out.push({ id: 'pact', glyph: '契', name: '血の契約', fx: `移動速度 +${Math.round(q.spd * k * 100)}% 出血1につき与ダメ +${(q.perStack * k * 100).toFixed(1)}%` + (hasSp('passive', 'feast') ? ` 血の渇きの上限 ×${AS().pactCap}` : ''), t: P.pact.t, max: P.pact.max, kind: 'buff' });
      if (hasSp('passive', 'greed') && P.hp <= P.maxhp * AS().lowAt) out.push({ id: 'ikiti', glyph: '血', name: '生き血', fx: '血の渇きの回復量 ×2', kind: 'buff' });
      return out;
    },
    qInfo: () => ({ name: DATA.classes.assassin.q.name, glyph: '契' }),
    info(c) {
      const p = AS(), q = DATA.classes.assassin.q, B = DATA.bleed, k = (1 + c.cuV('q', 'pow')) * (1 + (c.lvFx.qPow || 0));
      const lk = 1 + c.cuV('passive', 'thirst') + (c.lvFx.leech || 0), pk = c.cuV('q', 'price', 1);
      return [
        { key: '特性', name: '血刃', cat: 'trait', desc: [
          '斬撃タイプの武器(刀・騎士剣・オービットブレード・スローイングアックス)の命中で、出血 +1(通常攻撃・E とも)',
          `出血の最大スタック = 斬撃タイプの武器の所持数 × ${p.perCut}`,
          `出血: 1スタックにつき毎秒 最大HP の ${(B.pct * 100).toFixed(1)}%(ボス ×${B.boss}、エリート ×${B.elite})`,
        ], rows: [
          ['出血の最大スタック', c.run ? `<b>${asBleedCap()}</b>` : `斬撃タイプ 1本につき <b>${p.perCut + c.cuV('trait', 'rend')}</b>`],
          ['出血ダメージ', `<b>+${Math.round((c.cuV('trait', 'deep') + (c.lvFx.bleedDmg || 0)) * 100)}%</b>`],
          ['出血の持続', `${B.dur + c.cuV('trait', 'last')} 秒`],
        ] },
        { key: 'パッシブ', name: '血の渇き', cat: 'passive', desc: [
          `メイン武器の攻撃が当たるたびに HP を ${p.leech} 回復する`,
          `出血中の敵を倒すと、その敵の出血 1スタックにつき 最大HP の ${(p.killPer * 100).toFixed(2)}% を回復する`,
          `血の渇きの回復は、合わせて 1秒に 最大HP の ${p.leechCap * 100}% まで`,
        ], rows: [
          ['命中ごとの回復', `<b>${(p.leech * lk).toFixed(2)}</b>`],
          ['撃破時の回復', `出血 1 につき 最大HP の <b>${(c.cuV('passive', 'greed', p.killPer) * lk * 100).toFixed(3)}%</b>`],
          ['1秒の上限', `最大HP の <b>${(c.cuV('passive', 'feast', p.leechCap) * 100).toFixed(1)}%</b>`],
        ] },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → 今の HP の ${Math.round(q.pay * 100)}% を支払う(HP は 1 未満にならない)`,
          `支払った瞬間、照準方向へ×字に交差する二筋の斬撃: 基礎威力 ${q.pow} + 支払った HP × ${q.perHp}、出血 +${q.bleed}(1体に1回)`,
          `  → 交差の中心は ${q.crossD} 前、1本の長さ ${q.crossL * 2}、線から ${q.crossW} 以内に当たる`,
          `${q.dur}秒間、移動速度 +${Math.round(q.spd * 100)}%、敵の出血 1スタックにつき与えるダメージ +${Math.round(q.perStack * 100)}%`,
        ], rows: [
          ['CD', `<b>${(q.cd * c.cdMul).toFixed(1)}</b> 秒`],
          ['斬り裂きの威力', `${q.pow} + 支払った HP × ${q.perHp} → <b>×${(k * c.atkMul).toFixed(2)}</b>`, '強化・攻撃力の倍率'],
          ['効果', `移動速度 +${Math.round(q.spd * pk * 100)}%、出血1につき +${(q.perStack * pk * 100).toFixed(1)}%、${q.dur + c.cuV('q', 'dur')} 秒`],
        ] },
        { key: 'Space', name: '瞬影', desc: [
          `移動方向へ ${p.dashDist} 駆け抜ける(${p.dashIfr}秒 無敵)`,
          `通り抜けた敵に 基礎威力 ${p.dashPow} と出血 +${p.dashBleed}`,
        ], rows: [
          ['スタミナ消費', `<b>${p.dashCost}</b>`],
        ] },
      ];
    },
  },
  // 死霊(P.souls)は倒した敵から増え、周りを漂って敵を襲う。身代わり(死者の盾)と葬送(Q)で使う
  necro: {
    skills: ['q'],
    init() { P.souls = []; P.rei = 0; P.nbombs = []; P.nOver = []; P.phase = null; P.phaseHeld = false; P.undyingAt = -999; },
    update(dt) {
      const p = NC();
      necSouls(dt);  // 死霊: 漂う・飛びかかる・戻る
      necBombs(dt);  // 葬送の霊弾
      if (P.rei > 0) P.rei = Math.max(0, P.rei - necReiDecay() * dt); // 霊力は少しずつ減る
      // 百鬼夜行: 上限を超えた死霊は少し遅れて爆ぜる(連鎖が1フレームに重ならないように)
      for (let i = P.nOver.length - 1; i >= 0; i--) { const o = P.nOver[i]; if ((o.t -= dt) <= 0) { P.nOver.splice(i, 1); necOverBurst(o); } }
      if (S.dimK > 0) S.dimK = Math.max(0, S.dimK - dt * 1.5);
      // 霊体化: 半透明で滑る → 解けた瞬間に死霊が一斉に飛びかかる
      if (P.phase) {
        P.phase.t -= dt;
        P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.06, f: P.facing }]).slice(-6);
        if (Math.random() < dt * 30) asMine(() => part(P.x + rand(-5, 5), P.y + rand(-6, 6), rand(-10, 10), -rand(5, 20), 0.4, pick(NEC_FX), { glow: true }));
        if (P.phase.t <= 0) { P.phase = null; necVolley(); }
      }
      const held = (keys.Space || keys.TouchDef) && !P.act;
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
      skillCall(q.name, '#a58cff'); AudioMan.click();
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
    res: () => ({ kind: 'soul', label: '死霊', v: P.souls.length, max: necMax(), seg: true, dk: '#4a3a8a' }),
    staBroken: () => false,
    statuses() {
      const out = [], p = NC(), left = p.undyingCd - (S.time - P.undyingAt);
      if (P.rei >= 1) out.push({ id: 'rei', glyph: '霊', name: `霊力 ${Math.floor(P.rei)}`, fx: `死霊の攻撃・葬送の威力 +${((necK() - 1) * 100).toFixed(1)}%`, kind: 'buff' });
      if (hasSp('passive', 'soul') && left > 0) out.push({ id: 'undying', glyph: '契', name: '不死の契り', fx: '再び使えるまで', t: left, max: p.undyingCd, kind: 'debuff' });
      return out;
    },
    qInfo: () => ({ name: DATA.classes.necro.q.name, glyph: '葬' }),
    info(c) {
      const p = NC(), q = DATA.classes.necro.q, rk = c.run ? necK() : 1, k = (1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0)) * rk;
      const max = p.max + (c.lvFx.soulMax || 0) + c.cuV('trait', 'herd'), pow = p.pow * (1 + c.cuV('trait', 'fang') + (c.lvFx.soulPow || 0)) * rk, itv = p.every, decay = p.reiDecay * (1 - c.cuV('trait', 'haste'));
      return [
        { key: '特性', name: '死霊使役', cat: 'trait', desc: [
          `敵を倒すと、その敵が死霊になって従う(+1。エリートは +${p.eliteN}、ボスは上限まで)`,
          `死霊は周りを漂い、それぞれ ${p.every}秒ごとに近く(半径 ${p.range})の敵へ飛びかかる(基礎威力 ${p.pow}。なるべく別の敵を狙う)`,
          '死霊が減るのは、身代わりと葬送で使ったときだけ',
          `上限のときに得た死霊は霊力になる(1秒に ${p.reiDecay} ずつ減る)。霊力 1 につき、死霊の攻撃(噛みつき・百鬼夜行・報い)と葬送の威力 +${(p.reiK * 100).toFixed(1)}%`,
        ], rows: [
          ['死霊', c.run ? `<b>${P.souls.length}</b> / ${max} 体` : `上限 <b>${max}</b> 体`],
          ['霊力', c.run ? `<b>${Math.floor(P.rei)}</b>(+${((rk - 1) * 100).toFixed(1)}%)` : `上限のときに得た死霊 1体につき +${(p.reiK * 100).toFixed(1)}%`, `1秒に ${+decay.toFixed(2)} ずつ減る`],
          ['1回の威力', `${Math.round(pow)} → <b>${Math.round(pow * c.atkMul)}</b>`, '霊力・攻撃力を掛けた値'],
          ['攻撃の間隔', `<b>${itv.toFixed(2)}</b> 秒(1体ごと)`],
        ] },
        { key: 'パッシブ', name: '死者の盾', cat: 'passive', desc: [
          `被弾したとき、死霊を ${p.guardN}体 使って(少ないときはいるだけ)、そのダメージを ${Math.round(p.guard * 100)}% 減らす(死霊がいないときは減らない)。霊力は減らない`,
        ], rows: [
          ['身代わりの軽減', `<b>${Math.round(c.cuV('passive', 'ward', p.guard) * 100)}%</b>`],
        ] },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → 死霊を全て解き放つ。1体につき霊弾 1発(最低 ${q.minShots}発)`,
          `霊弾は照準方向へ飛び出し、近くの敵を追って触れると爆ぜる(基礎威力 ${q.pow}、半径 ${q.r})`,
          '解き放った死霊は戻らない。威力は霊力で上がる',
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['1発の威力', `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, '霊力・攻撃力を掛けた値'],
          ['爆発の半径', `${Math.round(q.r * (1 + c.cuV('q', 'area')) * (1 + c.st.v.area) * c.st.mul.area)}`],
        ] },
        { key: 'Space', name: '霊体化', desc: [
          `${p.phaseT}秒間 霊体になる(無敵、移動速度 +${Math.round(p.phaseSpd * 100)}%)`,
          '解けた瞬間、死霊が全員、近くの敵へ一斉に飛びかかる',
        ], rows: [
          ['スタミナ消費', `<b>${p.phaseCost - (c.lvFx.phaseCut || 0)}</b>`],
        ] },
      ];
    },
  },
  // 質量(P.mass)は敵を倒すと溜まり、攻撃力が上がって足が遅くなる。質量放出(Space)と重力崩壊(Q)で使う
  // 重力圏(半径 P.astR・遅くする割合 P.astK)の中では、敵の移動・攻撃と敵の弾がゆっくりになる(world.js の clsEnemySlow / clsProjTime / clsBossRate)
  astro: {
    skills: ['q'],
    init() { P.mass = 0; P.sings = []; P.dash = null; P.ejectHeld = false; P.tideT = 0; P.astR = 0; P.astK = 0; P.walkT = 0; },
    update(dt) {
      if (P.dash) { // 質量放出: 跳んでいる間(無敵)。最後のフレームは残りの時間だけ進める(跳ぶ距離をぴったりにする)
        const k = Math.min(dt, P.dash.t);
        P.x += P.dash.vx * k; P.y += P.dash.vy * k; P.dash.t -= dt;
        P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.05, f: P.facing }]).slice(-6);
        if (P.dash.t <= 0) P.dash = null;
      }
      const held = (keys.Space || keys.TouchDef) && !P.act;
      if (held && !P.ejectHeld && !P.dash) { if (P.sta >= astEjectCost()) astEject(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
      P.ejectHeld = held;
      const slow = astSlow();
      P.moveMul = P.dash ? 0 : 1 - slow;
      if (P.moving) P.walkT += dt * (1 - slow); // 歩きのモーション: 重いほど足取りが遅い
      astField(dt); // 重力圏
      astSings(dt); // 重力崩壊の特異点
      if (S.dimK > 0) S.dimK = Math.max(0, S.dimK - dt * 1.5);
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
      skillCall(DATA.classes.astro.q.name, '#ff7ad9'); AudioMan.click();
    },
    qUpdate(a, dt) {
      const q = DATA.classes.astro.q;
      P.moveMul = 0;
      if (a.t < q.windup) { // 構え: 周りが少し暗くなり、光の粒が両手の間へ流れ込む。照準位置に縮む輪
        S.dimK = Math.max(S.dimK || 0, 0.18 * Math.min(1, a.t / 0.15));
        asMine(() => {
          for (let n = dt * 45; Math.random() < n; n--) { const r = rand(0, TAU), d = rand(14, 28); part(P.x + P.facing * 5 + Math.cos(r) * d, P.y - 8 + Math.sin(r) * d * 0.6, -Math.cos(r) * d * 3, -Math.sin(r) * d * 1.8, 0.3, pick(AST_FX), { glow: Math.random() < 0.4, drag: 0 }); }
          if (Math.random() < dt * 20) addRing(a.x, a.y, 3, '#ff7ad9', { r0: 16, life: 0.15 });
        });
        return;
      }
      astCollapse(a);
      P.act = null;
    },
    res: () => ({ kind: 'mass', label: '質量', v: P.mass, max: astMax(), dk: '#8a2a6e' }),
    staBroken: () => false,
    statuses() {
      const out = [];
      const pc = v => String(+(v * 100).toFixed(1));
      if (P.mass >= 1) out.push({ id: 'mass', glyph: '質', name: `質量 ${Math.floor(P.mass)}`, fx: `攻撃力 +${pc(astAtk())}%・移動速度 -${pc(astSlow())}%・重力圏 ${pc(P.astK)}%`, kind: 'buff' });
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
        { key: '特性', name: '質量', cat: 'trait', desc: [
          `アイテム(経験値の宝石・コイン・肉・磁石・爆弾・宝箱)を拾うと質量が溜まる(1つにつき +${p.pickN})。時間では減らない`,
          `質量 1 につき攻撃力 +${pc(atkPer)}%、移動速度 -${pc(p.spdPer)}%(移動速度の低下は -${Math.round(p.spdCap * 100)}% まで)`,
          '減るのは質量放出(Space)と重力崩壊(Q)で使ったときだけ',
        ], rows: [
          ['質量', c.run ? `<b>${Math.floor(mass)}</b> / ${max}` : `上限 <b>${max}</b>`],
          ['攻撃力', `<b>+${pc(mass * atkPer)}%</b>`, c.run ? '今の質量' : `上限で +${pc(max * atkPer)}%`],
          ['移動速度', `<b>-${pc(slow)}%</b>`, c.run ? '今の質量' : `上限で -${pc(Math.min(p.spdCap, max * p.spdPer))}%`],
        ] },
        { key: 'パッシブ', name: '重力圏', cat: 'passive', desc: [
          `自分の周り(半径 ${Math.round(fieldR)})の敵の移動速度・攻撃速度と、敵の弾が遅くなる`,
          `遅くなる割合は 質量 1 につき ${pc(slowPer)}%(最大 ${Math.round(p.slowCap * 100)}%)。敵の移動は凍傷と掛け算で重ねる`,
        ], rows: [
          ['半径', `<b>${Math.round(fieldR)}</b>`],
          ['遅くなる割合', `<b>${pc(Math.min(p.slowCap, mass * slowPer))}%</b>`, c.run ? '今の質量' : `上限で ${pc(Math.min(p.slowCap, max * slowPer))}%`],
        ].concat(inert ? [['被ダメージ', `<b>-${pc(Math.min(p.guardCap, mass * inert))}%</b>`, `慣性: 質量 1 につき -${pc(inert)}%(最大 -${Math.round(p.guardCap * 100)}%)`]] : []) },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → 質量を全て使い、照準位置(射程 ${q.range})に特異点を生む`,
          `${q.dur}秒間、周り(半径 ${q.pullR} + 使った質量 × ${q.pullPer})の敵を中心へ引き寄せる(中心に近いほど強く。ボス以外)`,
          `最後に崩壊して、半径 ${q.r} の敵へ 基礎威力 ${q.pow} + 使った質量 × ${q.perMass}(質量 0 でも使える)`,
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['崩壊の威力', `${Math.round(qd)} → <b>${Math.round(qd * c.atkMul)}</b>`, (c.run ? '今の質量を全て使ったとき' : '質量 0 のとき') + '。攻撃力を掛けた値'],
          ['引き寄せ / 崩壊の半径', `${Math.round((q.pullR + mass * q.pullPer) * qr)} / ${Math.round(q.r * qr)}`],
        ] },
        { key: 'Space', name: '質量放出', desc: [
          `質量の ${Math.round(p.ejectPart * 100)}% を後ろへ噴き出して、移動方向へ跳ぶ(距離 ${p.ejectDist} + 使った質量 × ${p.ejectPer}。${p.ejectIfr}秒 無敵)`,
          `放出した質量は元の位置で爆ぜる(半径 ${p.ejectR}、基礎威力 ${p.ejectPow} + 使った質量 × ${p.ejectPowPer})`,
        ], rows: [
          ['スタミナ消費', `<b>${p.ejectCost - (c.lvFx.ejectCut || 0)}</b>`],
          ['跳ぶ距離', `<b>${Math.round(p.ejectDist + rel * p.ejectPer)}</b>`, c.run ? '今の質量' : '質量 0 のとき'],
          ['爆発の威力', `${Math.round(ej)} → <b>${Math.round(ej * c.atkMul)}</b>`, '攻撃力を掛けた値'],
        ] },
      ];
    },
  },
  // 怒り(P.rage)は被弾で溜まり、与えるダメージ(攻撃力とは別の倍率)になる。昂り(P.fervor = 段ごとの残り秒)は不屈で受けた被弾で重なり、攻撃力と HP回復速度が上がる
  // 狂乱(Q)で怒りを全て使って薙ぎ払い、しばらく怒りを上限のまま保つ(スタミナは 0)。不屈(Space)で攻撃を受け止めて、痛みを怒りに変える
  berserker: {
    skills: ['q'],
    init() { P.rage = 0; P.calmT = 0; P.fervor = []; P.firmT = 0; P.firmHeld = false; P.frenzy = null; },
    update(dt) {
      const p = BK(), q = DATA.classes.berserker.q;
      // 不屈(Space): 押した瞬間に発動(押し直すまで再び使わない。効いている間は重ねない)
      //   狂乱中はスタミナが 0 のまま(被弾でスタミナを得る固有効果があっても使えない)
      if (P.frenzy) P.sta = 0;
      if (P.firmT > 0) P.firmT = Math.max(0, P.firmT - dt);
      const held = (keys.Space || keys.TouchDef) && !P.act;
      if (held && !P.firmHeld && P.firmT <= 0) { if (P.sta >= bkFirmCost()) bkFirm(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
      P.firmHeld = held;
      // 昂り: 段ごとに残り時間を数える
      for (let i = P.fervor.length - 1; i >= 0; i--) if ((P.fervor[i] -= dt) <= 0) { P.fervor.splice(i, 1); S.hudDirty = true; }
      const f = P.frenzy;
      if (f) { // 狂乱: 怒りは上限のまま・スタミナは 0 で回復しない / 旋風 / 暗い赤の残像(重なって塊にならないよう 6 ドットごと)
        f.t -= dt;
        P.rage = bkRageMax(); P.sta = 0; P.staLockT = Math.max(P.staLockT, 0.1);
        if (hasSp('q', 'pow') && (f.whirl -= dt) <= 0) { f.whirl += q.whirlEvery; bkWhirl(f); }
        const la = P.after && P.after[P.after.length - 1];
        if (P.moving && (!la || d2(la.x, la.y, P.x, P.y) > 36)) P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.05, f: P.facing, col: '#7a1020' }]).slice(-5);
        if (f.t <= 0) bkFrenzyEnd();
      } else if ((P.calmT += dt) >= bkCalmT() && P.rage > 0) { // 怒り: しばらく被弾しないと減る(執念で遅くなる)
        const b = P.rage;
        P.rage = Math.max(0, P.rage - bkDecay() * dt);
        if (Math.floor(b) !== Math.floor(P.rage)) S.hudDirty = true;
      }
      // 狂乱の攻撃速度 / 血湧き肉躍る: 昂り 1段につきクールダウン -fervorCd(ステータスのクールダウンにさらに掛ける。使ったときの値で CD が決まる)
      P.atkSpd = 1 + (P.frenzy ? q.atkSpd : 0);
      P.cdMul = (1 - P.stats.v.cd) * P.stats.mul.cd * (hasSp('passive', 'zeal') ? 1 - p.fervorCd * bkFervorN() : 1);
      P.moveMul = 1;
      if (S.dimK > 0) S.dimK = Math.max(0, S.dimK - dt * 1.5);
      bkSteam(dt);
    },
    // 被弾: 怒り +rageHit。不屈中は大きく減らし、受けた痛み(減らす前)も怒りに変えて昂り +1段(極限: 通常の被弾でも昂り)
    //   憤怒の鎧(怒りが上限)は当たった時点の状態で決める。減らす順番: これらの軽減 → 防御力・ダメージ軽減 → シールド
    //   自分の技で受けるダメージ(ワイルドトマホークの代償・仁王立ち)もここを通る(selfHurt)
    onHurt(dmg) {
      const p = BK();
      let k = 1, rage = bkRageHit();
      if (hasSp('trait', 'fury') && bkFull()) k *= 1 - p.armorCut; // 憤怒の鎧
      if (P.firmT > 0) {
        k *= 1 - p.firmDr; rage += dmg * p.firmRage;
        bkFervorAdd(1);
        asMine(() => { addRing(P.x, P.y - 2, 12, '#7a1418', { w: 2, life: 0.25 }); burst(P.x, P.y - 4, 10, BK_FX, { sp: 70, glow: true, life: 0.3 }); });
      } else if (cuLv('passive', 'edge')) bkFervorAdd(cuV('passive', 'edge'));
      bkRageAdd(rage);
      P.calmT = 0;
      return dmg * k;
    },
    onMainHit() {},
    onKill() { if (hasSp('trait', 'pain')) bkRageAdd(BK().bloodN); bkBloom(); },     // 返り血 / 狂い咲き
    onBossKill() { if (hasSp('trait', 'pain')) bkRageAdd(BK().bloodN); bkBloom(); },
    atkBonus: () => bkFervorN() * BK().fervorAtk * bkFervorK(),                                                     // 昂り
    dmgDealt: () => 1 + (P.rage || 0) * BK().dmgPer + (P.frenzy ? DATA.classes.berserker.q.dmg : 0),               // 怒り・狂乱(与えるダメージ)
    regen: () => bkFervorN() * BK().fervorRegen * bkFervorK() + (P.frenzy ? DATA.classes.berserker.q.regen : 0) + (hasSp('trait', 'grudge') ? P.rage * BK().burnK : 0), // 昂り・狂乱・焼灼
    slowImmune: () => P.firmT > 0,                                                                                    // 不屈
    // 不死の狂乱: 狂乱中に倒れるダメージを受けても HP 1 で耐える(1回の狂乱で1回)。耐えた後 undyingT 秒 無敵になり、炎上も消える
    saveLethal() {
      const f = P.frenzy, q = DATA.classes.berserker.q;
      if (!f || f.saved || !hasSp('q', 'cd')) return false;
      f.saved = true; P.burnT = 0;
      P.invT = Math.max(P.invT, q.undyingT); P.ifr = Math.max(P.ifr, q.undyingT);
      UI.announce('不死の狂乱', '');
      asMine(() => {
        addRing(P.x, P.y, 40, '#7a1418', { w: 3, life: 0.5 }); addFlash(P.x, P.y, 90, '#3a0610', 0.35);
        burst(P.x, P.y, 30, BK_FX, { sp: 120, up: 30, life: 0.6 }); shockAt(P.x, P.y, 1.2, 1);
      });
      slowmo(0.3, 0.5); AudioMan.warcry();
      return true;
    },
    // 自分の技で受けるダメージ(ワイルドトマホークの代償・仁王立ち)も被弾として扱う(怒り・昂り。不屈・憤怒の鎧の軽減も効く)。HP が 2 未満で払えないときは被弾にしない
    selfHurt: n => (P.hp >= 2 ? CLASS_RT.berserker.onHurt(n) : n),
    // 仁王立ち: E・Q を使うと 最大HP × selfHit のダメージを受ける。E・Q の威力 +selfPow(E はクラスの E 倍率で、Q は薙ぎ払いに掛ける)
    onSkill(slot) { if (slot === 'e' && hasSp('passive', 'field')) selfHurt(P.maxhp * BK().selfHit); }, // E を使った(Q は qStart で)
    eMul: () => (hasSp('passive', 'field') ? 1 + BK().selfPow : 1),
    qStart() {
      if (hasSp('passive', 'field')) selfHurt(P.maxhp * BK().selfHit); // 仁王立ち: 押した瞬間に受ける(得た怒りも薙ぎ払いに乗る)
      P.act = { slot: 'q', ph: 'wind', t: 0 };
      playAnim('zRoar', MOTIONS.zRoar.dur);
      skillCall(DATA.classes.berserker.q.name, '#b8402a'); AudioMan.click();
    },
    qUpdate(a, dt) {
      const q = DATA.classes.berserker.q;
      P.moveMul = 0;
      if (a.t < q.windup) { // 構え: 両手で斧を振りかぶる。周りが少し暗くなり、赤黒い闘気が集まる
        S.dimK = Math.max(S.dimK || 0, 0.15 * Math.min(1, a.t / 0.12));
        asMine(() => { for (let n = dt * 50; Math.random() < n; n--) { const r = rand(0, TAU), d = rand(14, 26); part(P.x + Math.cos(r) * d, P.y - 4 + Math.sin(r) * d * 0.6, -Math.cos(r) * d * 3, -Math.sin(r) * d * 2, 0.3, pick(BK_FX), { glow: Math.random() < 0.3, drag: 0 }); } });
        return;
      }
      bkFrenzy();
      P.act = null;
    },
    res: () => ({ kind: 'rage', label: '怒り', v: P.rage, max: bkRageMax(), dk: '#5a0a14', pulse: '#a01828' }),
    staBroken: () => false,
    statuses() {
      const out = [], p = BK(), q = DATA.classes.berserker.q, fk = bkFervorK(), pc = v => String(+(v * 100).toFixed(1));
      if (P.rage >= 1) out.push({ id: 'rage', glyph: '怒', name: `怒り ${Math.floor(P.rage)}`, fx: `与えるダメージ +${pc(P.rage * p.dmgPer)}%` + (hasSp('trait', 'fury') && bkFull() ? `・被ダメージ -${Math.round(p.armorCut * 100)}%(憤怒の鎧)` : '') + (hasSp('trait', 'grudge') ? `・HP回復速度 +${+(P.rage * p.burnK).toFixed(2)}/s(焼灼)` : ''), kind: 'buff' });
      // 昂り: 段の数をまとめて 1つ(残り時間の表示は一番長く残る段。段ごとの残りは説明に)。死に物狂いの間は時間なしで最大
      const n = bkFervorN(), des = bkDesperate();
      if (n > 0) {
        const left = P.fervor.slice().sort((a, b) => b - a).map(v => v.toFixed(1));
        out.push({ id: 'fervor', glyph: '昂', name: `昂り ${n}段` + (des ? '(死に物狂い)' : ''), kind: 'buff', max: bkFervorT(), t: des ? undefined : Math.max(...P.fervor),
          fx: `攻撃力 +${pc(n * p.fervorAtk * fk)}%・HP回復速度 +${+(n * p.fervorRegen * fk).toFixed(2)}/s` + (hasSp('passive', 'zeal') ? `・クールダウン -${pc(n * p.fervorCd)}%` : '')
            + (des ? `(HP ${Math.round(p.desperateAt * 100)}% 以下の間は常に最大)` : `(段ごとの残り ${left.join(' / ')}秒)`) });
      }
      if (P.firmT > 0) out.push({ id: 'firm', glyph: '屈', name: '不屈', fx: `被ダメージ -${Math.round(p.firmDr * 100)}%・減速を受けない`, t: P.firmT, max: p.firmT, kind: 'buff' });
      if (P.frenzy) out.push({ id: 'frenzy', glyph: '狂', name: '狂乱', fx: `怒りが上限のまま・与えるダメージ +${Math.round(q.dmg * 100)}%・攻撃速度 +${Math.round(q.atkSpd * 100)}%・HP回復速度 +${q.regen}/s・スタミナ 0`
        + (hasSp('q', 'cd') ? (P.frenzy.saved ? '・不死の狂乱は使用済み' : '・倒れるダメージを 1回 HP 1 で耐える') : ''), t: P.frenzy.t, max: P.frenzy.max, kind: 'buff' });
      return out;
    },
    qInfo: () => ({ name: DATA.classes.berserker.q.name, glyph: '狂' }),
    info(c) {
      const p = BK(), q = DATA.classes.berserker.q, pc = v => String(+(v * 100).toFixed(1));
      const max = p.rageMax + c.cuV('trait', 'fury'), hitN = c.cuV('trait', 'pain', p.rageHit), calm = p.calmT + (c.lvFx.calmT || 0), decay = p.decay * (1 - c.cuV('trait', 'grudge')), rage = c.run ? P.rage : 0;
      const fk = 1 + c.cuV('passive', 'zeal'), fT = p.fervorT + c.cuV('passive', 'field') + (c.lvFx.fervorT || 0), edge = c.cuV('passive', 'edge');
      const k = (1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0)) * (c.hasSp('passive', 'field') ? 1 + p.selfPow : 1), qd = (q.pow + rage * q.perRage) * k, dur = Math.min(q.durMax, q.dur + rage * q.durPer) + c.cuV('q', 'dur'); // 仁王立ち: 威力 +selfPow
      return [
        { key: '特性', name: '怒り', cat: 'trait', desc: [
          `被弾すると 怒り +${p.rageHit}(上限 ${p.rageMax})`,
          `怒り 1 につき 与えるダメージ +${pc(p.dmgPer)}%(攻撃力とは別の倍率で、掛け算で効く)`,
          `${p.calmT}秒間 被弾しないと、1秒に ${p.decay} ずつ減る`,
        ], rows: [
          ['怒り', c.run ? `<b>${Math.floor(rage)}</b> / ${max}` : `上限 <b>${max}</b>`],
          ['与えるダメージ', `<b>+${pc(rage * p.dmgPer)}%</b>`, c.run ? '今の怒り' : `上限で +${pc(max * p.dmgPer)}%`],
          ['被弾で得る怒り', `<b>+${hitN}</b>`],
          ['減り始めるまで', `${calm} 秒`],
          ['減る速さ', `1秒に <b>${+decay.toFixed(1)}</b>`],
        ] },
        { key: 'パッシブ', name: '昂り', cat: 'passive', desc: [
          `不屈の間に被弾すると ${p.fervorT}秒間、HP回復速度 +${p.fervorRegen}/s・攻撃力 +${Math.round(p.fervorAtk * 100)}%(最大 ${p.fervorMax}段。段ごとに別々に数える)`,
          '攻撃力は与えるダメージ(怒り)とは別の倍率なので、掛け算で伸びる',
        ], rows: [
          ['昂り', c.run ? `<b>${bkFervorN()}</b> / ${p.fervorMax} 段` : `最大 <b>${p.fervorMax}</b> 段`],
          ['1段の効果', `攻撃力 +${pc(p.fervorAtk * fk)}%・HP回復速度 +${+(p.fervorRegen * fk).toFixed(2)}/s`],
          ['時間', `${fT} 秒`],
        ].concat(edge ? [['通常の被弾', `昂り +${edge}段`, '極限']] : []) },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → 怒りを全て使い、雄叫びとともに周り(半径 ${q.r})を薙ぎ払う(基礎威力 ${q.pow} + 使った怒り × ${q.perRage})`,
          `そのあと狂乱(${q.dur}秒 + 使った怒り × ${q.durPer}秒。最大 ${q.durMax}秒): 怒りは上限のまま減らない、与えるダメージ +${Math.round(q.dmg * 100)}%、攻撃速度 +${Math.round(q.atkSpd * 100)}%、HP回復速度 +${q.regen}/s`,
          '  → そのかわりスタミナが 0 になり、回復しなくなる。終わると怒りは 0 から溜め直し',
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['薙ぎ払いの威力', `${Math.round(qd)} → <b>${Math.round(qd * c.atkMul)}</b>`, (c.run ? '今の怒りを全て使ったとき' : '怒り 0 のとき') + '。攻撃力を掛けた値'],
          ['狂乱の持続', `<b>${+dur.toFixed(1)}</b> 秒`, c.run ? '今の怒りを全て使ったとき' : '怒り 0 のとき'],
          ['半径', `${Math.round(q.r * (1 + c.st.v.area) * c.st.mul.area)}`],
        ] },
        { key: 'Space', name: '不屈', desc: [
          `${p.firmT}秒間、被ダメージ -${Math.round(p.firmDr * 100)}%、減速(粘液・スロウタイム)を受けない。動ける`,
          `受けたダメージ(減らす前)10 につき 怒り +${+(p.firmRage * 10).toFixed(1)}(被弾の怒りとは別)`,
          '不屈の間の被弾で 昂り +1段',
        ], rows: [
          ['スタミナ消費', `<b>${p.firmCost - (c.lvFx.firmCut || 0)}</b>`],
        ] },
      ];
    },
  },
  // 専用武器を持たない。武芸百般(持っている武器の数で攻撃力・クールダウン・最大HP)と影の追撃(数秒ごとに武器のどれかがもう一度攻撃する)
  // 武神降臨(Q): 分身(P.wmClone)が、持っている武器の武器スキルをランダムに使う。残像(Space): 跳んだ直後にメイン武器がもう一度攻撃する
  weaponmaster: {
    skills: ['q'],
    init() { P.dash = null; P.dashHeld = false; P.wmShadeT = 0; P.shades = []; P.wmClone = null; P.wmCut = 0; P.wmKey = ''; },
    update(dt) {
      if (P.dash) { // 残像: 跳んでいる間(無敵)。最後のフレームは残りの時間だけ進める(跳ぶ距離をぴったりにする)
        const k = Math.min(dt, P.dash.t);
        P.x += P.dash.vx * k; P.y += P.dash.vy * k; P.dash.t -= dt;
        P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0.12, f: P.facing, col: '#4a2e16' }]).slice(-4); // 跳んだ跡(暗い銅。明るいと光で塊に見える)
        if (P.dash.t <= 0) { P.dash = null; wmAgain(); } // 跳んだ直後: メイン武器がもう一度攻撃する
      }
      const held = (keys.Space || keys.TouchDef) && !P.act;
      if (held && !P.dashHeld && !P.dash) { if (P.sta >= wmDashCost()) wmDash(); else addFloat(P.x, P.y - 16, 'STAMINA', '#6a7a88'); }
      P.dashHeld = held;
      P.moveMul = P.dash ? 0 : 1;
      // 武芸百般: スタック・頑健が変わったら最大HP を計算し直す(applyStats が hpAdd を読む)
      const key = wmStack() + ':' + cuLv('trait', 'tough');
      if (key !== P.wmKey) { P.wmKey = key; recalc(); }
      // 器用: スタック 1つにつきクールダウン -(パスの値)(ステータスのクールダウンにさらに掛ける)
      P.cdMul = (1 - P.stats.v.cd) * P.stats.mul.cd * (1 - Math.min(0.5, wmStack() * cuV('trait', 'deft')));
      wmShadeTick(dt);
      wmCloneTick(dt);
    },
    onHurt: dmg => (hasSp('trait', 'tough') && wmFull() ? dmg * (1 - WM().steadyDr) : dmg), // 不動
    onMainHit() {},
    onKill(e, o) { if (o && o.cl) wmQuick(); }, // 間髪: 分身の武器スキルで倒した
    atkBonus: () => wmStack() * cuV('trait', 'train', WM().stackAtk),
    hpAdd: () => Math.round(wmStack() * cuV('trait', 'tough')), // 頑健
    onSkill(slot) { if (slot === 'e' && hasSp('trait', 'deft')) wmHaste(); }, // 早業: E を使うと全ての武器がすぐに攻撃する
    qStart() { // スキル名は分身が出たときに、使う武器スキルと一緒に出す(wmSummon)
      P.act = { slot: 'q', ph: 'wind', t: 0 };
      playAnim('wmSeal', MOTIONS.wmSeal.dur);
      AudioMan.click();
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
    res: () => ({ kind: 'arms', label: '武器', v: Object.keys(P.weapons).length, max: S.weaponSlots, seg: true, dk: '#7a4a22', pulse: '#e0a060' }),
    staBroken: () => false,
    statuses() {
      const out = [], p = WM(), n = wmStack(), pc = v => String(+(v * 100).toFixed(1));
      const atk = n * cuV('trait', 'train', p.stackAtk), deft = Math.min(0.5, n * cuV('trait', 'deft')), hp = Math.round(n * cuV('trait', 'tough')), steady = hasSp('trait', 'tough') && wmFull();
      out.push({ id: 'wmArts', glyph: '武', name: `武芸百般 ${+n.toFixed(1)}`, kind: 'buff',
        fx: `攻撃力 +${pc(atk)}%` + (deft ? `・クールダウン -${pc(deft)}%` : '') + (hp ? `・最大HP +${hp}` : '') + (steady ? `・被ダメージ -${Math.round(p.steadyDr * 100)}%(不動)` : '') });
      const every = wmShadeEvery(), left = Math.max(0, every - P.wmShadeT);
      out.push({ id: 'wmShade', glyph: '影', name: '影の追撃', fx: `${+every.toFixed(1)}秒ごとに、持っている武器(メイン武器も)のどれかがもう一度攻撃する(次まで ${left.toFixed(1)}秒)`, t: left, max: every, kind: 'buff' });
      const c = P.wmClone;
      if (c) out.push({ id: 'wmClone', glyph: '神', name: DATA.classes.weaponmaster.q.name, kind: 'buff', t: c.stay ? Math.max(0, c.stay - c.t) : undefined, max: c.stay || undefined,
        fx: `分身が武器スキルを使う(残り ${c.list.length - c.i}つ)` + (c.stay ? `・化身: 使った武器 ${c.used.length}種の通常攻撃` : '') });
      return out;
    },
    qInfo: () => ({ name: DATA.classes.weaponmaster.q.name, glyph: '神' }),
    info(c) {
      const p = WM(), q = DATA.classes.weaponmaster.q, pc = v => String(+(v * 100).toFixed(1)), ar = (1 + c.st.v.area) * c.st.mul.area;
      const owned = c.run ? Object.keys(P.weapons).length : 1, n = c.run ? wmStack() : 1 + (c.lvFx.stack || 0), slots = c.run ? S.weaponSlots : c.st.v.wslot;
      const per = c.cuV('trait', 'train', p.stackAtk), deft = c.cuV('trait', 'deft'), tough = c.cuV('trait', 'tough'), evo = c.hasSp('trait', 'train') ? 1 : p.evoK;
      const every = p.shadeT - c.cuV('passive', 'freq') - (c.lvFx.shadeCut || 0), sp = 1 + c.cuV('passive', 'pow') + (c.lvFx.shadePow || 0), edge = c.cuV('passive', 'edge');
      const qn = q.n + c.cuV('q', 'multi') + (c.lvFx.qN || 0), lvA = c.run ? cuLv('q', 'art') : 0, qk = 1 + c.cuV('q', 'art') + (c.lvFx.qPow || 0);
      return [
        { key: '特性', name: '武芸百般', cat: 'trait', desc: [
          `持っている武器 1つにつき 攻撃力 +${pc(p.stackAtk)}%(メイン武器もサブ武器も数える)`,
          `進化した武器は 効果 +${Math.round(p.evoK * 100)}%(1つで ${1 + p.evoK}つ分)`,
        ].concat(c.lvFx.stack ? [`クラスLv3: 常に +${c.lvFx.stack}つ分`] : []), rows: [
          ['武芸百般', `<b>${+n.toFixed(1)}</b> つ分`, c.run ? `武器 ${owned} / ${slots}。進化した武器は ${1 + evo}つ分` : 'ラン開始時(メイン武器 1つ)'],
          ['攻撃力', `<b>+${pc(n * per)}%</b>`, `1つにつき +${pc(per)}%`],
        ].concat(deft ? [['クールダウン', `<b>-${pc(Math.min(0.5, n * deft))}%</b>`, `器用: 1つにつき -${pc(deft)}%`]] : [])
          .concat(tough ? [['最大HP', `<b>+${Math.round(n * tough)}</b>`, `頑健: 1つにつき +${tough}`]] : []) },
        { key: 'パッシブ', name: '影の追撃', cat: 'passive', desc: [
          `${p.shadeT}秒ごとに、持っている武器(メイン武器も)のどれか 1つを影がまねて、その武器がすぐにもう一度攻撃する(威力は通常攻撃と同じ)`,
          '影は自分の横に現れ、攻撃はそこから出る',
        ], rows: [
          ['間隔', `<b>${+every.toFixed(1)}</b> 秒`],
          ['まねた攻撃の威力', `<b>${Math.round(sp * (c.hasSp('passive', 'freq') ? 1 - p.twinCut : 1) * 100)}%</b>` + (c.hasSp('passive', 'freq') ? ' × 2体' : ''), '通常攻撃の威力に対して'],
        ].concat(edge ? [['影刃の威力', `${edge} → <b>${Math.round(edge * c.atkMul)}</b>`, `半径 ${Math.round(p.edgeR * ar)}。攻撃力を掛けた値`]] : []) },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒 → 自分の隣に分身をつくる。分身は持っている武器の武器スキルをランダムに ${q.n}種(重複なし)使う`,
          `分身は ${q.gap}秒おきに 1つずつ使う。自分はすぐに動ける。分身は狙われず、ダメージも受けない`,
          '威力はその武器の今の値(Lv・進化・熟練)。メイン武器の E の強化も効く',
          '武器スキルの自分への効果(シールド・回復など)は自分に入る。ワイルドトマホークの代償は払わない',
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['武器スキル', `<b>${qn}</b> 種`, c.run ? `今は ${Math.min(qn, owned)} 種(持っている武器の数まで)` : '持っている武器の数まで'],
          ['威力', `<b>${Math.round(qk * 100)}%</b>`, '武器スキルの威力に対して(練度・クラスLv)'],
        ].concat(lvA ? [['範囲 / 射程', `+${Math.round(q.artArea[lvA - 1] * 100)}% / +${Math.round(q.artRange[lvA - 1] * 100)}%`, '練度']] : []) },
        { key: 'Space', name: '残像', desc: [
          `移動方向へ ${p.dashDist} 跳ぶ(${p.dashTime}秒。${p.dashIfr}秒 無敵)。元の位置に残像が残る`,
          '跳んだ直後、メイン武器がすぐにもう一度攻撃する',
        ], rows: [
          ['スタミナ消費', `<b>${wmDashCostOf(c.lvFx)}</b>`],
        ] },
      ];
    },
  },
};

// 居合の斬撃: 通過した敵にまとめてダメージ(切っ先が走り終えた少しあとに、一閃の演出と同時に炸裂する)
function iaiStrike(a) {
  const q = DATA.classes.samurai.q, full = a.ki >= DATA.classes.samurai.params.kiFull, ittou = hasSp('q', 'pow') && full;
  const dmg = (q.pow + a.ki * q.kiPow) * (1 + cuV('q', 'pow') + (P.lvFx.qPow || 0)) * (a.back ? 0.6 : 1) * (ittou ? 1.5 : 1);
  const x0 = a.x0, y0 = a.y0, x1 = P.x, y1 = P.y, hits = [...a.hits], ca = Math.cos(a.a), sa = Math.sin(a.a);
  const onHit = () => {
    if (state !== 'play' && state !== 'levelup') return;
    asMine(() => {
      let marks = 0;
      for (const e of hits) if (!e.dead) {
        hitEnemy(e, dmg, { src: 'iai', ang: a.a, kb: 120, col: '#ff3b5c' });
        if (ittou) addBleed(e, 10); // 一刀両断: 出血 10スタック
        if (marks++ < 8) slashes.push({ mark: true, x: e.x - ca * 8, y: e.y - sa * 8, x1: e.x + ca * 8, y1: e.y + sa * 8, t: 0, life: 0.16 }); // 敵の上の細い斬り跡
        for (let i = 0; i < 8; i++) { // 血しぶき(線の両側へ)
          const k = i % 2 ? 1 : -1, sp = rand(40, 120);
          part(e.x, e.y, -sa * k * sp + ca * rand(-30, 30), ca * k * sp + sa * rand(-30, 30) - 20, rand(0.3, 0.6), pick(['#a0122a', '#5a0a14', '#ff3b5c']), { g: 220, drag: 2, sz: pick([1, 2]) });
        }
        burst(e.x, e.y, 6, ['#ff3b5c', '#ffffff'], { sp: 100, glow: true, life: 0.35 });
      }
      for (let i = 0; i < (full ? 30 : 18); i++) { // 墨のような飛沫(線全体から)
        const u = Math.random(), k = Math.random() < 0.5 ? -1 : 1, sp = rand(20, 100);
        part(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, -sa * k * sp, ca * k * sp - 10, rand(0.4, 0.8), pick(['#1a0508', '#1a0508', '#a0122a', '#ff3b5c', '#ffd0d8']), { g: 140, drag: 2.5, sz: pick([1, 1, 2]), glow: Math.random() < 0.3 });
      }
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      hitstop(0.08); shake(full ? 10 : 7); screenFlash((full ? 0.3 : 0.2) * SET.fxA, full ? '#ff3b5c' : '#ffffff');
      shockAt(mx, my, full ? 1.8 : 1.3, 1); addFlash(mx, my, 120, full ? '#ff3b5c' : '#ffffff', 0.4);
      if (full) addRing(mx, my, 70, '#ff3b5c', { w: 3, life: 0.45 });
    });
    AudioMan.cutHit(); AudioMan.crit();
  };
  a.cut.onHit = onHit; // 炸裂の時刻は一閃(makeCut の late)が決める。すでに過ぎていたらすぐ
  if (a.cut.hitDue) onHit();
  // CD(連環: 消費した剣気1につき 0.1秒短縮)
  if (!a.back) {
    const base = q.cd * (1 - cuV('q', 'cd')) * P.cdMul;
    setCd('q', hasSp('trait', 'zan') ? Math.max(3, base - a.ki * 0.1) : base);
  }
}

// 背水: HP 75% 以下で残心の効果が2倍
const zanshinK = () => (hasSp('passive', 'kihaku') && P.hp <= P.maxhp * 0.75 ? 2 : 1);
// 剣気100以上(攻撃力アップ・明鏡止水・一刀両断の条件)
const kiHigh = () => P.ki >= DATA.classes.samurai.params.kiFull;
// 剣気を得る(練気で獲得量アップ。flat = 倍率をかけない)
function kiAdd(n, flat) {
  const was = P.ki;
  P.ki = Math.min(P.kiMax, P.ki + (flat ? n : n * (1 + cuV('trait', 'ren') + (P.lvFx.kiGain || 0))));
  const full = DATA.classes.samurai.params.kiFull;
  if ((was < full && P.ki >= full) || (was < P.kiMax && P.ki >= P.kiMax)) { // 100 に届いた瞬間 / 最大値に届いた瞬間
    AudioMan.levelup(); addRing(P.x, P.y, 30, '#ff3b5c', { w: 2, life: 0.4 });
    burst(P.x, P.y, 16, ['#ff3b5c', '#ffd0d8'], { sp: 60, up: 30, glow: true });
  }
}

// ジャスト見切り: スタミナを使わず、剣気を得て周囲に反撃。押している間はガードを続ける(無敵が切れた後は通常のガード)
function samuraiParry() {
  const c = DATA.classes.samurai.params;
  kiAdd(c.kiParry);
  P.ifr = c.parryIfr;
  asMine(() => {
    const R = c.parryR * P.area;
    forEachNear(P.x, P.y, R, e => { if (!e.prop) hitEnemy(e, c.parryPow, { src: 'parry', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 80, col: '#ffffff' }); });
    slashes.push({ x: P.x, y: P.y, follow: true, a: rand(0, TAU), r: R, t: 0, life: 0.25, full: true, pal: SWING_PAL.parry }); // 全周を一回転で斬る(見た目 = 反撃の範囲)
    hitstop(0.06); shake(5); screenFlash(0.25 * SET.fxA, '#ffffff'); shockAt(P.x, P.y, 1, 1.2);
    addRing(P.x, P.y, R, '#ffffff', { w: 2, life: 0.3 });
    burst(P.x, P.y, 24, ['#ffffff', '#9ff7ff', '#ff3b5c'], { sp: 120, glow: true, life: 0.35 });
  });
  addFloat(P.x, P.y - 16, '見切り!', '#9ff7ff', 1.2);
  AudioMan.slash(); AudioMan.crit();
}

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
// 属性を付与して、3属性そろったら共鳴。depth: 連鎖共鳴の深さ(無限に続かないように)
function mageAddEl(e, el, dealt, depth = 0) {
  if (e.prop) return;
  const list = el === 'all' ? ELS : [el];
  for (const x of list) elEffect(e, x, dealt);
  const bits = e.els || 0;
  if (el === 'all' || (bitCount(bits) === 2 && !(bits & EL_BIT[el]))) mageResonate(e, depth);
  else e.els = bits | EL_BIT[el];
}
function mageResonate(e, depth) {
  const p = MG(), R = p.resoR * P.area, dmg = p.resoPow * (1 + cuV('trait', 'rpow') + (P.lvFx.resoPow || 0));
  e.els = 0;
  const x = e.x, y = e.y, spread = hasSp('trait', 'rpow') && depth < 1;
  asMine(() => {
    forEachNear(x, y, R, o => {
      if (o.prop) return;
      hitEnemy(o, dmg, { src: 'reso', ang: Math.atan2(o.y - y, o.x - x), kb: 40, col: '#c78bff', noNum: o !== e });
      if (spread && o !== e && !o.dead) mageAddEl(o, pick(ELS), 0, depth + 1); // 連鎖共鳴
    });
    addRing(x, y, R, '#c78bff', { w: 2, life: 0.3 }); addRing(x, y, R * 0.55, '#ffffff', { life: 0.2 });
    addFlash(x, y, R * 2.4, '#c78bff', 0.3);
    burst(x, y, 16, ['#ff8a3d', '#9ff7ff', '#ffe14a', '#ffffff'], { sp: 110, glow: true, life: 0.4 });
    shake(1.5);
  });
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
  playAnim('mMeteor', MOTIONS.mMeteor.dur);
  if (t.x !== P.x) P.facing = t.x < P.x ? -1 : 1;
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  skillCall(q.name + (n ? ` ×${n}` : ''), '#ff8a3d'); AudioMan.click();
  for (let i = 0; i < n * 4; i++) part(P.x + rand(-24, 24), P.y + rand(-24, 24), 0, 0, 0.5, '#9ff7ff', { glow: true, sz: 2, drag: 0 }); // 結晶が手元に集まる
}
function meteorUpdate(a, dt) {
  const q = DATA.classes.mage.q, u = Math.min(1, a.t / q.windup);
  P.moveMul = 0;
  // 魔法陣: 照準位置に広がる円と、周りを回る光
  asMine(() => {
    if (Math.random() < dt * 30) addRing(a.x, a.y, a.R * u, '#ff8a3d', { r0: a.R * u - 1, life: 0.08, w: 2 });
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
      for (let k = 0; k < (m.main ? 6 : 2); k++) part(mx + rand(-3, 3) * m.big, my + rand(-3, 3) * m.big, rand(-20, 20), rand(-40, -10), 0.45, pick(['#ffc34a', '#ff6a2a', '#fff6c8', '#6a4040']), { glow: true, sz: m.main ? 3 : 2 });
      if (m.main && Math.random() < dt * 30) addRing(m.x, m.y, m.R, '#ff3b1a', { r0: m.R - 1, life: 0.06 });
    });
    if (u < 1) continue;
    P.meteors.splice(i, 1);
    meteorImpact(m);
  }
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
      shockAt(m.x, m.y, 2.2, 1); shake(12); hitstop(0.08); screenFlash(0.35 * SET.fxA, '#ff8a3d');
    } else shake(3);
  });
  AudioMan.boom();
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
    for (let i = 0; i < 6; i++) setTimeout(() => {
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
  if (hasSp('q', 'area')) zones.push({ kind: 'blizz', x: m.x, y: m.y, r: R, r0: R, t: 0, dur: 4, tick: 0, dmg: 0, maxFrost: true }); // 絶対零度
}

function mageBlink() {
  const p = MG(), d = P.dir && P.moving ? P.dir : [P.facing, 0], len = Math.hypot(d[0], d[1]) || 1;
  const x0 = P.x, y0 = P.y, dx = d[0] / len, dy = d[1] / len;
  staUse(blinkCost());
  P.x += dx * p.blinkDist; P.y += dy * p.blinkDist;
  P.invT = Math.max(P.invT, p.blinkIfr); P.ifr = Math.max(P.ifr, p.blinkIfr);
  zones.push({ kind: 'residue', x: x0, y: y0, r: p.residueR * P.area, t: 0, dur: p.residueT, tick: 0 });
  playAnim('mBlink', MOTIONS.mBlink.dur); P.anim.keep = true;
  for (let i = 1; i <= 4; i++) P.after = (P.after || []).concat([{ x: x0 + dx * p.blinkDist * i / 5, y: y0 + dy * p.blinkDist * i / 5, t: 0, f: P.facing }]).slice(-6);
  burst(x0, y0, 14, ['#9ff7ff', '#ffffff', '#7ad7ff'], { sp: 70, glow: true, life: 0.35 });
  burst(P.x, P.y, 10, ['#9ff7ff', '#ffffff'], { sp: 50, glow: true, life: 0.3 });
  addRing(P.x, P.y, 14, '#9ff7ff', { life: 0.2 });
  AudioMan.dash();
}

// ---------- アーチャー: 狩人の印・集中・一斉射撃・バックステップ ----------
const AR = () => DATA.classes.archer.params;
const markMax = () => AR().markMax + cuV('trait', 'carve');
const markOn = e => e.mark > 0 && S.time < e.markT;
const weakOn = e => S.time < (e.weakT || 0);
// 印を刻む。上限(基本の markMax)に届いたら弱点露出
function addMark(e, n) {
  if (e.prop || e.dead) return;
  const p = AR();
  if (!markOn(e)) e.mark = 0;
  e.mark = Math.min(markMax(), e.mark + n);
  e.markT = S.time + p.markT + cuV('trait', 'deep');
  if (e.mark >= p.markMax && !weakOn(e)) {
    e.weakT = S.time + p.weakT;
    addRing(e.x, e.y, e.r + 8, '#ff5d73', { w: 1, life: 0.35 }); part(e.x, e.y - e.r - 4, 0, -20, 0.5, '#ff5d73', { glow: true, sz: 2 });
  }
}
const focusMax = () => AR().focusMax + (P.lvFx.focusMax || 0);
const focusN = () => Math.floor(P.focus || 0);
const backCost = () => AR().backCost - (P.lvFx.backCut || 0);
function archerBackstep() {
  const p = AR(), d = P.moving && P.dir ? [-P.dir[0], -P.dir[1]] : [-P.facing, 0], len = Math.hypot(d[0], d[1]) || 1;
  staUse(backCost());
  P.dash = { vx: d[0] / len * p.backDist / p.backTime, vy: d[1] / len * p.backDist / p.backTime, t: p.backTime };
  P.invT = Math.max(P.invT, p.backIfr);
  if (hasSp('passive', 'hold')) P.focus = Math.min(focusMax(), (P.focus || 0) + 2); // 狩りの構え
  playAnim('aStep', MOTIONS.aStep.dur); P.anim.keep = true;
  burst(P.x, P.y + 6, 10, ['#8a8098', '#b8ff9a'], { sp: 50, up: 10, life: 0.35 });
  AudioMan.dash();
}
// 一斉射撃: 画面内の印を持つ敵1体につき1本、その敵へまっすぐ高速の矢(貫通無限)
// 矢が当たった敵は、印1つにつき追加ダメージを連続で受ける(印は消費)。途中で貫いた敵も同じ
function archerVolley() {
  const q = DATA.classes.archer.q, k = 1 + cuV('q', 'pow') + (P.lvFx.qPow || 0);
  const vis = enemies.filter(e => !e.dead && !e.prop && onScreen(e.x, e.y));
  const marked = vis.filter(markOn).sort((a, b) => b.mark - a.mark);
  const others = vis.filter(e => !markOn(e)).sort((a, b) => d2(a.x, a.y, P.x, P.y) - d2(b.x, b.y, P.x, P.y));
  const shots = marked.slice();
  shots.push(...others.slice(0, q.none)); // 無条件で、最寄りの敵(印を持つ敵とは別)へも1本ずつ
  const keep = cuV('q', 'keep'), sure = hasSp('q', 'keep'), boom = hasSp('q', 'pow'), storm = hasSp('q', 'cd');
  const onHit = e => {
    if (boom) asMine(() => { // 流星
      forEachNear(e.x, e.y, q.meteorR * P.area, o => { if (!o.prop && o !== e) hitEnemy(o, q.meteorPow * k, { src: 'volley', noNum: true, col: '#b8ffb0' }); });
      addFlash(e.x, e.y, 30, '#b8ffb0', 0.15);
    });
    if (!markOn(e)) return;
    // 印を消費して、1つにつき追加ダメージを連続で。残印: 確率で印を消費せず、もう1回(上限は印の3倍)
    let n = 0;
    for (let left = e.mark; left > 0 && n < e.mark * 3; n++) if (Math.random() >= keep) left--;
    e.mark = 0;
    for (let i = 0; i < n; i++) setTimeout(() => {
      if (state !== 'play' || e.dead) return;
      asMine(() => { hitEnemy(e, q.markPow * k, { src: 'volley', col: '#b8ffb0', forceCrit: sure, noNum: i % 2 === 1 }); part(e.x + rand(-4, 4), e.y + rand(-4, 4), rand(-30, 30), rand(-30, 10), 0.25, pick(['#b8ffb0', '#ffffff']), { glow: true }); });
      if (i === n - 1 && storm && !e.dead) addMark(e, 5); // 印の嵐
    }, 60 + i * q.interval * 1000);
  };
  asMine(() => {
    shots.slice(0, q.max).forEach(tg => {
      const a = Math.atan2(tg.y - P.y, tg.x - P.x);
      fire('volley', P.x, P.y - 4, a, q.speed, { dmg: q.pow * k, pierce: 999, life: 1.2, src: 'volley', r: 4, col: '#b8ffb0', forceCrit: sure, onHit });
    });
    addRing(P.x, P.y - 4, 30, '#b8ff9a', { w: 2, life: 0.4 }); addFlash(P.x, P.y, 90, '#b8ff9a', 0.3);
    burst(P.x, P.y - 4, 30, ['#e4ffd8', '#b8ff9a', '#ffffff'], { sp: 150, glow: true, life: 0.4 });
    shockAt(P.x, P.y, 1, 1.2); shake(4); screenFlash(0.15 * SET.fxA, '#b8ff9a');
  });
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.shoot(); AudioMan.crit();
}

// ---------- ナイト: 聖盾・不屈・大盾・聖盾の審判 ----------
const KN = () => DATA.classes.knight.params;
const knCap = () => P.maxhp * (KN().capPct + cuV('trait', 'cap') + (P.lvFx.capPct || 0));
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
// 堅守: シールドの量(上限に対する割合)に比例して攻撃力アップ。盾撃: 上限の 50% 以上で 1.5倍
function knHoldAtk() {
  const cap = knCap(), f = cap > 0 ? Math.min(1, shieldTotal() / cap) : 0;
  let k = cuV('trait', 'hold', KN().holdAtk) * f;
  if (hasSp('trait', 'cap') && f >= KN().ironAt) k *= 1.5;
  return k;
}
// 不屈: シールドが割れた瞬間の衝撃波と立て直し
function knightBreak() {
  const p = KN();
  if (S.time < (P.knBreakCd || 0)) return;
  P.knBreakCd = S.time + p.breakCd;
  const pow = p.breakPow * (1 + cuV('passive', 'shock') + (P.lvFx.breakPow || 0)), R = p.breakR * P.area;
  const wave = () => asMine(() => {
    forEachNear(P.x, P.y, R, e => { if (!e.prop) hitEnemy(e, pow, { src: 'knbreak', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 150, col: '#f2c84b' }); });
    addRing(P.x, P.y, R, '#f2c84b', { w: 3, life: 0.35 }); addRing(P.x, P.y, R * 0.6, '#ffffff', { w: 2, life: 0.25 });
    addFlash(P.x, P.y, R * 2.4, '#fff1d0', 0.35); shockAt(P.x, P.y, 1.4, 1); shake(6);
    burst(P.x, P.y, 30, ['#f2c84b', '#fff1d0', '#ffffff'], { sp: 150, glow: true, life: 0.45 });
  });
  wave();
  if (hasSp('passive', 'shock')) setTimeout(() => { if (state === 'play') wave(); }, 400); // 復讐
  const inv = p.breakIfr + cuV('passive', 'rise');
  P.invT = Math.max(P.invT, inv); P.ifr = Math.max(P.ifr, inv);
  const v = cuV('passive', 'vigor');
  if (v) P.sta = Math.min(P.maxSta, P.sta + v);
  if (hasSp('passive', 'vigor')) heal(P.maxhp * 0.1); // 不死身
  if (hasSp('passive', 'rise')) setTimeout(() => { if (state === 'play') knGain(knCap() * p.rebuild); }, 3000); // 再構築
  addFloat(P.x, P.y - 18, '不屈!', '#f2c84b', 1.2);
  AudioMan.boom();
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
      if (!e.dead) e.stun = Math.max(e.stun || 0, q.stun + used * q.stunPer); // 消費したシールドが多いほど長い
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
    shockAt(cx, cy, full ? 1.8 + Math.min(1, used / 60) : 1.1 + Math.min(0.6, used / 100), 1); shake(10); hitstop(0.08); screenFlash(0.3 * SET.fxA, '#fff1d0');
  });
  if (hasSp('q', 'cd')) knGain(used * q.echo); // 残響
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.boom(); AudioMan.crit();
}

// ---------- パイロマンサー: 業火・焔纏い・煉獄・炎壁 ----------
const PY = () => DATA.classes.pyro.params;
const pyStackMax = () => PY().stackMax + cuV('trait', 'stack');
const pyStackPct = () => PY().stackPct + (P.lvFx.stackPct || 0);
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
    setTimeout(() => {
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
  P.invT = Math.max(P.invT, p.wallIfr); P.ifr = Math.max(P.ifr, p.wallIfr);
  asMine(() => {
    forEachNear(P.x, P.y, R, e => {
      if (e.prop || e.dead) return;
      const a = Math.atan2(e.y - P.y, e.x - P.x);
      if (!e.boss) { const k = 150 * (1 - (e.kbRes || 0)); e.kx += Math.cos(a) * k; e.ky += Math.sin(a) * k; }
      addBurn(e, p.wallBurn, 3, 'wall');
    });
    addRing(P.x, P.y, R, '#ff6a2a', { w: 3, life: 0.35 }); addRing(P.x, P.y, R * 0.55, '#ffc34a', { w: 2, life: 0.25 });
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; part(P.x + Math.cos(a) * 6, P.y + Math.sin(a) * 6, Math.cos(a) * R * 2.6, Math.sin(a) * R * 2.6 - 20, rand(0.25, 0.4), pick(['#ff6a2a', '#ffc34a', '#b8261a']), { glow: true }); }
    addFlash(P.x, P.y, R * 2, '#ff8a3d', 0.25); shake(3);
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
      }
    });
    if (!burning.length) { blast(P.x, P.y, q.pow * k, null); addRing(P.x, P.y, R, '#ff6a2a', { w: 3, life: 0.4 }); addFlash(P.x, P.y, R * 2.5, '#ff8a3d', 0.35); }
    burst(P.x, P.y, 40, ['#ff6a2a', '#ffc34a', '#ffffff'], { sp: 160, glow: true, life: 0.5 });
    shockAt(P.x, P.y, 1.6, 1); shake(10); hitstop(0.08); screenFlash(0.35 * SET.fxA, '#ff6a2a');
  });
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.boom(); AudioMan.crit();
}

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
  asMine(() => {
    addRing(e.x, e.y, e.r + 8, '#ffffff', { w: 2, life: 0.3 });
    burst(e.x, e.y, 10, ['#ffffff', '#bff4ff', '#7ad7ff'], { sp: 60, glow: true, life: 0.35 });
  });
  const n = cuV('trait', 'wave');
  if (n) { // 寒波: 周りの敵に凍傷(少し遅らせて、連鎖しても深く再帰しない)
    const x = e.x, y = e.y;
    setTimeout(() => {
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
  S.decoy = { x: P.x, y: P.y, t: p.decoyT, cryo: true, hit: new Set() };
  P.dash = { vx: d[0] / len * p.mirrorDist / p.mirrorTime, vy: d[1] / len * p.mirrorDist / p.mirrorTime, t: p.mirrorTime };
  P.invT = Math.max(P.invT, p.mirrorIfr); P.ifr = Math.max(P.ifr, p.mirrorIfr);
  playAnim('cMirror', MOTIONS.cMirror.dur); P.anim.keep = true;
  asMine(() => { burst(P.x, P.y, 14, ['#ffffff', '#bff4ff'], { sp: 60, glow: true, life: 0.35 }); addRing(P.x, P.y, 14, '#bff4ff', { life: 0.25 }); });
  AudioMan.dash();
}
// ダイヤモンドダスト: 自分を中心に細氷の領域(zones の 'ddust'、world.js で凍傷とダメージ)
function cryoDust() {
  const q = DATA.classes.cryo.q, k = 1 + cuV('q', 'pow') + (P.lvFx.qPow || 0);
  zones.push({ kind: 'ddust', x: P.x, y: P.y, r: q.r * (1 + cuV('q', 'area')) * P.area, t: 0, dur: q.dur + (hasSp('q', 'cd') ? q.longDur : 0), tick: 0,
    every: q.every, frost: q.frost, dmg: q.pow * k, glitter: hasSp('q', 'pow') ? q.glitter * k : 0, whiteout: hasSp('q', 'area') ? q.whiteout : 0 });
  asMine(() => {
    burst(P.x, P.y, 50, ['#ffffff', '#bff4ff', '#7ad7ff'], { sp: 180, glow: true, life: 0.6 });
    addRing(P.x, P.y, q.r * P.area, '#ffffff', { w: 3, life: 0.5 }); addFlash(P.x, P.y, q.r * 2.5, '#bff4ff', 0.4);
    shockAt(P.x, P.y, 1.4, 1); shake(6); screenFlash(0.25 * SET.fxA, '#bff4ff');
  });
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.blizz(); AudioMan.crit();
}

// ---------- エレクトロマンサー: 帯電・雷纏い・鉄塔・雷走 ----------
const EL = () => DATA.classes.electro.params;
const elMax = () => EL().max + cuV('trait', 'cap');
const elWearDur = () => cuV('passive', 'wear', EL().wearT);
const dashCost = () => EL().dashCost - (P.lvFx.dashCut || 0);
// 帯電を得る(雷纏いの充電で増える。raw: そのまま)
function elGain(n, raw) {
  if (!raw && P.elT > 0) n *= 1 + cuV('passive', 'charge');
  P.charge = Math.min(elMax(), (P.charge || 0) + n); S.hudDirty = true;
}
// 感電への補正: 帯電 20 につき連鎖 +1・避雷針・伝導(距離)・収束・雷光
function elShockMod(e) {
  const p = EL(), q = DATA.classes.electro.q;
  let n = Math.floor((P.charge || 0) / p.perChain);
  if (hasSp('q', 'cd') && zones.some(z => z.kind === 'tower' && d2(z.x, z.y, e.x, e.y) < q.r * q.r)) n++; // 避雷針
  const focus = hasSp('trait', 'conduct');
  return { n, nMul: focus ? p.focusN : 1, r: 1 + cuV('trait', 'conduct'), dmg: (focus ? p.focusDmg : 1) * (P.elT > 0 && hasSp('passive', 'shock') ? 1 + p.flash : 1) };
}
// 雷纏い
function elWear() {
  P.elT = elWearDur(); S.hudDirty = true;
  asMine(() => { for (let i = 0; i < 6; i++) { const a = rand(0, TAU); bolts.push({ x0: P.x, y0: P.y - 4, x1: P.x + Math.cos(a) * 16, y1: P.y - 4 + Math.sin(a) * 16, t: 0, life: 0.15, w: 1 }); } });
}
// 放電: 帯電の一部を消費し、その発動の命中に起こす感電の割合を返す
function elDischarge() {
  const p = EL(), used = Math.floor((P.charge || 0) * cuV('trait', 'store', p.use));
  P.charge -= used; S.hudDirty = true;
  if (used > 0 && hasSp('trait', 'cap')) P.recharge = { left: used * p.recharge, rate: used * p.recharge / p.rechargeT }; // 再充電
  if (used > 0) asMine(() => { addRing(P.x, P.y, 20 + used / 2, '#fff27a', { w: 2, life: 0.3 }); burst(P.x, P.y, 10 + used / 2, ['#fff27a', '#9fd8ff', '#ffffff'], { sp: 90, glow: true, life: 0.3 }); });
  return p.disShock * (1 + used * p.disPer) * (1 + (P.lvFx.disDmg || 0));
}
// 雷走: 移動方向へ駆け抜ける
function electroDash() {
  const p = EL(), d = P.moving && P.dir ? P.dir : [P.facing, 0], len = Math.hypot(d[0], d[1]) || 1;
  staUse(dashCost());
  P.dash = { vx: d[0] / len * p.dashDist / p.dashTime, vy: d[1] / len * p.dashDist / p.dashTime, t: p.dashTime };
  P.dashHit = new Set();
  P.invT = Math.max(P.invT, p.dashIfr); P.ifr = Math.max(P.ifr, p.dashIfr);
  playAnim('eDash', MOTIONS.eDash.dur); P.anim.keep = true;
  asMine(() => { burst(P.x, P.y, 12, ['#fff27a', '#9fd8ff', '#ffffff'], { sp: 70, glow: true, life: 0.3 }); });
  AudioMan.dash(); AudioMan.zap();
}
// 鉄塔: 画面内のランダムな位置に落とす(zones の 'tower'、world.js で放電)
function electroTowers() {
  const q = DATA.classes.electro.q, k = 1 + cuV('q', 'pow') + (P.lvFx.qPow || 0), n = q.n + cuV('q', 'n'), id = (S.actId = (S.actId || 0) + 1);
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul); // ここで纏い + 放電(P.elDis.q)
  const dis = P.elDis.q || 0;
  for (let i = 0; i < n; i++) {
    const x = cam.x + rand(24, GFX.VW - 24), y = cam.y + rand(30, GFX.VH - 20);
    setTimeout(() => {
      if (state !== 'play') return;
      zones.push({ kind: 'tower', id, x, y, r: q.r * P.area, t: 0, dur: q.dur, tick: q.every, dis, pow: q.pow * k, shock: q.shock, wireT: 0,
        boom: hasSp('q', 'pow') ? q.boomPow * k : 0, wire: hasSp('q', 'n') ? q.wirePow * k : 0 });
      asMine(() => {
        forEachNear(x, y, q.landR * P.area, e => {
          if (e.prop) { killEnemy(e); return; }
          const dealt = hitEnemy(e, q.landPow * k, { src: 'tower', ang: Math.atan2(e.y - y, e.x - x), kb: 60, col: '#fff27a' });
          if (dis && dealt) addShock(e, dealt, dis, { noCharge: true });
        });
        bolts.push({ x0: x + rand(-10, 10), y0: cam.y - 10, x1: x, y1: y - 20, t: 0, life: 0.25, w: 3 });
        addFlash(x, y, 80, '#fff27a', 0.35); addRing(x, y, q.landR * P.area, '#ffffff', { w: 2, life: 0.3 });
        burst(x, y, 20, ['#8a8098', '#fff27a', '#ffffff'], { sp: 100, up: 30, g: 160, life: 0.5 }); shockAt(x, y, 1, 1); shake(5);
      });
      AudioMan.zap(); AudioMan.boom();
    }, i * 120);
  }
}

// ---------- クレリック: 祈り・癒しの光・審判の祈り・聖域の祈り ----------
const CL = () => DATA.classes.cleric.params;
const prayCap = () => P.maxhp;
const strikeCd = () => CL().strikeCd * (1 - cuV('trait', 'vessel')) * (1 - (P.lvFx.strikeCd || 0)); // 祈りの一撃の間隔(祈祷・クラスLv3)
const prayCost = () => CL().prayCost - (P.lvFx.prayCut || 0);
// 被回復量: HP が低いほど増える(満ちる光: HP が高いほど)。天啓: ×0.5
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
  P.invT = Math.max(P.invT, p.prayIfr); P.ifr = Math.max(P.ifr, p.prayIfr);
  heal(P.maxhp * p.prayHeal);
  playAnim('hPray', MOTIONS.hPray.dur); P.anim.keep = true;
  asMine(() => { addRing(P.x, P.y, 18, '#ffe38a', { w: 2, life: 0.4 }); burst(P.x, P.y, 14, ['#ffe38a', '#fff6d8', '#ffffff'], { sp: 50, up: 30, glow: true, life: 0.45 }); });
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
      if (hasSp('q', 'pow') && !e.dead) e.stun = Math.max(e.stun || 0, e.boss ? q.bossStun : q.stun); // 神罰
    });
    slashes.push({ x: P.x, y: P.y, a: a.a, r: R, t: 0, life: 0.45, col: '#ffe38a', fan: true, span: full ? TAU : q.arc });
    const n = 6 + Math.min(10, Math.floor(used / 15));
    for (let i = 0; i < n; i++) { // 天から降る光の柱
      const d = full ? rand(0, TAU) : a.a + rand(-q.arc / 2, q.arc / 2), r = rand(0.3, 1) * R;
      zones.push({ kind: 'pillar', x: P.x + Math.cos(d) * r, y: P.y + Math.sin(d) * r, r: 12, t: -i * 0.03, dur: 0.45, tick: 0 });
    }
    const cx = full ? P.x : P.x + Math.cos(a.a) * R * 0.5, cy = full ? P.y : P.y + Math.sin(a.a) * R * 0.5;
    addFlash(cx, cy, R * 2, '#fff6d8', 0.45);
    shockAt(cx, cy, 1.2 + Math.min(0.8, used / 150), 1); shake(9); hitstop(0.07); screenFlash(0.3 * SET.fxA, '#fff6d8');
  });
  if (used > 0) { P.noPray = true; heal(used * q.heal); P.noPray = false; } // この超過回復は祈りにならない
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.boom(); AudioMan.crit();
}

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
// 血の渇きの回復量の倍率(渇き・クラスLv6。生き血: HP lowAt 以下で ×2)
const asLeechK = () => (1 + cuV('passive', 'thirst') + (P.lvFx.leech || 0)) * (hasSp('passive', 'greed') && P.hp <= P.maxhp * AS().lowAt ? 2 : 1);
// 命中ごとの回復の上限(1秒あたり。血宴で上がる。饗宴: 血の契約の効果中 × pactCap)
const asLeechCap = () => P.maxhp * cuV('passive', 'feast', AS().leechCap) * (P.pact && hasSp('passive', 'feast') ? AS().pactCap : 1);
const asPactK = () => cuV('q', 'price', 1); // 代償: 血の契約の効果の倍率
// 血の渇きの回復(数字は出さない)。命中ごと・撃破時とも、1秒の上限の枠から取る
function asHeal(n) {
  const take = Math.min(n, P.asBucket);
  if (!(take > 0)) return;
  P.asBucket -= take;
  heal(take, true);
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
  P.invT = Math.max(P.invT, p.dashIfr); P.ifr = Math.max(P.ifr, p.dashIfr);
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
      shockAt(cx, cy, 1.6, 1); shake(9); hitstop(0.07); screenFlash(0.3 * SET.fxA, '#3a0008');
    });
    AudioMan.cutHit(); AudioMan.crit();
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
    if (hasSp('trait', 'fang') && !e.dead) e.curseT = S.time + p.curseT;
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
  UI.announce('不死の契り', '');
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
    if (b.big) { shockAt(b.x, b.y, 1.8, 1); shake(9); hitstop(0.07); screenFlash(0.2 * SET.fxA, '#5a30c0'); } else { shockAt(b.x, b.y, 0.7, 1.2); shake(2); }
  });
  if (hasSp('q', 'pow')) zones.push({ kind: 'grudge', x: b.x, y: b.y, r: b.R, t: 0, dur: q.lingerT, tick: 0, dmg: q.lingerPow * necK() }); // 慟哭(霊力も乗る)
  if (last) AudioMan.knell(); else AudioMan.boom();
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
  P.invT = Math.max(P.invT, p.ejectIfr); P.ifr = Math.max(P.ifr, p.ejectIfr);
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
      if (!s.white || e.dead) return;
      if (!e.boss) { const kb = q.whiteKb * (1 - (e.kbRes || 0)); e.kx += Math.cos(a) * kb; e.ky += Math.sin(a) * kb; }
      e.stun = Math.max(e.stun || 0, q.whiteStun); // ホワイトホール
    });
    // 一瞬縮んで → 桃色の閃光と衝撃波
    addFlash(s.x, s.y, s.r * 2.4, '#8a2a6e', 0.35); addFlash(s.x, s.y, s.r * 0.8, '#ff7ad9', 0.12);
    addRing(s.x, s.y, s.r, '#ff7ad9', { w: 3, life: 0.4 }); addRing(s.x, s.y, s.r * 1.4, '#8a2a6e', { w: 2, life: 0.5 });
    burst(s.x, s.y, 50, AST_FX, { sp: 170, glow: true, life: 0.6 });
    shockAt(s.x, s.y, 2, 0.9); shake(10); hitstop(0.07);
    screenFlash(0.15 * SET.fxA, '#3a0a30');
    if (s.white) { addRing(s.x, s.y, s.r * 2, '#c78bff', { r0: s.r * 0.3, w: 2, life: 0.45 }); shockAt(s.x, s.y, 1.4, 1.4); }
  });
  GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.9 * SET.fxA);
  if (s.hawking) astGain(s.used * q.hawking); // ホーキング放射
  AudioMan.crush();
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
    shockAt(s.x, s.y, 1.6, 1.1); shake(7);
  });
  AudioMan.boom();
}

// ---------- バーサーカー ----------
const BK = () => DATA.classes.berserker.params;
const BK_FX = ['#5a0a14', '#3a0610', '#1a0408', '#7a1420']; // 闘気の色(赤黒。明るい赤は敵の攻撃の色なので使わない)
const bkRageMax = () => BK().rageMax + cuV('trait', 'fury');                               // 怒りの上限(激情)
const bkRageHit = () => cuV('trait', 'pain', BK().rageHit);                                // 被弾で得る怒り(痛覚)
const bkCalmT = () => BK().calmT + (P.lvFx.calmT || 0);                                    // 怒りが減り始めるまでの秒数(クラスLv3)
const bkDecay = () => BK().decay * (1 - cuV('trait', 'grudge'));                           // 怒りが減る速さ(1秒あたり。執念で遅くなる)
const bkFull = () => P.rage >= bkRageMax();                                                // 怒りが上限
const bkFervorK = () => 1 + cuV('passive', 'zeal');                                        // 昂りの効果の倍率(熱狂)
const bkFervorT = () => BK().fervorT + cuV('passive', 'field') + (P.lvFx.fervorT || 0);   // 昂りの時間(戦場・クラスLv8)
const bkDesperate = () => hasSp('passive', 'edge') && P.hp <= P.maxhp * BK().desperateAt; // 死に物狂い: HP が少ないと昂りが常に最大
const bkFervorN = () => (bkDesperate() ? BK().fervorMax : P.fervor.length);               // 効いている昂りの段数
const bkFirmCost = () => BK().firmCost - (P.lvFx.firmCut || 0);                            // 不屈のスタミナ(クラスLv6)
const bkEyes = () => P.cls === 'berserker' && !!(P.frenzy || bkFull());                    // 目が赤く光る(怒りが上限・狂乱中)
function bkRageAdd(n) {
  if (!(n > 0)) return;
  const before = P.rage;
  P.rage = Math.min(bkRageMax(), P.rage + n);
  if (Math.floor(P.rage) !== Math.floor(before)) S.hudDirty = true;
}
// 昂りを n 段得る(段ごとに fervorT 秒。上限のときは残りが一番短い段を新しくする)
function bkFervorAdd(n) {
  const max = BK().fervorMax, T = bkFervorT();
  for (let i = 0; i < n; i++) {
    if (P.fervor.length < max) { P.fervor.push(T); continue; }
    let j = 0;
    for (let k = 1; k < P.fervor.length; k++) if (P.fervor[k] < P.fervor[j]) j = k;
    P.fervor[j] = T;
  }
  S.hudDirty = true;
}
// 狂い咲き: 狂乱中に敵を倒すと持続 +bloomT(1回の狂乱で bloomMax まで)
function bkBloom() {
  const f = P.frenzy, q = DATA.classes.berserker.q;
  if (!f || !hasSp('q', 'dur') || f.ext >= q.bloomMax) return;
  const add = Math.min(q.bloomMax - f.ext, q.bloomT);
  f.t += add; f.max += add; f.ext += add;
}
// 不屈(Space): firmT 秒 被ダメージを減らし、減速を受けない(動ける)。足を踏ん張り、全身に赤黒い闘気をまとう
function bkFirm() {
  staUse(bkFirmCost());
  P.firmT = BK().firmT; P.slowT = P.cdSlowT = 0;
  playAnim('zFirm', MOTIONS.zFirm.dur);
  asMine(() => {
    addRing(P.x, P.y + 4, 14, '#7a1418', { w: 2, life: 0.3 }); addRing(P.x, P.y + 4, 8, '#3a0610', { life: 0.25 });
    burst(P.x, P.y + 2, 14, BK_FX, { sp: 60, up: 20, life: 0.4 });
    shake(2);
  });
  AudioMan.firm();
}
// 狂乱(Q): 怒りを全て使い、雄叫びとともに周りを薙ぎ払う(大斧の一回転・赤黒い衝撃波・強い揺れ)→ 狂乱
//   薙ぎ払いは使う前の怒りの与えるダメージのまま当たる。狂乱の間は怒りを上限にしておく(update)
function bkFrenzy() {
  const q = DATA.classes.berserker.q, used = P.rage, R = q.r * P.area;
  const dmg = (q.pow + used * q.perRage) * (1 + cuV('q', 'pow') + (P.lvFx.qPow || 0)) * (hasSp('passive', 'field') ? 1 + BK().selfPow : 1); // 仁王立ち: 威力 +selfPow
  asMine(() => {
    forEachNear(P.x, P.y, R, e => {
      if (e.prop) { killEnemy(e); return; }
      hitEnemy(e, dmg, { src: 'frenzy', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 130, col: '#b8402a' });
    });
    slashes.push({ x: P.x, y: P.y, follow: true, a: P.facing < 0 ? Math.PI : 0, r: R, t: 0, life: 0.32, full: true, flip: P.facing < 0, pal: SWING_PAL.rage });
    addRing(P.x, P.y, R, '#7a1418', { w: 3, life: 0.4 }); addRing(P.x, P.y, R * 1.5, '#3a0610', { r0: R * 0.5, w: 2, life: 0.5 });
    addFlash(P.x, P.y, R * 2.4, '#3a0610', 0.35);
    burst(P.x, P.y, 40, BK_FX, { sp: 150, life: 0.55 }); burst(P.x, P.y, 8, BK_FX, { sp: 120, glow: true, life: 0.4 }); // 赤黒い破片(光るのは少しだけ)
    shockAt(P.x, P.y, 1.3, 1.1); shake(11); hitstop(0.07); // 自分が中心の衝撃波は強すぎると自分の絵が引き伸ばされるので控えめ
    screenFlash(0.14 * SET.fxA, '#2a0408');
  });
  GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.8 * SET.fxA);
  const dur = Math.min(q.durMax, q.dur + used * q.durPer) + cuV('q', 'dur');
  P.frenzy = { t: dur, max: dur, used, ext: 0, whirl: q.whirlEvery };
  P.rage = bkRageMax(); P.sta = 0; S.hudDirty = true;
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.warcry(); AudioMan.boom();
}
// 狂乱の終わり: 怒りは 0 から溜め直し。スタミナの回復が戻る(0 から)
function bkFrenzyEnd() {
  P.frenzy = null; P.rage = 0; P.staLockT = 0; S.hudDirty = true;
  asMine(() => burst(P.x, P.y - 2, 16, BK_FX, { sp: 50, up: 30, life: 0.5 }));
}
// 旋風: 狂乱中、周り(半径 whirlR)を斬る(基礎威力 whirlPow + 使った怒り × whirlPer)
function bkWhirl(f) {
  const q = DATA.classes.berserker.q, R = q.whirlR * P.area, dmg = q.whirlPow + f.used * q.whirlPer;
  asMine(() => {
    forEachNear(P.x, P.y, R, e => {
      if (e.prop) { killEnemy(e); return; }
      hitEnemy(e, dmg, { src: 'frenzy', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 40, col: '#b8402a', noNum: Math.random() < 0.4 });
    });
    slashes.push({ x: P.x, y: P.y, follow: true, a: rand(0, TAU), r: R, t: 0, life: 0.24, full: true, flip: Math.random() < 0.5, pal: SWING_PAL.rage });
  });
  AudioMan.slash();
}
// 闘気: 怒りが溜まるほど体から赤黒い湯気が立ちのぼる(上限・狂乱で濃く)
function bkSteam(dt) {
  const f = P.frenzy ? 1 : P.rage / bkRageMax();
  if (f < 0.05) return;
  const rate = (3 + 20 * f) * (bkEyes() ? 1.6 : 1);
  asMine(() => { for (let n = dt * rate; Math.random() < n; n--) part(P.x + rand(-5, 5), P.y + rand(-8, 3), rand(-6, 6), -rand(12, 28), rand(0.5, 0.9), pick(BK_FX), { glow: Math.random() < 0.06, drag: 1.5 }); });
}

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
const wmFull = () => Object.keys(P.weapons).length >= S.weaponSlots;           // 武器枠が全て埋まっている(不動)
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
        if (stun && !e.dead) e.stun = Math.max(e.stun || 0, p.stunT); // 影縫い
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
  P.invT = Math.max(P.invT, p.dashIfr); P.ifr = Math.max(P.ifr, p.dashIfr);
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
// 早業: 全ての武器の攻撃間隔を 0 に戻す(オーラは判定の間隔。回り続ける刃は帯の敵へ 1回)
function wmHaste() {
  for (const k in P.weapons) {
    const w = P.weapons[k];
    if (k === 'blade') weaponFire(k, w, wst(k), P_ORG); else if (k === 'aura') w.tick = 0; else w.cd = 0;
  }
  asMine(() => { addRing(P.x, P.y, 16, WM_COL, { w: 2, life: 0.25 }); burst(P.x, P.y - 6, 10, WM_FX, { sp: 70, glow: true, life: 0.3 }); });
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
  UI.announce(q.name, list.map((k, i) => DATA.weapons[k].skill.name + (extra[i] ? `(${DATA.weapons[k].skill.tree.paths[extra[i]].sp.name})` : '')).join(' / ')); // 使う武器スキル(秘伝の特殊強化)
  asMine(() => { // 体から半透明の分身が抜け出す: 煙と銅色の輪(自分が中心の衝撃波は自分の絵を引き伸ばすので使わない)
    burst(c.x, c.y - 4, 18, WM_SMOKE, { sp: 60, up: 20, life: 0.5, drag: 2 });
    for (let i = 0; i < 10; i++) part(P.x, P.y - 6, side * rand(40, 90), rand(-30, 10), 0.3, pick(WM_FX), { glow: i % 3 === 0, drag: 4 });
    addRing(c.x, c.y + 5, 14, WM_COL, { w: 2, life: 0.35 }); addFlash(c.x, c.y, 40, '#5a3a1a', 0.2);
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
  if (c.stay) { const cdt = dt * (P.cdSlowT > 0 ? DATA.debuff.cdRate : 1); for (const k2 of c.used) weaponStep(k2, c.cws[k2], dt, cdt, c.org); } // 化身
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
  asMine(() => { burst(c.x, c.y - 6, 10, WM_SMOKE, { sp: 45, up: 15, life: 0.35, drag: 2 }); addRing(c.x, c.y + 5, 10, DATA.weapons[k].col, { life: 0.25 }); }); // 持ち替えの煙と、武器の色の輪
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

// ---------- world.js から呼ぶ入口 ----------
const clsRT = () => CLASS_RT[P.cls];
function clsInit() {
  P.sta = P.maxSta; P.staLockT = 0; P.moveMul = 1; P.invT = 0; P.atkSpd = 1; P.cu = {}; P.cs = {};
  P.sk = { q: { cd: 0, max: 1 }, e: { cd: 0, max: 1 } }; P.act = null; P.anim = null; P.orbs = []; P.dash = null; P.flame = null; P.bladeE = null; P.bigWisps = []; P.poss = []; P.rift = null;
  if (clsRT()) clsRT().init();
}
function clsUpdate(dt) {
  updStamina(dt);
  P.invT -= dt;
  const cdt = dt * (P.cdSlowT > 0 ? DATA.debuff.cdRate : 1); // スロウタイム中は武器と同じく CD の回復が遅い
  for (const k in P.sk) P.sk[k].cd = Math.max(0, P.sk[k].cd - cdt);
  if (S.decoy && (S.decoy.t -= dt) <= 0) S.decoy = null;
  const rt = clsRT();
  if (rt) rt.update(dt);
  for (const w of WS_TICK) w.tick(dt); // 武器スキルの残る効果(オーブ・刃輪・精霊・異次元・斧など)。メイン武器以外の武器スキルも分身などが使うので全て
  // スキルの発動(実行中は他のスキルを使えない)。自動発動は周りに敵が集まっているときだけ(ガード中は使わない)
  if (!P.act && rt) {
    const ws = weaponSkill(), auto = !P.guard;
    const wantQ = keys._q || (auto && SET.autoQ && crowd(90, 5));
    const wantE = keys._e || (auto && SET.autoE && ws && crowd(ws.radius * P.area, 4));
    if (wantQ && rt.qStart && P.sk.q.cd <= 0) rt.qStart();
    else if (wantE && WEAPON_SKILL[P.mainW] && P.sk.e.cd <= 0) WEAPON_SKILL[P.mainW].start();
  }
  keys._q = keys._e = false;
  // 実行中のスキル
  if (P.act) {
    P.act.t += dt;
    if (P.act.slot === 'q') rt.qUpdate(P.act, dt); else WEAPON_SKILL[P.mainW].update(P.act, dt);
  }
  // モーション(スキルが終わった後に歩き出したら途中で打ち切る)
  if (P.anim) { P.anim.t += dt; if (P.anim.t >= P.anim.dur || (!P.act && P.moving && !P.anim.keep)) P.anim = null; } // keep: 動いても最後まで(ブリンク)
}
const clsOnHurt = dmg => (clsRT() ? clsRT().onHurt(dmg) : dmg);
// 元素(メイジの元素循環)。通常攻撃・E の攻撃1回ごとに次の属性を返す。元素を持たないクラスは null
const clsNextEl = () => (clsRT() && clsRT().nextEl ? clsRT().nextEl() : null);
function clsOnElement(e, el, dealt) { if (clsRT() && clsRT().onElement) clsRT().onElement(e, el, dealt); }
function clsOnMainHit(e) { if (clsRT()) clsRT().onMainHit(e); }
function clsOnEHit(e, dealt) { if (clsRT() && clsRT().onEHit) clsRT().onEHit(e, dealt); } // 武器スキル(E)の命中
// 敵ごとの補正(アーチャーの印・弱点露出・集中など)
const clsShieldGain = () => (clsRT() && clsRT().shieldGain ? clsRT().shieldGain() : 1); // シールドの獲得量の倍率
const clsShieldCap = () => (clsRT() && clsRT().shieldCap ? clsRT().shieldCap() : P.maxhp);  // シールドの上限
function clsOnShieldBreak() { if (clsRT() && clsRT().onShieldBreak) clsRT().onShieldBreak(); } // シールドが割れた
const clsDmgTaken = (e, o) => (clsRT() && clsRT().dmgTaken ? clsRT().dmgTaken(e, o) : 1);
// 武器スキルによる敵の被ダメージ(侵蝕・次元歪みなど。どれも敵に付いた印で決まるので、メイン武器に限らず全て掛ける)
const WS_TAKEN = Object.values(WEAPON_SKILL).filter(w => w.dmgTaken), WS_TICK = Object.values(WEAPON_SKILL).filter(w => w.tick);
const wsDmgTaken = e => { let k = 1; for (const w of WS_TAKEN) k *= w.dmgTaken(e); return k; };
const clsCritBonus = e => (clsRT() && clsRT().critBonus ? clsRT().critBonus(e) : 0);
const clsCritDmgBonus = e => (clsRT() && clsRT().critDmgBonus ? clsRT().critDmgBonus(e) : 0);
function clsOnKill(e, o) { if (clsRT() && clsRT().onKill) clsRT().onKill(e, o); } // o: 倒した一撃の指定(hitEnemy の o。o.cl: 自分以外の使い手の武器スキル)
function clsOnBossKill(e) { if (clsRT() && clsRT().onBossKill) clsRT().onBossKill(e); } // ボスを倒した(ボスでは clsOnKill は呼ばれない)
function clsOnPickup(kind) { if (clsRT() && clsRT().onPickup) clsRT().onPickup(kind); } // アイテムを拾った(kind: 'gem' = 経験値の宝石 / coin / meat / magnet / bomb / chest)
// 凍傷(共通の仕組み)へのクラスの補正: 上限・付いたとき(凍結)・ボスの攻撃速度
const clsFrostCap = () => (clsRT() && clsRT().frostCap ? clsRT().frostCap() : 0);
function clsOnFrost(e) { if (clsRT() && clsRT().onFrost) clsRT().onFrost(e); }
const clsBossRate = e => (clsRT() && clsRT().bossRate ? clsRT().bossRate(e) : 1);
// 感電(共通の仕組み)へのクラスの補正(n: 連鎖の追加 / nMul: 連鎖数の倍率 / r: 距離の倍率 / dmg: ダメージの倍率)と、起きたとき
const clsShockMod = e => (clsRT() && clsRT().shockMod ? clsRT().shockMod(e) : null);
const clsShockOrigin = () => !!(clsRT() && clsRT().shockOrigin); // 感電が起点の敵にも入るか(エレクトロマンサーの帯電)
function clsOnShock(o) { if (clsRT() && clsRT().onShock) clsRT().onShock(o); }
const clsBlockProj = () => !!(clsRT() && clsRT().blockProj && clsRT().blockProj()); // 敵の弾を消す(静電気)
// 回復(共通)へのクラスの補正: 被回復量の倍率 / 超過回復したとき(クレリックの祈り)/ 命中の追加ダメージ(祈りの一撃)
const clsHealMul = () => (clsRT() && clsRT().healMul ? clsRT().healMul() : 1);
function clsOnOverheal(n) { if (clsRT() && clsRT().onOverheal) clsRT().onOverheal(n); }
const clsHitBonus = (e, o) => (clsRT() && clsRT().hitBonus ? clsRT().hitBonus(e, o) : 0);
// 時の歪み(アストロマンサーの重力圏): 敵の移動・攻撃の速さの倍率 / 敵の弾の時間の進み方(0 = 止まる)/ 被弾後の無敵時間の倍率(不動)
const clsEnemySlow = e => (clsRT() && clsRT().enemySlow ? clsRT().enemySlow(e) : 1);
const clsProjTime = p => (clsRT() && clsRT().projTime ? clsRT().projTime(p) : 1);
const clsIfrMul = () => (clsRT() && clsRT().ifrMul ? clsRT().ifrMul() : 1);
// 与えるダメージの倍率(攻撃力とは別に掛ける)/ 倒れるダメージを耐えるか(耐えたら true。HP は呼んだ側で 1 にする)/ 減速を受けない / HP回復速度の追加
//   (バーサーカーの怒り・不死の狂乱・不屈・昂り など)
const clsDmgDealt = () => (clsRT() && clsRT().dmgDealt ? clsRT().dmgDealt() : 1);
const clsSaveLethal = () => !!(clsRT() && clsRT().saveLethal && clsRT().saveLethal());
const clsSelfHurt = n => (clsRT() && clsRT().selfHurt ? clsRT().selfHurt(n) : n); // 自分の技で受けるダメージ(selfHurt)をクラスが被弾として扱うとき、受ける量
const clsSlowImmune = () => !!(clsRT() && clsRT().slowImmune && clsRT().slowImmune());
const clsRegen = () => (clsRT() && clsRT().regen ? clsRT().regen() : 0);
const clsHpAdd = () => (P && P.cu && clsRT() && clsRT().hpAdd ? clsRT().hpAdd() : 0); // 最大HP の追加(applyStats が読む。ラン開始の最初の計算ではまだ強化ツリーがない)
// 感電: 命中した敵 e から近くの敵へ雷が連鎖し、与えたダメージ dealt の pct を与える(同じ敵には戻らない)
//   帯電を持つクラス(エレクトロマンサー)は、起点の敵 e にも同じだけ入る(連鎖先がいなくても無駄にならない)
//   o.n: 連鎖数(基本 1)/ o.r: 連鎖距離 / o.src: ダメージの出どころ / o.noCharge: 帯電を増やさない(放電)
function addShock(e, dealt, pct, o = {}) {
  if (!(pct > 0) || !(dealt > 0)) return;
  const m = clsShockMod(e) || { n: 0, nMul: 1, r: 1, dmg: 1 };
  const n = Math.max(1, Math.floor(((o.n || 1) + m.n) * m.nMul)), R = (o.r || DATA.debuff.shockR) * m.r, dmg = dealt * pct * m.dmg / dmgMul();
  const done = new Set([e]);
  let cur = e;
  asMine(() => {
    if (clsShockOrigin() && !e.dead && !e.prop) { // 帯電: 起点の敵にも感電のダメージ(小さな火花)
      hitEnemy(e, dmg, { src: o.src || 'shock', noNum: Math.random() < 0.5, col: '#fff27a', dot: true });
      bolts.push({ x0: e.x - 3, y0: e.y - 12, x1: e.x + 2, y1: e.y, t: 0, life: 0.15, w: 1 });
    }
    for (let i = 0; i < n; i++) {
      let best = null, bd = R * R;
      const cx = cur.x, cy = cur.y;
      forEachNear(cx, cy, R, t => { if (t.prop || t.dead || done.has(t)) return; const d = d2(cx, cy, t.x, t.y); if (d < bd) { bd = d; best = t; } });
      if (!best) break;
      bolts.push({ x0: cx, y0: cy, x1: best.x, y1: best.y, t: 0, life: 0.2, w: 1 });
      hitEnemy(best, dmg, { src: o.src || 'shock', noNum: Math.random() < 0.5, col: '#fff27a', dot: true });
      done.add(best); cur = best;
    }
  });
  clsOnShock(o);
}
// 凍傷を付ける(cap: 出どころの上限。クラスが上限を決めるときはそちら)。凍結中は増えない
function addFrost(e, n, cap) {
  if (!(n > 0) || e.dead || e.prop || e.freeze) return;
  cap = clsFrostCap() || cap;
  e.frost = Math.max(e.frost || 0, Math.min(cap, (e.frost || 0) + n)); e.frostT = 5;
  clsOnFrost(e);
}
// 武器の命中(全武器の通常攻撃・E。炎上などの継続ダメージは除く)。o: hitEnemy の指定(どの武器の命中か)
function clsOnWeaponHit(e, dmg, crit, o) { if (clsRT() && clsRT().onWeaponHit) clsRT().onWeaponHit(e, dmg, crit, o); }
// 出血(共通の仕組み)へのクラスの補正: 最大スタック(無ければ無制限)・持続の追加・ダメージの倍率・攻撃力とクリティカルを乗せるか
const clsBleedCap = () => (clsRT() && clsRT().bleedCap ? clsRT().bleedCap() : Infinity);
const clsBleedDur = () => (clsRT() && clsRT().bleedDur ? clsRT().bleedDur() : 0);
const clsBleedMul = () => (clsRT() && clsRT().bleedMul ? clsRT().bleedMul() : 1);
const clsBleedFull = () => !!(clsRT() && clsRT().bleedFull && clsRT().bleedFull());
// 炎上(共通の仕組み)へのクラスの補正: ダメージ倍率・持続の追加・切れたとき
const clsBurnMul = e => (clsRT() && clsRT().burnMul ? clsRT().burnMul(e) : 1);
const clsBurnDur = () => (clsRT() && clsRT().burnDur ? clsRT().burnDur() : 0);
function clsOnBurnOut(e, perSec, onlyEmber) { if (clsRT() && clsRT().onBurnOut) clsRT().onBurnOut(e, perSec, onlyEmber); }

// ---------- 強化ツリーのカード ----------
// 候補: クラスのツリー + メイン武器の E のツリー。Lv3 未満のパス + Lv3 に達したパスの特殊強化(カテゴリで未取得のとき)
// 特殊強化が出せるなら1枚は必ず入れる
function clsChoices(n) {
  const tree = Object.assign({}, DATA.classes[P.cls].tree), skills = (clsRT() && clsRT().skills) || [], ok = need => !need || skills.includes(need);
  if (weaponSkill()) tree.e = weaponSkill().tree;
  const ups = [], sps = [];
  for (const cat in tree) {
    if (!ok(tree[cat].need)) continue;
    for (const p in tree[cat].paths) {
      if (!ok(tree[cat].paths[p].need)) continue;
      if (cuLv(cat, p) < 3) ups.push({ type: 'cls', cat, path: p });
      else if (!P.cs[cat]) sps.push({ type: 'cls', cat, path: p, sp: true });
    }
  }
  const out = sps.length ? [pick(sps)] : [];
  for (const c of shuffle(ups.concat(sps.filter(x => x !== out[0])))) { if (out.length >= n) break; out.push(c); }
  return shuffle(out);
}
function clsApply(c) {
  if (c.sp) P.cs[c.cat] = c.path; else P.cu[c.cat + '.' + c.path] = cuLv(c.cat, c.path) + 1;
  recalc();
}
const clsAtkBonus = () => (clsRT() ? clsRT().atkBonus() : 0);
// E スキルの威力倍率(クラスの特殊強化など。武器スキルからは「クラスの倍率」としてだけ参照する)
const clsESkillMul = () => (clsRT() && clsRT().eMul ? clsRT().eMul() : 1);
const clsRes = () => (clsRT() && clsRT().res ? clsRT().res() : null);
const clsStatuses = () => (clsRT() && clsRT().statuses ? clsRT().statuses() : []);
const clsStaBroken = () => !!(clsRT() && clsRT().staBroken && clsRT().staBroken());
// HUD 用: E / Q のアイコン情報
function clsSkillIcons() {
  const out = [], ws = weaponSkill(), rt = clsRT();
  if (ws) out.push({ slot: 'e', key: 'E', name: ws.name, glyph: ws.name[0] });
  if (rt && rt.qInfo) out.push(Object.assign({ slot: 'q', key: 'Q' }, rt.qInfo()));
  return out;
}
