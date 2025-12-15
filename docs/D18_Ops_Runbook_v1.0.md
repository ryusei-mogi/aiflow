D18. 運用Runbook（操作手順書 / Ops Runbook）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）
前提：D6（UI）／D10（Runner）／D11（設定）／D15（TS）／D16（Request運用）／D17（品質ゲート）
制約：ローカル完結、gh非依存、git依存可、トークン不要PRモード

1. 目的

aiflow-local を 日々の開発で迷わず回す ための標準手順を確立する

典型的な詰まり（環境・要件不足・E2E不調・Step肥大・リトライ収束しない）を 最短で復旧 する

PoCの学びを運用に固定化し、手戻りを減らす

2. 役割分担（運用上）

あなた（人間）：要望を書く／優先度を決める／総合テスト（ブラウザ）／最終承認

aiflow-local：planning→step反復→unit/e2e→レポート→compare URL提示

AI（CLI）：設計・実装・unit/e2e生成（ただし実行はRunnerが統制）

3. ディレクトリと成果物の見方（最小）

requests/：入力（SSOT）

runs/<request-id>/<run-id>/：実行ログ・Context・errors（監査）

patches/：必要ならパッチ出力（運用で残す場合）

docs/：仕様（D1〜D18など）

UIから見る場合も、最終的には上記に着地する。

4. 標準フロー（毎回これ）
4.1 準備（最初に必ず確認）

リポジトリ直下で作業

作業ツリーがクリーンか確認

git status --porcelain（空ならOK）

最新のbaseを取得（推奨）

git fetch origin

4.2 Request作成

requests/ に新規ファイルを作成（D16テンプレ）

以下を必ず書く

Want（要望）

AC（最低3つ、回帰AC含むのが原則）

テスト指示（E2E/Unit、最低限の方向性）

priority を付ける（P0〜P3）

4.3 実行（UI or CLI）

UI：requests/*.md を選択 → Run

CLI（想定）：npx aiflow run <request-id>

4.4 結果確認（必須）

requests/<id>.md の ## Report を読む

done/needs_input/failed と reason_code を確認（D17/D17-A）

done の場合でも、あなたが 総合テスト（ブラウザ） を実施してOKなら次へ

4.5 承認～取り込み

あなたが総合テストでOK → merge相当（運用に合わせて）

追加要望や違和感 → Human Follow-up を追記して再実行

5. ステータス別の手順
5.1 done のとき（合格）

やること（必須）

Reportの「Human Test Checklist」を実施（ブラウザで確認）

ACが全部満たされているか確認

回帰フロー（E2Eまたは手動）を確認

問題なければ取り込み

ありがちな落とし穴

E2EがPASSでも、要件解釈ズレ（あなたの総合テストで検知）

UI文言・導線の違和感（自動では拾いにくい）

5.2 needs_input のとき（人間の追記・操作が必要）
A) 要件不足（AMBIGUOUS_REQUIREMENT）

症状

ACが足りない、A案/B案の選択が必要、回帰対象が不明

対処

requests/<id>.md の ## Report 最下部に追記

次のいずれかを必ず書く

判断（A案で／B案で）

制約追加（〜は変えない）

AC追加（Given/When/Thenで）

追記テンプレ

md
### Human Follow-up (YYYY-MM-DD)
- 判断：A案で進めて
- 制約：既存の画面Xの文言は変えない
- AC追加：[ ] Given... When... Then...

B) 環境問題（WORKTREE_DIRTY / REMOTE_ORIGIN_MISSING / BASE_BRANCH_NOT_FOUND）

症状

gitが汚れている、originなし、baseが取れない、pushできない

対処（最短）

dirty：git status → git stash -u（または commit）

originなし：git remote -v → origin追加

baseなし：git fetch origin → base名確認

再実行

修復後に Re-run

C) E2E必須だが走らない（E2E_TEST_FAILED / NEEDS_HUMAN_E2E）

症状

回帰ACがあるのにE2EがPASSしない／走ってない

対処（2択）

E2Eを直す/足す（推奨：回帰担保の原則を守る）

例外運用：あなたが「今回は手動で担保」と承認し、次のRequestでE2E整備

この場合、Follow-upに明記（監査のため）

例外承認テンプレ

md
### Human Follow-up (YYYY-MM-DD)
- 今回はE2Eは後回し（理由：ローカル環境差で不安定）
- 総合テストで回帰を担保する（手順：ログイン→…→確認）
- 次RequestでE2E整備を実施する

D) Step肥大（STEP_TOO_LARGE）

症状

途中でAIが止まりやすい、diffが大きすぎる、ファイル数が多い

対処

Follow-upで「分割方針」を指示（ただし“考えるのはAI”でOK）

具体的には以下だけ書く

Stepを3〜5に分割

先に足場（テスト/小変更）から

1 Step 1 commit

テンプレ

md
### Human Follow-up (YYYY-MM-DD)
- Stepを5つ以内に分割して進めて
- 先にテストを用意し、落ちる→直すで進める
- 1 Step = 1 commit、1 Stepのdiffは小さく

5.3 failed のとき（自動では収束しない）
A) リトライ上限（RETRY_EXCEEDED）

対処（順番）

logs確認：runs/<id>/<run>/ のログを読む（またはUIから）

原因がテストなら：

Request分割（対象を狭める）

Step分割の強制（Follow-upで小さく）

原因が環境なら：

doctor実行（D11/D15）

収束しない場合は、最小化して再Run

「UIだけ」「APIだけ」「テストだけ」のようにスコープを切る

B) PLAN_INVALID / REPORT_MISSING

対処

ツール障害として扱う

doctor実行 → 再Run

再現するなら aiflow-local のバグ（別途Issue化）

6. doctor（診断）運用
6.1 いつ打つか

初回導入直後

failedが連続するとき

CLI更新・node_modules更新後

ルール/スキーマ編集後（D17-A/B/C）

6.2 doctorがチェックすべき項目（最低）

git の存在、repo判定、origin判定

ルールファイルのSchema validate（D17-C）

ContextのSchema validate（D17-B）

ルール内pathがContextに存在するか（論理検証）

危険コマンドがactionsに含まれていないか（警告）

7. PoC運用（最小の回し方）

最初の1〜2週間は、学びを逃さないために以下を守る。

同時進行は1件（WIP=1）

1 Request は小さく（バグ修正/小機能）

E2Eは「回帰1本」だけでも良いので必ず作る

failedが出たら「直す」より「分割して再試行」を優先

8. ログと監査のルール

すべてのRunで以下を残す

quality_context.json（D17-B）

errors.json（D17-A）

stage.json（状態遷移）

unit/e2eログ（パスをchecksに入れる）

requests/<id>.md の ## Report は 最終判断ログ

“なぜ例外にしたか” が残るようにする

9. 代表的なトラブルシュート（早見表）

dirty → stash/commit → rerun

E2E失敗 → E2E修正 or 手動担保を明記（needs_input経由）

Step肥大 → 分割方針追記 → re-plan

retry超過 → 分割（Request/Step） → 再Run

compare URL出ない → origin/push確認 → rerun

10. 受け入れ基準（本Runbook）

done/needs_input/failed ごとに、人間が迷わず次アクションを取れる

“考えるのがだるい部分” は Follow-up テンプレで最小入力化されている

失敗時に「ログ→原因→分割→再実行」の最短導線が確立している

例外運用（E2E未整備など）が、必ず記録として残る

次に必要なら、このD18をそのままUIの「Help」タブに埋め込めるよう、D18-A（Doctor診断仕様） と D18-B（UIメッセージ辞書：reason_code→表示文） を切り出して作れます。

