D49. Definition of Done（DoD）/ 品質ゲート定義 v1.0

対象：aiflow-local（ローカル完結・ブラウザUI・requests運用・サブスクCLI）
目的：AIが勝手にスコープを膨らませたり、未完のまま「できた」扱いにするのを防ぎ、あなたの総合テストと整合する “完成” の基準を固定する。
前提：既存仕様は壊さない／Unitは自動／総合テストはあなたが実施。

1. DoDの階層（v1）

v1では、3層で定義する。

Request DoD：1つのrequestがDONEになる条件

Run DoD：1回のrunが成功扱いになる条件

MVP Release DoD：aiflow-local v1.0を「使える」と言える条件

2. Request DoD（requestがDONEになる条件）
必須（すべて満たす）

ACが最低3つ あり、すべて満たした（あなたの総合テストで確認）

既存の重要フロー（AC-03で指定）が回帰していない

E2Eで担保すると書いた場合は、E2EがPASS（後述）

status: done に更新されている（D38）

report.md に以下が揃っている（D37）

実施ステップ一覧（S01..）

Unit/E2E結果

変更ファイル一覧/差分要約

既知のリスク/残課題（あれば）

条件付き（該当時のみ）

DB変更がある場合：migrateが実行でき、rollback方針が明記されている（最低限 “down対応” または “破壊的変更なし”）

権限・入力検証が要件に含まれる場合：Unitで観点がカバーされている、または手動テスト手順がreportにある

3. Run DoD（runが成功扱いになる条件）
必須

stage.state = DONE（D34）

stage.reason_code = null

planning.json が生成されている（D42）

report.md が生成されている（D37）

UnitテストがPASS（D41）

条件付き

planning.steps[*].gates.e2e=true が1つでもある場合：E2EがPASS（D41）

autopush mode の場合：pushが成功し、compare URL（可能なら）がreportに出ている（D40）

4. 品質ゲート（v1）

AIが「完了」と判断する前に必ず通すゲート。
※ “あなたが見ない前提” なので、機械ゲートに寄せる。

4.1 Gate A：入力妥当性（Run開始前）

requestがD36/D46の形式（meta＋本文）

ACが3つ以上（D46）

worktree clean（D47: WORKTREE_DIRTY で止める）

4.2 Gate B：差分安全性（実装後）

main直変更なし（作業ブランチのみ：D40）

max_diff_lines 超過時はreplan（D42: STEP_TOO_LARGE）

targets外のファイル編集がない（可能ならチェック）

4.3 Gate C：自動テスト（必須）

Unit PASS（常時ON）

E2E PASS（gates.e2e=true の場合のみ）

4.4 Gate D：レポート完全性（必須）

report.md にACチェック欄がある

変更点・影響範囲・既知リスクが書かれている

次にやるべきこと（next actions）がある（blocked時は特に）

5. MVP Release DoD（aiflow-local v1.0の完成条件）
必須（すべて満たす）

npm install（devDependencies）→ npm run dev でUIが起動する（D44）

Requests一覧／詳細／Run詳細の3画面が動く（D45）

requestsの編集（meta/本文）が壊れずに保存できる（D36）

RunをUIから起動でき、runs配下に成果物が揃う（D37/D38）

Planner→Implementer→Unit→Report の縦串が通る（D44）

blocked時に reason_code と actions が必ず表示される（D47）

gh依存がない（D40/D43）

runs/ と locks/ が gitignore されている（D12/D39）

推奨（満たすと実運用が楽）

doctorがUIから実行できる（D45）

Next Request が表示される（D35）

“Mark as done” がUIにあり、あなたの総合テスト後に一発で状態更新できる（D38）

6. 例外（v1で許容する“妥協”）

E2Eは “常時必須” ではなく、planningの gates に従う

compare URL生成はGitHub remote時のみ（REMOTE_NOT_GITHUBは許容）

トークン計測はしない（no_tokenモード）

7. 受け入れ基準（D49）

“DONE” が曖昧にならず、AI側も機械的に判定できる

あなたの総合テストが Request DoD に組み込まれている

失敗時の復帰が reason_code/actions で明確（D47）

次は、実装に入るために「どの順でPR（=request）を作るか」を決める D50. MVP実装バックログ（最小のrequestsセット） を作るのが最短です。

