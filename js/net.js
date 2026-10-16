// net.js — 協力プレイの通信とロックステップ(claudedocs/coop.md 1章・4章・7章 4段)
//   全員が同じ計算をし、送り合うのは計算 1回ぶんの入力の記録(core.js の readInput)だけ。全員分がそろったフレームから計算する
'use strict';

// ============================================================
// 通信の窓口(NET): 送る・受け取るだけ。中身は入れ替える(今は BroadcastChannel = 同じブラウザのほかのウィンドウ。6段で Trystero)
//   届いた物は相手が何を送ってきても壊れないよう、COOP の側で形と範囲を確かめてから使う(コードとして動かすことはしない)
// ============================================================
const NET = {
  me: '', ch: null,
  open(room, onMsg) {
    this.close();
    this.me = (NATIVE_RANDOM() * 4294967296 >>> 0).toString(36) + (NATIVE_RANDOM() * 4294967296 >>> 0).toString(36);
    this.ch = new BroadcastChannel('nocturne-coop-' + room);
    this.ch.onmessage = e => { const m = e.data; if (m && typeof m === 'object' && typeof m.t === 'string' && typeof m.from === 'string' && m.from !== this.me) onMsg(m); };
  },
  send(msg) { if (this.ch) this.ch.postMessage(Object.assign({ from: this.me }, msg)); },
  close() { if (this.ch) this.ch.close(); this.ch = null; },
};

// ============================================================
// 協力プレイのセッション(COOP)
//   部屋: ホストが coopHost、ほかの人が coopJoin。ホストが coopStart で「開始」を送り、全員が同じ種でランを始める(players はホストが決めた順)
//   毎フレーム: 自分の入力を lag フレーム先の分として送る → 全員分がそろったフレームを計算する(そろわなければ待つ)
//   60フレームごとに状態のハッシュを送り合い、違えば「同期がずれました」で止める(#4)
//   計算の間の P はどの人の画面でもホスト(players[0])。計算の外の P は自分(players[COOP.pid])
// ============================================================
const COOP = {
  on: false, host: false, room: '', pid: 0, lag: 4, f: 0,
  members: [], // [{ id, cls, vw, vh }](0 番がホスト)
  want: 0, // ホスト: この人数がそろったら自分で開始する(URL の n)
  inq: new Map(), // フレーム → 入力の記録の配列(players の順)
  sentTo: -1, // 自分の入力を送った一番先のフレーム
  hashes: new Map(), // フレーム → 人ごとのハッシュ
  log: [], // 自分の [フレーム, ハッシュ](試験の道具が比べる)
  desync: null, stalls: 0,
  manual: false, // 試験: 画面のフレームで進めない(COOP.pump で進める)
  testInput: null, // 試験: (f, pid) => 入力の記録(決まった入力)
};
const COOP_CLASSES = () => DATA.classOrder;

