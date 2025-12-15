D17-A. 品質ゲート判定ルール（機械可読仕様 / JSON Rules Spec）v1.0

対象：aiflow-local（Runner/Server/UI）
前提：D17（品質ゲート）／D10（Runner）／D11（設定）
目的：done / needs_input / failed を コードに直結できる 形で定義する（UI表示・終了コード・errors.json生成に利用）

1. 適用範囲

本仕様は以下に適用する。

Runner最終判定（status決定、exit code決定）

UIのステータスバッジ／警告表示（理由コード＋メッセージ）

runs/<request>/<run>/errors.json の生成ルール

requests/<id>.md の Report 追記ルール（最低限の項目出力）

2. ルール評価モデル（概要）
2.1 判定は「ルールセット」→「最終status」

ルールは 上から順に評価（priority順）

最初にマッチした decision を採用する（first-match wins）

何もマッチしなければ done（ただし required_checks を満たす前提）

2.2 入力（Rule Engineが参照するコンテキスト）

評価に必要な入力を固定する（Runnerが必ず stage.json と合わせて生成する）。

Context（内部表現）

json
{
"request": {
"id": "RQ-20251214-001-login-timeout",
"path": "requests/RQ-...md",
"meta": {
"priority": "P1",
"type": "bugfix",
"area": ["ui","api"],
"base": "main"
},
"acceptance_criteria": {
"count": 3,
"has_regression_ac": true
},
"test_instructions": {
"unit_required": true,
"e2e_required": true
}
},
"repo": {
"is_git_repo": true,
"worktree_clean": true,
"origin_exists": true,
"base_branch_exists": true
},
"plan": {
"valid": true,
"steps_count": 4,
"steps": [
{ "id": "S01", "max_diff_lines": 120, "max_files": 4 },
{ "id": "S02", "max_diff_lines": 260, "max_files": 9 }
]
},
"execution": {
"attempts": {
"plan": 1,
"step_fix": 2,
"unit": 1,
"e2e": 1
},
"limits": {
"plan_retries": 2,
"step_fix_retries": 2,
"unit_retries": 1,
"e2e_retries": 1
}
},
"checks": {
"compare_url_generated": true,
"report_written": true,
"unit": { "ran": true, "passed": true, "cmd": "vendor/bin/phpunit" },
"e2e": { "ran": true, "passed": true, "cmd": "npm run test:e2e" }
},
"thresholds": {
"step_max_diff_lines": 300,
"step_max_files": 10,
"require_clean_worktree": true,
"require_e2e_for_regression_ac": true,
"require_unit_if_available": true
}
}

3. ルール形式（JSON Schema相当の定義）
3.1 ルールオブジェクト
json
{
"id": "QG-RULE-001",
"priority": 10,
"when": { /* 条件 */ },
"decision": {
"status": "needs_input|failed|done",
"error_code": "STRING_CODE",
"severity": "Blocker|Major|Minor",
"message": "human readable",
"actions": [
{ "label": "Run doctor", "cmd": "aiflow doctor" }
]
}
}

3.2 条件（when）の表現（v1）

v1は複雑にせず、以下のプリミティブで十分。

all: すべて真

any: いずれか真

not: 否定

eq, ne, gt, gte, lt, lte

exists: フィールド存在

in: 値が配列に含まれる

例：

json
{ "all": [
{ "eq": ["repo.worktree_clean", false] },
{ "eq": ["thresholds.require_clean_worktree", true] }
]}

4. ルールセット本体（v1）
4.1 優先度（評価順）

1〜99：Preflight／安全（needs_input中心）

100〜199：Plan品質（needs_input）

200〜299：Stepサイズ／ガード（needs_input→failed移行含む）

300〜399：テスト（needs_input/failed）

900〜999：done要件不足（failedまたはneeds_input）

default：done

5. 標準ルール（JSON）

実ファイル想定：.aiflow/quality-gates.v1.json（実装では同梱し、D11で差し替え可能にしてよい）

