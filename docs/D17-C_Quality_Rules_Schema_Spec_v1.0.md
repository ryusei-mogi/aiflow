D17-C. 品質ゲートルール定義スキーマ（Quality Rules Schema Spec）v1.0

対象：aiflow-local（Quality Gate Engine / Runner / UI）
前提：D17-A（ルールJSON）／D17-B（Context Schema）
目的：.aiflow/quality-gates.*.json（ルールセット）を ロード時に検証 し、typo・不正構文・危険な設定を事前に弾く

1. スコープ

ルールセットファイル（例：.aiflow/quality-gates.v1.json）の構造検証

when 条件式の形式検証（最低限）

decision の必須項目検証

priority の重複検出（追加の論理検証：スキーマ外のdoctorチェック推奨）

2. 設計方針（v1の割り切り）

JSON Schemaだけで完全な式検証（when 内のフィールドパスがContextに存在するか等）までは行わない
→ それは doctor（論理検証）で行う（後述）

v1では when の演算子セットを固定し、未知の演算子は validateで拒否

3. ルールセットのスキーマ（Draft 2020-12）

ファイル想定：schemas/quality-rules.v1.schema.json

json
{
"$schema": "https://json-schema.org/draft/2020-12/schema",
"$id": "https://aiflow.local/schemas/quality-rules.v1.schema.json",
"title": "aiflow-local Quality Gate Rules",
"type": "object",
"additionalProperties": false,
"required": ["version", "rules"],
"properties": {
"version": {
"type": "string",
"pattern": "^[0-9]+\\.[0-9]+$"
},
"rules": {
"type": "array",
"minItems": 1,
"items": { "$ref": "#/$defs/rule" }
}
},

"$defs": {
"rule": {
"type": "object",
"additionalProperties": false,
"required": ["id", "priority", "when", "decision"],
"properties": {
"id": {
"type": "string",
"pattern": "^QG-[A-Z0-9-]+$"
},
"priority": {
"type": "integer",
"minimum": 1,
"maximum": 9999
},
"when": { "$ref": "#/$defs/expr" },
"decision": { "$ref": "#/$defs/decision" }
}
},

"decision": {
"type": "object",
"additionalProperties": false,
"required": ["status", "error_code", "severity", "message", "actions"],
"properties": {
"status": { "type": "string", "enum": ["needs_input", "failed", "done"] },
"error_code": {
"type": "string",
"pattern": "^[A-Z0-9_]+$",
"minLength": 2
},
"severity": { "type": "string", "enum": ["Blocker", "Major", "Minor"] },
"message": { "type": "string", "minLength": 1 },
"actions": {
"type": "array",
"items": { "$ref": "#/$defs/action" }
}
}
},

"action": {
"type": "object",
"additionalProperties": false,
"required": ["label", "cmd"],
"properties": {
"label": { "type": "string", "minLength": 1, "maxLength": 80 },
"cmd": { "type": "string", "minLength": 1, "maxLength": 500 }
}
},

"expr": {
"description": "Boolean expression AST for rule evaluation.",
"oneOf": [
{ "$ref": "#/$defs/expr_all" },
{ "$ref": "#/$defs/expr_any" },
{ "$ref": "#/$defs/expr_not" },
{ "$ref": "#/$defs/expr_eq" },
{ "$ref": "#/$defs/expr_ne" },
{ "$ref": "#/$defs/expr_gt" },
{ "$ref": "#/$defs/expr_gte" },
{ "$ref": "#/$defs/expr_lt" },
{ "$ref": "#/$defs/expr_lte" },
{ "$ref": "#/$defs/expr_exists" },
{ "$ref": "#/$defs/expr_in" }
]
},

"expr_all": {
"type": "object",
"additionalProperties": false,
"required": ["all"],
"properties": {
"all": {
"type": "array",
"minItems": 1,
"items": { "$ref": "#/$defs/expr" }
}
}
},

"expr_any": {
"type": "object",
"additionalProperties": false,
"required": ["any"],
"properties": {
"any": {
"type": "array",
"minItems": 1,
"items": { "$ref": "#/$defs/expr" }
}
}
},

"expr_not": {
"type": "object",
"additionalProperties": false,
"required": ["not"],
"properties": {
"not": { "$ref": "#/$defs/expr" }
}
},

"expr_eq": {
"type": "object",
"additionalProperties": false,
"required": ["eq"],
"properties": {
"eq": { "$ref": "#/$defs/cmp2" }
}
},
"expr_ne": {
"type": "object",
"additionalProperties": false,
"required": ["ne"],
"properties": {
"ne": { "$ref": "#/$defs/cmp2" }
}
},
"expr_gt": {
"type": "object",
"additionalProperties": false,
"required": ["gt"],
"properties": {
"gt": { "$ref": "#/$defs/cmp2" }
}
},
"expr_gte": {
"type": "object",
"additionalProperties": false,
"required": ["gte"],
"properties": {
"gte": { "$ref": "#/$defs/cmp2" }
}
},
"expr_lt": {
"type": "object",
"additionalProperties": false,
"required": ["lt"],
"properties": {
"lt": { "$ref": "#/$defs/cmp2" }
}
},
"expr_lte": {
"type": "object",
"additionalProperties": false,
"required": ["lte"],
"properties": {
"lte": { "$ref": "#/$defs/cmp2" }
}
},

"expr_exists": {
"type": "object",
"additionalProperties": false,
"required": ["exists"],
"properties": {
"exists": {
"type": "array",
"minItems": 1,
"maxItems": 1,
"items": { "$ref": "#/$defs/path" }
}
}
},

"expr_in": {
"type": "object",
"additionalProperties": false,
"required": ["in"],
"properties": {
"in": {
"type": "array",
"minItems": 2,
"maxItems": 2,
"items": [
{ "$ref": "#/$defs/value" },
{
"type": "array",
"minItems": 1,
"items": { "$ref": "#/$defs/value" }
}
]
}
}
},

"cmp2": {
"type": "array",
"minItems": 2,
"maxItems": 2,
"items": [
{ "$ref": "#/$defs/value" },
{ "$ref": "#/$defs/value" }
]
},

"value": {
"description": "Either a field-path string or a literal value.",
"oneOf": [
{ "$ref": "#/$defs/path" },
{ "type": "string" },
{ "type": "number" },
{ "type": "integer" },
{ "type": "boolean" },
{ "type": "null" }
]
},

"path": {
"type": "string",
"pattern": "^[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*$"
}
}
}

4. Doctor（論理検証）で追加チェックすべき項目

JSON Schemaでは完全に担保できないため、aiflow doctor（D18で手順化）で次を行うのが推奨です。

priority の重複検出（first-matchが曖昧になる）

id の重複検出

when 内の path が quality-context に存在するか（D17-Bのスキーマと照合）

done ルールが少なくとも1つあるか

decision.status=done のルールで error_code=OK を推奨（任意）

status=done が 他のルールに食われて到達不能 になっていないか（簡易解析）

actions[].cmd の危険コマンド検知（git clean -fd, rm -rf 等）
※v1は「表示するだけ」だが、警告は出す

5. 受け入れ基準（本Spec）

ルールセットがロード時にJSON Schemaでvalidateされる

未知の演算子・構造ミス・必須項目欠落を確実に検出できる

when の式がASTとして整合し、評価エンジンが安全に解釈できる

追加の論理検証は doctor で実施する前提が明文化されている

必要なら次は、D17-B（Context Schema）とD17-C（Rules Schema）を使って doctorが出す具体的な警告文テンプレ（例：WARN_DUPLICATE_PRIORITY, WARN_UNKNOWN_PATH）まで定義する「D18-A（Doctor診断仕様）」も作れます。

