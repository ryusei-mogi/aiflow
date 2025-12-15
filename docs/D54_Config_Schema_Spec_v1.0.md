D54. 設定スキーマ仕様（config/router：必須キー・デフォルト・バリデーション）v1.0

対象：.aiflow/config.v1.json と .aiflow/router.v1.json
目的：実装者（AI）が迷わず実装でき、UI/CLIの挙動が設定で一意に決まるようにする。
前提：ローカル完結／gh禁止／git依存OK／no_tokenモード／D53（CLI）と整合。

1. 共通ルール（v1）

JSONファイルのみ（YAML不可）

未知キーは許容するが警告（v1は前方互換優先）

バリデーション失敗は reason_code=CONFIG_INVALID（category=INPUT）で停止

すべてのデフォルト値は「コード内固定」ではなく スキーマ側で明示（実装はそれを採用）

2. config.v1.json スキーマ仕様
2.1 ルート
key	型	必須	デフォルト	説明
version	string	✅	"1.0"	互換判定（1.xを許容）
mode	"no_token" | "normal"	✅	"no_token"	トークン計測なし運用
paths	object	✅	-	ディレクトリ指定
server	object	✅	-	UI/API設定
git	object	✅	-	git運用ルール
limits	object	✅	-	実行制限
tests	object	✅	-	テスト実行定義
ui	object	⛔	{}	UI表示設定（任意）
2.2 paths
key	型	必須	デフォルト	説明
repo_root	string	⛔	"."	repo基準
requests_dir	string	✅	"requests"	request格納
runs_dir	string	✅	"runs"	run出力
aiflow_dir	string	⛔	".aiflow"	設定/locks等
locks_dir	string	⛔	".aiflow/locks"	ロック
cache_dir	string	⛔	".aiflow/cache"	キャッシュ
prompts_dir	string	⛔	".aiflow/prompts"	プロンプト（任意）
schemas_dir	string	⛔	".aiflow/schemas"	スキーマ（任意）

バリデーション（必須）

requests_dir が存在しなければ REQUESTS_DIR_NOT_FOUND

runs_dir は無ければ作成（作成不可なら RUNS_DIR_CREATE_FAILED）

2.3 server
key	型	必須	デフォルト	説明
host	string	✅	"127.0.0.1"	バインド
port	number	✅	4310	UI/API
open_browser	bool	⛔	false	dev起動で自動オープン
cors	object	⛔	{ "enabled": false }	CORS設定

バリデーション

portが使用中なら PORT_IN_USE（ENVIRONMENT）

2.4 git
key	型	必須	デフォルト	説明
base_branch	string	✅	"main"	diff base
require_clean_worktree	bool	✅	true	dirtyなら停止
enforce_work_branch	bool	✅	true	main直変更禁止
work_branch_prefix	string	⛔	"aiflow/"	作業ブランチ名
auto_commit	bool	⛔	false	v1は基本false
auto_push	bool	⛔	false	v1は基本false（gh禁止とは無関係）

バリデーション

require_clean_worktree=true で dirty なら WORKTREE_DIRTY

enforce_work_branch=true で HEAD==base_branch なら WORK_BRANCH_REQUIRED

2.5 limits
key	型	必須	デフォルト	説明
max_diff_lines	number	✅	400	1stepの最大差分（超過はreplan）
timeout_sec	number	✅	180	外部CLI/テスト共通timeout
max_steps_per_run	number	⛔	1	v1は1（S01のみ）
max_autofix_cycles	number	⛔	1	テスト失敗→自動修正の最大回数
lock_ttl_sec	number	⛔	900	ロックTTL（15分）

バリデーション

max_diff_lines < 50 は危険なので警告（停止はしない）

timeout_sec < 30 は警告

2.6 tests
tests.unit
key	型	必須	デフォルト	説明
enabled	bool	✅	true	unit実行
command	string	✅	"php artisan test"	実行コマンド
timeout_sec	number	⛔	limits.timeout_sec	unit個別
tests.e2e
key	型	必須	デフォルト	説明
enabled	bool	✅	false	e2e実行
command	string	✅	"npm run test:e2e"	実行コマンド
timeout_sec	number	⛔	max(limits.timeout_sec, 300)	長め推奨

バリデーション

enabled=true なのに command空なら TEST_COMMAND_NOT_FOUND

