// meta-ui.js — ラン外の画面(ステージ選択 / クラス / 強化ツリー / ショップ / 装備)
'use strict';

const MetaUI = (() => {
  const $ = UI.$;
  let filter = 'all', sel = null, sellArm = null;

  // ロール品質の表示: 範囲の最小 = 0%、最大 = 100%(強化の上限)。数値の背景に薄いゲージ(--q)。100% は金色
  const qualHTML = q => {
    const p = Math.round(q * 100);
    return `<b class="${p >= 100 ? 'over' : ''}" style="--q:${Math.min(100, Math.max(0, p))}%">${p >= 100 ? 'MAX' : p + '%'}</b>`;
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
    const sel = document.querySelector('.cl-card.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' }); // 開いたときは選択中のクラスが見えるように
  }
  function renderClass() {
    const st = $('cl-list').scrollTop; // 描き直してもスクロール位置を保つ
    $('cl-list').innerHTML = Object.keys(DATA.classes).map(k => {
      const c = DATA.classes[k], m = META.classes[k];
      if (!clsUnlocked(k)) return `<button class="cl-card ${clSel === k ? 'sel' : ''} locked" data-k="${k}"><span class="en">???</span><img src="${portrait(k)}" alt=""><span class="nm">？？？</span><span class="lv">🔒</span></button>`; // 未解放: 名前・色を伏せたシルエット
      return `<button class="cl-card ${clSel === k ? 'sel' : ''} ${clsReady(k) ? '' : 'off'}" data-k="${k}" style="--cc:${c.col}">
        <span class="en">${c.en}</span><img src="${portrait(k)}" alt=""><span class="nm">${c.name}</span>
        <span class="lv">${clsReady(k) ? 'Lv ' + m.lv : '準備中'}</span>${META.cls === k ? '<span class="use">使用中</span>' : ''}</button>`;
    }).join('');
    $('cl-list').scrollTop = st;
    if (!clsUnlocked(clSel)) { // 未解放: 何も明かさない
      $('cl-detail').innerHTML = `<div class="cl-head"><span class="nm">？？？</span></div>
        <div class="cl-lock">🔒 まだ解放されていないクラス</div>
        <div class="dim cl-note">モード・ステージを初めてクリアすると、新しいクラスが解放されることがある</div>
        <button class="btn cl-go" disabled>🔒 未解放</button>`;
      $('cl-status').innerHTML = '<div class="dim sv-note">？？？</div>';
      return;
    }
    const k = clSel, c = DATA.classes[k], m = META.classes[k], need = DATA.classLevel.need, max = need.length + 1;
    const xpP = m.lv >= max ? 100 : m.xp / need[m.lv - 1] * 100;
    const rows = classLvTable(k).map(r => `<div class="cl-row ${m.lv >= r.lv ? 'got' : ''} ${m.lv + 1 === r.lv ? 'next' : ''}">
      <b>Lv${r.lv}</b><span class="tag ${r.kind === '共通' ? 'wp' : ''}">${r.kind}</span><span>${r.d}</span><em>${m.lv >= r.lv ? '✔' : need[r.lv - 2].toLocaleString()}</em></div>`).join('');
    const swap = canSwap(k), cw = m.weapon || c.weapon || c.startW;
    const note = c.weapon ? `<span class="tag">専用</span>このクラスだけ <span class="tag wp">共通</span>${DATA.weapons[c.weapon].name}を使うどのクラスにも効く`
      : '<span class="tag">専用</span>このクラスだけ(専用の武器がないので全て専用。武器の熟練は、その武器を専用にしているクラスの Lv で決まる)';
    $('cl-detail').innerHTML = `
      <div class="cl-head" style="--cc:${c.col}"><span class="nm">${c.name}</span><span class="lv">Lv ${m.lv}${m.lv >= max ? ' MAX' : ''}</span></div>
      <div class="cl-xp"><i style="width:${xpP.toFixed(1)}%"></i><span>${m.lv >= max ? 'MAX' : `${m.xp.toLocaleString()} / ${need[m.lv - 1].toLocaleString()} EXP`}</span></div>
      <div class="dim cl-note">${note}</div>
      <div class="cl-rows">${rows}</div>
      <div class="cl-sub">メイン武器 ${swap ? '' : '<span class="dim">(Lv15 で切り替え解放)</span>'}</div>
      <button class="cl-wsel">${UI.weaponIcon(cw)}<span>${DATA.weapons[cw].name}${cw === c.weapon ? '<small>専用</small>' : ''}</span><em>${swap ? '変更 ▸' : '一覧 ▸'}</em></button>
      <button class="btn cl-go" ${clsReady(k) ? '' : 'disabled'}>${META.cls === k ? '使用中' : 'このクラスにする'}</button>`;
    Help.glossify($('cl-detail'), { cls: k, per: '.cl-row, .cl-note' });
    statusPanel('cl-status', k);
  }
  // MetaUI は StatusUI より先に読み込まれるので、実行時に参照する
  const statusPanel = (id, cls) => { if (typeof StatusUI !== 'undefined') StatusUI.render($(id), false, cls); };
  $('cl-list').onclick = e => { const b = e.target.closest('.cl-card'); if (!b) return; clSel = b.dataset.k; AudioMan.click(); renderClass(); };
  // メイン武器の切り替え(モーダル)。Lv15 まではクラス専用の武器だけ選べる(一覧は見られる)。専用武器がないクラスは Lv1 から選べる
  const canSwap = k => !DATA.classes[k].weapon || !!classLvFx(k).swap;
  const wpModal = document.createElement('div');
  wpModal.id = 'wp-modal'; wpModal.className = 'hidden';
  wpModal.innerHTML = '<div class="svm"><button class="svm-x">×</button><div class="svm-body"></div></div>';
  document.body.appendChild(wpModal);
  const wpOpen = () => !wpModal.classList.contains('hidden');
  const closeWp = () => wpModal.classList.add('hidden');
  function openWp() {
    const k = clSel, c = DATA.classes[k], m = META.classes[k], swap = canSwap(k), cw = m.weapon || c.weapon || c.startW;
    const weps = [...new Set(Object.values(DATA.classes).map(x => x.weapon).filter(Boolean))];
    const owner = w => Object.values(DATA.classes).find(x => x.weapon === w), ownerName = w => clsNameShown(weaponOwner(w)); // 未解放のクラスの名前は伏せる
    wpModal.querySelector('.svm-body').innerHTML = `<div class="wp-h">メイン武器を選ぶ <span class="dim">— ${c.name}</span></div>
      ${swap ? '' : '<div class="dim wp-note">Lv15 で切り替えが解放されます(今はクラス専用の武器だけ)</div>'}
      <div class="wp-list">${weps.map(w => {
        const d = DATA.weapons[w], o = owner(w), ok = swap || w === c.weapon;
        return `<button class="wp-card ${cw === w ? 'on' : ''}" data-w="${w}" ${ok ? '' : 'disabled'} style="--cc:${o ? o.col : '#fff'}">
          ${UI.weaponIcon(w)}<div class="wp-b"><div class="wp-nm">${d.name}${w === c.weapon ? '<small>専用</small>' : ''}${cw === w ? '<small class="use">使用中</small>' : ''}</div>
          <div class="dim">${d.desc}</div>
          <div class="wp-e">${d.skill ? `E: ${d.skill.name}` : '<span class="dim">E なし</span>'}${o ? `<span class="dim"> ・ ${ownerName(w)}の武器(熟練は${ownerName(w)}の Lv)</span>` : ''}</div></div></button>`;
      }).join('')}</div>`;
    Help.glossify(wpModal.querySelector('.wp-list'), { per: '.wp-b' });
    wpModal.classList.remove('hidden');
    const on = wpModal.querySelector('.wp-card.on'); if (on) on.scrollIntoView({ block: 'nearest' }); // 使用中の武器が見えるように
  }
  wpModal.onclick = e => {
    if (e.target === wpModal || e.target.closest('.svm-x')) { AudioMan.click(); closeWp(); return; }
    const b = e.target.closest('.wp-card');
    if (b && !b.disabled) { META.classes[clSel].weapon = b.dataset.w; saveMeta(); AudioMan.select(); closeWp(); renderClass(); }
  };
  $('cl-detail').onclick = e => {
    if (e.target.closest('.cl-wsel')) { AudioMan.click(); openWp(); return; }
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
    trView = { s: 1, cx: 0, cy: 0 }; applyTrView();
    renderTree();
  }
  // 拡大・移動: viewBox を動かす(s = 倍率 1〜3、cx / cy = 見ている中心)
  const TR_HALF = 378;
  let trView = { s: 1, cx: 0, cy: 0 }, trDrag = null, trMoved = false;
  function applyTrView() {
    const v = trView, lim = TR_HALF * (1 - 1 / v.s), size = TR_HALF * 2 / v.s;
    v.cx = clamp(v.cx, -lim, lim); v.cy = clamp(v.cy, -lim, lim);
    $('tr-svg').setAttribute('viewBox', `${(v.cx - size / 2).toFixed(1)} ${(v.cy - size / 2).toFixed(1)} ${size.toFixed(1)} ${size.toFixed(1)}`);
  }
  // 画面上の点(ux, uy: 0〜1)を動かさずに倍率を変える
  function zoomTr(k, ux = 0.5, uy = 0.5) {
    const v = trView, size = TR_HALF * 2 / v.s, px = v.cx - size / 2 + ux * size, py = v.cy - size / 2 + uy * size;
    v.s = clamp(v.s * k, 1, 3);
    const ns = TR_HALF * 2 / v.s;
    v.cx = px - ux * ns + ns / 2; v.cy = py - uy * ns + ns / 2;
    applyTrView();
  }
  $('tr-svg').addEventListener('wheel', e => {
    e.preventDefault();
    const b = $('tr-svg').getBoundingClientRect();
    zoomTr(e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
  }, { passive: false });
  $('tr-svg').addEventListener('pointerdown', e => { trDrag = { x: e.clientX, y: e.clientY, cx: trView.cx, cy: trView.cy }; trMoved = false; });
  addEventListener('pointermove', e => {
    if (!trDrag) return;
    const dx = e.clientX - trDrag.x, dy = e.clientY - trDrag.y;
    if (!trMoved && Math.hypot(dx, dy) < 5) return; // 少し動いただけならクリック扱い
    trMoved = true; $('tr-svg').classList.add('drag');
    const k = TR_HALF * 2 / trView.s / $('tr-svg').getBoundingClientRect().width;
    trView.cx = trDrag.cx - dx * k; trView.cy = trDrag.cy - dy * k; applyTrView();
  });
  addEventListener('pointerup', () => { trDrag = null; $('tr-svg').classList.remove('drag'); });
  document.querySelector('.tr-zoom').onclick = e => {
    const z = e.target.closest('button'); if (!z) return;
    AudioMan.click();
    if (z.dataset.z === 'reset') { trView = { s: 1, cx: 0, cy: 0 }; applyTrView(); } else zoomTr(z.dataset.z === 'in' ? 1.3 : 1 / 1.3);
  };
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
    if (trMoved) { trMoved = false; return; } // ドラッグで移動した後はクリックにしない
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
  // 1列で、枠の中をスクロール: エスカレーション / 闘技場 / 通常モードのステージ(ステージを1つ選ぶ。3分 → エリート群 → 3分 → ボス → 3分 → ボス)を tier の順に。帯の色は tier
  // クリアしたものに ★。カオス強化はクリアするまで tier の値で固定(見るだけ)、クリアすると変えられる
  // 解放: 通常モードのステージは tier 1 が最初から、tier N は tier N−1 のステージを1つクリアすると。エスカレーション・闘技場は tier 4 のステージをクリアすると
  const TIER_COL = ['#9ff7ff', '#7dff9a', '#ff8a3d', '#c78bff'];
  const startLvOf = key => { const m = chaosMods(key).find(x => x.k === 'startLv'); return (key === 'arena' ? DATA.arena.elv[0] : 1) + chaosLv(chaosSetting(key), m) * m.per; }; // 開始の敵Lv(闘技場は1ラウンド目の敵Lv)+ 深い闇
  const STAGE_ITEMS = () => [
    { key: 'escalation', mode: 'escalation', n: 1, name: 'エスカレーション', sub: `tier 1 → 4 を通す ・ 敵Lv ${startLvOf('escalation')} から`, col: '#ffd23f' },
    { key: 'arena', mode: 'arena', n: 1, name: '闘技場', sub: `ボス${DATA.arena.order.length}体の連戦 ・ 敵Lv ${startLvOf('arena')} から`, col: '#ff3b5c' },
    ...DATA.stageRuns.map(R => ({ key: 'stage' + R.no, mode: 'stage', n: R.no, tier: R.tier, name: DATA.stages[R.stage - 1].label,
      sub: `tier ${R.tier} ・ 敵Lv ${startLvOf('stage' + R.no)} から ・ ${R.bosses.map(b => DATA.bosses[b].name.split(' ')[0]).join(' → ')}`, col: TIER_COL[R.tier - 1] }))
      .sort((a, b) => a.tier - b.tier), // 通常モード: tier の順
  ];
  function stageSelect() {
    state = 'stage';
    UI.only('stage-screen');
    const c = DATA.classes[META.cls], m = META.classes[META.cls];
    $('st-class').style.setProperty('--cc', c.col);
    $('st-class').innerHTML = `<img src="${portrait(META.cls)}" alt=""><span><b>${c.name}</b> Lv${m.lv} ・ ${DATA.weapons[m.weapon].name}</span><small>クラス変更 ▶</small>`;
    const items = STAGE_ITEMS();
    $('stage-list').innerHTML = items.map(s => {
      const clear = META.stageClear[s.key], open = stageUnlocked(s);
      const pt = open ? chaosPoints(chaosSetting(s.key), s.key) : 0;
      const right = !open ? `<span class="lock">未解放: tier ${needTier(s)} のステージを1つクリア</span>`
        : clear ? `<span class="chaos on">カオス強化 <b>${pt} pt</b> <span class="cz-btn" data-chaos="${s.key}">設定 ▶</span></span>`
        : `<span class="chaos">カオス強化 ${pt ? `<b>${pt} pt</b>` : 'なし'}(クリアまで固定)<span class="cz-btn" data-chaos="${s.key}">見る ▶</span></span>`;
      return `<button class="stg${open ? '' : ' locked'}" data-mode="${s.mode}" data-n="${s.n}" style="--sc:${s.col}">
        <span class="nm">${s.name}${clear ? ' <b class="clr">★ CLEAR</b>' : ''}</span>${right}<span class="sub">${s.sub}</span></button>`;
    }).join('');
  }
  // 解放に必要な tier(そのクリアが要る。0 = 最初から): 通常モードは tier − 1、エスカレーション・闘技場は tier 4
  const tierCleared = t => DATA.stageRuns.some(R => R.tier === t && META.stageClear['stage' + R.no]);
  const needTier = s => (s.mode === 'stage' ? s.tier - 1 : 4);
  const stageUnlocked = s => needTier(s) < 1 || tierCleared(needTier(s));
  $('stage-list').onclick = e => {
    const c = e.target.closest('[data-chaos]');
    if (c) { AudioMan.click(); chaosPanel(c.dataset.chaos); return; } // カオス強化の設定(出撃はしない)
    const b = e.target.closest('.stg'); if (!b) return;
    if (b.classList.contains('locked')) { AudioMan.hurt(); b.classList.remove('deny'); void b.offsetWidth; b.classList.add('deny'); return; } // 未解放: 小さく揺れるだけ
    AudioMan.click(); startRun(b.dataset.mode, +b.dataset.n);
  };
  // ---------- カオス強化の設定 ----------
  // 項目ごとに Lv を上げ下げ。合計ポイントと、その報酬(そのランの間だけ効く)を表示する。クリアするまでは tier の値で固定(見るだけ)
  let czKey = null;
  // 報酬の一覧(右の欄に1行ずつ。今の報酬と次の報酬を横に並べる)
  const REWARD_ROWS = [['装備ロール上限', r => `+${Math.round(r.eqMaxVal * 100)}%`], ['装備Lv上限', r => (r.eqMaxLv ? `+${r.eqMaxLv}` : '—')], ['装備品質', r => `+${Math.round(r.eqQual * 100)}%`], ['宝箱品質', r => `+${Math.round(r.chestQual * 100)}%`], ['獲得ゴールド', r => `+${Math.round(r.gold * 100)}%`]];
  const rewardRows = (r, nx) => REWARD_ROWS.map(([a, f]) => `<div class="cz-rw"><span>${a}</span><b>${r ? f(r) : '—'}</b><i>${nx ? f(nx) : ''}</i></div>`).join('');
  function chaosPanel(key) {
    czKey = key; const lv = chaosSetting(key), fixed = chaosFixed(key);
    const pt = chaosPoints(lv, key), r = chaosReward(pt), next = DATA.chaos.rewards.find(x => x.pt > pt);
    const item = STAGE_ITEMS().find(s => s.key === key);
    $('chaos-panel').innerHTML = `<div class="cz">
      <div class="cz-head"><b>カオス強化</b> ${item ? item.name : ''}${fixed ? '<span class="cz-fix">クリアするまで固定(見るだけ)</span>' : ''}<button class="cz-x" data-cz="close">×</button></div>
      <div class="cz-body"><div class="cz-list">${chaosMods(key).map(m => { const l = chaosLv(lv, m); return `<div class="cz-row ${l ? 'on' : ''}">
        <span class="nm">${m.name}<small>${chaosDesc(m, Math.max(1, l))}${m.max > 1 ? ` (1Lv ${m.per}${m.unit ?? '%'})` : ''}</small></span>
        <span class="pt">${m.pt} pt/Lv</span>
        <button data-cz="-" data-k="${m.k}" ${l && !fixed ? '' : 'disabled'}>−</button><b>${l} / ${m.max}</b><button data-cz="+" data-k="${m.k}" ${l < m.max && !fixed ? '' : 'disabled'}>+</button></div>`; }).join('')}</div>
      <div class="cz-sum">
        <div class="cz-pt">合計<b>${pt}</b><small>pt</small></div>
        <div class="cz-rw cz-h"><span>報酬</span><b>${r ? `${r.pt} pt` : 'なし'}</b><i>${next ? `次 ${next.pt} pt` : '最大'}</i></div><div class="cz-rws">${rewardRows(r, next)}</div>
        <div class="dim cz-note">${fixed ? (item && item.tier ? `クリアするまで tier ${item.tier} のカオス強化で固定。` : 'クリアするまでカオス強化なし。') + 'クリアすると変えられる。' : ''}報酬はこのモード・ステージのランの間だけ効く。敵が強くなる分、装備とゴールドが増える</div>
      </div></div>
    </div>`;
    Help.glossify($('chaos-panel'), { per: '.cz-row .nm small, .cz-rw, .cz-note' });
    UI.show($('chaos-panel'));
  }
  $('chaos-panel').onclick = e => {
    if (e.target === $('chaos-panel')) { closeChaos(); return; }
    const b = e.target.closest('[data-cz]'); if (!b || b.disabled) return;
    if (b.dataset.cz === 'close') { closeChaos(); return; }
    if (chaosFixed(czKey)) return; // クリアするまでは見るだけ
    const lv = chaosSetting(czKey), m = chaosMods(czKey).find(x => x.k === b.dataset.k);
    lv[m.k] = clamp(chaosLv(lv, m) + (b.dataset.cz === '+' ? 1 : -1), 0, m.max);
    saveMeta(); AudioMan.click(); chaosPanel(czKey);
  };
  function closeChaos() { UI.hide($('chaos-panel')); czKey = null; stageSelect(); }
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
    if (state === 'stage' && e.code === 'Escape') { if (czKey) closeChaos(); else { state = 'title'; UI.title(); } }
    if (state === 'class' && e.code === 'Escape') { if (wpOpen()) closeWp(); else closeClass(); }
    if (state === 'tree' && e.code === 'Escape') { state = 'title'; UI.title(); }
    if (state === 'shop' && e.code === 'Escape') { state = 'title'; UI.title(); }
  }

  return { open, stageSelect, classScreen, treeScreen, shopScreen, onKey };
})();
