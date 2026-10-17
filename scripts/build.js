// build.js — 公開用のビルド: index.html の <script src> を順につないで 1つの関数で包み、esbuild で小さくして dist/ に出す
//   npm run build(= node scripts/build.js)。GitHub Actions(.github/workflows/pages.yml)が release への push で走らせて Pages に出す
//   開発中は index.html のまま(ファイルを1つずつ読む・全部グローバル。scripts/dev/harness.js はそれを前提にしている)
//   出力: dist/index.html(script 1つ・css 1つ)/ dist/js/game.<hash>.js / dist/css/style.<hash>.css / dist/music/
//   ファイル名に中身のハッシュを入れるので、更新したときに古いキャッシュが使われない
//   node scripts/build.js --concat: 小さくする前のつないだだけのもの(dist/game.concat.js)も出す / --no-wrap: 関数で包まない(試験用)
//   dist/ はリポジトリの下なので、開発用のサーバー(8765)から http://127.0.0.1:8765/dist/ で同じ origin(同じセーブ)のまま開ける
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..'), out = path.join(root, 'dist');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const hash8 = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);

async function main() {
  const html = read('index.html');
  const tags = [...html.matchAll(/<script src="([^"]+)"><\/script>\r?\n?/g)];
  if (!tags.length) throw new Error('index.html に <script src> がない');
  for (const m of tags) if (/^(https?:)?\/\//.test(m[1])) throw new Error('外部の script はつながない: ' + m[1]);

  // つなぐ: 1つの関数の中に入れる(トップレベルの名前がグローバルに出ない)。ファイルの間に ; を挟む
  //   --no-wrap: 包まない(名前がグローバルに残るので scripts/dev/harness.js が使える。小さくしても動きが変わらないかを、開発版とハッシュで比べる用)
  const parts = tags.map(m => '// ---- ' + m[1] + '\n' + read(m[1]));
  const body = parts.join('\n;\n');
  const joined = process.argv.includes('--no-wrap') ? body + '\n' : "(() => {\n'use strict';\n" + body + '\n})();\n';
  const js = (await esbuild.transform(joined, { minify: true, charset: 'utf8', legalComments: 'none', target: 'esnext' })).code;
  const css = (await esbuild.transform(read('css/style.css'), { loader: 'css', minify: true, charset: 'utf8' })).code;

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'js'), { recursive: true });
  fs.mkdirSync(path.join(out, 'css'), { recursive: true });
  const jsName = 'js/game.' + hash8(js) + '.js', cssName = 'css/style.' + hash8(css) + '.css';
  fs.writeFileSync(path.join(out, jsName), js);
  fs.writeFileSync(path.join(out, cssName), css);
  if (process.argv.includes('--concat')) fs.writeFileSync(path.join(out, 'game.concat.js'), joined);

  // index.html: 最初の <script src> の場所に 1つだけ置き、残りは消す。css の参照を差し替える
  let first = true;
  let page = html.replace(/<script src="([^"]+)"><\/script>\r?\n?/g, m => {
    if (!first) return '';
    first = false;
    return '<script src="' + jsName + '"></script>' + (m.endsWith('\n') ? m.slice(m.lastIndexOf('>') + 1) : '');
  });
  if (!page.includes('href="css/style.css"')) throw new Error('index.html に css/style.css の参照がない');
  page = page.replace('href="css/style.css"', 'href="' + cssName + '"');
  fs.writeFileSync(path.join(out, 'index.html'), page);

  fs.cpSync(path.join(root, 'music'), path.join(out, 'music'), { recursive: true });

  const kb = n => (n / 1024).toFixed(0) + ' KB';
  const src = tags.reduce((a, m) => a + Buffer.byteLength(read(m[1])), 0);
  console.log(tags.length + ' ファイル ' + kb(src) + ' → ' + jsName + ' ' + kb(Buffer.byteLength(js)) + ' / ' + cssName + ' ' + kb(Buffer.byteLength(css)));
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
