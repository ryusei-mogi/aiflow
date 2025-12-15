D35. Request運用仕様（優先度キュー・ステータス遷移・自動選定ルール）v1.0

対象：requests/*.md を “積み上げて回し続ける” 運用
目的：ブラウザUIで requests を管理し、優先度順に自動で次を選び、Runを継続できる状態にする。
前提：ローカル完結／gh禁止／git依存OK／既存仕様は壊さない。

1. Requestの基本データモデル（v1）

Requestは Markdownファイル をSSOTとし、先頭のメタ（簡易Frontmatter相当）で管理する。

1.1 メタ項目（v1必須/任意）

必須

priority: P0|P1|P2|P3

status: draft|ready|running|blocked|done|archived

任意

labels: [..]

estimate: S|M|L（Plannerの分割にも使える）

depends_on: [RQ-...]

created_at: YYYY-MM-DD

updated_at: YYYY-MM-DD

1.2 title

最初の # ... を title とみなす

2. 優先度（priority）ルール（v1固定）

優先度は小さいほど強い。

P0：今すぐ（ブロッカー・重要改善・起動不良）

P1：次（機能追加の主線）

P2：そのうち（改善・リファクタ・UX）

P3：保留（アイデア箱）

3. status の状態遷移（v1）
3.1 状態一覧

draft：要望記述中（実行対象外）

ready：実行対象

running：Run中（同一requestで同時に1つのみ）

blocked：needs_input 等で止まっている（人間の作業待ち）

done：完了（受け入れ済み）

archived：やらない（保管）

3.2 遷移図（テキスト）

draft → ready（人間が準備完了）

ready → running（Run開始）

running → done（完了＆受け入れOK）

running → blocked（NEEDS_INPUT）

blocked → ready（人間が対応済み、再開/再Run可能）

任意：* → archived

4. 自動選定（Next Request）ルール（v1）
4.1 対象集合

status=ready のみ対象

status=running が存在する場合は 新規開始しない（v1は並列禁止）

4.2 ソートキー（v1固定）

priority（P0→P3）

depends_on が解決済み（依存が未完了なら後回し）

created_at（古い順）

ファイル名の辞書順（タイブレーク）

4.3 depends_on の解決判定

depends_on の対象requestが done のときのみ “解決済み”

依存未解決の場合：

UIでは “Blocked by …” と表示

自動選定から除外（v1）

5. 自動継続モード（Queue Runner）v1

ユーザー要望（「優先度順にずーっと続ける」）を、v1では以下で実現する。

5.1 仕様

UIにトグル：Auto-run queue: ON/OFF

ON時の挙動

現在 running が無い

Next Request を選定

POST /api/requests/:id/run を実行

Runが DONE なら次へ

NEEDS_INPUT / FAILED なら停止し、該当requestを blocked に

5.2 停止条件（v1固定）

doctor FAIL

worktree dirty

NEEDS_INPUT

retry上限超過

guardrail違反（gh検知など）

6. Requestの “実行単位” と “完了定義”
6.1 実行単位

1 request = 1 planning = 1 run（原則）

ただし実装の都合で複数runに跨っても良い（resume/retry/replan）

6.2 done 判定（v1）

stage が DONE

report.md に「受け入れ条件チェック」セクションが存在し、全て ✅ になっている

人間（あなた）が総合テストでOKと判断したら、UIで status=done に変更する

7. UI仕様（Requests画面）
7.1 一覧（RequestsPage）

表示列：

priority（P0..）

status

title

labels

depends_on（未解決なら警告）

last_run（最新run-idと結果）

機能：

フィルタ（status/priority）

ソート（デフォルトは自動選定順）

“Next Request” のハイライト

7.2 詳細（RequestDetail）

Markdown編集

status/priorityの編集（メタ編集UI）

“Run” / “Resume” ボタン

“Mark as done” ボタン（最終は人間）

8. API（D21補足：Request運用）

最低限追加したいAPI（v1）：

GET /api/requests（一覧、解析済みメタ含む）

PUT /api/requests/:id（本文更新＋updated_at更新）

PATCH /api/requests/:id/meta（priority/status/labels/depends_on だけ更新）

GET /api/queue/next（Next Request を返す）

POST /api/queue/run-next（Nextを実行、Auto-runが使う）

9. 受け入れ基準（D35）

requestsが priority/status によってUIで管理できる

Next Request が一意に決まる（ルールが固定）

Auto-runで、doneなら次へ、needs_inputなら止まる

blockedの復帰（blocked→ready→resume/run）が運用できる

並列実行はしない（v1の安全運用）

次に作るべきは、Requestのメタ情報を Markdownの先頭から安全に読み書きする仕様を固定する D36. Requestメタ形式・パーサ仕様（壊れにくい書式／自動整形ルール） です。

