import { OwnerId } from "@nowwhats/shared-kernel";
import { describe, expect, it } from "vitest";
import { FakeTaskCleaner } from "./fake-task-cleaner.ts";
import { InMemoryCleanupQuota } from "./in-memory-cleanup-quota.ts";

describe("FakeTaskCleaner", () => {
  it("「明日」「至急」を期限と優先度に移す", async () => {
    const result = await new FakeTaskCleaner().clean({
      task: {
        title: "至急 明日までに 請求書を 送る",
        description: "",
        dueDate: null,
        priority: "medium",
        storyPoints: 1,
        tagNames: [],
      },
      existingTagNames: [],
      today: "2026-10-31",
      timeZone: "Asia/Tokyo",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { title: "請求書を 送る", dueDate: "2026-11-01", priority: "high" },
    });
  });
});

describe("InMemoryCleanupQuota", () => {
  it("利用者・日ごとに上限まで数える", async () => {
    const quota = new InMemoryCleanupQuota();
    const a = OwnerId.of("a");

    expect(await quota.tryConsume(a, "2026-10-09", 2)).toBe(true);
    expect(await quota.tryConsume(a, "2026-10-09", 2)).toBe(true);
    expect(await quota.tryConsume(a, "2026-10-09", 2)).toBe(false);
    expect(await quota.tryConsume(a, "2026-10-10", 2)).toBe(true);
    expect(await quota.tryConsume(OwnerId.of("b"), "2026-10-09", 2)).toBe(true);
  });
});
