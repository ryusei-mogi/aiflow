D34. Run再開仕様（Resume：再実行位置／再planning条件／リトライ上限）v1.0

対象：aiflow-local Runner / Server / UI の “止まっても続けられる” 仕組み
目的：NEEDS_INPUT で止まったRunを、同じRunとして再開または新Runとして再実行できるようにし、手戻りを最小化する。
前提：ローカル完結／gh禁止／gitはOK／トークン不要／Step細分化前提（D26）。

1. 用語

Run：runs/<request-id>/<run-id>/ に出力される1回の試行

Resume：同一run-idで、途中のStepから再開すること

Retry：同一Stepを同一Run内でやり直すこと（role再実行含む）

Replan：planning.json を作り直してStep構造を変えること（通常は新Run推奨）

2. 再開の基本方針（v1）
2.1 原則

NEEDS_INPUT は Resume可能（人間が条件を満たしたら続行）

FAILED は 原則新Run（ただしv1ではResumeも許可して良い）

2.2 再開単位

再開は Step単位（D26の steps[]）

Runnerは current_step_index をSSOTとして持つ（stage.jsonに保存）

3. stage.json（SSOT）の追加フィールド（v1）

D22のstageに以下を追加・厳密化する。

json
{
"version": "1.0",
"request_id": "RQ-...",
"run_id": "RUN-...",
"state": "INIT|PLANNING|IMPLEMENTING|TESTING|REPORTING|DONE|NEEDS_INPUT|FAILED",
"current_step_index": 2,
"current_step_id": "S03",
"attempts": {
"planning": 1,
"steps": {
"S01": { "implementer": 1, "qa": 0, "tests": 0 },
"S03": { "implementer": 2, "qa": 1, "tests": 1 }
}
},
"error": {
"category": "EXECUTION",
"reason_code": "UNIT_TEST_FAILED",
"summary": "単体テストが失敗しました"
},
"history": [
{ "at": "ISO", "event": "STEP_DONE", "step_id": "S01" },
{ "at": "ISO", "event": "NEEDS_INPUT", "step_id": "S03", "reason_code": "UNIT_TEST_FAILED" }
]
}

4. Resume API（D21拡張）
4.1 エンドポイント

POST /api/requests/:id/runs/:runId/resume

4.2 Request（v1）
json
{
"mode": "resume|retry_step|replan",
"target_step_id": "S03 (optional)",
"force": false
}

4.3 modeの意味

resume：stageの current_step_id から続行（デフォルト）

retry_step：指定Stepを最初からやり直す（同Stepの成果物を上書き）

replan：planning.json を作り直し、以後は 新Runを推奨（v1では同Runでも可だが危険）

5. 再開時の前処理（v1固定）

Resume実行前に必ず以下を行う：

POST /api/doctor?mode=quick 相当を内部実行

FAILなら Resumeせず NEEDS_INPUT のまま、errors.json更新

WORKTREE_DIRTY はFAIL（v1）

Runロック（同一request二重run禁止）確認

6. “どこから再開するか” の決定ルール
6.1 default（mode=resume）

current_step_id から再開

current_step_id が存在しない場合：

planningが無ければ PLANNING から

それ以外は S01 から

6.2 失敗の種類別の推奨再開点
reason_code	推奨	実際の再開
JSON_PARSE_ERROR / JSON_SCHEMA_INVALID	同Stepの同roleを再実行（retry）	retry_step（同step）
STEP_TOO_LARGE	Replan必須	replan（新Run推奨）
UNIT_TEST_FAILED	失敗を修正→同Stepから	retry_step（同step）
E2E_TEST_FAILED	UI/フロー修正→同Stepから	retry_step
WORKTREE_DIRTY	人間がclean→同Stepから	resume
ORIGIN_MISSING/REMOTE_NOT_GITHUB	compare不要なら継続	resume
RUN_IN_PROGRESS	待つのみ	Resume不可
7. Replan条件（v1）

Replan（planning作り直し）を要求する条件：

reason_code が STEP_TOO_LARGE

2回連続で “同Stepで同じ reason_code” が出る（無限ループ兆候）

targets.paths が広すぎて diff爆発が継続

UI/Server/Runnerが同Stepに混在し、収束しない

Replan時の方針：

v1は 新Run作成 が原則

既存runは “失敗Run” として reportを残してクローズ

8. リトライ上限（v1）
8.1 ロール単位

Planner：最大2回（D32/D33の方針）

Implementer：最大2回

QA：最大2回

上限超過時：

自動で NEEDS_INPUT（reason_code=RETRY_LIMIT_EXCEEDED）
※messagesに追加が必要（v1で追加推奨）

8.2 Step全体の上限

同一Stepの retry は最大3回

超えたら replan 推奨

9. 成果物の上書きルール（v1）
9.1 retry_step

runs/<...>/logs/step-<n>.log は 追記（append）

errors.json は最新で 上書き

report.md は “追記”（最下部に Retry履歴を残す）

9.2 resume

既存成果物を維持し、続きから追記

9.3 replan

新Runが原則（run-idが変わる）

UI上では “このRunは replan により置き換え” リンクを表示

10. UI仕様（再開操作）

Run詳細画面に以下を表示：

状態が NEEDS_INPUT のとき

[Resume]（デフォルト）

[Retry this Step]

[Replan]（警告付き、基本は新Runを作る）

直近の reason_code と Next Actions を常に表示（D33）

11. 受け入れ基準（D34）

NEEDS_INPUT のRunがUIから再開できる

再開時にdoctor quickが必ず走り、危険状態で再開しない

retry_step / resume / replan の挙動が一貫している

無限ループ（同Step繰り返し）が上限で止まり、replanに誘導される

次に作るべきは、Runを “継続的に回す” ための D35. Request運用仕様（優先度キュー・ステータス遷移・自動選定ルール） です。これがあると「requestsを優先度順にずーっと続ける」が実装しやすくなります。

