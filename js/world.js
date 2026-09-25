// world.js — プレイヤー / ステータス / 武器 / ダメージ / 敵・ボス / ドロップ / スポナー / 報酬ロジック
'use strict';

const ECOL = {
  zombie: ['#7fb069', '#6b5a8e'], bat: ['#8a4fc0', '#2a1838'], slime: ['#4fd6a8', '#d8fff2'], slimelet: ['#4fd6a8', '#d8fff2'],
  skeleton: ['#e8e6da', '#6b6a60'], archer: ['#e8e6da', '#35523d'], ghost: ['#c6f7f2', '#8fd9e0'], brute: ['#c46a4a', '#6b4a2a'],
  imp: ['#ff6a3d', '#8a2a4a'], goblin: ['#8fd06a', '#ffcc33'], brazier: ['#ff6a2a', '#ffc34a'],
};
const xpFor = l => Math.floor(4 + l * 2.6 + Math.pow(l, 1.72));

// ============================================================
// ラン初期化 / ステータス
// ============================================================
function initRun() {
  S = {
    time: 0, kills: 0, totalDmg: 0, dmgBy: {}, stage: 1, loop: 1, loopStart: 0,
    combo: 0, comboT: 0, bestCombo: 0, gemStreak: 0, gemStreakT: 0,
    freeze: 0, ts: 1, tsBack: 0, schedIdx: 0, spawnT: 0, spawnCfg: null,
    eliteT: 95, goblinT: 70, propT: 2, boss: null, pendingLv: 0, lvFx: 0,
    rerolls: 2 + metaLv('reroll'), weaponSlots: 4, passiveSlots: 4, revive: metaLv('revive') > 0,
    gold: 0, deathT: 0, victoryT: 0, hudDirty: true, won: false,
  };
  P = {
    x: 0, y: 0, hp: 0, maxhp: 100, level: 1, xp: 0, xpNext: xpFor(1), weapons: {}, passives: {}, art: {},
    ifr: 0, facing: 1, animT: 0, moving: false, dashT: 0, dashCd: 0, dashDir: [1, 0], hurtT: 0, dead: false,
  };
  enemies = []; projs = []; eprojs = []; gems = []; drops = []; props = [];
  parts = []; floats = []; rings = []; zones = []; slashes = []; bolts = []; warns = []; flashes = [];
  recalc();
  P.hp = P.maxhp;
}

function recalc() {
  const pv = P.passives, af = P.art;
  P.speed = DATA.player.speed * (1 + 0.08 * (pv.boots || 0)) * (1 + 0.04 * metaLv('swift')) * (af.aegis ? 0.75 : 1);
  P.maxhp = Math.round((DATA.player.hp + 20 * (pv.heart || 0) + 10 * metaLv('vital') + (af.aegis ? 100 : 0)) * (af.glass ? 0.6 : 1));
  P.hp = Math.min(P.hp, P.maxhp);
  P.magnet = DATA.player.magnet * (1 + 0.3 * (pv.magnet || 0));
  P.cdMul = Math.pow(0.93, pv.tome || 0) * (1 - 0.03 * metaLv('haste')) * (af.clock ? 0.8 : 1);
  P.regen = 0.5 * (pv.regen || 0);
  P.area = 1 + 0.1 * (pv.area || 0);
  P.armor = (pv.armor || 0) + (af.aegis ? 3 : 0);
  P.amount = pv.dup || 0;
  P.xpMul = (1 + 0.06 * metaLv('growth')) * (af.pact ? 1.5 : 1);
  P.goldMul = (1 + 0.12 * metaLv('greed')) * (af.greed ? 2 : 1);
  S.hudDirty = true;
}
function dmgMul() {
  let m = 1 + 0.1 * (P.passives.power || 0) + 0.05 * metaLv('might');
  if (P.art.frenzy) m += 1 - P.hp / P.maxhp;
  return m * (P.art.glass ? 1.5 : 1);
}
const critRate = () => 0.05 + 0.06 * (P.passives.lens || 0);
const wst = k => { const w = P.weapons[k]; return w.evo ? DATA.weapons[k].evo.st : DATA.weapons[k].lv[w.lv - 1]; };
const enemyMul = () => (1 + (S.loop - 1) * 0.6) * (P.art.pact ? 1.2 : 1);

function heal(n, silent) {
  const before = P.hp;
  P.hp = Math.min(P.maxhp, P.hp + n);
  if (!silent && P.hp - before >= 1) {
    addFloat(P.x, P.y - 12, '+' + Math.round(P.hp - before), '#5dff8a');
    burst(P.x, P.y, 8, ['#5dff8a', '#b0ffb0'], { sp: 30, up: 30, glow: true });
    AudioMan.heal();
  }
}

// ============================================================
// プレイヤー
// ============================================================
function updPlayer(dt) {
  const [mx, my] = moveInput();
  P.moving = mx !== 0 || my !== 0;
  if (P.moving) { P.dashDir = [mx, my]; if (mx) P.facing = mx > 0 ? 1 : -1; }
  P.dashCd -= dt;
  if ((keys.Space || keys._touchDash) && P.dashCd <= 0) {
    keys._touchDash = false;
    P.dashT = DATA.player.dashTime; P.dashCd = DATA.player.dashCd;
    AudioMan.dash(); shake(1);
    burst(P.x, P.y + 5, 10, ['#9ff7ff', '#ffffff'], { sp: 50, glow: true });
    addRing(P.x, P.y, 14, '#9ff7ff', { life: 0.25 });
  }
  keys._touchDash = false;
  let sp = P.speed;
  let [dx, dy] = [mx, my];
  if (P.dashT > 0) {
    P.dashT -= dt; sp = DATA.player.dashSpeed; [dx, dy] = P.dashDir;
    if (Math.random() < 0.9) P.after = (P.after || []).concat([{ x: P.x, y: P.y, t: 0, f: P.facing }]).slice(-6);
  }
  P.x += dx * sp * dt; P.y += dy * sp * dt;
  if (P.after) for (const a of P.after) a.t += dt;
  if (P.after) P.after = P.after.filter(a => a.t < 0.25);
  P.animT += dt * (P.moving ? 1 : 0.35);
  P.ifr -= dt; P.hurtT -= dt;
  if (P.regen > 0 && P.hp < P.maxhp) P.hp = Math.min(P.maxhp, P.hp + P.regen * dt);
  if (P.moving && Math.random() < dt * 10) part(P.x + rand(-2, 2), P.y + 6, rand(-6, 6), rand(-8, -2), 0.35, '#8a8098', { drag: 4 });
  GFX.fx.lowhp = lerp(GFX.fx.lowhp, P.hp / P.maxhp < 0.3 ? 1 : 0, dt * 3);
}

function hurtPlayer(dmg) {
  if (P.ifr > 0 || P.dashT > 0 || P.dead || state !== 'play') return;
  dmg = Math.max(1, Math.round(dmg - P.armor));
  P.hp -= dmg; P.ifr = 0.5; P.hurtT = 0.12;
  GFX.fx.hurt = 1; GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.9);
  shake(4); AudioMan.hurt();
  addFloat(P.x, P.y - 10, String(dmg), '#ff4a5a', 1);
  burst(P.x, P.y, 10, ['#ff4a5a', '#ffffff', '#8a1a2a'], { sp: 70 });
  S.hudDirty = true;
  if (P.hp <= 0) playerDown();
}

