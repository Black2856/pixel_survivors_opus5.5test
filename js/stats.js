// stats.js — ステータス計算。出どころ(source)ごとの値を保持したまま合算する
// ゲーム内の計算とステータス画面の内訳は、どちらも computeStats() の結果を使う
'use strict';

const STAT_SRC = ['class', 'classLv', 'tree', 'equip', 'unique', 'run', 'micro'];
const STAT_SRC_LABEL = {
  class: 'クラス基礎', classLv: 'クラスLv', tree: '永続ツリー', equip: '装備',
  unique: '固有効果', run: 'ラン中の強化', micro: '微強化',
};

// ---------- 永続ツリーのグラフ ----------
// ノード: { id: "stat#番号", k: stat, dir, depth, x, y, adj: [id...], big: 特別なノード }
// 番号は stat ごとの生成順なので、データを変えない限り同じ ID になる(セーブは ID の配列)
// 深さ d のリング半径(内側ほど混むので、深さ2 から大きく離す)
const TREE_R = d => (d === 1 ? 56 : 80 + d * 40);
const TREE = (() => {
  const T = DATA.tree, nodes = {}, n = {}, R = TREE_R;
  const mk = (k, dir, depth, ang, big) => {
    n[k] = (n[k] || 0) + 1;
    const id = k + '#' + n[k];
    nodes[id] = { id, k, dir, depth, big: !!big, adj: [], x: Math.cos(ang) * R(depth), y: Math.sin(ang) * R(depth) };
    return nodes[id];
  };
  const link = (a, b) => { a.adj.push(b.id); b.adj.push(a.id); };
  // 同じステータスが続かないよう、残り数の割合が一番大きいものから順に並べる
  const interleave = cnt => {
    const left = Object.assign({}, cnt), tot = Object.values(cnt).reduce((a, b) => a + b, 0), out = [];
    for (let i = 0; i < tot; i++) {
      const k = Object.keys(left).filter(x => left[x] > 0 && x !== out[i - 1]).sort((a, b) => left[b] / cnt[b] - left[a] / cnt[a] || left[b] - left[a])[0]
        || Object.keys(left).find(x => left[x] > 0);
      out.push(k); left[k]--;
    }
    return out;
  };
  const dirKeys = Object.keys(T.dirs);
  dirKeys.forEach((dk, di) => {
    const D = T.dirs[dk], c0 = -Math.PI / 2 + di * Math.PI * 2 / dirKeys.length, secW = Math.PI * 2 / dirKeys.length;
    const root = mk(D.root, dk, 1, c0);
    const bw = secW * 0.9 / D.branches.length, tips = []; // 方向の間に少し隙間を空ける
    D.branches.forEach((B, bi) => {
      const bc = c0 - secW * 0.45 + bw * (bi + 0.5), seq = interleave(B.nodes), lanes = Math.ceil(seq.length / B.rows);
      const grid = [];
      seq.forEach((k, i) => {
        const row = Math.floor(i / lanes), lane = i % lanes, inRow = Math.min(lanes, seq.length - row * lanes);
        const ang = lanes > 1 ? bc + (lane - (inRow - 1) / 2) * (bw * 0.7 / (lanes - 1)) : bc;
        const nd = mk(k, dk, row + 2, ang);
        (grid[row] = grid[row] || []).push(nd);
      });
      // 隣接: 根 ↔ 1段目、同じ段の隣、1つ内側の段の近い位置
      for (const nd of grid[0]) link(root, nd);
      grid.forEach((row, r) => {
        row.forEach((nd, i) => {
          if (i > 0) link(row[i - 1], nd);
          if (r > 0) {
            const prev = grid[r - 1], j = Math.round(i * (prev.length - 1) / Math.max(1, row.length - 1));
            link(prev[row.length === 1 ? Math.floor((prev.length - 1) / 2) : j], nd);
          }
        });
      });
      if (B.tip) {
        const last = grid[grid.length - 1], tip = mk(B.tip, dk, grid.length + 2, bc, true);
        for (const nd of last) link(nd, tip);
        tips.push(tip);
      }
    });
    if (D.crown) { const cr = mk(D.crown, dk, Math.max(...tips.map(t => t.depth)) + 1, c0, true); for (const t of tips) link(t, cr); }
  });
  return nodes;
})();
const treeCost = nd => DATA.tree.costBase * Math.pow(2, nd.depth);
const treeOwned = id => META.tree.includes(id);
// 取れるノード: 深さ1(根)か、取得済みのノードに隣接している
const treeOpen = nd => !treeOwned(nd.id) && (nd.depth === 1 || nd.adj.some(treeOwned));
function treeBuy(id) {
  const nd = TREE[id];
  if (!nd || !treeOpen(nd) || META.gold < treeCost(nd)) return false;
  META.gold -= treeCost(nd); META.tree.push(id); saveMeta();
  return true;
}

