// coop-ui.js — 協力プレイの部屋の画面(タイトルの「協力プレイ」から。claudedocs/coop.md #10)
//   部屋を作る(6文字のコード)/ コードで入る → 入った人のクラスを並べ、ホストが 2人以上そろったら「開始」(チャレンジタワー)
//   公開ロビー・ネット越しは 6段(Trystero + Supabase)。今の通信は BroadcastChannel(同じブラウザのウィンドウどうし)
//   相手から届いた物(クラス・人数)は net.js で確かめた物だけを、文字として出す(HTML として入れない)
'use strict';
const CoopUI = (() => {
  const $ = id => document.getElementById(id);
  const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 見間違えやすい I・O・0・1 は使わない
  const newCode = () => Array.from({ length: 6 }, () => CODE_CH[NATIVE_RANDOM() * CODE_CH.length | 0]).join('');
  const clsName = k => (DATA.classes[k] ? DATA.classes[k].name : String(k));
  const div = (cls, text) => { const d = document.createElement('div'); d.className = cls; d.textContent = text; return d; };
  function open() {
    if (COOP.on) return;
    $('coop-code').placeholder = _t('コード');
    $('coop-cls').textContent = _t`自分のクラス: ${clsName(META.cls)}(クラス画面で変える)`;
    refresh();
    UI.only('coop-screen');
  }
  // 部屋の中(コード・入った人・開始 / 待ち)。入った・抜けた時に net.js からも呼ぶ
  function refresh() {
    const box = $('coop-room'), inRoom = !!(COOP.room && NET.ch);
    $('coop-join-row').classList.toggle('hidden', inRoom);
    box.classList.toggle('hidden', !inRoom);
    box.textContent = '';
    if (!inRoom) return;
    box.appendChild(div('coop-code-big', _t`部屋のコード ${COOP.room}`));
    const list = div('coop-list', '');
    COOP.members.forEach((m, i) => list.appendChild(div('coop-mem', 'P' + (i + 1) + '  ' + clsName(m.cls) + (m.id === NET.me ? ' ' + _t('(自分)') : ''))));
    if (!COOP.members.length) list.appendChild(div('coop-mem dim', _t('ホストを待っています')));
    box.appendChild(list);
    if (COOP.host) {
      const b = document.createElement('button');
      b.className = 'btn big'; b.textContent = _t('開始'); b.disabled = COOP.members.length < 2;
      b.onclick = () => { AudioMan.click(); coopStart({ mode: 'tower' }); };
      box.appendChild(b);
    } else if (COOP.members.length) box.appendChild(div('coop-mem dim', _t('ホストが開始するのを待っています')));
  }
  function leave() { NET.close(); coopReset(); COOP.room = ''; COOP.members = []; COOP.host = false; }
  $('btn-coop').onclick = () => { AudioMan.click(); open(); };
  $('coop-make').onclick = () => { AudioMan.click(); coopHost(newCode(), META.cls); refresh(); };
  $('coop-enter').onclick = () => {
    const c = ($('coop-code').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (c.length !== 6) { $('coop-code').focus(); return; }
    AudioMan.click(); coopJoin(c, META.cls); refresh();
  };
  $('coop-back').onclick = () => { AudioMan.click(); leave(); UI.title(); };
  return { open, refresh, leave };
})();
