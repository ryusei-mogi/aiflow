D25. Gitアダプタ仕様（branch/push/compare URL）v1.0

対象：aiflow-local Runner / Server 内の git 操作モジュール
目的：トークン不要PRモード（compare URL運用）を gitだけで確実に成立 させる。
前提：gh 不使用／GitHub API不使用／git は依存OK／ローカルのみ。

1. 役割と責務

Gitアダプタは以下を提供する：

リポジトリ判定（git repoか）

worktree clean判定（未コミット差分の有無）

baseブランチ存在確認（local/remote）

ブランチ命名（request_id→branch name）

作業ブランチ作成・切替

push（originへ）

GitHub remote URL 解析（owner/repo抽出）

compare URL 生成

2. インターフェース（擬似）
ts
type GitInfo = {
repoRoot: string;
isGitRepo: boolean;
worktreeClean: boolean;
originExists: boolean;
originUrl?: string;
baseBranch: { name: string; exists: boolean };
};

type BranchPlan = {
baseBranch: string;
branchName: string;
refspec: string; // e.g. "HEAD:refs/heads/<branchName>"
};

type PushResult = {
attempted: boolean;
status: "not_run" | "passed" | "failed";
error?: string;
};

type RemoteRepo = {
host: "github.com";
owner: string;
repo: string;
};

export interface GitAdapter {
detectRepo(): Promise<GitInfo>;
ensureBranch(plan: BranchPlan): Promise<{ created: boolean }>;
push(plan: BranchPlan): Promise<PushResult>;
parseGitHubRemote(url: string): RemoteRepo | null;
buildCompareUrl(remote: RemoteRepo, base: string, head: string): string;
}

3. コマンド実行ルール（v1）

child_process.spawn で git を実行

cwd は必ず repoRoot

stdout/stderr はログファイルに追記

失敗時は例外にせず、結果オブジェクトで返す（RunnerがNEEDS_INPUT判定できるように）

4. Git判定・状態取得（detectRepo）
4.1 repoRoot

git rev-parse --show-toplevel

成功：repoRoot

失敗：isGitRepo=false

4.2 worktree clean 判定

git status --porcelain

出力が空：clean=true

1行でもあれば：clean=false

4.3 origin 判定

git remote get-url origin

成功：originExists=true + originUrl

失敗：originExists=false

4.4 baseブランチ存在

baseは .aiflow/config.v1.json の base_branch を使用（例：main）

判定（v1実装案）：

git show-ref --verify --quiet refs/heads/<base>

成功：exists=true（ローカルにある）

失敗なら git ls-remote --heads origin <base>

1行でも返れば：exists=true（remoteにある）

何も返らない：exists=false

注意：originが無い場合は remote判定できないが、ローカルにbaseがあればexists=true扱いでOK。

5. ブランチ命名規約（最重要）
5.1 ブランチ名の形式

ai/<request-id-sanitized>

例：

request_id: RQ-20251214-001-bootstrap-aiflow-local

branch: ai/RQ-20251214-001-bootstrap-aiflow-local

5.2 サニタイズ

gitブランチに危険な文字を混ぜない：

\s → -

連続 -- は - に畳む

許可：[A-Za-z0-9/_\-.]

それ以外は - に置換

末尾の / . - は除去

最大長：128（超えたら末尾を切る）

6. 作業ブランチ作成（ensureBranch）
6.1 基本方針

作業ブランチは baseから作る（差分混入を避ける）

v1は「実行時にブランチを作ってcheckout」する（RunnerのSSOT）

6.2 手順（v1）

git fetch origin（originがある場合のみ、失敗はWARN扱い）

base checkout（ローカルに無ければ origin/<base> を使う）

git checkout <base> or git checkout -B <base> origin/<base>

ブランチ作成・切替

git checkout -B <branchName> <base>

戻り値：

created は「新規作成か」判定が難しいため v1は常に true でも可
（厳密化するなら git show-ref --verify refs/heads/<branchName> の事前判定）

7. push（トークン不要PRモードの肝）
7.1 手順

git push -u origin <branchName>

7.2 失敗パターン

originなし：attempted=false / not_run

認証失敗：failed（NEEDS_INPUTへ）

ネットワーク失敗：failed（NEEDS_INPUTへ）

ブランチ未作成：failed（Runner側のバグ扱い）

8. GitHub remote URL 解析（parseGitHubRemote）
8.1 対象URL形式（v1）

SSH：

git@github.com:<owner>/<repo>.git

HTTPS：

https://github.com/<owner>/<repo>.git

https://github.com/<owner>/<repo>

8.2 抽出ルール

hostは必ず github.com のみ対応（v1）

repo末尾の .git は除去

owner/repo は URL から抽出

8.3 解析できない場合

null を返す（NEEDS_INPUTのreason_code：REMOTE_NOT_GITHUB 等にできる）

9. compare URL 生成（buildCompareUrl）
9.1 形式

https://github.com/<owner>/<repo>/compare/<base>...<branch>?expand=1

9.2 base/headの注意

baseは main 等

headは ai/RQ-...（/ を含むがURLとして問題ない）

URL encodeは基本不要だが、厳密には encodeURIComponent で head部分をエンコードしてもよい
（ただしGitHub compareは / を含むブランチでも受け付けるため、v1はそのままでOK）

10. Quality Context への反映（D17-B）

Gitアダプタの結果は必ず quality_context.json に入れる：

repo.is_git_repo

repo.worktree.clean

repo.remote.origin.exists

repo.remote.origin.url

repo.base_branch.exists

runner.branch.name

runner.push.status

runner.push.compare_url

11. 受け入れ基準（D25）

git repo 判定が正しく動く

worktree dirty を検知して止められる

originがある場合に git push -u origin <branch> が走る

GitHub remote の owner/repo を抽出できる

compare URL が report に出る

失敗時でも Runner は needs_input と reason_code を確定できる

次に作るべきは、“Step分割をAIに考えさせる” を実装に落とすための固定フォーマットです。
具体的には D26. Planning出力仕様（Step分割JSON + 収束ルール）v1 を作成すると、途中停止問題の対策が一気に具体化します。

