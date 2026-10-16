// damage.js — ダメージ・撃破(hitEnemy / killEnemy)
'use strict';

// ============================================================
// ダメージ・撃破
// ============================================================
// 直前の hitEnemy が外れた(または攻撃不能だった)敵。当たったときの効果(addBurn・addBleed・addFrost・mageAddEl)はこれを見て付けない
let missed = null;
// ダメージのない、効果だけの攻撃(ダメージ 0 の吹雪など)の命中判定。外れ・攻撃不能なら missed = e にして false
function rollHit(e) {
  missed = null;
  if (atkLock() || Math.random() >= hitRate()) { missed = e; return false; }
  return true;
}
// 固有効果で与えるダメージの倍率
//   奥義の: 通常攻撃(武器の自動攻撃。E は除く)×0.9、それ以外の自分の攻撃(E・Q・防御スキル・クラスの攻撃)×1.2。継続ダメージ・アイテムは変えない
//   破城の: ボスが出した壊せる物 ×1.25(金色の HP バーの物。冥犬の分かれた犬は本体なので除く)
function uqHitK(e, o) {
  let k = 1;
  if (P.uq.ougi && !o.dot && !o.item) k *= o.src && DATA.weapons[o.src] && !o.eHit ? 0.9 : 1.2;
  if (P.uq.siege && e.obj && !e.tiny && e.obj !== 'cdog') k *= 1.25;
  return k;
}
// o.dot: 継続ダメージ(外れない・衰弱を掛けない)/ o.item: アイテムの効果(爆弾。外れず、攻撃不能の間も当たる)
function hitEnemy(e, base, o = {}) {
  missed = null;
  if (e.dead) return 0;
  if (!o.dot && !o.item && atkLock()) { missed = e; return 0; } // 凍結・麻痺: 攻撃が当たらない(篝火も壊せない)
  if (e.prop) { killEnemy(e, o); return 0; }
  if (e.flying || e.invuln) return 0; // 空を飛んでいるボス(カオスドラゴンの空襲)・変身中の死神には当たらない
  if (!o.dot && !o.item && Math.random() >= hitRate()) { // 砂塵・暗闇: 外れ。ダメージも当たったときの効果もない
    missed = e;
    if (!o.noNum && !o.quiet) addFloat(e.x, e.y - e.r - 3, 'MISS', '#a8a8b8');
    return 0;
  }
  let dmg = (base + clsHitBonus(e, o)) * dmgMul() * clsDmgTaken(e, o) * wsDmgTaken(e) * (e.takeK || 1) * (1 - buffOn(e, 'def')) * (e.robeK ?? 1) * (o.dot ? 1 : weakMul()) * uqHitK(e, o); // 祈りの一撃などの追加 / 印・凍結・侵蝕などで敵が受けるダメージが増える / takeK: ボスの状態(岩の鎧・ひるみ・分裂など)/ フロストメイジのバフ / 衰弱 / 固有効果
  if (e.frost > 0 && P.weapons.blizzard && P.weapons.blizzard.evo) dmg *= 1 + 0.01 * e.frost;
  const daz = P.dazT > 0 && !o.dot && !o.item; // 眩惑(光の蝶): 与えるダメージ −100%(継続ダメージ・アイテムは除く)
  const crit = !daz && (o.forceCrit || (!o.noCrit && Math.random() < critRate() + clsCritBonus(e)));
  if (crit) dmg *= P.critMul + clsCritDmgBonus(e); else if (P.uq.exec) dmg *= 0.9; // 処刑人の
  dmg = e.robeK === 0 || daz ? 0 : Math.max(1, Math.round(dmg * rand(0.9, 1.1))); // 熾天使の光の衣が全部防いだ・眩惑: 0(当たったときの効果は起きる。状態異常で衣を破るため)
  e.hp -= dmg; e.flash = 0.08;
  if (e.hpFloor && e.hp < e.hpFloor) e.hp = e.hpFloor; // 影の王: 影がいる間は次の基準(4回目の影の間は HP 1)より下がらない
  if (e.obj === 'cdog') cerbSpill(e, Math.min(dmg, e.hp + dmg)); // 冥犬の犬(分裂形態): 本体にも ×0.2(犬の残りHP まで。とどめの余りは入れない)
  if (o.src && o.src === P.mainW) clsOnMainHit(e); // 通常攻撃(メイン武器)の命中
  if (o.eHit) clsOnEHit(e, dmg);                   // 武器スキル(E)の命中
  if (o.el) clsOnElement(e, o.el, dmg);             // 属性(メイジの元素循環)
  if (!o.dot && (o.eHit || (o.src && P.weapons[o.src]))) clsOnWeaponHit(e, dmg, crit, o); // 武器の命中(炎上などの継続ダメージは除く)
  P.totalDmg += dmg;
  if (o.src) P.dmgBy[o.src] = (P.dmgBy[o.src] || 0) + dmg;
  if (o.kb && o.ang !== undefined && !e.boss) {
    const k = o.kb * (1 - (e.kbRes || 0));
    e.kx += Math.cos(o.ang) * k; e.ky += Math.sin(o.ang) * k;
  }
  // quiet: 画面中の敵へまとめて当てる攻撃(ディメンション・リフト)。音・光を出さず、数字はクリティカルだけ
  if (crit) {
    addFloat(e.x, e.y - e.r - 3, dmg + '!', '#ffe14a', 1, -38);
    if (!o.quiet) { burst(e.x, e.y, 6, ['#ffe14a', '#ffffff'], { sp: 90, glow: true, life: 0.3 }); AudioMan.crit(); }
  } else {
    if (!o.noNum) addFloat(e.x, e.y - e.r - 3, String(dmg), dmg === 0 ? '#b8b0d8' : '#ffffff'); // 0(光の衣で防いだ・眩惑)は薄紫
    if (!o.quiet && Math.random() < 0.5) part(e.x + rand(-2, 2), e.y + rand(-2, 2), rand(-40, 40), rand(-40, 10), 0.25, o.col || '#ffffff', { glow: true });
    if (!o.quiet) AudioMan.hit();
  }
  if (e.boss) S.hudDirty = true;
  if (e.hp <= 0) { if (o.noKill) e.hp = 1; else killEnemy(e, o); } // noKill: 倒さずに HP 1 で残す(爆弾のエリート)
  return dmg;
}

