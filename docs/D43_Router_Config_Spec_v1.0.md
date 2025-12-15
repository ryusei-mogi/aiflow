D43. ルータ設定仕様（role→CLI割り当て／トークン不要モード）v1.0

対象：aiflow-local の Router（D42の各roleを、どのCLI/モデルで回すか決める）
目的：あなたの現行スタイル（Codexで要件/設計、Geminiでテスト寄り）に合わせて、ローカル完結・サブスクCLI前提で安定運用できる割り当てを固定する。
前提：ChatGPT Plus（Codex CLI）＋ Google AI Pro（Gemini CLI）／gh禁止／git依存OK。

1. 「トークン不要モード」の定義（v1）
1.1 意味（v1固定）

APIキー不要（= サブスクCLIのログイン状態を利用）

トークン使用量の計測・上限制御をしない（usage.csv等を作らない）

代わりに、呼び出し回数・試行回数・所要時間だけを runs/.../logs/ に記録する

目的は「運用を軽くする」こと。コスト制御ではなく “停止しない/回り続ける” を優先する。

2. Routerの責務（v1）

Routerは各タスク実行時に、以下を決める。

使用CLI：codex | gemini（v1ではこの2つを標準）

モデル名（CLIに渡す値）

role別プロンプトテンプレ（D42）

JSONスキーマ（使えるCLIのみ）

実行モード：no_token（v1固定）

3. ルーティング方針（v1推奨デフォルト）

あなたの現状（設計・実装はCodex、ブラウザ/テストはGemini寄り）を反映し、次をデフォルトとする。

Role	目的	優先CLI	理由	フォールバック
planner	Step分割・計画	codex	要件整理・分割が強い	gemini
reviewer	計画の穴/リスク	gemini	“別視点” を入れる	codex
implementer	Step実装(diff)	codex	実装・単体テスト生成が安定	gemini
qa	diff/ログの要点化	gemini	俯瞰評価・指摘抽出	codex
designer（任意）	画面案	gemini	UI文脈が得意	codex（必要なら）
4. capabilityベースの例外ルール（v1）

role固定だけだと詰まるので、Routerは「要求capability」で上書きできる。

4.1 capability（v1）

strict_json：JSON厳格が必要（D42準拠）

long_context：対象ファイルが多い/長い

code_heavy：差分生成が主

risk_review：仕様リスク洗い出し

summarize_logs：テストログ要約

ui_copy：文言/画面案

needs_schema_validation：スキーマで固めたい

4.2 例外ルーティング（v1例）

code_heavy=true → codex優先（implementer/修正パッチ系）

summarize_logs=true → gemini優先（qa系）

strict_json=true で、片方のCLIがJSON崩壊しがちなら もう片方へ切替（retryはD34の枠内）

5. Router設定ファイル仕様（.aiflow/router.v1.json）

aiflowの設定はローカルに置き、devDependenciesで使える前提。

json
{
"version": "1.0",
"mode": "no_token",
"cli_availability": {
"codex": { "required": true, "bin": "codex" },
"gemini": { "required": true, "bin": "gemini" }
},
"defaults": {
"timeout_sec": 180,
"max_retries_per_call": 1
},
"models": {
"codex": {
"planner": "gpt-5.2-xhigh",
"implementer": "gpt-5.2-xhigh",
"reviewer": "gpt-5.2-high",
"qa": "gpt-5.2-high"
},
"gemini": {
"reviewer": "gemini-3-pro",
"qa": "gemini-3-pro",
"designer": "gemini-3-pro",
"planner_fallback": "gemini-3-pro",
"implementer_fallback": "gemini-3-pro"
}
},
"routing": {
"planner": { "primary": "codex", "fallback": "gemini" },
"reviewer": { "primary": "gemini", "fallback": "codex" },
"implementer": { "primary": "codex", "fallback": "gemini" },
"qa": { "primary": "gemini", "fallback": "codex" },
"designer": { "primary": "gemini", "fallback": "codex" }
},
"overrides": [
{ "when": { "capability": "code_heavy" }, "use": "codex" },
{ "when": { "capability": "summarize_logs" }, "use": "gemini" }
]
}


モデル名はCLIの実際の指定値に合わせて調整する（ここは“設定で差し替え可能”が要件）。

6. 「実行できない」時の扱い（v1）

Routerは次の順で判定する。

primary CLIが存在し、ログイン済み/実行可能

だめなら fallback を試す

それもだめなら NEEDS_INPUT（reason_code=CLI_NOT_AVAILABLE / CLI_AUTH_REQUIRED を追加推奨）

7. JSON安定化（v1）

no_token モードでも D42のJSON一発出しを必須にする

JSONパース失敗時：

1回だけ同CLIでリトライ（max_retries_per_call=1）

だめなら fallback CLIで再試行

それでもだめなら NEEDS_INPUT（D34）

8. ログ仕様（no_token向け）

usage（トークン）は記録しない代わりに、最低限これを残す。

runs/.../logs/router.log

role / primary / fallback / 実行時間 / 成否 / リトライ回数

runs/.../logs/<role>.<step>.attemptN.raw.txt

CLIの生出力（デバッグ用、JSON崩壊検知に必要）

9. 受け入れ基準（D43）

roleごとに primary/fallback が固定できる

トークン計測・APIキー無しで運用できる（サブスクCLI前提）

JSON崩壊時に「リトライ→fallback→NEEDS_INPUT」の順で安全に止まる

あなたの現行分担（Codex=設計/実装、Gemini=テスト/評価）に自然に沿う

次は、ここまでの仕様で「ブラウザUIから request を投入してRunが回る」までの実装順を固定する D44. 実装計画（MVPスコープ／ディレクトリ構成／最初に動かす縦串） を作るのが最短です。

