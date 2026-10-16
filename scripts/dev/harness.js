// harness.js — ブラウザの試験の道具(開発用。index.html にもビルドにも入らない)
//   使い方: python -m http.server 8765 --bind 127.0.0.1 でゲームを開き、Playwright で
//     await page.addScriptTag({ url: '/scripts/dev/harness.js' }); await page.evaluate(() => T.init());
//   (scripts/dev/open.pw.js がキャッシュを消して開くところまでする。browser_run_code_unsafe の filename に渡す)
//   T.init()            : 実時間の update / render を止める(T.step・T.frames で手で進める)・セーブしない・効果音を止める
//                         ・倒れない・レベルアップで止まらない・setTimeout をゲームの時間で進める
//   T.setup(cls, n, o)  : エスカレーション(草原)を始め、動かず死なないゾンビ n体を自分の周りに置く(o: stage / mode / hp / r / enemy)
//   T.step(sec, f)      : 1/60 秒ずつ update だけ(f は毎フレーム呼ぶ) / T.frames(sec, draw): 本物の frame と同じ順で描画も
//   T.hit(d)            : 無敵・防御を外して d を受ける(hurtPlayer の戻り値)
//   T.tree(spec)        : 強化を付ける。{ 'passive.wall': 3, sp: { passive: 'wall' } }(sp は特殊強化)
//   T.boss(key, stage)  : ボスのステージ(省略でそのボスが出るステージ)を始め、ボスを自分の右に出して技の待ち時間を全部 99 に
//                         (技は関数を直接呼ぶか、待ち時間を 0.01 に)
//   T.classSmoke(o)     : 全クラス × 特殊強化 3通りで E / Q を使い、update + render を回す → { frames, errs, hash }
//   T.bossSmoke(o)      : ステージのボスを全部、本物の出方で出して戦わせる(途中で激昂・最後に倒す)→ { frames, errs, hash, per }
//   T.coopSmoke(o)      : 協力プレイ(2人以上)を 1つの計算で回す。決まった入力で動き回り E / Q も使う → { frames, errs, hash, per(1人ずつ), hurt }
//   hash は乱数を固定して回した状態(自分・敵・弾・設置物)と描いた画素から作る(o.pix: false で画素と粒の数を入れない = 計算だけ。o.draw: false で描画しない)。動かすだけのリファクタリングの前後で同じになる
//     ページを開くたびに init → 同じ順に呼ぶ(初回だけ作るキャッシュがあるので、比べるときは呼ぶ順をそろえる)
//     ずれたら o.trace: true で毎フレームの状態(T.snap)が付く。T.diff(前, 後) で最初にずれた所
'use strict';

