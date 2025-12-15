D51. 初期requests生成パック（RQ-001〜013の雛形MD一括）v1.0

対象：requests/*.md にそのまま置ける初期バックログ（D50の実体化）
目的：あなたがコピペで requests/ に配置し、UIから順にRunできる状態にする。
前提：D46テンプレ準拠／AC最低3つ／ローカル完結／gh禁止／git依存OK。

0. 使い方

下記の各ブロックを 個別ファイル として requests/ 配下に保存してください

id/title/created_at/updated_at は必要なら日付だけ合わせてOK

最初は全部 status: ready ではなく、RQ-001〜003あたりを ready にして進めるのが安全

1. RQ-001 aiflowサンドボックス（起動と最小HTTP）
md
---
id: RQ-20251214-001
title: aiflow-local: 起動と最小HTTP(doctor)を用意する
priority: P0
status: ready
labels: [aiflow, mvp]
depends_on: []
estimate: S
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望（1〜3行）
- npm install（devDependencies）後にローカルでUI/HTTPが起動できる土台を作りたい
- /api/doctor を追加して、最低限の環境チェックを返すようにしたい

## 前提/制約
- ローカル完結
- ghコマンド依存は不可（gitは可）
- トークン不要モード（サブスクCLIログイン前提）
- runs/ と locks/ はgit管理しない

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: npm install済 When: npm run dev Then: ローカルでUIにアクセスできる
- [ ] AC-02 Given: サーバ起動中 When: GET /api/doctor Then: JSONでchecks(node/git)を返す
- [ ] AC-03 Given: repo-root When: git status Then: runs/ と .aiflow/locks/ がgit追跡対象外（.gitignore）になっている

## テスト指示
### Unit
- 最小でよい（doctorのレスポンス生成をテスト可能なら追加）

## 補足
- 実装方式（フレームワーク選定など）はAIに任せる

2. RQ-002 requestsパーサ＆一覧API
md
---
id: RQ-20251214-002
title: aiflow-local: requests/*.md をパースして /api/requests を返す
priority: P0
status: draft
labels: [aiflow, mvp]
depends_on: [RQ-20251214-001]
estimate: S
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- requests/*.md を読み込み、metaと本文をパースして /api/requests で一覧取得できるようにしたい

## 前提/制約
- D46のテンプレ形式（YAML front matter）を前提にしてよい
- フォーマット不正は reason_code で止める

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: requestsに2ファイル When: GET /api/requests Then: items配列で2件返る
- [ ] AC-02 Given: metaあり When: 一覧取得 Then: id/title/priority/status が取得できる
- [ ] AC-03 Given: meta不正 When: 一覧取得 Then: REQUEST_INVALID_FORMAT を返す（または該当ファイルを明示してエラー）

## テスト指示
### Unit
- front matterのパースが崩れないこと

3. RQ-003 Requests画面（一覧）
md
---
id: RQ-20251214-003
title: aiflow-local: Requests一覧画面を作る
priority: P0
status: draft
labels: [aiflow, ui]
depends_on: [RQ-20251214-002]
estimate: S
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- ブラウザで requests 一覧を表示し、詳細に遷移できるようにしたい

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: requestsが存在 When: Requests画面表示 Then: itemsが一覧表示される
- [ ] AC-02 Given: 複数status When: statusフィルタ Then: 表示が絞り込まれる
- [ ] AC-03 Given: 1件選択 When: Open Then: Request Detail に遷移できる

## テスト指示
### E2E（任意）
- 一覧表示→フィルタ→詳細遷移

4. RQ-004 Request詳細（本文編集＋meta編集）
md
---
id: RQ-20251214-004
title: aiflow-local: Request詳細で本文編集とmeta編集ができる
priority: P0
status: draft
labels: [aiflow, ui]
depends_on: [RQ-20251214-003]
estimate: M
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- Request詳細画面で本文(markdown)とmeta(priority/status/labels)を編集・保存できるようにしたい

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: Request表示 When: 本文編集してSave Then: ファイルに保存され再読込して反映される
- [ ] AC-02 Given: meta表示 When: priority/status更新 Then: metaが正規化されて保存される（D36）
- [ ] AC-03 Given: 保存後 When: 一覧へ戻る Then: 一覧側のmeta表示も更新される

## テスト指示
### E2E（任意）
- 詳細→本文更新→保存→再読込→反映確認

5. RQ-005 Run基盤（runs生成＋stage.json＋ロック）
md
---
id: RQ-20251214-005
title: aiflow-local: Run開始でruns生成とstage管理・ロックを行う
priority: P0
status: draft
labels: [aiflow, run]
depends_on: [RQ-20251214-004]
estimate: M
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- UI/APIからRun開始できるようにし、runs配下に成果物ディレクトリとstage.jsonを生成したい
- 同一requestの二重実行はロックで防ぎたい

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: status=ready When: POST /api/requests/:id/run Then: run_idとrun_pathが返る
- [ ] AC-02 Given: Run開始 When: runs配下確認 Then: stage.jsonが生成されINIT→PLANNINGに遷移する
- [ ] AC-03 Given: Run中 When: もう一度run実行 Then: RUN_IN_PROGRESS(409)で拒否される

## テスト指示
### Unit
- ロック取得/解放、stage初期化

6. RQ-006 Router（codex/gemini）呼び出し基盤
md
---
id: RQ-20251214-006
title: aiflow-local: Router設定でcodex/geminiを呼び分けログを残す
priority: P0
status: draft
labels: [aiflow, llm]
depends_on: [RQ-20251214-005]
estimate: M
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- router.v1.jsonに基づき、roleごとにcodex/geminiを呼び分けたい
- raw出力・実行時間・fallback状況をruns/logsに保存したい

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: router設定 When: role=planner実行 Then: primary→fallbackの選択がログに残る
- [ ] AC-02 Given: CLI不在 When: 実行 Then: CLI_NOT_AVAILABLE で止まる
- [ ] AC-03 Given: JSON崩壊 When: 実行 Then: JSON_PARSE_ERROR で止まりraw出力が保存される

## テスト指示
### Unit
- router設定の読み込みとルーティング決定

7. RQ-007 Planner（request→planning.json）
md
---
id: RQ-20251214-007
title: aiflow-local: Plannerでrequestからplanning.jsonを生成する
priority: P0
status: draft
labels: [aiflow, plan]
depends_on: [RQ-20251214-006]
estimate: M
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- D42 Planner契約でplanning.jsonを生成し、runs配下に保存したい
- max_diff_lines前提でstep分割を強制したい

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: request.md When: Run実行 Then: runs/.../planning.json が生成される
- [ ] AC-02 Given: 大きい要望 When: plan生成 Then: stepsが複数に分割される
- [ ] AC-03 Given: JSON崩壊 When: plan生成 Then: JSON_PARSE_ERROR で止まりfallbackが試行される

## テスト指示
### Unit
- JSONパース/必須キー検証（最低限）

8. RQ-008 Implementer（Step1）→ patch生成
md
---
id: RQ-20251214-008
title: aiflow-local: ImplementerでStepのunified diffを生成しpatch保存する
priority: P0
status: draft
labels: [aiflow, impl]
depends_on: [RQ-20251214-007]
estimate: M
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- planningのS01を対象にImplementerを呼び出し、diffをpatchとして保存したい

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: planning.json When: implement(S01) Then: runs/.../patches/S01.patch が生成される
- [ ] AC-02 Given: touched_paths When: patch生成 Then: reportに変更ファイル一覧が載る（最小でもOK）
- [ ] AC-03 Given: 変更量過大 When: implement Then: STEP_TOO_LARGE で止まる

## テスト指示
### Unit
- Implementer JSONからdiff抽出→patch保存

9. RQ-009 git apply/check（安全運用）
md
---
id: RQ-20251214-009
title: aiflow-local: patchをgit apply --checkしてから適用する（safe mode）
priority: P0
status: draft
labels: [aiflow, git]
depends_on: [RQ-20251214-008]
estimate: M
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- patch適用は安全に行いたい（check→apply）
- main直変更は避け、作業ブランチで進めたい

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: patchあり When: apply Then: まず --check を通してから適用される
- [ ] AC-02 Given: check失敗 When: apply Then: PATCH_APPLY_FAILED で止まる
- [ ] AC-03 Given: 実行時 When: git確認 Then: mainではなく作業ブランチに変更が入る（D40）

## テスト指示
### Unit（任意）
- gitコマンドラッパの成否判定

10. RQ-010 Unitテスト実行＋ログ保存
md
---
id: RQ-20251214-010
title: aiflow-local: Unitテストを実行しログをruns配下に保存する
priority: P0
status: draft
labels: [aiflow, test]
depends_on: [RQ-20251214-009]
estimate: S
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- configで定義したunitコマンド（例: php artisan test）を実行し、結果ログを保存したい

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: unit有効 When: Run Then: unitログが runs/.../logs/tests に保存される
- [ ] AC-02 Given: テスト失敗 When: Run Then: UNIT_TEST_FAILED で止まる
- [ ] AC-03 Given: timeout When: Run Then: TEST_TIMEOUT で止まる

## テスト指示
### Unit
- コマンド実行の結果判定（exit code/timeout）

11. RQ-011 report.md 生成（最小）
md
---
id: RQ-20251214-011
title: aiflow-local: report.md を生成してAC/結果/次アクションを出す
priority: P0
status: draft
labels: [aiflow, report]
depends_on: [RQ-20251214-010]
estimate: S
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- runの成果を report.md にまとめたい（ACチェック欄、テスト結果、次にやること）

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: planningあり When: report生成 Then: ACチェック欄が含まれる
- [ ] AC-02 Given: unit結果あり When: report生成 Then: PASS/FAIL とログパスが書かれる
- [ ] AC-03 Given: blocked When: report生成 Then: reason_code と actions が書かれる

## テスト指示
### Unit（任意）
- reportテンプレの生成が落ちないこと

12. RQ-012 Run詳細画面（stage/log/report閲覧）
md
---
id: RQ-20251214-012
title: aiflow-local: Run詳細画面でstage/report/logsを閲覧できる
priority: P1
status: draft
labels: [aiflow, ui]
depends_on: [RQ-20251214-011]
estimate: M
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- Run Detailで stageの状態、report.md、logs一覧が見られるようにしたい

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: runあり When: Run Detail表示 Then: stage.state が表示される
- [ ] AC-02 Given: report.mdあり When: 表示 Then: markdownとして読める
- [ ] AC-03 Given: logsあり When: 表示 Then: logs一覧から内容を表示できる

## テスト指示
### E2E（任意）
- run→詳細→report/log表示

13. RQ-013 Next Request（D35）表示
md
---
id: RQ-20251214-013
title: aiflow-local: Next Request を選定してUIに表示する
priority: P1
status: draft
labels: [aiflow, queue]
depends_on: [RQ-20251214-012]
estimate: S
created_at: 2025-12-14
updated_at: 2025-12-14
---

## 要望
- 次に着手すべきrequestを自動選定し、UIに表示したい（priority/status/depends_on考慮）

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: readyが複数 When: /api/queue/next Then: 1件返る（選定理由を含む）
- [ ] AC-02 Given: depends_on未完 When: next判定 Then: 依存が解消されるまで候補にならない
- [ ] AC-03 Given: UI When: Requests画面 Then: Next Requestカードが表示される

## テスト指示
### Unit
- next選定ロジック（depends_onとpriority）

2. 次の一手（最短）

まず RQ-20251214-001.md だけ requests/ に置いて Run し、土台を作る

次に RQ-002, RQ-003 を ready にして進める

以降はD50の順番に沿えば縦串が通る

次は、実装者（AI）が迷わないように “プロジェクトへの組み込み方法（npm scripts / ディレクトリ配置 / gitignore）” を固定する D52. リポジトリ統合仕様（導入手順・npm scripts・設定配置） を作るのが効果的です。

