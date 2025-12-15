D14. ディレクトリ／ファイル仕様（Filesystem & Naming Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）
前提：D3（Requestファイル）／D10（Runner）／D11（設定）／D13（配布）
制約：ローカル完結、requests/*.md がSSOT、runs/ はログ、gh 非依存、git 依存可

1. 目的

aiflow-local がプロジェクト直下に生成／参照するディレクトリとファイルの 役割・命名規則・保存ルール を固定する。
狙いは以下。

監督者が「どこを見ればいいか」を迷わない

Runnerが途中停止しても 再開可能な情報 が残る

Git管理対象／非対象が明確で、リポジトリを汚しにくい

2. 基本方針（最重要）

SSOT（Single Source of Truth）は requests/*.md

runs/ は 実行アーティファクト（ログ・スナップショット）

.aiflow/ は 一時領域（ロック・tmp）

requests/ は原則Git管理、runs/ と .aiflow/ は原則Git管理外（D13）

3. ルート直下の標準構成（デフォルト）

（D11のpathsデフォルトと一致）

lua
/<repo-root>
requests/
RQ-20251214-001-login-timeout.md
runs/
RQ-20251214-001-login-timeout/
001/
runner.log
stage.json
plan.json
errors.json
unit.log
e2e.log
artifacts.json
002/
...
.aiflow/
locks/
runner.lock
RQ-20251214-001-login-timeout.lock
tmp/
...
.aiflowrc.json         (任意)

4. 命名規則
4.1 Request ID（ファイル名）
形式（推奨）

RQ-YYYYMMDD-NNN-<slug>.md

YYYYMMDD：作成日（ローカル日付）

NNN：同日連番（001〜）

slug：短い英小文字＋ハイフン（例：login-timeout）

例：

RQ-20251214-001-login-timeout.md

RQ-20251214-002-invoice-search-filter.md

要件

Request ID はファイル名（拡張子除く）をそのまま使う

UI/APIはこのIDをキーとして扱う

4.2 Run ID（実行ID）
形式

001, 002, ... の3桁連番（Request単位）

例：

runs/<request_id>/001/

runs/<request_id>/002/

要件

再実行（rerun）は必ず run_id をインクリメントする

既存runを上書きしない（監査性・デバッグ性のため）

4.3 ロックファイル名

Runner全体ロック：.aiflow/locks/runner.lock

Request別ロック：.aiflow/locks/<request_id>.lock

5. requests/ 仕様（SSOT）
5.1 requests/ 配下のルール

直下に *.md を置く（サブディレクトリはv1非対応）

ファイル名＝Request ID（D7 APIのID）

5.2 Requestファイルの内容

内容構造は D3 に従う（Want/Constraints/AC/Test指示/Plan/Report）

v1では以下のセクションが最低限存在すればよい（空でも見出しはある）

# Title

## 前提/制約

## 受け入れ条件

## テスト指示（任意）

## Plan

## Report

5.3 追記・更新ルール（監査性）

Runnerは ## Plan と ## Report を更新してよい

## 前提/制約 と ## 受け入れ条件 は基本は保持（Runnerが追記は可）

needs_input の回答は ## Report か ## Want 末尾に「追記」する（運用で固定することが重要）

6. runs/ 仕様（実行アーティファクト）

runs/ は 参照専用（原則ユーザーが編集しない）。Runnerが生成する。

6.1 ディレクトリ構造
php-template
runs/<request_id>/<run_id>/

6.2 必須ファイル（v1）
runner.log

すべてのログの一次ソース

UIのログビューはこの内容を流す（WS/ポーリング）

stage.json

Runnerの進捗スナップショット（UIの進捗表示の根拠）。最低限：

json
{
"request_id": "RQ-20251214-001-login-timeout",
"run_id": "001",
"status": "running",
"phase": "implementing",
"step": "S02",
"attempt": 1,
"base_branch": "main",
"branch": "ai/RQ-20251214-001-login-timeout",
"started_at": "2025-12-14T13:20:00+09:00",
"updated_at": "2025-12-14T13:24:10+09:00"
}

plan.json

Planの内部表現（D10 planningの成果物）。再開やデバッグに使う。

errors.json

failed / needs_input 時に必須。例：

json
{
"code": "WORKTREE_DIRTY",
"message": "Working tree is dirty. Please commit or stash changes.",
"details": { "files": ["..."] }
}

6.3 任意ファイル（存在すればUIでリンク）

unit.log：unitテスト実行ログ

e2e.log：E2E実行ログ

artifacts.json：補足（コミット一覧、diff統計、生成物のリンク等）

patches/：提案パッチ（将来）

screens/：画像は原則禁止方針なら作らない（v1は未使用推奨）

7. .aiflow/ 仕様（一時領域）

.aiflow/ は動作に必要だが、Git管理しない。

7.1 locks/

.aiflow/locks/runner.lock（全体排他）

.aiflow/locks/<request_id>.lock（Request排他）

ロックファイル内容は最小で良い（PID、開始時刻、host等）。例：

json
{
"pid": 12345,
"started_at": "2025-12-14T13:20:00+09:00",
"request_id": "RQ-20251214-001-login-timeout"
}

7.2 tmp/

途中生成物・一時ファイル

異常終了時に残ってもよい（doctorでclean提案してよい）

8. Git管理方針（推奨）
8.1 Git管理する

requests/*.md

.aiflowrc.json（運用方針による。チーム共有なら管理）

8.2 Git管理しない（推奨）

.aiflow/

runs/

推奨 .gitignore：

.aiflow/
runs/

9. 互換性・移行
9.1 v1→v2で変えうる点

requests/ のサブディレクトリ化（カテゴリ別）

runs/ の圧縮・アーカイブ形式

artifacts.json の拡張

9.2 互換性の最低保証

v1の requests/*.md は将来バージョンでも読み取れる（最重要）

runs/ の欠損は致命ではない（ログが消えてもSSOTが残る）

10. 受け入れ基準（本Spec）

Requestは requests/*.md のみで表現され、IDがファイル名で一意に決まる

Runは runs/<request_id>/<run_id>/ に保存され、上書きされない

stage.json により「再開可能な進捗情報」が保持される

.aiflow/locks により同時実行が防止される

Git管理対象／非対象が明確で、運用が破綻しない

次に運用面を固めるなら、D15（トラブルシュート集：代表エラーコードと復旧手順） を作るのが最も実戦的です。

