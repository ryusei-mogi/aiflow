D29. ディレクトリレイアウト確定（repo内配置・npm scripts・devDependencies方針）v1.0

対象：既存開発ディレクトリ（既存Laravel/React等の構成は問わない）
目的：npm install だけで aiflow-local UI/Server/Runner をローカル起動できる構成を確定し、既存仕様を壊さない。
前提：ローカル完結／gh依存なし／git依存OK／追加は devDependencies 推奨。

1. ルート直下に追加するもの（v1）
1.1 ディレクトリ

tools/aiflow/：aiflow-local の実体（UI/Server/Runner/Adapters）

requests/：要望（Markdown）

runs/：実行成果物（生成物）

.aiflow/：設定・辞書・テンプレ（Git管理対象）

1.2 ルート直下に追加するファイル

.gitignore（追記）

runs/

tools/aiflow/.cache/（必要なら）

tools/aiflow/dist/（ビルド成果物を残すなら）

（任意）README_AIFLOW.md（v1は不要でも可）

2. tools/aiflow のレイアウト（v1固定）
swift
tools/aiflow/
package.json
tsconfig.json
vite.config.ts            (UI用)
src/
server/
index.ts              (Express起動)
routes.ts             (D21 endpoints)
runManager.ts         (D24)
fileStore.ts          (requests/runs I/O)
doctor.ts             (D21 /api/doctor)
runner/
runner.ts             (D22 state machine 実行本体)
planner.ts            (D27 planner 呼び出し)
implementer.ts        (D27 implementer 呼び出し)
qa.ts                 (D27 qa 呼び出し)
qualityGates.ts        (D17 gate評価)
adapters/
gitAdapter.ts         (D25)
llm/
codexCli.ts
claudeCli.ts
geminiCli.ts
shared/
types.ts              (RequestSummary/RunSummary/Stage等)
paths.ts              (repoRoot配下の安全なpath解決)
writeAtomic.ts
sanitize.ts
markdownMeta.ts       (priority/title抽出)
ui/
index.html
src/
main.tsx
App.tsx
pages/
RequestsPage.tsx
RequestDetailPage.tsx
RunDetailPage.tsx
DoctorPage.tsx
components/
...
prompts/                  (v1は .aiflow に置く方針なので空でもOK)
dist/                     (build出力、gitignore)


UIとServerを同一packageで持つ（Vite dev server + API server）は実装が難しくなりがちなので、v1は API serverをNodeで起動し、UIはViteで別ポート を推奨。

3. .aiflow のレイアウト（v1固定）
pgsql
.aiflow/
config.v1.json
quality-gates.v1.json
messages/
messages.v1.ja.json
prompts/
planner.v1.md
implementer.v1.md
qa.v1.md
schemas/
planner.contract.v1.json
implementer.contract.v1.json
qa.contract.v1.json

Git管理方針

.aiflow/**：Git管理する（チューニング資産）

requests/**：Git管理する（要望履歴）

runs/**：Git管理しない（生成物）

4. requests/ の命名規約（v1）

ファイル名：RQ-YYYYMMDD-###-slug.md

先頭にメタ（任意だが推奨）

priority: P0

status: draft|ready

titleは最初の # 行

5. runs/ の規約（v1）
pgsql
runs/<request-id>/<run-id>/
stage.json
planning.json
quality_context.json
report.md
errors.json        (needs_input/failed時のみ)
logs/
runner.log
step-0.log
unit.log
e2e.log

6. npm scripts（ルート側：最小追加）

既存のルート package.json を壊さないため、追加は prefix実行 を基本にする。

6.1 ルート package.json に追加（例）
json
{
"scripts": {
"aiflow:server": "npm --prefix tools/aiflow run server",
"aiflow:ui": "npm --prefix tools/aiflow run ui",
"aiflow:run": "npm --prefix tools/aiflow run run --"
}
}


aiflow:run -- <request-id> のように渡せる

既存scriptsに影響なし（キー追加のみ）

6.2 tools/aiflow/package.json（例）
json
{
"name": "@local/aiflow",
"private": true,
"type": "module",
"scripts": {
"server": "tsx src/server/index.ts",
"ui": "vite --config vite.config.ts",
"run": "tsx src/runner/runner.ts",
"test:aiflow": "vitest run",
"build": "vite build && tsc -p tsconfig.json",
"lint": "eslint ."
}
}

7. devDependencies 方針（v1）
7.1 ルートに入れない（推奨）

既存プロジェクトの依存が重くなるのを避けるため、aiflow依存は tools/aiflow/package.json に閉じ込める

7.2 tools/aiflow の推奨依存

Server：express（または hono でも可）

TS実行：tsx

UI：react, react-dom, vite

テスト：vitest

その他：zod（schema validationに便利）、marked（md preview任意）

ただし「トークン不要モード」は LLM呼び出しをしない/あるいは既存CLIをそのまま使う想定なので、Node側にSDK依存は不要。

8. ポート割当（v1）

API server：7331

UI（Vite）：7332

UIは VITE_API_BASE=http://localhost:7331 を env で参照。

9. “トークン不要モード” の解釈（v1で固定）

「OpenAI等のAPIキーをNodeが保持しない」

「サブスクで使えるCLI（codex/claude/gemini）をRunnerが呼ぶ」

よって .env にトークンを書く運用をaiflow側では要求しない
（ただし各CLI側のログイン/設定はユーザー環境に依存）

10. 受け入れ基準（D29）

既存repoで npm install（既存通り）＋ npm --prefix tools/aiflow install で起動できる

npm run aiflow:server と npm run aiflow:ui でUI/Serverが起動

requests/ を編集するとUIに反映される

runs/ がgitignoreされ、生成物が汚れない

gh 依存が一切ない（gitのみ）

次に作るべきは、実装に着手するAIが迷わないように D30. 実装タスク分割（Bootstrapの最初のrequestsテンプレ + planning例） を用意することです。

