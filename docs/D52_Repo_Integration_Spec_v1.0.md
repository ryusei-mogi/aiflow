D52. リポジトリ統合仕様（導入手順・npm scripts・設定配置）v1.0

対象：既存の開発リポジトリ（Laravel/PHP+MySQL、フロントあり/なし両対応）に aiflow-local を“ローカルだけ”で組み込む方法
目的：npm install だけで UI/Runner が使える状態を作り、運用を固定する（devDependencies 推奨）
前提：gh依存なし／git依存OK／サブスクCLI（codex/gemini）は各自ローカルログイン前提／トークン不要モード

1. 統合方式（推奨：方式A）
方式A（推奨）: リポジトリ内に tools/aiflow を同梱（ローカルパッケージ）

メリット：インストールが軽い／外部公開不要／バージョンをリポジトリで固定できる

デメリット：aiflow自体の更新もrepo内コミットになる

方式B（代替）: 既存フロント配下に統合（例：frontend/ の dev server と統合）

メリット：UIを既存のSPAに組み込める

デメリット：既存アプリの依存と衝突しやすい（MVPでは非推奨）

以降は 方式A を正として記載します。

2. ディレクトリ配置（方式A）

repo-root 直下に次を追加します。

python
repo-root/
tools/
aiflow/
package.json
src/...
(build出力 or ts-node実行どちらでも可)

requests/                 # Git管理（入力）
RQ-....md

.aiflow/                  # Git管理（設定）
config.v1.json
router.v1.json
prompts/                # 任意（D42）
schemas/                # 任意（D42）

runs/                     # gitignore（出力）
<request-id>/<run-id>/...

.gitignore
package.json              # 既存に追記（scripts/devDependencies）

3. .gitignore 追加（必須）

最低限これを追加します。

gitignore
# aiflow runtime outputs
runs/
.aiflow/locks/
.aiflow/cache/

# node artifacts (if needed)
tools/aiflow/node_modules/
tools/aiflow/dist/

4. ルート package.json 追記（必須）
4.1 devDependencies（推奨）

aiflowを repo 内ローカルパッケージとして参照します。

json
{
"devDependencies": {
"@local/aiflow": "file:tools/aiflow"
}
}


既存のpackage.jsonがある前提。フロントが無い場合でも、aiflow用途に root package.json を置くのは許容（MVP優先）。

4.2 scripts（推奨セット）
json
{
"scripts": {
"aiflow:dev": "aiflow dev",
"aiflow:doctor": "aiflow doctor",
"aiflow:run": "aiflow run --request",
"aiflow:run-next": "aiflow run-next"
}
}


aiflow dev：UI＋API起動（D45）

aiflow doctor：環境チェック（D47）

aiflow run --request <id|path>：指定requestを実行

aiflow run-next：Next選定して実行（v1.1向け。v1で未実装でもOK）

5. 設定ファイル配置（必須）
5.1 .aiflow/config.v1.json（MVP例）
json
{
"version": "1.0",
"mode": "no_token",
"paths": {
"requests_dir": "requests",
"runs_dir": "runs"
},
"server": {
"host": "127.0.0.1",
"port": 4310
},
"git": {
"base_branch": "main",
"require_clean_worktree": true,
"enforce_work_branch": true
},
"limits": {
"max_diff_lines": 400,
"timeout_sec": 180
},
"tests": {
"unit": {
"enabled": true,
"command": "php artisan test"
},
"e2e": {
"enabled": false,
"command": "npm run test:e2e"
}
}
}

5.2 .aiflow/router.v1.json（D43の要点）
json
{
"version": "1.0",
"mode": "no_token",
"defaults": { "timeout_sec": 180, "max_retries_per_call": 1 },
"routing": {
"planner": { "primary": "codex", "fallback": "gemini" },
"reviewer": { "primary": "gemini", "fallback": "codex" },
"implementer": { "primary": "codex", "fallback": "gemini" },
"qa": { "primary": "gemini", "fallback": "codex" }
},
"models": {
"codex": { "planner": "gpt-5.2-xhigh", "implementer": "gpt-5.2-xhigh" },
"gemini": { "reviewer": "gemini-3-pro", "qa": "gemini-3-pro" }
}
}


モデル名は「CLIで指定できる値」に合わせて調整可能であること（要件）。

6. ポート衝突ポリシー（必須）

aiflow UI/API：4310 をデフォルト（Laravelの8000、Viteの5173等と被りにくい）

変更は .aiflow/config.v1.json または環境変数で上書きできる（推奨）

環境変数（任意・推奨）

AIFLOW_PORT：ポート上書き

AIFLOW_HOST：host上書き

AIFLOW_CONFIG：設定ファイルパス（例：.aiflow/config.v1.json）

7. “npm installしたら使える” 導入手順（方式A）
初回セットアップ

tools/aiflow/ を配置（repoに追加）

.aiflow/（config/router）を配置

requests/ を作成し、D51の RQ-001.md を入れる

npm install

npm run aiflow:doctor

npm run aiflow:dev

ブラウザで http://127.0.0.1:4310 を開く

日次運用（最小）

requestを追加/編集 → UIでRun → report生成 → あなたが総合テスト → done

8. 既存Laravel/フロントとの共存ルール（必須）

aiflowは 既存アプリを改変しない（MVPは独立UI）

aiflowが呼ぶテストコマンドは、既存の起動方式に合わせて config.v1.json で指定する

例：LaravelがSailなら ./vendor/bin/sail test に差し替える

DBやアプリ起動が必要なE2Eは v1.1 で段階導入（MVPはunit中心）

9. gh禁止の担保（必須）

aiflow実装側で gh コマンドを一切呼ばない

さらに安全策として：

実行ログに gh が含まれたら reason_code=GH_DEPENDENCY_DETECTED でFAIL（任意）

10. 受け入れ基準（D52）

npm install → npm run aiflow:dev でUIが起動する

.aiflow/ と requests/ はGit管理、runs/ はGit管理外

gh不要、gitは使用してよい

ポート衝突を避けられ、設定で変更できる

v1の縦串（plan→impl→unit→report）に必要な設定が揃う

次は、実装者（AI）が迷わないように D53. コマンドライン仕様（aiflow CLIのコマンド・引数・終了コード・標準出力契約） を固めるのが最短です。

