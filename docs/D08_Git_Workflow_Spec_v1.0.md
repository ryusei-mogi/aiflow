D8. Git運用仕様（Git Workflow Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）
制約：gh 非依存、git 依存可、トークン不要PRモード

1. 目的

本書は、aiflow-local がローカルで代理実行する際の Git運用（ブランチ、コミット、差分管理、push、PR導線） を定義する。
狙いは以下の3点である。

既定ブランチを絶対に壊さない（直変更禁止）

Step反復により 途中停止しても成果が残る（コミットで固定）

gh もトークンも使わずに PR作成に進める状態 を提供する（compare URL）

2. 前提

リポジトリは git 管理され、origin remote が設定済みである

PRはWeb UIで作成する（compare URLを開くのみを自動化）

同時実行は原則1（ただしGit仕様は並列でも破綻しないようにする）

開発対象は任意だが、既存仕様を壊さない方針が最優先

3. ブランチ運用
3.1 既定ブランチ（base）

Requestファイルの frontmatter.base により指定する

デフォルト：main

baseは 実行開始時点で存在し、originにも存在している必要がある

3.2 作業ブランチ（branch）

Requestファイルの frontmatter.branch により指定する

推奨命名：ai/<request_id>
例：ai/20251214-login-timeout

3.3 禁止事項

baseブランチ（例：main）での直接コミットは禁止

baseブランチのrebase/force pushは禁止

実行中に別Requestが同一ブランチを共有することは禁止（1 Request = 1 branch）

3.4 実行開始時のブランチ整備（仕様）

実行（RUN_START）時に以下を満たすこと：

作業ツリーがクリーン（git status --porcelain が空）

クリーンでない場合：needs_input（ユーザー対応を要求）

baseが最新化されている（後述の3.5）

branchが存在しない場合：baseから新規作成

branchが既に存在する場合：そのブランチへcheckoutし継続（再開）

3.5 baseの最新化ポリシー

代理実行は常に origin を基準にする

git fetch origin を実施する

baseブランチの実体は origin/<base> を基準にする

git checkout <base> → git reset --hard origin/<base> を 実行して良いのは「作業ツリーがクリーン」な場合のみ

aiflow-localは ユーザーのローカル作業を破壊しない ため、クリーンでない場合は自動でresetしない

4. Stepとコミット運用（中核）
4.1 1 Step = 1コミット（原則）

D4に基づき、Step完了時に必ずコミットを作成する

コミットが作れないStepは「完了」とみなさない（Stepは閉じない）

4.2 コミット粒度

1コミットあたりの変更規模は小さく保つ（D4の上限に準拠）

異なる目的（実装＋大量整形＋依存更新など）を混在させない

4.3 コミットメッセージ規約（推奨）

形式（推奨）：

type: summary (req:<id> step:Sxx)

type例：

feat / fix / refactor / test / docs / chore

例：

fix: handle session timeout (req:20251214-login-timeout step:S02)

test: add regression for flow Y (req:... step:S01)

4.4 コミット前チェック（必須）

コミット前に必ず以下を行う：

git diff を取得し、差分が想定外に大きくないことを確認（自動判定）

Stepで定義されたテスト（最低unit）を実行し、成功を確認

git status --porcelain にステージング対象以外が紛れないこと

4.5 ステージング方針

原則：必要なファイルのみ git add <paths...>

git add -A は 原則禁止（取りこぼし検知が難しいため）

例外：Stepが「依存更新」などで対象が広いことを明示している場合のみ許容

5. 差分管理（比較の基準）
5.1 差分の基準

PR導線に使う比較は常に origin/<base>...<branch> とする

Step単位の差分は HEAD~1..HEAD などでローカル参照可

5.2 aiflow-localが記録すべき情報

Report（D5）には以下を記録する：

各Stepのコミットhash

base（例：main）

branch

PR compare URL（done時）

6. push運用（トークン不要PRモード）
6.1 pushのタイミング

最低：Requestが done になる時点で必ずpushする

推奨：Step完了ごとにpushしてもよい（途中停止でもリモートに残る）

ただしネットワーク環境が不安定な場合は最後にまとめてもよい

6.2 pushコマンド（仕様）

初回push：git push -u origin <branch>

以降：git push origin <branch>

6.3 push失敗時の扱い

PUSH_FAIL は failed に遷移させる

Reportに「失敗理由」「再試行手順」を残す（例：認証、ネットワーク、remote設定）

7. compare URL（PR導線）の生成仕様
7.1 目的

gh を使わず、Web UIでPR作成に進むために compare URL を生成する。

7.2 必須要件

done 状態に遷移するためには pr_url が必須（D2整合）

pr_url は Request frontmatter と Report の双方に記録することを推奨

7.3 compare URLの生成ルール

origin remote URL からリポジトリURLを導出する

git remote get-url origin の結果が以下を含む場合に対応する：

HTTPS: https://github.com/<owner>/<repo>.git

SSH: git@github.com:<owner>/<repo>.git

生成するURL（GitHub想定）：

https://github.com/<owner>/<repo>/compare/<base>...<branch>?expand=1

GitHub以外（GitLab等）への汎用化はv1では必須としない。ただし実装側が可能なら対応してよい。

7.4 生成できない場合

origin URLが解析不能、またはホスティング不明の場合は needs_input にし、ユーザーに「compare URLのベース」を提示して入力を求める

例：repo_web_url: https://... を手動設定してもらう

8. 安全ガード（必須）
8.1 作業ツリーが汚れている場合

git status --porcelain が非空の場合：

自動実行を開始しない

needs_input に遷移し、ユーザーに以下いずれかを要求する：

stash/commit/破棄でクリーンにする

別ディレクトリで実行する

理由：ユーザーのローカル作業を破壊しないため

8.2 既定ブランチ保護

実行開始時に git rev-parse --abbrev-ref HEAD が base の場合：

必ず branch を作成してcheckoutする

baseにコミットしようとした場合は即 failed（ルール違反）

8.3 force操作禁止

git push --force / --force-with-lease は禁止

git reset --hard は「baseの同期」に限り許容し、かつクリーン時のみ

9. 例外ケース（仕様）
9.1 再実行（RERUN）時

既存branchがある場合はそのbranchを使用して継続する

ただし「branchを作り直す」運用をしたい場合のため、任意で RESET_BRANCH（将来拡張）を用意してもよい

v1では必須ではない

9.2 Stop（中断）時

Stopは可能な限り安全停止：

すでにコミット済みの成果は保持

未コミット差分がある場合は、基本方針として：

破棄せず「どの差分が残っているか」をReport/ログに残し、ユーザー判断を促す（needs_inputでも可）

中断後の状態遷移はD2に従うが、Git観点では「成果が壊れない」が最優先

10. 受け入れ基準（本Spec）

1 Request = 1 branch を守り、base直変更が起きない

Step完了時にコミットが作られ、Reportにhashが残る

pushに成功し、done時にcompare URLが生成・提示される

gh コマンドやトークンが不要で運用できる

作業ツリーが汚れている場合に安全に停止し、ユーザーに介入を求められる

11. 関連（依存）

D1：機能仕様書（UIの操作・表示）

D2：状態遷移仕様書（stop/failed/needs_input/done）

D4：Step Plan仕様（Step=小変更+テスト+コミット）

D5：レポート仕様（コミット/compare URLの記録）

D9：テスト戦略（Step内テストの必須範囲）

次に進めるなら、実装を始める前に D7（Local API Contract） か D6（UI/画面設計） を固めると、実装の迷いが激減します。

