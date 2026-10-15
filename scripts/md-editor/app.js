// app.js — 仕様書エディタの画面と操作(index.html から md.js の後に読む)
//   フォルダ: File System Access API(Chrome / Edge)。前回のフォルダ・基準・履歴はブラウザの IndexedDB、表示の好み・たたんだ節は localStorage
'use strict';
const $ = id => document.getElementById(id);
const esc = MD.esc;
const SKIP = new Set(['.git', 'node_modules', 'dist', '.playwright-mcp']);
const S = { root: null, files: [], cache: new Map(), counts: new Map(), threads: [], cur: null, view: 'split', undo: [], drawer: null, histSel: null, histMode: 'prev', tab: 'files', editing: false, toolEl: null, pvPending: false };
// cur: { path, handle, eol: '\r\n' | '\n', bom, saved(\n に直した保存済みの中身), mod(ディスクの lastModified), outside(外の変更を知らせ中) }
const now = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const fkey = path => (S.root ? S.root.name : '') + '/' + path; // 基準・履歴・たたんだ節のキー
const loc = path => (S.root ? S.root.name + '/' : '') + path; // LLM に渡す場所
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 覚えなくても動く */ } },
};
let msgT = 0;
function msg(text, kind = '') { const m = $('msg'); m.textContent = text; m.className = kind; clearTimeout(msgT); if (text) msgT = setTimeout(() => { m.textContent = ''; }, 6000); }
async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); msg(done, 'ok'); }
  catch (e) { prompt('コピーできなかったので、ここから選んでコピーしてください', text); }
}
const ed = () => $('ed');
const isDirty = () => !!S.cur && ed().value !== S.cur.saved;
function setDirtyUI() {
  const d = isDirty();
  $('dirty').textContent = d ? '● 未保存' : '';
  document.title = (d ? '● ' : '') + (S.cur ? S.cur.path.split('/').pop() + ' — ' : '') + '仕様書エディタ';
  for (const el of document.querySelectorAll('#tree .f')) el.classList.toggle('dirty', d && !!S.cur && el.dataset.path === S.cur.path);
  $('undoBtn').hidden = !S.undo.length;
}

// ---------- IndexedDB(kv: 前回のフォルダ / base: 変更の基準 / hist: 版)----------
const DB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const o = indexedDB.open('md-editor', 2);
    o.onupgradeneeded = () => {
      const d = o.result;
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('base')) d.createObjectStore('base');
      if (!d.objectStoreNames.contains('hist')) d.createObjectStore('hist', { autoIncrement: true }).createIndex('key', 'key');
    };
    o.onsuccess = () => res(o.result);
    o.onerror = () => rej(o.error);
  }));
  const req = (store, mode, f) => open().then(d => new Promise((res, rej) => { const tx = d.transaction(store, mode), r = f(tx.objectStore(store)); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); }));
  return {
    get: (s, k) => req(s, 'readonly', o => o.get(k)),
    put: (s, k, v) => req(s, 'readwrite', o => o.put(v, k)),
    keys: s => req(s, 'readonly', o => o.getAllKeys()),
    addHist: v => req('hist', 'readwrite', o => o.add(v)),
    delHist: id => req('hist', 'readwrite', o => o.delete(id)),
    hist: key => open().then(d => new Promise((res, rej) => {
      const out = [], tx = d.transaction('hist'), c = tx.objectStore('hist').index('key').openCursor(IDBKeyRange.only(key));
      c.onsuccess = () => { const r = c.result; if (r) { out.push(Object.assign({ id: r.primaryKey }, r.value)); r.continue(); } };
      tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error);
    })),
  };
})();
const getBase = path => DB.get('base', fkey(path)).catch(() => null);
const setBase = (path, text) => DB.put('base', fkey(path), { text, time: now() }).catch(() => {});
async function addHist(path, text, kind) { // 同じ中身が続くときは残さない。1ファイル 60版まで
  try {
    const key = fkey(path), list = await DB.hist(key), last = list[list.length - 1];
    if (last && last.text === text) return;
    await DB.addHist({ key, time: now(), kind, text });
    for (const x of list.slice(0, Math.max(0, list.length + 1 - 60))) await DB.delHist(x.id);
  } catch (e) { /* 履歴なしでも動く */ }
}

