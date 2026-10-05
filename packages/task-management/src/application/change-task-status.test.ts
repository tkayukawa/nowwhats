import { describe, expect, it } from "vitest";
import {
  fixedClock,
  InMemoryTaskRepository,
  OTHER_OWNER,
  OWNER,
  uuid,
} from "../testing/fixtures.ts";
import { ChangeTaskStatus } from "./change-task-status.ts";
import { CreateTask } from "./create-task.ts";

const setup = async () => {
  const repository = new InMemoryTaskRepository();
  await new CreateTask({ repository, clock: fixedClock }).execute({
    ownerId: OWNER,
    id: uuid(1),
    title: "a",
  });
  return new ChangeTaskStatus({ repository, clock: fixedClock });
};

describe("ChangeTaskStatus", () => {
  it("完了にすると status が done になり version が増える", async () => {
    const useCase = await setup();

    const result = await useCase.execute({ ownerId: OWNER, id: uuid(1), action: "complete" });

    expect(result).toMatchObject({ ok: true, value: { status: "done", version: 2 } });
  });

  it("許可されない遷移はエラーを返す", async () => {
    const useCase = await setup();

    const result = await useCase.execute({ ownerId: OWNER, id: uuid(1), action: "reopen" });

    expect(result).toEqual({
      ok: false,
      error: { type: "InvalidStatusTransition", from: "todo", action: "reopen" },
    });
  });

  it("他の利用者のタスクは見つからない扱いにする", async () => {
    const useCase = await setup();

    const result = await useCase.execute({
      ownerId: OTHER_OWNER,
      id: uuid(1),
      action: "complete",
    });

    expect(result).toEqual({ ok: false, error: { type: "TaskNotFound" } });
  });
});
