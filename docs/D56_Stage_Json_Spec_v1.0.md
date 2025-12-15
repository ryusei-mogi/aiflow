D56. stage.json 仕様（状態遷移・更新規約・UI表示契約）v1.0

対象：runs/<request-id>/<run-id>/stage.json（Run状態SSOT）
目的：Runner/UIが「現在地」「履歴」「停止理由」をブレなく共有し、途中停止・再開・反復を安全に行えるようにする。
前提：SSOTは stage.json／requestは requests/*.md／planningは D55／ロックは D39／再開は D34／エラー分類は D33。

1. stage.json の役割（SSOT）

stage.json は Runの状態SSOT（UIはこれだけ見れば描画できる）

Runnerは「イベント駆動」ではなく、ステップごとに stage.json を更新する

report.md は人間向けであり、状態判定は stage.json を正とする（D37）

2. state（最上位状態）定義（v1固定）
state	意味	UI表現
QUEUED	起動待ち（排他待ち含む）	実行待ち
RUNNING	実行中	実行中
NEEDS_INPUT	入力/環境/判断待ちで停止	要対応
FAILED	失敗で停止（自動復帰不可）	失敗
DONE	完了	完了
CANCELED	任意停止（v1では基本未使用）	中断

v1は「同時に1 Run」運用が基本だが、UI多重操作のためQUEUEDは残す。

3. stage（実行フェーズ）定義（v1固定）

Runner内部の進行段階。UIは stage を「今どこか」として表示できる。

stage	説明
INIT	runsディレクトリ生成、初期ファイル作成
LOCK_ACQUIRED	ロック取得完了
PLANNING	planning.json 生成中
IMPLEMENTING	patch生成中（step実行）
APPLYING	patch適用／チェック
TESTING	unit/e2e 実行
REPORTING	report生成／まとめ
FINALIZING	最終状態書き込み
END	完全終了（state=DONE/FAILED/NEEDS_INPUT）
4. stage.json スキーマ（v1）
4.1 ルート（トップレベル）
key	型	必須	説明
version	string	✅	"1.0"
request_id	string	✅	RQ-...
run_id	string	✅	YYYYMMDD-HHMMSS-xxxx 等
state	enum	✅	上記state
stage	enum	✅	上記stage
title	string	✅	UI表示用短文（1行）
started_at	string(ISO)	✅	Run開始
updated_at	string(ISO)	✅	最終更新
ended_at	string(ISO)	⛔	終了時のみ
progress	object	✅	進捗
steps	array[StepState]	✅	planning準拠のstep配列
current_step_index	number	✅	現在step index（0-based、未開始は0）
locks	object	✅	ロック情報
artifacts	object	✅	主要成果物への相対パス
error	ErrorObject | null	✅	停止理由（無ければnull）
counters	object	✅	試行回数など
signals	object	✅	UI/Runner協調用フラグ（任意だが枠は固定）
4.2 progress
key	型	必須	説明
percent	number	✅	0〜100（概算でよい）
message	string	✅	状況説明（短文）
eta_sec	number | null	⛔	v1はnullでよい
4.3 locks
key	型	必須	説明
request_lock	object	✅	request排他
queue_lock	object	✅	全体排他（auto-run等）

request_lock/queue_lock の共通構造：

key	型	必須	説明
path	string	✅	lockファイルパス
held	bool	✅	保持中か
acquired_at	string(ISO)|null	✅	取得時刻
ttl_sec	number	✅	TTL
4.4 artifacts
key	型	必須	説明
request_path	string	✅	request md
planning_json	string	⛔	planning生成後にセット
report_md	string	✅	reportは開始直後に空でも作ってよい
errors_json	string | null	✅	needs_input/failed時のみ
patches	array[string]	✅	生成済みpatch一覧
logs_dir	string	✅	logs/
compare_url	string | null	✅	git pushした場合のcompare URL（任意）
4.5 counters
key	型	必須	説明
planner_calls	number	✅	Planner呼び出し回数
implementer_calls	number	✅	Implementer呼び出し回数
qa_calls	number	✅	QA呼び出し回数
unit_runs	number	✅	unit実行回数
e2e_runs	number	✅	e2e実行回数
autofix_cycles	number	✅	自動修正ループ回数
retries	number	✅	role再試行回数（合計）
4.6 signals（UI/Runner協調）
key	型	必須	説明
stop_requested	bool	✅	UIから停止要求（v1は未使用でもよい）
resume_requested	bool	✅	UIから再開要求（v1.1用）
notes	string | null	✅	UI側メモ（任意）
5. StepState（steps[]）仕様（v1）

planning.json（D55）の steps[] と 同じ順序・同じstep_id で並べる。

5.1 StepState
key	型	必須	説明
step_id	string	✅	S01 等
title	string	✅	表示用
role	string	✅	implementer 等
status	"PENDING"|"RUNNING"|"DONE"|"FAILED"|"SKIPPED"|"NEEDS_INPUT"	✅	step単位状態
started_at	string(ISO)|null	✅	開始
ended_at	string(ISO)|null	✅	終了
attempt	number	✅	試行回数（1〜）
summary	string	✅	1行要約
logs	array[string]	✅	関連ログへの相対パス
patch_path	string | null	✅	生成patch
diff_stat	object	✅	差分統計（概算）
test	object	✅	unit/e2e結果（そのstepに紐づけ）
error	ErrorObject | null	✅	step単位エラー
5.2 diff_stat
key	型	必須	説明
files_changed	number	✅	変更ファイル数
lines_added	number	✅	追加行
lines_deleted	number	✅	削除行
too_large	bool	✅	max_diff_lines 超過フラグ
5.3 test
key	型	必須	説明
unit	TestResult	✅	unit結果
e2e	TestResult	✅	e2e結果（v1はSKIPPED多い）

TestResult：

key	型	必須	説明
status	"NOT_RUN"|"RUNNING"|"PASS"|"FAIL"|"SKIPPED"	✅
command	string | null	✅	実行コマンド
log_path	string | null	✅	ログ
duration_ms	number | null	✅	任意
failed_summary	string | null	✅	失敗要約（短文）
6. ErrorObject（共通）仕様（v1）

D33（分類）と整合し、UIが「次の行動」を出せることが必須。

key	型	必須	説明
category	"ENVIRONMENT"|"INPUT"|"CONTRACT"|"EXECUTION"|"TEST"|"GIT"	✅	分類
reason_code	string	✅	例：WORKTREE_DIRTY
title	string	✅	1行
message	string	✅	短文（UI表示）
severity	"Blocker"|"Major"|"Minor"	✅
retryable	bool	✅	自動再試行可能か
actions	array[string]	✅	復帰手順（箇条書き短文）
related_paths	array[string]	⛔	関連ログ/ファイル
meta	object	⛔	任意
7. 更新規約（Runner必須）
7.1 更新の粒度

状態が変わるたびに stage.json を更新する（最小でも以下）

INIT開始

ロック取得後

planning生成後

step開始/終了（status変更）

patch適用結果

テスト開始/終了

report生成後

最終（DONE/FAILED/NEEDS_INPUT）

7.2 書き込みの安全性

破損防止のため、実装は必ず atomic write（tmp→rename）を推奨

JSONが壊れた場合は STAGE_WRITE_FAILED（INTERNAL/EXECUTION）で停止し、stderrに出す

7.3 一貫性チェック（保存前に必須）

steps.length が planning.json と一致

current_step_index が範囲内

state=DONE/FAILED/NEEDS_INPUT のとき ended_at が入る

8. UI描画契約（最低限）

UIは stage.json から以下を表示できればよい（v1 MVP）。

Run概要：state, stage, title, progress.message

ステップ一覧：steps[].status, steps[].summary, steps[].patch_path, steps[].test.unit.status

停止理由：error.reason_code, error.actions

成果物リンク：artifacts.report_md, artifacts.errors_json, artifacts.logs_dir

9. 最小サンプル（v1：実行中→完了）
json
{
"version": "1.0",
"request_id": "RQ-20251214-008",
"run_id": "20251214-210501-a1b2c3",
"state": "RUNNING",
"stage": "IMPLEMENTING",
"title": "S01: patch生成中",
"started_at": "2025-12-14T21:05:01+09:00",
"updated_at": "2025-12-14T21:06:10+09:00",
"ended_at": null,
"progress": { "percent": 55, "message": "Implementerを実行しています", "eta_sec": null },
"current_step_index": 0,
"steps": [
{
"step_id": "S01",
"title": "Planner出力の検証と最小patch生成",
"role": "implementer",
"status": "RUNNING",
"started_at": "2025-12-14T21:05:40+09:00",
"ended_at": null,
"attempt": 1,
"summary": "patch生成を実行中",
"logs": ["runs/.../logs/llm.implementer.raw.txt"],
"patch_path": null,
"diff_stat": { "files_changed": 0, "lines_added": 0, "lines_deleted": 0, "too_large": false },
"test": {
"unit": { "status": "NOT_RUN", "command": "php artisan test", "log_path": null, "duration_ms": null, "failed_summary": null },
"e2e": { "status": "SKIPPED", "command": null, "log_path": null, "duration_ms": null, "failed_summary": null }
},
"error": null
}
],
"locks": {
"request_lock": { "path": ".aiflow/locks/RQ-20251214-008.lock", "held": true, "acquired_at": "2025-12-14T21:05:01+09:00", "ttl_sec": 900 },
"queue_lock": { "path": ".aiflow/locks/queue.lock", "held": true, "acquired_at": "2025-12-14T21:05:01+09:00", "ttl_sec": 900 }
},
"artifacts": {
"request_path": "requests/RQ-20251214-008.md",
"planning_json": "runs/.../planning.json",
"report_md": "runs/.../report.md",
"errors_json": null,
"patches": [],
"logs_dir": "runs/.../logs",
"compare_url": null
},
"error": null,
"counters": { "planner_calls": 1, "implementer_calls": 1, "qa_calls": 0, "unit_runs": 0, "e2e_runs": 0, "autofix_cycles": 0, "retries": 0 },
"signals": { "stop_requested": false, "resume_requested": false, "notes": null }
}

10. 受け入れ基準（D56）

UIは stage.json だけでRun詳細を描画できる

Runnerは stage.json を更新するだけで進行/停止を表現できる

NEEDS_INPUT/FAILED で reason_code と actions が必ず出る

stepsがplanningに厳密一致し、反復/再開の前提が崩れない

atomic write 等で破損しにくい

次は、D57. runs/ 成果物ディレクトリ規約（ファイル名・必須ファイル・ログ命名・容量管理） を固めると、実装と運用が一気に安定します。