// ---------- フォルダ・一覧・中身 ----------
async function scan(dir, prefix, out) {
  const ents = [];
  for await (const [name, h] of dir.entries()) ents.push([name, h]);
  ents.sort((a, b) => (a[1].kind === b[1].kind ? a[0].localeCompare(b[0], 'ja') : a[1].kind === 'directory' ? 1 : -1));
  for (const [name, h] of ents) {
    if (h.kind === 'directory') { if (!SKIP.has(name) && !name.startsWith('.')) await scan(h, prefix + name + '/', out); }
    else if (/\.md$/i.test(name)) out.push({ path: prefix + name, handle: h });
  }
  return out;
}
async function readHandle(h) {
  const f = await h.getFile();
  let text = await f.text();
  const bom = text.charCodeAt(0) === 0xfeff;
  if (bom) text = text.slice(1);
  return { text: text.replace(/\r\n?/g, '\n'), eol: /\r\n/.test(text) ? '\r\n' : '\n', bom, mod: f.lastModified };
}
// 全ファイルの中身(変わった物だけ読み直す)。開いているファイルは編集欄の中身
async function allTexts() {
  const out = [];
  for (const f of S.files) {
    if (S.cur && S.cur.path === f.path) { out.push({ path: f.path, text: ed().value }); continue; }
    try {
      const file = await f.handle.getFile(), c = S.cache.get(f.path);
      if (c && c.mod === file.lastModified) { out.push({ path: f.path, text: c.text }); continue; }
      const text = (await file.text()).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
      S.cache.set(f.path, { mod: file.lastModified, text });
      out.push({ path: f.path, text });
    } catch (e) { /* 読めないファイルは飛ばす */ }
  }
  return out;
}
function renderTree() {
  if (!S.root) return;
  const q = $('filter').value.trim().toLowerCase(), t = $('tree');
  const fs = S.files.filter(f => !q || f.path.toLowerCase().includes(q));
  if (!fs.length) { t.innerHTML = `<div class="empty">${S.files.length ? '当てはまるファイルがない' : 'このフォルダには md がない'}</div>`; return; }
  let h = '', lastDir = null;
  for (const f of fs) {
    const k = f.path.lastIndexOf('/'), dir = k < 0 ? '' : f.path.slice(0, k), name = f.path.slice(k + 1), n = S.counts.get(f.path) || 0;
    if (dir !== lastDir) { if (dir) h += `<div class="dir">${esc(dir)}/</div>`; lastDir = dir; }
    h += `<div class="f${S.cur && S.cur.path === f.path ? ' on' : ''}" data-path="${esc(f.path)}" title="${esc(f.path)}"><span class="dot"></span><span class="nm">${esc(name)}</span>${n ? `<span class="cnt" title="未解決のコメント">💬${n}</span>` : ''}</div>`;
  }
  t.innerHTML = h;
  setDirtyUI();
}
async function useDir(root) {
  S.root = root; S.files = []; S.cur = null; S.cache.clear(); S.counts.clear(); S.threads = []; S.undo = [];
  $('rootName').textContent = '📁 ' + root.name;
  $('main').hidden = true; $('start').hidden = false; closeDrawer();
  $('tree').innerHTML = '<div class="empty">読み込み中…</div>';
  S.files = await scan(root, '', []);
  $('rescanBtn').disabled = false;
  renderTree();
  msg(S.files.length + ' 個の md');
  refreshThreads();
}
async function rescan() {
  if (!S.root) return;
  S.files = await scan(S.root, '', []);
  if (S.cur && !S.files.some(f => f.path === S.cur.path)) msg('開いているファイルがフォルダから消えています(保存すると作り直します)', 'warn');
  renderTree(); refreshThreads();
}

// ---------- 開く・保存・読み直す ----------
async function openFile(path, line) {
  if (!(S.cur && S.cur.path === path)) {
    if (isDirty() && !confirm(S.cur.path + ' は保存していません。変更を捨てて開きますか?')) return false;
    const f = S.files.find(x => x.path === path);
    if (!f) return false;
    const r = await readHandle(f.handle);
    S.cur = { path, handle: f.handle, eol: r.eol, bom: r.bom, saved: r.text, mod: r.mod, outside: false };
    S.cache.set(path, { mod: r.mod, text: r.text });
    S.undo = []; S.histSel = null;
    ed().value = r.text; ed().scrollTop = 0; ed().setSelectionRange(0, 0);
    $('path').textContent = path; $('path').title = loc(path) + '(' + (r.eol === '\r\n' ? 'CRLF' : 'LF') + (r.bom ? ' / BOM あり' : '') + ')';
    $('main').hidden = false; $('start').hidden = true;
    hideBanner(); renderTree(); renderPreview(true, true);
    if (!(await getBase(path))) await setBase(path, r.text);
    await addHist(path, r.text, '開いた時');
    refreshDrawer();
  }
  if (line != null) gotoLine(line);
  return true;
}
async function save(quiet) {
  if (!S.cur) return false;
  const c = S.cur, text = ed().value;
  if (c.outside && !confirm('このファイルはほかのソフト(LLM など)でも書き換えられています。上書きしますか?')) return false;
  try {
    const w = await c.handle.createWritable();
    await w.write((c.bom ? '﻿' : '') + text.replace(/\n/g, c.eol));
    await w.close();
  } catch (e) { msg('保存できませんでした: ' + e.message, 'warn'); return false; }
  c.saved = text; c.outside = false;
  c.mod = (await c.handle.getFile()).lastModified;
  S.cache.set(c.path, { mod: c.mod, text });
  await addHist(c.path, text, '保存');
  hideBanner(); setDirtyUI(); refreshThreads(); refreshDrawer();
  if (!quiet) msg('保存しました ' + new Date().toLocaleTimeString(), 'ok');
  return true;
}
async function reloadNow(kind) {
  const c = S.cur, r = await readHandle(c.handle), e = ed(), top = e.scrollTop, pos = e.selectionStart;
  Object.assign(c, { eol: r.eol, bom: r.bom, saved: r.text, mod: r.mod, outside: false });
  S.cache.set(c.path, { mod: r.mod, text: r.text });
  e.value = r.text; e.scrollTop = top; e.setSelectionRange(Math.min(pos, r.text.length), Math.min(pos, r.text.length));
  S.undo = [];
  hideBanner(); setDirtyUI(); renderPreview(true);
  if (kind) await addHist(c.path, r.text, kind);
  refreshThreads(); refreshDrawer();
}
async function reload() {
  if (!S.cur) return;
  if (isDirty() && !confirm('未保存の変更を捨てて、ディスクの内容で読み直しますか?')) return;
  await reloadNow();
}

