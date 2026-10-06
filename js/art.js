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
  S.mage.alias = { bRing: 'mMeteor', bPact: 'mMeteor', bStep: 'mBlink', ranbu: 'mBarrage', iai: 'mMeteor', aRain: 'mMeteor', aVolley: 'mMeteor', aStep: 'mBlink', kSlam: 'mMeteor', kVerdict: 'mMeteor', pFlame: 'mBarrage', pInferno: 'mMeteor', pWall: 'mBlink', cIcicle: 'mMeteor', cDust: 'mMeteor', cMirror: 'mBlink', eSpark: 'mMeteor', eTower: 'mMeteor', eDash: 'mBlink', hStrike: 'mMeteor', hJudge: 'mMeteor', hPray: 'mBlink', nStorm: 'mMeteor', gRift: 'mMeteor', zThrow: 'mMeteor' }; // 他クラスの武器スキルを使ったときの代わりのモーション

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
  S.hunter.alias = { bRing: 'aRain', bPact: 'aVolley', bStep: 'aStep', ranbu: 'aRain', mBarrage: 'aRain', iai: 'aVolley', mMeteor: 'aVolley', mBlink: 'aStep', kSlam: 'aRain', kVerdict: 'aVolley', pFlame: 'aRain', pInferno: 'aVolley', pWall: 'aStep', cIcicle: 'aRain', cDust: 'aVolley', cMirror: 'aStep', eSpark: 'aRain', eTower: 'aVolley', eDash: 'aStep', hStrike: 'aRain', hJudge: 'aVolley', hPray: 'aStep', nStorm: 'aRain', gRift: 'aRain', zThrow: 'aRain' };

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
  S.knight.alias = { bRing: 'kSlam', bPact: 'kVerdict', ranbu: 'kSlam', mBarrage: 'kSlam', aRain: 'kSlam', iai: 'kVerdict', mMeteor: 'kVerdict', aVolley: 'kVerdict', pFlame: 'kSlam', pInferno: 'kVerdict', cIcicle: 'kSlam', cDust: 'kVerdict', eSpark: 'kSlam', eTower: 'kVerdict', hStrike: 'kSlam', hJudge: 'kVerdict', nStorm: 'kSlam', gRift: 'kSlam', zThrow: 'kSlam' };

  // ---------- クラス: パイロマンサー(16×18、部位アニメーション) ----------
  // 右向き。深紅のフード(影の中で橙の目が光る)・焦げ茶の帯・裾が燃えさしのようにちらつくローブ・先端に炎を宿した黒い杖
  const PUP = ['hood', 'torso', 'backArm', 'frontArm', 'staff'];
  const pup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(PUP.map(k => [k, [dx, dy]])), extra);
  S.pyro = rig({
    w: 16, h: 18, padX: 8, emit: 'EfFo',
    pal: {
      r: '#6a1a14', R: '#9a2a1a', n: '#3a2418', e: '#140a08', E: '#ffb347', k: '#2a1a14', K: '#5a3a2a',
      f: '#ff6a2a', F: '#fff1a0', i: '#f0c9a0', o: '#ff8a3d', a: '#1c1010',
    },
    order: ['backArm', 'legs', 'torso', 'hood', 'staff', 'frontArm'],
    parts: {
      hood: { x: 4, y: 0, v: {
        base: ['...rr...', '..rRrr..', '.rRrrrr.', 'rrreeeee', 'rrreEeeE', '.rreeeee', '..rrrrr.'],
      } },
      torso: { x: 4, y: 7, v: { base: ['rRrrrrrr', 'rRrnnrrr', 'nnnnnnnn', 'rRrrrrrr'] } },
      backArm: { x: 3, y: 8, v: { base: ['r', 'r', 'i'] } },
      frontArm: { x: 10, y: 8, v: {
        base:    ['rr', 'rr', 'ii'],
        forward: ['rrrii'],
        raise:   ['..ii', '.rr.', 'rr..'],
      } },
      // 杖(先端の炎が光る)。b = 炎が揺れた絵 / big = 大きく燃えた絵
      staff: { x: 11, y: 3, v: {
        base: ['.f.', 'fFf', '.K.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.'],
        b:    ['f..', 'fFf', '.K.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.'],
        big:  ['.f.', 'fff', 'fFf', 'fKf', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.'],
      } },
      legs: { x: 3, y: 11, v: {
        base:  ['.rrrrrrr..', '.rRrrrrrr.', 'rrRrrrrrrr', 'rrrrrrrrrr', 'ororrorror', '.aa...aa..'],
        stepA: ['.rrrrrrr..', '.rRrrrrrr.', 'rrRrrrrrrr', 'rrrrrrrrrr', 'roroorroro', 'aa.....aa.'],
        stepB: ['.rrrrrrr..', '.rRrrrrrr.', 'rrRrrrrrrr', 'rrrrrrrrrr', 'ororrorror', '..aa.aa...'],
      } },
    },
    motions: {
      // 待機: 呼吸で上半身が沈み、杖先の炎が揺れる
      idle: { loop: true, frames: [
        { t: 0.3, p: pup(0, 0) }, { t: 0.3, p: pup(0, 0, { staff: [0, 0, 'b'] }) },
        { t: 0.3, p: pup(0, 1) }, { t: 0.3, p: pup(0, 1, { staff: [0, 1, 'b'] }) },
      ] },
      walk: { loop: true, frames: [
        { t: 0.12, p: pup(0, 1, { legs: [0, 0, 'stepA'], backArm: [-1, 1] }) },
        { t: 0.12, p: pup(0, 0, { staff: [0, 0, 'b'] }) },
        { t: 0.12, p: pup(0, 1, { legs: [0, 0, 'stepB'], backArm: [1, 1] }) },
        { t: 0.12, p: pup(0, 0, { staff: [0, 0, 'b'] }) },
      ] },
    },
  });
  // 他クラスの武器スキルを使ったときの代わりのモーション
  S.pyro.alias = { bRing: 'pInferno', bPact: 'pInferno', bStep: 'pWall', ranbu: 'pFlame', mBarrage: 'pFlame', aRain: 'pFlame', kSlam: 'pFlame', iai: 'pInferno', mMeteor: 'pInferno', aVolley: 'pInferno', kVerdict: 'pInferno', mBlink: 'pWall', aStep: 'pWall', cIcicle: 'pInferno', cDust: 'pInferno', cMirror: 'pWall', eSpark: 'pInferno', eTower: 'pInferno', eDash: 'pWall', hStrike: 'pInferno', hJudge: 'pInferno', hPray: 'pWall', nStorm: 'pInferno', gRift: 'pInferno', zThrow: 'pInferno' };

  // ---------- クラス: クライオマンサー(16×18、部位アニメーション) ----------
  // 右向き。氷の結晶の冠を付けた白いフード(影の中で水色の目が光る)・淡い青のローブ・霜の付いた裾・先端に氷晶を浮かべた銀の杖
  const CUP = ['hood', 'torso', 'backArm', 'frontArm', 'staff'];
  const cup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(CUP.map(k => [k, [dx, dy]])), extra);
  S.cryo = rig({
    w: 16, h: 18, padX: 8, emit: 'EcC',
    pal: {
      w: '#b8c8dc', W: '#dce8f4', b: '#3f6aa0', B: '#5f8cc4', e: '#0c1424', E: '#bff4ff', c: '#7ad7ff', C: '#ffffff',
      s: '#b8c4d8', S: '#e8eef8', i: '#f0dcc8', f: '#cfe8ff', a: '#2a3448',
    },
    order: ['backArm', 'legs', 'torso', 'hood', 'staff', 'frontArm'],
    parts: {
      // フード(白)と結晶の冠(光る)
      hood: { x: 4, y: 0, v: {
        base: ['.c.C.c..', '..wWww..', '.wWwwww.', 'wwweeeee', 'wwweEeeE', '.wweeeee', '..wwwww.'],
      } },
      torso: { x: 4, y: 7, v: { base: ['bBbbbbbb', 'bBbssbbb', 'ssSsssss', 'bBbbbbbb'] } },
      backArm: { x: 3, y: 8, v: { base: ['b', 'b', 'i'] } },
      frontArm: { x: 10, y: 8, v: {
        base:    ['bb', 'bb', 'ii'],
        forward: ['bbbii'],
        raise:   ['..ii', '.bb.', 'bb..'],
      } },
      // 銀の杖と氷晶(光る)。b = 氷晶がゆっくり回った絵 / big = 大きく光る絵
      staff: { x: 11, y: 3, v: {
        base: ['.c.', 'cCc', '.c.', '.S.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.'],
        b:    ['c.c', '.C.', 'c.c', '.S.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.'],
        big:  ['.C.', 'cCc', 'CcC', 'cSc', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.'],
      } },
      legs: { x: 3, y: 11, v: {
        base:  ['.bbbbbbb..', '.bBbbbbbb.', 'bbBbbbbbbb', 'bbbbbbbbbb', 'fbfbbfbbfb', '.aa...aa..'],
        stepA: ['.bbbbbbb..', '.bBbbbbbb.', 'bbBbbbbbbb', 'bbbbbbbbbb', 'bfbffbbfbf', 'aa.....aa.'],
        stepB: ['.bbbbbbb..', '.bBbbbbbb.', 'bbBbbbbbbb', 'bbbbbbbbbb', 'fbfbbfbbfb', '..aa.aa...'],
      } },
    },
    motions: {
      // 待機: 呼吸で上半身が沈み、杖先の氷晶がゆっくり回る
      idle: { loop: true, frames: [
        { t: 0.4, p: cup(0, 0) }, { t: 0.4, p: cup(0, 0, { staff: [0, 0, 'b'] }) },
        { t: 0.4, p: cup(0, 1) }, { t: 0.4, p: cup(0, 1, { staff: [0, 1, 'b'] }) },
      ] },
      walk: { loop: true, frames: [
        { t: 0.12, p: cup(0, 1, { legs: [0, 0, 'stepA'], backArm: [-1, 1] }) },
        { t: 0.12, p: cup(0, 0, { staff: [0, 0, 'b'] }) },
        { t: 0.12, p: cup(0, 1, { legs: [0, 0, 'stepB'], backArm: [1, 1] }) },
        { t: 0.12, p: cup(0, 0, { staff: [0, 0, 'b'] }) },
      ] },
    },
  });
  S.cryo.alias = { bRing: 'cIcicle', bPact: 'cDust', bStep: 'cMirror', ranbu: 'cIcicle', mBarrage: 'cIcicle', aRain: 'cIcicle', kSlam: 'cIcicle', pFlame: 'cIcicle', iai: 'cDust', mMeteor: 'cDust', aVolley: 'cDust', kVerdict: 'cDust', pInferno: 'cDust', mBlink: 'cMirror', aStep: 'cMirror', pWall: 'cMirror', eSpark: 'cIcicle', eTower: 'cDust', eDash: 'cMirror', hStrike: 'cIcicle', hJudge: 'cDust', hPray: 'cMirror', nStorm: 'cIcicle', gRift: 'cIcicle', zThrow: 'cIcicle' };

  // ---------- クラス: エレクトロマンサー(16×18、部位アニメーション) ----------
  // 右向き。逆立った白い髪・光るゴーグル・紺のロングコートに黄色い稲妻の縁取り・先端に放電する金属球の杖
  const EUP = ['head', 'torso', 'backArm', 'frontArm', 'staff'];
  const eup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(EUP.map(k => [k, [dx, dy]])), extra);
  S.electro = rig({
    w: 16, h: 18, padX: 8, emit: 'GYB',
    pal: {
      h: '#e8ecf4', H: '#b8c0d0', c: '#f0c9a0', G: '#fff27a', g: '#8a7a2a', n: '#24305a', N: '#34447a', Y: '#fff27a',
      k: '#4a4a5a', m: '#a8b0c0', M: '#e8eef8', B: '#9fd8ff', a: '#1c1530',
    },
    order: ['backArm', 'legs', 'torso', 'head', 'staff', 'frontArm'],
    parts: {
      // 逆立った白い髪とゴーグル(光る)
      head: { x: 4, y: 0, v: {
        base: ['h.h.h...', 'hhhhhh..', '.hHhhhh.', '.hcgGGg.', '.hccccc.', '..cccc..'],
        b:    ['.h.h.h..', 'hhhhhh..', '.hHhhhh.', '.hcgGGg.', '.hccccc.', '..cccc..'],
      } },
      torso: { x: 4, y: 6, v: { base: ['nNnYYnnn', 'nNnnYnnn', 'nNnnnYnn', 'nNnnnnnn', 'kkkkkkkk'] } },
      backArm: { x: 3, y: 7, v: { base: ['n', 'n', 'c'] } },
      frontArm: { x: 10, y: 7, v: {
        base:    ['nn', 'nn', 'cc'],
        forward: ['nnncc'],
        raise:   ['..cc', '.nn.', 'nn..'],
      } },
      // 金属の杖と球(光る)。b = 小さく放電した絵 / big = 大きく放電した絵
      staff: { x: 11, y: 2, v: {
        base: ['.M.', 'MBM', '.M.', '.m.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.'],
        b:    ['Y.M', 'MBM', '.MY', '.m.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.'],
        big:  ['YBY', 'BBB', 'YBY', '.m.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.'],
      } },
      // コートの裾(長い)と靴
      legs: { x: 3, y: 11, v: {
        base:  ['.nnnnnnn..', '.nNnnnnnn.', 'nnNnnnnnnn', 'Ynnnnnnnn.', '.aa...aa..', '.aa...aa..'],
        stepA: ['.nnnnnnn..', '.nNnnnnnn.', 'nnNnnnnnnn', 'Ynnnnnnnn.', 'aa.....aa.', 'aa......aa'],
        stepB: ['.nnnnnnn..', '.nNnnnnnn.', 'nnNnnnnnnn', 'Ynnnnnnnn.', '..aa.aa...', '..aa.aa...'],
      } },
    },
    motions: {
      // 待機: 呼吸で上半身が沈み、杖の球が小さく放電する
      idle: { loop: true, frames: [
        { t: 0.3, p: eup(0, 0) }, { t: 0.15, p: eup(0, 0, { staff: [0, 0, 'b'] }) },
        { t: 0.3, p: eup(0, 1, { head: [0, 1, 'b'] }) }, { t: 0.15, p: eup(0, 1, { staff: [0, 1, 'b'] }) },
      ] },
      walk: { loop: true, frames: [
        { t: 0.11, p: eup(0, 1, { legs: [0, 0, 'stepA'], backArm: [-1, 1] }) },
        { t: 0.11, p: eup(0, 0, { head: [0, 0, 'b'] }) },
        { t: 0.11, p: eup(0, 1, { legs: [0, 0, 'stepB'], backArm: [1, 1] }) },
        { t: 0.11, p: eup(0, 0, { staff: [0, 0, 'b'] }) },
      ] },
    },
  });
  S.electro.alias = { bRing: 'eSpark', bPact: 'eTower', bStep: 'eDash', ranbu: 'eSpark', mBarrage: 'eSpark', aRain: 'eSpark', kSlam: 'eSpark', pFlame: 'eSpark', cIcicle: 'eSpark', iai: 'eTower', mMeteor: 'eTower', aVolley: 'eTower', kVerdict: 'eTower', pInferno: 'eTower', cDust: 'eTower', mBlink: 'eDash', aStep: 'eDash', pWall: 'eDash', cMirror: 'eDash', hStrike: 'eSpark', hJudge: 'eTower', hPray: 'eDash', nStorm: 'eSpark', gRift: 'eSpark', zThrow: 'eSpark' };

  // ---------- クラス: クレリック(16×18、部位アニメーション) ----------
  // 右向き。頭上の光の輪・長い金髪・白い法衣に金の刺繍・金の聖印(円に十字)を下げた短い杖
  const HUP = ['halo', 'head', 'torso', 'backArm', 'frontArm', 'staff'];
  const hup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(HUP.map(k => [k, [dx, dy]])), extra);
  S.cleric = rig({
    w: 16, h: 18, padX: 8, emit: 'OS',
    pal: {
      O: '#ffe38a', y: '#c89a38', Y: '#e8c060', c: '#e0b898', e: '#3a2a4a', w: '#a8a0c0', W: '#c8c2dc', g: '#b08830',
      s: '#8a6a3a', S: '#ffe38a', a: '#4a3a5a',
    },
    order: ['backArm', 'legs', 'torso', 'head', 'halo', 'staff', 'frontArm'],
    parts: {
      halo: { x: 5, y: 0, v: { base: ['.OOOO.'], b: ['OO..OO'] } }, // 光の輪(光る)
      // 長い金髪と顔
      head: { x: 4, y: 1, v: {
        base: ['..yyyy..', '.yYyyyy.', 'yyccccy.', 'yycece..', 'yycccc..', 'yy.cc...'],
      } },
      torso: { x: 4, y: 7, v: { base: ['wWwgwwww', 'wWwgwwww', 'gggggggg', 'wWwwwwww'] } },
      backArm: { x: 3, y: 8, v: { base: ['w', 'w', 'c'] } },
      frontArm: { x: 10, y: 8, v: {
        base:    ['ww', 'ww', 'cc'],
        forward: ['wwwcc'],
        raise:   ['..cc', '.ww.', 'ww..'],
        pray:    ['cc', 'ww', 'ww'],
      } },
      // 短い杖と聖印(光る)
      staff: { x: 11, y: 3, v: {
        base: ['.S.', 'SSS', '.S.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.'],
        big:  ['SSS', 'SSS', 'SSS', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.'],
      } },
      // 法衣の裾(金の縁)
      legs: { x: 3, y: 11, v: {
        base:  ['.wwwwwww..', '.wWwwwwww.', 'wwWwwwwwww', 'wwwwwwwwww', 'gggggggggg', '.aa...aa..'],
        stepA: ['.wwwwwww..', '.wWwwwwww.', 'wwWwwwwwww', 'wwwwwwwwww', 'gggggggggg', 'aa.....aa.'],
        stepB: ['.wwwwwww..', '.wWwwwwww.', 'wwWwwwwwww', 'wwwwwwwwww', 'gggggggggg', '..aa.aa...'],
      } },
    },
    motions: {
      // 待機: 呼吸で上半身が沈み、光の輪がゆっくり明滅する
      idle: { loop: true, frames: [
        { t: 0.45, p: hup(0, 0) }, { t: 0.45, p: hup(0, 0, { halo: [0, -1, 'b'] }) },
        { t: 0.45, p: hup(0, 1) }, { t: 0.45, p: hup(0, 1, { halo: [0, 0, 'b'] }) },
      ] },
      walk: { loop: true, frames: [
        { t: 0.12, p: hup(0, 1, { legs: [0, 0, 'stepA'], backArm: [-1, 1] }) },
        { t: 0.12, p: hup(0, 0) },
        { t: 0.12, p: hup(0, 1, { legs: [0, 0, 'stepB'], backArm: [1, 1] }) },
        { t: 0.12, p: hup(0, 0) },
      ] },
    },
  });
  S.cleric.alias = { ranbu: 'hStrike', mBarrage: 'hStrike', aRain: 'hStrike', kSlam: 'hStrike', pFlame: 'hStrike', cIcicle: 'hStrike', eSpark: 'hStrike', iai: 'hJudge', mMeteor: 'hJudge', aVolley: 'hJudge', kVerdict: 'hJudge', pInferno: 'hJudge', cDust: 'hJudge', eTower: 'hJudge', mBlink: 'hPray', aStep: 'hPray', pWall: 'hPray', cMirror: 'hPray', eDash: 'hPray', bRing: 'hStrike', bPact: 'hJudge', bStep: 'hPray', nStorm: 'hStrike', gRift: 'hStrike', zThrow: 'hStrike' };

  // ---------- クラス: ブラッドアサシン(16×18、部位アニメーション) ----------
  // 右向き。黒いフード(影の中で赤い目が光る)・口元を覆う赤い布(縁が光る)・暗紅のロングコート・腰の帯に吊るした短刀
  const BUP = ['hood', 'torso', 'backArm', 'frontArm', 'knife'];
  const bup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(BUP.map(k => [k, [dx, dy]])), extra);
  S.assassin = rig({
    w: 16, h: 18, padX: 8, emit: 'ER',
    pal: {
      k: '#1c1622', K: '#352a3e', e: '#08050a', E: '#ff3050', r: '#9a1028', R: '#ff4a64',
      c: '#4a1020', C: '#6e1a30', b: '#1a1014', g: '#2a2030', d: '#a8b0c0', D: '#e8eef8', a: '#120c14',
    },
    order: ['backArm', 'knife', 'legs', 'torso', 'hood', 'frontArm'],
    parts: {
      // 黒いフードと、口元を覆う赤い布
      hood: { x: 4, y: 0, v: {
        base: ['...kk...', '..kKkk..', '.kKkkkk.', 'kkkeeeee', 'kkkeEeeE', '.kkrrrrR', '..krrRr.'],
        b:    ['...kk...', '..kKkk..', '.kKkkkk.', 'kkkeeeee', 'kkkeEeeE', '.kkrrrRr', '..krRrr.'],
      } },
      torso: { x: 4, y: 7, v: { base: ['cCcrrccc', 'cCccrccc', 'bbbbbbbb', 'cCcccccc'] } },
      backArm: { x: 3, y: 8, v: { base: ['c', 'c', 'g'] } },
      frontArm: { x: 10, y: 8, v: {
        base:    ['cc', 'cc', 'gg'],
        forward: ['cccgg'],
        raise:   ['..gg', '.cc.', 'cc..'],
      } },
      knife: { x: 2, y: 9, v: { base: ['D', 'd', 'b'] } }, // 腰の後ろに吊るした短刀
      // コートの裾(赤い縁取り)とブーツ
      legs: { x: 3, y: 11, v: {
        base:  ['.ccccccc..', '.cCcccccc.', 'ccCccccccc', 'cccccccccc', 'rcrccrccrc', '.aa...aa..'],
        stepA: ['.ccccccc..', '.cCcccccc.', 'ccCccccccc', 'cccccccccc', 'crcrrccrcr', 'aa.....aa.'],
        stepB: ['.ccccccc..', '.cCcccccc.', 'ccCccccccc', 'cccccccccc', 'rcrccrccrc', '..aa.aa...'],
      } },
    },
    motions: {
      // 待機: 呼吸で上半身が沈み、赤い布の縁がゆらめく
      idle: { loop: true, frames: [
        { t: 0.4, p: bup(0, 0) }, { t: 0.4, p: bup(0, 0, { hood: [0, 0, 'b'] }) },
        { t: 0.4, p: bup(0, 1) }, { t: 0.4, p: bup(0, 1, { hood: [0, 1, 'b'] }) },
      ] },
      // 歩き: 前傾ぎみの速い足取り
      walk: { loop: true, frames: [
        { t: 0.1, p: bup(0, 1, { legs: [0, 0, 'stepA'], backArm: [-1, 1] }) },
        { t: 0.1, p: bup(0, 0, { hood: [0, 0, 'b'] }) },
        { t: 0.1, p: bup(0, 1, { legs: [0, 0, 'stepB'], backArm: [1, 1] }) },
        { t: 0.1, p: bup(0, 0) },
      ] },
    },
  });
  // 他クラスの武器スキル・スキルを使ったときの代わりのモーション
  S.assassin.alias = { ranbu: 'bRing', mBarrage: 'bRing', aRain: 'bRing', kSlam: 'bRing', pFlame: 'bRing', cIcicle: 'bRing', eSpark: 'bRing', hStrike: 'bRing', iai: 'bPact', mMeteor: 'bPact', aVolley: 'bPact', kVerdict: 'bPact', pInferno: 'bPact', cDust: 'bPact', eTower: 'bPact', hJudge: 'bPact', mBlink: 'bStep', aStep: 'bStep', pWall: 'bStep', cMirror: 'bStep', eDash: 'bStep', hPray: 'bStep', nStorm: 'bRing', gRift: 'bRing', zThrow: 'bRing' };

  // ---------- クラス: ネクロマンサー(16×18、部位アニメーション) ----------
  // 右向き。擦り切れた黒紫のフード(影の中で紫の目が光る)・首に骨の飾り・裾に霊気が光るローブ・先端に紫の鬼火を灯した曲がった杖
  const NUP = ['hood', 'torso', 'backArm', 'frontArm', 'staff'];
  const nup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(NUP.map(k => [k, [dx, dy]])), extra);
  S.necro = rig({
    w: 16, h: 18, padX: 8, emit: 'EfFv',
    pal: {
      k: '#1e1830', K: '#3a2c5a', e: '#08060e', E: '#d8c8ff', b: '#d8d0c0', B: '#8a8070', n: '#2a1e3e',
      c: '#b8b0c8', s: '#3a2a3a', S: '#5a465a', f: '#a58cff', F: '#f0e8ff', v: '#7a5ad0', a: '#120c18',
    },
    order: ['backArm', 'legs', 'torso', 'hood', 'staff', 'frontArm'],
    parts: {
      hood: { x: 4, y: 0, v: {
        base: ['...kk...', '..kKkk..', '.kKkkkk.', 'kkkeeeee', 'kkkeEeeE', '.kkeeeee', '..kkkkk.'],
      } },
      torso: { x: 4, y: 7, v: { base: ['kbBbBbkk', 'kKkkkkkk', 'nnnnnnnn', 'kKkkkkkk'] } }, // 首に骨の飾り
      backArm: { x: 3, y: 8, v: { base: ['k', 'k', 'c'] } },
      frontArm: { x: 10, y: 8, v: {
        base:    ['kk', 'kk', 'cc'],
        forward: ['kkkcc'],
        raise:   ['..cc', '.kk.', 'kk..'],
      } },
      // 曲がった杖(先端の鬼火が光る)。b = 鬼火が揺れた絵 / big = 大きく燃えた絵
      staff: { x: 11, y: 3, v: {
        base: ['.f.', 'fFf', '.fS', '..s', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.'],
        b:    ['f..', 'fFf', '.fS', '..s', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.'],
        big:  ['fff', 'fFf', 'fFf', '.fS', '..s', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.'],
      } },
      // ローブの裾(霊気がちらつく)
      legs: { x: 3, y: 11, v: {
        base:  ['.kkkkkkk..', '.kKkkkkkk.', 'kkKkkkkkkk', 'kkkkkkkkkk', 'vkvkkvkkvk', '.aa...aa..'],
        stepA: ['.kkkkkkk..', '.kKkkkkkk.', 'kkKkkkkkkk', 'kkkkkkkkkk', 'kvkvvkkvkv', 'aa.....aa.'],
        stepB: ['.kkkkkkk..', '.kKkkkkkk.', 'kkKkkkkkkk', 'kkkkkkkkkk', 'vkvkkvkkvk', '..aa.aa...'],
      } },
    },
    motions: {
      // 待機: 呼吸で上半身が沈み、杖先の鬼火がゆらぐ
      idle: { loop: true, frames: [
        { t: 0.35, p: nup(0, 0) }, { t: 0.35, p: nup(0, 0, { staff: [0, 0, 'b'] }) },
        { t: 0.35, p: nup(0, 1) }, { t: 0.35, p: nup(0, 1, { staff: [0, 1, 'b'] }) },
      ] },
      walk: { loop: true, frames: [
        { t: 0.12, p: nup(0, 1, { legs: [0, 0, 'stepA'], backArm: [-1, 1] }) },
        { t: 0.12, p: nup(0, 0, { staff: [0, 0, 'b'] }) },
        { t: 0.12, p: nup(0, 1, { legs: [0, 0, 'stepB'], backArm: [1, 1] }) },
        { t: 0.12, p: nup(0, 0, { staff: [0, 0, 'b'] }) },
      ] },
    },
  });
  // 他クラスの武器スキル・スキルを使ったときの代わりのモーション
  S.necro.alias = { ranbu: 'nStorm', mBarrage: 'nStorm', aRain: 'nStorm', kSlam: 'nStorm', pFlame: 'nStorm', cIcicle: 'nStorm', eSpark: 'nStorm', hStrike: 'nStorm', bRing: 'nStorm', gRift: 'nStorm', zThrow: 'nStorm', iai: 'nRite', mMeteor: 'nRite', aVolley: 'nRite', kVerdict: 'nRite', pInferno: 'nRite', cDust: 'nRite', eTower: 'nRite', hJudge: 'nRite', bPact: 'nRite', mBlink: 'nPhase', aStep: 'nPhase', pWall: 'nPhase', cMirror: 'nPhase', eDash: 'nPhase', hPray: 'nPhase', bStep: 'nPhase' };

  // ---------- クラス: アストロマンサー(16×18、部位アニメーション) ----------
  // 右向き。星図の点を縫い込んだ濃紺のローブ・フードの中は星空(顔は見えず、小さな星が瞬く)・桃色の帯と裾・先端に黒い球(特異点)と光の輪を浮かべた杖
  // 肩のまわりを公転する 3つの星と、質量の塵・足元の輪は描画側(render.js)で重ねる
  const GUP = ['hood', 'torso', 'backArm', 'frontArm', 'staff'];
  const gup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(GUP.map(k => [k, [dx, dy]])), extra);
  S.astro = rig({
    w: 16, h: 18, padX: 8, emit: 'EO',
    pal: {
      k: '#161a3c', K: '#2a3478', n: '#0c0e22', e: '#04030a', E: '#ffd8f2', d: '#5a64b0', p: '#8a2a6e',
      c: '#d0c4e4', s: '#2a2440', S: '#4a3a66', o: '#020104', O: '#ff7ad9', a: '#0a0818',
    },
    order: ['backArm', 'legs', 'torso', 'hood', 'staff', 'frontArm'],
    parts: {
      // フードの中は星空(b = 星が瞬いた絵)
      hood: { x: 4, y: 0, v: {
        base: ['...kk...', '..kKkk..', '.kKkkkk.', 'kkkeeeee', 'kkkeEeee', '.kkeeeEe', '..kkkkk.'],
        b:    ['...kk...', '..kKkk..', '.kKkkkk.', 'kkkeeeEe', 'kkkeeeee', '.kkeEeee', '..kkkkk.'],
      } },
      torso: { x: 4, y: 7, v: { base: ['kKkkdkkk', 'kKkkkkdk', 'pppppppp', 'kKkdkkkk'] } }, // 星図の点と桃色の帯
      backArm: { x: 3, y: 8, v: { base: ['k', 'k', 'c'] } },
      frontArm: { x: 10, y: 8, v: {
        base:    ['kk', 'kk', 'cc'],
        forward: ['kkkcc'],
        raise:   ['..cc', '.kk.', 'kk..'],
      } },
      // 杖: 先端に黒い球と光の輪。b = 輪が回った絵 / big = 輪が大きく光った絵
      staff: { x: 10, y: 3, v: {
        base: ['.pOp.', 'OoooO', 'pooop', '.pOp.', '..S..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..'],
        b:    ['.OpO.', 'pooop', 'OoooO', '.OpO.', '..S..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..'],
        big:  ['OOOOO', 'OoooO', 'OoooO', 'OOOOO', '..S..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..'],
      } },
      // ローブの裾(星図の点・桃色の縁取り)とブーツ
      legs: { x: 3, y: 11, v: {
        base:  ['.kkkkkkk..', '.kKkkdkkk.', 'kkKkkkkkdk', 'kdkkkkkkkk', 'pppppppppp', '.aa...aa..'],
        stepA: ['.kkkkkkk..', '.kKkkdkkk.', 'kkKkkkkkdk', 'kdkkkkkkkk', 'pppppppppp', 'aa.....aa.'],
        stepB: ['.kkkkkkk..', '.kKkkdkkk.', 'kkKkkkkkdk', 'kdkkkkkkkk', 'pppppppppp', '..aa.aa...'],
      } },
    },
    motions: {
      // 待機: 呼吸で上半身が沈み、フードの星と杖先の輪が瞬く
      idle: { loop: true, frames: [
        { t: 0.35, p: gup(0, 0) }, { t: 0.35, p: gup(0, 0, { staff: [0, 0, 'b'], hood: [0, 0, 'b'] }) },
        { t: 0.35, p: gup(0, 1) }, { t: 0.35, p: gup(0, 1, { staff: [0, 1, 'b'] }) },
      ] },
      // 歩き(質量が多いほど足取りが遅い: 描画側で時間を遅らせる)
      walk: { loop: true, frames: [
        { t: 0.13, p: gup(0, 1, { legs: [0, 0, 'stepA'], backArm: [-1, 1] }) },
        { t: 0.13, p: gup(0, 0, { staff: [0, 0, 'b'] }) },
        { t: 0.13, p: gup(0, 1, { legs: [0, 0, 'stepB'], backArm: [1, 1] }) },
        { t: 0.13, p: gup(0, 0, { staff: [0, 0, 'b'], hood: [0, 0, 'b'] }) },
      ] },
    },
  });
  // 他クラスの武器スキル・スキルを使ったときの代わりのモーション
  S.astro.alias = { ranbu: 'gRift', mBarrage: 'gRift', aRain: 'gRift', kSlam: 'gRift', pFlame: 'gRift', cIcicle: 'gRift', eSpark: 'gRift', hStrike: 'gRift', bRing: 'gRift', nStorm: 'gRift', zThrow: 'gRift', iai: 'gCrush', mMeteor: 'gCrush', aVolley: 'gCrush', kVerdict: 'gCrush', pInferno: 'gCrush', cDust: 'gCrush', eTower: 'gCrush', hJudge: 'gCrush', bPact: 'gCrush', nRite: 'gCrush', mBlink: 'gEject', aStep: 'gEject', pWall: 'gEject', cMirror: 'gEject', eDash: 'gEject', hPray: 'gEject', bStep: 'gEject', nPhase: 'gEject' };

  // ---------- クラス: バーサーカー(16×18、部位アニメーション) ----------
  // 右向き。熊の毛皮のマント(熊の頭をフードのように被り、上あごの牙が額にかかる)・裸の上半身に藍の戦化粧(渦の模様。光る)
  // 編んだ赤茶の髭・太い腕・腰の後ろと前に予備の斧。怒りが上限・狂乱中は目が赤く光る(head の r / roar。待機・歩きは idleR / walkR)
  // 戦化粧の光り方・足元の昂りの輪・体の縁の光・赤黒い湯気は描画側(render.js)
  const ZUP = ['cape', 'hood', 'head', 'torso', 'backArm', 'frontArm', 'axes'];
  const zup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(ZUP.map(k => [k, [dx, dy]])), extra);
  const redEyes = frames => frames.map(f => ({ t: f.t, p: Object.assign({}, f.p, { head: [f.p.head[0], f.p.head[1], 'r'] }) }));
  // 待機: 肩で息をする(体が先に沈み、腕が遅れてついてくる)/ 歩き: 前のめり(上半身が 1ドット前)で腕を大きく振る
  const zIdle = [
    { t: 0.24, p: zup(0, 0) }, { t: 0.12, p: zup(0, 1, { backArm: [0, 0], frontArm: [0, 0] }) },
    { t: 0.24, p: zup(0, 1) }, { t: 0.12, p: zup(0, 0, { backArm: [0, 1], frontArm: [0, 1] }) },
  ];
  const zWalk = [
    { t: 0.12, p: zup(1, 1, { legs: [0, 0, 'stepA'], backArm: [0, 1], frontArm: [2, 1] }) },
    { t: 0.12, p: zup(1, 0) },
    { t: 0.12, p: zup(1, 1, { legs: [0, 0, 'stepB'], backArm: [2, 1], frontArm: [0, 1] }) },
    { t: 0.12, p: zup(1, 0) },
  ];
  S.berserker = rig({
    w: 16, h: 18, padX: 8, emit: 'PR',
    pal: {
      // 足元の光で 1.6〜1.9倍に明るくなるので、元の色は暗めにする(肌が明るいと白く飛ぶ)。戦化粧 P は光った後にクラスの色(藍)に近くなる色
      k: '#1a110a', K: '#3a2618', F: '#563a22', t: '#a89c80', s: '#6e4630', S: '#4a2c1e', e: '#0e0606', R: '#900c16', o: '#1e0404',
      b: '#5e2c14', B: '#3a1a0a', P: '#2a3c9a', l: '#2a1a10', L: '#7a6a48', m: '#5a606c', M: '#9aa2ae', h: '#4a3018',
      p: '#1e1a22', q: '#2e2834', a: '#0e0a0c',
    },
    order: ['cape', 'backArm', 'legs', 'torso', 'axes', 'head', 'hood', 'frontArm'],
    parts: {
      cape: { x: 1, y: 4, v: { base: ['kKk', 'kKK', 'kKF', 'kKK', 'kFK', 'kKK', 'kKK', 'kKK', 'kKk', '.kk'] } }, // 背中に垂れる熊の毛皮
      hood: { x: 3, y: 0, v: { base: ['.kk..kk....', 'kKKkkKKk...', 'kKFKKKKKkk.', 'kKKKKkKFFFk', '.kKKKKtKtK.'] } }, // 熊の頭(2つの耳・目・明るい鼻先・額にかかる牙)
      head: { x: 4, y: 5, v: { // 顔(毛皮の垂れ)と編んだ髭
        base: ['kKSssses.', 'kKSsssssS', '....Bbbb.', '....bBbB.', '.....B.B.'],
        r:    ['kKSsssRs.', 'kKSsssssS', '....Bbbb.', '....bBbB.', '.....B.B.'],
        roar: ['kKSsssRs.', 'kKSsssssS', '....Booo.', '....bBoB.', '.....B.B.'],
      } },
      torso: { x: 4, y: 7, v: { base: ['sPPsssss', 'PssPssss', 'PsPPssss', 'sPPssPPs', 'llllllLl'] } }, // 裸の上半身(胸に戦化粧の渦)と革の帯
      backArm: { x: 2, y: 7, v: {
        base: ['SS', 'ss', 'ss', 'Ss'],
        lift: ['..ss', '.ss.', 'sS..', 'S...'], // 両手で振りかぶる(y を -4 して使う)
      } },
      frontArm: { x: 12, y: 7, v: { // 前腕に戦化粧の帯
        base:    ['sS', 'ss', 'PP', 'Ss'],
        raise:   ['ss', 'PP', 'Ss', 'sS'], // 上へ振りかぶる(y を -4 して使う)
        forward: ['sPss', '.PSs'],         // 前へ投げ放つ・振り抜く
      } },
      axes: { x: 1, y: 11, v: { base: ['Mm..........', 'mh........mM', '.h........h.'] } }, // 腰の後ろと前の予備の斧
      legs: { x: 3, y: 12, v: { // 毛皮の腰巻き・ズボン・ブーツ。brace = 足を大きく開いて踏ん張る
        base:  ['.kKKFKKKk.', 'kKKKKKKKKk', '..pq..pq..', '..pq..pq..', '..aa..aa..', '..aaa.aaa.'],
        stepA: ['.kKKFKKKk.', 'kKKKKKKKKk', '..pq...pq.', '.pq....pq.', '.aa....aa.', 'aaa....aaa'],
        stepB: ['.kKKFKKKk.', 'kKKKKKKKKk', '...pqpq...', '...pqpq...', '...aaaa...', '...aaaaa..'],
        brace: ['.kKKFKKKk.', 'kKKKKKKKKk', '.pq....qp.', 'pq......qp', 'aa......aa', 'aaa....aaa'],
      } },
    },
    motions: {
      idle: { loop: true, frames: zIdle }, walk: { loop: true, frames: zWalk },
      idleR: { loop: true, frames: redEyes(zIdle) }, walkR: { loop: true, frames: redEyes(zWalk) },
    },
  });
  // ---------- クラス: ウェポンマスター(16×18、部位アニメーション) ----------
  // 右向き。旅の武芸者: 鉢金(額の金属の板。光る)と赤い鉢巻きの尾、短い外套、手甲、脚絆
  //   背中に何本もの武器(杖の先の宝珠・刀の柄・弓の端・斧の刃)。刃先は順にきらめく(待機のフレームで光る所が変わる)
  //   足元の光で 1.6〜1.9倍に明るくなるので、元の色は暗めにする
  const WUP = ['gear', 'head', 'torso', 'backArm', 'frontArm'];
  const wup = (dx, dy, extra = {}) => Object.assign(Object.fromEntries(WUP.map(k => [k, [dx, dy]])), extra);
  const wmGlint = (v, dy = 0) => wup(0, dy, { gear: [0, dy, v] });
  S.weaponmaster = rig({
    w: 16, h: 18, padX: 8, emit: 'MJSO',
    pal: {
      b: '#2a1a14', B: '#40281c', c: '#a8785a', C: '#7a5038', d: '#160c0a', e: '#6a1c18', m: '#6a4220', M: '#c88444',
      f: '#2c2a3e', F: '#423e5a', t: '#5a4230', T: '#76583a', i: '#342014', I: '#a87036',
      g: '#565e6a', G: '#848e9c', l: '#363040', L: '#4a4256', w: '#7a6a50', a: '#1a1410',
      k: '#5a1a20', j: '#9a7a34', J: '#e0b860', o: '#5e3e22', u: '#6e4a28', s: '#6e7888', S: '#c4d0e0', n: '#4a2a6a', O: '#b07ae0',
    },
    order: ['gear', 'backArm', 'legs', 'torso', 'head', 'frontArm'],
    parts: {
      // 背中の武器: 肩の上に刀の柄(k)と柄頭(j)・弓の端(u)・腰に斧の刃(s)・足の後ろに杖の先の宝珠(n)。g1〜g3 = きらめく所(J / S / O)
      gear: { x: 0, y: 0, v: {
        base: ['.j....', '..k...', 'u..k..', 'u.....', 'u.....', 'u.....', 'u.....', '.u....', '......', 'ss....', 'sso...', '...o..', '..o...', '.nn...', 'nnn...', '.n....'],
        g1:   ['.J....', '..k...', 'u..k..', 'u.....', 'u.....', 'u.....', 'u.....', '.u....', '......', 'ss....', 'sso...', '...o..', '..o...', '.nn...', 'nnn...', '.n....'],
        g2:   ['.j....', '..k...', 'u..k..', 'u.....', 'u.....', 'u.....', 'u.....', '.u....', '......', 'Ss....', 'sSo...', '...o..', '..o...', '.nn...', 'nnn...', '.n....'],
        g3:   ['.j....', '..k...', 'u..k..', 'u.....', 'u.....', 'u.....', 'u.....', '.u....', '......', 'ss....', 'sso...', '...o..', '..o...', '.nO...', 'nOn...', '.n....'],
      } },
      head: { x: 3, y: 0, v: { base: ['....bbb..', '...bbbbB.', '..bbbbbbb', '.eemmMMMm', 'ee.bbccdc', '...bccccC', '....cccc.'] } },
      torso: { x: 4, y: 7, v: { base: ['fFfttTtf', 'ffftTttf', '.fftTtt.', 'iiiiIiii', '.tTtttt.'] } },
      backArm: { x: 3, y: 8, v: {
        base: ['fF', 'ff', 'gg', 'cc'],
        seal: ['.........cc'], // 印を結ぶ: 奥の手が胸の前へ(腕は体に隠れて手だけ見える)
      } },
      frontArm: { x: 10, y: 8, v: {
        base:    ['Ff.', 'ff.', 'gGg', '.cc'],
        forward: ['.Ffgg', '.ffGc'],     // 前へ突き出す(武器を振るう・放つ)
        raise:   ['..cc', '.gG.', 'Ff..'], // 掲げる(y を -2 して使う)
        seal:    ['Ff..', 'fGcc'],         // 印を結ぶ: 胸の前で両手を合わせる(奥の手の下に重ねる)
      } },
      legs: { x: 4, y: 12, v: {
        base:  ['llLlllll', 'llllllLl', 'lll..lll', 'www..www', 'www..www', 'aaa..aaa'],
        stepA: ['llLlllll', 'llllllLl', 'lll...ll', 'ww....ww', 'ww....ww', 'aa....aa'],
        stepB: ['llLlllll', 'llllllLl', '.lll.ll.', '.www.ww.', '.www.ww.', '.aaa.aa.'],
        brace: ['llLlllll', 'llllllLl', 'll....ll', 'ww....ww', 'ww....ww', 'aa....aa'], // 足を開いて構える
      } },
    },
    motions: {
      // 待機: 呼吸で上半身が沈む。背中の武器の刃先が順にきらめく(柄頭 → 斧 → 宝珠)
      idle: { loop: true, frames: [
        { t: 0.4 }, { t: 0.4, p: wmGlint('g1') }, { t: 0.4, p: wmGlint('base', 1) }, { t: 0.4, p: wmGlint('g2', 1) },
        { t: 0.4 }, { t: 0.4, p: wmGlint('g3') }, { t: 0.4, p: wmGlint('base', 1) }, { t: 0.4, p: wup(0, 1) },
      ] },
      // 歩き: 足を踏み出すフレームで上半身が沈む。奥の腕を振る
      walk: { loop: true, frames: [
        { t: 0.11, p: wup(0, 1, { legs: [0, 0, 'stepA'], backArm: [-1, 1] }) },
        { t: 0.11, p: wup(0, 0) },
        { t: 0.11, p: wup(0, 1, { legs: [0, 0, 'stepB'], backArm: [1, 1] }) },
        { t: 0.11, p: wup(0, 0, { gear: [0, 0, 'g1'] }) },
      ] },
    },
  });
  // 武器スキル(E)はメイン武器のもの(どの武器でも同じ代わりのモーション)。他クラスのスキルの名前も代わりのモーションへ
  S.weaponmaster.alias = { ranbu: 'wmArt', mBarrage: 'wmArt', aRain: 'wmArt', kSlam: 'wmArt', pFlame: 'wmArt', cIcicle: 'wmArt', eSpark: 'wmArt', hStrike: 'wmArt', bRing: 'wmArt', nStorm: 'wmArt', gRift: 'wmArt', zThrow: 'wmArt',
    iai: 'wmSeal', mMeteor: 'wmSeal', aVolley: 'wmSeal', kVerdict: 'wmSeal', pInferno: 'wmSeal', cDust: 'wmSeal', eTower: 'wmSeal', hJudge: 'wmSeal', bPact: 'wmSeal', nRite: 'wmSeal', gCrush: 'wmSeal', zRoar: 'wmSeal',
    mBlink: 'wmDash', aStep: 'wmDash', pWall: 'wmDash', cMirror: 'wmDash', eDash: 'wmDash', hPray: 'wmDash', bStep: 'wmDash', nPhase: 'wmDash', gEject: 'wmDash', zFirm: 'wmDash' };

  // 他クラスの武器スキル・スキルを使ったときの代わりのモーション
  S.berserker.alias = { ranbu: 'zThrow', mBarrage: 'zThrow', aRain: 'zThrow', kSlam: 'zThrow', pFlame: 'zThrow', cIcicle: 'zThrow', eSpark: 'zThrow', hStrike: 'zThrow', bRing: 'zThrow', nStorm: 'zThrow', gRift: 'zThrow', iai: 'zRoar', mMeteor: 'zRoar', aVolley: 'zRoar', kVerdict: 'zRoar', pInferno: 'zRoar', cDust: 'zRoar', eTower: 'zRoar', hJudge: 'zRoar', bPact: 'zRoar', nRite: 'zRoar', gCrush: 'zRoar', mBlink: 'zFirm', aStep: 'zFirm', pWall: 'zFirm', cMirror: 'zFirm', eDash: 'zFirm', hPray: 'zFirm', bStep: 'zFirm', nPhase: 'zFirm', gEject: 'zFirm' };

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

  S.ghost = mk({ a: '#dcefff', b: '#1e3a7a', c: '#8ab8ff' }, [ // 冷たい霊(霊峰): 青白い
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

  // 火の小鬼: 頭に炎をともし、距離を取って火の玉を投げる(炎は2コマで揺らめく)
  const impPal = { a: '#2a1a1a', b: '#ff6a3d', c: '#8a2a4a', d: '#ffff80', e: '#5a1010', f: '#ff6a2a', g: '#ffe14a' };
  const impBody = [
    'a...fgf...a',
    '.a..bbb..a.',
    '..abbbbba..',
    'c.bdbbbdb.c',
    'cc.bbebb.cc',
    'ccc.bbb.ccc',
    '...bbbbb...',
    '....b.b....',
    '...bb.bb...',
  ];
  S.imp = [mk(impPal, ['.....f.....', '....fgf....', ...impBody], { emit: 'dfg' }), mk(impPal, ['....f......', '....fgf....', ...impBody], { emit: 'dfg' })];

  // 砂術師: 砂色の頭巾と衣、琥珀の珠をつけた杖
  S.sandmage = mk({ a: '#5a3a1a', b: '#c8a060', c: '#e8c88a', d: '#2a1a10', e: '#ffd23f', f: '#8a5a2a', g: '#ffb347', h: '#fff0c0', i: '#7a2a1a' }, [
    '........ghg.',
    '....aaa..gg.',
    '...abbba..f.',
    '..abbbbba.f.',
    '..abddddb.f.',
    '..abdedeb.f.',
    '..abbddbbaf.',
    '..bccccccbf.',
    '.bcciiiiccf.',
    '.bcccccccbf.',
    '..bcccccbbf.',
    '..bbcccbb.f.',
    '..aa...aa...',
  ], { emit: 'egh' });

  // 投槍兵: 青銅の兜と革鎧、長い槍を立てて持つ
  S.spear = mk({ a: '#3a2a1a', b: '#a0703a', c: '#e8e6da', d: '#c8b89a', e: '#ff5a3a', f: '#6b4a2a', g: '#dfe8f5', h: '#7a3a2a' }, [
    '..........g.',
    '...ddd...gg.',
    '..ddddd..f..',
    '..dccccd.f..',
    '..ceccec.f..',
    '..cccccc.f..',
    '...hhhh..f..',
    '..bbbbbbbf..',
    '.cbbhhbbcf..',
    '.c.bbbbb.f..',
    '...bb.bb.f..',
    '...c...c.f..',
    '..cc...cc...',
  ], { emit: 'e' });

  // ヘルハウンド: 背に炎のたてがみを燃やして走る黒い犬(2コマで走る)
  const houndPal = { a: '#ffe14a', b: '#3a1a16', c: '#ff6a2a', d: '#ffc34a', e: '#ffff80', f: '#2a1210', g: '#5a2a20' };
  const houndTop = [
    '............cd..',
    '...........bbcb.',
    '..........bbbbbb',
    '.c.c.c....bbebbb',
    'cdcdcdcbbbbbbgaa',
    '.cbbbbbbbbbbb...',
    '..bbbbbbbbbb....',
  ];
  S.hound = [mk(houndPal, [...houndTop, '..bf.bf..bf.bf..', '..f..f...f..f...', '.ff.ff..ff.ff...'], { emit: 'acde' }),
    mk(houndPal, [...houndTop, '...bf.bf.bf.bf..', '...f.f...f.f....', '..ff.ff.ff.ff...'], { emit: 'acde' })];

  // 鬼火: 青白い炎の玉に暗い目(2コマで揺らめく)
  const onibiPal = { a: '#1a4a8a', b: '#3a8ad0', c: '#7ad7ff', d: '#ffffff', e: '#0c1a3a' };
  S.onibi = [mk(onibiPal, ['...c...', '..cc...', '..bcc..', '.bccb..', '.bcdcb.', 'bcdddcb', 'bcedecb', '.bcdcb.', '..bbb..'], { emit: 'bcd' }),
    mk(onibiPal, ['....c..', '...cc..', '..ccb..', '..bccb.', '.bcdcb.', 'bcdddcb', 'bcedecb', '.bcdcb.', '..bbb..'], { emit: 'bcd' })];

  // 溶岩スライム: 黒い殻の割れ目から溶岩が光る
  S.lslime = mk({ a: '#3a120c', b: '#8a2a14', c: '#ffc34a', d: '#1a0604', e: '#ff6a2a' }, [
    '....aaa....',
    '..aabebaa..',
    '.abbbebcba.',
    '.abebbbbca.',
    'abbdbbbdbba',
    'abbdbebdbba',
    'abebbbbbeba',
    '.aaaaaaaaa.',
  ], { emit: 'ce' });

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
  // 終刻の死神(死神の第二形態): 同じ姿を、赤い刃・金の柄・赤い縁取りの黒衣に
  S.fhour = mk({ a: '#ff3b5c', b: '#1a0a14', c: '#e8e0d0', d: '#ff3b5c', f: '#c8a050', g: '#8a1020' }, [
    'aaaaaaa...........', '.aaaaaaaa.........', '...aaa.aff........', '........ff........', '.....bbbbfb.......', '....bbbbbbfb......', '...bbcccccfb......', '...bccdcdcfcb.....', '...bcccccfccb.....', '...bbcccffcbb.....',
    '...bbbbbfbbbb.....', '..bbgbbbfbbgbb....', '..bbgbbfbbbgbb....', '.bbbgbbfbbbgbbb...', '.bbgbbfbbbbbgbb...', '.bbgbbfbbbbbgbbb..', 'bbbgbfbbbbbbbgbb..', 'bbgbbfbbbbbbbgbbb.', 'bbgbfbbbbbbbbbgbb.', '.g.g.gg.gg.gg.g...',
  ], { emit: 'ad' });

  // 左半分の行を左右対称に展開
  const sym = rows => rows.map(r => r + [...r].reverse().join(''));

  // ---------- 七彩の晶窟 ----------
  // 宝石スライム: 面のある宝石の体(水色と桃色の面)
  S.jslime = mk({ a: '#3a2a6a', b: '#7ad7ff', c: '#d8f8ff', d: '#ff8ad8', e: '#1a1030' }, ['...aba...', '..abcba..', '.abccbda.', 'abbebebda', 'abddbbbda', '.aaaaaaa.'], { emit: 'c' });
  // 晶甲虫: 紫の殻の背に結晶が生えた甲虫(右向き)
  S.beetle = mk({ a: '#1a1028', b: '#3a2c5a', c: '#5a4a8a', d: '#9ff7ff', e: '#ff8ad8', f: '#ffffff' }, [
    '...d...e...', '..dd..ee.d.', '.abbcbbcbdd', 'abbcbbbcbbf', 'abcbbbcbbba', '.abbbbbbba.', '.a.a.a.a...', 'a.a.a.a....',
  ], { emit: 'def' });
  // プリズムフェアリー: 光る小さな妖精(羽ばたきの 2コマ)
  const fairyPal = { a: '#ffd0f0', b: '#ffffff', c: '#9ff7ff', d: '#ff8ad8' };
  S.fairy = [mk(fairyPal, ['a.....c', 'aa.b.cc', '.aabcc.', '..bbb..', '...b...', '..d.d..'], { emit: 'abcd' }),
    mk(fairyPal, ['.......', '...b...', '.aabcc.', 'aa.b.cc', 'a.bbb.c', '..d.d..'], { emit: 'abcd' })];
  // 晶角の大鹿: 七色の結晶の角を持つ紫の大鹿(右向き)
  S.stag = mk({ a: '#1a1028', b: '#4a3c7a', c: '#6a5aa8', d: '#9ff7ff', e: '#ff8ad8', f: '#ffd23f', g: '#ffffff', h: '#2a2048' }, [
    '.................d...e....',
    '................dd..ee....',
    '.................d.ee..f..',
    '..............f..ddd..ff..',
    '..............ff..dd.ff...',
    '...............ff.dd.f....',
    '.................ddff.....',
    '.................abbba....',
    '................abbbbba...',
    '................abgbbbbaa.',
    '................abbbbbbbba',
    '.....aaaaaaaaaaabbbbaaaa..',
    '...aabbbbbbbbbbbbbbba.....',
    '..abcbbbbbcccbbbbbbba.....',
    '..abbbcccbbbbbbbccbba.....',
    '..abbbbbbbbbbbbbbbbba.....',
    '...abbbbbbbbbbbbbbba......',
    '....abb.abb....abb.abb....',
    '....ab..ab.....ab..ab.....',
    '....ab..ab.....ab..ab.....',
    '....ab..ab.....ab..ab.....',
    '...hh..hh.....hh..hh......',
  ], { emit: 'defg' });
  // 七彩の女王: 結晶の冠と銀の髪、七色の裾の衣
  S.pqueen = mk({ a: '#ffd23f', c: '#9ff7ff', d: '#ff8ad8', h: '#d8c8ff', f: '#f4e0e8', e: '#3a1a5a', g: '#6a4ab0', k: '#2a1a4a', r: '#ff5d73', o: '#ff9a3d', y: '#ffd23f', n: '#7dff9a', b: '#7ad7ff', v: '#8a7aff' }, sym([
    '.......dc', '...c..ddc', '...cc.dcc', '...aaaaaa', '..hhhhhhh', '.hhffffff', '.hhfeffff', '.hhffffff', '.hhhfffff', '.hhh.kfff',
    '..h.kgggg', '...kggggg', '..kgggrgg', '..kggrogg', '.kggroyyg', '.kgroyynn', '.kgoynnbb', 'kggynnbbv', 'kgynnbbvv', 'kgnbbbvvv', 'kkkkkkkkk',
  ]), { emit: 'cdy' }); // 光るのは冠と金の縁(衣まで光らせると白く飛ぶ)
  S.obj_clone = S.pqueen; // 鏡の分身は女王と同じ姿
  // 結晶の柱(大鹿)/ 虹の檻の結晶(女王)
  S.obj_crystal = mk({ a: '#2a2048', b: '#7ad7ff', c: '#d8f8ff', d: '#ff8ad8', e: '#8a7aff' }, [
    '...c....', '..cbc...', '..cbbd..', '.cbbbd..', '.cbbbdd.', '.cbbbed.', 'cbbbeedd', 'cbbbeedd', 'cbbeeedd', '.bbeeed.', '.bbeeed.', '..beed..', '.abeeda.', 'aaaaaaaa',
  ], { emit: 'cd' });
  S.obj_prism = mk({ a: '#2a2048', b: '#7ad7ff', c: '#ffffff', d: '#ff8ad8', e: '#8a7aff' }, ['..c..', '.cbd.', '.cbd.', 'cbbdd', 'cbedd', '.bed.', '.bed.', '.aaa.'], { emit: 'cbd' });

  // ---------- 沈黙の海淵 ----------
  // 深海クラゲ: 透きとおった傘と、ゆらぐ触手(2コマ)。傘のふちがほのかに光る
  const jellyPal = { a: '#2a3a6a', b: '#4a6aa8', c: '#7aa8d8', d: '#ff8ad8', e: '#c8e8ff', f: '#8a5aa8' };
  S.jelly = [mk(jellyPal, ['..aaaa..', '.abccba.', 'abceecba', 'abccccba', 'dbdbbdbd', '.f.f.f..', '.f..f.f.', 'f..f..f.'], { emit: 'd' }),
    mk(jellyPal, ['..aaaa..', '.abccba.', 'abceecba', 'abccccba', 'dbdbbdbd', '..f.f.f.', '.f.f..f.', '.f..f..f'], { emit: 'd' })];
  // サハギン: 緑青のうろこの半魚人。ひれの耳と、三叉の槍(右向き)
  S.sahagin = mk({ a: '#0e2a2a', b: '#2a6a5a', c: '#4a9a7a', d: '#9ad8b8', e: '#ffd23f', f: '#dfe8f5', g: '#6b4a2a', h: '#1a4a6a' }, [
    '..h.........f', '.hbbb......ff', '.abcbb...g.f.', '.abcecb..g...', '..abccb.g....', '..hbbbccg....', '.abcbdbbg....', 'abcbddbbg....', '.abbddbag....', '..abbbba.....', '..ab..ab.....', '.hh...hh.....',
  ], { emit: 'e' });
  // ハリセンボン: 黄色いまるい体に棘(ふくらむと棘が立つ)
  S.puffer = mk({ a: '#5a4a1a', b: '#c8a03a', c: '#e8c86a', d: '#fff0c0', e: '#1a1a2a', f: '#ff8a5a' }, [
    '..a.a.a..', '.abbbbba.', 'abccccdba', 'bcceccdcb', 'bcccccccf', 'abcdddcba', '.abbbbba.', '..a.a.a..',
  ]);
  // チョウチンアンコウ: 暗い体と大きな口、頭の上の提灯(提灯だけが光る)
  S.angler = mk({ a: '#0a0a14', b: '#2a2a3a', c: '#3a3a52', d: '#5a5a7a', e: '#fff6a0', f: '#ffffff', g: '#6a5a8a' }, [
    '........gge.', '.......g..ee', '..aaaaag....', '.abbbbbba...', 'abcccccbba..', 'gbcdccfcbba.', 'gbccccccaff.', 'gbcccccba.f.', 'abbbbbbbaaf.', '.aaaaaaaa...',
  ], { emit: 'e' });
  // 大海魔クラーケン: 赤紫の大きな頭と金の目。吸盤の並ぶ触手
  S.kraken = mk({ a: '#1a0a1a', b: '#5a1a3a', c: '#8a2a4a', d: '#c2486a', e: '#ffd23f', g: '#e89aaa', k: '#2a0e1e' }, sym([
    '.........aaaa', '.......aabbbb', '......abbcccc', '.....abccdccc', '.....abcddccc', '....abccccccc', '....abcccccbc', '....abcceekcc', '....abcckeecc', '....abbcccccc',
    '.....abbcccbb', '...aabbbbbbbb', '..abbcbbcbbcb', '.abcb.abcb.bc', 'abcb..abcb.bc', 'abg...abg..bg', 'bcg..abcg..bg', 'bcg..bcg...bc', '.bcg.bcg...bg', '..bcgbcg..bcg', '...bb.bb..bb.',
  ]), { emit: 'e' });
  // 深淵の海竜: 青い長い体をうねらせ、頭を持ち上げた海の竜(右向き)。背に碧のひれ
  S.levia = mk({ a: '#0a1a2a', b: '#1a4a7a', c: '#2a7ab8', d: '#4ab8e8', e: '#bff4ff', f: '#ffffff', g: '#ffd23f', h: '#7ad7c8' }, [
    '.....................hh.......', '....................hhhh......', '...................ahhhhaa....', '..................abbbbbbbaa..', '.................abccccbbbgba.',
    '.................abcdddccbbbba', '.........hh......abcdeeddccccf', '........hhhh......abceeeaaaaa.', '.......abbbba......abceea.f.f.', '......abccccba.....abceea.....',
    '.....abcdddccba....abcdea.....', '....abcdeeedccba..abcdeea.....', '...abcdea.aedccbaabcdeea......', '..abcdea...aedcbbbcdeea.......', '.abcdea.....aeddcccdeaa.......',
    'abcdea.......aaeeeeeaa........', 'abcea.........aaaaaa..........', '.abca.........................', '..aba.........................', '...a..........................',
  ], { emit: 'gh' });
  // クラーケンの触手(壊せる物): 赤紫の太い触手に吸盤
  S.obj_tentacle = mk({ a: '#1a0a1a', b: '#5a1a3a', c: '#8a2a4a', d: '#c2486a', g: '#e89aaa', w: '#bff4ff' }, [
    '...cd.', '..cdc.', '..cd..', '.bcg..', '.bcd..', '.bcg..', '..bcg.', '..bcd.', '..bcg.', '.bcdg.', '.bcdg.', 'bccdg.', 'bccdgb', 'w.bb.w', '.wwww.',
  ]);
  // 弾: サハギンの三叉槍(右向き。回転フレームで描く)/ ハリセンボンの針 / 水弾 / 墨の玉(放物線)
  S.trident = mk({ a: '#6b4a2a', b: '#dfe8f5', c: '#ffffff', d: '#7ad7ff' }, ['.........bbc', 'aaaaaaaabbd.', '.........bbc'], { emit: 'd' });
  S.needle = mk({ a: '#c8a03a', b: '#fff0c0' }, ['aab'], { outline: false });
  S.water = mk({ a: '#2a8ac8', b: '#7ad7ff', c: '#ffffff' }, ['.aba.', 'abcba', 'bcccb', 'abcba', '.aba.'], { outline: false, emit: 'bc' });
  S.inkball = mk({ a: '#0a0a14', b: '#2a2a4a', c: '#5a5a8a' }, ['.aa.', 'abca', 'abba', '.aa.']);

  // ---------- 霜天の霊峰 ----------
  // 雪狼: 青みがかった灰色の狼(右向き。走る 2コマ)。目が氷色に光る
  const wolfPal = { a: '#2a3448', b: '#a8b8d0', c: '#e8f0ff', d: '#9ff7ff' };
  S.wolf = [mk(wolfPal, ['........c.c.', '........cbbc', 'cc......bbdb', '.cbbbbbbbbbb', '..bbcccccb..', '..b.b..b.b..', '.b...b.b...b'], { emit: 'd' }),
    mk(wolfPal, ['........c.c.', '........cbbc', '.cc.....bbdb', '..cbbbbbbbbb', '..bbcccccb..', '...bb..bb...', '...b.b..bb..'], { emit: 'd' })];
  // 氷の精: 宙に浮く氷の結晶の精。まわりを氷のかけらが回る(2コマ)
  const isPal = { a: '#1e3a7a', b: '#9ff7ff', c: '#ffffff', d: '#5ab8e8' };
  S.icesprite = [mk(isPal, ['...c...', '..cbc..', '.cbbbc.', 'cbababc', '.cbbbc.', '..dbd..', '...d...', '.b...b.'], { emit: 'bc' }),
    mk(isPal, ['...c...', '..cbc..', '.cbbbc.', 'cbababc', '.cbbbc.', '..dbd..', '.b.d.b.', '.......'], { emit: 'bc' })];
  // イエティ: 白い毛むくじゃらの大男。青い顔と、氷色に光る目
  S.yeti = mk({ a: '#3a4a6a', b: '#e8eef8', c: '#ffffff', d: '#8aa0c8', e: '#5a7ab8', f: '#1a2a4a', h: '#9ff7ff' }, sym([
    '....bbb', '...bccc', '..bcccc', '..bceee', '..beehe', '..bdeee', '.bbdeff', 'bbcbbbb', 'bccbbbb', 'bcbbbbb', 'bdbbbbd', '.bbbbbd', '..bbbbb', '..bbb..', '.dddd..',
  ]), { emit: 'h' });
  // 霜の巨人: 青い肌の巨人。氷の冠と白いひげ、毛皮の腰巻き、氷をまとった拳
  S.fgiant = mk({ a: '#141c34', b: '#34507e', c: '#5576a8', d: '#8aa8d8', e: '#9ff7ff', f: '#e8f0fc', g: '#232f4a', h: '#5a4a3a' }, sym([
    '.......e....', '....e..ee..e', '....ee.eee.e', '.....eeeeeee', '.....abbbbbb', '....abcccccc', '....abcdeccc', '....abcccccc', '....abffffff', '...aabffffff', '.aabbbgffffg',
    'abcdbbggfffg', 'abcddbgggggg', 'abccbbgggggg', 'abcbbhhhhhhh', '.abb.bgggggg', '.aee.bggggbg', '..e..bgggbbg', '.....bbbb...', '.....bbb....', '.....bbb....', '....gggg....',
  ]), { emit: 'e' });
  // 雪華の女王: 氷の冠と白銀の髪、青い氷の衣
  S.squeen = mk({ a: '#9ff7ff', b: '#ffffff', c: '#a8ccf4', d: '#5a88c8', e: '#2e4a80', f: '#f4e8f0', h: '#d8ecff', k: '#1a2a5a', g: '#9ff7ff' }, sym([
    '......a.a', '...a..aaa', '...aa.aba', '...aaaaaa', '..hhhhhhh', '.hhffffff', '.hhfkffff', '.hhffffff', '.hhhfffff', '.hhh.cbcc', '..h.cbbcb',
    '...cdccbc', '..cddcccc', '..cdddccc', '.cdddedcc', '.cddeddcc', '.cdeedddc', 'cddedddcc', 'cdeddddcg', 'cdeedddgg', 'eeeeeeeee',
  ]), { emit: 'a' }); // 光るのは冠だけ(白い衣まで光らせると白く飛ぶ)
  // 氷塊(霜の巨人の氷槌の跡)/ 氷の鏡(雪華の女王)
  S.obj_iceblock = mk({ a: '#2a4a7a', b: '#7ad7ff', c: '#bff4ff', d: '#ffffff', e: '#4a8ac8' }, [
    '...cccccc...', '..cdddcccb..', '.cddccccbbb.', '.cdcccccbbe.', '.ccccccbbbe.', '.cccccbbbee.', '.cccbbbbbee.', '.bbbbbbbeee.', '.bbbbbbeeee.', '..beeeeeee..', '.aaaaaaaaaa.',
  ], { emit: 'd' });
  // 氷柱の墓標(雪華の女王): 大きな氷の槍。空へ飛ぶときは穂先が上(icespireUp)、落ちて刺さったら穂先が下(obj_tomb)
  const spirePal = { a: '#2a4a7a', b: '#9ff7ff', c: '#ffffff', d: '#d8f0ff', e: '#7ab8e8' };
  const spireRows = ['....c....', '...cdc...', '...cdc...', '..cbdbc..', '..cbdbc..', '..bbdbb..', '..bbdbb..', '.abbdbba.', '.abbdbba.', '..abdba..', '..abdba..', '...bdb...', '...bdb...', '..ebdbe..', '.eebdbee.', '..ebdbe..', '...bdb...', '...bdb...', '...aba...', '....a....'];
  S.icespireUp = mk(spirePal, spireRows, { emit: 'cd' });
  S.obj_tomb = mk(spirePal, spireRows.slice().reverse().map((r, i) => (i > 15 ? r.replace(/[a-e]/g, m => (m === 'c' ? 'd' : m)) : r)), { emit: 'cd' });
  // 弾: 氷の欠片(右向き。回転フレーム)/ 氷の槍 / 雪の結晶(大・小)/ 雪玉(放物線)
  S.eice = mk({ a: '#5ab8e8', b: '#9ff7ff', c: '#ffffff' }, ['.ab.', 'aabc', '.ab.'], { emit: 'bc' });
  S.ispear = mk({ a: '#7ab8e8', b: '#9ff7ff', c: '#ffffff' }, ['.......b..', 'abbbbbbbcc', '.......b..'], { emit: 'bc' });
  S.flake = mk({ a: '#9ff7ff', b: '#ffffff' }, ['a.a.a', '.aba.', 'abbba', '.aba.', 'a.a.a'], { outline: false, emit: 'ab' });
  S.flakeS = mk({ a: '#9ff7ff', b: '#ffffff' }, ['.a.', 'aba', '.a.'], { outline: false, emit: 'ab' });
  S.snowball = mk({ a: '#8aa0c8', b: '#ffffff', c: '#e8f4ff' }, ['.aa.', 'abca', 'acba', '.aa.']);

  // ---------- 終刻の時計塔 ----------
  // 歯車: 転がる真鍮の歯車(回転の 2コマ。歯の位置が半歯ずれる)
  const gearPal = { a: '#3a2a18', b: '#8a6a30', c: '#c8a050', d: '#ffd27a', e: '#2a1e14' };
  S.gear = [mk(gearPal, ['....ccc....', '..c.cdc.c..', '.ccbbbbbcc.', '..bbcccbb..', 'ccbcbbbcbcc', 'cdbcbebcbdc', 'ccbcbbbcbcc', '..bbcccbb..', '.ccbbbbbcc.', '..c.cbc.c..', '....ccc....'], { emit: 'd' }),
    mk(gearPal, ['...c...c...', '..cccbccc..', '.cdbbbbbbc.', '..bbcccbb..', '.cbcbbbcbc.', '.dbcbebcbb.', '.cbcbbbcbc.', '..bbcccbb..', '.cbbbbbbdc.', '..cccbccc..', '...c...c...'], { emit: 'd' })];
  // 時計兵: 頭が時計の文字盤になったブリキの兵隊(赤い上着に真鍮のボタン)
  S.clockman = mk({ a: '#2a1e14', b: '#8a6a30', c: '#c8a050', d: '#fff0c8', e: '#241e1a', f: '#7a2a2a', g: '#ffd27a' }, [
    '..ccccc..', '.cdddddc.', 'cdddedddc', 'cdddeeedc', 'cdddddddc', '.cdddddc.', '..cbbbc..', '.fffffff.', 'gfffcfffg', '.fffcfff.', '.fffffff.', '..bb.bb..', '..aa.aa..',
  ], { emit: 'g' });
  // 砂時計の精: 宙に浮く砂時計(砂が落ちる 2コマ)。足元に光る砂の粒
  const hgPal = { a: '#5a4a30', b: '#c8a050', c: '#bff4ff', d: '#e8c88a', e: '#9ff7ff' };
  S.hglass = [mk(hgPal, ['bbbbbbb', '.cdddc.', '.cdddc.', '..cdc..', '...d...', '..cdc..', '.c.d.c.', '.cdddc.', 'bbbbbbb', '.e...e.'], { emit: 'e' }),
    mk(hgPal, ['bbbbbbb', '.c.d.c.', '.cdddc.', '..cdc..', '...d...', '..cdc..', '.cdddc.', '.cdddc.', 'bbbbbbb', '..e.e..'], { emit: 'e' })];
  // 時計仕掛けの番人: 鐘の頭(赤く光る目)、胸に文字盤、真鍮の体(背中のゼンマイは描画側で回す)
  S.warden = mk({ a: '#2a1e14', b: '#5a4420', c: '#a8843c', d: '#d8b060', e: '#c8b890', f: '#241e1a', g: '#ff5d3a', h: '#5a5a6a' }, sym([
    '..........dd', '.........cdd', '........ccdd', '.......cccdd', '......ccccdd', '......cgcccc', '.....cccccdd', '....bbbbbbbb', '......aaaaaa', '..bbbbcccccc',
    '.bcccbceeeee', 'bccdcbeeeeff', 'bcdccbeeeeef', 'bccccbeeeeee', 'bcccb.beeeee', '.bcb..bbbbbb', '.dhd..bcccbb', '..h...bbb...', '.....bbbb...', '.....hhhh...',
  ]), { emit: 'g' });
  // 秒針の弾(終刻の死神): 赤い秒針(右向き。回転フレームで描く)
  S.tick = mk({ a: '#8a1020', b: '#ff3b5c', c: '#ffd0d8' }, ['a.....', 'abbbbc', 'a.....'], { emit: 'bc' });
  // 死神の砂時計(壊せる物): 紫の枠の大きな砂時計
  S.obj_sandglass = mk({ a: '#2b1b4a', b: '#6a4ab0', c: '#d8c8ff', d: '#e8c88a', e: '#c29bff' }, [
    'abbbbbbba', '.ac...ca.', '.acdddca.', '.acdddca.', '..acdca..', '...ada...', '..ac.ca..', '.ac.d.ca.', '.acdddca.', '.addddda.', 'abbbbbbba',
  ], { emit: 'e' });
  // 終刻の時計(終刻の死神): 振り子のついた大きな柱時計。文字盤の数字は描画側で
  S.obj_doom = mk({ a: '#1a0a14', b: '#5a1a2a', c: '#8a1020', d: '#e8e0d0', e: '#c8a050', f: '#ff3b5c' }, [
    '....eeeee....', '..eebbbbbee..', '.ebddddddbe..', 'ebddddddddbe.', 'ebddddddddbe.', 'ebddddddddbe.', 'ebddddddddbe.', 'ebddddddddbe.', '.ebddddddbe..', '..ebbbbbbe...', '...bcccccb...',
    '...bc.e.cb...', '...bc.e.cb...', '...bc.e.cb...', '...bc.f.cb...', '...bcfffcb...', '...bc.f.cb...', '...bcccccb...', '..bbbbbbbbb..', '..aaaaaaaaa..',
  ], { emit: 'f' });
  // 歯車の絵を作る(半径 R・歯 n 枚・位相 ph)。大歯車(番人)は 2コマで回して見せる
  const gearRows = (R, n, ph) => {
    const rows = [], S2 = R + 3;
    for (let y = -S2; y <= S2; y++) {
      let row = '';
      for (let x = -S2; x <= S2; x++) {
        const d = Math.hypot(x, y), an = Math.atan2(y, x), tooth = Math.cos(an * n + ph) > 0.25, out = tooth ? R + 2.5 : R;
        const spoke = Math.abs(Math.sin((an + ph / n) * 3)) < 0.18;
        row += d > out ? '.' : d > R - 1.5 ? (y < -R * 0.4 && x < 0 ? 'd' : 'c') : d < R * 0.22 ? 'a' : d < R * 0.32 ? 'c' : d > R - 4.5 ? 'b' : spoke ? 'c' : 'e'; // 光るのは縁の左上の照り返しだけ
      }
      rows.push(row);
    }
    return rows;
  };
  const bgPal = { a: '#241e1a', b: '#8a6a30', c: '#c8a050', d: '#ffd27a', e: '#3a2e1e' };
  S.obj_biggear = [mk(bgPal, gearRows(27, 12, 0), { emit: 'd' }), mk(bgPal, gearRows(27, 12, Math.PI), { emit: 'd' })];

  // 炎魔イフリート: 黒い角と燃える髪、赤黒い筋骨の上半身、両手に炎。下半身は炎になって浮いている
  const ifritRows = sym([
    '..h.........',
    '..hh........',
    '..hh....f...',
    '...hh..fgf..',
    '...hhaafggf.',
    '....abbbbaff',
    '....abbbbbbb',
    '...abbebbbbb',
    '...abbbbbbbb',
    '....abbbbmmm',
    '..aaabbbbbbb',
    '.abbbbabbbbb',
    'abbcbbbabbbb',
    'abcbbbbbabbb',
    'abbb.abbbbgg',
    '.ab..abbbbgw',
    '.ff..abbbbgg',
    'fgf...abbbbb',
    '.f....affbbf',
    '.......ffgff',
    '........fgf.',
    '.........ff.',
  ]);
  S.ifrit = mk({ h: '#2a1414', a: '#1e0a08', b: '#6a1a10', c: '#a8381a', e: '#ffff80', m: '#ffc34a', f: '#ff6a2a', g: '#ffc34a', w: '#fff0b0' }, ifritRows, { emit: 'emfgw' });
  // 激昂: 赤熱した体。角と筋が光り、炎は白く燃える
  S.ifritRage = mk({ h: '#ff3b1a', a: '#3a0a04', b: '#a8281a', c: '#ff8a3d', e: '#ffffff', m: '#fff0b0', f: '#ffc34a', g: '#fff0b0', w: '#ffffff' }, ifritRows, { emit: 'hcemfgw' });

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
  S.bladeEvo = mk({ a: '#b80c22', b: '#5a000c', c: '#e0283a' }, [ // ブラッドサークル(血の色の刃)
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
  S.bball = mk({ a: '#2a6a8a', b: '#6ee7ff', c: '#efe9d4' }, ['.aba.', 'abcba', 'bcccb', 'abcba', '.aba.'], { outline: false, emit: 'bc' }); // 肋骨の魔弾(骨柱の弾): 骨柱と同じ青白い光
  S.arrow = mk({ a: '#8a6a3a', b: '#e8e6da', c: '#ffb13a' }, ['c.....', '.aaaab', 'c.....']);
  // ボスが出す壊せる物: 腐肉の山(脈打つ肉塊。2コマ)/ 肋骨の魔弾の骨柱
  const meatPal = { a: '#3a1a14', b: '#7a2a20', c: '#c2483a', d: '#7fae4e', e: '#b8d86a', f: '#e8e0c0', g: '#4a6e30' };
  S.obj_meat = [mk(meatPal, ['....dd.d....', '..dbbccbd...', '.bccbbcccb..', 'bcccfbbcccb.', 'bcbcccbccbbd', 'abcccgccfcba', 'abbccbbccbba', '.aabbbbbbaa.'], { emit: 'e' }),
    mk(meatPal, ['...d.dd.....', '..dbccbbd...', '.bcccbbccb..', 'bccfbbcccbb.', 'dbbcccbcccbd', 'abccgcccfcba', 'abbccbbccbba', '.aabbbbbbaa.'], { emit: 'e' })];
  S.obj_pillar = mk({ a: '#8a8676', b: '#d8d0b8', c: '#efe9d4', d: '#6ee7ff', e: '#4a4638' }, [
    '..cc..', '.cbbc.', '.abba.', '..bb..', '..bd..', '.abba.', '..bb..', '..bb..', '..db..', '.abba.', '..bb..', '.abba.', 'eaccae',
  ], { emit: 'd' });
  // 炎の祭壇(イフリート): 石の台の上で炎が揺らめく(2コマ)。台の紋が赤く光る
  const altarPal = { a: '#2a1e1e', b: '#6a5050', c: '#ff6a2a', f: '#ff6a2a', g: '#ffc34a', w: '#fff0b0', d: '#4a3838' };
  S.obj_altar = [mk(altarPal, ['...f...', '..fgf..', '.fgwgf.', '..fgf..', 'aaaaaaa', 'abdddba', '.abcba.', '..bcb..', '.abbba.', 'aaaaaaa'], { emit: 'cfgw' }),
    mk(altarPal, ['..f....', '..fgf..', '.fgwgf.', '.fgf...', 'aaaaaaa', 'abdddba', '.abcba.', '..bcb..', '.abbba.', 'aaaaaaa'], { emit: 'cfgw' })];
  S.gore = mk(meatPal,['.dbb.', 'bccbb', 'bcfcb', '.bba.']); // 腐肉の王が吐き出す肉塊(放物線で飛ぶ)
  S.bspear = mk({ a: '#efe9d4', b: '#b8b098', c: '#6ee7ff' }, ['..........a..', 'bbbbbbbbbbaac', '..........a..'], { emit: 'c' }); // 白骨竜の骨槍

  // 通常敵の弾: 火の小鬼の火の玉 / 砂術師の砂の弾 / 投槍兵の槍(右向き。回転フレームで描く)
  // 七色の欠片(大鹿・女王の弾): 色ごとの菱形
  S.pshard = ['#ff5d73', '#ff9a3d', '#ffd23f', '#7dff9a', '#7ad7ff', '#8a7aff', '#d88aff'].map(c => mk({ a: c, b: '#ffffff' }, ['.a.', 'aba', '.a.'], { outline: false, emit: 'ab' }));
  S.efire = mk({ a: '#b8261a', b: '#ff6a2a', c: '#ffc34a', d: '#fff6c8' }, ['.aba.', 'abcba', 'bcdcb', 'abcba', '.aba.'], { outline: false, emit: 'bcd' });
  S.esand = mk({ a: '#8a5a2a', b: '#e8c88a', c: '#fff0c0' }, ['.ab.', 'abcb', 'bccb', '.bb.'], { emit: 'c' });
  S.espear = mk({ a: '#6b4a2a', b: '#dfe8f5', c: '#ffffff' }, ['.........b..', 'aaaaaaaaabbc', '.........b..']);
  S.scythe = mk({ a: '#c29bff', b: '#ffffff', c: '#5a3a9a' }, ['..aaa..', '.a...a.', 'b.....a', '.....ca', '....c..', '...c...'], { emit: 'ab' });
  S.rscythe = mk({ a: '#ff3b5c', b: '#ffd0d8', c: '#5a1020' }, ['..aaa..', '.a...a.', 'b.....a', '.....ca', '....c..', '...c...'], { emit: 'a' }); // 終刻の死神の赤い鎌
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
      : kind === 'flipE' ? (sp.e ? flipX(sp.e) : null) : kind === 'whiteFlip' ? silhouette(flipX(sp.c)) : kind === 'shadow' ? silhouette(sp.c, '#000') : kind === 'gold' ? silhouette(sp.c, '#ffd23f') : kind === 'goldFlip' ? silhouette(flipX(sp.c), '#ffd23f') : kind === 'ice' ? silhouette(sp.c, '#8fe4ff') : kind === 'iceFlip' ? silhouette(flipX(sp.c), '#8fe4ff') : kind === 'frz' ? silhouette(sp.c, '#3f86c8') : kind === 'frzFlip' ? silhouette(flipX(sp.c), '#3f86c8') : null; // frz: 凍結(光で白く飛ばない濃い青)
    return v[kind];
  }

  // 回転フレーム(16方向)
  const ROT = {};
  for (const k of ['axe', 'blade', 'bladeEvo', 'arrow', 'scythe', 'espear', 'bspear', 'trident', 'needle', 'eice', 'ispear', 'tick', 'rscythe']) {
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
