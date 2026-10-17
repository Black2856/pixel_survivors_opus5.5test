// i18n-check.js — 辞書(js/lang/en.js・zh.js・ko.js)の抜け・余り・差し込みの食い違いを調べる
// 使い方: node scripts/i18n-check.js
//   訳がない: 表示する日本語(_t('…') / _t`…` / data.js の文字列 / index.html の文字)のうち、辞書にないもの → 英語でも日本語のまま出る
//   差し込みが合わない: キーと英語で {0} {1} … {v} {p} {v1} の組が違うもの
//   使っていない: 辞書にあるが、どこにも出てこないキー(日本語の文を書き換えたときの古いキー)
//   包んでいない: コードの中の日本語の文字列で、_t を通していないもの(表示する文なら _t で包む。ID・比較・glyph はそのままでよい)
//   中国語・韓国語は、訳がない・差し込みが合わない・HTML のタグが合わない(キーと同じタグ・属性が同じ順に要る)・使っていない を辞書ごとに出す
// 訳がない・差し込みが合わない(中国語・韓国語は HTML のタグも)ものがあると終了コード 1
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const JP = /[぀-ヿ㐀-鿿！-｠　-〿]/;
// 調べるコード: index.html の <script> のうち、表示する文を持たないもの(辞書・描画・絵・音)を除いた全部(分けたファイルも入る)
const NO_TEXT = ['js/data.js', 'js/i18n.js', 'js/art.js', 'js/audio.js', 'js/gfx.js', 'js/motions.js', 'js/skillfx.js', 'js/render.js'];
const CODE = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]).filter(f => !f.startsWith('js/lang/') && !NO_TEXT.includes(f));

// ---------- 字句解析(文字列・テンプレートを、引用符を含む位置で取り出す)----------
function lex(src) {
  const out = [];
  let i = 0, line = 1, prev = '';
  const n = src.length;
  const regexOk = () => prev === '' || /^[(,=:\[!&|?{};+\-*%<>~^]$/.test(prev) || /^(return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/.test(prev);
  function str(q) {
    const s = i, l0 = line; i++;
    while (i < n && src[i] !== q) { if (src[i] === '\\') i++; else if (src[i] === '\n') line++; i++; }
    i++;
    out.push({ kind: 'str', s, e: i, q, parts: [src.slice(s + 1, i - 1)], line: l0 });
  }
  function tpl() {
    const rec = { kind: 'tpl', s: i, e: 0, q: '`', parts: [], line };
    out.push(rec);
    i++;
    let ps = i;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { rec.parts.push(src.slice(ps, i)); i++; rec.e = i; return; }
      if (c === '$' && src[i + 1] === '{') { rec.parts.push(src.slice(ps, i)); i += 2; prev = '{'; code(1); ps = i; continue; }
      if (c === '\n') line++;
      i++;
    }
  }
  function code(depth) {
    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
      if (c === '\'' || c === '"') { str(c); prev = 'str'; continue; }
      if (c === '`') { tpl(); prev = 'str'; continue; }
      if (c === '/' && regexOk()) {
        i++; let cls = false;
        while (i < n) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; else if (d === '\n') break; i++; }
        i++; while (i < n && /[a-z]/i.test(src[i])) i++;
        prev = 're'; continue;
      }
      if (/[A-Za-z_$0-9\u0080-￿]/.test(c)) { const s = i; while (i < n && /[A-Za-z_$0-9\u0080-￿.]/.test(src[i]) && !(src[i] === '.' && src[i + 1] === '.')) i++; prev = src.slice(s, i); if (/^\d/.test(prev)) prev = 'num'; continue; }
      if (c === '{') { if (depth) depth++; prev = '{'; i++; continue; }
      if (c === '}') { if (depth) { depth--; if (!depth) { i++; prev = '}'; return; } } prev = '}'; i++; continue; }
      if (c === ')' || c === ']') { prev = 'close'; i++; continue; }
      prev = c; i++;
    }
  }
  code(0);
  return out;
}
const cook = (raw, q) => (q === '`' ? new Function('return `' + raw + '`')() : new Function('return ' + q + raw + q)());
const keyOf = t => (t.kind === 'str' ? cook(t.parts[0], t.q) : t.parts.map(p => cook(p, '`')).reduce((a, p, k) => a + '{' + (k - 1) + '}' + p));

// ---------- 辞書 ----------
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/lang/en.js'), 'utf8') + '\nthis.EN = I18N_EN;', ctx);
const EN = ctx.EN;
const OTHER = [['zh', '中国語', 'I18N_ZH'], ['ko', '韓国語', 'I18N_KO']].filter(([l]) => fs.existsSync(path.join(root, `js/lang/${l}.js`))).map(([l, name, v]) => {
  const c = {};
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root, `js/lang/${l}.js`), 'utf8') + `;this.D = ${v};`, c);
  return { l, name, D: c.D };
});

