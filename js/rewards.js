// rewards.js — 報酬ロジック(レベルアップの選択肢)
'use strict';

// ============================================================
// 報酬ロジック(レベルアップ)
// 3の倍数の Lv = クラス強化 / それ以外 = 武器カード / 武器カードを取り切ったら微強化(メニューなし)
// ============================================================
const isClassLv = lv => lv % 3 === 0;
// 3の倍数以外: 武器カードと装備カードを混ぜる。1枚ごとに cardRate で装備カード(片方が尽きたらもう片方)
// 進化できる武器があれば必ず1枚入れる。両方尽きたら空(微強化)
function buildChoices(lv) {
  if (isClassLv(lv)) return clsChoices(3 + (P.stats.v.classPick || 0));
  const n = 3 + (P.stats.v.gearPick || 0), wp = weaponPool(), eq = shuffle(eqCards()), evo = evolvable();
  const out = evo.length ? [{ type: 'evo', key: evo[0] }] : [];
  while (out.length < n && (wp.length || eq.length)) {
    if (eq.length && (!wp.length || Math.random() < DATA.equip.cardRate)) { out.push(eq.pop()); continue; }
    let r = Math.random() * wp.reduce((sum, c) => sum + c.w, 0), i = 0; // 武器は重み付きで引く
    while ((r -= wp[i].w) > 0) i++;
    out.push(wp.splice(i, 1)[0]);
  }
  return out;
}
// 武器カードの候補: 新しいサブ武器(武器枠に空きがあるとき)/ 所持武器の Lv +1
function weaponPool() {
  const pool = [], wc = Object.keys(P.weapons).length;
  for (const k in DATA.weapons) {
    const w = P.weapons[k];
    if (!w) { if (wc < P.weaponSlots) pool.push({ type: 'weapon', key: k, w: 1 }); } // サブ武器(メイン武器は所持済みなので Lv アップのみ)
    else if (w.lv < 5) pool.push({ type: 'weapon', key: k, w: 1.6 });
  }
  return pool;
}
function applyChoice(c) {
  if (c.type === 'weapon') addWeapon(c.key);
  else if (c.type === 'evo') P.weapons[c.key].evo = true;
  else if (c.type === 'cls') clsApply(c);
  else if (c.type === 'eqopt') eqLvUp(c.slot, c.i);
  else if (c.type === 'item') { /* 宝箱を開けた時点でインベントリに入っている */ }
  S.hudDirty = true;
}
// 進化: 武器Lv5 かつ 熟練で解放済み(その武器を持つクラスの Lv10。メイン武器もサブ武器も)
function evolvable() {
  return Object.keys(P.weapons).filter(k => {
    const w = P.weapons[k];
    return w.lv >= 5 && !w.evo && !!(P.wm[k] && P.wm[k].evo);
  });
}
// 微強化: 武器カードを取り切った後のレベルアップ(ランダムに1つ、浮き文字で通知)
function microBuff() {
  const m = pick(DATA.micro);
  P.micro[m.k] = (P.micro[m.k] || 0) + m.v;
  recalc();
  addFloat(P.x, P.y - 20, m.label, '#ffd23f', 1.1);
  burst(P.x, P.y, 14, ['#ffd23f', '#ffffff'], { sp: 90, up: 40, glow: true });
}