function playerDown() {
  if (S.revive) {
    S.revive = false;
    P.hp = P.maxhp * 0.5; P.ifr = 2.5;
    screenFlash(1, '#ffd23f'); shockAt(P.x, P.y, 3, 0.7); hitstop(0.2); slowmo(0.2, 1.2); shake(14);
    burst(P.x, P.y, 90, ['#ffd23f', '#ff8c42', '#ffffff'], { sp: 180, glow: true, life: 1.2 });
    addRing(P.x, P.y, 140, '#ffd23f', { w: 3, life: 0.7 });
    for (const e of enemies) if (!e.dead && d2(e.x, e.y, P.x, P.y) < 140 * 140) {
      if (e.boss) hitEnemy(e, 300, { src: 'revive', noCrit: true }); else killEnemy(e, {});
    }
    UI.announce('REVIVE!!', '不死鳥の加護が発動した');
    AudioMan.evolve();
    return;
  }
  P.dead = true; P.hp = 0;
  S.deathT = 1.8; slowmo(0.25, 2.5);
  screenFlash(0.8, '#ff3b5c'); shockAt(P.x, P.y, 2, 0.6); shake(12);
  burst(P.x, P.y, 80, ['#4c3a86', '#e8434f', '#9ff7ff', '#ffffff'], { sp: 140, glow: true, life: 1.4 });
  AudioMan.death(); AudioMan.stopMusic(2);
}

function gainXP(v) {
  P.xp += v * P.xpMul;
  while (P.xp >= P.xpNext) {
    P.xp -= P.xpNext; P.level++; P.xpNext = xpFor(P.level); S.pendingLv++;
  }
  S.hudDirty = true;
}

// ============================================================
// 武器
// ============================================================
function addWeapon(k) {
  const w = P.weapons[k];
  if (!w) P.weapons[k] = { lv: 1, cd: 0.3, evo: false, t: 0, q: [], tick: 0 };
  else w.lv = Math.min(5, w.lv + 1);
  S.hudDirty = true;
}
function canHit(e, key, cd) {
  const h = e.hc || (e.hc = {});
  if ((h[key] || 0) > S.time) return false;
  h[key] = S.time + cd;
  return true;
}
function randomTargets(n) {
  const vis = enemies.filter(e => !e.dead && !e.hidden && onScreen(e.x, e.y, -6));
  return shuffle(vis).slice(0, n);
}
function aimAt(maxD) {
  const t = nearestEnemy(P.x, P.y, maxD);
  return t ? Math.atan2(t.y - P.y, t.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
}

function fire(kind, x, y, ang, spd, o) {
  projs.push(Object.assign({ kind, x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, ang, t: 0, life: 1.5, r: 3, pierce: 0, hit: new Set() }, o));
}

function updWeapons(dt) {
  for (const k in P.weapons) {
    const w = P.weapons[k], st = wst(k);
    w.t += dt;
    w.cd -= dt;
    const n = (st.count || 1) + P.amount;
    const mir = P.art.mirror ? 0.75 : 1;
    switch (k) {
      case 'bolt':
        if (w.cd <= 0) {
          const t = nearestEnemy(P.x, P.y, 180);
          if (!t) { w.cd = 0.1; break; }
          w.cd = st.cd * P.cdMul;
          const base = Math.atan2(t.y - P.y, t.x - P.x);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.13;
            const o = { dmg: st.dmg * mir, pierce: st.pierce, life: 1.5, src: k, home: w.evo, col: w.evo ? '#ff9bf5' : '#7ad7ff' };
            fire('bolt', P.x, P.y, a, st.speed, o);
            if (P.art.mirror) fire('bolt', P.x, P.y, a + Math.PI, st.speed, Object.assign({}, o, { hit: new Set() }));
          }
          burst(P.x + Math.cos(base) * 6, P.y + Math.sin(base) * 6, 4, ['#7ad7ff', '#ffffff'], { sp: 40, glow: true, life: 0.25 });
          AudioMan.shoot();
        }
        break;

      case 'blade': {
        const rings = w.evo ? [[n, st.radius * P.area, 1], [Math.max(3, n - 3), st.radius * P.area * 0.55, -1.4]] : [[n, st.radius * P.area, 1]];
        w.blades = [];
        rings.forEach(([cnt, rad, dir], ri) => {
          for (let i = 0; i < cnt; i++) {
            const a = w.t * st.rot * dir + (TAU / cnt) * i;
            const bx = P.x + Math.cos(a) * rad, by = P.y + Math.sin(a) * rad;
            w.blades.push({ x: bx, y: by, a });
            forEachNear(bx, by, 5, e => {
              if (canHit(e, 'blade' + ri, 0.35)) hitEnemy(e, st.dmg, { src: k, ang: a + Math.PI / 2 * dir, kb: 45 });
            });
          }
        });
        break;
      }

      case 'thunder':
        if (w.cd <= 0) {
          w.cd = st.cd * P.cdMul;
          const ts = randomTargets((st.strikes || 1) + P.amount);
          if (!ts.length) { w.cd = 0.2; break; }
          ts.forEach((t, i) => setTimeout(() => state === 'play' && strike(t.x, t.y, st, w.evo), i * 70));
        }
        break;

      case 'aura': {
        const R = st.radius * P.area;
        w.R = R;
        w.tick -= dt;
        if (w.tick <= 0) {
          w.tick = st.tick;
          let healed = 0;
          forEachNear(P.x, P.y, R, e => {
            hitEnemy(e, st.dmg, { src: k, noNum: Math.random() < 0.5, ang: Math.atan2(e.y - P.y, e.x - P.x), kb: 6 });
            if (w.evo) e.slowT = 0.6;
            if ((P.art.grail || w.evo) && healed < 3) { heal(P.art.grail ? 0.4 : 0.25, true); healed++; }
          });
        }
        break;
      }

      case 'axe':
        if (w.cd <= 0) {
          w.cd = st.cd * P.cdMul;
          for (let i = 0; i < n; i++) {
            const dir = (i % 2 ? -1 : 1) * P.facing;
            const o = { dmg: st.dmg * mir, pierce: 999, life: 2.4, src: k, g: 300, spin: dir * 12, r: w.evo ? 9 : 5, big: w.evo };
            projs.push(Object.assign({ kind: 'axe', x: P.x, y: P.y - 4, vx: dir * rand(20, 55) + i * 8 * dir, vy: -rand(150, 185), ang: 0, t: 0, hit: new Set() }, o));
            if (P.art.mirror) projs.push(Object.assign({ kind: 'axe', x: P.x, y: P.y - 4, vx: -dir * rand(20, 55), vy: -rand(150, 185), ang: 0, t: 0, hit: new Set() }, o));
          }
          AudioMan.slash();
        }
        break;

      case 'wisp':
        if (w.cd <= 0) {
          w.cd = st.cd * P.cdMul;
          for (let i = 0; i < n; i++) {
            const a = rand(0, TAU);
            fire('wisp', P.x, P.y, a, 90, { dmg: st.dmg, pierce: st.pierce, life: 3.2, src: k, homing: 5.5, speed: 110, col: '#9dffcf', soul: w.evo });
          }
        }
        break;

      case 'fire':
        if (w.cd <= 0) {
          w.cd = st.cd * P.cdMul;
          const base = aimAt(160);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.22;
            const o = { dmg: st.dmg * mir, pierce: 999, life: 0.95, src: k, burn: st.burn, r: 4, boom: w.evo ? 6 : 0, col: '#ff8a3d' };
            fire('fire', P.x, P.y, a, 135, o);
            if (P.art.mirror) fire('fire', P.x, P.y, a + Math.PI, 135, Object.assign({}, o, { hit: new Set() }));
          }
          AudioMan.fire();
        }
        break;

      case 'blizzard':
        if (w.cd <= 0) {
          w.cd = st.cd * P.cdMul;
          const ts = randomTargets(1 + P.amount);
          for (let i = 0; i < 1 + P.amount; i++) {
            const t = ts[i];
            const x = t ? t.x : P.x + rand(-40, 40), y = t ? t.y : P.y + rand(-40, 40);
            zones.push({ kind: 'blizz', x, y, r: st.radius * P.area, t: 0, dur: st.dur, tick: 0, dmg: st.dmg, evo: w.evo });
          }
          AudioMan.blizz();
        }
        break;

      case 'bhole':
        if (w.cd <= 0) {
          w.cd = st.cd * P.cdMul;
          const ts = randomTargets(1 + P.amount);
          for (let i = 0; i < 1 + P.amount; i++) {
            const t = ts[i];
            const tx = t ? t.x : P.x + P.facing * 70, ty = t ? t.y : P.y;
            const a = Math.atan2(ty - P.y, tx - P.x), dist = Math.hypot(tx - P.x, ty - P.y);
            fire('orbShot', P.x, P.y, a, 160, { life: dist / 160, pierce: 999, noHit: true, src: k, col: '#c78bff', onEnd: p => spawnHole(p.x, p.y, st, w.evo) });
          }
        }
        break;

      case 'katana':
        if (w.cd <= 0) {
          w.cd = st.cd * P.cdMul;
          const base = aimAt(st.aoe * P.area + 20);
          for (let i = 0; i < n; i++) w.q.push({ t: i * 0.09, a: base + (i % 2 ? Math.PI : 0) + (i >> 1) * 0.5, flip: i % 2 });
        }
        for (let i = w.q.length - 1; i >= 0; i--) {
          const s = w.q[i];
          s.t -= dt;
          if (s.t <= 0) { w.q.splice(i, 1); doSlash(s.a, st, w.evo, s.flip); }
        }
        break;
    }
  }
}