// ---------- 外での書き換えに気づく(2秒ごとに lastModified を見る)----------
function showBanner(t) { $('bannerText').textContent = t; $('banner').classList.add('on'); }
function hideBanner() { $('banner').classList.remove('on'); }
async function watch() {
  const c = S.cur;
  if (!c || document.hidden || S.editing) return;
  let f;
  try { f = await c.handle.getFile(); } catch (e) { return; }
  if (S.cur !== c || f.lastModified === c.mod) return;
  const text = (await f.text()).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  c.mod = f.lastModified;
  if (text === c.saved) return; // 中身は同じ(保存し直しただけ)
  if (!isDirty()) { await reloadNow('外部の変更'); msg('ほかのソフトで書き換わったので読み直しました ' + new Date().toLocaleTimeString(), 'warn'); return; }
  c.outside = true;
  showBanner('このファイルはほかのソフト(LLM など)でも書き換えられました。あなたの未保存の変更と食い違っています。');
}

// ---------- プレビュー ----------
const foldKey = () => 'mde-fold:' + fkey(S.cur.path);
let pvT = 0;
const editingInPv = () => { const a = document.activeElement; return !!a && $('pv').contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName); };
function renderPreview(now, resetScroll) {
  clearTimeout(pvT);
  const f = () => {
    if (!S.cur) return;
    if (S.editing || editingInPv()) { S.pvPending = true; return; } // 書きかけ(マス・返信)を消さない。終わったら描き直す
    S.pvPending = false;
    const pv = $('pv'), top = pv.scrollTop;
    pv.innerHTML = MD.render(MD.parse(ed().value), new Set(ls.get(foldKey(), []))) +
      '<div id="tool"><button data-a="cm" title="ここにコメントを書く">💬</button><button data-a="cp" title="この場所と中身をコピー(LLM に渡す)">📋</button><button data-a="ed" title="ここを元の書き方で直す">✎</button></div>';
    pv.scrollTop = resetScroll ? 0 : top;
    S.toolEl = null;
    markCursor(false);
  };
  if (now) f(); else pvT = setTimeout(f, 150);
}
$('pv').addEventListener('focusout', () => setTimeout(() => { if (S.pvPending && !S.editing && !editingInPv()) renderPreview(true); }, 0));
function setSource(text) { // プレビューからの書き換え(Ctrl+Z / ↶ で 1つずつ戻せる)
  const e = ed();
  if (text === e.value) { renderPreview(true); return; }
  S.undo.push(e.value);
  if (S.undo.length > 100) S.undo.shift();
  e.value = text;
  onEdited(true);
}
function undoPv() { if (!S.undo.length) return; ed().value = S.undo.pop(); onEdited(true); msg('1つ戻しました'); }
let dT = 0;
function onEdited(now) { setDirtyUI(); renderPreview(now); if (S.drawer) { clearTimeout(dT); dT = setTimeout(refreshDrawer, 400); } }
const lineStart = (t, line) => { let p = 0; for (let i = 0; i < line; i++) { const k = t.indexOf('\n', p); if (k < 0) return t.length; p = k + 1; } return p; };
const edLine = () => ed().value.slice(0, ed().selectionStart).split('\n').length - 1;
// その行のブロック(表の行・いちばん狭い範囲のブロック)
function blockAt(line) {
  const pv = $('pv'), tr = pv.querySelector(`tr[data-line="${line}"]`);
  if (tr) return tr;
  let best = null, bl = 1e9;
  for (const el of pv.querySelectorAll('[data-l0]')) { const a = +el.dataset.l0, b = +el.dataset.l1; if (a <= line && line <= b && b - a < bl) { best = el; bl = b - a; } }
  return best;
}
function markCursor(scroll) {
  if (!S.cur || S.view === 'edit') return;
  const pv = $('pv');
  pv.querySelector('.cur-blk')?.classList.remove('cur-blk');
  const el = blockAt(edLine());
  if (!el) return;
  el.classList.add('cur-blk');
  if (scroll && S.view === 'split' && el.offsetParent) { const pr = pv.getBoundingClientRect(), r = el.getBoundingClientRect(); if (r.top < pr.top || r.bottom > pr.bottom) el.scrollIntoView({ block: 'center' }); }
}
// 編集欄をその行へ(折り返しがあるので、同じ幅の見えない div で上からの高さを測る)
function moveEditorTo(line) {
  const e = ed(), pos = lineStart(e.value, line);
  e.setSelectionRange(pos, pos);
  if (S.view !== 'view') {
    const m = $('mirror');
    m.style.width = e.clientWidth + 'px';
    m.textContent = e.value.slice(0, pos) + '​';
    e.scrollTop = Math.max(0, m.scrollHeight - e.clientHeight / 3);
  }
  markCursor(false);
}
function gotoLine(line) {
  moveEditorTo(line);
  const el = blockAt(line);
  if (!el) return;
  let opened = false;
  for (let x = el.parentElement; x; x = x.parentElement) if (x.classList && x.classList.contains('sec') && x.classList.contains('folded')) { x.classList.remove('folded'); opened = true; }
  if (opened) saveFolds();
  if (S.view !== 'edit') { el.scrollIntoView({ block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
}
// 節のたたみ(アコーディオン)
function saveFolds() { ls.set(foldKey(), [...$('pv').querySelectorAll('.sec.folded')].map(s => s.dataset.key)); }
function foldAll(on) {
  const secs = [...$('pv').querySelectorAll('.sec')];
  if (on) { // 見出しが 1つだけの一番上の段(題)は残し、その次の段をたたむ
    const lv = s => +s.firstElementChild.tagName.slice(1), lvs = [...new Set(secs.map(lv))].sort();
    const target = lvs[0] === 1 && lvs.length > 1 && secs.filter(s => lv(s) === 1).length === 1 ? lvs[1] : lvs[0];
    for (const s of secs) if (lv(s) === target) s.classList.add('folded');
  } else for (const s of secs) s.classList.remove('folded');
  saveFolds();
}

// ---------- プレビューで直す ----------
// 表のマス: クリックで元の書き方(**太字** など)のまま直す。Enter で確定 / Tab で次のマス / Esc でやめる
function editCell(td) {
  const tr = td.closest('tr[data-line]'), line = +tr.dataset.line, ci = +td.dataset.ci;
  const L = ed().value.split('\n'), sp = MD.cellSpans(L[line]), raw = sp[ci] ? L[line].slice(sp[ci].s, sp[ci].e) : '';
  S.editing = true; hideTool();
  td.innerHTML = '<input class="cell-in">';
  const inp = td.firstChild;
  inp.value = raw; inp.style.width = Math.max(80, td.clientWidth - 8) + 'px';
  inp.focus(); inp.select();
  let done = false;
  const finish = (commit, move) => {
    if (done) return;
    done = true; S.editing = false;
    inp.onblur = null; inp.blur(); // 入力欄にフォーカスが残ると、プレビューを描き直さない(書きかけを守る仕組み)
    if (commit && inp.value !== raw) setCell(line, ci, inp.value); else renderPreview(true);
    if (!move) return;
    const pv = $('pv'), cells = [...pv.querySelectorAll('tr[data-line] [data-ci]')], k = cells.findIndex(c => +c.closest('tr').dataset.line === line && +c.dataset.ci === ci), next = cells[k + move];
    if (next) editCell(next);
  };
  inp.onkeydown = ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    else if (ev.key === 'Tab') { ev.preventDefault(); finish(true, ev.shiftKey ? -1 : 1); }
  };
  inp.onblur = () => finish(true);
}
function setCell(line, ci, val) {
  const L = ed().value.split('\n'), v = val.replace(/\n/g, ' ').replace(/\\\|/g, '|').replace(/\|/g, '\\|'); // マスの中の | は \|
  let row = L[line];
  const sp = MD.cellSpans(row);
  if (ci < sp.length) row = row.slice(0, sp[ci].s) + v + row.slice(sp[ci].e);
  else { const cs = sp.map(c => row.slice(c.s, c.e)); while (cs.length < ci) cs.push(''); cs[ci] = v; row = '| ' + cs.join(' | ') + ' |'; }
  L[line] = row;
  setSource(L.join('\n'));
}
// ほかのブロック(段落・箇条書きの項目・見出し・引用・コード): ダブルクリックか ✎ で、その行を元の書き方で直す
function editBlock(el) {
  const l0 = +el.dataset.l0, l1 = +el.dataset.l1;
  if (isNaN(l0) || el.tagName === 'TR' || el.matches('table')) return;
  const raw = ed().value.split('\n').slice(l0, l1 + 1).join('\n');
  S.editing = true; hideTool();
  const box = document.createElement('div');
  box.innerHTML = '<textarea class="blk-ed"></textarea><div class="blk-hint">Ctrl+Enter で確定 / Esc でやめる(Markdown の書き方のまま直す)</div>';
  const ta = box.firstChild;
  ta.value = raw; ta.rows = Math.min(16, raw.split('\n').length + 1);
  el.style.display = 'none';
  el.parentNode.insertBefore(box, el);
  ta.focus();
  let done = false;
  const finish = commit => {
    if (done) return;
    done = true; S.editing = false;
    ta.onblur = null; ta.blur();
    if (commit && ta.value !== raw) { const L = ed().value.split('\n'); L.splice(l0, l1 - l0 + 1, ...ta.value.split('\n')); setSource(L.join('\n')); }
    else renderPreview(true);
  };
  ta.onkeydown = ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); finish(true); } else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); } };
  ta.onblur = () => finish(true);
}

