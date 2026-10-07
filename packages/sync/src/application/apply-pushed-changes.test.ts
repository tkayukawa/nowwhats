import { OwnerId } from "@nowwhats/shared-kernel";
import {
  ChangeTaskStatus,
  CreateTag,
  CreateTask,
  DeleteTag,
  EditTask,
  RecolorTag,
  RenameTag,
  type Task,
  type TaskId,
  type TaskRepository,
} from "@nowwhats/task-management";
import { describe, expect, it } from "vitest";
import { ApplyPushedChanges } from "./apply-pushed-changes.ts";
import type { ProcessedChangeStore } from "./ports.ts";
import type { ChangeResult } from "./sync-protocol.ts";
import type { PendingChange } from "./task-command.ts";

class FakeTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();
  findById(_ownerId: OwnerId, id: TaskId) {
    return Promise.resolve(this.tasks.get(id) ?? null);
  }
  findAllByOwner() {
    return Promise.resolve([...this.tasks.values()]);
  }
  save(task: Task) {
    this.tasks.set(task.id, task);
    return Promise.resolve();
  }
}

/** このテストではタグを使わないため、空の Repository を渡す */
class InMemoryTags {
  findById() {
    return Promise.resolve(null);
  }
  findAllByOwner() {
    return Promise.resolve([]);
  }
  save() {
    return Promise.resolve();
  }
  remove() {
    return Promise.resolve();
  }
}

class FakeProcessedChangeStore implements ProcessedChangeStore {
  readonly results = new Map<string, ChangeResult>();
  find(_ownerId: OwnerId, changeId: string) {
    return Promise.resolve(this.results.get(changeId) ?? null);
  }
  save(_ownerId: OwnerId, result: ChangeResult) {
    this.results.set(result.changeId, result);
    return Promise.resolve();
  }
}

const owner = OwnerId.of("u-1");
const TASK = "0199b1a0-0000-7000-8000-000000000001";

const setup = () => {
  const repository = new FakeTaskRepository();
  const clock = { now: () => new Date("2026-10-05T00:00:00Z") };
  const processedChanges = new FakeProcessedChangeStore();
  const useCase = new ApplyPushedChanges({
    useCasesAt: (at) => ({
      createTask: new CreateTask({ repository, clock: at }),
      changeTaskStatus: new ChangeTaskStatus({ repository, clock: at }),
      editTask: new EditTask({ repository, clock: at }),
      createTag: new CreateTag({ tags: new InMemoryTags() }),
      renameTag: new RenameTag({ tags: new InMemoryTags() }),
      recolorTag: new RecolorTag({ tags: new InMemoryTags() }),
      deleteTag: new DeleteTag({ tags: new InMemoryTags() }),
    }),
    clock,
    processedChanges,
  });
  return { useCase, repository, processedChanges };
};

const create: PendingChange = {
  changeId: "c-1",
  command: { type: "CreateTask", id: TASK, title: "牛乳を買う" },
};
const complete: PendingChange = {
  changeId: "c-2",
  command: { type: "ChangeTaskStatus", id: TASK, action: "complete" },
};

describe("ApplyPushedChanges", () => {
  it("送られた順にユースケースで再実行する", async () => {
    const { useCase, repository } = setup();

    const results = await useCase.execute({ ownerId: owner, changes: [create, complete] });

    expect(results).toEqual([
      { changeId: "c-1", status: "applied" },
      { changeId: "c-2", status: "applied" },
    ]);
    expect((await repository.findAllByOwner())[0]?.status).toBe("done");
  });

  it("ドメインのルールに反する変更は rejected にし、後続の処理は続ける", async () => {
    const { useCase } = setup();
    const reopen: PendingChange = {
      changeId: "c-3",
      command: { type: "ChangeTaskStatus", id: TASK, action: "reopen" },
    };

    const results = await useCase.execute({ ownerId: owner, changes: [create, reopen, complete] });

    expect(results).toEqual([
      { changeId: "c-1", status: "applied" },
      {
        changeId: "c-3",
        status: "rejected",
        error: { type: "InvalidStatusTransition", from: "todo", action: "reopen" },
      },
      { changeId: "c-2", status: "applied" },
    ]);
  });

  it("同じ changeId の再送は再実行せず、前回の結果を返す", async () => {
    const { useCase } = setup();
    await useCase.execute({ ownerId: owner, changes: [create, complete] });

    // 応答が届かずクライアントが同じ変更を再送したケース
    const results = await useCase.execute({ ownerId: owner, changes: [create, complete] });

    expect(results).toEqual([
      { changeId: "c-1", status: "applied" },
      { changeId: "c-2", status: "applied" },
    ]);
  });

  it("クライアントで実行された日時で再実行する（未来の日時はサーバーの現在時刻に丸める）", async () => {
    const { useCase, repository } = setup();
    const completedOffline: PendingChange = { ...complete, occurredAt: "2026-10-03T08:00:00Z" };
    await useCase.execute({ ownerId: owner, changes: [create, completedOffline] });
    expect((await repository.findAllByOwner())[0]?.toSnapshot().completedAt).toEqual(
      new Date("2026-10-03T08:00:00Z"),
    );

    const reopen: PendingChange = {
      changeId: "c-3",
      command: { type: "ChangeTaskStatus", id: TASK, action: "reopen" },
    };
    const future: PendingChange = {
      ...complete,
      changeId: "c-4",
      occurredAt: "2030-01-01T00:00:00Z",
    };
    await useCase.execute({ ownerId: owner, changes: [reopen, future] });
    expect((await repository.findAllByOwner())[0]?.toSnapshot().completedAt).toEqual(
      new Date("2026-10-05T00:00:00Z"),
    );
  });
});
