D21. API仕様（UI ⇄ Server）v1.0

対象：aiflow-local UI（ブラウザ）とローカルServer（Node/TS）
目的：UIから requests/*.md を編集し、Runを起動し、runs成果物（stage/context/errors/report）を参照できるようにする。
前提：ローカルのみ（認証なしでOK）、状態のSSOTはファイル（requests/, runs/, .aiflow/）。

1. 基本方針

REST + JSON（v1はこれで十分）

UIは原則「ファイルを読む/書く」操作をAPI経由で行う

Runは時間がかかるため、Run開始→stageをpoll する

例外：report.md は Markdownとして返してもよい（UIはそのまま表示可能）

2. 共通仕様
2.1 Base URL

http://localhost:7331（例。実装で固定）

2.2 Content-Type

JSON：application/json; charset=utf-8

Markdown：text/markdown; charset=utf-8

2.3 エラー形式（共通）
json
{
"error": {
"code": "INVALID_REQUEST|NOT_FOUND|IO_ERROR|RUN_IN_PROGRESS|INTERNAL",
"message": "人間向け説明",
"details": { "any": "optional" }
}
}

3. データモデル（UIが扱う最小）
3.1 RequestSummary
json
{
"id": "RQ-20251214-001-bootstrap-aiflow-local",
"path": "requests/RQ-20251214-001-bootstrap-aiflow-local.md",
"title": "Bootstrap: aiflow-local v1 (Self-host first cut)",
"priority": "P0",
"status": "draft|ready|running|blocked|done",
"updated_at": "2025-12-14T13:00:00+09:00",
"latest_run": {
"run_id": "20251214-133000-8f3a2c",
"status": "done|needs_input|failed|running"
}
}

3.2 RunSummary
json
{
"request_id": "RQ-...",
"run_id": "20251214-133000-8f3a2c",
"status": "running|done|needs_input|failed",
"started_at": "2025-12-14T13:30:00+09:00",
"updated_at": "2025-12-14T13:31:10+09:00",
"paths": {
"stage": "runs/<id>/<run-id>/stage.json",
"context": "runs/<id>/<run-id>/quality_context.json",
"errors": "runs/<id>/<run-id>/errors.json",
"report": "runs/<id>/<run-id>/report.md"
},
"compare_url": "https://github.com/... (optional)"
}

4. Endpoints
4.1 Requests
GET /api/requests

requests一覧を返す（priority順 + updated順）

Query（任意）

?priority=P0（フィルタ）

?q=bootstrap（タイトル/本文の簡易検索）

Response 200

json
{
"requests": [ /* RequestSummary[] */ ]
}

GET /api/requests/:id

Request本文（Markdown）とメタ情報を返す

Response 200

json
{
"id": "RQ-...",
"path": "requests/RQ-....md",
"markdown": "# ...",
"meta": {
"priority": "P0",
"status": "draft",
"labels": ["aiflow-local"],
"title": "..."
}
}


Response 404

NOT_FOUND

PUT /api/requests/:id

Request本文を更新する（上書き保存）

Request

json
{
"markdown": "# ... updated ...",
"expected_updated_at": "2025-12-14T13:00:00+09:00"
}


Response 200

json
{
"ok": true,
"updated_at": "2025-12-14T13:10:00+09:00"
}


競合（409）

expected_updated_at が一致しない場合（v1でも入れておくと事故が減る）

POST /api/requests

新規Request作成（テンプレから生成）

Request

json
{
"title": "Bootstrap ...",
"priority": "P0",
"template": "_template.md"
}


Response 201

json
{
"id": "RQ-20251214-002-...",
"path": "requests/RQ-....md"
}

4.2 Runs（起動と参照）
POST /api/requests/:id/run

Run開始（非同期）

Request（任意）

json
{
"phase": "run|planning|tests_only",
"force": false
}


Response 202

json
{
"request_id": "RQ-...",
"run_id": "20251214-133000-8f3a2c",
"status": "running"
}


Response 409

RUN_IN_PROGRESS（同一requestでrunが走っている）

GET /api/requests/:id/runs

指定RequestのRun一覧（最新順）

Response 200

json
{
"runs": [ /* RunSummary[] */ ]
}

GET /api/requests/:id/runs/latest

最新Runのサマリ

Response 200

json
{
"run": { /* RunSummary */ }
}

GET /api/requests/:id/runs/:runId/stage

stage.json を返す（進行表示用）

Response 200

json
{
"stage": { "version": "1.0", "state": "..." }
}

GET /api/requests/:id/runs/:runId/context

quality_context.json を返す（詳細表示・デバッグ用）

Response 200

json
{
"context": { "version": "1.0", "request": {}, "repo": {}, "checks": {} }
}

GET /api/requests/:id/runs/:runId/errors

errors.json を返す（存在しない場合は404）

Response 200

json
{
"errors": { "version": "1.0", "reason_code": "..." }
}

GET /api/requests/:id/runs/:runId/report

report.md を返す（Markdown）

Response 200
Content-Type: text/markdown

本文：Markdown文字列

4.3 Config / Doctor
GET /api/config

.aiflow/config.v1.json を返す

Response 200

json
{
"config": { "version": "1.0", "base_branch": "main", "thresholds": {} }
}

PUT /api/config

configを更新（上書き）

Request

json
{
"config": { "version": "1.0", "base_branch": "main", "thresholds": {} }
}

POST /api/doctor

doctor実行（非同期でも同期でも可。v1は同期でOK）

Response 200

json
{
"status": "PASS|WARN|FAIL",
"summary": { "pass": 10, "warn": 2, "fail": 0 },
"checks": [
{ "id": "DOC-REPO-001", "severity": "PASS", "title": "Git repository detected" }
]
}

5. UIの画面とAPI対応

Requests一覧：GET /api/requests

Editor：GET /api/requests/:id + PUT /api/requests/:id

Runボタン：POST /api/requests/:id/run

進行表示：GET /api/requests/:id/runs/latest + GET stage をpoll

結果表示：GET report（＋ GET errors をあれば辞書でレンダリング）

Doctor：POST /api/doctor

6. 受け入れ基準（D21）

UIは上記APIだけで “一覧→編集→Run→結果表示” が完結する

Run中の進行状況が stage のpoll で更新される

report.md をUIでそのまま読める

errors.json がある場合、reason_code を辞書（D18-B）で表示できる

次は、UIの進行表示を固定するための D22. stage.json 状態遷移仕様（最小スキーマ） を作成します。

