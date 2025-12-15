D28. Promptテンプレート仕様（role別テンプレ + 変数置換 + 禁止事項）v1.0

対象：aiflow-local の prompts/*.md（または .aiflow/prompts/*.md）
目的：Codex/Claude/Gemini いずれのCLIでも、D27 Contractに準拠した単一JSON出力を安定させる。
前提：モデル選定や具体実装はAIに任せるが、テンプレ形式・変数・禁止事項は固定する。

1. ディレクトリ・ファイル構成（v1）

推奨：

pgsql
.aiflow/
prompts/
planner.v1.md
implementer.v1.md
qa.v1.md
schemas/
planner.contract.v1.json
implementer.contract.v1.json
qa.contract.v1.json
messages/
messages.v1.ja.json


v1は「schemaファイルはRunnerのバリデーション用」であり、CLIの --json-schema に渡せる場合は渡して良い。

2. 変数置換（テンプレエンジン仕様）

Runnerはテンプレ内の {{var}} を置換する（Mustacheライク、v1は単純置換で十分）。

2.1 必須変数（全ロール共通）

{{contract_version}}：1.0

{{request_id}}

{{run_id}}

{{repo_root}}

{{base_branch}}

{{constraints}}：固定制約テキスト（例：PHP/Laravel/MySQL、既存壊さない、gh不要等）

{{request_markdown}}：requests/*.md 全文（または要約）

{{quality_gates_json}}：.aiflow/quality-gates.v1.json 内容（短くてOK）

2.2 ロール別変数
Planner

{{thresholds_json}}：.aiflow/config.v1.json の thresholds 部分

{{planning_limits_json}}：D26の strategy.step_limits

{{existing_planning_json}}：再planning時のみ（無ければ空文字）

Implementer

{{step_json}}：planning.json の該当step（JSON文字列）

{{targets_snapshot}}：targets.paths のファイル内容（連結）

{{current_diff}}：必要なら git diff

QA

{{diff_base_to_head}}

{{unit_log_excerpt}}

{{e2e_log_excerpt}}

{{acceptance_criteria_json}}（抽出）

3. 禁止事項（テンプレに必ず明記）

前置き説明、謝罪、箇条書き、コードブロック

複数JSON、JSON以外の出力

未指示のファイル編集（Runnerが適用するので、AIはdiff生成のみ）

4. テンプレ共通ヘッダー（全ロールに入れる）

以下の“共通ブロック”を各テンプレの冒頭に必ず含める。

md
あなたは aiflow-local の {{role}} ロールです。
出力は **単一のJSONオブジェクトのみ**。それ以外の文字を一切出力しないでください。
- contract_version は "{{contract_version}}" 固定
- role は "{{role}}" 固定
- status は ok | needs_input | failed のいずれか
- JSONはパース可能であること（末尾カンマ禁止、コメント禁止）
- コードブロック（```）は禁止
- 余計な説明文は禁止

失敗しそうな場合は status=needs_input にし、reason_code（該当時）を入れてください。

5. planner.v1.md（テンプレ）
md
{{common_header}}

【目的】
requests の要望を実装可能な小さなStep（3〜5）に分割し、planning.json（D26）を生成する。

【制約】
{{constraints}}

【品質ゲート（参照）】
{{quality_gates_json}}

【Step上限（必須遵守）】
{{planning_limits_json}}

【入力：Request Markdown】
{{request_markdown}}

【既存planning（ある場合）】
{{existing_planning_json}}

【出力要件（必須）】
- D27 Planner Contract に完全準拠したJSONを返す
- stepsは原則3〜5。1 StepにUI/Server/Runner/Testsを詰め込まない
- targets.paths を絞る（diff爆発防止）
- Stepが大きくなりそうなら、最初から分割する（STEP_TOO_LARGEを出さない設計を優先）

【出力】


Runnerは {{common_header}} を以下のように差し込む：

{{role}} = planner

6. implementer.v1.md（テンプレ）
md
{{common_header}}

【目的】
指定されたStepを実装するための unified diff を生成する。Runnerがdiffを適用する。

【制約】
{{constraints}}

【Step（このStepだけ実行）】
{{step_json}}

【対象ファイル（現状スナップショット）】
{{targets_snapshot}}

【現在の差分（参考：任意）】
{{current_diff}}

【出力要件（必須）】
- D27 Implementer Contract 準拠の単一JSON
- patch.diff に unified diff 文字列を入れる（diff以外のテキスト禁止）
- limits を超えそうなら status=needs_input + reason_code=STEP_TOO_LARGE（ただし基本はplanningで回避）

【出力】


{{role}} = implementer

7. qa.v1.md（テンプレ）
md
{{common_header}}

【目的】
diffとログから、指摘・追加テスト案・必要なら修正パッチ案を返す。

【制約】
{{constraints}}

【Acceptance Criteria】
{{acceptance_criteria_json}}

【diff（base...HEAD）】
{{diff_base_to_head}}

【Unit log excerpt】
{{unit_log_excerpt}}

【E2E log excerpt】
{{e2e_log_excerpt}}

【出力要件（必須）】
- D27 QA Contract 準拠の単一JSON
- issues は severity と description を必須
- 修正案がある場合は patch_suggestions に unified diff か text を入れる

【出力】


{{role}} = qa

8. Runner実装側のテンプレ処理（固定）

テンプレ読み込み → 変数置換 → CLIへ送信

CLI結果をそのまま受け取り、JSON parse + schema validate

失敗時は JSON_PARSE_ERROR or JSON_SCHEMA_INVALID を reason_code として NEEDS_INPUT へ

9. 受け入れ基準（D28）

どのCLIでも「単一JSONのみ」を強制できる

Planner/Implementer/QA が D27 Contract を安定して満たす

途中停止問題を planning で回避しやすい（Step分割が安定する）

次に作るべきは、ここまでのドキュメントと矛盾しない形で D29. ディレクトリレイアウト確定（repo内配置・npm scripts・devDependencies方針） を作ることです。これを固めると、実装担当AIが迷いません。