function strike(x, y, st, evo) {
  const R = st.aoe * P.area;
  const hitSet = new Set();
  forEachNear(x, y, R, e => { hitSet.add(e); hitEnemy(e, st.dmg, { src: 'thunder', ang: Math.atan2(e.y - y, e.x - x), kb: 30, col: '#fff27a' }); });
  bolts.push({ x0: x + rand(-20, 20), y0: cam.y - 10, x1: x, y1: y, t: 0, life: 0.22, w: 2 });
  addFlash(x, y, 70, '#fff27a', 0.3);
  addRing(x, y, R, '#fff27a', { life: 0.3 });
  burst(x, y, 14, ['#fff27a', '#ffffff', '#7ad7ff'], { sp: 90, glow: true, life: 0.4 });
  shake(2); AudioMan.zap();
  if (evo) {
    let cur = { x, y };
    for (let c = 0; c < 4; c++) {
      let best = null, bd = 70 * 70;
      for (const e of enemies) {
        if (e.dead || e.hidden || hitSet.has(e)) continue;
        const dd = d2(cur.x, cur.y, e.x, e.y);
        if (dd < bd) { bd = dd; best = e; }
      }
      if (!best) break;
      hitSet.add(best);
      bolts.push({ x0: cur.x, y0: cur.y, x1: best.x, y1: best.y, t: 0, life: 0.25, w: 1 });
      hitEnemy(best, st.dmg * 0.7, { src: 'thunder', col: '#fff27a' });
      addFlash(best.x, best.y, 30, '#fff27a', 0.2);
      cur = best;
    }
  }
}

function spawnHole(x, y, st, evo) {
  zones.push({ kind: 'hole', x, y, r: st.radius * P.area, t: 0, dur: st.dur, tick: 0, dmg: st.dmg, pull: st.pull, evo });
  AudioMan.hole(); shockAt(x, y, 0.8, 0.5);
}

function doSlash(a, st, evo, flip) {
  const R = st.aoe * P.area;
  const dirs = evo ? [a, a + Math.PI / 2] : [a];
  let drained = 0;
  for (const da of dirs) {
    slashes.push({ x: P.x, y: P.y, a: da, r: R, t: 0, life: 0.2, flip, evo });
    forEachNear(P.x, P.y, R, e => {
      let diff = Math.atan2(e.y - P.y, e.x - P.x) - da;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) > 1.05) return;
      hitEnemy(e, st.dmg, { src: 'katana', ang: da, kb: 55, col: '#ff8a9a' });
      if (evo && drained < 3) { heal(0.5, true); drained++; }
    });
  }
  AudioMan.slash();
}

// ---------- 弾 ----------
function updProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i];
    p.t += dt;
    if (p.homing || p.home) {
      const tg = nearestEnemy(p.x, p.y, 120, null);
      if (tg && !p.hit.has(tg)) {
        const want = Math.atan2(tg.y - p.y, tg.x - p.x);
        let cur = Math.atan2(p.vy, p.vx), diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
        cur += clamp(diff, -(p.homing || 4) * dt, (p.homing || 4) * dt);
        const sp = p.speed || Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(cur) * sp; p.vy = Math.sin(cur) * sp;
      }
    }
    if (p.g) p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.spin) p.ang += p.spin * dt;
    // 軌跡パーティクル
    if (p.kind === 'bolt' || p.kind === 'wisp' || p.kind === 'orbShot') part(p.x, p.y, rand(-5, 5), rand(-5, 5), 0.25, p.col, { glow: true, drag: 5 });
    if (p.kind === 'fire' && Math.random() < 0.8) part(p.x + rand(-2, 2), p.y + rand(-2, 2), rand(-10, 10), rand(-25, -5), 0.4, pick(['#ff6a2a', '#ffc34a', '#b8261a']), { glow: true, sz: pick([1, 2]) });
    if (p.t >= p.life) { if (p.onEnd) p.onEnd(p); projs.splice(i, 1); continue; }
    if (p.noHit) continue;
    let dead = false;
    forEachNear(p.x, p.y, p.r, e => {
      if (p.hit.has(e.id)) return;
      p.hit.add(e.id);
      const ang = Math.atan2(p.vy, p.vx);
      hitEnemy(e, p.dmg, { src: p.src, ang, kb: p.kind === 'axe' ? 50 : 22, col: p.col });
      if (p.burn) { e.burn = Math.max(e.burn || 0, p.burn); e.burnT = 3; }
      if (p.boom > 0) {
        p.boom--;
        const bx = e.x, by = e.y;
        forEachNear(bx, by, 16 * P.area, e2 => { if (e2 !== e) hitEnemy(e2, p.dmg * 0.6, { src: p.src, noNum: true, col: '#ff8a3d' }); });
        burst(bx, by, 12, ['#ff6a2a', '#ffc34a', '#fff6c8'], { sp: 70, glow: true });
        addFlash(bx, by, 40, '#ff8a3d', 0.2); addRing(bx, by, 16 * P.area, '#ffc34a', { life: 0.2 });
      }
      if (p.soul && e.dead) heal(1, true);
      if (p.pierce-- <= 0) {
        dead = true;
        burst(p.x, p.y, 5, [p.col || '#fff', '#ffffff'], { sp: 50, glow: true, life: 0.3 });
        return false;
      }
    });
    if (dead) { projs.splice(i, 1); continue; }
    if (p.kind === 'axe' && p.y > cam.y + GFX.VH + 30) projs.splice(i, 1);
  }
}

