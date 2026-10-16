// ui.js — DOM UI(HUD / タイトル / 選択カード / 宝箱 / ポーズ / リザルト)
'use strict';

const UI = (() => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const show = e => e.classList.remove('hidden'), hide = e => e.classList.add('hidden');
  const screens = ['title-screen', 'stage-screen', 'class-screen', 'tree-screen', 'gacha-screen', 'status-screen', 'equip-screen', 'choice-screen', 'chest-screen', 'pause-screen', 'settings-screen', 'result-screen', 'help-screen', 'coop-screen'];
  const only = id => { screens.forEach(s => (s === id ? show : hide)($(s))); hideTip(); gold(); };
  const shown = id => !$(id).classList.contains('hidden');
  // レベルアップ以外の画面(メニュー・ステータス・設定・ガイドなど)が出ているか(協力プレイは止まらないので、出ている間は入力を止め、レベルアップの画面を隠す)
  const menuOpen = () => screens.some(s => s !== 'choice-screen' && shown(s)); // 画面を替えたら説明の吹き出しを消す(スマホでは指を離しても残るため)
  // ラン外の画面の右上のゴールド(どの画面も同じ所)。ラン中(ポーズ画面から開いたガイド・設定)は出さない。買った・売った後にも呼ぶ
  function gold() {
    const run = !$('hud').classList.contains('hidden'), t = '● ' + META.gold.toLocaleString() + ' G';
    for (const g of document.querySelectorAll('.screen > .gold-chip')) { g.textContent = t; g.classList.toggle('hidden', run); }
  }

  // ---------- アイコン(スプライト → dataURL) ----------
  const iconCache = {};
  function iconURL(type, key) {
    const k = type + ':' + key;
    if (iconCache[k]) return iconCache[k];
    let sp;
    if (type === 'heal') sp = ART.S.meat;
    else if (type === 'equip') sp = ART.S.eqIcons[key];
    else if (type === 'gold') sp = ART.S.coin[0];
    else sp = ART.S.icons[key] || ART.S.orb;
    return (iconCache[k] = sp.c.toDataURL());
  }
  const icon = (type, key, cls = 'icon') => `<img class="${cls}" src="${iconURL(type, key)}" alt="">`;

  // ---------- 帯のカットイン(スキル・告知・警告で共通。見た目は style.css の .cutband) ----------
  // 斜めの帯が開き(少し行き過ぎて戻る)、文字が右から流れ込んでゆっくり流れ、最後に帯が閉じる
  //   開く・閉じる速さは表示時間によらず同じ(Web Animations で、秒を表示時間に対する割合に直す)
  //   o.size: 'q' 太い / 'e' 細い / 'ann' 告知(細い)/ 'ban' 警告など(太い)・o.kind: 'warn' 赤い縞と文字の明滅・o.mark: 文字の左の印(HTML)・o.dur: 表示時間(ms)
  // 置く場所: 真ん中の自分のまわりを隠さないよう、上の HUD の下(BAND_TOP)から、出ている帯の間で入る所へ上から順に詰める
  //   1本だけなら一番上。同時に出たら重ならないように下へ。出ている間は動かさない。2本まで(3本目が来たら、一番早く消える帯を閉じて場所を空ける)
  //   位置・高さは帯の css px(UI の大きさの zoom と一緒に大きくなる)
  const BANDS = ['skillcut', 'bosscut', 'announce', 'banner'], BAND_TOP = 150, BAND_GAP = 6, BAND_MAX = 2, bandT = {}, bandEnd = {};
  const bandOn = id => $(id).classList.contains('on');
  function bandClose(id) {
    const el = $(id);
    clearTimeout(bandT[id]); el.classList.remove('on');
    for (const a of el.getAnimations({ subtree: true })) a.cancel();
  }
  function bandPlace(el) {
    const others = BANDS.filter(id => id !== el.id && bandOn(id));
    if (others.length >= BAND_MAX) { others.sort((a, b) => bandEnd[a] - bandEnd[b]); bandClose(others.shift()); }
    const h = el.offsetHeight, spans = others.map(id => { const o = $(id), t = parseFloat(o.style.top) || BAND_TOP; return [t, t + o.offsetHeight]; }).sort((a, b) => a[0] - b[0]);
    let y = BAND_TOP;
    for (const [t, b] of spans) { if (y + h + BAND_GAP <= t) break; y = Math.max(y, b + BAND_GAP); }
    el.style.top = y + 'px';
  }
  function cutBand(id, main, sub, col, o) {
    const el = $(id), dur = o.dur, k = s => Math.min(0.4, s * 1000 / dur), ez = 'cubic-bezier(.22,1,.36,1)', sk = 'skewY(-2.5deg) ';
    el.style.setProperty('--sc', col);
    el.className = 'cutband ' + o.size + (o.kind ? ' ' + o.kind : '');
    el.innerHTML = `<div class="sc-band"><div class="sc-row">${o.mark || ''}<span class="sc-name">${main}</span></div>${sub ? `<div class="sc-sub">${sub}</div>` : ''}</div>`;
    bandPlace(el); // 中身を入れてから(高さを測る)
    bandEnd[id] = performance.now() + dur;
    const band = el.firstChild, row = band.firstChild;
    band.animate([
      { transform: sk + 'scaleY(0)', opacity: 1, easing: ez },
      { transform: sk + 'scaleY(1.2)', opacity: 1, offset: k(0.1) },
      { transform: sk + 'scaleY(1)', opacity: 1, offset: k(0.17) },
      { transform: sk + 'scaleY(1)', opacity: 1, offset: 1 - k(0.18), easing: 'ease-in' },
      { transform: sk + 'scaleY(0)', opacity: 0 },
    ], { duration: dur, fill: 'forwards' });
    row.animate([
      { transform: 'translateX(34%)', opacity: 0, easing: ez },
      { transform: 'translateX(3%)', opacity: 1, offset: k(0.16) },
      { transform: 'translateX(-3%)', opacity: 1, offset: 1 - k(0.2), easing: 'ease-in' },
      { transform: 'translateX(-26%)', opacity: 0 },
    ], { duration: dur, fill: 'forwards' });
    el.classList.add('on');
    clearTimeout(bandT[id]); bandT[id] = setTimeout(() => el.classList.remove('on'), dur);
  }
  // 告知(細い金の帯)
  function announce(main, sub) { cutBand('announce', main, sub, '#ffd23f', { size: 'ann', dur: 1900 }); }
  // スキルのカットイン: 画面の上の方を横切る帯にスキル名。色はスキルの色。設定で消せる(SET.cutin)
  //   q: Q は太い帯にクラスの印(glyph)/ E は細い帯に武器のアイコン(icon: 武器のキー)。sub: 2行目(武神降臨の武器スキル)
  function skillCut(name, col, q, o = {}) {
    if (!SET.cutin) return;
    const mark = q ? (o.glyph ? `<span class="sc-glyph">${I18N.glyph(o.glyph, name)}</span>` : '') : o.icon ? icon('weapon', o.icon) : '';
    cutBand('skillcut', name, o.sub, col, { size: q ? 'q' : 'e', mark, dur: q ? 1150 : 850 });
  }
  // 小さな知らせ(照準の切り替えなど。帯ほど目立たせない): 画面の下の方に小さく出て、すぐ消える。html: 中身(.k で色を付ける)/ col: 枠と強調の色
  let toastT = null;
  function toast(html, col) {
    const t = $('toast');
    t.style.setProperty('--tc', col || '#4c3a86'); t.innerHTML = html;
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1300);
  }
  // ボスの激昂(赤い縞の帯。設定のカットインによらず出す)。name: ボスの名前
  function enrage(name) { cutBand('bosscut', _t`${name} が激昂した!!`, '', '#ff3b5c', { size: 'bs', kind: 'warn', dur: 2000 }); }
  // 警告・クリアなど(太い帯)。cls: 帯の色(なし = 赤の警告(縞が流れて文字が明滅)/ 'gold' = クリア / 'fog' = 闇の霧)
  const BAN_COL = { '': '#ff3b5c', gold: '#ffd23f', fog: '#b07aff' };
  function banner(main, sub, dur = 2600, cls = '') { cutBand('banner', main, sub, BAN_COL[cls] || BAN_COL[''], { size: 'ban', kind: cls || 'warn', dur }); }

  // ---------- HUD ----------
  const last = {};
  const set = (id, v, prop = 'textContent') => { if (last[id] !== v) { last[id] = v; $(id)[prop] = v; } };
  let bossLag = 1;
  function hud(dt) {
    if (!S) return;
    coopPickHud(); // 協力プレイの止まらないレベルアップ・休憩の待ち
    $('xpfill').style.width = (P.xp / P.xpNext * 100).toFixed(1) + '%';
    const bank = S.tower ? towerBankLv() : 0; // タワー: 貯蓄経験値で上がる Lv の数
    set('lvl', 'LV ' + P.level + (bank ? _t` ・ 貯蓄 Lv+${bank}` : ''));
    set('timer', fmtTime(S.time));
    const pre = S.mode === 'arena' ? 'ROUND ' + Math.min(S.arena.idx + 1, DATA.arena.rounds) + '/' + DATA.arena.rounds + ' · ' : S.mode === 'tower' ? (S.tower.floor || S.tower.next) + 'F · '
      : (S.loop > 1 ? 'LOOP ' + S.loop + ' · ' : '') + (S.mode === 'escalation' ? 'TIER ' + S.tier + ' · ' : '');
    const ph = phaseInfo();
    set('stage-name', pre + DATA.stages[S.stage - 1].label + (ph ? ' · ' + ph : ''));
    set('kills', '☠ ' + P.kills.toLocaleString());
    set('gold', '● ' + P.gold.toLocaleString());
    set('dmgtotal', '⚔ ' + fmtBig(P.totalDmg));
    set('elv-n', 'ENEMY LV ' + S.elv + (S.phase && S.mode !== 'tower' ? '  ⏸' : '')); // タワーの敵Lv は階で決まる(時間では上がらない)
    $('elv-fill').style.width = (S.elvT / DATA.enemyLevel.interval * 100).toFixed(1) + '%';
    const c = $('combo');
    if (P.combo >= 10) {
      c.classList.add('on');
      if (last.combo !== P.combo) { last.combo = P.combo; $('combo-n').textContent = P.combo; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
      $('combo-fill').style.width = (P.comboT / DATA.player.comboTime * 100) + '%';
      c.dataset.tier = P.combo >= 300 ? 3 : P.combo >= 100 ? 2 : P.combo >= 40 ? 1 : 0;
    } else c.classList.remove('on');
    if (S.boss) {
      const k = Math.max(0, S.boss.hp / S.boss.maxhp);
      bossLag = Math.max(k, bossLag - dt * 0.4);
      $('bossfill').style.width = k * 100 + '%';
      $('bossfill-lag').style.width = bossLag * 100 + '%';
    }
    if (S.hudDirty) { S.hudDirty = false; slots(); }
    pstat(dt);
  }

  // 通常モードのフェーズの表示: フェーズ中はその名前、外では次のフェーズまでの残り(フェーズの時計)。タワーは撃破数・休憩(towerInfo)
  function phaseInfo() {
    if (S.mode === 'tower') return towerInfo();
    const ph = S.phase;
    if (ph) return S.mode === 'stage' || S.mode === 'escalation' || ph.fogOn ? (ph.kind === 'elite' ? _t('エリート戦') : _t('ボス戦')) + (ph.fogOn ? _t(' · 闇の霧') : '') : '';
    if ((S.mode !== 'stage' && S.mode !== 'escalation') || !S.sched) return '';
    const nx = S.sched.slice(S.schedIdx).find(x => x.elites || x.boss);
    return nx ? (nx.elites ? _t('エリートまで ') : nx.final ? _t('最後のボスまで ') : _t('ボスまで ')) + fmtTime(Math.max(0, nx.t - S.ptime)) : '';
  }

  // ---------- 左下のステータスパネル ----------
  // 銀の円環(4つの光る星)から、先の尖った HP / スタミナのバーが伸びる。ドット単位で描いて --px 倍に拡大する
  const PW = 196, PH = 48, CX = 22, CY = 24;
  const PC = { out: '#0c0913', hi: '#f2f6ff', lt: '#c9d4ea', md: '#8793b0', dk: '#5b6784', dd: '#3e4763', bg: '#141024' };
  const pcv = $('ps-cv'), pc = pcv.getContext('2d');
  pcv.width = PW; pcv.height = PH;
  let hpLag = 1, lastHp = 0, healT = 0, pt = 0;
  const px = (x, y, c) => { pc.fillStyle = c; pc.fillRect(x, y, 1, 1); };
  // 4方向に伸びる光の星(len: 腕の長さ)
  function star(x, y, len, cols) {
    pc.globalAlpha = 0.18; pc.fillStyle = cols[2];
    pc.beginPath(); pc.arc(x + 0.5, y + 0.5, len + 1, 0, TAU); pc.fill(); pc.globalAlpha = 1;
    for (let i = len; i >= 1; i--) {
      const c = cols[Math.min(cols.length - 1, Math.floor(i / len * (cols.length - 1)))];
      px(x + i, y, c); px(x - i, y, c); px(x, y + i, c); px(x, y - i, c);
    }
    px(x + 1, y + 1, cols[2]); px(x - 1, y - 1, cols[2]); px(x + 1, y - 1, cols[2]); px(x - 1, y + 1, cols[2]);
    px(x, y, '#ffffff');
  }
  // 枠付きのバー(x0〜x1 が本体)。fill(i, row) で中身の色を返す(null なら背景)
  // 右端: 枠の上下が 45 度で閉じて尖る → 少し離してひし形の飾り → 縁取り付きの細い穂先
  // 行数(ih + 4)は奇数にする(先端が1ドットで上下対称になる)
  // ゲージの長さ L は、本体に先端の内側(枠が閉じていく部分)を足した列数。fill(i, r, L) で i < 割合 × L を塗る
  // over(i, r, L): 中身の上に半透明で重ねる色 [[色, 不透明度], ...](シールドなど)
  function bar(x0, x1, top, ih, spear, fill, over) {
    const lay = (x, y, i, r, L) => { const o = over && over(i, r, L); if (o) for (const [c, a] of o) { pc.globalAlpha = a; px(x, y, c); } pc.globalAlpha = 1; };
    const rows = ih + 4, bot = top + rows - 1, mid = top + (rows - 1) / 2, hr = (rows - 1) / 2;
    const L = (x1 - x0 + 1) + (ih - 1) / 2;
    for (let x = x0 - 1; x <= x1; x++) {
      px(x, top, PC.out); px(x, bot, PC.out);
      if (x < x0) { for (let y = top + 1; y < bot; y++) px(x, y, PC.out); continue; }
      px(x, top + 1, PC.lt); px(x, bot - 1, PC.dk);
      for (let r = 0; r < ih; r++) { px(x, top + 2 + r, fill(x - x0, r, L) || PC.bg); lay(x, top + 2 + r, x - x0, r, L); }
    }
    for (let i = 1; i <= hr; i++) { // 尖った先端(枠の線が斜めに閉じる)。内側もゲージとして塗る
      const x = x1 + i, y0 = top + i, y1 = bot - i;
      for (let y = y0; y <= y1; y++) {
        const edge = y === y0 || y === y1 || y === y0 + 1 || y === y1 - 1;
        px(x, y, y === y0 || y === y1 ? PC.out : y === y0 + 1 ? PC.lt : y === y1 - 1 ? PC.dk : fill(x - x0, y - top - 2, L) || PC.bg);
        if (!edge) lay(x, y, x - x0, y - top - 2, L);
      }
    }
    const sx = x1 + hr + 1, ex = sx + spear; // 穂先の線(上下に縁取り)
    for (let x = sx; x <= ex; x++) {
      px(x, mid - 1, PC.out); px(x, mid + 1, PC.out);
      px(x, mid, x === ex ? PC.hi : x > ex - 3 ? PC.md : PC.lt);
    }
    px(ex + 1, mid, PC.out);
    const dx = sx + 3; // ひし形の飾り(穂先の線の上に重ねる)
    for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) {
      const m = Math.abs(xx) + Math.abs(yy);
      if (m === 3) px(dx + xx, mid + yy, PC.out);
      else if (m === 2) px(dx + xx, mid + yy, yy < 0 || (yy === 0 && xx < 0) ? PC.hi : PC.md);
      else if (m === 1) px(dx + xx, mid + yy, yy < 0 || xx < 0 ? PC.lt : PC.dk);
      else px(dx, mid, PC.dd);
    }
  }
  // ゲージの数値用の 4×7 ドット数字(1ドットの縁取り付き)
  const DIG = {
    0: '.##.#..##..##..##..##..#.##.', 1: '.#..##...#...#...#...#..###.', 2: '.##.#..#...#..#..#..#...####',
    3: '###....#...#.##....#...####.', 4: '#..##..##..#####...#...#...#', 5: '#####...###....#...##..#.##.',
    6: '.##.#...#...###.#..##..#.##.', 7: '####...#..#...#..#...#...#..', 8: '.##.#..##..#.##.#..##..#.##.',
    9: '.##.#..##..#.###...#...#.##.', '/': '...#...#..#...#..#..#...#...', '+': '.....#...#..###..#...#......',
  };
  const digCache = new Map();
  // parts: [[文字列, 色], ...] を1枚に並べる(1文字 5 ドット送り)
  function digImg(parts) {
    const key = JSON.stringify(parts);
    if (digCache.has(key)) return digCache.get(key);
    const n = parts.reduce((a, [s]) => a + s.length, 0), W = n * 5 + 1, H = 9;
    const mask = Array.from({ length: H }, () => Array(W).fill(null));
    let cx = 1;
    for (const [s, col] of parts) for (const ch of s) {
      const g = DIG[ch];
      if (g) for (let i = 0; i < 28; i++) if (g[i] === '#') mask[1 + ((i / 4) | 0)][cx + (i % 4)] = col;
      cx += 5;
    }
    const cv = ART.canvas(W, H), x = cv.getContext('2d');
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      if (mask[y][xx]) { x.fillStyle = mask[y][xx]; x.fillRect(xx, y, 1, 1); continue; }
      const nb = (yy, xs) => yy >= 0 && yy < H && xs >= 0 && xs < W && mask[yy][xs];
      if (nb(y - 1, xx) || nb(y + 1, xx) || nb(y, xx - 1) || nb(y, xx + 1)) { x.fillStyle = PC.out; x.fillRect(xx, y, 1, 1); }
    }
    digCache.set(key, cv);
    if (digCache.size > 200) digCache.delete(digCache.keys().next().value);
    return cv;
  }
  // 「現在値/最大値」を右端 right・下端 bottom(ドット座標)に揃えて描く。数字の下端 = ゲージの色の一番下の行
  function gaugeNum(cur, max, right, bottom, shield = 0) {
    const img = digImg([[String(cur), '#ffffff'], ...(shield > 0 ? [['+' + shield, '#7ab8ff']] : []), ['/' + max, '#b9c6de']]); // シールドは青で「+量」
    pc.drawImage(img, right - (img.width - 2), bottom - 7);
  }
  // 状態の札: クラスの状態 + ボス由来の状態異常 + 装備の効果。種類が変わったときだけ作り直し、毎フレーム残り時間を更新する
  function playerStatuses() {
    const d = DATA.debuff, out = clsStatuses();
    const sk = P.slowK || d.slow; // 減速の強さ(時の歪みは ×0.7)
    if (P.slowT > 0 && P.cdSlowT <= 0) out.push({ id: 'slow', glyph: '鈍', name: _t('鈍足'), fx: _t`移動速度 -${Math.round((1 - sk) * 100)}%`, t: P.slowT, kind: 'debuff' });
    if (P.cdSlowT > 0) { const rg = Math.round((1 - d.slowRegen) * 100); out.push({ id: 'cdslow', glyph: '遅', name: _t('スロウタイム'), fx: _t`移動 -${Math.round((1 - sk) * 100)}% CD回復 -${Math.round((1 - d.cdRate) * 100)}% スタミナ回復 -${rg}% HP回復速度 -${rg}%`, t: P.cdSlowT, kind: 'debuff' }); } // 砂時計の精の時の歪みも同じ
    if (P.burnT > 0) out.push({ id: 'burn', glyph: '炎', name: _t('炎上'), fx: _t`毎${d.burnTick}秒 ${Math.round(P.burnDmg)} ダメージ ・ HP回復 -${Math.round((1 - d.burnHeal) * 100)}%`, t: P.burnT, max: d.burnDur, kind: 'debuff' });
    if (P.fatigueT > 0) out.push({ id: 'fatigue', glyph: '疲', name: _t('疲労'), fx: _t`スタミナ回復 -${Math.round((1 - d.fatigue) * 100)}%`, t: P.fatigueT, max: d.fatigueDur, kind: 'debuff' });
    if (P.frost > 0) out.push({ id: 'pfrost', glyph: '凍', name: _t('凍傷'), fx: _t`${P.frost}スタック ・ 移動速度 -${Math.round((1 - playerFrostMul()) * 100)}%(${d.pFrostMax}スタックで凍結。受けないでいると ${d.pDur}秒で消える)`, t: P.frostT, max: d.pDur, kind: 'debuff' });
    if (P.frzT > 0) out.push({ id: 'pfrz', glyph: '氷', name: _t('凍結'), fx: _t('動けず、攻撃、回避、スキルができない'), t: P.frzT, max: d.pFrzT, kind: 'debuff' });
    const ds = DATA.debuffStage;
    if (P.numb > 0) out.push({ id: 'pnumb', glyph: '痺', name: _t('痺れ'), fx: _t`${P.numb}スタック ・ CD回復 -${Math.round(ds.numbCd * P.numb * 100)}%(${ds.numbMax}スタックで麻痺。受けないでいると ${d.pDur}秒で消える)`, t: P.numbT, max: d.pDur, kind: 'debuff' });
    if (P.paraT > 0) out.push({ id: 'ppara', glyph: '麻', name: _t('麻痺'), fx: _t('攻撃できない'), t: P.paraT, max: ds.paraT, kind: 'debuff' });
    if (P.lockT > 0) out.push({ id: 'plock', glyph: '封', name: _t('攻撃不能'), fx: _t('攻撃できない'), t: P.lockT, max: P.lockMax || P.lockT, kind: 'debuff' });
    if (P.noHealT > 0) out.push({ id: 'pnoheal', glyph: '禁', name: _t('回復不能'), fx: _t('HP が回復しない'), t: P.noHealT, max: P.noHealMax || P.noHealT, kind: 'debuff' });
    if (P.dazT > 0) out.push({ id: 'pdaz', glyph: '眩', name: _t('眩惑'), fx: _t('与えるダメージ -100%'), t: P.dazT, max: P.dazMax || P.dazT, kind: 'debuff' });
    if (P.dust > 0) out.push({ id: 'pdust', glyph: '砂', name: _t('砂塵'), fx: _t`${P.dust}スタック ・ 命中率 -${Math.round(ds.dustHit * P.dust * 100)}%(受けないでいると ${d.pDur}秒で消える)`, t: P.dustT, max: d.pDur, kind: 'debuff' });
    if (P.weak > 0) out.push({ id: 'pweak', glyph: '衰', name: _t('衰弱'), fx: _t`${P.weak}スタック ・ 攻撃力 -${Math.round(ds.weakAtk * P.weak * 100)}%(受けないでいると ${d.pDur}秒で消える)`, t: P.weakT, max: d.pDur, kind: 'debuff' });
    if (P.bleed > 0) out.push({ id: 'pbleed', glyph: '血', name: _t('出血'), fx: _t`${P.bleed}スタック ・ 毎秒 最大HP の ${Math.round(P.bleed * d.pBleed * 100)}%`, t: P.bleedT, max: d.pDur, kind: 'debuff' });
    const dt2 = DATA.debuffTomb;
    if (P.poison > 0) out.push({ id: 'ppoison', glyph: '毒', name: _t('毒'), fx: _t`${P.poison}スタック ・ 最大HP -${Math.round(P.poison * dt2.poison * 100)}%(受けないでいると ${dt2.poisonDur}秒で消える)`, t: P.poisonT, max: dt2.poisonDur, kind: 'debuff' });
    if (P.darkT > 0) out.push({ id: 'pdark', glyph: '闇', name: _t('暗闇'), fx: _t`周りが暗くなり、敵の攻撃の予告が見えない ・ 命中率 -${Math.round(dt2.darkHit * 100)}%`, t: P.darkT, max: dt2.darkDur, kind: 'debuff' });
    if (S.phase && S.phase.fogOn && !(S.phase.fogPause > 0)) out.push({ id: 'fog', glyph: '霧', name: _t('闇の霧'), fx: S.mode === 'tower' ? _t`毎秒 HP -${S.phase.fogDmg}(10秒ごとに +1)。階をクリアすると晴れる` : _t`毎秒 HP -${S.phase.fogDmg}(10秒ごとに +1)。フェーズをクリアすると晴れる`, kind: 'debuff' });
    if (P.shield >= 1) out.push({ id: 'shield', glyph: '盾', name: _t('シールド'), fx: _t`${Math.floor(P.shield)} のダメージを先に受ける`, kind: 'buff' });
    if (P.oShield >= 1) out.push({ id: 'oshield', glyph: '守', name: _t('一時シールド'), fx: _t`${Math.floor(P.oShield)} のダメージを先に受ける(得た分ごとに時間で消える)`, t: Math.min(...P.oChunks.map(c => c.t)), max: Math.max(...P.oChunks.map(c => c.dur)), kind: 'buff' });
    if (P.uq.phoenix && !P.revived) out.push({ id: 'phoenix', glyph: '鳳', name: _t('不死鳥の加護'), fx: _t('一度だけ蘇生'), kind: 'buff' });
    return out;
  }
  const chipMax = {}; // 残り時間の最大値(max がない状態は、出現したときの残り時間を最大とする)
  let stList = [];
  function statusChips() {
    const list = stList = playerStatuses(), box = $('ps-status'), sig = list.map(s => s.id).join('|');
    if (last.stSig !== sig) {
      last.stSig = sig;
      box.innerHTML = list.map(s => `<div class="st ${s.kind}" data-id="${s.id}" data-tip="s:${s.id}"><span class="gl">${I18N.glyph(s.glyph, s.name)}</span></div>`).join('');
    }
    for (const s of list) {
      const el = box.querySelector(`[data-id="${s.id}"]`); if (!el) continue;
      let p = 100;
      if (s.t !== undefined) { const mx = s.max || (chipMax[s.id] = Math.max(chipMax[s.id] || 0, s.t)); p = clamp(s.t / mx * 100, 0, 100); }
      else delete chipMax[s.id];
      el.style.setProperty('--p', p.toFixed(1));
    }
    for (const id in chipMax) if (!list.some(s => s.id === id)) delete chipMax[id];
    // 表示中のツールチップは毎フレーム更新(残り時間が進むため)
    if (tipKey && tipKey.startsWith('s:')) showTip(tipEl, tipKey);
  }
  // E / Q のアイコン。構成が変わったときだけ作り直し、毎フレーム CD のスイープを更新する(スマホのボタン #tc-e / #tc-q も同じ中身)
  function skillIcons() {
    const list = clsSkillIcons(), box = $('ps-skills'), sig = list.map(s => s.slot + s.glyph).join() + SET.autoE + SET.autoQ;
    const inner = s => `${I18N.glyph(s.glyph, s.name)}<div class="cd"></div><span class="key">${s.key}</span>${SET[s.slot === 'e' ? 'autoE' : 'autoQ'] ? '<span class="auto">AUTO</span>' : ''}`;
    if (last.skSig !== sig) {
      last.skSig = sig;
      box.innerHTML = list.map(s => `<div class="ps-sk" data-slot="${s.slot}" title="${s.name}">${inner(s)}</div>`).join('');
      if (TOUCH_UI) for (const k of ['e', 'q']) { const s = list.find(x => x.slot === k), b = $('tc-' + k); b.classList.toggle('hidden', !s); b.innerHTML = s ? inner(s) : ''; }
    }
    for (const el of TOUCH_UI ? [...box.children, $('tc-e'), $('tc-q')] : box.children) {
      if (!el.firstChild) continue; // このクラスにないスキルのボタン
      const sk = P.sk[el.dataset.slot], p = sk.cd > 0 ? sk.cd / sk.max * 100 : 0;
      el.querySelector('.cd').style.setProperty('--p', p.toFixed(1));
      const ready = sk.cd <= 0;
      if (ready && el.dataset.ready === '0') { el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready'); }
      el.dataset.ready = ready ? '1' : '0';
      el.classList.toggle('busy', !!(P.act && P.act.slot === el.dataset.slot));
    }
  }
  function pstat(dt) {
    const c = DATA.classes[P.cls], box = $('pstat');
    pt += dt;
    if (last.cls !== P.cls) { last.cls = P.cls; box.style.setProperty('--cc', c.col); $('touch-ctl').style.setProperty('--cc', c.col); hpLag = 1; lastHp = P.hp; }
    if (last.px !== GFX.PX) { last.px = GFX.PX; box.style.setProperty('--px', GFX.PX + 'px'); box.style.setProperty('--pxn', GFX.PX); pcv.style.width = PW * GFX.PX + 'px'; pcv.style.height = PH * GFX.PX + 'px'; }
    set('ps-name', `<b>${c.en}</b> Lv${classLvOf(P.cls, P.kit)}`, 'innerHTML');
    const base = P.maxhpBase || P.maxhp, k = clamp(P.hp / base, 0, 1), low = P.hp / P.maxhp < 0.3, pz = clamp(P.maxhp / base, 0, 1); // pz: 毒で下がった最大HP の割合(右端の紫)
    hpLag = Math.max(k, hpLag - dt * 0.5);
    if (P.hp > lastHp + 0.5) healT = 0.3;
    lastHp = P.hp; healT -= dt;
    box.classList.toggle('danger', low);
    pc.clearRect(0, 0, PW, PH);

    // HP バー: 被弾は白が遅れて減る / 回復は緑に光る / 30% 以下は点滅
    const hpC = healT > 0 ? ['#c8ffd8', '#5dff8a', '#2a9a52'] : low && Math.floor(pt * 6) % 2 ? ['#ffc0b8', '#ff5a4a', '#b0302a'] : ['#ff8a78', '#d8473b', '#9a2a24'];
    // シールド: HP ゲージの左から重ねる青いゲージ(上が濃く下が薄い)。走査線と流れる格子のテクノロジー風の光
    // 下の行ほど透明にして、下の HP が透けて見えるようにする
    const sh = clamp(shieldTotal() / P.maxhp, 0, 1), SHC = ['#1c3fb8', '#2f63e0', '#3f7ff0', '#5a9cff', '#7ab8ff'], SHA = [0.95, 0.8, 0.62, 0.45, 0.3];
    const scanX = (pt * 50) % (170 + 40) - 20; // 左から右へ流れる走査線の中心
    bar(32, 170, 15, 5, 12, (i, r, L) => i < k * L ? (r === 0 ? hpC[0] : r === 4 ? hpC[2] : hpC[1]) : i < hpLag * L ? '#e8e4f0' : i >= pz * L ? ((i + r + Math.floor(pt * 10)) % 5 ? '#4a1a6a' : '#8a4ac0') : null,
      (i, r, L) => {
        if (!(sh > 0 && i < sh * L)) return null;
        const out = [[SHC[r], SHA[r]]];
        const g = Math.max(0, 1 - Math.abs(i - scanX) / 10); // 走査線: 中心から左右へなだらかに消える光
        if (g > 0) out.push(['#cfefff', g * g * 0.85 * (0.5 + SHA[r] * 0.5)]);
        if ((i + r * 3 + Math.floor(pt * 12)) % 9 === 0) out.push(['#9fe8ff', 0.55 * SHA[r] + 0.2]); // 斜めに流れる格子の点
        if (i >= sh * L - 1) out.push(['#e8f8ff', 0.4 + 0.4 * Math.sin(pt * 12)]);                   // 右端がゆっくり明滅
        return out;
      });
    // スタミナバー: 回復停止中は灰色の縞が流れる / ガードブレイク中は赤く点滅
    const sk = clamp(P.sta / P.maxSta, 0, 1), lock = P.staLockT > 0, brk = clsStaBroken();
    bar(32, 160, 27, 3, 9, (i, r, L) => {
      if (i >= sk * L) return null;
      if (brk) return Math.floor(pt * 8) % 2 ? '#ff3b5c' : '#8a1a2a';
      if (lock) return (i + Math.floor(pt * 16)) % 6 < 3 ? '#7a8a98' : '#4a5866';
      return r === 0 ? '#c8fff0' : '#4fc8a0';
    });
    // 数値: 数字の下端をゲージの色の一番下の行に揃える(4×7 ドットで、上に少しはみ出す)
    gaugeNum(Math.ceil(Math.max(0, P.hp)), P.maxhp, 166, 21, Math.floor(shieldTotal()));
    gaugeNum(Math.floor(P.sta), Math.round(P.maxSta), 156, 31);

    // 円環: 銀の帯 + 回り続ける光 + 内側にクラスリソースのゲージ
    const res = clsRes(), full = res && res.v >= res.max, frac = res ? res.v / res.max : 0;
    const glintA = pt * 1.4, cc = c.col;
    for (let y = CY - 16; y <= CY + 16; y++) for (let x = CX - 16; x <= CX + 16; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, d = Math.hypot(dx, dy);
      if (d >= 15.5) continue;
      const a = Math.atan2(dy, dx);
      if (d >= 11.5) { // 帯
        let col = d >= 14.6 ? PC.out : d >= 13.7 ? PC.dk : d >= 12.8 ? PC.lt : d >= 12 ? PC.md : PC.dd;
        if (col === PC.lt && Math.abs(Math.atan2(Math.sin(a + 2.3), Math.cos(a + 2.3))) < 0.9) col = PC.hi;
        if (d >= 12 && d < 14.6 && Math.abs(Math.atan2(Math.sin(a - glintA), Math.cos(a - glintA))) < 0.16) col = '#ffffff';
        px(x, y, col); continue;
      }
      if (d >= 8.5 && d < 10.5 && res) { // ゲージ(上から時計回り)
        const u = ((a + Math.PI / 2) / TAU + 1) % 1;
        const on = u < frac, pulse = full && Math.floor(pt * 5) % 2;
        if (res.seg && Math.abs(u * res.max - Math.round(u * res.max)) < 0.05) { px(x, y, '#0f0b1c'); continue; } // 区切り(魔力結晶など)
        px(x, y, on ? (pulse ? res.pulse || '#ffffff' : d >= 9.5 ? cc : res.dk || '#a0122a') : '#241c3a'); // pulse: 上限で脈打つ色(バーサーカーの怒りは暗い赤)
        continue;
      }
      px(x, y, '#0f0b1c');
    }
    if (res) { // 中央の数値(満タンは金色)
      const g = ART.text(String(Math.floor(res.v)), full ? '#ffd23f' : '#ffffff');
      pc.drawImage(g, Math.round(CX - g.width / 2), Math.round(CY - g.height / 2));
    }
    // 4つの光る星(瞬く)。HP 30% 以下は赤くなる
    const sc = low ? ['#ffffff', '#ffd0d8', '#ff5d73', '#a0122a'] : ['#ffffff', '#dff2ff', '#9fd8ff', '#4a7ad8'];
    const tw = i => Math.sin(pt * 3 + i * 1.7) * 0.5 + 0.5;
    star(CX, CY - 17, 3 + Math.round(tw(0) * 2), sc); star(CX, CY + 17, 3 + Math.round(tw(1) * 2), sc);
    star(CX - 17, CY, 2 + Math.round(tw(2)), sc); star(CX + 16, CY, 2 + Math.round(tw(3)), sc);

    skillIcons();
    statusChips();
    // プレイヤーがパネルの裏に入ったら薄くする
    const pr = box.getBoundingClientRect(), cr = cvsEl.getBoundingClientRect();
    const sx = cr.left + (P.x - cam.x) * GFX.PX, sy = cr.top + (P.y - cam.y) * GFX.PX;
    box.classList.toggle('behind', sx > pr.left - 20 && sx < pr.right + 20 && sy > pr.top - 30 && sy < pr.bottom + 10);
  }
  function slots() {
    const w = $('wslots');
    let h = '';
    for (let i = 0; i < P.weaponSlots; i++) {
      const k = Object.keys(P.weapons)[i];
      if (!k) { h += '<div class="slot empty"></div>'; continue; }
      const wp = P.weapons[k];
      h += `<div class="slot ${wp.evo ? 'evo' : ''} ${k === P.mainW ? 'main' : ''}" data-tip="w:${k}">${icon('weapon', k)}<span class="pips">${wp.evo ? '★' : '▮'.repeat(wp.lv)}</span></div>`;
    }
    w.innerHTML = h;
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
  let tipKey = null, tipEl = null;
  function hideTip() { hide($('tooltip')); tipKey = tipEl = null; }
  // 設定画面の各行の説明(行にマウスを乗せると出る)
  const SET_TIPS = {
    gfx: [_t('画質'), _t('低いほどブルーム・画面の歪み・パーティクルを減らし軽くなります')],
    fxA: [_t('攻撃の濃さ'), _t('自分の攻撃エフェクトの不透明度')],
    ui: [_t('UIサイズ'), _t('HUD とメニュー画面の大きさ。100% で画面に合わせた大きさ')],
    autoE: [_t('E 自動発動'), _t('武器スキル(E)を自動で使います。周りに敵が集まっているときだけ使います')],
    autoQ: [_t('Q 自動発動'), _t('クラススキル(Q)を自動で使います。周りに敵が集まっているときだけ使います')],
    cutin: [_t('カットイン'), _t('E / Q を使ったときに、スキル名の帯を画面の上の方に出します')],
    hints: [_t('初見の説明'), _t('敵の技・状態異常を、そのランで初めて見たときに説明の帯を出します')],
    lang: [_t('言語'), _t('表示の言語を切り替えます(ページを読み直します)。ラン中は変えられません')],
  };
  document.addEventListener('pointerover', ev => {
    const t = ev.target.closest && ev.target.closest('[data-tip]');
    if (!t) { hide($('tooltip')); tipKey = tipEl = null; return; }
    showTip(t, t.dataset.tip);
  });
  // スマホ: 指で触れると pointerover が来て説明が出る(ほかの所に触れると消える)。カード・ボタンの中の用語に触れたときは、説明を出すだけで押したことにしない
  if (TOUCH_UI) document.addEventListener('click', ev => {
    if (ev.target.closest && ev.target.closest('[data-tip^="g:"], [data-tip^="c:"]')) { ev.stopPropagation(); ev.preventDefault(); }
  }, true);
  function showTip(t, key) {
    const tip = $('tooltip'), [kind, k] = key.split(':');
    tipKey = key; tipEl = t;
    let html = '';
    if (kind === 's') {
      const s = stList.find(x => x.id === k);
      if (!s) { hide(tip); tipKey = tipEl = null; return; }
      html = `<b style="color:${s.kind === 'debuff' ? '#ff5d73' : '#9ff7ff'}">${s.name}</b><br>${s.fx}` + (s.t !== undefined ? _t`<br><span class="dim">残り ${s.t.toFixed(1)} 秒</span>` : '');
    }
    if (kind === 'w') { const d = DATA.weapons[k], w = P.weapons[k]; html = _t`<b>${w && w.evo ? d.evo.name : d.name}</b><br>${w && w.evo ? d.evo.desc : d.desc}<br><span class="dim">進化: ${evoCond(k)}</span>`; }
    if (kind === 'g' || kind === 'c') html = Help.tip(kind, key.slice(2)); // 説明文の用語(用語集・クラスの用語)
    if (kind === 'set' && SET_TIPS[k]) html = `<b>${SET_TIPS[k][0]}</b><br>${SET_TIPS[k][1]}`; // 設定の各行
    if (!html) { hide(tip); tipKey = tipEl = null; return; }
    tip.innerHTML = html;
    const r = t.getBoundingClientRect();
    // ツールチップ自体も UI サイズで拡大されるので、位置は拡大率で割る
    const z = uiZ;
    tip.style.left = Math.max(0, Math.min(innerWidth - 330 * z, r.left)) / z + 'px'; // 幅(最大 300 + 余白)が画面の右に収まるように
    // 画面の下半分では上に出す(左下の状態アイコンなど)
    if (r.top > innerHeight / 2) { tip.style.top = ''; tip.style.bottom = (innerHeight - r.top + 8) / z + 'px'; } else { tip.style.bottom = ''; tip.style.top = (r.bottom + 8) / z + 'px'; }
    show(tip);
  }

  // ============================================================
  // 選択カード(レベルアップ: 武器カード / クラス強化カード)
  // ============================================================
  let mode = 'level', choices = [], chosen = false, curLv = 1;
  // 進化の条件(メイン武器もサブ武器も、その武器を持つクラスの Lv10 で解放)
  const evoCond = k => _t`武器Lv5 + ${clsNameShown(weaponOwner(k))} Lv10` + ((P.wm[k] || weaponMastery(k, P.kit)).evo ? ' ✔' : ''); // まだ持っていない武器(NEW のカード)は熟練をその場で計算
  function statDiff(k, from, to) {
    const a = from ? (from.evo ? DATA.weapons[k].evo.st : DATA.weapons[k].lv[from.lv - 1]) : null, b = DATA.weapons[k].lv[to - 1];
    if (!a) return '';
    return Object.keys(b).filter(s => a[s] !== b[s]).map(s => `<div class="diff"><span>${DATA.statLabels[s] || s}</span>${a[s]} → <em>${b[s]}</em></div>`).join('');
  }
  function cardHTML(c) {
    let head = '', name = '', body = '', foot = '', rar = 'common', ic = '';
    if (c.type === 'weapon') {
      const d = DATA.weapons[c.key], w = P.weapons[c.key];
      name = d.name; ic = icon('weapon', c.key, 'big');
      head = w ? `Lv ${w.lv} → ${w.lv + 1}` : 'NEW!' + (P.lvFx.startLv ? _t` Lv${1 + P.lvFx.startLv} から` : ''); // クラスLv: 新しい武器が高い Lv から(ウェポンマスター)
      rar = w ? (w.lv + 1 === 5 ? 'epic' : 'rare') : 'new';
      body = w ? statDiff(c.key, w, w.lv + 1) : `<p>${d.desc}</p>`;
      foot = _t`<div class="evohint"><span>進化 ${evoCond(c.key)}${c.key === P.mainW ? _t(' (メイン)') : ''}</span></div>`; // 1つの要素に(用語の印で折り返さないように)
    } else if (c.type === 'cls') {
      // クラス強化: カテゴリ名 / パス名 / 次のLvの効果。特殊強化は性質が変わる派生
      const C = treeCat(c.cat), d = C.paths[c.path], lv = cuLv(c.cat, c.path);
      // カテゴリごとにアイコンと色を分ける(特性 / パッシブ / クラススキル Q / 武器スキル E)
      const CAT = { trait: [_t('特性'), '#ff5d73'], passive: [_t('パッシブ'), '#5dff8a'], q: [_t('スキル Q'), '#ffd23f'], e: [_t('スキル E'), '#ffb7d5'] }[c.cat];
      ic = `<div class="cls-ic" style="--cc:${CAT[1]}">${C.name[0]}${c.sp ? '<i>★</i>' : ''}</div>`;
      const tag = `<span class="cls-cat" style="--cc:${CAT[1]}">${CAT[0]}</span>`; // 見出しの行に並べるカテゴリの札
      if (c.sp) { name = `<span class="no-gl">${d.sp.name}</span>`; head = tag + 'SPECIAL'; rar = 'legend'; body = `<p>${d.sp.desc}</p>`; foot = _t`<div class="evohint"><span>${C.name}「<span class="no-gl">${d.name}</span>」の派生 ・ ${C.name}の特殊強化は1つだけ</span></div>`; }
      else {
        head = tag + `Lv ${lv} → ${lv + 1}`; name = `<small>${C.name}</small><span class="no-gl">${d.name}</span>`; // パス名(威力・迅速など)は用語ではないので印を付けない rar = lv + 1 === 3 ? 'epic' : 'rare';
        // Lv1 以上は「今 → 次」の2行(Lv1 の説明の「基本の値 → Lv1 の値」は、今の行では Lv1 の値だけ)
        body = lv ? _t`<div class="cd-lv now"><em>今</em><div>${pathDesc(d, lv).replace(/\S+ → (\S+)/, '$1')}</div></div><div class="cd-lv"><em>次</em><div>${pathDesc(d, lv + 1)}</div></div>` : `<p>${pathDesc(d, 1)}</p>`;
        if (lv + 1 === 3 && !P.cs[c.cat]) body += _t`<div class="cd-sp">Lv3 で特殊強化「${d.sp.name}」が候補に出る</div>`; // このカテゴリの特殊強化をまだ取っていないとき
        foot = `<div class="evohint">${'◆'.repeat(lv + 1)}${'◇'.repeat(2 - lv)}</div>`;
      }
    } else if (c.type === 'item') {
      // 装備: 種類のアイコン / レアリティ / オプション一覧(ラン開始時は Lv0 → レベルアップで伸びる)/ 固有効果
      const it = c.item, R = DATA.equip.rarity[it.rarity];
      name = itemName(it); ic = icon('equip', it.type, 'big'); head = `<span style="color:${R.col}">${R.name}</span> ${DATA.equip.slots[itemSlot(it)]}`;
      rar = { common: 'common', uncommon: 'new', rare: 'rare', epic: 'epic', legendary: 'legend', mythic: 'mythic' }[it.rarity];
      body = it.opts.map(o => `<div class="opt">${optHTML(o)} <em>${_t`〜Lv${o.max}`}</em></div>`).join('') + (it.uq ? `<p class="uq">${DATA.uniques[it.uq].desc}</p>` : '');
      foot = `<div class="evohint">${c.sold ? _t`インベントリが満杯 → 売却 +${c.sold}G` : _t('インベントリに追加')}</div>`;
    } else if (c.type === 'eqopt') {
      // 装備カード: 装備中のアイテムのオプション1つを +1Lv
      const it = kitItem(P.kit, c.slot), o = it.opts[c.i], lv = P.eqLv[c.slot][c.i], R = DATA.equip.rarity[it.rarity];
      ic = icon('equip', it.type, 'big'); head = `<span style="color:${R.col}">${DATA.equip.slots[c.slot]}</span> Lv ${lv} → ${lv + 1}`;
      name = `<small>${itemName(it)}</small>${DATA.stats[o.k].label}`;
      rar = lv + 1 === o.max ? 'epic' : 'rare';
      body = `<div class="diff eqd">${optVal({ k: o.k, v: optAt(o, lv) })} → <em>${optVal({ k: o.k, v: optAt(o, lv + 1) })}</em></div>`; // 名前はカード名にあるので値だけ
      foot = _t`<div class="evohint">${'◆'.repeat(lv + 1)}${'◇'.repeat(o.max - lv - 1)} 最大Lv ${o.max}</div>`;
    } else if (c.type === 'evo') {
      const d = DATA.weapons[c.key];
      name = d.evo.name; ic = icon('weapon', c.key, 'big'); head = 'EVOLUTION!!'; rar = 'legend'; body = _t`<p>${d.name} が進化した!<br>${d.evo.desc}</p>`;
    }
    return { html: `<div class="card-head">${head}</div><div class="card-icon">${ic}</div><div class="card-name">${name}</div><div class="card-body">${body}</div>${foot}`, rar };
  }

  function openChoices(m, list, title) {
    mode = m; choices = list; chosen = false;
    state = 'levelup';
    $('choice-title').textContent = title;
    $('choice-title').dataset.mode = m;
    $('choice-screen').classList.remove('sent'); // 協力プレイで選んだ印が残っていても消す
    renderCards();
    only('choice-screen');
    AudioMan.setDuck(0.45);
  }
  function renderCards() {
    drawCards(choices, choose, reroll, () => { if (chosen) return; chosen = true; addGold(10); close(); }, canReroll());
  }
  // カードとリロール・スキップを描く(1人のレベルアップと、協力プレイの止まらないレベルアップで同じ形)
  function drawCards(list, pick, rr, skip, rrOn) {
    const box = $('cards');
    box.innerHTML = '';
    list.forEach((c, i) => {
      const { html, rar } = cardHTML(c);
      const d = el('button', 'card ' + rar, html + `<div class="card-key">${i + 1}</div>`);
      d.style.animationDelay = (i * 0.07) + 's';
      d.onclick = () => pick(i);
      if (!TOUCH_UI) d.onmouseenter = () => AudioMan.click(); // スマホはタップで乗せたことになり、選んだ音と重なる
      box.appendChild(d);
      Help.glossify(d, { cls: P.cls, run: true });
    });
    const btns = $('choice-btns');
    btns.innerHTML = '';
    const rb = el('button', 'btn', _t`リロール (${P.rerolls}) <small>R</small>`);
    rb.disabled = !rrOn;
    rb.onclick = rr;
    btns.appendChild(rb);
    const sb = el('button', 'btn ghost', _t('スキップ (+10G)'));
    sb.onclick = skip;
    btns.appendChild(sb);
  }
  // アーティファクトは未所持が3つ以下だと引き直しても同じ候補になるので不可
  const canReroll = () => P.rerolls > 0 && !chosen;
  function reroll() {
    if (!canReroll()) return;
    P.rerolls--;
    choices = buildChoices(curLv);
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
    const col = c.type === 'weapon' ? DATA.weapons[c.key].col : c.type === 'cls' ? DATA.classes[P.cls].col : c.type === 'eqopt' ? '#9ff7ff' : '#ffffff';
    burst(P.x, P.y, 30, [col, '#ffffff'], { sp: 90, glow: true, up: 20 });
    addRing(P.x, P.y, 40, col, { life: 0.35 });
    setTimeout(close, 240);
  }
  // 画面を閉じてプレイに戻る(ラン開始時にも使う)
  function close() {
    only(null);
    state = 'play';
    AudioMan.setDuck(1);
    S.hudDirty = true;
  }

  // ============================================================
  // 宝箱(演出: 落下 → 溜め → 大爆発 → ルーレットで報酬確定 → ゴールドカウント)
  // ============================================================
  const TIERS = {
    normal:  { label: 'TREASURE!',      cols: ['#ffd23f', '#ffb347', '#fff6c8'], coins: 50,  conf: 60 },
    rare:    { label: 'GREAT!!',        cols: ['#6ee7ff', '#ffd23f', '#ffffff'], coins: 110, conf: 140 },
    jackpot: { label: 'JACKPOT!!!',     cols: ['#ff3b5c', '#ffd23f', '#5dff8a', '#6ee7ff', '#b06ef0'], coins: 220, conf: 260 },
    evo:     { label: 'EVOLUTION!!!!',  cols: ['#ff6ec7', '#b06ef0', '#6ee7ff', '#ffd23f', '#ffffff'], coins: 180, conf: 300 },
    legend:  { label: 'LEGENDARY!!!!',  cols: ['#ffb347', '#ffd23f', '#ff6a2a', '#ffffff', '#ff6ec7'], coins: 240, conf: 320 },
    mythic:  { label: 'MYTHIC!!!!!',    cols: ['#ff3b5c', '#ff6a2a', '#ffd23f', '#ffffff', '#c0204a'], coins: 280, conf: 360 }, // 宝箱のミシック(まれ)
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
        const an = fxRandom() * TAU, r = 260 + fxRandom() * 200;
        fxParts.push({ k: 'suck', x: c.x + Math.cos(an) * r, y: c.y + Math.sin(an) * r, tx: c.x, ty: c.y, t: 0, life: 0.6, col: fpick(chest.tier.cols), s: 3 + fxRandom() * 4 });
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
      const an = o.up ? -Math.PI / 2 + (fxRandom() - 0.5) * (o.spread || 1.6) : fxRandom() * TAU;
      const sp = (o.sp || 600) * (0.35 + fxRandom() * 0.65);
      fxParts.push({ k: kind, x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: o.g ?? 900, drag: o.drag ?? 0.6, t: 0,
        life: (o.life || 2.4) * (0.6 + fxRandom() * 0.4), col: fpick(cols), s: o.s || (kind === 'coin' ? 4 : kind === 'conf' ? 5 + fxRandom() * 4 : 6 + fxRandom() * 8),
        rot: fxRandom() * TAU, vr: (fxRandom() - 0.5) * 16, seed: fxRandom() * 10 });
    }
  }
  function chestCenter() { const r = $('chest-img').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  const shakeScreen = (el, cls = 'quake') => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  function openChest(rewards) {
    state = 'chest';
    // 段階は中身の一番良いレアリティで決める
    const best = Math.max(...rewards.map(r => r.type === 'item' ? RARITY_KEYS.indexOf(r.item.rarity) : 0));
    const tierKey = best >= 5 ? 'mythic' : best === 4 ? 'legend' : best === 3 ? 'jackpot' : best === 2 ? 'rare' : 'normal';
    chest = { rewards, phase: 'idle', tierKey, tier: TIERS[tierKey], skip: false, done: false };
    const cs = $('chest-screen');
    cs.className = 'screen tier-' + tierKey;
    $('chest-img').src = ART.S.chest.c.toDataURL();
    $('chest-rewards').innerHTML = ''; $('chest-gold').textContent = ''; $('chest-tier').textContent = '';
    $('chest-hint').textContent = TOUCH_UI ? _t('タップで開ける') : _t('クリック / SPACE で開ける');
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
      fxBurst(innerWidth * fxRandom(), innerHeight + 10, 60, 'conf', T.cols, { sp: 1400, up: true, spread: 0.6, g: 700, drag: 1 });
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
    Help.glossify(card.querySelector('.card-body'));
    const iconBox = card.querySelector('.card-icon');
    const finalIcon = iconBox.innerHTML;
    const pool = Object.keys(DATA.equip.types).map(k => icon('equip', k, 'big'));
    const big = r.type === 'item' && (r.item.rarity === 'legendary' || r.item.rarity === 'mythic'), spins = big ? 12 : 7; // ミシックは宝箱でもまれに出る
    let n = 0;
    const step = () => {
      if (!chest) return;
      if (n >= spins || chest.skip) {
        iconBox.innerHTML = finalIcon;
        applyChoice(r);
        card.classList.remove('rolling'); card.classList.add('landed');
        const rc = card.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
        const cols = big ? TIERS[rar === 'mythic' ? 'mythic' : 'legend'].cols : rar === 'epic' ? ['#ffd23f', '#ffffff'] : rar === 'new' ? ['#6ee7ff', '#ffffff'] : ['#b8a8ff', '#ffffff'];
        fxBurst(cx, cy, big ? 160 : 60, 'spark', cols, { sp: big ? 900 : 550, g: 200, drag: 2, life: 1 });
        fxBurst(cx, cy, 30, 'conf', cols, { sp: 700, g: 600, drag: 1.5 });
        if (big) {
          AudioMan.evolve(); shakeScreen($('chest-screen'), 'quake-big'); screenFlash(1, rar === 'mythic' ? '#ff3b5c' : '#ffb347'); shockAt(P.x, P.y, 3, 0.5);
          const fl = $('chest-flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
        } else AudioMan.land(rar === 'epic' ? 2 : rar === 'new' ? 1 : 0);
        setTimeout(() => revealNext(i + 1), chest.skip ? 60 : 150);
        return;
      }
      iconBox.innerHTML = fpick(pool);
      AudioMan.tick(n);
      n++;
      setTimeout(step, 30 + Math.pow(n / spins, 3) * 110); // 減速(イーズアウト)
    };
    setTimeout(step, 80);
  }

  function finishChest() {
    const total = Math.round(10 + fxRandom() * 20) * (chest.tierKey === 'jackpot' ? 5 : chest.tierKey === 'normal' ? 1 : 3);
    const g = addGold(total);
    const gl = $('chest-gold'), t0 = performance.now();
    gl.classList.add('in');
    const count = ts => {
      const k = easeOutCubic((ts - t0) / 450);
      gl.textContent = '+' + Math.round(g * k) + ' G';
      if (k < 1) { if (fxRandom() < 0.4) AudioMan.coin(); requestAnimationFrame(count); }
      else if (chest) { chest.phase = 'done'; show($('chest-ok')); }
    };
    requestAnimationFrame(count);
  }

  // ============================================================
  // 画面
  // ============================================================
  // タイトルのメニュー: ↑↓(W / S)で選び、Enter / Space で決める。マウスを乗せた物も選ぶ。選んだ物に ▶ と下線(最初は冒険開始。ほかの画面から戻っても前に選んだ物のまま)
  for (const b of document.querySelectorAll('[data-ic]')) b.insertAdjacentHTML('afterbegin', ART.uiIcon(b.dataset.ic));
  const TM = [...document.querySelectorAll('#title-menu .tm')];
  let tmSel = 0;
  const tmSet = i => { tmSel = (i + TM.length) % TM.length; TM.forEach((b, k) => b.classList.toggle('sel', k === tmSel)); };
  TM.forEach((b, i) => b.addEventListener('pointerenter', () => tmSet(i)));
  tmSet(0);
  function title() {
    hide($('hud'));
    only('title-screen');
    tmSet(tmSel);
    const nNew = META.inventory.filter(it => it.isNew).length;
    $('btn-equip').querySelector('.lbl').innerHTML = _t('装備') + (nNew ? ` <span class="nw-badge">NEW ${nNew}</span>` : '');
    const b = META.best, arena = b.arenaTime ? `ARENA ${fmtTime(b.arenaTime)}` : b.arenaRound ? `ARENA ROUND ${b.arenaRound}/${DATA.arena.rounds}` : '';
    $('title-best').innerHTML = [b.time ? `BEST ${fmtTime(b.time)} · ${b.kills} KILLS · LV ${b.level}` : '', arena].filter(Boolean).join('<br>');
    $('title-rec').classList.toggle('hidden', !$('title-best').innerHTML); // 記録が無ければ飾りの線も出さない
    if (metaMigratedGold) { announce(_t`+${metaMigratedGold.toLocaleString()} G 返金`, _t('永続強化は新しいツリーに移行しました')); metaMigratedGold = 0; }
    if (metaTreeRefund) { announce(_t`+${metaTreeRefund.toLocaleString()} G 返金`, _t('永続ツリーの調整で、なくなったノードを返金しました')); metaTreeRefund = 0; }
  }
  function levelUp(lv, list) { curLv = lv; openChoices(isClassLv(lv) ? 'class' : 'level', list, isClassLv(lv) ? 'CLASS UP!' : 'LEVEL UP!'); }

  // ---------- 設定画面(タイトルとポーズ画面から開く。戻ると開いた画面へ) ----------
  let setBack = 'title';
  function syncSettings() {
    $('vol-music').value = AudioMan.vol.music * 100; $('vol-sfx').value = AudioMan.vol.sfx * 100;
    $('set-fxa').value = Math.round(SET.fxA * 100); $('set-fxa-n').textContent = Math.round(SET.fxA * 100) + '%';
    $('set-ui').value = Math.round(SET.uiMul * 100); $('set-ui-n').textContent = Math.round(SET.uiMul * 100) + '%';
    for (const b of $('set-gfx').children) b.classList.toggle('on', b.dataset.v === SET.gfx);
    for (const k of ['autoE', 'autoQ', 'cutin', 'hints']) for (const b of $('set-' + k).children) b.classList.toggle('on', (b.dataset.v === '1') === SET[k]);
    $('set-lang').value = SET.lang; $('set-lang').disabled = setBack === 'pause'; // ラン中は変えられない
  }
  for (const b of $('set-gfx').children) b.onclick = () => { SET.gfx = b.dataset.v; saveSet(); AudioMan.click(); syncSettings(); };
  for (const k of ['autoE', 'autoQ', 'cutin', 'hints']) for (const b of $('set-' + k).children) b.onclick = () => { SET[k] = b.dataset.v === '1'; saveSet(); AudioMan.click(); syncSettings(); last.skSig = null; };
  // 言語: プルダウン(それぞれの言語の名前)。選んだら保存してページを読み直す
  $('set-lang').innerHTML = Object.keys(LANGS).map(k => `<option value="${k}">${LANGS[k]}</option>`).join('');
  $('set-lang').onchange = e => { if (setBack === 'pause' || e.target.value === SET.lang) return; SET.lang = e.target.value; saveSet(); AudioMan.click(); location.reload(); };
  $('set-fxa').oninput = e => { SET.fxA = e.target.value / 100; $('set-fxa-n').textContent = e.target.value + '%'; saveSet(); };
  $('set-ui').oninput = e => { SET.uiMul = e.target.value / 100; $('set-ui-n').textContent = e.target.value + '%'; applyUiScale(); saveSet(); };
  // 協力プレイのメニューから開いた時は state を 'play' のまま(止まらない。main.js の pauseGame)
  const coopMenu = () => COOP.on && state === 'play';
  function settings(from = 'title') { setBack = from; if (!(from === 'pause' && coopMenu())) state = 'settings'; only('settings-screen'); syncSettings(); }
  function closeSettings() { if (setBack === 'pause') { if (!coopMenu()) state = 'pause'; pause(true); } else { state = 'title'; title(); } }
  $('btn-settings').onclick = () => { AudioMan.click(); settings('title'); };
  $('btn-settings-p').onclick = () => { AudioMan.click(); settings('pause'); };
  $('btn-set-back').onclick = () => { AudioMan.click(); closeSettings(); };

  function pause(on) {
    if (on) {
      only('pause-screen');
      $('pause-title').textContent = COOP.on ? 'MENU' : 'PAUSED'; // 協力プレイは止まらない
      $('pause-note').classList.toggle('hidden', !COOP.on);
      $('pause-build').innerHTML = Object.keys(P.weapons).map(k => icon('weapon', k)).join('');
    } else only(null);
  }
  $('vol-music').oninput = e => AudioMan.setVol('music', e.target.value / 100);
  $('vol-sfx').oninput = e => { AudioMan.setVol('sfx', e.target.value / 100); AudioMan.click(); };

  function result(win, earned, loot, cxp, first = 0) { // first: 初クリアのゴールド(ステージを初めてクリアしたとき)
    only('result-screen');
    hide($('hud'));
    const arena = S.mode === 'arena';
    $('result-title').textContent = win ? (arena ? 'ARENA CLEAR!' : 'VICTORY!') : 'YOU DIED';
    $('result-title').className = win ? 'win' : 'lose';
    $('btn-endless').classList.toggle('hidden', !win || S.mode !== 'escalation'); // エンドレスはエスカレーションのみ
    const rows = [arena ? [_t('撃破ボス'), S.arena.idx + ' / ' + DATA.arena.rounds] : null, S.tower ? [_t('到達した階'), S.tower.top + 'F'] : null, [arena ? _t('タイム') : _t('生存時間'), fmtTime(S.time)], [_t('レベル'), P.level], [_t('撃破数'), P.kills.toLocaleString()], [_t('最大コンボ'), P.bestCombo], [_t('総ダメージ'), Math.round(P.totalDmg).toLocaleString()], [_t('獲得ゴールド'), '● ' + earned], first ? [_t('初クリア報酬'), '● ' + first.toLocaleString()] : null];
    $('result-stats').innerHTML = rows.filter(Boolean).map(([a, b]) => `<div class="rs"><span>${a}</span><b>${b}</b></div>`).join('');
    const tot = Object.values(P.dmgBy).reduce((a, b) => a + b, 0) || 1;
    const list = Object.entries(P.dmgBy).filter(([k]) => DATA.weapons[k]).sort((a, b) => b[1] - a[1]);
    // 獲得した装備(ボスの宝箱 + ラン終了時の報酬)とクラス経験値
    const cl = DATA.classes[P.cls], lvUp = cxp.lv > cxp.lv0;
    $('result-cls').innerHTML = _t`<b style="color:${cl.col}">${cl.name}</b> クラス経験値 +${cxp.xp}` + (lvUp ? ` <em>Lv ${cxp.lv0} → ${cxp.lv}!</em>` : ` <span class="dim">Lv ${cxp.lv}</span>`)
      + (cxp.newCls && cxp.newCls.length ? _t`<div class="unl-new">NEW CLASS! ${cxp.newCls.map(k => `<b style="color:${DATA.classes[k].col}">${DATA.classes[k].name}</b>`).join(_t('・'))} が使えるようになりました(クラス画面で選べます)</div>` : '');
    $('result-loot').innerHTML = (loot.chests ? _t`<div class="dim">ラン終了の報酬: 宝箱 ×${loot.chests}</div>` : '') +
      (P.loot.length ? P.loot.map(it => `<span class="loot" style="--rc:${DATA.equip.rarity[it.rarity].col}">${icon('equip', it.type)}${itemName(it)}</span>`).join('') : _t('<div class="dim">装備の入手なし</div>'));
    $('result-dmg').innerHTML = list.map(([k, v]) => `<div class="dm">${icon('weapon', k)}<div class="dm-bar"><i style="width:${(v / tot * 100).toFixed(1)}%;background:${DATA.weapons[k].col}"></i></div><span>${Math.round(v).toLocaleString()}</span></div>`).join('');
  }

  // ボタン
  $('btn-start').onclick = () => { touchFullscreen(); MetaUI.stageSelect(); };
  // スマホ: ボタンのキーの表示を消し、操作の説明をタッチの言い方にする
  if (TOUCH_UI) {
    for (const b of document.querySelectorAll('.btn')) { const s = b.textContent, n = s.replace(/\s*[(（](ESC|TAB|R|SPACE|Enter)[)）]\s*$/i, ''); if (n !== s) b.textContent = n; }
    document.querySelector('#choice-screen .hint').textContent = _t('タップで選択 ・ 下線の用語をタップすると説明');
    document.querySelector('.tr-zhint').textContent = _t('+ / - で拡大 ・ ドラッグで移動');
  }
  $('btn-resume').onclick = () => resumeGame();
  $('btn-quit').onclick = () => endRun(false);
  $('btn-retry').onclick = () => startRun(S.mode, S.stageNo);
  $('btn-totitle').onclick = () => goTitle();
  $('btn-endless').onclick = () => startEndless();
  $('chest-screen').onclick = chestAct;

  function onKey(e) {
    if (state === 'levelup') {
      if (/^Digit[1-7]$/.test(e.code)) choose(+e.code.slice(5) - 1); // カードは 5枚まで出る(強化ツリーと固有効果の選択枠)
      if (e.code === 'KeyR') reroll();
    } else if (state === 'title') {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') tmSet(tmSel - 1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') tmSet(tmSel + 1);
      else if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) { if (e.preventDefault) e.preventDefault(); TM[tmSel].click(); } // preventDefault: マウスで押した後に focus が残ったボタンを、ブラウザが Enter でもう一度押さないように
    } else if (state === 'chest' && (e.code === 'Space' || e.code === 'Enter')) chestAct();
    else if (state === 'play' && COOP.on && P.lvPick) { // 協力プレイの止まらないレベルアップ
      if (/^Digit[1-7]$/.test(e.code)) coopPick(+e.code.slice(5));
      if (e.code === 'KeyR') coopPick(PICK.reroll);
    }
  }

  // ---------- 協力プレイ: 止まらないレベルアップ(1人の時と同じ画面に出す。時間は止まらない。選んだ物は入力の pick で送り、全員が同じフレームで使う: net.js の coopLevel)----------
  let cpShown = null, cpN = -1, cpSent = null, cpSentF = 0;
  function coopPickHud() {
    const c = COOP.on ? P.lvPick : null, cs = $('choice-screen');
    if (c && cpSent === c && COOP.f - cpSentF > 60) cpShown = null; // 送った物が 1秒(計算のフレーム)たっても届かない時は、出し直して選び直せるように(薄いまま残らないように。入力の遅れは 8フレームまで)
    if (!c) cpShown = null;
    else if (c !== cpShown || c.n !== cpN) {
      cpShown = c; cpN = c.n; cpSent = null;
      $('choice-title').textContent = isClassLv(c.lv) ? 'CLASS UP!' : 'LEVEL UP!';
      $('choice-title').dataset.mode = isClassLv(c.lv) ? 'class' : 'level';
      drawCards(c.list, i => coopPick(i + 1), () => coopPick(PICK.reroll), () => coopPick(PICK.skip), P.rerolls > 0);
      cs.classList.remove('sent');
    }
    // 出すのはプレイ中で、ほかの画面(ステータスなど)が出ていない時だけ(only() が隠すので、閉じたら出し直す)。毎回 DOM と比べる
    if (COOP.on) {
      const want = !!c && state === 'play' && !menuOpen();
      if (want === cs.classList.contains('hidden')) { (want ? show : hide)(cs); if (!want) hideTip(); }
    }
    coopWaitHud();
  }
  // 選んだ物を次の入力で送る(届くまでは同じカードにもう一度は送らない)。届かない物(ないカード・残りのないリロール)は送らない(送ると選べないまま残る)
  function coopPick(k) {
    const c = COOP.on && P.lvPick;
    if (!c || cpSent === c || $('choice-screen').classList.contains('hidden') || (k < PICK.skip && k > c.list.length) || (k === PICK.reroll && P.rerolls <= 0)) return; // 画面が隠れている間(ステータスを開いている時)の数字キーでは選ばない
    keys._pick = k; cpSent = c; cpSentF = COOP.f;
    const card = k < PICK.skip && $('cards').children[k - 1];
    if (card) card.classList.add('picked');
    $('choice-screen').classList.add('sent');
    AudioMan.click();
  }
  // タワーの休憩で、ほかの人がレベルアップを選んでいる間(tower.md #31)
  let cwEl = null, cwText = '';
  function coopWaitHud() {
    if (!cwEl) { cwEl = el('div', 'hidden'); cwEl.id = 'coop-wait'; $('hud').appendChild(cwEl); }
    const T = S.tower, who = COOP.on && T && !T.wave ? players.filter(p => p !== P && !p.left && (p.lvPick || p.pendingLv > 0)) : [];
    const wait = COOP.on && COOP.waitSec >= COOP.warnT ? COOP.waitOn : []; // 入力が届かない人(#3)
    const txt = wait.length ? _t`${wait.map(i => 'P' + (i + 1)).join('・')} の接続を待っています(あと ${Math.max(0, Math.ceil(COOP.dropT - COOP.waitSec))}秒)`
      : COOP.on && P.dead && anyAlive() ? _t('倒れました。次の階の始めに戻ります(観戦中)') : who.length ? _t`${who.map(p => 'P' + (p.pid + 1)).join('・')} がレベルアップを選んでいます(あと ${Math.max(0, Math.ceil(DATA.tower.coopWait - (T.waitT || 0)))}秒)` : '';
    if (txt === cwText) return;
    cwText = txt; cwEl.textContent = txt; cwEl.classList.toggle('hidden', !txt);
  }

  return { announce, skillCut, enrage, banner, toast, hud, bossBar, enemyLvUp, openChest, levelUp, beginPlay: close, only, gold, weaponIcon: k => icon('weapon', k), title, pause, closeSettings, result, onKey, show, hide, shown, menuOpen, $ };
})();
