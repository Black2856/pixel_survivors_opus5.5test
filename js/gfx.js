// gfx.js — 描画レイヤー(低解像度 2D canvas ×3)と WebGL ポストプロセス
//   scene: 通常描画 / light: ライトマップ(加算) / glow: 発光体(加算, ブルーム源)
//   合成: scene × (環境光 + ライト) + glow → ブルーム(ブライトパス + ガウスぼかし) → 衝撃波歪み・色収差・ビネット・走査線
'use strict';

const GFX = (() => {
  const out = document.getElementById('game');
  const mk = () => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; };
  const [scene, sctx] = mk(), [light, lctx] = mk(), [glow, gctx] = mk();
  // 自分の攻撃専用レイヤー(濃さ設定に合わせて半透明で合成する)
  const [mscene, msctx] = mk(), [mglow, mgctx] = mk();
  const G = {
    scene, sctx, light, lctx, glow, gctx, mscene, msctx, mglow, mgctx, VW: 480, VH: 270, PX: 4, gl: null, lightMul: 1,
    ambient: [0.5, 0.5, 0.6], tint: [1, 1, 1],
    fx: { flash: 0, flashCol: [1, 1, 1], aberr: 0, hurt: 0, lowhp: 0, sat: 1, bloom: 1, time: 0 },
    waves: [],
  };

  function resize() {
    const dpr = 1;
    const iw = innerWidth, ih = innerHeight;
    G.PX = Math.max(2, Math.round(Math.min(iw / 480, ih / 280)));
    G.VW = Math.ceil(iw / G.PX); G.VH = Math.ceil(ih / G.PX);
    for (const c of [scene, glow, mscene, mglow]) { c.width = G.VW; c.height = G.VH; }
    light.width = Math.ceil(G.VW / 2); light.height = Math.ceil(G.VH / 2);
    out.width = G.VW * G.PX * dpr; out.height = G.VH * G.PX * dpr;
    out.style.width = G.VW * G.PX + 'px'; out.style.height = G.VH * G.PX + 'px';
    for (const x of [sctx, gctx, lctx, msctx, mgctx]) x.imageSmoothingEnabled = false;
    if (G.gl) allocTargets();
  }

  // ---------- WebGL ----------
  let gl, progs = {}, tex = {}, fbo = {}, quad;
  const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

  const FS_COMPOSITE = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uScene, uLight, uGlow;
uniform vec3 uAmb;
void main(){
  vec2 t = vec2(uv.x, 1.-uv.y);
  vec3 s = texture(uScene, t).rgb;
  vec3 L = texture(uLight, t).rgb;
  vec3 g = texture(uGlow, t).rgb;
  vec3 lit = s * (uAmb + L * 1.35);
  o = vec4(lit + g * 0.9, 1.);
}`;

  const FS_BRIGHT = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uSrc, uGlow;
void main(){
  vec3 c = texture(uSrc, uv).rgb;
  vec3 g = texture(uGlow, vec2(uv.x, 1.-uv.y)).rgb;
  float l = dot(c, vec3(0.299,0.587,0.114));
  o = vec4(c * smoothstep(0.62, 1.0, l) * 0.6 + g * 1.1, 1.);
}`;

  const FS_BLUR = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uDir;
void main(){
  vec3 c = texture(uSrc, uv).rgb * 0.227;
  c += (texture(uSrc, uv + uDir*1.385).rgb + texture(uSrc, uv - uDir*1.385).rgb) * 0.316;
  c += (texture(uSrc, uv + uDir*3.231).rgb + texture(uSrc, uv - uDir*3.231).rgb) * 0.070;
  o = vec4(c, 1.);
}`;

  const FS_FINAL = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uSrc, uBloom, uBloom2;
uniform vec2 uRes; uniform float uPX;
uniform vec4 uWaves[6];
uniform vec3 uTint, uFlashCol;
uniform float uTime, uFlash, uAberr, uHurt, uLow, uSat, uBloomK, uPost;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec2 st = uv;
  float asp = uRes.x / uRes.y;
  // 衝撃波(リング状に UV を押し出す)
  for (int i = 0; i < 6; i++) {
    vec4 w = uWaves[i];
    if (w.w <= 0.0) continue;
    vec2 d = st - w.xy; d.x *= asp;
    float r = length(d);
    float k = (r - w.z);
    float ring = exp(-k*k*900.0) * w.w;
    st -= normalize(d + 1e-5) * vec2(1.0/asp, 1.0) * ring * 0.03;
  }
  // 画面端ほど強い色収差
  vec2 cd = st - 0.5;
  float ab = (0.0015 + uAberr * 0.012) * dot(cd, cd) * 4.0 * uPost;
  vec3 col;
  col.r = texture(uSrc, st + cd * ab).r;
  col.g = texture(uSrc, st).g;
  col.b = texture(uSrc, st - cd * ab).b;
  vec3 bl = texture(uBloom, st).rgb + texture(uBloom2, st).rgb * 0.8;
  col += bl * uBloomK;
  // グレーディング
  col *= uTint;
  float lum = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(lum), col, uSat);
  col = col / (1.0 + col * 0.18) * 1.12; // ソフトトーンマップ
  // 瀕死: 赤い脈動
  float vig = smoothstep(0.95, 0.25, length(cd * vec2(1.0, 0.85)));
  col = mix(col, col * vec3(1.25, 0.35, 0.35), (1.0 - vig) * (uHurt * 0.9 + uLow * (0.45 + 0.25 * sin(uTime * 6.0))));
  col *= mix(0.55, 1.0, vig);
  // 走査線(実ピクセル行単位) + フィルムグレイン
  float row = mod(gl_FragCoord.y, uPX);
  col *= 1.0 - 0.10 * step(uPX - 1.0, row) * uPost;
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.025 * uPost;
  col = mix(col, uFlashCol, uFlash);
  o = vec4(col, 1.);
}`;

  function compile(fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  function mkTex(filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function mkTarget(w, h, filter) {
    const t = mkTex(filter);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }

  function allocTargets() {
    for (const k in fbo) { gl.deleteTexture(fbo[k].t); gl.deleteFramebuffer(fbo[k].f); }
    const w = G.VW, h = G.VH;
    fbo.comp = mkTarget(w, h, gl.NEAREST);
    const w2 = Math.ceil(w / 2), h2 = Math.ceil(h / 2), w4 = Math.ceil(w / 4), h4 = Math.ceil(h / 4);
    fbo.a = mkTarget(w2, h2, gl.LINEAR); fbo.b = mkTarget(w2, h2, gl.LINEAR);
    fbo.c = mkTarget(w4, h4, gl.LINEAR); fbo.d = mkTarget(w4, h4, gl.LINEAR);
  }

  function initGL() {
    try {
      gl = out.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
      if (!gl) return false;
      progs.comp = compile(FS_COMPOSITE); progs.bright = compile(FS_BRIGHT);
      progs.blur = compile(FS_BLUR); progs.fin = compile(FS_FINAL);
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      tex.scene = mkTex(gl.NEAREST); tex.light = mkTex(gl.LINEAR); tex.glow = mkTex(gl.NEAREST);
      G.gl = gl;
      allocTargets();
      return true;
    } catch (e) {
      console.warn('WebGL2 初期化失敗 → 2D フォールバック', e);
      G.gl = null;
      return false;
    }
  }

  function upload(t, c) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }
  function bindTex(unit, t, loc) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); }
  function pass(prog, target) {
    gl.useProgram(prog.p);
    if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, out.width, out.height); }
  }
  const draw = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  function blur(src, tmp, dst, spread) {
    const b = progs.blur;
    pass(b, tmp); bindTex(0, src.t, b.u.uSrc); gl.uniform2f(b.u.uDir, spread / src.w, 0); draw();
    pass(b, dst); bindTex(0, tmp.t, b.u.uSrc); gl.uniform2f(b.u.uDir, 0, spread / tmp.h); draw();
  }

  // フォールバック: WebGL が無い環境では 2D で近似合成
  const out2d = { ctx: null };
  function present2D() {
    if (!out2d.ctx) { out2d.ctx = out.getContext('2d'); }
    const x = out2d.ctx;
    x.imageSmoothingEnabled = false;
    x.globalCompositeOperation = 'source-over';
    x.drawImage(scene, 0, 0, out.width, out.height);
    x.globalCompositeOperation = 'lighter';
    x.drawImage(glow, 0, 0, out.width, out.height);
    x.globalCompositeOperation = 'source-over';
    if (G.fx.flash > 0) { x.globalAlpha = G.fx.flash; x.fillStyle = '#fff'; x.fillRect(0, 0, out.width, out.height); x.globalAlpha = 1; }
  }

  const waveBuf = new Float32Array(24);
  function present() {
    if (!G.gl) return present2D();
    const f = G.fx;
    upload(tex.scene, scene); upload(tex.light, light); upload(tex.glow, glow);

    const c = progs.comp;
    pass(c, fbo.comp);
    bindTex(0, tex.scene, c.u.uScene); bindTex(1, tex.light, c.u.uLight); bindTex(2, tex.glow, c.u.uGlow);
    gl.uniform3fv(c.u.uAmb, G.ambient);
    draw();

    const q = gq();
    if (q.bloom > 0) { // 低品質ではブルームのパスごと省略
      const b = progs.bright;
      pass(b, fbo.a); bindTex(0, fbo.comp.t, b.u.uSrc); bindTex(1, tex.glow, b.u.uGlow); draw();
      blur(fbo.a, fbo.b, fbo.a, 1.0);
      // 広域ブルーム: 1/4 解像度へ縮小してさらにぼかす
      const bl = progs.blur;
      pass(bl, fbo.c); bindTex(0, fbo.a.t, bl.u.uSrc); gl.uniform2f(bl.u.uDir, 0, 0); draw();
      blur(fbo.c, fbo.d, fbo.c, 1.6);
      blur(fbo.c, fbo.d, fbo.c, 2.6);
    }

    const fn = progs.fin;
    pass(fn, null);
    bindTex(0, fbo.comp.t, fn.u.uSrc); bindTex(1, fbo.a.t, fn.u.uBloom); bindTex(2, fbo.c.t, fn.u.uBloom2);
    gl.uniform2f(fn.u.uRes, out.width, out.height);
    gl.uniform1f(fn.u.uPX, G.PX);
    waveBuf.fill(0);
    G.waves.slice(0, 6).forEach((w, i) => waveBuf.set([w.u, w.v, w.r, w.a], i * 4));
    gl.uniform4fv(fn.u.uWaves, waveBuf);
    gl.uniform3fv(fn.u.uTint, G.tint);
    gl.uniform3fv(fn.u.uFlashCol, f.flashCol);
    gl.uniform1f(fn.u.uTime, f.time);
    gl.uniform1f(fn.u.uFlash, Math.min(1, f.flash));
    gl.uniform1f(fn.u.uAberr, f.aberr);
    gl.uniform1f(fn.u.uHurt, f.hurt);
    gl.uniform1f(fn.u.uLow, f.lowhp);
    gl.uniform1f(fn.u.uSat, f.sat);
    gl.uniform1f(fn.u.uBloomK, f.bloom * q.bloom);
    gl.uniform1f(fn.u.uPost, q.post);
    draw();
  }

  // 衝撃波: ワールド座標 → 画面UV(WebGLはY上向き)
  G.shock = (sx, sy, strength = 1, speed = 0.9) => {
    if (G.waves.length >= 6) G.waves.shift();
    G.waves.push({ u: sx / G.VW, v: 1 - sy / G.VH, r: 0, a: strength, spd: speed, k: strength });
  };
  G.updateFx = dt => {
    const f = G.fx;
    f.time += dt;
    f.flash = Math.max(0, f.flash - dt * 3.2);
    f.aberr = Math.max(0, f.aberr - dt * 2.5);
    f.hurt = Math.max(0, f.hurt - dt * 2.2);
    for (let i = G.waves.length - 1; i >= 0; i--) {
      const w = G.waves[i];
      w.r += dt * w.spd;
      w.a = w.k * Math.max(0, 1 - w.r / 0.7);
      if (w.a <= 0.01) G.waves.splice(i, 1);
    }
  };

  resize();
  initGL();
  addEventListener('resize', resize);
  G.present = present;
  return G;
})();
