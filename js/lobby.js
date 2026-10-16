// lobby.js — 協力プレイの公開ロビー(claudedocs/coop.md #10・4章): Supabase の Realtime の Presence(つないでいる間だけ載る一覧)
//   載るのは公開の部屋のホストだけ(部屋のコード・ホストのクラス・人数)。見ている人は載らない。ホストが抜ける・始める・4人になると消える
//   チャンネルは版ごと(nocturne-lobby-<GAME_VER>): 違う版の部屋(開発中と公開版も)は見えない
//   載っている物は知らない人が書いた物なので、決まった形の物だけを文字として出す(コードの字・人数 1〜3・クラス。20件まで)
//   Supabase の client はセーブ(localStorage)に触らない・URL を読まない設定で作る
'use strict';
const Lobby = (() => {
  let cl = null, ch = null, st = 'off', tracked = false, onChange = null;
  const key = (NATIVE_RANDOM() * 4294967296 >>> 0).toString(36) + (NATIVE_RANDOM() * 4294967296 >>> 0).toString(36); // 自分の印(自分の部屋は一覧に出さない)
  const CODE = /^[A-HJ-NP-Z2-9]{6}$/; // 部屋のコードの字(coop-ui.js の CODE_CH)
  const changed = () => { if (onChange) onChange(); };
  // 一覧を見始める(協力プレイの画面を開いた時)。cb: 一覧・つながり方が変わった時
  function open(cb) {
    onChange = cb || null;
    if (ch) return changed();
    if (NET.kind !== 'p2p' || typeof P2P === 'undefined' || !P2P.createClient) { st = 'error'; return changed(); }
    try {
      cl = cl || P2P.createClient(NET_CFG.appId, NET_CFG.relayConfig.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      ch = cl.channel('nocturne-lobby-' + GAME_VER, { config: { presence: { key, enabled: true } } });
      ch.on('presence', { event: 'sync' }, changed); // subscribe の前に(受け取りを有効にする)
      st = 'wait';
      ch.subscribe(s => {
        if (s === 'SUBSCRIBED') { st = 'ok'; announce(); } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') st = 'error';
        changed();
      });
    } catch (e) { st = 'error'; ch = null; }
    changed();
  }
  // やめる(協力プレイの画面を出た・ランを始めた)。載せていた部屋も消える
  function close() {
    onChange = null;
    if (ch) { const c = ch; ch = null; cl.removeChannel(c).catch(() => {}); }
    tracked = false; st = 'off';
  }
  // ホスト: 公開の部屋を載せる・人数を直す / 外す(始まる前・4人未満の間だけ)。人が入った・抜けた・始めた・出た時に net.js から
  function announce() {
    if (!ch || st !== 'ok') return;
    const want = COOP.host && COOP.pub && !COOP.on && !!COOP.room && COOP.members.length >= 1 && COOP.members.length < 4;
    if (want) { ch.track({ code: COOP.room, cls: COOP.members[0].cls, n: COOP.members.length }).catch(() => {}); tracked = true; }
    else if (tracked) { ch.untrack().catch(() => {}); tracked = false; }
  }
  // 一覧(確かめた物だけ): [{ code, cls, n }](人数の多い順。自分の部屋は出さない)
  function rooms() {
    if (!ch || st !== 'ok') return [];
    const ps = ch.presenceState(), out = [], seen = new Set();
    for (const k of Object.keys(ps)) {
      if (k === key || out.length >= 20) continue;
      for (const p of Array.isArray(ps[k]) ? ps[k] : []) {
        if (!p || typeof p !== 'object' || typeof p.code !== 'string' || !CODE.test(p.code) || seen.has(p.code) || !Number.isInteger(p.n) || p.n < 1 || p.n > 3) continue;
        seen.add(p.code); out.push({ code: p.code, cls: okCls(p.cls), n: p.n });
        if (out.length >= 20) break;
      }
    }
    return out.sort((a, b) => b.n - a.n || (a.code < b.code ? -1 : 1));
  }
  return { open, close, announce, rooms, get state() { return st; } };
})();
