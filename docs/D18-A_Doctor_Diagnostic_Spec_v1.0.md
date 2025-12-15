D18-A. Doctor診断仕様（診断コマンド／自己点検）v1.0

対象：aiflow-local（Doctor / Runner / UI）
前提：D11（設定）／D15（TS）／D17-A（ルール）／D17-B（Context）／D17-C（ルールスキーマ）／D18（Runbook）
目的：環境・設定・ルールの破綻を 実行前に検知 し、失敗を「needs_input」で止める。加えて、運用者（あなた）が最短で復旧できる診断レポートを返す。

1. コマンド定義
1.1 CLI

npx aiflow doctor

オプション（v1推奨）

--format json|text（default: text、UIはjson推奨）

--strict（warningをerror扱いにする）

--config <path>（D11）

--rules <path>（D17-Aのルールセット）

--rules-schema <path>（D17-C）

--context-schema <path>（D17-B）

--verbose

1.2 UI

Settings → “Run doctor”

実行結果は「診断一覧（カテゴリ別）」＋「修復コマンド」＋「推奨アクション」を表示

2. 出力仕様
2.1 Text出力（人間向け）

セクション構造（例）

Environment

Repo

Config

Quality Gates

Tools

Summary（PASS/WARN/FAIL）

各項目は必ず「状態」「理由」「修復コマンド」を含む

2.2 JSON出力（機械向け）

doctor-report.json（UIやCI相当で利用可能）

json
{
"version": "1.0.0",
"started_at": "2025-12-14T13:30:00+09:00",
"status": "PASS|WARN|FAIL",
"summary": { "pass": 12, "warn": 2, "fail": 1 },
"checks": [
{
"id": "DOC-REPO-001",
"category": "repo",
"severity": "PASS|WARN|FAIL",
"title": "Git repository detected",
"message": "OK",
"evidence": { "cwd": "/path/to/repo", "git_dir": ".git" },
"fix": []
}
]
}


fix は「実行してよいコマンド」候補。v1では 自動実行しない（表示のみ）。

3. 終了コード（CLI）

0：PASS

1：WARN（ただし --strict の場合は 2）

2：FAIL

4. 診断カテゴリと必須チェック一覧（v1）

Doctorは最低限、以下を実施する。

A) Environment（node/npm, OS, パス）

DOC-ENV-001 Nodeが存在し、最低バージョン以上

FAIL：nodeなし／古すぎる

fix：node -v の結果に応じた案内（導入は手動）

DOC-ENV-002 npm / npx が存在

FAIL：npxなし

fix：npm再導入

DOC-ENV-003 現在ディレクトリが “開発ルート” と判定できる

WARN：判定不確実（package.jsonはあるが .git がない等）

B) Repo（git前提）

DOC-REPO-001 git repo 判定

FAIL：.git がない

fix：git init（ただし通常は誤ディレクトリ）

DOC-REPO-002 worktree clean（D11: require_clean_worktree=true のとき必須）

WARN/FAIL：dirty

fix：git status --porcelain / git stash -u

DOC-REPO-003 origin の存在（トークン不要PRの前提）

WARN：originなし（compare URL生成ができない可能性）

fix：git remote -v

DOC-REPO-004 base branch の存在（D11 base）

WARN：base見つからない

fix：git fetch origin / base名修正

DOC-REPO-005 push可能性の簡易確認（dry）

WARN：認証未確認（v1は実際にpushしない）

evidence：git ls-remote origin の成否（読めないならWARN）

C) Config（D11）

DOC-CFG-001 configファイル読み込み可（JSON/YAMLは実装方針次第）

FAIL：構文エラー

fix：エラー行を提示

DOC-CFG-002 必須キー存在（v1最低限）

baseブランチ

thresholds（D17）

runner retry上限

paths（requests/runs等）

WARN/FAIL：欠落

D) Quality Gates（D17-A/B/C）

DOC-QG-001 ルールファイル存在

FAIL：ファイルなし

fix：デフォルト生成

DOC-QG-002 ルールセットがD17-Cスキーマでvalidateできる

FAIL：構造不正、未知演算子

fix：validateエラー箇所を表示

DOC-QG-003 Contextスキーマ（D17-B）が読み込める

FAIL：スキーマファイル破損

DOC-QG-004 ルール内 when の path がContextに存在する（論理検証）

WARN：存在しないpath

FAIL：存在しないpathがBlocker系ルールで使われている（運用事故防止）

DOC-QG-005 ルールの優先度重複

WARN：重複あり（first-matchが曖昧）

FAIL：status=done ルールが重複で到達不能になる場合

DOC-QG-006 done ルールが最低1つ存在

FAIL：doneがない（永遠にdoneにならない）

DOC-QG-007 危険コマンド検知（actions.cmd）

WARN：git clean -fd, rm -rf, reset --hard 等

--strict ではFAILにしてよい

E) Tools（実行系）

DOC-TOOL-001 PHP / composer の存在（Laravel前提）

WARN：見つからない（unit不可の可能性）

DOC-TOOL-002 vendor/bin/phpunit の存在（Unit実行可否）

WARN：vendor未生成

DOC-TOOL-003 npm test:e2e（または設定キー）の存在

WARN：E2E未整備（回帰ゲートに抵触する可能性）

注意：AI CLI（codex/gemini等）は、あなたの方針で「どうやるかはAIに任せる」ため、Doctorは 存在確認のみ か そもそも診断対象外 としてよい。v1では「aiflow-local自体が起動できること」「品質ゲートが壊れていないこと」を最優先。

5. 重大度（severity）判定ルール

FAIL：実行が成立しない／判定不能／運用事故につながる

WARN：実行はできるが needs_input になりやすい／品質が落ちる

PASS：問題なし

6. Doctorが返す推奨アクション（Priority順）

Doctorは status != PASS の場合、次の順で “次にやること” を提示する。

FAILを潰す（最優先）

QG（ルール/スキーマ）関連WARNを潰す（事故防止）

Repo関連WARN（origin/base/dirty）

Tools関連WARN（phpunit/e2e）

7. 実装メモ（最小の実現方法）

JSON Schema validate：ajv（devDependency）を推奨

file read：node fs

git判定：git rev-parse --is-inside-work-tree 等（git依存OK）

path存在：D17-Bのschemaから properties を再帰走査して “許容パス集合” を生成し、ルールの when から抽出した path と突き合わせ

8. 受け入れ基準（本Spec）

doctorが PASS/WARN/FAIL を一意に出せる

FAILがあるとき、運用者が 次に打つべきコマンド を迷わない

ルール・スキーマの破綻を 実行前に検知 できる

UIがdoctor JSONを読み、カテゴリ別に表示できる

--strict で“運用事故になりそうなWARN”をFAILに昇格できる

次は、Doctorの結果（reason_code）をUIの文言に統一するための D18-B（メッセージ辞書：code→表示文/対処） を作ると、運用が一段楽になります。

