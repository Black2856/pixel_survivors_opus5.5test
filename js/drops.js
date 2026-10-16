// drops.js — ジェム・ドロップ
'use strict';

// ============================================================
// ジェム・ドロップ
// ============================================================
const gemTier = v => v >= 60 ? 3 : v >= 20 ? 2 : v >= 5 ? 1 : 0;
function dropGem(x, y, v) {
  if (gems.length > 380) { const g = gems[(Math.random() * 40) | 0]; g.v += v; g.tier = gemTier(g.v); return; }
  gems.push({ x, y, v, tier: gemTier(v), t: rand(0, 3), home: false, sp: 0, z: 0, vz: -rand(40, 70), vx: rand(-20, 20), vy: rand(-20, 20) });
}
// アイテムの出現率(装備宝箱は除く): カオス強化「枯れた大地」で下がり、アイテム出現率(永続ツリー)で上がる。1 を超えた分は、その確率でもう1つ出る
//   タワーは宝箱を出さず、その代わりに大金(DATA.tower.chestGold を 15枚に分けたコイン。宝箱と同じく枯れた大地では減らない)
function dropItem(kind, x, y, val = 0) {
  if (kind === 'chest' && S.mode === 'tower') { for (let i = 0; i < 15; i++) pushDrop('coin', x, y, DATA.tower.chestGold / 15); return; }
  let n = 1;
  if (kind !== 'chest') { const k = (1 - CHAOS.loot) * (1 + ((P.stats && P.stats.v.itemRate) || 0)); n = Math.floor(k) + (Math.random() < k - Math.floor(k) ? 1 : 0); }
  for (let i = 0; i < n; i++) pushDrop(kind, x, y, val);
}
const pushDrop = (kind, x, y, val) => drops.push({ kind, x, y, val, t: 0, z: 0, vz: -rand(60, 110), vx: rand(-35, 35), vy: rand(-25, 25), home: false, sp: 0 });
function addGold(v) {
  const g = Math.max(1, Math.round(v * P.goldMul));
  P.gold += g; S.hudDirty = true;
  return g;
}

function bounce(o, dt) {
  if (o.vz === 0 && o.z === 0) return;
  o.vz += 260 * dt; o.z += o.vz * dt;
  o.x += o.vx * dt; o.y += o.vy * dt;
  if (o.z >= 0) { o.z = 0; if (Math.abs(o.vz) > 30) { o.vz *= -0.4; o.vx *= 0.5; o.vy *= 0.5; } else { o.vz = 0; o.vx = o.vy = 0; } }
}

function updGems(dt) {
  if (players.length > 1) return updGemsCoop(dt);
  P.gemStreakT -= dt;
  if (P.gemStreakT <= 0) P.gemStreak = 0;
  const mr2 = P.magnet * P.magnet;
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.t += dt;
    bounce(g, dt);
    const dd = d2(g.x, g.y, P.x, P.y);
    if (!g.home && dd < mr2) { g.home = true; g.sp = -40; }
    if (g.home) {
      g.sp += 520 * dt;
      const a = Math.atan2(P.y - g.y, P.x - g.x);
      g.x += Math.cos(a) * g.sp * dt; g.y += Math.sin(a) * g.sp * dt;
    }
    if (dd < 36) {
      gems.splice(i, 1);
      P.gemStreak++; P.gemStreakT = 0.6;
      AudioMan.gem(P.gemStreak);
      const cols = [['#4cc3ff', '#e0fbff'], ['#5dff8a', '#eaffea'], ['#ff5d73', '#ffe0e6'], ['#ffd23f', '#fffbe0']][g.tier];
      burst(P.x, P.y - 4, 3, cols, { sp: 35, glow: true, life: 0.35 });
      gainXP(g.v);
      clsOnPickup('gem'); // クラスの「アイテムを拾った」(アストロマンサー: 質量)
    }
  }
}

function updDrops(dt) {
  if (players.length > 1) return updDropsCoop(dt);
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t += dt;
    bounce(d, dt);
    const dd = d2(d.x, d.y, P.x, P.y);
    if (d.kind === 'coin' && d.t > 0.4 && (d.home || dd < P.magnet * P.magnet)) {
      d.home = true; d.sp += 500 * dt;
      const a = Math.atan2(P.y - d.y, P.x - d.x);
      d.x += Math.cos(a) * d.sp * dt; d.y += Math.sin(a) * d.sp * dt;
    }
    if (dd > 100 || d.t < 0.35) continue;
    drops.splice(i, 1);
    clsOnPickup(d.kind);
    switch (d.kind) {
      case 'coin': { const g = addGold(d.val); addFloat(P.x, P.y - 12, '+' + g, '#ffcc33'); AudioMan.coin(); break; }
      case 'meat': if (P.stats.v.foodCleanse) cleansePlayer(); heal(P.maxhp * DATA.player.food * P.foodMul); break; // 最大HP の 20%(食べ物の効果で増える)。デバフ解除は回復の前
      case 'magnet':
        for (const g of gems) { g.home = true; g.sp = Math.max(g.sp, 60); }
        for (const c of drops) if (c.kind === 'coin') c.home = true;
        addRing(P.x, P.y, 200, '#6ee7ff', { w: 2, life: 0.6 }); shockAt(P.x, P.y, 0.8);
        UI.announce('MAGNET!', ''); AudioMan.select();
        break;
      case 'bomb': {
        screenFlash(0.85, '#fff4d0'); shockAt(P.x, P.y, 2.5, 0.7); shake(12); hitstop(0.08); AudioMan.boom();
        addFlash(P.x, P.y, 300, '#ffb347', 0.8);
        for (const e of enemies) if (!e.dead && !e.prop && onScreen(e.x, e.y, 10)) { if (e.boss || e.obj || e.owner || e.elite) hitEnemy(e, 250, { src: 'bomb', noCrit: true, noKill: e.elite, item: true }); else killEnemy(e, {}); } // ボス・ボスの出した物は一撃では壊れない / エリートは倒れない(HP 1 で残る)
        UI.announce('BOOM!!', '');
        break;
      }
      case 'chest': UI.openChest(openEquipChest()); break;
    }
  }
}

