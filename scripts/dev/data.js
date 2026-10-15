// data.js — DATA(js/data.js)の値を node で引く(data.js の長い行を読まずに済ませる)
//   node scripts/dev/data.js classes.knight.params        … その場所の JSON
//   node scripts/dev/data.js classes.knight.tree --keys   … 中のキーだけ
//   node scripts/dev/data.js weapons.longsword.skill --depth 1  … 1段目より深い所は {…} / […] に畳む
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.join(__dirname, '..', '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8') + '\n;this.DATA = DATA;', ctx);

const args = process.argv.slice(2);
const at = args.find(a => !a.startsWith('--')) || '';
const depthI = args.indexOf('--depth'), depth = depthI >= 0 ? +args[depthI + 1] : Infinity;
let v = ctx.DATA;
for (const k of at.split('.').filter(Boolean)) {
  if (v == null || !(k in Object(v))) { console.error('ない: ' + k + '(あるキー: ' + Object.keys(Object(v)).join(' ') + ')'); process.exit(1); }
  v = v[k];
}
if (args.includes('--keys')) { console.log(Object.keys(Object(v)).join(' ')); process.exit(0); }
const fold = (x, d) => (x && typeof x === 'object' ? (d >= depth ? (Array.isArray(x) ? '[…' + x.length + ']' : '{…}') : Array.isArray(x) ? x.map(y => fold(y, d + 1)) : Object.fromEntries(Object.entries(x).map(([k, y]) => [k, fold(y, d + 1)]))) : x);
console.log(JSON.stringify(fold(v, 0), null, 1));
