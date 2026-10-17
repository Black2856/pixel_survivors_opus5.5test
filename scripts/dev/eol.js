// eol.js — 作業ツリーの改行コードを調べる(このリポジトリの js / md / css / html は CRLF。core.autocrlf=true)
//   node scripts/dev/eol.js          … HEAD から変わったファイルと、まだ git に入っていないファイル
//   node scripts/dev/eol.js a.js b.md … 指定したファイル
//   node scripts/dev/eol.js --fix ... … LF だけの行を CRLF にそろえる
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');

const root = path.join(__dirname, '..', '..');
const args = process.argv.slice(2), fix = args.includes('--fix');
let files = args.filter(a => !a.startsWith('--'));
if (!files.length) {
  const git = c => execSync(c, { cwd: root, encoding: 'utf8' }).split('\n').map(s => s.trim()).filter(Boolean);
  files = [...new Set([...git('git diff --name-only HEAD'), ...git('git ls-files --others --exclude-standard')])];
}
let bad = 0;
for (const f of files.filter(f => /\.(js|md|css|html|json|yml)$/.test(f))) {
  const p = path.resolve(root, f);
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, 'utf8');
  const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/(^|[^\r])\n/g) || []).length;
  if (lf) {
    bad++;
    if (fix) { fs.writeFileSync(p, s.replace(/\r?\n/g, '\r\n')); console.log('直した ' + f + '(LF ' + lf + '行)'); } else console.log('LF ' + lf + ' / CRLF ' + crlf + '  ' + f);
  }
}
if (!bad) console.log('すべて CRLF(' + files.length + 'ファイル)');