function killEnemy(e, o = {}) {
  if (e.dead) return;
  if (e.shadow) return shadowDown(e); // 影の王が呼んだ影: 報酬なし・撃破数に数えない(死神の影も変身しない)
  if (e.hpFloor > 0) { e.hp = Math.max(e.hp, e.hpFloor); return; } // 影の王: 影がいる間は倒れない(異次元送りなども)
  if (e.boss === 'reaper' && !e.morphed) { startReaperMorph(e); return; } // 死神の第一形態は倒れると終刻の死神に変身する(報酬は第二形態で)
  e.dead = true;
  if (e.mound) return moundCrumble(e); // 砂人形の砂山: 攻撃が当たると崩れる(倒した扱いにしない)
  if (e.boss) return onBossDeath(e);
  if (e.obj) return objDown(e, true); // ボスが出した物(壊した)
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
  P.kills++; P.cxpK += rewMul(); // クラス経験値は倒したときの報酬の倍率で数える
  if (S.tower) S.tower.kills++; // タワー: その階の撃破数
  P.combo++; P.comboT = DATA.player.comboTime; P.bestCombo = Math.max(P.bestCombo, P.combo);
  if (P.combo % 100 === 0) { UI.announce(P.combo + ' COMBO!!', _t`ボーナス +${Math.round(P.combo / 10)}G`); addGold(P.combo / 10); }
  burst(e.x, e.y, e.elite ? 40 : 7, [col[0], col[1], '#ffffff'], { sp: e.elite ? 120 : 60, up: 15, g: 120, drag: 3 });
  part(e.x, e.y, 0, -20, 0.45, '#ffffff', { glow: true, sz: 2, drag: 1 });
  addRing(e.x, e.y, e.r + 4, col[0], { life: 0.18 });
  if (e.xp > 0) dropGem(e.x, e.y, e.xp * (e.elite ? 12 : 1)); // 経験値のない敵(巨大スライムの中スライム)はジェムを落とさない
  if (Math.random() < 0.035) dropItem('coin', e.x, e.y, 1);
  if (Math.random() < 0.004) dropItem('meat', e.x, e.y);
  clsOnKill(e, o); // o: 倒した一撃の指定(o.cl: 分身など自分以外の使い手の武器スキル)
  if (P.uq.vamp && Math.random() < 0.25) heal(P.maxhp * 0.01, true); // 吸血鬼の
  // ソウルイーター: 撃破地点から魂を召喚(同時40体まで)
  const ww = P.weapons.wisp;
  if (ww && ww.evo && projs.filter(p => p.summon).length < 40) {
    const st = wst('wisp');
    fire('wisp', e.x, e.y, rand(0, TAU), st.speed * 90 / 110, { dmg: st.dmg, pierce: st.pierce, life: 2.2, src: 'wisp', homing: 5.5, speed: st.speed, col: '#9dffcf', summon: true });
    part(e.x, e.y, 0, -30, 0.5, '#9dffcf', { glow: true, sz: 2 });
  }
  AudioMan.kill();
  const ed = DATA.enemies[e.type];
  if (ed.split && !e.elite && !e.owner) for (let i = 0; i < 2; i++) spawnEnemy(ed.split, { x: e.x + rand(-4, 4), y: e.y + rand(-4, 4) }); // ボスの中スライムは分裂しない
  if (ed.fireFloor) lavaPool(e, ed.fireFloor); // 溶岩スライム: 倒れた場所に燃える床
  if (ed.miasma) miasmaCloud(e, ed.miasma); // 腐毒のグール: 倒れた場所に瘴気の霧
  if (ed.revive && !e.elite && !e.revived) dollMound(e, ed.revive); // 砂人形: 倒れた場所に砂山(エリート・立ち上がった砂人形は砂山にならない)
  if (ed.shatter) glassShatter(e, ed.shatter); // 玻璃の天使: 割れてガラスの破片が全周に飛ぶ
  if (e.phaseElite && S.phase && S.phase.kind === 'elite') { S.phase.lastX = e.x; S.phase.lastY = e.y; } // エリート群: 宝箱は最後の1体の位置に
  if (e.elite || e.type === 'goblin') {
    hitstop(0.06); shake(6); shockAt(e.x, e.y, 1.2, 0.8); addFlash(e.x, e.y, 100, '#ffd23f', 0.4);
    if (!e.noChest) dropItem('chest', e.x, e.y); // 自然発生のエリート・トレジャー(ゴブリン)は装備宝箱を落とす(エリート群・親衛隊・ボス戦中のエリートは落とさない)
    const n = e.type === 'goblin' ? 18 : 4;
    for (let i = 0; i < n; i++) dropItem('coin', e.x, e.y, e.type === 'goblin' ? 3 : 2);
    AudioMan.boom();
  }
}
