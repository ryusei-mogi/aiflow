D57. runs/ 成果物ディレクトリ規約（必須ファイル・命名・ログ・容量）v1.0

対象：runs/<request-id>/<run-id>/ 配下の成果物一式
目的：Runner/UI/CLIが同じ規約で参照でき、失敗しても「何が起きたか／次に何をするか」が必ず残る状態に固定する。
前提：SSOTは stage.json（D56）／計画は planning.json（D55）／reportは report.md（D37）／errorsは errors.json（D33テンプレ）／gh禁止／git依存OK。

1. ディレクトリ構造（v1固定）
lua
runs/
<request-id>/
<run-id>/
stage.json
planning.json
report.md
errors.json              (needs_input / failed のときのみ推奨)
quality_context.json     (任意だがv1推奨：D17-B相当)
patches/
S01.patch
S02.patch              (将来)
logs/
meta.json
doctor.json            (任意：run開始時に保存しても良い)
router.planner.log
router.implementer.log
router.qa.log
llm.planner.raw.txt
llm.implementer.raw.txt
llm.qa.raw.txt
git/
status.before.txt
status.after.txt
diff.base...head.patch
apply.check.txt
apply.result.txt
tests/
unit.S01.log
unit.S01.json         (任意：JUnit変換など)
e2e.S01.log
tmp/                     (実行中のみ。終了時に掃除してよい)

2. run-id 命名規則（v1）

形式（推奨）：YYYYMMDD-HHMMSS-<6hex>

例：20251214-210501-a1b2c3

生成要件

同一request内で衝突しない

ソートすると時系列になる（日時プレフィックス）

3. 必須ファイル（MUST）
ファイル	必須	役割	SSOT
stage.json	✅	Run状態（UI表示・再開判断）	✅
planning.json	✅	Step分割計画（Runner参照）	✅（計画SSOT）
report.md	✅	人間向け要約＋ACチェック＋総合テスト欄	⛔（監督ログ）
patches/	✅	patch格納	⛔
logs/	✅	実行ログ格納	⛔

生成タイミング（推奨）

report.md は Run開始直後に雛形作成（失敗しても残る）

stage.json は INIT開始時点で作成（空でもよいがJSONとして成立させる）

planning.json は PLANNING完了時点で作成（失敗ならerrorsへ）

4. 条件付き必須（MUST if）
ファイル	条件	目的
errors.json	stateが NEEDS_INPUT or FAILED	reason_code/actions を機械的に参照可能にする（UI表示にも使える）
logs/git/apply.check.txt	patch生成した	git apply --check の結果を残す
logs/tests/unit.*.log	unitがenabled	unitログを必ず残す
5. logs 命名規則（v1）
5.1 役割別ログ

router.<role>.log：Runner側が残す（開始・終了・exit code・ファイルパス）

llm.<role>.raw.txt：CLIの生出力（改変しない）

例：llm.implementer.raw.txt

5.2 gitログ

git/status.before.txt / git/status.after.txt

git/diff.base...head.patch（任意：差分退避）

git/apply.check.txt / git/apply.result.txt

5.3 テストログ

tests/unit.<step_id>.log

tests/e2e.<step_id>.log

将来：JUnit等に変換するなら tests/unit.<step_id>.xml を追加して良い（v1任意）

6. patches 規約（v1）

1 step = 1 patch（原則）

ファイル名：<step_id>.patch

例：S01.patch

patch内容：unified diff

Runnerは patch生成後に以下を実施してログ化

git apply --check <patch>（結果を apply.check.txt）

modeがauto-applyのときのみ git apply を実行（結果を apply.result.txt）

7. quality_context.json（推奨：v1で生成）

目的：Quality gate 判定や report生成の材料を1ファイルに集約する。

生成場所：runs/.../quality_context.json

最低限含めたいキー（例）

request.id/path/priority

repo.is_git_repo / worktree.clean / base_branch.exists

thresholds / checks.unit.status / checks.e2e.status

planner.step.too_large など

v1で必須にしない理由：初期ブートでの摩擦を減らす。ただし運用安定のため推奨。

8. meta.json（推奨）

logs/meta.json は run実行の「最小監査ログ」。UIで出してもよい。
推奨内容：

実行コマンド（aiflow run ...）

config/routerの実ファイルパスとハッシュ（任意）

OS/Nodeバージョン（doctorと重複しても良い）

9. 容量管理・掃除ポリシー（v1）
9.1 gitignore

runs/ は .gitignore 対象（SSOTはファイルだが、運用上は生成物なので非管理）

9.2 サイズ上限（推奨）

llm.*.raw.txt は 最大5MB を目安（超過時は末尾切り捨て可。ただし先頭/末尾の両方を残す運用が望ましい）

tmp/ は run終了時に削除してよい（失敗時も削除可）

9.3 自動クリーン（任意）

aiflow clean --older-than 30d のような将来コマンドで削除できる設計が望ましい（v1.1）

10. UI参照パス（契約）

UIは stage.json の artifacts.* を参照し、以下をリンク表示できること：

report_md（Markdown表示）

errors_json（あれば）

patches（一覧）

logs_dir（一覧 or 主要ログへのショートカット）

11. 受け入れ基準（D57）

失敗しても stage.json と report.md が必ず残る

needs_input/failed では errors.json が生成され、reason_code/actionsが残る

patchが生成される場合、patches/Sxx.patch と git apply --check ログが残る

unit/e2e を実行した場合、ログが必ず logs/tests/ に残る

UI/CLIはパス規約に依存しても壊れない（相対パスで一貫）

次は、運用が止まりにくくなる D58. errors.json 最終仕様（category/reason_code/actions の必須要件＋UI表示ルール） を固めるのが順番として最適です。

