D42. プロンプト契約（role別入力・出力・禁止事項・schema・分割強制）v1.0

対象：aiflow-local が呼び出す LLM（codex/claude/gemini CLI）への 共通契約 と ロール別プロンプト
目的：出力崩壊を減らし、Step細分化（長文中断問題）をプロンプト側で強制し、Runnerが機械的に処理できる形に揃える。
前提：実装方法はAIに任せる運用でも、入力/出力の形だけは固定する必要があるため、ここを仕様化する。

1. 共通契約（全ロール共通）
1.1 絶対ルール（v1）

出力は 必ず JSON 1オブジェクトのみ（前後に説明文禁止）

JSONはUTF-8、改行OK

version: "1.0" を必須

reasoning や思考の開示を要求しない（出力安定優先）

ファイルパスは repo-root 相対

既存仕様を壊さない（破壊的変更は明示し、基本禁止）

gh コマンドは禁止（言及も不要）

1.2 分割強制（長文中断対策）

すべてのロールの出力に next_steps[]（機械実行用）を含める

1回の implement は 最大変更量 を守る（後述）

1.3 最大変更量（v1）

1 Step の想定差分上限：max_diff_lines（configから入力）

これを超えるときは 必ず step を分割し、STEP_TOO_LARGE を出さない設計に寄せる

ただし、どうしても超えるなら risk_flags: ["STEP_TOO_LARGE"] を出し、Runnerがreplan誘導できるようにする

2. JSON共通スキーマ（v1）

全ロールの共通フィールド：

json
{
"version": "1.0",
"role": "planner|reviewer|implementer|qa|designer",
"status": "ok|needs_input|error",
"summary": "string",
"risks": [
{ "priority": "high|medium|low", "description": "string" }
],
"next_steps": [
{
"id": "string",
"title": "string",
"type": "plan|implement|test|report|manual",
"constraints": { "max_diff_lines": 200 },
"targets": { "paths": ["..."], "globs": ["..."] }
}
],
"artifacts": {
"files_used": ["..."],
"notes": ["..."]
}
}


status はロールの結果状態（Runnerのstageとは別概念）

risks は必要なときだけ（空配列可）

3. ロール別契約
3.1 Planner 契約（Issue → planning.json）
目的

request.md から、Stepに分割した計画（D26） を生成する

入力（Runnerが渡す）

request本文（meta含む）

前提/制約（固定）

受け入れ条件（最低3つ）

max_diff_lines（例：200）

既存の planning（replan時のみ）

既知のプロジェクト規約（あれば）

出力（必須）

Plannerは以下を返す（JSONのみ）：

json
{
"version": "1.0",
"role": "planner",
"status": "ok|needs_input|error",
"summary": "string",
"planning": {
"request_id": "RQ-...",
"spec": {
"summary": "string",
"why": "string",
"constraints": ["string"]
},
"acceptance_criteria": [
{ "id": "AC-01", "given": "string", "when": "string", "then": "string" }
],
"steps": [
{
"id": "S01",
"title": "string",
"goal": "string",
"targets": { "paths": ["..."], "globs": ["..."] },
"constraints": { "max_diff_lines": 200 },
"gates": { "unit": true, "e2e": false, "static": false },
"definition_of_done": ["string"],
"fallback": {
"on_too_large": "split",
"on_uncertain": "needs_input"
}
}
]
},
"risks": [],
"next_steps": []
}

Plannerの分割ルール（v1強制）

Stepは必ず 小さく：UI/Server/DB/Docs を混ぜない

targets.paths は可能な限り狭く

E2Eが必要なStepだけ gates.e2e=true

“実装が長くなりすぎる” 兆候がある場合は、Step数を増やす（最小でも3ステップになりやすい）

3.2 Reviewer 契約（planの品質監査）
目的

planningの抜け・曖昧・危険を明示し、必要なら 修正案（revised_planning） を返す

入力

Plannerの planning

request本文

出力
json
{
"version": "1.0",
"role": "reviewer",
"status": "ok|needs_input|error",
"summary": "string",
"risks": [
{ "priority": "high", "description": "..." }
],
"gaps": [
{ "description": "..." }
],
"ambiguities": [
{ "original": "string", "reason": "string", "suggestion": "string" }
],
"revised_planning": { "...": "planningと同構造（任意）" },
"next_steps": [
{ "id": "N1", "title": "Replan with smaller steps", "type": "plan" }
]
}

3.3 Implementer 契約（Step → patch）
目的

指定Stepのみを実装し、unified diff を返す（または JSON内に差分テキスト）

入力

planning（全体）＋対象step_id

対象ファイル内容（targetsで絞った範囲のみ）

現在のdiff状況（任意）

コーディング規約（あれば）

max_diff_lines

出力（必須）
json
{
"version": "1.0",
"role": "implementer",
"status": "ok|needs_input|error",
"summary": "string",
"step_id": "S03",
"diff": "<<< unified diff string >>>",
"diff_stats": { "files": 3, "added": 120, "deleted": 30 },
"touched_paths": ["..."],
"risk_flags": [],
"next_steps": [
{ "id": "T1", "title": "Run unit tests", "type": "test" }
]
}

Implementer制約（v1強制）

targets外のファイルを編集しない

diff_stats.added+deleted が max_diff_lines を超えそうなら、diffを出さず status=needs_input で返し、risk_flags=["STEP_TOO_LARGE"] を付ける（Runnerはreplan誘導）

3.4 QA 契約（diff＋テストログ評価）
目的

“人間が見なくても” 要点が分かる QAレポートを作る（D37に反映）

入力

planning

git diff（Stepまたは全体）

unit/e2eログ抜粋

現在のstage/errors（あれば）

出力
json
{
"version": "1.0",
"role": "qa",
"status": "ok|needs_input|error",
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
{ "type": "unit|e2e|manual", "description": "string" }
],
"patch_suggestions": "string (optional, diff or text)",
"auto_merge_recommended": false,
"next_steps": []
}

3.5 Designer 契約（任意）

v1では対象外でもよいが、UI案の一貫性のため形だけ定義する。

json
{
"version": "1.0",
"role": "designer",
"status": "ok|needs_input|error",
"summary": "string",
"screens": [
{ "name": "Requests", "components": ["..."], "notes": ["..."] }
],
"copy_texts": ["..."],
"next_steps": []
}

4. プロンプトテンプレ（共通ヘッダ）

Runnerが各CLIに渡すプロンプトは、最低限このヘッダを含む。

Common Header（v1）

「出力はJSONのみ」

「targets外を触らない」

「max_diff_linesを超えるなら分割（or needs_input）」

「禁止事項：gh依存」

5. 受け入れ基準（D42）

全ロールで JSON 1オブジェクトのみを返す

Plannerが必ずStep分割し、max_diff_lines前提で設計する

Implementerがtargets外を触らない前提でdiffを返す

QAがreport.mdに貼れる形で問題点と推奨テストを返す

出力崩壊時は reason_code（JSON_PARSE_ERROR / JSON_SCHEMA_INVALID）で確実に止まれる

次に作るべきは、これを実運用に落とす D43. ルータ設定仕様（どのroleをどのCLIに割り当てるか／“トークン不要モード” の扱い） です。

