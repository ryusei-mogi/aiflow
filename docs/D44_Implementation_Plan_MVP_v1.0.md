D44. 実装計画（MVPスコープ／ディレクトリ構成／最初に動かす縦串）v1.0

対象：aiflow-local（ローカル完結、npm installで起動、ブラウザUIあり、requests/*.md運用）
目的：最短で「requestを書いたらRunできて、reportが出て、次に回せる」縦串を通す。
前提：devDependencies推奨／gh禁止／git依存OK／サブスクCLI（Codex/Gemini）前提／トークン不要モード。

1. MVPスコープ（v1.0の最小）
1.1 必須（出荷に必要）

Requests管理

requests/*.md の一覧表示（priority/status/title）

requestの編集（本文編集＋meta編集：D36）

Next Request の計算（D35）

Run実行（縦串）

POST run で runディレクトリ生成

Planner → planning.json 生成（D42）

Implementer（Step1だけでも可）→ patch生成

git apply/check（D40）

unitテスト実行（D41）

report.md 生成（D37）

stage.json 更新（D34）

ロック（D39）

queue/request排他

Router設定読み込み（D43）

doctor（簡易）

codex/gemini/git/node の存在チェック

worktree clean チェック

1.2 v1では後回し（v1.1以降）

Auto-run queue（ON/OFFで連続実行）

Reviewer/QAロール（計画監査やログ要約）

Stepのresume/retry UI（まずは “最初から再Run” で良い）

E2E artifactsのコピー表示

画面デザイン提案（designer）

2. ディレクトリ構成（推奨）

既存の開発ディレクトリ配下で完結する（npm installで使える）。

markdown
repo-root/
requests/
RQ-....md

.aiflow/
config.v1.json
router.v1.json
locks/                (gitignore推奨)
cache/                (任意)
runs/                   (gitignore必須)
<request-id>/
<run-id>/
stage.json
planning.json
patches/
logs/
report.md
artifacts/         (任意)

tools/aiflow/            (devDependenciesで入る想定)
src/
package.json


※ runs/ と .aiflow/locks/ は .gitignore に入れる（D12/D39/D40）。

3. 技術スタック（実装選択はAIに任せる前提での最小要件）

Node（devDependencies）

ローカルサーバ（HTTP）

ブラウザUI（SPAで良い）

CLI呼び出し（child_process）

ファイル操作（fs）

JSONスキーマ検証（任意だが推奨）

4. 縦串（最初に動かすHappy Path）
4.1 シナリオ

requests/RQ-001.md を用意（priority/statusあり）

UIで一覧に表示される

UIで「Run」クリック

runs/RQ-001/RUN-.../ ができる

planning.json が生成される

Step S01 の patch が生成され、git applyされる

php artisan test が走る

report.md が生成され、UIで閲覧できる

request.status が running→ready（DONE時）または running→blocked（失敗時）

5. 実装順（タスク分解）
Phase 0：土台（1PR目）

.aiflow/config.v1.json / router.v1.json 読み込み

doctor（簡易）：bin存在＋git cleanチェック

requestsパーサ（D36）

runsディレクトリ作成＋run-id生成（D38）

成果：GET /api/requests が返せる

Phase 1：UI最小（2PR目）

Requests一覧

Request編集（本文＋meta更新）

Next Requestの表示（D35）

成果：ブラウザで requests 管理ができる

Phase 2：Runの最小縦串（3PR目）

ロック（D39：request lockだけでも可）

Routerで Planner 呼び出し（D43）

Planner JSON出力を planning.json に保存（D42）

stage.json 管理（D34最小：INIT→PLANNING→DONE/NEEDS_INPUT）

成果：planまで回る

Phase 3：実装～unitテストまで（4PR目）

Implementer呼び出し（D42）

patch apply/check（D40）

unitテスト実行＋ログ保存（D41）

report.md 生成（D37）

status整合（D38：ready/running/blocked）

成果：あなたが求める「見なくても回る」基盤が成立

Phase 4：キュー自動化（v1.1）

Queue Lock（D39）

Auto-run ON/OFF（D35）

DONE時 ready戻し＋ “Mark as done” 導線（D38）

QAロール（gemini）で要点化（D42/D43）

6. MVPのガードレール（最初から入れる）

ghコマンド検知（ログ/出力に gh が出たらFAIL）

worktree dirty なら開始しない

main直変更禁止（作業ブランチ強制：D40）

Step差分上限（max_diff_lines）超過はreplan誘導（D42/D34）

7. 受け入れ基準（D44）

npm install（devDependencies）→ npm run dev でUIが起動

requestsの編集とRun起動がブラウザからできる

run成果物（stage/planning/patch/log/report）が runs 配下に揃う

unitテスト失敗時は blocked に落ち、次アクションがreportに書かれる

並列起動しても二重実行しない（ロック）

次は、MVPの “API一覧と画面一覧” を確定する D45. UI/APIインタフェース仕様（エンドポイント・画面コンポーネント・最小データ構造） を作ると、そのまま実装に入れます。

