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
import { ListTasks } from "./list-tasks.ts";

describe("ListTasks", () => {
  it("自分のタスクだけを、未完了 → 完了の順、同じ状態内は作成順で返す", async () => {
    const repository = new InMemoryTaskRepository();
    const create = new CreateTask({ repository, clock: fixedClock });
    await create.execute({ ownerId: OWNER, id: uuid(1), title: "1" });
    await create.execute({ ownerId: OWNER, id: uuid(2), title: "2" });
    await create.execute({ ownerId: OWNER, id: uuid(3), title: "3" });
    await create.execute({ ownerId: OTHER_OWNER, id: uuid(4), title: "other" });
    await new ChangeTaskStatus({ repository, clock: fixedClock }).execute({
      ownerId: OWNER,
      id: uuid(1),
      action: "complete",
    });

    const tasks = await new ListTasks({ repository }).execute({ ownerId: OWNER });

    expect(tasks.map((t) => t.title)).toEqual(["2", "3", "1"]);
  });
});
