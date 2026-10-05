import { err, ok, type Result } from "@nowwhats/shared-kernel";

declare const taskIdBrand: unique symbol;

/** タスク ID。オフライン作成に備え、クライアントで UUIDv7 を生成する（ADR 0002）。 */
export type TaskId = string & { readonly [taskIdBrand]: never };

export type TaskIdError = { readonly type: "TaskIdInvalid" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const TaskId = {
  parse(value: string): Result<TaskId, TaskIdError> {
    const normalized = value.toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
      return err({ type: "TaskIdInvalid" });
    }
    return ok(normalized as TaskId);
  },
};
