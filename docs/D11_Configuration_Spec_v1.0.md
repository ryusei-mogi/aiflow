D11. 設定仕様（Configuration Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）
前提：UI（D6）／API（D7）／Runner（D10）／Git（D8）／Request（D3）
制約：ローカルのみ、gh 非依存、git 依存可、トークン不要PRモード、npm installで使える（devDependencies推奨）

1. 目的

aiflow-local を「既存の開発ディレクトリで npm install → 起動」で使えるようにするため、設定の置き場・形式・デフォルト・上書き規則 を定義する。
狙いは以下。

できるだけ 設定ゼロで動く（convention over configuration）

それでもプロジェクト差（paths、コマンド、テスト）を 無理なく吸収できる

Runnerが安全に動くためのガード（ロック・ディレクトリ・git base等）を設定で制御できる

2. 設定のレイヤーと優先順位

設定は4レイヤーを持つ。上に行くほど優先。

CLI引数（最優先）

環境変数（例：AIFLOW_*）

設定ファイル（.aiflowrc.json など）

デフォルト値（最下位）

v1では「設定ファイル＋デフォルト」でほぼ運用できることを必須とする。

3. 設定ファイルの仕様
3.1 配置場所（検索順）

Runner/UIサーバは、起動時に以下を上から順に探索し、最初に見つかったものを採用する。

./.aiflowrc.json

./.aiflowrc（JSON）

./aiflow.config.json

./package.json の aiflow フィールド（任意）

v1はJSONのみサポート（YAMLは不要）。解析・運用が単純になるため。

3.2 JSON Schema（概要）

設定ファイルは以下のトップレベルを持つ。

project

paths

server

git

runner

ai

commands

testing

logging

safety

4. デフォルト値（v1）

設定がない場合でも、以下のデフォルトで起動できる。

4.1 project

project.root: process.cwd()

project.name: リポジトリフォルダ名

4.2 paths

paths.requestsDir: requests

paths.runsDir: runs

paths.locksDir: .aiflow/locks

paths.tmpDir: .aiflow/tmp

4.3 server

server.host: 127.0.0.1

server.port: 4321

server.basePath: /（UI）

server.apiBasePath: /api/v1

server.wsPath: /ws

4.4 git

git.baseBranchDefault: main

git.branchPrefix: ai/

git.remoteName: origin

4.5 runner

runner.maxConcurrentRuns: 1

runner.pollIntervalMs: 5000（UIがWSなしの場合の補助）

runner.planRetries: 2

runner.stepFixRetries: 2

runner.e2eRetries: 1

runner.stepMaxFilesTouched: 10（目安。超えたら分割）

runner.stepMaxDiffLines: 300（目安。超えたら分割）

runner.autoPush: true（done時は必須）

runner.pushEachStep: false（好みでON）

4.6 ai（抽象）

ai.mode: subscription-cli（APIキー直叩きしない）

ai.tokenFreePrMode: true（gh不要・compare URL）

ai.defaultEngine: codex（例：plan/impl）

ai.secondaryEngine: gemini（例：browser testや補助）

実際の呼び分けは「実装側に委任」だが、設定としてスイッチを持てるようにしておく。

5. 設定項目詳細
5.1 project
json
{
"project": {
"root": ".",
"name": "MiraiNavi"
}
}


root：相対/絶対どちらも可。通常は不要

name：UI表示用

5.2 paths
json
{
"paths": {
"requestsDir": "requests",
"runsDir": "runs",
"locksDir": ".aiflow/locks",
"tmpDir": ".aiflow/tmp"
}
}


要件：

requestsDir が存在しない場合は起動時に作成してよい

runsDir も同様

locksDir/tmpDir は .gitignore 推奨（ツール側で初期化提案してよい）

5.3 server
json
{
"server": {
"host": "127.0.0.1",
"port": 4321,
"apiBasePath": "/api/v1",
"wsPath": "/ws"
}
}


要件：

host はローカル固定推奨（0.0.0.0 はv1非推奨）

port 競合時はエラーで停止（自動探索はv2）

5.4 git
json
{
"git": {
"baseBranchDefault": "main",
"branchPrefix": "ai/",
"remoteName": "origin"
}
}


要件：

Requestに base/branch が無い場合、このデフォルトを採用

compare URL生成は remote URL から導出（D8）

5.5 runner
json
{
"runner": {
"maxConcurrentRuns": 1,
"planRetries": 2,
"stepFixRetries": 2,
"e2eRetries": 1,
"stepMaxFilesTouched": 10,
"stepMaxDiffLines": 300,
"autoPush": true,
"pushEachStep": false
}
}


要件：

無限ループ防止：各retryは上限必須

Stepの肥大化を検知したら分割（D4/D10）

5.6 commands（外部コマンド定義）

