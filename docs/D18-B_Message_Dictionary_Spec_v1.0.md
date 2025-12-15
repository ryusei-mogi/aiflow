D18-B. メッセージ辞書仕様（Reason Code → UI表示文・対処）v1.0

対象：aiflow-local（UI / Runner / Doctor）
前提：D17-A（品質ゲート）／D18-A（Doctor）
目的：reason_code（= error_code）を UI表示・対処ガイド・次アクション に一貫して変換する。運用時の迷いをゼロにする。

1. スコープ

Quality Gates（Run結果）の errors.json.reason_code

Doctor（診断結果）の checks[].id および error_code

UIのバッジ／トースト／詳細パネル／コピー用の復旧コマンド表示

2. データ形式（messages.v1.json）
2.1 ルート構造
json
{
"version": "1.0",
"locale": "ja-JP",
"messages": {
"WORKTREE_DIRTY": { /* MessageDef */ },
"E2E_TEST_FAILED": { /* MessageDef */ }
}
}

2.2 MessageDef
json
{
"title": "短い見出し",
"summary": "1行の要約",
"detail": "状況説明（必要なら複数行）",
"user_action": [
"あなたがやること（1）",
"あなたがやること（2）"
],
"ai_action": [
"AIにやらせる方針（例：Step分割して再計画）"
],
"commands": [
{ "label": "確認", "cmd": "git status --porcelain" }
],
"links": [
{ "label": "Runbook", "ref": "D18#5.2" }
],
"severity_hint": "Blocker|Major|Minor",
"status_hint": "needs_input|failed|done"
}


補足

commands は 表示のみ（自動実行しない）

links.ref はドキュメント内アンカー相当（実装は自由）

3. UI表示ルール（標準）

画面上部：title + status_hint バッジ

直下：summary

展開時：detail、user_action、commands を表示

failed の場合：ai_action は “次にどう縮小して再実行するか” を優先表示

4. 標準メッセージ辞書（v1 初期セット）

実ファイル例：.aiflow/messages.v1.ja.json