json
{
"version": "1.0",
"rules": [
{
"id": "QG-001-WORKTREE-DIRTY",
"priority": 10,
"when": {
"all": [
{ "eq": ["thresholds.require_clean_worktree", true] },
{ "eq": ["repo.worktree_clean", false] }
]
},
"decision": {
"status": "needs_input",
"error_code": "WORKTREE_DIRTY",
"severity": "Blocker",
"message": "Working tree is dirty. Commit or stash changes before running.",
"actions": [
{ "label": "Check status", "cmd": "git status --porcelain" },
{ "label": "Stash", "cmd": "git stash -u" }
]
}
},
{
"id": "QG-002-NOT-A-GIT-REPO",
"priority": 20,
"when": { "eq": ["repo.is_git_repo", false] },
"decision": {
"status": "failed",
"error_code": "NOT_A_GIT_REPO",
"severity": "Blocker",
"message": "Not a git repository. Initialize or run inside a git repo.",
"actions": [
{ "label": "Init git", "cmd": "git init" }
]
}
},
{
"id": "QG-003-ORIGIN-MISSING",
"priority": 30,
"when": { "eq": ["repo.origin_exists", false] },
"decision": {
"status": "needs_input",
"error_code": "REMOTE_ORIGIN_MISSING",
"severity": "Major",
"message": "Remote 'origin' is missing. Configure origin to enable push/compare URL.",
"actions": [
{ "label": "List remotes", "cmd": "git remote -v" }
]
}
},
{
"id": "QG-004-BASE-BRANCH-MISSING",
"priority": 40,
"when": { "eq": ["repo.base_branch_exists", false] },
"decision": {
"status": "needs_input",
"error_code": "BASE_BRANCH_NOT_FOUND",
"severity": "Major",
"message": "Base branch not found. Check base branch name or fetch remotes.",
"actions": [
{ "label": "Fetch", "cmd": "git fetch origin" }
]
}
},

{
"id": "QG-101-AC-COUNT",
"priority": 110,
"when": { "lt": ["request.acceptance_criteria.count", 3] },
"decision": {
"status": "needs_input",
"error_code": "AMBIGUOUS_REQUIREMENT",
"severity": "Major",
"message": "Acceptance criteria are insufficient (<3). Add at least 3 ACs.",
"actions": [
{ "label": "Edit request", "cmd": "open requests/<id>.md" }
]
}
},
{
"id": "QG-102-PLAN-INVALID",
"priority": 120,
"when": { "eq": ["plan.valid", false] },
"decision": {
"status": "failed",
"error_code": "PLAN_INVALID",
"severity": "Blocker",
"message": "Plan output is invalid or cannot be parsed/validated.",
"actions": [
{ "label": "Re-run planning", "cmd": "aiflow run <id> --phase planning" }
]
}
},
{
"id": "QG-103-STEPS-COUNT",
"priority": 130,
"when": {
"all": [
{ "gt": ["plan.steps_count", 0] },
{ "eq": ["plan.steps_count", 1] },
{ "any": [
{ "gt": ["plan.steps.0.max_diff_lines", 300] },
{ "gt": ["plan.steps.0.max_files", 10] }
]}
]
},
"decision": {
"status": "needs_input",
"error_code": "STEP_TOO_LARGE",
"severity": "Major",
"message": "Single step is too large. Split implementation into smaller steps.",
"actions": [
{ "label": "Re-plan with more steps", "cmd": "aiflow run <id> --phase planning" }
]
}
},

{
"id": "QG-201-STEP-DIFF-LIMIT",
"priority": 210,
"when": {
"any": [
{ "gt": ["plan.steps.*.max_diff_lines", "thresholds.step_max_diff_lines"] }
]
},
"decision": {
"status": "needs_input",
"error_code": "STEP_TOO_LARGE",
"severity": "Major",
"message": "Step exceeds diff lines threshold. Split into smaller steps.",
"actions": [
{ "label": "Adjust thresholds (temporary)", "cmd": "edit .aiflowrc.json" }
]
}
},
{
"id": "QG-202-STEP-FILES-LIMIT",
"priority": 220,
"when": {
"any": [
{ "gt": ["plan.steps.*.max_files", "thresholds.step_max_files"] }
]
},
"decision": {
"status": "needs_input",
"error_code": "STEP_TOO_LARGE",
"severity": "Major",
"message": "Step exceeds files touched threshold. Split into smaller steps.",
"actions": []
}
},
{
"id": "QG-203-RETRY-EXCEEDED",
"priority": 290,
"when": {
"any": [
{ "gt": ["execution.attempts.step_fix", "execution.limits.step_fix_retries"] },
{ "gt": ["execution.attempts.e2e", "execution.limits.e2e_retries"] },
{ "gt": ["execution.attempts.plan", "execution.limits.plan_retries"] }
]
},
"decision": {
"status": "failed",
"error_code": "RETRY_EXCEEDED",
"severity": "Blocker",
"message": "Retry limit exceeded. Manual intervention required.",
"actions": [
{ "label": "Open logs", "cmd": "aiflow logs <id>" }
]
}
},

{
"id": "QG-301-UNIT-REQUIRED",
"priority": 310,
"when": {
"all": [
{ "eq": ["thresholds.require_unit_if_available", true] },
{ "eq": ["checks.unit.ran", true] },
{ "eq": ["checks.unit.passed", false] }
]
},
"decision": {
"status": "failed",
"error_code": "UNIT_TEST_FAILED",
"severity": "Blocker",
"message": "Unit tests failed.",
"actions": [
{ "label": "Re-run unit tests", "cmd": "vendor/bin/phpunit" }
]
}
},
{
"id": "QG-302-E2E-REQUIRED-FOR-REGRESSION",
"priority": 320,
"when": {
"all": [
{ "eq": ["thresholds.require_e2e_for_regression_ac", true] },
{ "eq": ["request.acceptance_criteria.has_regression_ac", true] },
{ "any": [
{ "eq": ["checks.e2e.ran", false] },
{ "eq": ["checks.e2e.passed", false] }
]}
]
},
"decision": {
"status": "needs_input",
"error_code": "E2E_TEST_FAILED",
"severity": "Blocker",
"message": "E2E is required for regression AC but did not pass or did not run.",
"actions": [
{ "label": "Re-run e2e", "cmd": "npm run test:e2e" }
]
}
},

{
"id": "QG-901-COMPARE-URL-MISSING",
"priority": 910,
"when": { "eq": ["checks.compare_url_generated", false] },
"decision": {
"status": "needs_input",
"error_code": "PUSH_FAILED",
"severity": "Major",
"message": "Compare URL could not be generated. Push may have failed or origin is missing.",
"actions": [
{ "label": "Manual push", "cmd": "git push -u origin <branch>" }
]
}
},
{
"id": "QG-902-REPORT-MISSING",
"priority": 920,
"when": { "eq": ["checks.report_written", false] },
"decision": {
"status": "failed",
"error_code": "REPORT_MISSING",
"severity": "Major",
"message": "Report was not written. This is a tool failure.",
"actions": [
{ "label": "Inspect runner log", "cmd": "aiflow logs <id>" }
]
}
},

{
"id": "QG-999-DONE",
"priority": 999,
"when": { "eq": ["plan.valid", true] },
"decision": {
"status": "done",
"error_code": "OK",
"severity": "Minor",
"message": "All required quality gates passed.",
"actions": [
{ "label": "Open compare URL", "cmd": "(see report)" }
]
}
}
]
}

