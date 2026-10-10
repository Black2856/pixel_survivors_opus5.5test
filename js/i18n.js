// i18n.js — 表示の言語(日本語 / English)
// 文章は日本語のまま書き、表示する所で _t を通すと、英語のときは辞書(js/lang/en.js の I18N_EN。キーは日本語の文)の英語になる
//   _t('文')        : 文字列 / _t`文 ${x} 文` : テンプレート(キーは ${} を {0} {1} … にした文。英語の側で順番を入れ替えてよい)
//   英語の {0|a|b}  : {0} の値が 1 なら a、それ以外なら b(数そのものは出さない。複数形用)
//   辞書にない文は日本語のまま出る(node scripts/i18n-check.js で抜けを調べる)
// DATA(data.js)の文字列は、読み込んだ直後にまとめて英語に置き換える(data.js は日本語のまま)。index.html の文字も同じ
// 言語は設定(ps55_set の lang)。未設定なら、英語版より前からのセーブがある人は日本語のまま、初めての人はブラウザの言語(日本語なら日本語、ほかは英語)
// 決めた言語はすぐ設定に保存する(2回目からセーブがあっても変わらないように)。切り替えはページを読み直す
'use strict';

const LANG = (() => {
  let s = {}, lang = null;
  try { s = JSON.parse(localStorage.getItem('ps55_set') || '{}') || {}; } catch (e) { s = {}; }
  if (s.lang === 'ja' || s.lang === 'en') return s.lang;
  try { if (localStorage.getItem('ps55_meta')) lang = 'ja'; } catch (e) { /* 既定へ */ } // 前から遊んでいる人の表示は変えない
  if (!lang) { const l = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja'; lang = /^ja\b/i.test(l) ? 'ja' : 'en'; }
  try { s.lang = lang; localStorage.setItem('ps55_set', JSON.stringify(s)); } catch (e) { /* 保存不可でも続行 */ }
  return lang;
})();

const I18N = (() => {
  const EN = typeof I18N_EN !== 'undefined' ? I18N_EN : {};
  const JP = /[぀-ヿ㐀-鿿！-｠　-〿]/;
  const en = LANG === 'en';
  const missing = new Set(); // 辞書になかった文(確認用: I18N.missing)
  const look = s => { const r = EN[s]; if (r === undefined && JP.test(s)) missing.add(s); return r; };
  const fill = (s, v) => s.replace(/\{(\d+)(?:\|([^|}]*)\|([^}]*))?\}/g, (m, i, one, many) => (one === undefined ? String(v[i]) : +v[i] === 1 ? one : many));
  const tpl = new WeakMap(); // テンプレートの呼び出し場所ごとに、英語の文を覚えておく
  const join = (s, v) => { let r = s[0]; for (let i = 0; i < v.length; i++) r += String(v[i]) + s[i + 1]; return r; };
  function t(s, ...v) {
    if (typeof s === 'string') return en ? (look(s) ?? s) : s;
    if (!Array.isArray(s)) return s;
    if (!en) return join(s, v);
    let e = tpl.get(s);
    if (e === undefined) { e = look(s.reduce((a, p, i) => a + '{' + (i - 1) + '}' + p)) ?? null; tpl.set(s, e); }
    return e === null ? join(s, v) : fill(e, v);
  }
  // オブジェクトの中の文字列をまとめて置き換える(DATA 用)。glyph(強化ツリーの1文字)は辞書を使わず I18N_EN_TREE_GLYPH で置き換える
  function deep(o, seen = new Set()) {
    if (!en || !o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string') { if (JP.test(v)) { const r = look(v); if (r !== undefined) o[k] = r; } }
      else if (k === 'glyph' && v && typeof v === 'object') { if (typeof I18N_EN_TREE_GLYPH !== 'undefined') Object.assign(v, I18N_EN_TREE_GLYPH); }
      else if (v && typeof v === 'object') deep(v, seen);
    }
  }
  // HTML に直接書いた文字(ボタン・見出し・title・placeholder)。translate="no" の中はそのまま
  function dom(root) {
    if (!en) return;
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
  // 状態の札・スキルのアイコンの1文字(漢字)。英語では名前の頭文字(2語なら頭文字2つ、1語なら2文字)。I18N_EN_GLYPH で個別に決められる
  const GL = typeof I18N_EN_GLYPH !== 'undefined' ? I18N_EN_GLYPH : {};
  function glyph(g, name) {
    if (!en) return g;
    const nm = String(name || '');
    if (GL[nm]) return GL[nm];
    const w = nm.replace(/\(.*?\)|\d+/g, ' ').split(/[\s:·/–-]+/).filter(x => /^[A-Za-z]/.test(x) && !/^(of|the|a|an|and)$/i.test(x));
    if (!w.length) return g;
    return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : w[0][0].toUpperCase() + (w[0][1] || '').toLowerCase();
  }
  // ボスの短い名前(激昂の帯・ステージ選択)。日本語は「腐肉の王 ROT KING」の前半、英語は ROT KING → Rot King
  const bossShort = name => (en ? String(name).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : String(name).split(' ')[0]);
  return { lang: LANG, en, t, deep, dom, glyph, bossShort, missing, terms: typeof I18N_EN_TERMS !== 'undefined' ? I18N_EN_TERMS : {} };
})();
const _t = I18N.t;

// 読み込んだデータと HTML を置き換える(英語のときだけ)
I18N.deep(DATA);
if (I18N.en) { I18N.dom(document.body); document.documentElement.lang = 'en'; }
