# しくみ（ファイル・データ・進行・確かめ方）

## 1. 作り

- `index.html` の1ページに全部の画面（view）がある。
  - 画面の切り替えは `App.Ui.showView(App.Ui.views.xxx)`。
  - 画面の名前の例: `selectType`, `creator`, `hostControl`, `viewerMain`, `playerGame`
- ビルドは無い。素のJSとCSSを `<script>` / `<link>` で読み込む。読み込む順に意味があり、後から読むものが前のものに手を足す形が多い。
- **キャッシュ対策**: `?v=N` の数字を、変えたファイルの分だけ上げる。
  ```
  for f in a.js b.css; do v=$(grep -o "$f?v=[0-9]*" index.html | head -1 | cut -d= -f2); sed -i "s/$f?v=$v\"/$f?v=$((v+1))\"/" index.html; done
  ```
- **公開**: `main` に push すると、GitHub Actions（`.github/workflows/firebase-hosting-merge.yml`）が Firebase Hosting の本番に出す。プルリクエストでは、お試しのURLが出る。

## 2. 主なオブジェクトとファイル

| 役割 | オブジェクト | ファイル |
|---|---|---|
| 共通の土台・画面切り替え・画像の受け渡し・伸びる入力欄 | `App.Ui`, `App.State`, `App.Data`, `App.SetImages`, `App.GrowText` | host_core.js |
| 作成画面（共通） | `App.Creator` | host_creator.js |
| 作成画面（スマホ） | `App.CreatorMobile`（一覧・1問の入力・セットの設定・下から出るシート） | creator_mobile.js |
| 作成画面（PC 3列） | `App.CreatorDesktop` | creator_desktop.js |
| ルール設定（形式の次） | `App.PlayStyle` | play_style.js |
| ルールの相性・得点・順位・今のルールの文 | `App.RuleEngine` | rule_engine.js |
| ルールのシート（5つのタブ） | `App.RulePanel`（部品: tiles/row/select/num/note） | rule_panel.js |
| ルールの古い部品（早押しの細かい設定など） | `App.Config` | host_config.js |
| デザインのシート | `App.Design` | host_design.js |
| テーマ・書体・文字の飾り・テーマの値 | `App.Themes`（`apply`, `applyToElement`, `setTokens`, `forQuestion`, `FONTS`, `TEXT_FX`） | theme_presets.js |
| 選択式の見せ方 | `App.ChoiceSkin` | choice_skin.js |
| 正解表示・判定演出・問題ごとの欄 | `App.Reveal` | reveal.js |
| 司会者の進行 | `App.Studio`（`setStep`, `judgeBuzz`, `goNext` …） | host_studio.js |
| 司会者の本番中の部品（時計・判定・1つ戻る・得点） | `App.HostConsole` | host_console.js |
| 待合室 | `App.HostLobby` | host_lobby.js |
| モニター | `App.Viewer`（`render(st)`, `renderQuestionLayout`, `renderDecor` …） | viewer.js |
| 解答者 | 関数の集まり | player.js |
| パネル指名・パネルクイズ | `App.PanelBoard` | panel_board.js |
| 陣取りパネル | `App.Territory` | territory.js |
| バラエティ枠 | `App.VarietyFrame` | variety_frame.js |
| 別のセットからの取り込み | `App.SetMerge` | set_merge.js |
| 画面の中のダイアログ | `App.Dialog`（`confirm` / `alert` / `prompt` / `number`） | dialog.js |
| お試し（プレビューの「お試し」— 1問をその場で遊ぶ） | `App.Trial` | trial.js |
| 端末の中だけのデータベース（お試し用） | `LocalDb`（`createStore` / `client`） | local_db.js |
| アイコン | `App.Icons.svg(name)` | icons.js |
| タイマーの見た目 | `App.TimerView` | timer_view.js |
| 第○問の演出 | `App.BridgeView` | bridge_view.js |

CSS:
- `style_common.css`: モニター・プレビュー共通、テーマ固有の形、文字の飾り
- `style_host.css`: 作成画面・司会者画面
- `style_viewer.css`: モニター。テーマの値で描く画面、正解表示
- `style_player.css`: 解答者
- `choice_skin.css`, `panel_board.css`, `rule_panel.css`

## 3. データ（Firebase Realtime Database）

```
rooms/{roomId}/
  config        … セットのルール（currentConfig。正解表示の値もここ）
  questions[]   … 問題（各問題に design がコピーされる。画像は '@img:N' の参照）
  images[]      … 背景・ロゴ・音の data URL（App.SetImages.pack / unpack）
  status        … 進行の状態（下の表）
  players/{pid} … name, periodScore, totalScore, lastAnswer, lastResult('win'|'lose'), buzzTime, isAlive …
saved_sets/{showId}/{key}     … 保存したセット（title, config, questions, images）
saved_sets_meta/{showId}      … 一覧用
saved_programs/{showId}       … 番組（セットの並び）
sound_library, app_defaults   … 音の候補・既定
```

- `showId` は「番組ID」（ログインが無いので、今はこれが持ち主の代わり）。
- **書き込む値に `undefined` を入れない**。Firebase がエラーにする。消したい時は `null` を入れる。保存の前に `stripUndef` を通している。

