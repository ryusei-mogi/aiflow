D5. レポート仕様（Report Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）

1. 目的

本書は、Requestごとに生成・更新される Report（実行結果レポート） の形式と必須内容を定義する。
Reportは、監督者（ユーザー）が 「要件に合っているか」「回帰しそうか」「受け入れ可能か」 を短時間で判断できることを目的とし、AIの作業内容を 観測可能・追跡可能 にする。

2. スコープ

requests/<id>.md の ## Report セクションに記載されるレポートを対象

実行ログの全文・CIログなどは runs/ に保存し、Reportは要約と索引に徹する

PRコメント投稿など外部連携は対象外（ローカル完結）

3. レポートの原則

追記型：過去の記録を消さず、追記で履歴を残す（改ざん防止・追跡性）

観測可能：主観的表現（「大丈夫そう」）は禁止。テスト結果・差分・手順など根拠を明示する

短く見て分かる：先頭に結論（要約・AC状況・次アクション）を置く

Stepと紐づく：Step単位で「何を変え、どう検証し、どこまで進んだか」を残す

受け入れ支援：総合テスト（人間）で見るべき観点を最後に提示する

4. Reportの構造（必須テンプレ）

## Report は、以下の見出し順序を必須とする。

### Summary

### Acceptance Criteria

### Steps Executed

### Tests

### Changes

### Risks / Notes

### Next Actions (Human)

追加セクションは可。ただし上記は必ず含め、順序は固定。

5. 各セクションの仕様
5.1 ### Summary（必須）

目的：このRequestで何が起きたかを30秒で把握できるようにする。

必須項目

実行結果ステータス（完了/途中/入力待ち/失敗）

主要成果（何を実現したか）1〜3行

現在地（例：S02まで完了、S03未着手）

PR導線（done時）または再開条件（needs_input/failed時）

例

Status: Done

Result: セッションタイムアウト時の再ログイン導線を追加し、API側のエラーコードを統一

Progress: S01〜S03完了

PR: <compare URL>

5.2 ### Acceptance Criteria（必須）

目的：ACが満たされたかを機械的に追えるようにする。

表現ルール

ACはPlan側のAC番号/文言と一致させる（AC1, AC2…）

各ACに対しステータスを付与する

ACステータス

Met：満たした（根拠がある）

Not Met：未達

Partially Met：一部未達/条件付き

Blocked：判断不能（入力待ち/環境依存）

必須項目

AC一覧（最低3つ）

各ACの根拠（テスト名、手順、ログ、コミット等への参照）

例（推奨フォーマット）

AC1 (Met): 条件Aのとき画面Xで〜〜

Evidence: phpunit --filter ... 成功、commit abc1234

AC2 (Partially Met): 条件BのときAPIが〜〜

Evidence: 単体はOK、E2Eは未追加（S03で対応予定）

AC3 (Met): 既存フローYが回帰しない（E2E）

Evidence: e2e smoke 成功、commit def5678

5.3 ### Steps Executed（必須）

目的：Step単位の履歴（進捗・成果・検証・コミット）を追跡可能にする。

記載ルール

Stepは S01 形式で列挙

各Stepに「内容要約」「結果」「コミット」「持ち越し」を必ず書く

必須項目（各Step）

Step ID / タイトル

Outcome（Done / Partial / Failed）

What changed（1〜3点）

Tests run（Step内で実行したもの）

Commit（hash、複数可）

Carryover（次Stepへ持ち越す課題があれば）

例（推奨フォーマット）

S01: 回帰テストの足場追加

Outcome: Done

Changes: Featureテスト追加、再現ケースを固定

Tests: phpunit --filter SessionTimeoutTest OK

Commit: abc1234

Carryover: なし

5.4 ### Tests（必須）

目的：テスト実行の証跡をまとめ、監督者が信頼できる形にする。

必須項目

実行したテストコマンド一覧（コピペ可能）

結果（pass/fail、失敗時は失敗テスト名と要約）

テストログの参照先（runs配下のパス等）

記載ルール

「Unit」「Integration」「E2E」を分ける（無い場合は省略可だがUnitは必須）

失敗時は最後の失敗を短く要約し、詳細はログ参照に逃がす

例

Unit

Cmd: phpunit → PASS

Log: runs/20251214-login-timeout/001/unit.log

E2E

Cmd: npm run e2e -- --grep "flow Y" → PASS

Log: runs/.../e2e.log

5.5 ### Changes（必須）

目的：差分の “意味” を短時間で把握させる（diffを読まない運用でも判断できる程度）。

必須項目

