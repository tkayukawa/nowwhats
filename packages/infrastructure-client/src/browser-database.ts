import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { migrate } from "./migrations.ts";
import { fromSqliteWasm, type SqlDatabase } from "./sql-database.ts";

export interface BrowserDatabase {
  readonly db: SqlDatabase;
  /** OPFS に永続化できているか。false の場合はメモリ上のみ（再読み込みで消える） */
  readonly persistent: boolean;
}

/**
 * ブラウザでローカル DB を開く。Web Worker の中で呼ぶこと（OPFS の SAH プール方式は Worker 専用）。
 * OPFS が使えない環境ではメモリ DB にフォールバックする。
 */
export const openBrowserDatabase = async (): Promise<BrowserDatabase> => {
  const sqlite3 = await sqlite3InitModule();
  let database: BrowserDatabase;
  try {
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: "nowwhats" });
    database = {
      db: fromSqliteWasm(new pool.OpfsSAHPoolDb("/nowwhats.sqlite3")),
      persistent: true,
    };
  } catch (e) {
    console.warn("OPFS is not available; falling back to in-memory database", e);
    database = { db: fromSqliteWasm(new sqlite3.oo1.DB(":memory:", "c")), persistent: false };
  }
  migrate(database.db);
  return database;
};
