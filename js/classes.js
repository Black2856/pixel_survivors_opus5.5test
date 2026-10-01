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
  if (P.staLockT <= 0 && P.sta < P.maxSta) P.sta = Math.min(P.maxSta, P.sta + P.staRegen * dt);
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
        `構え(${sk.windup}秒)→ ${sk.dur}秒間、周囲(半径 ${sk.radius})を連続で斬る`,
        `1回の威力: 武器の威力 × ${Math.round(sk.pow * 100)}%`,
        '使っている間も動ける',
      ], rows: [
        ['CD', `<b>${cd.toFixed(1)}</b> 秒`],
        ['斬る回数', `${sk.hits + Math.round(c.cuV('e', 'dur') / 0.15) + (m.eHits || 0)} 回 / ${(sk.dur + c.cuV('e', 'dur')).toFixed(2)} 秒`],
        ['1回の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
      ] };
    },
    start() {
      const sk = weaponSkill(), dur = sk.dur + cuV('e', 'dur');
      const m = P.wm.katana || {}; // 熟練: 斬る回数・威力
      P.act = { slot: 'e', ph: 'wind', t: 0, dur, hits: sk.hits + Math.round(cuV('e', 'dur') / 0.15) + (m.eHits || 0), n: 0, hitT: 0, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
      playAnim('ranbu', MOTIONS.ranbu.duration(dur), dur);
      setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul); // 熟練のクールダウンは武器スキルにも効く
      skillCall(sk.name, '#ffb7d5'); AudioMan.click();
      burst(P.x, P.y, 12, ['#ffb7d5', '#ffffff'], { sp: 40, up: 20, glow: true });
    },
    update(a, dt) {
      const sk = weaponSkill();
      if (a.ph === 'wind') { P.moveMul = 0; if (a.t >= sk.windup) { a.ph = 'spin'; a.t0 = a.t; } return; }
      const u = a.t - a.t0;
      if (hasSp('e', 'dur')) { P.moveMul *= 1.5; P.invT = Math.max(P.invT, 0.05); } // 千本桜
      a.hitT -= dt;
      if (a.hitT <= 0 && a.n < a.hits) { a.hitT += a.dur / a.hits; a.n++; ranbuHit(sk); }
      if (Math.random() < dt * 40) part(P.x + rand(-sk.radius, sk.radius) * P.area, P.y + rand(-sk.radius, sk.radius) * P.area, rand(-20, 20), rand(-30, 0), 0.8, pick(['#ffb7d5', '#ff8ac0', '#ffffff']), { glow: true, drag: 1 });
      if (u >= a.dur) {
        if (hasSp('e', 'pow')) sakuraBurst(sk); // 桜吹雪
        P.act = null;
      }
    },
  },
};
// アーケイン・バラージュ(マジックボルトの E): 詠唱 → 照準方向へ連射(移動は遅くなる)
// オーブ(迅速の特殊強化)では、代わりに周りを回るオーブが5秒間連射し、自分は自由に動ける
WEAPON_SKILL.bolt = {
  info(c, dmg) {
    const sk = DATA.weapons.bolt.skill, m = c.wm, dur = sk.dur + c.cuV('e', 'dur') + (m.eDur || 0), one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      `詠唱 ${sk.windup}秒(動けない)→ ${sk.dur}秒間、照準方向へ毎秒 ${sk.rate}発の魔弾を連射`,
      `1発の威力: 武器の威力 × ${Math.round(sk.pow * 100)}%`,
      `連射中は移動速度 ×${sk.slow}`,
      `弾数は通常攻撃の ${Math.round(sk.countMul * 100)}%(切り上げ)。弾速・貫通は通常攻撃と同じ(進化後は追尾も)`,
      'E の攻撃なので、クラスの「攻撃1回ごと」の効果が1発ごとに起きる',
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['連射', `${Math.round(dur * sk.rate)} 発 / ${dur.toFixed(1)} 秒`],
      ['1発の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.bolt || {};
    const o = { slot: 'e', ph: 'wind', t: 0, dur: sk.dur + cuV('e', 'dur') + (m.eDur || 0), pow: clsESkillMul() * (1 + (m.ePow || 0)), shotT: 0, id: (S.actId = (S.actId || 0) + 1) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    skillCall(sk.name, '#b98bff'); AudioMan.click();
    if (hasSp('e', 'cd')) { P.orb = Object.assign(o, { t: 5, shotT: 0 }); burst(P.x, P.y, 20, ['#b98bff', '#ffffff'], { sp: 60, glow: true }); return; } // オーブ
    P.act = o;
    if (hasSp('e', 'dur')) gainShield(P.maxhp * sk.shield); // 魔力障壁
    playAnim('mBarrage', MOTIONS.mBarrage.duration(o.dur), o.dur);
    addRing(P.x, P.y, 20, '#b98bff', { w: 2, life: 0.4 });
  },
  update(a, dt) {
    const sk = weaponSkill();
    if (a.ph === 'wind') { // 詠唱: 足元に魔法陣
      P.moveMul = 0;
      if (Math.random() < dt * 40) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 14, P.y + 5 + Math.sin(r) * 6, 0, -20, 0.4, pick(['#b98bff', '#ffffff']), { glow: true }); }
      if (a.t >= sk.windup) { a.ph = 'fire'; a.t0 = a.t; }
      return;
    }
    if (!hasSp('e', 'dur')) P.moveMul *= sk.slow; // 魔力障壁: 移動速度ペナルティなし
    a.shotT -= dt;
    while (a.shotT <= 0) { a.shotT += 1 / sk.rate; barrageShot(a, P.x, P.y, aimDir(220)); }
    if (a.t - a.t0 >= a.dur) {
      P.act = null;
      asMine(() => { addRing(P.x, P.y, 28, '#b98bff', { w: 2, life: 0.35 }); burst(P.x, P.y, 16, ['#b98bff', '#ffffff'], { sp: 80, glow: true }); });
    }
  },
  // スキルの実行とは別に毎フレーム(オーブ)
  tick(dt) {
    const o = P.orb;
    if (!o) return;
    o.t -= dt;
    const sk = DATA.weapons.bolt.skill, spin = S.time * 5;
    const pos = i => ({ x: P.x + Math.cos(spin + i * TAU / 3) * 20, y: P.y - 3 + Math.sin(spin + i * TAU / 3) * 12 });
    for (let i = 0; i < 3; i++) { const q = pos(i); part(q.x, q.y, 0, 0, 0.15, pick(['#b98bff', '#ffffff']), { glow: true, sz: 2, drag: 0 }); }
    o.shotT -= dt;
    while (o.shotT <= 0) {
      o.shotT += 1 / sk.rate;
      const q = pos(o.n = ((o.n || 0) + 1) % 3), tg = nearestEnemy(q.x, q.y, 200);
      if (tg) barrageShot(o, q.x, q.y, Math.atan2(tg.y - q.y, tg.x - q.x));
    }
    if (o.t <= 0) P.orb = null;
  },
};
// シールド: 被ダメージを HP より先に受ける(最大HP を超えない。時間では消えない)
function gainShield(n) {
  n *= clsShieldGain();
  P.shield = Math.min(Math.max(0, shieldCap() - (P.oShield || 0)), Math.max(P.shield || 0, Math.round(n))); // 整数(割れたときの表示が小数にならないように)。上限はクラスが決める
  addRing(P.x, P.y, 16, '#4f8ff0', { w: 2, life: 0.35 }); burst(P.x, P.y, 14, ['#9fd8ff', '#4f8ff0', '#ffffff'], { sp: 60, glow: true });
  S.hudDirty = true;
}
// バラージュの1回の発射: 通常攻撃(メイン武器)の半分の弾数を、同じ弾速・貫通・追尾で扇状に撃つ。E の攻撃なので発射ごとに属性が変わる
function barrageShot(a, x, y, ang) {
  const sk = DATA.weapons.bolt.skill, w = P.weapons[P.mainW], st = wst(P.mainW), dmg = st.dmg * sk.pow * (1 + cuV('e', 'pow')) * a.pow, el = clsNextEl();
  const n = Math.ceil(((st.count || 1) + P.shots) * sk.countMul), base = ang + rand(-0.12, 0.12); // 弾数は通常攻撃の半分(切り上げ)
  for (let i = 0; i < n; i++) fire('bolt', x, y, base + (i - (n - 1) / 2) * 0.13, st.speed || 200, { dmg, pierce: st.pierce || 0, life: 1.3, src: 'barrage', col: '#b98bff', r: 3, el, eHit: true, home: w.evo, homing: w.evo ? ARCANE_TURN : 0, focus: hasSp('e', 'pow') ? a.id : 0 });
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
      `構え ${sk.windup}秒(動けない)→ 照準位置の半径 ${sk.radius} に ${sk.dur}秒間、矢が降り注ぐ`,
      `${sk.every}秒ごとに、範囲内の敵全員へ 武器の威力 × ${Math.round(sk.pow * 100)}%`,
      '放った後は自由に動ける(雨はその場に残る)',
      'E の攻撃なので、クラスの「攻撃1回ごと」の効果が1回ごとに起きる',
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['攻撃回数', `${Math.round(dur / (sk.every * (heavy ? 0.5 : 1)))} 回 / ${dur.toFixed(1)} 秒`],
      ['1回の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.longbow || {}, R = sk.range * P.range;
    let t = mouseAimPt() || nearestEnemy(P.x, P.y, R) || { x: P.x + P.facing * 60, y: P.y };
    const dd = Math.sqrt(d2(P.x, P.y, t.x, t.y));
    if (dd > R) t = { x: P.x + (t.x - P.x) * R / dd, y: P.y + (t.y - P.y) * R / dd };
    if (t.x !== P.x) P.facing = t.x < P.x ? -1 : 1;
    P.act = { slot: 'e', ph: 'wind', t: 0, x: t.x, y: t.y, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('aRain', MOTIONS.aRain.dur);
    skillCall(sk.name, '#b8ff9a'); AudioMan.click();
  },
  update(a, dt) {
    const sk = weaponSkill(), m = P.wm.longbow || {};
    P.moveMul = 0;
    if (a.t < sk.windup) { if (Math.random() < dt * 30) part(P.x + rand(-8, 8), P.y + 6, rand(-20, 20), -10, 0.4, pick(['#b8ff9a', '#e4ffd8']), { glow: true }); return; }
    const heavy = hasSp('e', 'pow'), delay = 0.25; // 放ってから降り始めるまで
    const follow = hasSp('e', 'cd'); // 追従: ついてくる + 持続 +50%
    zones.push({ kind: 'rain', x: a.x, y: a.y, r: sk.radius * (1 + cuV('e', 'area')) * P.area, t: 0, delay, dur: delay + (sk.dur + (m.eDur || 0)) * (follow ? 1.5 : 1), tick: 0, acc: 0,
      every: sk.every * (heavy ? 0.5 : 1), dmg: wst(P.mainW).dmg * sk.pow * (1 + cuV('e', 'pow')) * a.pow * (heavy ? 0.6 : 1),
      nArrows: sk.arrows, follow, fire: hasSp('e', 'area') ? sk.fire : 0, fireT: sk.fireT, arrows: [] });
    asMine(() => { // 空へ放つ光の矢
      for (let i = 0; i < 10; i++) part(P.x + P.facing * 4, P.y - 10, rand(-30, 30) + P.facing * 20, -rand(200, 320), 0.35, pick(['#e4ffd8', '#b8ff9a', '#ffffff']), { glow: true, drag: 0 });
      addRing(P.x, P.y, 18, '#b8ff9a', { w: 2, life: 0.3 }); shake(2);
    });
    AudioMan.shoot();
    P.act = null;
  },
};

// グランドスラム(騎士剣の E): シールドを得る → 構え → 前方へ衝撃波が数段走る(威力は 武器の威力 + 今のシールド)
WEAPON_SKILL.longsword = {
  info(c, dmg) {
    const sk = DATA.weapons.longsword.skill, m = c.wm, one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      `使うと、シールドを最大HP の ${Math.round(sk.shield * 100)}% 得る(${sk.shieldT}秒)`,
      `構え ${sk.windup}秒(動けない)→ 剣を叩きつけ、前方へ衝撃波が ${sk.steps}段 走る`,
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
    const x0 = P.x, y0 = P.y;
    slamWaves(a, x0, y0, 1);
    if (hasSp('e', 'cd')) setTimeout(() => { if (state === 'play') slamWaves(a, x0, y0, 0.6); }, 1500); // 余震
    P.act = null;
  },
};
// 衝撃波を段ごとに時間差で前へ走らせる(1段 = 1回の E の攻撃)
function slamWaves(a, x0, y0, k) {
  const sk = DATA.weapons.longsword.skill, m = P.wm.longsword || {}, n = sk.steps + (m.eSteps || 0), fly = hasSp('e', 'guard'), crack = hasSp('e', 'pow');
  for (let i = 0; i < n; i++) setTimeout(() => {
    if (state !== 'play') return;
    const d = sk.stepD * (i + 1) * P.area, x = x0 + Math.cos(a.a) * d, y = y0 + Math.sin(a.a) * d, R = sk.waveR * P.area, el = clsNextEl();
    const dmg = (wst(P.mainW).dmg * sk.pow * (1 + cuV('e', 'pow')) * a.pow + shieldTotal()) * k; // シールドはそのまま足す
    asMine(() => {
      forEachNear(x, y, R, e => {
        if (e.prop) { killEnemy(e); return; }
        hitEnemy(e, dmg, { src: 'slam', ang: a.a, kb: fly ? 220 : 70, col: '#ffe9a0', el, eHit: true });
        if (fly && !e.dead) e.stun = Math.max(e.stun || 0, 1.5); // 吹き飛ばし
      });
      addRing(x, y, R, '#ffe9a0', { w: 2, life: 0.3 }); addFlash(x, y, R * 2.4, '#fff1d0', 0.25);
      burst(x, y, 18, ['#8a7a60', '#5a4a3a', '#ffe9a0', '#ffffff'], { sp: 110, up: 50, g: 180, life: 0.6 }); // 岩の破片と土煙
      shockAt(x, y, 1, 1); shake(4 + i);
      if (crack) zones.push({ kind: 'crack', x, y, r: R, t: 0, dur: 5, tick: 0.5, dmg: wst(P.mainW).dmg * 0.8 }); // 地割れ
    });
    AudioMan.boom();
  }, i * sk.gap * 1000);
}

// 火炎放射(ファイアーの E): 構え → 照準方向へ扇形に炎を吹き続ける(移動は遅くなる)。火炎旋風: 終わりに先端へ炎の竜巻
WEAPON_SKILL.fire = {
  info(c, dmg) {
    const sk = DATA.weapons.fire.skill, m = c.wm, dur = sk.dur + (c.hasSp('e', 'cd') ? 1 : 0) + (m.eDur || 0), one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      `構え ${sk.windup}秒(動けない)→ ${sk.dur}秒間、照準方向へ扇形に炎を吹き続ける`,
      `${sk.every}秒ごとに、範囲内の敵へ 武器の威力 × ${Math.round(sk.pow * 100)}% と炎上(武器の燃焼/s × ${Math.round(sk.burn * 100)}% を 3秒)`,
      `放射中は移動速度 ×${sk.slow}`,
      'E の攻撃なので、クラスの「攻撃1回ごと」の効果が1回ごとに起きる',
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['放射', `${Math.round(dur / sk.every)} 回 / ${dur.toFixed(1)} 秒`],
      ['長さ', `${Math.round(sk.len * (1 + c.cuV('e', 'len')) * (1 + c.st.v.area) * c.st.mul.area)}`],
      ['1回の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.fire || {}, dur = sk.dur + (hasSp('e', 'cd') ? 1 : 0) + (m.eDur || 0); // 持続放射
    P.act = { slot: 'e', ph: 'wind', t: 0, dur, acc: 0, a: aimDir(sk.len * 1.5), pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('pFlame', MOTIONS.pFlame.duration(dur), dur);
    skillCall(sk.name, '#ff8a3d'); AudioMan.click();
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
    const sk = weaponSkill(), blue = hasSp('e', 'pow'), L = sk.len * (1 + cuV('e', 'len')) * P.area;
    a.a = aimDir(L * 1.5);
    if (Math.cos(a.a) !== 0) P.facing = Math.cos(a.a) < 0 ? -1 : 1;
    if (a.ph === 'wind') { // 構え: 杖先に火が集まる
      P.moveMul = 0;
      if (Math.random() < dt * 40) part(P.x + P.facing * 10 + rand(-6, 6), P.y - 8 + rand(-6, 6), -P.facing * 20, -10, 0.3, pick(['#ff6a2a', '#ffc34a']), { glow: true });
      if (a.t >= sk.windup) { a.ph = 'fire'; a.t0 = a.t; }
      return;
    }
    P.moveMul *= sk.slow;
    P.flame = { a: a.a, len: L, arc: sk.arc, blue, t: a.t - a.t0 };
    flamePuffs(a.a, L, sk.arc, blue, dt);
    a.acc += dt;
    while (a.acc >= sk.every) { a.acc -= sk.every; flameTick(a, L, blue); }
    if (a.t - a.t0 >= a.dur) {
      P.flame = null; P.act = null;
      if (hasSp('e', 'len')) { // 火炎旋風
        const st = wst(P.mainW);
        zones.push({ kind: 'vortex', x: P.x + Math.cos(a.a) * L, y: P.y + Math.sin(a.a) * L, r: sk.vortexR * P.area, t: 0, dur: sk.vortexT, tick: 0, every: sk.vortexEvery,
          dmg: st.dmg * sk.vortexPow * (1 + cuV('e', 'pow')) * a.pow, pull: sk.pull, blue });
      }
    }
  },
};
// 火炎放射の見た目: 杖先から炎の塊を噴き出す(描画は render.js)。先端の速さは長さ L に届くように
function flamePuffs(ang, L, arc, blue, dt) {
  const fp = S.flamePuffs || (S.flamePuffs = []), n = Math.round(dt * 110 * gq().parts) || 1;
  const nx = P.x + Math.cos(ang) * 9, ny = P.y - 6 + Math.sin(ang) * 6;
  for (let i = 0; i < n && fp.length < 260; i++) {
    const d = ang + rand(-arc / 2, arc / 2) * rand(0.3, 1), life = rand(0.32, 0.45), sp = L / life * rand(1.25, 1.55);
    fp.push({ x: nx + rand(-1, 1), y: ny + rand(-1, 1), vx: Math.cos(d) * sp, vy: Math.sin(d) * sp, t: 0, life, r0: rand(1, 2), r1: rand(6, 10) * P.area, blue, seed: Math.random() });
  }
  if (Math.random() < dt * 25) part(nx, ny, Math.cos(ang) * L * 2 + rand(-40, 40), Math.sin(ang) * L * 2 + rand(-40, 40), rand(0.3, 0.5), blue ? '#ffffff' : pick(['#ffc34a', '#fff6c8']), { glow: true, drag: 2 }); // 火の粉
}
// 火炎放射の1回: 扇形の中の敵へダメージと炎上(1回 = 1回の E の攻撃)
function flameTick(a, L, blue) {
  const sk = DATA.weapons.fire.skill, st = wst(P.mainW), dmg = st.dmg * sk.pow * (1 + cuV('e', 'pow')) * a.pow, burn = (st.burn || 0) * sk.burn * (blue ? 2 : 1), el = clsNextEl();
  asMine(() => forEachNear(P.x, P.y, L, e => {
    let diff = Math.atan2(e.y - P.y, e.x - P.x) - a.a;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > sk.arc / 2) return;
    if (e.prop) { killEnemy(e); return; }
    hitEnemy(e, dmg, { src: 'flamer', ang: a.a, kb: 6, col: blue ? '#7ad7ff' : '#ff8a3d', el, eHit: true, noNum: Math.random() < 0.6 });
    if (!e.dead) addBurn(e, burn, 3, 'flamer');
  }));
  if (Math.random() < 0.3) AudioMan.fire();
}

// アイシクルフォール(ブリザードの E): 構え → 照準位置につららが降り続ける(放った後は動ける)
// つららそのものは zones の 'icicle'(world.js の updZones で落とす)
WEAPON_SKILL.blizzard = {
  info(c, dmg) {
    const sk = DATA.weapons.blizzard.skill, m = c.wm, n = sk.n + c.cuV('e', 'n') + (m.eCount || 0), one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0));
    return { name: sk.name, cat: 'e', desc: [
      `構え ${sk.windup}秒(動けない)→ 照準位置(半径 ${sk.radius})に、${sk.dur}秒かけてつららが降る`,
      `つららは範囲内の敵を狙って落ちる(いなければランダムな位置)`,
      `つらら1本: 半径 ${sk.iceR} に 武器の威力 × ${Math.round(sk.pow * 100)}% と凍傷 +${sk.frost}`,
      '放った後は自由に動ける(つららはその場に降り続ける)',
      'E の攻撃なので、クラスの「攻撃1回ごと」の効果が1本ごとに起きる',
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['つらら', `${Math.round(n * (c.hasSp('e', 'cd') ? sk.rainK : 1))} 本 / ${sk.dur} 秒`],
      ['1本の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.blizzard || {}, R = sk.range * P.range;
    let t = mouseAimPt() || nearestEnemy(P.x, P.y, R) || { x: P.x + P.facing * 60, y: P.y };
    const dd = Math.sqrt(d2(P.x, P.y, t.x, t.y));
    if (dd > R) t = { x: P.x + (t.x - P.x) * R / dd, y: P.y + (t.y - P.y) * R / dd };
    if (t.x !== P.x) P.facing = t.x < P.x ? -1 : 1;
    P.act = { slot: 'e', ph: 'wind', t: 0, x: t.x, y: t.y, pow: clsESkillMul() * (1 + (m.ePow || 0)) };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('cIcicle', MOTIONS.cIcicle.dur);
    skillCall(sk.name, '#bff4ff'); AudioMan.click();
  },
  update(a, dt) {
    const sk = weaponSkill(), m = P.wm.blizzard || {};
    P.moveMul = 0;
    if (a.t < sk.windup) { // 頭上に氷の魔法陣
      if (Math.random() < dt * 40) { const r = rand(0, TAU); part(P.x + Math.cos(r) * 12, P.y - 22 + Math.sin(r) * 4, 0, -10, 0.35, pick(['#bff4ff', '#ffffff']), { glow: true }); }
      return;
    }
    const n = Math.round((sk.n + cuV('e', 'n') + (m.eCount || 0)) * (hasSp('e', 'cd') ? sk.rainK : 1)); // 氷雨: 攻撃頻度 1.5倍
    zones.push({ kind: 'icicle', x: a.x, y: a.y, r: sk.radius * P.area, t: 0, dur: sk.dur + 0.5, tick: 0, acc: 0, every: sk.dur / n, left: n, ices: [],
      dmg: wst(P.mainW).dmg * sk.pow * (1 + cuV('e', 'pow')) * a.pow, iceR: sk.iceR * P.area, frost: sk.frost,
      patch: hasSp('e', 'n'), big: hasSp('e', 'pow') ? wst(P.mainW).dmg * sk.bigPow * (1 + cuV('e', 'pow')) * a.pow : 0, bigR: sk.bigR * P.area });
    asMine(() => { addRing(a.x, a.y, sk.radius * P.area, '#bff4ff', { w: 2, life: 0.4 }); addFlash(P.x, P.y - 20, 40, '#bff4ff', 0.25); });
    AudioMan.blizz();
    P.act = null;
  },
};

// グラビティスパーク(サンダーの E): 構え → 照準位置に雷の球。周りの敵を1回大きく引き寄せて爆発(zones の 'gspark')
WEAPON_SKILL.thunder = {
  info(c, dmg) {
    const sk = DATA.weapons.thunder.skill, m = c.wm, one = dmg * sk.pow * (1 + c.cuV('e', 'pow')) * (1 + (m.ePow || 0)), ar = (1 + c.cuV('e', 'area')) * (1 + c.st.v.area) * c.st.mul.area;
    return { name: sk.name, cat: 'e', desc: [
      `構え ${sk.windup}秒(動けない)→ 照準位置に雷の球を放つ`,
      `周りの敵を中心へ1回だけ大きく引き寄せ(ボス以外)、直後に爆発(武器の威力 × ${Math.round(sk.pow * 100)}%、感電 ${Math.round(sk.shock * 100)}%)`,
      'E の攻撃なので、クラスの「攻撃1回ごと」の効果が爆発で起きる',
    ], rows: [
      ['CD', `<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      ['引き寄せ / 爆発の半径', `${Math.round(sk.pullR * ar * (1 + (m.eArea || 0)))} / ${Math.round(sk.boomR * ar)}`],
      ['爆発の威力', `${Math.round(one)} → <b>${Math.round(one * c.atkMul)}</b>`, '武器の威力 × ' + Math.round(sk.pow * 100) + '%。攻撃力を掛けた値'],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.thunder || {}, R = sk.range * P.range;
    let t = mouseAimPt() || nearestEnemy(P.x, P.y, R) || { x: P.x + P.facing * 60, y: P.y };
    const dd = Math.sqrt(d2(P.x, P.y, t.x, t.y));
    if (dd > R) t = { x: P.x + (t.x - P.x) * R / dd, y: P.y + (t.y - P.y) * R / dd };
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
    gravitySpark(a.x, a.y, a.pow, 1, hasSp('e', 'area'));
    P.act = null;
  },
};
// グラビティスパークの球を置く(k: 威力の倍率。again: 二重重力でもう一度)
function gravitySpark(x, y, pow, k, again) {
  const sk = DATA.weapons.thunder.skill, m = P.wm.thunder || {}, ar = (1 + cuV('e', 'area')) * P.area;
  zones.push({ kind: 'gspark', x, y, r: sk.pullR * ar * (1 + (m.eArea || 0)), boomR: sk.boomR * ar, t: 0, tick: 0, pulled: false, boomed: false,
    dur: hasSp('e', 'cd') ? sk.boomT + sk.fieldT : sk.boomT + 0.15, dmg: wst(P.mainW).dmg * sk.pow * (1 + cuV('e', 'pow')) * pow * k, field: hasSp('e', 'cd'), stun: hasSp('e', 'pow') });
  if (again) setTimeout(() => { if (state === 'play') gravitySpark(x, y, pow, sk.againK, false); }, sk.againT * 1000); // 二重重力
  AudioMan.zap();
}

function ranbuHit(sk) {
  const R = sk.radius * P.area, dmg = wst(P.mainW).dmg * sk.pow * (1 + cuV('e', 'pow')) * P.act.pow, k0 = S.kills, el = clsNextEl(); // 1回の斬撃 = 1属性
  asMine(() => {
    forEachNear(P.x, P.y, R, e => { if (!e.prop) hitEnemy(e, dmg, { src: 'ranbu', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 25, col: '#ffb7d5', noNum: Math.random() < 0.4, el, eHit: true }); });
    slashes.push({ x: P.x, y: P.y, a: rand(0, TAU), r: R * rand(0.8, 1.1), t: 0, life: 0.18, flip: Math.random() < 0.5 });
    burst(P.x + rand(-R, R) * 0.6, P.y + rand(-R, R) * 0.6, 6, ['#ffb7d5', '#ffffff'], { sp: 70, glow: true, life: 0.3 });
    shake(1.5);
  });
  AudioMan.slash();
  if (hasSp('e', 'cd')) P.sk.e.cd = Math.max(0, P.sk.e.cd - (S.kills - k0)); // 剣の舞: 撃破1体ごとに CD -1秒
}
function sakuraBurst(sk) {
  const R = sk.burstR * P.area, dmg = wst(P.mainW).dmg * sk.burst * (1 + cuV('e', 'pow')) * P.act.pow;
  asMine(() => {
    forEachNear(P.x, P.y, R, e => { if (!e.prop) hitEnemy(e, dmg, { src: 'ranbu', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 120, col: '#ff8ac0', eHit: true }); });
    addRing(P.x, P.y, R, '#ffb7d5', { w: 3, life: 0.5 }); addRing(P.x, P.y, R * 0.6, '#ffffff', { w: 2, life: 0.35 });
    addFlash(P.x, P.y, R * 2, '#ffb7d5', 0.5); shockAt(P.x, P.y, 1.6, 0.9);
    burst(P.x, P.y, 70, ['#ffb7d5', '#ff8ac0', '#ffffff'], { sp: 170, glow: true, life: 0.8, drag: 1.5 });
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
      P.act = { slot: 'q', ph: 'wind', t: 0, a, ki: P.ki, x0: P.x, y0: P.y, hits: new Set(), back: false };
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
        if (hasSp('q', 'cd') && !a.back) { a.back = true; a.hits = new Set(); a.t0 = a.t; a.x0 = P.x; a.y0 = P.y; return; } // 燕返し
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
        out.push({ id: 'zanshin', glyph: '残', name: '残心' + (k > 1 ? '(背水)' : ''), fx: `攻撃力 +${Math.round(zanshinAtk() * k * 100)}%` + (mv ? ` 移動 +${Math.round(mv * 100)}%` : '') + (hasSp('passive', 'migaru') ? ' 被ダメ -25%' : ''), t: P.zanshinT, max: c.zanshinT + cuV('passive', 'jizoku'), kind: 'buff' });
      }
      if (kiHigh()) out.push({ id: 'kiHigh', glyph: '気', name: hasSp('trait', 'juu') ? '明鏡止水' : '剣気解放', fx: `攻撃力 +${Math.round(cuV('trait', 'juu', c.kiFullAtk) * 100)}%` + (hasSp('trait', 'juu') ? ' 攻撃速度 +25% 被ダメ -30%' : ''), kind: 'buff' });
      if (P.breakT > 0) out.push({ id: 'break', glyph: '崩', name: 'ガードブレイク', fx: `ガード不可 被ダメ +${Math.round(c.breakDmg * 100)}%`, t: P.breakT, max: c.breakT, kind: 'debuff' });
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
          '通過した敵をまとめて斬る',
          `剣気を全て消費し、剣気1につき威力 +${q.kiPow}`,
          '威力は武器に依存しない',
        ], rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['威力', `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, `消費した剣気1につき +${(q.kiPow * k).toFixed(1)}(武器に依存しない)`],
          ['突進距離', `${Math.round(q.dist * (1 + c.cuV('q', 'reach')))}`],
        ] },
        { key: 'Space', name: '見切り', desc: [
          `長押しでガード(移動 ×${p.guardSlow})。構えた瞬間にスタミナ ${p.guardCost}`,
          `構えてから ${p.parryWin}秒以内に受けるとジャスト見切り`,
          `  → スタミナを使わず周囲に反撃・剣気 +${p.kiParry}・無敵 ${p.parryIfr}秒`,
          'それ以外は受けたダメージ分のスタミナで受ける',
          `スタミナ 0 でガードブレイク(${p.breakT}秒 ガード不可・被ダメ +${Math.round(p.breakDmg * 100)}%)`,
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
      P.crystal = 0; P.crystalMax = MG().crystalMax + (P.lvFx.crystalMax || 0);
      P.elI = 0; P.flowWin = 0; P.flowT = 0; P.echoT = 0; P.ovf = 0; P.calmT = 0; P.blinkHeld = false; P.meteors = [];
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
      if (hasSp('passive', 'flow') && (P.sk.e.cd <= 0 || P.sk.q.cd <= 0)) P.ovf = Math.min(0.5, P.ovf + 0.05);
      const c = Math.min(cut, cap - P.flowWin);
      if (c <= 0) return;
      P.flowWin += c;
      for (const k in P.sk) P.sk[k].cd = Math.max(0, P.sk[k].cd - c);
    },
    // 次の攻撃の属性(三重詠唱: 15% で全属性)
    nextEl() {
      if (hasSp('trait', 'el') && Math.random() < 0.15) return 'all';
      return ELS[P.elI++ % 3];
    },
    onElement: (e, el, dealt) => mageAddEl(e, el, dealt),
    onSkill() { P.echoT = 5; },
    // オーバーフロー: 貯めたスキル威力を使う
    eMul() { const k = 1 + P.ovf; P.ovf = 0; return k; },
    atkBonus: () => 0,
    res: () => ({ kind: 'crystal', label: '魔力結晶', v: P.crystal, max: P.crystalMax, seg: true, dk: '#1d4a7a' }),
    statuses() {
      const out = [], e = cuV('passive', 'echo'), sp = hasSp('passive', 'echo');
      if (P.echoT > 0 && (e || sp)) out.push({ id: 'echo', glyph: '韻', name: sp ? '詠唱加速' : '余韻', fx: (e ? `攻撃速度 +${Math.round(e * 100)}%` : '') + (sp ? ' 弾数 +1' : ''), t: P.echoT, max: 5, kind: 'buff' });
      if (P.ovf > 0) out.push({ id: 'ovf', glyph: '溢', name: 'オーバーフロー', fx: `次のスキルの威力 +${Math.round(P.ovf * 100)}%`, kind: 'buff' });
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
        ], rows: [
          ['凍傷の上限', `${MG().frostCap + (c.run && cuLv('trait', 'el') ? DATA.classes.mage.elFrost[cuLv('trait', 'el') - 1] : 0)}`],
          ['連鎖', `${p.chainN + (c.run ? cuLv('trait', 'el') : 0)} 体`],
          ['共鳴の威力', `${Math.round(p.resoPow * (1 + c.cuV('trait', 'rpow') + (c.lvFx.resoPow || 0)))} → <b>${Math.round(p.resoPow * (1 + c.cuV('trait', 'rpow') + (c.lvFx.resoPow || 0)) * c.atkMul)}</b>`, '3属性目が当たると爆発。魔力結晶 +1'],
          ['共鳴の半径', `${Math.round(p.resoR * (1 + c.cuV('trait', 'rarea')) * (1 + c.st.v.area) * c.st.mul.area)}`],
          ['魔力結晶の上限', `${p.crystalMax + (c.lvFx.crystalMax || 0)}`],
        ] },
        { key: 'パッシブ', name: '魔力循環', cat: 'passive', desc: [
          'メイン武器の通常攻撃が1回命中するごとに、E と Q のクールダウンが短くなる',
          '1秒あたりに短くなる量には上限がある',
        ], rows: [
          ['1回の短縮', `<b>${(p.flowCut + c.cuV('passive', 'flow') + (c.lvFx.flowCut || 0)).toFixed(2)}</b> 秒`],
          ['1秒あたりの上限', `${(p.flowCap + c.cuV('passive', 'cap')).toFixed(1)} 秒`],
        ] },
        { key: 'Q', name: 'メテオ', cat: 'q', desc: [
          `詠唱 ${DATA.classes.mage.q.windup}秒(動けない)→ 照準位置に隕石が落ちる(炎上を付与)`,
          `魔力結晶を全て消費し、1つにつき威力 +${Math.round(DATA.classes.mage.q.crystalPow * 100)}%・半径 +${Math.round(DATA.classes.mage.q.crystalR * 100)}%`,
          '威力は武器に依存しない',
        ], rows: [
          ['CD', `<b>${(DATA.classes.mage.q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['威力', `${Math.round(DATA.classes.mage.q.pow * (1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0)))} → <b>${Math.round(DATA.classes.mage.q.pow * (1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0)) * c.atkMul)}</b>`, '魔力結晶1つにつき 威力 +20%・半径 +10%(武器に依存しない)'],
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
    init() { P.focus = 0; P.dash = null; P.backHeld = false; },
    update(dt) {
      const p = AR(), max = focusMax();
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
      if (hasSp('trait', 'carve')) { // 守印: 倒した敵の印の数だけシールド(5秒)
        timedShield(e.mark, p.guardT);
        part(e.x, e.y, (P.x - e.x) * 3, (P.y - e.y) * 3, 0.3, '#7ab8ff', { glow: true, sz: 2, drag: 0 });
      }
      const k = cuV('trait', 'spread');
      if (k) { // 伝播: 近くの敵へ印を移す
        const n = Math.floor(e.mark * k);
        let best = null, bd = p.spreadR * p.spreadR;
        forEachNear(e.x, e.y, p.spreadR, o => { if (o === e || o.dead || o.prop) return; const d = d2(o.x, o.y, e.x, e.y); if (d < bd) { bd = d; best = o; } });
        if (best && n > 0) { addMark(best, n); bolts.push({ x0: e.x, y0: e.y, x1: best.x, y1: best.y, t: 0, life: 0.15, w: 1 }); }
      }
      if (hasSp('trait', 'spread')) P.sk.q.cd = Math.max(0, P.sk.q.cd - p.chainCd); // 狩りの連鎖
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
      if (f > 0) out.push({ id: 'focus', glyph: '集', name: `集中 ${f}段`, fx: `攻撃速度 +${Math.round(f * p.focusAtkSpd * 100)}% クリティカル率 +${(f * (p.focusCrit + cuV('passive', 'eye')) * 100).toFixed(1)}%` + (hasSp('passive', 'calm') && f >= focusMax() ? ' 被ダメ -20%' : '') + (hasSp('passive', 'eye') && f >= focusMax() ? ' 弾数 +1' : ''), kind: 'buff' });
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
          `構え ${q.windup}秒(動けない)→ 画面内の印を持つ敵1体につき1本、その敵へまっすぐ高速の矢(貫通無限)`,
          `矢が当たった敵は、印1つにつき ${q.markPow} の追加ダメージを連続で受ける(印は消費)`,
          '  → 途中で貫いた敵も、印を持っていれば同じく受ける',
          `さらに無条件で、最寄りの ${q.none}体へも1本ずつ(最大 ${q.max}本)`,
          '威力は武器に依存しない',
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
          `E か Q を使うと、発動前に最大HP の ${Math.round(p.skillGain * 100)}% のシールドを得る(Q はそのまま消費に含まれる)`,
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
          `構え ${q.windup}秒(動けない)→ シールドを全て消費し、前方の扇形に光の衝撃`,
          `威力: ${q.pow} + 消費したシールド × ${q.perShield}`,
          `当たった敵を押し返し、${q.stun} + 消費したシールド × ${q.stunPer}秒 スタン`,
          '威力は武器に依存しない',
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
    burnCrit: e => pyWhite(e),
    burnDur: () => cuV('trait', 'dur'),
    critBonus: e => (pyWhite(e) ? PY().whiteCrit : 0), // 白炎
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
          '対象はすべての炎上(武器・スキル・装備の出どころを問わない)',
        ], rows: [
          ['火勢の最大スタック', `${p.stackMax + c.cuV('trait', 'stack')}`],
          ['燃え移る量', `<b>${Math.round(c.cuV('trait', 'spread', p.spreadPct) * 100)}%</b>`],
          ['炎上の持続', `+${c.cuV('trait', 'dur')} 秒`],
        ] },
        { key: 'パッシブ', name: '焔纏い', cat: 'passive', desc: [
          'E か Q を使うと、焔を纏う(使うたびに時間が戻る)',
          '纏っている間、全武器の攻撃(通常攻撃・E)が命中すると、与えたダメージの一部を 3秒の炎上で付ける',
          '  → サブ武器も対象。炎上そのもの・Q・爆風からは付かない',
        ].concat(kin ? [`纏った瞬間、周り(半径 ${p.kindleR})に火の輪`] : []), rows: [
          ['纏う時間', `<b>${c.cuV('passive', 'wear', p.wearT)}</b> 秒`],
          ['付与量', `<b>${Math.round((c.cuV('passive', 'ignite', p.ignite) + (c.lvFx.ignite || 0)) * 100)}%</b>`],
        ].concat(kin ? [['火の輪の威力', `${kin} → <b>${Math.round(kin * c.atkMul)}</b>`]] : []) },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒(動けない)→ 画面内の炎上中の敵全員の炎上を、まとめて爆発させる`,
          `各敵に、基礎威力 ${q.base} + 残っていた炎上ダメージ × 爆発の倍率 をすぐに与える(炎上は消費する)`,
          `その敵の周り(半径 ${q.r})に 基礎威力 ${q.pow} + 炎上スタック数 × ${q.perStack} の爆風`,
          '炎上中の敵がいなくても使える(自分の周りに爆風だけ)。威力は武器に依存しない',
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
    // 凍結中: 被ダメ +freezeDmg、凍傷を付ける攻撃ならさらに +frostHit(永久凍土: どちらも 2倍)
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
          'E か Q を使うと、冷気を纏う(使うたびに時間が戻る)',
          '纏っている間、全武器の攻撃(通常攻撃・E)が命中すると、その敵に凍傷 +1',
          '  → サブ武器も対象',
        ], rows: [
          ['纏う時間', `<b>${c.cuV('passive', 'wear', p.wearT) + (c.lvFx.wearT || 0)}</b> 秒`],
        ].concat(c.cuV('passive', 'armor') ? [['纏った瞬間のシールド', `最大HP の ${Math.round(c.cuV('passive', 'armor') * 100)}%`]] : []) },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒(動けない)→ 自分を中心に ${q.dur}秒間、細氷の領域(自分についてくる)`,
          `範囲内の敵に、${q.every}秒ごとに凍傷 +${q.frost} とダメージ`,
          `この範囲内で凍結した敵は、凍結時間 +${Math.round(q.freezeUp * 100)}%`,
          '威力は武器に依存しない',
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
          'E か Q を使うと、雷を纏う(使うたびに時間が戻る)',
          '纏っている間、全武器の攻撃(通常攻撃・E)に感電が付く',
          '  → サブ武器も対象',
        ], rows: [
          ['纏う時間', `<b>${c.cuV('passive', 'wear', p.wearT)}</b> 秒`],
          ['感電', `<b>${Math.round((c.cuV('passive', 'shock', p.wearShock) + (c.lvFx.wearShock || 0)) * 100)}%</b>`],
        ] },
        { key: 'Q', name: q.name, cat: 'q', desc: [
          `構え ${q.windup}秒(動けない)→ 画面内のランダムな位置に鉄塔を落とす(落ちた瞬間に落雷)`,
          `${q.dur}秒間、各鉄塔は ${q.every}秒ごとに近くの敵 1体へ電気を放つ(感電 ${Math.round(q.shock * 100)}%)`,
          '放電は発動時に1回。この Q の攻撃すべてに放電の感電が乗る。威力は武器に依存しない',
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
};

// 居合の斬撃: 通過した敵にまとめてダメージ(少し遅れて斬撃線が炸裂する)
function iaiStrike(a) {
  const q = DATA.classes.samurai.q, full = a.ki >= DATA.classes.samurai.params.kiFull, ittou = hasSp('q', 'pow') && full;
  const dmg = (q.pow + a.ki * q.kiPow) * (1 + cuV('q', 'pow') + (P.lvFx.qPow || 0)) * (a.back ? 0.6 : 1) * (ittou ? 1.5 : 1);
  const x0 = a.x0, y0 = a.y0, x1 = P.x, y1 = P.y, hits = [...a.hits];
  slashes.push({ line: true, x: x0, y: y0, x1, y1, t: 0, life: 0.2, w: 2 }); // 突進の軌跡(細い線。直後の炸裂との差を出す)
  setTimeout(() => asMine(() => {
    if (state !== 'play' && state !== 'levelup') return;
    for (const e of hits) if (!e.dead) {
      hitEnemy(e, dmg, { src: 'iai', ang: a.a, kb: 120, col: '#ff3b5c' });
      if (ittou && !e.dead) { e.bleed = (e.bleed || 0) + 10; e.bleedT = DATA.bleed.dur; } // 一刀両断: 出血 10スタック
      burst(e.x, e.y, 10, ['#ff3b5c', '#ffffff'], { sp: 100, glow: true, life: 0.35 });
    }
    slashes.push({ line: true, x: x0, y: y0, x1, y1, t: 0, life: 0.3, w: full ? 8 : 6 });
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    hitstop(0.08); shake(full ? 10 : 7); screenFlash((full ? 0.3 : 0.2) * SET.fxA, full ? '#ff3b5c' : '#ffffff');
    shockAt(mx, my, full ? 1.8 : 1.3, 1); addFlash(mx, my, 120, full ? '#ff3b5c' : '#ffffff', 0.4);
    if (full) addRing(mx, my, 70, '#ff3b5c', { w: 3, life: 0.45 });
    AudioMan.slash(); AudioMan.crit();
  }), 110);
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

// ジャスト見切り: スタミナを使わず、剣気を得て周囲に反撃
function samuraiParry() {
  const c = DATA.classes.samurai.params;
  kiAdd(c.kiParry);
  P.ifr = c.parryIfr; P.guard = false;
  asMine(() => {
    const R = c.parryR * P.area;
    forEachNear(P.x, P.y, R, e => { if (!e.prop) hitEnemy(e, c.parryPow, { src: 'parry', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 80, col: '#ffffff' }); });
    slashes.push({ x: P.x, y: P.y, a: 0, r: R, t: 0, life: 0.25, full: true });
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
// 属性の効果(dealt: 実際に与えたダメージ。攻撃力を掛けた後なので、追加ダメージは dmgMul で割って基礎値に戻す)
function elEffect(e, el, dealt) {
  const p = MG(), L = cuLv('trait', 'el');
  if (el === 'fire') {
    const perSec = dealt * p.burnPct * (1 + 0.1 * L) / p.burnDur / dmgMul();
    addBurn(e, perSec, p.burnDur, 'elfire'); // 炎上はスタックする
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
  const p = MG(), R = p.resoR * (1 + cuV('trait', 'rarea')) * P.area, dmg = p.resoPow * (1 + cuV('trait', 'rpow') + (P.lvFx.resoPow || 0));
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
  if (hasSp('trait', 'rarea')) zones.push({ kind: 'hole', x, y, r: R * 0.8, t: 0, dur: 1, tick: 0, dmg: 0, pull: 90 }); // 特異点
  if (P.crystal < P.crystalMax) {
    P.crystal++;
    part(x, y, (P.x - x) * 2, (P.y - y) * 2, 0.5, '#9ff7ff', { glow: true, sz: 2, drag: 0 });
    if (P.crystal === P.crystalMax) { AudioMan.levelup(); addRing(P.x, P.y, 26, '#7ad7ff', { w: 2, life: 0.4 }); }
  }
  AudioMan.boom();
}
const blinkCost = () => MG().blinkCost - (P.lvFx.blinkCut || 0);
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
  P.meteors = (P.meteors || []).concat([{ x: a.x, y: a.y, t: 0, fall: q.fall, R: a.R, dmg: a.dmg, big: 1 + a.n * 0.2, main: true }]);
  P.act = null;
}
// 落下中の隕石: 空から尾を引いて落ち、着弾で爆発
function updMeteors(dt) {
  if (!P.meteors || !P.meteors.length) return;
  for (let i = P.meteors.length - 1; i >= 0; i--) {
    const m = P.meteors[i];
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
  asMine(() => {
    forEachNear(m.x, m.y, m.R, e => {
      if (e.prop) { killEnemy(e); return; }
      const dealt = hitEnemy(e, m.dmg, { src: 'meteor', ang: Math.atan2(e.y - m.y, e.x - m.x), kb: m.main ? 150 : 60, col: '#ff8a3d' });
      if (dealt && !e.dead) elEffect(e, 'fire', dealt); // 炎上
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
  if (hasSp('q', 'pow')) for (let i = 0; i < 5; i++) { // メテオスウォーム
    const a = rand(0, TAU), r = rand(R * 0.5, R * 1.3);
    P.meteors.push({ x: m.x + Math.cos(a) * r, y: m.y + Math.sin(a) * r, t: 0, fall: 0.25, delay: 0.08 * (i + 1), R: 24 * P.area, dmg: 50, big: 0.6 });
  }
  if (hasSp('q', 'cd')) for (let i = 0; i < 6; i++) setTimeout(() => { // 審判
    if (state !== 'play') return;
    const a = rand(0, TAU), r = rand(0, R), x = m.x + Math.cos(a) * r, y = m.y + Math.sin(a) * r;
    asMine(() => {
      forEachNear(x, y, 24 * P.area, e => { if (!e.prop) hitEnemy(e, 50, { src: 'meteor', col: '#fff27a' }); });
      bolts.push({ x0: x + rand(-20, 20), y0: cam.y - 10, x1: x, y1: y, t: 0, life: 0.22, w: 2 });
      addFlash(x, y, 60, '#fff27a', 0.25); addRing(x, y, 24 * P.area, '#fff27a', { life: 0.3 });
    });
    AudioMan.zap();
  }, 250 + i * 110);
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

// ---------- world.js から呼ぶ入口 ----------
const clsRT = () => CLASS_RT[P.cls];
function clsInit() {
  P.sta = P.maxSta; P.staLockT = 0; P.moveMul = 1; P.invT = 0; P.atkSpd = 1; P.cu = {}; P.cs = {};
  P.sk = { q: { cd: 0, max: 1 }, e: { cd: 0, max: 1 } }; P.act = null; P.anim = null; P.orb = null; P.dash = null; P.flame = null;
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
  if (WEAPON_SKILL[P.mainW] && WEAPON_SKILL[P.mainW].tick) WEAPON_SKILL[P.mainW].tick(dt);
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
const clsCritBonus = e => (clsRT() && clsRT().critBonus ? clsRT().critBonus(e) : 0);
const clsCritDmgBonus = e => (clsRT() && clsRT().critDmgBonus ? clsRT().critDmgBonus(e) : 0);
function clsOnKill(e) { if (clsRT() && clsRT().onKill) clsRT().onKill(e); }
// 凍傷(共通の仕組み)へのクラスの補正: 上限・付いたとき(凍結)・ボスの攻撃速度
const clsFrostCap = () => (clsRT() && clsRT().frostCap ? clsRT().frostCap() : 0);
function clsOnFrost(e) { if (clsRT() && clsRT().onFrost) clsRT().onFrost(e); }
const clsBossRate = e => (clsRT() && clsRT().bossRate ? clsRT().bossRate(e) : 1);
// 感電(共通の仕組み)へのクラスの補正(n: 連鎖の追加 / nMul: 連鎖数の倍率 / r: 距離の倍率 / dmg: ダメージの倍率)と、起きたとき
const clsShockMod = e => (clsRT() && clsRT().shockMod ? clsRT().shockMod(e) : null);
function clsOnShock(o) { if (clsRT() && clsRT().onShock) clsRT().onShock(o); }
const clsBlockProj = () => !!(clsRT() && clsRT().blockProj && clsRT().blockProj()); // 敵の弾を消す(静電気)
// 感電: 命中した敵 e から近くの敵へ雷が連鎖し、与えたダメージ dealt の pct を与える(同じ敵には戻らない)
//   o.n: 連鎖数(基本 1)/ o.r: 連鎖距離 / o.src: ダメージの出どころ / o.noCharge: 帯電を増やさない(放電)
function addShock(e, dealt, pct, o = {}) {
  if (!(pct > 0) || !(dealt > 0)) return;
  const m = clsShockMod(e) || { n: 0, nMul: 1, r: 1, dmg: 1 };
  const n = Math.max(1, Math.floor(((o.n || 1) + m.n) * m.nMul)), R = (o.r || DATA.debuff.shockR) * m.r, dmg = dealt * pct * m.dmg / dmgMul();
  const done = new Set([e]);
  let cur = e;
  asMine(() => {
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
// 武器の命中(全武器の通常攻撃・E。炎上などの継続ダメージは除く)
function clsOnWeaponHit(e, dmg, crit) { if (clsRT() && clsRT().onWeaponHit) clsRT().onWeaponHit(e, dmg, crit); }
// 炎上(共通の仕組み)へのクラスの補正: ダメージ倍率・クリティカルするか・持続の追加・切れたとき
const clsBurnMul = e => (clsRT() && clsRT().burnMul ? clsRT().burnMul(e) : 1);
const clsBurnCrit = e => !!(clsRT() && clsRT().burnCrit && clsRT().burnCrit(e));
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
