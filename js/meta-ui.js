// meta-ui.js — ラン外の画面(ステージ選択 / クラス / 強化ツリー / ショップ / 装備)
'use strict';

const MetaUI = (() => {
  const $ = UI.$;
  let filter = 'all', sel = null, sellArm = null;

  // ロール品質の表示: 範囲の最小 = 0%、最大 = 100%(強化の上限)。100% は金色
  const qualHTML = q => {
    const p = Math.round(q * 100);
    return `<span class="q ${p >= 100 ? 'over' : ''}"><i style="width:${Math.min(100, Math.max(0, p))}%"></i></span><b class="${p >= 100 ? 'over' : ''}">${p >= 100 ? 'MAX' : p + '%'}</b>`;
  };
  const icon = (it, cls = 'icon') => `<img class="${cls}" src="${ART.S.eqIcons[it.type].c.toDataURL()}" alt="">`;
  const rcol = it => DATA.equip.rarity[it.rarity].col;

  function open() {
    state = 'equip'; sel = null;
    UI.only('equip-screen');
    render();
  }
  function close() { state = 'title'; UI.title(); }

  function render() {
    $('eq-gold').textContent = '● ' + META.gold.toLocaleString() + ' G';
    // 装備中の3枠
    $('eq-slots').innerHTML = Object.entries(DATA.equip.slots).map(([slot, label]) => {
      const it = itemById(META.loadout[slot]);
      return `<button class="eq-slot ${it && sel === it ? 'sel' : ''}" data-id="${it ? it.id : ''}" style="--rc:${it ? rcol(it) : '#3a3060'}">
        <span class="lbl">${label}</span>${it ? icon(it, 'big') + `<span class="nm">${itemName(it)}</span>` : '<span class="nm dim">なし</span>'}</button>`;
    }).join('');
    // 一覧(部位で絞り込み・レアリティの高い順 → 新しい順)
    const list = META.inventory.filter(it => filter === 'all' || itemSlot(it) === filter)
      .sort((a, b) => RARITY_KEYS.indexOf(b.rarity) - RARITY_KEYS.indexOf(a.rarity) || b.id - a.id);
    $('eq-count').textContent = `${META.inventory.length} / ${DATA.equip.invMax}`;
    for (const b of $('eq-tabs').children) b.classList.toggle('on', b.dataset.f === filter);
    $('eq-list').innerHTML = list.length ? list.map(it => `<button class="eq-item ${sel === it ? 'sel' : ''}" data-id="${it.id}" style="--rc:${rcol(it)}" title="${itemName(it)}">
        ${icon(it)}${it.lock ? '<span class="lk">🔒</span>' : ''}${isEquipped(it) ? '<span class="eqd">E</span>' : ''}${it.enh ? `<span class="en">+${it.enh}</span>` : ''}${it.isNew ? '<span class="nw">NEW</span>' : ''}</button>`).join('')
      : '<div class="dim eq-empty">装備がありません。ボスを倒すと装備宝箱を落とします</div>';
    detail();
    const unlocked = META.inventory.filter(it => !it.lock && !isEquipped(it));
    const b = $('eq-sellall');
    b.disabled = !unlocked.length;
    if (!sellArm) b.textContent = `ロック以外を売却 (${unlocked.length}個 +${unlocked.reduce((a, it) => a + sellValue(it), 0)}G)`;
    statusPanel('eq-status');
  }

  // 選んだ装備の詳細と操作
  function detail() {
    const box = $('eq-detail'), it = sel;
    if (!it || !META.inventory.includes(it)) { box.innerHTML = '<div class="dim">装備を選ぶと詳細が表示されます</div>'; return; }
    const R = DATA.equip.rarity[it.rarity], eq = isEquipped(it);
    box.innerHTML = `
      <div class="eq-head" style="--rc:${R.col}">${icon(it, 'big')}<div><div class="rar">${R.name} ・ ${DATA.equip.slots[itemSlot(it)]}</div><div class="nm">${itemName(it)}</div></div></div>
      <div class="eq-opts">${it.opts.map(o => `<div class="eq-opt"><span>${optHTML(o)}</span><em>〜Lv${o.max}</em>${qualHTML(o.q)}</div>`).join('')}</div>
      ${it.uq ? `<div class="eq-uq">★ ${DATA.uniques[it.uq].desc}</div>` : ''}
      <div class="dim eq-note">ラン開始時は全オプション Lv0。レベルアップの装備カードで選んだオプションが +1Lv</div>
      <div class="eq-enh">強化 ${it.enh} / ${R.enh}</div>
      <div class="eq-btns">
        <button class="btn" data-act="equip">${eq ? '外す' : '装備する'}</button>
        <button class="btn ghost" data-act="lock">${it.lock ? 'ロック解除' : 'ロック'}</button>
        <button class="btn" data-act="enh" ${canEnhance(it) && META.gold >= enhCost(it) ? '' : 'disabled'}>${canEnhance(it) ? `強化 ● ${enhCost(it)}` : it.enh >= R.enh ? '強化 回数上限' : '強化 全て最大'}</button>
        <button class="btn ghost" data-act="sell" ${it.lock || eq ? 'disabled' : ''}>売却 +${sellValue(it)}G</button>
      </div>`;
  }

  function act(a) {
    const it = sel;
    if (!it) return;
    if (a === 'equip') { if (isEquipped(it)) unequipSlot(itemSlot(it)); else equipItem(it); AudioMan.select(); }
    else if (a === 'lock') { it.lock = !it.lock; saveMeta(); AudioMan.click(); }
    else if (a === 'enh') {
      const o = enhanceItem(it);
      if (o) { AudioMan.levelup(); UI.announce('強化成功!', `${DATA.stats[o.k].label} のロール値アップ`); }
    } else if (a === 'sell') { const g = sellItem(it); if (g) { AudioMan.coin(); sel = null; } }
    render();
  }

  // ---------- クラス ----------
  // 実装済みのクラス(ランタイムがあるもの)だけ選べる。Lv15 でメイン武器を他クラスのメイン武器に変更できる
  let clSel = null, back = 'title';
  const clsReady = k => !!CLASS_RT[k];
  const portrait = k => { const r = ART.S[DATA.classes[k].rig]; return (r ? ART.rigFrame(r, 'idle', 0) : ART.S.player).c.toDataURL(); }; // 待機の1フレーム目(持ち物も描かれる)
  function classScreen(from = 'title') {
    state = 'class'; back = from; clSel = META.cls;
    UI.only('class-screen');
    renderClass();
  }
  function renderClass() {
    $('cl-list').innerHTML = Object.keys(DATA.classes).map(k => {
      const c = DATA.classes[k], m = META.classes[k];
      return `<button class="cl-card ${clSel === k ? 'sel' : ''} ${clsReady(k) ? '' : 'off'}" data-k="${k}" style="--cc:${c.col}">
        <img src="${portrait(k)}" alt=""><span class="nm">${c.name}<small>${c.en}</small></span>
        <span class="lv">${clsReady(k) ? 'Lv ' + m.lv : '準備中'}</span>${META.cls === k ? '<span class="use">使用中</span>' : ''}</button>`;
    }).join('');
    const k = clSel, c = DATA.classes[k], m = META.classes[k], need = DATA.classLevel.need, max = need.length + 1;
    const xpP = m.lv >= max ? 100 : m.xp / need[m.lv - 1] * 100;
    const rows = classLvTable(k).map(r => `<div class="cl-row ${m.lv >= r.lv ? 'got' : ''} ${m.lv + 1 === r.lv ? 'next' : ''}">
      <b>Lv${r.lv}</b><span class="tag ${r.kind === '共通' ? 'wp' : ''}">${r.kind}</span><span>${r.d}</span><em>${m.lv >= r.lv ? '✔' : need[r.lv - 2].toLocaleString()}</em></div>`).join('');
    const swap = classLvFx(k).swap, weps = [...new Set(Object.values(DATA.classes).map(x => x.weapon))];
    const wepBtns = weps.map(w => `<button class="cl-wep ${m.weapon === w ? 'on' : ''}" data-w="${w}" ${swap || w === c.weapon ? '' : 'disabled'}>
      ${UI.weaponIcon(w)}<span>${DATA.weapons[w].name}${w === c.weapon ? '<small>専用</small>' : ''}${DATA.weapons[w].skill ? '' : '<small class="dim">Eスキルなし</small>'}</span></button>`).join('');
    $('cl-detail').innerHTML = `
      <div class="cl-head" style="--cc:${c.col}"><span class="nm">${c.name}</span><span class="lv">Lv ${m.lv}${m.lv >= max ? ' MAX' : ''}</span></div>
      <div class="cl-xp"><i style="width:${xpP.toFixed(1)}%"></i><span>${m.lv >= max ? 'MAX' : `${m.xp.toLocaleString()} / ${need[m.lv - 1].toLocaleString()} EXP`}</span></div>
      <div class="dim cl-note">クラス経験値 = 討伐数 + 撃破ボス数 × ${DATA.classLevel.bossK}(ラン終了時)。<span class="tag">専用</span>このクラスだけ <span class="tag wp">共通</span>${DATA.weapons[c.weapon].name}を使うどのクラスにも効く</div>
      <div class="cl-rows">${rows}</div>
      <div class="cl-sub">メイン武器 ${swap ? '' : '<span class="dim">(Lv15 で切り替え解放)</span>'}</div>
      <div class="cl-weps">${wepBtns}</div>
      <button class="btn cl-go" ${clsReady(k) ? '' : 'disabled'}>${META.cls === k ? '使用中' : 'このクラスにする'}</button>`;
    statusPanel('cl-status', k);
  }
  // MetaUI は StatusUI より先に読み込まれるので、実行時に参照する
  const statusPanel = (id, cls) => { if (typeof StatusUI !== 'undefined') StatusUI.render($(id), false, cls); };
  $('cl-list').onclick = e => { const b = e.target.closest('.cl-card'); if (!b) return; clSel = b.dataset.k; AudioMan.click(); renderClass(); };
  $('cl-detail').onclick = e => {
    const w = e.target.closest('.cl-wep');
    if (w && !w.disabled) { META.classes[clSel].weapon = w.dataset.w; saveMeta(); AudioMan.select(); renderClass(); return; }
    const g = e.target.closest('.cl-go');
    if (g && !g.disabled && META.cls !== clSel) { META.cls = clSel; saveMeta(); AudioMan.select(); renderClass(); }
  };
  const closeClass = () => { if (back === 'stage') stageSelect(); else { state = 'title'; UI.title(); } };
  $('cl-back').onclick = () => { AudioMan.click(); closeClass(); };
  $('btn-class').onclick = () => { AudioMan.click(); classScreen(); };

  // ---------- 永続強化ツリー ----------
  // 円形のツリー。取得済みに隣接するノードが取れる(深さ1 は最初から)。費用 = 50 × 2^深さ。リセットなし
  let trSel = null;
  const nodeName = nd => `${DATA.stats[nd.k].label} ${optVal({ k: nd.k, v: treeNodeValue(nd.k) })}`;
  function treeScreen() {
    state = 'tree'; trSel = null;
    UI.only('tree-screen');
    renderTree();
  }
  function renderTree() {
    $('tr-gold').textContent = '● ' + META.gold.toLocaleString() + ' G';
    const T = DATA.tree, nodes = Object.values(TREE);
    let svg = '';
    // リング(深さの目安)と方向の名前
    for (let d = 1; d <= 7; d++) svg += `<circle class="ring" r="${TREE_R(d)}"/>`;
    Object.keys(T.dirs).forEach((dk, di) => {
      const a = -Math.PI / 2 + di * Math.PI * 2 / 3, D = T.dirs[dk];
      svg += `<text class="dirname" x="${Math.cos(a) * 104}" y="${Math.sin(a) * 104 + 5}" fill="${D.col}">${D.name}</text>`;
    });
    // 線(両端の状態で明るさを変える)
    const seen = new Set();
    for (const nd of nodes) for (const id of nd.adj) {
      const key = nd.id < id ? nd.id + '|' + id : id + '|' + nd.id;
      if (seen.has(key)) continue; seen.add(key);
      const o = TREE[id], lit = treeOwned(nd.id) && treeOwned(id), half = treeOwned(nd.id) || treeOwned(id);
      svg += `<line class="${lit ? 'lit' : half ? 'half' : ''}" style="--dc:${T.dirs[nd.dir].col}" x1="${nd.x.toFixed(1)}" y1="${nd.y.toFixed(1)}" x2="${o.x.toFixed(1)}" y2="${o.y.toFixed(1)}"/>`;
    }
    // 根どうしをつなぐ中心

    for (const nd of nodes) {
      const st = treeOwned(nd.id) ? 'own' : treeOpen(nd) ? (META.gold >= treeCost(nd) ? 'open' : 'poor') : 'lock';
      const r = nd.big ? (nd.mid ? 13 : 15) : 10.5; // 本線の間の特別なノードは少し小さく(隣と重ならないように)
      // 行き止まり(貴重なステータス)はひし形
      const sh = nd.leaf ? `<rect class="sh" x="-9" y="-9" width="18" height="18" transform="rotate(45)"/>` : `<circle class="sh" r="${r}"/>`;
      svg += `<g class="nd ${st} ${nd.big ? 'big' : ''} ${nd.leaf ? 'leaf' : ''} ${trSel === nd.id ? 'sel' : ''}" data-id="${nd.id}" style="--dc:${T.dirs[nd.dir].col}" transform="translate(${nd.x.toFixed(1)} ${nd.y.toFixed(1)})">
        ${sh}<text y="${nd.big ? 5.5 : 4.5}">${T.glyph[nd.k]}</text></g>`;
    }
    $('tr-svg').innerHTML = svg;
    treeInfo();
    // 合計(ツリーから得ているステータス)
    const tc = treeCounts(), total = Object.values(TREE).length;
    $('tr-sum').innerHTML = `<div class="tr-h">取得 ${META.tree.length} / ${total}</div>` + (Object.keys(tc).length
      ? Object.keys(tc).map(k => `<div class="tr-s"><span>${DATA.stats[k].label}</span><b>${optVal({ k, v: DATA.stats[k].kind === 'red' ? 1 - Math.pow(1 - treeNodeValue(k), tc[k]) : treeNodeValue(k) * tc[k] })}</b></div>`).join('')
      : '<div class="dim">まだ何も取得していません</div>');
  }
  function treeInfo() {
    const box = $('tr-info'), nd = trSel && TREE[trSel];
    if (!nd) { box.innerHTML = '<div class="dim">ノードを選ぶと詳細が表示されます。中心に近いノードから、取得済みのノードの隣へ広げていきます</div>'; return; }
    const D = DATA.tree.dirs[nd.dir], own = treeOwned(nd.id), open = treeOpen(nd), cost = treeCost(nd);
    box.innerHTML = `<div class="tr-nm" style="color:${D.col}">${DATA.tree.glyph[nd.k]} ${nodeName(nd)}</div>
      <div class="dim">${D.name} ・ 深さ ${nd.depth}${nd.big ? ' ・ 特別なノード' : nd.leaf ? ' ・ 行き止まり' : ''}</div>
      <button class="btn tr-buy" ${!own && open && META.gold >= cost ? '' : 'disabled'}>${own ? '取得済み' : !open ? '隣のノードを先に取得' : `取得 ● ${cost.toLocaleString()}`}</button>`;
  }
  $('tr-svg').onclick = e => {
    const g = e.target.closest('.nd'); if (!g) return;
    trSel = g.dataset.id; AudioMan.click(); renderTree();
  };
  // 取得済みでないノードをダブルクリックでも取得できる
  $('tr-svg').ondblclick = e => { const g = e.target.closest('.nd'); if (g && treeBuy(g.dataset.id)) { AudioMan.levelup(); renderTree(); } };
  $('tr-info').onclick = e => {
    if (!e.target.closest('.tr-buy') || !trSel) return;
    if (treeBuy(trSel)) { AudioMan.levelup(); UI.announce('強化!', nodeName(TREE[trSel])); renderTree(); }
  };
  $('tr-back').onclick = () => { AudioMan.click(); state = 'title'; UI.title(); };
  $('btn-tree').onclick = () => { AudioMan.click(); treeScreen(); };

  // ---------- ショップ ----------
  function shopScreen() {
    state = 'shop';
    UI.only('shop-screen');
    renderShop();
  }
  function renderShop() {
    $('sh-gold').textContent = '● ' + META.gold.toLocaleString() + ' G';
    const sh = shopStock(), full = META.inventory.length >= DATA.equip.invMax;
    $('sh-list').innerHTML = sh.items.map(it => {
      const R = DATA.equip.rarity[it.rarity], sold = sh.sold.includes(it.id), p = shopPrice(it);
      return `<div class="sh-item ${sold ? 'sold' : ''}" style="--rc:${R.col}">
        <div class="eq-head">${icon(it, 'big')}<div><div class="rar">${R.name} ・ ${DATA.equip.slots[itemSlot(it)]}</div><div class="nm">${itemName(it)}</div></div></div>
        <div class="eq-opts">${it.opts.map(o => `<div class="eq-opt"><span>${optHTML(o)}</span><em>〜Lv${o.max}</em>${qualHTML(o.q)}</div>`).join('')}</div>
        ${it.uq ? `<div class="eq-uq">★ ${DATA.uniques[it.uq].desc}</div>` : ''}
        <button class="btn sh-buy" data-id="${it.id}" ${!sold && !full && META.gold >= p ? '' : 'disabled'}>${sold ? '売り切れ' : full ? 'インベントリが一杯' : `購入 ● ${p.toLocaleString()}`}</button>
      </div>`;
    }).join('');
  }
  $('sh-list').onclick = e => {
    const b = e.target.closest('.sh-buy'); if (!b || b.disabled) return;
    if (shopBuy(+b.dataset.id)) { AudioMan.coin(); UI.announce('購入しました', '装備画面で装備できます'); renderShop(); }
  };
  $('sh-back').onclick = () => { AudioMan.click(); state = 'title'; UI.title(); };
  $('btn-shop').onclick = () => { AudioMan.click(); shopScreen(); };

  // ---------- ステージ選択 ----------
  // 通常モード(3ステージを周回) / ステージ単体(ボス2体) / 闘技場(ボスラッシュ)。クリアしたものに ★、カオス強化はクリアで解放
  const STAGE_ITEMS = () => [
    { key: 'normal', mode: 'normal', n: 1, name: '通常モード', sub: '3つのステージを進み、最終ボスを倒す', col: '#ffd23f' },
    ...DATA.stageRuns.map((R, i) => ({ key: 'stage' + (i + 1), mode: 'stage', n: i + 1, name: DATA.stages[R.stage - 1].label, sub: `ボス2体でクリア ・ 敵Lv ${R.elv} から ・ ${R.bosses.map(b => DATA.bosses[b].name.split(' ')[0]).join(' → ')}`, col: '#9ff7ff' })),
    { key: 'arena', mode: 'arena', n: 1, name: '闘技場', sub: `ボス${DATA.arena.order.length}体の連戦`, col: '#ff3b5c' },
  ];
  function stageSelect() {
    state = 'stage';
    UI.only('stage-screen');
    const c = DATA.classes[META.cls], m = META.classes[META.cls];
    $('st-class').style.setProperty('--cc', c.col);
    $('st-class').innerHTML = `<img src="${portrait(META.cls)}" alt=""><span><b>${c.name}</b> Lv${m.lv} ・ ${DATA.weapons[m.weapon].name}</span><small>クラス変更 ▶</small>`;
    $('stage-list').innerHTML = STAGE_ITEMS().map(s => {
      const clear = META.stageClear[s.key];
      return `<button class="stg" data-mode="${s.mode}" data-n="${s.n}" style="--sc:${s.col}">
        <span class="nm">${s.name}${clear ? ' <b class="clr">★ CLEAR</b>' : ''}</span><span class="sub">${s.sub}</span>
        <span class="chaos ${clear ? 'on' : ''}">${clear ? 'カオス強化: 解放済み(内容は今後追加)' : 'カオス強化: クリアで解放'}</span></button>`;
    }).join('');
  }
  $('stage-list').onclick = e => { const b = e.target.closest('.stg'); if (!b) return; AudioMan.click(); startRun(b.dataset.mode, +b.dataset.n); };
  $('st-class').onclick = () => { AudioMan.click(); classScreen('stage'); };
  $('st-back').onclick = () => { AudioMan.click(); state = 'title'; UI.title(); };

  // ---------- 入力 ----------
  $('btn-equip').onclick = () => { AudioMan.click(); open(); };
  $('eq-back').onclick = () => { AudioMan.click(); close(); };
  $('eq-tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; filter = b.dataset.f; AudioMan.click(); render(); };
  const pickItem = e => {
    const b = e.target.closest('[data-id]'); if (!b || !b.dataset.id) return;
    sel = itemById(+b.dataset.id);
    if (sel.isNew) { sel.isNew = false; saveMeta(); } // 見たら NEW を消す
    AudioMan.click(); render();
  };
  $('eq-list').onclick = pickItem;
  $('eq-slots').onclick = pickItem;
  $('eq-detail').onclick = e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) act(b.dataset.act); };
  // 一括売却は2回押しで確定(誤操作防止)
  $('eq-sellall').onclick = () => {
    const b = $('eq-sellall');
    if (!sellArm) { b.textContent = '本当に売却? もう一度押す'; b.classList.add('warn'); sellArm = setTimeout(() => { sellArm = null; b.classList.remove('warn'); render(); }, 3000); return; }
    clearTimeout(sellArm); sellArm = null; b.classList.remove('warn');
    const [n, g] = sellAllUnlocked();
    if (n) { AudioMan.coinRain(10); UI.announce(`+${g.toLocaleString()} G`, `${n}個 売却しました`); }
    sel = null; render();
  };
  function onKey(e) {
    if (state === 'equip' && e.code === 'Escape') close();
    if (state === 'stage' && e.code === 'Escape') { state = 'title'; UI.title(); }
    if (state === 'class' && e.code === 'Escape') closeClass();
    if (state === 'tree' && e.code === 'Escape') { state = 'title'; UI.title(); }
    if (state === 'shop' && e.code === 'Escape') { state = 'title'; UI.title(); }
  }

  return { open, stageSelect, classScreen, treeScreen, shopScreen, onKey };
})();