// ============================================================
// 協力プレイの拾う物(claudedocs/coop.md #6)。床の物は 1つで、番号の小さい人から順に見て先に届いた人が拾う
//   ジェムとゴールドは誰かが拾うと全員が得る(倍率は各自。倒れている人も)/ 肉・磁石は拾った人だけ(磁石は拾った人へ集める)
//   拾った時のクラスの効果(アストロマンサーの吸積)は拾った人だけ。吸い寄せは、吸い寄せる範囲に先に入った人へ向かう(to)
// ============================================================
const firstNear = (o, r2, al) => { for (const p of al) if (d2(o.x, o.y, p.x, p.y) < r2(p)) return p; return null; };
const homeTo = (o, p, dt, acc) => { o.sp += acc * dt; const a = Math.atan2(p.y - o.y, p.x - o.x); o.x += Math.cos(a) * o.sp * dt; o.y += Math.sin(a) * o.sp * dt; };
function updGemsCoop(dt) {
  for (const p of players) { p.gemStreakT -= dt; if (p.gemStreakT <= 0) p.gemStreak = 0; }
  const al = players.filter(p => !p.dead);
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.t += dt;
    bounce(g, dt);
    const by = firstNear(g, () => 36, al);
    if (!g.to || g.to.dead) { const p = firstNear(g, q => q.magnet * q.magnet, al); if (p) { g.to = p; if (!g.home) { g.home = true; g.sp = -40; } } }
    if (g.home && g.to && !g.to.dead) homeTo(g, g.to, dt, 520);
    if (!by) continue;
    gems.splice(i, 1);
    for (const p of players) withPlayer(p, () => gainXP(g.v)); // 全員が得る(経験値の倍率は各自)
    withPlayer(by, () => {
      P.gemStreak++; P.gemStreakT = 0.6;
      AudioMan.gem(P.gemStreak);
      const cols = [['#4cc3ff', '#e0fbff'], ['#5dff8a', '#eaffea'], ['#ff5d73', '#ffe0e6'], ['#ffd23f', '#fffbe0']][g.tier];
      burst(P.x, P.y - 4, 3, cols, { sp: 35, glow: true, life: 0.35 });
      clsOnPickup('gem');
    });
  }
}
function updDropsCoop(dt) {
  const al = players.filter(p => !p.dead);
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t += dt;
    bounce(d, dt);
    if (d.kind === 'coin' && d.t > 0.4) {
      if (!d.to || d.to.dead) { const p = firstNear(d, q => (d.home ? Infinity : q.magnet * q.magnet), al); if (p) { d.to = p; d.home = true; } }
      if (d.home && d.to) homeTo(d, d.to, dt, 500);
    }
    if (d.t < 0.35) continue;
    const by = firstNear(d, () => 100, al);
    if (!by) continue;
    drops.splice(i, 1);
    withPlayer(by, () => clsOnPickup(d.kind));
    switch (d.kind) {
      case 'coin': { // 全員が得る(ゴールドの倍率は各自)。数字は拾った人の所に、拾った人の分
        let shown = 0;
        for (const p of players) withPlayer(p, () => { const g = addGold(d.val); if (p === by) shown = g; });
        addFloat(by.x, by.y - 12, '+' + shown, '#ffcc33'); AudioMan.coin(); break;
      }
      case 'magnet':
        for (const g of gems) { g.home = true; g.to = by; g.sp = Math.max(g.sp, 60); }
        for (const c of drops) if (c.kind === 'coin') { c.home = true; c.to = by; }
        addRing(by.x, by.y, 200, '#6ee7ff', { w: 2, life: 0.6 }); withPlayer(by, () => shockAt(P.x, P.y, 0.8));
        AudioMan.select();
        break;
      default: withPlayer(by, () => { // 肉(拾った人だけ回復)など
        if (d.kind === 'meat') { if (P.stats.v.foodCleanse) cleansePlayer(); heal(P.maxhp * DATA.player.food * P.foodMul); }
      });
    }
  }
}
