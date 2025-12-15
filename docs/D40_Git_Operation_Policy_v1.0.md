D40. Git操作ポリシー（branch作成／commit／push／apply方式）v1.0

対象：aiflow-local が実施する git 操作の範囲と禁止事項
目的：ローカル完結で “PR相当（compare URL）” を作れる一方、事故（既存仕様破壊・意図せぬコミット混入）を防ぐ。
前提：gh禁止／git依存OK／既存仕様は壊さない／v1は安全側（自動pushは任意）。

1. 基本方針（v1）
1.1 原則

aiflow は 作業ブランチ上でのみ 変更を行う

main（base_branch）へ直接変更しない

worktree dirty の状態では開始しない（D32/D33）

1.2 変更の適用方式

v1は「自動 apply」も可能だが、事故防止のため デフォルトOFF

ただしあなたの運用は “コード見ない” 側なので、v1は次の2モードを用意するのが実務的

2. モード定義（v1）
2.1 safe mode（デフォルト）

パッチ生成まで：自動

git apply：自動（推奨）※ただし適用前に pre-check を実施

git commit：自動

git push：しない（手動）

“あなたが最小の判断で回す” ため、apply/commitまでは自動を許可し、pushは最後のゲートにする。

2.2 autopush mode（任意・明示ON）

safe mode + git push -u origin <branch> を実施

compare URL を report に出す

3. ブランチ命名規則（v1）
3.1 生成規則

prefix：.aiflow/config.v1.json の git.branch_prefix（例：ai/）

suffix：<request-id>-<run-id> を短縮

最大長：configの max_branch_len

例：

ai/RQ-20251214-001-RUN-20251214-152233-a3f9

3.2 正規化ルール

/ と空白は - へ

大文字は許可するが、推奨はそのまま（運用で統一）

4. 作業開始時の git フロー（v1）

Runnerは Run開始時に以下を実施する。

git rev-parse --show-toplevel（repo確認）

git status --porcelain（dirtyなら停止：WORKTREE_DIRTY）

git fetch origin <base_branch>（originある場合のみ、失敗はWARN）

git checkout <base_branch>（必要なら）

git pull --ff-only（originある場合のみ、失敗はWARN）

作業ブランチ作成

git checkout -b <working_branch>

origin無しでもローカル完結で動くように、fetch/pullは “可能なら” でよい。

5. 変更適用（patch apply）仕様（v1）
5.1 事前チェック（必須）

git apply --check <patch> を実行

失敗したら NEEDS_INPUT（reason_code=PATCH_APPLY_FAILED を追加推奨）

5.2 適用

git apply <patch> を実行

適用後に git status --porcelain を確認し、変更があることを確認

5.3 パッチの保管

runs/.../patches/step-S03.patch のようにStepごとに保存

1 Runの最終統合パッチも任意で patches/all.patch を生成してよい

6. commit ポリシー（v1）
6.1 commitの単位

v1は Stepごとに1 commit を推奨（分割運用と相性が良い）

S01: ...

S02: ...

6.2 commitメッセージ規約（v1）

aiflow(<request-id>): <short title> [Sxx]

例：aiflow(RQ-20251214-001): add request queue UI [S02]

6.3 commit前チェック（必須）

Unit/E2E を走らせる前提なら、少なくとも以下を実施

git diff --stat を report に記録

git diff の保存（任意：runs/.../diff.txt）

6.4 失敗時

commit前にテスト失敗したら commitしない

commit後にテスト失敗が発覚したら（v1では原則避ける）：

NEEDS_INPUT に落とし、修正commitで直す（revertはしない）

7. テスト実行と git の関係（v1）

テストは 作業ブランチ上 で実行

テスト成功 → commit（または commit→test は避ける）

テストログは runs/.../logs/ に保存

8. push ポリシー（v1）
8.1 safe mode（デフォルト）

pushは実施しない

reportに以下を載せる

git push -u origin <working_branch> のコマンド

compare URL の推定（originがGitHubなら）

8.2 autopush mode

git push -u origin <working_branch> を実施

失敗したら NEEDS_INPUT（reason_code=GIT_PUSH_FAILED を追加推奨）

9. compare URL（PR相当）の生成（v1）

gh禁止のため、compare URL は remote URL 解析で生成する。

9.1 条件

origin が GitHub のHTTPS/SSH形式であること

base_branch と working_branch があること

9.2 生成形式（GitHub）

https://github.com/<owner>/<repo>/compare/<base_branch>...<working_branch>

originが

git@github.com:owner/repo.git

https://github.com/owner/repo.git
のどちらでも解析できるようにする。

解析不能なら：

reason_code=REMOTE_NOT_GITHUB（WARN）

reportでは “compare URL生成不可” と明記

10. 禁止事項（v1）

git rebase 自動実行（禁止）

git reset --hard 自動実行（禁止）

git clean -fd 自動実行（禁止）

main へ直接 commit（禁止）

gh 呼び出し（禁止、D39/D33のguardrail）

11. 追加 reason_code（D33拡張）

v1で追加するのが妥当：

PATCH_APPLY_FAILED

GIT_PUSH_FAILED

messages追加例：

json
"PATCH_APPLY_FAILED": {
"title": "パッチ適用に失敗しました",
"summary": "ベース差分や対象ファイルが想定と異なる可能性があります。",
"actions": [
"git status / git diff を確認",
"base_branch が正しいか確認",
"replan または対象pathsを絞って再Run"
]
}

12. 受け入れ基準（D40）

mainを汚さず、作業ブランチで完結できる

patch apply は --check を必ず通る

Stepごとにコミットでき、途中停止しても復帰しやすい

pushはデフォルト手動（安全）で、明示ON時のみ自動化

compare URL を gh無しで生成できる（GitHub remote時）

次に作るべきは、Runnerが “どのテストをどう呼ぶか” を固定する D41. テスト実行ポリシー（unit/e2eコマンドの設定、ログ保存、失敗時の扱い） です。

