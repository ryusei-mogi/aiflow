D30. 実装タスク分割（Bootstrap用 requestsテンプレ + planning例）v1.0

対象：aiflow-local を最初に立ち上げるための “最初の1本” を確定する
目的：実装担当AIが迷わず、小さなStep反復で確実に起動 まで持っていく。
前提：既存仕様は壊さない／ローカル完結／gh依存なし／gitはOK／devDependencies推奨。

1. 最初に置く requests テンプレ（コピペ用）

保存先：requests/RQ-20251214-001-bootstrap-aiflow-local.md

md
priority: P0
status: ready
labels: [aiflow-local, bootstrap]

# Bootstrap: aiflow-local v1（UI + Server + Runner最小）

## 背景
要望を書いたら、ローカルでaiflow-localがそれを読み取り、Runを実行し、進捗（stage）と結果（report/errors/compare URL）をブラウザで確認できるようにしたい。

## 前提/制約
- ローカル完結
- ghコマンド依存なし（禁止）
- git依存はOK
- 既存の開発構成/既存scripts/既存仕様は壊さない
- npm install したら使えるようにしたい（aiflowは tools/aiflow に閉じる、devDependencies推奨）
- トークン不要モード（Node側でAPIキーを持たない。必要なら各CLIの既存ログインを使う）

## 受け入れ条件（最低3つ）
- [ ] requests/ をUIで一覧表示できる
- [ ] request詳細でMarkdownを編集→保存できる
- [ ] Runを開始でき、runs/.../stage.json をpollして進捗表示できる
- [ ] Run終了後に report.md が表示できる（失敗時は errors.json も表示できる）
- [ ] gh依存が一切ない（gitのみ）

## テスト指示
- E2E（手動でOK）:
- UI起動 → 一覧表示 → 詳細を開く → 1行編集して保存 → Run → Report表示
- 単体（最低限）:
- sanitize（branch名等）
- writeAtomic
- parseGitHubRemote

2. Bootstrapにおける planning.json 例（D26準拠の例）

保存先（Run時生成）：runs/<id>/<run-id>/planning.json
※ここでは「望ましいStep設計」を例示する（実際生成はPlannerが行う）。