// ---------- ブロックの上の道具(💬 / 📋 / ✎)----------
function hideTool() { const t = $('tool'); if (t) t.classList.remove('on'); S.toolEl = null; }
$('pv').addEventListener('mousemove', e => {
  const t = $('tool');
  if (!t || S.editing || t.contains(e.target)) return;
  const el = e.target.closest('tr[data-line], [data-blk]');
  if (!el || el.dataset.blk === 'thread' || el.closest('.thread, .composer') || el.dataset.blk === 'table') { if (!el || el.dataset.blk !== 'table') hideTool(); return; }
  if (S.toolEl === el) return;
  S.toolEl = el;
  const pv = $('pv'), pr = pv.getBoundingClientRect(), r = el.getBoundingClientRect();
  t.querySelector('[data-a="ed"]').hidden = el.tagName === 'TR';
  t.classList.add('on');
  t.style.top = Math.max(0, r.top - pr.top + pv.scrollTop - t.offsetHeight + 4) + 'px';
  t.style.left = Math.max(0, Math.min(pv.scrollLeft + pv.clientWidth - t.offsetWidth - 6, r.right - pr.left + pv.scrollLeft - t.offsetWidth)) + 'px';
});
$('pv').addEventListener('mouseleave', hideTool);
const excerpt = s => { s = s.replace(/\s+/g, ' ').trim(); return s.length > 26 ? s.slice(0, 26) + '…' : s; };
// コメントを入れる所: そのブロックの後(表の行なら表の後、箇条書きなら子の項目の後)と、題の案
function commentAt(el) {
  if (el.tagName === 'TR') {
    const cs = [...el.children].map(x => x.textContent.trim()).filter(Boolean);
    return { after: +el.closest('table').dataset.l1, title: excerpt(cs.slice(0, 2).join(' ')) + ' の行' };
  }
  let l1 = +el.dataset.l1;
  if (el.tagName === 'LI') for (const c of el.querySelectorAll('li[data-l1]')) l1 = Math.max(l1, +c.dataset.l1);
  return { after: l1, title: excerpt(el.querySelector('.ht') ? el.querySelector('.ht').textContent : el.firstChild ? el.firstChild.textContent || el.textContent : el.textContent) };
}
function locText(path, L, line, quote) {
  const hp = MD.headPath(L, line).join(' › ');
  return `${loc(path)} の「${hp || '先頭'}」(${line + 1} 行目)\n` + quote.map(x => '> ' + x).join('\n');
}
function copyBlock(el) {
  const L = ed().value.split('\n');
  if (el.tagName === 'TR') { const line = +el.dataset.line, hl = MD.tableHeadLine(L, line); return copy(locText(S.cur.path, L, line, hl >= 0 && hl !== line ? [L[hl], L[line]] : [L[line]]), '場所と中身をコピーしました'); }
  const l0 = +el.dataset.l0;
  copy(locText(S.cur.path, L, l0, L.slice(l0, +el.dataset.l1 + 1)), '場所と中身をコピーしました');
}

