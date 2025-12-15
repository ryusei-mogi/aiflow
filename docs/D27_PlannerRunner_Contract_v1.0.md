D27. Planner/Runner 入出力プロンプト契約（Contract）v1.0

対象：aiflow-local が利用する LLM（Codex CLI / Claude CLI / Gemini CLI いずれでも可）
目的：モデルやCLIが変わっても、planning / step実行 / QA が「壊れない」ように、入出力形式と失敗時の扱いを固定する。
前提：実装方法（どうやるか）はAIに任せるが、返すべきフォーマット と リトライ条件 は固定する。

1. 共通ルール（全ロール共通）
1.1 出力は「単一JSON」

余計なテキスト、前置き、コードブロックは 禁止

出力は JSONオブジェクト1つのみ（トップレベル配列も不可）

1.2 JSONが壊れたら即失敗（v1）

v1は自動修復しない

Runnerは JSON_PARSE_ERROR として NEEDS_INPUT（またはfailed）へ落とす

1.3 出力に必ず含めるメタ

contract_version

role

status

summary

artifacts（生成物のパス/種類、または “生成しない” 明示）

1.4 statusの共通値

ok：完了（次フェーズへ）

needs_input：人間の追加情報が必要

blocked：環境/権限/依存で止まっている（doctor相当）

failed：ロール内で失敗（修正不能）

2. ロール別 Contract
2.1 Planner Contract（planning.json生成）
Input（Runner → Planner）

Runnerが渡す入力は概ね以下（実際の渡し方は自由）：

request markdown（全文）

前提/制約（固定：PHP/Laravel/MySQL、既存壊さない、gh不要など）

.aiflow/quality-gates.v1.json（参照用）

.aiflow/config.v1.json（base_branchなど）

Step上限（D26）

Output（Planner → Runner）

Plannerは planning.json をそのまま返す（ファイル書き込みはRunner側）。

Planner出力スキーマ（契約）
json
{
"contract_version": "1.0",
"role": "planner",
"status": "ok|needs_input|failed",
"summary": "string",
"planning": {
"version": "1.0",
"request_id": "string",
"base_branch": "string",
"strategy": {
"max_steps": 7,
"min_steps": 2,
"step_limits": {
"max_diff_lines": 300,
"max_files": 10,
"max_minutes": 15
}
},
"assumptions": ["string"],
"acceptance_criteria": [{ "id": "AC-01", "text": "string" }],
"risk_checks": [{ "id": "R-01", "severity": "high|mid|low", "text": "string" }],
"steps": [
{
"step_id": "S01",
"title": "string",
"intent": "bootstrap|feature|refactor|tests|docs|fix",
"targets": { "paths": ["string"], "file_globs": ["string"] },
"deliverables": ["string"],
"tests": [{ "type": "unit|e2e|none", "command": "string", "required": true }],
"limits": { "max_diff_lines": 300, "max_files": 10 },
"depends_on": ["S00"]
}
],
"completion": {
"definition": ["string"],
"stop_conditions": [{ "reason_code": "string", "when": "string" }]
}
},
"artifacts": {
"write_files": [],
"notes": []
}
}

needs_inputのとき
json
{
"contract_version":"1.0",
"role":"planner",
"status":"needs_input",
"summary":"追加情報が必要です",
"questions":[
{"id":"Q-01","text":"base branchはmainで良い？"},
{"id":"Q-02","text":"UIはReactで確定？"}
],
"planning": null,
"artifacts": { "write_files": [], "notes": [] }
}


ただしユーザー方針として「確認質問はしない」運用が強いので、v1では questionsは空でもよい。
その場合は assumptions を置いて status=ok で進める。

2.2 Implementer Contract（Step単位の変更パッチ生成）
Input（Runner → Implementer）

planning.json（該当stepのみ抽出して渡して良い）

変更対象ファイル（targets.pathsで絞った現行内容）

コーディング規約（あれば）

現在のgit diff（参考として渡しても良い）

Step limits（diff行数/ファイル数）

Output（Implementer → Runner）

Implementerは unified diff を JSON内の文字列として返す（Runnerが適用する）。
また、Stepが大きいと判断した場合は needs_input で reason_code を返す。

json
{
"contract_version": "1.0",
"role": "implementer",
"status": "ok|needs_input|failed",
"summary": "string",
"reason_code": "",
"patch": {
"format": "unified_diff",
"diff": "string"
},
"changeset": {
"estimated_files": 5,
"estimated_lines": 180
},
"tests_to_run": [
{ "type": "unit|e2e", "command": "string", "required": true }
],
"artifacts": {
"write_files": [],
"notes": ["string"]
}
}

Stepが大きすぎる（STEP_TOO_LARGE）
json
{
"contract_version":"1.0",
"role":"implementer",
"status":"needs_input",
"summary":"このStepはlimitsを超える可能性があります。planningで分割してください。",
"reason_code":"STEP_TOO_LARGE",
"patch": null,
"changeset": { "estimated_files": 18, "estimated_lines": 900 },
"tests_to_run": [],
"artifacts": { "write_files": [], "notes": [] }
}

2.3 QA Contract（diff + logs を評価して指摘/追加テスト提案）
Input

spec/AC（request or spec要約）

git diff（base...HEAD）

unit/e2e結果要約（ログ抜粋）

Output
json
{
"contract_version": "1.0",
"role": "qa",
"status": "ok|failed",
"summary": "string",
"issues": [
{
"severity": "Blocker|Major|Minor",
"description": "string",
"file": "string",
"line": 123
}
],
"recommended_tests": [
{ "type": "unit|e2e", "description": "string" }
],
"patch_suggestions": {
"format": "unified_diff|text",
"content": "string"
},
"auto_merge_recommended": false,
"artifacts": { "write_files": [], "notes": [] }
}

3. Runner側の必須バリデーション

Runnerは以下を必ずチェックして、不一致なら JSON_SCHEMA_INVALID で停止する。

contract_version == "1.0"

role が期待値

status が許可値

Planner：planning != null（status=okのとき）

Implementer：patch.diff が存在（status=okのとき）

reason_code は辞書キー（D18-B）に一致（存在する場合）

4. リトライ規約（v1）

同じロールで最大2回まで（無限ループ防止）

リトライ条件

JSONが壊れた

schema不一致

リトライしない条件

needs_input（人間対応が必要）

failed（ロール内で詰んでいる）

5. 受け入れ基準（D27）

Planner/Implementer/QA が 常に単一JSON を返す運用が確立する

Runnerがschema validationで早期に崩壊を検知できる

Stepが大きくなりそうなときに STEP_TOO_LARGE で確実に止められる

次に作るべきは、これらContractを実際にCodex/Claude/Gemini CLIで安定運用するための D28. Promptテンプレート仕様（role別テンプレ + 変数置換 + 禁止事項）v1 です。

