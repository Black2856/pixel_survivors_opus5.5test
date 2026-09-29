// status-ui.js — ステータス画面(設計書 8.1)
// ラン中: Tab / ポーズ画面から開く(開いている間は一時停止)。ラン外: クラス画面・装備画面にパネルとして常に表示
// ラン外の値は、装備オプションが最大Lv まで育ったときのもの(開始時の Lv0 は表示しない)
// 4タブ: ステータス(最終値と出どころごとの内訳)/ スキル(実際の CD と威力)/ 装備(オプションの Lv と値)/ ビルド(ラン中のみ)
'use strict';

const StatusUI = (() => {
  const $ = UI.$;
  const GROUPS = { life: '生命', skill: '技巧', balance: '天秤', special: '特殊' };
  const TABS = { stat: 'ステータス', skill: 'スキル', equip: '装備', build: 'ビルド' };
  let tab = 'stat', back = 'play';

  // ---------- 表示用の値 ----------
  // 倍率(固有効果の ×0.9 など)も含めた実際の効果量。flat = 値 / pct = +x% / red = -x%
  function eff(st, k) {
    const v = st.v[k] || 0, m = st.mul[k] || 1, kind = DATA.stats[k].kind;
    return kind === 'flat' ? v * m : kind === 'pct' ? (1 + v) * m - 1 : 1 - (1 - v) * m;
  }
  function fmt(k, x) {
    const d = DATA.stats[k];
    if (d.kind === 'flat') return (Math.abs(x) >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + (d.unit || ''); // 最大HP などは実際の値と同じく整数
    const p = Math.round(x * 1000) / 10;
    return (d.kind === 'red' ? (p ? '-' : '') : p > 0 ? '+' : '') + p + '%';
  }
  const num = x => (Math.round(x * 10) / 10).toLocaleString();

  // ラン中なら P から、ラン外なら META から、スキル計算に使う値を集める
  function ctx(run, cls = META.cls) {
    if (run) return { run, cls: P.cls, mainW: P.mainW, st: P.stats, wm: P.wm[P.mainW] || {}, lvFx: P.lvFx, cuV, hasSp, wlv: P.weapons[P.mainW], atkMul: dmgMul(), cdMul: P.cdMul, atkSpd: P.atkSpd };
    const st = computeStats({ cls, eq: 'max' }), mainW = META.classes[cls].weapon;
    return { run, cls, mainW, st, wm: weaponMastery(mainW), lvFx: classLvFx(cls), cuV: (c, p, d = 0) => d, hasSp: () => false,
      wlv: { lv: 1, evo: false }, atkMul: (1 + st.v.atk) * st.mul.atk, cdMul: (1 - st.v.cd) * st.mul.cd, atkSpd: 1 };
  }

  // ---------- 各タブ ----------
  function head(c) {
    const C = DATA.classes[c.cls], W = DATA.weapons[c.mainW];
    let h = `<div class="sv-head" style="--cc:${C.col}"><b>${C.name}</b> Lv${classLvOf(c.cls)} ・ ${c.wlv.evo ? W.evo.name : W.name}${c.run ? (c.wlv.evo ? ' EVO' : ' Lv' + c.wlv.lv) : ''}`;
    if (c.run) { const r = clsRes(); h += `<span class="dim"> ・ プレイヤー Lv${P.level}${r ? ` ・ ${r.label} ${Math.floor(r.v)} / ${r.max}` : ''}</span>`; }
    return h + '</div>';
  }
  function statTab(c) {
    let h = c.run ? '' : '<div class="sv-note">装備は最大Lv まで育ったときの値</div>';
    for (const g in GROUPS) {
      const ks = Object.keys(DATA.stats).filter(k => DATA.stats[k].group === g && (g !== 'special' || c.st.v[k]));
      if (!ks.length) continue;
      h += `<div class="sv-g">${GROUPS[g]}</div>`;
      for (const k of ks) {
        const a = eff(c.st, k);
        h += `<div class="sv-row" data-k="${k}"><span>${DATA.stats[k].label}</span><b class="${a ? '' : 'z'}">${fmt(k, a)}</b></div>`;
      }
    }
    return h;
  }
  // 内訳: 出どころごとの値
  function breakdown(c, k) {
    const rows = STAT_SRC.filter(s => c.st.by[k][s]).map(s => `<div class="sv-row"><span>${STAT_SRC_LABEL[s]}</span><b>${fmt(k, c.st.by[k][s])}</b></div>`);
    if ((c.st.mul[k] || 1) !== 1) rows.push(`<div class="sv-row"><span>固有効果の倍率</span><b>×${num(c.st.mul[k])}</b></div>`);
    return `<div class="sv-g">${DATA.stats[k].label} の内訳</div>` + (rows.join('') || '<div class="dim">なし</div>');
  }
  function skillTab(c) {
    const W = DATA.weapons[c.mainW], ws = c.wlv.evo ? W.evo.st : W.lv[c.wlv.lv - 1], m = c.wm;
    const dmg = ws.dmg * (1 + (m.dmg || 0)), itv = ws.cd * (1 - (m.cd || 0)) * c.cdMul / c.atkSpd;
    const blocks = [{ key: '通常攻撃', name: c.wlv.evo ? W.evo.name : W.name, desc: c.wlv.evo ? [W.evo.desc] : [W.desc, `進化: ${W.evo.name}`, `  → ${W.evo.desc}`], rows: [
      ['威力', `${num(dmg)} → <b>${num(dmg * c.atkMul)}</b>`, '攻撃力を掛けた値'],
      ['攻撃間隔', `<b>${num(itv)}</b> 秒`, 'クールダウン・攻撃速度を適用'],
      ['攻撃回数', `${(ws.count || 1) + (c.st.v.shots || 0)}`],
    ] }];
    if (WEAPON_SKILL[c.mainW] && WEAPON_SKILL[c.mainW].info) blocks.push(Object.assign({ key: 'E' }, WEAPON_SKILL[c.mainW].info(c, dmg)));
    const rt = CLASS_RT[c.cls];
    if (rt && rt.info) blocks.push(...rt.info(c));
    skBlocks = blocks;
    return '<div class="sv-note">スキルをクリックすると詳細を表示します</div>' + blocks.map((b, i) => `<div class="sv-sk" data-sk="${i}"><div class="sv-g">${b.key} ${b.name} <small>ⓘ</small></div>` + b.rows.map(r => `<div class="sv-row"><span>${r[0]}</span><i>${r[1]}</i></div>${r[2] ? `<div class="sv-note">${r[2]}</div>` : ''}`).join('') + '</div>').join('');
  }
  // スキルの詳細: 説明 + ラン中に取った強化(パスの Lv と特殊強化)
  let skBlocks = [];
  function skillDetail(c, b) {
    let h = `<div class="sv-g">${b.key} ${b.name}</div><ul class="sv-desc">${[].concat(b.desc || []).map(l => l.startsWith('  ') ? `<li class="sub">${l.trim()}</li>` : `<li>${l}</li>`).join('')}</ul>`;
    if (!b.cat) return h;
    const T = b.cat === 'e' ? DATA.weapons[c.mainW].skill && DATA.weapons[c.mainW].skill.tree : DATA.classes[c.cls].tree[b.cat];
    if (!T) return h;
    const got = c.run ? Object.keys(T.paths).filter(p => cuLv(b.cat, p)) : [];
    h += '<div class="sv-g">強化' + (c.run ? '' : '(ラン中に3の倍数のLv で選ぶ)') + '</div>';
    h += Object.keys(T.paths).map(p => {
      const d = T.paths[p], lv = c.run ? cuLv(b.cat, p) : 0;
      return `<div class="sv-row ${lv ? '' : 'z'}"><span>${d.name} ${lv ? 'Lv' + lv : ''}</span><i>${lv ? d.desc[lv - 1] : d.desc[0] + ' …'}</i></div>`;
    }).join('');
    const sp = c.run && P.cs[b.cat];
    h += sp ? `<div class="sv-note sp">★ ${T.paths[sp].sp.name}: ${T.paths[sp].sp.desc}</div>` : '';
    return h;
  }
  function equipTab(c) {
    let h = '';
    for (const slot in DATA.equip.slots) {
      const it = itemById(META.loadout[slot]);
      h += `<div class="sv-g">${DATA.equip.slots[slot]}</div>`;
      if (!it) { h += '<div class="dim sv-note">なし</div>'; continue; }
      h += `<div class="sv-it" style="color:${DATA.equip.rarity[it.rarity].col}">${itemName(it)}${it.enh ? ' +' + it.enh : ''}</div>`;
      it.opts.forEach((o, i) => {
        const red = DATA.stats[o.k].kind === 'red', val = n => (red ? 1 - Math.pow(1 - o.v, n) : o.v * n);
        // ラン中は「現在Lv の値 / 最大時」、ラン外は最大時だけ
        if (c.run) { const lv = S.eqLv[slot] ? S.eqLv[slot][i] : 0; h += `<div class="sv-row sv-op"><span>${DATA.stats[o.k].label}</span><em>Lv ${lv} / ${o.max}</em><b>${fmt(o.k, val(lv))}</b><b class="mx">${fmt(o.k, val(o.max))}</b></div>`; }
        else h += `<div class="sv-row sv-op1"><span>${DATA.stats[o.k].label}</span><em>最大Lv ${o.max}</em><b>${fmt(o.k, val(o.max))}</b></div>`;
      });
      if (it.uq) h += `<div class="sv-uq">★ ${DATA.uniques[it.uq].desc}</div>`;
    }
    return h;
  }
  function buildTab() {
    const tree = Object.assign({}, DATA.classes[P.cls].tree);
    if (weaponSkill()) tree.e = weaponSkill().tree;
    let h = '<div class="sv-g">クラス強化</div>', any = false;
    for (const cat in tree) {
      const ps = Object.keys(tree[cat].paths).filter(p => cuLv(cat, p));
      if (!ps.length) continue;
      any = true;
      h += `<div class="sv-row"><span>${tree[cat].name}</span><i>${ps.map(p => `${tree[cat].paths[p].name} ${cuLv(cat, p)}`).join(' ・ ')}</i></div>`;
      if (P.cs[cat]) h += `<div class="sv-note sp">特殊強化: ${tree[cat].paths[P.cs[cat]].sp.name}</div>`;
    }
    if (!any) h += '<div class="dim sv-note">まだありません</div>';
    h += '<div class="sv-g">武器</div>' + Object.keys(P.weapons).map(k => {
      const w = P.weapons[k], d = DATA.weapons[k];
      return `<div class="sv-row"><span>${w.evo ? d.evo.name : d.name}${k === P.mainW ? ' (メイン)' : ''}</span><b>${w.evo ? 'EVO' : 'Lv ' + w.lv}</b></div>`;
    }).join('');
    const mk = Object.keys(P.micro);
    h += '<div class="sv-g">微強化の累計</div>' + (mk.length ? mk.map(k => `<div class="sv-row"><span>${k === 'hpPct' ? '最大HP' : DATA.stats[k].label}</span><b>${k === 'hpPct' ? '×' + num(1 + P.micro[k]) : fmt(k, P.micro[k])}</b></div>`).join('') : '<div class="dim sv-note">まだありません</div>');
    return h;
  }

  // ---------- 描画 ----------
  // el にパネルを描く。run: ラン中か / cls: ラン外で表示するクラス
  function render(el, run, cls) {
    const c = ctx(run, cls);
    if (!run && tab === 'build') tab = 'stat';
    const tabs = Object.keys(TABS).filter(t => run || t !== 'build');
    const body = tab === 'stat' ? statTab(c) : tab === 'skill' ? skillTab(c) : tab === 'equip' ? equipTab(c) : buildTab();
    el.innerHTML = head(c) + `<div class="seg sv-tabs">${tabs.map(t => `<button data-t="${t}" class="${t === tab ? 'on' : ''}">${TABS[t]}</button>`).join('')}</div>`
      + `<div class="sv-body">${body}</div>`
      + (tab === 'stat' ? '<div class="sv-break"><div class="dim">行にマウスを乗せると内訳を表示します</div></div>' : '');
    el.onclick = e => {
      const b = e.target.closest('[data-t]'), s = e.target.closest('.sv-sk');
      if (b) { tab = b.dataset.t; AudioMan.click(); render(el, run, cls); }
      else if (s) { AudioMan.click(); openModal(skillDetail(c, skBlocks[+s.dataset.sk])); } // スキルの詳細はモーダルで
    };
    el.onmouseover = e => {
      const r = e.target.closest('.sv-row[data-k]');
      if (r) el.querySelector('.sv-break').innerHTML = breakdown(c, r.dataset.k);
    };
  }

  // ---------- 詳細のモーダル(× / 外側のクリック / Esc で閉じる) ----------
  const modal = document.createElement('div');
  modal.id = 'sv-modal'; modal.className = 'hidden';
  modal.innerHTML = '<div class="svm"><button class="svm-x">×</button><div class="svm-body"></div></div>';
  document.body.appendChild(modal);
  function openModal(html) { modal.querySelector('.svm-body').innerHTML = html; modal.classList.remove('hidden'); }
  function closeModal() { modal.classList.add('hidden'); }
  const modalOpen = () => !modal.classList.contains('hidden');
  modal.onclick = e => { if (e.target === modal || e.target.closest('.svm-x')) { AudioMan.click(); closeModal(); } };

  // ---------- ラン中の画面 ----------
  function open() {
    if (state !== 'play' && state !== 'pause') return;
    back = state; state = 'status';
    if (back === 'play') AudioMan.pauseMusic();
    UI.only('status-screen');
    render($('status-panel'), true);
  }
  function close() {
    closeModal();
    state = back;
    if (back === 'pause') UI.pause(true); else { UI.only(null); AudioMan.resumeMusic(); }
  }
  $('st-close').onclick = () => { AudioMan.click(); close(); };
  $('btn-status').onclick = () => { AudioMan.click(); open(); };
  function onKey(e) {
    if (e.code !== 'Tab' && !(e.code === 'Escape' && state === 'status')) return;
    if (e.preventDefault) e.preventDefault();
    if (state === 'status') close(); else if (e.code === 'Tab') open();
  }
  return { render, open, close, onKey, modalOpen, closeModal };
})();
