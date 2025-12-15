D58. errors.json 最終仕様（分類・reason_code・復帰手順・UI表示契約）v1.0

対象：runs/<request-id>/<run-id>/errors.json
目的：Runが止まったときに「何が起きたか／何をすれば復帰できるか」を機械可読で固定し、UI/運用を止めない。
前提：D33（分類運用）／D47（reason_code辞書）／D56（stage.jsonのErrorObject）／D37（report）と整合。

1. 生成ルール（v1固定）

errors.json は NEEDS_INPUT / FAILED のときのみ生成（推奨）

DONE の場合は 生成しない（ファイル有無で分岐できる）

errors.json の内容は、stage.json.error と 同一の情報を含む（重複を許容）

UIは stage.json.error を第一候補とし、errors.json は詳細参照（またはダウンロード）に使う

2. スキーマ（v1）
2.1 ルート
key	型	必須	説明
version	string	✅	"1.0"
request_id	string	✅
run_id	string	✅
status	"needs_input" | "failed"	✅	stage.stateとの対応：NEEDS_INPUT/FAILED
severity	"Blocker" | "Major" | "Minor"	✅
category	"ENVIRONMENT" | "INPUT" | "CONTRACT" | "EXECUTION" | "TEST" | "GIT"	✅	D33分類
reason_code	string	✅	D47辞書のキー
title	string	✅	1行
message	string	✅	人間向け短文（UIに出す）
retryable	bool	✅	自動再試行可能か（v1は基本false寄り）
actions	array[string]	✅	復帰手順（短文箇条書き）
evidence	object	✅	ログ/コマンド/exit code等の根拠
related_paths	array[string]	✅	関連ファイル（相対）
suggested_next	object	✅	次に押すべきUI操作の指示
meta	object	⛔	任意（追加情報）
2.2 evidence
key	型	必須	説明
failed_at_stage	string	✅	例：TESTING
failed_step_id	string | null	✅	例：S01
command	string | null	✅	実行したコマンド（テスト/CLI等）
exit_code	number | null	✅	終了コード
stderr_snippet	string | null	✅	stderrの短い抜粋（200〜500字程度）
log_paths	array[string]	✅	重要ログへの相対パス

制約

stderr_snippet は長文禁止（UIが詰まるため）。全文は raw log に残す。

2.3 suggested_next
key	型	必須	説明
ui_action	"open_doctor"|"open_request"|"rerun"|"resume"|"open_logs"|"open_report"`	✅	UIの次アクション
hint	string	✅	ボタン名レベルの短文
requires_user_change	bool	✅	ユーザー作業が必要か

v1は resume を実装しなくても良い（その場合 rerun を出す）。

3. 必須整合（stage.json との一致）

errors.json に含まれる以下のフィールドは、stage.json.error と一致していること（生成時に同じ元情報から作る）。

category / reason_code / severity / retryable / actions / title / message

4. reason_code 運用（v1）

reason_code は 1事象 = 1コード（曖昧統合禁止）

辞書（D47）に存在しない reason_code は UNKNOWN_ERROR として扱い、meta.original_reason_code に退避して良い

代表的reason_code（例）

WORKTREE_DIRTY（GIT）

NOT_A_GIT_REPO（GIT/ENVIRONMENT）

CLI_NOT_INSTALLED（ENVIRONMENT）

JSON_PARSE_ERROR（CONTRACT）

JSON_SCHEMA_INVALID（CONTRACT）

STEP_TOO_LARGE（EXECUTION）

UNIT_TEST_FAILED（TEST）

E2E_REQUIRED_FOR_REGRESSION_AC（TEST/INPUT）

GH_DEPENDENCY_DETECTED（EXECUTION）

5. UI表示契約（v1）

UIは errors.json を（または stage.json.error を）以下の優先順で表示する。

表示項目（MVP）

title（1行）

message（短文）

reason_code（小さく表示）

actions（番号付きで表示）

「ログを開く」リンク（evidence.log_paths の先頭を優先）

suggested_next.hint（次に押すべき操作）

UI上の注意

stderr_snippet は折りたたみ

related_paths は「関連ファイル」セクションにまとめる（全部は出さず主要のみでも可）

6. 生成責務（Runner）

Runnerは停止時に必ず次を行う：

stage.json を state=NEEDS_INPUT または FAILED に更新（D56）

report.md に停止サマリを追記（D37）

errors.json を生成（このD58）

重要ログを logs/ に保存（D57）

7. 最小テンプレ（v1）
json
{
"version": "1.0",
"request_id": "RQ-20251214-008",
"run_id": "20251214-210501-a1b2c3",
"status": "needs_input",
"severity": "Blocker",
"category": "GIT",
"reason_code": "WORKTREE_DIRTY",
"title": "作業ツリーが汚れています",
"message": "未コミットの変更があるためRunを開始できません。変更をコミット/スタッシュ/破棄してから再実行してください。",
"retryable": false,
"actions": [
"git status で未コミット差分を確認する",
"必要なら git add/commit する（または git stash -u）",
"aiflow run を再実行する"
],
"evidence": {
"failed_at_stage": "INIT",
"failed_step_id": null,
"command": "git status --porcelain",
"exit_code": 0,
"stderr_snippet": null,
"log_paths": [
"runs/RQ-20251214-008/20251214-210501-a1b2c3/logs/git/status.before.txt"
]
},
"related_paths": [
"runs/RQ-20251214-008/20251214-210501-a1b2c3/stage.json",
"runs/RQ-20251214-008/20251214-210501-a1b2c3/report.md"
],
"suggested_next": {
"ui_action": "open_logs",
"hint": "ログ（git status）を開く",
"requires_user_change": true
},
"meta": {}
}

8. 受け入れ基準（D58）

NEEDS_INPUT/FAILED のとき 必ず errors.json が生成される

title/message/actions で「次に何をすればよいか」が1画面で分かる

evidence により根拠ログへ辿れる

stage.json.error と矛盾しない

reason_code が辞書運用（D47）に乗る

次は、運用面で詰まりやすい「自動選定」と「連続実行」を固めるための D59. Next Request 選定アルゴリズム最終仕様（ready優先度・depends_on・blocked回避） を作るのが効果的です。