function coopReset() {
  Object.assign(COOP, { on: false, f: 0, sentTo: -1, desync: null, stalls: 0, log: [] });
  COOP.inq.clear(); COOP.hashes.clear();
}
// 部屋を作る(ホスト)。n: この人数がそろったら開始する(省略で coopStart を呼ぶまで待つ)
function coopHost(room, cls = META.cls, n = 0) {
  coopReset();
  Object.assign(COOP, { host: true, room: String(room), want: n | 0 });
  NET.open(COOP.room, coopOnMsg);
  COOP.members = [{ id: NET.me, cls, vw: GFX.VW, vh: GFX.VH }];
  console.info('COOP: 部屋 ' + COOP.room + ' を作った。ほかのウィンドウで ?coop=join&room=' + COOP.room + ' を開き、そろったら coopStart()');
}
// 部屋に入る
function coopJoin(room, cls = META.cls) {
  coopReset();
  Object.assign(COOP, { host: false, room: String(room), members: [] });
  NET.open(COOP.room, coopOnMsg);
  NET.send({ t: 'join', cls, vw: GFX.VW, vh: GFX.VH });
  console.info('COOP: 部屋 ' + COOP.room + ' に入る');
}
// 開始(ホスト): 種・モード・入力の遅れ・全員の並び・計算用の画面の大きさ(全員の一番大きい窓。#16)を送り、自分も始める
function coopStart(o = {}) {
  if (!COOP.host || COOP.on) return;
  const ms = COOP.members;
  const m = { t: 'start', seed: NATIVE_RANDOM() * 4294967296 >>> 0, mode: o.mode || 'tower', stage: o.stage || 1, lag: o.lag || COOP.lag, members: ms,
    view: { w: Math.max(...ms.map(x => x.vw)), h: Math.max(...ms.map(x => x.vh)) } };
  NET.send(m);
  coopBegin(m);
}
const okCls = c => (typeof c === 'string' && COOP_CLASSES().includes(c) ? c : 'knight');
const okView = (v, d) => (typeof v === 'number' && isFinite(v) ? clamp(Math.round(v), 200, 1200) : d);
function coopOnMsg(m) {
  switch (m.t) {
    case 'join': // ホストだけ受ける(始まる前・4人まで)
      if (!COOP.host || COOP.on || COOP.members.length >= 4 || COOP.members.some(x => x.id === m.from)) return;
      COOP.members.push({ id: m.from, cls: okCls(m.cls), vw: okView(m.vw, 480), vh: okView(m.vh, 270) });
      NET.send({ t: 'lobby', members: COOP.members });
      console.info('COOP: ' + COOP.members.length + '人');
      if (COOP.want && COOP.members.length >= COOP.want) coopStart();
      return;
    case 'lobby': if (!COOP.host && Array.isArray(m.members)) console.info('COOP: ' + m.members.length + '人'); return;
    case 'start': {
      if (COOP.host || COOP.on || !Array.isArray(m.members) || m.members.length > 4) return;
      const members = m.members.map(x => ({ id: String(x && x.id), cls: okCls(x && x.cls), vw: okView(x && x.vw, 480), vh: okView(x && x.vh, 270) }));
      if (!members.some(x => x.id === NET.me)) return;
      coopBegin({ seed: m.seed >>> 0, mode: m.mode === 'tower' ? 'tower' : 'escalation', stage: 1, lag: clamp(m.lag | 0, 1, 8), members,
        view: { w: okView(m.view && m.view.w, 480), h: okView(m.view && m.view.h, 270) } });
      return;
    }
    case 'in': coopPut(m.f, m.pid, m.inp); return;
    case 'hash': if (COOP.on && Number.isInteger(m.f) && m.pid >= 0 && m.pid < COOP.members.length && typeof m.h === 'number') coopHashPut(m.f, m.pid, m.h); return;
  }
}
// 全員が同じ手順でランを始める(計算の乱数の列で。players の 0 番はホストのクラス)
function coopBegin(m) {
  COOP.members = m.members; COOP.pid = m.members.findIndex(x => x.id === NET.me); COOP.lag = m.lag;
  COOP.f = 0; COOP.sentTo = m.lag - 1; COOP.inq.clear(); COOP.hashes.clear(); COOP.log = []; COOP.desync = null;
  Object.assign(SIM_VIEW, { on: true, w: m.view.w, h: m.view.h });
  FIXED_STEP.on = true; FIXED_STEP.acc = 0;
  const cls0 = META.cls;
  simSeed(m.seed);
  simScope(() => {
    META.cls = m.members[0].cls; // 0 番(ホスト)のクラスで始める。セーブに残さないよう、すぐ戻す
    try { startRun(m.mode, m.stage); } finally { META.cls = cls0; }
    for (let i = 1; i < m.members.length; i++) addPlayer(m.members[i].cls, P.x + 30 * i, P.y + 12 * i);
  });
  for (let f = 0; f < m.lag; f++) COOP.inq.set(f, players.map(() => NO_INPUT)); // 始めの lag フレームは全員入力なし
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
  if (l > 1) { mx /= l; my /= l; }
  const a = r.aim && typeof r.aim === 'object' ? r.aim : null;
  const aim = a && typeof a.x === 'number' && isFinite(a.x) && typeof a.y === 'number' && isFinite(a.y) ? { x: clamp(num(a.x), -1e6, 1e6), y: clamp(num(a.y), -1e6, 1e6) } : null;
  return { mx: num(mx), my: num(my), e: r.e === true, q: r.q === true, def: r.def === true, aim, autoE: r.autoE === true, autoQ: r.autoQ === true };
}
// フレーム f の pid の入力を入れる(今より前・ずっと先の物は捨てる)
function coopPut(f, pid, r) {
  const n = COOP.members.length;
  if (!Number.isInteger(f) || !Number.isInteger(pid) || pid < 0 || pid >= n || f < COOP.f || f > COOP.f + 600) return;
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
  const row = COOP.inq.get(f);
  if (!row || row.length !== players.length || row.some(x => !x)) return false;
  COOP.inq.delete(f);
  interpSave();
  withPlayer(players[0], () => simScope(() => update(dt, row)));
  COOP.f = f + 1;
  if (COOP.f % 60 === 0) { const h = coopHash(); COOP.log.push([COOP.f, h]); coopHashPut(COOP.f, COOP.pid, h); NET.send({ t: 'hash', f: COOP.f, pid: COOP.pid, h }); }
  return true;
}
// 試験: 画面のフレームに関係なく、入力がそろう所まで最大 n 回計算する。今のフレームを返す
COOP.pump = n => { let k = 0; while (k < n && COOP.on && !COOP.desync && state === 'play' && coopStepOnce(1 / 60)) k++; return COOP.f; };
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
  let row = COOP.hashes.get(f);
  if (!row) COOP.hashes.set(f, row = new Array(COOP.members.length).fill(null));
  row[pid] = h;
  if (row.some(x => x === null)) return;
  COOP.hashes.delete(f);
  if (row.every(x => x === row[0])) return;
  COOP.desync = { f, hashes: row.slice() };
  console.error('COOP: 同期がずれた(フレーム ' + f + ')', row.map(x => x.toString(16)));
  UI.banner('DESYNC', _t('同期がずれました'), 4000);
}
// レベルアップ(4段の仮): 協力プレイでは止まらない画面がまだ無いので(5段)、全員のレベルアップを計算の中で 1枚目のカードに決める
function coopAutoLevel() {
  for (const p of players) withPlayer(p, () => {
    while (P.pendingLv > 0) {
      P.pendingLv--;
      const lv = P.lvQueue.shift() || P.level, list = buildChoices(lv);
      if (list.length) applyChoice(list[0]); else microBuff();
    }
  });
}
// ランの終わり(4段の仮): 記録・報酬はまだ保存しない(5段)。止めてタイトルへ
function coopEndRun(win) {
  COOP.on = false;
  P = players[COOP.pid] || P;
  state = win ? 'victory' : 'over';
  UI.banner('GAME OVER', _t('協力プレイの記録と報酬は、まだ保存しません'), 4000);
  setTimeout(() => { NET.close(); SIM_VIEW.on = false; FIXED_STEP.on = false; goTitle(); }, 4000);
}
// URL で試す: ?coop=host&room=abc(&n=2 でその人数がそろったら開始)/ ?coop=join&room=abc。別々のウィンドウで開く(隠れたタブは画面のフレームが止まり、全員が待つ)
{
  const qs = new URLSearchParams(location.search), role = qs.get('coop'), room = (qs.get('room') || 'test').slice(0, 32);
  if (role === 'host') addEventListener('load', () => coopHost(room, META.cls, +qs.get('n') || 0));
  else if (role === 'join') addEventListener('load', () => coopJoin(room, META.cls));
}