6. 実装上の注意（v1で割り切る点）
6.1 ワイルドカード plan.steps.* の扱い

上の例は「表現」として記載している。実装では次のどちらかにする。

ルールエンジンが * を展開（推奨）

生成段階で plan.steps_max_diff_lines_over のような集約フィールドを作り、条件は集約値に対して判定（より簡単）

v1では後者（集約値）を推奨。例：

plan.max_step_diff_lines

plan.max_step_files

plan.any_step_over_diff_limit（boolean）

6.2 needs_input と failed の設計意図

環境や要件補完が必要 → needs_input

ツールが収束しない／内部不整合 → failed
この境界がブレないよう、RETRY_EXCEEDED は failed に寄せる（D17方針）

6.3 ルール更新と後方互換

rules.version を保持し、Runnerは run成果物に quality_gates_version を記録すること

7. 生成物への反映（必須）
7.1 errors.json

ルールで status != done になった場合、decision情報を格納する。

json
{
"code": "E2E_TEST_FAILED",
"severity": "Blocker",
"message": "E2E is required for regression AC but did not pass or did not run.",
"actions": [
{ "label": "Re-run e2e", "cmd": "npm run test:e2e" }
]
}

7.2 stage.json

最終結果として以下を確定する。

status

reason_code（= error_code）

reason_message

8. 受け入れ基準（本Spec）

判定ルールがJSONとして管理でき、D11で差し替え可能

RunnerはContextを生成し、ルール評価で最終statusを決める

UIは reason_code/message/actions を表示できる

done/needs_input/failed がD17の運用意図と一致する

必要なら次に、Context の正式スキーマ（Zod/Ajv用）を D17-B として切り出すと、ルール運用がさらに安定します。