json
{
"version": "1.0",
"request_id": "RQ-20251214-001-bootstrap-aiflow-local",
"base_branch": "main",
"strategy": {
"goal": "小さな反復でUI+Serverを起動し、stage/reportまで到達する",
"max_steps": 6,
"min_steps": 3,
"step_limits": { "max_diff_lines": 280, "max_files": 10, "max_minutes": 15 }
},
"assumptions": [
"既存repoはnpmが使える（package.jsonが存在）",
"UIはVite+Reactで最小構成",
"APIはExpressで実装"
],
"acceptance_criteria": [
{ "id": "AC-01", "text": "UIでrequests一覧→詳細→保存ができる" },
{ "id": "AC-02", "text": "Run開始でstageが更新され、reportが表示できる" },
{ "id": "AC-03", "text": "gh依存が無い（gitのみ）" }
],
"risk_checks": [
{ "id": "R-01", "severity": "high", "text": "既存package.json/scriptsを壊さない（追加のみ）" },
{ "id": "R-02", "severity": "mid", "text": "runsはgitignoreし、生成物でrepoが汚れない" }
],
"steps": [
{
"step_id": "S01",
"title": "Layout: tools/aiflow + .aiflow + requests/runs + scripts追加",
"intent": "bootstrap",
"targets": { "paths": ["tools/aiflow/**", ".aiflow/**", "requests/**", ".gitignore", "package.json"], "file_globs": ["**/*"] },
"deliverables": [
"tools/aiflow に package.json/tsconfig/vite骨格がある",
".aiflow に config/quality-gates/prompts/schemas/messages が置かれる（最小）",
"root scripts に aiflow:server / aiflow:ui を追加（既存は変更しない）",
"runs/ がgitignoreされる"
],
"tests": [{ "type": "unit", "command": "npm --prefix tools/aiflow run test:aiflow", "required": false }],
"limits": { "max_diff_lines": 260, "max_files": 10 },
"depends_on": []
},
{
"step_id": "S02",
"title": "Server: D21 API（requests GET/PUT + run start + stage/report read）",
"intent": "feature",
"targets": { "paths": ["tools/aiflow/src/server/**", "tools/aiflow/src/shared/**"], "file_globs": ["**/*.ts"] },
"deliverables": [
"API server が 7331 で起動",
"GET /api/requests が一覧を返す",
"GET/PUT /api/requests/:id が動く",
"POST /api/requests/:id/run が runs を作り stage.json を INIT→REPORTING→DONE に進める（ダミーRunでも可）",
"GET stage/report/errors/context が読める"
],
"tests": [{ "type": "unit", "command": "npm --prefix tools/aiflow run test:aiflow", "required": false }],
"limits": { "max_diff_lines": 280, "max_files": 10 },
"depends_on": ["S01"]
},
{
"step_id": "S03",
"title": "UI: D23 最小画面（一覧→詳細編集→Run→Run詳細表示）",
"intent": "feature",
"targets": { "paths": ["tools/aiflow/ui/**"], "file_globs": ["**/*.tsx", "**/*.ts"] },
"deliverables": [
"UIが7332で起動",
"一覧→詳細→保存→Run開始→進捗→report表示まで到達"
],
"tests": [{ "type": "e2e", "command": "手動E2E（D30の手順）", "required": true }],
"limits": { "max_diff_lines": 280, "max_files": 10 },
"depends_on": ["S02"]
},
{
"step_id": "S04",
"title": "Runner: D22 stage更新 + D24 RunManager 排他（同一request二重run禁止）",
"intent": "fix",
"targets": { "paths": ["tools/aiflow/src/runner/**", "tools/aiflow/src/server/runManager.ts"], "file_globs": ["**/*.ts"] },
"deliverables": [
"stage.json が state/progress/steps を持つ（D22）",
"同一requestの二重runで 409 が返る"
],
"tests": [{ "type": "unit", "command": "npm --prefix tools/aiflow run test:aiflow", "required": false }],
"limits": { "max_diff_lines": 240, "max_files": 8 },
"depends_on": ["S03"]
},
{
"step_id": "S05",
"title": "GitAdapter: compare URL 生成（D25）をreportへ出す（条件付き）",
"intent": "feature",
"targets": { "paths": ["tools/aiflow/src/adapters/gitAdapter.ts"], "file_globs": ["**/*.ts"] },
"deliverables": [
"originがGitHub remoteのとき compare URL をreportに表示",
"origin無し/非GitHubのときは needs_input（reason_code）"
],
"tests": [{ "type": "unit", "command": "npm --prefix tools/aiflow run test:aiflow", "required": true }],
"limits": { "max_diff_lines": 220, "max_files": 6 },
"depends_on": ["S04"]
}
],
"completion": {
"definition": [
"S01〜S05 がdone",
"UIの手動E2Eが完了し、reportに記録される",
"gh依存が無い"
],
"stop_conditions": [
{ "reason_code": "STEP_TOO_LARGE", "when": "Stepのdeliverablesやtargetsが過大" },
{ "reason_code": "NEEDS_INPUT", "when": "git remote等、外部条件で止まる" }
]
}
}

3. 実装順（人間が最初にやること）

requests/ と .aiflow/ と tools/aiflow/ を追加（S01相当）

npm --prefix tools/aiflow install

2つ起動

npm run aiflow:server

npm run aiflow:ui

UIで RQ-20251214-001... を開き、保存→Run→Reportを確認

“止まったら” report/errors の指示に従って最小介入

4. 受け入れ基準（D30）

最初のrequestsテンプレが用意され、UIから編集できる

planningが「小さいStep」の設計になっている（途中停止対策）

UI/Server/Runner/Gitの導入が段階的で、手戻りが少ない

次は、実装開始直前の「最小資材」を確定する D31. .aiflow/ 初期ファイル一式（config / quality-gates / messages / schemas の雛形） を作るのが最も効率的です。

