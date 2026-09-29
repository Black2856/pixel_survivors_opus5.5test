// meta-ui.js — ラン外の画面(装備)。ステージ選択・クラス画面・ツリー・ショップはフェーズ4で追加する
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
  }

  // 選んだ装備の詳細と操作
  function detail() {
    const box = $('eq-detail'), it = sel;
    if (!it || !META.inventory.includes(it)) { box.innerHTML = '<div class="dim">装備を選ぶと詳細が表示されます</div>'; return; }
    const R = DATA.equip.rarity[it.rarity], eq = isEquipped(it);
    box.innerHTML = `
      <div class="eq-head" style="--rc:${R.col}">${icon(it, 'big')}<div><div class="rar">${R.name} ・ ${DATA.equip.slots[itemSlot(it)]}</div><div class="nm">${itemName(it)}</div></div></div>
      <div class="eq-opts">${it.opts.map(o => `<div class="eq-opt"><span>${optText(o)}</span><em>〜Lv${o.max}</em>${qualHTML(o.q)}</div>`).join('')}</div>
      ${it.uq ? `<div class="eq-uq">★ ${DATA.uniques[it.uq].desc}</div>` : ''}
      <div class="dim eq-note">ラン開始時は全オプション Lv0。レベルアップのたびにどれか1つが +1Lv</div>
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
  function onKey(e) { if (state === 'equip' && e.code === 'Escape') close(); }

  return { open, onKey };
})();
