import { err, ok, type OwnerId, type Result } from "@nowwhats/shared-kernel";
import type { Priority } from "../domain/priority.ts";
import { StoryPoint, type StoryPointError } from "../domain/story-point.ts";
import { Task } from "../domain/task.ts";
import { TaskId, type TaskIdError } from "../domain/task-id.ts";
import type { TaskRepository } from "../domain/task-repository.ts";
import { TaskTitle, type TaskTitleError } from "../domain/task-title.ts";
import type { Clock } from "./ports.ts";
import { toTaskDto, type TaskDto } from "./task-dto.ts";

export interface CreateTaskInput {
  readonly ownerId: OwnerId;
  /** クライアントで生成した UUIDv7（ADR 0002） */
  readonly id: string;
  readonly title: string;
  readonly priority?: Priority;
  readonly dueDate?: Date | null;
  /** 未指定なら既定値（DEFAULT_STORY_POINT） */
  readonly storyPoints?: number;
}

export type CreateTaskError =
  TaskIdError | TaskTitleError | StoryPointError | { readonly type: "TaskAlreadyExists" };

export interface CreateTaskDeps {
  readonly repository: TaskRepository;
  readonly clock: Clock;
}

export class CreateTask {
  private readonly deps: CreateTaskDeps;

  constructor(deps: CreateTaskDeps) {
    this.deps = deps;
  }

  async execute(input: CreateTaskInput): Promise<Result<TaskDto, CreateTaskError>> {
    const id = TaskId.parse(input.id);
    if (!id.ok) {
      return id;
    }
    const title = TaskTitle.create(input.title);
    if (!title.ok) {
      return title;
    }
    const storyPoints =
      input.storyPoints === undefined ? null : StoryPoint.parse(input.storyPoints);
    if (storyPoints !== null && !storyPoints.ok) {
      return storyPoints;
    }
    if ((await this.deps.repository.findById(input.ownerId, id.value)) !== null) {
      return err({ type: "TaskAlreadyExists" });
    }
    const task = Task.create({
      id: id.value,
      ownerId: input.ownerId,
      title: title.value,
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      ...(storyPoints !== null && { storyPoints: storyPoints.value }),
      now: this.deps.clock.now(),
    });
    await this.deps.repository.save(task);
    return ok(toTaskDto(task));
  }
}
