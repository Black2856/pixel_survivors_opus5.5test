// ui.js — DOM UI(HUD / タイトル / 永続強化ショップ / 選択カード / 宝箱 / ポーズ / リザルト)
'use strict';

const UI = (() => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const show = e => e.classList.remove('hidden'), hide = e => e.classList.add('hidden');
  const screens = ['title-screen', 'shop-screen', 'choice-screen', 'chest-screen', 'pause-screen', 'result-screen'];
  const only = id => screens.forEach(s => (s === id ? show : hide)($(s)));

  // ---------- アイコン(スプライト → dataURL) ----------
  const iconCache = {};
  function iconURL(type, key) {
    const k = type + ':' + key;
    if (iconCache[k]) return iconCache[k];
    let sp;
    if (type === 'artifact') {
      const col = DATA.artifacts[key].col;
      sp = ART.mk({ a: '#1a1024', b: col, c: '#ffffff' }, ['..aaa..', '.abbba.', 'abbcbba', 'abcccba', 'abbcbba', '.abbba.', '..aaa..']);
    } else if (type === 'heal') sp = ART.S.meat;
    else if (type === 'gold') sp = ART.S.coin[0];
    else sp = ART.S.icons[key] || ART.S.orb;
    return (iconCache[k] = sp.c.toDataURL());
  }
  const icon = (type, key, cls = 'icon') => `<img class="${cls}" src="${iconURL(type, key)}" alt="">`;

  // ---------- 告知 ----------
  let annT = null, banT = null;
  function announce(main, sub) {
    const a = $('announce');
    a.innerHTML = `<div class="ann-main">${main}</div>${sub ? `<div class="ann-sub">${sub}</div>` : ''}`;
    a.classList.remove('pop'); void a.offsetWidth; a.classList.add('pop');
    clearTimeout(annT); annT = setTimeout(() => a.classList.remove('pop'), 1900);
  }
  function banner(main, sub, dur = 2600) {
    const b = $('banner');
    b.innerHTML = `<div class="ban-main">${main}</div><div class="ban-sub">${sub || ''}</div>`;
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(banT); banT = setTimeout(() => b.classList.remove('on'), dur);
  }

  // ---------- HUD ----------
  const last = {};
  const set = (id, v, prop = 'textContent') => { if (last[id] !== v) { last[id] = v; $(id)[prop] = v; } };
  let bossLag = 1;
  function hud(dt) {
    if (!S) return;
    $('xpfill').style.width = (P.xp / P.xpNext * 100).toFixed(1) + '%';
    set('lvl', 'LV ' + P.level);
    set('timer', fmtTime(S.time));
    set('stage-name', (S.loop > 1 ? 'LOOP ' + S.loop + ' · ' : '') + DATA.stages[S.stage - 1].label);
    set('kills', '☠ ' + S.kills.toLocaleString());
    set('gold', '● ' + S.gold.toLocaleString());
    const c = $('combo');
    if (S.combo >= 10) {
      c.classList.add('on');
      if (last.combo !== S.combo) { last.combo = S.combo; $('combo-n').textContent = S.combo; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
      $('combo-fill').style.width = (S.comboT / 3 * 100) + '%';
      c.dataset.tier = S.combo >= 300 ? 3 : S.combo >= 100 ? 2 : S.combo >= 40 ? 1 : 0;
    } else c.classList.remove('on');
    if (S.boss) {
      const k = Math.max(0, S.boss.hp / S.boss.maxhp);
      bossLag = Math.max(k, bossLag - dt * 0.4);
      $('bossfill').style.width = k * 100 + '%';
      $('bossfill-lag').style.width = bossLag * 100 + '%';
    }
    if (S.hudDirty) { S.hudDirty = false; slots(); }
  }
  function slots() {
    const w = $('wslots'), p = $('pslots'), a = $('aslots');
    let h = '';
    for (let i = 0; i < S.weaponSlots; i++) {
      const k = Object.keys(P.weapons)[i];
      if (!k) { h += '<div class="slot empty"></div>'; continue; }
      const wp = P.weapons[k];
      h += `<div class="slot ${wp.evo ? 'evo' : ''}" data-tip="w:${k}">${icon('weapon', k)}<span class="pips">${wp.evo ? '★' : '▮'.repeat(wp.lv)}</span></div>`;
    }
    w.innerHTML = h; h = '';
    for (let i = 0; i < S.passiveSlots; i++) {
      const k = Object.keys(P.passives)[i];
      h += k ? `<div class="slot small" data-tip="p:${k}">${icon('passive', k)}<span class="pips">${P.passives[k]}</span></div>` : '<div class="slot small empty"></div>';
    }
    p.innerHTML = h;
    a.innerHTML = Object.keys(P.art).map(k => `<div class="slot tiny" data-tip="a:${k}">${icon('artifact', k)}</div>`).join('');
  }
  function bossBar(e) {
    if (!e) { hide($('bossbar')); return; }
    bossLag = 1;
    $('bossname').textContent = e.name;
    show($('bossbar'));
  }

  // ツールチップ
  document.addEventListener('pointerover', ev => {
    const t = ev.target.closest && ev.target.closest('[data-tip]');
    const tip = $('tooltip');
    if (!t) { hide(tip); return; }
    const [kind, k] = t.dataset.tip.split(':');
    let html = '';
    if (kind === 'w') { const d = DATA.weapons[k], w = P.weapons[k]; html = `<b>${w && w.evo ? d.evo.name : d.name}</b><br>${w && w.evo ? d.evo.desc : d.desc}<br><span class="dim">進化条件: ${DATA.passives[d.evo.need].name}</span>`; }
    if (kind === 'p') { const d = DATA.passives[k]; html = `<b>${d.name}</b><br>${d.desc}`; }
    if (kind === 'a') { const d = DATA.artifacts[k]; html = `<b>${d.name}</b><br>${d.desc}`; }
    tip.innerHTML = html;
    const r = t.getBoundingClientRect();
    tip.style.left = Math.min(innerWidth - 240, r.left) + 'px'; tip.style.top = (r.bottom + 8) + 'px';
    show(tip);
  });

  // ============================================================
  // 選択カード(レベルアップ / 開始武器 / アーティファクト)
  // ============================================================
  let mode = 'level', choices = [], chosen = false;
  function statDiff(k, from, to) {
    const a = from ? (from.evo ? DATA.weapons[k].evo.st : DATA.weapons[k].lv[from.lv - 1]) : null, b = DATA.weapons[k].lv[to - 1];
    if (!a) return '';
    return Object.keys(b).filter(s => a[s] !== b[s]).map(s => `<div class="diff"><span>${DATA.statLabels[s]}</span>${a[s]} → <em>${b[s]}</em></div>`).join('');
  }
  function cardHTML(c) {
    let head = '', name = '', body = '', foot = '', rar = 'common', ic = '';
    if (c.type === 'weapon') {
      const d = DATA.weapons[c.key], w = P.weapons[c.key];
      name = d.name; ic = icon('weapon', c.key, 'big');
      head = w ? `Lv ${w.lv} → ${w.lv + 1}` : 'NEW!';
      rar = w ? (w.lv + 1 === 5 ? 'epic' : 'rare') : 'new';
      body = w ? statDiff(c.key, w, w.lv + 1) : `<p>${d.desc}</p>`;
      foot = `<div class="evohint">進化 ${icon('passive', d.evo.need, 'mini')} ${DATA.passives[d.evo.need].name}${P.passives[d.evo.need] ? ' ✔' : ''}</div>`;
    } else if (c.type === 'passive') {
      const d = DATA.passives[c.key], lv = P.passives[c.key] || 0;
      name = d.name; ic = icon('passive', c.key, 'big'); head = lv ? `Lv ${lv} → ${lv + 1}` : 'NEW!'; rar = lv ? 'common' : 'new';
      body = `<p>${d.desc}</p>`;
      const evoW = Object.keys(DATA.weapons).filter(k => DATA.weapons[k].evo.need === c.key);
      foot = `<div class="evohint">進化素材 ${evoW.map(k => icon('weapon', k, 'mini')).join('')}</div>`;
    } else if (c.type === 'artifact') {
      const d = DATA.artifacts[c.key];
      name = d.name; ic = icon('artifact', c.key, 'big'); head = 'ARTIFACT'; rar = 'legend'; body = `<p>${d.desc}</p>`;
    } else if (c.type === 'evo') {
      const d = DATA.weapons[c.key];
      name = d.evo.name; ic = icon('weapon', c.key, 'big'); head = 'EVOLUTION!!'; rar = 'legend'; body = `<p>${d.name} が進化した!<br>${d.evo.desc}</p>`;
    } else if (c.type === 'heal') { name = '回復の肉'; ic = icon('heal', 0, 'big'); head = 'HEAL'; body = '<p>HP を 40 回復</p>'; }
    else if (c.type === 'gold') { name = '金貨袋'; ic = icon('gold', 0, 'big'); head = 'GOLD'; body = `<p>ゴールド +${c.amt || 25}</p>`; }
    return { html: `<div class="card-head">${head}</div><div class="card-icon">${ic}</div><div class="card-name">${name}</div><div class="card-body">${body}</div>${foot}`, rar };
  }

  function openChoices(m, list, title) {
    mode = m; choices = list; chosen = false;
    state = 'levelup';
    $('choice-title').textContent = title;
    $('choice-title').dataset.mode = m;
    renderCards();
    only('choice-screen');
    AudioMan.setDuck(0.45);
  }
  function renderCards() {
    const box = $('cards');
    box.innerHTML = '';
    choices.forEach((c, i) => {
      const { html, rar } = cardHTML(c);
      const d = el('button', 'card ' + rar, html + `<div class="card-key">${i + 1}</div>`);
      d.style.animationDelay = (i * 0.07) + 's';
      d.onclick = () => choose(i);
      d.onmouseenter = () => AudioMan.click();
      box.appendChild(d);
    });
    const btns = $('choice-btns');
    btns.innerHTML = '';
    if (mode !== 'artifact') {
      const rb = el('button', 'btn', `リロール (${S.rerolls}) <small>R</small>`);
      rb.disabled = S.rerolls <= 0;
      rb.onclick = reroll;
      btns.appendChild(rb);
    }
    if (mode !== 'start') {
      const sb = el('button', 'btn ghost', mode === 'artifact' ? 'スキップ (+50G)' : 'スキップ (+10G)');
      sb.onclick = () => { if (chosen) return; chosen = true; addGold(mode === 'artifact' ? 50 : 10); close(); };
      btns.appendChild(sb);
    }
  }
  function reroll() {
    if (S.rerolls <= 0 || chosen || mode === 'artifact') return;
    S.rerolls--;
    choices = mode === 'start' ? startChoices() : buildChoices();
    AudioMan.select();
    renderCards();
  }
  function choose(i) {
    if (chosen || !choices[i]) return;
    chosen = true;
    const c = choices[i];
    const cardEl = $('cards').children[i];
    cardEl.classList.add('picked');
    applyChoice(c);
    AudioMan.select();
    const col = c.type === 'artifact' ? DATA.artifacts[c.key].col : c.type === 'weapon' ? DATA.weapons[c.key].col : '#ffffff';
    burst(P.x, P.y, 30, [col, '#ffffff'], { sp: 90, glow: true, up: 20 });
    addRing(P.x, P.y, 40, col, { life: 0.35 });
    setTimeout(close, 240);
  }
  function close() {
    only(null);
    state = 'play';
    AudioMan.setDuck(1);
    S.hudDirty = true;
  }
  const startChoices = () => shuffle(Object.keys(DATA.weapons)).slice(0, 3).map(k => ({ type: 'weapon', key: k }));

  // ============================================================
  // 宝箱
  // ============================================================
  let chest = null;
  function openChest(rewards) {
    state = 'chest';
    chest = { rewards, opened: false, shown: 0 };
    const cs = $('chest-screen');
    cs.className = 'screen';
    $('chest-img').src = ART.S.chest.c.toDataURL();
    $('chest-rewards').innerHTML = '';
    $('chest-hint').textContent = 'クリック / SPACE で開ける';
    hide($('chest-ok'));
    only('chest-screen');
    AudioMan.setDuck(0.45);
  }
  function chestAct() {
    if (!chest) return;
    if (!chest.opened) {
      chest.opened = true;
      const cs = $('chest-screen');
      const evo = chest.rewards.some(r => r.type === 'evo');
      cs.classList.add('opening');
      if (evo) cs.classList.add('evo');
      $('chest-hint').textContent = '';
      AudioMan.chest();
      setTimeout(() => {
        cs.classList.add('open');
        screenFlash(0.6, evo ? '#ff9bf5' : '#ffd23f');
        chest.rewards.forEach((r, i) => setTimeout(() => {
          const { html, rar } = cardHTML(r);
          applyChoice(r);
          if (r.type === 'evo') { AudioMan.evolve(); shockAt(P.x, P.y, 2.5, 0.6); screenFlash(0.9, '#ff9bf5'); }
          else AudioMan.levelup();
          $('chest-rewards').appendChild(el('div', 'card reward ' + rar, html));
          if (i === chest.rewards.length - 1) setTimeout(() => { show($('chest-ok')); $('chest-hint').textContent = ''; }, 300);
        }, 450 + i * 380));
        const g = addGold(10 + Math.random() * 20);
        $('chest-gold').textContent = '+' + g + ' G';
      }, 900);
    } else if (!$('chest-ok').classList.contains('hidden')) {
      chest = null;
      close();
    }
  }

  // ============================================================
  // 画面
  // ============================================================
  function title() {
    only('title-screen');
    hide($('hud'));
    $('title-gold').textContent = '● ' + META.gold.toLocaleString() + ' G';
    $('title-best').textContent = META.best.time ? `BEST ${fmtTime(META.best.time)} · ${META.best.kills} KILLS · LV ${META.best.level}` : '';
  }
  function shop() {
    state = 'shop';
    only('shop-screen');
    renderShop();
  }
  function renderShop() {
    $('shop-gold').textContent = '● ' + META.gold.toLocaleString() + ' G';
    const box = $('shop-list');
    box.innerHTML = '';
    for (const k in DATA.meta) {
      const m = DATA.meta[k], lv = metaLv(k), max = lv >= m.max, cost = metaCost(k);
      const b = el('button', 'shop-item' + (max ? ' max' : ''), `<div class="si-name">${m.name}</div><div class="si-desc">${m.desc}</div><div class="si-pips">${'◆'.repeat(lv)}${'◇'.repeat(m.max - lv)}</div><div class="si-cost">${max ? 'MAX' : '● ' + cost}</div>`);
      b.disabled = max || META.gold < cost;
      b.onclick = () => {
        if (META.gold < cost || max) return;
        META.gold -= cost; META.up[k] = lv + 1; saveMeta();
        AudioMan.levelup(); renderShop();
      };
      box.appendChild(b);
    }
  }
  function startPick() { openChoices('start', startChoices(), '最初の武器を選べ'); }
  function levelUp() { openChoices('level', buildChoices(), 'LEVEL UP!'); }
  function openArtifact(list) {
    if (!list.length) { addGold(100); announce('+100 G', ''); return; }
    openChoices('artifact', list, 'ARTIFACT');
  }

  function pause(on) {
    if (on) {
      only('pause-screen');
      $('vol-music').value = AudioMan.vol.music * 100; $('vol-sfx').value = AudioMan.vol.sfx * 100;
      $('pause-build').innerHTML = Object.keys(P.weapons).map(k => icon('weapon', k)).join('') + Object.keys(P.passives).map(k => icon('passive', k)).join('');
    } else only(null);
  }
  $('vol-music').oninput = e => AudioMan.setVol('music', e.target.value / 100);
  $('vol-sfx').oninput = e => { AudioMan.setVol('sfx', e.target.value / 100); AudioMan.click(); };

  function result(win, earned) {
    only('result-screen');
    hide($('hud'));
    $('result-title').textContent = win ? 'VICTORY!' : 'YOU DIED';
    $('result-title').className = win ? 'win' : 'lose';
    $('btn-endless').classList.toggle('hidden', !win);
    const rows = [['生存時間', fmtTime(S.time)], ['レベル', P.level], ['撃破数', S.kills.toLocaleString()], ['最大コンボ', S.bestCombo], ['総ダメージ', Math.round(S.totalDmg).toLocaleString()], ['獲得ゴールド', '● ' + earned]];
    $('result-stats').innerHTML = rows.map(([a, b]) => `<div class="rs"><span>${a}</span><b>${b}</b></div>`).join('');
    const tot = Object.values(S.dmgBy).reduce((a, b) => a + b, 0) || 1;
    const list = Object.entries(S.dmgBy).filter(([k]) => DATA.weapons[k]).sort((a, b) => b[1] - a[1]);
    $('result-dmg').innerHTML = list.map(([k, v]) => `<div class="dm">${icon('weapon', k)}<div class="dm-bar"><i style="width:${(v / tot * 100).toFixed(1)}%;background:${DATA.weapons[k].col}"></i></div><span>${Math.round(v).toLocaleString()}</span></div>`).join('');
  }

  // ボタン
  $('btn-start').onclick = () => startRun();
  $('btn-shop').onclick = () => { AudioMan.click(); shop(); };
  $('btn-shop-back').onclick = () => { AudioMan.click(); state = 'title'; title(); };
  $('btn-resume').onclick = () => resumeGame();
  $('btn-quit').onclick = () => endRun(false);
  $('btn-retry').onclick = () => startRun();
  $('btn-totitle').onclick = () => goTitle();
  $('btn-endless').onclick = () => startEndless();
  $('chest-screen').onclick = chestAct;

  function onKey(e) {
    if (state === 'levelup') {
      if (/^Digit[1-4]$/.test(e.code)) choose(+e.code.slice(5) - 1);
      if (e.code === 'KeyR') reroll();
    } else if (state === 'chest' && (e.code === 'Space' || e.code === 'Enter')) chestAct();
  }

  return { announce, banner, hud, bossBar, openChest, openArtifact, levelUp, startPick, title, shop, pause, result, onKey, show, hide, $ };
})();
