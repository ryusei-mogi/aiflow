D46. requestsテンプレ（最小でAIが自走できる書式・AC・テスト指示）v1.0

対象：requests/*.md の標準フォーマット（D36準拠）
目的：あなたが “一言要望を書く” に近い負荷で、Plannerが 分割計画→実装→テスト→レポート まで自走できる入力を安定供給する。
前提：ローカル完結／Laravel+MySQL／既存仕様は壊さない／E2Eは必要時／総合テストはあなたが実施。

1. テンプレの基本方針（v1）

上部に メタ（priority/status/labels/depends_on など）

本文は “短くてもよい” が、最低限次を含める：

何をしたいか（1〜3行）

受け入れ条件（最低3つ、Given/When/Then推奨）

（あれば）テスト指示（E2E/Unit）

曖昧でも良いが、Plannerが質問を返す余地（Needs_input）を残す

2. 標準テンプレ（コピペ版）
md
---
id: RQ-YYYYMMDD-XXX
title: <短い題名>
priority: P1
status: ready
labels: [aiflow, mvp]
depends_on: []
estimate: M
created_at: YYYY-MM-DD
updated_at: YYYY-MM-DD
---

## 要望（1〜3行）
- 〜〜をしたい
- 〜〜の操作で、〜〜ができるようにしたい

## 前提/制約（固定が多いなら短く）
- PHP/Laravel
- DB: MySQL
- 既存仕様は壊さない
- ghコマンド禁止（内部要件）

## 受け入れ条件（最低3つ）
- [ ] AC-01 Given: <条件A> When: <操作> Then: <期待結果>
- [ ] AC-02 Given: <条件B> When: <操作> Then: <期待結果>
- [ ] AC-03 Given: <既存フローY> When: <従来操作> Then: <回帰しない（E2Eで担保）>

## テスト指示（あれば）
### E2E
- シナリオ1: ログイン → <操作> → <期待>
- シナリオ2: <省略可>

### Unit（任意）
- 対象: <Service/UseCase/Validator 等>
- 観点: <入力検証/権限/境界値など>

## 補足（任意）
- 画面: <対象画面名/URLパス>
- API: <対象エンドポイント>
- 参考: <既存ファイル/既存仕様の場所>

3. “一言要望” を許容するミニマム入力（v1運用）

あなたが本当に短く書きたい場合、以下の最小形でも走るようにする。
ただし、Plannerは必ずACを補完し、Reviewer/QAで穴を埋める前提。

md
---
id: RQ-YYYYMMDD-XXX
title: <題名>
priority: P1
status: ready
labels: [aiflow]
depends_on: []
estimate: S
created_at: YYYY-MM-DD
updated_at: YYYY-MM-DD
---

## 要望
- 画面Xに「〜〜」を追加して、条件Aのときに〜〜になるようにして

## 受け入れ条件（最低3つ）
- [ ] AC-01 条件Aのとき画面Xで〜〜
- [ ] AC-02 条件BのときAPIが〜〜
- [ ] AC-03 既存フローYが回帰しない（E2Eで担保）


この形でも “最低3つのAC” を守るのが重要（あなたの方針と一致）。

4. Plannerが自走しやすい書き方ガイド（v1）

条件（Given） は「ユーザー種別」「データ状態」「権限」「既存レコード有無」を入れる

操作（When） は「どの画面で」「どのボタン」「どのAPI」を入れる

期待（Then） は「表示」「保存」「エラー」「遷移」「副作用（DB更新）」を入れる

“既存仕様を壊さない” は、具体的に “どのフローが回帰してはいけないか” を1つ書く（AC-03）

5. テスト指示の書き方（v1）
5.1 E2E（推奨形式）

「手順」＋「確認点」をセットで書く

例：

ログイン → 5分放置 → 再操作 → セッション維持 → エラーなし
（あなたが言っていた “放置→操作” などはE2E向き）

5.2 Unit（任意）

「どの層を」「何の観点で」を一言で良い
（例：InvoiceServiceの入力検証、権限制御）

6. 受け入れ基準（D46）

このテンプレで作った request を投入すると、Plannerがplanning.jsonを安定生成できる

ACが最低3つあり、report.md のチェック欄にそのまま反映できる（D37）

テスト指示がある場合、planningの gates と tests.command に落とせる（D41/D42）

次に作るべきは、MVP運用で必ず揉める “blocked/needs_input の分類と復帰手順” を辞書化する D47. reason_code辞書（頻出ケースと復帰手順） です。

