D31. .aiflow/ 初期ファイル一式（config / quality-gates / messages / schemas 雛形）v1.0

対象：aiflow-local を動かすために 最初にGit管理しておくべき設定資材 を確定する。
目的：Runner/Server/UI が参照する “固定資材” を置き、以後の調整をファイル差分で回せるようにする。

0. 生成するファイル一覧（v1）

配置（リポジトリroot）：

pgsql
.aiflow/
config.v1.json
quality-gates.v1.json
messages/
messages.v1.ja.json
schemas/
planner.contract.v1.json
implementer.contract.v1.json
qa.contract.v1.json
prompts/
planner.v1.md
implementer.v1.md
qa.v1.md

D31-1. .aiflow/config.v1.json（雛形）
json
{
"version": "1.0",
"server": {
"host": "127.0.0.1",
"port": 7331
},
"ui": {
"port": 7332,
"api_base": "http://localhost:7331"
},
"repo": {
"base_branch": "main"
},
"paths": {
"requests_dir": "requests",
"runs_dir": "runs",
"aiflow_dir": ".aiflow"
},
"planning": {
"default_steps": { "min": 3, "max": 5, "hard_max": 7 },
"default_limits": { "max_diff_lines": 300, "max_files": 10, "max_minutes": 15 }
},
"runner": {
"poll_stage_ms": 1200,
"role_retry_max": 2,
"run_lock": { "enabled": true }
},
"git": {
"branch_prefix": "ai/",
"max_branch_len": 128
},
"llm": {
"mode": "cli_only",
"router": {
"planner": "codex",
"implementer": "codex",
"qa": "claude"
},
"cli": {
"codex": { "enabled": true, "command": "codex", "model": "gpt-5.2", "effort": "xhigh" },
"claude": { "enabled": true, "command": "claude", "model": "sonnet", "output_format": "json" },
"gemini": { "enabled": true, "command": "gemini", "model": "gemini-3-pro", "output_format": "json" }
}
}
}


注：モデル名は環境依存で変わり得るので、v1は “文字列のまま” 扱い、doctorで存在確認する設計が安全。

D31-2. .aiflow/quality-gates.v1.json（雛形）
json
{
"version": "1.0",
"gates": [
{
"id": "G-01",
"name": "No gh dependency",
"severity": "Blocker",
"check": { "type": "string_absence", "paths": ["tools/aiflow/**"], "pattern": "\\bgh\\b" }
},
{
"id": "G-02",
"name": "Runs directory is gitignored",
"severity": "Major",
"check": { "type": "gitignore_contains", "path": ".gitignore", "line": "runs/" }
},
{
"id": "G-03",
"name": "Stage exists",
"severity": "Blocker",
"check": { "type": "file_exists", "path": "runs/{{request_id}}/{{run_id}}/stage.json" }
},
{
"id": "G-04",
"name": "Report exists",
"severity": "Blocker",
"check": { "type": "file_exists", "path": "runs/{{request_id}}/{{run_id}}/report.md" }
},
{
"id": "G-05",
"name": "Server health endpoint",
"severity": "Major",
"check": { "type": "http_status", "url": "http://localhost:7331/api/health", "status": 200 }
}
]
}


v1はチェックタイプを最小（file_exists / gitignore_contains / string_absence / http_status）に限定。Runner側で解釈して評価する。

D31-3. .aiflow/messages/messages.v1.ja.json（雛形）
json
{
"version": "1.0",
"reason_codes": {
"JSON_PARSE_ERROR": {
"title": "AI出力のJSONが壊れています",
"summary": "出力が単一JSONになっていないか、パース不能です。",
"actions": [
"直前のLLM出力ログを確認（runs/.../logs/）",
"プロンプトテンプレ（.aiflow/prompts）に余計な出力禁止が入っているか確認",
"再Run（同じStepを再実行）"
]
},
"JSON_SCHEMA_INVALID": {
"title": "AI出力がContractに不一致です",
"summary": "D27のContractに合っていません。",
"actions": [
"schemasの必須項目を確認（.aiflow/schemas）",
"該当ロールを再実行"
]
},
"RUN_IN_PROGRESS": {
"title": "同一RequestのRunが実行中です",
"summary": "二重実行を防止しています。",
"actions": [
"Run詳細画面で進捗を確認",
"完了後に再実行"
]
},
"GIT_NOT_REPO": {
"title": "gitリポジトリではありません",
"summary": "このディレクトリはgit管理されていません。",
"actions": [
"git init する、または正しいリポジトリで起動する"
]
},
"WORKTREE_DIRTY": {
"title": "未コミット変更があります",
"summary": "差分混入を避けるため停止しました。",
"actions": [
"git status を確認",
"コミット/スタッシュしてから再Run"
]
},
"ORIGIN_MISSING": {
"title": "origin が設定されていません",
"summary": "compare URLを作れません。",
"actions": [
"git remote -v を確認",
"origin を追加してから再Run（必要なら）"
]
},
"REMOTE_NOT_GITHUB": {
"title": "GitHub以外のremoteです",
"summary": "v1はGitHub compare URLのみ対応です。",
"actions": [
"GitHub remoteに切り替える（必要なら）",
"compare URL生成をスキップして継続（v1）"
]
},
"STEP_TOO_LARGE": {
"title": "Stepが大きすぎます",
"summary": "途中停止リスクが高いためplanningの分割が必要です。",
"actions": [
"planningを再実行してStepを増やす（3〜5推奨）",
"targets.paths を絞る"
]
},
"UNIT_TEST_FAILED": {
"title": "単体テストが失敗しました",
"summary": "修正が必要です。",
"actions": [
"runs/.../logs/unit.log を確認",
"失敗箇所を修正して再Run"
]
},
"E2E_TEST_FAILED": {
"title": "E2Eテストが失敗しました",
"summary": "ブラウザ操作の期待結果に一致していません。",
"actions": [
"runs/.../logs/e2e.log を確認",
"UI/フロー差分を修正して再Run"
]
}
}
}