// ---------- コメント(スレッド)----------
const cleanMsg = s => s.replace(/\r/g, '').replace(/-->/g, '-- >');
const msgLines = t => cleanMsg(t).split('\n').map(l => (MD.MSG.test(l) ? ' ' + l : l)); // 本文の行が発言の頭と読まれないように
function newThread(el) {
  const { after, title } = commentAt(el);
  hideTool();
  $('pv').querySelector('.composer')?.remove();
  const box = document.createElement('div');
  box.className = 'composer';
  box.innerHTML = `<div class="dim">💬 新しいコメント(${after + 1} 行目の後に入れる)</div><input class="c-title" placeholder="題(どこについてか)"><textarea class="c-text" rows="3" placeholder="コメント(Ctrl+Enter で送る。送ると保存する)"></textarea><div class="row"><button class="c-cancel">やめる</button><button class="primary c-send">送る</button></div>`;
  box.querySelector('.c-title').value = title;
  (el.tagName === 'TR' ? el.closest('.tw') : el).after(box);
  const ta = box.querySelector('.c-text');
  ta.focus();
  const close = () => { box.remove(); if (S.pvPending) renderPreview(true); };
  const send = async () => {
    const t = ta.value.trim();
    if (!t) { ta.focus(); return; }
    const L = ed().value.split('\n'), head = cleanMsg(box.querySelector('.c-title').value.trim()).replace(/\n/g, ' ');
    L.splice(after + 1, 0, '<!-- 💬 ' + head, '@user ' + now(), ...msgLines(t), '-->');
    box.remove();
    setSource(L.join('\n'));
    if (await save(true)) msg('コメントを入れて保存しました', 'ok');
  };
  box.querySelector('.c-send').onclick = send;
  box.querySelector('.c-cancel').onclick = close;
  ta.onkeydown = ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); send(); } else if (ev.key === 'Escape') close(); };
}
async function replyThread(th) {
  const ta = th.querySelector('.th-reply textarea'), t = ta.value.trim();
  if (!t) return;
  const l0 = +th.dataset.l0, l1 = +th.dataset.l1, L = ed().value.split('\n'), add = ['@user ' + now(), ...msgLines(t)], end = L[l1];
  if (l1 === l0 || end.trim() !== '-->') { const before = end.slice(0, end.lastIndexOf('-->')).replace(/\s+$/, ''); L.splice(l1, 1, ...(before ? [before] : []), ...add, '-->'); }
  else L.splice(l1, 0, ...add);
  ta.value = ''; ta.blur();
  setSource(L.join('\n'));
  if (await save(true)) msg('返信を入れて保存しました', 'ok');
}
async function resolveThread(th) {
  const l0 = +th.dataset.l0, L = ed().value.split('\n');
  L[l0] = L[l0].replace(/💬(✅)?/, (m, d) => (d ? '💬' : '💬✅'));
  setSource(L.join('\n'));
  if (await save(true)) msg(L[l0].includes('💬✅') ? '解決にして保存しました' : '未解決に戻して保存しました', 'ok');
}
async function deleteThread(th) {
  if (!confirm('このやり取りを消しますか?')) return;
  const l0 = +th.dataset.l0, l1 = +th.dataset.l1, L = ed().value.split('\n');
  L.splice(l0, l1 - l0 + 1);
  setSource(L.join('\n'));
  if (await save(true)) msg('やり取りを消して保存しました', 'ok');
}
async function refreshThreads() {
  if (!S.root) return;
  const all = await allTexts(), list = [];
  S.counts = new Map();
  for (const { path, text } of all) {
    if (!text.includes('💬')) continue;
    const L = text.split('\n');
    for (const b of MD.parse(text)) {
      if (b.t !== 'thread') continue;
      list.push({ path, b, hp: MD.headPath(L, b.l0) });
      if (!b.resolved) S.counts.set(path, (S.counts.get(path) || 0) + 1);
    }
  }
  S.threads = list;
  renderTree();
  if (S.tab === 'cmt') renderThreads();
}
function renderThreads() {
  const only = $('openOnly').checked, items = S.threads.filter(x => !only || !x.b.resolved), box = $('cmtList');
  if (!items.length) { box.innerHTML = `<div class="empty">${only ? '未解決のコメントはない' : 'コメントはない'}<br>プレビューのブロックにマウスを乗せて 💬 で書ける</div>`; return; }
  let h = '', last = null;
  for (const x of items) {
    if (x.path !== last) { h += `<div class="grp">${esc(x.path)}</div>`; last = x.path; }
    const m = x.b.msgs[x.b.msgs.length - 1];
    const badge = x.b.resolved ? '<span class="badge done">解決</span>' : m && m.who === 'user' ? '<span class="badge wait">返事待ち</span>' : '<span class="badge ai">AI が返事</span>';
    h += `<div class="ci" data-path="${esc(x.path)}" data-line="${x.b.l0}"><span class="hp">${esc(x.hp.join(' › ') || '先頭')}</span><span class="tt">💬 ${esc(x.b.title || 'コメント')}</span> ${badge}<span class="last">${m ? (m.who === 'ai' ? 'AI: ' : 'あなた: ') + esc(m.text.split('\n')[0]) : ''}</span></div>`;
  }
  box.innerHTML = h;
}
const threadsText = items => items.map(x => `【コメント】${loc(x.path)} の「${x.hp.join(' › ') || '先頭'}」(${x.b.l0 + 1} 行目)— ${x.b.title || 'コメント'}${x.b.resolved ? '(解決)' : ''}\n` +
  x.b.msgs.map(m => `${m.who === 'ai' ? 'AI' : 'あなた'}(${m.time}): ${m.text.replace(/\n/g, '\n  ')}`).join('\n')).join('\n\n');