// 取得済みノード数を stat ごとに数える(今のツリーにない ID は無視)
function treeCounts() {
  const c = {};
  for (const id of META.tree) { const nd = TREE[id]; if (nd) c[nd.k] = (c[nd.k] || 0) + 1; }
  return c;
}
function treeNodeValue(stat) {
  for (const dir in DATA.tree.stats) { const t = DATA.tree.stats[dir][stat]; if (t) return t[0] / t[1]; }
  return 0;
}

// 装備中のアイテムのオプションを列挙する。lvOf(slot, i, opt) でそのオプションの Lv を返す
function equippedOpts(lvOf) {
  const out = [];
  for (const slot in DATA.equip.slots) {
    const id = META.loadout[slot];
    const it = id && META.inventory.find(x => x.id === id);
    if (!it) continue;
    it.opts.forEach((o, i) => out.push({ k: o.k, v: o.v, lv: lvOf(slot, i, o) }));
  }
  return out;
}

// ---------- クラスLv の効果 ----------
// 専用 = クラスの lv 表(そのクラスの Lv)/ 共通 = 武器の mastery 表(その武器を持つクラスの Lv)
const classLvOf = cls => (META.classes[cls] || { lv: 1 }).lv;
const weaponOwner = k => Object.keys(DATA.classes).find(c => DATA.classes[c].weapon === k);
function sumLvFx(tbl, lv) {
  const o = {};
  for (const l in tbl || {}) if (lv >= +l) for (const k in tbl[l].fx || {}) {
    const v = tbl[l].fx[k];
    o[k] = k === 'cd' ? 1 - (1 - (o[k] || 0)) * (1 - v) : (o[k] || 0) + v; // クールダウンは乗算で重ねる
  }
  return o;
}
const classLvFx = cls => sumLvFx(DATA.classes[cls].lv, classLvOf(cls));
const weaponMastery = k => { const o = weaponOwner(k); return o ? sumLvFx(DATA.weapons[k].mastery, classLvOf(o)) : {}; };
// Lv ごとの解放内容(クラス画面用): 2〜最大Lv の { lv, kind: '専用' | '共通', d }
function classLvTable(cls) {
  const c = DATA.classes[cls], m = DATA.weapons[c.weapon] && DATA.weapons[c.weapon].mastery, out = [];
  for (let l = 2; l <= DATA.classLevel.need.length + 1; l++) {
    if (c.lv[l]) out.push({ lv: l, kind: '専用', d: c.lv[l].d });
    else if (m && m[l]) out.push({ lv: l, kind: '共通', d: m[l].d });
    else out.push({ lv: l, kind: '', d: '(準備中)' });
  }
  return out;
}

