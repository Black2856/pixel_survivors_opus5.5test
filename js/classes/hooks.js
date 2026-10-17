// classes/hooks.js — ゲームの側(world.js など)から呼ぶクラスの入口(cls*)・強化ツリーのカード・HUD の E / Q アイコン
//   クラスのファイルより後に読む(WS_TAKEN / WS_TICK が読み込み時に WEAPON_SKILL をたどる)
'use strict';

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
  const cdt = dt * cdRateK(); // スロウタイム・痺れの間は武器と同じく CD の回復が遅い(凍結・麻痺の間も回復はする)
  for (const k in P.sk) P.sk[k].cd = Math.max(0, P.sk[k].cd - cdt);
  if (P.decoy && (P.decoy.t -= dt) <= 0) P.decoy = null;
  if (P.dimK > 0) P.dimK = Math.max(0, P.dimK - dt * 1.5); // 構えで暗くした周りを戻す
  const rt = clsRT();
  if (rt) rt.update(dt);
  for (const w of WS_TICK) w.tick(dt); // 武器スキルの残る効果(オーブ・刃輪・精霊・異次元・斧など)。メイン武器以外の武器スキルも分身などが使うので全て
  // スキルの発動(実行中は他のスキルを使えない)。自動発動は周りに敵が集まっているときだけ(ガード中は使わない)
  if (!P.act && rt && !atkLock()) { // 凍結・麻痺の間は E・Q を使えない
    const ws = weaponSkill(), auto = !P.guard;
    const wantQ = P.wantQ || (auto && P.inp.autoQ && crowd(90, 5));
    const wantE = P.wantE || (auto && P.inp.autoE && ws && crowd(ws.radius * P.area, 4));
    if (wantQ && rt.qStart && P.sk.q.cd <= 0) rt.qStart();
    else if (wantE && WEAPON_SKILL[P.mainW] && P.sk.e.cd <= 0) WEAPON_SKILL[P.mainW].start();
  }
  P.wantQ = P.wantE = false; // 押した印はここで使い切る(使えなかったときも)
  // 実行中のスキル
  if (P.act) {
    const a = P.act;
    a.t += dt;
    if (!a.rel && a.t >= skillWindup(a.slot)) { a.rel = true; skillRelease(a.slot); } // 放つ瞬間
    else if (!a.rel && a.slot === 'q') P.dimK = Math.max(P.dimK || 0, 0.16 * Math.min(1, a.t / 0.12)); // Q の構え: 周りを少し暗くして、陣と集中線を浮かび上がらせる
    if (a.slot === 'q') rt.qUpdate(a, dt); else WEAPON_SKILL[P.mainW].update(a, dt);
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
const SHIELD_MOD0 = { share: 1, k: 1 };
const clsShieldMod = () => (clsRT() && clsRT().shieldMod ? clsRT().shieldMod() : SHIELD_MOD0); // 被弾をシールドで受けるとき: share = シールドで受ける割合 / k = 受けた 1 につき減る量
function clsOnShieldLoss(n) { if (clsRT() && clsRT().onShieldLoss) clsRT().onShieldLoss(n); } // 被弾でシールドが減った(ナイトの還元)
const clsResistDebuff = kind => !!(clsRT() && clsRT().resistDebuff && clsRT().resistDebuff(kind)); // 自分への状態異常をクラスが無効にした(ナイトの金剛)
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
  if (!(n > 0) || e.dead || e.prop || e.freeze || missed === e) return; // 外れた攻撃(砂塵・暗闇)では付かない
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
// 炎上(共通の仕組み)へのクラスの補正: ダメージ倍率・持続の追加
const clsBurnMul = e => (clsRT() && clsRT().burnMul ? clsRT().burnMul(e) : 1);
const clsBurnDur = () => (clsRT() && clsRT().burnDur ? clsRT().burnDur() : 0);

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
