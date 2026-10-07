import { describe, expect, it } from "vitest";
import { fixedClock, InMemoryTaskRepository, OWNER, uuid } from "../testing/fixtures.ts";
import { CreateTask } from "./create-task.ts";

const setup = () => {
  const repository = new InMemoryTaskRepository();
  return { repository, useCase: new CreateTask({ repository, clock: fixedClock }) };
};

describe("CreateTask", () => {
  it("タイトルのみでタスクを登録できる", async () => {
    const { repository, useCase } = setup();

    const result = await useCase.execute({ ownerId: OWNER, id: uuid(1), title: "牛乳を買う" });

    expect(result).toEqual({
      ok: true,
      value: {
        id: uuid(1),
        title: "牛乳を買う",
        description: "",
        status: "todo",
        priority: "medium",
        dueDate: null,
        storyPoints: 1,
        tagIds: [],
        completedAt: null,
        version: 1,
      },
    });
    expect(repository.size).toBe(1);
  });

  it("空のタイトルは保存せずエラーを返す", async () => {
    const { repository, useCase } = setup();

    const result = await useCase.execute({ ownerId: OWNER, id: uuid(1), title: " " });

    expect(result).toEqual({ ok: false, error: { type: "TaskTitleEmpty" } });
    expect(repository.size).toBe(0);
  });

  it("不正な ID は拒否する", async () => {
    const { useCase } = setup();

    const result = await useCase.execute({ ownerId: OWNER, id: "t-1", title: "a" });

    expect(result).toEqual({ ok: false, error: { type: "TaskIdInvalid" } });
  });

  it("同じ ID の再登録は拒否する（同期の再送対策）", async () => {
    const { useCase } = setup();
    await useCase.execute({ ownerId: OWNER, id: uuid(1), title: "a" });

    const result = await useCase.execute({ ownerId: OWNER, id: uuid(1), title: "b" });

    expect(result).toEqual({ ok: false, error: { type: "TaskAlreadyExists" } });
  });

  it("ストーリーポイントは目盛りの値だけ受け付け、未指定なら 1 にする", async () => {
    const { useCase } = setup();

    const five = await useCase.execute({ ownerId: OWNER, id: uuid(1), title: "a", storyPoints: 5 });
    const four = await useCase.execute({ ownerId: OWNER, id: uuid(2), title: "b", storyPoints: 4 });

    expect(five).toMatchObject({ ok: true, value: { storyPoints: 5 } });
    expect(four).toEqual({ ok: false, error: { type: "StoryPointInvalid" } });
  });
});
