D15. トラブルシュート集（Troubleshooting & Recovery Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）
前提：D10（Runner）／D11（設定）／D12（CLI）／D14（FS）／D7（API）
制約：ローカルのみ、gh 非依存、git 依存可、途中停止や反復前提

1. 目的

典型障害を 最短で復旧 し、開発が止まる時間を減らす

failed と needs_input を 運用で判別 できるようにする

Doctor（CLI/UI）で検出 → コマンド提示 → 再実行までの標準手順を定義する

2. 基本の切り分け手順（必須）

問題が起きたら、原則この順で確認する。

aiflow doctor を実行（または /doctor を確認）

対象Requestの最新Runを特定

aiflow list

aiflow logs <requestId>

runs/<requestId>/<runId>/errors.json を確認

状態に応じて対応

needs_input：人間の操作が必要（ワークツリー整理、設定補完、判断）

failed：ツール側の失敗（収束不可・環境不整合・コマンド失敗）

3. 代表的な障害カテゴリ

Git前提条件（base/remote/dirty）

ロック（同時実行／異常終了残り）

コマンド実行（phpunit/e2e/npm）

ネットワーク／認証（push）

設定不整合（paths/port/commands）

Runnerの収束失敗（テストが直らない、Step肥大、無限ループ防止で停止）

UI/サーバ起動不全（port競合、node不足）

4. エラーコード一覧（v1）

runs/.../errors.json の code に入る値。UI/CLIはこのコードで表示を切り替える。

Git/環境系（Preflight）

WORKTREE_DIRTY

REMOTE_ORIGIN_MISSING

BASE_BRANCH_NOT_FOUND

GIT_NOT_INSTALLED

NOT_A_GIT_REPO

ロック系

LOCK_HELD

LOCK_STALE

実行コマンド系

COMMAND_NOT_FOUND

COMMAND_FAILED

UNIT_TEST_FAILED

E2E_TEST_FAILED

push系

PUSH_FAILED

AUTH_REQUIRED

Plan/Runner系

PLAN_INVALID

STEP_TOO_LARGE

RETRY_EXCEEDED

AMBIGUOUS_REQUIREMENT

サーバ系

PORT_IN_USE

NODE_NOT_INSTALLED

5. 症状別：原因と復旧手順
5.1 WORKTREE_DIRTY（needs_input）

症状

aiflow run がすぐ止まる

errors.json に dirty files が出る

原因

作業ツリーが未コミット変更を含むため、安全のため開始拒否（D10/D11 safety）

復旧

状態確認

git status --porcelain

いずれかを実施

変更をコミット：git add -A && git commit -m "WIP"

一時退避：git stash -u

破棄：git reset --hard && git clean -fd（注意）

再実行

aiflow run <id> またはUIでRun

再発防止

safetyの requireCleanWorktree を維持（推奨）

どうしても必要なら --skip-clean-check を将来導入（v1は非推奨）

5.2 REMOTE_ORIGIN_MISSING（failed/needs_input）

症状

compare URL生成やpushで失敗

原因

origin が未設定

復旧

remote確認：git remote -v

追加：git remote add origin <url>

再実行（pushフェーズからやり直し）

再発防止

doctor を定期実行（D11）

5.3 BASE_BRANCH_NOT_FOUND（failed）

症状

Preflightで停止

baseが存在しない

原因

baseブランチ名が違う（main/masterなど）

fetchしていない

復旧

git fetch origin

base候補確認

git branch -r | head

.aiflowrc.json または Requestで base を修正

git.baseBranchDefault を master にする等

再実行

5.4 LOCK_HELD / LOCK_STALE（needs_input）

症状

実行開始できない、常に「ロック中」

原因

別プロセスが実行中（LOCK_HELD）

異常終了でロックが残った（LOCK_STALE）

復旧

ロックファイル確認

.aiflow/locks/runner.lock

.aiflow/locks/<requestId>.lock

pid が生きているか確認（mac）

ps -p <pid>

生きていなければ削除

