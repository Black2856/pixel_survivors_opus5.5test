# PIXEL SURVIVORS: NOCTURNE — 作業の地図

素の HTML / CSS / JS のブラウザゲーム。開発中は index.html の `<script>` を順に読む(全部 グローバル。モジュールなし)。

## どこに何があるか
- 数値・文: `js/data.js` の `DATA`(classes / weapons / bosses / enemies / stages / stageRuns / flow …)。値は `node scripts/dev/data.js classes.knight.params` で引ける(長い行を読まない)
- クラス: `js/classes/<クラス>.js`(1クラス 1ファイル: その武器の E スキル `WEAPON_SKILL.<武器>` → `CLASS_RT.<クラス>`(特性・パッシブ・Q)→ そのクラスの関数。仕様書 `claudedocs/classes/<名前>.md` と同じ単位)
  - 共通は `classes/common.js`(スタミナ・強化ツリーの値 cuV / hasSp・E / Q の共通)、ゲームの側からの入口は `classes/hooks.js`(`cls*`: `clsShieldMod` `clsResistDebuff` など)。クラス名で分ける所をゲームの側に作らない
  - クラスのファイルの読み込み順 = WEAPON_SKILL の並び(hooks.js の WS_TAKEN がこの順に掛ける)。足すときは末尾に
- ラン: `js/world.js`(ラン初期化・ステータス・カオス強化・敵Lv)/ `player.js` / `weapons.js`(自動攻撃・弾・ゾーン)/ `damage.js`(hitEnemy・撃破)/ `enemies.js`(出現・通常敵)/ `phase.js`(ボスの撃破・フェーズ)/ `hazards.js`(敵弾・ボスの床などの動きと当たり)/ `drops.js` / `spawner.js`(出現・闘技場)/ `rewards.js`(レベルアップの選択肢)
- ボス: `js/bosses/common.js`(makeBoss・spawnBoss・eball・later・壊せる物・`bossAI` の分岐)と `js/bosses/<キー>.js`(1体 1ファイル。キーは DATA.bosses。死神と終刻の死神は reaper.js、分裂した犬は cerberus.js)
- 描画: `js/render.js` の `render()`(地面 → 自分の攻撃(地面側)→ ボスの設置物 → ジェム → 敵 → 自分 → 自分の攻撃(手前)→ 敵の攻撃・予兆 → 数値)、ボスの技は `drawBossFx` / `drawBfx`、熾天使は `drawSer*`
- 絵: `js/art.js`(ASCII のドット絵)/ 光の層: `js/gfx.js`(scene・light・glow・over + WebGL の仕上げ)
- 画面: `js/ui.js`(ラン中)/ `js/meta-ui.js`(ラン外)/ `js/status-ui.js` / `js/gacha.js` / `js/help.js`(用語集)
- 仕様書(ユーザーが直接直す): `claudedocs/enemies.md`・`claudedocs/classes/*.md`

## 決まり
- 改行は CRLF(js / md / css / html。`core.autocrlf=true`)。書いたら `node scripts/dev/eol.js`(`--fix` でそろえる)。sed -i は使わない
- 表示する日本語は `_t` を通し、訳を `js/lang/en.js`・`zh.js`・`ko.js` に足す(キー = 日本語の文)。`node scripts/i18n-check.js` で抜けを見る。DATA の文は読み込み時にまるごと訳す
- `claudedocs/db.xlsx` はユーザーの物。ステージもコミットもしない
- 作業は feature ブランチ。`release` は公開元(GitHub Pages)で、マージだけ。マージはユーザーに言われた時だけ

## ビルド・公開
- `npm run build` → `dist/`(index.html の `<script>` を順につなぎ、1つの関数で包んで esbuild で小さくする)。新しい js は index.html に `<script>` を足せばビルドにも入る
- release に push → `.github/workflows/pages.yml` がビルドして Pages に出す(手で POST しなくてよい)
- 公開版はコンソールから `P` などが見えない。小さくして動きが変わらないかは `node scripts/build.js --no-wrap`(包まない版)を `http://127.0.0.1:8765/dist/` で開き、試験の通しのハッシュを開発版と比べる

## 試験
- 道具: `scripts/dev/harness.js`(使い方は先頭のコメント)。`python -m http.server 8765 --bind 127.0.0.1` を立て、Playwright の `browser_run_code_unsafe` に `filename: scripts/dev/open.pw.js` で開く → `T.setup` / `T.step` / `T.boss` で手で進める
- 通し: `T.classSmoke()`(全クラス × 特殊強化 3通り、約 8秒)・`T.bossSmoke()`(全ステージのボス、約 20秒)→ 例外の数とハッシュ
- 動かすだけのリファクタリングは、前後でハッシュが同じか比べる。ページを開き直して `classSmoke()` → `bossSmoke()` の順に呼ぶ(初回だけ作るキャッシュがあるので順番をそろえる)
- 試験はセーブに書かない(T.init が saveMeta を止める)。公開版を手で遊ばせるときは先にセーブ(localStorage)を写し、`/scripts/`(ゲームを読まないページ)で戻す。終わったらサーバーを止め、`.playwright-mcp/` を消す
- 遊ばせても時計が進まないときは rAF が止まっている(この環境で起きる)。`page.bringToFront()` してから
