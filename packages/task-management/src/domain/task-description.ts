import { err, ok, type Result } from "@nowwhats/shared-kernel";

declare const taskDescriptionBrand: unique symbol;

/** タスクの説明文（Markdown）。空文字は「説明なし」を表す。 */
export type TaskDescription = string & { readonly [taskDescriptionBrand]: never };

/** 説明文の上限文字数。同期の 1 回の送信量を抑えるため */
export const TASK_DESCRIPTION_MAX_LENGTH = 20_000;

export type TaskDescriptionError = { readonly type: "TaskDescriptionTooLong" };

export const TaskDescription = {
  empty: "" as TaskDescription,
  create(value: string): Result<TaskDescription, TaskDescriptionError> {
    // 末尾の空白・改行だけを取り除く（Markdown では先頭の空白に意味があるため）
    const trimmed = value.trimEnd();
    if (trimmed.length > TASK_DESCRIPTION_MAX_LENGTH) {
      return err({ type: "TaskDescriptionTooLong" });
    }
    return ok(trimmed as TaskDescription);
  },
};