// ---------- 設置ゾーン(ブリザード / ブラックホール) ----------
function updZones(dt) {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.t += dt; z.tick -= dt;
    if (z.kind === 'blizz') {
      for (let k = 0; k < 3; k++) {
        const a = rand(0, TAU), r = rand(0, z.r);
        part(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, -Math.sin(a) * 40, Math.cos(a) * 40, 0.5, pick(['#bff4ff', '#ffffff', '#7ad7ff']), { glow: true, drag: 1 });
      }
      if (z.tick <= 0) {
        z.tick = 0.25;
        forEachNear(z.x, z.y, z.r, e => {
          hitEnemy(e, z.dmg, { src: 'blizzard', noNum: Math.random() < 0.6, col: '#bff4ff' });
          e.frost = Math.min(10, (e.frost || 0) + 1); e.frostT = 5;
          if (z.evo && e.frost >= 10 && !e.boss && !(e.stun > 0)) {
            e.stun = 1.4; e.frost = 0;
            burst(e.x, e.y, 10, ['#bff4ff', '#ffffff', '#7ad7ff'], { sp: 60, glow: true });
          }
        });
      }
    } else if (z.kind === 'hole') {
      const R = z.r * Math.min(1, z.t * 5);
      forEachNear(z.x, z.y, R * 1.6, e => {
        if (e.boss) return;
        const a = Math.atan2(z.y - e.y, z.x - e.x), dd = Math.sqrt(d2(z.x, z.y, e.x, e.y));
        const k = Math.min(dd, z.pull * dt * (1 - (e.kbRes || 0) * 0.6));
        e.x += Math.cos(a) * k; e.y += Math.sin(a) * k;
      });
      if (z.tick <= 0) {
        z.tick = 0.1;
        forEachNear(z.x, z.y, R, e => hitEnemy(e, z.dmg, { src: 'bhole', noNum: Math.random() < 0.75, col: '#c78bff' }));
      }
      for (let k = 0; k < 3; k++) {
        const a = rand(0, TAU), r = R * rand(1, 1.6);
        part(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, -Math.cos(a) * r * 2.5, -Math.sin(a) * r * 2.5, 0.4, pick(['#c78bff', '#6a3aa0', '#ffffff']), { glow: true, drag: 0 });
      }
      if (z.t >= z.dur && z.evo) {
        const ER = z.r * 1.5;
        forEachNear(z.x, z.y, ER, e => hitEnemy(e, 110, { src: 'bhole', ang: Math.atan2(e.y - z.y, e.x - z.x), kb: 120, col: '#ff9bf5' }));
        burst(z.x, z.y, 60, ['#c78bff', '#ff9bf5', '#ffffff'], { sp: 160, glow: true, life: 0.8 });
        addRing(z.x, z.y, ER, '#ff9bf5', { w: 2, life: 0.4 }); addFlash(z.x, z.y, 120, '#c78bff', 0.4);
        shockAt(z.x, z.y, 1.6, 0.8); shake(6); AudioMan.boom();
      }
    }
    if (z.t >= z.dur) zones.splice(i, 1);
  }
}

// ============================================================
// ダメージ・撃破
// ============================================================
function hitEnemy(e, base, o = {}) {
  if (e.dead) return 0;
  if (e.prop) { killEnemy(e, o); return 0; }
  let dmg = base * dmgMul();
  const crit = !o.noCrit && Math.random() < critRate();
  if (crit) dmg *= P.art.critdmg ? 3 : 2; else if (P.art.critdmg) dmg *= 0.8;
  dmg = Math.max(1, Math.round(dmg * rand(0.9, 1.1)));
  e.hp -= dmg; e.flash = 0.08;
  S.totalDmg += dmg;
  if (o.src) S.dmgBy[o.src] = (S.dmgBy[o.src] || 0) + dmg;
  if (o.kb && o.ang !== undefined && !e.boss) {
    const k = o.kb * (1 - (e.kbRes || 0));
    e.kx += Math.cos(o.ang) * k; e.ky += Math.sin(o.ang) * k;
  }
  if (crit) {
    addFloat(e.x, e.y - e.r - 3, dmg + '!', '#ffe14a', 2, -40);
    burst(e.x, e.y, 6, ['#ffe14a', '#ffffff'], { sp: 90, glow: true, life: 0.3 });
    AudioMan.crit();
  } else {
    if (!o.noNum) addFloat(e.x, e.y - e.r - 3, String(dmg), '#ffffff');
    if (Math.random() < 0.5) part(e.x + rand(-2, 2), e.y + rand(-2, 2), rand(-40, 40), rand(-40, 10), 0.25, o.col || '#ffffff', { glow: true });
    AudioMan.hit();
  }
  if (e.boss) S.hudDirty = true;
  if (e.hp <= 0) killEnemy(e, o);
  return dmg;
}

