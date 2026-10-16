// coop-ui.js — 協力プレイの部屋の画面(タイトルの「協力プレイ」から。claudedocs/coop.md #10)
//   部屋を作る(→ ステージ選択(meta-ui.js の stageSelect の協力プレイの形)で遊ぶステージと、公開(公開ロビーに載る: lobby.js)かコード(6文字)かを選ぶ → 部屋)
//   / コードで入る / 公開の部屋の一覧から入る
//   → 入った人のクラスと往復時間を並べ、ホストが 2人以上そろったら「開始」(部屋のモード COOP.mode。入力の遅れは net.js の coopAutoLag)
//   通信は net.js の NET(Trystero の P2P。仲介は Supabase。?net=bc で同じブラウザのウィンドウどうし)
//   相手から届いた物(クラス・人数)は net.js・lobby.js で確かめた物だけを、文字として出す(HTML として入れない)
'use strict';
const CoopUI = (() => {
  const $ = id => document.getElementById(id);
  const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 見間違えやすい I・O・0・1 は使わない(lobby.js の CODE と同じ字)
  const newCode = () => Array.from({ length: 6 }, () => CODE_CH[NATIVE_RANDOM() * CODE_CH.length | 0]).join('');
  const clsName = k => (DATA.classes[k] ? DATA.classes[k].name : String(k));
  const modeName = k => (k === 'escalation' ? _t('エスカレーション') : _t('チャレンジタワー')); // 部屋のモード(net.js の okMode で確かめた物)
  const div = (cls, text) => { const d = document.createElement('div'); d.className = cls; d.textContent = text; return d; };
  const inRoom = () => !!(COOP.room && NET.isOpen);
  let msgEl = null;
  // 知らせ(入れなかった・ホストが閉じた)。次に部屋を作る・入る・開くまで出す
  function say(text) {
    if (!msgEl) { msgEl = div('coop-mem dim', ''); $('coop-room').after(msgEl); }
    msgEl.textContent = text || '';
    refresh();
  }
  function open() {
    if (COOP.on) return;
    say('');
    $('coop-code').placeholder = _t('コード');
    $('coop-cls').textContent = _t`自分のクラス: ${clsName(META.cls)}(クラス画面で変える)`;
    const noRtc = NET.kind === 'p2p' && typeof RTCPeerConnection === 'undefined'; // WebRTC の無いブラウザ
    $('coop-make').disabled = $('coop-enter').disabled = noRtc;
    $('coop-cls').textContent += noRtc ? ' / ' + _t('このブラウザでは協力プレイができません(WebRTC がない)') : '';
    if (!noRtc) Lobby.open(pubList);
    refresh();
    state = 'coop'; // タイトルのキー(↑↓・Enter)を効かせない
    UI.only('coop-screen');
  }
  // 部屋の中(コード・入った人・往復時間・開始 / 待ち)。入った・抜けた時に net.js からも呼ぶ。往復時間の数字は tick で書き換える
  function refresh() {
    const box = $('coop-room'), on = inRoom();
    $('coop-join-row').classList.toggle('hidden', on);
    box.classList.toggle('hidden', !on);
    box.textContent = '';
    $('coop-back').textContent = on ? _t('部屋を出る') : _t('戻る'); // 部屋を出ると協力プレイの画面(一覧)に戻る
    pubList();
    if (!on) return;
    if (COOP.host || COOP.members.length) box.appendChild(div('coop-mode', modeName(COOP.mode))); // 参加者は部屋の並びが届いてから
    box.appendChild(div('coop-code-big', (COOP.pub ? _t('公開の部屋') + '  ' : '') + _t`部屋のコード ${COOP.room}`));
    const list = div('coop-list', '');
    COOP.members.forEach((m, i) => {
      const row = div('coop-mem', 'P' + (i + 1) + '  ' + clsName(m.cls) + (m.id === NET.me ? ' ' + _t('(自分)') : ''));
      if (m.id !== NET.me) { const r = document.createElement('span'); r.className = 'coop-rtt'; r.dataset.id = m.id; row.appendChild(r); }
      list.appendChild(row);
    });
    if (!COOP.members.length) list.appendChild(div('coop-mem dim', _t('ホストを待っています')));
    box.appendChild(list);
    box.appendChild(div('coop-mem coop-lag', ''));
    if (COOP.host) {
      const b = document.createElement('button');
      b.className = 'btn big'; b.textContent = _t('開始'); b.disabled = COOP.members.length < 2;
      b.onclick = () => { AudioMan.click(); coopStart(); };
      box.appendChild(b);
    } else if (COOP.members.length) box.appendChild(div('coop-mem dim', _t('ホストが開始するのを待っています')));
    tick();
  }
  // 往復時間の数字・注意(#3)・入力の遅れの見込み(#1)を書き換える(net.js が 0.25秒ごとに呼ぶ)
  function tick() {
    if (!inRoom()) return;
    for (const r of $('coop-room').querySelectorAll('.coop-rtt')) { const v = coopRttTo(r.dataset.id); r.textContent = v === null ? '  …' : '  ' + Math.round(v) + 'ms'; }
    const el = $('coop-room').querySelector('.coop-lag');
    if (!el) return;
    let txt = '', warn = false;
    if (COOP.host) { if (COOP.members.length > 1) { const L = coopAutoLag(); txt = _t`入力の遅れ ${L}フレーム(約 ${Math.round(L * 1000 / 60)}ms)`; } }
    else {
      const v = COOP.hostId ? coopRttTo(COOP.hostId) : null;
      if (v !== null && v > 230) { txt = _t`ホストとの往復 ${Math.round(v)}ms: 止まりやすい(入力が届くまで全員が待ちます)`; warn = true; }
      else if (v !== null && v > 130) { txt = _t`ホストとの往復 ${Math.round(v)}ms: 遅れが大きいので操作が遅れます`; warn = true; }
    }
    el.textContent = txt; el.classList.toggle('warn', warn);
  }
  // 公開の部屋の一覧(部屋の外にいる間だけ)。一覧が変わった時に lobby.js からも呼ぶ
  function pubList() {
    const box = $('coop-pub');
    if (!box) return;
    box.textContent = '';
    const show = !inRoom() && Lobby.state !== 'off'; // 協力プレイの画面を開いている間(open で見始め、戻る・開始でやめる)
    box.classList.toggle('hidden', !show);
    if (!show) return;
    box.appendChild(div('coop-pub-h', _t('公開の部屋')));
    const st = Lobby.state, rs = Lobby.rooms();
    if (st === 'error') return box.appendChild(div('coop-mem dim', _t('公開の部屋の一覧を取れません(コードの部屋は使えます)')));
    if (st !== 'ok') return box.appendChild(div('coop-mem dim', _t('公開の部屋を探しています…')));
    if (!rs.length) return box.appendChild(div('coop-mem dim', _t('公開の部屋はありません')));
    for (const r of rs) {
      const row = div('coop-pub-row', _t`${modeName(r.mode)} ・ ${clsName(r.cls)} の部屋  ${r.n} / 4`), b = document.createElement('button');
      b.className = 'btn'; b.textContent = _t('入る');
      b.onclick = () => { AudioMan.click(); say(''); coopJoin(r.code, META.cls); refresh(); };
      row.appendChild(b); box.appendChild(row);
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
  $('coop-enter').onclick = () => {
    const c = ($('coop-code').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (c.length !== 6) { $('coop-code').focus(); return; }
    AudioMan.click(); say(''); coopJoin(c, META.cls); refresh();
  };
  $('coop-back').onclick = () => { AudioMan.click(); back(); };
  return { open, create, refresh, tick, leave, say, onKey };
})();
