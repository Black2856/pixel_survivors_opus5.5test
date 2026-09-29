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
function setCd(slot, sec) { P.sk[slot].cd = P.sk[slot].max = Math.max(1, sec); S.hudDirty = true; }
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
      return { name: sk.name, rows: [
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
function ranbuHit(sk) {
  const R = sk.radius * P.area, dmg = wst(P.mainW).dmg * sk.pow * (1 + cuV('e', 'pow')) * P.act.pow, k0 = S.kills;
  asMine(() => {
    forEachNear(P.x, P.y, R, e => { if (!e.prop) hitEnemy(e, dmg, { src: 'ranbu', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 25, col: '#ffb7d5', noNum: Math.random() < 0.4 }); });
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
    forEachNear(P.x, P.y, R, e => { if (!e.prop) hitEnemy(e, dmg, { src: 'ranbu', ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 120, col: '#ff8ac0' }); });
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
    // ステータス画面用: Q と Space
    info(c) {
      const S2 = DATA.classes.samurai, q = S2.q, p = S2.params, k = 1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0);
      return [
        { key: 'Q', name: q.name, rows: [
          ['CD', `<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
          ['威力', `${Math.round(q.pow * k)} → <b>${Math.round(q.pow * k * c.atkMul)}</b>`, `消費した剣気1につき +${(q.kiPow * k).toFixed(1)}(武器に依存しない)`],
          ['突進距離', `${Math.round(q.dist * (1 + c.cuV('q', 'reach')))}`],
        ] },
        { key: 'Space', name: '見切り', rows: [
          ['スタミナ消費', `${p.guardCost} + 受けたダメージ分`, '構えた瞬間に消費。ガード中の被弾はダメージ分'],
          ['ジャスト受付', `<b>${(p.parryWin + (c.lvFx.parryWin || 0)).toFixed(2)}</b> 秒`],
          ['反撃の威力', `${p.parryPow} → <b>${Math.round(p.parryPow * c.atkMul)}</b>`],
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

// ---------- world.js から呼ぶ入口 ----------
const clsRT = () => CLASS_RT[P.cls];
function clsInit() {
  P.sta = P.maxSta; P.staLockT = 0; P.moveMul = 1; P.invT = 0; P.atkSpd = 1; P.cu = {}; P.cs = {};
  P.sk = { q: { cd: 0, max: 1 }, e: { cd: 0, max: 1 } }; P.act = null; P.anim = null;
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
  if (P.anim) { P.anim.t += dt; if (P.anim.t >= P.anim.dur || (!P.act && P.moving)) P.anim = null; }
}
const clsOnHurt = dmg => (clsRT() ? clsRT().onHurt(dmg) : dmg);
function clsOnMainHit(e) { if (clsRT()) clsRT().onMainHit(e); }
function clsOnKill(e) { if (clsRT() && clsRT().onKill) clsRT().onKill(e); }

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
