import { ok, type OwnerId, type Result } from "@nowwhats/shared-kernel";
import type { Priority } from "../domain/priority.ts";
import { Task } from "../domain/task.ts";
import type { TaskId } from "../domain/task-id.ts";
import type { TaskRepository } from "../domain/task-repository.ts";
import { TaskTitle, type TaskTitleError } from "../domain/task-title.ts";
import type { Clock, TaskIdGenerator } from "./ports.ts";

export interface CreateTaskInput {
  readonly ownerId: OwnerId;
  readonly title: string;
  readonly priority?: Priority;
  readonly dueDate?: Date | null;
}

export type CreateTaskError = TaskTitleError;

export class CreateTask {
  constructor(
    private readonly deps: {
      readonly repository: TaskRepository;
      readonly idGenerator: TaskIdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: CreateTaskInput): Promise<Result<{ id: TaskId }, CreateTaskError>> {
    const title = TaskTitle.create(input.title);
    if (!title.ok) {
      return title;
    }
    const task = Task.create({
      id: this.deps.idGenerator.next(),
      ownerId: input.ownerId,
      title: title.value,
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      now: this.deps.clock.now(),
    });
    await this.deps.repository.save(task);
    return ok({ id: task.id });
  }
}