function killEnemy(e, o = {}) {
  if (e.dead) return;
  e.dead = true;
  if (e.boss) return onBossDeath(e);
  const col = ECOL[e.type] || ['#ffffff', '#888888'];
  if (e.prop) {
    burst(e.x, e.y, 18, ['#ff6a2a', '#ffc34a', '#3a3040', '#6a6070'], { sp: 70, up: 20, glow: true });
    addFlash(e.x, e.y, 50, '#ffb347', 0.3);
    const r = Math.random();
    const kind = r < 0.3 ? 'coin' : r < 0.55 ? 'meat' : r < 0.7 ? 'magnet' : r < 0.82 ? 'bomb' : 'gem';
    if (kind === 'coin') for (let i = 0; i < 5; i++) dropItem('coin', e.x, e.y, 2);
    else if (kind === 'gem') dropGem(e.x, e.y, 10);
    else dropItem(kind, e.x, e.y);
    AudioMan.kill();
    return;
  }
  S.kills++;
  S.combo++; S.comboT = 3; S.bestCombo = Math.max(S.bestCombo, S.combo);
  if (S.combo % 100 === 0) { UI.announce(S.combo + ' COMBO!!', 'ボーナス +' + Math.round(S.combo / 10) + 'G'); addGold(S.combo / 10); }
  burst(e.x, e.y, e.elite ? 40 : 7, [col[0], col[1], '#ffffff'], { sp: e.elite ? 120 : 60, up: 15, g: 120, drag: 3 });
  part(e.x, e.y, 0, -20, 0.45, '#ffffff', { glow: true, sz: 2, drag: 1 });
  addRing(e.x, e.y, e.r + 4, col[0], { life: 0.18 });
  dropGem(e.x, e.y, e.xp * (e.elite ? 12 : 1));
  if (Math.random() < 0.035) dropItem('coin', e.x, e.y, 1);
  if (Math.random() < 0.004) dropItem('meat', e.x, e.y);
  if (P.art.fang && Math.random() < 0.08) heal(2);
  AudioMan.kill();
  if (DATA.enemies[e.type].split && !e.elite) for (let i = 0; i < 2; i++) spawnEnemy(DATA.enemies[e.type].split, { x: e.x + rand(-4, 4), y: e.y + rand(-4, 4) });
  if (e.elite || e.type === 'goblin') {
    hitstop(0.06); shake(6); shockAt(e.x, e.y, 1.2, 0.8); addFlash(e.x, e.y, 100, '#ffd23f', 0.4);
    dropItem('chest', e.x, e.y);
    const n = e.type === 'goblin' ? 18 : 4;
    for (let i = 0; i < n; i++) dropItem('coin', e.x, e.y, e.type === 'goblin' ? 3 : 2);
    AudioMan.boom();
  }
}

// ============================================================
// 敵
// ============================================================
function spawnEnemy(type, o = {}) {
  const d = DATA.enemies[type];
  let x = o.x, y = o.y;
  if (x === undefined) {
    const a = rand(0, TAU), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 16;
    x = P.x + Math.cos(a) * R; y = P.y + Math.sin(a) * R;
  }
  const hpk = (1 + S.time * 0.0014) * enemyMul() * (o.elite ? 14 : 1);
  const spk = (1 + (S.loop - 1) * 0.15) * (P.art.clock ? 1.15 : 1) * (o.elite ? 1.1 : 1);
  const e = {
    id: nextId++, type, x, y, hp: d.hp * hpk, maxhp: d.hp * hpk, spd: d.spd * spk * rand(0.9, 1.1), dmg: d.dmg * enemyMul(),
    r: d.r * (o.elite ? 2 : 1), xp: d.xp, ai: d.ai, kbRes: o.elite ? 0.9 : d.kbRes || 0, ghost: d.ghost,
    t: rand(0, 5), seed: Math.random(), kx: 0, ky: 0, flash: 0, elite: !!o.elite, scale: o.elite ? 2 : 1,
    frost: 0, frostT: 0, burn: 0, burnT: 0, burnTick: 0, stun: 0, slowT: 0, shotT: d.shot ? rand(1, d.shot.cd) : 0, hopT: rand(0, 1),
    life: type === 'goblin' ? 16 : 0,
  };
  enemies.push(e);
  return e;
}

function spawnProp() {
  const a = rand(0, TAU), R = rand(180, 260);
  const e = spawnEnemy('zombie', { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R });
  Object.assign(e, { type: 'brazier', prop: true, hidden: true, hp: 1, maxhp: 1, spd: 0, dmg: 0, r: 4, ai: 'none', xp: 0, kbRes: 1 });
}

function updEnemies(dt) {
  const R2 = Math.pow(Math.hypot(GFX.VW, GFX.VH) * 0.75, 2);
  for (const e of enemies) {
    if (e.dead) continue;
    e.t += dt; e.flash -= dt;
    if (e.prop) { if (d2(e.x, e.y, P.x, P.y) > R2 * 2) e.dead = true; continue; }
    // 状態異常
    if (e.burnT > 0) {
      e.burnT -= dt; e.burnTick -= dt;
      if (e.burnTick <= 0) { e.burnTick = 0.5; hitEnemy(e, e.burn * 0.5, { src: 'fire', noCrit: true, col: '#ff8a3d', noNum: Math.random() < 0.5 }); if (e.dead) continue; }
      if (Math.random() < dt * 12) part(e.x + rand(-3, 3), e.y + rand(-3, 3), 0, -20, 0.4, pick(['#ff6a2a', '#ffc34a']), { glow: true });
    }
    if (e.frostT > 0) { e.frostT -= dt; if (e.frostT <= 0) e.frost = 0; }
    e.slowT -= dt;
    // ノックバック
    e.x += e.kx * dt; e.y += e.ky * dt;
    const damp = Math.exp(-9 * dt);
    e.kx *= damp; e.ky *= damp;
    if (e.stun > 0) { e.stun -= dt; continue; }
    if (e.boss) { bossAI(e, dt); }
    else {
      const slow = (1 - 0.04 * e.frost) * (e.slowT > 0 ? 0.6 : 1);
      const sp = e.spd * slow;
      const a = Math.atan2(P.y - e.y, P.x - e.x);
      let mx = Math.cos(a), my = Math.sin(a);
      if (e.ai === 'flutter') { const w = Math.sin(e.t * 5 + e.seed * 10) * 0.8; mx -= Math.sin(a) * w; my += Math.cos(a) * w; }
      else if (e.ai === 'hop') { e.hopT -= dt; const hop = e.hopT < 0.35; if (e.hopT <= 0) e.hopT = 1.1; mx *= hop ? 2.4 : 0.1; my *= hop ? 2.4 : 0.1; }
      else if (e.ai === 'keep') {
        const dd = Math.sqrt(d2(e.x, e.y, P.x, P.y));
        const k = dd > 95 ? 1 : dd < 70 ? -1 : 0;
        mx *= k; my *= k;
        e.shotT -= dt;
        if (e.shotT <= 0 && dd < 180) {
          const s = DATA.enemies.archer.shot;
          e.shotT = s.cd;
          eprojs.push({ kind: 'arrow', x: e.x, y: e.y, vx: Math.cos(a) * s.spd, vy: Math.sin(a) * s.spd, dmg: s.dmg * enemyMul(), life: 4, t: 0, r: 2 });
        }
        e.aim = e.shotT < 0.4;
      } else if (e.ai === 'flee') {
        mx = -mx; my = -my;
        e.life -= dt;
        if (Math.random() < dt * 20) part(e.x, e.y, rand(-10, 10), rand(-20, 0), 0.6, '#ffcc33', { glow: true });
        if (e.life <= 0) { e.dead = true; UI.announce('逃げられた…', ''); burst(e.x, e.y, 20, ['#ffffff', '#ffcc33'], { sp: 60 }); continue; }
      }
      e.x += mx * sp * dt; e.y += my * sp * dt;
      e.face = mx < 0 ? -1 : 1;
      // 分離(重なり防止)
      if (!e.ghost) {
        let n = 0;
        forEachNear(e.x, e.y, e.r, o => {
          if (o === e || o.ghost || o.prop) return;
          const dx = e.x - o.x, dy = e.y - o.y, dd = Math.hypot(dx, dy) || 0.1, ov = e.r + o.r - dd;
          if (ov > 0) { const push = ov * 0.35 * (o.boss ? 2 : 1); e.x += dx / dd * push; e.y += dy / dd * push; }
          if (++n > 6) return false;
        });
      }
      // 遠すぎる敵は進行方向の反対側へ再配置
      if (d2(e.x, e.y, P.x, P.y) > R2 && e.type !== 'goblin') {
        const a2 = Math.atan2(P.y - e.y, P.x - e.x) + rand(-0.5, 0.5), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 12;
        e.x = P.x + Math.cos(a2) * R; e.y = P.y + Math.sin(a2) * R;
      }
    }
    if (e.dmg > 0 && d2(e.x, e.y, P.x, P.y) < Math.pow(e.r + 4, 2)) hurtPlayer(e.dmg);
  }
  if (enemies.length > 40) enemies = enemies.filter(e => !e.dead);
}

