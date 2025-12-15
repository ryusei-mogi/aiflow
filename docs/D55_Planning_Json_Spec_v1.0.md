D55. planning.json 仕様（Step分割・収束ルール・バリデーション）v1.0

対象：runs/<request-id>/<run-id>/planning.json（SSOT）
目的：「長すぎて途中で止まる」問題を、計画段階の細分化で根本回避し、Runnerが機械的に反復実行できる形に固定する。
前提：ローカル完結／gh禁止／git依存OK／no_token／max_diff_lines 運用（D54）／state/stage（D22）／Run再開（D34）と整合。

1. 位置付け（SSOT）

planning.json は Run内の“実行計画SSOT”

Runnerは planning.json を読み取り、stage.json.steps[] を構築・更新する

planning.json は原則 Plannerが生成し、以後はRunnerが参照する（Runnerが勝手に編集しない）

2. 生成タイミングと更新ポリシー

Run開始直後（PLANNING）に生成する

v1では、基本は 1回のplanningで収束させる（Replanは極力しない）

Replanが必要になる条件（例）

STEP_TOO_LARGE（差分が上限超過）

仕様矛盾や対象ファイル選定不能（INPUT系）

テスト失敗が複合的で「設計のやり直し」が必要

3. planning.json スキーマ（v1）
3.1 ルート（トップレベル）
key	型	必須	説明
version	string	✅	"1.0"
request_id	string	✅	requests/*.md のid
run_id	string	✅	runs配下のrun識別子
created_at	string(ISO)	✅	planning作成時刻
base_branch	string	✅	gitの基準ブランチ
work_branch	string	✅	作業ブランチ（D40）
limits	object	✅	実行制限（max_diff_lines等）
context	object	✅	request要約・制約・AC
steps	array[Step]	✅	実行ステップ（最重要）
gates	object	✅	品質ゲート/停止条件
outputs	object	✅	生成物パス（相対）
assumptions	array[string]	⛔	Plannerが置いた仮定
risks	array[string]	⛔	既知リスク（短文）
3.2 limits
key	型	必須	説明
max_diff_lines	number	✅	1 stepあたりの最大差分行数
max_files_changed	number	⛔	推奨：10程度（警告用途）
timeout_sec	number	✅	役割実行やテストのtimeout
max_steps_per_run	number	✅	v1は基本1（S01のみ実行でも可）
max_autofix_cycles	number	✅	unit失敗→修正の最大反復
3.3 context
key	型	必須	説明
summary	string	✅	要望の要約（1〜3行）
constraints	array[string]	✅	例：Laravel/MySQL/既存仕様を壊さない
acceptance_criteria	array[AC]	✅	requestのAC（Given/When/Then推奨）
test_instructions	object	✅	unit/e2eの指示（あれば）
project_facts	object	⛔	例：フレームワーク、起動手順など（簡易）
AC（Acceptance Criteria）
key	型	必須	説明
id	string	✅	AC-01 形式推奨
given	string	✅	前提
when	string	✅	操作
then	string	✅	期待結果
type	"functional"|"regression"|"nonfunctional"	⛔	任意
3.4 Step（最重要）

Stepは 「1 Step = 1 Commit」 を前提に、必ず小さく、独立に完了できる単位にする。

Step オブジェクト
key	型	必須	説明
step_id	string	✅	S01 S02…（固定）
title	string	✅	1行
role	"implementer"|"reviewer"|"qa"|"planner"	✅	実行ロール（基本implementer）
intent	string	✅	何を実現するか（短文）
scope	object	✅	変更範囲と制限
inputs	object	✅	参照するファイル/情報
commands	object	✅	unit/e2e等（任意）
success_criteria	array[string]	✅	step完了条件（短文）
links_to_ac	array[string]	✅	このstepで満たすAC id
expected_diff	object	✅	目安（diff行数/ファイル数）
outputs	object	✅	生成予定物（patch等）
fallback	object	⛔	role失敗時の代替戦略
stop_conditions	array[string]	⛔	このstepで止める条件
scope
key	型	必須	説明
target_paths	array[string]	✅	変更対象の候補（ディレクトリ/ファイル）
forbidden_paths	array[string]	⛔	触ってはいけないパス
max_diff_lines	number	✅	そのstep固有上限（通常はlimits継承）
max_files_changed	number	⛔	そのstep固有上限
inputs
key	型	必須	説明
request_path	string	✅	request md
context_files	array[string]	⛔	例：規約/設計doc（あれば）
code_files_hint	array[string]	⛔	重要ファイルのヒント（任意）
commands
key	型	必須	説明
unit	array[string]	⛔	実行コマンド（複数可）
e2e	array[string]	⛔	v1では基本オフ
expected_diff
key	型	必須	説明
lines_max	number	✅	limits.max_diff_lines 以下
files_max	number	✅	推奨10以下
risk_level	"low"|"mid"|"high"	✅	目安
outputs
key	型	必須	説明
patch_path	string	✅	runs/.../patches/S01.patch
log_prefix	string	✅	runs/.../logs/step.S01 等
3.5 gates（品質ゲート）
key	型	必須	説明
require_clean_worktree	bool	✅	dirtyなら開始不可
require_work_branch	bool	✅	base直は禁止
require_unit_pass	bool	✅	unit失敗ならDONEにしない
require_e2e_for_regression_ac	bool	✅	regression ACがあるならE2E要求（v1はneeds_inputでも可）
forbid_gh	bool	✅	gh禁止を強制
max_step_too_large_retries	number	✅	STEP_TOO_LARGE の許容回数（通常0〜1）
3.6 outputs（Run共通の成果物パス）
key	型	必須	説明
planning_json	string	✅	runs/.../planning.json（自己参照でも可）
stage_json	string	✅	runs/.../stage.json
report_md	string	✅	runs/.../report.md
errors_json	string	⛔	needs_input/failedのみ生成（推奨）
4. バリデーションルール（Runner必須）

planning.json を読み込んだら、最低限これを検証して 機械的に止める。

4.1 必須検証（FAIL）

JSONとしてパース可能（不可→JSON_PARSE_ERROR）

version/request_id/run_id/steps が存在

steps[].step_id が S\d\d で一意

steps[].expected_diff.lines_max <= limits.max_diff_lines

steps[].scope.max_diff_lines <= limits.max_diff_lines

gates.forbid_gh == true（v1は固定）

context.acceptance_criteria.length >= 3（不足→AC_TOO_FEW）

4.2 警告（WARN）

steps[].expected_diff.files_max > 10

steps.length > 10（過分割の可能性）

assumptions が多すぎる（例：>8）

5. 収束ルール（止まらずに終わるための規約）

Stepは必ず “単独で完了” できる内容にする（前提作業の混在禁止）

S01から順に実行（v1はS01のみで一旦DONEにしてもよい）

どのStepでも、差分が大きくなりそうなら

実装を削るのではなく 分割（新しいStep） を優先

テスト失敗時は

max_autofix_cycles 回まで「修正→unit再実行」を許可

収束しなければ UNIT_TEST_FAILED で停止し、reportに次アクションを残す

6. stage.json との対応（必須）

stage.json.steps[i].step_id は planning.json の steps[i].step_id と一致

Runnerは current_step_index を進めるだけで進行できる

計画自体を変える（Replan）は 原則新run（D34方針）

7. 最小サンプル（v1：2ステップ例）
json
{
"version": "1.0",
"request_id": "RQ-20251214-008",
"run_id": "20251214-210501-a1b2c3",
"created_at": "2025-12-14T21:05:01+09:00",
"base_branch": "main",
"work_branch": "aiflow/RQ-20251214-008/20251214-210501",
"limits": {
"max_diff_lines": 400,
"max_files_changed": 10,
"timeout_sec": 180,
"max_steps_per_run": 1,
"max_autofix_cycles": 1
},
"context": {
"summary": "Requestからplanningを生成し、S01でpatch作成→unit実行→reportを出す",
"constraints": ["local_only", "no_gh", "git_ok", "do_not_break_existing"],
"acceptance_criteria": [
{"id":"AC-01","given":"requestがある","when":"Runする","then":"planning.jsonが生成される"},
{"id":"AC-02","given":"S01実行","when":"implementer実行","then":"patchが生成される"},
{"id":"AC-03","given":"unit有効","when":"Runする","then":"unitログが保存されreportに反映される"}
],
"test_instructions": { "unit": "php artisan test", "e2e": "" }
},
"gates": {
"require_clean_worktree": true,
"require_work_branch": true,
"require_unit_pass": true,
"require_e2e_for_regression_ac": false,
"forbid_gh": true,
"max_step_too_large_retries": 1
},
"steps": [
{
"step_id": "S01",
"title": "Planner出力の検証と最小patch生成",
"role": "implementer",
"intent": "planningに基づき最小差分でpatchを生成する",
"scope": {
"target_paths": ["tools/aiflow", ".aiflow", "requests"],
"forbidden_paths": ["vendor", "node_modules"],
"max_diff_lines": 400,
"max_files_changed": 10
},
"inputs": {
"request_path": "requests/RQ-20251214-008.md",
"context_files": [".aiflow/config.v1.json", ".aiflow/router.v1.json"],
"code_files_hint": []
},
"commands": { "unit": ["php artisan test"], "e2e": [] },
"success_criteria": [
"S01.patch が生成される",
"git apply --check が通る",
"unitがPASSする"
],
"links_to_ac": ["AC-02", "AC-03"],
"expected_diff": { "lines_max": 350, "files_max": 8, "risk_level": "mid" },
"outputs": {
"patch_path": "runs/RQ-20251214-008/20251214-210501-a1b2c3/patches/S01.patch",
"log_prefix": "runs/RQ-20251214-008/20251214-210501-a1b2c3/logs/step.S01"
}
}
],
"outputs": {
"planning_json": "runs/RQ-20251214-008/20251214-210501-a1b2c3/planning.json",
"stage_json": "runs/RQ-20251214-008/20251214-210501-a1b2c3/stage.json",
"report_md": "runs/RQ-20251214-008/20251214-210501-a1b2c3/report.md"
},
"assumptions": ["対象repoはgit管理されている", "codex/gemini CLIはログイン済み"]
}

8. 受け入れ基準（D55）

planning.json が Runner実行のSSOT として成立している

Stepが差分上限を前提に 機械的に反復可能

ACとStepが links_to_ac で紐づき、report生成に流用できる

バリデーション失敗時に reason_code で明確に停止できる

stage.json と整合し、resume/retry（D34）に繋がる

次は、planningの実行結果を確実に残すための D56. stage.json（実装向け最終スキーマ＆更新規約） を「実装者がそのまま書ける粒度」で固めるのが効果的です。

