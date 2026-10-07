import {
  TAG_COLORS,
  TAG_NAME_MAX_LENGTH,
  type TagDto,
  type TaskDto,
} from "@nowwhats/task-management";
import { useEffect, useState } from "react";
import { ghostButton } from "./classes.ts";
import { tagColorVar } from "./tags.tsx";

const COLOR_LABEL: Record<(typeof TAG_COLORS)[number], string> = {
  blue: "青",
  orange: "オレンジ",
  aqua: "水色",
  yellow: "黄",
  magenta: "ピンク",
  green: "緑",
  violet: "紫",
  red: "赤",
};

interface TagActions {
  /** 失敗時は利用者向けのエラー文言を返す */
  readonly onRename: (id: string, name: string) => Promise<string | null>;
  readonly onRecolor: (id: string, color: string) => Promise<string | null>;
  readonly onDelete: (id: string) => Promise<string | null>;
}

const TagRow = ({
  tag,
  usage,
  onRename,
  onRecolor,
  onDelete,
}: { tag: TagDto; usage: number } & TagActions) => {
  const [name, setName] = useState(tag.name);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 他の端末での変更を同期で受け取ったときに表示を合わせる
  useEffect(() => setName(tag.name), [tag.name]);

  const saveName = async () => {
    if (name.trim() === tag.name) {
      setName(tag.name);
      return;
    }
    const failure = await onRename(tag.id, name);
    setError(failure);
    if (failure !== null) setName(tag.name);
  };

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-faint px-1 py-2 max-[520px]:grid-cols-[minmax(0,1fr)_auto]">
      <div className="grid min-w-0 gap-0.5">
        <input
          type="text"
          aria-label="タグの名前"
          value={name}
          maxLength={TAG_NAME_MAX_LENGTH}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229)
              e.currentTarget.blur();
          }}
          className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[0.9rem] hover:border-faint focus:border-accent focus:bg-bg focus:outline-none"
        />
        <span className="px-1.5 text-xs text-muted tabular-nums">
          {usage} 件のタスク{error !== null && <span className="ml-2 text-danger">{error}</span>}
        </span>
      </div>
      <div
        role="group"
        aria-label={`「${tag.name}」の色`}
        className="flex flex-wrap gap-1 max-[520px]:col-span-full"
      >
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={COLOR_LABEL[c]}
            aria-pressed={tag.color === c}
            onClick={() => void onRecolor(tag.id, c).then(setError)}
            className="size-[18px] rounded-full border-2 border-surface shadow-[0_0_0_1px_var(--nw-faint)] aria-pressed:shadow-[0_0_0_2px_var(--nw-fg)]"
            style={{ background: tagColorVar(c) }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        {confirming ? (
          <>
            <span className="text-muted">{usage} 件のタスクから外れます</span>
            <button
              type="button"
              onClick={() => void onDelete(tag.id).then(setError)}
              className="text-danger hover:underline"
            >
              削除する
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`${ghostButton} px-2 py-0 text-xs`}
            >
              やめる
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-danger hover:underline"
          >
            削除
          </button>
        )}
      </div>
    </li>
  );
};

export const SettingsView = ({
  tags,
  tasks,
  ...actions
}: { readonly tags: readonly TagDto[]; readonly tasks: readonly TaskDto[] } & TagActions) => (
  <>
    <h1 className="text-xl font-bold">設定</h1>
    <section
      aria-labelledby="settings-tags"
      className="grid gap-2.5 rounded-xl border border-faint bg-surface px-4 py-3.5"
    >
      <div className="grid gap-1">
        <h2 id="settings-tags" className="text-[0.95rem] font-bold">
          タグ
        </h2>
        <p className="text-xs text-muted">
          名前を変えると、そのタグを付けたすべてのタスクに反映されます。タグはタスクの登録・編集のときに作れます。
        </p>
      </div>
      {tags.length === 0 ? (
        <p className="text-sm text-muted">
          タグはまだありません。タスクの登録・編集のときに作れます。
        </p>
      ) : (
        <ul className="border-t border-faint">
          {tags.map((t) => (
            <TagRow
              key={t.id}
              tag={t}
              usage={tasks.filter((task) => task.tagIds.includes(t.id)).length}
              {...actions}
            />
          ))}
        </ul>
      )}
    </section>
  </>
);
