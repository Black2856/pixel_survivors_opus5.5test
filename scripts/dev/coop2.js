// coop2.js — 協力プレイ(4段)の確かめ: 1つのブラウザで 2つのページを開き、BroadcastChannel でつないで 2人で同じ計算になるかを比べる
//   PLAYWRIGHT_DIR=<playwright を入れたフォルダ> node scripts/dev/coop2.js [chromium|firefox|webkit] [frames=1800] [inject] [classes=knight,mage] [mode=tower|escalation] [net=bc|p2p] [mix]
//   python -m http.server 8765 --bind 127.0.0.1(リポジトリの直下で)を先に立てる
//   画面のフレームでは進めず(COOP.manual)、両方のページを交互に COOP.pump で進める。入力は決まった物(COOP.testInput)
//   inject: 2つ目のページだけ 600フレームで敵の HP を変える → 次のハッシュ(660)で「同期がずれた」と出るはず(見つける仕組みの確かめ)
'use strict';
const path = require('path');
const pw = require(process.env.PLAYWRIGHT_DIR ? path.join(process.env.PLAYWRIGHT_DIR, 'node_modules', 'playwright') : 'playwright');
const args = process.argv.slice(2);
const name = args.find(a => ['chromium', 'firefox', 'webkit'].includes(a)) || 'chromium';
const arg = (k, d) => { const a = args.find(x => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : d; };
const mix = args.includes('mix'), net = arg('net', mix ? 'p2p' : 'bc'), mode = arg('mode', 'tower'), N = +arg('frames', 1800), inject = args.includes('inject'), classes = arg('classes', 'knight,mage').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const t0 = Date.now();
  // mix: ページごとに別のブラウザ(chromium と firefox を交互に。別々の端末に近い。net=p2p で Supabase を通してつなぐ)
  //   Playwright の WebKit(Windows)には WebRTC(RTCPeerConnection)が無いので、P2P には使えない(本物の Safari にはある)
  const kinds = mix ? classes.map((_, i) => ['chromium', 'firefox'][i % 2]) : classes.map(() => name);
  const browsers = {}, ctxs = {};
  for (const k of new Set(kinds)) { browsers[k] = await pw[k].launch({ headless: true }); ctxs[k] = await browsers[k].newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); }
  const pages = [];
  const errs = [];
  for (let i = 0; i < classes.length; i++) {
    const page = await ctxs[kinds[i]].newPage();
    page.on('pageerror', e => errs.push(i + ': ' + String(e).slice(0, 200)));
    await page.goto('http://127.0.0.1:8765/?net=' + net + '&t=' + Date.now());
    // 試験用のサーバーは、いくつものブラウザが一度に読むとファイルを取りこぼすことがある → 関数がそろうまで読み直す(3回まで)
    for (let k = 0; ; k++) {
      await page.waitForFunction(() => typeof startRun === 'function' && typeof coopHost === 'function', null, { timeout: 60000 });
      if (await page.evaluate(() => [typeof buildChoices, typeof updSpawner, typeof coopLevel, typeof spawnBoss, typeof drawFrame].every(t => t === 'function'))) break;
      if (k >= 2) throw new Error('ゲームのファイルが読めない');
      await page.goto('http://127.0.0.1:8765/?net=' + net + '&t=' + Date.now());
    }
    await page.evaluate(() => { window.saveMeta = () => {}; });
    pages.push(page);
  }
  const room = 't' + Date.now().toString(36);
  await pages[0].evaluate(([room, cls]) => coopHost(room, cls), [room, classes[0]]);
  for (let i = 1; i < pages.length; i++) await pages[i].evaluate(([room, cls]) => coopJoin(room, cls), [room, classes[i]]);
  for (let k = 0; k < 400 && (await pages[0].evaluate(() => COOP.members.length)) < pages.length; k++) await sleep(50); // p2p は Supabase で仲介してつながるまで数秒
  // 決まった入力・画面のフレームでは進めない
  for (const p of pages) await p.evaluate(() => {
    COOP.manual = true;
    COOP.testInput = (f, pid) => ({ mx: Math.cos(f / 70 + pid * 2.1), my: Math.sin(f / 55 + pid), e: f % 240 === 40 + pid * 25, q: f % 480 === 100 + pid * 40, def: f % 300 > 280, aim: null, autoE: false, autoQ: false, pick: f % 90 === 30 + pid * 7 ? 1 + (f / 90 | 0) % 3 : f % 400 === 200 ? 9 : 0 });
  });
  await pages[0].evaluate(mode => coopStart({ mode }), mode);
  for (let k = 0; k < 200 && !(await Promise.all(pages.map(p => p.evaluate(() => COOP.on)))).every(Boolean); k++) await sleep(50);
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
    floor: S.tower && S.tower.floor, per: players.map(q => ({ cls: q.cls, kills: q.kills, lv: q.level, w: Object.keys(q.weapons).length, picking: !!q.lvPick, x: Math.round(q.x), y: Math.round(q.y) })) }))));
  for (const b of Object.values(browsers)) await b.close();
  const L0 = res[0].log, same = res.every(r => r.log.length === L0.length && r.log.every((x, i) => x[1] === L0[i][1]));
  const firstDiff = (() => { for (let i = 0; i < L0.length; i++) if (res.some(r => !r.log[i] || r.log[i][1] !== L0[i][1])) return L0[i][0]; return null; })();
  console.log(`${mix ? kinds.join('+') : name} ${net}  ${classes.join('+')}  フレーム ${res.map(r => r.f).join(' / ')}  ハッシュ ${L0.length}回 ${same ? 'すべて同じ' : '違う(最初は ' + firstDiff + ')'}  最後 ${L0.length ? L0[L0.length - 1][1].toString(16) : '-'}  ${((Date.now() - t0) / 1000).toFixed(1)}秒`);
  console.log('  階 ' + res[0].floor + '  ' + res[0].per.map(q => `${q.cls} 撃破${q.kills} Lv${q.lv} 武器${q.w}${q.picking ? "(選択中)" : ""}`).join('  ') + '  待った回数 ' + res.map(r => r.stalls).join(' / '));
  for (const r of res) if (r.desync) console.log(`  ページ ${r.pid}: 同期がずれた フレーム ${r.desync.f} ${r.desync.hashes.map(h => h.toString(16)).join(' / ')}`);
  for (const e of errs.slice(0, 5)) console.log('  例外 ' + e);
})().catch(e => { console.error(e); process.exit(1); });
