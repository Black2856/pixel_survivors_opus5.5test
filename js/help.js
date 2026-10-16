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
    { k: 'run', t: _t('ラン'), c: '基本', d: _t('出撃してから、倒れるかクリアするまでの1回のプレイ。ラン中に上げた Lv・武器・クラス強化はランが終わるとなくなる。ゴールド・手に入れた装備・クラス経験値は残る') },
    { k: 'tier', t: 'tier', c: '基本', d: () => _t`ステージの難しさ(1〜4)。tier が高いほど敵が強く、攻撃も激しい。そのかわり報酬の倍率(獲得ゴールド・装備品質・宝箱品質・クラス経験値)が上がる(tier 1〜4 で ×${DATA.flow.tierRew.map(x => x.toFixed(1)).join(' / ×')})。クリア時に上位のtierのステージが解放される。` },
    { k: 'stagemode', t: _t('通常モード'), c: '基本', d: () => _t`ステージを1つ選んで遊ぶ。${DATA.flow.seg / 60}分 → エリート戦 → ${DATA.flow.seg / 60}分 → ボス戦 → ${DATA.flow.seg / 60}分 → 最後のボス戦。最後のボスを倒すとクリア` },
    { k: 'escalation', t: _t('エスカレーション'), c: '基本', d: () => { const R = DATA.flow.escRew; return _t`tier 1 → 4 のステージを続けて進む(各ステージ 3分 → ボス)。tier 4 はボスを倒すと最後のボスが出る。クリア後はエンドレスに進める。報酬の倍率は ×1.0 から始まり、tier が進むたびに +${R.step}(2周目からは +${R.loopStep}。最大 ×${R.max.toFixed(1)})。tier 4 のステージをクリアすると遊べる`; } },
    { k: 'arena', t: _t('闘技場'), c: '基本', d: () => _t`ボス ${DATA.arena.rounds}体と続けて戦う。報酬の倍率は 2ラウンドごとに上がる。tier 4 のステージをクリアすると遊べる` },
    { k: 'tower', t: _t('チャレンジタワー'), c: '基本', d: () => { const C = DATA.tower, s = C.skip[0]; return _t`決まった数の敵を倒すと次の階へ(1階 ${C.kills}体、1階ごとに +${C.killStep})。階の途中で拾った経験値は貯めるだけで(貯蓄)、クリアした時にまとめて入る。${s[0]}秒以内にクリアすると最大 ${s[1]}階 飛ばせて、飛ばした数だけ貯めた経験値が増える(ボスの階は飛ばせない)。${C.bossEvery}階ごとにボス。敵Lv = 階。宝箱の代わりにゴールドを落とす。${C.lap}階を越えるとカオス強化が付き、ほかのステージの敵も出る`; } },
    { k: 'phase', t: _t('フェーズ'), c: '基本', d: _t('エリート戦・ボス戦の間のこと。フェーズの間は、次のフェーズまでの時計と敵Lv が止まる。長引くと闇の霧が出る') },
    { k: 'elitephase', t: _t('エリート戦'), c: '基本', d: () => _t`エリート ${DATA.flow.elites}体が同時に出る。全て倒すと宝箱が出る` },
    { k: 'bossphase', t: _t('ボス戦'), m: ['ボス戦'], c: '基本', d: _t('ボスが現れる。倒すと宝箱が出る。通常モードは2体目のボスを倒すとクリア') },
    { k: 'fog', t: _t('闇の霧'), c: '基本', d: () => { const F = DATA.flow.fog; return _t`フェーズが ${F.start / 60}分 続くと出る。1秒ごとに HP −${F.dmg}(${F.step}秒ごとに +${F.dmg})。防御力・シールドでは減らない。フェーズを終えると晴れる`; } },
    { k: 'elv', t: _t('敵Lv'), m: ['敵Lv', 'ENEMY LV'], c: '基本', d: () => _t`${DATA.enemyLevel.interval}秒ごとに 1 上がる(フェーズの間は止まる)。敵の HP・攻撃力・速さと、落とす経験値が増える` },
    { k: 'horde', t: _t('大群'), m: ['大群', 'HORDE'], c: '基本', d: _t('通常モードの 2つ目・3つ目の3分の途中で、敵がまとめて全方向から押し寄せる') },
    { k: 'combo', t: _t('コンボ'), c: '基本', d: () => _t`${DATA.player.comboTime}秒以内に続けて敵を倒すと増える。被弾すると途切れる。100 ごとにゴールドのボーナス` },
    { k: 'gem', t: _t('経験値の宝石'), m: ['経験値の宝石', 'ジェム'], c: '基本', d: _t('敵が落とす。拾うと経験値になる。吸引範囲に入ると自分へ飛んでくる') },
    { k: 'levelup', t: _t('レベルアップ'), m: ['レベルアップ', 'LEVEL UP'], c: '基本', d: _t('カードを1枚選ぶ。3の倍数の Lv はクラス強化(CLASS UP)、それ以外は武器カードか装備カード。') },
    { k: 'wcard', t: _t('武器カード'), c: '基本', d: _t('新しい武器を手に入れるか、持っている武器の Lv を上げる(最大 Lv5)。武器枠が埋まると、新しい武器は出ない') },
    { k: 'ecard', t: _t('装備カード'), c: '基本', d: _t('装備しているアイテムのオプションを1つ +1Lv する(そのランの間だけ)') },
    { k: 'micro', t: _t('微強化'), c: '基本', d: () => _t`武器カード・装備カードを取り切った後のレベルアップでは、カードの代わりに小さな強化がランダムに1つ付く(${DATA.micro.map(m => m.label).join(_t('・'))})` },
    { k: 'reroll', t: _t('リロール'), c: '基本', d: _t('カードを引き直す。使える回数はリロール回数のステータスで決まる。スキップすると +10G') },
    { k: 'unlock', t: _t('クラスの解放'), m: [], c: '基本', d: () => _t`はじめは ${DATA.classOrder.filter(k => !DATA.classUnlock[k]).map(k => DATA.classes[k].name).join(_t('・'))} が使える。ステージを初めてクリアすると、新しいクラスが解放されることがある(何が解放されるかは、クリアしてのお楽しみ)` },
    { k: 'chest', t: _t('宝箱'), c: '基本', d: _t('エリート・ボスなどが落とす。開けると装備が手に入る(ランが終わっても残る)') },
    { k: 'brazier', t: _t('篝火'), c: '基本', d: _t('壊せる置物。壊すとコイン・肉・磁石・爆弾・経験値の宝石のどれかが出る') },
    { k: 'meat', t: _t('肉'), m: [], c: '基本', d: () => _t`拾うと最大HP の ${pct(DATA.player.food)} 回復する` },
    { k: 'magnet', t: _t('磁石'), c: '基本', d: _t('拾うと、落ちている経験値の宝石とコインを全て引き寄せる') },
    { k: 'bomb', t: _t('爆弾'), c: '基本', d: _t('拾うと、画面内の通常の敵を一撃で倒す。ボス・エリート・壊せる物には 250 のダメージ') },
    { k: 'gold', t: _t('ゴールド'), m: ['ゴールド', 'コイン'], c: '基本', d: () => _t`強化ツリーとガチャで使う。コイン・コンボのボーナス・ランの終わりなどで手に入る。ステージを初めてクリアすると、tier に応じて ${DATA.flow.firstClear.map(g => g.toLocaleString()).join(' / ')} ゴールド(tier 1〜4)` },
    { k: 'goblin', t: _t('トレジャーゴブリン'), c: '基本', d: _t('逃げ回る敵。16秒で逃げてしまう。倒すと宝箱とたくさんのコイン') },

    // ===== 戦闘 =====
    { k: 'pow', t: _t('威力'), c: '戦闘', d: _t('ダメージのもとになる値。ここに攻撃力などの倍率が掛かる。カードやステータス画面では「威力 → 攻撃力を掛けた値」の順に出る') },
    { k: 'wpow', t: _t('武器の威力'), c: '戦闘', d: _t('その武器の今の威力(武器Lv・進化・熟練で上がる)。E の多くは「武器の威力 × n%」で、武器が強いほど強い') },
    { k: 'bpow', t: _t('基礎威力'), c: '戦闘', d: _t('武器によらない、決まった威力。Q や一部のクラスの効果はこれで決まる') },
    { k: 'atk', t: _t('攻撃力'), c: '戦闘', d: _t('全てのダメージに掛かる倍率') },
    { k: 'crit', t: _t('クリティカル率'), m: ['クリティカル率', 'クリティカル'], c: '戦闘', d: _t('クリティカルになる確率。クリティカルになると、クリティカルダメージの分だけダメージが増える') },
    { k: 'critdmg', t: _t('クリティカルダメージ'), c: '戦闘', d: _t('クリティカルのときに増えるダメージ(基本 +100% = 2倍)') },
    { k: 'area', t: _t('範囲'), c: '戦闘', d: _t('攻撃の半径・大きさの倍率(武器・スキルの両方に効く)') },
    { k: 'range', t: _t('射程'), c: '戦闘', d: _t('飛ばす攻撃の届く距離と、狙う距離の倍率') },
    { k: 'itv', t: _t('攻撃間隔'), c: '戦闘', d: _t('武器が通常攻撃をする間隔(秒)。クールダウン・攻撃速度で短くなる') },
    { k: 'aspd', t: _t('攻撃速度'), c: '戦闘', d: _t('全ての武器の通常攻撃の速さ。主にクラスの効果で上がる。E / Q の CD には効かない') },
    { k: 'cdstat', t: _t('クールダウン'), c: '戦闘', d: _t('ステータス。全ての武器の攻撃間隔と、E / Q の CD を短くする') },
    { k: 'cd', t: 'CD', c: '戦闘', d: _t('スキルを使ってから、もう一度使えるようになるまでの時間') },
    { k: 'shots', t: _t('弾数'), c: '戦闘', d: _t('全ての武器の弾の数を増やす') },
    { k: 'earea', t: _t('攻撃範囲'), c: '戦闘', d: _t('敵の攻撃(予告・当たり判定・弾・床)の大きさの倍率。エリートやカオス強化で広がる') },
    { k: 'pierce', t: _t('貫通'), c: '戦闘', d: _t('弾が敵を貫ける数。貫通 n なら n + 1 体まで当たる') },
    { k: 'acc', t: _t('命中率'), c: '戦闘', d: _t('自分の攻撃が当たる確率。砂塵・暗闇で下がる。外れると「MISS」と出て、ダメージも当たったときの状態異常効果も出ない(弾はそのまま抜ける)。炎上などの毎秒のダメージは外れない') },
    { k: 'normal', t: _t('通常攻撃'), c: '戦闘', d: _t('武器が一定の間隔で自動で行う攻撃。狙いは一番近い敵') },
    { k: 'hit', t: _t('被弾'), c: '戦闘', d: _t('敵の攻撃を受けること。被弾した後は少しの間 無敵になる(無敵時間)') },
    { k: 'taken', t: _t('被ダメージ'), c: '戦闘', d: _t('自分や敵が受けるダメージ。自分の「被ダメージ −n%」は受けるダメージを減らす。敵の「被ダメージ +n%」は印・凍結・侵蝕などで増える') },
    { k: 'inv', t: _t('無敵'), c: '戦闘', d: _t('ダメージと状態異常を受けない状態。防御スキルの使い始めや、被弾の直後などに起きる') },
    { k: 'warn', t: _t('予告'), c: '戦闘', d: _t('敵の攻撃が来る場所を示す赤い円・帯。予告が消えた瞬間に攻撃が当たる') },
    { k: 'elite', t: _t('エリート'), c: '戦闘', d: () => { const L = DATA.enemyLevel; return _t`金色に光る強い敵(大きさ ×2)。HP ×${L.elite}、攻撃力 ×${L.eliteDmg}、攻撃の頻度 ×${L.eliteRate}、攻撃範囲 ×${L.eliteArea}。倒すと宝箱を落とす`; } },
    { k: 'boss', t: _t('ボス'), c: '戦闘', d: _t('ステージの最後に出る強敵。押し返し・引き寄せが効かない。HP が減ると激昂する') },
    { k: 'breakable', t: _t('壊せる物'), c: '戦闘', d: _t('ボスが出す物のうち、金色の HP バーと足元の金色の輪があるもの。攻撃で壊すと、その物の効果が止まる(ボスがひるむものもある)') },
    { k: 'enrage', t: _t('激昂'), c: '戦闘', d: _t('ボスの HP が 60% を切ると怒り、技が強く・速くなる') },
    { k: 'stun', t: _t('スタン'), c: '戦闘', d: _t('一定の時間、動けず攻撃もしなくなる') },
    { k: 'kb', t: _t('押し返す'), m: ['押し返す', '押し返し', '吹き飛ばす', '吹き飛ばし'], c: '戦闘', d: _t('敵を後ろへ押しやる。ボスには効かない') },

    // ===== 生存 =====
    { k: 'maxhp', t: _t('最大HP'), c: '生存', d: _t('HP の上限。HP が 0 になると倒れる') },
    { k: 'regen', t: _t('HP回復速度'), c: '生存', d: _t('1秒あたりに回復する HP') },
    { k: 'heal', t: _t('被回復量'), m: ['被回復量', '回復量アップ'], c: '生存', d: _t('自分が受ける回復の倍率(肉・スキル・HP回復速度など全ての回復に効く)') },
    { k: 'over', t: _t('超過回復'), c: '生存', d: _t('HP が満タンを超えた分の回復。クラスによってはシールドや祈りになる') },
    { k: 'shield', t: _t('シールド'), c: '生存', d: _t('HP より先にダメージを受ける。時間で消えるものもある') },
    { k: 'def', t: _t('防御力'), c: '生存', d: _t('被ダメージから、その値をそのまま引く') },
    { k: 'dr', t: _t('ダメージ軽減'), c: '生存', d: _t('被ダメージを % で減らす') },
    { k: 'ifr', t: _t('無敵時間'), c: '生存', d: () => _t`被弾した後に無敵になる時間(基本 ${DATA.player.iframe}秒)。一部のボスの技は、無敵時間を無視して続けて当たる(防御スキルの無敵では防げる)` },
    { k: 'sta', t: _t('スタミナ'), c: '生存', d: _t('防御スキル(SPACE)に使う。時間で回復する。ガードで受けると、少しの間 回復が止まる') },
    { k: 'staregen', t: _t('スタミナ回復速度'), c: '生存', d: _t('1秒あたりに回復するスタミナ') },
    { k: 'guard', t: _t('ガード'), c: '生存', d: _t('SPACE を押している間、構えて攻撃を受け止める(HP の代わりにスタミナで受ける)。防御スキルがガードのクラスで使える') },
    { k: 'gbreak', t: _t('ガードブレイク'), c: '生存', d: _t('ガード中にスタミナが 0 になると起きる。しばらくガードできず、被ダメージが増える') },
    { k: 'spd', t: _t('移動速度'), c: '生存', d: _t('歩く速さの倍率') },

    // ===== 状態異常 =====
    { k: 'burn', t: _t('炎上'), c: '状態異常', d: () => { const d = DATA.debuff; return _t`${d.burnTick}秒ごとにダメージを受け続ける(${d.burnDur}秒)。敵は何度も付けるほど重なって強くなる。自分が炎上している間は HP回復 −${pct(1 - d.burnHeal)}`; } },
    { k: 'frost', t: _t('凍傷'), c: '状態異常', d: () => { const d = DATA.debuff; return _t`敵: 1スタックにつき移動速度 −${pct(d.frostSlow)}(最大 −80%)。しばらく受けないと消える。自分: 1スタックにつき移動速度 −${pct(d.pFrostSlow)}。${d.pFrostMax}スタックで凍結して 0 に戻る(${d.pDur}秒 受けないと消える)`; } },
    { k: 'freeze', t: _t('凍結'), c: '状態異常', d: () => { const d = DATA.debuff; return _t`敵: 一部のクラスの特性で、凍傷が上限に達すると凍って動けなくなる(ボスは攻撃が遅くなるだけ)。自分: 凍傷が ${d.pFrostMax}スタックになると ${d.pFrzT}秒 凍りつき、動けず、攻撃、回避、スキルができない。凍結の間は凍傷が付かない`; } },
    { k: 'bleed', t: _t('出血'), c: '状態異常', d: () => { const B = DATA.bleed, d = DATA.debuff; return _t`敵: 1スタックにつき毎秒 最大HP の ${pct(B.pct)} のダメージ(ボス ×${B.boss}、エリート ×${B.elite})、${B.dur}秒。自分: 1スタックにつき毎秒 最大HP の ${pct(d.pBleed)}(最大 ${d.pBleedMax}スタック、${d.pDur}秒で消える。防御力・シールドでは減らない)`; } },
    { k: 'shock', t: _t('感電'), c: '状態異常', d: () => _t`当たった敵から、近く(距離 ${DATA.debuff.shockR})の敵へ雷が連鎖して、与えたダメージの一部を与える。「感電 n%」は連鎖したダメージの割合` },
    { k: 'slow', t: _t('鈍足'), m: ['鈍足', '減速'], c: '状態異常', d: () => _t`移動速度 −${pct(1 - DATA.debuff.slow)}(粘液など)。重なったときは強い方だけ効く` },
    { k: 'slowtime', t: _t('スロウタイム'), c: '状態異常', d: () => { const d = DATA.debuff; return _t`移動速度 −${pct(1 - d.slow)}・CD の回復 −${pct(1 - d.cdRate)}・スタミナ回復と HP回復速度 −${pct(1 - d.slowRegen)}`; } },
    { k: 'warp', t: _t('時の歪み'), c: '状態異常', d: _t('砂時計の精が作る時計盤の床。中にいる間はスロウタイムと同じ効果(移動速度は ×0.7)') },
    { k: 'poison', t: _t('毒'), c: '状態異常', d: () => { const d = DATA.debuffTomb; return _t`1スタックにつき最大HP −${Math.round(d.poison * 100)}%(最大 ${d.poisonMax}スタック)。今の HP も同じだけ減る(毒では倒れない)。受けないでいると ${d.poisonDur}秒で消え、最大HP は戻る(減った HP は戻らない)`; } },
    { k: 'dark', t: _t('暗闇'), c: '状態異常', d: () => _t`${DATA.debuffTomb.darkDur}秒、周りが暗くなり、敵の攻撃の予告が見えない。命中率 −${pct(DATA.debuffTomb.darkHit)}` },
    { k: 'fatigue', t: _t('疲労'), c: '状態異常', d: () => { const d = DATA.debuff; return _t`敵の攻撃でスタミナを減らされると ${d.fatigueDur}秒、スタミナ回復 −${pct(1 - d.fatigue)}`; } },
    { k: 'numb', t: _t('痺れ'), c: '状態異常', d: () => { const s = DATA.debuffStage; return _t`1スタックにつき CD の回復 −${pct(s.numbCd)}(武器の攻撃間隔と E / Q)。${s.numbMax}スタックで麻痺して 0 に戻る(${DATA.debuff.pDur}秒 受けないと消える)`; } },
    { k: 'para', t: _t('麻痺'), c: '状態異常', d: () => { const s = DATA.debuffStage; return _t`痺れが ${s.numbMax}スタックになると ${s.paraT}秒、攻撃できない。E / Q の CD は最初からになる。麻痺の間は痺れが付かない`; } },
    { k: 'dust', t: _t('砂塵'), c: '状態異常', d: () => { const s = DATA.debuffStage; return _t`1スタックにつき命中率 −${pct(s.dustHit)}(最大 ${s.dustMax}スタック。${DATA.debuff.pDur}秒 受けないと消える)`; } },
    { k: 'rlight', t: _t('乱光'), c: '状態異常', d: _t('それ自体に効果はなく、凍傷・痺れ・砂塵・衰弱・出血・毒・炎上・暗闇・疲労のどれかがランダムに付く') },
    { k: 'lock', t: _t('攻撃不能'), c: '状態異常', d: _t('攻撃できない。麻痺と違って E / Q の CD は戻らない') },
    { k: 'dazzle', t: _t('眩惑'), c: '状態異常', d: () => { const z = DATA.enemies.lightmoth.dazzle; return _t`光の蝶が近くで光ると ${z.t}秒、与えるダメージ −100%(当たったときの効果は出る)。切れてから ${z.imm}秒は眩惑にならない`; } },
    { k: 'weak', t: _t('衰弱'), c: '状態異常', d: () => { const s = DATA.debuffStage; return _t`1スタックにつき攻撃力 −${pct(s.weakAtk)}(最大 ${s.weakMax}スタック。与えるダメージが下がる。${DATA.debuff.pDur}秒 受けないと消える)`; } },

    // ===== スキル・成長 =====
    { k: 'eskill', t: _t('武器スキル'), m: ['武器スキル', 'E'], c: 'スキル・成長', d: _t('E キーで使う、メイン武器の技。設定で自動発動にもできる') },
    { k: 'qskill', t: _t('クラススキル'), m: ['クラススキル', 'Q'], c: 'スキル・成長', d: _t('Q キーで使う、クラスの技。武器によらない基礎威力で決まるものが多い') },
    { k: 'space', t: _t('防御スキル'), m: ['防御スキル', 'SPACE', 'Space'], c: 'スキル・成長', d: _t('SPACE で使う、クラスごとの身を守る技(回避・ガードなど)。スタミナを使う') },
    { k: 'windup', t: _t('構え'), m: ['構え', '予備動作'], c: 'スキル・成長', d: _t('スキルを出す前の短い時間。この間は動けない') },
    { k: 'auto', t: _t('自動発動'), c: 'スキル・成長', d: _t('設定で ON にすると、周りに敵が集まっているときに E / Q を自動で使う') },
    { k: 'trait', t: _t('特性'), c: 'スキル・成長', d: _t('クラスごとの仕組み(剣気・元素循環など)。クラス強化で強くなる') },
    { k: 'passive', t: _t('パッシブ'), c: 'スキル・成長', d: _t('クラスごとの常に効く効果。クラス強化で強くなる') },
    { k: 'clsup', t: _t('クラス強化'), m: ['クラス強化', 'CLASS UP'], c: 'スキル・成長', d: _t('3の倍数の Lv で選ぶ。特性・パッシブ・Q・E の強化パスを1つ Lv を上げる') },
    { k: 'path', t: _t('強化パス'), m: ['強化パス', 'パス'], c: 'スキル・成長', d: _t('クラス強化の項目。それぞれ Lv1〜3') },
    { k: 'sp', t: _t('特殊強化'), m: ['特殊強化', 'SPECIAL'], c: 'スキル・成長', d: _t('強化パスを Lv3 にすると候補に出る、効果が変わる強化。特性・パッシブ・Q・E ごとに 1つだけ取れる') },
    { k: 'mainw', t: _t('メイン武器'), c: 'スキル・成長', d: _t('クラスの武器。武器スキル(E)が使える。クラスLv15 で、ほかのクラスの武器に切り替えられる') },
    { k: 'subw', t: _t('サブ武器'), c: 'スキル・成長', d: _t('ラン中に手に入れた、メイン武器以外の武器。通常攻撃だけをする(クラスの効果には「メイン武器だけ」のものがある)') },
    { k: 'wslot', t: _t('武器枠'), c: 'スキル・成長', d: _t('同時に持てる武器の数(メイン武器を含む)') },
    { k: 'evo', t: _t('進化'), c: 'スキル・成長', d: _t('武器を Lv5 にすると、進化のカードが出る(その武器のクラスの Lv が 10 以上のとき)。進化すると性能が大きく上がり、効果が増える') },
    { k: 'clv', t: _t('クラスLv'), m: ['クラスLv', 'クラス経験値'], c: 'スキル・成長', d: () => _t`ランの終わりに、倒した数 + 倒したボス × ${DATA.classLevel.bossK} のクラス経験値が入る。Lv が上がると、そのクラスの専用の強化と、武器の熟練が解放される` },
    { k: 'mastery', t: _t('熟練'), m: ['熟練', '共通'], c: 'スキル・成長', d: _t('武器の強化。その武器を専用にしているクラスの Lv で解放され、どのクラスがその武器を使っても効く') },

    // ===== 装備・永続 =====
    { k: 'equip', t: _t('装備'), c: '装備・永続', d: _t('武器・防具・指輪の3つの枠。ラン外の装備画面で付け替える。宝箱・ガチャで手に入る') },
    { k: 'rarity', t: _t('レアリティ'), c: '装備・永続', d: () => _t`${Object.values(DATA.equip.rarity).map(r => r.name).join(' → ')}。高いほどオプションが多い` },
    { k: 'opt', t: _t('オプション'), c: '装備・永続', d: _t('装備に付くステータスの効果。ランの開始時は Lv0 で、装備カードで Lv が上がる(最大Lv はオプションごとに違う)') },
    { k: 'uq', t: _t('固有効果'), c: '装備・永続', d: _t('装備に付くことがある特別な効果(★で表示)') },
    { k: 'eqq', t: _t('装備品質'), c: '装備・永続', d: _t('宝箱から出る装備のレアリティが高くなりやすい(ガチャのレアリティの確率は変わらない)') },
    { k: 'chq', t: _t('宝箱品質'), c: '装備・永続', d: _t('宝箱から出る装備の数(1〜3個)が多くなりやすい') },
    { k: 'eqmaxval', t: _t('装備ロール上限'), m: ['装備ロール上限', '装備最大値'], c: '装備・永続', d: _t('装備のオプションの値は、手に入れたときに装備の種類ごとの範囲からランダムに決まる。その範囲の上限が +n% 伸びて、より高い値が出るようになる(下限は変わらない)。カオス強化の報酬で上がり、そのランで手に入れた装備に効く') },
    { k: 'eqmaxlv', t: _t('装備Lv上限'), m: ['装備Lv上限', '装備最大Lv'], c: '装備・永続', d: () => _t`装備のオプションの最大Lv は、手に入れたときに ${DATA.equip.maxLv[0]}〜${DATA.equip.maxLv[1]} からランダムに決まる。その上限が +n される(最大Lv が高いほど、装備カードで長く伸ばせる)。カオス強化の報酬で上がり、そのランで手に入れた装備に効く` },
    { k: 'tree', t: _t('強化ツリー'), c: '装備・永続', d: _t('ゴールドで、ずっと残るステータスの強化を買う') },
    { k: 'gacha', t: _t('ガチャ'), c: '装備・永続', d: () => _t`ゴールドで装備を引く(1回 ${DATA.gacha.tiers.map(T => `${T.name} ${T.price}G`).join(' / ')}。${DATA.gacha.multi}連は ${DATA.gacha.multi}倍)。高いガチャほどロール値・最大Lv の上限が高い。レアリティの確率はどれも同じ` },
    { k: 'mythic', t: _t('ミシック'), c: '装備・永続', d: () => _t`一番上のレアリティ。ガチャ(${DATA.gacha.rates.mythic}%)と宝箱(${DATA.equip.rarity.mythic.w}%)で出る。レジェンダリーと同じく固有効果が付き、全オプションが上限。強化の余地はない` },
    { k: 'chaos', t: _t('カオス強化'), c: '装備・永続', d: _t('モード・ステージごとに敵を強くする設定。ポイントが高いほど装備とゴールドの報酬が増える。初めてクリアするまでは tier ごとに決まった値で固定') },
    { k: 'magnetst', t: _t('吸引範囲'), c: '装備・永続', d: _t('経験値の宝石が自分へ飛んでくる距離') },
    { k: 'xpst', t: _t('経験値'), c: '装備・永続', d: _t('ステータスの「経験値」は、宝石から得る経験値の倍率') },
    { k: 'goldst', t: _t('獲得ゴールド'), c: '装備・永続', d: _t('手に入るゴールドの倍率') },
    { k: 'rerollst', t: _t('リロール回数'), c: '装備・永続', d: _t('1回のランでカードを引き直せる回数') },
    { k: 'pick1', t: _t('クラス強化選択枠'), c: '装備・永続', d: _t('クラス強化のカードの枚数を増やす') },
    { k: 'pick2', t: _t('武具強化選択枠'), c: '装備・永続', d: _t('武器カード・装備カードの枚数を増やす') },
    { k: 'food', t: _t('食べ物の効果'), c: '装備・永続', d: _t('肉で回復する量の倍率') },
    { k: 'foodCleanse', t: _t('食べ物でデバフ解除'), c: '装備・永続', d: _t('肉を拾うと、炎上・凍傷・出血・減速・スロウタイム・凍結・疲労・毒・暗闇が消える') },
    { k: 'itemRate', t: _t('アイテム出現率'), c: '装備・永続', d: _t('敵や置物から出るアイテム(コイン・肉・磁石・爆弾。装備宝箱は除く)の数の倍率。100% を超えた分は、その確率でもう1つ出る') },
    { k: 'eqInit', t: _t('装備初期レベル'), c: '装備・永続', d: _t('ランを始めたとき、装備のオプションがそれぞれこの確率で +1Lv から始まる。100% で全て +1Lv、150% なら全て +1Lv に加えて 50% でさらに +1Lv(最大Lv まで)') },
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
      if (b.key === _t('通常攻撃')) return;
      const names = new Set([b.name]);
      for (const sp of ['・', ': ']) if (b.name.includes(sp)) { const s = b.name.split(sp)[0]; if (s.length >= 2) names.add(s); } // 居合・朧月 → 居合(英語は Iai: Oborozuki → Iai)
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
  const HANGUL = /[가-힣]/; // 韓国語: 用語の前だけ区切る(後ろには助詞が付く: 독을・독에)
  const bound = s => {
    if (ascii(s)) return `(?<![A-Za-z0-9])${esc(s)}(?![A-Za-z0-9])`;
    return (KANA.test(s[0]) ? '(?<![ァ-ヺー])' : HANGUL.test(s[0]) ? '(?<![가-힣])' : '') + esc(s) + (KANA.test(s[s.length - 1]) ? '(?![ァ-ヺー])' : '');
  };
  // 英語: 区切りは英数字。大文字で始まる単語は頭文字の大小を問わない(Max HP / max HP)。小文字で終わる用語は複数形の s が付いてもよい
  const lowerFirst = s => s.replace(/(^|\s)([A-Z])(?=[a-z])/g, (a, b, c) => b + c.toLowerCase());
  const boundEn = s => `(?<![A-Za-z0-9])${s.split(/(\s+)/).map(w => (/^[A-Za-z][a-z]/.test(w) ? `[${w[0].toUpperCase()}${w[0].toLowerCase()}]${esc(w.slice(1))}` : esc(w))).join('')}${/[a-z]$/.test(s) ? 's?' : ''}(?![A-Za-z0-9])`;
  // 印を付ける書き方: 日本語は m(既定は見出し)。ほかの言語は I18N.terms[k](なければ見出し。m: [] のものは付けない)
  const termsOf = e => (I18N.tr ? I18N.terms[e.k] || (e.m && !e.m.length ? [] : [e.t]) : e.m || [e.t]);
  const baseTerms = [];
  for (const e of G) for (const s of termsOf(e)) baseTerms.push({ s, key: 'g:' + e.k });
  function matcher(extra) {
    const list = [...extra, ...baseTerms]; // クラスの用語を先に(同じ書き方なら、クラスの意味を優先)
    const nk = I18N.en ? lowerFirst : s => s, map = {}, pat = {};
    for (const x of list) {
      const exact = I18N.en && x.s[0] === '=', s = exact ? x.s.slice(1) : x.s, k = nk(s); // 英語の = は大小をそのまま比べる
      if (k in map) continue;
      map[k] = x.key;
      pat[k] = !I18N.en ? bound(s) : exact ? `(?<![A-Za-z0-9])${esc(s)}(?![A-Za-z0-9])` : boundEn(s);
    }
    const ss = Object.keys(map).sort((a, b) => b.length - a.length); // 長いものから(最大HP を HP より先に)
    const re = new RegExp(ss.map(k => pat[k]).join('|'), 'g');
    return { re, look: m => map[nk(m)] ?? (I18N.en ? map[nk(m).replace(/s$/, '')] : undefined) };
  }
  // root の中の説明文に印を付ける。o.cls: クラスの用語も / o.run: ラン中の値で / o.per: この子要素ごとに「最初の1回だけ」を数える
  function glossify(root, o = {}) {
    if (!root) return;
    const { re, look } = matcher(classTerms(o.cls, o.run));
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
          const key = look(m[0]);
          if (!key || seen.has(key)) continue; // 同じ用語は最初の1回だけ(印だらけにしない)
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
    [_t('WASD / 矢印'), _t('移動')],
    [_t('(自動)'), _t('通常攻撃。武器ごとの間隔で、一番近い敵を狙う')],
    ['SHIFT', _t('マウス照準の ON / OFF(ON のときは通常攻撃・スキルがマウスの方向へ)')],
    ['E', _t('武器スキル(メイン武器の技)')],
    ['Q', _t('クラススキル')],
    ['SPACE', _t('防御スキル(長押しで構えるクラスもある)')],
    ['TAB', _t('ステータス(ラン中)')],
    ['ESC', _t('ポーズ / 戻る')],
    ['M', _t('音のミュート')],
    [_t('1〜3 / R'), _t('レベルアップのカードを選ぶ / リロール')],
  ];
  const TOUCH_KEYS = [ // スマホ(core.js の TOUCH_UI)の操作。ボタンの字(SPACE・E・Q・II)をそのまま見出しに
    [_t('指'), _t('移動(ボタン以外の所に指を置いて動かす。置いた所が中心)')],
    [_t('(自動)'), _t('通常攻撃。武器ごとの間隔で、一番近い敵を狙う')],
    ['E', _t('武器スキル(メイン武器の技)')],
    ['Q', _t('クラススキル')],
    ['SPACE', _t('防御スキル(長押しで構えるクラスもある)')],
    ['II', _t('ポーズ(ステータス・ガイド・設定もここから)')],
    [_t('タップ'), _t('レベルアップのカードを選ぶ・下線の用語の説明を出す')],
  ];
  const FLOW = [
    [_t('出撃'), _t('START からステージを選ぶ。クラスはクラス画面で選ぶ(クラスごとにメイン武器・スキルが違う。はじめは4クラスで、ステージ・モードをクリアすると増える)')],
    [_t('戦う'), _t('移動して敵の攻撃を避ける。攻撃は自動。赤い予告の円・帯が出たら、そこから離れる')],
    [_t('育てる'), _t('経験値の宝石を拾ってレベルアップ。武器を増やして Lv を上げ、3の倍数の Lv ではクラス強化を選ぶ')],
    [_t('スキル'), _t('E(武器スキル)・Q(クラススキル)は CD が明けたら使える。SPACE(防御スキル)はスタミナを使う')],
    [_t('フェーズ'), _t('3分ごとにエリート戦・ボス戦。最後のボスを倒すとクリア')],
    [_t('持ち帰る'), _t('ランが終わると、ゴールド・装備・クラス経験値が残る。ゴールドは強化ツリー・ガチャで使い、装備は装備画面で付ける')],
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
    $('hp-cats').innerHTML = ['操作', '遊び方', ...CATS].map(c => `<button class="${!q && c === cat ? 'on' : ''}" data-c="${c}">${_t(c)}</button>`).join(''); // 分類の名前は ID(表示だけ訳す)
    let h = '';
    if (q) { // 検索: 全ての用語から(見出し・説明。英字の大小は区別しない)
      const ql = q.toLowerCase(), has = s => String(s).toLowerCase().includes(ql);
      const hit = G.filter(e => has(e.t) || termsOf(e).some(has) || has(descOf(e)));
      h = hit.length ? hit.map(ent).join('') : _t('<div class="dim">見つかりませんでした</div>');
    } else if (cat === '操作') h = (TOUCH_UI ? TOUCH_KEYS : KEYS).map(([k, d]) => `<div class="hp-key"><kbd>${k}</kbd><span>${d}</span></div>`).join('') + _t('<div class="dim hp-note">設定(タイトル・ポーズ画面)で、E / Q の自動発動・スキルのカットイン・攻撃の濃さ・UI サイズを変えられます</div>');
    else if (cat === '遊び方') h = FLOW.map(([k, d], i) => `<div class="hp-ent"><b>${i + 1}. ${k}</b><div>${d}</div></div>`).join('') + (TOUCH_UI ? _t('<div class="dim hp-note">用語をタップすると説明が出ます</div>') : _t('<div class="dim hp-note">用語にマウスを乗せると説明が出ます</div>'));
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
