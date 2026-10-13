// i18n.js — 表示の言語(日本語 / English / 简体中文 / 한국어)
// 文章は日本語のまま書き、表示する所で _t を通すと、ほかの言語のときは辞書の文になる(キーは日本語の文)
//   辞書: js/lang/en.js の I18N_EN / zh.js の I18N_ZH(簡体字)/ ko.js の I18N_KO。用語の印・アイコンの文字・強化ツリーの文字の表も言語ごと(I18N_EN_TERMS など。無ければ既定の作り方)
//   _t('文')        : 文字列 / _t`文 ${x} 文` : テンプレート(キーは ${} を {0} {1} … にした文。訳の側で順番を入れ替えてよい)
//   英語の {0|a|b}  : {0} の値が 1 なら a、それ以外なら b(数そのものは出さない。複数形用)
//   辞書にない文: 中国語・韓国語は英語の辞書で探し、それも無ければ日本語のまま。英語は日本語のまま(node scripts/i18n-check.js で抜けを調べる)
// DATA(data.js)の文字列は、読み込んだ直後にまとめて置き換える(data.js は日本語のまま)。index.html の文字も同じ
// 言語は設定(ps55_set の lang)。未設定なら、英語版より前からのセーブがある人は日本語のまま、初めての人はブラウザの言語(日本語・中国語・韓国語ならその言語、ほかは英語)
// 決めた言語はすぐ設定に保存する(2回目からセーブがあっても変わらないように)。切り替えはページを読み直す
// フォント: 中国語・韓国語は、漢字・ハングル・全角の範囲だけ Fusion Pixel 12px(SIL OFL。jsDelivr の fontsource)を DotGothic16 / Press Start 2P と同じ名前で足す
//   あとに書いた @font-face が先に使われるので、その範囲の文字だけ Fusion Pixel になり、英字・数字・かなは今のフォントのまま(日本語・英語では足さない)
'use strict';

