import { err, ok, type OwnerId, type Result } from "@nowwhats/shared-kernel";
import {
  PRIORITIES,
  STORY_POINT_SCALE,
  TagName,
  TASK_TAGS_MAX,
  TaskDescription,
  TaskTitle,
  type Priority,
} from "@nowwhats/task-management";

/** 清書に送るタスクの内容（ADR 0008。ID や利用者の情報は含めない） */
export interface CleanupTaskContent {
  readonly title: string;
  readonly description: string;
  /** YYYY-MM-DD。null は期限なし */
  readonly dueDate: string | null;
  readonly priority: Priority;
  readonly storyPoints: number;
  readonly tagNames: readonly string[];
}

export interface CleanupInput {
  readonly task: CleanupTaskContent;
  /** 既存のタグの名前（AI はここから選び、合わなければ新しいタグを提案する） */
  readonly existingTagNames: readonly string[];
  /** 利用者にとっての今日（YYYY-MM-DD）とタイムゾーン。「明日」などの解釈に使う */
  readonly today: string;
  readonly timeZone: string;
}

/** 清書の結果。CleanUpTask がドメインのルールで検証・補正したもの */
export type CleanupProposal = CleanupTaskContent;

/** AI の出力（未検証） */
export interface RawCleanup {
  readonly title: string;
  readonly description: string;
  readonly dueDate: string | null;
  readonly priority: string;
  readonly storyPoints: number;
  readonly tagNames: readonly string[];
}

export type CleanerError = { readonly type: "CleanupRefused" } | { readonly type: "CleanupFailed" };

/** 清書の Port（ADR 0004 / 0008）。実装は Vertex AI 経由の Claude、または開発用の偽の実装 */
export interface TaskCleaner {
  clean(input: CleanupInput): Promise<Result<RawCleanup, CleanerError>>;
}

/** 利用者ごとの 1 日の実行回数を数える Port。上限に達していたら false を返し、数えない */
export interface CleanupQuota {
  tryConsume(ownerId: OwnerId, day: string, limit: number): Promise<boolean>;
}

export type CleanUpTaskError = CleanerError | { readonly type: "CleanupQuotaExceeded" };

/** 1 日の実行回数の上限（ADR 0008） */
export const CLEANUP_DAILY_LIMIT = 50;
/** 1 回の清書で新しく作るタグの上限 */
export const CLEANUP_NEW_TAGS_MAX = 2;
/** 清書に送る説明文の上限（先頭から） */
export const CLEANUP_DESCRIPTION_MAX = 8_000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface CleanUpTaskDeps {
  readonly cleaner: TaskCleaner;
  readonly quota: CleanupQuota;
  /** 回数制限の「1 日」を決める日付（YYYY-MM-DD）を返す */
  readonly currentDay: () => string;
}

/**
 * タスクを AI で清書する。AI の出力はそのまま信用せず、ドメインのルールで検証し、
 * 不正な値は清書前の値に戻す（タイトル・ポイント・優先度・期限）。
 */
export class CleanUpTask {
  private readonly deps: CleanUpTaskDeps;

  constructor(deps: CleanUpTaskDeps) {
    this.deps = deps;
  }

  async execute(input: {
    readonly ownerId: OwnerId;
    readonly cleanup: CleanupInput;
  }): Promise<Result<CleanupProposal, CleanUpTaskError>> {
    if (
      !(await this.deps.quota.tryConsume(
        input.ownerId,
        this.deps.currentDay(),
        CLEANUP_DAILY_LIMIT,
      ))
    ) {
      return err({ type: "CleanupQuotaExceeded" });
    }
    const request: CleanupInput = {
      ...input.cleanup,
      task: {
        ...input.cleanup.task,
        description: input.cleanup.task.description.slice(0, CLEANUP_DESCRIPTION_MAX),
      },
    };
    const raw = await this.deps.cleaner.clean(request);
    if (!raw.ok) return raw;
    return ok(normalize(raw.value, input.cleanup));
  }
}

const normalize = (raw: RawCleanup, input: CleanupInput): CleanupProposal => {
  const original = input.task;
  const title = TaskTitle.create(raw.title);
  const description = TaskDescription.create(raw.description);
  const priority = PRIORITIES.find((p) => p === raw.priority) ?? original.priority;
  const storyPoints = STORY_POINT_SCALE.find((p) => p === raw.storyPoints) ?? original.storyPoints;
  const dueDate =
    raw.dueDate === null ? null : DATE_PATTERN.test(raw.dueDate) ? raw.dueDate : original.dueDate;
  return {
    title: title.ok ? title.value : original.title,
    description: description.ok ? description.value : original.description,
    dueDate,
    priority,
    storyPoints,
    tagNames: normalizeTags(raw.tagNames, input.existingTagNames),
  };
};

/** 既存のタグは既存の表記に揃え、新しいタグは上限までにする。重複は除く */
const normalizeTags = (names: readonly string[], existing: readonly string[]): string[] => {
  const byKey = new Map(existing.map((name) => [TagName.normalize(name), name]));
  const result: string[] = [];
  const seen = new Set<string>();
  let created = 0;
  for (const raw of names) {
    const name = TagName.create(raw);
    if (!name.ok) continue;
    const key = TagName.normalize(name.value);
    if (seen.has(key)) continue;
    const known = byKey.get(key);
    if (known === undefined) {
      if (created >= CLEANUP_NEW_TAGS_MAX) continue;
      created += 1;
    }
    seen.add(key);
    result.push(known ?? name.value);
    if (result.length >= TASK_TAGS_MAX) break;
  }
  return result;
};