// ============================================================
// ボス
// ============================================================
function spawnBoss(key) {
  const b = DATA.bosses[key];
  AudioMan.roar(); AudioMan.warning(); AudioMan.playMusic(b.music);
  UI.banner('⚠ WARNING ⚠', b.name);
  shake(8); screenFlash(0.3, '#ff3b5c');
  const a = rand(0, TAU), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 30;
  const hp = b.hp * (1 + S.time * 0.001) * enemyMul() * (1 + (S.loop - 1) * 0.8);
  const e = {
    id: nextId++, type: key, boss: key, name: b.name, x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R,
    hp, maxhp: hp, spd: b.spd * (1 + (S.loop - 1) * 0.15), dmg: b.dmg * enemyMul(), r: b.r, col: b.col, xp: 0, kbRes: 1,
    t: 0, seed: 0, kx: 0, ky: 0, flash: 0, frost: 0, frostT: 0, burn: 0, burnT: 0, burnTick: 0, stun: 0, slowT: 0, scale: 1,
    ai: { ph: 'chase', pt: 0, atk: 3, sum: 7, slam: 6, ring: 3, aim: 2, tp: 5, spiral: 3.5, spN: 0, spGap: 0, spA: 0, enraged: false },
  };
  enemies.push(e);
  S.boss = e;
  UI.bossBar(e);
}

function eball(x, y, a, spd, dmg, kind = 'ball') {
  eprojs.push({ kind, x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: dmg * enemyMul(), life: 7, t: 0, r: kind === 'scythe' ? 4 : 3 });
}

function bossAI(e, dt) {
  const ai = e.ai, a = Math.atan2(P.y - e.y, P.x - e.x), dist = Math.sqrt(d2(e.x, e.y, P.x, P.y));
  const slow = 1 - 0.03 * e.frost;
  e.face = P.x < e.x ? -1 : 1;
  if (!ai.enraged && e.hp < e.maxhp * (e.boss === 'reaper' ? 0.3 : 0.5)) {
    ai.enraged = true; e.spd *= 1.35;
    UI.announce(e.name.split(' ')[0] + ' が激昂した!!', ''); AudioMan.roar(); shake(8); screenFlash(0.25, '#ff3b5c');
  }
  switch (e.boss) {
    case 'king':
      if (ai.ph === 'chase') {
        e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt;
        ai.atk -= dt;
        if (ai.atk <= 0) { ai.ph = 'tele'; ai.pt = 0.8; ai.dir = a; warns.push({ kind: 'line', x: e.x, y: e.y, a, len: 260, w: e.r * 2, t: 0, life: 0.8 }); }
        ai.slam -= dt;
        if (ai.enraged && ai.slam <= 0 && ai.ph === 'chase') { ai.ph = 'slamTele'; ai.pt = 1; warns.push({ kind: 'circle', x: e.x, y: e.y, r: 70, t: 0, life: 1 }); }
      } else if (ai.ph === 'tele') {
        ai.pt -= dt; e.flash = Math.sin(ai.pt * 40) > 0 ? 0.05 : 0;
        if (ai.pt <= 0) { ai.ph = 'charge'; ai.pt = 0.8; AudioMan.roar(); }
      } else if (ai.ph === 'charge') {
        ai.pt -= dt;
        e.x += Math.cos(ai.dir) * 330 * dt; e.y += Math.sin(ai.dir) * 330 * dt;
        part(e.x + rand(-8, 8), e.y + 10, rand(-20, 20), rand(-30, 0), 0.6, pick(['#7fae4e', '#4a6e30', '#b8d86a']), { sz: 2 });
        if (ai.pt <= 0) { ai.ph = 'chase'; ai.atk = ai.enraged ? 3.6 : 5.2; }
      } else if (ai.ph === 'slamTele') {
        ai.pt -= dt;
        if (ai.pt <= 0) {
          ai.ph = 'chase'; ai.slam = 7;
          if (dist < 70) hurtPlayer(e.dmg * 1.2);
          for (let i = 0; i < 14; i++) eball(e.x, e.y, TAU / 14 * i, 55, 12);
          shockAt(e.x, e.y, 1.8, 0.8); shake(10); AudioMan.boom();
          burst(e.x, e.y, 50, ['#7fae4e', '#b8d86a', '#3a1a14'], { sp: 150, g: 200 });
        }
      }
      ai.sum -= dt;
      if (ai.sum <= 0) {
        ai.sum = 9;
        for (let i = 0; i < 5; i++) spawnEnemy('zombie', { x: e.x + rand(-25, 25), y: e.y + rand(-25, 25) });
        burst(e.x, e.y, 20, ['#6fae4e', '#3a5d28'], { sp: 90 });
      }
      break;

    case 'wyrm': {
      const want = 110, dir = dist > want ? a : a + Math.PI, k = Math.abs(dist - want) > 20 ? 1 : 0.2;
      e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * 22) * slow * dt;
      e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * 22) * slow * dt;
      ai.ring -= dt;
      if (ai.ring <= 0) {
        ai.ring = ai.enraged ? 3.4 : 4.6;
        const off = rand(0, 0.4);
        for (let i = 0; i < 18; i++) eball(e.x, e.y, TAU / 18 * i + off, 52, 13);
        AudioMan.boom(); shake(4); burst(e.x, e.y, 16, ['#efe9d4', '#6ee7ff'], { sp: 90, glow: true });
      }
      ai.aim -= dt;
      if (ai.aim <= 0) { ai.aim = 2.2; for (let i = -1; i <= 1; i++) eball(e.x, e.y, a + i * 0.22, 78, 13); AudioMan.shoot(); }
      if (ai.enraged) {
        ai.spiral -= dt;
        if (ai.spiral <= 0) { ai.spiral = 0.12; ai.spA += 0.5; eball(e.x, e.y, ai.spA, 60, 11); eball(e.x, e.y, ai.spA + Math.PI, 60, 11); }
      }
      ai.sum -= dt;
      if (ai.sum <= 0) { ai.sum = 11; for (let i = 0; i < 4; i++) spawnEnemy('bat', { x: e.x + rand(-20, 20), y: e.y + rand(-20, 20) }); }
      break;
    }

    case 'reaper':
      if (!ai.tpTo) { e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt; }
      ai.tp -= dt;
      if (ai.tp <= 0 && !ai.tpTo) {
        const ta = rand(0, TAU), tr = rand(60, 90);
        ai.tpTo = { x: P.x + Math.cos(ta) * tr, y: P.y + Math.sin(ta) * tr, t: 0.55 };
        warns.push({ kind: 'circle', x: ai.tpTo.x, y: ai.tpTo.y, r: 20, t: 0, life: 0.55 });
      }
      if (ai.tpTo) {
        ai.tpTo.t -= dt;
        e.hideA = Math.max(0.15, ai.tpTo.t / 0.55);
        if (ai.tpTo.t <= 0) {
          burst(e.x, e.y, 24, ['#c29bff', '#2b1b4a'], { sp: 100, glow: true });
          e.x = ai.tpTo.x; e.y = ai.tpTo.y; ai.tpTo = null; e.hideA = 1;
          ai.tp = ai.enraged ? 3.8 : 6;
          burst(e.x, e.y, 24, ['#c29bff', '#ffffff'], { sp: 100, glow: true });
          shockAt(e.x, e.y, 1, 1); AudioMan.zap(); screenFlash(0.1, '#c29bff');
          for (let i = 0; i < 8; i++) eball(e.x, e.y, TAU / 8 * i, 45, 14, 'scythe');
        }
      }
      ai.spiral -= dt;
      if (ai.spiral <= 0 && ai.spN <= 0) { ai.spiral = ai.enraged ? 2.4 : 4; ai.spN = ai.enraged ? 22 : 14; }
      if (ai.spN > 0) {
        ai.spGap -= dt;
        if (ai.spGap <= 0) { ai.spGap = 0.07; ai.spN--; ai.spA += 0.55; eball(e.x, e.y, ai.spA, 63, 16, 'scythe'); }
      }
      ai.sum -= dt;
      if (ai.enraged && ai.sum <= 0) { ai.sum = 6; for (let i = 0; i < 4; i++) spawnEnemy('ghost', { x: e.x + rand(-30, 30), y: e.y + rand(-30, 30) }); }
      break;
  }
}

