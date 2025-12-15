D26. Planning出力仕様（Step分割JSON + 収束ルール）v1.0

対象：aiflow-local Planner（AI）と Runner（実行制御）
目的：長くなって途中で止まる問題 を避けるため、planning時点で実装を細分化し、反復（Step実行）で収束させる。
前提：技術詳細（どうやるか）はAIに任せるが、出力フォーマットと収束ルールは固定する。

1. Planningのアウトプット（SSOT）

Plannerは必ず以下を生成する：

runs/<request-id>/<run-id>/planning.json（機械可読・Runnerが使うSSOT）

runs/<request-id>/<run-id>/planning.md（人間向け。v1は任意）

Runnerは planning.json を読み、stage.json.steps[] を構築する。

2. planning.json スキーマ（v1）
json
{
"version": "1.0",
"request_id": "RQ-...",
"base_branch": "main",
"strategy": {
"goal": "短い反復で収束させる",
"max_steps": 7,
"min_steps": 2,
"step_limits": {
"max_diff_lines": 300,
"max_files": 10,
"max_minutes": 15
}
},
"assumptions": [
"npm workspaceは既存に合わせる",
"ローカル完結、gh不要"
],
"acceptance_criteria": [
{ "id": "AC-01", "text": "npm install後に npm run aiflow -- --help が動く" }
],
"risk_checks": [
{ "id": "R-01", "severity": "high", "text": "既存package.json/scriptsを壊さない" }
],
"steps": [
{
"step_id": "S01",
"title": "Skeleton: tools/aiflow + server起動",
"intent": "bootstrap",
"targets": {
"paths": ["tools/aiflow/**", "package.json"],
"file_globs": ["**/*.ts", "**/*.json"]
},
"deliverables": [
"npm script追加（最小）",
"serverが起動して /api/health 200"
],
"tests": [
{ "type": "unit", "command": "npm run test:aiflow", "required": true }
],
"limits": {
"max_diff_lines": 250,
"max_files": 8
},
"depends_on": []
}
],
"completion": {
"definition": [
"全stepがdone",
"quality gateがOK",
"report.mdとrequests追記が完了"
],
"stop_conditions": [
{ "reason_code": "STEP_TOO_LARGE", "when": "見積or実測がlimits超過" },
{ "reason_code": "NEEDS_INPUT", "when": "doctor/remote等で入力待ち" }
]
}
}

3. Stepオブジェクト仕様（詳細）
必須フィールド

step_id：S01 形式（固定）

title：UI表示・report用

intent：bootstrap | feature | refactor | tests | docs | fix（v1のカテゴリ）

targets.paths：主に触る場所（“diff爆発”防止）

deliverables：そのStepの完了定義（短文で2〜5個）

tests[]：そのStepで必ず実行/追加すべきもの（無ければ空配列）

limits：基本はグローバルを継承、Step単位で上書き可

depends_on：前提Step（v1は空でもOK）

オプション

notes：AIの判断根拠（reportに引用可）

rollback：失敗時に戻す指針（v1では任意）

4. 収束ルール（最重要）
4.1 Step数

原則：3〜5 Steps

最小：2 Steps（本当に小さい変更のみ）

最大：7 Steps（v1の上限。超えるなら “scopeを落とす”）

4.2 1 Step の上限

max_diff_lines: 300（目安）

max_files: 10

max_minutes: 15（時間見積り。Runner側は強制できなくても良い）

4.3 過大判定（STEP_TOO_LARGE）

Planning時点で以下を満たしたら Step再分割 を必須にする：

deliverables が多すぎる（>5）

targets.paths が広すぎる（repo root級）

UI + Server + Runner を同Stepにまとめている

「CI/E2Eまで全部」などが1 Stepに入っている

4.4 反復（Step実行→評価→次Step）

Runnerは以下を繰り返す：

current_step_index の Step を実行（AI実装/patch/commit）

tests を実行（requiredがtrueのもの）

Stepのdone判定（deliverablesを満たす）

次Stepへ

5. Runnerがplanning.jsonをどう使うか（固定）
5.1 stage.json.steps[] への投影

steps[i].title を stage.steps[i].title

limits を stage.steps[i].diff_estimate に反映

current_step_index を 0 で初期化

5.2 “止まった” の統一ハンドリング

Step中断（AI停止/出力不足/無限ループ兆候）は

NEEDS_INPUT（人間が介入して再Run or 再planning）

Step規模超過は

STEP_TOO_LARGE（planningからやり直し）

テスト失敗は

UNIT_TEST_FAILED / E2E_TEST_FAILED

6. Plannerプロンプトへの要求（v1固定要件）

Plannerには必ず以下を要求する（実装方法は自由）：

出力は必ず planning.json に適合

stepsは UI/Server/Runner/Tests を同Stepに混ぜない（原則分割）

既存仕様を壊さない前提の確認を steps の risk_checks に反映

7. 受け入れ基準（D26）

planning.json が機械的にパースできる

3〜5 Steps が基本で、各Stepが小さい

“途中で止まる問題” を前提に、最初から反復設計になっている

Runnerがplanning.jsonだけで stage.steps を構築できる

次に作るべきは、planningを実際に回すための D27. Planner/Runner入出力プロンプト契約（Contract）v1 です。
これを作ると、Codex CLI/Claude/Geminiを混ぜても「必ずJSONで返す」運用が固まります。

