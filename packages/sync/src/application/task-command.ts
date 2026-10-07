import type { Priority, TaskAction } from "@nowwhats/task-management";

/**
 * 同期で送受信する「操作」（タスクとタグ）。クライアントは実行した操作を Outbox に記録し、
 * サーバーは同じユースケースで再実行して検証する（ADR 0006）。
 */
export type TaskCommand =
  | {
      readonly type: "CreateTask";
      readonly id: string;
      readonly title: string;
      readonly priority?: Priority | undefined;
      /** ISO 8601 文字列。null は期限なし */
      readonly dueDate?: string | null | undefined;
      /** 未指定なら既定値。ポイント導入前に記録された操作には含まれない */
      readonly storyPoints?: number | undefined;
      readonly tagIds?: readonly string[] | undefined;
    }
  | {
      readonly type: "ChangeTaskStatus";
      readonly id: string;
      readonly action: TaskAction;
    }
  | {
      /** 指定した項目だけを変更する。サーバーへの到着順に、項目ごとに後の変更が優先される（ADR 0006） */
      readonly type: "EditTask";
      readonly id: string;
      readonly changes: {
        readonly title?: string | undefined;
        readonly description?: string | undefined;
        readonly priority?: Priority | undefined;
        /** ISO 8601。null は期限なし */
        readonly dueDate?: string | null | undefined;
        readonly storyPoints?: number | undefined;
        /** タグの ID の集合で置き換える */
        readonly tagIds?: readonly string[] | undefined;
      };
    }
  // タグの操作（ADR 0007）
  | {
      readonly type: "CreateTag";
      readonly id: string;
      readonly name: string;
      readonly color?: string | undefined;
    }
  | { readonly type: "RenameTag"; readonly id: string; readonly name: string }
  | { readonly type: "RecolorTag"; readonly id: string; readonly color: string }
  | { readonly type: "DeleteTag"; readonly id: string };

/** タグに対する操作か（リベースでタスクとタグを分けて扱うため） */
export const isTagCommand = (command: TaskCommand): boolean =>
  command.type === "CreateTag" ||
  command.type === "RenameTag" ||
  command.type === "RecolorTag" ||
  command.type === "DeleteTag";

/** 送信待ちの変更。changeId はクライアントで生成し、再送時の重複適用を防ぐ。 */
export interface PendingChange {
  readonly changeId: string;
  readonly command: TaskCommand;
  /**
   * クライアントで操作を実行した日時（ISO 8601）。サーバーはこの日時で再実行する（ADR 0006）。
   * 導入前に記録された操作には含まれない
   */
  readonly occurredAt?: string | undefined;
}
