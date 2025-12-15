D13. パッケージング／導入・配布仕様（Packaging & Local Distribution Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）
前提：D11（設定）／D12（CLI）／D6（UI）／D7（API）／D10（Runner）
制約：既存の開発ディレクトリで npm install したら使える／ローカルのみ／devDependencies推奨／gh 非依存／git 依存可

1. 目的

任意の既存リポジトリ（PHP/Laravel等）に 追加インストールするだけ で aiflow-local を利用可能にする

依存を最小化し、ローカル完結で動作する

実運用で「壊れにくい」導入手順・更新手順・トラブル時の切り戻し方針を定義する

2. 配布形態（v1推奨）

v1は以下のいずれでも成立するが、優先順位を定める。

2.1 推奨：npmパッケージ（devDependency）

パッケージ名例：@aiflow/local または aiflow-local

bin として aiflow を提供

UIアセット（ビルド済み）とAPI/Runnerを同梱

理由

npm install だけで導入でき、プロジェクト単位でバージョン固定できる

npx aiflow dev の形で即実行できる

更新・ロールバックが簡単（package-lockで固定）

2.2 代替：リポジトリ内サブディレクトリ運用（vendor的）

tools/aiflow-local/ にソースを配置し、npm --prefix tools/aiflow-local i

ただし「既存ディレクトリでnpm installだけ」の要件から外れるため v1では非推奨

3. プロジェクトへの導入（導入手順）
3.1 追加インストール

例（想定）：

npm i -D aiflow-local

3.2 package.json scripts（推奨）

導入後、利用しやすいように scripts を追加する。

json
{
"scripts": {
"aiflow": "aiflow",
"aiflow:dev": "aiflow dev --open",
"aiflow:doctor": "aiflow doctor"
}
}


これにより npm run aiflow:dev で起動できる。

3.3 初期ディレクトリ生成（自動）

初回 aiflow dev または aiflow doctor 実行時に以下が無ければ作成してよい（D11）。

requests/

runs/

.aiflow/locks

.aiflow/tmp

3.4 初期設定ファイル（任意）

必要なら .aiflowrc.json をプロジェクト直下に追加（D11）。
なくてもデフォルトで起動できることが要件。

4. Node側の依存関係（devDependencies推奨）
4.1 必須依存（カテゴリ）

CLIフレームワーク（例：commander/yargs）

HTTPサーバ（例：express/fastify）

WebSocket（例：ws）

ファイル監視（例：chokidar）

プロセス実行（例：execa）

Markdown処理（例：remark/marked）

スキーマ検証（例：zod/ajv）

ログ（例：pino）

実装選定は任意。ここでは「カテゴリ」と「要件」を固定する。

4.2 依存を “dependencies” にしない理由

aiflow-local は プロジェクトのビルド成果物に不要

プロダクションデプロイに同梱させないため、devDependenciesに置く

4.3 Nodeバージョン要件

engines.node を宣言（例：>=18 推奨、可能なら >=20）

互換性を保つため、LTSを基準にする

5. バンドル構成（配布物の中身）

npmパッケージは以下を含む。

5.1 CLI

bin/aiflow（エントリ）

dist/cli.js（ビルド済み）

5.2 サーバ（UI + API）

dist/server.js

dist/api/*

dist/runner/*

5.3 UIアセット

v1は「導入の簡単さ」を優先し、ビルド済みUIを同梱する。

dist/ui/index.html

dist/ui/assets/*

開発中だけホットリロードしたい場合は AIFLOW_UI_DEV=1 等のフラグで切替（任意、v1では不要でも可）

6. 実行モデル（ローカル常駐）
6.1 aiflow dev

1プロセスでUI静的配信＋API＋Runnerキューを起動（D12）

プロセス終了で全停止

6.2 aiflow run <id>

単発実行（D12）

UIなしで完結（ログはrunsへ）

7. リポジトリ汚染を防ぐ運用（.gitignore）

ツールが生成するファイルを、どこまでGit管理するかを定義する。

7.1 原則（推奨）

requests/*.md：Git管理する（要望とレポートの履歴）

.aiflow/：Git管理しない

runs/：基本Git管理しない（ログ肥大化のため）

7.2 推奨 .gitignore 追記
.aiflow/
runs/


ただし「runsを残して監査したい」方針なら、runs/ を除外しない運用も許容。

8. アンインストール／切り戻し
8.1 アンインストール

npm remove aiflow-local

8.2 残存物の扱い

requests/ は残す（資産）

.aiflow/ と runs/ は削除してもよい（ログ・ロックのみ）

9. 更新ポリシー（SemVer）

MAJOR：D3/D7/D10 の破壊的変更（ファイル形式・API契約・Runnerフェーズ）

MINOR：新機能追加（互換維持）

PATCH：バグ修正

9.1 ロックファイル運用

package-lock.json（または pnpm-lock/yarn.lock）により、実行環境差を減らす

10. セキュリティ／安全

ローカルのみでListen（デフォルト 127.0.0.1）（D11）

0.0.0.0 公開はv1非推奨（設定で変更可能でも警告を出す）

外部へのデータ送信や収集はしない（ツールはプロジェクト内で完結）

11. 受け入れ基準（本Spec）

任意の既存リポジトリで npm i -D aiflow-local だけで導入できる

npx aiflow dev または npm run aiflow:dev で起動できる

初回起動で必要ディレクトリが自動生成される（requests/runs/.aiflow）

requests/*.md を作る→UIに表示→Runできる（最低限のE2E）

.gitignore 追記方針が明確で、リポジトリを汚しにくい

アンインストールしても requests が資産として残る

12. 参考：最小導入チェックリスト

npm i -D aiflow-local

package.json に aiflow:dev を追加

.gitignore に .aiflow/ と runs/ を追加

npm run aiflow:dev でUIが開く

CreateでRequest作成 → Run → done → compare URL が出る

次に、仕様ドキュメントとして「実装と運用を結びつける」なら、D14（ディレクトリ/ファイル仕様の最終版：D3＋runs構造＋命名規則）、または D15（トラブルシュート集：代表エラーと復旧） が有効です。

