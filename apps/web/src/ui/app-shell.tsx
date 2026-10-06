import { useCallback, useEffect, useState, type ReactNode } from "react";
import { InsightsIcon, MenuIcon, SettingsIcon, TasksIcon } from "../icons.tsx";

export type View = "tasks" | "insights" | "settings";

const NARROW_QUERY = "(max-width: 899px)";
const NAV_KEY = "nowwhats:nav";

const readNavPreference = (): boolean => {
  try {
    return localStorage.getItem(NAV_KEY) !== "closed";
  } catch {
    return true;
  }
};

/** 左メニューの開閉。広い画面では開閉状態を記憶し、狭い画面では閉じた状態から始めて重ねて開く */
const useNav = () => {
  const [narrow, setNarrow] = useState(() => matchMedia(NARROW_QUERY).matches);
  const [open, setOpen] = useState(() => !matchMedia(NARROW_QUERY).matches && readNavPreference());

  useEffect(() => {
    const mq = matchMedia(NARROW_QUERY);
    const onChange = () => {
      setNarrow(mq.matches);
      setOpen(!mq.matches && readNavPreference());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!narrow || !open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [narrow, open]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (!narrow) {
        try {
          localStorage.setItem(NAV_KEY, prev ? "closed" : "open");
        } catch {
          // 保存できない環境では記憶しない
        }
      }
      return !prev;
    });
  }, [narrow]);

  return { narrow, open, toggle, close: () => setOpen(false) };
};

const NAV_ITEMS = [
  { view: "tasks", label: "タスク", Icon: TasksIcon },
  { view: "insights", label: "実績", Icon: InsightsIcon },
  { view: "settings", label: "設定", Icon: SettingsIcon },
] as const;

export interface AppShellProps {
  readonly view: View;
  readonly onNavigate: (view: View) => void;
  readonly openTaskCount: number;
  readonly status: ReactNode;
  readonly children: ReactNode;
}

export const AppShell = ({ view, onNavigate, openTaskCount, status, children }: AppShellProps) => {
  const nav = useNav();

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-faint bg-bg px-4 py-2.5">
        <button
          type="button"
          onClick={nav.toggle}
          aria-controls="sidebar"
          aria-expanded={nav.open}
          aria-label={nav.open ? "メニューを隠す" : "メニューを表示"}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-faint hover:text-fg"
        >
          <MenuIcon className="size-5" />
        </button>
        <div className="font-mark text-xl font-semibold tracking-wide">
          now<span className="text-brand">whats</span>
        </div>
        <div className="ml-auto">{status}</div>
      </header>

      <div
        className={`grid transition-[grid-template-columns] duration-200 motion-reduce:transition-none ${
          !nav.narrow && nav.open
            ? "grid-cols-[224px_minmax(0,1fr)]"
            : "grid-cols-[0px_minmax(0,1fr)]"
        } max-[899px]:grid-cols-[minmax(0,1fr)]`}
      >
        <nav
          id="sidebar"
          aria-label="メニュー"
          className={
            nav.narrow
              ? `fixed inset-y-0 left-0 z-50 w-56 bg-surface shadow-2xl transition-transform duration-200 motion-reduce:transition-none ${
                  nav.open ? "translate-x-0" : "invisible -translate-x-full"
                }`
              : `sticky top-[57px] h-[calc(100dvh-57px)] self-start overflow-hidden border-r ${
                  nav.open ? "border-faint" : "invisible border-transparent"
                }`
          }
        >
          <ul className="grid w-56 gap-1 px-3 py-4">
            {NAV_ITEMS.map(({ view: v, label, Icon }) => (
              <li key={v}>
                <button
                  type="button"
                  aria-current={view === v ? "page" : undefined}
                  onClick={() => {
                    onNavigate(v);
                    if (nav.narrow) nav.close();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.925rem] text-muted hover:bg-faint hover:text-fg aria-[current=page]:bg-accent-soft aria-[current=page]:font-bold aria-[current=page]:text-accent"
                >
                  <Icon className="size-[18px] shrink-0" />
                  {label}
                  {v === "tasks" && (
                    <span className="ml-auto font-mark text-xs tabular-nums">{openTaskCount}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {nav.narrow && nav.open && (
          <div className="fixed inset-0 z-40 bg-black/35" onClick={nav.close} aria-hidden="true" />
        )}

        <main className="min-w-0 px-4 pt-5 pb-12">
          <div className="mx-auto grid max-w-[720px] gap-4">{children}</div>
        </main>
      </div>
    </>
  );
};
