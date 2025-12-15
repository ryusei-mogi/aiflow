D53. コマンドライン仕様（aiflow CLI：コマンド・引数・終了コード・出力契約）v1.0

対象：aiflow-local を npm scripts から呼ぶための CLI（ローカル完結）
目的：ブラウザUIだけでなく、CI/手動実行/デバッグでも同じ挙動にし、Runnerの入口を固定する。
前提：gh禁止／git依存OK／no_tokenモード／設定は .aiflow/*。

1. CLIの基本方針

実装言語/フレームワークは自由（AIに任せる）が、インタフェース契約は固定

すべてのコマンドは --config で設定ファイルを指定できる

すべてのコマンドは --json で機械可読な出力を返せる（標準出力）

失敗時は stderr に人間向け短文、stdoutは（--json時は）エラーJSON

2. コマンド一覧（v1.0）
2.1 必須コマンド

aiflow dev

aiflow doctor

aiflow list

aiflow show <request-id>

aiflow run --request <id|path>

aiflow run-next

2.2 任意（v1.1）

aiflow resume --request <id> [--run <run_id>]

aiflow clean --locks [--older-than <minutes>]

3. 共通オプション
Option	型	デフォルト	説明
--config <path>	string	.aiflow/config.v1.json	設定ファイル
--router <path>	string	.aiflow/router.v1.json	Router設定
--json	bool	false	stdoutをJSONで出力
--verbose	bool	false	詳細ログ
--dry-run	bool	false	外部CLI/テスト実行をせずに計画のみ表示（runで有効）
--no-ui	bool	false	dev起動時にUIを無効化（APIのみ）
--port <n>	number	config.server.port	サーバポート上書き
--host <ip>	string	config.server.host	サーバhost上書き
4. 各コマンド仕様
4.1 aiflow dev
概要

ローカルWeb UI＋APIサーバを起動する（D45）

Usage

aiflow dev [--port 4310] [--host 127.0.0.1] [--no-ui]

成功条件

サーバが起動し、起動ログにURLが出る

出力（標準）

stdout（人間向け）：

AIFLOW_DEV_STARTED host=127.0.0.1 port=4310

stdout（--json）：

json
{ "ok": true, "host": "127.0.0.1", "port": 4310, "ui": true }

4.2 aiflow doctor
概要

環境チェックを実行（D47）

Usage

aiflow doctor [--verbose]

チェック項目（必須）

node, git

codex, gemini（どちらか必須、両方ならPASS）

worktree clean（configでrequireの場合）

config/routerの構文妥当性

出力（--json）
json
{
"ok": true,
"checks": [
{"id":"node","status":"PASS"},
{"id":"git","status":"PASS"},
{"id":"codex","status":"PASS"},
{"id":"gemini","status":"PASS"},
{"id":"worktree_clean","status":"PASS"}
]
}

4.3 aiflow list
概要

requests一覧を表示（D45のGET /api/requests 相当）

Usage

aiflow list [--status ready] [--priority P1]

出力（--json）
json
{ "items": [ { "id":"RQ-...", "title":"...", "meta": {...}, "derived": {...} } ] }

4.4 aiflow show <request-id>
概要

request単体表示（本文込み）

Usage

aiflow show RQ-20251214-001

出力（--json）
json
{ "id":"RQ-...", "meta": {...}, "title":"...", "body_markdown":"..." }

4.5 aiflow run --request <id|path>
概要

指定requestを実行し、runs配下に成果物を生成する（D34/D42/D41/D37）

Usage

aiflow run --request RQ-... [--base main] [--mode safe] [--dry-run]

オプション
Option	型	デフォルト	説明
`--request <id	path>`	string	必須
--base <branch>	string	config.git.base_branch	diff base
`--mode <safe	fast>`	string	safe
--max-steps <n>	number	1（v1）	v1はS01のみ実行が基本。v1.1で拡張
`--auto-fix <0	1>`	number	1
実行順（v1）

lock取得（D39）

planning生成（Planner）

step S01 implement

patch apply/check

unit実行

report生成

stage更新（DONE/FAILED/NEEDS_INPUT）

結果出力（--json）
json
{
"ok": true,
"request_id": "RQ-...",
"run_id": "RUN-...",
"run_path": "runs/RQ-.../RUN-...",
"stage": { "state": "DONE", "reason_code": null },
"artifacts": {
"planning_json": "runs/.../planning.json",
"report_md": "runs/.../report.md",
"patches": ["runs/.../patches/S01.patch"],
"logs": ["runs/.../logs/router.planner.log", "runs/.../logs/tests/unit.S01.log"]
}
}

失敗時（--json）
json
{
"ok": false,
"error": {
"category": "TEST",
"reason_code": "UNIT_TEST_FAILED",
"message": "Unit tests failed",
"actions": ["Open runs/.../logs/tests/unit.S01.log", "Re-run after fixing or add clarification"]
},
"request_id": "RQ-...",
"run_id": "RUN-..."
}

4.6 aiflow run-next
概要

D35のNext Requestを選定して run を実行する

Usage

aiflow run-next [--mode safe]

出力（--json）

run と同じ（加えて next選定理由を含めてよい）

5. 終了コード（v1）
code	意味
0	成功（ok=true）
2	入力不正（REQUEST_INVALID_FORMAT 等）
3	環境不備（CLI_NOT_AVAILABLE / CLI_AUTH_REQUIRED 等）
4	ロック/実行競合（RUN_IN_PROGRESS 等）
5	LLM出力不正（JSON_PARSE_ERROR / JSON_SCHEMA_INVALID 等）
6	Git失敗（PATCH_APPLY_FAILED 等）
7	テスト失敗（UNIT_TEST_FAILED / E2E_TEST_FAILED 等）
9	内部エラー（INTERNAL_ERROR）
6. ログ出力規約（v1）

標準出力：要点（開始/終了/成果物パス）

標準エラー：失敗理由（1行）＋ reason_code

詳細ログ：runs/<req>/<run>/logs/ に保存

router.<role>.log

llm.<role>.raw.txt

tests/unit.<step>.log

7. 受け入れ基準（D53）

npm scriptsから各コマンドが呼べる

--json により、UI/自動化から機械的に扱える

reason_code/actions が必ず返り、D47辞書と整合する

ghを一切使わない

v1ではS01のみ実行でも縦串が通る

次は、CLIやUIが共通で参照する D54. 設定スキーマ仕様（config/routerの必須キー・デフォルト・バリデーション） を固めると、実装がブレなくなります。

