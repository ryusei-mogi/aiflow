D7. API仕様（Local API Contract）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）
目的：ブラウザUI（フロント）とローカル実行基盤（バックエンド/Runner）間のAPI契約を固定し、実装詳細に依存せずに開発を進められるようにする。

1. 目的と設計方針
1.1 目的

ブラウザUIから requests/*.md ベースの運用を行える

Requestの実行（キュー投入、停止、再開、再実行）をUIから制御できる

実行ログをリアルタイムに観測できる

gh 非依存、トークン不要PRモード（compare URL提示）を支える

1.2 方針

ローカルのみ（localhost）で使用する契約

SSOTはファイル：APIは状態の読み書きを補助し、最終的な永続化は requests/*.md に反映される

冪等性（idempotency）：操作系は多重実行されても破綻しない（特にENQUEUE/RERUN/RESUME）

ロングタスク：実行は非同期。UIはrun状況をポーリング/イベント購読で追う

エラーは構造化：UIで判別できるコード体系を持つ

2. ベース情報

Base URL: http://localhost:<port>/api/v1

Content-Type: application/json; charset=utf-8

認証：なし（ローカル限定）。※将来導入余地は残すがv1では不要

タイムゾーン：Asia/Tokyo（日時はISO8601）

3. 主要リソース

Request：requests/<id>.md に対応する単位

Run：実行1回分の単位（run_id）。runs/<id>/<run_id>/ を想定

Log：Runに紐づくストリーミングログ

4. データモデル（契約上の型）
4.1 Request（レスポンス用 DTO）
json
{
"id": "20251214-login-timeout",
"title": "ログイン放置後のタイムアウト改善",
"priority": "P0",
"status": "queued",
"base": "main",
"branch": "ai/20251214-login-timeout",
"tags": ["auth", "session"],
"created_at": "2025-12-14T09:10:00+09:00",
"updated_at": "2025-12-14T10:00:00+09:00",

"run_id": "001",
"phase": "implementing",
"attempt": 1,

"blocked_reason": null,
"failure_reason": null,

"pr_url": null,
"last_commit": null,

"paths": {
"request_file": "requests/20251214-login-timeout.md",
"run_dir": "runs/20251214-login-timeout/001"
}
}


status は D2 に準拠：queued | running | needs_input | failed | done

phase は内部フェーズ（D2補助概念）：planning | implementing | testing | documenting | pushing | reporting（実装は文字列で拡張可）

paths はUIの表示補助。ファイル実体アクセスはAPI経由に統一（直接読みに行かない）

4.2 RequestDetail（本文付き）
json
{
"request": { "...Request DTO..." },
"content": {
"raw_md": "...\n",
"sections": {
"want": "Markdown text...",
"plan": "Markdown text...",
"report": "Markdown text..."
}
}
}


sections は抽出に失敗した場合 null でもよい。UIは raw_md を最低限表示可能であること。

4.3 Run（実行メタ）
json
{
"id": "001",
"request_id": "20251214-login-timeout",
"status": "running",
"phase": "testing",
"started_at": "2025-12-14T09:12:00+09:00",
"ended_at": null,
"summary": null,
"artifacts": {
"log_file": "runs/.../runner.log",
"unit_log": "runs/.../unit.log",
"e2e_log": "runs/.../e2e.log"
}
}

4.4 Error（共通エラー形式）
json
{
"error": {
"code": "WORKTREE_DIRTY",
"message": "Git working tree is not clean.",
"details": {
"hint": "Please commit/stash or clean your working tree."
}
}
}


code はUIで分岐可能な固定文字列

message は人間向け

details は任意

5. エンドポイント一覧
5.1 Requests一覧取得

GET /requests

Query

status（任意）：queued,running,...（カンマ区切り）

q（任意）：タイトル/本文の簡易検索（実装は任意）

sort（任意）：priority_desc,updated_desc など（デフォルト固定でも可）

Response 200

json
{ "items": [ { "...Request DTO..." } ] }

5.2 Request新規作成

POST /requests

Body

json
{
"title": "ログイン放置後のタイムアウト改善",
"priority": "P0",
"tags": ["auth"],
"want": {
"text": "要望本文（Markdown）"
},
"base": "main",
"branch": "ai/20251214-login-timeout"
}


Rules

id はサーバ生成（推奨） or クライアント指定（任意）

サーバ生成の場合：レスポンスで返す

requests/<id>.md を作成し、D3必須構造を満たす

Response 201

json
{ "request": { "...Request DTO..." } }


Error例

INVALID_PRIORITY

FILE_ALREADY_EXISTS

5.3 Request取得（本文込み）

GET /requests/{id}

Response 200

json
{ "...RequestDetail..." }


Error

404: REQUEST_NOT_FOUND

5.4 Request更新（要望/メタ）

PATCH /requests/{id}

Body（部分更新）

json
{
"title": "…",
"priority": "P1",
"tags": ["auth","e2e"],
"want": { "text": "…" }
}


Rules

status=running の場合、want.text 更新は拒否（D2ガード）

plan/report の直接更新は原則不可（Runner専用）。

例外で許すなら別endpointを設ける（v1では不要推奨）

Response 200

json
{ "request": { "...Request DTO..." } }


Error例

409: CANNOT_EDIT_WHILE_RUNNING

5.5 Request削除（任意・非推奨）

DELETE /requests/{id}

Rules

v1では基本無効推奨（履歴性を壊すため）

もし実装するなら status=queued/failed/done のみ許可

Response 204

6. 実行制御（Runner API）
6.1 キュー投入（Run開始要求）

POST /requests/{id}/enqueue

Body（任意）

json
{ "mode": "normal" }


Rules

冪等：queued の再enqueueは成功で返す（重複投入しない）

running のenqueueは409

needs_input は enqueue ではなく resume を推奨（ただし互換でenqueue→queued化でも可）

Response 202

json
{ "request": { "...Request DTO..." } }


Error例

409: ALREADY_RUNNING

409: WORKTREE_DIRTY（開始前チェックで検出）

409: BASE_BRANCH_NOT_FOUND

409: REMOTE_ORIGIN_MISSING

6.2 Stop（中断要求）

POST /requests/{id}/stop

Rules

running のみ有効

非同期：停止処理は少し遅延する可能性がある

Response 202

json
{ "request": { "...Request DTO..." } }


Error例

409: NOT_RUNNING

6.3 Resume（needs_inputから再開）

POST /requests/{id}/resume

Body

json
{
"answer": {
"text": "回答本文（Markdown）"
}
}


Rules

needs_input のみ有効

回答は # 要望（または指定セクション）に追記する（D3）

状態を queued に戻し、enqueue相当の扱い（実行開始はRunnerに任せる）

Response 202

json
{ "request": { "...Request DTO..." } }


Error例

409: NOT_NEEDS_INPUT

6.4 Re-run（failed/doneから再実行）

POST /requests/{id}/rerun

Rules

failed または done のみ有効（queuedでも許容してよいが意味は薄い）

状態を queued に戻し enqueue する（またはenqueue待ち）

Response 202

json
{ "request": { "...Request DTO..." } }

7. Run参照
7.1 最新Run取得

GET /requests/{id}/runs/latest

Response 200

json
{ "run": { "...Run DTO..." } }


Error

404: RUN_NOT_FOUND

7.2 Run一覧（任意）

GET /requests/{id}/runs

Response 200

json
{ "items": [ { "...Run DTO..." } ] }

8. ログストリーミング
8.1 WebSocket（推奨）

GET /ws/requests/{id}/runs/{run_id}

Event（例）

json
{ "type": "LOG", "ts": "2025-12-14T09:12:03+09:00", "line": "Step S01 started..." }


イベント種別（最低限）：

LOG：ログ1行

PHASE：phase変更（UI表示用）

STATUS：status変更（UI表示用）

DONE：完了通知（compare URL含めてもよい）

切断時の要件

UIは再接続可能（run_idが変わらない限り追従）

8.2 ポーリング代替（必須ではないが互換策）

GET /requests/{id} を数秒間隔で取得し status/phase を更新

GET /requests/{id}/runs/latest でメタ更新

9. ファイル内容取得（UI用）
9.1 Request原文ダウンロード（任意）

GET /requests/{id}/raw

Response 200
text/markdown

9.2 Artifact取得（任意）

GET /requests/{id}/runs/{run_id}/artifacts/{name}

例：unit.log, e2e.log, runner.log

Response 200
text/plain

Error

404: ARTIFACT_NOT_FOUND

10. Doctor（環境チェック）※任意だが推奨
10.1 Doctor実行

POST /doctor

Response 200

json
{
"checks": [
{ "name": "git", "ok": true, "version": "2.45.1" },
{ "name": "origin", "ok": true, "details": "..." },
{ "name": "node", "ok": true, "version": "20.x" },
{ "name": "ai_cli", "ok": true, "details": "codex available" }
]
}

11. 主要エラーコード（v1固定）
code	HTTP	意味
REQUEST_NOT_FOUND	404	Requestがない
RUN_NOT_FOUND	404	Runがない
INVALID_PRIORITY	400	priority不正
INVALID_STATUS	400	status不正（通常はサーバ内部）
CANNOT_EDIT_WHILE_RUNNING	409	実行中編集禁止
ALREADY_RUNNING	409	既にrunning
NOT_RUNNING	409	runningではない
NOT_NEEDS_INPUT	409	needs_inputではない
WORKTREE_DIRTY	409	git作業ツリーが汚い
BASE_BRANCH_NOT_FOUND	409	baseが見つからない
REMOTE_ORIGIN_MISSING	409	originがない
PUSH_FAILED	500/409	push失敗
INTERNAL_ERROR	500	想定外
12. 受け入れ基準（本Spec）

Request一覧/詳細がUIから取得できる

Requestの作成/更新ができ、D3のファイル構造を満たす

enqueue/stop/resume/rerun がステータス制約（D2）に沿って動く

running中のログがストリーミングまたは代替手段で表示できる

done時に compare URL が pr_url として取得できる

13. 関連（依存）

D1：機能仕様書（画面と操作）

D2：状態遷移仕様書（status/phase/遷移制約）

D3：Requestファイル仕様（永続化の実体）

D4：Step Plan仕様（Planの生成要件）

D5：レポート仕様（Reportの更新要件）

D8：Git運用仕様（push/compare URL）

次は、UIを固めるなら D6（UI/画面設計）、あるいは「実装時の迷いを減らす」なら D11（設定仕様） を先に作るのが効果的です。

