// classes.js — クラスのランタイム(スタミナ・防御スキル・クラス特性・パッシブ)
// world.js からは clsInit / clsUpdate / clsOnHurt / clsOnMainHit / clsAtkBonus だけを呼ぶ
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

// ---------- クラスごとの実装 ----------
const CLASS_RT = {
  samurai: {
    init() {
      const c = DATA.classes.samurai.params;
      P.ki = 0; P.kiMax = c.kiMax; P.kiWin = 0; P.kiWinT = 0;
      P.guard = false; P.guardT = 0; P.breakT = 0; P.zanshinT = 0;
    },
    update(dt) {
      const c = DATA.classes.samurai.params;
      P.kiWinT -= dt; if (P.kiWinT <= 0) P.kiWin = 0;
      P.zanshinT -= dt; P.breakT -= dt;
      // 見切り(Space 長押しでガード)。ガードブレイク中は構えられない
      const want = (keys.Space || keys.TouchDef) && P.breakT <= 0 && P.sta > 0;
      if (want && !P.guard) { P.guard = true; P.guardT = 0; AudioMan.click(); }
      if (!want && P.guard) P.guard = false;
      if (P.guard) P.guardT += dt;
      P.moveMul = P.guard ? c.guardSlow : 1;
    },
    // 被弾: ガード中ならスタミナで受ける。受けきれた場合は null(HPは減らない)
    onHurt(dmg) {
      const c = DATA.classes.samurai.params;
      if (P.breakT > 0) return dmg * (1 + c.breakDmg);
      if (!P.guard) return dmg;
      P.zanshinT = c.zanshinT; // 残心: 防御スキルで攻撃を受けた後、攻撃力アップ
      if (P.guardT <= c.parryWin) { samuraiParry(); return null; }
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
    // 通常攻撃(メイン武器)が命中: 剣気 +kiHit(一定時間内の獲得は kiHitCap まで)
    onMainHit() {
      const c = DATA.classes.samurai.params;
      if (P.kiWinT <= 0) { P.kiWinT = 0.15; P.kiWin = 0; }
      if (P.kiWin >= c.kiHitCap) return;
      P.kiWin += c.kiHit; kiAdd(c.kiHit);
    },
    atkBonus() {
      const c = DATA.classes.samurai.params;
      return (P.ki >= P.kiMax ? c.kiFullAtk : 0) + (P.zanshinT > 0 ? c.zanshinAtk : 0);
    },
    // HUD 用: クラスリソース(kind は ui.js の表示の種類)
    res: () => ({ kind: 'blade', label: '剣気', v: P.ki, max: P.kiMax }),
    staBroken: () => P.breakT > 0,
  },
};

function kiAdd(n) {
  const was = P.ki;
  P.ki = Math.min(P.kiMax, P.ki + n);
  if (was < P.kiMax && P.ki >= P.kiMax) { // 満タンになった瞬間
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
  P.sta = P.maxSta; P.staLockT = 0; P.moveMul = 1; P.invT = 0;
  if (clsRT()) clsRT().init();
}
function clsUpdate(dt) {
  updStamina(dt);
  P.invT -= dt;
  if (clsRT()) clsRT().update(dt);
}
const clsOnHurt = dmg => (clsRT() ? clsRT().onHurt(dmg) : dmg);
function clsOnMainHit(e) { if (clsRT()) clsRT().onMainHit(e); }
const clsAtkBonus = () => (clsRT() ? clsRT().atkBonus() : 0);
const clsRes = () => (clsRT() && clsRT().res ? clsRT().res() : null);
const clsStaBroken = () => !!(clsRT() && clsRT().staBroken && clsRT().staBroken());
