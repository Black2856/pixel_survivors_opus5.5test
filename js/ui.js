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
    set('dmgtotal', '⚔ ' + fmtBig(S.totalDmg));
    set('elv-n', 'ENEMY LV ' + S.elv + (S.boss ? '  ⏸' : ''));
    $('elv-fill').style.width = (S.elvT / DATA.enemyLevel.interval * 100).toFixed(1) + '%';
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
  const fmtBig = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n).toLocaleString();
  function enemyLvUp() { const e = $('elv'); e.classList.remove('up'); void e.offsetWidth; e.classList.add('up'); }
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
  // 宝箱(演出: 落下 → 溜め → 大爆発 → ルーレットで報酬確定 → ゴールドカウント)
  // ============================================================
  const TIERS = {
    normal:  { label: 'TREASURE!',      cols: ['#ffd23f', '#ffb347', '#fff6c8'], coins: 50,  conf: 60 },
    rare:    { label: 'GREAT!!',        cols: ['#6ee7ff', '#ffd23f', '#ffffff'], coins: 110, conf: 140 },
    jackpot: { label: 'JACKPOT!!!',     cols: ['#ff3b5c', '#ffd23f', '#5dff8a', '#6ee7ff', '#b06ef0'], coins: 220, conf: 260 },
    evo:     { label: 'EVOLUTION!!!!',  cols: ['#ff6ec7', '#b06ef0', '#6ee7ff', '#ffd23f', '#ffffff'], coins: 180, conf: 300 },
  };
  let chest = null;
  const fxc = $('chest-fx'), fx = fxc.getContext('2d');
  let fxParts = [], fxRun = false, fxLast = 0;
  const coinImgs = ART.S.coin.map(sp => sp.c);

  function fxLoop(ts) {
    const dt = Math.min(0.05, (ts - fxLast) / 1000 || 0.016); fxLast = ts;
    if (fxc.width !== innerWidth || fxc.height !== innerHeight) { fxc.width = innerWidth; fxc.height = innerHeight; }
    fx.clearRect(0, 0, fxc.width, fxc.height);
    fx.imageSmoothingEnabled = false;
    if (chest && chest.phase === 'charge') { // 溜め: 光の粒が宝箱へ吸い込まれる
      const c = chestCenter();
      for (let i = 0; i < 3; i++) {
        const an = Math.random() * TAU, r = 260 + Math.random() * 200;
        fxParts.push({ k: 'suck', x: c.x + Math.cos(an) * r, y: c.y + Math.sin(an) * r, tx: c.x, ty: c.y, t: 0, life: 0.6, col: pick(chest.tier.cols), s: 3 + Math.random() * 4 });
      }
    }
    for (let i = fxParts.length - 1; i >= 0; i--) {
      const p = fxParts[i];
      p.t += dt;
      if (p.t >= p.life) { fxParts.splice(i, 1); continue; }
      const f = 1 - p.t / p.life;
      if (p.k === 'suck') {
        const e = easeOutCubic(p.t / p.life);
        const x = lerp(p.x, p.tx, e), y = lerp(p.y, p.ty, e);
        fx.globalCompositeOperation = 'lighter'; fx.fillStyle = p.col; fx.globalAlpha = f;
        fx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
        continue;
      }
      p.vy += p.g * dt; p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      fx.globalAlpha = Math.min(1, f * 2.5);
      fx.save(); fx.translate(p.x, p.y);
      if (p.k === 'coin') {
        fx.globalCompositeOperation = 'source-over';
        const img = coinImgs[Math.floor(p.t * 10 + p.seed) % 2];
        fx.drawImage(img, -img.width * p.s / 2, -img.height * p.s / 2, img.width * p.s, img.height * p.s);
      } else if (p.k === 'conf') {
        fx.globalCompositeOperation = 'source-over';
        fx.rotate(p.rot); fx.scale(1, Math.cos(p.t * 9 + p.seed));
        fx.fillStyle = p.col; fx.fillRect(-p.s, -p.s / 2, p.s * 2, p.s);
      } else {
        fx.globalCompositeOperation = 'lighter'; fx.fillStyle = p.col;
        const s = p.s * f; fx.fillRect(-s / 2, -s / 2, s, s);
      }
      fx.restore();
    }
    fx.globalAlpha = 1; fx.globalCompositeOperation = 'source-over';
    if (fxRun) requestAnimationFrame(fxLoop);
  }
  function fxStart() { if (!fxRun) { fxRun = true; fxLast = performance.now(); requestAnimationFrame(fxLoop); } }
  function fxBurst(x, y, n, kind, cols, o = {}) {
    for (let i = 0; i < n; i++) {
      const an = o.up ? -Math.PI / 2 + (Math.random() - 0.5) * (o.spread || 1.6) : Math.random() * TAU;
      const sp = (o.sp || 600) * (0.35 + Math.random() * 0.65);
      fxParts.push({ k: kind, x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: o.g ?? 900, drag: o.drag ?? 0.6, t: 0,
        life: (o.life || 2.4) * (0.6 + Math.random() * 0.4), col: pick(cols), s: o.s || (kind === 'coin' ? 4 : kind === 'conf' ? 5 + Math.random() * 4 : 6 + Math.random() * 8),
        rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 16, seed: Math.random() * 10 });
    }
  }
  function chestCenter() { const r = $('chest-img').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  const shakeScreen = (el, cls = 'quake') => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  function openChest(rewards) {
    state = 'chest';
    const evo = rewards.some(r => r.type === 'evo');
    const tierKey = evo ? 'evo' : rewards.length >= 5 ? 'jackpot' : rewards.length >= 3 ? 'rare' : 'normal';
    chest = { rewards, phase: 'idle', tierKey, tier: TIERS[tierKey], skip: false, done: false };
    const cs = $('chest-screen');
    cs.className = 'screen tier-' + tierKey;
    $('chest-img').src = ART.S.chest.c.toDataURL();
    $('chest-rewards').innerHTML = ''; $('chest-gold').textContent = ''; $('chest-tier').textContent = '';
    $('chest-hint').textContent = 'クリック / SPACE で開ける';
    hide($('chest-ok'));
    only('chest-screen');
    AudioMan.setDuck(0.3);
    fxParts = []; fxStart();
    AudioMan.chest();
    setTimeout(() => { const c = chestCenter(); fxBurst(c.x, c.y + 60, 24, 'spark', ['#ffffff', '#c8b89a'], { sp: 380, g: 300, life: 0.8, up: true, spread: 3 }); }, 520);
  }

  function chestAct() {
    if (!chest) return;
    const cs = $('chest-screen');
    if (chest.phase === 'idle') {
      chest.phase = 'charge';
      cs.classList.add('charging');
      $('chest-hint').textContent = '';
      const dur = chest.tierKey === 'normal' ? 0.6 : 0.85;
      AudioMan.drumroll(dur);
      setTimeout(() => chestBurst(), dur * 1000);
    } else if (chest.phase === 'reveal') {
      chest.skip = true; // ルーレットを早送り
    } else if (chest.phase === 'done') {
      chest = null; fxRun = false; fxParts = [];
      close();
    }
  }

  function chestBurst() {
    const cs = $('chest-screen'), T = chest.tier;
    chest.phase = 'reveal';
    cs.classList.remove('charging'); cs.classList.add('open');
    shakeScreen(cs);
    const fl = $('chest-flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    AudioMan.burstOpen(); AudioMan.coinRain(Math.min(40, T.coins / 5));
    screenFlash(0.9, T.cols[0]); shockAt(P.x, P.y, 2.5, 0.6);
    const c = chestCenter();
    fxBurst(c.x, c.y, T.coins, 'coin', ['#ffd23f'], { sp: 1100, up: true, spread: 2.2, g: 1500, life: 2.6 });
    fxBurst(c.x, c.y, T.conf, 'conf', T.cols, { sp: 1300, g: 500, drag: 1.4, life: 3.2 });
    fxBurst(c.x, c.y, 90, 'spark', T.cols, { sp: 900, g: 0, drag: 2.5, life: 1 });
    // 大当たりは時間差で追加の噴水
    if (chest.tierKey !== 'normal') [300, 650].forEach(d => setTimeout(() => {
      if (!chest) return;
      fxBurst(c.x, c.y, T.coins / 2, 'coin', ['#ffd23f'], { sp: 1000, up: true, spread: 1.8, g: 1500 });
      fxBurst(innerWidth * Math.random(), innerHeight + 10, 60, 'conf', T.cols, { sp: 1400, up: true, spread: 0.6, g: 700, drag: 1 });
      AudioMan.coinRain(10);
    }, d));
    const tl = $('chest-tier');
    tl.textContent = T.label; tl.classList.remove('in'); void tl.offsetWidth; tl.classList.add('in');
    setTimeout(() => revealNext(0), 350);
  }

  // 報酬カード: アイコンが減速しながら回転し、最後に確定する
  function revealNext(i) {
    if (!chest) return;
    const r = chest.rewards[i];
    if (!r) return finishChest();
    const { html, rar } = cardHTML(r);
    const card = el('div', 'card reward rolling ' + rar, html);
    $('chest-rewards').appendChild(card);
    const iconBox = card.querySelector('.card-icon');
    const finalIcon = iconBox.innerHTML;
    const pool = Object.keys(DATA.weapons).map(k => icon('weapon', k, 'big')).concat(Object.keys(DATA.passives).map(k => icon('passive', k, 'big')));
    const spins = r.type === 'evo' ? 12 : 7;
    let n = 0;
    const step = () => {
      if (!chest) return;
      if (n >= spins || chest.skip) {
        iconBox.innerHTML = finalIcon;
        applyChoice(r);
        card.classList.remove('rolling'); card.classList.add('landed');
        const rc = card.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
        const cols = r.type === 'evo' ? TIERS.evo.cols : rar === 'epic' ? ['#ffd23f', '#ffffff'] : rar === 'new' ? ['#6ee7ff', '#ffffff'] : ['#b8a8ff', '#ffffff'];
        fxBurst(cx, cy, r.type === 'evo' ? 160 : 60, 'spark', cols, { sp: r.type === 'evo' ? 900 : 550, g: 200, drag: 2, life: 1 });
        fxBurst(cx, cy, 30, 'conf', cols, { sp: 700, g: 600, drag: 1.5 });
        if (r.type === 'evo') {
          AudioMan.evolve(); shakeScreen($('chest-screen'), 'quake-big'); screenFlash(1, '#ff6ec7'); shockAt(P.x, P.y, 3, 0.5);
          const fl = $('chest-flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
        } else AudioMan.land(rar === 'epic' ? 2 : rar === 'new' ? 1 : 0);
        setTimeout(() => revealNext(i + 1), chest.skip ? 60 : 150);
        return;
      }
      iconBox.innerHTML = pick(pool);
      AudioMan.tick(n);
      n++;
      setTimeout(step, 30 + Math.pow(n / spins, 3) * 110); // 減速(イーズアウト)
    };
    setTimeout(step, 80);
  }

  function finishChest() {
    const total = Math.round(10 + Math.random() * 20) * (chest.tierKey === 'jackpot' ? 5 : chest.tierKey === 'normal' ? 1 : 3);
    const g = addGold(total);
    const gl = $('chest-gold'), t0 = performance.now();
    gl.classList.add('in');
    const count = ts => {
      const k = easeOutCubic((ts - t0) / 450);
      gl.textContent = '+' + Math.round(g * k) + ' G';
      if (k < 1) { if (Math.random() < 0.4) AudioMan.coin(); requestAnimationFrame(count); }
      else if (chest) { chest.phase = 'done'; show($('chest-ok')); }
    };
    requestAnimationFrame(count);
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
      const m = DATA.meta[k], lv = metaLv(k), mx = metaMax(k), max = lv >= mx, cost = metaCost(k);
      const b = el('button', 'shop-item' + (max ? ' max' : ''), `<div class="si-name">${m.name}</div><div class="si-desc">${m.desc}</div><div class="si-pips">${'◆'.repeat(lv)}${'◇'.repeat(mx - lv)}</div><div class="si-cost">${max ? 'MAX' : '● ' + cost}</div>`);
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
  // リセットは2回押しで確定(誤操作防止)
  let resetArm = null;
  $('btn-shop-reset').onclick = () => {
    const b = $('btn-shop-reset');
    if (!resetArm) {
      b.textContent = '本当にリセット? もう一度押す'; b.classList.add('warn');
      resetArm = setTimeout(() => { resetArm = null; b.textContent = 'リセット(全額返金)'; b.classList.remove('warn'); }, 3000);
      return;
    }
    clearTimeout(resetArm); resetArm = null;
    const back = metaRefund();
    b.textContent = 'リセット(全額返金)'; b.classList.remove('warn');
    AudioMan.coinRain(12); announce('+' + back.toLocaleString() + ' G 返金', '永続強化をリセットしました');
    renderShop();
  };
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

  return { announce, banner, hud, bossBar, enemyLvUp, openChest, openArtifact, levelUp, startPick, title, shop, pause, result, onKey, show, hide, $ };
})();
