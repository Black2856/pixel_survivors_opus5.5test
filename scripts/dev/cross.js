// cross.js — 試験の通し(classSmoke・bossSmoke)を Chromium / Firefox / WebKit で回し、計算の状態だけのハッシュ(画素なし)を比べる
//   協力プレイ(claudedocs/coop.md 7章 0段)の確かめ用。Playwright はリポジトリに入れない(package.json に足さない)ので、別のフォルダに入れて場所を渡す
//     npm i playwright(どこか別のフォルダで)→ npx playwright install chromium firefox webkit
//     python -m http.server 8765 --bind 127.0.0.1(リポジトリの直下で)
//     PLAYWRIGHT_DIR=<playwright を入れたフォルダ> node scripts/dev/cross.js [chromium,firefox,webkit] [sim] [class] [trace] [w=1280] [h=720]
//   coop: 3人の協力プレイの通し(T.coopSmoke。sim の形で)を class / boss の代わりに回す
//   sim: 協力プレイの計算の形(計算用のカメラと画面の大きさ。core.js の SIM_VIEW)/ class: classSmoke だけ / trace: 毎フレームの状態を trace-<ブラウザ>.json に書く(大きい)
//   w / h: 窓の大きさ(sim なら窓の大きさを変えても同じハッシュになるはず)
//   Math の関数はゲームが js/detmath.js で置き換えている(置き換える前は 3つとも違った。2026-10-16)
//   画素は入れない(描き方はブラウザで必ず違う)。画面の大きさは 1280×720 にそろえる(計算用の画面の大きさ GFX.VW / VH が変わるため)
'use strict';
const path = require('path');
const fs = require('fs');
const pw = require(process.env.PLAYWRIGHT_DIR ? path.join(process.env.PLAYWRIGHT_DIR, 'node_modules', 'playwright') : 'playwright');
const names = (process.argv[2] || 'chromium,firefox,webkit').split(',');
const flags = process.argv.slice(3), classOnly = flags.includes('class'), trace = flags.includes('trace'), simMode = flags.includes('sim') || flags.includes('coop'), coopMode = flags.includes('coop');
const flagNum = (k, d) => { const f = flags.find(x => x.startsWith(k + '=')); return f ? +f.slice(k.length + 1) : d; };
const viewport = { width: flagNum('w', 1280), height: flagNum('h', 720) };

(async () => {
  const out = {};
  for (const name of names) {
    const t0 = Date.now();
    const browser = await pw[name].launch({ headless: true });
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const pageErrs = [];
    page.on('pageerror', e => pageErrs.push(String(e).slice(0, 200)));
    page.on('requestfailed', r => pageErrs.push('failed: ' + r.url()));
    await page.goto('http://127.0.0.1:8765/?t=' + Date.now());
    await page.waitForFunction(() => typeof startRun === 'function' && typeof DATA === 'object', null, { timeout: 60000 });
    await page.addScriptTag({ url: '/scripts/dev/harness.js?t=' + Date.now() });
    const env = await page.evaluate(sim => (T.init(), SIM_VIEW.on = sim, { VW: GFX.VW, VH: GFX.VH, fns: [typeof updSpawner, typeof updTower, typeof spawnBoss].join() }), simMode);
    if (env.fns.includes('undefined')) throw new Error(name + ': ゲームのファイルが読めていない(' + env.fns + ')。もう一度'); // サーバーを立てた直後に 1度あった
    const cs = await page.evaluate(([tr, coop]) => coop ? T.coopSmoke({ frames: 1800, classes: ['knight', 'mage', 'cryo'], pix: false }) : T.classSmoke({ pix: false, trace: tr }), [trace, coopMode]);
    const bs = classOnly || coopMode ? { hash: '-', frames: 0, errs: [], per: {} } : await page.evaluate(tr => T.bossSmoke({ pix: false, trace: tr }), trace);
    if (trace) fs.writeFileSync(`trace-${name}.json`, JSON.stringify({ c: cs.trace, b: bs.trace }));
    await browser.close();
    out[name] = { cs, bs };
    console.log(`${name.padEnd(8)} ${browser.version()}  class ${cs.hash}(例外 ${cs.errs.length})  boss ${bs.hash}(例外 ${bs.errs.length})  ${env.VW}×${env.VH}  ${((Date.now() - t0) / 1000).toFixed(1)}秒${pageErrs.length ? '  ' + pageErrs.join(' / ') : ''}`);
    for (const e of [...cs.errs, ...bs.errs].slice(0, 3)) console.log('  ' + e);
  }
  const [a, ...rest] = names;
  const same = rest.every(n => out[n].cs.hash === out[a].cs.hash && out[n].bs.hash === out[a].bs.hash);
  console.log(same ? 'すべて同じ' : 'ずれている');
  if (!same && !classOnly) { // ボスの回ごとのハッシュで、最初にずれた回
    const first = Object.keys(out[a].bs.per).find(k => rest.some(n => out[n].bs.per[k] !== out[a].bs.per[k]));
    if (first) console.log('ボスの最初にずれた回: ' + first);
  }
})().catch(e => { console.error(e); process.exit(1); });