変更カテゴリ（例：Fix/Feature/Refactor/Test/Doc）

主要変更ファイル（最大10件、重要順）

影響範囲（ユーザー影響、API影響、DB影響など）

推奨項目

破壊的変更の有無（Yes/No）

DB変更がある場合：migrationの有無、既存データ影響の注意

例

Category: Fix + Test

Key files:

app/Http/...Controller.php：タイムアウト時のハンドリング統一

tests/Feature/SessionTimeoutTest.php：回帰テスト追加

Impact:

API: 401時のレスポンス形式を統一（互換維持）

DB: 変更なし

5.6 ### Risks / Notes（必須）

目的：見た目では分からない穴（権限、入力検証、削除系、整合性）を明示する。

必須項目

リスク（あれば）を severity 付きで列挙

Blocker / Major / Minor

推奨観点

権限/入力検証の抜け

データ整合性（移行、削除、境界条件）

回帰（既存フローへの影響）

環境差（ローカル依存）

例

Major: 既存フローYの別分岐（条件C）はE2E未カバー（総合テストで確認推奨）

Minor: エラーメッセージ文言は暫定（i18n未対応）

5.7 ### Next Actions (Human)（必須）

目的：総合テストを行う人間が、何をどう確認すべきか迷わないようにする。

必須項目

手動確認チェックリスト（3項目以上推奨）

確認手順（ブラウザ操作の最短手順）

期待結果（Given/When/Then形式推奨）

PR作成導線（done時）：Open PRの手順（URL or クリック導線）

例

ブラウザでログイン→10分放置→操作→ログイン画面へ遷移し、復帰後も操作が継続できる

条件BのAPIを叩く→HTTP 400で所定のエラー形式が返る

既存フローYを一連操作→以前と同じ結果になる（E2E PASS済みだが目視確認推奨）

PR: Open PR ボタンから compare URL を開き、タイトル/説明を貼り付けて作成

6. needs_input / failed 時の追加要件
6.1 needs_input の場合（必須追記）

### Summary に「何が不足か」を1行で記載

### Next Actions (Human) に「回答テンプレ」を提示

回答テンプレ例

Q1: 仕様A/Bどちらにしますか？（A=..., B=...）

Q2: テストユーザーの前提は？（role=admin/user）

6.2 failed の場合（必須追記）

### Summary に「失敗の直近原因」を記載

### Tests に最後の失敗点（テスト名/エラー要約）を必ず含める

### Next Actions (Human) に「再実行前にやること」を列挙（例：依存導入、環境変数、DBリセット）

7. Report更新タイミング

Reportは以下のタイミングで追記される。

Plan生成後：Summary/AC骨子/Step計画を反映してもよい（任意）

各Step完了後：### Steps Executed に追記（必須）

テスト完了後：### Tests 更新（必須）

push完了後：SummaryとPR導線更新（done時必須）

needs_input/failedへの遷移時：該当要件の追記（必須）

8. フォーマット例（最小完全形）
md
## Report

### Summary
- Status: Running (S02 in progress)
- Result: （ここまでの成果）
- Progress: S01 Done / S02 Running
- PR: (not yet)

### Acceptance Criteria
- AC1 (Met): ... / Evidence: ...
- AC2 (Not Met): ... / Evidence: ...
- AC3 (Blocked): ... / Evidence: ...

### Steps Executed
- S01: ...
- Outcome: Done
- Changes: ...
- Tests: ...
- Commit: ...
- Carryover: ...

### Tests
- Unit: `phpunit --filter ...` → PASS (log: runs/.../unit.log)

### Changes
- Category: ...
- Key files:
- ...
- Impact:
- API: ...
- DB: ...

### Risks / Notes
- Major: ...
- Minor: ...

### Next Actions (Human)
- [ ] ...
- [ ] ...
- [ ] ...

9. 受け入れ基準（本Spec）

Reportが必須7セクションを持つ

ACにステータスと根拠がある

Step実行がコミット・テスト結果と紐づいている

「大丈夫そう」等の主観表現だけで結論を出さない

人間の総合テストがこのReportだけで開始できる

10. 関連（依存）

D1：機能仕様書（UIでの提示・操作）

D2：状態遷移仕様書（needs_input/failedの扱い）

D3：Requestファイル仕様（Reportの格納）

D4：Step Plan仕様（Stepの構造）

D9：テスト戦略（テスト分類・必須範囲）

次は、実装に踏み込まずに設計を固めるなら D6（UI/画面設計） か、もしくは D8（Git運用仕様） を先に作るのが効果的です。

