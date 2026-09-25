// main.js — 画面遷移 / メイン更新 / カメラ / メインループ
'use strict';

// ============================================================
// 画面遷移
// ============================================================
function startRun() {
  AudioMan.unlock();
  initRun();
  cam.fx = P.x - GFX.VW / 2; cam.fy = P.y - GFX.VH / 2;
  groundCache.clear();
  UI.show(UI.$('hud'));
  AudioMan.playMusic('field1');
  UI.startPick();
  screenFlash(0.5);
  shockAt(P.x, P.y, 1.5);
}
function pauseGame() { if (state !== 'play') return; state = 'pause'; UI.pause(true); AudioMan.pauseMusic(); }
function resumeGame() { if (state !== 'pause') return; state = 'play'; UI.pause(false); AudioMan.resumeMusic(); }
function endRun(win) {
  const earned = S.gold + Math.floor(S.kills / 25);
  META.gold += earned; META.runs++;
  if (S.time > META.best.time) META.best.time = S.time;
  META.best.kills = Math.max(META.best.kills, S.kills);
  META.best.level = Math.max(META.best.level, P.level);
  saveMeta();
  state = win ? 'victory' : 'over';
  if (!win) AudioMan.stopMusic(1.5);
  UI.result(win, earned);
}
function startEndless() {
  // 勝利後もそのまま続行(ゴールドはリザルト時に精算済みなのでリセット)
  S.gold = 0; S.loop = 2; S.schedIdx = 0; S.loopStart = S.time; setStage(1);
  UI.show(UI.$('hud')); UI.pause(false);
  state = 'play';
  UI.announce('ENDLESS MODE', 'LOOP 2 — 敵はさらに強くなる');
  AudioMan.playMusic('field1');
}
function goTitle() {
  state = 'title';
  demoWorld();
  UI.title();
  AudioMan.playMusic('title');
}
function demoWorld() {
  initRun();
  S.demo = true;
  groundCache.clear();
}

function onKey(e) {
  if (e.code === 'KeyM') AudioMan.toggleMute();
  if (e.code === 'Escape') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); }
  if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) startRun();
  else if ((state === 'over' || state === 'victory') && e.code === 'KeyR') startRun();
  else if (state === 'victory' && e.code === 'Enter') startEndless();
  UI.onKey(e);
}

// ============================================================
// メイン更新
// ============================================================
function update(rdt) {
  if (S.freeze > 0) { S.freeze -= rdt; return; }
  if (S.tsBack > 0) S.tsBack -= rdt; else S.ts = Math.min(1, S.ts + rdt * 1.5);
  const dt = rdt * S.ts;
  if (!P.dead) { S.time += dt; updPlayer(dt); }
  buildGrid();
  if (!P.dead) updWeapons(dt);
  updProjs(dt);
  updZones(dt);
  updEnemies(dt);
  updEprojs(dt);
  if (!P.dead) { updGems(dt); updDrops(dt); updSpawner(dt); }
  updFx(dt);
  S.comboT -= dt;
  if (S.comboT <= 0 && S.combo > 0) S.combo = 0;

  // レベルアップ演出 → 選択画面
  if (S.pendingLv > 0 && !P.dead && state === 'play') {
    if (S.lvFx <= 0) {
      S.lvFx = 0.4;
      AudioMan.levelup(); slowmo(0.15, 0.3);
      screenFlash(0.35, '#ffd23f'); shockAt(P.x, P.y, 1.2, 1.1);
      addRing(P.x, P.y, 60, '#ffd23f', { w: 3, life: 0.4 }); addFlash(P.x, P.y, 140, '#ffd23f', 0.5);
      for (let i = 0; i < 40; i++) part(P.x + rand(-8, 8), P.y + rand(-2, 6), rand(-15, 15), -rand(60, 160), rand(0.5, 1), pick(['#ffd23f', '#fff6c8', '#ff8c42']), { glow: true, drag: 1.5 });
    }
    S.lvFx -= rdt;
    if (S.lvFx <= 0) { S.pendingLv--; UI.levelUp(); }
  }
  if (P.dead) { S.deathT -= rdt; if (S.deathT <= 0) endRun(false); }
  if (S.victoryT > 0) { S.victoryT -= rdt; if (S.victoryT <= 0) { AudioMan.playMusic('title'); endRun(true); } }
}

function updCam(dt) {
  if (S.demo) { cam.fx = (cam.fx || 0) + dt * 10; cam.fy = (cam.fy || 0) + dt * 4; }
  else {
    const [mx, my] = P.dead ? [0, 0] : moveInput();
    const tx = P.x - GFX.VW / 2 + mx * 14, ty = P.y - GFX.VH / 2 + my * 10;
    const k = 1 - Math.exp(-6 * dt);
    cam.fx += (tx - cam.fx) * k; cam.fy += (ty - cam.fy) * k;
  }
  cam.shake = Math.max(0, cam.shake - dt * 30);
  const s = cam.shake;
  cam.x = Math.round(cam.fx + rand(-s, s)); cam.y = Math.round(cam.fy + rand(-s, s));
  GFX.fx.aberr = Math.max(GFX.fx.aberr, s * 0.04);
}

// ============================================================
// メインループ
// ============================================================
let lastT = performance.now();
function frame(ts) {
  const rdt = Math.min(1 / 30, (ts - lastT) / 1000);
  lastT = ts;
  if (state === 'play') update(rdt);
  else if (state === 'over' || state === 'victory') updFx(rdt * 0.3);
  if (state !== 'pause' && state !== 'levelup' && state !== 'chest') updCam(rdt);
  GFX.updateFx(rdt);
  render();
  GFX.present();
  UI.hud(rdt);
  requestAnimationFrame(frame);
}

demoWorld();
UI.title();
// 初回操作でタイトル曲を再生(自動再生制限対策)
addEventListener('pointerdown', () => { if (state === 'title' && !AudioMan.musicName) AudioMan.playMusic('title'); });
addEventListener('keydown', () => { if (state === 'title' && !AudioMan.musicName) AudioMan.playMusic('title'); });
requestAnimationFrame(frame);
