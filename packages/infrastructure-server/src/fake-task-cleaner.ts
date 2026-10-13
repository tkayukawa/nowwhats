import type { CleanerError, CleanupInput, RawCleanup, TaskCleaner } from "@nowwhats/capture";
import { ok, type Result } from "@nowwhats/shared-kernel";

const addDays = (day: string, days: number): string => {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return date.toISOString().slice(0, 10);
};

/**
 * 開発・テスト用の偽の清書。Vertex AI を呼ばず、決まった規則で整える（ADR 0008）。
 * 「今日」「明日」→ 期限、「至急」「急ぎ」→ 優先度 高、「いつか」→ 優先度 低。
 */
export class FakeTaskCleaner implements TaskCleaner {
  clean(input: CleanupInput): Promise<Result<RawCleanup, CleanerError>> {
    const { task, today } = input;
    let title = task.title.replace(/\s+/g, " ").trim();
    let dueDate = task.dueDate;
    let priority: string = task.priority;
    const rules: [RegExp, () => void][] = [
      [/(あした|明日)(まで(に)?)?/, () => (dueDate = addDays(today, 1))],
      [/(今日中|きょう中|今日)(まで(に)?)?/, () => (dueDate = today)],
      [/(至急|急ぎ)[、。！!]?/, () => (priority = "high")],
      [/いつか/, () => (priority = "low")],
    ];
    for (const [pattern, apply] of rules) {
      if (pattern.test(title)) {
        apply();
        title = title.replace(pattern, "").trim();
      }
    }
    return Promise.resolve(
      ok({
        title: title === "" ? task.title : title.replace(/\s+/g, " ").trim(),
        description: task.description.trim(),
        dueDate,
        priority,
        storyPoints: task.storyPoints,
        tagNames: [...task.tagNames],
      }),
    );
  }
}