json
{
"version": "1.0",
"locale": "ja-JP",
"messages": {
"OK": {
"title": "品質ゲート合格",
"summary": "必要なチェックがすべて通過しました。",
"detail": "この後は人間（あなた）がブラウザで総合テストを実施し、要件マッチを最終確認してください。",
"user_action": [
"Reportの Human Test Checklist を実施する",
"問題なければ取り込む（merge相当）"
],
"ai_action": [],
"commands": [],
"links": [{ "label": "Runbook", "ref": "D18#5.1" }],
"severity_hint": "Minor",
"status_hint": "done"
},

"AMBIGUOUS_REQUIREMENT": {
"title": "要件が不足しています",
"summary": "受け入れ条件（AC）が足りない、または判断が必要です。",
"detail": "ACは最低3つ（回帰含む推奨）。A案/B案の選択、既存仕様を壊さない条件の具体化などが必要です。",
"user_action": [
"requests/<id>.md に AC を追記（最低3つ）",
"判断が必要な点（A案/B案など）を Human Follow-up に明記する"
],
"ai_action": [
"ACとStep分割を再生成して再計画する"
],
"commands": [
{ "label": "Requestを開く", "cmd": "open requests/<id>.md" }
],
"links": [{ "label": "Runbook", "ref": "D18#5.2-A" }],
"severity_hint": "Major",
"status_hint": "needs_input"
},

"WORKTREE_DIRTY": {
"title": "作業ツリーが汚れています",
"summary": "未コミット変更があるため安全に実行できません。",
"detail": "意図しないファイルまで巻き込むリスクがあるため、クリーンな状態にしてから再実行してください。",
"user_action": [
"git status で差分確認",
"stash または commit してクリーンにする"
],
"ai_action": [],
"commands": [
{ "label": "状態確認", "cmd": "git status --porcelain" },
{ "label": "一時退避", "cmd": "git stash -u" }
],
"links": [{ "label": "Runbook", "ref": "D18#5.2-B" }],
"severity_hint": "Blocker",
"status_hint": "needs_input"
},

"NOT_A_GIT_REPO": {
"title": "Gitリポジトリではありません",
"summary": "git前提のため、このディレクトリでは実行できません。",
"detail": "aiflow-local は git diff / ブランチ運用を前提にしています。リポジトリ直下で実行してください。",
"user_action": [
"正しいリポジトリディレクトリに移動して再実行する"
],
"ai_action": [],
"commands": [
{ "label": "git判定", "cmd": "git rev-parse --is-inside-work-tree" }
],
"links": [{ "label": "Runbook", "ref": "D18#6" }],
"severity_hint": "Blocker",
"status_hint": "failed"
},

"REMOTE_ORIGIN_MISSING": {
"title": "origin が未設定です",
"summary": "compare URL 生成や push ができない可能性があります。",
"detail": "トークン不要PRモードでも、origin がないと compare URL を提示できません。",
"user_action": [
"git remote -v を確認し、必要なら origin を設定する"
],
"ai_action": [],
"commands": [
{ "label": "remote確認", "cmd": "git remote -v" }
],
"links": [{ "label": "Runbook", "ref": "D18#5.2-B" }],
"severity_hint": "Major",
"status_hint": "needs_input"
},

"BASE_BRANCH_NOT_FOUND": {
"title": "baseブランチが見つかりません",
"summary": "設定された base が存在しないか、fetch が不足しています。",
"detail": "base ブランチが存在しないと diff/compare の基準が不正になります。",
"user_action": [
"git fetch origin を実行する",
"base 名（main/master等）を確認する"
],
"ai_action": [],
"commands": [
{ "label": "fetch", "cmd": "git fetch origin" },
{ "label": "ブランチ一覧", "cmd": "git branch -a" }
],
"links": [{ "label": "Runbook", "ref": "D18#5.2-B" }],
"severity_hint": "Major",
"status_hint": "needs_input"
},

"STEP_TOO_LARGE": {
"title": "Step が大きすぎます",
"summary": "変更規模が大きく、途中で止まりやすい状態です。",
"detail": "計画段階で細分化し、1 Step を小さくして反復する必要があります（あなたが考えたくない部分はAIに任せる前提）。",
"user_action": [
"Human Follow-up に『Stepを3〜5に分割』と追記して再実行する"
],
"ai_action": [
"Stepを再設計（先に足場→テスト→小改修）して反復実行する"
],
"commands": [
{ "label": "再計画", "cmd": "aiflow run <id> --phase planning" }
],
"links": [{ "label": "Runbook", "ref": "D18#5.2-D" }],
"severity_hint": "Major",
"status_hint": "needs_input"
},

"UNIT_TEST_FAILED": {
"title": "単体テストが失敗しました",
"summary": "Unit（phpunit等）が通っていません。",
"detail": "v1運用では Unit 失敗は blocker として扱います。修正が収束しない場合は Request/Step の分割を優先してください。",
"user_action": [
"Reportの失敗箇所を確認する",
"収束しない場合はスコープを小さくして再実行する"
],
"ai_action": [
"失敗テストの原因に絞って修正→再実行する"
],
"commands": [
{ "label": "phpunit再実行", "cmd": "vendor/bin/phpunit" }
],
"links": [{ "label": "Runbook", "ref": "D18#5.3" }],
"severity_hint": "Blocker",
"status_hint": "failed"
},

"E2E_TEST_FAILED": {
"title": "E2E が必要ですが通っていません",
"summary": "回帰ACがあるため E2E が必須です。",
"detail": "E2Eが走らない／不安定な場合は needs_input とし、手動担保の例外運用は Human Follow-up に理由と手順を残してください。",
"user_action": [
"E2Eを修正・追加して再実行する（推奨）",
"例外にする場合：手動担保の理由と手順をHuman Follow-upに明記する"
],
"ai_action": [
"回帰フローに絞った最小E2Eを作成し、安定化する"
],
"commands": [
{ "label": "E2E再実行", "cmd": "npm run test:e2e" }
],
"links": [{ "label": "Runbook", "ref": "D18#5.2-C" }],
"severity_hint": "Blocker",
"status_hint": "needs_input"
},

"NEEDS_HUMAN_E2E": {
"title": "人間の総合テストが必要です",
"summary": "自動化では確認できない領域があります。",
"detail": "UI/文言/導線などの最終判断は人間のブラウザ確認が必要です（あなたの総合テストが最終ゲート）。",
"user_action": [
"Reportの手順に従い、ブラウザで総合テストを実施する",
"問題があれば Human Follow-up で差し戻す"
],
"ai_action": [],
"commands": [],
"links": [{ "label": "Runbook", "ref": "D18#8" }],
"severity_hint": "Major",
"status_hint": "needs_input"
},

"PUSH_FAILED": {
"title": "push / compare URL の生成に失敗しました",
"summary": "ブランチのpushに失敗した可能性があります。",
"detail": "トークン不要PRモードでも、compare URL提示には push が必要です。origin/認証/ブランチ名を確認してください。",
"user_action": [
"git push を手動で試す",
"origin と認証状態を確認する"
],
"ai_action": [],
"commands": [
{ "label": "push", "cmd": "git push -u origin <branch>" },
{ "label": "remote確認", "cmd": "git remote -v" }
],
"links": [{ "label": "Runbook", "ref": "D18#4.5" }],
"severity_hint": "Major",
"status_hint": "needs_input"
},

"REPORT_MISSING": {
"title": "レポート出力に失敗しました",
"summary": "ツール側の不具合の可能性があります。",
"detail": "Report は運用の要です。生成できない場合は failed 扱いとし、ログ確認→再実行→再現するならバグとして切り出してください。",
"user_action": [
"runs配下のログを確認する",
"再実行して再現するか確認する"
],
"ai_action": [],
"commands": [
{ "label": "ログを開く", "cmd": "aiflow logs <id>" }
],
"links": [{ "label": "Runbook", "ref": "D18#5.3" }],
"severity_hint": "Major",
"status_hint": "failed"
},

"RETRY_EXCEEDED": {
"title": "リトライ上限に達しました",
"summary": "自動修正が収束しませんでした。",
"detail": "最短の復旧は『直す』より『分割』です。Request分割またはStep分割を優先してください。",
"user_action": [
"失敗原因（unit/e2e/環境）をReportで把握する",
"Requestを小さく分割する、または Step分割を指示して再実行する"
],
"ai_action": [
"スコープを縮小し、最小差分で通るところまで反復する"
],
"commands": [
{ "label": "ログを開く", "cmd": "aiflow logs <id>" },
{ "label": "再計画", "cmd": "aiflow run <id> --phase planning" }
],
"links": [{ "label": "Runbook", "ref": "D18#5.3-A" }],
"severity_hint": "Blocker",
"status_hint": "failed"
},

"PLAN_INVALID": {
"title": "Planが不正です",
"summary": "Planの構造が壊れているか、検証に失敗しました。",
"detail": "ツール側の出力崩壊、またはスキーマ不一致の可能性があります。doctor→再計画で復旧します。",
"user_action": [
"doctor を実行する",
"planningのみ再実行する"
],
"ai_action": [],
"commands": [
{ "label": "doctor", "cmd": "aiflow doctor" },
{ "label": "planning再実行", "cmd": "aiflow run <id> --phase planning" }
],
"links": [{ "label": "Doctor", "ref": "D18-A" }],
"severity_hint": "Blocker",
"status_hint": "failed"
},

"COMMAND_NOT_FOUND": {
"title": "必要なコマンドが見つかりません",
"summary": "phpunit/npm 等の実行コマンドが存在しません。",
"detail": "依存導入不足（composer install / npm install）や PATH の問題が考えられます。",
"user_action": [
"依存を導入する（composer install / npm install）",
"実行コマンド名が設定と一致しているか確認する"
],
"ai_action": [],
"commands": [
{ "label": "composer install", "cmd": "composer install" },
{ "label": "npm install", "cmd": "npm install" }
],
"links": [{ "label": "Runbook", "ref": "D18#5.2-B" }],
"severity_hint": "Major",
"status_hint": "needs_input"
}
}
}

5. 受け入れ基準（本Spec）

UIが reason_code だけで「状況」「次アクション」「コマンド候補」を一貫表示できる

needs_input/failed/done のユーザー体験がブレない

例外運用（E2E後回し等）を必ず Human Follow-up に残す導線がある

辞書は devDependencies で同梱し、ローカルのみで完結する

次に進めるなら、ここまでのD17/D18系を 実装に直結する最小ファイル構成（schemas/, .aiflow/, src/doctor/, src/qg/ 等）に落とした「D19. リポジトリ実装ガイド（Skeleton & File Layout）」を作れます。

