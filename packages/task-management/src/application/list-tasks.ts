import type { OwnerId } from "@nowwhats/shared-kernel";
import type { TaskRepository } from "../domain/task-repository.ts";
import { toTaskDto, type TaskDto } from "./task-dto.ts";

export interface ListTasksDeps {
  readonly repository: TaskRepository;
}

/** 利用者のタスク一覧を返す。未完了を先に、同じ状態の中では作成順（UUIDv7 の昇順）に並べる。 */
export class ListTasks {
  private readonly deps: ListTasksDeps;

  constructor(deps: ListTasksDeps) {
    this.deps = deps;
  }

  async execute(input: { readonly ownerId: OwnerId }): Promise<TaskDto[]> {
    const tasks = await this.deps.repository.findAllByOwner(input.ownerId);
    const isClosed = (status: string) => status === "done" || status === "canceled";
    return tasks
      .map(toTaskDto)
      .sort(
        (a, b) =>
          Number(isClosed(a.status)) - Number(isClosed(b.status)) || a.id.localeCompare(b.id),
      );
  }
}
