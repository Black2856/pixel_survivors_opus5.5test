// player.js — プレイヤー(移動・ダッシュ・被弾・回復・状態異常・経験値)
'use strict';

// ============================================================
// プレイヤー
// ============================================================
function updPlayer(dt) {
  let [mx, my] = moveInput();
  if (P.rootT > 0) { P.rootT -= dt; if (P.invT > 0) P.rootT = 0; mx = my = 0; } // 絡め取り(クラーケン): 動けない。回避の無敵で抜けられる
  if (P.frzT > 0) mx = my = 0; // 凍結(凍傷が上限に達した): 歩けない。回避・防御スキル・E・Q・攻撃もできない(defHeld・atkLock)
  P.moving = mx !== 0 || my !== 0;
  if (P.moving) { P.dir = [mx, my]; if (mx) P.facing = mx > 0 ? 1 : -1; }
  const aim = mouseAimPt();
  if (aim && aim.x !== P.x) P.facing = aim.x > P.x ? 1 : -1; // 照準中はマウス側を向く(アックスの投擲方向も追従)
  asMine(() => clsUpdate(dt)); // クラス・スキルの処理(Q・E・回避・乱れ桜・火炎放射など)の演出は自分の攻撃(「攻撃の濃さ」の対象)
  const sp = P.speed * P.moveMul * (P.slowT > 0 ? P.slowK || DATA.debuff.slow : 1) * playerFrostMul();
  let vx = mx * sp, vy = my * sp;
  if (P.iceT > 0) { // 滑る床(霜の巨人): 向きを変えるのに 0.35秒の慣性がかかる
    P.iceT -= dt;
    const k = Math.min(1, dt / 0.35);
    P.ivx += (vx - P.ivx) * k; P.ivy += (vy - P.ivy) * k; vx = P.ivx; vy = P.ivy;
    if (Math.hypot(vx, vy) > 20 && Math.random() < dt * 20) part(P.x + rand(-3, 3), P.y + 7, -vx * 0.2, -rand(2, 8), 0.35, pick(['#ffffff', '#bff4ff']), { drag: 3 }); // 氷の上を滑る削りくず
  } else { P.ivx = vx; P.ivy = vy; }
  P.x += vx * dt; P.y += vy * dt;
  if (P.current && P.current.t > 0) { // 海流(深淵の海竜)・風神の風(雷神): 一定の向きへ流される(ダッシュなら逆らえる)。cols: 流れの粒の色
    P.current.t -= dt; P.x += P.current.vx * dt; P.y += P.current.vy * dt;
    if (Math.random() < dt * 20) part(P.x + rand(-6, 6), P.y + rand(-4, 6), P.current.vx * 1.5, P.current.vy * 1.5, 0.4, pick(P.current.cols || ['#bff4ff', '#7ad7ff']), { drag: 1 });
  }
  if (P.push) { // ボスの押し出し・引き寄せ(回避の無敵で打ち消せる)
    if (P.invT > 0 || P.dead) P.push = null;
    else {
      const k = Math.min(dt, P.push.t);
      P.x += P.push.vx * k; P.y += P.push.vy * k; P.push.t -= dt;
      if (Math.random() < dt * 40) part(P.x + rand(-3, 3), P.y + 6, -P.push.vx * 0.15 + rand(-8, 8), -rand(4, 14), 0.35, pick(['#c8b8a0', '#8a8098', '#ffffff']), { drag: 3 }); // 足元の土煙
      if (P.push.t <= 0) P.push = null;
    }
  }
  if (P.after) for (const a of P.after) a.t += dt;
  if (P.after) P.after = P.after.filter(a => a.t < 0.25);
  P.animT += dt * (P.moving ? 1 : 0.35);
  P.ifr -= dt; P.hurtT -= dt;
  updDebuffs(dt);
  const rg = P.regen + clsRegen(); // クラスの一時的な HP回復速度(バーサーカーの昂り・狂乱など)
  if (rg > 0 && !(P.noHealT > 0)) { const n = rg * dt * clsHealMul() * (P.burnT > 0 ? DATA.debuff.burnHeal : 1) * (P.cdSlowT > 0 ? DATA.debuff.slowRegen : 1); S.healed = (S.healed || 0) + n; overheal(P.hp + n - P.maxhp); P.hp = Math.min(P.maxhp, P.hp + n); } // 満タンで余った分は超過回復
  updOverShield(dt); // 聖盾のシールドは得た分ごとに時間で消える
  if (P.uq.ward && (P.wardT = (P.wardT || 0) - dt) <= 0) { P.wardT = 30; timedShield(P.maxhp * 0.1, 30); } // 守護の: ラン開始時と 30秒ごとに、次まで持つシールド
  if (P.moving && Math.random() < dt * 10) part(P.x + rand(-2, 2), P.y + 6, rand(-6, 6), rand(-8, -2), 0.35, '#8a8098', { drag: 4 });
  GFX.fx.lowhp = lerp(GFX.fx.lowhp, P.hp / P.maxhp < 0.3 ? 1 : 0, dt * 3);
}

