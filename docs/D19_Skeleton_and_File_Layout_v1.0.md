D19. リポジトリ実装ガイド（Skeleton & File Layout）v1.0

対象：aiflow-local（ローカルDevin風：requests/*.md → 実行 → compare URL + レポート）
前提：ローカル完結／gh非依存／git依存可／トークン不要PRモード／長文実装はStep分割で反復

1. 目的

既存の開発リポジトリに npm install（devDependencies）だけで導入 できる最小実装を定義する

「UIから requests/*.md を作成・編集→Run→ブランチ作成→push→compare URL表示→Report追記」を一気通貫で成立させる

失敗を Doctor / Quality Gate で「実行前」か「早期」に止める

2. 推奨構成（v1：モノリポ内 “tools” 配下）

Laravel + MySQL の既存リポジトリに入れやすく、汚染しにくい配置。

pgsql
(repo root)
.aiflow/
config.v1.json
quality-gates.v1.json
messages.v1.ja.json
requests/
RQ-YYYYMMDD-001-*.md
runs/
<request-id>/<run-id>/
stage.json
quality_context.json
errors.json
report.md
logs/
doctor.json
runner.log
unit.log
e2e.log
tools/
aiflow/
package.json
tsconfig.json
src/
cli.ts
server/
index.ts
routes.ts
core/
runner.ts
planner.ts
git.ts
qg/
evaluator.ts
context.ts
rules.ts
doctor/
doctor.ts
checks.ts
report/
writer.ts
schema/
ajv.ts
validate.ts
ui/
(Vite + React)
schemas/
quality-context.v1.schema.json
quality-rules.v1.schema.json
prompts/
(任意：AI向けテンプレ。v1は最低限でOK)


重要：requests/ と .aiflow/ と runs/ は「運用のSSOT」。UIはそれを編集・表示するだけ、という思想で壊れにくくします。

3. root の package.json 方針（導入を簡単に）
3.1 既に package.json がある場合（推奨）

root に workspace を追加して、npm install で aiflow が入るようにする

jsonc
// package.json (root)
{
"private": true,
"workspaces": ["tools/aiflow"],
"devDependencies": {
// 既存があればそのまま
},
"scripts": {
"aiflow": "node tools/aiflow/dist/cli.js",
"aiflow:dev": "npm -w tools/aiflow run dev",
"aiflow:doctor": "npm -w tools/aiflow run doctor",
"aiflow:ui": "npm -w tools/aiflow run ui"
}
}

3.2 package.json が無い場合

最小の root package.json を追加しても運用上は安全（devDependenciesのみ）

4. tools/aiflow 側の依存（v1最小）
4.1 実装系

TypeScript実行：tsx（開発時）

ビルド：tsup（または esbuild）

JSON Schema検証：ajv

サーバ：express（または hono でも可）

UI：vite + react（最小）

4.2 git 実行

依存追加せず child_process で git を叩く（予測可能・軽い）

5. 実行インターフェース（UI/CLIの両対応）
5.1 CLI（運用の基盤）

npm run aiflow -- doctor

npm run aiflow -- run <request-id>

npm run aiflow -- logs <request-id> [--run <run-id>]

5.2 UI（ブラウザ操作）

npm run aiflow:ui

UIは以下のみ提供（v1）

requests/*.md の一覧（priorityソート）

エディタ（Markdown）

Run開始・進行状況（stage）

Report表示（reason_code / 対処＝D18-B辞書でレンダリング）

compare URL へのリンク

UIは「便利なフロント」であり、状態の真実は常に requests/ と runs/ に置く。

6. “トークン不要PRモード” の実装指針（v1）

GitHub PR作成（API/gh）を捨て、compare URL を出す。

ブランチ作成：ai/<request-id>

push：git push -u origin <branch>

compare URL：
https://github.com/<owner>/<repo>/compare/<base>...<branch>?expand=1

生成に必要なのは：

origin の URL（git remote get-url origin で取得）

base ブランチ名（.aiflow/config から）

branch 名（runnerが決める）

これで「PRが上がってくる体験」に近い導線は作れます（PR自体の作成はしない）。

7. aiflow の処理パイプライン（Runnerの最小責務）

Doctor（D18-A）実行 → FAILなら needs_input で停止

Request parse（D16テンプレ前提）→ AC数/回帰ACの有無などを抽出

Plan（AI or ルールベース）生成 → Step分割（“止まりやすい問題”をここで吸収）

Step反復（小さなdiffで繰り返す）

unit/e2e 実行（可能なら）

Quality Gate（D17-A）評価：done/needs_input/failed を確定

Report 生成：requests/<id>.md に追記 + runs/ に保存

push & compare URL（可能なら）→ Reportに追記

8. 設定ファイル（最小テンプレ）
8.1 .aiflow/config.v1.json
json
{
"version": "1.0",
"base_branch": "main",
"paths": {
"requests_dir": "requests",
"runs_dir": "runs"
},
"thresholds": {
"step_max_diff_lines": 300,
"step_max_files": 10,
"require_clean_worktree": true,
"require_e2e_for_regression_ac": true,
"require_unit_if_available": true
},
"retries": {
"plan_retries": 2,
"step_fix_retries": 2,
"unit_retries": 1,
"e2e_retries": 1
},
"commands": {
"unit": "vendor/bin/phpunit",
"e2e": "npm run test:e2e"
}
}

8.2 .aiflow/quality-gates.v1.json

D17-Aの形式（D17-Cでvalidateされる）

8.3 .aiflow/messages.v1.ja.json

D18-Bの辞書

9. スキーマの配置（v1固定）

tools/aiflow/schemas/quality-context.v1.schema.json（D17-B）

tools/aiflow/schemas/quality-rules.v1.schema.json（D17-C）

Runner/Doctorはここを参照し、.aiflow/ の設定ファイルを validate する。

10. MVPの作業順（実装が長くなる問題を潰すための分割）

v1を「必ず動く最小」で区切ります（Step化しやすい粒度）。

M1：Doctorだけ成立

aiflow doctor が PASS/WARN/FAIL と fix候補を出す

ルールスキーマ/メッセージ辞書のvalidateまで

M2：Request一覧と編集（UIは任意・CLIでも可）

requests/*.md の作成・編集・保存

priority順ソート

M3：Runの骨格（AIなしでもOK）

run-id作成、stage.json更新、report.md生成

gitブランチ作成→push→compare URL生成

M4：Quality Gate評価

D17-Aのルールセットで done/needs_input/failed を確定

D18-Bの辞書でUI表示

M5：Step分割の反復（AIありの本命）

“大きいと止まる” を plan の段階で強制的に小分け

1 step = 1 commit（推奨）

11. 受け入れ基準（D19）

npm install → npm run aiflow:ui でUIが起動する

requests/*.md を作って Run すると、runs/ に成果物が出る

compare URL が生成され、レポートに貼られる（originがある場合）

ルール/スキーマが壊れていれば doctor で即検知できる

Step肥大が発生しても plan段階で分割し、反復できる設計になっている

次に作るなら、D19をそのまま実装に落とし込むための D20. 実装タスク分割書（Work Breakdown / Step Plan） を作るのが最短です。こちらも作成しますか。

