// classes/berserker.js — バーサーカー: E スキル(ワイルドトマホーク)/ クラスの実装(CLASS_RT.berserker)/ 特性・パッシブ・Q の処理
'use strict';

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
      _t`使った瞬間に 最大HP の ${Math.round(sk.hpCost * 100)}% のダメージを受ける(防御力・シールドでは減らない。自分の技では倒れない)`,
      _t`  → 今回の攻撃 1回ごとの威力に、払った HP × ${sk.hpK} を足す`,
      _t`構え ${sk.windup}秒 → 照準方向(照準がなければ一番近い敵)へ、大きな斧(通常の斧の ${sk.big}倍の大きさ)を投げる`,
      _t`敵に当たると、近く(半径 ${sk.hopR})のまだ当たっていない敵へ跳ね返る(最大 ${sk.bounces}回)`,
      _t`1回の威力: 武器の威力 × ${Math.round(sk.pow * 100)}%、跳ねるたびに +${Math.round(sk.inc * 100)}%`,
      _t`跳ね終わると、回りながら自分のところへ戻ってくる(戻る途中も当たる。武器の威力 × ${Math.round(sk.backPow * 100)}%)`,
      _t('放った後は自由に動ける'),
    ], rows: [
      ['CD', _t`<b>${(sk.cd * (1 - c.cuV('e', 'cd')) * (1 - (m.cd || 0)) * c.cdMul).toFixed(1)}</b> 秒`],
      [_t('代償'), `HP <b>${paid}</b>`, _t`最大HP の ${Math.round(sk.hpCost * 100)}%。1回ごとの威力 +${add}`],
      [_t('跳ねる回数'), _t`<b>${n}</b> 回(${n + 1}回 当たる)`],
      [_t('1回目の威力'), `${Math.round(first)} → <b>${Math.round(first * c.atkMul)}</b>`, _t`武器の威力 × ${Math.round(sk.pow * 100)}% + 払った HP × ${sk.hpK}。攻撃力を掛けた値`],
      [_t`${n + 1}回目の威力`, `${Math.round(last)} → <b>${Math.round(last * c.atkMul)}</b>`, _t`跳ねるたびに +${Math.round(inc * 100)}%`],
      [_t('戻りの威力'), `${Math.round(back)} → <b>${Math.round(back * c.atkMul)}</b>`],
    ] };
  },
  start() {
    const sk = weaponSkill(), m = P.wm.axe || {}, a = aimDir(sk.reach * P.range);
    if (Math.cos(a) !== 0) P.facing = Math.cos(a) < 0 ? -1 : 1;
    const paid = selfHurt(P.maxhp * sk.hpCost); // 代償: 払った HP × hpK を今回の 1回ごとの威力に足す
    P.act = { slot: 'e', ph: 'wind', t: 0, pow: clsESkillMul() * (1 + (m.ePow || 0)), add: paid * sk.hpK };
    setCd('e', sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
    playAnim('zThrow', MOTIONS.zThrow.dur);
    skillCall(sk.name, '#ffb070', 'e', { fx: '#e07a3a' }); AudioMan.click();
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
  asMine(() => { burst(hx, hy, 10, ['#ffb070', '#fff1d0', '#8a5a2a'], { sp: 90, glow: true, life: 0.3 }); fxRays(hx, hy, 36, '#e07a3a', { n: 9, life: 0.22, core: '#ffb070' }); shake(3); });
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
    fxGlint(x, y - 3, 5 + Math.min(3, p.n), '#ffb070', { life: 0.15 }); // 跳ねるほど大きくきらめく
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
  asMine(() => { burst(X.x + X.face * 4, X.y - 8, 8, ['#ffb070', '#fff1d0'], { sp: 50, glow: true, life: 0.25 }); fxGlint(X.x + X.face * 4, X.y - 9, 6, '#ffb070', { life: 0.2 }); });
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

// 怒り(P.rage)は被弾で溜まり、与えるダメージ(攻撃力とは別の倍率)になる。昂り(P.fervor = 段ごとの残り秒)は不屈で受けた被弾で重なり、攻撃力と HP回復速度が上がる
// 狂乱(Q)で怒りを全て使って薙ぎ払い、しばらく怒りを上限のまま保つ(スタミナは 0)。不屈(Space)で攻撃を受け止めて、痛みを怒りに変える
CLASS_RT.berserker = {
  skills: ['q'],
  init() { P.rage = 0; P.calmT = 0; P.fervor = []; P.firmT = 0; P.firmHeld = false; P.frenzy = null; },
  update(dt) {
    const p = BK(), q = DATA.classes.berserker.q;
    // 不屈(Space): 押した瞬間に発動(押し直すまで再び使わない。効いている間は重ねない)
    //   狂乱中はスタミナが 0 のまま(被弾でスタミナを得る固有効果があっても使えない)
    if (P.frenzy) P.sta = 0;
    if (P.firmT > 0) P.firmT = Math.max(0, P.firmT - dt);
    const held = defHeld();
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
    P.cdMul = (1 - P.stats.v.cd) * P.stats.mul.cd * (hasSp('passive', 'edge') ? 1 - p.fervorCd * bkFervorN() : 1);
    P.moveMul = 1;
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
    UI.announce(_t('不死の狂乱'), '');
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
    skillCall(DATA.classes.berserker.q.name, '#b8402a', 'q'); AudioMan.click();
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
  res: () => ({ kind: 'rage', label: _t('怒り'), v: P.rage, max: bkRageMax(), dk: '#5a0a14', pulse: '#a01828' }),
  staBroken: () => false,
  statuses() {
    const out = [], p = BK(), q = DATA.classes.berserker.q, fk = bkFervorK(), pc = v => String(+(v * 100).toFixed(1));
    if (P.rage >= 1) out.push({ id: 'rage', glyph: '怒', name: _t`怒り ${Math.floor(P.rage)}`, fx: _t`与えるダメージ +${pc(P.rage * p.dmgPer)}%` + (hasSp('trait', 'fury') && bkFull() ? _t`・被ダメージ -${Math.round(p.armorCut * 100)}%(憤怒の鎧)` : '') + (hasSp('trait', 'grudge') ? _t`・HP回復速度 +${+(P.rage * p.burnK).toFixed(2)}/s(焼灼)` : ''), kind: 'buff' });
    // 昂り: 段の数をまとめて 1つ(残り時間の表示は一番長く残る段。段ごとの残りは説明に)。死に物狂いの間は名前に出す
    const n = bkFervorN(), des = bkDesperate();
    if (n > 0) {
      const left = P.fervor.slice().sort((a, b) => b - a).map(v => v.toFixed(1));
      out.push({ id: 'fervor', glyph: '昂', name: _t`昂り ${n}段` + (des ? _t('(死に物狂い)') : ''), kind: 'buff', max: bkFervorT(), t: Math.max(...P.fervor),
        fx: _t`攻撃力 +${pc(n * p.fervorAtk * fk)}%・HP回復速度 +${+(n * p.fervorRegen * fk).toFixed(2)}/s` + (hasSp('passive', 'edge') ? _t`・クールダウン -${pc(n * p.fervorCd)}%` : '')
          + _t`(段ごとの残り ${left.join(' / ')}秒)` });
    }
    if (P.firmT > 0) out.push({ id: 'firm', glyph: '屈', name: _t('不屈'), fx: _t`被ダメージ -${Math.round(p.firmDr * 100)}%・減速を受けない`, t: P.firmT, max: p.firmT, kind: 'buff' });
    if (P.frenzy) out.push({ id: 'frenzy', glyph: '狂', name: _t('狂乱'), fx: _t`怒りが上限のまま・与えるダメージ +${Math.round(q.dmg * 100)}%・攻撃速度 +${Math.round(q.atkSpd * 100)}%・HP回復速度 +${q.regen}/s・スタミナ 0`
      + (hasSp('q', 'cd') ? (P.frenzy.saved ? _t('・不死の狂乱は使用済み') : _t('・倒れるダメージを 1回 HP 1 で耐える')) : ''), t: P.frenzy.t, max: P.frenzy.max, kind: 'buff' });
    return out;
  },
  qInfo: () => ({ name: DATA.classes.berserker.q.name, glyph: '狂' }),
  info(c) {
    const p = BK(), q = DATA.classes.berserker.q, pc = v => String(+(v * 100).toFixed(1));
    const max = p.rageMax + c.cuV('trait', 'fury'), hitN = c.cuV('trait', 'pain', p.rageHit), calm = p.calmT + (c.lvFx.calmT || 0), decay = p.decay * (1 - c.cuV('trait', 'grudge')), rage = c.run ? P.rage : 0;
    const fk = 1 + c.cuV('passive', 'zeal'), fT = p.fervorT + c.cuV('passive', 'field') + (c.lvFx.fervorT || 0), edge = c.cuV('passive', 'edge');
    const k = (1 + c.cuV('q', 'pow') + (c.lvFx.qPow || 0)) * (c.hasSp('passive', 'field') ? 1 + p.selfPow : 1), qd = (q.pow + rage * q.perRage) * k, dur = Math.min(q.durMax, q.dur + rage * q.durPer) + c.cuV('q', 'dur'); // 仁王立ち: 威力 +selfPow
    return [
      { key: _t('特性'), name: _t('怒り'), cat: 'trait', desc: [
        _t`被弾すると 怒り +${p.rageHit}(上限 ${p.rageMax})`,
        _t`怒り 1 につき 与えるダメージ +${pc(p.dmgPer)}%(攻撃力とは別の倍率で、掛け算で効く)`,
        _t`${p.calmT}秒間 被弾しないと、1秒に ${p.decay} ずつ減る`,
      ], rows: [
        [_t('怒り'), c.run ? `<b>${Math.floor(rage)}</b> / ${max}` : _t`上限 <b>${max}</b>`],
        [_t('与えるダメージ'), `<b>+${pc(rage * p.dmgPer)}%</b>`, c.run ? _t('今の怒り') : _t`上限で +${pc(max * p.dmgPer)}%`],
        [_t('被弾で得る怒り'), `<b>+${hitN}</b>`],
        [_t('減り始めるまで'), _t`${calm} 秒`],
        [_t('減る速さ'), _t`1秒に <b>${+decay.toFixed(1)}</b>`],
      ] },
      { key: _t('パッシブ'), name: _t('昂り'), cat: 'passive', desc: [
        _t`不屈の間に被弾すると ${p.fervorT}秒間、HP回復速度 +${p.fervorRegen}/s・攻撃力 +${Math.round(p.fervorAtk * 100)}%(最大 ${p.fervorMax}段。段ごとに別々に数える)`,
        _t('攻撃力は与えるダメージ(怒り)とは別の倍率なので、掛け算で伸びる'),
      ], rows: [
        [_t('昂り'), c.run ? _t`<b>${bkFervorN()}</b> / ${p.fervorMax} 段` : _t`最大 <b>${p.fervorMax}</b> 段`],
        [_t('1段の効果'), _t`攻撃力 +${pc(p.fervorAtk * fk)}%・HP回復速度 +${+(p.fervorRegen * fk).toFixed(2)}/s`],
        [_t('時間'), _t`${fT} 秒`],
      ].concat(edge ? [[_t('通常の被弾'), _t`昂り +${edge}段`, _t('極限')]] : []) },
      { key: 'Q', name: q.name, cat: 'q', desc: [
        _t`構え ${q.windup}秒 → 怒りを全て使い、雄叫びとともに周り(半径 ${q.r})を薙ぎ払う(基礎威力 ${q.pow} + 使った怒り × ${q.perRage})`,
        _t`そのあと狂乱(${q.dur}秒 + 使った怒り × ${q.durPer}秒。最大 ${q.durMax}秒): 怒りは上限のまま減らない、与えるダメージ +${Math.round(q.dmg * 100)}%、攻撃速度 +${Math.round(q.atkSpd * 100)}%、HP回復速度 +${q.regen}/s`,
        _t('  → そのかわりスタミナが 0 になり、回復しなくなる。終わると怒りは 0 から溜め直し'),
      ], rows: [
        ['CD', _t`<b>${(q.cd * (1 - c.cuV('q', 'cd')) * c.cdMul).toFixed(1)}</b> 秒`],
        [_t('薙ぎ払いの威力'), `${Math.round(qd)} → <b>${Math.round(qd * c.atkMul)}</b>`, (c.run ? _t('今の怒りを全て使ったとき') : _t('怒り 0 のとき')) + _t('。攻撃力を掛けた値')],
        [_t('狂乱の持続'), _t`<b>${+dur.toFixed(1)}</b> 秒`, c.run ? _t('今の怒りを全て使ったとき') : _t('怒り 0 のとき')],
        [_t('半径'), `${Math.round(q.r * (1 + c.st.v.area) * c.st.mul.area)}`],
      ] },
      { key: 'Space', name: _t('不屈'), desc: [
        _t`${p.firmT}秒間、被ダメージ -${Math.round(p.firmDr * 100)}%、減速(粘液・スロウタイム)を受けない。動ける`,
        _t`被ダメージ(減らす前)10 につき 怒り +${+(p.firmRage * 10).toFixed(1)}(被弾の怒りとは別)`,
        _t('不屈の間の被弾で 昂り +1段'),
      ], rows: [
        [_t('スタミナ消費'), `<b>${p.firmCost - (c.lvFx.firmCut || 0)}</b>`],
      ] },
    ];
  },
};

// ---------- バーサーカー ----------
const BK = () => DATA.classes.berserker.params;
const BK_FX = ['#5a0a14', '#3a0610', '#1a0408', '#7a1420']; // 闘気の色(赤黒。明るい赤は敵の攻撃の色なので使わない)
const bkRageMax = () => BK().rageMax + cuV('trait', 'fury');                               // 怒りの上限(激情)
const bkRageHit = () => cuV('trait', 'pain', BK().rageHit);                                // 被弾で得る怒り(痛覚)
const bkCalmT = () => BK().calmT + (P.lvFx.calmT || 0);                                    // 怒りが減り始めるまでの秒数(クラスLv3)
const bkDecay = () => BK().decay * (1 - cuV('trait', 'grudge'));                           // 怒りが減る速さ(1秒あたり。執念で遅くなる)
const bkFull = () => P.rage >= bkRageMax();                                                // 怒りが上限
const bkDesperate = () => hasSp('passive', 'zeal') && P.hp <= P.maxhp * BK().desperateAt; // 死に物狂い: HP が少ないと昂りの効果アップ
const bkFervorK = () => 1 + cuV('passive', 'zeal') + (bkDesperate() ? BK().desperateK : 0); // 昂りの効果の倍率(熱狂・死に物狂い)
const bkFervorT = () => BK().fervorT + cuV('passive', 'field') + (P.lvFx.fervorT || 0);   // 昂りの時間(戦場・クラスLv8)
const bkFervorN = () => P.fervor.length;                                                  // 効いている昂りの段数
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
    fxDecal(P.x, P.y + 6, 12, 'crack', { n: 5, col: '#100404', hot: '#7a1418', heatT: 0.5, life: 2 }); // 踏ん張った足元のひび
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
    fxDecal(P.x, P.y + 4, R * 0.95, 'crack', { n: 10, col: '#100404', hot: '#b8402a', heatT: 1.3, life: 4 }); fxDecal(P.x, P.y + 4, R * 0.45, 'scorch', { col: '#140808', hot: '#7a1418', heatT: 0.8, life: 3 }); // 踏み割った地面
    fxRays(P.x, P.y - 4, R * 1.25, '#7a1418', { n: 16, life: 0.38, core: '#b8402a' });
    burst(P.x, P.y + 4, 26, ['#5a4a3a', '#3a2e24', '#7a6a56'], { sp: 160, up: 50, g: 260, life: 0.7 }); // 割れた地面の土砂
    shockAt(P.x, P.y, 1.3, 1.1); shake(11); hitstop(0.07); // 自分が中心の衝撃波は強すぎると自分の絵が引き伸ばされるので控えめ
    screenFlash(0.14 * SET.fxA, '#2a0408');
  });
  GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.8 * SET.fxA);
  const dur = Math.min(q.durMax, q.dur + used * q.durPer) + cuV('q', 'dur');
  P.frenzy = { t: dur, max: dur, used, ext: 0, whirl: q.whirlEvery };
  P.rage = bkRageMax(); P.sta = 0; S.hudDirty = true;
  setCd('q', q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  AudioMan.warcry(); AudioMan.boom(); AudioMan.impact();
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