// ---------- 検索 ----------
let srT = 0;
async function search() {
  const q = $('q').value.trim(), box = $('srList');
  if (!q) { box.innerHTML = '<div class="empty">全部の md から探す(大文字・小文字は区別しない)</div>'; $('srCount').textContent = ''; return; }
  const all = await allTexts(), ql = q.toLowerCase();
  let h = '', n = 0;
  for (const { path, text } of all) {
    const L = text.split('\n');
    let first = true;
    for (let i = 0; i < L.length && n < 400; i++) {
      const k = L[i].toLowerCase().indexOf(ql);
      if (k < 0) continue;
      if (first) { h += `<div class="grp">${esc(path)}</div>`; first = false; }
      const s = Math.max(0, k - 16), seg = L[i].slice(s, k + q.length + 60), kk = k - s;
      h += `<div class="sr" data-path="${esc(path)}" data-line="${i}"><span class="hp">${esc(MD.headPath(L, i).join(' › ') || '先頭')} · ${i + 1} 行目</span><span class="tx">${s ? '…' : ''}${esc(seg.slice(0, kk))}<mark>${esc(seg.slice(kk, kk + q.length))}</mark>${esc(seg.slice(kk + q.length))}</span></div>`;
      n++;
    }
  }
  box.innerHTML = h || '<div class="empty">見つからない</div>';
  $('srCount').textContent = n ? (n >= 400 ? '400 件まで表示' : n + ' 件') : '';
}

