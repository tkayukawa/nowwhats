import { describe, expect, it } from "vitest";
import { fixedClock, InMemoryTaskRepository, OWNER, uuid } from "../testing/fixtures.ts";
import { CreateTask } from "./create-task.ts";
import { fromTaskDto, toTaskDto, type TaskDto } from "./task-dto.ts";

describe("fromTaskDto", () => {
  it("toTaskDto の結果から同じ集約を復元できる", async () => {
    const repository = new InMemoryTaskRepository();
    const created = await new CreateTask({ repository, clock: fixedClock }).execute({
      ownerId: OWNER,
      id: uuid(1),
      title: "a",
      dueDate: new Date("2026-10-06T00:00:00Z"),
    });
    if (!created.ok) throw new Error("fixture");

    const task = fromTaskDto(created.value, OWNER);

    expect(task && toTaskDto(task)).toEqual(created.value);
  });

  it("不正な値なら null を返す", () => {
    const dto: TaskDto = {
      id: "x",
      title: "a",
      description: "",
      status: "todo",
      priority: "medium",
      dueDate: null,
      storyPoints: 1,
      tagIds: [],
      completedAt: null,
      statusHistory: [{ status: "todo", at: "2026-10-05T00:00:00.000Z" }],
      version: 1,
    };

    expect(fromTaskDto(dto, OWNER)).toBeNull();
  });

  it("storyPoints がない古い DTO は既定値 1 として復元する", () => {
    const dto = {
      id: uuid(1),
      title: "a",
      status: "todo",
      priority: "medium",
      dueDate: null,
      version: 1,
    } as unknown as TaskDto;

    expect(fromTaskDto(dto, OWNER)?.toSnapshot().storyPoints).toBe(1);
  });
});
