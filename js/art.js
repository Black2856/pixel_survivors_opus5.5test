// art.js — 手続き生成ドット絵。ASCII行 + パレットから canvas を生成し、自動で1pxアウトラインを付与する
'use strict';

const ART = (() => {
  const OUT = '#0c0913';

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // rows: 文字列配列 / pal: {char: color} / emit: 発光扱いの文字列(グロー層へ描く)
  function mk(pal, rows, o = {}) {
    const pad = o.outline === false ? 0 : 1;
    const w = Math.max(...rows.map(r => r.length)), h = rows.length;
    const c = canvas(w + pad * 2, h + pad * 2), x = c.getContext('2d');
    const e = o.emit ? canvas(c.width, c.height) : null, ex = e && e.getContext('2d');
    const solid = (cx, cy) => cy >= 0 && cy < h && cx >= 0 && rows[cy][cx] && rows[cy][cx] !== '.' && rows[cy][cx] !== ' ';
    if (pad) {
      x.fillStyle = OUT;
      for (let y = -1; y <= h; y++) for (let xx = -1; xx <= w; xx++) {
        if (solid(xx, y)) continue;
        if (solid(xx - 1, y) || solid(xx + 1, y) || solid(xx, y - 1) || solid(xx, y + 1)) x.fillRect(xx + pad, y + pad, 1, 1);
      }
    }
    for (let y = 0; y < h; y++) for (let xx = 0; xx < rows[y].length; xx++) {
      const ch = rows[y][xx];
      if (!pal[ch]) continue;
      x.fillStyle = pal[ch];
      x.fillRect(xx + pad, y + pad, 1, 1);
      if (e && o.emit.includes(ch)) { ex.fillStyle = pal[ch]; ex.fillRect(xx + pad, y + pad, 1, 1); }
    }
    return { c, e, w: c.width, h: c.height };
  }

  // ---------- 部位アニメーション(着せ替え式) ----------
  // 部位ごとのドット絵を、フレームごとに「位置のずらし(1ドット単位)」と「絵の差し替え」で重ねる。回転はしない
  // def.parts: { 名前: { x, y, v: { 絵の名前: rows }, hidden } }(v.base が既定の絵)/ def.order: 描く順(奥→手前)
  // def.motions: { 名前: { loop, frames: [{ t: 秒, p: { 部位: [dx, dy, 絵の名前] } }] } }
  // 重ねた後に mk() を通すので、アウトラインは全体のシルエットに1本だけ付く
  // def.padX: 左右の余白(武器など体の外に伸びる部位用)。部位の座標は体の枠(w×h)基準のまま
  function rig(def) {
    const px = def.padX || 0, W = def.w + px * 2;
    const build = p => {
      const grid = Array.from({ length: def.h }, () => Array(W).fill('.'));
      for (const name of def.order) {
        const part = def.parts[name], o = p[name];
        if (part.hidden && !o) continue;
        const [dx, dy, vn] = o || [0, 0];
        const rows = part.v[vn || 'base'];
        rows.forEach((r, ry) => {
          for (let rx = 0; rx < r.length; rx++) {
            const gx = part.x + dx + rx + px, gy = part.y + dy + ry;
            if (r[rx] !== '.' && gx >= 0 && gy >= 0 && gx < W && gy < def.h) grid[gy][gx] = r[rx];
          }
        });
      }
      return mk(def.pal, grid.map(r => r.join('')), { emit: def.emit });
    };
    const motions = {};
    for (const m in def.motions) {
      const md = def.motions[m];
      motions[m] = { loop: md.loop, dur: md.frames.reduce((a, f) => a + f.t, 0), frames: md.frames.map(f => ({ t: f.t, sp: build(f.p || {}) })) };
    }
    // pose(p): 任意の姿勢をその場で組み立てる(補間アニメーション用。同じ姿勢はキャッシュを使う)
    const poseCache = new Map();
    const pose = p => { const k = JSON.stringify(p); let sp = poseCache.get(k); if (!sp) poseCache.set(k, sp = build(p)); return sp; };
    return { motions, pose, padX: px, base: build({}) };
  }
  // 経過時間 time でのフレームを返す(loop でなければ最後のフレームで止まる)
  function rigFrame(r, motion, time) {
    const m = r.motions[motion];
    let tt = m.loop ? time % m.dur : Math.min(time, m.dur - 1e-6);
    for (const f of m.frames) { if (tt < f.t) return f.sp; tt -= f.t; }
    return m.frames[m.frames.length - 1].sp;
  }

  // 白シルエット(被弾フラッシュ用)
  function silhouette(src, col = '#fff') {
    const c = canvas(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function flipX(src) {
    const c = canvas(src.width, src.height), x = c.getContext('2d');
    x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
    return c;
  }

  // 最近傍回転(ドットを崩さずに回転フレームを事前生成)
  function rotFrames(src, n) {
    const sw = src.width, sh = src.height, S = Math.ceil(Math.hypot(sw, sh)) | 1;
    const sd = src.getContext('2d').getImageData(0, 0, sw, sh).data;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const c = canvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S);
      for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
        const dx = xx - S / 2 + 0.5, dy = y - S / 2 + 0.5;
        const sx = Math.floor(ca * dx + sa * dy + sw / 2), sy = Math.floor(-sa * dx + ca * dy + sh / 2);
        if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) continue;
        const si = (sy * sw + sx) * 4, di = (y * S + xx) * 4;
        img.data[di] = sd[si]; img.data[di + 1] = sd[si + 1]; img.data[di + 2] = sd[si + 2]; img.data[di + 3] = sd[si + 3];
      }
      x.putImageData(img, 0, 0);
      out.push(c);
    }
    return out;
  }

  // 放射グラデーション光源(色ごとにキャッシュ)
  const lightCache = {};
  function light(col) {
    if (lightCache[col]) return lightCache[col];
    const c = canvas(64, 64), x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, col); g.addColorStop(0.35, col + '88'); g.addColorStop(1, col + '00');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return (lightCache[col] = c);
  }

  // ---------- 3x5 ピクセルフォント(ダメージ数値用) ----------
  const FONT = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
    '8': '111101111101111', '9': '111101111001111', '+': '000010111010000', '!': '010010010000010',
    'K': '101101110101101', 'x': '000101010101000', '/': '001001010100100',
  };
  const glyphCache = {};
  function text(str, col, scale = 1) {
    const key = str + col + scale;
    if (glyphCache[key]) return glyphCache[key];
    const w = str.length * 4 - 1, c = canvas((w + 2) * scale, 7 * scale), x = c.getContext('2d');
    const draw = (ox, oy, fill) => {
      x.fillStyle = fill;
      for (let i = 0; i < str.length; i++) {
        const g = FONT[str[i]]; if (!g) continue;
        for (let p = 0; p < 15; p++) if (g[p] === '1') x.fillRect((ox + i * 4 + (p % 3)) * scale, (oy + ((p / 3) | 0)) * scale, scale, scale);
      }
    };
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [2, 2]]) draw(dx, dy, OUT);
    draw(1, 1, col);
    const keys = Object.keys(glyphCache);
    if (keys.length > 600) delete glyphCache[keys[0]];
    return (glyphCache[key] = c);
  }

  // ============================================================
  // スプライト定義
  // ============================================================
  const S = {};

  S.player = mk({ a: '#2a1f45', b: '#4c3a86', c: '#151022', d: '#9ff7ff', e: '#e8434f', f: '#3d2f6a', g: '#d6ae5c', h: '#1c1530', i: '#f0c9a0' }, [
    '....aaaa....',
    '...abbbbaa..',
    '..abbbbbbba.',
    '..abbcccbba.',
    '..abccdcdca.',
    '...accccca..',
    '..eeeeeeee..',
    '.eeefffffe..',
    '.ffeeffffff.',
    '.iffffggfffi',
    '..fffffffff.',
    '..ffff.ffff.',
    '...hh...hh..',
  ], { emit: 'd' });

  // ---------- クラス: サムライ(16×18、部位アニメーション) ----------
  // 右向き。髷・赤い鉢巻き(光る)・藍の道着・赤い帯・腰の刀・袴
  const UP = ['head', 'torso', 'backArm', 'frontArm', 'sheath']; // 上半身(呼吸・歩行で一緒に上下する部位)
  const up = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(UP.map(k => [k, [dx, dy]])), extra);
  S.samurai = rig({
    w: 16, h: 18, padX: 8, emit: 'eJn',
    pal: {
      a: '#1c1530', b: '#241c2e', c: '#f0c9a0', o: '#c99a78', d: '#151022', e: '#e8434f',
      f: '#2c3a6e', g: '#4a5fa8', h: '#e8e4d8', i: '#b0202e', j: '#d6ae5c', J: '#fff6c8',
      k: '#6b4a2c', p: '#8a6a2a', l: '#1e2240', m: '#2e3462', n: '#eaf4ff',
    },
    order: ['backArm', 'legs', 'torso', 'sheath', 'head', 'frontArm', 'blade'],
    parts: {
      head: { x: 3, y: 0, v: {
        base: ['.....bb..', '....bbbb.', '...bbbbbb', '.eeeeeeee', 'ee.bbccdc', '...bcccco', '....cccc.'],
        b:    ['.....bb..', '....bbbb.', 'e..bbbbbb', '.eeeeeeee', '...bbccdc', '...bcccco', '....cccc.'],
      } },
      torso: { x: 4, y: 7, v: { base: ['gfffhhhf', 'gffhhfgf', 'ffffhfgf', 'iiiiiiii', 'ffffffff'] } },
      backArm: { x: 3, y: 8, v: { base: ['fg', 'ff', 'ff', 'cc'] } },
      frontArm: { x: 10, y: 8, v: {
        base:  ['gf.', 'ff.', 'fff', '.cc'],
        grip:  ['ggf', 'fff', 'cc.'],
        slash: ['.ggff', '.fffcc'],
        high:  ['..cc', '.ff.', 'gff.'],
      } },
      // 腰の刀: 柄(j)が前に突き出し、鍔(p)、鞘(k)は後ろ下へ
      sheath: { x: 1, y: 9, v: {
        base:  ['..........jj', '........pjj.', '....kkkk....', 'kkkk........'],
        glint: ['..........JJ', '........pJJ.', '....kkkk....', 'kkkk........'],
        empty: ['............', '............', '....kkkk....', 'kkkk........'],
      } },
      legs: { x: 4, y: 12, v: {
        base:   ['llllllll', 'lllmllll', 'llmllmll', 'lll..lll', 'lll..lll', 'aaa..aaa'],
        stepA:  ['llllllll', 'lllmllll', 'llmllmll', 'lll...ll', 'll....ll', 'aa....aa'],
        stepB:  ['llllllll', 'lllmllll', 'llmllmll', '.lll.ll.', '.lll.ll.', '.aaa.aa.'],
        crouch: ['llllllll', 'llmllmll', 'lll..lll', 'aaa..aaa'],
      } },
      // 抜いた刀(光る)。thrust = 前へ水平 / up = 振り抜いて斜め上。体の枠の外(padX)まで伸びる
      blade: { x: 16, y: 10, hidden: true, v: {
        thrust: ['pnnnnnnnn'],
        up:     ['....nn', '...nn.', '..nn..', '.nn...', 'nn....', 'p.....'],
      } },
    },
    motions: {
      // 待機: 呼吸で上半身が1ドット沈み、鉢巻きの結び目が揺れる
      idle: { loop: true, frames: [
        { t: 0.4 }, { t: 0.4, p: up(0, 0, { head: [0, 0, 'b'] }) },
        { t: 0.4, p: up(0, 1, { head: [0, 1, 'b'] }) }, { t: 0.4, p: up(0, 1) },
      ] },
      // 歩き: 足を踏み出すフレームで上半身が沈む。奥の腕を振る
      walk: { loop: true, frames: [
        { t: 0.11, p: up(0, 1, { legs: [0, 0, 'stepA'], backArm: [-1, 1] }) },
        { t: 0.11, p: up(0, 0, { head: [0, 0, 'b'] }) },
        { t: 0.11, p: up(0, 1, { legs: [0, 0, 'stepB'], backArm: [1, 1] }) },
        { t: 0.11, p: up(0, 0, { head: [0, 0, 'b'] }) },
      ] },
      // 居合(Q): 低く構えて柄に手をかける → 柄が光る → 踏み込んで抜刀(刀身が前へ) → 振り抜き(斜め上) → 納刀
      iai: { loop: false, frames: [
        { t: 0.1, p: up(0, 1, { legs: [0, 1, 'crouch'], frontArm: [0, 1, 'grip'] }) },
        { t: 0.25, p: up(0, 2, { legs: [0, 2, 'crouch'], frontArm: [0, 2, 'grip'], head: [0, 2, 'b'] }) },
        { t: 0.12, p: up(0, 2, { legs: [0, 2, 'crouch'], frontArm: [0, 2, 'grip'], sheath: [0, 2, 'glint'] }) },
        { t: 0.1, p: up(1, 1, { legs: [0, 0, 'stepA'], frontArm: [0, 1, 'slash'], sheath: [0, 1, 'empty'], blade: [0, 0, 'thrust'] }) },
        { t: 0.3, p: up(1, 1, { legs: [0, 0, 'stepA'], frontArm: [0, -2, 'high'], sheath: [0, 1, 'empty'], head: [1, 1, 'b'], blade: [-2, -10, 'up'] }) },
        { t: 0.15, p: up(0, 0, { sheath: [0, 0, 'empty'] }) },
        { t: 0.2, p: up(0, 0, { sheath: [0, 0, 'glint'] }) },
      ] },
    },
  });

  // ---------- クラス: メイジ(16×18、部位アニメーション) ----------
  // 右向き。先の折れたとんがり帽子・影の中の光る目・青いローブと金の縁取り・手元の宝珠(光る)
  const MUP = ['hat', 'head', 'torso', 'backArm', 'frontArm', 'orb'];
  const mup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(MUP.map(k => [k, [dx, dy]])), extra);
  S.mage = rig({
    w: 16, h: 18, padX: 8, emit: 'dD',
    pal: {
      b: '#3b2a7a', B: '#5a44a8', c: '#d6ae5c', d: '#9ff7ff', D: '#ffffff', e: '#140f24',
      f: '#2b3f8f', g: '#4d6fd0', h: '#d6ae5c', i: '#f0c9a0', k: '#1c1530',
    },
    order: ['backArm', 'legs', 'torso', 'head', 'hat', 'frontArm', 'orb'],
    parts: {
      // 帽子: 先が後ろ(左)へ折れる。b = 先が揺れた絵
      hat: { x: 1, y: 0, v: {
        base: ['.bb..........', '..bbb........', '....bbb......', '.....bbbb....', '....bbBbbb...', '...ccccccccc.', 'bbbbbbbbbbbbb'],
        b:    ['bb...........', '.bbb.........', '....bbb......', '.....bbbb....', '....bbBbbb...', '...ccccccccc.', 'bbbbbbbbbbbbb'],
      } },
      head: { x: 4, y: 7, v: { base: ['eeeeeee', 'eeeeded', '.eeeee.'] } }, // 影の中の目(光る)
      torso: { x: 4, y: 10, v: { base: ['fgffhfff', 'fgffhfff', 'ffffhfff'] } },
      backArm: { x: 3, y: 10, v: { base: ['gf', 'ff', 'ii'] } },
      frontArm: { x: 10, y: 10, v: {
        base:    ['fg.', 'ff.', '.ii'],
        forward: ['.gfff', '.ffii'],
        raise:   ['..ii', '.ff.', 'fg..'],
      } },
      // 宝珠(光る)。big = 詠唱中の大きい光
      orb: { x: 12, y: 12, v: {
        base: ['.d.', 'dDd', '.d.'],
        big:  ['.dd.', 'dDDd', 'dDDd', '.dd.'],
      } },
      legs: { x: 3, y: 13, v: {
        base:  ['.ffffhff..', '.fgffhfff.', 'ffgffhffff', 'hhhhhhhhhh', '.kk...kk..'],
        stepA: ['.ffffhff..', '.fgffhfff.', 'ffgffhffff', 'hhhhhhhhhh', 'kk.....kk.'],
        stepB: ['.ffffhff..', '.fgffhfff.', 'ffgffhffff', 'hhhhhhhhhh', '..kk.kk...'],
      } },
    },
    motions: {
      // 待機: 呼吸で上半身が沈み、宝珠がふわりと浮き沈みする。帽子の先が揺れる
      idle: { loop: true, frames: [
        { t: 0.45 }, { t: 0.45, p: mup(0, 0, { hat: [0, 0, 'b'], orb: [0, -1] }) },
        { t: 0.45, p: mup(0, 1, { orb: [0, 0] }) }, { t: 0.45, p: mup(0, 1, { hat: [0, 1, 'b'], orb: [0, 1] }) },
      ] },
      walk: { loop: true, frames: [
        { t: 0.12, p: mup(0, 1, { legs: [0, 0, 'stepA'], backArm: [-1, 1] }) },
        { t: 0.12, p: mup(0, 0, { hat: [0, 0, 'b'] }) },
        { t: 0.12, p: mup(0, 1, { legs: [0, 0, 'stepB'], backArm: [1, 1] }) },
        { t: 0.12, p: mup(0, 0, { hat: [0, 0, 'b'] }) },
      ] },
    },
  });
  S.mage.alias = { ranbu: 'mBarrage', iai: 'mMeteor', aRain: 'mMeteor', aVolley: 'mMeteor', aStep: 'mBlink', kSlam: 'mMeteor', kVerdict: 'mMeteor' }; // 他クラスの武器スキルを使ったときの代わりのモーション

  // ---------- クラス: アーチャー(16×18、部位アニメーション) ----------
  // 右向き。緑のフード(影の中で緑の目が光る)・背中のマントと矢筒・手に長弓
  // スキルのモーション中は長弓を部位ではなく、任意の角度で描く(render.js の drawPose)。敵の弓兵(S.archer)と区別して S.hunter
  const AUP = ['head', 'torso', 'backArm', 'frontArm', 'quiver', 'bow', 'cape'];
  const aup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(AUP.map(k => [k, [dx, dy]])), extra);
  S.hunter = rig({
    w: 16, h: 18, padX: 8, emit: 'E',
    pal: {
      h: '#2f7a3a', H: '#4fae5a', e: '#0f1a12', E: '#9dffb0', f: '#3d6a2a', F: '#5a8f3a', b: '#6b4a2c',
      g: '#1f4a2a', k: '#6b4a2c', w: '#e8e4d8', r: '#e8434f', c: '#f0c9a0', l: '#3a2e24', a: '#1c1530', o: '#a0703a', s: '#e8e4d8',
    },
    order: ['cape', 'quiver', 'backArm', 'legs', 'torso', 'head', 'bow', 'frontArm'],
    parts: {
      cape: { x: 2, y: 7, v: {
        base: ['.gg', 'ggg', 'ggg', 'ggg', 'ggg', '.gg', '..g'],
        b:    ['..g', '.gg', 'ggg', 'ggg', 'ggg', 'gg.', 'g..'],
      } },
      quiver: { x: 3, y: 4, v: { base: ['wr', 'kk', 'kk', 'kk', 'kk', '.k'] } },
      head: { x: 4, y: 0, v: {
        base: ['...hhh..', '..hHhhh.', '.hHhhhhh', 'hhhheeee', 'hhheEeeE', '.hhheeee', '..hhhhh.'],
      } },
      torso: { x: 5, y: 7, v: { base: ['fFffff', 'fFffff', 'fFffff', 'bbbbbb', 'ffffff'] } },
      backArm: { x: 4, y: 8, v: { base: ['f', 'f', 'c'] } },
      frontArm: { x: 10, y: 8, v: {
        base: ['ff', 'ff', 'cc'],
        aim:  ['ffcc'],
        sky:  ['.cc', 'ff.', 'f..'],
      } },
      // 待機・歩きで持っている長弓(縦)。s = 弦、o = 木
      bow: { x: 12, y: 5, hidden: true, v: { base: ['so.', 's.o', 's.o', 's.o', 's.o', 's.o', 's.o', 's.o', 'so.'] } },
      legs: { x: 5, y: 12, v: {
        base:  ['llllll', 'llllll', 'll..ll', 'll..ll', 'll..ll', 'aa..aa'],
        stepA: ['llllll', 'llllll', 'll...l', 'l....l', 'l....l', 'a....a'],
        stepB: ['llllll', 'llllll', '.ll.l.', '.ll.l.', '.ll.l.', '.aa.a.'],
      } },
    },
    motions: {
      // 待機: 呼吸で上半身が沈み、マントが揺れる
      idle: { loop: true, frames: [
        { t: 0.45, p: aup(0, 0) }, { t: 0.45, p: aup(0, 0, { cape: [0, 0, 'b'] }) },
        { t: 0.45, p: aup(0, 1) }, { t: 0.45, p: aup(0, 1, { cape: [0, 1, 'b'] }) },
      ] },
      walk: { loop: true, frames: [
        { t: 0.11, p: aup(0, 1, { legs: [0, 0, 'stepA'], backArm: [-1, 1], cape: [-1, 1, 'b'] }) },
        { t: 0.11, p: aup(0, 0) },
        { t: 0.11, p: aup(0, 1, { legs: [0, 0, 'stepB'], backArm: [1, 1], cape: [0, 1, 'b'] }) },
        { t: 0.11, p: aup(0, 0, { cape: [0, 0, 'b'] }) },
      ] },
    },
  });
  // 他クラスの武器スキルを使ったときの代わりのモーション
  S.hunter.alias = { ranbu: 'aRain', mBarrage: 'aRain', iai: 'aVolley', mMeteor: 'aVolley', mBlink: 'aStep', kSlam: 'aRain', kVerdict: 'aVolley' };

  // ---------- クラス: ナイト(16×18、部位アニメーション) ----------
  // 右向き(左半身が手前)。面頬の兜(隙間の目が光る)・銀の板金鎧・青い陣羽織に金の十字・手前の腕に凧形の大盾・奥の手に騎士剣
  // スキルのモーション中は騎士剣を角度付きで描く(drawPose の刀身と同じ)
  const KUP = ['helm', 'torso', 'backArm', 'sword', 'shield'];
  const kup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(KUP.map(k => [k, [dx, dy]])), extra);
  S.knight = rig({
    w: 16, h: 18, padX: 8, emit: 'EG',
    pal: {
      m: '#9eabc4', M: '#d6dff0', d: '#5e6a86', e: '#151022', E: '#ffffff', t: '#2c4aa0', g: '#f2c84b', G: '#fff1a0',
      s: '#3a5ab8', k: '#6b4a2c', l: '#8793b0', a: '#3e4763', w: '#dfe8f5',
    },
    order: ['sword', 'backArm', 'legs', 'torso', 'helm', 'shield'],
    parts: {
      helm: { x: 4, y: 0, v: {
        base: ['...gg...', '..mmmm..', '.mMmmmmm', '.mmmeEeE', '.mmmmmmm', '..mdmmm.', '...ddd..'],
      } },
      torso: { x: 4, y: 7, v: { base: ['mttgtttm', 'mtgggttm', 'mttgtttm', 'kkkkkkkk', 'dttttttd'] } },
      backArm: { x: 3, y: 8, v: { base: ['m', 'm', 'k'] } },
      // 待機・歩きで持っている騎士剣(背中側に立てる)
      sword: { x: 1, y: 2, hidden: true, v: { base: ['.w.', '.w.', '.w.', '.w.', '.w.', '.w.', 'gkg'] } },
      // 凧形の大盾。guard / up は紋章が光る
      shield: { x: 10, y: 8, v: {
        base:  ['dddddd', 'dsgssd', 'dgggsd', 'dsgssd', 'dsssd.', '.dssd.', '..dd..'],
        guard: ['dddddd', 'dsGssd', 'dGGGsd', 'dsGssd', 'dsssd.', '.dssd.', '..dd..'],
      } },
      legs: { x: 4, y: 12, v: {
        base:  ['llllllll', 'lll..lll', 'lll..lll', 'll....ll', 'll....ll', 'aa....aa'],
        stepA: ['llllllll', 'lll..lll', 'll....ll', 'll.....l', 'l......l', 'a......a'],
        stepB: ['llllllll', 'lll..lll', '.ll..ll.', '.ll..ll.', '.ll..ll.', '.aa..aa.'],
      } },
    },
    motions: {
      // 待機: 重い呼吸(ゆっくり)
      idle: { loop: true, frames: [{ t: 0.6, p: kup(0, 0) }, { t: 0.6, p: kup(0, 1) }] },
      // 歩き: 重い足取り
      walk: { loop: true, frames: [
        { t: 0.15, p: kup(0, 1, { legs: [0, 0, 'stepA'] }) }, { t: 0.15, p: kup(0, 0) },
        { t: 0.15, p: kup(0, 1, { legs: [0, 0, 'stepB'] }) }, { t: 0.15, p: kup(0, 0) },
      ] },
    },
  });
  S.knight.guard = kup(0, 1, { shield: [1, -2, 'guard'], legs: [0, 0, 'stepB'] }); // 大盾を構えた姿勢
  S.knight.alias = { ranbu: 'kSlam', mBarrage: 'kSlam', aRain: 'kSlam', iai: 'kVerdict', mMeteor: 'kVerdict', aVolley: 'kVerdict' };

  S.zombie = mk({ a: '#3d2f24', b: '#7fb069', c: '#ff4040', d: '#2b3a22', e: '#6b5a8e', f: '#3a3350', g: '#241c2e' }, [
    '...aaaa...',
    '..abbbba..',
    '..bcbbcb..',
    '..bbbbbb..',
    '..bbddbb..',
    '...bbbb...',
    '.eeeeeebbb',
    '.eeeeee...',
    '..eeeee...',
    '..ff.ff...',
    '.gg..gg...',
  ], { emit: 'c' });

  const batPal = { a: '#2a1838', b: '#8a4fc0', c: '#ffe14a' };
  S.bat = [mk(batPal, [
    'b.........b',
    'bb.......bb',
    'bbb.a.a.bbb',
    '.bbbaaabbb.',
    '...acaca...',
    '....aaa....',
  ], { emit: 'c' }), mk(batPal, [
    '....a.a....',
    '...aaaaa...',
    '...acaca...',
    '.bbbaaabbb.',
    'bbb.aaa.bbb',
    'b.........b',
  ], { emit: 'c' })];

  const slimePal = { a: '#23735f', b: '#4fd6a8', c: '#d8fff2', d: '#0f2a26' };
  S.slime = mk(slimePal, [
    '....aaa....',
    '..aabbbaa..',
    '.abbbbbcba.',
    '.abbbbbbca.',
    'abbdbbbdbba',
    'abbdbbbdbba',
    'abbbbbbbbba',
    '.aaaaaaaaa.',
  ], { emit: 'c' });
  S.slimelet = mk(slimePal, [
    '..aaa..',
    '.abbca.',
    'abdbdba',
    'abbbbba',
    '.aaaaa.',
  ]);

  S.skeleton = mk({ a: '#e8e6da', b: '#ff5a3a', c: '#6b6a60' }, [
    '...aaaa...',
    '..aaaaaa..',
    '..abaaba..',
    '..aaaaaa..',
    '...acaca..',
    '....aa....',
    '..aaaaaa..',
    '.a.acaca.a',
    '.a.aaaaa.a',
    '...acaca..',
    '...a..a...',
    '..aa..aa..',
  ], { emit: 'b' });

  S.archer = mk({ a: '#e8e6da', b: '#ffb13a', c: '#6b6a60', d: '#35523d', e: '#a0703a', f: '#d9d2b0' }, [
    '...dddd.....',
    '..dddddd.e..',
    '..daaaad..e.',
    '..abaaba..e.',
    '..aaaaaa..f.',
    '...acaca..e.',
    '..dddddd..e.',
    '.adddddddae.',
    '...dddddd.e.',
    '...dd..dde..',
    '...a....a...',
    '..aa...aa...',
  ], { emit: 'b' });

  S.ghost = mk({ a: '#c6f7f2', b: '#16324a', c: '#8fd9e0' }, [
    '...aaaa...',
    '..aaaaaa..',
    '.aaaaaaaa.',
    '.abbaabba.',
    '.abbaabba.',
    '.aaaaaaaa.',
    '.aaaabaaa.',
    '.aaaaaaaa.',
    '.caaaaaac.',
    '.ca.aa.ac.',
    '.c..cc..c.',
  ], { emit: 'a' });

  S.brute = mk({ a: '#5a2a1a', b: '#c46a4a', c: '#ffe14a', d: '#3a1510', e: '#fff4d6', f: '#6b4a2a', g: '#caa24a', h: '#3a1a10' }, [
    '....aaaaaaa.....',
    '...abbbbbbba....',
    '..abbcbbbcbba...',
    '..abbbbbbbbba...',
    '..abbddddddba...',
    '...abdeddeba....',
    '..aabbbbbbbaa...',
    '.abbbbbbbbbbba..',
    'abbbbffffffbbba.',
    'abb.ffffffff.bba',
    'ab..fggggggf..ba',
    'bb..ffffffff..bb',
    '....ffff.fff....',
    '....fff...fff...',
    '...hhh....hhh...',
  ], { emit: 'c' });

  S.imp = mk({ a: '#2a1a1a', b: '#ff6a3d', c: '#8a2a4a', d: '#ffff80', e: '#5a1010' }, [
    'a.........a',
    '.a..bbb..a.',
    '..abbbbba..',
    'c.bdbbbdb.c',
    'cc.bbebb.cc',
    'ccc.bbb.ccc',
    '...bbbbb...',
    '....b.b....',
    '...bb.bb...',
  ], { emit: 'd' });

  S.goblin = mk({ a: '#5a8a3a', b: '#8fd06a', c: '#ffffff', d: '#ffcc33', e: '#b8861a', m: '#2a1a1a', f: '#6a3a8a', g: '#3a2a1a' }, [
    '.aa...aa....',
    '.abbbbba..d.',
    '..bcbbcb.ddd',
    '..bbbbbb.ded',
    '...bmmb.dddd',
    '..ffffff.dd.',
    '.bffffffb...',
    '..ffffff....',
    '..ff..ff....',
    '.gg...gg....',
  ], { emit: 'd' });

  S.king = mk({ a: '#ffd23f', b: '#ff3b5c', c: '#7fae4e', d: '#2c3a1e', e: '#ffe14a', f: '#3a1a14', g: '#e8e0c0', h: '#5b2a7a', i: '#b8d86a', j: '#3a2a2a', k: '#1e1414' }, [
    '....a..a..a..a......',
    '....aa.aa.aa.aa.....',
    '....aaaaaaaaaaaa....',
    '....abaaabaaabaa....',
    '...cccccccccccccc...',
    '..cccdddccccdddccc..',
    '..cccdedccccdedccc..',
    '..cccdddccccdddccc..',
    '..cccccccccccccccc..',
    '..ccccfffffffffccc..',
    '..cccfgfgfgfgfgfcc..',
    '...ccfffffffffffc...',
    '..hhhhcccccccchhhh..',
    '.hhhhhcciicccchhhhh.',
    'hhhhhcccccccicchhhhh',
    'hhhhccccccccccccchhh',
    'hhhhcciccccccccchhhh',
    'hhhhhccccccicccchhhh',
    '.hhhhhccccccccchhhh.',
    '..hhhhjjjj.jjjjhhh..',
    '......jjjj.jjjj.....',
    '.....kkkkk.kkkkk....',
  ], { emit: 'ea' });

  S.wyrm = mk({ a: '#efe9d4', b: '#2a2a3a', c: '#6ee7ff', d: '#8a8676' }, [
    '....a.............a.....',
    '....aa...........aa.....',
    '.....aa.........aa......',
    '......aaaaaaaaaaa.......',
    '.....aaaaaaaaaaaaa......',
    '....aaabbaaaaabbaaa.....',
    '....aabccbaaabccbaa.....',
    '....aaabbaaaaabbaaa.....',
    '.....aaaaaaaaaaaaa......',
    '......abababababa.......',
    '.......aaaaaaaaa........',
    'dd....dabababababd....dd',
    'ddd..ddaaaaaaaaadd..ddd.',
    '.ddddd.a.a.a.a.a.ddddd..',
    '..ddd..aaaaaaaaa..ddd...',
    '...d...a.a.a.a.a...d....',
    '.......aaaaaaaaa........',
    '........a.a.a.a.........',
    '.........aaaaa..........',
    '..........aaa...........',
  ], { emit: 'c' });

  S.reaper = mk({ a: '#d8dce8', b: '#2b1b4a', c: '#e8e6da', d: '#c29bff', f: '#6a4a2a', g: '#3e2a66' }, [
    'aaaaaaa...........',
    '.aaaaaaaa.........',
    '...aaa.aff........',
    '........ff........',
    '.....bbbbfb.......',
    '....bbbbbbfb......',
    '...bbcccccfb......',
    '...bccdcdcfcb.....',
    '...bcccccfccb.....',
    '...bbcccffcbb.....',
    '...bbbbbfbbbb.....',
    '..bbgbbbfbbgbb....',
    '..bbgbbfbbbgbb....',
    '.bbbgbbfbbbgbbb...',
    '.bbgbbfbbbbbgbb...',
    '.bbgbbfbbbbbgbbb..',
    'bbbgbfbbbbbbbgbb..',
    'bbgbbfbbbbbbbgbbb.',
    'bbgbfbbbbbbbbbgbb.',
    '.b.b.bb.bb.bb.b...',
  ], { emit: 'd' });

  // 左半分の行を左右対称に展開
  const sym = rows => rows.map(r => r + [...r].reverse().join(''));

  S.gslime = mk({ a: '#1f6e58', b: '#4fd6a8', c: '#d8fff2', d: '#0f2a26', e: '#ffd23f', f: '#ff4a6a' }, sym([
    '........e.e',
    '........eee',
    '.......aefe',
    '.....aabbbb',
    '....abbbbbb',
    '...abbbbbbb',
    '..abbbbbbbb',
    '..abbbddbbb',
    '.abbbbddbbb',
    '.abbbbbbbbb',
    '.abbbbbbbdd',
    'abbcbbbbbbb',
    'abcbbbbbbbb',
    'abbbbbbbbbb',
    '.aabbbbbbbb',
    '...aaaaaaaa',
  ]), { emit: 'cef' });

  S.golem = mk({ a: '#241f1c', b: '#544c44', c: '#7a6f60', d: '#6ee7ff', f: '#3f6e3c' }, sym([
    '.......abbb',
    '......abccc',
    '......abddb',
    '......abbbb',
    '...aaaaabff',
    '..abbbbbbbb',
    '.abccbbbbbd',
    'abccbbbbbbd',
    'abcbb.abbbd',
    'abbba.abbbb',
    'accca.abfbb',
    'acdca.abbbb',
    '.aaa..abbbb',
    '......abbb.',
    '......abba.',
    '.....abbba.',
    '.....aaaaa.',
  ]), { emit: 'd' });

  S.cdragon = mk({ a: '#1a0a1e', b: '#5a1a4a', c: '#a0306a', d: '#ff4a8a', e: '#ffd23f', f: '#2a1030', g: '#7a3aa0', h: '#e8e0d0' }, sym([
    '.g.........h..',
    'gg.........hh.',
    'gfg.......bhcc',
    'gffg.....bcccc',
    'gfffg...bcceec',
    'gffffg.bcccccc',
    'gfffffgbcchchc',
    'gffffffbbcdddc',
    '.gffffbbccccdc',
    '..gfffbcccccdc',
    '...gffbcccccdc',
    '....gbbcccccdc',
    '.....bccbcccdc',
    '.....bcb.bccdc',
    '....bcb..bccbc',
    '...hhb...bcb.b',
    '.........hh...',
  ]), { emit: 'deg' });

  // ---------- 弾・エフェクト ----------
  S.bolt = mk({ a: '#2d8cff', b: '#7ad7ff', c: '#ffffff' }, ['.aba.', 'abcba', 'bcccb', 'abcba', '.aba.'], { outline: false, emit: 'abc' });
  S.boltEvo = mk({ a: '#b04dff', b: '#ff9bf5', c: '#ffffff' }, ['.aba.', 'abcba', 'bcccb', 'abcba', '.aba.'], { outline: false, emit: 'abc' });
  S.axe = mk({ a: '#6a4424', b: '#cfd6e0', c: '#8d97a6', d: '#ffffff' }, [
    '..bbb....',
    '.bdbbc...',
    'bdbbbca..',
    'bbbbca...',
    '.ccca.a..',
    '....a..a.',
    '.....a..a',
    '......a..',
  ]);
  S.blade = mk({ a: '#e8f0ff', b: '#8ea6d8', c: '#ffffff' }, [
    '...a...',
    '...ab..',
    'bb.cb..',
    '.accca.',
    '..bc.bb',
    '..ba...',
    '...a...',
  ], { emit: 'c' });
  S.bladeEvo = mk({ a: '#fff2a8', b: '#ffc93a', c: '#ffffff' }, [
    '...a...',
    '...ab..',
    'bb.cb..',
    '.accca.',
    '..bc.bb',
    '..ba...',
    '...a...',
  ], { emit: 'abc' });
  S.fire = mk({ a: '#b8261a', b: '#ff6a2a', c: '#ffc34a', d: '#fff6c8' }, ['..aa..', '.abba.', 'abccba', 'abcdcb', '.bcdc.', '..cc..'], { outline: false, emit: 'abcd' });
  S.wisp = mk({ a: '#2fbf8a', b: '#9dffcf', c: '#ffffff' }, ['.aba.', 'abcba', 'bcccb', 'abcba', '.aba.'], { outline: false, emit: 'abc' });
  S.ball = mk({ a: '#a0122a', b: '#ff3b5c', c: '#ffc0c8' }, ['.aba.', 'abcba', 'bcccb', 'abcba', '.aba.'], { outline: false, emit: 'abc' });
  S.arrow = mk({ a: '#8a6a3a', b: '#e8e6da', c: '#ffb13a' }, ['c.....', '.aaaab', 'c.....']);
  S.scythe = mk({ a: '#c29bff', b: '#ffffff', c: '#5a3a9a' }, ['..aaa..', '.a...a.', 'b.....a', '.....ca', '....c..', '...c...'], { emit: 'ab' });
  S.glob = mk({ a: '#23735f', b: '#4fd6a8', c: '#d8fff2' }, ['.aba.', 'abcba', 'bcccb', 'abcba', '.aba.'], { emit: 'bc' });
  S.rock = mk({ a: '#241f1c', b: '#544c44', c: '#7a6f60', d: '#6ee7ff' }, ['...aaaa...', '..abbcba..', '.abbccbba.', 'abbbbbbbba', 'abdbbbbcba', 'abbbbbdbba', '.abbbbbba.', '..aaaaaa..'], { emit: 'd' });
  S.rbit = mk({ b: '#7a7266', c: '#a89e8c' }, ['cb', 'bb']);
  S.fist = mk({ a: '#241f1c', b: '#544c44', c: '#7a6f60', d: '#6ee7ff' }, ['.aaaa.', 'abccba', 'acccca', 'acddca', 'abccba', '.aaaa.'], { emit: 'd' });
  S.flake =mk({ a: '#bff4ff', b: '#ffffff' }, ['.a.a.', 'aabaa', '.bbb.', 'aabaa', '.a.a.'], { outline: false, emit: 'ab' });

  // ---------- ドロップ ----------
  const gem = (a, b, c) => mk({ a, b, c }, ['..a..', '.abb.', 'abbcb', '.abb.', '..a..'], { emit: 'bc' });
  S.gem = [gem('#1d6fd8', '#4cc3ff', '#e0fbff'), gem('#1f9a4a', '#5dff8a', '#eaffea'), gem('#b0203a', '#ff5d73', '#ffe0e6'), gem('#b88a1a', '#ffd23f', '#fffbe0')];
  const coinPal = { a: '#8a5a10', b: '#ffcc33', c: '#fff4b0' };
  S.coin = [mk(coinPal, ['.aaa.', 'abbca', 'abcba', 'abbba', '.aaa.'], { emit: 'bc' }), mk(coinPal, ['.a.', 'aca', 'aba', 'aba', '.a.'], { emit: 'bc' })];
  S.meat = mk({ a: '#e8e0c0', b: '#c2483a', c: '#ff8a6a', d: '#7a2a20' }, ['....bbb.', '..bbccbb', '.bbcbbbb', '.bbbbbdb', 'aabbbdd.', 'aa.dd...']);
  S.magnet = mk({ a: '#e8434f', b: '#dcdcdc', c: '#ff8a8a' }, ['.aaaa.', 'acaaca', 'aa..aa', 'aa..aa', 'bb..bb']);
  S.bomb = mk({ a: '#2a2a3a', b: '#4a4a66', c: '#ffcc33', d: '#ff6a2a' }, ['....cd', '...a..', '.aaaa.', 'abbaaa', 'abaaaa', 'aaaaaa', '.aaaa.'], { emit: 'cd' });
  S.chest = mk({ a: '#5a3414', b: '#a8642a', c: '#ffd23f', d: '#2a1808' }, [
    '.aaaaaaaaa.',
    'abbbbbbbbba',
    'abbbbbbbbba',
    'accccccccca',
    'abbbbcbbbba',
    'abbbcdcbbba',
    'abbbbbbbbba',
    'aaaaaaaaaaa',
  ], { emit: 'c' });
  S.orb = mk({ a: '#5a1a8a', b: '#b06ef0', c: '#ffc8ff', d: '#ffffff' }, ['..aaa..', '.abbba.', 'abbccba', 'abcddba', 'abbccba', '.abbba.', '..aaa..'], { emit: 'bcd' });
  const brzPal = { a: '#3a3040', b: '#6a6070', c: '#ff6a2a', d: '#ffc34a', e: '#fff6c8' };
  S.brazier = [mk(brzPal, ['...c...', '..cdc..', '.cdedc.', '.cdedc.', 'bbbbbbb', '.aaaaa.', '..aaa..', '..a.a..', '.aa.aa.'], { emit: 'cde' }),
    mk(brzPal, ['..c....', '..cdc..', '.cdedc.', '..ded..', 'bbbbbbb', '.aaaaa.', '..aaa..', '..a.a..', '.aa.aa.'], { emit: 'cde' })];

  // ---------- アイコン(9x9) ----------
  const I = {};
  I.bolt = mk({ a: '#2d8cff', b: '#7ad7ff', c: '#ffffff' }, ['....a....', '...aba...', '..abcba..', '.abcccba.', 'abcccccba', '.abcccba.', '..abcba..', '...aba...', '....a....']);
  I.blade = S.blade;
  I.thunder = mk({ a: '#ffe14a', b: '#fffbd0' }, ['....aaa..', '...aba...', '..aba....', '.aabaaa..', '..aaaba..', '....aba..', '...aba...', '..aa.....', '.a.......']);
  I.aura = mk({ a: '#ffe38a', b: '#fff8d8', c: '#b89a3a' }, ['..aaaaa..', '.a.....a.', 'a..bbb..a', 'a.b...b.a', 'a.b.c.b.a', 'a.b...b.a', 'a..bbb..a', '.a.....a.', '..aaaaa..']);
  I.axe = S.axe;
  I.wisp = mk({ a: '#2fbf8a', b: '#9dffcf', c: '#ffffff' }, ['....b....', '...bb....', '..bbab...', '..babb...', '.bbcbbb..', '.bcccbb..', '.bbcccb..', '..bbbb...', '...bb....']);
  I.fire = mk({ a: '#b8261a', b: '#ff6a2a', c: '#ffc34a', d: '#fff6c8' }, ['....a....', '...ab....', '...abb.a.', '..abbbab.', '.abbcbbb.', '.abccbcb.', '.abcddcb.', '..bcddc..', '...cccc..']);
  I.blizzard = mk({ a: '#bff4ff', b: '#ffffff', c: '#5ab4e0' }, ['....a....', '.a..a..a.', '..a.b.a..', '...cbc...', 'aabbbbbaa', '...cbc...', '..a.b.a..', '.a..a..a.', '....a....']);
  I.bhole = mk({ a: '#c78bff', b: '#1a0a2a', c: '#6a3aa0' }, ['...aaa...', '.aacccaa.', '.acbbbca.', 'acbbbbbca', 'acbbbbbca', 'acbbbbbca', '.acbbbca.', '.aacccaa.', '...aaa...']);
  I.katana = mk({ a: '#e8f0ff', b: '#ff5d73', c: '#3a2a2a', d: '#ffd23f' }, ['........a', '.......aa', '......aa.', '.....aa..', '....aa...', '...aa....', '.dd......', '.bd......', 'bc.......']);
  I.longbow = mk({ o: '#a0703a', s: '#e8e4d8', d: '#d9c9a0', t: '#e8f4ff', g: '#7dff9a' }, ['...oo....', '..o.s....', '.o..s....', '.o..s..t.', 'gddddddtt', '.o..s..t.', '.o..s....', '..o.s....', '...oo....']);
  I.longsword = mk({ w: '#dfe8f5', M: '#ffffff', g: '#f2c84b', k: '#6b4a2c' }, ['....w....', '...wMw...', '...wMw...', '...wMw...', '...wMw...', '...wMw...', '.ggggggg.', '....k....', '...kgk...']);
  I.gold = S.coin[0];
  // 装備の種類(9×9)。指輪は宝石の色だけ変える
  const ringIc = gem => mk({ a: '#d6ae5c', b: '#fff3a0', c: gem, d: '#ffffff' }, ['...ccc...', '..cdcc...', '...ccc...', '..aabaa..', '.a.....a.', 'a.......a', 'a.......a', '.a.....a.', '..aaaaa..']);
  S.eqIcons = {
    sword: mk({ a: '#dfe8f5', b: '#8a9ab8', c: '#d6ae5c', d: '#6b4a2c' }, ['........a', '.......ab', '......ab.', '.....ab..', '....ab...', '.c.ab....', '..cb.....', '.dcc.....', 'd........']),
    staff: mk({ a: '#7ad7ff', b: '#ffffff', c: '#6b4a2c', d: '#d6ae5c' }, ['......aa.', '.....abba', '.....abaa', '....dcaa.', '...cd....', '..cc.....', '.cc......', 'cc.......', 'c........']),
    bow:   mk({ a: '#a0703a', b: '#d9d2b0', c: '#6b4a2c' }, ['..aa.....', '.a..b....', 'a....b...', 'a.....b..', 'c......b.', 'a.....b..', 'a....b...', '.a..b....', '..aa.....']),
    heavy: mk({ a: '#9fb8d0', b: '#e8f4ff', c: '#5a6a80' }, ['.aa...aa.', 'abaaaaaba', 'aabbbbbaa', '.abbcbba.', '.abbcbba.', '.abbcbba.', '.aabbbaa.', '.acaaaca.', '..a...a..']),
    light: mk({ a: '#a0703a', b: '#d9a060', c: '#6b4a2c' }, ['.aa...aa.', 'aba...aba', 'abbaaabba', '.abbcbba.', '.abbcbba.', '.abbbbba.', '.abbbbba.', '.aaaaaaa.', '.........']),
    robe:  mk({ a: '#3b2a7a', b: '#6a5ab0', c: '#d6ae5c' }, ['...aaa...', '..abcba..', '.abbcbba.', '.abbcbba.', 'abbbcbbba', 'abbbcbbba', 'abbbcbbba', 'abbccbcba', 'aaaaaaaaa']),
    ruby: ringIc('#ff3b5c'), sapphire: ringIc('#5ab8ff'), emerald: ringIc('#5dff8a'),
  };
  S.icons = I;

  // 派生キャッシュ(白シルエット / 左右反転)
  const cache = new Map();
  function variant(sp, kind) {
    const k = sp.c;
    let v = cache.get(k);
    if (!v) cache.set(k, v = {});
    if (!v[kind]) v[kind] = kind === 'white' ? silhouette(sp.c) : kind === 'flip' ? flipX(sp.c)
      : kind === 'flipE' ? (sp.e ? flipX(sp.e) : null) : kind === 'whiteFlip' ? silhouette(flipX(sp.c)) : kind === 'shadow' ? silhouette(sp.c, '#000') : kind === 'gold' ? silhouette(sp.c, '#ffd23f') : kind === 'goldFlip' ? silhouette(flipX(sp.c), '#ffd23f') : kind === 'ice' ? silhouette(sp.c, '#8fe4ff') : kind === 'iceFlip' ? silhouette(flipX(sp.c), '#8fe4ff') : null;
    return v[kind];
  }

  // 回転フレーム(16方向)
  const ROT = {};
  for (const k of ['axe', 'blade', 'bladeEvo', 'arrow', 'scythe']) {
    ROT[k] = rotFrames(S[k].c, 16);
    ROT[k + 'E'] = S[k].e ? rotFrames(S[k].e, 16) : null;
  }

  // 任意の canvas の単色シルエット(回転フレーム等の縁取り用)
  const tintCache = new WeakMap();
  function tint(src, col) {
    let m = tintCache.get(src);
    if (!m) tintCache.set(src, m = {});
    return m[col] || (m[col] = silhouette(src, col));
  }

  return { S, ROT, mk, rig, rigFrame, text, light, variant, canvas, tint };
})();