// 状態異常(ボス由来): 粘液・スロウタイムの減速 / CD回復低下、炎上の継続ダメージ(無敵時間を無視)
function updDebuffs(dt) {
  P.slowT -= dt; P.cdSlowT -= dt;
  if (P.fatigueT > 0) { P.fatigueT -= dt; if (Math.random() < dt * 6) part(P.x + rand(-5, 5), P.y - 8 + rand(-2, 2), rand(-6, 6), rand(4, 12), 0.5, pick(['#7ad7ff', '#bff4ff']), { g: 80 }); } // 疲労: 汗のしずく
  if (P.frzT > 0) { P.frzT -= dt; if (Math.random() < dt * 18) part(P.x + rand(-5, 5), P.y + rand(-6, 6), 0, 6, 0.5, pick(['#ffffff', '#9ff7ff']), { glow: true, drag: 1 }); } // 凍結: 氷の粒がこぼれる
  if (P.slowT > 0 && Math.random() < dt * 8) part(P.x + rand(-3, 3), P.y + 6, 0, 8, 0.4, P.cdSlowT > 0 ? '#c29bff' : '#4fd6a8', { glow: P.cdSlowT > 0 });
  updFrostBleed(dt);
  updChain(dt); // 冥鎖(影の王)
  if (P.burnT <= 0) return;
  P.burnT -= dt; P.burnTick -= dt;
  if (Math.random() < dt * 16) part(P.x + rand(-4, 4), P.y + rand(-4, 4), 0, -26, 0.4, pick(['#ff6a2a', '#ffc34a']), { glow: true });
  if (P.burnTick > 0) return;
  P.burnTick = DATA.debuff.burnTick;
  const dmg = Math.max(1, Math.round(P.burnDmg));
  P.hp -= dmg; breakCombo(); S.hudDirty = true;
  if (P.hp <= 0 && clsSaveLethal()) P.hp = 1; // 倒れるダメージをクラスが耐える(バーサーカーの不死の狂乱)
  addFloat(P.x, P.y - 10, String(dmg), '#ff8a3d');
  if (P.hp <= 0) playerDown();
}
// 自分への状態異常を防いだか: クラス(ナイトの金剛)か、固有効果「清浄の」(25%)
//   清浄の: 同じ種類は 1秒間、最初の判定を使い回す(毎フレーム付く減速などでも 25% になるように。金剛と同じ)
const resistDebuff = kind => clsResistDebuff(kind) || uqResist(kind);
function uqResist(kind) {
  if (!P.uq.purity) return false;
  const m = P.uqRes || (P.uqRes = {}), r = m[kind];
  if (r && S.time < r.until) return r.ok;
  const ok = Math.random() < 0.25;
  m[kind] = { until: S.time + 1, ok };
  if (ok) { addRing(P.x, P.y, 14, '#bff4ff', { life: 0.25 }); addFloat(P.x, P.y - 18, _t('耐性'), '#bff4ff', 0.8); }
  return ok;
}
function burnPlayer(dmg) {
  if (P.invT > 0 || P.dead || resistDebuff('burn')) return;
  dmg *= S.eatk ?? 1; // 攻撃してきた敵の攻撃力の倍率(ビッグクランチ)
  if (P.burnT <= 0) { P.burnTick = DATA.debuff.burnTick; P.burnDmg = 0; }
  P.burnT = DATA.debuff.burnDur * CHAOS.debuff; P.burnDmg = Math.max(P.burnDmg, dmg); // カオス: デバフの時間
}
function breakCombo() {
  if (S.combo >= 10) addFloat(P.x, P.y - 18, 'x' + S.combo, '#8a8098');
  S.combo = 0; S.comboT = 0;
}
// 自分の凍傷・出血(敵の技から)。どちらも最後に受けてから DATA.debuff.pDur 秒で全部消える
//   凍傷: 1スタックにつき移動速度 −pFrostSlow。pFrostMax に達すると凍結(pFrzT 秒)して 0 に戻る。凍結の間は付かない。減速を受けない状態(不屈)では付かない
//   出血: 1スタックにつき 1秒ごとに 最大HP × pBleed(最大 pBleedMax スタック)。防御力・シールドでは減らない
const playerFrostMul = () => Math.max(0.2, 1 - DATA.debuff.pFrostSlow * P.frost);
function frostPlayer(n) {
  if (!(n > 0) || P.invT > 0 || P.dead || P.frzT > 0 || clsSlowImmune() || resistDebuff('frost')) return;
  const D = DATA.debuff, was = P.frost;
  P.frost = Math.min(D.pFrostMax, P.frost + n); P.frostT = D.pDur * CHAOS.debuff;
  burst(P.x, P.y - 4, 6 + n * 3, ['#bff4ff', '#ffffff', '#7ad7ff'], { sp: 50, glow: true, life: 0.4 }); // 霜が弾ける
  S.hudDirty = true;
  if (P.frost >= D.pFrostMax) { P.frost = 0; P.frostT = 0; freezePlayer(D.pFrzT); return; } // 上限: 凍りついて 0 に戻る
  if (Math.floor(was / 4) < Math.floor(P.frost / 4)) { addRing(P.x, P.y, 14, '#9ff7ff', { life: 0.3 }); AudioMan.frost(); } // 4スタックごとに凍みる音
}
// 減速(粘液・スロウタイム・時の歪み): k = 移動速度の倍率(重なったら強い方)。cd: クールダウンの回復も遅くする。減速を受けない状態(不屈)では付かない
function slowPlayer(k, t, cd) {
  if (P.dead || clsSlowImmune() || resistDebuff('slow')) return;
  P.slowK = P.slowT > 0 ? Math.min(P.slowK || 1, k) : k;
  P.slowT = Math.max(P.slowT, t);
  if (cd) P.cdSlowT = Math.max(P.cdSlowT, t);
}
// 凍結(凍傷が上限に達した): t 秒、行動不能(歩く・回避・防御スキル・E・Q)・攻撃不能(atkLock)。凍結の間は凍傷が付かない
function freezePlayer(t) {
  if (P.dead) return;
  P.frzT = Math.max(P.frzT, t * CHAOS.debuff);
  addRing(P.x, P.y, 12, '#9ff7ff', { life: 0.3 }); addRing(P.x, P.y, 22, '#3a6a7a', { life: 0.4 }); burst(P.x, P.y - 2, 14, ['#ffffff', '#bff4ff', '#7ad7ff'], { sp: 60, glow: true, life: 0.4 }); AudioMan.frost(); AudioMan.crush(); // 外の輪は暗い色(光の層で白く飛ばさない)
  S.hudDirty = true;
  hint('pfrz', _t('凍結'), _t('凍傷がたまりきると凍りつき、少しの間 動けず、攻撃もできない'));
}
// 痺れ(雷鳴の雲海): 1スタックにつきクールダウンの回復 −numbCd(武器の攻撃間隔と E・Q)。numbMax に達すると麻痺して 0 に戻る。麻痺の間は付かない
function numbPlayer(n) {
  if (!(n > 0) || P.invT > 0 || P.dead || P.paraT > 0 || resistDebuff('numb')) return;
  const D = DATA.debuffStage;
  P.numb = Math.min(D.numbMax, P.numb + n); P.numbT = DATA.debuff.pDur * CHAOS.debuff;
  for (let i = 0; i < 2 + Math.min(4, n); i++) { const a = rand(0, TAU), r = rand(6, 12); bolts.push({ x0: P.x, y0: P.y - 4, x1: P.x + Math.cos(a) * r, y1: P.y - 4 + Math.sin(a) * r, t: 0, life: 0.12, w: 1, jit: 2, gcol: '#6a5a14' }); } // 体を走る火花(光は暗い黄色: 体を白く飛ばさない)
  AudioMan.zap(); S.hudDirty = true;
  if (P.numb >= D.numbMax) { P.numb = 0; P.numbT = 0; paralyzePlayer(D.paraT); return; } // 上限: 麻痺して 0 に戻る
  hint('pnumb', _t('痺れ'), _t('クールダウンの回復が遅くなる。たまりきると麻痺して、しばらく攻撃できない'));
}
// 麻痺(痺れが上限に達した): t 秒、攻撃不能(atkLock。歩く・回避はできる)。E・Q のクールダウンが最初からになる(麻痺の間も回復する)
function paralyzePlayer(t) {
  if (P.dead) return;
  P.paraT = Math.max(P.paraT, t * CHAOS.debuff);
  clsResetSkillCd();
  for (let i = 0; i < 5; i++) { const a = TAU / 5 * i + rand(-0.3, 0.3), r = rand(10, 15); bolts.push({ x0: P.x + Math.cos(a) * 5, y0: P.y - 4 + Math.sin(a) * 5, x1: P.x + Math.cos(a) * r, y1: P.y - 4 + Math.sin(a) * r, t: 0, life: 0.15, w: 1, jit: 2, gcol: '#6a5a14' }); } // 体から外へ散る稲妻(体は隠さない)
  addRing(P.x, P.y, 20, '#8a7a24', { w: 1, life: 0.35 }); addFlash(P.x, P.y, 30, '#6a5a14', 0.2); AudioMan.zap(); AudioMan.thud(); // 光の層は色で明るさが決まるので暗い黄色(体を白く飛ばさない)
  S.hudDirty = true;
  hint('ppara', _t('麻痺'), _t('しばらく攻撃できない。E・Q のクールダウンも最初からになる'));
}
// 砂塵(陽炎の砂海): 1スタックにつき命中率 −dustHit(dustMax まで)
function dustPlayer(n) {
  if (!(n > 0) || P.invT > 0 || P.dead || resistDebuff('dust')) return;
  const D = DATA.debuffStage;
  P.dust = Math.min(D.dustMax, P.dust + n); P.dustT = DATA.debuff.pDur * CHAOS.debuff;
  burst(P.x, P.y - 4, 8 + n * 3, ['#e8c88a', '#c8a060', '#fff0c8'], { sp: 55, life: 0.45, drag: 2 }); // 砂が顔にかかる
  AudioMan.sand(); S.hudDirty = true;
  hint('pdust', _t('砂塵'), _t('攻撃が外れやすくなる'));
}
// 衰弱(木漏れ日の森): 1スタックにつき攻撃力 −weakAtk(weakMax まで。与えるダメージに掛ける)
function weakPlayer(n) {
  if (!(n > 0) || P.invT > 0 || P.dead || resistDebuff('weak')) return;
  const D = DATA.debuffStage;
  P.weak = Math.min(D.weakMax, P.weak + n); P.weakT = DATA.debuff.pDur * CHAOS.debuff;
  for (let i = 0; i < 6 + n * 2; i++) part(P.x + rand(-5, 5), P.y - 8 + rand(-3, 3), rand(-12, 12), rand(10, 30), rand(0.4, 0.6), pick(['#8aa070', '#5a6a48', '#c8d8a0']), { drag: 1.5 }); // 力が抜けて落ちる胞子
  AudioMan.drain(); S.hudDirty = true;
  hint('pweak', _t('衰弱'), _t('与えるダメージが下がる。受けないでいると消える'));
}
// 攻撃不能(凍結・麻痺・ラストラディアンスの封印): 武器の攻撃が止まり、E・Q を使えず、攻撃が当たらない(hitEnemy)
const atkLock = () => P.frzT > 0 || P.paraT > 0 || P.lockT > 0;
// クールダウンの回復の速さ(武器の攻撃間隔と E・Q): スロウタイム・時の歪みは ×cdRate、痺れは 1スタックにつき −numbCd(掛け算)
const cdRateK = () => (P.cdSlowT > 0 ? DATA.debuff.cdRate : 1) * Math.max(0, 1 - DATA.debuffStage.numbCd * P.numb);
// 命中率: 砂塵 1スタックにつき −dustHit、暗闇の間 −darkHit(足し算)。外れると当たったときの効果も出ない(hitEnemy)
const hitRate = () => Math.max(0, 1 - DATA.debuffStage.dustHit * P.dust - (P.darkT > 0 ? DATA.debuffTomb.darkHit : 0));
// 衰弱: 与えるダメージの倍率(hitEnemy。継続ダメージには掛けない)
const weakMul = () => Math.max(0, 1 - DATA.debuffStage.weakAtk * P.weak);
function bleedPlayer(n) {
  if (!(n > 0) || P.invT > 0 || P.dead || resistDebuff('bleed')) return;
  if (P.bleed <= 0) P.bleedTick = 1;
  P.bleed = Math.min(DATA.debuff.pBleedMax, P.bleed + n); P.bleedT = DATA.debuff.pDur * CHAOS.debuff;
  for (let i = 0; i < 6 + n * 3; i++) part(P.x + rand(-3, 3), P.y - 4 + rand(-3, 3), rand(-50, 50), rand(-70, -20), rand(0.35, 0.6), pick(['#a0122a', '#ff3b5c', '#5a0a14']), { g: 240, drag: 1.5, sz: pick([1, 2]) }); // 血しぶき
  S.hudDirty = true;
}
// 毒(王墓): 1スタックにつき最大HP −poison(poisonMax まで)。今の HP も同じだけ減る(毒では倒れない: HP 1 で止まる)
//   最後に受けてから poisonDur 秒で全部消え、最大HP は戻る(減った HP は戻らない)。防御力・シールドでは減らない
function poisonPlayer(n) {
  if (!(n > 0) || P.invT > 0 || P.dead || resistDebuff('poison')) return;
  const D = DATA.debuffTomb, add = Math.min(n, D.poisonMax - P.poison);
  P.poisonT = D.poisonDur * CHAOS.debuff;
  if (add > 0) {
    const mx0 = P.maxhp, hp0 = P.hp;
    P.poison += add; recalc();
    const lost = mx0 - P.maxhp;
    P.hp = Math.min(P.maxhp, Math.max(Math.min(1, hp0), hp0 - lost));
    if (lost >= 1) addFloat(P.x, P.y - 10, String(Math.round(lost)), '#b46aff');
    GFX.fx.hurt = Math.max(GFX.fx.hurt, 0.3);
  }
  for (let i = 0; i < 6 + n * 4; i++) part(P.x + rand(-4, 4), P.y - 4 + rand(-4, 4), rand(-40, 40), rand(-60, -15), rand(0.4, 0.7), pick(['#7dff6a', '#3aa83a', '#9a7dff', '#5a2a8a']), { glow: Math.random() < 0.5, g: 120, drag: 1.5 }); // 毒のしぶき
  addRing(P.x, P.y, 12, '#7dff6a', { life: 0.25 });
  AudioMan.poison(); S.hudDirty = true;
  hint('ppoison', _t('毒'), _t('最大HP が下がる。受けないでいるか、肉を拾うと消える'));
}
// 暗闇(王墓): t 秒、周りが暗くなり(墨だまりと同じ。画面の端も少し暗くなる)、敵の攻撃の予告が見えない。命中率 −darkHit(hitRate)。また受けると t 秒に戻る
function darkPlayer(t) {
  if (!(t > 0) || P.invT > 0 || P.dead || resistDebuff('dark')) return;
  const was = P.darkT > 0;
  P.darkT = Math.max(P.darkT, t * CHAOS.debuff);
  if (!was) { // 闇が体を包む: 黒紫の霧が渦を巻いて吸い込まれる
    for (let i = 0; i < 26; i++) { const a = rand(0, TAU), r = rand(14, 30); part(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r * 0.8, -Math.cos(a) * r * 2.5, -Math.sin(a) * r * 2, 0.45, pick(['#1a0a2a', '#2a1240', '#5a2a8a', '#c79bff']), { glow: Math.random() < 0.25, drag: 1 }); }
    addRing(P.x, P.y, 26, '#7a3ab0', { r0: 40, w: 2, life: 0.35 }); AudioMan.blind();
  }
  S.hudDirty = true;
  hint('pdark', _t('暗闇'), _t('周りが暗くなり、攻撃の予告が見えない。自分の攻撃も外れやすくなる'));
}
// 乱光(天光の聖堂): n 回、下の状態異常からランダムに 1つずつ付ける(同じものが続くこともある)。乱光そのものに効果はない(HUD には付いた状態異常が出る)
//   1回分: 凍傷 +1・痺れ +1・砂塵 +1・衰弱 +1・出血 +1・毒 +1・炎上(src × 0.1 を 0.5秒ごと・3秒)・暗闇・疲労。src: 攻撃した敵のダメージ(炎上の量)
//   ほかの状態異常と同じく、回避の無敵中は付かない。付いたものは頭上に名前が浮かぶ(多いときはまとめて「乱光 ×n」)
const LIGHT_PICK = [
  { k: 'frost', name: () => _t('凍傷'), col: '#9ff7ff' }, { k: 'numb', name: () => _t('痺れ'), col: '#fff27a' }, { k: 'dust', name: () => _t('砂塵'), col: '#e8c88a' },
  { k: 'weak', name: () => _t('衰弱'), col: '#b8d08a' }, { k: 'bleed', name: () => _t('出血'), col: '#ff5d73' }, { k: 'poison', name: () => _t('毒'), col: '#7dff6a' },
  { k: 'burn', name: () => _t('炎上'), col: '#ff9a3d' }, { k: 'dark', name: () => _t('暗闇'), col: '#c79bff' }, { k: 'fatigue', name: () => _t('疲労'), col: '#7ad7ff' },
];
function randomLight(n, src) {
  if (!(n > 0) || P.invT > 0 || P.dead) return;
  const got = [];
  for (let i = 0; i < n; i++) {
    const L = pick(LIGHT_PICK); got.push(L);
    if (L.k === 'frost') frostPlayer(1); else if (L.k === 'numb') numbPlayer(1); else if (L.k === 'dust') dustPlayer(1); else if (L.k === 'weak') weakPlayer(1);
    else if (L.k === 'bleed') bleedPlayer(1); else if (L.k === 'poison') poisonPlayer(1); else if (L.k === 'burn') burnPlayer((src || 10) * 0.1);
    else if (L.k === 'dark') darkPlayer(DATA.debuffTomb.darkDur);
    else fatiguePlayer();
  }
  // 七色にきらめく光の粒が体のまわりで弾け、付いた状態異常の名前が浮かぶ
  burst(P.x, P.y - 6, Math.min(26, 8 + n * 3), PRISM, { sp: 70, glow: true, life: 0.45 }); addRing(P.x, P.y - 4, 12, '#fff6c8', { r0: 4, life: 0.25 });
  if (n <= 3) got.forEach((L, i) => addFloat(P.x + (i - (got.length - 1) / 2) * 14, P.y - 22 - i * 3, L.name(), L.col, 1, -26));
  else addFloat(P.x, P.y - 24, _t`乱光 ×${n}`, '#fff6c8', 1, -26);
  AudioMan.sparkle();
  hint('plight', _t('乱光'), _t('状態異常がランダムに付く(凍傷・痺れ・砂塵・衰弱・出血・毒・炎上・暗闇・疲労)'));
}
// 疲労(スタミナを減らさずに): fatigueDur 秒、スタミナ回復 −50%(乱光・三原の光精の青い光)。青いしずくが散る
function fatiguePlayer() {
  if (P.invT > 0 || P.dead || resistDebuff('fatigue')) return;
  P.fatigueT = Math.max(P.fatigueT || 0, DATA.debuff.fatigueDur * CHAOS.debuff); S.hudDirty = true;
  for (let i = 0; i < 6; i++) part(P.x + rand(-4, 4), P.y - 4 + rand(-3, 3), rand(-30, 30), rand(-40, -10), 0.5, pick(['#7ad7ff', '#bff4ff', '#2a8ac8']), { g: 160, drag: 1 });
}
// 攻撃不能(ラストラディアンスの封印): t 秒、武器の攻撃が止まり E・Q を使えず、攻撃が当たらない(atkLock。歩く・回避はできる)。麻痺と違って E・Q のクールダウンは戻さない
function lockPlayer(t) {
  if (P.dead) return;
  P.lockT = Math.max(P.lockT, t); P.lockMax = Math.max(P.lockMax || 0, P.lockT); S.hudDirty = true;
  hint('plock', _t('攻撃不能'), _t('しばらく攻撃できない(歩く・回避はできる)'));
}
// 回復不能: t 秒、HP回復速度・肉・クラスの回復・回復のスキルが効かない(heal)。今は付ける技がない(ラストラディアンスの回復不能は 2026-10-13 にユーザーが外した)
function noHealPlayer(t) {
  if (P.dead) return;
  P.noHealT = Math.max(P.noHealT, t); P.noHealMax = Math.max(P.noHealMax || 0, P.noHealT); S.hudDirty = true;
  hint('pnoheal', _t('回復不能'), _t('しばらく HP が回復しない(肉・スキルの回復も)'));
}
// 眩惑(光の蝶 e が近くで光った): dz.t 秒、与えるダメージ −100%(hitEnemy。継続ダメージ・アイテムは除く。当たったときの効果は出る)
//   眩惑の間は掛け直さず、切れてから dz.imm 秒は眩惑にならない(蝶が続けて来ても、倒せる間を残す)。ほかの状態異常と同じく、回避の無敵中は付かない。付いたら true
function dazzlePlayer(e, dz) {
  if (P.invT > 0 || P.dead || P.dazImm > 0 || resistDebuff('daze')) return false;
  P.dazT = P.dazMax = dz.t * CHAOS.debuff; P.dazImm = P.dazT + dz.imm; S.hudDirty = true;
  // 蝶が弾けるように光る(画面は光らせない。明るい床で白く飛ぶため)
  burst(e.x, e.y - 2, 16, ['#fff6c8', '#ffe08a', '#ffffff', '#ffd27a'], { sp: 80, glow: true, life: 0.35 });
  addRing(e.x, e.y - 2, 16, '#fff6c8', { r0: 3, life: 0.25 }); addFlash(e.x, e.y - 2, 44, '#fff6c8', 0.5);
  burst(P.x, P.y - 9, 10, ['#ffffff', '#fff6c8'], { sp: 45, glow: true, life: 0.3 }); // 目の前で光の粒が弾ける(目がくらむ)
  addFloat(P.x, P.y - 22, _t('眩惑'), '#fff2b0', 1, -26);
  AudioMan.sparkle();
  hint('pdazzle', _t('眩惑'), _t`光の蝶が近くで光ると、${dz.t}秒 与えるダメージが 0 になる。近づかれる前に倒す`);
  return true;
}
// 自分の状態異常を全て消す(食べ物でデバフ解除): 炎上・凍傷・出血・減速・スロウタイム・凍結・疲労・毒・暗闇・痺れ・麻痺・砂塵・衰弱・眩惑。消えたものがあれば白緑の光
//   ボスの技の攻撃不能・回復不能(ラストラディアンス)は消さない
function cleansePlayer() {
  const had = P.burnT > 0 || P.frost > 0 || P.bleed > 0 || P.slowT > 0 || P.cdSlowT > 0 || P.frzT > 0 || P.fatigueT > 0 || P.poison > 0 || P.darkT > 0 || P.numb > 0 || P.paraT > 0 || P.dust > 0 || P.weak > 0 || P.dazT > 0, pz = P.poison > 0;
  P.burnT = 0; P.frost = 0; P.frostT = 0; P.bleed = 0; P.bleedT = 0; P.slowT = 0; P.cdSlowT = 0; P.frzT = 0; P.fatigueT = 0; P.poison = 0; P.poisonT = 0; P.darkT = 0;
  P.numb = 0; P.numbT = 0; P.paraT = 0; P.dust = 0; P.dustT = 0; P.weak = 0; P.weakT = 0; P.dazT = 0; P.dazMax = 0;
  if (pz) recalc(); // 毒で下がった最大HP を戻す
  if (!had) return;
  S.hudDirty = true;
  burst(P.x, P.y - 6, 16, ['#ffffff', '#c8ffd8', '#5dff8a'], { sp: 60, up: 30, glow: true, life: 0.45 }); addRing(P.x, P.y, 14, '#c8ffd8', { life: 0.3 });
  addFloat(P.x, P.y - 16, _t('浄化'), '#c8ffd8', 1);
}
function updFrostBleed(dt) {
  if (P.poison > 0) { // 毒: 受けないでいると全部消えて最大HP が戻る。積むほど緑と紫の泡が立つ
    if ((P.poisonT -= dt) <= 0) { P.poison = 0; P.poisonT = 0; recalc(); burst(P.x, P.y - 4, 12, ['#c8ffd8', '#7dff6a', '#ffffff'], { sp: 45, up: 20, glow: true, life: 0.4 }); }
    else if (Math.random() < dt * (3 + P.poison * 1.2)) part(P.x + rand(-5, 5), P.y + rand(-6, 4), rand(-4, 4), -rand(10, 22), rand(0.5, 0.8), pick(['#7dff6a', '#3aa83a', '#9a7dff']), { glow: Math.random() < 0.4, drag: 1 });
  }
  if (P.darkT > 0) { // 暗闇: 黒紫のもやが体にまとわりつく
    P.darkT -= dt;
    if (Math.random() < dt * 16) { const a = rand(0, TAU), r = rand(6, 14); part(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r * 0.7, -Math.sin(a) * 18, Math.cos(a) * 12 - 6, 0.6, pick(['#1a0a2a', '#2a1240', '#3a1a5a']), { drag: 1, sz: pick([1, 2]) }); }
    if (P.darkT <= 0) { P.darkT = 0; S.hudDirty = true; }
  }
  if (P.lockT > 0) { // 攻撃不能(ラストラディアンスの封印): 体のまわりを光の輪の枷が回る(render.js)、金の粒がこぼれる
    P.lockT -= dt;
    if (Math.random() < dt * 10) part(P.x + rand(-6, 6), P.y - 6 + rand(-4, 4), rand(-6, 6), rand(6, 14), 0.5, pick(['#ffe8a0', '#fff6c8', '#c8a050']), { glow: Math.random() < 0.5, drag: 1 });
    if (P.lockT <= 0) { P.lockT = 0; P.lockMax = 0; S.hudDirty = true; burst(P.x, P.y - 4, 18, ['#fff6c8', '#ffe8a0', '#ffffff'], { sp: 80, glow: true, life: 0.4 }); addRing(P.x, P.y, 16, '#ffe8a0', { r0: 8, life: 0.3 }); AudioMan.chime(); } // 枷が砕ける
  }
  if (P.noHealT > 0) { // 回復不能: 体から灰色の光の粒が抜けていく
    P.noHealT -= dt;
    if (Math.random() < dt * 6) part(P.x + rand(-5, 5), P.y - 2 + rand(-4, 4), rand(-4, 4), -rand(14, 26), 0.6, pick(['#8a8698', '#b8b4c8']), { drag: 1 });
    if (P.noHealT <= 0) { P.noHealT = 0; P.noHealMax = 0; S.hudDirty = true; }
  }
  if (P.dazImm > 0) P.dazImm = Math.max(0, P.dazImm - dt);
  if (P.dazT > 0) { // 眩惑: 目の前で光がまたたく(render.js)
    P.dazT -= dt;
    if (P.dazT <= 0) { P.dazT = 0; P.dazMax = 0; S.hudDirty = true; }
  }
  if (P.paraT > 0) { // 麻痺: 体に稲妻がまとわりつく
    P.paraT -= dt;
    if (Math.random() < dt * 14) { const a = rand(0, TAU), r = rand(5, 11); bolts.push({ x0: P.x + rand(-3, 3), y0: P.y - 6 + rand(-3, 3), x1: P.x + Math.cos(a) * r, y1: P.y - 4 + Math.sin(a) * r, t: 0, life: 0.08, w: 1, jit: 2, gcol: '#6a5a14' }); }
    if (P.paraT <= 0) { P.paraT = 0; S.hudDirty = true; }
  }
  if (P.numb > 0) { // 痺れ: 積むほど小さな火花が散る
    if ((P.numbT -= dt) <= 0) { P.numb = 0; P.numbT = 0; S.hudDirty = true; }
    else if (Math.random() < dt * (1 + P.numb * 0.4)) part(P.x + rand(-5, 5), P.y - 6 + rand(-4, 4), rand(-20, 20), rand(-20, 5), 0.18, pick(['#fff27a', '#ffffff']), { glow: true, drag: 2 });
  }
  if (P.dust > 0) { // 砂塵: 体のまわりを砂が流れる
    if ((P.dustT -= dt) <= 0) { P.dust = 0; P.dustT = 0; S.hudDirty = true; }
    else if (Math.random() < dt * (2 + P.dust)) part(P.x + rand(-7, 7), P.y - 4 + rand(-6, 4), rand(14, 28) * pick([-1, 1]), rand(-4, 4), 0.4, pick(['#e8c88a', '#c8a060']), { drag: 1.5 });
  }
  if (P.weak > 0) { // 衰弱: 力が抜ける(くすんだ胞子が落ちる)
    if ((P.weakT -= dt) <= 0) { P.weak = 0; P.weakT = 0; S.hudDirty = true; }
    else if (Math.random() < dt * (1.5 + P.weak * 0.3)) part(P.x + rand(-5, 5), P.y - 8 + rand(-2, 2), rand(-4, 4), rand(8, 16), 0.6, pick(['#8aa070', '#5a6a48']), { drag: 1 });
  }
  if (P.frost > 0) {
    if ((P.frostT -= dt) <= 0) { P.frost = 0; burst(P.x, P.y, 10, ['#bff4ff', '#ffffff'], { sp: 40, life: 0.3 }); S.hudDirty = true; } // 溶けて消える
    else if (Math.random() < dt * (3 + P.frost)) part(P.x + rand(-5, 5), P.y + rand(-8, 4), rand(-4, 4), rand(4, 12), 0.6, pick(['#ffffff', '#bff4ff', '#9ff7ff']), { glow: true, drag: 1 }); // 積むほど霜が舞う
  }
  if (P.bleed > 0) {
    if ((P.bleedT -= dt) <= 0) { P.bleed = 0; S.hudDirty = true; return; }
    if (Math.random() < dt * (4 + P.bleed * 2)) part(P.x + rand(-3, 3), P.y + rand(-4, 2), rand(-6, 6), 10, 0.5, pick(['#a0122a', '#5a0a14']), { g: 160, sz: pick([1, 2]) }); // したたる血
    if ((P.bleedTick -= dt) > 0) return;
    P.bleedTick = 1;
    const dmg = Math.max(1, Math.round(P.maxhp * DATA.debuff.pBleed * P.bleed));
    P.hp -= dmg; breakCombo(); S.hudDirty = true; GFX.fx.hurt = Math.max(GFX.fx.hurt, 0.35);
    if (P.hp <= 0 && clsSaveLethal()) P.hp = 1;
    addFloat(P.x, P.y - 10, String(dmg), '#c8102e');
    if (P.hp <= 0) playerDown();
  }
}

