# ADR（Architecture Decision Records）

設計上の重要な判断を記録する。1 判断 = 1 ファイル。

- ファイル名: `NNNN-<kebab-case-title>.md`（連番）
- ステータス: `提案` → `承認` → （必要に応じて）`廃止` / `置換: NNNN`
- 承認済み ADR の内容は書き換えず、判断を変える場合は新しい ADR で置き換える

| No.                                  | タイトル                                          | ステータス |
| ------------------------------------ | ------------------------------------------------- | ---------- |
| [0001](0001-typescript-monorepo.md)  | TypeScript モノレポとオニオンアーキテクチャの採用 | 提案       |
| [0002](0002-local-first-sync.md)     | ローカルファーストと自前の簡易同期                | 提案       |
| [0003](0003-server-db-postgresql.md) | サーバー DB に Cloud SQL for PostgreSQL を採用    | 提案       |
| [0004](0004-voice-parser-port.md)    | 入力解析を差し替え可能な Port とする              | 提案       |
