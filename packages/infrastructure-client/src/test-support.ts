import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { migrate } from "./migrations.ts";
import { fromSqliteWasm, type SqlDatabase } from "./sql-database.ts";

/** テスト用: Node 上のメモリ DB（sqlite-wasm）を作り、マイグレーションを適用する。 */
export const createTestDatabase = async (): Promise<SqlDatabase> => {
  const sqlite3 = await sqlite3InitModule();
  const db = fromSqliteWasm(new sqlite3.oo1.DB(":memory:", "c"));
  migrate(db);
  return db;
};