// ---------- 右: 変更 / 履歴 ----------
function openDrawer(kind) {
  S.drawer = S.drawer === kind ? null : kind;
  $('drawer').hidden = !S.drawer;
  $('diffBtn').classList.toggle('on', S.drawer === 'diff');
  $('histBtn').classList.toggle('on', S.drawer === 'hist');
  S.histSel = null;
  refreshDrawer();
}
function closeDrawer() { S.drawer = null; $('drawer').hidden = true; $('diffBtn').classList.remove('on'); $('histBtn').classList.remove('on'); }
function hunkHTML(c) {
  return `<div class="hunk" data-line="${c.line}"><div class="hp">${esc(c.hp.join(' › ') || '(見出しの前)')} · ${c.line + 1} 行目</div>` + c.items.map(x => '<div class="it">' +
    (x.kind === 'row' ? `<div class="rowc">表の行「${esc(x.name)}」 <span>${esc(x.changes.join(' / ') || '書き方だけ')}</span></div>` : '') +
    (x.del != null ? `<div class="d">- ${esc(x.del)}</div>` : '') + (x.add != null ? `<div class="a">+ ${esc(x.add)}</div>` : '') + '</div>').join('') + '</div>';
}
async function refreshDrawer() {
  if (!S.drawer || !S.cur) return;
  const cur = ed().value;
  if (S.drawer === 'diff') {
    const base = await getBase(S.cur.path), chs = base ? MD.changes(base.text.split('\n'), cur.split('\n')) : [];
    $('dTitle').textContent = '変更';
    $('dSub').textContent = base ? `基準: ${base.time}(コメントのやり取りは数えない)` : '';
    $('dActs').innerHTML = '<button data-a="copy" class="primary">このファイルの変更をコピー</button><button data-a="copyAll">全ファイル</button><button data-a="rebase" title="今の内容を新しい基準にする(LLM に渡した後など)">基準を今にする</button><button data-a="rebaseAll">全ファイルの基準を今に</button>';
    $('dBody').innerHTML = chs.length ? chs.map(hunkHTML).join('') : '<div class="dim">基準からの変更はありません。<br>基準はファイルを初めて開いた時の中身。LLM に渡した後などに「基準を今にする」で区切る</div>';
    return;
  }
  const list = (await DB.hist(fkey(S.cur.path)).catch(() => [])).slice().reverse();
  const k = list.findIndex(x => x.id === S.histSel), sel = list[k];
  $('dTitle').textContent = '履歴';
  $('dSub').textContent = list.length + ' 版(開いた時・保存・外での変更で残る)';
  $('dActs').innerHTML = sel ? `<span class="seg"><button data-a="mPrev" class="${S.histMode === 'prev' ? 'on' : ''}">この時の変更</button><button data-a="mNow" class="${S.histMode === 'now' ? 'on' : ''}">この版 → 今</button></span><button data-a="restore">この版を編集欄に戻す</button>` : '<span class="dim">版を選ぶと違いが出る(外での変更 = LLM などが書き換えた所)</span>';
  let h = list.map(x => `<div class="ver${x.id === S.histSel ? ' on' : ''}" data-id="${x.id}"><span>${esc(x.time)}</span><span class="k${x.kind.startsWith('外部') ? ' ext' : ''}">${esc(x.kind)}</span>${x.text === cur ? '<span class="st">今と同じ</span>' : ''}</div>`).join('');
  if (sel) {
    const prev = list[k + 1], A = S.histMode === 'prev' ? (prev ? prev.text : '') : sel.text, B = S.histMode === 'prev' ? sel.text : cur;
    const chs = MD.changes(A.split('\n'), B.split('\n'), true); // 履歴はコメントのやり取り(AI の返事など)も見せる
    h = `<div class="dsec">${S.histMode === 'prev' ? (prev ? 'ひとつ前の版 → この版' : '(最初の版)') : 'この版 → 今'}</div>` + (chs.length ? chs.map(hunkHTML).join('') : '<div class="dim">違いはない</div>') + '<div class="dsec">版</div>' + h;
  }
  $('dBody').innerHTML = h || '<div class="dim">まだ履歴はない</div>';
}
async function drawerAction(a) {
  const cur = ed().value;
  if (a === 'copy') {
    const base = await getBase(S.cur.path), chs = base ? MD.changes(base.text.split('\n'), cur.split('\n')) : [];
    return chs.length ? copy(MD.changesText(loc(S.cur.path), chs, base.time), '変更をコピーしました') : msg('変更はありません');
  }
  if (a === 'copyAll') {
    let t = '';
    for (const { path, text } of await allTexts()) { const base = await getBase(path), chs = base ? MD.changes(base.text.split('\n'), text.split('\n')) : []; if (chs.length) t += MD.changesText(loc(path), chs, base.time) + '\n'; }
    return t ? copy(t.trim(), '全ファイルの変更をコピーしました') : msg('変更はありません');
  }
  if (a === 'rebase') { await setBase(S.cur.path, cur); msg('基準を今の内容にしました', 'ok'); return refreshDrawer(); }
  if (a === 'rebaseAll') {
    if (!confirm('全部のファイルの基準を、今の内容にしますか?')) return;
    for (const { path, text } of await allTexts()) await setBase(path, text);
    msg('全部のファイルの基準を今の内容にしました', 'ok'); return refreshDrawer();
  }
  if (a === 'mPrev' || a === 'mNow') { S.histMode = a === 'mPrev' ? 'prev' : 'now'; return refreshDrawer(); }
  if (a === 'restore') {
    const list = await DB.hist(fkey(S.cur.path)).catch(() => []), sel = list.find(x => x.id === S.histSel);
    if (sel) { setSource(sel.text); msg('この版を編集欄に戻しました(まだ保存していない)', 'warn'); }
  }
}

// ---------- 前回のフォルダ ----------
async function initLast() {
  let h = null;
  try { h = await DB.get('kv', 'root'); } catch (e) { /* 覚えていない */ }
  if (!h) return;
  const b = $('lastBtn');
  b.hidden = false; b.textContent = '前回: ' + h.name;
  b.onclick = async () => {
    try {
      if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await h.requestPermission({ mode: 'readwrite' })) !== 'granted') { msg('フォルダの許可がありません', 'warn'); return; }
      await useDir(h);
    } catch (e) { msg('前回のフォルダを開けませんでした: ' + e.message, 'warn'); }
  };
}

