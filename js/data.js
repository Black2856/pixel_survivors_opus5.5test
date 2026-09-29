// data.js — ゲームバランス定義。距離・速度はすべて内部解像度ピクセル(1アートpx = 1ワールドpx)
'use strict';

const DATA = {
  // staLock: ガード系の防御スキルで受けた後、スタミナ回復が止まる秒数
  player: { hp: 100, speed: 58, magnet: 30, iframe: 0.5, comboTime: 3, staLock: 5 },

  // ---------- 敵 ----------
  // ai: chase / flutter / keep(距離を取り射撃) / flee(逃走)
  enemies: {
    zombie:   { hp: 30, spd: 13, dmg: 9,  xp: 1, r: 5, ai: 'chase' },
    bat:      { hp: 21, spd: 30, dmg: 8,  xp: 1, r: 4, ai: 'flutter' },
    slime:    { hp: 30, spd: 15, dmg: 9,  xp: 1, r: 5, ai: 'hop', split: 'slimelet' },
    slimelet: { hp: 12, spd: 22, dmg: 6,  xp: 1, r: 3, ai: 'hop' },
    skeleton: { hp: 36, spd: 18, dmg: 10, xp: 1, r: 5, ai: 'chase' },
    archer:   { hp: 30, spd: 16, dmg: 9,  xp: 1, r: 5, ai: 'keep', shot: { cd: 3.2, spd: 70, dmg: 9 } },
    ghost:    { hp: 33, spd: 22, dmg: 10, xp: 1, r: 5, ai: 'chase', ghost: true },
    brute:    { hp: 60, spd: 11, dmg: 13, xp: 2, r: 8, ai: 'chase', kbRes: 0.8 },
    imp:      { hp: 27, spd: 34, dmg: 10, xp: 1, r: 4, ai: 'flutter' },
    goblin:   { hp: 160, spd: 44, dmg: 0, xp: 12, r: 5, ai: 'flee', kbRes: 0.5 },
  },

  // ---------- 敵レベル(時間経過で上昇・ボス出現中は停止・周回してもリセットしない) ----------
  // dmg/spd/xp: Lv が 1 上がるごとの増加率(Lv1 = 基本値)
  // HP倍率 = hpLin × (Lv-1) + hpExp^(Lv-1)。雑魚・ボスで共通
  enemyLevel: { interval: 30, hpLin: 0.2, hpExp: 1.03, dmg: 0.03, spd: 0.005, spdMax: 1.5, xp: 0.04, elite: 14 },

  // hp: 基礎HP(1500〜2000。Lv倍率は雑魚と共通) / enrage: 激昂する残りHP割合(省略時 0.5)
  bosses: {
    king:    { name: '腐肉の王 ROT KING',          hp: 1500, spd: 14, dmg: 22, r: 13, music: 'boss1', col: '#8fce5e' },
    gslime:  { name: '巨大スライム GIANT SLIME',   hp: 1500, spd: 16, dmg: 20, r: 14, music: 'boss1', col: '#4fd6a8' },
    wyrm:    { name: '白骨竜 BONE WYRM',           hp: 1700, spd: 19, dmg: 22, r: 14, music: 'boss2', col: '#efe9d4' },
    golem:   { name: 'ゴーレム GOLEM',             hp: 1900, spd: 12, dmg: 24, r: 15, music: 'boss2', col: '#6ee7ff' },
    reaper:  { name: '死神 THE REAPER',            hp: 1800, spd: 22, dmg: 28, r: 12, music: 'boss3', col: '#c29bff', enrage: 0.3 },
    cdragon: { name: 'カオスドラゴン CHAOS DRAGON', hp: 2000, spd: 20, dmg: 28, r: 16, music: 'boss3', col: '#ff4a8a', enrage: 0.4 },
  },
  // 状態異常(プレイヤー): 粘液・スロウタイムの移動速度倍率 / スロウタイムのCD回復倍率 / 炎上
  debuff: { slow: 0.6, cdRate: 0.5, burnTick: 0.5, burnDur: 3, frostSlow: 0.05 }, // frostSlow: 敵の凍傷1スタックあたりの減速
  // 敵の出血: 1スタックごとに毎秒 最大HP × bleedPct(ボス ×bleedBoss・エリート ×bleedElite)、bleedDur 秒
  bleed: { pct: 0.002, dur: 5, boss: 0.1, elite: 0.25 },

  // ---------- 出現スケジュール(周回内の経過秒) ----------
  // boss: 候補からランダムに1体。final: 撃破で勝利/周回
  schedule: [
    { t: 0,   types: ['zombie'],                            interval: 0.95, max: 60 },
    { t: 35,  types: ['zombie', 'bat'],                     interval: 0.75, max: 100 },
    { t: 80,  types: ['bat', 'slime', 'zombie'],            interval: 0.6,  max: 130 },
    { t: 130, types: ['skeleton', 'slime', 'bat'],          interval: 0.5,  max: 160 },
    { t: 180, boss: ['king', 'gslime'] },
    { t: 186, types: ['skeleton', 'archer', 'zombie'],      interval: 0.55, max: 170 },
    { t: 250, types: ['ghost', 'skeleton', 'archer'],       interval: 0.48, max: 190 },
    { t: 320, types: ['ghost', 'brute', 'bat', 'slime'],    interval: 0.45, max: 200 },
    { t: 360, event: 'horde' },
    { t: 420, boss: ['wyrm', 'golem'] },
    { t: 426, types: ['brute', 'imp', 'ghost'],             interval: 0.42, max: 220 },
    { t: 500, types: ['imp', 'brute', 'archer', 'skeleton'], interval: 0.38, max: 240 },
    { t: 560, event: 'horde' },
    { t: 600, types: ['imp', 'brute', 'ghost', 'archer'],   interval: 0.33, max: 270 },
    { t: 630, event: 'horde' },
    { t: 660, boss: ['reaper', 'cdragon'], final: true },
    { t: 666, types: ['imp', 'ghost', 'brute', 'slime'],    interval: 0.4,  max: 240 },
  ],

  // ---------- 武器 ----------
  // evo: 武器Lv5 で進化カードが出る(メイン武器はクラスLv10 で解放)
  weapons: {
    bolt: {
      name: 'マジックボルト', desc: '最も近い敵へ魔法弾を放つ', col: '#7ad7ff',
      lv: [
        { cd: 1.1,  dmg: 10, count: 1, speed: 160, pierce: 0 },
        { cd: 1.0,  dmg: 13, count: 2, speed: 165, pierce: 0 },
        { cd: 0.95, dmg: 17, count: 2, speed: 175, pierce: 1 },
        { cd: 0.9,  dmg: 22, count: 3, speed: 185, pierce: 1 },
        { cd: 0.85, dmg: 27, count: 4, speed: 200, pierce: 2 },
      ],
      evo: { name: 'アーケインレイ', desc: '魔弾が敵をわずかに追尾する', st: { cd: 0.8, dmg: 30, count: 5, speed: 210, pierce: 2 } },
      // 武器スキル(E)アーケイン・バラージュ: 詠唱 windup 秒(動けない)→ dur 秒間、照準方向へ毎秒 rate 発(各 武器の威力 × pow)。連射中は移動 ×slow
      // 魔弾は通常攻撃と同じ弾速・貫通(進化後は追尾も)。弾数は通常攻撃の countMul 倍(切り上げ)/ radius: 自動発動の判定距離 / shield: 魔力障壁のシールド(最大HP の割合)
      skill: {
        name: 'アーケイン・バラージュ', cd: 30, windup: 0.3, dur: 3, rate: 12, pow: 0.5, slow: 0.6, countMul: 0.5, radius: 90, shield: 0.2,
        tree: { name: 'バラージュ', paths: {
          pow: { name: '威力', desc: ['バラージュの威力 +30%', 'バラージュの威力 +60%', 'バラージュの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '集中砲火', desc: '使っている間、同じ敵に当たるたびに、その敵への威力 +5%(最大 +50%)' } },
          cd:  { name: '迅速', desc: ['バラージュのCD -10%', 'バラージュのCD -20%', 'バラージュのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: 'オーブ', desc: '自分の周りを回るオーブが5秒間、自動で連射する。自分は自由に動ける' } },
          dur: { name: '持続', desc: ['バラージュの持続 +0.5秒', 'バラージュの持続 +1.0秒', 'バラージュの持続 +1.5秒'], v: [0.5, 1.0, 1.5], sp: { name: '魔力障壁', desc: '使っている間の移動速度ペナルティが無くなり、最大HP 20% のシールドを得る' } }, // 名前は仮(mage.md では ???)
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
      name: 'オービットブレード', desc: '周囲を回転する刃', col: '#d8e4ff',
      lv: [
        { count: 2, dmg: 9,  radius: 20, rot: 2.8 },
        { count: 3, dmg: 11, radius: 22, rot: 3.0 },
        { count: 3, dmg: 15, radius: 25, rot: 3.3 },
        { count: 4, dmg: 18, radius: 28, rot: 3.6 },
        { count: 6, dmg: 24, radius: 32, rot: 4.0 },
      ],
      evo: { name: 'ホーリーサークル', desc: '二重の聖刃が逆回転する', st: { count: 7, dmg: 30, radius: 34, rot: 4.4 } },
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
      evo: { name: 'ジャッジメント', desc: '落雷が敵から敵へ連鎖する', st: { cd: 2.3, strikes: 3, dmg: 72, aoe: 30 } },
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
    },
    axe: {
      name: 'スローイングアックス', desc: '放物線を描く重い斧', col: '#ffb070',
      lv: [
        { cd: 1.7, count: 1, dmg: 20 },
        { cd: 1.6, count: 2, dmg: 24 },
        { cd: 1.5, count: 2, dmg: 32 },
        { cd: 1.3, count: 3, dmg: 38 },
        { cd: 1.1, count: 4, dmg: 50 },
      ],
      evo: { name: 'ギガントアックス', desc: '巨大化した斧が大地を割る', st: { cd: 1.0, count: 5, dmg: 72 } },
    },
    wisp: {
      name: 'スピリットウィスプ', desc: '敵を追尾する精霊', col: '#9dffcf',
      lv: [
        { cd: 1.9, count: 1, dmg: 13, pierce: 3 },
        { cd: 1.8, count: 2, dmg: 15, pierce: 3 },
        { cd: 1.7, count: 2, dmg: 20, pierce: 4 },
        { cd: 1.5, count: 3, dmg: 25, pierce: 5 },
        { cd: 1.2, count: 4, dmg: 32, pierce: 6 },
      ],
      evo: { name: 'ソウルイーター', desc: '敵を倒すたび(武器問わず)その場から魂を召喚', st: { cd: 0.9, count: 6, dmg: 40, pierce: 10 } },
    },
    fire: {
      name: 'ファイアー', desc: '貫通する火炎弾。燃焼を付与', col: '#ff8a3d',
      lv: [
        { cd: 1.8, dmg: 8,  count: 1, burn: 4 },
        { cd: 1.7, dmg: 10, count: 1, burn: 6 },
        { cd: 1.6, dmg: 14, count: 2, burn: 8 },
        { cd: 1.4, dmg: 18, count: 2, burn: 11 },
        { cd: 1.2, dmg: 24, count: 3, burn: 15 },
      ],
      evo: { name: 'インフェルノ', desc: '着弾毎に爆炎が広がる', st: { cd: 1.0, dmg: 30, count: 4, burn: 22 } },
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
      evo: { name: 'ビッグクランチ', desc: '消滅時に超新星爆発を起こす', st: { cd: 4.0, dmg: 16, dur: 2.6, radius: 55, pull: 130 } },
    },
    katana: {
      name: '刀', desc: '最も近い敵へ素早い斬撃', col: '#ff5d73',
      lv: [
        { cd: 1.0,  dmg: 16, count: 1, aoe: 35 },
        { cd: 0.9,  dmg: 22, count: 1, aoe: 40 },
        { cd: 0.85, dmg: 26, count: 2, aoe: 46 },
        { cd: 0.8,  dmg: 32, count: 2, aoe: 52 },
        { cd: 0.7,  dmg: 40, count: 3, aoe: 58 },
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
      evo: { name: '鬼神・村正', desc: '斬撃の後に斬撃波(50%)', st: { cd: 0.55, dmg: 52, count: 3, aoe: 70 } },
      // 熟練(クラスLv の「共通」強化)。サムライの Lv で解放され、刀を使うどのクラスにも効く
      // fx: dmg 威力 / area 範囲 / cd クールダウン(攻撃間隔と武器スキルの CD。乗算で重ねる)/ evo 進化の解放 / eHits・ePow 武器スキルの回数・威力
      mastery: {
        4: { d: '刀: 威力 +10%', fx: { dmg: 0.1 } },
        5: { d: '乱れ桜: 斬る回数 +2', fx: { eHits: 2 } },
        7: { d: '刀: 範囲 +10%', fx: { area: 0.1 } },
        9: { d: '刀: クールダウン -10%', fx: { cd: 0.1 } },
        10: { d: '進化「鬼神・村正」を解放', fx: { evo: 1 } },
        12: { d: '刀: 威力 +10%', fx: { dmg: 0.1 } },
        14: { d: '刀: 範囲 +10%', fx: { area: 0.1 } },
        17: { d: '刀: 威力 +15%', fx: { dmg: 0.15 } },
        19: { d: '刀: クールダウン -10%', fx: { cd: 0.1 } },
        20: { d: '乱れ桜: 威力 +30%', fx: { ePow: 0.3 } },
      },
    },
    longbow: {
      name: '長弓', desc: '照準方向へ貫通する矢を放つ(本数が多いときは時間差で連射)', col: '#b8ff9a',
      lv: [
        { cd: 1.2,  dmg: 14, count: 1, speed: 260, pierce: 1 },
        { cd: 1.1,  dmg: 18, count: 1, speed: 270, pierce: 1 },
        { cd: 1.05, dmg: 22, count: 2, speed: 280, pierce: 2 },
        { cd: 1.0,  dmg: 26, count: 2, speed: 290, pierce: 2 },
        { cd: 0.95, dmg: 32, count: 3, speed: 300, pierce: 3 },
      ],
      evo: { name: '天弓', desc: '矢が同じ敵に二度当たる(2回目は貫通を1消費する)', st: { cd: 0.9, dmg: 38, count: 3, speed: 320, pierce: 4 } },
      // 武器スキル(E)アローレイン: 構え windup 秒(動けない)→ 照準位置の半径 radius に dur 秒間、every 秒ごとに矢が1本刺さる
      // (武器の威力 × pow、着弾の半径 hitR)/ range: 照準の最大距離
      skill: {
        name: 'アローレイン', cd: 25, windup: 0.3, dur: 2.5, every: 0.1, pow: 0.8, radius: 60, hitR: 10, range: 200,
        tree: { name: 'アローレイン', paths: {
          pow:  { name: '威力', desc: ['アローレインの威力 +30%', 'アローレインの威力 +60%', 'アローレインの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '豪雨', desc: '矢の降る間隔が半分になる(各 威力 -30%)' } },
          cd:   { name: '迅速', desc: ['アローレインのCD -10%', 'アローレインのCD -20%', 'アローレインのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '追従', desc: '雨の範囲がプレイヤーについてくる' } },
          area: { name: '範囲', desc: ['アローレインの半径 +20%', 'アローレインの半径 +40%', 'アローレインの半径 +60%'], v: [0.2, 0.4, 0.6], sp: { name: '縫い止め', desc: '雨の中の敵の移動速度 -60%' } },
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
  },

  statLabels: {
    cd: '攻撃間隔', dmg: '威力', count: '数', speed: '弾速', pierce: '貫通', strikes: '落雷数',
    aoe: '範囲', radius: '半径', rot: '回転', tick: '間隔', burn: '燃焼/s', dur: '持続', pull: '吸引',
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
      q: { name: '居合・朧月', cd: 30, windup: 0.25, dash: 0.1, recover: 0.2, dist: 90, width: 12, pow: 150, kiPow: 3 },
      // ラン中の強化ツリー(3の倍数のLv で選ぶ)。カテゴリ → 強化パス(Lv1〜3、v が各Lvの値)→ 特殊強化(sp)
      // need: そのスキルが実装済みの場合だけ候補に出す(CLASS_RT の skills に含まれるもの)
      // 特殊強化は各パスが Lv3 で候補に出る。1カテゴリにつき1つだけ取れる
      // E(武器スキル)の強化パスはメイン武器の側(DATA.weapons[].skill.tree)にあり、同じ候補に混ぜて出す
      tree: {
        trait: { name: '剣気', paths: {
          ren: { name: '練気', desc: ['剣気獲得 +30%', '剣気獲得 +60%', '剣気獲得 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '無尽', desc: 'E スキルでも剣気を全て消費し、剣気 × 0.5% だけ威力が上がる' } },
          juu: { name: '充溢', desc: ['剣気100以上の攻撃力 20% → 30%', '剣気100以上の攻撃力 40%', '剣気100以上の攻撃力 50%'], v: [0.3, 0.4, 0.5], sp: { name: '明鏡止水', desc: '剣気100以上の間、被ダメージ -30%・攻撃速度 +25%' } },
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
      // 共鳴: 2属性を持つ敵に3属性目 → 爆発(基礎威力 resoPow・半径 resoR)して属性リセット。魔力結晶 +1(最大 crystalMax)
      // 魔力循環: 通常攻撃の命中ごとに E / Q の CD -flowCut 秒(1秒あたり flowCap 秒まで)
      // ブリンク: 移動方向へ blinkDist 瞬間移動、無敵 blinkIfr 秒、スタミナ blinkCost。出発地点に氷の残滓(residueT 秒・半径 residueR。触れた敵に凍傷)
      params: {
        burnPct: 0.2, burnDur: 3, frostCap: 5, chainPct: 0.3, chainN: 1, chainR: 60,
        resoPow: 25, resoR: 30, crystalMax: 5,
        flowCut: 0.05, flowCap: 0.5,
        blinkDist: 50, blinkIfr: 0.15, blinkCost: 80, residueT: 1.5, residueR: 14,
      },
      // メテオ(Q): 照準位置へ。詠唱 windup 秒(動けない)→ fall 秒後に着弾(基礎威力 pow・半径 r・炎上)。武器に依存しない
      //   魔力結晶を全て消費し、1つにつき 威力 +crystalPow・半径 +crystalR / range: 照準の最大距離
      q: { name: 'メテオ', cd: 45, windup: 0.5, fall: 0.3, pow: 200, r: 70, crystalPow: 0.2, crystalR: 0.1, range: 170 },
      // 属性強化の Lv ごとの値: 炎上 +10%/Lv(倍率)・凍傷上限 elFrost・連鎖 +1体/Lv
      elFrost: [2, 4, 5],
      tree: {
        trait: { name: '元素循環', paths: {
          el: { name: '属性強化', desc: ['炎上 +10%・凍傷上限 +2・連鎖 +1体', '炎上 +20%・凍傷上限 +4・連鎖 +2体', '炎上 +30%・凍傷上限 +5・連鎖 +3体'], v: [1, 2, 3], sp: { name: '三重詠唱', desc: '15% の確率で、1発が3属性すべてを持つ' } },
          rpow: { name: '共鳴威力', desc: ['共鳴の威力 +30%', '共鳴の威力 +60%', '共鳴の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '連鎖共鳴', desc: '共鳴に巻き込まれた敵にも、ランダムな属性を1つ付与する' } },
          rarea: { name: '共鳴範囲', desc: ['共鳴の半径 +15%', '共鳴の半径 +30%', '共鳴の半径 +50%'], v: [0.15, 0.3, 0.5], sp: { name: '特異点', desc: '共鳴した地点に、1秒間敵を引き寄せる渦を作る' } },
        } },
        passive: { name: '魔力循環', paths: {
          flow: { name: '循環', desc: ['CD の短縮量 +0.01秒', 'CD の短縮量 +0.02秒', 'CD の短縮量 +0.03秒'], v: [0.01, 0.02, 0.03], sp: { name: 'オーバーフロー', desc: 'E か Q の CD が 0 の状態で命中すると、次のスキルの威力 +5%(最大 +50%)' } },
          cap: { name: '容量', desc: ['1秒あたりの上限 +0.1秒', '1秒あたりの上限 +0.3秒', '1秒あたりの上限 +0.5秒'], v: [0.1, 0.3, 0.5], sp: { name: '瞑想', desc: '3秒間被弾しないと、HP 2/s で回復し続ける' } },
          echo: { name: '余韻', desc: ['スキル使用後5秒、攻撃速度 +10%', 'スキル使用後5秒、攻撃速度 +20%', 'スキル使用後5秒、攻撃速度 +30%'], v: [0.1, 0.2, 0.3], sp: { name: '詠唱加速', desc: 'スキル使用後5秒、弾数 +1(近接武器では攻撃回数 +1)' } },
        } },
        q: { name: 'メテオ', need: 'q', paths: {
          pow: { name: '威力', desc: ['メテオの威力 +30%', 'メテオの威力 +60%', 'メテオの威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: 'メテオスウォーム', desc: '周囲に小隕石を5個追加する(各 基礎威力 50)' } },
          cd:  { name: '迅速', desc: ['メテオのCD -10%', 'メテオのCD -20%', 'メテオのCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '審判', desc: '着弾後、範囲内に落雷を6回落とす(各 基礎威力 50)' } },
          area: { name: '範囲', desc: ['メテオの半径 +15%', 'メテオの半径 +30%', 'メテオの半径 +50%'], v: [0.15, 0.3, 0.5], sp: { name: '絶対零度', desc: '着弾地点に氷原を4秒間残す(凍傷が即座に最大)' } },
        } },
      },
      lv: {
        2: { d: '最大HP +10', st: { hp: 10 } },
        3: { d: '共鳴: 威力 +10%', fx: { resoPow: 0.1 } },
        6: { d: 'ブリンク: スタミナ消費 -10', fx: { blinkCut: 10 } },
        8: { d: '魔力循環: 短縮量 +0.01秒', fx: { flowCut: 0.01 } },
        11: { d: 'メテオ: 威力 +20%', fx: { qPow: 0.2 } },
        13: { d: '射程 +10%、魔力結晶の上限 +1', st: { range: 0.1 }, fx: { crystalMax: 1 } },
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
      params: {
        markMax: 10, markPct: 0.01, markT: 3, weakT: 3, weakCrit: 0.15, spreadR: 60, brandPow: 40, brandR: 30,
        focusMax: 5, focusStep: 0.5, focusDecay: 1, focusAtkSpd: 0.04, focusCrit: 0.02, focusHurt: 2,
        backDist: 80, backTime: 0.15, backIfr: 0.25, backCost: 100, backFocus: 1,
      },
      // 一斉射撃(Q): 構え windup 秒(動けない)→ 画面内の印を持つ敵へ、印1つにつき1本の追尾する矢(基礎威力 pow)
      //   印を持つ敵がいなければ最寄り none 体へ1本ずつ。最大 max 本。流星: 着弾で爆発(meteorPow・半径 meteorR)
      q: { name: '一斉射撃', cd: 35, windup: 0.4, pow: 25, none: 10, max: 100, speed: 170, meteorPow: 10, meteorR: 16 },
      tree: {
        trait: { name: '狩人の印', paths: {
          deep:   { name: '深手', desc: ['印の持続 +2秒', '印の持続 +4秒', '印の持続 +7秒'], v: [2, 4, 7], sp: { name: '急所', desc: '弱点露出中の敵へのクリティカルダメージ +30%' } },
          carve:  { name: '刻印', desc: ['印の上限 +3', '印の上限 +6', '印の上限 +10'], v: [3, 6, 10], sp: { name: '烙印', desc: '印が上限の敵を倒すと爆発する(基礎威力 40、半径 30)' } },
          spread: { name: '伝播', desc: ['印を持つ敵を倒すと、印の 25% を近くの敵に移す', '印を持つ敵を倒すと、印の 50% を近くの敵に移す', '印を持つ敵を倒すと、印を全て近くの敵に移す'], v: [0.25, 0.5, 1.0], sp: { name: '狩りの連鎖', desc: '印を持つ敵を倒すと、一斉射撃の CD -1秒' } },
        } },
        passive: { name: '集中', paths: {
          calm: { name: '静心', desc: ['集中の溜まる速さ +20%', '集中の溜まる速さ +40%', '集中の溜まる速さ +60%'], v: [0.2, 0.4, 0.6], sp: { name: '不動', desc: '集中が最大の間、被ダメージ -20%' } },
          hold: { name: '残心', desc: ['移動中に集中が減る速さ -25%', '移動中に集中が減る速さ -50%', '移動中に集中が減る速さ -75%'], v: [0.25, 0.5, 0.75], sp: { name: '狩りの構え', desc: '防御スキルを使うと集中 +2段' } },
          eye:  { name: '鋭眼', desc: ['集中1段のクリティカル率 +0.5% 追加', '集中1段のクリティカル率 +1% 追加', '集中1段のクリティカル率 +1.5% 追加'], v: [0.005, 0.01, 0.015], sp: { name: '連射', desc: '集中が最大の間、弾数 +1(近接武器では攻撃回数 +1)' } },
        } },
        q: { name: '一斉射撃', need: 'q', paths: {
          pow: { name: '威力', desc: ['一斉射撃の威力 +30%', '一斉射撃の威力 +60%', '一斉射撃の威力 +100%'], v: [0.3, 0.6, 1.0], sp: { name: '流星', desc: '矢が着弾すると小さく爆発する(基礎威力 10、半径 16)' } },
          cd:  { name: '迅速', desc: ['一斉射撃のCD -10%', '一斉射撃のCD -20%', '一斉射撃のCD -30%'], v: [0.1, 0.2, 0.3], sp: { name: '印の嵐', desc: '矢が当たった敵に、印 +5 を刻み直す' } },
          num: { name: '本数', desc: ['印の無い敵にも追加で +2本', '印の無い敵にも追加で +4本', '印の無い敵にも追加で +6本'], v: [2, 4, 6], sp: { name: '必中', desc: '一斉射撃の矢は必ずクリティカルになる' } },
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
      life:    { hp: [20, 10], regen: [1, 5], def: [1, 4], dr: [0.1, 5], sta: [30, 10], staRegen: [2, 5], iframe: [0.1, 1] },
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
        { name: '守護', lanes: 1, chain: { def: 4, dr: 1 }, leaf: { dr: 4 }, tip: 'iframe' },
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
      hp: '体', regen: '癒', def: '守', dr: '減', sta: '持', staRegen: '息', iframe: '無',
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
    senju:     { slot: 'weapon', epi: '千手の',   desc: '弾数 +1(近接武器は攻撃回数 +1)', stat: { shots: 1 } },
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
    craft:     { slot: 'ring',   epi: '神匠の',   desc: '装備品質 +25%、宝箱品質 +25%', stat: { eqQual: 0.25, chestQual: 0.25 } },
    fate:      { slot: 'ring',   epi: '運命の',   desc: 'リロール回数 +2', stat: { reroll: 2 } },
  },

  // ---------- ステージ ----------
  // amb: 環境光(暗いほど光源が映える) / tint: カラーグレーディング / motes: 環境パーティクル
  stages: [
    { label: 'はじまりの草原', ground: ['#2d4c35', '#335a3b', '#284430', '#3b6843'], deco: ['#4f8a4c', '#6fae5a', '#e4e98a', '#f28cb1'],
      amb: [0.64, 0.68, 0.82], tint: [1.0, 1.02, 1.05], motes: { col: '#d9ff8a', rise: false } },
    { label: '黄昏の荒野',     ground: ['#2f2a45', '#373052', '#29243c', '#40385e'], deco: ['#5a4d80', '#8b7ec8', '#e0c3fc', '#ffd6a5'],
      amb: [0.62, 0.56, 0.78], tint: [1.04, 0.98, 1.08], motes: { col: '#e0c3fc', rise: false } },
    { label: '灼熱の奈落',     ground: ['#3a1e1b', '#452520', '#321815', '#502a22'], deco: ['#6b3024', '#a23e3e', '#ffb347', '#ff6a2a'],
      amb: [0.74, 0.52, 0.48], tint: [1.1, 0.96, 0.9], motes: { col: '#ff9b3d', rise: true }, lava: true },
    // 闘技場モード専用(石畳 + 円形の壁と観客席)
    { label: '血戦の闘技場',   ground: ['#5a4838', '#65513f', '#4d3d30', '#6f5a45'], deco: ['#3a2c22', '#8a7058', '#7a1e24', '#cfc2a8'],
      amb: [0.6, 0.52, 0.5], tint: [1.06, 0.98, 0.94], motes: { col: '#ffcf8a', rise: true }, tiles: true },
  ],

  // ---------- ステージ単体モード ----------
  // stage: 対応するステージ / from, to: 通常モードの出現スケジュールから使う区間(秒)/ elv: 開始時の敵Lv
  // bosses: 1体目(180秒)・2体目(360秒)。2体目を倒したらクリア
  stageRuns: [
    { stage: 1, from: 0,   to: 180, elv: 1,  bosses: ['king', 'gslime'] },
    { stage: 2, from: 186, to: 420, elv: 7,  bosses: ['wyrm', 'golem'] },
    { stage: 3, from: 426, to: 660, elv: 14, bosses: ['reaper', 'cdragon'] },
  ],

  // ---------- 闘技場(ボスラッシュ) ----------
  // order: 登場順 / elv: 各ラウンドの敵Lv(固定) / startLv: 開始時のレベルアップ回数
  // rewardLv: ボス撃破で得るレベルアップ回数(ジェムで配布) / rest: 次のボスまでの休憩秒 / r: 闘技場の半径
  arena: {
    r: 250, rest: 8, startLv: 6, rewardLv: 5,
    order: ['king', 'gslime', 'wyrm', 'golem', 'reaper', 'cdragon'],
    elv:   [6,      9,        13,     16,      20,       23],
  },
};
