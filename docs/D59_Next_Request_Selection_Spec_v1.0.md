D59. Next Request 選定仕様（優先度キュー・depends_on・blocked回避・自動継続）v1.0

対象：aiflow-local の「次に実行する request を決める」ロジック（UI/Server共通）
目的：requests/*.md を積み上げた状態で、優先度順に止まらず回り続ける運用（D35）を機械化する。
前提：requestメタ（D36）／Runリンク（D38）／ロック（D39）／state（D56）／errors（D58）／gh禁止／git依存OK。

1. 用語

Candidate：次実行候補になり得る request

Runnable：今すぐ実行可能な request（depends_on満たす・blockedでない等）

Next Request：Runnable の中から選ばれた「次に実行する1件」

2. 入力（SSOT）

requests/*.md（SSOT：priority/status/depends_on/labels/updated_at など）

runs/<request-id>/*/stage.json（最新Runの state を参照）

ただし runs はgitignoreのため「存在しない」ことがある。存在しない場合は「未実行」として扱う。

3. 対象ステータス（v1）
3.1 自動実行対象

status: ready のみ（v1固定）

3.2 除外

draft：未準備

running：実行中（UI表示のみ）

blocked：人間対応待ち（NEEDS_INPUTなど）

done：完了

archived：対象外

4. 並び順（優先度キュー）ルール
4.1 優先度順（固定）

P0 → P1 → P2 → P3

4.2 同一優先度内の順序（v1推奨）

次のキーで昇順（＝古いものから先に処理）：

updated_at（古い順）

created_at（古い順）

id（辞書順）

理由：更新が古い“積み残し”から崩すと、詰まりが減る。

5. depends_on 解決（v1）
5.1 depends_on の意味

depends_on: [RQ-..., RQ-...] がある場合、依存先がすべて完了していないと実行不可

5.2 依存先の「完了」判定

次のいずれかを満たせば OK（v1固定）

依存先 request の status: done

※ runs の state=DONE だけでは「完了」扱いにしない（requestsがSSOTのため）

5.3 依存先が見つからない場合

判定：実行不可（NOT_RUNNABLE）

取り扱い：Candidate から除外し、UIに理由を表示（reason_code相当を付与）

6. blocked 回避（v1）
6.1 request.status=blocked は絶対に選ばない

readyのみが対象のため自明

6.2 最新Runが NEEDS_INPUT の場合

原則：request を blocked に更新する運用が推奨（D38）

ただし、requestが ready のまま残っている可能性があるため防衛する

latest_run.state == NEEDS_INPUT を検出した場合は Runnableから除外（実行しない）

7. 実行中回避（安全策）

requestが running でなくても、lockファイルが存在する場合は除外

request lock（D39）が存在 → そのrequestは「実行中」扱い

queue lock（D39）が存在 → Auto-run自体を開始しない

8. Next Request 選定アルゴリズム（仕様）
8.1 手順（決定的）

requests/*.md を全件ロードし、メタをパース（D36）

status=ready のみ抽出し Candidate を作る

各Candidateについて runnable = true/false を評価

depends_on が全て done か

request lock が無いか
-（任意防衛）latest_run が NEEDS_INPUT ではないか

Runnable だけ残す

Runnable を 優先度→updated_at→created_at→id でソート

先頭を Next Request とする

Runnable が 0 件なら null（UIは「実行可能なrequestなし」を表示）

8.2 出力（UI/API向け）

NextRequestResult（例）

json
{
"next": {
"request_id": "RQ-20251214-008",
"priority": "P0",
"status": "ready",
"title": "Bootstrap: aiflow-local v1",
"path": "requests/RQ-20251214-008.md"
},
"stats": {
"total": 42,
"ready": 7,
"runnable": 3
},
"excluded": [
{
"request_id": "RQ-20251214-010",
"reason_code": "DEPENDS_NOT_DONE",
"detail": "depends_on: RQ-20251214-009 is not done"
}
]
}

9. reason_code（選定時の除外理由）v1

UIで「なぜ次に回らないか」を説明するため、選定ロジック用の reason_code を定義する（D47に統合してよい）。

reason_code	意味
NOT_READY	statusがreadyではない
DEPENDS_NOT_DONE	depends_onが未完了
DEPENDS_NOT_FOUND	depends_onの参照先が存在しない
REQUEST_LOCKED	request lock が存在（実行中）
QUEUE_LOCKED	queue lock が存在（自動実行開始不可）
LATEST_RUN_NEEDS_INPUT	最新RunがNEEDS_INPUT（防衛）
10. Auto-run（連続実行）仕様（v1）
10.1 Auto-run の開始条件

queue lock を取得できること（D39）

DoctorがFAILの場合は開始不可（推奨：D32）

10.2 Auto-run のループ

Next Request を選定（D59）

1件だけ POST /api/runs 相当でRun開始

Runが DONE/FAILED/NEEDS_INPUT になるまで待機（poll）

次のNext Requestを再選定して継続

Runnableが0件なら停止

10.3 停止条件（v1推奨）

連続 NEEDS_INPUT が N 回（例：2回）発生したら停止（無限詰まり防止）

連続 FAILED が N 回（例：1回）発生したら停止

11. 受け入れ基準（D59）

readyの中から、depends_on/lock/needs_input を考慮して 決定的に1件を選べる

「なぜ選ばれないか」を excluded.reason_code で説明できる

Auto-run が「止まるべき時に止まり、回るべき時に回る」

requestがrunsに依存しすぎず（runs欠損でも）破綻しない

次は、Auto-run の安全弁を完成させるために D60. Auto-run 制御仕様（queue lock・停止条件・UI操作・失敗時復帰） を作るのが最短距離です。

