D10. Runner内部フェーズ仕様（Runner Stage Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）
前提：状態はD2（status）／APIはD7／Git運用はD8／Step分割はD4／ReportはD5
制約：gh 非依存、トークン不要PRモード、途中停止しうるため反復可能であること

1. 目的

Runner（実行エンジン）が Request を処理する際の 内部フェーズ（phase / stage） と、各フェーズで行うべき最小責務・入出力・品質ゲート・失敗時の扱いを定義する。
狙いは以下。

長い実装を Step反復 で確実に前進させる（途中停止しても再開可能）

「何をどこまでやったか」を ログとReport で追える

UI（D6）やAPI（D7）が Runner の進捗を一貫して表示できる

2. ステートとフェーズの関係（D2との整合）

外部状態（status）：queued | running | needs_input | failed | done

内部フェーズ（phase）：planning | implementing | testing | documenting | pushing | reporting

Runnerは status=running の間だけ phase を遷移させる

needs_input/failed/done に遷移した時点で phase は最終値で固定（参照用）

3. 実行単位とディレクトリ

1回の実行を Run とする（run_id）

実行成果物（ログ、テストログ等）は runs/<request_id>/<run_id>/ に保存する

必須成果物（最低限）：

runner.log（全体ログ）

stage.json（現在フェーズ・Step・進捗のスナップショット）

errors.json（failed/needs_input時の詳細）

unit.log / e2e.log（実行した場合）

4. Runnerの全体フロー（概観）

Preflight（開始前チェック：git/環境/ロック）

planning：Plan生成（AC/Step Plan）

implementing：Stepごとに実装→コミット（D4/D8）

testing：Unit/E2E等のテスト実行・収束

documenting：Doc/Report整形（D5必須セクション充足）

pushing：push＋compare URL生成（D8）

reporting：Report最終更新＋status遷移（done/failed/needs_input）

Preflightは内部的な前段だが、UI表示上は planning に含めてもよい。ただしログには明示する。

5. フェーズ定義
5.1 Preflight（開始前チェック）
目的

安全に開始できることを保証し、事故（ユーザー作業破壊・base汚染）を防ぐ。

入力

Request（D3）

リポジトリ状態（git）

実行設定（ポート、paths等：将来D11）

処理（最小責務）

排他ロック取得（同時実行防止）

git status --porcelain が空か確認（WORKTREE_DIRTY）

origin の存在確認（REMOTE_ORIGIN_MISSING）

git fetch origin

origin/<base> の存在確認（BASE_BRANCH_NOT_FOUND）

作業ブランチの準備（D8）

ai/<id> を checkout（存在すれば継続、なければ作成）

run_dir 作成と stage.json 初期化

成功条件（ゲート）

ロック取得済み

作業ツリーがクリーン

base/branch が確定

run_dir が作成済み

失敗時

WORKTREE_DIRTY → needs_input（ユーザー対応）

その他環境系 → failed

5.2 planning（Plan生成）
目的

AI停止・長時間化に耐えるため、実装を完走できる Step Plan を生成する（D4）。

入力

requests/<id>.md（Want + 前提/制約 + 受け入れ条件 + テスト指示）

既存のPlan/Report（再実行時）

コーディング規約・既存仕様（提供できる範囲）

処理（最小責務）

ACを最低3つ確認（不足なら補完案を作る）

Step Planを生成（最低3 Step、各StepにDone条件2つ以上、unitテスト必須）

D4「Plan品質ゲート」を適用し、NGなら計画を再生成（一定回数まで）

出力

requests/<id>.md の ## Plan を更新（追記/置換ルールはD3に従う）

runs/.../plan.json（内部表現）

成功条件（ゲート）

Step数 >= 3

全Stepに必須フィールドが揃う

全ACがいずれかのStepに紐づく

unitテストが各Stepに含まれる

失敗時

品質ゲート不合格が収束しない → needs_input（要望が曖昧/制約不足の可能性）

計画生成自体が失敗 → failed

5.3 implementing（Step反復実装）
目的

Step単位で「小さな変更→テスト→コミット」で前進させる（D4/D8）。

入力

plan.json（Step Plan）

現在のgit状態（branch上）

既存コード

処理（反復）

Step Sxx について以下を順に実施：

Step開始ログ出力、stage.json 更新

変更実施（実装詳細はAIに委任可）

Step内 unitテストを実行

差分量チェック（大きすぎればStep分割して縮小）

コミット作成（D8規約）

Step完了としてReport（D5 Steps Executed）へ追記

次Stepへ

成功条件（ゲート：各Step）

テスト成功（少なくともunit）

コミットが存在

done_criteria を満たしたと説明できる根拠がReportに残る

途中停止耐性（必須）

