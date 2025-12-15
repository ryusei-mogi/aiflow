D17-B. 品質ゲート評価コンテキスト仕様（Context Schema Spec）v1.0

対象：aiflow-local（Runner/Server/UI の Quality Gate Engine）
前提：D17（品質ゲート）／D17-A（ルールJSON）／D10（Runner）／D14（FS）
目的：D17-Aのルール評価に必要な Context JSON を、機械的に検証できるスキーマとして確定する（Runnerが生成し、UIが参照可能）

1. スコープ

Runnerが run ごとに生成する quality_context.json（ファイル名は実装都合でOK）を対象

ルール評価はこのContextのみを参照（外部状態に依存しない）

Contextは 完全に検証可能（JSON Schemaでvalidate） であること

2. バージョニング

Contextは context_version を必須とし、SemVer文字列で管理する（例："1.0.0"）

Run成果物（stage.json）に quality_context_version を記録する（監査・再評価のため）

3. 生成タイミング

Contextは以下のタイミングで更新・保存されることを想定する（v1推奨）。

Preflight直後（repo情報が確定）

Plan生成直後（AC/stepsが確定）

テスト実行直後（checksが確定）

最終判定直前（compare/reportの有無が確定）

常に「最新のContextが1つ」存在すればよい。履歴が必要なら quality_context.snapshots/ などはv2以降。

4. Contextの正規構造（要件）

必須トップレベルキー：context_version, request, repo, plan, execution, checks, thresholds, timestamps

ルールでの判定を簡単にするため、plan.steps.* のようなワイルドカード評価は v1では避け、集約フィールド（max/any_over） を必ず用意する

5. JSON Schema（Draft 2020-12）

そのまま schemas/quality-context.v1.schema.json として管理可能

