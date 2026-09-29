// data.js — ゲームバランス定義。距離・速度はすべて内部解像度ピクセル(1アートpx = 1ワールドpx)
'use strict';

const DATA = {
  player: { hp: 100, speed: 58, magnet: 30, dashCd: 1.6, iframe: 0.5, dashTime: 0.16, dashSpeed: 260, comboTime: 3 },

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
  debuff: { slow: 0.6, cdRate: 0.5, burnTick: 0.5, burnDur: 3 },

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
    shots:     { label: '弾数',                 kind: 'flat', group: 'special' },
    eqMaxLv:   { label: '装備最大Lv',           kind: 'flat', group: 'special' },
    eqMaxVal:  { label: '装備最大値',           kind: 'pct',  group: 'special' },
  },

  // ---------- クラス ----------
  // base: 基礎ステータス(共通基準 + クラス差。設計書 3.6)。crit / critDmg は割合(0.05 = 5%、1.0 = +100% = ×2)
  // lvStats: クラスLv で得るステータス({ Lv: { stat: 値 } })。スキル系の強化はクラスの実装側で扱う
  classes: {
    samurai: {
      name: 'サムライ', weapon: 'katana', col: '#ff5d73', rig: 'samurai', // rig: 部位アニメーション(ART.S)
      base: { hp: 110, regen: 0.3, def: 1, sta: 100, staRegen: 20, atk: 0.1, range: -0.1, crit: 0.08, critDmg: 1.2, magnet: -0.1, wslot: 4, reroll: 2 },
      lvStats: { 2: { hp: 10 }, 13: { hp: 15, sta: 20 } },
    },
    mage: {
      name: 'メイジ', weapon: 'bolt', col: '#7ad7ff',
      base: { hp: 80, sta: 90, staRegen: 24, spd: -0.03, area: 0.1, range: 0.1, cd: 0.05, crit: 0.05, critDmg: 1.0, xp: 0.05, magnet: 0.15, wslot: 4, reroll: 2 },
      lvStats: { 2: { hp: 10 }, 13: { hp: 15 } },
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
      balance: { xp: [0.1, 5], gold: [0.2, 8], magnet: [0.2, 8], eqQual: [0.2, 5], chestQual: [0.2, 5], classXp: [0.2, 5], reroll: [3, 3], classPick: [1, 1] },
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

  // ---------- 闘技場(ボスラッシュ) ----------
  // order: 登場順 / elv: 各ラウンドの敵Lv(固定) / startLv: 開始時のレベルアップ回数
  // rewardLv: ボス撃破で得るレベルアップ回数(ジェムで配布) / rest: 次のボスまでの休憩秒 / r: 闘技場の半径
  arena: {
    r: 250, rest: 8, startLv: 6, rewardLv: 5,
    order: ['king', 'gslime', 'wyrm', 'golem', 'reaper', 'cdragon'],
    elv:   [6,      9,        13,     16,      20,       23],
  },
};
