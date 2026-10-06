import type { SqlDatabase } from "./sql-database.ts";

/** ローカル DB のスキーマ。末尾に追加していき、既存の要素は変更しない。 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    due_date TEXT,
    version INTEGER NOT NULL
  );
  CREATE TABLE server_tasks (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    change_id TEXT NOT NULL UNIQUE,
    command TEXT NOT NULL
  );
  CREATE TABLE sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // 2: ストーリーポイント。既存のタスクは既定値 1 とする
  `ALTER TABLE tasks ADD COLUMN story_points INTEGER NOT NULL DEFAULT 1;`,
  // 3: 説明文（Markdown）。既存のタスクは空
  `ALTER TABLE tasks ADD COLUMN description TEXT NOT NULL DEFAULT '';`,
  // 4: 完了日時（実績の集計用）と、操作を実行した日時（同期時の再実行用）。既存は記録なし
  `
  ALTER TABLE tasks ADD COLUMN completed_at TEXT;
  ALTER TABLE outbox ADD COLUMN occurred_at TEXT;
  `,
];

/** 未適用のマイグレーションを順に適用する。適用済みの数は PRAGMA user_version で管理する。 */
export const migrate = (db: SqlDatabase): void => {
  const [row] = db.all<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  MIGRATIONS.slice(current).forEach((sql, i) => {
    db.run("BEGIN");
    try {
      db.run(sql);
      db.run(`PRAGMA user_version = ${current + i + 1}`);
      db.run("COMMIT");
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }
  });
};
