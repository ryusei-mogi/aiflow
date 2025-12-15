D23. UI画面仕様（Wireframe + コンポーネント）v1.0

対象：aiflow-local UI（Vite + React 想定）
目的：ブラウザで「requests編集→Run→進捗→結果（report/errors/compare URL）」を最短で成立させる。
前提：APIはD21、進行はD22（stage.json poll）、文言は可能ならD18-B辞書で補完。

1. 画面一覧（v1固定）

Requests一覧画面（/）

Request詳細・編集画面（/requests/:id）

Run詳細画面（/requests/:id/runs/:runId）

Doctor画面（/doctor）※v1ではヘッダーメニューから遷移（任意）

v1は “単一ページで全部” でも良いが、実装/保守性のために上記4画面に分割する。

2. グローバルUI要件

ヘッダー

左：aiflow-local

右：Doctor、設定（v1は省略可）

レイアウト

PC前提（モバイル最適化不要）

ポーリング

Run中：GET stage を 1〜2秒間隔

Run完了：10秒に1回または停止（UIが画面滞在中のみ）

3. 画面仕様
3.1 Requests一覧（/）
目的

priority順に requests を並べ、1クリックで編集/実行へ

表示要素（Wireframe）
css
[Header]
[Toolbar]  [New Request]  [Search box]  [Filter: priority]

[List]
- [P0] RQ-...  Title...         [status badge] [Latest run badge] [Open]
- [P1] ...

カラム（最低限）

Priority（P0〜P3）

ID

Title

Status（draft/ready/running/blocked/done：v1は推定でもOK）

Latest Run（running/done/needs_input/failed）

Updated at

アクション

Open（詳細へ）

New Request（テンプレから作成：POST /api/requests）

使用API

GET /api/requests

POST /api/requests

受け入れ基準

priority順で表示される（P0が最上位）

Openで詳細に遷移できる

New Requestでファイルが作られ、一覧に追加される

3.2 Request詳細・編集（/requests/:id）
目的

Request Markdown を編集し、Runを開始できる

表示要素（Wireframe）
css
[Header]
[Breadcrumb] Requests > RQ-...

[Top Bar]
[ID][Priority][Status]                 [Run] [Save] [Open Latest Run]

[Main]
[Left: Editor (Markdown)]
[Right: Preview (rendered Markdown)]   (v1は省略可。EditorのみでもOK)

[Bottom: Latest Run Summary (if exists)]
- run_id / status / reason_code / compare_url
- [View Run Details]

入力・編集

Editor：textarea でOK（Monaco等はv2以降）

Save：PUT /api/requests/:id

競合：409が返ったら「最新を読み直す」導線のみ（v1は十分）

Run開始

Run：POST /api/requests/:id/run

Run開始後は自動で最新Run詳細へ遷移（UX良）

使用API

GET /api/requests/:id

PUT /api/requests/:id

POST /api/requests/:id/run

GET /api/requests/:id/runs/latest

受け入れ基準

編集→保存ができる

Run押下でrunが開始され、Run詳細へ移動できる

latest runの結果（status/compare_url）が見える

3.3 Run詳細（/requests/:id/runs/:runId）
目的

D22 stage をポーリングして進捗表示し、report/errors/context を閲覧できる

表示要素（Wireframe）
sql
[Header]
[Breadcrumb] Requests > RQ-... > Run 20251214-...

[Summary]
- status badge (running/done/needs_input/failed)
- state (D22)
- progress bar (% + message)
- reason_code (if any) / severity
- compare_url (if any) [Open]

[Tabs]
(1) Progress
- steps list (index/title/status/attempt)
- current step highlight
(2) Report
- report.md rendered
(3) Errors (if exists)
- title/summary/detail/actions (from errors.json)
- copy commands buttons
(4) Context (debug)
- quality_context.json viewer (pretty print)

挙動詳細

Run中は stage をpoll

終端（DONE/NEEDS_INPUT/FAILED）になったら

report を取得して表示

errors があれば取得して表示

compare_url があればリンク表示

使用API

GET /api/requests/:id/runs/:runId/stage

GET /api/requests/:id/runs/:runId/report

GET /api/requests/:id/runs/:runId/errors（404なら非表示）

GET /api/requests/:id/runs/:runId/context

受け入れ基準

stageのstate/progress/stepsがUIに反映される

report.md を閲覧できる

errors.json がある場合、reason_codeに基づく次アクションが分かる

compare URL が表示され、ワンクリックで開ける

3.4 Doctor（/doctor）
目的

実行前条件を満たしているかをUIから確認できる

表示要素（Wireframe）
css
[Header]
[Doctor]
[Run Doctor]

[Result]
- status PASS/WARN/FAIL
- summary counts
- checks list

使用API

POST /api/doctor

受け入れ基準

UIからdoctorを実行でき、結果が表示される

4. Reactコンポーネント構成（最小）

AppLayout

RequestsPage

RequestList

RequestListItem

RequestDetailPage

RequestMetaBar

MarkdownEditor

LatestRunCard

RunDetailPage

RunSummaryCard

ProgressPanel（steps）

ReportPanel

ErrorsPanel

ContextPanel

DoctorPage

DoctorResult

5. 状態管理（v1推奨）

v1は React useState + fetch で十分（Redux不要）

pollingは setInterval を画面マウント中だけ動かす

取得失敗時は “再試行” ボタンのみ（エラーをため込まない）

6. UXの最小ルール（v1）

“Run中” はボタン無効化（同一requestで二重実行を避ける）

needs_input の場合

Errorsタブを自動で開く

actions（cmd）をコピーしやすくする（コピーボタン）

done の場合

compare_url を目立たせる

“手動総合テスト” チェックリスト（reportから表示）

7. 受け入れ基準（D23）

Requests一覧 → 詳細編集 → Run → Run詳細（進捗/結果）まで到達できる

needs_input のとき、何をすれば再実行できるかUI上で分かる

done のとき、compare URL と report がすぐ確認できる

次に作るべきは、D23を実装に落とす際に詰まりやすい D24. Server実装仕様（ファイルI/O・Run起動・排他制御）v1 です。必要なら続けて作成します。

