// net.js — 協力プレイの通信とロックステップ(claudedocs/coop.md 1章・4章・7章 4段)
//   全員が同じ計算をし、送り合うのは計算 1回ぶんの入力の記録(core.js の readInput)だけ。全員分がそろったフレームから計算する
'use strict';

// ============================================================
// 通信の窓口(NET): 送る・受け取る・入った・抜けただけ。中身は 2つから選ぶ
//   p2p: Trystero(js/vendor/p2p.js。Supabase の Realtime で仲介し、部屋の全員が WebRTC で直接つなぐ。coop.md 4章)
//   bc: BroadcastChannel(同じブラウザのほかのウィンドウだけ。開発・試験の道具。URL に ?net=bc)
//   送ってきた人(from)は通信の側が付けた ID を使い、中身の from は信じない。中身は COOP の側で形と範囲を確かめてから使う(コードとして動かさない)
//   send(msg, to): to を付けるとその人だけへ(bc は全員に届くので、中身の to で自分宛てでない物を捨てる)
// ============================================================
//   Supabase のプロジェクト(公開キー: ブラウザのコードに入れて公開する前提のキー。表は作らず、仲介の Realtime だけに使う)
const NET_CFG = { appId: 'https://onpbbaahinguyjauzrpj.supabase.co', relayConfig: { supabaseKey: 'sb_publishable_ZzuhMKY4wtk2zn7xXTuolQ_qrSKrZhL' } };
const NET = {
  kind: new URLSearchParams(location.search).get('net') === 'bc' || typeof P2P === 'undefined' ? 'bc' : 'p2p',
  me: '', ch: null, room: null, act: null,
  // onMsg(m): m.from は送ってきた人 / onPeer(id, joined): 相手がつながった・切れた(p2p だけ)
  open(room, onMsg, onPeer) {
    this.close();
    const ok = (m, from) => { if (m && typeof m === 'object' && !Array.isArray(m) && typeof m.t === 'string' && typeof from === 'string' && from !== this.me && (m.to === undefined || m.to === this.me)) onMsg(Object.assign({}, m, { from })); };
    if (this.kind === 'p2p') {
      this.me = P2P.selfId;
      this.room = P2P.joinRoom(NET_CFG, 'nocturne-' + room);
      this.act = this.room.makeAction('m');
      this.act.onMessage = (data, meta) => ok(data, meta && meta.peerId);
      this.room.onPeerJoin = id => onPeer && onPeer(id, true);
      this.room.onPeerLeave = id => onPeer && onPeer(id, false);
    } else {
      this.me = (NATIVE_RANDOM() * 4294967296 >>> 0).toString(36) + (NATIVE_RANDOM() * 4294967296 >>> 0).toString(36);
      this.ch = new BroadcastChannel('nocturne-coop-' + room);
      this.ch.onmessage = e => ok(e.data, e.data && e.data.from);
    }
  },
  send(msg, to) {
    const m = to ? Object.assign({}, msg, { to }) : msg;
    if (this.act) this.act.send(m, to ? { target: to } : undefined).catch(() => {}); // Trystero: send(data, { target })
    else if (this.ch) this.ch.postMessage(Object.assign({}, m, { from: this.me }));
  },
  close() {
    if (this.room) { this.room.leave().catch(() => {}); this.room = null; this.act = null; }
    if (this.ch) { this.ch.close(); this.ch = null; }
  },
  get isOpen() { return !!(this.room || this.ch); },
};

