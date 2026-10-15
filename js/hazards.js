// hazards.js — 敵弾・設置物(ボスの床・衝撃波・スロウタイム・渦など)の動きと当たり
'use strict';

// ---------- 敵弾 ----------
function updEprojs(dt0) {
  updTimeMods(dt0);
  const tk = eprojTimeK(); // 時の操作(終刻の死神): 敵の弾の時間の倍率
  for (let i = eprojs.length - 1; i >= 0; i--) {
    const p = eprojs[i];
    // 時間停止(アストロマンサーの重力圏): 止まった弾は当たらず、時間が来たら消える
    if (p.stopT) { if (S.time >= p.stopT) { burst(p.x, p.y - (p.z || 0), 5, ['#8a2a6e', '#3a1438'], { sp: 30, life: 0.25 }); eprojs.splice(i, 1); } continue; }
    const dt = dt0 * clsProjTime(p) * tk; // 時の歪み: 重力圏の中の弾は時間がゆっくり進む(0 = 止まった)/ 時間停止・狂い時計・逆戻し
    p.tk = tk;
    p.t += dt;
    if (p.lob) {
      if (p.follow) p.follow(p); // 落下点が動く(墨の玉)
      const k = clamp(p.t / p.T, 0, 1); // 巻き戻しでは戻る
      p.x = lerp(p.x0, p.tx, k); p.y = lerp(p.y0, p.ty, k); p.z = Math.sin(k * Math.PI) * p.H;
      if (p.kind === 'hrock' && Math.random() < dt * 40) part(p.x + rand(-2, 2), p.y - p.z + rand(-2, 2), rand(-10, 10), rand(-10, 10), 0.35, pick(['#ff6a2a', '#ffc34a', '#3a1a10']), { glow: true, drag: 2 }); // 熱された岩: 火の粉の尾
      if (k >= 1) { eprojs.splice(i, 1); p.onLand(p); }
      continue;
    }
    if (p.kind === 'boomer') {
      if (!p.ret) {
        p.v -= 200 * dt;
        if (p.v <= 0) { p.ret = true; p.v = 0; }
        p.x += Math.cos(p.a) * p.v * dt; p.y += Math.sin(p.a) * p.v * dt;
      } else {
        p.v = Math.min(240, p.v + 260 * dt);
        const ta = Math.atan2(p.owner.y - p.y, p.owner.x - p.x);
        p.x += Math.cos(ta) * p.v * dt; p.y += Math.sin(ta) * p.v * dt;
        if (p.owner.dead || d2(p.x, p.y, p.owner.x, p.owner.y) < 100) p.t = p.life + 1;
      }
    } else { if (p.kind === 'ray') updRay(p, dt); if (p.kind === 'hshadow') homeShadow(p, dt); if (p.spin) spinOrb(p); else { if (p.easeT) { const sp = Math.hypot(p.vx, p.vy), ns = p.vmax * easeInQuart(p.t / p.easeT); if (sp > 0) { p.vx *= ns / sp; p.vy *= ns / sp; } else if (p.dir !== undefined) { p.vx = Math.cos(p.dir) * ns; p.vy = Math.sin(p.dir) * ns; } } p.x += p.vx * dt; p.y += p.vy * dt; } } // easeT: 速さを easeInQuart で easeT 秒かけて vmax へ上げる(はじめはほとんど動かず、最後に一気に速くなる。速さ 0 から動き出す弾は向きを dir に持つ)
    if ((p.kind === 'cshade' || p.kind === 'shound') && Math.random() < dt * 50) part(p.x + rand(-6, 6), p.y + rand(-8, 4), -p.vx * 0.15 + rand(-10, 10), -p.vy * 0.15 - rand(5, 20), rand(0.3, 0.5), pick(SKC.slice(0, 4)), { glow: Math.random() < 0.3, drag: 2, sz: pick([1, 2]) }); // 影の突進の影・影の猟犬: 黒紫のもや
    if (p.kind === 'cshade' && (p.gT = (p.gT || 0) - dt) <= 0) { p.gT = 0.04; bfx.push({ kind: 'ghost', x: p.x, y: p.y, spr: 'cerberus', flip: p.vx < 0, col: '#7a3ab0', t: 0, life: 0.22 }); } // 影の残像
    if (p.kind === 'vslash' && Math.random() < dt * 40) part(p.x - p.vx * 0.05 + rand(-2, 2), p.y - p.vy * 0.05, rand(-6, 6), -rand(10, 30), 0.4, pick(SKC), { glow: Math.random() < 0.5, drag: 2 }); // 影刃: 地面を裂いて紫の火花
    else if (p.kind === 'hshadow' && Math.random() < dt * 45) part(p.x + rand(-2, 2), p.y + rand(-2, 2), -p.vx * 0.2, -p.vy * 0.2, rand(0.3, 0.5), pick(SKC.slice(0, 4)), { glow: Math.random() < 0.35, drag: 2, sz: pick([1, 2]) }); // 追い影: 黒紫の尾 // 乱反射の光: 跳ね先へ向きを変える
    // 通常敵の弾の軌跡: 火の玉は火の粉、砂の弾は砂煙、槍は白い風切り
    if (p.kind === 'efire' && Math.random() < dt * 40) part(p.x + rand(-1, 1), p.y + rand(-1, 1), -p.vx * 0.15 + rand(-6, 6), -p.vy * 0.15 - rand(4, 12), rand(0.2, 0.4), pick(['#ff6a2a', '#ffc34a', '#b8261a']), { glow: true, drag: 2 });
    else if (p.kind === 'esand' && Math.random() < dt * 30) part(p.x, p.y, rand(-8, 8), rand(-8, 4), 0.35, pick(['#e8c88a', '#c8a060']), { drag: 3 });
    else if (p.kind === 'vball' && Math.random() < dt * 30) part(p.x + rand(-1, 1), p.y + rand(-1, 1), -p.vx * 0.1, -p.vy * 0.1 + 12, rand(0.3, 0.5), pick(['#7dff6a', '#3aa83a', '#9a7dff']), { glow: Math.random() < 0.5, g: 60, drag: 1 }); // 瘴気弾: 毒のしずく
    else if (p.kind === 'darkorb' && Math.random() < dt * 40) part(p.x + rand(-2, 2), p.y + rand(-2, 2), -p.vx * 0.15 + rand(-5, 5), -p.vy * 0.15 + rand(-5, 5), rand(0.3, 0.5), pick(['#1a0a2a', '#3a1a5a', '#7a3ab0', '#c79bff']), { glow: Math.random() < 0.3, drag: 2 }); // 闇の玉: 黒紫の尾
    else if (p.kind === 'espear' && Math.random() < dt * 50) part(p.x - p.vx * 0.03, p.y - p.vy * 0.03, 0, 0, 0.12, '#ffffff', { drag: 0 });
    else if ((p.kind === 'eice' || p.kind === 'ispear' || p.kind === 'flake') && Math.random() < dt * (p.kind === 'ispear' ? 60 : 25)) part(p.x + rand(-1, 1), p.y + rand(-1, 1), -p.vx * 0.1, -p.vy * 0.1, 0.3, pick(['#bff4ff', '#ffffff', '#7ad7ff']), { glow: true, drag: 2 }); // 氷の弾: 霜のきらめき
    else if (p.kind === 'bigsnow') { p.spin = (p.spin || 0) + dt * Math.hypot(p.vx, p.vy) / 14; if (Math.random() < dt * 30) part(p.x + rand(-10, 10), p.y + 10, -p.vx * 0.2 + rand(-15, 15), -rand(10, 30), 0.5, pick(['#ffffff', '#e8f4ff']), { g: 120, drag: 1 }); } // 大雪玉: 転がって雪煙
    if (p.kind === 'cog') p.spin = (p.spin || 0) + dt * 10;
    if (p.nx && !P.dead && P.invT <= 0 && eprojs.includes(p.nx) && !p.nx.stopT && segD2(P.x, P.y, p.x, p.y, p.nx.x, p.nx.y) < Math.pow(2 * CHAOS.area + 3, 2) && hurtPlayer(p.dmg, p.pierce ? PIERCE : undefined)) { numbPlayer(p.numb); if (p.light) randomLight(p.light, p.src); } // 雷の網(雷神): となりの玉と結ぶ稲妻にも当たる(玉と同じ ×0.6・痺れ +2)
    if (p.kind === 'tnet' && Math.random() < dt * 16) part(p.x + rand(-2, 2), p.y + rand(-2, 2), rand(-10, 10), rand(-10, 10), 0.25, pick(THUN), { glow: true, drag: 2 }); // 雷の網の玉: 火花
    if (p.turnT && p.t >= p.turnT) { // 歯車弾: 1回だけプレイヤーへ向きを変える
      p.turnT = 0; const ta = Math.atan2(P.y - p.y, P.x - p.x), sp = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(ta) * sp; p.vy = Math.sin(ta) * sp;
      burst(p.x, p.y, 5, BRASS, { sp: 30, glow: true, life: 0.2 });
    }
    if (p.kind === 'prismorb' && (p.t >= 1.5 || d2(p.x, p.y, P.x, P.y) < 60 * 60)) { splitOrb(p); eprojs.splice(i, 1); continue; } // 光の屈折弾: 7つの欠片に割れる
    if (p.kind === 'darkorb' && !p.frag && (p.t >= p.life || (p.t > 0.2 && d2(p.x, p.y, P.x, P.y) < 50 * 50))) { splitDarkOrb(p); eprojs.splice(i, 1); continue; } // 闇の玉: 近づくか消えるときに 4つに割れる
    if (p.kind === 'corb' && !p.frag && (p.t >= p.life || (p.t > 0.2 && d2(p.x, p.y, P.x, P.y) < 50 * 50))) { splitCorb(p); eprojs.splice(i, 1); continue; } // 三獄の魔弾: 同じく 3つ(激昂 6つ)に割れる
    if (p.kind === 'corb' && Math.random() < dt * 35) part(p.x + rand(-2, 2), p.y + rand(-2, 2), -p.vx * 0.15 + rand(-5, 5), -p.vy * 0.15 + rand(-5, 5), rand(0.3, 0.5), pick(BREATH_COL[p.el]), { glow: Math.random() < 0.4, drag: 2 });
    if (p.kind === 'prismorb' && Math.random() < dt * 30) part(p.x + rand(-3, 3), p.y + rand(-3, 3), -p.vx * 0.2, -p.vy * 0.2, 0.3, pick(PRISM), { glow: true, drag: 2 });
    if (p.splitT && p.t >= p.splitT) { // 雪華弾: 3つに割れる
      const a = Math.atan2(p.vy, p.vx), sp = Math.hypot(p.vx, p.vy);
      for (const da of [-0.45, 0, 0.45]) Object.assign(eball(p.x, p.y, a + da, sp * 1.15, 0, 'flake'), { dmg: p.dmg, frost: p.frost, small: true, life: 4 }); // ダメージは割れる前の弾と同じ
      burst(p.x, p.y, 6, ['#ffffff', '#bff4ff'], { sp: 40, glow: true, life: 0.25 });
      eprojs.splice(i, 1); continue;
    }
    if (p.t > p.life) { if (p.kind === 'espear' || p.kind === 'bspear') burst(p.x, p.y, 5, ['#c8b89a', '#7a6a5a'], { sp: 30, life: 0.25 }); eprojs.splice(i, 1); continue; } // 槍は帯の端で地面に刺さる
    if (p.blk) { // 大鹿の欠片・残像は結晶の柱に当たると砕けて消える
      let wall = null;
      forEachNear(p.x, p.y, p.r, o => { if (o.obj === p.blk && !(p.ignore && p.ignore.has(o))) { wall = o; return false; } }); // blk: 遮る物の種類(結晶の柱)
      if (wall) { burst(p.x, p.y, 7, ['#efe9d4', '#6ee7ff', '#ffffff'], { sp: 45, glow: true, life: 0.25 }); wall.flash = 0.06; eprojs.splice(i, 1); continue; }
    }
    const near = p.kind === 'vslash' ? segD2(P.x, P.y, p.x - Math.cos(p.a) * p.len, p.y - Math.sin(p.a) * p.len, p.x + Math.cos(p.a) * p.len, p.y + Math.sin(p.a) * p.len) : d2(p.x, p.y, P.x, P.y); // 影刃は地面の線で当たる
    if (near < Math.pow(p.r + 3, 2)) {
      if (P.invT > 0) continue;
      if (!p.keep && clsBlockProj()) { burst(p.x, p.y, 8, ['#fff27a', '#ffffff'], { sp: 60, glow: true, life: 0.25 }); eprojs.splice(i, 1); continue; } // 静電気
      if (hurtPlayer(p.dmg, p.pierce ? PIERCE : undefined)) { if (p.light) randomLight(p.light, p.src); if (p.tri) triStatus(p.tri, p.src); if (p.burn) burnPlayer(p.burn); if (p.sta) drainSta(p.sta); if (p.frost) frostPlayer(p.frost); if (p.dark) darkPlayer(p.dark); if (p.poison) poisonPlayer(p.poison); if (p.taint) shadowTaint(p.taint); if (p.numb) numbPlayer(p.numb); if (p.dust) dustPlayer(p.dust); if (p.weak) weakPlayer(p.weak); if (p.pushK) pushPlayer(Math.atan2(p.vy, p.vx), p.pushK, 0.2); } // 火の玉: 炎上 / 海淵の弾: スタミナ / 霊峰の弾: 凍傷 / 王墓の弾: 暗闇・毒 / 痺れ・砂塵・衰弱
      if (p.keep) continue;
      const icy = p.frost > 0;
      if (p.dark) { burst(p.x, p.y, 14, ['#c79bff', '#7a3ab0', '#2a1240', '#ffffff'], { sp: 60, glow: true, life: 0.4 }); eprojs.splice(i, 1); continue; } // 闇の玉: 黒紫のしぶき
      if (p.kind === 'corb') { burst(p.x, p.y, 12, BREATH_COL[p.el], { sp: 60, glow: true, life: 0.4 }); eprojs.splice(i, 1); continue; } // 三獄の魔弾: 属性の色のしぶき
      burst(p.x, p.y, icy ? 10 : 6, p.kind === 'efire' ? ['#ff6a2a', '#ffc34a', '#ffffff'] : p.kind === 'esand' ? ['#e8c88a', '#fff0c0', '#ffffff'] : p.kind === 'tnet' ? ['#e8e0ff', '#b8a0ff', '#ffffff'] : icy ? ['#bff4ff', '#ffffff', '#7ad7ff'] : ['#ff3b5c', '#ffffff'], { sp: 50, glow: true });
      eprojs.splice(i, 1);
    }
  }
}

