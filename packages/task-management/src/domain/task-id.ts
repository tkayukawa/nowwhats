declare const taskIdBrand: unique symbol;

/** タスク ID。オフライン作成に備え、クライアントで生成する（UUIDv7 を想定。ADR 0002）。 */
export type TaskId = string & { readonly [taskIdBrand]: never };

export const TaskId = {
  of(value: string): TaskId {
    if (value.length === 0) {
      throw new Error("TaskId must not be empty");
    }
    return value as TaskId;
  },
};
