D6. UI仕様書 v1.1

対象：ローカルDevin風 開発代理システム（aiflow-local）
前提：ローカルのみ／SSOTは requests/*.md／状態はD2／ファイル仕様はD3／APIはD7

1. 目的

ブラウザUIで、以下を一貫した体験として提供する。

要望（Request）の作成・編集・優先度管理（P0〜P3）

実行制御（enqueue/stop/resume/rerun）と進捗監視（status/phase/step）

レポート（D5）だけで受け入れ判断できる表示設計

gh 非依存で compare URL を提示し、PR作成導線を用意

ローカル運用に最適化（トークン不要、セットアップ簡単、軽量）

2. 画面構成
2.1 画面一覧

Dashboard：一覧と優先度運用

Request Detail：要望・Plan・Report・実行制御・ログ

Create：新規作成（v1.1実装：タイトル＋Priorityのみ。本文は作成後に編集）

Doctor：環境チェック（任意だが推奨）

2.2 ルーティング

/ → Dashboard

/requests/new → Create

/requests/:id → Request Detail

/doctor → Doctor

3. 画面共通要件
3.1 表示するメタ情報

全画面で最低限、以下が参照できること（ヘッダまたはカードに表示）。

priority / title / status / updated_at

running の場合：phase / run_id（あれば）/ attempt（あれば）

3.2 バッジ定義

Status：queued | running | needs_input | failed | done

Priority：P0 | P1 | P2 | P3

ACステータス（Reportから抽出）：Met | Not Met | Partially Met | Blocked

3.3 ガード

status=running 中は Want編集不可（読み取り専用）

Plan/Reportは原則読み取り専用（監査性のため）

実行系ボタンは状態に応じて有効化し、二重送信を防止する

4. Dashboard仕様
4.1 目的

優先度順に要望を運用し、処理対象を即決できる

needs_input/failed を素早く解消する

4.2 レイアウト

上部：フィルタ、検索（任意）、更新インジケータ

中央：Request一覧（テーブルまたはカード）

下部または右：選択中Requestのクイック操作（任意）

4.3 一覧の列

必須列：

Priority

Title（クリックで詳細へ）

Status

Phase（running時のみ）

Updated

Actions（状態に応じたボタン）

推奨列：

Tags

Branch/Base（短縮表示）

4.4 ソート規則

デフォルトは以下のグルーピング＋ソート。

running

needs_input

queued

failed

done

各グループ内：

priority asc (P0→P3)

updated_at desc

4.5 操作

Run：POST /requests/{id}/enqueue

Stop：POST /requests/{id}/stop

Re-run：POST /requests/{id}/rerun

needs_input は Detail に誘導（ResumeはDetailのみでも可）

5. Create仕様
5.1 入力項目

必須：

Title

Priority（デフォルト P2）

任意：

Tags

Want（Markdown）

5.2 生成ルール

POST /requests

成功後：/requests/:id へ遷移（v1.1 UI実装では一覧をリロードして選択する）

Wantが空でもD3必須構造は満たす（見出し骨子は自動挿入してよい）

6. Request Detail仕様
6.1 目的

監督者が「要望→Plan→Report→次アクション」を短時間で判断できる

実行制御とログ監視を一画面で完結させる

6.2 レイアウト

推奨：2カラム

左（メイン）

タブ：Want / Plan / Report

各タブはMarkdown表示（Wantのみ編集可能条件あり）

右（サイド）

状態パネル：status / phase / run_id / attempt / base / branch

実行制御ボタン

ログビュー（running時）

needs_input回答パネル（needs_input時）

PR導線（done時）

6.3 ヘッダ表示

Title（編集：queued/failed/doneのみ）

Priority（編集：queued/failed/doneのみ）

Statusバッジ

Phase（runningのみ）

Updated at

Base / Branch

6.4 Wantタブ

Markdownエディタ（編集可能条件のみ）

保存：PATCH /requests/{id}

running時：read-only + 編集不可理由を明示

6.5 Planタブ

read-only

以下をUIで強調表示する

AC：チェックリスト表示（Plan文面から抽出できる範囲で）

Step Plan：S01/S02…を折りたたみ表示（Step単位で視認性を上げる）

PlanがD4品質ゲートに不合格っぽい場合は警告（例：Step数<3、Done条件不足など）

6.6 Reportタブ

read-only

D5必須セクションをサイド目次として表示し、クリックでジャンプ

AC一覧はバッジ化し、Evidence（根拠）を見やすくする

Next Actionsはチェックリスト表示（UI上のチェックは任意。ファイルへ反映はv1不要）

6.7 実行制御ボタン

状態別の表示・有効化は固定。

status	Primary	Secondary	備考
queued	Run	—	enqueue
running	Stop	—	中断要求
needs_input	Resume	—	回答必須
failed	Re-run	—	再実行
done	Open PR	Re-run（任意）	compare URLを開く

API：

Run：POST /requests/{id}/enqueue

Stop：POST /requests/{id}/stop

Resume：POST /requests/{id}/resume

Re-run：POST /requests/{id}/rerun

6.8 needs_input回答パネル

blocked_reason を上部固定表示

回答入力（Markdown）

送信 → resume

送信後はqueued相当になり、実行開始はRunnerに委ねる

6.9 ログビュー

running時は常時表示

優先：WebSocket（D7）
代替：ポーリング＋最新artifact参照

機能要件：

自動スクロール ON/OFF

コピーボタン

ERROR/WARN 強調

再接続（WS切断時の自動復帰）

phase/status更新イベントをUIに反映

7. Doctor仕様
7.1 目的

典型障害（WORKTREE_DIRTY、origin未設定、base不在、node/git不足）を即時特定する。

7.2 表示

チェック一覧（OK/NG）

NG項目ごとに推奨コマンドを提示（コピー可能）

8. データ取得と更新戦略
8.1 一覧更新

Dashboard：5〜10秒間隔のポーリング（GET /requests）

runningが存在する場合は間隔短縮（例：3秒）してよい

8.2 詳細更新

Request Detail：GET /requests/{id}

running中：WS接続が主、補助として10秒ごとに詳細再取得（整合性確保）

8.3 競合と整合性

更新操作後は必ず最新のRequest DTOを取り直して反映（楽観更新は最小限）

409系（ガード違反）はUI上で理由を明示する

9. エラー表示仕様
9.1 代表エラーとUI対応

WORKTREE_DIRTY：Detail上部にブロッカー表示、対処手順（stash/commit/clean）を提示

CANNOT_EDIT_WHILE_RUNNING：編集欄をread-onlyにし、Stop誘導

BASE_BRANCH_NOT_FOUND：base設定の見直しを提示（編集可能条件ならbase再設定導線を検討）

REMOTE_ORIGIN_MISSING：git remote add origin ... のガイド

9.2 共通エラーバナー

画面上部に固定表示

可能なら error.code を小さく表示（サポート容易化）

10. UIコンポーネントツリー

実装言語は問わないが、React想定の粒度で定義する。

10.1 ページ構成

AppShell

TopNav

SideNav

MainOutlet

10.2 Dashboard

DashboardPage

RequestFilterBar

RequestList

RequestRow（または RequestCard）

PriorityBadge

StatusBadge

PhaseBadge

RequestActions（Run/Stop/Re-run）

AutoRefreshIndicator

10.3 Create

CreateRequestPage

RequestForm

TitleInput

PrioritySelect

TagsInput

MarkdownEditor（Want）

SubmitButton

10.4 Request Detail

RequestDetailPage

RequestHeader

TitleEditable（条件付き）

PriorityEditable（条件付き）

StatusBadge

PhaseBadge

BranchInfo

OpenPrButton（doneのみ）

TwoPaneLayout

LeftPane

TabbedDocView

WantTab

MarkdownEditor（条件付き）

SaveButton

PlanTab

PlanOutline

StepAccordion

ReportTab

ReportToc

ReportSections

ReportSummary

ReportAcList

ReportSteps

ReportTests

ReportChanges

ReportRisks

ReportNextActions

RightPane

RunControlPanel

NeedsInputPanel（needs_inputのみ）

LogViewer（runningのみ）

ArtifactsLinks（任意）

10.5 Doctor

DoctorPage

DoctorRunButton

DoctorResults

DoctorCheckRow

11. 受け入れ基準

Create → Detail が成立し、D3形式のRequestが作成される

Dashboardで優先度順に並び、Run/Stop/Re-run が動く

Detailで running 中のログが追える（WS優先、代替あり）

needs_input で質問が見え、回答→Resumeできる

done で Open PR が compare URL を開く

running中の要望編集が防止される

必要なら、このD6をそのまま実装に落とせるように、次は D10（Runner内部フェーズ仕様） か D11（設定仕様：ポート、ディレクトリ、実行プロファイル） を作るのが最短です。
