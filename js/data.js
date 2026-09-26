// data.js — ゲームバランス定義。距離・速度はすべて内部解像度ピクセル(1アートpx = 1ワールドpx)
'use strict';

const DATA = {
  player: { hp: 100, speed: 58, magnet: 30, dashCd: 1.6, iframe: 0.5, dashTime: 0.16, dashSpeed: 260 },

  // ---------- 敵 ----------
  // ai: chase / flutter / keep(距離を取り射撃) / flee(逃走)
  enemies: {
    zombie:   { hp: 20, spd: 13, dmg: 9,  xp: 1, r: 5, ai: 'chase' },
    bat:      { hp: 14, spd: 30, dmg: 8,  xp: 1, r: 4, ai: 'flutter' },
    slime:    { hp: 20, spd: 15, dmg: 9,  xp: 1, r: 5, ai: 'hop', split: 'slimelet' },
    slimelet: { hp: 8,  spd: 22, dmg: 6,  xp: 1, r: 3, ai: 'hop' },
    skeleton: { hp: 24, spd: 18, dmg: 10, xp: 1, r: 5, ai: 'chase' },
    archer:   { hp: 20, spd: 16, dmg: 9,  xp: 1, r: 5, ai: 'keep', shot: { cd: 3.2, spd: 70, dmg: 9 } },
    ghost:    { hp: 22, spd: 22, dmg: 10, xp: 1, r: 5, ai: 'chase', ghost: true },
    brute:    { hp: 40, spd: 11, dmg: 13, xp: 2, r: 8, ai: 'chase', kbRes: 0.8 },
    imp:      { hp: 18, spd: 34, dmg: 10, xp: 1, r: 4, ai: 'flutter' },
    goblin:   { hp: 160, spd: 44, dmg: 0, xp: 12, r: 5, ai: 'flee', kbRes: 0.5 },
  },

  // ---------- 敵レベル(時間経過で上昇・ボス出現中は停止・周回してもリセットしない) ----------
  // 各値は Lv が 1 上がるごとの増加率(Lv1 = 基本値)
  enemyLevel: { interval: 30, hp: 0.2, dmg: 0.02, spd: 0.005, spdMax: 1.5, xp: 0.04, boss: 0.08, elite: 14 },

  bosses: {
    king:   { name: '腐肉の王 ROT KING',  hp: 1600, spd: 14, dmg: 22, r: 13, music: 'boss1', col: '#8fce5e' },
    wyrm:   { name: '白骨竜 BONE WYRM',   hp: 3400, spd: 19, dmg: 22, r: 14, music: 'boss2', col: '#efe9d4' },
    reaper: { name: '死神 THE REAPER',    hp: 6000, spd: 22, dmg: 28, r: 12, music: 'boss3', col: '#c29bff' },
  },

  // ---------- 出現スケジュール(周回内の経過秒) ----------
  schedule: [
    { t: 0,   types: ['zombie'],                            interval: 0.95, max: 60 },
    { t: 35,  types: ['zombie', 'bat'],                     interval: 0.75, max: 100 },
    { t: 80,  types: ['bat', 'slime', 'zombie'],            interval: 0.6,  max: 130 },
    { t: 130, types: ['skeleton', 'slime', 'bat'],          interval: 0.5,  max: 160 },
    { t: 180, boss: 'king' },
    { t: 186, types: ['skeleton', 'archer', 'zombie'],      interval: 0.55, max: 170 },
    { t: 250, types: ['ghost', 'skeleton', 'archer'],       interval: 0.48, max: 190 },
    { t: 320, types: ['ghost', 'brute', 'bat', 'slime'],    interval: 0.45, max: 200 },
    { t: 360, event: 'horde' },
    { t: 420, boss: 'wyrm' },
    { t: 426, types: ['brute', 'imp', 'ghost'],             interval: 0.42, max: 220 },
    { t: 500, types: ['imp', 'brute', 'archer', 'skeleton'], interval: 0.38, max: 240 },
    { t: 560, event: 'horde' },
    { t: 600, types: ['imp', 'brute', 'ghost', 'archer'],   interval: 0.33, max: 270 },
    { t: 630, event: 'horde' },
    { t: 660, boss: 'reaper' },
    { t: 666, types: ['imp', 'ghost', 'brute', 'slime'],    interval: 0.4,  max: 240 },
  ],

  // ---------- 武器 ----------
  // evo: Lv5 + 指定パッシブ所持の状態で宝箱を開けると進化
  weapons: {
    bolt: {
      name: 'マジックボルト', desc: '最も近い敵へ魔法弾を放つ', col: '#7ad7ff',
      lv: [
        { cd: 1.1,  dmg: 10, count: 1, speed: 160, pierce: 0 },
        { cd: 1.0,  dmg: 12, count: 2, speed: 165, pierce: 0 },
        { cd: 0.95, dmg: 17, count: 2, speed: 175, pierce: 1 },
        { cd: 0.85, dmg: 22, count: 3, speed: 185, pierce: 1 },
        { cd: 0.72, dmg: 30, count: 4, speed: 200, pierce: 2 },
      ],
      evo: { need: 'tome', name: 'アーケインレイ', desc: '追尾する魔弾の奔流', st: { cd: 0.6, dmg: 34, count: 5, speed: 210, pierce: 2 } },
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
      evo: { need: 'area', name: 'ホーリーサークル', desc: '二重の聖刃が逆回転する', st: { count: 7, dmg: 30, radius: 34, rot: 4.4 } },
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
      evo: { need: 'lens', name: 'ジャッジメント', desc: '落雷が敵から敵へ連鎖する', st: { cd: 2.3, strikes: 3, dmg: 72, aoe: 30 } },
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
      evo: { need: 'armor', name: 'サンクチュアリ', desc: '命中1回につきHP 0.4 回復(1判定で最大5回分)', st: { radius: 60, dmg: 25, tick: 0.28 } },
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
      evo: { need: 'power', name: 'ギガントアックス', desc: '巨大化した斧が大地を割る', st: { cd: 1.0, count: 5, dmg: 72 } },
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
      evo: { need: 'magnet', name: 'ソウルイーター', desc: '敵を倒すたび(武器問わず)その場から魂を召喚', st: { cd: 0.9, count: 6, dmg: 40, pierce: 10 } },
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
      evo: { need: 'regen', name: 'インフェルノ', desc: '着弾毎に爆炎が広がる', st: { cd: 1.0, dmg: 30, count: 4, burn: 22 } },
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
      evo: { need: 'boots', name: 'アブソリュートゼロ', desc: '凍傷1スタックごとに被ダメージ+1%。吹雪が毎秒+10%拡大', st: { cd: 2.6, dmg: 20, radius: 48, dur: 4.0 } },
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
      evo: { need: 'cloak', name: 'ビッグクランチ', desc: '消滅時に超新星爆発を起こす', st: { cd: 4.0, dmg: 16, dur: 2.6, radius: 55, pull: 130 } },
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
      evo: { need: 'heart', name: '鬼神・村正', desc: '斬撃の後に斬撃波(50%)。ダッシュで通過した敵を一閃(200%)', st: { cd: 0.55, dmg: 52, count: 3, aoe: 70 } },
    },
  },

  statLabels: {
    cd: 'CD', dmg: '威力', count: '数', speed: '弾速', pierce: '貫通', strikes: '落雷数',
    aoe: '範囲', radius: '半径', rot: '回転', tick: '間隔', burn: '燃焼/s', dur: '持続', pull: '吸引',
  },

  // ---------- パッシブ ----------
  passives: {
    boots:  { name: 'ラピッドブーツ',   desc: '移動速度 +8%',        max: 5 },
    power:  { name: 'パワークリスタル', desc: '攻撃力 +10%',         max: 5 },
    heart:  { name: 'いのちの器',       desc: '最大HP +20',          max: 5 },
    magnet: { name: 'マグネット',       desc: '吸引範囲 +30%',       max: 5 },
    tome:   { name: '古の魔導書',       desc: 'クールダウン -7%',    max: 5 },
    lens:   { name: '幸運のクローバー', desc: 'クリティカル率 +6%',  max: 5 },
    area:   { name: '拡がりの宝珠',     desc: '攻撃範囲 +10%',       max: 5 },
    regen:  { name: '再生の指輪',       desc: '毎秒HP +0.5 回復',    max: 5 },
    armor:  { name: '鉄の守り',         desc: '被ダメージ -1、無敵時間 +10%',       max: 5 },
    cloak:  { name: '疾風のマント',     desc: 'ダッシュ距離 +20%',   max: 5 },
  },

  // ---------- アーティファクト(ボス撃破報酬) ----------
  artifacts: {
    wslot:  { name: '拡張ホルスター',   desc: '武器の装備枠 +1', col: '#ffd23f' },
    pslot:  { name: '秘伝の腰袋',       desc: 'パッシブの装備枠 +1', col: '#7cfc8a' },
    frenzy: { name: '狂戦士の血晶',     desc: '失ったHP 1% につき攻撃力 +1%', col: '#ff3b5c' },
    clock:  { name: '狂気の懐中時計',   desc: 'クールダウン -15%。敵の出現数と速度 +15%', col: '#ffb347' },
    critdmg:{ name: '処刑人の刻印',     desc: 'クリティカル倍率 +50%。非クリティカル -20%', col: '#ff6ec7' },
    pact:   { name: '悪魔の契約書',     desc: '獲得経験値 +50%。敵のステータス +20%', col: '#b06ef0' },
    aegis:  { name: '不動の重鎧',       desc: '最大HP 2倍。移動速度 -30%', col: '#9fb8d0' },
    mirror: { name: '双面の魔鏡',       desc: 'ボルト/ファイアーが背後にも発射(対象武器の威力 -25%)', col: '#6ee7ff' },
    fang:   { name: '吸血の牙',         desc: '敵撃破時 10% で HP 1 回復', col: '#d0304a' },
    gale:   { name: '疾風の羽根',       desc: 'ダッシュの消費量 -50%、回復速度 -50%', col: '#b8fff0' },
    greed:  { name: '黄金の杯',         desc: '獲得ゴールド x1.5。宝箱の報酬 +1', col: '#ffcc33' },
    bleed:  { name: '渇血の棘',         desc: '刀/アックス/ブレードが出血を付与(5秒)。1スタックにつき被ダメージ +2%、最大スタックは対象武器1つにつき +10。対象外の武器はダメージ -30%', col: '#a0122a' },
    element:{ name: '元素の冠',         desc: 'ボルト/サンダー/ファイアー/ブリザードのダメージ +25%・サイズ +25%。対象外の武器はダメージ -30%', col: '#7ad7ff' },
    annihil:{ name: '光闇の天秤',       desc: 'オーラが「光輝」、ブラックホールが「暗黒」を付与。両方揃うと対消滅し、オーラ+ブラックホールの合計ダメージを範囲に与える', col: '#f0e0ff' },
  },

  // ---------- 永続強化(ゴールドで購入) ----------
  meta: {
    might:   { name: '剛力',   desc: '攻撃力 +4%',        costs: [100, 200, 600, 2400, 12000] },
    vital:   { name: '頑健',   desc: '最大HP +5',         costs: [60, 120, 360, 1440, 7200] },
    swift:   { name: '俊足',   desc: '移動速度 +3%',      costs: [80, 160, 480, 1920, 9600] },
    haste:   { name: '詠唱',   desc: 'クールダウン -2%',  costs: [125, 250, 750, 3000, 15000] },
    growth:  { name: '成長',   desc: '獲得経験値 +4%',    costs: [100, 200, 600, 2400, 12000] },
    greed:   { name: '強欲',   desc: '獲得ゴールド +10%', costs: [60, 120, 360, 1440, 7200] },
    reroll:  { name: '天運',   desc: 'リロール回数 +1',   costs: [100, 200, 600, 2400, 12000] },
    reach:   { name: '広域',   desc: '攻撃範囲 +3%',      costs: [90, 180, 540, 2160, 10800] },
    crit:    { name: '会心',   desc: 'クリティカル率 +2%', costs: [120, 240, 720, 2880, 14400] },
    weapon:  { name: '武器庫', desc: '武器の装備枠 +1',   costs: [5000] },
    passive: { name: '道具箱', desc: 'パッシブの装備枠 +1', costs: [5000] },
    chaos:   { name: '混沌',   desc: '獲得ゴールド +50%・敵のLvの上昇速度 +20%・周回時に敵Lv +2', costs: [1000, 2500, 5000, 7500, 10000] },
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
  ],
};
