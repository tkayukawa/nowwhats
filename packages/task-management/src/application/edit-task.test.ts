import { describe, expect, it } from "vitest";
import {
  fixedClock,
  InMemoryTaskRepository,
  OTHER_OWNER,
  OWNER,
  uuid,
} from "../testing/fixtures.ts";
import { CreateTask } from "./create-task.ts";
import { EditTask } from "./edit-task.ts";

const setup = async () => {
  const repository = new InMemoryTaskRepository();
  await new CreateTask({ repository, clock: fixedClock }).execute({
    ownerId: OWNER,
    id: uuid(1),
    title: "確定申告",
  });
  return { repository, useCase: new EditTask({ repository, clock: fixedClock }) };
};

describe("EditTask", () => {
  it("指定した項目だけを変更し、version を上げる", async () => {
    const { useCase } = await setup();

    const result = await useCase.execute({
      ownerId: OWNER,
      id: uuid(1),
      changes: {
        description: "## 必要なもの\n\n- 源泉徴収票\n\n",
        priority: "high",
        dueDate: new Date("2026-10-10T00:00:00Z"),
        storyPoints: 5,
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: uuid(1),
        title: "確定申告",
        description: "## 必要なもの\n\n- 源泉徴収票",
        status: "todo",
        priority: "high",
        dueDate: "2026-10-10T00:00:00.000Z",
        storyPoints: 5,
        completedAt: null,
        version: 2,
      },
    });
  });

  it("値が変わらない編集では version を上げない", async () => {
    const { useCase } = await setup();

    const result = await useCase.execute({
      ownerId: OWNER,
      id: uuid(1),
      changes: { title: "確定申告", priority: "medium" },
    });

    expect(result).toMatchObject({ ok: true, value: { version: 1 } });
  });

  it("期限は null で解除できる", async () => {
    const { useCase } = await setup();
    await useCase.execute({ ownerId: OWNER, id: uuid(1), changes: { dueDate: new Date(0) } });

    const result = await useCase.execute({
      ownerId: OWNER,
      id: uuid(1),
      changes: { dueDate: null },
    });

    expect(result).toMatchObject({ ok: true, value: { dueDate: null } });
  });

  it("不正な値・存在しないタスクはエラーにし、保存しない", async () => {
    const { useCase, repository } = await setup();

    expect(await useCase.execute({ ownerId: OWNER, id: uuid(1), changes: { title: " " } })).toEqual(
      {
        ok: false,
        error: { type: "TaskTitleEmpty" },
      },
    );
    expect(
      await useCase.execute({ ownerId: OWNER, id: uuid(1), changes: { storyPoints: 4 } }),
    ).toEqual({ ok: false, error: { type: "StoryPointInvalid" } });
    expect(
      await useCase.execute({
        ownerId: OWNER,
        id: uuid(1),
        changes: { description: "a".repeat(20_001) },
      }),
    ).toEqual({ ok: false, error: { type: "TaskDescriptionTooLong" } });
    expect(
      await useCase.execute({ ownerId: OTHER_OWNER, id: uuid(1), changes: { title: "x" } }),
    ).toEqual({ ok: false, error: { type: "TaskNotFound" } });
    expect((await repository.findAllByOwner(OWNER))[0]?.toSnapshot().version).toBe(1);
  });
});
