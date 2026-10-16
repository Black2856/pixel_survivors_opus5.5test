// detmath.js — ブラウザ(JS エンジン)で結果が変わらない Math の関数(試作)
//   + - * / % と Math.sqrt・floor・round・abs(IEEE で結果が決まっている物)だけで計算する。係数は fdlibm(FreeBSD の libm)から
//   ゲームが使う sin / cos / tan / atan / atan2 / asin / hypot / pow / exp を置き換える(log は pow の中で使う)
//   協力プレイ(claudedocs/coop.md 3章・7章 0段)の確かめ用。まだ index.html にもビルドにも入れていない(入れ方は 7章 1段で決める)
//   ゲームより先に読むと Math のこれらの関数を置き換える(window.__detMathInstall = false なら置き換えず、DETMATH / NATIVEMATH に置くだけ)
//   確かめた結果(2026-10-16, Chromium 156 / Firefox 157 / WebKit 27.2): 3つで 1ビットも違わない。ネイティブとの差は相対 2〜4e-16(pow の小数乗は 6e-15)
'use strict';
(() => {
  const N = {}; for (const k of ['sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'hypot', 'pow', 'exp', 'log']) N[k] = Math[k];
  const sqrt = Math.sqrt, round = Math.round;
  const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
  const HI = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 1 : 0; // リトルエンディアンなら上位の語は [1]
  const pow2 = k => { // 2^k(-1074〜1023)。ビットで作るので正確
    if (k > 1023) return Infinity;
    if (k < -1022) return pow2(k + 600) * pow2(-600);
    u32[HI] = (k + 1023) << 20; u32[1 - HI] = 0; return f64[0];
  };

  // ---------- sin / cos ----------
  // π/2 を 3つに分けた値(上の 2つは 33ビットなので、n < 2^20 なら n × 値 は丸めなしで正確)
  const PIO2_1 = 1.57079632673412561417e+00, PIO2_2 = 6.07710050630396597660e-11, PIO2_2T = 2.02226624879595063154e-21, INVPIO2 = 6.36619772367581382433e-01;
  const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04,
    S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
  const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05,
    C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
  const ksin = x => { const z = x * x, v = z * x, r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6))); return x + v * (S1 + z * r); };
  const kcos = x => { const z = x * x, w = z * z, r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6)), hz = 0.5 * z, w2 = 1 - hz; return w2 + (((1 - w2) - hz) + z * r); };
  const TAU = 6.283185307179586;
  let qn = 0;
  const reduce = x => { // x → [-π/4, π/4] の r と、象限 qn
    if (x > 1e8 || x < -1e8) x = x % TAU; // とても大きい角度(時間 × 速さなど)は先に 2π で割った余り(% は正確)
    const n = round(x * INVPIO2);
    qn = n & 3;
    return ((x - n * PIO2_1) - n * PIO2_2) - n * PIO2_2T;
  };
  const sin = x => {
    if (x !== x || x === Infinity || x === -Infinity) return NaN;
    if (x === 0) return x; // -0 を -0 のまま
    if (x > -0.7853981633974483 && x < 0.7853981633974483) return ksin(x);
    const r = reduce(x);
    return qn === 0 ? ksin(r) : qn === 1 ? kcos(r) : qn === 2 ? -ksin(r) : -kcos(r);
  };
  const cos = x => {
    if (x !== x || x === Infinity || x === -Infinity) return NaN;
    if (x > -0.7853981633974483 && x < 0.7853981633974483) return kcos(x);
    const r = reduce(x);
    return qn === 0 ? kcos(r) : qn === 1 ? -ksin(r) : qn === 2 ? -kcos(r) : ksin(r);
  };
  const tan = x => sin(x) / cos(x);

  // ---------- atan / atan2 / asin ----------
  const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
  const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
  const AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
    9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
    4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
  const atan = x0 => {
    if (x0 !== x0) return NaN;
    const neg = x0 < 0 || Object.is(x0, -0); let x = neg ? -x0 : x0, id;
    if (x >= 7.378697629483821e19) return neg ? -(ATANHI[3] + ATANLO[3]) : ATANHI[3] + ATANLO[3];
    if (x < 0.4375) { if (x < 7.450580596923828e-9) return x0; id = -1; }
    else if (x < 1.1875) { if (x < 0.6875) { id = 0; x = (2 * x - 1) / (2 + x); } else { id = 1; x = (x - 1) / (x + 1); } }
    else if (x < 2.4375) { id = 2; x = (x - 1.5) / (1 + 1.5 * x); }
    else { id = 3; x = -1 / x; }
    const z = x * x, w = z * z;
    const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
    const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
    if (id < 0) { const r = x - x * (s1 + s2); return neg ? -r : r; }
    const r = ATANHI[id] - ((x * (s1 + s2) - ATANLO[id]) - x);
    return neg ? -r : r;
  };
  const PI = 3.1415926535897931160e+00, PI_LO = 1.2246467991473531772e-16, PIO2 = 1.5707963267948965580e+00;
  const atan2 = (y, x) => {
    if (x !== x || y !== y) return NaN;
    if (!isFinite(x) || !isFinite(y)) return N.atan2(y, x); // 無限大は決まった定数
    if (y === 0) return (x > 0 || Object.is(x, 0)) ? y : (Object.is(y, -0) ? -PI : PI);
    if (x === 0) return y > 0 ? PIO2 : -PIO2;
    const z = atan(Math.abs(y / x));
    if (x > 0) return y > 0 ? z : -z;
    return y > 0 ? PI - (z - PI_LO) : (z - PI_LO) - PI;
  };
  const asin = x => atan2(x, sqrt((1 - x) * (1 + x)));

  // ---------- hypot ----------
  const hypot = function (a, b) {
    if (arguments.length === 2) return sqrt(a * a + b * b);
    let s = 0; for (let i = 0; i < arguments.length; i++) { const v = +arguments[i]; s += v * v; }
    return sqrt(s);
  };

  // ---------- exp / log / pow ----------
  const LN2HI = 6.93147180369123816490e-01, LN2LO = 1.90821492927058770002e-10, INVLN2 = 1.44269504088896338700e+00;
  const P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05,
    P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08;
  const exp = x => {
    if (x !== x) return NaN;
    if (x > 709.782712893384) return Infinity;
    if (x < -745.1332191019411) return 0;
    if (x > -3.725290298461914e-9 && x < 3.725290298461914e-9) return 1 + x;
    const k = round(x * INVLN2), hi = x - k * LN2HI, lo = k * LN2LO, r = hi - lo;
    const t = r * r, c = r - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
    const y = 1 - ((lo - (r * c) / (2 - c)) - hi);
    return k === 0 ? y : k > 1023 ? y * 2 * pow2(k - 1) : y * pow2(k);
  };
  const LG1 = 6.666666666666735130e-01, LG2 = 3.999999999940941908e-01, LG3 = 2.857142874366239149e-01, LG4 = 2.222219843214978396e-01,
    LG5 = 1.818357216161805012e-01, LG6 = 1.531383769920937332e-01, LG7 = 1.479819860511658591e-01;
  const log = x => {
    if (x !== x || x < 0) return NaN;
    if (x === 0) return -Infinity;
    if (x === Infinity) return Infinity;
    let k = 0;
    if (x < 2.2250738585072014e-308) { x *= 18014398509481984; k = -54; } // 非正規化数
    f64[0] = x; const hx = u32[HI];
    k += ((hx >>> 20) & 0x7ff) - 1023;
    u32[HI] = (hx & 0x000fffff) | 0x3ff00000; let m = f64[0]; // m は [1, 2)
    if (m > 1.4142135623730951) { m *= 0.5; k++; }
    const f = m - 1, s = f / (2 + f), z = s * s, w = z * z;
    const R = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7))) + w * (LG2 + w * (LG4 + w * LG6));
    const hfsq = 0.5 * f * f;
    return k * LN2HI - ((hfsq - (s * (hfsq + R) + k * LN2LO)) - f);
  };
  const ipow = (x, n) => { let r = 1, b = x; while (n > 0) { if (n & 1) r *= b; n >>>= 1; if (n) b *= b; } return r; };
  const pow = (x, y) => {
    if (y === 0) return 1;
    if (x !== x || y !== y) return NaN;
    if (!isFinite(x) || !isFinite(y)) return N.pow(x, y);
    if (y === 1) return x;
    if (y === 2) return x * x;
    if (y === 0.5 && x > 0) return sqrt(x);
    if (Math.floor(y) === y && Math.abs(y) <= 2147483647) return y > 0 ? ipow(x, y) : 1 / ipow(x, -y);
    if (x < 0) return NaN;
    if (x === 0) return y > 0 ? 0 : Infinity;
    return exp(y * log(x));
  };

  const DET = { sin, cos, tan, atan, atan2, asin, hypot, pow, exp, log };
  if (typeof window !== 'undefined') { window.DETMATH = DET; window.NATIVEMATH = N; if (window.__detMathInstall !== false) Object.assign(Math, DET); }
})();
