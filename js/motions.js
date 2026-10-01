// motions.js — 補間アニメーション(滑らか版)。時刻 t から姿勢を返す
// 返す状態: p(部位の姿勢 → rig.pose)/ hand(手の位置。武器の回転の中心)/ blade(武器を描くか)/ ang(武器の角度 0=右・負=上)
//           lean(前傾。足元基準)/ sy(縦の伸縮)。すべて右向き基準で、描画側で左右反転する
'use strict';

const EASE = { lin: u => u, out: u => 1 - (1 - u) ** 3, in: u => u * u * u, inOut: u => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2) };
// keys: [[時刻, 値, イージング], ...] を t で補間する
function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i];
    if (t <= t1) return v0 + (v1 - v0) * EASE[e || 'inOut']((t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
}

// サムライの部位の配置(ART.S.samurai と対応)
const SAMURAI_HAND = { slash: [15, 9.5], high: [13, 8.5], grip: [11, 10.5] }; // 手前の腕の絵ごとの手の位置(体の枠の座標)
function samuraiPose(L, U, crouch, lunge, arm, sheathV, headV) {
  const armDy = arm === 'high' ? -2 : 0;
  const legs = crouch >= 1.5 ? [0, 2, 'crouch'] : crouch >= 0.5 ? [0, 1, 'crouch'] : lunge > 0.5 ? [0, 0, 'stepA'] : [0, 0];
  const p = { head: [L, U, headV || 'base'], torso: [L, U], backArm: [L, U], sheath: [L, U, sheathV], legs, frontArm: arm === 'base' ? [L, U] : [L, U + armDy, arm] };
  const hand = SAMURAI_HAND[arm] ? [SAMURAI_HAND[arm][0] + L, SAMURAI_HAND[arm][1] + U + armDy] : null;
  return { p, hand };
}

// メイジの部位の配置(ART.S.mage と対応)。U: 上半身の沈み / o: 腕の上下・宝珠の位置と絵・帽子の絵・脚
function magePose(U, arm, o = {}) {
  const p = {
    hat: [0, U, o.hatV || 'base'], head: [0, U], torso: [0, U], backArm: [0, U], legs: [0, 0, o.legs || 'base'],
    frontArm: arm === 'base' ? [0, U] : [0, U + (o.armDy || 0), arm], orb: [o.ox || 0, U + (o.oy || 0), o.orbV || 'base'],
  };
  return { p, hand: null };
}

// アーチャーの部位の配置(ART.S.hunter と対応)。長弓はモーション中は部位ではなく drawPose で角度付きで描く
const ARCHER_HAND = { base: [11, 10.5], aim: [13.5, 8.5], sky: [11.5, 5.5] };
function archerPose(U, arm, o = {}) {
  const armDy = arm === 'sky' ? -3 : 0;
  const p = {
    cape: [0, U, o.capeV || 'base'], quiver: [0, U], head: [0, U], torso: [0, U], backArm: [0, U], legs: [0, 0, o.legs || 'base'],
    frontArm: arm === 'base' ? [0, U] : [0, U + armDy, arm],
  };
  const h = ARCHER_HAND[arm];
  return { p, hand: [h[0], h[1] + U + (arm === 'base' ? 0 : armDy)] };
}

// ナイトの部位の配置(ART.S.knight と対応)。騎士剣はモーション中は drawPose の刀身として角度付きで描く
const KNIGHT_HAND = { base: [3.5, 10.5], up: [4.5, 6.5] };
function knightPose(U, arm, o = {}) {
  const p = {
    helm: [0, U], torso: [0, U], backArm: [0, U + (arm === 'up' ? -3 : 0)], legs: [0, 0, o.legs || 'base'],
    shield: [(o.sx || 0), U + (o.sy || 0), o.shieldV || 'base'],
  };
  const h = KNIGHT_HAND[arm];
  return { p, hand: [h[0], h[1] + U] };
}

// rig: そのモーションを使えるクラスの部位(合わないクラスは待機・歩きのまま。rig.alias で代わりのモーションを指定できる)
// パイロマンサーの部位の配置(ART.S.pyro と対応)。U: 上半身の沈み / o: 腕の上下・杖の位置と絵・脚
function pyroPose(U, arm, o = {}) {
  const p = {
    hood: [0, U], torso: [0, U], backArm: [0, U], legs: [0, 0, o.legs || 'base'],
    frontArm: arm === 'base' ? [0, U] : [0, U + (o.armDy || 0), arm], staff: [o.sx || 0, U + (o.sy || 0), o.staffV || 'base'],
  };
  return { p, hand: null };
}

// クライオマンサーの部位の配置(ART.S.cryo と対応)
function cryoPose(U, arm, o = {}) {
  const p = {
    hood: [0, U], torso: [0, U], backArm: [0, U], legs: [0, 0, o.legs || 'base'],
    frontArm: arm === 'base' ? [0, U] : [0, U + (o.armDy || 0), arm], staff: [o.sx || 0, U + (o.sy || 0), o.staffV || 'base'],
  };
  return { p, hand: null };
}

// エレクトロマンサーの部位の配置(ART.S.electro と対応)
function electroPose(U, arm, o = {}) {
  const p = {
    head: [0, U, o.headV || 'base'], torso: [0, U], backArm: [0, U], legs: [0, 0, o.legs || 'base'],
    frontArm: arm === 'base' ? [0, U] : [0, U + (o.armDy || 0), arm], staff: [o.sx || 0, U + (o.sy || 0), o.staffV || 'base'],
  };
  return { p, hand: null };
}

const MOTIONS = {
  // メテオ(Q): 宝珠を頭上へ掲げて詠唱(0.5秒・のけぞる)→ 振り下ろして照準へ放つ → 戻る
  mMeteor: {
    rig: 'mage', dur: 0.85, cast: 0.5,
    state(t) {
      if (t < this.cast) {
        const u = track([[0, 0], [0.12, 1, 'out'], [this.cast, 1]], t);
        return Object.assign(magePose(t > 0.3 ? 0 : 1, u > 0.3 ? 'raise' : 'base', { armDy: -3, ox: -1, oy: Math.round(-2 - 6 * u), orbV: t > 0.2 && Math.floor(t * 16) % 2 ? 'big' : 'base', hatV: Math.floor(t * 10) % 2 ? 'b' : 'base' }),
          { blade: false, lean: track([[0, 0], [this.cast, -0.1]], t), sy: track([[0, 1], [0.1, 0.94, 'out'], [this.cast, 1.05]], t) });
      }
      const r = t - this.cast;
      return Object.assign(magePose(r < 0.1 ? 1 : 0, r < 0.25 ? 'forward' : 'base', { ox: r < 0.25 ? 3 : 0, oy: r < 0.25 ? -1 : 0, orbV: r < 0.12 ? 'big' : 'base', legs: r < 0.2 ? 'stepA' : 'base' }),
        { blade: false, lean: track([[0, 0.14], [0.35, 0, 'out']], r), sy: track([[0, 0.94], [0.15, 1, 'out']], r) });
    },
  },
  // アーケイン・バラージュ(E): 宝珠を前へ突き出して詠唱 → 連射(撃つたびに小さく反動)→ 戻る
  mBarrage: {
    rig: 'mage', windup: 0.3,
    state(t, dur) {
      const W = this.windup, end = W + dur;
      if (t < W) return Object.assign(magePose(1, 'forward', { ox: 3, oy: -1, orbV: t > W * 0.5 ? 'big' : 'base' }), { blade: false, lean: -0.06 * t / W, sy: 1 - 0.03 * t / W });
      if (t < end) {
        const u = t - W, kick = Math.floor(u * 24) % 2; // 反動(1秒に12発)
        return Object.assign(magePose(kick, 'forward', { ox: 3 - kick, oy: -1, orbV: 'big', hatV: kick ? 'b' : 'base', legs: 'stepA' }), { blade: false, lean: 0.04 - 0.03 * kick, sy: 1 });
      }
      return Object.assign(magePose(0, 'base'), { blade: false, lean: 0, sy: 1 });
    },
    duration: dur => MOTIONS.mBarrage.windup + dur + 0.2,
  },
  // ブリンク(Space): 縮んで消え、伸びて現れる
  mBlink: {
    rig: 'mage', dur: 0.25,
    state(t) {
      return Object.assign(magePose(0, 'base', { orbV: t < 0.12 ? 'big' : 'base', hatV: 'b' }),
        { blade: false, lean: track([[0, 0], [0.06, -0.12, 'out'], [0.12, 0.16, 'out'], [0.25, 0]], t), sy: track([[0, 1], [0.06, 0.78, 'out'], [0.12, 1.14, 'out'], [0.25, 1]], t) });
    },
  },
  // アローレイン(E): 斜め上へ引き絞る(0.3秒・のけぞる)→ 放って反動 → 戻る
  aRain: {
    rig: 'hunter', dur: 0.6, cast: 0.3,
    state(t) {
      const c = this.cast;
      if (t < c) { const u = t / c; return Object.assign(archerPose(t > 0.15 ? 1 : 0, 'aim', { capeV: 'b' }), { bow: true, bowAng: -0.9, pull: 3 * u, arrow: true, glow: u > 0.5, blade: false, lean: -0.1 * u, sy: 1 - 0.03 * u }); }
      const r = t - c;
      return Object.assign(archerPose(0, r < 0.15 ? 'aim' : 'base', { legs: r < 0.1 ? 'stepA' : 'base' }), { bow: true, bowAng: r < 0.15 ? -0.9 : 0.3, pull: 0, arrow: false, blade: false, lean: track([[0, 0.12], [0.3, 0, 'out']], r), sy: track([[0, 0.95], [0.15, 1, 'out']], r) });
    },
  },
  // 一斉射撃(Q): 長弓を前へ構えて光を集める(0.4秒)→ 一斉に放って反動 → 戻る
  aVolley: {
    rig: 'hunter', dur: 0.75, cast: 0.4,
    state(t) {
      const c = this.cast;
      if (t < c) { const u = t / c; return Object.assign(archerPose(u < 0.3 ? 1 : 0, 'aim', { capeV: Math.floor(t * 10) % 2 ? 'b' : 'base' }), { bow: true, bowAng: 0, pull: 3 * u, arrow: true, glow: true, blade: false, lean: -0.12 * u, sy: 1 - 0.03 * u }); }
      const r = t - c;
      return Object.assign(archerPose(r < 0.1 ? 1 : 0, r < 0.2 ? 'aim' : 'base', { legs: r < 0.12 ? 'stepA' : 'base' }), { bow: true, bowAng: r < 0.2 ? 0 : 0.3, pull: 0, arrow: false, blade: false, lean: track([[0, 0.06], [0.35, 0, 'out']], r), sy: track([[0, 0.93], [0.15, 1, 'out']], r) });
    },
  },
  // バックステップ(Space): 小さく跳ねて後ろへ → 着地で沈む
  aStep: {
    rig: 'hunter', dur: 0.3,
    state(t) {
      return Object.assign(archerPose(t > 0.2 ? 1 : 0, 'base', { capeV: 'b', legs: t < 0.15 ? 'stepB' : 'base' }), { bow: true, bowAng: 0.3, pull: 0, arrow: false, blade: false,
        lean: track([[0, 0], [0.06, 0.16, 'out'], [0.18, -0.08], [0.3, 0]], t), sy: track([[0, 1], [0.05, 0.86, 'out'], [0.14, 1.1, 'out'], [0.22, 0.92], [0.3, 1]], t) });
    },
  },
  // グランドスラム(E): 剣を頭上へ振りかぶる(0.3秒・のけぞる)→ 地面へ叩きつける → 戻る
  kSlam: {
    rig: 'knight', dur: 0.7, cast: 0.3,
    state(t) {
      const c = this.cast;
      if (t < c) { const u = t / c; return Object.assign(knightPose(0, 'up'), { blade: true, ang: -1.6 - 1.0 * u, lean: -0.1 * u, sy: 1 + 0.03 * u }); }
      const r = t - c;
      return Object.assign(knightPose(r < 0.2 ? 2 : 0, 'base', { legs: r < 0.25 ? 'stepA' : 'base' }), { blade: true, ang: track([[0, -2.6], [0.06, 0.9, 'out'], [0.4, 0.9]], r), lean: track([[0, 0.2], [0.4, 0, 'out']], r), sy: track([[0, 0.88], [0.2, 1, 'out']], r) });
    },
  },
  // 聖盾の審判(Q): 大盾を高く掲げて光を集める(0.4秒)→ 地面に叩きつける → 戻る
  kVerdict: {
    rig: 'knight', dur: 0.8, cast: 0.4,
    state(t) {
      const c = this.cast;
      if (t < c) { const u = t / c; return Object.assign(knightPose(0, 'base', { shieldV: 'guard', sx: -2, sy: -Math.round(6 * u) }), { blade: false, lean: -0.08 * u, sy: 1 + 0.04 * u }); }
      const r = t - c;
      return Object.assign(knightPose(r < 0.2 ? 2 : 0, 'base', { shieldV: 'guard', sx: 2, sy: r < 0.2 ? 2 : 0, legs: 'stepA' }), { blade: false, lean: track([[0, 0.18], [0.4, 0, 'out']], r), sy: track([[0, 0.86], [0.2, 1, 'out']], r) });
    },
  },
  // 火炎放射(E): 杖を前へ突き出して構える → 吹き続ける(炎が揺れて小さく反動)→ 戻る
  pFlame: {
    rig: 'pyro', windup: 0.2,
    state(t, dur) {
      const W = this.windup, end = W + dur;
      if (t < W) return Object.assign(pyroPose(1, 'forward', { sx: 2, sy: 1, staffV: 'big' }), { blade: false, lean: -0.06 * t / W, sy: 1 - 0.03 * t / W });
      if (t < end) {
        const kick = Math.floor((t - W) * 20) % 2;
        return Object.assign(pyroPose(kick, 'forward', { sx: 3 - kick, sy: 1, staffV: kick ? 'big' : 'b', legs: 'stepA' }), { blade: false, lean: 0.05 - 0.03 * kick, sy: 1 });
      }
      return Object.assign(pyroPose(0, 'base'), { blade: false, lean: 0, sy: 1 });
    },
    duration: dur => MOTIONS.pFlame.windup + dur + 0.2,
  },
  // 煉獄(Q): 杖を頭上へ掲げて炎を集める(0.5秒・のけぞる)→ 振り下ろす → 戻る
  pInferno: {
    rig: 'pyro', dur: 0.85, cast: 0.5,
    state(t) {
      if (t < this.cast) {
        const u = track([[0, 0], [0.15, 1, 'out'], [this.cast, 1]], t);
        return Object.assign(pyroPose(t > 0.3 ? 0 : 1, u > 0.3 ? 'raise' : 'base', { armDy: -3, sx: 0, sy: Math.round(-3 * u), staffV: Math.floor(t * 16) % 2 ? 'big' : 'b' }),
          { blade: false, lean: track([[0, 0], [this.cast, -0.1]], t), sy: track([[0, 1], [0.1, 0.94, 'out'], [this.cast, 1.05]], t) });
      }
      const r = t - this.cast;
      return Object.assign(pyroPose(r < 0.12 ? 2 : 0, r < 0.25 ? 'forward' : 'base', { sx: r < 0.25 ? 3 : 0, sy: r < 0.25 ? 2 : 0, staffV: r < 0.15 ? 'big' : 'base', legs: r < 0.2 ? 'stepA' : 'base' }),
        { blade: false, lean: track([[0, 0.16], [0.35, 0, 'out']], r), sy: track([[0, 0.9], [0.15, 1, 'out']], r) });
    },
  },
  // 炎壁(Space): 杖を地面に突いて沈む → 戻る
  pWall: {
    rig: 'pyro', dur: 0.3,
    state(t) {
      return Object.assign(pyroPose(t < 0.15 ? 2 : 0, 'base', { sy: t < 0.15 ? 3 : 0, staffV: t < 0.2 ? 'big' : 'base', legs: t < 0.15 ? 'stepB' : 'base' }),
        { blade: false, lean: 0, sy: track([[0, 1], [0.05, 0.86, 'out'], [0.2, 1.04], [0.3, 1]], t) });
    },
  },
  // アイシクルフォール(E): 杖を頭上へ掲げる(0.3秒)→ 振り下ろす → 戻る
  cIcicle: {
    rig: 'cryo', dur: 0.6, cast: 0.3,
    state(t) {
      if (t < this.cast) { const u = t / this.cast; return Object.assign(cryoPose(0, 'raise', { armDy: -3, sy: Math.round(-3 * u), staffV: u > 0.5 ? 'big' : 'base' }), { blade: false, lean: -0.08 * u, sy: 1 + 0.03 * u }); }
      const r = t - this.cast;
      return Object.assign(cryoPose(r < 0.12 ? 1 : 0, r < 0.2 ? 'forward' : 'base', { sx: r < 0.2 ? 3 : 0, sy: r < 0.2 ? 2 : 0, staffV: r < 0.12 ? 'big' : 'base', legs: r < 0.15 ? 'stepA' : 'base' }),
        { blade: false, lean: track([[0, 0.12], [0.3, 0, 'out']], r), sy: track([[0, 0.93], [0.15, 1, 'out']], r) });
    },
  },
  // ダイヤモンドダスト(Q): 杖を高く掲げて冷気を集める(0.4秒)→ 両手を広げるように放つ → 戻る
  cDust: {
    rig: 'cryo', dur: 0.8, cast: 0.4,
    state(t) {
      if (t < this.cast) {
        const u = track([[0, 0], [0.12, 1, 'out'], [this.cast, 1]], t);
        return Object.assign(cryoPose(t > 0.25 ? 0 : 1, 'raise', { armDy: -3, sy: Math.round(-3 * u), staffV: Math.floor(t * 14) % 2 ? 'big' : 'b' }), { blade: false, lean: -0.06 * u, sy: track([[0, 1], [0.1, 0.95, 'out'], [this.cast, 1.05]], t) });
      }
      const r = t - this.cast;
      return Object.assign(cryoPose(r < 0.1 ? 1 : 0, r < 0.25 ? 'raise' : 'base', { armDy: -1, staffV: r < 0.2 ? 'big' : 'base' }), { blade: false, lean: 0, sy: track([[0, 1.08], [0.2, 1, 'out']], r) });
    },
  },
  // 氷の鏡(Space): 後ろへ滑る(少し沈む)
  cMirror: {
    rig: 'cryo', dur: 0.25,
    state(t) {
      return Object.assign(cryoPose(t < 0.15 ? 1 : 0, 'base', { staffV: 'b', legs: 'stepB' }), { blade: false, lean: track([[0, 0], [0.06, -0.14, 'out'], [0.25, 0]], t), sy: track([[0, 1], [0.05, 0.9, 'out'], [0.25, 1]], t) });
    },
  },
  // グラビティスパーク(E): 杖を前へ突き出して球を膨らませる(0.3秒)→ 放って反動 → 戻る
  eSpark: {
    rig: 'electro', dur: 0.6, cast: 0.3,
    state(t) {
      if (t < this.cast) { const u = t / this.cast; return Object.assign(electroPose(1, 'forward', { sx: 2, sy: 1, staffV: u > 0.4 ? 'big' : 'b', headV: 'b' }), { blade: false, lean: -0.06 * u, sy: 1 - 0.03 * u }); }
      const r = t - this.cast;
      return Object.assign(electroPose(r < 0.1 ? 1 : 0, r < 0.2 ? 'forward' : 'base', { sx: r < 0.2 ? 1 : 0, staffV: r < 0.1 ? 'big' : 'base', legs: r < 0.15 ? 'stepA' : 'base' }),
        { blade: false, lean: track([[0, -0.1], [0.3, 0, 'out']], r), sy: track([[0, 0.95], [0.15, 1, 'out']], r) });
    },
  },
  // 鉄塔(Q): 杖を頭上へ掲げて雷を呼ぶ(0.4秒)→ 振り下ろす → 戻る
  eTower: {
    rig: 'electro', dur: 0.8, cast: 0.4,
    state(t) {
      if (t < this.cast) {
        const u = track([[0, 0], [0.12, 1, 'out'], [this.cast, 1]], t);
        return Object.assign(electroPose(t > 0.25 ? 0 : 1, 'raise', { armDy: -3, sy: Math.round(-3 * u), staffV: Math.floor(t * 16) % 2 ? 'big' : 'b', headV: 'b' }), { blade: false, lean: -0.08 * u, sy: track([[0, 1], [0.1, 0.95, 'out'], [this.cast, 1.05]], t) });
      }
      const r = t - this.cast;
      return Object.assign(electroPose(r < 0.12 ? 2 : 0, r < 0.25 ? 'forward' : 'base', { sx: r < 0.25 ? 3 : 0, sy: r < 0.25 ? 2 : 0, staffV: r < 0.15 ? 'big' : 'base', legs: r < 0.2 ? 'stepA' : 'base' }),
        { blade: false, lean: track([[0, 0.14], [0.35, 0, 'out']], r), sy: track([[0, 0.9], [0.15, 1, 'out']], r) });
    },
  },
  // 雷走(Space): 前傾で駆け抜ける
  eDash: {
    rig: 'electro', dur: 0.2,
    state(t) {
      return Object.assign(electroPose(1, 'base', { staffV: 'big', legs: 'stepA', headV: 'b' }), { blade: false, lean: track([[0, 0], [0.04, 0.22, 'out'], [0.2, 0]], t), sy: track([[0, 1], [0.04, 0.9, 'out'], [0.2, 1]], t) });
    },
  },
  // 居合(Q): 構え(0.25 秒)→ 抜刀して振り上げ → 残心 → 血振り → 納刀
  iai: {
    rig: 'samurai', dur: 1.13, release: 0.25,
    K: {
      crouch: [[0, 0], [0.07, 1, 'out'], [0.18, 2, 'out'], [0.25, 2], [0.31, 0, 'out']],
      lunge:  [[0, 0], [0.25, 0], [0.31, 2, 'out'], [0.68, 2], [0.98, 0]],
      lean:   [[0, 0], [0.16, -0.06], [0.25, -0.08], [0.31, 0.16, 'out'], [0.58, 0.04], [0.98, 0]],
      sy:     [[0, 1], [0.18, 0.96, 'out'], [0.25, 0.95], [0.31, 1.04, 'out'], [0.43, 1]],
      ang:    [[0.25, 0.7], [0.33, -2.1, 'out'], [0.63, -1.95], [0.8, -2.25], [0.9, 0.9, 'inOut']],
    },
    state(t) {
      const K = this.K, crouch = track(K.crouch, t), lunge = track(K.lunge, t);
      const L = Math.round(lunge), U = Math.round(crouch) + (lunge > 0.5 ? 1 : 0);
      const bladeEnd = 0.94, blade = t >= this.release && t < bladeEnd, ang = track(K.ang, t);
      const arm = t < 0.03 ? 'base' : t < this.release ? 'grip' : t < bladeEnd ? (ang > -0.8 ? 'slash' : 'high') : t < 1.03 ? 'grip' : 'base';
      const sheathV = blade ? 'empty' : (t > 0.18 && t < this.release) || (t > bladeEnd && t < 1.08) ? 'glint' : 'base';
      const headV = t > this.release && t < 0.68 && Math.floor(t * 12) % 2 ? 'b' : 'base';
      return Object.assign(samuraiPose(L, U, crouch, lunge, arm, sheathV, headV), { blade, ang, lean: track(K.lean, t), sy: track(K.sy, t) });
    },
  },
  // 乱れ桜(E): 抜刀の構え(0.2秒)→ 刀を振り回して周囲を斬り続ける(dur 秒)→ 納刀。刀は1秒に約3周する
  ranbu: {
    rig: 'samurai', windup: 0.2,
    state(t, dur) {
      const W = this.windup, end = W + dur;
      if (t < W) { // 構え: 少し沈んで柄に手をかける
        const c = track([[0, 0], [W, 1, 'out']], t);
        return Object.assign(samuraiPose(0, Math.round(c), c, 0, 'grip', t > W * 0.5 ? 'glint' : 'base'), { blade: false, ang: 0, lean: -0.04 * c, sy: 1 - 0.03 * c });
      }
      if (t < end) { // 回転斬り: 刀の角度が回り続け、体は小刻みに前後へ揺れる
        const u = t - W, ang = -Math.PI / 2 + u * 19;
        const a = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); // 0〜2π
        const arm = a > Math.PI * 1.25 && a < Math.PI * 1.85 ? 'high' : 'slash';
        const sway = Math.sin(u * 19);
        return Object.assign(samuraiPose(Math.round(sway), Math.floor(u * 8) % 2, 0, sway > 0 ? 1 : 0, arm, 'empty', Math.floor(u * 10) % 2 ? 'b' : 'base'), { blade: true, ang, lean: 0.08 * sway, sy: 1 + 0.02 * Math.cos(u * 38) });
      }
      const r = t - end; // 納刀
      return Object.assign(samuraiPose(0, 0, 0, 0, r < 0.15 ? 'grip' : 'base', r < 0.25 ? 'glint' : 'base'), { blade: false, ang: 0, lean: 0, sy: 1 });
    },
    duration: dur => MOTIONS.ranbu.windup + dur + 0.3,
  },
};
