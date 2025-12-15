D3. Requestファイル仕様（requests/*.md Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）

1. 目的

本書は、バックログのSSOT（Single Source of Truth）である requests/*.md のファイル形式・必須項目・更新ルール・禁止事項を定義する。
Requestファイルは「人間の要望」「AIの計画（Plan）」「AIの実行結果（Report）」を同一ファイルに集約し、状態管理（D2）とUI表示（D1）を成立させる。

2. スコープ

requests/ 配下に置かれる 1要望=1Markdownファイル を対象とする

Requestの作成・編集は原則UI経由だが、手動編集も許容する（ルールを明示）

実行ログ等の詳細は runs/ に保存し、本書の対象外とする（参照のみ）

3. ファイル命名規則
3.1 パス

requests/<request_id>.md

3.2 request_id（推奨）

形式（推奨）：YYYYMMDD-<slug>
例：20251214-login-timeout.md

slug は英小文字・数字・ハイフンのみ（[a-z0-9-]+）

request_id はファイル名（拡張子除く）と一致すること

3.3 代替形式（許容）

連番型：REQ-000123（ただし採番規則が別途必要になるため推奨度は下げる）

4. ファイル構造（必須レイアウト）

Requestファイルは以下の順序で構成する。

YAML frontmatter（必須）

本文（Markdown）：必須セクションを含む

4.1 YAML frontmatter（必須）

ファイル先頭に --- で囲まれた YAML を持つこと。

4.1.1 必須キー
キー	型	例	説明
id	string	20251214-login-timeout	request_id（拡張子除く）
title	string	ログイン放置後のタイムアウト改善	一覧表示用の短いタイトル
priority	string	P0	P0/P1/P2/P3（定義は後述）
status	string	queued	queued/running/needs_input/failed/done
base	string	main	ベースブランチ名
branch	string	ai/20251214-login-timeout	作業ブランチ名
created_at	string(ISO8601)	2025-12-14T09:10:00+09:00	作成日時
updated_at	string(ISO8601)	2025-12-14T10:00:00+09:00	最終更新日時（UI/Runnerが更新）
4.1.2 状態に応じて必須となるキー
状態	必須キー	説明
running	run_id, phase	現在の実行識別子と進捗フェーズ
needs_input	blocked_reason	ユーザーに求める入力（質問）
failed	failure_reason	失敗要約（最後の原因）
done	pr_url, last_commit	compare URL、最終コミット
4.1.3 任意キー（推奨）
キー	型	例	説明
tags	string[]	["auth","e2e"]	フィルタ用
estimate	object	{steps: 5}	見積りメタ（任意）
assignee	string	ai	ほぼ固定でもよい
attempt	number	2	同一run内の自動リトライ回数
model_profile	string	codex	実行プロファイル名（任意）
links	object	{design: "...", ref: "..."}	参照リンク
4.1.4 priority の定義

P0：最優先（今すぐ）

P1：高

P2：中

P3：低

※UIは P0→P3 の順でソートし、同一priorityは updated_at desc を推奨。

5. 本文（Markdown）仕様
5.1 必須セクション

本文は以下の見出し（h1/h2）を必ず含む。

# 要望

## Plan

## Report

順序は固定（要望 → Plan → Report）。

5.2 各セクションの役割と編集権限
セクション	主担当	手動編集	説明
# 要望	ユーザー	可	要望本文。最小入力でよい
## Plan	AI/Runner	可（ただし注意）	仕様化・AC・Step計画。通常はAIが更新
## Report	AI/Runner	可（追記のみ推奨）	実行結果ログの要約。改ざんは非推奨
5.3 # 要望 の推奨テンプレ（任意）

要望は最小でよいが、運用を安定させるため以下テンプレを推奨する（空でも可）。

md
# 要望
## 前提/制約
- PHP/Laravel
- DBはMySQL
- 既存仕様は壊さない

## 受け入れ条件（最低3つ）
- [ ] 条件Aのとき画面Xで〜〜
- [ ] 条件BのときAPIが〜〜
- [ ] 既存のフローYが回帰しない（E2Eで担保）

## テスト指示（あれば）
- E2E: ログイン→放置→操作→期待結果
- 単体: サービス層の〜〜


ただし「どうやってやるか」はAIに任せる方針のため、ここは“要求”のみで良い。

5.4 ## Plan の必須内容（最低限）

PlanはMarkdownとして保存され、少なくとも以下を含む。

目的（何を達成するか）

受け入れ条件（最低3つ、チェック可能）

Step計画（Step番号、目的、Done条件、想定変更範囲）

リスク/不明点（あれば）

needs_input に該当する質問（あれば、本文にも残す）

※詳細なStep定義はD4に従う（本書では「含めること」を要求する）。

5.5 ## Report の必須内容（最低限）

Reportは追記され、少なくとも以下を含む。

実行要約（何をしたか）

AC充足状況（満たした/未達/保留）

Step実行履歴（Stepごとに結果、コミット）

実行したテストと結果（コマンド含む）

PR導線（done時は pr_url を本文にも記載推奨）

残課題/リスク（あれば）

6. 更新ルール（誰がいつ何を更新するか）
6.1 UIが更新する項目（原則）

title, priority, tags

# 要望 の本文

updated_at

6.2 Runnerが更新する項目（原則）

status（D2の状態遷移に従う）

run_id, phase, attempt

blocked_reason, failure_reason

pr_url, last_commit

updated_at

## Plan / ## Report の追記・更新

6.3 手動編集の許容範囲

許容：# 要望 の追記修正、priority の変更（queued/failed時）

可能：## Plan の微修正（ただし実行結果と齟齬が出るため推奨しない）

非推奨：## Report の改変（監査性を損なう）

禁止：running 中の # 要望 変更（D2のガードルール）

7. 整合性ルール（バリデーション要件）
7.1 ID整合

frontmatter.id はファイル名（拡張子除く）と一致しなければならない

7.2 status整合

status は定義済み5種のみ

状態に応じた必須キーが欠けている場合、UIは警告し、Runnerは実行を拒否して failed（またはneeds_input）にする

7.3 更新日時

updated_at は必ず created_at 以上

Runnerは状態遷移時に updated_at を更新する

7.4 branch整合

branch は空であってはならない（作業単位が不明瞭になるため）

推奨：ai/<id> 形式

8. 例（完全なRequestファイル例）
md
---
id: 20251214-login-timeout
title: ログイン放置後のタイムアウト改善
priority: P0
status: queued
base: main
branch: ai/20251214-login-timeout
tags: ["auth","session"]
created_at: 2025-12-14T09:10:00+09:00
updated_at: 2025-12-14T09:10:00+09:00
---

# 要望
## 前提/制約
- PHP/Laravel
- DBはMySQL
- 既存仕様は壊さない

## 受け入れ条件（最低3つ）
- [ ] 条件Aのとき画面Xで〜〜
- [ ] 条件BのときAPIが〜〜
- [ ] 既存のフローYが回帰しない（E2Eで担保）

## テスト指示（あれば）
- E2E: ログイン→放置→操作→期待結果

## Plan
（AIがここに追記）

## Report
（AI/Runnerがここに追記）

9. 受け入れ基準（本Spec）

requests/*.md は frontmatter + 必須セクション（要望/Plan/Report）を持つ

status と必須キーが整合する

UIとRunnerが更新する領域が分離され、running中の編集禁止が守られる

done時に pr_url が frontmatter に存在する（なければdoneにならない）

10. 関連（依存）

D1：機能仕様書（UIでの表示・操作）

D2：状態遷移仕様書（status/ガードルール）

D4：Step Plan仕様（Planの中身の厳密定義）

D5：レポート仕様（Reportの中身の厳密定義）

次は D4（Step Plan仕様） を作るのが最優先です。ここが固まると「途中で止まる」問題を、仕様として完全に潰せます。