function onBossDeath(e) {
  S.boss = null;
  UI.bossBar(null);
  hitstop(0.18); slowmo(0.2, 2); screenFlash(0.9); shake(16);
  shockAt(e.x, e.y, 3, 0.55);
  setTimeout(() => shockAt(e.x, e.y, 2, 0.8), 250);
  burst(e.x, e.y, 180, [e.col, '#ffd23f', '#ffffff', '#ff8c42'], { sp: 220, glow: true, life: 1.6, g: 40 });
  addRing(e.x, e.y, 140, '#ffd23f', { w: 3, life: 0.8 }); addRing(e.x, e.y, 90, '#ffffff', { w: 2, life: 0.6 });
  addFlash(e.x, e.y, 260, '#ffd23f', 1.2);
  AudioMan.boom(); AudioMan.chest();
  eprojs = []; warns = [];
  for (let i = 0; i < 14; i++) dropGem(e.x + rand(-30, 30), e.y + rand(-30, 30), 20 * S.stage);
  for (let i = 0; i < 25; i++) dropItem('coin', e.x, e.y, 3 * S.stage);
  dropItem('meat', e.x + 14, e.y); dropItem('magnet', e.x - 14, e.y);
  dropItem('chest', e.x, e.y - 14); dropItem('orb', e.x, e.y + 16);
  if (e.boss === 'reaper') {
    if (S.loop === 1 && !S.won) { S.won = true; S.victoryT = 2.4; AudioMan.stopMusic(1.5); return; }
    S.loop++; S.schedIdx = 0; S.loopStart = S.time; setStage(1);
    UI.announce('LOOP ' + S.loop, '敵はさらに強くなる…');
    AudioMan.playMusic('field1');
    return;
  }
  setStage(Math.min(3, S.stage + 1));
  UI.announce('STAGE ' + S.stage, DATA.stages[S.stage - 1].label);
  AudioMan.playMusic('field' + S.stage);
}

function setStage(n) {
  S.stage = n;
  groundCache.clear();
  S.hudDirty = true;
}

// ---------- 敵弾 ----------
function updEprojs(dt) {
  for (let i = eprojs.length - 1; i >= 0; i--) {
    const p = eprojs[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.t > p.life) { eprojs.splice(i, 1); continue; }
    if (d2(p.x, p.y, P.x, P.y) < Math.pow(p.r + 3, 2)) {
      if (P.dashT > 0) continue;
      hurtPlayer(p.dmg);
      burst(p.x, p.y, 6, ['#ff3b5c', '#ffffff'], { sp: 50, glow: true });
      eprojs.splice(i, 1);
    }
  }
}

// ============================================================
// ジェム・ドロップ
// ============================================================
const gemTier = v => v >= 60 ? 3 : v >= 20 ? 2 : v >= 5 ? 1 : 0;
function dropGem(x, y, v) {
  if (gems.length > 380) { const g = gems[(Math.random() * 40) | 0]; g.v += v; g.tier = gemTier(g.v); return; }
  gems.push({ x, y, v, tier: gemTier(v), t: rand(0, 3), home: false, sp: 0, z: 0, vz: -rand(40, 70), vx: rand(-20, 20), vy: rand(-20, 20) });
}
function dropItem(kind, x, y, val = 0) {
  drops.push({ kind, x, y, val, t: 0, z: 0, vz: -rand(60, 110), vx: rand(-35, 35), vy: rand(-25, 25), home: false, sp: 0 });
}
function addGold(v) {
  const g = Math.max(1, Math.round(v * P.goldMul));
  S.gold += g; S.hudDirty = true;
  return g;
}

function bounce(o, dt) {
  if (o.vz === 0 && o.z === 0) return;
  o.vz += 260 * dt; o.z += o.vz * dt;
  o.x += o.vx * dt; o.y += o.vy * dt;
  if (o.z >= 0) { o.z = 0; if (Math.abs(o.vz) > 30) { o.vz *= -0.4; o.vx *= 0.5; o.vy *= 0.5; } else { o.vz = 0; o.vx = o.vy = 0; } }
}

function updGems(dt) {
  S.gemStreakT -= dt;
  if (S.gemStreakT <= 0) S.gemStreak = 0;
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
      S.gemStreak++; S.gemStreakT = 0.6;
      AudioMan.gem(S.gemStreak);
      const cols = [['#4cc3ff', '#e0fbff'], ['#5dff8a', '#eaffea'], ['#ff5d73', '#ffe0e6'], ['#ffd23f', '#fffbe0']][g.tier];
      burst(P.x, P.y - 4, 3, cols, { sp: 35, glow: true, life: 0.35 });
      gainXP(g.v);
    }
  }
}

