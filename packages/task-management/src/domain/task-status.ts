export const TASK_STATUSES = ["todo", "doing", "done", "canceled"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
