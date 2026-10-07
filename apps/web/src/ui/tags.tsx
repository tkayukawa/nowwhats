import { TASK_TAGS_MAX, TagName, type TagDto } from "@nowwhats/task-management";
import { useId, useState, type KeyboardEvent } from "react";
import { resolveTags } from "../task-view.ts";

/** タグの色の CSS 変数（styles.css の --nw-tag-*） */
export const tagColorVar = (color: string): string => `var(--nw-tag-${color})`;

/** タグは「色の点 + 名前」で表示し、文字は通常の文字色にする（色だけで区別させない。ADR 0007） */
export const TagChip = ({
  tag,
  onRemove,
}: {
  readonly tag: TagDto;
  readonly onRemove?: () => void;
}) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-faint py-px pr-1.5 pl-1.5 text-[0.72rem] leading-relaxed whitespace-nowrap text-fg">
    <span
      className="size-[7px] rounded-full"
      style={{ background: tagColorVar(tag.color) }}
      aria-hidden="true"
    />
    {tag.name}
    {onRemove !== undefined && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`タグ「${tag.name}」を外す`}
        className="pl-0.5 text-[0.8rem] leading-none text-muted hover:text-fg"
      >
        ×
      </button>
    )}
  </span>
);

type Candidate = { readonly tag: TagDto } | { readonly create: string };

export interface TagFieldProps {
  readonly tags: readonly TagDto[];
  readonly selectedIds: readonly string[];
  readonly onChange: (ids: string[]) => void;
  /** 新しいタグを作る。成功したら ID、失敗したら null を返す */
  readonly onCreate: (name: string) => Promise<string | null>;
  readonly label: string;
}

/** タグの入力欄。既存のタグを候補に出し、候補にない名前ならその場でタグを作る */
export const TagField = ({ tags, selectedIds, onChange, onCreate, label }: TagFieldProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const selected = resolveTags(selectedIds, tags);
  const full = selected.length >= TASK_TAGS_MAX;

  const key = TagName.normalize(query);
  const matches = tags.filter(
    (t) => !selectedIds.includes(t.id) && (key === "" || TagName.normalize(t.name).includes(key)),
  );
  const exact = tags.some((t) => TagName.normalize(t.name) === key);
  const candidates: Candidate[] = [
    ...matches.map((tag) => ({ tag })),
    ...(key !== "" && !exact ? [{ create: query.trim() }] : []),
  ];

  const choose = async (c: Candidate) => {
    if (full) return;
    const id = "tag" in c ? c.tag.id : await onCreate(c.create);
    if (id !== null) onChange([...selectedIds, id]);
    setQuery("");
    setActive(0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, candidates.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // 親のフォーム（登録）を送信しない
      e.preventDefault();
      const c = candidates[active];
      if (c !== undefined) void choose(c);
    } else if (e.key === "Backspace" && query === "" && selectedIds.length > 0) {
      onChange(selectedIds.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1">
      {selected.map((t) => (
        <TagChip
          key={t.id}
          tag={t}
          onRemove={() => onChange(selectedIds.filter((id) => id !== t.id))}
        />
      ))}
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open && candidates.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        disabled={full}
        placeholder={full ? `タグは ${TASK_TAGS_MAX} 個まで` : "タグを追加（Enter）"}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className="min-w-28 flex-1 bg-transparent py-0.5 text-[0.8rem] outline-none placeholder:text-muted"
      />
      {open && candidates.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+4px)] left-0 z-30 max-h-60 w-max max-w-full min-w-52 overflow-auto rounded-xl border border-faint bg-surface p-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]"
        >
          {candidates.map((c, i) => (
            <li key={"tag" in c ? c.tag.id : "create"}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                // 入力欄のフォーカスが外れる前に選べるよう、mousedown で処理する
                onMouseDown={(e) => {
                  e.preventDefault();
                  void choose(c);
                }}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm hover:bg-accent-soft aria-selected:bg-accent-soft"
              >
                {"tag" in c ? (
                  <>
                    <span
                      className="size-2 rounded-full"
                      style={{ background: tagColorVar(c.tag.color) }}
                      aria-hidden="true"
                    />
                    {c.tag.name}
                  </>
                ) : (
                  <span className="text-accent">＋「{c.create}」を新しく作る</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
