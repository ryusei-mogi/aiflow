D45. UI/APIインタフェース仕様（画面・エンドポイント・データ構造）v1.0

対象：aiflow-local（ローカルWeb UI＋ローカルServer）
目的：D35〜D44の仕様を、実装可能な “画面/API契約” に落とし込み、MVPを迷わず作れる状態にする。
前提：ローカル完結／npm installで動く／gh禁止／git依存OK／requestsはGit管理、runsはgitignore。

1. 画面一覧（MVP）
1.1 Screens

Requests（一覧・次の候補・作業状況）

Request Detail（編集・実行）

Run Detail（進捗・ログ・report）

v1では認証なし。localhostのみ想定。

2. UI要件（画面別）
2.1 Requests（一覧）
表示

Request行：priority / status / title / labels / depends_on / latest_run.state / latest_run.run_id

追加枠：

Next Request（D35）：現在選定された次のrequestをカード表示

Queue状態（D39）：queue lockの有無（v1.1でAuto-run ON/OFF）

操作

フィルタ：status（draft/ready/blocked/done）・priority

ソート：デフォルトは “Next選定順”（D35）

ボタン：

Open（詳細へ）

Run（readyのみ。押下でrun開始）

Resume（blockedのみ。v1では “再Run” でも可）

2.2 Request Detail（編集）
表示

メタ編集（D36）

priority（select）

status（select）

labels（タグ入力）

depends_on（複数選択 or 文字列入力）

Markdown本文編集（テキストエリアで十分）

latest_run概要（D38）

state / reason_code / started_at / finished_at

reportリンク（あれば）

操作

Save（本文保存）

Update Meta（メタ保存）

Run（status=ready推奨）

Mark as done（あなたの総合テスト後に押す）

Archive（任意）

2.3 Run Detail（進捗・ログ・report）
表示

stage.json（D34）主要項目

state / current_step / attempts / reason_code / message

planning.json（概要表示）

steps一覧（gates含む）

report.md（D37をそのまま表示）

logs（一覧）

testsログ（unit/e2e）

routerログ

raw出力

操作（MVP）

Open run folder（OS依存なので v1では非必須、パス表示で代替）

Re-run（request detailに戻して再実行でも可）

3. API一覧（MVP）

HTTPは /api/* に統一。レスポンスは JSON。

3.1 Requests API
GET /api/requests

説明：requests一覧＋派生情報（latest_run/queue_eligible等）

Response（例）：

json
{
"items": [
{
"id": "RQ-20251214-001",
"path": "requests/RQ-20251214-001.md",
"title": "Bootstrap aiflow-local v1",
"meta": {
"priority": "P1",
"status": "ready",
"labels": ["aiflow"],
"depends_on": [],
"estimate": "M",
"created_at": "2025-12-14",
"updated_at": "2025-12-14"
},
"derived": {
"queue_eligible": true,
"blocked_by": [],
"latest_run": {
"run_id": "RUN-20251214-152233-a3f9",
"state": "DONE",
"reason_code": null,
"started_at": "2025-12-14T15:22:33+09:00",
"finished_at": "2025-12-14T15:26:10+09:00"
}
}
}
]
}

GET /api/requests/:id

説明：単体request取得（本文込み）

Response：

json
{
"id": "RQ-...",
"meta": { "...": "D36" },
"title": "string",
"body_markdown": "string",
"derived": { "...": "D38" }
}

PUT /api/requests/:id

説明：本文更新（本文全置換）

Body：

json
{ "body_markdown": "..." }


Serverは D36の書き戻し規則で保存（本文更新時にupdated_at更新は任意）

PATCH /api/requests/:id/meta

説明：メタ更新（metaのみ）

Body（例）：

json
{ "priority": "P0", "status": "ready", "labels": ["aiflow","mvp"] }


Serverは D36の正規化順でメタを再生成して保存（unknownキーは保持）

3.2 Queue API（MVPは read-only + next）
GET /api/queue/next

説明：D35のNext Requestを返す

Response：

json
{ "next": { "id": "RQ-...", "reason": "priority+created_at", "derived": { ... } } }


v1.1で POST /api/queue/run-next を追加（Auto-run）。

3.3 Run API（MVP）
POST /api/requests/:id/run

説明：Run開始（D39 request lock）

Body：

json
{ "mode": "safe", "base_branch": "main" }


Response：

json
{
"request_id": "RQ-...",
"run_id": "RUN-...",
"run_path": "runs/RQ-.../RUN-...",
"stage": { "state": "PLANNING", "..." : "D34" }
}


409（RUN_IN_PROGRESS）あり（D39）

GET /api/requests/:id/runs

説明：run一覧（軽量）

Response：

json
{
"items": [
{
"run_id": "RUN-...",
"state": "DONE",
"reason_code": null,
"started_at": "...",
"finished_at": "..."
}
]
}

GET /api/requests/:id/runs/:run_id

説明：run詳細（stage/planning/report/logs index）

Response（例）：

json
{
"request_id": "RQ-...",
"run_id": "RUN-...",
"stage": { "...": "D34" },
"planning": { "...": "D42 Planner output planning部分" },
"report": { "path": "runs/.../report.md", "markdown": "..." },
"logs": [
{ "path": "runs/.../logs/tests/unit.S01.attempt1.log", "type": "unit" }
],
"artifacts": []
}

3.4 Doctor API（任意だが便利）
GET /api/doctor

説明：環境チェック（D44）

Response：

json
{
"ok": true,
"checks": [
{ "id": "node", "status": "PASS" },
{ "id": "git", "status": "PASS" },
{ "id": "codex", "status": "PASS" },
{ "id": "gemini", "status": "PASS" },
{ "id": "worktree_clean", "status": "PASS" }
]
}

4. エラー契約（共通レスポンス）

失敗時は統一フォーマット：

json
{
"error": {
"category": "ENVIRONMENT|EXECUTION|VALIDATION|INTERNAL",
"reason_code": "WORKTREE_DIRTY|RUN_IN_PROGRESS|JSON_PARSE_ERROR|...",
"message": "人間向け短文",
"context": { "request_id": "...", "run_id": "..." },
"actions": ["次にやること1", "2"]
}
}

5. 最小データ構造（TypeScript想定）
ts
type Priority = "P0"|"P1"|"P2"|"P3";
type RequestStatus = "draft"|"ready"|"running"|"blocked"|"done"|"archived";

type RunState =
| "INIT"|"PLANNING"|"IMPLEMENTING"|"TESTING"|"REPORTING"
| "DONE"|"NEEDS_INPUT"|"FAILED";

type RequestItem = {
id: string;
title: string;
path: string;
meta: {
priority?: Priority;
status?: RequestStatus;
labels?: string[];
depends_on?: string[];
estimate?: "S"|"M"|"L";
created_at?: string;
updated_at?: string;
unknown?: Record<string,string>;
};
derived: {
queue_eligible: boolean;
blocked_by: string[];
latest_run: null | {
run_id: string;
state: RunState;
reason_code: string|null;
started_at: string;
finished_at: string|null;
};
};
};

6. 受け入れ基準（D45）

Requests一覧→詳細→Run詳細の3画面でMVPが成立

requestsのmeta/本文を壊さず更新できる（D36）

Run開始でruns配下に成果物が揃い、reportがUIで見える（D37/D38）

409ロック（D39）がUIで理解可能な形で返る

gh依存がない（D40/D43）

次に作るべきは、実装を止めないための “最初の request テンプレ” を固定する D46. requestsテンプレ（最小でAIが自走できる書式・AC・テスト指示の書き方） です。

