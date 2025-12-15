D50. MVP実装バックログ（最小のrequestsセット）v1.0

対象：aiflow-local v1.0 を “最短で使える状態” にするための最小requests群
目的：D44（実装計画）を「実際の request（=開発単位）」に落とし込み、あなたがそのまま requests/*.md に起こせる状態にする。
前提：ローカル完結／npm installで動く／ブラウザUI／gh禁止／git依存OK／no_tokenモード。

1. 進め方（このバックログの使い方）

下記の RQ を 上から順 に作って status: ready にする

1RQ = 1PR（粒度）

途中で “大きい/詰まりそう” なら、Plannerが自動分割してもOK（ただし max_diff_lines 運用）

2. MVP最小requests（P0/P1）
RQ-001（P0）aiflowサンドボックス（起動と最小HTTP）

目的：npm install→dev起動→/api/doctor が返る土台

AC例（最低3つ）

Doctorが node/git をPASS判定できる

ローカルHTTPサーバが起動し、UIにアクセスできる

runs/ と locks/ を gitignore に入れる

RQ-002（P0）requestsパーサ＆一覧API

目的：requests/*.md を読み、/api/requests で一覧取得

AC例

requestsのmeta（priority/status/title）がパースできる

/api/requests が items を返す

形式不正は REQUEST_INVALID_FORMAT でエラーになる

RQ-003（P0）Requests画面（一覧）

目的：ブラウザで一覧が見える

AC例

Requests画面で一覧が表示される

status/priority フィルタが動く

Openで詳細へ遷移できる

RQ-004（P0）Request詳細（本文編集＋meta編集）

目的：requestをUIから更新可能にする（D45）

AC例

本文を編集して保存できる

meta（priority/status/labels）が更新できる

保存後に再読み込みしても壊れていない（D36）

RQ-005（P0）Run基盤（runs生成＋stage.json）

目的：Run開始で runディレクトリ生成＆状態管理ができる

AC例

POST /api/requests/:id/run で run_id が払い出される

runs/<request>/<run>/stage.json が作られる

二重起動は RUN_IN_PROGRESS で防げる（ロック）

RQ-006（P0）Router（codex/gemini）呼び出し基盤

目的：D43に沿ってCLIを呼び分け、rawログを残す

AC例

Routerがprimary/fallbackを切替できる

CLI出力が runs/.../logs に保存される

CLI未導入は CLI_NOT_AVAILABLE で止まる

RQ-007（P0）Planner実装（request→planning.json）

目的：D42 Planner契約で計画生成できる

AC例

planning.json が生成される

stepsが max_diff_lines 前提で分割されている

JSON崩壊は JSON_PARSE_ERROR で止まる（fallback含む）

RQ-008（P0）Implementer（Step1のみ）→ patch生成

目的：S01のdiffを生成し保存できる

AC例

ImplementerのJSONから diff を取り出して patch化できる

max_diff_lines超過は STEP_TOO_LARGE で止まる

touched_paths が report に載る（後でOK）

RQ-009（P0）git apply/check（安全運用）

目的：patch適用まで自動化（safe mode）

AC例

git apply --check を通してから適用する

失敗時は PATCH_APPLY_FAILED で止まる

mainではなく作業ブランチに変更が入る（D40）

RQ-010（P0）Unitテスト実行＋ログ保存

目的：php artisan test を回し結果をログ化（D41）

AC例

unitコマンドが実行され、ログがruns配下に残る

失敗時は UNIT_TEST_FAILED で止まる

timeoutは TEST_TIMEOUT で止まる

RQ-011（P0）report.md 生成（最小）

目的：あなたが見なくても状況が分かる report を出す（D37）

AC例

report.md が生成される

ACチェック欄が含まれる

“次にやること（actions）” が書かれる

RQ-012（P1）Run詳細画面（stage/log/report閲覧）

目的：UIでRunの中身（report/log）を見られる（D45）

AC例

Run Detail で stage.state が見える

report.md が画面に表示される

logs一覧が表示される

RQ-013（P1）Next Request（D35）表示

目的：次にやるrequestを自動選定して表示

AC例

/api/queue/next が返る

depends_on/blocked を考慮できる

UIでNextが表示される

3. v1.1（任意）拡張requests

RQ-101：Reviewer追加（plan監査）

RQ-102：QA追加（diff＋ログ要約）

RQ-103：E2E（Playwright等）連携＋artifacts表示

RQ-104：Auto-run（queue連続処理）

RQ-105：Resume/Retry UI（blocked復帰導線）

4. このバックログのDoD（D49整合）

RQ-001〜011 がDONEになったら 縦串が成立

RQ-012〜013 がDONEになったら 日次運用が回る

5. 受け入れ基準（D50）

あなたがこのまま requests/*.md に落とせる粒度

P0だけで「request→run→report」まで到達できる

gh不要／ローカル完結／no_token運用が保てる

次は、上の RQ-001〜013 を “実際のファイル（requests/*.md）” として一括生成する D51. 初期requests生成パック を作ると、すぐ実装に入れます。

