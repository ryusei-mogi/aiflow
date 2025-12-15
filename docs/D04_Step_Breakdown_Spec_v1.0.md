D4. Step Plan仕様（Step Breakdown Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）

1. 目的

本書は、Requestを完走させるための中核である Step Plan（実装タスクの細分化計画） を定義する。
AIが長時間の実装で途中停止しうる前提に対し、Stepを 再開可能な粒度 に分割し、各Stepを 「小さな変更→テスト→コミット→記録」 まで閉じることで、確実に前進させる。

2. 用語

Step Plan：Requestを完了するためのStep一覧および各Stepの定義

Step：最小反復単位。変更・テスト・コミット・記録が必須

Done条件：Stepが完了したと判定できる条件（観測可能であること）

品質ゲート：Step Plan/Step実行の妥当性を機械的に判定する基準

3. Step Planの位置づけ（要求）

Step Planは requests/<id>.md の ## Plan に必ず含まれる

Step Planは 最低3 Step を基本とする（小規模でも分割する）

Step Planは AC（受け入れ条件） と明確にトレーサブル（どのStepがどのACに寄与するか）である

4. Stepの必須構造（Step定義）

各Stepは最低限、以下の情報を持つこと。

4.1 必須フィールド（概念）
項目	必須	説明
step_id	Yes	S01 等の連番
title	Yes	Stepの短い目的
objective	Yes	Stepで達成すること（1つに絞る）
scope	Yes	変更対象の範囲（ファイル/ディレクトリ/機能領域）
acceptance_links	Yes	どのACに関係するか（1つ以上）
done_criteria	Yes	観測可能な完了条件（最低2つ）
tests	Yes	実行するテスト種別と目的（少なくともunit）
commit_message	Yes	コミットメッセージ案
risk	No	リスク/注意点（あれば）
fallback	No	失敗時の切り戻し/代替案（あれば）

※「どうやって実装するか」の手順やプロンプトは含めない。ここでは 結果と検証 にのみ責務を持つ。

5. Step分割ルール（最重要）

Stepは「AIが途中で止まる」前提で、小さく切る。以下は デフォルトの分割ポリシー とする。

5.1 サイズ上限（デフォルト）

変更ファイル数：最大3

変更行数（差分合計）：最大150行

目的：1つ

ACリンク：1〜2個（多すぎる場合は分割）

上限超過が見込まれるStepは禁止。必ず分割する。

5.2 Step数の下限（デフォルト）

原則 3 Step以上

S01: 足場（調査・テスト追加・インタフェース整備）

S02: 本体（最小実装）

S03: 仕上げ（例外系・ドキュメント・回帰/E2E）

5.3 分割パターン（推奨）

縦割り（フロー単位）：入口→ロジック→保存→表示

安全割り：テスト追加→実装→リファイン

リスク先行：壊れやすい箇所を先に守る（回帰テスト→変更）

6. Done条件（観測可能性の要件）

StepのDone条件は「雰囲気OK」禁止。必ず観測可能な条件にする。

6.1 Done条件の最低要件

各Stepは done_criteria を 最低2つ 持つ。

例：

phpunit が指定のテストクラスで成功

特定のAPIレスポンスが期待どおり（ローカルでcurl等）

画面Xの特定UIが表示される（※自動化できない場合は“確認手順”として明示）

既存フローYに影響がないことをE2E smokeで確認

6.2 Done条件の禁止事項

「問題なさそう」「動いた」など主観表現のみ

「実装を完了する」など自己参照

7. テスト要件（Step内のtests）
7.1 必須

すべてのStepで unitテスト を最低1つ実行すること

既存テストがない場合は、S01で最小導入/追加を計画に含める

7.2 任意（回帰が怖い場合は推奨）

E2E/結合（smoke）を Step Plan に含める

「既存フローYが回帰しない」をACに含めた場合、必ずE2E（smokeでも可） をStep内に紐づける

