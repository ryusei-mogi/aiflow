D17. 品質ゲート仕様（Quality Gates Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）
前提：D10（Runner）／D16（運用ルール）／D15（TS）／D11（設定）
制約：ローカル完結、gh非依存、git依存可、回帰はE2Eで担保、総合テストは人間が実施

1. 目的

aiflow-local の実行結果（Plan/実装/テスト/PR提示）を、一定品質で「done」「needs_input」「failed」に分類し、運用がブレないようにする。
特に以下を明確化する。

どこまで通ったらdoneか（必須条件）

人間に返すべき状況（needs_input条件）

ツール側の限界として止める状況（failed条件）

回帰担保（E2E）と、あなたが行う総合テストの位置づけ

2. 用語・状態
2.1 Runnerの最終ステータス（D10）

done：PR（compare URL）提示まで到達し、品質ゲートを満たした

needs_input：人間の判断／環境操作／要件補完が必要

failed：自動実行が収束せず、ツール側の失敗として終了

2.2 テスト種別

Unit：phpunit 等（サービス層・ロジック）

Integration：API結合／DB含む（CI/ローカルでの検証）

E2E：ブラウザ操作（Playwright等）による回帰担保・主要フロー担保

Human E2E：あなたがブラウザで行う総合テスト（最終ゲート）

3. 品質ゲートの全体構造

品質は「段階ゲート（phase gate）」＋「最終ゲート」で構成する。

Planゲート：要件から実装可能な計画が生成されている

実装ゲート：変更が安全に適用され、Stepが過度に肥大化していない

テストゲート：Unit/E2Eが要件に応じて通っている

PRゲート（done判定）：compare URL、変更要約、検証結果が揃っている

人間総合テスト（運用ゲート）：あなたが要件マッチを最終確認（done後に実施）

重要：done は「自動化が合格した」状態。最終の要件マッチは人間が担保する（運用上の前提）。

4. done の必須条件（MUST）

以下をすべて満たした場合のみ done とする。

4.1 リポジトリ健全性

baseブランチから作業ブランチが作られている（D8）

baseへの直接コミットはしていない（D11 safety）

force push をしていない（D11 safety）

compare URL が生成できる（トークン不要モードでも成立）

4.2 Plan品質

ACが 3つ以上 存在する（D16）

ACに「回帰担保」が少なくとも1つ含まれる、または例外理由が明記される（後述）

Stepが分割されている（最低2 Step推奨。変更が小さい場合は1でも可）

各Stepに「目的」「変更対象（概念）」「検証（unit/e2e/human）」が書かれている

4.3 Step品質（変更規模）

原則として以下の上限を超えない（超える場合は分割して進める）

stepMaxDiffLines 以内（D11 default例：300）

stepMaxFilesTouched 以内（D11 default例：10）

上限を超える必要がある場合、Planに「超える理由」と「リスク低減策」が記載されている
（例：生成コード、移動のみ、機械的置換、等）

4.4 テスト合格条件（v1の標準）

Unit：実行対象がある場合は PASS が必須

Laravel/PHPプロジェクトで phpunit が設定されているなら必須

E2E：回帰ACがある場合は PASS が必須

requireE2EForRegressionAC=true（D11 testing）を標準とする

例外：E2Eが環境要因で実行不能の場合は done にせず needs_input に落とす（後述）

4.5 レポート（Report）の必須項目

Requestの ## Report に以下が記載されていること。

変更要約（何を変えたか、どこに影響するか）

ACの対応状況（ACごとに対応方針と検証結果）

Unit結果（コマンド、結果、失敗時は原因）

E2E結果（コマンド、結果、失敗時は原因）

Human総合テストのチェック項目案（あなたが見るべき要点）

compare URL（トークン不要PRリンク）

5. needs_input の判定条件（MUST）

自動実行では完了できず、人間の介入が必要なケース。以下のいずれかに該当したら needs_input。

5.1 要件・判断が不足

ACが足りない（3未満）

仕様が曖昧で「A案/B案」の判断が必要

既存仕様を壊さない条件が具体化されていない（回帰対象が不明）

UI文言・挙動など、あなたの意思決定が必要

→ errors.json：AMBIGUOUS_REQUIREMENT
→ Report：質問リスト＋提案案＋推奨案（1つに絞る）

5.2 環境操作が必要

worktree dirty（コミット/スタッシュ必要）

origin未設定、認証切れ、push不能

