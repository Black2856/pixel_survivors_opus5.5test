// status-ui.js — ステータス画面(設計書 8.1)
// ラン中: Tab / ポーズ画面から開く(開いている間は一時停止)。ラン外: クラス画面・装備画面にパネルとして常に表示
// ラン外の値は、装備オプションが最大Lv まで育ったときのもの(開始時の Lv0 は表示しない)
// 4タブ: ステータス(最終値と出どころごとの内訳)/ スキル(実際の CD と威力)/ 装備(オプションの Lv と値)/ ビルド(ラン中のみ)
'use strict';

const StatusUI = (() => {
  const $ = UI.$;
  const GROUPS = { life: _t('生命'), skill: _t('技巧'), balance: _t('天秤'), special: _t('特殊') };
  const TABS = { stat: _t('ステータス'), skill: _t('スキル'), equip: _t('装備'), build: _t('ビルド') };
  let tab = 'stat', back = 'play';

  // ---------- 表示用の値 ----------
  // 倍率(固有効果の ×0.9 など)も含めた実際の効果量。flat = 値 / pct = +x% / red = -x%
  function eff(st, k) {
    const v = st.v[k] || 0, m = st.mul[k] || 1, kind = DATA.stats[k].kind;
    return kind === 'flat' || kind === 'flag' ? v * m : kind === 'pct' ? (1 + v) * m - 1 : 1 - (1 - v) * m;
  }
  function fmt(k, x) {
    const d = DATA.stats[k];
    if (d.kind === 'flag') return x > 0 ? _t('あり') : _t('なし');
    if (d.kind === 'flat') return (Math.abs(x) >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + (d.unit || ''); // 最大HP などは実際の値と同じく整数
    const p = Math.round(x * 1000) / 10;
    if (d.kind === 'red') return (p > 0 ? '-' : p < 0 ? '+' : '') + Math.abs(p) + '%'; // 軽減がマイナス(ダメージ軽減 -5% = 受けるダメージ +5%)は + で出す
    return (p > 0 ? '+' : '') + p + '%';
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
    let h = _t`<div class="sv-head" style="--cc:${C.col}"><b>${C.name}</b> Lv${classLvOf(c.cls)} ・ ${c.wlv.evo ? W.evo.name : W.name}${c.run ? (c.wlv.evo ? ' EVO' : ' Lv' + c.wlv.lv) : ''}`;
    if (c.run) { const r = clsRes(); h += _t`<span class="dim"> ・ プレイヤー Lv${P.level}${r ? _t` ・ ${r.label} ${Math.floor(r.v)} / ${r.max}` : ''}</span>`; }
    return h + '</div>';
  }
  function statTab(c) {
    let h = c.run ? '' : _t('<div class="sv-note">装備は最大Lv まで育ったときの値</div>');
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
    const rew = ['gold', 'eqQual', 'chestQual', 'classXp'].includes(k) && c.st.rew ? c.st.rew : 1; // tier の報酬の倍率(クラス経験値は倒したときに掛ける)
    const um = (c.st.mul[k] || 1) / (k === 'classXp' ? 1 : rew);
    if (Math.abs(um - 1) > 1e-9) rows.push(_t`<div class="sv-row"><span>固有効果の倍率</span><b>×${num(um)}</b></div>`);
    if (rew !== 1) rows.push(_t`<div class="sv-row"><span>tier の報酬の倍率</span><b>×${num(rew)}</b></div>`);
    return _t`<div class="sv-g">${DATA.stats[k].label} の内訳</div>` + (rows.join('') || _t('<div class="dim">なし</div>'));
  }
  // スキルの説明のまとまり(通常攻撃 / E / 特性 / パッシブ / Q / 防御スキル)。ガイドの用語の説明にも使う
  function blocksOf(c) {
    const W = DATA.weapons[c.mainW], ws = c.wlv.evo ? W.evo.st : W.lv[c.wlv.lv - 1], m = c.wm;
    const base = ws.cd !== undefined ? ws.cd : ws.tick; // 攻撃間隔(ホーリーオーラは判定の間隔 tick。オービットブレードのように間隔がない武器もある)
    const dmg = ws.dmg * (1 + (m.dmg || 0)), itv = base !== undefined ? base * (1 - (m.cd || 0)) * c.cdMul / c.atkSpd : null;
    const blocks = [{ key: _t('通常攻撃'), name: c.wlv.evo ? W.evo.name : W.name, desc: c.wlv.evo ? [W.evo.desc] : [W.desc, _t`進化: ${W.evo.name}`, `  → ${W.evo.desc}`], rows: [
      [_t('威力'), `${num(dmg)} → <b>${num(dmg * c.atkMul)}</b>`, _t('攻撃力を掛けた値')],
      [_t('攻撃間隔'), itv !== null ? _t`<b>${itv.toFixed(2)}</b> 秒` : _t('— (常に攻撃)'), itv !== null ? _t('クールダウン・攻撃速度を適用') : ''],
      [_t('攻撃回数'), `${(ws.count || 1) + (c.st.v.shots || 0)}`],
    ] }];
    if (ws.rot) blocks[0].rows.push([_t('回転速度'), _t`<b>${(ws.rot / ((1 - (m.cd || 0)) * c.cdMul) * c.atkSpd / TAU).toFixed(2)}</b> 周/秒`, _t('クールダウン・攻撃速度で速くなる')], [_t('刃のサイズ'), `×${ws.size || 1}`], [_t('同じ敵への命中'), _t`${W.hitCd} 秒に1回`, _t('刃の輪ごと')]); // オービットブレード
    if (ws.pierce !== undefined) blocks[0].rows.push([_t('貫通'), `${ws.pierce + (m.pierce || 0)}`, _t('この数 + 1 体まで当たる')]);
    if (ws.size && !ws.rot) blocks[0].rows.push([_t('斧の大きさ'), `×${+(ws.size * (1 + (m.size || 0))).toFixed(2)}`, _t`当たり判定の半径 ${+(5 * ws.size * (1 + (m.size || 0))).toFixed(1)}(熟練の大きさを含む)`]); // スローイングアックス
    if (WEAPON_SKILL[c.mainW] && WEAPON_SKILL[c.mainW].info) blocks.push(Object.assign({ key: 'E' }, WEAPON_SKILL[c.mainW].info(c, dmg)));
    const rt = CLASS_RT[c.cls];
    if (rt && rt.info) blocks.push(...rt.info(c));
    return blocks;
  }
  function skillTab(c) {
    const blocks = skBlocks = blocksOf(c);
    return _t('<div class="sv-note">スキルをクリックすると詳細を表示します</div>') + blocks.map((b, i) => `<div class="sv-sk" data-sk="${i}"><div class="sv-g no-gl">${b.key} ${b.name} <small>ⓘ</small></div>` + b.rows.map(r => `<div class="sv-row"><span>${r[0]}</span><i>${r[1]}</i></div>${r[2] ? `<div class="sv-note">${r[2]}</div>` : ''}`).join('') + '</div>').join('');
  }
  // スキルの詳細: 説明 + ラン中に取った強化(パスの Lv と特殊強化)
  let skBlocks = [];
  function skillDetail(c, b) {
    let h = `<div class="sv-g no-gl">${b.key} ${b.name}</div><ul class="sv-desc">${[].concat(b.desc || []).map(l => l.startsWith('  ') ? `<li class="sub">${l.trim()}</li>` : `<li>${l}</li>`).join('')}</ul>`;
    if (!b.cat) return h;
    const T = b.cat === 'e' ? DATA.weapons[c.mainW].skill && DATA.weapons[c.mainW].skill.tree : DATA.classes[c.cls].tree[b.cat];
    if (!T) return h;
    h += _t('<div class="sv-g">強化') + (c.run ? '' : _t('(ラン中に3の倍数のLv で選ぶ)')) + '</div>';
    h += Object.keys(T.paths).map(p => {
      const d = T.paths[p], lv = c.run ? cuLv(b.cat, p) : 0;
      return `<div class="sv-row ${lv ? '' : 'z'}"><span class="no-gl">${d.name} ${lv ? 'Lv' + lv : ''}</span><i>${lv ? pathDesc(d, lv) : pathDesc(d, 1) + ' …'}</i></div>`;
    }).join('');
    // 特殊強化: 各パスを Lv3 にすると候補に出る(1カテゴリにつき1つ)。取ったものは明るく
    const sp = c.run && P.cs[b.cat];
    h += _t('<div class="sv-g">特殊強化<small class="dim">(パスを Lv3 にすると候補に出る・1つだけ)</small></div>');
    h += Object.keys(T.paths).map(p => {
      const d = T.paths[p].sp, on = sp === p;
      return `<div class="sv-sp ${on ? 'on' : ''}"><b class="no-gl">${on ? '★' : '☆'} ${d.name}</b><span class="dim no-gl">(${T.paths[p].name})</span><div>${d.desc}</div></div>`;
    }).join('');
    return h;
  }
  function equipTab(c) {
    let h = '';
    for (const slot in DATA.equip.slots) {
      const it = itemById(META.loadout[slot]);
      h += `<div class="sv-g">${DATA.equip.slots[slot]}</div>`;
      if (!it) { h += _t('<div class="dim sv-note">なし</div>'); continue; }
      h += `<div class="sv-it" style="color:${DATA.equip.rarity[it.rarity].col}">${itemName(it)}${it.enh ? ' +' + it.enh : ''}</div>`;
      it.opts.forEach((o, i) => {
        const red = DATA.stats[o.k].kind === 'red', val = n => (red ? 1 - Math.pow(1 - o.v, n) : o.v * n);
        // ラン中は「現在Lv の値 / 最大時」、ラン外は最大時だけ
        if (c.run) { const lv = S.eqLv[slot] ? S.eqLv[slot][i] : 0; h += `<div class="sv-row sv-op"><span>${DATA.stats[o.k].label}</span><em>Lv ${lv} / ${o.max}</em><b>${fmt(o.k, val(lv))}</b><b class="mx">${fmt(o.k, val(o.max))}</b></div>`; }
        else h += _t`<div class="sv-row sv-op1"><span>${DATA.stats[o.k].label}</span><em>最大Lv ${o.max}</em><b>${fmt(o.k, val(o.max))}</b></div>`;
      });
      if (it.uq) h += `<div class="sv-uq">★ ${DATA.uniques[it.uq].desc}</div>`;
    }
    return h;
  }
  function buildTab() {
    const tree = Object.assign({}, DATA.classes[P.cls].tree);
    if (weaponSkill()) tree.e = weaponSkill().tree;
    let h = _t('<div class="sv-g">クラス強化</div>'), any = false;
    for (const cat in tree) {
      const ps = Object.keys(tree[cat].paths).filter(p => cuLv(cat, p));
      if (!ps.length) continue;
      any = true;
      h += `<div class="sv-row"><span>${tree[cat].name}</span><i class="no-gl">${ps.map(p => `${tree[cat].paths[p].name} ${cuLv(cat, p)}`).join(_t(' ・ '))}</i></div>`;
      if (P.cs[cat]) h += _t`<div class="sv-note sp">特殊強化: <span class="no-gl">${tree[cat].paths[P.cs[cat]].sp.name}</span></div>`;
    }
    if (!any) h += _t('<div class="dim sv-note">まだありません</div>');
    h += _t('<div class="sv-g">武器</div>') + Object.keys(P.weapons).map(k => {
      const w = P.weapons[k], d = DATA.weapons[k];
      return `<div class="sv-row"><span>${w.evo ? d.evo.name : d.name}${k === P.mainW ? _t(' (メイン)') : ''}</span><b>${w.evo ? 'EVO' : 'Lv ' + w.lv}</b></div>`;
    }).join('');
    const mk = Object.keys(P.micro);
    h += _t('<div class="sv-g">微強化の累計</div>') + (mk.length ? mk.map(k => `<div class="sv-row"><span>${k === 'hpPct' ? _t('最大HP') : DATA.stats[k].label}</span><b>${k === 'hpPct' ? '×' + num(1 + P.micro[k]) : fmt(k, P.micro[k])}</b></div>`).join('') : _t('<div class="dim sv-note">まだありません</div>'));
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
      + (tab === 'stat' ? _t('<div class="sv-break"><div class="dim">行にマウスを乗せると内訳を表示します</div></div>') : '');
    Help.glossify(el.querySelector('.sv-body'), { cls: c.cls, run, per: '.sv-sk, .sv-row, .sv-note, .sv-uq' }); // 用語にマウスを乗せると説明
    el.onclick = e => {
      const b = e.target.closest('[data-t]'), s = e.target.closest('.sv-sk');
      if (b) { tab = b.dataset.t; AudioMan.click(); render(el, run, cls); }
      else if (s) { AudioMan.click(); openModal(skillDetail(c, skBlocks[+s.dataset.sk]), c); } // スキルの詳細はモーダルで
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
  function openModal(html, c) { const b = modal.querySelector('.svm-body'); b.innerHTML = html; Help.glossify(b, { cls: c && c.cls, run: c && c.run, per: '.sv-desc, .sv-row, .sv-sp' }); modal.classList.remove('hidden'); }
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
  return { render, open, close, onKey, modalOpen, closeModal, blocks: (run, cls) => blocksOf(ctx(run, run ? P.cls : cls)) };
})();
