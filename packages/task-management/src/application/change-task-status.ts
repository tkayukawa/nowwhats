import { err, ok, type OwnerId, type Result } from "@nowwhats/shared-kernel";
import type { TaskAction, TaskTransitionError } from "../domain/task.ts";
import { TaskId, type TaskIdError } from "../domain/task-id.ts";
import type { TaskRepository } from "../domain/task-repository.ts";
import type { Clock } from "./ports.ts";
import { toTaskDto, type TaskDto } from "./task-dto.ts";

export interface ChangeTaskStatusInput {
  readonly ownerId: OwnerId;
  readonly id: string;
  readonly action: TaskAction;
}

export type ChangeTaskStatusError =
  TaskIdError | TaskTransitionError | { readonly type: "TaskNotFound" };

export interface ChangeTaskStatusDeps {
  readonly repository: TaskRepository;
  readonly clock: Clock;
}

/** タスクの状態を遷移させる（着手・完了・中止・再開）。 */
export class ChangeTaskStatus {
  private readonly deps: ChangeTaskStatusDeps;

  constructor(deps: ChangeTaskStatusDeps) {
    this.deps = deps;
  }

  async execute(input: ChangeTaskStatusInput): Promise<Result<TaskDto, ChangeTaskStatusError>> {
    const id = TaskId.parse(input.id);
    if (!id.ok) {
      return id;
    }
    const task = await this.deps.repository.findById(input.ownerId, id.value);
    if (task === null) {
      return err({ type: "TaskNotFound" });
    }
    const result = task.apply(input.action, this.deps.clock.now());
    if (!result.ok) {
      return result;
    }
    await this.deps.repository.save(task);
    return ok(toTaskDto(task));
  }
}
