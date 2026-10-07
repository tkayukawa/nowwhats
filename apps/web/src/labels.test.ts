import { describe, expect, it } from "vitest";
import { rejectionLabel, syncLabel } from "./labels.ts";
import type { LocalTasksState } from "./local/use-local-tasks.ts";

const state = (overrides: Partial<LocalTasksState>): LocalTasksState => ({
  ready: true,
  tasks: [],
  tags: [],
  pending: 0,
  persistent: true,
  online: true,
  syncStatus: "synced",
  rejections: [],
  ...overrides,
});

describe("syncLabel", () => {
  it("オフライン・失敗・未送信・同期済みを出し分ける", () => {
    expect(syncLabel(state({ online: false, pending: 2 }))).toBe("オフライン（未送信 2 件）");
    expect(syncLabel(state({ syncStatus: "failed", pending: 1 }))).toContain("同期に失敗しました");
    expect(syncLabel(state({ pending: 3 }))).toBe("未送信 3 件");
    expect(syncLabel(state({}))).toBe("同期済み");
  });
});

describe("rejectionLabel", () => {
  it("どのタスクのどの操作が取り消されたかを示す", () => {
    const label = rejectionLabel({
      change: {
        changeId: "c-1",
        command: {
          type: "ChangeTaskStatus",
          id: "0199b1a0-0000-7000-8000-000000000001",
          action: "cancel",
        },
      },
      error: { type: "InvalidStatusTransition", from: "done", action: "cancel" },
      title: "本を読む",
    });

    expect(label).toBe(
      "「本を読む」の中止は、他の端末での変更と競合したため取り消されました（この状態からは変更できません）",
    );
  });
});
