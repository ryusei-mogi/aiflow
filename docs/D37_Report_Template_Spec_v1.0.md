D37. Reportテンプレ（受け入れ条件チェック欄・総合テスト記録欄・差し戻し欄）v1.0

対象：runs/<request-id>/<run-id>/report.md（成功/失敗を問わず必ず生成）
目的：あなたが行う 総合テスト（要件マッチ確認） を最短で回せるように、Run結果の要点とチェック欄を標準化する。
前提：ローカル完結／gh禁止／gitはOK／既存仕様は壊さない。

1. Reportの位置付け（v1）

report.md は SSOTではない（SSOTは requests と stage/errors/logs）

ただし、人間の判断（受け入れ/差し戻し）を記録する “監督用ログ” として必須

失敗時も「途中までの成果」「止まった理由」「次アクション」を残す

2. report.md の生成タイミング（v1）

Run開始直後：雛形生成（INIT）

各Step完了：Progress追記

DONE/NEEDS_INPUT/FAILED：最終追記（Summary/Next Actions/判定欄）

3. report.md テンプレ（v1・コピペ版）

これを aiflow が生成する標準テンプレとする。

md
# Run Report

- request_id: {{request_id}}
- run_id: {{run_id}}
- status: {{status}}   <!-- DONE | NEEDS_INPUT | FAILED -->
- started_at: {{started_at}}
- finished_at: {{finished_at}}
- base_branch: {{base_branch}}
- working_branch: {{working_branch}} <!-- 作成した場合のみ -->

## 1) Summary
- 目的（要望の要約）：{{request_summary_1line}}
- 結果：{{result_1line}}
- 主要な変更点：{{highlights_bullets}}

## 2) Acceptance Criteria（受け入れ条件チェック）
> ここは最終的に「あなた」が総合テストで埋める。aiflowは初期状態を生成し、実行ログや差分から補助コメントを入れてよい。

{{acceptance_checklist}}

例：
- [ ] AC-01 条件Aのとき画面Xで〜〜（総合テスト：未）
- 補助：関連ファイル {{maybe_files}}
- [ ] AC-02 条件BのときAPIが〜〜（総合テスト：未）
- [ ] AC-03 既存フローYが回帰しない（E2Eで担保）（総合テスト：未）

## 3) Integrated Test Log（総合テスト記録）
- 実施者：茂木
- 実施日時：{{integrated_test_at}} <!-- 手入力 -->
- 環境：local
- 手順：
1. {{manual_step_1}}
2. {{manual_step_2}}
3. {{manual_step_3}}
- 結果：
- 期待：{{expected}}
- 実測：{{observed}}
- 判定：
- [ ] OK（受け入れ）
- [ ] NG（差し戻し）

## 4) Progress（ステップ進捗）
{{progress_table}}

例：
| Step | Title | Status | Attempts | Notes |
|---|---|---|---:|---|
| S01 | Layout | done | 1 | - |
| S02 | Server API | done | 1 | - |
| S03 | UI | needs_input | 2 | UNIT_TEST_FAILED |

## 5) Evidence（証跡）
- stage: `runs/{{request_id}}/{{run_id}}/stage.json`
- planning: `runs/{{request_id}}/{{run_id}}/planning.json`
- errors: `runs/{{request_id}}/{{run_id}}/errors.json` （ある場合）
- logs: `runs/{{request_id}}/{{run_id}}/logs/`
- diff: {{diff_pointer}} <!-- git diff コマンドやファイルパス -->

## 6) Quality Gates（ゲート結果）
{{quality_gates_result}}

例：
- G-01 No gh dependency: PASS
- G-02 Runs is gitignored: PASS
- G-03 Stage exists: PASS
- G-04 Report exists: PASS
- G-05 Server health: WARN（起動順の問題）

## 7) Rollback / Safety Notes（安全面）
- 影響範囲：{{impact_scope}}
- 破壊的変更：{{breaking_changes}} <!-- ないなら "なし" -->
- データ影響：{{data_impact}}       <!-- ないなら "なし" -->
- フラグ/設定変更：{{config_changes}}

## 8) Review Findings（差し戻し欄）
> NGの場合は “何を直せばOKか” を短く書く（次Runの input になる）

- NG理由：
- {{rejection_reason_1}}
- 修正指示（最小）：
1. {{fix_instruction_1}}
2. {{fix_instruction_2}}

## 9) Next Actions（次のアクション）
{{next_actions}}

例：
- 1) WORKTREE_DIRTY を解消（commit or stash）
- 2) Retry step S03
- 3) 再Run後に総合テスト

4. aiflow が自動で埋めて良い項目（v1）

Summary（変更点の箇条書き）

Progress（stepの状態・試行回数・reason_code）

Evidence（パス、ログの場所、diffコマンドの提案）

Quality Gates（PASS/WARN/FAIL一覧）

Next Actions（reason_code辞書に基づく復帰手順）

5. 人間が埋めるべき項目（v1）

Integrated Test Log（総合テストの手順・実測）

ACチェック欄の最終チェック（✅/差し戻し）

Review Findings（NG時の最小修正指示）

6. 受け入れ基準（D37）

report.md に「ACチェック欄」と「総合テスト記録欄」が必ず存在する

NEEDS_INPUT/FAILED でも “途中までの成果” と “次にやること” が残る

あなたがブラウザで動作確認する際、reportを見れば 確認観点が漏れない

次に作るべきは、reportとrequestsを接続して運用を回すための D38. Request→Runリンク仕様（latest_runの決め方、done判定時のメタ更新、blocked復帰時のメタ更新） です。

