// help.js — 用語集(ガイド画面の辞典)と、説明文の用語にマウスを乗せると出る説明
// 用語集の説明の数値は DATA から読む(調整しても説明が古くならないように)
// glossify(要素): 描いた説明文の中の用語を、説明が出る印(.gl)で囲む。テキストだけを書き換える(タグ・属性には触れない)
'use strict';

const Help = (() => {
  const $ = id => document.getElementById(id);
  const pct = x => Math.round(x * 1000) / 10 + '%';

  // ---------- 用語集 ----------
  // k: キー / t: 見出し / m: 説明文の中で印を付ける書き方(既定は t。[] なら印を付けない)/ c: 分類 / d: 説明(関数なら開くたびに DATA から作る)
  const CATS = ['基本', '戦闘', '生存', '状態異常', 'スキル・成長', '装備・永続'];
  const G = [
    // ===== 基本 =====
    { k: 'run', t: 'ラン', c: '基本', d: '出撃してから、倒れるかクリアするまでの1回のプレイ。ラン中に上げた Lv・武器・クラス強化はランが終わるとなくなる。ゴールド・手に入れた装備・クラス経験値は残る' },
    { k: 'tier', t: 'tier', c: '基本', d: 'ステージの難しさ(1〜4)。tier が高いほど敵が強く、攻撃も激しい。tier N のステージは、tier N−1 のステージを1つクリアすると遊べる' },
    { k: 'stagemode', t: '通常モード', c: '基本', d: () => `ステージを1つ選んで遊ぶ。${DATA.flow.seg / 60}分 → エリート戦 → ${DATA.flow.seg / 60}分 → ボス戦 → ${DATA.flow.seg / 60}分 → 最後のボス戦。最後のボスを倒すとクリア` },
    { k: 'escalation', t: 'エスカレーション', c: '基本', d: 'tier 1 → 4 のステージを続けて進む(各ステージ 3分 → ボス)。最後は時計塔の死神。クリア後はエンドレス(さらに強い2周目)に進める。tier 4 のステージをクリアすると遊べる' },
    { k: 'arena', t: '闘技場', c: '基本', d: () => `ボス ${DATA.arena.order.length}体と続けて戦う。tier 4 のステージをクリアすると遊べる` },
    { k: 'phase', t: 'フェーズ', c: '基本', d: 'エリート戦・ボス戦の間のこと。フェーズの間は、次のフェーズまでの時計と敵Lv が止まる。長引くと闇の霧が出る' },
    { k: 'elitephase', t: 'エリート戦', c: '基本', d: () => `エリート ${DATA.flow.elites}体が同時に出る。全て倒すと宝箱が出る` },
    { k: 'bossphase', t: 'ボス戦', m: ['ボス戦'], c: '基本', d: 'ボスが現れる。倒すと宝箱が出る。通常モードは2体目のボスを倒すとクリア' },
    { k: 'fog', t: '闇の霧', c: '基本', d: () => { const F = DATA.flow.fog; return `フェーズが ${F.start / 60}分 続くと出る。1秒ごとに HP −${F.dmg}(${F.step}秒ごとに +${F.dmg})。防御力・シールドでは減らない。フェーズを終えると晴れる`; } },
    { k: 'elv', t: '敵Lv', m: ['敵Lv', 'ENEMY LV'], c: '基本', d: () => `${DATA.enemyLevel.interval}秒ごとに 1 上がる(フェーズの間は止まる)。敵の HP・攻撃力・速さと、落とす経験値が増える` },
    { k: 'horde', t: '大群', m: ['大群', 'HORDE'], c: '基本', d: '通常モードの 2つ目・3つ目の3分の途中で、敵がまとめて全方向から押し寄せる' },
    { k: 'combo', t: 'コンボ', c: '基本', d: () => `${DATA.player.comboTime}秒以内に続けて敵を倒すと増える。被弾すると途切れる。100 ごとにゴールドのボーナス` },
    { k: 'gem', t: '経験値の宝石', m: ['経験値の宝石', 'ジェム'], c: '基本', d: '敵が落とす。拾うと経験値になる。吸引範囲に入ると自分へ飛んでくる' },
    { k: 'levelup', t: 'レベルアップ', m: ['レベルアップ', 'LEVEL UP'], c: '基本', d: 'カードを1枚選ぶ。3の倍数の Lv はクラス強化(CLASS UP)、それ以外は武器カードか装備カード。1〜3 キーでも選べる' },
    { k: 'wcard', t: '武器カード', c: '基本', d: '新しい武器を手に入れるか、持っている武器の Lv を上げる(最大 Lv5)。武器枠が埋まると、新しい武器は出ない' },
    { k: 'ecard', t: '装備カード', c: '基本', d: '装備しているアイテムのオプションを1つ +1Lv する(そのランの間だけ)' },
    { k: 'micro', t: '微強化', c: '基本', d: () => `武器カード・装備カードを取り切った後のレベルアップでは、カードの代わりに小さな強化がランダムに1つ付く(${DATA.micro.map(m => m.label).join('・')})` },
    { k: 'reroll', t: 'リロール', c: '基本', d: 'カードを引き直す(R キー)。使える回数はリロール回数のステータスで決まる。スキップすると +10G' },
    { k: 'unlock', t: 'クラスの解放', m: [], c: '基本', d: () => `はじめは ${Object.keys(DATA.classes).filter(k => !DATA.classUnlock[k]).map(k => DATA.classes[k].name).join('・')} が使える。モード・ステージを初めてクリアすると、新しいクラスが解放されることがある(何が解放されるかは、クリアしてのお楽しみ)` },
    { k: 'chest', t: '宝箱', c: '基本', d: 'エリート・ボスなどが落とす。開けると装備が手に入る(ランが終わっても残る)' },
    { k: 'brazier', t: '篝火', c: '基本', d: '壊せる置物。壊すとコイン・肉・磁石・爆弾・経験値の宝石のどれかが出る' },
    { k: 'meat', t: '肉', m: [], c: '基本', d: () => `拾うと最大HP の ${pct(DATA.player.food)} 回復する(食べ物の効果で増える)` },
    { k: 'magnet', t: '磁石', c: '基本', d: '拾うと、落ちている経験値の宝石とコインを全て引き寄せる' },
    { k: 'bomb', t: '爆弾', c: '基本', d: '拾うと、画面内の通常の敵を一撃で倒す。ボス・エリートには 250 のダメージ(エリートは HP 1 で残る)' },
    { k: 'gold', t: 'ゴールド', m: ['ゴールド', 'コイン'], c: '基本', d: '強化ツリーとショップで使う。コイン・コンボのボーナス・ランの終わりなどで手に入る' },
    { k: 'goblin', t: 'トレジャーゴブリン', c: '基本', d: '逃げ回る敵。16秒で逃げてしまう。倒すと宝箱とたくさんのコイン' },

    // ===== 戦闘 =====
    { k: 'pow', t: '威力', c: '戦闘', d: 'ダメージのもとになる値。ここに攻撃力などの倍率が掛かる。カードやステータス画面では「威力 → 攻撃力を掛けた値」の順に出る' },
    { k: 'wpow', t: '武器の威力', c: '戦闘', d: 'その武器の今の威力(武器Lv・進化・熟練で上がる)。E の多くは「武器の威力 × n%」で、武器が強いほど強い' },
    { k: 'bpow', t: '基礎威力', c: '戦闘', d: '武器によらない、決まった威力。Q や一部のクラスの効果はこれで決まる(攻撃力は掛かる)' },
    { k: 'atk', t: '攻撃力', c: '戦闘', d: '全てのダメージに掛かる倍率' },
    { k: 'crit', t: 'クリティカル率', m: ['クリティカル率', 'クリティカル'], c: '戦闘', d: 'クリティカルになる確率。クリティカルになると、クリティカルダメージの分だけダメージが増える' },
    { k: 'critdmg', t: 'クリティカルダメージ', c: '戦闘', d: 'クリティカルのときに増えるダメージ(基本 +100% = 2倍)' },
    { k: 'area', t: '範囲', c: '戦闘', d: '攻撃の半径・大きさの倍率(武器・スキルの両方に効く)' },
    { k: 'range', t: '射程', c: '戦闘', d: '飛ばす攻撃の届く距離と、狙う距離の倍率' },
    { k: 'itv', t: '攻撃間隔', c: '戦闘', d: '武器が通常攻撃をする間隔(秒)。クールダウン・攻撃速度で短くなる' },
    { k: 'aspd', t: '攻撃速度', c: '戦闘', d: '全ての武器の通常攻撃の速さ(攻撃間隔を割る)。主にクラスの効果で上がる。E / Q の CD には効かない' },
    { k: 'cdstat', t: 'クールダウン', c: '戦闘', d: 'ステータス。全ての武器の攻撃間隔と、E / Q の CD を短くする' },
    { k: 'cd', t: 'CD', c: '戦闘', d: 'スキルを使ってから、もう一度使えるようになるまでの時間' },
    { k: 'shots', t: '弾数', c: '戦闘', d: '全ての武器の弾の数を増やす(近接武器は攻撃回数)' },
    { k: 'earea', t: '攻撃範囲', c: '戦闘', d: '敵の攻撃(予告・当たり判定・弾・床)の大きさの倍率。エリートやカオス強化で広がる' },
    { k: 'pierce', t: '貫通', c: '戦闘', d: '弾が敵を貫ける数。貫通 n なら n + 1 体まで当たる' },
    { k: 'normal', t: '通常攻撃', c: '戦闘', d: '武器が一定の間隔で自動で行う攻撃。狙いは一番近い敵(SHIFT でマウス照準に切り替え)' },
    { k: 'hit', t: '被弾', c: '戦闘', d: '敵の攻撃を受けること。被弾した後は少しの間 無敵になる(無敵時間)' },
    { k: 'taken', t: '被ダメージ', c: '戦闘', d: '自分が受けるダメージ。「被ダメージ −n%」は受けるダメージを減らす' },
    { k: 'etaken', t: '受けるダメージ', c: '戦闘', d: '敵がそのとき受けるダメージの倍率。印・凍結・侵蝕などで増える(どの攻撃にも効く)' },
    { k: 'inv', t: '無敵', c: '戦闘', d: 'ダメージと状態異常を受けない状態。防御スキルの使い始めや、被弾の直後などに起きる' },
    { k: 'warn', t: '予告', c: '戦闘', d: '敵の攻撃が来る場所を示す赤い円・帯。予告が消えた瞬間に攻撃が当たる' },
    { k: 'elite', t: 'エリート', c: '戦闘', d: () => { const L = DATA.enemyLevel; return `金色に光る強い敵(大きさ ×2)。HP ×${L.elite}、攻撃力 ×${L.eliteDmg}、攻撃の頻度 ×${L.eliteRate}、攻撃範囲 ×${L.eliteArea}。倒すと宝箱を落とす`; } },
    { k: 'boss', t: 'ボス', c: '戦闘', d: 'ステージの最後に出る強敵。押し返し・引き寄せが効かない。HP が減ると激昂する' },
    { k: 'enrage', t: '激昂', c: '戦闘', d: 'ボスの HP が 60% を切ると怒り、技が強く・速くなる' },
    { k: 'stun', t: 'スタン', c: '戦闘', d: '一定の時間、動けず攻撃もしなくなる' },
    { k: 'kb', t: '押し返す', m: ['押し返す', '押し返し', '吹き飛ばす', '吹き飛ばし'], c: '戦闘', d: '敵を後ろへ押しやる。ボスには効かない' },

    // ===== 生存 =====
    { k: 'maxhp', t: '最大HP', c: '生存', d: 'HP の上限。HP が 0 になると倒れる' },
    { k: 'regen', t: 'HP回復速度', c: '生存', d: '1秒あたりに回復する HP' },
    { k: 'heal', t: '被回復量', m: ['被回復量', '回復量アップ'], c: '生存', d: '自分が受ける回復の倍率(肉・スキル・HP回復速度など全ての回復に効く)' },
    { k: 'over', t: '超過回復', c: '生存', d: 'HP が満タンを超えた分の回復。クラスによってはシールドや祈りになる' },
    { k: 'shield', t: 'シールド', c: '生存', d: 'HP より先にダメージを受ける。時間で消えるものもある' },
    { k: 'def', t: '防御力', c: '生存', d: '受けるダメージから、その値をそのまま引く' },
    { k: 'dr', t: 'ダメージ軽減', c: '生存', d: '受けるダメージを % で減らす。いくつか重なると掛け算で効く' },
    { k: 'ifr', t: '無敵時間', c: '生存', d: () => `被弾した後に無敵になる時間(基本 ${DATA.player.iframe}秒)` },
    { k: 'sta', t: 'スタミナ', c: '生存', d: '防御スキル(SPACE)に使う。時間で回復する。ガードで受けると、少しの間 回復が止まる' },
    { k: 'staregen', t: 'スタミナ回復速度', c: '生存', d: '1秒あたりに回復するスタミナ' },
    { k: 'guard', t: 'ガード', c: '生存', d: 'SPACE を押している間、構えて攻撃を受け止める(HP の代わりにスタミナで受ける)。防御スキルがガードのクラスで使える' },
    { k: 'gbreak', t: 'ガードブレイク', c: '生存', d: 'ガード中にスタミナが 0 になると起きる。しばらくガードできず、被ダメージが増える' },
    { k: 'spd', t: '移動速度', c: '生存', d: '歩く速さの倍率' },

    // ===== 状態異常 =====
    { k: 'burn', t: '炎上', c: '状態異常', d: () => { const d = DATA.debuff; return `${d.burnTick}秒ごとにダメージを受け続ける(${d.burnDur}秒)。敵は何度も付けるほど重なって強くなる。自分が炎上している間は HP回復 −${pct(1 - d.burnHeal)}`; } },
    { k: 'frost', t: '凍傷', c: '状態異常', d: () => { const d = DATA.debuff; return `1スタックにつき移動速度 −${pct(d.frostSlow)}(最大 −80%)。しばらく受けないと消える。自分は最大 16スタック(${d.pDur}秒で消える)`; } },
    { k: 'freeze', t: '凍結', c: '状態異常', d: '敵: 一部のクラスの特性で、凍傷が上限に達すると凍って動けなくなる(ボスは攻撃が遅くなるだけ)。自分: 雪華の女王の氷の槍で、少しの間 歩けなくなる(回避とスキルは使える)' },
    { k: 'bleed', t: '出血', c: '状態異常', d: () => { const B = DATA.bleed, d = DATA.debuff; return `敵: 1スタックにつき毎秒 最大HP の ${pct(B.pct)} のダメージ(ボス ×${B.boss}、エリート ×${B.elite})、${B.dur}秒。自分: 1スタックにつき毎秒 最大HP の ${pct(d.pBleed)}(最大 ${d.pBleedMax}スタック、${d.pDur}秒で消える。防御力・シールドでは減らない)`; } },
    { k: 'shock', t: '感電', c: '状態異常', d: () => `当たった敵から、近く(距離 ${DATA.debuff.shockR})の敵へ雷が連鎖して、与えたダメージの一部を与える。「感電 n%」は連鎖したダメージの割合` },
    { k: 'slow', t: '鈍足', m: ['鈍足', '減速'], c: '状態異常', d: () => `移動速度 −${pct(1 - DATA.debuff.slow)}(粘液など)。重なったときは強い方だけ効く` },
    { k: 'slowtime', t: 'スロウタイム', c: '状態異常', d: () => { const d = DATA.debuff; return `移動速度 −${pct(1 - d.slow)}・CD の回復 −${pct(1 - d.cdRate)}・スタミナ回復と HP回復速度 −${pct(1 - d.slowRegen)}(死神の技)`; } },
    { k: 'warp', t: '時の歪み', c: '状態異常', d: '砂時計の精が作る時計盤の床。中にいる間はスロウタイムと同じ効果(移動速度は ×0.7)' },
    { k: 'fatigue', t: '疲労', c: '状態異常', d: () => { const d = DATA.debuff; return `敵の攻撃でスタミナを減らされると ${d.fatigueDur}秒、スタミナ回復 −${pct(1 - d.fatigue)}`; } },

    // ===== スキル・成長 =====
    { k: 'eskill', t: '武器スキル', m: ['武器スキル', 'E'], c: 'スキル・成長', d: 'E キーで使う、メイン武器の技。設定で自動発動にもできる' },
    { k: 'qskill', t: 'クラススキル', m: ['クラススキル', 'Q'], c: 'スキル・成長', d: 'Q キーで使う、クラスの技。武器によらない基礎威力で決まるものが多い' },
    { k: 'space', t: '防御スキル', m: ['防御スキル', 'SPACE', 'Space'], c: 'スキル・成長', d: 'SPACE で使う、クラスごとの身を守る技(回避・ガードなど)。スタミナを使う' },
    { k: 'windup', t: '構え', m: ['構え', '予備動作'], c: 'スキル・成長', d: 'スキルを出す前の短い時間。この間は動けない' },
    { k: 'auto', t: '自動発動', c: 'スキル・成長', d: '設定で ON にすると、周りに敵が集まっているときに E / Q を自動で使う' },
    { k: 'trait', t: '特性', c: 'スキル・成長', d: 'クラスごとの仕組み(剣気・元素循環など)。クラス強化で強くなる' },
    { k: 'passive', t: 'パッシブ', c: 'スキル・成長', d: 'クラスごとの常に効く効果。クラス強化で強くなる' },
    { k: 'clsup', t: 'クラス強化', m: ['クラス強化', 'CLASS UP'], c: 'スキル・成長', d: '3の倍数の Lv で選ぶ。特性・パッシブ・Q・E の強化パスを1つ Lv を上げる' },
    { k: 'path', t: '強化パス', m: ['強化パス', 'パス'], c: 'スキル・成長', d: 'クラス強化の項目。それぞれ Lv1〜3' },
    { k: 'sp', t: '特殊強化', m: ['特殊強化', 'SPECIAL'], c: 'スキル・成長', d: '強化パスを Lv3 にすると候補に出る、効果が変わる強化。特性・パッシブ・Q・E ごとに 1つだけ取れる' },
    { k: 'mainw', t: 'メイン武器', c: 'スキル・成長', d: 'クラスの武器。武器スキル(E)が使える。クラスLv15 で、ほかのクラスの武器に切り替えられる' },
    { k: 'subw', t: 'サブ武器', c: 'スキル・成長', d: 'ラン中に手に入れた、メイン武器以外の武器。通常攻撃だけをする(クラスの効果には「メイン武器だけ」のものがある)' },
    { k: 'wslot', t: '武器枠', c: 'スキル・成長', d: '同時に持てる武器の数(メイン武器を含む)' },
    { k: 'evo', t: '進化', c: 'スキル・成長', d: '武器を Lv5 にすると、進化のカードが出る(その武器のクラスの Lv が 10 以上のとき)。進化すると性能が大きく上がり、効果が増える' },
    { k: 'clv', t: 'クラスLv', m: ['クラスLv', 'クラス経験値'], c: 'スキル・成長', d: () => `ランの終わりに、倒した数 + 倒したボス × ${DATA.classLevel.bossK} のクラス経験値が入る。Lv が上がると、そのクラスの専用の強化と、武器の熟練が解放される` },
    { k: 'mastery', t: '熟練', m: ['熟練', '共通'], c: 'スキル・成長', d: '武器の強化。その武器を専用にしているクラスの Lv で解放され、どのクラスがその武器を使っても効く' },

    // ===== 装備・永続 =====
    { k: 'equip', t: '装備', c: '装備・永続', d: '武器・防具・指輪の3つの枠。ラン外の装備画面で付け替える。宝箱・ショップで手に入る' },
    { k: 'rarity', t: 'レアリティ', c: '装備・永続', d: () => `${Object.values(DATA.equip.rarity).map(r => r.name).join(' → ')}。高いほどオプションが多い` },
    { k: 'opt', t: 'オプション', c: '装備・永続', d: '装備に付くステータスの効果。ランの開始時は Lv0 で、装備カードで Lv が上がる(最大Lv はオプションごとに違う)' },
    { k: 'uq', t: '固有効果', c: '装備・永続', d: '装備に付くことがある特別な効果(★で表示)' },
    { k: 'eqq', t: '装備品質', c: '装備・永続', d: '手に入る装備(宝箱・ショップ)のレアリティが高くなりやすい' },
    { k: 'chq', t: '宝箱品質', c: '装備・永続', d: '宝箱から出る装備の数(1〜3個)が多くなりやすい' },
    { k: 'eqmaxval', t: '装備ロール上限', m: ['装備ロール上限', '装備最大値'], c: '装備・永続', d: '装備のオプションの値は、手に入れたときに装備の種類ごとの範囲からランダムに決まる。その範囲の上限が +n% 伸びて、より高い値が出るようになる(下限は変わらない)。カオス強化の報酬で上がり、そのランで手に入れた装備に効く' },
    { k: 'eqmaxlv', t: '装備Lv上限', m: ['装備Lv上限', '装備最大Lv'], c: '装備・永続', d: () => `装備のオプションの最大Lv は、手に入れたときに ${DATA.equip.maxLv[0]}〜${DATA.equip.maxLv[1]} からランダムに決まる。その上限が +n される(最大Lv が高いほど、装備カードで長く伸ばせる)。カオス強化の報酬で上がり、そのランで手に入れた装備に効く` },
    { k: 'tree', t: '強化ツリー', c: '装備・永続', d: 'ゴールドで、ずっと残るステータスの強化を買う' },
    { k: 'shop', t: 'ショップ', c: '装備・永続', d: 'ゴールドで装備を買う。品物はランが終わるたびに入れ替わる' },
    { k: 'chaos', t: 'カオス強化', c: '装備・永続', d: 'モード・ステージごとに敵を強くする設定。ポイントが高いほど装備とゴールドの報酬が増える。初めてクリアするまでは tier ごとに決まった値で固定' },
    { k: 'magnetst', t: '吸引範囲', c: '装備・永続', d: '経験値の宝石が自分へ飛んでくる距離' },
    { k: 'xpst', t: '経験値', c: '装備・永続', d: 'ステータスの「経験値」は、宝石から得る経験値の倍率' },
    { k: 'goldst', t: '獲得ゴールド', c: '装備・永続', d: '手に入るゴールドの倍率' },
    { k: 'rerollst', t: 'リロール回数', c: '装備・永続', d: '1回のランでカードを引き直せる回数' },
    { k: 'pick1', t: 'クラス強化選択枠', c: '装備・永続', d: 'クラス強化のカードの枚数を増やす' },
    { k: 'pick2', t: '武具強化選択枠', c: '装備・永続', d: '武器カード・装備カードの枚数を増やす' },
    { k: 'food', t: '食べ物の効果', c: '装備・永続', d: '肉で回復する量の倍率' },
    { k: 'foodCleanse', t: '食べ物でデバフ解除', c: '装備・永続', d: '肉を拾うと、炎上・凍傷・出血・減速・凍結・疲労が消える(消してから回復するので、炎上中でも回復は減らない)' },
    { k: 'itemRate', t: 'アイテム出現率', c: '装備・永続', d: '敵や置物から出るアイテム(コイン・肉・磁石・爆弾。装備宝箱は除く)の数の倍率。100% を超えた分は、その確率でもう1つ出る' },
    { k: 'eqInit', t: '装備初期レベル', c: '装備・永続', d: 'ランを始めたとき、装備のオプションがそれぞれこの確率で +1Lv から始まる。100% で全て +1Lv、150% なら全て +1Lv に加えて 50% でさらに +1Lv(最大Lv まで)' },
  ];
  const byK = {};
  for (const e of G) byK[e.k] = e;
  const descOf = e => (typeof e.d === 'function' ? e.d() : e.d);

  // ---------- クラスの用語(特性・パッシブ・Q・防御スキル・E の名前)----------
  // ステータス画面と同じ説明(StatusUI.blocks)を出す。クラスによって意味が変わるので、そのクラスの画面でだけ印を付ける
  function classTerms(cls, run) {
    if (typeof StatusUI === 'undefined' || !cls) return [];
    let bl = [];
    try { bl = StatusUI.blocks(run, cls); } catch (e) { return []; }
    const C = DATA.classes[cls], out = [];
    bl.forEach((b, i) => {
      if (b.key === '通常攻撃') return;
      const names = new Set([b.name]);
      if (b.name.includes('・')) { const s = b.name.split('・')[0]; if (s.length >= 2) names.add(s); } // 居合・朧月 → 居合
      if (b.key === 'E') { const W = DATA.weapons[run ? P.mainW : (META.classes[cls].weapon || C.weapon)]; if (W && W.skill && W.skill.tree) names.add(W.skill.tree.name); } // バラージュ
      for (const n of names) out.push({ s: n, key: `c:${run ? 1 : 0}:${cls}:${i}` });
    });
    return out;
  }

  // ---------- 印付け ----------
  const ascii = s => /^[A-Za-z ]+$/.test(s);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 単語の区切り: 英字の用語は英数字に、カタカナで始まる・終わる用語はカタカナに続いていないときだけ(「ビッグクランチ」「ランダム」の中の「ラン」に付けない)
  const KANA = /[ァ-ヺー]/;
  const bound = s => {
    if (ascii(s)) return `(?<![A-Za-z0-9])${esc(s)}(?![A-Za-z0-9])`;
    return (KANA.test(s[0]) ? '(?<![ァ-ヺー])' : '') + esc(s) + (KANA.test(s[s.length - 1]) ? '(?![ァ-ヺー])' : '');
  };
  const baseTerms = [];
  for (const e of G) for (const s of e.m || [e.t]) baseTerms.push({ s, key: 'g:' + e.k });
  function matcher(extra) {
    const list = [...extra, ...baseTerms]; // クラスの用語を先に(同じ書き方なら、クラスの意味を優先)
    const map = {};
    for (const x of list) if (!(x.s in map)) map[x.s] = x.key;
    const ss = Object.keys(map).sort((a, b) => b.length - a.length); // 長いものから(最大HP を HP より先に)
    const re = new RegExp(ss.map(bound).join('|'), 'g');
    return { re, map };
  }
  // root の中の説明文に印を付ける。o.cls: クラスの用語も / o.run: ラン中の値で / o.per: この子要素ごとに「最初の1回だけ」を数える
  function glossify(root, o = {}) {
    if (!root) return;
    const { re, map } = matcher(classTerms(o.cls, o.run));
    let parts = o.per ? [...root.querySelectorAll(o.per)] : [root];
    parts = parts.filter(p => !parts.some(q => q !== p && q.contains(p))); // 入れ子は外側だけ(内側で同じ用語にもう一度印が付かないように)
    for (const part of parts) {
      const seen = new Set(), nodes = [], own = part.closest('[data-own]');
      if (own) seen.add(own.dataset.own); // 用語自身の説明の中では、その用語に印を付けない
      const w = document.createTreeWalker(part, NodeFilter.SHOW_TEXT, {
        acceptNode: n => (n.parentElement && n.parentElement.closest('.gl, [data-tip], .no-gl, input, textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      while (w.nextNode()) nodes.push(w.currentNode);
      for (const n of nodes) {
        const s = n.nodeValue;
        re.lastIndex = 0;
        let m, last = 0, frag = null;
        while ((m = re.exec(s))) {
          const key = map[m[0]];
          if (seen.has(key)) continue; // 同じ用語は最初の1回だけ(印だらけにしない)
          seen.add(key);
          frag = frag || document.createDocumentFragment();
          frag.appendChild(document.createTextNode(s.slice(last, m.index)));
          const sp = document.createElement('span');
          sp.className = 'gl'; sp.dataset.tip = key; sp.textContent = m[0];
          frag.appendChild(sp);
          last = m.index + m[0].length;
        }
        if (!frag) continue;
        frag.appendChild(document.createTextNode(s.slice(last)));
        n.parentNode.replaceChild(frag, n);
      }
    }
  }

  // ---------- ツールチップの中身(ui.js の showTip から)----------
  function tip(kind, rest) {
    if (kind === 'g') { const e = byK[rest]; return e ? `<b>${e.t}</b><br>${descOf(e)}` : ''; }
    if (kind === 'c') {
      const [run, cls, i] = rest.split(':');
      const b = StatusUI.blocks(run === '1', cls)[+i];
      if (!b) return '';
      return `<b>${b.name}</b> <span class="dim">${b.key}</span><br>` + [].concat(b.desc || []).map(l => (l.startsWith('  ') ? `<span class="dim">${l.trim()}</span>` : l)).join('<br>');
    }
    return '';
  }

  // ============================================================
  // ガイド画面(操作・遊び方・用語の辞典)
  // ============================================================
  const KEYS = [
    ['WASD / 矢印', '移動'],
    ['(自動)', '通常攻撃。武器ごとの間隔で、一番近い敵を狙う'],
    ['SHIFT', 'マウス照準の ON / OFF(ON のときは通常攻撃・スキルがマウスの方向へ)'],
    ['E', '武器スキル(メイン武器の技)'],
    ['Q', 'クラススキル'],
    ['SPACE', '防御スキル(長押しで構えるクラスもある)'],
    ['TAB', 'ステータス(ラン中)'],
    ['ESC', 'ポーズ / 戻る'],
    ['M', '音のミュート'],
    ['1〜3 / R', 'レベルアップのカードを選ぶ / リロール'],
  ];
  const FLOW = [
    ['出撃', 'START からステージを選ぶ。クラスはクラス画面で選ぶ(クラスごとにメイン武器・スキルが違う。はじめは4クラスで、ステージをクリアすると増える)'],
    ['戦う', '移動して敵の攻撃を避ける。攻撃は自動。赤い予告の円・帯が出たら、そこから離れる'],
    ['育てる', '経験値の宝石を拾ってレベルアップ。武器を増やして Lv を上げ、3の倍数の Lv ではクラス強化を選ぶ'],
    ['スキル', 'E(武器スキル)・Q(クラススキル)は CD が明けたら使える。SPACE(防御スキル)はスタミナを使う'],
    ['フェーズ', '3分ごとにエリート戦・ボス戦。最後のボスを倒すとクリア'],
    ['持ち帰る', 'ランが終わると、ゴールド・装備・クラス経験値が残る。ゴールドは強化ツリー・ショップで使い、装備は装備画面で付ける'],
  ];
  let cat = '操作', back = 'title';
  function open(from = 'title') {
    back = from; state = 'help';
    UI.only('help-screen');
    $('hp-q').value = '';
    render();
  }
  function close() {
    if (back === 'pause') { state = 'pause'; UI.pause(true); } else { state = 'title'; UI.title(); }
  }
  function render() {
    const q = $('hp-q').value.trim();
    $('hp-cats').innerHTML = ['操作', '遊び方', ...CATS].map(c => `<button class="${!q && c === cat ? 'on' : ''}" data-c="${c}">${c}</button>`).join('');
    let h = '';
    if (q) { // 検索: 全ての用語から(見出し・説明)
      const hit = G.filter(e => e.t.includes(q) || (e.m || []).some(s => s.includes(q)) || descOf(e).includes(q));
      h = hit.length ? hit.map(ent).join('') : '<div class="dim">見つかりませんでした</div>';
    } else if (cat === '操作') h = KEYS.map(([k, d]) => `<div class="hp-key"><kbd>${k}</kbd><span>${d}</span></div>`).join('') + '<div class="dim hp-note">設定(タイトル・ポーズ画面)で、E / Q の自動発動・スキルのカットイン・攻撃の濃さ・UI サイズを変えられます</div>';
    else if (cat === '遊び方') h = FLOW.map(([k, d], i) => `<div class="hp-ent"><b>${i + 1}. ${k}</b><div>${d}</div></div>`).join('') + '<div class="dim hp-note">用語にマウスを乗せると説明が出ます</div>';
    else h = G.filter(e => e.c === cat).map(ent).join('');
    $('hp-body').innerHTML = h;
    $('hp-body').scrollTop = 0;
    glossify($('hp-body'), { per: '.hp-ent > div, .hp-key > span' });
  }
  const ent = e => `<div class="hp-ent" data-own="g:${e.k}"><b class="no-gl">${e.t}</b><div>${descOf(e)}</div></div>`;
  $('hp-cats').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; $('hp-q').value = ''; AudioMan.click(); render(); };
  $('hp-q').oninput = () => render();
  $('hp-back').onclick = () => { AudioMan.click(); close(); };
  $('btn-help').onclick = () => { AudioMan.click(); open('title'); };
  $('btn-help-p').onclick = () => { AudioMan.click(); open('pause'); };
  // ガイドの画面では ESC で戻るだけ。ほかのキー(M のミュートなど)は受け付けない(検索欄に文字を打つため)
  function onKey(e) {
    if (state !== 'help') return false;
    if (e.code === 'Escape' && !e.isComposing) close(); // 日本語入力の変換中の ESC は変換の取り消し
    return true;
  }

  return { glossify, tip, open, onKey, terms: G };
})();