function updDrops(dt) {
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
    switch (d.kind) {
      case 'coin': { const g = addGold(d.val); addFloat(P.x, P.y - 12, '+' + g, '#ffcc33'); AudioMan.coin(); break; }
      case 'meat': heal(30); break;
      case 'magnet':
        for (const g of gems) { g.home = true; g.sp = Math.max(g.sp, 60); }
        for (const c of drops) if (c.kind === 'coin') c.home = true;
        addRing(P.x, P.y, 200, '#6ee7ff', { w: 2, life: 0.6 }); shockAt(P.x, P.y, 0.8);
        UI.announce('MAGNET!', ''); AudioMan.select();
        break;
      case 'bomb': {
        screenFlash(0.85, '#fff4d0'); shockAt(P.x, P.y, 2.5, 0.7); shake(12); hitstop(0.08); AudioMan.boom();
        addFlash(P.x, P.y, 300, '#ffb347', 0.8);
        for (const e of enemies) if (!e.dead && !e.prop && onScreen(e.x, e.y, 10)) { if (e.boss) hitEnemy(e, 250, { src: 'bomb', noCrit: true }); else killEnemy(e, {}); }
        UI.announce('BOOM!!', '');
        break;
      }
      case 'chest': UI.openChest(buildChestRewards()); break;
      case 'orb': UI.openArtifact(buildArtifactChoices()); break;
    }
  }
}

// ============================================================
// スポナー
// ============================================================
function updSpawner(dt) {
  const sc = DATA.schedule, el = S.time - S.loopStart;
  while (S.schedIdx < sc.length && el >= sc[S.schedIdx].t) {
    const en = sc[S.schedIdx++];
    if (en.boss) spawnBoss(en.boss);
    else if (en.event === 'horde') horde();
    else S.spawnCfg = en;
  }
  const cfg = S.spawnCfg;
  if (!cfg) return;
  const rate = (1 + (S.loop - 1) * 0.3) * (P.art.clock ? 1.15 : 1) * (S.boss ? 0.6 : 1);
  S.spawnT -= dt;
  while (S.spawnT <= 0) {
    S.spawnT += cfg.interval / rate;
    if (enemies.length < cfg.max * (P.art.clock ? 1.15 : 1)) {
      // 時々小集団で出現
      if (Math.random() < 0.12) {
        const t = pick(cfg.types), a = rand(0, TAU), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 16;
        for (let i = 0; i < 6; i++) spawnEnemy(t, { x: P.x + Math.cos(a) * R + rand(-14, 14), y: P.y + Math.sin(a) * R + rand(-14, 14) });
      } else spawnEnemy(pick(cfg.types));
    }
  }
  if (S.time > 90) {
    S.eliteT -= dt;
    if (S.eliteT <= 0) { S.eliteT = 60; spawnEnemy(pick(cfg.types), { elite: true }); UI.banner('ELITE 出現!!', '倒すと宝箱を落とす', 1600); AudioMan.warning(); }
  }
  S.goblinT -= dt;
  if (S.goblinT <= 0) {
    S.goblinT = 140;
    const a = rand(0, TAU);
    spawnEnemy('goblin', { x: P.x + Math.cos(a) * 110, y: P.y + Math.sin(a) * 110 });
    UI.announce('トレジャーゴブリン!', '逃がすな!');
  }
  S.propT -= dt;
  if (S.propT <= 0) { S.propT = 6; if (enemies.filter(e => e.prop && !e.dead).length < 5) spawnProp(); }
}

function horde() {
  UI.banner('HORDE INCOMING!!', '大群が迫ってくる…', 2000);
  AudioMan.warning(); shake(5);
  const cfg = S.spawnCfg || { types: ['zombie'] }, R = Math.hypot(GFX.VW, GFX.VH) / 2 + 20, n = 48;
  for (let i = 0; i < n; i++) { const a = TAU / n * i; spawnEnemy(pick(cfg.types), { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R }); }
}

// ============================================================
// 報酬ロジック(レベルアップ / 宝箱 / アーティファクト)
// ============================================================
function buildChoices() {
  const pool = [], wc = Object.keys(P.weapons).length, pc = Object.keys(P.passives).length;
  for (const k in DATA.weapons) {
    const w = P.weapons[k];
    if (!w) { if (wc < S.weaponSlots) pool.push({ type: 'weapon', key: k, w: 1 }); }
    else if (w.lv < 5) pool.push({ type: 'weapon', key: k, w: 1.6 });
  }
  for (const k in DATA.passives) {
    const lv = P.passives[k] || 0;
    if (!lv) { if (pc < S.passiveSlots) pool.push({ type: 'passive', key: k, w: 0.9 }); }
    else if (lv < DATA.passives[k].max) pool.push({ type: 'passive', key: k, w: 1.3 });
  }
  const out = [];
  while (out.length < 3 && pool.length) {
    let tot = pool.reduce((s, c) => s + c.w, 0), r = Math.random() * tot, i = 0;
    while ((r -= pool[i].w) > 0) i++;
    out.push(pool.splice(i, 1)[0]);
  }
  if (!out.length) out.push({ type: 'heal' }, { type: 'gold' });
  return out;
}
function applyChoice(c) {
  if (c.type === 'weapon') addWeapon(c.key);
  else if (c.type === 'passive') { P.passives[c.key] = (P.passives[c.key] || 0) + 1; if (c.key === 'heart') heal(20, true); recalc(); }
  else if (c.type === 'heal') heal(40);
  else if (c.type === 'gold') addGold(25);
  else if (c.type === 'evo') { P.weapons[c.key].evo = true; }
  else if (c.type === 'artifact') applyArtifact(c.key);
  S.hudDirty = true;
}
function evolvable() {
  return Object.keys(P.weapons).filter(k => { const w = P.weapons[k]; return w.lv >= 5 && !w.evo && P.passives[DATA.weapons[k].evo.need]; });
}
function buildChestRewards() {
  const out = [], ev = evolvable();
  if (ev.length) out.push({ type: 'evo', key: ev[0] });
  const r = Math.random();
  let n = r < 0.06 ? 5 : r < 0.25 ? 3 : 1;
  if (P.art.greed) n++;
  if (ev.length) n = Math.max(0, n - 1);
  // 所持品のレベルアップ候補を仮想的に積み上げる
  const lv = {};
  for (const k in P.weapons) lv['w' + k] = P.weapons[k].evo ? 99 : P.weapons[k].lv;
  for (const k in P.passives) lv['p' + k] = P.passives[k];
  for (let i = 0; i < n; i++) {
    const cand = Object.keys(lv).filter(k => k[0] === 'w' ? lv[k] < 5 : lv[k] < DATA.passives[k.slice(1)].max);
    if (!cand.length) { out.push({ type: 'gold', amt: 30 }); continue; }
    const k = pick(cand);
    lv[k]++;
    out.push({ type: k[0] === 'w' ? 'weapon' : 'passive', key: k.slice(1) });
  }
  return out;
}
function buildArtifactChoices() {
  const keys = Object.keys(DATA.artifacts).filter(k => !P.art[k]);
  return shuffle(keys).slice(0, 3).map(k => ({ type: 'artifact', key: k }));
}
function applyArtifact(k) {
  P.art[k] = true;
  if (k === 'wslot') S.weaponSlots++;
  if (k === 'pslot') S.passiveSlots++;
  if (k === 'aegis') P.hp += 100;
  recalc();
  AudioMan.artifact();
  screenFlash(0.4, DATA.artifacts[k].col); shockAt(P.x, P.y, 1.2);
  addRing(P.x, P.y, 90, DATA.artifacts[k].col, { w: 2, life: 0.6 });
}
