D20. 実装タスク分割書（Work Breakdown / Step Plan）v1.0

対象：aiflow-local（ローカルDevin風：requests → run → compare URL + report）
前提：D19（Skeleton）／D17（品質ゲート）／D18（Runbook/Doctor/辞書）
目的：実装が長くなって途中で止まる問題を避けるため、最初から“止まらない粒度”に分割し、反復で完成させる。

0. 実装原則（最重要）

1 Step = 1 Commit（レビューしやすい）

1 Step の変更量は小さく（目安：diff 300行以内、ファイル10以内）

先に「壊れない枠」（スキーマ／doctor／run成果物の雛形）を作ってから、AI・UIなどの可変要素を載せる

途中で止まっても「その時点で価値がある状態」を積み上げる（縦切り）

1. マイルストーン（M1〜M5）

M1 Doctorが成立（環境とルール崩壊を先に潰す）

M2 Request運用（テンプレ＋一覧）

M3 Run骨格（runs/成果物・git branch/push・compare URL）

M4 Quality Gate評価（done/needs_input/failed）＋辞書表示

M5 Step反復（大規模変更を自動で小分けにして回す）

2. Step Plan（コミット単位）

以下は “最初から分割済み” の実装手順です。上から順に進めれば、途中で止まっても回せる状態が残ります。

S01: パッケージ雛形（tools/aiflow）作成

目的：npm install 後にCLIが起動できる骨組み
作業

tools/aiflow/package.json（name, bin, scripts）

tsconfig.json

src/cli.ts（doctor, run, ui のコマンドだけ受け付けて未実装はエラー）

ビルド（tsup等）と dist/cli.js 出力
AC

npm -w tools/aiflow run build が成功

node tools/aiflow/dist/cli.js --help が動く

S02: ルート統合（workspace / scripts）

目的：既存リポジトリで npm install しただけで使える
作業

root package.json に workspace と scripts 追加（既存があれば最小差分）
AC

rootで npm run aiflow -- --help が動く

S03: ディレクトリ契約（.aiflow / requests / runs の自動生成）

目的：運用のSSOTを固定し、事故らない土台を作る
作業

src/core/fs.ts（mkdirp、存在チェック）

aiflow doctor で requests/ と runs/ と .aiflow/ が無ければ作成（空でもOK）
AC

何も無い状態でも aiflow doctor が runs/requests を作る

S04: スキーマ導入（D17-B/D17-C）

目的：以降の検証をAJVで統一
作業

schemas/quality-context.v1.schema.json（D17-B）

schemas/quality-rules.v1.schema.json（D17-C）

src/core/schema/ajv.ts & validate.ts（validate helper）
AC

AJVでスキーマ読み込み・validateが動作（ユニットで1本）

S05: メッセージ辞書（D18-B）導入

目的：reason_code表示を統一
作業

.aiflow/messages.v1.ja.json をデフォルト生成（無ければコピー）

src/core/messages.ts（ロード、fallback）
AC

aiflow doctor --format json に messages_loaded:true が出る

S06: ルールセット雛形（D17-A）導入＋スキーマvalidate

目的：QG（Quality Gate）を壊れにくくする
作業

.aiflow/quality-gates.v1.json デフォルト生成

doctorで D17-C による validate
AC

ルールファイルを壊すと doctor が FAIL で止める

S07: Doctor v1（Environment/Repo/Configの最小）

目的：実行不能を事前に止める
作業

src/core/doctor/doctor.ts + checks.ts

チェック（最低限）

git repo判定

worktree clean（設定に従う）

origin有無（WARN）

base branch存在（WARN）

--format text/json
AC

FAIL/WARN/PASS が出る

dirty のとき WORKTREE_DIRTY が出る

S08: Config導入（.aiflow/config.v1.json）

目的：base/thresholds/retries/commands を一元管理
作業

.aiflow/config.v1.json デフォルト生成

読み込みと必須キーvalidate（軽い検証でOK）
AC

config壊すと doctor FAIL

S09: Requestパーサ（D16テンプレ最小対応）

目的：Requestから必要情報（priority/AC数/回帰AC等）を抽出
作業

src/core/request/parse.ts

priority（P0〜P3）

ACチェックボックス数

回帰AC判定（文言 or タグでOK。v1は簡易で）
AC

サンプルmdから acceptance_criteria.count と has_regression_ac が取れる

S10: Run成果物の骨格（runs/<id>/<run-id>）

