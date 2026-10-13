import type { ReactNode } from "react";

/** 画面下部に出す短い通知。操作ボタンを 1 つ付けられる */
export const Toast = ({
  children,
  action,
  onDismiss,
}: {
  readonly children: ReactNode;
  readonly action?: { readonly label: string; readonly onClick: () => void };
  readonly onDismiss?: () => void;
}) => (
  <div
    role="status"
    className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] left-1/2 z-[70] flex w-[min(560px,calc(100vw-32px))] -translate-x-1/2 items-center gap-3 rounded-xl bg-fg px-4 py-2.5 text-sm text-bg shadow-lg"
  >
    <span className="min-w-0 flex-1">{children}</span>
    {action !== undefined && (
      <button
        type="button"
        onClick={action.onClick}
        className="shrink-0 font-bold underline underline-offset-2"
      >
        {action.label}
      </button>
    )}
    {onDismiss !== undefined && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="通知を閉じる"
        className="shrink-0 opacity-70 hover:opacity-100"
      >
        ×
      </button>
    )}
  </div>
);