ツールは「どうやるか」をAIに委任する方針だが、最低限「実行する主要コマンド」を設定で差し替えできると運用が安定する。

json
{
"commands": {
"unitTest": "phpunit",
"e2eTest": "npm run e2e",
"lint": "npm run lint",
"typecheck": "npm run typecheck"
}
}


要件：

未指定なら存在確認せずスキップしてよい（v1では必須ではない）

Plan/Stepにテスト指示がある場合は、ここを優先して採用可能

5.7 testing
json
{
"testing": {
"requireUnitEachStep": true,
"requireE2EForRegressionAC": true,
"e2eSmokeCommand": "npm run e2e -- --grep \"smoke\""
}
}


要件：

「回帰ACがあるならE2E」がデフォルト

ただしE2Eが実行不能なら needs_input に落とす（D10）

5.8 logging
json
{
"logging": {
"level": "info",
"persistRuns": true,
"maxRunsPerRequest": 30
}
}


要件：

runs/ の肥大化を防ぐ（上限超えたら古いRunをアーカイブ/削除候補として通知）

5.9 safety（安全設定）
json
{
"safety": {
"requireCleanWorktree": true,
"forbidForcePush": true,
"forbidBaseBranchCommit": true,
"lockTimeoutSec": 7200
}
}


要件：

v1では requireCleanWorktree=true 固定推奨（falseは非推奨）

ロックはタイムアウトで回収可能にする（異常終了対策）

5.10 ai（CLIエンジン設定：抽象）

実装詳細はAIに委任するが、利用ツールや役割を「切替可能」にするための設定を持つ。

json
{
"ai": {
"mode": "subscription-cli",
"tokenFreePrMode": true,
"engines": {
"planner": "codex",
"implementer": "codex",
"qa": "gemini"
}
}
}


要件：

v1は「どのCLIを使うか」を固定ルールでよい（学習型ルータ不要）

CLIが見つからない場合は Doctor で検出し、failed または needs_input

6. 環境変数（上書き）

AIFLOW_PORT → server.port

AIFLOW_HOST → server.host

AIFLOW_REQUESTS_DIR → paths.requestsDir

AIFLOW_RUNS_DIR → paths.runsDir

AIFLOW_BASE_BRANCH → git.baseBranchDefault

AIFLOW_LOG_LEVEL → logging.level

v1は最小限でOK。増やしすぎない。

7. CLI引数（上書き）

最小コマンド想定（例）：

aiflow dev --port 4321

aiflow run <requestId>

aiflow doctor

引数例：

--config <path>：設定ファイル明示

--requests-dir <path>

--runs-dir <path>

--base <branch>

--branch <branch>

--dry-run（Runnerは実行せず計画だけ等）

CLI仕様自体は別紙（D12）でも良いが、v1では上書き規則だけ本書で定義する。

8. 設定の検証（Validation）

起動時に以下を検証し、NGなら Doctor 誘導またはエラー停止。

必須検証：

paths.requestsDir が書き込み可能

git が利用可能（git --version）

project.root がgit repoである（ただし --skip-git-check があるなら例外）

server.port が利用可能

推奨検証：

phpunit が存在するか（commands.unitTest）

npm が存在するか（e2eを使うなら）

9. 初期化（Bootstrap）仕様
9.1 npm install 直後に必要なもの

requests/ が無ければ自動生成

.aiflow/（locks/tmp）も必要に応じて生成

.gitignore に以下を提案（自動追記は任意）

.aiflow/

runs/（運用次第。残したいなら除外しない）

9.2 推奨：初期設定ファイル生成

aiflow init（将来）で .aiflowrc.json を生成できるのが理想だが、v1では必須ではない。

10. サンプル設定（最小）

.aiflowrc.json

json
{
"server": { "port": 4321 },
"git": { "baseBranchDefault": "main" },
"commands": {
"unitTest": "phpunit",
"e2eTest": "npm run e2e"
},
"testing": {
"requireUnitEachStep": true,
"requireE2EForRegressionAC": true
}
}

11. 受け入れ基準（本Spec）

設定ファイルがなくてもデフォルトで起動できる

.aiflowrc.json を置けば、paths/port/testコマンドが差し替えできる

CLI引数・環境変数で上書きできる

safety設定により事故（base直コミット・force push・汚い作業ツリー開始）を防げる

retry上限やStep制限が設定可能で、無限ループ/肥大化を防止できる

12. 関連（依存）

D6：UI仕様（port/pathsに依存）

D7：API仕様（server/apiBasePath）

D8：Git運用仕様（base/branch/remote）

D10：Runner内部フェーズ仕様（retry/limits/logging）

D3：Requestファイル仕様（requestsDir）

次は、実装の入口として D12（CLIコマンド仕様） か、npm install に落とすための D13（パッケージング/配布仕様：devDependencies・起動方法） を作るのが自然です。