// ---------- 訳すもの ----------
const need = new Map(); // キー → 出てくる場所
const add = (k, at) => { if (!need.has(k)) need.set(k, []); need.get(k).push(at); };
const literals = new Set(); // コードに出てくる日本語の文字列(包んでいないものも。ID として _t(変数) で引くキーを「使っている」と見なすため)
const unwrapped = [];
for (const f of CODE) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const termLists = [...src.matchAll(/\bm: \[[^\]]*\]/g)].map(m => [m.index, m.index + m[0].length]); // ガイドの用語の日本語の書き方(英語は I18N_EN_TERMS)
  for (const t of lex(src)) {
    if (!t.parts.some(p => JP.test(p))) continue;
    const k = keyOf(t);
    literals.add(k);
    const wrapped = t.kind === 'str' ? src.slice(t.s - 3, t.s) === '_t(' : src.slice(t.s - 2, t.s) === '_t';
    if (wrapped) add(k, `${f}:${t.line}`);
    else if (!/glyph: $/.test(src.slice(t.s - 7, t.s)) && !k.startsWith('(?') && !termLists.some(([a, b]) => t.s > a && t.s < b) && !(k in EN)) unwrapped.push(`${f}:${t.line}  ${JSON.stringify(k).slice(0, 80)}`);
  }
}
// data.js: 文字列の全部(強化ツリーの glyph は i18n.js が I18N_EN_TREE_GLYPH で置き換えるので除く)
const dctx = {};
vm.createContext(dctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8') + '\nthis.DATA = DATA;', dctx);
(function walk(o, p) {
  for (const k of Object.keys(o)) {
    const v = o[k], q = p ? p + '.' + k : k;
    if (k === 'glyph' && p === 'tree') continue;
    if (typeof v === 'string') { if (JP.test(v)) add(v, 'data.js ' + q); }
    else if (v && typeof v === 'object') walk(v, q);
  }
})(dctx.DATA, '');
// index.html(translate="no" の行は除く)
fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').split('\n').forEach((ln, i) => {
  if (/translate="no"/.test(ln)) return;
  for (const m of ln.matchAll(/>([^<>]+)</g)) { const s = m[1].trim(); if (s && JP.test(s)) add(s, 'index.html:' + (i + 1)); }
  for (const m of ln.matchAll(/(?:title|placeholder)="([^"]*)"/g)) if (JP.test(m[1])) add(m[1], 'index.html:' + (i + 1));
});

// ---------- 結果 ----------
const ph = s => [...new Set([...s.matchAll(/\{(\d+|v1?|p)(?:\|[^}]*)?\}/g)].map(m => m[1]))].sort().join(','); // {p} {v} {v1}: 強化の説明の値(pathDesc)
const missing = [...need].filter(([k]) => !(k in EN));
const mismatch = [...need].filter(([k]) => k in EN && ph(k) !== ph(EN[k]));
const unused = Object.keys(EN).filter(k => !need.has(k) && !literals.has(k));
const show = (title, list) => { console.log(`■ ${title}: ${list.length}`); for (const s of list.slice(0, 200)) console.log('  ' + s); };
show('訳がない', missing.map(([k, at]) => `${JSON.stringify(k)}  (${at[0]})`));
show('差し込みが合わない', mismatch.map(([k]) => `${JSON.stringify(k)} → ${JSON.stringify(EN[k])}`));
show('使っていない', unused.map(k => JSON.stringify(k)));
show('包んでいない(表示する文なら _t で包む)', unwrapped);
console.log(`辞書 ${Object.keys(EN).length} 件 / 訳すもの ${need.size} 件`);
let bad = missing.length + mismatch.length;
const tags = s => [...String(s).matchAll(/<[^>]*>/g)].map(m => m[0]).join('');
for (const { name, D } of OTHER) {
  console.log(`---------- ${name} ----------`);
  const miss = [...need].filter(([k]) => !(k in D)), mis = [...need].filter(([k]) => k in D && ph(k) !== ph(D[k])), tg = [...need].filter(([k]) => k in D && tags(k) !== tags(D[k]));
  show('訳がない', miss.map(([k, at]) => `${JSON.stringify(k)}  (${at[0]})`).slice(0, 30));
  show('差し込みが合わない', mis.map(([k]) => `${JSON.stringify(k)} → ${JSON.stringify(D[k])}`));
  show('HTML のタグが合わない', tg.map(([k]) => `${JSON.stringify(k)} → ${JSON.stringify(D[k])}`));
  show('使っていない', Object.keys(D).filter(k => !need.has(k) && !literals.has(k)).map(k => JSON.stringify(k)));
  console.log(`辞書 ${Object.keys(D).length} 件 / 訳がない ${miss.length} 件`);
  bad += miss.length + mis.length + tg.length;
}
process.exitCode = bad ? 1 : 0;