// ---------- 操作 ----------
$('openBtn').onclick = async () => {
  if (!window.showDirectoryPicker) { alert('このブラウザはフォルダの読み書きに対応していません。Chrome か Edge で開いてください。'); return; }
  if (isDirty() && !confirm('未保存の変更があります。捨てて別のフォルダを開きますか?')) return;
  try { const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'md-editor' }); await DB.put('kv', 'root', h).catch(() => {}); await useDir(h); initLast(); }
  catch (e) { if (e.name !== 'AbortError') msg('開けませんでした: ' + e.message, 'warn'); }
};
$('rescanBtn').onclick = rescan;
$('tree').onclick = e => { const f = e.target.closest('.f'); if (f) openFile(f.dataset.path); };
$('filter').oninput = renderTree;
$('q').oninput = () => { clearTimeout(srT); srT = setTimeout(search, 250); };
$('srList').onclick = e => { const r = e.target.closest('.sr'); if (r) openFile(r.dataset.path, +r.dataset.line); };
$('cmtList').onclick = e => { const r = e.target.closest('.ci'); if (r) openFile(r.dataset.path, +r.dataset.line); };
$('openOnly').onchange = renderThreads;
$('cmtCopy').onclick = () => { const items = S.threads.filter(x => !$('openOnly').checked || !x.b.resolved); items.length ? copy(threadsText(items), 'コメントをコピーしました') : msg('コメントはありません'); };
$('tabs').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  S.tab = b.dataset.tab;
  for (const x of $('tabs').children) x.classList.toggle('on', x === b);
  for (const t of ['files', 'search', 'cmt']) $('tab-' + t).hidden = t !== S.tab;
  if (S.tab === 'search') { $('q').focus(); search(); }
  if (S.tab === 'cmt') { renderThreads(); refreshThreads(); }
};
$('saveBtn').onclick = () => save();
$('reloadBtn').onclick = reload;
$('bnReload').onclick = () => reloadNow();
$('bnKeep').onclick = hideBanner;
$('undoBtn').onclick = undoPv;
$('diffBtn').onclick = () => openDrawer('diff');
$('histBtn').onclick = () => openDrawer('hist');
$('dClose').onclick = closeDrawer;
$('dActs').onclick = e => { const b = e.target.closest('button[data-a]'); if (b) drawerAction(b.dataset.a); };
$('dBody').onclick = e => {
  const v = e.target.closest('.ver');
  if (v) { S.histSel = +v.dataset.id; refreshDrawer(); return; }
  const h = e.target.closest('.hunk');
  if (h && !(S.drawer === 'hist' && S.histMode === 'prev')) gotoLine(+h.dataset.line);
};
$('locBtn').onclick = () => { if (!S.cur) return; const e = ed(), L = e.value.split('\n'), line = edLine(), sel = e.value.slice(e.selectionStart, e.selectionEnd); copy(locText(S.cur.path, L, line, sel ? sel.split('\n') : [L[line]]), '場所をコピーしました'); };
$('foldAll').onclick = () => foldAll(true);
$('openAll').onclick = () => foldAll(false);
$('hideRes').onchange = () => { $('pv').classList.toggle('hide-resolved', $('hideRes').checked); ls.set('mde-hideRes', $('hideRes').checked); };
$('hideRes').checked = ls.get('mde-hideRes', false); $('pv').classList.toggle('hide-resolved', $('hideRes').checked);
ed().addEventListener('input', () => onEdited());
ed().addEventListener('keyup', () => markCursor(true));
ed().addEventListener('click', () => markCursor(true));
ed().addEventListener('keydown', e => { if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) { e.preventDefault(); document.execCommand('insertText', false, '  '); } }); // 字下げは空白 2つ(元に戻せる)
$('pv').addEventListener('click', e => {
  const tb = e.target.closest('#tool button');
  if (tb) { const el = S.toolEl; if (!el) return; if (tb.dataset.a === 'cm') newThread(el); else if (tb.dataset.a === 'cp') copyBlock(el); else editBlock(el); return; }
  const th = e.target.closest('.thread');
  if (th) {
    if (e.target.closest('.th-send')) replyThread(th);
    else if (e.target.closest('.th-resolve')) resolveThread(th);
    else if (e.target.closest('.th-del')) deleteThread(th);
    else if (e.target.closest('.th-h')) th.classList.toggle('open');
    return;
  }
  if (e.target.closest('.composer, .blk-ed, .cell-in, a, button, input, textarea')) return;
  const cell = e.target.closest('td[data-ci], th[data-ci]');
  if (cell) { editCell(cell); return; }
  const hd = e.target.closest('.hd');
  if (hd) { hd.parentElement.classList.toggle('folded'); saveFolds(); moveEditorTo(+hd.dataset.l0); return; }
  const blk = e.target.closest('[data-l0]');
  if (blk) moveEditorTo(+blk.dataset.l0);
});
$('pv').addEventListener('dblclick', e => {
  if (e.target.closest('.thread, .composer, .tw, #tool, .blk-ed, .hd')) return;
  const blk = e.target.closest('[data-blk]');
  if (blk) editBlock(blk);
});
$('pv').addEventListener('keydown', e => { const ta = e.target.closest('.th-reply textarea'); if (ta && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); replyThread(ta.closest('.thread')); } });
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase(), inText = /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
  if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); save(); }
  else if ((e.ctrlKey || e.metaKey) && e.shiftKey && k === 'f') { e.preventDefault(); $('tabs').querySelector('[data-tab="search"]').click(); }
  else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && k === 'z' && !inText && S.undo.length) { e.preventDefault(); undoPv(); }
});
window.addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
setInterval(watch, 2000);
window.addEventListener('focus', watch);
function setView(v) {
  S.view = v; $('panes').className = v === 'split' ? '' : v;
  for (const b of document.querySelectorAll('#viewSeg button')) b.classList.toggle('on', b.dataset.v === v);
  ls.set('mde-view', v);
  if (v !== 'edit') renderPreview(true);
}
$('viewSeg').onclick = e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); };
setView(ls.get('mde-view', 'split'));
initLast();
window.MDE = { useDir, openFile, save, refreshThreads, search, state: S }; // 試験用