2.7 ui（任意）
key	型	必須	デフォルト	説明
show_advanced	bool	⛔	false	詳細設定表示
poll_interval_ms	number	⛔	1000	Run状態ポーリング
default_view	string	⛔	"requests"	初期画面
3. router.v1.json スキーマ仕様
3.1 ルート
key	型	必須	デフォルト	説明
version	string	✅	"1.0"	互換判定
mode	"no_token" | "normal"	✅	"no_token"	configと一致必須
defaults	object	✅	-	タイムアウト/リトライ等
routing	object	✅	-	role→provider
models	object	✅	-	provider→role→model
commands	object	✅	-	provider→CLI実行テンプレ
guards	object	⛔	-	gh禁止など追加検査
3.2 defaults
key	型	必須	デフォルト	説明
timeout_sec	number	✅	180	CLI呼び出しtimeout
max_retries_per_call	number	✅	1	失敗時の再試行
fallback_on	array	⛔	["JSON_PARSE_ERROR","JSON_SCHEMA_INVALID","PROCESS_CRASHED"]	fallback条件
3.3 routing

役割（role）キー：planner, implementer, reviewer, qa

値：{ primary: "<provider>", fallback: "<provider>" }

バリデーション

primary/fallbackが同一でも可（fallback無効扱い）

provider未定義なら ROUTER_PROVIDER_UNKNOWN

3.4 models

例：

json
{
"codex": { "planner": "gpt-5.2-xhigh", "implementer": "gpt-5.2-xhigh" },
"gemini": { "reviewer": "gemini-3-pro", "qa": "gemini-3-pro" }
}


バリデーション

routingで参照された provider/role のmodelが無ければ MODEL_NOT_CONFIGURED

3.5 commands（CLI実行テンプレ）

providerごとに「実行コマンドのテンプレ」を定義する。
※ 実際の引数はCLI仕様変更があり得るので、ここは 差し替え可能 にするのが目的。

例（概念）：

json
{
"codex": {
"bin": "codex",
"args": ["exec", "-m", "{{model}}", "-C", "{{workdir}}", "{{prompt}}"]
},
"gemini": {
"bin": "gemini",
"args": ["-m", "{{model}}", "-o", "json", "-y", "{{prompt}}"]
}
}


バリデーション

binが空なら CLI_NOT_AVAILABLE（ENVIRONMENT扱いでも可）

argsに {{prompt}} が無い場合は ROUTER_COMMAND_INVALID

3.6 guards（任意）
key	型	デフォルト	説明
forbid_commands	array[string]	["gh"]	禁止コマンド
forbid_patterns	array[string]	["\\bgh\\b"]	ログ/コマンド検査

バリデーション

forbidに該当したら GH_DEPENDENCY_DETECTED（EXECUTIONまたはINPUT）

4. 相互整合ルール（config ↔ router）

mode は一致必須。不一致は CONFIG_MODE_MISMATCH

limits.timeout_sec と router.defaults.timeout_sec が大きく乖離する場合は警告

providerが一つも有効でない（codex/gemini両方使えない）なら doctorでFAIL

5. エラーコード（設定系：v1追加）
reason_code	category	典型原因
CONFIG_NOT_FOUND	ENVIRONMENT	configパス不正
CONFIG_INVALID	INPUT	JSON不正/必須キー欠落
CONFIG_MODE_MISMATCH	INPUT	config/routerのmode不一致
ROUTER_PROVIDER_UNKNOWN	INPUT	routing先不明
MODEL_NOT_CONFIGURED	INPUT	models未設定
ROUTER_COMMAND_INVALID	INPUT	commandsテンプレ不正
REQUESTS_DIR_NOT_FOUND	ENVIRONMENT	requests無い
RUNS_DIR_CREATE_FAILED	ENVIRONMENT	runs作れない
PORT_IN_USE	ENVIRONMENT	devポート衝突
6. 受け入れ基準（D54）

config/routerの必須キーとデフォルトが明文化されている

doctorで設定妥当性チェックが可能

CLI/UIの挙動が設定により一意に決まる

gh禁止が設定（guards）で担保できる

max_diff_lines/step分割など “長すぎて途中で止まる問題” を設定で制御できる

次は、実装が最もブレやすい D55. planning.json（計画）スキーマ仕様（steps分割・gates・targets） を固定すると、タスク細分化の自動化が安定します。

