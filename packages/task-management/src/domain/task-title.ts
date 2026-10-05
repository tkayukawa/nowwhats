import { err, ok, type Result } from "@nowwhats/shared-kernel";

declare const taskTitleBrand: unique symbol;

export type TaskTitle = string & { readonly [taskTitleBrand]: never };

export type TaskTitleError = { readonly type: "TaskTitleEmpty" };

export const TaskTitle = {
  create(value: string): Result<TaskTitle, TaskTitleError> {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return err({ type: "TaskTitleEmpty" });
    }
    return ok(trimmed as TaskTitle);
  },
};
