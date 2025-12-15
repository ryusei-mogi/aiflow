D47. reason_code辞書（頻出ケースと復帰手順）v1.0

対象：aiflow-local の reason_code（D33/D34/D38/D39/D40/D41と整合）
目的：blocked/needs_input になっても「次に何をすれば復帰できるか」を固定し、あなたが “ほぼ見ない” 運用でも止まらないようにする。
前提：ローカル完結／gh禁止／git依存OK／Codex/Gemini CLI前提／総合テストはあなたが実施。

1. reason_code の設計原則（v1）

1事象 = 1 reason_code（曖昧な統合は禁止）

category を必ず持つ（UIで色分け）

すべてに actions（復帰手順） を付ける（D45エラー契約）

“自動リトライ可能” かどうかを持つ（D34/D41）

2. カテゴリ（v1）

ENVIRONMENT：環境不足・未ログイン・コマンド不在

EXECUTION：ロック・実行制御・プロセス異常

INPUT：requestが曖昧・不足

LLM_OUTPUT：JSON崩壊・スキーマ不整合

GIT：ブランチ/パッチ/差分適用

TEST：Unit/E2E/静的解析

INTERNAL：実装バグ

3. reason_code 一覧（v1 コア）
3.1 ENVIRONMENT
CLI_NOT_AVAILABLE

例：codex / gemini が見つからない

actions：

which codex / which gemini

npm scripts/パスの見直し

retry：×（修正後に再Run）

CLI_AUTH_REQUIRED

例：CLIが未ログインで失敗

actions：

codex login / gemini auth（実際の手順はCLIに合わせる）

doctorで再確認

retry：×（修正後に再Run）

NODE_NOT_AVAILABLE

actions：Node導入（nvm等）

retry：×

GIT_NOT_AVAILABLE

actions：git導入／PATH見直し

retry：×

WORKTREE_DIRTY

例：未コミット変更がある

actions：

git status

commit / stash / revertしてクリーンにする

retry：×（クリーン後に再Run）

3.2 EXECUTION
RUN_IN_PROGRESS

例：同一requestの二重実行（D39）

actions：

latest_run へ移動

必要ならTTL待ち or doctor(full)で回収

retry：△（待って再実行）

QUEUE_IN_PROGRESS

例：Auto-runがすでに動作中（D39）

actions：

別タブ起動を止める

TTL待ち

retry：△

LOCK_STALE_DETECTED

例：期限切れロックを検出（回収前）

actions：

doctor(full)

pid生存確認

retry：△

PROCESS_CRASHED

例：Runnerプロセスが異常終了

actions：

logs確認（runs/.../logs）

再Run

retry：△（再Runで回復しがち）

3.3 INPUT（要望不足）
REQUEST_INVALID_FORMAT

例：メタ欠落、id/title不正（D36）

actions：

D46テンプレで修正

retry：×（修正後再Run）

ACCEPTANCE_CRITERIA_TOO_FEW

例：ACが3未満

actions：

ACを追加（最低3つ）

retry：×

NEEDS_CLARIFICATION

例：Planner/Reviewerが “仕様確定に質問が必要” と判断

actions：

requestの補足欄に回答を書く

depends_on/対象画面/APIなどを追記

retry：×

3.4 LLM_OUTPUT（JSON崩壊）
JSON_PARSE_ERROR

例：JSON以外が混ざった／壊れた（D42/D43）

actions：

raw出力確認

Router fallback を強制（設定変更 or 再Run）

retry：△（1回だけ自動リトライ→fallback推奨）

JSON_SCHEMA_INVALID

例：必須フィールド欠落

actions：

同上（fallback）

retry：△

STEP_TOO_LARGE

例：Implementerがmax_diff_lines超過を検知（D42）

actions：

requestを細分化（またはreplan）

max_diff_linesを一時的に上げるのは最終手段

retry：×（replan後）

3.5 GIT
BASE_BRANCH_NOT_FOUND

actions：

base_branch設定確認

git branch -a

retry：×

BRANCH_CREATE_FAILED

actions：

branch名衝突回避

権限/保護ブランチは関係ない（ローカル前提）

retry：△

PATCH_APPLY_FAILED

actions：

git apply --check を手で実行

対象pathsが間違っていないか確認

replan（targetsを絞る）

retry：×（再計画推奨）

REMOTE_NOT_GITHUB

例：compare URL生成不可

actions：

reportのgitコマンドで運用（compare URL無し）

retry：×（仕様通り）

GIT_PUSH_FAILED（autopush時のみ）

actions：

git remote -v

認証（ssh/https）

手動push

retry：△

3.6 TEST
UNIT_TEST_FAILED

actions：

logsの失敗箇所を見る（最低限テスト名）

自動修正がOFFなら再Run

retry：△（自動修正は最大1回）

E2E_TEST_FAILED

actions：

artifacts（playwright-report等）確認

フレークなら再実行

retry：△（最大1回推奨）

TEST_TIMEOUT

actions：

timeoutを増やす（config）

依存起動が必要なら手順追加（db/migrate等）

retry：△

TEST_COMMAND_NOT_FOUND

actions：

npm install

package.json scripts確認

retry：×（修正後）

3.7 INTERNAL
INTERNAL_ERROR

actions：

logs添付して再Run

最小再現requestを作る

retry：△

4. UI表示ルール（v1）

blocked時は reason_code を必ず表示

actions をボタン/箇条書きで出す

可能なら “ワンクリック復帰” を提供

例：LOCK回収→再Run（ただしv1は doctor 経由でも可）

5. 受け入れ基準（D47）

blocked/needs_input になったとき、UIで 次にやることが即わかる

reason_code がカテゴリ付きで一意に決まる

D34のState遷移と矛盾しない（NEEDS_INPUTに落ちる理由が説明可能）

次に作るべきは、あなたの運用を最短で回すための D48. MVPローンチ運用手順（毎日の回し方・ルール・トラブルシュート） です。