port競合でdev起動不能（devの場合）

依存（composer/npm）が未導入でコマンドが実行不能

→ errors.json：WORKTREE_DIRTY / AUTH_REQUIRED / COMMAND_NOT_FOUND 等
→ Report：復旧コマンド提示（D15準拠）

5.3 E2Eが実行不能／実行には人間操作が必要

E2Eが未整備で書くべきだが、どのフローを優先するか判断が必要

ローカル環境でE2E実行が不安定（外部依存、認証、環境差）

ブラウザでの目視確認が必須な領域（例：見た目・文言）で自動化できない

→ errors.json：E2E_TEST_FAILED または NEEDS_HUMAN_E2E（追加コード可）
→ Report：人間総合テスト手順（具体的に）

5.4 安全ガードに抵触

Stepが肥大化し、分割が必要（STEP_TOO_LARGE）

禁止操作が必要になっている（base直コミット等）

→ errors.json：STEP_TOO_LARGE 等
→ Report：分割案（Step再設計）提示

6. failed の判定条件（MUST）

ツール側の自動修正・反復が収束せず、これ以上の自動継続が不適切な場合。

6.1 リトライ上限超過

Unit/E2Eの修正リトライが上限に達した（D11 runner.*Retries）

→ errors.json：RETRY_EXCEEDED
→ Report：最後の失敗原因、直すべき候補、次の一手（手動 or 要件分割）を提示

6.2 コマンドが継続的に失敗

COMMAND_FAILED が連続し、原因がツール側では解決できない
（例：外部サービス障害、依存バージョン衝突、環境固有）

6.3 Plan/実装の整合が崩壊

Planが成立しない（PLAN_INVALID）

変更が広範囲に波及し、Step分割しても収束しない

6.4 データ破壊リスクが高い

DBマイグレーションや削除系でリスク評価が不能で、あなたの判断が必須
※この場合は failed より needs_input が基本だが、繰り返し失敗で破綻した場合は failed に移行

7. E2E（回帰）ゲートのルール
7.1 回帰ACがある場合

requireE2EForRegressionAC=true が標準

E2EがPASSしない限り done にしない

7.2 例外（E2Eを書けない／走らない）

例外は許容するが、doneではなくneeds_input に落とす。
あなたが「総合テストで担保する」と判断して明示的に承認した場合のみ、次回Runでdoneに移行してよい（運用ルール）。

運用例：

Run1：needs_input（E2E不可、手動手順提示）

あなたが Human Follow-up で「今回E2Eは後回し、総合テストでOK、次のRequestでE2E整備」と記載

Run2：それを根拠に done 許容（ただし Report に“E2E未整備”を明記）

8. Human総合テスト（運用ゲート）

done 後にあなたが行うチェック（D16）を、品質ゲートの一部として位置づける。
Runnerは Report に必ず以下を出す。

重点確認点（画面/フロー/境界条件）

追加で触るべき入力検証（空/異常値/権限）

既存フローの簡易回帰手順

9. しきい値（Thresholds）と設定キー

以下のしきい値はD11で変更可能とする。

runner.stepMaxDiffLines（例：300）

runner.stepMaxFilesTouched（例：10）

runner.planRetries（例：2）

runner.stepFixRetries（例：2）

runner.e2eRetries（例：1）

testing.requireUnitEachStep（true推奨）

testing.requireE2EForRegressionAC（true推奨）

safety.requireCleanWorktree（true推奨）

10. 出力（Report）テンプレ（最小）

Runnerが ## Report に出す最小フォーマット：

Summary

AC Coverage（AC1..n：対応＋検証）

Tests

Unit: cmd / result

E2E: cmd / result

Risk Notes（残リスク、E2E未整備など）

Human Test Checklist（あなたがブラウザでやること）

PR Link（compare URL）

11. 受け入れ基準（本Spec）

done/needs_input/failed の判定が上記ルールで一意に決まる

回帰ACがある場合、E2E PASS なしに done にならない（例外はneeds_input経由）

Step肥大・無限リトライをゲートで止められる

Reportが最低限の監督情報（AC・テスト・リンク・注意点）を必ず含む

あなたの総合テストが「運用ゲート」として明確に組み込まれている

必要なら、このD17をそのまま Runnerの「done判定ロジック」とUIのステータス表示（バッジ/警告）」 に直結させられるよう、次に D17-A：判定ルールの機械可読（JSONルール） を追加できます。