D31-4. .aiflow/schemas/*.contract.v1.json（雛形）

v1は最小の必須項目だけをJSON Schemaで縛る（厳密にしすぎると運用が折れるため）。

planner.contract.v1.json
json
{
"$schema": "http://json-schema.org/draft-07/schema#",
"title": "Planner Contract v1",
"type": "object",
"required": ["contract_version", "role", "status", "summary"],
"properties": {
"contract_version": { "type": "string", "const": "1.0" },
"role": { "type": "string", "const": "planner" },
"status": { "type": "string", "enum": ["ok", "needs_input", "failed"] },
"summary": { "type": "string" },
"planning": { "type": ["object", "null"] }
},
"additionalProperties": true
}

implementer.contract.v1.json
json
{
"$schema": "http://json-schema.org/draft-07/schema#",
"title": "Implementer Contract v1",
"type": "object",
"required": ["contract_version", "role", "status", "summary"],
"properties": {
"contract_version": { "type": "string", "const": "1.0" },
"role": { "type": "string", "const": "implementer" },
"status": { "type": "string", "enum": ["ok", "needs_input", "failed"] },
"summary": { "type": "string" },
"reason_code": { "type": "string" },
"patch": {
"type": ["object", "null"],
"properties": {
"format": { "type": "string" },
"diff": { "type": "string" }
},
"additionalProperties": true
}
},
"additionalProperties": true
}

qa.contract.v1.json
json
{
"$schema": "http://json-schema.org/draft-07/schema#",
"title": "QA Contract v1",
"type": "object",
"required": ["contract_version", "role", "status", "summary", "issues"],
"properties": {
"contract_version": { "type": "string", "const": "1.0" },
"role": { "type": "string", "const": "qa" },
"status": { "type": "string", "enum": ["ok", "failed"] },
"summary": { "type": "string" },
"issues": { "type": "array" }
},
"additionalProperties": true
}

D31-5. .aiflow/prompts/*.v1.md（雛形：D28準拠）

ここでは 共通ヘッダーを実ファイルに埋め込んだ 形で提示します（Runner側で差し込み不要にできる）。

prompts/planner.v1.md
md
あなたは aiflow-local の planner ロールです。
出力は **単一のJSONオブジェクトのみ**。それ以外の文字を一切出力しないでください。
- contract_version は "1.0" 固定
- role は "planner" 固定
- status は ok | needs_input | failed
- コードブロックは禁止
- 余計な説明は禁止

目的：requests の要望を実装可能な小さなStep（3〜5）に分割し、planning.json相当の内容を返す。

制約：
{{constraints}}

品質ゲート（参照）：
{{quality_gates_json}}

Step上限（必須遵守）：
{{planning_limits_json}}

入力：Request Markdown
{{request_markdown}}

出力要件：
- D27 Planner Contract に準拠
- stepsは原則3〜5（最大7）
- UI/Server/Runner/Testsを同Stepに詰め込まない
- targets.pathsを絞る

出力：

prompts/implementer.v1.md
md
あなたは aiflow-local の implementer ロールです。
出力は **単一のJSONオブジェクトのみ**。それ以外の文字を一切出力しないでください。
- contract_version は "1.0" 固定
- role は "implementer" 固定
- status は ok | needs_input | failed
- コードブロックは禁止
- 余計な説明は禁止

目的：指定されたStepを実装する unified diff を生成し、JSONの patch.diff に入れて返す。

制約：
{{constraints}}

Step（このStepだけ）：
{{step_json}}

対象ファイル（現状）：
{{targets_snapshot}}

出力要件：
- D27 Implementer Contractに準拠
- patch.format="unified_diff"
- patch.diff に unified diff を入れる（diff以外禁止）
- limits超過が避けられない場合のみ status=needs_input + reason_code=STEP_TOO_LARGE

出力：

prompts/qa.v1.md
md
あなたは aiflow-local の qa ロールです。
出力は **単一のJSONオブジェクトのみ**。それ以外の文字を一切出力しないでください。
- contract_version は "1.0" 固定
- role は "qa" 固定
- status は ok | failed
- コードブロックは禁止
- 余計な説明は禁止

目的：diffとログから指摘・追加テスト案を返す。

制約：
{{constraints}}

Acceptance Criteria：
{{acceptance_criteria_json}}

diff（base...HEAD）：
{{diff_base_to_head}}

Unit log excerpt：
{{unit_log_excerpt}}

E2E log excerpt：
{{e2e_log_excerpt}}

出力要件：
- D27 QA Contractに準拠
- issues に severity/description を含める

出力：

1. 受け入れ基準（D31）

.aiflow/ 一式を配置すれば、Runner/Server/UI が参照できる

reason_code → messages が引ける

Contract schema が最低限の検証に使える

prompts が「単一JSONのみ」を強制できる

次は、ここまでで実装に必要な“固定資材”が揃ったので、D32. Doctor仕様（チェック項目・FAIL/WARNの境界・UI表示） を作っておくと、初期PoCで詰まりにくくなります。

