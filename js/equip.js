// equip.js — 装備: 生成(レアリティ・オプション・固有効果)/ インベントリ(ロック・売却・強化)/ ラン中のオプション成長
// 装備品: { id, type, rarity, opts: [{ k, v, max, q }], uq, enh, spent, lock }
//   v = 1Lv あたりの値 / max = 最大Lv / q = ロール品質(0 = 範囲の最小、1 = 最大。強化で 1 を超える)
'use strict';

const RARITY_KEYS = Object.keys(DATA.equip.rarity); // コモン → レジェンダリーの順

// ---------- 生成 ----------
// レアリティ: 装備品質 qual が高いほど、上位(番号が大きい)の重みが増える
function rollRarity(qual = 0) {
  const w = RARITY_KEYS.map((k, i) => DATA.equip.rarity[k].w * (1 + qual * i));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((r -= w[i]) <= 0) return RARITY_KEYS[i];
  return RARITY_KEYS[0];
}
// v は範囲内でランダム(装備最大値のステータスで上限が伸びる)。% 系は 0.1% 単位、固定値は 0.1 単位に丸める
function rollOpt(type, k, st) {
  const [lo, hi] = DATA.equip.types[type].opts[k], hiX = hi * (1 + (st.eqMaxVal || 0));
  const raw = lo + Math.random() * (hiX - lo), unit = DATA.stats[k].kind === 'flat' ? 10 : 1000;
  const v = Math.round(raw * unit) / unit;
  const [m0, m1] = DATA.equip.maxLv;
  return { k, v, max: randi(m0, m1 + (st.eqMaxLv || 0)), q: hi > lo ? (v - lo) / (hi - lo) : 1 };
}
function genItem(o = {}) {
  const st = o.stats || {};
  const types = Object.keys(DATA.equip.types).filter(t => !o.slot || DATA.equip.types[t].slot === o.slot);
  const type = o.type || pick(types), rarity = o.rarity || rollRarity(st.eqQual || 0);
  const keys = shuffle(Object.keys(DATA.equip.types[type].opts)).slice(0, DATA.equip.rarity[rarity].n);
  const it = { id: META.nextItemId++, type, rarity, opts: keys.map(k => rollOpt(type, k, st)), uq: null, enh: 0, spent: 0, lock: false, isNew: true }; // isNew: 装備画面で見るまで NEW
  if (rarity === 'legendary') {
    const slot = DATA.equip.types[type].slot;
    it.uq = pick(Object.keys(DATA.uniques).filter(u => DATA.uniques[u].slot === slot));
  }
  return it;
}
const itemSlot = it => DATA.equip.types[it.type].slot;
const itemName = it => (it.uq ? DATA.uniques[it.uq].epi + ' ' : '') + DATA.equip.types[it.type].name;
const itemById = id => META.inventory.find(x => x.id === id);

// ---------- インベントリ ----------
// 追加して保存する。上限を超えた分は自動で売却する(戻り値: 売却した場合はその額)
function invAdd(it) {
  if (META.inventory.length >= DATA.equip.invMax) { const g = sellValue(it); META.gold += g; saveMeta(); return g; }
  META.inventory.push(it); saveMeta();
  return 0;
}
const isEquipped = it => Object.values(META.loadout).includes(it.id);
// 売却額 = 強化費用の基礎値の 20% + それまでに使った強化費用の 10%
const sellValue = it => Math.round(DATA.equip.rarity[it.rarity].cost * 0.2 + it.spent * 0.1);
function sellItem(it) {
  if (it.lock || isEquipped(it)) return 0;
  const g = sellValue(it);
  META.inventory = META.inventory.filter(x => x !== it);
  META.gold += g; saveMeta();
  return g;
}
// ロックも装備もしていない装備をまとめて売却(戻り値: [個数, 合計額])
function sellAllUnlocked() {
  const list = META.inventory.filter(it => !it.lock && !isEquipped(it));
  const g = list.reduce((a, it) => a + sellValue(it), 0);
  META.inventory = META.inventory.filter(it => it.lock || isEquipped(it));
  META.gold += g; saveMeta();
  return [list.length, g];
}
function equipItem(it) { META.loadout[itemSlot(it)] = it.id; saveMeta(); }
function unequipSlot(slot) { META.loadout[slot] = null; saveMeta(); }

