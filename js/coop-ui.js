// coop-ui.js — 協力プレイの画面(タイトルの「協力プレイ」から。claudedocs/coop.md #10。見本 claudedocs/img/lobby.png)
//   部屋を作る(→ ステージ選択(meta-ui.js の stageSelect の協力プレイの形)で遊ぶステージと、公開(公開ロビーに載る: lobby.js)かコード(6文字)かを選ぶ → 部屋)
//   / コードで参加 / 公開の部屋の一覧から入る / 自分のクラスを押すとクラス画面(部屋の外だけ)
//   → 部屋の中: 左に部屋の札(モード・コード・入力の遅れ・開始 / 待ち)、右に入った人(P1〜P4・クラス・往復時間)。ホストが 2人以上そろったら「開始」(部屋のモード COOP.mode。入力の遅れは net.js の coopAutoLag)
//   通信は net.js の NET(Trystero の P2P。仲介は Supabase。?net=bc で同じブラウザのウィンドウどうし)
//   相手から届いた物(クラス・人数・モード)は net.js・lobby.js で確かめた物だけを、文字として出す(HTML として入れない)
'use strict';
const CoopUI = (() => {
  const $ = id => document.getElementById(id);
  const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 見間違えやすい I・O・0・1 は使わない(lobby.js の CODE と同じ字)
  const newCode = () => Array.from({ length: 6 }, () => CODE_CH[NATIVE_RANDOM() * CODE_CH.length | 0]).join('');
  const clsName = k => (DATA.classes[k] ? DATA.classes[k].name : String(k));
  const modeName = k => (k === 'escalation' ? _t('エスカレーション') : _t('チャレンジタワー')); // 部屋のモード(net.js の okMode で確かめた物)
  const faces = new Map(); // クラスの絵(公開の一覧は届くたびに作り直すので覚えておく)
  const face = k => { if (!faces.has(k)) faces.set(k, MetaUI.portrait(k)); return faces.get(k); };
  // 要素を作る(文字は textContent で入れる)
  const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; };
  // クラスの絵を丸い台に載せる(台の色はクラスの色)
  const faceEl = k => { const f = el('span', 'cp-face'), i = el('img'); i.src = face(k); i.alt = ''; f.appendChild(i); if (DATA.classes[k]) f.style.setProperty('--cc', DATA.classes[k].col); return f; };
  // 札の見出し(印・題・右の数)
  const head = (box, ic, title, right) => { const h = el('h3', null, title); h.insertAdjacentHTML('afterbegin', ART.uiIcon(ic)); if (right) h.appendChild(el('span', 'ui-cnt', right)); box.appendChild(h); };
  const inRoom = () => !!(COOP.room && NET.isOpen);
  let noRtc = false;
  // 知らせ(入れなかった・ホストが閉じた・WebRTC が無い)。次に部屋を作る・入る・開くまで出す
  function say(text) {
    $('coop-msg').textContent = text || '';
    $('coop-msg').classList.toggle('hidden', !text);
    refresh();
  }
  function open() {
    if (COOP.on) return;
    noRtc = NET.kind === 'p2p' && typeof RTCPeerConnection === 'undefined'; // WebRTC の無いブラウザ
    $('coop-make').disabled = $('coop-enter').disabled = noRtc;
    if (!noRtc) Lobby.open(pubList);
    say(noRtc ? _t('このブラウザでは協力プレイができません(WebRTC がない)') : '');
    state = 'coop'; // タイトルのキー(↑↓・Enter)を効かせない
    UI.only('coop-screen');
  }
  // 自分のクラス(右上)。押すとクラス画面へ。部屋の中では変えない(入った時のセーブで遊ぶ: net.js の coopKit)
  function meCard() {
    const b = $('coop-cls'), c = DATA.classes[META.cls], m = META.classes[META.cls], on = inRoom();
    b.textContent = '';
    b.appendChild(faceEl(META.cls));
    const t = el('span', 'cp-me-t');
    t.appendChild(el('small', null, _t('自分のクラス')));
    t.appendChild(el('b', null, c.name));
    t.appendChild(el('small', null, 'Lv' + m.lv + ' · ' + DATA.weapons[m.weapon].name));
    b.appendChild(t);
    if (!on) b.appendChild(el('span', 'cp-me-go', _t('変更 ▶')));
    b.disabled = on;
  }
  // 画面を今の状態に(部屋の外: 部屋を作る・コードで参加・公開の部屋 / 部屋の中: 部屋の札・入った人)。入った・抜けた時に net.js からも呼ぶ
  function refresh() {
    const on = inRoom();
    meCard();
    for (const id of ['cp-make-card', 'cp-code-card', 'coop-pub']) $(id).classList.toggle('hidden', on);
    for (const id of ['coop-room', 'coop-mems']) $(id).classList.toggle('hidden', !on);
    $('coop-back').querySelector('.lbl').textContent = on ? _t('部屋を出る') : _t('戻る'); // 部屋を出ると一覧に戻る
    pubList();
    if (!on) return;
    roomCard(); memCard(); tick();
  }
  // 部屋の札(左)
  function roomCard() {
    const box = $('coop-room');
    box.textContent = '';
    head(box, 'gate', COOP.host || COOP.members.length ? modeName(COOP.mode) : _t('部屋')); // 参加者は部屋の並びが届くまでモードを知らない
    if (COOP.host) box.appendChild(el('span', 'cp-tag' + (COOP.pub ? ' pub' : ''), COOP.pub ? _t('公開の部屋') : _t('コードの部屋')));
    box.appendChild(el('label', null, _t('部屋のコード')));
    box.appendChild(el('div', 'cp-code', COOP.room));
    if (COOP.host) box.appendChild(el('p', null, _t('このコードを伝えると、ほかの人も入れる')));
    box.appendChild(el('div', 'coop-lag', ''));
    if (COOP.host) {
      const b = el('button', 'ui-btn gold ui-frame', _t('開始'));
      b.disabled = COOP.members.length < 2;
      b.onclick = () => { AudioMan.click(); coopStart(); };
      box.appendChild(b);
      if (COOP.members.length < 2) box.appendChild(el('div', 'cp-wait', _t('2人以上で開始できる')));
    } else box.appendChild(el('div', 'cp-wait', COOP.members.length ? _t('ホストが開始するのを待っています') : _t('ホストを待っています')));
  }
  // 入った人(右): P1〜P4 の 4つの枠
  function memCard() {
    const box = $('coop-mems');
    box.textContent = '';
    head(box, 'party', _t('メンバー'), COOP.members.length + ' / 4');
    const list = el('div', 'cp-list');
    for (let i = 0; i < 4; i++) {
      const m = COOP.members[i], row = el('div', 'cp-slot' + (m ? '' : ' empty'));
      row.style.setProperty('--pc', PL_COL[i]);
      row.appendChild(el('span', 'cp-pn', 'P' + (i + 1)));
      if (m) {
        row.appendChild(faceEl(m.cls));
        row.appendChild(el('span', 'cp-nm', clsName(m.cls)));
        if (i === 0) row.appendChild(el('span', 'cp-badge', _t('ホスト')));
        if (m.id === NET.me) row.appendChild(el('span', 'cp-badge me', _t('自分')));
        else { const r = el('span', 'coop-rtt'); r.dataset.id = m.id; row.appendChild(r); }
      } else row.appendChild(el('span', 'cp-nm', _t('空き')));
      list.appendChild(row);
    }
    box.appendChild(list);
  }
  // 往復時間の数字・注意(#3)・入力の遅れの見込み(#1)を書き換える(net.js が 0.25秒ごとに呼ぶ)
  function tick() {
    if (!inRoom()) return;
    for (const r of $('coop-mems').querySelectorAll('.coop-rtt')) { const v = coopRttTo(r.dataset.id); r.textContent = v === null ? '…' : Math.round(v) + 'ms'; }
    const lag = $('coop-room').querySelector('.coop-lag');
    if (!lag) return;
    let txt = '', warn = false;
    if (COOP.host) { if (COOP.members.length > 1) { const L = coopAutoLag(); txt = _t`入力の遅れ ${L}フレーム(約 ${Math.round(L * 1000 / 60)}ms)`; } }
    else {
      const v = COOP.hostId ? coopRttTo(COOP.hostId) : null;
      if (v !== null && v > 230) { txt = _t`ホストとの往復 ${Math.round(v)}ms: 止まりやすい(入力が届くまで全員が待ちます)`; warn = true; }
      else if (v !== null && v > 130) { txt = _t`ホストとの往復 ${Math.round(v)}ms: 遅れが大きいので操作が遅れます`; warn = true; }
    }
    lag.textContent = txt; lag.classList.toggle('warn', warn);
  }
  // 公開の部屋の一覧(右。部屋の外にいる間)。一覧が変わった時に lobby.js からも呼ぶ(部屋の中では触らない)
  function pubList() {
    const box = $('coop-pub');
    if (inRoom()) return;
    box.textContent = '';
    const st = noRtc ? 'error' : Lobby.state, rs = st === 'ok' ? Lobby.rooms() : [];
    head(box, 'party', _t('公開の部屋'), st === 'ok' ? _t`${rs.length}件` : '');
    const list = el('div', 'cp-list');
    box.appendChild(list);
    const empty = (main, sub, door) => {
      const e = el('div', 'cp-empty');
      if (door) e.insertAdjacentHTML('afterbegin', ART.uiIcon('door'));
      e.appendChild(el('b', null, main));
      if (sub) e.appendChild(el('span', null, sub));
      list.appendChild(e);
    };
    if (st === 'error' || st === 'off') return empty(_t('公開の部屋の一覧を取れません(コードの部屋は使えます)'));
    if (st !== 'ok') return empty(_t('公開の部屋を探しています…'));
    if (!rs.length) return empty(_t('公開中の部屋はありません'), _t('部屋を作って仲間を募集しよう'), true);
    for (const r of rs) {
      const row = el('div', 'cp-room'), t = el('span', 'cp-rt'), b = el('button', 'ui-btn small ui-frame', _t('入る'));
      row.appendChild(faceEl(r.cls));
      t.appendChild(el('b', null, _t`${clsName(r.cls)} の部屋`));
      t.appendChild(el('small', null, modeName(r.mode)));
      row.appendChild(t);
      row.appendChild(el('span', 'cp-n', r.n + ' / 4'));
      b.onclick = () => { AudioMan.click(); say(''); coopJoin(r.code, META.cls); refresh(); };
      row.appendChild(b);
      list.appendChild(row);
    }
  }
  function leave() { coopQuit(); }
  // 部屋を作る(ステージ選択で選んだ時に meta-ui.js から): mode = 遊ぶモード / pub = 公開ロビーに載せるか
  function create(mode, pub) {
    say('');
    coopHost(newCode(), META.cls, 0, pub, mode);
    open();
  }
  // 戻る: 部屋の中なら部屋を出て一覧へ、外ならタイトルへ
  function back() {
    if (inRoom()) { leave(); refresh(); return; }
    leave(); Lobby.close(); state = 'title'; UI.title();
  }
  function onKey(e) { if (state === 'coop' && e.code === 'Escape') { AudioMan.click(); back(); } }
  $('btn-coop').onclick = () => { AudioMan.click(); open(); };
  $('coop-make').onclick = () => { AudioMan.click(); MetaUI.stageSelect(false, true); };
  $('coop-cls').onclick = () => { if (inRoom()) return; AudioMan.click(); MetaUI.classScreen('coop'); };
  $('coop-enter').onclick = () => {
    const c = ($('coop-code').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (c.length !== 6) { $('coop-code').focus(); return; }
    AudioMan.click(); say(''); coopJoin(c, META.cls); refresh();
  };
  $('coop-code').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('coop-enter').click(); } }); // コードを打って Enter で参加
  $('coop-back').onclick = () => { AudioMan.click(); back(); };
  return { open, create, refresh, tick, leave, say, onKey };
})();
