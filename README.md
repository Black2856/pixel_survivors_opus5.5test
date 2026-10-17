# PIXEL SURVIVORS: NOCTURNE

`pixel_survivors_fable5test` のフルリメイク。純粋な HTML / CSS / JS 製。開発中はビルドなしでそのまま動く(公開用だけ 1ファイルにまとめる)。

## 実行
mp3 読み込みのため静的サーバー経由で開く: `python -m http.server` → `http://localhost:8000/`

## 公開用ビルド
`npm ci` → `npm run build` で `dist/` に出す。index.html の `<script>` を順につないで 1つの関数で包み(名前がコンソールから見えない)、esbuild で小さくする。js・css のファイル名には中身のハッシュを入れる(更新したときに古いキャッシュを使わない)。
`release` に push すると GitHub Actions(`.github/workflows/pages.yml`)が同じビルドをして GitHub Pages に出す。

## 操作
WASD / 矢印: 移動 ・ SPACE: ダッシュ(無敵) ・ 攻撃は自動(SHIFT でマウス照準の ON/OFF 切替) ・ ESC: ポーズ ・ M: ミュート ・ レベルアップ時 1〜3 / R
タッチ: 画面左で仮想スティック、右タップでダッシュ

## 構成(読み込み順 = 依存順)
| ファイル | 役割 |
|---|---|
| `js/data.js` | バランス定義(敵・ボス・スケジュール・武器と進化・パッシブ・アーティファクト・永続強化・ステージ) |
| `js/lang/en.js` | 英語の辞書(キー = 日本語の文、値 = 英語) |
| `js/i18n.js` | 表示の言語(日本語 / English)。`_t` で表示する文を辞書から引く。DATA と index.html の文字を読み込み直後に置き換える |
| `js/art.js` | ASCII → ドット絵生成、自動アウトライン、発光マスク、最近傍回転フレーム、3x5 ピクセルフォント |
| `js/audio.js` | BGM クロスフェード + WebAudio シンセ効果音 |
| `js/gfx.js` | 低解像度 3 レイヤー(scene/light/glow) + WebGL2 ポストプロセス(ライティング・ブルーム・衝撃波・色収差・走査線) |
| `js/core.js` | 状態・永続データ・入力・演出ヘルパー・空間グリッド・ピクセル描画プリミティブ |
| `js/classes/` | クラス(1クラス 1ファイル: E スキル・特性・パッシブ・Q)/ `common.js` 共通 / `hooks.js` ゲームの側からの入口 |
| `js/world.js` ほか | ラン初期化・ステータス(`world.js`)/ `player.js` / `weapons.js` / `damage.js` / `enemies.js` / `phase.js` / `hazards.js` / `drops.js` / `spawner.js` / `rewards.js` |
| `js/bosses/` | ボス(1体 1ファイル: AI・技・描画)/ `common.js` 共通 |
| `js/render.js` | 地面チャンク生成・描画・ライトマップ(ボスの描画は各ボスのファイル) |
| `js/ui.js` / `js/main.js` | DOM UI / 画面遷移・メインループ |

## 主な新要素
- 武器進化(Lv5 + 対応パッシブで宝箱から進化)・宝箱開封演出
- ダッシュ、ブレイザー(破壊でアイテム)、トレジャーゴブリン、スライム分裂、弓兵
- ゴールドと永続強化ショップ(localStorage 保存)、武器別ダメージのリザルト

## 英語版(表示の言語)
設定の「🌐 言語」で日本語 / English / 简体中文 / 한국어 を切り替える(ページを読み直す。ラン中は変えられない)。未設定なら、ブラウザの言語(日本語・中国語・韓国語ならその言語、ほかの言語と取れないときは英語)。
文章は日本語で書いたまま、表示する所で `_t('文')` か ``_t`文 ${x} 文` `` を通し、英語を `js/lang/en.js` に足す(テンプレートのキーは `${…}` を `{0}` `{1}` … にした文)。`data.js` の文字列と `index.html` の文字は自動で置き換わるので、辞書に足すだけでよい。
`node scripts/i18n-check.js` で、訳がない文・差し込み(`{0}` など)の食い違い・使っていないキー・`_t` を通していない日本語を調べる。

## バランスデータの書き出し
`node scripts/export-data.js` で `js/data.js` の値を `balance/*.csv` に書き出す(生成物なので手で編集しない。調整は `data.js` で行い再実行)。
経験値曲線と敵Lv倍率の式はスクリプト内 `FORMULA` にゲーム側から写してあるため、`world.js` の式を変えたら合わせて更新する。
