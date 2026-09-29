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

const MOTIONS = {
  // 居合(Q): 構え(0.25 秒)→ 抜刀して振り上げ → 残心 → 血振り → 納刀
  iai: {
    dur: 1.13, release: 0.25,
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
    windup: 0.2,
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