// ---------- 強化 ----------
// 1回の強化で、ランダムな1オプションのロール値を +20〜30%。ロール値は範囲の最大(品質 100%)が上限
// 回数の上限と費用はレアリティで決まる(費用は1回ごとに ×1.5)。全オプションが上限なら強化できない
const enhCost = it => Math.round(DATA.equip.rarity[it.rarity].cost * Math.pow(1.5, it.enh));
const optCap = (it, o) => DATA.equip.types[it.type].opts[o.k][1];
const enhTargets = it => it.opts.filter(o => o.v < optCap(it, o));
const canEnhance = it => it.enh < DATA.equip.rarity[it.rarity].enh && enhTargets(it).length > 0;
function enhanceItem(it) {
  if (!canEnhance(it)) return null;
  const cost = enhCost(it);
  if (META.gold < cost) return null;
  META.gold -= cost; it.spent += cost; it.enh++;
  const o = pick(enhTargets(it)), k = 1 + rand(0.2, 0.3), [lo, hi] = DATA.equip.types[it.type].opts[o.k];
  const unit = DATA.stats[o.k].kind === 'flat' ? 10 : 1000;
  o.v = Math.min(hi, Math.round(o.v * k * unit) / unit);
  o.q = hi > lo ? (o.v - lo) / (hi - lo) : 1;
  saveMeta();
  return o;
}

// ---------- ラン中のオプション成長 ----------
// ラン開始時は全オプションが Lv0。レベルアップの装備カードで選んだオプションが +1Lv
function eqInitRun() {
  S.eqLv = {};
  for (const slot in DATA.equip.slots) { const it = itemById(META.loadout[slot]); if (it) S.eqLv[slot] = it.opts.map(() => 0); }
}
// 装備カードの候補: 最大Lv に達していないオプション
function eqCards() {
  const out = [];
  for (const slot in S.eqLv) {
    const it = itemById(META.loadout[slot]);
    it.opts.forEach((o, i) => { if (S.eqLv[slot][i] < o.max) out.push({ type: 'eqopt', slot, i }); });
  }
  return out;
}
// オプションの Lv ごとの値(乗算系は (1 - v)^Lv)
const optAt = (o, lv) => (DATA.stats[o.k].kind === 'red' ? 1 - Math.pow(1 - o.v, lv) : o.v * lv);
function eqLvUp(slot, i) {
  const o = itemById(META.loadout[slot]).opts[i];
  S.eqLv[slot][i]++;
  recalc();
  addFloat(P.x, P.y - 30, `${DATA.stats[o.k].label} Lv${S.eqLv[slot][i]}`, '#9ff7ff', 0.9, -24);
}