json
{
"$schema": "https://json-schema.org/draft/2020-12/schema",
"$id": "https://aiflow.local/schemas/quality-context.v1.schema.json",
"title": "aiflow-local Quality Gate Context",
"type": "object",
"additionalProperties": false,
"required": [
"context_version",
"request",
"repo",
"plan",
"execution",
"checks",
"thresholds",
"timestamps"
],
"properties": {
"context_version": {
"type": "string",
"pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
},

"request": {
"type": "object",
"additionalProperties": false,
"required": ["id", "path", "meta", "acceptance_criteria", "test_instructions"],
"properties": {
"id": { "type": "string", "minLength": 3 },
"path": { "type": "string", "minLength": 1 },
"meta": {
"type": "object",
"additionalProperties": false,
"required": ["priority", "type", "area", "base"],
"properties": {
"priority": { "type": "string", "enum": ["P0", "P1", "P2", "P3"] },
"type": { "type": "string", "enum": ["feature", "bugfix", "refactor", "chore", "doc"] },
"area": {
"type": "array",
"items": { "type": "string", "enum": ["ui", "api", "db", "infra", "test", "docs", "other"] },
"minItems": 1,
"uniqueItems": true
},
"base": { "type": "string", "minLength": 1 }
}
},
"acceptance_criteria": {
"type": "object",
"additionalProperties": false,
"required": ["count", "has_regression_ac"],
"properties": {
"count": { "type": "integer", "minimum": 0 },
"has_regression_ac": { "type": "boolean" }
}
},
"test_instructions": {
"type": "object",
"additionalProperties": false,
"required": ["unit_required", "e2e_required"],
"properties": {
"unit_required": { "type": "boolean" },
"e2e_required": { "type": "boolean" }
}
}
}
},

"repo": {
"type": "object",
"additionalProperties": false,
"required": [
"is_git_repo",
"worktree_clean",
"origin_exists",
"base_branch_exists",
"base_branch",
"head_branch"
],
"properties": {
"is_git_repo": { "type": "boolean" },
"worktree_clean": { "type": "boolean" },
"origin_exists": { "type": "boolean" },
"base_branch_exists": { "type": "boolean" },
"base_branch": { "type": "string", "minLength": 1 },
"head_branch": { "type": "string", "minLength": 1 },

"last_commit": {
"type": "object",
"additionalProperties": false,
"required": ["sha", "message"],
"properties": {
"sha": { "type": "string", "minLength": 7 },
"message": { "type": "string" }
}
}
}
},

"plan": {
"type": "object",
"additionalProperties": false,
"required": [
"valid",
"steps_count",
"max_step_diff_lines",
"max_step_files",
"any_step_over_diff_limit",
"any_step_over_files_limit",
"steps"
],
"properties": {
"valid": { "type": "boolean" },
"steps_count": { "type": "integer", "minimum": 0 },

"max_step_diff_lines": { "type": "integer", "minimum": 0 },
"max_step_files": { "type": "integer", "minimum": 0 },
"any_step_over_diff_limit": { "type": "boolean" },
"any_step_over_files_limit": { "type": "boolean" },

"steps": {
"type": "array",
"items": {
"type": "object",
"additionalProperties": false,
"required": ["id", "max_diff_lines", "max_files", "requires_unit", "requires_e2e"],
"properties": {
"id": { "type": "string", "minLength": 2 },
"max_diff_lines": { "type": "integer", "minimum": 0 },
"max_files": { "type": "integer", "minimum": 0 },
"requires_unit": { "type": "boolean" },
"requires_e2e": { "type": "boolean" }
}
}
}
}
},

"execution": {
"type": "object",
"additionalProperties": false,
"required": ["attempts", "limits"],
"properties": {
"attempts": {
"type": "object",
"additionalProperties": false,
"required": ["plan", "step_fix", "unit", "e2e"],
"properties": {
"plan": { "type": "integer", "minimum": 0 },
"step_fix": { "type": "integer", "minimum": 0 },
"unit": { "type": "integer", "minimum": 0 },
"e2e": { "type": "integer", "minimum": 0 }
}
},
"limits": {
"type": "object",
"additionalProperties": false,
"required": ["plan_retries", "step_fix_retries", "unit_retries", "e2e_retries"],
"properties": {
"plan_retries": { "type": "integer", "minimum": 0 },
"step_fix_retries": { "type": "integer", "minimum": 0 },
"unit_retries": { "type": "integer", "minimum": 0 },
"e2e_retries": { "type": "integer", "minimum": 0 }
}
}
}
},

"checks": {
"type": "object",
"additionalProperties": false,
"required": [
"compare_url_generated",
"compare_url",
"report_written",
"unit",
"e2e"
],
"properties": {
"compare_url_generated": { "type": "boolean" },
"compare_url": { "type": ["string", "null"] },
"report_written": { "type": "boolean" },

"unit": {
"type": "object",
"additionalProperties": false,
"required": ["available", "ran", "passed", "cmd", "log_path"],
"properties": {
"available": { "type": "boolean" },
"ran": { "type": "boolean" },
"passed": { "type": "boolean" },
"cmd": { "type": ["string", "null"] },
"log_path": { "type": ["string", "null"] }
}
},

"e2e": {
"type": "object",
"additionalProperties": false,
"required": ["available", "ran", "passed", "cmd", "log_path"],
"properties": {
"available": { "type": "boolean" },
"ran": { "type": "boolean" },
"passed": { "type": "boolean" },
"cmd": { "type": ["string", "null"] },
"log_path": { "type": ["string", "null"] }
}
}
},
"allOf": [
{
"if": { "properties": { "compare_url_generated": { "const": true } } },
"then": { "properties": { "compare_url": { "type": "string", "minLength": 1 } } }
}
]
},

"thresholds": {
"type": "object",
"additionalProperties": false,
"required": [
"step_max_diff_lines",
"step_max_files",
"require_clean_worktree",
"require_e2e_for_regression_ac",
"require_unit_if_available"
],
"properties": {
"step_max_diff_lines": { "type": "integer", "minimum": 1 },
"step_max_files": { "type": "integer", "minimum": 1 },
"require_clean_worktree": { "type": "boolean" },
"require_e2e_for_regression_ac": { "type": "boolean" },
"require_unit_if_available": { "type": "boolean" }
}
},

"timestamps": {
"type": "object",
"additionalProperties": false,
"required": ["started_at", "updated_at"],
"properties": {
"started_at": { "type": "string", "format": "date-time" },
"updated_at": { "type": "string", "format": "date-time" }
}
}
}
}

