import { TaskId } from "@nowwhats/task-management";
import { describe, expect, it } from "vitest";
import { uuidv7 } from "./uuidv7.ts";

describe("uuidv7", () => {
  it("version 7・variant 10 の UUID 形式で、TaskId として受け付けられる", () => {
    const id = uuidv7();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(TaskId.parse(id).ok).toBe(true);
  });

  it("先頭 48 ビットに時刻が入り、時刻が異なれば文字列順が時刻順になる", () => {
    const ms = Date.UTC(2026, 9, 5, 0, 0, 0, 0);
    const earlier = uuidv7(ms);
    const later = uuidv7(ms + 1);

    expect(earlier.replace("-", "").slice(0, 12)).toBe(ms.toString(16).padStart(12, "0"));
    expect(earlier < later).toBe(true);
  });
});
