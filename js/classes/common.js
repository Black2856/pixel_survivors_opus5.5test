// classes/common.js — クラスの共通(スタミナ・強化ツリーの値・E / Q の共通処理)と、WEAPON_SKILL / CLASS_RT の入れ物
// world.js からは clsInit / clsUpdate / clsOnHurt / clsOnMainHit / clsOnKill / clsAtkBonus などの入口だけを呼ぶ
'use strict';

// ---------- 共通: スタミナ ----------
// ガード系の防御スキルは、受けるはずだったダメージ分のスタミナを失い、staLock 秒のあいだ回復が止まる
function staUse(n, lock = 0) {
  P.sta = Math.max(0, P.sta - n);
  if (lock) P.staLockT = Math.max(P.staLockT, lock);
  S.hudDirty = true;
}
// 回避(防御スキルのダッシュ・ブリンクなど)の無敵の秒数。固有効果「不壊の」で +20%(ガード系には無敵がないので効かない)
const dodgeIfr = t => t * (P.uq.unbreak ? 1.2 : 1);
function updStamina(dt) {
  P.staLockT -= dt;
  if (P.staLockT > 0) return;
  let n = P.staRegen * dt * (P.fatigueT > 0 ? DATA.debuff.fatigue : 1) * (P.cdSlowT > 0 ? DATA.debuff.slowRegen : 1); // 疲労中・スロウタイム(時の歪み)の中はスタミナ回復 -50%(重なると掛け算)
  if (P.sta >= P.maxSta) { if (clsRT() && clsRT().staFull) clsRT().staFull(n); return; } // 満タンで回復しない分(メイジの瞑想)
  if (clsRT() && clsRT().staRegen) n = clsRT().staRegen(n); // クラスの補正(メイジの瞑想)
  P.sta = Math.min(P.maxSta, P.sta + n);
}

// ---------- ラン中の強化(強化ツリー) ----------
// P.cu['カテゴリ.パス'] = Lv(1〜3) / P.cs[カテゴリ] = 特殊強化を取ったパス
// カテゴリ e(武器スキル)はメイン武器の skill.tree、それ以外はクラスの tree
const weaponSkill = () => DATA.weapons[P.mainW] && DATA.weapons[P.mainW].skill;
const treeCat = cat => (cat === 'e' ? weaponSkill() && weaponSkill().tree : DATA.classes[P.cls].tree[cat]);
const cuLv = (cat, path) => P.cu[cat + '.' + path] || 0;
const cuV = (cat, path, def = 0) => { const l = cuLv(cat, path); return l ? treeCat(cat).paths[path].v[l - 1] : def; };
const hasSp = (cat, path) => P.cs[cat] === path;
// パスの Lv(1〜3)の説明。desc が文字列なら v[lv - 1] を差し込む: {p} = ×100(0.3 → 30)/ {v} = そのまま / {v1} = 小数 1桁(1 → 1.0)
//   v を変えるだけで説明も変わる(辞書は型のまま)。Lv ごとに文が違うもの(Lv1 が「基本 → Lv1」など)は今までどおり配列
const pathDesc = (d, lv) => {
  if (Array.isArray(d.desc)) return d.desc[lv - 1];
  const x = d.v[lv - 1];
  return d.desc.replace('{p}', String(+(x * 100).toFixed(2))).replace('{v1}', x.toFixed(1)).replace('{v}', String(+x.toFixed(3)));
};

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
// 防御スキル(回避・ガードなど)のキーを押しているか。スキルの実行中と凍結の間(行動不能)は使えない
const defHeld = () => P.inp.def && !P.act && !(P.frzT > 0);
// 麻痺: E・Q のクールダウンを最初からにする(使ったときと同じ式。クラスごとの特別な式(居合の残心など)は使わない)
function clsResetSkillCd() {
  const sk = weaponSkill(), m = P.wm[P.mainW] || {}, q = DATA.classes[P.cls].q;
  if (sk && sk.cd) P.sk.e.cd = P.sk.e.max = Math.max(1, sk.cd * (1 - cuV('e', 'cd')) * (1 - (m.cd || 0)) * P.cdMul);
  if (q && q.cd) P.sk.q.cd = P.sk.q.max = Math.max(1, q.cd * (1 - cuV('q', 'cd')) * P.cdMul);
  S.hudDirty = true;
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
// スキル名のカットイン(画面を横切る帯)と構えの演出。slot: 'e' / 'q'。o: カットインの指定(sub: 2行目)/ o.fx: ゲーム画面の演出の色(淡い色はブルームで白く飛ぶので、濃い色を渡す。なければ col)。足元の陣を返す
function skillCall(name, col, slot = 'e', o = {}) {
  const q = slot === 'q';
  UI.skillCut(name, col, q, Object.assign(q ? { glyph: clsRT().qInfo().glyph } : { icon: P.mainW }, o));
  return skillWind(o.fx || col, slot, col);
}
// 撃ち続けるスキル(乱れ桜・バラージュ・火炎放射): 足元の陣を使っている間も残し、終わりに光らせる
const sigilKeep = (sg, dur) => { sg.wu += dur; sg.life += dur; };
// 構えの秒数(予備動作。なければ 0)
const skillWindup = slot => (slot === 'q' ? DATA.classes[P.cls].q.windup : (weaponSkill() || {}).windup) || 0;
// 構え: 足元の陣(溜めの間に開いて明るくなり、放つ瞬間に白く光って広がる。形はクラスごと: skillfx.js の SIGIL)
//   Q はさらに画面の縁から集中線が集まり、周りが少し暗くなる(clsUpdate)。構えのないスキルはすぐ放つ
//   line: 集中線の色(カットインの色)
function skillWind(col, slot, line = col) {
  const q = slot === 'q', W = skillWindup(slot);
  (P.skCol || (P.skCol = {}))[slot] = col;
  const sg = fxSigil(P.x, P.y + 6, q ? 26 : 17, col, { follow: P, oy: 6, wu: W, life: W + 0.4 });
  if (q) fxFocus(P.x, P.y - 4, W + 0.22, line, { follow: P, oy: -4 });
  AudioMan.cast(q);
  if (W <= 0) skillRelease(slot);
  return sg;
}
// 放つ瞬間(構えが終わった瞬間): 足元から輪が広がり、体がきらめく。低い衝撃音(各スキルの炸裂に重なるので控えめ)
function skillRelease(slot) {
  const q = slot === 'q', col = (P.skCol && P.skCol[slot]) || DATA.classes[P.cls].col;
  asMine(() => {
    addRing(P.x, P.y + 6, q ? 34 : 22, col, { r0: 6, w: 2, life: 0.32 });
    fxGlint(P.x + P.facing * 4, P.y - 9, q ? 8 : 5, col, { life: 0.22, core: (SIGIL[P.cls] || {}).hi });
  });
  AudioMan.thump(q);
}

// 武器スキル(E)。メイン武器ごとの実装は各クラスのファイル(classes/<クラス>.js の WEAPON_SKILL.<武器> = { … })
//   並びは index.html の読み込み順(刀・ボルト・長弓・騎士剣・炎・刃・霊・吹雪・雷・オーラ・黒穴・斧)。入口の WS_TAKEN / WS_TICK がこの順にたどる
const WEAPON_SKILL = {};

// クラスごとの実装は各クラスのファイル(classes/<クラス>.js の CLASS_RT.<クラス> = { … })
const CLASS_RT = {};
