import type { Database } from "@sqlite.org/sqlite-wasm";

export type SqlValue = string | number | null;

/**
 * SQL 実行の最小インターフェース。sqlite-wasm（Web）以外に、将来 expo-sqlite（モバイル）や
 * Tauri の SQLite（デスクトップ）の Adapter を用意すれば、同じ Repository 実装を使い回せる。
 */
export interface SqlDatabase {
  run(sql: string, params?: readonly SqlValue[]): void;
  all<T extends Record<string, SqlValue>>(sql: string, params?: readonly SqlValue[]): T[];
}

/** sqlite-wasm の oo1 API を SqlDatabase に適合させる。 */
export const fromSqliteWasm = (db: Database): SqlDatabase => ({
  run(sql, params = []) {
    db.exec({ sql, bind: [...params] });
  },
  all<T extends Record<string, SqlValue>>(sql: string, params: readonly SqlValue[] = []) {
    return db.selectObjects(sql, [...params]) as T[];
  },
});