// eq: 装備オプションの Lv の扱い。'run' = ラン中の現在Lv / 'zero' = ラン開始時(全て0) / 'max' = 全て最大Lv
function computeStats({ cls = META.cls, run = false, eq = run ? 'run' : 'zero' } = {}) {
  const by = {}, mul = {};
  for (const k in DATA.stats) { by[k] = {}; mul[k] = 1; }
  const add = (src, k, v) => {
    if (!v || !by[k]) return;
    const red = DATA.stats[k].kind === 'red';
    const cur = by[k][src];
    by[k][src] = red ? 1 - (1 - (cur || 0)) * (1 - v) : (cur || 0) + v;
  };
  const addN = (src, k, v, n) => {
    if (!n || !by[k]) return;
    if (DATA.stats[k].kind === 'red') add(src, k, 1 - Math.pow(1 - v, n)); else add(src, k, v * n);
  };
  const c = DATA.classes[cls];

  // クラス基礎 / クラスLv
  for (const k in c.base) add('class', k, c.base[k]);
  const clv = classLvOf(cls);
  for (const l in c.lv) if (clv >= +l) for (const k in c.lv[l].st || {}) add('classLv', k, c.lv[l].st[k]);

  // 永続ツリー
  const tc = treeCounts();
  for (const k in tc) addN('tree', k, treeNodeValue(k), tc[k]);

  // 装備(オプションは Lv0 開始。ラン中にレベルアップで伸びる)
  const lvOf = eq === 'run' ? (slot, i) => (S && S.eqLv && S.eqLv[slot] ? S.eqLv[slot][i] || 0 : 0)
    : eq === 'max' ? (slot, i, o) => o.max : () => 0;
  for (const o of equippedOpts(lvOf)) addN('equip', o.k, o.v, o.lv);

  // 固有効果(レジェンダリー)。ステータス以外の効果は uq のキーで各処理が見る
  const uq = {};
  for (const slot in DATA.equip.slots) {
    const it = META.loadout[slot] && META.inventory.find(x => x.id === META.loadout[slot]);
    if (!it || !it.uq) continue;
    const U = DATA.uniques[it.uq];
    uq[it.uq] = true;
    for (const k in U.stat || {}) add('unique', k, U.stat[k]);
    for (const k in U.mul || {}) mul[k] *= U.mul[k];
  }

  // 微強化(hpPct は最大HP の倍率)
  if (run && P) for (const k in P.micro) { if (k === 'hpPct') mul.hp *= 1 + P.micro[k]; else add('micro', k, P.micro[k]); }

  const v = {};
  for (const k in by) {
    const vals = Object.values(by[k]);
    v[k] = DATA.stats[k].kind === 'red' ? 1 - vals.reduce((p, x) => p * (1 - x), 1) : vals.reduce((a, b) => a + b, 0);
  }
  return { v, by, mul, uq };
}

// computeStats の結果をプレイヤーの実数値に反映する
function applyStats() {
  const st = computeStats({ cls: P.cls, run: true }), v = st.v, m = st.mul;
  P.stats = st;
  P.maxhp = Math.max(1, Math.round(v.hp * m.hp));
  P.hp = Math.min(P.hp, P.maxhp);
  P.regen = v.regen;
  P.armor = v.def;
  P.dr = v.dr;
  P.maxSta = v.sta; P.staRegen = v.staRegen;
  P.iframe = DATA.player.iframe * (1 + v.iframe);
  P.speed = DATA.player.speed * Math.max(0.1, 1 + v.spd) * m.spd;
  P.uq = st.uq;
  P.atk = v.atk; P.atkMul = m.atk;
  P.area = Math.max(0.1, 1 + v.area) * m.area;
  P.range = Math.max(0.1, 1 + v.range) * m.range;
  P.cdMul = (1 - v.cd) * m.cd;
  P.shots = Math.round(v.shots || 0);
  P.crit = v.crit;
  P.critMul = 1 + v.critDmg + (P.uq.eye ? Math.max(0, v.crit - 1) : 0); // 天眼の: 100% を超えた会心率を会心ダメージへ
  P.xpMul = (1 + v.xp) * m.xp;
  P.goldMul = (1 + v.gold) * m.gold;
  P.magnet = DATA.player.magnet * Math.max(0.1, 1 + v.magnet);
  return st;
}
