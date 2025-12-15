D48. MVPローンチ運用手順（毎日の回し方・ルール・トラブルシュート）v1.0

対象：aiflow-local を使ったローカル完結開発運用
目的：あなたが「要望を書く→総合テスト→OK/差し戻し」だけで回せる日次ループを固定し、止まりにくくする。
前提：requests/*.md 運用／ブラウザUIでRun／Codex+Gemini CLI／gh禁止／git依存OK。

1. 日次ループ（標準運用）
1.1 朝（または作業開始時）

git pull --ff-only（任意：origin運用なら）

npm install（初回のみ／依存更新時のみ）

aiflow UI起動（npm run aiflow:dev 等を想定）

UIの Doctor を実行（PASS確認）

1.2 要望投入（あなたの作業）

requests/ に新規作成（D46テンプレ）

priority/status を設定

すぐ着手：status: ready

まだ：draft

1.3 実行（AI主導）

UIの Next Request を確認（D35）

Run を押す（safe mode）

Run Detail で state が DONE か NEEDS_INPUT まで待つ

NEEDS_INPUT の場合：D47 actions に従って request を補足→再Run

1.4 総合テスト（あなたが実施）

ローカルでアプリを起動し、受け入れ条件（AC）を確認

ACが満たされていれば：

Request を done に更新（UIの “Mark as done”）

必要なら push（autopushモードを使うなら compare URL で確認）

ACが未達なら：

request.md に不足点を追記（差し戻しの形）

status を ready に戻して再Run

2. “差し戻し” の標準書き方（あなたが迷わないため）

request.md の末尾に追記（履歴を残す運用）。

md
## 差し戻し（YYYY-MM-DD）
- NG: AC-02 のThenが満たされていない（〜〜になっている）
- 修正方針: 〜〜を〜〜にして
- 追加AC:
- [ ] AC-04 Given: ... When: ... Then: ...


こう書くと Planner が replan しなくても Implementer が修正に寄せやすい。

3. ルール（運用ガードレール）
3.1 あなた側のルール

1 request = 1目的（大きくなったら分割）

ACは最低3つ（D46）

差し戻しは “現象＋期待＋追加AC” をセット

3.2 aiflow側のルール（固定）

worktree dirty では走らない（D47: WORKTREE_DIRTY）

main直変更禁止（D40）

max_diff_lines 超過は replan（D42: STEP_TOO_LARGE）

自動修正ループは最大1回（D41/D34）

4. よくあるトラブルと即応（クイック対応）
4.1 RUN_IN_PROGRESS / QUEUE_IN_PROGRESS

別タブ・別プロセスで走っていないか確認

Run Detail を開き直す

TTL待ち or doctor(full)

4.2 JSON_PARSE_ERROR / JSON_SCHEMA_INVALID

まず fallback が効いたか確認（Runログに記録）

直らない場合：

request本文を少し短くする／targetsを明示する一文を追加

再Run

4.3 PATCH_APPLY_FAILED

replan（targets絞り）

直近でベースが動いているなら git pull 後に再Run

4.4 UNIT_TEST_FAILED

ログの “最初の失敗テスト名” だけ確認

自動修正を1回許可→ダメなら needs_input であなたが方針追記

4.5 E2E_TEST_FAILED（v1.1以降が本番）

フレークなら再実行（最大1回）

それでもだめなら “観点（何が壊れたか）” をrequestに追記

5. “止まらない” ための推奨設定（v1）

safe modeをデフォルト

autopushは手動確認が増えるので、慣れるまでOFF

Unitは常時ON

E2EはUIフロー系だけON（planningで gates.e2e=true）

6. “品質の最低ライン” を守るミニチェック

あなたの総合テスト前に、report.mdで次だけ見る運用でも効果が高い。

ACチェックリストが存在する

Unit PASS

変更ファイル数が過剰でない（diff_stats）

7. 受け入れ基準（D48）

request追加〜実行〜総合テスト〜done までがUI中心で回る

blockedでも D47 actions で復帰できる

あなたの介入は「要望」「総合テスト」「差し戻し」だけに近づく

次に作るべきは、実装前に “MVPの完成定義” を明文化する D49. Definition of Done（DoD）/品質ゲート定義 です。これがあると、AIが勝手にスコープを膨らませにくくなります。

