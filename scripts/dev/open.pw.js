// open.pw.js — Playwright の browser_run_code_unsafe に filename で渡す: キャッシュを消してゲームを開き、harness.js を読み込んで T.init()
//   先に python -m http.server 8765 --bind 127.0.0.1(リポジトリの直下で)。ビルドした版を見るときは dist の下で別のポートに立てて URL を変える
async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  await page.goto('http://127.0.0.1:8765/?t=' + Date.now());
  await page.waitForFunction(() => typeof startRun === 'function' && typeof DATA === 'object');
  await page.addScriptTag({ url: '/scripts/dev/harness.js?t=' + Date.now() });
  return await page.evaluate(() => T.init());
}
