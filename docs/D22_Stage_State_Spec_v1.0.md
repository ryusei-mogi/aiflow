D22. stage.json 状態遷移仕様（State/Stage Spec）v1.0

対象：aiflow-local Runner（CLI/Server）と UI（進行表示）
目的：Runの進行状況を ブレなく可視化 し、途中停止（needs_input/failed）や反復（Step分割）も表現できるようにする。
前提：SSOTは runs/<request-id>/<run-id>/stage.json。UIはこれをpollして表示。

1. 設計方針

stageは 「現在地」と「履歴」 の両方を保持する

v1は最小限のstateを固定し、拡張は meta や steps[] に逃がす

UIは stateを知っていれば描画できる（文言はメッセージ辞書に寄せても良いが、v1はstageのtitleで十分）

Step反復に対応：steps[] に step単位の状態を保持し、current_step_index で現在位置を示す

2. ファイル位置

runs/<request-id>/<run-id>/stage.json

3. stage.json スキーマ（v1）
3.1 ルート
json
{
"version": "1.0",
"request_id": "RQ-...",
"run_id": "20251214-133000-8f3a2c",
"state": "INIT|DOCTOR_RUNNING|DOCTOR_BLOCKED|PLANNING|STEP_RUNNING|TESTS_RUNNING|PUSHING|EVALUATING|REPORTING|DONE|NEEDS_INPUT|FAILED",
"started_at": "2025-12-14T13:30:00+09:00",
"updated_at": "2025-12-14T13:31:10+09:00",
"progress": {
"percent": 42,
"message": "planning: steps=4"
},
"current_step_index": 1,
"steps": [],
"artifacts": {
"context": "runs/.../quality_context.json",
"errors": "runs/.../errors.json",
"report": "runs/.../report.md",
"logs_dir": "runs/.../logs/"
},
"result": {
"status": "running|done|needs_input|failed",
"reason_code": "",
"severity": "",
"compare_url": ""
}
}

4. State一覧（v1固定）

UIはこのstateに応じて「今どこか」を表示する。

実行前〜準備

INIT：run生成直後（ディレクトリとstage生成）

DOCTOR_RUNNING：doctor実行中

DOCTOR_BLOCKED：doctorで停止（needs_input相当の前段）

計画〜反復

PLANNING：request解析・Step分割（見積もり、too_large判定含む）

STEP_RUNNING：Step実行中（Step反復の中）

TESTS_RUNNING：unit/e2e 実行中

仕上げ

PUSHING：git branch/push/compare URL生成

EVALUATING：Quality Gate評価（done/needs_input/failedの確定）

REPORTING：report生成・requests追記

終端

DONE：完了（result.status=done）

NEEDS_INPUT：入力待ち（result.status=needs_input）

FAILED：失敗（result.status=failed）

注意：DOCTOR_BLOCKED はUI表示を丁寧にするために分けているだけで、最終的には NEEDS_INPUT に遷移して終了してOKです。

5. steps[]（Step反復の表現）
5.1 Stepオブジェクト
json
{
"index": 0,
"title": "S01: tools/aiflow の雛形作成",
"status": "pending|running|done|needs_input|failed|skipped",
"attempt": 1,
"diff_estimate": {
"max_lines": 280,
"max_files": 8
},
"started_at": "2025-12-14T13:31:00+09:00",
"ended_at": "",
"notes": "",
"artifacts": {
"log": "runs/.../logs/step-0.log"
}
}

5.2 Step分割の最低要件

steps.length >= 2 を原則（長くなって止まる問題の回避）

planner.step.too_large=true になる場合は Stepを増やす（3〜5推奨）

6. 典型的な状態遷移（v1）
6.1 正常完了（done）

INIT → DOCTOR_RUNNING → PLANNING → STEP_RUNNING → TESTS_RUNNING → PUSHING → EVALUATING → REPORTING → DONE

6.2 実行前条件で停止（needs_input）

INIT → DOCTOR_RUNNING → DOCTOR_BLOCKED → REPORTING → NEEDS_INPUT

6.3 テスト失敗（failed）

... → TESTS_RUNNING → EVALUATING → REPORTING → FAILED

7. progress（UI表示の簡易ルール）

progress.percent は 推定でOK（正確性より体感）

v1の推奨目安

INIT: 0

DOCTOR_RUNNING: 5〜15

PLANNING: 15〜30

STEP_RUNNING: 30〜70（Step数に応じて分配）

TESTS_RUNNING: 70〜85

PUSHING: 85〜92

EVALUATING: 92〜96

REPORTING: 96〜99

DONE/NEEDS_INPUT/FAILED: 100

8. result の扱い（D17/D18連携）

EVALUATING で .aiflow/quality-gates により result.status を確定

result.reason_code は D18-B辞書キーに一致

NEEDS_INPUT/FAILED の場合は runs/.../errors.json を生成（辞書からtitle/summary等を展開）

DONE の場合は errors.json を作らず、reportに compare URL と手動総合テストを必ず記載

9. 受け入れ基準（D22）

stateが固定され、UIはstateだけで進捗表示できる

Step反復が steps[] で表現できる

終端状態（DONE/NEEDS_INPUT/FAILED）に必ず到達し、resultが確定する

reportとerrorsがD17/D18と矛盾しない

次に進めるなら、D21/D22を実装に落とすための D23. UI画面仕様（Wireframe + コンポーネント）v1 を作成できます。

