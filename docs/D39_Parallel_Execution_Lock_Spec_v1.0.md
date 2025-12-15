D39. 並列実行・ロック仕様（同一request排他／全体キュー排他／UI表示）v1.0

対象：aiflow-local の Run実行制御（Server/Runner/UI）
目的：requests を自動で回す際に、二重実行・競合・成果物破壊 を防止し、安全に “1本ずつ” 回せるようにする。
前提：v1は並列実行しない／ローカル完結／gh禁止／git依存OK。

1. ロックの種類（v1）

v1では以下の2種類のみ実装する。

Request Lock：同一 request_id の二重Runを禁止

Queue Lock：Auto-run（キュー実行）を1つに制限

v1は「同時に1 Run」運用が基本なので、Queue Lockが取れれば Request Lockはほぼ保険だが、UIの多重操作に備えて両方持つ。

2. ロックの実体（v1）

ローカル完結・簡単さ優先で ファイルロック を採用する。

2.1 配置

.aiflow/locks/ を作成（git管理しても良いが、lockファイル自体はgitignore推奨）

ロックファイルは以下：

Request Lock：.aiflow/locks/request.<request_id>.lock.json

Queue Lock：.aiflow/locks/queue.lock.json

2.2 ロックファイル形式（v1）
json
{
"version": "1.0",
"lock_type": "request",
"request_id": "RQ-...",
"run_id": "RUN-...",
"pid": 12345,
"host": "127.0.0.1",
"created_at": "2025-12-14T15:01:02+09:00",
"expires_at": "2025-12-14T15:31:02+09:00"
}


Queue Lockは lock_type: "queue" とする。

3. ロック取得・解放仕様（v1）
3.1 取得（acquire）

原子操作で作成（Nodeなら fs.open(path, 'wx') を使用）

既に存在する場合は取得失敗

3.2 解放（release）

正常終了（DONE）または NEEDS_INPUT/FAILED 確定時に解放

Serverが強制停止した場合に備え、期限切れ で回収できるようにする（後述）

3.3 期限（TTL）

v1のデフォルトTTL：30分

Runの進捗がある限り、Runnerが定期的に expires_at を延長してよい（heartbeat）

4. 競合時のAPIレスポンス（v1）
4.1 Request Lock競合

POST /api/requests/:id/run がロック取得できない場合：

HTTP 409

reason_code: RUN_IN_PROGRESS（D33）

latest_run の参照URLを返す

json
{
"error": {
"category": "EXECUTION",
"reason_code": "RUN_IN_PROGRESS",
"message": "同一RequestのRunが実行中です",
"context": { "request_id": "RQ-...", "run_id": "RUN-..." }
}
}

4.2 Queue Lock競合

POST /api/queue/run-next が取得できない場合：

HTTP 409

reason_code: QUEUE_IN_PROGRESS（v1で追加）

UIは「別のキュー実行が動作中」と表示し停止

5. 期限切れロック（stale lock）回収（v1）
5.1 stale判定

expires_at < now のロックは stale

追加で安全性を上げるなら：

pid が存在し、プロセスが生存しているか（macOSなら process.kill(pid, 0)）を確認

生存していれば “期限切れでも回収しない” を推奨

5.2 回収動作

stale かつ pid非生存（またはpid不明）なら削除して再取得を許可

回収は以下のタイミングで実施：

doctor（full）で実施

run開始前にも軽く実施（quickで期限切れのみ）

6. Auto-run（キュー）の排他ルール（v1）
6.1 Queue Lockの取り方

POST /api/queue/run-next の最初でQueue Lockを取得

以降、次requestへ進むたびにQueue Lockを維持（TTL延長）

停止条件（NEEDS_INPUT/FAILED/doctor FAIL）でQueue Lockを解放

6.2 “途中でUIが落ちた” ケース

Queue LockはTTLで自然回収される（stale回収）

その際、Request Lockが残っていれば、それもTTLで回収される

7. UI表示（v1）
7.1 Requests一覧

status=running のrequestに “LOCKED” 表示

Auto-run ON の場合、画面上部に “Queue running” を表示（停止ボタンあり）

7.2 Run詳細

RUN_IN_PROGRESS の409を受けたら、そのrun-idへ自動遷移（またはリンク表示）

8. 設計上の安全策（v1）

ロックは サーバ側でのみ 取得/解放（UIは呼ぶだけ）

ロック解放は “最後に必ず” 実行する（try/finally）

runs/.../stage.json にも lock 情報（request lock holder）を記録してデバッグ可能にする

9. 追加 reason_code（D33拡張）

v1で追加する：

QUEUE_IN_PROGRESS

（任意）LOCK_STALE_RECOVERED（回収が走ったことをreportに残すなら）

messages.v1.ja.json 追加例：

json
"QUEUE_IN_PROGRESS": {
"title": "キュー実行がすでに動作中です",
"summary": "Auto-runは同時に1つのみ実行できます。",
"actions": [
"別タブ/別ウィンドウで起動していないか確認",
"しばらく待つ（TTLで回収されます）",
"必要なら doctor(full) でロック回収を実施"
]
}

10. 受け入れ基準（D39）

同一requestを二重にRunできない（409 + RUN_IN_PROGRESS）

Auto-runを二重起動できない（409 + QUEUE_IN_PROGRESS）

異常終了してもTTLで回収でき、詰まらない

UIで “今ロックされている” 状態が視覚的に分かる

次に作るべきは、Runnerが “どの程度まで自動でgit操作するか” を固定する D40. Git操作ポリシー（branch作成／commit／push／apply方式） です。ここを固めると「PR相当（compare URL）」の出し方も一貫します。

