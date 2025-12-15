D38. Request→Runリンク仕様（latest_run／done時メタ更新／blocked復帰）v1.0

対象：requests/*.md と runs/<request-id>/<run-id>/ の関連付け
目的：UIで「この要望の最新Run」「今の状態（ready/running/blocked/done）」を一貫して表示し、運用（D35）を回せるようにする。
前提：ローカル完結／gh禁止／git依存OK／requestsはGit管理、runsは非管理。

1. SSOTの整理（v1）

Requestの状態（priority/status 等）：SSOTは requests/<id>.md のメタ

Runの状態（stage/errors/report 等）：SSOTは runs/<id>/<run-id>/stage.json

“リンク情報” は 原則 runs から導出（requestsにrun-idを埋め込まない方針）

理由：runsはgitignoreされるため、requestsにrun-idを書き込むと「Git履歴に揺れ」が出る。

2. Runの識別子（run-id）仕様（v1）
2.1 run-id形式

RUN-YYYYMMDD-HHMMSS-<shortid>（JST基準）

例：RUN-20251214-142233-a3f9

2.2 Runディレクトリ

runs/<request-id>/<run-id>/

3. latest_run の決定ルール（v1）

UI/APIで latest_run を表示するために、以下の優先順位で決定する。

3.1 latest_run（定義）

runs/<request-id>/ 配下の run-id を収集し、各 run の stage.json を読み取る

“最新” は単純に作成時刻ではなく、次のルールで決める

3.2 優先順位（v1固定）

state が INIT|PLANNING|IMPLEMENTING|TESTING|REPORTING の Run（= 実行中）

複数ある場合：最も新しい started_at

次に state が NEEDS_INPUT の Run（= 止まっている）

複数ある場合：最も新しい history の NEEDS_INPUT event時刻

次に state が FAILED の Run

複数ある場合：最も新しい finished_at

最後に DONE の Run

複数ある場合：最も新しい finished_at

v1では同一requestで同時runを禁止（D24/D34）なので、1)は基本1つのはずだが、安全のため定義する。

4. Request一覧で表示する派生フィールド（v1）

API GET /api/requests は、各requestに以下の派生を付与して返す。

json
{
"id": "RQ-...",
"meta": { "priority": "P1", "status": "ready", ... },
"title": "Bootstrap: aiflow-local v1",
"derived": {
"latest_run": {
"run_id": "RUN-...",
"state": "NEEDS_INPUT",
"reason_code": "UNIT_TEST_FAILED",
"finished_at": "..."
},
"queue_eligible": true,
"blocked_by": ["RQ-..."]
}
}

4.1 queue_eligible（D35連携）

status=ready かつ depends_on が全て done なら true

それ以外は false

5. status と run.state の整合（v1）

requests の status と run の state は一致しない場合があるため、整合ルールを定義する。

5.1 自動整合（v1の最小）

aiflowが 自動で status を書き換えて良い のは以下のみ（限定運用）。

Run開始時：ready → running

Runが NEEDS_INPUT：running → blocked

done はあなたが総合テストで判断するので、aiflowは自動で done にしない。

5.2 自動で書き換えない

done（人間の承認が必要）

archived（運用判断）

draft（編集途中）

blocked → ready（人間が介入し、再実行可能になった時点で戻す）

6. done判定とメタ更新（v1）
6.1 doneにする条件（運用）

latest_run.state が DONE（推奨だが必須ではない）

report.md の ACチェックが揃い、あなたが総合テストでOKと判断

6.2 doneにしたときのメタ更新（UI操作）

PATCH /api/requests/:id/meta

status: done

updated_at: today

（任意）labels に accepted を付ける等は運用で決めてよい

7. blocked復帰（blocked → ready）仕様（v1）
7.1 復帰の条件

latest_run.state が NEEDS_INPUT で止まっている

あなたが Next Actions を対応済み（例：worktree clean、依存導入、ファイル補完など）

7.2 復帰フロー（v1）

UIで request を開く

status を ready に戻す（手動）

Run詳細画面で Resume or Retry step（D34）

どちらにするかは reason_code に依存

running に自動遷移（Run開始時の自動整合）

8. “Run完了時” の扱い（v1）

Runが DONE になったら：

request.status が running の場合のみ、自動で ready に戻す を許可するか検討する

v1推奨：

自動では戻さない（running のままだと混乱するため、DONE後は ready に戻すのはアリ）

ただし “done” は人間判断なので、v1は以下にするのが安全

v1安全案

running のままにせず、ready に戻す（自動）

理由：次のrequestを回す運用（D35 Auto-run）で「runningがあると止まる」ため

ただし UIで “このrequestは完了候補” を表示して、人間が done にする導線を用意

つまり：RunがDONE → request.status は ready に戻す（自動）＋ UIで “Mark as done” を促す

9. API追加（D21補足）

GET /api/requests/:id/runs：run一覧（state/finished_at/reason_codeだけ軽量で返す）

GET /api/requests/:id/latest-run：latest_runを返す（UI簡略化用）

10. 受け入れ基準（D38）

UIで request と最新runの状態が一貫して見える

running/blocked の自動遷移が最小で安全に動く

done は必ず人間が決められる（自動でdoneにならない）

Auto-run運用（D35）で “runningが残って止まる” 状態を避けられる

次に作るべきは、Auto-runを安全にするための D39. 並列実行・ロック仕様（同一requestの排他／全体キューの排他／UI表示） です。

