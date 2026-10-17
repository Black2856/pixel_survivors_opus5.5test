// md.js — 仕様書の Markdown を、元の行の範囲つきのブロックにして HTML にする / 行の差分とその説明
//   書き方の範囲: 見出し・段落・箇条書き(入れ子)・表・引用・区切り線・コード・太字・斜体・リンク・HTML のコメント
//   コメントのスレッド(AI とユーザーのやり取り。HTML のコメントなので、普通の Markdown の表示では見えない):
//     <!-- 💬 題(どこについてか)        ← 解決したら <!-- 💬✅ 題
//     @user 2026-10-15 14:20
//     本文(何行でもよい)
//     @ai 2026-10-15 14:25
//     本文
//     -->
'use strict';
const MD = (() => {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function inline(s) {
    return s.split(/(`[^`]+`)/).map(p => {
      if (p.length > 1 && p.startsWith('`') && p.endsWith('`')) return '<code>' + esc(p.slice(1, -1)) + '</code>';
      return esc(p)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/&lt;br\s*\/?&gt;/g, '<br>');
    }).join('');
  }
  const plain = s => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/<br\s*\/?>/g, ' ');
  const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
  const SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  const HEAD = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
  const TH_OPEN = /^\s*<!--\s*💬(✅)?\s*(.*?)\s*(-->)?\s*$/;
  const MSG = /^@(user|ai)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*$/;
  const isRow = l => /^\s*\|/.test(l);
  const isTableStart = (L, i) => isRow(L[i]) && i + 1 < L.length && SEP.test(L[i + 1]);
  const blockStart = (L, i) => /^```/.test(L[i]) || HEAD.test(L[i]) || /^\s*>/.test(L[i]) || LIST.test(L[i]) || HR.test(L[i]) || isRow(L[i]) || /^\s*<!--/.test(L[i]);

  // 表の行のセル: [{ s, e, text }](s, e: 行の中の位置。前後の空白を除いた中身の範囲 / text: \| を | にした中身)
  function cellSpans(line) {
    const out = [], n = line.length;
    let i = line.indexOf('|');
    if (i < 0) return out;
    i++;
    while (i <= n) {
      let j = i;
      while (j < n && !(line[j] === '|' && line[j - 1] !== '\\')) j++;
      if (j >= n && line.slice(i).trim() === '') break; // 行の最後の | の後
      let s = i, e = j;
      while (s < e && line[s] === ' ') s++;
      while (e > s && line[e - 1] === ' ') e--;
      out.push({ s, e, text: line.slice(s, e).replace(/\\\|/g, '|') });
      if (j >= n) break;
      i = j + 1;
    }
    return out;
  }

  // コメントのスレッド(l0〜l1 は <!-- から --> まで)
  function thread(L, l0, l1, m) {
    const msgs = [];
    let cur = null;
    for (let j = l0 + 1; j <= l1; j++) {
      let s = L[j];
      if (j === l1) { s = s.replace(/\s*-->\s*$/, ''); if (!s.trim()) continue; }
      const mm = s.match(MSG);
      if (mm) { cur = { who: mm[1], time: mm[2], text: '', line: j }; msgs.push(cur); continue; }
      if (!cur) { cur = { who: 'user', time: '', text: '', line: j }; msgs.push(cur); }
      cur.text += (cur.text ? '\n' : '') + s;
    }
    for (const x of msgs) x.text = x.text.replace(/\s+$/, '');
    return { t: 'thread', l0, l1, resolved: !!m[1], title: m[2] || '', msgs };
  }

  // ブロックに分ける。各ブロック: { t: 種類, l0, l1(元の行。0 始まり・含む), … }
  function parse(src) {
    const L = src.split('\n'), out = [];
    let i = 0;
    while (i < L.length) {
      const l = L[i];
      if (/^\s*$/.test(l)) { i++; continue; }
      const l0 = i;
      if (/^```/.test(l)) {
        let e = i + 1;
        while (e < L.length && !/^```/.test(L[e])) e++;
        out.push({ t: 'code', l0, l1: Math.min(e, L.length - 1), text: L.slice(l0 + 1, e).join('\n') });
        i = e + 1; continue;
      }
      if (/^\s*<!--/.test(l)) {
        let e = i;
        while (e < L.length && !L[e].includes('-->')) e++;
        if (e >= L.length) e = L.length - 1;
        const m = l.match(TH_OPEN);
        out.push(m ? thread(L, l0, e, m) : { t: 'hidden', l0, l1: e });
        i = e + 1; continue;
      }
      let m = l.match(HEAD);
      if (m) { out.push({ t: 'h', lv: m[1].length, text: m[2], l0, l1: l0 }); i++; continue; }
      if (HR.test(l)) { out.push({ t: 'hr', l0, l1: l0 }); i++; continue; }
      if (isTableStart(L, i)) {
        const head = cellSpans(l).map(c => c.text);
        const al = cellSpans(L[i + 1]).map(c => (c.text.startsWith(':') && c.text.endsWith(':') ? 'center' : c.text.endsWith(':') ? 'right' : ''));
        const rows = [];
        i += 2;
        while (i < L.length && isRow(L[i])) { rows.push({ line: i, cells: cellSpans(L[i]).map(c => c.text) }); i++; }
        out.push({ t: 'table', l0, l1: i - 1, head, al, rows }); continue;
      }
      if (/^\s*>/.test(l)) {
        while (i < L.length && /^\s*>/.test(L[i])) i++;
        out.push({ t: 'quote', l0, l1: i - 1, text: L.slice(l0, i).map(x => x.replace(/^\s*>\s?/, '')).join('\n') }); continue;
      }
      if (LIST.test(l)) {
        const items = [];
        while (i < L.length) {
          const lm = L[i].match(LIST);
          if (lm) { items.push({ ind: lm[1].replace(/\t/g, '  ').length, ord: /\d/.test(lm[2]), text: lm[3], l0: i, l1: i }); i++; continue; }
          if (/^\s+\S/.test(L[i]) && items.length && !blockStart(L, i)) { const it = items[items.length - 1]; it.text += '\n' + L[i].trim(); it.l1 = i; i++; continue; }
          break;
        }
        out.push({ t: 'list', l0, l1: i - 1, items }); continue;
      }
      i++; // 段落(最初の行は必ず入れる。| で始まっても表でない行など)
      while (i < L.length && !/^\s*$/.test(L[i]) && !blockStart(L, i)) i++;
      out.push({ t: 'p', l0, l1: i - 1, text: L.slice(l0, i).join('\n') });
    }
    return out;
  }

  // ---------- HTML ----------
  const lines = (b, lines) => (lines ? ` data-l0="${b.l0}" data-l1="${b.l1}"` : '');
  const ml = s => s.split('\n').map(inline).join('<br>');
  function block(b, withLines = true) {
    const at = lines(b, withLines);
    switch (b.t) {
      case 'p': return `<p data-blk="p"${at}>${ml(b.text)}</p>`;
      case 'hr': return '<hr>';
      case 'hidden': return '';
      case 'code': return `<pre data-blk="code"${at}><code>${esc(b.text)}</code></pre>`;
      case 'quote': return `<blockquote data-blk="quote"${at}>${parse(b.text).map(x => block(x, false)).join('')}</blockquote>`;
      case 'table': {
        const td = (tag, c, k, row) => `<${tag} data-ci="${k}"${b.al[k] ? ` style="text-align:${b.al[k]}"` : ''}>${inline(c)}</${tag}>`;
        let h = `<div class="tw"><table data-blk="table"${at}><thead><tr data-line="${b.l0}">${b.head.map((c, k) => td('th', c, k)).join('')}</tr></thead><tbody>`;
        for (const r of b.rows) h += `<tr data-line="${r.line}">` + b.head.map((_, k) => td('td', r.cells[k] ?? '', k)).join('') + '</tr>';
        return h + '</tbody></table></div>';
      }
      case 'list': {
        let h = '';
        const st = [];
        for (const it of b.items) {
          while (st.length && it.ind < st[st.length - 1].ind) h += `</li></${st.pop().tag}>`;
          const top = st[st.length - 1];
          if (!top || it.ind > top.ind) { const tag = it.ord ? 'ol' : 'ul'; st.push({ ind: it.ind, tag }); h += `<${tag}>`; } else h += '</li>';
          h += `<li data-blk="li"${withLines ? ` data-l0="${it.l0}" data-l1="${it.l1}"` : ''}>${ml(it.text)}`;
        }
        while (st.length) h += `</li></${st.pop().tag}>`;
        return h;
      }
      case 'thread': {
        const last = b.msgs[b.msgs.length - 1];
        const badge = b.resolved ? '<span class="badge done">解決</span>' : last && last.who === 'user' ? '<span class="badge wait">AI の返事待ち</span>' : last ? '<span class="badge ai">AI が返事した</span>' : '';
        const msgs = b.msgs.map(x => `<div class="msg ${x.who}"><div class="mh"><b>${x.who === 'ai' ? 'AI' : 'あなた'}</b><time>${esc(x.time)}</time></div><div class="mt">${ml(x.text)}</div></div>`).join('');
        return `<div class="thread${b.resolved ? ' resolved' : ''}" data-blk="thread"${at}><div class="th-h"><span class="th-t">💬 ${esc(b.title || 'コメント')}</span>${badge}<span class="sp"></span>` +
          `<button class="th-resolve">${b.resolved ? '未解決に戻す' : '解決にする'}</button><button class="th-del" title="このやり取りを消す">✕</button></div>` +
          `<div class="th-body">${msgs}<div class="th-reply"><textarea rows="2" placeholder="返信(Ctrl+Enter で送る。送ると保存する)"></textarea><button class="th-send">送る</button></div></div></div>`;
      }
    }
    return '';
  }
  // 見出しで区切った節にする(アコーディオン)。folded: たたんだ節のキー(見出しの文。同じ文の 2つ目からは #2 …)
  function render(blocks, folded) {
    let h = '';
    const depth = [], seen = {};
    const close = lv => { while (depth.length && depth[depth.length - 1] >= lv) { h += '</div></section>'; depth.pop(); } };
    for (const b of blocks) {
      if (b.t !== 'h') { h += block(b); continue; }
      close(b.lv);
      let key = plain(b.text);
      seen[key] = (seen[key] || 0) + 1;
      if (seen[key] > 1) key += '#' + seen[key];
      const f = folded && folded.has(key);
      h += `<section class="sec${f ? ' folded' : ''}" data-key="${esc(key)}"><h${b.lv} class="hd" data-blk="h" data-l0="${b.l0}" data-l1="${b.l1}"><span class="fold"></span><span class="ht">${inline(b.text)}</span></h${b.lv}><div class="sb">`;
      depth.push(b.lv);
    }
    close(0);
    return h;
  }

  // ---------- 位置・差分 ----------
  // その行を含む見出しの道筋(['3. パッシブ', '3.1 強化'])
  function headPath(L, line) {
    const st = [];
    let fence = false;
    for (let i = 0; i <= Math.min(line, L.length - 1); i++) {
      if (/^```/.test(L[i])) fence = !fence;
      const m = !fence && L[i].match(HEAD);
      if (!m) continue;
      const lv = m[1].length;
      while (st.length && st[st.length - 1].lv >= lv) st.pop();
      st.push({ lv, text: plain(m[2]) });
    }
    return st.map(x => x.text);
  }
  // その行が表の中なら、表の見出しの行の番号(違えば -1)
  function tableHeadLine(L, line) {
    if (!isRow(L[line] || '')) return -1;
    let k = line;
    while (k > 0 && isRow(L[k - 1])) k--;
    return k + 1 < L.length && SEP.test(L[k + 1]) ? k : -1;
  }
  // コメントのスレッドの中の行(差分から外す)
  function threadMask(L) {
    const m = new Uint8Array(L.length);
    for (let i = 0; i < L.length; i++) {
      if (!TH_OPEN.test(L[i])) continue;
      let e = i;
      while (e < L.length && !L[e].includes('-->')) e++;
      for (let k = i; k <= Math.min(e, L.length - 1); k++) m[k] = 1;
      i = e;
    }
    return m;
  }
  // 行の差分(前後の同じ所を除いて LCS)。ops: { op: '=' | '-' | '+', a, b(行番号), text }
  function diffOps(A, B) {
    let s = 0;
    while (s < A.length && s < B.length && A[s] === B[s]) s++;
    let ea = A.length, eb = B.length;
    while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
    const a = A.slice(s, ea), b = B.slice(s, eb), n = a.length, m = b.length, ops = [];
    for (let k = 0; k < s; k++) ops.push({ op: '=', a: k, b: k });
    if (n * m > 4e6) { a.forEach((t, k) => ops.push({ op: '-', a: s + k, text: t })); b.forEach((t, k) => ops.push({ op: '+', b: s + k, text: t })); }
    else {
      const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (a[i] === b[j]) { ops.push({ op: '=', a: s + i, b: s + j }); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: '-', a: s + i, text: a[i] }); i++; }
        else { ops.push({ op: '+', b: s + j, text: b[j] }); j++; }
      }
      for (; i < n; i++) ops.push({ op: '-', a: s + i, text: a[i] });
      for (; j < m; j++) ops.push({ op: '+', b: s + j, text: b[j] });
    }
    for (let k = 0; k < A.length - ea; k++) ops.push({ op: '=', a: ea + k, b: eb + k });
    return ops;
  }
  // A(前)→ B(今)の変更を、見出しの道筋つきのまとまりにする。表の行は列ごとの「前 → 後」も出す。コメントのスレッドの中は数えない
  //   withThreads: true ならコメントのスレッドの中も数える
  //   戻り値: [{ hp: ['3. パッシブ', …], line(B の行), items: [{ kind: 'row' | 'chg' | 'del' | 'add', name, changes, del, add, head }] }]
  function changes(A, B, withThreads) { // withThreads: コメントのやり取りも数える(履歴)
    const ma = withThreads ? new Uint8Array(A.length) : threadMask(A), mb = withThreads ? new Uint8Array(B.length) : threadMask(B), ops = diffOps(A, B), out = [];
    let cur = null, lastB = -1;
    for (const o of ops) {
      if (o.op === '=') { lastB = o.b; cur = null; continue; }
      if ((o.op === '-' && ma[o.a]) || (o.op === '+' && mb[o.b])) continue;
      if (!cur) { cur = { del: [], add: [], line: lastB + 1 }; out.push(cur); }
      if (o.op === '-') cur.del.push(o); else { if (!cur.add.length) cur.line = o.b; cur.add.push(o); }
    }
    return out.filter(h => [...h.del, ...h.add].some(o => o.text.trim())).map(h => {
      const items = [], n = Math.min(h.del.length, h.add.length);
      for (let k = 0; k < n; k++) {
        const d = h.del[k], a = h.add[k];
        const hl = tableHeadLine(B, a.b), head = hl >= 0 ? cellSpans(B[hl]).map(c => plain(c.text)) : null;
        if (head && isRow(d.text) && !SEP.test(a.text)) {
          const cd = cellSpans(d.text).map(c => c.text), ca = cellSpans(a.text).map(c => c.text);
          if (cd.length === ca.length) {
            const ch = ca.map((v, i) => (v !== cd[i] ? `${head[i] || i + 1 + '列目'}: ${cd[i] || '(空)'} → ${v || '(空)'}` : null)).filter(Boolean);
            // 行の名前: 左の 2列のうち、変わっていない・空でないマス(「生命 / HP」「鉄壁」)
            const name = [0, 1].filter(i => ca[i] && ca[i] === cd[i]).map(i => plain(ca[i])).join(' / ') || plain(ca[0] || cd[0] || '');
            items.push({ kind: 'row', name, head, changes: ch, del: d.text, add: a.text });
            continue;
          }
        }
        items.push({ kind: 'chg', del: d.text, add: a.text });
      }
      for (const d of h.del.slice(n)) items.push({ kind: 'del', del: d.text });
      for (const a of h.add.slice(n)) items.push({ kind: 'add', add: a.text });
      return { hp: headPath(B, h.line), line: h.line, items };
    });
  }
  // 変更を LLM に渡す文にする
  function changesText(loc, chs, base) {
    let t = `【変更】${loc}${base ? `(${base} から)` : ''}\n`, last = null;
    for (const c of chs) {
      const hp = c.hp.join(' › ') || '(見出しの前)';
      if (hp !== last) t += `■ ${hp}\n`; // 同じ節が続くときは見出しを 1回だけ
      last = hp;
      for (const x of c.items) {
        if (x.kind === 'row') t += `・表の行「${x.name}」: ${x.changes.join(' / ') || '(書き方だけ)'}\n  - ${x.del.trim()}\n  + ${x.add.trim()}\n`;
        else if (x.kind === 'chg') t += `・変更\n  - ${x.del.trim()}\n  + ${x.add.trim()}\n`;
        else if (x.kind === 'del') t += `・削除  - ${x.del.trim()}\n`;
        else t += `・追加  + ${x.add.trim()}\n`;
      }
    }
    return t;
  }
  return { esc, inline, plain, parse, render, cellSpans, headPath, tableHeadLine, changes, changesText, MSG, TH_OPEN };
})();
