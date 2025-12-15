D33. エラー分類・reason_code運用仕様（NEEDS_INPUTルール／report追記形式）v1.0

対象：aiflow-local Runner / Server / UI のエラー取り扱い
目的：Runが止まったときに 「何が起きたか／何をすれば復帰できるか」 を統一フォーマットで残し、反復運用できるようにする。
前提：ローカル完結／gh禁止／gitはOK／トークン不要（Node側でキー保持しない）。

1. エラーの分類（v1）

Run中の異常は、必ず次のいずれかに分類する。

1.1 分類（category）

ENVIRONMENT：環境不足（node/git/CLI未導入、パス不備）

INPUT：request内容不足／矛盾（ただしユーザーに質問しない運用のため、基本はassumptionで進める）

CONTRACT：LLM出力が壊れた／schema不一致

EXECUTION：テスト失敗、パッチ適用失敗、コマンド失敗

GUARDRAIL：禁止事項（gh依存など）に抵触

UNKNOWN：上記に当てはまらない

2. reason_code（v1辞書：最小セット）

D31 messages に定義済みをSSOTとして扱う。v1で必須の reason_code は以下。

2.1 Contract系

JSON_PARSE_ERROR（category=CONTRACT）

JSON_SCHEMA_INVALID（category=CONTRACT）

2.2 Run管理

RUN_IN_PROGRESS（category=EXECUTION）

2.3 Git/Remote

GIT_NOT_REPO（category=ENVIRONMENT）

WORKTREE_DIRTY（category=ENVIRONMENT）

ORIGIN_MISSING（category=ENVIRONMENT）

REMOTE_NOT_GITHUB（category=ENVIRONMENT）

2.4 Planning/Step

STEP_TOO_LARGE（category=INPUT もしくは EXECUTION）

2.5 テスト

UNIT_TEST_FAILED（category=EXECUTION）

E2E_TEST_FAILED（category=EXECUTION）

2.6 Guardrail

GH_DEPENDENCY_DETECTED（category=GUARDRAIL）
※D31 messages には未追加なので、v1では追加する（下に追記案あり）

3. needs_input の定義（運用ルール）
3.1 needs_input にする条件（v1固定）

Runnerは以下のいずれかに該当したら、強制的に needs_input（人間の介入）に落とす。

Doctor FAIL（Blockerが1つでも）

worktree dirty（方針：FAIL扱い）

Contract崩壊（JSON parse/schema）

Stepサイズ超過（STEP_TOO_LARGE）

テスト失敗（Unit/E2E）

禁止事項検知（gh依存など）

git push が必要なフローで認証失敗（compare URL/PR相当が作れない）

3.2 needs_input にしない条件

compare URL生成ができないだけ（origin無し／非GitHub）は、v1は WARNで継続しても良い

ただし「compare URL必須」を request が要求している場合は needs_input

4. errors.json（SSOT）

Runが needs_input または failed になった場合、必ず以下を保存する：

保存先：runs/<request-id>/<run-id>/errors.json

json
{
"version": "1.0",
"request_id": "RQ-...",
"run_id": "RUN-...",
"status": "needs_input|failed",
"category": "ENVIRONMENT|CONTRACT|EXECUTION|GUARDRAIL|INPUT|UNKNOWN",
"reason_code": "WORKTREE_DIRTY",
"message": "未コミット変更があります",
"suggested_actions": [
"git status を確認",
"コミット/スタッシュしてから再Run"
],
"evidence": {
"command": "git status --porcelain",
"stdout_excerpt": " M app/Http/Controllers/...",
"stderr_excerpt": ""
},
"context": {
"step_id": "S03",
"role": "implementer",
"attempt": 1
}
}

4.1 message / suggested_actions の決定

messages.v1.ja.json の reason_code に対応する title/summary/actions を使用

message は title + summary を合成してもよい

5. stage.json への反映（D22補足）

errors.json が作られたら、stageにも必ず反映する。

json
{
"state": "NEEDS_INPUT",
"error": {
"category": "CONTRACT",
"reason_code": "JSON_PARSE_ERROR",
"summary": "AI出力のJSONが壊れています"
}
}

6. report.md 追記形式（人間の監督に最適化）

保存先：runs/<request-id>/<run-id>/report.md
reportは Runが成功でも失敗でも必ず作る（失敗時は “途中までの成果” を残す）。

6.1 report.md の最小テンプレ（v1）
md
# Run Report

- request_id: RQ-...
- run_id: RUN-...
- status: NEEDS_INPUT
- finished_at: 2025-12-14T13:45:00+09:00

## Summary
- 何をやろうとして、どこで止まったか（1〜3行）

## Progress
- S01: done
- S02: done
- S03: needs_input（reason_code: WORKTREE_DIRTY）

## Evidence
- logs: runs/.../logs/
- errors: runs/.../errors.json

## Next Actions
- 1) git status を確認
- 2) コミット/スタッシュ
- 3) 再Run（S03から）

7. UI 表示（D23補足）
7.1 Run詳細画面

stage.state が NEEDS_INPUT の場合、上部に reason_code と Next Actions をカード表示

errors.json があれば “Open evidence” で command/stdout を折りたたみ表示

8. 追加：messages.v1.ja.json への追記（GH検知）

D31の messages に以下を追加する（v1で必須）。

json
"GH_DEPENDENCY_DETECTED": {
"title": "gh依存が検出されました",
"summary": "方針によりghコマンド依存は禁止です。",
"actions": [
"該当箇所から gh 呼び出しを削除",
"gitのみで成立する実装に置換",
"再Run"
]
}

9. 受け入れ基準（D33）

Runが止まったら必ず errors.json があり、reason_code が一意に決まる

stage.json と report.md に同じ原因が反映される

UIで “次に何をすれば復帰できるか” が即分かる

compare URLなどの “必須/任意” が needs_input 判定に反映される

次に作るべきは、運用を回すための D34. Runの再開仕様（Resume：どのStepから再実行するか／再planning条件／リトライ上限） です。