const LANGS = { ja: '日本語', en: 'English', zh: '简体中文', ko: '한국어' }; // 設定のプルダウンの並びと名前(それぞれの言語で書く)
const LANG = (() => {
  let s = {}, lang = null;
  try { s = JSON.parse(localStorage.getItem('ps55_set') || '{}') || {}; } catch (e) { s = {}; }
  if (LANGS[s.lang]) return s.lang;
  try { if (localStorage.getItem('ps55_meta')) lang = 'ja'; } catch (e) { /* 既定へ */ } // 前から遊んでいる人の表示は変えない
  if (!lang) { const l = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja'; lang = /^ja\b/i.test(l) ? 'ja' : /^zh\b/i.test(l) ? 'zh' : /^ko\b/i.test(l) ? 'ko' : 'en'; } // 中国語は繁体字の人も簡体字
  try { s.lang = lang; localStorage.setItem('ps55_set', JSON.stringify(s)); } catch (e) { /* 保存不可でも続行 */ }
  return lang;
})();

const I18N = (() => {
  const opt = f => { try { return f(); } catch (e) { return undefined; } }; // 読み込んでいない表は undefined
  const EN = opt(() => I18N_EN) || {};
  const DICTS = { ja: [], en: [EN], zh: [opt(() => I18N_ZH) || {}, EN], ko: [opt(() => I18N_KO) || {}, EN] }[LANG]; // 探す順
  const TB = { // 用語の印(help.js)/ アイコンの文字の個別の指定 / 強化ツリーの文字
    en: { terms: opt(() => I18N_EN_TERMS), glyph: opt(() => I18N_EN_GLYPH), tree: opt(() => I18N_EN_TREE_GLYPH) },
    zh: { terms: opt(() => I18N_ZH_TERMS), glyph: opt(() => I18N_ZH_GLYPH), tree: opt(() => I18N_ZH_TREE_GLYPH) || opt(() => I18N_EN_TREE_GLYPH) },
    ko: { terms: opt(() => I18N_KO_TERMS), glyph: opt(() => I18N_KO_GLYPH), tree: opt(() => I18N_KO_TREE_GLYPH) || opt(() => I18N_EN_TREE_GLYPH) },
  }[LANG] || {};
  const JP = /[぀-ヿ㐀-鿿！-｠　-〿]/;
  const tr = LANG !== 'ja', en = LANG === 'en'; // tr: 訳す / en: 英語だけの決まり(頭文字・単語の区切り・複数形)
  const missing = new Set(); // 辞書になかった文(確認用: I18N.missing)
  const fallback = new Set(); // 中国語・韓国語の辞書になく、英語で出した文(確認用: I18N.fallback)
  const look = s => {
    for (const d of DICTS) { const r = d[s]; if (r !== undefined) { if (d !== DICTS[0]) fallback.add(s); return r; } }
    if (JP.test(s)) missing.add(s);
    return undefined;
  };
  const fill = (s, v) => s.replace(/\{(\d+)(?:\|([^|}]*)\|([^}]*))?\}/g, (m, i, one, many) => (one === undefined ? String(v[i]) : +v[i] === 1 ? one : many));
  const tpl = new WeakMap(); // テンプレートの呼び出し場所ごとに、訳した文を覚えておく
  const join = (s, v) => { let r = s[0]; for (let i = 0; i < v.length; i++) r += String(v[i]) + s[i + 1]; return r; };
  function t(s, ...v) {
    if (typeof s === 'string') return tr ? (look(s) ?? s) : s;
    if (!Array.isArray(s)) return s;
    if (!tr) return join(s, v);
    let e = tpl.get(s);
    if (e === undefined) { e = look(s.reduce((a, p, i) => a + '{' + (i - 1) + '}' + p)) ?? null; tpl.set(s, e); }
    return e === null ? join(s, v) : fill(e, v);
  }
  // オブジェクトの中の文字列をまとめて置き換える(DATA 用)。glyph(強化ツリーの1文字)は辞書を使わず、言語の表(TB.tree)で置き換える
  function deep(o, seen = new Set()) {
    if (!tr || !o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string') { if (JP.test(v)) { const r = look(v); if (r !== undefined) o[k] = r; } }
      else if (k === 'glyph' && v && typeof v === 'object') { if (TB.tree) Object.assign(v, TB.tree); }
      else if (v && typeof v === 'object') deep(v, seen);
    }
  }
  // HTML に直接書いた文字(ボタン・見出し・title・placeholder)。translate="no" の中はそのまま
  function dom(root) {
    if (!tr) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && n.parentElement.closest('[translate="no"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      const s = n.nodeValue, k = s.trim();
      if (k && JP.test(k)) { const r = look(k); if (r !== undefined) n.nodeValue = s.replace(k, r); }
    }
    for (const el of root.querySelectorAll('[title], [placeholder]')) for (const a of ['title', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v && JP.test(v)) { const r = look(v); if (r !== undefined) el.setAttribute(a, r); }
    }
  }
  // 状態の札・スキルのアイコンの文字(日本語は漢字1文字)。表(TB.glyph)で個別に決められる
  //   英語: 名前の頭文字(2語なら頭文字2つ、1語なら2文字)/ 中国語・韓国語: 名前の1文字目
  function glyph(g, name) {
    if (!tr) return g;
    const nm = String(name || '');
    if (TB.glyph && TB.glyph[nm]) return TB.glyph[nm];
    if (!en) { const c = nm.replace(/^[^\p{L}]+/u, '')[0]; return c || g; }
    const w = nm.replace(/\(.*?\)|\d+/g, ' ').split(/[\s:·/–-]+/).filter(x => /^[A-Za-z]/.test(x) && !/^(of|the|a|an|and)$/i.test(x));
    if (!w.length) return g;
    return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : w[0][0].toUpperCase() + (w[0][1] || '').toLowerCase();
  }
  // ボスの短い名前(激昂の帯・ステージ選択)。名前は「腐肉の王 ROT KING」の形(訳も後ろに英語の大文字を残す)
  //   英語: ROT KING → Rot King / ほか: 後ろの英語の大文字を外した前半(韓国語は名前に空白があるので、空白では切らない)
  const bossShort = name => {
    const s = String(name);
    if (en) return s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
    return s.replace(/\s+[A-Z0-9][A-Z0-9 '&.-]*$/, '') || s;
  };
  return { lang: LANG, langs: LANGS, tr, en, t, deep, dom, glyph, bossShort, missing, fallback, terms: TB.terms || {} };
})();
const _t = I18N.t;

// 中国語・韓国語のフォント(上の説明)
if (LANG === 'zh' || LANG === 'ko') {
  const f = LANG === 'zh' ? 'sc' : 'kr', url = `https://cdn.jsdelivr.net/npm/@fontsource/fusion-pixel-12px-proportional-${f}@5.3.0/files/fusion-pixel-12px-proportional-${f}-latin-400-normal.woff2`;
  const R = 'U+1100-11FF, U+2E80-2FDF, U+3000-303F, U+3130-318F, U+3400-4DBF, U+4E00-9FFF, U+A960-A97F, U+AC00-D7AF, U+D7B0-D7FF, U+F900-FAFF, U+FE30-FE4F, U+FF00-FFEF';
  const st = document.createElement('style');
  st.textContent = ['DotGothic16', 'Press Start 2P'].map(n => `@font-face { font-family: '${n}'; font-style: normal; font-weight: 400; font-display: swap; src: url(${url}) format('woff2'); unicode-range: ${R}; }`).join('\n');
  document.head.appendChild(st);
}

// 読み込んだデータと HTML を置き換える(日本語のときはそのまま)
I18N.deep(DATA);
if (I18N.tr) { I18N.dom(document.body); document.documentElement.lang = LANG; }