6. 正規化ルール（Runner側の必須責務）

スキーマを満たすだけでなく、意味が一貫するために Runner は以下を保証する。

6.1 plan集約フィールドの算出

max_step_diff_lines = max(steps[].max_diff_lines)

max_step_files = max(steps[].max_files)

any_step_over_diff_limit = (max_step_diff_lines > thresholds.step_max_diff_lines)

any_step_over_files_limit = (max_step_files > thresholds.step_max_files)

steps_count = steps.length

6.2 unit/e2e の available と ran の整合

available=false の場合、ran=false を推奨（v1では強制してよい）

ran=false の場合、passed=false でもよいが、ルール側が誤判定しないよう available と併用する

6.3 compare_url の整合

compare_url_generated=true の場合、compare_url は non-null/non-empty

生成不能時は compare_url_generated=false かつ compare_url=null

7. 最小Context例（バリデーション通過の最小形）
json
{
"context_version": "1.0.0",
"request": {
"id": "RQ-20251214-001-login-timeout",
"path": "requests/RQ-20251214-001-login-timeout.md",
"meta": { "priority": "P2", "type": "feature", "area": ["ui"], "base": "main" },
"acceptance_criteria": { "count": 3, "has_regression_ac": true },
"test_instructions": { "unit_required": true, "e2e_required": true }
},
"repo": {
"is_git_repo": true,
"worktree_clean": true,
"origin_exists": true,
"base_branch_exists": true,
"base_branch": "main",
"head_branch": "ai/RQ-20251214-001-login-timeout"
},
"plan": {
"valid": true,
"steps_count": 2,
"max_step_diff_lines": 120,
"max_step_files": 6,
"any_step_over_diff_limit": false,
"any_step_over_files_limit": false,
"steps": [
{ "id": "S01", "max_diff_lines": 120, "max_files": 6, "requires_unit": true, "requires_e2e": false },
{ "id": "S02", "max_diff_lines": 80, "max_files": 3, "requires_unit": true, "requires_e2e": true }
]
},
"execution": {
"attempts": { "plan": 1, "step_fix": 0, "unit": 1, "e2e": 1 },
"limits": { "plan_retries": 2, "step_fix_retries": 2, "unit_retries": 1, "e2e_retries": 1 }
},
"checks": {
"compare_url_generated": true,
"compare_url": "https://example/compare",
"report_written": true,
"unit": { "available": true, "ran": true, "passed": true, "cmd": "vendor/bin/phpunit", "log_path": "runs/.../unit.log" },
"e2e": { "available": true, "ran": true, "passed": true, "cmd": "npm run test:e2e", "log_path": "runs/.../e2e.log" }
},
"thresholds": {
"step_max_diff_lines": 300,
"step_max_files": 10,
"require_clean_worktree": true,
"require_e2e_for_regression_ac": true,
"require_unit_if_available": true
},
"timestamps": {
"started_at": "2025-12-14T13:20:00+09:00",
"updated_at": "2025-12-14T13:24:10+09:00"
}
}

8. 受け入れ基準（本Spec）

Runnerが生成するContextが本スキーマで常にvalidateできる

D17-AのルールがContextのフィールドのみで評価できる（外部参照不要）

集約フィールドにより、v1のルール評価が単純・堅牢になる

UIは checks と thresholds と plan の主要値から、判定根拠を表示できる

次に進めるなら、D17-AのルールJSONも同様に JSON Schema化（ルールスキーマ） しておくと、設定ミス（typoや不正なwhen式）で事故らなくなります。必要なら D17-C（Quality Rules Schema） を作れます。