// ============================================================
// 協力プレイのセッション(COOP)
//   部屋: ホストが coopHost、ほかの人が coopJoin。ホストが coopStart で「開始」を送り、全員が同じ種でランを始める(players はホストが決めた順)
//   毎フレーム: 自分の入力を lag フレーム先の分として送る → 全員分がそろったフレームを計算する(そろわなければ待つ)
//   60フレームごとに状態のハッシュを送り合い、違えば「同期がずれました」で止める(#4)
//   計算の間の P はどの人の画面でもホスト(players[0])。計算の外の P は自分(players[COOP.pid])
// ============================================================
const COOP = {
  on: false, host: false, room: '', pid: 0, lag: 4, f: 0, hostId: '', // hostId: 参加者が知っているホストの ID(並び・開始はこの人からだけ受ける)
  members: [], // [{ id, cls, vw, vh, kit }](0 番がホスト。kit: その人のセーブのうちステータスに要る物。coopKit で確かめた物)
  want: 0, // ホスト: この人数がそろったら自分で開始する(URL の n)
  inq: new Map(), // フレーム → 入力の記録の配列(players の順)
  sentTo: -1, // 自分の入力を送った一番先のフレーム
  hashes: new Map(), // フレーム → 人ごとのハッシュ
  log: [], // 自分の [フレーム, ハッシュ](試験の道具が比べる)
  desync: null, stalls: 0,
  manual: false, // 試験: 画面のフレームで進めない(COOP.pump で進める)
  testInput: null, // 試験: (f, pid) => 入力の記録(決まった入力)
  otherFx: 0.3, // ほかの人の攻撃の演出の濃さ(自分の「攻撃の濃さ」の設定に掛ける。#21)
  // 抜けた人(#3・#12): 入力が届かないと全員が待つ。warnT 秒で「接続を待っています」、dropT 秒か、切れた・bye で「抜けた」と思い(suspect)、
  //   決める人(自分から見て、抜けていない人のうち一番小さい番号)が全員に「どのフレームから外すか」を聞いて決め(query → drop)、全員がそのフレームから外す(gone)
  warnT: 3, dropT: 15,
  waitF: -1, waitFrom: 0, waitOn: [], waitSec: 0, // 今のフレームで入力を待っている人・待った秒(画面に出す)
  past: new Map(), // 計算したフレーム → 入力の並び(最近 120フレーム。外す時に、ほかの人へ抜けた人の入力を渡すため)
  gone: new Map(), // 外した人(全員で同じ): 番号 → 外すフレーム D(D からは入力なし・倒れた扱いで戻らない)
  suspect: new Set(), // 自分が「抜けた」と思った人(まだ外していない)
  query: null, // 決める人: 外す人の入力を集めている途中 { x, t, ans: 番号 → { f: その人の今のフレーム, have: [[フレーム, 入力]] } }
  hello: null, // 参加者: 名乗る(ホストとつながるたびに)
  pub: false, // ホスト: 公開の部屋(公開ロビーに載せる。lobby.js)
  mode: 'tower', // 部屋のモード(ホストが部屋を作る時にステージ選択で決める。参加者は部屋の並び lobby で知る)
  rtt: new Map(), // 往復時間(始まる前): 相手の ID → 最近の往復 ms(#1・#3)
  worst: new Map(), // ホスト: 参加者の ID → その人が測った一番遅い相手の往復(95%)
  rttN: 0,
};
// ゲームの版(coop.md 4章「版の確認」): ビルドした版はファイル名のハッシュ(js/game.<hash>.js)、開発中は 'dev'。違う人は部屋に入れない
const GAME_VER = (() => { const s = document.currentScript && document.currentScript.src, m = s && /game\.([0-9a-f]+)\.js/.exec(s); return m ? m[1] : 'dev'; })();
const COOP_CLASSES = () => DATA.classOrder;
// 協力プレイで遊べるモード(部屋を作る時のステージ選択に出す物)。届いた物はこの中の物だけにする(知らない物は先頭)
//   escalation は試験の道具だけが coopStart({ mode }) で使う(部屋のモードにはしない)
const COOP_MODES = ['tower'];
const okMode = m => (COOP_MODES.includes(m) ? m : COOP_MODES[0]);

