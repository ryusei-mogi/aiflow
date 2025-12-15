D32. Doctor仕様（チェック項目・FAIL/WARN境界・UI表示）v1.0

対象：aiflow-local POST /api/doctor および UI Doctor 画面
目的：初期PoCで詰まりやすいポイント（環境・パス・git・CLI）を 実行前に可視化し、Runが “理由不明で止まる” 状態を減らす。
前提：ローカルのみ／トークン不要（Node側でキー管理しない）／ghは禁止／gitはOK。

1. Doctorの位置付け（v1）

Run開始前に 推奨実行（必須ではないが、P0 requestでは自動で走らせてもよい）

Doctor結果は

APIレスポンスとして返す（UI表示用）

（任意）Run開始時は runs/.../logs/doctor.json に保存して参照可能にする

2. API仕様（D21補足）
2.1 エンドポイント

POST /api/doctor

2.2 Request（v1）
json
{
"mode": "quick|full",
"repo_root": "string (optional)"
}


mode=quick：基本チェックのみ（推奨デフォルト）

mode=full：CLIの簡易実行など重いチェックも含む

2.3 Response（v1）
json
{
"version": "1.0",
"summary": {
"status": "PASS|WARN|FAIL",
"fail_count": 0,
"warn_count": 1
},
"checks": [
{
"id": "D-001",
"name": "Node available",
"status": "PASS|WARN|FAIL",
"severity": "Blocker|Major|Minor",
"message": "string",
"hint": "string",
"evidence": { "command": "node -v", "stdout": "v20.10.0", "stderr": "" }
}
],
"environment": {
"repo_root": "string",
"os": "string",
"timestamp": "ISO-8601"
}
}

3. チェック一覧（v1固定）

v1は “失敗が分かりやすい” ものに絞る。将来拡張はID追加のみで可能にする。

3.1 基盤（Node/npm）
ID	チェック	コマンド/根拠	FAIL条件	WARN条件
D-001	Nodeが利用可能	node -v	実行不可	なし
D-002	npmが利用可能	npm -v	実行不可	なし
D-003	tools/aiflow依存導入	tools/aiflow/node_modules 存在	無い	なし
3.2 リポジトリ/パス
ID	チェック	方法	FAIL条件	WARN条件
D-010	requests/存在	ディレクトリ存在	無い	なし
D-011	runs/存在	ディレクトリ存在（無ければ作成しても良い）	作成不可	無い（新規作成時）
D-012	.aiflow/存在	ディレクトリ存在	無い	なし
D-013	config/quality-gates/messages/prompts/schemas	各ファイル存在	必須ファイル欠落	任意ファイル欠落
3.3 Git（gh禁止の前提）
ID	チェック	方法	FAIL条件	WARN条件
D-020	git利用可能	git --version	実行不可	なし
D-021	git repo判定	git rev-parse --show-toplevel	非repo	なし
D-022	worktree clean	git status --porcelain	dirty（v1はFAIL推奨）	（運用でWARNに落とすならここ）
D-023	origin存在	git remote get-url origin	compare URLが必要なRunでorigin無し	通常はWARN（compare生成スキップ）

v1の推奨：worktree dirty は FAIL（差分混入が最も事故る）。

3.4 CLI（サブスクCLIの存在確認）
ID	チェック	方法	FAIL条件	WARN条件
D-030	codex CLI存在	codex --version など	Planner/Implementerにcodex指定で存在しない	ルータ設定上使わないならWARN
D-031	claude CLI存在	claude --version	QAにclaude指定で存在しない	使わないならWARN
D-032	gemini CLI存在	gemini --version	design等で使う指定かつ無い	使わないならWARN
3.5 禁止事項（gh依存検知）
ID	チェック	方法	FAIL条件	WARN条件
D-040	ghコマンド使用痕跡	tools/aiflow/** をgrep	\bgh\b がヒット	なし

実装は ripgrep があるなら rg を使ってよいが、依存を増やしたくないならNodeでwalk + regex。

4. FAIL/WARN/PASS の判定ルール（v1）
4.1 1チェック単位

status は PASS/WARN/FAIL のいずれか

severity は Blocker/Major/Minor（UI色分け用）

4.2 全体（summary.status）

FAILが1つでもあれば FAIL

FAILがなくWARNが1つでもあれば WARN

それ以外は PASS

5. UI表示仕様（D23補足）
5.1 Doctorページ

上部に summary（PASS/WARN/FAIL、件数）

下にチェック一覧テーブル

Name / Status / Message / Hint

“evidence” は折りたたみ表示（コマンド・stdout）

5.2 Run開始時の扱い（v1推奨）

Run開始ボタン押下時に mode=quick を呼ぶ

FAILなら Run開始せず、そのままDoctor結果を表示

WARNなら “続行” ボタンを出してRunできる

PASSならRun開始

6. 受け入れ基準（D32）

Node/npm/git/requests/.aiflow の欠落が一目で分かる

worktree dirty を確実に検知し、事故を抑止できる

gh痕跡があれば即FAILにできる

codex/claude/gemini の存在が “ルータ設定に応じて” FAIL/WARN に分かれる

次に作るべきは、Doctor結果やRun失敗を統一的に扱うための D33. エラー分類・reason_code運用仕様（NEEDS_INPUTの具体ルール、report追記形式） です。

