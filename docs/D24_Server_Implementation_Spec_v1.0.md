D24. Server実装仕様（File I/O・Run起動・排他制御）v1.0

対象：aiflow-local Server（Node/TypeScript、Express想定）
目的：D21 API を ファイルSSOT運用 で安全に提供し、Runを起動し、同時実行や破壊的操作を防ぐ。
前提：ローカルのみ／認証なし／gh非依存／git依存OK／状態は requests/ runs/ .aiflow/。

1. プロセス構成（v1）

1つのNodeプロセスで API + Runner起動 を担当

Runnerは同プロセス内で「非同期ジョブ」として走らせる（v1はこれで十分）

将来の分離（worker化）に備え、Runner呼び出しは RunManager 経由に統一する

2. ディレクトリとSSOT（v1固定）

.aiflow/：設定・ルール・辞書（存在しなければ doctor or server start で生成）

requests/：要望Markdown（編集対象）

runs/：実行成果物（新規作成のみ、更新はstage/context/report/errors/logs）

3. File I/O方針（安全の要点）
3.1 書き込みは原則「原子的」に

書き込みは tmp → rename で atomic replace（OS依存はあるがローカル用途で十分）

例：writeFileAtomic(path, content)

path.tmp-<pid>-<ts> に書く

fs.rename で置換

3.2 パスはサニタイズ（ディレクトリトラバーサル防止）

リクエストIDからパスを直接作らない

requests/ 内のファイル一覧をSSOTにし、:id はそれに一致するものだけ許可

path.resolve(repoRoot, requestedPath) が repoRoot 配下にあることを保証

3.3 Markdownメタの抽出（v1簡易）

priority: P0 などの先頭行メタはパースするが、壊れていても本文は返す

title は # の最初の行、無ければファイル名

4. 排他制御（同時Run/同時編集）
4.1 同一Requestの同時Runは禁止

RunManager が request_id -> running_run_id を in-memory で保持

Run開始APIで、既にrunningなら 409（RUN_IN_PROGRESS）

サーバ再起動でin-memoryが消える問題は v1では許容（ただし runs/.../stage.json をスキャンして “running扱い” 復元しても良い）

4.2 編集競合（optimistic lock）

PUT /api/requests/:id で expected_updated_at を受け取り、mtimeと比較

不一致なら 409（CONFLICT）

v1は “読み直して再保存” で十分

4.3 runs配下は「追記・新規作成」中心

既存runディレクトリへの再生成は原則しない（run_idは不変）

stage/context/report/errors は更新するが、更新履歴は stage.history に残す（後述）

5. RunManager 仕様（中核）
5.1 責務

Run作成（run_id生成、ディレクトリ作成）

stage.json 初期化・更新

Runnerを非同期起動

最新runの取得（Requestごと）

例外時の FAILED 遷移保証（必ず終端に落とす）

5.2 インターフェース（擬似）

startRun(requestId, opts): {runId}

getLatestRun(requestId): RunSummary

getRun(requestId, runId): RunSummary

isRunning(requestId): boolean

6. stage.json 更新規約（D22準拠）
6.1 更新は必ず updated_at を変える

UI pollingが効く

6.2 history（v1推奨拡張）

v1の可観測性のために、stage.history[] を追加しても良い（スキーマ未定義ならmetaへ）。

例（推奨）：

json
{
"history": [
{ "at": "2025-12-14T13:30:10+09:00", "state": "DOCTOR_RUNNING", "note": "start" }
]
}

7. Runner起動とログ
7.1 ログの行き先

runs/<id>/<run-id>/logs/runner.log

.../logs/doctor.json（doctor結果をJSONで保存）

unit/e2eの stdout/stderr は unit.log e2e.log に保存

7.2 Runnerの標準入出力

例外でもログに残す

失敗時は errors.json と report.md を生成して、stage を FAILED へ

8. errors.json / report.md 生成規約（D18連携）

Quality Gateの決定結果（status/reason_code/severity）が確定した時点で

needs_input / failed：errors.json を生成（辞書から title/summary/actions を展開）

常に：report.md を生成（D18テンプレ）

その後 requests/<id>.md の ## Report セクションへ追記

9. compare URL生成（トークン不要PRモード）
9.1 条件

origin が存在すること（無ければ needs_input）

GitHubのremote URLであること（v1はGitHubだけ対応でOK）

git@github.com:owner/repo.git

https://github.com/owner/repo.git

9.2 生成

base：.aiflow/config.base_branch

branch：ai/<request-id>（サニタイズ）

compare URL：

https://github.com/<owner>/<repo>/compare/<base>...<branch>?expand=1

10. APIハンドラ実装詳細（D21の落とし込み）
10.1 GET /api/requests

requests/ を走査して .md を列挙

priority抽出（無ければ P3）

ソート：priority asc → updated_at desc

10.2 GET /api/requests/:id

id→pathは「一覧で見つかったもののみ」

Markdown全文返却 + meta（priority/status/title）

10.3 PUT /api/requests/:id

expected_updated_at チェック（mtime）

atomic writeで保存

10.4 POST /api/requests/:id/run

RunManager.startRun

202で run_id返却

10.5 GET /api/requests/:id/runs/:runId/stage など

該当ファイルを読んで返す

errorsは無ければ404

10.6 POST /api/doctor

doctorを同期実行（v1）

結果はレスポンス返しつつ、runs/.../logs/doctor.json は Run時に残す方針でもよい
（UI doctorは単独実行なので runs には残さない設計でもOK）

11. セキュリティ（ローカルでも最低限）

bindは 127.0.0.1 のみ（LAN公開しない）

パスのサニタイズ（requests/runs以外触らない）

破壊的コマンドはServerから直接実行しない（git以外はRunnerで制御）

“危険オプション” は v1で持たない（例：任意パス書き込み）

12. 受け入れ基準（D24）

同一RequestでRunを二重起動できない（409）

requests編集がatomicで、競合を409で検知できる

stageがpollで追える（updated_atが変わる）

失敗しても必ず終端（NEEDS_INPUT/FAILED/DONE）へ到達し、reportが残る

compare URL 生成が origin/GitHub remote のときに成立する

次に作るべきは、実装が破綻しやすい部分（git操作・remote解析・branch命名）を固定する D25. Gitアダプタ仕様（branch/push/compare URL）v1 です。