// ---------- 設置物(粘液床 / 燃える床 / 衝撃波 / スロウタイム / 渦) ----------
function updHazards(dt) {
  S.inInk = false; S.lee = false;
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    if (h.delay > 0) { h.delay -= dt; continue; } // 予告のあとに出る床
    h.t += dt;
    if (h.owner) { if (h.owner.dead) h.t = h.dur; else { h.x = h.owner.x; h.y = h.owner.y; } }
    const dd = d2(h.x, h.y, P.x, P.y);
    if (h.kind === 'goo') {
      if (dd < h.r * h.r && h.t > 0.1) slowPlayer(DATA.debuff.slow, 0.15 * CHAOS.debuff); // 減速を受けないクラスの状態(不屈)は除く
      if (Math.random() < dt * h.r * 0.15) part(h.x + rand(-h.r, h.r) * 0.7, h.y + rand(-h.r, h.r) * 0.7, 0, -6, 0.5, '#8affd8', { drag: 1 });
    } else if (h.kind === 'fire') { // 燃える床: 上にいる間、炎上(その敵のダメージ × 0.1 を 0.5秒ごと)
      const R = h.r * Math.min(1, h.t * 8);
      if (dd < R * R && h.t > 0.05 && h.t < h.dur - 0.2) burnPlayer(h.dmg * 0.1);
      if (Math.random() < dt * (4 + h.r * 0.9)) { const pa = rand(0, TAU), pr = Math.sqrt(Math.random()) * R; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr * 0.8, rand(-4, 4), -rand(14, 34), rand(0.3, 0.6), pick(['#ff6a2a', '#ffc34a', '#ff3b1a', '#fff0b0']), { glow: true, drag: 1.5 }); }
    } else if (h.kind === 'magma') { // マグマ溜まり(イフリートの爆炎の岩): 上にいる間、炎上(燃える床と同じ)
      const R = h.r * Math.min(1, h.t * 6);
      if (dd < R * R && h.t > 0.05 && h.t < h.dur - 0.2) burnPlayer(h.dmg * 0.1);
      if (Math.random() < dt * 10) { const pa = rand(0, TAU), pr = Math.sqrt(Math.random()) * R * 0.8; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr * 0.8, rand(-4, 4), -rand(10, 30), rand(0.3, 0.6), pick(['#ff6a2a', '#ffc34a', '#ff3b1a']), { glow: true, drag: 1.5 }); }
    } else if (h.kind === 'fband') { // 空襲の燃える床(カオスドラゴン): 影の通り道と同じ幅の帯。先は影と同じ速さで伸び、後ろは通ってから stay 秒で消える。上にいる間、炎上
      const c = Math.cos(h.a), s = Math.sin(h.a), head = Math.min(h.L, h.t * h.spd), tail = Math.max(0, (h.t - h.stay) * h.spd);
      if (head > tail && segD2(P.x, P.y, h.x + c * tail, h.y + s * tail, h.x + c * head, h.y + s * head) < Math.pow(h.w / 2, 2)) burnPlayer(h.dmg * 0.1);
      if (Math.random() < dt * (head - tail) * 0.12) { const d = rand(tail, head), o = rand(-0.45, 0.45) * h.w; part(h.x + c * d - s * o, h.y + s * d + c * o, rand(-4, 4), -rand(14, 34), rand(0.3, 0.6), pick(['#ff6a2a', '#ffc34a', '#ff3b1a', '#fff0b0']), { glow: true, drag: 1.5 }); }
    } else if (h.kind === 'fwall') { // 炎の壁(イフリート): 上にいると 0.5秒ごとに ×0.4・炎上(祭壇の強化も乗る)
      const c = Math.cos(h.a), s = Math.sin(h.a);
      if (!P.dead) { // 越えられない: 壁の長さの範囲では、立ったときにいた側の縁で止まる(ダッシュ・瞬間移動・押し出しでも)。壁の端を回れば反対側へ行ける
        const ox = P.x - h.x, oy = P.y - h.y, along = ox * c + oy * s, sd = -ox * s + oy * c, half = h.w / 2;
        if (!h.side) h.side = Math.sign(sd) || 1;
        if (along < -4 || along > h.len + 4) { if (Math.abs(sd) > half) h.side = Math.sign(sd); }
        else if (sd * h.side < half) { const k = h.side * half - sd; P.x -= s * k; P.y += c * k; }
      }
      h.tick -= dt;
      if (h.tick <= 0 && h.t > 0.1 && segD2(P.x, P.y, h.x, h.y, h.x + c * h.len, h.y + s * h.len) < Math.pow(h.w / 2 + 3, 2)) {
        h.tick = 0.5;
        const k = h.owner2 && !h.owner2.dead ? h.owner2.altK || 1 : 1;
        if (hurtPlayer(h.dmg * k * 0.4)) burnPlayer(h.dmg * k * 0.03);
      }
      if (Math.random() < dt * 40) { const d = rand(0, h.len); part(h.x + c * d + rand(-2, 2), h.y + s * d + rand(-2, 2), rand(-5, 5), -rand(25, 55), rand(0.3, 0.6), pick(['#ff6a2a', '#ffc34a', '#ff3b1a', '#fff0b0']), { glow: true, drag: 1 }); }
    } else if (h.kind === 'quake') {
      h.r += h.spd * dt;
      if (Math.abs(Math.sqrt(dd) - h.r) < 5) { // 輪に触れると ×0.8(ゴーレムの衝撃波は外へ押し出す。1つの輪で1回)
        if (h.dmg > 0) hurtPlayer(h.dmg); // 鐘の衝撃はダメージなし(押すだけ)
        if (h.push && !h.pushed && pushPlayer(Math.atan2(P.y - h.y, P.x - h.x), h.push, 0.2)) h.pushed = true;
      }
      for (let k = 0; k < 3; k++) { const pa = rand(0, TAU); part(h.x + Math.cos(pa) * h.r, h.y + Math.sin(pa) * h.r, 0, -rand(10, 40), 0.35, h.bell ? pick(['#ffd27a', '#fff0c8', '#c8a050']) : pick(['#a89e8c', '#6a6258', '#ffb347']), { g: 120, sz: pick([1, 2]), glow: !!h.bell }); }
      if (h.r >= h.max) h.t = h.dur;
    } else if (h.kind === 'clock') {
      const R = h.r * Math.min(1, h.t * 4);
      const out = h.rev && h.t >= h.rev; // スロウタイム・リバース(終刻の死神): 反転したあとは範囲の外が遅くなる
      if (out && !h.flipped) { // 反転の瞬間: 時計盤の縁から外へ紫の衝撃波が走り、画面の外側が紫にかすむ
        h.flipped = true;
        for (let k = 0; k < 3; k++) addRing(h.x, h.y, R + 40 + k * 60, '#c29bff', { w: 3 - k, life: 0.45 + k * 0.15 });
        for (let k = 0; k < 36; k++) { const pa = TAU / 36 * k; part(h.x + Math.cos(pa) * R, h.y + Math.sin(pa) * R, Math.cos(pa) * 160, Math.sin(pa) * 160, 0.5, pick(['#c29bff', '#ffffff', '#6a3aa0']), { glow: true, drag: 2 }); }
        screenFlash(0.25, '#c29bff'); shockAt(h.x, h.y, 1.6, 0.8); shake(6); AudioMan.knell(); AudioMan.zap();
        UI.announce(_t('反転'), _t('時計盤の外が遅くなる。死神のそばへ'));
      }
      if (out ? dd >= R * R : dd < R * R) slowPlayer(h.slow || DATA.debuff.slow, 0.15 * CHAOS.debuff, true); // スロウタイム(死神)/ 時の歪み(砂時計の精: ×0.7)。どちらもクールダウン・スタミナ・HP の回復が下がる
    } else if (h.kind === 'vortex') { // 中心へ引き寄せる(移動速度より弱いので歩いて脱出できる)
      const R = h.r * Math.min(1, h.t * 4), d = Math.sqrt(dd);
      if (d < R && d > 2 && !P.dead && state === 'play') {
        const k = Math.min(d, h.pull * Math.min(1, (h.dur - h.t) * 2) * dt);
        P.x += (h.x - P.x) / d * k; P.y += (h.y - P.y) / d * k;
      }
      if (Math.random() < dt * 30) { const pa = rand(0, TAU), pr = rand(0.5, 1) * R; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr, (Math.cos(pa + 1.2) * -pr) * 0.9, (Math.sin(pa + 1.2) * -pr) * 0.9, 0.6, pick(['#ff4a8a', '#c78bff', '#ffd0f0']), { glow: true, drag: 1 }); }
    } else if (h.kind === 'ink') { // 墨だまり(クラーケン): 中にいる間スタミナが回復しない
      const R = h.r * Math.min(1, h.t * 6);
      if (dd < R * R && h.t < h.dur - 0.3) { P.staLockT = Math.max(P.staLockT, 0.1); S.inInk = true; }
      if (Math.random() < dt * 8) { const pa = rand(0, TAU), pr = Math.sqrt(Math.random()) * R; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr * 0.8, 0, -rand(4, 10), 0.8, pick(['#2a2a4a', '#3a3a5a', '#1a1a2a']), { drag: 1 }); }
    } else if (h.kind === 'tcage') { // 雷の檻(雷神): 0.4秒後から 3秒まで、隣どうしの雷柱(どちらも残っている)を結ぶ線に触れると 0.5秒ごとに ×0.8・痺れ +2(線は柱の 4 上)
      if (h.owner2 && h.owner2.dead) h.t = h.dur;
      if (!P.dead && h.t >= 0.4 && h.t < 3) {
        let near = false; const R2 = Math.pow(3 * CHAOS.area + 3, 2), ps = h.ps;
        for (let k = 0; k < 4 && !near; k++) { const A = ps[k], B = ps[(k + 1) % 4]; if (!A.dead && !B.dead && segD2(P.x, P.y, A.x, A.y - 4, B.x, B.y - 4) < R2) near = true; }
        if (near) { if ((h.tick -= dt) <= 0) { h.tick = 0.5; if (hurtPlayer(h.dmg * 0.8)) numbPlayer(2); } } else h.tick = 0;
        if (Math.random() < dt * 12) { const k = Math.floor(rand(0, 4)), A = ps[k], B = ps[(k + 1) % 4], u = Math.random(); if (!A.dead && !B.dead) part(lerp(A.x, B.x, u), lerp(A.y, B.y, u) - 4, rand(-10, 10), -rand(10, 30), 0.3, pick(THUN), { glow: true, drag: 2 }); } // 線から飛ぶ火花
      }
    } else if (h.kind === 'etrail') { // 雷化の跡(雷獣): 雷の体が通った所に残る雷(各点 5秒)。触れると 0.5秒ごとに ×0.2・痺れ +1
      if (h.owner2 && h.owner2.dead) h.t = h.dur;
      const pts = h.pts;
      while (pts.length && (!pts[0] || S.time - pts[0].at > 5)) pts.shift();
      if (!pts.length && !(h.owner2 && h.owner2.ai.trail === h)) h.t = h.dur; // 点が消えきった跡(雷化が終わった・次の雷化に替わった)は終わる
      if (!P.dead) {
        let near = false; const R2 = Math.pow(3 * CHAOS.area + 3, 2);
        for (let i = 0; i < pts.length - 1 && !near; i++) { const A = pts[i], B = pts[i + 1]; if (A && B && segD2(P.x, P.y, A.x, A.y, B.x, B.y) < R2) near = true; }
        if (near) { if ((h.tick -= dt) <= 0) { h.tick = 0.5; if (hurtPlayer(h.dmg * 0.2)) numbPlayer(1); } } else h.tick = 0;
      }
    } else if (h.kind === 'eline') { // 雷の線(雷獣の稲妻走りの跡): 触れると 0.5秒ごとに ×0.4・痺れ +1(線から 3 + 3 以内)
      if (h.owner2 && h.owner2.dead) h.t = h.dur;
      if (!P.dead && h.t < h.dur - 0.2) {
        let near = false; const R2 = Math.pow(3 * CHAOS.area + 3, 2);
        for (let i = 0; i < h.pts.length - 1 && !near; i++) if (segD2(P.x, P.y, h.pts[i].x, h.pts[i].y, h.pts[i + 1].x, h.pts[i + 1].y) < R2) near = true;
        if (near) { if ((h.tick -= dt) <= 0) { h.tick = 0.5; if (hurtPlayer(h.dmg * 0.4)) numbPlayer(1); } } else h.tick = 0;
      }
      if (Math.random() < dt * 14) { const i = Math.floor(rand(0, h.pts.length - 1)), u = Math.random(), A = h.pts[i], B = h.pts[i + 1]; part(lerp(A.x, B.x, u), lerp(A.y, B.y, u), rand(-10, 10), -rand(10, 30), 0.3, pick(THUN), { glow: true, drag: 2 }); } // 線から飛ぶ火花
    } else if (h.kind === 'torb') { // 雷玉(雷獣): ゆっくりプレイヤーへ寄る(速さ 22)。玉の周り r に入ると 1秒ごとに小さな稲妻 ×0.4・痺れ +1
      if (h.owner2 && h.owner2.dead) h.t = h.dur;
      const d = Math.sqrt(dd);
      if (d > 2) { h.x += (P.x - h.x) / d * 22 * dt; h.y += (P.y - h.y) / d * 22 * dt; }
      if (!P.dead && d < h.r && h.t < h.dur - 0.3 && (h.zapT -= dt) <= 0) {
        h.zapT = 1; bfx.push({ kind: 'ebolt', x: h.x, y: h.y, x1: P.x, y1: P.y - 3, t: 0, life: 0.15, w: 1, jit: 4 });
        if (hurtPlayer(h.dmg * 0.4)) numbPlayer(1);
        AudioMan.zap();
      }
    } else if (h.kind === 'tablet') { // 謎かけの石板(スフィンクス): 床に置かれるだけ(当たり判定なし)
      if (h.owner2 && h.owner2.dead) h.t = h.dur;
    } else if (h.kind === 'sandstream') { // 砂嵐(スフィンクス): 画面を横切る砂の流れ。tele 秒で濃くなり、ゆっくり横へ動く。中にいると 0.5秒ごとに砂塵 +1、流れの向きへ毎秒 carry で運ばれる(回避の無敵中は運ばれない)
      if (h.owner2 && h.owner2.dead) h.t = h.dur;
      const c = Math.cos(h.a), s = Math.sin(h.a);
      h.x -= s * h.drift * dt; h.y += c * h.drift * dt;
      if (h.t >= h.tele && h.t < h.dur - 0.3 && !P.dead) {
        const ox = P.x - h.x, oy = P.y - h.y, along = ox * c + oy * s, sd = -ox * s + oy * c;
        if (Math.abs(along) < h.len / 2 && Math.abs(sd) < h.bw / 2) {
          if ((h.tick -= dt) <= 0) { h.tick = 0.5; dustPlayer(1); }
          if (P.invT <= 0) { P.x += c * h.carry * dt; P.y += s * h.carry * dt; }
        }
      }
      if (Math.random() < dt * 40) { const u = rand(-0.5, 0.5) * Math.min(h.len, 420), v = rand(-0.5, 0.5) * h.bw; part(h.x + c * u - s * v, h.y + s * u + c * v, c * 120, s * 120, rand(0.3, 0.6), pick(SAND), { drag: 0.3 }); } // 流れる砂
    } else if (h.kind === 'quicksand') { // 流砂の渦(大蠍): tele 秒の予告のあと、大蠍へ引く(回避の無敵中は引かれない)・中にいると 1秒ごとに砂塵 +1・中心(core)で 0.5秒ごとにはさみ ×0.6
      if (h.owner2 && h.owner2.dead) h.t = h.dur;
      const d = Math.sqrt(dd), on = h.t >= h.tele && h.t < h.dur - 0.2;
      if (on && !P.dead && d < h.r) {
        if (P.invT <= 0 && d > 1) { const k = Math.min(d, h.pull * dt); P.x += (h.x - P.x) / d * k; P.y += (h.y - P.y) / d * k; }
        if ((h.dustT -= dt) <= 0) { h.dustT = 1; dustPlayer(1); }
      }
      if (on && (h.snapT -= dt) <= 0) { // はさみが鳴る(中心にいれば ×0.6)
        h.snapT = 0.5;
        hitCircle(h.x, h.y, h.core, h.dmg * 0.6);
        const RC = h.core * CHAOS.area, sa = rand(0, TAU);
        for (const s of [0, Math.PI]) slashes.push({ x: h.x, y: h.y, a: sa + s, r: RC, t: 0, life: 0.2, flip: 0, span: 1.4, pal: SWING_PAL.enemy, enemy: true });
        AudioMan.slash();
      }
      if (Math.random() < dt * (h.t < h.tele ? 20 : 50)) { const pa = rand(0, TAU), pr = rand(0.15, 1) * h.r; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr, -Math.cos(pa) * 30 - Math.sin(pa) * 40, -Math.sin(pa) * 30 + Math.cos(pa) * 40, 0.7, pick(SAND), { drag: 0.5 }); } // 渦を巻いて流れ込む砂
    } else if (h.kind === 'pit') { // すり鉢(アリジゴク): 中では中心へ引かれ(回避の無敵中は引かれない)、1秒ごとに砂塵 +1。底の大あごに 0.5秒ごとに ×n
      if (h.owner2 && h.owner2.dead) h.t = h.dur;
      const d = Math.sqrt(dd), R = h.r * Math.min(1, h.t * 4);
      if (!P.dead && d < R && h.t < h.dur - 0.3) {
        if (P.invT <= 0 && d > 1) { const k = Math.min(d, h.pull * dt); P.x += (h.x - P.x) / d * k; P.y += (h.y - P.y) / d * k; }
        if ((h.dustT -= dt) <= 0) { h.dustT = 1; dustPlayer(1); }
        if (d < h.jaw * CHAOS.area + 3 && (h.jawT -= dt) <= 0) { h.jawT = 0.5; hurtPlayer(h.dmg); h.owner2.biteT = S.time + 0.2; } // 噛むときは大あごを閉じる(render.js)
      }
      if (Math.random() < dt * 24) { const pa = rand(0, TAU), pr = rand(0.4, 1) * R; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr * 0.8, -Math.cos(pa) * 26 - Math.sin(pa) * 14, -Math.sin(pa) * 20 + Math.cos(pa) * 10, 0.6, pick(SAND), { drag: 0.5 }); } // 斜面を滑り落ちる砂
    } else if (h.kind === 'thorn') { // 茨の木(古樹の主の芽吹き): 通れない(幹の円の外へ押し出す)。60 以内に来ると 0.5秒の予告(円 半径 30)のあと枝で叩く ×0.8(2.5秒に1回)
      if (h.owner2 && h.owner2.dead) h.t = h.dur;
      h.rise = Math.min(1, (h.rise || 0) + dt * 4);
      const d = Math.sqrt(dd), R0 = h.r + 4;
      if (!P.dead && d < R0) { const k = R0 - d, ux = d > 0.01 ? (P.x - h.x) / d : 1, uy = d > 0.01 ? (P.y - h.y) / d : 0; P.x += ux * k; P.y += uy * k; }
      if ((h.lashT -= dt) <= 0 && d < 60 * CHAOS.area && h.t < h.dur - 0.6) { h.lashT = 2.5; h.lashAt = h.t + 0.5; pushWarn({ kind: 'circle', x: h.x, y: h.y, r: 30, t: 0, life: 0.5 }); AudioMan.charge(0.5); }
      if (h.lashAt && h.t >= h.lashAt) {
        h.lashAt = 0; h.swing = 0.25;
        hitCircle(h.x, h.y, 30, h.dmg * 0.8);
        burst(h.x, h.y - 6, 14, ['#3a6a34', '#5a9a48', '#8a5a2a'], { sp: 90, life: 0.35 }); addRing(h.x, h.y, 30 * CHAOS.area, '#5a9a48', { life: 0.25 }); AudioMan.slash();
      }
      if (h.swing > 0) h.swing -= dt;
    } else if (h.kind === 'rootring') { // 根の檻(古樹の主): 根の輪(抜け道 1か所)。歩いては越えられない(回避の無敵なら抜けられる)。締めつけは rootCage の later
      if (h.owner2 && h.owner2.dead) h.t = h.dur;
      if (!P.dead) {
        const d = Math.sqrt(dd), half = h.w / 2, ang = Math.atan2(P.y - h.y, P.x - h.x), free = P.invT > 0 || Math.abs(angDiff(ang, h.gap)) < h.gapH || h.t > h.dur - 0.3;
        if (!h.side) h.side = d < h.r ? -1 : 1;
        if (free) { if (Math.abs(d - h.r) > half) h.side = d < h.r ? -1 : 1; }
        else if (h.side < 0 && d > h.r - half) { const k = d - (h.r - half); P.x -= Math.cos(ang) * k; P.y -= Math.sin(ang) * k; }
        else if (h.side > 0 && d < h.r + half) { const k = h.r + half - d; P.x += Math.cos(ang) * k; P.y += Math.sin(ang) * k; }
      }
      if (h.t < 0.3 && Math.random() < dt * 60) { const pa = rand(0, TAU); if (Math.abs(angDiff(pa, h.gap)) > h.gapH) part(h.x + Math.cos(pa) * h.r, h.y + Math.sin(pa) * h.r, rand(-10, 10), -rand(20, 50), 0.4, pick(['#5a3a1a', '#8a5a2a', '#3a6a34']), { g: 160 }); } // せり上がる土
    } else if (h.kind === 'rift') { // 断界の裂け目(影の王): プレイヤーだけ越えられない(歩き・回避・押し出し・鎖の引きでも)。敵・弾は通る
      const c = Math.cos(h.a), s = Math.sin(h.a);
      if (!P.dead) {
        const ox = P.x - h.x, oy = P.y - h.y, along = ox * c + oy * s, sd = -ox * s + oy * c, half = h.w / 2;
        if (!h.side) h.side = Math.sign(sd) || 1;
        if (along < -4 || along > h.len + 4) { if (Math.abs(sd) > half) h.side = Math.sign(sd); }
        else if (sd * h.side < half) { const k = h.side * half - sd; P.x -= s * k; P.y += c * k; }
      }
      if (Math.random() < dt * 30) { const d = rand(0, Math.min(h.len, 500)); part(h.x + c * d + rand(-2, 2), h.y + s * d + rand(-2, 2), rand(-6, 6), -rand(10, 30), rand(0.4, 0.7), pick(SKC), { glow: Math.random() < 0.4, drag: 1 }); }
    } else if (h.kind === 'darkwave') { // 闇の遠吠え(ケルベロス): 闇の波が半径 max まで spread 秒で広がる。飲まれると ×0.6・暗闇(1回)
      h.cur = h.max * Math.min(1, h.t / h.spread);
      if (!h.hit && h.t <= h.spread + 0.05 && dd < Math.pow(h.cur + 3, 2) && hurtPlayer(h.dmg)) { h.hit = true; darkPlayer(DATA.debuffTomb.darkDur); }
      if (h.t <= h.spread) for (let k = 0; k < 8; k++) { const pa = rand(0, TAU); part(h.x + Math.cos(pa) * h.cur, h.y + Math.sin(pa) * h.cur * 0.85, Math.cos(pa) * 40, Math.sin(pa) * 30 - rand(10, 30), rand(0.4, 0.8), pick(['#0a0612', '#1a0a2a', '#3a1a5a', '#7a3ab0']), { glow: Math.random() < 0.15, drag: 1.5, sz: pick([2, 3]) }); }
    } else if (h.kind === 'miasma') { // 瘴気の霧(腐毒のグール): 中にいると 1秒ごとに毒 +1(ダメージはない)
      const R = h.r * Math.min(1, h.t * 5);
      if (dd < R * R && h.t < h.dur - 0.3 && (h.tick -= dt) <= 0) { h.tick = h.iv || 1; if (h.el === 'fang') burnPlayer(h.burn); else if (h.el === 'dark') frostPlayer(1); else poisonPlayer(1); } // 三獄の雨: 炎の霧は炎上・氷の霧は凍傷
      if (Math.random() < dt * (6 + R * 0.4)) { const pa = rand(0, TAU), pr = Math.sqrt(Math.random()) * R; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr * 0.8, rand(-4, 4), -rand(6, 16), rand(0.6, 1.1), pick(['#5aff6a', '#3a8a3a', '#9a7dff', '#4a2a6a']), { glow: Math.random() < 0.35, drag: 1 }); }
    } else if (h.kind === 'tide') { // 潮の満ち引き(クラーケン): 2秒 中心へ引く → 1秒 外へ押す → 縁に触手の輪
      const d = Math.sqrt(dd), live = !P.dead && state === 'play' && P.invT <= 0;
      if (h.t < 2 && d < h.r && d > 2 && live) { const k = Math.min(d, 40 * dt); P.x += (h.x - P.x) / d * k; P.y += (h.y - P.y) / d * k; }
      else if (h.t >= 2 && h.t < 3 && d < h.r + 10 && live) { const a = d > 0.5 ? Math.atan2(P.y - h.y, P.x - h.x) : rand(0, TAU); P.x += Math.cos(a) * 90 * dt; P.y += Math.sin(a) * 90 * dt; }
      if (h.t >= 3 && !h.rung) { // 縁(半径 120〜135)に触手がせり上がる
        h.rung = true;
        if (Math.abs(d - h.r * 1.06) < h.r * 0.07 + 6) hurtPlayer(h.dmg * 0.8);
        for (let k = 0; k < 24; k++) { const pa = TAU / 24 * k; burst(h.x + Math.cos(pa) * h.r * 1.06, h.y + Math.sin(pa) * h.r * 1.06, 2, SPLASH, { sp: 60, up: 50, g: 200, life: 0.5 }); }
        shake(6); AudioMan.splash(); AudioMan.boom();
      }
      if (h.t < 3 && Math.random() < dt * 40) { // 水の流れ(引き = 内向き / 押し = 外向き)
        const pa = rand(0, TAU), pr = rand(0.3, 1) * h.r, v = h.t < 2 ? -50 : 90;
        part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr, Math.cos(pa) * v, Math.sin(pa) * v, 0.5, pick(['#bff4ff', '#7ad7ff', '#ffffff']), { drag: 0.5 });
      }
    } else if (h.kind === 'tsunami') { // 大津波(深淵の海竜): 画面を横切る波。岩礁の陰(幅 26・長さ 60)には当たらない
      const c = Math.cos(h.th), s = Math.sin(h.th);
      h.pd = h.d; h.d = h.t * 150;
      const along = (P.x - h.x) * c + (P.y - h.y) * s, side = -(P.x - h.x) * s + (P.y - h.y) * c;
      if (!h.hit && along > h.pd - 8 && along < h.d + 4 && Math.abs(side) < h.span) {
        const safe = h.reefs.some(r => along > r.along && along - r.along < 60 * CHAOS.area && Math.abs(side - r.side) < 13 * CHAOS.area);
        if (!safe && hurtPlayer(h.dmg)) { h.hit = true; drainSta(30); pushPlayer(h.th, 50, 0.3); }
      }
      for (const r of h.reefs) if (!r.gone && h.d > r.along + 70) { // 波が通った岩礁は崩れる
        r.gone = true; r.t = r.dur;
        burst(r.x, r.y, 20, ['#3a4a50', '#5a6a6a', '#8a9a9a', '#bff4ff'], { sp: 90, up: 30, g: 220, life: 0.6 }); AudioMan.thud();
      }
      for (let k = 0; k < 6; k++) { const sd = rand(-h.span, h.span); part(h.x + c * h.d - s * sd, h.y + s * h.d + c * sd, c * rand(80, 160) + rand(-20, 20), s * rand(80, 160) - rand(20, 60), 0.5, pick(SPLASH), { g: 160, drag: 1 }); }
    } else if (h.kind === 'wpillar') { // 水柱(深淵の海竜): プレイヤーへゆっくり寄る。触れると ×0.6・スタミナ −15 で崩れる
      const d = Math.sqrt(dd);
      if (d > 1 && h.t < h.dur - 0.3) { const k = Math.min(d, 40 * dt); h.x += (P.x - h.x) / d * k; h.y += (P.y - h.y) / d * k; }
      if (d < h.r + 3 && h.t < h.dur - 0.3 && hurtPlayer(h.dmg * 0.6)) {
        drainSta(15); h.t = h.dur - 0.3;
        burst(h.x, h.y, 24, SPLASH, { sp: 110, up: 50, g: 200, life: 0.6 }); AudioMan.splash();
      }
      if (Math.random() < dt * 30) part(h.x + rand(-h.r, h.r) * 0.6, h.y - rand(0, 30), rand(-10, 10), -rand(20, 50), 0.5, pick(SPLASH), { drag: 1 });
    } else if (h.kind === 'ringgear') { // リングギア(番人): 降りてから 10秒、番人を軸に回る。輪の帯に触れると ×0.9
      const on = h.t >= h.land && h.t < h.dur - 0.4;
      if (on && !h.landed) { // 着地: 輪にそって土ぼこりと火花、揺れ
        h.landed = true;
        for (let k = 0; k < 40; k++) { const pa = TAU / 40 * k; burst(h.x + Math.cos(pa) * h.r, h.y + Math.sin(pa) * h.r, 2, ['#c8a050', '#8a7a60', '#ffd27a', '#5a4a30'], { sp: 70, up: 40, g: 220, life: 0.6 }); }
        addRing(h.x, h.y, h.r, '#ffd27a', { w: 3, life: 0.4 }); addRing(h.x, h.y, h.r + 10, '#c8a050', { w: 2, life: 0.55 });
        shake(9); AudioMan.boom(); AudioMan.thud();
      }
      if (on && Math.abs(Math.sqrt(dd) - h.r) < h.w / 2 + 3) hurtPlayer(h.dmg);
      if (on && (h.snd = (h.snd || 0) - dt) <= 0) { h.snd = 0.6; AudioMan.tick(5); } // 歯車の回る音
      if (on && Math.random() < dt * 14) { const pa = rand(0, TAU), rr = h.r - h.w / 2; part(h.x + Math.cos(pa) * rr, h.y + Math.sin(pa) * rr, -Math.sin(pa) * h.dir * 30, Math.cos(pa) * h.dir * 30, 0.3, pick(['#ffd27a', '#fff0c8']), { glow: true, drag: 2 }); } // 歯の火花
    } else if (h.kind === 'gearfloor') { // 歯車の床(番人): 上にいると回る向きへ流される(毎秒 50)
      const d = Math.sqrt(dd);
      if (d < h.r && d > 1 && h.t < h.dur - 0.2 && !P.dead && state === 'play' && P.invT <= 0) { const vx = -(P.y - h.y) / d * h.dir * 50, vy = (P.x - h.x) / d * h.dir * 50; P.x += vx * dt; P.y += vy * dt; }
      if (Math.random() < dt * 6) { const pa = rand(0, TAU); part(h.x + Math.cos(pa) * h.r, h.y + Math.sin(pa) * h.r, -Math.sin(pa) * h.dir * 40, Math.cos(pa) * h.dir * 40, 0.3, '#ffd27a', { glow: true, drag: 2 }); } // 縁の火花
    } else if (h.kind === 'ice') { // 滑る床(霜の巨人・氷柱の墓標): 上では向きを変えるのに慣性がかかる
      if (h.spire && h.spire.dead && h.t < h.dur - 0.3) h.t = h.dur - 0.3; // 氷柱の墓標: 氷柱が砕けたら床も消える
      if (dd < h.r * h.r && h.t < h.dur - 0.2) P.iceT = 0.1;
      if (Math.random() < dt * 5) { const pa = rand(0, TAU), pr = Math.sqrt(Math.random()) * h.r; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr * 0.8, 0, -2, 0.5, '#ffffff', { glow: true, drag: 1 }); }
    } else if (h.kind === 'snow' || h.kind === 'drift') { // 雪の床(イエティ)/ 地吹雪(霜の巨人の周り): 中にいると 1秒ごとに凍傷 +1
      const R = h.r * Math.min(1, h.t * 6);
      if (dd < R * R && h.t < h.dur - 0.2 && (h.tick -= dt) <= 0) { h.tick = 1; frostPlayer(1); }
      if (h.kind === 'drift') for (let k = 0; k < 2; k++) { const pa = rand(0, TAU), pr = rand(0.2, 1) * R; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr, -Math.sin(pa) * 70, Math.cos(pa) * 70 - 10, 0.5, pick(SNOW), { drag: 1.5 }); } // 渦を巻く雪
    } else if (h.kind === 'blizzard') { // 吹雪の風(霜の巨人): 巨人の向きへ毎秒 45 押し、1秒ごとに凍傷 +1。氷塊の風下では受けない
      const lee = inLee(h.th), c = Math.cos(h.th), s = Math.sin(h.th);
      S.lee = lee;
      if (!lee && !P.dead && state === 'play' && P.invT <= 0) { P.x += c * 45 * dt; P.y += s * 45 * dt; }
      if ((h.tick -= dt) <= 0) { h.tick = 1; if (!lee) frostPlayer(1); }
      for (let k = 0; k < 5; k++) { // 画面を吹き抜ける雪
        const x = cam.x + rand(-20, GFX.VW + 20) - c * 40, y = cam.y + rand(-20, GFX.VH + 20) - s * 40;
        part(x, y, c * rand(140, 220) + rand(-10, 10), s * rand(140, 220) + rand(-10, 10), rand(0.4, 0.8), pick(SNOW), { drag: 0 });
      }
    } else if (h.kind === 'aval') { // 雪崩(霜の巨人): 帯を雪の塊が転がる。×1.0・凍傷 +3
      const c = Math.cos(h.th), s = Math.sin(h.th);
      h.d = h.t * 130;
      const along = (P.x - h.x) * c + (P.y - h.y) * s, side = -(P.x - h.x) * s + (P.y - h.y) * c;
      if (!h.hit && Math.abs(side) < h.w / 2 + 3 && Math.abs(along - h.d) < h.w / 2 + 2 && hurtPlayer(h.dmg)) { h.hit = true; frostPlayer(3); }
      for (let k = 0; k < 3; k++) { const sd = rand(-h.w / 2, h.w / 2); part(h.x + c * (h.d - 6) - s * sd, h.y + s * (h.d - 6) + c * sd, -c * rand(20, 60) + rand(-20, 20), -s * rand(20, 60) - rand(10, 40), 0.6, pick(SNOW), { g: 120, drag: 1 }); } // 巻き上がる雪煙
    } else if (h.kind === 'icering') { // 縮む氷輪(雪華の女王): 輪に触れると ×0.8・凍傷 +2
      h.rr = h.r0 * Math.max(0, 1 - h.t / h.dur);
      if (!h.hit && Math.abs(Math.sqrt(dd) - h.rr) < 5 && hurtPlayer(h.dmg)) { h.hit = true; frostPlayer(2); }
      for (let k = 0; k < 3; k++) { const pa = rand(0, TAU); part(h.x + Math.cos(pa) * h.rr, h.y + Math.sin(pa) * h.rr, 0, -rand(6, 14), 0.4, pick(SNOW), { glow: true, drag: 1 }); }
    } else if (h.kind === 'veil') { // 吹雪の帳(雪華の女王): 縁から毎秒 spd で凍りつく。凍った所にいると 0.5秒ごとに凍傷 +2・×0.2
      h.cur = Math.max(h.Rmin, h.R - h.spd * h.t);
      if (dd > h.cur * h.cur && h.t < h.dur - 0.3 && (h.tick -= dt) <= 0) { h.tick = 0.5; frostPlayer(2); hurtPlayer(h.dmg); }
      for (let k = 0; k < 3; k++) { const pa = rand(0, TAU), pr = h.cur + rand(0, 40); part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr, -Math.cos(pa) * 20, -Math.sin(pa) * 20, 0.6, pick(SNOW), { glow: true, drag: 1 }); } // 凍った縁から吹きこむ雪
    }
    if (h.t >= h.dur) hazards.splice(i, 1);
  }
}