// シールド: P.shield(魔力障壁など。時間では消えない)+ P.oShield(時間で消える。聖盾の 10秒・守印 5秒など)。合計は最大HP まで
// P.oChunks = [{ v, t, dur }](得た順)。少しずつ得る分は、同じ長さで1秒以内なら同じかたまりにまとめる
const shieldTotal = () => (P.shield || 0) + (P.oShield || 0);
// シールドの上限: クラスが決める(ナイトは最大HP の 50% など)。無ければ最大HP
const shieldCap = () => (typeof clsShieldCap === 'function' ? clsShieldCap() : P.maxhp);
function timedShield(n, dur) {
  const v = Math.min(n * clsShieldGain(), shieldCap() - shieldTotal()), last = P.oChunks[P.oChunks.length - 1];
  if (v <= 0) return;
  if (last && last.dur === dur && last.t > dur - 1) last.v += v; else P.oChunks.push({ v, t: dur, dur });
  P.oShield += v; S.hudDirty = true;
}
// 最大HP を超えた回復量(聖盾の: 20% を10秒のシールドに)
function overheal(n) { if (!(n > 0)) return; if (P.uq.aegis) timedShield(n * 0.2, 10); clsOnOverheal(n); } // 聖盾の / クレリックの祈り
function updOverShield(dt) {
  if (!P.oChunks.length) return;
  for (const c of P.oChunks) c.t -= dt;
  for (const c of P.oChunks) if (c.t <= 0) { P.oShield = Math.max(0, P.oShield - c.v); S.hudDirty = true; }
  P.oChunks = P.oChunks.filter(c => c.t > 0);
}
// 時間で消えるシールドを a だけ削る(古いかたまりから)
function takeOverShield(a) {
  P.oShield = Math.max(0, P.oShield - a);
  while (a > 0 && P.oChunks.length) { const c = P.oChunks[0], k = Math.min(c.v, a); c.v -= k; a -= k; if (c.v <= 1e-9) P.oChunks.shift(); }
}
// o.pierce: 被弾後の無敵(P.ifr)を無視する(連続技)。回避・防御スキルの無敵(P.invT)とガードでは防げる
// 弾(eprojs): p.pierce = 無敵無視 / p.light = 当たると乱光 +n(p.src: 撃った敵のダメージ。乱光の炎上の量)
const PIERCE = { pierce: true };
// o.touch: 敵の体に触れた(接触ダメージ)/ o.shot: 敵の弾。固有効果「白兵の」が見る(近距離 ×0.8・遠距離 ×1.2。どちらでもない技・床などは ×1)
const TOUCH = { touch: true }, SHOT = { shot: true }, SHOT_PIERCE = { shot: true, pierce: true };
// 返り値: 当たった(シールドで受けた場合も含む)なら true。無敵・ガードで防いだら false(炎上などの追加効果はこれを見る)
function hurtPlayer(dmg, o) {
  if ((P.ifr > 0 && !(o && o.pierce)) || P.invT > 0 || P.dead || state !== 'play') return false;
  dmg *= S.eatk ?? 1; // 攻撃してきた敵の攻撃力の倍率(ビッグクランチ)
  const r = clsOnHurt(dmg); // ガードなどでクラスが受けきった場合は null
  if (r === null) { S.hudDirty = true; return false; }
  dmg = Math.max(1, Math.round((r - P.armor) * (1 - P.dr) * (P.uq.brawl && o ? (o.touch ? 0.8 : o.shot ? 1.2 : 1) : 1))); // 白兵の
  // シールドが先に受ける。クラスの補正: シールドで受ける割合 sh.share(ナイトの痛み分け)・受けた 1 につき減る量 sh.k(鉄壁)
  const sh = clsShieldMod(), a = Math.min(Math.floor(shieldTotal() / sh.k), Math.round(dmg * sh.share)); // 整数で受ける。先に消える聖盾から
  if (a > 0) {
    const cost = Math.min(shieldTotal(), a * sh.k), fromO = Math.min(P.oShield || 0, cost);
    takeOverShield(fromO); P.shield = Math.max(0, P.shield - (cost - fromO));
    clsOnShieldLoss(cost);
    dmg -= a; S.hudDirty = true;
    addFloat(P.x, P.y - 10, String(a), '#7ab8ff', 1);
    burst(P.x, P.y, 8, ['#9fd8ff', '#4f8ff0', '#ffffff'], { sp: 60, glow: true, life: 0.3 });
    if (shieldTotal() < 1) { P.shield = P.oShield = 0; P.oChunks = []; addRing(P.x, P.y, 20, '#4f8ff0', { w: 2, life: 0.3 }); AudioMan.hit(); } // 割れた
    if (dmg <= 0) { P.ifr = P.iframe * clsIfrMul(); AudioMan.hit(); if (S.taint) shadowTaint(); return true; }
  }
  P.hp -= dmg; P.ifr = P.iframe * clsIfrMul(); P.hurtT = 0.12; // 被弾後の無敵時間(クラスの倍率: アストロマンサーの不動)
  if (P.hp <= 0 && clsSaveLethal()) P.hp = 1; // 倒れるダメージをクラスが耐える(バーサーカーの不死の狂乱)
  if (P.uq.adversity) P.sta = Math.min(P.maxSta, P.sta + dmg);
  breakCombo();
  GFX.fx.hurt = 1; GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.9);
  shake(4); AudioMan.hurt();
  addFloat(P.x, P.y - 10, String(dmg), '#ff4a5a', 1);
  burst(P.x, P.y, 10, ['#ff4a5a', '#ffffff', '#8a1a2a'], { sp: 70 });
  S.hudDirty = true;
  if (P.hp <= 0) playerDown();
  if (S.taint && !P.dead) shadowTaint();
  return true;
}
// 蝕む影(影の王。はじめから): 攻撃(技・接触)が当たるたびに、毒 +1(激昂 +2)と 50% で暗闇。影(呼んだボス)の攻撃では付かない
//   n = 毒の数(S.taint は影の王の技・体当たりの間だけ。弾は p.taint に持つ。0 = 付かない)
function shadowTaint(n = S.taint) { poisonPlayer(n); if (Math.random() < 0.5) darkPlayer(DATA.debuffTomb.darkDur); }
// 自分の技で受けるダメージ(HP を払う: ワイルドトマホークの代償・仁王立ちなど)。防御力・ダメージ軽減・シールドでは減らず、無敵時間も付かない
//   被弾として扱うクラスは clsSelfHurt で量を変える(バーサーカー: 怒り・昂り、不屈などの軽減)。自分の技では倒れない(HP は 1 未満にならない)
//   返り値: 実際に減った HP
function selfHurt(n) {
  if (P.dead) return 0;
  const d = Math.floor(Math.min(P.hp - 1, Math.max(1, Math.round(clsSelfHurt(n)))));
  if (d <= 0) return 0;
  P.hp -= d; P.hurtT = 0.12; S.hudDirty = true;
  addFloat(P.x, P.y - 10, String(d), '#ff4a5a', 1);
  const pm = FX_MINE; FX_MINE = false; // 被弾の表示なので「攻撃の濃さ」の対象にしない
  burst(P.x, P.y - 4, 8, ['#8e0016', '#5a000c', '#3a0008'], { sp: 60, life: 0.35 });
  FX_MINE = pm;
  return d;
}

function playerDown() {
  if (P.uq.phoenix && !P.revived) {
    P.revived = true; P.hp = P.maxhp * 0.25; P.ifr = 2;
    UI.announce('REVIVE', _t('不死鳥の加護')); AudioMan.evolve();
    screenFlash(0.6, '#ffb347'); shockAt(P.x, P.y, 2, 0.8); addRing(P.x, P.y, 60, '#ffb347', { w: 3, life: 0.6 });
    burst(P.x, P.y, 60, ['#ffb347', '#ff6a2a', '#ffffff'], { sp: 140, up: 60, glow: true, life: 1 });
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
    P.xp -= P.xpNext; P.level++; P.xpNext = xpFor(P.level); S.pendingLv++; S.lvQueue.push(P.level);
  }
  S.hudDirty = true;
}