(() => {
  const T = window.T = { errs: [] };
  const seen = new Set();
  const err = (tag, e) => { const m = tag + ': ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | '); if (!seen.has(m)) { seen.add(m); T.errs.push(m); } };
  const tryf = (tag, f) => { try { return f(); } catch (e) { err(tag, e); } };

  // ---------- 乱数の固定(mulberry32)----------
  //   ゲームの計算の列(core.js の simSeed)と見た目の列(setFxRandom)を両方固定する。試験の間はずっと計算の列(inSim = 1。
  //   ゲームでは main.js の frame が update だけを包むが、試験は準備の中でも引くので)。描画の列はフレームごとに始め直す
  //   (描画の中の乱数・初回だけ作るキャッシュが、ほかの乱数の順をずらさない)
  const rng = s => { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  let seeded = false, fxU = null, seedR = 0, nR = 0;
  T.seed = s => { seeded = true; seedR = s ^ 0x9e3779b9; nR = 0; simSeed(s); fxU = rng(seedR ^ 0x2545f491); setFxRandom(fxU); inSim = 1; };
  T.unseed = () => { seeded = false; inSim = 0; setFxRandom(null); simSeed(NATIVE_RANDOM() * 4294967296); };

  // ---------- setTimeout をゲームの時間で ----------
  //   スキルの一部(グランドスラムの余震・ホーリーピラーの連打など)は setTimeout で後の処理を動かす。実時間だと試験の合間に動いてずれるので、
  //   T.init からは、ゲームのファイル(/js/)から呼ばれたものだけ 1フレーム(1/60 秒)ごとに時刻の来たものを順に呼ぶ
  //   (setTimeout を丸ごと置き換えると Playwright の evaluate が返らなくなる。Playwright 側の呼び出しは本物に渡す)
  const realST = window.setTimeout, realCT = window.clearTimeout;
  let simT = 0, tq = [], tqN = 1e9;
  const fromGame = () => /\/js\/[\w.\-/]+\.js/.test(String(new Error().stack).split('\n')[3] || '');
  const fakeST = function (fn, ms = 0, ...args) {
    if (!fromGame()) return realST.apply(window, arguments);
    const id = ++tqN;
    if (typeof fn === 'function') tq.push({ t: simT + (+ms || 0) / 1000, fn, args, id });
    return id;
  };
  const fakeCT = id => { if (!(id > 1e9)) return realCT.call(window, id); const i = tq.findIndex(q => q.id === id); if (i >= 0) tq.splice(i, 1); };
  const runTimers = () => {
    simT += 1 / 60;
    for (;;) {
      let k = -1;
      for (let i = 0; i < tq.length; i++) if (tq[i].t <= simT + 1e-9 && (k < 0 || tq[i].t < tq[k].t || (tq[i].t === tq[k].t && tq[i].id < tq[k].id))) k = i;
      if (k < 0) break;
      const q = tq.splice(k, 1)[0];
      tryf('timer', () => q.fn(...q.args));
    }
  };

  // ---------- 状態と画素のハッシュ ----------
  let H = 0x811c9dc5;
  const mix = x => { H = Math.imul(H ^ (x | 0), 16777619) >>> 0; };
  const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
  const num = v => { f64[0] = +v || 0; mix(u32[0]); mix(u32[1]); };
  const str = s => { s = String(s); for (let i = 0; i < s.length; i++) mix(s.charCodeAt(i)); };
  const hashState = (vis = true) => { // vis: 粒の数も入れる(見た目だけの物。画素なしの比べでは入れない: 画質で変わる)
    num(S.time); num(P.x); num(P.y); num(P.hp); num(P.sta); num(P.shield || 0); num(P.level);
    for (const e of enemies) { str(e.type); num(e.x); num(e.y); num(e.hp); }
    for (const p of eprojs) { str(p.kind); num(p.x); num(p.y); }
    for (const z of hazards) { str(z.kind); num(z.x); num(z.y); num(z.t); }
    num(projs.length); num(zones.length); if (vis) num(parts.length);
  };
  const LAYERS = ['scene', 'glow', 'light', 'mscene', 'mglow', 'over'];
  const hashPixels = () => { // 戻り値: 層ごとのハッシュ(trace 用)
    const per = [];
    for (const n of LAYERS) {
      const c = GFX[n], d = new Uint32Array(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.buffer);
      let h = 0x811c9dc5;
      for (let i = 0; i < d.length; i += 7) { mix(d[i]); h = Math.imul(h ^ d[i], 16777619) >>> 0; } // 7画素おき(全部だと遅い。ずれは広がるので拾える)
      per.push(n + ':' + (h >>> 0).toString(16));
    }
    return per.join(' ');
  };
  const hex = h => (h >>> 0).toString(16).padStart(8, '0');
  T.snap = () => JSON.stringify({ t: S.time, P: [P.x, P.y, P.hp, P.sta, P.shield || 0], e: enemies.map(e => [e.type, e.x, e.y, e.hp]), ep: eprojs.map(p => [p.kind, p.x, p.y]), z: hazards.map(z => [z.kind, z.x, z.y, z.t]), pr: projs.length, zn: zones.length, parts: parts.length });
  T.diff = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) {
      const x = a[i] || '', y = b[i] || ''; let j = 0;
      while (x[j] === y[j]) j++;
      return { i, a: x.slice(Math.max(0, j - 100), j + 60), b: y.slice(Math.max(0, j - 100), j + 60) };
    }
    return null;
  };

  // ---------- 準備 ----------
  let meta0 = null, fx0 = null;
  T.init = () => {
    if (T.ready) return 'ready';
    window.addEventListener('error', e => err('window', e.error || e.message));
    window.saveMeta = () => {}; window.saveSet = () => {}; // 試験のセーブは残さない(localStorage に触れない)
    window.gainXP = () => {};
    window.playerDown = () => { P.hp = P.maxhp; };
    for (const k of Object.keys(AudioMan)) if (typeof AudioMan[k] === 'function') AudioMan[k] = () => {}; // 効果音は乱数を使い、間引きが実時間で決まる
    window.setTimeout = fakeST; window.clearTimeout = fakeCT;
    T.upd = window.update; T.render = window.render;
    window.update = () => {}; window.render = () => {};
    meta0 = JSON.stringify(META);
    fx0 = JSON.stringify(GFX.fx);
    T.ready = true;
    return 'ok';
  };
  // ランの始めの状態をそろえる(試験の合間も rAF が実時間で カメラ・演出を進めているので、ここで戻す)
  //   セーブ(META)は T.init の時の中身に戻して全クラス解放 / 敵の通し番号は 1 から(ランをまたいで数え続け、当たり方が変わる)/ 前のランの setTimeout は捨てる / 描画の層を消す
  const reset = () => {
    nextId = 1;
    for (const k of Object.keys(META)) delete META[k];
    Object.assign(META, JSON.parse(meta0));
    for (const k in DATA.classUnlock) META.stageClear[DATA.classUnlock[k]] = true;
    // 演出: 時計(fx.time)はタイトルにいた実時間が入っている / 環境光・色合いは前のフレームの値から少しずつ動く
    Object.assign(GFX.fx, JSON.parse(fx0), { time: 0, flash: 0, aberr: 0, hurt: 0, lowhp: 0, dark: 0, sat: 1 }); GFX.waves.length = 0; GFX.lenses.length = 0;
    GFX.ambient.splice(0, 3, 0.5, 0.5, 0.6); GFX.tint.splice(0, 3, 1, 1, 1);
    cam.x = cam.y = cam.sx = cam.sy = cam.shake = 0;
    for (const n of LAYERS) { const c = GFX[n]; c.getContext('2d').clearRect(0, 0, c.width, c.height); } // 前に描いた絵が残る層がある(発光)
    tq = []; simT = 0;
    for (const k of Object.keys(keys)) keys[k] = false;
  };
  // 1フレーム: 本物の frame と同じ順(update → カメラ → 演出 → 描画)。draw: 描画もする
  const frame = (draw, inp) => { // inp: 入力の記録(協力プレイは players の順の配列。省略で今の keys から)
    tryf('update', () => T.upd(1 / 60, inp));
    runTimers();
    tryf('cam', () => updCam(1 / 60));
    tryf('fx', () => GFX.updateFx(1 / 60));
    if (draw) {
      if (seeded) setFxRandom(rng(seedR + nR++ * 7919));
      tryf('render', () => T.render());
      if (seeded) setFxRandom(fxU);
    }
  };
  T.step = (sec, f) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { tryf('update', () => T.upd(1 / 60)); runTimers(); if (f) tryf('step-f', f); } };
  T.frames = (sec, draw = true) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) frame(draw); };

  T.setup = (cls, n = 0, o = {}) => {
    reset();
    META.cls = cls;
    startRun(o.mode || 'escalation', o.stage || 1);
    for (let i = enemies.length - 1; i >= 0; i--) if (!enemies[i].obj) enemies.splice(i, 1);
    eprojs.length = 0;
    P.maxhp = P.hp = o.hp || 1000;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = o.r || 40;
      const e = spawnEnemy(o.enemy || 'zombie', { x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r });
      e.spd = 0; e.hp = e.maxhp = 1e6;
    }
    S.spawnT = 1e9;
    T.step(1 / 60); // 敵の位置の格子(forEachNear)を作り直す
    return { cls: P.cls, n: enemies.length };
  };
  T.hit = d => { P.ifr = 0; P.invT = 0; P.armor = 0; P.dr = 0; P.guard = false; return hurtPlayer(d); };
  T.tree = spec => {
    P.cu = {}; P.cs = {};
    for (const k in spec) if (k !== 'sp') P.cu[k] = spec[k];
    Object.assign(P.cs, spec.sp || {});
    recalc();
  };
  // ボス → そのボスが出るステージの番号(stageRuns の bosses。どのステージにも出ないボスは入らない)
  const stageNos = () => DATA.stageRuns.map(R => R.no);
  T.bossMap = () => {
    const m = {};
    for (const R of DATA.stageRuns) for (const k of [].concat(...R.bosses)) if (!m[k]) m[k] = R.no;
    return m;
  };
  T.boss = (key, stage = T.bossMap()[key]) => {
    reset();
    startRun(stage ? 'stage' : 'escalation', stage || 1);
    for (let i = enemies.length - 1; i >= 0; i--) if (!enemies[i].obj) enemies.splice(i, 1);
    eprojs.length = 0; S.spawnT = 1e9;
    P.maxhp = P.hp = 99999;
    const b = spawnBoss(key);
    b.x = P.x + 90; b.y = P.y - 10;
    for (const k in b.ai) if (typeof b.ai[k] === 'number' && k !== 'pt' && k !== 'wind') b.ai[k] = 99;
    T.step(1 / 60);
    return b;
  };

  // ---------- 通し ----------
  // 全クラス × 特殊強化 3通り: 全部の強化 Lv3 で、特殊強化の組み合わせを r ごとにずらす。o: classes / frames / seed / pix(false で画素を見ない)/ trace
  T.classSmoke = (o = {}) => {
    const F = o.frames || 300, seed = o.seed || 1, classes = o.classes || DATA.classOrder;
    T.errs.length = 0; seen.clear(); H = 0x811c9dc5;
    let frames = 0;
    const trace = [];
    for (const cls of classes) {
      for (let r = 0; r < 3; r++) {
        T.seed(seed + r);
        tryf(cls + ' setup', () => T.setup(cls, 10));
        for (const e of enemies) { e.x = P.x + (Math.random() - 0.5) * 160; e.y = P.y + (Math.random() - 0.5) * 100; }
        P.cu = {}; P.cs = {};
        const tree = Object.assign({}, DATA.classes[cls].tree);
        if (weaponSkill()) tree.e = weaponSkill().tree;
        for (const cat in tree) { const ks = Object.keys(tree[cat].paths); for (const k of ks) P.cu[cat + '.' + k] = 3; P.cs[cat] = ks[r % ks.length]; }
        tryf(cls + ' recalc', () => recalc());
        P.hp = P.maxhp = 1000; P.sta = P.maxSta;
        const info = () => ({ run: true, cls: P.cls, mainW: P.mainW, st: P.stats, wm: P.wm[P.mainW] || {}, lvFx: P.lvFx, cuV, hasSp, wlv: P.weapons[P.mainW], atkMul: dmgMul(), cdMul: P.cdMul, atkSpd: P.atkSpd });
        for (let i = 0; i < F; i++) {
          P.ifr = 0;
          if (i === 5) { P.sk.q.cd = 0; keys._q = true; }
          if (i === 8) keys._q = false;
          if (i === 120) { P.act = null; P.sk.e.cd = 0; keys._e = true; }
          if (i === 123) keys._e = false;
          if (i % 30 === 15) { tryf(cls + ' hurt', () => hurtPlayer(20)); tryf(cls + ' burn', () => burnPlayer(3)); }
          frame(o.draw !== false && i % 3 === 0);
          if (o.trace) trace.push(cls + r + ' ' + i + ' ' + T.snap());
          if (i % 60 === 0) {
            tryf(cls + ' statuses', () => clsRT().statuses());
            tryf(cls + ' info', () => clsRT().info(info()));
            tryf(cls + ' einfo', () => WEAPON_SKILL[P.mainW] && WEAPON_SKILL[P.mainW].info(info(), wst(P.mainW).dmg));
            hashState(o.pix !== false);
            if (o.pix !== false) { const px = hashPixels(); if (o.trace) trace.push(cls + r + ' ' + i + ' px ' + px); }
          }
          frames++;
        }
      }
    }
    T.unseed();
    return { frames, errs: T.errs.slice(), hash: hex(H), trace: o.trace ? trace : undefined };
  };
  // 協力プレイの通し: players を classes の人数にして(2人目からは addPlayer)、決まった入力の記録で動かす。敵は自然に出す
  //   o: classes / frames / seed / mode / stage / pix / draw。hash には全員の位置・HP・撃破数も入れる。hurt: 1人ずつ当たった回数(全員に当たっているか)
  T.coopSmoke = (o = {}) => {
    const F = o.frames || 900, seed = o.seed || 3, classes = o.classes || ['knight', 'mage'];
    T.errs.length = 0; seen.clear(); H = 0x811c9dc5;
    T.seed(seed); reset();
    META.cls = classes[0];
    tryf('coop start', () => startRun(o.mode || 'escalation', o.stage || 1));
    for (let k = 1; k < classes.length; k++) tryf('coop add', () => addPlayer(classes[k], P.x + 36 * k, P.y + 18 * k));
    const hurt = players.map(() => 0), h0 = window.hurtPlayer;
    window.hurtPlayer = function () { const r = h0.apply(this, arguments); if (r) hurt[P.pid]++; return r; };
    let frames = 0;
    try {
      for (let i = 0; i < F; i++) {
        if (i % 30 === 0) for (const p of players) { p.hp = p.maxhp; p.dead = false; }
        const inp = players.map((p, k) => ({ mx: Math.cos(i / 70 + k * 2.1), my: Math.sin(i / 55 + k), e: i % 240 === 40 + k * 25, q: i % 480 === 100 + k * 40, def: i % 300 > 280, aim: null, autoE: false, autoQ: false }));
        frame(o.draw !== false && i % 3 === 0, inp);
        if (i % 60 === 0) { hashState(o.pix !== false); for (const p of players) { num(p.x); num(p.y); num(p.hp); num(p.kills); num(p.totalDmg); } }
        if (i % 180 === 0 && o.pix !== false) hashPixels();
        frames++;
      }
    } finally { window.hurtPlayer = h0; }
    const per = players.map(p => ({ cls: p.cls, kills: p.kills, dmg: Math.round(p.totalDmg), lv: p.level, gold: p.gold, x: Math.round(p.x), y: Math.round(p.y) }));
    T.unseed();
    return { frames, errs: T.errs.slice(), hash: hex(H), per, hurt, enemies: enemies.filter(e => !e.dead).length };
  };
  // ステージのボス: 予定をボスまで飛ばして本物の出方で出す → sec 秒戦う(半分で激昂の HP に)→ 倒して 4秒(変身・撃破の演出)
  //   どのステージにも出ないボス(第二形態を除く)は、エスカレーションの草原で spawnBoss で出す。o: stages / extra(false で出さない)/ sec / seed / pix / trace
  //   per: 1回ごとのハッシュ(どのボスでずれたか)/ pixEvery: 画素を見る間隔のフレーム数(既定 180。描画のリファクタリングは 30 などで細かく)
  T.bossSmoke = (o = {}) => {
    const sec = o.sec || 20, seed = o.seed || 7;
    T.errs.length = 0; seen.clear();
    const per = {}, trace = [];
    let frames = 0, all = 0x811c9dc5;
    const map = T.bossMap();
    const runs = [];
    for (const no of o.stages || stageNos()) for (const which of ['boss', 'final']) runs.push([no, which]);
    if (o.extra !== false) for (const k in DATA.bosses) if (!map[k] && !DATA.bosses[k].form2) runs.push([0, k]);
    for (const [no, which] of runs) {
      T.seed(seed + no * 2 + (which === 'final' ? 1 : 0));
      H = 0x811c9dc5;
      reset();
      if (no) {
        tryf('start ' + no, () => startRun('stage', no));
        const idx = S.sched.findIndex(x => (which === 'final' ? x.final : x.boss && !x.final));
        if (idx < 0) continue;
        S.schedIdx = idx; S.ptime = S.sched[idx].t;
        let n = 0;
        while (!S.boss && n++ < 900) frame(false);
      } else {
        tryf('start ' + which, () => { startRun('escalation', 1); S.spawnT = 1e9; spawnBoss(which); });
      }
      if (!S.boss) { err('no boss ' + no + ' ' + which, ''); continue; }
      let tag = (no || 'esc') + ' ' + which;
      // 倒したあとに次の形態(死神 → 終刻の死神)が出たら、それも同じように戦わせる
      for (let form = 0; form < 3 && S.boss && !S.boss.dead && S.boss.hp > 0; form++) {
        const b = S.boss, key = b.boss;
        tag += ' ' + key;
        P.maxhp = P.hp = 99999;
        const N = sec * 60;
        for (let i = 0; i < N; i++) {
          if (i === (N >> 1)) for (const x of S.bosses || [b]) if (x.hp > 0) x.hp = Math.max(x.hpFloor || 0, x.maxhp * ((x.enrage ?? 0.6) - 0.05));
          P.hp = P.maxhp;
          frame(o.draw !== false && i % 3 === 0);
          if (o.trace) trace.push(tag + ' ' + i + ' ' + T.snap());
          if (i % 60 === 0) hashState(o.pix !== false);
          if (i % (o.pixEvery || 180) === 0 && o.pix !== false) hashPixels();
          frames++;
        }
        for (const x of (S.bosses || [b]).slice()) tryf('kill ' + key, () => { x.hpFloor = 0; hitEnemy(x, 1e9, { item: true }); });
        for (let i = 0; i < 240; i++) { P.hp = P.maxhp; frame(o.draw !== false && i % 3 === 0); frames++; } // 撃破・変身の演出
        hashState(o.pix !== false);
        if (S.boss === b) break;
      }
      per[tag] = hex(H);
      all = Math.imul(all ^ H, 16777619) >>> 0;
    }
    T.unseed();
    return { frames, errs: T.errs.slice(), hash: hex(all), per, trace: o.trace ? trace : undefined };
  };
})();
