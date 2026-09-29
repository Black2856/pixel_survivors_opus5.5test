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
  const it = { id: META.nextItemId++, type, rarity, opts: keys.map(k => rollOpt(type, k, st)), uq: null, enh: 0, spent: 0, lock: false };
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
// 1回の強化で、ランダムな1オプションのロール値を +20〜30%。回数の上限と費用はレアリティで決まる(費用は1回ごとに ×1.5)
const enhCost = it => Math.round(DATA.equip.rarity[it.rarity].cost * Math.pow(1.5, it.enh));
const canEnhance = it => it.enh < DATA.equip.rarity[it.rarity].enh;
function enhanceItem(it) {
  if (!canEnhance(it)) return null;
  const cost = enhCost(it);
  if (META.gold < cost) return null;
  META.gold -= cost; it.spent += cost; it.enh++;
  const o = pick(it.opts), k = 1 + rand(0.2, 0.3), [lo, hi] = DATA.equip.types[it.type].opts[o.k];
  const unit = DATA.stats[o.k].kind === 'flat' ? 10 : 1000;
  o.v = Math.round(o.v * k * unit) / unit;
  o.q = hi > lo ? (o.v - lo) / (hi - lo) : 1;
  saveMeta();
  return o;
}

// ---------- ラン中のオプション成長 ----------
// ラン開始時は全オプションが Lv0。レベルアップのたびに、最大Lv に達していないオプションから完全ランダムに1つを +1Lv
function eqInitRun() {
  S.eqLv = {};
  for (const slot in DATA.equip.slots) { const it = itemById(META.loadout[slot]); if (it) S.eqLv[slot] = it.opts.map(() => 0); }
}
function eqGrow() {
  const cand = [];
  for (const slot in S.eqLv) {
    const it = itemById(META.loadout[slot]);
    it.opts.forEach((o, i) => { if (S.eqLv[slot][i] < o.max) cand.push([slot, i, o]); });
  }
  if (!cand.length) return;
  const [slot, i, o] = pick(cand);
  S.eqLv[slot][i]++;
  recalc();
  addFloat(P.x, P.y - 30, `${DATA.stats[o.k].label} Lv${S.eqLv[slot][i]}`, '#9ff7ff', 0.9, -24);
}

// ---------- 表示用 ----------
// オプション1行: 「攻撃力 +8.0%/Lv」。乗算系・% 系は % 表示
function optText(o) {
  const d = DATA.stats[o.k], pct = d.kind !== 'flat';
  const val = pct ? (o.v * 100).toFixed(1) + '%' : String(o.v);
  return `${d.label} ${d.kind === 'red' ? '-' : '+'}${val}${d.unit || ''}/Lv`;
}
