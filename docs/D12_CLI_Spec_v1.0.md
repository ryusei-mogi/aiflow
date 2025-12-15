D12. CLIコマンド仕様（CLI Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）
前提：設定はD11／RunnerはD10／APIはD7／UIはD6／Git運用はD8
制約：gh 非依存、git 依存可、トークン不要PRモード、npm installで使える（devDependencies推奨）

1. 目的

ローカルだけで完結する「開発代理」をCLIから起動・運用できるようにする

ブラウザUI運用のために UI/APIサーバ起動を提供する

自動化しやすいように **非対話（CI不要）**の実行コマンドを提供する

設定（D11）と整合し、失敗時に原因が分かる出力を保証する

2. コマンド体系（v1）

CLI名：aiflow

v1で提供するサブコマンド（必須）

aiflow dev：UI＋API＋Runnerを起動（ローカル常駐）

aiflow run <requestId>：指定Requestを即実行（非対話、単発）

aiflow doctor：環境チェック

aiflow list：Request一覧表示（簡易）

aiflow logs <requestId>：最新Runログを追尾（tail）

v1で任意（将来拡張）

aiflow init：設定ファイル生成

aiflow open <requestId>：ブラウザで詳細を開く

aiflow clean：古いruns整理

3. 共通仕様
3.1 グローバルオプション

全サブコマンドで共通の上書き手段を持つ（D11優先順位に従う）。

--config <path>：設定ファイルを明示指定

--root <path>：project.root 上書き

--requests-dir <path>：paths.requestsDir 上書き

--runs-dir <path>：paths.runsDir 上書き

--port <number>：server.port 上書き（dev時）

--host <ip>：server.host 上書き（dev時）

--log-level <level>：logging.level 上書き（debug/info/warn/error）

--json：出力をJSONにする（list/doctor/run結果で有効）

--no-color：色出力無効

3.2 終了コード（重要）

0：成功

1：一般エラー（設定不正、想定外）

2：ユーザー介入が必要（needs_input 相当）

3：実行失敗（failed 相当）

4：前提条件未満（gitなし、port競合などの起動不能）

run は「最終status」に応じて 0/2/3 を返すのが必須。

3.3 ログと標準出力の方針

人間向け：標準出力に要点（phase/step/status）を短く出す

詳細：runs/<id>/<run_id>/runner.log に保存

--json の場合：標準出力は機械可読な構造のみ（ログはファイル）

4. 各コマンド仕様
4.1 aiflow dev
目的

ローカルでUI運用するための常駐モード。
UI（静的配信 or dev server）＋ API（D7）＋ Runner（D10キュー）を起動する。

使用例

aiflow dev

aiflow dev --port 4322 --log-level debug

オプション

--port <n>（上書き）

--host <ip>

--open：起動後にブラウザでUIを開く（任意）

--no-runner：UI/APIのみ（任意。デバッグ用）

--watch-requests：requestsディレクトリの変更を監視し一覧に反映（推奨）

挙動

GET / でUIが表示できる状態にする

GET /api/v1/requests が応答する

Runnerキューが起動し、enqueueされたRequestを処理する

成功条件

ポート待受が開始し、起動ログが出る（URL表示）

失敗例

port競合 → exit code 4

4.2 aiflow run <requestId>
目的

指定Requestを 単発で最後まで 実行する（非対話）。
開発者がUIを開かずにCLIで回す用途。

使用例

aiflow run 20251214-login-timeout

aiflow run 20251214-login-timeout --base main --branch ai/20251214-login-timeout

オプション

--base <branch>：git.base を上書き（D8）

--branch <branch>：作業ブランチ上書き

--dry-run：planningまで（またはpreflightまで）で止める（任意）

--phase <name>：指定フェーズまでで停止（任意。v1では planning|implementing|testing 程度で良い）

--push-each-step：D11 runner.pushEachStep を一時上書き

--no-push：pushをしない（非推奨。v1ではdev用途限定で許可）

挙動

Preflight（D10）実施

planning/implementing/testing/... を実行

最終statusを確定し、要点を出力

statusに応じて終了コードを返す

標準出力（例）

人間向け（デフォルト）：

RUN started: id=001 request=...

PHASE planning

STEP S01 ... PASS commit=abc123

...

DONE pr_url=...

--json の場合：

json
{
"request_id": "20251214-login-timeout",
"run_id": "001",
"status": "done",
"pr_url": "https://github.com/.../compare/main...ai/20251214-login-timeout?expand=1",
"last_commit": "abc1234",
"paths": { "run_dir": "runs/..." }
}

終了コード

done → 0

needs_input → 2

failed → 3

4.3 aiflow doctor
目的

環境チェック（D7のDoctorと整合）。CLIだけで原因を切り分けできる。

使用例

aiflow doctor

aiflow doctor --json

チェック項目（必須）

git利用可、repo判定

origin存在、fetch可能

node/npm利用可（UI/サーバがNode想定の場合）

requestsDir/runsDir の作成可

port利用可（dev想定）

出力

人間向け：OK/NGと対処コマンド

JSON：D7のdoctorレスポンス形式と互換

終了コード

全OK：0

NGあり：1（ただし致命なら4でも可）

4.4 aiflow list
目的

Request一覧をCLIで簡易確認（UIの代替・補助）。

使用例

aiflow list

aiflow list --status queued,running

aiflow list --json

オプション

--status <csv>：フィルタ

--sort <key>：priority / updated（任意）

--limit <n>：表示件数（任意）

出力

人間向け：テーブル風（Markdownでも可）

JSON：{ "items": [RequestDTO...] }

終了コード

0（取得できたら成功）

4.5 aiflow logs <requestId>
目的

最新Runのログを追尾（tail -f的）。UIを開かない運用向け。

使用例

aiflow logs 20251214-login-timeout

aiflow logs 20251214-login-timeout --follow

オプション

--run <run_id>：指定Run

--follow：追尾（デフォルトONでも可）

--since <n>：末尾n行から（任意）

挙動

runs/.../runner.log を読んで表示

follow時、EOFから追尾

ログファイルがまだ無い場合は待機し、一定時間で諦める（任意）

5. dev と run の関係

dev：常駐キュー型（UI操作でenqueue→Runnerが拾う）

run：単発直実行（enqueueせずその場で処理して終了）

両者で同じRunner実装を使うが、起動形態が異なるだけとする。

6. 設定ファイル・環境変数との整合（D11）

すべてのCLIオプションはD11のキーにマップできること

--config 指定時は探索を行わず、そのファイルのみを使う

--root 指定時はそこを基準に設定探索を行う（重要）

7. 受け入れ基準（本Spec）

aiflow dev でUI/API/Runnerが起動できる

aiflow run <id> で最後まで走り、終了コードがstatusに対応する

aiflow doctor で典型障害を検出し、対処が分かる

aiflow list で優先度運用がCLIでも可能

aiflow logs でUIなしでも進捗監視できる

gh を一切使わずに compare URL の提示まで到達できる

次に作るべきドキュメントとしては、実装に直結する D13（パッケージング/配布仕様：devDependencies、起動方法、ディレクトリへの導入手順） が最優先です。

