import { OwnerId } from "@nowwhats/shared-kernel";
import { describe, expect, it } from "vitest";
import { PullChanges } from "./pull-changes.ts";
import type { TaskChange } from "./sync-protocol.ts";

const owner = OwnerId.of("u-1");

const change = (seq: number): TaskChange => ({
  seq,
  task: {
    id: `0199b1a0-0000-7000-8000-${String(seq).padStart(12, "0")}`,
    title: String(seq),
    status: "todo",
    priority: "medium",
    dueDate: null,
    storyPoints: 1,
    version: 1,
  },
});

const feedOf = (all: TaskChange[]) => ({
  since: (_ownerId: OwnerId, cursor: number, limit: number) =>
    Promise.resolve(all.filter((c) => c.seq > cursor).slice(0, limit)),
});

describe("PullChanges", () => {
  it("cursor より後の変更を limit 件まで返し、続きの有無と次の cursor を返す", async () => {
    const useCase = new PullChanges({
      feed: feedOf([change(1), change(2), change(3)]),
      epoch: "e-1",
    });

    const first = await useCase.execute({ ownerId: owner, cursor: 0, limit: 2 });
    expect(first).toMatchObject({ cursor: 2, hasMore: true });
    expect(first.changes.map((c) => c.seq)).toEqual([1, 2]);

    const second = await useCase.execute({ ownerId: owner, cursor: first.cursor, limit: 2 });
    expect(second).toMatchObject({ cursor: 3, hasMore: false });
  });

  it("新しい変更がなければ cursor はそのまま", async () => {
    const useCase = new PullChanges({ feed: feedOf([change(1)]), epoch: "e-1" });

    const result = await useCase.execute({ ownerId: owner, cursor: 1, limit: 10 });

    expect(result).toEqual({ epoch: "e-1", changes: [], cursor: 1, hasMore: false });
  });
});