function coopReset() {
  Object.assign(COOP, { on: false, f: 0, sentTo: -1, desync: null, stalls: 0, log: [], hostId: '', query: null, waitF: -1, waitFrom: 0, waitOn: [], waitSec: 0 });
  COOP.inq.clear(); COOP.hashes.clear(); COOP.past.clear(); COOP.gone.clear(); COOP.suspect.clear(); COOP.rtt.clear(); COOP.worst.clear();
}
// 部屋を出る(始まる前。部屋の画面の「戻る」・入れなかった時)。ほかの人には bye
function coopQuit() {
  if (NET.isOpen) NET.send({ t: 'bye' });
  NET.close(); coopReset();
  Object.assign(COOP, { room: '', members: [], host: false, hello: null, pub: false, mode: COOP_MODES[0] });
  if (typeof Lobby !== 'undefined') Lobby.announce(); // 公開ロビーから外す
}
// 部屋の並びを送る(ホスト。キットは「開始」で送るので入れない)
function coopLobby() {
  NET.send({ t: 'lobby', ver: GAME_VER, mode: COOP.mode, members: COOP.members.map(({ kit, ...x }) => x) });
  if (typeof Lobby !== 'undefined') Lobby.announce(); // 公開の部屋: 人数を直す(4人で外す)
  if (typeof CoopUI !== 'undefined') CoopUI.refresh();
}
// 相手がつながった・切れた(p2p)。切れたのと bye は同じ扱い
function coopOnPeer(id, joined) {
  if (joined) { if (!COOP.host && !COOP.on && COOP.hello) COOP.hello(); return; } // つながった人ごとに名乗る(ホストだけが受ける)
  coopPeerGone(id);
}
function coopPeerGone(id) {
  const i = COOP.members.findIndex(x => x.id === id);
  if (i < 0) return;
  if (COOP.on) coopSuspect(i);
  else if (COOP.host) { COOP.members.splice(i, 1); coopLobby(); }
  else if (i === 0) { coopQuit(); if (typeof CoopUI !== 'undefined') CoopUI.say(_t('ホストが部屋を閉じました')); }
}
// 部屋を作る(ホスト)。n: この人数がそろったら開始する(省略で coopStart を呼ぶまで待つ)/ pub: 公開ロビーに載せる / mode: 遊ぶモード(COOP_MODES)
function coopHost(room, cls = META.cls, n = 0, pub = false, mode = COOP_MODES[0]) {
  coopReset();
  Object.assign(COOP, { host: true, room: String(room), want: n | 0, pub: !!pub, mode: okMode(mode) });
  NET.open(COOP.room, coopOnMsg, coopOnPeer);
  COOP.members = [{ id: NET.me, cls, vw: GFX.VW, vh: GFX.VH, kit: coopKit(META) }];
  if (typeof Lobby !== 'undefined') Lobby.announce();
  console.info('COOP: 部屋 ' + COOP.room + ' を作った。ほかのウィンドウで ?coop=join&room=' + COOP.room + ' を開き、そろったら coopStart()');
}
// 部屋に入る
function coopJoin(room, cls = META.cls) {
  coopReset();
  Object.assign(COOP, { host: false, room: String(room), members: [], mode: COOP_MODES[0] });
  const kit = coopKit(META); // 入った時のセーブ(この後にクラス画面で変えた物は届かない)
  COOP.hello = () => NET.send({ t: 'join', ver: GAME_VER, cls, vw: GFX.VW, vh: GFX.VH, kit });
  NET.open(COOP.room, coopOnMsg, coopOnPeer); // p2p: つながった人ごとに名乗る
  COOP.hello(); // bc: すぐ届く
  console.info('COOP: 部屋 ' + COOP.room + ' に入る');
}
// 開始(ホスト): 種・モード(部屋のモード。o.mode があればそれ)・入力の遅れ(o.lag か、往復時間から coopAutoLag)・全員の並び・計算用の画面の大きさ(全員の一番大きい窓。#16)を送り、自分も始める
function coopStart(o = {}) {
  if (!COOP.host || COOP.on) return;
  const ms = COOP.members, mode = o.mode === 'escalation' ? 'escalation' : okMode(o.mode || COOP.mode);
  const m = { t: 'start', seed: NATIVE_RANDOM() * 4294967296 >>> 0, mode, stage: o.stage || 1, lag: o.lag || coopAutoLag(), members: ms,
    view: { w: Math.max(...ms.map(x => x.vw)), h: Math.max(...ms.map(x => x.vh)) }, chaos: coopChaos(chaosSetting(mode), mode) }; // カオス強化はホストの設定
  NET.send(m);
  coopBegin(m);
}
const okCls = c => (typeof c === 'string' && COOP_CLASSES().includes(c) ? c : 'knight');
const okView = (v, d) => (typeof v === 'number' && isFinite(v) ? clamp(Math.round(v), 200, 1200) : d);
const ownKey = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); // DATA にある名前か(__proto__ などを通さない)
// キット: セーブのうちステータスに要る物(クラスLv・選んだ武器・強化ツリー・装備中の 3つ。stats.js の K)を、決まった形に作り直す
//   自分のセーブ(META)にも、届いた物にも同じ物を使う。全員が同じ物から同じキットを作るよう、ホストも自分の分をこれで作った物を使う(何度通しても同じ)
//   名前は DATA にある物だけ・数は範囲の中に直す・知らない物は捨てる(無い人は Lv1・ツリーなし・装備なし)。セーブの改変は防げない(coop.md 5章)
const KIT_V = 3, KIT_MAXLV = 20; // 装備のロール値の上限(範囲の最大 × KIT_V。装備ロール上限の分の余り)/ オプションの最大Lv の上限
function coopKit(x) {
  const o = x && typeof x === 'object' ? x : {}, src = o.classes && typeof o.classes === 'object' ? o.classes : {};
  const top = DATA.classLevel.need.length + 1, mains = DATA.classOrder.map(k => DATA.classes[k].weapon).filter(Boolean);
  const classes = {};
  for (const k of Object.keys(DATA.classes)) {
    const c = ownKey(src, k) && src[k] && typeof src[k] === 'object' ? src[k] : {}, C = DATA.classes[k], def = C.weapon || C.startW;
    const lv = Number.isInteger(c.lv) ? clamp(c.lv, 1, top) : 1;
    const swap = !C.weapon || !!sumLvFx(C.lv, lv).swap; // クラス画面と同じ: 専用武器が無いか、Lv で切り替えが解放
    classes[k] = { lv, weapon: c.weapon === def || (swap && mains.includes(c.weapon)) ? c.weapon : def };
  }
  const tree = [...new Set((Array.isArray(o.tree) ? o.tree : []).filter(id => ownKey(TREE, id)))];
  const inv = Array.isArray(o.inventory) ? o.inventory : [], lo = o.loadout && typeof o.loadout === 'object' ? o.loadout : {};
  const loadout = {}, inventory = [];
  for (const slot in DATA.equip.slots) {
    const id = ownKey(lo, slot) ? lo[slot] : null, g = coopItem(id != null ? inv.find(v => v && v.id === id) : null, slot);
    loadout[slot] = g ? (g.id = inventory.length + 1) : null;
    if (g) inventory.push(g);
  }
  return { classes, tree, loadout, inventory };
}
function coopItem(it, slot) {
  if (!it || typeof it !== 'object' || !ownKey(DATA.equip.types, it.type) || DATA.equip.types[it.type].slot !== slot || !ownKey(DATA.equip.rarity, it.rarity)) return null;
  const T = DATA.equip.types[it.type].opts, opts = [];
  for (const p of Array.isArray(it.opts) ? it.opts : []) {
    if (!p || typeof p !== 'object' || !ownKey(T, p.k) || opts.some(q => q.k === p.k) || typeof p.v !== 'number' || !isFinite(p.v) || !Number.isInteger(p.max)) continue;
    const v = clamp(p.v, 0, T[p.k][1] * KIT_V);
    opts.push({ k: p.k, v: v === 0 ? 0 : v, max: clamp(p.max, 0, KIT_MAXLV) });
  }
  return { id: 0, type: it.type, rarity: it.rarity, opts, uq: ownKey(DATA.uniques, it.uq) && DATA.uniques[it.uq].slot === slot ? it.uq : null };
}
// カオス強化の設定(ホストの物を「開始」で送る): そのモードの項目だけ、Lv は 0〜最大の整数
function coopChaos(x, ck) {
  const o = x && typeof x === 'object' ? x : {}, out = {};
  for (const m of chaosMods(ck)) { const v = ownKey(o, m.k) ? o[m.k] : 0; out[m.k] = Number.isInteger(v) ? clamp(v, 0, m.max) : 0; }
  return out;
}
function coopOnMsg(m) {
  switch (m.t) {
    case 'join': { // ホストだけ受ける(始まる前・4人まで・同じ版。入れない時は理由をその人へ)
      if (!COOP.host || COOP.members.some(x => x.id === m.from)) return;
      const why = COOP.on ? 'started' : COOP.members.length >= 4 ? 'full' : m.ver !== GAME_VER ? 'ver' : '';
      if (why) { NET.send({ t: 'deny', why }, m.from); return; }
      COOP.members.push({ id: m.from, cls: okCls(m.cls), vw: okView(m.vw, 480), vh: okView(m.vh, 270), kit: coopKit(m.kit) });
      coopLobby();
      console.info('COOP: ' + COOP.members.length + '人');
      if (COOP.want && COOP.members.length >= COOP.want) coopStart();
      return;
    }
    case 'deny': // 参加者: 入れなかった
      if (COOP.host || COOP.on || (COOP.hostId && COOP.hostId !== m.from)) return;
      coopQuit();
      if (typeof CoopUI !== 'undefined') CoopUI.say(m.why === 'ver' ? _t('ゲームの版が違うので入れません(ページを読み直してください)') : m.why === 'full' ? _t('部屋がいっぱいです(4人まで)') : _t('もう始まっています'));
      return;
    case 'bye': coopPeerGone(m.from); return;
    // 往復時間(始まる前): ping にはその人へ pong を返す。参加者はホストへ「自分が測った一番遅い相手」を送る(rtt)
    case 'ping': if (!COOP.on && typeof m.s === 'number' && isFinite(m.s)) NET.send({ t: 'pong', s: m.s }, m.from); return;
    case 'pong': {
      const ms = typeof m.s === 'number' ? performance.now() - m.s : NaN;
      if (COOP.on || !(ms >= 0 && ms < 10000)) return;
      let a = COOP.rtt.get(m.from);
      if (!a) COOP.rtt.set(m.from, a = []);
      a.push(ms); if (a.length > 24) a.shift();
      return;
    }
    case 'rtt': if (COOP.host && !COOP.on && COOP.members.some(x => x.id === m.from) && typeof m.w === 'number' && isFinite(m.w)) COOP.worst.set(m.from, clamp(m.w, 0, 10000)); return;
    case 'lobby': // 参加者: 部屋の人の並び(画面に出す。確かめた物だけ)
      if (COOP.host || COOP.on || !Array.isArray(m.members) || m.members.length > 4 || !m.members[0] || m.members[0].id !== m.from || (COOP.hostId && COOP.hostId !== m.from)) return;
      if (m.ver !== GAME_VER) { coopQuit(); if (typeof CoopUI !== 'undefined') CoopUI.say(_t('ゲームの版が違うので入れません(ページを読み直してください)')); return; }
      COOP.hostId = m.from; // 最初に並びを送ってきた人をホストとする(自分を 0 番に書いている人だけ)
      COOP.mode = okMode(m.mode);
      COOP.members = m.members.map(x => ({ id: String(x && x.id).slice(0, 32), cls: okCls(x && x.cls), vw: okView(x && x.vw, 480), vh: okView(x && x.vh, 270) }));
      if (typeof CoopUI !== 'undefined') CoopUI.refresh();
      return;
    case 'start': {
      if (COOP.host || COOP.on || !Array.isArray(m.members) || m.members.length > 4 || m.from !== (COOP.hostId || (m.members[0] && m.members[0].id))) return;
      const members = m.members.map(x => ({ id: String(x && x.id), cls: okCls(x && x.cls), vw: okView(x && x.vw, 480), vh: okView(x && x.vh, 270), kit: coopKit(x && x.kit) }));
      if (!members.some(x => x.id === NET.me)) return;
      const mode = m.mode === 'escalation' ? 'escalation' : okMode(m.mode); // coopStart と同じ決まり(知らない物は部屋のモードの先頭)
      coopBegin({ seed: m.seed >>> 0, mode, stage: 1, lag: clamp(m.lag | 0, 1, 8), members,
        view: { w: okView(m.view && m.view.w, 480), h: okView(m.view && m.view.h, 270) }, chaos: coopChaos(m.chaos, mode) });
      return;
    }
    // 入力・ハッシュは、その番号の人が送ってきた物だけ(ほかの人の番号を名乗れない)
    case 'in': if (coopFromPid(m)) coopPut(m.f, m.pid, m.inp); return;
    case 'hash': if (COOP.on && coopFromPid(m) && Number.isInteger(m.f) && typeof m.h === 'number') coopHashPut(m.f, m.pid, m.h >>> 0); return;
    // 抜けた人を外す手続き(下の coopTryDrop)
    case 'q': { // 決める人から: x の入力を自分が持っている分と、自分の今のフレームを返す
      const s = coopPidOf(m.from);
      if (COOP.on && s >= 0 && !COOP.gone.has(s) && coopOkPid(m.x)) NET.send({ t: 'qa', x: m.x, f: COOP.f, have: coopHeld(m.x) }, m.from);
      return;
    }
    case 'qa': { // 決める人: 答えを集める
      const q = COOP.query, s = coopPidOf(m.from);
      if (!q || m.x !== q.x || s < 0 || COOP.gone.has(s) || !Number.isInteger(m.f) || !Array.isArray(m.have)) return;
      q.ans.set(s, { f: clamp(m.f, 0, COOP.f + 600), have: coopInpList(m.have) });
      return;
    }
    case 'drop': { // x をフレーム f から外す。決めてよいのは、自分より小さい番号の人が全員外れた人だけ(届いた順によらず、全員が同じ答えになる決まり)
      const s = coopPidOf(m.from), x = m.x;
      if (!COOP.on || s < 0 || COOP.gone.has(s) || !coopOkPid(x) || COOP.gone.has(x) || !Number.isInteger(m.f) || m.f < 0 || m.f > COOP.f + 600 || !Array.isArray(m.inp)) return;
      for (let i = 0; i < s; i++) if (!COOP.gone.has(i) && i !== x) return;
      coopApplyDrop(x, m.f, coopInpList(m.inp));
      return;
    }
  }
}
const coopPidOf = id => COOP.members.findIndex(x => x.id === id);
const coopOkPid = x => Number.isInteger(x) && x >= 0 && x < COOP.members.length;
const coopInpList = a => a.filter(e => Array.isArray(e) && Number.isInteger(e[0]) && e[0] >= 0).slice(0, 700).map(e => [e[0], coopCleanInput(e[1])]);
const coopFromPid = m => Number.isInteger(m.pid) && m.pid >= 0 && m.pid < COOP.members.length && COOP.members[m.pid].id === m.from;
// 全員が同じ手順でランを始める(計算の乱数の列で。players の 0 番はホスト。ステータスは各自のキット・カオス強化はホストの設定)
function coopBegin(m) {
  COOP.members = m.members; COOP.pid = m.members.findIndex(x => x.id === NET.me); COOP.lag = m.lag;
  COOP.f = 0; COOP.sentTo = m.lag - 1; COOP.log = []; COOP.desync = null; // 入力は消さない(全員が直接つなぐので、ほかの人の入力が「開始」より先に届くことがある)
  Object.assign(SIM_VIEW, { on: true, w: m.view.w, h: m.view.h });
  FIXED_STEP.on = true; FIXED_STEP.acc = 0;
  if (typeof Lobby !== 'undefined') Lobby.close(); // 公開ロビーはもう見ない(載せていた部屋も消える)
  simSeed(m.seed);
  simScope(() => {
    startRun(m.mode, m.stage, { cls: m.members[0].cls, kit: m.members[0].kit, chaos: m.chaos });
    for (let i = 1; i < m.members.length; i++) addPlayer(m.members[i].cls, P.x + 30 * i, P.y + 12 * i, m.members[i].kit);
  });
  for (let f = 0; f < m.lag; f++) COOP.inq.set(f, players.map(() => NO_INPUT)); // 始めの lag フレームは全員入力なし
  for (const [f, row] of COOP.inq) if (row.length !== players.length) COOP.inq.delete(f); // 人数の違う並びで届いていた物は捨てる
  P = players[COOP.pid]; // 計算の外の P は自分
  cam.fx = P.x - GFX.VW / 2; cam.fy = P.y - GFX.VH / 2;
  COOP.on = true;
  console.info('COOP: 開始(' + players.length + '人・自分は ' + COOP.pid + ' 番・入力の遅れ ' + COOP.lag + 'フレーム)');
}
// 届いた入力の記録を確かめて形をそろえる(相手が何を送ってきても、決まった形の数と真偽だけにする。-0 も 0 に)
function coopCleanInput(r) {
  const num = v => (typeof v === 'number' && isFinite(v) ? (v === 0 ? 0 : v) : 0);
  if (!r || typeof r !== 'object') return NO_INPUT;
  let mx = clamp(num(r.mx), -1, 1), my = clamp(num(r.my), -1, 1);
  const l = Math.hypot(mx, my);
  if (l > 1 + 1e-9) { mx /= l; my /= l; } // 1 を少し超えるだけなら直さない(直した物をもう一度通しても変わらないように)
  const a = r.aim && typeof r.aim === 'object' ? r.aim : null;
  const aim = a && typeof a.x === 'number' && isFinite(a.x) && typeof a.y === 'number' && isFinite(a.y) ? { x: clamp(num(a.x), -1e6, 1e6), y: clamp(num(a.y), -1e6, 1e6) } : null;
  const pick = [1, 2, 3, PICK.skip, PICK.reroll].includes(r.pick) ? r.pick : 0;
  return { mx: num(mx), my: num(my), e: r.e === true, q: r.q === true, def: r.def === true, aim, autoE: r.autoE === true, autoQ: r.autoQ === true, pick };
}
// フレーム f の pid の入力を入れる(今より前・ずっと先の物は捨てる)
function coopPut(f, pid, r) {
  const n = COOP.members.length;
  if (!Number.isInteger(f) || !Number.isInteger(pid) || pid < 0 || pid >= n || f < COOP.f || f > COOP.f + 600 || (COOP.gone.has(pid) && f >= COOP.gone.get(pid))) return;
  let row = COOP.inq.get(f);
  if (!row) COOP.inq.set(f, row = new Array(n).fill(null));
  if (!row[pid]) row[pid] = coopCleanInput(r);
}
// 1回計算する(全員の入力がそろっていなければ false)。自分の入力は lag フレーム先の分として、計算 1回につき 1度だけ取って送る
function coopStepOnce(dt) {
  const f = COOP.f;
  if (COOP.sentTo < f + COOP.lag) {
    const tf = f + COOP.lag, r = coopCleanInput(COOP.testInput ? COOP.testInput(tf, COOP.pid) : readInput());
    coopPut(tf, COOP.pid, r);
    NET.send({ t: 'in', f: tf, pid: COOP.pid, inp: r });
    COOP.sentTo = tf;
  }
  let row = COOP.inq.get(f);
  if (COOP.gone.size) { // 外した人: D からは入力なし(届いていた物も使わない)
    if (!row) COOP.inq.set(f, row = new Array(players.length).fill(null));
    for (const [x, D] of COOP.gone) if (f >= D) row[x] = NO_INPUT;
  }
  if (!row || row.length !== players.length || row.some(x => !x)) return false;
  COOP.inq.delete(f); COOP.past.set(f, row); COOP.past.delete(f - 120);
  interpSave();
  const left = [];
  withPlayer(players[0], () => simScope(() => {
    for (const [x, D] of COOP.gone) if (f >= D && !players[x].left) { coopLeft(players[x]); left.push(x); } // D の計算の前に(全員が同じフレームで)
    update(dt, row);
  }));
  COOP.f = f + 1;
  for (const x of left) UI.toast(_t`P${x + 1} が抜けました`, '#5a4a6a');
  if (COOP.f % 60 === 0) { const h = coopHash(); COOP.log.push([COOP.f, h]); NET.send({ t: 'hash', f: COOP.f, pid: COOP.pid, h }); coopHashPut(COOP.f, COOP.pid, h); } // 送ってから比べる(ずれていると比べた所で閉じるので)
  return true;
}
// 試験: 画面のフレームに関係なく、入力がそろう所まで最大 n 回計算する。今のフレームを返す
COOP.pump = n => { coopTick(); let k = 0; while (k < n && COOP.on && !COOP.desync && state === 'play' && coopStepOnce(1 / 60)) k++; return COOP.f; };
// 状態のハッシュ(計算の結果だけ。全員の位置・HP・撃破数、敵、弾・床・拾う物の数、時間)
const coopHash = (() => {
  const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
  return () => {
    let h = 0x811c9dc5;
    const mix = x => { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; };
    const num = v => { f64[0] = +v || 0; mix(u32[0]); mix(u32[1]); };
    num(S.time); num(S.elv);
    for (const p of players) { num(p.x); num(p.y); num(p.hp); num(p.kills); num(p.level); num(p.dead ? 1 : 0); }
    for (const e of enemies) if (!e.dead) { num(e.id); num(e.x); num(e.y); num(e.hp); }
    num(eprojs.length); num(hazards.length); num(gems.length); num(drops.length); num(projs.length); num(zones.length);
    return h;
  };
})();
function coopHashPut(f, pid, h) {
  if (COOP.gone.has(pid)) return;
  let row = COOP.hashes.get(f);
  if (!row) COOP.hashes.set(f, row = new Array(COOP.members.length).fill(null));
  row[pid] = h;
  coopHashCheck(f);
}
// 外していない人のハッシュがそろったら比べる
function coopHashCheck(f) {
  const row = COOP.hashes.get(f), live = row ? row.filter((_, i) => !COOP.gone.has(i)) : [];
  if (!row || live.some(x => x === null)) return;
  COOP.hashes.delete(f);
  if (live.every(x => x === live[0])) return;
  COOP.desync = { f, hashes: row.slice() };
  console.error('COOP: 同期がずれた(フレーム ' + f + ')', row.map(x => (x === null ? '-' : x.toString(16)))); // - は外した人
  UI.banner('DESYNC', _t('同期がずれました'), 4000);
  if (COOP.on && state === 'play') endRun(false); // ランを終える(報酬はそこまでの分を各自に: #4)
}
// 止まらないレベルアップ(#8): 選ぶカードは計算の中で決めて P.lvPick に置き、選んだ物は入力の pick で届く(全員が同じフレームで使う)
//   P.lvPick = { lv, list, n }(n: リロールした回数。画面が出し直すため)。カードを取る・スキップ(+10G)・リロール(残りがあれば)
const PICK = { skip: 8, reroll: 9 };
function coopLevel() {
  for (const p of players) if (!p.left) withPlayer(p, () => { // 抜けた人は選ばない(経験値は全員に入るのでたまるが、選択は出さない)
    const c = P.lvPick, k = P.inp.pick | 0;
    if (c && k) {
      if (k >= 1 && k <= c.list.length) {
        const ch = c.list[k - 1];
        applyChoice(ch); P.lvPick = null;
        const col = ch.type === 'weapon' ? DATA.weapons[ch.key].col : ch.type === 'cls' ? DATA.classes[P.cls].col : ch.type === 'eqopt' ? '#9ff7ff' : '#ffffff';
        burst(P.x, P.y, 30, [col, '#ffffff'], { sp: 90, glow: true, up: 20 }); addRing(P.x, P.y, 40, col, { life: 0.35 });
        if (P === players[COOP.pid]) AudioMan.select();
      } else if (k === PICK.reroll && P.rerolls > 0) { P.rerolls--; c.list = buildChoices(c.lv); c.n++; }
      else if (k === PICK.skip) { addGold(10); P.lvPick = null; }
    }
    if (!P.lvPick && P.pendingLv > 0) {
      P.pendingLv--;
      const lv = P.lvQueue.shift() || P.level, list = buildChoices(lv);
      if (list.length) { P.lvPick = { lv, list, n: 0 }; if (P === players[COOP.pid]) AudioMan.levelup(); } else microBuff();
    }
  });
}
// 倒れた人の復活(tower.md #17): 次の階の始めに、HP 50% で生きている人の近くに戻る(状態異常は消し、少しの間は無敵)
function coopRevive() {
  const al = players.find(q => !q.dead && q !== P);
  if (al) { P.x = al.x + 16; P.y = al.y; }
  P.dead = false; P.deathT = 0; P.ifr = 2;
  cleansePlayer();
  P.hp = Math.max(1, Math.round(P.maxhp * 0.5));
  addRing(P.x, P.y, 40, '#ffd23f', { w: 2, life: 0.5 }); burst(P.x, P.y, 30, ['#ffd23f', '#ffffff'], { sp: 80, up: 30, glow: true, life: 0.6 });
  S.hudDirty = true;
}
// ランの終わり(endRun から): 自分を P にして協力プレイを閉じる(報酬・記録は endRun が自分の分で入れる)
function coopFinish() {
  COOP.on = false; COOP.pub = false;
  P = players[COOP.pid] || P;
  if (NET.isOpen) NET.send({ t: 'bye' });
  NET.close();
  SIM_VIEW.on = false;
  if (!NET_SIM.on) FIXED_STEP.on = false;
}
// ============================================================
// 往復時間(#1・#3): 部屋の中(始まる前)で 0.25秒ごとに全員へ ping(人ごとに最近 24回)
// ============================================================
const coopP95 = a => { if (!a || !a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.ceil(s.length * 0.95) - 1]; };
const coopRttTo = id => coopP95(COOP.rtt.get(id)); // その人との往復(95%。まだ測れていなければ null)
// 自分が測った一番遅い相手(測れていない人がいれば null)
function coopMyWorst() {
  let w = 0;
  for (const x of COOP.members) if (x.id !== NET.me) { const v = coopRttTo(x.id); if (v === null) return null; w = Math.max(w, v); }
  return w;
}
// ホスト: 入力の遅れ = 一番遅い組の往復(95%)で (片道 + 5ms) ÷ 1フレームを切り上げ、2〜8。測れていない人がいれば 4
function coopAutoLag() {
  let w = 0;
  for (const x of COOP.members) {
    if (x.id === NET.me) continue;
    const a = coopRttTo(x.id), b = COOP.worst.get(x.id);
    if (a === null || b === undefined) return 4;
    w = Math.max(w, a, b);
  }
  return clamp(Math.ceil((w / 2 + 5) / (1000 / 60)), 2, 8);
}
setInterval(() => {
  if (COOP.on || !COOP.room || !NET.isOpen) return;
  NET.send({ t: 'ping', s: performance.now() });
  if (!COOP.host && COOP.hostId && ++COOP.rttN % 4 === 0) { const w = coopMyWorst(); if (w !== null) NET.send({ t: 'rtt', w }, COOP.hostId); }
  if (typeof CoopUI !== 'undefined') CoopUI.tick();
}, 250);