rm .aiflow/locks/*.lock

再実行

再発防止

lockTimeoutSec（D11 safety）を適切に（例：2h）

devモードは1つだけ立ち上げる

5.5 PORT_IN_USE（failed）

症状

aiflow dev が起動しない

原因

ポート競合

復旧

別ポートで起動

aiflow dev --port 4322

競合プロセスを止める（必要なら）

再発防止

.aiflowrc.json で固定ポートを決める

5.6 NODE_NOT_INSTALLED / GIT_NOT_INSTALLED（failed）

症状

doctorでNG、起動不能

復旧

Node / Git をインストール（詳細は環境依存のため doctor がリンク/提案）

インストール後 aiflow doctor 再実行

5.7 COMMAND_NOT_FOUND（failed/needs_input）

症状

phpunit や npm run e2e が見つからない

原因

D11 commands.* が実環境と一致していない

依存が未インストール

復旧

コマンド単体で動くか確認

phpunit --version

npm run e2e

.aiflowrc.json の commands を修正

必要なら依存導入

composer install / npm install

再実行

再発防止

projectごとに .aiflowrc.json をGit管理（推奨）

5.8 UNIT_TEST_FAILED（failed）

症状

implementing中の各Stepまたはtestingでunitが落ち続ける

原因

実装不整合、テスト追加不足、既存仕様破壊

自己修正のリトライ上限（D10）に達した

復旧（標準）

失敗テスト名を確認

runs/.../unit.log

runner.log

直近コミットを特定

git log -n 5 --oneline

2パターン

修正して続行：手動で直す or Request追記で狙いを明確化し rerun

切り戻し：git reset --hard <good_commit>（注意）

再実行

再発防止

Stepを小さく（D4）

stepMaxDiffLines を下げる（D11）

5.9 E2E_TEST_FAILED（failed / needs_input）

症状

回帰担保のE2Eで失敗

原因

UI変更によるセレクタ破綻

E2E環境依存（ローカル環境差）

復旧

runs/.../e2e.log で失敗箇所特定

E2Eを更新（セレクタ・待機・データ準備）

再実行

needs_inputになる条件

「E2E実行が不可能」または「人間判断で手動総合テストに切替」が必要な場合

5.10 PLAN_INVALID / AMBIGUOUS_REQUIREMENT（needs_input）

症状

planningで止まる／Plan品質ゲート不合格が収束しない

原因

AC不足、制約不足、対象範囲が曖昧

「何をもって完了か」が不明

復旧

requests/<id>.md の AC を増やす（最低3つ以上、Given/When/Then推奨）

制約を追記

既存仕様の保持条件

影響範囲（画面/API/DB）

rerun

再発防止

Requestテンプレ（D3）を固定

「回帰AC（E2E）」を必ず1つ入れる運用

5.11 STEP_TOO_LARGE（failed/needs_input）

症状

implementing中に「変更がでかすぎる」と判断して停止

原因

Step分割が不足（D4）

既存コードが広範囲に影響する変更

復旧

Planを見直し、Stepを増やす（粒度を下げる）

runner.stepMaxDiffLines / stepMaxFilesTouched を調整（必要なら一時的に上げる）

rerun

再発防止

v1は「小さく刻む」を最優先

「最初のStepは足場作り（テスト追加/調査）」を標準にする

5.12 PUSH_FAILED / AUTH_REQUIRED（failed）

症状

pushで失敗、compare URLが出ない

原因

GitHub認証期限切れ

リモート権限不足

ネットワーク

復旧

手動でpushして原因を見る

git push -u origin <branch>

認証更新（環境に依存）

aiflow run <id> --phase pushing（将来）または rerun

再発防止

ローカルの認証（ssh/https）を統一

doctor に pushテスト（dry-run）を追加（将来）

6. “止まったとき” の標準復旧フロー（運用）
6.1 needs_input のとき

UI Detail で blocked_reason と errors.json を確認

要求された操作を実施（git整理、設定追記、判断）

Resume（UI）または aiflow run <id>（CLI）

6.2 failed のとき

runs/.../runner.log と errors.json で原因特定

直近コミットの影響を確認

手動修正 or 切り戻し

Re-run（UI）または aiflow run <id>

7. Doctorで提示すべき「定型ガイド」（最低限）

doctorはNGのたびに以下を出せること（D6/D12と整合）。

WORKTREE_DIRTY → stash/commit/clean の選択肢

BASE_BRANCH_NOT_FOUND → base候補の提示＋設定変更案

COMMAND_NOT_FOUND → .aiflowrc.json の commands例

PORT_IN_USE → --port 提案

LOCK_STALE → ロック削除案（pid確認付き）

8. 受け入れ基準（本Spec）

主要な失敗がエラーコードで分類され、復旧手順が明確

needs_input と failed の判断基準が運用上ブレない

doctor→logs→errors.json の導線で原因に到達できる

途中停止・反復前提でも復旧可能（D10/D14整合）

必要なら、最後に D16（Requestテンプレ＆運用ルール：優先度、WIP制限、回帰ACの書き方） を作ると、実際の運用がかなり安定します。