// ---------- 宝箱・ラン終了時の報酬 ----------
// 宝箱に入る装備の数: 1 / 2 / 3 個(宝箱品質で多い側へ寄る)
function chestCount(q = 0) {
  const [p1, p2, p3] = DATA.equip.chestN, a = p1 / (1 + q), c = Math.min(0.9, p3 * (1 + q)), r = Math.random();
  return r < c ? 3 : r < c + Math.max(0, 1 - a - c) ? 2 : 1;
}
// 装備宝箱の中身を生成してインベントリへ入れる(死んでも失われない)。カード用のリストを返す
function openEquipChest() {
  const st = lootStats(P.stats), out = [];
  for (let i = chestCount(st.chestQual); i > 0; i--) {
    const it = genItem({ stats: st });
    const sold = invAdd(it);
    S.loot.push(it);
    out.push({ type: 'item', item: it, sold });
  }
  return out;
}
// ラン終了時: 撃破ボス数に応じて宝箱 0〜2個(クリアで +1)
function runEndLoot(win) {
  const n = Math.min(DATA.equip.runEndMax, Math.floor(S.bossKills * DATA.equip.runEndPerBoss + 1e-9)) + (win ? 1 : 0);
  const got = [];
  const st = lootStats(P.stats);
  for (let c = 0; c < n; c++) for (let i = chestCount(st.chestQual); i > 0; i--) {
    const it = genItem({ stats: st });
    invAdd(it); S.loot.push(it); got.push(it);
  }
  return { chests: n, items: got };
}
// クラス経験値: 討伐数 × killK + 撃破ボス数 × bossK(クラス経験値% で増える)。上がった Lv を返す
function gainClassXp() {
  const cl = DATA.classLevel, c = META.classes[P.cls];
  const xp = Math.round((S.kills * cl.killK + S.bossKills * cl.bossK) * (1 + (P.stats.v.classXp || 0)));
  const lv0 = c.lv;
  c.xp += xp;
  while (c.lv <= cl.need.length && c.xp >= cl.need[c.lv - 1]) { c.xp -= cl.need[c.lv - 1]; c.lv++; }
  if (c.lv > cl.need.length) c.xp = 0; // 最大 Lv
  saveMeta();
  return { xp, lv0, lv: c.lv };
}

// ---------- ショップ ----------
// META.shop = { items: [装備...], sold: [id...] }。endRun で null に戻し、次に開いたときに作り直す
function shopRarity(qual) {
  const W = DATA.shop.w, ks = RARITY_KEYS.filter(k => W[k]), w = ks.map((k, i) => W[k] * (1 + qual * i));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ks.length; i++) if ((r -= w[i]) <= 0) return ks[i];
  return ks[0];
}
function shopStock() {
  if (META.shop) return META.shop;
  const st = lootStats(computeStats({})), items = [];
  for (const slot in DATA.equip.slots) for (let i = 0; i < DATA.shop.perSlot; i++) {
    const it = genItem({ stats: st, slot, rarity: shopRarity(st.eqQual || 0) });
    it.isNew = false;
    items.push(it);
  }
  META.shop = { items, sold: [] };
  saveMeta();
  return META.shop;
}
const shopPrice = it => DATA.shop.price[it.rarity];
function shopBuy(id) {
  const sh = shopStock(), it = sh.items.find(x => x.id === id);
  if (!it || sh.sold.includes(id) || META.gold < shopPrice(it) || META.inventory.length >= DATA.equip.invMax) return false;
  META.gold -= shopPrice(it); sh.sold.push(id);
  META.inventory.push(Object.assign({}, it, { opts: it.opts.map(o => Object.assign({}, o)), isNew: true }));
  saveMeta();
  return true;
}

// ---------- 表示用 ----------
// オプション1行: 「攻撃力 +8.0% /Lv」。乗算系・% 系は % 表示
function optVal(o) {
  if (!o.v) return DATA.stats[o.k].kind !== 'flat' ? '0%' : '0' + (DATA.stats[o.k].unit || ''); // Lv0(装備カードの変化前)
  // 値 × Lv や ツリーの合計は 2.0999… のような誤差が出るので、固定値は小数第2位で丸める
  const d = DATA.stats[o.k], val = d.kind !== 'flat' ? (o.v * 100).toFixed(1) + '%' : String(Math.round(o.v * 100) / 100);
  return `${d.kind === 'red' ? '-' : '+'}${val}${d.unit || ''}`;
}
const optText = o => `${DATA.stats[o.k].label} ${optVal(o)} /Lv`;
// HTML 用: 数値は黄色、/Lv は灰色
const optHTML = o => `${DATA.stats[o.k].label} <span class="ov">${optVal(o)}</span><span class="olv">/Lv</span>`;
