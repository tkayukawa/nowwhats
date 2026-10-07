import { OwnerId } from "@nowwhats/shared-kernel";
import { Tag, TagColor, TagId, TagName, Task, TaskId, TaskTitle } from "@nowwhats/task-management";
import { describe, expect, it } from "vitest";
import { InMemoryChangeLog } from "./in-memory-change-log.ts";
import { InMemoryTagRepository } from "./in-memory-tag-repository.ts";
import { InMemoryTaskRepository } from "./in-memory-task-repository.ts";

const owner = OwnerId.of("u-1");
const now = new Date("2026-10-05T00:00:00Z");

const newTask = (): Task => {
  const id = TaskId.parse("0199b1a0-0000-7000-8000-000000000001");
  const title = TaskTitle.create("a");
  if (!id.ok || !title.ok) throw new Error("invalid fixture");
  return Task.create({ id: id.value, ownerId: owner, title: title.value, now });
};

const newTag = (): Tag => {
  const id = TagId.parse("0199b1a0-0000-7000-9000-000000000001");
  const name = TagName.create("仕事");
  if (!id.ok || !name.ok) throw new Error("invalid fixture");
  return Tag.create({
    id: id.value,
    ownerId: owner,
    name: name.value,
    color: TagColor.forIndex(0),
  });
};

describe("InMemoryTaskRepository / InMemoryTagRepository", () => {
  it("保存後に集約を変更しても、save するまで保存内容は変わらない", async () => {
    const repository = new InMemoryTaskRepository(new InMemoryChangeLog());
    const task = newTask();
    await repository.save(task);

    task.complete(now);

    expect((await repository.findById(owner, task.id))?.status).toBe("todo");
  });

  it("他の利用者のタスク・タグは取得できない", async () => {
    const log = new InMemoryChangeLog();
    const tasks = new InMemoryTaskRepository(log);
    const tags = new InMemoryTagRepository(log);
    await tasks.save(newTask());
    await tags.save(newTag());

    const other = OwnerId.of("u-2");
    expect(await tasks.findAllByOwner(other)).toEqual([]);
    expect(await tags.findAllByOwner(other)).toEqual([]);
    expect(await log.since(other, 0, 10)).toEqual([]);
  });

  it("タスクとタグの保存・削除を、共通の連番で変更ログに記録する", async () => {
    const log = new InMemoryChangeLog();
    const tasks = new InMemoryTaskRepository(log);
    const tags = new InMemoryTagRepository(log);
    const task = newTask();
    const tag = newTag();

    await tasks.save(task);
    await tags.save(tag);
    task.complete(now);
    await tasks.save(task);
    await tags.remove(owner, tag.id);

    const changes = await log.since(owner, 0, 10);
    expect(changes.map((c) => [c.seq, c.kind])).toEqual([
      [1, "task"],
      [2, "tag"],
      [3, "task"],
      [4, "tagDeleted"],
    ]);
    expect(await log.since(owner, 2, 10)).toHaveLength(2);
  });
});