Runnerが途中で停止しても、完了したStepはコミットで残る

再開時は「未完了Step」から続行できる（stage.json とReportから判断）

失敗時の扱い

テストが継続的に失敗して収束しない → failed

仕様判断が必要（例：A/B選択、曖昧）→ needs_input

Stepが大きくなりすぎる → Stepを分割して再実行（自動）

5.4 testing（統合的テスト・回帰担保）
目的

実装全体としての品質を固め、回帰ACがある場合はE2Eで担保する。

入力

最新branch

Plan（AC/テスト指示）

既存テストスイート

処理

全体 unit（もしくは関連範囲のunit）を実行

ACに「回帰しない（E2E）」がある場合、E2E smokeを実行

失敗時は最小修正で収束させる（必要なら implementing に戻る）

成功条件（ゲート）

必須テストがすべてPASS

テストログが artifacts として保存される

失敗時

収束しない → failed

環境依存で実行不能（例：E2E環境がない）→ needs_input（手動確認に切替可否の判断を求める）

5.5 documenting（ドキュメント整備）
目的

Report（D5）を最終判断できる品質に整形し、必要なら追加ドキュメントを更新する。

入力

Report草稿（途中まで）

テスト結果

変更内容（diff/コミット）

処理

D5必須セクションが揃っているか検査

ACステータス（Met/Not Met/Blocked）を確定し、Evidenceを付与

Next Actions（Human）を3項目以上で作る（総合テスト観点）

成功条件（ゲート）

D5必須7セクションが揃う

ACが埋まり、根拠がある

Steps Executed / Tests / Changes が追跡可能

失敗時

ドキュメント生成の失敗は致命ではないが、判断不能になるため failed 扱い（v1）

代替として needs_input（人間が補完する）も可

5.6 pushing（push + compare URL）
目的

ローカル成果をリモートへpushし、PR作成に進める compare URL を生成する（D8）。

入力

branch/base

origin remote URL

処理

git push -u origin <branch>（初回）または通常push

origin URLから compare URL を生成

requests/<id>.md と Report に pr_url を記録

成功条件（ゲート）

push成功

pr_url 生成成功

失敗時

認証/ネットワーク系：failed（再試行手順をReportへ）

5.7 reporting（最終確定）
目的

status遷移を確定し、UIに「完了/失敗/入力待ち」を明確に返す。

入力

直近フェーズ結果

Report（D5）

stage.json（最終）

処理

status を最終遷移

全ゲートOK：done

判断が必要：needs_input

収束不可：failed

updated_at 等の更新

最終スナップショット保存（stage.json）

成功条件

Requestが最終状態になり、UI/APIがその状態を取得できる

6. フェーズ間遷移ルール

原則：Preflight → planning → implementing → testing → documenting → pushing → reporting

例外：

planningでPlan既存＆再利用可能なら implementing へ（再実行時）

testing失敗 → implementing に戻って修正 → testing再実行

needs_input が出た時点で即 reporting（status確定）

7. リトライ・収束ポリシー（v1デフォルト）

Plan品質ゲート再生成：最大2回（3回目で needs_input）

Step内テスト失敗の自己修正：最大2回（以降 failed）

E2E実行が不安定：最大1回再試行（以降 needs_input で手動確認を依頼）

v1は「無限ループ」を絶対に避ける。止める判断を優先する。

8. ログ仕様（最低要件）

Runnerは以下のログを出す（UIで観測可能）。

[RUN] started run_id=001

[PHASE] planning

[STEP] S01 start

[TEST] unit ... PASS/FAIL

[COMMIT] abc1234

[PHASE] testing

[PUSH] success

[DONE] pr_url=...

ログは runs/.../runner.log に保存し、WS/ポーリングでUIへ流す。

9. 受け入れ基準（本Spec）

Runnerが内部フェーズを持ち、UIで progress を表示できる

planningでD4品質ゲートを満たす Step Plan が生成される

implementingで「1 Step = 1コミット」が守られる

testingで必須テストが走り、ログが保存される

documentingでD5必須セクションが揃う

pushingでpushとcompare URL生成ができる（gh不要）

途中停止しても再開可能（コミット＋stage.jsonで続行できる）

10. 関連（依存）

D2：状態遷移仕様書（status）

D3：Requestファイル仕様（Plan/Reportの格納）

D4：Step Plan仕様（細分化・ゲート）

D5：Report仕様（判断材料の固定）

D6：UI仕様（表示と操作）

D7：API仕様（UI↔Runner契約）

D8：Git運用仕様（ブランチ・コミット・push・compare）

次は、これを実装に落とすための D11（設定仕様：paths/port/実行プロファイル/CLI検出） を作るのが自然です。

