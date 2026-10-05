import type { CreateTaskError, ChangeTaskStatusError, TaskDto } from "@nowwhats/task-management";

export type CommandError = CreateTaskError | ChangeTaskStatusError;

/** push した変更 1 件ごとの処理結果 */
export type ChangeResult =
  | { readonly changeId: string; readonly status: "applied" }
  | { readonly changeId: string; readonly status: "rejected"; readonly error: CommandError };

/** pull で返す変更。seq はサーバーで採番する単調増加の連番 */
export interface TaskChange {
  readonly seq: number;
  readonly task: TaskDto;
}

export interface PullResult {
  /**
   * サーバーの変更ログの識別子。DB の作り直し等で seq が振り直されると値が変わる。
   * クライアントは前回と異なる値を受け取ったら、cursor を 0 に戻して全件を取り込み直す。
   */
  readonly epoch: string;
  readonly changes: TaskChange[];
  /** 次回の pull で渡すカーソル（取得済みの最大 seq） */
  readonly cursor: number;
  /** まだ取得していない変更が残っているか */
  readonly hasMore: boolean;
}
