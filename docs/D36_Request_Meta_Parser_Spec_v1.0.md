D36. Requestメタ形式・パーサ仕様（壊れにくい書式／自動整形ルール）v1.0

対象：requests/*.md の先頭メタ行の読み書き
目的：UIで priority/status/labels/depends_on を編集してもMarkdown本文を壊さず、機械で安定して解析・更新できる形式を確定する。
前提：ローカル完結／既存仕様は壊さない／requestsはGit管理する。

1. メタ形式（v1固定）
1.1 “Frontmatter風” だが YAML は使わない

YAMLは表現力が高く、壊れやすい（クォート・インデント）ため v1では採用しない

v1は 先頭連続行の key: value のみをメタとみなす

1.2 メタブロック範囲

ファイル先頭から開始

空行が出た時点で終了

以降は本文（Markdown）として扱う

例：

md
priority: P0
status: ready
labels: [aiflow, bootstrap]
depends_on: [RQ-20251214-000-something]
estimate: M
created_at: 2025-12-14
updated_at: 2025-12-14

# タイトル
本文...

2. 対応キー（v1）
2.1 必須キー

priority：P0|P1|P2|P3

status：draft|ready|running|blocked|done|archived

2.2 任意キー

labels：[a, b, c]（文字列配列）

depends_on：[RQ-..., RQ-...]（文字列配列）

estimate：S|M|L

created_at：YYYY-MM-DD

updated_at：YYYY-MM-DD

2.3 未知キー

保持する（preserve）

UIが編集しないキーでも、読み取り→保存の往復で消さない

3. 値の文法（v1）
3.1 共通

key は [a-z_]+ のみ

: の前後の空白は任意（保存時は key: value に正規化）

3.2 スカラー（string）

改行なしの1行文字列

例：priority: P1

3.3 配列（string[]）

角括弧 [...] 形式のみ

区切りは ,

要素は trim して扱う

要素はクォート不要（ただし ] や , を含む文字列はv1では禁止）

例：

labels: [aiflow, bootstrap]

depends_on: []

4. パース仕様（v1）
4.1 出力モデル（内部表現）
ts
type RequestMeta = {
priority?: "P0"|"P1"|"P2"|"P3";
status?: "draft"|"ready"|"running"|"blocked"|"done"|"archived";
labels?: string[];
depends_on?: string[];
estimate?: "S"|"M"|"L";
created_at?: string;   // YYYY-MM-DD
updated_at?: string;   // YYYY-MM-DD
unknown: Record<string, string>; // 未知キーは文字列として保持
};

type ParsedRequest = {
id: string;            // filename without .md
path: string;
meta: RequestMeta;
title: string;         // first "# " line (fallback to filename)
body_markdown: string; // metaブロック除去後の全文
raw: string;           // 元テキスト（必要なら）
};

4.2 title抽出

本文（meta除去後）から最初に出現する ^#\s+(.+)$ を title とする

無ければ id を title とする

5. バリデーション仕様（v1）
5.1 必須キー欠落時

APIは WARN 扱いで返す（UIで編集を促す）

自動選定（D35）は、必須キー欠落は “最後” に回す（安全側）

5.2 不正値

priority/status が不正：WARN（UIで修正促し）

配列が壊れている（labels: [a, など）：WARN + parse_error フラグ

パース不能でも本文は表示できるようにし、保存時に “メタ修復” を提案する

6. 書き戻し仕様（v1）
6.1 原則

UIが meta を更新する場合は metaブロックのみ を再生成し、本文は変更しない

ただし updated_at は自動更新してよい

6.2 メタの正規化（保存フォーマット）

キー順は固定（v1）

priority

status

labels

depends_on

estimate

created_at

updated_at

unknown（キー名辞書順）

配列は [, ] を正規化し、labels: [a, b] の形式で出力

metaブロック末尾に必ず空行を1つ入れる（本文との境界）

6.3 created_at / updated_at の規則

created_at が無ければ初回保存時に付与してよい

updated_at は保存のたびに当日で更新してよい

7. APIの取り扱い（D21補足）
7.1 PATCH meta

PATCH /api/requests/:id/meta

bodyは更新したいキーのみ

json
{
"priority": "P1",
"status": "ready",
"labels": ["aiflow", "bootstrap"]
}


Serverは

既存metaをparse

指定キーだけ更新

正規化して書き戻し

responseとして parse済みの ParsedRequest を返す

8. 受け入れ基準（D36）

metaブロックの境界が明確で、本文を壊さず編集できる

未知キーを保持できる（往復で消えない）

壊れたメタでもUIで閲覧でき、修復可能

自動選定（D35）がメタ欠落/不正値で破綻しない

次に作るべきは、ここまでの運用（D35/D36）を “Runの成果物” と結びつけて監督しやすくする D37. Reportテンプレ（受け入れ条件チェック欄・総合テスト記録欄・差し戻し欄） です。

