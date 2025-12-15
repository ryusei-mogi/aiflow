D41. テスト実行ポリシー（unit/e2eコマンド設定・ログ保存・失敗時扱い）v1.0

対象：aiflow-local が実行する Unit / E2E /（任意）静的解析の呼び出し規約
目的：回帰・品質を “人間の総合テスト” に寄せすぎず、最低限の自動ゲートを安定運用する。
前提：ローカル完結／Laravel(PHPUnit)＋（UIがあれば）npm系E2E／gh禁止／git依存OK。

1. 基本方針（v1）

テストは 作業ブランチ上 で実行（D40）

v1は「速いテストを毎Step」「重いE2Eは必要時」の2段構え

失敗は自動修復を試みても良いが、無限ループ回避の上限を設ける（D34）

2. テスト種別（v1）
2.1 Unit（必須）

Laravel：phpunit（php artisan test でも可）

目的：ロジック破壊の早期検知（権限・入力検証の一部も含む）

2.2 E2E（推奨・条件付き必須）

UI/フロー回帰が重要なrequestで実施

あなたは “結合テストの指示は出すが結果は見ない” 運用なので、E2Eは 自動で回してレポート化が価値

2.3 Static（任意）

PHPStan / Pint / ESLint など

v1では “プロジェクト側に既にコマンドがあるなら呼ぶ” に留める

3. 設定（.aiflow/config.v1.json の想定）

テストコマンドはプロジェクト差が大きいため、v1は設定で与える。

json
{
"tests": {
"unit": {
"enabled": true,
"command": "php artisan test",
"timeout_sec": 600
},
"e2e": {
"enabled": true,
"command": "npm run test:e2e",
"timeout_sec": 900,
"artifacts_glob": [
"playwright-report/**",
"test-results/**"
]
},
"static": {
"enabled": false,
"command": "npm run lint",
"timeout_sec": 600
}
}
}


“既存の開発ディレクトリでnpm installしたら使える” 前提なので、E2Eは devDependencies で完結するコマンドに寄せる。

4. 実行タイミング（v1）
4.1 Step完了時のゲート（推奨）

各Stepの実装を適用（patch apply）したら：

Unit（必須）

Static（有効なら）

E2E（Stepの requires_e2e=true のときのみ）

4.2 requires_e2e 判定（v1）

planning.json の各stepに gates を持たせる（D26拡張）

例：

json
{
"id": "S03",
"title": "UI flow",
"gates": {
"unit": true,
"static": false,
"e2e": true
}
}

5. ログ・成果物の保存（v1）
5.1 ログ保存先

runs/<request-id>/<run-id>/logs/tests/

unit.S03.attempt1.log

e2e.S03.attempt1.log

static.S03.attempt1.log

5.2 標準出力/標準エラー

すべてファイルに保存

report.md には 抜粋（先頭/末尾） と “失敗テスト名” を短く記載

5.3 E2E成果物（任意だが推奨）

tests.e2e.artifacts_glob に一致するディレクトリ/ファイルを

runs/.../artifacts/e2e/<step>/<attempt>/ へコピー（またはsymlink）

UIで “Artifacts” タブから参照可能にする

6. 失敗時の扱い（v1）
6.1 Unit失敗

NEEDS_INPUT（reason_code=UNIT_TEST_FAILED）

ただし v1では 自動修正を1回だけ 試すことを許可（設定でON/OFF）

自動修正（任意）

Implementerに「失敗ログ抜粋 + 失敗箇所ファイル」を渡し、最小修正パッチを作る

成功したらテスト再実行

失敗したら needs_input

自動修正が暴走しやすいので “最大1回” 固定が安全。

6.2 E2E失敗

NEEDS_INPUT（reason_code=E2E_TEST_FAILED）

自動修正は v1ではデフォルトOFF（フレーク、環境依存が多い）

6.3 Static失敗

v1は WARN でも良いが、プロジェクト方針に合わせて FAIL も選べる

configに static.fail_on_error を持たせてもよい

7. タイムアウト／異常終了（v1）

timeout を超えたら NEEDS_INPUT（reason_code=TEST_TIMEOUT を追加推奨）

コマンド起動不可（npm未導入等）は ENVIRONMENT（reason_code=TEST_COMMAND_NOT_FOUND を追加推奨）

messages追加例（必要なら）：

TEST_TIMEOUT

TEST_COMMAND_NOT_FOUND

8. report.md への反映（D37連携）

report.md の「Quality Gates」に以下を入れる：

例：

Unit（S03）：FAIL（3 tests failed: ...）

E2E（S03）：PASS（12 specs）

Logs：runs/.../logs/tests/unit.S03.attempt1.log

9. 受け入れ基準（D41）

Unit/E2Eの実行がconfigで差し替え可能

ログが必ずruns配下に残り、失敗理由が短時間で追える

失敗時はreason_codeが一意に決まりNEEDS_INPUTに落ちる

自動修正を入れる場合でも上限1回で止まる（D34と整合）

次に作るべきは、ここまでの“仕様群”を実際のプロンプト投入に落とす D42. プロンプト契約（role別入力・出力・禁止事項・schema・分割強制の書き方） です。これが揃うと実装に移れます。

