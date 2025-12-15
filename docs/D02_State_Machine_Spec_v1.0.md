状態遷移仕様書（State Machine Spec）v1.0

対象：ローカルDevin風 開発代理システム（aiflow-local）

1. 目的

本書は Request（requests/*.md）の 状態（status） と、その 遷移条件・許可操作・副作用（ログ/ファイル更新） を定義する。
AIが途中停止しうる前提を吸収し、**「止まっても再開できる」「失敗しても原因が残る」「人間の介入点が明確」**な運用を保証する。

2. 対象・前提

対象は Request 単位（1要望=1ファイル）である

同時実行は原則1（キュー処理）。ただし状態定義は同時実行数に依存しない

gh 非依存、git 依存は許容

PR作成は compare URL を提供するまで（作成自体は人間）

3. 状態一覧（status）
状態	意味	実行中	ユーザー入力	再実行	代表例
queued	実行待ち（キュー投入済み or 未実行）	No	Yes	Yes	これから実行
running	代理実行中	Yes	No（原則）	Stop後に可	Plan/Step/テスト実行中
needs_input	追加情報待ちで停止	No	Yes（必須）	Resumeで可	仕様選択・環境情報不足
failed	失敗で停止（自動復旧不可 or 規定超過）	No	任意	Yes	テストが収束しない等
done	完了	No	任意	任意（通常不要）	push済み、PR導線あり

補助的な概念（状態ではなく属性として扱う）：

run_id：最新実行の識別子（例：001）

attempt：同一run内の自動リトライ回数

blocked_reason：needs_inputの理由

pr_url：compare URL（doneで必須）

4. イベント（遷移トリガー）一覧

本システムの状態遷移は、以下のイベントで発火する。

4.1 ユーザー操作イベント

CREATE_REQUEST：Request作成

EDIT_REQUEST：Request編集（要望本文・priority等）

ENQUEUE：実行キュー投入（Run）

STOP：実行停止（Stop）

RESUME：needs_inputから再開（Resume）

RERUN：failed/doneから再実行（Re-run）

RESET_TO_QUEUED：状態をqueuedに戻す（任意機能）

4.2 システム/Runnerイベント

RUN_START：Runnerが実行を開始

PLAN_OK：Plan生成が成功

PLAN_BAD：Planの品質検査に不合格（再生成が必要）

STEP_OK：Step完了（コミットまで完了）

STEP_BAD：Step品質不合格（差分超過・未完了・ルール違反等）

TEST_OK：テスト成功

TEST_FAIL：テスト失敗

PUSH_OK：push成功

PUSH_FAIL：push失敗

NEED_INPUT_DETECTED：追加情報が必要と判定

RUN_COMPLETE：完了条件達成

RUN_ABORTED：停止処理完了（Stop反映）

RUN_FATAL：致命的エラー（環境不備等）

RETRY_EXHAUSTED：規定回数を超えて収束しない

5. 状態遷移図（テキスト）
scss
queued
└─(RUN_START)→ running

running
├─(NEED_INPUT_DETECTED)→ needs_input
├─(RUN_FATAL or RETRY_EXHAUSTED)→ failed
├─(STOP)→ queued  ※安全に止められた場合
└─(RUN_COMPLETE)→ done

needs_input
├─(RESUME)→ queued  ※再キュー投入してから実行
├─(RERUN)→ queued   ※同義（RESUME推奨）
└─(RESET_TO_QUEUED)→ queued

failed
├─(RERUN)→ queued
└─(RESET_TO_QUEUED)→ queued

done
├─(RERUN)→ queued   ※通常は不要（例：追加修正）
└─(RESET_TO_QUEUED)→ queued


注：running → queued のSTOP遷移は「中断時点までの成果が安全に保存されている」ことが前提。保存不完全の場合は running → failed とする。

6. 状態別：許可操作とUI挙動
6.1 queued

許可操作

編集（要望本文、priority、tags）

Run（ENQUEUE）

Reset（同状態なので実質なし）

表示要件

直近のPlan/Reportがあれば表示（過去実行の成果として）

遷移

Run（ENQUEUE）→ queued のまま（キュー投入）

Runnerが取り出す（RUN_START）→ running

6.2 running

許可操作

Stop（STOP）※必須

ログ閲覧

禁止操作（原則）

要望本文の編集（実行中の仕様が変わるのを防ぐ）

priority変更（実行中の順序は変更しない）

表示要件

実行ステージ（Plan/Step/Test/Push等）の現在地が分かること

ログがリアルタイム表示されること

遷移

追加情報が必要（NEED_INPUT_DETECTED）→ needs_input

致命エラー/収束不能（RUN_FATAL / RETRY_EXHAUSTED）→ failed

Stop（STOP）→ 原則 queued（安全停止成功）

ただし安全停止失敗時は failed

完了（RUN_COMPLETE）→ done

6.3 needs_input

許可操作

回答入力（指定箇所への追記）

Resume（RESUME）

表示要件

blocked_reason（質問/不足情報）を必ず表示

「どこで止まったか」（Plan/Step番号/テスト段階）を表示

ユーザーが回答すべき項目を具体的に示す

遷移

Resume（RESUME）→ queued（再キュー投入）

Reset → queued

6.4 failed

許可操作

Re-run（RERUN）

編集（要望補足、制約追記）※推奨

Reset（queuedに戻す）

表示要件

失敗理由の要約（最後の致命ログ、失敗したテスト、回数超過等）

どこまで進んだか（最後に完了したStep/コミット）

次アクション提案（再実行条件、必要な補足）

遷移

Re-run（RERUN）→ queued

6.5 done

許可操作

Open PR（compare URLを開く）

編集（要望の追記は可能だが、通常は新Request推奨）

Re-run（追加修正時のみ）

表示要件

pr_url（compare URL）が必ず存在すること

完了したAC一覧、テスト結果、主要差分がReportにまとまっていること

遷移

Re-run（RERUN）→ queued（追加修正のため）

7. 状態遷移のガードルール（重要）
7.1 実行中編集禁止

running 中に要望本文（要件）を変更してはならない

変更が必要な場合は STOP して queued に戻してから編集する

7.2 needs_input は“質問が明示できる”場合のみ

追加情報が必要な場合、必ず

質問

なぜ必要か

どの形式で答えるか
を blocked_reason（および本文の指定セクション）に残して停止する

7.3 failed と needs_input の分離

ユーザーの意思決定が必要 → needs_input

ユーザーが介入しても良いが、まずは原因解消が必要（環境/テスト収束） → failed

7.4 Stopの扱い（安全停止）

Stopは「できる限り queued に戻す」を基本とするが、以下は failed とする。

git作業ディレクトリが壊れた／整合しない

実行中に不可逆な途中状態が残り、再開不能

ログ保存が不完全で原因追跡が困難

8. 実行フェーズの内部状態（statusとは別）

running 中の進捗をUIに表示するため、内部フェーズを定義する（statusではない）。

phase = planning

phase = implementing (step N/M)

phase = testing (unit|integration|e2e)

phase = documenting

phase = pushing

phase = reporting

要件：

running 中は常に現在の phase がUIに表示されること

9. リトライと収束ルール（状態遷移に関わる規定）
9.1 自動リトライ対象

Plan品質不合格（PLAN_BAD）

Step品質不合格（STEP_BAD）

テスト失敗（TEST_FAIL）※自己修正で収束可能な範囲

9.2 自動リトライ回数

同一run内の自動リトライは上限を持つ（値は設定で可変）

上限超過時：RETRY_EXHAUSTED → failed

9.3 needs_input 優先

仕様選択や不足情報が原因で収束しない場合は、リトライで粘らず needs_input に遷移する
（「何を聞けば解決するか」を明示できることが前提）

10. 状態更新の永続化要件

状態変更は必ず requests/<id>.md の frontmatter に反映する

状態変更のたびに last_run（またはlast_update）を更新する

running になったら run_id を採番し、runs/<id>/<run_id>/ を作成する

done になったら pr_url が必須（空ならdone不可、PUSH_FAIL扱い）

11. 受け入れ基準（本Spec）

状態は queued/running/needs_input/failed/done の5種で表現される

各状態で許可される操作が明確に分かれ、UIでも制御される

Stop/Resume/Re-run が一貫したルールで動作する

needs_input と failed が混線せず、停止理由が追跡可能である

done時にPR導線（pr_url）が必ず提供される

次に作るべき関連ドキュメントは D3（Requestファイル仕様） と D4（Step Plan仕様） です。特にD4がないと「途中で止まる」対策が仕様として固定できないため、優先度はD4が最上位になります。

