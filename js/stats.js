// stats.js — ステータス計算。出どころ(source)ごとの値を保持したまま合算する
// ゲーム内の計算とステータス画面の内訳は、どちらも computeStats() の結果を使う
'use strict';

const STAT_SRC = ['class', 'classLv', 'tree', 'equip', 'unique', 'chaos', 'run', 'micro'];
const STAT_SRC_LABEL = {
  class: 'クラス基礎', classLv: 'クラスLv', tree: '永続ツリー', equip: '装備',
  unique: '固有効果', chaos: 'カオス強化', run: 'ラン中の強化', micro: '微強化',
};

// ---------- 永続ツリーのグラフ ----------
// ノード: { id: "stat#番号", k: stat, dir, depth, x, y, adj: [id...], big: 特別なノード }
// 番号は stat ごとの生成順なので、データを変えない限り同じ ID になる(セーブは ID の配列)
// 深さ d のリング半径(内側ほど混むので、深さ2 から大きく離す)
const TREE_R = d => (d === 1 ? 56 : 80 + d * 40);
const TREE = (() => {
  const T = DATA.tree, nodes = {}, n = {}, R = TREE_R;
  const mk = (k, dir, depth, ang, o = {}) => {
    n[k] = (n[k] || 0) + 1;
    const id = k + '#' + n[k], r = R(depth) + (o.out || 0);
    nodes[id] = { id, k, dir, depth, big: !!o.big, leaf: !!o.leaf, mid: !!o.mid, adj: [], x: Math.cos(ang) * r, y: Math.sin(ang) * r };
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
    const D = T.dirs[dk], secW = Math.PI * 2 / dirKeys.length, c0 = -Math.PI / 2 + di * secW;
    const root = mk(D.root, dk, 1, c0);
    const bw = secW * 0.9 / D.branches.length; // 方向の間に少し隙間を空ける
    D.branches.forEach((B, bi) => {
      // 列: 行き止まり / 本線 / 行き止まり / 本線 / 行き止まり(本線 L 本なら 2L+1 列)
      const bc = c0 - secW * 0.45 + bw * (bi + 0.5), L = B.lanes || 1, cols = 2 * L + 1;
      const colAng = c => bc + (c - L) * (bw * 0.7 / (cols - 1)); // 隣の枝と離すため、枝の幅の 7 割に収める
      // 本線: 深さ2 から外へ、レーンを交互に埋める
      const lanes = Array.from({ length: L }, () => []);
      interleave(B.chain).forEach((k, i) => {
        const l = i % L, nd = mk(k, dk, lanes[l].length + 2, colAng(2 * l + 1));
        if (lanes[l].length) link(lanes[l][lanes[l].length - 1], nd); else link(root, nd);
        lanes[l].push(nd);
      });
      // 真ん中の特別なノード(mid): 本線の間の列、同じ深さの本線ノードとつながる
      const used = new Set();
      for (const k in B.mid || {}) for (const d of B.mid[k]) {
        const nd = mk(k, dk, d, colAng(L), { big: true, mid: true, out: 20 });
        for (const ln of lanes) if (ln[d - 2]) link(ln[d - 2], nd);
        used.add(L + ':' + d);
      }
      // 行き止まり: 本線の横の空き(同じ深さ、少し外側)に、深さが偏らないよう均等に置く。つながるのは隣の本線ノード1つだけ
      const slots = [];
      lanes.forEach((ln, l) => ln.forEach(p => {
        for (const c of [2 * l + 1 + (l === 0 ? 1 : -1), 2 * l + 1 + (l === 0 ? -1 : 1)]) slots.push({ c, d: p.depth, p });
      }));
      const byD = {}; for (const s of slots) (byD[s.d] = byD[s.d] || []).push(s);
      let depths = Object.keys(byD).map(Number).sort((a, b) => a - b);
      const leaves = interleave(B.leaf || {}), free = d => byD[d].filter(x => !used.has(x.c + ':' + x.d)).length;
      // 先端(tip)がある枝は、一番外の段に行き止まりを置かない(先端の大きいノードと重なるため)。空きが足りるときだけ
      if (B.tip && depths.slice(0, -1).reduce((a, d) => a + free(d), 0) >= leaves.length) depths = depths.slice(0, -1);
      leaves.forEach((k, i) => {
        const want = depths[Math.min(depths.length - 1, Math.floor((i + 0.5) * depths.length / leaves.length))];
        const order = depths.slice().sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || b - a);
        let s = null;
        for (const d of order) { s = byD[d].find(x => !used.has(x.c + ':' + x.d)); if (s) break; }
        used.add(s.c + ':' + s.d);
        link(s.p, mk(k, dk, s.d, colAng(s.c), { leaf: true, out: 18 }));
      });
      if (B.tip) {
        const depth = Math.max(...lanes.map(ln => ln.length)) + 2, tip = mk(B.tip, dk, depth, bc, { big: true });
        for (const ln of lanes) link(ln[ln.length - 1], tip);
        if (B.crown) link(tip, mk(B.crown, dk, depth + 1, bc, { big: true }));
      }
    });
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

// 装備の入手に使う値(品質は倍率も掛けた実際の値: (1 + 合計) × 倍率 - 1)
const lootStats = s => ({
  eqQual: (1 + (s.v.eqQual || 0)) * (s.mul.eqQual || 1) - 1, chestQual: (1 + (s.v.chestQual || 0)) * (s.mul.chestQual || 1) - 1,
  eqMaxVal: s.v.eqMaxVal || 0, eqMaxLv: s.v.eqMaxLv || 0,
});

// ---------- カオス強化 ----------
// key: モード・ステージのキー('arena' は闘技場の項目)/ lv: { 項目のキー: Lv } → 合計ポイント / 報酬の行
//   その項目の一覧にないキー(以前の設定の残り)は数えない。最大Lv を超えた分も数えない
const chaosMods = key => (key === 'arena' ? DATA.chaos.arenaMods : DATA.chaos.mods);
const chaosLv = (lv, m) => Math.min(m.max, (lv && lv[m.k]) || 0);
const chaosPoints = (lv, key) => chaosMods(key).reduce((a, m) => a + chaosLv(lv, m) * m.pt, 0);
const chaosReward = pt => DATA.chaos.rewards.filter(r => pt >= r.pt).pop() || null;
const chaosDesc = (m, lv) => m.desc.replace('{v}', (lv || 1) * m.per);
// そのモード・ステージで使う設定: クリアするまでは tier の値で固定(エスカレーション・闘技場は無し)。クリア後は META.chaos[key](最初は tier の値)
const chaosBase = key => { const R = DATA.stageRuns.find(r => 'stage' + r.no === key); return Object.assign({}, R ? DATA.flow.tierChaos[R.tier - 1] : {}); };
const chaosFixed = key => !META.stageClear[key];
const chaosSetting = key => (chaosFixed(key) ? chaosBase(key) : META.chaos[key] || (META.chaos[key] = chaosBase(key)));

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

  // カオス強化の報酬(そのランの合計ポイントに応じて)
  if (run && S && S.chaosReward) for (const k in S.chaosReward) if (k !== 'pt') add('chaos', k, S.chaosReward[k]);

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
  P.maxhp = Math.max(1, Math.round(v.hp * m.hp) + clsHpAdd()); // クラスの最大HP の追加(ウェポンマスターの頑健など。変わったらクラスが recalc する)
  P.hp = Math.min(P.hp, P.maxhp);
  P.regen = v.regen;
  P.armor = v.def;
  P.dr = v.dr;
  P.maxSta = v.sta; P.staRegen = v.staRegen;
  P.iframe = DATA.player.iframe * (1 + v.iframe);
  P.foodMul = Math.max(0, 1 + v.food);
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