8. Step実行と記録（Reportへの反映要件）

Stepは実行されるたびに ## Report に追記される。

8.1 Step実行記録の必須項目

Step ID / title

実施内容要約

変更点（主要ファイル）

実行テストと結果

関連コミット（ハッシュ）

残課題（次Stepへ持ち越しがあれば明示）

9. Step Plan品質ゲート（Plan段階での検査）

RunnerはPlan生成直後に以下を検査し、不合格ならPlanを再生成させる（自動リトライ）。

9.1 必須検査項目

Step数が 3以上

各Stepに必須フィールドが揃っている

各StepのDone条件が2つ以上で、観測可能

testsにunitが含まれる

すべてのACが、少なくとも1つのStepにリンクしている

9.2 推奨検査項目（あると強い）

変更範囲が不明瞭（scopeが抽象的すぎる）→不合格

Stepの目的が複数（objectiveが複合）→不合格

回帰ACがあるのにE2Eがない → 不合格

10. 実行時品質ゲート（Step実行後の検査）

Runnerは各Step完了後に以下を検査し、不合格なら 同Stepの再実行 or 分割 を行う。

10.1 必須検査項目

テストが成功している（指定tests）

コミットが作成されている

差分量が上限を大幅に超えていない（超過時は分割を促す）

done_criteriaが満たされたと説明できるログ/結果が残っている

10.2 超過時の振る舞い

差分が大きすぎる → Stepを分割して「前半をコミット」「後半を次Stepへ」

テスト失敗 → 自己修正を一定回数試み、収束しない場合は failed または needs_input

11. Step Planの表現形式（Markdown規約）

Step Planは ## Plan 内に以下形式で記述する。

11.1 推奨フォーマット
md
## Plan

### Acceptance Criteria (AC)
- AC1: ...
- AC2: ...
- AC3: ...

### Step Plan
#### S01: ...
- Objective: ...
- Scope: ...
- Links: AC1, AC3
- Done:
- ...
- ...
- Tests:
- unit: ...
- e2e: ... (optional)
- Commit: "..."

#### S02: ...
...


JSON等の機械可読形式は別紙（D7や実装仕様）で定義してもよいが、D4では「人間が読めること」を最優先とする。

12. 例（Step Plan例）

（抽象例）

AC1: 条件Aで画面Xがエラーにならない

AC2: 条件BでAPIが400を返す

AC3: 既存フローYが回帰しない（E2E）

S01（足場）

Objective: 失敗再現とテストの足場を作る

Scope: tests/Feature/..., ...Service.php

Done: unitテストを追加し再現が取れる、テストが成功する

Tests: unit（追加テスト）

Commit: test: add regression for ...

S02（本体）

Objective: バリデーションとハンドリングを修正

Scope: ...Controller.php, ...Request.php

Done: unit成功、期待のステータスコードになる

Tests: unit

Commit: fix: validate ...

S03（回帰/E2E）

Objective: E2E smokeで既存フローYを守る

Scope: e2e/...spec.ts（例）

Done: E2E成功、Reportに確認観点が残る

Tests: e2e

Commit: test(e2e): add smoke for flow Y

13. 受け入れ基準（本Spec）

すべてのRequestはPlanにStep Planを含む

Step Planは最低3 Step、各StepはDone条件2つ以上、unitテストを含む

ACとStepがトレーサブル

実行後、ReportにStepごとの記録（テスト結果・コミット）が残る

大きくなりがちな実装を、Step分割により完走可能にする

14. 関連（依存）

D1：機能仕様書（画面/操作）

D2：状態遷移仕様書（失敗・入力待ち・再実行）

D3：Requestファイル仕様（Plan/Reportの格納）

D5：レポート仕様（Reportの詳細フォーマット）

D9：テスト戦略（E2Eの位置づけ）

次は D5（レポート仕様） を作ると、監督者として「どこを見れば判断できるか」が完全に定型化されます。

