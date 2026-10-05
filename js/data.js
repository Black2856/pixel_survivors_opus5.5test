// data.js — ゲームバランス定義。距離・速度はすべて内部解像度ピクセル(1アートpx = 1ワールドpx)
'use strict';

const DATA = {
  // staLock: ガード系の防御スキルで受けた後、スタミナ回復が止まる秒数 / food: 食べ物(肉)の回復量(最大HP の割合)
  player: { hp: 100, speed: 58, magnet: 30, iframe: 0.5, comboTime: 3, staLock: 5, food: 0.2 },

  // ---------- 敵 ----------
  // ai: chase / flutter(揺れて飛ぶ)/ hop(跳ねる)/ keep(距離を取って射撃)/ flee(逃走)
  // keep: [これより近いと離れる, これより遠いと近づく] / shot: 射撃(射程 range 以内で cd 秒ごと。wind: 構える秒、count 発を spread rad おきに。
  //   弾: 速さ spd、ダメージ = その敵のダメージ × n、kind: 見た目、burn: 当たると炎上(その敵のダメージ × burn を 0.5秒ごと))
  // throw: 投擲(射程 range 以内で cd 秒ごとに、wind 秒の予告の帯(長さ len・幅 w)→ 帯の長さだけ飛ぶ槍)
  // touchBurn: 触れると炎上 / noTouch: 触れても当たらない / blast: プレイヤーの range 以内で wind 秒点滅して自爆(半径 r に ×n・炎上)。倒されると爆発しない
  // fireFloor: 跳ねて着地したとき chance で燃える床(半径 r・dur 秒)。倒れた場所にも / noElite: エリートにならない
  enemies: {
    zombie:   { hp: 30, spd: 13, dmg: 9,  xp: 1, r: 5, ai: 'chase' },
    bat:      { hp: 21, spd: 30, dmg: 8,  xp: 1, r: 4, ai: 'flutter' },
    slime:    { hp: 30, spd: 15, dmg: 9,  xp: 1, r: 5, ai: 'hop', split: 'slimelet' },
    slimelet: { hp: 12, spd: 22, dmg: 6,  xp: 1, r: 3, ai: 'hop' },
    skeleton: { hp: 30, spd: 18, dmg: 9,  xp: 1, r: 5, ai: 'chase' },
    archer:   { hp: 30, spd: 16, dmg: 9,  xp: 1, r: 5, ai: 'keep', keep: [70, 95], shot: { cd: 4.0, range: 180, spd: 70, n: 1.0, kind: 'arrow' } },
    ghost:    { hp: 30, spd: 22, dmg: 9,  xp: 1, r: 5, ai: 'chase', ghost: true, touchFrost: 1 }, // 冷たい霊(霊峰): 触れると凍傷 +1
    brute:    { hp: 60, spd: 11, dmg: 13, xp: 2, r: 8, ai: 'chase', kbRes: 0.8 },
    imp:      { hp: 28, spd: 20, dmg: 9,  xp: 1, r: 4, ai: 'keep', keep: [80, 110], shot: { cd: 4.0, range: 170, spd: 75, n: 1.0, kind: 'efire', burn: 0.1 } }, // 火の小鬼
    sandmage: { hp: 26, spd: 14, dmg: 9,  xp: 1, r: 5, ai: 'keep', keep: [100, 130], shot: { cd: 4.5, range: 200, spd: 60, n: 0.8, kind: 'esand', wind: 0.5, count: 3, spread: 0.3 } }, // 砂術師
    spear:    { hp: 32, spd: 16, dmg: 9,  xp: 1, r: 5, ai: 'chase', throw: { cd: 5, range: 140, wind: 0.6, len: 160, w: 6, spd: 200, n: 1.3 } }, // 投槍兵
    hound:    { hp: 22, spd: 38, dmg: 9,  xp: 1, r: 5, ai: 'chase', touchBurn: 0.1 }, // ヘルハウンド
    onibi:    { hp: 14, spd: 30, dmg: 7,  xp: 1, r: 4, ai: 'flutter', noTouch: true, noElite: true, blast: { range: 20, wind: 0.6, r: 30, n: 2.0, burn: 0.1 } }, // 鬼火
    lslime:   { hp: 32, spd: 14, dmg: 9,  xp: 1, r: 6, ai: 'hop', fireFloor: { chance: 0.3, r: 10, dur: 3 } }, // 溶岩スライム
    // 七彩の晶窟 / hop: 跳ねる間隔 every 秒・跳んでいる間の速さ ×k / rush: 突進(射程 range 以内で cd 秒ごとに wind 秒止まって光り、帯の長さ len を速さ spd で)
    // wobble: 揺れて飛ぶ振れ幅(既定 0.8)
    jslime:   { hp: 20, spd: 22, dmg: 8,  xp: 1, r: 4, ai: 'hop', hop: { every: 0.7, k: 3.0 } }, // 宝石スライム
    beetle:   { hp: 36, spd: 16, dmg: 10, xp: 1, r: 5, ai: 'chase', kbRes: 0.6, rush: { cd: 4, range: 120, wind: 0.5, len: 140, spd: 260 } }, // 晶甲虫(硬い殻: 押されにくい)
    fairy:    { hp: 14, spd: 48, dmg: 7,  xp: 1, r: 3, ai: 'flutter', wobble: 1.5 }, // プリズムフェアリー
    // 沈黙の海淵 / touchSta: 触れると(当たったとき)スタミナ −n / shot.sta・throw.sta: 弾が当たるとスタミナ −n
    // puff: 近づくとふくらんで針を全周に(射程 range 以内で wind 秒ふくらみ、count 本・速さ spd・×n・スタミナ −sta。cd 秒ごと)
    // lantern: 提灯(cd 秒ごとに wind 秒の予告 円 半径 r → 中にいるとスタミナ −sta)
    jelly:    { hp: 34, spd: 10, dmg: 8,  xp: 1, r: 6, ai: 'flutter', wobble: 1.1, touchSta: 20 }, // クラゲ
    sahagin:  { hp: 32, spd: 17, dmg: 9,  xp: 1, r: 5, ai: 'chase', throw: { cd: 4.5, range: 130, wind: 0.6, len: 150, w: 8, spd: 170, n: 1.3, sta: 15, kind: 'trident' } }, // サハギン
    puffer:   { hp: 28, spd: 12, dmg: 8,  xp: 1, r: 5, ai: 'chase', puff: { cd: 3, range: 40, wind: 0.5, count: 8, spd: 70, n: 0.8, sta: 5 } }, // ハリセンボン
    angler:   { hp: 60, spd: 14, dmg: 13, xp: 2, r: 7, ai: 'chase', lantern: { cd: 5, wind: 0.6, r: 70, sta: 25 } }, // チョウチンアンコウ
    // 霜天の霊峰 / touchFrost: 触れると(当たったとき)凍傷 +n / shot.frost: 弾が当たると凍傷 +n / pack: [最少, 最多] 体の群れで出る(エリートは1体)
    // snowball: 雪玉(射程 range 以内で cd 秒ごとに放物線。着弾 半径 r に ×n・凍傷 +frost、雪の床 floor 秒: 上にいると 1秒ごとに凍傷 +1)
    wolf:     { hp: 20, spd: 36, dmg: 8,  xp: 1, r: 5, ai: 'chase', touchFrost: 2, pack: [3, 4] }, // 雪狼
    icesprite:{ hp: 24, spd: 16, dmg: 8,  xp: 1, r: 4, ai: 'keep', keep: [90, 120], shot: { cd: 3.5, range: 180, spd: 75, n: 1.0, kind: 'eice', frost: 1 } }, // 氷の精
    yeti:     { hp: 70, spd: 10, dmg: 14, xp: 2, r: 8, ai: 'chase', snowball: { cd: 5, range: 150, r: 18, n: 1.0, frost: 2, floor: 3 } }, // イエティ
    // 終刻の時計塔 / roll: 出たときのプレイヤーの位置へ一直線に転がり、通り過ぎると消える(遠くても移し直さない)
    // blink: cd 秒ごとに wind 秒光って、プレイヤーの方向へ dist 瞬間移動 / warp: cd 秒ごとに、プレイヤーの位置に wind 秒の予告 → 時の歪み(半径 r・dur 秒。移動速度 ×slow・クールダウンの回復 ×0.5)
    gear:     { hp: 40, spd: 110, dmg: 10, xp: 1, r: 6, ai: 'roll', kbRes: 1, noElite: true }, // 歯車(金属で硬い: 押されない)
    clockman: { hp: 34, spd: 14, dmg: 10, xp: 1, r: 5, ai: 'chase', blink: { cd: 2.5, wind: 0.3, dist: 35 } }, // 時計兵
    hglass:   { hp: 26, spd: 14, dmg: 8,  xp: 1, r: 5, ai: 'keep', keep: [90, 110], warp: { cd: 8, range: 200, wind: 0.8, r: 45, dur: 4, slow: 0.7 } }, // 砂時計の精
    goblin:   { hp: 160, spd: 44, dmg: 0, xp: 12, r: 5, ai: 'flee', kbRes: 0.5, noElite: true },
  },

  // ---------- 敵レベル(時間経過で上昇・ボス出現中は停止・周回してもリセットしない) ----------
  // dmg/spd/xp: Lv が 1 上がるごとの増加率(Lv1 = 基本値)
  // HP倍率 = hpLin × (Lv-1) + hpExp^(Lv-1)。雑魚・ボスで共通
  enemyLevel: { interval: 30, hpLin: 0.2, hpExp: 1.03, dmg: 0.03, spd: 0.005, spdMax: 1.5, xp: 0.04, elite: 14 },

  // hp: 基礎HP(1500〜2000。Lv倍率は雑魚と共通) / enrage: 激昂する残りHP割合(省略時 0.5)
  bosses: {
    king:    { name: '腐肉の王 ROT KING',          hp: 1500, spd: 14, dmg: 22, r: 13, music: 'b_grass', col: '#8fce5e' },
    gslime:  { name: '巨大スライム GIANT SLIME',   hp: 1500, spd: 16, dmg: 20, r: 14, music: 'b_grass', col: '#4fd6a8' },
    wyrm:    { name: '白骨竜 BONE WYRM',           hp: 1700, spd: 19, dmg: 22, r: 14, music: 'b_wild', col: '#efe9d4' },
    golem:   { name: 'ゴーレム GOLEM',             hp: 1800, spd: 12, dmg: 22, r: 15, music: 'b_wild', col: '#6ee7ff' },
    reaper:  { name: '死神 THE REAPER',            hp: 1800, spd: 22, dmg: 28, r: 12, music: 'b_clock2', col: '#c29bff', enrage: 0.3 }, // 段階3 で 1600 / 24 に
    cdragon: { name: 'カオスドラゴン CHAOS DRAGON', hp: 1700, spd: 20, dmg: 20, r: 16, music: 'b_hell', col: '#ff4a8a', enrage: 0.4 },
    ifrit:   { name: '炎魔イフリート IFRIT',        hp: 1600, spd: 18, dmg: 24, r: 13, music: 'b_hell', col: '#ff8a3d', enrage: 0.4 },
    stag:    { name: '晶角の大鹿 PRISM STAG',       hp: 1400, spd: 26, dmg: 20, r: 13, music: 'b_crystal', col: '#9ff7ff' },
    pqueen:  { name: '七彩の女王 PRISM QUEEN',      hp: 1300, spd: 22, dmg: 20, r: 11, music: 'b_crystal', col: '#ff8ad8' },
    kraken:  { name: '大海魔クラーケン KRAKEN',     hp: 2000, spd: 10, dmg: 22, r: 16, music: 'b_sea', col: '#7ad7c8' },
    levia:   { name: '深淵の海竜 LEVIATHAN',        hp: 1700, spd: 21, dmg: 22, r: 15, music: 'b_sea', col: '#4ab8e8', enrage: 0.4 },
    fgiant:  { name: '霜の巨人 FROST GIANT',        hp: 2000, spd: 11, dmg: 24, r: 16, music: 'b_peak', col: '#9fd8ff' },
    squeen:  { name: '雪華の女王 SNOW QUEEN',       hp: 1500, spd: 18, dmg: 22, r: 12, music: 'b_peak', col: '#d8f0ff', enrage: 0.4 },
    warden:  { name: '時計仕掛けの番人 CLOCKWORK WARDEN', hp: 1900, spd: 13, dmg: 22, r: 15, music: 'b_clock1', col: '#c8a050' },
  },
  // 状態異常(プレイヤー): 粘液・スロウタイムの移動速度倍率 / スロウタイムのCD回復倍率 / 炎上
  debuff: { slow: 0.6, cdRate: 0.5, burnTick: 0.5, burnDur: 3, frostSlow: 0.05, shockR: 60, pDur: 5, pBleed: 0.01, pBleedMax: 5 }, // frostSlow: 凍傷1スタックあたりの減速(敵・自分) / shockR: 感電の連鎖距離 / pDur: 自分の凍傷・出血が消えるまでの秒 / pBleed: 自分の出血1スタックの毎秒ダメージ(最大HP の割合)
  // 敵の出血: 1スタックごとに毎秒 最大HP × bleedPct(ボス ×bleedBoss・エリート ×bleedElite)、bleedDur 秒
  bleed: { pct: 0.002, dur: 5, boss: 0.1, elite: 0.25 },

  // ---------- 3ステージ通し(仮)の出現スケジュール(周回内の経過秒)。区間ごとに 草原 → 荒野 → 奈落 の敵 ----------
  // boss: 候補からランダムに1体。final: 撃破で勝利/周回
  schedule: [
    { t: 0,   types: ['zombie'],                            interval: 0.95, max: 60 },
    { t: 35,  types: ['zombie', 'bat'],                     interval: 0.75, max: 100 },
    { t: 80,  types: ['bat', 'slime', 'zombie'],            interval: 0.6,  max: 130 },
    { t: 130, types: ['bat', 'slime', 'brute'],             interval: 0.5,  max: 160 },
    { t: 180, boss: ['king', 'gslime'] },
    { t: 186, types: ['skeleton', 'archer', 'sandmage'],    interval: 0.55, max: 170 },
    { t: 250, types: ['archer', 'sandmage', 'spear'],       interval: 0.48, max: 190 },
    { t: 320, types: ['skeleton', 'archer', 'sandmage', 'spear'], interval: 0.45, max: 200 },
    { t: 360, event: 'horde' },
    { t: 420, boss: ['wyrm', 'golem'] },
    { t: 426, types: ['imp', 'hound', 'onibi'],             interval: 0.42, max: 220 },
    { t: 500, types: ['hound', 'onibi', 'lslime'],          interval: 0.38, max: 240 },
    { t: 560, event: 'horde' },
    { t: 600, types: ['imp', 'hound', 'onibi', 'lslime'],   interval: 0.33, max: 270 },
    { t: 630, event: 'horde' },
    { t: 660, boss: ['reaper', 'cdragon'], final: true },
    { t: 666, types: ['imp', 'hound', 'onibi', 'lslime'],   interval: 0.4,  max: 240 },
  ],

  // ---------- 武器 ----------
  // evo: 武器Lv5 で進化カードが出る(メイン武器はクラスLv10 で解放)
  // cut: 斬撃タイプの武器(刀・騎士剣・オービットブレード・スローイングアックス)。クラスは「斬撃タイプ」としてだけ参照する
  weapons: {
    bolt: {
      name: 'マジックボルト', desc: '最も近い敵へ魔法弾を放つ', col: '#7ad7ff',
      lv: [
        { cd: 1.1,  dmg: 13, count: 1, speed: 160, pierce: 0 },
        { cd: 1.0,  dmg: 17, count: 2, speed: 165, pierce: 0 },
        { cd: 0.93, dmg: 22, count: 2, speed: 175, pierce: 1 },
        { cd: 0.87, dmg: 27, count: 3, speed: 185, pierce: 1 },
        { cd: 0.82, dmg: 32, count: 4, speed: 200, pierce: 2 },
      ],
      evo: { name: 'アーケインレイ', desc: '魔弾が敵をわずかに追尾する', st: { cd: 0.77, dmg: 36, count: 5, speed: 210, pierce: 2 } },
      // 武器スキル(E)アーケイン・バラージュ: 詠唱 windup 秒(動けない)→ dur 秒間、照準方向へ毎秒 rate 発(各 武器の威力 × pow)。連射中も普通に動ける
      // 魔弾は通常攻撃と同じ弾速・貫通(進化後は追尾も)。弾数は通常攻撃の countMul 倍(切り上げ)/ radius: 自動発動の判定距離
      //   魔力障壁: 使うと最大HP × shield のシールド。連射中の撃破で持続 +killExt 秒(1回の連射で killExtMax まで)
      skill: {
        name: 'アーケイン・バラージュ', cd: 30, windup: 0.3, dur: 2.5, rate: 12, pow: 0.5, countMul: 0.5, radius: 90, shield: 0.2, killExt: 0.1, killExtMax: 1.5,
        tree: { name: 'バラージュ', paths: {
          pow: { name: '威力', desc: ['バラージュの威力 +30%', 'バラージュの威力 +60%', 'バラージュの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '集中砲火', desc: '使っている間、同じ敵に当たるたびに、その敵への威力 +5%(最大 +50%)' } },
          cd:  { name: '迅速', desc: ['バラージュのCD -10%', 'バラージュのCD -20%', 'バラージュのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: 'オーブ', desc: '自分の周りを回るオーブが5秒間、自動で連射する。自分は自由に動ける' } },
          dur: { name: '持続', desc: ['バラージュの持続 +0.5秒', 'バラージュの持続 +1.0秒', 'バラージュの持続 +1.5秒'], v: [0.5, 1.0, 1.5], sp: { name: '魔力障壁', desc: '使うと、最大HP 20% のシールドを得る。連射中に敵を倒すたびに、持続 +0.1秒(1回で +1.5秒まで)' } },
        } },
      },
      // 熟練(メイジの Lv で解放。マジックボルトを使うどのクラスにも効く)
      mastery: {
        4: { d: 'マジックボルト: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: 'バラージュ: 持続 +0.5秒', fx: { eDur: 0.5 } },
        7: { d: 'マジックボルト: 弾速 +15%', fx: { speed: 0.15 } },
        9: { d: 'マジックボルト: 弾数 +1', fx: { count: 1 } },
        10: { d: '進化「アーケインレイ」を解放', fx: { evo: 1 } },
        12: { d: 'マジックボルト: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: 'マジックボルト: 貫通 +1', fx: { pierce: 1 } },
        17: { d: 'マジックボルト: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: 'マジックボルト: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: 'バラージュ: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    blade: {
      // hitCd: 同じ敵に再び当たるまでの秒数(刃の輪ごと)
      name: 'オービットブレード', desc: '周囲を回転する刃(クールダウン・攻撃速度で回転が速くなる)', col: '#d8e4ff', cut: true, hitCd: 0.1,
      // size: 刃の大きさ(当たり判定の半径 5 と見た目に掛ける)
      lv: [
        { count: 2, dmg: 9,  radius: 20, rot: 2.8, size: 1.0 },
        { count: 3, dmg: 11, radius: 24, rot: 3.0, size: 1.1 },
        { count: 3, dmg: 15, radius: 28, rot: 3.3, size: 1.2 },
        { count: 4, dmg: 18, radius: 32, rot: 3.6, size: 1.35 },
        { count: 6, dmg: 24, radius: 36, rot: 4.0, size: 1.5 },
      ],
      // bleed: 進化後の命中で付ける出血
      evo: { name: 'ブラッドサークル', desc: '二重の刃が逆回転する。命中で出血 +1', st: { count: 7, dmg: 30, radius: 55, rot: 4.4, size: 1.75 }, bleed: 1 },
      // 武器スキル(E)刃輪展開: 構え windup 秒(動けない)→ dur 秒間、回転半径 ×rMul・刃のサイズ ×size・回転速度 ×rot・刃の威力 ×pow(使っている間も動ける)
      //   終わりに刃が回転しながら外へ飛び散る(1枚ごとに 武器の威力 × scatter、貫通)。輪の回転を保ったまま、らせんを描いて広がる(外へ scatterSpd、回る速さは spinMax まで、scatterT 秒)
      //   刃の雨: rainT 秒 広がった後に自分のところへ戻ってきてもう一度当たる(戻りの威力 ×rainPow)
      //   連環: 展開中の撃破で +killExt 秒(killExtMax まで)/ 渦: 輪の外側(半径の pullK 倍まで)を pull で引き寄せる
      skill: {
        name: '刃輪展開', cd: 22, windup: 0.2, dur: 5, rMul: 2, size: 2, rot: 1.5, pow: 1.5, scatter: 3, scatterSpd: 220, scatterT: 0.5, spinMax: 260, radius: 50,
        rainT: 1, rainPow: 1.5, killExt: 0.3, killExtMax: 3, pullK: 1.5, pull: 40,
        tree: { name: '刃輪展開', paths: {
          pow:  { name: '威力', desc: ['刃輪展開の威力 +30%', '刃輪展開の威力 +60%', '刃輪展開の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '刃の雨', desc: '飛び散った刃が 1秒後に戻ってきて、もう一度当たる(戻りの威力 +50%)' } },
          cd:   { name: '迅速', desc: ['刃輪展開のCD -10%', '刃輪展開のCD -20%', '刃輪展開のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '連環', desc: '展開中に敵を倒すと、持続 +0.3秒(1回で +3秒まで)' } },
          area: { name: '範囲', desc: ['展開の半径 +15%', '展開の半径 +30%', '展開の半径 +50%'], v: [0.15, 0.3, 0.5], sp: { name: '渦', desc: '展開中、輪の外側(半径の 1.5倍まで)の敵を輪へ少しずつ引き寄せる(ボス以外)' } },
        } },
      },
      // 熟練(ブラッドアサシンの Lv で解放。オービットブレードを使うどのクラスにも効く)。クールダウンは回転速度と刃輪展開の CD に効く
      mastery: {
        4: { d: 'オービットブレード: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: '刃輪展開: 持続 +0.5秒', fx: { eDur: 0.5 } },
        7: { d: 'オービットブレード: 範囲 +10%', fx: { area: 0.1 } },
        9: { d: 'オービットブレード: 刃の数 +1', fx: { count: 1 } },
        10: { d: '進化「ブラッドサークル」を解放', fx: { evo: 1 } },
        12: { d: 'オービットブレード: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: 'オービットブレード: 範囲 +10%', fx: { area: 0.1 } },
        17: { d: 'オービットブレード: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: 'オービットブレード: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: '刃輪展開: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    thunder: {
      name: 'サンダー', desc: 'ランダムな敵に落雷', col: '#fff27a',
      lv: [
        { cd: 3.4, strikes: 1, dmg: 24, aoe: 17 },
        { cd: 3.2, strikes: 1, dmg: 30, aoe: 19 },
        { cd: 3.0, strikes: 2, dmg: 40, aoe: 21 },
        { cd: 2.8, strikes: 2, dmg: 48, aoe: 24 },
        { cd: 2.6, strikes: 3, dmg: 60, aoe: 27 },
      ],
      evo: { name: 'ジャッジメント', desc: '落雷が当たった敵に感電を 2回起こす', st: { cd: 2.3, strikes: 3, dmg: 72, aoe: 30 } },
      shock: 0.3, // 落雷が当たった敵に感電 30%(進化で 2回)
      // 武器スキル(E)グラビティスパーク: 構え windup 秒(動けない)→ 照準位置(range まで)の半径 pullR の敵を中心へ 1回大きく引き寄せ(ボス以外)
      //   → boomT 秒後に半径 boomR で爆発(武器の威力 × pow、感電 shock)/ 超電磁: スタン stun 秒(ボス bossStun)
      //   残留磁場: fieldT 秒 弱い引き寄せ(fieldPull)/ 二重重力: againT 秒後にもう一度(威力 againK)
      skill: {
        name: 'グラビティスパーク', cd: 18, windup: 0.3, range: 200, pullR: 90, boomR: 40, boomT: 0.22, pow: 4, shock: 0.3, radius: 90,
        stun: 1.5, bossStun: 0.5, fieldT: 3, fieldPull: 40, againT: 0.6, againK: 0.6,
        tree: { name: 'グラビティスパーク', paths: {
          pow:  { name: '威力', desc: ['グラビティスパークの威力 +30%', 'グラビティスパークの威力 +60%', 'グラビティスパークの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '超電磁', desc: '爆発した敵を 1.5秒スタンさせる' } },
          cd:   { name: '迅速', desc: ['グラビティスパークのCD -10%', 'グラビティスパークのCD -20%', 'グラビティスパークのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '残留磁場', desc: '爆発の後、3秒間 その場に弱い引き寄せが残る' } },
          area: { name: '範囲', desc: ['引き寄せ・爆発の半径 +15%', '引き寄せ・爆発の半径 +30%', '引き寄せ・爆発の半径 +50%'], v: [0.15, 0.3, 0.5], sp: { name: '二重重力', desc: '0.6秒後にもう一度 引き寄せて爆発する(威力 60%)' } },
        } },
      },
      // 熟練(エレクトロマンサーの Lv で解放。サンダーを使うどのクラスにも効く)
      mastery: {
        4: { d: 'サンダー: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: 'グラビティスパーク: 引き寄せの半径 +15%', fx: { eArea: 0.15 } },
        7: { d: 'サンダー: 範囲 +10%', fx: { area: 0.1 } },
        9: { d: 'サンダー: 回数 +1', fx: { count: 1 } },
        10: { d: '進化「ジャッジメント」を解放', fx: { evo: 1 } },
        12: { d: 'サンダー: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: 'サンダー: 範囲 +10%', fx: { area: 0.1 } },
        17: { d: 'サンダー: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: 'サンダー: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: 'グラビティスパーク: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    aura: {
      name: 'ホーリーオーラ', desc: '周囲の敵に継続ダメージ', col: '#ffe38a',
      lv: [
        { radius: 22, dmg: 8,  tick: 0.5 },
        { radius: 27, dmg: 11, tick: 0.5 },
        { radius: 31, dmg: 14, tick: 0.45 },
        { radius: 37, dmg: 18, tick: 0.4 },
        { radius: 43, dmg: 24, tick: 0.33 },
      ],
      evo: { name: 'サンクチュアリ', desc: '命中1回につきHP 0.4 回復(1判定で最大5回分)', st: { radius: 60, dmg: 25, tick: 0.28 } },
      // 武器スキル(E)ホーリーストライク: ランダムな敵の位置 n か所に gap 秒おきに光の柱(予備動作なし・動ける)
      //   1回: 半径 r に 基礎威力 pow + 最大HP × hpPow。1回ごとに最大HP の heal を回復
      //   聖痕: 当たった敵は stigmaT 秒、自分の回復量の stigma 倍のダメージを受ける / 連祷: +more 本 / 光の雨: 跡が rainT 秒(中で HP rainHeal/s)
      skill: {
        name: 'ホーリーストライク', cd: 20, n: 3, gap: 0.25, r: 30, pow: 30, hpPow: 0.2, heal: 0.06, radius: 120, stigmaT: 10, stigma: 1, more: 2, rainT: 6, rainHeal: 3,
        tree: { name: 'ホーリーストライク', paths: {
          pow:  { name: '威力', desc: ['ホーリーストライクの威力 +30%', 'ホーリーストライクの威力 +60%', 'ホーリーストライクの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '聖痕', desc: '当たった敵は 10秒間、自分が回復した量の 100% をダメージとして受ける' } },
          cd:   { name: '迅速', desc: ['ホーリーストライクのCD -10%', 'ホーリーストライクのCD -20%', 'ホーリーストライクのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '連祷', desc: '光の柱 +2本' } },
          heal: { name: '癒し', desc: ['1回の回復 6% → 7%', '1回の回復 8%', '1回の回復 10%'], v: [0.07, 0.08, 0.1], sp: { name: '光の雨', desc: '光の柱の跡が 6秒残り、中にいると HP 3/s 回復' } },
        } },
      },
      // 熟練(クレリックの Lv で解放。ホーリーオーラを使うどのクラスにも効く)。クールダウンはオーラの間隔に効く
      mastery: {
        4: { d: 'ホーリーオーラ: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: 'ホーリーストライク: 光の柱 +1本', fx: { eCount: 1 } },
        7: { d: 'ホーリーオーラ: 範囲 +10%', fx: { area: 0.1 } },
        9: { d: 'ホーリーオーラ: 威力 +10%', fx: { dmg: 0.1 } },
        10: { d: '進化「サンクチュアリ」を解放', fx: { evo: 1 } },
        12: { d: 'ホーリーオーラ: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: 'ホーリーオーラ: 範囲 +10%', fx: { area: 0.1 } },
        17: { d: 'ホーリーオーラ: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: 'ホーリーオーラ: 間隔 -10%', fx: { cd: 0.1 } },
        20: { d: 'ホーリーストライク: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    axe: {
      name: 'スローイングアックス', desc: '放物線を描く重い斧', col: '#ffb070', cut: true,
      // size: 斧の大きさ(当たり判定の半径 5 と見た目に掛ける。熟練の大きさも掛ける)
      lv: [
        { cd: 1.7, count: 1, dmg: 20, size: 1 },
        { cd: 1.6, count: 2, dmg: 24, size: 1.2 },
        { cd: 1.5, count: 2, dmg: 32, size: 1.4 },
        { cd: 1.3, count: 3, dmg: 38, size: 1.6 },
        { cd: 1.1, count: 4, dmg: 50, size: 1.8 },
      ],
      // 巨斧旋風: 上がる速さが brake を下回ったら重力を切ってなめらかに止まり(速さ × e^(-damp × 秒))、whirlT 秒 速く回りながら
      //   every 秒ごとに周り(半径 whirlR。範囲%も掛ける)の敵へ 武器の威力 × whirlPow。そのあと重力を fallEase 秒かけて戻して落ちる
      evo: { name: 'テンペスト', desc: '巨大化した斧が頂点でだんだん止まって回り、周りを斬り刻んでから落ちる', st: { cd: 1.0, count: 5, dmg: 72, size: 2 },
        brake: 60, damp: 6, whirlT: 0.6, every: 0.1, whirlR: 24, whirlPow: 0.25, spinMax: 30, fallEase: 0.25 },
      // 武器スキル(E)ワイルドトマホーク: 使った瞬間に 最大HP × hpCost のダメージを受け、払った HP × hpK を今回の 1回ごとの威力に足す(跳ね返り・戻り。地割れには足さない)
      //   構え windup 秒(動けない)→ 照準方向(照準がなければ一番近い敵)へ大きな斧を投げる(通常の斧の big 倍の大きさ。放った後は動ける)
      //   最初は速さ speed で reach(射程%を掛ける)まで飛び、触れた敵に当たる → 近く(半径 hopR。範囲%も掛ける)のまだ当たっていない敵へ跳ね返る(最大 bounces 回)
      //   1回の威力 武器の威力 × (pow + inc × 跳ねた回数)。跳ね終わると回りながら戻ってくる(戻る途中に触れた敵へ 武器の威力 × backPow。1体に1回)
      //   radius: 自動発動の判定距離
      //   地割れ: 当たるたびに、その場の半径 crackR へ 武器の威力 × crackPow / 双斧: 2本(左右に twinA ずつ開く)
      //   暴れ斧: 既に当たった敵にも跳ね返る(ボス → エリート → まだ当たっていない敵 → 当たった敵 の順に選ぶ)。増え方 incSp
      skill: {
        name: 'ワイルドトマホーク', cd: 22, windup: 0.3, hpCost: 0.05, hpK: 3, big: 2, speed: 280, reach: 180, hopR: 80, bounces: 6, pow: 1.25, inc: 0.15, backPow: 1, radius: 100,
        crackR: 25, crackPow: 0.6, twinA: 0.35, incSp: 0.2,
        tree: { name: 'ワイルドトマホーク', paths: {
          pow:  { name: '威力', desc: ['ワイルドトマホークの威力 +30%', 'ワイルドトマホークの威力 +60%', 'ワイルドトマホークの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '地割れ', desc: '跳ねるたびに、当たった場所の地面が割れて周り(半径 25)へ 武器の威力 × 60%' } },
          cd:   { name: '迅速', desc: ['ワイルドトマホークのCD -10%', 'ワイルドトマホークのCD -20%', 'ワイルドトマホークのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '双斧', desc: '斧を 2本投げる(左右に少し開いて)' } },
          jump: { name: '跳躍', desc: ['跳ねる回数 +2', '跳ねる回数 +4', '跳ねる回数 +6'], v: [2, 4, 6], sp: { name: '暴れ斧', desc: '既に当たった敵にも跳ね返るようになる(ボス → エリートの順に優先して跳ね返る)。跳ねるたびの威力の増え方 +15% → +20%' } },
        } },
      },
      // 熟練(バーサーカーの Lv で解放。スローイングアックスを使うどのクラスにも効く)。大きさは斧の当たり判定と見た目
      mastery: {
        4: { d: 'スローイングアックス: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: 'ワイルドトマホーク: 跳ねる回数 +2', fx: { eBounce: 2 } },
        7: { d: 'スローイングアックス: 大きさ +15%', fx: { size: 0.15 } },
        9: { d: 'スローイングアックス: 斧の数 +1', fx: { count: 1 } },
        10: { d: '進化「テンペスト」を解放', fx: { evo: 1 } },
        12: { d: 'スローイングアックス: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: 'スローイングアックス: 大きさ +15%', fx: { size: 0.15 } },
        17: { d: 'スローイングアックス: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: 'スローイングアックス: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: 'ワイルドトマホーク: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    wisp: {
      // speed: 敵を追うときの速さ(放つときは × 90/110)。寿命 3.2秒・曲がる速さ 5.5・敵を探す距離 120 は固定
      name: 'スピリットウィスプ', desc: '敵を追尾する精霊', col: '#9dffcf',
      lv: [
        { cd: 1.9, count: 1, dmg: 13, pierce: 3, speed: 110 },
        { cd: 1.8, count: 2, dmg: 15, pierce: 3, speed: 110 },
        { cd: 1.7, count: 2, dmg: 20, pierce: 4, speed: 110 },
        { cd: 1.5, count: 3, dmg: 25, pierce: 5, speed: 110 },
        { cd: 1.2, count: 4, dmg: 32, pierce: 6, speed: 110 },
      ],
      evo: { name: 'ソウルイーター', desc: '敵を倒すたび(武器問わず)その場から魂を召喚', st: { cd: 0.9, count: 6, dmg: 40, pierce: 10, speed: 110 } },
      // 武器スキル(E)スピリットストーム: 構え windup 秒(動けない)→ 自分の周りから精霊 n 体が渦を巻いて広がり(spreadT 秒)、それぞれ近くの敵へ飛んで取り憑く
      //   飛ぶ精霊: 速さ・追尾は通常攻撃と同じ。まだ取り憑かれていない敵を優先して追う(半径 seekR。いなければ取り憑かれた敵にも。寿命 life 秒)
      //   取り憑いた精霊: possT 秒のあいだ、every 秒ごとに 武器の威力 × pow(取り憑いた瞬間にも1回)
      //     その敵が倒れると、半径 hopR の敵へ乗り移る(残り時間はそのまま。いなければその場で爆ぜる)
      //     時間が来ると、取り憑いた敵の中で爆ぜる(武器の威力 × burstPow、半径 burstR)/ radius: 自動発動の判定距離
      //   侵蝕: 取り憑かれた敵が受けるダメージ +erode / 分霊: 乗り移るときに 2体に分かれる(取り憑いた精霊は同時 splitMax 体まで)
      //   大精霊: 最後に大きな精霊が bigT 秒 敵を追う(bigEvery 秒ごとに、触れた敵(半径 bigR)へ 武器の威力 × bigPow。速さ bigSpd)
      skill: {
        name: 'スピリットストーム', cd: 25, windup: 0.3, n: 12, spreadT: 0.4, life: 4, seekR: 160, radius: 80,
        possT: 4, every: 0.5, pow: 0.25, burstPow: 1, burstR: 24, hopR: 60, erode: 0.2, splitMax: 30,
        bigT: 5, bigEvery: 0.5, bigPow: 1.5, bigR: 12, bigSpd: 55,
        tree: { name: 'スピリットストーム', paths: {
          pow: { name: '威力', desc: ['スピリットストームの威力 +30%', 'スピリットストームの威力 +60%', 'スピリットストームの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '侵蝕', desc: '取り憑かれた敵は、どの攻撃からも受けるダメージ +20%' } },
          cd:  { name: '迅速', desc: ['スピリットストームのCD -10%', 'スピリットストームのCD -20%', 'スピリットストームのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '分霊', desc: '精霊が乗り移るとき、2体に分かれる(取り憑いた精霊は同時 30体まで)' } },
          n:   { name: '数', desc: ['精霊 +4体', '精霊 +8体', '精霊 +12体'], v: [4, 8, 12], sp: { name: '大精霊', desc: '最後に大きな精霊が 1体現れ、5秒間 敵を追い続ける(触れた敵に 0.5秒ごとに 武器の威力 × 150%。貫通無限)' } },
        } },
      },
      // 熟練(ネクロマンサーの Lv で解放。スピリットウィスプを使うどのクラスにも効く)
      mastery: {
        4: { d: 'スピリットウィスプ: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: 'スピリットストーム: 精霊 +3体', fx: { eCount: 3 } },
        7: { d: 'スピリットウィスプ: 弾速 +15%', fx: { speed: 0.15 } },
        9: { d: 'スピリットウィスプ: 数 +1', fx: { count: 1 } },
        10: { d: '進化「ソウルイーター」を解放', fx: { evo: 1 } },
        12: { d: 'スピリットウィスプ: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: 'スピリットウィスプ: 貫通 +2', fx: { pierce: 2 } },
        17: { d: 'スピリットウィスプ: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: 'スピリットウィスプ: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: 'スピリットストーム: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    fire: {
      name: 'ファイアー', desc: '貫通する火炎弾。燃焼を付与', col: '#ff8a3d',
      lv: [
        { cd: 1.8, dmg: 10, count: 1, burn: 5 },
        { cd: 1.7, dmg: 14, count: 1, burn: 7 },
        { cd: 1.6, dmg: 18, count: 2, burn: 10 },
        { cd: 1.4, dmg: 23, count: 2, burn: 13 },
        { cd: 1.2, dmg: 29, count: 3, burn: 17 },
      ],
      evo: { name: 'インフェルノ', desc: '着弾毎に爆炎が広がる(火炎弾の威力の 60%、半径 16、1発で最大 6回)', st: { cd: 1.0, dmg: 34, count: 4, burn: 22 } },
      // 武器スキル(E)火炎放射: 構え windup 秒(動けない)→ dur 秒間、照準方向へ扇形(長さ len・角度 arc)に炎を吹き続ける(放射中も動ける)
      //   every 秒ごとに、範囲内の敵へ 武器の威力 × pow と炎上(武器の燃焼/s × burn を 3秒)
      //   ダブル放射: 反対方向にも吹く / 火炎旋風: 攻撃ごとに放射先(炎の先端)へ吸い込み(半径 suckR の敵へ 武器の威力 × suckPow。半径の2倍まで suckPull ずつ引き寄せる)
      skill: {
        name: '火炎放射', cd: 20, windup: 0.2, dur: 2, every: 0.1, pow: 0.3, burn: 0.4, len: 80, arc: 0.87, radius: 70,
        suckR: 30, suckPow: 0.2, suckPull: 8,
        tree: { name: '火炎放射', paths: {
          pow: { name: '威力', desc: ['火炎放射の威力 +30%', '火炎放射の威力 +60%', '火炎放射の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '蒼炎', desc: '炎が青くなり、付与する炎上が 2倍' } },
          cd:  { name: '迅速', desc: ['火炎放射のCD -10%', '火炎放射のCD -20%', '火炎放射のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: 'ダブル放射', desc: '反対方向にも火炎放射を発生する' } },
          len: { name: '射程', desc: ['火炎放射の長さ +20%', '火炎放射の長さ +40%', '火炎放射の長さ +60%'], v: [0.2, 0.4, 0.6], sp: { name: '火炎旋風', desc: '放射先に吸い込みが発生する(攻撃ごと。武器の威力 × 20%)' } },
        } },
      },
      // 熟練(パイロマンサーの Lv で解放。ファイアーを使うどのクラスにも効く)。範囲は火炎弾の大きさと爆炎の半径
      mastery: {
        4: { d: 'ファイアー: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: '火炎放射: 放射時間 +0.5秒', fx: { eDur: 0.5 } },
        7: { d: 'ファイアー: 範囲 +10%', fx: { area: 0.1 } },
        9: { d: 'ファイアー: 弾数 +1', fx: { count: 1 } },
        10: { d: '進化「インフェルノ」を解放', fx: { evo: 1 } },
        12: { d: 'ファイアー: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: 'ファイアー: 範囲 +10%', fx: { area: 0.1 } },
        17: { d: 'ファイアー: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: 'ファイアー: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: '火炎放射: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    blizzard: {
      name: 'ブリザード', desc: '吹雪で切り刻み凍傷(減速)を付与', col: '#bff4ff',
      lv: [
        { cd: 4.5, dmg: 5,  radius: 23, dur: 2.5 },
        { cd: 4.2, dmg: 7,  radius: 27, dur: 3.0 },
        { cd: 3.8, dmg: 9,  radius: 30, dur: 3.0 },
        { cd: 3.4, dmg: 12, radius: 35, dur: 3.2 },
        { cd: 3.0, dmg: 16, radius: 40, dur: 3.5 },
      ],
      evo: { name: 'アブソリュートゼロ', desc: '凍傷1スタックごとに被ダメージ+1%。吹雪が毎秒+10%拡大', st: { cd: 2.6, dmg: 20, radius: 48, dur: 4.0 } },
      // 武器スキル(E)アイシクルフォール: 構え windup 秒(動けない)→ 照準位置(半径 radius、range まで)に dur 秒で n 本のつららが降る(範囲内の敵を狙う。いなければランダムな位置)
      //   氷雨: 攻撃頻度 ×rainK
      //   1本: 半径 iceR に 武器の威力 × pow と凍傷 +frost / 大氷柱: 最後に 武器の威力 × bigPow(半径 bigR)/ 凍てつく大地: 跡が patchT 秒(凍傷 +1 / 0.5秒)
      skill: {
        name: 'アイシクルフォール', cd: 20, windup: 0.3, dur: 3, n: 15, radius: 60, range: 200, iceR: 18, pow: 1.5, frost: 2, rainK: 1.5, bigPow: 10, bigR: 60, patchT: 3,
        tree: { name: 'アイシクルフォール', paths: {
          pow: { name: '威力', desc: ['アイシクルフォールの威力 +30%', 'アイシクルフォールの威力 +60%', 'アイシクルフォールの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '大氷柱', desc: '最後に巨大なつららが落ちる(武器の威力 × 1000%、半径 60)' } },
          cd:  { name: '迅速', desc: ['アイシクルフォールのCD -10%', 'アイシクルフォールのCD -20%', 'アイシクルフォールのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '氷雨', desc: 'つららの攻撃頻度が 1.5倍(同じ時間で 1.5倍の本数が降る)' } },
          n:   { name: '本数', desc: ['つらら +3本', 'つらら +6本', 'つらら +10本'], v: [3, 6, 10], sp: { name: '凍てつく大地', desc: 'つららの跡が 3秒残り、触れた敵に凍傷 +1 / 0.5秒' } },
        } },
      },
      // 熟練(クライオマンサーの Lv で解放。ブリザードを使うどのクラスにも効く)
      mastery: {
        4: { d: 'ブリザード: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: 'アイシクルフォール: つらら +3本', fx: { eCount: 3 } },
        7: { d: 'ブリザード: 範囲 +10%', fx: { area: 0.1 } },
        9: { d: 'ブリザード: 持続 +0.5秒', fx: { dur: 0.5 } },
        10: { d: '進化「アブソリュートゼロ」を解放', fx: { evo: 1 } },
        12: { d: 'ブリザード: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: 'ブリザード: 範囲 +10%', fx: { area: 0.1 } },
        17: { d: 'ブリザード: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: 'ブリザード: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: 'アイシクルフォール: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    bhole: {
      name: 'ブラックホール', desc: '敵を吸い込む特異点を生成', col: '#c78bff',
      lv: [
        { cd: 6.0, dmg: 5,  dur: 1.0, radius: 30, pull: 80 },
        { cd: 5.6, dmg: 6,  dur: 1.2, radius: 33, pull: 87 },
        { cd: 5.2, dmg: 8,  dur: 1.4, radius: 37, pull: 93 },
        { cd: 4.8, dmg: 10, dur: 1.6, radius: 40, pull: 100 },
        { cd: 4.2, dmg: 13, dur: 2.0, radius: 43, pull: 110 },
      ],
      // atkDown: ブラックホールの中(半径)にいる間、敵(ボスも)の攻撃力 -atkDown(体当たり・矢・ボスの攻撃。設置物と放物線の弾は除く)
      evo: { name: 'ビッグクランチ', desc: '消滅時に超新星爆発を起こす。中の敵の攻撃力 -25%', st: { cd: 4.0, dmg: 16, dur: 2.6, radius: 55, pull: 130 }, atkDown: 0.25 },
      // 武器スキル(E)ディメンション・リフト: 構え windup 秒(動けない)→ dur 秒間、画面全体を異次元に沈める(放った後は動ける)
      //   every 秒ごとに、画面内の全ての敵(ボスも)へ 武器の威力 × pow。距離・範囲は関係ない。効果中に画面へ入ってきた敵にも当たる
      //   当たり方は静か(音・光を出さない。数字はクリティカルだけ)/ radius: 自動発動の判定距離
      //   次元断層: 最後に画面内の全ての敵へ 武器の威力 × faultPow / 次元歪み: 当たるたびに、終わるまで受けるダメージ +warp ずつ(どの攻撃でも。上限なし)
      //   異次元送り: 効果中、画面内で HP が exile 以下(ボスは exileBoss 以下)になった敵は消える(倒した扱い)
      skill: {
        name: 'ディメンション・リフト', cd: 30, windup: 0.4, dur: 5, every: 0.5, pow: 1.5, radius: 120,
        faultPow: 15, warp: 0.05, exile: 0.5, exileBoss: 0.2,
        tree: { name: 'ディメンション・リフト', paths: {
          pow: { name: '威力', desc: ['ディメンション・リフトの威力 +30%', 'ディメンション・リフトの威力 +60%', 'ディメンション・リフトの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '次元断層', desc: '最後に画面全体が一度に裂け、画面内の全ての敵に 武器の威力 × 1500%' } },
          cd:  { name: '迅速', desc: ['ディメンション・リフトのCD -10%', 'ディメンション・リフトのCD -20%', 'ディメンション・リフトのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '次元歪み', desc: 'ディメンション・リフトのダメージを受けるたびに、その敵が受けるダメージ +5% ずつ(終わるまで。どの攻撃でも)' } },
          dur: { name: '持続', desc: ['ディメンション・リフトの持続 +1秒', 'ディメンション・リフトの持続 +2秒', 'ディメンション・リフトの持続 +3秒'], v: [1, 2, 3], sp: { name: '異次元送り', desc: '効果中に HP が 50% 以下になった敵(ボスは 20% 以下)は、そのまま異次元へ消える(倒した扱い)' } },
        } },
      },
      // 熟練(アストロマンサーの Lv で解放。ブラックホールを使うどのクラスにも効く)
      mastery: {
        4: { d: 'ブラックホール: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: 'ディメンション・リフト: 持続 +1秒', fx: { eDur: 1 } },
        7: { d: 'ブラックホール: 範囲 +10%', fx: { area: 0.1 } },
        9: { d: 'ブラックホール: 持続 +0.3秒', fx: { dur: 0.3 } },
        10: { d: '進化「ビッグクランチ」を解放', fx: { evo: 1 } },
        12: { d: 'ブラックホール: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: 'ブラックホール: 範囲 +10%', fx: { area: 0.1 } },
        17: { d: 'ブラックホール: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: 'ブラックホール: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: 'ディメンション・リフト: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    katana: {
      name: '刀', desc: '最も近い敵へ素早い斬撃', col: '#ff5d73', cut: true,
      lv: [
        { cd: 1.0,  dmg: 16, count: 1, aoe: 30 },
        { cd: 0.9,  dmg: 22, count: 1, aoe: 34 },
        { cd: 0.85, dmg: 26, count: 2, aoe: 39 },
        { cd: 0.8,  dmg: 32, count: 2, aoe: 44 },
        { cd: 0.72, dmg: 39, count: 3, aoe: 50 },
      ],
      // 武器スキル(E)乱れ桜: 構え windup 秒 → dur 秒間 周囲(半径 radius)を hits 回斬る(1回 武器の威力 × pow)。使っている間も移動できる
      skill: {
        name: '乱れ桜', cd: 25, windup: 0.2, dur: 1.5, hits: 10, radius: 50, pow: 1.5, burst: 8, burstR: 70,
        tree: { name: '乱れ桜', paths: {
          pow: { name: '威力', desc: ['乱れ桜の威力 +30%', '乱れ桜の威力 +60%', '乱れ桜の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '桜吹雪', desc: '終了時に花びらが爆散する(武器の威力 × 800%)' } },
          cd:  { name: '迅速', desc: ['乱れ桜のCD -10%', '乱れ桜のCD -20%', '乱れ桜のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '剣の舞', desc: '使っている間、敵を1体倒すごとにCD -1秒' } },
          dur: { name: '持続', desc: ['乱れ桜の持続 +0.45秒', '乱れ桜の持続 +0.9秒', '乱れ桜の持続 +1.5秒'], v: [0.45, 0.9, 1.5], sp: { name: '千本桜', desc: '使っている間、移動速度 +50%・無敵' } },
        } },
      },
      evo: { name: '鬼神・村正', desc: '刀が 50回当たるごとに、ランダムな方向へ一閃の切り裂き(刀の威力 × 800%、出血 5。CD 1秒)', st: { cd: 0.64, dmg: 48, count: 3, aoe: 57 } },
      // 熟練(クラスLv の「共通」強化)。サムライの Lv で解放され、刀を使うどのクラスにも効く
      // fx: dmg 威力 / area 範囲 / cd クールダウン(攻撃間隔と武器スキルの CD。乗算で重ねる)/ evo 進化の解放 / eHits・ePow 武器スキルの回数・威力
      mastery: {
        4: { d: '刀: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: '乱れ桜: 斬る回数 +2', fx: { eHits: 2 } },
        7: { d: '刀: 範囲 +10%', fx: { area: 0.1 } },
        9: { d: '刀: クールダウン -10%', fx: { cd: 0.1 } },
        10: { d: '進化「鬼神・村正」を解放', fx: { evo: 1 } },
        12: { d: '刀: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: '刀: 攻撃回数 +1', fx: { count: 1 } },
        17: { d: '刀: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: '刀: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: '乱れ桜: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    longbow: {
      name: '長弓', desc: '照準方向へ貫通する矢を放つ(本数が多いときは時間差で連射)', col: '#b8ff9a',
      lv: [
        { cd: 1.2,  dmg: 18, count: 1, speed: 260, pierce: 1 },
        { cd: 1.1,  dmg: 22, count: 1, speed: 270, pierce: 2 },
        { cd: 1.05, dmg: 26, count: 2, speed: 280, pierce: 3 },
        { cd: 1.0,  dmg: 32, count: 2, speed: 290, pierce: 4 },
        { cd: 0.95, dmg: 37, count: 3, speed: 300, pierce: 5 },
      ],
      evo: { name: '天弓', desc: '矢が同じ敵に二度当たる(2回目は貫通を1消費する)', st: { cd: 0.9, dmg: 44, count: 3, speed: 320, pierce: 6 } },
      // 武器スキル(E)アローレイン: 構え windup 秒(動けない)→ 照準位置の半径 radius に dur 秒間矢が降り、every 秒ごとに範囲内の敵全員へ
      // 武器の威力 × pow(見た目の矢は1回に arrows 本 × 広さ(半径 60 を基準に最大 2.5倍)。画質で減らす。最後の 1回は倍)/ range: 照準の最大距離 / fire: 炎の矢の炎上(与えたダメージの割合を fireT 秒で)
      skill: {
        name: 'アローレイン', cd: 25, windup: 0.3, dur: 2.5, every: 0.25, pow: 1.4, arrows: 12, radius: 90, range: 200, fire: 0.4, fireT: 3,
        tree: { name: 'アローレイン', paths: {
          pow:  { name: '威力', desc: ['アローレインの威力 +30%', 'アローレインの威力 +60%', 'アローレインの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '豪雨', desc: '攻撃の間隔が半分になる(各 威力 -40%)' } },
          cd:   { name: '迅速', desc: ['アローレインのCD -10%', 'アローレインのCD -20%', 'アローレインのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '追従', desc: '雨の範囲がプレイヤーについてくる。持続 +50%' } },
          area: { name: '範囲', desc: ['アローレインの半径 +20%', 'アローレインの半径 +40%', 'アローレインの半径 +60%'], v: [0.2, 0.4, 0.6], sp: { name: '炎の矢', desc: '矢が炎を纏い、与えたダメージの 40% を炎上で追加する' } },
        } },
      },
      // 熟練(アーチャーの Lv で解放。長弓を使うどのクラスにも効く)
      mastery: {
        4: { d: '長弓: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: 'アローレイン: 持続 +0.5秒', fx: { eDur: 0.5 } },
        7: { d: '長弓: 弾速 +15%', fx: { speed: 0.15 } },
        9: { d: '長弓: 貫通 +1', fx: { pierce: 1 } },
        10: { d: '進化「天弓」を解放', fx: { evo: 1 } },
        12: { d: '長弓: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: '長弓: 本数 +1', fx: { count: 1 } },
        17: { d: '長弓: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: '長弓: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: 'アローレイン: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    longsword: {
      name: '騎士剣', desc: '正面を大きく薙ぎ払う(遅いが広く、押し返しが強い)', col: '#ffe9a0', cut: true,
      lv: [
        { cd: 1.5,  dmg: 20, count: 1, aoe: 35 },
        { cd: 1.45, dmg: 26, count: 1, aoe: 40 },
        { cd: 1.4,  dmg: 32, count: 2, aoe: 45 },
        { cd: 1.35, dmg: 40, count: 2, aoe: 51 },
        { cd: 1.3,  dmg: 48, count: 3, aoe: 56 },
      ],
      evo: { name: '聖剣', desc: '薙ぎ払いが当たった敵に、光の剣が上から降って追撃する(25%)。当てるたびに 5秒のシールド +1', st: { cd: 1.25, dmg: 58, count: 3, aoe: 63 } },
      // 武器スキル(E)グランドスラム: シールドを最大HP の shield 分(shieldT 秒)得る → 構え windup 秒(動けない)
      //   → 前方へ衝撃波が steps 段(各 武器の威力 × pow + 今のシールド、半径 waveR、段の間隔 gap 秒・距離 stepD)
      skill: {
        name: 'グランドスラム', cd: 22, windup: 0.3, steps: 3, pow: 2.5, waveR: 22, stepD: 28, gap: 0.12, shield: 0.1, shieldT: 12, radius: 70,
        tree: { name: 'グランドスラム', paths: {
          pow:   { name: '威力', desc: ['グランドスラムの威力 +30%', 'グランドスラムの威力 +60%', 'グランドスラムの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '地割れ', desc: '衝撃波の跡に 5秒間、割れ目が残る(武器の威力 × 80% / 0.5秒)' } },
          cd:    { name: '迅速', desc: ['グランドスラムのCD -10%', 'グランドスラムのCD -20%', 'グランドスラムのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '余震', desc: '1.5秒後に、同じ衝撃波がもう一度走る(威力 60%)' } },
          guard: { name: '堅陣', desc: ['グランドスラムで得るシールド +50%', 'グランドスラムで得るシールド +100%', 'グランドスラムで得るシールド +200%'], v: [0.5, 1.0, 2.0], sp: { name: '吹き飛ばし', desc: '当たった敵を大きく吹き飛ばし、1.5秒スタンさせる' } },
        } },
      },
      mastery: {
        4: { d: '騎士剣: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: 'グランドスラム: 衝撃波 +1段', fx: { eSteps: 1 } },
        7: { d: '騎士剣: 範囲 +10%', fx: { area: 0.1 } },
        9: { d: '騎士剣: クールダウン -10%', fx: { cd: 0.1 } },
        10: { d: '進化「聖剣」を解放', fx: { evo: 1 } },
        12: { d: '騎士剣: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: '騎士剣: 範囲 +10%', fx: { area: 0.1 } },
        17: { d: '騎士剣: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: '騎士剣: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: 'グランドスラム: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
  },

  statLabels: {
    cd: '攻撃間隔', dmg: '威力', count: '数', speed: '弾速', pierce: '貫通', strikes: '落雷数',
    aoe: '範囲', radius: '半径', rot: '回転', tick: '間隔', burn: '燃焼/s', dur: '持続', pull: '吸引', size: 'サイズ',
  },

  // ---------- ステータス定義 ----------
  // kind: flat=加算 / pct=加算の割合(0.1 = +10%) / red=乗算で重ねる軽減(合計 = 1 - Π(1 - x))
  // group: ステータス画面の分類(life=生命 / skill=技巧 / balance=天秤 / special=特殊)
  stats: {
    hp:        { label: 'HP',                   kind: 'flat', group: 'life' },
    regen:     { label: 'HP回復速度',           kind: 'flat', group: 'life', unit: '/s' },
    def:       { label: '防御力',               kind: 'flat', group: 'life' },
    dr:        { label: 'ダメージ軽減',         kind: 'red',  group: 'life' },
    sta:       { label: 'スタミナ',             kind: 'flat', group: 'life' },
    staRegen:  { label: 'スタミナ回復速度',     kind: 'flat', group: 'life', unit: '/s' },
    iframe:    { label: '無敵時間',             kind: 'pct',  group: 'life' },
    food:      { label: '食べ物の効果',         kind: 'pct',  group: 'life' },
    spd:       { label: '移動速度',             kind: 'pct',  group: 'skill' },
    atk:       { label: '攻撃力',               kind: 'pct',  group: 'skill' },
    area:      { label: '範囲',                 kind: 'pct',  group: 'skill' },
    range:     { label: '射程',                 kind: 'pct',  group: 'skill' },
    cd:        { label: 'クールダウン',         kind: 'red',  group: 'skill' },
    crit:      { label: 'クリティカル率',       kind: 'pct',  group: 'skill' },
    critDmg:   { label: 'クリティカルダメージ', kind: 'pct',  group: 'skill' },
    wslot:     { label: '武器枠',               kind: 'flat', group: 'skill' },
    xp:        { label: '経験値',               kind: 'pct',  group: 'balance' },
    gold:      { label: '獲得ゴールド',         kind: 'pct',  group: 'balance' },
    magnet:    { label: '吸引範囲',             kind: 'pct',  group: 'balance' },
    eqQual:    { label: '装備品質',             kind: 'pct',  group: 'balance' },
    chestQual: { label: '宝箱品質',             kind: 'pct',  group: 'balance' },
    classXp:   { label: 'クラス経験値',         kind: 'pct',  group: 'balance' },
    reroll:    { label: 'リロール回数',         kind: 'flat', group: 'balance' },
    classPick: { label: 'クラス強化選択枠',     kind: 'flat', group: 'balance' },
    gearPick:  { label: '武具強化選択枠',       kind: 'flat', group: 'balance' }, // 武器カード・装備カードの枚数 +1
    shots:     { label: '弾数',                 kind: 'flat', group: 'special' },
    eqMaxLv:   { label: '装備最大Lv',           kind: 'flat', group: 'special' },
    eqMaxVal:  { label: '装備最大値',           kind: 'pct',  group: 'special' },
  },

  // ---------- 微強化(武器カードを取り切った後のレベルアップ。メニューなしでランダムに1つ) ----------
  // hpPct は最大HP の倍率(%)。他は DATA.stats と同じ単位
  micro: [
    { k: 'atk', v: 0.01, label: '攻撃力 +1%' }, { k: 'hpPct', v: 0.01, label: '最大HP +1%' },
    { k: 'spd', v: 0.005, label: '移動速度 +0.5%' }, { k: 'cd', v: 0.005, label: 'クールダウン -0.5%' },
    { k: 'area', v: 0.01, label: '範囲 +1%' }, { k: 'range', v: 0.01, label: '射程 +1%' },
  ],

  // ---------- クラス ----------
  // base: 基礎ステータス(共通基準 + クラス差。設計書 3.6)。crit / critDmg は割合(0.05 = 5%、1.0 = +100% = ×2)
  // lv: クラスLv の「専用」強化 { Lv: { d: 説明, st: ステータス, fx: クラスの実装が読む値 } }
  //     「共通」強化は武器側(DATA.weapons[].mastery)。その武器を持つクラスの Lv で解放され、どのクラスが使っても効く
  classes: {
    samurai: {
      name: 'サムライ', en: 'SAMURAI', weapon: 'katana', col: '#ff5d73', light: '#ffe2c8', rig: 'samurai', // rig: 部位アニメーション(ART.S) / light: 足元の光
      base: { hp: 110, regen: 0.2, def: 1, sta: 100, staRegen: 20, atk: 0.1, range: -0.1, crit: 0.05, critDmg: 1.0, magnet: -0.1, wslot: 4, reroll: 2 },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '剣気獲得 +10%', fx: { kiGain: 0.1 } },
        6: { d: 'ジャスト見切りの受付 +0.05秒', fx: { parryWin: 0.05 } },
        8: { d: '残心: 攻撃力 +5%', fx: { zanshinAtk: 0.05 } },
        11: { d: '居合: 威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '最大HP +15、スタミナ +20', st: { hp: 15, sta: 20 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
      // 剣気: 通常攻撃の命中 +kiHit(1回の攻撃で kiHitCap まで)、ジャスト見切り +kiParry。kiFull 以上の間は攻撃力 +kiFullAtk
      //       最大値は kiMax(残気で増える)
      // 見切り: 構えた瞬間にスタミナ guardCost を消費。ガード中は移動 ×guardSlow。押してから parryWin 秒以内の被弾でジャスト(反撃 基礎威力 parryPow・半径 parryR・無敵 parryIfr)
      //         スタミナ 0 でガードブレイク(breakT 秒ガード不可・被ダメ +breakDmg)
      // 残心: 防御スキルで攻撃を受けた後 zanshinT 秒、攻撃力 +zanshinAtk
      params: {
        kiMax: 100, kiFull: 100, kiHit: 1, kiHitCap: 5, kiParry: 30, kiFullAtk: 0.2,
        guardCost: 15, guardSlow: 0.5, parryWin: 0.25, parryPow: 60, parryR: 40, parryIfr: 0.5, breakT: 2, breakDmg: 0.2,
        zanshinT: 3, zanshinAtk: 0.15,
      },
      // 居合・朧月(Q): 構え windup 秒 → dist 先へ突進(幅 width、無敵)→ 通過した敵を斬る。硬直 recover 秒
      // ダメージ = 基礎威力 pow + 消費した剣気 × kiPow(武器に依存しない)
      q: { name: '居合・朧月', cd: 30, windup: 0.25, dash: 0.1, recover: 0.2, dist: 90, width: 12, pow: 150, kiPow: 5 },
      // ラン中の強化ツリー(3の倍数のLv で選ぶ)。カテゴリ → 強化パス(Lv1〜3、v が各Lvの値)→ 特殊強化(sp)
      // need: そのスキルが実装済みの場合だけ候補に出す(CLASS_RT の skills に含まれるもの)
      // 特殊強化は各パスが Lv3 で候補に出る。1カテゴリにつき1つだけ取れる
      // E(武器スキル)の強化パスはメイン武器の側(DATA.weapons[].skill.tree)にあり、同じ候補に混ぜて出す
      tree: {
        trait: { name: '剣気', paths: {
          ren: { name: '練気', desc: ['剣気獲得 +30%', '剣気獲得 +60%', '剣気獲得 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '無尽', desc: 'E スキルでも剣気を全て消費し、剣気 × 0.5% だけ威力が上がる' } },
          juu: { name: '充溢', desc: ['剣気100以上の攻撃力 20% → 30%', '剣気100以上の攻撃力 40%', '剣気100以上の攻撃力 50%'], v: [0.3, 0.4, 0.5], sp: { name: '明鏡止水', desc: '剣気100以上の間、被ダメージ -30%・全武器の攻撃速度 +25%' } },
          zan: { name: '残気', need: 'q', desc: ['剣気の最大値 +30', '剣気の最大値 +60', '剣気の最大値 +100'], v: [30, 60, 100], sp: { name: '連環', desc: '居合のCDが、消費した剣気1につき 0.1秒短くなる' } },
        } },
        passive: { name: '残心', paths: {
          kihaku: { name: '気迫', desc: ['残心の攻撃力 15% → 20%', '残心の攻撃力 25%', '残心の攻撃力 30%'], v: [0.2, 0.25, 0.3], sp: { name: '背水', desc: 'HP 75% 以下で、残心の効果が2倍' } },
          jizoku: { name: '持続', desc: ['残心の効果時間 +1秒', '残心の効果時間 +2秒', '残心の効果時間 +3秒'], v: [1, 2, 3], sp: { name: '常在戦場', desc: '残心中に敵を倒すと、効果時間がリセットされる' } },
          migaru: { name: '身軽', desc: ['残心中の移動速度 +10%', '残心中の移動速度 +20%', '残心中の移動速度 +30%'], v: [0.1, 0.2, 0.3], sp: { name: '不動', desc: '残心中の被ダメージ -25%' } },
        } },
        q: { name: '居合・朧月', need: 'q', paths: {
          pow: { name: '威力', desc: ['居合の威力 +30%', '居合の威力 +60%', '居合の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '一刀両断', desc: '剣気100以上で使うと威力 ×1.5、斬った敵に出血10スタック' } },
          cd:  { name: '迅速', desc: ['居合のCD -10%', '居合のCD -20%', '居合のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '燕返し', desc: '到達後、元の位置へ戻りながらもう一度斬る(60%)' } },
          reach: { name: '間合', desc: ['居合の突進距離・幅 +30%', '居合の突進距離・幅 +60%', '居合の突進距離・幅 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '空蝉', desc: '開始地点に分身を残し、2秒間敵の攻撃を引きつける' } },
        } },
      },
    },
    mage: {
      name: 'メイジ', en: 'MAGE', weapon: 'bolt', col: '#7ad7ff', light: '#cfeeff', rig: 'mage',
      base: { hp: 90, sta: 90, staRegen: 24, spd: -0.05, area: 0.1, range: 0.1, cd: 0.05, crit: 0.05, critDmg: 1.0, magnet: 0.1, wslot: 4, reroll: 2 },
      // 元素循環: 通常攻撃・E の攻撃1回ごとに 炎 → 氷 → 雷
      //   炎: 与えたダメージの burnPct を burnDur 秒かけて / 氷: 凍傷 +1(上限 frostCap)/ 雷: 近く(chainR)の敵 chainN 体へ chainPct
      // 共鳴: 2属性を持つ敵に3属性目 → 爆発(基礎威力 resoPow・半径 resoR)して属性リセット。魔力結晶 +1(最大 crystalMax + 結晶容量)
      //   上限のときは 次のスキルの威力 +crysOvf(最大 crysOvfMax。E か Q の発動で全て消費。オーバーフローとは別枠)
      //   魔力増幅: 魔力結晶 1つにつき攻撃力 +ampAtk
      // 魔力循環: 通常攻撃の命中ごとに E / Q の CD -flowCut 秒(1秒あたり flowCap 秒まで)
      // ブリンク: 移動方向へ blinkDist 瞬間移動、無敵 blinkIfr 秒、スタミナ blinkCost。出発地点に氷の残滓(residueT 秒・半径 residueR。触れた敵に凍傷)
      params: {
        burnPct: 0.2, burnDur: 3, frostCap: 5, chainPct: 0.3, chainN: 1, chainR: 60,
        resoPow: 25, resoR: 30, crystalMax: 10, crysOvf: 0.005, crysOvfMax: 0.5, ampAtk: 0.02,
        flowCut: 0.05, flowCap: 0.5,
        blinkDist: 50, blinkIfr: 0.15, blinkCost: 80, residueT: 1.5, residueR: 14,
      },
      // メテオ(Q): 照準位置へ。詠唱 windup 秒(動けない)→ fall 秒後に着弾(基礎威力 pow・半径 r・与えたダメージの burnPct を炎上で)。武器に依存しない
      //   魔力結晶を全て消費し、1つにつき 威力 +crystalPow・半径 +crystalR / range: 照準の最大距離
      //   メテオスウォームの小隕石: 周り(半径の2倍)の敵を狙う。各 基礎威力 swarmPow(炎上も同じ)/ 審判の落雷: 範囲内の敵を狙う。各 基礎威力 judgePow
      q: { name: 'メテオ', cd: 45, windup: 0.5, fall: 0.3, pow: 250, r: 70, burnPct: 0.5, crystalPow: 0.1, crystalR: 0.05, range: 170, swarmPow: 100, judgePow: 50 },
      // 属性強化の Lv ごとの値: 炎上 +10%/Lv(倍率)・凍傷上限 elFrost・連鎖 +1体/Lv
      elFrost: [2, 4, 5],
      tree: {
        trait: { name: '元素循環', paths: {
          el: { name: '属性強化', desc: ['炎上 +10%・凍傷上限 +2・連鎖 +1体', '炎上 +20%・凍傷上限 +4・連鎖 +2体', '炎上 +30%・凍傷上限 +5・連鎖 +3体'], v: [1, 2, 3], sp: { name: '三重詠唱', desc: '25% の確率で、1発が3属性すべてを持つ' } },
          rpow: { name: '共鳴威力', desc: ['共鳴の威力 +30%', '共鳴の威力 +60%', '共鳴の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '連鎖共鳴', desc: '共鳴に巻き込まれた敵にも、ランダムな属性を1つ付与する' } },
          crys: { name: '結晶容量', desc: ['魔力結晶の容量 +3', '魔力結晶の容量 +6', '魔力結晶の容量 +10'], v: [3, 6, 10], sp: { name: '魔力増幅', desc: '魔力結晶 1つにつき攻撃力 +2%' } },
        } },
        passive: { name: '魔力循環', paths: {
          flow: { name: '循環', desc: ['CD の短縮量 +0.01秒', 'CD の短縮量 +0.02秒', 'CD の短縮量 +0.03秒'], v: [0.01, 0.02, 0.03], sp: { name: 'オーバーフロー', desc: 'E か Q の CD が 0 の状態でメイン武器の通常攻撃が命中すると、次のスキルの威力 +0.1%(最大 +50%)' } },
          cap: { name: '容量', desc: ['1秒あたりの上限 +0.1秒', '1秒あたりの上限 +0.3秒', '1秒あたりの上限 +0.5秒'], v: [0.1, 0.3, 0.5], sp: { name: '瞑想', desc: '3秒間被弾しないと、HP 2/s で回復し続ける' } },
          echo: { name: '余韻', desc: ['スキル使用後5秒、全武器の攻撃速度 +10%', 'スキル使用後5秒、全武器の攻撃速度 +20%', 'スキル使用後5秒、全武器の攻撃速度 +30%'], v: [0.1, 0.2, 0.3], sp: { name: '詠唱加速', desc: 'スキル使用後5秒、全武器の弾数 +1(近接武器では攻撃回数 +1)' } },
        } },
        q: { name: 'メテオ', need: 'q', paths: {
          pow: { name: '威力', desc: ['メテオの威力 +30%', 'メテオの威力 +60%', 'メテオの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: 'メテオスウォーム', desc: '周囲の敵を狙って小隕石を5個追加する(各 基礎威力 100)' } },
          cd:  { name: '迅速', desc: ['メテオのCD -10%', 'メテオのCD -20%', 'メテオのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '審判', desc: '着弾後、範囲内の敵を狙って落雷を6回落とす(各 基礎威力 50)' } },
          area: { name: '範囲', desc: ['メテオの半径 +15%', 'メテオの半径 +30%', 'メテオの半径 +50%'], v: [0.15, 0.3, 0.5], sp: { name: '絶対零度', desc: '着弾地点に氷原を4秒間残す(凍傷が即座に最大)' } },
        } },
      },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '共鳴: 威力 +10%', fx: { resoPow: 0.1 } },
        6: { d: 'ブリンク: スタミナ消費 -10', fx: { blinkCut: 10 } },
        8: { d: '魔力循環: 短縮量 +0.01秒', fx: { flowCut: 0.01 } },
        11: { d: 'メテオ: 威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '魔力結晶の上限 +5', fx: { crystalMax: 5 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
    },
    archer: {
      name: 'アーチャー', en: 'ARCHER', weapon: 'longbow', col: '#7dff9a', light: '#e4ffd8', rig: 'hunter',
      base: { hp: 90, sta: 100, staRegen: 25, spd: 0.1, area: -0.1, range: 0.2, crit: 0.1, critDmg: 1.0, wslot: 4, reroll: 2 },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '狩人の印: 印1つの被ダメ +1%', fx: { markPct: 0.01 } },
        6: { d: 'バックステップ: スタミナ消費 -10', fx: { backCut: 10 } },
        8: { d: '集中: 最大段 +1', fx: { focusMax: 1 } },
        11: { d: '一斉射撃: 威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '射程 +10%、スタミナ +10', st: { range: 0.1, sta: 10 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
      // 狩人の印: 通常攻撃・E の命中で敵に印 +1(最大 markMax)。1つにつき被ダメ +markPct。markT 秒 刻まれないと消える
      //   印が markMax 以上で弱点露出(weakT 秒、その敵へのクリティカル率 +weakCrit)
      // 集中: 止まっている間 focusStep 秒ごとに +1段(最大 focusMax)。移動すると focusDecay 段/秒 下がる。被弾で -focusHurt
      //   1段につき 攻撃速度 +focusAtkSpd・クリティカル率 +focusCrit
      // バックステップ: 移動と逆へ backDist を backTime 秒で跳ぶ(無敵 backIfr 秒、スタミナ backCost)。着地で集中 +backFocus
      // 狩りの連鎖: 印を持つ敵を倒すと一斉射撃の CD -chainCd。縮む量は 1秒あたり chainMax まで(chainMax 分の枠が 1秒で溜まる)
      params: {
        markMax: 10, markPct: 0.04, markT: 3, weakT: 3, weakCrit: 0.15, spreadR: 60, guardT: 5, chainCd: 0.1, chainMax: 0.5,
        focusMax: 5, focusStep: 0.5, focusDecay: 1, focusAtkSpd: 0.04, focusCrit: 0.02, focusHurt: 2,
        backDist: 80, backTime: 0.15, backIfr: 0.25, backCost: 100, backFocus: 1,
      },
      // 一斉射撃(Q): 構え windup 秒(動けない)→ 画面内の印を持つ敵1体につき1本、その敵へまっすぐ高速の矢(貫通無限・基礎威力 pow)
      //   矢が当たった敵は、印1つにつき markPow の追加ダメージを interval 秒おきに連続で受ける(印は消費)
      //   さらに無条件で、最寄り none 体(印を持つ敵とは別)へも1本ずつ。最大 max 本。流星: 当たるたびに爆発(meteorPow・半径 meteorR)
      q: { name: '一斉射撃', cd: 35, windup: 0.4, pow: 100, markPow: 50, interval: 0.05, none: 10, max: 100, speed: 600, meteorPow: 25, meteorR: 16 },
      tree: {
        trait: { name: '狩人の印', paths: {
          deep:   { name: '深手', desc: ['印の持続 +2秒', '印の持続 +4秒', '印の持続 +7秒'], v: [2, 4, 7], sp: { name: '急所', desc: '弱点露出中の敵へのクリティカルダメージ +30%' } },
          carve:  { name: '刻印', desc: ['印の上限 +3', '印の上限 +6', '印の上限 +10'], v: [3, 6, 10], sp: { name: '守印', desc: '印を持つ敵を倒すと、その印の数だけシールドを得る(5秒)' } },
          spread: { name: '伝播', desc: ['印を持つ敵を倒すと、印の 20% を近くの敵に移す', '印を持つ敵を倒すと、印の 40% を近くの敵に移す', '印を持つ敵を倒すと、印の 75% を近くの敵に移す'], v: [0.2, 0.4, 0.75], sp: { name: '狩りの連鎖', desc: '印を持つ敵を倒すと、一斉射撃の CD -0.1秒(縮むのは 1秒あたり 0.5秒まで)' } },
        } },
        passive: { name: '集中', paths: {
          calm: { name: '静心', desc: ['集中の溜まる速さ +20%', '集中の溜まる速さ +40%', '集中の溜まる速さ +60%'], v: [0.2, 0.4, 0.6], sp: { name: '不動', desc: '集中が最大の間、被ダメージ -20%' } },
          hold: { name: '残心', desc: ['移動中に集中が減る速さ -25%', '移動中に集中が減る速さ -50%', '移動中に集中が減る速さ -75%'], v: [0.25, 0.5, 0.75], sp: { name: '狩りの構え', desc: '防御スキルを使うと集中 +2段' } },
          eye:  { name: '鋭眼', desc: ['集中1段のクリティカル率 +0.5% 追加', '集中1段のクリティカル率 +1% 追加', '集中1段のクリティカル率 +1.5% 追加'], v: [0.005, 0.01, 0.015], sp: { name: '連射', desc: '集中が最大の間、全武器の弾数 +1(近接武器では攻撃回数 +1)' } },
        } },
        q: { name: '一斉射撃', need: 'q', paths: {
          pow: { name: '威力', desc: ['一斉射撃の威力 +30%(矢・追加ダメージ)', '一斉射撃の威力 +60%(矢・追加ダメージ)', '一斉射撃の威力 +100%(矢・追加ダメージ)'], v: [0.3, 0.6, 1.0], sp: { name: '流星', desc: '矢が敵に当たるたびに小さく爆発する(基礎威力 25、半径 16)' } },
          cd:  { name: '迅速', desc: ['一斉射撃のCD -10%', '一斉射撃のCD -20%', '一斉射撃のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '印の嵐', desc: '追加ダメージの後、その敵に印 +5 を刻み直す' } },
          keep: { name: '残印', desc: ['追加ダメージで印を消費しない確率 15%', '追加ダメージで印を消費しない確率 30%', '追加ダメージで印を消費しない確率 50%'], v: [0.15, 0.3, 0.5], sp: { name: '必中', desc: '一斉射撃の矢と追加ダメージは必ずクリティカルになる' } },
        } },
      },
    },
    knight: {
      name: 'ナイト', en: 'KNIGHT', weapon: 'longsword', col: '#f2c84b', light: '#fff1d0', rig: 'knight',
      base: { hp: 120, def: 2, dr: 0.05, sta: 120, staRegen: 16, spd: -0.1, atk: -0.05, range: -0.1, crit: 0.05, critDmg: 1.0, magnet: -0.1, wslot: 4, reroll: 2 },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '聖盾: シールドの上限 +5%(最大HP 比)', fx: { capPct: 0.05 } },
        6: { d: '大盾: スタミナの払い 75% → 65%', fx: { payCut: 0.1 } },
        8: { d: '不屈: 衝撃波の威力 +20%', fx: { breakPow: 0.2 } },
        11: { d: '聖盾の審判: 威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '最大HP +10、スタミナ +20', st: { hp: 10, sta: 20 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
      // 聖盾: シールドの上限 capPct(最大HP 比)。ガードで受けたダメージの convert がシールドに、E / Q を使うと最大HP の skillGain(変換パスで増える)
      //   1秒に今のシールドの decay ずつ減る(聖盾でシールドを得てから decayWait 秒は減らない)。堅守: シールド量 / 上限 × holdAtk だけ攻撃力アップ
      //   盾撃: シールドが上限の ironAt 以上で堅守 ×1.5 / 不滅の盾: 獲得量 +sanctGain・減る量 -sanctDecay
      // 不屈: シールドが割れると衝撃波(breakPow・半径 breakR)と無敵 breakIfr 秒(breakCd 秒に1回)
      // 大盾: 構えた瞬間にスタミナ guardCost。受けたダメージの pay をスタミナで払う。移動 ×guardSlow。スタミナ 0 で breakT 秒 ガード不可
      params: {
        capPct: 0.2, convert: 0.2, skillGain: 0.1, decayWait: 1, decay: 0.05, holdAtk: 0.25, ironAt: 0.3, sanctGain: 0.25, sanctDecay: 0.3,
        breakPow: 75, breakR: 50, breakIfr: 0.5, breakCd: 3, rebuild: 0.3, reflect: 3, reflectR: 70,
        guardCost: 15, pay: 0.75, guardSlow: 0.5, breakT: 2,
      },
      // 聖盾の審判(Q): 構え windup 秒 → シールドを全て消費し、前方の扇形(半径 r・角度 arc)に 基礎威力 pow + 消費シールド × perShield
      //   スタンは stun + 消費シールド × stunPer 秒
      q: { name: '聖盾の審判', cd: 30, windup: 0.4, pow: 150, perShield: 10, r: 90, arc: 2.1, stun: 2, stunPer: 0.01, echo: 0.3 },
      tree: {
        trait: { name: '聖盾', paths: {
          convert: { name: '変換', desc: ['聖盾で得るシールド量 +30%', '聖盾で得るシールド量 +60%', '聖盾で得るシールド量 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '反射', desc: 'ガードで受けたダメージの 300% を、近くの敵に返す' } },
          cap:     { name: '容量', desc: ['シールドの上限 +8%(最大HP 比)', 'シールドの上限 +16%(最大HP 比)', 'シールドの上限 +25%(最大HP 比)'], v: [0.08, 0.16, 0.25], sp: { name: '盾撃', desc: 'シールドが上限の 30% 以上の間、堅守の攻撃力アップが 1.5倍' } },
          hold:    { name: '堅守', desc: ['堅守の攻撃力 25% → 32.5%', '堅守の攻撃力 40%', '堅守の攻撃力 50%'], v: [0.325, 0.4, 0.5], sp: { name: '不滅の盾', desc: 'シールドの獲得量 +25%、シールドの減る量 -30%' } },
        } },
        passive: { name: '不屈', paths: {
          shock:  { name: '衝撃', desc: ['割れたときの衝撃波の威力 +30%', '割れたときの衝撃波の威力 +60%', '割れたときの衝撃波の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '復讐', desc: '衝撃波が 0.4秒後にもう一度起きる' } },
          vigor:  { name: '余力', desc: ['割れたときスタミナ +30', '割れたときスタミナ +60', '割れたときスタミナ +100'], v: [30, 60, 100], sp: { name: '不死身', desc: '割れたとき HP を最大HP の 10% 回復する' } },
          rise:   { name: '再起', desc: ['割れた後の無敵 +0.3秒', '割れた後の無敵 +0.6秒', '割れた後の無敵 +1.0秒'], v: [0.3, 0.6, 1.0], sp: { name: '再構築', desc: '割れて 3秒後に、上限の 30% のシールドを得る' } },
        } },
        q: { name: '聖盾の審判', need: 'q', paths: {
          pow:  { name: '威力', desc: ['聖盾の審判の威力 +30%', '聖盾の審判の威力 +60%', '聖盾の審判の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '聖炎', desc: '当たった敵を燃やす(与えたダメージの 50% を 3秒)' } },
          cd:   { name: '迅速', desc: ['聖盾の審判のCD -10%', '聖盾の審判のCD -20%', '聖盾の審判のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '残響', desc: '消費したシールドの 30% を、使った後に戻す' } },
          area: { name: '範囲', desc: ['聖盾の審判の半径 +15%', '聖盾の審判の半径 +30%', '聖盾の審判の半径 +50%'], v: [0.15, 0.3, 0.5], sp: { name: '全周', desc: '扇形ではなく、全方向に放つ。消費したシールドによる威力 +50%' } },
        } },
      },
    },
    pyro: {
      name: 'パイロマンサー', en: 'PYROMANCER', weapon: 'fire', col: '#ff6a2a', light: '#ff8a3d', rig: 'pyro',
      base: { hp: 90, regen: 1, sta: 100, staRegen: 20, atk: 0.05, area: 0.1, cd: 0.05, crit: 0.05, critDmg: 1.0, wslot: 4, reroll: 2 },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '業火: 1スタックの炎上ダメージ +0.5%', fx: { stackPct: 0.005 } },
        6: { d: '炎壁: スタミナ 75 → 70', fx: { wallCut: 5 } },
        8: { d: '焔纏い: 付与量 +5%', fx: { ignite: 0.05 } },
        11: { d: '煉獄: 威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '最大HP +10、スタミナ +20', st: { hp: 10, sta: 20 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
      // 業火: 火勢 = 敵の炎上 1スタックにつき、その敵の炎上ダメージ +stackPct(stackMax スタック分まで)
      //   延焼 = 炎上中の敵が倒れると、残っていた炎上ダメージの spreadPct を周り(spreadR)の spreadN 体へ 3秒の炎上として
      //   白炎: whiteAt スタック以上の敵へのクリティカル率 +whiteCrit(炎上ダメージにも乗る)/ 連鎖爆発: 半径 chainR / 燻り: 切れたら最後の炎上の emberPct を 3秒
      // 焔纏い: E / Q を使うと wearT 秒 纏う。全武器の命中(通常攻撃・E)で与えたダメージの ignite を 3秒の炎上に
      //   爆ぜる炎: クリティカルで ×critIgnite / 燎原: 炎上中の敵を倒すと +extendT 秒(1回の纏いで extendMax まで)
      //   点火: 纏った瞬間、半径 kindleR に火の輪(炎上は火の輪の kindleBurn を 3秒)/ 業火(特殊): 纏っている間 今のHP の drain/s を消費、炎上ダメージ +hellBurn
      // 炎壁: 周り(wallR)の敵を押し返して炎上(wallBurn/s を 3秒)。無敵 wallIfr 秒、スタミナ wallCost
      params: {
        stackPct: 0.025, stackMax: 10, spreadPct: 0.25, spreadR: 40, spreadN: 2, whiteAt: 10, whiteCrit: 0.2, chainR: 25, emberPct: 0.3,
        wearT: 4, ignite: 0.15, critIgnite: 1.5, extendT: 0.5, extendMax: 3, kindleR: 60, kindleBurn: 0.5, drain: 0.03, hellBurn: 0.5,
        wallR: 45, wallBurn: 15, wallIfr: 0.3, wallCost: 75,
      },
      // 煉獄(Q): 構え windup 秒 → 画面内の炎上中の敵全員の炎上を爆発させる。基礎威力 base + 残っていた炎上ダメージ × mul をすぐに与え、
      //   その敵の周り(半径 r)に 基礎威力 pow + 炎上スタック数 × perStack の爆風。炎上は消費する
      //   残火: 消費した炎上の rekindle を付け直す / 大火: 爆風の bigfire を 3秒の炎上に
      q: { name: '煉獄', cd: 25, windup: 0.5, base: 80, mul: 1.5, r: 30, pow: 40, perStack: 8, rekindle: 0.3, bigfire: 0.5 },
      tree: {
        trait: { name: '業火', paths: {
          stack:  { name: '火勢', desc: ['火勢の最大スタック +3', '火勢の最大スタック +6', '火勢の最大スタック +10'], v: [3, 6, 10], sp: { name: '白炎', desc: '炎上が 10スタック以上の敵へのクリティカル率 +20%(炎上ダメージにも乗る)' } },
          spread: { name: '延焼', desc: ['燃え移る量 25% → 35%', '燃え移る量 45%', '燃え移る量 60%'], v: [0.35, 0.45, 0.6], sp: { name: '連鎖爆発', desc: '延焼のとき、倒れた場所で爆発する(残っていた炎上ダメージの 100%、半径 25)' } },
          dur:    { name: '持続', desc: ['炎上の持続 +0.5秒', '炎上の持続 +1秒', '炎上の持続 +1.5秒'], v: [0.5, 1.0, 1.5], sp: { name: '燻り', desc: '炎上が切れた敵に、残り火(最後の炎上の 30%)が 3秒続く' } },
        } },
        passive: { name: '焔纏い', paths: {
          ignite: { name: '付与', desc: ['焔纏いの付与量 15% → 20%', '焔纏いの付与量 25%', '焔纏いの付与量 30%'], v: [0.2, 0.25, 0.3], sp: { name: '爆ぜる炎', desc: 'クリティカルしたときは付与量が 1.5倍' } },
          wear:   { name: '持続', desc: ['纏う時間 4秒 → 5秒', '纏う時間 6秒', '纏う時間 7.5秒'], v: [5, 6, 7.5], sp: { name: '燎原', desc: '纏っている間に炎上中の敵を倒すと、纏う時間 +0.5秒(1回の纏いで最大 +3秒)' } },
          kindle: { name: '点火', desc: ['纏った瞬間、周りに火の輪(基礎威力 30、炎上を付与)', '火の輪の基礎威力 60', '火の輪の基礎威力 100'], v: [30, 60, 100], sp: { name: '業火', desc: '纏っている間、1秒に今のHP の 3% を消費する。炎上ダメージ +50%' } },
        } },
        q: { name: '煉獄', need: 'q', paths: {
          pow:  { name: '威力', desc: ['煉獄の爆発の倍率 150% → 180%', '煉獄の爆発の倍率 210%', '煉獄の爆発の倍率 250%'], v: [1.8, 2.1, 2.5], sp: { name: '火葬', desc: '爆発で倒れた敵も延焼する' } },
          cd:   { name: '迅速', desc: ['煉獄のCD -10%', '煉獄のCD -20%', '煉獄のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '残火', desc: '爆発した敵に、消費した炎上の 30% を新しい炎上として付け直す' } },
          area: { name: '範囲', desc: ['煉獄の爆風の半径 +20%', '煉獄の爆風の半径 +40%', '煉獄の爆風の半径 +60%'], v: [0.2, 0.4, 0.6], sp: { name: '大火', desc: '爆風が当たった敵にも炎上を付ける(爆風の 50% を 3秒)' } },
        } },
      },
    },
    cryo: {
      name: 'クライオマンサー', en: 'CRYOMANCER', weapon: 'blizzard', col: '#a8e8ff', light: '#e0f8ff', rig: 'cryo',
      base: { hp: 90, def: 1, sta: 100, staRegen: 15, area: 0.1, range: -0.1, cd: 0.05, crit: 0.05, critDmg: 1.0, wslot: 4, reroll: 2 },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '凍結: 被ダメージ +5%', fx: { freezeDmg: 0.05 } },
        6: { d: '氷の鏡: スタミナ -5', fx: { mirrorCut: 5 } },
        8: { d: '氷纏い: 纏う時間 +1秒', fx: { wearT: 1 } },
        11: { d: 'ダイヤモンドダスト: 威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '最大HP +10、スタミナ +20', st: { hp: 10, sta: 20 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
      // 凍結: 凍傷の上限 frostCap(永久凍土で capSp)。上限に達すると凍結(行動不能・被ダメ +freezeDmg、凍傷を付ける攻撃ならさらに +frostHit)
      //   凍結中は凍傷が decay 秒ごとに 1 減り、0 で解除(凍結中は凍傷が増えない)。ボスは行動不能の代わりに攻撃速度 ×bossRate
      //   氷晶の急所: 凍結中の敵へのクリティカル率 +critSp / 寒波: 凍結した瞬間に半径 waveR の敵に凍傷 / 砕氷: 凍結中に倒すと半径 shardR に shardPow と凍傷 +shardFrost
      // 氷纏い: E / Q を使うと wearT 秒。全武器の命中で凍傷 +1(付与: 確率でさらに +1。冷たい刃: クリティカルで確率 2倍)
      //   氷原: 纏っている間に凍結中の敵を倒すと +extendT 秒(1回の纏いで extendMax まで)/ 氷鎧: 纏った瞬間にシールド / 冷気の反撃: 被弾で半径 counterR に凍傷 +counterFrost
      // 氷の鏡: 移動と逆へ mirrorDist を mirrorTime 秒で下がる(無敵 mirrorIfr 秒、スタミナ mirrorCost)。元の位置に分身 decoyT 秒(触れた敵に凍傷 +decoyFrost、1体1回)
      params: {
        frostCap: 30, capSp: 50, freezeDmg: 0.25, frostHit: 0.25, decay: 0.1, bossRate: 0.7, critSp: 0.3, waveR: 30, shardR: 30, shardPow: 100, shardFrost: 5,
        wearT: 4, extendT: 0.5, extendMax: 3, counterR: 50, counterFrost: 5,
        mirrorDist: 60, mirrorTime: 0.15, mirrorIfr: 0.25, mirrorCost: 100, decoyT: 2, decoyR: 10, decoyFrost: 5,
      },
      // ダイヤモンドダスト(Q): 構え windup 秒 → 自分を中心に dur 秒の細氷の領域(半径 r、ついてくる)。every 秒ごとに凍傷 +frost と 基礎威力 pow
      //   この範囲内で凍結した敵は凍結時間 +freezeUp(凍傷の減りが遅くなる)/ 煌めき: 凍結中の敵に every 秒ごとに glitter
      //   永い冬: 凍結時間 +longFreeze、持続 +longDur / ホワイトアウト: 範囲内の敵の弾の速さ ×whiteout
      q: { name: 'ダイヤモンドダスト', cd: 30, windup: 0.4, dur: 4, r: 100, every: 0.5, frost: 5, pow: 50, freezeUp: 0.3, glitter: 100, longFreeze: 0.2, longDur: 1, whiteout: 0.5 },
      tree: {
        trait: { name: '凍結', paths: {
          deep:    { name: '深凍', desc: ['凍結中の凍傷の減り 0.1秒 → 0.115秒', '凍結中の凍傷の減り 0.13秒', '凍結中の凍傷の減り 0.15秒'], v: [0.115, 0.13, 0.15], sp: { name: '氷晶の急所', desc: '凍結中の敵へのクリティカル率 +30%' } },
          brittle: { name: '脆化', desc: ['凍結中の被ダメージ +25% → +30%', '凍結中の被ダメージ +35%', '凍結中の被ダメージ +45%'], v: [0.3, 0.35, 0.45], sp: { name: '永久凍土', desc: '凍傷の上限(凍結に必要な凍傷)が 50 になる。凍結で増える被ダメージが 2倍' } },
          wave:    { name: '寒波', desc: ['凍結した瞬間、周りの敵に凍傷 +2', '凍結した瞬間、周りの敵に凍傷 +4', '凍結した瞬間、周りの敵に凍傷 +6'], v: [2, 4, 6], sp: { name: '砕氷', desc: '凍結中の敵を倒すと砕け、周りに破片(基礎威力 100、凍傷 +5)' } },
        } },
        passive: { name: '氷纏い', paths: {
          chance: { name: '付与', desc: ['命中時、6% でさらに凍傷 +1', '命中時、12% でさらに凍傷 +1', '命中時、20% でさらに凍傷 +1'], v: [0.06, 0.12, 0.2], sp: { name: '冷たい刃', desc: 'クリティカルしたときは「付与」の確率が 2倍' } },
          wear:   { name: '持続', desc: ['纏う時間 4秒 → 5秒', '纏う時間 6秒', '纏う時間 7.5秒'], v: [5, 6, 7.5], sp: { name: '氷原', desc: '纏っている間に凍結中の敵を倒すと、纏う時間 +0.5秒(1回の纏いで最大 +3秒)' } },
          armor:  { name: '氷鎧', desc: ['纏った瞬間、最大HP の 5% のシールド(纏っている間)', '纏った瞬間、最大HP の 10% のシールド', '纏った瞬間、最大HP の 15% のシールド'], v: [0.05, 0.1, 0.15], sp: { name: '冷気の反撃', desc: '纏っている間に被弾すると、近くの敵に凍傷 +5' } },
        } },
        q: { name: 'ダイヤモンドダスト', need: 'q', paths: {
          pow:  { name: '威力', desc: ['ダイヤモンドダストの威力 +30%', 'ダイヤモンドダストの威力 +60%', 'ダイヤモンドダストの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '煌めき', desc: '範囲内の凍結中の敵に、0.5秒ごとに基礎威力 100 の追加ダメージ' } },
          cd:   { name: '迅速', desc: ['ダイヤモンドダストのCD -10%', 'ダイヤモンドダストのCD -20%', 'ダイヤモンドダストのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '永い冬', desc: '範囲内での凍結時間 +20%、領域の持続 +1秒' } },
          area: { name: '範囲', desc: ['ダイヤモンドダストの半径 +15%', 'ダイヤモンドダストの半径 +30%', 'ダイヤモンドダストの半径 +50%'], v: [0.15, 0.3, 0.5], sp: { name: 'ホワイトアウト', desc: '範囲内では敵の弾の速さ -50%' } },
        } },
      },
    },
    electro: {
      name: 'エレクトロマンサー', en: 'ELECTROMANCER', weapon: 'thunder', col: '#fff27a', light: '#d8e8ff', rig: 'electro',
      base: { hp: 90, sta: 100, staRegen: 20, spd: 0.05, range: 0.1, crit: 0.1, critDmg: 1.0, wslot: 4, reroll: 2 },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '帯電: 放電ダメージ +10%', fx: { disDmg: 0.1 } },
        6: { d: '雷走: スタミナ -5', fx: { dashCut: 5 } },
        8: { d: '雷纏い: 感電 +5%', fx: { wearShock: 0.05 } },
        11: { d: '鉄塔: 威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '最大HP +10、スタミナ +20', st: { hp: 10, sta: 20 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
      // 帯電: 感電が起きるたびに +1(上限 max)。perChain ごとに感電の連鎖 +1。decayWait 秒 感電がないと decay/s で減る
      //   放電: E / Q を使うと帯電の use を消費し、その発動の命中に感電 disShock(消費 1 につき +disPer)。放電の感電では帯電は増えない
      //   過電流: 帯電が max 以上で クリティカルダメージ +overCrit / 収束: 連鎖数 ×focusN、感電ダメージ ×focusDmg / 再充電: 消費の recharge を rechargeT 秒で戻す
      // 雷纏い: E / Q を使うと wearT 秒。全武器の命中に感電 wearShock / 雷光: 纏っている間 感電ダメージ +flash / 静電気: 敵の弾を static で消す / 雷鳴: クリティカルで帯電 +1
      // 雷走: 移動方向へ dashDist を dashTime 秒で駆け抜ける(無敵 dashIfr 秒、スタミナ dashCost)。通った敵に dashPow と感電 dashShock
      params: {
        max: 100, perChain: 20, decayWait: 3, decay: 10, use: 0.25, disShock: 0.2, disPer: 0.05, overCrit: 0.5, focusN: 0.5, focusDmg: 2, recharge: 0.3, rechargeT: 3,
        wearT: 4, wearShock: 0.1, flash: 0.4, static: 0.2,
        dashDist: 90, dashTime: 0.12, dashIfr: 0.2, dashCost: 80, dashPow: 20, dashShock: 0.5, dashR: 14,
      },
      // 鉄塔(Q): 構え windup 秒 → 画面内のランダムな位置に n 本。落ちた瞬間に半径 landR へ landPow
      //   dur 秒間、every 秒ごとに半径 r の敵 1体へ 基礎威力 pow と感電 shock / 過充電: 消えるときに boomPow(半径 boomR)
      //   避雷針: 鉄塔の近く(r)で起きた感電は連鎖 +1 / 送電線: 近い鉄塔どうしの線に触れた敵へ wireEvery 秒ごとに wirePow
      q: { name: '鉄塔', cd: 30, windup: 0.4, n: 3, landR: 30, landPow: 120, dur: 8, every: 1, r: 70, pow: 80, shock: 0.3, boomPow: 200, boomR: 40, wirePow: 40, wireEvery: 0.5, wireW: 6 },
      tree: {
        trait: { name: '帯電', paths: {
          store:  { name: '蓄電', desc: ['放電で消費する帯電 25% → 30%', '放電で消費する帯電 35%', '放電で消費する帯電 40%'], v: [0.3, 0.35, 0.4], sp: { name: '過電流', desc: '帯電が上限(100)以上の間、クリティカルダメージ +50%' } },
          conduct: { name: '伝導', desc: ['感電の連鎖距離 +20%', '感電の連鎖距離 +40%', '感電の連鎖距離 +60%'], v: [0.2, 0.4, 0.6], sp: { name: '収束', desc: '感電の連鎖数 -50%、感電ダメージ +100%' } },
          cap:    { name: '放電', desc: ['帯電の上限 +10', '帯電の上限 +20', '帯電の上限 +40'], v: [10, 20, 40], sp: { name: '再充電', desc: '放電で消費した帯電の 30% を 3秒かけて戻す' } },
        } },
        passive: { name: '雷纏い', paths: {
          shock:  { name: '付与', desc: ['雷纏いの感電 10% → 12.5%', '雷纏いの感電 15%', '雷纏いの感電 20%'], v: [0.125, 0.15, 0.2], sp: { name: '雷光', desc: '纏っている間、感電ダメージ +40%' } },
          wear:   { name: '持続', desc: ['纏う時間 4秒 → 5秒', '纏う時間 6秒', '纏う時間 7.5秒'], v: [5, 6, 7.5], sp: { name: '静電気', desc: '纏っている間、敵の弾が自分に当たる前に 20% で消える' } },
          charge: { name: '充電', desc: ['纏っている間、帯電の獲得 +30%', '纏っている間、帯電の獲得 +60%', '纏っている間、帯電の獲得 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '雷鳴', desc: 'クリティカルしたとき、帯電 +1' } },
        } },
        q: { name: '鉄塔', need: 'q', paths: {
          pow:  { name: '威力', desc: ['鉄塔の威力 +30%', '鉄塔の威力 +60%', '鉄塔の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '過充電', desc: '鉄塔が消えるときに爆発する(基礎威力 200、半径 40)' } },
          cd:   { name: '迅速', desc: ['鉄塔のCD -10%', '鉄塔のCD -20%', '鉄塔のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '避雷針', desc: '鉄塔の近くで起きた感電は連鎖 +1' } },
          n:    { name: '本数', desc: ['鉄塔 +1本', '鉄塔 +2本', '鉄塔 +3本'], v: [1, 2, 3], sp: { name: '送電線', desc: '近い鉄塔どうしを雷の線がつなぎ、線に触れた敵に 0.5秒ごとに基礎威力 40' } },
        } },
      },
    },
    cleric: {
      name: 'クレリック', en: 'CLERIC', weapon: 'aura', col: '#ffe38a', light: '#fff6d8', rig: 'cleric',
      base: { hp: 125, regen: 0.5, dr: -0.05, sta: 100, staRegen: 20, atk: -0.05, area: 0.1, crit: 0.05, critDmg: 1.0, wslot: 4, reroll: 2 },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '祈り: 祈りの一撃のCD -5%', fx: { strikeCd: 0.05 } },
        6: { d: '聖域の祈り: スタミナ -5', fx: { prayCut: 5 } },
        8: { d: '癒しの光: E / Q の回復 +2%', fx: { lightHeal: 0.02 } },
        11: { d: '審判の祈り: 威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '最大HP +15、HP回復速度 +0.5/s', st: { hp: 15, regen: 0.5 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
      // 祈り: 超過回復が祈りになる(上限は最大HP)。祈りの一撃: メイン武器の通常攻撃・E の命中に 祈り × strike の追加ダメージ(strikeCd 秒に1回。同じ瞬間の命中には全部乗る)
      //   聖杯: 祈りが上限で一撃 ×grail / 天啓: 祈りの獲得 ×revel・被回復 ×revelHeal / 加護: 祈りがあるとき被ダメ減 / 献身: 被ダメの devote を祈りで相殺
      // 癒しの光: E / Q を使うと最大HP の light を回復。今のHP が低いほど回復量 +mercy(満ちる光: HP が高いほど)
      //   恩寵: 癒しの光が ×grace で graceT 秒かけて / 余光: E / Q の後 afterT 秒 HP回復速度アップ / 不屈の祈り: HP lowAt 以下で祈りを全て HP に(lastCd 秒に1回)
      // 聖域の祈り: 無敵 prayIfr 秒、最大HP の prayHeal を回復、スタミナ prayCost
      params: {
        strike: 0.5, strikeCd: 1, grail: 1.5, revel: 3, revelHeal: 0.5, devote: 0.3,
        light: 0.08, mercy: 0.3, grace: 2, graceT: 10, afterT: 3, lowAt: 0.3, lastCd: 60,
        prayIfr: 0.4, prayHeal: 0.03, prayCost: 80,
      },
      // 審判の祈り(Q): 構え windup 秒 → 祈りを全て消費し、照準方向の扇形(半径 r・角度 arc)に pow + 消費した祈り × perPray
      //   消費した祈りの heal を回復(超過回復は祈りにならない)/ 神罰: スタン stun(ボス bossStun)/ 残光: 祈りの獲得 +glow / 天の柱: 全方向
      q: { name: '審判の祈り', cd: 28, windup: 0.5, pow: 150, perPray: 5, r: 110, arc: 1.57, heal: 0.5, stun: 2, bossStun: 0.5, glow: 0.5 },
      tree: {
        trait: { name: '祈り', paths: {
          faith:  { name: '信心', desc: ['祈りの一撃 50% → 65%', '祈りの一撃 80%', '祈りの一撃 100%'], v: [0.65, 0.8, 1.0], sp: { name: '聖杯', desc: '祈りが上限のとき、祈りの一撃のダメージ +50%' } },
          vessel: { name: '祈祷', desc: ['祈りの一撃のCD -15%', '祈りの一撃のCD -30%', '祈りの一撃のCD -45%'], v: [0.15, 0.3, 0.45], sp: { name: '天啓', desc: '祈りの獲得量 ×3、被回復量 ×0.5' } },
          ward:   { name: '加護', desc: ['祈りがあるとき、被ダメージ -4%', '祈りがあるとき、被ダメージ -8%', '祈りがあるとき、被ダメージ -12%'], v: [0.04, 0.08, 0.12], sp: { name: '献身', desc: '被弾したとき、受けるダメージの 30% を祈りで相殺する' } },
        } },
        passive: { name: '癒しの光', paths: {
          light: { name: '光量', desc: ['E / Q の回復 8% → 10%', 'E / Q の回復 12%', 'E / Q の回復 15%'], v: [0.1, 0.12, 0.15], sp: { name: '恩寵', desc: '癒しの光の回復量 ×2。ただし 10秒かけて回復する' } },
          mercy: { name: '慈悲', desc: ['低HP の回復量アップ 30% → 40%', '低HP の回復量アップ 50%', '低HP の回復量アップ 60%'], v: [0.4, 0.5, 0.6], sp: { name: '不屈の祈り', desc: 'HP 30% 以下に下がったとき、祈りを全て使って HP を回復する(祈り 1 につき HP 1。60秒に1回)' } },
          after: { name: '余光', desc: ['E / Q の後 3秒間、HP回復速度 +1/s', 'E / Q の後 3秒間、HP回復速度 +2/s', 'E / Q の後 3秒間、HP回復速度 +3/s'], v: [1, 2, 3], sp: { name: '満ちる光', desc: '回復量アップが、HP が低いほどではなく HP が高いほど大きくなる' } },
        } },
        q: { name: '審判の祈り', need: 'q', paths: {
          pow:  { name: '威力', desc: ['審判の祈りの威力 +30%', '審判の祈りの威力 +60%', '審判の祈りの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '神罰', desc: '当たった敵を 2秒スタンさせる' } },
          cd:   { name: '迅速', desc: ['審判の祈りのCD -10%', '審判の祈りのCD -20%', '審判の祈りのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '残光', desc: '超過回復で得る祈り +50%' } },
          area: { name: '範囲', desc: ['審判の祈りの半径 +15%', '審判の祈りの半径 +30%', '審判の祈りの半径 +50%'], v: [0.15, 0.3, 0.5], sp: { name: '天の柱', desc: '扇形ではなく、自分を中心に全方向' } },
        } },
      },
    },
    assassin: {
      name: 'ブラッドアサシン', en: 'BLOOD ASSASSIN', weapon: 'blade', col: '#c0204a', light: '#ffd8de', rig: 'assassin',
      base: { hp: 120, def: -2, dr: -0.2, sta: 100, staRegen: 25, spd: 0.15, atk: 0.05, area: -0.1, crit: 0.1, critDmg: 1.0, wslot: 4, reroll: 2 },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '血刃: 出血ダメージ +10%', fx: { bleedDmg: 0.1 } },
        6: { d: '血の渇き: 回復量 +10%', fx: { leech: 0.1 } },
        8: { d: '移動速度 +5%', st: { spd: 0.05 } },
        11: { d: '血の契約: 斬り裂きの威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '最大HP +15、スタミナ +20', st: { hp: 15, sta: 20 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
      // 血刃: 斬撃タイプの武器の命中で出血 +1。出血の最大スタック = 斬撃タイプの所持数(メイン武器も含む) × (perCut + 裂創)
      //   鮮血: 出血に攻撃力・クリティカル / 血の連鎖: 出血中の敵を倒すと、スタックの半分を近く(chainR)の chainN 体へ / 致命傷: 出血1スタックにつきクリティカル率 +critPer
      // 血の渇き: メイン武器の命中ごとに leech の HP を回復 / 出血中の敵を倒すと、最大HP × その敵の出血 × killPer を回復
      //   どちらも合わせて 1秒に 最大HP × leechCap まで
      //   血の盾: 最大HP を超えた回復 × shieldK を shieldT 秒のシールド / 生き血: HP lowAt 以下で回復量 ×2 / 饗宴: 血の契約の効果中、回復の上限 × pactCap
      // 瞬影: 移動方向へ dashDist を dashTime 秒で駆け抜ける(無敵 dashIfr 秒、スタミナ dashCost)。通り抜けた敵(dashR)に dashPow と出血 +dashBleed
      params: {
        perCut: 5, critPer: 0.01, chainN: 2, chainR: 60,
        leech: 0.1, leechCap: 0.02, killPer: 0.0002, shieldK: 0.5, shieldT: 3, lowAt: 0.5, pactCap: 1.5,
        dashDist: 50, dashTime: 0.1, dashIfr: 0.2, dashCost: 60, dashPow: 20, dashR: 12, dashBleed: 1,
      },
      // 血の契約(Q): 構え windup 秒 → 今の HP の pay を支払い(HP は 1 未満にならない)、照準方向へ×字に交差する二筋の斬撃(pow + 支払ったHP × perHp、出血 +bleed)
      //   交差の中心は自分から crossD 前、1本の長さ crossL × 2、線から crossW 以内に当たる(範囲%を掛ける)
      //   dur 秒間、移動速度 +spd・敵の出血 1スタックにつき与えるダメージ +perStack(代償の効果倍率を掛ける)
      //   血の嵐: stormEvery 秒ごとに半径 stormR へ stormPow と出血 +1 / 代償: 支払い pricePay / 捨て身: HP を 1 にして、支払った HP の allIn を allInT 秒のシールドに
      //   血の契り: 効果中に出血中の敵を倒すと +extend 秒(extendMax まで)
      q: { name: '血の契約', cd: 30, windup: 0.3, pay: 0.3, dur: 10, spd: 0.3, perStack: 0.01, crossD: 36, crossL: 58, crossW: 16, pow: 80, perHp: 10, bleed: 5,
        stormEvery: 0.5, stormR: 45, stormPow: 20, pricePay: [0.4, 0.5, 0.6], allIn: 0.5, allInT: 8, extend: 0.5, extendMax: 5 },
      tree: {
        trait: { name: '血刃', paths: {
          deep: { name: '深傷', desc: ['出血ダメージ +30%', '出血ダメージ +60%', '出血ダメージ +100%'], v: [0.3, 0.6, 1.0], sp: { name: '鮮血', desc: '出血ダメージに攻撃力・クリティカルが乗る' } },
          rend: { name: '裂創', desc: ['斬撃タイプの武器1本ごとに、出血の最大スタック +1', '斬撃タイプの武器1本ごとに、出血の最大スタック +3', '斬撃タイプの武器1本ごとに、出血の最大スタック +5'], v: [1, 3, 5], sp: { name: '血の連鎖', desc: '出血中の敵を倒すと、そのスタックの半分を近くの敵 2体へ移す' } },
          last: { name: '延命', desc: ['出血の持続 +1秒', '出血の持続 +2秒', '出血の持続 +3秒'], v: [1, 2, 3], sp: { name: '致命傷', desc: '出血 1スタックにつき、その敵へのクリティカル率 +1%' } },
        } },
        passive: { name: '血の渇き', paths: {
          thirst: { name: '渇き', desc: ['血の渇きの回復量 +10%', '血の渇きの回復量 +20%', '血の渇きの回復量 +30%'], v: [0.1, 0.2, 0.3], sp: { name: '血の盾', desc: '最大HP を超えた回復の 50% が、3秒間のシールドになる' } },
          greed:  { name: '貪り', desc: ['倒した敵の出血 1スタックにつき 0.02% → 0.03%', '倒した敵の出血 1スタックにつき 0.04%', '倒した敵の出血 1スタックにつき 0.05%'], v: [0.0003, 0.0004, 0.0005], sp: { name: '生き血', desc: 'HP 50% 以下の間、血の渇きの回復量 ×2' } },
          feast:  { name: '血宴', desc: ['回復の上限 最大HP の 2%/秒 → 3%/秒', '回復の上限 最大HP の 4%/秒', '回復の上限 最大HP の 5%/秒'], v: [0.03, 0.04, 0.05], sp: { name: '饗宴', desc: '血の契約の効果中、回復の上限 ×1.5' } },
        } },
        q: { name: '血の契約', need: 'q', paths: {
          pow:   { name: '威力', desc: ['斬り裂きの威力 +30%', '斬り裂きの威力 +60%', '斬り裂きの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '血の嵐', desc: '効果中、0.5秒ごとに周り(半径 45)を斬る(基礎威力 20、出血 +1)' } },
          price: { name: '代償', desc: ['支払う HP 40%、効果 ×1.15', '支払う HP 50%、効果 ×1.3', '支払う HP 60%、効果 ×1.5'], v: [1.15, 1.3, 1.5], sp: { name: '捨て身', desc: '発動時に HP を 1 にする。支払った HP の半分を 8秒間のシールドにする' } },
          dur:   { name: '持続', desc: ['血の契約の持続 +2秒', '血の契約の持続 +4秒', '血の契約の持続 +6秒'], v: [2, 4, 6], sp: { name: '血の契り', desc: '効果中に出血中の敵を倒すと、持続 +0.5秒(1回で +5秒まで)' } },
        } },
      },
    },
    necro: {
      name: 'ネクロマンサー', en: 'NECROMANCER', weapon: 'wisp', col: '#a58cff', light: '#e6dcff', rig: 'necro',
      base: { hp: 85, sta: 100, staRegen: 20, spd: 0.05, cd: 0.05, crit: 0.05, critDmg: 1.0, magnet: 0.2, wslot: 4, reroll: 2 },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '死霊使役: 死霊の威力 +10%', fx: { soulPow: 0.1 } },
        6: { d: '霊体化: スタミナ 90 → 80', fx: { phaseCut: 10 } },
        8: { d: '死霊使役: 死霊の上限 +3', fx: { soulMax: 3 } },
        11: { d: '葬送: 威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '最大HP +15、スタミナ +20', st: { hp: 15, sta: 20 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
      // 死霊使役: 敵を倒すと死霊 +1(エリート +eliteN、ボスは上限まで)。上限 max(群れ・クラスLv8 で増える)
      //   上限のときに得た死霊は霊力になる(1秒に reiDecay ずつ減る。疾走で減り方が遅くなる)。霊力 1 につき、死霊の攻撃(噛みつき・百鬼夜行・報い)と葬送(霊弾・念)の威力 +reiK
      //   死霊は周りを漂い、every 秒ごとに半径 range の敵へ飛びかかって戻る(基礎威力 pow。なるべく別の敵を狙う)
      //   百鬼夜行: 上限を超えた分はその場で爆ぜる(基礎威力 overPow、半径 overR)/ 呪い牙: 噛まれた敵は curseT 秒 受けるダメージ +curse / 渡り: 半径 hopR の別の敵へもう一度
      // 死者の盾: 被弾で死霊を guardN 体使い(少ないときはいるだけ)、ダメージ -guard(守りで上がる)/ 骸の盾: 死霊が guardN × 2 体以上なら、その数を使って ×(1 - 軽減)^2
      //   報い: 身代わりの死霊が爆ぜる(1回の身代わりにつき1回。骸の盾は2回分。半径 burstR)/ 呪詛返し: 減らしたダメージ × backK を足す / 還魂: 使った死霊 1体につき HP 回復
      //   不死の契り: 致命傷を、死霊 undyingMin 体以上のとき全て使って耐える(1体につき最大HP × undyingHp。undyingCd 秒に1回)
      // 霊体化: phaseT 秒 無敵・移動速度 +phaseSpd(スタミナ phaseCost)→ 解けた瞬間に死霊が一斉に飛びかかる
      params: {
        max: 6, eliteN: 3, every: 1, range: 100, pow: 10, reiK: 0.001, reiDecay: 1, overPow: 20, overR: 30, curse: 0.15, curseT: 4, hopR: 40,
        guard: 0.2, guardN: 6, burstR: 30, backK: 5, undyingMin: 5, undyingHp: 0.05, undyingCd: 60,
        phaseT: 0.5, phaseSpd: 0.6, phaseCost: 90,
      },
      // 葬送(Q): 構え windup 秒(動けない)→ 死霊を全て解き放つ。1体につき霊弾 1発(最低 minShots 発)
      //   照準方向へ扇状に飛び出し(速さ speed)、近くの敵を追って触れると爆ぜる(基礎威力 pow、半径 r。life 秒で消えるときも爆ぜる)
      //   慟哭: 着弾地点に念が lingerT 秒残る(lingerEvery 秒ごとに 基礎威力 lingerPow)/ 輪廻: CD - 使った死霊 × rebirth 秒 / 集束: 1発にまとめる(威力 合計 × fuseK、半径 × fuseR)
      q: { name: '葬送', cd: 30, windup: 0.4, pow: 50, r: 30, minShots: 3, speed: 150, life: 2.5, lingerT: 3, lingerEvery: 0.5, lingerPow: 20, rebirth: 1, fuseK: 1.25, fuseR: 2 },
      tree: {
        trait: { name: '死霊使役', paths: {
          herd:  { name: '群れ', desc: ['死霊の上限 +2', '死霊の上限 +4', '死霊の上限 +6'], v: [2, 4, 6], sp: { name: '百鬼夜行', desc: '上限を超えて得た死霊は、その場で爆ぜる(基礎威力 20、半径 30)' } },
          fang:  { name: '牙', desc: ['死霊の威力 +30%', '死霊の威力 +60%', '死霊の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '呪い牙', desc: '死霊に噛まれた敵は 4秒間 呪われる(受けるダメージ +15%。どの攻撃でも)' } },
          haste: { name: '疾走', desc: ['霊力の減少速度 -15%', '霊力の減少速度 -30%', '霊力の減少速度 -50%'], v: [0.15, 0.3, 0.5], sp: { name: '渡り', desc: '噛みついた後、近く(半径 40)の別の敵へもう一度飛びかかってから戻る' } },
        } },
        passive: { name: '死者の盾', paths: {
          ward: { name: '守り', desc: ['身代わりの軽減 20% → 25%', '身代わりの軽減 30%', '身代わりの軽減 35%'], v: [0.25, 0.3, 0.35], sp: { name: '骸の盾', desc: '死霊が 12体以上いるときは、2回分としてダメージを減らす(12体使う)' } },
          ret:  { name: '報い', desc: ['身代わりになった死霊が爆ぜる(基礎威力 20、半径 30)', '身代わりの死霊の爆発 基礎威力 40', '身代わりの死霊の爆発 基礎威力 60'], v: [20, 40, 60], sp: { name: '呪詛返し', desc: '爆発の威力に、身代わりで減らしたダメージの 500% を足す' } },
          soul: { name: '還魂', desc: ['死霊を使うたびに HP +0.5(身代わり・葬送とも)', '死霊を使うたびに HP +1', '死霊を使うたびに HP +1.5'], v: [0.5, 1, 1.5], sp: { name: '不死の契り', desc: 'HP が 0 になる攻撃を受けたとき、死霊を全て使って耐える(HP = 使った死霊 1体につき最大HP の 5%。死霊が 5体以上のとき。60秒に1回)' } },
        } },
        q: { name: '葬送', need: 'q', paths: {
          pow:  { name: '威力', desc: ['葬送の威力 +30%', '葬送の威力 +60%', '葬送の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '慟哭', desc: '着弾地点に念が 3秒残り、0.5秒ごとに 基礎威力 20 を与える' } },
          cd:   { name: '迅速', desc: ['葬送のCD -10%', '葬送のCD -20%', '葬送のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '輪廻', desc: '葬送の CD が、使った死霊 1体につき 1秒短くなる' } },
          area: { name: '範囲', desc: ['霊弾の爆発の半径 +15%', '霊弾の爆発の半径 +30%', '霊弾の爆発の半径 +50%'], v: [0.15, 0.3, 0.5], sp: { name: '集束', desc: '霊弾を 1発にまとめて放つ(威力 = 全弾の合計 × 125%、半径 ×2)' } },
        } },
      },
    },
    astro: {
      name: 'アストロマンサー', en: 'ASTROMANCER', weapon: 'bhole', col: '#ff7ad9', light: '#ffe0f6', rig: 'astro',
      base: { hp: 95, sta: 100, staRegen: 15, spd: 0.1, atk: -0.1, area: 0.1, crit: 0.05, critDmg: 1.0, magnet: 0.3, wslot: 4, reroll: 2 },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '質量: 上限 +50', fx: { massMax: 50 } },
        6: { d: '質量放出: スタミナ 50 → 45', fx: { ejectCut: 5 } },
        8: { d: '重力圏: 半径 +10', fx: { fieldR: 10 } },
        11: { d: '重力崩壊: 威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '最大HP +15、スタミナ +20', st: { hp: 15, sta: 20 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
      // 質量: アイテム(経験値の宝石・コイン・肉・磁石・爆弾・宝箱)を拾うと 1つにつき +pickN(吸積で ×)。上限 max(器・クラスLv3 で増える)。時間では減らない
      //   質量 1 につき攻撃力 +atkPer(密度で上がる)・移動速度 -spdPer(spdCap まで)/ 事象の地平: 上限のとき移動速度が下がらない
      //   中性子星: 質量 critAt 以上でクリティカル率 +crit / 重力捕獲: 敵を倒すと +catchKill、メイン武器の通常攻撃が 1回当たるごとに +catchN
      // 重力圏: 自分の周り(半径 fieldR。範囲・クラスLv8 で広がる。範囲%も掛ける)の敵の移動・攻撃速度と敵の弾を遅くする
      //   遅くなる割合 = 質量 × slowPer(強度で上がる。slowCap まで)。敵の移動は凍傷と掛け算で重ねる
      //   時間停止: 入った敵の弾は止まり、stopT 秒で消える(止まっている間は当たらない)/ 潮汐力: tideEvery 秒ごとに中の敵へ 基礎威力 tidePow + 質量 × tidePer
      //   慣性: 質量 1 につき被ダメージ -(パスの値)(guardCap まで。防御力・軽減より先)/ 不動: 質量 ifrAt 以上で被弾後の無敵時間 ×ifrK
      // 質量放出(Space): 質量の ejectPart を使い、移動方向へ ejectDist + 使った質量 × ejectPer を ejectTime 秒で跳ぶ(無敵 ejectIfr 秒、スタミナ ejectCost)
      //   元の位置で爆ぜる(半径 ejectR、基礎威力 ejectPow + 使った質量 × ejectPowPer)
      params: {
        max: 100, pickN: 1, catchKill: 0.5, atkPer: 0.002, spdPer: 0.0015, spdCap: 0.3, critAt: 50, crit: 0.15, catchN: 0.1,
        fieldR: 50, slowPer: 0.001, slowCap: 0.5, stopT: 1, tideEvery: 0.5, tidePow: 10, tidePer: 0.25, guardCap: 0.3, ifrAt: 80, ifrK: 1.5,
        ejectPart: 0.2, ejectDist: 40, ejectPer: 0.5, ejectTime: 0.15, ejectIfr: 0.25, ejectCost: 50, ejectR: 50, ejectPow: 15, ejectPowPer: 2,
      },
      // 重力崩壊(Q): 構え windup 秒(動けない)→ 質量を全て使い、照準位置(range まで)に特異点を生む
      //   dur 秒間、半径 pullR + 使った質量 × pullPer の敵を中心へ引き寄せる(中心に近いほど速い: pullMin → pullMax。ボス以外)
      //   最後に崩壊して、半径 r の敵へ 基礎威力 pow + 使った質量 × perMass(武器に依存しない)
      //   超新星: novaT 秒後に外へもう一度(威力 ×novaK、半径 ×novaR)/ ホーキング放射: 使った質量の hawking が崩壊の後に戻る
      //   ホワイトホール: 崩壊の後、半径 r の生き残った敵を外へ大きく吹き飛ばし(whiteKb)、whiteStun 秒スタン
      q: { name: '重力崩壊', cd: 35, windup: 0.4, range: 160, dur: 2, pullR: 150, pullPer: 0.5, pullMin: 60, pullMax: 240, r: 70, pow: 200, perMass: 5,
        novaT: 0.3, novaK: 0.5, novaR: 2, hawking: 0.3, whiteKb: 450, whiteStun: 2 },
      tree: {
        trait: { name: '質量', paths: {
          vessel:  { name: '器', desc: ['質量の上限 +30', '質量の上限 +60', '質量の上限 +100'], v: [30, 60, 100], sp: { name: '事象の地平', desc: '質量が上限のとき、移動速度が下がらなくなる' } },
          dense:   { name: '密度', desc: ['質量 1 につき攻撃力 +0.2% → +0.23%', '質量 1 につき攻撃力 +0.26%', '質量 1 につき攻撃力 +0.3%'], v: [0.0023, 0.0026, 0.003], sp: { name: '中性子星', desc: '質量 50 以上のとき、クリティカル率 +15%' } },
          accrete: { name: '吸積', desc: ['拾ったときの質量 ×1.3', '拾ったときの質量 ×1.6', '拾ったときの質量 ×2'], v: [1.3, 1.6, 2], sp: { name: '重力捕獲', desc: '敵を倒すと質量 +0.5。メイン武器の通常攻撃が当たるたびにも +0.1' } },
        } },
        passive: { name: '重力圏', paths: {
          area:  { name: '範囲', desc: ['重力圏の半径 50 → 60', '重力圏の半径 70', '重力圏の半径 80'], v: [10, 20, 30], sp: { name: '時間停止', desc: '重力圏に入った敵の弾はその場で止まり、1秒後に消える(止まっている間は当たらない)' } },
          power: { name: '強度', desc: ['質量 1 につき遅くなる割合 0.1% → 0.15%', '質量 1 につき遅くなる割合 0.2%', '質量 1 につき遅くなる割合 0.3%'], v: [0.0015, 0.002, 0.003], sp: { name: '潮汐力', desc: '重力圏の中の敵に、0.5秒ごとに 基礎威力 10 + 質量 × 0.25' } },
          inert: { name: '慣性', desc: ['質量 1 につき被ダメージ -0.03%(最大 -30%)', '質量 1 につき被ダメージ -0.06%(最大 -30%)', '質量 1 につき被ダメージ -0.1%(最大 -30%)'], v: [0.0003, 0.0006, 0.001], sp: { name: '不動', desc: '質量 80 以上のとき、被弾後の無敵時間 +50%' } },
        } },
        q: { name: '重力崩壊', need: 'q', paths: {
          pow:  { name: '威力', desc: ['重力崩壊の威力 +30%', '重力崩壊の威力 +60%', '重力崩壊の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '超新星', desc: '崩壊の 0.3秒後に、外へ向かってもう一度爆ぜる(威力 50%、半径 ×2)' } },
          cd:   { name: '迅速', desc: ['重力崩壊のCD -10%', '重力崩壊のCD -20%', '重力崩壊のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: 'ホーキング放射', desc: '使った質量の 30% が、崩壊の後に戻る' } },
          area: { name: '範囲', desc: ['引き寄せ・崩壊の半径 +15%', '引き寄せ・崩壊の半径 +30%', '引き寄せ・崩壊の半径 +50%'], v: [0.15, 0.3, 0.5], sp: { name: 'ホワイトホール', desc: '崩壊の後、生き残った敵を外へ大きく吹き飛ばし、2秒スタン' } },
        } },
      },
    },
    berserker: {
      name: 'バーサーカー', en: 'BERSERKER', weapon: 'axe', col: '#4a78ff', light: '#d0dcff', rig: 'berserker',
      base: { hp: 125, regen: 1, def: 1, dr: -0.05, sta: 100, staRegen: 20, spd: 0.05, atk: 0.1, area: -0.05, range: -0.1, crit: 0, critDmg: 0.8, magnet: -0.1, wslot: 4, reroll: 2 },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '怒り: 怒り減少までの時間 +2秒', fx: { calmT: 2 } },
        6: { d: '不屈: スタミナ 75 → 70', fx: { firmCut: 5 } },
        8: { d: '昂り: 時間 +1秒', fx: { fervorT: 1 } },
        11: { d: '狂乱: 薙ぎ払いの威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '最大HP +15、スタミナ +20', st: { hp: 15, sta: 20 } },
        15: { d: 'メイン武器の切り替えを解放', fx: { swap: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        18: { d: 'クールダウン -5%', st: { cd: 0.05 } },
      },
      // 怒り: 被弾で +rageHit(痛覚で増える)。上限 rageMax(激情で増える)。怒り 1 につき与えるダメージ +dmgPer(攻撃力とは別の倍率で掛ける)
      //   calmT 秒(クラスLv3 で延びる)被弾しないと 1秒に decay ずつ減る(執念で減り方が遅くなる)
      //   憤怒の鎧: 上限のとき被ダメージ -armorCut / 焼灼: HP回復速度 + 怒り × burnK / 返り血: 敵を倒すたびに +bloodN
      // 昂り: 不屈の間に被弾すると 1段(fervorT 秒。段ごとに別々に数える。最大 fervorMax 段。上限のときは残りの短い段を新しくする)
      //   1段につき HP回復速度 +fervorRegen・攻撃力 +fervorAtk(熱狂で効果アップ)。極限: 通常の被弾でも(パスの値の段数)
      //   血湧き肉躍る: 1段につきクールダウン -fervorCd / 死に物狂い: HP desperateAt 以下で常に最大
      //   仁王立ち: E・Q を使うと 最大HP × selfHit のダメージを受ける(被弾として怒り・昂りが溜まる)。E・Q の威力 +selfPow
      // 不屈(Space): firmT 秒 被ダメージ -firmDr・減速(粘液・スロウタイム)を受けない。動ける(スタミナ firmCost。予備動作なし)
      //   受けたダメージ(減らす前)× firmRage の怒りを得る(被弾の怒りとは別)
      params: {
        rageMax: 100, rageHit: 10, dmgPer: 0.002, calmT: 3, decay: 10, armorCut: 0.25, burnK: 0.02, bloodN: 1,
        fervorT: 5, fervorMax: 3, fervorRegen: 0.5, fervorAtk: 0.1, fervorCd: 0.08, selfHit: 0.05, selfPow: 0.15, desperateAt: 0.4,
        firmT: 1, firmDr: 0.75, firmRage: 0.2, firmCost: 75,
      },
      // 狂乱(Q): 構え windup 秒(動けない)→ 怒りを全て使い、雄叫びとともに周り(半径 r)を薙ぎ払う(基礎威力 pow + 使った怒り × perRage。武器に依存しない)
      //   そのあと dur + 使った怒り × durPer 秒(durMax まで。持続のパスはその上に足す)の狂乱:
      //   怒りは上限のまま、与えるダメージ +dmg・攻撃速度 +atkSpd・HP回復速度 +regen。スタミナは 0 になって回復しない。終わると怒りは 0
      //   旋風: whirlEvery 秒ごとに半径 whirlR へ 基礎威力 whirlPow + 使った怒り × whirlPer / 不死の狂乱: 倒れるダメージを受けても HP 1 で耐える(1回の狂乱で1回。耐えた後 undyingT 秒 無敵)
      //   狂い咲き: 狂乱中の撃破で +bloomT 秒(1回で bloomMax まで)
      q: { name: '狂乱', cd: 40, windup: 0.3, r: 55, pow: 100, perRage: 5, dur: 6, durPer: 0.04, durMax: 10, dmg: 0.15, atkSpd: 0.15, regen: 1,
        whirlEvery: 1, whirlR: 40, whirlPow: 50, whirlPer: 0.5, undyingT: 1, bloomT: 0.1, bloomMax: 4 },
      tree: {
        trait: { name: '怒り', paths: {
          fury:   { name: '激情', desc: ['怒りの上限 +30', '怒りの上限 +60', '怒りの上限 +100'], v: [30, 60, 100], sp: { name: '憤怒の鎧', desc: '怒りが上限のとき、被ダメージ -25%' } },
          grudge: { name: '執念', desc: ['怒りの減少速度 -20%', '怒りの減少速度 -40%', '怒りの減少速度 -60%'], v: [0.2, 0.4, 0.6], sp: { name: '焼灼', desc: '怒り × 0.02 だけ HP回復速度が増える' } },
          pain:   { name: '痛覚', desc: ['被弾で得る怒り +10 → +13', '被弾で得る怒り +16', '被弾で得る怒り +20'], v: [13, 16, 20], sp: { name: '返り血', desc: '敵を倒すたびに 怒り +1' } },
        } },
        passive: { name: '昂り', paths: {
          zeal:  { name: '熱狂', desc: ['昂りの効果 +30%', '昂りの効果 +60%', '昂りの効果 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '血湧き肉躍る', desc: '昂り 1段につき クールダウン -8%' } },
          field: { name: '戦場', desc: ['昂りの時間 +1秒', '昂りの時間 +2秒', '昂りの時間 +3秒'], v: [1, 2, 3], sp: { name: '仁王立ち', desc: 'E・Q を使うと、最大HP の 5% のダメージを受ける(被弾として怒り・昂りが溜まる)。E・Q の威力 +15%' } },
          edge:  { name: '極限', desc: ['通常の被弾でも 昂り +1段', '通常の被弾でも 昂り +2段', '通常の被弾でも 昂り +3段'], v: [1, 2, 3], sp: { name: '死に物狂い', desc: 'HP 40% 以下のとき、昂りが常に最大になる' } },
        } },
        q: { name: '狂乱', need: 'q', paths: {
          pow: { name: '威力', desc: ['薙ぎ払いの威力 +30%', '薙ぎ払いの威力 +60%', '薙ぎ払いの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '旋風', desc: '狂乱中、1秒ごとに周り(半径 40)を斬る(基礎威力 50 + 使った怒り / 2)' } },
          cd:  { name: '迅速', desc: ['狂乱のCD -10%', '狂乱のCD -20%', '狂乱のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '不死の狂乱', desc: '狂乱中に倒れるダメージを受けても、HP 1 で耐える(1回の狂乱で1回)' } },
          dur: { name: '持続', desc: ['狂乱の持続 +2秒', '狂乱の持続 +4秒', '狂乱の持続 +6秒'], v: [2, 4, 6], sp: { name: '狂い咲き', desc: '狂乱中に敵を倒すと、持続 +0.1秒(1回で +4秒まで)' } },
        } },
      },
    },
    // 専用武器なし(weapon: null)。メイン武器はクラス画面で Lv1 から好きな武器を選ぶ(はじめは startW)。熟練はその武器を専用にしているクラスの Lv で決まる
    weaponmaster: {
      name: 'ウェポンマスター', en: 'WEAPON MASTER', weapon: null, startW: 'katana', col: '#d08a48', light: '#ffe8cc', rig: 'weaponmaster',
      base: { hp: 100, sta: 100, staRegen: 20, spd: 0.05, area: 0.05, range: 0.05, cd: 0.05, crit: 0.05, critDmg: 1.0, xp: -0.1, wslot: 4, reroll: 2 },
      lv: { // 専用武器がないので全て専用
        2: { d: '最大HP +5', st: { hp: 5 } },
        3: { d: '武芸百般: 常時 +1 スタック', fx: { stack: 1 } },
        4: { d: '攻撃力 +5%', st: { atk: 0.05 } },
        5: { d: '影の追撃: 間隔 -0.5秒', fx: { shadeCut: 0.5 } },
        6: { d: '残像: スタミナ 90 → 80', fx: { dashCut: 10 } },
        7: { d: '範囲 +5%', st: { area: 0.05 } },
        8: { d: '武神降臨: 威力 +10%', fx: { qPow: 0.1 } },
        9: { d: 'クールダウン -3%', st: { cd: 0.03 } },
        10: { d: '武神降臨: 武器スキルの発動数 +1', fx: { qN: 1 } },
        11: { d: '武神降臨: 威力 +20%', fx: { qPow: 0.2 } },
        12: { d: '攻撃力 +5%', st: { atk: 0.05 } },
        13: { d: '最大HP +5、スタミナ +5', st: { hp: 5, sta: 5 } },
        14: { d: '射程 +5%', st: { range: 0.05 } },
        15: { d: '新しく手に入れた武器が Lv2 から始まる', fx: { startLv: 1 } },
        16: { d: '攻撃力 +10%', st: { atk: 0.1 } },
        17: { d: '影の追撃: 威力 +20%', fx: { shadePow: 0.2 } },
        18: { d: 'クールダウン -3%', st: { cd: 0.03 } },
        19: { d: '最大HP +10、スタミナ +15', st: { hp: 10, sta: 15 } },
        20: { d: '武器枠 +1', st: { wslot: 1 } },
      },
      // 武芸百般: 持っている武器 1つにつき 1スタック(進化した武器は 1 + evoK。極意で 1 + 1)。クラスLv3 で常に +1
      //   1スタックにつき 攻撃力 +stackAtk(鍛錬で増える)/ 器用: クールダウン -(パスの値)/ 頑健: 最大HP +(パスの値)/ 不動: 武器枠が全て埋まっていると被ダメージ -steadyDr
      //   早業: E を使うと全ての武器の攻撃間隔が 0 に戻る
      // 影の追撃: shadeT 秒ごと(頻度・クラスLv5 で短く)に、持っている武器(メイン武器も)のどれか 1つを影がまねて、その武器がすぐにもう一度攻撃する
      //   影は自分の横(shadeD 離れた位置)に現れ、攻撃はそこから出る。威力のパス・クラスLv17 でまねた攻撃の威力が上がる
      //   双影: 影がもう 1体(別の武器。武器が 1つだけなら同じ武器。まねた攻撃の威力 -twinCut)/ 残響: まねた武器は echoT 秒 攻撃速度 +echoSpd
      //   影刃: 影が現れたとき周り(半径 edgeR。範囲%も掛ける)へ 基礎威力(パスの値)/ 影縫い: 影刃に当たった敵を stunT 秒スタン
      // 残像(Space): 移動方向へ dashDist を dashTime 秒で跳ぶ(無敵 dashIfr 秒、スタミナ dashCost。クラスLv6 で減る)。元の位置に残像。跳んだ直後にメイン武器がもう一度攻撃する
      params: {
        stackAtk: 0.02, evoK: 0.5, steadyDr: 0.2,
        shadeT: 6, shadeD: 14, twinCut: 0.25, echoT: 3, echoSpd: 0.3, edgeR: 30, stunT: 0.5,
        dashDist: 45, dashTime: 0.12, dashIfr: 0.25, dashCost: 90,
      },
      // 武神降臨(Q): 構え windup 秒(動けない)→ 自分の隣に分身。分身は持っている武器の武器スキルを n 個(多芸・クラスLv10 で増える。重複なし。武器の数まで)ランダムに選び、gap 秒おきに 1つずつ使う
      //   威力: その武器の今の値(Lv・進化・熟練)。メイン武器の E の強化(パス・特殊強化)も効く。練度で 威力・範囲・射程(artArea / artRange)が上がる
      //   自分への効果(シールド・回復・千本桜)は自分に入る。ワイルドトマホークの代償は払わない。分身は狙われず、ダメージも受けない
      //   化身: 分身が stayT 秒いて、使った武器の通常攻撃もする / 間髪: 分身の武器スキルで敵を倒すたびに CD -killCd(1回で killMax まで)
      //   秘伝: 分身が使う武器スキルに、その武器の特殊強化を 1つ(ランダム。メイン武器で特殊強化を持っているときは残りの 2つから)付ける
      q: { name: '武神降臨', cd: 60, windup: 0.4, n: 1, gap: 0.3, stayT: 5, killCd: 0.5, killMax: 15, artArea: [0.05, 0.1, 0.2], artRange: [0.05, 0.1, 0.2] },
      tree: {
        trait: { name: '武芸百般', paths: {
          train: { name: '鍛錬', desc: ['1つにつき 攻撃力 +2% → +2.5%', '1つにつき 攻撃力 +3%', '1つにつき 攻撃力 +4%'], v: [0.025, 0.03, 0.04], sp: { name: '極意', desc: '進化した武器は 効果 +50% → +100%' } },
          deft:  { name: '器用', desc: ['1つにつき クールダウン -0.3%', '1つにつき クールダウン -0.6%', '1つにつき クールダウン -1%'], v: [0.003, 0.006, 0.01], sp: { name: '早業', desc: 'E を使うと、全ての武器がすぐに攻撃する(攻撃間隔が 0 に戻る)' } },
          tough: { name: '頑健', desc: ['1つにつき 最大HP +1', '1つにつき 最大HP +2', '1つにつき 最大HP +3'], v: [1, 2, 3], sp: { name: '不動', desc: '武器枠がすべて埋まっているとき、被ダメージ -20%' } },
        } },
        passive: { name: '影の追撃', paths: {
          freq: { name: '頻度', desc: ['影の追撃の間隔 6秒 → 5秒', '影の追撃の間隔 6秒 → 4秒', '影の追撃の間隔 6秒 → 3秒'], v: [1, 2, 3], sp: { name: '双影', desc: '影がもう一体出現する。威力 -25%' } },
          pow:  { name: '威力', desc: ['影がまねた攻撃の威力 +30%', '影がまねた攻撃の威力 +60%', '影がまねた攻撃の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '残響', desc: '影がまねた武器は 3秒間 攻撃速度 +30%' } },
          edge: { name: '影刃', desc: ['影が現れたとき、周り(半径 30)へ 基礎威力 15', '影が現れたとき、周り(半径 30)へ 基礎威力 30', '影が現れたとき、周り(半径 30)へ 基礎威力 50'], v: [15, 30, 50], sp: { name: '影縫い', desc: '影刃に当たった敵を 0.5秒スタンさせる' } },
        } },
        q: { name: '武神降臨', need: 'q', paths: {
          multi: { name: '多芸', desc: ['分身が使う武器スキル +1', '分身が使う武器スキル +2', '分身が使う武器スキル +3'], v: [1, 2, 3], sp: { name: '化身', desc: '分身が 5秒間 残り、使った武器の通常攻撃もする' } },
          cd:    { name: '迅速', desc: ['武神降臨のCD -10%', '武神降臨のCD -20%', '武神降臨のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '間髪', desc: '分身の武器スキルで敵を倒すたびに CD -0.5秒(1回の武神降臨で -15秒まで)' } },
          art:   { name: '練度', desc: ['分身の武器スキルの威力 +15%・範囲 +5%・射程 +5%', '分身の武器スキルの威力 +30%・範囲 +10%・射程 +10%', '分身の武器スキルの威力 +50%・範囲 +20%・射程 +20%'], v: [0.15, 0.3, 0.5], sp: { name: '秘伝', desc: '分身が使う武器スキルに、その武器の特殊強化(3つのうちランダムに 1つ)が付く' } },
        } },
      },
    },
  },
  // クラスLv: need[i] = Lv(i+1) → Lv(i+2) に必要な経験値。獲得量 = 討伐数 × killK + 撃破ボス数 × bossK
  classLevel: {
    need: [100, 150, 200, 300, 400, 500, 650, 800, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 4000, 5000, 7500, 10000],
    killK: 1, bossK: 100,
  },

  // ---------- 永続強化ツリー(db.xlsx「ステータス」L〜O列) ----------
  // stats: 方向ごとに { stat: [最大値, ノード数] }(1ノード = 最大値 / ノード数)。費用 = costBase × 2^深さ
  tree: {
    costBase: 50,
    stats: {
      life:    { hp: [20, 10], regen: [1, 5], def: [1, 4], dr: [0.1, 5], sta: [30, 10], staRegen: [2, 5], food: [0.5, 1] },
      skill:   { spd: [0.1, 5], atk: [0.2, 10], area: [0.1, 5], range: [0.1, 5], cd: [0.1, 4], crit: [0.05, 5], critDmg: [0.2, 5], wslot: [1, 1] },
      balance: { xp: [0.1, 4], gold: [0.2, 8], magnet: [0.2, 8], eqQual: [0.2, 5], chestQual: [0.2, 5], classXp: [0.2, 5], reroll: [3, 3], classPick: [1, 1], gearPick: [1, 1] },
    },
    // 形(設計書 6.2): 方向ごとに 根(深さ1)→ 3本の枝
    // 枝 = 本線(chain)を lanes 本の一本道に並べる(深さ2 から外へ。横のつながりはない)
    //      + 行き止まり(leaf): 本線から横に1つだけ生えるノード。貴重なステータスはここに置く(つながりが1本だけ)
    // tip: 本線の先端の1つ外側の特別なノード / crown: tip のさらに1つ外側のノード(その枝の tip とだけつながる)
    // mid: { stat: [深さ...] } 本線の間(枝の真ん中)に置く特別なノード。同じ深さの本線ノードとつながる
    dirs: {
      life: { name: '生命', col: '#ff5d73', root: 'hp', branches: [
        { name: '活力', lanes: 2, chain: { hp: 9 }, leaf: { regen: 5 } },
        { name: '守護', lanes: 1, chain: { def: 4, dr: 1 }, leaf: { dr: 4 }, tip: 'food' },
        { name: '持久', lanes: 2, chain: { sta: 10 }, leaf: { staRegen: 5 } },
      ] },
      skill: { name: '技巧', col: '#ffd23f', root: 'atk', branches: [
        { name: '剛撃', lanes: 2, chain: { atk: 9 }, leaf: { critDmg: 5 } },
        { name: '精妙', lanes: 1, chain: { crit: 5 }, leaf: { cd: 4 }, tip: 'wslot' },
        { name: '広域', lanes: 2, chain: { area: 5, range: 5 }, leaf: { spd: 5 } },
      ] },
      balance: { name: '天秤', col: '#7ad7ff', root: 'magnet', branches: [
        { name: '成長', lanes: 1, chain: { xp: 4, classXp: 1 }, leaf: { classXp: 4 }, tip: 'gearPick' }, // 本線5段 → 先端は深さ7
        { name: '財宝', lanes: 2, chain: { gold: 8, eqQual: 2 }, leaf: { eqQual: 3 }, mid: { reroll: [2, 4] }, tip: 'reroll' }, // リロール: 序盤・中盤・最奥(深さ7)
        { name: '探索', lanes: 2, chain: { magnet: 7, chestQual: 3 }, leaf: { chestQual: 2 }, tip: 'classPick' }, // 本線を5段にして先端(深さ7)にクラス強化選択枠
      ] },
    },
    // ノードに表示する1文字
    glyph: {
      hp: '体', regen: '癒', def: '守', dr: '減', sta: '持', staRegen: '息', iframe: '無', food: '食',
      spd: '速', atk: '攻', area: '域', range: '射', cd: '刻', crit: '会', critDmg: '撃', wslot: '枠',
      xp: '経', gold: '金', magnet: '引', eqQual: '装', chestQual: '宝', classXp: '級', reroll: '再', classPick: '選', gearPick: '武',
    },
  },

  // ---------- 装備 ----------
  // types: 種類ごとの部位と、付くオプションのロール範囲 [最小, 最大](1Lv あたり。% 系は割合)
  equip: {
    slots: { weapon: '武器', armor: '防具', ring: '指輪' },
    types: {
      sword:    { slot: 'weapon', name: '剣',         opts: { hp: [3, 6], atk: [0.06, 0.10], area: [0.03, 0.06], range: [0.03, 0.06], cd: [0.03, 0.06], crit: [0.02, 0.04], critDmg: [0.03, 0.06] } },
      staff:    { slot: 'weapon', name: '杖',         opts: { spd: [0.02, 0.04], atk: [0.03, 0.06], area: [0.04, 0.08], range: [0.04, 0.08], cd: [0.04, 0.08], crit: [0.03, 0.06], critDmg: [0.05, 0.10] } },
      bow:      { slot: 'weapon', name: '弓',         opts: { sta: [4, 8], atk: [0.04, 0.08], area: [0.02, 0.04], range: [0.02, 0.04], cd: [0.02, 0.04], crit: [0.04, 0.08], critDmg: [0.07, 0.14] } },
      heavy:    { slot: 'armor',  name: '重鎧',       opts: { hp: [6, 12], regen: [0.6, 1.2], def: [1.2, 2.4], dr: [0.05, 0.10], sta: [4, 8], staRegen: [1, 3], spd: [0.02, 0.04], area: [0.01, 0.03], range: [0.01, 0.03] } },
      light:    { slot: 'armor',  name: '軽鎧',       opts: { hp: [5, 10], regen: [0.5, 1], def: [1, 2], dr: [0.04, 0.08], sta: [5, 10], staRegen: [2, 4], spd: [0.03, 0.06], crit: [0.01, 0.02], critDmg: [0.03, 0.06] } },
      robe:     { slot: 'armor',  name: 'ローブ',     opts: { hp: [4, 8], regen: [0.4, 0.8], def: [0.8, 1.6], dr: [0.03, 0.06], sta: [7, 14], staRegen: [3, 6], spd: [0.04, 0.08], atk: [0.02, 0.04], cd: [0.02, 0.04] } },
      ruby:     { slot: 'ring',   name: 'ルビー',     opts: { regen: [0.3, 0.6], staRegen: [1, 2], atk: [0.03, 0.06], range: [0.02, 0.04], xp: [0.05, 0.10], gold: [0.05, 0.10], magnet: [0.05, 0.10] } },
      sapphire: { slot: 'ring',   name: 'サファイア', opts: { def: [0.5, 1], dr: [0.02, 0.04], spd: [0.02, 0.04], crit: [0.02, 0.04], critDmg: [0.03, 0.06], xp: [0.05, 0.10], gold: [0.05, 0.10], magnet: [0.05, 0.10] } },
      emerald:  { slot: 'ring',   name: 'エメラルド', opts: { hp: [3, 6], sta: [4, 8], area: [0.02, 0.04], cd: [0.02, 0.04], xp: [0.05, 0.10], gold: [0.05, 0.10], magnet: [0.05, 0.10] } },
    },
    // n: オプション数 / w: ドロップの重み / enh: 強化の上限回数 / cost: 強化1回目の費用(以降 ×1.5)
    rarity: {
      common:    { name: 'コモン',         n: 1, w: 50, enh: 1, cost: 100,  col: '#c8c8d0' },
      uncommon:  { name: 'アンコモン',     n: 2, w: 30, enh: 2, cost: 200,  col: '#5dff8a' },
      rare:      { name: 'レア',           n: 3, w: 14, enh: 3, cost: 400,  col: '#5ab8ff' },
      epic:      { name: 'エピック',       n: 4, w: 5,  enh: 4, cost: 800,  col: '#c78bff' },
      legendary: { name: 'レジェンダリー', n: 4, w: 1,  enh: 5, cost: 1600, col: '#ffb347' },
    },
    maxLv: [3, 5], // オプションの最大Lv のロール範囲
    invMax: 1000,  // インベントリの上限(超えた分は自動で売却)
    // 宝箱に入る装備の数: 1 / 2 / 3 個の基礎確率(宝箱品質で多い側へ寄る)
    chestN: [0.7, 0.25, 0.05],
    // ラン終了時の報酬: 撃破ボス数 → 宝箱の数(最大 runEndMax)、クリアで +1
    runEndPerBoss: 0.67, runEndMax: 2,
    // 3の倍数以外のレベルアップで、カード1枚ごとに装備カード(オプション1つ +1Lv)になる確率(残りは武器カード)
    cardRate: 0.5,
  },
  // ---------- ショップ(ランが終わるたびに商品を入れ替える) ----------
  // perSlot: 部位ごとの商品数 / w: レアリティの重み(装備品質で上位に寄る)/ price: レアリティごとの価格
  shop: {
    perSlot: 2,
    w: { uncommon: 55, rare: 32, epic: 11, legendary: 2 },
    price: { uncommon: 600, rare: 1500, epic: 4000, legendary: 12000 },
  },

  // ---------- レジェンダリーの固有効果(部位ごとの候補からランダムに1つ。名前の頭に二つ名が付く) ----------
  // stat: ステータスへの加算 / mul: 最終値への倍率 / それ以外の効果は world.js・classes.js で P.uq[キー] を見て処理する
  uniques: {
    exec:      { slot: 'weapon', epi: '処刑人の', desc: 'クリティカルダメージ +30%、非クリティカルダメージ -20%', stat: { critDmg: 0.3 } },
    hundred:   { slot: 'weapon', epi: '百刃の',   desc: '武器枠 +1', stat: { wslot: 1 } },
    berserk:   { slot: 'weapon', epi: '狂戦士の', desc: '失ったHP 1% につき攻撃力 +1%' },
    vamp:      { slot: 'weapon', epi: '吸血鬼の', desc: '敵撃破時 25% で HP を最大HP の 1% 回復' },
    giant:     { slot: 'weapon', epi: '巨人の',   desc: '攻撃力 ×0.9、範囲 ×1.1、射程 ×1.1', mul: { atk: 0.9, area: 1.1, range: 1.1 } },
    senju:     { slot: 'weapon', epi: '千手の',   desc: '全武器の弾数 +1(近接武器は攻撃回数 +1)', stat: { shots: 1 } },
    unbreak:   { slot: 'armor',  epi: '不壊の',   desc: '無敵時間 +20%', stat: { iframe: 0.2 } },
    fortress:  { slot: 'armor',  epi: '城塞の',   desc: '最大HP ×1.3、移動速度 ×0.8', mul: { hp: 1.3, spd: 0.8 } },
    mercy:     { slot: 'armor',  epi: '慈愛の',   desc: '被回復量 +25%' },
    phoenix:   { slot: 'armor',  epi: '不死鳥の', desc: '一度だけ、倒れたときに最大HP の 25% で蘇生する' },
    adversity: { slot: 'armor',  epi: '逆境の',   desc: '受けたダメージ分のスタミナを回復する' },
    aegis:     { slot: 'armor',  epi: '聖盾の',   desc: '最大HP を超えた回復量の 20% をシールドにする(10秒持続)' },
    clock:     { slot: 'ring',   epi: '狂時の',   desc: 'クールダウン -15%。敵の出現数と速度 +15%', stat: { cd: 0.15 } },
    pact:      { slot: 'ring',   epi: '背徳の',   desc: '獲得経験値 +25%。敵の基礎ステータス +10%', stat: { xp: 0.25 } },
    golden:    { slot: 'ring',   epi: '黄金の',   desc: '獲得ゴールド ×1.25', mul: { gold: 1.25 } },
    eye:       { slot: 'ring',   epi: '天眼の',   desc: '100% を超えたクリティカル率を、クリティカルダメージに加算する' },
    craft:     { slot: 'ring',   epi: '神匠の',   desc: '装備品質 ×1.15、宝箱品質 ×1.15', mul: { eqQual: 1.15, chestQual: 1.15 } },
    fate:      { slot: 'ring',   epi: '運命の',   desc: 'リロール回数 +2', stat: { reroll: 2 } },
  },

  // ---------- ステージ ----------
  // amb: 環境光(暗いほど光源が映える) / tint: カラーグレーディング / motes: 環境パーティクル
  stages: [
    { label: 'はじまりの草原', music: 'f_grass', ground: ['#2d4c35', '#335a3b', '#284430', '#3b6843'], deco: ['#4f8a4c', '#6fae5a', '#e4e98a', '#f28cb1'],
      amb: [0.64, 0.68, 0.82], tint: [1.0, 1.02, 1.05], motes: { col: '#d9ff8a', rise: false } },
    { label: '黄昏の荒野', music: 'f_wild',     ground: ['#2f2a45', '#373052', '#29243c', '#40385e'], deco: ['#5a4d80', '#8b7ec8', '#e0c3fc', '#ffd6a5'],
      amb: [0.62, 0.56, 0.78], tint: [1.04, 0.98, 1.08], motes: { col: '#e0c3fc', rise: false } },
    { label: '灼熱の奈落', music: 'f_hell',     ground: ['#3a1e1b', '#452520', '#321815', '#502a22'], deco: ['#6b3024', '#a23e3e', '#ffb347', '#ff6a2a'],
      amb: [0.74, 0.52, 0.48], tint: [1.1, 0.96, 0.9], motes: { col: '#ff9b3d', rise: true }, lava: true },
    // 闘技場モード専用(石畳 + 円形の壁と観客席)
    { label: '血戦の闘技場', music: 'f_wild',   ground: ['#5a4838', '#65513f', '#4d3d30', '#6f5a45'], deco: ['#3a2c22', '#8a7058', '#7a1e24', '#cfc2a8'],
      amb: [0.6, 0.52, 0.5], tint: [1.06, 0.98, 0.94], motes: { col: '#ffcf8a', rise: true }, tiles: true },
    // 七彩の晶窟(tier 1): 暗い紫の洞窟。七色に光る結晶の群れと、色とりどりのきらめき(曲は用意されるまで草原の曲)
    { label: '七彩の晶窟', music: 'f_crystal', ground: ['#1c1530', '#231a3a', '#161026', '#2a2044'], deco: ['#3a2c5a', '#5a4a8a', '#9ff7ff', '#ff8ad8'],
      amb: [0.5, 0.44, 0.74], tint: [1.04, 0.98, 1.1], motes: { col: '#c78bff', cols: ['#ff6a8a', '#ffd23f', '#7dff9a', '#7ad7ff', '#c78bff', '#ff9a3d'], rise: false }, crystal: true },
    // 沈黙の海淵(tier 2): 深い青緑の海の底。珊瑚と海藻、昇る泡、揺らめく光の筋
    { label: '沈黙の海淵', music: 'f_sea', ground: ['#0e2a33', '#12323c', '#0b2229', '#163a45'], deco: ['#1f5a4a', '#2f7a5a', '#ff7a8a', '#ffb06a'],
      amb: [0.38, 0.56, 0.66], tint: [0.92, 1.02, 1.08], motes: { col: '#bff4ff', rise: true, bubble: true }, sea: true },
    // 霜天の霊峰(tier 3): 雪と氷の山。青白い光、降る雪、氷の割れ目
    { label: '霜天の霊峰', music: 'f_peak', ground: ['#56647e', '#5e6e8a', '#4c5a72', '#6a7a96'], deco: ['#8a9ab8', '#c8d8f0', '#2a4a3a', '#9ff7ff'],
      amb: [0.66, 0.74, 0.92], tint: [0.96, 1.0, 1.08], motes: { col: '#ffffff', snow: true }, snow: true, light: 0.5 }, // light: 明るい雪原なので光源を弱める
    // 終刻の時計塔(tier 4): 石畳にはめこまれた真鍮の歯車、セピアの光、舞う砂
    { label: '終刻の時計塔', music: 'f_clock', ground: ['#38322e', '#403833', '#302a27', '#47403a'], deco: ['#1a1614', '#7a6a58', '#6a5228', '#94784a'],
      amb: [0.64, 0.56, 0.48], tint: [1.05, 1.0, 0.9], motes: { col: '#ffd8a0', cols: ['#ffd8a0', '#e8c88a', '#fff0c8', '#c8a060'], rise: false }, clock: true, light: 0.75 },
  ],

  // ---------- カオス強化(db.xlsx「カオス強化」)----------
  // クリア済みのモード・ステージごとに、出撃前に各項目の Lv を選ぶ。合計ポイント = Σ(Lv × pt)
  // 合計ポイントに応じた報酬(rewards: pt 以上で一番上の行)が、そのランの間だけ「カオス強化」としてステータスに入る
  // per: Lv 1 あたりの効果量(desc の {v} に入る)/ unit: 設定画面の「1Lv あたり」の単位(無ければ %)。名前は仮
  // mods: 通常モード・ステージ単体 / arenaMods: 闘技場(敵Lv の上昇・出現率・アイテムの項目は闘技場にないので、代わりにボスの項目)
  chaos: {
    mods: [
      { k: 'lvSpeed', name: '加速する夜',   max: 5, pt: 2,  per: 20, desc: '敵Lv の上昇速度 +{v}%' },
      { k: 'bossLv',  name: '復讐の連鎖',   max: 5, pt: 1,  per: 1,  unit: '', desc: 'ボスを倒すたびに敵Lv +{v}' },
      { k: 'startLv', name: '深い闇',       max: 4, pt: 1,  per: 1,  unit: '', desc: '開始時の敵Lv +{v}' },
      { k: 'spawn',   name: '群れの目覚め', max: 5, pt: 1,  per: 5,  desc: '敵の出現率 +{v}%' },
      { k: 'area',    name: '膨れる殺意',   max: 5, pt: 1,  per: 10, desc: '敵の攻撃範囲 +{v}%' },
      { k: 'rate',    name: '狂騒',         max: 3, pt: 2,  per: 10, desc: '敵の攻撃頻度 +{v}%' },
      { k: 'loot',    name: '枯れた大地',   max: 5, pt: 1,  per: 10, desc: 'アイテムの出現率 -{v}%' },
      { k: 'debuff',  name: '蝕む呪い',     max: 5, pt: 1,  per: 10, desc: 'デバフの効果時間 +{v}%' },
      { k: 'rage',    name: '血の夜明け',   max: 1, pt: 5,  per: 1,  desc: 'ボスは常に激怒する' },
      { k: 'twin',    name: '双王',         max: 1, pt: 10, per: 1,  desc: 'ボスが2体同時に出現する(もう1体は別のボス)' },
    ],
    // 闘技場: 敵Lv はラウンドごとの値(DATA.arena.elv)+ 深い闇 + 復讐の連鎖 × 倒したボスの数 / 巨躯: ボスの HP の倍率 / 親衛隊: ボスと一緒にエリートが入場(そのボスのステージの敵)
    arenaMods: [
      { k: 'bossLv',  name: '復讐の連鎖',   max: 10, pt: 1,  per: 1,  unit: '', desc: 'ボスを倒すたびに敵Lv +{v}' },
      { k: 'bossHp',  name: '巨躯',         max: 5,  pt: 1,  per: 20, desc: 'ボスの基礎体力 +{v}%' },
      { k: 'startLv', name: '深い闇',       max: 9,  pt: 1,  per: 1,  unit: '', desc: '開始時の敵Lv +{v}(この後のラウンドも同じだけ高い)' },
      { k: 'debuff',  name: '蝕む呪い',     max: 5,  pt: 1,  per: 10, desc: 'デバフの効果時間 +{v}%' },
      { k: 'area',    name: '膨れる殺意',   max: 5,  pt: 1,  per: 10, desc: '敵の攻撃範囲 +{v}%' },
      { k: 'rate',    name: '狂騒',         max: 3,  pt: 2,  per: 10, desc: '敵の攻撃頻度 +{v}%' },
      { k: 'escort',  name: '親衛隊',       max: 5,  pt: 1,  per: 1,  unit: '体', desc: 'ボス出現時にエリートが {v}体 出現する' },
      { k: 'rage',    name: '血の夜明け',   max: 1,  pt: 5,  per: 1,  desc: 'ボスは常に激怒する' },
      { k: 'twin',    name: '双王',         max: 1,  pt: 10, per: 1,  desc: 'ボスが2体同時に出現する(もう1体は別のボス)' },
    ],
    // eqMaxVal: 装備ロール上限 / eqMaxLv: 装備Lv上限 / eqQual: 装備品質 / chestQual: 宝箱品質 / gold: 獲得ゴールド
    rewards: [
      { pt: 5,  eqMaxVal: 0.05, eqMaxLv: 0, eqQual: 0.1, chestQual: 0.05, gold: 0.2 },
      { pt: 10, eqMaxVal: 0.10, eqMaxLv: 0, eqQual: 0.2, chestQual: 0.10, gold: 0.4 },
      { pt: 15, eqMaxVal: 0.15, eqMaxLv: 0, eqQual: 0.3, chestQual: 0.15, gold: 0.6 },
      { pt: 20, eqMaxVal: 0.20, eqMaxLv: 1, eqQual: 0.4, chestQual: 0.20, gold: 0.8 },
      { pt: 25, eqMaxVal: 0.25, eqMaxLv: 1, eqQual: 0.5, chestQual: 0.25, gold: 1.0 },
      { pt: 30, eqMaxVal: 0.30, eqMaxLv: 1, eqQual: 0.6, chestQual: 0.30, gold: 1.2 },
      { pt: 35, eqMaxVal: 0.35, eqMaxLv: 1, eqQual: 0.7, chestQual: 0.35, gold: 1.4 },
      { pt: 40, eqMaxVal: 0.40, eqMaxLv: 2, eqQual: 0.8, chestQual: 0.40, gold: 1.6 },
      { pt: 45, eqMaxVal: 0.45, eqMaxLv: 2, eqQual: 0.9, chestQual: 0.45, gold: 1.8 },
      { pt: 50, eqMaxVal: 0.50, eqMaxLv: 2, eqQual: 1.0, chestQual: 0.50, gold: 2.0 },
      { pt: 55, eqMaxVal: 0.50, eqMaxLv: 2, eqQual: 1.2, chestQual: 0.75, gold: 2.5 },
      { pt: 60, eqMaxVal: 0.50, eqMaxLv: 2, eqQual: 1.5, chestQual: 1.00, gold: 3.0 },
    ],
  },

  // ---------- 通常モード(ステージを1つ選ぶ) ----------
  // no = ステージのキーの番号(stage1〜7。クリア記録・カオス強化) / stage = DATA.stages の番号 / tier = 開始の敵Lv・報酬 / bosses = ボス1 → ボス2(倒すとクリア)
  //   segs = 3分ごとの区間の出現の候補(1つ目は 0・60・120秒で1種ずつ足す / 2つ目 / 3つ目。null = その前の全部)
  stageRuns: [
    { no: 1, stage: 1, tier: 1, bosses: ['king', 'gslime'], segs: [['zombie', 'bat', 'slime'], ['bat', 'slime', 'brute'], null] },
    { no: 2, stage: 2, tier: 2, bosses: ['golem', 'wyrm'], segs: [['skeleton', 'archer', 'sandmage'], ['archer', 'sandmage', 'spear'], null] },
    { no: 3, stage: 3, tier: 3, bosses: ['cdragon', 'ifrit'], segs: [['imp', 'hound', 'onibi'], ['hound', 'onibi', 'lslime'], null] },
    { no: 4, stage: 5, tier: 1, bosses: ['stag', 'pqueen'], segs: [['bat', 'jslime', 'beetle'], ['jslime', 'beetle', 'fairy'], null] }, // 七彩の晶窟
    { no: 6, stage: 6, tier: 2, bosses: ['kraken', 'levia'], segs: [['jelly', 'sahagin', 'puffer'], ['sahagin', 'puffer', 'angler'], null] }, // 沈黙の海淵
    { no: 5, stage: 7, tier: 3, bosses: ['fgiant', 'squeen'], segs: [['wolf', 'ghost', 'icesprite'], ['ghost', 'icesprite', 'yeti'], null] }, // 霜天の霊峰
    // 終刻の時計塔: 3つ目の候補は「今までの敵」のまとまり(1枠として選ばれ、その中から1種)
    { no: 7, stage: 8, tier: 4, bosses: ['warden', 'reaper'], segs: [['gear', 'clockman', ['skeleton', 'archer', 'imp', 'icesprite', 'sahagin', 'beetle']], ['clockman', 'hglass', ['skeleton', 'archer', 'imp', 'icesprite', 'sahagin', 'beetle']], null] },
  ],
  // 通常モードの流れ(フェーズの時計で進む。ボス・エリート群のフェーズの間は止まる)
  //   seg: 区間の長さ / waves: 区間ごとの出現の間隔・上限(t は区間の中の秒) / horde: 2つ目・3つ目の区間で大群を出す秒 / elites: エリート群の数
  //   fog: フェーズが始まって start 秒たつと闇の霧(1秒ごとに HP −dmg、step 秒ごとに +dmg。防御力・シールドでは減らない)
  //   tierLv: 開始の敵Lv(tier 1〜4) / tierReward: tier が1つ上がるごとの報酬(カオス強化の報酬に足す)
  flow: {
    seg: 180,
    waves: [
      [{ t: 0, interval: 0.9, max: 60 }, { t: 60, interval: 0.7, max: 100 }, { t: 120, interval: 0.6, max: 130 }],
      [{ t: 0, interval: 0.5, max: 160 }, { t: 90, interval: 0.45, max: 190 }],
      [{ t: 0, interval: 0.42, max: 210 }, { t: 90, interval: 0.38, max: 240 }],
    ],
    horde: 150, elites: 3,
    fog: { start: 180, dmg: 1, step: 10 },
    tierLv: [1, 3, 5, 7],
    tierReward: { eqQual: 0.15, chestQual: 0.10, gold: 0.30 },
  },

  // ---------- 闘技場(ボスラッシュ) ----------
  // order: 登場順 / elv: 各ラウンドの敵Lv(固定) / startLv: 開始時のレベルアップ回数
  // rewardLv: ボス撃破で得るレベルアップ回数(ジェムで配布) / rest: 次のボスまでの休憩秒 / r: 闘技場の半径
  arena: {
    r: 250, rest: 8, startLv: 6, rewardLv: 5,
    order: ['king', 'gslime', 'wyrm', 'golem', 'reaper', 'cdragon'],
    elv:   [5,      10,       15,     20,      25,       30], // 5 から 5ずつ
  },
};
