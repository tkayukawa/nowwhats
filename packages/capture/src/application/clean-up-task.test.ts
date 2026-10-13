import { OwnerId } from "@nowwhats/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  CleanUpTask,
  type CleanupInput,
  type CleanupQuota,
  type RawCleanup,
  type TaskCleaner,
} from "./clean-up-task.ts";

const owner = OwnerId.of("u-1");

const input: CleanupInput = {
  task: {
    title: "あしたまでに請求書おくる",
    description: "",
    dueDate: null,
    priority: "medium",
    storyPoints: 1,
    tagNames: [],
  },
  existingTagNames: ["仕事", "Money"],
  today: "2026-10-09",
  timeZone: "Asia/Tokyo",
};

const cleanerReturning = (raw: Partial<RawCleanup>): TaskCleaner & { received: CleanupInput[] } => {
  const received: CleanupInput[] = [];
  return {
    received,
    clean: (i) => {
      received.push(i);
      return Promise.resolve({
        ok: true,
        value: {
          title: "請求書を送る",
          description: "",
          dueDate: "2026-10-10",
          priority: "high",
          storyPoints: 2,
          tagNames: [],
          ...raw,
        },
      });
    },
  };
};

const unlimited: CleanupQuota = { tryConsume: () => Promise.resolve(true) };

const run = (cleaner: TaskCleaner, quota = unlimited, cleanup = input) =>
  new CleanUpTask({ cleaner, quota, currentDay: () => "2026-10-09" }).execute({
    ownerId: owner,
    cleanup,
  });

describe("CleanUpTask", () => {
  it("AI の清書結果を返す", async () => {
    expect(await run(cleanerReturning({}))).toEqual({
      ok: true,
      value: {
        title: "請求書を送る",
        description: "",
        dueDate: "2026-10-10",
        priority: "high",
        storyPoints: 2,
        tagNames: [],
      },
    });
  });

  it("不正な値は清書前の値に戻す", async () => {
    const result = await run(
      cleanerReturning({ title: " ", priority: "urgent", storyPoints: 4, dueDate: "来週" }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { title: input.task.title, priority: "medium", storyPoints: 1, dueDate: null },
    });
  });

  it("既存のタグは既存の表記に揃え、新しいタグは 2 個までにする", async () => {
    const result = await run(
      cleanerReturning({ tagNames: ["money", "仕事", "経理", "請求", "書類", "仕事"] }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { tagNames: ["Money", "仕事", "経理", "請求"] },
    });
  });

  it("説明文は先頭 8,000 文字だけを送る", async () => {
    const cleaner = cleanerReturning({});
    await run(cleaner, unlimited, {
      ...input,
      task: { ...input.task, description: "あ".repeat(9_000) },
    });

    expect(cleaner.received[0]?.task.description).toHaveLength(8_000);
  });

  it("1 日の上限に達していたら AI を呼ばずにエラーを返す", async () => {
    const cleaner = cleanerReturning({});
    const exhausted: CleanupQuota = { tryConsume: () => Promise.resolve(false) };

    expect(await run(cleaner, exhausted)).toEqual({
      ok: false,
      error: { type: "CleanupQuotaExceeded" },
    });
    expect(cleaner.received).toHaveLength(0);
  });

  it("AI が拒否・失敗したらそのまま返す", async () => {
    const refused: TaskCleaner = {
      clean: () => Promise.resolve({ ok: false, error: { type: "CleanupRefused" } }),
    };

    expect(await run(refused)).toEqual({ ok: false, error: { type: "CleanupRefused" } });
  });
});
