D60. Auto-run 制御仕様（連続実行・停止条件・排他・UI操作・復帰）v1.0

対象：aiflow-local の Auto-run（優先度順に次々Runする機能）
目的：requests が積み上がった状態で「放置しても回る」一方、事故や無限ループを防ぎ、止まったら必ず復帰できるようにする。
前提：Next Request（D59）／ロック（D39）／Doctor（D32）／stage（D56）／errors（D58）／Run再開（D34）／gh禁止／git依存OK。

1. Auto-run の定義（v1）

Auto-run とは：
Next Request（D59）を繰り返し選び、1件ずつRunを開始し、終了まで待って次へ進む連続実行モード

v1では 並列実行しない（同時に1 Run）

Auto-run は「キュー実行」であり、個別Run起動（手動Run）と共存する

2. 排他（Queue Lock）仕様（必須）
2.1 Queue Lock の目的

Auto-run が複数起動される事故（UI多重クリック等）を防ぐ

Auto-run と手動Runの同時実行競合を避ける（v1は安全側）

2.2 取得タイミング

Auto-run 開始時に 必ず queue lock を取得

取得できなければ開始不可（UIに理由表示）

reason_code：QUEUE_LOCKED

2.3 解放タイミング

Auto-run 停止時（正常終了／停止条件到達／ユーザー停止）に解放

プロセス異常終了で解放されない場合に備え TTL を持つ（D39）

3. 開始前チェック（Gate）

Auto-run は開始前に以下を満たす必要がある（v1推奨だが実装は容易）。

3.1 Doctor Gate（推奨）

Doctorで FAIL が1つでもあれば開始不可

reason_code：DOCTOR_FAILED

WARNのみなら開始可能（UIに警告表示）

3.2 Git Gate（必須）

worktree clean（dirtyなら開始不可）

reason_code：WORKTREE_DIRTY

base_branch が存在する

reason_code：BASE_BRANCH_NOT_FOUND

4. 実行モデル（状態機械）

Auto-run 自体も状態を持ち、UIが現在地を表示できるようにする。

4.1 Auto-run state（v1）
state	説明
IDLE	未実行
STARTING	lock取得・事前チェック
SELECTING	Next Request選定中
RUNNING	子Runを実行中（待機/poll含む）
STOPPING	停止処理（lock解放等）
STOPPED	停止（理由あり）
COMPLETED	runnableなしで自然終了
4.2 表示用情報（UI）

current_request_id（実行中のrequest）

current_run_id（実行中のrun）

last_result（DONE/FAILED/NEEDS_INPUT）

counters（成功/失敗/要対応件数）

stop_reason（reason_code/actions）

5. Auto-run ループ仕様（v1）
5.1 1サイクルの手順（決定的）

SELECTING：Next Request を選定（D59）

Next が null → COMPLETED（終了）

RUNNING：選ばれた request に対して Run を開始（POST run）

request lock が取れない等で開始できない場合

そのrequestをスキップし、次を選ぶ（ただし無限スキップ防止）

子Run の stage.json.state を poll し、DONE/FAILED/NEEDS_INPUT になったら結果確定

結果に応じて counters を更新し、停止条件を評価

停止しないなら次サイクルへ

6. 停止条件（v1固定案）

Auto-run が「勝手に止まらない」だけだと危険なので、明確な停止条件を持つ。

6.1 必須停止条件（Hard stop）

NEEDS_INPUT が発生 → 即停止（v1推奨）

理由：人間介入が必要な状態を跨いで回すと、失敗を連鎖させやすい

FAILED が発生 → 即停止（v1推奨）

理由：環境や契約崩壊の可能性があり、連鎖を防ぐ

将来（v1.1）で「軽微FAILEDは継続」などの緩和は可能だが、v1は安全側。

6.2 任意停止条件（Soft stop）

実行回数上限：例 max_runs_per_session（デフォルト 20）

実行時間上限：例 max_duration_min（デフォルト 60）

連続スキップ上限：例 max_consecutive_skips（デフォルト 5）

7. スキップ仕様（詰まり回避）

以下の理由でRun開始できない request は「スキップ」して次へ進める（ただし上限あり）。

スキップ理由例（reason_code）

REQUEST_LOCKED（別Run中）

DEPENDS_NOT_DONE（依存未完）

LATEST_RUN_NEEDS_INPUT（防衛）

REQUEST_NOT_FOUND（ファイル消失）

スキップの扱い

スキップしたrequestは、そのサイクルでは候補から除外して次選定

max_consecutive_skips を超えたら停止（「キューが詰まっている」）

8. UI操作（MVP）
8.1 ボタン

Start Auto-run：開始

Stop：停止要求（signals.stop_requested = true 相当）

Open Current Run：実行中run詳細へ遷移

Show Stop Reason：停止理由（reason_code/actions）表示

8.2 停止要求の扱い（v1）

Stop押下→Auto-run state を STOPPING にし、現在の子Runは

v1では「最後まで待つ」でも良い（安全）

可能ならRunner側で「キャンセル」対応（v1.1）

9. 失敗時の復帰（必須）

Auto-run が止まったら、ユーザーが次に何をすべきかを必ず提示する。

9.1 NEEDS_INPUT の場合

画面に errors.json の actions を表示

Open Request（該当requestの編集画面へ）

Rerun（新runとして再実行）ボタン（v1はrerun推奨、resumeは任意）

9.2 FAILED の場合

Open Logs（重要ログへ）

Run Doctor（環境再チェック）

直前Runの report を見て、差し戻しor修正依頼へ繋げる

10. 設定（.aiflow/config.v1.json に持つ想定）

Auto-run は設定で制御できる（v1推奨：静的設定）。

例：

json
{
"auto_run": {
"enabled": true,
"stop_on_needs_input": true,
"stop_on_failed": true,
"max_runs_per_session": 20,
"max_duration_min": 60,
"max_consecutive_skips": 5,
"poll_interval_ms": 800
}
}

11. 受け入れ基準（D60）

Auto-run は queue lock により二重起動できない

Next Request 選定（D59）に従い、1件ずつ確実に回る

NEEDS_INPUT/FAILED で安全に停止し、復帰手順（actions）が必ず提示される

スキップが無限ループしない（上限で止まる）

UIから開始/停止/現在Run参照ができる

次は、Auto-run と密接な「UIの契約」を固めるために D61. Requests一覧UI仕様（表示項目・フィルタ・Next表示・Auto-run操作） を作るのが順番として自然です。