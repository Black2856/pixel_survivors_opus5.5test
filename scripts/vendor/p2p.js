// p2p.js — 協力プレイの通信のライブラリを、ゲームが読む 1つのファイル js/vendor/p2p.js にまとめる(node scripts/vendor/p2p.js)
//   中身: Trystero(Supabase で仲介する形。部屋の WebRTC)と supabase-js(公開ロビー)。グローバルの P2P = { joinRoom, selfId, createClient }
//   版は package.json で固定(@trystero-p2p/supabase・@supabase/supabase-js)。上げる時は npm i -D --save-exact <名前>@<版> → これを走らせる
//   → 変わった所(版・大きさ)を見てからコミットする。ゲームは実行中に外の CDN から読まない(coop.md 4章)
'use strict';
const fs = require('fs'), path = require('path');
const esbuild = require('esbuild');
const root = path.join(__dirname, '..', '..');
const ver = name => JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version;

(async () => {
  const r = await esbuild.build({
    stdin: {
      contents: "export { joinRoom, selfId } from '@trystero-p2p/supabase';\nexport { createClient } from '@supabase/supabase-js';\n",
      resolveDir: root, loader: 'js',
    },
    bundle: true, format: 'iife', globalName: 'P2P', platform: 'browser', target: 'es2020',
    minify: true, legalComments: 'none', charset: 'utf8', write: false,
  });
  const head = [
    '// js/vendor/p2p.js — 作った物(手で直さない)。node scripts/vendor/p2p.js で作り直す',
    '// @trystero-p2p/supabase ' + ver('@trystero-p2p/supabase') + ' / @trystero-p2p/core ' + ver('@trystero-p2p/core') + ' / @supabase/supabase-js ' + ver('@supabase/supabase-js') + '(MIT)',
    '',
  ].join('\n');
  const out = (head + r.outputFiles[0].text).replace(/\r?\n/g, '\r\n');
  fs.writeFileSync(path.join(root, 'js', 'vendor', 'p2p.js'), out);
  console.log('js/vendor/p2p.js', (out.length / 1024).toFixed(0) + ' KB');
})().catch(e => { console.error(e); process.exit(1); });