// ============================================================
// 抜けた人(#3・#12)
// ============================================================
// 毎画面フレーム(main.js の stepFixed。待っている間も): 待っている人と秒・dropT 秒で抜けたと思う・決める人の手続き
function coopTick() {
  if (!COOP.on) return;
  const now = performance.now(), f = COOP.f, row = COOP.inq.get(f);
  const miss = COOP.members.map((_, i) => i).filter(i => i !== COOP.pid && !(row && row[i]) && !(COOP.gone.has(i) && f >= COOP.gone.get(i)));
  if (!miss.length) COOP.waitFrom = 0;
  else if (f !== COOP.waitF || !COOP.waitFrom) COOP.waitFrom = now;
  COOP.waitF = f; COOP.waitOn = miss; COOP.waitSec = COOP.waitFrom ? (now - COOP.waitFrom) / 1000 : 0;
  if (COOP.waitSec >= COOP.dropT) for (const i of miss) coopSuspect(i);
  const q = COOP.query;
  if (q && (now - q.t > 3000 || COOP.members.every((_, i) => i === COOP.pid || i === q.x || COOP.gone.has(i) || COOP.suspect.has(i) || q.ans.has(i)))) coopDecide();
  else if (!q) coopTryDrop();
}
function coopSuspect(i) {
  if (!COOP.on || i === COOP.pid || COOP.gone.has(i) || COOP.suspect.has(i)) return;
  COOP.suspect.add(i);
  console.info('COOP: P' + (i + 1) + ' が抜けたと思う');
  coopTryDrop();
}
// 決める人(自分から見て、外していない・抜けたと思っていない人のうち一番小さい番号)だけが、抜けたと思う人を 1人ずつ外す: まず全員に x の入力を聞く
function coopTryDrop() {
  if (!COOP.on || COOP.query) return;
  const dec = COOP.members.findIndex((_, i) => !COOP.gone.has(i) && !COOP.suspect.has(i));
  const x = COOP.members.findIndex((_, i) => COOP.suspect.has(i) && !COOP.gone.has(i));
  if (dec !== COOP.pid || x < 0) return;
  COOP.query = { x, t: performance.now(), ans: new Map() };
  NET.send({ t: 'q', x });
}
// 自分が持っている x の入力(計算した最近の分と、まだ計算していない分)
function coopHeld(x) {
  const out = [];
  for (const [f, row] of COOP.past) if (f >= COOP.f - 32 && row[x]) out.push([f, row[x]]);
  for (const [f, row] of COOP.inq) if (f >= COOP.f && row[x]) out.push([f, row[x]]);
  return out;
}
// 決める人: 答えがそろったか 3秒で決める。外すフレーム D = 誰かが持っている x の入力の一番先の次(誰もまだ計算していない所)。
//   それより前の x の入力は、持っている人の物を全員に渡す(遅れている人はまだ受け取っていないことがある。入力は順に届くので、持っている分は全員同じ)
function coopDecide() {
  const q = COOP.query; COOP.query = null;
  if (!COOP.on || COOP.gone.has(q.x)) return;
  q.ans.set(COOP.pid, { f: COOP.f, have: coopHeld(q.x) });
  let D = 0, lo = Infinity;
  const got = new Map();
  for (const a of q.ans.values()) {
    lo = Math.min(lo, a.f); D = Math.max(D, a.f);
    for (const [f, r] of a.have) { got.set(f, r); D = Math.max(D, f + 1); }
  }
  const inp = [];
  for (let f = lo; f < D; f++) inp.push([f, got.get(f) || NO_INPUT]); // 抜けは入力なし(順に届くので起きないはず)
  NET.send({ t: 'drop', x: q.x, f: D, inp });
  coopApplyDrop(q.x, D, inp);
}
// x をフレーム D から外す(全員が同じ D・同じ入力で)。D より前の x の入力は渡された物にそろえ、D からは入力なし
function coopApplyDrop(x, D, inp) {
  if (COOP.gone.has(x)) return;
  COOP.gone.set(x, D); COOP.suspect.delete(x);
  if (COOP.query && COOP.query.x === x) COOP.query = null;
  const n = COOP.members.length;
  for (const [f, r] of inp) if (f >= COOP.f && f < D) { let row = COOP.inq.get(f); if (!row) COOP.inq.set(f, row = new Array(n).fill(null)); row[x] = r; }
  for (const [f, row] of COOP.inq) if (f >= D) row[x] = NO_INPUT;
  console.info('COOP: P' + (x + 1) + ' を外す(フレーム ' + D + ')');
  if (x === COOP.pid) { // 自分が外された(ほかの人には自分の入力が届いていなかった)
    UI.banner('DISCONNECTED', _t('接続が切れたため、部屋から外れました'), 4000);
    if (state === 'play') endRun(false);
    return;
  }
  for (const f of [...COOP.hashes.keys()]) coopHashCheck(f);
  coopTryDrop();
}
// 外した人(計算の中・D の計算の前): 倒れた扱いで、次の階でも戻らない。レベルアップの選択も消す(休憩で待たない)
function coopLeft(p) { Object.assign(p, { left: true, dead: true, hp: 0, lvPick: null, pendingLv: 0, lvQueue: [] }); }
addEventListener('pagehide', () => { if (NET.isOpen) NET.send({ t: 'bye' }); }); // ページを閉じる時: ほかの人がすぐ外せるように
// URL で試す: ?coop=host&room=abc(&n=2 でその人数がそろったら開始)/ ?coop=join&room=abc。別々のウィンドウで開く(隠れたタブは画面のフレームが止まり、全員が待つ)
{
  const qs = new URLSearchParams(location.search), role = qs.get('coop'), room = (qs.get('room') || 'test').slice(0, 32);
  if (role === 'host') addEventListener('load', () => coopHost(room, META.cls, +qs.get('n') || 0));
  else if (role === 'join') addEventListener('load', () => coopJoin(room, META.cls));
}
