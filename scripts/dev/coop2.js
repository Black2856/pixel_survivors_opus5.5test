// coop2.js — 協力プレイ(4段)の確かめ: 1つのブラウザで 2つのページを開き、BroadcastChannel でつないで 2人で同じ計算になるかを比べる
//   PLAYWRIGHT_DIR=<playwright を入れたフォルダ> node scripts/dev/coop2.js [chromium|firefox|webkit] [frames=1800] [inject] [classes=knight,mage]
//   python -m http.server 8765 --bind 127.0.0.1(リポジトリの直下で)を先に立てる
//   画面のフレームでは進めず(COOP.manual)、両方のページを交互に COOP.pump で進める。入力は決まった物(COOP.testInput)
//   inject: 2つ目のページだけ 600フレームで敵の HP を変える → 次のハッシュ(660)で「同期がずれた」と出るはず(見つける仕組みの確かめ)
'use strict';
const path = require('path');
const pw = require(process.env.PLAYWRIGHT_DIR ? path.join(process.env.PLAYWRIGHT_DIR, 'node_modules', 'playwright') : 'playwright');
const args = process.argv.slice(2);
const name = args.find(a => ['chromium', 'firefox', 'webkit'].includes(a)) || 'chromium';
const arg = (k, d) => { const a = args.find(x => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : d; };
const N = +arg('frames', 1800), inject = args.includes('inject'), classes = arg('classes', 'knight,mage').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const t0 = Date.now();
  const browser = await pw[name].launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const pages = [];
  const errs = [];
  for (let i = 0; i < classes.length; i++) {
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(i + ': ' + String(e).slice(0, 200)));
    await page.goto('http://127.0.0.1:8765/?t=' + Date.now());
    await page.waitForFunction(() => typeof startRun === 'function' && typeof coopHost === 'function', null, { timeout: 60000 });
    await page.evaluate(() => { window.saveMeta = () => {}; });
    pages.push(page);
  }
  const room = 't' + Date.now().toString(36);
  await pages[0].evaluate(([room, cls]) => coopHost(room, cls), [room, classes[0]]);
  for (let i = 1; i < pages.length; i++) await pages[i].evaluate(([room, cls]) => coopJoin(room, cls), [room, classes[i]]);
  for (let k = 0; k < 100 && (await pages[0].evaluate(() => COOP.members.length)) < pages.length; k++) await sleep(50);
  // 決まった入力・画面のフレームでは進めない
  for (const p of pages) await p.evaluate(() => {
    COOP.manual = true;
    COOP.testInput = (f, pid) => ({ mx: Math.cos(f / 70 + pid * 2.1), my: Math.sin(f / 55 + pid), e: f % 240 === 40 + pid * 25, q: f % 480 === 100 + pid * 40, def: f % 300 > 280, aim: null, autoE: false, autoQ: false });
  });
  await pages[0].evaluate(() => coopStart({ mode: 'tower' }));
  for (let k = 0; k < 100 && !(await Promise.all(pages.map(p => p.evaluate(() => COOP.on)))).every(Boolean); k++) await sleep(50);
  // 倒れないように(全員のページで同じフレーム 0 に同じことをする)
  for (const p of pages) await p.evaluate(() => { for (const q of players) q.hp = q.maxhp = 1e7; });
  let fs = pages.map(() => 0), injected = false, rounds = 0;
  while (Math.min(...fs) < N && rounds < 20000) {
    rounds++;
    for (let i = 0; i < pages.length; i++) {
      const lim = inject && !injected && i === 1 ? Math.max(0, 600 - fs[i]) : 20;
      fs[i] = await pages[i].evaluate(n => COOP.pump(n), Math.min(lim || 0, N - fs[i]));
      if (inject && !injected && i === 1 && fs[i] === 600) { await pages[1].evaluate(() => { const e = enemies.find(x => !x.dead && !x.prop); if (e) e.hp -= 1; }); injected = true; }
    }
    const ds = await Promise.all(pages.map(p => p.evaluate(() => COOP.desync)));
    if (ds.some(Boolean)) { fs.push(-1); break; }
    await sleep(0);
  }
  const res = await Promise.all(pages.map(p => p.evaluate(() => ({ pid: COOP.pid, f: COOP.f, log: COOP.log, desync: COOP.desync, stalls: COOP.stalls,
    floor: S.tower && S.tower.floor, per: players.map(q => ({ cls: q.cls, kills: q.kills, lv: q.level, x: Math.round(q.x), y: Math.round(q.y) })) }))));
  await browser.close();
  const L0 = res[0].log, same = res.every(r => r.log.length === L0.length && r.log.every((x, i) => x[1] === L0[i][1]));
  const firstDiff = (() => { for (let i = 0; i < L0.length; i++) if (res.some(r => !r.log[i] || r.log[i][1] !== L0[i][1])) return L0[i][0]; return null; })();
  console.log(`${name}  ${classes.join('+')}  フレーム ${res.map(r => r.f).join(' / ')}  ハッシュ ${L0.length}回 ${same ? 'すべて同じ' : '違う(最初は ' + firstDiff + ')'}  最後 ${L0.length ? L0[L0.length - 1][1].toString(16) : '-'}  ${((Date.now() - t0) / 1000).toFixed(1)}秒`);
  console.log('  階 ' + res[0].floor + '  ' + res[0].per.map(q => `${q.cls} 撃破${q.kills} Lv${q.lv}`).join('  ') + '  待った回数 ' + res.map(r => r.stalls).join(' / '));
  for (const r of res) if (r.desync) console.log(`  ページ ${r.pid}: 同期がずれた フレーム ${r.desync.f} ${r.desync.hashes.map(h => h.toString(16)).join(' / ')}`);
  for (const e of errs.slice(0, 5)) console.log('  例外 ' + e);
})().catch(e => { console.error(e); process.exit(1); });