目的：まず「回る」ことを作る（AIなしでもOK）
作業

run-id 生成（timestamp+rand）

stage.json（状態遷移は簡易でOK）

quality_context.json（D17-Bを満たす最小形で生成）

report.md 生成（あとでrequestsに貼る）
AC

aiflow run <id> で runs配下に4ファイルが出る

S11: gitブランチ作成 → push → compare URL 生成（トークン不要PR）

目的：「PRが上がってくる体験」を compare URL で代替
作業

src/core/git.ts（branch作成、push、remote URL取得）

compare URL 生成（GitHubのみ対応でOK）
AC

originがある場合、reportに compare URL が出る

originなしは needs_input（REMOTE_ORIGIN_MISSING）になる

S12: Quality Gate Engine v1（D17-A evaluator）

目的：done/needs_input/failed を自動決定
作業

src/core/qg/evaluator.ts

D17-CのASTを評価して boolean を返す

first-match（priority昇順）で decision を採用
AC

サンプルContextで意図通りの判定が出る（ユニット2〜3本）

S13: errors.json / reason_code / 修復コマンドの標準化

目的：UI/Runbook連携の中核
作業

errors.json（reason_code, severity, status, actions, message）

D18-B辞書により report 表示を整形
AC

needs_input のとき、辞書のtitle/summary/user_action がreportに出る

S14: requests/<id>.md への Report追記（運用SSOT）

目的：あなたが「requestsを見るだけ」で状況把握できる
作業

requests/<id>.md に ## Report セクションを追記/更新

既存の人間追記（Human Follow-up）を壊さない（append方針）
AC

再Runしても、人間が書いたFollow-upが消えない

S15: UI v1（一覧＋編集＋Run＋結果表示）

目的：ブラウザで “素敵体験” の最小を成立させる
作業

Vite+React（最小）

API：Express

GET /api/requests

GET/PUT /api/requests/:id

POST /api/run/:id

GET /api/runs/:id/latest

結果表示：D18-B辞書でレンダリング
AC

UIで編集→Run→compare URL→report確認ができる

S16: Step分割（Plan）v1（AIに考えさせる前提の土台）

目的：長文実装で止まる問題の根治
作業

planを必ず steps に分割して stageに載せる

v1はルールベースでOK（例：UI/API/DB/TESTで分ける）
AC

どんなRequestでも steps_count >= 2 を作れる

S17: Step反復Runner（1 stepずつ実行・収束管理）

目的：途中停止を前提に、反復で進める
作業

stepごとに

“作業→テスト→評価→次step” を回す枠

失敗時は step_fix_retries まで再試行
AC

step単位のstage遷移が保存される

retry超過で RETRY_EXCEEDED になる

S18: unit/e2e 実行（ローカル統制）

目的：回帰担保の自動化（可能な範囲）
作業

configの commands.unit / commands.e2e を実行してログ保存

checks.unit/e2e をContextに反映
AC

unit/e2eが通ると done 判定に寄与する

コマンド未存在は COMMAND_NOT_FOUND

S19: Doctor拡張（D18-Aの論理検証を実装）

目的：運用事故（path typo, done不在, priority重複）を実行前に潰す
作業

ルールのpriority重複検出

when内path抽出→Contextスキーマと照合

危険コマンド検知（WARN、strictでFAIL）
AC

typoしたpathで doctor WARN/FAIL が出る

S20: 仕上げ（サンプル・ドキュメント・初期セット）

目的：導入後すぐ使える
作業

requests/_template.md 配置

docs/ に D17/D18/D19/D20 を収録（任意）

npm run aiflow:doctor npm run aiflow:ui の手順追記
AC

クローン直後にテンプレからRunまで到達できる

3. 完了定義（v1 “使える” の条件）

UIで requests を作ってRunできる

done/needs_input/failed が出て、次アクションが分かる（辞書・doctor含む）

originがある場合 compare URL が出る（PR作成はしない）

Step分割により「長くて止まる」問題が運用上致命傷にならない

4. 優先順位（あなた向け：最短で体験を作る順）

まず体験：S01→S02→S06→S07→S09→S10→S11→S12→S14→S15

その後に品質：S18→S19

最後に本命：S16→S17（Step反復の高度化）

必要なら、このD20をそのまま requests/RQ-...-build-aiflow-local.md の 最初のRequest（自分自身を作る自己ホストタスク） に落として、aiflow-localで aiflow-local を作らせる形にもできます。