**`status.step`（司会者の setStep と対応）**

| step | 中身 |
|---|---|
| `standby` | 待合室・タイトル |
| `reveal_q_num` | 第○問（ブリッジ） |
| `reveal_q` / `answering` | 出題中（`currentAnswerer`, `isBuzzActive`, `timer`, `answerTimer`, `judgeCue` …） |
| `closed` | 締め切り（TIME UP） |
| `reveal_player` | 正解者発表（`resultShowWinners`, `resultWinners`）／解答オープン（`displayMode`: `flip` / `distribution`） |
| `reveal_correct` | 正解表示（`correct`, `commentary`, `revealWinners`, `revealGains`, `revealedMulti`） |
| `intermediate_ranking` / `final_ranking` / `elimination` | 順位・脱落（`eliminationData`） |
| `panelboard`, `numgame`, `bj_result` … | ゲームごと |

司会者側の `setStep(n)`:
- 0: タイトル
- 1: 第○問
- 2: 出題中（3: 締め切り）
- 4: 解答オープン／正解者発表
- 5: 正解表示
- そのあと結果、`goNext()` で次の問題へ

## 4. 正解表示のつながり（例）

1. 司会者が `judgeBuzz(true)` を呼ぶ。
2. 得点が入り、`recordWinner(pid, name, gain)` が記録する。
3. `sendJudgeCue(true, name)` が判定演出の合図を送る。
4. `setStep(stepAfterCorrect())` で、正解者発表（4）か正解表示（5）へ進む。
5. 5では、`status` に `step: 'reveal_correct'`, `correct`, `revealWinners`, `revealGains` を書く。
6. モニターの `Viewer.render` は、`Reveal.resetFor` と `Reveal.judgeFlash` を通ってから、次のどれかで描く。
   - 答えが文字の形式: `Reveal.holding`（ため演出）→ `Reveal.render`
   - 選択式: 光らせてから `Reveal.choiceExtras`
   - 並べ替え: `renderSortReveal` → `choiceExtras`
7. 解答者の答えが届くと、`Reveal.updateLive` が人数を差し替える。

## 5. 確かめ方（dev/）

- `dev/fakefb.js` … メモリ上の偽の Firebase（`window.db.ref(...)` の `on` / `once` / `set` / `update` / `push` / `remove` / `transaction`）。`window.__fakeDb` で中身を触れる。1ページの中だけで動くので、司会者・解答者・モニターを試す時は、同じページで画面を切り替えて試す。
- `dev/tests/` … 確認用の Playwright スクリプト。
  - 例: `node dev/tests/viewer_reveal.js`
  - 写真は `dev/tests/out/` に出る（git には入れない）。
  - よく使う形:
    - 作成画面: `showView(selectType)` → 形式カードを押す → `#ps-overlay .ps-go`
    - 司会者: `App.Studio.quickStart({ title, config, questions })` → `#console-btn-phase-main` を押して進める → `__fakeDb.ref('rooms/'+room+'/players').update(...)` で解答者を足す → `judgeBuzz(true)`
    - モニター: `App.Viewer.questions = [...]`, `App.Viewer.config = {...}`, `App.Viewer.render({ step, qIndex, ... })`
  - スマホは `{ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }`。
  - 外の通信は `page.route(/gstatic|googleapis|jsdelivr/, r => r.abort())` で止める。
- 画面の言葉を全部拾うときは、`dev/tests/words.js`（作る画面を順に開いて、見えている文字を集める）。

## 6. お試し（trial.js / local_db.js）

- プレビューの「お試し」で、今書いている1問を、その場で遊べる。
- 本番と同じ `index.html` を iframe で3つ開き、通信の代わりに、親のページの `LocalDb` の置き場（`window.__trialStore`）でつなぐ。
  - 司会者: `?local=1&testHost=ID`。見えない所に置き、進行ボタン・〇✕・確認を下の「司会者バー」に写す（`Trial.mirror`）。
  - モニター: `?local=1&vcode=ID`
  - 解答者（あなた）: `?local=1&room=ID&autoName=あなた`
- `firebase.js` は、`?local=1` で親に置き場があれば `window.db = LocalDb.client(parent.__trialStore)` を使う。部屋IDは `TEST-T…`（テスト扱い。参加中として覚えない）。
- **購読の外し方**: `off()` は、外した画面の購読だけを外す（`owner`）。全部の画面の購読を外すと、ほかの画面が止まってしまう。
- **全画面**: 解答者は、iframe の中では全画面にしない（`requestLandscape`）。全画面にすると、枠いっぱいに広がってしまう。
- **仮の参加者**（`Trial.BOTS`）は、少し遅れて動く。
  - 早押し: 押す
  - 一斉: 答える（半分くらい当たる）
  - 順番・指名: 何もしない
- 1問が終わると、セットの終わりの案内の代わりに「もう一度／問題に戻る」を出す。
- 陣取りパネルは、盤面無しで問題だけを試す（`gameType` を `score` にする）。
- **確かめ方**: iframe を同じページとして扱うため、http で開く。
  - リポジトリの一番上で `python3 -m http.server 8765` を起動してから、`node dev/tests/trial.js choice` / `node dev/tests/trial_buzz.js` を動かす。
  - `file://` で開くと、iframe が親に触れない。
